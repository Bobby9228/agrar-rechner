/**
 * Per-Tab Einheitsgröße: zwei Tabs mit verschiedenen kpe rechnen unabhängig.
 *
 * Feature-Spec:
 *   "Einheitsgröße ist ab jetzt pro Schlag gespeichert und direkt manuell
 *    anpassbar. Eine manuelle Änderung wirkt nur auf diesen Schlag."
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

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