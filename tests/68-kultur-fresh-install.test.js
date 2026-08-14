/**
 * BLOCKER 2: Frische Erstauswahl initialisiert den initialen leeren Schlag.
 *
 * Spec: "Ein wirklich frischer Nutzer erhält für den initialen leeren Schlag
 *        den gewählten Standard (Raps 1.500.000, Sonstiges 0)."
 *        "Ein bestehender/migrierter Nutzer – selbst mit nur einem leeren Tab –
 *         muss dagegen unverändert bleiben."
 *
 * Detection muss sauber über den Rückgabewert von loadState() kommen, nicht
 * über eine Heuristik ("alle Felder leer") — sonst würden migrierte User mit
 * nur einem leeren Tab fälschlich als „frisch" eingestuft.
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

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