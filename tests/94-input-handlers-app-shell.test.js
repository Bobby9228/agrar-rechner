/**
 * Issue #416 (Welle 6) — App-Shell-Vertrag für das neue Modul
 * `public/js/input-handlers.js` (extrahiert aus ui-handlers.js).
 *
 * Scope dieser Welle: zusammenhängender Eingabe-/Formatierungs-/
 * State-Synchronisierungsblock aus ui-handlers.js
 *   - onInputHektar, onInputIstHektar, onInputKoerner, onInputDuenger
 *   - onInputNotizen
 *   - getKornerGesamt, getActiveTotalEinheiten, getActiveTotalDuenger
 *   - getTotalEinheiten, getTotalDuenger
 *   - onInputFormat
 *   - getActiveReiter
 *   - syncStateFromInputs, toInputValue, syncInputsFromState
 *
 * Bewusst NICHT extrahiert (bleiben in ui-handlers.js):
 *   - Import/Export-Block (buildExportEnvelope, exportData,
 *     validateImportText, …) — nutzt defensiv
 *     AppGlobals.syncStateFromInputs / syncInputsFromState.
 *   - Tabs / Settings / Reset / Drill / Kultur
 *
 * Bewusst ANDERNSWO extrahiert (Issue #416 Welle 7):
 *   - Lokales Protokoll (setProtocolView, toggleProtocolAccordion,
 *     requestLocalProtocolDelete, closeLocalProtocolSheet,
 *     confirmLocalProtocolDelete) lebt in public/js/protocol-handlers.js
 *     und wird zwischen drill-handlers.js und tab-handlers.js geladen.
 *
 * Der Vertrag ist so eng wie möglich gefasst, damit die Extraktion
 * keine ungeplanten Seiteneffekte hat:
 *
 *   1. Die Datei `public/js/input-handlers.js` MUSS existieren —
 *      ohne sie ist die Extraktion nicht abgeschlossen.
 *   2. `index.html` lädt `input-handlers.js` NACH `ui-handlers.js`
 *      (ui-handlers.js behält Import/Export, das defensiv auf
 *      AppGlobals.syncStateFromInputs / syncInputsFromState zugreift —
 *      diese müssen VOR dem ersten Aufruf bereits geladen sein)
 *      und VOR `settings-handlers.js` (das via AppGlobals.getActiveReiter
 *      in fahrgassen-/einheitGroesse-Handlern auf einen Reiter zugreift
 *      und via AppGlobals.syncEinheitGroesseEditorFromTab selbst aus
 *      syncInputsFromState heraus aufgerufen wird — die Brücke
 *      getActiveReiter steht in input-handlers.js und muss vor settings-
 *      handlers.js bereitstehen). Eine andere Reihenfolge kann fehlende
 *      Voraussetzungen oder eine unvollständige öffentliche API erzeugen.
 *   3. `tests/helpers.js` MUSS `input-handlers.js` laden, damit die
 *      bestehende Test-Suite gegen dieselbe Modul-Architektur läuft wie
 *      Production. Sonst wären `w.onInputHektar()`, `w.syncStateFromInputs()`
 *      und Co. in jsdom undefined und alle Input-Tests dieser Welle würden
 *      RED laufen — obwohl Production grün wäre.
 *   4. `sw.js` STATIC_ASSETS MUSS `/js/input-handlers.js` enthalten.
 *      Sonst liefert die network-first-Strategie das frisch
 *      ausgelieferte HTML aus, der Offline-Cache der App-Shell
 *      bleibt aber unvollständig → nächster Offline-Restart bricht.
 *   5. Die Network-First-Strategie und der übrige Service-Worker
 *      bleiben unangetastet (per Stichprobe — skipWaiting/claim/fetch
 *      dürfen nicht versehentlich refaktored werden).
 *
 * Die Reihenfolge in der App-Shell (Production + Test-Helper):
 *   ... → ui-handlers.js → input-handlers.js → settings-handlers.js
 *     → reset-handlers.js → drill-handlers.js → protocol-handlers.js
 *     → tab-handlers.js → ...
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');
const jsDir = resolve(publicDir, 'js');
const inputHandlersPath = resolve(jsDir, 'input-handlers.js');
const helpersPath = resolve(__dirname, 'helpers.js');

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

describe('Issue #416 Welle 6 — input-handlers.js App-Shell-Vertrag', () => {
    it('public/js/input-handlers.js existiert als eigenständiges Modul', () => {
        expect(
            existsSync(inputHandlersPath),
            'Erwartet public/js/input-handlers.js — die Extraktion aus ui-handlers.js ist sonst nicht abgeschlossen'
        ).toBe(true);
    });

    it('index.html lädt input-handlers.js NACH ui-handlers.js, VOR settings-handlers.js', () => {
        const indexContent = readFileSync(resolve(publicDir, 'index.html'), 'utf-8');
        const loaded = readScripts(indexContent);
        const uiHandlersIdx = loaded.indexOf('ui-handlers.js');
        const inputIdx = loaded.indexOf('input-handlers.js');
        const settingsIdx = loaded.indexOf('settings-handlers.js');

        expect(uiHandlersIdx, 'ui-handlers.js fehlt in der App-Shell').toBeGreaterThanOrEqual(0);
        expect(settingsIdx, 'settings-handlers.js fehlt in der App-Shell').toBeGreaterThanOrEqual(0);

        // Reihenfolge: ui-handlers.js < input-handlers.js < settings-handlers.js
        expect(
            uiHandlersIdx,
            'ui-handlers.js muss vor input-handlers.js geladen werden (AppGlobals-Brücke: syncStateFromInputs/syncInputsFromState)'
        ).toBeLessThan(inputIdx);
        expect(
            inputIdx,
            'input-handlers.js muss vor settings-handlers.js geladen werden (AppGlobals.getActiveReiter + syncEinheitGroesseEditorFromTab-Bridge aus syncInputsFromState)'
        ).toBeLessThan(settingsIdx);
    });

    it('tests/helpers.js lädt input-handlers.js (Test-Helper-Parität zur Production-App-Shell)', () => {
        const helpersContent = readFileSync(helpersPath, 'utf-8');
        expect(
            helpersContent,
            'fehlt in tests/helpers.js: loadModule("input-handlers.js") — sonst sind w.onInputHektar() etc. in jsdom undefined'
        ).toMatch(/loadModule\(\s*['"]input-handlers\.js['"]\s*\)/);
    });

    it('sw.js STATIC_ASSETS enthält /js/input-handlers.js (Offline-Bootstrap)', () => {
        const swContent = readFileSync(resolve(publicDir, 'sw.js'), 'utf-8');
        const staticAssets = readStaticAssets(swContent);
        expect(
            staticAssets,
            'fehlt in STATIC_ASSETS: /js/input-handlers.js — sonst bricht der erste Offline-Restart'
        ).toContain('/js/input-handlers.js');
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
});
