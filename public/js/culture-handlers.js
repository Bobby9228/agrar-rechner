// ============================================================================
// CULTURE-HANDLERS — Kultur-Auswahl + Kultur-Modal Accessibility
//
// Aus ui-handlers.js (Issue #416 Welle 1) in ein eigenes Modul extrahiert.
// Enthält:
//   - Kultur-Auswahl (Erststart + Wechsel): chooseKultur, renderKulturBadge,
//     openKulturFirstRun, closeKulturFirstRun, requestChangeKultur,
//     confirmChangeKultur, cancelChangeKultur, _onKulturChangeSelectChange
//   - Helpers: isUntouchedInitialField, _kulturState, _getFocusableIn,
//     _runKulturModalA11yCleanup, _installKulturModalA11y
//
// Lade-Reihenfolge (siehe index.html):
//   state.js → culture.js → calculations.js → culture-handlers.js
//     → ui-handlers.js
//
// Braucht zur Laufzeit (AppGlobals):
//   - state, saveState, appEmit, isValidCultureKey, getDefaultKoernerProEinheit
//     (state.js / culture.js)
//   - syncEinheitGroesseEditorFromTab (settings-handlers.js) und
//     getActiveReiter (input-handlers.js), erst zur Laufzeit aufgelöst
// ============================================================================

// Pending-Auswahl im Wechsel-Modal. Wird über AppGlobals._pendingKulturChoice
// (Live-Property) für Tests und Cross-Tab-Sync erreichbar gemacht.
var _kulturState = { pendingKulturChoice: null };

// --- Kultur-Modal Accessibility (Fokus-Trap, gespeicherter Fokus, Escape) ---
//
// Ab Issue #446 Welle 1 delegiert _installKulturModalA11y an den
// generischen Dialog-Helper (dialog-a11y.js). Der kultur-spezifische
// Blur-Schutz (state→DOM-Sync vor dem Fokus-Shift, damit der blur nicht
// state auf den DOM-Wert zurücksetzt) bleibt HIER — das ist kein
// generischer Dialog-Vertrag, sondern eine Eigenschaft des Wechsel-Dialogs
// (er wird über dem aktiven Reiter-Input geöffnet).
//
// Cleanup liegt unter modal._kulturA11yCleanup (kompatibel zum alten
// Alias, identisch zum neuen _dialogA11yCleanup-Feld des Helpers).
function _runKulturModalA11yCleanup(modal) {
  if (!modal) return;
  if (typeof AppGlobals.runDialogA11yCleanup === 'function') {
    AppGlobals.runDialogA11yCleanup(modal);
  }
}

function _installKulturModalA11y(modal, options) {
  if (!modal) return;
  options = options || {};
  // Vor dem Fokus-Shift: state → DOM-Inputs des aktiven Reiters
  // synchronisieren. Das Verschachteln des Fokus in den Dialog löst
  // sonst den blur-Handler des aktiven Input-Felds aus (onInputHektar /
  // onInputKoerner / …), der state aus DOM-Inputs liest. Wenn state
  // durch einen externen Aufruf (z.B. Test, Cross-Tab-Sync) weiter ist
  // als das DOM, würde der blur state auf den DOM-Wert (oft 0) zurück-
  // setzen. Indem wir die Inputs VOR dem Focus-Shift aus state befüllen,
  // liest der blur die gleichen Werte und lässt state unverändert.
  //
  // In realer Nutzung ist der blur bereits VOR requestChangeKultur
  // gefeuert (beim Klick auf "ändern" → mousedown → focus → blur), state
  // und DOM sind dann konsistent. Das Schreiben ist in diesem Fall ein
  // No-op. Verlierer ist kein UX-Pfad, weil der blur bereits synchroni-
  // siert hat.
  try {
    if (AppGlobals.state && Array.isArray(AppGlobals.state.reiter) &&
        typeof AppGlobals.state.activeReiter === 'number') {
      var atab = AppGlobals.state.reiter[AppGlobals.state.activeReiter];
      if (atab) {
        var hEl = document.getElementById('hektar');
        var ihEl = document.getElementById('ist_hektar');
        var kEl = document.getElementById('koerner');
        var dEl = document.getElementById('duenger');
        if (hEl) {
          hEl.value = atab.hektar > 0 ? String(atab.hektar).replace('.', ',') : '';
          hEl.dataset.prev = hEl.value;
          hEl.dataset.cleaned = hEl.value;
        }
        if (ihEl) {
          ihEl.value = atab.istHektar > 0 ? String(atab.istHektar).replace('.', ',') : '';
          ihEl.dataset.prev = ihEl.value;
          ihEl.dataset.cleaned = ihEl.value;
        }
        if (kEl) {
          kEl.value = atab.koerner > 0 ? String(atab.koerner) : '';
          kEl.dataset.prev = kEl.value;
          kEl.dataset.cleaned = kEl.value;
        }
        if (dEl) {
          dEl.value = atab.duenger > 0 ? String(atab.duenger).replace('.', ',') : '';
          dEl.dataset.prev = dEl.value;
          dEl.dataset.cleaned = dEl.value;
        }
        // Migration 8→9 (Notizen pro Schlag): auch das Notiz-Textarea
        // muss vor dem Fokus-Shift aus state befüllt werden, sonst
        // überschreibt ein späterer blur die Notiz mit dem aktuellen
        // DOM-Wert (= '' für einen noch nicht initialisierten Tab).
        var nEl = document.getElementById('notizen');
        if (nEl) {
          nEl.value = typeof atab.notizen === 'string' ? atab.notizen : '';
        }
      }
    }
  } catch(e) { /* DOM-Elemente fehlen → still skippen */ }

  // Delegation an den generischen Helper. restoreFocusTo bleibt undefined
  // → der Helper restauriert den zuvor aktiven Fokus (= Auslöser-Button).
  // Die historische Option options.restoreFocus === false wird aus
  // Rückwärtskompatibilität nicht mehr genutzt (kein Caller übergibt sie);
  // wer sie braucht, übergibt explizit restoreFocusTo: null.
  if (typeof AppGlobals.installDialogA11y === 'function') {
    var cleanup = AppGlobals.installDialogA11y(modal, {
      onEscape: options.onEscape,
    });
    // Legacy-Alias: Bestandstests/Caller prüfen noch modal._kulturA11yCleanup.
    modal._kulturA11yCleanup = cleanup;
    return cleanup;
  }
}

