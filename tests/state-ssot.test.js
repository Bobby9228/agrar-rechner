/**
 * Issue #447 — State- und Berechnungslogik konsolidieren (Welle 1).
 *
 * Vier SSOT-Konsolidierungen, jeweils als isolierter describe-Block:
 *
 *   1. EVENT_PLAN-SSOT
 *      Die EVENT_PLAN-Tabelle in public/js/state-coordinator.js darf KEINE
 *      Cases enthalten, die in der Produktion nicht per appEmit angestoßen
 *      werden (umgekehrt: jedes appEmit braucht einen Plan-Eintrag).
 *      Drei tote Cases (ENTRY_ADDED, ENTRY_REMOVED, CALCULATION_DONE) sind
 *      zu entfernen.
 *
 *   2. EPSILON_EINHEIT-SSOT
 *      Die Saat-Epsilon-Schwelle lebt als AppGlobals.EPSILON_EINHEIT
 *      (public/js/calculations.js). Andere Module — insbesondere
 *      render-local-protocol.js — müssen diese Konstante über
 *      AppGlobals.EPSILON_EINHEIT konsumieren und dürfen das rohe
 *      Literal 0.0005 nicht selbst führen.
 *
 *   3. Raps-Default 1.500.000 — SSOT zwischen culture.js und state.js
 *      Der Wert 1.500.000 für raps-defaultKoernerProEinheit lebt semantisch
 *      in culture.js (CULTURE_PROFILES.raps.defaultKoernerProEinheit).
 *      state.js (Migration 6→7) liest denselben Wert — beide Stellen müssen
 *      auf IDENTISCHE Konstante zeigen.
 *
 *   4. DEFAULT_KOERNER_PRO_EINHEIT — Mais-Default 50.000 SSOT
 *      Der Mais-Backstop/default (50.000 Körner pro Einheit) lebt als
 *      zentrale Konstante DEFAULT_KOERNER_PRO_EINHEIT in state.js,
 *      exportiert über AppGlobals. Alle Produktions-Literale — Migrationen,
 *      initial state, reset-state-default, calculations-Backstop, Tab- und
 *      Editor-Defaults — werden auf diese Konstante zurückgeführt.
 *
 * jsdom-Hinweis: rohe DOM-Knoten in toBe/toContain würden den Vitest-Diff-
 * Drucker crashen — daher nur Identitäts- bzw. Primitive-Assertions.
 */
import { readFileSync, readdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { createDom } from './helpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');
const jsDir = resolve(publicDir, 'js');

function readModule(name) {
  return readFileSync(resolve(jsDir, name), 'utf-8');
}

// ---------------------------------------------------------------------------
// (1) EVENT_PLAN ↔ appEmit Konsistenz (Welle 1.1)
// ---------------------------------------------------------------------------

