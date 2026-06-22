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
    w.state.drillPriorities[0] = 1; // Tab A höchste Prio (Issue #264)
    w.state.drillPriorities[1] = 2;
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
    // Tab A prio=1 (high), Tab B prio=2 (low) — Issue #264: Prio 1 = höchste
    // Total: 15 Einheiten, Tab A needs 18, Tab B needs 8
    w.document.getElementById('drill_einheit').value = '15';
    w.document.getElementById('drill_duenger').value = '0';

    w.drillCalcAll(); // distribute
    w.drillAdd();

    // Tab A (prio 1) gets min(18, 15) = 15
    expect(w.state.reiter[0].entries.length).toBe(1);
    expect(w.state.reiter[0].entries[0].einheit).toBeCloseTo(15);
    // Tab B (prio 2) gets min(8, 15-15=0) = 0 → keine Entry
    expect(w.state.reiter[1].entries.length).toBe(0);
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

  it('preserves priorities after adding', () => {
    setupMultiTabWithPrio();
    w.document.getElementById('drill_einheit').value = '10';
    w.document.getElementById('drill_duenger').value = '0';

    w.drillCalcAll();
    w.drillAdd();

    // Priorities persist after drillAdd (bug #146)
    expect(Object.keys(w.state.drillPriorities).length).toBe(2);
    expect(w.state.drillPriorities[0]).toBe(1);
    expect(w.state.drillPriorities[1]).toBe(2);
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

  // ── Dimension math regression (Issue #240) ─────────────────────────────────
  // Pre-fix: perUnit = einheitPerHa / tab.hektar ergab "Einheiten/ha²" und
  // maxUnitsThisTab dadurch einen winzigen Wert — multi-tab-Distribution brach.
  // Fix: perUnit = (tab.koerner * fahrgassenFactor) / koernerProEinheit
  // (Einheiten/ha), maxUnitsThisTab = tab.hektar * perUnit (Einheiten).
  it('cap respects tab.hektar: kein Tab erhält mehr Einheiten als seine Kapazität (Issue #240)', () => {
    setupMultiTabWithPrio();
    // Tab A: 10ha × 90000 / 50000 = 18 E Kapazität
    // Tab B: 5ha × 80000 / 50000  = 8  E Kapazität
    // Mit 18 E: A (prio 1, Kapazität 18) bekommt min(18, 18) = 18;
    // B (prio 2) bekommt die Reste 0 — cap auf 18 wäre verletzt, falls
    // perUnit falsch wäre.
    w.document.getElementById('drill_einheit').value = '18';
    w.document.getElementById('drill_duenger').value = '0';

    w.drillCalcAll();
    w.drillAdd();

    var eB = w.state.reiter[1].entries[0] ? w.state.reiter[1].entries[0].einheit : 0;
    var eA = w.state.reiter[0].entries[0].einheit;
    // Tab A (prio 1, Kapazität 18) → bekommt 18
    expect(eA).toBeCloseTo(18, 5);
    // Tab B (prio 2, Kapazität 8) → bekommt min(8, 18-18=0) = 0 → keine Entry
    expect(w.state.reiter[1].entries.length).toBe(0);
  });

  it('Fahrgassen-Faktor reduziert die Kapazität pro Tab (Issue #240)', () => {
    setupMultiTabWithPrio();
    // Tab A mit FG (breite=24 → 0.9583): 10ha × 90000 × 23/24 / 50000 ≈ 17.25 E
    // Tab B ohne FG: 5ha × 80000 / 50000 = 8 E
    // Mit 25 E: A (prio 1) bekommt min(17.25, 25) = 17.25; B (prio 2) bekommt
    // 7.75. Wäre perUnit falsch (Tab A "Einheiten/ha²"), bekäme A statt der
    // 17.25 nur eine winzige Zahl und B die 25 oder mehr.
    w.state.reiter[0].fahrgassenEnabled = true;
    w.state.reiter[0].fahrgassenBreite = 24;
    w.state.reiter[1].fahrgassenEnabled = false;
    w.document.getElementById('drill_einheit').value = '25';
    w.document.getElementById('drill_duenger').value = '0';

    w.drillCalcAll();
    w.drillAdd();

    var eA = w.state.reiter[0].entries[0].einheit;
    var eB = w.state.reiter[1].entries[0].einheit;
    var fgFactor = w.computeFahrgassenFaktor(24); // 23/24 ≈ 0.9583
    var capA = 10 * 90000 * fgFactor / 50000;     // ≈ 17.25
    // A (prio 1) bekommt min(capA, 25) = capA ≈ 17.25.
    expect(eA).toBeCloseTo(capA, 5);
    // B (prio 2) bekommt min(8, 25-17.25) = 7.75
    expect(eB).toBeCloseTo(25 - capA, 5);
    // Sanity: bei mehr input würde der FG-Faktor sichtbar:
    expect(capA).toBeLessThan(18);
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
    prioBtn.onclick(); // 3 → maxPrio=3 → 0
    expect(prioBtn.getAttribute('data-prio')).toBe('0');
    expect(prioBtn.textContent).toBe('—');
  });
});

    // Issue #321: regression tests for _buildDrillEntry() — direct unit tests for
    // the function whose silent Dünger-Cap was the bug. The cap used to clamp
    // entry.duenger to duengerPerUnit * unitsForThisTab, which truncated user
    // input whenever the real kg/E ratio differed from the tab plan. Fixed by
    // removing the cap; raw duengerRaw is now stored as entry.duenger.
    describe('_buildDrillEntry (Issue #321: no silent Dünger-Cap)', () => {
      let w;
      beforeEach(() => { w = createDom().window; });

      function makeTab(overrides) {
        return Object.assign({
          name: 'Test', hektar: 10, koerner: 90000, duenger: 200,
          fahrgassenEnabled: false, fahrgassenBreite: 0,
          entries: []
        }, overrides || {});
      }

      it('respects raw user duenger input, no silent cap', () => {
        // Tab config: 10ha, koerner=90000, duenger=200 kg/ha
        // duengerPerUnit = 200 * 50000 / 90000 ≈ 111.11 kg/E
        // unitsForThisTab = min(12, 18) = 12 (capped, < tab cap)
        // OLD cap: min(2000, 111.11 * 12) = 1333.33 → silently swallowed 666.67 kg
        // NEW (no cap): 2000 stored as-is
        var tab = makeTab();
        var entry = w._buildDrillEntry(tab, 12, 2000, 0, -1);
        expect(entry.einheit).toBeCloseTo(12);
        expect(entry.duenger).toBe(2000); // raw, NOT 1333.33
      });

      it('extreme case: 1 unit, 99999 kg → 99999 kg (no cap)', () => {
        var tab = makeTab();
        var entry = w._buildDrillEntry(tab, 1, 99999, 0, -1);
        expect(entry.einheit).toBeCloseTo(1);
        expect(entry.duenger).toBe(99999); // no upper bound at all
      });

      it('Saatgut-Cap still active: 24 E capped to maxUnitsThisTab (18)', () => {
        // Tab cap = 10ha × 90000/50000 = 18 E
        var tab = makeTab();
        var entry = w._buildDrillEntry(tab, 24, 0, 0, -1);
        expect(entry.einheit).toBeCloseTo(18); // capped
        expect(entry.duenger).toBe(0);
      });

      it('duenger = 0 is preserved (no spurious values)', () => {
        var tab = makeTab();
        var entry = w._buildDrillEntry(tab, 12, 0, 0, -1);
        expect(entry.duenger).toBe(0);
      });

      it('negative duenger is preserved as-is (raw passthrough)', () => {
        // The function is a pure formatter — callers (drillAdd) validate inputs.
        // This documents that _buildDrillEntry does no clamping itself.
        var tab = makeTab();
        var entry = w._buildDrillEntry(tab, 12, -5, 0, -1);
        expect(entry.duenger).toBe(-5);
      });
    });
