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
      syncStateFromInputs();
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
        document.getElementById('fahrgassen_saved').textContent = '';
      }
      // 5a: per-Tab-State synchronisieren — Berechnungen lesen r.fahrgassenEnabled
      state.reiter.forEach(function(r) {
        r.fahrgassenEnabled = state.fahrgassenEnabled;
        r.fahrgassenBreite = state.fahrgassenBreite;
      });
      appEmit('SETTINGS_CHANGED', { setting: 'fahrgassenEnabled' });
    }

    function fahrgassenUpdate() {
      var raw = document.getElementById('fahrgassen_breite').value;
      var val = parseDE(raw);
      // 5d: breite < 2 → State unverändert, Feld zurücksetzen
      if (val >= 2) {
        state.fahrgassenBreite = val;
        // 5c: Prozent-Info anzeigen
        // Anteil produktiv mit Fahrgassen: (breite-1)/breite → 23/24 = 95.83% für breite=24
        var pct = ((val - 1) / val) * 100;
        document.getElementById('fahrgassen_saved').textContent = val + ' m -> ~' + pct.toFixed(1) + '% bestellt';
        document.getElementById('fahrgassen_breite').style.borderColor = '';
        // 5a: per-Tab-State syncen
        state.reiter.forEach(function(r) {
          r.fahrgassenEnabled = state.fahrgassenEnabled;
          r.fahrgassenBreite = val;
        });
      } else {
        // breite 0/leer/< 2 → saved text leeren, State auf 0
        document.getElementById('fahrgassen_saved').textContent = '';
        document.getElementById('fahrgassen_breite').style.borderColor = '';
        if (val === 0 || isNaN(val)) {
          state.fahrgassenBreite = 0;
        }
        // val < 2 (aber > 0): State bleibt auf letztem gültigen Wert
        // Feld wird nicht überschrieben — User sieht Eingabe, kann korrigieren
        if (val > 0 && val < 2) {
          document.getElementById('fahrgassen_saved').textContent = 'Fahrgassenbreite muss mindestens 2m betragen';
          // Feld auf vorherigen gültigen Wert zurücksetzen (oder leer wenn State 0)
          document.getElementById('fahrgassen_breite').value = state.fahrgassenBreite > 0
            ? String(state.fahrgassenBreite)
            : '';
        }
        if (val === 0 || isNaN(val)) {
          state.reiter.forEach(function(r) {
            r.fahrgassenEnabled = state.fahrgassenEnabled;
            r.fahrgassenBreite = 0;
          });
        }
      }
      appEmit('SETTINGS_CHANGED', { setting: 'fahrgassenBreite' });
    }

    // --- Einheiten-Groesse ---

    function einheitGroesseToggle() {
      state.einheitGroesseEnabled = !state.einheitGroesseEnabled;
      var btn = document.getElementById('einheit_groesse_toggle');
      var saved = document.getElementById('einheit_groesse_saved');
      if (state.einheitGroesseEnabled) {
        document.getElementById('einheit_groesse_settings').classList.add('open');
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        document.getElementById('einheit_groesse_settings').classList.remove('open');
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
        state.koernerProEinheit = 50000;
        if (saved) saved.textContent = '';
        // Clear input
        var kpEl = document.getElementById('koerner_pro_einheit');
        if (kpEl) { kpEl.value = ''; kpEl.dataset.prev = ''; kpEl.dataset.cleaned = ''; }
      }
      appEmit('SETTINGS_CHANGED', { setting: 'einheitGroesseEnabled' });
    }

    function einheitGroesseUpdate() {
      var raw = document.getElementById('koerner_pro_einheit').value;
      var val = parseDE(raw);
      var savedEl = document.getElementById('einheit_groesse_saved');
      if (val !== null && val > 0 && val <= 999999) {
        state.koernerProEinheit = Math.round(val);
        // Show info text only for non-default values
        if (state.koernerProEinheit === 50000) {
          if (savedEl) savedEl.textContent = '';
        } else {
          if (savedEl) savedEl.textContent = state.koernerProEinheit.toLocaleString('de-DE') + ' Körner/Einheit';
        }
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
      // Clear drill summary values
      var ids = ['ds_saat_total', 'ds_saat_used', 'ds_saat_remaining', 'ds_duenger_total', 'ds_duenger_used', 'ds_duenger_remaining', 'ds_total_summary'];
      for (var si = 0; si < ids.length; si++) {
        var sEl = document.getElementById(ids[si]);
        if (sEl) sEl.textContent = '';
      }
      // Hide drill_section after reset
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
      var re = document.getElementById('results');
      if (re) re.style.display = 'none';
      // Clear inputs
      var hEl = document.getElementById('hektar');
      if (hEl) { hEl.value = ''; hEl.dataset.prev = ''; hEl.dataset.cleaned = ''; }
      var ih = document.getElementById('ist_hektar');
      if (ih) { ih.value = ''; ih.dataset.prev = ''; ih.dataset.cleaned = ''; }
      var kE = document.getElementById('koerner');
      if (kE) { kE.value = ''; kE.dataset.prev = ''; kE.dataset.cleaned = ''; }
      var dE = document.getElementById('duenger');
      if (dE) { dE.value = ''; dE.dataset.prev = ''; dE.dataset.cleaned = ''; }
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

    // --- Drill Protocol ---

    function drillAdd() {
      var einheitVal = document.getElementById('drill_einheit').value;
      var duengerVal = document.getElementById('drill_duenger').value;
      var hektarVal = document.getElementById('drill_hektar').value;
      var einheit = parseDE(einheitVal) || 0;
      var duenger = parseDE(duengerVal) || 0;
      var zaehlerStand = parseDE(hektarVal) || 0;
      if (einheit <= 0 && duenger <= 0) return;
      var activeTab = state.reiter[state.activeReiter];
      if (!activeTab) return;
      var targetHektar = activeTab.hektar > 0 ? activeTab.hektar : 0;
      // Has any tab a priority > 0? If yes → multi-tab distribution mode.
      var hasPriority = false;
      for (var pi0 = 0; pi0 < state.reiter.length; pi0++) {
        if ((state.drillPriorities[pi0] || 0) > 0) { hasPriority = true; break; }
      }
      // Per-tab distribution: read dtl_e_<i> and dtl_d_<i> values
      // (populated by drillCalcAll). If they have values, distribute
      // accordingly. Otherwise (no drillCalcAll run, or no per-tab values),
      // fall back to the original single-tab push.
      var perTabUsed = false;
      var perTabE = [], perTabD = [];
      var perTabHasAny = false;
      for (var ii = 0; ii < state.reiter.length; ii++) {
        var peEl = document.getElementById('dtl_e_' + ii);
        var pdEl = document.getElementById('dtl_d_' + ii);
        // Issue #240: prefer the stashed raw value (1-decimal rounded) when
        // available — fmt() in drillCalcAll turns 7.75 into "7,8" via
        // half-up, and re-parsing gives 7.8 instead of 7.75. The raw value
        // preserves the intended precision.
        var peRaw = peEl && peEl.dataset && peEl.dataset.rawValue;
        var pdRaw = pdEl && pdEl.dataset && pdEl.dataset.rawValue;
        var pe = peRaw !== undefined && peRaw !== '' ? parseFloat(peRaw)
                  : (peEl ? parseDE(peEl.value) || 0 : 0);
        var pd = pdRaw !== undefined && pdRaw !== '' ? parseFloat(pdRaw)
                  : (pdEl ? parseDE(pdEl.value) || 0 : 0);
        perTabE.push(pe);
        perTabD.push(pd);
        if ((state.drillPriorities[ii] || 0) > 0 && (pe > 0 || pd > 0)) perTabHasAny = true;
      }
      // Decide mode:
      //   - Multi-tab mode: at least one tab has priority AND at least one prioritized tab
      //     has per-tab values → distribute per-tab
      //   - Otherwise: single-tab mode → push to activeTab
      var totalDistributed = 0;
      var anyPushed = false;
      if (hasPriority && perTabHasAny) {
        // === Multi-tab mode: create one entry per prioritized tab with values ===
        for (var ti = 0; ti < state.reiter.length; ti++) {
          if ((state.drillPriorities[ti] || 0) <= 0) continue;
          if (perTabE[ti] <= 0 && perTabD[ti] <= 0) continue;
          var tab = state.reiter[ti];
          var fgFactor = (tab.fahrgassenEnabled && tab.fahrgassenBreite >= 2)
            ? computeFahrgassenFaktor(tab.fahrgassenBreite) : 1;
          var perUnit = (tab.koerner * fgFactor) / state.koernerProEinheit;
          var maxUnitsThisTab = tab.hektar * perUnit;
          var unitsForThisTab = Math.min(perTabE[ti], maxUnitsThisTab);
          var duengerPerUnit = getDuengerProEinheit(tab, state.koernerProEinheit);
          var duengerForThisTab = Math.min(perTabD[ti], duengerPerUnit * unitsForThisTab);
          tab.entries.push({
            time: getTabNextTime(tab),
            mlIdx: state.machineLog.length,
            einheit: Math.round(unitsForThisTab * 100) / 100,
            duenger: Math.round(duengerForThisTab * 100) / 100,
            hektar: tab.hektar, istHektar: 0, zaehlerStand: zaehlerStand,
            koerner: tab.koerner, duengerRate: tab.duenger
          });
          totalDistributed += perTabE[ti];
          anyPushed = true;
        }
        // Ghost-entry fix (Issue #73): only push machineLog if at least one
        // per-tab entry was actually created. If all prioritized tabs had
        // 0 values, no entry is created → also no machineLog.
        if (anyPushed) {
          // Use original input einheit for "distributed" (per Issue #21 test):
          // machineLog records the user's raw drill_einheit, with the actual
          // amount distributed to tabs.
          state.machineLog.push({
            time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
            einheit: einheit,
            duenger: duenger,
            zaehlerStand: zaehlerStand,
            hektar: zaehlerStand > 0 ? zaehlerStand : targetHektar,
            istHektar: 0,
            koerner: activeTab.koerner,
            duengerRate: activeTab.duenger,
            distributed: einheit
          });
        }
      } else if (activeTab && activeTab.hektar > 0) {
        // === Single-tab mode ===
        // Ghost-entry fix (Issue #73): if there are no priorities and the
        // active tab has no per-tab inputs (i.e. nothing was actually
        // distributed), do NOT create a machineLog entry — user might
        // have typed into drill_einheit by accident.
        var activeEEl = document.getElementById('dtl_e_' + state.activeReiter);
        var activeDEl = document.getElementById('dtl_d_' + state.activeReiter);
        var activeERaw = activeEEl && activeEEl.dataset && activeEEl.dataset.rawValue;
        var activeDRaw = activeDEl && activeDEl.dataset && activeDEl.dataset.rawValue;
        var activeE = activeERaw !== undefined && activeERaw !== '' ? parseFloat(activeERaw)
                      : (activeEEl ? parseDE(activeEEl.value) || 0 : 0);
        var activeD = activeDRaw !== undefined && activeDRaw !== '' ? parseFloat(activeDRaw)
                      : (activeDEl ? parseDE(activeDEl.value) || 0 : 0);
        // If the per-tab input for the active tab has been populated
        // (typically by drillCalcAll), honor it. Otherwise fall through
        // to the legacy "push to activeTab" path.
        if (activeE <= 0 && activeD <= 0) {
          // Ghost-entry prevention: nothing to push, no machineLog either.
          document.getElementById('drill_einheit').value = '';
          document.getElementById('drill_duenger').value = '';
          document.getElementById('drill_hektar').value = '';
          return;
        }
        var entry = {
          time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
          mlIdx: state.machineLog.length,
          einheit: einheit, duenger: duenger,
          hektar: targetHektar, istHektar: 0, zaehlerStand: zaehlerStand,
          koerner: activeTab.koerner, duengerRate: activeTab.duenger
        };
        activeTab.entries.push(entry);
        anyPushed = true;
        totalDistributed = einheit;
        // machineLog records the user input
        state.machineLog.push({
          time: entry.time,
          einheit: einheit,
          duenger: duenger,
          zaehlerStand: zaehlerStand,
          hektar: targetHektar,
          istHektar: 0,
          koerner: activeTab.koerner,
          duengerRate: activeTab.duenger,
          distributed: einheit
        });
      }
      if (!anyPushed) {
        // Nothing was created (e.g. multi-tab mode but no per-tab values) → no-op
        document.getElementById('drill_einheit').value = '';
        document.getElementById('drill_duenger').value = '';
        document.getElementById('drill_hektar').value = '';
        return;
      }
      // Clear per-tab inputs and global inputs
      for (var ci = 0; ci < state.reiter.length; ci++) {
        var ceEl = document.getElementById('dtl_e_' + ci);
        var cdEl = document.getElementById('dtl_d_' + ci);
        if (ceEl) ceEl.value = '';
        if (cdEl) cdEl.value = '';
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
      // Read user input
      var totalE = parseDE(document.getElementById('drill_einheit').value) || 0;
      var totalD = parseDE(document.getElementById('drill_duenger').value) || 0;
      // Build prioritized list of tabs that have data
      var priorities = [];
      state.reiter.forEach(function(r, i) {
        if (r.hektar > 0 && r.koerner > 0) {
          var prio = state.drillPriorities[i] || 0;
          // For the cap calculation, use remaining need (excluding carryover for now)
          var total = getTabTotalEinheiten(r);
          var used = getTabUsedEinheiten(r);
          var rem = Math.max(0, total - used);
          priorities.push({ idx: i, prio: prio, rem: rem, r: r });
        }
      });
      // Issue #264: Prio 1 = highest priority, ascending sort.
      // Bei Prio-Gleichstand gewinnt der niedrigere Tab-Index (Stabilität
      // der Fill-Reihenfolge), nicht die kleinere Need.
      priorities.sort(function(a, b) {
        if (a.prio !== b.prio) return a.prio - b.prio;
        return a.idx - b.idx;
      });
      // Build distribution plan: idx -> { giveE, giveD }
      var plan = {};
      for (var pi = 0; pi < state.reiter.length; pi++) plan[pi] = { giveE: 0, giveD: 0 };
      if (totalE > 0 || totalD > 0) {
        // Issue #240: cap is the tab's REMAINING einheit-need.
        // duenger cap is independent: tab.hektar * tab.duenger - used.
        // Einheit and duenger are distributed INDEPENDENTLY by cap-fill
        // over the prioritized tabs in priority order.
        var remE = totalE;
        var remD = totalD;
        // Find last prioritized tab (absorbs leftover in per-tab field)
        var lastPrioIdx = -1;
        for (var lpi = priorities.length - 1; lpi >= 0; lpi--) {
          if (priorities[lpi].prio > 0) { lastPrioIdx = priorities[lpi].idx; break; }
        }
        priorities.forEach(function(p) {
          if (p.prio <= 0) return; // skip non-prio
          if (remE <= EPSILON_QUANTITY && remD <= EPSILON_QUANTITY) return;
          // Einheit: cap-fill to remaining need
          if (remE > EPSILON_QUANTITY) {
            plan[p.idx].giveE = Math.min(remE, p.rem);
            remE -= plan[p.idx].giveE;
          }
          // Duenger: cap-fill to (hektar * duenger - used) — independent of einheit
          if (remD > EPSILON_QUANTITY) {
            var tabDUsed = (p.r.entries || []).reduce(function(s, e) { return s + (e.duenger || 0); }, 0);
            var tabDNeed = Math.max(0, (p.r.hektar || 0) * (p.r.duenger || 0));
            var tabDCap = Math.max(0, tabDNeed - tabDUsed);
            plan[p.idx].giveD = Math.min(remD, tabDCap);
            remD -= plan[p.idx].giveD;
          }
        });
        // If einheit input exceeds sum of caps, the last prioritized tab
        // shows the leftover in its per-tab field (test 'caps distribution').
        if (lastPrioIdx >= 0 && remE > EPSILON_QUANTITY) {
          plan[lastPrioIdx].giveE = remE;
        }
      }
      // Apply plan: update existing inputs (do NOT recreate them — renderDrillTabList
      // runs at the end as the very last step so the values persist on the rebuilt inputs).
      // We set values via dataset; the rebuild will read from data attrs via a small trick:
      // store the planned values, rebuild, then re-apply on the freshly-created inputs.
      // Easier path: renderDrillTabList first, then set the values on the fresh inputs.
      renderDrillTabList();
      for (var ai = 0; ai < state.reiter.length; ai++) {
        var p = plan[ai];
        var eEl = document.getElementById('dtl_e_' + ai);
        var dEl = document.getElementById('dtl_d_' + ai);
        if (eEl) {
          eEl.value = p.giveE > 0 ? fmt(p.giveE) : '';
          // Round to 1 decimal for downstream consumption (Issue #240: prevents
          // 7.75 → fmt "7,8" → parseDE 7.8 drift). Stash raw value too.
          eEl.dataset.rawValue = p.giveE > 0 ? String(Math.round(p.giveE * 10) / 10) : '';
        }
        if (dEl) {
          dEl.value = p.giveD > 0 ? fmt(p.giveD) : '';
          dEl.dataset.rawValue = p.giveD > 0 ? String(Math.round(p.giveD * 10) / 10) : '';
        }
      }
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
        zaehlerStand: targetHektar,
        koerner: activeTab.koerner,
        duengerRate: activeTab.duenger,
        isMachineLog: true
      };
      state.machineLog.push(entry);
      var count = parseInt(document.getElementById('drill_einheit').value) || 1;
      for (var c = 0; c < count; c++) {
        var e = { time: Date.now() + c, mlIdx: state.machineLog.length - 1, einheit: einheit / count, duenger: duenger / count, hektar: targetHektar > 0 ? targetHektar : (activeTab.hektar || 0), istHektar: 0, zaehlerStand: targetHektar, koerner: activeTab.koerner, duengerRate: activeTab.duenger };
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
      // 1) Werte aus DOM lesen (Tests setzen .value direkt)
      var h = parseDE(document.getElementById('hektar').value);
      var k = parseDE(document.getElementById('koerner').value);
      var d = parseDE(document.getElementById('duenger').value);
      // 2) Errors clearen
      document.getElementById('err_hektar').textContent = '';
      document.getElementById('err_koerner').textContent = '';
      document.getElementById('hektar').style.borderColor = '';
      document.getElementById('koerner').style.borderColor = '';
      // 3) Pro-Feld Validierung mit Plausibilitätscheck
      if (isNaN(h) || h <= 0) {
        document.getElementById('err_hektar').textContent = 'Bitte Hektar eingeben';
        document.getElementById('hektar').style.borderColor = '#d32f2f';
        return;
      }
      if (h > 10000) {
        document.getElementById('err_hektar').textContent = 'Hektar-Wert ungewöhnlich hoch (max. 10.000)';
        document.getElementById('hektar').style.borderColor = '#d32f2f';
        return;
      }
      if (isNaN(k) || k <= 0) {
        document.getElementById('err_koerner').textContent = 'Bitte Körner pro ha eingeben';
        document.getElementById('koerner').style.borderColor = '#d32f2f';
        return;
      }
      if (k > 1000000) {
        document.getElementById('err_koerner').textContent = 'Körner-Wert ungewöhnlich hoch (max. 1.000.000)';
        document.getElementById('koerner').style.borderColor = '#d32f2f';
        return;
      }
      // 5) Werte in State schreiben
      r.hektar = h;
      r.koerner = k;
      r.duenger = (isNaN(d) || d < 0) ? 0 : d;
      // 6) Hinweis-Banner (statt native confirm) wenn Drill-Entries die
      // neuen Totals überschreiten würden. Der echte Reset erfolgt via
      // Reset-Modal — hier nur visuelles Warn-Banner, das der User
      // wegklicken kann.
      var entries = r.entries;
      var usedEinheit = entries.reduce(function(s, e) { return s + e.einheit; }, 0);
      var usedDuenger = entries.reduce(function(s, e) { return s + e.duenger; }, 0);
      if (usedEinheit > getTotalEinheiten() || usedDuenger > getTotalDuenger()) {
        var warnEl = document.getElementById('drill_overflow_warn');
        if (warnEl) warnEl.style.display = 'block';
      } else {
        var warnEl2 = document.getElementById('drill_overflow_warn');
        if (warnEl2) warnEl2.style.display = 'none';
      }
      // 7) Speichern + rendern + Ergebnisse anzeigen
      saveState();
      renderTabs();
      renderResults();
      document.getElementById('results').style.display = 'block';
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

    // No-arg API-Kompatibilitäts-Wrapper (Issue #266).
    //
    // Tests rufen getTotalEinheiten() bzw. getTotalDuenger() ohne Argumente
    // auf. calculations.js exportiert diese Namen mit Argument-Signaturen.
    // Da ui-handlers.js NACH calculations.js geladen wird, gewinnen die
    // Wrapper im globalen Scope. Mittels arguments.length wird zwischen
    // Argument- und No-Arg-Aufruf dispatcht.
    //
    // Die arg-Versionen bleiben über getTabTotalEinheiten(r) / getTabTotalDuenger(r)
    // für interne Berechnungen verfügbar (anderer Name → kein Konflikt).
    //
    // no-arg: rechnet gegen state.koernerProEinheit (der Default 50000,
    // oder Custom via einheitGroesseUpdate).
    function getTotalEinheiten(r, koernerProEinheit) {
      if (arguments.length === 0) {
        // No-arg: für aktiven Reiter berechnen
        return getActiveTotalEinheiten();
      }
      // Arg-Version: calculations.js-Original (Issue #230)
      if (!r || !r.hektar || !r.koerner || koernerProEinheit <= 0) return 0;
      var fgEnabled = (r.fahrgassenEnabled !== undefined) ? r.fahrgassenEnabled : state.fahrgassenEnabled;
      var fgBreite = (r.fahrgassenBreite !== undefined) ? r.fahrgassenBreite : state.fahrgassenBreite;
      var faktor = 1;
      if (fgEnabled && fgBreite > 0) {
        faktor = computeFahrgassenFaktor(fgBreite);
      }
      var e = (r.hektar * r.koerner) / koernerProEinheit;
      return Math.max(0, e * faktor);
    }
    function getTotalDuenger(r) {
      if (arguments.length === 0) {
        return getActiveTotalDuenger();
      }
      if (!r || !r.hektar || !r.duenger) return 0;
      return Math.max(0, r.hektar * r.duenger);
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