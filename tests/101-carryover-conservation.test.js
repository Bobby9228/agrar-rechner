/**
 * Carryover-Aggregat-Erhaltung — Doppelzählungs-Wächter (Fix "− netted").
 *
 * Regel-7-Fix-Formel: remaining_i = max(0, basis_i − used_i + entzogen_i − netted_i).
 * Da in computeAllCarryovers jede Einheit, die einem Spender entzogen wird
 * (entzogen), exakt einen Empfänger-Mehrbedarf deckt (netted) — also
 * Σ entzogen === Σ netted — hebt sich das in der Aggregatsumme auf:
 *
 *   Σ remaining_i = Σ(basis_i − used_i)   (ohne Clamping durch überfüllte Tabs)
 *
 * Vor dem Fix fehlte "− netted" → die gedeckte Mehrbedarfsmenge tauchte BEIDE
 * Male auf: einmal im Empfänger-remaining (Lücke nicht abgezogen) UND einmal
 * im Spender-remaining (via +entzogen). Das Aggregat war um Σ netted zu hoch.
 * Genau das vom User bemängelte "Mehrbedarf wird zweimal angezeigt".
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';
import { generateScenarios } from './helpers/invariant-generator.js';

const TOL = 0.5;

describe('Carryover-Aggregat-Erhaltung (Doppelzählungs-Wächter, Fix − netted)', () => {
    let w;
    beforeEach(() => { w = createDom().window; });

    function apply(scenario) {
        w.state.koernerProEinheit = scenario.koernerProEinheit;
        w.state.reiter = scenario.reiter;
        if (w.invalidateCarryoverCache) w.invalidateCarryoverCache();
    }

    function sums(rems) {
        const sumRem = { E: 0, D: 0 };
        const phys = { E: 0, D: 0 };
        for (const r of rems) {
            sumRem.E += r.remainingE; sumRem.D += r.remainingD;
            phys.E += (r.basisE - r.usedE); phys.D += (r.basisD - r.usedD);
        }
        return { sumRem, phys };
    }

    it('Clean-Szenarien (kein Clamping): Σ remaining === Σ(basis − used) — kein Phantom-Bedarf', () => {
        const scenarios = generateScenarios(0xC0FFEE, 400);
        let checkedSaat = 0, checkedDuenger = 0;
        for (let s = 0; s < scenarios.length; s++) {
            apply(scenarios[s]);
            const rems = scenarios[s].reiter.map((r, i) => w.getTabRemaining(r, i));
            const cos = scenarios[s].reiter.map((_, i) => w.getCarryover(i));
            const nettedE = cos.reduce((a, c) => a + c.nettedEinheit, 0);
            const nettedD = cos.reduce((a, c) => a + c.nettedDuenger, 0);
            const { sumRem, phys } = sums(rems);

            // "Clean" = kein Tab wird gecclampet, d.h. der UNGECLAMPTE Wert
            //   raw = basis − used + excess − netted ≥ 0 für jeden Tab.
            //   (used ≤ basis reicht NICHT: ein Empfänger mit used > sol wird trotz
            //    used ≤ ist gecclampet.) Nur dann ist max(0, raw) = raw und die
            //    Aggregatsumme hält exakt.
            const cleanSaat = rems.every((r, i) =>
                (r.basisE - r.usedE + cos[i].excessEinheit - cos[i].nettedEinheit) >= -TOL);
            const cleanDuenger = rems.every((r, i) =>
                (r.basisD - r.usedD + cos[i].excessDuenger - cos[i].nettedDuenger) >= -TOL);

            if (cleanSaat) {
                checkedSaat++;
                // Fix: Σ remaining === Σ(basis − used). Bug: + Σ netted (zu hoch).
                if (Math.abs(sumRem.E - phys.E) > TOL) {
                    throw new Error(
                        `Aggregat Saat nicht erhalten (clean) Szenario[${s}]: ` +
                        `Σrem=${sumRem.E.toFixed(3)} ≠ phys=${phys.E.toFixed(3)} ` +
                        `(Σnetted=${nettedE.toFixed(3)})\n` +
                        JSON.stringify(scenarios[s].reiter.map((r, i) => ({
                            i, hektar: r.hektar, istHektar: r.istHektar, koerner: r.koerner,
                            duenger: r.duenger, entries: r.entries, co: cos[i]
                        })), null, 2)
                    );
                }
            }
            if (cleanDuenger) {
                checkedDuenger++;
                if (Math.abs(sumRem.D - phys.D) > TOL) {
                    throw new Error(
                        `Aggregat Dünger nicht erhalten (clean) Szenario[${s}]: ` +
                        `Σrem=${sumRem.D.toFixed(3)} ≠ phys=${phys.D.toFixed(3)} ` +
                        `(Σnetted=${nettedD.toFixed(3)})`
                    );
                }
            }
        }
        // Sanity: mindestens ein Clean-Szenario geprüft.
        expect(checkedSaat + checkedDuenger).toBeGreaterThan(0);
    });

    it('Alle Szenarien: Σ remaining ≥ Σ(basis − used) (Clamping durch Überfüllung darf nur addieren)', () => {
        const scenarios = generateScenarios(0xC0FFEE, 400);
        for (let s = 0; s < scenarios.length; s++) {
            apply(scenarios[s]);
            const rems = scenarios[s].reiter.map((r, i) => w.getTabRemaining(r, i));
            const { sumRem, phys } = sums(rems);
            // max(0, …) lässt die Summe nur WACHSEN, nie schrumpfen → nie unter phys.
            expect(sumRem.E).toBeGreaterThanOrEqual(phys.E - TOL);
            expect(sumRem.D).toBeGreaterThanOrEqual(phys.D - TOL);
        }
    });

    it('3-Tab-User-Szenario: Σ remaining = 7 E / 600 kg (= Σ basis − Σ used, vor Fix 8 / 700)', () => {
        // Issue #347-Setup (T2 = Mehrbedarf 1 E / 100 kg, gedeckt durch T3).
        w.state.koernerProEinheit = 50000;
        w.state.reiter = [
            { name: 'T1', hektar: 10, istHektar: 9, koerner: 100000, duenger: 200,
              entries: [{ einheit: 18, duenger: 1800, time: '08:00' }] },
            { name: 'T2', hektar: 7.5, istHektar: 8, koerner: 100000, duenger: 200,
              entries: [{ einheit: 11, duenger: 1500, time: '09:00' }] },
            { name: 'T3', hektar: 5, istHektar: 5, koerner: 100000, duenger: 200,
              entries: [{ einheit: 8, duenger: 500, time: '10:00' }] },
        ];
        w.invalidateCarryoverCache();
        const rems = w.state.reiter.map((r, i) => w.getTabRemaining(r, i));
        const { sumRem, phys } = sums(rems);
        // Fix: T1=0, T2=4, T3=3 → 7 E; Dünger 0 + 0 + 600 → 600 kg.
        expect(sumRem.E).toBeCloseTo(7, 1);
        expect(sumRem.D).toBeCloseTo(600, 0);
        // Aggregat entspricht exakt dem physischen Gesamtbedarf.
        expect(sumRem.E).toBeCloseTo(phys.E, 1);
        expect(sumRem.D).toBeCloseTo(phys.D, 0);
        // Der Mehrbedarf (1 E / 100 kg) taucht nur EINMAL auf (in T3 als
        // entzogen), nicht zusätzlich in T2 → kein Doppelzählen.
        expect(rems[1].remainingE).toBeCloseTo(4, 1); // T2: 16-11-1(netted) = 4
        expect(rems[1].remainingD).toBeCloseTo(0, 0); // T2 Dünger: 1600-1500-100 = 0
    });
});
