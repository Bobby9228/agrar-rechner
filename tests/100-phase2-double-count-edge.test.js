/**
 * Edge-Cases für die Carryover-Verteilung — angepasst an Regel 7 (#378).
 *
 * Ursprünglich (#371 Teil 3) verifizierten diese Tests die Phase-2-Reduktion
 * (remExcess = netExcess − ΣPhase0.5_netted) gegen das alte unfilled-Pool-
 * Modell (pool = Σ max(0, basis−used)). Mit Regel 7 (PR #380) ist die ganze
 * Phase-0/0.5/2-Architektur obsolet; die Erwartungswerte wurden an das neue
 * Pool-Modell angepasst:
 *   pool_E = Σ used_E  für alle Tabs mit done === false
 * Mehrbedarf-Lücken (ist > sol) wandern RÜCKWÄRTS durch die nicht-fertigen
 * Nicht-Mehrbedarf-Tabs (Spender, invers nach lastEntryTime); jeder Spender
 * gibt maximal seinen used-Wert. nettedEinheit = gedeckte Lücke eines
 * Mehrbedarf-Tabs, excessEinheit = abgegebene Menge eines Spenders.
 *
 * Einheit-Helpers (siehe tests/98): koerner=80000, kpe=50000 → 1,6E pro ha.
 * istE = istHektar * 1,6  (= 80000/50000).  solE = hektar * 1,6.
 * usedE = last entry.einheit.  Duenger linear in kg/ha.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('#371/#378 Edge-Cases — Carryover-Verteilung (Regel 7)', () => {
    let w;
    beforeEach(() => {
        const result = createDom();
        w = result.window;
        w.state.koernerProEinheit = 50000; // → 80000/50000 = 1,6E/ha
    });

    /**
     * Edge-Case A: Mehrbedarf ≤ Spender-used (Regel 7).
     * T0: Mehrbedarf 1.6E (10ha, ist=11ha, used=17.6 → used >= istE)
     * T1: Spender used=1.4 (4ha, ist=4ha → solE=istE=6.4, kein Mehrbedarf)
     * T2: Spender used=2   (5ha, istHektar=0 → kein Mehrbedarf)
     *
     * Spender invers nach lastEntryTime: T2 (13:00) vor T1 (12:00).
     * T0-Lücke 1.6 wird voll aus T2 gedeckt: min(1.6, 2) = 1.6 → excess[T2]=1.6.
     * netted[T0] = 1.6 (Σ Spender-used 3.4 ≥ 1.6 → volle Deckung).
     *
     * Verifiziert: Der Capacity-Tab (T2) IST unter Regel 7 ein Spender — sein
     * used liegt im Tank und wird dem Mehrbedarf-Tab rückwärts gutgeschrieben
     * (im alten unfilled-Modell wäre T3 excess=0 geblieben).
     */
    it('Edge A: Mehrbedarf ≤ Spender-used → volle Deckung rückwärts aus T2 (Regel 7)', () => {
        w.state.reiter[0] = {
            name: 'Mehrbedarf', hektar: 10, istHektar: 11, koerner: 80000, duenger: 200,
            // solE=16, istE=17.6, usedE=17.6 → used >= istE, Mehrbedarf exc=1.6
            entries: [{ einheit: 17.6, duenger: 2000, time: '11:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[1] = {
            // solE=6.4, istE=6.4, usedE=1.4 → kein Mehrbedarf, Spender (used im Pool)
            name: 'PoolQuelle', hektar: 4, istHektar: 4, koerner: 80000, duenger: 200,
            entries: [{ einheit: 1.4, duenger: 200, time: '12:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[2] = {
            // Capacity-Tab, istHektar=0 → kein Mehrbedarf, aber used=2 im Pool
            // sol=5*1.6=8, used=2 → Spender mit used=2
            name: 'Capacity', hektar: 5, istHektar: 0, koerner: 80000, duenger: 200,
            entries: [{ einheit: 2, duenger: 500, time: '13:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        if (w.invalidateCarryoverCache) w.invalidateCarryoverCache();

        const co1 = w.getCarryover(0);
        const co3 = w.getCarryover(2);
        // Regel 7: Lücke 1.6 voll aus Spender-Pool gedeckt → netted[T0] = 1.6
        expect(co1.nettedEinheit).toBeCloseTo(1.6, 1);
        // Regel 7: T2 ist Spender (used=2 im Tank), gibt 1.6 → excess[T2] = 1.6
        expect(co3.excessEinheit).toBeCloseTo(1.6, 1);
    });

    /**
     * Edge-Case B: einzelner Spender deckt Mehrbedarf (Regel 7).
     * T0: Mehrbedarf 1.6E (10ha, ist=11ha → exc=1.6)
     * T1: Capacity used=2 (5ha, istHektar=0 → kein Mehrbedarf, Spender)
     *
     * Unter Regel 7 ist T1 ein Spender (used=2 liegt im Tank) — das alte
     * "pool=0 weil kein unfilled (istHektar=0)"-Argument greift nicht mehr.
     * T0-Lücke 1.6 wird voll aus T1 gedeckt → excess[T1]=1.6, netted[T0]=1.6.
     *
     * Verifiziert: Auch ein Tab ohne istHektar ist unter Regel 7 Spender, wenn
     * er used > 0 und nicht done ist.
     */
    it('Edge B: einzelner Spender deckt Mehrbedarf voll (Regel 7, used liegt im Pool)', () => {
        w.state.reiter[0] = {
            name: 'Mehrbedarf', hektar: 10, istHektar: 11, koerner: 80000, duenger: 200,
            entries: [{ einheit: 17.6, duenger: 2000, time: '11:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[1] = {
            // Capacity ohne istHektar → unter Regel 7 trotzdem Spender (used=2)
            name: 'Capacity', hektar: 5, istHektar: 0, koerner: 80000, duenger: 200,
            entries: [{ einheit: 2, duenger: 500, time: '12:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        if (w.invalidateCarryoverCache) w.invalidateCarryoverCache();

        const co1 = w.getCarryover(0);
        const co2 = w.getCarryover(1);
        // Regel 7: T1 (used=2) ist Spender → Lücke 1.6 voll gedeckt, netted[T0]=1.6
        expect(co1.nettedEinheit).toBeCloseTo(1.6, 1);
        // excess[T1]=1.6 (T1 gibt aus seinem used)
        expect(co2.excessEinheit).toBeCloseTo(1.6, 1);
    });

    /**
     * Edge-Case C: Mehrbedarf > einzelner Spender-used (Regel 7).
     * T0: Mehrbedarf 3.2E (10ha, ist=12ha → exc=3.2)
     * T1: Spender used=5.4 (4ha, ist=4ha → solE=istE=6.4, kein Mehrbedarf)
     * T2: Spender used=2   (10ha, istHektar=0 → kein Mehrbedarf)
     *
     * Spender invers nach lastEntryTime: T2 (13:00) vor T1 (12:00).
     * T0-Lücke 3.2 wird über beide Spender gedeckt:
     *   T2 gibt 2 (ganzer used) → excess[T2]=2, Rest=1.2
     *   T1 gibt 1.2 → excess[T1]=1.2, Lücke gedeckt
     * netted[T0]=3.2 (volle Deckung, Σ Spender-used 7.4 ≥ 3.2).
     *
     * Verifiziert: Die Lücke wandert rückwärts durch mehrere Spender; jeder
     * gibt maximal seinen used-Wert. Σ excess der Spender = netted des
     * Mehrbedarf-Tabs (Materialerhaltung, Invariante I1).
     */
    it('Edge C: Mehrbedarf > Spender-used → Lücke wandert über mehrere Spender (Regel 7)', () => {
        w.state.reiter[0] = {
            name: 'Mehrbedarf', hektar: 10, istHektar: 12, koerner: 80000, duenger: 200,
            entries: [{ einheit: 19.2, duenger: 2000, time: '11:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[1] = {
            // solE=6.4, istE=6.4, usedE=5.4 → kein Mehrbedarf, Spender (used=5.4)
            name: 'PoolQuelle', hektar: 4, istHektar: 4, koerner: 80000, duenger: 200,
            entries: [{ einheit: 5.4, duenger: 700, time: '12:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[2] = {
            // Capacity, kein Mehrbedarf (istHektar=0), used=2 → Spender
            name: 'Capacity', hektar: 10, istHektar: 0, koerner: 80000, duenger: 200,
            entries: [{ einheit: 2, duenger: 500, time: '13:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        if (w.invalidateCarryoverCache) w.invalidateCarryoverCache();

        const co1 = w.getCarryover(0);
        const co3 = w.getCarryover(2);
        // Regel 7: volle Deckung über T2+T1 → netted[T0] = 3.2
        expect(co1.nettedEinheit).toBeCloseTo(3.2, 1);
        // T2 gibt seinen ganzen used=2 (spätester Spender zuerst) → excess[T2]=2.0
        // Rest 1.2 kommt aus T1.
        expect(co3.excessEinheit).toBeCloseTo(2.0, 1);
    });
});
