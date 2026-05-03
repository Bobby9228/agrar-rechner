/**
 * Tests for IST/SOLL savings and carryover display in protocol.
 * IST is now a separate field per tab (r.istHektar), not derived from entries.
 * Zählerstand on entries is just protocol info, unrelated to IST/SOLL.
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

function setup() {
  const { dom, window: w, store } = createDom();
  w.initUI();
  return { dom, w, store };
}

describe('IST/SOLL Savings & Carryover', () => {
  it('shows savings in drill summary when istHektar < hektar', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '8';
    w.document.getElementById('ist_hektar').value = '7,9';
    w.document.getElementById('koerner').value = '50000';
    w.document.getElementById('duenger').value = '100';
    w.berechne();

    // Add a drill entry (Zählerstand is protocol-only)
    w.document.getElementById('drill_einheit').value = '7,9';
    w.document.getElementById('drill_hektar').value = '7,9';
    w.drillAdd();

    const savingsEl = w.document.getElementById('ds_savings');
    expect(savingsEl).not.toBeNull();
    expect(savingsEl.style.display).not.toBe('none');
    expect(savingsEl.textContent).toContain('Ersparnis');
    expect(savingsEl.textContent).toContain('Einheiten Saatgut');
  });

  it('hides savings when istHektar = hektar (no savings)', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '8';
    w.document.getElementById('ist_hektar').value = '8';
    w.document.getElementById('koerner').value = '50000';
    w.berechne();

    w.document.getElementById('drill_einheit').value = '8';
    w.document.getElementById('drill_hektar').value = '8';
    w.drillAdd();

    const savingsEl = w.document.getElementById('ds_savings');
    expect(savingsEl).not.toBeNull();
    expect(savingsEl.style.display).toBe('none');
  });

  it('shows savings per tab in protocol when istHektar < hektar', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '8';
    w.document.getElementById('ist_hektar').value = '7,9';
    w.document.getElementById('koerner').value = '50000';
    w.document.getElementById('duenger').value = '100';
    w.berechne();

    w.document.getElementById('drill_einheit').value = '7,9';
    w.document.getElementById('drill_hektar').value = '7,9';
    w.drillAdd();

    const container = w.document.getElementById('drill_entries');
    const savingsDiv = container.querySelector('.drill-savings');
    expect(savingsDiv).not.toBeNull();
    expect(savingsDiv.textContent).toContain('Ersparnis');
  });

  it('shows carryover for tab 2 when tab 1 has istHektar < hektar', () => {
    const { w } = setup();
    // Add second tab
    w.addReiter();
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 8, istHektar: 7.9, koerner: 50000, duenger: 100 };
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 10, istHektar: 9.8, koerner: 50000, duenger: 120 };

    // Fill entries for both tabs
    w.state.activeReiter = 0;
    w.document.getElementById('drill_einheit').value = '7,9';
    w.document.getElementById('drill_hektar').value = '7,9';
    w.drillAdd();

    w.state.activeReiter = 1;
    w.document.getElementById('drill_einheit').value = '9,8';
    w.document.getElementById('drill_hektar').value = '9,8';
    w.drillAdd();

    const container = w.document.getElementById('drill_entries');
    const carryDivs = container.querySelectorAll('.drill-carryover');
    // Tab 1 should show carryover from tab 0
    expect(carryDivs.length).toBeGreaterThanOrEqual(1);
    expect(carryDivs[0].textContent).toContain('Übertrag von vorherigen Feldern');
    expect(carryDivs[0].textContent).toContain('+');
  });

  it('no carryover shown for first tab', () => {
    const { w } = setup();
    w.addReiter();
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 8, istHektar: 7.9, koerner: 50000, duenger: 100 };
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 10, koerner: 50000, duenger: 120 };

    w.state.activeReiter = 0;
    w.document.getElementById('drill_einheit').value = '7,9';
    w.document.getElementById('drill_hektar').value = '7,9';
    w.drillAdd();

    const container = w.document.getElementById('drill_entries');
    const carryDivs = container.querySelectorAll('.drill-carryover');
    expect(carryDivs.length).toBe(0);
  });

  it('savings calculation is correct for seed and fertilizer', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('ist_hektar').value = '9,5';
    w.document.getElementById('koerner').value = '50000';
    w.document.getElementById('duenger').value = '200';
    w.berechne();

    // SOLL: 10 Einheiten, 2000 kg Dünger
    // IST: 9.5 ha → 9.5 Einheiten, 1900 kg Dünger
    // Savings: 0.5 Einheiten, 100 kg Dünger
    w.document.getElementById('drill_einheit').value = '9,5';
    w.document.getElementById('drill_hektar').value = '9,5';
    w.drillAdd();

    const savingsEl = w.document.getElementById('ds_savings');
    expect(savingsEl).not.toBeNull();
    expect(savingsEl.textContent).toContain('0,5 Einheiten Saatgut');
  });

  it('getCarryover returns correct cumulative savings', () => {
    const { w } = setup();
    w.addReiter();
    w.addReiter();

    // Tab 0: SOLL=8, IST=7.9
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 8, istHektar: 7.9, koerner: 50000, duenger: 100 };
    w.state.reiter[0].entries.push({ einheit: 7.9, zaehlerStand: 7.9, duenger: 0, time: '10:00' });
    // Tab 1: SOLL=6, IST=5.8
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 6, istHektar: 5.8, koerner: 50000, duenger: 80 };
    w.state.reiter[1].entries.push({ einheit: 5.8, zaehlerStand: 5.8, duenger: 0, time: '10:30' });

    // Carryover for tab 1 (index=1): savings from tab 0 only
    var co1 = w.getCarryover(1);
    expect(co1.savedEinheit).toBeCloseTo(0.1, 1);
    expect(co1.savedDuenger).toBeCloseTo(10, 0);

    // Carryover for tab 2 (index=2): savings from tab 0 + tab 1
    var co2 = w.getCarryover(2);
    expect(co2.savedEinheit).toBeCloseTo(0.3, 1);  // 0.1 + 0.2
    expect(co2.savedDuenger).toBeCloseTo(26, 0);    // 10 + 16
  });

  it('no savings shown when no istHektar set', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '8';
    w.document.getElementById('koerner').value = '50000';
    w.document.getElementById('duenger').value = '100';
    w.berechne();

    // No istHektar → no savings
    const savingsEl = w.document.getElementById('ds_savings');
    expect(savingsEl).not.toBeNull();
    expect(savingsEl.style.display).toBe('none');

    const container = w.document.getElementById('drill_entries');
    const savingsDiv = container.querySelector('.drill-savings');
    expect(savingsDiv).toBeNull();
  });
});
