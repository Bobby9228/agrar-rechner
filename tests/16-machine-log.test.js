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
    w.state.drillPriorities[0] = 1;
    w.renderDrillTabList();
    w.document.getElementById('drill_einheit').value = '5';
    w.document.getElementById('drill_duenger').value = '200';
    w.document.getElementById('drill_hektar').value = '3';
    w.drillCalcAll();  // populate per-tab inputs before drillAdd
    w.drillAdd();

    expect(w.state.machineLog.length).toBe(1);
    expect(w.state.machineLog[0].einheit).toBeCloseTo(5);
    expect(w.state.machineLog[0].duenger).toBeCloseTo(200);
    expect(w.state.machineLog[0].zaehlerStand).toBeCloseTo(3);
  });

  it('records time for machineLog entry', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, entries: [] };
    w.renderDrillTabList();
    w.state.drillPriorities[0] = 1;
    w.renderDrillTabList();
    w.document.getElementById('drill_einheit').value = '5';
    w.document.getElementById('drill_duenger').value = '0';
    w.drillCalcAll();  // populate per-tab inputs before drillAdd
    w.drillAdd();

    expect(w.state.machineLog[0].time).toBeTruthy();
    // Time should match HH:MM or HH:MM:SS format
    expect(w.state.machineLog[0].time).toMatch(/^\d{2}:\d{2}(:\d{2})?$/);
  });

  it('accumulates multiple entries', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, entries: [] };
    w.renderDrillTabList();
    w.state.drillPriorities[0] = 1;
    w.renderDrillTabList();
    w.document.getElementById('drill_einheit').value = '3';
    w.document.getElementById('drill_duenger').value = '0';
    w.drillCalcAll();  // populate per-tab inputs before drillAdd
    w.drillAdd();

    // After drillAdd, priorities are reset. Re-set for second entry.
    w.state.drillPriorities[0] = 1;
    w.renderDrillTabList();
    w.document.getElementById('drill_einheit').value = '4';
    w.drillCalcAll();  // populate per-tab inputs before second drillAdd
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
    var stored = JSON.parse(w.localStorage.getItem('agrar_rechner'));
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
    // First fill: 5 einheiten at 0 ha (zaehlerStand)
    // Second fill: 3 einheiten at 4 ha (zaehlerStand = drove 4ha since last)
    // unitsPerHa = 90000/50000 = 1.8 einheiten/ha
    // After first: cumEinheit = 5
    // After driving 4ha: cumEinheit = max(0, 5 - 4*1.8) + 3 = max(0, 5-7.2) + 3 = 0 + 3 = 3
    // Prognose: 4 + 3/1.8 = ~5.7 ha
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, duenger: 0, entries: [] };
    w.state.machineLog = [
      { einheit: 5, zaehlerStand: 0, duenger: 0, time: '10:00' },
      { einheit: 3, zaehlerStand: 4, duenger: 0, time: '11:00' },
    ];
    w.renderResults();

    var mlContainer = w.document.getElementById('drill_machine_log');
    var prognose = mlContainer.querySelectorAll('.drill-prognose');
    // Second entry should have prognose
    expect(prognose.length).toBe(2);
    // Second prognose should say saat leer bei ~5,7 ha
    expect(prognose[1].textContent).toContain('5,7');
  });

  // Issue #307 — Pattern #1 (falsy-fallback through valid 0): when `zaehlerStand=0`,
  // the buggy `entry.zaehlerStand || entry.hektar` falls through to the target
  // hectares, inflating `driven` by the full target. A single freshly-logged entry
  // (`zaehlerStand=0`, `hektar=15`, `einheit=24`, `duenger=2000`) should NOT show
  // phantom prognose of "Saat leer bei 28,3 ha · Dünger leer bei 25,0 ha".
  //
  // Tab: koerner=90000, koernerProEinheit=50000 (default) → unitsPerHa=1,8.
  // Tab: duenger=200 → duengerPerHa=200.
  // After fix: driven=0, cumEinheit=24, cumDuenger=2000.
  // → saatLeer = 0 + 24/1.8 = 13,3 ha
  // → duengerLeer = 0 + 2000/200 = 10,0 ha
  it('Issue #307 Pattern #1: zaehlerStand=0 reports driven=0 (no phantom-ha inflation)', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 15, koerner: 90000, duenger: 200, entries: [] };
    w.state.machineLog = [
      { einheit: 24, zaehlerStand: 0, duenger: 2000, hektar: 15, time: '10:00' },
    ];
    w.renderResults();

    var mlContainer = w.document.getElementById('drill_machine_log');
    var prognose = mlContainer.querySelectorAll('.drill-prognose');
    expect(prognose.length).toBe(1);
    var txt = prognose[0].textContent;
    // Must NOT contain the buggy phantom values (28,3 / 25,0)
    expect(txt).not.toContain('28,3');
    expect(txt).not.toContain('25,0');
    // Must contain the corrected values (13,3 / 10,0)
    expect(txt).toContain('13,3');
    expect(txt).toContain('10,0');
  });

  // Issue #307 — Pattern #2 (per-entry condition instead of cumulative):
  // a follow-up entry that refills ONLY Dünger (entry.einheit=0) must still
  // show the "Saat leer bei" prognose, because `cumEinheit` is still > 0 from
  // the previous fill. The buggy `entry.einheit > 0` check silently drops the
  // Saat prognose on every entry that doesn't add Saat.
  it('Issue #307 Pattern #2: Saat prognose survives a Dünger-only follow-up entry', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 15, koerner: 90000, duenger: 200, entries: [] };
    w.state.machineLog = [
      { einheit: 24, zaehlerStand: 0, duenger: 2000, hektar: 15, time: '10:00' },
      { einheit: 0,  zaehlerStand: 0, duenger: 1000, hektar: 15, time: '11:00' },
    ];
    w.renderResults();

    var mlContainer = w.document.getElementById('drill_machine_log');
    var prognose = mlContainer.querySelectorAll('.drill-prognose');
    // Both entries must render a prognose row.
    expect(prognose.length).toBe(2);
    // The second entry (Dünger-only refill) must STILL show the Saat prognose,
    // because the cumulative Saat tank is still > 0 after the first fill.
    expect(prognose[1].textContent).toContain('Saat leer bei');
    expect(prognose[1].textContent).toContain('13,3');
    // And of course the Dünger prognose accumulates too.
    expect(prognose[1].textContent).toContain('Dünger leer bei');
    expect(prognose[1].textContent).toContain('15,0');
  });

  // Issue #313 regression: drillMachineAdd() previously read
  // parseInt('drill_einheit') as a repetition count, producing N phantom
  // entries with einheit=1, duenger=1 whenever the seed-quantity input
  // contained a value > 1 (the user's reported bug: 2x "2000 kg Dünger"
  // filled → used=3333,33 kg / remaining=1266,67 kg instead of 4000/500).
  //
  // One click of "+ Einfüllen" must push exactly ONE entry into the active
  // tab's entries AND exactly ONE entry into machineLog — regardless of the
  // numeric value the user typed into drill_einheit.
  describe('Issue #313 — drillMachineAdd single-entry contract', () => {
    it('one click → exactly one machineLog entry and one activeTab entry', () => {
      w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, duenger: 150, entries: [] };
      w.state.machineLog = [];
      w.state.activeReiter = 0;

      w.document.getElementById('drill_einheit').value = '2000';
      w.document.getElementById('drill_duenger').value = '2000';
      w.document.getElementById('drill_hektar').value = '4.5';
      w.drillMachineAdd();

      expect(w.state.machineLog.length).toBe(1);
      expect(w.state.reiter[0].entries.length).toBe(1);

      // The single entry must carry the full user-typed values (NOT divided).
      expect(w.state.machineLog[0].einheit).toBe(2000);
      expect(w.state.machineLog[0].duenger).toBe(2000);
      expect(w.state.reiter[0].entries[0].einheit).toBe(2000);
      expect(w.state.reiter[0].entries[0].duenger).toBe(2000);
    });

    it('two clicks → exactly two entries (each click is one entry)', () => {
      w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, duenger: 150, entries: [] };
      w.state.machineLog = [];
      w.state.activeReiter = 0;

      w.document.getElementById('drill_einheit').value = '5';
      w.document.getElementById('drill_duenger').value = '200';
      w.document.getElementById('drill_hektar').value = '3';
      w.drillMachineAdd();

      w.document.getElementById('drill_einheit').value = '7';
      w.document.getElementById('drill_duenger').value = '300';
      w.document.getElementById('drill_hektar').value = '6';
      w.drillMachineAdd();

      expect(w.state.machineLog.length).toBe(2);
      expect(w.state.reiter[0].entries.length).toBe(2);
      expect(w.state.machineLog[0].einheit).toBe(5);
      expect(w.state.machineLog[1].einheit).toBe(7);
    });

    it('dünger-only fill (einheit=0, duenger=2000) → one entry, not 2000 phantom entries', () => {
      // User reported scenario: only Dünger-Wert typed, Einheiten-Feld leer.
      // Pre-#313 bug: parseInt('') || 1 = 1 (worked here), but if user typed
      // any number in drill_einheit we'd get N entries.
      w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, duenger: 150, entries: [] };
      w.state.machineLog = [];
      w.state.activeReiter = 0;

      w.document.getElementById('drill_einheit').value = '1333';
      w.document.getElementById('drill_duenger').value = '1333,33';
      w.document.getElementById('drill_hektar').value = '0';
      w.drillMachineAdd();

      expect(w.state.machineLog.length).toBe(1);
      expect(w.state.reiter[0].entries.length).toBe(1);
      // Critical: einheit must be 1333 (full value), not 1333/1333 = 1.
      expect(w.state.reiter[0].entries[0].einheit).toBe(1333);
      expect(w.state.reiter[0].entries[0].duenger).toBeCloseTo(1333.33, 2);
    });
  });
});
