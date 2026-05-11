/**
 * Tests for IST/SOLL savings and carryover display in protocol.
 * IST is now a separate field per tab (r.istHektar).
 * Carryover goes to the first NOT-fertig tab, not distributed across all subsequent tabs.
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

  it('carryover goes to first not-done tab, not distributed', () => {
    const { w } = setup();
    w.addReiter();
    // Tab 0: SOLL=8, IST=7.9 → fertig (7.9 Einheiten cover IST-bedarf of 7.9)
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 8, istHektar: 7.9, koerner: 50000, duenger: 100 };
    // Tab 1: SOLL=10, no IST, no entries → not done → gets carryover
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 10, koerner: 50000, duenger: 120 };

    // Fill tab 0 completely (fertig)
    w.state.activeReiter = 0;
    w.document.getElementById('drill_einheit').value = '7,9';
    w.document.getElementById('drill_hektar').value = '7,9';
    w.drillAdd();

    const container = w.document.getElementById('drill_entries');
    const carryDivs = container.querySelectorAll('.drill-carryover');
    // Tab 1 should show carryover (it's the first not-done tab)
    expect(carryDivs.length).toBeGreaterThanOrEqual(1);
    expect(carryDivs[0].textContent).toContain('Übertrag aus ersparten Flächen');
    expect(carryDivs[0].textContent).toContain('+');
  });

  it('no carryover when first tab is not done (it gets the savings)', () => {
    const { w } = setup();
    w.addReiter();
    // Tab 0: SOLL=8, IST=7.9, only 5 Einheiten filled → NOT done
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 8, istHektar: 7.9, koerner: 50000, duenger: 100 };
    // Tab 1: SOLL=10, no IST → not done either
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 10, koerner: 50000, duenger: 120 };

    // Fill tab 0 partially (NOT fertig — only 5 of 7.9 needed)
    w.state.activeReiter = 0;
    w.document.getElementById('drill_einheit').value = '5';
    w.document.getElementById('drill_hektar').value = '7,9';
    w.drillAdd();

    // Tab 0 is first not-done tab → it gets the carryover, not tab 1
    var co0 = w.getCarryover(0);
    expect(co0.savedEinheit).toBeCloseTo(0.1, 1);
    var co1 = w.getCarryover(1);
    expect(co1.savedEinheit).toBe(0);
  });

  it('no carryover shown for first tab when it is done', () => {
    const { w } = setup();
    w.addReiter();
    // Tab 0: SOLL=8, IST=7.9 → will be fertig after filling 7.9 Einheiten + 790 kg Dünger
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 8, istHektar: 7.9, koerner: 50000, duenger: 100 };
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 10, koerner: 50000, duenger: 120 };

    w.state.activeReiter = 0;
    w.document.getElementById('drill_einheit').value = '7,9';
    w.document.getElementById('drill_duenger').value = '790';
    w.document.getElementById('drill_hektar').value = '7,9';
    w.drillAdd();

    // Tab 0 is done → no carryover for it
    var co0 = w.getCarryover(0);
    expect(co0.savedEinheit).toBe(0);
    expect(co0.savedDuenger).toBe(0);
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

  it('getCarryover: all savings go to first not-done tab', () => {
    const { w } = setup();
    w.addReiter();

    // Tab 0: SOLL=8, IST=7.9, with entries covering full IST → fertig
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 8, istHektar: 7.9, koerner: 50000, duenger: 100 };
    w.state.reiter[0].entries.push({ einheit: 7.9, zaehlerStand: 7.9, duenger: 790, time: '10:00' });
    // Tab 1: SOLL=6, no IST, no entries → not done
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 6, koerner: 50000, duenger: 80 };

    // Carryover for tab 1: it's the first not-done tab → gets ALL savings from tab 0
    var co1 = w.getCarryover(1);
    expect(co1.savedEinheit).toBeCloseTo(0.1, 1);
    expect(co1.savedDuenger).toBeCloseTo(10, 0);

    // Carryover for tab 0: it's done → 0
    var co0 = w.getCarryover(0);
    expect(co0.savedEinheit).toBe(0);
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

  it('excess from IST > SOLL is deducted from last-filled tab', () => {
    const { w } = setup();
    w.addReiter();
    // Tab 0: SOLL=8, IST=10 → excess of 2 Einheiten + 200 kg Dünger
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 8, istHektar: 10, koerner: 50000, duenger: 100 };
    w.state.reiter[0].entries.push({ einheit: 8, zaehlerStand: 10, duenger: 800, time: '09:00' });
    // Tab 1: SOLL=6, no IST → not done
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 6, koerner: 50000, duenger: 80 };
    w.state.reiter[1].entries.push({ einheit: 3, zaehlerStand: 0, duenger: 240, time: '10:00' });

    // Tab 1 has the latest entry → it's the last-filled tab → gets excess deducted
    var co1 = w.getCarryover(1);
    expect(co1.excessEinheit).toBeCloseTo(2, 1);  // 10 - 8 = 2 ha excess
    expect(co1.excessDuenger).toBeCloseTo(200, 0);
    // Tab 0 gets nothing
    var co0 = w.getCarryover(0);
    expect(co0.excessEinheit).toBe(0);
    expect(co0.savedEinheit).toBe(0);
  });

  it('excess shown as drill-excess div in protocol', () => {
    const { w } = setup();
    w.addReiter();
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 8, istHektar: 10, koerner: 50000, duenger: 100 };
    w.state.reiter[0].entries.push({ einheit: 8, zaehlerStand: 10, duenger: 800, time: '09:00' });
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 6, koerner: 50000, duenger: 80 };
    w.state.reiter[1].entries.push({ einheit: 3, zaehlerStand: 0, duenger: 240, time: '10:00' });

    w.renderResults();
    const container = w.document.getElementById('drill_entries');
    const excessDivs = container.querySelectorAll('.drill-excess');
    expect(excessDivs.length).toBeGreaterThanOrEqual(1);
     expect(excessDivs[0].textContent).toContain('Mehrbedarf aus überschrittenen Flächen');
    expect(excessDivs[0].textContent).toContain('-');
  });

  it('no excess shown when IST = SOLL', () => {
    const { w } = setup();
    w.addReiter();
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 8, istHektar: 8, koerner: 50000, duenger: 100 };
    w.state.reiter[0].entries.push({ einheit: 8, zaehlerStand: 8, duenger: 800, time: '09:00' });
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 6, koerner: 50000, duenger: 80 };

    var co0 = w.getCarryover(0);
    expect(co0.excessEinheit).toBe(0);
    expect(co0.excessDuenger).toBe(0);
  });

  it('savings cascade across multiple not-done tabs', () => {
    const { w } = setup();
    w.addReiter();
    w.addReiter();
    // Tab 0: SOLL=8, IST=6 → savings = 2 Einheiten
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 8, istHektar: 6, koerner: 50000, duenger: 100 };
    w.state.reiter[0].entries.push({ einheit: 6, zaehlerStand: 6, duenger: 600, time: '09:00' });
    // Tab 1: SOLL=4, needs 4 Einheiten, only 1 remaining → gets min(4, totalSavings=2) carryover
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 4, koerner: 50000, duenger: 100 };
    w.state.reiter[1].entries.push({ einheit: 3, zaehlerStand: 3, duenger: 300, time: '09:30' });
    // Tab 2: SOLL=10, needs 10 Einheiten → gets rest of savings
    w.state.reiter[2] = { ...w.state.reiter[2], hektar: 10, koerner: 50000, duenger: 100 };

    // Savings: SOLL 8 - IST 6 = 2 Einheiten, SOLL 800 - IST 600 = 200 kg Dünger
    // Tab 1 remaining: 4-3=1 Einheiten, gets min(2, 1)=1 Einheit carryover
    // Tab 2 remaining: 10 Einheiten, gets min(1, 10)=1 Einheit carryover (rest)
    var co1 = w.getCarryover(1);
    expect(co1.savedEinheit).toBeCloseTo(1, 1);
    expect(co1.savedDuenger).toBeCloseTo(100, 0);

    var co2 = w.getCarryover(2);
    expect(co2.savedEinheit).toBeCloseTo(1, 1);
    expect(co2.savedDuenger).toBeCloseTo(100, 0);
  });

  it('excess cascades to second-to-last filled tab', () => {
    const { w } = setup();
    w.addReiter();
    // Tab 0: SOLL=5, IST=8 → excess = 3 Einheiten
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 5, istHektar: 8, koerner: 50000, duenger: 100 };
    // Tab 1: last filled, remaining = 2 Einheiten → absorbs min(3, 2) = 2 excess
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 4, koerner: 50000, duenger: 100 };
    w.state.reiter[1].entries.push({ einheit: 2, zaehlerStand: 4, duenger: 200, time: '10:00' });
    // Tab 0: second-to-last, remaining = 5 → absorbs rest 1 excess
    w.state.reiter[0].entries.push({ einheit: 3, zaehlerStand: 3, duenger: 300, time: '09:00' });

    // Excess: SOLL 5 - IST 8 = -3 → 3 Einheiten excess
    // Tab 1 (last filled): remaining = 4-2 = 2, absorbs min(3, 2) = 2
    // Tab 0 (prev filled): remaining = 8-3 = 5, absorbs min(1, 5) = 1
    var co1 = w.getCarryover(1);
    expect(co1.excessEinheit).toBeCloseTo(2, 1);

    var co0 = w.getCarryover(0);
    expect(co0.excessEinheit).toBeCloseTo(1, 1);
  });
});
