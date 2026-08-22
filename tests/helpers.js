/**
 * Shared test helper — loads the Agrar-Rechner JS into a jsdom instance.
 * Works with the modular architecture: state.js, calculations.js, ui-handlers.js,
 * render-tabs.js, render-results.js, render-drill.js, render-dashboard.js, main.js
 * (Issue #212: rendering.js was split into 4 modules in June 2026.)
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
  // Issue #416 Welle 1: culture-handlers.js wird zwischen calculations.js
  // und ui-handlers.js geladen, exakt wie in index.html.
  // Issue #416 Welle 2: tab-handlers.js wird zwischen ui-handlers.js
  // und render-tabs.js geladen, exakt wie in index.html.
  // Issue #416 Welle 3: settings-handlers.js wird zwischen ui-handlers.js
  // und tab-handlers.js geladen, exakt wie in index.html.
  // Issue #416 Welle 4: reset-handlers.js wird zwischen settings-handlers.js
  // und tab-handlers.js geladen, exakt wie in index.html.
  // Issue #416 Welle 5: drill-handlers.js wird zwischen reset-handlers.js
  // und tab-handlers.js geladen, exakt wie in index.html.
  // Issue #416 Welle 6: input-handlers.js wird zwischen ui-handlers.js
  // und settings-handlers.js geladen, exakt wie in index.html.
  // Issue #416 Welle 7: protocol-handlers.js wird zwischen drill-handlers.js
  // und tab-handlers.js geladen, exakt wie in index.html.
  // Issue #416 Welle 8: data-io-handlers.js wird zwischen
  // render-local-protocol.js und main.js geladen, exakt wie in index.html.
  const moduleScript = [
    loadModule('app-globals.js'),
    'var _internal = { carryoverCache: null, drillCalcTimer: null };',
    loadModule('state.js'),
    loadModule('culture.js'),
    loadModule('calculations.js'),
    loadModule('culture-handlers.js'),
    loadModule('ui-handlers.js'),
    loadModule('input-handlers.js'),
    loadModule('settings-handlers.js'),
    loadModule('reset-handlers.js'),
    loadModule('drill-handlers.js'),
    loadModule('protocol-handlers.js'),
    loadModule('tab-handlers.js'),
    loadModule('render-tabs.js'),
    loadModule('render-results.js'),
    loadModule('render-drill.js'),
    loadModule('render-dashboard.js'),
    loadModule('render-local-protocol.js'),
    loadModule('data-io-handlers.js'),
    // Remove DOMContentLoaded auto-init from main.js (initUI is called manually below).
    // The actual code uses `AppGlobals.initUI()` (ADR-001, Issue #278) — match
    // the real text so the replace actually fires. If we don't strip it, the
    // DOMContentLoaded listener fires AFTER the manual call below and registers
    // a duplicate state listener, causing double-renders (e.g. test 17-edge-cases
    // "calls renderDrillSummary to clear stale drill summary" got 2 calls).
    loadModule('main.js').replace(
      "document.addEventListener('DOMContentLoaded', function() {\n  AppGlobals.initUI();\n});",
      ''
    ),
  ].join('\n');

  // Load the app JS
  dom.window.eval(moduleScript);

  // Call initUI so the Core Subscriber is registered (app.onStateChange subscribers)
  // This is safe since DOMContentLoaded never fires in jsdom
  if (typeof dom.window.initUI === 'function') {
    dom.window.initUI();
  }

  return { dom, window: dom.window, store };
}

export function cleanup() {
  // No-op — jsdom instances are garbage collected when references drop
}