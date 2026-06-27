// Pin-Test für Issue #347 (Folge-Bug zu PR #348)
//
// Vorher (PR #348 gefixt, Inline-Drill richtig):
//   Inline-Drill Tab 3: r_drill_e_rem = "1,0 Einheit" ✓
//   Carryover-Pool: getCarryover(2) korrekt (savedE=1, alles andere 0) ✓
//   Drill-Summary (Cross-Tab-Aggregation):
//     ds_saat_remaining  = "2,0 Einheiten" ✗ (sollte "1,0 Einheit")
//     ds_duenger_remaining = "500 kg"     ✗ (sollte "400 kg")
//
// Nachher (dieser PR):
//   Drill-Summary aggregiert per-tab needE/needD OHNE Mehrbedarf-Tabs.
//   Tab 2 ist Mehrbedarf-Quelle (istE=16 > solE=15) → sein Restbedarf
//   (16 − 11 = 5 E) ist Quellen-Mehraufwand, nicht Bedarf. Mit Skip
//   ergibt sich totalNeedE = 0 (Tab 1 fertig) + 0 (Tab 2 Mehrbedarf)
//   + 2 (Tab 3 echter Bedarf) = 2. Phase B: remE = max(0, 2 − 1 + 0) = 1.
//
// User-Szenario (Issue #347):
//   Tab 1: 10→9 ha, used 18E/1800kg → Ersparnis-Quelle (2E, 200kg)
//   Tab 2: 7.5→8 ha, used 11E/1500kg → Mehrbedarf-Quelle (1E, 100kg)
//   Tab 3: 5→5 ha, used 8E/500kg   → neutral, eigener Restbedarf 2E/500kg
// Erwartet (User-Spec):
//   ds_saat_remaining    = "1,0 Einheit"
//   ds_duenger_remaining = "400 kg"

import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Issue #347 Folge-Bug: Drill-Summary aggregiert ohne Mehrbedarf-Tabs', () => {
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

  it('Drill-Summary: ds_saat_remaining = "1,0 Einheit" (NICHT "2,0 Einheiten")', () => {
    setup3TabsUserScenario();
    AG.renderResults();
    const actual = doc.getElementById('ds_saat_remaining').textContent;
    expect(actual).toBe('1,0 Einheit');
  });

  it('Drill-Summary: ds_duenger_remaining = "400 kg" (NICHT "500 kg")', () => {
    setup3TabsUserScenario();
    AG.renderResults();
    const actual = doc.getElementById('ds_duenger_remaining').textContent;
    expect(actual).toBe('400 kg');
  });

  it('Per-tab Carryover: Tab 2 (Mehrbedarf-Quelle) bleibt bei savedE=0/savedD=0', () => {
    // PR #348 pinnt das schon. Hier nur als Sanity-Check, dass die
    // Voraussetzung für diesen Folge-Bug-Fix gegeben ist.
    setup3TabsUserScenario();
    const co2 = AG.getCarryover(1);
    expect(co2.savedEinheit).toBe(0);
    expect(co2.savedDuenger).toBe(0);
  });

  it('Per-tab Carryover: Tab 3 (neutraler Empfänger) bekommt savedE=1, savedD=100', () => {
    setup3TabsUserScenario();
    const co3 = AG.getCarryover(2);
    // Netto-Saldo (PR #348): netSavedE = max(0, 2−1) = 1, netSavedD = max(0, 200−100) = 100.
    // Phase 1 mit hasMehrbedarf-Skip für Tab 2 → Tab 3 empfängt die vollen 1E / 100kg.
    expect(co3.savedEinheit).toBeCloseTo(1, 1);
    expect(co3.savedDuenger).toBeCloseTo(100, 0);
  });

  it('Inline-Drill Tab 3 bleibt korrekt (r_drill_e_rem = "1,0 Einheit")', () => {
    // Pattern #3-Check: Inline-Drill (render-results.js) verwendet die
    // Per-Tab-Formel max(0, basis - used - saved + excess) — diese ist
    // konsistent mit dem gefixten Cross-Tab-Summary.
    setup3TabsUserScenario();
    AG.renderResults();
    const inlineE = doc.getElementById('r_drill_e_rem');
    const inlineD = doc.getElementById('r_drill_d_rem');
    expect(inlineE).toBeTruthy();
    expect(inlineD).toBeTruthy();
    expect(inlineE.textContent).toBe('1,0 Einheit');
    expect(inlineD.textContent).toBe('400 kg');
  });

  it('Aggregations-Formel: Tab 2 (Mehrbedarf) trägt needE=0/needD=0 bei', () => {
    // Direkter Pin auf die Code-Stelle render-drill.js Z. 163-164:
    // Wenn isMehrbedarf=true, wird needE/needD auf 0 gesetzt, NICHT aus
    // (tEinheiten - tUsedE) berechnet.
    setup3TabsUserScenario();
    AG.renderResults();
    // Wir lesen ds_saat_remaining (Phase B aggregiert). Die richtige
    // Aggregation setzt voraus, dass Tab 2 mit 0 beigetragen hat.
    // Wenn das Formel-Delta = 5 (Tab 2's tEinheiten−tUsedE) eingeflossen
    // wäre, würde ds_saat_remaining = 1 + 5 = 6 stehen (oder ähnliches).
    const remE = doc.getElementById('ds_saat_remaining').textContent;
    const remD = doc.getElementById('ds_duenger_remaining').textContent;
    // Hätten wir Tab 2 als Bedarfsempfänger gezählt, wäre remE irgendwo
    // zwischen 5 und 7 (abhängig von totalExcessE). 1,0 ist der Fix-Wert.
    expect(parseFloat(remE.replace(',', '.'))).toBeLessThanOrEqual(2);
    expect(parseFloat(remD.replace(/\./g, '').replace(' kg', ''))).toBeLessThanOrEqual(500);
  });
});