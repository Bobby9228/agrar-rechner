/**
 * Regression tests für das Inline-Protokoll-Redesign in der
 * Ergebnis-Karte (render-results.js → renderDrillEntriesInline).
 *
 * Vorher: einzeilige #1 ✕-Liste.
 * Nachher: kompakte Mini-Karte mit
 *   - dezentem Zeitstempel oben  ("15.08.2026 · 10:12 Uhr")
 *   - klar hervorgehobenem Hauptteil ("10,0 ha • 1,7 Einheiten",
 *     optional "… kg Dünger")
 *   - kleinem Papierkorb-Button rechts (44×44 Touch-Target,
 *     aria-label + title)
 *
 * Abdeckung:
 *   1) Pure-Helper `formatEntryTimeCard`: number, "HH:MM", "HH:MM:SS",
 *      sonstige Strings, null/undefined/leer.
 *   2) DOM: jede Karte ist `.deim-row`, mit `.deim-time` oben und
 *      `.deim-body` darunter — KEINE `.drill-entry`/`.entry-text`-Klasse
 *      (damit andere Protokoll-Ansichten unangetastet bleiben).
 *   3) Textformat: Timestamp in "dd.mm.yyyy · HH:MM Uhr", darunter
 *      "X,X ha • X,E Einheiten", #Nummer entfernt, @ vor Hektar entfernt.
 *   4) Fehlender Dünger: ohne `duenger` wird das `.deim-duenger`-Segment
 *      weggelassen (kein "0 kg Dünger"-Müll).
 *   5) aria-label + title auf dem Papierkorb-Button (sprechend, mit Uhrzeit).
 *   6) Klick auf den Papierkorb-Button ruft `drillRemove` auf und entfernt
 *      den richtigen Eintrag — bestehende drillRemove-Funktionalität
 *      unverändert.
 *   7) Touch-Target: Das `.deim-remove::before` Overlay ist mindestens
 *      44×44 px (CSS-Vertrag).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createDom } from './helpers.js';

function setUpTabWithEntries(w, entries) {
  var r = w.getActiveReiter();
  r.hektar = 10;
  r.koerner = 90000;
  r.duenger = 100;
  r.entries = entries;
}

// ───────────────────────── Pure-Helper ─────────────────────────

describe('Inline-Protokoll-Redesign — formatEntryTimeCard (pure)', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('number (Date-Ms) → "dd.mm.yyyy · HH:MM Uhr"', () => {
    var d = new Date(2026, 7, 15, 10, 12, 0); // 15.08.2026 10:12 lokal
    expect(w.formatEntryTimeCard(d.getTime())).toBe('15.08.2026 \u00B7 10:12 Uhr');
  });

  it('number: einstellige Stunde wird auf 2 Stellen gepaddet', () => {
    var d = new Date(2026, 7, 15, 8, 7, 0);
    expect(w.formatEntryTimeCard(d.getTime())).toBe('15.08.2026 \u00B7 08:07 Uhr');
  });

  it('number: einstellige Minute wird auf 2 Stellen gepaddet', () => {
    var d = new Date(2026, 7, 15, 14, 5, 0);
    expect(w.formatEntryTimeCard(d.getTime())).toBe('15.08.2026 \u00B7 14:05 Uhr');
  });

  it('string "HH:MM" → heutiges Datum + HH:MM (in der Session)', () => {
    var today = new Date();
    var expected = String(today.getDate()).padStart(2, '0') + '.' +
                   String(today.getMonth() + 1).padStart(2, '0') + '.' +
                   today.getFullYear();
    expect(w.formatEntryTimeCard('14:30')).toBe(expected + ' \u00B7 14:30 Uhr');
  });

  it('string "HH:MM:SS" → Sekunden werden entfernt', () => {
    var today = new Date();
    var expected = String(today.getDate()).padStart(2, '0') + '.' +
                   String(today.getMonth() + 1).padStart(2, '0') + '.' +
                   today.getFullYear();
    expect(w.formatEntryTimeCard('22:03:45')).toBe(expected + ' \u00B7 22:03 Uhr');
    expect(w.formatEntryTimeCard('08:30:00')).toBe(expected + ' \u00B7 08:30 Uhr');
  });

  it('sonstige Strings (z.B. ISO) → Date.parse-Fallback', () => {
    var s = w.formatEntryTimeCard('2026-08-14T22:03:00');
    // Nicht-leer + enthält das Trennzeichen " · " + "Uhr"
    expect(s).toContain(' \u00B7 ');
    expect(s).toContain('Uhr');
    expect(s).toContain('22:03');
  });

  it('leer / ungültig → leerer String (kein Crash)', () => {
    expect(w.formatEntryTimeCard(null)).toBe('');
    expect(w.formatEntryTimeCard(undefined)).toBe('');
    expect(w.formatEntryTimeCard('')).toBe('');
    expect(w.formatEntryTimeCard('garbage')).toBe('');
    expect(w.formatEntryTimeCard(NaN)).toBe('');
    expect(w.formatEntryTimeCard(Infinity)).toBe('');
    // sanitizeEntry() setzt fehlende/ungültige Alt-Zeitwerte auf 0.
    // Das darf nicht als erfundener Unix-Epoch-Zeitstempel erscheinen.
    expect(w.formatEntryTimeCard(0)).toBe('');
    expect(w.formatEntryTimeCard(-1)).toBe('');
    expect(w.formatEntryTimeCard('99:99')).toBe('');
    expect(w.formatEntryTimeCard('10:12 Rest')).toBe('');
    // Non-finite / NaN-Werte dürfen nicht crashen und geben "" zurück.
    expect(typeof w.formatEntryTimeCard(NaN)).toBe('string');
    expect(typeof w.formatEntryTimeCard(undefined)).toBe('string');
  });

  it('robuste Behandlung: kein Crash auf beliebigen Garbage-Werten', () => {
    // "ohne Crash" — wir probieren eine Reihe seltsamer Eingaben durch
    // und stellen sicher, dass die Funktion immer einen String
    // zurückgibt (eventuell leer, aber nie eine Exception).
    var cases = [{}, [], true, false, Symbol('x'), new Date(), /regex/];
    cases.forEach(function(c) {
      expect(function() { w.formatEntryTimeCard(c); }).not.toThrow();
      expect(typeof w.formatEntryTimeCard(c)).toBe('string');
    });
  });
});

// ───────────────────────── DOM ─────────────────────────

describe('Inline-Protokoll-Redesign — DOM', () => {
  let w, doc;
  beforeEach(() => {
    var d = createDom();
    w = d.window; doc = w.document;
  });

  it('rendert pro Entry genau eine .deim-row in #r_drill_entries', () => {
    setUpTabWithEntries(w, [
      { einheit: 2, zaehlerStand: 5, duenger: 100, time: '10:00' },
      { einheit: 1.5, zaehlerStand: 8, duenger: 50, time: '10:05' }
    ]);
    w.renderResults();
    var rows = doc.querySelectorAll('#r_drill_entries .deim-row');
    expect(rows.length).toBe(2);
  });

  it('jede .deim-row enthält .deim-time und .deim-body — keine .drill-entry-Klasse', () => {
    setUpTabWithEntries(w, [
      { einheit: 2, zaehlerStand: 5, duenger: 100, time: '10:00' }
    ]);
    w.renderResults();
    var row = doc.querySelector('#r_drill_entries .deim-row');
    expect(row).not.toBeNull();
    expect(row.classList.contains('drill-entry')).toBe(false);
    expect(row.querySelector('.deim-time')).not.toBeNull();
    expect(row.querySelector('.deim-body')).not.toBeNull();
    // Legacy-Klasse `.entry-text` darf hier NICHT auftauchen — sonst würden
    // Tests/Stile für die anderen Protokoll-Ansichten mitgreifen.
    expect(row.querySelector('.entry-text')).toBeNull();
  });

  it('layout: .deim-time liegt im DOM VOR .deim-body', () => {
    setUpTabWithEntries(w, [
      { einheit: 2, zaehlerStand: 5, duenger: 100, time: '10:00' }
    ]);
    w.renderResults();
    var row = doc.querySelector('#r_drill_entries .deim-row');
    var time = row.querySelector('.deim-time');
    var body = row.querySelector('.deim-body');
    // DOCUMENT_POSITION_FOLLOWING = 4 — body muss NACH time liegen.
    expect((time.compareDocumentPosition(body) & 4) !== 0).toBe(true);
  });

  it('änderungen am Inline-Layout haben KEINE Auswirkung auf #drill_entries', () => {
    // Bestehende Protokoll-Ansichten (renderDrillLog) müssen ihre
    // .drill-entry-Layout behalten.
    setUpTabWithEntries(w, [
      { einheit: 2, zaehlerStand: 5, duenger: 100, time: '10:00' }
    ]);
    w.renderResults();
    var drillEntries = doc.querySelectorAll('#drill_entries .drill-entry');
    expect(drillEntries.length).toBe(1);
    expect(drillEntries[0].classList.contains('deim-row')).toBe(false);
  });
});

// ───────────────────────── Textformat ─────────────────────────

describe('Inline-Protokoll-Redesign — Textformat', () => {
  let w, doc;
  beforeEach(() => {
    var d = createDom();
    w = d.window; doc = w.document;
  });

  it('Zeitstempel nutzt "dd.mm.yyyy · HH:MM Uhr" (mitte-dot + " Uhr"-Suffix)', () => {
    setUpTabWithEntries(w, [
      { einheit: 2, zaehlerStand: 5, duenger: 0, time: '14:30' }
    ]);
    w.renderResults();
    var time = doc.querySelector('#r_drill_entries .deim-time');
    var today = new Date();
    var expected = String(today.getDate()).padStart(2, '0') + '.' +
                   String(today.getMonth() + 1).padStart(2, '0') + '.' +
                   today.getFullYear();
    expect(time.textContent).toBe(expected + ' \u00B7 14:30 Uhr');
  });

  it('Hauptzeile: "X,X ha • X,X Einheiten" (Bullet-Trenner, kein #N, kein @)', () => {
    setUpTabWithEntries(w, [
      { einheit: 1.7, zaehlerStand: 10, duenger: 0, time: '10:00' }
    ]);
    w.renderResults();
    var row = doc.querySelector('#r_drill_entries .deim-row');
    var ha = row.querySelector('.deim-ha');
    var sep = row.querySelector('.deim-sep');
    var ein = row.querySelector('.deim-einheiten');
    expect(ha.textContent).toBe('10,0 ha');
    expect(sep.textContent).toBe(' • ');
    expect(sep.getAttribute('aria-hidden')).toBe('true');
    expect(ein.textContent).toBe('1,700 Einheiten');
    // Der zusammengesetzte Summary-Text muss die Marker NICHT enthalten.
    var summary = row.querySelector('.deim-summary');
    expect(summary.textContent).not.toContain('#');
    expect(summary.textContent).not.toContain('@');
  });

  it('numerischer Timestamp wird zu "dd.mm.yyyy · HH:MM Uhr" formatiert', () => {
    var t = new Date(2026, 7, 15, 10, 12, 0).getTime();
    setUpTabWithEntries(w, [
      { einheit: 1, zaehlerStand: 5, duenger: 0, time: t }
    ]);
    w.renderResults();
    var time = doc.querySelector('#r_drill_entries .deim-time');
    expect(time.textContent).toBe('15.08.2026 \u00B7 10:12 Uhr');
  });

  it('Hektar-Quelle: zaehlerStand vor istHektar, fallback entry.hektar ohne @', () => {
    // Entry-Form wie sie _buildDrillEntry() produziert: entry.hektar ist der
    // Snapshot des Tabs zum Zeitpunkt der Einfüllung. Hier kein
    // zaehlerStand/istHektar → fallback auf entry.hektar (10), OHNE "@"-Präfix.
    setUpTabWithEntries(w, [
      { einheit: 1, hektar: 10, istHektar: 0, zaehlerStand: 0, duenger: 0, time: '10:00' }
    ]);
    w.renderResults();
    var ha = doc.querySelector('#r_drill_entries .deim-ha');
    expect(ha).not.toBeNull();
    expect(ha.textContent).toBe('10,0 ha');
    expect(ha.textContent.charAt(0)).not.toBe('@');
  });

  it('mehrere Entries: jeder Eintrag eigene Zeit + Summary', () => {
    setUpTabWithEntries(w, [
      { einheit: 2, zaehlerStand: 5, duenger: 0, time: '10:00' },
      { einheit: 0.5, zaehlerStand: 6, duenger: 0, time: '10:05' }
    ]);
    w.renderResults();
    var rows = doc.querySelectorAll('#r_drill_entries .deim-row');
    expect(rows.length).toBe(2);
    var times = doc.querySelectorAll('#r_drill_entries .deim-time');
    expect(times[0].textContent).toContain('10:00');
    expect(times[1].textContent).toContain('10:05');
  });
});

// ───────────────────────── Dünger-Segment ─────────────────────────

describe('Inline-Protokoll-Redesign — Dünger-Segment', () => {
  let w, doc;
  beforeEach(() => {
    var d = createDom();
    w = d.window; doc = w.document;
  });

  it('mit Dünger (entry.duenger > 0): ".deim-duenger" wird mit "… kg Dünger" gefüllt', () => {
    setUpTabWithEntries(w, [
      { einheit: 1, zaehlerStand: 5, duenger: 100, time: '10:00' }
    ]);
    w.renderResults();
    var duenger = doc.querySelector('#r_drill_entries .deim-duenger');
    expect(duenger).not.toBeNull();
    expect(duenger.textContent).toBe('100 kg Dünger');
  });

  it('ohne Dünger (entry.duenger = 0 / fehlt): kein .deim-duenger-Element', () => {
    setUpTabWithEntries(w, [
      { einheit: 1, zaehlerStand: 5, duenger: 0, time: '10:00' }
    ]);
    w.renderResults();
    expect(doc.querySelector('#r_drill_entries .deim-duenger')).toBeNull();
    // Summary soll trotzdem nur "X ha • X Einheiten" enthalten, ohne "kg"
    var summary = doc.querySelector('#r_drill_entries .deim-summary');
    expect(summary.textContent).not.toContain('kg');
    expect(summary.textContent).not.toContain('Dünger');
  });

  it('große Dünger-Werte bekommen deutschen Tausenderpunkt', () => {
    setUpTabWithEntries(w, [
      { einheit: 1, zaehlerStand: 5, duenger: 1500, time: '10:00' }
    ]);
    w.renderResults();
    var duenger = doc.querySelector('#r_drill_entries .deim-duenger');
    expect(duenger.textContent).toBe('1.500 kg Dünger');
  });
});

// ───────────────────────── aria-label / title ─────────────────────────

describe('Inline-Protokoll-Redesign — aria-label und title', () => {
  let w, doc;
  beforeEach(() => {
    var d = createDom();
    w = d.window; doc = w.document;
  });

  it('Papierkorb-Button hat type="button" und Klasse .deim-remove', () => {
    setUpTabWithEntries(w, [
      { einheit: 1, zaehlerStand: 5, duenger: 0, time: '10:00' }
    ]);
    w.renderResults();
    var btn = doc.querySelector('#r_drill_entries .deim-remove');
    expect(btn).not.toBeNull();
    expect(btn.tagName.toLowerCase()).toBe('button');
    expect(btn.getAttribute('type')).toBe('button');
  });

  it('aria-label enthält "Buchung löschen" + Uhrzeit (HH:MM, ohne Sekunden)', () => {
    setUpTabWithEntries(w, [
      { einheit: 1, zaehlerStand: 5, duenger: 0, time: '22:03:45' }
    ]);
    w.renderResults();
    var btn = doc.querySelector('#r_drill_entries .deim-remove');
    var aria = btn.getAttribute('aria-label');
    expect(aria).toContain('Buchung');
    expect(aria).toContain('l\u00f6schen');
    expect(aria).toContain('22:03');
    expect(aria).not.toContain(':45');
    expect(aria).not.toContain('22:03:');
  });

  it('title spiegelt aria-label (für Hover-Tooltip)', () => {
    setUpTabWithEntries(w, [
      { einheit: 1, zaehlerStand: 5, duenger: 0, time: '10:00' }
    ]);
    w.renderResults();
    var btn = doc.querySelector('#r_drill_entries .deim-remove');
    expect(btn.getAttribute('title')).toBe(btn.getAttribute('aria-label'));
  });

  it('numerischer Timestamp → aria-label enthält HH:MM (lokale Zeit)', () => {
    var t = new Date(2026, 7, 15, 10, 12, 0).getTime();
    setUpTabWithEntries(w, [
      { einheit: 1, zaehlerStand: 5, duenger: 0, time: t }
    ]);
    w.renderResults();
    var btn = doc.querySelector('#r_drill_entries .deim-remove');
    expect(btn.getAttribute('aria-label')).toContain('10:12');
  });

  it('mehrere Einträge: jeder Button hat seinen eigenen aria-label mit eigener Zeit', () => {
    setUpTabWithEntries(w, [
      { einheit: 1, zaehlerStand: 5, duenger: 0, time: '10:00' },
      { einheit: 1, zaehlerStand: 6, duenger: 0, time: '10:05' }
    ]);
    w.renderResults();
    var btns = doc.querySelectorAll('#r_drill_entries .deim-remove');
    expect(btns.length).toBe(2);
    expect(btns[0].getAttribute('aria-label')).toContain('10:00');
    expect(btns[1].getAttribute('aria-label')).toContain('10:05');
  });
});

// ───────────────────────── Klick → drillRemove ─────────────────────────

describe('Inline-Protokoll-Redesign — Klick entfernt Eintrag via drillRemove', () => {
  let w, doc;
  beforeEach(() => {
    var d = createDom();
    w = d.window; doc = w.document;
  });

  it('Klick auf Papierkorb-Button des ersten Eintrags entfernt entry[0]', () => {
    setUpTabWithEntries(w, [
      { einheit: 2, zaehlerStand: 5, duenger: 0, time: '10:00' },
      { einheit: 3, zaehlerStand: 8, duenger: 0, time: '10:05' }
    ]);
    w.renderResults();
    expect(w.getActiveReiter().entries.length).toBe(2);
    var btn0 = doc.querySelectorAll('#r_drill_entries .deim-remove')[0];
    btn0.click();
    expect(w.getActiveReiter().entries.length).toBe(1);
    expect(w.getActiveReiter().entries[0].einheit).toBe(3);
  });

  it('Klick auf Papierkorb-Button des zweiten Eintrags entfernt nur entry[1]', () => {
    setUpTabWithEntries(w, [
      { einheit: 2, zaehlerStand: 5, duenger: 0, time: '10:00' },
      { einheit: 3, zaehlerStand: 8, duenger: 0, time: '10:05' }
    ]);
    w.renderResults();
    var btn1 = doc.querySelectorAll('#r_drill_entries .deim-remove')[1];
    btn1.click();
    expect(w.getActiveReiter().entries.length).toBe(1);
    expect(w.getActiveReiter().entries[0].einheit).toBe(2);
  });

  it('data-deim-idx spiegelt den tatsächlichen Index wider', () => {
    setUpTabWithEntries(w, [
      { einheit: 1, zaehlerStand: 5, duenger: 0, time: '10:00' },
      { einheit: 1, zaehlerStand: 6, duenger: 0, time: '10:05' },
      { einheit: 1, zaehlerStand: 7, duenger: 0, time: '10:10' }
    ]);
    w.renderResults();
    var rows = doc.querySelectorAll('#r_drill_entries .deim-row');
    expect(rows[0].getAttribute('data-deim-idx')).toBe('0');
    expect(rows[1].getAttribute('data-deim-idx')).toBe('1');
    expect(rows[2].getAttribute('data-deim-idx')).toBe('2');
  });
});

// ───────────────────────── Touch-Target (CSS-Vertrag) ─────────────────────────

describe('Inline-Protokoll-Redesign — Touch-Target 44×44', () => {
  let w, doc;
  beforeEach(() => {
    var d = createDom();
    w = d.window; doc = w.document;
  });

  it('CSS-Regel für .deim-remove::before definiert 44×44 px Hit-Area', () => {
    // Vertrag: der ::before-Overlay vergrößert das effektive Touch-Target
    // unsichtbar auf mindestens 44×44 px. Wir prüfen die Roh-Regel im CSS.
    var cssPath = resolve(process.cwd(), 'public/css/styles.css');
    var cssText = readFileSync(cssPath, 'utf-8');
    expect(cssText).toMatch(/\.deim-remove::before/);
    // 44px width + 44px height im Block — robust gegen Quoting-Varianten.
    var block = cssText.match(/\.deim-remove::before\s*\{[^}]*\}/);
    expect(block).not.toBeNull();
    expect(block[0]).toContain('44px');
  });
});
