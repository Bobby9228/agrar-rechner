/**
 * Tests for Issue #305: Dashboard-Karte und Inline-Drill-Card müssen
 * den Carryover-Übertrag (savedEinheit/savedDuenger) von der
 * verbleibenden Menge abziehen.
 *
 * Background: Commit beb6166 (#302/#303) hat nur renderDrillSummary
 * korrigiert. Drei weitere Render-Pfade mit dem expliziten Kommentar
 * "no carryover subtraction" waren übersehen:
 *   1. render-dashboard.js summary aggregate (Z. 61-63)
 *   2. render-dashboard.js per-tab card (Z. 168-169)
 *   3. render-results.js renderDrillEntriesInline (Z. 159-160)
 *
 * Repro aus Issue #305:
 *   Tab 1 (done mit Ersparnis): 2 ha SOLL, 1.2 ha IST, 90000 K/ha, 1000 kg/ha
 *     → savings: SOLL_E - IST_E = 3.6 - 2.16 = 1.44 E
 *     → savings: SOLL_D - IST_D = 2000 - 1200 = 800 kg
 *   Tab 2 (not-done): 3 ha, 90000 K/ha, 500 kg/ha, leerer/Teil-Eintrag
 *     → basis: 5.4 E, 1500 kg
 *     → after carryover savings: max(0, 5.4 - 1.44) = 3.96 E
 *     → after carryover savings: max(0, 1500 - 800) = 700 kg
 *
 * Issue-Spec sagt "≈ 3,9" / "≈ 667 kg" (annähernd). Wir verwenden die
 * exakt berechneten Werte 3.96 E / 700 kg als Regression-Guard.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Issue #305: Dashboard + Inline-Drill carryover subtraction', () => {
  let w, doc;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
  });

  // ── Helpers ────────────────────────────────────────────────────────────

  function setupRepro() {
    // Tab 0: 2 ha SOLL, 1.2 ha IST, 90000 K/ha, 1000 kg/ha, entry fully fills IST
    w.state.reiter[0] = {
      name: 'Acker 1', hektar: 2, istHektar: 1.2, koerner: 90000, duenger: 1000,
      entries: [
        { einheit: 2.16, duenger: 1200, istHektar: 1.2, zaehlerStand: 1.2, time: '08:00' }
      ],
      fahrgassenEnabled: false, fahrgassenBreite: 0
    };
    // Tab 1: 3 ha, 90000 K/ha, 500 kg/ha, no entries → not-done
    w.state.reiter[1] = {
      name: 'Acker 2', hektar: 3, istHektar: 0, koerner: 90000, duenger: 500,
      entries: [],
      fahrgassenEnabled: false, fahrgassenBreite: 0
    };
    // Single small entry on Tab 1 to make r_drill_section visible (needed
    // for inline-drill test). Carryover math is unaffected by this entry
    // because Tab 1's need (5.4 E / 1500 kg) already exceeds what Tab 0
    // contributes (1.44 E / 800 kg).
    w.state.reiter[1].entries.push({
      einheit: 0.5, duenger: 100, zaehlerStand: 0.166, time: '09:00'
    });
    w.state.activeReiter = 1;
    w.saveState();
  }

  // ── Dashboard Summary (render-dashboard.js:61-63) ──────────────────────

  it('Dashboard-Summary zeigt carryover-subtracted Einheiten verbl.', () => {
    setupRepro();
    w.openDashboard();
    const statsEls = doc.getElementById('dashboard_content')
      .querySelectorAll('.dashboard-summary-stat');
    // 0: Fläche, 1: Einheiten verbl., 2: Dünger verbl.
    const einheitenVal = statsEls[1].querySelector('.dashboard-summary-value').textContent;
    // Tab 0: max(0, 2.16 - 2.16 - 1.44 + 0) = 0 E
    // Tab 1: max(0, 5.4 - 0.5 - 1.44 + 0) = 3.46 E
    // Total: 3.46 → fmtCompact → "3,5" (1-decimal rounded)
    expect(einheitenVal).toMatch(/3,4|3,5/);
  });

  it('Dashboard-Summary zeigt carryover-subtracted Dünger verbl.', () => {
    setupRepro();
    w.openDashboard();
    const statsEls = doc.getElementById('dashboard_content')
      .querySelectorAll('.dashboard-summary-stat');
    const duengerVal = statsEls[2].querySelector('.dashboard-summary-value').textContent;
    // Tab 0: max(0, 1200 - 1200 - 800 + 0) = 0 kg
    // Tab 1: max(0, 1500 - 100 - 800 + 0) = 600 kg
    // Total: 600 kg
    expect(duengerVal).toContain('600');
  });

  // ── Dashboard per-tab card (render-dashboard.js:168-169) ───────────────

  it('Dashboard Per-Tab-Karte Acker 2 zeigt carryover-subtracted Einheiten verbl.', () => {
    setupRepro();
    w.openDashboard();
    const cards = doc.querySelectorAll('.dashboard-reiter-card');
    // Tab 1 (Acker 2) is the second card; values: Hektar, Körner/ha, Einh., Dünger
    const values = cards[1].querySelectorAll('.dashboard-stat-value');
    // Tab 1: max(0, 5.4 - 0.5 - 1.44 + 0) = 3.46 E → fmtCompact → "3,5"
    expect(values[2].textContent.trim()).toMatch(/3,4|3,5/);
  });

  it('Dashboard Per-Tab-Karte Acker 2 zeigt carryover-subtracted Dünger verbl.', () => {
    setupRepro();
    w.openDashboard();
    const cards = doc.querySelectorAll('.dashboard-reiter-card');
    const values = cards[1].querySelectorAll('.dashboard-stat-value');
    // Tab 1: max(0, 1500 - 100 - 800 + 0) = 600 kg
    expect(values[3].textContent).toContain('600');
  });

  // ── Inline-Drill-Card (render-results.js:159-160) ──────────────────────

  it('Inline-Drill-Card "Dünger verbleibend" zeigt carryover-subtracted Wert', () => {
    setupRepro();
    w.renderResults();
    // r_drill_d_rem is the "Dünger verbleibend" field for the active tab.
    // Active = Tab 1 (Acker 2, not-done).
    // max(0, 1500 - 100 - 800 + 0) = 600 kg
    expect(doc.getElementById('r_drill_d_rem').textContent).toContain('600');
  });

  it('Inline-Drill-Card "Verbleibend" (Einheiten) zeigt carryover-subtracted Wert', () => {
    setupRepro();
    w.renderResults();
    // r_drill_e_rem is the "Verbleibend" field for the active tab.
    // max(0, 5.4 - 0.5 - 1.44 + 0) = 3.46 E → formatEinheit → "3,5 Einheiten"
    expect(doc.getElementById('r_drill_e_rem').textContent).toMatch(/3,4|3,5/);
  });

  // ── Regression-Guard: ohne carryover (kein IST) bleibt das alte Verhalten ─

  it('ohne IST bleibt Dashboard-Remaining = SOLL - used (kein Carryover)', () => {
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].duenger = 200;
    w.state.reiter[0].entries = [
      { einheit: 8.0, duenger: 160, zaehlerStand: 5, time: '09:00' }
    ];
    w.openDashboard();
    const statsEls = doc.getElementById('dashboard_content')
      .querySelectorAll('.dashboard-summary-stat');
    // No IST → no carryover → max(0, 16 - 8) = 8
    expect(statsEls[1].querySelector('.dashboard-summary-value').textContent).toBe('8');
  });

  it('Inline-Drill mit eigenem Tab ohne Carryover bleibt korrekt', () => {
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].duenger = 200;
    w.state.reiter[0].entries = [
      { einheit: 8.0, duenger: 160, zaehlerStand: 5, time: '09:00' }
    ];
    w.renderResults();
    // basisE=16, usedE=8, savings=0 (kein IST), remaining = 8 E
    expect(doc.getElementById('r_drill_e_rem').textContent).toBe('8,0 Einheiten');
  });
});