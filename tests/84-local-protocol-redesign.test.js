/**
 * Tests für das lokale Protokoll-Redesign (Gesamtbilanz, Tagesgruppen,
 * Accordion, drei-Punkte-Aktion mit Löschbestätigung).
 *
 * Testet:
 *   - Pure-Helper (parseEntryDateKey, formatEntryTimeHHMM,
 *     formatDateKeyGerman/Short, isTodayKey) — keine DOM-Abhängigkeit.
 *   - state.protocolView / protocolOpenCards Defaults + Persistenz.
 *   - renderLocalProtocol(): Gesamtbilanz (Saat-Ersparnis + Dünger-
 *     Verbleibend, beides aus existierenden Aggregationen).
 *   - renderLocalProtocolFields(): Accordion-Cards, Tagesgruppen, Status-
 *     Zeile mit Hektar + Carryover-Mehrbedarf/Ersparnis + Eingefüllt-
 *     Indikator.
 *   - renderLocalProtocolMachine(): Forecast (Saat-leer / Dünger-leer bei).
 *   - setProtocolView('fields'|'machine'): state.protocolView + ARIA.
 *   - toggleProtocolAccordion: Single-Open via state.protocolOpenCards.
 *   - requestLocalProtocolDelete + confirmLocalProtocolDelete:
 *     Action-Sheet öffnen → Klick auf "Buchung löschen" → drillRemove
 *     (oder drillMachineRemove). Löschbestätigung statt direktem ✕.
 *   - Persistent: protocolView/protocolOpenCards überleben localStorage.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

// ───────────────────────── helpers ─────────────────────────
//
// Sei defensiv: viele Tests lesen state aus dem frisch erzeugten DOM.
// (createDom() lädt das echte index.html + alle JS-Module.)

function setUpTab(w, tabIdx, partial) {
  var base = w.state.reiter[tabIdx];
  base.hektar = partial.hektar != null ? partial.hektar : 10;
  base.istHektar = partial.istHektar != null ? partial.istHektar : 0;
  base.koerner = partial.koerner != null ? partial.koerner : 90000;
  base.duenger = partial.duenger != null ? partial.duenger : 100;
  base.entries = partial.entries || [];
  base.koernerProEinheit = partial.koernerProEinheit != null
    ? partial.koernerProEinheit : (w.state.koernerProEinheit || 50000);
  base.fahrgassenEnabled = false;
  base.fahrgassenBreite = 0;
  base.done = false;
}

// ─────────── Pure-Helper ───────────

describe('Lokales Protokoll — Pure-Helper', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('parseEntryDateKey: ISO-String → YYYY-MM-DD', () => {
    var key = w.parseEntryDateKey('2026-08-15T14:30:00');
    expect(key).toBe('2026-08-15');
  });

  it('parseEntryDateKey: HH:MM → heutiges Datum (in der Session)', () => {
    var key = w.parseEntryDateKey('22:02');
    expect(typeof key).toBe('string');
    expect(key.length).toBe(10);
    expect(key.charAt(4)).toBe('-');
    // Sollte "heute" entsprechen (year/month/day gleich zur Systemzeit)
    var today = new Date();
    var y = today.getFullYear();
    var m = String(today.getMonth() + 1).padStart(2, '0');
    var d = String(today.getDate()).padStart(2, '0');
    expect(key).toBe(y + '-' + m + '-' + d);
  });

  it('parseEntryDateKey: number → YYYY-MM-DD aus Date', () => {
    // 2026-08-14T22:00 local
    var d = new Date(2026, 7, 14, 22, 0, 0);
    var key = w.parseEntryDateKey(d.getTime());
    expect(key).toBe('2026-08-14');
  });

  it('parseEntryDateKey: leer / ungültig → ""', () => {
    expect(w.parseEntryDateKey(null)).toBe('');
    expect(w.parseEntryDateKey(undefined)).toBe('');
    expect(w.parseEntryDateKey('')).toBe('');
    expect(w.parseEntryDateKey('garbage')).toBe('');
    expect(w.parseEntryDateKey(NaN)).toBe('');
  });

  it('formatEntryTimeHHMM: Date-Ms → "HH:MM"', () => {
    var d = new Date(2026, 7, 15, 22, 2, 0);
    var s = w.formatEntryTimeHHMM(d.getTime());
    expect(s).toBe('22:02');
  });

  it('formatEntryTimeHHMM: Date-Ms → einstellige Stunde wird auf 2 Stellen gepaddet', () => {
    var d = new Date(2026, 7, 15, 8, 7, 0);
    expect(w.formatEntryTimeHHMM(d.getTime())).toBe('08:07');
  });

  it('formatEntryTimeHHMM: HH:MM:SS → HH:MM (Sekunden entfernt)', () => {
    expect(w.formatEntryTimeHHMM('22:03:45')).toBe('22:03');
    expect(w.formatEntryTimeHHMM('08:30:00')).toBe('08:30');
  });

  it('formatEntryTimeHHMM: HH:MM ohne Sekunden bleibt', () => {
    expect(w.formatEntryTimeHHMM('14:00')).toBe('14:00');
  });

  it('formatEntryTimeHHMM: leer / ungültig → ""', () => {
    expect(w.formatEntryTimeHHMM(null)).toBe('');
    expect(w.formatEntryTimeHHMM(undefined)).toBe('');
    expect(w.formatEntryTimeHHMM('')).toBe('');
    expect(w.formatEntryTimeHHMM('garbage')).toBe('');
  });

  it('formatDateKeyGerman: 2026-08-14 → "14. August 2026"', () => {
    expect(w.formatDateKeyGerman('2026-08-14')).toBe('14. August 2026');
  });

  it('formatDateKeyGerman: 2026-01-01 → "1. Januar 2026"', () => {
    expect(w.formatDateKeyGerman('2026-01-01')).toBe('1. Januar 2026');
  });

  it('formatDateKeyGerman: ungültig → ""', () => {
    expect(w.formatDateKeyGerman('')).toBe('');
    expect(w.formatDateKeyGerman('foo')).toBe('');
    expect(w.formatDateKeyGerman('2026-13-01')).toBe('');
  });

  it('formatDateKeyShort: 2026-08-14 → "14. Aug."', () => {
    expect(w.formatDateKeyShort('2026-08-14')).toBe('14. Aug.');
  });

  it('formatDateKeyShort: 2026-03-15 → "15. März" (kein "." — Langname März)', () => {
    // Die Kurzform-Liste nutzt für März "März" (ohne Punkt). Test pinnt das.
    expect(w.formatDateKeyShort('2026-03-15')).toBe('15. März');
  });

  it('isTodayKey: heute → true', () => {
    var d = new Date();
    var key = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
    expect(w.isTodayKey(key)).toBe(true);
  });

  it('isTodayKey: gestern → false', () => {
    var d = new Date();
    d.setDate(d.getDate() - 1);
    var key = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
    expect(w.isTodayKey(key)).toBe(false);
  });

  it('isTodayKey: "" oder anderer Typ → false', () => {
    expect(w.isTodayKey('')).toBe(false);
    expect(w.isTodayKey(null)).toBe(false);
  });
});

// ─────────── State Defaults + Persistenz ───────────

describe('Lokales Protokoll — state.protocolView / protocolOpenCards', () => {
  it('Fresh-Init: protocolView = "fields", protocolOpenCards = {}', () => {
    var w = createDom().window;
    expect(w.state.protocolView).toBe('fields');
    expect(w.state.protocolOpenCards).toEqual({});
  });

  it('protocolView wird persistiert', () => {
    var w = createDom().window;
    w.setProtocolView('machine');
    expect(w.state.protocolView).toBe('machine');
    var saved = JSON.parse(w.localStorage.getItem('agrar_rechner'));
    expect(saved.protocolView).toBe('machine');
  });

  it('protocolOpenCards wird persistiert', () => {
    var w = createDom().window;
    w.state.protocolOpenCards = { '2026-08-14': '0' };
    w.saveState();
    var saved = JSON.parse(w.localStorage.getItem('agrar_rechner'));
    expect(saved.protocolOpenCards).toEqual({ '2026-08-14': '0' });
  });

  it('Migration 7→8: fehlende protocolView-Felder werden mit Defaults gefüllt', () => {
    var w = createDom().window;
    // Alten State simulieren (ohne protocolView/protocolOpenCards)
    var oldState = {
      reiter: [{ name: 'Schlag 1', hektar: 10, istHektar: 0, koerner: 90000, duenger: 100, entries: [], done: false, koernerProEinheit: 50000 }],
      activeReiter: 0,
      activeView: null,
      _lv: 7
    };
    w.localStorage.setItem('agrar_rechner', JSON.stringify(oldState));
    w.loadState();
    expect(w.state.protocolView).toBe('fields');
    expect(w.state.protocolOpenCards).toEqual({});
    expect(w.state._lv).toBe(9);
  });

  it('Migration 7→8: protocolOpenCards wird als Plain Object validiert', () => {
    var w = createDom().window;
    var oldState = {
      reiter: [{ name: 'Schlag 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false, koernerProEinheit: 50000 }],
      activeReiter: 0,
      activeView: null,
      protocolView: 'machine',
      protocolOpenCards: 'not-an-object', // absichtlich kaputt
      _lv: 7
    };
    w.localStorage.setItem('agrar_rechner', JSON.stringify(oldState));
    w.loadState();
    expect(w.state.protocolOpenCards).toEqual({});
  });
});

// ─────────── Gesamtbilanz ───────────

describe('Lokales Protokoll — Platzierung der Gesamtbilanz', () => {
  it('ordnet die Gesamtbilanz vor dem Drill-Protokoll ein', () => {
    var d = createDom();
    var balance = d.window.document.getElementById('local_protocol_balance_section');
    var drill = d.window.document.getElementById('drill_section');

    expect(balance).not.toBeNull();
    expect((balance.compareDocumentPosition(drill) & 4) !== 0).toBe(true);
  });
});

describe('Lokales Protokoll — renderLocalProtocolBalance', () => {
  let w, doc;
  beforeEach(() => {
    var d = createDom();
    w = d.window; doc = w.document;
  });

  it('rendert Saatgut-Verbleibend wie beim Dünger aus der Summe aller Schläge', () => {
    setUpTab(w, 0, { hektar: 10, koerner: 90000, duenger: 100,
      entries: [{ einheit: 3, duenger: 0, time: '10:00' }] });
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var grid = doc.getElementById('local_protocol_balance_grid');
    var leftText = grid.textContent;
    // 10 ha × 90.000 Körner / 50.000 Körner je Einheit = 18 Einheiten,
    // davon 3 bereits eingefüllt: 15 Einheiten verbleibend.
    expect(leftText).toContain('15,000 Einh.');
    expect(leftText).toContain('verbleibend');
    expect(leftText).toContain('Saatgut');
  });

  it('zeigt eingefüllte Einheiten und Dünger zusätzlich zum Verbleibenden', () => {
    setUpTab(w, 0, { hektar: 10, koerner: 90000, duenger: 100,
      entries: [{ einheit: 3, duenger: 250, time: '10:00' }] });
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var filled = doc.getElementById('local_protocol_balance_filled');
    expect(filled).not.toBeNull();
    // Σ eingefüllt über alle Schläge: 3 Einheiten Saatgut, 250 kg Dünger.
    expect(filled.textContent).toContain('3,000 Einh.');
    expect(filled.textContent).toContain('250');
    expect(filled.textContent).toContain('eingefüllt');
  });

  it('summiert eingefüllte Mengen über mehrere Schläge', () => {
    // addReiter() ruft syncStateFromInputs() und würde einen vorher
    // gesetzten Schlag aus den (leeren) Eingabefeldern überschreiben —
    // deshalb erst den zweiten Schlag anlegen, dann beide befüllen.
    w.addReiter();
    setUpTab(w, 0, { hektar: 10, koerner: 90000, duenger: 100,
      entries: [{ einheit: 3, duenger: 250, time: '10:00' }] });
    setUpTab(w, 1, { hektar: 10, koerner: 90000, duenger: 100,
      entries: [{ einheit: 2.5, duenger: 150, time: '11:00' }] });
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var filled = doc.getElementById('local_protocol_balance_filled');
    // 3 + 2,5 = 5,5 Einheiten und 250 + 150 = 400 kg.
    expect(filled.textContent).toContain('5,500 Einh.');
    expect(filled.textContent).toContain('400');
  });

  it('zeigt ohne Buchungen keine eingefüllten Mengen an', () => {
    setUpTab(w, 0, { hektar: 10, koerner: 90000, duenger: 100, entries: [] });
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var filled = doc.getElementById('local_protocol_balance_filled');
    expect(filled.hidden).toBe(true);
  });

  it('zeigt die nächsten Leerstände für Saat und Dünger aus dem aktuellen Maschinenstand', () => {
    setUpTab(w, 0, { hektar: 10, koerner: 90000, duenger: 100 });
    w.state.machineLog = [
      { einheit: 3, duenger: 500, zaehlerStand: 0, time: '10:00' }
    ];
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var forecast = doc.getElementById('local_protocol_balance_forecast');
    expect(forecast).not.toBeNull();
    expect(forecast.textContent).toContain('Saat leer bei 1,7 ha');
    expect(forecast.textContent).toContain('Dünger leer bei 5,0 ha');
  });

  it('zeigt ohne Maschinenfüllung einen klaren Prognose-Hinweis', () => {
    setUpTab(w, 0, { hektar: 10, koerner: 90000, duenger: 100 });
    w.state.machineLog = [];
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var forecast = doc.getElementById('local_protocol_balance_forecast');
    expect(forecast.textContent).toContain('Noch keine Leerstandsprognose');
  });

  it('rendert Dünger-Verbleibend (aus Summe über alle reiter)', () => {
    setUpTab(w, 0, { hektar: 10, koerner: 90000, duenger: 100 });
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var grid = doc.getElementById('local_protocol_balance_grid');
    var text = grid.textContent;
    // 10 ha × 100 kg = 1000 kg verbleibend
    expect(text).toContain('1.000');
    expect(text).toContain('Dünger');
    expect(text).toContain('verbleibend');
  });

  it('Header zeigt "Heute, <kurzes Datum>"', () => {
    setUpTab(w, 0, {});
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var timeEl = doc.getElementById('local_protocol_balance_time');
    var today = new Date();
    var expected = 'Heute, ' + today.getDate() + '.';
    expect(timeEl.textContent.indexOf(expected)).toBe(0);
  });

  it('außerhalb Protokoll-Modus wird die Section nicht gerendert', () => {
    setUpTab(w, 0, {});
    w.state.activeView = null;
    w.renderLocalProtocol();
    var section = doc.getElementById('local_protocol_section');
    // Section wird im Nicht-Protokoll-Modus auf hidden gesetzt oder per
    // CSS überdeckt — beide Pfade hier ok, wir prüfen hidden OR display.
    var hidden = section.hidden || section.style.display === 'none';
    expect(hidden).toBe(true);
  });
});

// ─────────── Schläge-Panel: Accordion + Tagesgruppen ───────────

describe('Lokales Protokoll — renderLocalProtocolFields (Schläge)', () => {
  let w, doc;
  beforeEach(() => {
    var d = createDom();
    w = d.window; doc = w.document;
  });

  it('leerer State: zeigt "noch keine Buchungen"-Hinweis (kein Crash)', () => {
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var panel = doc.getElementById('local_protocol_fields_panel');
    expect(panel.textContent).toContain('Noch keine Buchungen');
    expect(panel.querySelectorAll('.lp-field-card').length).toBe(0);
  });

  it('rendert eine .lp-field-card pro Schlag, gruppiert nach Datum', () => {
    var today = new Date();
    var y = today.getFullYear();
    var m = String(today.getMonth() + 1).padStart(2, '0');
    var d = String(today.getDate()).padStart(2, '0');
    var todayKey = y + '-' + m + '-' + d;
    setUpTab(w, 0, {
      entries: [
        { einheit: 3, duenger: 0, zaehlerStand: 19, time: '22:02' },
        { einheit: 0.6, duenger: 0, zaehlerStand: 19, time: '22:03' }
      ]
    });
    w.addReiter();
    setUpTab(w, 1, {
      entries: [{ einheit: 1, duenger: 0, zaehlerStand: 5, time: '22:03' }]
    });
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var panel = doc.getElementById('local_protocol_fields_panel');
    var cards = panel.querySelectorAll('.lp-field-card');
    expect(cards.length).toBe(2);
    // Datum-Heading sollte "X Buchungen" tragen
    var heading = panel.querySelector('.lp-date-heading');
    expect(heading).not.toBeNull();
    expect(heading.textContent).toMatch(/Heute|Buchung/);
    expect(panel.textContent).toContain('3 Buchungen');
    expect(todayKey.length).toBe(10);
  });

  it('Status-Zeile enthält Hektar + Eingefüllt-Menge (Σ über Entries, Kurzform)', () => {
    setUpTab(w, 0, {
      hektar: 19,
      entries: [
        { einheit: 3, duenger: 0, zaehlerStand: 19, time: '22:02' },
        { einheit: 0.6, duenger: 0, zaehlerStand: 19, time: '22:03' }
      ]
    });
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var card = doc.querySelector('.lp-field-card');
    expect(card.textContent).toContain('19,0 ha');
    // Status-Zeile nutzt kompakte Kurzform "3,6 E" (statt "3,6 Einheiten").
    expect(card.textContent).toContain('3,600 E');
  });

  it('Status-Zeile zeigt "Mehrbedarf" wenn IST > SOLL', () => {
    setUpTab(w, 0, { hektar: 10, istHektar: 12, koerner: 90000, duenger: 100 });
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var card = doc.querySelector('.lp-field-card');
    var status = card.querySelector('.lp-field-status');
    expect(status.querySelector('.warning')).not.toBeNull();
    expect(status.textContent).toContain('Mehrbedarf');
  });

  it('Status-Zeile zeigt "Eingespart" wenn IST < SOLL', () => {
    setUpTab(w, 0, { hektar: 10, istHektar: 8, koerner: 90000, duenger: 100 });
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var card = doc.querySelector('.lp-field-card');
    var status = card.querySelector('.lp-field-status');
    expect(status.querySelector('.positive')).not.toBeNull();
    expect(status.textContent).toContain('eingespart');
  });

  it('Mehrere Tage → mehrere Tagesgruppen-Headings', () => {
    // Zwei Entries auf verschiedenen Tagen (number-Ms). Beide Daten werden
    // relativ zur Systemzeit gebildet: ein hart kodiertes "heute" (z.B.
    // 15. August 2026) läuft ab und lässt den Test ab dem nächsten Tag
    // fehlschlagen. Heute + ein älterer Tag, der garantiert im selben Monat
    // wie "heute" liegt, damit die Monats-Assertion stabil bleibt.
    var today = new Date();
    var older = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    older.setDate(older.getDate() - 2);
    // Am 1./2. des Monats würde -2 Tage in den Vormonat rutschen; dann
    // stattdessen zwei Tage nach vorn im selben Monat verankern.
    if (older.getMonth() !== today.getMonth()) {
      older = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);
    }
    var monthName = today.toLocaleDateString('de-DE', { month: 'long' });
    var olderFull = older.getDate() + '. ' + older.toLocaleDateString('de-DE', { month: 'long' })
      + ' ' + older.getFullYear();
    setUpTab(w, 0, {
      entries: [
        { einheit: 3, duenger: 0, zaehlerStand: 10,
          time: new Date(older.getFullYear(), older.getMonth(), older.getDate(), 22, 0).getTime() },
        { einheit: 2, duenger: 0, zaehlerStand: 14,
          time: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 22, 0).getTime() }
      ]
    });
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var headings = doc.querySelectorAll('#local_protocol_fields_panel .lp-date-heading');
    expect(headings.length).toBe(2);
    var text = doc.getElementById('local_protocol_fields_panel').textContent;
    // Der ältere Eintrag hat sein volles Datum (z.B. "13. August 2026").
    expect(text).toContain(olderFull);
    // Der heutige Eintrag wird als "Heute · <Monat>" zusammengefasst
    // (Tag implizit; spart horizontale Breite auf Phone-Displays).
    expect(text).toContain('Heute');
    expect(text).toContain(monthName);
  });
});

// ─────────── Three-dot Aktion (replaceX) ───────────

describe('Lokales Protokoll — Drei-Punkte-Aktion', () => {
  let w, doc;
  beforeEach(() => {
    var d = createDom();
    w = d.window; doc = w.document;
  });

  it('jede .lp-entry hat genau einen .entry-action (statt red X)', () => {
    setUpTab(w, 0, {
      entries: [
        { einheit: 3, duenger: 0, zaehlerStand: 19, time: '22:02' },
        { einheit: 1, duenger: 0, zaehlerStand: 19, time: '22:03' }
      ]
    });
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var entries = doc.querySelectorAll('#local_protocol_fields_panel .lp-entry');
    expect(entries.length).toBe(2);
    entries.forEach(function(e) {
      var actions = e.querySelectorAll('.entry-action');
      expect(actions.length).toBe(1);
      expect(actions[0].textContent).toBe('⋮'); // "⋮" (3-Punkte) — NICHT "✕"
    });
  });

  it('Klick auf .entry-action öffnet das Sheet (NICHT direkte Löschung)', () => {
    setUpTab(w, 0, {
      entries: [{ einheit: 3, duenger: 0, zaehlerStand: 19, time: '22:02' }]
    });
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var action = doc.querySelector('.lp-entry .entry-action');
    var entriesBefore = w.state.reiter[0].entries.length;
    action.click();
    // Eintrag wurde NICHT sofort entfernt.
    expect(w.state.reiter[0].entries.length).toBe(entriesBefore);
    // Sheet ist sichtbar.
    var sheet = doc.getElementById('local_protocol_action_sheet');
    var backdrop = doc.getElementById('local_protocol_sheet_backdrop');
    expect(sheet.classList.contains('show')).toBe(true);
    expect(backdrop.classList.contains('show')).toBe(true);
    // Label enthält die Uhrzeit (HH:MM — keine Sekunden)
    var label = doc.getElementById('local_protocol_sheet_label');
    expect(label.textContent).toContain('22:02');
    expect(label.textContent).not.toContain('22:02:'); // kein "22:02:00"
  });

  it('confirmLocalProtocolDelete ruft drillRemove auf', () => {
    setUpTab(w, 0, {
      entries: [
        { einheit: 3, duenger: 0, zaehlerStand: 19, time: '22:02' },
        { einheit: 1, duenger: 0, zaehlerStand: 19, time: '22:03' }
      ]
    });
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var action = doc.querySelector('.lp-entry .entry-action');
    action.click();
    // Sheet offen. Bestätigen via "Buchung löschen"-Button.
    var confirmBtn = doc.getElementById('local_protocol_sheet_delete');
    confirmBtn.click();
    expect(w.state.reiter[0].entries.length).toBe(1);
    // Sheet wieder zu.
    expect(doc.getElementById('local_protocol_action_sheet').classList.contains('show')).toBe(false);
  });

  it('Cancel-Button schließt das Sheet und löscht NICHT', () => {
    setUpTab(w, 0, {
      entries: [{ einheit: 3, duenger: 0, zaehlerStand: 19, time: '22:02' }]
    });
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var action = doc.querySelector('.lp-entry .entry-action');
    action.click();
    doc.getElementById('local_protocol_sheet_cancel').click();
    expect(w.state.reiter[0].entries.length).toBe(1);
    expect(doc.getElementById('local_protocol_action_sheet').classList.contains('show')).toBe(false);
  });

  it('Aria-Label für entry-action ist sprechend (Buchung um HH:MM)', () => {
    setUpTab(w, 0, {
      entries: [{ einheit: 3, duenger: 0, zaehlerStand: 19, time: '22:02' }]
    });
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var action = doc.querySelector('.lp-entry .entry-action');
    var aria = action.getAttribute('aria-label');
    expect(aria).toContain('22:02');
    expect(aria).toContain('Buchung');
  });
});

// ─────────── Maschinen-Panel + Forecast ───────────

describe('Lokales Protokoll — renderLocalProtocolMachine', () => {
  let w, doc;
  beforeEach(() => {
    var d = createDom();
    w = d.window; doc = w.document;
  });

  it('leeres machineLog: Hinweis ohne Crash', () => {
    w.state.activeView = 'protokoll';
    w.protocolView = 'machine';
    w.state.protocolView = 'machine';
    w.renderLocalProtocol();
    var panel = doc.getElementById('local_protocol_machine_panel');
    expect(panel.textContent).toContain('Noch keine Maschinenfüllungen');
  });

  it('rendert jede Maschinenfüllung als .lp-machine-entry mit Drei-Punkte-Aktion', () => {
    setUpTab(w, 0, { hektar: 10, koerner: 90000, duenger: 100 });
    w.state.machineLog = [
      { einheit: 3, duenger: 0, zaehlerStand: 19, time: '22:02' },
      { einheit: 2, duenger: 100, zaehlerStand: 25, time: '22:03' }
    ];
    w.state.activeView = 'protokoll';
    w.state.protocolView = 'machine';
    w.renderLocalProtocol();
    var entries = doc.querySelectorAll('#local_protocol_machine_panel .lp-machine-entry');
    expect(entries.length).toBe(2);
    var actions = doc.querySelectorAll('#local_protocol_machine_panel .lp-machine-entry .entry-action');
    expect(actions.length).toBe(2);
    expect(actions[0].textContent).toBe('⋮');
  });

  it('Forecast (Saat reicht voraussichtlich bis X ha) wird angezeigt', () => {
    setUpTab(w, 0, { hektar: 50, koerner: 90000, duenger: 0 });
    w.state.machineLog = [
      { einheit: 3, duenger: 0, zaehlerStand: 0, time: '22:02' }
    ];
    w.state.activeView = 'protokoll';
    w.state.protocolView = 'machine';
    w.renderLocalProtocol();
    var forecast = doc.querySelector('#local_protocol_machine_panel .lp-forecast');
    expect(forecast).not.toBeNull();
    expect(forecast.textContent).toContain('Saat reicht voraussichtlich bis');
  });
});

// ─────────── setProtocolView ───────────

describe('Lokales Protokoll — setProtocolView', () => {
  let w, doc;
  beforeEach(() => {
    var d = createDom();
    w = d.window; doc = d.window.document;
  });

  it('wechselt state.protocolView und persistiert', () => {
    expect(w.state.protocolView).toBe('fields');
    w.setProtocolView('machine');
    expect(w.state.protocolView).toBe('machine');
    var saved = JSON.parse(w.localStorage.getItem('agrar_rechner'));
    expect(saved.protocolView).toBe('machine');
  });

  it('verstößt gegen ungültige Werte (no-op für unbekannte Keys)', () => {
    w.setProtocolView('machine');
    w.setProtocolView('xyz-unknown');
    expect(w.state.protocolView).toBe('machine'); // unverändert
  });

  it('wechselt die ARIA-Selected-Zustände der View-Tabs', () => {
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var fieldsBtn = doc.getElementById('lp_view_fields_btn');
    var machineBtn = doc.getElementById('lp_view_machine_btn');
    expect(fieldsBtn.getAttribute('aria-selected')).toBe('true');
    expect(machineBtn.getAttribute('aria-selected')).toBe('false');
    w.setProtocolView('machine');
    expect(fieldsBtn.getAttribute('aria-selected')).toBe('false');
    expect(machineBtn.getAttribute('aria-selected')).toBe('true');
  });

  it('zeigt Sichtbarkeit je nach Panel-Wechsel', () => {
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var fieldsPanel = doc.getElementById('local_protocol_fields_panel');
    var machinePanel = doc.getElementById('local_protocol_machine_panel');
    expect(fieldsPanel.style.display).not.toBe('none');
    expect(machinePanel.style.display).toBe('none');
    expect(fieldsPanel.hidden).toBe(false);
    expect(machinePanel.hidden).toBe(true);
    w.setProtocolView('machine');
    expect(fieldsPanel.style.display).toBe('none');
    expect(machinePanel.style.display).not.toBe('none');
    expect(fieldsPanel.hidden).toBe(true);
    expect(machinePanel.hidden).toBe(false);
  });
});

// ─────────── toggleProtocolAccordion ───────────

describe('Lokales Protokoll — toggleProtocolAccordion (Single-Open)', () => {
  let w, doc;
  beforeEach(() => {
    var d = createDom();
    w = d.window; doc = d.window.document;
  });

  it('öffnet einen Schlag im aktuellen Datum', () => {
    w.toggleProtocolAccordion(0, '2026-08-14', '2026-08-14:0');
    expect(w.state.protocolOpenCards['2026-08-14']).toBe('0');
  });

  it('schließt den Schlag bei erneutem Klick auf denselben', () => {
    w.state.protocolOpenCards = { '2026-08-14': '0' };
    w.toggleProtocolAccordion(0, '2026-08-14', '2026-08-14:0');
    expect(w.state.protocolOpenCards['2026-08-14']).toBeUndefined();
  });

  it('Single-Open: Klick auf anderen Schlag schließt vorherigen', () => {
    setUpTab(w, 0, {});
    w.addReiter();
    setUpTab(w, 1, {});
    w.state.protocolOpenCards = { '2026-08-14': '0' };
    w.toggleProtocolAccordion(1, '2026-08-14', '2026-08-14:1');
    expect(w.state.protocolOpenCards['2026-08-14']).toBe('1');
  });

  it('Single-Open gilt auch über verschiedene Tagesgruppen hinweg', () => {
    w.state.protocolOpenCards = { '2026-08-13': '0' };
    w.toggleProtocolAccordion(1, '2026-08-14', '2026-08-14:1');
    expect(w.state.protocolOpenCards).toEqual({ '2026-08-14': '1' });
  });

  it('DOM: nur ein Schlag pro Datum ist .open', () => {
    var todayKey = w._dateKeyFromDate ? w._dateKeyFromDate(new Date()) : (
      new Date().getFullYear() + '-' +
      String(new Date().getMonth() + 1).padStart(2, '0') + '-' +
      String(new Date().getDate()).padStart(2, '0')
    );
    setUpTab(w, 0, {
      entries: [{ einheit: 1, duenger: 0, zaehlerStand: 5, time: '22:02' }]
    });
    w.addReiter();
    setUpTab(w, 1, {
      entries: [{ einheit: 2, duenger: 0, zaehlerStand: 5, time: '22:03' }]
    });
    w.state.activeView = 'protokoll';
    w.state.protocolOpenCards = {};
    w.renderLocalProtocol();
    // Schlag 0 öffnen
    var summary0 = doc.querySelector('.lp-field-card[data-tab-idx="0"] .lp-field-summary');
    summary0.click();
    // Jetzt Schlag 1 öffnen
    var summary1 = doc.querySelector('.lp-field-card[data-tab-idx="1"] .lp-field-summary');
    summary1.click();
    var openCards = doc.querySelectorAll('.lp-field-card.open');
    expect(openCards.length).toBe(1);
    expect(openCards[0].getAttribute('data-tab-idx')).toBe('1');
  });

  it('persistiert openCards', () => {
    w.toggleProtocolAccordion(2, '2026-08-14', '2026-08-14:2');
    var saved = JSON.parse(w.localStorage.getItem('agrar_rechner'));
    expect(saved.protocolOpenCards).toEqual({ '2026-08-14': '2' });
  });
});

// ─────────── Drei-Punkte-Aktion: Maschine ───────────

describe('Lokales Protokoll — Maschinen-Delete via drei-Punkte', () => {
  let w, doc;
  beforeEach(() => {
    var d = createDom();
    w = d.window; doc = d.window.document;
  });

  it('Bestätigung ruft drillMachineRemove auf', () => {
    setUpTab(w, 0, { hektar: 10, koerner: 90000, duenger: 100 });
    w.state.machineLog = [
      { einheit: 3, duenger: 0, zaehlerStand: 19, time: '22:02' },
      { einheit: 1, duenger: 100, zaehlerStand: 25, time: '22:03' }
    ];
    w.state.activeView = 'protokoll';
    w.state.protocolView = 'machine';
    w.renderLocalProtocol();
    var action = doc.querySelector('.lp-machine-entry .entry-action');
    action.click();
    expect(doc.getElementById('local_protocol_action_sheet').classList.contains('show')).toBe(true);
    doc.getElementById('local_protocol_sheet_delete').click();
    expect(w.state.machineLog.length).toBe(1);
  });
});

// ─────────── renderDrillLog / renderMachineLog bleiben (Regression) ───────────
//
// Das Redesign fügt eine neue Ansicht hinzu, lässt aber die Legacy-Container
// (#drill_entries, #drill_machine_log, .drill-summary) unverändert, damit
// die alte Render-Pipeline weiterläuft (Tests 05/09/16/19/52).

describe('Lokales Protokoll — Legacy-Renderer bleiben intakt', () => {
  let w, doc;
  beforeEach(() => {
    var d = createDom();
    w = d.window; doc = d.window.document;
  });

  it('renderDrillLog füllt #drill_entries weiterhin (Regression)', () => {
    setUpTab(w, 0, {
      entries: [{ einheit: 3, duenger: 0, zaehlerStand: 19, time: '22:02' }]
    });
    w.renderDrillLog();
    var entries = doc.querySelectorAll('#drill_entries .drill-entry');
    expect(entries.length).toBe(1);
  });

  it('renderMachineLog füllt #drill_machine_log weiterhin (Regression)', () => {
    setUpTab(w, 0, { hektar: 10, koerner: 90000, duenger: 100 });
    w.state.machineLog = [{ einheit: 3, duenger: 0, zaehlerStand: 0, time: '22:02' }];
    w.renderMachineLog();
    var entries = doc.querySelectorAll('#drill_machine_log .drill-entry');
    expect(entries.length).toBe(1);
  });

  it('renderDrillSummary füllt drill_summary weiterhin (Regression)', () => {
    setUpTab(w, 0, { hektar: 10, koerner: 90000, duenger: 100 });
    w.renderDrillSummary();
    expect(doc.getElementById('ds_saat_total').textContent).toContain('18');
  });
});

// ─────────── Task 2 Folgefix: „eingefüllt" als reale Maschinenfüllung ────────
//
// Vor 2be0499 summierte die Gesamtbilanz nur reiter[].entries und zeigte damit
// die verteilte statt zwingend der real eingefüllten Menge. Korrekt: jede
// machineLog-Zeile genau einmal plus unabhängige Single-Tab-Füllungen.
// Außerdem war der Saat-Schwellwert
// in _renderBalanceFilled hartcodiert auf 0,0005 — die zentrale EPSILON_EINHEIT-
// Konstante aus calculations.js wird stattdessen verwendet.

describe('Lokales Protokoll — Gesamtbilanz „eingefüllt" als reale Maschinenfüllung', () => {
  let w, doc;
  beforeEach(() => {
    var d = createDom();
    w = d.window; doc = w.document;
  });

  it('Multi-Tab-Füllung: machineLog dominiert, verknüpfte Schlagbuchungen zählen NICHT doppelt', () => {
    setUpTab(w, 0, { hektar: 10, koerner: 90000, duenger: 100,
      entries: [{ einheit: 2, duenger: 200, mlIdx: 0, time: '10:00' }] });
    w.state.machineLog = [
      { einheit: 3, duenger: 250, zaehlerStand: 5, time: '10:00', distributed: 3 }
    ];
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var filled = doc.getElementById('local_protocol_balance_filled');
    // Echte Maschinenfüllung: 3 Einheiten Saatgut, 250 kg Dünger.
    // Die verknüpfte Schlagbuchung (2 E / 200 kg, mlIdx=0) wird NICHT
    // zusätzlich gezählt → keine Doppelzählung.
    expect(filled.textContent).toContain('3,000 Einh.');
    expect(filled.textContent).toContain('250');
    expect(filled.textContent).not.toContain('5,000');
  });

  it('Gemischter Zustand: machineLog-Füllung + unabhängige Single-Tab-Buchung wird genau einmal summiert', () => {
    setUpTab(w, 0, { hektar: 10, koerner: 90000, duenger: 100,
      entries: [
        { einheit: 2, duenger: 100, mlIdx: 0, time: '10:00' },
        { einheit: 1.5, duenger: 50, time: '11:00' }
      ] });
    w.state.machineLog = [
      { einheit: 3, duenger: 150, zaehlerStand: 5, time: '10:00', distributed: 3 }
    ];
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var filled = doc.getElementById('local_protocol_balance_filled');
    // 3 E (machineLog) + 1,5 E (entry ohne mlIdx) = 4,500 E
    // 150 kg (machineLog) + 50 kg (entry ohne mlIdx) = 200 kg
    expect(filled.textContent).toContain('4,500 Einh.');
    expect(filled.textContent).toContain('200');
  });

  it('Exakt 0,0005 Saat ist sichtbar (zentrale EPSILON_EINHEIT-Schwelle)', () => {
    setUpTab(w, 0, { hektar: 10, koerner: 90000, duenger: 100,
      entries: [{ einheit: 0.0005, duenger: 0, time: '10:00' }] });
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var filled = doc.getElementById('local_protocol_balance_filled');
    // EPSILON_EINHEIT = 0,000499999 → 0,0005 ist sichtbar.
    // fmtEinheit rundet half-up → Anzeige 0,001 Einh.
    expect(filled.hidden).toBe(false);
    expect(filled.textContent).toMatch(/0,001/);
  });
});

// ─────────── Review-Fix: Legacy- und Orphan-Strategie ────────────────────────
//
// Git-Historie (siehe ui-handlers.js, Refactor #276/#285): Multi-Tab-Push
// schreibt in das Maschinenlog UND in jeden priorisierten Tab. Die
// Schlag-Einträge tragen den mlIdx des Maschinen-Log-Eintrags als
// Rückverweis. Ältere Datenstände (vor #276) haben Einträge OHNE mlIdx-Feld
// — sie sind faktisch Multi-Tab-Verteilungen aus derselben Maschinenfüllung.
//
// Reproduzierte Bugs:
//   A) Legacy (mlIdx undefined): 3 E/250 kg im Maschinenlog + 3 E/250 kg als
//      Schlag-Entry ohne mlIdx → bisher 6 E/500 kg (Doppelzählung).
//   B) Orphan (mlIdx zeigt auf gelöschten Maschinenlog-Eintrag): 3 E/250 kg
//      im Schlag mit mlIdx=5, machineLog.length < 6 → bisher Anzeige leer.
//
// Strategie (konservativ, datenbasiert; siehe _aggregateFilledAmounts):
//   1. mlIdx >= 0 + machineLog[mlIdx] existiert: bereits gezählt → skip.
//   2. mlIdx >= 0 + machineLog[mlIdx] NICHT vorhanden (Orphan): realer
//      Single-Tab-Eintrag, Maschinenlog-Zeile wurde gelöscht → zählen.
//   3. mlIdx < 0 (explizit single): zählen.
//   4. mlIdx undefined (Legacy): Zeit-/Zählerstand-Match gegen Maschinenlog.
//      - Wenn HH:MM und — soweit vorhanden — Zählerstand passen UND
//        der Eintrag mengenmäßig in die Verteilung passt (einzelne
//        Verteilungsmenge ≤ Maschinenlog-Menge): behandeln als Teil der
//        Multi-Tab-Verteilung → skip.
//      - Sonst: realer Single-Tab-Eintrag → zählen (NIE wegwerfen).
//
// Gemischte Neudaten dürfen weder zu Doppelzählung noch zu Datenverlust
// führen.

describe('Lokales Protokoll — Legacy/Orphan-Heuristik (Review-Fix)', () => {
  let w, doc;
  beforeEach(() => {
    var d = createDom();
    w = d.window; doc = d.window.document;
  });

  // Hilfsfunktion: HH:MM-Key aus Eintrag ableiten (gleich wie in der
  // Heuristik in render-local-protocol.js). Akzeptiert Date.now() (Zahl)
  // und HH:MM-Strings.
  function _hhmmKey(t) {
    if (t == null) return '';
    if (typeof t === 'number' && isFinite(t)) {
      var d = new Date(t);
      return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }
    if (typeof t === 'string') {
      var m = t.match(/^(\d{1,2}):(\d{2})/);
      if (m) return m[1].padStart(2, '0') + ':' + m[2];
    }
    return '';
  }

  it('Bug A (Legacy ohne mlIdx): 3 E/250 kg Maschinenlog + 3 E/250 kg Entry ohne mlIdx → 3 E/250 kg (NICHT 6/500)', () => {
    var t = new Date();
    var ts = t.getTime();
    var hhmm = _hhmmKey(ts);
    // Schlag-Eintrag OHNE mlIdx (Legacy-Format), aber mit Timestamp-Zeit,
    // der zur selben HH:MM wie der Maschinenlog-Eintrag gehört.
    setUpTab(w, 0, { hektar: 10, koerner: 90000, duenger: 100,
      entries: [{ einheit: 3, duenger: 250, time: ts }] });
    w.state.machineLog = [
      { einheit: 3, duenger: 250, zaehlerStand: 5, time: hhmm, distributed: 3 }
    ];
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var filled = doc.getElementById('local_protocol_balance_filled');
    // Erwartung: 3 E Saat, 250 kg Dünger (NICHT 6 E/500 kg).
    expect(filled.textContent).toContain('3,000 Einh.');
    expect(filled.textContent).not.toContain('6,000');
    // Dünger halbiert-prüfen: 250 muss enthalten sein, 500 NICHT.
    expect(filled.textContent).toContain('250');
    expect(filled.textContent).not.toContain('500');
  });

  it('Bug B (Orphan: mlIdx außerhalb machineLog): 3 E/250 kg mit mlIdx=99, machineLog leer → 3 E/250 kg (NICHT leer)', () => {
    setUpTab(w, 0, { hektar: 10, koerner: 90000, duenger: 100,
      entries: [{ einheit: 3, duenger: 250, mlIdx: 99, time: '10:00' }] });
    w.state.machineLog = [];
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var filled = doc.getElementById('local_protocol_balance_filled');
    // Anzeige darf NICHT leer sein.
    expect(filled.hidden).toBe(false);
    expect(filled.textContent).toContain('3,000 Einh.');
    expect(filled.textContent).toContain('250');
  });

  it('Gemischte Neudaten: Multi-Tab (mlIdx=0) + Single-Tab (mlIdx=-1) + Legacy-Entry (kein mlIdx) werden korrekt aggregiert', () => {
    var ts = Date.now();
    var hhmm = _hhmmKey(ts);
    // Tabs 1 + 2 hinzufügen (createDom liefert initial 1 Tab).
    w.addReiter();
    w.addReiter();
    setUpTab(w, 0, { hektar: 10, koerner: 90000, duenger: 100, entries: [
      { einheit: 3, duenger: 200, mlIdx: 0, time: ts }   // Multi-Tab-Verteilung an Schlag 0
    ] });
    // Tab 1 (Single-Tab) hat einen unabhängigen Eintrag (mlIdx=-1).
    setUpTab(w, 1, { hektar: 8, koerner: 85000, duenger: 140, entries: [
      { einheit: 1.5, duenger: 100, mlIdx: -1, time: '11:00' }
    ] });
    // Tab 2 (Legacy, ohne mlIdx) hat einen Eintrag, dessen Zeit zum
    // Maschinenlog passt → Legacy-Heuristik schlägt zu.
    setUpTab(w, 2, { hektar: 5, koerner: 80000, duenger: 120, entries: [
      { einheit: 1, duenger: 50, time: ts }
    ] });
    // Maschinenlog: 3 E/200 kg aus dem Multi-Tab-Push.
    w.state.machineLog = [
      { einheit: 3, duenger: 200, zaehlerStand: 5, time: hhmm, distributed: 3 }
    ];
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var filled = doc.getElementById('local_protocol_balance_filled');
    // Erwartung: 3 E (ml) + 1,5 E (Tab 1 single) + 0 E (Tab 2 legacy, von
    // Heuristik als covered erkannt) = 4,500 E. Dünger: 200 + 100 + 0 = 300.
    expect(filled.textContent).toContain('4,500 Einh.');
    expect(filled.textContent).toContain('300');
    expect(filled.textContent).not.toContain('5,500');
    expect(filled.textContent).not.toContain('350');
  });

  it('Legacy-Entry OHNE Zeit-Match: bleibt als realer Single-Tab-Eintrag erhalten (konservativ)', () => {
    // Maschinenlog-Eintrag mit HH:MM "08:00", Legacy-Entry mit HH:MM "12:00"
    // → kein Match → der Legacy-Entry ist ein realer Single-Tab-Eintrag.
    setUpTab(w, 0, { hektar: 10, koerner: 90000, duenger: 100,
      entries: [{ einheit: 2, duenger: 100, time: '12:00' }] });
    w.state.machineLog = [
      { einheit: 3, duenger: 250, zaehlerStand: 5, time: '08:00', distributed: 3 }
    ];
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var filled = doc.getElementById('local_protocol_balance_filled');
    // 3 E/250 kg aus machineLog + 2 E/100 kg aus dem unverknüpften Legacy-
    // Eintrag = 5 E und 350 kg.
    expect(filled.textContent).toContain('5,000 Einh.');
    expect(filled.textContent).toContain('350');
  });

  it('Legacy-Entry mit gleicher Uhrzeit aber anderem Zählerstand bleibt eigenständig', () => {
    setUpTab(w, 0, { hektar: 10, koerner: 90000, duenger: 100,
      entries: [{ einheit: 1, duenger: 50, hektar: 7, time: '10:00' }] });
    w.state.machineLog = [
      { einheit: 3, duenger: 250, hektar: 5, time: '10:00' }
    ];
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var filled = doc.getElementById('local_protocol_balance_filled');
    expect(filled.textContent).toContain('4,000 Einh.');
    expect(filled.textContent).toContain('300');
  });

  it('Legacy-Entry: Menge > Maschinenlog-Menge wird NICHT als covered behandelt (Menge-Check)', () => {
    // Maschinenlog: 1 E / 50 kg um 10:00. Legacy-Entry OHNE mlIdx, 5 E /
    // 200 kg um 10:00 → kann nicht Teil der Maschinenlog-Verteilung sein
    // (entry.einheit > ml.einheit) → als realer Single-Tab-Eintrag werten.
    var t = new Date();
    t.setHours(10, 0, 0, 0);
    var ts = t.getTime();
    setUpTab(w, 0, { hektar: 10, koerner: 90000, duenger: 100,
      entries: [{ einheit: 5, duenger: 200, time: ts }] });
    w.state.machineLog = [
      { einheit: 1, duenger: 50, zaehlerStand: 5, time: '10:00', distributed: 1 }
    ];
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var filled = doc.getElementById('local_protocol_balance_filled');
    // 1 E (ml) + 5 E (legacy, mismatch → real) = 6 E. 50 + 200 = 250 kg.
    expect(filled.textContent).toContain('6,000 Einh.');
    expect(filled.textContent).toContain('250');
  });

  it('Orphan (mlIdx=0) + vorhandene machineLog-Zeile 0: orphan-Eintrag zählt NICHT (verknüpfte Logik greift)', () => {
    setUpTab(w, 0, { hektar: 10, koerner: 90000, duenger: 100, entries: [
      // mlIdx zeigt auf eine existierende machineLog-Zeile → korrekt verknüpft.
      { einheit: 2, duenger: 200, mlIdx: 0, time: '10:00' }
    ] });
    w.state.machineLog = [
      { einheit: 3, duenger: 250, zaehlerStand: 5, time: '10:00', distributed: 3 }
    ];
    w.state.activeView = 'protokoll';
    w.renderLocalProtocol();
    var filled = doc.getElementById('local_protocol_balance_filled');
    // Nur machineLog zählt: 3 E / 250 kg. Entry ist verknüpft → skip.
    expect(filled.textContent).toContain('3,000 Einh.');
    expect(filled.textContent).not.toContain('5,000');
    expect(filled.textContent).toContain('250');
    expect(filled.textContent).not.toContain('450');
  });
});