// Ein migrierter Nutzer kann beim ersten Start nach dem Kultur-Update noch den
// unveränderten leeren Startschlag mit dem früheren Mais-Default 50.000 haben.
// Dieser Schlag darf die gewählte Kultur übernehmen, weil er keinerlei
// fachliche Eingaben oder Protokolle enthält. Andere/leere Arbeitsschläge und
// individuelle Einheitsgrößen bleiben bewusst unangetastet.
function isUntouchedInitialField(tab, tabIndex) {
  return tabIndex === 0
    && !!tab
    && tab.koernerProEinheit === AppGlobals.DEFAULT_KOERNER_PRO_EINHEIT
    && Number(tab.hektar || 0) === 0
    && Number(tab.istHektar || 0) === 0
    && Number(tab.koerner || 0) === 0
    && Number(tab.duenger || 0) === 0
    && (!Array.isArray(tab.entries) || tab.entries.length === 0)
    && tab.done !== true;
}

function chooseKultur(key) {
  if (!AppGlobals.isValidCultureKey(key)) {
    // Unbekannter Key → kein Effekt, Modal bleibt offen.
    return false;
  }
  var prevKultur = AppGlobals.state.kultur;
  AppGlobals.state.kultur = key;
  AppGlobals.state.erstauswahlDone = true;
  // Globaler kpe folgt dem Kultur-Standard. Nur setzen, wenn vorher keine
  // gültige Kultur gesetzt war — sonst bleibt der globale Default stabil
  // und neue Tabs bekommen den Profil-Wert (siehe addReiter).
  if (!prevKultur || !AppGlobals.isValidCultureKey(prevKultur)) {
    AppGlobals.state.koernerProEinheit = AppGlobals.getDefaultKoernerProEinheit(key);
  }
  // Frischer Start ODER unberührter migrierter Startschlag: Tab 0 erhält den
  // gewählten Kultur-Standard. Geladene Schläge mit Daten, Protokollen oder
  // individueller Einheitsgröße bleiben unverändert.
  var freshInstall = !AppGlobals._loadStateEverSucceeded;
  if (Array.isArray(AppGlobals.state.reiter) && AppGlobals.state.reiter.length > 0) {
    var initialTab = AppGlobals.state.reiter[0];
    if (initialTab && (freshInstall || isUntouchedInitialField(initialTab, 0))) {
      initialTab.koernerProEinheit = AppGlobals.getDefaultKoernerProEinheit(key);
    }
  }
  // Ein neuer Auftrag beginnt mit seinem einzigen Startschlag. Sobald die
  // verpflichtende Kultur gewählt wurde, erhält er wie jeder später
  // hinzugefügte Schlag die höchste Verteilpriorität.
  if (freshInstall) {
    AppGlobals.state.drillPriorities[0] = 1;
  }
  // Das Editorfeld kann bereits mit dem migrierten Wert 50.000 gerendert sein.
  // Direkt nach der Auswahl aus dem aktiven Schlag synchronisieren.
  if (typeof AppGlobals.syncEinheitGroesseEditorFromTab === 'function') {
    AppGlobals.syncEinheitGroesseEditorFromTab(AppGlobals.getActiveReiter());
  }
  closeKulturFirstRun();
  // Issue #417: Persistenz + Re-Render zentral über den
  // State-Coordinator (eventType KULTUR_CHANGED). Der Coordinator
  // übernimmt renderKulturBadge, _renderKulturEmpfehlung und renderResults.
  AppGlobals.appEmit('KULTUR_CHANGED', { kultur: key, source: 'first-run' });
  return true;
}

