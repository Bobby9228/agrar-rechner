/**
 * Test 21: Multi-tab drill distribution
 * Covers: renderDrillTabList, drillCalcAll, drillAdd (multi-tab mode), drillMachineRemove
 */
import { describe, it, expect, vi } from 'vitest';
import { createDom } from './helpers.js';

function setupMultiTab(w) {
  // Add 3 tabs with data
  w.addReiter(); // tab 1 already exists
  w.addReiter(); // tab 2
  w.state.reiter[0].hektar = 10;
  w.state.reiter[0].koerner = 90000;
  w.state.reiter[0].duenger = 150;
  w.state.reiter[0].entries = [];
  w.state.reiter[1].hektar = 8;
  w.state.reiter[1].koerner = 85000;
  w.state.reiter[1].duenger = 140;
  w.state.reiter[1].entries = [];
  w.state.reiter[2].hektar = 5;
  w.state.reiter[2].koerner = 80000;
  w.state.reiter[2].duenger = 120;
  w.state.reiter[2].entries = [];
  w.saveState();
}

describe('renderDrillTabList', () => {
  it('creates priority buttons and input fields for each tab', () => {
    const { window: w } = createDom();
    setupMultiTab(w);
    w.renderDrillTabList();

    const container = w.document.getElementById('drill_tab_list');
    expect(container.children.length).toBe(3);

    // Each row has a prio button
    expect(w.document.getElementById('dtl_prio_0')).toBeTruthy();
    expect(w.document.getElementById('dtl_prio_1')).toBeTruthy();
    expect(w.document.getElementById('dtl_prio_2')).toBeTruthy();
    expect(w.document.getElementById('dtl_e_0')).toBeTruthy();
    expect(w.document.getElementById('dtl_d_0')).toBeTruthy();
  });

  it('priority button cycles from off → 1 → 2 → 3 → off (3 tabs)', () => {
    const { window: w } = createDom();
    setupMultiTab(w);
    w.renderDrillTabList();

    const btn = w.document.getElementById('dtl_prio_0');
    expect(btn.textContent).toBe('—');
    expect(btn.getAttribute('data-prio')).toBe('0');

    btn.click();
    expect(btn.textContent).toBe('1');
    expect(btn.getAttribute('data-prio')).toBe('1');

    btn.click();
    expect(btn.textContent).toBe('2');
    expect(btn.getAttribute('data-prio')).toBe('2');

    btn.click();
    expect(btn.textContent).toBe('3');
    expect(btn.getAttribute('data-prio')).toBe('3');

    // Cycle back to off (maxPrio = 3, so 3 >= 3 → reset to 0)
    btn.click();
    expect(btn.textContent).toBe('—');
    expect(btn.getAttribute('data-prio')).toBe('0');
  });

  it('shows remaining need for each tab', () => {
    const { window: w } = createDom();
    setupMultiTab(w);
    w.renderDrillTabList();

    const need0 = w.document.getElementById('dtl_need_0');
    expect(need0).toBeTruthy();
    expect(need0.textContent).toContain('Einheiten');
    expect(need0.textContent).toContain('kg Dünger');
  });

  it('shows "fertig" when tab has enough entries', () => {
    const { window: w } = createDom();
    setupMultiTab(w);
    // Fill tab 2 completely: 5ha * 80000 / 50000 = 8 einheiten
    w.state.reiter[2].entries.push({
      einheit: 8, duenger: 600, zaehlerStand: 5, time: '10:00'
    });
    w.renderDrillTabList();

    const need2 = w.document.getElementById('dtl_need_2');
    expect(need2.textContent).toContain('fertig');
    expect(need2.classList.contains('done')).toBe(true);
  });

  it('persists drillPriorities across renders (no reset on re-render)', () => {
    const { window: w } = createDom();
    setupMultiTab(w);
    w.renderDrillTabList();

    const btn = w.document.getElementById('dtl_prio_0');
    btn.click(); // set prio to 1
    expect(w.state.drillPriorities[0]).toBe(1);

    // Re-render does NOT reset — priorities persist
    w.renderDrillTabList();
    expect(w.state.drillPriorities[0]).toBe(1);
  });

  it('does nothing if drill_tab_list container is missing', () => {
    const { window: w } = createDom();
    const container = w.document.getElementById('drill_tab_list');
    container.remove();
    // Should not throw
    expect(() => w.renderDrillTabList()).not.toThrow();
  });
});

