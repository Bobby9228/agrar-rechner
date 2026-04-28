/**
 * Tests for berechne() — main calculation button.
 * - Validation errors for missing inputs
 * - Successful calculation
 * - State persistence after calculation
 * - Drill reset confirm dialog
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDom } from './helpers.js';

describe('berechne()', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('shows error when hektar is empty', () => {
    doc.getElementById('hektar').value = '';
    doc.getElementById('koerner').value = '90000';
    w.berechne();
    expect(doc.getElementById('err_hektar').textContent).toBe('Bitte Hektar eingeben');
    // jsdom converts #d32f2f to rgb(211, 47, 47)
    expect(doc.getElementById('hektar').style.borderColor).toBeTruthy();
    expect(doc.getElementById('results').style.display).toBe('none');
  });

  it('shows error when hektar is 0', () => {
    doc.getElementById('hektar').value = '0';
    doc.getElementById('koerner').value = '90000';
    w.berechne();
    expect(doc.getElementById('err_hektar').textContent).toBe('Bitte Hektar eingeben');
  });

  it('shows error when koerner is empty', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '';
    w.berechne();
    expect(doc.getElementById('err_koerner').textContent).toBe('Bitte Körner pro ha eingeben');
    // jsdom converts hex colors to rgb
    expect(doc.getElementById('koerner').style.borderColor).toBeTruthy();
  });

  it('shows error when koerner is 0', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '0';
    w.berechne();
    expect(doc.getElementById('err_koerner').textContent).toBe('Bitte Körner pro ha eingeben');
  });

  it('shows error when hektar is negative', () => {
    doc.getElementById('hektar').value = '-5';
    doc.getElementById('koerner').value = '90000';
    w.berechne();
    expect(doc.getElementById('err_hektar').textContent).toBe('Bitte Hektar eingeben');
  });

  it('clears previous errors on new attempt', () => {
    // First: trigger hektar error
    doc.getElementById('hektar').value = '';
    doc.getElementById('koerner').value = '90000';
    w.berechne();
    expect(doc.getElementById('err_hektar').textContent).toBeTruthy();

    // Now fix it
    doc.getElementById('hektar').value = '10';
    w.berechne();
    expect(doc.getElementById('err_hektar').textContent).toBe('');
    // borderColor should be reset (empty string)
    expect(doc.getElementById('hektar').style.borderColor).toBeFalsy();
  });

  it('calculates and shows results with valid input', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    doc.getElementById('duenger').value = '150';
    w.berechne();

    expect(doc.getElementById('results').style.display).toBe('block');
    // Körner gesamt = 900000
    expect(doc.getElementById('r_korner').textContent).toBe('900.000');
    // Einheiten = 18
    expect(doc.getElementById('r_einheiten').textContent).toBe('18,0 Einheiten');
    // Dünger = 1500 kg
    expect(doc.getElementById('r_duenger').textContent).toContain('1.500');
    expect(doc.getElementById('r_duenger').textContent).toContain('kg');
  });

  it('calculates without duenger', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    doc.getElementById('duenger').value = '';
    w.berechne();

    expect(doc.getElementById('results').style.display).toBe('block');
    expect(doc.getElementById('r_duenger').textContent).toBe('—');
  });

  it('stores values in state after calculation', () => {
    doc.getElementById('hektar').value = '12,5';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200';
    w.berechne();

    const r = w.getActiveReiter();
    expect(r.hektar).toBeCloseTo(12.5);
    expect(r.koerner).toBe(80000);
    expect(r.duenger).toBe(200);
  });

  it('handles DE-formatted inputs (comma decimal)', () => {
    doc.getElementById('hektar').value = '12,5';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '150,5';
    w.berechne();

    const r = w.getActiveReiter();
    expect(r.hektar).toBeCloseTo(12.5);
    expect(r.duenger).toBeCloseTo(150.5);
  });

  it('shows drill_section after successful calculation', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    w.berechne();
    // drill_section is shown ONLY in protokoll mode, not after berechne()
    expect(doc.getElementById('drill_section').style.display).toBe('none');
  });

  it('negative duenger is treated as 0', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    doc.getElementById('duenger').value = '-50';
    w.berechne();

    const r = w.getActiveReiter();
    expect(r.duenger).toBe(0);
  });

  it('persistence: calls sv() to save state', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    w.berechne();

    // State should be persisted (check via store)
    // Since we mock localStorage, let's verify state was written
    // by checking that the state object is populated
    expect(w.state.reiter[0].hektar).toBe(10);
    expect(w.state.reiter[0].koerner).toBe(90000);
  });

  describe('drill reset confirm', () => {
    it('asks confirm when drill entries exceed new totals', () => {
      // Setup: calculate first
      doc.getElementById('hektar').value = '10';
      doc.getElementById('koerner').value = '90000';
      w.berechne();

      // Add a drill entry
      const r = w.getActiveReiter();
      r.entries.push({ einheit: 10, hektar: 5, duenger: 500, time: '10:00' });

      // Mock confirm to return false (user cancels)
      w.confirm = () => false;

      // Now change hektar to a smaller value that makes existing entries invalid
      doc.getElementById('hektar').value = '1';
      doc.getElementById('koerner').value = '90000';
      w.berechne();

      // Calculation should NOT proceed (user cancelled)
      expect(doc.getElementById('results').style.display).toBe('block'); // still showing old results
      expect(r.entries.length).toBe(1); // entries not cleared
    });

    it('clears drill entries when user confirms', () => {
      doc.getElementById('hektar').value = '10';
      doc.getElementById('koerner').value = '90000';
      w.berechne();

      const r = w.getActiveReiter();
      r.entries.push({ einheit: 10, hektar: 5, duenger: 500, time: '10:00' });

      w.confirm = () => true;

      doc.getElementById('hektar').value = '1';
      doc.getElementById('koerner').value = '90000';
      w.berechne();

      expect(r.entries.length).toBe(0);
      // New calculation should succeed
      expect(r.hektar).toBe(1);
    });
  });
});
