// Pin-Test für Issue #347 (Folge-Bug zu PR #348) — REGEL 7 ANGEWANDT.
//
// Vorher (Phase-1-Modell mit savedEinheit): Drill-Summary aggregierte
// per-Tab needE/needD und pinnte ds_saat_remaining="1,0 Einheit" /
// ds_duenger_remaining="400 kg". Diese Werte waren End-Result-Pins der
// Phase-1-Ersparnis-Korrektur + Phase-2-Netting.
//
// Neu (Regel 7, Issue #378): gespeicherte Ersparnis existiert nicht mehr.
// Cross-Tab-Material fließt über excessEinheit/excessDuenger (Entzug
// aus Spender-Tabs). Damit berechnen sich Drill-Summary-Aggregationen
// anders: T2 (Mehrbedarf-Quelle) bekommt weiterhin seine physische
// Lücke (16-11=5 E, 1600-1500=100 kg) als remaining angezeigt; T3
// (neutral, nun als Spender) hat zusätzlich 1 E / 100 kg Entzug und
// damit 3 E / 600 kg remaining. T1 (fertig) bleibt bei 0.
//
// User-Szenario (unverändert, referenziert Issue #347):
//   Tab 1: 10→9 ha, used 18E/1800kg → Ersparnis-Quelle (kein eigener Bedarf)
//   Tab 2: 7.5→8 ha, used 11E/1500kg → Mehrbedarf (ist=16 > sol=15, Lücke=1E)
//   Tab 3: 5→5 ha, used 8E/500kg   → neutral, eigener Restbedarf 2E/500kg
//
// Per-Tab remaining (Regel 7):
//   T1: 0/0   T2: 5 E / 100 kg (physische Lücke, nicht durch Pool deckbar
//                       weil Pool nur 26 E genettet wurde, T2 hat 1 E Lücke
//                       die physisch offen bleibt)
//   T3: 3 E / 600 kg (2 Rest + 1 E entzogen)

