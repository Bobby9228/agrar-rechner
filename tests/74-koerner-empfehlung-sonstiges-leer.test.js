/**
 * Bug-Fix #1: #koerner_empfehlung muss für "Sonstiges" leer UND visuell
 * verborgen sein (kein irreführender Fallback-Text "Körner/ha manuell
 * eingeben"). Für Mais und Raps muss das Element sichtbar bleiben und
 * den exakten bisherigen Empfehlungstext zeigen.
 *
 * Vorher (Bug): Sonstiges → textContent = "Körner/ha manuell eingeben",
 *   Element sichtbar. Vereinbarte Produktregel sagt aber: keine
 *   Aussaatstärke-Empfehlung bei Sonstiges.
 *
 * Getestet: (a) initiale Wahl Sonstiges, (b) Wechsel Sonstiges → Mais,
 *           (c) Wechsel Mais → Sonstiges (wieder verborgen).
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

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
