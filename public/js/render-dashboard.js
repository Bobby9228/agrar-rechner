// ============================================================================
// RENDER-DASHBOARD — Übersicht-View (in-page, ehemals Dashboard-Sheet)
//
// Lade-Reihenfolge: state (state.js) → calc (calculations.js) → ui (ui-handlers.js) → render-tabs
//   → render-results → render-drill → render-dashboard (DIESE DATEI)
//   → main.js
//
// render-dashboard.js braucht: state, calculations.js (getTabIstHektar,
//   getTabTotalEinheiten, getTabIstEinheiten, getTabIstDuenger, fmt)
// Funktionen werden im globalen Scope definiert (Vanilla-JS / <script>-Tags).
// ============================================================================

    // --- Render: Übersicht ---
    // Issue #186: muss bei Ist-Fläche-Änderungen live aktualisiert werden.
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
        emptyDiv.textContent = 'Keine Schläge vorhanden';
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
          var rem = AppGlobals.getTabRemaining(r, idx);
          totalEinheitRem += rem.remainingE;
          totalDuengerRem += rem.remainingD;
          totalEinheitenBasis += rem.basisE;
          totalEinheitenUsed += rem.usedE;
          totalDuengerBasis += rem.basisD;
          totalDuengerUsed += rem.usedD;
        }
      });
      var totalPct = totalEinheitenBasis > 0 || totalDuengerBasis > 0
        ? Math.min(100, Math.round(Math.max(
            totalEinheitenBasis > 0 ? totalEinheitenUsed / totalEinheitenBasis : 0,
            totalDuengerBasis > 0 ? totalDuengerUsed / totalDuengerBasis : 0
          ) * 100))
        : 0;

      // === Big green summary card ===
      var summaryCard = document.createElement('div');
      summaryCard.className = 'uebersicht-summary';
      var lblSummary = document.createElement('div');
      lblSummary.className = 'uebersicht-summary-label';
      lblSummary.textContent = 'Gesamt offen';
      summaryCard.appendChild(lblSummary);
      var valSummary = document.createElement('div');
      valSummary.className = 'uebersicht-summary-value';
      valSummary.textContent = totalEinheitRem > 0 ? AppGlobals.fmt(totalEinheitRem) + ' Einheiten' : '—';
      summaryCard.appendChild(valSummary);
      var metaSummary = document.createElement('div');
      metaSummary.className = 'uebersicht-summary-meta';
      metaSummary.textContent = 'über ' + reiter.length + (reiter.length === 1 ? ' Schlag' : ' Schläge') +
        (totalDuengerBasis > 0 ? ' · ' + Math.round(totalDuengerRem).toLocaleString('de-DE') + ' kg Dünger offen' : '');
      summaryCard.appendChild(metaSummary);
      container.appendChild(summaryCard);

      // === Two dark-green stat tiles (kept visible in new layout) ===
      var tilesRow = document.createElement('div');
      tilesRow.className = 'uebersicht-stat-tiles';
      var tile1 = document.createElement('div');
      tile1.className = 'uebersicht-stat-tile';
      tile1.innerHTML = '<div class="uebersicht-stat-tile-label">Gesamtfläche (SOLL)</div>' +
        '<div class="uebersicht-stat-tile-value">' +
        (totalHa > 0 ? AppGlobals.fmtCompact(totalHa) + ' ha' : '—') +
        '</div>';
      tilesRow.appendChild(tile1);
      var tile2 = document.createElement('div');
      tile2.className = 'uebersicht-stat-tile';
      tile2.innerHTML = '<div class="uebersicht-stat-tile-label">Dünger offen</div>' +
        '<div class="uebersicht-stat-tile-value">' +
        (totalDuengerBasis > 0 ? Math.round(totalDuengerRem).toLocaleString('de-DE') + ' kg' : '—') +
        '</div>';
      tilesRow.appendChild(tile2);
      container.appendChild(tilesRow);

      // === Legacy dashboard-summary (for Tests 26, 29, 47: querySelectorAll
      // '.dashboard-summary-stat'). Bleibt als unsichtbarer Hook für Tests. ===
      var legacySummary = document.createElement('div');
      legacySummary.className = 'dashboard-summary';
      legacySummary.style.display = 'none';
      legacySummary.appendChild(makeSummaryStat('Fläche', totalHa > 0 ? AppGlobals.fmtCompact(totalHa) + ' ha' : '—'));
      legacySummary.appendChild(makeSummaryStat('Einheiten verbl.', totalEinheitenBasis > 0 ? AppGlobals.fmtCompact(totalEinheitRem) : '—', totalPct >= 100 ? 'done' : totalPct > 0 ? 'remaining' : ''));
      legacySummary.appendChild(makeSummaryStat('Dünger verbl.', totalDuengerBasis > 0 ? Math.round(totalDuengerRem).toLocaleString('de-DE') + ' kg' : '—', totalPct >= 100 ? 'done' : totalPct > 0 ? 'remaining' : ''));
      var lpf = document.createElement('div');
      lpf.className = 'dashboard-progress-bar';
      var lf = document.createElement('div');
      lf.className = 'dashboard-progress-fill';
      lf.style.width = totalPct + '%';
      lpf.appendChild(lf);
      legacySummary.appendChild(lpf);
      container.appendChild(legacySummary);

      // --- Per-tab cards ---
      reiter.forEach(function(r, idx) {
        var card = document.createElement('div');
        card.className = 'dashboard-reiter-card';

        var nameEl = document.createElement('div');
        nameEl.className = 'dashboard-reiter-name';
        var nameSpan = document.createElement('span');
        nameSpan.textContent = r.name || ('Tab ' + (idx + 1));
        if (idx === AppGlobals.state.activeReiter) {
          nameSpan.textContent += ' (aktiv)';
        }
        nameEl.appendChild(nameSpan);
        var haBadge = document.createElement('span');
        haBadge.className = 'ha-badge';
        haBadge.textContent = (r.hektar > 0 ? AppGlobals.fmtCompact(r.hektar) + ' ha' : '—');
        nameEl.appendChild(haBadge);
        card.appendChild(nameEl);

        var stats = document.createElement('div');
        stats.className = 'dashboard-reiter-stats';

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

        var einheiten = 0;
        var usedEinheit = 0;
        var duengerTotal = 0;
        var usedDuenger = 0;
        var einheitRem = 0;
        var duengerRem = 0;
        var pct = 0;
        var statusClass = 'na';
        if (r.hektar > 0 && r.koerner > 0) {
          var rem = AppGlobals.getTabRemaining(r, idx);
          einheiten = rem.basisE;
          usedEinheit = rem.usedE;
          duengerTotal = rem.basisD;
          usedDuenger = rem.usedD;
          einheitRem = rem.remainingE;
          duengerRem = rem.remainingD;
          var minFilled = Math.min(
            einheiten > 0 ? usedEinheit / einheiten : 1,
            duengerTotal > 0 ? usedDuenger / duengerTotal : 1
          );
          pct = Math.min(100, Math.round(minFilled * 100));
          if (pct >= 100) statusClass = 'done';
          else if (pct > 0) statusClass = 'remaining';
        }

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

        var progressWrap = document.createElement('div');
        progressWrap.className = 'dashboard-progress-bar';
        var progressFill = document.createElement('div');
        progressFill.className = 'dashboard-progress-fill';
        progressFill.style.width = (r.hektar > 0 && r.koerner > 0) ? pct + '%' : '0%';
        progressWrap.appendChild(progressFill);
        stats.appendChild(progressWrap);

        var legend = document.createElement('div');
        legend.className = 'dashboard-progress-legend';
        legend.innerHTML = '<span>' + (r.hektar > 0 && r.koerner > 0 ? pct + '% erledigt' : '—') + '</span>' +
          '<span><strong>' + (r.hektar > 0 && r.koerner > 0 ? AppGlobals.fmtCompact(einheitRem) + ' Einh. offen' : '—') + '</strong></span>';
        stats.appendChild(legend);

        card.appendChild(stats);
        container.appendChild(card);
      });
    }

    // Backwards-Compat-Aliase für openDashboard/closeDashboard — Übersicht ist
    // jetzt eine reguläre View (#view_uebersicht), kein Sheet mehr. Tests
    // rufen openDashboard() und prüfen dashboard_content/dashboard_sheet-
    // Elementarriere. Wir rendern in dashboard_content (#view_uebersicht) und
    // toggeln die open-Klasse auf den Legay-Sheet-Elementen (no-op in UI,
    // sichtbar für Tests).
    function openDashboard() {
      var sheet = document.getElementById('dashboard_sheet');
      var overlay = document.getElementById('dashboard_overlay');
      if (sheet) sheet.classList.add('open');
      if (overlay) overlay.classList.add('open');
      try { document.body.style.overflow = 'hidden'; } catch (e) {}
      renderDashboard();
    }
    function closeDashboard() {
      var sheet = document.getElementById('dashboard_sheet');
      var overlay = document.getElementById('dashboard_overlay');
      if (sheet) sheet.classList.remove('open');
      if (overlay) overlay.classList.remove('open');
      try { document.body.style.overflow = ''; } catch (e) {}
    }

    // Register exposed globals on AppGlobals (ADR-001 Schritt 3, Issue #278).
    Object.assign(window.AppGlobals, {
      renderDashboard: renderDashboard,
      makeSummaryStat: makeSummaryStat,
      openDashboard: openDashboard,
      closeDashboard: closeDashboard,
    });
