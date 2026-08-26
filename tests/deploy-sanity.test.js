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

  it('sw.js CACHE_VERSION hat gültiges Format agrar-rechner-vN ≥ v53', () => {
    // Issue #444 Welle 2: Statt eines harten Literal-Pins prüfen wir den
    // Format-Vertrag und eine UNTERGRENZE. Damit bricht der Test nicht
    // bei jeder kleinen Versions-Erhöhung, aber ein versehentliches
    // Zurück-Drehen (z. B. von v54 auf v52) wird weiterhin rot.
    //
    // Format-Vertrag: /^agrar-rechner-v\d+$/
    // Untergrenze: numerisch aus dem String geparst ≥ 53 (= Stand nach
    // Issue #443 Font-Deduplizierung).
    //
    // v51 = nach Issue #416 Welle 8 (data-io-handlers.js)
    // v52 = nach Issue #417 (state-coordinator.js hinzugefügt)
    // v53 = nach Issue #443 (Font-Deduplizierung: 12 WOFF2 → 4 Variable Fonts)
    // v54 = nach Issue #446 Welle 1 (dialog-a11y.js ins Precache aufgenommen)
    const swPath = resolve(publicDir, 'sw.js');
    const content = readFileSync(swPath, 'utf-8');
    const match = content.match(/CACHE_VERSION\s*=\s*'([^']+)'/);
    expect(match, 'CACHE_VERSION muss in sw.js vorhanden sein').not.toBeNull();
    var versionStr = match[1];
    var MIN_CACHE_VERSION = 53;
    var CACHE_VERSION_RE = /^agrar-rechner-v(\d+)$/;
    var versionMatch = CACHE_VERSION_RE.exec(versionStr);
    expect(
      versionMatch,
      'CACHE_VERSION muss dem Format agrar-rechner-vN entsprechen (war: ' +
        versionStr + ')'
    ).not.toBeNull();
    var numericVersion = parseInt(versionMatch[1], 10);
    expect(
      numericVersion,
      'CACHE_VERSION ' + versionStr + ' liegt unter der Untergrenze v' +
        MIN_CACHE_VERSION + ' — würde Offline-Clients einen älteren Cache aufzwingen.'
    ).toBeGreaterThanOrEqual(MIN_CACHE_VERSION);
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

// ─────────── Issue #445 Welle 2: Runtime-Cache-Härtung + CSP-Härtung ──────────
//
// Zwei Contracts:
//   1) sw.js fetch-Handler: nur "sichere" GET-Responses landen im
//      Runtime-Cache. Methoden != GET werden gar nicht gecacht (POST/PUT/
//      DELETE ohnehin nicht cacheable), Opaque-Responses (no-cors cross-
//      origin) und Fehlerseiten (4xx/5xx) und Partial Content (206) dürfen
//      nie persistiert werden.
//   2) public/_headers CSP: object-src 'none' — verhindert Plugin-/Flash-/
//      Applet-Embedding, Best-Practice der gängigen CSP-Härtungs-Scanner
//      (Mozilla Observatory, securityheaders.com).
describe('Issue #445 Welle 2 — Runtime-Cache + CSP-Härtung', () => {
  it('sw.js fetch-Handler prüft e.request.method === \'GET\' vor c.put()', () => {
    const swPath = resolve(publicDir, 'sw.js');
    const content = readFileSync(swPath, 'utf-8');
    // GET-Methoden-Check muss vorhanden sein …
    expect(content).toMatch(/e\.request\.method\s*===\s*['"]GET['"]/);
    // … und VOR dem c.put()-Aufruf stehen (gleicher Block, network-first-Pfad).
    var methodIdx = content.search(/e\.request\.method\s*===\s*['"]GET['"]/);
    var putIdx = content.search(/c\.put\(/);
    expect(methodIdx, 'method-Check vor c.put()').toBeGreaterThanOrEqual(0);
    expect(putIdx, 'c.put() nach method-Check').toBeGreaterThan(methodIdx);
  });

  it('sw.js fetch-Handler prüft Response-Type (basic|cors) + Status 200 vor c.put()', () => {
    const swPath = resolve(publicDir, 'sw.js');
    const content = readFileSync(swPath, 'utf-8');
    // Response-Type muss 'basic' ODER 'cors' sein (kein 'opaque' → opaque
    // bedeutet no-cors-Cross-Origin ohne Status-/Header-Einsicht; wäre ein
    // Cache-Hygiene-Risiko).
    var hasBasic = /response\.type\s*===\s*['"]basic['"]/.test(content);
    var hasCors = /response\.type\s*===\s*['"]cors['"]/.test(content);
    expect(hasBasic || hasCors, "response.type muss 'basic' oder 'cors' als Cache-Guard prüfen").toBe(true);
    // Status 200 (kein Redirect 3xx, kein Partial Content 206, kein Error 4xx/5xx).
    expect(content).toMatch(/response\.status\s*===\s*200/);
    // Beide Prüfungen müssen VOR dem c.put()-Aufruf stehen.
    var typeIdx = content.search(/response\.type\s*===\s*['"](basic|cors)['"]/);
    var statusIdx = content.search(/response\.status\s*===\s*200/);
    var putIdx = content.search(/c\.put\(/);
    expect(typeIdx, 'type-Check vor c.put()').toBeGreaterThanOrEqual(0);
    expect(statusIdx, 'status-Check nach type-Check und vor c.put()').toBeGreaterThan(typeIdx);
    expect(putIdx, 'c.put() nach status-Check').toBeGreaterThan(statusIdx);
  });

  it('_headers CSP enthält object-src \'none\' (#445 Welle 2)', () => {
    const content = readFileSync(resolve(publicDir, '_headers'), 'utf-8');
    const cspLine = content.split('\n').find((l) => l.includes('Content-Security-Policy'));
    expect(cspLine, 'Content-Security-Policy-Zeile muss existieren').toBeTruthy();
    // Directive-weise prüfen (CSP = "dir1; dir2; ..."), damit eine
    // object-src-Directive neben den anderen Direktiven sauber gefunden wird.
    const objectSrc = cspLine.split(';').map((s) => s.trim()).find((s) => s.startsWith('object-src'));
    expect(objectSrc, 'object-src-Directive muss existieren').toBeTruthy();
    expect(objectSrc, "object-src muss 'none' enthalten").toContain("'none'");
  });
});

// ─────────── Issue #448 Welle 2: CSS-Variablen-Vertrag & color-scheme ────────
//
// Vor #448 Welle 2 gab es in styles.css:
//   - 14 definierte CSS-Variablen ohne jede var()-Referenz (tot).
//   - 3 var()-Referenzen auf undefinierte Variablen (liefen nur wegen
//     Fallback-Werten — Quelltext-Hygiene-Risiko).
//   - kein color-scheme auf :root oder html.dark (Browser-Defaults
//     sickerten in Formular-/Scrollbar-Farben durch).
//
// Diese Tests schützen den neuen Vertrag:
//   (a) JEDE in styles.css definierte Variable wird mindestens 1× per
//       var(--x) referenziert. Whitelist: --tab-name-scale (wird zur
//       Laufzeit per style.setProperty in render-tabs.js gesetzt).
//   (b) JEDE var(--x)-Referenz in styles.css hat eine Definition in
//       styles.css. Gleiche Whitelist.
//   (c) :root enthält color-scheme: light; html.dark enthält
//       color-scheme: dark.
describe('Issue #448 Welle 2: CSS-Variablen-Vertrag und color-scheme', () => {
  const cssPath = resolve(publicDir, 'css', 'styles.css');
  // Whitelist: Variablen, die ohne CSS-Definition existieren dürfen.
  // --tab-name-scale wird in public/js/render-tabs.js Z.~265 per
  // style.setProperty() gesetzt; die einzige var()-Referenz liegt in
  // .tab-name (styles.css Z.~425).
  const WHITELIST_UNDEFINED = new Set(['--tab-name-scale']);

  function readCss() {
    return readFileSync(cssPath, 'utf-8');
  }

  function extractDefinedVars(css) {
    // Definitionen finden wir überall, wo `--foo: <value>;` (oder ein
    // mehrzeiliger Wert) im :root- oder html.dark-Block steht. Wir
    // matchen jedes `--name:`-Token innerhalb des gesamten CSS — die
    // Variablen in diesem Repo sind ausschließlich in :root und
    // html.dark definiert, andere Definitionen gibt es nicht.
    const set = new Set();
    const re = /(--[a-z][a-z0-9-]*)\s*:/g;
    let m;
    while ((m = re.exec(css)) !== null) {
      set.add(m[1]);
    }
    return set;
  }

  function extractReferencedVars(css) {
    const set = new Set();
    const re = /var\(\s*(--[a-z][a-z0-9-]*)/g;
    let m;
    while ((m = re.exec(css)) !== null) {
      set.add(m[1]);
    }
    return set;
  }

  it('(a) JEDE in styles.css definierte CSS-Variable hat mindestens 1 var()-Referenz', () => {
    const css = readCss();
    const defined = extractDefinedVars(css);
    const referenced = extractReferencedVars(css);
    // Whitelist ist nur für die andere Richtung relevant (Referenz ohne
    // Definition). Hier prüfen wir "Definition ohne Referenz" — d.h. tote
    // Variablen.
    const unreferenced = Array.from(defined).filter((v) => !referenced.has(v));
    expect(
      unreferenced,
      'definierte CSS-Variablen ohne var()-Referenz (tot): ' +
        unreferenced.join(', ')
    ).toEqual([]);
  });

  it('(b) JEDE var()-Referenz in styles.css hat eine Definition', () => {
    const css = readCss();
    const defined = extractDefinedVars(css);
    const referenced = extractReferencedVars(css);
    const undefinedRefs = Array.from(referenced).filter(
      (v) => !defined.has(v) && !WHITELIST_UNDEFINED.has(v)
    );
    expect(
      undefinedRefs,
      'var()-Referenzen ohne CSS-Definition (nicht in Whitelist): ' +
        undefinedRefs.join(', ')
    ).toEqual([]);
  });

  it('Whitelist-Begründung: --tab-name-scale darf ohne CSS-Definition existieren', () => {
    // Sicherstellen, dass die Whitelist tatsächlich aktiv ist und
    // --tab-name-scale im CSS referenziert wird (sonst wäre die
    // Whitelist-Erlaubnis wertlos). Wenn render-tabs.js das Setzen
    // einstellt, müsste dieser Test ergänzt werden.
    const css = readCss();
    expect(extractReferencedVars(css).has('--tab-name-scale')).toBe(true);
    expect(WHITELIST_UNDEFINED.has('--tab-name-scale')).toBe(true);
  });

  it('(c-1) :root deklariert color-scheme: light', () => {
    const css = readCss();
    // Sucht im :root-Block nach color-scheme: light;. Wir nutzen ein
    // tolerantes Regex (Whitespace egal), weil Editoren unterschiedlich
    // umbrechen können.
    const rootBlockMatch = css.match(/:root\s*\{([\s\S]*?)\}/);
    expect(rootBlockMatch, ':root-Block fehlt in styles.css').not.toBeNull();
    expect(
      rootBlockMatch[1],
      ':root-Block muss color-scheme: light; deklarieren (Form/Farbe der nativen UI)'
    ).toMatch(/color-scheme\s*:\s*light\s*;/);
  });

  it('(c-2) html.dark deklariert color-scheme: dark', () => {
    const css = readCss();
    // Erster html.dark-Block (Variablen-Override); color-scheme muss hier
    // oder in einer späteren html.dark-Selektor-Regel stehen — wir
    // akzeptieren beides, weil das Variablen-Override die richtige Stelle
    // ist und mit dem ersten Block zusammenpasst.
    const darkVarBlockMatch = css.match(/html\.dark\s*\{([\s\S]*?)\}/);
    expect(darkVarBlockMatch, 'html.dark-Block fehlt in styles.css').not.toBeNull();
    expect(
      darkVarBlockMatch[1],
      'html.dark-Variablen-Block muss color-scheme: dark; deklarieren'
    ).toMatch(/color-scheme\s*:\s*dark\s*;/);
  });
});

// ─────────── Issue #449: Doku-Sanity (Referenzen, Modulzahlen, ci.yml) ────────
//
// Ziel: Sicherstellen, dass die Doku-Wahrheit mit dem Repo synchron bleibt.
// Drei Verträge:
//   (1) JEDE in README.md / AGENTS.md in Backticks genannte Dateireferenz
//       löst zu einer existierenden Datei auf. Pfade dürfen absolut (mit
//       public/-, tests/-, .github/-Präfix) oder relativ zu public/ sein.
//       Whitelist: package-lock.json (existiert NICHT im Repo, wird in
//       AGENTS.md §2 explizit als „Bug" markiert) und CODE_DEEP_DIVE.md
//       (user-owned, wird nicht von der Sanity erfasst, weil die Tests
//       nur README/AGENTS lesen).
//   (2) Modulzahl-Konsistenz: Anzahl <script src>-Tags in public/index.html
//       === Anzahl .js-Dateien in public/js/ === die in README genannten
//       Zahlen (Regex über den README-Text).
//   (3) Kein ci.yml-Resteverweis in README/AGENTS (die Datei existiert nicht
//       — die echte Workflow-Datei heißt .github/workflows/deploy.yml).
//
// Das ist ein bewusst enger, read-only Vertrag: keine Pflicht, jede mögliche
// Erwähnung zu whitelisten. Wenn die Tests zu streng sind, wird die Whitelist
// ergänzt und die Begründung inline dokumentiert.
describe('Issue #449 — Doku-Sanity: README-/AGENTS.md-Referenzen lösen auf reale Dateien auf', () => {
  const repoRoot = resolve(__dirname, '..');

  // Whitelist: README/AGENTS erwähnen diese Dateien bewusst, obwohl sie im
  // Repo (noch) nicht existieren. Begründung jeweils inline.
  //   - package-lock.json: AGENTS.md §2 markiert das Auftauchen explizit als
  //     Bug („If you see a `package-lock.json`, it is a bug"). Die Datei darf
  //     also nicht existieren.
  const DOC_WHITELIST = new Set([
    'package-lock.json',
  ]);

  // Backtick-Extraktion: nur Treffer, die wie Dateipfade aussehen
  //   (mind. ein `/` zur Abgrenzung gegen Property-Notationen wie
  //   `state.koernerProEinheit`, eine bekannte Extension am Ende).
  const BACKTICK_PATH_RE = /`([a-zA-Z][a-zA-Z0-9_./-]+\.(?:js|md|yml|jsonc|html|css|json|woff2|png|svg|txt|toml|mjs|yaml))`/g;

  function extractBacktickedPaths(content) {
    const out = new Set();
    let m;
    while ((m = BACKTICK_PATH_RE.exec(content)) !== null) {
      const ref = m[1];
      // Property-Notationen wie `state.X` rausfiltern: muss einen `/`
      // enthalten, sonst ist es kein Pfad.
      if (ref.indexOf('/') < 0) continue;
      out.add(ref);
    }
    return Array.from(out);
  }

  function existsUnderPublicOrRootOrTests(ref) {
    // Reihenfolge der Suchpfade:
    //   1) Repo-Root (für AGENTS.md-erwähnte Files wie eslint.config.js,
    //      vitest.config.js, wrangler.jsonc, pnpm-lock.yaml).
    //   2) public/ (für Bare-Filenames wie index.html, manifest.json).
    //   3) public/js/ (für Bare-Filenames wie main.js, state.js).
    //   4) tests/ (für *.test.js-Bare-Filenames).
    const candidates = [
      resolve(repoRoot, ref),
      resolve(repoRoot, 'public', ref),
      resolve(repoRoot, 'public', 'js', ref),
      resolve(repoRoot, 'tests', ref),
    ];
    for (let i = 0; i < candidates.length; i++) {
      if (existsSync(candidates[i])) return candidates[i];
    }
    return null;
  }

  function checkAllRefsResolved(file) {
    const content = readFileSync(resolve(repoRoot, file), 'utf-8');
    const refs = extractBacktickedPaths(content);
    expect(refs.length, file + ': keine Backtick-Pfade gefunden — Regex prüfen').toBeGreaterThan(0);
    const missing = [];
    const checked = [];
    for (const ref of refs) {
      if (DOC_WHITELIST.has(ref)) {
        checked.push(ref + ' (whitelisted)');
        continue;
      }
      const hit = existsUnderPublicOrRootOrTests(ref);
      if (hit) {
        checked.push(ref);
      } else {
        missing.push(ref);
      }
    }
    expect(missing, file + ': nicht-auflösbare Backtick-Pfade (' +
      checked.length + ' ok, ' + missing.length + ' fehlen):\n' +
      '  ok:        ' + checked.join('\n  ok:        ') + '\n' +
      '  vermisst:  ' + missing.join('\n  vermisst:  ')
    ).toEqual([]);
  }

  it('README.md: jede in Backticks genannte Datei existiert im Repo (Whitelist für package-lock.json)', () => {
    checkAllRefsResolved('README.md');
  });

  it('AGENTS.md: jede in Backticks genannte Datei existiert im Repo (Whitelist für package-lock.json)', () => {
    checkAllRefsResolved('AGENTS.md');
  });

  it('README.md und AGENTS.md nennen kein ci.yml mehr (Workflow heißt deploy.yml)', () => {
    const readme = readFileSync(resolve(repoRoot, 'README.md'), 'utf-8');
    const agents = readFileSync(resolve(repoRoot, 'AGENTS.md'), 'utf-8');
    // Wir suchen das Token `ci.yml` als eigenständige Datei-Referenz — nicht
    // z. B. innerhalb eines Wortes oder Kommentars. Backticks umrahmen die
    // Referenz (Doku-Konvention); das reicht für eine harte Ableitung.
    expect(readme, 'README.md enthält noch ci.yml-Referenz').not.toMatch(/`ci\.yml`/);
    expect(agents, 'AGENTS.md enthält noch ci.yml-Referenz').not.toMatch(/`ci\.yml`/);
  });
});

// ─────────── Issue #449: Modulzahl-Konsistenz ─────────────────────────────────
//
// Die kanonische Modulzahl leitet sich aus public/index.html ab (Anzahl der
// `<script src="js/…">`-Tags). Die gleiche Anzahl .js-Dateien muss unter
// public/js/ liegen, und README.md muss sie konsistent nennen.
//
// Wir extrahieren die im README genannten Modulzahlen per Regex:
//   - „in N Module" / „in N JS-Module" / „N Module, Lade-Reihenfolge"
//     (Z. 60/61/77) — nur natürliche Zahlen, die im Modul-Kontext stehen.
describe('Issue #449 — Modulzahl-Konsistenz: index.html ↔ public/js ↔ README', () => {
  const repoRoot = resolve(__dirname, '..');
  const publicDir = resolve(repoRoot, 'public');

  function countScriptTags() {
    const content = readFileSync(resolve(publicDir, 'index.html'), 'utf-8');
    const re = /<script\s+src=["']js\/[^"']+["']\s*><\/script>/g;
    let count = 0;
    let m;
    while ((m = re.exec(content)) !== null) count++;
    return count;
  }

  function countJsFiles() {
    const jsDir = resolve(publicDir, 'js');
    const files = readdirSync(jsDir).filter((f) => /\.js$/i.test(f));
    return files.length;
  }

  function extractReadmeModuleNumbers() {
    // Erfasst natürliche Zahlen in Modul-Phrasen: „9 Module", „9 JS-Module",
    // „20 Module, Lade-Reihenfolge", „24 Test-Suiten" wird bewusst
    // NICHT erfasst (anderes Wort vor der Zahl). Wir matchen daher nur
    // Phrasen mit „Module" im Plural direkt vor der Zahl.
    const content = readFileSync(resolve(repoRoot, 'README.md'), 'utf-8');
    const re = /\b(\d+)\s+Module\b/g;
    const out = [];
    let m;
    while ((m = re.exec(content)) !== null) out.push(parseInt(m[1], 10));
    return out;
  }

  it('index.html und public/js/ haben dieselbe Anzahl Module', () => {
    const scripts = countScriptTags();
    const files = countJsFiles();
    expect(scripts, '<script src=…> in index.html').toBe(files);
    expect(scripts, 'Modulzahl muss ≥ 1 sein').toBeGreaterThan(0);
  });

  it('README.md nennt die Modulzahl konsistent (jede „N Module"-Phrase)', () => {
    const scripts = countScriptTags();
    const files = countJsFiles();
    const readmeNumbers = extractReadmeModuleNumbers();
    expect(readmeNumbers.length, 'README.md: keine „N Module"-Phrase gefunden — Regex/Doku prüfen').toBeGreaterThan(0);
    for (let i = 0; i < readmeNumbers.length; i++) {
      expect(readmeNumbers[i], 'README.md „N Module"-Phrase # ' + (i + 1) +
        ' weicht von der kanonischen Zahl ab (index.html=' + scripts +
        ', public/js/=' + files + ')').toBe(scripts);
    }
  });
});
});
