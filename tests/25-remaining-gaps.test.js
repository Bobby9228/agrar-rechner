/**
 * Test 25: Remaining partial coverage gaps
 * - zaehlerUpdate negative delta
 * - computeAllCarryovers threshold (0.05)
 * - initUI zaehler_section visibility
 * - renderResults machine log prognose
 */
import { describe, it, expect, vi } from 'vitest';
import { createDom } from './helpers.js';

describe('zaehlerUpdate negative delta', () => {
  it('sets negative class when delta is negative', () => {
    const { window: w } = createDom();
    w.state.zaehlerstand = 10;

    w.document.getElementById('zaehler_stand').value = '5'; // less than previous
    w.zaehlerUpdate();

    const zIstEl = w.document.getElementById('z_ist');
    expect(zIstEl.className).toContain('negative');
    expect(zIstEl.textContent).toContain('-5,0 ha');
  });

  it('sets positive class when delta is zero', () => {
    const { window: w } = createDom();
    w.state.zaehlerstand = 10;

    w.document.getElementById('zaehler_stand').value = '10';
    w.zaehlerUpdate();

    const zIstEl = w.document.getElementById('z_ist');
    expect(zIstEl.className).toContain('positive');
    expect(zIstEl.textContent).toBe('0,0 ha');
  });

  it('sets positive class when delta is positive', () => {
    const { window: w } = createDom();
    w.state.zaehlerstand = 5;

    w.document.getElementById('zaehler_stand').value = '8';
    w.zaehlerUpdate();

    const zIstEl = w.document.getElementById('z_ist');
    expect(zIstEl.className).toContain('positive');
  });

  it('sets negative diff class in SOLL/IST section when IST < SOLL', () => {
    const { window: w } = createDom();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('ist_hektar').value = '8';
    w.document.getElementById('koerner').value = '90000';
    w.berechne();

    w.state.zaehlerstand = 5;
    w.document.getElementById('zaehler_stand').value = '10';
    w.zaehlerUpdate();

    const zDiff = w.document.getElementById('z_diff');
    expect(zDiff.className).toContain('negative');
  });
});

describe('computeAllCarryovers threshold (0.05)', () => {
  it('skips carryover below 0.05 threshold for savedEinheit', () => {
    const { window: w } = createDom();
    w.addReiter();
    // Tab 0: SOLL=10ha, IST=9.99999ha → savings = 0.00001 einheiten → below threshold
    w.state.reiter[0] = {
      name: 'Tab 1', hektar: 10, istHektar: 9.999, koerner: 90000, duenger: 0, entries: []
    };
    w.state.reiter[1] = {
      name: 'Tab 2', hektar: 5, istHektar: 0, koerner: 80000, duenger: 0, entries: []
    };

    const carryovers = w.computeAllCarryovers();
    // Savings should be ~0.002 einheiten (way below 0.05)
    expect(carryovers[1].savedEinheit).toBe(0);
  });

  it('skips carryover below 0.05 threshold for excessEinheit', () => {
    const { window: w } = createDom();
    w.addReiter();
    // Tab 0: IST > SOLL by tiny amount
    w.state.reiter[0] = {
      name: 'Tab 1', hektar: 10, istHektar: 10.001, koerner: 90000, duenger: 0,
      entries: [{ einheit: 18, duenger: 0, zaehlerStand: 10, time: '10:00' }]
    };
    w.state.reiter[1] = {
      name: 'Tab 2', hektar: 5, istHektar: 0, koerner: 80000, duenger: 0, entries: []
    };

    const carryovers = w.computeAllCarryovers();
    // Excess should be ~0.002 → below threshold
    expect(carryovers[0].excessEinheit).toBe(0);
  });

  it('produces all-zero carryovers when all tabs are done', () => {
    const { window: w } = createDom();
    w.state.reiter[0] = {
      name: 'Tab 1', hektar: 10, istHektar: 0, koerner: 90000, duenger: 0,
      entries: [{ einheit: 18, duenger: 0, zaehlerStand: 10, time: '10:00' }]
    };

    const carryovers = w.computeAllCarryovers();
    expect(carryovers[0].savedEinheit).toBe(0);
    expect(carryovers[0].excessEinheit).toBe(0);
  });
});

describe('initUI zaehler_section visibility', () => {
  it('shows zaehler_section when saved state has zaehlerstand > 0 and data', () => {
    const { window: w, store } = createDom();
    const savedState = {
      reiter: [{ name: 'Tab 1', hektar: 10, istHektar: 0, koerner: 90000, duenger: 150, entries: [] }],
      activeReiter: 0,
      koernerProEinheit: 50000,
      einheitGroesseEnabled: false,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      zaehlerstand: 5.5,
      machineLog: [],
      activeView: null,
    };
    store['mais_rechner'] = JSON.stringify(savedState);

    w.initUI();

    // renderResults is called because hektar > 0 && koerner > 0
    // and zaehler_section is shown when zaehlerstand > 0
    expect(w.document.getElementById('zaehler_section').style.display).toBe('block');
  });

  it('hides zaehler_section when zaehlerstand is 0', () => {
    const { window: w, store } = createDom();
    const savedState = {
      reiter: [{ name: 'Tab 1', hektar: 10, istHektar: 0, koerner: 90000, duenger: 150, entries: [] }],
      activeReiter: 0,
      koernerProEinheit: 50000,
      einheitGroesseEnabled: false,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      zaehlerstand: 0,
      machineLog: [],
      activeView: null,
    };
    store['mais_rechner'] = JSON.stringify(savedState);

    w.initUI();

    expect(w.document.getElementById('zaehler_section').style.display).toBe('none');
  });
});

