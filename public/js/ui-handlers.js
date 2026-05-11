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
      if (state.activeReiter >= state.reiter.length) state.activeReiter = state.reiter.length - 1;
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
      if (state.fahrgassenEnabled) {
        document.getElementById('fahrgassen_settings').classList.add('open');
        document.getElementById('fahrgassen_toggle').classList.add('active');
      } else {
        document.getElementById('fahrgassen_settings').classList.remove('open');
        document.getElementById('fahrgassen_toggle').classList.remove('active');
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
      if (state.einheitGroesseEnabled) {
        document.getElementById('einheit_groesse_settings').classList.add('open');
        document.getElementById('einheit_groesse_toggle').classList.add('active');
      } else {
        document.getElementById('einheit_groesse_settings').classList.remove('open');
        document.getElementById('einheit_groesse_toggle').classList.remove('active');
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
      document.getElementById('fahrgassen_settings').classList.remove('open');
      document.getElementById('fahrgassen_breite').value = '';
      document.getElementById('fahrgassen_saved').textContent = '';
      document.getElementById('einheit_groesse_toggle').classList.remove('active');
      document.getElementById('einheit_groesse_settings').classList.remove('open');
      document.getElementById('koerner_pro_einheit').value = '';
      document.getElementById('einheit_groesse_saved').textContent = '';
      state.drillPriorities = {};
      renderTabs();
      saveState();
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
          var duengerPerUnit = tab.duenger > 0 ? (tab.duenger / (tab.hektar || 1) * 50) : 0;
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
      invalidateCarryoverCache();
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