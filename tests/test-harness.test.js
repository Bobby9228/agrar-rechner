/**
 * Test-Harness-Vertrag — Issue #444 (Welle 1)
 *
 * Diese Suite schützt den Vertrag zwischen tests/helpers.js (Test-Harness)
 * und public/js/main.js (Production-Bootstrap) ab. Vier Garantien:
 *
 *   A) Bootstrap-Strip ist robust:
 *      helpers.js entfernt den DOMContentLoaded-Listener aus main.js NICHT
 *      über eine fragile String-Konstante, sondern über einen
 *      prüfbar benannten Mechanismus. Wenn main.js den Bootstrap-Pfad
 *      ändert und die Strip-Vorlage nicht mehr matcht, schlägt der
 *      Test rot — die Strip-Funktion fällt NICHT still auf "nichts
 *      ersetzt" zurück (genau dieser Bug ist Issue #444).
 *
 *   B) Genau eine Initialisierung pro createDom():
 *      Die Coordinator-Registrierung und alle UI-Bindings laufen
 *      pro DOM genau einmal — auch dann, wenn initUI() versehentlich
 *      zweimal aufgerufen wird (z. B. wenn jsdom in einer späteren
 *      Version DOMContentLoaded feuern sollte).
 *
 *   C) Genau ein Storage-Listener:
 *      Ein synthetisches storage-Event triggert genau EINEN
 *      parseAndSanitizeState-Aufruf. Ohne diese Garantie würde der
 *      Cross-Tab-Sync-Pfad bei doppelter Initialisierung doppelt
 *      parsen (und ggf. doppelt persistieren).
 *
 *   D) Modul-Reihenfolge-Kongruenz:
 *      Die Modul-Ladefolge in public/index.html und in
 *      tests/helpers.js (MODULE_LOAD_ORDER) stimmen exakt überein —
 *      keine Lücken, keine Vertauschungen, keine Duplikate.
 *
 * Außerhalb dieser Welle (Welle 2+): Versionspins, Mitternachtsfälle,
 * Provenienzkommentare, Test-Dedup. Bewusst nicht hier.
 */

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BOOTSTRAP_STRIP_RE, MODULE_LOAD_ORDER, createDom } from './helpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');
const indexPath = resolve(publicDir, 'index.html');
const mainPath = resolve(publicDir, 'js', 'main.js');
const helpersPath = resolve(__dirname, 'helpers.js');

function readIndexScripts(htmlContent) {
  // Exakt dieselbe Extraktion wie in tests/deploy-sanity.test.js und
  // tests/app-shell-parity.test.js — wir wollen Quellen-Kongruenz und
  // keine neue Parser-Variante.
  const re = /<script\s+src=["']js\/([^"']+)["']\s*><\/script>/g;
  const out = [];
  let m;
  while ((m = re.exec(htmlContent)) !== null) out.push(m[1].split('?')[0]);
  return out;
}

