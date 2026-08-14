/**
 * Regression: renderMachineLog() muss unitsPerHa aus dem per-Tab-Wert
 * (über getTabRates) berechnen, NICHT aus dem globalen Profil-Default
 * state.koernerProEinheit.
 *
 * Bug-Beschreibung (bestätigter Review-Fehler):
 *   In render-drill.js wurde unitsPerHa direkt mit
 *   `AppGlobals.state.koernerProEinheit` (global) berechnet. Nach
 *   Kultur-Wechsel zu Raps (state.koernerProEinheit = 1.500.000) zeigt
 *   der Maschinen-Prognose-Block einen viel zu großen "Saat leer bei"-
 *   Wert, obwohl der aktive Tab noch den alten Mais-Wert (50.000) führt.
 *   Außerdem konnte ein per-Tab kpe=0 (Sonstiges vor Eingabe) zu einer
 *   Division durch 0 / Infinity führen, wenn der globale Wert ebenfalls
 *   0 oder nicht gesetzt war.
 *
 * Erwartetes Verhalten:
 *   - unitsPerHa = koerner × fgFaktor / per-Tab koernerProEinheit
 *   - 0 wird sicher behandelt: bei kpe=0 ist unitsPerHa=0, keine
 *     Infinity-/NaN-Werte im DOM
 *   - Der bestehende Helper getTabRates(tabIdx) ist die Single Source
 *     of Truth — verwendungspflicht.
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

describe('renderMachineLog nutzt per-Tab koernerProEinheit via getTabRates', () => {
  it('Per-Tab kpe weicht vom globalen Profil-Default ab → Prognose folgt per-Tab', () => {
    const { window: w } = createDom();
    // Globales Profil wurde bereits auf Raps gewechselt (1.500.000),
    // aber dieser Tab wurde VOR dem Wechsel angelegt und behält seine
    // alte, manuelle koernerProEinheit = 50.000.
    w.state.koernerProEinheit = 1500000;
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10,
      koerner: 90000,
      koernerProEinheit: 50000, // manuell (alter Mais-Tab)
      entries: [],
    };
    w.state.machineLog = [
      { einheit: 5, zaehlerStand: 0, duenger: 0, time: '10:00' },
    ];
    w.renderResults();

    var mlContainer = w.document.getElementById('drill_machine_log');
    var prognose = mlContainer.querySelectorAll('.drill-prognose');
    expect(prognose.length).toBe(1);
    // per-Tab kpe=50000 → unitsPerHa = 90000/50000 = 1,8
    // saatLeer = 0 + 5/1,8 = 2,778 → fmt → "2,8"
    expect(prognose[0].textContent).toContain('2,8');
    // Defensive: darf NICHT den global-buggy-Wert enthalten
    expect(prognose[0].textContent).not.toContain('83,3');
  });

  it('Per-Tab kpe = 0 (Sonstiges) → unitsPerHa = 0, keine Saat-Prognose, keine Infinity', () => {
    const { window: w } = createDom();
    w.state.koernerProEinheit = 50000; // global = Mais-Default
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10,
      koerner: 90000,
      koernerProEinheit: 0, // Sonstiges ohne Eingabe
      entries: [],
    };
    w.state.machineLog = [
      { einheit: 5, zaehlerStand: 0, duenger: 0, time: '10:00' },
    ];
    // Wichtig: kein Werfen, keine Infinity/NaN im DOM
    expect(() => w.renderResults()).not.toThrow();

    var mlContainer = w.document.getElementById('drill_machine_log');
    var prognose = mlContainer.querySelectorAll('.drill-prognose');
    // Bei unitsPerHa=0 darf KEINE Saat-Prognose erscheinen
    var saatPrognose = Array.from(prognose).filter(function(p) {
      return p.textContent.indexOf('Saat leer bei') !== -1;
    });
    expect(saatPrognose.length).toBe(0);
    // Defensiv: kein Infinity-/NaN-Text im DOM
    var html = mlContainer.innerHTML;
    expect(html).not.toMatch(/Infinity/);
    expect(html).not.toMatch(/NaN/);
  });

  it('Globaler kpe=0 + per-Tab kpe>0 → keine Infinity, korrekte per-Tab-Prognose', () => {
    const { window: w } = createDom();
    // Edge-Case: global wurde geleert (z.B. Sonstiges-Flow ohne Profil),
    // aber dieser konkrete Tab hat eine eigene kpe.
    w.state.koernerProEinheit = 0;
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10,
      koerner: 90000,
      koernerProEinheit: 50000,
      entries: [],
    };
    w.state.machineLog = [
      { einheit: 5, zaehlerStand: 0, duenger: 0, time: '10:00' },
    ];
    expect(() => w.renderResults()).not.toThrow();
    var mlContainer = w.document.getElementById('drill_machine_log');
    var html = mlContainer.innerHTML;
    expect(html).not.toMatch(/Infinity/);
    expect(html).not.toMatch(/NaN/);
    var prognose = mlContainer.querySelectorAll('.drill-prognose');
    expect(prognose.length).toBe(1);
    expect(prognose[0].textContent).toContain('2,8');
  });

  it('getTabRates(activeIdx) ist die Quelle für unitsPerHa im Maschinen-Protokoll', () => {
    const { window: w } = createDom();
    w.state.koernerProEinheit = 1500000; // global = Raps
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10,
      koerner: 90000,
      koernerProEinheit: 45000, // manuell auf 45k
      entries: [],
    };
    // Der Helper liefert per-Tab 90000/45000 = 2,0
    var rates = w.getTabRates(0);
    expect(rates.unitsPerHa).toBeCloseTo(2.0, 5);

    w.state.machineLog = [
      { einheit: 4, zaehlerStand: 0, duenger: 0, time: '10:00' },
    ];
    w.renderResults();
    var mlContainer = w.document.getElementById('drill_machine_log');
    var prognose = mlContainer.querySelectorAll('.drill-prognose');
    // saatLeer = 0 + 4/2 = 2,0 → "2,0"
    expect(prognose[0].textContent).toContain('2,0');
    // Defensive: 90000/1500000 würde 0,06 ergeben → 4/0,06 = 66,7 → NICHT da
    expect(prognose[0].textContent).not.toContain('66,7');
  });
});
