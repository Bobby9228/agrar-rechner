import { createDom } from './helpers.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * Lokales Protokoll (View, Redesign, Notizen-Card, Inline-Redesign)
 * Zusammengeführt in Issue #419 (Welle 3) aus:
 * 22-protocol-view.test.js, 84-local-protocol-redesign.test.js, 85-notizen-card-restructure.test.js, 86-inline-protocol-redesign.test.js
 * Jede Quelldatei ist als eigener describe-Block vollständig
 * erhalten (nur Import-Zeilen dedupliziert) — keine Assertions
 * wurden verändert oder entfernt.
 */

describe('Lokales Protokoll (View, Redesign, Notizen-Card, Inline-Redesign) — übernommen aus 22-protocol-view.test.js', () => {
/**
 * Test 22: Protocol view — switchToProtokoll + renderView
 *
 * The Protokoll view is a View-Toggle (Issue #291, Pre-#291 pattern): the
 * 🔧 tab button is NOT a separate tab; it's a view-mode toggle that swaps
 * the main content between "Feld" (input/results cards) and "Protokoll"
 * (drill_section). `state.activeView` tracks the current view:
 *   - 'protokoll' → Protokoll-Ansicht (drill_section sichtbar)
 *   - null        → Feld-Ansicht (input/results cards sichtbar)
 *
 * Tests cover:
 *   - switchToProtokoll() sets/clears state.activeView
 *   - renderView() toggles .card visibility (drill_section on, rest off)
 *   - renderView() hides results even when tab has data, when in protokoll
 *   - state.activeView roundtrips through localStorage
 *   - switchReiter() resets activeView to null (Tab-Wechsel beendet Protokoll)
 */

function getDrillSection(w) { return w.document.getElementById('drill_section'); }
function getDrillMask(w) { return w.document.getElementById('drill_mask'); }
function getResults(w) { return w.document.getElementById('results'); }
function getProtokollBtn(w) { return w.document.getElementById('protokoll_tab_btn'); }

describe('switchToProtokoll()', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('switches to protokoll view from field view', () => {
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '90000';
    w.syncStateFromInputs();
    w.renderResults();

    expect(w.state.activeView).toBeNull();
    w.switchToProtokoll();

    expect(w.state.activeView).toBe('protokoll');
  });

  it('switches back to field view when already in protokoll', () => {
    w.switchToProtokoll(); // → protokoll
    expect(w.state.activeView).toBe('protokoll');

    w.switchToProtokoll(); // → back to null
    expect(w.state.activeView).toBeNull();
  });

  it('calls renderDrillTabList when entering protokoll', () => {
    w.addReiter();
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 90000;
    w.state.reiter[0].duenger = 150;
    w.saveState();

    w.switchToProtokoll();

    // renderDrillTabList should have created elements
    expect(w.document.getElementById('dtl_prio_0')).toBeTruthy();
    expect(w.document.getElementById('dtl_e_0')).toBeTruthy();
  });

  it('syncs state from inputs before switching', () => {
    w.document.getElementById('hektar').value = '15';
    w.document.getElementById('koerner').value = '80000';

    w.switchToProtokoll();

    // syncStateFromInputs reads hektar/koerner inputs into state
    expect(w.state.reiter[0].hektar).toBe(15);
    expect(w.state.reiter[0].koerner).toBe(80000);
  });

  it('persists view state to localStorage', () => {
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '90000';
    w.syncStateFromInputs();
    w.renderResults(); // Ensure state is initialized and sv() works

    w.switchToProtokoll();

    const saved = JSON.parse(w.localStorage.getItem('agrar_rechner'));
    expect(saved.activeView).toBe('protokoll');
  });

  it('marks protokoll tab button as active when entering protokoll', () => {
    w.switchToProtokoll();
    expect(getProtokollBtn(w).classList.contains('active')).toBe(true);
  });

  it('unmarks protokoll tab button when leaving protokoll', () => {
    w.switchToProtokoll();
    w.switchToProtokoll();
    expect(getProtokollBtn(w).classList.contains('active')).toBe(false);
  });
});

describe('renderView()', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('hides all cards except drill_section when in protokoll view', () => {
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '90000';
    w.syncStateFromInputs();
    w.renderResults();
    w.switchToProtokoll();

    const cards = w.document.querySelectorAll('.card');
    cards.forEach(c => {
      if (c.id === 'drill_section') {
        expect(c.style.display).toBe('block');
      } else {
        expect(c.style.display).toBe('none');
      }
    });
  });

  it('hides results in protokoll mode even with data', () => {
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '90000';
    w.syncStateFromInputs();
    w.renderResults();

    w.state.activeView = 'protokoll';
    w.renderView();

    expect(getResults(w).style.display).toBe('none');
  });

  it('shows drill section in protokoll mode', () => {
    w.state.activeView = 'protokoll';
    w.renderView();
    expect(getDrillSection(w).style.display).toBe('block');
  });

  it('shows drill mask in protokoll mode (clears display:none)', () => {
    w.state.activeView = 'protokoll';
    w.renderView();
    // drill_mask starts with style="display:none" in the HTML — renderView
    // resets it to '' (default) when in protokoll mode
    expect(getDrillMask(w).style.display).toBe('');
  });

  it('hides drill section in field mode', () => {
    w.renderView();
    expect(getDrillSection(w).style.display).toBe('none');
  });

  it('shows results in field mode when tab has data', () => {
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '90000';
    w.syncStateFromInputs();
    w.renderResults();

    expect(getResults(w).style.display).toBe('block');
  });

  it('hides results when no data in field mode', () => {
    w.renderView();
    expect(getResults(w).style.display).toBe('none');
  });
});

