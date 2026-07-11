import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('DEBUG #371 — Tab3 Carryover Details', () => {
    let w;
    beforeEach(() => {
        const result = createDom();
        w = result.window;
        w.state.koernerProEinheit = 50000;
    });

    it('zeigt alle carryover values für alle Tabs', () => {
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

        for (let i = 0; i < 3; i++) {
            const co = w.getCarryover(i);
            const r = w.state.reiter[i];
            const basisE = w.getTabIstEinheiten(r);
            const usedE = w.getTabUsedEinheiten(r);
            const rem = w.getTabRemaining(r, i);
            console.log(`Tab${i+1}: basis=${basisE.toFixed(1)} used=${usedE.toFixed(1)}`,
                `saved=${co.savedEinheit.toFixed(2)} excess=${co.excessEinheit.toFixed(2)}`,
                `netted=${co.nettedEinheit.toFixed(2)} → remaining=${rem.remainingE.toFixed(2)}`,
                `(formel: ${basisE.toFixed(1)}-${usedE.toFixed(1)}-${co.savedEinheit.toFixed(1)}+${co.excessEinheit.toFixed(1)}-${co.nettedEinheit.toFixed(1)})`);
        }
        expect(true).toBe(true);
    });
});