/**
 * Tests for Fahrgassen toggle, update, and calculation integration.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Fahrgassen', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  describe('fahrgassenToggle()', () => {
    it('enables Fahrgassen on first click', () => {
      w.fahrgassenToggle();
      expect(w.state.fahrgassenEnabled).toBe(true);
      expect(doc.getElementById('fahrgassen_toggle').classList.contains('active')).toBe(true);
      expect(doc.getElementById('fahrgassen_settings').classList.contains('open')).toBe(true);
    });

    it('disables Fahrgassen on second click', () => {
      w.fahrgassenToggle(); // enable
      w.fahrgassenToggle(); // disable
      expect(w.state.fahrgassenEnabled).toBe(false);
      expect(doc.getElementById('fahrgassen_toggle').classList.contains('active')).toBe(false);
      expect(doc.getElementById('fahrgassen_settings').classList.contains('open')).toBe(false);
    });

    it('clears saved text when disabling', () => {
      w.fahrgassenToggle(); // enable
      doc.getElementById('fahrgassen_saved').textContent = '24 m -> ~4.2% weniger Körner';
      w.fahrgassenToggle(); // disable
      expect(doc.getElementById('fahrgassen_saved').textContent).toBe('');
    });

    it('toggles state multiple times correctly', () => {
      expect(w.state.fahrgassenEnabled).toBe(false);
      w.fahrgassenToggle(); expect(w.state.fahrgassenEnabled).toBe(true);
      w.fahrgassenToggle(); expect(w.state.fahrgassenEnabled).toBe(false);
      w.fahrgassenToggle(); expect(w.state.fahrgassenEnabled).toBe(true);
    });
  });

  describe('fahrgassenUpdate()', () => {
    it('updates state with valid breite', () => {
      doc.getElementById('fahrgassen_breite').value = '24';
      w.fahrgassenUpdate();
      expect(w.state.fahrgassenBreite).toBe(24);
    });

    it('shows percentage info for valid breite', () => {
      doc.getElementById('fahrgassen_breite').value = '24';
      w.fahrgassenUpdate();
      const text = doc.getElementById('fahrgassen_saved').textContent;
      expect(text).toContain('24 m');
      expect(text).toContain('~4.2%');
    });

    it('calculates percentage correctly for breite=10', () => {
      doc.getElementById('fahrgassen_breite').value = '10';
      w.fahrgassenUpdate();
      // 1/10 * 100 = 10.0%
      expect(doc.getElementById('fahrgassen_saved').textContent).toContain('~10.0%');
    });

    it('clears info for breite=0', () => {
      doc.getElementById('fahrgassen_breite').value = '24';
      w.fahrgassenUpdate();
      doc.getElementById('fahrgassen_breite').value = '0';
      w.fahrgassenUpdate();
      expect(doc.getElementById('fahrgassen_saved').textContent).toBe('');
      expect(w.state.fahrgassenBreite).toBe(0);
    });

    it('clears info for empty breite', () => {
      doc.getElementById('fahrgassen_breite').value = '';
      w.fahrgassenUpdate();
      expect(w.state.fahrgassenBreite).toBe(0);
      expect(doc.getElementById('fahrgassen_saved').textContent).toBe('');
    });

    it('handles DE-formatted breite (comma)', () => {
      doc.getElementById('fahrgassen_breite').value = '24,5';
      w.fahrgassenUpdate();
      expect(w.state.fahrgassenBreite).toBeCloseTo(24.5);
    });
  });

  describe('Fahrgassen calculation integration', () => {
    it('reduces KornerGesamt when enabled with breite', () => {
      w.state.reiter[0].hektar = 10;
      w.state.reiter[0].koerner = 90000;

      // Without Fahrgassen
      expect(w.getKornerGesamt()).toBe(900000);

      // With Fahrgassen breite=24
      w.state.fahrgassenEnabled = true;
      w.state.fahrgassenBreite = 24;
      expect(w.getKornerGesamt()).toBe(862500);
    });

    it('does not affect Dünger calculation', () => {
      w.state.reiter[0].hektar = 10;
      w.state.reiter[0].duenger = 150;
      w.state.fahrgassenEnabled = true;
      w.state.fahrgassenBreite = 24;
      // Dünger is always ha * kg/ha regardless of Fahrgassen
      expect(w.getTotalDuenger()).toBe(1500);
    });

    it('full flow: toggle -> set breite -> berechne', () => {
      doc.getElementById('hektar').value = '10';
      doc.getElementById('koerner').value = '90000';
      doc.getElementById('duenger').value = '150';

      w.fahrgassenToggle();
      doc.getElementById('fahrgassen_breite').value = '24';
      w.fahrgassenUpdate();
      w.berechne();

      expect(doc.getElementById('results').style.display).toBe('block');
      // Körner = 862.500, Einheiten = 17.25
      expect(doc.getElementById('r_korner').textContent).toBe('862.500');
    });
  });
});
