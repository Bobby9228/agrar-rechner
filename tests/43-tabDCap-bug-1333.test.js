/**
 * Test 43: _calcDrillDistribution tabDCap bug (Issue #315 follow-up)
 *
 * Bug: line 541-543 in public/js/ui-handlers.js caps giveD to tabDCap =
 * max(0, tabDNeed - tabDUsed). This silently swallows user-entered Dünger
 * beyond SOLL-Rest of a tab.
 *
 * Repro (verified live in Chrome via browser_navigate + console.trace, 2026-06-22):
 *   - Tab 1: 10 ha, 200 kg/ha Dünger, Prio 1
 *   - Tab 1 already has entry with duenger=666,67 (tabDUsed=666,67)
 *   - User fills 2000 kg → plan[0].giveD = 1333,33 (NOT 2000)
 *   - The 666,67 difference is silently dropped
 *
 * User symptom from screenshot 2026-06-20: "Dünger verbleibend: 1.266,67 kg"
 * (expected 500 kg). Root cause: tabDCap cap.
 *
 * NOTE: This is a UNIT test on _calcDrillDistribution directly (not via
 * drillAdd/dom). Issue #315/#316/#317 history: previous fix attempts didn't
 * catch this because no test covered _calcDrillDistribution in isolation —
 * all prior tests went through the DOM, which masked the cap.
 *
 * Fix expected: remove the Math.min(remD, tabDCap) cap → giveD = remD.
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

describe('_calcDrillDistribution: tabDCap bug', () => {
  it('does not cap giveD when tabDUsed < tabDNeed (Tab 1 has 666,67 used of 2000 need)', () => {
    const { window: w } = createDom();
    // Setup: Tab 1 (10 ha, 200 kg/ha → SOLL Dünger = 2000 kg)
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 90000;
    w.state.reiter[0].duenger = 200;
    w.state.reiter[0].entries = [{
      time: 0, mlIdx: 0, einheit: 0, duenger: 666.67,
      hektar: 10, istHektar: 0, zaehlerStand: 0,
      koerner: 90000, duengerRate: 200
    }];
    // Tab 2 (5 ha, 200 kg/ha → SOLL Dünger = 1000 kg)
    w.state.reiter.push({
      name: 'Tab 2', hektar: 5, istHektar: 0, koerner: 90000,
      duenger: 200, entries: []
    });
    // Priorities: Tab 1 first, Tab 2 second
    w.state.drillPriorities = { 0: 1, 1: 2 };

    const plan = w._calcDrillDistribution(0, 2000);

    // Bug (pre-fix): giveD = min(remD=2000, tabDCap=1333.33) = 1333.33
    // Fix:          giveD = 2000 (volle eingefüllte Menge, unabhängig von SOLL-Rest)
    expect(plan[0].giveD).toBeCloseTo(2000, 2);
  });

  it('Tab 1 (Prio 1) takes ALL Dünger even when tabDUsed = tabDNeed (post-fix behavior)', () => {
    // Post-fix: Saat und Dünger sind unabhängige Tanks. Der Cap auf SOLL-minus-used
    // ist weg. Wenn Tab 1 Prio 1 hat und der User füllt nach, geht der gesamte
    // Dünger an Tab 1 — egal ob Tab 1 schon SOLL-gedeckt ist. Der User behält
    // die Kontrolle via Prio-Reihenfolge.
    //
    // Achtung: das ist eine Design-Entscheidung. Cross-Tab-Carryover bei
    // "Tab 1 über SOLL" wird in Issue #319 separat behandelt (basis = ist vs sol).
    const { window: w } = createDom();
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 90000;
    w.state.reiter[0].duenger = 200;
    // Tab 1 already at SOLL: 2000 kg used
    w.state.reiter[0].entries = [{
      time: 0, mlIdx: 0, einheit: 0, duenger: 2000,
      hektar: 10, istHektar: 0, zaehlerStand: 0,
      koerner: 90000, duengerRate: 200
    }];
    w.state.reiter.push({
      name: 'Tab 2', hektar: 5, istHektar: 0, koerner: 90000,
      duenger: 200, entries: []
    });
    w.state.drillPriorities = { 0: 1, 1: 2 };

    const plan = w._calcDrillDistribution(0, 2000);
    // Post-fix: Tab 1 (Prio 1) nimmt alles, Tab 2 = 0
    expect(plan[0].giveD).toBeCloseTo(2000, 2);
    expect(plan[1].giveD).toBeCloseTo(0, 2);
  });

  it('saves full 2000 kg to Tab 1 on first fill (Issue #315 user-symptom)', () => {
    // Reduced scope: only the directly-observable bug from the screenshot.
    // The multi-fill cross-tab carryover is a separate question (#319) that
    // needs a design decision before coding — out of scope for this fix.
    const { window: w } = createDom();
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 90000;
    w.state.reiter[0].duenger = 200;
    w.state.reiter.push({
      name: 'Tab 2', hektar: 5, istHektar: 0, koerner: 90000,
      duenger: 200, entries: []
    });
    w.state.drillPriorities = { 0: 1, 1: 2 };

    // No pre-existing entries — single fill, 2000 kg, Tab 1 Prio 1
    const plan = w._calcDrillDistribution(0, 2000);
    expect(plan[0].giveD).toBeCloseTo(2000, 2);
    expect(plan[1].giveD).toBeCloseTo(0, 2);
  });
});
