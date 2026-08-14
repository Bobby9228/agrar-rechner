/**
 * Sonstiges (kpe=0/leer): Placeholder statt irreführender Berechnung.
 *
 * Feature-Spec:
 *   "Solange keine gültige Körner-pro-Einheit-Größe vorhanden ist, keine
 *    irreführende Einheiten-Berechnung bzw. Infinity/NaN anzeigen, sondern
 *    sichtbar: „Bitte Körner pro Einheit angeben, damit die benötigten
 *    Saatgut-Einheiten berechnet werden können.""
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

describe('Sonstiges: Placeholder & kein NaN/Infinity', () => {
  it('Sonstiges-Tab ohne kpe: getTabTotalEinheiten gibt 0, nicht NaN/Infinity', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('sonstiges');
    w.addReiter(); // neuer Schlag hat kpe=0
    const r = w.state.reiter[1];
    r.hektar = 10;
    r.koerner = 90000;
    const result = w.getTabTotalEinheiten(r);
    expect(result).toBe(0);
    expect(isFinite(result)).toBe(true);
    expect(isNaN(result)).toBe(false);
  });

  it('Sonstiges-Tab ohne kpe: getTabIstEinheiten gibt 0', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('sonstiges');
    w.addReiter();
    const r = w.state.reiter[1];
    r.hektar = 10;
    r.istHektar = 8;
    r.koerner = 90000;
    const result = w.getTabIstEinheiten(r);
    expect(result).toBe(0);
    expect(isFinite(result)).toBe(true);
  });

  it('getDuengerProEinheit mit kpe=0 gibt 0', () => {
    const { window: w } = createDom();
    const r = { duenger: 200, koerner: 90000, koernerProEinheit: 0 };
    expect(w.getDuengerProEinheit(r)).toBe(0);
  });

  it('getTabRates mit kpe=0 gibt unitsPerHa=0', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('sonstiges');
    w.addReiter();
    const r = w.state.reiter[1];
    r.koerner = 90000;
    const rates = w.getTabRates(1);
    expect(rates.unitsPerHa).toBe(0);
  });

  it('renderResultCard zeigt Placeholder-Hinweis für Sonstiges ohne kpe', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('sonstiges');
    w.addReiter();
    w.state.reiter[1].hektar = 10;
    w.state.reiter[1].koerner = 90000;
    w.state.reiter[1].koernerProEinheit = 0; // explizit kein kpe
    w.renderResults();
    const hint = w.document.getElementById('kultur_missing_kpe_hint');
    expect(hint).toBeTruthy();
    expect(hint.textContent).toContain('Körner pro Einheit angeben');
  });

  it('renderResultCard versteckt irreführende Werte bei Sonstiges ohne kpe', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('sonstiges');
    w.addReiter();
    w.state.reiter[1].hektar = 10;
    w.state.reiter[1].koerner = 90000;
    w.state.reiter[1].koernerProEinheit = 0;
    w.renderResults();
    const re = w.document.getElementById('r_einheiten');
    const rd = w.document.getElementById('r_duenger');
    const rinfo = w.document.getElementById('r_info');
    // Statt irreführender Zahlen soll '—' oder ein Text ohne Zahl stehen
    const reText = re ? re.textContent : '';
    const rdText = rd ? rd.textContent : '';
    expect(reText.indexOf('NaN')).toBe(-1);
    expect(reText.indexOf('Infinity')).toBe(-1);
    expect(rdText.indexOf('NaN')).toBe(-1);
    expect(rdText.indexOf('Infinity')).toBe(-1);
  });

  it('Sobald User einen kpe einträgt, verschwindet Placeholder und Berechnung erscheint', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('sonstiges');
    w.addReiter();
    w.state.reiter[1].hektar = 10;
    w.state.reiter[1].koerner = 90000;
    w.state.reiter[1].koernerProEinheit = 0;
    w.renderResults();
    // Placeholder sichtbar
    expect(w.document.getElementById('kultur_missing_kpe_hint')).toBeTruthy();
    // User trägt kpe ein (z.B. via einheitGroesseUpdate auf active tab)
    w.state.reiter[1].koernerProEinheit = 50000;
    w.renderResults();
    // Placeholder weg
    expect(w.document.getElementById('kultur_missing_kpe_hint')).toBeFalsy();
    // Einheiten sichtbar (10 * 90000 / 50000 = 18)
    const reText = w.document.getElementById('r_einheiten').textContent;
    expect(reText).toContain('18');
  });

  it('Math.max(0, ...) in IST-Einheiten fängt NaN/Infinity ab', () => {
    // Sicherstellen: wenn kpe ungültig ist, gibt es keine NaN-Werte
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('sonstiges');
    w.addReiter();
    const r = w.state.reiter[1];
    r.hektar = 10;
    r.istHektar = 8;
    r.koerner = 90000;
    r.koernerProEinheit = -1; // Ungültig
    const e = w.getTabIstEinheiten(r);
    expect(e).toBe(0);
    expect(isNaN(e)).toBe(false);
    expect(isFinite(e)).toBe(true);
  });
});