describe('switchReiter resets activeView from protokoll', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('switchReiter(0) when in protokoll view returns to field view (same tab)', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000 };
    w.switchToProtokoll();
    expect(w.state.activeView).toBe('protokoll');
    expect(w.state.activeReiter).toBe(0);

    // Tab-Klick aus dem Protokoll-Tab zurück in den Feld-Tab:
    // activeView muss null werden, sonst bleibt das Protokoll sichtbar.
    w.switchReiter(0);
    expect(w.state.activeView).toBeNull();
    expect(w.state.activeReiter).toBe(0);
  });

  it('switchReiter(1) when in protokoll view switches tab AND exits protokoll', () => {
    w.addReiter();
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000 };
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 5, koerner: 80000 };
    w.switchToProtokoll();
    expect(w.state.activeView).toBe('protokoll');

    w.switchReiter(1);
    expect(w.state.activeView).toBeNull();
    expect(w.state.activeReiter).toBe(1);
  });

  it('switchReiter from protokoll triggers renderView so drill_section hides', () => {
    w.addReiter();
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000 };
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 5, koerner: 80000 };
    w.switchToProtokoll();
    expect(getDrillSection(w).style.display).toBe('block');

    w.switchReiter(1);
    // Nach Tab-Wechsel ist drill_section wieder versteckt
    expect(getDrillSection(w).style.display).toBe('none');
  });
});

describe('state.activeView persistence', () => {
  it('roundtrips activeView=protokoll through localStorage', () => {
    const { window: w, store } = createDom();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '90000';
    w.syncStateFromInputs();
    w.renderResults();
    w.switchToProtokoll();
    expect(w.state.activeView).toBe('protokoll');

    // Re-read from localStorage
    const saved = JSON.parse(store['agrar_rechner']);
    expect(saved.activeView).toBe('protokoll');
  });

  it('roundtrips activeView=null through localStorage', () => {
    const { window: w, store } = createDom();
    w.saveState();
    const saved = JSON.parse(store['agrar_rechner']);
    expect(saved.activeView).toBeNull();
  });
});
});

describe('Lokales Protokoll (View, Redesign, Notizen-Card, Inline-Redesign) — übernommen aus 84-local-protocol-redesign.test.js', () => {
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
      { einheit: 3, duenger: 250, zaehlerStand: 5, time: '10:00' }
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
      { einheit: 3, duenger: 150, zaehlerStand: 5, time: '10:00' }
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
      { einheit: 3, duenger: 250, zaehlerStand: 5, time: hhmm }
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
      { einheit: 3, duenger: 200, zaehlerStand: 5, time: hhmm }
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
      { einheit: 3, duenger: 250, zaehlerStand: 5, time: '08:00' }
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
      { einheit: 1, duenger: 50, zaehlerStand: 5, time: '10:00' }
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
      { einheit: 3, duenger: 250, zaehlerStand: 5, time: '10:00' }
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
});