describe('drillCalcAll', () => {
  it('distributes total to highest priority tab first', () => {
    const { window: w } = createDom();
    setupMultiTab(w);
    w.renderDrillTabList();

    // Set priority: tab 0 = 1, tab 1 = 2 (tab 0 gets filled first)
    const btn0 = w.document.getElementById('dtl_prio_0');
    const btn1 = w.document.getElementById('dtl_prio_1');
    btn0.click(); // prio 1
    btn1.click(); // prio 1 → will be set after btn0

    // Set global amounts
    w.document.getElementById('drill_einheit').value = '5';
    w.document.getElementById('drill_duenger').value = '500';

    w.drillCalcAll();

    // Tab 0 needs 10*90000/50000 = 18 einheiten → gets min(18, 5) = 5
    expect(w.document.getElementById('dtl_e_0').value).toBe('5,0');
    // Tab 1 needs 8*85000/50000 = 13.6 → but no remainder → gets 0
    expect(w.document.getElementById('dtl_e_1').value).toBe('');
  });

  it('distributes remaining to second priority tab', () => {
    const { window: w } = createDom();
    setupMultiTab(w);
    w.renderDrillTabList();

    // Issue #264: Prio 1 = highest priority. Tab 0 = prio 1 (higher), Tab 1 = prio 2 (lower) — fill tab 0 first
    const btn0 = w.document.getElementById('dtl_prio_0');
    btn0.click(); // prio 1
    const btn1 = w.document.getElementById('dtl_prio_1');
    btn1.click(); // prio 1
    btn1.click(); // prio 2

    // Tab 0 needs 18 einheiten, give 20 total → gets 18 first
    w.document.getElementById('drill_einheit').value = '20';
    w.document.getElementById('drill_duenger').value = '0';

    w.drillCalcAll();

    // Tab 0 (prio 1 = highest) needs 18 → gets min(18, 20) = 18
    expect(w.document.getElementById('dtl_e_0').value).toBe('18,0');
    // Tab 1 (prio 2) needs 13.6 → gets min(13.6, 20-18=2) = 2
    expect(w.document.getElementById('dtl_e_1').value).toBe('2,0');
  });

  it('clears inputs for unprioritized tabs', () => {
    const { window: w } = createDom();
    setupMultiTab(w);
    w.renderDrillTabList();

    w.document.getElementById('drill_einheit').value = '5';
    w.drillCalcAll();

    // Tab 2 has no priority → inputs should be empty
    expect(w.document.getElementById('dtl_e_2').value).toBe('');
    expect(w.document.getElementById('dtl_d_2').value).toBe('');
  });
});

