/**
 * Test 43: _calcDrillDistribution — Saat und Dünger folgen derselben Prio-Logik
 *
 * Hintergrund (User-Feedback 2026-06-22, "Langsam nervt es 🙄"):
 *   Saat-Verteilung nutzt p.rem = SOLL - used als Cap (Zeile 535):
 *     plan[p.idx].giveE = Math.min(remE, p.rem);
 *   Dünger-Verteilung muss SYMMETRISCH sein — gleicher Cap, gleiche Prio-Logik.
 *
 *   Wenn Tab 1 (Prio 1) Saat/Dünger-SOLL gedeckt hat, geht der Rest an Tab 2.
 *   Wenn Tab 2 (Prio 2) auch gedeckt ist, geht der Rest als Überschuss in den
 *   machineLog (Issue #266).
 *
 * Historie (warum wir den Test überhaupt brauchen):
 *   - Issue #315: Math.min(duengerRaw, duengerPerUnit * units)-Cap in
 *     _buildDrillEntry — PR #322 hat ihn entfernt.
 *   - Issue #326: tabDCap in _calcDrillDistribution — PR #327 hat ihn entfernt
 *     (zu radikal: Prio-1-Tab nahm alles, auch über SOLL).
 *   - Issue #329 (dieser Test): Dünger-Pfad ist jetzt symmetrisch zur Saat.
 *
 * Vor #329 hatte Dünger entweder gar keinen Cap (PR #327) oder einen
 * restriktiveren Cap (PR #326-Revert-Pattern). Beides war falsch:
 *   - Ohne Cap: Prio-1-Tab sammelt alles, Überschuss entsteht unkontrolliert.
 *   - Mit restriktivem Cap: stillschweigendes Schlucken von User-Eingaben.
 *
 * Mit #329 verhält sich Dünger EXAKT wie Saat.
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

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