function openKulturFirstRun() {
  var overlay = document.getElementById('kultur_overlay');
  var modal = document.getElementById('kultur_modal');
  if (!modal) return;
  if (overlay) {
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
  }
  modal.hidden = false;
  modal.classList.add('open');
  // Accessibility: Fokus in Dialog + Tab-Trap. Escape bleibt ohne
  // Wirkung (onEscape=null) — die Erstauswahl ist verpflichtend
  // (siehe tests/kultur-first-run-and-change.test.js).
  _installKulturModalA11y(modal, { onEscape: null });
}

function closeKulturFirstRun() {
  var overlay = document.getElementById('kultur_overlay');
  var modal = document.getElementById('kultur_modal');
  if (modal) {
    _runKulturModalA11yCleanup(modal);
    modal.classList.remove('open');
    modal.hidden = true;
  }
  if (overlay) {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }
}

function renderKulturBadge() {
  var badge = document.getElementById('kultur_badge');
  var emojiEl = document.getElementById('kultur_badge_emoji');
  var labelEl = document.getElementById('kultur_badge_label');
  if (!badge || !emojiEl || !labelEl) return;
  var k = AppGlobals.state.kultur;
  if (!AppGlobals.isValidCultureKey(k)) {
    badge.hidden = true;
    return;
  }
  badge.hidden = false;
  emojiEl.textContent = AppGlobals.getCultureEmoji(k);
  labelEl.textContent = AppGlobals.getCultureLabel(k);
}

// Öffnet die Confirm-Maske, bevor die Kultur tatsächlich gewechselt wird.
// Merkt sich die neue Auswahl in _pendingKulturChoice.
function requestChangeKultur() {
  if (!AppGlobals.state.kultur) return;
  var overlay = document.getElementById('kultur_confirm_overlay');
  var modal = document.getElementById('kultur_confirm_modal');
  var select = document.getElementById('kultur_change_select');
  if (select) {
    select.value = AppGlobals.state.kultur;
    _kulturState.pendingKulturChoice = AppGlobals.state.kultur;
  }
  if (overlay) {
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
  }
  if (modal) {
    modal.hidden = false;
    modal.classList.add('open');
  }
  // Accessibility: Fokus in Dialog + Tab-Trap. Escape bricht ab
  // und stellt den Fokus auf den zuvor aktiven ändern-Button wieder
  // her (über den beim Install gemerkten prevFocus).
  _installKulturModalA11y(modal, {
    onEscape: function() { cancelChangeKultur(); }
  });
}

function _onKulturChangeSelectChange(el) {
  _kulturState.pendingKulturChoice = el.value;
}

function cancelChangeKultur() {
  _kulturState.pendingKulturChoice = null;
  var overlay = document.getElementById('kultur_confirm_overlay');
  var modal = document.getElementById('kultur_confirm_modal');
  if (modal) {
    _runKulturModalA11yCleanup(modal);
    modal.classList.remove('open');
    modal.hidden = true;
  }
  if (overlay) {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }
}

function confirmChangeKultur() {
  var key = _kulturState.pendingKulturChoice;
  if (!AppGlobals.isValidCultureKey(key)) {
    cancelChangeKultur();
    return;
  }
  var prevKultur = AppGlobals.state.kultur;
  // Bestehende Schläge behalten ihre r.koernerProEinheit — wir ändern NUR
  // das globale Profil und den Empfehlungstext. state.koernerProEinheit
  // folgt dem neuen Standard, damit neue Tabs den passenden Default bekommen.
  AppGlobals.state.kultur = key;
  AppGlobals.state.erstauswahlDone = true;
  AppGlobals.state.koernerProEinheit = AppGlobals.getDefaultKoernerProEinheit(key);
  cancelChangeKultur();
  // Issue #417: Persistenz + Re-Render zentral über den
  // State-Coordinator (eventType KULTUR_CHANGED). Der Coordinator
  // übernimmt renderKulturBadge, _renderKulturEmpfehlung und renderResults.
  AppGlobals.appEmit('KULTUR_CHANGED', { kultur: key, prevKultur: prevKultur, source: 'confirm' });
}

// Register exposed globals on AppGlobals (ADR-001 Schritt 3, Issue #278).
Object.assign(window.AppGlobals, {
  isUntouchedInitialField: isUntouchedInitialField,
  chooseKultur: chooseKultur,
  requestChangeKultur: requestChangeKultur,
  confirmChangeKultur: confirmChangeKultur,
  cancelChangeKultur: cancelChangeKultur,
  _onKulturChangeSelectChange: _onKulturChangeSelectChange,
  renderKulturBadge: renderKulturBadge,
  openKulturFirstRun: openKulturFirstRun,
  closeKulturFirstRun: closeKulturFirstRun,
});
// _kulturState.pendingKulturChoice als Live-Property auf AppGlobals
// (Live-Binding für Tests, damit sie den pending Key direkt setzen können
// ohne die IIFE-Grenze zu durchbrechen).
Object.defineProperty(window.AppGlobals, '_pendingKulturChoice', {
  get: function () { return _kulturState.pendingKulturChoice; },
  set: function (v) { _kulturState.pendingKulturChoice = v; },
  configurable: true,
  enumerable: true,
});
