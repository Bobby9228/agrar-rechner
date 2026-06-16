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
        var isActive = i === AppGlobals.state.activeReiter;
        var btn = document.createElement('button');
        btn.className = 'tab-btn field-tab' + (isActive ? ' active' : '');
        btn.setAttribute('aria-label', 'Tab ' + (i+1));
        btn.onclick = function() { AppGlobals.switchReiter(i); };
        var span = document.createElement('span');
        span.className = 'tab-name';
        span.setAttribute('aria-label', 'Tab-Name');
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
        var resultsEl = document.getElementById('results');
        if (resultsEl) resultsEl.style.display = 'block';
      }
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
            break;
          case 'ENTRY_ADDED':
          case 'ENTRY_REMOVED':
          case 'ENTRY_CHANGED':
          case 'CALCULATION_DONE':
            AppGlobals.saveState();
            AppGlobals.renderTabs();
            AppGlobals.renderResults();
            // Issue #186: Dashboard muss bei State-Änderungen mit-synchronisieren.
            // Wenn das Dashboard-Sheet offen ist, sofort neu rendern, damit
            // verbleibende Einheiten/Dünger konsistent mit Tab-Ergebnis sind.
            var dashSheet = document.getElementById('dashboard_sheet');
            if (dashSheet && dashSheet.classList.contains('open')) {
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
            break;
          case 'TAB_REMOVED':
            AppGlobals.syncInputsFromState();
            AppGlobals.saveState();
            AppGlobals.renderTabs();
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
        if (!confirm('Tab "' + tab.name + '" wirklich löschen? Daten vorhanden — alle Eingaben gehen verloren.')) return;
      } else {
        if (!confirm('Tab "' + tab.name + '" wirklich löschen? Alle Eingaben gehen verloren.')) return;
      }
      AppGlobals.removeReiter(idx);
    }

// Register exposed globals on AppGlobals (ADR-001 Schritt 3, Issue #278).
Object.assign(window.AppGlobals, {
  renderTabs: renderTabs,
  initUI: initUI,
  confirmRemoveReiter: confirmRemoveReiter,
});
