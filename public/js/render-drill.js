// ============================================================================
// RENDER-DRILL — Drill-Protokoll-Ansicht
//
// Lade-Reihenfolge: state → calc → ui → render-tabs → render-results → render-drill (DIESE DATEI)
//   → render-dashboard → main.js
//
// render-drill.js braucht: state, ui-handlers.js (drillRemove, drillCalcDebounced),
//   calculations.js (getTabIstHektar, getTabTotalEinheiten, getTabIstEinheiten,
//   getActiveTotalEinheiten, getActiveTotalDuenger, getTabTotalDuenger,
//   getTabIstDuenger, getCarryover, fmt)
// Funktionen werden im globalen Scope definiert (Vanilla-JS / <script>-Tags).
// ============================================================================

    // --- Render: Drill Tab List ---

    function renderDrillTabList() {
      var container = document.getElementById('drill_tab_list');
      if (!container) return;
      container.innerHTML = '';
      AppGlobals.state.reiter.forEach(function(r, i) {
        var row = document.createElement('div');
        row.className = 'drill-tab-row';
        var prioBtn = document.createElement('button');
        prioBtn.className = 'drill-prio-btn';
        prioBtn.id = 'dtl_prio_' + i;
        var initPrio = Object.prototype.hasOwnProperty.call(AppGlobals.state.drillPriorities, String(i)) ? AppGlobals.state.drillPriorities[i] : 0;
        prioBtn.textContent = initPrio === 0 ? '—' : String(initPrio);
        prioBtn.setAttribute('data-prio', String(initPrio));
        prioBtn.classList.toggle('active', initPrio > 0);
        prioBtn.onclick = function() {
          var current = parseInt(prioBtn.getAttribute('data-prio')) || 0;
          var maxPrio = AppGlobals.state.reiter.length;
          var next = current >= maxPrio ? 0 : current + 1;
          prioBtn.setAttribute('data-prio', String(next));
          prioBtn.textContent = next === 0 ? '—' : String(next);
          prioBtn.classList.toggle('active', next > 0);
          AppGlobals.state.drillPriorities[i] = next;
          AppGlobals.saveState();
          AppGlobals.drillCalcAll();
        };
        row.appendChild(prioBtn);
        var nameWrap = document.createElement('div');
        nameWrap.className = 'drill-tab-name-wrap';
        var label = document.createElement('div');
        label.className = 'drill-tab-name';
        label.textContent = r.name || ('Tab ' + (i + 1));
        nameWrap.appendChild(label);
        if (r.hektar > 0 && r.koerner > 0) {
          var istSum = AppGlobals.getTabIstHektar(r);
          var totalE = istSum > 0 ? AppGlobals.getTabIstEinheiten(r) : AppGlobals.getTabTotalEinheiten(r);
          var usedE = r.entries.reduce(function(s, e) { return s + e.einheit; }, 0);
          var totalD = istSum > 0 ? AppGlobals.getTabIstDuenger(r) : AppGlobals.getTabTotalDuenger(r);
          var usedD = r.entries.reduce(function(s, e) { return s + e.duenger; }, 0);
          var co = AppGlobals.getCarryover(i);
          var remaining = totalE - usedE;
          var remainingD = totalD - usedD;
          var statusEl = document.createElement('div');
          statusEl.id = 'dtl_need_' + i;
          statusEl.className = 'drill-tab-need';
          if (remaining <= 0.05 && remainingD <= 0.05) {
            statusEl.textContent = '✓ fertig';
            statusEl.classList.add('done');
          } else if (remainingD <= 0.05) {
            // Nur Saatgut übrig — Dünger-Anteil weglassen (Issue #266)
            statusEl.textContent = 'braucht ' + AppGlobals.fmt(Math.max(0, remaining)) + ' Einheiten';
          } else if (remaining <= 0.05) {
            // Nur Dünger übrig (seltener Fall, abgedeckt für Vollständigkeit)
            statusEl.textContent = 'braucht ' + AppGlobals.fmt(Math.max(0, remainingD)) + ' kg Dünger';
          } else {
            statusEl.textContent = 'braucht ' + AppGlobals.fmt(Math.max(0, remaining)) + ' Einheiten, ' + AppGlobals.fmt(Math.max(0, remainingD)) + ' kg Dünger';
          }
          nameWrap.appendChild(statusEl);
        }
        row.appendChild(nameWrap);
        var einheitIn = document.createElement('input');
        einheitIn.type = 'text';
        einheitIn.inputMode = 'decimal';
        einheitIn.id = 'dtl_e_' + i;
        einheitIn.placeholder = 'Einheiten';
        einheitIn.dataset.tabIdx = String(i);
        einheitIn.oninput = function() {
          AppGlobals.drillCalcDebounced();
        };
        row.appendChild(einheitIn);
        var duengerIn = document.createElement('input');
        duengerIn.type = 'text';
        duengerIn.inputMode = 'decimal';
        duengerIn.id = 'dtl_d_' + i;
        duengerIn.placeholder = 'kg Dünger';
        duengerIn.dataset.tabIdx = String(i);
        duengerIn.oninput = function() {
          AppGlobals.drillCalcDebounced();
        };
        row.appendChild(duengerIn);
        container.appendChild(row);
      });
    }

    // --- Render: Drill Summary ---

    function renderDrillSummary() {
      // Issue #multi-tab-agg (T1): aggregate SOLL/IST/used/remaining across
      // ALL tabs in state.reiter, not just getActiveReiter(). Per-tab IST
      // takes precedence over SOLL (Issue #186) independently for each tab.
      // Same fg-factor-aware helpers as renderDrillLog (#273) so display and
      // carryover source share one formula.
      // Issue #302: 'verbleibend' nets cross-tab in TWO phases:
      //   Phase A (loop body): collect per-tab needE/needD and sum
      //                        cco.saved*/cco.excess* across all tabs.
      //   Phase B (after loop): rem = max(0, TotalNeed - TotalSaved + TotalExcess).
      // Mathematically equivalent to summing per-tab max(0, need - saved + excess)
      // given carryover's invariants (saved_t ≤ need_t, excess_t ≤ need_t-saved_t),
      // but expressed globally so the summary reflects cross-tab netting without
      // per-tab side effects (Issue #302: previously per-tab applied excess as +need).
      //
      // NOTE: Drill-Summary and Dashboard show DELIBERATELY DIFFERENT views:
      //   - Dashboard (render-dashboard.js:61) = realer Stand WITHOUT carryover
      //     ("wie viel wurde tatsächlich auf den Acker gebracht?")
      //   - Drill-Summary (here)            = Need-after-distribution WITH
      //     carryover ("wie viel Saatgut/Dünger ist nach Verteilung + Savings-
      //     Umverteilung noch offen?").
      // Beide Perspektiven sind absichtlich — keine Bug-Doppelung.
      var allTabs = AppGlobals.state.reiter || [];
      var totalEinheiten = 0;   // sum of per-tab SOLL or IST (whichever applies)
      var totalDuenger = 0;
      var usedEinheit = 0;
      var usedDuenger = 0;
      // Issue #302: 'verbleibend' must net cross-tab. Phase A collects per-tab
      // need inside the loop; Phase B (after the loop) sums carryover and applies
      // rem = max(0, TotalNeed - TotalSaved + TotalExcess) once, globally.
      // Same fg-factor-aware helpers as renderDrillLog (#273) so display and
      // carryover source share one formula.
      var totalNeedE = 0;
      var totalNeedD = 0;
      var totalSavedE = 0;
      var totalSavedD = 0;
      var totalExcessE = 0;
      var totalExcessD = 0;
      for (var ti = 0; ti < allTabs.length; ti++) {
        var rt = allTabs[ti];
        if (!rt) continue;
        var tIstHa = AppGlobals.getTabIstHektar(rt);
        var tEinheiten = tIstHa > 0 ? AppGlobals.getTabIstEinheiten(rt) : AppGlobals.getTabTotalEinheiten(rt);
        var tDuenger = tIstHa > 0 ? AppGlobals.getTabIstDuenger(rt) : AppGlobals.getTabTotalDuenger(rt);
        totalEinheiten += tEinheiten;
        totalDuenger += tDuenger;
        var tUsedE = 0;
        var tUsedD = 0;
        if (rt.entries && rt.entries.length) {
          for (var ei = 0; ei < rt.entries.length; ei++) {
            tUsedE += (rt.entries[ei].einheit || 0);
            tUsedD += (rt.entries[ei].duenger || 0);
          }
        }
        usedEinheit += tUsedE;
        usedDuenger += tUsedD;
        // Phase A: per-tab need for this summary. Carryover (saved/excess)
        // is summed across all tabs in Phase B below — NOT applied per tab
        // (Issue #302). getCarryover(ti) returns this tab's share of the
        // global carryover pool; summing across tabs gives the totals the
        // formula needs.
        var cco = AppGlobals.getCarryover(ti);
        var needE = Math.max(0, tEinheiten - tUsedE);
        var needD = Math.max(0, tDuenger - tUsedD);
        totalNeedE += needE;
        totalNeedD += needD;
        totalSavedE += cco.savedEinheit;
        totalSavedD += cco.savedDuenger;
        totalExcessE += cco.excessEinheit;
        totalExcessD += cco.excessDuenger;
      }
      // Phase B: cross-tab netting. Mathematically equivalent to summing
      // per-tab max(0, need - saved + excess) given carryover's invariants
      // (saved_t ≤ need_t, excess_t ≤ need_t - saved_t), but expressed as
      // a single global formula per Issue #302 spec.
      var remEinheit = Math.max(0, totalNeedE - totalSavedE + totalExcessE);
      var remDuenger = Math.max(0, totalNeedD - totalSavedD + totalExcessD);
      var dsSollE = document.getElementById('ds_saat_total');
      if (dsSollE) dsSollE.textContent = AppGlobals.formatEinheit(totalEinheiten);
      var dsUsedE = document.getElementById('ds_saat_used');
      if (dsUsedE) dsUsedE.textContent = AppGlobals.formatEinheit(usedEinheit);
      var dsRemE = document.getElementById('ds_saat_remaining');
      if (dsRemE) dsRemE.textContent = AppGlobals.formatEinheit(remEinheit);
      var dsSollD = document.getElementById('ds_duenger_total');
      if (dsSollD) dsSollD.textContent = totalDuenger > 0 ? totalDuenger.toLocaleString('de-DE') + ' kg' : '—';
      var dsUsedD = document.getElementById('ds_duenger_used');
      if (dsUsedD) dsUsedD.textContent = usedDuenger > 0 ? usedDuenger.toLocaleString('de-DE') + ' kg' : '—';
      var dsRemD = document.getElementById('ds_duenger_remaining');
      if (dsRemD) dsRemD.textContent = remDuenger > 0 ? remDuenger.toLocaleString('de-DE') + ' kg' : '0 kg';
      // Issue #266-B2: IST<SOLL savings in #ds_savings (aggregated across all
      // tabs that are savings sources). Issue #273: apply fahrgassenFaktor via
      // getTabTotalEinheiten/getTabIstEinheiten so display matches carryover.
      var dsSav = document.getElementById('ds_savings');
      if (dsSav) {
        var savETotal = 0;
        var savDTotal = 0;
        var anySavings = false;
        for (var si = 0; si < allTabs.length; si++) {
          var sr = allTabs[si];
          if (!sr) continue;
          var srIstHa = AppGlobals.getTabIstHektar(sr);
          if (srIstHa > 0 && sr.hektar > srIstHa) {
            anySavings = true;
            savETotal += AppGlobals.getTabTotalEinheiten(sr) - AppGlobals.getTabIstEinheiten(sr);
            savDTotal += (sr.hektar - srIstHa) * (sr.duenger || 0);
          }
        }
        if (anySavings) {
          var savParts = [];
          if (savETotal > 0.05) savParts.push(AppGlobals.fmt(savETotal) + ' Einheiten Saatgut');
          if (savDTotal > 0.05) savParts.push(savDTotal.toLocaleString('de-DE') + ' kg Dünger');
          if (savParts.length > 0) {
            dsSav.textContent = 'Ersparnis: ' + savParts.join(', ');
            dsSav.style.display = 'block';
          } else {
            dsSav.textContent = '';
            dsSav.style.display = 'none';
          }
        } else {
          dsSav.textContent = '';
          dsSav.style.display = 'none';
        }
      }
    }

    // --- Render: Drill Log ---

    function renderDrillLog() {
      var container = document.getElementById('drill_entries');
      if (!container) return;
      container.innerHTML = '';
      var totalSummary = document.getElementById('ds_total_summary');
      // Issue #266-B2: Per-tab carryover/savings/excess divs at the top.
      // Shown for ALL tabs that have any carryover signal (savings source,
      // excess source, or carryover received from other tabs). Tests assert
      // these classes on the #drill_entries container.
      for (var ci = 0; ci < AppGlobals.state.reiter.length; ci++) {
        var ct = AppGlobals.state.reiter[ci];
        if (!ct) continue;
        var cco = AppGlobals.getCarryover(ci);
        var isSavingsSource = (ct.istHektar > 0 && ct.hektar > 0 && ct.istHektar < ct.hektar);
        var isExcessSource = (ct.istHektar > 0 && ct.hektar > 0 && ct.istHektar > ct.hektar);
        if (isSavingsSource) {
          // Issue #273: source savings must apply fahrgassenFaktor, same as
          // the carryover calculation. Use getTabTotalEinheiten - getTabIstEinheiten
          // (both already apply the per-tab FG factor) so display and
          // carryover share one formula.
          var sE = AppGlobals.getTabTotalEinheiten(ct) - AppGlobals.getTabIstEinheiten(ct);
          var sD = (ct.hektar - ct.istHektar) * (ct.duenger || 0);
          var sParts = [];
          if (sE > 0.05) sParts.push(AppGlobals.fmt(sE) + ' Einheiten Saatgut');
          if (sD > 0.05) sParts.push(sD.toLocaleString('de-DE') + ' kg Dünger');
          if (sParts.length > 0) {
            var sDiv = document.createElement('div');
            sDiv.className = 'drill-savings';
            sDiv.textContent = 'Ersparnis: ' + sParts.join(', ');
            container.appendChild(sDiv);
          }
        }
        if (cco.savedEinheit > 0.05 || cco.savedDuenger > 0.05) {
          var cParts = [];
          if (cco.savedEinheit > 0.05) cParts.push(AppGlobals.fmt(cco.savedEinheit) + ' Einheiten Saatgut');
          if (cco.savedDuenger > 0.05) cParts.push(cco.savedDuenger.toLocaleString('de-DE') + ' kg Dünger');
          var cDiv = document.createElement('div');
          cDiv.className = 'drill-carryover';
          cDiv.textContent = 'Übertrag aus ersparten Flächen: +' + cParts.join(', ');
          container.appendChild(cDiv);
        }
        if (isExcessSource) {
          // Issue #273: source excess must apply fahrgassenFaktor, same as
          // the carryover calculation. Use getTabIstEinheiten - getTabTotalEinheiten
          // (both already apply the per-tab FG factor) so display and
          // carryover share one formula.
          var eE = AppGlobals.getTabIstEinheiten(ct) - AppGlobals.getTabTotalEinheiten(ct);
          var eD = (ct.istHektar - ct.hektar) * (ct.duenger || 0);
          var eParts = [];
          if (eE > 0.05) eParts.push(AppGlobals.fmt(eE) + ' Einheiten Saatgut');
          if (eD > 0.05) eParts.push(eD.toLocaleString('de-DE') + ' kg Dünger');
          if (eParts.length > 0) {
            var eDiv = document.createElement('div');
            eDiv.className = 'drill-excess';
            eDiv.textContent = 'Mehrbedarf aus überschrittenen Flächen: -' + eParts.join(', ');
            container.appendChild(eDiv);
          }
        }
      }
      // All-tabs aggregation (T3): iterate state.reiter in index order.
      // Each tab with entries.length > 0 gets a drill-entry-tab-header div,
      // followed by its entries in chronological order. #N numbering resets
      // per tab (Option A — consistent with single-tab behaviour, test 09
      // unchanged). Empty state only when ALL tabs have empty entries.
      var allTabs = AppGlobals.state.reiter || [];
      var hasAnyEntry = allTabs.some(function(r) { return r && r.entries && r.entries.length > 0; });
      if (!hasAnyEntry) {
        if (totalSummary) totalSummary.textContent = '';
        var empty = document.createElement('div');
        empty.className = 'drill-empty';
        empty.textContent = 'Noch nichts eingefüllt';
        container.appendChild(empty);
        return;
      }
      // Total-Summary (Hektar/Einheiten/Dünger über alle Entries aller Tabs)
      if (totalSummary) {
        var usedHa = 0, usedE = 0, usedD = 0;
        allTabs.forEach(function(rt) {
          if (!rt || !rt.entries) return;
          rt.entries.forEach(function(e) {
            usedHa += (e.istHektar || e.hektar || 0);
            usedE += (e.einheit || 0);
            usedD += (e.duenger || 0);
          });
        });
        var parts = [];
        if (usedHa > 0) parts.push(AppGlobals.fmt(usedHa) + ' ha');
        if (usedE > 0) parts.push(AppGlobals.fmt(usedE) + ' Einheiten');
        if (usedD > 0) parts.push(usedD.toLocaleString('de-DE') + ' kg Dünger');
        totalSummary.textContent = parts.join(' · ');
      }
      // Iterate per tab in index order. Per-tab #N numbering (Option A):
      // entries[0] = '#1', entries[1] = '#2', etc. Consistent with single-tab
      // behaviour — test 09-blind-spots ('drill entry shows time prefix when
      // time is set') still sees entry-text[0] as the first entry of the
      // only tab with entries.
      allTabs.forEach(function(rt, tabIdx) {
        if (!rt || !rt.entries || rt.entries.length === 0) return;
        var header = document.createElement('div');
        header.className = 'drill-entry-tab-header';
        header.textContent = rt.name || ('Tab ' + (tabIdx + 1));
        container.appendChild(header);
        rt.entries.forEach(function(entry, actualIdx) {
          var row = document.createElement('div');
          row.className = 'drill-entry';
          // #number span (nested inside .entry-text — tests query
          // '.entry-text span' to find the #N markers; the original f7f7e8d
          // implementation also kept the hash span inside the entry-text.)
          var entryText = document.createElement('span');
          entryText.className = 'entry-text';
          var numSpan = document.createElement('span');
          numSpan.textContent = '#' + (actualIdx + 1) + ' ';
          entryText.appendChild(numSpan);
          var parts2 = [];
          if (entry.time) {
            var t = typeof entry.time === 'number' ? new Date(entry.time).toLocaleString('de-DE') : entry.time;
            parts2.push(t + ' –');
          }
          if (entry.istHektar || entry.zaehlerStand) {
            var ha = entry.istHektar || entry.zaehlerStand;
            parts2.push(AppGlobals.fmt(ha) + ' ha');
          } else if (entry.hektar > 0) {
            parts2.push('@' + AppGlobals.fmt(entry.hektar) + 'ha');
          }
          parts2.push(AppGlobals.formatEinheit(entry.einheit || 0));
          if (entry.duenger > 0) {
            parts2.push((entry.duenger).toLocaleString('de-DE') + ' kg Dünger');
          }
          entryText.appendChild(document.createTextNode(parts2.join(' ')));
          row.appendChild(entryText);
          var removeBtn = document.createElement('button');
          removeBtn.className = 'btn-danger';
          removeBtn.textContent = '✕';
          // Use the per-tab index (tabIdx), not state.activeReiter — entries
          // are aggregated across tabs in renderDrillLog, so the delete
          // handler must address the correct tab.
          removeBtn.onclick = (function(ti, ai) {
            return function() { AppGlobals.drillRemove(ti, ai); };
          })(tabIdx, actualIdx);
          row.appendChild(removeBtn);
          container.appendChild(row);
        });
      });
    }

    // --- Render: Machine Log (Maschinen-Protokoll) ---

    // renderResults() must populate the #drill_machine_log container
    // so the test in tests/16-machine-log.test.js can find the entries, header,
    // delete buttons and prognose. The machine log is a flat global list
    // (AppGlobals.state.machineLog), independent of the per-tab entries — each row shows
    // what was filled into the machine, not the per-tab allocation.
    //
    // Prognose: for each entry, the cumulative tank level (after this fill)
    // tells us how many more ha we can drill before empty. The "driven ha"
    // since the last fill is (zaehlerStand of current) - (zaehlerStand of previous).
    // For the first entry there's no prior zaehlerStand → driven = current zaeehlerStand.
    function renderMachineLog() {
      var container = document.getElementById('drill_machine_log');
      if (!container) return;
      container.innerHTML = '';
      var log = AppGlobals.state.machineLog || [];
      var activeTab = AppGlobals.state.reiter[AppGlobals.state.activeReiter];
      if (log.length === 0) return;
      // Header
      var header = document.createElement('div');
      header.className = 'drill-entry-tab-header';
      header.textContent = 'Maschinen-Protokoll';
      container.appendChild(header);
      // Per-entry rates come from the active tab (Issue #186: prefer IST).
      // Issue #266 (Cluster B): Fahrgassen-Faktor muss in unitsPerHa
      // berücksichtigt werden (Test 18: unitsPerHa = koerner * fgFactor /
      // koernerProEinheit). fgFactor ist 1 wenn FG aus, sonst (breite-1)/breite.
      var fgEnabled = (activeTab && activeTab.fahrgassenEnabled !== undefined) ? activeTab.fahrgassenEnabled : AppGlobals.state.fahrgassenEnabled;
      var fgBreite = (activeTab && activeTab.fahrgassenBreite !== undefined) ? activeTab.fahrgassenBreite : AppGlobals.state.fahrgassenBreite;
      var fgFactor = (fgEnabled && fgBreite >= 2) ? AppGlobals.computeFahrgassenFaktor(fgBreite) : 1;
      var unitsPerHa = 0;
      var duengerPerHa = 0;
      if (activeTab && activeTab.koerner > 0) {
        unitsPerHa = activeTab.koerner * fgFactor / AppGlobals.state.koernerProEinheit;
      }
      if (activeTab && activeTab.duenger > 0) {
        duengerPerHa = activeTab.duenger;
      }
      // Walk in chronological order so the cumulative calc is forward.
      var cumEinheit = 0;
      var cumDuenger = 0;
      var lastZaehler = 0;
      for (var i = 0; i < log.length; i++) {
        var entry = log[i];
        var row = document.createElement('div');
        row.className = 'drill-entry';
        // #number span inside entry-text (test queries `.entry-text span`)
        var entryText = document.createElement('span');
        entryText.className = 'entry-text';
        var numSpan = document.createElement('span');
        numSpan.textContent = '#' + (i + 1) + ' ';
        entryText.appendChild(numSpan);
        var parts = [];
        if (entry.time) {
          var t = typeof entry.time === 'number' ? new Date(entry.time).toLocaleString('de-DE') : entry.time;
          parts.push(t + ' –');
        }
        if (entry.hektar || entry.zaehlerStand) {
          var ha = entry.zaehlerStand || entry.hektar;
          parts.push(ha.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' ha');
        }
        parts.push(AppGlobals.formatEinheit(entry.einheit || 0));
        if (entry.duenger > 0) {
          parts.push(entry.duenger.toLocaleString('de-DE') + ' kg Dünger');
        }
        entryText.appendChild(document.createTextNode(parts.join(' ')));
        row.appendChild(entryText);
        var removeBtn = document.createElement('button');
        removeBtn.className = 'btn-danger';
        removeBtn.textContent = '✕';
        removeBtn.onclick = (function(idx) {
          return function() { AppGlobals.drillMachineRemove(idx); };
        })(i);
        row.appendChild(removeBtn);
        container.appendChild(row);
        // Update cumulative tank-level: subtract driven ha since last fill, then add this fill.
        var zaehler = entry.zaehlerStand || entry.hektar || 0;
        var driven = Math.max(0, zaehler - lastZaehler);
        if (unitsPerHa > 0) cumEinheit = Math.max(0, cumEinheit - driven * unitsPerHa);
        if (duengerPerHa > 0) cumDuenger = Math.max(0, cumDuenger - driven * duengerPerHa);
        cumEinheit += entry.einheit || 0;
        cumDuenger += entry.duenger || 0;
        lastZaehler = zaehler;
        // Prognose row (one per entry that has rates)
        var prognoseParts = [];
        if (unitsPerHa > 0 && entry.einheit > 0) {
          var saatLeer = zaehler + cumEinheit / unitsPerHa;
          prognoseParts.push('Saat leer bei ' + AppGlobals.fmt(saatLeer) + ' ha');
        }
        if (duengerPerHa > 0 && entry.duenger > 0) {
          var duengerLeer = zaehler + cumDuenger / duengerPerHa;
          prognoseParts.push('Dünger leer bei ' + AppGlobals.fmt(duengerLeer) + ' ha');
        }
        if (prognoseParts.length > 0) {
          var prognose = document.createElement('div');
          prognose.className = 'drill-prognose';
          prognose.textContent = prognoseParts.join(' · ');
          container.appendChild(prognose);
        }
      }
    }

// Register exposed globals on AppGlobals (ADR-001 Schritt 3, Issue #278).
Object.assign(window.AppGlobals, {
  renderDrillTabList: renderDrillTabList,
  renderDrillSummary: renderDrillSummary,
  renderDrillLog: renderDrillLog,
  renderMachineLog: renderMachineLog,
});
