/**
 * Tests for remaining edge cases and utility functions:
 * - fmt() formatting
 * - toInputValue() number to string
 * - getTabKornerGesamt / getTabTotalDuenger with various inputs
 * - getTabTotalEinheiten with fahrgassen
 * - lv() migration edge cases
 * - confirmRemoveReiter (confirm mock)
 * - resetAll clears machineLog
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('fmt()', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('formats integer with one decimal', () => {
    expect(w.fmt(5)).toBe('5,0');
  });

  it('formats decimal correctly', () => {
    expect(w.fmt(3.7)).toBe('3,7');
  });

  it('rounds to one decimal place', () => {
    expect(w.fmt(3.14159)).toBe('3,1');
  });

  it('rounds 0.05 to 0,1 (round half up)', () => {
    expect(w.fmt(0.05)).toBe('0,1');
  });

  it('rounds 0.04 to 0,0', () => {
    expect(w.fmt(0.04)).toBe('0,0');
  });

  it('formats 0 correctly', () => {
    expect(w.fmt(0)).toBe('0,0');
  });

  it('formats large numbers', () => {
    expect(w.fmt(12345.6)).toBe('12345,6');
  });

  it('handles negative numbers', () => {
    expect(w.fmt(-3.5)).toBe('-3,5');
  });
});

describe('toInputValue()', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('replaces dot with comma', () => {
    expect(w.toInputValue(3.5)).toBe('3,5');
  });

  it('integer stays integer (no comma)', () => {
    expect(w.toInputValue(10)).toBe('10');
  });

  it('0 stays 0', () => {
    expect(w.toInputValue(0)).toBe('0');
  });

  it('works with very small decimals', () => {
    expect(w.toInputValue(0.1)).toBe('0,1');
  });
});

describe('getTabKornerGesamt cross-tab', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('works for a specific tab, not activeReiter', () => {
    w.state.reiter = [
      { name: 'A', hektar: 10, koerner: 90000, entries: [] },
      { name: 'B', hektar: 5, koerner: 80000, entries: [] },
    ];
    expect(w.getTabKornerGesamt(w.state.reiter[0])).toBe(900000);
    expect(w.getTabKornerGesamt(w.state.reiter[1])).toBe(400000);
  });

  it('respects fahrgassen for specific tab', () => {
    var tab = { name: 'X', hektar: 10, koerner: 100000, entries: [] };
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 4;
    // (4-1)/4 = 0.75
    expect(w.getTabKornerGesamt(tab)).toBe(750000);
  });
});

describe('getTabTotalDuenger cross-tab', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('works for a specific tab', () => {
    var tab = { name: 'X', hektar: 10, duenger: 200, entries: [] };
    expect(w.getTabTotalDuenger(tab)).toBe(2000);
  });

  it('returns 0 when hektar is 0', () => {
    var tab = { name: 'X', hektar: 0, duenger: 200, entries: [] };
    expect(w.getTabTotalDuenger(tab)).toBe(0);
  });

  it('returns 0 when duenger is 0', () => {
    var tab = { name: 'X', hektar: 10, duenger: 0, entries: [] };
    expect(w.getTabTotalDuenger(tab)).toBe(0);
  });
});

describe('lv() migration edge cases', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('migrates old flat state with entries to tabbed', () => {
    var oldState = {
      hektar: 10,
      koerner: 90000,
      duenger: 150,
      entries: [{ einheit: 5, duenger: 100 }]
    };
    w.localStorage.setItem('agrar_rechner', JSON.stringify(oldState));
    w.loadState();
    expect(w.state.reiter).toBeTruthy();
    expect(w.state.reiter.length).toBe(1);
    expect(w.state.reiter[0].hektar).toBe(10);
    expect(w.state.reiter[0].koerner).toBe(90000);
    expect(w.state.reiter[0].entries.length).toBe(1);
  });

  it('migrates state with global entries to first tab entries', () => {
    var oldState = {
      reiter: [{ name: 'Tab 1', hektar: 5, koerner: 80000 }],
      entries: [{ einheit: 3, duenger: 50 }]
    };
    w.localStorage.setItem('agrar_rechner', JSON.stringify(oldState));
    w.loadState();
    expect(w.state.reiter[0].entries.length).toBe(1);
    // Global entries should be removed
    expect(w.state.entries).toBeUndefined();
  });

  it('does not overwrite existing tab entries during migration', () => {
    var oldState = {
      reiter: [
        { name: 'Tab 1', hektar: 5, koerner: 80000, entries: [{ einheit: 2 }] },
        { name: 'Tab 2', hektar: 3, koerner: 70000 }
      ],
      entries: [{ einheit: 3 }]
    };
    w.localStorage.setItem('agrar_rechner', JSON.stringify(oldState));
    w.loadState();
    // Tab 1 already has entries, should keep them
    expect(w.state.reiter[0].entries.length).toBe(1);
    expect(w.state.reiter[0].entries[0].einheit).toBe(2);
    // Tab 2 should get entries array
    expect(w.state.reiter[1].entries).toEqual([]);
  });

  it('ensures machineLog exists after migration', () => {
    var oldState = {
      reiter: [{ name: 'Tab 1', hektar: 5, koerner: 80000, entries: [] }]
    };
    delete oldState.machineLog;
    w.localStorage.setItem('agrar_rechner', JSON.stringify(oldState));
    w.loadState();
    expect(w.state.machineLog).toEqual([]);
  });
});

describe('confirmRemoveReiter', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('removes tab when confirmed', () => {
    var originalConfirm = w.confirm;
    w.confirm = () => true;

    w.addReiter();
    expect(w.state.reiter.length).toBe(2);
    w.confirmRemoveReiter(1);
    expect(w.state.reiter.length).toBe(1);

    w.confirm = originalConfirm;
  });

  it('keeps tab when cancelled', () => {
    var originalConfirm = w.confirm;
    w.confirm = () => false;

    w.addReiter();
    expect(w.state.reiter.length).toBe(2);
    w.confirmRemoveReiter(1);
    expect(w.state.reiter.length).toBe(2);

    w.confirm = originalConfirm;
  });

  it('shows data warning when tab has data', () => {
    var lastMsg = '';
    var originalConfirm = w.confirm;
    w.confirm = (msg) => { lastMsg = msg; return false; };

    w.addReiter();
    w.state.reiter[1].hektar = 10;
    w.state.reiter[1].koerner = 90000;
    w.confirmRemoveReiter(1);

    expect(lastMsg).toContain('Daten vorhanden');

    w.confirm = originalConfirm;
  });

  it('shows basic message when tab has no data', () => {
    var lastMsg = '';
    var originalConfirm = w.confirm;
    w.confirm = (msg) => { lastMsg = msg; return false; };

    w.addReiter();
    w.confirmRemoveReiter(1);

    expect(lastMsg).toContain('Alle Eingaben gehen verloren');

    w.confirm = originalConfirm;
  });
});

describe('drillRemove cross-tab', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('removes entry from specified tab', () => {
    w.state.reiter[0].entries = [
      { einheit: 5, duenger: 100 },
      { einheit: 3, duenger: 50 },
    ];
    w.drillRemove(0, 0);
    expect(w.state.reiter[0].entries.length).toBe(1);
    expect(w.state.reiter[0].entries[0].einheit).toBeCloseTo(3);
  });

  it('removes entry from different tab', () => {
    w.state.reiter.push({ name: 'B', hektar: 5, koerner: 80000, duenger: 0, entries: [
      { einheit: 2, duenger: 30 },
    ]});
    w.drillRemove(1, 0);
    expect(w.state.reiter[1].entries.length).toBe(0);
  });

  it('saves state after removal', () => {
    w.state.reiter[0].entries = [{ einheit: 5, duenger: 100 }];
    w.drillRemove(0, 0);
    var stored = JSON.parse(w.localStorage.getItem('agrar_rechner'));
    expect(stored.reiter[0].entries.length).toBe(0);
  });
});
