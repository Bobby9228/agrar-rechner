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
      // Issue #336: Carryover dieses Tabs (ohne Verrechnung) — drei eigene
      // Zeilen Ersparnis / Übertrag / Mehrbedarf, jeweils threshold-gegated
      // (|wert| > 0.05). KEINE Verrechnung mit Verbleibend/Eingefüllt — die
      // rem-Formel (renderDrillEntriesInline) bleibt unangetastet (Issue #335).
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
        var activeIdx = AppGlobals.state.activeReiter || 0;
        var co = AppGlobals.getCarryover(activeIdx);
        // Roh-Werte für die drei Zeilen — KEINE Verrechnung mit IST/SOLL oder
        // Carryover, sondern die direkten Differenzen wie _appendTabCarryoverBlocks.
        // Saat: getTabTotalEinheiten vs getTabIstEinheiten (beide fahrgassen-korrigiert)
        // Dünger: (hektar - istHektar) × duengerProHa (linear, kein FG-Faktor)
        // Ersparnis/Mehrbedarf nur sinnvoll wenn istHektar > 0 (sonst ist die
        // Differenz ein Artefakt: SOLL-0 = SOLL, nicht "Ersparnis"). Matcht
        // _appendTabCarryoverBlocks in render-drill.js (isSavingsSource check).
        var savingsE = 0, savingsD = 0, excessE = 0, excessD = 0;
        if (r.istHektar > 0 && r.hektar > 0) {
          savingsE = AppGlobals.getTabTotalEinheiten(r) - AppGlobals.getTabIstEinheiten(r);
          savingsD = (r.hektar - r.istHektar) * (r.duenger || 0);
          // Excess: IST - SOLL (positiv wenn IST > SOLL). Für Saat verwenden wir
          // getTabTotalEinheiten (FG-korrigiert), damit die Differenz konsistent
          // zur Carryover-Quelle in computeAllCarryovers() ist.
          excessE = AppGlobals.getTabIstEinheiten(r) - AppGlobals.getTabTotalEinheiten(r);
          excessD = (r.istHektar - r.hektar) * (r.duenger || 0);
        }
        // Ersparnis ist per Definition nur bei SOLL > IST sichtbar (positiv).
        // Wenn IST > SOLL ist savingsE negativ — das wird bereits durch die
        // Mehrbedarfs-Zeile abgedeckt. Wir blenden die Ersparnis-Zeile aus,
        // wenn der Wert negativ ist, damit nicht "Ersparnis: -3" erscheint
        // während "Mehrbedarf: +3" schon dasteht.
        var showSavings = savingsE > 0.05 || savingsD > 0.05;
        var hasCarryover = co.savedEinheit > 0.05 || co.savedDuenger > 0.05;
        // Mehrbedarf nur zeigen wenn IST > SOLL (positiv).
        var showExcess = excessE > 0.05 || excessD > 0.05;
        if (showSavings || hasCarryover || showExcess) {
          var sectionLabel = document.createElement('div');
          sectionLabel.className = 'r-carryover-section-label';
          sectionLabel.textContent = 'Carryover dieses Tabs (ohne Verrechnung)';
          carryoverHint.appendChild(sectionLabel);
          // Ersparnis: eigener Bedarf dieses Tabs, der durch nicht-bepflanzte
          // Fläche frei wurde (SOLL - IST > 0). Wird NICHT mit dem
          // Verbleibend verrechnet — das ist die Roh-Anzeige.
          if (showSavings) {
            var sParts = [];
            if (savingsE > 0.05) sParts.push(AppGlobals.fmt(savingsE) + ' Einheiten Saatgut');
            if (savingsD > 0.05) sParts.push(savingsD.toLocaleString('de-DE') + ' kg Dünger');
            var sDiv = document.createElement('div');
            sDiv.className = 'r-carryover-row r-carryover-savings';
            sDiv.textContent = 'Ersparnis: ' + sParts.join(', ');
            carryoverHint.appendChild(sDiv);
          }
          // Übertrag: Carryover, den dieser Tab von anderen Tabs EMPFÄNGT
          // (computeAllCarryovers().savedEinheit/savedDuenger).
          if (hasCarryover) {
            var cParts = [];
            if (co.savedEinheit > 0.05) cParts.push(AppGlobals.fmt(co.savedEinheit) + ' Einheiten Saatgut');
            if (co.savedDuenger > 0.05) cParts.push(co.savedDuenger.toLocaleString('de-DE') + ' kg Dünger');
            var cDiv = document.createElement('div');
            cDiv.className = 'r-carryover-row r-carryover-carryover';
            cDiv.textContent = 'Übertrag aus ersparten Flächen: +' + cParts.join(', ');
            carryoverHint.appendChild(cDiv);
          }
          // Mehrbedarf: eigener Mehr-Bedarf dieses Tabs durch überschrittene
          // Fläche (IST > SOLL). Wird NICHT mit dem Verbleibend verrechnet.
          if (showExcess) {
            var eParts = [];
            if (excessE > 0.05) eParts.push(AppGlobals.fmt(excessE) + ' Einheiten Saatgut');
            if (excessD > 0.05) eParts.push(excessD.toLocaleString('de-DE') + ' kg Dünger');
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
      // Issue #320: Konsistenz mit render-dashboard.js:60-61, render-drill.js:50-52,143-144,
      // und renderResultCard oben (alle nutzen `istHa > 0` ternary). Der `||`-Fallback
      // war im aktuellen Code funktional identisch (verifiziert per Brute-Force), aber die
      // explizite Ternary-Form ist robuster gegen künftige Refactorings von getTabIstX()
      // und macht die Code-Basis einheitlich mit den 4 Geschwister-Sites.
      var istHa = AppGlobals.getTabIstHektar(r);
      var istE = istHa > 0 ? AppGlobals.getTabIstEinheiten(r) : AppGlobals.getTabTotalEinheiten(r);
      var istD = istHa > 0 ? AppGlobals.getTabIstDuenger(r) : AppGlobals.getTabTotalDuenger(r);
      // Issue #305: subtract carryover savings / add excess from other tabs
      // so the inline-drill "verbleibend" matches the dashboard + drill summary.
      var activeIdx = AppGlobals.state.activeReiter || 0;
      var co = AppGlobals.getCarryover(activeIdx);
      var remE = Math.max(0, istE - usedE - co.savedEinheit + co.excessEinheit);
      var remD = Math.max(0, istD - usedD - co.savedDuenger + co.excessDuenger);
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
          var t = typeof entry.time === 'number' ? new Date(entry.time).toLocaleString('de-DE') : entry.time;
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
});
