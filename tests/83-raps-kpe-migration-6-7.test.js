/**
 * Migration 6→7: Raps-Default-KPE für unberührte Felder korrigieren.
 *
 * Bug: Bei Auswahl Raps + Erstauswahl blieb Tab 0 auf kpe=50000 (Mais-Default),
 * obwohl Raps-Default 1.500.000 beträgt. Betroffene Nutzer haben Tab 0 nie
 * angefasst (hektar/istHektar/koerner/duenger=0, entries=[], done=false).
 *
 * Feature-Spec:
 *   _lv=6 + kultur=raps + erstauswahlDone=true + Tab 0 kpe=50000
 *   + Tab 0 vollständig unberührt (hektar=0, istHektar=0, koerner=0,
 *     duenger=0, entries=[], done=false)
 *   → Tab 0 kpe auf 1.500.000 korrigieren, _lv=7.
 *
 *   ABER: Bei Daten, entries≠[], done=true, individueller KPE,
 *   anderer Kultur oder Tab >0 NICHTS ändern. Nur _lv auf 7 setzen.
 *
 * Persistenz: Nach Migration wird _lv=7 in localStorage geschrieben.
 * Zweiter Reload: Migration wird nicht erneut ausgeführt (idempotent).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Migration 6→7: Raps-Default-KPE für unberührte Felder', () => {
    let w, store;

    beforeEach(() => {
        const result = createDom();
        w = result.window;
        store = result.store;
    });

    function baseState(overrides) {
        return Object.assign({
            _lv: 6,
            reiter: [{
                name: 'Schlag 1',
                hektar: 0,
                istHektar: 0,
                koerner: 0,
                duenger: 0,
                entries: [],
                done: false,
                koernerProEinheit: 50000
            }],
            activeReiter: 0,
            activeView: null,
            dashboardOpen: false,
            fahrgassenEnabled: false,
            fahrgassenBreite: 0,
            einheitGroesseEnabled: false,
            koernerProEinheit: 50000,
            kultur: 'raps',
            erstauswahlDone: true,
            machineLog: [],
            drillPriorities: {}
        }, overrides);
    }

    describe('Korrektur: Tab 0 KPE 50000 → 1500000', () => {
        it('korrigiert Tab 0 kpe von 50000 auf 1500000 bei unberührtem Raps-State', () => {
            store['agrar_rechner'] = JSON.stringify(baseState());
            w.loadState();
            expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
        });

        it('setzt _lv auf 7 nach Migration', () => {
            store['agrar_rechner'] = JSON.stringify(baseState());
            w.loadState();
            expect(w.state._lv).toBe(7);
        });

        it('persistiert _lv=7 in localStorage', () => {
            store['agrar_rechner'] = JSON.stringify(baseState());
            w.loadState();
            var persisted = JSON.parse(store['agrar_rechner']);
            expect(persisted._lv).toBe(7);
            expect(persisted.reiter[0].koernerProEinheit).toBe(1500000);
        });

        it('zweiter Reload: Migration nicht erneut ausgeführt (idempotent)', () => {
            store['agrar_rechner'] = JSON.stringify(baseState());
            w.loadState();
            var afterFirst = JSON.parse(store['agrar_rechner']);
            expect(afterFirst._lv).toBe(7);
            expect(afterFirst.reiter[0].koernerProEinheit).toBe(1500000);
            // Zweiter Load
            w.loadState();
            var afterSecond = JSON.parse(store['agrar_rechner']);
            expect(afterSecond._lv).toBe(7);
            expect(afterSecond.reiter[0].koernerProEinheit).toBe(1500000);
        });
    });

    describe('Keine Korrektur bei berührtem Tab 0', () => {
        it('ändert nichts wenn hektar > 0', () => {
            store['agrar_rechner'] = JSON.stringify(baseState({
                reiter: [{
                    name: 'Schlag 1', hektar: 5, istHektar: 0, koerner: 0, duenger: 0,
                    entries: [], done: false, koernerProEinheit: 50000
                }]
            }));
            w.loadState();
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
            expect(w.state._lv).toBe(7);
        });

        it('ändert nichts wenn istHektar > 0', () => {
            store['agrar_rechner'] = JSON.stringify(baseState({
                reiter: [{
                    name: 'Schlag 1', hektar: 0, istHektar: 4.5, koerner: 0, duenger: 0,
                    entries: [], done: false, koernerProEinheit: 50000
                }]
            }));
            w.loadState();
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
            expect(w.state._lv).toBe(7);
        });

        it('ändert nichts wenn koerner > 0', () => {
            store['agrar_rechner'] = JSON.stringify(baseState({
                reiter: [{
                    name: 'Schlag 1', hektar: 0, istHektar: 0, koerner: 80000, duenger: 0,
                    entries: [], done: false, koernerProEinheit: 50000
                }]
            }));
            w.loadState();
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
            expect(w.state._lv).toBe(7);
        });

        it('ändert nichts wenn duenger > 0', () => {
            store['agrar_rechner'] = JSON.stringify(baseState({
                reiter: [{
                    name: 'Schlag 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 150,
                    entries: [], done: false, koernerProEinheit: 50000
                }]
            }));
            w.loadState();
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
            expect(w.state._lv).toBe(7);
        });

        it('ändert nichts wenn entries nicht leer', () => {
            store['agrar_rechner'] = JSON.stringify(baseState({
                reiter: [{
                    name: 'Schlag 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 0,
                    entries: [{ time: 1, einheit: 1, duenger: 50, hektar: 0, istHektar: 0, koerner: 0, duengerRate: 0 }],
                    done: false, koernerProEinheit: 50000
                }]
            }));
            w.loadState();
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
            expect(w.state._lv).toBe(7);
        });

        it('ändert nichts wenn done = true', () => {
            store['agrar_rechner'] = JSON.stringify(baseState({
                reiter: [{
                    name: 'Schlag 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 0,
                    entries: [], done: true, koernerProEinheit: 50000
                }]
            }));
            w.loadState();
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
            expect(w.state._lv).toBe(7);
        });
    });

    describe('Keine Korrektur bei anderer Kultur oder individueller KPE', () => {
        it('ändert nichts bei kultur=mais', () => {
            store['agrar_rechner'] = JSON.stringify(baseState({ kultur: 'mais' }));
            w.loadState();
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
            expect(w.state._lv).toBe(7);
        });

        it('ändert nichts bei kultur=sonstiges', () => {
            store['agrar_rechner'] = JSON.stringify(baseState({ kultur: 'sonstiges' }));
            w.loadState();
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
            expect(w.state._lv).toBe(7);
        });

        it('ändert nichts bei kultur=null', () => {
            store['agrar_rechner'] = JSON.stringify(baseState({ kultur: null, erstauswahlDone: false }));
            w.loadState();
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
            expect(w.state._lv).toBe(7);
        });

        it('ändert nichts wenn Tab 0 bereits individuelle kpe hat (≠50000)', () => {
            store['agrar_rechner'] = JSON.stringify(baseState({
                reiter: [{
                    name: 'Schlag 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 0,
                    entries: [], done: false, koernerProEinheit: 80000
                }]
            }));
            w.loadState();
            expect(w.state.reiter[0].koernerProEinheit).toBe(80000);
            expect(w.state._lv).toBe(7);
        });
    });

    describe('Nur Tab 0 betroffen, andere Tabs unverändert', () => {
        it('ändert nichts an Tab 1 (selbst wenn dieser unberührt wäre)', () => {
            store['agrar_rechner'] = JSON.stringify(baseState({
                reiter: [
                    { name: 'Schlag 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false, koernerProEinheit: 50000 },
                    { name: 'Schlag 2', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false, koernerProEinheit: 50000 }
                ]
            }));
            w.loadState();
            // Tab 0 wird korrigiert
            expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
            // Tab 1 bleibt unverändert
            expect(w.state.reiter[1].koernerProEinheit).toBe(50000);
            expect(w.state._lv).toBe(7);
        });
    });

    describe('Andere Migrationen bleiben erhalten', () => {
        it('Migration 0→7: alter flacher State wird migriert und _lv=7', () => {
            store['agrar_rechner'] = JSON.stringify({
                hektar: 10, koerner: 90000, duenger: 150,
                entries: [{ einheit: 5, hektar: 3, duenger: 200, time: '10:00' }]
            });
            w.loadState();
            expect(w.state.reiter).toBeDefined();
            expect(w.state.reiter.length).toBe(1);
            expect(w.state._lv).toBe(7);
        });

        it('Migration 5→7: bestehender State mit _lv=5 wird migriert', () => {
            store['agrar_rechner'] = JSON.stringify({
                _lv: 5,
                reiter: [{ name: 'A', hektar: 10, koerner: 90000, duenger: 150, entries: [], done: false }],
                activeReiter: 0,
                activeView: null,
                einheitGroesseEnabled: false,
                koernerProEinheit: 50000,
                fahrgassenEnabled: false,
                fahrgassenBreite: 0,
                machineLog: [],
                drillPriorities: {}
            });
            w.loadState();
            expect(w.state._lv).toBe(7);
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
        });

        it('Migration 6→7: bereits _lv=7 State wird nicht erneut migriert', () => {
            store['agrar_rechner'] = JSON.stringify(baseState({ _lv: 7, reiter: [{
                name: 'Schlag 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 0,
                entries: [], done: false, koernerProEinheit: 1500000
            }] }));
            w.loadState();
            expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
            expect(w.state._lv).toBe(7);
        });
    });
});
