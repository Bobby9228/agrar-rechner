/**
 * Kultur-Wechsel: Bestätigungs-Modal verhindert versehentliche Änderungen.
 *
 * Feature-Spec:
 *   "Beim Ändern MUSS vor dem tatsächlichen Wechsel gewarnt/bestätigt werden.
 *    Die Warnung erklärt: vorhandene Schläge behalten ihre Einheitsgrößen;
 *    nur neue Schläge erhalten den neuen Standard. Abbruch lässt alles unverändert.
 *    Kulturwechsel verändert keine bestehenden Schläge und deren Eingaben/Protokolle."
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

describe('Kultur-Wechsel mit Bestätigung', () => {
  it('Kultur-Badge zeigt aktuelle Kultur und „ändern"-Button', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    const badge = w.document.getElementById('kultur_badge');
    const emoji = w.document.getElementById('kultur_badge_emoji');
    const label = w.document.getElementById('kultur_badge_label');
    const changeBtn = w.document.getElementById('kultur_badge_change');
    expect(badge.hidden).toBe(false);
    expect(emoji.textContent).toBe('🌽');
    expect(label.textContent).toBe('Mais');
    expect(changeBtn).toBeTruthy();
    expect(changeBtn.getAttribute('aria-label')).toBeTruthy();
  });

  it('requestChangeKultur öffnet Bestätigungs-Modal mit korrekter Rolle', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.requestChangeKultur();
    const modal = w.document.getElementById('kultur_confirm_modal');
    expect(modal.classList.contains('open')).toBe(true);
    expect(modal.getAttribute('role')).toBe('alertdialog');
    expect(modal.getAttribute('aria-modal')).toBe('true');
    // Erklärungstext sichtbar (enthält Stichworte aus der Spec)
    const desc = w.document.getElementById('kultur_confirm_desc');
    expect(desc.textContent).toContain('Einheitsgrößen');
    expect(desc.textContent).toContain('neue Schläge');
  });

  it('cancelChangeKultur lässt state.kultur UND alle Schläge unverändert', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    // Tab mit Daten anlegen
    w.addReiter();
    w.state.reiter[1].hektar = 10;
    w.state.reiter[1].koerner = 90000;
    w.state.reiter[1].koernerProEinheit = 60000; // benutzerdefiniert
    // Snapshot
    const snapKultur = w.state.kultur;
    const snapKpe = w.state.koernerProEinheit;
    const snapTab1 = JSON.parse(JSON.stringify(w.state.reiter[1]));
    // Wechsel anfordern → abbrechen
    w.requestChangeKultur();
    w.cancelChangeKultur();
    // Alles unverändert
    expect(w.state.kultur).toBe(snapKultur);
    expect(w.state.koernerProEinheit).toBe(snapKpe);
    expect(w.state.reiter[1]).toEqual(snapTab1);
  });

  it('confirmChangeKultur("raps") ändert nur Profil, nicht bestehende Schläge', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.addReiter();
    w.state.reiter[1].hektar = 10;
    w.state.reiter[1].koerner = 90000;
    w.state.reiter[1].koernerProEinheit = 60000; // benutzerdefiniert
    const snapTab1 = JSON.parse(JSON.stringify(w.state.reiter[1]));
    // Wechsel zu Raps
    w.requestChangeKultur();
    w.AppGlobals._pendingKulturChoice = 'raps';
    w.confirmChangeKultur();
    // Profil geändert
    expect(w.state.kultur).toBe('raps');
    expect(w.state.koernerProEinheit).toBe(1500000);
    // bestehender Tab unverändert (insb. eigene koernerProEinheit)
    expect(w.state.reiter[1]).toEqual(snapTab1);
    expect(w.state.reiter[1].koernerProEinheit).toBe(60000);
  });

  it('nach Kultur-Wechsel zu Sonstiges: bestehende Tabs behalten ihren kpe, neue bekommen 0', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.addReiter();
    w.state.reiter[1].hektar = 10;
    w.state.reiter[1].koerner = 90000;
    w.state.reiter[1].koernerProEinheit = 50000;
    w.requestChangeKultur();
    w.AppGlobals._pendingKulturChoice = 'sonstiges';
    w.confirmChangeKultur();
    expect(w.state.kultur).toBe('sonstiges');
    expect(w.state.reiter[1].koernerProEinheit).toBe(50000);
    // Neuer Tab nach Wechsel
    w.addReiter();
    expect(w.state.reiter[2].koernerProEinheit).toBe(0);
  });

  it('confirmChangeKultur mit ungültigem Key lässt State unverändert', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.requestChangeKultur();
    w.AppGlobals._pendingKulturChoice = 'garbage';
    const prevKultur = w.state.kultur;
    w.confirmChangeKultur();
    expect(w.state.kultur).toBe(prevKultur);
  });

  it('Kultur-Wechsel persistiert in localStorage', () => {
    const { window: w, store } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.requestChangeKultur();
    w.AppGlobals._pendingKulturChoice = 'raps';
    w.confirmChangeKultur();
    const saved = JSON.parse(store['agrar_rechner']);
    expect(saved.kultur).toBe('raps');
    expect(saved.koernerProEinheit).toBe(1500000);
  });

  it('Empfehlungstext unter "Körner pro Hektar" aktualisiert sich beim Wechsel', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    var emp = w.document.getElementById('koerner_empfehlung');
    expect(emp).toBeTruthy();
    expect(emp.textContent).toContain('80.000');
    // Wechsel zu Raps
    w.requestChangeKultur();
    w.AppGlobals._pendingKulturChoice = 'raps';
    w.confirmChangeKultur();
    emp = w.document.getElementById('koerner_empfehlung');
    expect(emp.textContent).toContain('250.000');
  });

  it('Sonstiges: Empfehlungstext enthält keine Zahl mehr', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('sonstiges');
    var emp = w.document.getElementById('koerner_empfehlung');
    expect(emp).toBeTruthy();
    // Sonstiges: Empfehlung darf KEINE Zahl enthalten
    expect(/\d/.test(emp.textContent)).toBe(false);
  });
});