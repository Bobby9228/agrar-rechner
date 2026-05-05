/**
 * Tests for machineLog: drillAdd records machineLog, drillMachineRemove, prognose rendering.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('machineLog', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('is initially empty', () => {
    expect(w.state.machineLog).toEqual([]);
  });

  it('records entry on drillAdd (single-tab mode)', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, entries: [] };
    w.renderDrillTabList();
    w.drillPriorities[0] = 1;
    w.renderDrillTabList();
    w.document.getElementById('drill_einheit').value = '5';
    w.document.getElementById('drill_duenger').value = '200';
    w.document.getElementById('drill_hektar').value = '3';
    w.drillAdd();

    expect(w.state.machineLog.length).toBe(1);
    expect(w.state.machineLog[0].einheit).toBeCloseTo(5);
    expect(w.state.machineLog[0].duenger).toBeCloseTo(200);
    expect(w.state.machineLog[0].zaehlerStand).toBeCloseTo(3);
  });

  it('records time for machineLog entry', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, entries: [] };
    w.renderDrillTabList();
    w.drillPriorities[0] = 1;
    w.renderDrillTabList();
    w.document.getElementById('drill_einheit').value = '5';
    w.document.getElementById('drill_duenger').value = '0';
    w.drillAdd();

    expect(w.state.machineLog[0].time).toBeTruthy();
    // Time should match HH:MM format
    expect(w.state.machineLog[0].time).toMatch(/^\d{2}:\d{2}$/);
  });

  it('accumulates multiple entries', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, entries: [] };
    w.renderDrillTabList();
    w.drillPriorities[0] = 1;
    w.renderDrillTabList();
    w.document.getElementById('drill_einheit').value = '3';
    w.document.getElementById('drill_duenger').value = '0';
    w.drillAdd();

    w.document.getElementById('drill_einheit').value = '4';
    w.drillAdd();

    expect(w.state.machineLog.length).toBe(2);
    expect(w.state.machineLog[0].einheit).toBeCloseTo(3);
    expect(w.state.machineLog[1].einheit).toBeCloseTo(4);
  });

  // Issue #84: kein machineLog-Eintrag wenn alle Tabs Priorität 0 haben
  it('machineLog hat keinen Eintrag wenn alle Tabs Priorität 0 haben (ghost-entry bug)', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, entries: [] };
    w.renderDrillTabList();
    // Keine Priority gesetzt → alle Tabs haben Prio 0
    w.document.getElementById('drill_einheit').value = '3';
    w.document.getElementById('drill_duenger').value = '0';
    w.drillAdd();
    expect(w.state.machineLog.length).toBe(0);
  });
});

describe('drillMachineRemove', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('removes entry by index', () => {
    w.state.machineLog = [
      { einheit: 5, hektar: 3, duenger: 100, time: '10:00' },
      { einheit: 3, hektar: 5, duenger: 50, time: '11:00' },
    ];
    w.drillMachineRemove(0);
    expect(w.state.machineLog.length).toBe(1);
    expect(w.state.machineLog[0].einheit).toBeCloseTo(3);
  });

  it('removes last entry', () => {
    w.state.machineLog = [
      { einheit: 5, hektar: 3, duenger: 100, time: '10:00' },
    ];
    w.drillMachineRemove(0);
    expect(w.state.machineLog.length).toBe(0);
  });

  it('does nothing with negative index', () => {
    w.state.machineLog = [
      { einheit: 5, hektar: 3, duenger: 100, time: '10:00' },
    ];
    w.drillMachineRemove(-1);
    expect(w.state.machineLog.length).toBe(1);
  });

  it('does nothing with out-of-range index', () => {
    w.state.machineLog = [
      { einheit: 5, hektar: 3, duenger: 100, time: '10:00' },
    ];
    w.drillMachineRemove(5);
    expect(w.state.machineLog.length).toBe(1);
  });

  it('saves state after removal', () => {
    w.state.machineLog = [
      { einheit: 5, hektar: 3, duenger: 100, time: '10:00' },
    ];
    w.drillMachineRemove(0);
    var stored = JSON.parse(w.localStorage.getItem('mais_rechner'));
    expect(stored.machineLog.length).toBe(0);
  });
});

describe('machineLog rendering in renderResults', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('renders machine log entries', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, duenger: 0, entries: [] };
    w.state.machineLog = [
      { einheit: 5, hektar: 3, duenger: 0, time: '10:00' },
    ];
    w.renderResults();

    var mlContainer = w.document.getElementById('drill_machine_log');
    var entries = mlContainer.querySelectorAll('.drill-entry');
    expect(entries.length).toBe(1);
  });

  it('renders "Maschinen-Protokoll" header', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, duenger: 0, entries: [] };
    w.state.machineLog = [
      { einheit: 5, hektar: 3, duenger: 0, time: '10:00' },
    ];
    w.renderResults();

    var mlContainer = w.document.getElementById('drill_machine_log');
    var header = mlContainer.querySelector('.drill-entry-tab-header');
    expect(header.textContent).toContain('Maschinen-Protokoll');
  });

  it('renders delete buttons for each machine entry', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, duenger: 0, entries: [] };
    w.state.machineLog = [
      { einheit: 5, hektar: 3, duenger: 0, time: '10:00' },
      { einheit: 3, hektar: 5, duenger: 0, time: '11:00' },
    ];
    w.renderResults();

    var mlContainer = w.document.getElementById('drill_machine_log');
    var deleteButtons = mlContainer.querySelectorAll('.btn-danger');
    expect(deleteButtons.length).toBe(2);
  });

  it('shows entry number (#1, #2)', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, duenger: 0, entries: [] };
    w.state.machineLog = [
      { einheit: 5, hektar: 3, duenger: 0, time: '10:00' },
    ];
    w.renderResults();

    var mlContainer = w.document.getElementById('drill_machine_log');
    var spans = mlContainer.querySelectorAll('.entry-text span');
    expect(spans[0].textContent).toContain('#1');
  });

  it('renders empty machine log when no entries', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, duenger: 0, entries: [] };
    w.state.machineLog = [];
    w.renderResults();

    var mlContainer = w.document.getElementById('drill_machine_log');
    var entries = mlContainer.querySelectorAll('.drill-entry');
    expect(entries.length).toBe(0);
  });

  it('shows duenger info when duenger > 0', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, duenger: 150, entries: [] };
    w.state.machineLog = [
      { einheit: 5, hektar: 3, duenger: 200, time: '10:00' },
    ];
    w.renderResults();

    var mlContainer = w.document.getElementById('drill_machine_log');
    var text = mlContainer.textContent;
    expect(text).toContain('Dünger');
  });
});

describe('machineLog prognose', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('renders prognose when koerner > 0 and einheit > 0', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, duenger: 0, entries: [] };
    w.state.machineLog = [
      { einheit: 5, hektar: 0, duenger: 0, time: '10:00' },
    ];
    w.renderResults();

    var mlContainer = w.document.getElementById('drill_machine_log');
    var prognose = mlContainer.querySelectorAll('.drill-prognose');
    // Should show prognose: saat leer bei ~X ha
    expect(prognose.length).toBeGreaterThan(0);
    expect(prognose[0].textContent).toContain('Saat leer bei');
  });

  it('renders duenger prognose when duenger > 0', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, duenger: 150, entries: [] };
    w.state.machineLog = [
      { einheit: 5, hektar: 0, duenger: 500, time: '10:00' },
    ];
    w.renderResults();

    var mlContainer = w.document.getElementById('drill_machine_log');
    var prognose = mlContainer.querySelectorAll('.drill-prognose');
    expect(prognose.length).toBeGreaterThan(0);
    expect(prognose[0].textContent).toContain('Dünger leer bei');
  });

  it('does not render prognose when koerner is 0', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 0, duenger: 0, entries: [] };
    w.state.machineLog = [
      { einheit: 5, hektar: 0, duenger: 0, time: '10:00' },
    ];
    w.renderResults();

    var mlContainer = w.document.getElementById('drill_machine_log');
    var prognose = mlContainer.querySelectorAll('.drill-prognose');
    expect(prognose.length).toBe(0);
  });

  it('calculates cumulative tank level correctly', () => {
    // First fill: 5 einheiten at 0 ha
    // Second fill: 3 einheiten at 4 ha (drove 4ha since last)
    // unitsPerHa = 90000/50000 = 1.8 einheiten/ha
    // After first: cumEinheit = 5
    // After driving 4ha: cumEinheit = max(0, 5 - 4*1.8) + 3 = max(0, 5-7.2) + 3 = 0 + 3 = 3
    // Prognose: 4 + 3/1.8 = ~5.7 ha
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, duenger: 0, entries: [] };
    w.state.machineLog = [
      { einheit: 5, hektar: 0, duenger: 0, time: '10:00' },
      { einheit: 3, hektar: 4, duenger: 0, time: '11:00' },
    ];
    w.renderResults();

    var mlContainer = w.document.getElementById('drill_machine_log');
    var prognose = mlContainer.querySelectorAll('.drill-prognose');
    // Second entry should have prognose
    expect(prognose.length).toBe(2);
    // Second prognose should say saat leer bei ~5,7 ha
    expect(prognose[1].textContent).toContain('5,7');
  });
});
