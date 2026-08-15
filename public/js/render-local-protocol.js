// ============================================================================
// RENDER-LOCAL-PROTOCOL — Redesign des lokalen Protokolls (Issue: Redesign)
//
// Lade-Reihenfolge: state → calc → ui → render-tabs → render-results
//   → render-drill → render-dashboard → render-local-protocol (DIESE DATEI)
//   → main.js
//
// render-local-protocol.js braucht:
//   - calculations.js (parseEntryDateKey, formatEntryTimeHHMM, formatDateKeyGerman,
//     formatDateKeyShort, isTodayKey, EPSILON_QUANTITY, getTabRemaining,
//     computeFahrgassenFaktor, getTabRates, getTabIstHektar, getCarryover,
//     getTabTotalEinheiten, getTabIstEinheiten, getTabTotalDuenger,
//     getTabIstDuenger, getTabUsedEinheiten, getTabUsedDuenger, fmt, formatEinheit)
//   - state (AppGlobals.state) und ui-handlers (drillRemove, drillMachineRemove,
//     setProtocolView, toggleProtocolAccordion, requestLocalProtocolDelete)
//
// Fachliche Garantie: ALLE Werte (Gesamtbilanz, Verbleibend, Ersparnis,
// Mehrbedarf) stammen aus existierenden Aggregations-/Berechnungs-Helpern.
// Keine Demowerte hardcoded. Carryover-Senken-Modell bleibt unverändert
// (gleicher Code-Pfad wie renderDrillSummary → computeAllCarryovers).
// ============================================================================

    // --- Helfer: kompakte Status-Zeile pro Schlag ---
    //
    // Liefert ein Array von Klassen+Text-Tokens. Reine Berechnung, kein DOM.
    // Hektar-Position (z. B. "19,0 ha") + Carryover/Mehrbedarf/Ersparnis-
    // Status, abgeleitet aus r und Carryover-Index.
    // pattern: [{ class: 'positive'|'warning'|'transfer'|'neutral', text: '...' }, ...]
    function _fieldCardStatusPieces(tabIdx, r) {
      if (!r) return [];
      var out = [];
      var istHek = AppGlobals.getTabIstHektar(r);
      var hectareForDisplay = istHek > 0 ? istHek : r.hektar;
      if (hectareForDisplay > 0) {
        out.push({ class: 'field-status-ha', text: AppGlobals.fmt(hectareForDisplay) + ' ha' });
      } else {
        out.push({ class: 'field-status-ha', text: '— ha' });
      }
      // Carryover / Saldo-Zeile (siehe _computeTabSelfSaldo in render-drill.js)
      // wird hier reimplementiert als reine Berechnung ohne Render-Coupling.
      var savingsE = 0, savingsD = 0, excessE = 0, excessD = 0;
      if (istHek > 0 && r.hektar > 0) {
        savingsE = AppGlobals.getTabTotalEinheiten(r) - AppGlobals.getTabIstEinheiten(r);
        savingsD = (r.hektar - istHek) * (r.duenger || 0);
        excessE  = AppGlobals.getTabIstEinheiten(r) - AppGlobals.getTabTotalEinheiten(r);
        excessD  = (istHek - r.hektar) * (r.duenger || 0);
      }
      if (excessE > AppGlobals.EPSILON_QUANTITY || excessD > AppGlobals.EPSILON_QUANTITY) {
        var eParts = [];
        if (excessE > AppGlobals.EPSILON_QUANTITY) {
          eParts.push(AppGlobals.fmt(excessE) + ' E');
        }
        if (excessD > AppGlobals.EPSILON_QUANTITY) {
          eParts.push(Math.round(excessD).toLocaleString('de-DE') + ' kg');
        }
        out.push({ class: 'warning', text: 'Mehrbedarf ' + eParts.join(' · ') });
      } else if (savingsE > AppGlobals.EPSILON_QUANTITY || savingsD > AppGlobals.EPSILON_QUANTITY) {
        var sParts = [];
        if (savingsE > AppGlobals.EPSILON_QUANTITY) {
          sParts.push(AppGlobals.fmt(savingsE) + ' E');
        }
        if (savingsD > AppGlobals.EPSILON_QUANTITY) {
          sParts.push(Math.round(savingsD).toLocaleString('de-DE') + ' kg');
        }
        out.push({ class: 'positive', text: '+' + sParts.join(' · ') + ' eingespart' });
      }
      // Eingefüllte Mengen (Σ über alle Entries): kompakte Anzeige unter
      // dem Hektar. Beispiel "0,9 Einheiten · 500 kg Dünger".
      var usedE = AppGlobals.getTabUsedEinheiten(r);
      var usedD = AppGlobals.getTabUsedDuenger(r);
      if (usedE > AppGlobals.EPSILON_QUANTITY || usedD > AppGlobals.EPSILON_QUANTITY) {
        var usedParts = [];
        if (usedE > AppGlobals.EPSILON_QUANTITY) {
          usedParts.push(AppGlobals.fmt(usedE) + ' Einheiten');
        }
        if (usedD > AppGlobals.EPSILON_QUANTITY) {
          usedParts.push(Math.round(usedD).toLocaleString('de-DE') + ' kg Dünger');
        }
        out.push({ class: 'neutral', text: usedParts.join(' · ') });
      }
      return out;
    }

    // --- Helfer: kürzt Buchungs-Text für den Header (ohne Hektar/Einheit-Suffix) ---
    function _shortStatusText(pieceText) {
      // "0,9 Einheiten" → "0,9 E"; "500 kg Dünger" → "500 kg"
      return String(pieceText || '')
        .replace(/\s*Einheiten$/, ' E')
        .replace(/\s*kg Dünger$/, ' kg');
    }

    function _getCurrentMachineForecast() {
      var log = AppGlobals.state.machineLog || [];
      var activeRates = AppGlobals.getTabRates(AppGlobals.state.activeReiter || 0);
      var unitsPerHa = activeRates.unitsPerHa;
      var duengerPerHa = activeRates.duengerPerHa;
      var cumEinheit = 0, cumDuenger = 0, lastZaehler = 0;

      for (var i = 0; i < log.length; i++) {
        var entry = log[i] || {};
        var zaehler = entry.zaehlerStand != null
          ? entry.zaehlerStand
          : (entry.hektar != null ? entry.hektar : 0);
        var driven = Math.max(0, zaehler - lastZaehler);
        if (unitsPerHa > 0) cumEinheit = Math.max(0, cumEinheit - driven * unitsPerHa);
        if (duengerPerHa > 0) cumDuenger = Math.max(0, cumDuenger - driven * duengerPerHa);
        cumEinheit += entry.einheit || 0;
        cumDuenger += entry.duenger || 0;
        lastZaehler = zaehler;
      }

      return {
        hasLog: log.length > 0,
        saatLeer: unitsPerHa > 0 && cumEinheit > 0
          ? lastZaehler + cumEinheit / unitsPerHa
          : null,
        duengerLeer: duengerPerHa > 0 && cumDuenger > 0
          ? lastZaehler + cumDuenger / duengerPerHa
          : null
      };
    }

    function _renderBalanceForecast() {
      var container = document.getElementById('local_protocol_balance_forecast');
      if (!container) return;
      while (container.firstChild) container.removeChild(container.firstChild);
      var forecast = _getCurrentMachineForecast();

      if (!forecast.hasLog) {
        var empty = document.createElement('span');
        empty.className = 'lp-balance-forecast-empty';
        empty.textContent = 'Noch keine Leerstandsprognose';
        container.appendChild(empty);
        return;
      }

      function addForecast(label, value, icon) {
        var row = document.createElement('div');
        row.className = 'lp-balance-forecast-row';
        var marker = document.createElement('span');
        marker.className = 'lp-balance-forecast-icon';
        marker.setAttribute('aria-hidden', 'true');
        marker.textContent = icon;
        var text = document.createElement('span');
        text.textContent = value != null
          ? label + ' leer bei ' + AppGlobals.fmt(value) + ' ha'
          : label + ': noch nicht berechenbar';
        row.appendChild(marker);
        row.appendChild(text);
        container.appendChild(row);
      }

      addForecast('Saat', forecast.saatLeer, '🌱');
      addForecast('Dünger', forecast.duengerLeer, '🧪');
    }

    // --- Render: Gesamtbilanz (kompakt) ---
    //
    // Sourced from existing aggregations:
    // - Σ Saat-Bedarf (IST-bevorzugt) = Σ getTabRemaining(r, i).basisE
    // - Σ Saat-Verbleibend (mit Senken-Zuschlag) = Σ getTabRemaining(r, i).remainingE
    // - Σ Dünger analog
    function renderLocalProtocolBalance() {
      var card = document.getElementById('local_protocol_balance');
      if (!card) return;
      var grid = document.getElementById('local_protocol_balance_grid');
      var time = document.getElementById('local_protocol_balance_time');
      var reiter = AppGlobals.state.reiter || [];
      var totalBasisE = 0, totalRemainingE = 0;
      var totalBasisD = 0, totalRemainingD = 0;
      for (var ti = 0; ti < reiter.length; ti++) {
        var rt = reiter[ti];
        if (!rt) continue;
        if (rt.hektar > 0 && rt.koerner > 0) {
          var rem = AppGlobals.getTabRemaining(rt, ti);
          totalBasisE += rem.basisE;
          totalRemainingE += rem.remainingE;
          totalBasisD += rem.basisD;
          totalRemainingD += rem.remainingD;
        }
      }
      // Saatgut und Dünger zeigen denselben fachlichen Zustand:
      // den noch offenen Gesamtbedarf über alle Schläge.
      var saatShown = totalBasisE > 0
        ? AppGlobals.fmt(totalRemainingE) + ' Einh.'
        : '—';
      var saatSubText = totalBasisE > 0 ? 'verbleibend' : '—';
      // Dünger: Verbleibend (mit Senken-Modell konsistent zur Summary).
      var duengerShown = totalBasisD > 0
        ? Math.round(totalRemainingD).toLocaleString('de-DE') + ' kg'
        : '—';
      var duengerSubText = totalBasisD > 0 ? 'verbleibend' : '—';
      if (grid) {
        // Build metric rows defensively (no innerHTML strings with user data).
        while (grid.firstChild) grid.removeChild(grid.firstChild);
        var left = document.createElement('div');
        left.className = 'lp-metric';
        var leftSmall = document.createElement('small');
        leftSmall.textContent = 'Saatgut';
        var leftStrong = document.createElement('strong');
        leftStrong.textContent = saatShown;
        var leftSpan = document.createElement('span');
        leftSpan.textContent = saatSubText;
        left.appendChild(leftSmall); left.appendChild(leftStrong); left.appendChild(leftSpan);
        var divider = document.createElement('div');
        divider.className = 'lp-balance-divider';
        divider.setAttribute('aria-hidden', 'true');
        var right = document.createElement('div');
        right.className = 'lp-metric';
        var rightSmall = document.createElement('small');
        rightSmall.textContent = 'Dünger';
        var rightStrong = document.createElement('strong');
        rightStrong.textContent = duengerShown;
        var rightSpan = document.createElement('span');
        rightSpan.textContent = duengerSubText;
        right.appendChild(rightSmall); right.appendChild(rightStrong); right.appendChild(rightSpan);
        grid.appendChild(left);
        grid.appendChild(divider);
        grid.appendChild(right);
      }
      _renderBalanceForecast();
      if (time) {
        // "Heute, 14. Aug." — relativ zur ersten gefundenen Buchung mit
        // Datum. Wir nehmen das jüngste Datum aus Einträgen oder Log; wenn
        // nichts da → "Heute, ..."
        var today = new Date();
        var todayKey = AppGlobals._dateKeyFromDate ? AppGlobals._dateKeyFromDate(today) : '';
        var label = 'Heute, ' + (todayKey ? AppGlobals.formatDateKeyShort(todayKey) : '');
        time.textContent = label;
        time.setAttribute('datetime', todayKey);
      }
    }

    // --- Render: Schläge-Accordion (per Tagesgruppe) ---
    //
    // Gruppierung: alle Buchungen aller reiter nach dateKey (YYYY-MM-DD).
    // Pro Tag ein Heading + Accordion-Cards (ein Schlag pro Card). Single-
    // Open: state.protocolOpenCards[<dateKey>] = "<tabIdx>:<rowIdx>" oder
    // ''. Beim Klick auf einen anderen Schlag wird der vorherige
    // geschlossen — entweder im selben oder einem anderen Datum.
    function renderLocalProtocolFields() {
      var panel = document.getElementById('local_protocol_fields_panel');
      if (!panel) return;
      while (panel.firstChild) panel.removeChild(panel.firstChild);

      var reiter = AppGlobals.state.reiter || [];
      var collected = []; // [{ tabIdx, r, entries: [{ entry, dateKey }] }]
      // Schläge MIT Buchungen immer anzeigen
      for (var ti = 0; ti < reiter.length; ti++) {
        var rt = reiter[ti];
        if (!rt || !rt.entries || rt.entries.length === 0) continue;
        var tagged = [];
        for (var ei = 0; ei < rt.entries.length; ei++) {
          var entry = rt.entries[ei];
          tagged.push({ entry: entry, actualIdx: ei, dateKey: AppGlobals.parseEntryDateKey(entry.time) || 'unknown' });
        }
        collected.push({ tabIdx: ti, r: rt, entries: tagged });
      }
      // Schläge MIT Carryover-Signal (Ersparnis/Mehrbedarf) ABER OHNE
      // Entries: leerer Slot "heute", damit der Landwirt sieht, dass der
      // Tab Saldo hat — siehe Issue #336 (Net-Totals-Block) und #309.
      var emptyCards = [];
      for (var tci = 0; tci < reiter.length; tci++) {
        var rt2 = reiter[tci];
        if (!rt2) continue;
        if (rt2.entries && rt2.entries.length > 0) continue;
        if (!_tabHasCarryoverOnlySignal(rt2)) continue;
        emptyCards.push({ tabIdx: tci, r: rt2, entries: [] });
      }
      if (collected.length === 0 && emptyCards.length === 0) {
        var empty = document.createElement('p');
        empty.className = 'lp-empty';
        empty.textContent = 'Noch keine Buchungen — fülle oben die Maschine ein, um dein Protokoll zu starten.';
        panel.appendChild(empty);
        return;
      }
      // Datum-Gruppen (alle dateKeys aller Schläge sortiert desc).
      var dateMap = {}; // dateKey → { totalEntries, cards: [{ tabIdx, r, entries }] }
      var dateOrder = [];
      for (var ci = 0; ci < collected.length; ci++) {
        var c = collected[ci];
        // Gruppierung innerhalb der Schläge nach Datum
        var perDate = {};
        for (var k = 0; k < c.entries.length; k++) {
          var dk = c.entries[k].dateKey;
          if (!perDate[dk]) perDate[dk] = [];
          perDate[dk].push(c.entries[k]);
        }
        var keys = Object.keys(perDate);
        for (var ki = 0; ki < keys.length; ki++) {
          var dk2 = keys[ki];
          if (!dateMap[dk2]) {
            dateMap[dk2] = { totalEntries: 0, cards: [] };
            dateOrder.push(dk2);
          }
          dateMap[dk2].totalEntries += perDate[dk2].length;
          dateMap[dk2].cards.push({
            tabIdx: c.tabIdx,
            r: c.r,
            entries: perDate[dk2]
          });
        }
      }
      // Leere Carryover-Cards unter "Heute" einsortieren.
      var todayKey = AppGlobals._dateKeyFromDate ? AppGlobals._dateKeyFromDate(new Date()) : '';
      if (emptyCards.length > 0) {
        if (!dateMap[todayKey]) {
          dateMap[todayKey] = { totalEntries: 0, cards: [] };
          dateOrder.unshift(todayKey); // ganz oben (neueste zuerst)
        }
        emptyCards.forEach(function(c) {
          dateMap[todayKey].cards.push(c);
        });
      }
      dateOrder.sort(function(a, b) {
        // unknown ans Ende; sortieren desc; bei Gleichstand b vor a
        if (a === 'unknown' && b === 'unknown') return 0;
        if (a === 'unknown') return 1;
        if (b === 'unknown') return -1;
        return a < b ? 1 : (a > b ? -1 : 0);
      });
      // DateHeading pro Tagesgruppe
      for (var di = 0; di < dateOrder.length; di++) {
        var dk3 = dateOrder[di];
        var info = dateMap[dk3];
        var heading = document.createElement('div');
        heading.className = 'lp-date-heading';
        var headingTitle = document.createElement('h2');
        if (dk3 === 'unknown') {
          headingTitle.textContent = 'Ohne Datum';
        } else if (dk3 === todayKey) {
          headingTitle.textContent = 'Heute · ' + AppGlobals.formatDateKeyGerman(dk3).replace(/\s+\d{4}$/, '');
        } else {
          headingTitle.textContent = AppGlobals.formatDateKeyGerman(dk3);
        }
        var headingSpan = document.createElement('span');
        var countTxt = info.totalEntries + (info.totalEntries === 1 ? ' Buchung' : ' Buchungen');
        headingSpan.textContent = countTxt;
        heading.appendChild(headingTitle);
        heading.appendChild(headingSpan);
        panel.appendChild(heading);
        // Cards in tabIdx-Reihenfolge (Single-Open über alle Karten aller Tage
        // hinweg: state.protocolOpenCards[dk] = "<tabIdx>" oder '').
        var sortedCards = info.cards.slice().sort(function(a, b) { return a.tabIdx - b.tabIdx; });
        for (var cardI = 0; cardI < sortedCards.length; cardI++) {
          var cardData = sortedCards[cardI];
          var cardKey = dk3 + ':' + cardData.tabIdx;
          var storedOpen = AppGlobals.state.protocolOpenCards || {};
          // Single-Open: ein Eintrag pro Datum-Key markiert die offene Karte.
          // Hier lesen wir den pro-Karte-Open-State und schließen ggf.
          var localOpen = (storedOpen[dk3] === String(cardData.tabIdx));
          panel.appendChild(_buildFieldCard(cardData.tabIdx, cardData.r, cardData.entries, dk3, localOpen, cardKey));
        }
      }
      var hint = document.createElement('p');
      hint.className = 'lp-hint';
      hint.textContent = 'Tippe auf einen Schlag, um seine Buchungen zu öffnen.';
      panel.appendChild(hint);
    }

    // Hat der Tab einen Saldo (Ersparnis oder Mehrbedarf), den es wert ist
    // anzuzeigen, OHNE dass es Entries gibt? Wenn ja, zeigen wir eine leere
    // Accordion-Card im "Heute"-Datum damit der Landwirt den Saldo sieht.
    function _tabHasCarryoverOnlySignal(r) {
      if (!r) return false;
      var istHek = AppGlobals.getTabIstHektar ? AppGlobals.getTabIstHektar(r) : (r.istHektar || 0);
      if (istHek <= 0 || r.hektar <= 0) return false;
      var savingsE = AppGlobals.getTabTotalEinheiten(r) - AppGlobals.getTabIstEinheiten(r);
      var excessE  = AppGlobals.getTabIstEinheiten(r) - AppGlobals.getTabTotalEinheiten(r);
      var savingsD = (r.hektar - istHek) * (r.duenger || 0);
      var excessD  = (istHek - r.hektar) * (r.duenger || 0);
      return savingsE > AppGlobals.EPSILON_QUANTITY
          || excessE > AppGlobals.EPSILON_QUANTITY
          || savingsD > AppGlobals.EPSILON_QUANTITY
          || excessD > AppGlobals.EPSILON_QUANTITY;
    }

    function _buildFieldCard(tabIdx, r, entries, dateKey, isOpen, cardKey) {
      var article = document.createElement('article');
      article.className = 'lp-field-card' + (isOpen ? ' open' : '');
      article.setAttribute('data-tab-idx', String(tabIdx));
      article.setAttribute('data-date-key', dateKey);
      article.setAttribute('data-card-key', cardKey);

      var summaryBtn = document.createElement('button');
      summaryBtn.type = 'button';
      summaryBtn.className = 'lp-field-summary';
      summaryBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      summaryBtn.setAttribute('aria-controls', 'lp-entries-' + cardKey.replace(/[^a-zA-Z0-9_-]/g, '_'));

      var summaryInner = document.createElement('span');
      summaryInner.className = 'lp-field-summary-inner';

      var titleRow = document.createElement('span');
      titleRow.className = 'lp-field-title-row';

      var title = document.createElement('span');
      title.className = 'lp-field-title';
      title.textContent = r.name || ('Schlag ' + (tabIdx + 1));
      titleRow.appendChild(title);

      var countPill = document.createElement('span');
      countPill.className = 'lp-count';
      countPill.textContent = entries.length + (entries.length === 1 ? ' Buchung' : ' Buchungen');
      titleRow.appendChild(countPill);

      summaryInner.appendChild(titleRow);

      var statusRow = document.createElement('span');
      statusRow.className = 'lp-field-status';
      var pieces = _fieldCardStatusPieces(tabIdx, r);
      for (var pi = 0; pi < pieces.length; pi++) {
        var piece = pieces[pi];
        var pieceEl = document.createElement('span');
        // 'field-status-ha' ist die Hektar-Position (neutral).
        if (piece.class === 'field-status-ha') pieceEl.className = 'lp-status-ha';
        else if (piece.class === 'positive') pieceEl.className = 'positive';
        else if (piece.class === 'warning') pieceEl.className = 'warning';
        else pieceEl.className = 'neutral';
        pieceEl.textContent = _shortStatusText(piece.text);
        statusRow.appendChild(pieceEl);
      }
      summaryInner.appendChild(statusRow);

      summaryBtn.appendChild(summaryInner);

      var chevron = document.createElement('span');
      chevron.className = 'lp-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      chevron.textContent = '⌄';
      summaryBtn.appendChild(chevron);

      summaryBtn.onclick = (function(ti, dk, ck) {
        return function() {
          if (typeof AppGlobals.toggleProtocolAccordion === 'function') {
            AppGlobals.toggleProtocolAccordion(ti, dk, ck);
          }
        };
      })(tabIdx, dateKey, cardKey);

      article.appendChild(summaryBtn);

      var body = document.createElement('div');
      body.className = 'lp-entries';
      body.id = 'lp-entries-' + cardKey.replace(/[^a-zA-Z0-9_-]/g, '_');
      if (!isOpen) body.style.display = 'none';

      for (var ei = 0; ei < entries.length; ei++) {
        var tagged = entries[ei];
        body.appendChild(_buildEntryRow(tabIdx, tagged.actualIdx, tagged.entry));
      }

      article.appendChild(body);
      return article;
    }

    function _buildEntryRow(tabIdx, actualIdx, entry) {
      var row = document.createElement('div');
      row.className = 'lp-entry';
      row.setAttribute('data-tab-idx', String(tabIdx));
      row.setAttribute('data-entry-idx', String(actualIdx));
      row.setAttribute('role', 'group');

      var time = document.createElement('time');
      time.className = 'lp-time';
      time.textContent = AppGlobals.formatEntryTimeHHMM(entry.time) || '—';
      if (entry.time) time.setAttribute('datetime', String(entry.time));
      row.appendChild(time);

      var main = document.createElement('div');
      main.className = 'lp-entry-main';

      var mainStrong = document.createElement('strong');
      var einheitText = AppGlobals.formatEinheit(entry.einheit || 0);
      // formatEinheit liefert "1,0 Einheit" für 1 und "1,5 Einheiten" sonst.
      // Im Demo-Header erscheint "0,8 Einheiten" — wir übernehmen die
      // formatEinheit-Singular/Plural-Regel des bestehenden Codes.
      mainStrong.textContent = einheitText;
      if (entry.duenger && entry.duenger > 0) {
        mainStrong.textContent += ' · ' + Math.round(entry.duenger).toLocaleString('de-DE') + ' kg Dünger';
      }
      main.appendChild(mainStrong);

      var zaehler = entry.zaehlerStand != null ? entry.zaehlerStand : entry.istHektar;
      if (zaehler && zaehler > 0) {
        var mainSmall = document.createElement('small');
        mainSmall.textContent = 'Zählerstand ' + zaehler.toLocaleString('de-DE', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1
        }) + ' ha';
        main.appendChild(mainSmall);
      } else if (entry.hektar && entry.hektar > 0) {
        var planHa = document.createElement('small');
        planHa.textContent = 'Soll-Fläche ' + entry.hektar.toLocaleString('de-DE', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1
        }) + ' ha';
        main.appendChild(planHa);
      }

      row.appendChild(main);

      // Drei-Punkte-Aktion statt roter X. Click öffnet Action-Sheet.
      var actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.className = 'entry-action';
      actionBtn.textContent = '⋮';
      var timeLabel = AppGlobals.formatEntryTimeHHMM(entry.time) || '—';
      actionBtn.setAttribute('aria-label', 'Aktionen für Buchung um ' + timeLabel);
      actionBtn.setAttribute('data-entry-action', 'field');
      actionBtn.onclick = (function(ti, ei, t) {
        return function() {
          if (typeof AppGlobals.requestLocalProtocolDelete === 'function') {
            AppGlobals.requestLocalProtocolDelete('field', { tabIdx: ti, entryIdx: ei }, t);
          }
        };
      })(tabIdx, actualIdx, timeLabel);
      row.appendChild(actionBtn);

      return row;
    }

    // --- Render: Maschinenfüllungen ---
    //
    // Per Datum gruppiert. Jede Buchung zeigt Einheiten/Dünger (eingefüllt)
    // + Prognose aus getTabRates(activeIdx). Forecast wird nur gezeigt wenn
    // die aktive Tab-Rate > 0 ist und kumulativ > 0.
    function renderLocalProtocolMachine() {
      var panel = document.getElementById('local_protocol_machine_panel');
      if (!panel) return;
      while (panel.firstChild) panel.removeChild(panel.firstChild);

      var log = AppGlobals.state.machineLog || [];
      if (log.length === 0) {
        var empty = document.createElement('p');
        empty.className = 'lp-empty';
        empty.textContent = 'Noch keine Maschinenfüllungen — fülle oben die Maschine ein, um sie hier zu sehen.';
        panel.appendChild(empty);
        return;
      }

      // Datum-Gruppierung
      var dateMap = {}; var dateOrder = [];
      for (var li = 0; li < log.length; li++) {
        var en = log[li];
        var dk = AppGlobals.parseEntryDateKey(en.time) || 'unknown';
        if (!dateMap[dk]) { dateMap[dk] = []; dateOrder.push(dk); }
        dateMap[dk].push({ entry: en, originalIdx: li });
      }
      dateOrder.sort(function(a, b) {
        if (a === 'unknown' && b === 'unknown') return 0;
        if (a === 'unknown') return 1;
        if (b === 'unknown') return -1;
        return a < b ? 1 : (a > b ? -1 : 0);
      });

      var totalEntries = log.length;
      var header = document.createElement('div');
      header.className = 'lp-date-heading';
      var headerTitle = document.createElement('h2');
      headerTitle.textContent = 'Maschinenfüllungen';
      var headerSpan = document.createElement('span');
      headerSpan.textContent = totalEntries + (totalEntries === 1 ? ' Eintrag' : ' Einträge');
      header.appendChild(headerTitle);
      header.appendChild(headerSpan);
      panel.appendChild(header);

      var activeRates = AppGlobals.getTabRates(AppGlobals.state.activeReiter || 0);
      var unitsPerHa = activeRates.unitsPerHa;
      var duengerPerHa = activeRates.duengerPerHa;

      for (var di = 0; di < dateOrder.length; di++) {
        var dk2 = dateOrder[di];
        var list = dateMap[dk2];
        // Datum-Heading pro Gruppe (nur wenn >1 Gruppe)
        if (dateOrder.length > 1) {
          var dheading = document.createElement('div');
          dheading.className = 'lp-subdate-heading';
          var dheadingTitle = document.createElement('h3');
          dheadingTitle.textContent = dk2 === 'unknown' ? 'Ohne Datum' : AppGlobals.formatDateKeyGerman(dk2);
          dheading.appendChild(dheadingTitle);
          panel.appendChild(dheading);
        }
        var card = document.createElement('div');
        card.className = 'lp-machine-card';
        var cumEinheit = 0, cumDuenger = 0, lastZaehler = 0;
        for (var mi = 0; mi < list.length; mi++) {
          var it = list[mi];
          var entry = it.entry;
          var row = document.createElement('div');
          row.className = 'lp-machine-entry';
          row.setAttribute('data-ml-idx', String(it.originalIdx));
          row.setAttribute('role', 'group');

          var time = document.createElement('time');
          time.className = 'lp-time';
          time.textContent = AppGlobals.formatEntryTimeHHMM(entry.time) || '—';
          if (entry.time) time.setAttribute('datetime', String(entry.time));
          row.appendChild(time);

          var values = document.createElement('div');
          values.className = 'lp-machine-values';
          var valParts = [AppGlobals.formatEinheit(entry.einheit || 0)];
          if (entry.duenger && entry.duenger > 0) {
            valParts.push(Math.round(entry.duenger).toLocaleString('de-DE') + ' kg Dünger');
          }
          values.textContent = valParts.join(' · ');
          row.appendChild(values);

          var actionBtn = document.createElement('button');
          actionBtn.type = 'button';
          actionBtn.className = 'entry-action';
          actionBtn.textContent = '⋮';
          var timeLabel = AppGlobals.formatEntryTimeHHMM(entry.time) || '—';
          actionBtn.setAttribute('aria-label', 'Aktionen für Maschinenfüllung um ' + timeLabel);
          actionBtn.setAttribute('data-entry-action', 'machine');
          actionBtn.onclick = (function(idx, t) {
            return function() {
              if (typeof AppGlobals.requestLocalProtocolDelete === 'function') {
                AppGlobals.requestLocalProtocolDelete('machine', { mlIdx: idx }, t);
              }
            };
          })(it.originalIdx, timeLabel);
          row.appendChild(actionBtn);

          card.appendChild(row);

          // Prognose (kumulativ, siehe renderMachineLog)
          var zaehler = entry.zaehlerStand != null ? entry.zaehlerStand : (entry.hektar != null ? entry.hektar : 0);
          var driven = Math.max(0, zaehler - lastZaehler);
          if (unitsPerHa > 0) cumEinheit = Math.max(0, cumEinheit - driven * unitsPerHa);
          if (duengerPerHa > 0) cumDuenger = Math.max(0, cumDuenger - driven * duengerPerHa);
          cumEinheit += entry.einheit || 0;
          cumDuenger += entry.duenger || 0;
          lastZaehler = zaehler;
          if ((unitsPerHa > 0 && cumEinheit > 0) || (duengerPerHa > 0 && cumDuenger > 0)) {
            var forecast = document.createElement('p');
            forecast.className = 'lp-forecast';
            var fParts = [];
            if (unitsPerHa > 0 && cumEinheit > 0) {
              var saatLeer = zaehler + cumEinheit / unitsPerHa;
              fParts.push('Saat reicht voraussichtlich bis <b>' + AppGlobals.fmt(saatLeer) + ' ha</b>');
            }
            if (duengerPerHa > 0 && cumDuenger > 0) {
              var duengerLeer = zaehler + cumDuenger / duengerPerHa;
              fParts.push('Dünger reicht voraussichtlich bis <b>' + AppGlobals.fmt(duengerLeer) + ' ha</b>');
            }
            forecast.innerHTML = fParts.join(' · ');
            card.appendChild(forecast);
          }
        }
        panel.appendChild(card);
      }
      var hint = document.createElement('p');
      hint.className = 'lp-hint';
      hint.textContent = 'Maschinenfüllungen sind bewusst vom Schlagprotokoll getrennt.';
      panel.appendChild(hint);
    }

    // --- Orchestrator ---
    //
    // Wird nach renderResults() aufgerufen, wenn `state.activeView === 'protokoll'`.
    // Delegiert an die Teil-Render-Funktionen und sorgt für die korrekte
    // Sichtbarkeit der beiden Panels je nach state.protocolView.
    function renderLocalProtocol() {
      var section = document.getElementById('local_protocol_section');
      if (!section) return;
      if (AppGlobals.state.activeView !== 'protokoll') {
        section.style.display = 'none';
        return;
      }
      // Aktiven View-Tab markieren (Schläge/Maschine) — defensive
      // Fallbacks: unbekannter Wert → 'fields'.
      var view = AppGlobals.state.protocolView;
      if (view !== 'fields' && view !== 'machine') view = 'fields';
      var fieldsBtn = document.getElementById('lp_view_fields_btn');
      var machineBtn = document.getElementById('lp_view_machine_btn');
      var fieldsPanel = document.getElementById('local_protocol_fields_panel');
      var machinePanel = document.getElementById('local_protocol_machine_panel');
      if (fieldsBtn) {
        fieldsBtn.classList.toggle('active', view === 'fields');
        fieldsBtn.setAttribute('aria-selected', view === 'fields' ? 'true' : 'false');
      }
      if (machineBtn) {
        machineBtn.classList.toggle('active', view === 'machine');
        machineBtn.setAttribute('aria-selected', view === 'machine' ? 'true' : 'false');
      }
      if (fieldsPanel) {
        fieldsPanel.hidden = view !== 'fields';
        fieldsPanel.style.display = view === 'fields' ? '' : 'none';
      }
      if (machinePanel) {
        machinePanel.hidden = view !== 'machine';
        machinePanel.style.display = view === 'machine' ? '' : 'none';
      }

      renderLocalProtocolBalance();
      renderLocalProtocolFields();
      if (typeof AppGlobals.invalidateCarryoverCache === 'function') {
        AppGlobals.invalidateCarryoverCache();
      }
      renderLocalProtocolMachine();
      section.style.display = 'block';
    }

