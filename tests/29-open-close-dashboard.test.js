/**
 * Tests for openDashboard() and closeDashboard().
 *
 * KRITISCH: These functions manage the dashboard overlay + sheet.
 * No tests existed for this feature.
 *
 * Note: openDashboard uses classList.add/remove('open') not inline display styles.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Dashboard open/close', () => {
  let w, doc, store;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
    store = result.store;
  });

  it('opens dashboard: sheet and overlay get open class', () => {
    w.openDashboard();
    expect(doc.getElementById('dashboard_sheet').classList.contains('open')).toBe(true);
    expect(doc.getElementById('dashboard_overlay').classList.contains('open')).toBe(true);
  });

  it('closes dashboard via closeDashboard()', () => {
    w.openDashboard();
    w.closeDashboard();
    expect(doc.getElementById('dashboard_sheet').classList.contains('open')).toBe(false);
    expect(doc.getElementById('dashboard_overlay').classList.contains('open')).toBe(false);
  });

  it('re-opening dashboard re-renders content', () => {
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].entries = [{ einheit: 8, duenger: 0, zaehlerStand: 5, time: '09:00' }];

    w.openDashboard();
    const content1 = doc.getElementById('dashboard_content').innerHTML;

    w.state.reiter[0].entries = [{ einheit: 16, duenger: 0, zaehlerStand: 10, time: '10:00' }];

    w.closeDashboard();
    w.openDashboard();
    const content2 = doc.getElementById('dashboard_content').innerHTML;

    expect(content1).not.toBe(content2);
  });

  it('dashboard sheet exists in DOM', () => {
    expect(doc.getElementById('dashboard_sheet')).toBeTruthy();
    expect(doc.getElementById('dashboard_content')).toBeTruthy();
    expect(doc.getElementById('dashboard_overlay')).toBeTruthy();
  });

  it('default state has 1 tab shown in dashboard', () => {
    // Default state always has Schlag 1, so dashboard shows it
    w.openDashboard();
    const cards = doc.querySelectorAll('.dashboard-reiter-card');
    expect(cards.length).toBe(1);
    expect(doc.getElementById('dashboard_content').textContent).toContain('Schlag 1');
  });

  it('dashboard shows multiple tabs correctly', () => {
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.addReiter();
    w.state.reiter[1].hektar = 5;
    w.state.reiter[1].koerner = 90000;

    w.openDashboard();
    const cards = doc.querySelectorAll('.dashboard-reiter-card');
    expect(cards.length).toBe(2);
  });

  it('active tab is marked in dashboard', () => {
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.state.activeReiter = 0;
    w.addReiter(); // Sets activeReiter = 1 (new tab)
    w.state.reiter[1].hektar = 5;
    w.state.reiter[1].koerner = 90000;
    // Switch back to tab 0
    w.state.activeReiter = 0;

    w.openDashboard();
    const cards = doc.querySelectorAll('.dashboard-reiter-card');
    // Tab 0 (active) should contain '(aktiv)'
    expect(cards[0].textContent).toContain('(aktiv)');
    // Tab 1 should NOT have (aktiv)
    expect(cards[1].textContent).not.toContain('(aktiv)');
  });

  it('calling openDashboard twice does not double-render', () => {
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;

    w.openDashboard();
    w.openDashboard();
    const cards = doc.querySelectorAll('.dashboard-reiter-card');
    expect(cards.length).toBe(1);
  });

  it('summary stats show correct flaeche for multiple tabs', () => {
    w.state.reiter[0].hektar = 7.5;
    w.state.reiter[0].koerner = 80000;
    w.state.activeReiter = 0;
    w.syncInputsFromState();
    w.addReiter();
    w.state.reiter[1].hektar = 12.3;
    w.state.reiter[1].koerner = 90000;

    w.openDashboard();
    const stats = doc.querySelectorAll('.dashboard-summary-stat');
    const flaeche = stats[0]?.querySelector('.dashboard-summary-value')?.textContent || '';
    expect(flaeche).toBe('19,8 ha'); // 7.5 + 12.3 = 19.8
  });

  it('progress bar shows 0% when nothing used', () => {
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].entries = [];

    w.openDashboard();
    const fill = doc.querySelector('.dashboard-progress-fill');
    expect(fill.style.width).toBe('0%');
  });

  it('progress bar shows 100% when fully used', () => {
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    // 10 ha × 80000 / 50000 = 16 units
    w.state.reiter[0].entries = [{ einheit: 16, duenger: 0, zaehlerStand: 10, time: '10:00' }];

    w.openDashboard();
    const fill = doc.querySelector('.dashboard-progress-fill');
    expect(fill.style.width).toBe('100%');
  });

  it('closeDashboard clears body overflow', () => {
    w.openDashboard();
    w.closeDashboard();
    expect(doc.body.style.overflow).toBe('');
  });
});
