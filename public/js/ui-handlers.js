// ============================================================================
// UI-HANDLERS — Tab-Verwaltung, Drill-Protokoll, Settings, Reset
//
// Alle Funktionen die UI-Events behandeln und state ändern.
// Jede state-Änderung löst appEmit() aus → Subscriber kümmert sich um rendern.
// Keine render*-Aufrufe direkt in diesen Funktionen (außer wo sofort nötig).
// ============================================================================

    // Zentrale DOM-ID-Registry (Issue #281). IDs aus resetAll() und
    // resetActiveTab() werden hier gebündelt, damit die Reset-Funktionen
    // nicht mit verstreuten String-Literals arbeiten. Helper `_resetInput`
    // und `_resetSummary` arbeiten auf dieser Konstante.
    var DOM_IDS = {
      hektar: 'hektar',
      istHektar: 'ist_hektar',
      koerner: 'koerner',
      duenger: 'duenger',
      errHektar: 'err_hektar',
      errKoerner: 'err_koerner',
      results: 'results',
      drillSection: 'drill_section',
      drillOverflowWarn: 'drill_overflow_warn',
      fahrgassenToggle: 'fahrgassen_toggle',
      fahrgassenSettings: 'fahrgassen_settings',
      fahrgassenBreite: 'fahrgassen_breite',
      fahrgassenSaved: 'fahrgassen_saved',
      einheitGroesseToggle: 'einheit_groesse_toggle',
      einheitGroesseSettings: 'einheit_groesse_settings',
      einheitGroesseSaved: 'einheit_groesse_saved',
      koernerProEinheit: 'koerner_pro_einheit',
      notizen: 'notizen',
      drillSummary: [
        'ds_saat_total', 'ds_saat_used', 'ds_saat_remaining',
        'ds_duenger_total', 'ds_duenger_used', 'ds_duenger_remaining',
        'ds_total_summary'
      ]
    };

    // Helper: Input-Feld leeren + dataset.prev/cleaned zurücksetzen.
    // Wird von resetAll() und resetActiveTab() gemeinsam genutzt.
    function _resetInput(id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.value = '';
      el.dataset.prev = '';
      el.dataset.cleaned = '';
    }

    // --- Kultur-Auswahl ---

// Setzt die globale Kultur und schließt das Erststart-Modal.
// Wird sowohl beim ersten Start als auch beim bewussten Wechsel verwendet.
// pendingKultur: vom User neu gewählter Key (für confirmChangeKultur)
var _kulturState = { pendingKulturChoice: null };

// --- Kultur-Modal Accessibility (Fokus-Trap, gespeicherter Fokus, Escape) ---
//
// Minimaler, dependency-freier Helper. Speichert beim Install den zuvor
// fokussierten Container (= in der Regel der auslösende ändern-Button),
// verschiebt den Fokus ins erste fokussierbare Element des Dialogs und
// fängt Tab/Shift+Tab innerhalb des Dialogs ab. Escape delegiert an
// onEscape (First-run-Dialog übergibt null → Escape bleibt wirkungslos,
// Wechsel-Dialog übergibt cancelChangeKultur).
//
// Cleanup wird auf modal._kulturA11yCleanup hinterlegt und von den
// jeweiligen Close-Funktionen aufgerufen — so wird auch beim Klick auf
// ✕ oder Abbrechen korrekt aufgeräumt und der Fokus auf das Auslöser-
// Element zurückgegeben.
function _getFocusableIn(root) {
  if (!root) return [];
  var sel = 'button:not([disabled]):not([hidden]), [href], input:not([disabled]):not([hidden]), select:not([disabled]):not([hidden]), textarea:not([disabled]):not([hidden]), [tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll(sel)).filter(function(el) {
    if (el.disabled) return false;
    if (el.hidden) return false;
    if (el.style && el.style.display === 'none') return false;
    return true;
  });
}

function _runKulturModalA11yCleanup(modal) {
  if (modal && typeof modal._kulturA11yCleanup === 'function') {
    var fn = modal._kulturA11yCleanup;
    modal._kulturA11yCleanup = null;
    try { fn(); } catch(e) {}
  }
}

function _installKulturModalA11y(modal, options) {
  if (!modal) return;
  options = options || {};
  var prevFocus = document.activeElement;
  var focusables = _getFocusableIn(modal);
  var firstFocusable = focusables[0];
  var lastFocusable = focusables[focusables.length - 1];

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
        var hEl = document.getElementById(DOM_IDS.hektar);
        var ihEl = document.getElementById(DOM_IDS.istHektar);
        var kEl = document.getElementById(DOM_IDS.koerner);
        var dEl = document.getElementById(DOM_IDS.duenger);
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
        var nEl = document.getElementById(DOM_IDS.notizen);
        if (nEl) {
          nEl.value = typeof atab.notizen === 'string' ? atab.notizen : '';
        }
      }
    }
  } catch(e) { /* DOM-Elemente fehlen → still skippen */ }

  function handler(evt) {
    if (evt && evt.key === 'Escape') {
      if (typeof options.onEscape === 'function') {
        if (evt.preventDefault) evt.preventDefault();
        if (evt.stopPropagation) evt.stopPropagation();
        options.onEscape();
      }
      // Kein onEscape → Escape bewusst ignorieren (First-run-Modal).
      return;
    }
    if (!evt || evt.key !== 'Tab') return;
    if (focusables.length === 0) {
      if (evt.preventDefault) evt.preventDefault();
      return;
    }
    var active = document.activeElement;
    var inModal = modal.contains(active);
    if (evt.shiftKey) {
      if (!inModal || active === firstFocusable) {
        if (evt.preventDefault) evt.preventDefault();
        try { lastFocusable.focus(); } catch(e) {}
      }
    } else {
      if (!inModal || active === lastFocusable) {
        if (evt.preventDefault) evt.preventDefault();
        try { firstFocusable.focus(); } catch(e) {}
      }
    }
  }
  modal.addEventListener('keydown', handler);
  modal._kulturA11yCleanup = function() {
    modal.removeEventListener('keydown', handler);
    if (options.restoreFocus !== false && prevFocus && typeof prevFocus.focus === 'function') {
      try { prevFocus.focus(); } catch(e) {}
    }
  };
  if (firstFocusable && typeof firstFocusable.focus === 'function') {
    try { firstFocusable.focus(); } catch(e) {}
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
    && tab.koernerProEinheit === 50000
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
  syncEinheitGroesseEditorFromTab(AppGlobals.getActiveReiter());
  closeKulturFirstRun();
  if (typeof AppGlobals.renderKulturBadge === 'function') {
    AppGlobals.renderKulturBadge();
  }
  AppGlobals.saveState();
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
  // (siehe tests/61-kultur-first-run.test.js).
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
  if (typeof AppGlobals.renderKulturBadge === 'function') {
    AppGlobals.renderKulturBadge();
  }
  AppGlobals.saveState();
  AppGlobals.appEmit('KULTUR_CHANGED', { kultur: key, prevKultur: prevKultur, source: 'confirm' });
  // Re-render: Results/Header/Körner-Empfehlung könnten sich ändern.
  if (typeof AppGlobals.renderResults === 'function') {
    AppGlobals.renderResults();
  }
}

