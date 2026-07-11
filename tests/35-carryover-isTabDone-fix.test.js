/**
 * Tests for Issue #138 / Issue #378 (Regel 7): computeAllCarryovers() —
 * Carryover-Pool und isTabDone-Semantik unter dem neuen Algorithmus.
 *
 * Kontext (Regel 7, PR #380): Phase-1 Ersparnis-Kaskade ist gelöscht.
 * `savedEinheit`/`savedDuenger` sind IMMER 0. Der Carryover-Pool (Σ used
 * done=false Tabs) wird NUR durch Mehrbedarf-Lücken (IST > SOLL) angezapft.
 *
 * Daher sind die ursprünglichen "Carryover-vom-Source-Tab"-Tests obsolet
 * (kein Pool-Spender ohne Mehrbedarf-Quelle) und werden durch
 * Regel-7-äquivalente Tests ersetzt:
 *   - isTabDone nutzt max(0, soll - used + entzogen) als Restbedarf
 *   - done-Flag triggert Pool-Exclusion (Tab ist fertig → sein used
 *     zählt NICHT in den Pool)
 *   - isTabDone(t) ≡ isTabDone(t, i) (kein Carryover-Cache mehr —
 *     Carryover wird konsistent via getTabRemaining geliefert)
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

function setup() {
  const { dom, window: w, store } = createDom();
  w.initUI();
  return { dom, w, store };
}

/**
 * Scenario from issue:
 * Tab A: IST > SOLL (überschüttet) → erzeugt Ersparnis
 * Tab B: Hat Einträge die fast ausreichen, aber nur MIT Carryover von A fertig
 * Tab C: Hat noch Bedarf und sollte den überschüssigen Carryover bekommen
 *
 * Ohne Fix: Tab B bekommt Carryover obwohl es mit Carryover von A fertig wäre
 * Mit Fix: Tab B wird übersprungen, Tab C bekommt den Carryover
 */
