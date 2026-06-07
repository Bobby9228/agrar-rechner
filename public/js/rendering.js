// ============================================================================
// RENDERING — Alle DOM-Aktualisierungsfunktionen
//
// Prinzip: Diese Funktionen LESEN state und schreiben ins DOM.
// Keine state-Änderungen hier (dafür gibt es ui-handlers.js).
// Keine berechnungen hier (dafür gibt es calculations.js).
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
      var resetAllBtn = document.getElementById('reset_all_btn');
      if (resetAllBtn) resetAllBtn.style.display = isProtokoll ? 'none' : '';
      var stickyFooter = document.getElementById('sticky_footer');
      if (stickyFooter) stickyFooter.style.display = isProtokoll ? 'none' : '';
    }

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
        nameWrap.style.flex = '1';
        nameWrap.style.minWidth = '0';
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
          statusEl.style.fontSize = '0.75rem';
          statusEl.style.color = '#666';
          if (remaining <= 0.05 && remainingD <= 0.05) {
            statusEl.textContent = '✓ fertig';
            statusEl.style.color = '#2a9d4a';
          } else {
            statusEl.textContent = 'braucht ' + fmt(Math.max(0, remaining)) + ' Einheiten, ' + fmt(Math.max(0, remainingD)) + ' kg Dünger';
          }
          nameWrap.appendChild(statusEl);
        }
        row.appendChild(nameWrap);
        var einheitIn = document.createElement('input');
        einheitIn.type = 'text';
        einheitIn.inputMode = 'decimal';
        einheitIn.placeholder = 'Einheiten';
        einheitIn.style.width = '70px';
        einheitIn.dataset.tabIdx = String(i);
        einheitIn.oninput = function() {
          drillCalcDebounced();
        };
        row.appendChild(einheitIn);
        var duengerIn = document.createElement('input');
        duengerIn.type = 'text';
        duengerIn.inputMode = 'decimal';
        duengerIn.placeholder = 'kg Dünger';
        duengerIn.style.width = '70px';
        duengerIn.dataset.tabIdx = String(i);
        duengerIn.oninput = function() {
          drillCalcDebounced();
        };
        row.appendChild(duengerIn);
        container.appendChild(row);
      });
    }

    // --- Render: Result Card ---

    function renderResultCard() {
      var r = getActiveReiter();
      var kornerGesamt = getKornerGesamt();
      // Issue #186: IST-Fläche (vom Input-Feld) hat Vorrang vor SOLL.
      // r_einheiten/r_duenger zeigen die tatsächlichen IST-Bedarfe, wenn
      // r.istHektar > 0 — konsistent mit Dashboard, Drill-Summary, etc.
      var istSum = getTabIstHektar(r);
      var einheiten = istSum > 0 ? getTabIstEinheiten(r) : getActiveTotalEinheiten();
      var duengerTotal = istSum > 0 ? getTabIstDuenger(r) : getActiveTotalDuenger();
      var rkEl = document.getElementById('r_korner');
      if (rkEl) rkEl.textContent = Math.round(kornerGesamt).toLocaleString('de-DE');
      var reEl = document.getElementById('r_einheiten');
      if (reEl) reEl.textContent = formatEinheit(einheiten);
      var rdEl = document.getElementById('r_duenger');
      if (rdEl) rdEl.textContent = duengerTotal > 0 ? duengerTotal.toLocaleString('de-DE') + ' kg' : '—';
      var riEl = document.getElementById('r_info');
      if (riEl) {
        if (duengerTotal > 0) {
          riEl.textContent = duengerTotal.toLocaleString('de-DE') + ' kg Dünger, ' + formatEinheit(einheiten) + ' Saat';
        } else {
          riEl.textContent = formatEinheit(einheiten) + ' Saat (ohne Dünger)';
        }
      }
      var sollHa = r.hektar;
      var istHa = getTabIstHektar(r);
      var diff = istHa - sollHa;
      var sollIstSection = document.getElementById('r_soll_ist_section');
      if (sollIstSection) {
        if (sollHa > 0 && istHa > 0) {
          var rshEl = document.getElementById('r_soll_ha');
          if (rshEl) rshEl.textContent = fmt(sollHa) + ' ha';
          var rihEl = document.getElementById('r_ist_ha');
          if (rihEl) rihEl.textContent = fmt(istHa) + ' ha';
          var rDiffEl = document.getElementById('r_diff_ha');
          if (rDiffEl) {
            if (diff >= 0) {
              rDiffEl.textContent = '+' + fmt(diff) + ' ha';
              rDiffEl.className = 'value small positive';
            } else {
              rDiffEl.textContent = fmt(diff) + ' ha';
              rDiffEl.className = 'value small negative';
            }
          }
          sollIstSection.style.display = 'block';
        } else {
          sollIstSection.style.display = 'none';
        }
      }
      var carryoverHint = document.getElementById('r_carryover_hint');
      if (!carryoverHint) {
        carryoverHint = document.createElement('div');
        carryoverHint.id = 'r_carryover_hint';
        carryoverHint.style.cssText = 'font-size:0.85rem;padding:4px 0;';
        if (sollIstSection && sollIstSection.parentNode) {
          sollIstSection.parentNode.insertBefore(carryoverHint, sollIstSection.nextSibling);
        }
      }
      if (carryoverHint) {
        carryoverHint.innerHTML = '';
        var activeIdx = state.activeReiter || 0;
        var co = getCarryover(activeIdx);
        var coHtml = '';
        if (co.savedEinheit > 0.05 || co.savedDuenger > 0.05) {
          var parts = [];
          if (co.savedEinheit > 0.05) parts.push(fmt(co.savedEinheit) + ' Einheiten');
          if (co.savedDuenger > 0.05) parts.push(fmt(co.savedDuenger) + ' kg Dünger');
          coHtml += '<span class="carryover-hint">Übertrag aus ersparten Flächen: +' + parts.join(', ') + '</span>';
        }
        if (co.excessEinheit > 0.05 || co.excessDuenger > 0.05) {
          var eparts = [];
          if (co.excessEinheit > 0.05) eparts.push(fmt(co.excessEinheit) + ' Einheiten');
          if (co.excessDuenger > 0.05) eparts.push(fmt(co.excessDuenger) + ' kg Dünger');
          if (coHtml) coHtml += '<br>';
          coHtml += '<span class="excess-hint">Mehrbedarf aus überschrittenen Flächen: -' + eparts.join(', ') + '</span>';
        }
        carryoverHint.innerHTML = coHtml;
      }
    }

    // --- Render: Mini Footer ---

    function renderMiniFooter() {
      var mf = document.getElementById('mini_footer');
      if (!mf) return;
      var activeR = state.reiter[state.activeReiter];
      if (!activeR) return;
      if (activeR.hektar > 0 && activeR.koerner > 0) {
        var einheiten = getActiveTotalEinheiten();
        var kornerGesamt = getKornerGesamt();
        var kornerStr = Math.round(kornerGesamt).toLocaleString('de-DE');
        var miniResult = mf.querySelector('.mini-result') || mf;
        miniResult.textContent = 'Bedarf: ' + formatEinheit(einheiten) + ' / ' + kornerStr + ' Körner';
        miniResult.classList.remove('mini-result-empty');
      } else {
        var miniResult = mf.querySelector('.mini-result') || mf;
        miniResult.textContent = 'Bitte Hektar und Körner eingeben';
        miniResult.classList.add('mini-result-empty');
      }
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
      var container = document.getElementById('drill_log_entries');
      if (!container) return;
      container.innerHTML = '';
      var activeTab = state.reiter[state.activeReiter];
      if (!activeTab || !activeTab.entries || activeTab.entries.length === 0) return;
      activeTab.entries.slice().reverse().forEach(function(entry, revIdx) {
        var actualIdx = activeTab.entries.length - 1 - revIdx;
        var row = document.createElement('div');
        row.className = 'drill-log-entry';
        var time = entry.time ? new Date(entry.time).toLocaleString('de-DE') : '—';
        row.innerHTML = '<span class="dl-time">' + time + '</span>' +
          '<span class="dl-data">' + fmt(entry.einheit || 0) + ' Einheiten, ' + fmt(entry.duenger || 0) + ' kg Dünger</span>';
        var removeBtn = document.createElement('button');
        removeBtn.className = 'dl-remove';
        removeBtn.textContent = '✕';
        removeBtn.onclick = function() { drillRemove(state.activeReiter, actualIdx); };
        row.appendChild(removeBtn);
        container.appendChild(row);
      });
    }

    // --- Render: Results (Hauptergebnis) ---

    function renderResults() {
      var r = getActiveReiter();
      renderResultCard();
      renderDrillSummary();
      renderDrillLog();
      renderMiniFooter();
      var errHektar = document.getElementById('err_hektar');
      var errKoerner = document.getElementById('err_koerner');
      var hektarEl = document.getElementById('hektar');
      var koernerEl = document.getElementById('koerner');
      if (errHektar) errHektar.textContent = '';
      if (errKoerner) errKoerner.textContent = '';
      if (hektarEl) hektarEl.style.borderColor = '';
      if (koernerEl) koernerEl.style.borderColor = '';
      if (!r.hektar && r.hektar !== 0 && r.koerner === 0) return;
      if (!r.koerner && r.koerner !== 0) {
        if (errKoerner) errKoerner.textContent = 'Bitte Körner/ha eingeben';
        if (koernerEl) koernerEl.style.borderColor = '#c00';
        return;
      }
      if (state.activeView !== 'protokoll') {
        var resultsEl = document.getElementById('results');
        if (resultsEl) resultsEl.style.display = 'block';
      }
    }

    // --- Render: Dashboard ---
    // Issue #186: Dashboard muss bei Ist-Fläche-Änderungen live aktualisiert werden.
    // Verwendet IST-Fläche (wenn gesetzt) als Basis für "verbleibend"-Berechnung,
    // konsistent mit renderResultCard() und renderDrillSummary().

    function renderDashboard() {
      var container = document.getElementById('dashboard_content');
      if (!container) return;
      var reiter = state.reiter;
      if (reiter.length === 0) {
        container.innerHTML = '<div class="dashboard-empty">Keine Tabs vorhanden</div>';
        return;
      }
      container.innerHTML = '';

      // --- Summary across all tabs (IST-basiert wenn verfügbar) ---
      var totalHa = 0;
      var totalEinheitRem = 0, totalDuengerRem = 0;
      var totalEinheitenBasis = 0, totalEinheitenUsed = 0;
      var totalDuengerBasis = 0, totalDuengerUsed = 0;
      reiter.forEach(function(r, idx) {
        if (r.hektar > 0 && r.koerner > 0) {
          var istSum = getTabIstHektar(r);
          totalHa += istSum > 0 ? istSum : r.hektar;
          var basisE = istSum > 0 ? getTabIstEinheiten(r) : getTabTotalEinheiten(r);
          var basisD = istSum > 0 ? getTabIstDuenger(r) : r.hektar * r.duenger;
          var usedE = r.entries ? r.entries.reduce(function(s, e) { return s + (e.einheit || 0); }, 0) : 0;
          var usedD = r.entries ? r.entries.reduce(function(s, e) { return s + (e.duenger || 0); }, 0) : 0;
          // remaining = max(0, basis - used) — no carryover subtraction
          totalEinheitRem += Math.max(0, basisE - usedE);
          totalDuengerRem += Math.max(0, basisD - usedD);
          totalEinheitenBasis += basisE;
          totalEinheitenUsed += usedE;
          totalDuengerBasis += basisD;
          totalDuengerUsed += usedD;
        }
      });
      var totalPct = totalEinheitenBasis > 0 || totalDuengerBasis > 0
        ? Math.min(100, Math.round(Math.max(
            totalEinheitenBasis > 0 ? totalEinheitenUsed / totalEinheitenBasis : 0,
            totalDuengerBasis > 0 ? totalDuengerUsed / totalDuengerBasis : 0
          ) * 100))
        : 0;

      var summaryCard = document.createElement('div');
      summaryCard.className = 'dashboard-summary';
      summaryCard.innerHTML =
        '<div class="dashboard-summary-title">📊 Zusammenfassung</div>' +
        '<div class="dashboard-summary-stats">' +
          '<div class="dashboard-summary-stat">' +
            '<div class="dashboard-summary-label">Fläche</div>' +
            '<div class="dashboard-summary-value">' + (totalHa > 0 ? fmt(totalHa) + ' ha' : '—') + '</div>' +
          '</div>' +
          '<div class="dashboard-summary-stat">' +
            '<div class="dashboard-summary-label">Einheiten verbl.</div>' +
            '<div class="dashboard-summary-value ' + (totalPct >= 100 ? 'done' : totalPct > 0 ? 'remaining' : '') + '">' +
              (totalEinheitenBasis > 0 ? fmt(totalEinheitRem) : '—') +
            '</div>' +
          '</div>' +
          '<div class="dashboard-summary-stat">' +
            '<div class="dashboard-summary-label">Dünger verbl.</div>' +
            '<div class="dashboard-summary-value ' + (totalPct >= 100 ? 'done' : totalPct > 0 ? 'remaining' : '') + '">' +
              (totalDuengerBasis > 0 ? totalDuengerRem.toLocaleString('de-DE') + ' kg' : '—') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="dashboard-progress-bar">' +
          '<div class="dashboard-progress-fill" style="width:' + totalPct + '%"></div>' +
        '</div>';
      container.appendChild(summaryCard);

      // --- Per-tab cards ---
      reiter.forEach(function(r, idx) {
        var card = document.createElement('div');
        card.className = 'dashboard-reiter-card';

        var nameEl = document.createElement('div');
        nameEl.className = 'dashboard-reiter-name';
        nameEl.textContent = r.name || ('Reiter ' + (idx + 1));
        if (idx === state.activeReiter) {
          nameEl.textContent += ' (aktiv)';
        }
        card.appendChild(nameEl);

        var stats = document.createElement('div');
        stats.className = 'dashboard-reiter-stats';

        // Hektar (SOLL + IST if different)
        var haDiv = document.createElement('div');
        haDiv.className = 'dashboard-stat';
        var haDivLabel = document.createElement('div');
        haDivLabel.className = 'dashboard-stat-label';
        haDivLabel.textContent = 'Hektar';
        var haDivVal = document.createElement('div');
        haDivVal.className = 'dashboard-stat-value';
        var istH = getTabIstHektar(r);
        if (istH > 0 && istH !== r.hektar) {
          haDivVal.textContent = fmt(r.hektar) + ' / ' + fmt(istH) + ' ha';
        } else {
          haDivVal.textContent = r.hektar > 0 ? fmt(r.hektar) + ' ha' : '—';
        }
        haDiv.appendChild(haDivLabel);
        haDiv.appendChild(haDivVal);
        stats.appendChild(haDiv);

        // Körner/ha
        var kDiv = document.createElement('div');
        kDiv.className = 'dashboard-stat';
        var kDivLabel = document.createElement('div');
        kDivLabel.className = 'dashboard-stat-label';
        kDivLabel.textContent = 'Körner/ha';
        var kDivVal = document.createElement('div');
        kDivVal.className = 'dashboard-stat-value';
        kDivVal.textContent = r.koerner > 0 ? r.koerner.toLocaleString('de-DE') : '—';
        kDiv.appendChild(kDivLabel);
        kDiv.appendChild(kDivVal);
        stats.appendChild(kDiv);

        // IST-basierte Berechnung (wenn IST-Fläche gesetzt, sonst SOLL)
        var einheiten = 0;
        var usedEinheit = 0;
        var duengerTotal = 0;
        var usedDuenger = 0;
        var einheitRem = 0;
        var duengerRem = 0;
        var pct = 0;
        var statusClass = 'na';
        if (r.hektar > 0 && r.koerner > 0) {
          var istSum = getTabIstHektar(r);
          einheiten = istSum > 0 ? getTabIstEinheiten(r) : getTabTotalEinheiten(r);
          usedEinheit = r.entries ? r.entries.reduce(function(s, e) { return s + (e.einheit || 0); }, 0) : 0;
          duengerTotal = istSum > 0 ? getTabIstDuenger(r) : r.hektar * r.duenger;
          usedDuenger = r.entries ? r.entries.reduce(function(s, e) { return s + (e.duenger || 0); }, 0) : 0;
          einheitRem = Math.max(0, einheiten - usedEinheit);
          duengerRem = Math.max(0, duengerTotal - usedDuenger);
          var minFilled = Math.min(
            einheiten > 0 ? usedEinheit / einheiten : 1,
            duengerTotal > 0 ? usedDuenger / duengerTotal : 1
          );
          pct = Math.min(100, Math.round(minFilled * 100));
          if (pct >= 100) statusClass = 'done';
          else if (pct > 0) statusClass = 'remaining';
        }

        // Einheiten verbleibend
        var eStat = document.createElement('div');
        eStat.className = 'dashboard-stat';
        var eStatLabel = document.createElement('div');
        eStatLabel.className = 'dashboard-stat-label';
        eStatLabel.textContent = 'Einheiten verbl.';
        var eStatVal = document.createElement('div');
        eStatVal.className = 'dashboard-stat-value ' + statusClass;
        eStatVal.textContent = r.hektar > 0 && r.koerner > 0 ? fmt(einheitRem) : '—';
        eStat.appendChild(eStatLabel);
        eStat.appendChild(eStatVal);
        stats.appendChild(eStat);

        // Dünger verbleibend
        var dStat = document.createElement('div');
        dStat.className = 'dashboard-stat';
        var dStatLabel = document.createElement('div');
        dStatLabel.className = 'dashboard-stat-label';
        dStatLabel.textContent = 'Dünger verbl.';
        var dStatVal = document.createElement('div');
        dStatVal.className = 'dashboard-stat-value ' + statusClass;
        dStatVal.textContent = duengerTotal > 0 ? duengerRem.toLocaleString('de-DE') + ' kg' : '—';
        dStat.appendChild(dStatLabel);
        dStat.appendChild(dStatVal);
        stats.appendChild(dStat);

        // Progress bar
        var progressWrap = document.createElement('div');
        progressWrap.className = 'dashboard-progress-bar';
        var progressFill = document.createElement('div');
        progressFill.className = 'dashboard-progress-fill';
        progressFill.style.width = (r.hektar > 0 && r.koerner > 0) ? pct + '%' : '0%';
        progressWrap.appendChild(progressFill);
        stats.appendChild(progressWrap);

        card.appendChild(stats);
        container.appendChild(card);
      });
    }

    // Öffnet das Dashboard-Sheet und ruft renderDashboard() auf.
    // Issue #186: muss auch nach ENTRY_CHANGED-Events den State korrekt widerspiegeln.
    function openDashboard() {
      var sheet = document.getElementById('dashboard_sheet');
      var overlay = document.getElementById('dashboard_overlay');
      if (sheet) sheet.classList.add('open');
      if (overlay) overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
      renderDashboard();
    }

    // Schließt das Dashboard-Sheet.
    function closeDashboard() {
      var sheet = document.getElementById('dashboard_sheet');
      var overlay = document.getElementById('dashboard_overlay');
      if (sheet) sheet.classList.remove('open');
      if (overlay) overlay.classList.remove('open');
      document.body.style.overflow = '';
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
        if (e.key === 'mais_rechner' && e.newValue) {
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
        if (!confirm('Tab "' + tab.name + '" wirklich löschen?')) return;
      }
      removeReiter(idx);
    }