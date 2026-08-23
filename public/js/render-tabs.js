// ============================================================================
// RENDER-TABS — Tab-Rendering, App-Init, Tab-Remove-Confirm
//
// Lade-Reihenfolge (laut index.html): state.js → calculations.js →
//   culture-handlers.js → ui-handlers.js → tab-handlers.js → render-tabs.js
//   → render-results.js → render-drill.js → render-dashboard.js → main.js
//
// render-tabs.js braucht: state, tab-handlers.js (switchReiter, addReiter,
//   removeReiter, renameReiter), ui-handlers.js (confirmRemoveReiter-Trigger)
//   und main.js (appOnStateChange).
// Funktionen werden im globalen Scope definiert (Vanilla-JS / <script>-Tags).
// ============================================================================

    // --- Render: Tabs ---

    function renderTabs() {
      var bar = document.getElementById('tab_bar_left');
      bar.innerHTML = '';
      AppGlobals.state.reiter.forEach(function(r, i) {
        var isActive = i === AppGlobals.state.activeReiter && AppGlobals.state.activeView !== 'protokoll';
        var btn = document.createElement('button');
        btn.className = 'tab-btn field-tab' + (isActive ? ' active' : '');
        btn.setAttribute('aria-label', 'Schlag ' + (i+1));
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
          close.setAttribute('aria-label', 'Schlag schließen');
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
      fitTabNames(bar);
      var protokollBtn = document.getElementById('protokoll_tab_btn');
      if (protokollBtn) protokollBtn.classList.toggle('active', AppGlobals.state.activeView === 'protokoll');
      var isProtokollView = AppGlobals.state.activeView === 'protokoll';
      var dashSheet = document.getElementById('dashboard_sheet');
      var isDashOpen = !!(dashSheet && dashSheet.classList.contains('open'));
      var navRechner = document.getElementById('nav_rechner');
      if (navRechner) navRechner.classList.toggle('active', !isProtokollView && !isDashOpen);
      var navProtokoll = document.getElementById('nav_protokoll');
      if (navProtokoll) navProtokoll.classList.toggle('active', isProtokollView && !isDashOpen);
      var navUebersicht = document.getElementById('nav_uebersicht');
      if (navUebersicht) navUebersicht.classList.toggle('active', isDashOpen);
    }

    // --- Auto-Shrink: Reiter-Namen ---
    // Bei fester 3er-Spalte ist pro Reiter weniger Breite verfügbar als früher
    // in der frei fließenden Chip-Reihe. Statt lange Namen ("Schlag 10",
    // "Schlag 11", eigene Namen) hart per Ellipsis abzuschneiden, wird die
    // Schriftgröße pro Tab schrittweise verkleinert (--tab-name-scale in
    // styles.css), bis der Name komplett sichtbar ist. Erst wenn die
    // Mindestgröße erreicht ist, greift die Ellipsis als letzter Ausweg.
    function fitTabNames(bar) {
      var names = bar.querySelectorAll('.tab-name');
      names.forEach(function(span) {
        span.style.removeProperty('--tab-name-scale');
        // Versteckte Leiste (z.B. Protokoll-Ansicht) hat clientWidth 0 —
        // dort macht Messen keinen Sinn, der nächste sichtbare Render holt es nach.
        if (span.clientWidth === 0) return;
        var scale = 1;
        var minScale = 0.68;
        var step = 0.05;
        var guard = 10;
        while (span.scrollWidth > span.clientWidth + 1 && scale > minScale && guard-- > 0) {
          scale = Math.max(minScale, scale - step);
          span.style.setProperty('--tab-name-scale', scale.toFixed(2));
        }
      });
    }

    // Bei Rotation/Fenstergröße-Änderung neu anpassen (z.B. Tablet-Querformat).
    var fitTabNamesResizeTimer = null;
    window.addEventListener('resize', function() {
      clearTimeout(fitTabNamesResizeTimer);
      fitTabNamesResizeTimer = setTimeout(function() {
        var bar = document.getElementById('tab_bar_left');
        if (bar) fitTabNames(bar);
      }, 150);
    });

    // --- Render: View (Feld vs. Protokoll) ---

    function renderView() {
      var r = AppGlobals.getActiveReiter();
      var hasData = r.hektar > 0 && r.koerner > 0;
      var isProtokoll = AppGlobals.state.activeView === 'protokoll';
      var skipIds = { r_soll_ist_section: true };
      var cards = document.querySelectorAll('.card');
      cards.forEach(function(c) {
        if (skipIds[c.id]) return;
        c.style.display = isProtokoll ? 'none' : 'block';
      });
      // Lokales Protokoll-Redesign: .local-protool-Section ist KEIN .card und
      // wird daher von der obigen Schleife nicht angetastet. Stattdessen
      // toggeln wir via .protokoll-mode-Klasse auf .app-layout — CSS
      // blendet die Section in anderen Views aus.
      var appLayout = document.querySelector('.app-layout');
      if (appLayout) appLayout.classList.toggle('protokoll-mode', !!isProtokoll);
      // Elemente INNERHALB der Section sind ebenfalls kein .card; explizit
      // sichtbar/unsichtbar toggeln, weil [hidden] flexibel ist.
      var lpSection = document.getElementById('local_protocol_section');
      var balanceSection = document.getElementById('local_protocol_balance_section');
      [lpSection, balanceSection].forEach(function(section) {
        if (!section) return;
        if (isProtokoll) {
          section.hidden = false;
          section.style.display = '';
        } else {
          section.hidden = true;
        }
      });
      var resultsEl = document.getElementById('results');
      if (resultsEl) resultsEl.style.display = (hasData && !isProtokoll) ? 'block' : 'none';
      var drillSection = document.getElementById('drill_section');
      if (drillSection) drillSection.style.display = isProtokoll ? 'block' : 'none';
      var drillMask = document.getElementById('drill_mask');
      if (drillMask) drillMask.style.display = isProtokoll ? '' : 'none';
      var tabBar = document.getElementById('tab_bar');
      if (tabBar) tabBar.style.display = isProtokoll ? 'none' : 'flex';
      if (!isProtokoll) {
        var barLeft = document.getElementById('tab_bar_left');
        if (barLeft) fitTabNames(barLeft);
      }
      // Lokales Protokoll-Redesign: rendert Gesamtbilanz + Schläge/Maschine
      // wenn state.activeView === 'protokoll'. Wird NACH renderResults()
      // aufgerufen (render-tabs.js ist Subscriber für VIEW_CHANGED).
      if (isProtokoll && typeof AppGlobals.renderLocalProtocol === 'function') {
        AppGlobals.renderLocalProtocol();
      }
    }

    // --- Init: UI (nach DOMContentLoaded) ---

    function initUI() {
      AppGlobals.loadState();
      // --- Cross-Tab-Synchronisation (portiert aus Inline-Code Z. 3394-3412) ---
      // Lauscht auf localStorage-Änderungen von anderen Tabs/Fenstern.
      // Der storage-Event feuert nur in Tabs, die den Wert NICHT selbst gesetzt haben.
      // Wichtig: Remote-State läuft durch dieselbe Parse-/Migrations-/
      // Sanitisierungs-Pipeline wie loadState() (parseAndSanitizeState),
      // damit ein anderer Tab nicht durch direktes Schreiben eines
      // manipulierten JSON-Strings den jsonReviver, die Schema-Migrationen
      // oder die Top-Level-Whitelist umgehen kann.
      //
      // Issue #417: Cross-Tab-Sync ist eine separate Bridge und läuft
      // NICHT durch den State-Coordinator. Grund: ein zweiter appDispatch
      // (über saveState → storage-Event → andere Tabs → deren appDispatch)
      // wäre eine Endlosschleife. Daher bleibt das Re-Render hier direkt,
      // identisch zum Coordinator-Plan für TAB_CHANGED + KULTUR-CHANGED.
      window.addEventListener('storage', function(e) {
        if (e.key === 'agrar_rechner' && e.newValue) {
          try {
            var result = AppGlobals.parseAndSanitizeState(e.newValue);
            if (!result) return; // ungültiger Remote-State bleibt unverändert
            var remote = result.state;
            if (JSON.stringify(remote) !== JSON.stringify(AppGlobals.state)) {
              AppGlobals.state = remote;
              AppGlobals.syncInputsFromState();
              AppGlobals.renderTabs();
              AppGlobals.renderResults();
              // Kultur-UI konsistent halten: Badge, Empfehlung und
              // First-run-Modal müssen dieselbe Logik wie der initUI-Pfad
              // bekommen — sonst zeigt z.B. das Badge die alte Kultur,
              // obwohl der andere Tab längst Raps gespeichert hat.
              if (typeof AppGlobals.renderKulturBadge === 'function') {
                AppGlobals.renderKulturBadge();
              }
              _renderKulturEmpfehlung();
              if (!AppGlobals.state.erstauswahlDone && !AppGlobals.state.kultur) {
                if (typeof AppGlobals.openKulturFirstRun === 'function') {
                  AppGlobals.openKulturFirstRun();
                }
              } else if (typeof AppGlobals.closeKulturFirstRun === 'function') {
                AppGlobals.closeKulturFirstRun();
              }
            }
          } catch(err) {
            console.warn('Cross-tab sync: ungültiger State ignoriert', err);
          }
        }
      });
      // --- State-Coordinator (Issue #417) ---
      // Ab jetzt fließt jeder appEmit()-Aufruf durch den zentralen
      // EVENT_PLAN (state-coordinator.js). Persistenz + Re-Render werden
      // dort zentral entschieden — kein Handler, kein Renderer ruft
      // saveState() mehr selbst. Die Registrierung erfolgt einmalig hier
      // und ist damit die Single Source of Truth für die Frage "was
      // passiert bei welchem Event?".
      AppGlobals.registerStateCoordinator();
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
      // Einheit-Größe-Toggle aus State restaurieren (Issue #266).
      // Ab Migration 5→6 ist die Einheit-Größe pro Tab gespeichert
      // (r.koernerProEinheit); state.einheitGroesseEnabled ist nur noch
      // die Auf-/Zuklapp-Präferenz des Editors. Feld + saved-Text
      // werden via syncEinheitGroesseEditorFromTab() gefüllt.
      var egToggle = document.getElementById('einheit_groesse_toggle');
      var egSettings = document.getElementById('einheit_groesse_settings');
      if (egToggle) {
        egToggle.classList.toggle('active', !!AppGlobals.state.einheitGroesseEnabled);
        egToggle.setAttribute('aria-pressed', AppGlobals.state.einheitGroesseEnabled ? 'true' : 'false');
      }
      if (egSettings) {
        egSettings.classList.toggle('open', !!AppGlobals.state.einheitGroesseEnabled);
      }
      if (typeof AppGlobals.syncEinheitGroesseEditorFromTab === 'function') {
        AppGlobals.syncEinheitGroesseEditorFromTab(AppGlobals.getActiveReiter());
      }
      if (AppGlobals.state.reiter[AppGlobals.state.activeReiter] && AppGlobals.state.reiter[AppGlobals.state.activeReiter].hektar > 0 && AppGlobals.state.reiter[AppGlobals.state.activeReiter].koerner > 0) {
        AppGlobals.renderResults();
        if (AppGlobals.state.activeView !== 'protokoll') {
          var resultsEl = document.getElementById('results');
          if (resultsEl) resultsEl.style.display = 'block';
        }
      }
      renderView();
      if (AppGlobals.state.activeView === 'protokoll') {
        AppGlobals.renderDrillTabList();
      }
      AppGlobals.renderDashboard();
      if (AppGlobals.state.dashboardOpen && typeof AppGlobals.openDashboard === 'function') {
        AppGlobals.openDashboard();
      }
      // Kultur-Badge rendern
      if (typeof AppGlobals.renderKulturBadge === 'function') {
        AppGlobals.renderKulturBadge();
      }
      // Empfehlungstext für "Körner pro Hektar" an aktuelle Kultur anpassen
      _renderKulturEmpfehlung();
      // Erststart-Modal: idempotent — öffnen wenn keine Erstauswahl,
      // schließen wenn bereits gewählt (z.B. nach Cross-Tab-Sync oder
      // beim zweiten initUI nach loadState).
      if (!AppGlobals.state.erstauswahlDone && !AppGlobals.state.kultur) {
        if (typeof AppGlobals.openKulturFirstRun === 'function') {
          AppGlobals.openKulturFirstRun();
        }
      } else if (typeof AppGlobals.closeKulturFirstRun === 'function') {
        // Erstauswahl bereits getroffen → Modal sicher schließen.
        AppGlobals.closeKulturFirstRun();
      }
      var vf = document.getElementById('version_footer');
      if (vf) vf.textContent = APP_VERSION + ' · ' + APP_BUILD_DATE;
      // Issue #418 Welle 1: Bindings-Registrierung NACH DOMContentLoaded.
      // Idempotent — ein zweiter Aufruf (z.B. Cross-Tab-Sync-Pfad) ist ein
      // No-op. Bewusst nach renderDashboard()/renderTabs(), damit Handler-
      // Module (settings, reset, drill, …) ihre AppGlobals-Exporte bereits
      // registriert haben.
      if (typeof AppGlobals.initUIBindings === 'function') {
        AppGlobals.initUIBindings();
      }
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

    // --- Kultur: Empfehlungstext unter "Körner pro Hektar" ---

    function _renderKulturEmpfehlung() {
      // Stabile ID #koerner_empfehlung wird direkt im Markup gepflegt
      // (siehe public/index.html), damit der Textcontainer nicht erst
      // über nextElementSibling-Suche ermittelt werden muss.
      var emp = document.getElementById('koerner_empfehlung');
      if (!emp) return;
      var text = AppGlobals.getCultureEmpfehlung(AppGlobals.state.kultur);
      // Vereinbarte Produktregel: Sonstiges hat KEINE Aussaatstärke-
      // Empfehlung. Element bleibt im DOM (Layout-Stabilität), wird aber
      // entleert und über das HTML5-`hidden`-Attribut visuell verborgen.
      // Mais/Raps zeigen die exakten bisherigen Texte aus CULTURE_PROFILES.
      if (text == null) {
        emp.textContent = '';
        emp.hidden = true;
      } else {
        emp.textContent = text;
        emp.hidden = false;
      }
    }

// Register exposed globals on AppGlobals (ADR-001 Schritt 3, Issue #278).
Object.assign(window.AppGlobals, {
  renderTabs: renderTabs,
  renderView: renderView,
  initUI: initUI,
  confirmRemoveReiter: confirmRemoveReiter,
  _renderKulturEmpfehlung: _renderKulturEmpfehlung,
});