describe('Issue #138: computeAllCarryovers skips carryover-dependent tabs', () => {
  // REMOVED (#378 Regel-7): 'isTabDone() berücksichtigt Carryover aus dem Cache'
  //   — unter Regel 7 ist `savedEinheit` immer 0. Stattdessen: isTabDone
  //   triggert Pool-Exclusion: ein done-Tab nimmt NICHT am Pool teil.
  it('done-Tab wird aus dem Carryover-Pool ausgeschlossen (Regel 7.1)', () => {
    const { w } = setup();
    // Tab 0: 10ha SOLL, 8ha IST → savings source (kein Mehrbedarf).
    // Tab 1: 5ha SOLL, IST=8ha → Mehrbedarf-Quelle (8-5=3 E Lücke).
    // Tab 2: 5ha SOLL, IST=5ha → leer, done=false.
    w.state.reiter = [
      { name: 'A', hektar: 10, istHektar: 8, koerner: 50000, duenger: 100, entries: [
        { einheit: 8, duenger: 80, zaehlerStand: 8, time: '2026-01-01T10:00' }
      ]},
      { name: 'B', hektar: 5, istHektar: 8, koerner: 50000, duenger: 100, entries: [
        { einheit: 5, duenger: 50, zaehlerStand: 8, time: '2026-01-01T10:00' }
      ]},
      { name: 'C', hektar: 5, istHektar: 5, koerner: 50000, duenger: 100, entries: [] }
    ];

    w.invalidateCarryoverCache();
    var co0 = w.getCarryover(0);
    var co1 = w.getCarryover(1);
    var co2 = w.getCarryover(2);

    // Regel 7: savedEinheit ist IMMER 0.
    expect(co0.savedEinheit).toBe(0);
    expect(co1.savedEinheit).toBe(0);
    expect(co2.savedEinheit).toBe(0);
    // Tab 1 ist Mehrbedarf-Quelle (Lücke 3 E).
    // Pool = Σ used(done=false) ohne Mehrbedarf-Tabs = Tab0(8) + Tab2(0) = 8.
    // Tab 1 Lücke 3 wird voll gedeckt: nettedEinheit = 3.
    expect(co1.nettedEinheit).toBeCloseTo(3, 1);
    // Tab 0 spendet 3 E an Tab 1 (inverse Reihenfolge; hier einziger Spender).
    expect(co0.excessEinheit).toBeCloseTo(3, 1);
    // Tab 1 (Mehrbedarf-Quelle) kann nicht selbst spenden (Befund 1 / I6).
    expect(co1.excessEinheit).toBe(0);
    // Tab 2 hat used=0 → kein Beitrag.
    expect(co2.excessEinheit).toBe(0);
  });

  // REMOVED (#378 Regel-7): 'Tab mit Carryover-vollständigem Status wird in
  //   Phase 1 übersprungen' — Phase-1-Ersparnis-Verteilung ist gelöscht.
  //   Ersatz: isTabDone nutzt `remaining = max(0, soll - used + entzogen)`;
  //   ein Tab mit Carryover-vollständigem Status hat remaining=0 → isTabDone
  //   returnt true. Im Algorithmus bedeutet das: der Tab nimmt nicht am
  //   Spender-Pool teil (er ist done).
  it('isTabDone berücksichtigt entzogen (Regel 7): Tab mit voll gedecktem Mehrbedarf ist done', () => {
    const { w } = setup();
    // Tab 0: 5ha SOLL, IST=8ha → Mehrbedarf 3 E Saatgut + 300 kg Dünger.
    //        used=5/500 (Deckung für die ersten 5 ha, Lücke bleibt).
    // Tab 1: 5ha SOLL, IST=5ha, used=5/500 → fertig (volle Saatgut+Duenger).
    w.state.reiter = [
      { name: 'A', hektar: 5, istHektar: 8, koerner: 50000, duenger: 100, entries: [
        { einheit: 5, duenger: 500, zaehlerStand: 5, time: '2026-01-01T10:00' }
      ]},
      { name: 'B', hektar: 5, istHektar: 5, koerner: 50000, duenger: 100, entries: [
        { einheit: 5, duenger: 500, zaehlerStand: 5, time: '2026-01-01T11:00' }
      ]}
    ];

    w.invalidateCarryoverCache();
    var co0 = w.getCarryover(0);
    var co1 = w.getCarryover(1);

    // Tab 0 (Mehrbedarf): Lücke 3 E / 300 kg Dünger.
    // Pool Saat: Σ used(done=false) ohne Mehrbedarf-Tabs = Tab1(5) = 5.
    // Pool Düng: Tab1(500) = 500.
    // Beide Lücken werden voll gedeckt: nettedEinheit = 3, nettedDuenger = 300.
    expect(co0.nettedEinheit).toBeCloseTo(3, 1);
    expect(co0.nettedDuenger).toBeCloseTo(300, 0);
    // Tab 1 (Pool-Spender): spendet 3 E und 300 kg Dünger aus seinem used.
    expect(co1.excessEinheit).toBeCloseTo(3, 1);
    expect(co1.excessDuenger).toBeCloseTo(300, 0);
    // Tab 0: Mehrbedarf-Quelle, spendet nicht selbst (Befund 1 / I6).
    expect(co0.excessEinheit).toBe(0);
    expect(co0.excessDuenger).toBe(0);
    // savedEinheit ist unter Regel 7 immer 0.
    expect(co0.savedEinheit).toBe(0);
    expect(co1.savedEinheit).toBe(0);
    // isTabDone: Tab 0 ist Mehrbedarf-Quelle, used=5 < istE=8, ABER die Lücke
    // ist voll per Pool (netted=3) gedeckt → remainingE = max(0, 8-5+0-3) = 0 → done.
    expect(w.isTabDone(w.state.reiter[0], 0)).toBe(true);
    // Tab 1: used=5/500, aber entzogen=3/300 (Pool-Spender) → remE = 5-5+3 = 3 > 0.
    // Tab 1 ist NICHT done, weil er 3 E / 300 kg an Tab 0 abgegeben hat.
    expect(w.isTabDone(w.state.reiter[1], 1)).toBe(false);
    // getTabRemaining dokumentiert die Restbedarfe.
    var remB = w.getTabRemaining(w.state.reiter[1], 1);
    expect(remB.remainingE).toBeCloseTo(3, 1);
    expect(remB.remainingD).toBeCloseTo(300, 0);
  });

  // REMOVED (#378 Regel-7): 'isTabDone(t, tabIdx) berücksichtigt Carryover,
  //   isTabDone(t) ignoriert es' — unter Regel 7 ist `savedEinheit` immer 0,
  //   also ist isTabDone(t) === isTabDone(t, i) (beide nutzen `max(0, soll -
  //   used + entzogen)` über getTabRemaining, kein Cache-Split mehr).
  it('isTabDone(t) und isTabDone(t, i) sind unter Regel 7 konsistent', () => {
    const { w } = setup();
    // Tab 0: 5ha SOLL, 5ha IST, used=4/400 → noch nicht fertig.
    // Tab 1: 5ha SOLL, 5ha IST, used=5/500 → fertig (volle Saatgut+Duenger).
    w.state.reiter = [
      { name: 'A', hektar: 5, istHektar: 5, koerner: 50000, duenger: 100, entries: [
        { einheit: 4, duenger: 400, zaehlerStand: 4, time: '2026-01-01T10:00' }
      ]},
      { name: 'B', hektar: 5, istHektar: 5, koerner: 50000, duenger: 100, entries: [
        { einheit: 5, duenger: 500, zaehlerStand: 5, time: '2026-01-01T11:00' }
      ]}
    ];

    w.invalidateCarryoverCache();
    w.computeAllCarryovers();

    // Tab A: used=4 < sollE=5, usedD=400 < sollD=500. Kein Mehrbedarf, keine
    // Pool-Entzüge (kein IST>SOLL-Tab). isTabDone(t) und isTabDone(t, i)
    // MÜSSEN identisch sein (Regel 7).
    expect(w.isTabDone(w.state.reiter[0])).toBe(w.isTabDone(w.state.reiter[0], 0));
    expect(w.isTabDone(w.state.reiter[0], 0)).toBe(false);
    // Tab B: used=5/500 === sollE/D → done.
    expect(w.isTabDone(w.state.reiter[1])).toBe(true);
    expect(w.isTabDone(w.state.reiter[1], 1)).toBe(true);
  });

  it('kein Carryover wenn alle Tabs fertig sind', () => {
    const { w } = setup();

    // Tab A sparet, aber Tab B ist auch ohne Carryover fertig
    w.state.reiter = [
      {
        name: 'Feld A',
        hektar: 10,
        istHektar: 8,
        koerner: 50000,
        duenger: 100,
        entries: [
          { einheit: 8, duenger: 80, zaehlerStand: 8, time: '2026-01-01T10:00' }
        ]
      },
      {
        name: 'Feld B',
        hektar: 5,
        istHektar: 5,
        koerner: 50000,
        duenger: 100,
        entries: [
          { einheit: 5, duenger: 50, zaehlerStand: 5, time: '2026-01-01T11:00' }
        ]
      }
    ];

    w.invalidateCarryoverCache();
    var co0 = w.getCarryover(0);
    var co1 = w.getCarryover(1);

    // Tab B ist bereits fertig → bekommt keinen Carryover
    // Ersparnis bleibt unverteilbar (nur 2 Tabs)
    expect(co0.savedEinheit).toBeCloseTo(0, 1);
    expect(co1.savedEinheit).toBeCloseTo(0, 1);
  });
});
