/**
 * Shared test helper — loads the Agrar-Rechner JS into a jsdom instance.
 * Works with the modular architecture: state.js, calculations.js, ui-handlers.js,
 * render-tabs.js, render-results.js, render-drill.js, render-dashboard.js, main.js
 * (Issue #212: rendering.js was split into 4 modules in June 2026.)
 *
 * Issue #444 Welle 1:
 *   - MODULE_LOAD_ORDER ist die einzige Quelle der Wahrheit für die
 *     Ladefolge im Test-Harness. tests/test-harness.test.js vergleicht
 *     sie 1:1 mit der <script src>-Reihenfolge aus public/index.html.
 *   - BOOTSTRAP_STRIP_RE ist die Vorlage zum Entfernen des Production-
 *     DOMContentLoaded-Listeners aus main.js. Sie ist verankert auf den
 *     benannten Bootstrap _appBootstrap (siehe public/js/main.js) und
 *     wirft beim ersten Mismatch einen harten Fehler, statt still den
 *     ungetripten Source zu evaluieren (genau dieser Bug ist Issue #444).
 */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(__dirname, '../public/index.html');
const htmlContent = readFileSync(htmlPath, 'utf-8');
const jsDir = resolve(__dirname, '../public/js');

function loadModule(name) {
  try { return readFileSync(resolve(jsDir, name), 'utf-8'); }
  catch { return ''; }
}

/**
 * Modul-Ladefolge (test parity with public/index.html).
 * Spiegel der <script src="js/..."> Reihenfolge — ?v= Query-Strings sind
 * hier normalisiert (siehe readIndexScripts in deploy-sanity.test.js).
 *
 * Wird die Liste hier geändert, MUSS index.html in derselben Änderung
 * angepasst werden (oder umgekehrt); tests/test-harness.test.js erzwingt
 * die Kongruenz automatisch.
 */
export const MODULE_LOAD_ORDER = [
  'app-globals.js',
  'state.js',
  'culture.js',
  'calculations.js',
  'culture-handlers.js',
  'ui-handlers.js',
  'input-handlers.js',
  'settings-handlers.js',
  'reset-handlers.js',
  'drill-handlers.js',
  'protocol-handlers.js',
  'tab-handlers.js',
  'render-tabs.js',
  'state-coordinator.js',
  'render-results.js',
  'render-drill.js',
  'render-dashboard.js',
  'render-local-protocol.js',
  'data-io-handlers.js',
  'main.js',
];

/**
 * Regex, die den Production-DOMContentLoaded-Listener aus main.js entfernt.
 *
 * Anker auf den benannten Bootstrap `_appBootstrap` in public/js/main.js.
 * Wenn der Production-Bootstrap-Pfad geändert wird (Umbenennung,
 * Wechsel der Signatur, …) passt das Pattern nicht mehr und createDom
 * wirft — der Fallback auf "nichts ersetzt" (vor Issue #444) ist damit
 * ausgeschlossen. tests/test-harness.test.js prueft das Pattern gegen den
 * aktuellen main.js-Source.
 */
