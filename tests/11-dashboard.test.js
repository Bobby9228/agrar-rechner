/**
 * Tests for Dashboard feature: openDashboard, closeDashboard, renderDashboard
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Dashboard', () => {
  let w, doc, store;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
    store = result.store;
  });

  describe('openDashboard() / closeDashboard()', () => {
    it('opens the dashboard sheet and overlay', () => {
      w.openDashboard();
      expect(doc.getElementById('dashboard_sheet').classList.contains('open')).toBe(true);
      expect(doc.getElementById('dashboard_overlay').classList.contains('open')).toBe(true);
    });

    it('sets body overflow to hidden when open', () => {
      w.openDashboard();
      expect(doc.body.style.overflow).toBe('hidden');
    });

    it('closes the dashboard sheet and overlay', () => {
      w.openDashboard();
      w.closeDashboard();
      expect(doc.getElementById('dashboard_sheet').classList.contains('open')).toBe(false);
      expect(doc.getElementById('dashboard_overlay').classList.contains('open')).toBe(false);
    });

    it('restores body overflow on close', () => {
      w.openDashboard();
      w.closeDashboard();
      expect(doc.body.style.overflow).toBe('');
    });

    it('renderDashboard is called when opening', () => {
      // Setup state with one tab that has data
      w.state.reiter[0].hektar = 10;
      w.state.reiter[0].koerner = 90000;
      w.state.reiter[0].duenger = 150;
      w.openDashboard();
      // Should have a card in the content
      const cards = doc.getElementById('dashboard_content').querySelectorAll('.dashboard-reiter-card');
      expect(cards.length).toBe(1);
    });

    it('shows empty state when no reiter', () => {
      w.state.reiter = [];
      w.openDashboard();
      const empty = doc.getElementById('dashboard_content').querySelector('.dashboard-empty');
      expect(empty).toBeTruthy();
    });
  });

  describe('renderDashboard() — single tab', () => {
    it('shows tab name', () => {
      w.state.reiter[0].name = 'Feld A';
      w.state.reiter[0].hektar = 10;
      w.state.reiter[0].koerner = 90000;
      w.openDashboard();
      const nameEl = doc.querySelector('.dashboard-reiter-name');
      expect(nameEl.textContent).toContain('Feld A');
    });

    it('marks active tab with "(aktiv)"', () => {
      w.addReiter();
      // addReiter already sets activeReiter=1, so tab 1 is active
      w.openDashboard();
      const names = doc.querySelectorAll('.dashboard-reiter-name');
      expect(names[1].textContent).toContain('(aktiv)');
    });

    it('shows hektar value', () => {
      w.state.reiter[0].hektar = 12.5;
      w.state.reiter[0].koerner = 90000;
      w.openDashboard();
      const values = doc.querySelectorAll('.dashboard-stat-value');
      expect(values[0].textContent).toContain('12,5');
    });

    it('shows koerner value with DE formatting', () => {
      w.state.reiter[0].hektar = 10;
      w.state.reiter[0].koerner = 90000;
      w.openDashboard();
      const values = doc.querySelectorAll('.dashboard-stat-value');
      expect(values[1].textContent).toBe('90.000');
    });

    it('shows — when hektar is 0', () => {
      w.state.reiter[0].hektar = 0;
      w.state.reiter[0].koerner = 90000;
      w.openDashboard();
      const values = doc.querySelectorAll('.dashboard-stat-value');
      expect(values[0].textContent).toBe('—');
    });

    it('shows — when koerner is 0', () => {
      w.state.reiter[0].hektar = 10;
      w.state.reiter[0].koerner = 0;
      w.openDashboard();
      const values = doc.querySelectorAll('.dashboard-stat-value');
      expect(values[1].textContent).toBe('—');
    });

    it('shows remaining einheiten with remaining class when partially filled', () => {
      w.state.reiter[0].hektar = 10;
      w.state.reiter[0].koerner = 50000; // 10 units
      w.state.reiter[0].entries = [{ einheit: 5, hektar: 0, duenger: 0, time: '08:00' }];
      w.openDashboard();
      // The einheiten remaining stat is at index 2
      const values = doc.querySelectorAll('.dashboard-stat-value');
      // Issue #266: Dashboard nutzt fmtCompact (ganze Zahlen ohne ",0").
      expect(values[2].textContent).toContain('5');
      expect(values[2].classList.contains('remaining')).toBe(true);
    });

    it('shows remaining duenger with remaining class when partially filled', () => {
      // Setup: both einheiten and duenger are partially filled
      // so that the min (not max) of their fill ratios drives the display
      w.state.reiter[0].hektar = 10;
      w.state.reiter[0].koerner = 90000;  // 10 * 90000 / 50000 = 18 units total
      w.state.reiter[0].duenger = 150;
      // Fill 5 of 18 einheiten (= 27.8%) AND 75 of 1500 kg duenger (= 5%)
      // minFilled = 0.05 → pct = 5 → 'remaining' class
      w.state.reiter[0].entries = [
        { einheit: 5, hektar: 0, duenger: 75, time: '08:00' }
      ];
      w.openDashboard();
      const values = doc.querySelectorAll('.dashboard-stat-value');
      // Find duenger remaining (should be 1425 kg)
      const duengerRem = Array.from(values).find(v => v.textContent.includes('kg'));
      expect(duengerRem.classList.contains('remaining')).toBe(true);
    });

    it('shows done class when fully filled', () => {
      w.state.reiter[0].hektar = 10;
      w.state.reiter[0].koerner = 50000;
      w.state.reiter[0].entries = [{ einheit: 10, hektar: 0, duenger: 0, time: '08:00' }];
      w.openDashboard();
      const values = doc.querySelectorAll('.dashboard-stat-value');
      // First remaining stat
      expect(values[2].classList.contains('done')).toBe(true);
    });

    it('progress bar shows 0% when no calculation', () => {
      w.state.reiter[0].hektar = 0;
      w.state.reiter[0].koerner = 0;
      w.openDashboard();
      const fill = doc.querySelector('.dashboard-progress-fill');
      expect(fill.style.width).toBe('0%');
    });

    it('progress bar shows correct percentage', () => {
      w.state.reiter[0].hektar = 10;
      w.state.reiter[0].koerner = 50000;
      w.state.reiter[0].entries = [{ einheit: 5, hektar: 0, duenger: 0, time: '08:00' }]; // 50%
      w.openDashboard();
      const fill = doc.querySelector('.dashboard-progress-fill');
      expect(fill.style.width).toBe('50%');
    });
  });

  describe('renderDashboard() — multiple tabs', () => {
    it('renders one card per tab', () => {
      w.addReiter();
      w.addReiter();
      w.openDashboard();
      const cards = doc.querySelectorAll('.dashboard-reiter-card');
      expect(cards.length).toBe(3);
    });

    it('each card shows its respective values', () => {
      // Tab 0: 10 ha, 90000 k → 18 units
      w.state.reiter[0].hektar = 10;
      w.state.reiter[0].koerner = 90000;
      // Tab 1: 20 ha, 80000 k → 32 units (pushed directly, no addReiter to avoid syncStateFromInputs overwriting tab 0)
      // Push directly to avoid addReiter's syncStateFromInputs overwriting tab 0
      w.state.reiter.push({
        name: 'Tab 2', hektar: 20, koerner: 80000, duenger: 0, entries: []
      });
      w.state.activeReiter = 0;
      w.openDashboard();
      const cards = doc.querySelectorAll('.dashboard-reiter-card');
      // First card: 10 ha
      const firstHa = cards[0].querySelectorAll('.dashboard-stat-value')[0];
      expect(firstHa.textContent).toContain('10');
      // Second card: 20 ha
      const secondHa = cards[1].querySelectorAll('.dashboard-stat-value')[0];
      expect(secondHa.textContent).toContain('20');
    });
  });
});
