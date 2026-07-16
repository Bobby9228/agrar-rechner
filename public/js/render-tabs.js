// ============================================================================
// RENDER-TABS — Tab-Verwaltung, App-Init, Tab-Remove-Confirm
//
// Lade-Reihenfolge (laut index.html): state.js → calculations.js →
//   ui-handlers.js → render-tabs.js → render-results.js → render-drill.js
//   → render-dashboard.js → main.js
//
// render-tabs.js braucht: state, ui-handlers.js (switchReiter, addReiter,
//   removeReiter, renameReiter, confirmRemoveReiter-Trigger), main.js (appOnStateChange)
// Funktionen werden im globalen Scope definiert (Vanilla-JS / <script>-Tags).
// ============================================================================

    // --- Render: Tabs ---

    function renderTabs() {
      var bar = document.getElementById('tab_bar_left');
      bar.innerHTML = '';
      AppGlobals.state.reiter.forEach(function(r, i) {
        var isActive = i === AppGlobals.state.activeReiter && AppGlobals.state.activeView !== 'protokoll' && AppGlobals.state.activeView !== 'uebersicht';
        var btn = document.createElement('button');
        btn.className = 'tab-btn field-tab' + (isActive ? ' active' : '');
        btn.setAttribute('aria-label', 'Schlag ' + (i + 1));
        btn.onclick = function() { AppGlobals.switchReiter(i); };
        // Pill-tab: farbiger Punkt vor dem Namen
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
          var close = document.createElement('span');
          close.className = 'tab-close';
          close.setAttribute('role', 'button');
          close.setAttribute('aria-label', 'Tab schließen');
          close.onclick = function(evt) { evt.stopPropagation(); confirmRemoveReiter(i); };
          close.textContent = '✕';
          btn.appendChild(close);
        }

        btn.appendChild(span);
        bar.appendChild(btn);
      });
      var addBtn = document.createElement('button');
      addBtn.className = 'tab-add';
      addBtn.textContent = '+ Tab';
      addBtn.onclick = function() { AppGlobals.addReiter(); };
      bar.appendChild(addBtn);
      // Legacy protokoll-tab button (hidden; Bottom-Nav bn_protokoll triggers
      // die echte View-Switch). Tests prüfen weiterhin die active-Klasse.
      var protokollBtn = document.getElementById('protokoll_tab_btn');
      if (protokollBtn) protokollBtn.classList.toggle('active', AppGlobals.state.activeView === 'protokoll');
    }

    // --- Render: View (Rechner / Protokoll / Übersicht) ---

    function renderView() {
      var r = AppGlobals.getActiveReiter();
      var hasData = r.hektar > 0 && r.koerner > 0;
      var isProtokoll = AppGlobals.state.activeView === 'protokoll';
      var isUebersicht = AppGlobals.state.activeView === 'uebersicht';
      var isRechner = !isProtokoll && !isUebersicht;

      // 1) View-Container sichtbar schalten
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

      // 3) Tab-Bar nur in Rechner-View zeigen (Schlag-Auswahl gilt nicht in Drill/Übersicht)
      var tabBar = document.getElementById('tab_bar');
      if (tabBar) tabBar.style.display = isRechner ? '' : 'none';

      // 4) Cards-Toggle (alte Logik für Test-Kompatibilität in tests/15-render-view.test.js).
      // Karten in Rechner-View sichtbar (per data-driven-Style), in Protokoll/Übersicht
      // sind die Rechner-Karten display:none. Drill-Cards sind in Protokoll sichtbar.
      var skipIds = { r_soll_ist_section: true };
      var cards = document.querySelectorAll('.card');
      cards.forEach(function(c) {
        if (skipIds[c.id]) return;
        if (isProtokoll) {
          // drill_section + Maschinen-Log sind erlaubt
          c.style.display = (c.id === 'drill_section') ? 'block' : 'none';
        } else if (isUebersicht) {
          // In Übersicht sind nur die Dashboard-Cards sichtbar (renderDashboard())
          c.style.display = 'none';
        } else {
          // Rechner-View: Karten sichtbar, einzelne werden durch data-driven-Logik
          // (renderResults/renderResults/renderDrillSummary) weiter ein-/ausgeblendet.
          c.style.display = '';
        }
      });
      // results-Card ist datenabhängig (renderResults setzt sie)
      var resultsEl = document.getElementById('results');
      if (resultsEl && isRechner) {
        resultsEl.style.display = (hasData) ? 'block' : 'none';
      }
      var drillSection = document.getElementById('drill_section');
      if (drillSection) drillSection.style.display = isProtokoll ? 'block' : 'none';
      var drillMask = document.getElementById('drill_mask');
      if (drillMask) drillMask.style.display = isProtokoll ? '' : 'none';

      // 5) Re-render Übersicht, wenn aktiv
      if (isUebersicht && typeof AppGlobals.renderDashboard === 'function') {
        AppGlobals.renderDashboard();
      }

      // 6) Hide drill_section in Rechner (drill_section-Karte muss im Drill-Render-Pfad
      // neu sichtbar werden)
      var drillSummEl = document.getElementById('drill_summary');
      if (drillSummEl) drillSummEl.style.display = '';
    }

    // --- Init: UI (nach DOMContentLoaded) ---

    function initUI() {
      AppGlobals.loadState();
      AppGlobals.maybeShowIosInstallHint();
      AppGlobals.maybeShowUpdateHint();
      // --- Cross-Tab-Synchronisation (portiert aus Inline-Code Z. 3394-3412) ---
      // Lauscht auf localStorage-Änderungen von anderen Tabs/Fenstern.
      // Der storage-Event feuert nur in Tabs, die den Wert NICHT selbst gesetzt haben.
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
      // Fahrgassen-Toggle aus State restaurieren
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
          // Tests 8: rohe Ganzzahl als Input-Wert, kein ",0" für ganze Zahlen.
          // Nutze fmtCompact (Issue #266), das ",0" für ganze Zahlen weglässt.
          fgBreite.value = AppGlobals.fmtCompact(AppGlobals.state.fahrgassenBreite);
        } else {
          fgBreite.value = '';
        }
        fgBreite.dataset.prev = fgBreite.value;
        fgBreite.dataset.cleaned = fgBreite.value;
      }
      // Einheit-Größe-Toggle aus State restaurieren (Issue #266)
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
        // Tests 18, 24: rohe Ganzzahl als Input-Wert (kein Tausender-Punkt),
        // damit parseDE() in einheitGroesseUpdate() den Wert korrekt zurückschreibt.
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
      if (AppGlobals.state.reiter[AppGlobals.state.activeReiter] && AppGlobals.state.reiter[AppGlobals.state.activeReiter].hektar > 0 && AppGlobals.state.reiter[AppGlobals.state.activeReiter].koerner > 0) {
        AppGlobals.renderResults();
        if (AppGlobals.state.activeView !== 'protokoll') {
          var resultsEl = document.getElementById('results');
          if (resultsEl) resultsEl.style.display = 'block';
        }
      }
      renderView();
      AppGlobals.renderDashboard();
      var vf = document.getElementById('version_footer');
      if (vf) vf.textContent = APP_VERSION + ' · ' + APP_BUILD_DATE;
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
            // Bei state-Änderungen Übersicht re-rendern, falls sichtbar.
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
            var ds = document.getElementById('drill_section');
            if (ds) ds.style.display = 'none';
            var eh = document.getElementById('err_hektar');
            if (eh) eh.textContent = '';
            var ek = document.getElementById('err_koerner');
            if (ek) ek.textContent = '';
            var he = document.getElementById('hektar');
            if (he) he.style.borderColor = '';
            var ke = document.getElementById('koerner');
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
