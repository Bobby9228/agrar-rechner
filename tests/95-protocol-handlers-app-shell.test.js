/**
 * Issue #416 (Welle 7) — App-Shell-Vertrag für das neue Modul
 * `public/js/protocol-handlers.js` (extrahiert aus ui-handlers.js).
 *
 * Scope dieser Welle: zusammenhängender Block „Lokales Protokoll-Redesign —
 * Action-Sheet, View-Toggle, Accordion" aus ui-handlers.js
 *   - setProtocolView, toggleProtocolAccordion
 *   - requestLocalProtocolDelete, closeLocalProtocolSheet,
 *     confirmLocalProtocolDelete
 *   - privater Modulzustand _localProtocolSheetTarget
 *
 * Bewusst NICHT extrahiert (bleiben in ui-handlers.js):
 *   - Import/Export-Block (buildExportEnvelope, exportData,
 *     validateImportText, …) — nutzt defensiv
 *     AppGlobals.syncStateFromInputs / syncInputsFromState.
 *   - Kultur / Tabs / Settings / Reset / Drill / Input / Berechnung / Render
 *
 * Der Vertrag ist so eng wie möglich gefasst, damit eine spätere
 * Extraktion keine ungeplanten Seiteneffekte hat:
 *
 *   1. Die Datei `public/js/protocol-handlers.js` MUSS existieren —
 *      ohne sie ist die Extraktion nicht abgeschlossen.
 *   2. `index.html` lädt `protocol-handlers.js` NACH `drill-handlers.js`
 *      (das in protocol-handlers.js lebende confirmLocalProtocolDelete
 *      ruft beim Nutzeraufruf defensiv AppGlobals.drillRemove und
 *      AppGlobals.drillMachineRemove aus drill-handlers.js auf) und VOR
 *      `tab-handlers.js` (konsistentes Wellen-Bild #416: drill → protocol
 *      → tab). Eine andere Reihenfolge kann fehlende Voraussetzungen oder
 *      eine unvollständige öffentliche API erzeugen.
 *   3. `tests/helpers.js` MUSS `protocol-handlers.js` laden, damit die
 *      bestehende Test-Suite gegen dieselbe Modul-Architektur läuft wie
 *      Production. Sonst wären `w.setProtocolView()`, `w.toggleProtocolAccordion()`
 *      und Co. in jsdom undefined und alle lokalen-Protokoll-Tests dieser
 *      Welle würden RED laufen — obwohl Production grün wäre.
 *   4. `sw.js` STATIC_ASSETS MUSS `/js/protocol-handlers.js` enthalten.
 *      Sonst liefert die network-first-Strategie das frisch ausgelieferte
 *      HTML aus, der Offline-Cache der App-Shell bleibt aber unvollständig
 *      → nächster Offline-Restart bricht.
 *   5. Die Network-First-Strategie und der übrige Service-Worker bleiben
 *      unangetastet (per Stichprobe — skipWaiting/claim/fetch dürfen
 *      nicht versehentlich refaktored werden).
 *   6. API-Vertrag: alle fünf öffentlichen Funktionen bleiben sowohl
 *      als klassische window-Namen (onclick="AppGlobals.…" und
 *      direkter window.setProtocolView) als auch auf AppGlobals
 *      identisch erreichbar — Verbraucher sind render-local-protocol.js
 *      (über AppGlobals defensiv), index.html (inline onclick) und die
 *      Test-Suite (direkter Aufruf). Wird der Block in ui-handlers.js
 *      belassen, wandert die AppGlobals-Registrierung nicht mit, was
 *      diese Welle in einen API-Halbzustand versetzt.
 *   7. Die fünf Funktionsdefinitionen sind aus ui-handlers.js entfernt —
 *      verhindert eine parallele "Doppelregistrierung" bei einem späteren
 *      Re-Extract und hält die Verantwortung pro Modul eindeutig.
 *      _localProtocolSheetTarget ist privater Modulzustand des neuen
 *      Moduls und verlässt ui-handlers.js ebenfalls.
 *
 * Die Reihenfolge in der App-Shell (Production + Test-Helper):
 *   ... → drill-handlers.js → protocol-handlers.js → tab-handlers.js → ...
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');
const jsDir = resolve(publicDir, 'js');
const protocolHandlersPath = resolve(jsDir, 'protocol-handlers.js');
const uiHandlersPath = resolve(jsDir, 'ui-handlers.js');
const helpersPath = resolve(__dirname, 'helpers.js');

const FIVE_PUBLIC = [
    'setProtocolView',
    'toggleProtocolAccordion',
    'requestLocalProtocolDelete',
    'closeLocalProtocolSheet',
    'confirmLocalProtocolDelete',
];

function readScripts(htmlContent) {
    const re = /<script\s+src=["']js\/([^"']+)["']\s*><\/script>/g;
    const out = [];
    let m;
    while ((m = re.exec(htmlContent)) !== null) out.push(m[1].split('?')[0]);
    return out;
}

function readStaticAssets(swContent) {
    const block = swContent.match(/STATIC_ASSETS\s*=\s*\[([\s\S]*?)\]/);
    if (!block) throw new Error('STATIC_ASSETS block in sw.js nicht gefunden');
    const assets = [];
    const re = /'([^']+)'/g;
    let m;
    while ((m = re.exec(block[1])) !== null) assets.push(m[1]);
    return assets;
}

describe('Issue #416 Welle 7 — protocol-handlers.js App-Shell-Vertrag', () => {
    it('public/js/protocol-handlers.js existiert als eigenständiges Modul', () => {
        expect(
            existsSync(protocolHandlersPath),
            'Erwartet public/js/protocol-handlers.js — die Extraktion aus ui-handlers.js ist sonst nicht abgeschlossen'
        ).toBe(true);
    });

    it('index.html lädt protocol-handlers.js NACH drill-handlers.js, VOR tab-handlers.js', () => {
        const indexContent = readFileSync(resolve(publicDir, 'index.html'), 'utf-8');
        const loaded = readScripts(indexContent);
        const drillIdx = loaded.indexOf('drill-handlers.js');
        const protocolIdx = loaded.indexOf('protocol-handlers.js');
        const tabHandlersIdx = loaded.indexOf('tab-handlers.js');

        expect(drillIdx, 'drill-handlers.js fehlt in der App-Shell').toBeGreaterThanOrEqual(0);
        expect(tabHandlersIdx, 'tab-handlers.js fehlt in der App-Shell').toBeGreaterThanOrEqual(0);

        // Reihenfolge: drill-handlers.js < protocol-handlers.js < tab-handlers.js
        expect(
            drillIdx,
            'drill-handlers.js muss vor protocol-handlers.js geladen werden (AppGlobals.drillRemove/drillMachineRemove-Bridge)'
        ).toBeLessThan(protocolIdx);
        expect(
            protocolIdx,
            'protocol-handlers.js muss vor tab-handlers.js geladen werden (Wellen-Reihenfolge #416)'
        ).toBeLessThan(tabHandlersIdx);
    });

    it('tests/helpers.js lädt protocol-handlers.js (Test-Helper-Parität zur Production-App-Shell)', () => {
        const helpersContent = readFileSync(helpersPath, 'utf-8');
        expect(
            helpersContent,
            'fehlt in tests/helpers.js: loadModule("protocol-handlers.js") — sonst sind w.setProtocolView() etc. in jsdom undefined'
        ).toMatch(/loadModule\(\s*['"]protocol-handlers\.js['"]\s*\)/);
    });

    it('sw.js STATIC_ASSETS enthält /js/protocol-handlers.js (Offline-Bootstrap)', () => {
        const swContent = readFileSync(resolve(publicDir, 'sw.js'), 'utf-8');
        const staticAssets = readStaticAssets(swContent);
        expect(
            staticAssets,
            'fehlt in STATIC_ASSETS: /js/protocol-handlers.js — sonst bricht der erste Offline-Restart'
        ).toContain('/js/protocol-handlers.js');
    });

    it('sw.js Network-First-Strategie und sonstige SW-Logik bleiben unangetastet', () => {
        // Stichprobe: die kanonischen Worker-Bestandteile müssen weiter
        // vorhanden sein. Eine Extraktion darf weder den Fetch-Handler noch
        // skipWaiting/claim entfernen.
        const swContent = readFileSync(resolve(publicDir, 'sw.js'), 'utf-8');
        expect(swContent).toMatch(/self\.skipWaiting\s*\(\s*\)/);
        expect(swContent).toMatch(/self\.clients\.claim\s*\(\s*\)/);
        // Network-First: fetch(e.request) wird im Erfolgsfall in den Cache
        // gespiegelt; bei Netz-Fehler liefert caches.match Fallback.
        expect(swContent).toMatch(/fetch\s*\(\s*e\.request\s*\)/);
        expect(swContent).toMatch(/caches\.open\s*\(\s*CACHE_VERSION\s*\)/);
        expect(swContent).toMatch(/caches\.match\s*\(\s*e\.request\s*\)/);
    });

    it('API: alle fünf Funktionen bleiben sowohl als window-Namen als auch auf AppGlobals erreichbar', () => {
        // Verbraucher sind render-local-protocol.js (über AppGlobals defensiv),
        // index.html (inline onclick="AppGlobals.…") und die Test-Suite
        // (direkter window-Aufruf). Bleibt der Block doppelt (Definition in
        // ui-handlers.js, Registrierung ebenfalls dort), funktioniert die
        // App weiter — aber die Welle wäre dann nicht abgeschlossen.
        const w = createDom().window;
        FIVE_PUBLIC.forEach(function (name) {
            expect(typeof w[name], 'window.' + name + ' fehlt (sollte nach Extraktion weiterhin global verfügbar sein)').toBe('function');
            expect(typeof w.AppGlobals[name], 'AppGlobals.' + name + ' fehlt (registriert durch protocol-handlers.js)').toBe('function');
        });
    });

    it('ui-handlers.js: keine der fünf Funktionsdefinitionen mehr enthalten (Block vollständig extrahiert)', () => {
        // Verhindert eine "Doppelregistrierung" bei einem späteren Re-Extract
        // und hält die Verantwortung pro Modul eindeutig. Vor Welle 7 stehen
        // die Definitionen noch in ui-handlers.js → RED.
        const uiContent = readFileSync(uiHandlersPath, 'utf-8');
        FIVE_PUBLIC.forEach(function (name) {
            const re = new RegExp('function\\s+' + name + '\\s*\\(');
            expect(
                re.test(uiContent),
                'ui-handlers.js enthält noch "function ' + name + '(...)" — Block ist nicht vollständig extrahiert'
            ).toBe(false);
        });
        // Privater Modulzustand: _localProtocolSheetTarget lebt jetzt in
        // protocol-handlers.js und darf nicht weiter in ui-handlers.js
        // verbleiben (sonst gibt es zwei konkurrierende Pending-Targets).
        expect(
            uiContent,
            'ui-handlers.js enthält noch "var _localProtocolSheetTarget" — privater Modulzustand muss mit dem Block wandern'
        ).not.toMatch(/var\s+_localProtocolSheetTarget\s*=/);
        // AppGlobals-Registrierung der fünf Namen ist nicht mehr in
        // ui-handlers.js — sie kommt jetzt aus protocol-handlers.js.
        FIVE_PUBLIC.forEach(function (name) {
            const re = new RegExp('^\\s*' + name + '\\s*:\\s*' + name + '\\s*,?\\s*$', 'm');
            expect(
                re.test(uiContent),
                'ui-handlers.js registriert "' + name + ': ' + name + '" noch selbst — Registrierung gehört nach protocol-handlers.js'
            ).toBe(false);
        });
    });
});
