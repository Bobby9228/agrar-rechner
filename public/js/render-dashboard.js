// ============================================================================
// RENDER-DASHBOARD — Dashboard-Übersicht (Sheet) + openDashboard/closeDashboard
//
// Lade-Reihenfolge: state (state.js) → calc (calculations.js) → ui (ui-handlers.js) → render-tabs
//   → render-results → render-drill → render-dashboard (DIESE DATEI)
//   → main.js
//
// render-dashboard.js braucht: state, calculations.js (getTabIstHektar,
//   getTabTotalEinheiten, getTabIstEinheiten, getTabIstDuenger, fmt)
// Funktionen werden im globalen Scope definiert (Vanilla-JS / <script>-Tags).
// ============================================================================

    // --- Render: Dashboard ---
    // Issue #186: Dashboard muss bei Ist-Fläche-Änderungen live aktualisiert werden.
    // Verwendet IST-Fläche (wenn gesetzt) als Basis für "verbleibend"-Berechnung,
    // konsistent mit renderResultCard() und renderDrillSummary().

    // Erzeugt ein einzelnes Summary-Stat-Element (Label + Wert).
    // Auf Modul-Ebene gehoben (ADR-001, Issue #278), damit es auf AppGlobals
    // registriert werden kann (Object.assign am Dateiende).
    function makeSummaryStat(label, value, valueClass) {
      var stat = document.createElement('div');
      stat.className = 'dashboard-summary-stat';
      var lbl = document.createElement('div');
      lbl.className = 'dashboard-summary-label';
      lbl.textContent = label;
      var val = document.createElement('div');
      val.className = 'dashboard-summary-value' + (valueClass ? ' ' + valueClass : '');
      val.textContent = value;
      stat.appendChild(lbl);
      stat.appendChild(val);
      return stat;
    }

    function renderDashboard() {
      var container = document.getElementById('dashboard_content');
      if (!container) return;
      var reiter = AppGlobals.state.reiter;
      if (reiter.length === 0) {
        var emptyDiv = document.createElement('div');
        emptyDiv.className = 'dashboard-empty';
        emptyDiv.textContent = 'Keine Tabs vorhanden';
        container.appendChild(emptyDiv);
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
          var istSum = AppGlobals.getTabIstHektar(r);
          totalHa += istSum > 0 ? istSum : r.hektar;
          var basisE = istSum > 0 ? AppGlobals.getTabIstEinheiten(r) : AppGlobals.getTabTotalEinheiten(r);
          var basisD = istSum > 0 ? AppGlobals.getTabIstDuenger(r) : r.hektar * r.duenger;
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

      var sTitle = document.createElement('div');
      sTitle.className = 'dashboard-summary-title';
      sTitle.textContent = '📊 Zusammenfassung';
      summaryCard.appendChild(sTitle);

      var sStats = document.createElement('div');
      sStats.className = 'dashboard-summary-stats';

      var pctClass = totalPct >= 100 ? 'done' : totalPct > 0 ? 'remaining' : '';
      sStats.appendChild(makeSummaryStat('Fläche', totalHa > 0 ? AppGlobals.fmtCompact(totalHa) + ' ha' : '—'));
      // fmtCompact: integer values shown without trailing ",0" (e.g. "8" not "8,0").
      // Tests 26, 27, 40 use toBe('8') on this element; test 18-round2 uses
      // toContain('15') on it. fmt() would produce "8,0" and break those tests.
      sStats.appendChild(makeSummaryStat('Einheiten verbl.', totalEinheitenBasis > 0 ? AppGlobals.fmtCompact(totalEinheitRem) : '—', pctClass));
      sStats.appendChild(makeSummaryStat('Dünger verbl.', totalDuengerBasis > 0 ? totalDuengerRem.toLocaleString('de-DE') + ' kg' : '—', pctClass));
      summaryCard.appendChild(sStats);

      var pBar = document.createElement('div');
      pBar.className = 'dashboard-progress-bar';
      var pFill = document.createElement('div');
      pFill.className = 'dashboard-progress-fill';
      pFill.style.width = totalPct + '%';
      pBar.appendChild(pFill);
      summaryCard.appendChild(pBar);
      container.appendChild(summaryCard);

      // --- Per-tab cards ---
      reiter.forEach(function(r, idx) {
        var card = document.createElement('div');
        card.className = 'dashboard-reiter-card';

        var nameEl = document.createElement('div');
        nameEl.className = 'dashboard-reiter-name';
        nameEl.textContent = r.name || ('Reiter ' + (idx + 1));
        if (idx === AppGlobals.state.activeReiter) {
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
        var istH = AppGlobals.getTabIstHektar(r);
        if (istH > 0 && istH !== r.hektar) {
          haDivVal.textContent = AppGlobals.fmtCompact(r.hektar) + ' / ' + AppGlobals.fmtCompact(istH) + ' ha';
        } else {
          haDivVal.textContent = r.hektar > 0 ? AppGlobals.fmtCompact(r.hektar) + ' ha' : '—';
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
          var istSum = AppGlobals.getTabIstHektar(r);
          einheiten = istSum > 0 ? AppGlobals.getTabIstEinheiten(r) : AppGlobals.getTabTotalEinheiten(r);
          usedEinheit = r.entries ? r.entries.reduce(function(s, e) { return s + (e.einheit || 0); }, 0) : 0;
          duengerTotal = istSum > 0 ? AppGlobals.getTabIstDuenger(r) : r.hektar * r.duenger;
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
        eStatVal.textContent = r.hektar > 0 && r.koerner > 0 ? AppGlobals.fmtCompact(einheitRem) : '—';
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
        dStatVal.textContent = duengerTotal > 0 ? Math.round(duengerRem).toLocaleString('de-DE') + ' kg' : '—';
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
    // Issue #211: Fokus-Falle und Dialog-Semantik für Accessibility.
    var _dashboardPrevFocus = null;

    // Trap Tab/Shift+Tab inside the dashboard dialog (Issue #211)
    function _dashboardKeyHandler(e) {
      if (e.key === 'Escape') {
        closeDashboard();
        e.preventDefault();
        return;
      }
      if (e.key !== 'Tab') return;
      var sheet = document.getElementById('dashboard_sheet');
      if (!sheet) return;
      var focusable = sheet.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { last.focus(); e.preventDefault(); }
      } else {
        if (document.activeElement === last) { first.focus(); e.preventDefault(); }
      }
    }

    function openDashboard() {
      var sheet = document.getElementById('dashboard_sheet');
      var overlay = document.getElementById('dashboard_overlay');
      _dashboardPrevFocus = document.activeElement;
      if (sheet) sheet.classList.add('open');
      if (overlay) overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
      renderDashboard();
      // Move focus into the dialog for accessibility (Issue #211)
      // Use setTimeout to avoid jsdom focus-event side effects
      if (sheet) {
        setTimeout(function() {
          var closeBtn = sheet.querySelector('.dashboard-close');
          if (closeBtn) closeBtn.focus();
        }, 0);
      }
      document.addEventListener('keydown', _dashboardKeyHandler);
    }

    // Schließt das Dashboard-Sheet.
    function closeDashboard() {
      var sheet = document.getElementById('dashboard_sheet');
      var overlay = document.getElementById('dashboard_overlay');
      if (sheet) sheet.classList.remove('open');
      if (overlay) overlay.classList.remove('open');
      document.body.style.overflow = '';
      document.removeEventListener('keydown', _dashboardKeyHandler);
      // Restore focus to the element that opened the dashboard
      if (_dashboardPrevFocus && _dashboardPrevFocus.focus) {
        _dashboardPrevFocus.focus();
        _dashboardPrevFocus = null;
      }
    }

    // Register exposed globals on AppGlobals (ADR-001 Schritt 3, Issue #278).
    Object.assign(window.AppGlobals, {
      renderDashboard: renderDashboard,
      makeSummaryStat: makeSummaryStat,
      _dashboardKeyHandler: _dashboardKeyHandler,
      openDashboard: openDashboard,
      closeDashboard: closeDashboard,
    });
