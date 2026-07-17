// ============================================================================
// RENDER-TABS — Field-Chips (Schläge) + View-Routing
//
// Lade-Reihenfolge: state (state.js) → calc → ui → render-tabs → ...
// render-tabs.js braucht: state, ui-handlers, calculations
// Funktionen werden im globalen Scope definiert (Vanilla-JS / <script>-Tags).
// ============================================================================

    // --- Render: Field-Chips (Schläge) — pills mit Farb-Dot ---
    // Ersetzt die alte renderTabs(). IDs/Klassen bleiben erhalten:
    //   - .tab-btn (Pill-Container), .field-tab (Schlag-Tab), .tab-name (editierbarer Name)
    //   - .pill-tab-dot (amber/orange Dot vorne), .tab-close (X-Button)
    //   - .tab-add (+ Schlag Button)
    //
    // Render-Ziel: #field-chips statt #tab_bar_left
    function renderTabs() {
      var chipsEl = document.getElementById('field-chips');
      if (!chipsEl) return;
      chipsEl.innerHTML = '';
      AppGlobals.state.reiter.forEach(function(r, i) {
        var isActive = (i === AppGlobals.state.activeReiter)
                     && AppGlobals.state.activeView !== 'protokoll'
                     && AppGlobals.state.activeView !== 'uebersicht';
        var btn = document.createElement('button');
        btn.className = 'tab-btn field-tab' + (isActive ? ' active' : '');
        btn.setAttribute('aria-label', 'Schlag ' + (i + 1));
        btn.onclick = function() { AppGlobals.switchReiter(i); };
        var dot = document.createElement('span');
        dot.className = 'pill-tab-dot';
        btn.appendChild(dot);
        var span = document.createElement('span');
        span.className = 'tab-name';
        span.setAttribute('aria-label', 'Schlag-Name');
        span.setAttribute('role', 'textbox');
        span.setAttribute('tabindex', '0');
        span.setAttribute('contenteditable', 'true');
        span.textContent = r.name;
        span.onfocus = function() {
          var range = document.createRange();
          range.selectNodeContents(span);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        };
        span.onblur = function() {
          var newName = span.textContent.replace(/\n/g, ' ').trim();
          AppGlobals.renameReiter(i, newName);
        };
        span.onkeydown = function(evt) {
          if (evt.key === 'Enter') { evt.preventDefault(); span.blur(); }
          else if (evt.key === 'Escape') { evt.preventDefault(); span.textContent = r.name; span.blur(); }
          else { evt.stopPropagation(); }
        };
        span.onmousedown = function(evt) { evt.stopPropagation(); };
        if (AppGlobals.state.reiter.length > 1) {
          var close = document.createElement('button');
          close.className = 'tab-close chip-close';
          close.setAttribute('type', 'button');
          close.setAttribute('aria-label', 'Schlag schließen');
          close.onclick = function(evt) { evt.stopPropagation(); confirmRemoveReiter(i); };
          close.textContent = '✕';
          btn.appendChild(close);
        }
        btn.appendChild(span);
        chipsEl.appendChild(btn);
      });
      var addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'tab-add chip-add';
      addBtn.textContent = '+ Tab';
      addBtn.onclick = function() { AppGlobals.addReiter(); };
      chipsEl.appendChild(addBtn);
      // Legacy protokoll-tab button (hidden; Tests prüfen die active-Klasse via #protokoll_tab_btn)
      var protokollBtn = document.getElementById('protokoll_tab_btn');
      if (protokollBtn) protokollBtn.classList.toggle('active', AppGlobals.state.activeView === 'protokoll');
      // Bottom-Nav Active-Class
      var bnR = document.getElementById('bn_rechner');
      var bnP = document.getElementById('bn_protokoll');
      var bnU = document.getElementById('bn_uebersicht');
      if (bnR) bnR.classList.toggle('active', !AppGlobals.state.activeView || AppGlobals.state.activeView === 'rechner' || AppGlobals.state.activeView === null || AppGlobals.state.activeView === undefined);
      if (bnP) bnP.classList.toggle('active', AppGlobals.state.activeView === 'protokoll');
      if (bnU) bnU.classList.toggle('active', AppGlobals.state.activeView === 'uebersicht');
    }

    // --- Render: View Routing (Rechner / Protokoll / Übersicht) ---
    // Setzt page-title und View-Container-Sichtbarkeit.
    // Aktualisiert auch Bottom-Nav Active-Class und Field-Chips Sichtbarkeit.
    function renderView() {
      var r = AppGlobals.getActiveReiter();
      var hasData = r.hektar > 0 && r.koerner > 0;
      var isProtokoll = AppGlobals.state.activeView === 'protokoll';
      var isUebersicht = AppGlobals.state.activeView === 'uebersicht';
      var isRechner = !isProtokoll && !isUebersicht;

      // 1) View-Container
      var vr = document.getElementById('view_rechner');
      var vp = document.getElementById('view_protokoll');
      var vu = document.getElementById('view_uebersicht');
      if (vr) vr.style.display = isRechner ? 'block' : 'none';
      if (vp) vp.style.display = isProtokoll ? 'block' : 'none';
      if (vu) vu.style.display = isUebersicht ? 'block' : 'none';

      // 2) Bottom-Nav active-Class
      var bnR = document.getElementById('bn_rechner');
      var bnP = document.getElementById('bn_protokoll');
      var bnU = document.getElementById('bn_uebersicht');
      if (bnR) bnR.classList.toggle('active', isRechner);
      if (bnP) bnP.classList.toggle('active', isProtokoll);
      if (bnU) bnU.classList.toggle('active', isUebersicht);

      // 3) Field-Chips nur in Rechner-View zeigen
      var chipsWrap = document.querySelector('.field-chips-wrap');
      if (chipsWrap) chipsWrap.style.display = isRechner ? 'block' : 'none';

      // 4) Settings-Panel nur in Rechner-View (wenn offen)
      var settingsPanel = document.getElementById('settings_panel');
      var gear = document.getElementById('gear-btn');
      if (settingsPanel) settingsPanel.style.display = isRechner && gear && gear.classList.contains('open') ? 'block' : 'none';

      // 5) Page-Title (View-aware)
      var titleEl = document.getElementById('page-title');
      if (titleEl) {
        titleEl.textContent = isProtokoll ? 'Drill-Protokoll'
                              : isUebersicht ? 'Übersicht'
                              : 'Agrar-Rechner';
      }

      // 6) Header-meta anzeigen wenn Rechner-View, sonst leer
      var metaEl = document.querySelector('.app-header-meta');
      if (metaEl) metaEl.style.display = isRechner ? 'block' : 'none';

      // 7) Re-render Übersicht, falls sichtbar
      if (isUebersicht && typeof AppGlobals.renderDashboard === 'function') {
        AppGlobals.renderDashboard();
      }

      // 8) Result-Card Hide/Show (data-driven)
      var resultsEl = document.getElementById('results');
      if (resultsEl && isRechner) {
        resultsEl.style.display = hasData ? 'block' : 'none';
      }
      var drillSection = document.getElementById('drill_section');
      if (drillSection) drillSection.style.display = isProtokoll ? 'block' : 'none';
      var drillMask = document.getElementById('drill_mask');
      if (drillMask) drillMask.style.display = isProtokoll ? '' : 'none';

      // 9) stats-row auch nur in Rechner-View
      var statRow = document.getElementById('stat_row_cards');
      if (statRow) statRow.style.display = isRechner && hasData ? 'grid' : 'none';

      // 10) Drill-Einträge (Maschinen-Log): nur in Drill- oder Übersicht-View
      var machineLogEl = document.getElementById('drill_machine_log');
      if (machineLogEl && !isProtokoll) {
        machineLogEl.style.display = 'none';
      }

      // 11) Alte Card-Toggle-Logik (für tests/15-render-view.test.js):
      // Cards (.card + .bubble) im Rechner-View auf display:none setzen,
      // wenn aktive View Protokoll oder Übersicht ist. Drill-Card bleibt sichtbar.
      var skipIds = { r_soll_ist_section: true };
      var cardish = document.querySelectorAll('.card, .bubble, .stat-row');
      cardish.forEach(function(c) {
        if (skipIds[c.id]) return;
        if (isProtokoll || isUebersicht) {
          // Drill-Card (id=drill_section) bleibt in Protokoll sichtbar
          if (isProtokoll && c.id === 'drill_section') {
            c.style.display = 'block';
          } else {
            c.style.display = 'none';
          }
        }
      });
      if (!isProtokoll && !isUebersicht && resultsEl) {
        resultsEl.style.display = hasData ? 'block' : 'none';
      }
    }

    // --- Init: UI (nach DOMContentLoaded) ---

    function initUI() {
      AppGlobals.loadState();
      AppGlobals.maybeShowIosInstallHint();
      AppGlobals.maybeShowUpdateHint();
      // Cross-Tab-Synchronisation
      window.addEventListener('storage', function(e) {
        if (e.key === 'agrar_rechner' && e.newValue) {
          try {
            var remote = JSON.parse(e.newValue);
            if (JSON.stringify(remote) !== JSON.stringify(AppGlobals.state)) {
              AppGlobals.state = remote;
              AppGlobals.syncInputsFromState();
              AppGlobals.renderTabs();
              AppGlobals.renderResults();
            }
          } catch(err) {
            console.warn('Cross-tab sync: ungültiger State ignoriert', err);
          }
        }
      });
      AppGlobals.syncInputsFromState();
      AppGlobals.renderTabs();
      // Fahrgassen-Toggle aus State restaurieren (für per-tab-Toggle im Rechner)
      var fgToggle = document.getElementById('fahrgassen_toggle');
      var fgSettings = document.getElementById('fahrgassen_settings');
      if (fgToggle) {
        fgToggle.classList.toggle('active', !!AppGlobals.state.fahrgassenEnabled);
        fgToggle.setAttribute('aria-pressed', AppGlobals.state.fahrgassenEnabled ? 'true' : 'false');
      }
      if (fgSettings) {
        fgSettings.classList.toggle('open', !!AppGlobals.state.fahrgassenEnabled);
      }
      var fgBreite = document.getElementById('fahrgassen_breite');
      if (fgBreite) {
        if (AppGlobals.state.fahrgassenBreite > 0) {
          fgBreite.value = AppGlobals.fmtCompact(AppGlobals.state.fahrgassenBreite);
        } else {
          fgBreite.value = '';
        }
        fgBreite.dataset.prev = fgBreite.value;
        fgBreite.dataset.cleaned = fgBreite.value;
      }
      // Einheit-Größe-Toggle aus State restaurieren
      var egToggle = document.getElementById('einheit_groesse_toggle');
      var egSettings = document.getElementById('einheit_groesse_settings');
      if (egToggle) {
        egToggle.classList.toggle('active', !!AppGlobals.state.einheitGroesseEnabled);
        egToggle.setAttribute('aria-pressed', AppGlobals.state.einheitGroesseEnabled ? 'true' : 'false');
      }
      if (egSettings) {
        egSettings.classList.toggle('open', !!AppGlobals.state.einheitGroesseEnabled);
      }
      var kpEl = document.getElementById('koerner_pro_einheit');
      if (kpEl && AppGlobals.state.koernerProEinheit !== 50000) {
        kpEl.value = String(AppGlobals.state.koernerProEinheit);
        kpEl.dataset.prev = kpEl.value;
        kpEl.dataset.cleaned = kpEl.value;
      }
      var egSaved = document.getElementById('einheit_groesse_saved');
      if (egSaved) {
        egSaved.textContent = AppGlobals.state.koernerProEinheit !== 50000
          ? AppGlobals.state.koernerProEinheit.toLocaleString('de-DE') + ' Körner/Einheit'
          : '';
      }
      // Settings-Panel State (Fahrgassen)
      var swFg = document.getElementById('sw_fahrgassen');
      var detFg = document.getElementById('detail_fahrgassen');
      if (swFg) {
        swFg.classList.toggle('on', !!AppGlobals.state.fahrgassenEnabled);
        swFg.setAttribute('aria-pressed', AppGlobals.state.fahrgassenEnabled ? 'true' : 'false');
      }
      if (detFg) detFg.classList.toggle('open', !!AppGlobals.state.fahrgassenEnabled);
      // Settings-Panel State (Einheitgröße)
      var swEg = document.getElementById('sw_einheitgroesse');
      var detEg = document.getElementById('detail_einheitgroesse');
      if (swEg) {
        swEg.classList.toggle('on', !!AppGlobals.state.einheitGroesseEnabled);
        swEg.setAttribute('aria-pressed', AppGlobals.state.einheitGroesseEnabled ? 'true' : 'false');
      }
      if (detEg) detEg.classList.toggle('open', !!AppGlobals.state.einheitGroesseEnabled);
      var kpInput = document.getElementById('koerner_pro_einheit');
      if (kpInput && AppGlobals.state.koernerProEinheit !== 50000) {
        kpInput.value = String(AppGlobals.state.koernerProEinheit);
      }
      // Erstes Render-Ergebnis anzeigen, falls Daten vorhanden
      if (AppGlobals.state.reiter[AppGlobals.state.activeReiter]
          && AppGlobals.state.reiter[AppGlobals.state.activeReiter].hektar > 0
          && AppGlobals.state.reiter[AppGlobals.state.activeReiter].koerner > 0) {
        AppGlobals.renderResults();
      }
      renderView();
      AppGlobals.renderDashboard();
      var vf = document.getElementById('version_footer');
      if (vf) vf.textContent = AppGlobals.APP_VERSION + ' · ' + AppGlobals.APP_BUILD_DATE;
      // State-Change-Listener
      AppGlobals.appOnStateChange(function(type, data) {
        switch (type) {
          case 'TAB_CHANGED':
            AppGlobals.syncInputsFromState();
            AppGlobals.renderTabs();
            AppGlobals.saveState();
            AppGlobals.renderResults();
            renderView();
            break;
          case 'ENTRY_ADDED':
          case 'ENTRY_REMOVED':
          case 'ENTRY_CHANGED':
          case 'CALCULATION_DONE':
            AppGlobals.saveState();
            AppGlobals.renderTabs();
            AppGlobals.renderResults();
            renderView();
            if (AppGlobals.state.activeView === 'uebersicht') {
              AppGlobals.renderDashboard();
            }
            if (type === 'ENTRY_CHANGED' && AppGlobals.state.reiter[AppGlobals.state.activeReiter].hektar > 0 && AppGlobals.state.reiter[AppGlobals.state.activeReiter].koerner > 0) {
              var re = document.getElementById('results');
              if (re) re.style.display = 'block';
            } else if (type !== 'ENTRY_CHANGED') {
              var re2 = document.getElementById('results');
              if (re2) re2.style.display = 'block';
            }
            break;
          case 'STATE_LOADED':
            AppGlobals.syncInputsFromState();
            AppGlobals.renderTabs();
            renderView();
            AppGlobals.renderResults();
            AppGlobals.renderDashboard();
            break;
          case 'SETTINGS_CHANGED':
            AppGlobals.saveState();
            AppGlobals.renderResults();
            break;
          case 'TAB_RENAMED':
            AppGlobals.saveState();
            AppGlobals.renderTabs();
            break;
          case 'TAB_RESET':
            AppGlobals.saveState();
            AppGlobals.renderTabs();
            AppGlobals.renderResults();
            renderView();
            var re3 = document.getElementById('results');
            if (re3) re3.style.display = 'none';
            var eh = document.getElementById('err_hektar');
            var ek = document.getElementById('err_koerner');
            if (eh) eh.textContent = '';
            if (ek) ek.textContent = '';
            var he = document.getElementById('hektar');
            var ke = document.getElementById('koerner');
            if (he) he.style.borderColor = '';
            if (ke) ke.style.borderColor = '';
            break;
          case 'TAB_ADDED':
            AppGlobals.syncInputsFromState();
            AppGlobals.saveState();
            AppGlobals.renderTabs();
            renderView();
            break;
          case 'TAB_REMOVED':
            AppGlobals.syncInputsFromState();
            AppGlobals.saveState();
            AppGlobals.renderTabs();
            AppGlobals.renderResults();
            renderView();
            break;
          case 'VIEW_CHANGED':
            AppGlobals.saveState();
            AppGlobals.renderTabs();
            renderView();
            if (AppGlobals.state.activeView === 'protokoll') AppGlobals.renderDrillTabList();
            if (AppGlobals.state.activeView === 'uebersicht') AppGlobals.renderDashboard();
            AppGlobals.renderResults();
            break;
          case 'DRILL_ENTRY_ADDED':
            AppGlobals.saveState();
            AppGlobals.renderDrillTabList();
            AppGlobals.renderResults();
            AppGlobals.drillCalcAll();
            break;
          case 'DRILL_ENTRY_REMOVED':
            AppGlobals.saveState();
            AppGlobals.renderDrillTabList();
            AppGlobals.renderResults();
            AppGlobals.drillCalcAll();
            break;
        }
      });
    }

    // --- Confirm Remove Tab ---

    function confirmRemoveReiter(idx) {
      var tab = AppGlobals.state.reiter[idx];
      if (!tab) return;
      var hasEntries = tab.entries && tab.entries.length > 0;
      var hasData = tab.hektar > 0 || tab.koerner > 0 || tab.duenger > 0 || tab.istHektar > 0;
      if (hasEntries || hasData) {
        if (!confirm('Schlag "' + tab.name + '" wirklich löschen? Daten vorhanden — alle Eingaben gehen verloren.')) return;
      } else {
        if (!confirm('Schlag "' + tab.name + '" wirklich löschen? Alle Eingaben gehen verloren.')) return;
      }
      AppGlobals.removeReiter(idx);
    }

// Register exposed globals on AppGlobals (ADR-001 Schritt 3, Issue #278).
Object.assign(window.AppGlobals, {
  renderTabs: renderTabs,
  renderView: renderView,
  initUI: initUI,
  confirmRemoveReiter: confirmRemoveReiter,
});
