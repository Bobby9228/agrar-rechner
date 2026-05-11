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
});