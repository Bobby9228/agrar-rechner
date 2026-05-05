/**
 * Tests for Dashboard with Fahrgassen feature.
 *
 * renderDashboard() uses getTabTotalEinheiten(r) which applies the fahrgassen factor:
 *   faktor = (fahrgassenBreite - 1) / fahrgassenBreite
 * So dashboard correctly shows fahrgassen-adjusted totals.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

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
    // No entries — 100% remaining
    w.state.reiter[0].entries = [];

    w.openDashboard();
    const content = doc.getElementById('dashboard_content');
    const statsEls = content.querySelectorAll('.dashboard-summary-stat');
    const einheitenVal = statsEls[1]?.querySelector('.dashboard-summary-value')?.textContent || '';

    // Correct: 12,0 (fahrgassen factor applied)
    expect(einheitenVal).toBe('12,0');
  });

  it('per-tab card shows fahrgassen-adjusted units', () => {
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 4;
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].entries = [];

    w.openDashboard();
    const content = doc.getElementById('dashboard_content');
    const cards = content.querySelectorAll('.dashboard-reiter-card');
    const tab1Stats = cards[0].querySelectorAll('.dashboard-stat');
    const einheitenCardVal = tab1Stats[2]?.querySelector('.dashboard-stat-value')?.textContent || '';

    // Correct: 12,0 (fahrgassen factor applied)
    expect(einheitenCardVal).toBe('12,0');
  });

  it('dashboard summary flaeche is always correct (ha unaffected by fahrgassen)', () => {
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 4;
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].entries = [];

    w.openDashboard();
    const content = doc.getElementById('dashboard_content');
    const statsEls = content.querySelectorAll('.dashboard-summary-stat');
    const flaecheVal = statsEls[0]?.querySelector('.dashboard-summary-value')?.textContent || '';
    expect(flaecheVal).toBe('10,0 ha');
  });

  it('dashboard shows 0 remaining when tab is fully used (bug not visible)', () => {
    // When all SOLL units are used, bug doesn't matter (0 remaining)
    // SOLL = 10 * 80000 / 50000 = 16 units
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 4;
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    // Fill exactly 16 SOLL units (but the bug formula also gives 16)
    w.state.reiter[0].entries = [
      { einheit: 16.0, duenger: 0, zaehlerStand: 10, time: '10:00' }
    ];

    w.openDashboard();
    const content = doc.getElementById('dashboard_content');
    const statsEls = content.querySelectorAll('.dashboard-summary-stat');
    const einheitenVal = statsEls[1]?.querySelector('.dashboard-summary-value')?.textContent || '';
    expect(einheitenVal).toBe('0,0');
  });

  it('BUG: dashboard duenger is always correct (duenger unaffected by fahrgassen)', () => {
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 4;
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].duenger = 200;
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
    w.state.activeReiter = 0;
    w.syncInputsFromState();
    w.state.reiter[0].hektar = 5;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].entries = [];
    // Tab 2: 10 ha, 90000 k — faktor=0.75 → 10*90000/50000*0.75 = 13.5
    w.addReiter();
    w.state.reiter[1].hektar = 10;
    w.state.reiter[1].koerner = 90000;
    w.state.reiter[1].entries = [];

    w.openDashboard();
    const content = doc.getElementById('dashboard_content');
    const cards = content.querySelectorAll('.dashboard-reiter-card');

    // Tab 1 card — 3rd stat = Einheiten verbl.
    const tab1Stats = cards[0].querySelectorAll('.dashboard-stat');
    const tab1Units = tab1Stats[2]?.querySelector('.dashboard-stat-value')?.textContent || '';
    expect(tab1Units).toBe('6,0'); // fahrgassen-corrected

    // Tab 2 card
    const tab2Stats = cards[1].querySelectorAll('.dashboard-stat');
    const tab2Units = tab2Stats[2]?.querySelector('.dashboard-stat-value')?.textContent || '';
    expect(tab2Units).toBe('13,5'); // fahrgassen-corrected
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
