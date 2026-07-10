// Regression-Test für Issue #347 (User-Bug-Report) — REGEL 7 ANGEWANDT.
//
// Vorher (Phase-1-Modell, obsolet unter #378): Pin-Assertions auf
// savedEinheit/savedDuenger. Phase 1 buchte Ersparnis auf den ersten
// nicht-done Tab; Phase 2 buchte Mehrbedarf-Net. Issue #347: ein Tab mit
// IST > SOLL (Mehrbedarf-Quelle) bekam trotzdem savedEinheit →
// Doppelzählung, Tab 3 (neutral) bekam doppelt abgezogen.
//
// Neu (Regel 7, Issue #378): savedEinheit/savedDuenger sind IMMER 0. Die
// Pool-Mechanik verteilt Cross-Tab-Material als `excess*` (Entzug aus
// Spender-Tabs) und `netted*` (Deckung des Mehrbedarfs). Damit fällt der
// Phase-1-Fix strukturell weg — savedEinheit kann gar nicht falsch positiv
// werden.
//
// User-Szenario (unverändert, referenziert Issue #347):
//   Tab 1: 10→9 ha, used 18E/1800kg → Ersparnis-Quelle (kein eigener Bedarf)
//   Tab 2: 7.5→8 ha, used 11E/1500kg → Mehrbedarf (ist=16 > sol=15, Lücke=1E)
//   Tab 3: 5→5 ha, used 8E/500kg   → neutral, eigener Restbedarf 2E/500kg
//
// Regel-7 Pool-Semantik für dieses Szenario:
//   Pool Saat = 18 (T1) + 8 (T3) = 26 E; T2 ist Mehrbedarf, ausgeschlossen.
//   Mehrbedarf-Liste: T2 (exc=1 E / 100 kg).
//   Spender-Order (INVERS lastEntryTime, T2 raus): T3 (10:00) → T1 (08:00).
//   T2 zieht 1 E / 100 kg von T3 (T3 hat 8 / 500 verfügbar).
//   T3.excessE = 1; T3.excessD = 100.
//
// Per-Tab remaining (Regel 7, max(0, basis - used + entzogen)):
//   T1: basis 18, used 18, excess 0 → 0/0 (fertig)
//   T2: basis 16, used 11, excess 0 → 5/100 (Mehrbedarf-Lücke, physisch offen)
//   T3: basis 10, used 8, excess 1 → 3/600 (eigener Rest 2 + entzogen 1 E;
//                                            bzw. Rest 500 + entzogen 100 kg)

import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Issue #347 (Regel 7): Carryover vergibt Salden nicht mehr in Tabs ohne Mehrbedarf', () => {
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
        fahrgassenEnabled: false, fahrgassenBreite: 0,
        entries: [{ einheit: 18, duenger: 1800, time: '08:00' }] },
      { name: 'T2', hektar: 7.5, istHektar: 8,   koerner: 100000, duenger: 200,
        fahrgassenEnabled: false, fahrgassenBreite: 0,
        entries: [{ einheit: 11, duenger: 1500, time: '09:00' }] },
      { name: 'T3', hektar: 5,   istHektar: 5,   koerner: 100000, duenger: 200,
        fahrgassenEnabled: false, fahrgassenBreite: 0,
        entries: [{ einheit: 8,  duenger: 500,  time: '10:00' }] },
    ];
    if (AG.invalidateCarryoverCache) AG.invalidateCarryoverCache();
  }

  it('savedEinheit/savedDuenger sind unter Regel 7 strukturell immer 0', () => {
    setup3Tabs();
    for (let i = 0; i < 3; i++) {
      const co = AG.getCarryover(i);
      // Phase-1-Fix (Issue #347) entfällt strukturell: Regel 7 hat kein
      // savedEinheit-Konzept. Ersparnis wandert zentral über den Pool und
      // schlägt NICHT in savedEinheit auf.
      expect(co.savedEinheit).toBe(0);
      expect(co.savedDuenger).toBe(0);
    }
  });

  it('Mehrbedarf-Tab (T2) wird vom Pool (T3) genettet — Befund 1: T3 ist Spender, NICHT Empfänger', () => {
    setup3Tabs();
    const co1 = AG.getCarryover(0); // T1
    const co2 = AG.getCarryover(1); // T2 Mehrbedarf
    const co3 = AG.getCarryover(2); // T3 neutral, Spender
    // T2: netted=1 E / 100 kg (voll gedeckt durch T3)
    expect(co2.nettedEinheit).toBeCloseTo(1, 1);
    expect(co2.nettedDuenger).toBeCloseTo(100, 0);
    // T2 selbstgutschrift ausgeschlossen: T2 hat used=11, sein excess=0
    expect(co2.excessEinheit).toBe(0);
    expect(co2.excessDuenger).toBe(0);
    // T3 hat 1 E / 100 kg an T2 gespendet
    expect(co3.excessEinheit).toBeCloseTo(1, 1);
    expect(co3.excessDuenger).toBeCloseTo(100, 0);
    // T1 wurde nicht angefasst (Pool reichte für T2 aus T3 allein)
    expect(co1.excessEinheit).toBe(0);
    expect(co1.excessDuenger).toBe(0);
  });

  it('Per-Tab-Verbleibend nach Regel-7-Formel — Issue #347 Endresult umgerechnet', () => {
    setup3Tabs();
    // expected berechnet mit getTabRemaining(r, i) (Regel-7-Formel mit
    // Doppelzählungs-Fix: remaining = max(0, basis − used + entzogen − netted)):
    //   T1: 18-18+0-0 = 0/0
    //   T2: 16-11+0-1 = 4/0 (Mehrbedarf-Lücke 1E/100kg voll genettet → 0 sichtbar;
    //                         T2 braucht 4E für seine Rest-Plan-Fläche)
    //   T3: 10-8+1-0 = 3/600 (Spender: 2 Rest + 1 entzogen)
    const r1 = AG.state.reiter[0];
    const r2 = AG.state.reiter[1];
    const r3 = AG.state.reiter[2];
    const rem1 = AG.getTabRemaining(r1, 0);
    const rem2 = AG.getTabRemaining(r2, 1);
    const rem3 = AG.getTabRemaining(r3, 2);

    expect(rem1.remainingE).toBeCloseTo(0, 1);
    expect(rem1.remainingD).toBeCloseTo(0, 1);

    expect(rem2.remainingE).toBeCloseTo(4, 1);
    expect(rem2.remainingD).toBeCloseTo(0, 0);

    expect(rem3.remainingE).toBeCloseTo(3, 1);
    expect(rem3.remainingD).toBeCloseTo(600, 0);
  });
});
