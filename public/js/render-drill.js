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
      if (dsSollD) dsSollD.textContent = duengerTotal > 0 ? fmt(duengerTotal) + ' kg' : '—';
      var dsUsedD = document.getElementById('ds_duenger_used');
      if (dsUsedD) dsUsedD.textContent = usedDuenger > 0 ? fmt(usedDuenger) + ' kg' : '—';
      var dsRemD = document.getElementById('ds_duenger_remaining');
      if (dsRemD) dsRemD.textContent = remDuenger > 0 ? fmt(remDuenger) + ' kg' : '—';
    }

    // --- Render: Drill Log ---

    function renderDrillLog() {
      var container = document.getElementById('drill_entries');
      if (!container) return;
      container.innerHTML = '';
      var activeTab = state.reiter[state.activeReiter];
      var totalSummary = document.getElementById('ds_total_summary');
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
      activeTab.entries.slice().reverse().forEach(function(entry, revIdx) {
        var actualIdx = activeTab.entries.length - 1 - revIdx;
        var row = document.createElement('div');
        row.className = 'drill-entry';
        // #number span
        var numSpan = document.createElement('span');
        numSpan.textContent = '#' + (actualIdx + 1) + ' ';
        row.appendChild(numSpan);
        var entryText = document.createElement('span');
        entryText.className = 'entry-text';
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
        entryText.textContent = parts2.join(' ');
        row.appendChild(entryText);
        var removeBtn = document.createElement('button');
        removeBtn.className = 'btn-danger';
        removeBtn.textContent = '✕';
        removeBtn.onclick = function() { drillRemove(state.activeReiter, actualIdx); };
        row.appendChild(removeBtn);
        container.appendChild(row);
      });
    }
