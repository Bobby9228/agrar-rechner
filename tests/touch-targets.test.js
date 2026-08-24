/**
 * Touch-Target-Contract-Tests (Issue #446 Welle 2a)
 *
 * jsdom kann keine Layout-Messung — wir prüfen deshalb den deklarativen
 * CSS-Vertrag direkt in der Source (wie deploy-sanity.test.js).
 *
 * WCAG 2.5.5 (Target Size, AAA): interaktive Elemente sollten ≥44×44 CSS-Pixel
 * Trefferfläche haben. Issue #446 Welle 2a hebt die zwei kritischen Stellen
 * (.drill-prio-btn 32×32 und .tab-close ~26×26 mit 2px Margin) auf das Ziel.
 *
 * Wenn eine Pseudo-Element-Lösung gewählt wird (wie .deim-remove im Projekt),
 * prüft der Test stattdessen die ::before/::after-Deklaration.
 */
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(__dirname, '..', 'public', 'css', 'styles.css');

function loadCss() {
  return readFileSync(cssPath, 'utf-8');
}

/**
 * CSS-Kommentare rauswerfen. Verarbeitet /* ... *\/ Blöcke (auch mehrzeilig).
 * Bewahrt Newlines, damit Zeilennummern in Fehlermeldungen vergleichbar bleiben.
 */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Findet die erste CSS-Regel, deren Selektor (getrimmt + Whitespace-normalisiert)
 * exakt dem gegebenen Pattern entspricht, und liefert width/height/min-width/
 * min-height-Deklarationen.
 *
 * Selektor kann ein String (exakter Match nach Normalisierung) oder eine
 * Regex sein. Pseudo-Elemente (::before/::after) werden über die Regex-Variante
 * abgedeckt (z. B. /\.tab-close::before/).
 */
function findRule(css, selectorOrPattern) {
  const cleaned = stripComments(css);
  const re = selectorOrPattern instanceof RegExp
    ? selectorOrPattern
    : new RegExp('^\\s*' + selectorOrPattern.replace(/[.+*?^$()|{}[\]\\]/g, '\\$&') + '\\s*$');
  // Zeilen-Scan nach Zeilen, die mit `selector {` enden. So vermeiden wir
  // split-on-}-Probleme mit Kommentaren und Klammern in Strings.
  const lines = cleaned.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    // Eine Regel-Header-Zeile endet mit "{" (alles davor ist der Selektor)
    if (!trimmed.endsWith('{')) continue;
    const header = trimmed.slice(0, -1).trim();
    if (!re.test(header)) continue;
    // Body einsammeln, bis Brace-Counter wieder 0 ist
    let body = '';
    let depth = 1;
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      body += l + '\n';
      // Sehr einfache Brace-Zählung — reicht für unsere wohlgeformte CSS.
      const opens = (l.match(/\{/g) || []).length;
      const closes = (l.match(/\}/g) || []).length;
      depth += opens - closes;
      if (depth <= 0) break;
    }
    return {
      header,
      width: (body.match(/(^|\n)\s*width\s*:\s*([^;\n]+)/) || [])[2] || null,
      height: (body.match(/(^|\n)\s*height\s*:\s*([^;\n]+)/) || [])[2] || null,
      minWidth: (body.match(/(^|\n)\s*min-width\s*:\s*([^;\n]+)/) || [])[2] || null,
      minHeight: (body.match(/(^|\n)\s*min-height\s*:\s*([^;\n]+)/) || [])[2] || null,
      body,
    };
  }
  return null;
}

/**
 * Liest einen px-Wert aus einem CSS-Declaration-String. Akzeptiert reine
 * Zahlen mit "px" oder numerische Werte ohne Einheit (default px).
 * Gibt null zurück wenn kein px-Wert erkennbar.
 */
function parsePx(value) {
  if (!value) return null;
  const m = String(value).match(/(-?\d+(?:\.\d+)?)\s*(px)?/);
  if (!m) return null;
  return parseFloat(m[1]);
}

