/**
 * Issue #416 (Welle 5) — App-Shell-Vertrag für das neue Modul
 * `public/js/drill-handlers.js` (extrahiert aus ui-handlers.js).
 *
 * Scope dieser Welle: zusammenhängender Drill-Einfüll-/Verteilungs-/
 * Maschinen-Log-Block aus ui-handlers.js
 *   - _parseDrillInputs, _resolvePerTabDistribution
 *   - _buildDrillEntry, _pushEntryToTab, _buildMachineLogEntry
 *   - _readActivePerTabValues, _clearDrillInputs
 *   - drillAdd, drillRemove
 *   - _calcDrillDistribution, _applyDrillPlan
 *   - drillCalcAll, _syncActiveTabLock, drillCalcDebounced
 *   - drillMachineRemove
 *
 * Bewusst NICHT extrahiert (bleiben in ui-handlers.js):
 *   - Lokales Protokoll (setProtocolView, toggleProtocolAccordion,
 *     requestLocalProtocolDelete, closeLocalProtocolSheet,
 *     confirmLocalProtocolDelete) — die Brücke AppGlobals.drillRemove /
 *     AppGlobals.drillMachineRemove wird defensiv über AppGlobals aufgelöst.
 *   - Input-Binding/-Formatierung (onInputHektar, onInputFormat, …)
 *   - Wrapper (getKornerGesamt, getActiveTotalEinheiten, …)
 *   - Import/Export, Tabs, Settings, Kultur, Reset
 *
 * Der Vertrag ist so eng wie möglich gefasst, damit eine spätere
 * Extraktion keine ungeplanten Seiteneffekte hat:
 *
 *   1. Die Datei `public/js/drill-handlers.js` MUSS existieren —
 *      ohne sie ist die Extraktion nicht abgeschlossen.
 *   2. `index.html` lädt `drill-handlers.js` NACH `reset-handlers.js`
 *      (reset-handlers.js ist die letzte Welle, die lexikalische
 *      Konsumenten im ui-handlers.js-Scope hatte) und VOR
 *      `tab-handlers.js` (dessen spätere Wechsel-Handler rufen
 *      AppGlobals._syncActiveTabLock aus drill-handlers.js auf). Eine andere
 *      Reihenfolge kann fehlende Voraussetzungen oder eine unvollständige
 *      öffentliche API erzeugen.
 *   3. `tests/helpers.js` MUSS `drill-handlers.js` laden, damit die
 *      bestehende Test-Suite gegen dieselbe Modul-Architektur läuft wie
 *      Production. Sonst wären `w.drillAdd()`, `w.drillCalcAll()` und
 *      Co. in jsdom undefined und alle Drill-Tests dieser Welle würden
 *      RED laufen — obwohl Production grün wäre.
 *   4. `sw.js` STATIC_ASSETS MUSS `/js/drill-handlers.js` enthalten.
 *      Sonst liefert die network-first-Strategie das frisch
 *      ausgelieferte HTML aus, der Offline-Cache der App-Shell
 *      bleibt aber unvollständig → nächster Offline-Restart bricht.
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
const drillHandlersPath = resolve(jsDir, 'drill-handlers.js');
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

describe('Issue #416 Welle 5 — drill-handlers.js App-Shell-Vertrag', () => {
    it('public/js/drill-handlers.js existiert als eigenständiges Modul', () => {
        expect(
            existsSync(drillHandlersPath),
            'Erwartet public/js/drill-handlers.js — die Extraktion aus ui-handlers.js ist sonst nicht abgeschlossen'
        ).toBe(true);
    });

    it('index.html lädt drill-handlers.js NACH reset-handlers.js, VOR tab-handlers.js', () => {
        const indexContent = readFileSync(resolve(publicDir, 'index.html'), 'utf-8');
        const loaded = readScripts(indexContent);
        const resetIdx = loaded.indexOf('reset-handlers.js');
        const drillIdx = loaded.indexOf('drill-handlers.js');
        const tabHandlersIdx = loaded.indexOf('tab-handlers.js');

        expect(resetIdx, 'reset-handlers.js fehlt in der App-Shell').toBeGreaterThanOrEqual(0);
        expect(tabHandlersIdx, 'tab-handlers.js fehlt in der App-Shell').toBeGreaterThanOrEqual(0);

        // Reihenfolge: reset-handlers.js < drill-handlers.js < tab-handlers.js
        expect(
            resetIdx,
            'reset-handlers.js muss vor drill-handlers.js geladen werden (Wellen-Reihenfolge #416)'
        ).toBeLessThan(drillIdx);
        expect(
            drillIdx,
            'drill-handlers.js muss vor tab-handlers.js geladen werden (AppGlobals._syncActiveTabLock-Brücke)'
        ).toBeLessThan(tabHandlersIdx);
    });

    it('tests/helpers.js lädt drill-handlers.js (Test-Helper-Parität zur Production-App-Shell)', () => {
        const helpersContent = readFileSync(helpersPath, 'utf-8');
        expect(
            helpersContent,
            'fehlt in tests/helpers.js: loadModule("drill-handlers.js") — sonst sind w.drillAdd() etc. in jsdom undefined'
        ).toMatch(/loadModule\(\s*['"]drill-handlers\.js['"]\s*\)/);
    });

    it('sw.js STATIC_ASSETS enthält /js/drill-handlers.js (Offline-Bootstrap)', () => {
        const swContent = readFileSync(resolve(publicDir, 'sw.js'), 'utf-8');
        const staticAssets = readStaticAssets(swContent);
        expect(
            staticAssets,
            'fehlt in STATIC_ASSETS: /js/drill-handlers.js — sonst bricht der erste Offline-Restart'
        ).toContain('/js/drill-handlers.js');
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
