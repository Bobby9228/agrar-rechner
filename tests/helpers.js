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
  <div id="tab_bar">
    <div id="tab_bar_left"></div>
    <div class="tab-separator"></div>
    <button class="protokoll-tab" id="protokoll_tab_btn" onclick="switchToProtokoll()">🔧 Protokoll</button>
  </div>
  <input id="hektar" value="">
  <input id="ist_hektar" value="">
  <input id="koerner" value="">
  <input id="duenger" value="">
  <div id="err_hektar"></div>
  <div id="err_koerner"></div>
  <div id="results" style="display:none">
    <div id="r_korner"></div>
    <div id="r_einheiten"></div>
    <div id="r_duenger"></div>
    <div id="r_drill_section" style="display:none">
      <div class="drill-separator"></div>
      <div class="result-row"><span class="label">🔧 Eingefüllt</span><span class="value small" id="r_drill_e_used">—</span></div>
      <div class="result-row" id="r_drill_e_rem_row"><span class="label">Verbleibend</span><span class="value small" id="r_drill_e_rem">—</span></div>
      <div class="result-row" id="r_drill_d_used_row" style="display:none"><span class="label">Dünger eingefüllt</span><span class="value small" id="r_drill_d_used">—</span></div>
      <div class="result-row" id="r_drill_d_rem_row" style="display:none"><span class="label">Dünger verbleibend</span><span class="value small" id="r_drill_d_rem">—</span></div>
      <div id="r_drill_entries"></div>
    </div>
    <div id="r_soll_ist_section" style="display:none">
      <div class="result-row"><span class="label">SOLL-Fläche</span><span class="value small" id="r_soll_ha">—</span></div>
      <div class="result-row"><span class="label">IST-Fläche</span><span class="value small" id="r_ist_ha">—</span></div>
      <div class="result-row"><span class="label">Abweichung</span><span class="value small" id="r_diff_ha">—</span></div>
    </div>
    <div id="r_info"></div>
  </div>
  <div id="drill_section" style="display:none">
    <div id="drill_mask" style="display:none"></div>
    <div id="drill_tab_list"></div>
  </div>
  <div id="zaehler_section" style="display:none">
    <div class="zaehler-result" id="zaehler_result" style="display:none">
      <div class="zaehler-delta">
        <span class="delta-label">IST-Fläche seit letztem Eintrag:</span>
        <span class="delta-value" id="z_ist">—</span>
      </div>
      <div class="zaehler-delta">
        <span class="delta-label">Gesamt bearbeitete Fläche:</span>
        <span class="delta-value" id="z_total">—</span>
      </div>
      <div class="zaehler-soll-ist" id="zaehler_soll_ist" style="display:none">
        <div class="drill-separator"></div>
        <div class="result-row">
          <span class="label">SOLL-Fläche:</span>
          <span class="value small" id="z_soll">—</span>
        </div>
        <div class="result-row">
          <span class="label">IST-Fläche (kumuliert):</span>
          <span class="value small" id="z_ist_sum">—</span>
        </div>
        <div class="result-row" id="z_diff_row">
          <span class="label">Abweichung:</span>
          <span class="value small" id="z_diff">—</span>
        </div>
      </div>
    </div>
  </div>
  <input id="drill_einheit" value="">
  <input id="drill_hektar" value="">
  <input id="drill_duenger" value="">
  <input id="zaehler_stand" value="">
  <button id="drill_add_btn"></button>
  <div id="drill_summary" style="display:none"></div>
  <div id="ds_saat_total"></div>
  <div id="ds_saat_used"></div>
  <div id="ds_saat_remaining"></div>
  <div id="ds_duenger_total"></div>
  <div id="ds_duenger_used"></div>
  <div id="ds_duenger_remaining"></div>
  <div id="ds_total_summary"></div>
  <div id="ds_savings" style="display:none"></div>
  <div id="drill_machine_log"></div>
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
  <div class="sticky-footer" id="sticky_footer">
    <div class="container">
      <div id="mini_result" class="mini-result mini-result-empty"></div>
      <div class="footer-btn-row">
        <button class="btn" id="berechnen_btn">Berechnen</button>
        <button class="btn btn-secondary" id="reset_btn">Zurücksetzen</button>
        <button class="btn btn-danger" id="reset_all_btn">Reset All</button>
      </div>
    </div>
  </div>
  <div class="card card-input" id="card_input"></div>
  <div class="card" id="card_duenger"></div>
  <div class="card" id="card_result" style="display:none"></div>
  <button class="theme-toggle" id="theme_toggle">🌙</button>
  <meta name="theme-color" content="#2d5016">
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
