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
          // Issue 2 (Code-Review): DRY + NaN-Fix. Die alten bare reduces
          //   r.entries.reduce(function(s, e) { return s + e.einheit; }, 0)
          //   r.entries.reduce(function(s, e) { return s + e.duenger; }, 0)
          // hatten KEIN `|| 0`-Guard und produzierten NaN sobald ein Entry
          // kein `einheit`/`duenger`-Feld hatte. getTabRemaining zieht
          // getTabUsedEinheiten/Duenger (mit `|| 0` Guards) und liefert
          // basisE/D + remainingE/D + carryover-genettet in einem Aufruf.
          var rem = AppGlobals.getTabRemaining(r, i);
          var remaining = rem.remainingE;
          var remainingD = rem.remainingD;
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
        // Issue #347 (Folge-Bug zu PR #348): Mehrbedarf-Tabs (istE > solE
        // bzw. istD > solD) dürfen NICHT als Bedarfsempfänger in needE/needD
        // zählen. Ihr "Restbedarf" (ist-basis − used) ist konzeptuell
        // Quellen-Mehraufwand, der bereits durch den Netto-Saldo-Pool in
        // computeAllCarryovers() (#347) absorbiert wurde. Wenn wir ihn hier
        // erneut als positiven Bedarf zählen, verdoppelt sich die Cross-Tab-
        // Aggregations-Formel: totalNeedE enthält dann den Mehrbedarf, und
        // totalExcessE enthält ihn ebenfalls → remE wird künstlich groß.
        //
        // Spec-Anker: Issue #302 definiert "verteilbare_excess_saldi" als
        // Quellen-Salden, die im Phase-B-Cross-Tab-Pool landen. Bedarfe sind
        // per Definition "zu wenig" (ist < soll bzw. used < basis). Daher
        // wird hier analog zu computeAllCarryovers() Phase 1 (hasMehrbedarf-
        // Skip) jeder Mehrbedarf-Tab als nicht-bedarfs-empfangend markiert.
        //
        // NICHT angefasst (Spec #302): Z. 176-177 (Phase-B-Formel
        // rem = max(0, TotalNeed - TotalSaved + TotalExcess)).
        var solEForTab = AppGlobals.getTabTotalEinheiten(rt);
        var solDForTab = AppGlobals.getTabTotalDuenger(rt);
        var isMehrbedarfE = (tEinheiten > 0 && solEForTab > 0 && tEinheiten > solEForTab);
        var isMehrbedarfD = (tDuenger > 0 && solDForTab > 0 && tDuenger > solDForTab);
        // Issue #368 (Carryover-Regel 2): Bei sequenzieller Netting-Verteilung
        // kann ein Mehrbedarf-Tab UNTERDECKT bleiben, wenn der Pool kleiner
        // ist als die Summe aller Mehrbedarfe. Der ungedeckte Anteil
        // (istE − solE − cco.nettedEinheit) zählt als real offener Bedarf und
        // muss in den globalen Drill-Summary-Remaining auftauchen.
        // Vor #368 (PR #366, pro-rata) verdeckte die Gleichverteilung diese
        // Lücke nie — der Pool reichte entweder für alle oder niemanden ganz.
        var uncoveredE = isMehrbedarfE ? Math.max(0, tEinheiten - solEForTab - (cco.nettedEinheit || 0)) : 0;
        var uncoveredD = isMehrbedarfD ? Math.max(0, tDuenger - solDForTab - (cco.nettedDuenger || 0)) : 0;
        var needE = uncoveredE > 0
          ? uncoveredE
          : (isMehrbedarfE || tUsedE >= tEinheiten ? 0 : Math.max(0, tEinheiten - tUsedE));
        var needD = uncoveredD > 0
          ? uncoveredD
          : (isMehrbedarfD || tUsedE >= tDuenger ? 0 : Math.max(0, tDuenger - tUsedD));
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
      // Netto-Saldo IST vs SOLL in #ds_savings (aggregated across all tabs
      // that have IST-Fläche set). Positive = Ersparnis (IST < SOLL),
      // negative = Mehrbedarf (IST > SOLL). Issue #273: apply fahrgassenFaktor
      // via getTabTotalEinheiten/getTabIstEinheiten so display matches carryover.
      var dsSav = document.getElementById('ds_savings');
      if (dsSav) {
        var saldoETotal = 0;
        var saldoDTotal = 0;
        var anySaldo = false;
        for (var si = 0; si < allTabs.length; si++) {
          var sr = allTabs[si];
          if (!sr) continue;
          var srIstHa = AppGlobals.getTabIstHektar(sr);
          if (srIstHa > 0 && sr.hektar > 0) {
            anySaldo = true;
            saldoETotal += AppGlobals.getTabTotalEinheiten(sr) - AppGlobals.getTabIstEinheiten(sr);
            saldoDTotal += (sr.hektar - srIstHa) * (sr.duenger || 0);
          }
        }
        if (anySaldo && (Math.abs(saldoETotal) > 0.05 || Math.abs(saldoDTotal) > 0.05)) {
          var parts = [];
          if (Math.abs(saldoETotal) > 0.05) {
            parts.push((saldoETotal > 0 ? '+' : '') + AppGlobals.fmt(saldoETotal) + ' Einheiten Saatgut');
          }
          if (Math.abs(saldoDTotal) > 0.05) {
            parts.push((saldoDTotal > 0 ? '+' : '') + saldoDTotal.toLocaleString('de-DE') + ' kg Dünger');
          }
          if (saldoETotal > 0.05 || saldoDTotal > 0.05) {
            dsSav.textContent = 'Ersparnis: ' + parts.join(', ');
          } else {
            dsSav.textContent = 'Mehrbedarf: ' + parts.join(', ');
          }
          dsSav.style.display = 'block';
        } else {
          dsSav.textContent = '';
          dsSav.style.display = 'none';
        }
      }
    }

    // --- Render: Drill Log ---

    // Issue #336 follow-up #4: gemeinsamer Saldo-Helper für Per-Tab- und
    // Net-Totals-Anzeige. Berechnet die Roh-Differenzen für einen Tab:
    //   savingsE = SOLL - IST  (positiv wenn weniger verbraucht als geplant)
    //   excessE  = IST - SOLL   (positiv wenn mehr verbraucht als geplant)
    //   savingsD / excessD: kg/ha × Hektar-Differenz
    // KEINE Gates hier (nicht „nur wenn istHektar > 0") — die Aufrufer
    // entscheiden was sie anzeigen. _appendTabCarryoverBlocks blendet
    // negative Werte aus (Per-Tab zeigt nur die positive Seite), und
    // _appendNetTotalsBlock summiert über alle reiter und bildet das
    // Net. So bleibt der Net-Totals IMMER konsistent mit dem Per-Tab-
    // Saldo: was im Maschinen-Protokoll oder Ergebnis-Tab pro Tab als
    // Mehrbedarf/Ersparnis steht, fließt 1:1 in die Net-Zeile ein.
    function _computeTabSelfSaldo(rt) {
      if (!rt) return { savingsE: 0, savingsD: 0, excessE: 0, excessD: 0 };
      var sE = 0, sD = 0, eE = 0, eD = 0;
      if (rt.istHektar > 0 && rt.hektar > 0) {
        sE = AppGlobals.getTabTotalEinheiten(rt) - AppGlobals.getTabIstEinheiten(rt);
        sD = (rt.hektar - rt.istHektar) * (rt.duenger || 0);
        eE = AppGlobals.getTabIstEinheiten(rt) - AppGlobals.getTabTotalEinheiten(rt);
        eD = (rt.istHektar - rt.hektar) * (rt.duenger || 0);
      }
      return { savingsE: sE, savingsD: sD, excessE: eE, excessD: eD };
    }

    // Issue #336 follow-up #5b: Cross-Tab-Saldo für Drill-Log + Maschinen-
    // Protokoll (User-Feedback 2026-06-23, 5. Runde: „Es soll in den
    // Ergebnissen Bereich unter dünger verbleibend im Protokoll/drill log").
    // Aggregiert über ALLE reiter mittels _computeTabSelfSaldo (gleiche
    // Logik wie _appendTabCarryoverBlocks — Pattern 3 Single Source of
    // Truth). Net > 0 → grüne „Ersparnis"-Zeile. Net < 0 → rote „Mehrbedarf"-
    // Zeile. Wird in renderDrillLog() und renderMachineLog() jeweils
    // VOR den Per-Tab-Headern aufgerufen, unter „Dünger verbleibend".
    //
    // ACHTUNG (Issue #336 follow-up #4): _computeTabSelfSaldo gibt sowohl
    // savingsE (positiv) ALS AUCH excessE (positiv bei IST>SOLL) zurück,
    // wobei der jeweils andere Wert negativ ist. Wir summieren die
    // *positiven* Seiten separat, dann net = totalSav - totalExc.
    function _appendNetTotalsBlock(container) {
      if (!container) return;
      var totalSavE = 0, totalSavD = 0, totalExcE = 0, totalExcD = 0;
      var allReiter = AppGlobals.state.reiter || [];
      for (var ti = 0; ti < allReiter.length; ti++) {
        var rt = allReiter[ti];
        var s = _computeTabSelfSaldo(rt);
        if (s.savingsE > 0) totalSavE += s.savingsE;
        if (s.savingsD > 0) totalSavD += s.savingsD;
        if (s.excessE > 0) totalExcE += s.excessE;
        if (s.excessD > 0) totalExcD += s.excessD;
      }
      var netE = totalSavE - totalExcE;
      var netD = totalSavD - totalExcD;
      var showSavings = netE > 0.05 || netD > 0.05;
      var showExcess = netE < -0.05 || netD < -0.05;
      if (!showSavings && !showExcess) return;
      var label = document.createElement('div');
      label.className = 'drill-entry-tab-header drill-net-totals-header';
      label.textContent = 'Gesamt-Saldo (alle Tabs)';
      container.appendChild(label);
      if (showSavings) {
        var sParts = [];
        if (netE > 0.05) sParts.push(AppGlobals.fmt(netE) + ' Einheiten Saatgut');
        if (netD > 0.05) sParts.push(netD.toLocaleString('de-DE') + ' kg Dünger');
        var sDiv = document.createElement('div');
        sDiv.className = 'net-totals-line net-totals-savings';
        sDiv.textContent = 'Ersparnis: ' + sParts.join(', ');
        container.appendChild(sDiv);
      }
      if (showExcess) {
        var eParts = [];
        if (netE < -0.05) eParts.push(AppGlobals.fmt(-netE) + ' Einheiten Saatgut');
        if (netD < -0.05) eParts.push((-netD).toLocaleString('de-DE') + ' kg Dünger');
        var eDiv = document.createElement('div');
        eDiv.className = 'net-totals-line net-totals-excess';
        eDiv.textContent = 'Mehrbedarf aus überschrittenen Flächen: -' + eParts.join(', ');
        container.appendChild(eDiv);
      }
    }

    // Issue #309: Per-tab carryover/savings/excess block helper.
    // Appends the three optional divs (.drill-savings / .drill-carryover /
    // .drill-excess) into the given container, in the order savings → carryover
    // → excess. Used by renderDrillLog() (under each tab-header) AND by
    // renderMachineLog() (under each per-tab sub-header). Single source of
    // truth so both containers stay in sync — see "3 Carryover-Render-Sites"
    // rule in the agrar-rechner skill (renderDrillSummary, render-dashboard,
    // inline render-results), of which the tab-anchored blocks are now a 4th
    // site that has to remain consistent.
    function _appendTabCarryoverBlocks(tabIdx, ct, container) {
      if (!ct) return;
      var cco = AppGlobals.getCarryover(tabIdx);
      var s = _computeTabSelfSaldo(ct);
      // Per-Tab zeigt nur die positive Seite: savings wenn > 0, excess wenn > 0.
      // (Der Net-Totals summiert beide Seiten und bildet das Net — s. Helper.)
      if (s.savingsE > 0.05 || s.savingsD > 0.05) {
        var sParts = [];
        if (s.savingsE > 0.05) sParts.push(AppGlobals.fmt(s.savingsE) + ' Einheiten Saatgut');
        if (s.savingsD > 0.05) sParts.push(s.savingsD.toLocaleString('de-DE') + ' kg Dünger');
        var sDiv = document.createElement('div');
        sDiv.className = 'drill-savings';
        sDiv.textContent = 'Ersparnis: ' + sParts.join(', ');
        container.appendChild(sDiv);
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
      if (s.excessE > 0.05 || s.excessD > 0.05) {
        var eParts = [];
        if (s.excessE > 0.05) eParts.push(AppGlobals.fmt(s.excessE) + ' Einheiten Saatgut');
        if (s.excessD > 0.05) eParts.push(s.excessD.toLocaleString('de-DE') + ' kg Dünger');
        var eDiv = document.createElement('div');
        eDiv.className = 'drill-excess';
        eDiv.textContent = 'Mehrbedarf aus überschrittenen Flächen: -' + eParts.join(', ');
        container.appendChild(eDiv);
      }
    }

    // Issue #309: tab has a carryover signal worth showing (savings source,
    // excess source, or carryover received from another tab).
    function _tabHasCarryoverSignal(tabIdx, ct) {
      if (!ct) return false;
      var cco = AppGlobals.getCarryover(tabIdx);
      if (cco.savedEinheit > 0.05 || cco.savedDuenger > 0.05) return true;
      var s = _computeTabSelfSaldo(ct);
      if (s.savingsE > 0.05 || s.savingsD > 0.05) return true;
      if (s.excessE > 0.05 || s.excessD > 0.05) return true;
      return false;
    }

    function renderDrillLog() {
      var container = document.getElementById('drill_entries');
      if (!container) return;
      container.innerHTML = '';
      var totalSummary = document.getElementById('ds_total_summary');
      // All-tabs aggregation (T3): iterate state.reiter in index order.
      // Each tab with entries.length > 0 gets a drill-entry-tab-header div,
      // followed by its entries in chronological order. #N numbering resets
      // per tab (Option A — consistent with single-tab behaviour, test 09
      // unchanged). Empty state only when ALL tabs have empty entries AND no
      // tab has a carryover signal worth showing.
      var allTabs = AppGlobals.state.reiter || [];
      var hasAnyEntry = allTabs.some(function(r) { return r && r.entries && r.entries.length > 0; });
      if (!hasAnyEntry) {
        // Issue #309: still show carryover blocks if ANY tab has a signal —
        // a savings/excess source with no entries yet is a valid edge case
        // (IST set, no drillAdd done). Only collapse to "Noch nichts
        // eingefüllt" when nothing meaningful can be displayed at all.
        var anyCarryover = allTabs.some(function(r, i) { return _tabHasCarryoverSignal(i, r); });
        if (!anyCarryover) {
          if (totalSummary) totalSummary.textContent = '';
          var empty = document.createElement('div');
          empty.className = 'drill-empty';
          empty.textContent = 'Noch nichts eingefüllt';
          container.appendChild(empty);
          return;
        }
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
      // Issue #336 follow-up #5b: Cross-Tab-Saldo als erster Block im
      // Drill-Log, vor den Per-Tab-Headern. Steht im „Ergebnisse Bereich"
      // (unter „Dünger verbleibend" / ds_savings / drill-summary-rows).
      _appendNetTotalsBlock(container);
      // Iterate per tab in index order. Per-tab #N numbering (Option A):
      // entries[0] = '#1', entries[1] = '#2', etc. Consistent with single-tab
      // behaviour — test 09-blind-spots ('drill entry shows time prefix when
      // time is set') still sees entry-text[0] as the first entry of the
      // only tab with entries.
      //
      // Issue #309: each tab-section is now [tab-header → carryover blocks
      // (if any) → entries]. Previously the carryover blocks were rendered in
      // a separate first loop ABOVE all tab-headers, which left them visually
      // unanchored (user could not tell which tab they belonged to). Moving
      // them inside the per-tab loop binds them to the right tab.
      allTabs.forEach(function(rt, tabIdx) {
        if (!rt) return;
        var hasEntries = rt.entries && rt.entries.length > 0;
        if (!hasEntries && !_tabHasCarryoverSignal(tabIdx, rt)) return;
        var header = document.createElement('div');
        header.className = 'drill-entry-tab-header';
        header.textContent = rt.name || ('Tab ' + (tabIdx + 1));
        container.appendChild(header);
        // Carryover blocks (Ersparnis / Übertrag / Mehrbedarf) directly below
        // the tab-header so users can see which tab each block belongs to.
        _appendTabCarryoverBlocks(tabIdx, rt, container);
        if (!hasEntries) return;
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
            var t = AppGlobals.formatEntryTime(entry.time);
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
      // Header
      var header = document.createElement('div');
      header.className = 'drill-entry-tab-header';
      header.textContent = 'Maschinen-Protokoll';
      container.appendChild(header);
      // Issue #336 follow-up #5b: Cross-Tab-Saldo als erster Block im
      // Maschinen-Protokoll, VOR den Per-Tab-Sub-Headern. Im „Ergebnisse
      // Bereich" (zwischen Maschinen-Protokoll-Header und Tab-Sub-Headers).
      _appendNetTotalsBlock(container);
      // Issue #309: per-tab carryover sections (Ersparnis / Übertrag / Mehrbedarf)
      // — the machine-log entries themselves are a flat global list (no tabIdx
      // on machineLog entries, by design), but the carryover blocks are
      // per-tab and must be tab-anchored here too. Without this, a user
      // reading the Maschinen-Protokoll view sees carryover blocks visually
      // disconnected from the tab they belong to (matches the original bug
      // repro in #309). Use the same _appendTabCarryoverBlocks helper as
      // renderDrillLog() so both containers stay in sync (single source of
      // truth for the "3 Carryover-Render-Sites" rule).
      var allTabs = AppGlobals.state.reiter || [];
      allTabs.forEach(function(rt, tabIdx) {
        if (!rt || !_tabHasCarryoverSignal(tabIdx, rt)) return;
        var sub = document.createElement('div');
        sub.className = 'drill-entry-tab-header drill-machine-log-tab-subheader';
        sub.textContent = rt.name || ('Tab ' + (tabIdx + 1));
        container.appendChild(sub);
        _appendTabCarryoverBlocks(tabIdx, rt, container);
      });
      if (log.length === 0) return;
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
          var t = AppGlobals.formatEntryTime(entry.time);
          parts.push(t + ' –');
        }
        // Issue #307: `zaehlerStand` starts at 0; `||` would silently fall through
        // to `entry.hektar` (the target). For display, prefer an explicit `!= null`
        // check so a freshly-started log (zaehlerStand=0) shows "0,0 ha" instead of
        // the misleading target-hektar.
        var displayHa = entry.zaehlerStand != null ? entry.zaehlerStand : entry.hektar;
        if (entry.zaehlerStand != null || entry.hektar) {
          parts.push(displayHa.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' ha');
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
        // Issue #307: `zaehlerStand` is the drill's meter counter and starts at 0;
        // `||` falls through 0 to `entry.hektar` (the target), so `driven = zaehler - lastZaehler`
        // would phantom-inflate by the full target on the first entry. Use an explicit
        // `!= null` check so a `zaehlerStand=0` entry correctly reports `driven = 0`.
        var zaehler = entry.zaehlerStand != null
          ? entry.zaehlerStand
          : (entry.hektar != null ? entry.hektar : 0);
        var driven = Math.max(0, zaehler - lastZaehler);
        if (unitsPerHa > 0) cumEinheit = Math.max(0, cumEinheit - driven * unitsPerHa);
        if (duengerPerHa > 0) cumDuenger = Math.max(0, cumDuenger - driven * duengerPerHa);
        cumEinheit += entry.einheit || 0;
        cumDuenger += entry.duenger || 0;
        lastZaehler = zaehler;
        // Prognose row (one per entry that has rates)
        // Issue #307: per-entry check (`entry.einheit > 0`) suppresses the Saat
        // prognose on a follow-up entry that only refilled Dünger — even though
        // the cumulative tank is still > 0. Switch to `cumEinheit > 0` so the
        // prognose is correct for every entry as long as some Saat remains.
        var prognoseParts = [];
        if (unitsPerHa > 0 && cumEinheit > 0) {
          var saatLeer = zaehler + cumEinheit / unitsPerHa;
          prognoseParts.push('Saat leer bei ' + AppGlobals.fmt(saatLeer) + ' ha');
        }
        if (duengerPerHa > 0 && cumDuenger > 0) {
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
