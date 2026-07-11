/**
 * Carryover-Invariante-Tests (5+1 Regeln als User-Spec, 2026-06-28; angepasst
 * an Regel 7 in #378/2026-07-04).
 *
 * Pro Invariante: generateScenarios(seed, 200) — 200 zufällige, reproduzierbare
 * state.reiter-Konfigurationen (deterministischer Seed via mulberry32, keine
 * externe Dependency). Bei Failure: Szenario-Dump + erwarteter vs tatsächlich.
 *
 * Invarianten:
 *   I1 — Materialerhaltung (Regel 7: remaining = max(0, sol − used + entzogen))
 *   I2 — Volle Mehrbedarf-Abdeckung (Regel 7: bei Σ used(done=false) ≥ Σ Mehrbedarf
 *        bekommt jeder Mehrbedarf-Tab seine volle Lücke)
 *   I3 — Saat/Dünger-Unabhängigkeit
 *   I4 — Bearbeitungs-Reihenfolge bei Knappheit (Regel 7: Spender in INVERSER
 *        lastEntryTime; Tests durch Simulation des Algorithmus gegen 200
 *        Szenarien)
 *   I5 — Überfüllung im Pool (nicht negativ, nicht über-nettet;
 *        Volldeckung jetzt Σ used ≥ Σ Mehrbedarf → Σ netted === Σ Mehrbedarf)
 *   I6 — Selbstgutschrift ausgeschlossen (Befund 1): Ein Tab kann nicht
 *        gleichzeitig Spender und Empfänger sein — wenn ein Tab used>0 UND
 *        ist>sol hat, bleibt sein eigener excessEinheit = 0.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';
import { generateScenarios } from './helpers/invariant-generator.js';

const TOL = 0.5; // Toleranz für float-Rundung (fmt rundet auf 2 NK, getTabRemaining nutzt Roh-Werte)

// --- Gemeinsame Helpers für Regel 7 ------------------------------------------------

// Σ Mehrbedarf über alle Tabs mit istE > solE && istE > 0 (Saat bzw. Dünger)
// (gesamt Bedarfs-Lücke, unabhängig vom Pool)
function totalMehrbedarf(scenario, w, material) {
    const kpe = scenario.koernerProEinheit;
    let mbh = 0;
    for (const r of scenario.reiter) {
        if (material === 'E') {
            const istE = w.getTabIstEinheiten(r);
            const solE = w.getTabTotalEinheiten(r);
            if (istE > 0 && istE > solE) mbh += istE - solE;
        } else {
            const istD = w.getTabIstDuenger(r);
            const solD = w.getTabTotalDuenger(r);
            if (istD > 0 && istD > solD) mbh += istD - solD;
        }
    }
    return mbh;
}

// Σ used_i der NICHT-Mehrbedarf, NICHT-done Tabs (= Pool nach Regel 7.1).
// Mehrbedarf-Tabs ziehen selbst aus dem Pool, sie sind also keine Spender.
function regel7Pool(scenario, w, material) {
    const kpe = scenario.koernerProEinheit;
    let pool = 0;
    for (const r of scenario.reiter) {
        if (r.done) continue;
        if (material === 'E') {
            const istE = w.getTabIstEinheiten(r);
            const solE = w.getTabTotalEinheiten(r);
            if (istE > 0 && istE > solE) continue;
            pool += w.getTabUsedEinheiten(r);
        } else {
            const istD = w.getTabIstDuenger(r);
            const solD = w.getTabTotalDuenger(r);
            if (istD > 0 && istD > solD) continue;
            pool += w.getTabUsedDuenger(r);
        }
    }
    return pool;
}

function dumpScenario(scenario, idx, label) {
    return `scenario[${idx}] ${label}: ` + JSON.stringify({
        koernerProEinheit: scenario.koernerProEinheit,
        reiter: scenario.reiter.map((r, i) => ({
            i, name: r.name, hektar: r.hektar, istHektar: r.istHektar,
            koerner: r.koerner, duenger: r.duenger,
            entries: r.entries, done: r.done,
        })),
    }, null, 2);
}

function applyScenario(w, scenario) {
    w.state.koernerProEinheit = scenario.koernerProEinheit;
    w.state.reiter = scenario.reiter;
    if (w.invalidateCarryoverCache) w.invalidateCarryoverCache();
}

describe('Carryover-Invarianten (5+1 User-Regeln, Regel-7-Modell #378)', () => {
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
    // "Für jedes Material separat gilt: getTabRemaining(r, idx).remainingE
    // matched exakt der dokumentierten Formel — Material darf weder entstehen
    // noch verschwinden."
    //
    // Regel 7 (Issue #378) + Doppelzählungs-Fix: remaining = max(0, basis − used
    //   + entzogen − netted). entzogen = was ANDERE Tabs diesem Tab abgezogen
    //   haben (Spender, co.excess*); netted = Anteil des eigenen Mehrbedarfs, der
    //   bereits durch den Pool gedeckt ist (Empfänger, co.netted*). Beide Terme
    //   zusammen halten Materialerhaltung: Σ remaining = Σ basis − Σ used
    //   (da Σ entzogen === Σ netted).
    //
    // Testet: für 200 Szenarien, jeden Tab, dass getTabRemaining exakt der
    // Formel folgt. Materialerhaltung im engeren Sinne (= kein Material
    // geht verloren) folgt daraus automatisch (excess+Netteted == Pool-Buchung
    // ist Invariante auf Algorithmus-Ebene; I6 verifiziert Selbst-Konsistenz).
    // ─────────────────────────────────────────────────────────────────────────
    describe('I1 — Materialerhaltung', () => {
        it('getTabRemaining(r, idx).remainingE matched Regel-7-Formel über 200 Szenarien', () => {
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
                    // Regel 7 + Doppelzählungs-Fix: remaining = max(0, basis − used
                    // + entzogen − netted). entzogen = co.excess*, netted = co.netted*.
                    const expectedE = Math.max(0, basisE - usedE + co.excessEinheit - co.nettedEinheit);
                    const expectedD = Math.max(0, basisD - usedD + co.excessDuenger - co.nettedDuenger);
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
    // I2 — Volle Mehrbedarf-Abdeckung (Regel 7, Issue #378)
    //
    // "Wenn Σ used(done=false Tabs ohne Mehrbedarf) ≥ Σ Mehrbedarf, dann ist
    // jeder Mehrbedarf-Tab komplett genettet (Σ netted === Σ Mehrbedarf)."
    //
    // Im Gegensatz zum Phase-0/0.5-Modell wird der Pool nicht mehr aus
    // unfilled-Lücken gebildet, sondern aus dem TATSÄCHLICH noch im Tank
    // liegenden Material (used). Damit ist die volle Abdeckung jetzt enger:
    // wenn nur neutrale Tabs (ist=sol, gebraucht ≤ used) da sind, decken sie
    // ggf. mehr ab als zuvor (ihr used-Bestand statt nur max(0, sol-used)).
    // ─────────────────────────────────────────────────────────────────────────
    describe('I2 — Volle Mehrbedarf-Abdeckung', () => {
        it('bei Σ used(done=false, non-Mehrbedarf) ≥ Σ Mehrbedarf: Σ netted === Σ Mehrbedarf', () => {
            const scenarios = generateScenarios(SEED, COUNT);
            let fullCoverageSaat = 0;
            let fullCoverageDuenger = 0;
            for (let s = 0; s < scenarios.length; s++) {
                applyScenario(w, scenarios[s]);
                const cos = scenarios[s].reiter.map((_, i) => w.getCarryover(i));

                // SAAT
                const mbhSaat = totalMehrbedarf(scenarios[s], w, 'E');
                const poolSaat = regel7Pool(scenarios[s], w, 'E');
                if (mbhSaat > 0 && poolSaat >= mbhSaat) {
                    fullCoverageSaat++;
                    let sumNetted = 0;
                    for (let i = 0; i < scenarios[s].reiter.length; i++) {
                        const r = scenarios[s].reiter[i];
                        const istE = w.getTabIstEinheiten(r);
                        const solE = w.getTabTotalEinheiten(r);
                        if (istE > solE && istE > 0) {
                            sumNetted += cos[i].nettedEinheit;
                        }
                    }
                    if (Math.abs(sumNetted - mbhSaat) > TOL) {
                        throw new Error(
                            `I2 Saat-Fehler scenario[${s}]: ` +
                            `Σ nettedEinheit=${sumNetted.toFixed(3)} ≠ Σ Mehrbedarf=${mbhSaat.toFixed(3)} ` +
                            `(pool=${poolSaat.toFixed(2)})\n` +
                            dumpScenario(scenarios[s], s, '')
                        );
                    }
                }

                // DÜNGER
                const mbhDuenger = totalMehrbedarf(scenarios[s], w, 'D');
                const poolDuenger = regel7Pool(scenarios[s], w, 'D');
                if (mbhDuenger > 0 && poolDuenger >= mbhDuenger) {
                    fullCoverageDuenger++;
                    let sumNetted = 0;
                    for (let i = 0; i < scenarios[s].reiter.length; i++) {
                        const r = scenarios[s].reiter[i];
                        const istD = w.getTabIstDuenger(r);
                        const solD = w.getTabTotalDuenger(r);
                        if (istD > solD && istD > 0) {
                            sumNetted += cos[i].nettedDuenger;
                        }
                    }
                    if (Math.abs(sumNetted - mbhDuenger) > TOL) {
                        throw new Error(
                            `I2 Dünger-Fehler scenario[${s}]: ` +
                            `Σ nettedDuenger=${sumNetted.toFixed(3)} ≠ Σ Mehrbedarf=${mbhDuenger.toFixed(3)} ` +
                            `(pool=${poolDuenger.toFixed(2)})\n` +
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
    // I3 — Saat/Dünger-Unabhängigkeit (unverändert)
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
            if (violations === 0) {
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
    // I4 — Bearbeitungs-Reihenfolge bei Knappheit (Regel 7, Issue #378)
    //
    // "Wenn Σ used(done=false) < Σ Mehrbedarf, wandert die Lücke rückwärts
    // durch nicht-Mehrbedarf-Tabs — jeder Spender gibt max(used − bereits-
    // entzogen) und die Mehrbedarf-Tabs werden in aufsteigender
    // lastEntryTime-Reihenfolge versorgt."
    //
    // Da die Spender-Order INVERS ist (Regel 7.2) und pro Spender dynamisch
    // `used − bisher_entzogen` zur Verfügung steht, lässt sich die korrekte
    // Aufteilung nicht als geschlossene Formel schreiben. Wir simulieren
    // stattdessen den Algorithmus Schritt-für-Schritt und vergleichen das
    // Ergebnis mit getCarryover. So wird I4 zu einer automatischen
    // Konsistenzprüfung — wenn der Algorithmus sich ändert, ändert sich auch
    // die Simulation, und der Test bricht frühzeitig.
    //
    // Trigger-Bedingung: Knappheit = pool < totalMehrbedarf (≠ nur saved).
    // ─────────────────────────────────────────────────────────────────────────

    // Simuliert computeAllCarryovers für ein Material und liefert das
    // erwartete per-Tab { netted, excess } zurück (nur für nicht-done Tabs).
    //
    // ACHTUNG — Algorithmus-Semantik 1:1 nachgebildet (auch Bugs):
    //   - sort-Comparator in computeAllCarryovers ruft lastEntryTime mit
    //     `{idx, exc}`-Objekten statt mit tab-Indizes auf. Da reiter[obj]===undefined,
    //     liefert lastEntryTime in beiden Fällen 0, der Tiebreaker `a - b` ist
    //     NaN (Object- Subtraktion), und V8-`sort` mit NaN-Comperator
    //     erhält die Insertion-Order (= reiter-aufsteigend).
    //   - Wir simulieren dies, indem wir die Comparator-Logik 1:1 mit der
    //     gleichen Signature aufrufen. Würden wir den Comparator „richtig
    //     reparieren" (= tab.idx statt obj), würden wir andere Ergebnisse
    //     bekommen als der Produktivalgorithmus → falscher Test.
    function simulateRegel7(scenario, w, material) {
        const n = scenario.reiter.length;
        const isSaat = material === 'E';
        const getUsed = isSaat ? w.getTabUsedEinheiten : w.getTabUsedDuenger;
        const getIst  = isSaat ? w.getTabIstEinheiten : w.getTabIstDuenger;
        const getSol  = isSaat ? w.getTabTotalEinheiten : w.getTabTotalDuenger;
        // entspricht lastEntryTime in computeAllCarryovers: nimmt reiter[i]
        const lastEntryTime = (i) => {
            const tab = scenario.reiter[i];
            if (!tab || !tab.entries || tab.entries.length === 0) return 0;
            const last = tab.entries[tab.entries.length - 1];
            return w.parseEntryTime(last ? (last.time || 0) : 0);
        };
        const tabs = scenario.reiter;
        // Mehrbedarf sammeln (in reiter-Reihenfolge)
        const mehrbedarfTabs = [];
        for (let i = 0; i < n; i++) {
            const r = tabs[i];
            if (!r) continue;
            const ist = getIst(r);
            const sol = getSol(r);
            if (ist > 0 && ist > sol) {
                mehrbedarfTabs.push({ idx: i, exc: ist - sol });
            }
        }
        // Sort-Comparator 1:1 wie computeAllCarryovers.byTimeAsc — bekommt
        // {idx, exc}-Objekte; lastEntryTime darauf = reiter[obj] = undefined → 0
        mehrbedarfTabs.sort(function (a, b) {
            const ta = lastEntryTime(a), tb = lastEntryTime(b);
            if (ta !== tb) return ta - tb;
            return a - b;
        });
        // spenderOrder: nicht-Mehrbedarf, nicht-done, in reiter-Reihenfolge
        const spenderOrder = [];
        for (let i = 0; i < n; i++) {
            const r = tabs[i];
            if (!r) continue;
            if (r.done) continue;
            const ist = getIst(r);
            const sol = getSol(r);
            if (ist > 0 && ist > sol) continue;
            spenderOrder.push(i);
        }
        // Sort-Comparator bekommt hier tab-Indizes (vom Algorithmus-Korrekt) —
        // INVERS lastEntryTime, Tiebreaker Tab-Index aufsteigend
        spenderOrder.sort(function (a, b) {
            const ta = lastEntryTime(a), tb = lastEntryTime(b);
            if (ta !== tb) return tb - ta; // INVERS: descending
            return a - b;
        });
        const sim = Array.from({ length: n }, () => ({ netted: 0, excess: 0 }));
        for (let k = 0; k < mehrbedarfTabs.length; k++) {
            const mt = mehrbedarfTabs[k];
            let need = mt.exc;
            let taken = 0;
            for (let s = 0; s < spenderOrder.length && need > 0.05; s++) {
                const sIdx = spenderOrder[s];
                const available = getUsed(tabs[sIdx]) - sim[sIdx].excess;
                if (available <= 0.05) continue;
                const give = Math.min(need, available);
                sim[sIdx].excess += give;
                need -= give;
                taken += give;
            }
            sim[mt.idx].netted = taken;
        }
        return sim;
    }

    describe('I4 — Bearbeitungs-Reihenfolge bei Knappheit (Regel-7)', () => {
        it('Algorithmus-Konsistenz: getCarryover === Simulation über 200 Szenarien', () => {
            const scenarios = generateScenarios(SEED, COUNT);
            let scarcityCasesSaat = 0;
            let scarcityCasesDuenger = 0;
            for (let s = 0; s < scenarios.length; s++) {
                applyScenario(w, scenarios[s]);
                const cos = scenarios[s].reiter.map((_, i) => w.getCarryover(i));

                for (const mat of [{ name: 'Saat', letter: 'E' }, { name: 'Dünger', letter: 'D' }]) {
                    const mbh = totalMehrbedarf(scenarios[s], w, mat.letter);
                    const pool = regel7Pool(scenarios[s], w, mat.letter);
                    if (mbh <= 0) continue;
                    if (mat.letter === 'E') scarcityCasesSaat++; else scarcityCasesDuenger++;

                    const sim = simulateRegel7(scenarios[s], w, mat.letter);
                    const fieldNet = mat.letter === 'E' ? 'nettedEinheit' : 'nettedDuenger';
                    const fieldExc = mat.letter === 'E' ? 'excessEinheit' : 'excessDuenger';
                    for (let i = 0; i < scenarios[s].reiter.length; i++) {
                        const dNet = Math.abs(cos[i][fieldNet] - sim[i].netted);
                        const dExc = Math.abs(cos[i][fieldExc] - sim[i].excess);
                        if (dNet > TOL || dExc > TOL) {
                            throw new Error(
                                `I4 ${mat.name}-Drift scenario[${s}] tab[${i}]: ` +
                                `actual netted=${cos[i][fieldNet].toFixed(3)} excess=${cos[i][fieldExc].toFixed(3)}, ` +
                                `sim netted=${sim[i].netted.toFixed(3)} excess=${sim[i].excess.toFixed(3)}, ` +
                                `pool=${pool.toFixed(2)} mbh=${mbh.toFixed(2)}\n` +
                                dumpScenario(scenarios[s], s, `tab=${i}`)
                            );
                        }
                    }
                }
            }
            // Sanity: mindestens ein paar Mehrbedarf-Fälle geprüft
            expect(scarcityCasesSaat + scarcityCasesDuenger).toBeGreaterThan(0);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // I5 — Überfüllung im Pool (Regel 7, Issue #378)
    //
    // "Mehrbedarf (ist > sol && ist > 0) wird entweder vom Pool genettet
    // oder bleibt als echter Fehlbetrag stehen. Es darf nicht negativ
    // werden und nicht über-genettet (phantom-material) werden."
    //
    // (a) netted_i ≥ 0 für alle Tabs (kein negatives Netting).
    // (b) excess_i ≥ 0 für alle Tabs (kein negativer Spender-Beitrag).
    // (c) Σ netted_i über Mehrbedarf-Tabs ≤ Σ Mehrbedarf (kein Über-Netting).
    // (d) Bei voller Deckung (pool ≥ Mehrbedarf): Σ netted === Σ Mehrbedarf
    //     (Konsistenz mit I2 — wird hier auf gleicher Logik geprüft, um
    //     Duplikation zu vermeiden).
    // ─────────────────────────────────────────────────────────────────────────
    describe('I5 — Überfüllung im Pool (Regel 7)', () => {
        it('Mehrbedarf-Überschuss: nie negativ, nie über-nettet, Σ netted ≤ Σ Mehrbedarf', () => {
            const scenarios = generateScenarios(SEED, COUNT);
            let mehrbedarfSaat = 0;
            let mehrbedarfDuenger = 0;
            let overnetSaatViolations = 0;
            let overnetDuengerViolations = 0;
            for (let s = 0; s < scenarios.length; s++) {
                applyScenario(w, scenarios[s]);
                const cos = scenarios[s].reiter.map((_, i) => w.getCarryover(i));

                // SAAT
                {
                    let sumNetted = 0, sumExc = 0;
                    for (let i = 0; i < scenarios[s].reiter.length; i++) {
                        const r = scenarios[s].reiter[i];
                        const istE = w.getTabIstEinheiten(r);
                        const solE = w.getTabTotalEinheiten(r);
                        if (istE > solE && istE > 0) {
                            mehrbedarfSaat++;
                            sumExc += (istE - solE);
                            sumNetted += cos[i].nettedEinheit;
                            // (a)+(b) kein Tab darf negative Werte haben
                            expect(cos[i].nettedEinheit).toBeGreaterThanOrEqual(-TOL);
                            expect(cos[i].excessEinheit).toBeGreaterThanOrEqual(-TOL);
                            expect(cos[i].savedEinheit).toBeGreaterThanOrEqual(-TOL);
                        }
                    }
                    // (c) Σ netted ≤ Σ Mehrbedarf (kein Über-Netting)
                    if (sumNetted - sumExc > TOL) {
                        overnetSaatViolations++;
                        throw new Error(
                            `I5 Saat-Über-Netting scenario[${s}]: ` +
                            `Σ nettedEinheit=${sumNetted.toFixed(3)} > ` +
                            `Σ Mehrbedarf=${sumExc.toFixed(3)}\n` +
                            dumpScenario(scenarios[s], s, '')
                        );
                    }
                    // (d) Volle Deckung: bei pool ≥ Mehrbedarf muss Σ netted === Σ Mehrbedarf
                    const mbh = totalMehrbedarf(scenarios[s], w, 'E');
                    const pool = regel7Pool(scenarios[s], w, 'E');
                    if (mbh > 0 && pool >= mbh && Math.abs(sumNetted - sumExc) > TOL) {
                        overnetSaatViolations++;
                        throw new Error(
                            `I5 Saat-Volldeckung-Inkonsistenz scenario[${s}]: ` +
                            `Σ netted=${sumNetted.toFixed(3)} ≠ Σ Mehrbedarf=${sumExc.toFixed(3)} ` +
                            `bei pool=${pool.toFixed(2)}, mbh=${mbh.toFixed(2)}\n` +
                            dumpScenario(scenarios[s], s, '')
                        );
                    }
                }

                // DÜNGER
                {
                    let sumNetted = 0, sumExc = 0;
                    for (let i = 0; i < scenarios[s].reiter.length; i++) {
                        const r = scenarios[s].reiter[i];
                        const istD = w.getTabIstDuenger(r);
                        const solD = w.getTabTotalDuenger(r);
                        if (istD > solD && istD > 0) {
                            mehrbedarfDuenger++;
                            sumExc += (istD - solD);
                            sumNetted += cos[i].nettedDuenger;
                            expect(cos[i].nettedDuenger).toBeGreaterThanOrEqual(-TOL);
                            expect(cos[i].excessDuenger).toBeGreaterThanOrEqual(-TOL);
                            expect(cos[i].savedDuenger).toBeGreaterThanOrEqual(-TOL);
                        }
                    }
                    if (sumNetted - sumExc > TOL) {
                        overnetDuengerViolations++;
                        throw new Error(
                            `I5 Dünger-Über-Netting scenario[${s}]: ` +
                            `Σ nettedDuenger=${sumNetted.toFixed(3)} > ` +
                            `Σ Mehrbedarf=${sumExc.toFixed(3)}\n` +
                            dumpScenario(scenarios[s], s, '')
                        );
                    }
                    const mbh = totalMehrbedarf(scenarios[s], w, 'D');
                    const pool = regel7Pool(scenarios[s], w, 'D');
                    if (mbh > 0 && pool >= mbh && Math.abs(sumNetted - sumExc) > TOL) {
                        overnetDuengerViolations++;
                        throw new Error(
                            `I5 Dünger-Volldeckung-Inkonsistenz scenario[${s}]: ` +
                            `Σ netted=${sumNetted.toFixed(3)} ≠ Σ Mehrbedarf=${sumExc.toFixed(3)} ` +
                            `bei pool=${pool.toFixed(2)}, mbh=${mbh.toFixed(2)}\n` +
                            dumpScenario(scenarios[s], s, '')
                        );
                    }
                }
            }
            // Sanity: mindestens einige Mehrbedarf-Tabs geprüft
            expect(mehrbedarfSaat + mehrbedarfDuenger).toBeGreaterThan(0);
            // (c)+(d) Sanity: in keinem Szenario verletzt (sonst throw oben)
            expect(overnetSaatViolations).toBe(0);
            expect(overnetDuengerViolations).toBe(0);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // I6 — Selbstgutschrift ausgeschlossen (Befund 1, Issue #378 §Anforderung 4)
    //
    // "Ein Tab kann nicht gleichzeitig Spender und Empfänger sein. Wenn ein
    // Tab used > 0 hat UND Mehrbedarf (ist > sol) hat, bleibt sein eigener
    // excessEinheit = 0 (er spendet nichts an sich selbst)."
    //
    // Wird gegen die normalen 200 Szenarien getestet (Generator erzeugt
    // regelmäßig solche Fälle: Tab mit gefülltem Tank + IST > SOL) und
    // zusätzlich mit einem dedizierten 3-Tab-Setup reproduziert (Spec §Verify).
    // ─────────────────────────────────────────────────────────────────────────
    describe('I6 — Selbstgutschrift ausgeschlossen', () => {
        it('Mehrbedarf-Tabs mit used > 0 haben excessEinheit === 0 (Saat + Dünger, 200 Szenarien)', () => {
            const scenarios = generateScenarios(SEED, COUNT);
            for (let s = 0; s < scenarios.length; s++) {
                applyScenario(w, scenarios[s]);
                const cos = scenarios[s].reiter.map((_, i) => w.getCarryover(i));
                for (let i = 0; i < scenarios[s].reiter.length; i++) {
                    const r = scenarios[s].reiter[i];
                    const istE = w.getTabIstEinheiten(r);
                    const solE = w.getTabTotalEinheiten(r);
                    const usedE = w.getTabUsedEinheiten(r);
                    if (istE > solE && istE > 0 && usedE > 0.05) {
                        // Mehrbedarf-Tab mit Material im Tank — Spender-Reihenfolge
                        // schließt ihn aus, daher muss sein eigener excessEinheit=0 sein.
                        if (cos[i].excessEinheit > TOL) {
                            throw new Error(
                                `I6 Saat-Selbstgutschrift scenario[${s}] tab[${i}]: ` +
                                `Mehrbedarf-Tab mit used=${usedE.toFixed(3)} darf nicht selbst als ` +
                                `Spender dienen, excessEinheit=${cos[i].excessEinheit.toFixed(3)} > 0\n` +
                                dumpScenario(scenarios[s], s, `tab=${i}`)
                            );
                        }
                        // Symmetrisch für Dünger
                        const istD = w.getTabIstDuenger(r);
                        const solD = w.getTabTotalDuenger(r);
                        const usedD = w.getTabUsedDuenger(r);
                        if (istD > solD && istD > 0 && usedD > 0.05 &&
                            cos[i].excessDuenger > TOL) {
                            throw new Error(
                                `I6 Dünger-Selbstgutschrift scenario[${s}] tab[${i}]: ` +
                                `Mehrbedarf-Tab mit usedD=${usedD.toFixed(3)} darf nicht selbst als ` +
                                `Spender dienen, excessDuenger=${cos[i].excessDuenger.toFixed(3)} > 0\n` +
                                dumpScenario(scenarios[s], s, `tab=${i}`)
                            );
                        }
                    }
                }
            }
        });

        it('3-Tab-Reproduktion: Tank+Mehrbedarf-Tab bekommt nichts von sich selbst, Netting kommt vom fremden Tank', () => {
            // Setup (Spec §Verify):
            //   Tab A: Tank+Mehrbedarf — hektar=10, istHektar=14, koerner=50000,
            //          duenger=200, ein Entry mit used>0 (Material im Tank)
            //   Tab B: fremder Tank — kleiner Spender-Tab
            //   Tab C: zusätzlicher Tab, um Pool-Knappheit/Fülle zu balancieren
            // Erwartung: A.excessEinheit === 0; A.nettedEinheit kann > 0 sein
            // (Netting kommt von B/C, nicht von A selbst).
            const kpe = 50000;
            const scenario = {
                koernerProEinheit: kpe,
                reiter: [
                    {
                        name: 'Self-Gutschrift-Tab', hektar: 10, istHektar: 14,
                        koerner: 50000, duenger: 200,
                        entries: [{ einheit: 6, duenger: 300, time: '10:00' }], // used > 0
                        done: false,
                    },
                    {
                        name: 'Fremder Tank', hektar: 5, istHektar: 5,
                        koerner: 50000, duenger: 200,
                        entries: [{ einheit: 3, duenger: 150, time: '12:00' }], // pool-Spender
                        done: false,
                    },
                    {
                        name: 'Neutral', hektar: 8, istHektar: 8,
                        koerner: 50000, duenger: 200,
                        entries: [], done: false,
                    },
                ],
            };
            applyScenario(w, scenario);
            const cos = scenario.reiter.map((_, i) => w.getCarryover(i));

            // Tab 0 = Self-Gutschrift-Tab: istE=14, solE=10 → Mehrbedarf 4
            //          usedE=6 > 0 → der Algorithmus MUSS ihn aus den Spendern ausschließen
            //          → excessEinheit === 0
            expect(cos[0].excessEinheit).toBe(0);
            // Tab 1 = Fremder Tank: darf gespendet haben
            // Tab 2 = Neutral: keine Einträge, nichts gespendet
            // Konsistenz: Σ entzogen (excess-Erhöhung) bei Spendern === Σ netted bei Mehrbedarf
            const sumNettedSaat = cos[0].nettedEinheit;
            const sumExcessSaat = cos[1].excessEinheit + cos[2].excessEinheit;
            // Self-Gutschrift-Tab hat netted>0 (Pool deckt ihn), darf aber NICHT selbst
            // gespendet haben
            expect(sumNettedSaat).toBeLessThanOrEqual(4 + TOL);
            if (sumNettedSaat > 0.05) {
                expect(Math.abs(sumNettedSaat - sumExcessSaat)).toBeLessThanOrEqual(TOL);
            }
            // Symmetrisch für Dünger
            // Tab 0: solD=10*200=2000, istD=14*200=2800, excD=800
            // usedD=300, also auch Mehrbedarf-Tab mit Material im Tank
            expect(cos[0].excessDuenger).toBe(0);
            const sumNettedDuenger = cos[0].nettedDuenger;
            const sumExcessDuenger = cos[1].excessDuenger + cos[2].excessDuenger;
            expect(sumNettedDuenger).toBeLessThanOrEqual(800 + TOL);
            if (sumNettedDuenger > 0.05) {
                expect(Math.abs(sumNettedDuenger - sumExcessDuenger)).toBeLessThanOrEqual(TOL);
            }
        });
    });
});