describe('drillAdd multi-tab mode', () => {
  it('adds entries to prioritized tabs and creates machine log', () => {
    const { window: w } = createDom();
    setupMultiTab(w);
    w.renderDrillTabList();

    // Set priorities: tab 0 = 1
    w.document.getElementById('dtl_prio_0').click();

    // Set per-tab input
    w.document.getElementById('dtl_e_0').value = '4';
    w.document.getElementById('dtl_d_0').value = '300';
    // Global inputs
    w.document.getElementById('drill_einheit').value = '4';
    w.document.getElementById('drill_duenger').value = '300';
    w.document.getElementById('drill_hektar').value = '3,5';

    w.drillAdd();

    // Tab 0 should have the entry
    expect(w.state.reiter[0].entries.length).toBe(1);
    expect(w.state.reiter[0].entries[0].einheit).toBe(4);
    expect(w.state.reiter[0].entries[0].duenger).toBe(300);
    expect(w.state.reiter[0].entries[0].zaehlerStand).toBe(3.5);

    // Machine log should have entry
    expect(w.state.machineLog.length).toBe(1);
    expect(w.state.machineLog[0].einheit).toBe(4);

    // Inputs should be cleared
    expect(w.document.getElementById('drill_einheit').value).toBe('');
    expect(w.document.getElementById('drill_duenger').value).toBe('');
    expect(w.document.getElementById('drill_hektar').value).toBe('');
  });

  it('skips tabs with no einheit or duenger', () => {
    const { window: w } = createDom();
    setupMultiTab(w);
    w.renderDrillTabList();

    // Prioritize tab 0 and tab 1
    w.document.getElementById('dtl_prio_0').click();
    w.document.getElementById('dtl_prio_1').click();

    // Only give values to tab 0
    w.document.getElementById('dtl_e_0').value = '3';
    w.document.getElementById('dtl_d_0').value = '';
    // Tab 1 gets nothing
    w.document.getElementById('drill_einheit').value = '3';
    w.document.getElementById('drill_duenger').value = '0';

    w.drillAdd();

    expect(w.state.reiter[0].entries.length).toBe(1);
    expect(w.state.reiter[1].entries.length).toBe(0); // skipped
    expect(w.state.machineLog.length).toBe(1);
  });

  it('re-renders drill tab list after add and clears priorities', () => {
    const { window: w } = createDom();
    setupMultiTab(w);
    w.renderDrillTabList();

    w.document.getElementById('dtl_prio_0').click();
    w.document.getElementById('dtl_e_0').value = '2';
    w.document.getElementById('drill_einheit').value = '2';

    w.drillAdd();

    // Priorities persist after drillAdd (bug #146)
    expect(w.state.drillPriorities[0]).toBe(1);
    // renderDrillTabList re-reads from drillPriorities (still set) → data-prio='1'
    const btn = w.document.getElementById('dtl_prio_0');
    expect(btn.getAttribute('data-prio')).toBe('1');
    expect(btn.textContent).toBe('1');
  });

  it('does nothing if no tab has einheit or duenger > 0', () => {
    const { window: w } = createDom();
    setupMultiTab(w);
    w.renderDrillTabList();

    w.document.getElementById('dtl_prio_0').click();
    w.document.getElementById('drill_einheit').value = '5';
    // Per-tab inputs are empty
    w.document.getElementById('drill_hektar').value = '2';

    w.drillAdd();

    // FIX: function returns early, no machineLog entry created
    expect(w.state.machineLog.length).toBe(0);
  });

  it('distributes across multiple prioritized tabs', () => {
    const { window: w } = createDom();
    setupMultiTab(w);
    w.renderDrillTabList();

    // Prioritize all 3 tabs
    w.document.getElementById('dtl_prio_0').click(); // prio 1
    w.document.getElementById('dtl_prio_1').click(); // prio 1
    w.document.getElementById('dtl_prio_1').click(); // prio 2
    w.document.getElementById('dtl_prio_2').click(); // prio 1
    w.document.getElementById('dtl_prio_2').click(); // prio 2
    w.document.getElementById('dtl_prio_2').click(); // prio 3

    // Set per-tab values
    w.document.getElementById('dtl_e_0').value = '5';
    w.document.getElementById('dtl_d_0').value = '400';
    w.document.getElementById('dtl_e_1').value = '3';
    w.document.getElementById('dtl_d_1').value = '200';
    w.document.getElementById('dtl_e_2').value = '2';
    w.document.getElementById('dtl_d_2').value = '150';

    w.document.getElementById('drill_einheit').value = '10';
    w.document.getElementById('drill_duenger').value = '750';
    w.document.getElementById('drill_hektar').value = '5';

    w.drillAdd();

    expect(w.state.reiter[0].entries.length).toBe(1);
    expect(w.state.reiter[0].entries[0].einheit).toBe(5);
    expect(w.state.reiter[1].entries.length).toBe(1);
    expect(w.state.reiter[1].entries[0].einheit).toBe(3);
    expect(w.state.reiter[2].entries.length).toBe(1);
    expect(w.state.reiter[2].entries[0].einheit).toBe(2);
  });

  // ── Ghost-entry bug: machineLog gets entry even when all prio=0 and no values ──

  it('BUG: machineLog gets ghost entry when all tabs have prio 0 (ghost-entry bug #73)', () => {
    const { window: w } = createDom();
    setupMultiTab(w);
    w.renderDrillTabList();

    // All tabs stay at prio 0 (—), no per-tab values entered
    w.document.getElementById('drill_einheit').value = '5';
    w.document.getElementById('drill_duenger').value = '300';
    w.document.getElementById('drill_hektar').value = '2';

    w.drillAdd();

    // FIX: no ghost entry — function returns early before machineLog push
    expect(w.state.machineLog.length).toBe(0);
    // No tab entries were created
    expect(w.state.reiter[0].entries.length).toBe(0);
    expect(w.state.reiter[1].entries.length).toBe(0);
    expect(w.state.reiter[2].entries.length).toBe(0);
  });

  it('BUG: ghost entry also appears when per-tab values are 0 even with prio set', () => {
    const { window: w } = createDom();
    setupMultiTab(w);
    w.renderDrillTabList();

    // Tab 0 gets prio 1 but no einheit/duenger values
    w.document.getElementById('dtl_prio_0').click();
    w.document.getElementById('drill_einheit').value = '5';
    w.document.getElementById('drill_duenger').value = '0';
    // Per-tab fields are empty
    w.document.getElementById('dtl_e_0').value = '';
    w.document.getElementById('dtl_d_0').value = '';

    w.drillAdd();

    // FIX: no ghost entry — function returns early before machineLog push
    expect(w.state.machineLog.length).toBe(0);
  });

  // ── Carryover in multi-tab drillAdd ─────────────────────────────────────────

  it('drillCalcAll uses carryover when distributing to prioritized tabs', () => {
    const { window: w } = createDom();
    setupMultiTab(w);
    // Tab 0 used 5 units out of 18 SOLL → 13 remaining
    w.state.reiter[0].entries.push({ einheit: 5, duenger: 0, zaehlerStand: 2.78, time: '09:00' });
    // Tab 1 used 10 units out of 13.6 SOLL → 3.6 remaining
    w.state.reiter[1].entries.push({ einheit: 10, duenger: 0, zaehlerStand: 5.88, time: '09:00' });

    w.renderDrillTabList();

    // Issue #264: Prio 1 = highest priority. Tab 0 = prio 1 (highest), Tab 1 = prio 2 (second)
    w.document.getElementById('dtl_prio_0').click(); // prio 1
    w.document.getElementById('dtl_prio_1').click(); // prio 1
    w.document.getElementById('dtl_prio_1').click(); // prio 2

    // Fill 16.6 units (more than tab 0 remaining of 13, fills tab 1 with the rest)
    w.document.getElementById('drill_einheit').value = '16,6';
    w.document.getElementById('drill_duenger').value = '0';

    w.drillCalcAll();

    // Tab 0 (prio 1 = highest) needs 13 → gets min(13, 16.6) = 13
    expect(w.document.getElementById('dtl_e_0').value).toBe('13,0');
    // Tab 1 (prio 2) needs 3.6 → gets min(3.6, 16.6-13=3.6) = 3.6
    expect(w.document.getElementById('dtl_e_1').value).toBe('3,6');
  });

  // ── machineLog with multiple tabs ────────────────────────────────────────────

  it('drillAdd creates one machineLog entry with correct raw values', () => {
    const { window: w } = createDom();
    setupMultiTab(w);
    w.renderDrillTabList();

    w.document.getElementById('dtl_prio_0').click();
    w.document.getElementById('dtl_e_0').value = '4';
    w.document.getElementById('dtl_d_0').value = '200';
    w.document.getElementById('drill_einheit').value = '4';
    w.document.getElementById('drill_duenger').value = '200';
    w.document.getElementById('drill_hektar').value = '2';

    w.drillAdd();

    expect(w.state.machineLog.length).toBe(1);
    expect(w.state.machineLog[0].einheit).toBe(4);
    expect(w.state.machineLog[0].duenger).toBe(200);
    expect(w.state.machineLog[0].zaehlerStand).toBe(2);
    expect(w.state.machineLog[0].distributed).toBe(4);
  });

  it('drillAdd links tab entries to machineLog via mlIdx', () => {
    const { window: w } = createDom();
    setupMultiTab(w);
    w.renderDrillTabList();

    w.document.getElementById('dtl_prio_0').click();
    w.document.getElementById('dtl_e_0').value = '3';
    w.document.getElementById('drill_einheit').value = '3';
    w.document.getElementById('drill_hektar').value = '1,5';

    w.drillAdd();

    // Entry should be linked to machineLog index 0
    expect(w.state.reiter[0].entries[0].mlIdx).toBe(0);
    expect(w.state.reiter[0].entries[0].zaehlerStand).toBe(1.5);
  });

  it('drillAdd distributes remaining units to machineLog when nothing entered', () => {
    const { window: w } = createDom();
    setupMultiTab(w);
    w.renderDrillTabList();

    // No prio, no values, but global inputs filled
    w.document.getElementById('drill_einheit').value = '7';
    w.document.getElementById('drill_duenger').value = '350';
    w.document.getElementById('drill_hektar').value = '4';

    w.drillAdd();

    // FIX (ghost-entry): machineLog gets NO entry when all tabs have prio 0
    expect(w.state.machineLog.length).toBe(0);
    // All tabs should be empty
    expect(w.state.reiter[0].entries.length).toBe(0);
    expect(w.state.reiter[1].entries.length).toBe(0);
    expect(w.state.reiter[2].entries.length).toBe(0);
  });
});

