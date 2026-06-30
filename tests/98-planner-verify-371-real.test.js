/**
 * PLANNER VERIFY #371 — Vollständiges Szenario (Tab1=0, Tab3=1.6 unfilled)
 * Real-Szenario: used=SOLL (Fahrer füllt nach Plan, fährt dann weiter).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('PLANNER VERIFY #371 — Tab1=0, Tab3=1.6 unfilled', () => {
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

    it('ALLE 3 Tabs — Vollständige Verifikation', () => {
        setup();
        for (let i = 0; i < 3; i++) {
            const co = w.getCarryover(i);
            const rem = w.getTabRemaining(w.state.reiter[i], i);
            console.log(`Tab${i+1} (${w.state.reiter[i].name}):`,
                `nettedE=${co.nettedEinheit.toFixed(2)}`,
                `remainingE=${rem.remainingE.toFixed(3)}`,
                `nettedD=${co.nettedDuenger.toFixed(0)}`,
                `remainingD=${rem.remainingD.toFixed(0)}`);
        }
        // Tab1 (Mehrbedarf) → 0
        const rem1 = w.getTabRemaining(w.state.reiter[0], 0);
        expect(rem1.remainingE).toBeCloseTo(0, 1);
        expect(rem1.remainingD).toBeCloseTo(0, 1);
        // Tab2 (neutral voll) → 0
        const rem2 = w.getTabRemaining(w.state.reiter[1], 1);
        expect(rem2.remainingE).toBeCloseTo(0, 1);
        // Tab3 (unfilled) → 1.6
        const rem3 = w.getTabRemaining(w.state.reiter[2], 2);
        expect(rem3.remainingE).toBeCloseTo(1.6, 1);
        expect(rem3.remainingD).toBeCloseTo(200, 0);
    });
});
