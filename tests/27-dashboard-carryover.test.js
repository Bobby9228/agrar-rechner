/**
 * Tests for Dashboard carryover / savings display.
 *
 * CRITICAL BUG: renderDashboard() never calls getCarryover() or computeAllCarryovers().
 * Savings from IST<SOLL (tabs that used less than planned) are never shown in dashboard.
 * Dashboard always shows SOLL-based remaining, ignoring the actual carryover/savings effect.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Dashboard carryover / savings', () => {
  let w, doc, store;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
    store = result.store;
  });

  // ── Helper ────────────────────────────────────────────────────────────────

  function getDashboardSummary() {
    w.openDashboard();
    const content = doc.getElementById('dashboard_content');
    const statsEls = content.querySelectorAll('.dashboard-summary-stat');
    const flaecheVal = statsEls[0]?.querySelector('.dashboard-summary-value')?.textContent || '';
    const einheitenVal = statsEls[1]?.querySelector('.dashboard-summary-value')?.textContent || '';
    const duengerVal = statsEls[2]?.querySelector('.dashboard-summary-value')?.textContent || '';
    return { flaecheVal, einheitenVal, duengerVal };
  }

  // ── BUG: Dashboard ignores carryover from IST<SOLL tabs ──────────────────

  it('BUG: dashboard shows SOLL-based remaining even when previous tabs had savings', () => {
    // Tab 0: SOLL=10 ha → 16 units. Used 8 units (partial fill)
    // Tab 1: SOLL=10 ha → 16 units. Filled 16 units exactly
    // Total SOLL = 32, used = 24 → dashboard shows 8 remaining
    // But tab 0 saved 8 units (used only half of SOLL), so tab 1 could use those
    // Effective remaining = 0 (tab 0 saved 8, tab 1 used 8 saved + 8 own)
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].duenger = 200;
    w.state.reiter[0].entries = [
      { einheit: 8.0, duenger: 160, zaehlerStand: 5, time: '09:00' }
    ];
    w.addReiter();
    w.state.reiter[1].hektar = 10;
    w.state.reiter[1].koerner = 80000;
    w.state.reiter[1].duenger = 200;
    w.state.reiter[1].entries = [
      { einheit: 16.0, duenger: 200, zaehlerStand: 10, time: '10:00' }
    ];

    const summary = getDashboardSummary();
    // Dashboard shows: total SOLL - total used = 32 - 24 = 8 remaining
    // It never calls getCarryover() so it can't apply tab 0's savings to tab 1
    expect(summary.einheitenVal).toBe('8,0'); // Bug: should be 0,0 if savings were applied
  });

  it('BUG: dashboard does not display savings indicator when tabs are under-utilized', () => {
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].entries = [
      { einheit: 8.0, duenger: 0, zaehlerStand: 5, time: '09:00' }
    ];

    w.openDashboard();
    const content = doc.getElementById('dashboard_content');
    const text = content.textContent || '';
    expect(text).not.toMatch(/gespart/i);
    expect(text).not.toMatch(/ersparnis/i);
    expect(text).not.toMatch(/carryover/i);
  });

  it('dashboard shows correct remaining when there are no carryover effects', () => {
    // Two tabs, no entries — both fully remaining
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].entries = [];
    w.addReiter();
    w.state.reiter[1].hektar = 10;
    w.state.reiter[1].koerner = 80000;
    w.state.reiter[1].entries = [];

    const summary = getDashboardSummary();
    // Total SOLL units = 16 + 16 = 32, total used = 0 → remaining = 32
    expect(summary.einheitenVal).toBe('32,0');
  });

  it('dashboard remaining = SOLL - used (no carryover logic)', () => {
    // Simple case: tab 0 partially filled, tab 1 empty
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].entries = [{ einheit: 8.0, duenger: 0, zaehlerStand: 5, time: '09:00' }];
    w.addReiter();
    w.state.reiter[1].hektar = 10;
    w.state.reiter[1].koerner = 80000;
    w.state.reiter[1].entries = [];

    const summary = getDashboardSummary();
    // Total SOLL = 32, used = 8 → remaining = 24
    expect(summary.einheitenVal).toBe('24,0');
  });

  it('empty dashboard when no tabs have valid data', () => {
    const summary = getDashboardSummary();
    expect(summary.flaecheVal).toBe('—');
    expect(summary.einheitenVal).toBe('—');
    expect(summary.duengerVal).toBe('—');
  });

  it('dashboard updates when state changes between opens', () => {
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].entries = [];

    const s1 = getDashboardSummary();
    expect(s1.einheitenVal).toBe('16,0');

    // Add entry
    w.state.reiter[0].entries = [{ einheit: 10.0, duenger: 0, zaehlerStand: 6, time: '10:00' }];

    const s2 = getDashboardSummary();
    expect(s2.einheitenVal).toBe('6,0');
  });

  it('dashboard per-tab shows remaining correctly', () => {
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].entries = [{ einheit: 5.0, duenger: 0, zaehlerStand: 3, time: '09:00' }];

    w.openDashboard();
    const cards = doc.querySelectorAll('.dashboard-reiter-card');
    const stats = cards[0].querySelectorAll('.dashboard-stat');
    const einheitenCardVal = stats[2]?.querySelector('.dashboard-stat-value')?.textContent || '';
    expect(einheitenCardVal).toBe('11,0'); // 16 - 5 = 11
  });

  it('BUG: excess (IST>SOLL) is also not reflected in dashboard remaining', () => {
    // Tab 0: used 20 units with SOLL=16 → excess=4
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].entries = [{ einheit: 20.0, duenger: 0, zaehlerStand: 10, time: '10:00' }];

    const summary = getDashboardSummary();
    // Dashboard: SOLL - used = 16 - 20 = max(0, -4) = 0 remaining
    // (No carryover redistribution shown)
    expect(summary.einheitenVal).toBe('0,0');
  });
});
