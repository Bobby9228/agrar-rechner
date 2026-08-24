/**
 * Date-Boundary / Mitternachtsfälle — Issue #444 Welle 2
 *
 * deterministische Tests für zeitabhängiges Verhalten der Pure-Helper in
 * public/js/calculations.js. Vor #444 hingen die Tests an der realen
 * Systemzeit: bei einem Lauf um 23:59 hätte `parseEntryDateKey("00:00")`
 * genau einmal pro Tag das richtige Datum geliefert und sonst den nächsten
 * Tag. Die Tests waren also potenziell flaky (grenzwertige CI-Runner)
 * oder nicht-deterministisch (lokal 23:59, CI 02:00). Hier wird die
 * Zeit kontrolliert:
 *
 *   - Test (a): Entry "23:59" VOR Mitternacht vs. "00:00" NACH Mitternacht
 *     → dateKey wechselt auf den neuen Tag (Kern-Szenario "Führungsbuch
 *     über Mitternacht", Landwirt tippt spät und am nächsten Morgen).
 *   - Test (b): formatEntryTimeHHMM kürzt "HH:MM:SS" korrekt auf "HH:MM"
 *     und akzeptiert einstellige Stunden durch Zero-Padding.
 *   - Test (c): getTabNextTime liefert max(now, last.time + 1) — auch wenn
 *     last.time in der Zukunft liegt (Clock-Skew, Geräte-Uhr nachgestellt).
 *
 * Strategie für Zeitkontrolle:
 *   vitest `vi.setSystemTime` patcht globalThis.Date, aber jsdom hat eine
 *   EIGENE Date-Implementierung in seinem Window-Scope, die NICHT von
 *   globalThis erbt (verifiziert in einer vorherigen Probe). Da die
 *   App-Module via `dom.window.eval()` in den jsdom-Scope geladen werden,
 *   wirkt eine globale Mock nicht. Stattdessen überschreiben wir window.Date
 *   (Strategy B) — damit sehen ALLE `new Date()` und `Date.now()`-Aufrufe
 *   innerhalb des App-Codes den kontrollierten Zeitpunkt. Das ist lokal
 *   und wird im afterEach wiederhergestellt.
 *
 *   KEINE Produktions-Code-Änderung nötig: AppGlobals._dateKeyFromDate /
 *   parseEntryDateKey / getTabNextTime sind pure und über das Window
 *   erreichbar.
 *
 *   Zeitumstellungssicherheit ist NICHT Teil des Scopes (per Issue #444
 *   Spec) — keine TZ-Wechsel-Tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDom } from './helpers.js';

/**
 * Setzt window.Date in jsdom auf einen festen Zeitpunkt.
 *
 * Implementiert einen minimalen Date-Wrapper, der new Date() ohne Argumente
 * und Date.now() auf den gewünschten Zeitpunkt fixiert. Alle anderen
 * Date-Funktionen (parse/UTC/Konstruktor mit Argument) delegieren an die
 * echte Date-Klasse. Backup wird am window-Objekt abgelegt, damit
 * restoreWindowDate den Originalzustand wiederherstellen kann.
 *
 * @param {Window} w   jsdom-Window (z.B. createDom().window)
 * @param {string} iso ISO-String des Zeitpunkts (lokale Zeit, nicht UTC)
 */
function setWindowDate(w, iso) {
  if (!w.__origDate) w.__origDate = w.Date;
  function FakeDate(arg) {
    if (arg === undefined || arg === null) return new w.__origDate(iso);
    return new w.__origDate(arg);
  }
  FakeDate.now = function () { return new w.__origDate(iso).getTime(); };
  FakeDate.parse = w.__origDate.parse;
  FakeDate.UTC = w.__origDate.UTC;
  // prototype-Kette: Instanzen müssen `instanceof FakeDate` und
  // `instanceof Date` (Original) tragen. getHours/getDate greifen via
  // prototype auf das delegierte Date-Objekt zu.
  FakeDate.prototype = w.__origDate.prototype;
  w.Date = FakeDate;
}

function restoreWindowDate(w) {
  if (w.__origDate) {
    w.Date = w.__origDate;
    delete w.__origDate;
  }
}

