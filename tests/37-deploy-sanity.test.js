import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

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

  it('main.js exposes the current minor release version and build date', () => {
    const mainPath = resolve(publicDir, 'js', 'main.js');
    const content = readFileSync(mainPath, 'utf-8');
    expect(content).toMatch(/APP_VERSION\s*=\s*['"]v1\.1\.5['"]/);
    expect(content).toMatch(/APP_BUILD_DATE\s*=\s*['"]August 2026['"]/);
  });

  it('sw.js CACHE_VERSION matches current version', () => {
    const swPath = resolve(publicDir, 'sw.js');
    const content = readFileSync(swPath, 'utf-8');
    // CACHE_VERSION muss vorhanden sein und darf nicht leer sein
    const match = content.match(/CACHE_VERSION\s*=\s*'([^']+)'/);
    expect(match).not.toBeNull();
    expect(match[1]).toBe('agrar-rechner-v51');
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
// beide Quellen (lokal!) und fordern exakte Kongruenz — externe
// Google-Fonts sind ausdrücklich außerhalb des Precache-Vertrags.

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
    //   3) Whitelist: '/' und '/index.html' als Bootstrap-Einträge.
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
    var unexpected = staticAssets.filter(function (a) { return !whitelist.has(a); });
    expect(unexpected, 'unerwartete STATIC_ASSETS-Einträge: ' + unexpected.join(', ')).toEqual([]);
  });

});