describe('Lokales Protokoll (View, Redesign, Notizen-Card, Inline-Redesign) — übernommen aus 85-notizen-card-restructure.test.js', () => {
/**
 * Regression tests für die Karten-Restrukturierung (Notizen pro Schlag,
 * Dünger in die Eingabekarte integriert, IST-Fläche in den
 * Einstellungsbereich verschoben).
 *
 * Abdeckung:
 *   1) Struktur/Reihenfolge — Reihenfolge der Felder in card_input,
 *      Existenz + Reihenfolge der Karten (Notizen, Einstellungen) und
 *      dass die alten IDs (hektar, ist_hektar, koerner, duenger,
 *      einheit_groesse_*, fahrgassen_*) weiterhin vorhanden sind.
 *   2) Notiz-Persistenz — saveState() schreibt r.notizen mit,
 *      loadState() restauriert sie, alte States ohne notizen laden
 *      sauber durch (Backwards-Compat).
 *   3) Tab-Wechsel — Notizen werden pro Tab/Reiter separat gespeichert
 *      und beim Tab-Wechsel via syncInputsFromState() in die textarea
 *      geladen.
 *   4) Reset-Pfade — resetActiveTab() und resetAll() leeren die Notiz
 *      des aktiven Tabs bzw. aller Tabs.
 */

describe('Karten-Restrukturierung: Struktur & Reihenfolge', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('Eingabekarte enthält die Pflicht-IDs in der richtigen Reihenfolge', () => {
    var card = doc.getElementById('card_input');
    expect(card).toBeTruthy();
    var ids = ['hektar', 'koerner', 'duenger'];
    ids.forEach(function(id) {
      var el = doc.getElementById(id);
      expect(el, 'Element #' + id + ' fehlt').toBeTruthy();
      // Element muss ein Nachfahre der Karte sein.
      expect(card.contains(el), '#' + id + ' muss in #card_input liegen').toBe(true);
    });
    // Reihenfolge: Hektar (SOLL) → Körner pro Hektar → Dünger (kg/ha).
    // Vergleicht zwei Elemente über compareDocumentPosition
    // (Node.DOCUMENT_POSITION_FOLLOWING = 4): ist `cur` im Dokument
    // NACH `prev`, liefert das Bit einen Treffer. Robust gegen
    // unterschiedliche DOM-Tiefen.
    function follows(prev, cur) {
      return (prev.compareDocumentPosition(cur) & 4) !== 0;
    }
    var he = doc.getElementById('hektar');
    var ko = doc.getElementById('koerner');
    var du = doc.getElementById('duenger');
    expect(follows(he, ko), 'hektar muss vor koerner kommen').toBe(true);
    expect(follows(ko, du), 'koerner muss vor duenger kommen').toBe(true);
  });

  it('Es existiert eine separate Notizen-Karte mit textarea#notizen', () => {
    var card = doc.getElementById('card_notes');
    expect(card).toBeTruthy();
    var ta = doc.getElementById('notizen');
    expect(ta).toBeTruthy();
    expect(ta.tagName.toLowerCase()).toBe('textarea');
    expect(card.contains(ta)).toBe(true);
  });

  it('Es existiert eine separate Einstellungs-Karte (card_settings)', () => {
    var card = doc.getElementById('card_settings');
    expect(card).toBeTruthy();
  });

  it('Einstellungs-Karte enthält IST-Fläche, Einheiten-Größe und Fahrgassen', () => {
    var card = doc.getElementById('card_settings');
    expect(card.contains(doc.getElementById('ist_hektar'))).toBe(true);
    expect(card.contains(doc.getElementById('einheit_groesse_toggle'))).toBe(true);
    expect(card.contains(doc.getElementById('einheit_groesse_settings'))).toBe(true);
    expect(card.contains(doc.getElementById('fahrgassen_toggle'))).toBe(true);
    expect(card.contains(doc.getElementById('fahrgassen_settings'))).toBe(true);
  });

  it('Reihenfolge in der Einstellungs-Karte: IST-Fläche → Einheiten-Größe → Fahrgassen', () => {
    function follows(prev, cur) {
      return (prev.compareDocumentPosition(cur) & 4) !== 0;
    }
    var ids = ['ist_hektar', 'einheit_groesse_toggle', 'fahrgassen_toggle'];
    for (var i = 1; i < ids.length; i++) {
      var prev = doc.getElementById(ids[i - 1]);
      var cur = doc.getElementById(ids[i]);
      expect(follows(prev, cur), ids[i - 1] + ' muss vor ' + ids[i] + ' kommen').toBe(true);
    }
  });

  it('Karten-Reihenfolge im DOM: card_input → card_notes → card_settings', () => {
    function follows(prev, cur) {
      return (prev.compareDocumentPosition(cur) & 4) !== 0;
    }
    expect(follows(doc.getElementById('card_input'), doc.getElementById('card_notes'))).toBe(true);
    expect(follows(doc.getElementById('card_notes'), doc.getElementById('card_settings'))).toBe(true);
  });

  it('Es gibt KEINE separate "Dünger"-Karte mehr (Dünger ist integriert)', () => {
    var cards = doc.querySelectorAll('.card');
    var duengerCard = false;
    cards.forEach(function(c) {
      var h2 = c.querySelector('h2');
      if (h2 && h2.textContent.indexOf('Dünger') !== -1 && c.id !== 'card_input') {
        duengerCard = true;
      }
    });
    expect(duengerCard).toBe(false);
  });
});

describe('Notiz-Persistenz', () => {
  let w, doc, store;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = result.window.document;
    store = result.store;
  });

  it('Notiz landet nach saveState() in localStorage und wird korrekt geladen', () => {
    // Realistischer Round-Trip: vorhandenen Snapshot via loadState()
    // laden (Migration 0→9 → _lv=9), dann Eingabe + saveState().
    store['agrar_rechner'] = JSON.stringify({
      reiter: [{ name: 'Schlag 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [] }],
      activeReiter: 0,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      einheitGroesseEnabled: false,
      koernerProEinheit: 50000,
      machineLog: [],
      drillPriorities: {}
    });
    w.loadState();
    doc.getElementById('notizen').value = 'Vorgewende nass, Charge 42';
    w.syncStateFromInputs();
    w.saveState();
    var persisted = JSON.parse(store['agrar_rechner']);
    expect(persisted.reiter[0].notizen).toBe('Vorgewende nass, Charge 42');
    expect(persisted._lv).toBe(9);
  });

  it('Reload nach Reload restauriert die Notiz in das textarea-Element', () => {
    store['agrar_rechner'] = JSON.stringify({
      _lv: 9,
      reiter: [{ name: 'X', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], notizen: 'Saatgut Charge 42' }],
      activeReiter: 0,
      einheitGroesseEnabled: false,
      koernerProEinheit: 50000,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      machineLog: [],
      drillPriorities: {}
    });
    w.loadState();
    // loadState() allein befüllt die Inputs nicht — syncInputsFromState()
    // ist der Brücken-Pfad state → DOM (genau wie TAB_CHANGED).
    w.syncInputsFromState();
    expect(doc.getElementById('notizen').value).toBe('Saatgut Charge 42');
  });

  it('Alter State OHNE notizen-Feld lädt sauber durch (Backwards-Compat)', () => {
    // Migration 0→9 muss für ein altes reiter-Objekt ohne notizen einen
    // Default '' vergeben — sonst zeigt die textarea undefined oder null.
    store['agrar_rechner'] = JSON.stringify({
      reiter: [{ name: 'Schlag 1', hektar: 10, koerner: 90000, duenger: 150, entries: [] }],
      activeReiter: 0,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      einheitGroesseEnabled: false,
      koernerProEinheit: 50000,
      machineLog: [],
      drillPriorities: {}
    });
    w.loadState();
    expect(w.state.reiter[0].notizen).toBe('');
    expect(doc.getElementById('notizen').value).toBe('');
    // Persistierter Snapshot wurde auf _lv=9 angehoben.
    expect(JSON.parse(store['agrar_rechner'])._lv).toBe(9);
  });

  it('Manipulierter notizen-Wert (kein String) wird auf "" normalisiert', () => {
    store['agrar_rechner'] = JSON.stringify({
      _lv: 9,
      reiter: [{ name: 'X', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], notizen: 12345 }],
      activeReiter: 0,
      einheitGroesseEnabled: false,
      koernerProEinheit: 50000,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      machineLog: [],
      drillPriorities: {}
    });
    w.loadState();
    expect(w.state.reiter[0].notizen).toBe('');
  });

  it('Übergroße Notiz (länger als 500 Zeichen) wird beim Sanitisieren gekappt', () => {
    var huge = 'x';
    for (var i = 0; i < 600; i++) huge += 'x';
    store['agrar_rechner'] = JSON.stringify({
      _lv: 9,
      reiter: [{ name: 'X', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], notizen: huge }],
      activeReiter: 0,
      einheitGroesseEnabled: false,
      koernerProEinheit: 50000,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      machineLog: [],
      drillPriorities: {}
    });
    w.loadState();
    expect(w.state.reiter[0].notizen.length).toBe(500);
  });
});

