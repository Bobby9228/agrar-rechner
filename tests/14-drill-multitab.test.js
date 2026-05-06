/**
 * Tests for multi-tab drill protocol: renderDrillTabList, drillCalcAll, drillAdd with priorities.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('renderDrillTabList', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('renders a row per tab', () => {
    w.addReiter();
    w.renderDrillTabList();
    var rows = w.document.getElementById('drill_tab_list').querySelectorAll('.drill-tab-row');
    expect(rows.length).toBe(2);
  });

  it('renders priority button for each tab', () => {
    w.renderDrillTabList();
    var prios = w.document.getElementById('drill_tab_list').querySelectorAll('.drill-prio-btn');
    expect(prios.length).toBe(1);
    expect(prios[0].textContent).toBe('—');
  });

  it('renders einheit and duenger inputs for each tab', () => {
    w.renderDrillTabList();
    var eInput = w.document.getElementById('dtl_e_0');
    var dInput = w.document.getElementById('dtl_d_0');
    expect(eInput).toBeTruthy();
    expect(dInput).toBeTruthy();
  });

  it('shows tab name', () => {
    w.renderDrillTabList();
    var name = w.document.getElementById('drill_tab_list').querySelector('.drill-tab-name');
    expect(name.textContent).toBe('Tab 1');
  });

  it('shows "fertig" when tab is completely drilled', () => {
    w.state.reiter[0] = { name: 'Tab 1', hektar: 10, koerner: 90000, duenger: 0, entries: [
      { einheit: 18, duenger: 0, hektar: 10, time: '12:00' }
    ]};
    w.renderDrillTabList();
    var need = w.document.getElementById('dtl_need_0');
    expect(need.textContent).toContain('fertig');
    expect(need.classList.contains('done')).toBe(true);
  });

  it('shows remaining need when partially drilled', () => {
    w.state.reiter[0] = { name: 'Tab 1', hektar: 10, koerner: 90000, duenger: 150, entries: [
      { einheit: 5, duenger: 500, hektar: 3, time: '12:00' }
    ]};
    w.renderDrillTabList();
    var need = w.document.getElementById('dtl_need_0');
    expect(need.textContent).toContain('braucht');
    expect(need.textContent).toContain('Einheiten');
  });

  it('does not show need when tab has no data', () => {
    w.renderDrillTabList();
    var need = w.document.getElementById('dtl_need_0');
    expect(need).toBeNull();
  });

  it('clears innerHTML on re-render', () => {
    w.renderDrillTabList();
    w.renderDrillTabList();
    var rows = w.document.getElementById('drill_tab_list').querySelectorAll('.drill-tab-row');
    expect(rows.length).toBe(1);
  });
});

describe('drillCalcAll (priority distribution)', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  function setupMultiTab() {
    w.state.reiter = [
      { name: 'A', hektar: 10, koerner: 90000, duenger: 150, entries: [] },
      { name: 'B', hektar: 5, koerner: 80000, duenger: 100, entries: [] },
    ];
    w.state.activeReiter = 0;
    w.renderDrillTabList();
    // Priorities direkt setzen und DOM neu bauen
    w.state.drillPriorities[0] = 2;
    w.state.drillPriorities[1] = 1;
    w.renderDrillTabList(); // DOM mit korrekten data-prio Werten aktualisieren
  }

  it('distributes to highest priority tab first', () => {
    setupMultiTab();
    // Tab 0 needs 18 Einheiten (10*90000/50000), Tab 1 needs 8 (5*80000/50000)
    w.document.getElementById('drill_einheit').value = '20';
    w.document.getElementById('drill_duenger').value = '0';

    w.drillCalcAll();

    var eA = w.document.getElementById('dtl_e_0');
    var eB = w.document.getElementById('dtl_e_1');
    // Tab A needs 18, gets min(18, 20) = 18
    expect(w.parseDE(eA.value)).toBeCloseTo(18);
    // Tab B needs 8, gets min(8, 20-18=2) = 2
    expect(w.parseDE(eB.value)).toBeCloseTo(2);
  });

  it('distributes duenger similarly', () => {
    setupMultiTab();
    // Tab A needs 1500 kg (10*150), Tab B needs 500 kg (5*100)
    w.document.getElementById('drill_einheit').value = '0';
    w.document.getElementById('drill_duenger').value = '1800';

    w.drillCalcAll();

    var dA = w.document.getElementById('dtl_d_0');
    var dB = w.document.getElementById('dtl_d_1');
    // Tab A gets min(1500, 1800) = 1500
    expect(w.parseDE(dA.value)).toBeCloseTo(1500);
    // Tab B gets min(500, 1800-1500=300) = 300
    expect(w.parseDE(dB.value)).toBeCloseTo(300);
  });

  it('skips tabs with no priority', () => {
    setupMultiTab();
    w.document.getElementById('drill_einheit').value = '5';
    w.document.getElementById('drill_duenger').value = '0';

    w.state.drillPriorities[0] = 0; // no priority
    w.state.drillPriorities[1] = 1;
    w.drillCalcAll();

    var eA = w.document.getElementById('dtl_e_0');
    var eB = w.document.getElementById('dtl_e_1');
    expect(eA.value).toBe('');
    expect(w.parseDE(eB.value)).toBeCloseTo(5);
  });

  it('clears inputs for non-prioritized tabs', () => {
    setupMultiTab();
    w.document.getElementById('drill_einheit').value = '10';
    w.document.getElementById('drill_duenger').value = '0';

    w.state.drillPriorities[0] = 1;
    // Tab 1 has no priority
    w.drillCalcAll();

    var eB = w.document.getElementById('dtl_e_1');
    expect(eB.value).toBe('');
  });

  it('handles zero total einheit and duenger', () => {
    setupMultiTab();
    w.document.getElementById('drill_einheit').value = '0';
    w.document.getElementById('drill_duenger').value = '0';

    w.state.drillPriorities[0] = 1;
    w.drillCalcAll();

    var eA = w.document.getElementById('dtl_e_0');
    expect(eA.value).toBe('');
  });
});

describe('drillAdd multi-tab mode', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  function setupMultiTabWithPrio() {
    w.state.reiter = [
      { name: 'A', hektar: 10, koerner: 90000, duenger: 150, entries: [] },
      { name: 'B', hektar: 5, koerner: 80000, duenger: 100, entries: [] },
    ];
    w.state.activeReiter = 0;
    w.state.drillPriorities[0] = 1;
    w.state.drillPriorities[1] = 2;
    w.renderDrillTabList(); // DOM mit korrekten data-prio Werten aufbauen
  }

  it('adds entries to prioritized tabs', () => {
    setupMultiTabWithPrio();
    // Tab B prio=2 (high), Tab A prio=1 (low)
    // Total: 20 Einheiten, Tab B needs 8, Tab A needs 18
    w.document.getElementById('drill_einheit').value = '15';
    w.document.getElementById('drill_duenger').value = '0';

    w.drillCalcAll(); // distribute
    w.drillAdd();

    // Tab B gets min(8, 15) = 8
    expect(w.state.reiter[1].entries.length).toBe(1);
    expect(w.state.reiter[1].entries[0].einheit).toBeCloseTo(8);
    // Tab A gets min(18, 15-8=7) = 7
    expect(w.state.reiter[0].entries.length).toBe(1);
    expect(w.state.reiter[0].entries[0].einheit).toBeCloseTo(7);
  });

  it('records machineLog entry', () => {
    setupMultiTabWithPrio();
    w.document.getElementById('drill_einheit').value = '10';
    w.document.getElementById('drill_duenger').value = '0';

    w.drillCalcAll();
    w.drillAdd();

    expect(w.state.machineLog.length).toBe(1);
    expect(w.state.machineLog[0].einheit).toBeCloseTo(10);
  });

  it('clears inputs after adding', () => {
    setupMultiTabWithPrio();
    w.document.getElementById('drill_einheit').value = '10';
    w.document.getElementById('drill_duenger').value = '500';

    w.drillCalcAll();
    w.drillAdd();

    expect(w.document.getElementById('drill_einheit').value).toBe('');
    expect(w.document.getElementById('drill_duenger').value).toBe('');
    expect(w.document.getElementById('drill_hektar').value).toBe('');
  });

  it('resets priorities after adding', () => {
    setupMultiTabWithPrio();
    w.document.getElementById('drill_einheit').value = '10';
    w.document.getElementById('drill_duenger').value = '0';

    w.drillCalcAll();
    w.drillAdd();

    expect(Object.keys(w.state.drillPriorities).length).toBe(0);
  });

  it('does nothing when no prioritized tabs have values', () => {
    setupMultiTabWithPrio();
    w.document.getElementById('drill_einheit').value = '0';
    w.document.getElementById('drill_duenger').value = '0';
    w.state.drillPriorities = {}; // no priorities
    w.drillAdd();
    expect(w.state.reiter[0].entries.length).toBe(0);
    expect(w.state.reiter[1].entries.length).toBe(0);
  });
});

describe('priority button cycling', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('cycles through priority values on click', () => {
    w.renderDrillTabList();
    var prioBtn = w.document.getElementById('dtl_prio_0');
    expect(prioBtn.getAttribute('data-prio')).toBe('0');
    expect(prioBtn.textContent).toBe('—');

    // Click once → prio 1
    prioBtn.onclick();
    expect(prioBtn.getAttribute('data-prio')).toBe('1');
    expect(prioBtn.textContent).toBe('1');
    expect(prioBtn.classList.contains('active')).toBe(true);

    // Click again → prio 2 (but maxPrio=1 since only 1 tab, so cycles to 0)
    prioBtn.onclick();
    // With 1 tab, maxPrio=1, so 1 >= 1 → cycles to 0
    expect(prioBtn.getAttribute('data-prio')).toBe('0');
    expect(prioBtn.textContent).toBe('—');
  });

  it('cycles 0→1→2→3→0 with 3 tabs', () => {
    w.addReiter();
    w.addReiter();
    w.renderDrillTabList();
    var prioBtn = w.document.getElementById('dtl_prio_0');

    prioBtn.onclick(); // 0→1
    expect(prioBtn.getAttribute('data-prio')).toBe('1');
    prioBtn.onclick(); // 1→2
    expect(prioBtn.getAttribute('data-prio')).toBe('2');
    prioBtn.onclick(); // 2→3
    expect(prioBtn.getAttribute('data-prio')).toBe('3');
    prioBtn.onclick(); // 3 → maxPrio=3 → 0
    expect(prioBtn.getAttribute('data-prio')).toBe('0');
  });
});
