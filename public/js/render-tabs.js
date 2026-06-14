// ============================================================================
// RENDER-TABS — Tab-Verwaltung, View-Toggle, App-Init, Tab-Remove-Confirm
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
      state.reiter.forEach(function(r, i) {
        var isActive = i === state.activeReiter && state.activeView !== 'protokoll';
        var btn = document.createElement('button');
        btn.className = 'tab-btn field-tab' + (isActive ? ' active' : '');
        btn.setAttribute('aria-label', 'Tab ' + (i+1));
        btn.onclick = function() { switchReiter(i); };
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
          renameReiter(i, newName);
        };
        span.onkeydown = function(evt) {
          if (evt.key === 'Enter') { evt.preventDefault(); span.blur(); }
          else if (evt.key === 'Escape') { evt.preventDefault(); span.textContent = r.name; span.blur(); }
          else { evt.stopPropagation(); }
        };
        span.onmousedown = function(evt) { evt.stopPropagation(); };

        if (state.reiter.length > 1) {
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
      addBtn.onclick = function() { addReiter(); };
      bar.appendChild(addBtn);
      var protokollBtn = document.getElementById('protokoll_tab_btn');
      if (protokollBtn) protokollBtn.classList.toggle('active', state.activeView === 'protokoll');
    }

    // --- Render: View (Feld vs. Protokoll) ---

    function renderView() {
      var r = getActiveReiter();
      var hasData = r.hektar > 0 && r.koerner > 0;
      var isProtokoll = state.activeView === 'protokoll';
      var skipIds = { r_soll_ist_section: true };
      var cards = document.querySelectorAll('.card');
      cards.forEach(function(c) {
        if (skipIds[c.id]) return;
        c.style.display = isProtokoll ? 'none' : 'block';
      });
      var resultsEl = document.getElementById('results');
      if (resultsEl) resultsEl.style.display = (hasData && !isProtokoll) ? 'block' : 'none';
      var drillSection = document.getElementById('drill_section');
      if (drillSection) drillSection.style.display = isProtokoll ? 'block' : 'none';
      var drillMask = document.getElementById('drill_mask');
      if (drillMask) drillMask.style.display = isProtokoll ? '' : 'none';
      var berechnenBtn = document.getElementById('berechnen_btn');
      if (berechnenBtn) berechnenBtn.style.display = isProtokoll ? 'none' : '';
      var resetBtn = document.getElementById('reset_btn');
      if (resetBtn) resetBtn.style.display = isProtokoll ? 'none' : '';
      var stickyFooter = document.getElementById('sticky_footer');
      if (stickyFooter) stickyFooter.style.display = isProtokoll ? 'none' : '';
    }

    // --- Init: UI (nach DOMContentLoaded) ---

    function initUI() {
      loadState();
      maybeShowIosInstallHint();
      maybeShowUpdateHint();
      // --- Cross-Tab-Synchronisation (portiert aus Inline-Code Z. 3394-3412) ---
      // Lauscht auf localStorage-Änderungen von anderen Tabs/Fenstern.
      // Der storage-Event feuert nur in Tabs, die den Wert NICHT selbst gesetzt haben.
      window.addEventListener('storage', function(e) {
        if (e.key === 'agrar_rechner' && e.newValue) {
          try {
            var remote = JSON.parse(e.newValue);
            if (JSON.stringify(remote) !== JSON.stringify(state)) {
              state = remote;
              syncInputsFromState();
              renderTabs();
              renderView();
              renderResults();
            }
          } catch(err) {
            console.warn('Cross-tab sync: ungültiger State ignoriert', err);
          }
        }
      });
      syncInputsFromState();
      renderTabs();
      // Fahrgassen-Toggle aus State restaurieren
      var fgToggle = document.getElementById('fahrgassen_toggle');
      var fgSettings = document.getElementById('fahrgassen_settings');
      if (fgToggle) {
        fgToggle.classList.toggle('active', !!state.fahrgassenEnabled);
        fgToggle.setAttribute('aria-pressed', state.fahrgassenEnabled ? 'true' : 'false');
      }
      if (fgSettings) {
        fgSettings.classList.toggle('open', !!state.fahrgassenEnabled);
      }
      var fgBreite = document.getElementById('fahrgassen_breite');
      if (fgBreite) {
        if (state.fahrgassenBreite > 0) {
          // Tests 8: rohe Ganzzahl als Input-Wert, kein ",0" für ganze Zahlen.
          // Nutze fmtCompact (Issue #266), das ",0" für ganze Zahlen weglässt.
          fgBreite.value = fmtCompact(state.fahrgassenBreite);
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
        egToggle.classList.toggle('active', !!state.einheitGroesseEnabled);
        egToggle.setAttribute('aria-pressed', state.einheitGroesseEnabled ? 'true' : 'false');
      }
      if (egSettings) {
        egSettings.classList.toggle('open', !!state.einheitGroesseEnabled);
      }
      var kpEl = document.getElementById('koerner_pro_einheit');
      if (kpEl && state.koernerProEinheit !== 50000) {
        // Tests 18, 24: rohe Ganzzahl als Input-Wert (kein Tausender-Punkt),
        // damit parseDE() in einheitGroesseUpdate() den Wert korrekt zurückschreibt.
        kpEl.value = String(state.koernerProEinheit);
        kpEl.dataset.prev = kpEl.value;
        kpEl.dataset.cleaned = kpEl.value;
      }
      var egSaved = document.getElementById('einheit_groesse_saved');
      if (egSaved) {
        egSaved.textContent = state.koernerProEinheit !== 50000
          ? state.koernerProEinheit.toLocaleString('de-DE') + ' Körner/Einheit'
          : '';
      }
      if (state.reiter[state.activeReiter] && state.reiter[state.activeReiter].hektar > 0 && state.reiter[state.activeReiter].koerner > 0) {
        renderResults();
        if (state.activeView !== 'protokoll') {
          var resultsEl = document.getElementById('results');
          if (resultsEl) resultsEl.style.display = 'block';
        }
      }
      renderView();
      renderDashboard();
      var vf = document.getElementById('version_footer');
      if (vf) vf.textContent = APP_VERSION + ' · ' + APP_BUILD_DATE;
      appOnStateChange(function(type, data) {
        switch (type) {
          case 'TAB_CHANGED':
            syncInputsFromState();
            renderTabs();
            saveState();
            renderResults();
            break;
          case 'ENTRY_ADDED':
          case 'ENTRY_REMOVED':
          case 'ENTRY_CHANGED':
          case 'CALCULATION_DONE':
            saveState();
            renderTabs();
            renderResults();
            renderView();
            // Issue #186: Dashboard muss bei State-Änderungen mit-synchronisieren.
            // Wenn das Dashboard-Sheet offen ist, sofort neu rendern, damit
            // verbleibende Einheiten/Dünger konsistent mit Tab-Ergebnis sind.
            var dashSheet = document.getElementById('dashboard_sheet');
            if (dashSheet && dashSheet.classList.contains('open')) {
              renderDashboard();
            }
            if (type === 'ENTRY_CHANGED' && state.reiter[state.activeReiter].hektar > 0 && state.reiter[state.activeReiter].koerner > 0) {
              var re = document.getElementById('results');
              if (re) re.style.display = 'block';
            } else if (type !== 'ENTRY_CHANGED') {
              var re2 = document.getElementById('results');
              if (re2) re2.style.display = 'block';
            }
            break;
          case 'STATE_LOADED':
            syncInputsFromState();
            renderTabs();
            renderView();
            renderResults();
            renderDashboard();
            break;
          case 'SETTINGS_CHANGED':
            saveState();
            renderResults();
            break;
          case 'TAB_RENAMED':
            saveState();
            renderTabs();
            break;
          case 'TAB_RESET':
            saveState();
            renderTabs();
            renderResults();
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
            syncInputsFromState();
            saveState();
            renderTabs();
            break;
          case 'TAB_REMOVED':
            syncInputsFromState();
            saveState();
            renderTabs();
            renderResults();
            break;
          case 'VIEW_CHANGED':
            saveState();
            renderTabs();
            renderView();
            if (state.activeView === 'protokoll') renderDrillTabList();
            renderResults();
            break;
          case 'DRILL_ENTRY_ADDED':
            saveState();
            renderDrillTabList();
            renderResults();
            drillCalcAll();
            break;
          case 'DRILL_ENTRY_REMOVED':
            saveState();
            renderDrillTabList();
            renderResults();
            drillCalcAll();
            break;
        }
      });
    }

    // --- Confirm Remove Tab ---

    function confirmRemoveReiter(idx) {
      var tab = state.reiter[idx];
      if (!tab) return;
      var hasEntries = tab.entries && tab.entries.length > 0;
      var hasData = tab.hektar > 0 || tab.koerner > 0 || tab.duenger > 0 || tab.istHektar > 0;
      if (hasEntries || hasData) {
        if (!confirm('Tab "' + tab.name + '" wirklich löschen? Daten vorhanden — alle Eingaben gehen verloren.')) return;
      } else {
        if (!confirm('Tab "' + tab.name + '" wirklich löschen? Alle Eingaben gehen verloren.')) return;
      }
      removeReiter(idx);
    }
