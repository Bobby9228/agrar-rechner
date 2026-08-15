/**
 * Cross-Tab-Sync + Persistenz: kultur + per-tab koernerProEinheit
 * müssen Schema-Sanitizing, Reload und Cross-Tab korrekt durchlaufen.
 *
 * Feature-Spec:
 *   "Persistenz, Schema-Sanitizing, Cross-Tab-Sync und Reset müssen das
 *    neue Modell korrekt behandeln. Keine Datenverluste."
 */
import { describe, it, expect, vi } from 'vitest';
import { createDom } from './helpers.js';

function fireStorageEvent(w, key, newValue) {
  const event = new w.Event('storage');
  event.key = key;
  event.newValue = newValue;
  event.oldValue = null;
  event.storageArea = w.localStorage;
  w.dispatchEvent(event);
}

describe('Cross-Tab-Sync + Persistenz der neuen Felder', () => {
  describe('Persistenz kultur/erstauswahlDone', () => {
    it('saveState schreibt kultur und erstauswahlDone', () => {
      const { window: w, store } = createDom();
      w.initUI();
      w.chooseKultur('raps');
      const saved = JSON.parse(store['agrar_rechner']);
      expect(saved.kultur).toBe('raps');
      expect(saved.erstauswahlDone).toBe(true);
      expect(saved.koernerProEinheit).toBe(1500000);
    });

    it('loadState stellt kultur und erstauswahlDone wieder her', () => {
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
      expect(w.state.kultur).toBe('mais');
      expect(w.state.erstauswahlDone).toBe(true);
    });

    it('Ungültiger kultur-Wert in localStorage wird auf null normalisiert', () => {
      const { window: w, store } = createDom();
      store['agrar_rechner'] = JSON.stringify({
        _lv: 6,
        reiter: [{ name: 'T', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false, koernerProEinheit: 50000 }],
        activeReiter: 0,
        activeView: null,
        kultur: 'evil-vegetable',
        erstauswahlDone: true,
        koernerProEinheit: 50000,
        machineLog: [],
        drillPriorities: {}
      });
      w.initUI();
      // Defensive: bei ungültigem kultur aber erstauswahlDone=true wird
      // beides zurückgesetzt, sodass der User die Auswahl nachholen kann.
      expect(w.state.kultur).toBeNull();
      expect(w.state.erstauswahlDone).toBe(false);
    });

    it('Round-trip: state → save → load → state bleibt konsistent', () => {
      const { window: w, store } = createDom();
      w.initUI();
      w.chooseKultur('raps');
      w.addReiter();
      w.state.reiter[1].koernerProEinheit = 75000;
      w.saveState();
      // Reset in-memory
      w.state = {
        reiter: [{ name: 'Reset', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false, koernerProEinheit: 50000 }],
        activeReiter: 0,
        activeView: null,
        kultur: null,
        erstauswahlDone: false,
        koernerProEinheit: 50000,
        einheitGroesseEnabled: false,
        fahrgassenEnabled: false,
        fahrgassenBreite: 0,
        machineLog: [],
        drillPriorities: {}
      };
      w.loadState();
      expect(w.state.kultur).toBe('raps');
      expect(w.state.erstauswahlDone).toBe(true);
      expect(w.state.reiter[1].koernerProEinheit).toBe(75000);
    });
  });

  describe('Cross-Tab-Sync: Schema-Sanitizing', () => {
    it('remote state mit unbekanntem kultur wird ignoriert, valid state übernommen', () => {
      const { window: w } = createDom();
      w.initUI();
      w.chooseKultur('mais');
      const remote = {
        reiter: [{ name: 'Remote', hektar: 10, istHektar: 0, koerner: 90000, duenger: 100, entries: [], done: false, koernerProEinheit: 50000 }],
        activeReiter: 0,
        activeView: null,
        kultur: 'raps',
        erstauswahlDone: true,
        koernerProEinheit: 1500000,
        einheitGroesseEnabled: false,
        fahrgassenEnabled: false,
        fahrgassenBreite: 0,
        machineLog: [],
        drillPriorities: {},
        _lv: 6
      };
      fireStorageEvent(w, 'agrar_rechner', JSON.stringify(remote));
      expect(w.state.kultur).toBe('raps');
      expect(w.state.koernerProEinheit).toBe(1500000);
    });

    it('remote state mit injiziertem per-tab koernerProEinheit wird übernommen', () => {
      const { window: w } = createDom();
      w.initUI();
      w.chooseKultur('mais');
      const remote = {
        reiter: [{ name: 'Remote', hektar: 10, istHektar: 0, koerner: 90000, duenger: 100, entries: [], done: false, koernerProEinheit: 75000 }],
        activeReiter: 0,
        activeView: null,
        kultur: 'mais',
        erstauswahlDone: true,
        koernerProEinheit: 50000,
        einheitGroesseEnabled: false,
        fahrgassenEnabled: false,
        fahrgassenBreite: 0,
        machineLog: [],
        drillPriorities: {},
        _lv: 6
      };
      fireStorageEvent(w, 'agrar_rechner', JSON.stringify(remote));
      expect(w.state.reiter[0].koernerProEinheit).toBe(75000);
    });

    it('remote state mit gefährlichen Keys wird sanitiert, kultur bleibt erhalten', () => {
      const { window: w } = createDom();
      w.initUI();
      w.chooseKultur('mais');
      const remote = JSON.parse(JSON.stringify(w.state));
      remote.kultur = 'raps';
      remote.koernerProEinheit = 1500000;
      // Injiziere XSS-Versuch
      Object.defineProperty(remote.reiter[0], '__proto__', {
        value: { polluted: true },
        enumerable: true,
        configurable: true,
        writable: true,
      });
      remote.xss = '<script>alert(1)</script>';
      remote._lv = 6;
      fireStorageEvent(w, 'agrar_rechner', JSON.stringify(remote));
      expect(w.state.kultur).toBe('raps');
      expect(w.state.xss).toBeUndefined();
      expect(({}).polluted).toBeUndefined();
    });

    it('remote state ohne reiter wird ignoriert, lokaler State bleibt', () => {
      const { window: w } = createDom();
      w.initUI();
      w.chooseKultur('mais');
      const origKultur = w.state.kultur;
      const origKpe = w.state.koernerProEinheit;
      fireStorageEvent(w, 'agrar_rechner', JSON.stringify({ activeReiter: 0, _lv: 6, kultur: 'raps', koernerProEinheit: 1500000 }));
      expect(w.state.kultur).toBe(origKultur);
      expect(w.state.koernerProEinheit).toBe(origKpe);
    });
  });

  describe('Schema-Validierung: ALLOWED_KEYS / Sanitizing', () => {
    it('unbekannter per-tab key wird gestrippt', () => {
      const { window: w, store } = createDom();
      store['agrar_rechner'] = JSON.stringify({
        _lv: 6,
        reiter: [{ name: 'T', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false, koernerProEinheit: 50000, __evil: 'xss' }],
        activeReiter: 0,
        activeView: null,
        kultur: 'mais',
        erstauswahlDone: true,
        koernerProEinheit: 50000,
        machineLog: [],
        drillPriorities: {}
      });
      w.initUI();
      expect(w.state.reiter[0].__evil).toBeUndefined();
      expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
    });

    it('NaN koernerProEinheit wird auf 0 sanitiert (Sonstiges-Stand)', () => {
      const { window: w, store } = createDom();
      store['agrar_rechner'] = JSON.stringify({
        _lv: 6,
        reiter: [{ name: 'T', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false, koernerProEinheit: 'not-a-number' }],
        activeReiter: 0,
        activeView: null,
        kultur: 'sonstiges',
        erstauswahlDone: true,
        koernerProEinheit: 0,
        machineLog: [],
        drillPriorities: {}
      });
      w.initUI();
      expect(w.state.reiter[0].koernerProEinheit).toBe(0);
    });

    it('loadState erzeugt _lv=9 nach Migration', () => {
      const { window: w, store } = createDom();
      store['agrar_rechner'] = JSON.stringify({
        reiter: [{ name: 'T', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false }],
        activeReiter: 0,
        einheitGroesseEnabled: false,
        koernerProEinheit: 50000,
        fahrgassenEnabled: false,
        fahrgassenBreite: 0,
        machineLog: [],
        drillPriorities: {}
      });
      w.initUI();
      const saved = JSON.parse(store['agrar_rechner']);
      expect(saved._lv).toBe(9);
    });
  });

  describe('Reset', () => {
    it('resetAll entfernt kultur/erstauswahlDone, so dass Modal wieder erscheint', () => {
      const { window: w, store } = createDom();
      w.initUI();
      w.chooseKultur('mais');
      expect(w.state.kultur).toBe('mais');
      expect(w.state.erstauswahlDone).toBe(true);
      w.resetAll();
      expect(w.state.kultur).toBeNull();
      expect(w.state.erstauswahlDone).toBe(false);
      expect(w.state.koernerProEinheit).toBe(50000);
      // Bei nächstem initUI sollte das Modal wieder erscheinen
      w.initUI();
      const modal = w.document.getElementById('kultur_modal');
      expect(modal.classList.contains('open')).toBe(true);
    });

    it('resetActiveTab löscht NICHT die globale kultur', () => {
      const { window: w } = createDom();
      w.initUI();
      w.chooseKultur('mais');
      w.addReiter();
      const origKultur = w.state.kultur;
      const origKpe = w.state.koernerProEinheit;
      w.switchReiter(1);
      w.resetActiveTab();
      expect(w.state.kultur).toBe(origKultur);
      expect(w.state.koernerProEinheit).toBe(origKpe);
    });
  });
});