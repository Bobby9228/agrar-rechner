/**
 * Tests for getDuengerProEinheit() — Issue #230.
 *
 * Background: drillAdd() in ui-handlers.js used to compute
 *   duengerPerUnit = tab.duenger / (tab.hektar || 1) * 50
 * which was dimensionally wrong (kg/ha / ha × 50 → kg/ha²) and a leftover
 * from the disproven "1 Einheit = 50 kg" assumption already removed in
 * #186/#191 from getTotalDuenger/getTabIstDuenger.
 *
 * Correct formula:
 *   duengerProEinheit = tab.duenger × koernerProEinheit / tab.koerner  (kg/Einheit)
 *
 * Herleitung:
 *   totalDuenger = hektar × duenger         (kg)
 *   totalEinheit = hektar × koerner / kpe   (Einheiten)
 *   kgProEinheit = totalDuenger / totalEinheit
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('getDuengerProEinheit — Issue #230', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('is exposed on window', () => {
    expect(typeof w.getDuengerProEinheit).toBe('function');
  });

  it('returns 0 for missing tab.duenger', () => {
    expect(w.getDuengerProEinheit({ hektar: 10, koerner: 90000 }, 50000)).toBe(0);
  });

  it('returns 0 for missing tab.koerner', () => {
    expect(w.getDuengerProEinheit({ hektar: 10, duenger: 150 }, 50000)).toBe(0);
  });

  it('returns 0 for koernerProEinheit <= 0', () => {
    expect(w.getDuengerProEinheit({ hektar: 10, koerner: 90000, duenger: 150 }, 0)).toBe(0);
  });

  it('returns 0 for null tab', () => {
    expect(w.getDuengerProEinheit(null, 50000)).toBe(0);
  });

  it('matches the algebraic identity: kg/Einheit ist dimensionsrein', () => {
    // 10 ha × 90.000 Körner/ha × 1 Einheit/50.000 Körner = 18 Einheiten
    // 10 ha × 150 kg/ha = 1500 kg Dünger
    // → 1500 / 18 ≈ 83.33 kg/Einheit
    var tab = { hektar: 10, koerner: 90000, duenger: 150 };
    expect(w.getDuengerProEinheit(tab, 50000)).toBeCloseTo(83.333, 2);
  });

  it('agrees with getTotalDuenger / getTotalEinheiten quotient', () => {
    // Das ist die algebraische Definition — duengerProEinheit muss
    // totalDuenger / totalEinheit entsprechen.
    var tab = { hektar: 5, koerner: 80000, duenger: 100 };
    var kpe = 50000;
    var totalD = w.getTotalDuenger(tab);                    // 5 × 100 = 500
    var totalE = w.getTotalEinheiten(tab, kpe);              // 5 × 80000 / 50000 = 8
    var expected = totalD / totalE;                          // 500 / 8 = 62.5
    expect(w.getDuengerProEinheit(tab, kpe)).toBeCloseTo(expected, 6);
  });

  it('responds correctly to a non-default koernerProEinheit', () => {
    // 100.000 Körner/Einheit (z.B. Sonnenblumen) → weniger Körner pro Einheit
    // ist schwerer, also kg/Einheit steigt. Konkret: duengerProEinheit ist
    // proportional zu kpe.
    var tab = { hektar: 10, koerner: 90000, duenger: 150 };
    var kgPerEinheit50k = w.getDuengerProEinheit(tab, 50000);
    var kgPerEinheit100k = w.getDuengerProEinheit(tab, 100000);
    // Verdopplung von kpe → Verdopplung von kg/Einheit
    expect(kgPerEinheit100k / kgPerEinheit50k).toBeCloseTo(2, 6);
  });

  it('Issue #230 regression: produces the value the OLD *50 formula CANNOT', () => {
    // Demonstration, dass die alte Formel `tab.duenger / hektar * 50` etwas
    // anderes liefert (mit falscher Dimension kg/ha²) und mit der neuen
    // Formel nicht übereinstimmt.
    var tab = { hektar: 10, koerner: 90000, duenger: 150 };
    var oldFormula = tab.duenger / (tab.hektar || 1) * 50;   // 750 — dimensionslos falsch
    var newFormula = w.getDuengerProEinheit(tab, 50000);      // ≈ 83.33 kg/Einheit
    expect(newFormula).not.toBeCloseTo(oldFormula, 0);
  });
});
