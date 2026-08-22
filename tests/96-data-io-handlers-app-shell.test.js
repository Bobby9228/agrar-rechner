/**
 * Issue #416 (Welle 8) — App-Shell-Vertrag für das neue Modul
 * `public/js/data-io-handlers.js` (extrahiert aus ui-handlers.js).
 *
 * Scope dieser Welle: zusammenhängender Block „DATEN-EXPORT/IMPORT —
 * versionierter JSON-Backup & Restore" aus ui-handlers.js
 *   - Konstanten: EXPORT_APP_KEY, EXPORT_FORMAT_VERSION, EXPORT_MAX_BYTES
 *   - Envelope-Builder: buildExportEnvelope, serializeEnvelope,
 *     makeExportFilename
 *   - Export-Download: exportData
 *   - Import-Validierung: validateImportText, importErrorMessage,
 *     showImportError
 *   - Vorschau-Modal: showImportPreview, openImportModal, closeImportModal,
 *     confirmImportFromModal, cancelImportFromModal
 *   - Commit: syncImportedSettingsUI, commitImportedState
 *   - Status-Bereich: setExportSuccess, showExportError, showStatusError,
 *     showStatus
 *   - File-Reader-Hook: handleImportFile, onImportFileChange,
 *     triggerImportClick
 *   - Bootstrap: initDataExportImport
 *
 * Bewusst NICHT Teil dieser Welle: Tabs / Settings / Reset / Drill /
 * Kultur / Input / Render / Berechnung / App-Init bleiben in ihren
 * bestehenden Modulen.
 *
 * Besonderheiten dieser Welle (Issue #416 Welle 8):
 *
 *   1. `initDataExportImport` wird aus main.js erst zur Laufzeit
 *      (DOMContentLoaded → AppGlobals.initDataExportImport()) aufgerufen.
 *      Es MUSS also vor main.js geladen sein, sonst fehlt die Funktion beim
 *      ersten Boot — der Footer-Daten-I/O reagiert dann auf keinen Klick.
 *
 *   2. Sämtliche Modul-Abhängigkeiten (AppGlobals.syncStateFromInputs,
 *      AppGlobals.parseAndSanitizeState, AppGlobals.saveState,
 *      AppGlobals.renderTabs/Results/View/Dashboard/KulturBadge/…, etc.)
 *      werden defensiv erst beim Nutzeraufruf aufgelöst — keine
 *      Modul-Load-Abhängigkeit. Daher kann data-io-handlers.js als
 *      „spätes" Modul nach allen benötigten Handlern/Renderern und direkt
 *      vor main.js geladen werden.
 *
 *   3. Klassische Top-Level-Deklarationen bleiben für bestehende
 *      Window-Namen-Nutzung erhalten (z.B. die internen Helper
 *      `serializeEnvelope`, `syncImportedSettingsUI`, `showStatus`,
 *      `showStatusError` — letztere drei waren NIE in AppGlobals
 *      registriert und müssen weiterhin als klassische Globals
 *      auflösbar sein).
 *
 * Der Vertrag ist so eng wie möglich gefasst, damit die Extraktion
 * keine ungeplanten Seiteneffekte hat:
 *
 *   1. Die Datei `public/js/data-io-handlers.js` MUSS existieren —
 *      ohne sie ist die Extraktion nicht abgeschlossen.
 *   2. `index.html` lädt `data-io-handlers.js` NACH allen anderen
 *      Modulen (render-local-protocol.js) und VOR `main.js` (sonst ist
 *      `initDataExportImport` beim DOMContentLoaded-Handler noch nicht
 *      registriert). Eine andere Reihenfolge kann fehlende
 *      Voraussetzungen oder eine unvollständige öffentliche API erzeugen.
 *   3. `tests/helpers.js` MUSS `data-io-handlers.js` laden, damit die
 *      bestehende Test-Suite gegen dieselbe Modul-Architektur läuft wie
 *      Production. Sonst wären `w.exportData()`, `w.validateImportText()`
 *      und Co. in jsdom undefined und alle Daten-IO-Tests dieser Welle
 *      würden RED laufen — obwohl Production grün wäre.
 *   4. `sw.js` STATIC_ASSETS MUSS `/js/data-io-handlers.js` enthalten.
 *      Sonst liefert die network-first-Strategie das frisch
 *      ausgelieferte HTML aus, der Offline-Cache der App-Shell bleibt
 *      aber unvollständig → nächster Offline-Restart bricht.
 *   5. Die Network-First-Strategie und der übrige Service-Worker bleiben
 *      unangetastet (per Stichprobe — skipWaiting/claim/fetch dürfen
 *      nicht versehentlich refaktored werden). Insbesondere
 *      CACHE_VERSION und die Query-Versionen (?v=21/?v=22/?v=3) bleiben
 *      unverändert.
 *   6. API-Vertrag: alle drei Konstanten und 22 Funktionen bleiben als
 *      klassische window-Namen erreichbar. Die drei internen Helfer
 *      showStatusError, showStatus und syncImportedSettingsUI bleiben wie
 *      zuvor bewusst außerhalb von AppGlobals; alle bisher dort
 *      registrierten Namen bleiben zusätzlich auf AppGlobals erreichbar.
 *   7. Die Definitionen (Funktionen + Konstanten) sind aus
 *      ui-handlers.js entfernt — verhindert eine parallele
 *      "Doppelregistrierung" bei einem späteren Re-Extract und hält die
 *      Verantwortung pro Modul eindeutig. Ebenso die AppGlobals-
 *      Registrierung des kompletten Daten-I/O-Scopes.
 *
 * Die Reihenfolge in der App-Shell (Production + Test-Helper):
 *   ... → render-local-protocol.js → data-io-handlers.js → main.js
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');
const jsDir = resolve(publicDir, 'js');
const dataIoHandlersPath = resolve(jsDir, 'data-io-handlers.js');
const uiHandlersPath = resolve(jsDir, 'ui-handlers.js');
const helpersPath = resolve(__dirname, 'helpers.js');

const DATA_IO_CONSTANTS = [
    'EXPORT_APP_KEY',
    'EXPORT_FORMAT_VERSION',
    'EXPORT_MAX_BYTES',
];

// Funktionen, die im HEAD-Block auf AppGlobals registriert wurden
// (siehe ui-handlers.js Z. 571–594, unverändert übernommen).
const DATA_IO_FUNCTIONS_APPGLOBALS = [
    'buildExportEnvelope',
    'serializeEnvelope',
    'makeExportFilename',
    'exportData',
    'validateImportText',
    'importErrorMessage',
    'showImportPreview',
    'openImportModal',
    'closeImportModal',
    'confirmImportFromModal',
    'cancelImportFromModal',
    'showImportError',
    'commitImportedState',
    'setExportSuccess',
    'showExportError',
    'handleImportFile',
    'onImportFileChange',
    'triggerImportClick',
    'initDataExportImport',
];

// Funktionen, die ausschließlich klassisch (window.X) auflösbar sein
// müssen, weil sie NIE auf AppGlobals registriert wurden
// (AppGlobals-Auflösungen dieser Welle ändern sich NICHT defensiv).
const CLASSIC_ONLY_NAMES = [
    'showStatusError',
    'showStatus',
    'syncImportedSettingsUI',
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

describe('Issue #416 Welle 8 — data-io-handlers.js App-Shell-Vertrag', () => {
    it('public/js/data-io-handlers.js existiert als eigenständiges Modul', () => {
        expect(
            existsSync(dataIoHandlersPath),
            'Erwartet public/js/data-io-handlers.js — die Extraktion aus ui-handlers.js ist sonst nicht abgeschlossen'
        ).toBe(true);
    });

    it('index.html lädt data-io-handlers.js NACH render-local-protocol.js, VOR main.js', () => {
        const indexContent = readFileSync(resolve(publicDir, 'index.html'), 'utf-8');
        const loaded = readScripts(indexContent);
        const renderProtocolIdx = loaded.indexOf('render-local-protocol.js');
        const dataIoIdx = loaded.indexOf('data-io-handlers.js');
        const mainIdx = loaded.indexOf('main.js');

        expect(renderProtocolIdx, 'render-local-protocol.js fehlt in der App-Shell').toBeGreaterThanOrEqual(0);
        expect(mainIdx, 'main.js fehlt in der App-Shell').toBeGreaterThanOrEqual(0);

        // Reihenfolge: render-local-protocol.js < data-io-handlers.js < main.js
        expect(
            renderProtocolIdx,
            'render-local-protocol.js muss vor data-io-handlers.js geladen werden (commitImportedState nutzt AppGlobals.renderLocalProtocol defensiv)'
        ).toBeLessThan(dataIoIdx);
        expect(
            dataIoIdx,
            'data-io-handlers.js muss vor main.js geladen werden — main.js ruft AppGlobals.initDataExportImport() in DOMContentLoaded auf'
        ).toBeLessThan(mainIdx);
    });

    it('tests/helpers.js lädt data-io-handlers.js (Test-Helper-Parität zur Production-App-Shell)', () => {
        const helpersContent = readFileSync(helpersPath, 'utf-8');
        expect(
            helpersContent,
            'fehlt in tests/helpers.js: loadModule("data-io-handlers.js") — sonst sind w.exportData(), w.validateImportText() etc. in jsdom undefined'
        ).toMatch(/loadModule\(\s*['"]data-io-handlers\.js['"]\s*\)/);
    });

    it('sw.js STATIC_ASSETS enthält /js/data-io-handlers.js (Offline-Bootstrap)', () => {
        const swContent = readFileSync(resolve(publicDir, 'sw.js'), 'utf-8');
        const staticAssets = readStaticAssets(swContent);
        expect(
            staticAssets,
            'fehlt in STATIC_ASSETS: /js/data-io-handlers.js — sonst bricht der erste Offline-Restart'
        ).toContain('/js/data-io-handlers.js');
    });

    it('sw.js Network-First-Strategie, CACHE_VERSION und Query-Versionen bleiben unangetastet', () => {
        // Stichprobe: die kanonischen Worker-Bestandteile müssen weiter
        // vorhanden sein. Eine Extraktion darf weder den Fetch-Handler noch
        // skipWaiting/claim entfernen oder CACHE_VERSION bumpen.
        const swContent = readFileSync(resolve(publicDir, 'sw.js'), 'utf-8');
        expect(swContent).toMatch(/self\.skipWaiting\s*\(\s*\)/);
        expect(swContent).toMatch(/self\.clients\.claim\s*\(\s*\)/);
        // Network-First: fetch(e.request) wird im Erfolgsfall in den Cache
        // gespiegelt; bei Netz-Fehler liefert caches.match Fallback.
        expect(swContent).toMatch(/fetch\s*\(\s*e\.request\s*\)/);
        expect(swContent).toMatch(/caches\.open\s*\(\s*CACHE_VERSION\s*\)/);
        expect(swContent).toMatch(/caches\.match\s*\(\s*e\.request\s*\)/);
        // CACHE_VERSION darf von dieser Welle nicht verändert werden
        expect(swContent).toMatch(/const\s+CACHE_VERSION\s*=\s*['"]agrar-rechner-v51['"]/);
        // Query-Versionen für die existierenden Skripte bleiben unverändert
        expect(swContent).toMatch(/\/css\/styles\.css\?v=21/);
        expect(swContent).toMatch(/\/js\/calculations\.js\?v=21/);
        expect(swContent).toMatch(/\/js\/ui-handlers\.js\?v=22/);
        expect(swContent).toMatch(/\/js\/render-results\.js\?v=21/);
        expect(swContent).toMatch(/\/js\/render-local-protocol\.js\?v=3/);
    });

    it('API: alle drei Konstanten bleiben sowohl als window-Namen als auch auf AppGlobals erreichbar', () => {
        const w = createDom().window;
        // EXPORT_APP_KEY ist string, EXPORT_FORMAT_VERSION/EXPORT_MAX_BYTES
        // sind number — Test prüft, dass der Typ ungleich 'undefined' ist.
        DATA_IO_CONSTANTS.forEach(function (name) {
            expect(typeof w[name], 'window.' + name + ' fehlt (sollte nach Extraktion weiterhin global verfügbar sein)').not.toBe('undefined');
            expect(typeof w.AppGlobals[name], 'AppGlobals.' + name + ' fehlt (registriert durch data-io-handlers.js)').not.toBe('undefined');
        });
    });

    it('API: alle 19 AppGlobals-registrierten Funktionen bleiben sowohl als window-Namen als auch auf AppGlobals erreichbar', () => {
        // Verbraucher sind render-* (über AppGlobals defensiv), index.html
        // (inline onclick="AppGlobals.…"), main.js (initDataExportImport)
        // und die Test-Suite (direkter window-Aufruf). Bleibt der Block
        // doppelt (Definition in ui-handlers.js, Registrierung ebenfalls
        // dort), funktioniert die App weiter — aber die Welle wäre dann
        // nicht abgeschlossen.
        const w = createDom().window;
        DATA_IO_FUNCTIONS_APPGLOBALS.forEach(function (name) {
            expect(typeof w[name], 'window.' + name + ' fehlt (sollte nach Extraktion weiterhin global verfügbar sein)').toBe('function');
            expect(typeof w.AppGlobals[name], 'AppGlobals.' + name + ' fehlt (registriert durch data-io-handlers.js)').toBe('function');
        });
    });

    it('Klassische-only-Namen (showStatus, showStatusError, syncImportedSettingsUI) bleiben über window.* auflösbar', () => {
        // Diese drei Namen waren NIE in AppGlobals registriert. Sie
        // müssen weiterhin als klassische window-Namen funktionieren,
        // weil interne Helper (z.B. setExportSuccess → showStatus) sie
        // direkt referenzieren.
        const w = createDom().window;
        CLASSIC_ONLY_NAMES.forEach(function (name) {
            expect(typeof w[name], 'window.' + name + ' fehlt (interner klassischer Aufrufer — muss global bleiben)').toBe('function');
        });
    });

    it('ui-handlers.js: keine Daten-I/O-Funktionsdefinitionen und keine Konstanten mehr enthalten (Block vollständig extrahiert)', () => {
        // Verhindert eine "Doppelregistrierung" bei einem späteren
        // Re-Extract und hält die Verantwortung pro Modul eindeutig. Vor
        // Welle 8 stehen die Definitionen noch in ui-handlers.js → RED.
        const uiContent = readFileSync(uiHandlersPath, 'utf-8');
        var allFunctions = DATA_IO_FUNCTIONS_APPGLOBALS.concat(CLASSIC_ONLY_NAMES);
        allFunctions.forEach(function (name) {
            const re = new RegExp('function\\s+' + name + '\\s*\\(');
            expect(
                re.test(uiContent),
                'ui-handlers.js enthält noch "function ' + name + '(...)" — Block ist nicht vollständig extrahiert'
            ).toBe(false);
        });
        DATA_IO_CONSTANTS.forEach(function (name) {
            const re = new RegExp('var\\s+' + name + '\\s*=');
            expect(
                re.test(uiContent),
                'ui-handlers.js enthält noch "var ' + name + ' = …" — Konstante gehört nach data-io-handlers.js'
            ).toBe(false);
        });
        // AppGlobals-Registrierung der Daten-I/O-Namen ist nicht mehr in
        // ui-handlers.js — sie kommt jetzt aus data-io-handlers.js.
        var registered = DATA_IO_CONSTANTS.concat(DATA_IO_FUNCTIONS_APPGLOBALS);
        registered.forEach(function (name) {
            const re = new RegExp('^\\s*' + name + '\\s*:\\s*' + name + '\\s*,?\\s*$', 'm');
            expect(
                re.test(uiContent),
                'ui-handlers.js registriert "' + name + ': ' + name + '" noch selbst — Registrierung gehört nach data-io-handlers.js'
            ).toBe(false);
        });
    });
});
