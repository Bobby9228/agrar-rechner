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
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

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