describe('drillMachineRemove', () => {
  it('removes entry from machineLog at given index', () => {
    const { window: w } = createDom();
    w.state.machineLog = [
      { einheit: 4, duenger: 200, zaehlerStand: 3, time: '10:00' },
      { einheit: 3, duenger: 150, zaehlerStand: 6, time: '11:00' },
    ];
    w.saveState();

    w.drillMachineRemove(0);

    expect(w.state.machineLog.length).toBe(1);
    expect(w.state.machineLog[0].einheit).toBe(3);
  });

  it('does nothing for negative index', () => {
    const { window: w } = createDom();
    w.state.machineLog = [
      { einheit: 4, duenger: 200, zaehlerStand: 3, time: '10:00' },
    ];
    w.drillMachineRemove(-1);
    expect(w.state.machineLog.length).toBe(1);
  });

  it('does nothing for out-of-bounds index', () => {
    const { window: w } = createDom();
    w.state.machineLog = [
      { einheit: 4, duenger: 200, zaehlerStand: 3, time: '10:00' },
    ];
    w.drillMachineRemove(5);
    expect(w.state.machineLog.length).toBe(1);
  });

  it('does nothing when machineLog is empty', () => {
    const { window: w } = createDom();
    w.state.machineLog = [];
    expect(() => w.drillMachineRemove(0)).not.toThrow();
    expect(w.state.machineLog.length).toBe(0);
  });
});

