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
  const moduleScript = [
    'var _internal = { carryoverCache: null, drillCalcTimer: null, pendingKey: null };',
    loadModule('state.js'),
    loadModule('calculations.js'),
    loadModule('ui-handlers.js'),
    loadModule('render-tabs.js'),
    loadModule('render-results.js'),
    loadModule('render-drill.js'),
    loadModule('render-dashboard.js'),
    // Remove DOMContentLoaded from main.js (auto-init doesn't work in jsdom)
    loadModule('main.js').replace(
      "document.addEventListener('DOMContentLoaded', initUI);",
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