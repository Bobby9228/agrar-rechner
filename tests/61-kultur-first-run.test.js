/**
 * Erststart-Kultur-Auswahl: Modal erscheint genau einmal.
 *
 * Feature: vor dem ersten produktiven Rechner-Klick muss der Landwirt
 *   eine Kultur wählen (Mais / Raps / Sonstiges). Erstauswahl wird
 *   persistent in `state.erstauswahlDone` gespeichert; nach Reload
 *   bleibt der Dialog verschwunden.
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

describe('Erststart: Kultur-Auswahl-Modal', () => {
  it('zeigt das Auswahl-Modal beim ersten initUI(), wenn keine Kultur gespeichert ist', () => {
    const { window: w, dom } = createDom();
    w.initUI();
    const modal = w.document.getElementById('kultur_modal');
    expect(modal).toBeTruthy();
    expect(modal.classList.contains('open')).toBe(true);
  });

  it('das Modal hat eine sinnvolle Rolle/aria-Label', () => {
    const { window: w } = createDom();
    w.initUI();
    const modal = w.document.getElementById('kultur_modal');
    expect(modal.getAttribute('role')).toBe('dialog');
    expect(modal.getAttribute('aria-modal')).toBe('true');
    // Title ist verlinkt via aria-labelledby
    const titleId = modal.getAttribute('aria-labelledby');
    const title = w.document.getElementById(titleId);
    expect(title).toBeTruthy();
    expect(title.textContent.trim().length).toBeGreaterThan(0);
  });

  it('bietet drei Auswahl-Buttons (Mais, Raps, Sonstiges) mit Daten-IDs', () => {
    const { window: w } = createDom();
    w.initUI();
    expect(w.document.getElementById('kultur_choice_mais')).toBeTruthy();
    expect(w.document.getElementById('kultur_choice_raps')).toBeTruthy();
    expect(w.document.getElementById('kultur_choice_sonstiges')).toBeTruthy();
  });

  it('zeigt die Kultur-Auswahl ohne Zusatztexte', () => {
    const { window: w } = createDom();
    const modal = w.document.getElementById('kultur_modal');

    expect(modal.getAttribute('aria-describedby')).toBeNull();
    expect(w.document.querySelector('.kultur-modal-subtitle')).toBeNull();
    expect(w.document.querySelectorAll('.kultur-option-desc')).toHaveLength(0);
  });

  it('zeigt das Modal NICHT, wenn bereits eine Kultur gespeichert ist', () => {
    const { window: w, store } = createDom();
    store['agrar_rechner'] = JSON.stringify({
      _lv: 6,
      reiter: [{ name: 'T', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false, koernerProEinheit: 50000 }],
      activeReiter: 0,
      activeView: null,
      kultur: 'mais',
      erstauswahlDone: true,
      koernerProEinheit: 50000,
      einheitGroesseEnabled: false,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      machineLog: [],
      drillPriorities: {}
    });
    w.initUI();
    const modal = w.document.getElementById('kultur_modal');
    expect(modal.classList.contains('open')).toBe(false);
  });

  it('chooseKultur("mais") setzt state.kultur und schließt das Modal', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    expect(w.state.kultur).toBe('mais');
    expect(w.state.erstauswahlDone).toBe(true);
    expect(w.state.koernerProEinheit).toBe(50000);
    const modal = w.document.getElementById('kultur_modal');
    expect(modal.classList.contains('open')).toBe(false);
  });

  it('chooseKultur("raps") setzt kultur + kpe auf 1.500.000', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('raps');
    expect(w.state.kultur).toBe('raps');
    expect(w.state.koernerProEinheit).toBe(1500000);
  });

  it('chooseKultur("sonstiges") setzt kultur, kpe bleibt 0', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('sonstiges');
    expect(w.state.kultur).toBe('sonstiges');
    expect(w.state.koernerProEinheit).toBe(0);
  });

  it('chooseKultur persistiert in localStorage', () => {
    const { window: w, store } = createDom();
    w.initUI();
    w.chooseKultur('raps');
    const saved = JSON.parse(store['agrar_rechner']);
    expect(saved.kultur).toBe('raps');
    expect(saved.erstauswahlDone).toBe(true);
    expect(saved.koernerProEinheit).toBe(1500000);
  });

  it('chooseKultur lehnt unbekannte Keys ab', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('unknown');
    expect(w.state.kultur).toBeNull();
    // Modal bleibt offen, weil keine gültige Wahl getroffen
    const modal = w.document.getElementById('kultur_modal');
    expect(modal.classList.contains('open')).toBe(true);
  });

  it('Modal kann NICHT ohne Auswahl geschlossen werden (kein Schließen ohne Kultur)', () => {
    const { window: w } = createDom();
    w.initUI();
    // Versuche, das Modal programmatisch zu schließen
    if (typeof w.closeKulturModal === 'function') {
      w.closeKulturModal();
    }
    const modal = w.document.getElementById('kultur_modal');
    // Solange keine Kultur gewählt wurde, bleibt das Modal sichtbar
    if (!w.state.kultur) {
      expect(modal.classList.contains('open')).toBe(true);
    }
  });

  it('Tastatur-Abbruch (Escape) lässt Auswahl weiterhin offen', () => {
    const { window: w } = createDom();
    w.initUI();
    const modal = w.document.getElementById('kultur_modal');
    // Escape-Event dispatchen — sollte das Modal NICHT schließen
    const evt = new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    modal.dispatchEvent(evt);
    expect(modal.classList.contains('open')).toBe(true);
  });
});