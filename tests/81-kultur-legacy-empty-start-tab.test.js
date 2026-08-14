/**
 * Regression: Die erste Kulturwahl muss einen unberührten migrierten
 * Startschlag auf den gewählten Kulturstandard umstellen.
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

function legacyState(overrides = {}, extraTabs = []) {
  return {
    _lv: 5,
    reiter: [{
      name: 'Schlag 1',
      hektar: 0,
      istHektar: 0,
      koerner: 0,
      duenger: 0,
      entries: [],
      done: false,
      ...overrides,
    }, ...extraTabs],
    activeReiter: 0,
    einheitGroesseEnabled: false,
    koernerProEinheit: 50000,
    fahrgassenEnabled: false,
    fahrgassenBreite: 0,
    machineLog: [],
    drillPriorities: {},
  };
}

function loadLegacyState(state) {
  const ctx = createDom();
  ctx.store.agrar_rechner = JSON.stringify(state);
  ctx.window.initUI();
  return ctx;
}

describe('Erste Kulturwahl aktualisiert unberührten Legacy-Startschlag', () => {
  it('Raps setzt Schlag 1 und den sichtbaren Einheiten-Editor auf 1.500.000', () => {
    const { window: w } = loadLegacyState(legacyState());
    expect(w.state.reiter[0].koernerProEinheit).toBe(50000);

    w.chooseKultur('raps');

    expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
    expect(w.document.getElementById('koerner_pro_einheit').value).toBe('1500000');

    w.einheitGroesseToggle();
    expect(w.document.getElementById('koerner_pro_einheit').value).toBe('1500000');

    w.state = { reiter: [], activeReiter: 0 };
    expect(w.loadState()).toBe(true);
    expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
  });

  it('Sonstiges setzt den unberührten Startschlag auf 0 und zeigt ein leeres Feld', () => {
    const { window: w } = loadLegacyState(legacyState());

    w.chooseKultur('sonstiges');

    expect(w.state.reiter[0].koernerProEinheit).toBe(0);
    expect(w.document.getElementById('koerner_pro_einheit').value).toBe('');
  });

  it.each([
    ['SOLL-Fläche', { hektar: 4 }],
    ['IST-Fläche', { istHektar: 4 }],
    ['Aussaatstärke', { koerner: 300000 }],
    ['Dünger', { duenger: 150 }],
    ['Protokoll', { entries: [{ time: 1, einheit: 1, duenger: 0, hektar: 1, istHektar: 0, koerner: 0, duengerRate: 0 }] }],
    ['Fertig-Markierung', { done: true }],
  ])('ändert einen Startschlag mit %s nicht', (_label, overrides) => {
    const { window: w } = loadLegacyState(legacyState(overrides));

    w.chooseKultur('raps');

    expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
  });

  it('behält eine individuelle Einheitsgröße auch bei vollständig leerem Schlag', () => {
    const { window: w } = loadLegacyState(legacyState({ koernerProEinheit: 75000 }));

    w.chooseKultur('raps');

    expect(w.state.reiter[0].koernerProEinheit).toBe(75000);
  });

  it('ändert keinen weiteren vorhandenen leeren Arbeitsschlag', () => {
    const secondTab = {
      name: 'Schlag 2', hektar: 0, istHektar: 0, koerner: 0, duenger: 0,
      entries: [], done: false, koernerProEinheit: 50000,
    };
    const { window: w } = loadLegacyState(legacyState({}, [secondTab]));

    w.chooseKultur('raps');

    expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
    expect(w.state.reiter[1].koernerProEinheit).toBe(50000);
  });

  it('ein später bestätigter Kulturwechsel lässt den bestehenden Schlag unverändert', () => {
    const { window: w } = loadLegacyState(legacyState());
    w.chooseKultur('raps');

    w.requestChangeKultur();
    w.AppGlobals._pendingKulturChoice = 'mais';
    w.confirmChangeKultur();

    expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
    expect(w.state.kultur).toBe('mais');
  });
});