describe('Issue #444 Welle 2 — Date-Boundary / Mitternachtsfälle (deterministisch)', () => {
  let w;

  beforeEach(() => {
    w = createDom().window;
  });

  afterEach(() => {
    restoreWindowDate(w);
  });

  // ───────────────── (a) Kern-Szenario "Führungsbuch über Mitternacht" ────────
  describe('parseEntryDateKey: 23:59 → 00:00 Mitternachtswechsel', () => {
    it('kurz VOR Mitternacht: "23:59" liefert heutiges Datum (2026-08-15)', () => {
      setWindowDate(w, '2026-08-15T23:59:00');
      var key = w.parseEntryDateKey('23:59');
      expect(key).toBe('2026-08-15');
    });

    it('kurz NACH Mitternacht: "00:00" liefert NEUES Datum (2026-08-16)', () => {
      // Landwirt tippt am nächsten Morgen — selbe Logik, anderer Tag.
      setWindowDate(w, '2026-08-16T00:00:30');
      var key = w.parseEntryDateKey('00:00');
      expect(key).toBe('2026-08-16');
    });

    it('"HH:MM:SS" an Mitternacht: 23:59:59 bleibt VOR, 00:00:00 ist NACH', () => {
      // Mit Sekunden-Wert zusätzlich verifiziert — der Helper trimmt die
      // Sekunden für die Datums-Berechnung NICHT; nur das HH:MM-Muster
      // triggert den "today"-Pfad. Die Sekunden sind egal, solange der
      // gemockte Zeitpunkt davor/danach liegt.
      setWindowDate(w, '2026-08-15T23:59:59');
      expect(w.parseEntryDateKey('23:59:59')).toBe('2026-08-15');

      setWindowDate(w, '2026-08-16T00:00:01');
      expect(w.parseEntryDateKey('00:00:01')).toBe('2026-08-16');
    });

    it('isTodayKey folgt der gemockten Systemzeit (Heute-Marker im Header)', () => {
      // Vor Mitternacht: 2026-08-15 ist heute.
      setWindowDate(w, '2026-08-15T22:00:00');
      expect(w.isTodayKey('2026-08-15')).toBe(true);
      expect(w.isTodayKey('2026-08-14')).toBe(false);

      // Nach Mitternacht: 2026-08-16 ist heute, 2026-08-15 nicht mehr.
      setWindowDate(w, '2026-08-16T00:30:00');
      expect(w.isTodayKey('2026-08-16')).toBe(true);
      expect(w.isTodayKey('2026-08-15')).toBe(false);
    });
  });

  // ───────────────── (b) formatEntryTimeHHMM: HH:MM:SS → HH:MM ────────────────
  describe('formatEntryTimeHHMM: Sekunden werden gekürzt, einstellige Stunde gepaddet', () => {
    it('"HH:MM:SS" → "HH:MM" (Sekunden entfernt)', () => {
      expect(w.formatEntryTimeHHMM('14:30:45')).toBe('14:30');
      expect(w.formatEntryTimeHHMM('08:05:00')).toBe('08:05');
      expect(w.formatEntryTimeHHMM('23:59:59')).toBe('23:59');
    });

    it('"HH:MM" → "HH:MM" (unverändert, defensiv)', () => {
      expect(w.formatEntryTimeHHMM('14:30')).toBe('14:30');
      expect(w.formatEntryTimeHHMM('08:05')).toBe('08:05');
      // Einstellige Stunde wird auf 2 Stellen gepaddet (Minuten bleiben
      // unverändert, weil das Regex genau 2 Ziffern für Minuten fordert).
      expect(w.formatEntryTimeHHMM('8:05')).toBe('08:05');
      expect(w.formatEntryTimeHHMM('9:00')).toBe('09:00');
    });

    it('Whitespace um "HH:MM(:SS)?" wird getrimmt', () => {
      expect(w.formatEntryTimeHHMM('  14:30:45  ')).toBe('14:30');
    });

    it('null / undefined / leer / ungültig → ""', () => {
      expect(w.formatEntryTimeHHMM(null)).toBe('');
      expect(w.formatEntryTimeHHMM(undefined)).toBe('');
      expect(w.formatEntryTimeHHMM('')).toBe('');
      expect(w.formatEntryTimeHHMM('Keine Uhrzeit')).toBe('');
    });
  });

  // ───────────────── (c) getTabNextTime: max(now, last.time+1) ────────────────
  describe('getTabNextTime: niemals in der Vergangenheit, auch bei Clock-Skew nicht', () => {
    it('Tab ohne Entries → Date.now() (genauer: gemockte Zeit)', () => {
      // Mock setzen UND sicherstellen, dass getTabNextTime exakt diesen
      // Zeitpunkt liefert — vorher las der Code Date.now() und damit
      // die reale Systemzeit, was die Tests nicht-deterministisch machte.
      setWindowDate(w, '2026-08-15T14:00:00');
      var expected = new w.__origDate('2026-08-15T14:00:00').getTime();
      expect(w.getTabNextTime({ entries: [] })).toBe(expected);
    });

    it('letzter Entry in der Vergangenheit → Date.now() (jetzt gewinnt)', () => {
      setWindowDate(w, '2026-08-15T14:00:00');
      var now = new w.__origDate('2026-08-15T14:00:00').getTime();
      var lastTime = now - 60_000; // 1 min in der Vergangenheit
      var next = w.getTabNextTime({ entries: [{ time: lastTime }] });
      expect(next).toBe(now);
    });

    it('letzter Entry in der ZUKUNFT → last.time + 1 (Clock-Skew-Schutz)', () => {
      // Szenario: Maschinen-Uhr läuft vor, oder Cross-Tab-Sync hat einen
      // Entry mit höherem time importiert. Der neue Entry MUSS strikt
      // monoton steigen — der Code nutzt Math.max(now, last.time+1).
      setWindowDate(w, '2026-08-15T14:00:00');
      var now = new w.__origDate('2026-08-15T14:00:00').getTime();
      var futureTime = now + 3_600_000; // 1 h in der Zukunft
      var next = w.getTabNextTime({ entries: [{ time: futureTime }] });
      expect(next).toBe(futureTime + 1);
      expect(next).toBeGreaterThan(now);
    });

    it('letzter Entry genau jetzt → last.time + 1 (exklusiver Marker)', () => {
      // last.time + 1 statt last.time selbst verhindert, dass zwei Entries
      // mit identischer Zeit als "gleich alt" einsortiert werden — wichtig
      // für die Senken-Auswahl (lastEntryTime als Tiebreaker).
      setWindowDate(w, '2026-08-15T14:00:00');
      var now = new w.__origDate('2026-08-15T14:00:00').getTime();
      var next = w.getTabNextTime({ entries: [{ time: now }] });
      expect(next).toBe(now + 1);
    });

    it('null / undefined Tab → Date.now() (defensiv)', () => {
      setWindowDate(w, '2026-08-15T14:00:00');
      var expected = new w.__origDate('2026-08-15T14:00:00').getTime();
      expect(w.getTabNextTime(null)).toBe(expected);
      expect(w.getTabNextTime(undefined)).toBe(expected);
      expect(w.getTabNextTime({})).toBe(expected);
    });
  });
});
