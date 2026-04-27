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

const DOM_TEMPLATE = `<!DOCTYPE html><html><body>
  <div id="tab_bar"></div>
  <input id="hektar" value="">
  <input id="koerner" value="">
  <input id="duenger" value="">
  <div id="err_hektar"></div>
  <div id="err_koerner"></div>
  <div id="results" style="display:none"></div>
  <div id="r_korner"></div>
  <div id="r_einheiten"></div>
  <div id="r_duenger"></div>
  <div id="r_info"></div>
  <div id="drill_section" style="display:none"></div>
  <input id="drill_einheit" value="">
  <input id="drill_hektar" value="">
  <input id="drill_duenger" value="">
  <button id="drill_add_btn"></button>
  <div id="drill_summary" style="display:none"></div>
  <div id="ds_saat_total"></div>
  <div id="ds_saat_used"></div>
  <div id="ds_saat_remaining"></div>
  <div id="ds_duenger_total"></div>
  <div id="ds_duenger_used"></div>
  <div id="ds_duenger_remaining"></div>
  <div id="ds_total_summary"></div>
  <div id="drill_entries"></div>
  <button id="fahrgassen_toggle"></button>
  <div id="fahrgassen_settings"></div>
  <input id="fahrgassen_breite" value="">
  <div id="fahrgassen_saved"></div>
  <div id="einheit_groesse_toggle"></div>
  <div id="einheit_groesse_settings"></div>
  <input id="koerner_pro_einheit" value="">
  <div id="einheit_groesse_saved"></div>
  <div class="dashboard-overlay" id="dashboard_overlay"></div>
  <div class="dashboard-sheet" id="dashboard_sheet">
    <div class="dashboard-header">
      <h2>📊 Alle Reiter</h2>
      <button class="dashboard-close" onclick="closeDashboard()">✕</button>
    </div>
    <div class="dashboard-content" id="dashboard_content"></div>
  </div>
</body></html>`;

/**
 * Creates a fresh jsdom instance with the app's JS loaded.
 * Returns { dom, window, store }.
 *
 * The DOMContentLoaded auto-init is removed so tests control init manually.
 */
export function createDom() {
  const scriptMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>/);
  if (!scriptMatch) throw new Error('No <script> block found in index.html');

  const dom = new JSDOM(DOM_TEMPLATE, {
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

  // Load the app JS (without DOMContentLoaded auto-init)
  const script = scriptMatch[1]
    .replace("document.addEventListener('DOMContentLoaded', initUI);", "");
  dom.window.eval(script);

  return { dom, window: dom.window, store };
}
