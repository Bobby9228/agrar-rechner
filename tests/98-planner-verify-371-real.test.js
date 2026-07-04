/**
 * PLANNER VERIFY — Regel-7 Pool-Modell (Issue #378 / Nachfolger Issue #371).
 *
 * Vorher (Issue #371, alt): Pool = Σ max(0, basis − used). Tab3 (unfilled)
 * gab 1,6 E in den Pool, Tab1 deckte seine 1,6-Lücke voll, Tab3 remaining
 * = 1,6 (unfilled). Dieses Modell ist mit Regel 7 obsolet.
 *
 * Neu (Regel 7): Pool = Σ used(done=false, non-Mehrbedarf). Tab2+Tab3 spenden
 * used (12 + 6,4 = 18,4 E Saat, 1500 + 800 = 2300 kg Dünger). Tab1 mit Lücke
 * 1,6 E/200kg zieht sequenziell aus dem inversen Spender-Pool — Tab3 (latest
 * entry) spendet seine 1,6 zuerst, Tab2 muss nichts abgeben.
 *   Tab1 (Mehrbedarf): remainingE=0, remainingD=0
 *   Tab2 (neutral voll): remainingE=0, remainingD=0
 *   Tab3 (Mehrbedarf-Spender): entzogen=1,6 E / 200 kg
 *           remainingE=8−6,4+1,6=3,2; remainingD=1000−800+200=400
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('PLANNER VERIFY #378 — Regel-7 Pool-Modell', () => {
    let w;
    beforeEach(() => {
        const result = createDom();
        w = result.window;
        w.state.koernerProEinheit = 50000;
    });

    function setup() {
        w.state.reiter[0] = {
            name: 'A1', hektar: 15, istHektar: 16, koerner: 80000, duenger: 200,
            entries: [{ einheit: 24, duenger: 3000, time: '11:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[1] = {
            name: 'A2', hektar: 7.5, istHektar: 7.5, koerner: 80000, duenger: 200,
            entries: [{ einheit: 12, duenger: 1500, time: '12:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[2] = {
            name: 'A3', hektar: 5, istHektar: 5, koerner: 80000, duenger: 200,
            entries: [{ einheit: 6.4, duenger: 800, time: '13:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        if (w.invalidateCarryoverCache) w.invalidateCarryoverCache();
    }

    it('Regel 7 — Tab1 (Mehrbedarf) voll genettet, Tab3 gibt 1,6 E ab', () => {
        setup();
        for (let i = 0; i < 3; i++) {
            const co = w.getCarryover(i);
            const rem = w.getTabRemaining(w.state.reiter[i], i);
            console.log(`Tab${i+1} (${w.state.reiter[i].name}):`,
                `nettedE=${co.nettedEinheit.toFixed(2)}`,
                `excessE=${co.excessEinheit.toFixed(2)}`,
                `remainingE=${rem.remainingE.toFixed(3)}`,
                `nettedD=${co.nettedDuenger.toFixed(0)}`,
                `excessD=${co.excessDuenger.toFixed(0)}`,
                `remainingD=${rem.remainingD.toFixed(0)}`);
        }
        // Tab1 (Mehrbedarf 1,6 E): Pool (Tab2+Tab3=18,4) deckt voll → netted=1,6
        // used=24 < ist=25,6 → physische Lücke bleibt 1,6 (wird aus dem Pool gefüllt,
        // bleibt aber in remaining sichtbar, weil sie nie in used landet).
        const co1 = w.getCarryover(0);
        expect(co1.nettedEinheit).toBeCloseTo(1.6, 1);
        expect(co1.nettedDuenger).toBeCloseTo(200, 0);
        const rem1 = w.getTabRemaining(w.state.reiter[0], 0);
        expect(rem1.remainingE).toBeCloseTo(1.6, 1);
        expect(rem1.remainingD).toBeCloseTo(200, 0);

        // Tab2 (neutral voll): keine Entzogen, remaining 0
        const rem2 = w.getTabRemaining(w.state.reiter[1], 1);
        expect(rem2.remainingE).toBeCloseTo(0, 1);
        expect(rem2.remainingD).toBeCloseTo(0, 1);

        // Tab3 (Mehrbedarf-Spender, latest entry) → entzogen 1,6 E + 200 kg
        // sol=8, used=6,4 → remainingE = 8 − 6,4 + 1,6 = 3,2
        // solD=1000, usedD=800 → remainingD = 1000 − 800 + 200 = 400
        const rem3 = w.getTabRemaining(w.state.reiter[2], 2);
        const co3 = w.getCarryover(2);
        expect(co3.excessEinheit).toBeCloseTo(1.6, 1);
        expect(co3.excessDuenger).toBeCloseTo(200, 0);
        expect(rem3.remainingE).toBeCloseTo(3.2, 1);
        expect(rem3.remainingD).toBeCloseTo(400, 0);
    });
});
