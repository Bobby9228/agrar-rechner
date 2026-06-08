// ============================================================================
// UI-HANDLERS — Tab-Verwaltung, Drill-Protokoll, Settings, Reset
//
// Alle Funktionen die UI-Events behandeln und state ändern.
// Jede state-Änderung löst appEmit() aus → Subscriber kümmert sich um rendern.
// Keine render*-Aufrufe direkt in diesen Funktionen (außer wo sofort nötig).
// ============================================================================

    // --- Tab-Verwaltung ---

    function addReiter() {
      syncStateFromInputs();
      var maxIdx = 0;
      state.reiter.forEach(function(r, i) { var m = parseInt(r.name.replace(/\D+/g, '')); if (!isNaN(m) && m > maxIdx) maxIdx = m; });
      state.reiter.push({ name: 'Tab ' + (maxIdx + 1), hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], fahrgassenEnabled: state.fahrgassenEnabled, fahrgassenBreite: state.fahrgassenBreite });
      state.activeReiter = state.reiter.length - 1;
      appEmit('TAB_ADDED', { tabIdx: state.activeReiter });
      document.getElementById('hektar').focus();
    }

    function removeReiter(idx) {
      if (state.reiter.length <= 1) return;
      syncStateFromInputs();
      state.reiter.splice(idx, 1);
      if (idx < state.activeReiter) {
        state.activeReiter -= 1; // Tab before active was removed — shift active left
      } else if (state.activeReiter >= state.reiter.length) {
        state.activeReiter = state.reiter.length - 1; // Active tab removed — clamp to last
      }
      var newPriorities = {};
      Object.keys(state.drillPriorities).forEach(function(key) {
        var k = parseInt(key, 10);
        if (k < idx) newPriorities[k] = state.drillPriorities[k];
        else if (k > idx) newPriorities[k - 1] = state.drillPriorities[k];
      });
      state.drillPriorities = newPriorities;
      appEmit('TAB_REMOVED', { tabIdx: idx });
    }

    function switchReiter(idx) {
      if (idx === state.activeReiter && state.activeView !== 'protokoll') return;
      syncStateFromInputs();
      state.activeReiter = idx;
      state.activeView = null;
      appEmit('TAB_CHANGED', { tabIdx: idx });
    }

    function renameReiter(idx, name) {
      state.reiter[idx].name = name.substring(0, 20);
      appEmit('TAB_RENAMED', { tabIdx: idx });
    }

    function switchToProtokoll() {
      if (state.activeView === 'protokoll') {
        state.activeView = null;
      } else {
        state.activeView = 'protokoll';
        renderDrillTabList();
      }
      appEmit('VIEW_CHANGED', { view: state.activeView });
    }

    // --- Fahrgassen ---

    function fahrgassenToggle() {
      state.fahrgassenEnabled = !state.fahrgassenEnabled;
      var btn = document.getElementById('fahrgassen_toggle');
      if (state.fahrgassenEnabled) {
        document.getElementById('fahrgassen_settings').classList.add('open');
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        document.getElementById('fahrgassen_settings').classList.remove('open');
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
        state.fahrgassenBreite = 0;
      }
      appEmit('SETTINGS_CHANGED', { setting: 'fahrgassenEnabled' });
    }

    function fahrgassenUpdate() {
      var raw = document.getElementById('fahrgassen_breite').value;
      var val = parseDE(raw);
      if (val !== null && val >= 0 && val < 100) {
        state.fahrgassenBreite = val;
        document.getElementById('fahrgassen_saved').textContent = val + ' m';
        document.getElementById('fahrgassen_breite').style.borderColor = '';
        state.reiter.forEach(function(r) { r.fahrgassenEnabled = state.fahrgassenEnabled; r.fahrgassenBreite = val; });
      } else {
        document.getElementById('fahrgassen_breite').style.borderColor = '#c00';
        state.fahrgassenBreite = 0;
      }
      appEmit('SETTINGS_CHANGED', { setting: 'fahrgassenBreite' });
    }

    // --- Einheiten-Groesse ---

    function einheitGroesseToggle() {
      state.einheitGroesseEnabled = !state.einheitGroesseEnabled;
      var btn = document.getElementById('einheit_groesse_toggle');
      if (state.einheitGroesseEnabled) {
        document.getElementById('einheit_groesse_settings').classList.add('open');
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        document.getElementById('einheit_groesse_settings').classList.remove('open');
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
        state.koernerProEinheit = 50000;
      }
      appEmit('SETTINGS_CHANGED', { setting: 'einheitGroesseEnabled' });
    }

    function einheitGroesseUpdate() {
      var raw = document.getElementById('koerner_pro_einheit').value;
      var val = parseDE(raw);
      if (val !== null && val > 0 && val <= 999999) {
        state.koernerProEinheit = Math.round(val);
        document.getElementById('einheit_groesse_saved').textContent = state.koernerProEinheit.toLocaleString('de-DE') + ' Körner/Einheit';
        document.getElementById('koerner_pro_einheit').style.borderColor = '';
      } else {
        document.getElementById('koerner_pro_einheit').style.borderColor = '#c00';
      }
      appEmit('SETTINGS_CHANGED', { setting: 'koernerProEinheit' });
    }

    // --- Reset ---

    function resetActiveTab() {
      var active = state.activeReiter;
      state.reiter[active] = {
        name: state.reiter[active].name,
        hektar: 0, istHektar: 0, koerner: 0, duenger: 0,
        entries: [],
        fahrgassenEnabled: state.fahrgassenEnabled,
        fahrgassenBreite: state.fahrgassenBreite
      };
      state.drillPriorities = {};
      appEmit('TAB_RESET', { tabIdx: active });
    }

    function resetAll() {
      state = {
        reiter: [{ name: 'Tab 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [] }],
        activeReiter: 0,
        activeView: null,
        fahrgassenEnabled: false,
        fahrgassenBreite: 0,
        einheitGroesseEnabled: false,
        koernerProEinheit: 50000,
        machineLog: []
      };
      document.getElementById('hektar').value = '';
      document.getElementById('ist_hektar').value = '';
      document.getElementById('koerner').value = '';
      document.getElementById('duenger').value = '';
      document.getElementById('err_hektar').textContent = '';
      document.getElementById('err_koerner').textContent = '';
      document.getElementById('hektar').style.borderColor = '';
      document.getElementById('koerner').style.borderColor = '';
      document.getElementById('results').style.display = 'none';
      document.getElementById('drill_section').style.display = 'none';
      document.getElementById('fahrgassen_toggle').classList.remove('active');
      document.getElementById('fahrgassen_toggle').setAttribute('aria-pressed', 'false');
      document.getElementById('fahrgassen_settings').classList.remove('open');
      document.getElementById('fahrgassen_breite').value = '';
      document.getElementById('fahrgassen_saved').textContent = '';
      document.getElementById('einheit_groesse_toggle').classList.remove('active');
      document.getElementById('einheit_groesse_toggle').setAttribute('aria-pressed', 'false');
      document.getElementById('einheit_groesse_settings').classList.remove('open');
      document.getElementById('koerner_pro_einheit').value = '';
      document.getElementById('einheit_groesse_saved').textContent = '';
      state.drillPriorities = {};
      renderTabs();
      saveState();
    }

    // confirmResetAll(fullReset) — Bestätigungsdialog, ruft resetActiveTab() oder resetAll()
    // fullReset=false → nur aktuellen Tab zurücksetzen
    // fullReset=true  → ALLE Daten zurücksetzen (alle Tabs, Einstellungen, machineLog)
    // Portiert aus Inline-Code Z. 3266-3276 (vor Phase 5 Inline-Entfernung).
    function confirmResetAll(fullReset) {
      var tabName = state.reiter[state.activeReiter].name;
      if (fullReset) {
        if (!confirm('Wirklich ALLE Daten zurücksetzen?\n\nAlle Tabs, Einträge und Einstellungen werden gelöscht.')) return;
        resetAll();
      } else {
        if (!confirm('Wirklich zurücksetzen?\n\nAlle Eingaben für "' + tabName + '" werden gelöscht.')) return;
        resetActiveTab();
      }
    }

    // --- Drill Protocol ---

    function drillAdd() {
      var einheitVal = document.getElementById('drill_einheit').value;
      var duengerVal = document.getElementById('drill_duenger').value;
      var einheit = parseDE(einheitVal) || 0;
      var duenger = parseDE(duengerVal) || 0;
      if (einheit <= 0 && duenger <= 0) return;
      var einheitPerHa = state.koernerProEinheit;
      if (state.einheitGroesseEnabled && state.koernerProEinheit !== 50000) einheitPerHa = state.koernerProEinheit;
      var targetHektar = 0;
      var activeTab = state.reiter[state.activeReiter];
      if (activeTab && activeTab.hektar > 0) targetHektar = activeTab.hektar;
      var totalNeed = 0;
      state.reiter.forEach(function(r, i) {
        if (r.hektar > 0 && r.koerner > 0) {
          var total = getTabTotalEinheiten(r);
          var used = getTabUsedEinheiten(r);
          var co = getCarryover(i);
          var remaining = total - used + co.savedEinheit - co.excessEinheit;
          if (remaining > 0.05) totalNeed += remaining;
        }
      });
      if (totalNeed <= 0) {
        var count = parseInt(document.getElementById('drill_einheit').value) || 1;
        for (var c = 0; c < count; c++) {
          var entry = {
            time: getTabNextTime(activeTab),
            mlIdx: -1,
            einheit: einheit, duenger: duenger,
            hektar: targetHektar, istHektar: 0,
            koerner: activeTab.koerner, duengerRate: activeTab.duenger
          };
          activeTab.entries.push(entry);
        }
      } else {
        var priorities = [];
        state.reiter.forEach(function(r, i) {
          if (r.hektar > 0 && r.koerner > 0) {
            var prio = state.drillPriorities[i] || 0;
            priorities.push({ idx: i, prio: prio, remaining: (function() {
              var total = getTabTotalEinheiten(state.reiter[i]);
              var used = getTabUsedEinheiten(state.reiter[i]);
              var co = getCarryover(i);
              return Math.max(0, total - used + co.savedEinheit - co.excessEinheit);
            })() });
          }
        });
        priorities.sort(function(a, b) {
          if (b.prio !== a.prio) return b.prio - a.prio;
          return a.remaining - b.remaining;
        });
        var remainingUnits = einheit;
        var remainingDuenger = duenger;
        var lastEntry = null;
        for (var pi = 0; pi < priorities.length && (remainingUnits > 0.05 || remainingDuenger > 0.05); pi++) {
          var tabIdx = priorities[pi].idx;
          var tab = state.reiter[tabIdx];
          var perUnit = (einheitPerHa / (tab.hektar || 1));
          var maxUnitsThisTab = remainingUnits / perUnit;
          var unitsForThisTab = Math.min(remainingUnits, maxUnitsThisTab);
          // kg Dünger pro Einheit Saatgut für diesen Tab.
          // Issue #230: ersetzt die alte, falsche Formel
          //   `tab.duenger / (tab.hektar || 1) * 50`
          // (Überbleibsel der "1 Einheit = 50 kg"-Annahme aus #186/#191).
          // Die neue Berechnung lebt in calculations.js/getDuengerProEinheit
          // und ist dimensionsrein (kg/Einheit) — kein tab.hektar im Zähler.
          var duengerPerUnit = getDuengerProEinheit(tab, state.koernerProEinheit);
          var duengerForThisTab = Math.min(remainingDuenger, duengerPerUnit * unitsForThisTab);
          var entry = {
            time: getTabNextTime(tab),
            mlIdx: -1,
            einheit: Math.round(unitsForThisTab * 100) / 100,
            duenger: Math.round(duengerForThisTab * 100) / 100,
            hektar: tab.hektar, istHektar: 0,
            koerner: tab.koerner, duengerRate: tab.duenger
          };
          tab.entries.push(entry);
          lastEntry = entry;
          remainingUnits -= unitsForThisTab;
          remainingDuenger -= duengerForThisTab;
          if (pi === priorities.length - 1 && (remainingUnits > 0.05 || remainingDuenger > 0.05)) {
            if (lastEntry) { lastEntry.einheit += remainingUnits; lastEntry.duenger += remainingDuenger; }
            remainingUnits = 0; remainingDuenger = 0;
          }
        }
      }
      document.getElementById('drill_einheit').value = '';
      document.getElementById('drill_duenger').value = '';
      document.getElementById('drill_hektar').value = '';
      appEmit('DRILL_ENTRY_ADDED', { tabIdx: state.activeReiter });
    }

    function drillRemove(tabIdx, entryIdx) {
      if (!state.reiter[tabIdx] || !state.reiter[tabIdx].entries) return;
      state.reiter[tabIdx].entries.splice(entryIdx, 1);
      appEmit('DRILL_ENTRY_REMOVED', { tabIdx: tabIdx, entryIdx: entryIdx });
    }

    function drillCalcAll() {
      renderDrillTabList();
      renderDrillSummary();
      renderResults();
    }

    function drillCalcDebounced() {
      clearTimeout(_internal.drillCalcTimer);
      _internal.drillCalcTimer = setTimeout(drillCalcAll, 150);
    }

    function drillMachineAdd() {
      var einheitVal = document.getElementById('drill_einheit').value;
      var duengerVal = document.getElementById('drill_duenger').value;
      var einheit = parseDE(einheitVal) || 0;
      var duenger = parseDE(duengerVal) || 0;
      var targetHektar = parseDE(document.getElementById('drill_hektar').value) || 0;
      if (einheit <= 0 && duenger <= 0) return;
      var activeTab = state.reiter[state.activeReiter];
      var entry = {
        time: Date.now(),
        mlIdx: state.machineLog.length,
        einheit: einheit,
        duenger: duenger,
        hektar: targetHektar > 0 ? targetHektar : (activeTab.hektar || 0),
        istHektar: 0,
        koerner: activeTab.koerner,
        duengerRate: activeTab.duenger,
        isMachineLog: true
      };
      state.machineLog.push(entry);
      var count = parseInt(document.getElementById('drill_einheit').value) || 1;
      for (var c = 0; c < count; c++) {
        var e = { time: Date.now() + c, mlIdx: state.machineLog.length - 1, einheit: einheit / count, duenger: duenger / count, hektar: targetHektar > 0 ? targetHektar : (activeTab.hektar || 0), istHektar: 0, koerner: activeTab.koerner, duengerRate: activeTab.duenger };
        activeTab.entries.push(e);
      }
      document.getElementById('drill_einheit').value = '';
      document.getElementById('drill_duenger').value = '';
      document.getElementById('drill_hektar').value = '';
      appEmit('DRILL_ENTRY_ADDED', { tabIdx: state.activeReiter });
    }

    function drillMachineRemove(idx) {
      if (!state.machineLog || idx < 0 || idx >= state.machineLog.length) return;
      state.machineLog.splice(idx, 1);
      state.reiter.forEach(function(r) {
        if (!r.entries) return;
        for (var i = r.entries.length - 1; i >= 0; i--) {
          if (r.entries[i].mlIdx === idx) r.entries.splice(i, 1);
          else if (r.entries[i].mlIdx > idx) r.entries[i].mlIdx--;
        }
      });
      appEmit('DRILL_ENTRY_REMOVED', { mlIdx: idx });
    }

    // --- Berechnung ---

    function berechne() {
      var r = getActiveReiter();
      if (!r) return;
      document.getElementById('err_hektar').textContent = '';
      document.getElementById('err_koerner').textContent = '';
      document.getElementById('hektar').style.borderColor = '';
      document.getElementById('koerner').style.borderColor = '';
      var err = null;
      if (!r.hektar && r.hektar !== 0) {
        err = 'Bitte Hektar eingeben';
      } else if (!r.koerner && r.koerner !== 0) {
        err = 'Bitte Körner/ha eingeben';
      }
      if (err) {
        document.getElementById('err_hektar').textContent = err;
        document.getElementById('hektar').style.borderColor = '#c00';
        return;
      }
      appEmit('CALCULATION_DONE', { tabIdx: state.activeReiter });
    }

    // --- Input Binding (reactive writes to state) ---

    function onInputHektar(el) {
      var r = getActiveReiter();
      var v = parseDE(el.value);
      if (r.hektar !== v) { r.hektar = v; appEmit('ENTRY_CHANGED'); }
    }

    function onInputIstHektar(el) {
      var r = getActiveReiter();
      var v = parseDE(el.value);
      if (r.istHektar !== v) { r.istHektar = v; appEmit('ENTRY_CHANGED'); }
    }

    function onInputKoerner(el) {
      var r = getActiveReiter();
      var v = parseDE(el.value);
      if (r.koerner !== v) { r.koerner = v; appEmit('ENTRY_CHANGED'); }
    }

    function onInputDuenger(el) {
      var r = getActiveReiter();
      var v = parseDE(el.value);
      if (r.duenger !== v) { r.duenger = v; appEmit('ENTRY_CHANGED'); }
    }

    // --- UI Wrappers (bridge: pure calculations → active tab context) ---
    // getTabKornerGesamt is in calculations.js; getActiveReiter is in ui-handlers.js
    function getKornerGesamt() {
      return getTabKornerGesamt(getActiveReiter());
    }

    // Issue #186: Diese Wrapper schließen die Lücke zwischen calculations.js
    // (das nur getTabTotalEinheiten(r) etc. exportiert) und render-results.js
    // (das getTotalEinheiten() ohne Argument aufruft).
    // WICHTIG: Andere Namen als in calculations.js, um die Funktion
    // getTotalEinheiten(r, koernerProEinheit) dort nicht zu überschreiben.
    function getActiveTotalEinheiten() {
      return getTabTotalEinheiten(getActiveReiter());
    }

    function getActiveTotalDuenger() {
      return getTabTotalDuenger(getActiveReiter());
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

    function getActiveReiter() {
      var r = state.reiter[state.activeReiter];
      if (!r) return state.reiter[0];
      if (!r.entries) r.entries = [];
      return r;
    }

    function syncStateFromInputs() {
      var r = getActiveReiter();
      r.hektar    = parseDE(document.getElementById('hektar').value) || 0;
      r.istHektar = parseDE(document.getElementById('ist_hektar').value) || 0;
      r.koerner   = parseDE(document.getElementById('koerner').value) || 0;
      r.duenger    = parseDE(document.getElementById('duenger').value) || 0;
    }

    function toInputValue(n) {
      return String(n).replace('.', ',');
    }

    function syncInputsFromState() {
      var r = getActiveReiter();
      var h = document.getElementById('hektar');
      var ih = document.getElementById('ist_hektar');
      var k = document.getElementById('koerner');
      var d = document.getElementById('duenger');
      var hVal = r.hektar > 0    ? toInputValue(r.hektar)    : '';
      var ihVal = r.istHektar > 0 ? toInputValue(r.istHektar) : '';
      var kVal = r.koerner > 0   ? toInputValue(r.koerner)   : '';
      var dVal = r.duenger > 0   ? toInputValue(r.duenger)   : '';
      h.value = hVal;  h.dataset.prev = hVal;  h.dataset.cleaned = hVal;
      ih.value = ihVal; ih.dataset.prev = ihVal; ih.dataset.cleaned = ihVal;
      k.value = kVal;  k.dataset.prev = kVal;  k.dataset.cleaned = kVal;
      d.value = dVal;  d.dataset.prev = dVal;  d.dataset.cleaned = dVal;
    }