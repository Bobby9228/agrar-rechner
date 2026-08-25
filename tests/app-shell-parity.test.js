import { createDom, MODULE_LOAD_ORDER } from './helpers.js';
import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * App-Shell-Parität (Handler/Renderer/Coordinator-Brücken)
 * Zusammengeführt in Issue #419 (Welle 4) aus:
 * 89-culture-handlers-app-shell.test.js, 90-tab-handlers-app-shell.test.js, 91-settings-handlers-app-shell.test.js, 92-reset-handlers-app-shell.test.js, 93-drill-handlers-app-shell.test.js, 94-input-handlers-app-shell.test.js, 95-protocol-handlers-app-shell.test.js, 96-data-io-handlers-app-shell.test.js, 97-state-coordinator-app-shell.test.js, 98-state-coordinator-behavior.test.js
 * Jede Quelldatei ist als eigener describe-Block vollständig
 * erhalten (nur Import-Zeilen dedupliziert) — keine Assertions
 * wurden verändert oder entfernt.
 */

describe('App-Shell-Parität (Handler/Renderer/Coordinator-Brücken) — übernommen aus 89-culture-handlers-app-shell.test.js', () => {
/**
 * Issue #416 (Welle 1) — App-Shell-Vertrag für das neue Modul
 * `public/js/culture-handlers.js` (Extrahiert aus ui-handlers.js).
 *
 * Der Vertrag ist so eng wie möglich gefasst, damit eine spätere
 * Extraktion (Welle 2/3) keine ungeplanten Seiteneffekte hat:
 *
 *   1. Die Datei `public/js/culture-handlers.js` MUSS existieren —
 *      ohne sie ist die Extraktion nicht abgeschlossen.
 *   2. `index.html` lädt `culture-handlers.js` NACH `culture.js` UND
 *      `calculations.js` (die Kultur-Profile/Helper werden gebraucht)
 *      und VOR `ui-handlers.js`. Abhängigkeiten aus `ui-handlers.js`, etwa
 *      `syncEinheitGroesseEditorFromTab`, werden erst beim späteren Aufruf
 *      über `AppGlobals` aufgelöst. Eine andere Reihenfolge kann fehlende
 *      Voraussetzungen oder eine unvollständige öffentliche API erzeugen.
 *   3. `sw.js` STATIC_ASSETS MUSS `/js/culture-handlers.js` enthalten.
 *      Sonst liefert die network-first-Strategie das frisch
 *      ausgelieferte HTML aus, der Offline-Cache der App-Shell
 *      bleibt aber unvollständig → nächster Offline-Restart bricht.
 *   4. Die Network-First-Strategie und der übrige Service-Worker
 *      bleiben unangetastet (per Stichprobe — skipWaiting/claim/fetch
 *      dürfen nicht versehentlich refaktored werden).
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');
const cultureHandlersPath = resolve(publicDir, 'js', 'culture-handlers.js');

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

describe('Issue #416 Welle 1 — culture-handlers.js App-Shell-Vertrag', () => {
  it('public/js/culture-handlers.js existiert als eigenständiges Modul', () => {
    expect(
      existsSync(cultureHandlersPath),
      'Erwartet public/js/culture-handlers.js — die Extraktion aus ui-handlers.js ist sonst nicht abgeschlossen'
    ).toBe(true);
  });

  it('index.html lädt culture-handlers.js NACH culture.js und calculations.js, VOR ui-handlers.js', () => {
    const indexContent = readFileSync(resolve(publicDir, 'index.html'), 'utf-8');
    const loaded = readScripts(indexContent);
    const cultureIdx = loaded.indexOf('culture.js');
    const calcIdx = loaded.indexOf('calculations.js');
    const handlersIdx = loaded.indexOf('culture-handlers.js');
    const uiHandlersIdx = loaded.indexOf('ui-handlers.js');

    expect(cultureIdx, 'culture.js fehlt als Voraussetzung').toBeGreaterThanOrEqual(0);
    expect(calcIdx, 'calculations.js fehlt als Voraussetzung').toBeGreaterThanOrEqual(0);
    expect(uiHandlersIdx, 'ui-handlers.js fehlt in der App-Shell').toBeGreaterThanOrEqual(0);

    // Reihenfolge: culture.js < calculations.js < culture-handlers.js < ui-handlers.js
    expect(
      cultureIdx,
      'culture.js muss vor culture-handlers.js geladen werden'
    ).toBeLessThan(handlersIdx);
    expect(
      calcIdx,
      'calculations.js muss vor culture-handlers.js geladen werden (Kultur-Profile/Helper)'
    ).toBeLessThan(handlersIdx);
    expect(
      handlersIdx,
      'culture-handlers.js muss vor ui-handlers.js geladen werden (syncEinheitGroesseEditorFromTab-Bridge)'
    ).toBeLessThan(uiHandlersIdx);
  });

  it('sw.js STATIC_ASSETS enthält /js/culture-handlers.js (Offline-Bootstrap)', () => {
    const swContent = readFileSync(resolve(publicDir, 'sw.js'), 'utf-8');
    const staticAssets = readStaticAssets(swContent);
    expect(
      staticAssets,
      'fehlt in STATIC_ASSETS: /js/culture-handlers.js — sonst bricht der erste Offline-Restart'
    ).toContain('/js/culture-handlers.js');
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
});

describe('App-Shell-Parität (Handler/Renderer/Coordinator-Brücken) — übernommen aus 90-tab-handlers-app-shell.test.js', () => {
/**
 * Issue #416 (Welle 2) — App-Shell-Vertrag für das neue Modul
 * `public/js/tab-handlers.js` (extrahiert aus ui-handlers.js).
 *
 * Scope dieser Welle: Tab-/Ansichtsverwaltung aus ui-handlers.js
 *   - addReiter, removeReiter, _closeDashboardIfOpen,
 *     switchReiter, switchToProtokoll, switchToRechner, renameReiter
 *
 * Der Vertrag ist so eng wie möglich gefasst, damit eine spätere
 * Extraktion (Welle 3) keine ungeplanten Seiteneffekte hat:
 *
 *   1. Die Datei `public/js/tab-handlers.js` MUSS existieren —
 *      ohne sie ist die Extraktion nicht abgeschlossen.
 *   2. `index.html` lädt `tab-handlers.js` NACH `ui-handlers.js` (die
 *      Tab-Handler referenzieren bisher lexikalische Abhängigkeiten
 *      aus ui-handlers.js — z. B. `syncStateFromInputs` — und werden
 *      deshalb über die AppGlobals-API aus ui-handlers.js aufgelöst)
 *      und VOR `render-tabs.js` (das die Tab-Handler-Funktionen als
 *      Subscriber-Hooks aufruft). Eine andere Reihenfolge kann fehlende
 *      Voraussetzungen oder eine unvollständige öffentliche API erzeugen.
 *   3. `sw.js` STATIC_ASSETS MUSS `/js/tab-handlers.js` enthalten.
 *      Sonst liefert die network-first-Strategie das frisch
 *      ausgelieferte HTML aus, der Offline-Cache der App-Shell
 *      bleibt aber unvollständig → nächster Offline-Restart bricht.
 *   4. Die Network-First-Strategie und der übrige Service-Worker
 *      bleiben unangetastet (per Stichprobe — skipWaiting/claim/fetch
 *      dürfen nicht versehentlich refaktored werden).
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');
const tabHandlersPath = resolve(publicDir, 'js', 'tab-handlers.js');

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

describe('Issue #416 Welle 2 — tab-handlers.js App-Shell-Vertrag', () => {
  it('public/js/tab-handlers.js existiert als eigenständiges Modul', () => {
    expect(
      existsSync(tabHandlersPath),
      'Erwartet public/js/tab-handlers.js — die Extraktion aus ui-handlers.js ist sonst nicht abgeschlossen'
    ).toBe(true);
  });

  it('index.html lädt tab-handlers.js NACH ui-handlers.js, VOR render-tabs.js', () => {
    const indexContent = readFileSync(resolve(publicDir, 'index.html'), 'utf-8');
    const loaded = readScripts(indexContent);
    const uiHandlersIdx = loaded.indexOf('ui-handlers.js');
    const tabHandlersIdx = loaded.indexOf('tab-handlers.js');
    const renderTabsIdx = loaded.indexOf('render-tabs.js');

    expect(uiHandlersIdx, 'ui-handlers.js fehlt in der App-Shell').toBeGreaterThanOrEqual(0);
    expect(renderTabsIdx, 'render-tabs.js fehlt in der App-Shell').toBeGreaterThanOrEqual(0);

    // Reihenfolge: ui-handlers.js < tab-handlers.js < render-tabs.js
    expect(
      uiHandlersIdx,
      'ui-handlers.js muss vor tab-handlers.js geladen werden (AppGlobals-Brücke: syncStateFromInputs u. a.)'
    ).toBeLessThan(tabHandlersIdx);
    expect(
      tabHandlersIdx,
      'tab-handlers.js muss vor render-tabs.js geladen werden (Subscriber ruft Tab-Handler auf)'
    ).toBeLessThan(renderTabsIdx);
  });

  it('sw.js STATIC_ASSETS enthält /js/tab-handlers.js (Offline-Bootstrap)', () => {
    const swContent = readFileSync(resolve(publicDir, 'sw.js'), 'utf-8');
    const staticAssets = readStaticAssets(swContent);
    expect(
      staticAssets,
      'fehlt in STATIC_ASSETS: /js/tab-handlers.js — sonst bricht der erste Offline-Restart'
    ).toContain('/js/tab-handlers.js');
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
});

describe('App-Shell-Parität (Handler/Renderer/Coordinator-Brücken) — übernommen aus 91-settings-handlers-app-shell.test.js', () => {
/**
 * Issue #416 (Welle 3) — App-Shell-Vertrag für das neue Modul
 * `public/js/settings-handlers.js` (extrahiert aus ui-handlers.js).
 *
 * Scope dieser Welle: Einstellungs-Handler aus ui-handlers.js
 *   - fahrgassenToggle, fahrgassenUpdate,
 *     einheitGroesseToggle, einheitGroesseUpdate,
 *     syncEinheitGroesseEditorFromTab
 *
 * DOM_IDS bleibt in ui-handlers.js, weil Reset (resetAll / resetActiveTab)
 * die IDs weiter nutzt. Die extrahierten Funktionen lesen ihre IDs direkt
 * aus dem DOM — keine DOM_IDS-Abhängigkeit.
 *
 * Der Vertrag ist so eng wie möglich gefasst, damit eine spätere
 * Extraktion (Welle 4+) keine ungeplanten Seiteneffekte hat:
 *
 *   1. Die Datei `public/js/settings-handlers.js` MUSS existieren —
 *      ohne sie ist die Extraktion nicht abgeschlossen.
 *   2. `index.html` lädt `settings-handlers.js` NACH `ui-handlers.js`
 *      (die Handler verwenden `getActiveReiter` aus ui-handlers.js und
 *      lösen alle Modulabhängigkeiten über die AppGlobals-API auf)
 *      und VOR `tab-handlers.js` (das `syncInputsFromState` aus
 *      ui-handlers.js aufruft, das wiederum via AppGlobals auf
 *      `syncEinheitGroesseEditorFromTab` zugreift — zu diesem Zeitpunkt
 *      muss settings-handlers.js bereits geladen sein). Eine andere
 *      Reihenfolge kann fehlende Voraussetzungen oder eine unvollständige
 *      öffentliche API erzeugen.
 *   3. `tests/helpers.js` MUSS `settings-handlers.js` laden, damit die
 *      bestehende Test-Suite gegen dieselbe Modul-Architektur läuft wie
 *      Production. Sonst wären `w.fahrgassenToggle()` und Co. in jsdom
 *      undefined, und alle Tests dieser Welle würden RED laufen — obwohl
 *      Production grün wäre.
 *   4. `sw.js` STATIC_ASSETS MUSS `/js/settings-handlers.js` enthalten.
 *      Sonst liefert die network-first-Strategie das frisch ausgelieferte
 *      HTML aus, der Offline-Cache der App-Shell bleibt aber
 *      unvollständig → nächster Offline-Restart bricht.
 *   5. Die Network-First-Strategie und der übrige Service-Worker
 *      bleiben unangetastet (per Stichprobe — skipWaiting/claim/fetch
 *      dürfen nicht versehentlich refaktored werden).
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');
const jsDir = resolve(publicDir, 'js');
const settingsHandlersPath = resolve(jsDir, 'settings-handlers.js');
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

describe('Issue #416 Welle 3 — settings-handlers.js App-Shell-Vertrag', () => {
  it('public/js/settings-handlers.js existiert als eigenständiges Modul', () => {
    expect(
      existsSync(settingsHandlersPath),
      'Erwartet public/js/settings-handlers.js — die Extraktion aus ui-handlers.js ist sonst nicht abgeschlossen'
    ).toBe(true);
  });

  it('index.html lädt settings-handlers.js NACH ui-handlers.js, VOR tab-handlers.js', () => {
    const indexContent = readFileSync(resolve(publicDir, 'index.html'), 'utf-8');
    const loaded = readScripts(indexContent);
    const uiHandlersIdx = loaded.indexOf('ui-handlers.js');
    const settingsIdx = loaded.indexOf('settings-handlers.js');
    const tabHandlersIdx = loaded.indexOf('tab-handlers.js');

    expect(uiHandlersIdx, 'ui-handlers.js fehlt in der App-Shell').toBeGreaterThanOrEqual(0);
    expect(tabHandlersIdx, 'tab-handlers.js fehlt in der App-Shell').toBeGreaterThanOrEqual(0);

    // Reihenfolge: ui-handlers.js < settings-handlers.js < tab-handlers.js
    expect(
      uiHandlersIdx,
      'ui-handlers.js muss vor settings-handlers.js geladen werden (AppGlobals-Brücke: parseDE/appEmit/state)'
    ).toBeLessThan(settingsIdx);
    expect(
      settingsIdx,
      'settings-handlers.js muss vor tab-handlers.js geladen werden (syncInputsFromState → AppGlobals.syncEinheitGroesseEditorFromTab)'
    ).toBeLessThan(tabHandlersIdx);
  });

  it('tests/helpers.js lädt settings-handlers.js (Test-Helper-Parität zur Production-App-Shell)', () => {
    expect(
      MODULE_LOAD_ORDER,
      'fehlt in tests/helpers.js (MODULE_LOAD_ORDER): settings-handlers.js — sonst sind w.fahrgassenToggle() etc. in jsdom undefined'
    ).toContain('settings-handlers.js');
  });

  it('sw.js STATIC_ASSETS enthält /js/settings-handlers.js (Offline-Bootstrap)', () => {
    const swContent = readFileSync(resolve(publicDir, 'sw.js'), 'utf-8');
    const staticAssets = readStaticAssets(swContent);
    expect(
      staticAssets,
      'fehlt in STATIC_ASSETS: /js/settings-handlers.js — sonst bricht der erste Offline-Restart'
    ).toContain('/js/settings-handlers.js');
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
});

describe('App-Shell-Parität (Handler/Renderer/Coordinator-Brücken) — übernommen aus 92-reset-handlers-app-shell.test.js', () => {
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
        expect(
            MODULE_LOAD_ORDER,
            'fehlt in tests/helpers.js (MODULE_LOAD_ORDER): reset-handlers.js — sonst sind w.resetAll() etc. in jsdom undefined'
        ).toContain('reset-handlers.js');
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
});

describe('App-Shell-Parität (Handler/Renderer/Coordinator-Brücken) — übernommen aus 93-drill-handlers-app-shell.test.js', () => {
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
 *   - Import/Export (buildExportEnvelope, exportData, …) — nutzt
 *     defensiv AppGlobals.syncStateFromInputs / syncInputsFromState.
 *
 * Bewusst ANDERNSWO extrahiert (spätere Wellen von Issue #416):
 *   - Input-Binding/-Formatierung und Wrapper leben seit Welle 6 in
 *     public/js/input-handlers.js.
 *   - Lokales Protokoll (setProtocolView, toggleProtocolAccordion,
 *     requestLocalProtocolDelete, closeLocalProtocolSheet,
 *     confirmLocalProtocolDelete) lebt seit Welle 7 in
 *     public/js/protocol-handlers.js.
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
        expect(
            MODULE_LOAD_ORDER,
            'fehlt in tests/helpers.js (MODULE_LOAD_ORDER): drill-handlers.js — sonst sind w.drillAdd() etc. in jsdom undefined'
        ).toContain('drill-handlers.js');
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
});

describe('App-Shell-Parität (Handler/Renderer/Coordinator-Brücken) — übernommen aus 94-input-handlers-app-shell.test.js', () => {
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
 *   - Tabs / Settings / Reset / Drill / Kultur
 *
 * Bewusst ANDERNSWO extrahiert (Issue #416 Welle 7):
 *   - Lokales Protokoll (setProtocolView, toggleProtocolAccordion,
 *     requestLocalProtocolDelete, closeLocalProtocolSheet,
 *     confirmLocalProtocolDelete) lebt in public/js/protocol-handlers.js
 *     und wird zwischen drill-handlers.js und tab-handlers.js geladen.
 *
 * Bewusst ANDERNSWO extrahiert (Issue #416 Welle 8):
 *   - Daten-Export/Import (Konstanten EXPORT_APP_KEY, EXPORT_FORMAT_VERSION,
 *     EXPORT_MAX_BYTES sowie buildExportEnvelope, exportData,
 *     validateImportText, …) lebt in public/js/data-io-handlers.js
 *     und wird zwischen render-local-protocol.js und main.js geladen.
 *     Es nutzt defensiv AppGlobals.syncStateFromInputs und
 *     AppGlobals.syncInputsFromState (beim Funktionsaufruf, nicht beim
 *     Modul-Load).
 *
 * Der Vertrag ist so eng wie möglich gefasst, damit die Extraktion
 * keine ungeplanten Seiteneffekte hat:
 *
 *   1. Die Datei `public/js/input-handlers.js` MUSS existieren —
 *      ohne sie ist die Extraktion nicht abgeschlossen.
 *   2. `index.html` lädt `input-handlers.js` NACH `ui-handlers.js`
 *      (Architektur-Index-Reihenfolge — keine lexikalische Abhängigkeit
 *      mehr in ui-handlers.js selbst, seit Welle 8 der Daten-Export/
 *      Import-Block nach data-io-handlers.js umgezogen ist)
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
        expect(
            MODULE_LOAD_ORDER,
            'fehlt in tests/helpers.js (MODULE_LOAD_ORDER): input-handlers.js — sonst sind w.onInputHektar() etc. in jsdom undefined'
        ).toContain('input-handlers.js');
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
});

describe('App-Shell-Parität (Handler/Renderer/Coordinator-Brücken) — übernommen aus 95-protocol-handlers-app-shell.test.js', () => {
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
 *   - Kultur / Tabs / Settings / Reset / Drill / Input / Berechnung / Render
 *
 * Bewusst ANDERNSWO extrahiert (Issue #416 Welle 8):
 *   - Daten-Export/Import (Konstanten EXPORT_APP_KEY, EXPORT_FORMAT_VERSION,
 *     EXPORT_MAX_BYTES sowie buildExportEnvelope, exportData,
 *     validateImportText, …) lebt in public/js/data-io-handlers.js
 *     und wird zwischen render-local-protocol.js und main.js geladen.
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
        expect(
            MODULE_LOAD_ORDER,
            'fehlt in tests/helpers.js (MODULE_LOAD_ORDER): protocol-handlers.js — sonst sind w.setProtocolView() etc. in jsdom undefined'
        ).toContain('protocol-handlers.js');
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
});

describe('App-Shell-Parität (Handler/Renderer/Coordinator-Brücken) — übernommen aus 96-data-io-handlers-app-shell.test.js', () => {
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
        expect(
            MODULE_LOAD_ORDER,
            'fehlt in tests/helpers.js (MODULE_LOAD_ORDER): data-io-handlers.js — sonst sind w.exportData(), w.validateImportText() etc. in jsdom undefined'
        ).toContain('data-io-handlers.js');
    });

    it('sw.js STATIC_ASSETS enthält /js/data-io-handlers.js (Offline-Bootstrap)', () => {
        const swContent = readFileSync(resolve(publicDir, 'sw.js'), 'utf-8');
        const staticAssets = readStaticAssets(swContent);
        expect(
            staticAssets,
            'fehlt in STATIC_ASSETS: /js/data-io-handlers.js — sonst bricht der erste Offline-Restart'
        ).toContain('/js/data-io-handlers.js');
    });

    it('sw.js Network-First-Strategie, CACHE_VERSION-Format und Query-Version-Konsistenz bleiben unangetastet', () => {
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

        // Issue #444 Welle 2: CACHE_VERSION-Format-Vertrag + Untergrenze.
        // Vorher: harter Pin 'agrar-rechner-v54'. Jetzt: Format + ≥ v53.
        // Damit bricht der Test nicht mehr bei jeder kleinen Bump-Aktion,
        // aber ein versehentliches Zurück-Drehen wird weiterhin erkannt.
        // Bump-Historie (zur Doku):
        //   v52 = Issue #417 (state-coordinator.js hinzugefügt)
        //   v53 = Issue #443 (Font-Deduplizierung: 12 WOFF2 → 4 Variable Fonts)
        //   v54 = Issue #446 Welle 1 (dialog-a11y.js ins Precache aufgenommen)
        const cacheMatch = swContent.match(/const\s+CACHE_VERSION\s*=\s*['"]([^'"]+)['"]/);
        expect(cacheMatch, 'CACHE_VERSION-Konstante muss in sw.js vorhanden sein').not.toBeNull();
        const cacheVersionStr = cacheMatch[1];
        const CACHE_VERSION_RE = /^agrar-rechner-v(\d+)$/;
        const cacheVersionParts = CACHE_VERSION_RE.exec(cacheVersionStr);
        expect(
            cacheVersionParts,
            'CACHE_VERSION muss dem Format agrar-rechner-vN entsprechen (war: ' +
                cacheVersionStr + ')'
        ).not.toBeNull();
        const MIN_CACHE_VERSION = 53;
        expect(
            parseInt(cacheVersionParts[1], 10),
            'CACHE_VERSION ' + cacheVersionStr + ' liegt unter der Untergrenze v' +
                MIN_CACHE_VERSION + ' — würde Offline-Clients einen älteren Cache aufzwingen.'
        ).toBeGreaterThanOrEqual(MIN_CACHE_VERSION);

        // Issue #444 Welle 2: Query-Versionen zwischen index.html und sw.js
        // STATIC_ASSETS sind KONSISTENT (gleiche ?v= für dieselbe Datei).
        // Vorher: fünf harte Literal-Pins, die bei jeder CSS/JS-Änderung
        // gebrochen haben. Jetzt: pro Datei wird geprüft, dass die ?v=
        // Werte in beiden Quellen identisch sind. Damit folgt die Query-
        // Version der tatsächlichen App-Shell — nicht dem Test.
        //
        // Erfasst werden alle <script src> und <link rel="stylesheet"
        // href>-Eintraege aus public/index.html (die jsdom-Pfade '/js/…'
        // und '/css/…' verwenden, nicht 'js/…' wie oben).
        const indexContent = readFileSync(resolve(publicDir, 'index.html'), 'utf-8');
        // Helper: liest aus index.html alle <script src="…"> und
        // <link rel="stylesheet" href="…">-Eintraege, jeweils inkl. ?v=.
        function readIndexAssets(content) {
            var out = [];
            var scriptRe = /<script\s+src=["']([^"']+)["']\s*><\/script>/g;
            var m;
            while ((m = scriptRe.exec(content)) !== null) out.push(m[1]);
            var cssRe = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/g;
            while ((m = cssRe.exec(content)) !== null) out.push(m[1]);
            return out;
        }
        // Parse "path?v=N" → { base, version }
        function splitAsset(s) {
            var qIdx = s.indexOf('?');
            if (qIdx < 0) return { base: s, version: null };
            return {
                base: s.substring(0, qIdx),
                version: s.substring(qIdx + 1) // z. B. "v=21"
            };
        }
        const indexAssets = readIndexAssets(indexContent);
        // index.html referenziert Scripts/Stylesheets als relative Pfade
        // (z. B. "js/calculations.js?v=21"), sw.js STATIC_ASSETS mit
        // führendem "/" (z. B. "/js/calculations.js?v=21"). Wir
        // normalisieren auf den führenden "/" und vergleichen dann.
        const versionedAssets = indexAssets
            .map(function (s) {
                const parts = splitAsset(s);
                return {
                    base: parts.base.charAt(0) === '/' ? parts.base : '/' + parts.base,
                    version: parts.version
                };
            })
            .filter(function (a) { return /^\/(js|css)\//.test(a.base) && a.version; });
        expect(
            versionedAssets.length,
            'Test-Voraussetzung: mindestens ein versionierter Asset-Eintrag in index.html'
        ).toBeGreaterThan(0);
        // Für jede versionierte Datei: gleiche ?v= in STATIC_ASSETS (oder
        // ein Eintrag mit identischem base, egal welche ?v=).
        const staticAssets = readStaticAssets(swContent);
        for (var i = 0; i < versionedAssets.length; i++) {
            const va = versionedAssets[i];
            // Suche in STATIC_ASSETS den Eintrag mit demselben base.
            const matchingStatic = staticAssets.find(function (sa) {
                return splitAsset(sa).base === va.base;
            });
            expect(
                matchingStatic,
                'sw.js STATIC_ASSETS enthaelt kein Aequivalent zu ' + va.base +
                    ' aus index.html — bestehende Kongruenz-Tests (deploy-sanity) ' +
                    'wuerden bereits rot sein.'
            ).toBeTruthy();
            const staticVersion = splitAsset(matchingStatic).version;
            expect(
                staticVersion,
                'sw.js STATIC_ASSETS-Eintrag fuer ' + va.base +
                    ' hat KEINE ?v=-Versionierung — wuerde von einer ' +
                    'index.html-Aenderung mit neuem ?v= stillschweigend ' +
                    'divergieren. Konsistenz verlangt denselben Mechanismus.'
            ).toBe(va.version);
        }
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
});

describe('App-Shell-Parität (Handler/Renderer/Coordinator-Brücken) — übernommen aus 97-state-coordinator-app-shell.test.js', () => {
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
        expect(
            MODULE_LOAD_ORDER,
            'fehlt in tests/helpers.js (MODULE_LOAD_ORDER): state-coordinator.js — sonst ist AppGlobals.appDispatch in jsdom undefined'
        ).toContain('state-coordinator.js');
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
        // Issue #447 Welle 1: tote Cases ENTRY_ADDED, ENTRY_REMOVED,
        // CALCULATION_DONE wurden aus EVENT_PLAN entfernt — sie wurden
        // nie per appEmit emittiert. Plan beschreibt jetzt nur real
        // ausgelöste Events.
        var expected = [
            'TAB_CHANGED', 'TAB_ADDED', 'TAB_REMOVED', 'TAB_RENAMED',
            'TAB_RESET', 'ENTRY_CHANGED',
            'SETTINGS_CHANGED', 'VIEW_CHANGED',
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
});

describe('App-Shell-Parität (Handler/Renderer/Coordinator-Brücken) — übernommen aus 98-state-coordinator-behavior.test.js', () => {
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
 * Cross-Tab-Sync (storage-Event) wird in tests/cross-tab-sync.test.js
 * separat abgesichert und ist hier kein Thema — diese Suite testet nur den
 * in-page Datenfluss.
 */

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
});
