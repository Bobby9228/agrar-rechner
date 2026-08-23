/**
 * Multi-Tab Drill-Verteilung.
 *
 * _calcDrillDistribution(einheit, duenger) plant die Verteilung einer
 * Maschinenfüllung auf mehrere priorisierte Tabs. Saat und Dünger folgen
 * seit #329 (PR #380) derselben Prio-Cap-Logik: tabDRem/SaatRem = max(0,
 * SOLL - used) je Tab, gefolgt von FIFO-Befüllung in Prio-Reihenfolge.
 *
 * renderDrillTabList ist NaN-frei: fehlende e.einheit-Felder dürfen nicht
 * zu NaN im DOM führen. _buildDrillEntry bewahrt kleine Saat-Mengen
 * (≥ 0,0005 E) statt sie auf 0 zu runden.
 *
 * Zugehörige frühere Dateien: tests/drill-distribution.test.js,
 * tests/drill-distribution.test.js,
 tests/drill-distribution.test.js (Issue #419 Welle 2).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDom } from './helpers.js';

describe('new field default drill priority', () => {
  it('assigns priority 1 to a newly added field', () => {
    const { window: w } = createDom();

    w.addReiter();

    expect(w.state.drillPriorities[1]).toBe(1);
  });
});

function setupMultiTab(w) {
  // Add 3 tabs with data
  w.addReiter(); // tab 1 already exists
  w.addReiter(); // tab 2
  // Die folgenden Verteilungstests bauen ihre Prioritätsreihenfolge explizit
  // auf und starten daher bewusst ohne die Produkt-Standardpriorität.
  w.state.drillPriorities = {};
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

describe('drillCalcAll (priority distribution)', () => {
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
    expect(w.document.getElementById('dtl_e_0').value).toBe('5,000');
    // Tab 1 needs 8*85000/50000 = 13.6 → but no remainder → gets 0
    expect(w.document.getElementById('dtl_e_1').value).toBe('');
  });

  it('distributes duenger like Saat (symmetric, Issue #329): Prio-cap per Tab', () => {
    const { window: w } = createDom();
    setupMultiTab(w);
    // Tab 0 needs 1500 kg (10*150), Tab 1 needs 1120 kg (8*140).
    // Set priorities: Tab 0 = 1, Tab 1 = 2 → Tab 0 takes its full need first.
    w.state.drillPriorities[0] = 1;
    w.state.drillPriorities[1] = 2;
    w.renderDrillTabList();
    w.document.getElementById('drill_einheit').value = '0';
    w.document.getElementById('drill_duenger').value = '1800';

    w.drillCalcAll();

    var dA = w.document.getElementById('dtl_d_0');
    var dB = w.document.getElementById('dtl_d_1');
    // Symmetrisch zu Saat-Pfad: Tab 0 nimmt min(remD, tabDRem=1500)=1500,
    // Rest 300 geht zu Tab 1 (cap=1120) → Tab 1 = 300. Siehe tests/drill-distribution.test.js.
    expect(w.parseDE(dA.value)).toBeCloseTo(1500);
    expect(w.parseDE(dB.value)).toBeCloseTo(300);
  });

  it('skips tabs with no priority', () => {
    const { window: w } = createDom();
    setupMultiTab(w);
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
    const { window: w } = createDom();
    setupMultiTab(w);
    w.document.getElementById('drill_einheit').value = '10';
    w.document.getElementById('drill_duenger').value = '0';

    w.state.drillPriorities[0] = 1;
    // Tab 1 has no priority
    w.drillCalcAll();

    var eB = w.document.getElementById('dtl_e_1');
    expect(eB.value).toBe('');
  });

  it('handles zero total einheit and duenger', () => {
    const { window: w } = createDom();
    setupMultiTab(w);
    w.document.getElementById('drill_einheit').value = '0';
    w.document.getElementById('drill_duenger').value = '0';

    w.state.drillPriorities[0] = 1;
    w.drillCalcAll();

    var eA = w.document.getElementById('dtl_e_0');
    expect(eA.value).toBe('');
  });

  it('handles empty drill_duenger', () => {
    const { window: w } = createDom();
    setupMultiTab(w);
    w.document.getElementById('drill_einheit').value = '5';
    w.document.getElementById('drill_duenger').value = '';

    w.state.drillPriorities[0] = 1;
    w.drillCalcAll();

    var eA = w.document.getElementById('dtl_e_0');
    expect(eA.value).toBe('5,000');
    var dA = w.document.getElementById('dtl_d_0');
    expect(dA.value).toBe('');
  });

  it('writes empty for tabs with no priority', () => {
    const { window: w } = createDom();
    setupMultiTab(w);
    w.document.getElementById('drill_einheit').value = '10';
    w.document.getElementById('drill_duenger').value = '';

    w.state.drillPriorities[0] = 1;
    w.drillCalcAll();

    expect(w.document.getElementById('dtl_e_0').value).toBe('10,000');
    expect(w.document.getElementById('dtl_e_1').value).toBe('');
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

  // ── Carryover in multi-tab drillAdd ──────────────────────────────────────────

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
    expect(w.document.getElementById('dtl_e_0').value).toBe('13,000');
    // Tab 1 (prio 2) needs 3.6 → gets min(3.6, 16.6-13=3.6) = 3.6
    expect(w.document.getElementById('dtl_e_1').value).toBe('3,600');
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

// ── Task 1 (Präzisions-Fix Folgefix): kleine Saatmengen ──────────────────────
//
// Vor 507142b/2be0499 wurden Saat-Mengen unter EPSILON_QUANTITY (0,05 E)
// komplett verworfen und entry.einheit auf zwei Nachkommastellen gerundet.
// 0,040 E Saatgut verschwanden dadurch in drillCalcAll und 0,004 E wurden
// im Entry-Bau zu 0. Diese Tests dokumentieren den RED-Nachweis für den
// Fix (EPSILON_EINHEIT + round6 für Saat, EPSILON_QUANTITY bleibt für Dünger).

describe('kleine Saatmengen — Multi-Tab-Verteilung (Saat-Epsilon getrennt)', () => {
  it('_calcDrillDistribution: 0,040 Saat wird auf priorisierten Schlag verteilt', () => {
    const { window: w } = createDom();
    setupMultiTab(w);
    // Nur Tab 0 priorisieren
    w.state.drillPriorities = { 0: 1 };
    var plan = w._calcDrillDistribution(0.04, 0);
    // Saat-Epsilon ist 0,000499999 → 0,040 ist weit darüber und muss
    // vollständig auf Tab 0 (Rest 18 E) wandern.
    expect(plan[0].giveE).toBeCloseTo(0.04, 6);
    expect(plan[0].giveD).toBe(0);
    // Tab 1 hat keine Prio → nichts
    expect(plan[1].giveE).toBe(0);
    expect(plan[1].giveD).toBe(0);
    // Tab 2 hat keine Prio → nichts
    expect(plan[2].giveE).toBe(0);
  });

  it('drillCalcAll: 0,040 Saat füllt dtl_e_<i> mit 3 Nachkommastellen', () => {
    const { window: w } = createDom();
    setupMultiTab(w);
    w.renderDrillTabList();
    w.document.getElementById('dtl_prio_0').click();
    w.document.getElementById('drill_einheit').value = '0,040';
    w.document.getElementById('drill_duenger').value = '0';
    w.drillCalcAll();
    // 3 Nachkommastellen sichtbar in der UI, rawValue hält die 6-Stellen-Semantik
    expect(w.document.getElementById('dtl_e_0').value).toBe('0,040');
    expect(w.document.getElementById('dtl_e_0').dataset.rawValue).toBe('0.04');
    // Unpriorisierte Tabs bleiben leer
    expect(w.document.getElementById('dtl_e_1').value).toBe('');
    expect(w.document.getElementById('dtl_e_2').value).toBe('');
  });

  it('drillCalcAll: 0,004 Saat bleibt erhalten (über EPSILON_EINHEIT)', () => {
    const { window: w } = createDom();
    setupMultiTab(w);
    w.renderDrillTabList();
    w.document.getElementById('dtl_prio_0').click();
    w.document.getElementById('drill_einheit').value = '0,004';
    w.document.getElementById('drill_duenger').value = '0';
    w.drillCalcAll();
    expect(w.document.getElementById('dtl_e_0').value).toBe('0,004');
  });

  it('drillAdd: Multi-Tab mit 0,040 Saat bucht korrekt und legt machineLog an', () => {
    const { window: w } = createDom();
    setupMultiTab(w);
    w.renderDrillTabList();
    // Tab 0 priorisieren
    w.document.getElementById('dtl_prio_0').click();
    w.document.getElementById('drill_einheit').value = '0,040';
    w.document.getElementById('drill_duenger').value = '0';
    w.document.getElementById('drill_hektar').value = '1';
    // Verteilung anzeigen → dtl_e_0 = 0,040
    w.drillCalcAll();
    // Buchen
    w.drillAdd();
    // Tab 0 muss genau eine Buchung mit 0,040 tragen
    expect(w.state.reiter[0].entries.length).toBe(1);
    expect(w.state.reiter[0].entries[0].einheit).toBeCloseTo(0.04, 6);
    expect(w.state.reiter[0].entries[0].mlIdx).toBe(0);
    // machineLog muss genau eine Füllung mit 0,040 tragen
    expect(w.state.machineLog.length).toBe(1);
    expect(w.state.machineLog[0].einheit).toBeCloseTo(0.04, 6);
    // Σ der Schlagbuchungen entspricht der Maschinenfüllung (kein Verlust)
    var sumE = 0;
    for (var ti = 0; ti < w.state.reiter.length; ti++) {
      var ents = w.state.reiter[ti].entries || [];
      for (var ei = 0; ei < ents.length; ei++) sumE += ents[ei].einheit || 0;
    }
    expect(sumE).toBeCloseTo(0.04, 6);
  });

  it('drillAdd: 0,040 mit zwei priorisierten Schlägen landet vollständig auf Schlag 0', () => {
    const { window: w } = createDom();
    setupMultiTab(w);
    w.renderDrillTabList();
    // Tab 0 prio 1, Tab 1 prio 2
    w.document.getElementById('dtl_prio_0').click();
    w.document.getElementById('dtl_prio_1').click();
    w.document.getElementById('dtl_prio_1').click();
    w.document.getElementById('drill_einheit').value = '0,040';
    w.document.getElementById('drill_duenger').value = '0';
    w.document.getElementById('drill_hektar').value = '1';
    w.drillCalcAll();
    w.drillAdd();
    // Tab 0 (höchste Prio, Rest 18 E) erhält die volle 0,040
    expect(w.state.reiter[0].entries.length).toBe(1);
    expect(w.state.reiter[0].entries[0].einheit).toBeCloseTo(0.04, 6);
    // Tab 1 hat keinen Rest mehr → keine Buchung
    expect(w.state.reiter[1].entries.length).toBe(0);
    // Summe = 0,040
    var sumE = 0;
    for (var ti = 0; ti < w.state.reiter.length; ti++) {
      var ents = w.state.reiter[ti].entries || [];
      for (var ei = 0; ei < ents.length; ei++) sumE += ents[ei].einheit || 0;
    }
    expect(sumE).toBeCloseTo(0.04, 6);
    expect(w.state.machineLog.length).toBe(1);
    expect(w.state.machineLog[0].einheit).toBeCloseTo(0.04, 6);
  });
});

function setupTabPair(w, t1UsedD = 0, t1Hektar = 10, t2Hektar = 5) {
  // Tab 1: t1Hektar, 200 kg/ha → SOLL Dünger = t1Hektar * 200
  w.state.reiter[0].hektar = t1Hektar;
  w.state.reiter[0].koerner = 90000;
  w.state.reiter[0].duenger = 200;
  w.state.reiter[0].entries = t1UsedD > 0 ? [{
    time: 0, mlIdx: 0, einheit: 0, duenger: t1UsedD,
    hektar: t1Hektar, istHektar: 0, zaehlerStand: 0,
    koerner: 90000, duengerRate: 200
  }] : [];
  // Tab 2: t2Hektar
  w.state.reiter.push({
    name: 'Tab 2', hektar: t2Hektar, istHektar: 0, koerner: 90000,
    duenger: 200, entries: []
  });
  w.state.drillPriorities = { 0: 1, 1: 2 };
}

describe('_calcDrillDistribution: Saat/Dünger-Symmetrie (Issue #329)', () => {
  it('Dünger folgt Saat: Prio-1-Tab nimmt seinen Rest, Überschuss geht zu Prio-2', () => {
    const { window: w } = createDom();
    // Tab 1: 10 ha SOLL = 2000 kg, hat schon 1500 kg drin → tabDRem = 500
    // Tab 2: 5 ha SOLL = 1000 kg, hat 0 → tabDRem = 1000
    // Fill: 1000 kg
    // → Tab 1 nimmt min(1000, 500) = 500, Rest 500 geht zu Tab 2 (min(500, 1000))
    setupTabPair(w, 1500, 10, 5);

    const plan = w._calcDrillDistribution(0, 1000);
    expect(plan[0].giveD).toBeCloseTo(500, 2);
    expect(plan[1].giveD).toBeCloseTo(500, 2);
  });

  it('Saat und Dünger folgen IDENTISCHER Verteilung (gleiche SOLL-Rest-Logik)', () => {
    const { window: w } = createDom();
    // Setup: Tab 1 hat 6 E Saat verbraucht von SOLL 18 E → Saat-Rest = 12
    //        Tab 1 hat 1500 kg Dünger verbraucht von SOLL 2000 kg → Dünger-Rest = 500
    // Fill: 24 E Saat / 2000 kg Dünger
    // Saat:  Tab 1 nimmt min(24, 12) = 12, Rest 12 geht zu Tab 2 (SOLL 8, cap 8) → 8, Rest 4 → machineLog
    // Dünger: Tab 1 nimmt min(2000, 500) = 500, Rest 1500 geht zu Tab 2 (SOLL 1000, cap 1000) → 1000, Rest 500 → machineLog
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 90000;
    w.state.reiter[0].duenger = 200;
    w.state.reiter[0].entries = [{
      time: 0, mlIdx: 0, einheit: 6, duenger: 1500,
      hektar: 10, istHektar: 0, zaehlerStand: 0,
      koerner: 90000, duengerRate: 200
    }];
    w.state.reiter.push({
      name: 'Tab 2', hektar: 5, istHektar: 0, koerner: 90000,
      duenger: 200, entries: []
    });
    w.state.drillPriorities = { 0: 1, 1: 2 };

    // Test Saat-Pfad
    const planE = w._calcDrillDistribution(24, 0);
    // Test Dünger-Pfad
    const planD = w._calcDrillDistribution(0, 2000);

    // Beide Pfade nehmen bei Prio-1 nur den Rest
    expect(planE[0].giveE).toBeCloseTo(12, 2);  // Saat: min(24, 12) = 12
    expect(planD[0].giveD).toBeCloseTo(500, 2); // Dünger: min(2000, 500) = 500

    // Beide Pfade geben den Rest an Prio-2 (gedeckelt durch deren SOLL)
    // Saat: Tab 2 SOLL = 5ha * 90000/50000 = 9 E. cap = min(remE, 9) = 9.
    // Dünger: Tab 2 SOLL = 5ha * 200 = 1000 kg. cap = min(remD, 1000) = 1000.
    expect(planE[1].giveE).toBeCloseTo(9, 2);
    expect(planD[1].giveD).toBeCloseTo(1000, 2);
  });

  it('voller Tab (Prio 1, used = SOLL) gibt Dünger komplett an Prio 2 weiter', () => {
    const { window: w } = createDom();
    // Tab 1: 10 ha SOLL = 2000 kg, hat schon 2000 kg → tabDRem = 0
    setupTabPair(w, 2000, 10, 5);

    const plan = w._calcDrillDistribution(0, 1000);
    expect(plan[0].giveD).toBeCloseTo(0, 2);
    expect(plan[1].giveD).toBeCloseTo(1000, 2); // Tab 2 SOLL = 1000 kg, nimmt alles
  });

  it('leerer Tab (no entries) auf Prio 1 nimmt gesamte Eingabe', () => {
    const { window: w } = createDom();
    setupTabPair(w, 0, 10, 5);

    const plan = w._calcDrillDistribution(0, 2000);
    expect(plan[0].giveD).toBeCloseTo(2000, 2);
    expect(plan[1].giveD).toBeCloseTo(0, 2);
  });
});

describe('Issue 2: renderDrillTabList ist NaN-frei bei fehlendem e.einheit', () => {
  let w, AG, doc;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    AG = w.AppGlobals;
    doc = w.document;
  });

  it('Status-Text enthält kein "NaN" wenn ein Entry kein einheit-Feld hat', () => {
    // Tab mit zwei Entries — eines davon hat kein `einheit`-Feld.
    AG.state.koernerProEinheit = 50000;
    AG.state.reiter = [
      { name: 'Tab 1', hektar: 10, istHektar: 0, koerner: 100000, duenger: 200,
        fahrgassenEnabled: false, fahrgassenBreite: 0,
        entries: [
          { duenger: 100, time: '08:00' }, // ← kein `einheit`-Feld!
          { einheit: 5, duenger: 100, time: '09:00' },
        ] },
    ];
    if (AG.invalidateCarryoverCache) AG.invalidateCarryoverCache();

    w.renderDrillTabList();

    var need = doc.getElementById('dtl_need_0');
    expect(need).toBeTruthy();
    expect(need.textContent).not.toContain('NaN');
  });

  it('remaining-Einheiten sind > 0 und finit (nicht NaN) bei fehlendem e.einheit', () => {
    // getTabRemaining ist AppGlobals-exportiert; liefert obj mit remainingE/remainingD.
    AG.state.koernerProEinheit = 50000;
    AG.state.reiter = [
      { name: 'Tab 1', hektar: 10, istHektar: 0, koerner: 100000, duenger: 200,
        fahrgassenEnabled: false, fahrgassenBreite: 0,
        entries: [
          { duenger: 100, time: '08:00' }, // ← kein `einheit`-Feld!
        ] },
    ];
    if (AG.invalidateCarryoverCache) AG.invalidateCarryoverCache();

    var rem = AG.getTabRemaining(AG.state.reiter[0], 0);
    expect(Number.isFinite(rem.remainingE)).toBe(true);
    expect(Number.isFinite(rem.remainingD)).toBe(true);
    expect(rem.remainingE).toBeGreaterThan(0);
  });

  it('AppGlobals.getTabRemaining existiert', () => {
    expect(typeof AG.getTabRemaining).toBe('function');
  });

  it('inline-drill in renderDrillEntriesInline ist NaN-frei bei fehlendem e.einheit', () => {
    AG.state.koernerProEinheit = 50000;
    AG.state.activeReiter = 0;
    AG.state.reiter = [
      { name: 'Tab 1', hektar: 10, istHektar: 0, koerner: 100000, duenger: 200,
        fahrgassenEnabled: false, fahrgassenBreite: 0,
        entries: [
          { duenger: 100, time: '08:00' }, // ← kein `einheit`-Feld!
          { einheit: 5, duenger: 100, time: '09:00' },
        ] },
    ];
    if (AG.invalidateCarryoverCache) AG.invalidateCarryoverCache();

    w.renderDrillEntriesInline();
    var remEl = doc.getElementById('r_drill_e_rem');
    expect(remEl).toBeTruthy();
    expect(remEl.textContent).not.toContain('NaN');
  });
});
