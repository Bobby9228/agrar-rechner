import { existsSync, readFileSync, readdirSync } from 'fs';
import { createHash } from 'crypto';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

/**
 * Cloudflare-Deploy-Sanity
 * Zusammengeführt in Issue #419 (Welle 4) aus:
 * 37-deploy-sanity.test.js
 * Jede Quelldatei ist als eigener describe-Block vollständig
 * erhalten (nur Import-Zeilen dedupliziert) — keine Assertions
 * wurden verändert oder entfernt.
 */

describe('Cloudflare-Deploy-Sanity — übernommen aus 37-deploy-sanity.test.js', () => {
const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');

// Issue #129: PWA sw.js ohne Cache-Control — Update-Pfade nicht abgesichert
// - sw.js muss skipWaiting() in install handler haben → neue Version sofort aktivieren
// - index.html muss reg.update() nach registration aufrufen → Browser prüft neue Version bei jedem Laden
describe('Cloudflare deploy sanity', () => {
  it('sw.js calls skipWaiting() to activate new version immediately', () => {
    const swPath = resolve(publicDir, 'sw.js');
    const content = readFileSync(swPath, 'utf-8');
    expect(content).toMatch(/self\.skipWaiting\s*\(\s*\)/);
  });

  it('main.js calls reg.update() after SW registration to check for updates', () => {
    // Seit Phase 5: SW-Registrierung lebt in js/main.js (Inline-Block entfernt).
    const mainPath = resolve(publicDir, 'js', 'main.js');
    const content = readFileSync(mainPath, 'utf-8');
    expect(content).toMatch(/reg\.update\s*\(\s*\)/);
  });

  it('_redirects does not exist (causes infinite loop on Workers Static Assets)', () => {
    // /* → /index.html erzeugt einen Infinite Loop weil /index.html selbst auf /* matched.
    // Workers Static Assets serviert index.html automatisch als Fallback.
    // Siehe: https://developers.cloudflare.com/workers/observability/errors/#validation-errors-10021
    const redirectPath = resolve(publicDir, '_redirects');
    expect(existsSync(redirectPath)).toBe(false);
  });

  it('_headers has no-cache for sw.js (ensures SW updates reach clients)', () => {
    const headersPath = resolve(publicDir, '_headers');
    const content = readFileSync(headersPath, 'utf-8');
    expect(content).toContain('/sw.js');
    expect(content).toMatch(/Cache-Control:\s*no-cache/);
  });

  it('_headers: jede Header-Zeile gehört zu einer Pfad-Zeile (Cloudflare-Parse-Schutz)', () => {
    // Regression zu Issue #436: In #418 Welle 6 wurde die "/*"-Pfad-Zeile
    // versehentlich gelöscht. Cloudflare parst _headers streng und bricht
    // den DEPLOY (nicht lint/test) mit "Expected a path before headers"
    // [code 100324] ab — CI war grün, das Deploy trotzdem kaputt. Dieser
    // Test spiegelt die Parse-Regel: Eine Zeile beginnt entweder mit
    // Kommentar (#), ist leer/Whitespace, ist eine Pfad-Zeile (kein
    // führender Whitespace, endet mit ":" oder nicht), ODER eine
    // Header-Zeile (führender Whitespace, "Name: value") — und jede
    // Header-Zeile muss nach mindestens einer Pfad-Zeile folgen.
    const content = readFileSync(resolve(publicDir, '_headers'), 'utf-8');
    const lines = content.split('\n');
    let currentPath = null;
    const errors = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNo = i + 1;
      if (line.trim() === '' || line.trim().startsWith('#')) continue;
      const isIndented = /^[ \t]/.test(line);
      if (isIndented) {
        // Header-Zeile: nur gültig, wenn eine Pfad-Zeile davor steht
        if (!currentPath) {
          errors.push('Zeile ' + lineNo + ': Header ohne vorherige Pfad-Zeile ("Expected a path before headers") — Zeile: ' + JSON.stringify(line));
        } else if (!/^[ \t]+[\w-]+\s*:\s*\S+/.test(line)) {
          errors.push('Zeile ' + lineNo + ': sieht weder nach Pfad noch nach "Name: Wert"-Header aus: ' + JSON.stringify(line));
        }
      } else {
        // Pfad-Zeile (keine Einrückung)
        currentPath = line.trim();
      }
    }
    expect(errors, '_headers Parse-Fehler:\n' + errors.join('\n')).toEqual([]);
    expect(currentPath, 'mindestens eine Pfad-Zeile muss existieren').not.toBeNull();
  });

  it('_headers: CSP script-src kommt ohne unsafe-inline aus (#418/#436)', () => {
    const content = readFileSync(resolve(publicDir, '_headers'), 'utf-8');
    const cspLine = content.split('\n').find((l) => l.includes('Content-Security-Policy'));
    expect(cspLine, 'Content-Security-Policy-Zeile muss existieren').toBeTruthy();
    // Directive-weise prüfen (CSP = "dir1; dir2; ..."), damit das erlaubte
    // style-src 'unsafe-inline' nicht die script-src-Prüfung verfälscht.
    const scriptSrc = cspLine.split(';').map((s) => s.trim()).find((s) => s.startsWith('script-src'));
    expect(scriptSrc, 'script-src-Directive muss existieren').toBeTruthy();
    expect(scriptSrc, "script-src muss 'self' erlauben").toContain("'self'");
    expect(scriptSrc, "script-src darf KEIN 'unsafe-inline' enthalten").not.toContain("'unsafe-inline'");
    // Pfad-Zeile muss direkt (nach Kommentaren/Leerzeilen) vor der CSP stehen
    const lines = content.split('\n');
    const cspIdx = lines.findIndex((l) => l.includes('Content-Security-Policy'));
    expect(lines[cspIdx - 1].trim(), 'CSP-Zeile braucht die "/*"-Pfad-Zeile direkt davor').toBe('/*');
  });

  it('main.js exposes the current minor release version and build date', () => {
    const mainPath = resolve(publicDir, 'js', 'main.js');
    const content = readFileSync(mainPath, 'utf-8');
    expect(content).toMatch(/APP_VERSION\s*=\s*['"]v1\.1\.6['"]/);
    expect(content).toMatch(/APP_BUILD_DATE\s*=\s*['"]August 2026['"]/);
  });

  it('sw.js CACHE_VERSION matches current version', () => {
    const swPath = resolve(publicDir, 'sw.js');
    const content = readFileSync(swPath, 'utf-8');
    // CACHE_VERSION muss vorhanden sein und darf nicht leer sein
    const match = content.match(/CACHE_VERSION\s*=\s*'([^']+)'/);
    expect(match).not.toBeNull();
    // v51 = Stand nach Issue #416 Welle 8 (data-io-handlers.js);
    // v52 = nach Issue #417 (state-coordinator.js hinzugefügt).
    // v53 = nach Issue #443 (Font-Deduplizierung: 12 WOFF2 → 4 Variable Fonts).
    expect(match[1]).toBe('agrar-rechner-v53');
  });

  // Issue #144: SW ohne Offline-Fallback + Registration ohne Error-Handling
  it('sw.js returns offline Response when both cache miss AND network fail', () => {
    const swPath = resolve(publicDir, 'sw.js');
    const content = readFileSync(swPath, 'utf-8');
    // Cache-First-Pfad muss bei Netzwerkfehler eine Response mit Status 503 und 'Offline' body liefern
    expect(content).toMatch(/new Response\s*\(\s*['"]Offline['"]/);
    expect(content).toMatch(/status:\s*503/);
  });

  it('main.js SW registration has .catch() for error handling', () => {
    // Seit Phase 5: SW-Registrierung lebt in js/main.js (Inline-Block entfernt).
    const mainPath = resolve(publicDir, 'js', 'main.js');
    const content = readFileSync(mainPath, 'utf-8');
    // navigator.serviceWorker.register muss .catch() mit console.warn haben
    expect(content).toMatch(/serviceWorker\.register\s*\(\s*['"]sw\.js['"]\s*\)\s*\.catch\s*\(/);
    expect(content).toMatch(/console\.warn\s*\(\s*['"]SW-Registrierung fehlgeschlagen:/);
  });

  // Issue #130: apple-touch-icon zeigt auf SVG statt 180×180 PNG
  it('icon-180.png exists in public directory', () => {
    const iconPath = resolve(publicDir, 'icon-180.png');
    expect(existsSync(iconPath)).toBe(true);
  });

  it('index.html apple-touch-icon href points to icon-180.png', () => {
    const indexPath = resolve(publicDir, 'index.html');
    const content = readFileSync(indexPath, 'utf-8');
    expect(content).toMatch(/<link\s+rel=["']apple-touch-icon["']\s+href=["']icon-180\.png["']/);
  });

  it('manifest.json contains 180x180 icon entry', () => {
    const manifestPath = resolve(publicDir, 'manifest.json');
    const content = readFileSync(manifestPath, 'utf-8');
    expect(content).toMatch(/"sizes"\s*:\s*"180x180"/);
    expect(content).toMatch(/"src"\s*:\s*"icon-180\.png"/);
  });

  // Issue #176: user-select: none prevents native selection context menu on tap/long-press
  it('styles.css applies user-select: none to prevent text selection on mobile', () => {
    // Seit Issue #208: CSS ist nach public/css/styles.css extrahiert.
    const cssPath = resolve(publicDir, 'css', 'styles.css');
    const content = readFileSync(cssPath, 'utf-8');
    // Global * selector must include -webkit-user-select: none and user-select: none
    expect(content).toMatch(/\*\s*\{[^}]*-webkit-user-select:\s*none/);
    expect(content).toMatch(/\*\s*\{[^}]*user-select:\s*none/);
  });

  it('styles.css re-enables user-select: auto on input and textarea', () => {
    // Seit Issue #208: CSS ist nach public/css/styles.css extrahiert.
    const cssPath = resolve(publicDir, 'css', 'styles.css');
    const content = readFileSync(cssPath, 'utf-8');
    // Inputs must re-enable user-select so users can edit values
    expect(content).toMatch(/input\s*,\s*textarea\s*\{[^}]*-webkit-user-select:\s*auto/);
    expect(content).toMatch(/input\s*,\s*textarea\s*\{[^}]*user-select:\s*auto/);
  });

  // Issue: culture.js muss vor calculations.js/ui-handlers.js geladen werden,
  // sonst ist AppGlobals.isValidCultureKey undefined und das Pflichtmodal
  // öffnet im echten Browser nicht (Runtime-Fehler).
  describe('JS-Bootstrap: alle Module + korrekte Reihenfolge', () => {
    const EXPECTED_ORDER = [
      'app-globals.js',
      'state.js',
      'culture.js',
      'calculations.js',
      'ui-handlers.js',
      'render-tabs.js',
      'render-results.js',
      'render-drill.js',
      'render-dashboard.js',
      'main.js',
    ];

    function readScripts(content) {
      const re = /<script\s+src=["']js\/([^"']+)["']\s*><\/script>/g;
      const out = [];
      let m;
      while ((m = re.exec(content)) !== null) out.push(m[1].split('?')[0]);
      return out;
    }

    it('index.html lädt alle benötigten JS-Module', () => {
      const indexPath = resolve(publicDir, 'index.html');
      const content = readFileSync(indexPath, 'utf-8');
      const loaded = readScripts(content);
      for (const mod of EXPECTED_ORDER) {
        expect(loaded, 'fehlt: ' + mod).toContain(mod);
      }
    });

    it('JS-Module werden in der richtigen Reihenfolge geladen', () => {
      const indexPath = resolve(publicDir, 'index.html');
      const content = readFileSync(indexPath, 'utf-8');
      const loaded = readScripts(content);
      // Index jedes erwarteten Moduls; Reihenfolge muss monoton wachsen
      const positions = EXPECTED_ORDER.map(function (m) { return loaded.indexOf(m); });
      for (var i = 1; i < positions.length; i++) {
        expect(positions[i], 'Reihenfolge: ' + EXPECTED_ORDER[i] + ' vor ' + EXPECTED_ORDER[i - 1])
          .toBeGreaterThan(positions[i - 1]);
      }
    });

    it('culture.js liegt GENAU zwischen state.js und calculations.js', () => {
      const indexPath = resolve(publicDir, 'index.html');
      const content = readFileSync(indexPath, 'utf-8');
      const loaded = readScripts(content);
      var stateIdx = loaded.indexOf('state.js');
      var cultureIdx = loaded.indexOf('culture.js');
      var calcIdx = loaded.indexOf('calculations.js');
      expect(stateIdx).toBeGreaterThanOrEqual(0);
      expect(cultureIdx).toBeGreaterThan(stateIdx);
      expect(calcIdx).toBeGreaterThan(cultureIdx);
    });

    it('public/js/culture.js existiert tatsächlich', () => {
      const culturePath = resolve(publicDir, 'js', 'culture.js');
      expect(existsSync(culturePath)).toBe(true);
    });

    it('Architektur-Kommentar in index.html erwähnt culture.js', () => {
      const indexPath = resolve(publicDir, 'index.html');
      const content = readFileSync(indexPath, 'utf-8');
      // Kommentar zwischen <script>...</script> und den script-Tags muss
      // culture.js in der Modul-Liste aufführen, damit der Lesefluss
      // für Maintainer konsistent bleibt.
      expect(content).toMatch(/culture\.js/);
    });
  });
});

// ─────────── Task 3 Folgefix: Precache-Kongruenz mit index.html ──────────────
//
// Vor 2be0499/86b285b enthielt STATIC_ASSETS veraltete Versionen und fehlende
// neue Skripte. Eine frische PWA-Installation bekam damit nicht alle
// aktuellen Produktions-Assets in den Offline-Cache. Diese Tests parsen
// beide Quellen (lokal!) und fordern exakte Kongruenz — die self-gehosteten
// WOFF2-Fonts unter public/fonts/ (Issue #421, vorher extern via Google)
// sind jetzt explizit Teil des Precache-Vertrags.

// Helpers (Modul-Scope, damit sie auch für die Review-Fix-Sektion unten
// sichtbar sind):
function readLocalAssets(indexContent) {
  var assets = new Set();
  var m;
  var scriptRe = /<script\s+src=["']([^"']+)["']\s*><\/script>/g;
  while ((m = scriptRe.exec(indexContent)) !== null) {
    assets.add('/' + m[1]);
  }
  var cssRe = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/g;
  while ((m = cssRe.exec(indexContent)) !== null) {
    assets.add('/' + m[1]);
  }
  var iconRe = /<link[^>]+rel=["']icon["'][^>]+href=["']([^"']+)["']/g;
  while ((m = iconRe.exec(indexContent)) !== null) {
    assets.add('/' + m[1]);
  }
  var appleRe = /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/g;
  while ((m = appleRe.exec(indexContent)) !== null) {
    assets.add('/' + m[1]);
  }
  var manifestRe = /<link[^>]+rel=["']manifest["'][^>]+href=["']([^"']+)["']/g;
  while ((m = manifestRe.exec(indexContent)) !== null) {
    assets.add('/' + m[1]);
  }
  return Array.from(assets);
}

function readStaticAssets(swContent) {
  var block = swContent.match(/STATIC_ASSETS\s*=\s*\[([\s\S]*?)\]/);
  if (!block) throw new Error('STATIC_ASSETS block in sw.js nicht gefunden');
  var assets = [];
  var re = /'([^']+)'/g;
  var m;
  while ((m = re.exec(block[1])) !== null) {
    assets.push(m[1]);
  }
  return assets;
}

describe('sw.js STATIC_ASSETS deckt alle lokalen Produktions-Assets aus index.html ab', () => {
  it('alle lokalen <script src>-URLs aus index.html (inklusive ?v=…) sind in STATIC_ASSETS', () => {
    var indexContent = readFileSync(resolve(publicDir, 'index.html'), 'utf-8');
    var swContent = readFileSync(resolve(publicDir, 'sw.js'), 'utf-8');
    var local = readLocalAssets(indexContent).filter(function (a) {
      // Nur lokale Skripte (keine externen http(s)-URLs)
      return !/^https?:/.test(a);
    });
    var staticAssets = readStaticAssets(swContent);
    var scriptSrcs = local.filter(function (a) { return a.indexOf('/js/') === 0; });
    for (var i = 0; i < scriptSrcs.length; i++) {
      expect(staticAssets, 'fehlt in STATIC_ASSETS: ' + scriptSrcs[i]).toContain(scriptSrcs[i]);
    }
  });

  it('lokales Stylesheet aus index.html (inklusive ?v=…) ist in STATIC_ASSETS', () => {
    var indexContent = readFileSync(resolve(publicDir, 'index.html'), 'utf-8');
    var swContent = readFileSync(resolve(publicDir, 'sw.js'), 'utf-8');
    var local = readLocalAssets(indexContent).filter(function (a) {
      return a.indexOf('/css/') === 0;
    });
    var staticAssets = readStaticAssets(swContent);
    expect(local.length, 'kein lokales Stylesheet in index.html gefunden').toBeGreaterThan(0);
    for (var i = 0; i < local.length; i++) {
      expect(staticAssets, 'fehlt in STATIC_ASSETS: ' + local[i]).toContain(local[i]);
    }
  });

  it('lokale Manifest-Referenz aus index.html ist in STATIC_ASSETS', () => {
    var indexContent = readFileSync(resolve(publicDir, 'index.html'), 'utf-8');
    var swContent = readFileSync(resolve(publicDir, 'sw.js'), 'utf-8');
    var local = readLocalAssets(indexContent).filter(function (a) {
      return a.indexOf('/manifest.json') >= 0;
    });
    var staticAssets = readStaticAssets(swContent);
    expect(local.length, 'kein lokales manifest.json in index.html gefunden').toBeGreaterThan(0);
    for (var i = 0; i < local.length; i++) {
      expect(staticAssets, 'fehlt in STATIC_ASSETS: ' + local[i]).toContain(local[i]);
    }
  });

  it('apple-touch-icon (icon-180.png) ist in STATIC_ASSETS (Offline-Bootstrap)', () => {
    var indexContent = readFileSync(resolve(publicDir, 'index.html'), 'utf-8');
    var swContent = readFileSync(resolve(publicDir, 'sw.js'), 'utf-8');
    var local = readLocalAssets(indexContent).filter(function (a) {
      return a.indexOf('icon-180.png') >= 0;
    });
    expect(local.length, 'kein apple-touch-icon icon-180.png in index.html').toBeGreaterThan(0);
    var staticAssets = readStaticAssets(swContent);
    for (var i = 0; i < local.length; i++) {
      expect(staticAssets, 'fehlt in STATIC_ASSETS: ' + local[i]).toContain(local[i]);
    }
  });
});

// ─────────── Review-Fix: robuster Precache-Vertrag ───────────────────────────
//
// Vor dem Review behauptete der Test exakte Kongruenz, prüfte aber nur
// Teilmengen. Das hat veraltete / unvollständige Cache-Einträge (z. B. die
// fehlenden icon-maskable-192.png / icon-maskable-512.png) nicht erkannt.
// Diese Sektion prüft die volle Kongruenz:
//   - Alle <script src> / <link href> aus index.html sind in STATIC_ASSETS.
//   - Alle icon.src aus manifest.json sind in STATIC_ASSETS.
//   - Jeder Eintrag in STATIC_ASSETS existiert als Datei in public/.
//   - Keine unerwarteten / veralteten Einträge in STATIC_ASSETS
//     (Whitelist: '/' + '/index.html' + die oben genannten lokalen Quellen).
// ROOT ('/') und '/index.html' bleiben erlaubte Bootstrap-Einträge.

describe('sw.js STATIC_ASSETS — volle Kongruenz, Dateiexistenz, keine Altlasten', () => {
  // Helpers wiederverwenden (siehe describe oben). Da sie im selben Modul
  // definiert sind, sind sie hier sichtbar.
  function readManifestIcons(manifestContent) {
    var icons = [];
    // JSON-Pattern: "src": "..." Einträge innerhalb des icons-Array
    // robust extrahieren (vermeidet JSON.parse, damit Test ohne JSON-Lib
    // auskommt).
    var iconBlock = manifestContent.match(/"icons"\s*:\s*\[([\s\S]*?)\]/);
    if (!iconBlock) return icons;
    var srcRe = /"src"\s*:\s*"([^"]+)"/g;
    var m;
    while ((m = srcRe.exec(iconBlock[1])) !== null) {
      var src = m[1];
      // Relative Pfade aus dem manifest (src ist relativ zu /)
      if (src.charAt(0) === '/') {
        icons.push(src);
      } else {
        icons.push('/' + src);
      }
    }
    return icons;
  }

  it('Kongruenz: jede lokale index.html-Ressource ist in STATIC_ASSETS', () => {
    var indexContent = readFileSync(resolve(publicDir, 'index.html'), 'utf-8');
    var swContent = readFileSync(resolve(publicDir, 'sw.js'), 'utf-8');
    var local = readLocalAssets(indexContent).filter(function (a) {
      return !/^https?:/.test(a);
    });
    var staticAssets = readStaticAssets(swContent);
    // Whitelist: '/' und '/index.html' sind explizit erlaubte Bootstrap-
    // Einträge (auch wenn nicht direkt in index.html referenziert).
    var required = local.filter(function (a) {
      return a !== '/' && a !== '/index.html';
    });
    for (var i = 0; i < required.length; i++) {
      expect(staticAssets, 'fehlt in STATIC_ASSETS: ' + required[i]).toContain(required[i]);
    }
  });

  it('Kongruenz: jede icon.src aus manifest.json ist in STATIC_ASSETS', () => {
    var manifestContent = readFileSync(resolve(publicDir, 'manifest.json'), 'utf-8');
    var swContent = readFileSync(resolve(publicDir, 'sw.js'), 'utf-8');
    var staticAssets = readStaticAssets(swContent);
    var icons = readManifestIcons(manifestContent);
    expect(icons.length, 'manifest.json enthält keine icons').toBeGreaterThan(0);
    for (var i = 0; i < icons.length; i++) {
      expect(staticAssets, 'Icon fehlt in STATIC_ASSETS: ' + icons[i]).toContain(icons[i]);
    }
  });

  it('Dateiexistenz: jeder Eintrag in STATIC_ASSETS existiert in public/', () => {
    var swContent = readFileSync(resolve(publicDir, 'sw.js'), 'utf-8');
    var staticAssets = readStaticAssets(swContent);
    expect(staticAssets.length, 'STATIC_ASSETS ist leer').toBeGreaterThan(0);
    for (var i = 0; i < staticAssets.length; i++) {
      var entry = staticAssets[i];
      // ROOT ('/') ist immer erlaubt (PWA-Start-URL).
      if (entry === '/') continue;
      // '/index.html' ist Bootstrap und wird vom Manifest-Backend geservt.
      if (entry === '/index.html') continue;
      var filePath = resolve(publicDir, '.' + entry);
      // Querystring abtrennen — Datei liegt unter dem Pfad ohne ?v=…
      var qIdx = filePath.indexOf('?');
      if (qIdx >= 0) filePath = filePath.substring(0, qIdx);
      expect(existsSync(filePath), 'STATIC_ASSETS-Eintrag existiert nicht: ' + entry).toBe(true);
    }
  });

  it('keine unerwarteten / veralteten Einträge in STATIC_ASSETS', () => {
    // Erlaubte Quellen:
    //   1) Lokale index.html-Assets (script/css/icon/apple-touch-icon/manifest).
    //   2) icon.src aus manifest.json.
    //   3) Self-gehostete WOFF2-Fonts unter public/fonts/ (Issue #421).
    //   4) Whitelist: '/' und '/index.html' als Bootstrap-Einträge.
    // Alles andere in STATIC_ASSETS ist eine "Altlast" und muss entfernt
    // werden (z. B. veraltete Dateinamen, vergessene Cache-Bustings).
    var indexContent = readFileSync(resolve(publicDir, 'index.html'), 'utf-8');
    var manifestContent = readFileSync(resolve(publicDir, 'manifest.json'), 'utf-8');
    var swContent = readFileSync(resolve(publicDir, 'sw.js'), 'utf-8');
    var staticAssets = readStaticAssets(swContent);
    var local = readLocalAssets(indexContent).filter(function (a) {
      return !/^https?:/.test(a);
    });
    var icons = readManifestIcons(manifestContent);
    var whitelist = new Set(['/', '/index.html']);
    for (var i = 0; i < local.length; i++) whitelist.add(local[i]);
    for (var j = 0; j < icons.length; j++) whitelist.add(icons[j]);
    // Issue #421: self-gehostete Fonts in public/fonts/ müssen Teil des
    // Precache-Vertrags sein. Wir scannen das Verzeichnis zur Laufzeit und
    // erwarten jeden Eintrag in STATIC_ASSETS — damit können neue Fonts
    // hinzugefügt werden, ohne dass der Test manuell angepasst werden muss.
    var fontsDir = resolve(publicDir, 'fonts');
    if (existsSync(fontsDir)) {
      var fontEntries = readdirSync(fontsDir).filter(function (f) {
        return /\.woff2$/i.test(f);
      });
      for (var k = 0; k < fontEntries.length; k++) {
        whitelist.add('/fonts/' + fontEntries[k]);
      }
    }
    var unexpected = staticAssets.filter(function (a) { return !whitelist.has(a); });
    expect(unexpected, 'unerwartete STATIC_ASSETS-Einträge: ' + unexpected.join(', ')).toEqual([]);
  });

  // Issue #421: Self-Hosted Fonts sind Teil der App-Shell. Jede WOFF2-Datei
  // unter public/fonts/ muss explizit in STATIC_ASSETS gelistet sein, sonst
  // ist die PWA beim ersten Offline-Start ohne Schriftarten.
  it('jede WOFF2-Datei unter public/fonts/ ist in STATIC_ASSETS', () => {
    var swContent = readFileSync(resolve(publicDir, 'sw.js'), 'utf-8');
    var staticAssets = readStaticAssets(swContent);
    var fontsDir = resolve(publicDir, 'fonts');
    expect(existsSync(fontsDir), 'public/fonts/ fehlt — App-Shell nicht offline-fähig').toBe(true);
    var fontEntries = readdirSync(fontsDir).filter(function (f) {
      return /\.woff2$/i.test(f);
    });
    expect(fontEntries.length, 'public/fonts/ enthält keine WOFF2-Dateien').toBeGreaterThan(0);
    for (var i = 0; i < fontEntries.length; i++) {
      var entry = '/fonts/' + fontEntries[i];
      expect(staticAssets, 'Font fehlt in STATIC_ASSETS: ' + entry).toContain(entry);
    }
  });

});

// ─────────── Issue #442: CSSOM-Vertrag für die persistente Bottom-Nav ────────
//
// In styles.css stand ein verwaister Kommentarrest (schließendes */ ohne
// öffnendes /*) direkt vor `.dashboard-open-btn, #protokoll_tab_btn { display:
// none; }`. Ein echter Browser-CSSOM-Parser verwirft die direkt folgende
// Regel und behält nur die spätere !important-Dublette. jsdom ist hier
// nachsichtiger und interpretiert den Rest als (kaputten) Selektor der ersten
// Regel; der SelektorText startet dann mit dem Text des verwaister Kommentars
// statt mit `.dashboard-open-btn`.
//
// Damit der Test die echte Browser-Semantik abbildet, filtern wir streng auf
// Regeln, deren SelektorText EXAKT der normalisierten kombinierten Selektor-
// Form entspricht — Regeln mit korrumpiertem SelektorText (z. B. mit dem
// Kommentar-Rest davor) zählen nicht als gültige Treffer. Vor dem Fix findet
// der Parser genau eine gültige Regel mit `display: none !important` (Priorität
// "important") — die erste Ausblendregel wurde wegen des Kommentarbruchs
// verworfen. Nach dem Fix findet der Parser genau eine gültige Regel mit
// `display: none` und leerer Priorität (kein !important).
describe('CSSOM-Vertrag für .dashboard-open-btn, #protokoll_tab_btn (#442)', () => {
  const cssPath = resolve(publicDir, 'css', 'styles.css');
  const expectedSelector = '.dashboard-open-btn,#protokoll_tab_btn';

  function findCombinedSelectorRules() {
    const css = readFileSync(cssPath, 'utf-8');
    const html = '<!DOCTYPE html><html><head><style>' + css + '</style></head>'
      + '<body><button class="dashboard-open-btn">x</button>'
      + '<div id="protokoll_tab_btn">y</div></body></html>';
    const dom = new JSDOM(html, { url: 'http://localhost/' });
    var matches = [];
    for (var i = 0; i < dom.window.document.styleSheets.length; i++) {
      var sheet = dom.window.document.styleSheets[i];
      var rules;
      try { rules = sheet.cssRules; } catch (e) { continue; }
      for (var j = 0; j < rules.length; j++) {
        var rule = rules[j];
        if (!rule.selectorText) continue;
        var normalized = rule.selectorText.replace(/\s+/g, '');
        if (normalized === expectedSelector) {
          matches.push(rule);
        }
      }
    }
    return matches;
  }

  it('genau eine geparste Regel mit dem kombinierten Selektor', () => {
    var matches = findCombinedSelectorRules();
    expect(matches, 'unerwartete Anzahl Regeln mit Selektor "' + expectedSelector
      + '" — entweder fehlt die Ausblendregel oder es gibt eine zweite/duplizierte Variante')
      .toHaveLength(1);
  });

  it('display der geparsten Regel ist "none"', () => {
    var matches = findCombinedSelectorRules();
    expect(matches, 'Voraussetzung: genau eine Regel mit kombiniertem Selektor vorhanden')
      .toHaveLength(1);
    expect(matches[0].style.getPropertyValue('display')).toBe('none');
  });

  it('Priorität von display ist leer (kein !important)', () => {
    var matches = findCombinedSelectorRules();
    expect(matches, 'Voraussetzung: genau eine Regel mit kombiniertem Selektor vorhanden')
      .toHaveLength(1);
    expect(matches[0].style.getPropertyPriority('display')).toBe('');
  });
});

// ─────────── Issue #443: Font-Deduplizierung und Variable-Font-Vertrag ───────
//
// Im Selfhosting-Bestand (Issue #421) lagen 12 WOFF2-Dateien unter
// public/fonts/, aber nur 4 eindeutige Inhalte (4× Inter latin, 4× Inter
// latin-ext, 2× Source Serif 4 latin, 2× Source Serif 4 latin-ext). Google
// liefert pro Gewicht eine eigene URL, obwohl Inter und Source Serif 4
// bereits variable Fonts sind — derselbe Blob deckt alle Gewichte ab. Wir
// stellen auf 4 klar benannte Variable-Font-Dateien um und schützen den
// Vertrag hier ab.
describe('Issue #443: Font-Deduplizierung und Variable-Font-Vertrag', () => {
  const fontsDir = resolve(publicDir, 'fonts');

  // a) Es darf keine byteidentischen WOFF2-Dateien unter public/fonts/ geben.
  // Vor #443 gab es 8 redundante Dateien (4× Inter latin, 4× Inter latin-ext,
  // 2× SS4 latin, 2× SS4 latin-ext). Nach #443 ist jede WOFF2 ein Unikat.
  it('keine byteidentischen WOFF2-Dateien unter public/fonts/', () => {
    expect(existsSync(fontsDir), 'public/fonts/ fehlt').toBe(true);
    const files = readdirSync(fontsDir).filter((f) => /\.woff2$/i.test(f));
    expect(files.length, 'public/fonts/ enthält keine WOFF2-Dateien').toBeGreaterThan(0);
    const hashToFiles = new Map();
    for (const f of files) {
      const full = resolve(fontsDir, f);
      const buf = readFileSync(full);
      const h = createHash('sha256').update(buf).digest('hex');
      if (!hashToFiles.has(h)) hashToFiles.set(h, []);
      hashToFiles.get(h).push(f);
    }
    const duplicateGroups = Array.from(hashToFiles.values()).filter((g) => g.length > 1);
    const msg = duplicateGroups.length === 0
      ? null
      : 'byteidentische WOFF2-Gruppen gefunden: '
        + duplicateGroups.map((g) => '[' + g.join(', ') + ']').join(', ');
    expect(duplicateGroups, msg).toEqual([]);
    expect(hashToFiles.size, 'Anzahl eindeutiger SHA-256-Hashes != Anzahl Dateien').toBe(files.length);
  });

  // b) Symmetrie zwischen @font-face-URLs in styles.css und Dateien unter
  // public/fonts/: Jede referenzierte URL muss auf eine existierende Datei
  // zeigen, und jede WOFF2-Datei im Verzeichnis muss (mindestens) einmal
  // referenziert sein. Damit kann keine Datei "verwaisen" (Disk ohne CSS-
  // Referenz) und keine URL ins Leere zeigen (CSS ohne Datei).
  it('@font-face-URLs und Font-Dateien sind deckungsgleich', () => {
    const cssPath = resolve(publicDir, 'css', 'styles.css');
    const content = readFileSync(cssPath, 'utf-8');
    // Alle url('/fonts/...woff2') extrahieren und auf /fonts/-Pfade normalisieren.
    const urlRe = /url\(\s*['"]?(\/fonts\/[^'")\s]+\.woff2)['"]?\s*\)/g;
    const referenced = new Set();
    var m;
    while ((m = urlRe.exec(content)) !== null) {
      referenced.add(m[1]);
    }
    expect(referenced.size, 'keine /fonts/*.woff2-URLs in styles.css gefunden').toBeGreaterThan(0);
    expect(existsSync(fontsDir), 'public/fonts/ fehlt').toBe(true);
    const onDisk = new Set(
      readdirSync(fontsDir)
        .filter((f) => /\.woff2$/i.test(f))
        .map((f) => '/fonts/' + f)
    );
    expect(onDisk.size, 'public/fonts/ enthält keine WOFF2-Dateien').toBeGreaterThan(0);
    const onlyInCss = Array.from(referenced).filter((u) => !onDisk.has(u));
    const onlyOnDisk = Array.from(onDisk).filter((u) => !referenced.has(u));
    expect(onlyInCss, 'URLs in styles.css ohne Datei: ' + onlyInCss.join(', ')).toEqual([]);
    expect(onlyOnDisk, 'Dateien ohne @font-face-Referenz: ' + onlyOnDisk.join(', ')).toEqual([]);
    expect(referenced.size, 'Anzahl @font-face-URLs != Anzahl WOFF2-Dateien').toBe(onDisk.size);
  });

  // c) Variable-Font-Gewichtsbereiche sind in styles.css deklariert. Inter
  // deckt wght 100–900 ab, Source Serif 4 wght 200–900 (siehe fc-scan). Wir
  // verlangen die Bereichs-Schreibweise 'font-weight: 100 900;' und
  // 'font-weight: 200 900;', damit klar ist, dass es sich um Variable Fonts
  // handelt und nicht um ein einzelnes statisches Gewicht.
  it('Variable-Font-Gewichtsbereiche sind deklariert', () => {
    const cssPath = resolve(publicDir, 'css', 'styles.css');
    const content = readFileSync(cssPath, 'utf-8');
    expect(content, 'font-weight: 100 900; (Inter, wght 100–900) fehlt').toContain('font-weight: 100 900;');
    expect(content, 'font-weight: 200 900; (Source Serif 4, wght 200–900) fehlt').toContain('font-weight: 200 900;');
  });
});
});
