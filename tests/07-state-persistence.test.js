/**
 * Tests for state persistence: sv(), lv() + migration logic.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('State persistence', () => {
  let w, doc, store;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
    store = result.store;
  });

  describe('sv() — save state', () => {
    it('saves state to localStorage', () => {
      w.state.reiter[0].hektar = 10;
      w.saveState();
      const raw = store['mais_rechner'];
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw);
      expect(parsed.reiter[0].hektar).toBe(10);
    });

    it('saves complete state structure', () => {
      w.saveState();
      const parsed = JSON.parse(store['mais_rechner']);
      expect(parsed.reiter).toBeDefined();
      expect(parsed.activeReiter).toBeDefined();
      expect(parsed.fahrgassenEnabled).toBeDefined();
      expect(parsed.fahrgassenBreite).toBeDefined();
    });

    it('handles localStorage errors gracefully', () => {
      // Override localStorage to throw
      const orig = w.localStorage.setItem;
      w.localStorage.setItem = () => { throw new Error('QuotaExceeded'); };
      expect(() => w.saveState()).not.toThrow();
      w.localStorage.setItem = orig;
    });
  });

  describe('lv() — load state', () => {
    it('loads state from localStorage', () => {
      store['mais_rechner'] = JSON.stringify({
        reiter: [{ name: 'Test', hektar: 15, koerner: 80000, duenger: 200, entries: [] }],
        activeReiter: 0,
        fahrgassenEnabled: false,
        fahrgassenBreite: 0,
      });
      w.loadState();
      expect(w.state.reiter[0].name).toBe('Test');
      expect(w.state.reiter[0].hektar).toBe(15);
    });

    it('does nothing when localStorage is empty', () => {
      w.loadState();
      // State should remain at default
      expect(w.state.reiter.length).toBe(1);
      expect(w.state.activeReiter).toBe(0);
    });

    it('handles corrupted JSON gracefully', () => {
      store['mais_rechner'] = 'not-valid-json{{{';
      expect(() => w.loadState()).not.toThrow();
    });

    it('handles localStorage errors gracefully', () => {
      w.localStorage.getItem = () => { throw new Error('Access denied'); };
      expect(() => w.loadState()).not.toThrow();
    });

    it('uses default state when localStorage contains empty object {}', () => {
      store['mais_rechner'] = '{}';
      w.loadState();
      expect(w.state.reiter.length).toBe(1);
      expect(w.state.activeReiter).toBe(0);
    });

    it('uses default state when localStorage contains empty array []', () => {
      store['mais_rechner'] = '[]';
      w.loadState();
      expect(w.state.reiter.length).toBe(1);
      expect(w.state.activeReiter).toBe(0);
    });

    it('uses default state when reiter is present but empty', () => {
      store['mais_rechner'] = JSON.stringify({ reiter: [] });
      w.loadState();
      expect(w.state.reiter.length).toBe(1);
      expect(w.state.activeReiter).toBe(0);
    });

    it('uses default state when reiter is null', () => {
      store['mais_rechner'] = JSON.stringify({ reiter: null });
      w.loadState();
      expect(w.state.reiter.length).toBe(1);
      expect(w.state.activeReiter).toBe(0);
    });
  });

  describe('Migration: old flat state to tabbed state', () => {
    it('migrates flat state (no reiter) to tabbed format', () => {
      store['mais_rechner'] = JSON.stringify({
        hektar: 10,
        koerner: 90000,
        duenger: 150,
        entries: [{ einheit: 5, hektar: 3, duenger: 200, time: '10:00' }],
      });
      w.loadState();

      expect(w.state.reiter).toBeDefined();
      expect(w.state.reiter.length).toBe(1);
      expect(w.state.reiter[0].hektar).toBe(10);
      expect(w.state.reiter[0].koerner).toBe(90000);
      expect(w.state.reiter[0].duenger).toBe(150);
      expect(w.state.activeReiter).toBe(0);
      // Old properties should be deleted
      expect(w.state.hektar).toBeUndefined();
      expect(w.state.koerner).toBeUndefined();
    });

    it('migrates global entries to first tab', () => {
      store['mais_rechner'] = JSON.stringify({
        reiter: [{ name: 'Reiter 1', hektar: 10, koerner: 90000, duenger: 150 }],
        entries: [{ einheit: 5, hektar: 3, duenger: 200, time: '10:00' }],
        activeReiter: 0,
        fahrgassenEnabled: false,
        fahrgassenBreite: 0,
      });
      w.loadState();

      expect(w.state.reiter[0].entries).toBeDefined();
      expect(w.state.reiter[0].entries.length).toBe(1);
      expect(w.state.entries).toBeUndefined();
    });

    it('does not overwrite existing tab entries during migration', () => {
      store['mais_rechner'] = JSON.stringify({
        reiter: [{ name: 'Reiter 1', hektar: 10, koerner: 90000, duenger: 150, entries: [{ einheit: 1, hektar: 1, duenger: 50, time: '09:00' }] }],
        entries: [{ einheit: 5, hektar: 3, duenger: 200, time: '10:00' }],
        activeReiter: 0,
        fahrgassenEnabled: false,
        fahrgassenBreite: 0,
      });
      w.loadState();

      // Should keep existing tab entries, not overwrite with global
      expect(w.state.reiter[0].entries.length).toBe(1);
      expect(w.state.reiter[0].entries[0].einheit).toBe(1);
    });
  });

  describe('Full save/load cycle', () => {
    it('round-trips state correctly', () => {
      w.state.reiter[0].hektar = 12.5;
      w.state.reiter[0].koerner = 85000;
      w.state.reiter[0].duenger = 175;
      w.state.fahrgassenEnabled = true;
      w.state.fahrgassenBreite = 24;
      w.state.reiter[0].entries = [{ einheit: 2, hektar: 3.5, duenger: 500, time: '14:30' }];
      w.saveState();

      // Reset state
      w.state = {
        reiter: [{ name: 'Reiter 1', hektar: 0, koerner: 0, duenger: 0, entries: [] }],
        activeReiter: 0,
        fahrgassenEnabled: false,
        fahrgassenBreite: 0,
      };

      w.loadState();
      expect(w.state.reiter[0].hektar).toBeCloseTo(12.5);
      expect(w.state.reiter[0].koerner).toBe(85000);
      expect(w.state.reiter[0].duenger).toBe(175);
      expect(w.state.fahrgassenEnabled).toBe(true);
      expect(w.state.fahrgassenBreite).toBe(24);
      expect(w.state.reiter[0].entries.length).toBe(1);
      expect(w.state.reiter[0].entries[0].einheit).toBe(2);
    });
  });
});
