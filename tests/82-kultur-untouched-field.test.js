/**
 * Regression: Unberührter migrierter Startschlag 0 wird bei Erstauswahl
 * auf den Kultur-Standard aktualisiert.
 *
 * Bug: Ein migrierter Nutzer ohne Kultur hat Schlag 0 mit KPE=50000
 * (Legacy-Default). Bei der verpflichtenden ersten Wahl Raps muss dieser
 * unberührte Schlag auf 1500000 wechseln. Derzeit verhindert
 * _loadStateEverSucceeded das.
 *
 * Predicate: Tab 0, KPE exakt 50000, hektar/istHektar/koerner/duenger
 * alle 0, entries leer, done false → gilt als unberührt.
 * Tabs mit Daten/entries/done oder individueller KPE sowie alle weiteren
 * Tabs bleiben unverändert. confirmChangeKultur-Wechsel bleiben ebenfalls
 * unverändert.
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

// Helper: erzeugt den Minimal-State eines unberührten migrierten Nutzers
function untouchedMigratedStore() {
    return {
        _lv: 5,
        reiter: [{
            name: 'Schlag 1',
            hektar: 0,
            istHektar: 0,
            koerner: 0,
            duenger: 0,
            entries: [],
            done: false
        }],
        activeReiter: 0,
        einheitGroesseEnabled: false,
        koernerProEinheit: 50000,
        fahrgassenEnabled: false,
        fahrgassenBreite: 0,
        machineLog: [],
        drillPriorities: {}
    };
}

describe('Regression: Unberührter Startschlag bei Erstauswahl', () => {
    describe('isUntouchedInitialField Predicate', () => {
        it('Tab 0 mit Legacy-Default KPE=50000 und allen Nullen ist unberührt', () => {
            const { window: w } = createDom();
            const tab = {
                name: 'Schlag 1', hektar: 0, istHektar: 0,
                koerner: 0, duenger: 0, entries: [], done: false,
                koernerProEinheit: 50000
            };
            expect(w.AppGlobals.isUntouchedInitialField(tab, 0)).toBe(true);
        });

        it('Tab 0 mit KPE=50000 aber hektar > 0 ist NICHT unberührt', () => {
            const { window: w } = createDom();
            const tab = {
                name: 'Schlag 1', hektar: 5, istHektar: 0,
                koerner: 0, duenger: 0, entries: [], done: false,
                koernerProEinheit: 50000
            };
            expect(w.AppGlobals.isUntouchedInitialField(tab, 0)).toBe(false);
        });

        it('Tab 0 mit KPE=50000 aber entries vorhanden ist NICHT unberührt', () => {
            const { window: w } = createDom();
            const tab = {
                name: 'Schlag 1', hektar: 0, istHektar: 0,
                koerner: 0, duenger: 0,
                entries: [{ time: '10:00', einheit: 1, duenger: 0, hektar: 0, istHektar: 0, koerner: 0, duengerRate: 0 }],
                done: false,
                koernerProEinheit: 50000
            };
            expect(w.AppGlobals.isUntouchedInitialField(tab, 0)).toBe(false);
        });

        it('Tab 0 mit KPE=50000 aber done=true ist NICHT unberührt', () => {
            const { window: w } = createDom();
            const tab = {
                name: 'Schlag 1', hektar: 0, istHektar: 0,
                koerner: 0, duenger: 0, entries: [], done: true,
                koernerProEinheit: 50000
            };
            expect(w.AppGlobals.isUntouchedInitialField(tab, 0)).toBe(false);
        });

        it('Tab 0 mit individueller KPE=70000 ist NICHT unberührt', () => {
            const { window: w } = createDom();
            const tab = {
                name: 'Schlag 1', hektar: 0, istHektar: 0,
                koerner: 0, duenger: 0, entries: [], done: false,
                koernerProEinheit: 70000
            };
            expect(w.AppGlobals.isUntouchedInitialField(tab, 0)).toBe(false);
        });

        it('Tab 1 (nicht Tab 0) ist NICHT unberührt — egal wie leer', () => {
            const { window: w } = createDom();
            const tab = {
                name: 'Schlag 2', hektar: 0, istHektar: 0,
                koerner: 0, duenger: 0, entries: [], done: false,
                koernerProEinheit: 50000
            };
            expect(w.AppGlobals.isUntouchedInitialField(tab, 1)).toBe(false);
        });

        it('Tab 0 mit KPE=0 (Sonstiges-Default) ist NICHT unberührt', () => {
            const { window: w } = createDom();
            const tab = {
                name: 'Schlag 1', hektar: 0, istHektar: 0,
                koerner: 0, duenger: 0, entries: [], done: false,
                koernerProEinheit: 0
            };
            expect(w.AppGlobals.isUntouchedInitialField(tab, 0)).toBe(false);
        });
    });

    describe('chooseKultur mit unberührtem migrierten Startschlag', () => {
        it('Raps: unberührter Schlag 0 wechselt von 50000 auf 1500000', () => {
            const { window: w, store } = createDom();
            store['agrar_rechner'] = JSON.stringify(untouchedMigratedStore());
            w.initUI();
            // Migration setzt Tab 0 auf 50000
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
            // Erstauswahl Raps
            w.chooseKultur('raps');
            // BUG-FIX: unberührter Schlag wird aktualisiert
            expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
        });

        it('Sonstiges: unberührter Schlag 0 wechselt von 50000 auf 0', () => {
            const { window: w, store } = createDom();
            store['agrar_rechner'] = JSON.stringify(untouchedMigratedStore());
            w.initUI();
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
            w.chooseKultur('sonstiges');
            // Sonstiges-Default ist 0
            expect(w.state.reiter[0].koernerProEinheit).toBe(0);
        });

        it('Mais: unberührter Schlag 0 bleibt bei 50000 (gleicher Default)', () => {
            const { window: w, store } = createDom();
            store['agrar_rechner'] = JSON.stringify(untouchedMigratedStore());
            w.initUI();
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
            w.chooseKultur('mais');
            // Mais-Default = 50000 → gleicher Wert
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
        });
    });

    describe('Nicht-unberührte Tabs bleiben unverändert', () => {
        it('Tab 0 mit hektar > 0 bleibt bei 50000 nach Raps-Wahl', () => {
            const { window: w, store } = createDom();
            const s = untouchedMigratedStore();
            s.reiter[0].hektar = 5;
            store['agrar_rechner'] = JSON.stringify(s);
            w.initUI();
            w.chooseKultur('raps');
            // Tab hat Daten → bleibt unverändert
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
        });

        it('Tab 0 mit individueller KPE=70000 bleibt unverändert', () => {
            const { window: w, store } = createDom();
            const s = untouchedMigratedStore();
            s.reiter[0].koernerProEinheit = 70000;
            store['agrar_rechner'] = JSON.stringify(s);
            w.initUI();
            w.chooseKultur('raps');
            expect(w.state.reiter[0].koernerProEinheit).toBe(70000);
        });

        it('Tab 0 mit done=true bleibt unverändert', () => {
            const { window: w, store } = createDom();
            const s = untouchedMigratedStore();
            s.reiter[0].done = true;
            store['agrar_rechner'] = JSON.stringify(s);
            w.initUI();
            w.chooseKultur('raps');
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
        });

        it('Tab 1 existiert zusätzlich → nur Tab 0 (unberührt) wird aktualisiert', () => {
            const { window: w, store } = createDom();
            const s = untouchedMigratedStore();
            s.reiter.push({
                name: 'Schlag 2', hektar: 3, istHektar: 0,
                koerner: 50000, duenger: 0, entries: [], done: false,
                koernerProEinheit: 80000
            });
            store['agrar_rechner'] = JSON.stringify(s);
            w.initUI();
            w.chooseKultur('raps');
            // Tab 0: unberührt → aktualisiert
            expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
            // Tab 1: hat Daten → unverändert
            expect(w.state.reiter[1].koernerProEinheit).toBe(80000);
        });
    });

    describe('confirmChangeKultur bleibt unverändert', () => {
        it('confirmChangeKultur ändert bestehende Tabs NICHT', () => {
            const { window: w } = createDom();
            w.initUI();
            w.chooseKultur('mais');
            // Tab 0 hat 50000 (Mais-Default)
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
            // Wechsel zu Raps via confirmChangeKultur
            w.requestChangeKultur();
            w.AppGlobals._pendingKulturChoice = 'raps';
            w.confirmChangeKultur();
            // Tab 0 bleibt unverändert — confirmChangeKultur ändert keine Tabs
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
            // Globaler Default ist jetzt Raps
            expect(w.state.koernerProEinheit).toBe(1500000);
        });
    });

    describe('KPE-Editor-Sync nach chooseKultur', () => {
        it('#koerner_pro_einheit zeigt 1500000 nach Raps-Erstauswahl', () => {
            const { window: w, store } = createDom();
            store['agrar_rechner'] = JSON.stringify(untouchedMigratedStore());
            w.initUI();
            // Editor öffnen
            w.einheitGroesseToggle();
            const kpEl = w.document.getElementById('koerner_pro_einheit');
            // Vor Erstauswahl: 50000 (Migration-Default)
            expect(kpEl.value).toBe('50000');
            // Raps wählen
            w.chooseKultur('raps');
            // Editor zeigt neuen Wert
            expect(kpEl.value).toBe('1500000');
        });

        it('#koerner_pro_einheit zeigt leer nach Sonstiges-Erstauswahl', () => {
            const { window: w, store } = createDom();
            store['agrar_rechner'] = JSON.stringify(untouchedMigratedStore());
            w.initUI();
            w.einheitGroesseToggle();
            const kpEl = w.document.getElementById('koerner_pro_einheit');
            w.chooseKultur('sonstiges');
            // Sonstiges-Default = 0 → Feld leer
            expect(kpEl.value).toBe('');
        });
    });

    describe('Reload nach Erstauswahl mit Korrektur', () => {
        it('Raps-Wahl auf unberührtem Schlag persistiert nach Reload', () => {
            const { window: w, store } = createDom();
            store['agrar_rechner'] = JSON.stringify(untouchedMigratedStore());
            w.initUI();
            w.chooseKultur('raps');
            w.saveState();
            // Reload simulieren
            w.state = { reiter: [], activeReiter: 0 };
            w.loadState();
            expect(w.state.kultur).toBe('raps');
            expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
            expect(w.state.erstauswahlDone).toBe(true);
        });
    });
});
