/**
 * Tests for Drill-Protokoll: drillAdd(), drillRemove(), renderResults()
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Drill-Protokoll', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;

    // Setup: calculate first so drill section is ready
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    doc.getElementById('duenger').value = '150';
    w.berechne();
  });

  describe('drillAdd()', () => {
    it('adds an entry with einheit and hektar', () => {
      doc.getElementById('drill_einheit').value = '1,5';
      doc.getElementById('drill_hektar').value = '5,0';
      doc.getElementById('drill_duenger').value = '200';
      w.drillAdd();

      const entries = w.getActiveReiter().entries;
      expect(entries.length).toBe(1);
      expect(entries[0].einheit).toBeCloseTo(1.5);
      expect(entries[0].hektar).toBeCloseTo(5.0);
      expect(entries[0].duenger).toBe(200);
      expect(entries[0].time).toBeTruthy();
    });

    it('adds entry with einheit only (no duenger)', () => {
      doc.getElementById('drill_einheit').value = '2';
      doc.getElementById('drill_hektar').value = '';
      doc.getElementById('drill_duenger').value = '';
      w.drillAdd();

      const entries = w.getActiveReiter().entries;
      expect(entries.length).toBe(1);
      expect(entries[0].einheit).toBe(2);
      expect(entries[0].duenger).toBe(0);
      expect(entries[0].hektar).toBe(0);
    });

    it('adds entry with duenger only (no einheit)', () => {
      doc.getElementById('drill_einheit').value = '';
      doc.getElementById('drill_hektar').value = '';
      doc.getElementById('drill_duenger').value = '500';
      w.drillAdd();

      const entries = w.getActiveReiter().entries;
      expect(entries.length).toBe(1);
      expect(entries[0].einheit).toBe(0);
      expect(entries[0].duenger).toBe(500);
    });

    it('does NOT add when both einheit and duenger are 0/empty', () => {
      doc.getElementById('drill_einheit').value = '';
      doc.getElementById('drill_hektar').value = '5';
      doc.getElementById('drill_duenger').value = '';
      w.drillAdd();

      expect(w.getActiveReiter().entries.length).toBe(0);
    });

    it('does NOT add when inputs are zero', () => {
      doc.getElementById('drill_einheit').value = '0';
      doc.getElementById('drill_hektar').value = '0';
      doc.getElementById('drill_duenger').value = '0';
      w.drillAdd();

      expect(w.getActiveReiter().entries.length).toBe(0);
    });

    it('clears input fields after adding', () => {
      doc.getElementById('drill_einheit').value = '2';
      doc.getElementById('drill_hektar').value = '5';
      doc.getElementById('drill_duenger').value = '300';
      w.drillAdd();

      expect(doc.getElementById('drill_einheit').value).toBe('');
      expect(doc.getElementById('drill_hektar').value).toBe('');
      expect(doc.getElementById('drill_duenger').value).toBe('');
    });

    it('does nothing when no calculation was done (hektar/koerner=0)', () => {
      // Reset state
      w.state.reiter[0].hektar = 0;
      w.state.reiter[0].koerner = 0;

      doc.getElementById('drill_einheit').value = '2';
      w.drillAdd();
      expect(w.getActiveReiter().entries.length).toBe(0);
    });

    it('adds multiple entries in sequence', () => {
      doc.getElementById('drill_einheit').value = '2';
      doc.getElementById('drill_hektar').value = '3';
      doc.getElementById('drill_duenger').value = '100';
      w.drillAdd();

      doc.getElementById('drill_einheit').value = '3';
      doc.getElementById('drill_hektar').value = '4';
      doc.getElementById('drill_duenger').value = '200';
      w.drillAdd();

      const entries = w.getActiveReiter().entries;
      expect(entries.length).toBe(2);
      expect(entries[0].einheit).toBe(2);
      expect(entries[1].einheit).toBe(3);
    });

    it('records time for each entry', () => {
      doc.getElementById('drill_einheit').value = '1';
      doc.getElementById('drill_duenger').value = '100';
      w.drillAdd();

      const entry = w.getActiveReiter().entries[0];
      // Time should be a string in HH:MM format
      expect(entry.time).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe('drillRemove()', () => {
    it('removes an entry by index', () => {
      doc.getElementById('drill_einheit').value = '2';
      doc.getElementById('drill_duenger').value = '100';
      w.drillAdd();

      doc.getElementById('drill_einheit').value = '3';
      doc.getElementById('drill_duenger').value = '200';
      w.drillAdd();

      expect(w.getActiveReiter().entries.length).toBe(2);

      w.drillRemove(0);
      expect(w.getActiveReiter().entries.length).toBe(1);
      expect(w.getActiveReiter().entries[0].einheit).toBe(3);
    });

    it('removes the last entry', () => {
      doc.getElementById('drill_einheit').value = '2';
      doc.getElementById('drill_duenger').value = '100';
      w.drillAdd();

      w.drillRemove(0);
      expect(w.getActiveReiter().entries.length).toBe(0);
    });
  });

  describe('renderResults() — drill summary', () => {
    it('shows correct summary after adding entries', () => {
      doc.getElementById('drill_einheit').value = '5';
      doc.getElementById('drill_hektar').value = '3,5';
      doc.getElementById('drill_duenger').value = '500';
      w.drillAdd();

      // Check drill summary
      // Total einheiten = 18 (10ha * 90000 / 50000)
      expect(doc.getElementById('ds_saat_total').textContent).toBe('18,0 Einheiten');
      // Used einheit = 5
      expect(doc.getElementById('ds_saat_used').textContent).toContain('5,0 Einheiten');
      expect(doc.getElementById('ds_saat_used').textContent).toContain('3,5 ha');
      // Remaining = 18 - 5 = 13
      expect(doc.getElementById('ds_saat_remaining').textContent).toBe('13,0 Einheiten');
      // Duenger total = 1500
      expect(doc.getElementById('ds_duenger_total').textContent).toContain('1.500');
      // Duenger used = 500
      expect(doc.getElementById('ds_duenger_used').textContent).toContain('500');
      // Duenger remaining = 1000
      expect(doc.getElementById('ds_duenger_remaining').textContent).toContain('1.000');
    });

    it('shows "Noch nichts eingefüllt" when no entries', () => {
      // After berechne with no drill entries
      const container = doc.getElementById('drill_entries');
      const emptyEl = container.querySelector('.drill-empty');
      expect(emptyEl).toBeTruthy();
      expect(emptyEl.textContent).toBe('Noch nichts eingefüllt');
    });

    it('shows entry list after adding', () => {
      doc.getElementById('drill_einheit').value = '2';
      doc.getElementById('drill_duenger').value = '100';
      w.drillAdd();

      const container = doc.getElementById('drill_entries');
      const entries = container.querySelectorAll('.drill-entry');
      expect(entries.length).toBe(1);
    });

    it('shows total summary line', () => {
      doc.getElementById('drill_einheit').value = '5';
      doc.getElementById('drill_hektar').value = '3,5';
      doc.getElementById('drill_duenger').value = '500';
      w.drillAdd();

      const summary = doc.getElementById('ds_total_summary').textContent;
      expect(summary).toContain('3,5 ha');
      expect(summary).toContain('5,0 Einheiten');
      expect(summary).toContain('500');
      expect(summary).toContain('Dünger');
      expect(summary).toContain('eingefüllt');
    });

    it('shows "—" total summary when no entries', () => {
      expect(doc.getElementById('ds_total_summary').textContent).toBe('—');
    });

    it('remaining duenger is clamped to 0 (no negative)', () => {
      // Add more duenger than total
      doc.getElementById('drill_einheit').value = '0';
      doc.getElementById('drill_duenger').value = '2000';
      w.drillAdd();

      const rem = doc.getElementById('ds_duenger_remaining').textContent;
      // Math.max(0, 1500 - 2000) = 0
      expect(rem).toContain('0');
    });

    it('remaining einheit is clamped to 0 (no negative)', () => {
      doc.getElementById('drill_einheit').value = '20';
      doc.getElementById('drill_duenger').value = '0';
      w.drillAdd();

      const rem = doc.getElementById('ds_saat_remaining').textContent;
      // Math.max(0, 18 - 20) = 0
      expect(rem).toBe('0,0 Einheiten');
    });
  });
});
