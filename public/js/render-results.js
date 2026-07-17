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

    // Berechnet den Render-Anteil für die Ring-Chart.
    //   percent (0..100) → stroke-dashoffset Wert.
    //   Circumference des Kreises: 2*PI*r = 2*PI*44 ≈ 276.46.
    // Helper pur, damit Tests isoliert bleiben.
    function ringStrokeDashoffset(percent) {
      var circ = 2 * Math.PI * 44;  // ≈ 276.46
      var p = Math.max(0, Math.min(100, percent));
      return circ - (circ * p / 100);
    }

    function renderResultCard() {
      var r = AppGlobals.getActiveReiter();
      var kornerGesamt = AppGlobals.getKornerGesamt();
      var istSum = AppGlobals.getTabIstHektar(r);
      var einheiten = istSum > 0 ? AppGlobals.getTabIstEinheiten(r) : AppGlobals.getActiveTotalEinheiten();
      var duengerTotal = istSum > 0 ? AppGlobals.getTabIstDuenger(r) : AppGlobals.getActiveTotalDuenger();

      // --- Legacy r_*-Elemente (für Test-Kompatibilität) ---
      var rkEl = document.getElementById('r_korner');
      if (rkEl) rkEl.textContent = Math.round(kornerGesamt).toLocaleString('de-DE');
      var reEl = document.getElementById('r_einheiten');
      if (reEl) reEl.textContent = AppGlobals.formatEinheit(einheiten);
      var rdEl = document.getElementById('r_duenger');
      if (rdEl) rdEl.textContent = duengerTotal > 0 ? duengerTotal.toLocaleString('de-DE') + ' kg' : '—';

      // --- Ring-Chart-Werte ---
      // Verbleibender Anteil = basis (SOLL/IST) - used. used kann nicht negativ sein
      // (Einträge sind additiv). Bei activeTab ohne Daten: 0% gefüllt.
      var basis = einheiten;
      var used = (r && r.entries) ? r.entries.reduce(function(s, e) { return s + (e.einheit || 0); }, 0) : 0;
      var pct = basis > 0 ? Math.min(100, Math.max(0, (used / basis) * 100)) : 0;
      var ringValEl = document.getElementById('r_ring_value');
      if (ringValEl) ringValEl.textContent = AppGlobals.fmt(einheiten);
      var ringSubEl = document.getElementById('r_ring_sub');
      if (ringSubEl) ringSubEl.textContent = einheiten === 1 ? 'EINH.' : 'EINH.';
      var ringFgEl = document.getElementById('r_ring_fg');
      if (ringFgEl) ringFgEl.setAttribute('stroke-dashoffset', String(ringStrokeDashoffset(pct)));

      // --- Side Text ---
      var sideTitleEl = document.getElementById('r_side_title');
      var sideSubEl = document.getElementById('r_side_sub');
      if (sideTitleEl) {
        sideTitleEl.textContent = einheiten > 0
          ? AppGlobals.fmt(einheiten) + ' Einheiten Saatgut'
          : 'Ergebnis';
      }
      if (sideSubEl) {
        if (einheiten > 0 && r.hektar > 0 && r.koerner > 0) {
          var kh = AppGlobals.fmtCompact(r.koerner);
          sideSubEl.textContent = 'Bei ' + AppGlobals.fmt(r.hektar) + ' ha und ' + kh + ' Körnern pro Hektar.';
        } else {
          sideSubEl.textContent = 'Bitte Hektar und Körner/ha eingeben.';
        }
      }

      // --- Bottom Progress Bar ---
      var duengerUsed = (r && r.entries) ? r.entries.reduce(function(s, e) { return s + (e.duenger || 0); }, 0) : 0;
      var duengerRemaining = Math.max(0, duengerTotal - duengerUsed);
      var einheitRemaining = Math.max(0, einheiten - used);
      var progressPct = pct;  // gleiche Prozent wie Ring
      var progressFillEl = document.getElementById('r_progress_fill');
      if (progressFillEl) progressFillEl.style.width = progressPct.toFixed(0) + '%';
      var progressUsedEl = document.getElementById('r_progress_used');
      if (progressUsedEl) {
        progressUsedEl.textContent = used > 0.05
          ? AppGlobals.fmt(used) + (used === 1 ? ' Einh. verbraucht' : ' Einh. verbraucht')
          : '— verbraucht';
      }
      var progressOpenEl = document.getElementById('r_progress_open');
      if (progressOpenEl) {
        if (einheitRemaining > 0.05 && duengerRemaining > 0.05) {
          progressOpenEl.textContent = AppGlobals.fmt(einheitRemaining) + ' Einh. · ' + Math.round(duengerRemaining).toLocaleString('de-DE') + ' kg offen';
        } else if (einheitRemaining > 0.05) {
          progressOpenEl.textContent = AppGlobals.fmt(einheitRemaining) + ' Einh. offen';
        } else if (duengerRemaining > 0.05) {
          progressOpenEl.textContent = Math.round(duengerRemaining).toLocaleString('de-DE') + ' kg offen';
        } else {
          progressOpenEl.textContent = 'Vollständig';
        }
      }

      // --- Header-Meta (legacy r_info slot) ---
      var riEl = document.getElementById('r_info');
      if (riEl) {
        if (einheiten > 0 && duengerTotal > 0) {
          riEl.textContent = Math.round(duengerTotal).toLocaleString('de-DE') + ' kg Dünger, ' + AppGlobals.fmt(einheiten) + ' Einheiten Saat';
        } else if (einheiten > 0) {
          riEl.textContent = AppGlobals.fmt(einheiten) + ' Einheiten Saat (ohne Dünger)';
        } else {
          riEl.textContent = '';
        }
      }

      // --- SOLL/IST/Abweichung (legacy IDs, für test/48-render-results-ist-fallback) ---
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
          sollIstSection.style.display = '';
        } else {
          sollIstSection.style.display = 'none';
        }
      }

      // --- Carryover hint (legacy) ---
      var carryoverHint = document.getElementById('r_carryover_hint');
      if (!carryoverHint) {
        carryoverHint = document.createElement('div');
        carryoverHint.id = 'r_carryover_hint';
        carryoverHint.style.cssText = 'font-size:0.85rem;padding:4px 0;';
        var parentEl = document.getElementById('results');
        if (parentEl) parentEl.appendChild(carryoverHint);
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

      // --- Net hint (legacy) ---
      var netHint = document.getElementById('r_net_hint');
      if (!netHint) {
        netHint = document.createElement('div');
        netHint.id = 'r_net_hint';
        netHint.style.cssText = 'font-size:0.85rem;padding:4px 0;';
        var resultsEl = document.getElementById('results');
        if (resultsEl) resultsEl.appendChild(netHint);
      }
      if (netHint) {
        while (netHint.firstChild) netHint.removeChild(netHint.firstChild);
        netHint.style.display = 'none';
        var allCarry = AppGlobals.computeAllCarryovers();
        var sinkIdx = -1;
        for (var ci = 0; ci < allCarry.length; ci++) {
          if (allCarry[ci].isSink) { sinkIdx = ci; break; }
        }
        var activeIdxForNet = AppGlobals.state.activeReiter || 0;
        var coForNet = allCarry[activeIdxForNet] || AppGlobals.getCarryover(activeIdxForNet);
        var hasOwnOverage = (r.istHektar > 0 && r.hektar > 0)
          && (AppGlobals.getTabIstEinheiten(r) - AppGlobals.getTabTotalEinheiten(r) > 0.05
              || (r.istHektar - r.hektar) * (r.duenger || 0) > 0.05);
        if (!coForNet.isSink && hasOwnOverage && sinkIdx !== -1 && sinkIdx !== activeIdxForNet) {
          var sinkTab = AppGlobals.state.reiter[sinkIdx];
          var sinkName = (sinkTab && sinkTab.name) || ('Tab ' + (sinkIdx + 1));
          var noteDiv = document.createElement('div');
          noteDiv.className = 'r-carryover-row r-carryover-carryover';
          noteDiv.textContent = '↳ wird über den Tab-Ausgleich von „' + sinkName + '\u201c gedeckt';
          netHint.appendChild(noteDiv);
          netHint.style.display = 'block';
        } else if (coForNet.isSink && (Math.abs(coForNet.sinkAdjustedE) > 0.05 || Math.abs(coForNet.sinkAdjustedD) > 0.05)) {
          var label2 = document.createElement('div');
          label2.className = 'r-carryover-section-label';
          label2.textContent = 'Ausgleich mit anderen Tabs';
          netHint.appendChild(label2);
          var addParts = [], subParts = [];
          if (coForNet.sinkAdjustedE > 0.05) addParts.push(AppGlobals.fmt(coForNet.sinkAdjustedE) + ' Einheiten Saatgut');
          else if (coForNet.sinkAdjustedE < -0.05) subParts.push(AppGlobals.fmt(-coForNet.sinkAdjustedE) + ' Einheiten Saatgut');
          if (coForNet.sinkAdjustedD > 0.05) addParts.push(Math.round(coForNet.sinkAdjustedD).toLocaleString('de-DE') + ' kg Dünger');
          else if (coForNet.sinkAdjustedD < -0.05) subParts.push(Math.round(-coForNet.sinkAdjustedD).toLocaleString('de-DE') + ' kg Dünger');
          if (addParts.length) {
            var addDiv = document.createElement('div');
            addDiv.className = 'r-carryover-row r-carryover-excess';
            addDiv.textContent = '+ Mehrbedarf von anderen Tabs übernommen: ' + addParts.join(', ');
            netHint.appendChild(addDiv);
          }
          if (subParts.length) {
            var subDiv = document.createElement('div');
            subDiv.className = 'r-carryover-row r-carryover-savings';
            subDiv.textContent = '− Ersparnis von anderen Tabs übernommen: ' + subParts.join(', ');
            netHint.appendChild(subDiv);
          }
          netHint.style.display = 'block';
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
      if (AppGlobals.state.activeView !== 'protokoll' && AppGlobals.state.activeView !== 'uebersicht') {
        if (resultsEl) resultsEl.style.display = 'block';
      }
      // 2-Spalten-Stat-Cards (Körner gesamt / Dünger gesamt) — gerendert direkt
      // unter dem Result-Card in #view_rechner. Bleiben sichtbar in Rechner-View
      // wenn Daten vorhanden sind.
      renderStatCards(r, AppGlobals.getKornerGesamt());
    }

    // Rendert die zwei 2-Spalten-Stat-Cards (Körner gesamt / Dünger gesamt)
    // unter dem Result-Card. Wird von renderResults() aufgerufen, wenn Hektar & Körner gesetzt.
    function renderStatCards(r, kornerGesamt) {
      var container = document.getElementById('view_rechner');
      if (!container) return;
      var existing = document.getElementById('stat_row_cards');
      if (!existing) {
        existing = document.createElement('div');
        existing.id = 'stat_row_cards';
        existing.className = 'stat-row';
        container.appendChild(existing);
      }
      existing.innerHTML = '';
      var duengerTotal = AppGlobals.getActiveTotalDuenger();
      var c1 = document.createElement('div');
      c1.className = 'stat-card';
      var l1 = document.createElement('div');
      l1.className = 'stat-card-label';
      l1.textContent = 'Körner gesamt';
      var v1 = document.createElement('div');
      v1.className = 'stat-card-value';
      v1.textContent = kornerGesamt > 0 ? Math.round(kornerGesamt).toLocaleString('de-DE') : '—';
      c1.appendChild(l1); c1.appendChild(v1); existing.appendChild(c1);
      var c2 = document.createElement('div');
      c2.className = 'stat-card';
      var l2 = document.createElement('div');
      l2.className = 'stat-card-label';
      l2.textContent = 'Dünger gesamt';
      var v2 = document.createElement('div');
      v2.className = 'stat-card-value';
      v2.textContent = duengerTotal > 0 ? Math.round(duengerTotal).toLocaleString('de-DE') + ' kg' : '—';
      c2.appendChild(l2); c2.appendChild(v2); existing.appendChild(c2);
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
      // Issue: "Dünger verbleibend" muss auch bei 0 kg sichtbar sein, sobald
      // überhaupt Dünger eingefüllt wurde — sonst verschwindet die Zeile
      // genau dann, wenn der Tank aufgebraucht ist (irreführend).
      if (dRemEl) dRemEl.textContent = usedD > 0 ? Math.round(remD).toLocaleString('de-DE') + ' kg' : '—';
      var dUsedRow = document.getElementById('r_drill_d_used_row');
      if (dUsedRow) dUsedRow.style.display = usedD > 0 ? '' : 'none';
      var dRemRow = document.getElementById('r_drill_d_rem_row');
      if (dRemRow) dRemRow.style.display = usedD > 0 ? '' : 'none';
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
  renderStatCards: renderStatCards,
  ringStrokeDashoffset: ringStrokeDashoffset,
  computeShownExcess: computeShownExcess,
});
