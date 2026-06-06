/**
 * Regression test for Issue #186:
 *   Verbleibende Dünger-/Einheitenwerte werden bei Änderung der Ist-Fläche
 *   nicht in Dashboard und Tab Ergebnis synchronisiert.
 *
 * Repro-Flow:
 *   1. Tab mit SOLL + Körner + Drill-Entries anlegen
 *   2. Ist-Fläche im Input-Feld ändern
 *   3. openDashboard() / renderResults() muss die aktualisierten IST-basierten
 *      Werte zeigen — auch ohne Klick auf "Berechnen".
 *
 * Erwartetes Verhalten nach Fix:
 *   - state.reiter[active].istHektar wird bei onchange/onblur des
 *     #ist_hektar-Input-Feldes aktualisiert
 *   - renderResultCard() zeigt die neuen IST-basierten Werte
 *   - openDashboard() / renderDashboard() zeigt die neuen IST-basierten Werte
 *     pro Tab
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Issue #186: Ist-Fläche-Änderung synchronisiert Dashboard und Tab-Ergebnis', () => {
  let w, doc;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
  });

  // --- Setup helper: tab with SOLL data and some drill entries ---
  function setupTabWithData() {
    var r = w.state.reiter[0];
    r.hektar = 10;          // 10 ha SOLL
    r.koerner = 50000;      // 50000 Körner/ha → 10 Einheiten
    r.duenger = 150;        // 150 kg/ha Dünger → 1500 kg total
    r.entries = [
      { time: 1, einheit: 4, duenger: 600, hektar: 0, istHektar: 0, koerner: 50000, duengerRate: 150 }
    ];
  }

  // --- Defekt A: istHektar landet live im State ---

  describe('Defekt A: istHektar im State', () => {
    it('onInputIstHektar updates state.reiter[active].istHektar', () => {
      setupTabWithData();
      expect(w.state.reiter[0].istHektar).toBe(0); // initial
      var r0 = w.state.reiter[0];
      // Simulate user typing 8,5 in the ist_hektar field
      var el = doc.getElementById('ist_hektar');
      el.value = '8,5';
      w.onInputIstHektar(el);
      expect(r0.istHektar).toBe(8.5);
    });

    it('onInputHektar updates state.reiter[active].hektar', () => {
      setupTabWithData();
      var r0 = w.state.reiter[0];
      var el = doc.getElementById('hektar');
      el.value = '12,5';
      w.onInputHektar(el);
      expect(r0.hektar).toBe(12.5);
    });

    it('onInputKoerner updates state.reiter[active].koerner', () => {
      setupTabWithData();
      var r0 = w.state.reiter[0];
      var el = doc.getElementById('koerner');
      el.value = '55000';
      w.onInputKoerner(el);
      expect(r0.koerner).toBe(55000);
    });

    it('onInputDuenger updates state.reiter[active].duenger', () => {
      setupTabWithData();
      var r0 = w.state.reiter[0];
      var el = doc.getElementById('duenger');
      el.value = '200';
      w.onInputDuenger(el);
      expect(r0.duenger).toBe(200);
    });

    it('onInputIstHektar triggers appEmit for ENTRY_CHANGED', () => {
      // Indirect: the state should be updated, and dashboard re-rendered.
      // We verify by checking that dashboard content is fresh.
      setupTabWithData();
      w.openDashboard();
      // User changes ist_hektar via the input handler
      var el = doc.getElementById('ist_hektar');
      el.value = '8';
      w.onInputIstHektar(el);
      // Re-open dashboard to simulate the user reopening it after the change
      w.openDashboard();
      // Per-tab card: "Einheiten verbl." should reflect IST-based calc.
      // IST=8 ha, 50000 Körner/ha, 50000 Körner/Einheit → 8 Einheiten basis
      // Used = 4 → remaining = 4
      var cards = doc.querySelectorAll('.dashboard-reiter-card');
      expect(cards.length).toBe(1);
      var values = cards[0].querySelectorAll('.dashboard-stat-value');
      // 0: Hektar, 1: Körner/ha, 2: Einheiten verbl., 3: Dünger verbl.
      expect(values[2].textContent.trim()).toBe('4');
    });
  });

  // --- Defekt B: renderDashboard() wird synchron aktualisiert ---

  describe('Defekt B: Dashboard zeigt IST-basierte Werte', () => {
    it('Dashboard exists and is openable', () => {
      expect(typeof w.openDashboard).toBe('function');
      w.openDashboard();
      expect(doc.getElementById('dashboard_sheet').classList.contains('open')).toBe(true);
    });

    it('Per-Tab-Karte zeigt IST-Heftar als "SOLL / IST ha" wenn unterschiedlich', () => {
      setupTabWithData();
      w.state.reiter[0].istHektar = 8.5;
      w.openDashboard();
      var cards = doc.querySelectorAll('.dashboard-reiter-card');
      var hektarStat = cards[0].querySelectorAll('.dashboard-stat-value')[0];
      expect(hektarStat.textContent).toContain('10'); // SOLL
      expect(hektarStat.textContent).toContain('8,5'); // IST
    });

    it('Per-Tab-Karte zeigt IST-basierte Einheiten-verbleibend', () => {
      // SOLL=10 ha → 10 Einheiten; IST=8 ha → 8 Einheiten IST-Basis
      // Used=4 → IST-remaining = 8 - 4 = 4
      setupTabWithData();
      w.state.reiter[0].istHektar = 8;
      w.openDashboard();
      var cards = doc.querySelectorAll('.dashboard-reiter-card');
      var values = cards[0].querySelectorAll('.dashboard-stat-value');
      expect(values[2].textContent.trim()).toBe('4');
    });

    it('Per-Tab-Karte zeigt IST-basierten Dünger-verbleibend', () => {
      // SOLL=10 ha, 150 kg/ha → 1500 kg. IST=8 ha → 1200 kg
      // Used=600 → IST-remaining = 1200 - 600 = 600
      setupTabWithData();
      w.state.reiter[0].istHektar = 8;
      w.openDashboard();
      var cards = doc.querySelectorAll('.dashboard-reiter-card');
      var values = cards[0].querySelectorAll('.dashboard-stat-value');
      expect(values[3].textContent).toContain('600');
    });

    it('SOLL und IST Summary bleibt über Tabs aggregiert korrekt', () => {
      // Tab 0: 10 ha SOLL, 5 ha IST, 50000 Körner, 100 kg/ha
      w.state.reiter[0].hektar = 10;
      w.state.reiter[0].istHektar = 5;
      w.state.reiter[0].koerner = 50000;
      w.state.reiter[0].duenger = 100;
      w.state.reiter[0].entries = [];
      w.openDashboard();
      // Summary: Fläche (IST), Einheiten verbl. (IST-basiert), Dünger verbl.
      // Scope to dashboard_content to avoid spurious matches in dead inline-script
      // (which JSDOM parses weirdly because it lives outside a <script> tag).
      var dashContent = doc.getElementById('dashboard_content');
      var stats = dashContent.querySelectorAll('.dashboard-summary-stat .dashboard-summary-value');
      // 0: Fläche → IST=5 ha
      expect(stats[0].textContent).toContain('5');
    });
  });

  // --- Defekt C: renderResults() triggert ENTRY_CHANGED → renderDashboard ---

  describe('Defekt C: renderResults + Dashboard Sync', () => {
    it('renderResultCard zeigt IST/SOLL/Diff wenn istHektar gesetzt', () => {
      setupTabWithData();
      w.state.reiter[0].istHektar = 9.5;
      w.renderResults();
      var sollIstSection = doc.getElementById('r_soll_ist_section');
      expect(sollIstSection.style.display).not.toBe('none');
      expect(doc.getElementById('r_ist_ha').textContent).toContain('9,5');
    });

    it('renderResultCard berechnet IST-Einheiten wenn istHektar gesetzt', () => {
      // SOLL=10 ha, koerner=50000 → 10 Einheiten. IST=8 → 8 Einheiten
      setupTabWithData();
      w.state.reiter[0].istHektar = 8;
      w.renderResults();
      // r_einheiten shows the IST-based einheiten (8)
      var r_einheiten = doc.getElementById('r_einheiten');
      expect(r_einheiten.textContent).toContain('8');
    });
  });
});