describe('drillPriorities persistence', () => {
  it('persists priorities to localStorage on change', () => {
    const { window: w, store } = createDom();
    setupMultiTab(w);
    w.renderDrillTabList();

    w.document.getElementById('dtl_prio_0').click();
    expect(w.state.drillPriorities[0]).toBe(1);

    // Saved to localStorage
    const saved = JSON.parse(store['agrar_rechner']);
    expect(saved.drillPriorities[0]).toBe(1);
  });

  it('survives page reload (lv() restores drillPriorities from localStorage)', () => {
    const { window: w, store } = createDom();
    setupMultiTab(w);
    w.renderDrillTabList();

    // Set priorities
    w.document.getElementById('dtl_prio_0').click(); // tab 0 = prio 1
    w.document.getElementById('dtl_prio_1').click(); // tab 1 = prio 1
    expect(w.state.drillPriorities[0]).toBe(1);
    expect(w.state.drillPriorities[1]).toBe(1);

    // Simulate page reload: lv() is called which rehydrates state
    w.loadState();

    // Priorities restored from localStorage
    expect(w.state.drillPriorities[0]).toBe(1);
    expect(w.state.drillPriorities[1]).toBe(1);
  });

  it('lv() initializes drillPriorities to {} if missing in saved state', () => {
    const { window: w, store } = createDom();
    // Manually put a state without drillPriorities in localStorage
    store['agrar_rechner'] = JSON.stringify({
      reiter: [{ name: 'Tab 1', hektar: 10, koerner: 90000, duenger: 0, entries: [] }],
      activeReiter: 0,
      machineLog: [],
      zaehlerstand: 0
    });

    w.loadState();

    // Should default to {}
    expect(w.state.drillPriorities).toEqual({});
    expect(w.state.drillPriorities).toEqual({});
  });
});
