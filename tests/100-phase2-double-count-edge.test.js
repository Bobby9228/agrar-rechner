/**
 * Edge-Cases für Phase-2-Reduktion (#371 Teil 3)
 *
 * Fix: remExcess = max(0, netExcess - ΣPhase0.5_netted). Phase 2 darf den
 * Teil nicht doppelt vergeben, den Phase 0.5 bereits aus dem unfilled-Pool
 * an Mehrbedarf-Tabs zugewiesen hat.
 *
 * Einheit-Helpers (siehe tests/98): koerner=80000, kpe=50000 → 1,6E pro ha.
 * istE = istHektar * 1,6  (= 80000/50000).  solE = hektar * 1,6.
 * usedE = last entry.einheit.  Duenger linear in kg/ha.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('#371 Edge-Cases — Phase 2 Doppelzählung', () => {
    let w;
    beforeEach(() => {
        const result = createDom();
        w = result.window;
        w.state.koernerProEinheit = 50000; // → 80000/50000 = 1,6E/ha
    });

    /**
     * Edge-Case A: Pool ≥ Mehrbedarf
     * Tab1: Mehrbedarf 1.6E (10ha, ist=11ha, used=17.6 → used >= istE)
     * Tab2: unfilled 5.0E (4ha, ist=4ha → solE=6.4, used=1.4)
     *
     * poolE = max(0, 6.4 - 1.4) + max(0, 6.4 - 6.4) = 5.0 + 0 = 5.0
     * mehrbedarfE = 17.6 - 16.0 = 1.6
     * Phase 0.5: tab1.nettedEinheit = min(5.0, 1.6) = 1.6, remPool=3.4
     * Phase 2: remExcess = max(0, 1.6 - 1.6) = 0 → KEIN excess verteilt
     *
     * Verifiziert: Tab3 (Capacity) bleibt ohne Phase-2-Verteilung.
     */
    it('Edge A: Pool ≥ Mehrbedarf → Phase 2 macht nichts (Tab3 kein excess)', () => {
        w.state.reiter[0] = {
            name: 'Mehrbedarf', hektar: 10, istHektar: 11, koerner: 80000, duenger: 200,
            // solE=16, istE=17.6, usedE=17.6 → used >= istE
            entries: [{ einheit: 17.6, duenger: 2000, time: '11:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[1] = {
            // solE=6.4, istE=6.4, usedE=1.4 → unfilled=5.0E (Pool-Quelle)
            name: 'PoolQuelle', hektar: 4, istHektar: 4, koerner: 80000, duenger: 200,
            entries: [{ einheit: 1.4, duenger: 200, time: '12:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[2] = {
            // Capacity-Tab, kein istHektar → unfilled-Beitrag=0, aber cap>0
            // sol=5*1.6=8, used=2 → cap=6
            name: 'Capacity', hektar: 5, istHektar: 0, koerner: 80000, duenger: 200,
            entries: [{ einheit: 2, duenger: 500, time: '13:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        if (w.invalidateCarryoverCache) w.invalidateCarryoverCache();

        const co1 = w.getCarryover(0);
        const co3 = w.getCarryover(2);
        // Phase 0.5 deckt den vollen Mehrbedarf → Tab1 netted = 1.6
        expect(co1.nettedEinheit).toBeCloseTo(1.6, 1);
        // Phase 2 hat 0 Rest → Tab3 bekommt KEIN excess
        expect(co3.excessEinheit).toBeCloseTo(0, 1);
    });

    /**
     * Edge-Case B: Pool = 0 → Phase 2 verteilt vollen netExcess (Status quo).
     * Tab1: Mehrbedarf 1.6E (10ha, ist=11ha, used=17.6)
     * Tab2: Capacity ohne istHektar, used=2 → cap=6, unfilled-Beitrag=0
     *
     * poolE = 0 (kein Tab mit mistE>0 und unfilled).
     * netExcessE = 1.6, Phase 0.5 verteilt 0.
     * Phase 2: remExcess = max(0, 1.6 - 0) = 1.6 → verteilt auf Tab2 (cap=6)
     *
     * Verifiziert: Tab2.excessEinheit = 1.6 (Status-quo-Verhalten erhalten).
     */
    it('Edge B: kein Pool → Phase 2 verteilt vollen netExcess (Status quo)', () => {
        w.state.reiter[0] = {
            name: 'Mehrbedarf', hektar: 10, istHektar: 11, koerner: 80000, duenger: 200,
            entries: [{ einheit: 17.6, duenger: 2000, time: '11:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[1] = {
            // Capacity ohne istHektar → kein pool-Beitrag, cap > 0
            name: 'Capacity', hektar: 5, istHektar: 0, koerner: 80000, duenger: 200,
            entries: [{ einheit: 2, duenger: 500, time: '12:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        if (w.invalidateCarryoverCache) w.invalidateCarryoverCache();

        const co1 = w.getCarryover(0);
        const co2 = w.getCarryover(1);
        // Phase 0.5: poolE = 0 → nichts verteilt
        expect(co1.nettedEinheit).toBeCloseTo(0, 1);
        // Phase 2: remExcess = 1.6 - 0 = 1.6 → Tab2 cap = 6 → 1.6 verteilt
        expect(co2.excessEinheit).toBeCloseTo(1.6, 1);
    });

    /**
     * Edge-Case C: Pool < Mehrbedarf → Phase 2 verteilt die Restdifferenz.
     * Tab1: Mehrbedarf 3.2E (10ha, ist=12ha, used=19.2)
     * Tab2: unfilled 1.0E (4ha, ist=4ha → solE=6.4, used=5.4)
     *
     * poolE = max(0, 6.4 - 5.4) = 1.0
     * mehrbedarfE = 19.2 - 16.0 = 3.2
     * Phase 0.5: tab1.nettedEinheit = min(1.0, 3.2) = 1.0, remPool=0
     * Phase 2: remExcess = max(0, 3.2 - 1.0) = 2.2 → auf Tab3 capacity
     *
     * Verifiziert die TEILWEISE-Reduktion (nicht voller Mehrbedarf gedeckt,
     * also Phase 2 hat tatsächlich noch zu verteilen — ohne Fix wäre die
     * Verteilung = 3.2 statt 2.2 → Doppelzählung von 1.0).
     */
    it('Edge C: Pool < Mehrbedarf → Phase 2 verteilt Rest (Differenz = Mehrbedarf − Pool)', () => {
        w.state.reiter[0] = {
            name: 'Mehrbedarf', hektar: 10, istHektar: 12, koerner: 80000, duenger: 200,
            entries: [{ einheit: 19.2, duenger: 2000, time: '11:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[1] = {
            // solE=6.4, istE=6.4, usedE=5.4 → unfilled=1.0
            name: 'PoolQuelle', hektar: 4, istHektar: 4, koerner: 80000, duenger: 200,
            entries: [{ einheit: 5.4, duenger: 700, time: '12:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[2] = {
            // Capacity, cap groß, keine pool-Quelle (kein istHektar)
            name: 'Capacity', hektar: 10, istHektar: 0, koerner: 80000, duenger: 200,
            entries: [{ einheit: 2, duenger: 500, time: '13:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        if (w.invalidateCarryoverCache) w.invalidateCarryoverCache();

        const co1 = w.getCarryover(0);
        const co3 = w.getCarryover(2);
        // Phase 0.5 deckt 1.0 von 3.2 → netted = 1.0
        expect(co1.nettedEinheit).toBeCloseTo(1.0, 1);
        // Phase 2 hat noch 2.2 zu verteilen (NICHT 3.2 wie ohne Fix)
        expect(co3.excessEinheit).toBeCloseTo(2.2, 1);
    });
});
