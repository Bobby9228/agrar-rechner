/**
 * Fahrgassen (Spritzgassen / Fahrgassenreduktion).
 *
 * fahrgassenToggle() aktiviert/deaktiviert die Fahrgassen-Reduktion.
 * fahrgassenUpdate() liest die Breite aus dem Input und schreibt sie
 * nach state. fahrgassenBreite; gültige Werte sind ≥ 2 m, sonst wird
 * das Input auf den letzten gültigen Wert zurückgesetzt.
 *
 * computeFahrgassenFaktor() ist die Single Source of Truth für die
 * Reduktionsformel (breite - 1) / breite — alle 4 Aufrufer (Dashboard,
 * Drill-Verteilung, Berechnungen) müssen sie konsistent nutzen.
 *
 * Zugehörige frühere Dateien: tests/04-fahrgassen.test.js,
 * tests/26-dashboard-fahrgassen.test.js,
 * tests/41-fahrgassen-faktor.test.js (Issue #419 Welle 2).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Fahrgassen', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  describe('fahrgassenToggle()', () => {
    it('enables Fahrgassen on first click', () => {
      w.fahrgassenToggle();
      expect(w.state.fahrgassenEnabled).toBe(true);
      expect(doc.getElementById('fahrgassen_toggle').classList.contains('active')).toBe(true);
      expect(doc.getElementById('fahrgassen_settings').classList.contains('open')).toBe(true);
    });

    it('disables Fahrgassen on second click', () => {
      w.fahrgassenToggle(); // enable
      w.fahrgassenToggle(); // disable
      expect(w.state.fahrgassenEnabled).toBe(false);
      expect(doc.getElementById('fahrgassen_toggle').classList.contains('active')).toBe(false);
      expect(doc.getElementById('fahrgassen_settings').classList.contains('open')).toBe(false);
    });

    it('clears saved text when disabling', () => {
      w.fahrgassenToggle(); // enable
      doc.getElementById('fahrgassen_saved').textContent = '24 m -> ~4.2% weniger Körner';
      w.fahrgassenToggle(); // disable
      expect(doc.getElementById('fahrgassen_saved').textContent).toBe('');
    });

    it('toggles state multiple times correctly', () => {
      expect(w.state.fahrgassenEnabled).toBe(false);
      w.fahrgassenToggle(); expect(w.state.fahrgassenEnabled).toBe(true);
      w.fahrgassenToggle(); expect(w.state.fahrgassenEnabled).toBe(false);
      w.fahrgassenToggle(); expect(w.state.fahrgassenEnabled).toBe(true);
    });
  });

  describe('fahrgassenUpdate()', () => {
    it('updates state with valid breite', () => {
      doc.getElementById('fahrgassen_breite').value = '24';
      w.fahrgassenUpdate();
      expect(w.state.fahrgassenBreite).toBe(24);
    });

    it('shows percentage info for valid breite', () => {
      doc.getElementById('fahrgassen_breite').value = '24';
      w.fahrgassenUpdate();
      const text = doc.getElementById('fahrgassen_saved').textContent;
      expect(text).toContain('24 m');
      // (24-1)/24 * 100 = 95.8%
      expect(text).toContain('~95.8%');
    });

    it('calculates percentage correctly for breite=10', () => {
      doc.getElementById('fahrgassen_breite').value = '10';
      w.fahrgassenUpdate();
      // (10-1)/10 * 100 = 90.0%
      expect(doc.getElementById('fahrgassen_saved').textContent).toContain('~90.0%');
    });

    it('clears info for breite=0', () => {
      doc.getElementById('fahrgassen_breite').value = '24';
      w.fahrgassenUpdate();
      doc.getElementById('fahrgassen_breite').value = '0';
      w.fahrgassenUpdate();
      expect(doc.getElementById('fahrgassen_saved').textContent).toBe('');
      expect(w.state.fahrgassenBreite).toBe(0);
    });

    it('clears info for empty breite', () => {
      doc.getElementById('fahrgassen_breite').value = '';
      w.fahrgassenUpdate();
      expect(w.state.fahrgassenBreite).toBe(0);
      expect(doc.getElementById('fahrgassen_saved').textContent).toBe('');
    });

    it('handles DE-formatted breite (comma)', () => {
      doc.getElementById('fahrgassen_breite').value = '24,5';
      w.fahrgassenUpdate();
      expect(w.state.fahrgassenBreite).toBeCloseTo(24.5);
    });

    it('does not store breite < 2 — state unchanged, field restored', () => {
      doc.getElementById('fahrgassen_breite').value = '24';
      w.fahrgassenUpdate();
      expect(w.state.fahrgassenBreite).toBe(24);

      doc.getElementById('fahrgassen_breite').value = '0,5';
      w.fahrgassenUpdate();
      expect(w.state.fahrgassenBreite).toBe(24); // unchanged
      expect(doc.getElementById('fahrgassen_saved').textContent).toBe(
        'Fahrgassenbreite muss mindestens 2m betragen'
      );
      // field restored to previous valid value
      expect(doc.getElementById('fahrgassen_breite').value).toBe('24');
    });

    it('does not store breite=1 — state unchanged, field restored', () => {
      doc.getElementById('fahrgassen_breite').value = '10';
      w.fahrgassenUpdate();
      expect(w.state.fahrgassenBreite).toBe(10);

      doc.getElementById('fahrgassen_breite').value = '1';
      w.fahrgassenUpdate();
      expect(w.state.fahrgassenBreite).toBe(10); // unchanged
      expect(doc.getElementById('fahrgassen_saved').textContent).toBe(
        'Fahrgassenbreite muss mindestens 2m betragen'
      );
      expect(doc.getElementById('fahrgassen_breite').value).toBe('10');
    });

    it('restores empty field when previous valid state is 0', () => {
      doc.getElementById('fahrgassen_breite').value = '';
      w.fahrgassenUpdate();
      expect(w.state.fahrgassenBreite).toBe(0);

      doc.getElementById('fahrgassen_breite').value = '0,5';
      w.fahrgassenUpdate();
      expect(w.state.fahrgassenBreite).toBe(0); // unchanged
      expect(doc.getElementById('fahrgassen_saved').textContent).toBe(
        'Fahrgassenbreite muss mindestens 2m betragen'
      );
      expect(doc.getElementById('fahrgassen_breite').value).toBe('');
    });
  });

  describe('Fahrgassen calculation integration', () => {
    it('reduces KornerGesamt when enabled with breite', () => {
      w.state.reiter[0].hektar = 10;
      w.state.reiter[0].koerner = 90000;

      // Without Fahrgassen
      expect(w.getKornerGesamt()).toBe(900000);

      // With Fahrgassen breite=24
      w.state.fahrgassenEnabled = true;
      w.state.fahrgassenBreite = 24;
      expect(w.getKornerGesamt()).toBe(862500);
    });

    it('does not affect Dünger calculation', () => {
      w.state.reiter[0].hektar = 10;
      w.state.reiter[0].duenger = 150;
      w.state.fahrgassenEnabled = true;
      w.state.fahrgassenBreite = 24;
      // Dünger is always ha * kg/ha regardless of Fahrgassen
      expect(w.getTotalDuenger()).toBe(1500);
    });

    it('full flow: toggle -> set breite -> berechne', () => {
      doc.getElementById('hektar').value = '10';
      doc.getElementById('koerner').value = '90000';
      doc.getElementById('duenger').value = '150';

      w.fahrgassenToggle();
      doc.getElementById('fahrgassen_breite').value = '24';
      w.fahrgassenUpdate();
      w.getActiveReiter().hektar = 10;
      w.getActiveReiter().koerner = 90000;
      w.getActiveReiter().duenger = 150;
      w.AppGlobals.renderResults();
      doc.getElementById('results').style.display = 'block';

      expect(doc.getElementById('results').style.display).toBe('block');
      // Körner = 862.500, Einheiten = 17.25
      expect(doc.getElementById('r_korner').textContent).toBe('862.500');
    });
  });
});

describe('computeFahrgassenFaktor', () => {
  let w;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
  });

  // --- Pure function edge cases ---

  it('returns 1 for breite=0 (disabled)', () => {
    expect(w.computeFahrgassenFaktor(0)).toBe(1);
  });

  it('returns 1 for breite=undefined', () => {
    expect(w.computeFahrgassenFaktor(undefined)).toBe(1);
  });

  it('returns 1 for breite=null', () => {
    expect(w.computeFahrgassenFaktor(null)).toBe(1);
  });

  it('returns 1 for breite=1 (below minimum)', () => {
    expect(w.computeFahrgassenFaktor(1)).toBe(1);
  });

  it('returns 1 for negative breite', () => {
    expect(w.computeFahrgassenFaktor(-5)).toBe(1);
  });

  it('returns 0.5 for breite=2 (minimum valid)', () => {
    expect(w.computeFahrgassenFaktor(2)).toBe(0.5);
  });

  it('returns correct factor for breite=4', () => {
    // (4-1)/4 = 0.75
    expect(w.computeFahrgassenFaktor(4)).toBe(0.75);
  });

  it('returns correct factor for breite=10', () => {
    // (10-1)/10 = 0.9
    expect(w.computeFahrgassenFaktor(10)).toBe(0.9);
  });

  it('returns correct factor for breite=24', () => {
    // (24-1)/24 ≈ 0.95833
    expect(w.computeFahrgassenFaktor(24)).toBeCloseTo(23 / 24, 10);
  });

  it('returns correct factor for breite=100 (large)', () => {
    // (100-1)/100 = 0.99
    expect(w.computeFahrgassenFaktor(100)).toBe(0.99);
  });

  // --- Consistency: all 4 call sites use the same formula ---

  it('getTotalEinheiten uses same factor as computeFahrgassenFaktor', () => {
    var r = { hektar: 10, koerner: 80000, fahrgassenEnabled: true, fahrgassenBreite: 4 };
    var faktor = w.computeFahrgassenFaktor(4);
    var einheiten = (10 * 80000) / 50000;
    expect(w.getTotalEinheiten(r, 50000)).toBeCloseTo(einheiten * faktor, 5);
  });

  it('getTabKornerGesamt uses same factor as computeFahrgassenFaktor', () => {
    var r = { hektar: 10, koerner: 90000, fahrgassenEnabled: true, fahrgassenBreite: 24 };
    var faktor = w.computeFahrgassenFaktor(24);
    expect(w.getTabKornerGesamt(r)).toBeCloseTo(10 * 90000 * faktor, 5);
  });

  it('getTabRates uses same factor as computeFahrgassenFaktor', () => {
    w.state.koernerProEinheit = 50000;
    w.state.reiter[0].koerner = 90000;
    w.state.reiter[0].fahrgassenEnabled = true;
    w.state.reiter[0].fahrgassenBreite = 24;
    var faktor = w.computeFahrgassenFaktor(24);
    var rates = w.getTabRates(0);
    expect(rates.unitsPerHa).toBeCloseTo(90000 * faktor / 50000, 5);
  });

  // --- Per-tab independence (Issue #222) ---

  it('getTabRates uses per-tab fahrgassenBreite, not global', () => {
    w.state.koernerProEinheit = 50000;
    w.state.reiter[0].koerner = 80000;
    // Global says breite=24, per-tab says breite=4 → should use per-tab
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 24;
    w.state.reiter[0].fahrgassenEnabled = true;
    w.state.reiter[0].fahrgassenBreite = 4;
    var faktor = w.computeFahrgassenFaktor(4); // 0.75
    var rates = w.getTabRates(0);
    expect(rates.unitsPerHa).toBeCloseTo(80000 * faktor / 50000, 5);
  });

  it('getTabRates ignores global fahrgassen when per-tab disabled', () => {
    w.state.koernerProEinheit = 50000;
    w.state.reiter[0].koerner = 80000;
    // Global enabled, per-tab disabled → no correction
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 24;
    w.state.reiter[0].fahrgassenEnabled = false;
    w.state.reiter[0].fahrgassenBreite = 0;
    var rates = w.getTabRates(0);
    expect(rates.unitsPerHa).toBe(80000 / 50000);
  });

  // --- No Fahrgassen = no correction ---

  it('getTotalEinheiten returns uncorrected when fahrgassenEnabled=false', () => {
    var r = { hektar: 10, koerner: 80000, fahrgassenEnabled: false, fahrgassenBreite: 24 };
    expect(w.getTotalEinheiten(r, 50000)).toBe(16);
  });

  it('getTabKornerGesamt returns uncorrected when fahrgassenEnabled=false', () => {
    var r = { hektar: 10, koerner: 90000, fahrgassenEnabled: false, fahrgassenBreite: 24 };
    expect(w.getTabKornerGesamt(r)).toBe(900000);
  });

  // --- End-to-end: getKornerGesamt() matches expected values from Issue ---

  it('getKornerGesamt with breite=24 matches 862,500 (Issue #204 reference)', () => {
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 24;
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 90000;
    w.state.reiter[0].fahrgassenEnabled = true;
    w.state.reiter[0].fahrgassenBreite = 24;
    // (24-1)/24 * 900000 = 862500
    expect(w.getKornerGesamt()).toBe(862500);
  });

  it('getTabTotalEinheiten with breite=4 matches 12.0 (dashboard reference)', () => {
    var r = { hektar: 10, koerner: 80000, fahrgassenEnabled: true, fahrgassenBreite: 4 };
    // 10*80000/50000 * 0.75 = 12.0
    expect(w.getTabTotalEinheiten(r)).toBe(12);
  });
});

describe('Dashboard + Fahrgassen', () => {
  let w, doc, store;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
    store = result.store;
  });

  // ── Dashboard applies fahrgassen factor via getTabTotalEinheiten() ────────

  it('dashboard shows fahrgassen-adjusted units in summary', () => {
    // Setup: 1 tab, 10 ha, 80000 körner/ha, fahrgassen enabled (breite=4)
    // faktor = (4-1)/4 = 0.75
    // Correct units = 10 * 80000 / 50000 * 0.75 = 12.0 units
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 4;
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].fahrgassenEnabled = true;
    w.state.reiter[0].fahrgassenBreite = 4;
    // No entries — 100% remaining
    w.state.reiter[0].entries = [];

    w.openDashboard();
    const content = doc.getElementById('dashboard_content');
    const statsEls = content.querySelectorAll('.dashboard-summary-stat');
    const einheitenVal = statsEls[1]?.querySelector('.dashboard-summary-value')?.textContent || '';

    // Correct: 12 (fahrgassen factor applied, fmt() omits trailing ,0 for whole numbers)
    expect(einheitenVal).toBe('12,000');
  });

  it('per-tab card shows fahrgassen-adjusted units', () => {
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 4;
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].fahrgassenEnabled = true;
    w.state.reiter[0].fahrgassenBreite = 4;
    w.state.reiter[0].entries = [];

    w.openDashboard();
    const content = doc.getElementById('dashboard_content');
    const cards = content.querySelectorAll('.dashboard-reiter-card');
    const tab1Stats = cards[0].querySelectorAll('.dashboard-stat');
    const einheitenCardVal = tab1Stats[2]?.querySelector('.dashboard-stat-value')?.textContent || '';

    // Correct: 12 (fahrgassen factor applied)
    expect(einheitenCardVal).toBe('12,000');
  });

  it('dashboard summary flaeche is always correct (ha unaffected by fahrgassen)', () => {
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 4;
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].fahrgassenEnabled = true;
    w.state.reiter[0].fahrgassenBreite = 4;
    w.state.reiter[0].entries = [];

    w.openDashboard();
    const content = doc.getElementById('dashboard_content');
    const statsEls = content.querySelectorAll('.dashboard-summary-stat');
    const flaecheVal = statsEls[0]?.querySelector('.dashboard-summary-value')?.textContent || '';
    expect(flaecheVal).toBe('10 ha');
  });

  it('dashboard shows 0 remaining when tab is fully used', () => {
    // SOLL = 10 * 80000 / 50000 * 0.75 = 12.0 units
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 4;
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].fahrgassenEnabled = true;
    w.state.reiter[0].fahrgassenBreite = 4;
    // Fill exactly 12.0 fahrgassen-adjusted units
    w.state.reiter[0].entries = [
      { einheit: 12.0, duenger: 0, zaehlerStand: 10, time: '10:00' }
    ];

    w.openDashboard();
    const content = doc.getElementById('dashboard_content');
    const statsEls = content.querySelectorAll('.dashboard-summary-stat');
    const einheitenVal = statsEls[1]?.querySelector('.dashboard-summary-value')?.textContent || '';
    expect(einheitenVal).toBe('0,000');
  });

  it('BUG: dashboard duenger is always correct (duenger unaffected by fahrgassen)', () => {
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 4;
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].duenger = 200;
    w.state.reiter[0].fahrgassenEnabled = true;
    w.state.reiter[0].fahrgassenBreite = 4;
    w.state.reiter[0].entries = [];

    w.openDashboard();
    const content = doc.getElementById('dashboard_content');
    const statsEls = content.querySelectorAll('.dashboard-summary-stat');
    const duengerVal = statsEls[2]?.querySelector('.dashboard-summary-value')?.textContent || '';
    expect(duengerVal).toBe('2.000 kg'); // 10 ha * 200 kg = 2000 kg
  });

  it('multi-tab dashboard: each tab shows fahrgassen-adjusted units', () => {
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 4;
    // Tab 1: 5 ha, 80000 k — faktor=0.75 → 5*80000/50000*0.75 = 6.0
    w.state.reiter[0].hektar = 5;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].fahrgassenEnabled = true;
    w.state.reiter[0].fahrgassenBreite = 4;
    w.state.reiter[0].entries = [];
    // Tab 2: 10 ha, 90000 k — faktor=0.75 → 10*90000/50000*0.75 = 13.5
    // (push directly to avoid addReiter's syncStateFromInputs overwriting tab 0)
    // Push directly to avoid addReiter's syncStateFromInputs overwriting tab 0
    w.state.reiter.push({
      name: 'Tab 2', hektar: 10, koerner: 90000, duenger: 0, entries: [],
      fahrgassenEnabled: true, fahrgassenBreite: 4
    });

    w.openDashboard();
    const content = doc.getElementById('dashboard_content');
    const cards = content.querySelectorAll('.dashboard-reiter-card');

    // Tab 1 card — 3rd stat = Einheiten verbl.
    const tab1Stats = cards[0].querySelectorAll('.dashboard-stat');
    const tab1Units = tab1Stats[2]?.querySelector('.dashboard-stat-value')?.textContent || '';
    expect(tab1Units).toBe('6,000'); // fahrgassen-corrected

    // Tab 2 card
    const tab2Stats = cards[1].querySelectorAll('.dashboard-stat');
    const tab2Units = tab2Stats[2]?.querySelector('.dashboard-stat-value')?.textContent || '';
    expect(tab2Units).toBe('13,500'); // fahrgassen-corrected
  });

  it('openDashboard adds open class to sheet and overlay', () => {
    w.openDashboard();
    expect(doc.getElementById('dashboard_sheet').classList.contains('open')).toBe(true);
    expect(doc.getElementById('dashboard_overlay').classList.contains('open')).toBe(true);
  });

  it('closeDashboard removes open class', () => {
    w.openDashboard();
    w.closeDashboard();
    expect(doc.getElementById('dashboard_sheet').classList.contains('open')).toBe(false);
    expect(doc.getElementById('dashboard_overlay').classList.contains('open')).toBe(false);
  });
});