describe('renderResults machine log prognose', () => {
  it('shows prognose for single machine log entry', () => {
    const { window: w } = createDom();
    w.document.getElementById('hektar').value = '20';
    w.document.getElementById('koerner').value = '90000';
    w.document.getElementById('duenger').value = '150';
    w.berechne();

    w.state.machineLog = [
      { einheit: 10, duenger: 600, zaehlerStand: 5, time: '10:00' }
    ];
    w.renderResults();

    const mlContainer = w.document.getElementById('drill_machine_log');
    // Should have machine log title + entry row + prognose row
    expect(mlContainer.querySelector('.drill-entry-tab-header')).toBeTruthy();
    expect(mlContainer.querySelector('.drill-prognose')).toBeTruthy();
    const prognose = mlContainer.querySelector('.drill-prognose');
    expect(prognose.innerHTML).toContain('Saat leer bei');
    // 5ha + 10 einheiten / (90000/50000) = 5 + 5.56 = ~10.6 ha
    expect(prognose.innerHTML).toContain('ha');
  });

  it('calculates prognose with ha consumption between fills', () => {
    const { window: w } = createDom();
    w.document.getElementById('hektar').value = '30';
    w.document.getElementById('koerner').value = '90000';
    w.document.getElementById('duenger').value = '150';
    w.berechne();

    // Two fills: first at 5ha, second at 10ha
    w.state.machineLog = [
      { einheit: 10, duenger: 400, zaehlerStand: 5, time: '09:00' },
      { einheit: 8, duenger: 300, zaehlerStand: 10, time: '10:00' }
    ];
    w.renderResults();

    const progs = w.document.getElementById('drill_machine_log').querySelectorAll('.drill-prognose');
    expect(progs.length).toBe(2);

    // Second prognose: cumEinheit = max(0, 10 - (10-5)*1.8) + 8 = max(0, 10-9) + 8 = 1 + 8 = 9
    // prognoseSaat = 10 + 9/1.8 = 10 + 5 = 15
    const secondProg = progs[1];
    expect(secondProg.innerHTML).toContain('15,0 ha');
  });

  it('shows duenger prognose when duengerPerHa > 0', () => {
    const { window: w } = createDom();
    w.document.getElementById('hektar').value = '20';
    w.document.getElementById('koerner').value = '90000';
    w.document.getElementById('duenger').value = '150';
    w.berechne();

    w.state.machineLog = [
      { einheit: 5, duenger: 500, zaehlerStand: 3, time: '08:00' }
    ];
    w.renderResults();

    const prognose = w.document.getElementById('drill_machine_log').querySelector('.drill-prognose');
    expect(prognose.innerHTML).toContain('Dünger leer bei');
  });

  it('does not show prognose when no einheit or duenger in machine log', () => {
    const { window: w } = createDom();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '90000';
    w.berechne();

    w.state.machineLog = [
      { einheit: 0, duenger: 0, zaehlerStand: 5, time: '08:00' }
    ];
    w.renderResults();

    const prognose = w.document.getElementById('drill_machine_log').querySelector('.drill-prognose');
    expect(prognose).toBeNull();
  });

  it('includes machine log delete button that calls drillMachineRemove', () => {
    const { window: w } = createDom();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '90000';
    w.berechne();

    w.state.machineLog = [
      { einheit: 5, duenger: 200, zaehlerStand: 3, time: '08:00' }
    ];
    w.renderResults();

    const mlContainer = w.document.getElementById('drill_machine_log');
    const deleteBtn = mlContainer.querySelector('.btn-danger');
    expect(deleteBtn).toBeTruthy();
    expect(deleteBtn.textContent).toBe('✕');
  });

  it('machine log prognose uses fahrgassen factor', () => {
    const { window: w } = createDom();
    w.document.getElementById('hektar').value = '20';
    w.document.getElementById('koerner').value = '100000';
    w.document.getElementById('duenger').value = '150';
    // Enable fahrgassen with breite=6 → factor = 5/6
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 6;
    w.berechne();

    w.state.machineLog = [
      { einheit: 10, duenger: 0, zaehlerStand: 0, time: '08:00' },
      { einheit: 5, duenger: 0, zaehlerStand: 5, time: '09:00' }
    ];
    w.renderResults();

    const progs = w.document.getElementById('drill_machine_log').querySelectorAll('.drill-prognose');
    expect(progs.length).toBe(2);
    // unitsPerHa = 100000 * (5/6) / 50000 = 100000 * 0.8333 / 50000 = 1.667
    // Fill 1: cumEinheit = 10
    // prognoseSaat = 0 + 10/1.667 = ~6.0 ha
    expect(progs[0].innerHTML).toContain('6,0 ha');
  });
});
