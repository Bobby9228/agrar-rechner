/**
 * Regression: Sonstiges ohne Einheitsgröße (kpe=0) — nur die
 * Saatgut-Einheiten-Berechnung darf ausfallen, weil sie kpe benötigt.
 * Körner gesamt (× × Hektar × Körner/ha) und Dünger (× × Hektar × kg/ha)
 * kommen OHNE kpe aus und müssen daher sichtbar bleiben.
 *
 * Vorher blendete render-results.js fälschlich auch #r_korner und
 * #r_duenger mit '—' aus, wenn !hasValidKpe. Das verschleierte beim
 * Landwirt den Überblick über Saatgut-Plan und Dünger-Plan für Sonstiges.
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

describe('Regression: Sonstiges ohne kpe — Körner gesamt & Dünger bleiben sichtbar', () => {
  it('#r_korner zeigt die tatsächliche Körner-gesamtzahl (10 ha × 90.000 = 900.000), nicht „—"', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('sonstiges');
    w.addReiter();
    w.state.activeReiter = 1;
    w.state.reiter[1].hektar = 10;
    w.state.reiter[1].koerner = 90000;
    w.state.reiter[1].duenger = 150;
    w.state.reiter[1].koernerProEinheit = 0;
    w.renderResults();
    const rk = w.document.getElementById('r_korner');
    expect(rk.textContent).not.toBe('—');
    // 10 × 90.000 = 900.000
    expect(rk.textContent).toContain('900');
  });

  it('#r_duenger zeigt „1.500 kg" (10 ha × 150 kg/ha) trotz kpe=0', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('sonstiges');
    w.addReiter();
    w.state.activeReiter = 1;
    w.state.reiter[1].hektar = 10;
    w.state.reiter[1].koerner = 90000;
    w.state.reiter[1].duenger = 150;
    w.state.reiter[1].koernerProEinheit = 0;
    w.renderResults();
    const rd = w.document.getElementById('r_duenger');
    expect(rd.textContent).not.toBe('—');
    expect(rd.textContent).toContain('1.500');
    expect(rd.textContent).toContain('kg');
  });

  it('#r_einheiten zeigt „—" bei kpe=0 (braucht kpe zum Rechnen)', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('sonstiges');
    w.addReiter();
    w.state.activeReiter = 1;
    w.state.reiter[1].hektar = 10;
    w.state.reiter[1].koerner = 90000;
    w.state.reiter[1].koernerProEinheit = 0;
    w.renderResults();
    const re = w.document.getElementById('r_einheiten');
    expect(re.textContent).toBe('—');
  });

  it('Placeholder-Hinweis (#kultur_missing_kpe_hint) bleibt sichtbar innerhalb der Ergebniskarte', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('sonstiges');
    w.addReiter();
    w.state.activeReiter = 1;
    w.state.reiter[1].hektar = 10;
    w.state.reiter[1].koerner = 90000;
    w.state.reiter[1].koernerProEinheit = 0;
    w.renderResults();
    const hint = w.document.getElementById('kultur_missing_kpe_hint');
    expect(hint).toBeTruthy();
    // Hinweis lebt INNERHALB der #results-Karte (nicht außerhalb)
    const results = w.document.getElementById('results');
    expect(results.contains(hint)).toBe(true);
    expect(hint.textContent).toContain('Körner pro Einheit angeben');
  });

  it('kein NaN/Infinity in irgendeinem Wert der Ergebniskarte', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('sonstiges');
    w.addReiter();
    w.state.activeReiter = 1;
    w.state.reiter[1].hektar = 10;
    w.state.reiter[1].koerner = 90000;
    w.state.reiter[1].duenger = 150;
    w.state.reiter[1].koernerProEinheit = 0;
    w.renderResults();
    const ids = ['r_korner', 'r_einheiten', 'r_duenger', 'r_info'];
    for (const id of ids) {
      const el = w.document.getElementById(id);
      expect(el.textContent.indexOf('NaN'), id + ' enthält NaN').toBe(-1);
      expect(el.textContent.indexOf('Infinity'), id + ' enthält Infinity').toBe(-1);
    }
  });

  it('Sobald User kpe einträgt, zeigt #r_einheiten wieder eine Zahl', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('sonstiges');
    w.addReiter();
    w.state.activeReiter = 1;
    w.state.reiter[1].hektar = 10;
    w.state.reiter[1].koerner = 90000;
    w.state.reiter[1].koernerProEinheit = 0;
    w.renderResults();
    expect(w.document.getElementById('r_einheiten').textContent).toBe('—');
    // User trägt kpe ein
    w.state.reiter[1].koernerProEinheit = 50000;
    w.renderResults();
    const re = w.document.getElementById('r_einheiten');
    expect(re.textContent).not.toBe('—');
    expect(re.textContent).toContain('18');
  });
});
