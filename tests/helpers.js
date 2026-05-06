/**
 * Shared test helper — loads the Mais-Rechner JS into a jsdom instance.
 */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(__dirname, '../public/index.html');
const htmlContent = readFileSync(htmlPath, 'utf-8');

/**
 * Creates a fresh jsdom instance with the app's JS loaded.
 * Returns { dom, window, store }.
 *
 * The DOMContentLoaded auto-init is removed so tests control init manually.
 */
export function createDom() {
  // Robust: case-insensitive + letztes <script>-Element (ignoriert HTML-Parsing-Edge-Cases)
  const scriptAll = htmlContent.match(/<script>[\s\S]*?<\/script>/gi) || [];
  const scriptBlock = scriptAll[scriptAll.length - 1] || '';
  const scriptContent = scriptBlock.replace(/<\/?script>/gi, '');
  if (!scriptContent) throw new Error('No <script> block found in index.html');

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
  };
  Object.defineProperty(dom.window, 'localStorage', { value: ls, writable: true });

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
  dom.window.document.getElementById('tab_bar').appendChild(tabAddBtn);

  // Load the app JS (without DOMContentLoaded auto-init and without immediate initTheme call)
  const script = scriptContent
    .replace("document.addEventListener('DOMContentLoaded', initUI);", "")
    .replace("initTheme();", "// initTheme() stubbed in tests");
  dom.window.eval(script);

  // -------------------------------------------------------------------------
  // Add DOM elements referenced by app code but absent from the static HTML.
  // These enable tests that exercise those code paths to run correctly.
  // -------------------------------------------------------------------------
  const doc = dom.window.document;
  const body = doc.body;

  function el(id, tag, attrs = {}) {
    if (!doc.getElementById(id)) {
      const e = doc.createElement(tag);
      e.id = id;
      Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
      body.appendChild(e);
    }
  }

  // Theme elements
  el('theme_toggle', 'button', { id: 'theme_toggle' });
  if (doc.getElementById('theme_toggle')) doc.getElementById('theme_toggle').textContent = '🌙';

  // Drill tab list (referenced by renderDrillTabList when switching to protokoll)
  el('drill_tab_list', 'div', { id: 'drill_tab_list' });
  el('drill_mask', 'div', { id: 'drill_mask' });

  return { dom, window: dom.window, store };
}
