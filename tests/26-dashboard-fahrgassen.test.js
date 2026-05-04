/**
 * Tests for Dashboard with Fahrgassen feature.
 *
 * CRITICAL BUG (Z.2775): renderDashboard() calculates totalEinheiten as
 *   r.hektar * r.koerner / state.koernerProEinheit
 * but berechne() uses getTabTotalEinheiten(r) which applies the fahrgassen factor:
 *   faktor = (fahrgassenBreite - 1) / fahrgassenBreite
 * So dashboard shows WRONG totals when fahrgassenEnabled=true.
 *
 * These tests VERIFY the current buggy behavior, then document the expected correct behavior.
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

  // ── Bug verification: dashboard ignores fahrgassen factor ─────────────────

  it('BUG: dashboard shows raw hectare*koerner even when fahrgassenEnabled=true', () => {
    // Setup: 1 tab, 10 ha, 80000 körner/ha, fahrgassen enabled (breite=4)
    // With fahrgassen, faktor = (4-1)/4 = 0.75
    // Correct units = 10 * 80000 / 50000 * 0.75 = 12.0 units
    // Bug shows:   10 * 80000 / 50000        = 16.0 units
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

    // Bug: einheiten remaining shows ~16.0 (wrong, ignores fahrgassen factor)
    // Correct: should show ~12.0
    const rawUnits = (10 * 80000 / 50000).toFixed(1).replace('.', ',');
    expect(einheitenVal).toBe(rawUnits); // BUG: shows 16,0 instead of 12,0
  });

  it('BUG: per-tab card also ignores fahrgassen factor', () => {
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

    // Bug: should be 12,0 but shows 16,0
    const rawUnits = (10 * 80000 / 50000).toFixed(1).replace('.', ',');
    expect(einheitenCardVal).toBe(rawUnits);
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

  it('BUG: multi-tab dashboard: each tab shows wrong units when fahrgassen enabled', () => {
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 4;
    // Tab 1: 5 ha, 80000 k — raw=8.0, correct=6.0
    w.state.reiter[0].hektar = 5;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].entries = [];
    // Tab 2: 10 ha, 90000 k — raw=18.0, correct=13.5
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
    expect(tab1Units).toBe('8,0'); // Bug: raw instead of 6,0

    // Tab 2 card
    const tab2Stats = cards[1].querySelectorAll('.dashboard-stat');
    const tab2Units = tab2Stats[2]?.querySelector('.dashboard-stat-value')?.textContent || '';
    expect(tab2Units).toBe('18,0'); // Bug: raw instead of 13,5
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
