/**
 * Sonstiges (kultur='sonstiges', kpe=0/leer).
 *
 * - Solange keine gültige Körner-pro-Einheit-Größe vorhanden ist, keine
 *   irreführende Einheiten-Berechnung bzw. Infinity/NaN anzeigen, sondern
 *   sichtbar: "Bitte Körner pro Einheit angeben, damit die benötigten
 *   Saatgut-Einheiten berechnet werden können."
 * - Körner gesamt und Dünger kommen OHNE kpe aus und müssen daher sichtbar
 *   bleiben (Saatgut-Einheiten brauchen kpe, der Rest nicht).
 * - Empfehlungstext für Sonstiges ist leer UND visuell verborgen.
 * - Statischer Hilfetext im Einheiten-Editor (#einheit_groesse_settings)
 *   nennt keinen Mais-spezifischen Standard ("üblich: 50.000").
 *
 * Zugehörige frühere Dateien: tests/66-kultur-sonstiges.test.js,
 * tests/73-sonstiges-korner-duenger-stay-visible.test.js,
 * tests/74-koerner-empfehlung-sonstiges-leer.test.js,
 * tests/einheit-groesse.test.js (Issue #419 Welle 1).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import { createDom } from './helpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(__dirname, '../public/index.html');
const htmlSource = readFileSync(htmlPath, 'utf-8');

function getEditorInfoText() {
  // Parsen gegen echtes HTML, damit der Test an genau der Stelle
  // ansetzt, die auch im Browser gerendert wird.
  const dom = new JSDOM(htmlSource);
  const settings = dom.window.document.getElementById('einheit_groesse_settings');
  if (!settings) return '';
  const info = settings.querySelector('.fahrgassen-info');
  return info ? info.textContent : '';
}

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

describe('Sonstiges ohne kpe — Körner gesamt & Dünger bleiben sichtbar', () => {
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

describe('#koerner_empfehlung ist für Sonstiges leer und verborgen', () => {
  it('initiale Wahl Sonstiges: Element existiert, ist leer und nicht sichtbar', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('sonstiges');

    const emp = w.document.getElementById('koerner_empfehlung');
    expect(emp).toBeTruthy();
    // Vereinbarung: bei Sonstiges KEINE Aussaatstärke-Empfehlung
    expect(emp.textContent.trim()).toBe('');
    // Auch keine versteckte Fallback-Phrase wie "manuell eingeben"
    expect(/manuell eingeben/i.test(emp.textContent)).toBe(false);
    // Visuell verborgen: hidden-Attribut gesetzt
    expect(emp.hidden).toBe(true);
  });

  it('Wechsel Sonstiges → Mais: Element sichtbar mit exaktem Empfehlungstext', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('sonstiges'); // erst verborgen

    const empBefore = w.document.getElementById('koerner_empfehlung');
    expect(empBefore.hidden).toBe(true);

    // Wechsel via Modal-Bestätigung (so wie es im Browser passiert)
    w.requestChangeKultur();
    w.AppGlobals._pendingKulturChoice = 'mais';
    w.confirmChangeKultur();

    const emp = w.document.getElementById('koerner_empfehlung');
    expect(emp.hidden).toBe(false);
    expect(emp.textContent).toBe('üblich: 80.000 – 100.000');
  });

  it('Wechsel Mais → Sonstiges: Element wird wieder leer und verborgen', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    const empMais = w.document.getElementById('koerner_empfehlung');
    expect(empMais.hidden).toBe(false);
    expect(empMais.textContent).toBe('üblich: 80.000 – 100.000');

    w.requestChangeKultur();
    w.AppGlobals._pendingKulturChoice = 'sonstiges';
    w.confirmChangeKultur();

    const emp = w.document.getElementById('koerner_empfehlung');
    expect(emp.textContent.trim()).toBe('');
    expect(emp.hidden).toBe(true);
  });
});

describe('Einheiten-Editor (statischer Hilfetext) ist kulturunabhängig', () => {
  it('echte index.html: keine Mais-spezifische Standard-Zahl im Editor-Hilfetext', () => {
    const infoText = getEditorInfoText();
    expect(infoText).toBeTruthy(); // Editor muss überhaupt einen Hilfetext haben

    // Hauptbefund: kein hartcodierter Mais-Standard mehr
    expect(infoText.indexOf('üblich: 50.000')).toBe(-1);
    expect(infoText.indexOf('üblich: 50000')).toBe(-1);
    expect(infoText.indexOf('50.000')).toBe(-1);

    // Auch keine anderen konkreten Kultur-Defaults
    expect(infoText.indexOf('Mais')).toBe(-1);
    expect(infoText.indexOf('Raps')).toBe(-1);
    expect(infoText.indexOf('Sonstiges')).toBe(-1);
  });
});
