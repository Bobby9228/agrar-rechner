// ============================================================================
// RESET-MODAL — Confirmation modal for reset actions (Issue #236)
//
// Ersetzt die beiden nativen `confirm()`-Dialoge durch ein eigenes Modal mit:
//   1. "Aktuellen Tab zurücksetzen" (normaler Style)
//   2. "Alle Daten löschen" (rot, Warning-Styling, doppelte Bestätigung)
//   3. "Abbrechen"
//
// Anforderungen:
//   - Kein window.confirm() mehr
//   - Tastatur: ESC schließt, Tab/Shift+Tab Focus-Trap, Enter löst primäre Aktion aus
//   - Screenreader: role="dialog", aria-modal, aria-labelledby
//   - Mobile-first: bottom sheet auf kleinen Screens, kompakt im Footer
//   - Erhält resetActiveTab() und resetAll() (definiert in ui-handlers.js)
// ============================================================================

    // Verweis auf den Trigger-Button, damit wir nach Schließen den Fokus
    // dahinter zurückgeben können (A11y-Pflicht beim Schließen von Dialogen).
    var _modalLastTrigger = null;

    // Markiert, ob die "Alle Daten löschen"-Aktion bereits bestätigt wurde
    // (Zwei-Stufen-Bestätigung gegen versehentliches Klicken).
    var _fullResetArmed = false;

    function _getModal() { return document.getElementById('reset_modal'); }
    function _getOverlay() { return document.getElementById('reset_overlay'); }

    function _focusableInModal() {
      var m = _getModal();
      if (!m) return [];
      // Standard-Focusable + Buttons
      var selector = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
      return Array.prototype.slice.call(m.querySelectorAll(selector));
    }

    function _trapFocus(e) {
      if (e.key !== 'Tab') return;
      var focusables = _focusableInModal().filter(function(el) {
        return el.offsetParent !== null; // sichtbar
      });
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      var active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !_getModal().contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    function _onKeydown(e) {
      if (e.key === 'Escape' || e.keyCode === 27) {
        e.preventDefault();
        closeResetModal();
        return;
      }
      _trapFocus(e);
    }

    function _disarmFullReset() {
      _fullResetArmed = false;
      var btn = document.getElementById('reset_modal_confirm_all');
      if (!btn) return;
      btn.classList.remove('armed');
      btn.textContent = 'Alle Daten löschen';
    }

    function _onResetTab() {
      closeResetModal();
      if (typeof resetActiveTab === 'function') resetActiveTab();
    }

    function _onResetAll() {
      if (!_fullResetArmed) {
        // Erste Stufe: bestätigen verlangen (sichtbare Warnung).
        _fullResetArmed = true;
        var btn = document.getElementById('reset_modal_confirm_all');
        if (btn) {
          btn.classList.add('armed');
          btn.textContent = 'Tippen zum Bestätigen: Alle Daten löschen';
          btn.focus();
        }
        return;
      }
      // Zweite Stufe: ausführen.
      closeResetModal();
      if (typeof resetAll === 'function') resetAll();
    }

    function _onOverlayClick(e) {
      // Overlay-Klick = Abbrechen (sofort schließen, ohne Aktion)
      if (e.target === _getOverlay()) closeResetModal();
    }

    function _onCancel() {
      closeResetModal();
    }

    function openResetModal(triggerEl) {
      var modal = _getModal();
      var overlay = _getOverlay();
      if (!modal || !overlay) return;

      _modalLastTrigger = triggerEl || document.getElementById('reset_btn') || null;
      _disarmFullReset();

      overlay.classList.add('open');
      modal.classList.add('open');

      // Fokus auf den ungefährlichsten Action-Button (Abbrechen),
      // damit versehentliches Enter nicht Daten löscht.
      var cancel = document.getElementById('reset_modal_cancel');
      if (cancel) cancel.focus();

      document.addEventListener('keydown', _onKeydown);
    }

    function closeResetModal() {
      var modal = _getModal();
      var overlay = _getOverlay();
      if (modal) modal.classList.remove('open');
      if (overlay) overlay.classList.remove('open');
      _disarmFullReset();
      document.removeEventListener('keydown', _onKeydown);
      // Fokus zurück zum Trigger (A11y)
      if (_modalLastTrigger && typeof _modalLastTrigger.focus === 'function') {
        _modalLastTrigger.focus();
      }
      _modalLastTrigger = null;
    }
