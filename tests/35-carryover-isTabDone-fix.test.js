/**
 * Tests for Issue #138: computeAllCarryovers() überspringt Carryover-abhängige Tabs.
 *
 * Bug: In Phase 1 von computeAllCarryovers() wurde isTabDone(t) OHNE tabIdx aufgerufen.
 * Dadurch ignorierte isTabDone den Carryover und Tabs, die nur dank Carryover als "fertig"
 * gelten, bekamen fälschlicherweise eigene Ersparnis-Zuweisungen.
 *
 * Fix: Cache provisorisch befüllen + isTabDone(t, i) mit tabIdx nutzen.
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
  it('isTabDone() berücksichtigt Carryover aus dem Cache', () => {
    const { w } = setup();
    // Tab 0: 10 ha SOLL, 8 ha IST → Ersparnis (2 ha weniger Saatgut)
    // Tab 1: 5 ha SOLL, 5 ha IST, fast voll aber mit Lücke die Carryover füllt
    w.state.reiter = [
      {
        name: 'Feld A',
        hektar: 10,
        istHektar: 8,
        koerner: 50000,
        duenger: 100,
        entries: []
      },
      {
        name: 'Feld B',
        hektar: 5,
        istHektar: 5,
        koerner: 50000,
        duenger: 100,
        entries: [
          { einheit: 7.5, duenger: 50, zaehlerStand: 5, time: '2026-01-01T10:00' }
        ]
      },
      {
        name: 'Feld C',
        hektar: 5,
        istHektar: 5,
        koerner: 50000,
        duenger: 100,
        entries: []
      }
    ];
    w.state.activeReiter = 0;

    // Tab B: SOLL = 5 * 50000/50000 = 5 Einheiten, IST = 5 * 50000/50000 = 5 Einheiten
    // usedE = 7.5, totalE = 5 → remE = max(0, 5-7.5) = 0 → Tab B is "done" without carryover
    // Actually: Einheit used > total, so tab B is already done regardless.
    // Let me adjust: Tab B needs entries that leave a small gap filled by carryover.

    // Recalculate with better scenario:
    // Tab A: SOLL=10ha, IST=8ha → Ersparnis = (10-8)/10 * 10 Einheiten = 2 Einheiten Ersparnis
    // Tab B: SOLL=5ha, IST=5ha, entries=4 Einheiten → totalE=5, usedE=4, remE=1
    //   → Mit Carryover von 1 Einheit wäre Tab B fertig (remE=0)
    //   → Ohne Carryover: remE=1 → Tab B ist "nicht fertig" → bekommt Carryover
    // Tab C: SOLL=5ha, IST=5ha, entries=0 → totalE=5, remE=5

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
          { einheit: 4, duenger: 50, zaehlerStand: 5, time: '2026-01-01T11:00' }
        ]
      },
      {
        name: 'Feld C',
        hektar: 5,
        istHektar: 5,
        koerner: 50000,
        duenger: 100,
        entries: []
      }
    ];

    // Ersparnis Tab A: SOLL=10 Einheiten, IST=8 Einheiten → diffE = 2
    // Phase 1 verteilt 2 Einheiten Ersparnis:
    //   Tab B: totalE=5, usedE=4, remE=1, carryover von A=0 → isTabDone? nein → bekommt 1 Einheit
    //   Nach Zuweisung: Tab B hat savedEinheit=1 → isTabDone(B,1)=true (remE=5-4-1=0)
    //   Tab C: bekommt restliche 1 Einheit

    // invalidate cache first
    w.invalidateCarryoverCache();
    var co0 = w.getCarryover(0);
    var co1 = w.getCarryover(1);
    var co2 = w.getCarryover(2);

    // Tab A erzeugt Ersparnis (IST < SOLL) → bekommt selbst keinen Carryover
    expect(co0.savedEinheit).toBeCloseTo(0, 1);
    // Tab B bekommt maximal so viel wie es braucht (1 Einheit)
    expect(co1.savedEinheit).toBeCloseTo(1, 1);
    // Tab C bekommt die restliche Ersparnis
    expect(co2.savedEinheit).toBeCloseTo(1, 1);
  });

  it('Tab mit Carryover-vollständigem Status wird in Phase 1 übersprungen', () => {
    const { w } = setup();

    // Setup: Tab A sparet 2 Einheiten, Tab B braucht nur 1 durch Einträge+Carryover,
    // Tab C braucht 3. Ohne Fix bekommt Tab B Ersparnis obwohl es fertig ist.
    //
    // Szenario:
    // Tab A: 10ha SOLL, 8ha IST → 2 Einheiten Ersparnis
    // Tab B: 5ha SOLL, 5ha IST, 4.5 Einheiten eingetragen → remE = 0.5
    //   Mit 0.5 Carryover wäre es fertig
    // Tab C: 5ha SOLL, 5ha IST, 0 Einheiten eingetragen → remE = 5

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
          { einheit: 4.5, duenger: 50, zaehlerStand: 5, time: '2026-01-01T11:00' }
        ]
      },
      {
        name: 'Feld C',
        hektar: 5,
        istHektar: 5,
        koerner: 50000,
        duenger: 100,
        entries: []
      }
    ];

    w.invalidateCarryoverCache();
    var co1 = w.getCarryover(1);
    var co2 = w.getCarryover(2);

    // Total Ersparnis = 2 Einheiten
    // Tab B: remE = 5 - 4.5 = 0.5 → mit 0.5 Carryover fertig
    // Tab C: remE = 5 - 0 = 5 → braucht alles
    //
    // ERWARTET mit Fix:
    // Tab B bekommt 0.5 → ist fertig → wird in Phase 1 übersprungen
    // Tab C bekommt restliche 1.5

    expect(co1.savedEinheit).toBeCloseTo(0.5, 1);
    expect(co2.savedEinheit).toBeCloseTo(1.5, 1);
  });

  it('isTabDone(t, tabIdx) berücksichtigt Carryover, isTabDone(t) ignoriert es', () => {
    const { w } = setup();

    w.state.reiter = [
      {
        name: 'Feld A',
        hektar: 10,
        istHektar: 8,
        koerner: 50000,
        duenger: 0,  // kein Dünger → Fokus auf Saatgut-Carryover
        entries: [
          { einheit: 8, duenger: 0, zaehlerStand: 8, time: '2026-01-01T10:00' }
        ]
      },
      {
        name: 'Feld B',
        hektar: 5,
        istHektar: 5,
        koerner: 50000,
        duenger: 0,
        entries: [
          { einheit: 4.5, duenger: 0, zaehlerStand: 5, time: '2026-01-01T11:00' }
        ]
      }
    ];

    w.invalidateCarryoverCache();
    // Force cache population
    w.computeAllCarryovers();

    var tabB = w.state.reiter[1];
    // Ohne tabIdx: Carryover wird ignoriert → Tab B ist NICHT fertig (remE=0.5)
    w.invalidateCarryoverCache();
    expect(w.isTabDone(tabB)).toBe(false);
    // Mit tabIdx: Carryover wird berücksichtigt → Tab B IST fertig (remE=0.5 - 0.5 carryover = 0)
    w.invalidateCarryoverCache();
    expect(w.isTabDone(tabB, 1)).toBe(true);
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
