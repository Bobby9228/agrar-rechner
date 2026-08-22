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
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

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
