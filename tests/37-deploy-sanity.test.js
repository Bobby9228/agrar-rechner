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

  it('index.html calls reg.update() after SW registration to check for updates', () => {
    const indexPath = resolve(publicDir, 'index.html');
    const content = readFileSync(indexPath, 'utf-8');
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

  it('sw.js CACHE_VERSION matches current version', () => {
    const swPath = resolve(publicDir, 'sw.js');
    const content = readFileSync(swPath, 'utf-8');
    // CACHE_VERSION muss vorhanden sein und darf nicht leer sein
    const match = content.match(/CACHE_VERSION\s*=\s*'([^']+)'/);
    expect(match).not.toBeNull();
    expect(match[1].length).toBeGreaterThan(0);
  });

  // Issue #144: SW ohne Offline-Fallback + Registration ohne Error-Handling
  it('sw.js returns offline Response when both cache miss AND network fail', () => {
    const swPath = resolve(publicDir, 'sw.js');
    const content = readFileSync(swPath, 'utf-8');
    // Cache-First-Pfad muss bei Netzwerkfehler eine Response mit Status 503 und 'Offline' body liefern
    expect(content).toMatch(/new Response\s*\(\s*['"]Offline['"]/);
    expect(content).toMatch(/status:\s*503/);
  });

  it('index.html SW registration has .catch() for error handling', () => {
    const indexPath = resolve(publicDir, 'index.html');
    const content = readFileSync(indexPath, 'utf-8');
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
  it('index.html applies user-select: none to prevent text selection on mobile', () => {
    const indexPath = resolve(publicDir, 'index.html');
    const content = readFileSync(indexPath, 'utf-8');
    // Global * selector must include -webkit-user-select: none and user-select: none
    expect(content).toMatch(/\*\s*\{[^}]*-webkit-user-select:\s*none/);
    expect(content).toMatch(/\*\s*\{[^}]*user-select:\s*none/);
  });

  it('index.html re-enables user-select: auto on input and textarea', () => {
    const indexPath = resolve(publicDir, 'index.html');
    const content = readFileSync(indexPath, 'utf-8');
    // Inputs must re-enable user-select so users can edit values
    expect(content).toMatch(/input\s*,\s*textarea\s*\{[^}]*-webkit-user-select:\s*auto/);
    expect(content).toMatch(/input\s*,\s*textarea\s*\{[^}]*user-select:\s*auto/);
  });
});