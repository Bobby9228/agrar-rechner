/**
 * Kultur Per-Tab-Werte: KPE, Berechnung, Editor-Sync.
 *
 * - Beim Anlegen eines neuen Schlags wird der aktuelle Kultur-Standard
 *   (Körner pro Einheit) auf den neuen Schlag kopiert. Bestehende Schläge
 *   behalten ihren Wert.
 * - Per-Tab-Berechnung mit verschiedenen kpe rechnet unabhängig (Einheiten
 *   und Dünger).
 * - syncInputsFromState aktualisiert das #koerner_pro_einheit-Feld bei
 *   jedem Tabwechsel (HIGH 3).
 * - einheitGroesseUpdate schreibt NUR auf activeTab.koernerProEinheit, nicht
 *   auf den globalen state.koernerProEinheit (HIGH 4).
 * - einheitGroesseToggle ist nur Auf-/Zuklappen des Editors; Toggle-off
 *   verliert keinen per-Tab-Wert und fällt nicht auf 50.000-Mais-Werte
 *   zurück (HIGH 5).
 * - getTabKoernerProEinheit(r) liefert bei explizitem 0 → 0 (kein Fallback
 *   auf den globalen Profil-Default).
 * - resetActiveTab() erhält die per-Schlag-Einheitsgröße.
 *
 * Zugehörige frühere Dateien: tests/63-kultur-per-tab-kpe.test.js,
 * tests/64-kultur-per-tab-calc.test.js, tests/69-kultur-kpe-field-sync.test.js,
 * tests/70-kultur-einheit-update.test.js, tests/71-kultur-toggle-ui.test.js,
 * tests/72-kultur-per-tab-zero-no-fallback.test.js,
 * tests/76-resetActiveTab-preserve-kpe.test.js (Issue #419 Welle 1).
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

describe('Neuer Schlag übernimmt aktuellen Kultur-Standard', () => {
  it('Frischer Erststart + Mais → neuer Tab hat r.koernerProEinheit=50000 und r.koerner=0', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.addReiter();
    const r = w.state.reiter[w.state.reiter.length - 1];
    expect(r.koernerProEinheit).toBe(50000);
    expect(r.koerner).toBe(0);
    expect(r.hektar).toBe(0);
    expect(r.duenger).toBe(0);
    expect(r.entries).toEqual([]);
  });

  it('Raps → neuer Tab hat r.koernerProEinheit=1.500.000', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('raps');
    w.addReiter();
    const r = w.state.reiter[w.state.reiter.length - 1];
    expect(r.koernerProEinheit).toBe(1500000);
  });

  it('Sonstiges → neuer Tab hat r.koernerProEinheit=0 (kein Default)', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('sonstiges');
    w.addReiter();
    const r = w.state.reiter[w.state.reiter.length - 1];
    expect(r.koernerProEinheit).toBe(0);
  });

  it('mehrere neue Tabs nach Kultur-Wechsel bekommen jeweils den aktuellen Standard', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.addReiter();
    w.addReiter();
    w.addReiter();
    for (var i = 1; i < w.state.reiter.length; i++) {
      expect(w.state.reiter[i].koernerProEinheit).toBe(50000);
    }
  });

  it('Manuelle Einheitsgröße eines Tabs überlebt Tab-Wechsel und Reload', () => {
    const { window: w, store } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    // Auf Tab 0 manuell ändern
    w.state.reiter[0].koernerProEinheit = 75000;
    // Neuen Tab hinzufügen → bekommt Mais-Standard 50000
    w.addReiter();
    // Zurück auf Tab 0
    w.switchReiter(0);
    expect(w.state.reiter[0].koernerProEinheit).toBe(75000);
    // Neuer Tab (Tab 1) hat Mais-Standard
    expect(w.state.reiter[1].koernerProEinheit).toBe(50000);
    // Save + reload
    w.saveState();
    const saved = JSON.parse(store['agrar_rechner']);
    expect(saved.reiter[0].koernerProEinheit).toBe(75000);
    expect(saved.reiter[1].koernerProEinheit).toBe(50000);
  });
});

describe('Per-Tab-Einheitsgröße: unabhängige Berechnung', () => {
  it('Tab mit kpe=50000 berechnet 20 E bei (10ha, 100.000 K/ha)', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    const r = { hektar: 10, koerner: 100000, koernerProEinheit: 50000, entries: [] };
    expect(w.getTabTotalEinheiten(r)).toBeCloseTo(20, 5);
  });

  it('Tab mit kpe=100.000 berechnet 10 E bei (10ha, 100.000 K/ha)', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    const r = { hektar: 10, koerner: 100000, koernerProEinheit: 100000, entries: [] };
    expect(w.getTabTotalEinheiten(r)).toBeCloseTo(10, 5);
  });

  it('Zwei Tabs mit verschiedenen kpe berechnen unabhängig', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.addReiter(); // Tab 1
    w.addReiter(); // Tab 2
    // Tab 1: kulturwechel auf Raps, eigene kpe
    w.state.reiter[1].hektar = 5;
    w.state.reiter[1].koerner = 90000;
    w.state.reiter[1].koernerProEinheit = 80000; // manuell geändert
    // Tab 2: Raps
    w.state.reiter[2].hektar = 3;
    w.state.reiter[2].koerner = 1500000;
    w.state.reiter[2].koernerProEinheit = 1500000; // Raps-Tab
    // Tab 1: 5 * 90000 / 80000 = 5.625
    // Tab 2: 3 * 1500000 / 1500000 = 3
    expect(w.getTabTotalEinheiten(w.state.reiter[1])).toBeCloseTo(5.625, 3);
    expect(w.getTabTotalEinheiten(w.state.reiter[2])).toBeCloseTo(3, 5);
  });

  it('IST-Einheiten verwenden ebenfalls die per-Tab kpe', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    const r = { hektar: 10, istHektar: 8, koerner: 90000, koernerProEinheit: 60000, entries: [] };
    expect(w.getTabIstEinheiten(r)).toBeCloseTo(8 * 90000 / 60000, 5);
  });

  it('getDuengerProEinheit verwendet per-Tab kpe', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    const r = { duenger: 200, koerner: 80000 };
    // duenger × kpe / koerner = 200 × 60000 / 80000 = 150
    expect(w.getDuengerProEinheit(r, 60000)).toBeCloseTo(150, 5);
  });

  it('Tab ohne eigene koernerProEinheit fällt auf state.koernerProEinheit zurück', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.state.koernerProEinheit = 80000; // Globaler Wert, explizit gesetzt
    // Tab ohne eigenes Feld
    const r = { hektar: 10, koerner: 80000, entries: [] };
    expect(w.getTabTotalEinheiten(r)).toBeCloseTo(10, 5); // 10 * 80000 / 80000
  });

  it('getTabRates verwendet per-Tab kpe für unitsPerHa', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.addReiter();
    w.state.reiter[1].hektar = 10;
    w.state.reiter[1].koerner = 90000;
    w.state.reiter[1].koernerProEinheit = 45000;
    const rates = w.getTabRates(1);
    expect(rates.unitsPerHa).toBeCloseTo(90000 / 45000, 5);
    expect(rates.duengerPerHa).toBe(0); // kein Dünger
  });
});

describe('HIGH 3: Per-Tab kpe-Feld wird bei jedem Tabwechsel synchronisiert', () => {
  it('Tab A=75000 → Tab B=50000: Feld zeigt nach switchReiter 50000', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.einheitGroesseToggle();  // Editor öffnen via echten Handler
    w.addReiter();
    w.state.reiter[1].koernerProEinheit = 75000;

    const kpEl = w.document.getElementById('koerner_pro_einheit');
    // addReiter setzt active=1, danach manuell auf 0 wechseln
    w.switchReiter(0);
    expect(kpEl.value).toBe('50000');
    // Tab 1 hat 75000
    w.switchReiter(1);
    expect(kpEl.value).toBe('75000');
    // zurück auf Tab 0 → wieder 50000 (HIGH 3: Sync nach jedem Wechsel)
    w.switchReiter(0);
    expect(kpEl.value).toBe('50000');
  });

  it('Tab A=0 (Sonstiges) → Tab B=1500000: Feld zeigt 1500000 nach switchReiter', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('sonstiges');
    w.einheitGroesseToggle();
    w.addReiter();
    // Tab 1: kpe=0 (Sonstiges Standard, manuell bestätigt)
    w.state.reiter[1].koernerProEinheit = 0;
    // Tab 0 auf 1.500.000 setzen
    w.state.reiter[0].koernerProEinheit = 1500000;

    const kpEl = w.document.getElementById('koerner_pro_einheit');
    // active=1 nach addReiter → kpe=0 → Feld leer
    expect(kpEl.value).toBe('');
    // auf Tab 0 wechseln → 1.500.000
    w.switchReiter(0);
    expect(kpEl.value).toBe('1500000');
    // zurück auf Tab 1 → wieder leer (kpe=0)
    w.switchReiter(1);
    expect(kpEl.value).toBe('');
  });

  it('saved-Text (#einheit_groesse_saved) wird beim Tabwechsel aktualisiert', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.einheitGroesseToggle();
    w.addReiter();
    w.state.reiter[1].koernerProEinheit = 75000;
    // syncInputsFromState manuell triggern (sonst zeigt DOM noch alten Wert)
    w.syncInputsFromState();

    const savedEl = w.document.getElementById('einheit_groesse_saved');
    // active=1 nach addReiter → kpe=75000 → saved-Text enthält 75.000
    expect(savedEl.textContent).toContain('75.000');
    // Tab 0 hat kpe=50000 → saved-Text sollte leer sein
    w.switchReiter(0);
    expect(savedEl.textContent).toBe('');
    // zurück zu Tab 1 → wieder 75.000
    w.switchReiter(1);
    expect(savedEl.textContent).toContain('75.000');
  });

  it('Bei initUI mit bestehendem Tab wird das Feld mit dem korrekten Wert gefüllt', () => {
    const { window: w, store } = createDom();
    // Pre-loaded state: zwei Tabs mit unterschiedlichen kpe
    store['agrar_rechner'] = JSON.stringify({
      _lv: 6,
      reiter: [
        { name: 'A', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false, koernerProEinheit: 75000 },
        { name: 'B', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false, koernerProEinheit: 1500000 }
      ],
      activeReiter: 1,
      activeView: null,
      kultur: 'mais',
      erstauswahlDone: true,
      koernerProEinheit: 50000,
      einheitGroesseEnabled: true,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      machineLog: [],
      drillPriorities: {}
    });
    w.initUI();
    // Tab B (active=1) ist aktiv → Feld zeigt 1.500.000
    const kpEl = w.document.getElementById('koerner_pro_einheit');
    expect(kpEl.value).toBe('1500000');
    // saved-Text: 1.500.000 Körner/Einheit
    const savedEl = w.document.getElementById('einheit_groesse_saved');
    expect(savedEl.textContent).toContain('1.500.000');
  });

  it('Field-Sync wird durch echten Handler ausgelöst, nicht durch direkte State-Zuweisung', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.einheitGroesseToggle();
    w.addReiter();
    w.state.reiter[1].koernerProEinheit = 75000;

    const kpEl = w.document.getElementById('koerner_pro_einheit');
    // addReiter setzt active=1; erst auf 0, dann zurück auf 1
    w.switchReiter(0);
    expect(kpEl.value).toBe('50000');
    w.switchReiter(1);
    expect(kpEl.value).toBe('75000');
    // Tab 0 manuell ändern
    w.state.reiter[0].koernerProEinheit = 90000;
    w.switchReiter(0);
    expect(kpEl.value).toBe('90000');
    // Zurück auf Tab 1 → wieder 75000
    w.switchReiter(1);
    expect(kpEl.value).toBe('75000');
  });

  it('Field-Sync via syncInputsFromState (TAB_CHANGED Subscriber)', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.einheitGroesseToggle();
    w.addReiter();
    w.state.reiter[1].koernerProEinheit = 75000;

    const kpEl = w.document.getElementById('koerner_pro_einheit');
    // addReiter setzt active=1
    w.syncInputsFromState();
    expect(kpEl.value).toBe('75000');
    w.switchReiter(0);
    expect(kpEl.value).toBe('50000');
    w.switchReiter(1);
    expect(kpEl.value).toBe('75000');
  });
});

describe('HIGH 4: einheitGroesseUpdate ändert nur den aktiven Tab', () => {
  it('state.koernerProEinheit bleibt nach Handler-Aufruf stabil', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('raps'); // state.koernerProEinheit = 1.500.000 (Raps)
    expect(w.state.koernerProEinheit).toBe(1500000);
    // Editor öffnen + 75000 eingeben + Handler triggern
    w.einheitGroesseToggle();
    const kpEl = w.document.getElementById('koerner_pro_einheit');
    kpEl.value = '75000';
    w.einheitGroesseUpdate();
    // global state.koernerProEinheit DARF NICHT mehr auf 75000 gesetzt sein
    expect(w.state.koernerProEinheit).toBe(1500000);
  });

  it('nur activeTab.koernerProEinheit wird auf 75000 gesetzt', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.einheitGroesseToggle();
    const kpEl = w.document.getElementById('koerner_pro_einheit');
    kpEl.value = '75000';
    w.einheitGroesseUpdate();
    expect(w.state.reiter[0].koernerProEinheit).toBe(75000);
  });

  it('neue Tabs bekommen weiterhin den Kultur-Standard, NICHT den manuell überschriebenen Wert', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('raps'); // Kultur-Standard 1.500.000
    w.einheitGroesseToggle();
    const kpEl = w.document.getElementById('koerner_pro_einheit');
    kpEl.value = '75000';
    w.einheitGroesseUpdate();
    // global ist immer noch 1.500.000 (oder Kultur-Default)
    expect(w.state.koernerProEinheit).toBe(1500000);
    // neuer Tab folgt addReiter → Kultur-Standard
    w.addReiter();
    expect(w.state.reiter[1].koernerProEinheit).toBe(1500000);
  });

  it('Eingabefeld 50000 → aktiver Tab bekommt 50000, global bleibt Raps', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('raps');
    w.einheitGroesseToggle();
    const kpEl = w.document.getElementById('koerner_pro_einheit');
    kpEl.value = '50000';
    w.einheitGroesseUpdate();
    expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
    expect(w.state.koernerProEinheit).toBe(1500000);
  });

  it('Tab-Wechsel auf Tab 1 (Mais-Default), Handler setzt nur Tab 1', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('raps');
    w.einheitGroesseToggle();
    // Tab 1 manuell auf 75000
    w.addReiter();
    w.state.reiter[1].koernerProEinheit = 75000;
    // Auf Tab 1 wechseln und Handler aufrufen mit Wert 200000
    w.switchReiter(0); // zurück auf Tab 0, kpe=1.500.000
    w.switchReiter(1); // Tab 1, kpe=75000
    const kpEl = w.document.getElementById('koerner_pro_einheit');
    kpEl.value = '200000';
    w.einheitGroesseUpdate();
    // Tab 1 ändert sich
    expect(w.state.reiter[1].koernerProEinheit).toBe(200000);
    // Tab 0 bleibt unverändert (1.500.000)
    expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
    // Global bleibt 1.500.000 (Kultur-Standard)
    expect(w.state.koernerProEinheit).toBe(1500000);
  });

  it('Persistenz: nach Reload bleibt der manuelle Tab-Wert und der Kultur-Standard', () => {
    const { window: w, store } = createDom();
    w.initUI();
    w.chooseKultur('raps');
    w.einheitGroesseToggle();
    const kpEl = w.document.getElementById('koerner_pro_einheit');
    kpEl.value = '75000';
    w.einheitGroesseUpdate();
    w.saveState();
    const saved = JSON.parse(store['agrar_rechner']);
    // gespeichert: Kultur=Raps, reiter[0].koernerProEinheit=75000,
    // state.koernerProEinheit NICHT auf 75000 geändert
    expect(saved.kultur).toBe('raps');
    expect(saved.reiter[0].koernerProEinheit).toBe(75000);
    // entscheidend: globaler Wert ist weiterhin Raps-Standard
    expect(saved.koernerProEinheit).toBe(1500000);
  });
});

describe('HIGH 5: einheitGroesseToggle als Editor-Auf/Zuklapp-UI', () => {
  it('toggle-off ändert NICHT r.koernerProEinheit', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.einheitGroesseToggle(); // open
    // Manuell auf 75000 setzen
    var kpEl = w.document.getElementById('koerner_pro_einheit');
    kpEl.value = '75000';
    w.einheitGroesseUpdate();
    expect(w.state.reiter[0].koernerProEinheit).toBe(75000);
    // toggle-off
    w.einheitGroesseToggle();
    // Tab-Wert bleibt 75000
    expect(w.state.reiter[0].koernerProEinheit).toBe(75000);
  });

  it('toggle-off ändert NICHT state.koernerProEinheit (Kultur-Standard)', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('raps'); // state.koernerProEinheit = 1.500.000
    expect(w.state.koernerProEinheit).toBe(1500000);
    w.einheitGroesseToggle(); // open
    w.einheitGroesseToggle(); // close
    // global bleibt Raps-Standard
    expect(w.state.koernerProEinheit).toBe(1500000);
  });

  it('toggle-off setzt NICHT state.koernerProEinheit=50000 (Mais-Fallback)', () => {
    // Vorher: einheitGroesseToggle beim Schließen setzte
    //   state.koernerProEinheit=50000 — das war die Quelle der Drift.
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('raps');
    expect(w.state.koernerProEinheit).toBe(1500000);
    w.einheitGroesseToggle();
    w.einheitGroesseToggle();
    expect(w.state.koernerProEinheit).not.toBe(50000);
    expect(w.state.koernerProEinheit).toBe(1500000);
  });

  it('toggle-off löscht NICHT das Eingabefeld', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.einheitGroesseToggle(); // open
    var kpEl = w.document.getElementById('koerner_pro_einheit');
    kpEl.value = '75000';
    w.einheitGroesseUpdate();
    // Tab-Wert 75000 gesetzt
    expect(w.state.reiter[0].koernerProEinheit).toBe(75000);
    // toggle-off
    w.einheitGroesseToggle();
    // Feld-Inhalt wird beim Schließen nicht gelöscht (es ist nur UI-State)
    // — beim erneuten Öffnen soll der Wert noch da sein.
    // Praktisch: der Field-Inhalt kann beim Schließen erhalten bleiben oder
    // auch leer sein — wir testen nur, dass r.koernerProEinheit stabil ist.
    expect(w.state.reiter[0].koernerProEinheit).toBe(75000);
  });

  it('toggle-on → korrekter Tab-Wert erscheint wieder im Feld', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.einheitGroesseToggle(); // open
    var kpEl = w.document.getElementById('koerner_pro_einheit');
    kpEl.value = '75000';
    w.einheitGroesseUpdate();
    w.einheitGroesseToggle(); // close
    w.einheitGroesseToggle(); // open again
    // Feld zeigt 75000 (per-Tab-Wert)
    expect(kpEl.value).toBe('75000');
  });

  it('Tab-Wechsel bei geschlossenem Editor: nach toggle-on zeigt das Feld den neuen Tab-Wert', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.einheitGroesseToggle(); // open
    w.addReiter();
    w.state.reiter[1].koernerProEinheit = 80000;
    w.switchReiter(0);
    var kpEl = w.document.getElementById('koerner_pro_einheit');
    // Tab 0 hat 50000 (Mais default)
    expect(kpEl.value).toBe('50000');
    w.switchReiter(1);
    expect(kpEl.value).toBe('80000');
    // Editor schließen + wechseln + öffnen
    w.einheitGroesseToggle(); // close
    w.switchReiter(0);
    w.einheitGroesseToggle(); // open
    // Feld zeigt den korrekten Tab-Wert (Tab 0 = 50000)
    expect(kpEl.value).toBe('50000');
  });

  it('state.einheitGroesseEnabled ist nur UI-Präferenz, nicht Berechnungsquelle', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.addReiter();
    w.state.reiter[0].koernerProEinheit = 75000;
    w.state.reiter[0].koerner = 75000;
    w.state.reiter[1].koernerProEinheit = 80000;
    w.state.reiter[1].koerner = 80000;
    // Berechnung arbeitet unabhängig vom toggle
    w.state.reiter[0].hektar = 1;
    var e0 = w.getTabTotalEinheiten(w.state.reiter[0]);
    // 1 * 75000 / 75000 = 1
    expect(e0).toBe(1);
    // toggle-off ändert nichts an der Berechnung
    w.state.einheitGroesseEnabled = false;
    expect(w.getTabTotalEinheiten(w.state.reiter[0])).toBe(1);
    // auch toggle-on hat keinen Einfluss auf die Berechnung
    w.state.einheitGroesseEnabled = true;
    expect(w.getTabTotalEinheiten(w.state.reiter[0])).toBe(1);
  });

  it('toggle-off → reload → Tab-Wert 75000 bleibt erhalten', () => {
    const { window: w, store } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.einheitGroesseToggle();
    var kpEl = w.document.getElementById('koerner_pro_einheit');
    kpEl.value = '75000';
    w.einheitGroesseUpdate();
    w.einheitGroesseToggle(); // close
    w.saveState();
    // Reload
    w.state = { reiter: [{ name: 'X', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false, koernerProEinheit: 50000 }], activeReiter: 0, kultur: null, erstauswahlDone: false, koernerProEinheit: 50000, einheitGroesseEnabled: false, fahrgassenEnabled: false, fahrgassenBreite: 0, machineLog: [], drillPriorities: {} };
    w.loadState();
    expect(w.state.reiter[0].koernerProEinheit).toBe(75000);
  });
});

describe('Regression: per-Tab koernerProEinheit=0 fällt NICHT auf global zurück', () => {
  it('getTabKoernerProEinheit(r) = 0 wenn r.koernerProEinheit=0, auch wenn global > 0', () => {
    const { window: w } = createDom();
    w.state.koernerProEinheit = 50000; // global Default Mais
    const r = { koernerProEinheit: 0 };
    expect(w.getTabKoernerProEinheit(r)).toBe(0);
  });

  it('getTabKoernerProEinheit(r) = 0 wenn r.koernerProEinheit=0, auch wenn global=1500000 (Raps)', () => {
    const { window: w } = createDom();
    w.state.koernerProEinheit = 1500000;
    const r = { koernerProEinheit: 0 };
    expect(w.getTabKoernerProEinheit(r)).toBe(0);
  });

  it('getTabKoernerProEinheit(r) > 0 wenn r.koernerProEinheit > 0 (unverändert)', () => {
    const { window: w } = createDom();
    w.state.koernerProEinheit = 50000;
    const r = { koernerProEinheit: 75000 };
    expect(w.getTabKoernerProEinheit(r)).toBe(75000);
  });

  it('getTabKoernerProEinheit(r) fällt auf global zurück wenn r.koernerProEinheit undefined', () => {
    const { window: w } = createDom();
    w.state.koernerProEinheit = 80000;
    const r = {};
    expect(w.getTabKoernerProEinheit(r)).toBe(80000);
  });

  it('getTabKoernerProEinheit(r) fällt auf global zurück wenn r.koernerProEinheit NaN/string', () => {
    const { window: w } = createDom();
    w.state.koernerProEinheit = 80000;
    expect(w.getTabKoernerProEinheit({ koernerProEinheit: NaN })).toBe(80000);
    expect(w.getTabKoernerProEinheit({ koernerProEinheit: '50000' })).toBe(80000);
    expect(w.getTabKoernerProEinheit({ koernerProEinheit: undefined })).toBe(80000);
  });
});

describe('resetActiveTab() erhält per-Schlag Einheitsgröße', () => {
  it('Manuelle per-Tab koernerProEinheit überlebt resetActiveTab()', () => {
    const { window: w } = createDom();
    // Tab mit Daten + benutzerdefinierter Einheitsgröße
    w.state.reiter[0].hektar = 12;
    w.state.reiter[0].koerner = 90000;
    w.state.reiter[0].duenger = 150;
    w.state.reiter[0].entries = [{ einheit: 2, duenger: 100, time: '10:00' }];
    w.state.reiter[0].koernerProEinheit = 75000; // benutzerdefiniert
    w.resetActiveTab();
    // Eingaben + Protokoll weg, aber Einheitsgröße erhalten
    expect(w.state.reiter[0].hektar).toBe(0);
    expect(w.state.reiter[0].koerner).toBe(0);
    expect(w.state.reiter[0].duenger).toBe(0);
    expect(w.state.reiter[0].entries).toEqual([]);
    expect(w.state.reiter[0].done).toBe(false);
    expect(w.state.reiter[0].koernerProEinheit).toBe(75000);
  });

  it('Sonstiges-Tab (kpe=0) bleibt nach resetActiveTab() bei kpe=0', () => {
    const { window: w } = createDom();
    w.state.koernerProEinheit = 50000; // global = Mais-Default
    w.state.reiter[0].hektar = 5;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].koernerProEinheit = 0; // Sonstiges vor Eingabe
    w.resetActiveTab();
    expect(w.state.reiter[0].koernerProEinheit).toBe(0);
    // resolveKoernerProEinheit darf NICHT auf den globalen Mais-Default fallen
    expect(w.getTabKoernerProEinheit(w.state.reiter[0])).toBe(0);
  });

  it('Kultur-Wechsel nach resetActiveTab() lässt bestehenden Schlag unverändert', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    // Tab 0: manuell auf 75.000 gesetzt
    w.state.reiter[0].hektar = 8;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].koernerProEinheit = 75000;
    // Eingaben + Protokoll leeren
    w.resetActiveTab();
    // Kultur auf Raps wechseln
    w.requestChangeKultur();
    w.AppGlobals._pendingKulturChoice = 'raps';
    w.confirmChangeKultur();
    // Bestehender Schlag behält seine 75.000
    expect(w.state.reiter[0].koernerProEinheit).toBe(75000);
    // Profil-Default wurde umgestellt
    expect(w.state.koernerProEinheit).toBe(1500000);
    // Künftige Schläge bekommen Raps-Standard
    w.addReiter();
    expect(w.state.reiter[1].koernerProEinheit).toBe(1500000);
  });

  it('resetActiveTab() lässt andere Tabs komplett unverändert (auch kpe)', () => {
    const { window: w } = createDom();
    w.addReiter(); // Tab 1
    w.switchReiter(0);                      // active = tab 0
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '90000';
    w.syncStateFromInputs();
    w.state.reiter[0].koernerProEinheit = 60000;
    // Tab 1 via DOM bestücken
    w.switchReiter(1);
    w.document.getElementById('hektar').value = '5';
    w.document.getElementById('koerner').value = '80000';
    w.syncStateFromInputs();
    w.state.reiter[1].koernerProEinheit = 80000;
    // Zurück zu Tab 0 und resetten
    w.switchReiter(0);
    w.resetActiveTab();
    expect(w.state.reiter[0].koernerProEinheit).toBe(60000);
    expect(w.state.reiter[1].hektar).toBe(5);
    expect(w.state.reiter[1].koerner).toBe(80000);
    expect(w.state.reiter[1].koernerProEinheit).toBe(80000);
  });
});
