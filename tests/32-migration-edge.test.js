/**
 * Tests for lv() migration edge cases.
 *
 * MEDIUM: lv() migrates old flat state to tabbed format.
 *
 * Key insight: einheitGroesseEnabled and koernerProEinheit are NOT migrated.
 * They only get set when the user interacts with the einheitGroesse UI.
 * New state initialized by the app (not loaded) gets defaults in the state object.
 * But old loaded state may have these properties undefined.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('lv() migration edge cases', () => {
  let w, doc, store;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
    store = result.store;
  });

  it('migrates old state with only hektar and koerner (no duenger)', () => {
    store['mais_rechner'] = JSON.stringify({
      hektar: 10,
      koerner: 80000,
      // no duenger, no entries
    });

    w.loadState();

    expect(w.state.reiter).toBeDefined();
    expect(w.state.reiter.length).toBe(1);
    expect(w.state.reiter[0].hektar).toBe(10);
    expect(w.state.reiter[0].koerner).toBe(80000);
    expect(w.state.reiter[0].duenger).toBe(0);
    expect(w.state.reiter[0].entries).toEqual([]);
  });

  it('migrates old state with entries but no reiter', () => {
    store['mais_rechner'] = JSON.stringify({
      hektar: 10,
      koerner: 80000,
      duenger: 200,
      entries: [
        { einheit: 5, zaehlerStand: 3, duenger: 100, time: '09:00' },
        { einheit: 3, zaehlerStand: 6, duenger: 60, time: '10:00' }
      ]
    });

    w.loadState();

    expect(w.state.reiter[0].entries.length).toBe(2);
    expect(w.state.reiter[0].entries[0].einheit).toBe(5);
    expect(w.state.entries).toBeUndefined();
  });

  it('old state istHektar is not preserved in migrated tabs (migration gap)', () => {
    // Migration 1 (tab-less → tab format) creates a fresh tab object.
    // The old top-level istHektar: 3 is NOT migrated to the new tab object.
    // This is a separate gap — #105 only covers undefined → 0 fallback.
    store['mais_rechner'] = JSON.stringify({
      hektar: 10,
      koerner: 80000,
      duenger: 200,
      istHektar: 3, // old top-level field — LOST during migration
      entries: []
    });

    w.loadState();

    // #105 fix: tab-level istHektar is now 0 (not undefined) after migration
    expect(w.state.reiter[0].istHektar).toBe(0);
    // Old top-level istHektar is still there (not migrated — separate gap)
    expect(w.state.istHektar).toBe(3);
  });
  it('does not crash when parsed state is null', () => {
    store['mais_rechner'] = 'null';
    expect(() => w.loadState()).not.toThrow();
  });

  it('does not crash when parsed state is array (invalid format)', () => {
    store['mais_rechner'] = JSON.stringify([{ foo: 'bar' }]);
    expect(() => w.loadState()).not.toThrow();
  });

  it('does not crash when parsed state is a string (invalid format)', () => {
    store['mais_rechner'] = JSON.stringify('just a string');
    expect(() => w.loadState()).not.toThrow();
  });

  it('ensures machineLog exists after migration', () => {
    store['mais_rechner'] = JSON.stringify({
      hektar: 10,
      koerner: 80000,
      // no machineLog
    });

    w.loadState();

    expect(w.state.machineLog).toBeDefined();
    expect(Array.isArray(w.state.machineLog)).toBe(true);
  });

  it('preserves existing machineLog during migration', () => {
    store['mais_rechner'] = JSON.stringify({
      hektar: 10,
      koerner: 80000,
      machineLog: [{ einheit: 5, zaehlerStand: 3, duenger: 100, time: '09:00' }]
    });

    w.loadState();

    expect(w.state.machineLog.length).toBe(1);
  });

  it('does not migrate when reiter already exists in loaded state', () => {
    store['mais_rechner'] = JSON.stringify({
      reiter: [{ name: 'Existing', hektar: 20, koerner: 90000, duenger: 250, entries: [] }],
      activeReiter: 0,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      // old flat fields present but should be ignored
      hektar: 10,
      koerner: 80000
    });

    w.loadState();

    expect(w.state.reiter[0].hektar).toBe(20);
    expect(w.state.reiter[0].koerner).toBe(90000);
  });

  it('sets zaehlerstand to 0 if missing in loaded state', () => {
    store['mais_rechner'] = JSON.stringify({
      reiter: [{ name: 'Tab 1', hektar: 10, koerner: 80000, duenger: 0, entries: [] }],
      activeReiter: 0,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0
      // no zaehlerstand
    });

    w.loadState();

    expect(w.state.zaehlerstand).toBe(0);
  });

  it('migrates entries from global to tab when tab has no entries', () => {
    store['mais_rechner'] = JSON.stringify({
      hektar: 10,
      koerner: 80000,
      duenger: 200,
      entries: [{ einheit: 5, zaehlerStand: 3, duenger: 100, time: '09:00' }]
    });

    w.loadState();

    expect(w.state.reiter[0].entries.length).toBe(1);
    expect(w.state.entries).toBeUndefined();
  });

  it('leaves entries on existing tab intact during migration', () => {
    store['mais_rechner'] = JSON.stringify({
      reiter: [{ name: 'Tab 1', hektar: 10, koerner: 80000, duenger: 200, entries: [{ einheit: 2, zaehlerStand: 1, duenger: 50, time: '08:00' }] }],
      entries: [{ einheit: 5, zaehlerStand: 3, duenger: 100, time: '09:00' }],
      activeReiter: 0,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0
    });

    w.loadState();

    // Tab already has an entry → global entry should NOT be added
    expect(w.state.reiter[0].entries.length).toBe(1);
    expect(w.state.reiter[0].entries[0].einheit).toBe(2);
  });

  it('old migrated state may have undefined einheitGroesseEnabled', () => {
    // MIGRATION 4 sets einheitGroesseEnabled to false if undefined
    store['mais_rechner'] = JSON.stringify({
      hektar: 10,
      koerner: 80000
      // no einheitGroesseEnabled
    });

    w.loadState();

    // Migration 4 sets default value false for einheitGroesseEnabled
    expect(w.state.einheitGroesseEnabled).toBe(false);
  });

  it('old migrated state may have undefined koernerProEinheit', () => {
    store['mais_rechner'] = JSON.stringify({
      hektar: 10,
      koerner: 80000
      // no koernerProEinheit
    });

    w.loadState();

    // Migration 4 sets default value 50000 for koernerProEinheit
    expect(w.state.koernerProEinheit).toBe(50000);
  });
});
