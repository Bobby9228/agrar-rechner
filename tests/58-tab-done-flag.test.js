/**
 * Issue #377: Manuelle Fertig-Markierung pro Tab — done-Flag + UI + Locking
 *
 * Coverage:
 *   1. State: done-Flag existiert im Default-State
 *   2. State-Migration: alter State ohne `done` → `done: false` für alle Tabs
 *   3. State: `done: true` überlebt einen Reload (saveState/loadState round-trip)
 *   4. UI: Toggle-Button "Feld fertig" rendert pro Tab, Klick setzt `done = true`
 *   5. UI: nach Toggle rendert Button "Fertig zurücknehmen" + Klasse `active`
 *   6. UI: Klick auf "Fertig zurücknehmen" setzt `done = false` (Undo)
 *   7. Locking: bei `done = true` sind `dtl_e_<i>` und `dtl_d_<i>` disabled
 *   8. Locking: bei `done = false` sind die Inputs wieder enabled
 *   9. Locking: bei aktivem done-Tab sind die globalen drill_einheit / drill_duenger /
 *      drill_hektar Felder disabled
 *  10. Locking: Tab-Wechsel (activeReiter) auf nicht-done-Tab entsperrt die globalen Felder
 *  11. Schema-Whitelist: `done` ist in ALLOWED_TAB_KEYS (würde sonst beim Save
 *      gestrippt werden, ist aber Top-Level auf reiter[])
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Issue #377: manuelle Fertig-Markierung pro Tab', () => {
    let w, doc, store;

    beforeEach(() => {
        const result = createDom();
        w = result.window;
        doc = w.document;
        store = result.store;
    });

    describe('State: done-Flag existiert', () => {
        it('Default-State (frisch) hat done: false auf reiter[0]', () => {
            // Kein localStorage → frischer State
            expect(w.state.reiter[0].done).toBe(false);
        });

        it('done ist in ALLOWED_TAB_KEYS (Schema-Whitelist)', () => {
            expect(w.AppGlobals.ALLOWED_TAB_KEYS).toContain('done');
        });
    });

    describe('State-Migration', () => {
        it('alter State ohne `done`-Feld bekommt done: false auf allen Tabs', () => {
            // Migration 4 → 5: kein `done`-Feld im gespeicherten State
            store['agrar_rechner'] = JSON.stringify({
                _lv: 4,
                reiter: [
                    { name: 'Tab 1', hektar: 10, koerner: 90000, duenger: 150, entries: [] },
                    { name: 'Tab 2', hektar: 5, koerner: 95000, duenger: 100, entries: [] }
                ],
                activeReiter: 0,
                fahrgassenEnabled: false,
                fahrgassenBreite: 0,
                einheitGroesseEnabled: false,
                koernerProEinheit: 50000,
                machineLog: [],
                drillPriorities: {},
                iosInstallHintShown: false
            });
            w.loadState();
            expect(w.state.reiter.length).toBe(2);
            expect(w.state.reiter[0].done).toBe(false);
            expect(w.state.reiter[1].done).toBe(false);
        });

        it('alter State mit done=true auf einem Tab bleibt nach Migration erhalten', () => {
            store['agrar_rechner'] = JSON.stringify({
                _lv: 4,
                reiter: [
                    { name: 'Tab 1', hektar: 10, koerner: 90000, duenger: 150, entries: [], done: true },
                    { name: 'Tab 2', hektar: 5, koerner: 95000, duenger: 100, entries: [] }
                ],
                activeReiter: 0,
                fahrgassenEnabled: false,
                fahrgassenBreite: 0,
                einheitGroesseEnabled: false,
                koernerProEinheit: 50000,
                machineLog: [],
                drillPriorities: {},
                iosInstallHintShown: false
            });
            w.loadState();
            expect(w.state.reiter[0].done).toBe(true);
            expect(w.state.reiter[1].done).toBe(false);
        });

        it('done wird nach saveState/loadState round-trip erhalten', () => {
            w.state.reiter[0].done = true;
            w.state.reiter.push({ name: 'Tab 2', hektar: 5, koerner: 90000, duenger: 100, entries: [], done: false });
            w.saveState();
            // Frisches Window simulieren (anderer Reiter-Reload)
            w.state.reiter[0].done = false; // lokal überschreiben
            w.loadState();
            expect(w.state.reiter[0].done).toBe(true);
            expect(w.state.reiter[1].done).toBe(false);
        });
    });

    describe('UI: Toggle-Button pro Tab', () => {
        function setupDrillView() {
            w.state.reiter[0] = { name: 'Acker Nord', hektar: 10, koerner: 90000, duenger: 150, entries: [], done: false };
            // Drill-View anzeigen (activeView='protokoll') und rendern
            w.state.activeView = 'protokoll';
            w.AppGlobals.renderDrillTabList();
        }

        it('rendert einen done-Button pro Tab', () => {
            setupDrillView();
            var btn = doc.getElementById('dtl_done_0');
            expect(btn).toBeTruthy();
            expect(btn.textContent).toBe('Feld fertig');
            expect(btn.classList.contains('active')).toBe(false);
            expect(btn.getAttribute('aria-pressed')).toBe('false');
        });

        it('Klick auf "Feld fertig" setzt done=true und rendert als "Fertig zurücknehmen"', () => {
            setupDrillView();
            var btn = doc.getElementById('dtl_done_0');
            btn.click();
            expect(w.state.reiter[0].done).toBe(true);
            // Re-render: neuer Button hat neuen Text
            var btn2 = doc.getElementById('dtl_done_0');
            expect(btn2.textContent).toBe('Fertig zurücknehmen');
            expect(btn2.classList.contains('active')).toBe(true);
            expect(btn2.getAttribute('aria-pressed')).toBe('true');
        });

        it('Undo: zweiter Klick setzt done=false und Werte bleiben erhalten', () => {
            setupDrillView();
            // Erstmal done=true setzen
            w.state.reiter[0].done = true;
            w.AppGlobals.renderDrillTabList();
            // Eine Entry hinzufügen, used-Wert soll erhalten bleiben
            w.state.reiter[0].entries.push({
                time: 1, einheit: 5, duenger: 75, hektar: 10, istHektar: 0,
                koerner: 90000, duengerRate: 150, mlIdx: -1
            });
            // Undo
            doc.getElementById('dtl_done_0').click();
            expect(w.state.reiter[0].done).toBe(false);
            // Entries bleiben unangetastet
            expect(w.state.reiter[0].entries.length).toBe(1);
            expect(w.state.reiter[0].entries[0].einheit).toBe(5);
        });

        it('persistiert done nach saveState', () => {
            setupDrillView();
            doc.getElementById('dtl_done_0').click();
            var persisted = JSON.parse(store['agrar_rechner']);
            expect(persisted.reiter[0].done).toBe(true);
        });
    });

    describe('Locking: Per-Tab-Inputs (dtl_e_<i> / dtl_d_<i>)', () => {
        function setupDrillView() {
            w.state.reiter[0] = { name: 'Acker', hektar: 10, koerner: 90000, duenger: 150, entries: [], done: false };
            w.state.activeView = 'protokoll';
            w.AppGlobals.renderDrillTabList();
        }

        it('bei done=true sind dtl_e_0 und dtl_d_0 disabled', () => {
            setupDrillView();
            w.state.reiter[0].done = true;
            w.AppGlobals.renderDrillTabList();
            expect(doc.getElementById('dtl_e_0').disabled).toBe(true);
            expect(doc.getElementById('dtl_d_0').disabled).toBe(true);
        });

        it('bei done=false sind dtl_e_0 und dtl_d_0 enabled', () => {
            setupDrillView();
            // Default: done=false
            expect(doc.getElementById('dtl_e_0').disabled).toBe(false);
            expect(doc.getElementById('dtl_d_0').disabled).toBe(false);
        });

        it('Undo: nach done=true → false sind die Inputs wieder enabled', () => {
            setupDrillView();
            w.state.reiter[0].done = true;
            w.AppGlobals.renderDrillTabList();
            expect(doc.getElementById('dtl_e_0').disabled).toBe(true);
            // Undo
            w.state.reiter[0].done = false;
            w.AppGlobals.renderDrillTabList();
            expect(doc.getElementById('dtl_e_0').disabled).toBe(false);
        });
    });

    describe('Locking: globale Drill-Inputs (drill_einheit / drill_duenger / drill_hektar)', () => {
        function setupDrillView() {
            w.state.reiter[0] = { name: 'Acker', hektar: 10, koerner: 90000, duenger: 150, entries: [], done: false };
            w.state.activeReiter = 0;
            w.state.activeView = 'protokoll';
            w.AppGlobals.renderDrillTabList();
            w.AppGlobals.drillCalcAll();
        }

        it('aktiver Tab done=true → globale Inputs disabled', () => {
            setupDrillView();
            w.state.reiter[0].done = true;
            w.AppGlobals.drillCalcAll();
            expect(doc.getElementById('drill_einheit').disabled).toBe(true);
            expect(doc.getElementById('drill_duenger').disabled).toBe(true);
            expect(doc.getElementById('drill_hektar').disabled).toBe(true);
        });

        it('aktiver Tab done=false → globale Inputs enabled', () => {
            setupDrillView();
            // Default
            expect(doc.getElementById('drill_einheit').disabled).toBe(false);
            expect(doc.getElementById('drill_duenger').disabled).toBe(false);
            expect(doc.getElementById('drill_hektar').disabled).toBe(false);
        });

        it('Tab-Wechsel: aktiver Tab nicht-done, anderer Tab done → globale Inputs enabled', () => {
            setupDrillView();
            w.state.reiter.push({ name: 'Tab 2', hektar: 5, koerner: 90000, duenger: 100, entries: [], done: true });
            w.state.reiter[0].done = false;
            w.state.activeReiter = 0;
            w.AppGlobals.drillCalcAll();
            expect(doc.getElementById('drill_einheit').disabled).toBe(false);
            // Bug #377/PR #379: Auf done-Tab wechseln über den realistischen Pfad
            // (User klickt Tab-Pill → switchReiter → appEmit('TAB_CHANGED')).
            // Vor dem Fix re-synct der render-tabs TAB_CHANGED-Subscriber KEINEN
            // drillCalcAll, also blieb der Lock auf drill_einheit am vorherigen
            // activeReiter "verklebt" bis der User irgendetwas anderes tut.
            // switchReiter(1) muss den Lock ohne zwischenzeitliches drillCalcAll
            // sofort korrekt setzen.
            w.switchReiter(1);
            expect(doc.getElementById('drill_einheit').disabled).toBe(true);
            expect(doc.getElementById('drill_duenger').disabled).toBe(true);
            expect(doc.getElementById('drill_hektar').disabled).toBe(true);
            // Zurück auf Tab 0 (nicht done) → Inputs wieder enabled, ebenfalls
            // ohne zwischenzeitliches drillCalcAll.
            w.switchReiter(0);
            expect(doc.getElementById('drill_einheit').disabled).toBe(false);
            expect(doc.getElementById('drill_duenger').disabled).toBe(false);
            expect(doc.getElementById('drill_hektar').disabled).toBe(false);
        });
    });
});