// --- Tab-Verwaltung ---

    function addReiter() {
      syncStateFromInputs();
      // Neue Tabs erben koerner/duenger vom zuvor aktiven Reiter (Test-RED
      // tests/06-tab-management.test.js): der aktive Reiter ist nach
      // syncStateFromInputs() auf Stand, also direkt aus state.reiter lesen.
      var sourceTab = AppGlobals.state.reiter[AppGlobals.state.activeReiter];
      var maxIdx = 0;
      AppGlobals.state.reiter.forEach(function(r, i) { var m = parseInt(r.name.replace(/\D+/g, '')); if (!isNaN(m) && m > maxIdx) maxIdx = m; });
      // Per-Tab Einheitsgröße: neuen Schlag mit aktuellem Kultur-Standard
      // initialisieren. Wenn eine gültige Kultur gesetzt ist, gilt der
      // Profil-Default (Mais=50000, Raps=1.500.000, Sonstiges=0).
      // Ohne gültige Kultur fällt es auf den globalen koernerProEinheit
      // zurück (Mais-Backstop=50000) — damit Frisch-Installs nicht im
      // "Sonstiges"-Pfad landen.
      var newKpe;
      if (AppGlobals.isValidCultureKey(AppGlobals.state.kultur)) {
        newKpe = AppGlobals.getDefaultKoernerProEinheit(AppGlobals.state.kultur);
      } else if (typeof AppGlobals.state.koernerProEinheit === 'number'
                 && AppGlobals.state.koernerProEinheit > 0) {
        newKpe = AppGlobals.state.koernerProEinheit;
      } else {
        newKpe = 50000;
      }
      AppGlobals.state.reiter.push({ name: 'Schlag ' + (maxIdx + 1), hektar: 0, istHektar: 0, koerner: sourceTab.koerner, duenger: sourceTab.duenger, entries: [], done: false, fahrgassenEnabled: AppGlobals.state.fahrgassenEnabled, fahrgassenBreite: AppGlobals.state.fahrgassenBreite, koernerProEinheit: newKpe, notizen: '' });
      AppGlobals.state.activeReiter = AppGlobals.state.reiter.length - 1;
      AppGlobals.state.drillPriorities[AppGlobals.state.activeReiter] = 1;
      AppGlobals.appEmit('TAB_ADDED', { tabIdx: AppGlobals.state.activeReiter });
      document.getElementById('hektar').focus();
    }

    function removeReiter(idx) {
      if (AppGlobals.state.reiter.length <= 1) return;
      syncStateFromInputs();
      AppGlobals.state.reiter.splice(idx, 1);
      if (idx < AppGlobals.state.activeReiter) {
        AppGlobals.state.activeReiter -= 1; // Tab before active was removed — shift active left
      } else if (AppGlobals.state.activeReiter >= AppGlobals.state.reiter.length) {
        AppGlobals.state.activeReiter = AppGlobals.state.reiter.length - 1; // Active tab removed — clamp to last
      }
      var newPriorities = {};
      Object.keys(AppGlobals.state.drillPriorities).forEach(function(key) {
        var k = parseInt(key, 10);
        if (k < idx) newPriorities[k] = AppGlobals.state.drillPriorities[k];
        else if (k > idx) newPriorities[k - 1] = AppGlobals.state.drillPriorities[k];
      });
      AppGlobals.state.drillPriorities = newPriorities;
      AppGlobals.appEmit('TAB_REMOVED', { tabIdx: idx });
    }

    // Schließt die Übersicht (Dashboard), falls offen. Übersicht ist inzwischen
    // eine vollflächige Ansicht wie Rechner/Protokoll (kein Popup mehr) — beim
    // Wechsel zu einer der anderen Ansichten muss sie daher mit verlassen werden,
    // sonst bliebe sie sichtbar über der neu gewählten Ansicht liegen.
    function _closeDashboardIfOpen() {
      var sheet = document.getElementById('dashboard_sheet');
      if (sheet && sheet.classList.contains('open') && typeof AppGlobals.closeDashboard === 'function') {
        AppGlobals.closeDashboard();
      }
    }

    function switchReiter(idx) {
      if (idx === AppGlobals.state.activeReiter && AppGlobals.state.activeView !== 'protokoll') return;
      syncStateFromInputs();
      AppGlobals.state.activeReiter = idx;
      // Beim Tab-Wechsel aus der Protokoll-Ansicht zurück in die Feld-Ansicht
      // (Issue #291 View-Toggle-Pattern: Tab-Klick = Feld-Tab zeigen, Protokoll-Tab
      // ist kein eigener Reiter sondern ein View-Toggle).
      AppGlobals.state.activeView = null;
      _closeDashboardIfOpen();
      AppGlobals.appEmit('TAB_CHANGED', { tabIdx: idx });
      // Issue #377 (PR #379 Follow-up): TAB_CHANGED triggert im render-tabs-Subscriber
      // KEIN drillCalcAll — also würde der globale Lock auf drill_einheit / drill_duenger /
      // drill_hektar am vorherigen activeReiter verkleben. Direkt hier syncen ist
      // minimal-invasiv (kein Event-Coupling, kein Re-Render, vgl. Review-Variante A).
      AppGlobals._syncActiveTabLock();
    }

    function switchToProtokoll() {
      syncStateFromInputs();
      _closeDashboardIfOpen();
      if (AppGlobals.state.activeView === 'protokoll') {
        AppGlobals.state.activeView = null;
      } else {
        AppGlobals.state.activeView = 'protokoll';
        AppGlobals.renderDrillTabList();
      }
      AppGlobals.appEmit('VIEW_CHANGED', { view: AppGlobals.state.activeView });
    }

    // Für die persistente untere Navigation (Issue: UI-Angleichung an Demo).
    // Bringt die Ansicht zurück auf "Rechner": verlässt die Protokoll-Ansicht
    // (falls aktiv) und schließt das Dashboard-Sheet (falls offen). Reine
    // View-Navigation, ändert keine Berechnungswerte.
    function switchToRechner() {
      syncStateFromInputs();
      if (AppGlobals.state.activeView === 'protokoll') {
        AppGlobals.state.activeView = null;
        AppGlobals.appEmit('VIEW_CHANGED', { view: null });
      }
      _closeDashboardIfOpen();
    }

    function renameReiter(idx, name) {
      AppGlobals.state.reiter[idx].name = name.substring(0, 20);
      AppGlobals.appEmit('TAB_RENAMED', { tabIdx: idx });
    }

    // --- Fahrgassen ---

    function fahrgassenToggle() {
      AppGlobals.state.fahrgassenEnabled = !AppGlobals.state.fahrgassenEnabled;
      var btn = document.getElementById('fahrgassen_toggle');
      if (AppGlobals.state.fahrgassenEnabled) {
        document.getElementById('fahrgassen_settings').classList.add('open');
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        document.getElementById('fahrgassen_settings').classList.remove('open');
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
        AppGlobals.state.fahrgassenBreite = 0;
        document.getElementById('fahrgassen_saved').textContent = '';
      }
      // 5a: per-Tab-State synchronisieren — Berechnungen lesen r.fahrgassenEnabled
      AppGlobals.state.reiter.forEach(function(r) {
        r.fahrgassenEnabled = AppGlobals.state.fahrgassenEnabled;
        r.fahrgassenBreite = AppGlobals.state.fahrgassenBreite;
      });
      AppGlobals.appEmit('SETTINGS_CHANGED', { setting: 'fahrgassenEnabled' });
    }

    function fahrgassenUpdate() {
      var raw = document.getElementById('fahrgassen_breite').value;
      var val = AppGlobals.parseDE(raw);
      // 5d: breite < 2 → State unverändert, Feld zurücksetzen
      if (val >= 2) {
        AppGlobals.state.fahrgassenBreite = val;
        // 5c: Prozent-Info anzeigen
        // Anteil produktiv mit Fahrgassen: (breite-1)/breite → 23/24 = 95.83% für breite=24
        var pct = ((val - 1) / val) * 100;
        document.getElementById('fahrgassen_saved').textContent = val + ' m -> ~' + pct.toFixed(1) + '% bestellt';
        document.getElementById('fahrgassen_breite').style.borderColor = '';
        // 5a: per-Tab-State syncen
        AppGlobals.state.reiter.forEach(function(r) {
          r.fahrgassenEnabled = AppGlobals.state.fahrgassenEnabled;
          r.fahrgassenBreite = val;
        });
      } else {
        // breite 0/leer/< 2 → saved text leeren, State auf 0
        document.getElementById('fahrgassen_saved').textContent = '';
        document.getElementById('fahrgassen_breite').style.borderColor = '';
        if (val === 0 || isNaN(val)) {
          AppGlobals.state.fahrgassenBreite = 0;
        }
        // val < 2 (aber > 0): State bleibt auf letztem gültigen Wert
        // Feld wird nicht überschrieben — User sieht Eingabe, kann korrigieren
        if (val > 0 && val < 2) {
          document.getElementById('fahrgassen_saved').textContent = 'Fahrgassenbreite muss mindestens 2m betragen';
          // Feld auf vorherigen gültigen Wert zurücksetzen (oder leer wenn State 0)
          document.getElementById('fahrgassen_breite').value = AppGlobals.state.fahrgassenBreite > 0
            ? String(AppGlobals.state.fahrgassenBreite)
            : '';
        }
        if (val === 0 || isNaN(val)) {
          AppGlobals.state.reiter.forEach(function(r) {
            r.fahrgassenEnabled = AppGlobals.state.fahrgassenEnabled;
            r.fahrgassenBreite = 0;
          });
        }
      }
      AppGlobals.appEmit('SETTINGS_CHANGED', { setting: 'fahrgassenBreite' });
    }

    // --- Einheiten-Groesse ---

    // HIGH 5: einheitGroesseToggle ist nur noch Auf-/Zuklappen des
    // per-Schlag-Editors. Schließen darf weder den aktiven Tab-Wert
    // (r.koernerProEinheit) noch den Kultur-Standard
    // (state.koernerProEinheit) verändern. Beim erneuten Öffnen erscheint
    // der korrekte Tab-Wert (syncEinheitGroesseEditorFromTab).
    function einheitGroesseToggle() {
      AppGlobals.state.einheitGroesseEnabled = !AppGlobals.state.einheitGroesseEnabled;
      var btn = document.getElementById('einheit_groesse_toggle');
      var settings = document.getElementById('einheit_groesse_settings');
      if (AppGlobals.state.einheitGroesseEnabled) {
        if (settings) settings.classList.add('open');
        if (btn) {
          btn.classList.add('active');
          btn.setAttribute('aria-pressed', 'true');
        }
      } else {
        if (settings) settings.classList.remove('open');
        if (btn) {
          btn.classList.remove('active');
          btn.setAttribute('aria-pressed', 'false');
        }
      }
      // Editor (Feld + saved-Text) aus dem aktuellen Tab rekonstruieren
      // — beim Öffnen sieht der User den korrekten Tab-Wert, beim
      // Schließen wird kein State angefasst.
      syncEinheitGroesseEditorFromTab(AppGlobals.getActiveReiter());
      AppGlobals.appEmit('SETTINGS_CHANGED', { setting: 'einheitGroesseEnabled' });
    }

    function einheitGroesseUpdate() {
      var raw = document.getElementById('koerner_pro_einheit').value;
      var val = AppGlobals.parseDE(raw);
      var kpEl = document.getElementById('koerner_pro_einheit');
      if (val !== null && val > 0) {
        var rounded = Math.round(val);
        // HIGH 4: schreibt NUR auf den aktiven Tab. state.koernerProEinheit
        // ist der Kultur-Profil-Default und darf durch manuelle Eingabe
        // NICHT überschrieben werden — sonst verlieren neue Tabs ihren
        // Kultur-Standard.
        var activeTab = AppGlobals.state.reiter[AppGlobals.state.activeReiter];
        if (activeTab) activeTab.koernerProEinheit = rounded;
        kpEl.style.borderColor = '';
      } else {
        kpEl.style.borderColor = '#c00';
      }
      // Editor (saved-Text + Feld) aus dem aktuellen Tab rekonstruieren,
      // damit der Wert konsistent mit r.koernerProEinheit angezeigt wird.
      syncEinheitGroesseEditorFromTab(AppGlobals.getActiveReiter());
      AppGlobals.appEmit('SETTINGS_CHANGED', { setting: 'koernerProEinheit' });
    }

    // --- Reset ---

    function resetActiveTab() {
      var active = AppGlobals.state.activeReiter;
      // Issue: resetActiveTab() muss die per-Schlag-Einheitsgröße erhalten.
      // Beim Zurücksetzen werden Eingaben + Protokoll geleert, aber die
      // bisherige manuell gewählte koernerProEinheit dieses Schlags bleibt
      // bestehen — sonst würde ein späterer Kultur-Wechsel den Schlag
      // unbemerkt auf den neuen Profil-Default ziehen.
      var prevKpe = AppGlobals.state.reiter[active]
        ? AppGlobals.state.reiter[active].koernerProEinheit
        : undefined;
      AppGlobals.state.reiter[active] = {
        name: AppGlobals.state.reiter[active].name,
        hektar: 0, istHektar: 0, koerner: 0, duenger: 0,
        entries: [],
        done: false,
        fahrgassenEnabled: AppGlobals.state.fahrgassenEnabled,
        fahrgassenBreite: AppGlobals.state.fahrgassenBreite,
        koernerProEinheit: prevKpe,
        // Migration 8→9 (Notizen pro Schlag): zurücksetzen, damit
        // "Tab zurücksetzen" wirklich alle Tab-Daten leert.
        notizen: ''
      };
      AppGlobals.state.drillPriorities = {};
      // Clear drill summary values (Issue #281: IDs aus DOM_IDS)
      for (var si = 0; si < DOM_IDS.drillSummary.length; si++) {
        var sEl = document.getElementById(DOM_IDS.drillSummary[si]);
        if (sEl) sEl.textContent = '';
      }
      // Hide drill_section after reset
      var ds = document.getElementById(DOM_IDS.drillSection);
      if (ds) ds.style.display = 'none';
      var eh = document.getElementById(DOM_IDS.errHektar);
      if (eh) eh.textContent = '';
      var ek = document.getElementById(DOM_IDS.errKoerner);
      if (ek) ek.textContent = '';
      var he = document.getElementById(DOM_IDS.hektar);
      if (he) he.style.borderColor = '';
      var ke = document.getElementById(DOM_IDS.koerner);
      if (ke) ke.style.borderColor = '';
      var re = document.getElementById(DOM_IDS.results);
      if (re) re.style.display = 'none';
      // Clear inputs via _resetInput helper
      _resetInput(DOM_IDS.hektar);
      _resetInput(DOM_IDS.istHektar);
      _resetInput(DOM_IDS.koerner);
      _resetInput(DOM_IDS.duenger);
      // Notizen-Textarea leeren (kein _resetInput, weil textarea
      // kein Input-Element und keine dataset.prev/cleaned-Slots hat).
      var nEl = document.getElementById(DOM_IDS.notizen);
      if (nEl) nEl.value = '';
      AppGlobals.appEmit('TAB_RESET', { tabIdx: active });
    }

    function resetAll() {
      // Preserve UI-prefs that "Daten zurücksetzen" should NOT wipe.
      AppGlobals.state = {
        reiter: [{ name: 'Schlag 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false, fahrgassenEnabled: false, fahrgassenBreite: 0, koernerProEinheit: 50000, notizen: '' }],
        activeReiter: 0,
        activeView: null,
        fahrgassenEnabled: false,
        fahrgassenBreite: 0,
        einheitGroesseEnabled: false,
        koernerProEinheit: 50000,
        kultur: null,
        erstauswahlDone: false,
        machineLog: [],
        drillPriorities: {},
        // Lokales Protokoll-Redesign: Defaults nach Reset.
        protocolView: 'fields',
        protocolOpenCards: {}
      };
      // Fresh-Install-Flag zurück: nach resetAll verhält sich die App
      // wieder wie eine Erstinstallation (Modal öffnet sich erneut,
      // initialer Schlag wird neu mit Kultur-Standard belegt).
      if (typeof AppGlobals.resetLoadStateEverSucceeded === 'function') {
        AppGlobals.resetLoadStateEverSucceeded();
      }
      // Input- und Fehlerfelder zurücksetzen
      _resetInput(DOM_IDS.hektar);
      _resetInput(DOM_IDS.istHektar);
      _resetInput(DOM_IDS.koerner);
      _resetInput(DOM_IDS.duenger);
      // Notizen-Textarea leeren (Migration 8→9).
      var nElAll = document.getElementById(DOM_IDS.notizen);
      if (nElAll) nElAll.value = '';
      var errH = document.getElementById(DOM_IDS.errHektar);
      if (errH) errH.textContent = '';
      var errK = document.getElementById(DOM_IDS.errKoerner);
      if (errK) errK.textContent = '';
      var he2 = document.getElementById(DOM_IDS.hektar);
      if (he2) he2.style.borderColor = '';
      var ke2 = document.getElementById(DOM_IDS.koerner);
      if (ke2) ke2.style.borderColor = '';
      var res = document.getElementById(DOM_IDS.results);
      if (res) res.style.display = 'none';
      var ds = document.getElementById(DOM_IDS.drillSection);
      if (ds) ds.style.display = 'none';
      // Fahrgassen-Toggle deaktivieren
      var fgBtn = document.getElementById(DOM_IDS.fahrgassenToggle);
      if (fgBtn) {
        fgBtn.classList.remove('active');
        fgBtn.setAttribute('aria-pressed', 'false');
      }
      var fgSet = document.getElementById(DOM_IDS.fahrgassenSettings);
      if (fgSet) fgSet.classList.remove('open');
      var fgBr = document.getElementById(DOM_IDS.fahrgassenBreite);
      if (fgBr) fgBr.value = '';
      var fgSv = document.getElementById(DOM_IDS.fahrgassenSaved);
      if (fgSv) fgSv.textContent = '';
      // Einheit-Groesse-Toggle deaktivieren
      var egBtn = document.getElementById(DOM_IDS.einheitGroesseToggle);
      if (egBtn) {
        egBtn.classList.remove('active');
        egBtn.setAttribute('aria-pressed', 'false');
      }
      var egSet = document.getElementById(DOM_IDS.einheitGroesseSettings);
      if (egSet) egSet.classList.remove('open');
      var kp = document.getElementById(DOM_IDS.koernerProEinheit);
      if (kp) kp.value = '';
      var egSv = document.getElementById(DOM_IDS.einheitGroesseSaved);
      if (egSv) egSv.textContent = '';
      AppGlobals.state.drillPriorities = {};
      AppGlobals.renderTabs();
      AppGlobals.saveState();
      // Kultur-UI konsistent nachziehen: resetAll() setzt state.kultur = null
      // und erstauswahlDone = false. Der Landwirt MUSS nach dem Reset eine
      // Kultur wählen, damit der Rechner produktiv nutzbar ist. Wir
      // aktualisieren Badge/Empfehlung und öffnen den verpflichtenden
      // First-run-Dialog hier selbst — kein Reload, kein erneuter initUI()
      // nötig. Dieselbe Logik wie der initUI-Pfad (Issue: storage-Event-
      // Sync hat diese Synchronisierung als Vorbild).
      if (typeof AppGlobals.renderKulturBadge === 'function') {
        AppGlobals.renderKulturBadge();
      }
      if (typeof AppGlobals._renderKulturEmpfehlung === 'function') {
        AppGlobals._renderKulturEmpfehlung();
      }
      if (typeof AppGlobals.openKulturFirstRun === 'function') {
        AppGlobals.openKulturFirstRun();
      }
    }

    // --- Reset-Modal (Issue #236, redesign v3) ---
    // Öffnet/schließt das Bestätigungs-Dialogfenster für Reset-Aktionen.
    // Zeigt/versteckt Overlay + Modal über die 'open'-Klasse (siehe styles.css).
    // Beim Öffnen werden Kontext-Infos (Tab-Name, Anzahl Tabs/Einträge) befüllt,
    // damit der Nutzer sieht, was genau gelöscht wird.
    function _countAllEntries() {
      var n = 0;
      var reiter = AppGlobals.state.reiter || [];
      for (var i = 0; i < reiter.length; i++) {
        var e = reiter[i].entries;
        if (e) n += e.length;
      }
      return n;
    }

    function _populateResetContext() {
      var tabCtx = document.getElementById('reset_modal_tab_ctx');
      if (tabCtx) {
        var active = AppGlobals.getActiveReiter();
        var name = active && active.name ? active.name : 'Aktueller Tab';
        tabCtx.textContent = 'Leert Felder & Protokoll von „' + name + '“';
      }
      var allCtx = document.getElementById('reset_modal_all_ctx');
      if (allCtx) {
        var tabs = (AppGlobals.state.reiter || []).length;
        var entries = _countAllEntries();
        allCtx.textContent = tabs + ' Tab' + (tabs === 1 ? '' : 's') + ' · ' + entries + ' ' + (entries === 1 ? 'Eintrag' : 'Einträge');
      }
    }

    function openResetModal() {
      _populateResetContext();
      var overlay = document.getElementById('reset_overlay');
      var modal = document.getElementById('reset_modal');
      if (overlay) overlay.classList.add('open');
      if (modal) modal.classList.add('open');
    }

    function closeResetModal() {
      var overlay = document.getElementById('reset_overlay');
      var modal = document.getElementById('reset_modal');
      if (overlay) overlay.classList.remove('open');
      if (modal) modal.classList.remove('open');
    }

    function _onOverlayClick(event) {
      // Nur schließen wenn direkt auf das Overlay geklickt wurde (nicht auf ein Kind-Element).
      if (event && event.target && event.target.id === 'reset_overlay') {
        closeResetModal();
      }
    }

    function _onResetTab() {
      resetActiveTab();
      closeResetModal();
    }

    function _onResetAll() {
      resetAll();
      closeResetModal();
    }

    function _onCancel() {
      closeResetModal();
    }

    // --- Drill Protocol ---

    // Issue #276: drillAdd() wurde in fokussierte Helper aufgeteilt.
    // _parseDrillInputs liest die 3 Drill-Eingabefelder und parst sie.
    function _parseDrillInputs() {
      var einheitVal = document.getElementById('drill_einheit').value;
      var duengerVal = document.getElementById('drill_duenger').value;
      var hektarVal = document.getElementById('drill_hektar').value;
      return {
        einheit: AppGlobals.parseDE(einheitVal) || 0,
        duenger: AppGlobals.parseDE(duengerVal) || 0,
        zaehlerStand: AppGlobals.parseDE(hektarVal) || 0
      };
    }

    // Issue #276: _resolvePerTabDistribution liest die dtl_e_<i>/dtl_d_<i>
    // Felder aller Reiter. Liefert je Reiter { e, d } sowie Flags, ob
    // irgendein Reiter eine Priorität hat und ob irgendein priorisierter
    // Reiter Werte eingetragen hat.
    // Issue #240: bevorzugt dataset.rawValue, weil fmt() in drillCalcAll
    // aus 7.75 via half-up "7,8" macht — Re-Parsen gäbe sonst 7.8.
    function _resolvePerTabDistribution() {
      var perTabE = [], perTabD = [];
      var hasPriority = false;
      var perTabHasAny = false;
      for (var ii = 0; ii < AppGlobals.state.reiter.length; ii++) {
        var peEl = document.getElementById('dtl_e_' + ii);
        var pdEl = document.getElementById('dtl_d_' + ii);
        var peRaw = peEl && peEl.dataset && peEl.dataset.rawValue;
        var pdRaw = pdEl && pdEl.dataset && pdEl.dataset.rawValue;
        var pe = peRaw !== undefined && peRaw !== '' ? parseFloat(peRaw)
                  : (peEl ? AppGlobals.parseDE(peEl.value) || 0 : 0);
        var pd = pdRaw !== undefined && pdRaw !== '' ? parseFloat(pdRaw)
                  : (pdEl ? AppGlobals.parseDE(pdEl.value) || 0 : 0);
        perTabE.push(pe);
        perTabD.push(pd);
        var prio = AppGlobals.state.drillPriorities[ii] || 0;
        if (prio > 0) hasPriority = true;
        if (prio > 0 && (pe > 0 || pd > 0)) perTabHasAny = true;
      }
      return { perTabE: perTabE, perTabD: perTabD, hasPriority: hasPriority, perTabHasAny: perTabHasAny };
    }

    // Issue #276: _buildDrillEntry erzeugt das Entry-Objekt für einen
    // Multi-Tab-Drill-Push (mit machineLog-Index) oder einen Single-Tab-
    // Push (mlIdx = -1). Berechnet die cap-bewerteten Mengen für ein Tab.
    //
    // Issue #321: Dünger-Cap entfernt. Saatgut wird weiterhin auf die
    // Tab-Fläche gecappt (unitsForThisTab = min(input, maxUnitsThisTab)),
    // aber entry.duenger respektiert jetzt den Roh-User-Wert. Der vorherige
    // Math.min(duengerRaw, duengerPerUnit * unitsForThisTab)-Cap verschluckte
    // stillschweigend Dünger-Mengen, die von der Tab-Zielmenge abweichen,
    // und produzierte falsche Verbleibend-Werte.
    //
    // Begründung: kg/ha in den Tab-Einstellungen ist eine Zielsetzung des
    // Landwirts, kein physikalisches Limit. Der Landwirt kann legitimerweise
    // mehr oder weniger Dünger pro Einheit ausbringen als geplant — die App
    // soll das respektieren.
    //
    // Pre-Fix-Audit (kanban-comment auf t_b1a25916): 12 Reader von entry.duenger
    // geprüft, kein Reader bricht — alle cascade korrekt (höhere usedD →
    // kleinere next tabDCap in _calcDrillDistribution, korrekte Carryover-
    // Bedarfe in computeAllCarryovers). Render-Pfade zeigen jetzt die echten
    // kg statt der gecappten Werte.
    function _buildDrillEntry(tab, unitsRaw, duengerRaw, zaehlerStand, mlIdx) {
      var fgFactor = (tab.fahrgassenEnabled && tab.fahrgassenBreite >= 2)
        ? AppGlobals.computeFahrgassenFaktor(tab.fahrgassenBreite) : 1;
      var kpe = AppGlobals.resolveKoernerProEinheit(tab);
      var perUnit = (kpe > 0) ? (tab.koerner * fgFactor) / kpe : 0;
      var maxUnitsThisTab = tab.hektar * perUnit;
      var unitsForThisTab = Math.min(unitsRaw, maxUnitsThisTab);
      return {
        time: mlIdx >= 0 ? AppGlobals.getTabNextTime(tab) : new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        mlIdx: mlIdx,
        einheit: Math.round(unitsForThisTab * 100) / 100,
        duenger: Math.round(duengerRaw * 100) / 100,
        hektar: tab.hektar, istHektar: 0, zaehlerStand: zaehlerStand,
        koerner: tab.koerner, duengerRate: tab.duenger
      };
    }

    // Issue #276: _pushEntryToTab schiebt ein fertiges Entry in den State.
    function _pushEntryToTab(tab, entry) {
      tab.entries.push(entry);
    }

    // Issue #276: _buildMachineLogEntry erzeugt den machineLog-Datensatz
    // für den Multi-Tab-Pfad (Issue #21 / #73).
    function _buildMachineLogEntry(einheit, duenger, zaehlerStand, targetHektar, activeTab) {
      return {
        time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        einheit: einheit,
        duenger: duenger,
        zaehlerStand: zaehlerStand,
        hektar: zaehlerStand > 0 ? zaehlerStand : targetHektar,
        istHektar: 0,
        koerner: activeTab.koerner,
        duengerRate: activeTab.duenger,
        distributed: einheit
      };
    }

    // Hilfsfunktion: liest dtl_e_<active>/dtl_d_<active> (mit rawValue-Preferenz)
    // für den Single-Tab-Pfad. Liefert { e, d } (0 wenn nicht vorhanden).
    function _readActivePerTabValues() {
      var activeEEl = document.getElementById('dtl_e_' + AppGlobals.state.activeReiter);
      var activeDEl = document.getElementById('dtl_d_' + AppGlobals.state.activeReiter);
      var activeERaw = activeEEl && activeEEl.dataset && activeEEl.dataset.rawValue;
      var activeDRaw = activeDEl && activeDEl.dataset && activeDEl.dataset.rawValue;
      var e = activeERaw !== undefined && activeERaw !== '' ? parseFloat(activeERaw)
              : (activeEEl ? AppGlobals.parseDE(activeEEl.value) || 0 : 0);
      var d = activeDRaw !== undefined && activeDRaw !== '' ? parseFloat(activeDRaw)
              : (activeDEl ? AppGlobals.parseDE(activeDEl.value) || 0 : 0);
      return { e: e, d: d };
    }

    // Hilfsfunktion: setzt alle Drill-Inputs (global + per-Tab) zurück.
    function _clearDrillInputs() {
      for (var ci = 0; ci < AppGlobals.state.reiter.length; ci++) {
        var ceEl = document.getElementById('dtl_e_' + ci);
        var cdEl = document.getElementById('dtl_d_' + ci);
        if (ceEl) ceEl.value = '';
        if (cdEl) cdEl.value = '';
      }
      document.getElementById('drill_einheit').value = '';
      document.getElementById('drill_duenger').value = '';
      document.getElementById('drill_hektar').value = '';
    }

    function drillAdd() {
      var input = _parseDrillInputs();
      var einheit = input.einheit, duenger = input.duenger, zaehlerStand = input.zaehlerStand;
      if (einheit <= 0 && duenger <= 0) return;
      var activeTab = AppGlobals.state.reiter[AppGlobals.state.activeReiter];
      if (!activeTab) return;
      var targetHektar = activeTab.hektar > 0 ? activeTab.hektar : 0;
      var dist = _resolvePerTabDistribution();
      var anyPushed = false;
      if (dist.hasPriority && dist.perTabHasAny) {
        // === Multi-tab mode: one entry per prioritized tab with values ===
        for (var ti = 0; ti < AppGlobals.state.reiter.length; ti++) {
          if ((AppGlobals.state.drillPriorities[ti] || 0) <= 0) continue;
          if (dist.perTabE[ti] <= 0 && dist.perTabD[ti] <= 0) continue;
          var tab = AppGlobals.state.reiter[ti];
          var entry = _buildDrillEntry(tab, dist.perTabE[ti], dist.perTabD[ti], zaehlerStand, AppGlobals.state.machineLog.length);
          _pushEntryToTab(tab, entry);
          anyPushed = true;
        }
        // Ghost-entry fix (Issue #73): only push machineLog if at least one
        // per-tab entry was actually created.
        if (anyPushed) {
          AppGlobals.state.machineLog.push(_buildMachineLogEntry(einheit, duenger, zaehlerStand, targetHektar, activeTab));
        }
      } else if (activeTab.hektar > 0) {
        // === Single-tab mode ===
        // Ghost-entry fix (Issue #73 / #266-B2): a global drill_einheit without
        // per-tab distribution is ambiguous in a multi-tab session → bail.
        var activeVD = _readActivePerTabValues();
        if (activeVD.e <= 0 && activeVD.d <= 0 &&
            ((einheit <= 0 && duenger <= 0) || AppGlobals.state.reiter.length > 1)) {
          _clearDrillInputs();
          return;
        }
        var singleEntry = _buildDrillEntry(activeTab, einheit, duenger, zaehlerStand, -1);
        // Single-Tab nutzt die Roh-Inputs (kein cap-Fill), daher überschreiben.
        singleEntry.einheit = einheit;
        singleEntry.duenger = duenger;
        singleEntry.hektar = targetHektar;
        _pushEntryToTab(activeTab, singleEntry);
        anyPushed = true;
      }
      if (!anyPushed) { _clearDrillInputs(); return; }
      _clearDrillInputs();
      AppGlobals.appEmit('DRILL_ENTRY_ADDED', { tabIdx: AppGlobals.state.activeReiter });
    }

    function drillRemove(tabIdx, entryIdx) {
      if (!AppGlobals.state.reiter[tabIdx] || !AppGlobals.state.reiter[tabIdx].entries) return;
      AppGlobals.state.reiter[tabIdx].entries.splice(entryIdx, 1);
      AppGlobals.appEmit('DRILL_ENTRY_REMOVED', { tabIdx: tabIdx, entryIdx: entryIdx });
    }

    // Issue #277: _calcDrillDistribution ist die pure Berechnung der
    // cap-fill Verteilung. Liest keinen DOM, ruft keine Render-Funktionen
    // auf. Liefert einen Plan { [idx]: { giveE, giveD } }.
    //
    // Logik (1:1 portiert aus drillCalcAll, ohne DOM):
    //   - Prio 1 = höchste Prio (Issue #264). Sort: prio asc, idx asc.
    //   - Einheit und Duenger werden UNABHÄNGIG per cap-fill verteilt.
    //   - Letzter priorisierter Reiter absorbiert Einheit-Leftover NUR
    //     wenn er noch ungenutzten cap hat (Issue #266).
    function _calcDrillDistribution(totalE, totalD) {
      var priorities = [];
      for (var pi2 = 0; pi2 < AppGlobals.state.reiter.length; pi2++) {
        var r = AppGlobals.state.reiter[pi2];
        if (r.hektar > 0 && r.koerner > 0) {
          var prio = AppGlobals.state.drillPriorities[pi2] || 0;
          var total = AppGlobals.getTabTotalEinheiten(r);
          var used = AppGlobals.getTabUsedEinheiten(r);
          var rem = Math.max(0, total - used);
          priorities.push({ idx: pi2, prio: prio, rem: rem, r: r });
        }
      }
      priorities.sort(function(a, b) {
        if (a.prio !== b.prio) return a.prio - b.prio;
        return a.idx - b.idx;
      });
      var plan = {};
      for (var pi = 0; pi < AppGlobals.state.reiter.length; pi++) plan[pi] = { giveE: 0, giveD: 0 };
      if (totalE > 0 || totalD > 0) {
        var remE = totalE;
        var remD = totalD;
        var lastPrioIdx = -1;
        for (var lpi = priorities.length - 1; lpi >= 0; lpi--) {
          if (priorities[lpi].prio > 0) { lastPrioIdx = priorities[lpi].idx; break; }
        }
        for (var ipi = 0; ipi < priorities.length; ipi++) {
          var p = priorities[ipi];
          if (p.prio <= 0) continue;
          if (remE <= AppGlobals.EPSILON_QUANTITY && remD <= AppGlobals.EPSILON_QUANTITY) break;
          if (remE > AppGlobals.EPSILON_QUANTITY) {
            plan[p.idx].giveE = Math.min(remE, p.rem);
            remE -= plan[p.idx].giveE;
          }
          if (remD > AppGlobals.EPSILON_QUANTITY) {
            // Saat und Dünger folgen derselben Prio-Logik: jedes priorisierte
            // Tab nimmt bis zu seinem Rest (SOLL - used), der Überschuss geht
            // an den nächsten Prio-Tab. Symmetrisch zu giveE oben (Zeile 535).
            //
            // Hintergrund: User-Feedback 2026-06-22 ("Dünger sollte sich genauso
            // verhalten wie Saat"). Vorher hatte Dünger entweder gar keinen Cap
            // (PR #327, issue #326) oder einen restriktiveren Cap, der stillschweigend
            // Mengen schluckte. Mit diesem Fix verhalten sich Saat und Dünger
            // identisch: Prio-Reihenfolge, jeder Tab nimmt seinen Rest.
            //
            // Wenn used > SOLL (z.B. Phantom-Entry aus Alt-State), wird der
            // effective-Cap auf 0 geklemmt — der Tab ist über-befüllt, der
            // neue Dünger geht an Tabs mit echtem Rest.
            var tabDUsed = (p.r.entries || []).reduce(function(s, e) { return s + (e.duenger || 0); }, 0);
            var tabDNeed = Math.max(0, (p.r.hektar || 0) * (p.r.duenger || 0));
            var tabDRem = Math.max(0, tabDNeed - tabDUsed);
            plan[p.idx].giveD = Math.min(remD, tabDRem);
            remD -= plan[p.idx].giveD;
          }
        }
        // Leftover-Absorption im letzten priorisierten Reiter (Issue #266)
        if (lastPrioIdx >= 0 && remE > AppGlobals.EPSILON_QUANTITY) {
          var lastPlan = plan[lastPrioIdx];
          var lastP = null;
          for (var lpf = 0; lpf < priorities.length; lpf++) {
            if (priorities[lpf].idx === lastPrioIdx) { lastP = priorities[lpf]; break; }
          }
          if (lastP && lastPlan.giveE < lastP.rem - AppGlobals.EPSILON_QUANTITY) {
            lastPlan.giveE += remE;
          }
        }
      }
      return plan;
    }

    // Issue #277: _applyDrillPlan schreibt einen berechneten Plan in die
    // dtl_e_<i>/dtl_d_<i> Felder und steckt den 2-Dezimal-Wert in
    // dataset.rawValue (Issue #266-B2). Reine DOM-Schreib-Logik.
    function _applyDrillPlan(plan) {
      for (var ai = 0; ai < AppGlobals.state.reiter.length; ai++) {
        var p = plan[ai];
        var eEl = document.getElementById('dtl_e_' + ai);
        var dEl = document.getElementById('dtl_d_' + ai);
        if (eEl) {
          eEl.value = p.giveE > 0 ? AppGlobals.fmtEinheit(p.giveE) : '';
          eEl.dataset.rawValue = p.giveE > 0 ? String(AppGlobals.round6(p.giveE)) : '';
        }
        if (dEl) {
          dEl.value = p.giveD > 0 ? AppGlobals.fmt(p.giveD) : '';
          dEl.dataset.rawValue = p.giveD > 0 ? String(Math.round(p.giveD * 100) / 100) : '';
        }
      }
    }

    function drillCalcAll() {
      // Read user input
      var totalE = AppGlobals.parseDE(document.getElementById('drill_einheit').value) || 0;
      var totalD = AppGlobals.parseDE(document.getElementById('drill_duenger').value) || 0;
      // Pure Verteilungs-Berechnung (Issue #277) — kein DOM-Zugriff
      var plan = _calcDrillDistribution(totalE, totalD);
      // Tab-Liste neu rendern (Input-Felder werden ersetzt)
      AppGlobals.renderDrillTabList();
      // Plan in die frischen Inputs schreiben
      _applyDrillPlan(plan);
      // Issue #377: globale Drill-Inputs (drill_einheit / drill_duenger /
      // drill_hektar) deaktivieren, wenn der aktive Tab als done markiert
      // ist. Die Felder würden sonst Einträge auf einen abgeschlossenen
      // Tab schreiben.
      _syncActiveTabLock();
      AppGlobals.renderDrillSummary();
      AppGlobals.renderResults();
    }

    function _syncActiveTabLock() {
      // Issue #377: sperrt die globalen "Maschine eingefüllt"-Eingabefelder,
      // wenn der aktuell aktive Reiter `done === true` ist. Die
      // Per-Tab-Felder (dtl_e_<i>, dtl_d_<i>) werden bereits in
      // renderDrillTabList() pro-Tab disabled gerendert — dieser Sync
      // deckt den globalen Eingabeblock ab.
      var activeTab = AppGlobals.state.reiter[AppGlobals.state.activeReiter];
      var isActiveDone = !!(activeTab && activeTab.done === true);
      var ids = ['drill_einheit', 'drill_duenger', 'drill_hektar'];
      for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(ids[i]);
        if (el) el.disabled = isActiveDone;
      }
    }

    function drillCalcDebounced() {
      clearTimeout(AppGlobals._internal.drillCalcTimer);
      AppGlobals._internal.drillCalcTimer = setTimeout(AppGlobals.drillCalcAll, 150);
    }

    function drillMachineRemove(idx) {
      if (!AppGlobals.state.machineLog || idx < 0 || idx >= AppGlobals.state.machineLog.length) return;
      AppGlobals.state.machineLog.splice(idx, 1);
      AppGlobals.state.reiter.forEach(function(r) {
        if (!r.entries) return;
        for (var i = r.entries.length - 1; i >= 0; i--) {
          if (r.entries[i].mlIdx === idx) r.entries.splice(i, 1);
          else if (r.entries[i].mlIdx > idx) r.entries[i].mlIdx--;
        }
      });
      AppGlobals.appEmit('DRILL_ENTRY_REMOVED', { mlIdx: idx });
    }

    // --- Input Binding (reactive writes to state) ---

    function onInputHektar(el) {
      var r = AppGlobals.getActiveReiter();
      var v = AppGlobals.parseDE(el.value);
      if (r.hektar !== v) { r.hektar = v; AppGlobals.appEmit('ENTRY_CHANGED'); }
    }

    function onInputIstHektar(el) {
      var r = AppGlobals.getActiveReiter();
      var v = AppGlobals.parseDE(el.value);
      if (r.istHektar !== v) { r.istHektar = v; AppGlobals.appEmit('ENTRY_CHANGED'); }
    }

    function onInputKoerner(el) {
      var r = AppGlobals.getActiveReiter();
      var v = AppGlobals.parseDE(el.value);
      if (r.koerner !== v) { r.koerner = v; AppGlobals.appEmit('ENTRY_CHANGED'); }
    }

    function onInputDuenger(el) {
      var r = AppGlobals.getActiveReiter();
      var v = AppGlobals.parseDE(el.value);
      if (r.duenger !== v) { r.duenger = v; AppGlobals.appEmit('ENTRY_CHANGED'); }
    }

    // Migration 8→9 (Notizen pro Schlag): freier Text pro Tab/Reiter.
    // Persistenz via saveState() wird über den 'ENTRY_CHANGED'-Event
    // getriggert (render-tabs.js Subscriber ruft saveState() und
    // renderTabs()/renderResults()). Pro Tab getrennt: Tab-Wechsel
    // liest via syncInputsFromState() den Wert des Ziel-Tabs in die
    // textarea, ältere Notizen anderer Tabs bleiben im state erhalten.
    function onInputNotizen(el) {
      var r = AppGlobals.getActiveReiter();
      var v = typeof el.value === 'string' ? el.value : '';
      if (r.notizen !== v) { r.notizen = v; AppGlobals.appEmit('ENTRY_CHANGED'); }
    }

    // --- UI Wrappers (bridge: pure calculations → active tab context) ---
    // getTabKornerGesamt is in calculations.js; getActiveReiter is in ui-handlers.js
    function getKornerGesamt() {
      return AppGlobals.getTabKornerGesamt(AppGlobals.getActiveReiter());
    }

    // Issue #186: Convenience-Wrapper für aktiven Reiter.
    // delegieren an AppGlobals.getTabTotalEinheiten(r) / getTabTotalDuenger(r)
    // (Issue #7 — getTabTotalEinheiten/getTabTotalDuenger sind seit dem
    // Issue-7-Refactor die kanonischen Funktionen in calculations.js).
    function getActiveTotalEinheiten() {
      return AppGlobals.getTabTotalEinheiten(AppGlobals.getActiveReiter());
    }

    function getActiveTotalDuenger() {
      return AppGlobals.getTabTotalDuenger(AppGlobals.getActiveReiter());
    }

    // No-arg API-Kompatibilitäts-Wrapper (Issue #266).
    //
    // Tests rufen getTotalEinheiten() bzw. getTotalDuenger() ohne Argumente
    // auf. calculations.js exportiert diese Namen nicht mehr direkt
    // (Issue #7 — Konsolidierung auf getTabTotalEinheiten/getTabTotalDuenger).
    // Da ui-handlers.js NACH calculations.js geladen wird, gewinnen die
    // Wrapper im globalen Scope. Mittels arguments.length wird zwischen
    // Argument- und No-Arg-Aufruf dispatcht.
    //
    // No-arg: rechnet gegen state.koernerProEinheit für aktiven Reiter.
    // Arg-Version: delegiert an calculations.js-Kanone (mit optionalem
    // kpe-Override für Tests, die explizit einen Wert mitgeben).
    function getTotalEinheiten(r, koernerProEinheit) {
      if (arguments.length === 0) {
        return AppGlobals.getActiveTotalEinheiten();
      }
      return AppGlobals.getTabTotalEinheiten(r, koernerProEinheit);
    }
    function getTotalDuenger(r) {
      if (arguments.length === 0) {
        return AppGlobals.getActiveTotalDuenger();
      }
      return AppGlobals.getTabTotalDuenger(r);
    }

    // --- Input Formatierung (portiert aus Inline-Code Z. 2438-2546) ---
    //
    // Bereinigt Benutzereingaben während des Tippens.
    //
    // Modus 'integer': Nur Ziffern erlaubt (für Körner/ha).
    // Modus 'decimal': Ziffern + maximal ein Komma (für Hektar, Dünger).
    //
    // Auto-Komma-Erkennung: Manche Android-Tastaturen fügen automatisch
    // ein Komma ein – teils im selben input-Event wie die Ziffer, teils
    // in einem zweiten separaten Reformatierungs-Event (2-Pass-Verhalten).
    // Das keydown-Zähler-Heuristik scheitert beim 2-Pass-Fall, weil `prev`
    // nach dem ersten Event bereits die Ziffer enthält.
    //
    // Lösung: InputEvent.data als primäres Signal nutzen.
    //   e.data === ',' oder '.'  → User hat Dezimaltaste gedrückt → Komma behalten
    //   e.data = Ziffer / null   → Auto-Insert oder Reformatierung   → Komma entfernen
    //   Kein e / kein e.data     → Fallback auf _pendingKey (physische Tastatur)
    //
    // Beispiel decimal: '12..5' → '12,5' (Punkt→Komma, zweiter Punkt entfernt)
    //                  '12,5,5' → '12,5' (nur erstes Komma bleibt)
    function onInputFormat(el, mode, e) {
      var val = el.value;
      if (!val) { el.dataset.prev = ''; el.dataset.cleaned = ''; return; }
      var prev = el.dataset.prev || '';
      var cleaned;
      if (mode === 'integer') {
        // Nur Ziffern
        cleaned = val.replace(/[^\d]/g, '');
      } else {
        // Dezimal: Ziffern + ein Komma maximal
        // iOS mit englischer Tastatur: inputmode="decimal" liefert '.' statt ','.
        // Nur den ersten Punkt in ein Komma umwandeln, wenn noch kein Komma
        // vorhanden ist (sonst wäre es ein Tausenderpunkt in "1.234,5").
        var hasComma = val.indexOf(',') !== -1;
        if (!hasComma) {
          var firstDot = val.indexOf('.');
          if (firstDot > -1) {
            val = val.substring(0, firstDot) + ',' + val.substring(firstDot + 1);
          }
        }
        // Auto-Komma-Erkennung:
        // Wenn ein neues Komma auftaucht, prüfen ob der User es absichtlich
        // getippt hat.
        //
        // Strategie (Priorität absteigend):
        // 1. InputEvent.data vorhanden und nicht leer → zuverlässigstes Signal:
        //    data === ',' oder '.'  → User-Dezimaltaste        → Komma behalten
        //    data = Ziffer o.Ä.    → Auto-Insert (Android)     → Komma entfernen
        // 2. e.inputType = Komposition/Ersetzung → Android 2-Pass-Reformatierung → entfernen
        // 3. Kein e.data (Tests, ältere Browser): Fallback _pendingKey + Ziffernvergleich
        if (prev.indexOf(',') === -1 && val.indexOf(',') > 0) {
          var eventData = e ? e.data : undefined;
          var isDecimalInput;
          if (eventData !== null && eventData !== undefined && eventData !== '') {
            // InputEvent.data vorhanden: Dezimalseparator = User-Absicht, sonst Auto-Insert
            isDecimalInput = (eventData === ',' || eventData === '.');
          } else if (e && (e.inputType === 'insertCompositionText' || e.inputType === 'insertReplacementText')) {
            // Android 2-Pass-Reformatierung: Komma wurde nachträglich eingefügt → entfernen
            isDecimalInput = false;
          } else {
            // Kein e.data (Testumgebung, alte Browser): Fallback auf _pendingKey + Ziffernvergleich
            var key = _pendingKey;
            var isDecimalKey = (key === ',' || key === '.' || key === 'Decimal' || key === 'Comma');
            if (isDecimalKey) {
              isDecimalInput = true;
            } else if (key !== null && key !== 'Unidentified') {
              // Bekannte Nicht-Komma-Taste → Auto-Insert → entfernen
              isDecimalInput = false;
            } else {
              // null oder Unidentified: wenn genau 1 neue Ziffer + Komma im selben Event → Auto-Insert
              var withoutComma = val.replace(',', '');
              isDecimalInput = (withoutComma.length !== prev.length + 1);
            }
          }
          if (!isDecimalInput) {
            val = val.replace(',', '');
          }
        }
        cleaned = val.replace(/[^\d,]/g, '');
        // Nur das erste Komma behalten, Rest abschneiden
        var parts = cleaned.split(',');
        cleaned = parts[0] + (parts[1] !== undefined ? ',' + parts[1] : '');
      }
      el.dataset.prev = cleaned;
      el.dataset.cleaned = cleaned;
      if (el.value !== cleaned) {
        // Cursorposition proportional merken, damit Editierung in der Mitte nicht ans Ende springt
        var oldLen = el.value.length;
        var selStart = el.selectionStart;
        el.value = cleaned;
        var newPos;
        if (selStart === oldLen) {
          // Cursor war am Ende → am Ende bleiben
          newPos = cleaned.length;
        } else {
          // Cursor war in der Mitte → proportional anpassen
          newPos = Math.round(selStart * cleaned.length / oldLen);
        }
        el.setSelectionRange(newPos, newPos);
      }
    }

    // --- Helpers ---

// ============================================================================
// Lokales Protokoll-Redesign — Action-Sheet, View-Toggle, Accordion
// ============================================================================
//
// Verhalten dieser UI-Funktionen:
// - setProtocolView(view): wechselt 'fields' ⇄ 'machine' im neuen
//   Protokoll-Tab. Persistent (state.protocolView).
// - toggleProtocolAccordion(tabIdx, dateKey, cardKey): Single-Open-Logik
//   "ein Schlag gleichzeitig offen". Speichert das aktuell offene pro
//   Datum, sodass beim Wechsel auf einen anderen Schlag der vorherige
//   automatisch schließt. Beim Klick auf denselben Schlag wird er
//   geschlossen (toggle).
// - requestLocalProtocolDelete(kind, payload, timeLabel): öffnet das
//   Action-Sheet (Bottom-Sheet statt roter X), ruft beim Klick auf
//   "Buchung löschen" confirmLocalProtocolDelete(kind, payload) auf,
//   das die zugrundeliegende Datenoperation anstößt (drillRemove oder
//   drillMachineRemove — KEINE neuen Mutations, nur vorhandene Pfade).
//
// Die hier definierten Funktionen sind reine DOM-State-Bridge-Funktionen
// (kein Berechnungs-Code, keine Demowerte). Felder, die zuvor ein ✕
// hatten, sind jetzt entry-action (Drei-Punkte) → confirm-flow.

// Action-Sheet-Pending-Targets: was im offenen Sheet "schwebt".
// { kind: 'field'|'machine', payload: {tabIdx, entryIdx} | {mlIdx} }
var _localProtocolSheetTarget = null;

function setProtocolView(view) {
  if (view !== 'fields' && view !== 'machine') return;
  if (AppGlobals.state.protocolView === view) return;
  AppGlobals.state.protocolView = view;
  AppGlobals.saveState();
  AppGlobals.appEmit('PROTOCOL_VIEW_CHANGED', { view: view });
}

function toggleProtocolAccordion(tabIdx, dateKey, cardKey) {
  var openMap = AppGlobals.state.protocolOpenCards || (AppGlobals.state.protocolOpenCards = {});
  var key = String(tabIdx);
  var wasOpen = openMap[dateKey] === key;
  // Es darf im gesamten Protokoll nur eine Karte offen sein, nicht eine pro Tag.
  Object.keys(openMap).forEach(function(openDateKey) {
    delete openMap[openDateKey];
  });
  if (!wasOpen) {
    openMap[dateKey] = key;
  }
  AppGlobals.saveState();
  // Re-Render nur des Schläge-Panels (nicht der gesamten App).
  if (typeof AppGlobals.renderLocalProtocolFields === 'function') {
    AppGlobals.renderLocalProtocolFields();
  }
}

function requestLocalProtocolDelete(kind, payload, timeLabel) {
  // Sheet-Backdrop + Sheet sichtbar machen, Label/Pending speichern.
  _localProtocolSheetTarget = { kind: kind, payload: payload, timeLabel: timeLabel };
  var backdrop = document.getElementById('local_protocol_sheet_backdrop');
  var sheet = document.getElementById('local_protocol_action_sheet');
  var label = document.getElementById('local_protocol_sheet_label');
  var deleteBtn = document.getElementById('local_protocol_sheet_delete');
  if (label) {
    var sheetTimeLabel = timeLabel || '—';
    label.textContent = kind === 'machine'
      ? 'Maschinenfüllung um ' + sheetTimeLabel
      : 'Buchung um ' + sheetTimeLabel;
  }
  if (deleteBtn) {
    deleteBtn.textContent = kind === 'machine' ? 'Füllung löschen' : 'Buchung löschen';
  }
  if (backdrop) {
    backdrop.hidden = false;
    backdrop.classList.add('show');
  }
  if (sheet) {
    sheet.hidden = false;
    sheet.classList.add('show');
  }
}

function closeLocalProtocolSheet() {
  _localProtocolSheetTarget = null;
  var backdrop = document.getElementById('local_protocol_sheet_backdrop');
  var sheet = document.getElementById('local_protocol_action_sheet');
  if (backdrop) {
    backdrop.classList.remove('show');
    backdrop.hidden = true;
  }
  if (sheet) {
    sheet.classList.remove('show');
    sheet.hidden = true;
  }
}

function confirmLocalProtocolDelete() {
  var target = _localProtocolSheetTarget;
  if (!target) { closeLocalProtocolSheet(); return; }
  if (target.kind === 'field') {
    // drillRemove(tabIdx, entryIdx) ist der kanonische Pfad (render-drill.js)
    if (typeof AppGlobals.drillRemove === 'function') {
      AppGlobals.drillRemove(target.payload.tabIdx, target.payload.entryIdx);
    }
  } else if (target.kind === 'machine') {
    // drillMachineRemove ist der kanonische Pfad für Maschinen-Log.
    if (typeof AppGlobals.drillMachineRemove === 'function') {
      AppGlobals.drillMachineRemove(target.payload.mlIdx);
    }
  }
  closeLocalProtocolSheet();
}

    function getActiveReiter() {
      var r = AppGlobals.state.reiter[AppGlobals.state.activeReiter];
      if (!r) return AppGlobals.state.reiter[0];
      if (!r.entries) r.entries = [];
      return r;
    }

    function syncStateFromInputs() {
      var r = AppGlobals.getActiveReiter();
      r.hektar    = AppGlobals.parseDE(document.getElementById('hektar').value) || 0;
      r.istHektar = AppGlobals.parseDE(document.getElementById('ist_hektar').value) || 0;
      r.koerner   = AppGlobals.parseDE(document.getElementById('koerner').value) || 0;
      r.duenger    = AppGlobals.parseDE(document.getElementById('duenger').value) || 0;
      // Migration 8→9 (Notizen pro Schlag): Freitext-Wert ebenfalls
      // aus DOM übernehmen, damit Tab-Wechsel / Reset-Pfade / Fokus-
      // Shifts (Kultur-Modal) konsistent sind. textarea.value ist
      // immer ein String (Default ''), parseDE würde hier nichts
      // sinnvolles liefern.
      var nEl = document.getElementById('notizen');
      if (nEl) {
        r.notizen = typeof nEl.value === 'string' ? nEl.value : '';
      }
    }

    function toInputValue(n) {
      return String(n).replace('.', ',');
    }

    function syncInputsFromState() {
      var r = AppGlobals.getActiveReiter();
      var h = document.getElementById('hektar');
      var ih = document.getElementById('ist_hektar');
      var k = document.getElementById('koerner');
      var d = document.getElementById('duenger');
      var n = document.getElementById('notizen');
      var hVal = r.hektar > 0    ? toInputValue(r.hektar)    : '';
      var ihVal = r.istHektar > 0 ? toInputValue(r.istHektar) : '';
      var kVal = r.koerner > 0   ? toInputValue(r.koerner)   : '';
      var dVal = r.duenger > 0   ? toInputValue(r.duenger)   : '';
      h.value = hVal;  h.dataset.prev = hVal;  h.dataset.cleaned = hVal;
      ih.value = ihVal; ih.dataset.prev = ihVal; ih.dataset.cleaned = ihVal;
      k.value = kVal;  k.dataset.prev = kVal;  k.dataset.cleaned = kVal;
      d.value = dVal;  d.dataset.prev = dVal;  d.dataset.cleaned = dVal;
      // Migration 8→9 (Notizen pro Schlag): textarea-Inhalt aus dem
      // aktiven Reiter füllen — beim Tab-Wechsel sieht der User die
      // Notiz des neuen Schlags, ältere Notizen bleiben im state
      // (state.reiter[i].notizen) erhalten. sanitizeTab() vergibt für
      // jeden reiter.notizen einen Default '', daher ist typeof-Check
      // defensiv für Backwards-Compat.
      if (n) {
        n.value = typeof r.notizen === 'string' ? r.notizen : '';
      }
      // HIGH 3: Per-Tab kpe-Feld, saved-Text und UI-Zustand müssen bei
      // jedem Tabwechsel und bei init synchron sein, sonst zeigt das
      // Eingabefeld den Wert eines anderen Tabs.
      syncEinheitGroesseEditorFromTab(r);
    }

    // Synchronisiert den per-Schlag-Editor (Eingabefeld + saved-Text) aus
    // dem aktuellen Tab. Wird von syncInputsFromState aufgerufen und kann
    // auch direkt (z. B. nach Korrekturen via DevTools) genutzt werden.
    // 0/leer → Feld leer, saved-Text leer.
    // 50000 (Mais-Default) → Feld zeigt 50000, saved-Text leer (Default).
    function syncEinheitGroesseEditorFromTab(r) {
      var kpEl = document.getElementById('koerner_pro_einheit');
      var savedEl = document.getElementById('einheit_groesse_saved');
      var tabKpe = (r && typeof r.koernerProEinheit === 'number'
                    && isFinite(r.koernerProEinheit)
                    && r.koernerProEinheit > 0)
        ? r.koernerProEinheit
        : 0;
      if (kpEl) {
        // Rohe Ganzzahl (kein Tausender-Punkt) damit parseDE() in
        // einheitGroesseUpdate() den Wert korrekt zurückschreibt.
        var v = tabKpe > 0 ? String(tabKpe) : '';
        kpEl.value = v;
        kpEl.dataset.prev = v;
        kpEl.dataset.cleaned = v;
        kpEl.style.borderColor = '';
      }
      if (savedEl) {
        // Konsistent mit einheitGroesseUpdate(): 50000 (Mais-Default) ist
        // kein Hinweis wert; alles andere zeigt den Körner/Einheit-Text.
        if (tabKpe > 0 && tabKpe !== 50000) {
          savedEl.textContent = tabKpe.toLocaleString('de-DE') + ' Körner/Einheit';
        } else {
          savedEl.textContent = '';
        }
      }
    }

// Register exposed globals on AppGlobals (ADR-001 Schritt 3, Issue #278).
Object.assign(window.AppGlobals, {
  DOM_IDS: DOM_IDS,
  _resetInput: _resetInput,
  syncEinheitGroesseEditorFromTab: syncEinheitGroesseEditorFromTab,
  isUntouchedInitialField: isUntouchedInitialField,
  chooseKultur: chooseKultur,
  requestChangeKultur: requestChangeKultur,
  confirmChangeKultur: confirmChangeKultur,
  cancelChangeKultur: cancelChangeKultur,
  _onKulturChangeSelectChange: _onKulturChangeSelectChange,
  renderKulturBadge: renderKulturBadge,
  openKulturFirstRun: openKulturFirstRun,
  closeKulturFirstRun: closeKulturFirstRun,
  addReiter: addReiter,
  // Lokales Protokoll-Redesign — Action-Sheet + View-Toggle + Accordion
  setProtocolView: setProtocolView,
  toggleProtocolAccordion: toggleProtocolAccordion,
  requestLocalProtocolDelete: requestLocalProtocolDelete,
  closeLocalProtocolSheet: closeLocalProtocolSheet,
  confirmLocalProtocolDelete: confirmLocalProtocolDelete,
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
Object.assign(window.AppGlobals, {
  removeReiter: removeReiter,
  switchReiter: switchReiter,
  renameReiter: renameReiter,
  switchToProtokoll: switchToProtokoll,
  switchToRechner: switchToRechner,
  fahrgassenToggle: fahrgassenToggle,
  fahrgassenUpdate: fahrgassenUpdate,
  einheitGroesseToggle: einheitGroesseToggle,
  einheitGroesseUpdate: einheitGroesseUpdate,
  resetActiveTab: resetActiveTab,
  resetAll: resetAll,
  openResetModal: openResetModal,
  closeResetModal: closeResetModal,
  _onOverlayClick: _onOverlayClick,
  _onResetTab: _onResetTab,
  _onResetAll: _onResetAll,
  _onCancel: _onCancel,
  _parseDrillInputs: _parseDrillInputs,
  _resolvePerTabDistribution: _resolvePerTabDistribution,
  _buildDrillEntry: _buildDrillEntry,
  _pushEntryToTab: _pushEntryToTab,
  _buildMachineLogEntry: _buildMachineLogEntry,
  _readActivePerTabValues: _readActivePerTabValues,
  _clearDrillInputs: _clearDrillInputs,
  drillAdd: drillAdd,
  drillRemove: drillRemove,
  _calcDrillDistribution: _calcDrillDistribution,
  _applyDrillPlan: _applyDrillPlan,
  _syncActiveTabLock: _syncActiveTabLock,
  drillCalcAll: drillCalcAll,
  drillCalcDebounced: drillCalcDebounced,
  drillMachineRemove: drillMachineRemove,
  onInputHektar: onInputHektar,
  onInputIstHektar: onInputIstHektar,
  onInputKoerner: onInputKoerner,
  onInputDuenger: onInputDuenger,
  onInputNotizen: onInputNotizen,
  getKornerGesamt: getKornerGesamt,
  getActiveTotalEinheiten: getActiveTotalEinheiten,
  getActiveTotalDuenger: getActiveTotalDuenger,
  getTotalEinheiten: getTotalEinheiten,
  getTotalDuenger: getTotalDuenger,
  onInputFormat: onInputFormat,
  getActiveReiter: getActiveReiter,
  syncStateFromInputs: syncStateFromInputs,
  toInputValue: toInputValue,
  syncInputsFromState: syncInputsFromState,
});