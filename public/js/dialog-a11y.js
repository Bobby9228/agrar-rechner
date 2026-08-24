// ============================================================================
// DIALOG-A11Y — Vereinheitlichter Dialog-Vertrag (Issue #446 Welle 1)
//
// Extrahiert aus culture-handlers.js (_installKulturModalA11y,
// _runKulturModalA11yCleanup, _getFocusableIn), verallgemeinert für alle
// Dialoge der App. Kultur-spezifische Vorverarbeitung (state→DOM-Sync,
// siehe _installKulturModalA11y in culture-handlers.js) bleibt dort — der
// Helper ist bewusst dependency-frei.
//
// API:
//   - getFocusableIn(root)
//       Liefert eine gefilterte Liste der im root fokussierbaren Elemente.
//       Wird sowohl intern als auch für Konsumenten exportiert (AppGlobals
//       + window), damit Tests eigene Sample-Dialoge gegen die gleiche
//       Selektion prüfen können.
//   - installDialogA11y(dialogEl, options)
//       options: { initialFocus?, onEscape?, restoreFocusTo? }
//       Returnt eine Cleanup-Funktion. Bei Install:
//         • merkt sich document.activeElement als prevFocus,
//         • fokussiert options.initialFocus ODER das erste Focusable,
//         • richtet einen keydown-Listener am Dialog ein, der
//             – Tab/Shift+Tab innerhalb des Dialogs fängt,
//             – Escape an options.onEscape delegiert (wenn Funktion übergeben,
//               exakt einmal pro Install, danach ist die A11y-Lifecycle weg).
//   - runDialogA11yCleanup(dialogEl)
//       Idempotent. Ruft die beim letzten installDialogA11y-Aufruf
//       hinterlegte Cleanup-Funktion genau einmal auf und entfernt das
//       Listener-Feld vom dialogEl. Doppel-Aufruf ist ein No-op.
//
// KEIN Blur-Sync zwischen DOM und state — das war kultur-spezifisch
// (Verschachtelung des Fokus in den Wechsel-Dialog löst blur auf dem
// aktiven Reiter-Input aus). Bei anderen Dialogen ist das kein Problem,
// weil sie keinen Reiter-Input editieren.
//
// Lade-Reihenfolge (siehe index.html / tests/helpers.js):
//   Muss VOR allen Konsumenten geladen sein
//   (culture-handlers, data-io-handlers, reset-handlers,
//    render-dashboard, protocol-handlers via render-local-protocol,
//    render-tabs).
// ============================================================================

function getFocusableIn(root) {
  if (!root) return [];
  var sel = 'button:not([disabled]):not([hidden]), [href], input:not([disabled]):not([hidden]), select:not([disabled]):not([hidden]), textarea:not([disabled]):not([hidden]), [tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll(sel)).filter(function(el) {
    if (el.disabled) return false;
    if (el.hidden) return false;
    if (el.style && el.style.display === 'none') return false;
    return true;
  });
}

function runDialogA11yCleanup(dialogEl) {
  if (!dialogEl || typeof dialogEl._dialogA11yCleanup !== 'function') return;
  var fn = dialogEl._dialogA11yCleanup;
  // Vor dem Aufruf entfernen, damit ein Cleanup, das seinerseits wieder
  // Cleanup triggert (z. B. via Konsumenten-Pfad), idempotent bleibt.
  dialogEl._dialogA11yCleanup = null;
  try { fn(); } catch (e) {}
}

function installDialogA11y(dialogEl, options) {
  if (!dialogEl) return function noop() {};
  options = options || {};
  var prevFocus = document.activeElement;
  var focusables = getFocusableIn(dialogEl);
  var firstFocusable = focusables[0];
  var lastFocusable = focusables[focusables.length - 1];

  // Falls schon ein aktiver Install vorliegt: vorherigen Cleanup laufen lassen,
  // sonst verdoppeln sich Listener und die Restore-Logik schießt mehrfach los.
  runDialogA11yCleanup(dialogEl);

  function handler(evt) {
    if (!evt) return;
    if (evt.key === 'Escape') {
      if (typeof options.onEscape === 'function') {
        if (evt.preventDefault) evt.preventDefault();
        if (evt.stopPropagation) evt.stopPropagation();
        // onEscape feuert GENAU EINMAL pro Install (dokumentierter Vertrag):
        // Der erste Escape entzieht die Referenz, weitere Escape-Events
        // während derselben Dialog-Öffnung sind No-ops. Nach Schließen +
        // Neuöffnen installiert der Konsumenten-Pfad frisch — dort greift
        // onEscape wieder. Schützt vor Doppel-Close/Doppel-Confirm durch
        // gedrückte Taste oder Event-Replays.
        var escapeFn = options.onEscape;
        options.onEscape = null;
        escapeFn();
      }
      return;
    }
    if (evt.key !== 'Tab') return;
    if (focusables.length === 0) {
      if (evt.preventDefault) evt.preventDefault();
      return;
    }
    var active = document.activeElement;
    var inDialog = dialogEl.contains(active);
    if (evt.shiftKey) {
      if (!inDialog || active === firstFocusable) {
        if (evt.preventDefault) evt.preventDefault();
        try { lastFocusable.focus(); } catch (e) {}
      }
    } else {
      if (!inDialog || active === lastFocusable) {
        if (evt.preventDefault) evt.preventDefault();
        try { firstFocusable.focus(); } catch (e) {}
      }
    }
  }
  dialogEl.addEventListener('keydown', handler);

  // Restore-Target: explizit übergebenes restoreFocusTo schlägt den
  // gemerkten prevFocus. Das passt zum Vertrag der Kultur-Dialoge (dort
  // war die Logik in _installKulturModalA11y mit options.restoreFocus als
  // Schalter; hier ist restoreFocusTo der positive Pfad).
  var restoreTarget = options.restoreFocusTo || prevFocus;

  dialogEl._dialogA11yCleanup = function() {
    dialogEl.removeEventListener('keydown', handler);
    if (restoreTarget && typeof restoreTarget.focus === 'function') {
      try { restoreTarget.focus(); } catch (e) {}
    }
  };

  var initial = options.initialFocus || firstFocusable;
  if (options.deferInitialFocus) {
    // Asynchroner Fokus-Shift (Opt-in, z.B. Dashboard): Der Blur des zuvor
    // fokussierten Elements feuert zuerst und kann dort legitime Handler
    // auslösen; erst danach wandert der Fokus in den Dialog.
    setTimeout(function () {
      try { initial.focus(); } catch (e) {}
    }, 0);
  } else if (initial && typeof initial.focus === 'function') {
    try { initial.focus(); } catch (e) {}
  }

  return dialogEl._dialogA11yCleanup;
}

// Register exposed globals on AppGlobals (ADR-001 Schritt 3, Issue #278).
Object.assign(window.AppGlobals, {
  getFocusableIn: getFocusableIn,
  installDialogA11y: installDialogA11y,
  runDialogA11yCleanup: runDialogA11yCleanup,
});
