/**
 * HIGH 4: einheitGroesseUpdate darf state.koernerProEinheit NICHT mehr ändern.
 *
 * Vorher: Handler kommentierte „nur aktiver Schlag" und setzte aber
 *   trotzdem state.koernerProEinheit=rounded. Drift zwischen Doku und
 *   Verhalten — neue Tabs hätten bei addReiter den STATE-Wert statt den
 *   Kultur-Standard bekommen können.
 *
 * Fix: Handler schreibt NUR auf activeTab.koernerProEinheit. Neue Tabs
 *   bekommen weiterhin den Kultur-Standard (siehe addReiter).
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

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