/**
 * Regression tests for bugs fixed in session 2026-04-25.
 *
 * These tests verify the exact scenarios that caused each bug,
 * ensuring they cannot re-occur.
 *
 * Fix 1 (5e823cb): entries undefined on reiter → TypeError in berechne()
 * Fix 2 (741a31b): missing tab-add button → appendChild(null) in renderTabs()
 * Fix 3 (75447f1): renderTabs recycled detached node → NotFoundError
 * Fix 4 (919a999): syncInputsFromState wrote 9.2 instead of 9,2 → parseDE read 92
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

// ---------------------------------------------------------------------------
// Fix 1: entries array missing on reiter objects from old localStorage
// ---------------------------------------------------------------------------
describe('Regression: entries undefined on reiter', () => {
  let w, doc, store;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
    store = result.store;
  });

  it('berechne() works when reiter has no entries field (loaded from old localStorage)', () => {
    // Simulate old localStorage where reiter objects had no entries field
    store['mais_rechner'] = JSON.stringify({
      reiter: [
        { name: 'Feld A', hektar: 10, koerner: 90000, duenger: 150 }
        // no entries field!
      ],
      activeReiter: 0,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
    });
    w.loadState();

    // The reiter should now have entries initialized
    const r = w.getActiveReiter();
    expect(Array.isArray(r.entries)).toBe(true);
    expect(r.entries.length).toBe(0);

    // berechne should not throw
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    expect(() => w.berechne()).not.toThrow();
    expect(doc.getElementById('results').style.display).toBe('block');
  });

  it('getActiveReiter() auto-creates entries array when missing', () => {
    // Directly corrupt state to simulate the edge case
    w.state.reiter[0].entries = undefined;
    const r = w.getActiveReiter();
    expect(Array.isArray(r.entries)).toBe(true);
  });

  it('berechne() works with multiple reiters where one has no entries', () => {
    store['mais_rechner'] = JSON.stringify({
      reiter: [
        { name: 'Feld A', hektar: 5, koerner: 80000, duenger: 100, entries: [{ einheit: 1, hektar: 2, duenger: 50, time: '10:00' }] },
        { name: 'Feld B', hektar: 8, koerner: 90000, duenger: 200 }  // no entries!
      ],
      activeReiter: 1,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
    });
    w.loadState();

    // Switch to the tab without entries
    doc.getElementById('hektar').value = '8';
    doc.getElementById('koerner').value = '90000';
    expect(() => w.berechne()).not.toThrow();
    expect(doc.getElementById('r_korner').textContent).toBe('720.000');
  });

  it('lv() migration adds entries to ALL reiters, not just the first', () => {
    store['mais_rechner'] = JSON.stringify({
      reiter: [
        { name: 'A', hektar: 1, koerner: 80000, duenger: 0 },
        { name: 'B', hektar: 2, koerner: 90000, duenger: 0 },
        { name: 'C', hektar: 3, koerner: 85000, duenger: 0 },
      ],
      activeReiter: 0,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
    });
    w.loadState();

    expect(Array.isArray(w.state.reiter[0].entries)).toBe(true);
    expect(Array.isArray(w.state.reiter[1].entries)).toBe(true);
    expect(Array.isArray(w.state.reiter[2].entries)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fix 2 + 3: renderTabs() must always create tab-add button fresh
// ---------------------------------------------------------------------------
describe('Regression: renderTabs creates tab-add button fresh', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('tab-add button exists after initial renderTabs', () => {
    w.renderTabs();
    expect(doc.querySelector('.tab-add')).not.toBeNull();
  });

  it('tab-add button still exists after multiple renderTabs calls', () => {
    w.renderTabs();
    w.renderTabs();
    w.renderTabs();
    expect(doc.querySelector('.tab-add')).not.toBeNull();
  });

  it('tab-add button exists after adding a tab (addReiter triggers renderTabs)', () => {
    w.addReiter();
    expect(doc.querySelector('.tab-add')).not.toBeNull();
    expect(doc.querySelector('.tab-add').textContent).toContain('Tab');
  });

  it('berechne works after adding a tab (renderTabs called from berechne)', () => {
    w.addReiter();
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    expect(() => w.berechne()).not.toThrow();
    expect(doc.getElementById('results').style.display).toBe('block');
  });

  it('renderTabs survives adding and removing tabs repeatedly', () => {
    w.addReiter(); // 2 tabs
    w.addReiter(); // 3 tabs
    expect(doc.querySelectorAll('.field-tab').length).toBe(3);
    expect(doc.querySelector('.tab-add')).not.toBeNull();

    w.removeReiter(2);
    w.removeReiter(1);
    expect(w.state.reiter.length).toBe(1);
    expect(doc.querySelector('.tab-add')).not.toBeNull();
  });

  it('tab-add onclick still works after multiple renderTabs calls', () => {
    w.renderTabs();
    w.renderTabs();

    // Click the add button
    const addBtn = doc.querySelector('.tab-add');
    expect(addBtn).not.toBeNull();
    addBtn.onclick();
    expect(w.state.reiter.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Fix 4: syncInputsFromState must format decimals with comma (DE locale)
// ---------------------------------------------------------------------------
describe('Regression: syncInputsFromState uses DE format', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('writes hektar with comma: 9.2 → "9,2" not "9.2"', () => {
    w.state.reiter[0].hektar = 9.2;
    w.syncInputsFromState();
    expect(doc.getElementById('hektar').value).toBe('9,2');
  });

  it('writes duenger with comma: 150.5 → "150,5" not "150.5"', () => {
    w.state.reiter[0].duenger = 150.5;
    w.syncInputsFromState();
    expect(doc.getElementById('duenger').value).toBe('150,5');
  });

  it('integer values have no comma: 90000 → "90000"', () => {
    w.state.reiter[0].koerner = 90000;
    w.syncInputsFromState();
    expect(doc.getElementById('koerner').value).toBe('90000');
  });

  it('full cycle: berechne → switchReiter → berechne preserves correct decimal', () => {
    // Calculate with 9,2 ha
    doc.getElementById('hektar').value = '9,2';
    doc.getElementById('koerner').value = '90000';
    doc.getElementById('duenger').value = '150';
    w.berechne();

    expect(w.state.reiter[0].hektar).toBeCloseTo(9.2);

    // Add a second tab and switch to it
    w.addReiter();

    // Switch back to first tab
    w.switchReiter(0);

    // Input should show "9,2" not "9.2"
    expect(doc.getElementById('hektar').value).toBe('9,2');

    // Calculate again — should still be 9.2 ha, not 92 ha
    w.berechne();
    expect(w.state.reiter[0].hektar).toBeCloseTo(9.2);
    // 9.2 * 90000 = 828000, not 92 * 90000 = 8280000
    expect(doc.getElementById('r_korner').textContent).toBe('828.000');
  });

  it('full cycle: berechne → initUI reload → berechne preserves correct decimal', () => {
    // Calculate with 12,5 ha
    doc.getElementById('hektar').value = '12,5';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200,5';
    w.berechne();
    w.saveState();

    // Reload state via lv + syncInputsFromState
    w.state = {
      reiter: [{ name: 'Reiter 1', hektar: 0, koerner: 0, duenger: 0, entries: [] }],
      activeReiter: 0,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
    };
    w.loadState();
    w.syncInputsFromState();

    // Should show DE format
    expect(doc.getElementById('hektar').value).toBe('12,5');
    expect(doc.getElementById('duenger').value).toBe('200,5');

    // Recalculate — must be 12.5 ha not 125 ha
    w.berechne();
    expect(w.state.reiter[0].hektar).toBeCloseTo(12.5);
    // 12.5 * 80000 = 1000000
    expect(doc.getElementById('r_korner').textContent).toBe('1.000.000');
  });

  it('fahrgassenBreite is formatted with comma after initUI', () => {
    // Save state with decimal fahrgassenBreite
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 24.5;
    w.saveState();

    // Reload and init
    w.state = {
      reiter: [{ name: 'Reiter 1', hektar: 0, koerner: 0, duenger: 0, entries: [] }],
      activeReiter: 0,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
    };
    w.loadState();
    w.initUI();

    expect(doc.getElementById('fahrgassen_breite').value).toBe('24,5');
  });
});

// ---------------------------------------------------------------------------
// Integration: all fixes work together
// ---------------------------------------------------------------------------
describe('Regression: integration — old localStorage + tabs + decimals', () => {
  let w, doc, store;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
    store = result.store;
  });

  it('old localStorage with no entries → add tab → calculate with decimals', () => {
    // Simulate the exact state that caused the original crash
    store['mais_rechner'] = JSON.stringify({
      reiter: [
        { name: 'Feld A', hektar: 9.2, koerner: 90000, duenger: 150.5 }
      ],
      activeReiter: 0,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
    });
    w.loadState();
    w.syncInputsFromState();

    // Should show DE format
    expect(doc.getElementById('hektar').value).toBe('9,2');

    // Calculate
    expect(() => w.berechne()).not.toThrow();
    expect(doc.getElementById('results').style.display).toBe('block');

    // Add a tab
    expect(() => w.addReiter()).not.toThrow();
    expect(w.state.reiter.length).toBe(2);
    expect(doc.querySelector('.tab-add')).not.toBeNull();

    // Calculate on new tab
    doc.getElementById('hektar').value = '5,5';
    doc.getElementById('koerner').value = '80000';
    expect(() => w.berechne()).not.toThrow();
    expect(w.state.reiter[1].hektar).toBeCloseTo(5.5);

    // Switch back to first tab — should still be 9,2 not 92
    w.switchReiter(0);
    expect(doc.getElementById('hektar').value).toBe('9,2');
    expect(() => w.berechne()).not.toThrow();
    expect(w.state.reiter[0].hektar).toBeCloseTo(9.2);
  });
});
