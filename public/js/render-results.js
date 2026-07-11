// ============================================================================
// RENDER-RESULTS — Ergebnis-Karte, Hauptergebnis-Render
//
// Lade-Reihenfolge: state.js → calculations.js → ui-handlers.js → render-tabs.js
//   → render-results.js (DIESE DATEI) → render-drill.js → render-dashboard.js
//   → main.js
//
// render-results.js braucht: state, ui-handlers.js (syncInputsFromState),
//   calculations.js (getActiveReiter, getTabIstHektar, getActiveTotalEinheiten,
//   getActiveTotalDuenger, getTabIstEinheiten, getTabIstDuenger, getCarryover, fmt)
// Funktionen werden im globalen Scope definiert (Vanilla-JS / <script>-Tags).
// ============================================================================

    // --- Render: Result Card ---

    // Issue #371 (Reopen) Teil 2: Pure-Helper für die "Mehrbedarf"-Anzeige.
    // Subtrahiert den Cross-Tab-Netting-Anteil (co.nettedEinheit/Duenger)
    // vom Roh-Mehrbedarf und klemmt bei 0.
    //
    // Eingaben:
    //   raw  = { excessE: number, excessD: number }   (IST - SOLL dieses Tabs, Roh-Wert)
    //   co   = carryover-Objekt für DIESEN Tab aus AppGlobals.getCarryover(activeIdx)
    // Rückgabe: { shownExcessE, shownExcessD } — nie negativ.
    //
    // Testbar ohne DOM; renderResultCard ruft dies auf, der Test in tests/57
    // ruft es direkt und assertet auf die Rückgabe (nicht auf getTabRemaining,
    // weil das für volle Mehrbedarf-Tabs ohnehin 0 ist und den Bug nicht deckt).
    function computeShownExcess(raw, co) {
      var re = (raw && typeof raw.excessE === 'number') ? raw.excessE : 0;
      var rd = (raw && typeof raw.excessD === 'number') ? raw.excessD : 0;
      var ne = (co && typeof co.nettedEinheit === 'number') ? co.nettedEinheit : 0;
      var nd = (co && typeof co.nettedDuenger === 'number') ? co.nettedDuenger : 0;
      return {
        shownExcessE: Math.max(0, re - ne),
        shownExcessD: Math.max(0, rd - nd)
      };
    }

    function renderResultCard() {
      var r = AppGlobals.getActiveReiter();
      var kornerGesamt = AppGlobals.getKornerGesamt();
      // Issue #186: IST-Fläche (vom Input-Feld) hat Vorrang vor SOLL.
      // r_einheiten/r_duenger zeigen die tatsächlichen IST-Bedarfe, wenn
      // r.istHektar > 0 — konsistent mit Dashboard, Drill-Summary, etc.
      var istSum = AppGlobals.getTabIstHektar(r);
      var einheiten = istSum > 0 ? AppGlobals.getTabIstEinheiten(r) : AppGlobals.getActiveTotalEinheiten();
      var duengerTotal = istSum > 0 ? AppGlobals.getTabIstDuenger(r) : AppGlobals.getActiveTotalDuenger();
      var rkEl = document.getElementById('r_korner');
      if (rkEl) rkEl.textContent = Math.round(kornerGesamt).toLocaleString('de-DE');
      var reEl = document.getElementById('r_einheiten');
      if (reEl) reEl.textContent = AppGlobals.formatEinheit(einheiten);
      var rdEl = document.getElementById('r_duenger');
      if (rdEl) rdEl.textContent = duengerTotal > 0 ? duengerTotal.toLocaleString('de-DE') + ' kg' : '—';
      var riEl = document.getElementById('r_info');
      if (riEl) {
        if (duengerTotal > 0) {
          riEl.textContent = duengerTotal.toLocaleString('de-DE') + ' kg Dünger, ' + AppGlobals.formatEinheit(einheiten) + ' Saat';
        } else {
          riEl.textContent = AppGlobals.formatEinheit(einheiten) + ' Saat (ohne Dünger)';
        }
      }
      var sollHa = r.hektar;
      var istHa = AppGlobals.getTabIstHektar(r);
      var diff = istHa - sollHa;
      var sollIstSection = document.getElementById('r_soll_ist_section');
      if (sollIstSection) {
        if (sollHa > 0 && istHa > 0) {
          var rshEl = document.getElementById('r_soll_ha');
          if (rshEl) rshEl.textContent = AppGlobals.fmt(sollHa) + ' ha';
          var rihEl = document.getElementById('r_ist_ha');
          if (rihEl) rihEl.textContent = AppGlobals.fmt(istHa) + ' ha';
          var rDiffEl = document.getElementById('r_diff_ha');
          if (rDiffEl) {
            if (diff >= 0) {
              rDiffEl.textContent = '+' + AppGlobals.fmt(diff) + ' ha';
              rDiffEl.className = 'value small positive';
            } else {
              rDiffEl.textContent = AppGlobals.fmt(diff) + ' ha';
              rDiffEl.className = 'value small negative';
            }
          }
          sollIstSection.style.display = 'block';
        } else {
          sollIstSection.style.display = 'none';
        }
      }
      // Issue #336: Per-Tab-Eigen-Salden des aktiven Tabs (PR #337/#339).
      // Ersparnis + Mehrbedarf sind Roh-Werte für DIESEN Tab — KEINE Cross-Tab-
      // Aggregation, KEIN Empfänger-Saldo aus computeAllCarryovers(), KEINE
      // Verrechnung mit Verbleibend/Eingefüllt (Issue #335 bleibt offen).
      // Der Cross-Tab-Saldo lebt im Drill-Log + Maschinen-Protokoll (Issue
      // #336 follow-up #5b, User-Feedback 2026-06-23, 5. Runde).
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
        while (carryoverHint.firstChild) carryoverHint.removeChild(carryoverHint.firstChild);
        var savingsE = 0, savingsD = 0, excessE = 0, excessD = 0;
        if (r.istHektar > 0 && r.hektar > 0) {
          savingsE = AppGlobals.getTabTotalEinheiten(r) - AppGlobals.getTabIstEinheiten(r);
          savingsD = (r.hektar - r.istHektar) * (r.duenger || 0);
          excessE = AppGlobals.getTabIstEinheiten(r) - AppGlobals.getTabTotalEinheiten(r);
          excessD = (r.istHektar - r.hektar) * (r.duenger || 0);
        }
        // Issue #371 (Reopen) Teil 2: Die vom User gesehene "Mehrbedarf"-Zeile
        // muss den Anteil abziehen, der bereits durch den Cross-Tab-Pool
        // (computeAllCarryovers → Phase 0.5 → nettedEinheit/nettedDuenger)
        // gedeckt ist. Sonst zeigt sie 1,6 E obwohl remaining = 0 ist.
        //
        // Ersparnis bleibt unverändert: Ersparnis IST Eigene-Abweichung dieses
        // Tabs (Issue #336 Vertrag), keine Cross-Tab-Korrektur.
        var activeIdxForHint = AppGlobals.state.activeReiter || 0;
        var coForHint = AppGlobals.getCarryover(activeIdxForHint);
        var shown = AppGlobals.computeShownExcess({ excessE: excessE, excessD: excessD }, coForHint);
        var showSavings = savingsE > 0.05 || savingsD > 0.05;
        var showExcess = shown.shownExcessE > 0.05 || shown.shownExcessD > 0.05;
        if (showSavings || showExcess) {
          var sectionLabel = document.createElement('div');
          sectionLabel.className = 'r-carryover-section-label';
          sectionLabel.textContent = 'Abweichung dieses Tabs';
          carryoverHint.appendChild(sectionLabel);
          if (showSavings) {
            var sParts = [];
            if (savingsE > 0.05) sParts.push(AppGlobals.fmt(savingsE) + ' Einheiten Saatgut');
            if (savingsD > 0.05) sParts.push(savingsD.toLocaleString('de-DE') + ' kg Dünger');
            var sDiv = document.createElement('div');
            sDiv.className = 'r-carryover-row r-carryover-savings';
            sDiv.textContent = 'Ersparnis: ' + sParts.join(', ');
            carryoverHint.appendChild(sDiv);
          }
          if (showExcess) {
            var eParts = [];
            if (shown.shownExcessE > 0.05) eParts.push(AppGlobals.fmt(shown.shownExcessE) + ' Einheiten Saatgut');
            if (shown.shownExcessD > 0.05) eParts.push(shown.shownExcessD.toLocaleString('de-DE') + ' kg Dünger');
            var eDiv = document.createElement('div');
            eDiv.className = 'r-carryover-row r-carryover-excess';
            eDiv.textContent = 'Mehrbedarf aus überschrittenen Flächen: -' + eParts.join(', ');
            carryoverHint.appendChild(eDiv);
          }
        }
      }
    }

    // --- Render: Results (Hauptergebnis) ---

    function renderResults() {
      var r = AppGlobals.getActiveReiter();
      renderResultCard();
      AppGlobals.renderDrillSummary();
      AppGlobals.renderDrillLog();
      renderDrillEntriesInline();
      AppGlobals.renderMachineLog();
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
      // Issue #266-A: hide results card when the active tab has no data,
      // and show/hide the drill_summary block consistently. renderView()
      // already handles drill_section / protokoll toggle; we only need to
      // ensure results + drill_summary reflect the active tab's data state.
      var resultsEl = document.getElementById('results');
      var drillSummaryEl = document.getElementById('drill_summary');
      var hasData = r.hektar > 0 && r.koerner > 0;
      if (!hasData) {
        if (resultsEl) resultsEl.style.display = 'none';
        if (drillSummaryEl) drillSummaryEl.style.display = 'none';
        return;
      }
      if (drillSummaryEl) drillSummaryEl.style.display = 'block';
      if (AppGlobals.state.activeView !== 'protokoll') {
        if (resultsEl) resultsEl.style.display = 'block';
      }
    }

    // Inline drill-entries im Result-Card-Body (r_drill_entries)
    // Issue #266: Diese müssen sichtbar sein und einen Delete-Button haben,
    // damit Tests den "btn-danger" + "drillRemove"-Pfad abdecken können.
    function renderDrillEntriesInline() {
      var container = document.getElementById('r_drill_entries');
      if (!container) return;
      container.innerHTML = '';
      var r = AppGlobals.getActiveReiter();
      if (!r || !r.entries || r.entries.length === 0) {
        var rdSection = document.getElementById('r_drill_section');
        if (rdSection) rdSection.style.display = 'none';
        return;
      }
      var rdSection = document.getElementById('r_drill_section');
      if (rdSection) rdSection.style.display = 'block';
      var usedE = r.entries.reduce(function(s, e) { return s + (e.einheit || 0); }, 0);
      var usedD = r.entries.reduce(function(s, e) { return s + (e.duenger || 0); }, 0);
      // Issue #320: Konsistenz mit render-dashboard.js, render-drill.js und
      // renderResultCard oben — alle ziehen Basis + Used + Carryover aus
      // derselben Quelle (getTabRemaining), sodass die "verbleibend"-Sites
      // konsistent sind.
      // Issue 2 (Code-Review): DRY — getTabRemaining ersetzt die inline-Formel
      // (Basis + Used + Carryover-genettet in einem Aufruf). Line 23 oben
      // (renderResultCard) bleibt unangetastet — sie nutzt getActiveTotalEinheiten
      // mit anderer Semantik (SOLL-Total statt IST-präferiert).
      var activeIdx = AppGlobals.state.activeReiter || 0;
      var rem = AppGlobals.getTabRemaining(r, activeIdx);
      var remE = rem.remainingE;
      var remD = rem.remainingD;
      var usedEl = document.getElementById('r_drill_e_used');
      if (usedEl) usedEl.textContent = AppGlobals.formatEinheit(usedE);
      var remEl = document.getElementById('r_drill_e_rem');
      if (remEl) remEl.textContent = AppGlobals.formatEinheit(remE);
      var dUsedEl = document.getElementById('r_drill_d_used');
      if (dUsedEl) dUsedEl.textContent = usedD > 0 ? usedD.toLocaleString('de-DE') + ' kg' : '—';
      var dRemEl = document.getElementById('r_drill_d_rem');
      if (dRemEl) dRemEl.textContent = remD > 0 ? remD.toLocaleString('de-DE') + ' kg' : '—';
      var dUsedRow = document.getElementById('r_drill_d_used_row');
      if (dUsedRow) dUsedRow.style.display = usedD > 0 ? '' : 'none';
      var dRemRow = document.getElementById('r_drill_d_rem_row');
      if (dRemRow) dRemRow.style.display = remD > 0 ? '' : 'none';
      // Iterate in chronological order — matches renderDrillLog and the
      // original f7f7e8d behaviour (see 09-blind-spots "drill entry has #number span").
      r.entries.forEach(function(entry, actualIdx) {
        var row = document.createElement('div');
        row.className = 'drill-entry';
        var numSpan = document.createElement('span');
        numSpan.textContent = '#' + (actualIdx + 1) + ' ';
        row.appendChild(numSpan);
        var entryText = document.createElement('span');
        entryText.className = 'entry-text';
        var parts = [];
        if (entry.time) {
          var t = AppGlobals.formatEntryTime(entry.time);
          parts.push(t + ' –');
        }
        if (entry.istHektar || entry.zaehlerStand) {
          var ha = entry.istHektar || entry.zaehlerStand;
          parts.push(AppGlobals.fmt(ha) + ' ha');
        } else if (entry.hektar > 0) {
          parts.push('@' + AppGlobals.fmt(entry.hektar) + 'ha');
        }
        parts.push(AppGlobals.formatEinheit(entry.einheit || 0));
        if (entry.duenger > 0) {
          parts.push((entry.duenger).toLocaleString('de-DE') + ' kg Dünger');
        }
        entryText.textContent = parts.join(' ');
        row.appendChild(entryText);
        var removeBtn = document.createElement('button');
        removeBtn.className = 'btn-danger';
        removeBtn.textContent = '✕';
        removeBtn.onclick = function() { AppGlobals.drillRemove(AppGlobals.state.activeReiter, actualIdx); };
        row.appendChild(removeBtn);
        container.appendChild(row);
      });
    }

// Register exposed globals on AppGlobals (ADR-001 Schritt 3, Issue #278).
Object.assign(window.AppGlobals, {
  renderResultCard: renderResultCard,
  renderResults: renderResults,
  renderDrillEntriesInline: renderDrillEntriesInline,
  computeShownExcess: computeShownExcess,
});
