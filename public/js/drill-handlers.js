// ============================================================================
// DRILL-HANDLERS — Drill-Einfüllung, Verteilung und Maschinen-Log
//
// Aus ui-handlers.js (Issue #416 Welle 5) in ein eigenes Modul extrahiert.
// Enthält:
//   - _parseDrillInputs, _resolvePerTabDistribution
//   - _buildDrillEntry, _pushEntryToTab, _buildMachineLogEntry
//   - _readActivePerTabValues, _clearDrillInputs
//   - drillAdd, drillRemove
//   - _calcDrillDistribution, _applyDrillPlan
//   - drillCalcAll, _syncActiveTabLock, drillCalcDebounced
//   - drillMachineRemove
//
// Lade-Reihenfolge (siehe index.html):
//   reset-handlers.js → drill-handlers.js → tab-handlers.js
//
// drill-handlers.js wird VOR tab-handlers.js geladen, damit dessen später
// aufgerufene Wechsel-Handler AppGlobals._syncActiveTabLock bereits vorfinden.
// Die klassischen Top-Level-Deklarationen
// bleiben für bestehende HTML-/Window-Nutzung (onclick="drillAdd()")
// erhalten; zusätzlich registriert Object.assign(window.AppGlobals, …)
// die bisherige AppGlobals-API.
//
// Das in protocol-handlers.js lebende Lokale Protokoll-Redesign
// (setProtocolView, toggleProtocolAccordion, requestLocalProtocolDelete,
// closeLocalProtocolSheet, confirmLocalProtocolDelete) greift defensiv
// über AppGlobals.drillRemove und AppGlobals.drillMachineRemove zu —
// diese werden beim Funktionsaufruf aufgelöst, nicht beim Laden des
// protocol-handlers.js.
//
// Braucht zur Laufzeit (AppGlobals):
//   - state, appEmit, parseDE, EPSILON_EINHEIT, EPSILON_QUANTITY
//     (state.js / calculations.js / main.js)
//   - computeFahrgassenFaktor, getTabTotalEinheiten, getTabUsedEinheiten,
//     resolveKoernerProEinheit, getTabNextTime, round6, fmt, fmtEinheit
//     (calculations.js)
//   - renderDrillTabList, renderDrillSummary, renderResults
//     (render-drill.js / render-results.js) — erst beim Nutzeraufruf
//     aufgelöst
//
// Verhaltensgleich zur ui-handlers.js-Variante (Issue #416 Welle 5 —
// reine lexikalische Konsolidierung, keine Logik- oder Rundungsänderungen).
// ============================================================================

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
        // Saat-Einheiten werden intern auf 6 Nachkommastellen begrenzt, damit
        // kleine Saat-Mengen (z. B. 0,004 E) nicht durch 2-Stellen-Rundung zu 0
        // werden. Dünger bleibt unabhängig davon auf 0,01 kg gerundet; seine
        // Verteilungsschwelle EPSILON_QUANTITY beträgt weiterhin 0,05 kg.
        einheit: AppGlobals.round6(unitsForThisTab),
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
          // Saat und Dünger nutzen getrennte Epsilon-Schwellen:
          // Saat: EPSILON_EINHEIT (0,0005) — kleine Saatmengen wie 0,040 E
          //       bleiben erhalten und werden auf priorisierte Schläge verteilt.
          // Dünger: EPSILON_QUANTITY (0,05 kg) — kg-Granularität bleibt stabil.
          if (remE <= AppGlobals.EPSILON_EINHEIT && remD <= AppGlobals.EPSILON_QUANTITY) break;
          if (remE > AppGlobals.EPSILON_EINHEIT) {
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
        // Leftover-Absorption im letzten priorisierten Reiter (Issue #266).
        // Saat-spezifische Schwelle, damit kleine Saat-Reste nicht verloren gehen.
        if (lastPrioIdx >= 0 && remE > AppGlobals.EPSILON_EINHEIT) {
          var lastPlan = plan[lastPrioIdx];
          var lastP = null;
          for (var lpf = 0; lpf < priorities.length; lpf++) {
            if (priorities[lpf].idx === lastPrioIdx) { lastP = priorities[lpf]; break; }
          }
          if (lastP && lastPlan.giveE < lastP.rem - AppGlobals.EPSILON_EINHEIT) {
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

    // Issue #447 Welle 2a — cycleDrillPriority(tabIdx) SSOT.
    //
    // Vorher lebte der Cycle (0 → 1 → N → 0) im Click-Handler in
    // render-drill.js, der gleichzeitig State mutierte UND das DOM
    // optimistisch aktualisierte UND appEmit rief. Das verletzte das
    // Architekturprinzip "Renderer mutieren keinen State".
    //
    // Diese Funktion ist die Single Source of Truth für den Cycle:
    //   1. Liest aktuellen Wert via hasOwnProperty (Key fehlt → 0,
    //      Key=0 → 0; danach next=1).
    //   2. next = current >= reiter.length ? 0 : current + 1.
    //   3. Setzt AppGlobals.state.drillPriorities[tabIdx] = next.
    //   4. Emittiert DRILL_PRIORITY_CHANGED mit {tabIdx, priority: next}.
    // Der Event-Plan ruft drillCalcAll (welcher intern renderDrillTabList
    // triggert) — der Renderer muss KEIN optimistisches DOM-Update mehr
    // machen, weil das DOM nach dem Re-Render bereits korrekt ist.
    //
    // Rückgabewert ist next (Convenience für direkte Aufrufer, z.B. Tests).
    function cycleDrillPriority(tabIdx) {
      var current = Object.prototype.hasOwnProperty.call(
        AppGlobals.state.drillPriorities, String(tabIdx)
      ) ? AppGlobals.state.drillPriorities[tabIdx] : 0;
      var maxPrio = AppGlobals.state.reiter.length;
      var next = current >= maxPrio ? 0 : current + 1;
      AppGlobals.state.drillPriorities[tabIdx] = next;
      AppGlobals.appEmit('DRILL_PRIORITY_CHANGED', { tabIdx: tabIdx, priority: next });
      return next;
    }

// Register exposed globals on AppGlobals (ADR-001 Schritt 3, Issue #278).
// Damit sind sie sowohl für bestehende HTML-/Window-Nutzung (onclick="drillAdd()")
// als auch für AppGlobals-Konsumenten (render-drill, render-results, Tests,
// lokales Protokoll in protocol-handlers.js) erreichbar.
Object.assign(window.AppGlobals, {
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
  drillCalcAll: drillCalcAll,
  _syncActiveTabLock: _syncActiveTabLock,
  drillCalcDebounced: drillCalcDebounced,
  drillMachineRemove: drillMachineRemove,
  cycleDrillPriority: cycleDrillPriority,
});
