/**
 * Issue #417 — Verhaltens-Tests für den State-Coordinator.
 *
 * Der Coordinator bündelt Persistenz + Re-Render. Diese Suite prüft die
 * drei Kern-Garantien:
 *
 *   1. EIN appEmit → höchstens EIN saveState-Call (keine Doppel-Persistenz).
 *
 *   2. Renderer dürfen AppGlobals.saveState NICHT mehr direkt aufrufen —
 *      sonst hätten wir Doppel-Persistenz. Diese Garantie ist statisch
 *      (Quellcode-Grep) und wird hier ergänzend dokumentiert.
 *
 *   3. Bekannte Lifecycle-Pfade lösen weiterhin Persistenz + Re-Render
 *      aus: addReiter (TAB_ADDED), switchToProtokoll (VIEW_CHANGED),
 *      drillAdd (DRILL_ENTRY_ADDED), onInputHektar (ENTRY_CHANGED),
 *      openDashboard (DASHBOARD_OPENED), resetAll (RESET_ALL).
 *
 * Hinweis zur Spionage: vi.spyOn ersetzt NUR die Property auf dem Ziel-
 * Objekt (z.B. window.renderTabs). Da der Coordinator alle Renderer über
 * AppGlobals.X aufruft, müssen die Spies auf AppGlobals.X gesetzt werden.
 *
 * Cross-Tab-Sync (storage-Event) wird in tests/36-cross-tab-sync.test.js
 * separat abgesichert und ist hier kein Thema — diese Suite testet nur den
 * in-page Datenfluss.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createDom } from './helpers.js';

describe('Issue #417 — State-Coordinator: Persistenz-Garantien', () => {
    let w, store;
    beforeEach(() => {
        const result = createDom();
        w = result.window;
        store = result.store;
    });

    it('ein einzelner appEmit → genau ein saveState-Call', () => {
        const spy = vi.spyOn(w.AppGlobals, 'saveState');
        w.appEmit('TAB_RENAMED', { tabIdx: 0 });
        // AppEmit ruft alle Listener. Der Coordinator ist genau einer.
        // saveState wird also genau einmal aufgerufen.
        expect(spy).toHaveBeenCalledTimes(1);
        spy.mockRestore();
    });

    it('unbekannter Eventtyp → kein saveState', () => {
        const spy = vi.spyOn(w.AppGlobals, 'saveState');
        w.appEmit('NICHT_IM_PLAN', {});
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('jeder appEmit("ENTRY_CHANGED") → genau ein saveState', () => {
        const spy = vi.spyOn(w.AppGlobals, 'saveState');
        // Mehrere Eingaben nacheinander simulieren (Issue: Doppel-Persistenz
        // war vorher ein bekanntes Risiko, weil Renderfunktionen ebenfalls
        // saveState riefen).
        for (var i = 0; i < 5; i++) {
            w.appEmit('ENTRY_CHANGED');
        }
        expect(spy).toHaveBeenCalledTimes(5);
        spy.mockRestore();
    });

    it('mehrere Listener (z. B. ein Test-Listener) → Coordinator persistiert trotzdem nur einmal', () => {
        // Drittes Listener registrieren, das selbst KEINEN saveState aufruft
        // — Coordinator ist Single Source of Truth.
        const extra = vi.fn();
        w.appOnStateChange(extra);
        const spy = vi.spyOn(w.AppGlobals, 'saveState');
        w.appEmit('VIEW_CHANGED', { view: 'protokoll' });
        expect(spy).toHaveBeenCalledTimes(1);
        expect(extra).toHaveBeenCalledTimes(1);
        expect(extra).toHaveBeenCalledWith('VIEW_CHANGED', { view: 'protokoll' });
        spy.mockRestore();
    });
});

describe('Issue #417 — State-Coordinator: Re-Render-Garantien', () => {
    let w;
    beforeEach(() => {
        w = createDom().window;
    });

    it('TAB_CHANGED triggert renderTabs und renderResults (je 1×)', () => {
        const tabs = vi.spyOn(w.AppGlobals, 'renderTabs');
        const results = vi.spyOn(w.AppGlobals, 'renderResults');
        w.appEmit('TAB_CHANGED', { tabIdx: 0 });
        expect(tabs).toHaveBeenCalledTimes(1);
        expect(results).toHaveBeenCalledTimes(1);
        tabs.mockRestore();
        results.mockRestore();
    });

    it('KULTUR_CHANGED ruft renderKulturBadge und renderResults', () => {
        const badge = vi.spyOn(w.AppGlobals, 'renderKulturBadge');
        const results = vi.spyOn(w.AppGlobals, 'renderResults');
        w.appEmit('KULTUR_CHANGED', { kultur: 'mais' });
        expect(badge).toHaveBeenCalledTimes(1);
        expect(results).toHaveBeenCalledTimes(1);
        badge.mockRestore();
        results.mockRestore();
    });

    it('DASHBOARD_OPENED ruft renderTabs (Nav-Indikator)', () => {
        const tabs = vi.spyOn(w.AppGlobals, 'renderTabs');
        w.appEmit('DASHBOARD_OPENED');
        expect(tabs).toHaveBeenCalledTimes(1);
        tabs.mockRestore();
    });

    it('DRILL_PRIORITY_CHANGED ruft nur drillCalcAll (keine volle Re-Render-Kaskade)', () => {
        // Parität zum Verhalten vor #417 (dev @ 1fd3899): der Klick-Handler
        // machte nur saveState + drillCalcAll. Der Coordinator-Plan für
        // DRILL_PRIORITY_CHANGED listet deshalb auch nur drillCalcAll.
        // WICHTIG: renderResults wird trotzdem aufgerufen — aber von
        // drillCalcAll INTERN (steht seit jeher so im drill-handlers.js),
        // nicht durch den Event-Plan. Deshalb wird hier nur geprüft, dass
        // der Plan KEINE zusätzlichen Tab-Re-Renders veranlasst.
        const drill = vi.spyOn(w.AppGlobals, 'drillCalcAll');
        const tabs = vi.spyOn(w.AppGlobals, 'renderTabs');
        w.appEmit('DRILL_PRIORITY_CHANGED', { tabIdx: 0, priority: 1 });
        expect(drill).toHaveBeenCalledTimes(1);
        expect(tabs).not.toHaveBeenCalled();
        drill.mockRestore();
        tabs.mockRestore();
    });

    it('fehlende Renderer werden im Coordinator defensiv übersprungen', () => {
        // Garantie: EIN fehlender Renderer darf die übrigen Renderer und
        // die Persistenz NICHT blockieren (_tryCall skipped fehlende
        // Funktionen still, wirft also nicht). Setup: Protokoll-Ansicht
        // aktiv, renderLocalProtocol entfernt → der Inline-Pfad von
        // ENTRY_CHANGED trifft den fehlenden Renderer, renderTabs/
        // renderResults/renderView müssen trotzdem laufen.
        w.state.activeView = 'protokoll';
        const orig = w.AppGlobals.renderLocalProtocol;
        w.AppGlobals.renderLocalProtocol = undefined;
        const results = vi.spyOn(w.AppGlobals, 'renderResults');
        expect(() => w.appEmit('ENTRY_CHANGED')).not.toThrow();
        expect(results).toHaveBeenCalledTimes(1);
        results.mockRestore();
        w.AppGlobals.renderLocalProtocol = orig;
    });
});

describe('Issue #417 — End-to-End: Handler → Coordinator → localStorage', () => {
    let w, store;
    beforeEach(() => {
        const result = createDom();
        w = result.window;
        store = result.store;
    });

    it('addReiter() → TAB_ADDED → saveState + renderTabs + renderView', () => {
        const tabs = vi.spyOn(w.AppGlobals, 'renderTabs');
        w.addReiter();
        // Nach addReiter gibt es 2 Tabs, gespeichert in localStorage.
        expect(w.state.reiter.length).toBe(2);
        expect(tabs).toHaveBeenCalledTimes(1);
        const persisted = JSON.parse(store['agrar_rechner']);
        expect(persisted.reiter.length).toBe(2);
        tabs.mockRestore();
    });

    it('switchToProtokoll() → VIEW_CHANGED → saveState + renderDrillTabList', () => {
        // Tab muss Daten haben, sonst rendert renderDrillTabList nur die Liste
        // ohne Detail-Werte.
        w.state.reiter[0].hektar = 10;
        w.state.reiter[0].koerner = 90000;
        w.saveState();
        const drillList = vi.spyOn(w.AppGlobals, 'renderDrillTabList');
        w.switchToProtokoll();
        expect(w.state.activeView).toBe('protokoll');
        // Genau 2 Calls sind KORREKT (Parität zu dev @ 1fd3899, vor #417):
        //   1. switchToProtokoll() selbst ruft renderDrillTabList direkt
        //      beim Öffnen der Protokoll-Ansicht,
        //   2. der Coordinator-Plan für VIEW_CHANGED ruft sie via
        //      _inlineAfterViewChanged nochmal (auch das machte dev schon).
        // Ein Refactor darf dieses Verhalten nicht stillschweigend ändern;
        // eine Deduplizierung wäre ein eigenes Issue.
        expect(drillList).toHaveBeenCalledTimes(2);
        const persisted = JSON.parse(store['agrar_rechner']);
        expect(persisted.activeView).toBe('protokoll');
        drillList.mockRestore();
    });

    it('onInputHektar() → ENTRY_CHANGED → saveState + renderResults', () => {
        var el = w.document.getElementById('hektar');
        el.value = '12,5';
        const results = vi.spyOn(w.AppGlobals, 'renderResults');
        w.onInputHektar(el);
        expect(w.state.reiter[0].hektar).toBe(12.5);
        expect(results).toHaveBeenCalledTimes(1);
        const persisted = JSON.parse(store['agrar_rechner']);
        expect(persisted.reiter[0].hektar).toBe(12.5);
        results.mockRestore();
    });

    it('openDashboard() → DASHBOARD_OPENED → saveState + renderTabs (Nav)', () => {
        // renderDashboard ist Teil von openDashboard selbst (das Sheet-Render),
        // der Coordinator re-rendert NUR die Top-Level-Nav.
        const tabs = vi.spyOn(w.AppGlobals, 'renderTabs');
        w.openDashboard();
        expect(w.state.dashboardOpen).toBe(true);
        expect(tabs).toHaveBeenCalledTimes(1);
        const persisted = JSON.parse(store['agrar_rechner']);
        expect(persisted.dashboardOpen).toBe(true);
        tabs.mockRestore();
    });

    it('resetAll() → RESET_ALL → saveState + renderKulturBadge + openKulturFirstRun', () => {
        // Zustand vorher aufbauen
        w.state.reiter[0].hektar = 5;
        w.state.reiter[0].koerner = 90000;
        const badge = vi.spyOn(w.AppGlobals, 'renderKulturBadge');
        const empfehlung = vi.spyOn(w.AppGlobals, '_renderKulturEmpfehlung');
        const openFirstRun = vi.spyOn(w.AppGlobals, 'openKulturFirstRun');
        w.resetAll();
        expect(w.state.reiter[0].hektar).toBe(0);
        expect(w.state.kultur).toBe(null);
        expect(w.state.erstauswahlDone).toBe(false);
        expect(badge).toHaveBeenCalledTimes(1);
        expect(empfehlung).toHaveBeenCalledTimes(1);
        expect(openFirstRun).toHaveBeenCalledTimes(1);
        const persisted = JSON.parse(store['agrar_rechner']);
        expect(persisted.kultur).toBe(null);
        expect(persisted.erstauswahlDone).toBe(false);
        badge.mockRestore();
        empfehlung.mockRestore();
        openFirstRun.mockRestore();
    });
});

describe('Issue #417 — Renderer-Quellcode: kein direkter saveState() mehr', () => {
    // Statischer Test: lädt die Datei-Quellcodes und prüft, dass
    // render-tabs.js, render-drill.js, render-dashboard.js KEIN
    // AppGlobals.saveState() mehr enthalten. Persistenz läuft seit
    // Issue #417 zentral über den Coordinator.
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const jsDir = resolve(__dirname, '../public/js');

    function src(name) {
        return readFileSync(resolve(jsDir, name), 'utf-8');
    }

    // Nur Code-Zeilen zählen — Kommentarzeilen (beginnend mit // oder
    // innerhalb /* ... */) ignorieren wir, weil Kommentare die Regel
    // historisch dokumentieren ohne sie auszuüben.
    function stripCommentsAndStrings(text) {
        // Mehrzeilige Kommentare entfernen
        var out = text.replace(/\/\*[\s\S]*?\*\//g, '');
        // Einzeilige Kommentare entfernen (nur ganze Zeilen)
        out = out.split('\n').map(function (l) {
            var idx = l.indexOf('//');
            return idx === -1 ? l : l.substring(0, idx);
        }).join('\n');
        // Strings entfernen (heuristisch — reicht für statische Checks)
        out = out.replace(/'[^'\n]*'/g, "''");
        out = out.replace(/"[^"\n]*"/g, '""');
        return out;
    }

    it('render-tabs.js ruft AppGlobals.saveState NICHT mehr selbst auf', () => {
        const text = stripCommentsAndStrings(src('render-tabs.js'));
        const matches = text.match(/AppGlobals\.saveState\s*\(/g);
        expect(
            matches,
            'render-tabs.js enthält AppGlobals.saveState() — Persistenz darf nur noch im Coordinator laufen (Issue #417)'
        ).toBeNull();
    });

    it('render-drill.js ruft AppGlobals.saveState NICHT mehr selbst auf', () => {
        const text = stripCommentsAndStrings(src('render-drill.js'));
        const matches = text.match(/AppGlobals\.saveState\s*\(/g);
        expect(
            matches,
            'render-drill.js enthält AppGlobals.saveState() — der prio/doneBtn-Inline-Handler muss appEmit(DRILL_PRIORITY_CHANGED/DRILL_DONE_CHANGED) nutzen'
        ).toBeNull();
    });

    it('render-dashboard.js ruft AppGlobals.saveState NICHT mehr selbst auf', () => {
        const text = stripCommentsAndStrings(src('render-dashboard.js'));
        const matches = text.match(/AppGlobals\.saveState\s*\(/g);
        expect(
            matches,
            'render-dashboard.js enthält AppGlobals.saveState() — openDashboard/closeDashboard müssen appEmit(DASHBOARD_OPENED/CLOSED) nutzen'
        ).toBeNull();
    });
});
