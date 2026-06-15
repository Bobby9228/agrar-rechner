// ============================================================================
// RENDER-DRILL — Drill-Protokoll-Ansicht
//
// Lade-Reihenfolge: state.js → calculations.js → ui-handlers.js → render-tabs.js
//   → render-results.js → render-drill.js (DIESE DATEI) → render-dashboard.js
//   → main.js
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
      state.reiter.forEach(function(r, i) {
        var row = document.createElement('div');
        row.className = 'drill-tab-row';
        var prioBtn = document.createElement('button');
        prioBtn.className = 'drill-prio-btn';
        prioBtn.id = 'dtl_prio_' + i;
        var initPrio = Object.prototype.hasOwnProperty.call(state.drillPriorities, String(i)) ? state.drillPriorities[i] : 0;
        prioBtn.textContent = initPrio === 0 ? '—' : String(initPrio);
        prioBtn.setAttribute('data-prio', String(initPrio));
        prioBtn.classList.toggle('active', initPrio > 0);
        prioBtn.onclick = function() {
          var current = parseInt(prioBtn.getAttribute('data-prio')) || 0;
          var maxPrio = state.reiter.length;
          var next = current >= maxPrio ? 0 : current + 1;
          prioBtn.setAttribute('data-prio', String(next));
          prioBtn.textContent = next === 0 ? '—' : String(next);
          prioBtn.classList.toggle('active', next > 0);
          state.drillPriorities[i] = next;
          saveState();
          drillCalcAll();
        };
        row.appendChild(prioBtn);
        var nameWrap = document.createElement('div');
        nameWrap.className = 'drill-tab-name-wrap';
        var label = document.createElement('div');
        label.className = 'drill-tab-name';
        label.textContent = r.name || ('Tab ' + (i + 1));
        nameWrap.appendChild(label);
        if (r.hektar > 0 && r.koerner > 0) {
          var istSum = getTabIstHektar(r);
          var totalE = istSum > 0 ? getTabIstEinheiten(r) : getTabTotalEinheiten(r);
          var usedE = r.entries.reduce(function(s, e) { return s + e.einheit; }, 0);
          var totalD = istSum > 0 ? getTabIstDuenger(r) : getTabTotalDuenger(r);
          var usedD = r.entries.reduce(function(s, e) { return s + e.duenger; }, 0);
          var co = getCarryover(i);
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
            statusEl.textContent = 'braucht ' + fmt(Math.max(0, remaining)) + ' Einheiten';
          } else if (remaining <= 0.05) {
            // Nur Dünger übrig (seltener Fall, abgedeckt für Vollständigkeit)
            statusEl.textContent = 'braucht ' + fmt(Math.max(0, remainingD)) + ' kg Dünger';
          } else {
            statusEl.textContent = 'braucht ' + fmt(Math.max(0, remaining)) + ' Einheiten, ' + fmt(Math.max(0, remainingD)) + ' kg Dünger';
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
          drillCalcDebounced();
        };
        row.appendChild(einheitIn);
        var duengerIn = document.createElement('input');
        duengerIn.type = 'text';
        duengerIn.inputMode = 'decimal';
        duengerIn.id = 'dtl_d_' + i;
        duengerIn.placeholder = 'kg Dünger';
        duengerIn.dataset.tabIdx = String(i);
        duengerIn.oninput = function() {
          drillCalcDebounced();
        };
        row.appendChild(duengerIn);
        container.appendChild(row);
      });
    }

    // --- Render: Drill Summary ---

    function renderDrillSummary() {
      var r = getActiveReiter();
      // Issue #186: IST-Fläche (vom Input-Feld) hat Vorrang vor SOLL.
      var istSum = getTabIstHektar(r);
      var einheiten = istSum > 0 ? getTabIstEinheiten(r) : getActiveTotalEinheiten();
      var duengerTotal = istSum > 0 ? getTabIstDuenger(r) : getActiveTotalDuenger();
      var usedEinheit = (r && r.entries) ? r.entries.reduce(function(s, e) { return s + (e.einheit || 0); }, 0) : 0;
      var usedDuenger = (r && r.entries) ? r.entries.reduce(function(s, e) { return s + (e.duenger || 0); }, 0) : 0;
      var istEinheiten = istSum > 0 ? getTabIstEinheiten(r) : einheiten;
      var istDuenger = istSum > 0 ? getTabIstDuenger(r) : duengerTotal;
      var remEinheit = Math.max(0, istEinheiten - usedEinheit);
      var remDuenger = Math.max(0, istDuenger - usedDuenger);
      var dsSollE = document.getElementById('ds_saat_total');
      if (dsSollE) dsSollE.textContent = formatEinheit(einheiten);
      var dsUsedE = document.getElementById('ds_saat_used');
      if (dsUsedE) dsUsedE.textContent = formatEinheit(usedEinheit);
      var dsRemE = document.getElementById('ds_saat_remaining');
      if (dsRemE) dsRemE.textContent = formatEinheit(remEinheit);
      var dsSollD = document.getElementById('ds_duenger_total');
      if (dsSollD) dsSollD.textContent = duengerTotal > 0 ? duengerTotal.toLocaleString('de-DE') + ' kg' : '—';
      var dsUsedD = document.getElementById('ds_duenger_used');
      if (dsUsedD) dsUsedD.textContent = usedDuenger > 0 ? usedDuenger.toLocaleString('de-DE') + ' kg' : '—';
      var dsRemD = document.getElementById('ds_duenger_remaining');
      if (dsRemD) dsRemD.textContent = remDuenger > 0 ? remDuenger.toLocaleString('de-DE') + ' kg' : '0 kg';
      // Issue #266-B2: IST<SOLL savings in #ds_savings.
      // Issue #273: savings/excess display must apply fahrgassenFaktor
      // (consistent with getTabTotalEinheiten/getTabIstEinheiten that the
      // carryover calculation uses). Compute via the same helpers so display
      // and carryover source share one formula.
      var dsSav = document.getElementById('ds_savings');
      if (dsSav) {
        if (istSum > 0 && r.hektar > istSum) {
          var savE = getTabTotalEinheiten(r) - getTabIstEinheiten(r);
          var savD = (r.hektar - istSum) * (r.duenger || 0);
          var savParts = [];
          if (savE > 0.05) savParts.push(fmt(savE) + ' Einheiten Saatgut');
          if (savD > 0.05) savParts.push(savD.toLocaleString('de-DE') + ' kg Dünger');
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
      var activeTab = state.reiter[state.activeReiter];
      var totalSummary = document.getElementById('ds_total_summary');
      // Issue #266-B2: Per-tab carryover/savings/excess divs at the top.
      // Shown for ALL tabs that have any carryover signal (savings source,
      // excess source, or carryover received from other tabs). Tests assert
      // these classes on the #drill_entries container.
      for (var ci = 0; ci < state.reiter.length; ci++) {
        var ct = state.reiter[ci];
        if (!ct) continue;
        var cco = getCarryover(ci);
        var isSavingsSource = (ct.istHektar > 0 && ct.hektar > 0 && ct.istHektar < ct.hektar);
        var isExcessSource = (ct.istHektar > 0 && ct.hektar > 0 && ct.istHektar > ct.hektar);
        if (isSavingsSource) {
          // Issue #273: source savings must apply fahrgassenFaktor, same as
          // the carryover calculation. Use getTabTotalEinheiten - getTabIstEinheiten
          // (both already apply the per-tab FG factor) so display and
          // carryover share one formula.
          var sE = getTabTotalEinheiten(ct) - getTabIstEinheiten(ct);
          var sD = (ct.hektar - ct.istHektar) * (ct.duenger || 0);
          var sParts = [];
          if (sE > 0.05) sParts.push(fmt(sE) + ' Einheiten Saatgut');
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
          if (cco.savedEinheit > 0.05) cParts.push(fmt(cco.savedEinheit) + ' Einheiten Saatgut');
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
          var eE = getTabIstEinheiten(ct) - getTabTotalEinheiten(ct);
          var eD = (ct.istHektar - ct.hektar) * (ct.duenger || 0);
          var eParts = [];
          if (eE > 0.05) eParts.push(fmt(eE) + ' Einheiten Saatgut');
          if (eD > 0.05) eParts.push(eD.toLocaleString('de-DE') + ' kg Dünger');
          if (eParts.length > 0) {
            var eDiv = document.createElement('div');
            eDiv.className = 'drill-excess';
            eDiv.textContent = 'Mehrbedarf aus überschrittenen Flächen: -' + eParts.join(', ');
            container.appendChild(eDiv);
          }
        }
      }
      if (!activeTab || !activeTab.entries || activeTab.entries.length === 0) {
        if (totalSummary) totalSummary.textContent = '';
        var empty = document.createElement('div');
        empty.className = 'drill-empty';
        empty.textContent = 'Noch nichts eingefüllt';
        container.appendChild(empty);
        return;
      }
      // Total-Summary (Hektar/Einheiten/Dünger über alle Entries)
      if (totalSummary) {
        var usedHa = activeTab.entries.reduce(function(s, e) { return s + (e.istHektar || e.hektar || 0); }, 0);
        var usedE = activeTab.entries.reduce(function(s, e) { return s + (e.einheit || 0); }, 0);
        var usedD = activeTab.entries.reduce(function(s, e) { return s + (e.duenger || 0); }, 0);
        var parts = [];
        if (usedHa > 0) parts.push(fmt(usedHa) + ' ha');
        if (usedE > 0) parts.push(fmt(usedE) + ' Einheiten');
        if (usedD > 0) parts.push(usedD.toLocaleString('de-DE') + ' kg Dünger');
        totalSummary.textContent = parts.join(' · ');
      }
      // Iterate in chronological order — entries[0] is the first fill
      // (oldest, marked "#1") and entries[length-1] is the latest ("#N").
      // Tests (09-blind-spots "drill entry has #number span") assert that
      // the first span shows "#1 " and the second "#2 ", which matches the
      // original f7f7e8d renderDrillLog behaviour.
      activeTab.entries.forEach(function(entry, actualIdx) {
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
          parts2.push(fmt(ha) + ' ha');
        } else if (entry.hektar > 0) {
          parts2.push('@' + fmt(entry.hektar) + 'ha');
        }
        parts2.push(formatEinheit(entry.einheit || 0));
        if (entry.duenger > 0) {
          parts2.push((entry.duenger).toLocaleString('de-DE') + ' kg Dünger');
        }
        entryText.appendChild(document.createTextNode(parts2.join(' ')));
        row.appendChild(entryText);
        var removeBtn = document.createElement('button');
        removeBtn.className = 'btn-danger';
        removeBtn.textContent = '✕';
        removeBtn.onclick = function() { drillRemove(state.activeReiter, actualIdx); };
        row.appendChild(removeBtn);
        container.appendChild(row);
      });
    }

    // --- Render: Machine Log (Maschinen-Protokoll) ---

    // Issue #266-A: renderResults() must populate the #drill_machine_log container
    // so the test in tests/16-machine-log.test.js can find the entries, header,
    // delete buttons and prognose. The machine log is a flat global list
    // (state.machineLog), independent of the per-tab entries — each row shows
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
      var log = state.machineLog || [];
      var activeTab = state.reiter[state.activeReiter];
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
      var fgEnabled = (activeTab && activeTab.fahrgassenEnabled !== undefined) ? activeTab.fahrgassenEnabled : state.fahrgassenEnabled;
      var fgBreite = (activeTab && activeTab.fahrgassenBreite !== undefined) ? activeTab.fahrgassenBreite : state.fahrgassenBreite;
      var fgFactor = (fgEnabled && fgBreite >= 2) ? computeFahrgassenFaktor(fgBreite) : 1;
      var unitsPerHa = 0;
      var duengerPerHa = 0;
      if (activeTab && activeTab.koerner > 0) {
        unitsPerHa = activeTab.koerner * fgFactor / state.koernerProEinheit;
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
        parts.push(formatEinheit(entry.einheit || 0));
        if (entry.duenger > 0) {
          parts.push(entry.duenger.toLocaleString('de-DE') + ' kg Dünger');
        }
        entryText.appendChild(document.createTextNode(parts.join(' ')));
        row.appendChild(entryText);
        var removeBtn = document.createElement('button');
        removeBtn.className = 'btn-danger';
        removeBtn.textContent = '✕';
        removeBtn.onclick = (function(idx) {
          return function() { drillMachineRemove(idx); };
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
          prognoseParts.push('Saat leer bei ' + fmt(saatLeer) + ' ha');
        }
        if (duengerPerHa > 0 && entry.duenger > 0) {
          var duengerLeer = zaehler + cumDuenger / duengerPerHa;
          prognoseParts.push('Dünger leer bei ' + fmt(duengerLeer) + ' ha');
        }
        if (prognoseParts.length > 0) {
          var prognose = document.createElement('div');
          prognose.className = 'drill-prognose';
          prognose.textContent = prognoseParts.join(' · ');
          container.appendChild(prognose);
        }
      }
    }
