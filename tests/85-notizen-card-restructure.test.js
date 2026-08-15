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
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

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