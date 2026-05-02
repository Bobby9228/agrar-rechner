/**
 * Tests for IST/SOLL/Abweichung calculation in result area.
 * Bug: IST-Fläche and Abweichung are calculated incorrectly.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

function setup() {
  const { dom, window: w, store } = createDom();
  w.initUI();
  return { dom, w, store };
}

describe('IST/SOLL Abweichung', () => {
  it('shows IST=0 and Abweichung=-SOLL when no entries exist', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '50000';
    w.berechne();

    expect(w.document.getElementById('r_soll_ha').textContent).toBe('10,0 ha');
    expect(w.document.getElementById('r_ist_ha').textContent).toBe('0,0 ha');
    expect(w.document.getElementById('r_diff_ha').textContent).toBe('-10,0 ha');
  });

  it('derives IST from Einheiten proportion when no zaehlerstand', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '50000';
    w.berechne();

    // 10 ha × 50000 = 500000 koerner → 10 Einheiten (at 50000/Einheit)
    // Add 5 Einheiten via drill (single-tab fallback, no zaehlerstand)
    w.document.getElementById('drill_einheit').value = '5';
    w.drillAdd();

    // 5 of 10 Einheiten = 50% → IST should be 5 ha
    // Abweichung should be -5 ha
    expect(w.document.getElementById('r_ist_ha').textContent).toBe('5,0 ha');
    expect(w.document.getElementById('r_diff_ha').textContent).toBe('-5,0 ha');
  });

  it('derives IST correctly when half of total Einheiten used', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '8';
    w.document.getElementById('koerner').value = '50000';
    w.berechne();

    // 8 ha × 50000 = 400000 → 8 Einheiten
    w.document.getElementById('drill_einheit').value = '4';
    w.drillAdd();

    // 4/8 = 50% → IST = 4 ha
    expect(w.document.getElementById('r_ist_ha').textContent).toBe('4,0 ha');
    expect(w.document.getElementById('r_diff_ha').textContent).toBe('-4,0 ha');
  });

  it('IST = SOLL when all Einheiten used', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '50000';
    w.berechne();

    // 10 Einheiten total
    w.document.getElementById('drill_einheit').value = '10';
    w.drillAdd();

    expect(w.document.getElementById('r_ist_ha').textContent).toBe('10,0 ha');
    expect(w.document.getElementById('r_diff_ha').textContent).toBe('+0,0 ha');
  });

  it('IST > SOLL when more Einheiten than target', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '50000';
    w.berechne();

    w.document.getElementById('drill_einheit').value = '12';
    w.drillAdd();

    // 12/10 = 120% → IST = 12 ha
    expect(w.document.getElementById('r_ist_ha').textContent).toBe('12,0 ha');
    expect(w.document.getElementById('r_diff_ha').textContent).toBe('+2,0 ha');
  });

  it('multiple drill entries accumulate IST correctly', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '50000';
    w.berechne();

    // First add 3 Einheiten
    w.document.getElementById('drill_einheit').value = '3';
    w.drillAdd();
    expect(w.document.getElementById('r_ist_ha').textContent).toBe('3,0 ha');

    // Then add 4 Einheiten
    w.document.getElementById('drill_einheit').value = '4';
    w.drillAdd();
    // Total 7 Einheiten = 70% → IST = 7 ha
    expect(w.document.getElementById('r_ist_ha').textContent).toBe('7,0 ha');
    expect(w.document.getElementById('r_diff_ha').textContent).toBe('-3,0 ha');
  });

  it('prefers zaehlerstand-based IST over Einheiten-derived when available', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '50000';
    w.berechne();

    // Use zaehlerstand: start at 0, update to 6
    w.document.getElementById('zaehler_stand').value = '6';
    w.zaehlerUpdate();

    // Zaehlerstand says 6 ha done
    expect(w.document.getElementById('r_ist_ha').textContent).toBe('6,0 ha');
    expect(w.document.getElementById('r_diff_ha').textContent).toBe('-4,0 ha');
  });

  it('accounts for Fahrgassen factor in IST derivation', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '50000';
    w.berechne();

    // Enable Fahrgassen with breite=6 (factor = 5/6)
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 6;
    w.sv();

    // Total Einheiten = 10 ha * 50000 * (5/6) / 50000 = 8.333 Einheiten
    w.document.getElementById('drill_einheit').value = '4';
    w.drillAdd();

    // 4 / 8.333 * 10 = 4.8 ha
    const istText = w.document.getElementById('r_ist_ha').textContent;
    // Should be approximately 4.8 ha
    expect(parseFloat(istText.replace(',', '.'))).toBeCloseTo(4.8, 1);
  });
});
