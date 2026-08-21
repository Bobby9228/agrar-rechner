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
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

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
    const helpersContent = readFileSync(helpersPath, 'utf-8');
    expect(
      helpersContent,
      'fehlt in tests/helpers.js: loadModule("settings-handlers.js") — sonst sind w.fahrgassenToggle() etc. in jsdom undefined'
    ).toMatch(/loadModule\(\s*['"]settings-handlers\.js['"]\s*\)/);
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