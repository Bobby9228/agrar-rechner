/**
 * Tests for centralized computeFahrgassenFaktor() — Issue #204.
 *
 * Formula: (breite - 1) / breite
 * This is the single source of truth used by all Fahrgassen calculations.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('computeFahrgassenFaktor', () => {
  let w;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
  });

  // --- Pure function edge cases ---

  it('returns 1 for breite=0 (disabled)', () => {
    expect(w.computeFahrgassenFaktor(0)).toBe(1);
  });

  it('returns 1 for breite=undefined', () => {
    expect(w.computeFahrgassenFaktor(undefined)).toBe(1);
  });

  it('returns 1 for breite=null', () => {
    expect(w.computeFahrgassenFaktor(null)).toBe(1);
  });

  it('returns 1 for breite=1 (below minimum)', () => {
    expect(w.computeFahrgassenFaktor(1)).toBe(1);
  });

  it('returns 1 for negative breite', () => {
    expect(w.computeFahrgassenFaktor(-5)).toBe(1);
  });

  it('returns 0.5 for breite=2 (minimum valid)', () => {
    expect(w.computeFahrgassenFaktor(2)).toBe(0.5);
  });

  it('returns correct factor for breite=4', () => {
    // (4-1)/4 = 0.75
    expect(w.computeFahrgassenFaktor(4)).toBe(0.75);
  });

  it('returns correct factor for breite=10', () => {
    // (10-1)/10 = 0.9
    expect(w.computeFahrgassenFaktor(10)).toBe(0.9);
  });

  it('returns correct factor for breite=24', () => {
    // (24-1)/24 ≈ 0.95833
    expect(w.computeFahrgassenFaktor(24)).toBeCloseTo(23 / 24, 10);
  });

  it('returns correct factor for breite=100 (large)', () => {
    // (100-1)/100 = 0.99
    expect(w.computeFahrgassenFaktor(100)).toBe(0.99);
  });

  // --- Consistency: all 4 call sites use the same formula ---

  it('getTotalEinheiten uses same factor as computeFahrgassenFaktor', () => {
    var r = { hektar: 10, koerner: 80000, fahrgassenEnabled: true, fahrgassenBreite: 4 };
    var faktor = w.computeFahrgassenFaktor(4);
    var einheiten = (10 * 80000) / 50000;
    expect(w.getTotalEinheiten(r, 50000)).toBeCloseTo(einheiten * faktor, 5);
  });

  it('getTabKornerGesamt uses same factor as computeFahrgassenFaktor', () => {
    var r = { hektar: 10, koerner: 90000, fahrgassenEnabled: true, fahrgassenBreite: 24 };
    var faktor = w.computeFahrgassenFaktor(24);
    expect(w.getTabKornerGesamt(r)).toBeCloseTo(10 * 90000 * faktor, 5);
  });

  it('getTabRates uses same factor as computeFahrgassenFaktor', () => {
    w.state.koernerProEinheit = 50000;
    w.state.reiter[0].koerner = 90000;
    w.state.reiter[0].fahrgassenEnabled = true;
    w.state.reiter[0].fahrgassenBreite = 24;
    var faktor = w.computeFahrgassenFaktor(24);
    var rates = w.getTabRates(0);
    expect(rates.unitsPerHa).toBeCloseTo(90000 * faktor / 50000, 5);
  });

  // --- Per-tab independence (Issue #222) ---

  it('getTabRates uses per-tab fahrgassenBreite, not global', () => {
    w.state.koernerProEinheit = 50000;
    w.state.reiter[0].koerner = 80000;
    // Global says breite=24, per-tab says breite=4 → should use per-tab
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 24;
    w.state.reiter[0].fahrgassenEnabled = true;
    w.state.reiter[0].fahrgassenBreite = 4;
    var faktor = w.computeFahrgassenFaktor(4); // 0.75
    var rates = w.getTabRates(0);
    expect(rates.unitsPerHa).toBeCloseTo(80000 * faktor / 50000, 5);
  });

  it('getTabRates ignores global fahrgassen when per-tab disabled', () => {
    w.state.koernerProEinheit = 50000;
    w.state.reiter[0].koerner = 80000;
    // Global enabled, per-tab disabled → no correction
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 24;
    w.state.reiter[0].fahrgassenEnabled = false;
    w.state.reiter[0].fahrgassenBreite = 0;
    var rates = w.getTabRates(0);
    expect(rates.unitsPerHa).toBe(80000 / 50000);
  });

  // --- No Fahrgassen = no correction ---

  it('getTotalEinheiten returns uncorrected when fahrgassenEnabled=false', () => {
    var r = { hektar: 10, koerner: 80000, fahrgassenEnabled: false, fahrgassenBreite: 24 };
    expect(w.getTotalEinheiten(r, 50000)).toBe(16);
  });

  it('getTabKornerGesamt returns uncorrected when fahrgassenEnabled=false', () => {
    var r = { hektar: 10, koerner: 90000, fahrgassenEnabled: false, fahrgassenBreite: 24 };
    expect(w.getTabKornerGesamt(r)).toBe(900000);
  });

  // --- End-to-end: getKornerGesamt() matches expected values from Issue ---

  it('getKornerGesamt with breite=24 matches 862,500 (Issue #204 reference)', () => {
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 24;
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 90000;
    w.state.reiter[0].fahrgassenEnabled = true;
    w.state.reiter[0].fahrgassenBreite = 24;
    // (24-1)/24 * 900000 = 862500
    expect(w.getKornerGesamt()).toBe(862500);
  });

  it('getTabTotalEinheiten with breite=4 matches 12.0 (dashboard reference)', () => {
    var r = { hektar: 10, koerner: 80000, fahrgassenEnabled: true, fahrgassenBreite: 4 };
    // 10*80000/50000 * 0.75 = 12.0
    expect(w.getTabTotalEinheiten(r)).toBe(12);
  });
});
