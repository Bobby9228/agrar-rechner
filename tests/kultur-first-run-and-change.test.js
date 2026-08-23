/**
 * Kultur Erstauswahl & Kultur-Wechsel.
 *
 * - Erststart: vor dem ersten produktiven Rechner-Klick wählt der Landwirt
 *   eine Kultur (Mais / Raps / Sonstiges). Erstauswahl wird in
 *   `state.erstauswahlDone` persistent gespeichert; nach Reload bleibt der
 *   Dialog verschwunden.
 * - Kultur-Wechsel: Bestätigungs-Modal verhindert versehentliche Änderungen.
 *   Warntext erklärt: vorhandene Schläge behalten ihre Einheitsgrößen; nur
 *   neue Schläge erhalten den neuen Standard. Abbruch lässt alles
 *   unverändert. Kulturwechsel verändert keine bestehenden Schläge.
 * - Fresh Install: ein wirklich frischer Nutzer erhält für den initialen
 *   leeren Schlag den gewählten Standard (Raps 1.500.000, Sonstiges 0).
 *   Bestehender/migrierter Nutzer — selbst mit nur einem leeren Tab —
 *   bleibt unverändert (Detection über loadState()-Rückgabe, nicht
 *   Heuristik).
 * - resetAll(): setzt kultur/erstauswahlDone zurück und öffnet den
 *   First-run-Modal erneut, damit der Landwirt eine neue Kultur wählen
 *   muss.
 *
 * Zugehörige frühere Dateien: tests/61-kultur-first-run.test.js,
 * tests/65-kultur-change-confirm.test.js, tests/68-kultur-fresh-install.test.js,
 * tests/79-resetAll-kultur-modal.test.js (Issue #419 Welle 1).
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

describe('Erststart: Kultur-Auswahl-Modal', () => {
  it('zeigt das Auswahl-Modal beim ersten initUI(), wenn keine Kultur gespeichert ist', () => {
    const { window: w, dom } = createDom();
    w.initUI();
    const modal = w.document.getElementById('kultur_modal');
    expect(modal).toBeTruthy();
    expect(modal.classList.contains('open')).toBe(true);
  });

  it('das Modal hat eine sinnvolle Rolle/aria-Label', () => {
    const { window: w } = createDom();
    w.initUI();
    const modal = w.document.getElementById('kultur_modal');
    expect(modal.getAttribute('role')).toBe('dialog');
    expect(modal.getAttribute('aria-modal')).toBe('true');
    // Title ist verlinkt via aria-labelledby
    const titleId = modal.getAttribute('aria-labelledby');
    const title = w.document.getElementById(titleId);
    expect(title).toBeTruthy();
    expect(title.textContent.trim().length).toBeGreaterThan(0);
  });

  it('bietet drei Auswahl-Buttons (Mais, Raps, Sonstiges) mit Daten-IDs', () => {
    const { window: w } = createDom();
    w.initUI();
    expect(w.document.getElementById('kultur_choice_mais')).toBeTruthy();
    expect(w.document.getElementById('kultur_choice_raps')).toBeTruthy();
    expect(w.document.getElementById('kultur_choice_sonstiges')).toBeTruthy();
  });

  it('zeigt die Kultur-Auswahl ohne Zusatztexte', () => {
    const { window: w } = createDom();
    const modal = w.document.getElementById('kultur_modal');

    expect(modal.getAttribute('aria-describedby')).toBeNull();
    expect(w.document.querySelector('.kultur-modal-subtitle')).toBeNull();
    expect(w.document.querySelectorAll('.kultur-option-desc')).toHaveLength(0);
  });

  it('zeigt das Modal NICHT, wenn bereits eine Kultur gespeichert ist', () => {
    const { window: w, store } = createDom();
    store['agrar_rechner'] = JSON.stringify({
      _lv: 6,
      reiter: [{ name: 'T', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false, koernerProEinheit: 50000 }],
      activeReiter: 0,
      activeView: null,
      kultur: 'mais',
      erstauswahlDone: true,
      koernerProEinheit: 50000,
      einheitGroesseEnabled: false,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      machineLog: [],
      drillPriorities: {}
    });
    w.initUI();
    const modal = w.document.getElementById('kultur_modal');
    expect(modal.classList.contains('open')).toBe(false);
  });

  it('chooseKultur("mais") setzt state.kultur und schließt das Modal', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    expect(w.state.kultur).toBe('mais');
    expect(w.state.erstauswahlDone).toBe(true);
    expect(w.state.koernerProEinheit).toBe(50000);
    const modal = w.document.getElementById('kultur_modal');
    expect(modal.classList.contains('open')).toBe(false);
  });

  it('chooseKultur("raps") setzt kultur + kpe auf 1.500.000', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('raps');
    expect(w.state.kultur).toBe('raps');
    expect(w.state.koernerProEinheit).toBe(1500000);
  });

  it('chooseKultur("sonstiges") setzt kultur, kpe bleibt 0', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('sonstiges');
    expect(w.state.kultur).toBe('sonstiges');
    expect(w.state.koernerProEinheit).toBe(0);
  });

  it('chooseKultur persistiert in localStorage', () => {
    const { window: w, store } = createDom();
    w.initUI();
    w.chooseKultur('raps');
    const saved = JSON.parse(store['agrar_rechner']);
    expect(saved.kultur).toBe('raps');
    expect(saved.erstauswahlDone).toBe(true);
    expect(saved.koernerProEinheit).toBe(1500000);
  });

  it('chooseKultur lehnt unbekannte Keys ab', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('unknown');
    expect(w.state.kultur).toBeNull();
    // Modal bleibt offen, weil keine gültige Wahl getroffen
    const modal = w.document.getElementById('kultur_modal');
    expect(modal.classList.contains('open')).toBe(true);
  });

  it('Modal kann NICHT ohne Auswahl geschlossen werden (kein Schließen ohne Kultur)', () => {
    const { window: w } = createDom();
    w.initUI();
    // Versuche, das Modal programmatisch zu schließen
    if (typeof w.closeKulturModal === 'function') {
      w.closeKulturModal();
    }
    const modal = w.document.getElementById('kultur_modal');
    // Solange keine Kultur gewählt wurde, bleibt das Modal sichtbar
    if (!w.state.kultur) {
      expect(modal.classList.contains('open')).toBe(true);
    }
  });

  it('Tastatur-Abbruch (Escape) lässt Auswahl weiterhin offen', () => {
    const { window: w } = createDom();
    w.initUI();
    const modal = w.document.getElementById('kultur_modal');
    // Escape-Event dispatchen — sollte das Modal NICHT schließen
    const evt = new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    modal.dispatchEvent(evt);
    expect(modal.classList.contains('open')).toBe(true);
  });
});

describe('Kultur-Wechsel mit Bestätigung', () => {
  it('Kultur-Badge zeigt aktuelle Kultur und „ändern"-Button', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    const badge = w.document.getElementById('kultur_badge');
    const emoji = w.document.getElementById('kultur_badge_emoji');
    const label = w.document.getElementById('kultur_badge_label');
    const changeBtn = w.document.getElementById('kultur_badge_change');
    expect(badge.hidden).toBe(false);
    expect(emoji.textContent).toBe('🌽');
    expect(label.textContent).toBe('Mais');
    expect(changeBtn).toBeTruthy();
    expect(changeBtn.getAttribute('aria-label')).toBeTruthy();
  });

  it('requestChangeKultur öffnet Bestätigungs-Modal mit korrekter Rolle', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.requestChangeKultur();
    const modal = w.document.getElementById('kultur_confirm_modal');
    expect(modal.classList.contains('open')).toBe(true);
    expect(modal.getAttribute('role')).toBe('alertdialog');
    expect(modal.getAttribute('aria-modal')).toBe('true');
    // Erklärungstext sichtbar (enthält Stichworte aus der Spec)
    const desc = w.document.getElementById('kultur_confirm_desc');
    expect(desc.textContent).toContain('Einheitsgrößen');
    expect(desc.textContent).toContain('neue Schläge');
  });

  it('cancelChangeKultur lässt state.kultur UND alle Schläge unverändert', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    // Tab mit Daten anlegen
    w.addReiter();
    w.state.reiter[1].hektar = 10;
    w.state.reiter[1].koerner = 90000;
    w.state.reiter[1].koernerProEinheit = 60000; // benutzerdefiniert
    // Snapshot
    const snapKultur = w.state.kultur;
    const snapKpe = w.state.koernerProEinheit;
    const snapTab1 = JSON.parse(JSON.stringify(w.state.reiter[1]));
    // Wechsel anfordern → abbrechen
    w.requestChangeKultur();
    w.cancelChangeKultur();
    // Alles unverändert
    expect(w.state.kultur).toBe(snapKultur);
    expect(w.state.koernerProEinheit).toBe(snapKpe);
    expect(w.state.reiter[1]).toEqual(snapTab1);
  });

  it('confirmChangeKultur("raps") ändert nur Profil, nicht bestehende Schläge', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.addReiter();
    w.state.reiter[1].hektar = 10;
    w.state.reiter[1].koerner = 90000;
    w.state.reiter[1].koernerProEinheit = 60000; // benutzerdefiniert
    const snapTab1 = JSON.parse(JSON.stringify(w.state.reiter[1]));
    // Wechsel zu Raps
    w.requestChangeKultur();
    w.AppGlobals._pendingKulturChoice = 'raps';
    w.confirmChangeKultur();
    // Profil geändert
    expect(w.state.kultur).toBe('raps');
    expect(w.state.koernerProEinheit).toBe(1500000);
    // bestehender Tab unverändert (insb. eigene koernerProEinheit)
    expect(w.state.reiter[1]).toEqual(snapTab1);
    expect(w.state.reiter[1].koernerProEinheit).toBe(60000);
  });

  it('nach Kultur-Wechsel zu Sonstiges: bestehende Tabs behalten ihren kpe, neue bekommen 0', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.addReiter();
    w.state.reiter[1].hektar = 10;
    w.state.reiter[1].koerner = 90000;
    w.state.reiter[1].koernerProEinheit = 50000;
    w.requestChangeKultur();
    w.AppGlobals._pendingKulturChoice = 'sonstiges';
    w.confirmChangeKultur();
    expect(w.state.kultur).toBe('sonstiges');
    expect(w.state.reiter[1].koernerProEinheit).toBe(50000);
    // Neuer Tab nach Wechsel
    w.addReiter();
    expect(w.state.reiter[2].koernerProEinheit).toBe(0);
  });

  it('confirmChangeKultur mit ungültigem Key lässt State unverändert', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.requestChangeKultur();
    w.AppGlobals._pendingKulturChoice = 'garbage';
    const prevKultur = w.state.kultur;
    w.confirmChangeKultur();
    expect(w.state.kultur).toBe(prevKultur);
  });

  it('Kultur-Wechsel persistiert in localStorage', () => {
    const { window: w, store } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.requestChangeKultur();
    w.AppGlobals._pendingKulturChoice = 'raps';
    w.confirmChangeKultur();
    const saved = JSON.parse(store['agrar_rechner']);
    expect(saved.kultur).toBe('raps');
    expect(saved.koernerProEinheit).toBe(1500000);
  });

  it('Empfehlungstext unter "Körner pro Hektar" aktualisiert sich beim Wechsel', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    var emp = w.document.getElementById('koerner_empfehlung');
    expect(emp).toBeTruthy();
    expect(emp.textContent).toContain('80.000');
    // Wechsel zu Raps
    w.requestChangeKultur();
    w.AppGlobals._pendingKulturChoice = 'raps';
    w.confirmChangeKultur();
    emp = w.document.getElementById('koerner_empfehlung');
    expect(emp.textContent).toContain('250.000');
  });

  it('Sonstiges: Empfehlungstext enthält keine Zahl mehr', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('sonstiges');
    var emp = w.document.getElementById('koerner_empfehlung');
    expect(emp).toBeTruthy();
    // Sonstiges: Empfehlung darf KEINE Zahl enthalten
    expect(/\d/.test(emp.textContent)).toBe(false);
  });
});

describe('BLOCKER 2: Frische Erstauswahl initialisiert initialen leeren Schlag', () => {
  describe('Fresh install (kein localStorage-Eintrag)', () => {
    it('Mais: initialer leerer Schlag bekommt 50.000', () => {
      const { window: w } = createDom();
      w.initUI();
      w.chooseKultur('mais');
      expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
    });

    it('Raps: initialer leerer Schlag bekommt 1.500.000', () => {
      const { window: w } = createDom();
      w.initUI();
      w.chooseKultur('raps');
      expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
    });

    it('Sonstiges: initialer leerer Schlag bekommt 0', () => {
      const { window: w } = createDom();
      w.initUI();
      w.chooseKultur('sonstiges');
      expect(w.state.reiter[0].koernerProEinheit).toBe(0);
    });
  });

  describe('Migrated user (existierender leerer Starttab)', () => {
    // Bestätigtes Produktverhalten: Ein vollständig unberührter Startschlag
    // mit dem alten 50.000er-Default übernimmt bei der ersten Kulturwahl den
    // Kulturstandard. Schläge mit Daten oder individueller KPE bleiben erhalten.
    it('unberührter leerer Starttab übernimmt bei Raps 1.500.000', () => {
      const { window: w, store } = createDom();
      // Simulierter Pre-Migration State: kein kultur/erstauswahlDone, ein leerer Tab
      store['agrar_rechner'] = JSON.stringify({
        _lv: 5,
        reiter: [{ name: 'Schlag 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false }],
        activeReiter: 0,
        einheitGroesseEnabled: false,
        koernerProEinheit: 50000,
        fahrgassenEnabled: false,
        fahrgassenBreite: 0,
        machineLog: [],
        drillPriorities: {}
      });
      w.initUI();
      // Tab 0 wurde bei der Migration mit 50.000 (default) belegt
      expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
      // Modal ist offen (Erstauswahl fällig) — User wählt Raps
      w.chooseKultur('raps');
      // Unberührter Starttab übernimmt den gewählten Raps-Standard
      expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
      // Globaler Default ist jetzt Raps
      expect(w.state.koernerProEinheit).toBe(1500000);
    });

    it('unberührter leerer Starttab übernimmt bei Sonstiges 0', () => {
      const { window: w, store } = createDom();
      // Migration 5→6 hat koernerProEinheit=50000 auf Tab 0 gesetzt
      // (kein einheitGroesseEnabled → Default 50000)
      store['agrar_rechner'] = JSON.stringify({
        _lv: 5,
        reiter: [{ name: 'Schlag 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false }],
        activeReiter: 0,
        einheitGroesseEnabled: false,
        koernerProEinheit: 50000,
        fahrgassenEnabled: false,
        fahrgassenBreite: 0,
        machineLog: [],
        drillPriorities: {}
      });
      w.initUI();
      w.chooseKultur('sonstiges');
      // Unberührter Starttab übernimmt Sonstiges (0/leer)
      expect(w.state.reiter[0].koernerProEinheit).toBe(0);
    });

    it('Editor #koerner_pro_einheit zeigt nach Raps-Wahl 1.500.000 (Aufklappen)', () => {
      const { window: w, store } = createDom();
      store['agrar_rechner'] = JSON.stringify({
        _lv: 5,
        reiter: [{ name: 'Schlag 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false }],
        activeReiter: 0,
        einheitGroesseEnabled: false,
        koernerProEinheit: 50000,
        fahrgassenEnabled: false,
        fahrgassenBreite: 0,
        machineLog: [],
        drillPriorities: {}
      });
      w.initUI();
      expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
      w.chooseKultur('raps');
      // State korrekt
      expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
      // Editor aufklappen: das Feld zeigt den neuen Wert
      w.einheitGroesseToggle();
      const kpEl = w.document.getElementById('koerner_pro_einheit');
      expect(kpEl.value).toBe('1500000');
    });

    it('Reload nach Wahl Raps bewahrt 1.500.000 auf migriertem Startschlag', () => {
      const { window: w, store } = createDom();
      store['agrar_rechner'] = JSON.stringify({
        _lv: 5,
        reiter: [{ name: 'Schlag 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false }],
        activeReiter: 0,
        einheitGroesseEnabled: false,
        koernerProEinheit: 50000,
        fahrgassenEnabled: false,
        fahrgassenBreite: 0,
        machineLog: [],
        drillPriorities: {}
      });
      w.initUI();
      w.chooseKultur('raps');
      expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
      w.saveState();
      // Reload
      w.state = { reiter: [], activeReiter: 0 };
      w.loadState();
      expect(w.state.kultur).toBe('raps');
      expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
    });
  });

  describe('Reload nach Erstauswahl', () => {
    it('nach Reload bleibt Tab 0 auf dem Erstauswahl-Standard', () => {
      const { window: w, store } = createDom();
      w.initUI();
      w.chooseKultur('raps');
      // Erstauswahl hat Tab 0 auf 1.500.000 gesetzt und gespeichert
      w.saveState();
      // Komplett zurücksetzen + reload
      w.state = { reiter: [], activeReiter: 0 };
      w.loadState();
      expect(w.state.kultur).toBe('raps');
      expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
    });
  });

  describe('Manuelle Tab-Änderung bleibt nach Kultur-Wechsel erhalten', () => {
    it('User hat Tab 0 manuell auf 70.000 gesetzt → nach Kultur-Wechsel bleibt 70.000', () => {
      const { window: w } = createDom();
      w.initUI();
      w.chooseKultur('mais');
      w.state.reiter[0].koernerProEinheit = 70000;
      // Kultur wechseln
      w.requestChangeKultur();
      w.AppGlobals._pendingKulturChoice = 'raps';
      w.confirmChangeKultur();
      // Tab 0 bleibt bei 70.000
      expect(w.state.reiter[0].koernerProEinheit).toBe(70000);
      // neue Tabs bekommen Raps-Standard
      w.addReiter();
      expect(w.state.reiter[1].koernerProEinheit).toBe(1500000);
    });
  });

  describe('Schläge mit Daten bleiben unverändert', () => {
    it('Tab mit hektar > 0 bleibt unverändert', () => {
      const { window: w, store } = createDom();
      store['agrar_rechner'] = JSON.stringify({
        reiter: [{ name: 'Schlag 1', hektar: 4, istHektar: 0, koerner: 300000, duenger: 0, entries: [], done: false }],
        activeReiter: 0,
        einheitGroesseEnabled: false,
        koernerProEinheit: 50000,
        fahrgassenEnabled: false,
        fahrgassenBreite: 0,
        machineLog: [],
        drillPriorities: {}
      });
      w.loadState();
      const kpeBefore = w.state.reiter[0].koernerProEinheit;
      w.initUI();
      w.chooseKultur('sonstiges');
      expect(w.state.reiter[0].koernerProEinheit).toBe(kpeBefore);
    });

    it('Tab mit istHektar > 0 bleibt unverändert', () => {
      const { window: w, store } = createDom();
      store['agrar_rechner'] = JSON.stringify({
        reiter: [{ name: 'Schlag 1', hektar: 0, istHektar: 3.5, koerner: 0, duenger: 0, entries: [], done: false }],
        activeReiter: 0,
        einheitGroesseEnabled: false,
        koernerProEinheit: 50000,
        fahrgassenEnabled: false,
        fahrgassenBreite: 0,
        machineLog: [],
        drillPriorities: {}
      });
      w.loadState();
      w.initUI();
      w.chooseKultur('raps');
      expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
    });

    it('Tab mit entries bleibt unverändert', () => {
      const { window: w, store } = createDom();
      store['agrar_rechner'] = JSON.stringify({
        reiter: [{ name: 'Schlag 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [{ time: '10:00', einheit: 5, duenger: 0, hektar: 0, istHektar: 0, koerner: 0, duengerRate: 0 }], done: false }],
        activeReiter: 0,
        einheitGroesseEnabled: false,
        koernerProEinheit: 50000,
        fahrgassenEnabled: false,
        fahrgassenBreite: 0,
        machineLog: [],
        drillPriorities: {}
      });
      w.loadState();
      w.initUI();
      w.chooseKultur('raps');
      expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
    });

    it('Tab mit done=true bleibt unverändert', () => {
      const { window: w, store } = createDom();
      store['agrar_rechner'] = JSON.stringify({
        reiter: [{ name: 'Schlag 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: true }],
        activeReiter: 0,
        einheitGroesseEnabled: false,
        koernerProEinheit: 50000,
        fahrgassenEnabled: false,
        fahrgassenBreite: 0,
        machineLog: [],
        drillPriorities: {}
      });
      w.loadState();
      w.initUI();
      w.chooseKultur('raps');
      expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
    });
  });

  describe('Leerer Schlag mit individueller KPE ≠ 50.000 bleibt unverändert', () => {
    it('Tab mit KPE=75.000 (keine Daten) bleibt bei 75.000', () => {
      const { window: w, store } = createDom();
      store['agrar_rechner'] = JSON.stringify({
        reiter: [{ name: 'Schlag 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false, koernerProEinheit: 75000 }],
        activeReiter: 0,
        einheitGroesseEnabled: false,
        koernerProEinheit: 50000,
        fahrgassenEnabled: false,
        fahrgassenBreite: 0,
        machineLog: [],
        drillPriorities: {}
      });
      w.loadState();
      w.initUI();
      w.chooseKultur('raps');
      expect(w.state.reiter[0].koernerProEinheit).toBe(75000);
    });

    it('nur Tab 0 wird geändert, nicht beliebige leere Arbeitsschläge', () => {
      const { window: w, store } = createDom();
      store['agrar_rechner'] = JSON.stringify({
        reiter: [
          { name: 'Schlag 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false },
          { name: 'Schlag 2', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false, koernerProEinheit: 50000 }
        ],
        activeReiter: 0,
        einheitGroesseEnabled: false,
        koernerProEinheit: 50000,
        fahrgassenEnabled: false,
        fahrgassenBreite: 0,
        machineLog: [],
        drillPriorities: {}
      });
      w.loadState();
      w.initUI();
      w.chooseKultur('raps');
      // Tab 0: unberührter Startschlag → wird geändert
      expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
      // Tab 1: leerer Arbeitsschlag mit KPE=50000, aber NICHT Tab 0 → bleibt
      expect(w.state.reiter[1].koernerProEinheit).toBe(50000);
    });
  });

  describe('confirmChangeKultur verändert bestehende Schläge nicht', () => {
    it('confirmChangeKultur("sonstiges") lässt Tab 0 unverändert', () => {
      const { window: w, store } = createDom();
      store['agrar_rechner'] = JSON.stringify({
        _lv: 5,
        reiter: [{ name: 'Schlag 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false }],
        activeReiter: 0,
        einheitGroesseEnabled: false,
        koernerProEinheit: 50000,
        fahrgassenEnabled: false,
        fahrgassenBreite: 0,
        machineLog: [],
        drillPriorities: {}
      });
      w.initUI();
      w.chooseKultur('raps');
      expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
      // Späterer Kulturwechsel via confirmChangeKultur
      w.requestChangeKultur();
      w.AppGlobals._pendingKulturChoice = 'sonstiges';
      w.confirmChangeKultur();
      // Profil geändert
      expect(w.state.kultur).toBe('sonstiges');
      expect(w.state.koernerProEinheit).toBe(0);
      // Aber bestehender Tab bleibt bei 1.500.000
      expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
    });
  });

  describe('Detection-Mechanik', () => {
    it('Fresh-Install-Erkennung kommt aus loadState() Rückgabewert, nicht aus Feld-Heuristik', () => {
      // Wenn loadState nichts lädt (kein localStorage-Eintrag), wird der
      // existierende Schlag 0 vom Default-State bei Erstauswahl überschrieben.
      const { window: w } = createDom();
      // Kein store-Eintrag → loadState() returnt false → „fresh install"
      const ret = w.loadState();
      expect(ret).toBe(false);
      w.initUI();
      w.chooseKultur('raps');
      // Tab 0 wurde mit Raps-Standard initialisiert
      expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
    });
  });
});

describe('resetAll() aktualisiert Kultur-UI sofort (Badge, Empfehlung, First-run-Modal)', () => {
  it('nach resetAll() mit vorher gewählter Kultur: Badge ist versteckt, Modal ist offen', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('raps');
    // Vor resetAll: Badge sichtbar, Modal zu
    const badge = w.document.getElementById('kultur_badge');
    expect(badge.hidden).toBe(false);
    const modal = w.document.getElementById('kultur_modal');
    expect(modal.classList.contains('open')).toBe(false);

    w.resetAll();

    // State korrekt zurückgesetzt
    expect(w.state.kultur).toBeNull();
    expect(w.state.erstauswahlDone).toBe(false);

    // Badge versteckt (kein gültiger Kultur-Key)
    expect(badge.hidden).toBe(true);

    // First-run-Modal geöffnet
    expect(modal.classList.contains('open')).toBe(true);
  });

  it('nach resetAll(): Empfehlungstext #koerner_empfehlung ist verborgen (kultur=null)', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    const emp = w.document.getElementById('koerner_empfehlung');
    expect(emp.textContent).toContain('80.000');
    expect(emp.hidden).toBe(false);

    w.resetAll();

    // Nach resetAll: keine gültige Kultur → Empfehlung versteckt und leer
    expect(emp.hidden).toBe(true);
    expect(emp.textContent).toBe('');
  });

  it('nach resetAll() auf Frisch-Install: Modal öffnet sich, Badge versteckt, Empfehlung versteckt', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('sonstiges'); // kultur + erstauswahlDone = true
    // Modal ist zu (Erstauswahl bereits erledigt)
    expect(w.document.getElementById('kultur_modal').classList.contains('open')).toBe(false);

    w.resetAll();

    // First-run-Modal muss GEÖFFNET sein (sonst kann der Nutzer nicht weiterarbeiten)
    const modal = w.document.getElementById('kultur_modal');
    expect(modal.classList.contains('open')).toBe(true);

    // Badge versteckt
    expect(w.document.getElementById('kultur_badge').hidden).toBe(true);

    // Empfehlung versteckt
    const emp = w.document.getElementById('koerner_empfehlung');
    expect(emp.hidden).toBe(true);
  });

  it('resetAll() muss NICHT auf initUI() angewiesen sein (kein Reload nötig)', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('raps');
    // Kein zweiter initUI()-Aufruf erfolgt hier — Reset muss eigenständig wirken
    w.resetAll();

    // Trotzdem: Modal ist offen, Badge ist versteckt
    expect(w.document.getElementById('kultur_modal').classList.contains('open')).toBe(true);
    expect(w.document.getElementById('kultur_badge').hidden).toBe(true);
  });

  it('resetAll() öffnet das Modal auch dann, wenn vorher schon ein Reset-Modal geöffnet war', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('raps');
    // Reset-Modal manuell öffnen (per Code-Pfad: openResetModal)
    w.openResetModal();
    // "Alle Daten löschen" klicken → _onResetAll() → resetAll()
    w._onResetAll();
    // First-run-Modal ist jetzt offen
    const modal = w.document.getElementById('kultur_modal');
    expect(modal.classList.contains('open')).toBe(true);
    // Reset-Modal selbst wurde durch _onResetAll() geschlossen
    expect(w.document.getElementById('reset_modal').classList.contains('open')).toBe(false);
  });
});
