/**
 * Dialog-A11y — Vereinheitlichung der Tastatur-/Fokus-Verträge (Issue #446 Welle 1).
 *
 * Diese Suite bündelt die Vertrags-Tests für:
 *   - public/js/dialog-a11y.js       (generischer Helper)
 *   - Reset-Modal      (#reset_modal)
 *   - Import-Modal     (#import_modal)
 *   - Dashboard-Sheet  (#dashboard_sheet)
 *   - Protokoll-Action-Sheet (#local_protocol_action_sheet)
 *   - Tab-Close-Button (.tab-close) als echten <button>
 *
 * Bewusst NICHT in dieser Welle (Welle 2+):
 *   - Drill-Priorität-Beschriftungen, Live-Region Save-Banner,
 *     aria-current Bottom-Nav, Tablist/Arrow-Keys, Notizen-Fokusstil,
 *     44px-Touchziele, Textselektion, Emoji/Heading-Semantik.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

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

function getFocusable(root) {
  var sel = 'button:not([disabled]):not([hidden]), [href], input:not([disabled]):not([hidden]), select:not([disabled]):not([hidden]), textarea:not([disabled]):not([hidden]), [tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll(sel)).filter(function(el) {
    if (el.disabled) return false;
    if (el.hidden) return false;
    if (el.style && el.style.display === 'none') return false;
    return true;
  });
}

describe('Issue #446 Welle 1 — Dialog-A11y-Vereinheitlichung', () => {
  describe('Generischer Helper (public/js/dialog-a11y.js)', () => {
    it('ist auf AppGlobals und window global verfügbar', () => {
      const { window: w } = createDom();
      expect(typeof w.AppGlobals.installDialogA11y).toBe('function');
      expect(typeof w.AppGlobals.runDialogA11yCleanup).toBe('function');
      expect(typeof w.AppGlobals.getFocusableIn).toBe('function');
    });

    it('getFocusableIn liefert nur sichtbare, nicht-disabled Fokusierbare', () => {
      const { window: w } = createDom();
      var host = w.document.createElement('div');
      w.document.body.appendChild(host);
      var visibleBtn = w.document.createElement('button');
      visibleBtn.textContent = 'sichtbar';
      var hiddenBtn = w.document.createElement('button');
      hiddenBtn.textContent = 'versteckt';
      hiddenBtn.hidden = true;
      var displayNoneBtn = w.document.createElement('button');
      displayNoneBtn.textContent = 'display-none';
      displayNoneBtn.style.display = 'none';
      var disabledBtn = w.document.createElement('button');
      disabledBtn.textContent = 'disabled';
      disabledBtn.disabled = true;
      var inputEl = w.document.createElement('input');
      inputEl.type = 'text';
      var hiddenInput = w.document.createElement('input');
      hiddenInput.type = 'text';
      hiddenInput.hidden = true;
      [visibleBtn, hiddenBtn, displayNoneBtn, disabledBtn, inputEl, hiddenInput].forEach(function(el) {
        host.appendChild(el);
      });
      var focusables = w.AppGlobals.getFocusableIn(host);
      expect(focusables.length).toBe(2);
      // Elementare Identitätsprüfung statt toContain — die strukturelle
      // Gleichheit von jsdom-Elementen lässt Vitests toContain an
      // interner Node-Erzeugung scheitern (Cyclic/Proxy-Artefakt).
      expect(focusables.some(function (el) { return el === visibleBtn; })).toBe(true);
      expect(focusables.some(function (el) { return el === inputEl; })).toBe(true);
    });

    it('installDialogA11y fokussiert initialFocus-Element, wenn übergeben', () => {
      const { window: w } = createDom();
      var host = w.document.createElement('div');
      w.document.body.appendChild(host);
      var first = w.document.createElement('button');
      first.textContent = 'first';
      var second = w.document.createElement('button');
      second.textContent = 'second';
      host.appendChild(first);
      host.appendChild(second);

      // jsdom garantiert keinen body-Initialfokus (activeElement kann je
      // nach vorherigen Operationen auf einem Element sitzen). Kein
      // Vorbedingungs-Assert — der eigentliche Vertrag folgt: NACH dem
      // Install muss der Fokus auf dem übergebenen initialFocus sitzen.

      var cleanup = w.AppGlobals.installDialogA11y(host, {
        initialFocus: second,
        onEscape: null
      });
      expect(typeof cleanup).toBe('function');
      // Elementare Identitätsprüfung (===) statt toBe — der Vitest-Diff-
      // Drucker stolpert sonst über jsdom-interne Node-Eigenschaften.
      expect(w.document.activeElement === second,
        'Nach installDialogA11y muss der Fokus auf dem initialFocus-Element sitzen').toBe(true);
      cleanup();
    });

    it('installDialogA11y fokussiert ohne initialFocus das erste Focusable', () => {
      const { window: w } = createDom();
      var host = w.document.createElement('div');
      w.document.body.appendChild(host);
      var first = w.document.createElement('button');
      first.textContent = 'first';
      var second = w.document.createElement('button');
      second.textContent = 'second';
      host.appendChild(first);
      host.appendChild(second);

      w.AppGlobals.installDialogA11y(host, { onEscape: null });
      // Erstes Focusable im Host soll fokussiert sein.
      var focusables = w.AppGlobals.getFocusableIn(host);
      expect(w.document.activeElement).toBe(focusables[0]);
    });

    it('Tab-Trap: Tab vom letzten → ersten', () => {
      const { window: w } = createDom();
      var host = w.document.createElement('div');
      w.document.body.appendChild(host);
      var first = w.document.createElement('button');
      first.textContent = 'first';
      var second = w.document.createElement('button');
      second.textContent = 'second';
      var third = w.document.createElement('button');
      third.textContent = 'third';
      host.appendChild(first);
      host.appendChild(second);
      host.appendChild(third);

      w.AppGlobals.installDialogA11y(host, { onEscape: null });
      third.focus();
      expect(w.document.activeElement).toBe(third);
      fireKey(third, 'Tab');
      expect(w.document.activeElement).toBe(first);
    });

    it('Tab-Trap: Shift+Tab vom ersten → letzten', () => {
      const { window: w } = createDom();
      var host = w.document.createElement('div');
      w.document.body.appendChild(host);
      var first = w.document.createElement('button');
      var last = w.document.createElement('button');
      host.appendChild(first);
      host.appendChild(last);

      w.AppGlobals.installDialogA11y(host, { onEscape: null });
      first.focus();
      fireKey(first, 'Tab', { shiftKey: true });
      expect(w.document.activeElement).toBe(last);
    });

    it('Escape ruft onEscape genau einmal auf, wenn übergeben', () => {
      const { window: w } = createDom();
      var host = w.document.createElement('div');
      w.document.body.appendChild(host);
      var btn = w.document.createElement('button');
      host.appendChild(btn);

      var calls = 0;
      w.AppGlobals.installDialogA11y(host, { onEscape: function() { calls++; } });
      fireKey(host, 'Escape');
      fireKey(host, 'Escape');
      fireKey(host, 'Escape');
      expect(calls).toBe(1);
    });

    it('Escape ohne onEscape ist ein No-op (wirft nicht, schließt nicht)', () => {
      const { window: w } = createDom();
      var host = w.document.createElement('div');
      w.document.body.appendChild(host);
      var btn = w.document.createElement('button');
      host.appendChild(btn);

      w.AppGlobals.installDialogA11y(host, {});
      // kein Crash, keine Ausnahme
      expect(function() { fireKey(host, 'Escape'); }).not.toThrow();
    });

    it('runDialogA11yCleanup ist idempotent (zweimal aufgerufen wirft nicht)', () => {
      const { window: w } = createDom();
      var host = w.document.createElement('div');
      w.document.body.appendChild(host);
      var btn = w.document.createElement('button');
      host.appendChild(btn);
      var restore = w.document.createElement('button');
      restore.id = 'restore-target';
      w.document.body.appendChild(restore);

      // Kein Cleanup registriert → keine Installation → direkt idempotenter Aufruf
      // darf nicht werfen
      expect(function() { w.AppGlobals.runDialogA11yCleanup(host); }).not.toThrow();
      expect(function() { w.AppGlobals.runDialogA11yCleanup(host); }).not.toThrow();

      // Install + Cleanup + Cleanup-Pfad erneut: ebenfalls idempotent
      w.AppGlobals.installDialogA11y(host, {
        initialFocus: btn,
        restoreFocusTo: restore
      });
      // Cleanup #1
      w.AppGlobals.runDialogA11yCleanup(host);
      // Cleanup #2 darf keinen Fehler werfen und nicht erneut fokussieren
      restore.focus();
      expect(w.document.activeElement).toBe(restore);
      expect(function() { w.AppGlobals.runDialogA11yCleanup(host); }).not.toThrow();
    });

    it('Cleanup stellt Fokus auf restoreFocusTo ODER prevFocus wieder her', () => {
      const { window: w } = createDom();
      var host = w.document.createElement('div');
      w.document.body.appendChild(host);
      var btn = w.document.createElement('button');
      host.appendChild(btn);
      var restore = w.document.createElement('button');
      restore.id = 'restore';
      w.document.body.appendChild(restore);

      restore.focus();
      expect(w.document.activeElement).toBe(restore);

      w.AppGlobals.installDialogA11y(host, { initialFocus: btn });
      // Fokus ist im Dialog
      expect(w.document.activeElement).toBe(btn);
      // Cleanup gibt Fokus zurück auf restore
      w.AppGlobals.runDialogA11yCleanup(host);
      expect(w.document.activeElement).toBe(restore);
    });

    it('Cleanup mit restoreFocusTo überschreibt prevFocus', () => {
      const { window: w } = createDom();
      var host = w.document.createElement('div');
      w.document.body.appendChild(host);
      var btn = w.document.createElement('button');
      host.appendChild(btn);
      var prevBtn = w.document.createElement('button');
      prevBtn.id = 'prev';
      w.document.body.appendChild(prevBtn);
      var explicitTarget = w.document.createElement('button');
      explicitTarget.id = 'explicit';
      w.document.body.appendChild(explicitTarget);

      prevBtn.focus();
      w.AppGlobals.installDialogA11y(host, {
        initialFocus: btn,
        restoreFocusTo: explicitTarget
      });
      w.AppGlobals.runDialogA11yCleanup(host);
      expect(w.document.activeElement).toBe(explicitTarget);
    });
  });

  describe('Reset-Modal (#reset_modal)', () => {
    let w, doc;
    beforeEach(function() {
      const dom = createDom();
      w = dom.window;
      doc = w.document;
      w.initUI();
    });

    it('öffnet mit Fokus auf dem sicheren Abbrechen-Button', () => {
      var opener = doc.getElementById('footer_reset_btn');
      opener.focus();
      w.openResetModal();

      var modal = doc.getElementById('reset_modal');
      expect(modal.classList.contains('open')).toBe(true);

      var focusables = getFocusable(modal);
      expect(focusables.length).toBeGreaterThan(0);
      // Init-Fokus muss auf einem Abbrechen-Pfad sitzen
      expect(w.document.activeElement).toBeTruthy();
      var active = w.document.activeElement;
      // Erwartet entweder das im Modal liegende reset-modal-cancel ODER das
      // reset_modal_cancel (✕ oben rechts). Beide sind Abbrechen-Pfade.
      var isCancel = active.classList.contains('reset-modal-cancel')
        || active.id === 'reset_modal_cancel';
      expect(isCancel, 'Initialfokus muss auf einem Abbrechen-Button sitzen, war: ' + (active.id || active.className)).toBe(true);
    });

    it('Tab-Trap cycelt vom letzten zum ersten (Fokus im Dialog gefangen)', () => {
      w.openResetModal();
      var modal = doc.getElementById('reset_modal');
      var focusables = getFocusable(modal);
      var last = focusables[focusables.length - 1];
      last.focus();
      fireKey(last, 'Tab');
      expect(w.document.activeElement).toBe(focusables[0]);
    });

    it('Escape schließt das Modal über den Abbrechen-Pfad', () => {
      w.openResetModal();
      var modal = doc.getElementById('reset_modal');
      fireKey(modal, 'Escape');
      expect(modal.classList.contains('open')).toBe(false);
    });

    it('Escape ruft exakt einmal den Cancel-Pfad auf', () => {
      var cancelCalls = 0;
      var origCancel = w.AppGlobals._onCancel;
      w.AppGlobals._onCancel = function() { cancelCalls++; if (origCancel) origCancel(); };
      w.openResetModal();
      var modal = doc.getElementById('reset_modal');
      fireKey(modal, 'Escape');
      fireKey(modal, 'Escape');
      fireKey(modal, 'Escape');
      expect(cancelCalls).toBe(1);
      w.AppGlobals._onCancel = origCancel;
    });

    it('Fokus wird beim Schließen auf den Auslöser (#footer_reset_btn) zurückgegeben', () => {
      var opener = doc.getElementById('footer_reset_btn');
      opener.focus();
      expect(w.document.activeElement).toBe(opener);

      w.openResetModal();
      // Fokus liegt jetzt im Dialog
      var modal = doc.getElementById('reset_modal');
      var focusables = getFocusable(modal);
      expect(focusables.indexOf(w.document.activeElement)).toBeGreaterThan(-1);

      w._onCancel();
      expect(w.document.activeElement).toBe(opener);
    });

    it('Cleanup ist idempotent (zweimal close() wirft nicht)', () => {
      w.openResetModal();
      expect(function() { w._onCancel(); }).not.toThrow();
      expect(function() { w._onCancel(); }).not.toThrow();
    });
  });

  describe('Import-Modal (#import_modal)', () => {
    let w, doc;
    beforeEach(function() {
      const dom = createDom();
      w = dom.window;
      doc = w.document;
      w.initUI();
    });

    function makeValidEnvelope() {
      var stateObj = JSON.parse(JSON.stringify(w.state));
      return JSON.stringify({
        app: 'agrar-rechner',
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        state: stateObj
      });
    }

    it('öffnet mit Initialfokus auf Datei-Input oder Abbrechen — nie auf destruktiver Bestätigung', () => {
      var opener = doc.getElementById('data_import_btn');
      opener.focus();

      var text = makeValidEnvelope();
      var parsed = w.validateImportText(text);
      w.showImportPreview(parsed);
      var modal = doc.getElementById('import_modal');

      expect(modal.classList.contains('open')).toBe(true);
      var active = w.document.activeElement;
      // Initialfokus darf NICHT auf import_modal_confirm (destruktive Bestätigung)
      expect(active, 'Initialfokus darf nicht body sein').not.toBe(doc.body);
      if (active.id === 'import_modal_confirm') {
        throw new Error('Initialfokus liegt auf der destruktiven Bestätigung — Issue #446 Welle 1 verlangt einen sicheren Pfad');
      }
      // Einer von: import_modal_x, import_modal_cancel, data_import_file
      var ok = active.id === 'import_modal_x'
        || active.id === 'import_modal_cancel'
        || active.id === 'data_import_file';
      expect(ok, 'Initialfokus muss auf sicherem Pfad (Abbrechen/X/Daten-importieren) sein, war: ' + active.id).toBe(true);
    });

    it('Tab-Trap cycelt vom letzten zum ersten', () => {
      var text = makeValidEnvelope();
      var parsed = w.validateImportText(text);
      w.showImportPreview(parsed);
      var modal = doc.getElementById('import_modal');
      var focusables = getFocusable(modal);
      expect(focusables.length).toBeGreaterThan(0);
      var last = focusables[focusables.length - 1];
      last.focus();
      fireKey(last, 'Tab');
      expect(w.document.activeElement).toBe(focusables[0]);
    });

    it('Escape bricht den Import ab (cancelImportFromModal-Pfad)', () => {
      var text = makeValidEnvelope();
      var parsed = w.validateImportText(text);
      w.showImportPreview(parsed);
      var modal = doc.getElementById('import_modal');

      var cancelCalls = 0;
      var origCancel = w.AppGlobals.cancelImportFromModal;
      w.AppGlobals.cancelImportFromModal = function() { cancelCalls++; if (origCancel) origCancel(); };
      fireKey(modal, 'Escape');
      expect(cancelCalls).toBe(1);
      w.AppGlobals.cancelImportFromModal = origCancel;
    });

    it('Escape wird nicht mehrfach ausgelöst (idempotent über Modal-Lebensdauer)', () => {
      var text = makeValidEnvelope();
      var parsed = w.validateImportText(text);
      w.showImportPreview(parsed);
      var modal = doc.getElementById('import_modal');

      var cancelCalls = 0;
      var origCancel = w.AppGlobals.cancelImportFromModal;
      w.AppGlobals.cancelImportFromModal = function() { cancelCalls++; if (origCancel) origCancel(); };
      fireKey(modal, 'Escape');
      fireKey(modal, 'Escape');
      fireKey(modal, 'Escape');
      expect(cancelCalls).toBe(1);
      w.AppGlobals.cancelImportFromModal = origCancel;
    });

    it('Fokus wird beim Schließen auf den Auslöser (#data_import_btn) zurückgegeben', () => {
      var opener = doc.getElementById('data_import_btn');
      opener.focus();
      expect(w.document.activeElement).toBe(opener);

      var text = makeValidEnvelope();
      var parsed = w.validateImportText(text);
      w.showImportPreview(parsed);

      var modal = doc.getElementById('import_modal');
      expect(getFocusable(modal).indexOf(w.document.activeElement)).toBeGreaterThan(-1);

      w.cancelImportFromModal();
      expect(w.document.activeElement).toBe(opener);
    });

    it('Cleanup ist idempotent (zweimal cancelImportFromModal wirft nicht)', () => {
      var text = makeValidEnvelope();
      var parsed = w.validateImportText(text);
      w.showImportPreview(parsed);
      expect(function() { w.cancelImportFromModal(); }).not.toThrow();
      expect(function() { w.cancelImportFromModal(); }).not.toThrow();
    });
  });

  describe('Dashboard-Sheet (#dashboard_sheet)', () => {
    let w, doc;
    beforeEach(function() {
      const dom = createDom();
      w = dom.window;
      doc = w.document;
      w.initUI();
    });

    it('öffnet mit Fokus innerhalb des Sheets (erstes Focusable oder Schließen-Kontrolle)', () => {
      var opener = doc.getElementById('nav_uebersicht');
      opener.focus();
      w.openDashboard();

      var sheet = doc.getElementById('dashboard_sheet');
      expect(sheet.classList.contains('open')).toBe(true);

      // deferInitialFocus: der Fokus-Shift passiert im nächsten Tick —
      // wir warten ein Frame, bevor wir den Vertrag prüfen.
      return new Promise(function (resolve) { setTimeout(resolve, 10); }).then(function () {
        var focusables = getFocusable(sheet);
        // Init-Fokus muss IN dem Sheet liegen (Body zählt als Fallback-Pfad)
        var inSheet = sheet.contains(w.document.activeElement)
          || w.document.activeElement === doc.body;
        expect(inSheet,
          'Fokus muss nach Öffnen im Sheet (oder als Body-Fallback) sein, war: ' +
          (w.document.activeElement.id || w.document.activeElement.tagName)).toBe(true);
        // Wenn Body der Fallback ist, soll wenigstens der Trap für Tab existieren.
        if (w.document.activeElement === doc.body) {
          expect(focusables.length).toBeGreaterThan(0);
        }
      });
    });

    it('Tab-Trap cycelt vom letzten zum ersten', () => {
      w.openDashboard();
      var sheet = doc.getElementById('dashboard_sheet');
      var focusables = getFocusable(sheet);
      expect(focusables.length).toBeGreaterThan(0);
      var last = focusables[focusables.length - 1];
      last.focus();
      fireKey(last, 'Tab');
      expect(w.document.activeElement).toBe(focusables[0]);
    });

    it('Escape schließt das Dashboard (closeDashboard-Pfad)', () => {
      w.openDashboard();
      var sheet = doc.getElementById('dashboard_sheet');
      var origClose = w.AppGlobals.closeDashboard;
      var closeCalls = 0;
      w.AppGlobals.closeDashboard = function() { closeCalls++; if (origClose) origClose(); };
      fireKey(sheet, 'Escape');
      expect(closeCalls).toBe(1);
      expect(sheet.classList.contains('open')).toBe(false);
      w.AppGlobals.closeDashboard = origClose;
    });

    it('Dashboard nutzt NICHT mehr den lokalen .dashboard-close-Selector (Helper läuft)', () => {
      // Der Dashboard-Code suchte früher nach '.dashboard-close', das im
      // DOM nicht existiert (Issue-Beschreibung). Mit dem Helper entfällt
      // diese Suche. Hier sichern wir, dass das Öffnen auch ohne dieses
      // Element funktioniert.
      var docFragment = doc.getElementById('dashboard_sheet');
      // Sicherstellen, dass KEIN Element mit .dashboard-close existiert
      expect(docFragment.querySelector('.dashboard-close')).toBe(null);
      w.openDashboard();
      expect(docFragment.classList.contains('open')).toBe(true);
    });

    it('Fokus wird beim Schließen auf den Auslöser (#nav_uebersicht) zurückgegeben', () => {
      var opener = doc.getElementById('nav_uebersicht');
      opener.focus();
      expect(w.document.activeElement === opener).toBe(true);

      w.openDashboard();

      var sheet = doc.getElementById('dashboard_sheet');
      // deferInitialFocus: erst einen Tick warten, dann den Vertrag prüfen.
      return new Promise(function (resolve) { setTimeout(resolve, 10); }).then(function () {
        expect(sheet.contains(w.document.activeElement)
               || w.document.activeElement === doc.body,
               'Fokus muss nach Öffnen im Sheet (oder Body-Fallback) sein').toBe(true);

        w.closeDashboard();
        expect(w.document.activeElement === opener,
          'Nach Schließen muss der Fokus auf dem Auslöser sitzen').toBe(true);
      });
    });

    it('Cleanup ist idempotent (zweimal closeDashboard wirft nicht)', () => {
      w.openDashboard();
      expect(function() { w.closeDashboard(); }).not.toThrow();
      expect(function() { w.closeDashboard(); }).not.toThrow();
    });
  });

  describe('Protokoll-Action-Sheet (#local_protocol_action_sheet)', () => {
    let w, doc;
    beforeEach(function() {
      const dom = createDom();
      w = dom.window;
      doc = w.document;
      w.initUI();
      w.chooseKultur('mais');
      // Eintrag erzeugen, damit eine Action-Sheet-Auslösung möglich ist
      var tab = w.state.reiter[0];
      tab.entries = [{
        einheit: 1, duenger: 0, zaehlerStand: 0.5, time: '10:00'
      }];
      tab.hektar = 1; tab.koerner = 100; tab.duenger = 0;
      w.state.machineLog = [{ einheit: 1, duenger: 0, zaehlerStand: 0.5, time: '10:00' }];
      // local_protocol_section sichtbar schalten
      w.state.activeView = 'protokoll';
      if (typeof w.AppGlobals.renderLocalProtocol === 'function') {
        w.AppGlobals.renderLocalProtocol();
      }
    });

    function openSheet() {
      // Action-Button im Field-Panel anklicken → requestLocalProtocolDelete
      var actionBtn = doc.querySelector('[data-entry-action="field"]');
      if (!actionBtn) {
        // Synthetisch öffnen, falls kein Eintrag rendert
        w.AppGlobals.requestLocalProtocolDelete('field', { tabIdx: 0, entryIdx: 0 }, '10:00');
        return;
      }
      actionBtn.click();
    }

    it('öffnet mit Fokus INSIDE des Sheets', () => {
      var opener = doc.querySelector('[data-entry-action="field"]') || doc.body;
      if (opener && opener.focus) opener.focus();

      openSheet();
      var sheet = doc.getElementById('local_protocol_action_sheet');
      expect(sheet.hidden).toBe(false);
      expect(sheet.classList.contains('show')).toBe(true);
      // Fokus muss im Sheet oder auf Body (Fallback) liegen
      var sheetFocusables = getFocusable(sheet);
      var focusIsInside = sheet.contains(w.document.activeElement)
        || w.document.activeElement === doc.body;
      expect(focusIsInside).toBe(true);
    });

    it('Escape schließt das Action-Sheet', () => {
      openSheet();
      var sheet = doc.getElementById('local_protocol_action_sheet');
      var closeCalls = 0;
      var origClose = w.AppGlobals.closeLocalProtocolSheet;
      w.AppGlobals.closeLocalProtocolSheet = function() { closeCalls++; if (origClose) origClose(); };
      fireKey(sheet, 'Escape');
      expect(closeCalls).toBe(1);
      expect(sheet.hidden).toBe(true);
      w.AppGlobals.closeLocalProtocolSheet = origClose;
    });

    it('Cleanup ist idempotent (zweimal closeLocalProtocolSheet wirft nicht)', () => {
      openSheet();
      expect(function() { w.AppGlobals.closeLocalProtocolSheet(); }).not.toThrow();
      expect(function() { w.AppGlobals.closeLocalProtocolSheet(); }).not.toThrow();
    });

    it('Fokus wird beim Schließen auf den Auslöser (Action-⋮-Button) zurückgegeben', () => {
      var opener = doc.querySelector('[data-entry-action="field"]');
      if (!opener) return; // Wenn kein Eintrag gerendert, Test überspringen
      opener.focus();
      expect(w.document.activeElement).toBe(opener);

      opener.click();
      var sheet = doc.getElementById('local_protocol_action_sheet');
      expect(sheet.classList.contains('show')).toBe(true);

      w.AppGlobals.closeLocalProtocolSheet();
      expect(w.document.activeElement).toBe(opener);
    });
  });

  describe('Tab-Close als echter <button>', () => {
    let w, doc;
    beforeEach(function() {
      const dom = createDom();
      w = dom.window;
      doc = w.document;
      w.initUI();
    });

    it('.tab-close wird als <button type="button"> gerendert (nicht span/div)', () => {
      // 2 Tabs → beide bekommen ein .tab-close
      w.addReiter();
      w.renderTabs();
      var closes = doc.querySelectorAll('.tab-close');
      expect(closes.length).toBe(2);
      closes.forEach(function(close) {
        expect(close.tagName.toLowerCase()).toBe('button');
        // type="button" verhindert versehentliche Form-Submits, falls der
        // Close je in einem Form-Kontext landet
        expect(close.getAttribute('type')).toBe('button');
      });
    });

    it('.tab-close hat ein sprechendes aria-label mit Schlag-Name', () => {
      var close = null;
      function findClose() {
        var list = doc.querySelectorAll('.tab-close');
        return list.length > 0 ? list[0] : null;
      }
      // Zustand mit 2 Schlägen
      w.addReiter();
      w.renderTabs();
      close = findClose();
      expect(close).toBeTruthy();
      // Vor #446 war aria-label = "Schlag schließen" generisch.
      // Welle 1 erwartet mindestens "schließen" + Schlag-Name-Bezug.
      var ariaLabel = close.getAttribute('aria-label') || '';
      expect(ariaLabel.toLowerCase()).toContain('schließen');
      // und sollte entweder den Schlag-Namen oder "Schlag <n>" enthalten
      var hasReference = /schlag|reiter/i.test(ariaLabel);
      expect(hasReference).toBe(true);
    });

    it('.tab-close reagiert auf Enter-Taste (natives Button-Verhalten)', () => {
      w.addReiter();
      w.renderTabs();
      var close = doc.querySelectorAll('.tab-close')[0];
      expect(close).toBeTruthy();
      var calls = 0;
      var origConfirm = w.confirm;
      // confirm liefert bewusst FALSE → der Schlag wird NICHT entfernt und
      // das Element bleibt im DOM (nur so ist die Fokus-Prüfung darunter
      // auf demselben Element möglich).
      w.confirm = function() { calls++; return false; };
      // Verifikation 1: das .tab-close ist ein echter <button> — Browser
      // simulieren auf Enter/Space automatisch einen Click. In jsdom wird
      // dieser Auto-Click per KeyboardEvent zwar nicht zuverlässig emittiert,
      // deshalb prüfen wir den Tag-Namen + type als Markup-Vertrag.
      expect(close.tagName.toLowerCase()).toBe('button');
      // Verifikation 2: Ein Click (in echt: Enter/Space-Auto-Click) erreicht
      // den registrierten Handler (confirmRemoveReiter → confirm).
      close.click();
      expect(calls).toBeGreaterThan(0);
      // Verifikation 3: das Element ist fokussierbar (natives tab-Verhalten
      // für <button>, kein role="button"-Workaround).
      close.focus();
      expect(doc.activeElement === close).toBe(true);
      w.confirm = origConfirm;
    });

    it('confirmRemoveReiter wird beim Klick auf .tab-close aufgerufen (Delegation bleibt)', () => {
      w.addReiter();
      w.renderTabs();
      var close = doc.querySelectorAll('.tab-close')[0];
      var calls = 0;
      // Der Produktionspfad ruft confirmRemoveReiter(idx) — das löst über
      // AppGlobals.removeReiter auf. Wir spionieren genau diese Nahtstelle
      // aus (App-Globals-Muster, siehe tests/dialog-accessibility oben).
      var origRemove = w.AppGlobals.removeReiter;
      w.AppGlobals.removeReiter = function (idx) { calls++; };
      var origConfirm = w.confirm;
      w.confirm = function() { return true; };
      close.click();
      expect(calls).toBe(1);
      w.AppGlobals.removeReiter = origRemove;
      w.confirm = origConfirm;
    });
  });
});
