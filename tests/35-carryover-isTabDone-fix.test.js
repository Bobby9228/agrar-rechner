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
  it('Senken-Modell: Ersparnis + Mehrbedarf; Netto-Defizit landet auf der Senke', () => {
    const { w } = setup();
    // Tab 0: 10ha SOLL, 8ha IST, used=IST-Bedarf → fertig, Ersparnis 2E/200kg.
    // Tab 1: 5ha SOLL, 8ha IST, used=SOLL-Bedarf (5) → Mehrbedarf 3E/300kg.
    // Tab 2: 5ha SOLL/IST, used=5 → zeitlich zuletzt (Senke).
    w.state.reiter = [
      { name: 'A', hektar: 10, istHektar: 8, koerner: 50000, duenger: 100, entries: [
        { einheit: 8, duenger: 800, zaehlerStand: 8, time: '2026-01-01T09:00' }
      ]},
      { name: 'B', hektar: 5, istHektar: 8, koerner: 50000, duenger: 100, entries: [
        { einheit: 5, duenger: 500, zaehlerStand: 8, time: '2026-01-01T10:00' }
      ]},
      { name: 'C', hektar: 5, istHektar: 5, koerner: 50000, duenger: 100, entries: [
        { einheit: 5, duenger: 500, zaehlerStand: 5, time: '2026-01-01T11:00' }
      ]}
    ];

    w.invalidateCarryoverCache();
    var co0 = w.getCarryover(0);
    var co1 = w.getCarryover(1);
    var co2 = w.getCarryover(2);

    // Selbst-Abweichungen (Hinweis): Tab 0 Ersparnis, Tab 1 Mehrbedarf.
    expect(co0.savedEinheit).toBeCloseTo(2, 1);
    expect(co1.excessEinheit).toBeCloseTo(3, 1);
    // Senke = Tab 2 (11:00, späteste). Netto-Material-Defizit = 0 + 3 = 3 E.
    expect(co2.isSink).toBe(true);
    expect(co2.sinkAdjustedE).toBeCloseTo(3, 1);
    expect(co2.sinkAdjustedD).toBeCloseTo(300, 0);
    expect(co0.isSink).toBe(false);
    expect(co1.isSink).toBe(false);
    // Tab 0/1 fertig (worked, own 0); Tab 2 trägt das Netto-Defizit.
    expect(w.getTabRemaining(w.state.reiter[0], 0).remainingE).toBeCloseTo(0, 1);
    expect(w.getTabRemaining(w.state.reiter[1], 1).remainingE).toBeCloseTo(0, 1);
    expect(w.getTabRemaining(w.state.reiter[2], 2).remainingE).toBeCloseTo(3, 1);
  });

  // REMOVED (#378 Regel-7): 'Tab mit Carryover-vollständigem Status wird in
  //   Phase 1 übersprungen' — Phase-1-Ersparnis-Verteilung ist gelöscht.
  //   Ersatz: isTabDone nutzt `remaining = max(0, soll - used + entzogen)`;
  //   ein Tab mit Carryover-vollständigem Status hat remaining=0 → isTabDone
  //   returnt true. Im Algorithmus bedeutet das: der Tab nimmt nicht am
  //   Spender-Pool teil (er ist done).
  it('Senken-Modell: Mehrbedarf-Tab ist done (Lücke weitergeleitet), Senke trägt Rest', () => {
    const { w } = setup();
    // Tab 0: 5ha SOLL, IST=8ha → Mehrbedarf 3 E / 300 kg. used=5/500.
    // Tab 1: 5ha SOLL, IST=5ha, used=5/500 → zeitlich zuletzt (Senke).
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

    // Tab 0 Mehrbedarf (Selbst-Abweichung); Tab 1 ist Senke, trägt +3/+300.
    expect(co0.excessEinheit).toBeCloseTo(3, 1);
    expect(co0.excessDuenger).toBeCloseTo(300, 0);
    expect(co1.isSink).toBe(true);
    expect(co1.sinkAdjustedE).toBeCloseTo(3, 1);
    expect(co1.sinkAdjustedD).toBeCloseTo(300, 0);
    // Tab 0: own = SOLL−used = 0, nicht Senke → remaining 0 → done.
    expect(w.isTabDone(w.state.reiter[0], 0)).toBe(true);
    // Tab 1 (Senke): own 0 + sinkAdjusted 3 = 3 > 0 → NICHT done.
    expect(w.isTabDone(w.state.reiter[1], 1)).toBe(false);
    var remB = w.getTabRemaining(w.state.reiter[1], 1);
    expect(remB.remainingE).toBeCloseTo(3, 1);
    expect(remB.remainingD).toBeCloseTo(300, 0);
  });

  // REMOVED (#378 Regel-7): 'isTabDone(t, tabIdx) berücksichtigt Carryover,
  //   isTabDone(t) ignoriert es' — unter Regel 7 ist `savedEinheit` immer 0,
  //   also ist isTabDone(t) === isTabDone(t, i) (beide nutzen `max(0, soll -
  //   used + entzogen)` über getTabRemaining, kein Cache-Split mehr).
  it('isTabDone(t) und isTabDone(t, i) sind konsistent (kein Carryover)', () => {
    const { w } = setup();
    // Tab 0: 10ha SOLL/IST, used=10 → fertig, kein Defizit.
    // Tab 1: 5ha SOLL/IST, used=5 (zuletzt befüllt) → fertig, kein Defizit.
    // burden=0 → sinkAdjusted=0 → beide remaining 0, beide done.
    w.state.reiter = [
      { name: 'A', hektar: 10, istHektar: 10, koerner: 50000, duenger: 100, entries: [
        { einheit: 10, duenger: 1000, zaehlerStand: 10, time: '2026-01-01T10:00' }
      ]},
      { name: 'B', hektar: 5, istHektar: 5, koerner: 50000, duenger: 100, entries: [
        { einheit: 5, duenger: 500, zaehlerStand: 5, time: '2026-01-01T11:00' }
      ]}
    ];

    w.invalidateCarryoverCache();
    w.computeAllCarryovers();

    // Senken-Modell: isTabDone(t) ≡ isTabDone(t, i) konsistent.
    expect(w.isTabDone(w.state.reiter[0])).toBe(w.isTabDone(w.state.reiter[0], 0));
    expect(w.isTabDone(w.state.reiter[0])).toBe(true);
    expect(w.isTabDone(w.state.reiter[0], 0)).toBe(true);
    expect(w.isTabDone(w.state.reiter[1])).toBe(w.isTabDone(w.state.reiter[1], 1));
    expect(w.isTabDone(w.state.reiter[1])).toBe(true);
    expect(w.isTabDone(w.state.reiter[1], 1)).toBe(true);
  });

  it('Ersparnis-Tab fertig bei IST; beide Tabs zeigen remaining 0', () => {
    const { w } = setup();
    // Tab A: 10ha SOLL, nur 8ha gemacht (IST 8), used 8 → fertig bei IST (Ersparnis).
    // Tab B: 5ha SOLL/IST, used 5 → fertig.
    w.state.reiter = [
      {
        name: 'Feld A', hektar: 10, istHektar: 8, koerner: 50000, duenger: 100,
        entries: [{ einheit: 8, duenger: 80, zaehlerStand: 8, time: '2026-01-01T10:00' }]
      },
      {
        name: 'Feld B', hektar: 5, istHektar: 5, koerner: 50000, duenger: 100,
        entries: [{ einheit: 5, duenger: 50, zaehlerStand: 5, time: '2026-01-01T11:00' }]
      }
    ];

    w.invalidateCarryoverCache();
    var co0 = w.getCarryover(0);
    var co1 = w.getCarryover(1);
    // Tab A Ersparnis (Selbst-Abweichung, Hinweis); beide Tabs remaining 0.
    expect(co0.savedEinheit).toBeCloseTo(2, 1);
    expect(w.getTabRemaining(w.state.reiter[0], 0).remainingE).toBeCloseTo(0, 1);
    expect(w.getTabRemaining(w.state.reiter[1], 1).remainingE).toBeCloseTo(0, 1);
    // Senke (Tab B): kein Material-Defizit (beide Tabs used = IST-need) → 0.
    expect(co1.isSink).toBe(true);
    expect(co1.sinkAdjustedE).toBeCloseTo(0, 1);
  });
});
