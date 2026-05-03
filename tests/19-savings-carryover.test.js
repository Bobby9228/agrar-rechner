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
});