// Register exposed globals on AppGlobals (ADR-001 Schritt 3, Issue #278).
Object.assign(window.AppGlobals, {
  renderLocalProtocol: renderLocalProtocol,
  renderLocalProtocolBalance: renderLocalProtocolBalance,
  renderLocalProtocolFields: renderLocalProtocolFields,
  renderLocalProtocolMachine: renderLocalProtocolMachine,
});

// Lokales Protokoll-Redesign — Sheet-Helfer (Backdrop-Click + Escape)
// werden nach Modul-Load gebunden, weil die DOM-Elemente zu diesem Zeit-
// punkt bereits existieren (siehe index.html).
(function _bindLocalProtocolSheetEvents() {
  function _onBackdropClick(ev) {
    if (ev && ev.target && ev.target.id === 'local_protocol_sheet_backdrop') {
      if (typeof window.AppGlobals.closeLocalProtocolSheet === 'function') {
        window.AppGlobals.closeLocalProtocolSheet();
      }
    }
  }
  function _onSheetKeydown(ev) {
    if (ev && ev.key === 'Escape') {
      if (typeof window.AppGlobals.closeLocalProtocolSheet === 'function') {
        window.AppGlobals.closeLocalProtocolSheet();
      }
    }
  }
  document.addEventListener('click', _onBackdropClick);
  document.addEventListener('keydown', _onSheetKeydown);
})();