describe('Issue #447 Welle 1.1 — EVENT_PLAN ↔ appEmit Konsistenz', () => {
  // Bekannte erlaubte appEmit-Eventnamen in Produktion (per grep über alle
  // public/js/*.js — abgesehen von state-coordinator.js selbst, das den
  // EVENT_PLAN definiert). Diese Liste ist die manuelle Soll-Liste; die
  // Datei-Scan-Assertions untengen prüfen die Liste zudem programmatisch
  // über Quellcode-Muster.
  const PROD_APP_EMIT_LITERALS = [
    'TAB_CHANGED', 'TAB_ADDED', 'TAB_REMOVED', 'TAB_RENAMED',
    'TAB_RESET', 'RESET_ALL',
    'ENTRY_CHANGED',
    'SETTINGS_CHANGED',
    'VIEW_CHANGED',
    'PROTOCOL_VIEW_CHANGED', 'PROTOCOL_ACCORDION_TOGGLED',
    'DRILL_ENTRY_ADDED', 'DRILL_ENTRY_REMOVED',
    'DRILL_PRIORITY_CHANGED', 'DRILL_DONE_CHANGED',
    'DASHBOARD_OPENED', 'DASHBOARD_CLOSED',
    'KULTUR_CHANGED',
  ];

  // Tote Cases, die in EVENT_PLAN standen aber NIE emittet werden.
  // Diese Assertion schützt gegen versehentliches Wiedereinführen.
  const FORBIDDEN_DEAD_CASES = [
    'ENTRY_ADDED',
    'ENTRY_REMOVED',
    'CALCULATION_DONE',
  ];

  it('to appEmit-Literale in public/js/*.js stimmen mit der Soll-Liste überein', () => {
    // Statischer Quellcode-Grep: alle "appEmit('XXX', ...)" Vorkommen in
    // jedem Modul sammeln — state-coordinator.js wird ausgenommen, weil
    // dort keine appEmit-Calls liegen (nur appDispatch-Konsumenten).
    const files = readdirSync(jsDir).filter((f) => f.endsWith('.js') && f !== 'state-coordinator.js');
    const found = new Set();
    const re = /\.appEmit\(\s*['"]([A-Z_]+)['"]/g;
    for (const f of files) {
      const src = readModule(f);
      let m;
      while ((m = re.exec(src)) !== null) found.add(m[1]);
    }
    const expected = new Set(PROD_APP_EMIT_LITERALS);
    const missing = [...expected].filter((k) => !found.has(k));
    const unexpected = [...found].filter((k) => !expected.has(k));
    expect(missing, 'appEmit-Literale fehlen im Quellcode (sollte vorkommen): ' + missing.join(', ')).toEqual([]);
    expect(unexpected, 'unerwartete appEmit-Literale im Quellcode: ' + unexpected.join(', ')).toEqual([]);
  });

  it('EVENT_PLAN enthält keine der früheren toten Cases (ENTRY_ADDED/ENTRY_REMOVED/CALCULATION_DONE)', () => {
    const w = createDom().window;
    const plan = w.AppGlobals.getEventPlan();
    for (const dead of FORBIDDEN_DEAD_CASES) {
      expect(plan[dead], 'Toter Case ' + dead + ' ist noch im EVENT_PLAN — sollte entfernt sein').toBeUndefined();
    }
  });

  it('EVENT_PLAN-Cases (live) sind eine Teilmenge der in appEmit-Literalen vorkommenden Cases', () => {
    // Set-Gleichheit in dieser Richtung: jeder EVENT_PLAN-Case muss im
    // appEmit-Grep auftauchen. Umgekehrt ist die Frage "gibt es appEmit-
    // Cases ohne Plan-Eintrag?" — die beantwortet der obige Test.
    const w = createDom().window;
    const plan = w.AppGlobals.getEventPlan();
    const planKeys = Object.keys(plan);
    const files = readdirSync(jsDir).filter((f) => f.endsWith('.js') && f !== 'state-coordinator.js');
    const found = new Set();
    const re = /\.appEmit\(\s*['"]([A-Z_]+)['"]/g;
    for (const f of files) {
      const src = readModule(f);
      let m;
      while ((m = re.exec(src)) !== null) found.add(m[1]);
    }
    const planNotEmitted = planKeys.filter((k) => !found.has(k));
    expect(
      planNotEmitted,
      'EVENT_PLAN-Cases ohne appEmit-Vorkommen in Produktion: ' + planNotEmitted.join(', ')
    ).toEqual([]);
  });

  it('Datei-Header-Dokumentation in state-coordinator.js listet keine toten Cases mehr', () => {
    // Wortgrenzen-Check, damit DRILL_ENTRY_ADDED nicht fälschlich als
    // "ENTRY_ADDED-Rest" gewertet wird. Wir suchen Treffer gefolgt von
    // Whitespace oder Komma (typische Doku-/Plan-Trenner).
    const src = readModule('state-coordinator.js');
    for (const dead of FORBIDDEN_DEAD_CASES) {
      const re = new RegExp('(^|[^A-Z_])' + dead + '(\\s|,|$)');
      const stillThere = re.test(src);
      expect(stillThere, 'Header-Doku/Plan enthält noch ' + dead).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// (2) EPSILON_EINHEIT-SSOT (Welle 1.2)
// ---------------------------------------------------------------------------

describe('Issue #447 Welle 1.2 — EPSILON_EINHEIT als zentrale Saat-Epsilon-Schwelle', () => {
  it('AppGlobals.EPSILON_EINHEIT ist definiert und finit positiv', () => {
    const w = createDom().window;
    const eps = w.AppGlobals.EPSILON_EINHEIT;
    expect(typeof eps, 'EPSILON_EINHEIT fehlt auf AppGlobals').toBe('number');
    expect(isFinite(eps), 'EPSILON_EINHEIT muss finit sein').toBe(true);
    expect(eps > 0, 'EPSILON_EINHEIT muss > 0 sein (Saat-Schwelle)').toBe(true);
  });

  it('render-local-protocol.js enthält das rohe Literal 0.0005 NICHT mehr', () => {
    // Quell-Assert: das Saat-Epsilon wird zentral aus calculations.js
    // (EPSILON_EINHEIT) über AppGlobals bezogen, nicht als dupliziertes
    // Literal in der Render-Schicht. Zeilenkommentare werden vorher
    // entfernt (dort darf „0,0005"/„0.0005" als Doku stehen) und
    // Dezimakommata normalisiert, damit die deutsche Schreibweise den
    // Check nicht umgeht (Review-Hinweis #447 Welle 1).
    const src = readModule('render-local-protocol.js')
      .split('\n')
      .map(function (line) { return line.replace(/\/\/.*$/, ''); })
      .join('\n')
      .replace(/,/g, '.');
    expect(
      src.includes('0.0005'),
      'render-local-protocol.js darf das rohe Saat-Epsilon-Literal nicht mehr enthalten — nutze AppGlobals.EPSILON_EINHEIT aus calculations.js'
    ).toBe(false);
  });

  it('render-local-protocol.js referenziert AppGlobals.EPSILON_EINHEIT explizit', () => {
    // Positiv-Gegenprobe: das Modul MUSS die zentrale Konstante verwenden.
    const src = readModule('render-local-protocol.js');
    expect(
      src.includes('EPSILON_EINHEIT'),
      'render-local-protocol.js muss AppGlobals.EPSILON_EINHEIT referenzieren'
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (3) Raps-Default 1.500.000 — SSOT zwischen culture.js und state.js
//     (Welle 1.3)
// ---------------------------------------------------------------------------

describe('Issue #447 Welle 1.3 — Raps-Default 1.500.000 als SSOT', () => {
  it('culture.js: Raps-Default ist 1.500.000 (über CULTURE_PROFILES.raps.defaultKoernerProEinheit)', () => {
    const w = createDom().window;
    const p = w.getCultureProfile('raps');
    expect(p.defaultKoernerProEinheit).toBe(1500000);
    expect(w.getDefaultKoernerProEinheit('raps')).toBe(1500000);
  });

  it('Raps-Default-Konstante ist über AppGlobals exponiert', () => {
    const w = createDom().window;
    expect(w.AppGlobals.RAPS_DEFAULT_KOERNER_PRO_EINHEIT).toBe(1500000);
  });

  it('Raps-Default-Konstante ist IDENTISCH mit CULTURE_PROFILES.raps.defaultKoernerProEinheit', () => {
    // Identitäts-Assertion (===), kein Wert-Vergleich — die Konstante MUSS
    // semantisch die Quelle sein, nicht nur zufällig denselben Wert haben.
    const w = createDom().window;
    const profileDefault = w.getCultureProfile('raps').defaultKoernerProEinheit;
    const exportedConst = w.AppGlobals.RAPS_DEFAULT_KOERNER_PRO_EINHEIT;
    const identical = exportedConst === profileDefault;
    expect(identical, 'AppGlobals.RAPS_DEFAULT_KOERNER_PRO_EINHEIT muss === CULTURE_PROFILES.raps.defaultKoernerProEinheit sein').toBe(true);
  });

  it('Migration 6→7 — Raps-Default eines unberührten Startschlags kommt aus der SSOT-Konstante', () => {
    // Historical-Migration-Semantik: ein Raps-Nutzer, dessen erster Schlag
    // noch auf dem Mais-Default 50.000 steht (keine echten Eingaben, kein
    // done), bekommt tab.koernerProEinheit aus der SSOT-Konstante, nicht
    // aus einem duplizierten Literal. Funktional bleibt das Ergebnis
    // exakt dasselbe (1.500.000 für Raps).
    const w = createDom().window;
    const snapshot = {
      reiter: [{
        name: 'Schlag 1',
        hektar: 0, istHektar: 0, koerner: 0, duenger: 0,
        entries: [],
        done: false,
        koernerProEinheit: 50000
      }],
      activeReiter: 0,
      _lv: 6,
      kultur: 'raps',
      erstauswahlDone: true
    };
    w.localStorage.setItem('agrar_rechner', JSON.stringify(snapshot));
    w.loadState();
    const migrated = w.state.reiter[0].koernerProEinheit;
    // migrated muss identisch mit der SSOT-Konstante sein, nicht "zufällig gleich"
    const isSameConst = migrated === w.AppGlobals.RAPS_DEFAULT_KOERNER_PRO_EINHEIT;
    expect(isSameConst, 'Migration muss die SSOT-Konstante benutzen').toBe(true);
    expect(migrated).toBe(1500000);
  });
});

// ---------------------------------------------------------------------------
// (4) DEFAULT_KOERNER_PRO_EINHEIT — Mais-Default 50.000 SSOT (Welle 1.4)
// ---------------------------------------------------------------------------

describe('Issue #447 Welle 1.4 — DEFAULT_KOERNER_PRO_EINHEIT als Mais-Backstop-SSOT', () => {
  it('AppGlobals.DEFAULT_KOERNER_PRO_EINHEIT ist definiert und === 50.000', () => {
    const w = createDom().window;
    expect(w.AppGlobals.DEFAULT_KOERNER_PRO_EINHEIT).toBe(50000);
  });

  it('Initial-state in state.js liest DEFAULT_KOERNER_PRO_EINHEIT (Tab 0 + Global)', () => {
    const w = createDom().window;
    // Nach Frischstart (kein localStorage): Tab-Default UND global-default
    // kommen aus derselben Konstante.
    expect(w.state.reiter[0].koernerProEinheit).toBe(w.AppGlobals.DEFAULT_KOERNER_PRO_EINHEIT);
    expect(w.state.koernerProEinheit).toBe(w.AppGlobals.DEFAULT_KOERNER_PRO_EINHEIT);
  });

  it('calculations.js Backstop nutzt DEFAULT_KOERNER_PRO_EINHEIT', () => {
    // Wenn weder expliziter Parameter noch r.koernerProEinheit noch
    // globaler State gesetzt sind, fällt resolveKoernerProEinheit auf den
    // Mais-Default zurück. Wir prüfen, dass der Wert der SSOT-Konstante
    // entspricht — nicht einem duplizierten Literal.
    const w = createDom().window;
    // globalen State so leeren, dass keiner der ersten drei Quellen greift
    // (delete → undefined → isFinite schlägt fehl → Backstop läuft).
    delete w.state.koernerProEinheit;
    // Tab ohne koernerProEinheit aufrufen
    const r = { hektar: 1, koerner: 1, duenger: 0, istHektar: 0, entries: [] };
    // resolveKoernerProEinheit kommt über AppGlobals
    const got = w.AppGlobals.resolveKoernerProEinheit(r);
    const isSameConst = got === w.AppGlobals.DEFAULT_KOERNER_PRO_EINHEIT;
    expect(isSameConst, 'calculations.js-Backstop muss DEFAULT_KOERNER_PRO_EINHEIT liefern').toBe(true);
    expect(got).toBe(50000);
  });

  it('Migrations-Default in state.js (3→4) liest DEFAULT_KOERNER_PRO_EINHEIT', () => {
    // Pre-Issue-#445 Snapshot ohne koernerProEinheit: Migration muss
    // SSOT-Konstante setzen, nicht Literal.
    const w = createDom().window;
    const snapshot = {
      reiter: [{ name: 'S', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false }],
      activeReiter: 0,
      _lv: 3,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0
      // koernerProEinheit fehlt absichtlich
    };
    w.localStorage.setItem('agrar_rechner', JSON.stringify(snapshot));
    w.loadState();
    const isSameConst = w.state.koernerProEinheit === w.AppGlobals.DEFAULT_KOERNER_PRO_EINHEIT;
    expect(isSameConst, 'Migration 3→4 muss SSOT-Konstante setzen').toBe(true);
    expect(w.state.koernerProEinheit).toBe(50000);
  });

  it('Identitäts-Assertion: alle konstanten Quellen zeigen auf denselben Wert', () => {
    // Sanity: AppGlobals.DEFAULT_KOERNER_PRO_EINHEIT === culture.mais Default ===
    // Berechnungs-Backstop. Wenn das mal divergiert, ist's ein Bug.
    const w = createDom().window;
    const a = w.AppGlobals.DEFAULT_KOERNER_PRO_EINHEIT;
    const b = w.AppGlobals.getCultureProfile('mais').defaultKoernerProEinheit;
    const c = w.AppGlobals.getDefaultKoernerProEinheit('mais');
    expect(a === b && b === c, 'DEFAULT_KOERNER_PRO_EINHEIT muss mit Mais-Profil-Default identisch sein').toBe(true);
  });
});
