/**
 * Issue #417 — App-Shell-Vertrag für das neue Modul
 * `public/js/state-coordinator.js`.
 *
 * Scope dieser Welle: Persistenz + Re-Render-Orchestrierung als Single
 * Source of Truth bündeln, damit die Frage "was passiert bei welchem
 * Event?" an EINER Stelle beantwortet wird.
 *
 * Vertrag (Production + Test-Helper müssen konsistent sein):
 *
 *   1. `public/js/state-coordinator.js` MUSS existieren.
 *
 *   2. `index.html` lädt `state-coordinator.js` NACH `render-tabs.js`
 *      (das initUI ruft AppGlobals.registerStateCoordinator() auf)
 *      und VOR `render-results.js` (der Coordinator verteilt an
 *      renderResults, renderDrillTabList etc. — die Modul-Load-Reihenfolge
 *      ist hier nur dokumentarisch, die Auflösung passiert defensiv
 *      per AppGlobals).
 *
 *   3. `tests/helpers.js` MUSS `state-coordinator.js` laden, damit
 *      AppGlobals.appDispatch / registerStateCoordinator / getEventPlan
 *      in jsdom verfügbar sind. Sonst liefe die Test-Suite weiter mit
 *      "appEmit→Subscribern aus render-tabs.js" und alle Tests, die
 *      indirekt vom Coordinator abhängen (Doppel-Persistenz, fehlende
 *      Renderer-Trigger), würden rot laufen — obwohl Production grün wäre.
 *
 *   4. `sw.js` STATIC_ASSETS MUSS `/js/state-coordinator.js` enthalten.
 *      Sonst liefert die Network-First-Strategie das frisch ausgelieferte
 *      HTML aus, der Offline-Cache bleibt unvollständig → nächster
 *      Offline-Restart bricht.
 *
 *   5. Registrierte AppGlobals-API: `appDispatch`, `getEventPlan`,
 *      `registerStateCoordinator`.
 *
 *   6. Verhaltens-Vertrag: kein Renderer (render-tabs.js, render-drill.js,
 *      render-dashboard.js) darf mehr `saveState()` aufrufen — sonst gibt
 *      es bei einem Event sowohl eine Persistenz vom Renderer als auch
 *      vom Coordinator (Doppel-Persistenz).
 *
 * Die Reihenfolge in der App-Shell (Production + Test-Helper):
 *   ... → render-tabs.js → state-coordinator.js → render-results.js → ...
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createDom } from './helpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsDir = resolve(__dirname, '../public/js');
const publicDir = resolve(__dirname, '../public');
const indexPath = resolve(publicDir, 'index.html');
const helpersPath = resolve(__dirname, 'helpers.js');
const swPath = resolve(publicDir, 'sw.js');
const stateCoordinatorPath = resolve(jsDir, 'state-coordinator.js');

function readStaticAssets(swContent) {
    const block = swContent.match(/STATIC_ASSETS\s*=\s*\[([\s\S]*?)\]/);
    if (!block) return [];
    return block[1]
        .split('\n')
        .map(function (l) { return l.trim().replace(/,$/, '').replace(/^['"]|['"]$/g, ''); })
        .filter(function (l) { return l && !l.startsWith('//'); });
}

describe('Issue #417 — state-coordinator.js App-Shell-Vertrag', () => {
    it('public/js/state-coordinator.js existiert als eigenständiges Modul', () => {
        let exists = false;
        try { readFileSync(stateCoordinatorPath, 'utf-8'); exists = true; } catch (e) { exists = false; }
        expect(
            exists,
            'Erwartet public/js/state-coordinator.js — der Coordinator ist sonst nicht extrahiert'
        ).toBe(true);
    });

    it('index.html lädt state-coordinator.js NACH render-tabs.js, VOR render-results.js', () => {
        const indexHtml = readFileSync(indexPath, 'utf-8');
        // Sammle <script src="…"> Reihenfolge in einer flachen Liste
        var loaded = [];
        var re = /<script\s+src=["']([^"']+)["']/g;
        var m;
        while ((m = re.exec(indexHtml)) !== null) loaded.push(m[1]);
        var renderTabsIdx = -1, coordinatorIdx = -1, renderResultsIdx = -1;
        for (var i = 0; i < loaded.length; i++) {
            if (/render-tabs\.js$/.test(loaded[i])) renderTabsIdx = i;
            else if (/state-coordinator\.js$/.test(loaded[i])) coordinatorIdx = i;
            else if (/render-results\.js/.test(loaded[i])) renderResultsIdx = i;
        }
        expect(renderTabsIdx, 'render-tabs.js muss in index.html geladen sein').toBeGreaterThanOrEqual(0);
        expect(coordinatorIdx, 'state-coordinator.js muss in index.html geladen sein').toBeGreaterThanOrEqual(0);
        expect(renderResultsIdx, 'render-results.js muss in index.html geladen sein').toBeGreaterThanOrEqual(0);
        expect(
            renderTabsIdx,
            'state-coordinator.js muss NACH render-tabs.js geladen werden — initUI() ruft AppGlobals.registerStateCoordinator()'
        ).toBeLessThan(coordinatorIdx);
        expect(
            renderResultsIdx,
            'state-coordinator.js muss VOR render-results.js geladen werden — Coordinator verteilt an renderResults defensiv'
        ).toBeGreaterThan(coordinatorIdx);
    });

    it('tests/helpers.js lädt state-coordinator.js (Test-Helper-Parität zur Production-App-Shell)', () => {
        const helpersContent = readFileSync(helpersPath, 'utf-8');
        expect(
            helpersContent,
            'fehlt in tests/helpers.js: loadModule("state-coordinator.js") — sonst ist AppGlobals.appDispatch in jsdom undefined'
        ).toMatch(/loadModule\(\s*['"]state-coordinator\.js['"]\s*\)/);
    });

    it('sw.js STATIC_ASSETS enthält /js/state-coordinator.js (Offline-Bootstrap)', () => {
        const swContent = readFileSync(swPath, 'utf-8');
        const staticAssets = readStaticAssets(swContent);
        expect(
            staticAssets,
            'fehlt in STATIC_ASSETS: /js/state-coordinator.js — sonst bricht der erste Offline-Restart'
        ).toContain('/js/state-coordinator.js');
    });
});

describe('Issue #417 — state-coordinator.js öffentliche API', () => {
    it('registriert appDispatch, getEventPlan, registerStateCoordinator auf AppGlobals', () => {
        const w = createDom().window;
        expect(typeof w.AppGlobals.appDispatch, 'AppGlobals.appDispatch fehlt').toBe('function');
        expect(typeof w.AppGlobals.getEventPlan, 'AppGlobals.getEventPlan fehlt').toBe('function');
        expect(typeof w.AppGlobals.registerStateCoordinator, 'AppGlobals.registerStateCoordinator fehlt').toBe('function');
    });

    it('getEventPlan liefert für jeden Eventtyp {persist, renderers}', () => {
        const w = createDom().window;
        const plan = w.AppGlobals.getEventPlan();
        // Mindestens die 13 Bestands-Eventtypen aus der render-tabs-Switch
        // (vor Issue #417) müssen im Plan sein.
        var expected = [
            'TAB_CHANGED', 'TAB_ADDED', 'TAB_REMOVED', 'TAB_RENAMED',
            'TAB_RESET', 'ENTRY_ADDED', 'ENTRY_REMOVED', 'ENTRY_CHANGED',
            'CALCULATION_DONE', 'SETTINGS_CHANGED', 'VIEW_CHANGED',
            'PROTOCOL_VIEW_CHANGED', 'DRILL_ENTRY_ADDED', 'DRILL_ENTRY_REMOVED',
            'KULTUR_CHANGED'
        ];
        for (var i = 0; i < expected.length; i++) {
            var e = expected[i];
            expect(plan[e], 'Eventtyp ' + e + ' fehlt im Plan').toBeTruthy();
            expect(typeof plan[e].persist, 'persist-Flag fehlt für ' + e).toBe('boolean');
            expect(Array.isArray(plan[e].renderers), 'renderers-Array fehlt für ' + e).toBe(true);
        }
    });

    it('Persistenz-Flag ist true für alle dokumentierten Events (heute: alle)', () => {
        const w = createDom().window;
        var plan = w.AppGlobals.getEventPlan();
        for (var key in plan) {
            if (!Object.prototype.hasOwnProperty.call(plan, key)) continue;
            expect(plan[key].persist, 'Persistenz für ' + key + ' sollte true sein').toBe(true);
        }
    });
});
