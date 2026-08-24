// ============================================================================
// RESET-HANDLERS — Reset-Verantwortung (Tabs/Daten, Reset-Modal)
//
// Aus ui-handlers.js (Issue #416 Welle 4) in ein eigenes Modul extrahiert.
// Enthält:
//   - DOM_IDS, _resetInput (zentrale ID-Registry + Helper)
//   - resetActiveTab, resetAll
//   - _countAllEntries, _populateResetContext
//   - openResetModal, closeResetModal
//   - _onOverlayClick, _onResetTab, _onResetAll, _onCancel
//
// Lade-Reihenfolge (siehe index.html):
//   settings-handlers.js → reset-handlers.js → tab-handlers.js
//
// DOM_IDS und _resetInput werden außerhalb des Reset-Bereichs nicht mehr
// verwendet und sind deshalb mitgewandert. Die klassischen Script-Globals
// bleiben für bestehende Inline-HTML-Nutzung erhalten; zusätzlich registriert
// Object.assign(window.AppGlobals, …) die bisherige AppGlobals-API.
//
// Braucht zur Laufzeit (AppGlobals):
//   - state, appEmit, saveState, resetLoadStateEverSucceeded (state.js)
//   - getActiveReiter (input-handlers.js; bereits vorher geladen und erst beim
//     Nutzeraufruf gelesen)
//   - renderTabs, _renderKulturEmpfehlung (render-tabs.js) — erst beim
//     Nutzeraufruf aufgelöst
//   - renderKulturBadge, openKulturFirstRun (culture-handlers.js) — erst
//     beim Nutzeraufruf aufgelöst
//
// Verhaltensgleich zur ui-handlers.js-Variante (Issue #416 Welle 4 —
// minimale lexikalische Anpassungen, keine Logikänderungen).
// ============================================================================

    // Zentrale DOM-ID-Registry (Issue #281). IDs aus resetAll() und
    // resetActiveTab() werden hier gebündelt, damit die Reset-Funktionen
    // nicht mit verstreuten String-Literals arbeiten. Helper `_resetInput`
    // arbeitet auf dieser Konstante.
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
      // Issue #445 Welle 1 C: nach "Daten zurücksetzen" soll ein
      // nachfolgender korrupter loadState den Banner erneut zeigen
      // können. Flag wird hier zurückgesetzt — Banner selbst bleibt
      // sichtbar bis der Nutzer ihn aktiv wegklickt oder bis der nächste
      // erfolgreiche saveState() ihn überschreibt.
      if (typeof AppGlobals.resetCorruptStorageFlag === 'function') {
        AppGlobals.resetCorruptStorageFlag();
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
      // Issue #417: Persistenz + Re-Render zentral über den
      // State-Coordinator (eventType RESET_ALL). Der Coordinator übernimmt
      // renderTabs, renderResults, renderView, renderKulturBadge,
      // _renderKulturEmpfehlung und openKulturFirstRun.
      AppGlobals.appEmit('RESET_ALL');
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

// Register exposed globals on AppGlobals (ADR-001 Schritt 3, Issue #278).
// Die klassischen Top-Level-Deklarationen erhalten bestehende HTML-/Window-
// Nutzung (onclick="openResetModal()" / onclick="_onResetAll()" etc.);
// diese Registrierung erhält zusätzlich die AppGlobals-API für Konsumenten.
Object.assign(window.AppGlobals, {
  DOM_IDS: DOM_IDS,
  _resetInput: _resetInput,
  resetActiveTab: resetActiveTab,
  resetAll: resetAll,
  _countAllEntries: _countAllEntries,
  _populateResetContext: _populateResetContext,
  openResetModal: openResetModal,
  closeResetModal: closeResetModal,
  _onOverlayClick: _onOverlayClick,
  _onResetTab: _onResetTab,
  _onResetAll: _onResetAll,
  _onCancel: _onCancel,
});