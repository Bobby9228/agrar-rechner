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

  return { dom, window: dom.window, store };
}