export const BOOTSTRAP_STRIP_RE =
  /document\.addEventListener\(\s*['"]DOMContentLoaded['"]\s*,\s*_appBootstrap\s*\)\s*;?/;

/**
 * Creates a fresh jsdom instance with the app's JS loaded.
 * Returns { dom, window, store }.
 *
 * The DOMContentLoaded auto-init is removed so tests control init manually.
 */
export function createDom() {
  const dom = new JSDOM(htmlContent, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/',
  });

  // Simple localStorage mock
  const store = {};
  const ls = {
    getItem: (key) => store[key] ?? null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => Object.keys(store).forEach(k => delete store[k]),
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i] ?? null,
    setItemListener: null,
  };
  Object.defineProperty(dom.window, 'localStorage', { value: ls, writable: true });
  Object.defineProperty(dom.window, 'sessionStorage', { value: ls, writable: true });

  // Mock window.matchMedia (MUST be set before eval — showIOSInstallHint uses it during initUI)
  Object.defineProperty(dom.window, 'matchMedia', {
    value: (q) => ({ matches: false, media: q, onchange: null, addListener: () => {}, removeListener: () => {} }),
    writable: true,
  });

  // Mock window.navigator.standalone (iOS PWA detection)
  Object.defineProperty(dom.window.navigator, 'standalone', { value: undefined, writable: true });

  // Mock serviceWorker
  Object.defineProperty(dom.window.navigator, 'serviceWorker', {
    value: { register: () => {} },
    writable: true,
  });

  // Add the tab-add button (renderTabs needs bar.querySelector('.tab-add'))
  const tabAddBtn = dom.window.document.createElement('button');
  tabAddBtn.className = 'tab-add';
  tabAddBtn.textContent = '+ Reiter';
  tabAddBtn.onclick = () => dom.window.addReiter();
  const tabBar = dom.window.document.getElementById('tab_bar');
  if (tabBar) tabBar.appendChild(tabAddBtn);

  // Build combined script from modular JS files (skip the placeholder <script> comment block)
  // ADR-001 (Issue #278): initialise the AppGlobals namespace before any module script runs.
  // app-globals.js declares the namespace AND installs the `state` getter/setter
  // (Live-Alias für `var state`); the test harness loads the real file so the
  // test scope matches production.
  // Issue #416 Welle 1–8 + Issue #417: Die Reihenfolge spiegelt 1:1 die
  // <script src="...">-Liste aus public/index.html wider und wird über die
  // oben exportierte Konstante MODULE_LOAD_ORDER dokumentiert (Kongruenz-
  // test siehe tests/test-harness.test.js).
  const moduleScriptParts = [];
  moduleScriptParts.push(loadModule('app-globals.js'));
  moduleScriptParts.push('var _internal = { carryoverCache: null, drillCalcTimer: null };');
  for (const moduleName of MODULE_LOAD_ORDER) {
    if (moduleName === 'app-globals.js') continue; // bereits oben geladen
    if (moduleName === 'main.js') {
      // Issue #444 Welle 1: Statt einer fragilen String-Konstante entfernen
      // wir den DOMContentLoaded-Listener per Regex (BOOTSTRAP_STRIP_RE).
      // Das Pattern ist auf den benannten Bootstrap _appBootstrap in
      // public/js/main.js verankert; bei einem Mismatch wirft createDom
      // einen harten Fehler, statt still den ungetripten Source zu
      // evaluieren. Verhindert, dass initUI bei createDom() doppelt läuft,
      // falls jsdom (in einer späteren Version) DOMContentLoaded feuert.
      const mainSource = loadModule('main.js');
      if (!BOOTSTRAP_STRIP_RE.test(mainSource)) {
        throw new Error(
          'tests/helpers.js: BOOTSTRAP_STRIP_RE matcht main.js nicht — der ' +
          'DOMContentLoaded-Listener konnte nicht entfernt werden. Vor ' +
          'Issue #444 hat genau dieser Fail-Silent-Bug zu Doppel-' +
          'Initialisierung geführt (Coordinator / Storage-Listener). ' +
          'main.js prüfen und entweder das Pattern in BOOTSTRAP_STRIP_RE ' +
          'nachziehen oder den Bootstrap-Pfad in main.js stabilisieren.'
        );
      }
      moduleScriptParts.push(mainSource.replace(BOOTSTRAP_STRIP_RE, ''));
      continue;
    }
    moduleScriptParts.push(loadModule(moduleName));
  }
  const moduleScript = moduleScriptParts.join('\n');

  // Load the app JS
  dom.window.eval(moduleScript);

  // Call initUI so the Core Subscriber is registered (app.onStateChange subscribers)
  // This is safe since the DOMContentLoaded listener from main.js was stripped
  // above. If a future jsdom version fires DOMContentLoaded regardless, the
  // coordinator / storage listener are still idempotent (see Issue #444
  // B/C tests).
  if (typeof dom.window.initUI === 'function') {
    dom.window.initUI();
  }

  return { dom, window: dom.window, store };
}

export function cleanup() {
  // No-op — jsdom instances are garbage collected when references drop
}