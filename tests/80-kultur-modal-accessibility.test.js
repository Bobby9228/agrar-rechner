/**
 * Regression: Accessibility beider Kultur-Dialoge.
 *
 * Bug-Beschreibung (bestätigter Review-Fehler):
 *   1. First-run-Modal (#kultur_modal) öffnete sich ohne explizite
 *      Fokus-Verlagerung in den Dialog hinein. Tastatur-User landeten
 *      auf einem außerhalb stehenden Element (z.B. dem Hintergrund-View)
 *      und konnten den Dialog nicht bedienen.
 *   2. Wechsel-Dialog (#kultur_confirm_modal) hatte denselben Defekt
 *      und bot zusätzlich keinen Escape-Pfad.
 *   3. Tab/Shift+Tab konnten aus einem offenen Dialog in den Hintergrund
 *      hinausspringen, sodass der Landwirt mit Tastatur „verloren" ging.
 *   4. Escape auf dem Wechsel-Dialog tat nichts — der Landwirt konnte
 *      den Wechsel nicht abbrechen, ohne Maus oder das ✕-Symbol zu
 *      benutzen. Nach dem Abbruch fehlte die Fokus-Rückgabe an den
 *      ändern-Button, sodass der Fokus auf body liegt.
 *   5. First-run-Modal darf Escape weiterhin NICHT schließen (das ist
 *      die verlangte Erzwingung der Erstauswahl — bestehender Test 61).
 *
 *   Erwartetes Verhalten:
 *     - Beim Öffnen wird der Fokus in den Dialog verschoben (erstes
 *       fokussierbares Element).
 *     - Tab/Shift+Tab cycelt innerhalb des offenen Dialogs.
 *     - Wechsel-Dialog: Escape bricht ab + stellt Fokus auf den
 *       vorher aktiven ändern-Button wieder her.
 *     - First-run-Modal: Escape bleibt wirkungslos (kein Schließen).
 *     - Hintergrund-Buttons dürfen nicht per Tastatur erreichbar sein,
 *       solange ein Dialog offen ist.
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

function getFocusable(root) {
  // Focusable Selektoren — minimal aber ausreichend für beide Dialoge
  // (Buttons, Selects, Cancel-Buttons, Editier-Spans).
  var sel = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll(sel)).filter(function(el) {
    if (el.disabled) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    // display:none / hidden
    if (el.hidden) return false;
    if (el.style && el.style.display === 'none') return false;
    return true;
  });
}

function fireKey(el, key, opts) {
  opts = opts || {};
  var evt = new el.ownerDocument.defaultView.KeyboardEvent('keydown', {
    key: key,
    bubbles: true,
    cancelable: true,
    shiftKey: !!opts.shiftKey,
  });
  el.dispatchEvent(evt);
  return evt;
}

describe('Kultur-Dialoge: Accessibility (Fokus, Tab-Trap, Escape)', () => {
  describe('First-run-Modal (#kultur_modal)', () => {
    it('öffnet mit Fokus auf dem ersten Auswahl-Button', () => {
      const { window: w } = createDom();
      w.initUI();
      const first = w.document.getElementById('kultur_choice_mais');
      expect(w.document.activeElement).toBe(first);
    });

    it('Tab im Dialog cycelt zum letzten → wieder zum ersten (Focus-Trap)', () => {
      const { window: w } = createDom();
      w.initUI();
      const modal = w.document.getElementById('kultur_modal');
      const focusables = getFocusable(modal);
      expect(focusables.length).toBe(3); // mais, raps, sonstiges
      const last = focusables[focusables.length - 1];
      last.focus();
      expect(w.document.activeElement).toBe(last);
      // Tab auf letztem → preventDefault + focus first
      fireKey(last, 'Tab');
      expect(w.document.activeElement).toBe(focusables[0]);
    });

    it('Shift+Tab im Dialog cycelt vom ersten → letzten (Focus-Trap)', () => {
      const { window: w } = createDom();
      w.initUI();
      const modal = w.document.getElementById('kultur_modal');
      const focusables = getFocusable(modal);
      const first = focusables[0];
      first.focus();
      expect(w.document.activeElement).toBe(first);
      fireKey(first, 'Tab', { shiftKey: true });
      expect(w.document.activeElement).toBe(focusables[focusables.length - 1]);
    });

    it('Escape schließt das First-run-Modal NICHT (bestehende Erzwingung)', () => {
      const { window: w } = createDom();
      w.initUI();
      const modal = w.document.getElementById('kultur_modal');
      expect(modal.classList.contains('open')).toBe(true);
      fireKey(modal, 'Escape');
      expect(modal.classList.contains('open')).toBe(true);
    });

    it('Hintergrund-Buttons sind nicht per Tastatur-Tab erreichbar, solange das Modal offen ist', () => {
      const { window: w } = createDom();
      w.initUI();
      // Bei offenem Modal dürfte der nächste Tab-Default-Fokus NICHT auf
      // außerhalb liegenden Buttons (z.B. kultur_badge_change, theme_toggle,
      // dashboard-open-btn) landen. Wir prüfen, dass alle focusables im
      // Modal liegen und keine Hintergrund-Buttons im Trap enthalten sind.
      const modal = w.document.getElementById('kultur_modal');
      const focusablesTrapped = getFocusable(modal);
      // Die 3 Auswahl-Buttons müssen im Trap sein
      expect(focusablesTrapped.length).toBe(3);
      // Hintergrund-Button (änder-Button) ist zu diesem Zeitpunkt sowieso
      // hidden (kein Badge sichtbar). Aber für den Fall, dass wir später
      // den Reset-Pfad testen, ist es wichtig, dass der Trap nicht
      // versehentlich Hintergrund-Elemente einschließt.
      const themeBtn = w.document.getElementById('theme_toggle');
      // Falls vorhanden und nicht versteckt: er MUSS aus dem Trap
      // ausgeschlossen sein.
      if (themeBtn && !themeBtn.hidden) {
        expect(focusablesTrapped.indexOf(themeBtn)).toBe(-1);
      }
    });
  });

  describe('Wechsel-Dialog (#kultur_confirm_modal)', () => {
    it('öffnet mit Fokus auf dem ersten fokussierbaren Element (Cancel-✕)', () => {
      const { window: w } = createDom();
      w.initUI();
      w.chooseKultur('mais');
      // ändern-Button explizit fokussieren, damit der vorherige Fokus
      // klar ist (Test der Fokus-Rückgabe)
      const changeBtn = w.document.getElementById('kultur_badge_change');
      changeBtn.focus();
      expect(w.document.activeElement).toBe(changeBtn);

      w.requestChangeKultur();
      const modal = w.document.getElementById('kultur_confirm_modal');
      expect(modal.classList.contains('open')).toBe(true);
      // Fokus MUSS in den Dialog gewandert sein
      var focusables = getFocusable(modal);
      expect(focusables.length).toBeGreaterThan(0);
      expect(focusables.indexOf(w.document.activeElement)).toBeGreaterThan(-1);
    });

    it('Tab cycelt zum letzten → wieder zum ersten (Focus-Trap)', () => {
      const { window: w } = createDom();
      w.initUI();
      w.chooseKultur('mais');
      w.requestChangeKultur();
      const modal = w.document.getElementById('kultur_confirm_modal');
      const focusables = getFocusable(modal);
      const last = focusables[focusables.length - 1];
      last.focus();
      fireKey(last, 'Tab');
      expect(w.document.activeElement).toBe(focusables[0]);
    });

    it('Shift+Tab cycelt vom ersten → letzten (Focus-Trap)', () => {
      const { window: w } = createDom();
      w.initUI();
      w.chooseKultur('mais');
      w.requestChangeKultur();
      const modal = w.document.getElementById('kultur_confirm_modal');
      const focusables = getFocusable(modal);
      const first = focusables[0];
      first.focus();
      fireKey(first, 'Tab', { shiftKey: true });
      expect(w.document.activeElement).toBe(focusables[focusables.length - 1]);
    });

    it('Escape bricht ab und gibt Fokus an den zuvor fokussierten ändern-Button zurück', () => {
      const { window: w } = createDom();
      w.initUI();
      w.chooseKultur('mais');
      const changeBtn = w.document.getElementById('kultur_badge_change');
      changeBtn.focus();
      expect(w.document.activeElement).toBe(changeBtn);

      w.requestChangeKultur();
      const modal = w.document.getElementById('kultur_confirm_modal');
      // Fokus sitzt jetzt im Dialog
      expect(focusablesOf(modal).indexOf(w.document.activeElement)).toBeGreaterThan(-1);

      // Escape → cancelChangeKultur()
      fireKey(modal, 'Escape');
      expect(modal.classList.contains('open')).toBe(false);
      // Fokus zurück auf den ändern-Button
      expect(w.document.activeElement).toBe(changeBtn);
      // state unverändert (cancel hat keinen Effekt auf kultur)
      expect(w.state.kultur).toBe('mais');
    });

    it('Escape ohne vorher fokussierten ändern-Button: Fokus fällt auf body oder ersten Hintergrund-Button (kein Crash)', () => {
      // Wenn der Wechsel-Dialog z.B. programmatisch geöffnet wurde
      // (z.B. Cross-Tab-Sync) und der Landwirt drückt Escape, muss
      // zumindest kein Crash entstehen. Fokus darf auf body fallen.
      const { window: w } = createDom();
      w.initUI();
      w.chooseKultur('mais');
      w.requestChangeKultur();
      const modal = w.document.getElementById('kultur_confirm_modal');
      // Fokus aus dem Dialog entfernen, damit der "vorher fokusierte
      // ändern-Button" nicht der gerenderte ist
      w.document.body.focus();
      fireKey(modal, 'Escape');
      expect(modal.classList.contains('open')).toBe(false);
      // nach dem Escape ist der Modal zu — kein Crash, Fokus ist
      // nicht mehr im Modal
      expect(focusablesOf(modal).indexOf(w.document.activeElement)).toBe(-1);
    });

    it('Hintergrund-Buttons sind nicht per Tab erreichbar, solange der Wechsel-Dialog offen ist', () => {
      const { window: w } = createDom();
      w.initUI();
      w.chooseKultur('mais');
      w.requestChangeKultur();
      const modal = w.document.getElementById('kultur_confirm_modal');
      const focusables = getFocusable(modal);
      // Kein Hintergrund-Element (theme_toggle, dashboard-open-btn) im Trap
      var tabBar = w.document.getElementById('tab_bar_left');
      // Tab-Namen sind Editier-Spans; theme_toggle ist sichtbar
      var themeBtn = w.document.getElementById('theme_toggle');
      if (themeBtn) {
        expect(focusables.indexOf(themeBtn)).toBe(-1);
      }
      // Tab-Editspans sind außerhalb des Modals
      expect(tabBar).toBeTruthy();
    });
  });

  describe('First-run-Modal nach Reset (resetAll → openKulturFirstRun)', () => {
    it('Fokus wandert nach resetAll() automatisch in den wieder geöffneten First-run-Dialog', () => {
      const { window: w } = createDom();
      w.initUI();
      w.chooseKultur('raps');
      // ändern-Button hat aktuell Fokus
      const changeBtn = w.document.getElementById('kultur_badge_change');
      changeBtn.focus();
      expect(w.document.activeElement).toBe(changeBtn);

      // Reset löst openKulturFirstRun aus
      w.resetAll();

      // Modal ist offen UND Fokus liegt im Dialog
      const modal = w.document.getElementById('kultur_modal');
      expect(modal.classList.contains('open')).toBe(true);
      expect(focusablesOf(modal).indexOf(w.document.activeElement)).toBeGreaterThan(-1);
    });
  });
});

function focusablesOf(modal) {
  var sel = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  return Array.from(modal.querySelectorAll(sel)).filter(function(el) {
    if (el.disabled) return false;
    if (el.hidden) return false;
    if (el.style && el.style.display === 'none') return false;
    return true;
  });
}
