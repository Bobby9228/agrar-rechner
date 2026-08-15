/**
 * Migration 5→6: bestehende Schläge behalten ihren effektiven kpe-Wert.
 *
 * Feature-Spec:
 *   "Bei Migration der bisher globalen Einheitsgröße muss jeder bestehende
 *    Schlag den bisher effektiv verwendeten Wert erhalten (benutzerdefinierter
 *    globaler Wert, falls aktiv; sonst 50.000), damit Ergebnisse unverändert
 *    bleiben."
 *
 * Drei Pfade:
 *   1) einheitGroesseEnabled=true + koernerProEinheit>0  → benutzerdef. Wert
 *   2) einheitGroesseEnabled=false (oder Wert=50000)     → 50.000 Default
 *   3) Tab hat schon eigene koernerProEinheit            → Tab-Wert behält Vorrang
 *
 * Frische Nutzer (kein State): Erststart-Modal, dann Standard-Kultur.
 * Bestehende Nutzer ohne Kultur sehen das Modal genau einmal; ihre
 * Schläge werden dabei NICHT verändert.
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

describe('Migration 5→6: bestehende Tabs behalten effektiven kpe', () => {
  it('Default (kein einheitGroesseEnabled) → alle bestehenden Tabs bekommen 50.000', () => {
    const { window: w, store } = createDom();
    store['agrar_rechner'] = JSON.stringify({
      _lv: 5,
      reiter: [
        { name: 'A', hektar: 10, koerner: 90000, duenger: 150, entries: [], done: false },
        { name: 'B', hektar: 5,  koerner: 80000, duenger: 100, entries: [], done: false }
      ],
      activeReiter: 0,
      activeView: null,
      einheitGroesseEnabled: false,
      koernerProEinheit: 50000,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      machineLog: [],
      drillPriorities: {}
    });
    w.loadState();
    expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
    expect(w.state.reiter[1].koernerProEinheit).toBe(50000);
  });

  it('einheitGroesseEnabled=true mit benutzerdef. Wert → Tabs bekommen diesen Wert', () => {
    const { window: w, store } = createDom();
    store['agrar_rechner'] = JSON.stringify({
      _lv: 5,
      reiter: [
        { name: 'A', hektar: 10, koerner: 90000, duenger: 150, entries: [], done: false },
        { name: 'B', hektar: 5,  koerner: 80000, duenger: 100, entries: [], done: false }
      ],
      activeReiter: 0,
      activeView: null,
      einheitGroesseEnabled: true,
      koernerProEinheit: 80000,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      machineLog: [],
      drillPriorities: {}
    });
    w.loadState();
    expect(w.state.reiter[0].koernerProEinheit).toBe(80000);
    expect(w.state.reiter[1].koernerProEinheit).toBe(80000);
  });

  it('Tab mit eigener koernerProEinheit behält diesen Wert (Vorrang vor Global)', () => {
    const { window: w, store } = createDom();
    store['agrar_rechner'] = JSON.stringify({
      _lv: 5,
      reiter: [
        { name: 'A', hektar: 10, koerner: 90000, duenger: 150, entries: [], done: false, koernerProEinheit: 75000 }
      ],
      activeReiter: 0,
      activeView: null,
      einheitGroesseEnabled: true,
      koernerProEinheit: 80000,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      machineLog: [],
      drillPriorities: {}
    });
    w.loadState();
    expect(w.state.reiter[0].koernerProEinheit).toBe(75000);
  });

  it('Migration erhält Berechnungs-Ergebnisse: vor Migration berechnen, danach identisch', () => {
    const { window: w, store } = createDom();
    // Vor-Migration State mit einheitGroesseEnabled=true und Wert 80000
    const oldState = {
      _lv: 5,
      reiter: [{ name: 'A', hektar: 10, koerner: 90000, duenger: 150, entries: [], done: false }],
      activeReiter: 0,
      activeView: null,
      einheitGroesseEnabled: true,
      koernerProEinheit: 80000,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      machineLog: [],
      drillPriorities: {}
    };
    // Vor-Migration: Total-Einheiten mit globalem kpe=80000
    const refTotal = 10 * 90000 / 80000; // = 11.25
    // State sichern + loadState triggert Migration
    store['agrar_rechner'] = JSON.stringify(oldState);
    w.loadState();
    // Nach Migration: gleicher Wert über r.koernerProEinheit
    expect(w.getTabTotalEinheiten(w.state.reiter[0])).toBeCloseTo(refTotal, 5);
  });

  it('Migration hebt _lv auf 9 und entfernt mig6-Felder nicht', () => {
    const { window: w, store } = createDom();
    store['agrar_rechner'] = JSON.stringify({
      _lv: 5,
      reiter: [{ name: 'A', hektar: 10, koerner: 90000, duenger: 150, entries: [], done: false }],
      activeReiter: 0,
      activeView: null,
      einheitGroesseEnabled: false,
      koernerProEinheit: 50000,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      machineLog: [],
      drillPriorities: {}
    });
    w.loadState();
    const persisted = JSON.parse(store['agrar_rechner']);
    expect(persisted._lv).toBe(9);
    expect(persisted.kultur).toBeNull();
    expect(persisted.erstauswahlDone).toBe(false);
    expect(persisted.reiter[0].koernerProEinheit).toBe(50000);
  });

  it('Erststart-Modal erscheint NUR für bestehende Nutzer ohne Kultur', () => {
    const { window: w, store } = createDom();
    store['agrar_rechner'] = JSON.stringify({
      _lv: 5,
      reiter: [{ name: 'A', hektar: 10, koerner: 90000, duenger: 150, entries: [], done: false }],
      activeReiter: 0,
      activeView: null,
      einheitGroesseEnabled: false,
      koernerProEinheit: 50000,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      machineLog: [],
      drillPriorities: {}
    });
    w.initUI();
    // Modal sollte offen sein, aber bestehende Schläge unverändert
    const modal = w.document.getElementById('kultur_modal');
    expect(modal.classList.contains('open')).toBe(true);
    // Bestehender Tab bleibt mit kpe=50000
    expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
    expect(w.state.reiter[0].hektar).toBe(10);
    expect(w.state.reiter[0].koerner).toBe(90000);
  });

  it('Nach Erstauswahl (Mais) werden bestehende Schläge NICHT verändert', () => {
    const { window: w, store } = createDom();
    store['agrar_rechner'] = JSON.stringify({
      _lv: 5,
      reiter: [
        { name: 'A', hektar: 10, koerner: 90000, duenger: 150, entries: [], done: false, koernerProEinheit: 80000 },
        { name: 'B', hektar: 5,  koerner: 70000, duenger: 80,  entries: [], done: false, koernerProEinheit: 50000 }
      ],
      activeReiter: 0,
      activeView: null,
      einheitGroesseEnabled: true,
      koernerProEinheit: 80000,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      machineLog: [],
      drillPriorities: {}
    });
    w.initUI();
    w.chooseKultur('mais');
    // bestehende Tabs unverändert
    expect(w.state.reiter[0].koernerProEinheit).toBe(80000);
    expect(w.state.reiter[0].hektar).toBe(10);
    expect(w.state.reiter[0].koerner).toBe(90000);
    expect(w.state.reiter[1].koernerProEinheit).toBe(50000);
    expect(w.state.reiter[1].hektar).toBe(5);
    expect(w.state.reiter[1].koerner).toBe(70000);
    // globaler Default auf Mais
    expect(w.state.koernerProEinheit).toBe(50000);
    expect(w.state.kultur).toBe('mais');
    expect(w.state.erstauswahlDone).toBe(true);
  });
});