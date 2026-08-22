/**
 * Issue #416 (Welle 4) — App-Shell-Vertrag für das neue Modul
 * `public/js/reset-handlers.js` (extrahiert aus ui-handlers.js).
 *
 * Scope dieser Welle: Reset-Verantwortung aus ui-handlers.js
 *   - DOM_IDS, _resetInput (Hilfs-Konstante + Helper)
 *   - resetActiveTab, resetAll
 *   - _countAllEntries, _populateResetContext
 *   - openResetModal, closeResetModal
 *   - _onOverlayClick, _onResetTab, _onResetAll, _onCancel
 *
 * DOM_IDS und _resetInput werden außerhalb des Reset-Bereichs nicht mehr
 * verwendet und wandern deshalb mit. Sie bleiben über AppGlobals für
 * bestehende Tests/Konsumenten erreichbar (API-Kompatibilität).
 *
 * Der Vertrag ist so eng wie möglich gefasst, damit eine spätere
 * Extraktion (Welle 5+) keine ungeplanten Seiteneffekte hat:
 *
 *   1. Die Datei `public/js/reset-handlers.js` MUSS existieren —
 *      ohne sie ist die Extraktion nicht abgeschlossen.
 *   2. `index.html` lädt `reset-handlers.js` NACH `settings-handlers.js`
 *      (settings-handlers.js ist die letzte Welle, die Lexik in
 *      ui-handlers.js konsumiert hat) und VOR `tab-handlers.js`
 *      (konsistentes Wellen-Bild: settings/reset/tab in dieser Reihenfolge).
 *      Eine andere Reihenfolge kann fehlende Voraussetzungen oder eine
 *      unvollständige öffentliche API erzeugen.
 *   3. `tests/helpers.js` MUSS `reset-handlers.js` laden, damit die
 *      bestehende Test-Suite gegen dieselbe Modul-Architektur läuft wie
 *      Production. Sonst wären `w.resetAll()` und Co. in jsdom undefined
 *      und alle Reset-Tests dieser Welle würden RED laufen — obwohl
 *      Production grün wäre.
 *   4. `sw.js` STATIC_ASSETS MUSS `/js/reset-handlers.js` enthalten.
 *      Sonst liefert die network-first-Strategie das frisch ausgelieferte
 *      HTML aus, der Offline-Cache der App-Shell bleibt aber
 *      unvollständig → nächster Offline-Restart bricht.
 *   5. Die Network-First-Strategie und der übrige Service-Worker
 *      bleiben unangetastet (per Stichprobe — skipWaiting/claim/fetch
 *      dürfen nicht versehentlich refaktored werden).
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');
const jsDir = resolve(publicDir, 'js');
const resetHandlersPath = resolve(jsDir, 'reset-handlers.js');
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

describe('Issue #416 Welle 4 — reset-handlers.js App-Shell-Vertrag', () => {
    it('public/js/reset-handlers.js existiert als eigenständiges Modul', () => {
        expect(
            existsSync(resetHandlersPath),
            'Erwartet public/js/reset-handlers.js — die Extraktion aus ui-handlers.js ist sonst nicht abgeschlossen'
        ).toBe(true);
    });

    it('index.html lädt reset-handlers.js NACH settings-handlers.js, VOR tab-handlers.js', () => {
        const indexContent = readFileSync(resolve(publicDir, 'index.html'), 'utf-8');
        const loaded = readScripts(indexContent);
        const settingsIdx = loaded.indexOf('settings-handlers.js');
        const resetIdx = loaded.indexOf('reset-handlers.js');
        const tabHandlersIdx = loaded.indexOf('tab-handlers.js');

        expect(settingsIdx, 'settings-handlers.js fehlt in der App-Shell').toBeGreaterThanOrEqual(0);
        expect(tabHandlersIdx, 'tab-handlers.js fehlt in der App-Shell').toBeGreaterThanOrEqual(0);

        // Reihenfolge: settings-handlers.js < reset-handlers.js < tab-handlers.js
        expect(
            settingsIdx,
            'settings-handlers.js muss vor reset-handlers.js geladen werden (Wellen-Reihenfolge #416)'
        ).toBeLessThan(resetIdx);
        expect(
            resetIdx,
            'reset-handlers.js muss vor tab-handlers.js geladen werden (Wellen-Reihenfolge #416)'
        ).toBeLessThan(tabHandlersIdx);
    });

    it('tests/helpers.js lädt reset-handlers.js (Test-Helper-Parität zur Production-App-Shell)', () => {
        const helpersContent = readFileSync(helpersPath, 'utf-8');
        expect(
            helpersContent,
            'fehlt in tests/helpers.js: loadModule("reset-handlers.js") — sonst sind w.resetAll() etc. in jsdom undefined'
        ).toMatch(/loadModule\(\s*['"]reset-handlers\.js['"]\s*\)/);
    });

    it('sw.js STATIC_ASSETS enthält /js/reset-handlers.js (Offline-Bootstrap)', () => {
        const swContent = readFileSync(resolve(publicDir, 'sw.js'), 'utf-8');
        const staticAssets = readStaticAssets(swContent);
        expect(
            staticAssets,
            'fehlt in STATIC_ASSETS: /js/reset-handlers.js — sonst bricht der erste Offline-Restart'
        ).toContain('/js/reset-handlers.js');
    });

    it('sw.js Network-First-Strategie und sonstige SW-Logik bleiben unangetastet', () => {
        // Stichprobe: die drei kanonischen Worker-Bestandteile müssen weiter
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