describe('Issue #444 A — Bootstrap-Strip aus main.js ist robust gegen Code-Drift', () => {
  it('helpers.js exportiert eine BOOTSTRAP_STRIP_RE-Konstante', () => {
    // Die Strip-Vorlage MUSS exportiert werden, damit der Test sie gegen
    // den aktuellen main.js-Source prüfen kann. Vor #444 stand an dieser
    // Stelle ein fixer String, der bei der ersten Änderung des Bootstrap-
    // Blocks still nichts ersetzt hätte.
    expect(BOOTSTRAP_STRIP_RE, 'helpers.js muss BOOTSTRAP_STRIP_RE exportieren').toBeInstanceOf(RegExp);
  });

  it('BOOTSTRAP_STRIP_RE matcht den aktuellen DOMContentLoaded-Block in main.js', () => {
    // Wenn diese Assertion RED schlägt, hat sich der Production-Bootstrap
    // geändert und helpers.js entfernt den DOMContentLoaded-Listener nicht
    // mehr — Test-DOMs würden initUI doppelt ausführen, sobald jsdom
    // DOMContentLoaded feuert (oder bei manueller Replay).
    const mainContent = readFileSync(mainPath, 'utf-8');
    expect(
      BOOTSTRAP_STRIP_RE.test(mainContent),
      'BOOTSTRAP_STRIP_RE matcht den aktuellen main.js-Bootstrap nicht — ' +
      'helpers.js würde den DOMContentLoaded-Listener nicht entfernen und ' +
      'initUI bei createDom() doppelt laufen lassen. main.js prüfen und ' +
      'entweder das Pattern in helpers.js nachziehen oder den Bootstrap-Pfad ' +
      'in main.js stabilisieren.'
    ).toBe(true);
  });

  it('BOOTSTRAP_STRIP_RE ist auf den benannten Bootstrap _appBootstrap verankert', () => {
    // Statische Robustheitsprobe: das Pattern muss die zwei semantischen
    // Anker enthalten, damit ein zukünftiger Refactor (Umbenennung des
    // Bootstrap-Funktion oder Wechsel zu addEventListener mit anderer
    // Signatur) den Test rot macht — BEVOR der Strip in helpers.js
    // unbemerkt versagt. Der Anker heißt _appBootstrap (siehe
    // public/js/main.js) und löst die frühere Bindung an die inline-
    // initUI-Definition ab.
    const patternSrc = BOOTSTRAP_STRIP_RE.source;
    expect(patternSrc, 'Pattern muss DOMContentLoaded verankern').toMatch(/DOMContentLoaded/);
    expect(patternSrc, 'Pattern muss den benannten Bootstrap _appBootstrap verankern').toMatch(/_appBootstrap/);
  });

  it('BOOTSTRAP_STRIP_RE lässt den Hauptteil von main.js intakt', () => {
    // Schutz gegen über-eifrige Patterns (z. B. /[\s\S]+/), die versehentlich
    // App-Konstanten oder Helpers wegradierten. Nach dem Strip müssen
    // APP_VERSION, parseDE und der Service-Worker-Block noch existieren.
    const mainContent = readFileSync(mainPath, 'utf-8');
    const stripped = mainContent.replace(BOOTSTRAP_STRIP_RE, '');
    expect(stripped, 'APP_VERSION darf nicht mit weggeStrippt werden').toMatch(/APP_VERSION\s*=\s*['"]v1\.1\.6['"]/);
    expect(stripped, 'parseDE-Helper darf nicht mit weggeStrippt werden').toMatch(/function\s+parseDE\s*\(/);
    expect(stripped, 'Service-Worker-Registrierung darf nicht mit weggeStrippt werden').toMatch(/serviceWorker\.register\s*\(\s*['"]sw\.js['"]/);
  });
});

describe('Issue #444 B — Genau eine Initialisierung pro createDom()-DOM', () => {
  let w;
  beforeEach(() => {
    const result = createDom();
    w = result.window;
  });

  it('Coordinator-Registrierung läuft pro createDom()-DOM genau einmal', () => {
    // Vor #444: helpers.js rief initUI() einmal manuell, aber die
    // DOMContentLoaded-Liste in main.js war noch aktiv (String-Strip
    // griff nicht mehr). Heute schützt jsdom davor, dass DOMContentLoaded
    // gefeuert wird; sobald das ändert sich, hätten wir eine Doppel-
    // Registrierung. Diese Probe prüft deshalb explizit, dass auch ein
    // zweiter Aufruf von initUI() KEINE zweite Coordinator-Registrierung
    // auslöst.
    expect(w.AppGlobals._stateCoordinatorRegistered, 'Coordinator muss nach createDom registriert sein').toBe(true);

    // Wir spionieren die Brücke appOnStateChange — registerStateCoordinator
    // läuft über genau diesen Einstieg.
    const spy = vi.spyOn(w.AppGlobals, 'appOnStateChange');
    w.AppGlobals.initUI();
    expect(
      spy,
      'Zweiter initUI()-Aufruf hat eine weitere Coordinator-Registrierung ' +
      'ausgelöst — der Idempotenz-Guard in registerStateCoordinator greift ' +
      'nicht oder die Strip-Vorlage hat den DOMContentLoaded-Listener nicht ' +
      'entfernt (siehe Test 444-A).'
    ).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('UI-Bindings werden pro createDom()-DOM genau einmal registriert', () => {
    // initUIBindings (main.js) ist idempotent via AppGlobals._uiBindingsRegistered.
    // Ein zweiter initUI()-Aufruf darf KEINE weiteren DOM-Event-Listener
    // (theme-toggle-Click, Footer-Reset-Click, ...) anhängen. Wir zählen
    // dazu die Click-Listener am #dashboard_open_btn — wenn der Body
    // erneut läuft, würde _bindClick einen weiteren Handler anhaengen.
    expect(w.AppGlobals._uiBindingsRegistered, 'initUIBindings muss nach createDom gelaufen sein').toBe(true);

    const dashBtn = w.document.getElementById('dashboard_open_btn');
    expect(dashBtn, 'Voraussetzung: #dashboard_open_btn muss im DOM sein').toBeTruthy();
    let clickAdds = 0;
    const origAdd = dashBtn.addEventListener.bind(dashBtn);
    dashBtn.addEventListener = function (type, ...rest) {
      if (type === 'click') clickAdds++;
      return origAdd(type, ...rest);
    };

    w.AppGlobals.initUI();
    expect(
      clickAdds,
      'Zweiter initUI()-Aufruf hat einen weiteren Click-Listener auf ' +
      '#dashboard_open_btn angehängt — Idempotenz-Guard ' +
      '(_uiBindingsRegistered) greift nicht oder der Strip hat den ' +
      'DOMContentLoaded-Listener nicht entfernt.'
    ).toBe(0);
  });

  it('Coordinator feuert pro appEmit genau einmal (Sanity-Check)', () => {
    // Verwandter Garantie-Test: ein einzelnes appEmit darf nach
    // createDom() nicht doppelt durch den Coordinator laufen — sonst
    // hätten wir Doppel-Persistenz. Gehört thematisch zum selben Block.
    const saveSpy = vi.spyOn(w.AppGlobals, 'saveState');
    w.appEmit('TAB_RENAMED', { tabIdx: 0 });
    expect(saveSpy, 'Coordinator muss genau einen saveState pro appEmit auslösen').toHaveBeenCalledTimes(1);
    saveSpy.mockRestore();
  });
});

describe('Issue #444 C — Genau ein Storage-Listener pro createDom()-DOM', () => {
  let w;
  beforeEach(() => {
    const result = createDom();
    w = result.window;
  });

  function fireStorageEvent(newRemote) {
    const event = new w.Event('storage');
    event.key = 'agrar_rechner';
    event.newValue = JSON.stringify(newRemote);
    event.oldValue = null;
    event.storageArea = w.localStorage;
    w.dispatchEvent(event);
  }

  it('ein storage-Event → genau ein parseAndSanitizeState-Aufruf', () => {
    // Direkter Pfad: heute verhindert jsdom, dass DOMContentLoaded feuert,
    // also läuft initUI nur einmal → 1 Listener → 1 parseAndSanitize-Call.
    // Wir zählen trotzdem explizit, damit eine Regression (z. B. ein
    // Refactor, der zwei Listener anhängt) sofort rot auffällt.
    const parseSpy = vi.spyOn(w.AppGlobals, 'parseAndSanitizeState');
    const remote = JSON.parse(JSON.stringify(w.state));
    remote.reiter[0].hektar = 12.5;
    fireStorageEvent(remote);
    expect(
      parseSpy,
      'storage-Event muss genau einen parseAndSanitizeState-Aufruf auslösen'
    ).toHaveBeenCalledTimes(1);
    parseSpy.mockRestore();
  });

  it('auch nach nachträglichem DOMContentLoaded-Replay bleibt es bei genau einem Listener', () => {
    // Der eigentliche Issue-Probe: helpers.js entfernt den DOMContentLoaded-
    // Listener aus main.js, damit er bei einem jsdom-Replay nicht ein
    // zweites initUI() auslöst. Wenn der Strip versagt, hängen zwei
    // Listener an 'storage' und parseAndSanitizeState läuft zweimal.
    //
    // Wir simulieren den jsdom-Replay MANUELL (heute feuert jsdom das
    // Event nicht — der Replay macht den Test unabhängig davon).
    const replayed = new w.Event('DOMContentLoaded');
    w.document.dispatchEvent(replayed);

    const parseSpy = vi.spyOn(w.AppGlobals, 'parseAndSanitizeState');
    const remote = JSON.parse(JSON.stringify(w.state));
    remote.reiter[0].hektar = 13.5;
    fireStorageEvent(remote);
    expect(
      parseSpy,
      'Nach DOMContentLoaded-Replay muss es weiterhin genau EIN ' +
      'parseAndSanitizeState-Aufruf sein. Bei zwei Aufrufen hat der ' +
      'Strip in helpers.js versagt — entweder Pattern in BOOTSTRAP_STRIP_RE ' +
      'passt nicht mehr auf main.js oder initUI() legt pro Aufruf einen ' +
      'neuen storage-Listener an.'
    ).toHaveBeenCalledTimes(1);
    parseSpy.mockRestore();
  });
});

describe('Issue #444 D — Modul-Ladefolge aus index.html und tests/helpers.js sind kongruent', () => {
  it('helpers.js exportiert MODULE_LOAD_ORDER als Array', () => {
    expect(Array.isArray(MODULE_LOAD_ORDER), 'helpers.js muss MODULE_LOAD_ORDER als Array exportieren').toBe(true);
    expect(MODULE_LOAD_ORDER.length, 'MODULE_LOAD_ORDER darf nicht leer sein').toBeGreaterThan(0);
  });

  it('MODULE_LOAD_ORDER deckt alle <script src>-Eintraege aus index.html ab (Vollständigkeit)', () => {
    const indexContent = readFileSync(indexPath, 'utf-8');
    const loaded = readIndexScripts(indexContent);
    for (var i = 0; i < loaded.length; i++) {
      expect(
        MODULE_LOAD_ORDER,
        'fehlt in MODULE_LOAD_ORDER: ' + loaded[i] + ' — sonst lädt der ' +
        'Test-Harness die App-Shell nicht 1:1 wie Production.'
      ).toContain(loaded[i]);
    }
  });

  it('MODULE_LOAD_ORDER enthält kein Modul, das nicht in index.html steht (keine Altlasten)', () => {
    const indexContent = readFileSync(indexPath, 'utf-8');
    const loaded = new Set(readIndexScripts(indexContent));
    for (var i = 0; i < MODULE_LOAD_ORDER.length; i++) {
      expect(
        loaded.has(MODULE_LOAD_ORDER[i]),
        'MODULE_LOAD_ORDER enthaelt ' + MODULE_LOAD_ORDER[i] + ', das in ' +
        'index.html nicht (mehr) geladen wird — Altlast im Test-Harness.'
      ).toBe(true);
    }
  });

  it('Reihenfolge in MODULE_LOAD_ORDER ist identisch zu index.html', () => {
    const indexContent = readFileSync(indexPath, 'utf-8');
    const loaded = readIndexScripts(indexContent);
    expect(
      MODULE_LOAD_ORDER,
      'Reihenfolge MODULE_LOAD_ORDER muss 1:1 der <script src>-Reihenfolge ' +
      'in index.html entsprechen (siehe helpers.js / AGENTS.md §4).'
    ).toEqual(loaded);
  });

  it('jeder Eintrag ist ein nicht-leerer Modul-Dateiname ohne Pfad-Präfix', () => {
    for (var i = 0; i < MODULE_LOAD_ORDER.length; i++) {
      var entry = MODULE_LOAD_ORDER[i];
      expect(typeof entry, 'Eintrag muss String sein').toBe('string');
      expect(entry.length, 'Eintrag darf nicht leer sein').toBeGreaterThan(0);
      expect(entry, 'Eintrag darf kein "js/"-Präfix enthalten').not.toMatch(/^js\//);
      expect(entry, 'Eintrag darf keine Query-Versionierung enthalten').not.toMatch(/\?v=/);
      expect(entry, 'Eintrag muss auf .js enden').toMatch(/\.js$/);
    }
  });

  it('keine Duplikate in MODULE_LOAD_ORDER', () => {
    var seen = new Set();
    var dups = [];
    for (var i = 0; i < MODULE_LOAD_ORDER.length; i++) {
      if (seen.has(MODULE_LOAD_ORDER[i])) dups.push(MODULE_LOAD_ORDER[i]);
      seen.add(MODULE_LOAD_ORDER[i]);
    }
    expect(dups, 'Duplikate in MODULE_LOAD_ORDER: ' + dups.join(', ')).toEqual([]);
  });
});
