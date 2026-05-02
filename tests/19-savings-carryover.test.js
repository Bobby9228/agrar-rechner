/**
 * Tests for IST/SOLL savings and carryover display in protocol.
 * When IST < SOLL, the savings (less seed/fertilizer) should be shown per tab,
 * and the cumulative carryover should be shown for subsequent tabs.
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

function setup() {
  const { dom, window: w, store } = createDom();
  w.initUI();
  return { dom, w, store };
}

function setupMultiTab(w) {
  // Add a second tab and configure both
  w.addReiter();
  // Tab 0: SOLL=8, koerner=50000, duenger=100
  w.state.reiter[0] = { ...w.state.reiter[0], hektar: 8, koerner: 50000, duenger: 100 };
  // Tab 1: SOLL=10, koerner=50000, duenger=120
  w.state.reiter[1] = { ...w.state.reiter[1], hektar: 10, koerner: 50000, duenger: 120 };
  // Set tab 0 as active for drill input
  w.state.activeReiter = 0;
}

describe('IST/SOLL Savings & Carryover', () => {
  it('shows savings in drill summary when IST < SOLL', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '8';
    w.document.getElementById('koerner').value = '50000';
    w.document.getElementById('duenger').value = '100';
    w.berechne();

    // Add drill with IST = 7.9 ha (0.1 ha less than SOLL = 8)
    w.document.getElementById('drill_einheit').value = '7,9';
    w.document.getElementById('drill_hektar').value = '7,9';
    w.drillAdd();

    // renderResults should have been called by drillAdd
    const savingsEl = w.document.getElementById('ds_savings');
    expect(savingsEl).not.toBeNull();
    expect(savingsEl.style.display).not.toBe('none');
    expect(savingsEl.textContent).toContain('Ersparnis');
    expect(savingsEl.textContent).toContain('Einheiten Saatgut');
  });

  it('hides savings when IST = SOLL (no savings)', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '8';
    w.document.getElementById('koerner').value = '50000';
    w.berechne();

    // Add drill with IST = 8.0 (exactly SOLL)
    w.document.getElementById('drill_einheit').value = '8';
    w.document.getElementById('drill_hektar').value = '8';
    w.drillAdd();

    const savingsEl = w.document.getElementById('ds_savings');
    expect(savingsEl).not.toBeNull();
    expect(savingsEl.style.display).toBe('none');
  });

  it('shows savings per tab in protocol', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '8';
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

  it('shows carryover for tab 2 when tab 1 has IST < SOLL', () => {
    const { w } = setup();
    setupMultiTab(w);

    // Tab 0: fill with IST = 7.9 (SOLL = 8) → saves 0.1 Einheiten
    w.state.activeReiter = 0;
    w.document.getElementById('drill_einheit').value = '7,9';
    w.document.getElementById('drill_hektar').value = '7,9';
    w.drillAdd();

    // Tab 1: fill with IST = 9.8 (SOLL = 10) → saves 0.2 Einheiten
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
    setupMultiTab(w);

    // Only fill tab 0
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
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 8, koerner: 50000, duenger: 100 };
    w.state.reiter[0].entries.push({ einheit: 7.9, istHa: 7.9, duenger: 0, time: '10:00' });
    // Tab 1: SOLL=6, IST=5.8
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 6, koerner: 50000, duenger: 80 };
    w.state.reiter[1].entries.push({ einheit: 5.8, istHa: 5.8, duenger: 0, time: '10:30' });

    // Carryover for tab 1 (index=1): savings from tab 0 only
    var co1 = w.getCarryover(1);
    expect(co1.savedEinheit).toBeCloseTo(0.1, 1);
    expect(co1.savedDuenger).toBeCloseTo(10, 0);

    // Carryover for tab 2 (index=2): savings from tab 0 + tab 1
    var co2 = w.getCarryover(2);
    expect(co2.savedEinheit).toBeCloseTo(0.3, 1);  // 0.1 + 0.2
    expect(co2.savedDuenger).toBeCloseTo(26, 0);    // 10 + 16
  });

  it('no savings shown when no IST entries exist', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '8';
    w.document.getElementById('koerner').value = '50000';
    w.document.getElementById('duenger').value = '100';
    w.berechne();

    // No drill entries → no savings
    const savingsEl = w.document.getElementById('ds_savings');
    expect(savingsEl).not.toBeNull();
    expect(savingsEl.style.display).toBe('none');

    const container = w.document.getElementById('drill_entries');
    const savingsDiv = container.querySelector('.drill-savings');
    expect(savingsDiv).toBeNull();
  });
});