describe('Touch-Target-Contract (Issue #446 Welle 2a — 44×44 px)', () => {
  describe('.drill-prio-btn (Drill-Priorität-Kreis)', () => {
    it('erste Regel für .drill-prio-btn deklariert width ≥ 44px', () => {
      const css = loadCss();
      const rule = findRule(css, '.drill-prio-btn');
      expect(rule, '.drill-prio-btn Regel nicht gefunden').not.toBeNull();
      const w = parsePx(rule.width);
      expect(w, '.drill-prio-btn width nicht parsbar: ' + JSON.stringify(rule.width)).not.toBeNull();
      expect(w, '.drill-prio-btn width=' + rule.width + ' ist < 44px').toBeGreaterThanOrEqual(44);
    });

    it('erste Regel für .drill-prio-btn deklariert height ≥ 44px', () => {
      const css = loadCss();
      const rule = findRule(css, '.drill-prio-btn');
      expect(rule).not.toBeNull();
      const h = parsePx(rule.height);
      expect(h, '.drill-prio-btn height nicht parsbar: ' + JSON.stringify(rule.height)).not.toBeNull();
      expect(h, '.drill-prio-btn height=' + rule.height + ' ist < 44px').toBeGreaterThanOrEqual(44);
    });
  });

  describe('.tab-close (Tab-Schließen-Knopf)', () => {
    // Strategie: Trefferfläche ≥44×44. Erlaubt sind:
    //   a) width/height direkt ≥44, ODER
    //   b) width/height <44 ABER ein ::before/::after-Pseudo mit width/height
    //      ≥44 (Projekt-Pattern, vgl. .deim-remove), ODER
    //   c) width/height <44 ABER min-width/min-height ≥44
    function effectiveTouchSize(rule) {
      const w = parsePx(rule.width);
      const h = parsePx(rule.height);
      const minW = parsePx(rule.minWidth);
      const minH = parsePx(rule.minHeight);
      return {
        w: Math.max(w || 0, minW || 0),
        h: Math.max(h || 0, minH || 0),
        raw: rule,
      };
    }

    it('Trefferfläche .tab-close ist ≥44×44 (Pattern a/c: direkt, oder Pattern b: Pseudo-Element)', () => {
      const css = loadCss();
      const rule = findRule(css, '.tab-close');
      expect(rule, '.tab-close Regel nicht gefunden').not.toBeNull();
      const size = effectiveTouchSize(rule);
      // Pattern a oder c: width/height ≥44 ODER min-width/min-height ≥44
      if (size.w >= 44 && size.h >= 44) {
        // Pattern a/c erfüllt — Pseudo-Lösung nicht nötig.
        return;
      }
      // Pattern b: ::before/::after-Pseudo mit width/height ≥44 (Projekt-Pattern,
      // vgl. .deim-remove). Vertrag ist erfüllt, wenn das Pseudo die Trefferfläche
      // auf 44×44 erweitert. Dokumentation der Pseudo-Lösung: visuell kleines X
      // bleibt erhalten, das Pseudo ist "hit-only" (kein visueller Inhalt).
      const pseudoRule = findRule(css, /\.tab-close::(before|after)/);
      expect(pseudoRule, '.tab-close < 44px direkt UND kein ::before/::after-Pseudo mit 44px — Vertrag nicht erfüllt').not.toBeNull();
      const pw = parsePx(pseudoRule.width);
      const ph = parsePx(pseudoRule.height);
      expect(pw, '.tab-close Pseudo width nicht parsbar: ' + JSON.stringify(pseudoRule.width)).not.toBeNull();
      expect(ph, '.tab-close Pseudo height nicht parsbar: ' + JSON.stringify(pseudoRule.height)).not.toBeNull();
      expect(pw, '.tab-close Pseudo width=' + pw + 'px ist < 44px').toBeGreaterThanOrEqual(44);
      expect(ph, '.tab-close Pseudo height=' + ph + 'px ist < 44px').toBeGreaterThanOrEqual(44);
    });
  });

  describe('.entry-action (Referenzmuster, bereits 44×44)', () => {
    // Bewusst NICHT ändern (siehe Issue #446). Vertrag dokumentiert den
    // bestehenden Wert als Referenz für andere Touch-Target-Stellen.
    it('.entry-action bleibt bei width 44px (Referenz, nicht ändern)', () => {
      const css = loadCss();
      const rule = findRule(css, '.entry-action');
      expect(rule, '.entry-action Regel nicht gefunden').not.toBeNull();
      const w = parsePx(rule.width);
      const h = parsePx(rule.height);
      expect(w).toBe(44);
      expect(h).toBe(44);
    });
  });
});
