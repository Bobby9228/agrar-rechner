// Regression-Test für Issue #347 (User-Bug-Report)
// Pin-Assertion: In computeAllCarryovers() Phase 1 darf ein Tab mit IST>SOLL
// (Mehrbedarf-Quelle) KEIN savedEinheit/savedDuenger zugewiesen bekommen.
// Das gleiche für Phase 2: ein Tab mit IST=SOLL (neutraler Empfänger) bekommt
// KEIN excessEinheit/excessDuenger, weil er keinen eigenen Mehrbedarf hat.
//
// User-Szenario:
//   Tab 1: 10→9 ha, used 18E/1800kg → Ersparnis-Quelle (2E, 200kg)
//   Tab 2: 7.5→8 ha, used 11E/1500kg → Mehrbedarf-Quelle (1E, 100kg)
//   Tab 3: 5→5 ha, used 8E/500kg   → neutral, eigener Restbedarf 2E/500kg
// Erwartet: Tab 3 verbleibend = 1 E, 400 kg.
// Tatsächlich (Bug): 2-3 E, 500 kg.

import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Issue #347: Carryover-Phase 1+2 vergibt Salden an falsche Tabs', () => {
  let w, AG;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    AG = w.AppGlobals;
  });

  function setup3Tabs() {
    AG.state.koernerProEinheit = 50000;
    AG.state.activeReiter = 2;
    AG.state.reiter = [
      { name: 'T1', hektar: 10,  istHektar: 9,   koerner: 100000, duenger: 200,
        entries: [{ einheit: 18, duenger: 1800, time: '08:00' }] },
      { name: 'T2', hektar: 7.5, istHektar: 8,   koerner: 100000, duenger: 200,
        entries: [{ einheit: 11, duenger: 1500, time: '09:00' }] },
      { name: 'T3', hektar: 5,   istHektar: 5,   koerner: 100000, duenger: 200,
        entries: [{ einheit: 8,  duenger: 500,  time: '10:00' }] },
    ];
    if (AG.invalidateCarryoverCache) AG.invalidateCarryoverCache();
  }

  it('Phase 1: Tab 2 (Mehrbedarf-Quelle, istE > solE) bekommt KEIN savedEinheit', () => {
    setup3Tabs();
    const co2 = AG.getCarryover(1);
    // Tab 2 hat IST=16 > SOLL=15 → Mehrbedarf. Phase 1 darf hier nichts
    // aus dem Ersparnis-Pool zuteilen, weil Tab 2 selbst Quelle ist.
    expect(co2.savedEinheit).toBe(0);
    expect(co2.savedDuenger).toBe(0);
  });

  it('Phase 2: Tab 3 (neutraler Empfänger, istE == solE) bekommt KEIN excessEinheit', () => {
    setup3Tabs();
    const co3 = AG.getCarryover(2);
    // Tab 3 ist neutral (IST=SOLL). Phase 2 darf keinen Mehrbedarf-Empfang
    // buchen, weil Tab 3 keinen eigenen Mehrbedarf hat.
    expect(co3.excessEinheit).toBe(0);
    expect(co3.excessDuenger).toBe(0);
  });

  it('Tab 3 verbleibend = 1 E, 400 kg nach dem Fix', () => {
    setup3Tabs();
    const r3 = AG.state.reiter[2];
    const co3 = AG.getCarryover(2);
    const basisE = AG.getTabIstEinheiten(r3);
    const basisD = AG.getTabIstDuenger(r3);
    const usedE = r3.entries.reduce((s,e)=>s+(e.einheit||0), 0);
    const usedD = r3.entries.reduce((s,e)=>s+(e.duenger||0), 0);
    const remE = Math.max(0, basisE - usedE - co3.savedEinheit + co3.excessEinheit);
    const remD = Math.max(0, basisD - usedD - co3.savedDuenger + co3.excessDuenger);
    // Erwartet nach Fix: 2 E (10-8-0+0... wait, Tab 3 EMPFÄNGT die ganze Ersparnis
    // aus Tab 1 wenn Tab 2 korrekt übersprungen wird → remE = 10-8-2+0 = 0?
    // Hmm, mit korrigierter Phase 1 (Tab 2 ausgeschlossen) bekommt Tab 3 alle
    // 2E Ersparnis → remE = max(0, 10-8-2+0) = 0. Das ist nicht 1.
    //
    // Korrekte Erwartung mit Phase-1-Fix + Netting:
    //   totalSaved=2, totalExcess=1, Net = totalSaved - totalExcess = 1.
    //   Tab 3 Restbedarf vor Carryover: 10 - 8 = 2. Nach Carryover: 2 - 1 = 1.
    // → remE = 1. Die Phase 2 muss Netting anwenden, sonst Doppel-Zählung.
    //
    // Dieser Test pinnt das END-RESULT (Tab 3 = 1 E / 400 kg), das nur mit
    // Phase-1-Fix + Phase-2-Netting erreicht wird. Phase-2-only Fix reicht NICHT.
    expect(remE).toBeCloseTo(1, 1);
    expect(remD).toBeCloseTo(400, 0);
  });
});