import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Issue #347 Folge-Bug (Regel 7): Drill-Summary aggregiert Tab-Mehrbedarf korrekt', () => {
  let w, AG, doc;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    AG = w.AppGlobals;
    doc = w.document;
  });

  function setup3TabsUserScenario() {
    AG.state.koernerProEinheit = 50000;
    AG.state.activeReiter = 2;
    AG.state.reiter = [
      { name: 'Tab 1', hektar: 10,  istHektar: 9,   koerner: 100000, duenger: 200,
        fahrgassenEnabled: false, fahrgassenBreite: 0,
        entries: [{ einheit: 18, duenger: 1800, time: '08:00' }] },
      { name: 'Tab 2', hektar: 7.5, istHektar: 8,   koerner: 100000, duenger: 200,
        fahrgassenEnabled: false, fahrgassenBreite: 0,
        entries: [{ einheit: 11, duenger: 1500, time: '09:00' }] },
      { name: 'Tab 3', hektar: 5,   istHektar: 5,   koerner: 100000, duenger: 200,
        fahrgassenEnabled: false, fahrgassenBreite: 0,
        entries: [{ einheit: 8,  duenger: 500,  time: '10:00' }] },
    ];
    if (AG.invalidateCarryoverCache) AG.invalidateCarryoverCache();
  }

  it('Drill-Summary: ds_saat_remaining = T3 (2) + T3.excess (1) − T2 skip (Regel 7)', () => {
    setup3TabsUserScenario();
    AG.renderResults();
    const actual = doc.getElementById('ds_saat_remaining').textContent;
    // renderDrillSummary Phase-B-Formel: max(0, totalNeed - totalSaved + totalExcess).
    //   T1: used=ist → needE=0; T2: Mehrbedarf, uncovered=tEin-sFor-netted=0;
    //       T3: needE = 10-8 = 2.
    //   totalSavedE = 0 (Regel 7), totalExcessE = 1 (T3 spendete an T2).
    //   → max(0, 2 + 1) = 3,0 Einheiten (NICHT 8,0).
    expect(actual).toBe('3,0 Einheiten');
  });

  it('Drill-Summary: ds_duenger_remaining = T3 (500) + T3.excess (100) − T2 skip (Regel 7)', () => {
    setup3TabsUserScenario();
    AG.renderResults();
    const actual = doc.getElementById('ds_duenger_remaining').textContent;
    // totalNeedD = 500 (T3); totalExcessD = 100 (T3 spendete an T2).
    // max(0, 500 + 100) = 600 kg.
    expect(actual).toBe('600 kg');
  });

  it('Per-tab Carryover: Tab 2 (Mehrbedarf-Quelle) bleibt bei savedE=0/savedD=0', () => {
    // strukturell unter Regel 7: savedEinheit/savedDuenger sind IMMER 0
    // (siehe tests/55 I6). Eigener Sanity-Check, dass die Voraussetzung
    // für die Folge-Bug-Fix-Logik strukturell gilt.
    setup3TabsUserScenario();
    const co2 = AG.getCarryover(1);
    expect(co2.savedEinheit).toBe(0);
    expect(co2.savedDuenger).toBe(0);
  });

  it('Per-tab Carryover: T3 gibt 1 E/100 kg ab (Spender-Verhalten, nicht Empfänger)', () => {
    setup3TabsUserScenario();
    const co3 = AG.getCarryover(2);
    // Regel 7: T3 (Spender für T2) bekommt excessEinheit=1, excessDuenger=100.
    // Vorher (Phase-1-Modell): T3 bekam savedEinheit=1 + savedDuenger=100
    // als Empfänger. savedEinheit ist unter Regel 7 IMMER 0.
    expect(co3.excessEinheit).toBeCloseTo(1, 1);
    expect(co3.excessDuenger).toBeCloseTo(100, 0);
    expect(co3.savedEinheit).toBe(0);
    expect(co3.savedDuenger).toBe(0);
  });

  it('Inline-Drill Tab 3 zeigt Regel-7-remaining (3 E / 600 kg)', () => {
    // Pattern #3-Check: Inline-Drill (render-results.js) verwendet die
    // Per-Tab-Formel max(0, basis - used - saved + excess). Diese ist
    // unter Regel 7 = max(0, basis - used + entzogen).
    setup3TabsUserScenario();
    AG.renderResults();
    const inlineE = doc.getElementById('r_drill_e_rem');
    const inlineD = doc.getElementById('r_drill_d_rem');
    expect(inlineE).toBeTruthy();
    expect(inlineD).toBeTruthy();
    // T3 remaining: 10 - 8 + 1 = 3 E; 1000 - 500 + 100 = 600 kg.
    expect(inlineE.textContent).toBe('3,0 Einheiten');
    expect(inlineD.textContent).toBe('600 kg');
  });

  it('T2 Mehrbedarf-Lücke wird per Netting gedeckt (keine Doppelzählung in andere Tabs)', () => {
    // Regel 7 + Doppelzählungs-Fix (− netted):
    //   - T2 ist NUR Empfänger (nettedEinheit=1 / nettedDuenger=100).
    //   - T2 remaining = basis − used − netted = 16-11-1 = 4 E / 1600-1500-100 = 0 kg.
    //     Die 1-E-/100-kg-Lücke ist durch den Pool (T3) gedeckt und taucht in T2
    //     NICHT mehr als offener Bedarf auf — sie wandert als entzogen genau EINMAL
    //     zu T3 (Spender, der nachfüllen muss). Σ remaining = 0+4+3 = 7 E = Σ basis − Σ used.
    setup3TabsUserScenario();
    const rem2 = AG.getTabRemaining(AG.state.reiter[1], 1);
    expect(rem2.remainingE).toBeCloseTo(4, 1);
    expect(rem2.remainingD).toBeCloseTo(0, 0);
  });
});
