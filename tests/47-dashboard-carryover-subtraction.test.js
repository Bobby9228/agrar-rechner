/**
 * Regression test for Issue #305, aktualisiert für Regel-7 Pool-Modell (#378).
 *   Dashboard-Karte und Inline-Drill-Card müssen die verbleibende Menge
 *   konsistent zur neuen Berechnung anzeigen.
 *
 * Hintergrund:
 * Commit beb6166 (#302/#303) hat nur renderDrillSummary korrigiert.
 * Drei weitere Render-Pfade waren übersehen:
 *   1. render-dashboard.js summary aggregate (Z. 61-63)
 *   2. render-dashboard.js per-tab card (Z. 168-169)
 *   3. render-results.js renderDrillEntriesInline (Z. 159-160)
 *
 * Nach #378 (PR #380) gibt es `savedEinheit/savedDuenger` NICHT mehr als
 * Per-Tab-Felder. Die Subtraktion erfolgt jetzt zentral über
 * getTabRemaining() (Formel `max(0, basis - used + entzogen)`). Diese
 * Tests pinnen die neue Pool-Semantik als Regression-Guard:
 *   - Tab 0 (Ersparnis-Quelle, istHa=1.2 < solHa=2) → basis=ist, used=ist,
 *     remaining=0 (kein eigener Abzug mehr).
 *   - Tab 1 (Bedarf, istHa=0) → remaining = basis - used, ohne Cross-Tab-
 *     Carryover (kein Mehrbedarf im Setup → Pool unverändert).
 *   - Cross-Tab-Subtraktion ist NUR bei Mehrbedarf-Lücken aktiv
 *     (ist > sol) und nicht als generische Phase-1-Ersparnis.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Issue #305 (Regel-7 Pool-Modell): Dashboard + Inline-Drill carryover subtraction', () => {
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
    // for inline-drill test). Pool-Mathematik unverändert: kein Mehrbedarf
    // in beiden Tabs (Tab 0 ist<sol, Tab 1 ist=0).
    w.state.reiter[1].entries.push({
      einheit: 0.5, duenger: 100, zaehlerStand: 0.166, time: '09:00'
    });
    w.state.activeReiter = 1;
    w.saveState();
  }

  // ── Dashboard Summary (render-dashboard.js:61-63) ──────────────────────

  it('Dashboard-Summary zeigt Einheiten verbl. nach Pool-Modell', () => {
    setupRepro();
    w.openDashboard();
    const statsEls = doc.getElementById('dashboard_content')
      .querySelectorAll('.dashboard-summary-stat');
    // 0: Fläche, 1: Einheiten verbl., 2: Dünger verbl.
    const einheitenVal = statsEls[1].querySelector('.dashboard-summary-value').textContent;
    // Tab 0: istE=2.16, usedE=2.16, entzogen=0 → remaining=0 (kein Mehrbedarf,
    //         keine cross-tab Subtraktion unter Regel 7).
    // Tab 1: basisE=5.4 (istHa=0 → SOLL), usedE=0.5, entzogen=0 → 4,9.
    // Total: 4,9 → fmtCompact → "4,9".
    expect(einheitenVal).toBe('4,9');
  });

  it('Dashboard-Summary zeigt Dünger verbl. nach Pool-Modell', () => {
    setupRepro();
    w.openDashboard();
    const statsEls = doc.getElementById('dashboard_content')
      .querySelectorAll('.dashboard-summary-stat');
    const duengerVal = statsEls[2].querySelector('.dashboard-summary-value').textContent;
    // Tab 0: istD=1200, usedD=1200 → remaining=0.
    // Tab 1: basisD=1500 (SOLL), usedD=100 → 1400 kg.
    // Total: 1.400 kg.
    expect(duengerVal).toContain('1.400');
  });

  // ── Dashboard per-tab card (render-dashboard.js:168-169) ───────────────

  it('Dashboard Per-Tab-Karte Acker 2 zeigt Einheiten verbl. nach Pool-Modell', () => {
    setupRepro();
    w.openDashboard();
    const cards = doc.querySelectorAll('.dashboard-reiter-card');
    // Tab 1 (Acker 2) is the second card; values: Hektar, Körner/ha, Einh., Dünger
    const values = cards[1].querySelectorAll('.dashboard-stat-value');
    // Tab 1: basisE=5.4 (SOLL, kein IST), usedE=0.5 → max(0, 5.4 - 0.5) = 4,9.
    expect(values[2].textContent.trim()).toBe('4,9');
  });

  it('Dashboard Per-Tab-Karte Acker 2 zeigt Dünger verbl. nach Pool-Modell', () => {
    setupRepro();
    w.openDashboard();
    const cards = doc.querySelectorAll('.dashboard-reiter-card');
    const values = cards[1].querySelectorAll('.dashboard-stat-value');
    // Tab 1: basisD=1500 (SOLL), usedD=100 → max(0, 1500 - 100) = 1400 kg.
    expect(values[3].textContent).toContain('1.400');
  });

  // ── Inline-Drill-Card (render-results.js:159-160) ──────────────────────

  it('Inline-Drill-Card "Dünger verbleibend" zeigt Pool-Modell-Wert', () => {
    setupRepro();
    w.renderResults();
    // r_drill_d_rem ist das "Dünger verbleibend"-Feld für den aktiven Tab.
    // Active = Tab 1 (Acker 2, not-done).
    // max(0, 1500 - 100 - 0 + 0) = 1400 kg.
    expect(doc.getElementById('r_drill_d_rem').textContent).toContain('1.400');
  });

  it('Inline-Drill-Card "Verbleibend" (Einheiten) zeigt Pool-Modell-Wert', () => {
    setupRepro();
    w.renderResults();
    // r_drill_e_rem ist das "Verbleibend"-Feld für den aktiven Tab.
    // max(0, 5.4 - 0.5 - 0 + 0) = 4,9 → formatEinheit → "4,9 Einheiten".
    expect(doc.getElementById('r_drill_e_rem').textContent).toBe('4,9 Einheiten');
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