/**
 * Carryover-Invariante-Tests (5 Regeln als User-Spec, 2026-06-28).
 *
 * Pro Invariante: generateScenarios(seed, 200) — 200 zufällige, reproduzierbare
 * state.reiter-Konfigurationen (deterministischer Seed via mulberry32, keine
 * externe Dependency). Bei Failure: Szenario-Dump + erwarteter vs tatsächlich.
 *
 * Invarianten:
 *   I1 — Materialerhaltung
 *   I2 — Volle Mehrbedarf-Abdeckung (Netting-Back vollständig)
 *   I3 — Saat/Dünger-Unabhängigkeit
 *   I4 — Bearbeitungs-Reihenfolge bei Knappheit (Issue #368)
 *   I5 — Überfüllung im Pool (Surplus nicht-negativ, nicht ignoriert)
 *
 * Aktivator für I4: Issue #368 (PR #369, sequenzielle Greedy-Zuweisung nach
 * parseEntryTime aufsteigend). Wenn #368 nicht gemerged ist, schlägt I4 fehl.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';
import { generateScenarios } from './helpers/invariant-generator.js';

const TOL = 0.5; // Toleranz für float-Rundung (fmt rundet auf 2 NK, getTabRemaining nutzt Roh-Werte)

function dumpScenario(scenario, idx, label) {
    return `scenario[${idx}] ${label}: ` + JSON.stringify({
        koernerProEinheit: scenario.koernerProEinheit,
        reiter: scenario.reiter.map((r, i) => ({
            i, name: r.name, hektar: r.hektar, istHektar: r.istHektar,
            koerner: r.koerner, duenger: r.duenger,
            entries: r.entries,
        })),
    }, null, 2);
}

function applyScenario(w, scenario) {
    w.state.koernerProEinheit = scenario.koernerProEinheit;
    w.state.reiter = scenario.reiter;
    if (w.invalidateCarryoverCache) w.invalidateCarryoverCache();
}

// Phase-0-Aggregat (gespiegelt aus _computeNetCarryoverPools) für Test-Vergleiche.
function phase0Totals(scenario, w, material) {
    const kpe = scenario.koernerProEinheit;
    let totalSaved = 0, totalExcess = 0;
    for (const r of scenario.reiter) {
        if (material === 'E') {
            const solE = (r.hektar * r.koerner) / kpe;
            const istE = r.istHektar > 0 ? (r.istHektar * r.koerner) / kpe : 0;
            if (istE > 0) {
                if (solE > istE) totalSaved += (solE - istE);
                else if (istE > solE) totalExcess += (istE - solE);
            }
        } else {
            const solD = r.hektar * r.duenger;
            const istD = r.istHektar > 0 ? r.istHektar * r.duenger : 0;
            if (istD > 0) {
                if (solD > istD) totalSaved += (solD - istD);
                else if (istD > solD) totalExcess += (istD - solD);
            }
        }
    }
    return { totalSaved, totalExcess };
}

// Phase-0.5-Pool (gespiegelt aus computeAllCarryovers, Issue #371).
// Pool = Σ (unfilled + Ersparnis) für alle NICHT-Mehrbedarf-Tabs mit istE > 0
// (bzw. istD > 0 für Dünger). Mehrbedarf-Tabs sind Empfänger und werden
// ausgeschlossen. Ohne istE/D trägt ein Tab nichts bei (sein SOLL ist kein
// "verfügbar umverteilbares" Material).
function phase05Pool(scenario, w, material) {
    const kpe = scenario.koernerProEinheit;
    let pool = 0;
    for (const r of scenario.reiter) {
        if (material === 'E') {
            const solE = (r.hektar * r.koerner) / kpe;
            const istE = r.istHektar > 0 ? (r.istHektar * r.koerner) / kpe : 0;
            if (istE <= 0) continue;
            // Mehrbedarf-Tab ist Empfänger → excluded
            if (istE > solE) continue;
            const usedE = w.getTabUsedEinheiten(r);
            pool += Math.max(0, istE - usedE) + Math.max(0, solE - istE);
        } else {
            const solD = r.hektar * r.duenger;
            const istD = r.istHektar > 0 ? r.istHektar * r.duenger : 0;
            if (istD <= 0) continue;
            if (istD > solD) continue;
            const usedD = w.getTabUsedDuenger(r);
            pool += Math.max(0, istD - usedD) + Math.max(0, solD - istD);
        }
    }
    return pool;
}

describe('Carryover-Invarianten (5 User-Regeln 2026-06-28)', () => {
    let w;
    const SEED = 0xC0FFEE;
    const COUNT = 200;

    beforeEach(() => {
        const result = createDom();
        w = result.window;
    });

    // ─────────────────────────────────────────────────────────────────────────
    // I1 — Materialerhaltung
    //
    // "Für jedes Material separat gilt: Σ remaining(alle Tabs) entspricht dem
    // korrekt genetteten Restbedarf. Material darf weder entstehen noch
    // verschwinden."
    //
    // → getTabRemaining(r, idx).remainingE MUSS exakt der dokumentierten
    //   Formel entsprechen: max(0, basisE − usedE − savedEinheit +
    //   excessEinheit − nettedEinheit). Same für Dünger. Material kann nur
    //   durch den max(0, …)-Clamp verschwinden (Tab mit Überfüllung), nie
    //   durch stille Rundungs- oder Rechenfehler.
    // ─────────────────────────────────────────────────────────────────────────
    describe('I1 — Materialerhaltung', () => {
        it('getTabRemaining(r, idx).remainingE matched Formel über 200 Szenarien', () => {
            const scenarios = generateScenarios(SEED, COUNT);
            for (let s = 0; s < scenarios.length; s++) {
                applyScenario(w, scenarios[s]);
                const cos = scenarios[s].reiter.map((_, i) => w.getCarryover(i));
                for (let i = 0; i < scenarios[s].reiter.length; i++) {
                    const r = scenarios[s].reiter[i];
                    const co = cos[i];
                    const rem = w.getTabRemaining(r, i);
                    const usedE = w.getTabUsedEinheiten(r);
                    const usedD = w.getTabUsedDuenger(r);
                    const istE = w.getTabIstEinheiten(r);
                    const istD = w.getTabIstDuenger(r);
                    const basisE = istE > 0 ? istE : w.getTabTotalEinheiten(r);
                    const basisD = istD > 0 ? istD : w.getTabTotalDuenger(r);
                    const expectedE = Math.max(0, basisE - usedE - co.savedEinheit + co.excessEinheit - co.nettedEinheit);
                    const expectedD = Math.max(0, basisD - usedD - co.savedDuenger + co.excessDuenger - co.nettedDuenger);
                    if (Math.abs(rem.remainingE - expectedE) > TOL) {
                        throw new Error(
                            `I1 Saat-Fehler in scenario[${s}] tab[${i}]: ` +
                            `expected ${expectedE.toFixed(3)}, got ${rem.remainingE.toFixed(3)}\n` +
                            dumpScenario(scenarios[s], s, `tab=${i} co=${JSON.stringify(co)}`)
                        );
                    }
                    if (Math.abs(rem.remainingD - expectedD) > TOL) {
                        throw new Error(
                            `I1 Dünger-Fehler in scenario[${s}] tab[${i}]: ` +
                            `expected ${expectedD.toFixed(3)}, got ${rem.remainingD.toFixed(3)}\n` +
                            dumpScenario(scenarios[s], s, `tab=${i} co=${JSON.stringify(co)}`)
                        );
                    }
                    // Conservation: remaining darf nicht negativ sein (Materialerhaltung)
                    expect(rem.remainingE).toBeGreaterThanOrEqual(-TOL);
                    expect(rem.remainingD).toBeGreaterThanOrEqual(-TOL);
                }
            }
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // I2 — Volle Mehrbedarf-Abdeckung (Netting-Back vollständig)
    //
    // "Wenn der Phase-0.5-Pool ≥ totalExcess für ein Material, dann ist der
    // Mehrbedarf jedes Mehrbedarf-Tabs komplett genettet."
    //
    // → Issue #371 (Regel 6): Pool wurde erweitert von min(totalSaved, totalExcess)
    //   (= nur IST<SOLL-Ersparnis) auf Σ (unfilled + Ersparnis) über alle
    //   NICHT-Mehrbedarf-Tabs. Damit gilt die volle Abdeckung jetzt auch in
    //   Szenarien ohne Ersparnis-Tabs, in denen neutrale Tabs un-filled Material
    //   beitragen (User-Verifikation: Tab3 hat used<basis, deckt Tab1 Mehrbedarf).
    //   Bestehende Szenarien mit totalSaved ≥ totalExcess bleiben gültig, da
    //   Ersparnis ⊂ phase05Pool. Neue Szenarien mit Pool aus neutralen
    //   unfilled-Tabs kommen hinzu.
    //   Schwächere Bedingung: phase05Pool ≥ totalExcess → volle Abdeckung.
    // ─────────────────────────────────────────────────────────────────────────
    describe('I2 — Volle Mehrbedarf-Abdeckung', () => {
        it('bei phase05Pool ≥ totalExcess: Σ netted === Σ exc für Saat + Dünger', () => {
            const scenarios = generateScenarios(SEED, COUNT);
            let fullCoverageSaat = 0;
            let fullCoverageDuenger = 0;
            for (let s = 0; s < scenarios.length; s++) {
                applyScenario(w, scenarios[s]);
                const cos = scenarios[s].reiter.map((_, i) => w.getCarryover(i));
                const totSaat = phase0Totals(scenarios[s], w, 'E');
                const totDuenger = phase0Totals(scenarios[s], w, 'D');

                // SAAT
                const poolSaat = phase05Pool(scenarios[s], w, 'E');
                if (totSaat.totalExcess > 0 && poolSaat >= totSaat.totalExcess) {
                    fullCoverageSaat++;
                    let sumNetted = 0, sumExc = 0;
                    for (let i = 0; i < scenarios[s].reiter.length; i++) {
                        const r = scenarios[s].reiter[i];
                        const istE = w.getTabIstEinheiten(r);
                        const solE = w.getTabTotalEinheiten(r);
                        if (istE > solE && istE > 0) {
                            sumNetted += cos[i].nettedEinheit;
                            sumExc += (istE - solE);
                        }
                    }
                    if (Math.abs(sumNetted - sumExc) > TOL) {
                        throw new Error(
                            `I2 Saat-Fehler scenario[${s}]: ` +
                            `Σ nettedEinheit=${sumNetted.toFixed(3)} ≠ Σ exc=${sumExc.toFixed(3)} ` +
                            `(pool=${poolSaat.toFixed(2)}, totalExcess=${totSaat.totalExcess.toFixed(2)})\n` +
                            dumpScenario(scenarios[s], s, '')
                        );
                    }
                }
                // DÜNGER
                const poolDuenger = phase05Pool(scenarios[s], w, 'D');
                if (totDuenger.totalExcess > 0 && poolDuenger >= totDuenger.totalExcess) {
                    fullCoverageDuenger++;
                    let sumNetted = 0, sumExc = 0;
                    for (let i = 0; i < scenarios[s].reiter.length; i++) {
                        const r = scenarios[s].reiter[i];
                        const istD = w.getTabIstDuenger(r);
                        const solD = w.getTabTotalDuenger(r);
                        if (istD > solD && istD > 0) {
                            sumNetted += cos[i].nettedDuenger;
                            sumExc += (istD - solD);
                        }
                    }
                    if (Math.abs(sumNetted - sumExc) > TOL) {
                        throw new Error(
                            `I2 Dünger-Fehler scenario[${s}]: ` +
                            `Σ nettedDuenger=${sumNetted.toFixed(3)} ≠ Σ exc=${sumExc.toFixed(3)} ` +
                            `(pool=${poolDuenger.toFixed(2)}, totalExcess=${totDuenger.totalExcess.toFixed(2)})\n` +
                            dumpScenario(scenarios[s], s, '')
                        );
                    }
                }
            }
            // Sanity: mindestens ein paar Fälle geprüft
            expect(fullCoverageSaat + fullCoverageDuenger).toBeGreaterThan(0);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // I3 — Saat/Dünger-Unabhängigkeit
    //
    // "Veränderung der Saat-Werte in einem Tab verändert nicht die
    // Dünger-Carryover-Werte eines anderen Tabs (und umgekehrt)."
    //
    // → Saat- und Dünger-Pools sind unabhängig (Regel 4 der Spec).
    //   Mutation von Saat-Inputs (koerner, hektar) darf Dünger-Carryover
    //   (savedDuenger, excessDuenger, nettedDuenger) in keinem Tab verändern.
    //   Symmetrisch für Dünger → Saat.
    // ─────────────────────────────────────────────────────────────────────────
    describe('I3 — Saat/Dünger-Unabhängigkeit', () => {
        it('Mutation von Saat-Werten ändert keine Dünger-Carryover-Felder', () => {
            const scenarios = generateScenarios(SEED, COUNT);
            let violations = 0;
            for (let s = 0; s < scenarios.length; s++) {
                applyScenario(w, scenarios[s]);
                const before = scenarios[s].reiter.map((_, i) => {
                    const c = w.getCarryover(i);
                    return { savedDuenger: c.savedDuenger, excessDuenger: c.excessDuenger, nettedDuenger: c.nettedDuenger };
                });
                // Mutation: Saat-Werte in Tab 0 verändern (koerner × 1.5)
                const mutated = JSON.parse(JSON.stringify(scenarios[s]));
                mutated.reiter[0].koerner = Math.round(mutated.reiter[0].koerner * 1.5);
                applyScenario(w, mutated);
                const after = scenarios[s].reiter.map((_, i) => {
                    const c = w.getCarryover(i);
                    return { savedDuenger: c.savedDuenger, excessDuenger: c.excessDuenger, nettedDuenger: c.nettedDuenger };
                });
                for (let i = 0; i < before.length; i++) {
                    if (Math.abs(before[i].savedDuenger - after[i].savedDuenger) > TOL ||
                        Math.abs(before[i].excessDuenger - after[i].excessDuenger) > TOL ||
                        Math.abs(before[i].nettedDuenger - after[i].nettedDuenger) > TOL) {
                        violations++;
                        throw new Error(
                            `I3 Saat→Dünger-Leck scenario[${s}] tab[${i}]: ` +
                            `Dünger-Carryover änderte sich nach Saat-Mutation\n` +
                            `before: ${JSON.stringify(before[i])}\n` +
                            `after:  ${JSON.stringify(after[i])}\n` +
                            dumpScenario(scenarios[s], s, `tab=${i}`)
                        );
                    }
                }
            }
            // violations === 0 ist das gewünschte Ergebnis. Wir loggen nur,
            // wenn GAR KEINE Dünger-Carryover-Werte existieren (=trivial).
            if (violations === 0) {
                // Informativ: erfolgreich (0 = keine Lecks gefunden)
                console.log(`I3 Saat→Dünger: 0 Lecks über ${COUNT} Szenarien ✓`);
            }
        });

        it('Mutation von Dünger-Werten ändert keine Saat-Carryover-Felder', () => {
            const scenarios = generateScenarios(SEED, COUNT);
            let violations = 0;
            for (let s = 0; s < scenarios.length; s++) {
                applyScenario(w, scenarios[s]);
                const before = scenarios[s].reiter.map((_, i) => {
                    const c = w.getCarryover(i);
                    return { savedEinheit: c.savedEinheit, excessEinheit: c.excessEinheit, nettedEinheit: c.nettedEinheit };
                });
                // Mutation: Dünger-Werte in Tab 0 verändern (duenger × 2, gedeckelt)
                const mutated = JSON.parse(JSON.stringify(scenarios[s]));
                mutated.reiter[0].duenger = Math.min(300, mutated.reiter[0].duenger * 2);
                applyScenario(w, mutated);
                const after = scenarios[s].reiter.map((_, i) => {
                    const c = w.getCarryover(i);
                    return { savedEinheit: c.savedEinheit, excessEinheit: c.excessEinheit, nettedEinheit: c.nettedEinheit };
                });
                for (let i = 0; i < before.length; i++) {
                    if (Math.abs(before[i].savedEinheit - after[i].savedEinheit) > TOL ||
                        Math.abs(before[i].excessEinheit - after[i].excessEinheit) > TOL ||
                        Math.abs(before[i].nettedEinheit - after[i].nettedEinheit) > TOL) {
                        violations++;
                        throw new Error(
                            `I3 Dünger→Saat-Leck scenario[${s}] tab[${i}]: ` +
                            `Saat-Carryover änderte sich nach Dünger-Mutation\n` +
                            `before: ${JSON.stringify(before[i])}\n` +
                            `after:  ${JSON.stringify(after[i])}\n` +
                            dumpScenario(scenarios[s], s, `tab=${i}`)
                        );
                    }
                }
            }
            if (violations === 0) {
                console.log(`I3 Dünger→Saat: 0 Lecks über ${COUNT} Szenarien ✓`);
            }
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // I4 — Bearbeitungs-Reihenfolge bei Knappheit (Issue #368, PR #369)
    //
    // "Wenn phase05Pool < totalExcess, wird der früher bearbeitete Mehrbedarf-Tab
    // (parseEntryTime) zuerst komplett abgedeckt, bevor der nächste etwas
    // bekommt."
    //
    // → Sequenzielle Greedy-Zuweisung (nicht pro-rata) nach Bearbeitungs-
    //   Reihenfolge (parseEntryTime(lastEntry.time) aufsteigend, Tiebreaker
    //   Tab-Index aufsteigend). Pool = phase05Pool (Regel 6, Issue #371) =
    //   Σ (unfilled + Ersparnis) über alle nicht-Mehrbedarf-Tabs mit istE > 0.
    //   Der k-te Tab in der Reihenfolge erhält: netted = min(excK,
    //   max(0, pool − cumExcessVorK)).
    //   Trigger-Bedingung: Knappheit = phase05Pool < totalExcess. Vor #371
    //   war es `totalSaved < totalExcess` (äquivalent für Szenarien ohne
    //   unfilled-Quellen), jetzt umfassender.
    // ─────────────────────────────────────────────────────────────────────────
    describe('I4 — Bearbeitungs-Reihenfolge bei Knappheit (Issue #368)', () => {
        it('Sortierung parseEntryTime aufsteigend mit Tab-Index-Tiebreaker', () => {
            const scenarios = generateScenarios(SEED, COUNT);
            let scarcityCasesSaat = 0;
            let scarcityCasesDuenger = 0;
            for (let s = 0; s < scenarios.length; s++) {
                applyScenario(w, scenarios[s]);
                const cos = scenarios[s].reiter.map((_, i) => w.getCarryover(i));

                // ── SAAT ─────────────────────────────────────────────────
                const totSaat = phase0Totals(scenarios[s], w, 'E');
                const poolSaat = phase05Pool(scenarios[s], w, 'E');
                if (totSaat.totalExcess > 0 && poolSaat < totSaat.totalExcess) {
                    scarcityCasesSaat++;
                    const mehrbedarfTabs = [];
                    for (let i = 0; i < scenarios[s].reiter.length; i++) {
                        const r = scenarios[s].reiter[i];
                        const istE = w.getTabIstEinheiten(r);
                        const solE = w.getTabTotalEinheiten(r);
                        if (istE > solE && istE > 0) {
                            const lastT = w.parseEntryTime(w.getTabLastEntryTime(r));
                            mehrbedarfTabs.push({ i, exc: istE - solE, time: lastT });
                        }
                    }
                    if (mehrbedarfTabs.length === 0) continue;
                    mehrbedarfTabs.sort((a, b) => a.time - b.time || a.i - b.i);
                    let cumExcess = 0;
                    for (let k = 0; k < mehrbedarfTabs.length; k++) {
                        const t = mehrbedarfTabs[k];
                        const expectedNetted = Math.min(t.exc, Math.max(0, poolSaat - cumExcess));
                        const actualNetted = cos[t.i].nettedEinheit;
                        if (Math.abs(actualNetted - expectedNetted) > TOL) {
                            throw new Error(
                                `I4 Saat-Fehler scenario[${s}] tab[${t.i}]: ` +
                                `expected netted=${expectedNetted.toFixed(3)}, got ${actualNetted.toFixed(3)} ` +
                                `(rank ${k + 1}/${mehrbedarfTabs.length}, exc=${t.exc.toFixed(2)}, ` +
                                `time=${t.time}, cumExcessBefore=${cumExcess.toFixed(2)}, pool=${poolSaat.toFixed(2)})\n` +
                                dumpScenario(scenarios[s], s, `tab=${t.i}`)
                            );
                        }
                        cumExcess += t.exc;
                    }
                }

                // ── DÜNGER ───────────────────────────────────────────────
                const totDuenger = phase0Totals(scenarios[s], w, 'D');
                const poolDuenger = phase05Pool(scenarios[s], w, 'D');
                if (totDuenger.totalExcess > 0 && poolDuenger < totDuenger.totalExcess) {
                    scarcityCasesDuenger++;
                    const mehrbedarfTabs = [];
                    for (let i = 0; i < scenarios[s].reiter.length; i++) {
                        const r = scenarios[s].reiter[i];
                        const istD = w.getTabIstDuenger(r);
                        const solD = w.getTabTotalDuenger(r);
                        if (istD > solD && istD > 0) {
                            const lastT = w.parseEntryTime(w.getTabLastEntryTime(r));
                            mehrbedarfTabs.push({ i, exc: istD - solD, time: lastT });
                        }
                    }
                    if (mehrbedarfTabs.length === 0) continue;
                    mehrbedarfTabs.sort((a, b) => a.time - b.time || a.i - b.i);
                    let cumExcess = 0;
                    for (let k = 0; k < mehrbedarfTabs.length; k++) {
                        const t = mehrbedarfTabs[k];
                        const expectedNetted = Math.min(t.exc, Math.max(0, poolDuenger - cumExcess));
                        const actualNetted = cos[t.i].nettedDuenger;
                        if (Math.abs(actualNetted - expectedNetted) > TOL) {
                            throw new Error(
                                `I4 Dünger-Fehler scenario[${s}] tab[${t.i}]: ` +
                                `expected netted=${expectedNetted.toFixed(3)}, got ${actualNetted.toFixed(3)} ` +
                                `(rank ${k + 1}/${mehrbedarfTabs.length}, exc=${t.exc.toFixed(2)}, ` +
                                `time=${t.time}, cumExcessBefore=${cumExcess.toFixed(2)}, pool=${poolDuenger.toFixed(2)})\n` +
                                dumpScenario(scenarios[s], s, `tab=${t.i}`)
                            );
                        }
                        cumExcess += t.exc;
                    }
                }
            }
            // Sanity: mindestens ein paar Knappheits-Fälle geprüft
            expect(scarcityCasesSaat + scarcityCasesDuenger).toBeGreaterThan(0);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // I5 — Überfüllung im Pool
    //
    // "Wenn ein Tab used > basis hat, dann ist selfExcess = used − basis
    // Bestandteil des Verteil-Pools (nicht negativ, nicht ignoriert)."
    //
    // → Mehrbedarf eines einzelnen Tabs (`istE − solE` für Saat, bzw.
    //   `istD − solD` für Dünger) wird im Pool erfasst und an andere Tabs
    //   weitergegeben ODER via Netting zurück an den Mehrbedarf-Tab selbst
    //   (nettedEinheit). Der Überschuss darf nicht verschwinden, nicht
    //   negativ werden, und nicht stillschweigend übergangen werden.
    //   Testet:
    //     (a) Σ(nettedEinheit) über Mehrbedarf-Tabs ≤ Σ(istE − solE) (kein
    //         Über-Netting, kein Phantoms-Material).
    //     (b) nettedEinheit ≥ 0 für alle Tabs (kein negatives Netting).
    //     (c) Bei voller Deckung (saved ≥ excess) gilt sogar
    //         Σ netted === Σ exc (I2-Konsistenz).
    // ─────────────────────────────────────────────────────────────────────────
    describe('I5 — Überfüllung im Pool', () => {
        it('Mehrbedarf-Überschuss: nie negativ, nie über-nettet', () => {
            const scenarios = generateScenarios(SEED, COUNT);
            let mehrbedarfSaat = 0;
            let mehrbedarfDuenger = 0;
            let fullCoverageSaatViolations = 0;
            let fullCoverageDuengerViolations = 0;
            for (let s = 0; s < scenarios.length; s++) {
                applyScenario(w, scenarios[s]);
                const cos = scenarios[s].reiter.map((_, i) => w.getCarryover(i));
                const totSaat = phase0Totals(scenarios[s], w, 'E');
                const totDuenger = phase0Totals(scenarios[s], w, 'D');

                // SAAT
                let sumNetted = 0, sumExc = 0;
                for (let i = 0; i < scenarios[s].reiter.length; i++) {
                    const r = scenarios[s].reiter[i];
                    const istE = w.getTabIstEinheiten(r);
                    const solE = w.getTabTotalEinheiten(r);
                    if (istE > solE && istE > 0) {
                        mehrbedarfSaat++;
                        sumExc += (istE - solE);
                        sumNetted += cos[i].nettedEinheit;
                        // Kein Tab darf negative Netting-Werte haben
                        expect(cos[i].nettedEinheit).toBeGreaterThanOrEqual(-TOL);
                        expect(cos[i].excessEinheit).toBeGreaterThanOrEqual(-TOL);
                        expect(cos[i].savedEinheit).toBeGreaterThanOrEqual(-TOL);
                    }
                }
                // (a) Σ netted ≤ Σ exc (kein Über-Netting)
                if (sumNetted - sumExc > TOL) {
                    throw new Error(
                        `I5 Saat-Über-Netting scenario[${s}]: ` +
                        `Σ nettedEinheit=${sumNetted.toFixed(3)} > ` +
                        `Σ (ist-sol)=${sumExc.toFixed(3)}\n` +
                        dumpScenario(scenarios[s], s, '')
                    );
                }
                // (c) Volle Deckung: Σ netted === Σ exc (Konsistenz mit I2)
                if (totSaat.totalSaved >= totSaat.totalExcess && sumExc > 0 &&
                    Math.abs(sumNetted - sumExc) > TOL) {
                    fullCoverageSaatViolations++;
                    throw new Error(
                        `I5 Saat-Volldeckung-Inkonsistenz scenario[${s}]: ` +
                        `Σ netted=${sumNetted.toFixed(3)} ≠ Σ exc=${sumExc.toFixed(3)} bei ` +
                        `totalSaved=${totSaat.totalSaved.toFixed(2)}, totalExcess=${totSaat.totalExcess.toFixed(2)}\n` +
                        dumpScenario(scenarios[s], s, '')
                    );
                }

                // DÜNGER
                let sumNettedD = 0, sumExcD = 0;
                for (let i = 0; i < scenarios[s].reiter.length; i++) {
                    const r = scenarios[s].reiter[i];
                    const istD = w.getTabIstDuenger(r);
                    const solD = w.getTabTotalDuenger(r);
                    if (istD > solD && istD > 0) {
                        mehrbedarfDuenger++;
                        sumExcD += (istD - solD);
                        sumNettedD += cos[i].nettedDuenger;
                        expect(cos[i].nettedDuenger).toBeGreaterThanOrEqual(-TOL);
                        expect(cos[i].excessDuenger).toBeGreaterThanOrEqual(-TOL);
                        expect(cos[i].savedDuenger).toBeGreaterThanOrEqual(-TOL);
                    }
                }
                if (sumNettedD - sumExcD > TOL) {
                    throw new Error(
                        `I5 Dünger-Über-Netting scenario[${s}]: ` +
                        `Σ nettedDuenger=${sumNettedD.toFixed(3)} > ` +
                        `Σ (ist-sol)=${sumExcD.toFixed(3)}\n` +
                        dumpScenario(scenarios[s], s, '')
                    );
                }
                if (totDuenger.totalSaved >= totDuenger.totalExcess && sumExcD > 0 &&
                    Math.abs(sumNettedD - sumExcD) > TOL) {
                    fullCoverageDuengerViolations++;
                    throw new Error(
                        `I5 Dünger-Volldeckung-Inkonsistenz scenario[${s}]: ` +
                        `Σ netted=${sumNettedD.toFixed(3)} ≠ Σ exc=${sumExcD.toFixed(3)} bei ` +
                        `totalSaved=${totDuenger.totalSaved.toFixed(2)}, totalExcess=${totDuenger.totalExcess.toFixed(2)}\n` +
                        dumpScenario(scenarios[s], s, '')
                    );
                }
            }
            // Sanity: mindestens einige Mehrbedarf-Tabs geprüft
            expect(mehrbedarfSaat + mehrbedarfDuenger).toBeGreaterThan(0);
            // (c) Sanity: in keinem Szenario verletzt (sonst throw oben)
            expect(fullCoverageSaatViolations).toBe(0);
            expect(fullCoverageDuengerViolations).toBe(0);
        });
    });
});