describe('Notiz pro Schlag/Reiter (Tabwechsel)', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('onInputNotizen schreibt auf den aktiven Reiter', () => {
    w.addReiter();                              // active = 1
    var ta = doc.getElementById('notizen');
    ta.value = 'Notiz für Schlag 2';
    w.onInputNotizen(ta);
    expect(w.state.reiter[1].notizen).toBe('Notiz für Schlag 2');
    expect(w.state.reiter[0].notizen).toBe('');
  });

  it('Tab-Wechsel zeigt die Notiz des Ziel-Reiters in der textarea', () => {
    w.addReiter();                              // active = 1 (Schlag 2)
    var ta = doc.getElementById('notizen');
    ta.value = 'Notiz Schlag 2';
    w.onInputNotizen(ta);
    w.switchReiter(0);                          // zurück auf Schlag 1
    expect(doc.getElementById('notizen').value).toBe('');
    w.switchReiter(1);                          // wieder Schlag 2
    expect(doc.getElementById('notizen').value).toBe('Notiz Schlag 2');
  });

  it('Mehrere Tabs mit unterschiedlichen Notizen bleiben separat erhalten', () => {
    w.addReiter();
    w.switchReiter(0);
    doc.getElementById('notizen').value = 'A-Notiz';
    w.onInputNotizen(doc.getElementById('notizen'));
    w.switchReiter(1);
    doc.getElementById('notizen').value = 'B-Notiz';
    w.onInputNotizen(doc.getElementById('notizen'));
    expect(w.state.reiter[0].notizen).toBe('A-Notiz');
    expect(w.state.reiter[1].notizen).toBe('B-Notiz');
    w.switchReiter(0);
    expect(doc.getElementById('notizen').value).toBe('A-Notiz');
    w.switchReiter(1);
    expect(doc.getElementById('notizen').value).toBe('B-Notiz');
  });

  it('addReiter initialisiert die Notiz des neuen Tabs mit ""', () => {
    w.addReiter();
    expect(w.state.reiter[1].notizen).toBe('');
    expect(doc.getElementById('notizen').value).toBe('');
  });

  it('resetActiveTab leert die Notiz des aktiven Tabs', () => {
    doc.getElementById('notizen').value = 'Wird gleich weg sein';
    w.onInputNotizen(doc.getElementById('notizen'));
    expect(w.state.reiter[0].notizen).toBe('Wird gleich weg sein');
    w.resetActiveTab();
    expect(w.state.reiter[0].notizen).toBe('');
    expect(doc.getElementById('notizen').value).toBe('');
  });

  it('resetAll leert die Notizen aller Tabs', () => {
    w.addReiter();
    w.switchReiter(0);
    doc.getElementById('notizen').value = 'A';
    w.onInputNotizen(doc.getElementById('notizen'));
    w.switchReiter(1);
    doc.getElementById('notizen').value = 'B';
    w.onInputNotizen(doc.getElementById('notizen'));
    expect(w.state.reiter[0].notizen).toBe('A');
    expect(w.state.reiter[1].notizen).toBe('B');
    w.resetAll();
    expect(w.state.reiter.length).toBe(1);
    expect(w.state.reiter[0].notizen).toBe('');
    expect(doc.getElementById('notizen').value).toBe('');
  });

  it('Notiz überlebt einen simulierten Reload (saveState → loadState → syncInputs)', () => {
    doc.getElementById('notizen').value = 'persistent';
    w.onInputNotizen(doc.getElementById('notizen'));
    w.saveState();
    // Reset des in-memory-State + simulate Reload
    w.state = {
      reiter: [{ name: 'Schlag 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], notizen: '' }],
      activeReiter: 0,
      einheitGroesseEnabled: false,
      koernerProEinheit: 50000,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      machineLog: [],
      drillPriorities: {}
    };
    doc.getElementById('notizen').value = '';
    w.loadState();
    w.syncInputsFromState();
    expect(doc.getElementById('notizen').value).toBe('persistent');
  });
});
});

describe('Lokales Protokoll (View, Redesign, Notizen-Card, Inline-Redesign) — übernommen aus 86-inline-protocol-redesign.test.js', () => {
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
});
