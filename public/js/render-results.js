// ============================================================================
// RENDER-RESULTS — Ergebnis-Karte, Mini-Footer, Hauptergebnis-Render
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
        while (carryoverHint.firstChild) carryoverHint.removeChild(carryoverHint.firstChild);
        var activeIdx = state.activeReiter || 0;
        var co = getCarryover(activeIdx);
        if (co.savedEinheit > 0.05 || co.savedDuenger > 0.05) {
          var parts = [];
          if (co.savedEinheit > 0.05) parts.push(fmt(co.savedEinheit) + ' Einheiten');
          if (co.savedDuenger > 0.05) parts.push(fmt(co.savedDuenger) + ' kg Dünger');
          var savedSpan = document.createElement('span');
          savedSpan.className = 'carryover-hint';
          savedSpan.textContent = 'Übertrag aus ersparten Flächen: +' + parts.join(', ');
          carryoverHint.appendChild(savedSpan);
        }
        if (co.excessEinheit > 0.05 || co.excessDuenger > 0.05) {
          var eparts = [];
          if (co.excessEinheit > 0.05) eparts.push(fmt(co.excessEinheit) + ' Einheiten');
          if (co.excessDuenger > 0.05) eparts.push(fmt(co.excessDuenger) + ' kg Dünger');
          if (carryoverHint.firstChild) carryoverHint.appendChild(document.createElement('br'));
          var excessSpan = document.createElement('span');
          excessSpan.className = 'excess-hint';
          excessSpan.textContent = 'Mehrbedarf aus überschrittenen Flächen: -' + eparts.join(', ');
          carryoverHint.appendChild(excessSpan);
        }
      }
    }

    // --- Render: Mini Footer ---

    function renderMiniFooter() {
      var mf = document.getElementById('mini_result');
      if (!mf) return;
      var activeR = state.reiter[state.activeReiter];
      if (!activeR) return;
      if (activeR.hektar > 0 && activeR.koerner > 0) {
        var einheiten = getActiveTotalEinheiten();
        var duengerTotal = getActiveTotalDuenger();
        var kornerGesamt = getKornerGesamt();
        var kornerStr = Math.round(kornerGesamt).toLocaleString('de-DE');
        var miniResult = mf.querySelector('.mini-result') || mf;
        var duengerStr = duengerTotal > 0
          ? ' / ' + duengerTotal.toLocaleString('de-DE') + ' kg'
          : '';
        miniResult.innerHTML = 'Bedarf: <span class="mr-einheiten">' + formatEinheit(einheiten) + '</span> / ' + kornerStr + ' Körner' + duengerStr;
        miniResult.classList.remove('mini-result-empty');
      } else {
        var miniResult = mf.querySelector('.mini-result') || mf;
        miniResult.textContent = 'Bitte Hektar und Körner eingeben';
        miniResult.classList.add('mini-result-empty');
      }
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
