/**
 * Tests for berechne() confirm() dialog path.
 *
 * KRITISCH: berechne() Z.1723-1728 calls confirm() when usedEinheit > istE OR
 * usedDuenger > istD (i.e., existing entries exceed the new SOLL/IST totals).
 *
 * The dialog asks: "Die neuen Werte weichen von den eingetragenen Einheiten ab.
 * Drill-Protokoll zurücksetzen?"
 *
 * Note: berechne() reads from DOM inputs (hektar, koerner, duenger),
 * not from state. It sets r.hektar/r.koerner/r.duenger from those inputs.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('berechne() confirm dialog', () => {
  let w, doc;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
  });

  function berechneWithConfirm(hektar, koerner, duenger, confirmResult) {
    doc.getElementById('hektar').value = String(hektar);
    doc.getElementById('koerner').value = String(koerner);
    doc.getElementById('duenger').value = duenger !== undefined ? String(duenger) : '';
    const orig = w.confirm;
    w.confirm = () => confirmResult;
    w.berechne();
    w.confirm = orig;
  }

  it('triggers confirm when usedEinheit exceeds new SOLL (entries > new hektar)', () => {
    // First: set up initial tab
    berechneWithConfirm(10, 80000, 200, true);

    // Add entries that use more than new SOLL would allow
    const r = w.getActiveReiter();
    r.entries.push({ einheit: 10, zaehlerStand: 5, duenger: 100, time: '09:00' });

    // Mock confirm and call berechne with smaller hektar
    let confirmCalled = false;
    const orig = w.confirm;
    w.confirm = () => { confirmCalled = true; return false; };

    // New SOLL = 1 ha → 1.6 units. Existing entries = 10 units. 10 > 1.6 → confirm.
    doc.getElementById('hektar').value = '1';
    doc.getElementById('koerner').value = '80000';
    w.berechne();

    expect(confirmCalled).toBe(true);
    w.confirm = orig;
  });

  it('triggers confirm when usedDuenger exceeds new SOLL duenger', () => {
    berechneWithConfirm(10, 80000, 200, true);

    const r = w.getActiveReiter();
    r.entries.push({ einheit: 0, zaehlerStand: 0, duenger: 500, time: '09:00' });

    let confirmCalled = false;
    const orig = w.confirm;
    w.confirm = () => { confirmCalled = true; return false; };

    // New SOLL duenger = 1 ha * 200 kg = 200 kg. Existing duenger = 500 kg. 500 > 200 → confirm.
    doc.getElementById('hektar').value = '1';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200';
    w.berechne();

    expect(confirmCalled).toBe(true);
    w.confirm = orig;
  });

  it('does NOT trigger confirm when entries fit within new SOLL', () => {
    berechneWithConfirm(10, 80000, 200, true);

    const r = w.getActiveReiter();
    r.entries.push({ einheit: 5, zaehlerStand: 3, duenger: 100, time: '09:00' });

    let confirmCalled = false;
    const orig = w.confirm;
    w.confirm = () => { confirmCalled = true; return false; };

    // New SOLL = 10 ha → 16 units. Existing entries = 5 units. 5 <= 16 → no confirm.
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '80000';
    w.berechne();

    expect(confirmCalled).toBe(false);
    w.confirm = orig;
  });

  it('does NOT trigger confirm when no entries exist', () => {
    let confirmCalled = false;
    const orig = w.confirm;
    w.confirm = () => { confirmCalled = true; return false; };

    berechneWithConfirm(10, 80000, 200, false);

    expect(confirmCalled).toBe(false);
    w.confirm = orig;
  });

  it('when user CONFIRMS, entries array is cleared', () => {
    berechneWithConfirm(10, 80000, 200, true);

    const r = w.getActiveReiter();
    r.entries.push({ einheit: 10, zaehlerStand: 5, duenger: 100, time: '09:00' });
    expect(r.entries.length).toBe(1);

    const orig = w.confirm;
    w.confirm = () => true; // User confirms

    doc.getElementById('hektar').value = '1';
    doc.getElementById('koerner').value = '80000';
    w.berechne();

    expect(r.entries.length).toBe(0);
    w.confirm = orig;
  });

  it('when user DECLINES, entries array is preserved', () => {
    berechneWithConfirm(10, 80000, 200, true);

    const r = w.getActiveReiter();
    r.entries.push({ einheit: 10, zaehlerStand: 5, duenger: 100, time: '09:00' });

    const orig = w.confirm;
    w.confirm = () => false; // User declines

    doc.getElementById('hektar').value = '1';
    doc.getElementById('koerner').value = '80000';
    w.berechne();

    expect(r.entries.length).toBe(1);
    w.confirm = orig;
  });

  it('when user DECLINES, entries array is preserved; DOM is read but state still reflects original DOM values', () => {
    berechneWithConfirm(10, 80000, 200, true);

    const r = w.getActiveReiter();
    r.entries.push({ einheit: 10, zaehlerStand: 5, duenger: 100, time: '09:00' });

    const orig = w.confirm;
    w.confirm = () => false; // User declines

    // berechneWithConfirm set DOM=1 but that berechne() returned early (confirm triggered).
    // DOM still has the PREVIOUS berechneWithConfirm call's DOM values (hektar=10).
    // So berechne() reads DOM=10, sets r.hektar=10.
    w.berechne();

    // Entries ARE preserved when user declines
    expect(r.entries.length).toBe(1);
    // r.hektar was updated from DOM (which still had the old 10)
    expect(r.hektar).toBe(10);
    w.confirm = orig;
  });
});
