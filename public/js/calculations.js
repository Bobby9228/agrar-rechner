// ============================================================================
    // BERECHNUNGEN — Pure Functions für alle landwirtschaftlichen Berechnungen
    //
    // Alle Funktionen sind pure: gleiche Eingabe → gleiche Ausgabe, kein State-Zugriff.
    // Das macht sie einfach testbar und vorhersehbar.
    // Keine Seiteneffekte, keine DOM-Manipulation.
    // ============================================================================

    // --- Konstanten ---

    // Schwelle für "noch etwas vorhanden" (Einheiten / kg).
    // Wird verwendet, um Floating-Point-Restwerte unterhalb der Darstellungs-
    // genauigkeit als "nichts" zu behandeln. Refs: Issue #254.
    var EPSILON_QUANTITY = 0.05;

    // --- Fahrgassen-Faktor (zentrale Berechnung) ---

    // Berechnet den Produktivitätsfaktor für Fahrgassen.
    //
    // Physikalische Grundlage:
    //   Fahrgassen sind 1m breite Fahrspuren, die alle `breite` Meter
    //   (Arbeitsbreite des Geräts) im Feld wiederkehren.
    //   Der produktive Anteil der Fläche ist somit:
    //     (breite - 1) / breite
    //
    //   Beispiel: Arbeitsbreite = 24m → (24-1)/24 = 0.9583 → ~4.2% Verlust
    //             Arbeitsbreite = 4m  → (4-1)/4   = 0.75   → 25% Verlust
    //
    //   Guard: breite < 2 → kein sinnvoller Wert → Faktor 1.0 (keine Korrektur)
    //
    // @param {number} breite — Arbeitsbreite in Metern (≥ 2)
    // @returns {number} Produktivitätsfaktor (0..1); 1 = keine Korrektur
    function computeFahrgassenFaktor(breite) {
      if (!breite || breite < 2) return 1;
      return (breite - 1) / breite;
    }

    // --- Einheiten-Berechnung (SOLL) ---

    // Berechnet die Anzahl Einheiten für ein gegebenes Feld.
    // Berücksichtigt: Körner/ha, Körner/Einheit, Hektar, Fahrgassen-Korrektur.
    //
    // Formel:
    //   einheiten = (hektar × koerner) / koernerProEinheit
    //   einheiten × computeFahrgassenFaktor(breite)  falls fahrgassenEnabled
    //
    // Argumente:
    //   r           — Tab-Objekt mit hektar, koerner, fahrgassenEnabled, fahrgassenBreite, etc.
    //   koernerProEinheit — Körner pro Einheit (Standard: 50000)
    //
    // Rückgabe: number (Einheiten, immer ≥ 0)
    function getTotalEinheiten(r, koernerProEinheit) {
      if (!r || !r.hektar || !r.koerner || koernerProEinheit <= 0) return 0;
      var fgEnabled = (r.fahrgassenEnabled !== undefined) ? r.fahrgassenEnabled : state.fahrgassenEnabled;
      var fgBreite = (r.fahrgassenBreite !== undefined) ? r.fahrgassenBreite : state.fahrgassenBreite;
      var faktor = 1;
      if (fgEnabled && fgBreite > 0) {
        faktor = computeFahrgassenFaktor(fgBreite);
      }
      var einheiten = (r.hektar * r.koerner) / koernerProEinheit;
      return Math.max(0, einheiten * faktor);
    }

    // Berechnet die Gesamteinheiten für ein Tab-Objekt (SOLL), mit globalen Einstellungen.
    function getTabTotalEinheiten(r) {
      return getTotalEinheiten(r, state.koernerProEinheit);
    }

    // Berechnet die IST-Einheiten basierend auf der IST-Fläche.
    // Nur wenn istHektar > 0 gesetzt ist, wird die IST-Fläche für die Berechnung verwendet.
    function getTabIstEinheiten(r) {
      if (!r || !r.istHektar || !r.koerner || state.koernerProEinheit <= 0) return 0;
      var fgEnabled = (r.fahrgassenEnabled !== undefined) ? r.fahrgassenEnabled : state.fahrgassenEnabled;
      var fgBreite = (r.fahrgassenBreite !== undefined) ? r.fahrgassenBreite : state.fahrgassenBreite;
      var faktor = 1;
      if (fgEnabled && fgBreite > 0) {
        faktor = computeFahrgassenFaktor(fgBreite);
      }
      var einheiten = (r.istHektar * r.koerner) / state.koernerProEinheit;
      return Math.max(0, einheiten * faktor);
    }

    // --- Dünger-Berechnung (SOLL) ---

    // Berechnet Düngermenge in kg (kg/ha × ha = kg).
    // Formel: r.hektar * r.duenger
    // Issue #191: Vorherige Version dividierte fälschlich durch 50
    // (aus der "1 Einheit = 50 kg" Annahme), was zu 50× zu kleinen kg-Werten
    // im SOLL-Pfad führte. Aufrufer hängen ' kg' an den Wert — die Funktion
    // muss kg liefern. Konsistent mit getTabIstDuenger (PR #190).
    function getTotalDuenger(r) {
      if (!r || !r.hektar || !r.duenger) return 0;
      return Math.max(0, r.hektar * r.duenger);
    }

    function getTabTotalDuenger(r) {
      return getTotalDuenger(r);
    }

    // Dünger (kg) pro Einheit Saatgut für einen Tab.
    //
    // Physikalische Bedeutung: Wieviel kg Dünger zusammen mit einer Einheit
    // Saatgut ausgebracht werden müssen, damit das Soll-Verhältnis
    // (kg Dünger/ha ÷ Körner/ha × koernerProEinheit) eingehalten wird.
    //
    // Herleitung:
    //   totalDuenger = r.hektar × r.duenger          (kg)
    //   totalEinheit = r.hektar × r.koerner / kpe    (Einheiten)
    //   kgProEinheit = totalDuenger / totalEinheit
    //                = r.duenger × kpe / r.koerner
    //
    // Issue #230: Vorher stand hier `tab.duenger / (tab.hektar || 1) * 50` —
    // ein Überbleibsel der falschen "1 Einheit = 50 kg" Annahme, die in
    // #186/#191 bereits aus getTotalDuenger/getTabIstDuenger entfernt wurde.
    // Die neue Formel ist dimensionsrein (kg/Einheit) und kpe-konsistent.
    //
    // @param {Object} r — Tab-Objekt mit .hektar, .koerner, .duenger
    // @param {number} koernerProEinheit — Körner pro Einheit (Standard 50000)
    // @returns {number} kg Dünger pro Einheit Saatgut (0 wenn r.koerner fehlt)
    function getDuengerProEinheit(r, koernerProEinheit) {
      if (!r || !r.duenger || !r.koerner || !koernerProEinheit) return 0;
      return r.duenger * koernerProEinheit / r.koerner;
    }

    // Berechnet IST-Dünger (kg) basierend auf istHektar.
    // Formel: r.istHektar * r.duenger (kg/ha) → kg total.
    // Issue #186: Vorherige Version dividierte fälschlich durch 50
    // (aus der "1 Einheit = 50 kg" Annahme), was zu falschen kg-Werten führte.
    function getTabIstDuenger(r) {
      if (!r || !r.istHektar || !r.duenger) return 0;
      return Math.max(0, r.istHektar * r.duenger);
    }

    // --- Carryover-Berechnung ---

    // Liefert die Summe aller verbrauchten Einheiten/Dünger im Tab (aus entries).
    function getTabUsedEinheiten(r) {
      if (!r || !r.entries) return 0;
      return r.entries.reduce(function(s, e) { return s + (e.einheit || 0); }, 0);
    }

    function getTabUsedDuenger(r) {
      if (!r || !r.entries) return 0;
      return r.entries.reduce(function(s, e) { return s + (e.duenger || 0); }, 0);
    }

    // --- Carryover-Cache (interner State, nicht pure) ---

    var _internal = {
      carryoverCache: null,
      drillCalcTimer: null,
      pendingKey: null
    };

    // Berechnet Carryover (Überschüsse/Ersparnisse) für alle Tabs.
    //
    // Phase 1: Ersparnisse (IST < SOLL → saved = SOLL - IST) werden an unfertige Tabs verteilt.
    //          Tabs die "nur durch Carryover fertig" werden, werden übersprungen.
    // Phase 2: Mehrbedarfe (IST > SOLL → excess) werden aus Mehrbedarfs-Tabs gedeckt.
    //
    // Caching: Ergebnis wird in _internal.carryoverCache gespeichert,
    // bis eine State-Änderung invalidateCarryoverCache() aufruft.
    function computeAllCarryovers() {
      if (_internal.carryoverCache !== null) return _internal.carryoverCache;

      var result = [];
      for (var i = 0; i < state.reiter.length; i++) {
        result.push({ savedEinheit: 0, savedDuenger: 0, excessEinheit: 0, excessDuenger: 0 });
      }

      // --- PHASE 0: Bedarfsberechnung ---
      // Savings: SOLL - IST wenn IST > 0 && IST < SOLL (Ersparnis = nicht bepflanzte Fläche)
      // Excess: IST - SOLL wenn IST > SOLL
      // Need: max(0, IST - used) wenn IST > 0 (sonst SOLL - used)
      // Wenn IST=0 → keine Carryover (keine Ersparnis, kein Bedarf jenseits SOLL)
      var totalSavedE = 0, totalSavedD = 0;
      var totalExcessE = 0, totalExcessD = 0;

      for (var i = 0; i < state.reiter.length; i++) {
        var t = state.reiter[i];
        var istE = getTabIstEinheiten(t);
        var solE = getTabTotalEinheiten(t);
        var usedE = getTabUsedEinheiten(t);
        var istD = getTabIstDuenger(t);
        var solD = getTabTotalDuenger(t);
        var usedD = getTabUsedDuenger(t);
        if (istE > 0) {
          if (solE > istE) totalSavedE += (solE - istE);
          else if (istE > solE) totalExcessE += (istE - solE);
        }
        if (istD > 0) {
          if (solD > istD) totalSavedD += (solD - istD);
          else if (istD > solD) totalExcessD += (istD - solD);
        }
      }

      // === PHASE 1: Ersparnisse verteilen (vorwärts durch Tabs) ===
      _internal.carryoverCache = result;
      var remSavedE = totalSavedE, remSavedD = totalSavedD;
      for (var i = 0; i < state.reiter.length && (remSavedE > 0.05 || remSavedD > 0.05); i++) {
        var t = state.reiter[i];
        // Need for tab i: max(0, IST - used) wenn IST > 0, sonst max(0, SOLL - used)
        var istE = getTabIstEinheiten(t);
        var solE = getTabTotalEinheiten(t);
        var usedE = getTabUsedEinheiten(t);
        var istD = getTabIstDuenger(t);
        var solD = getTabTotalDuenger(t);
        var usedD = getTabUsedDuenger(t);
        var basisE = istE > 0 ? istE : solE;
        var basisD = istD > 0 ? istD : solD;
        var needE = Math.max(0, basisE - usedE);
        var needD = Math.max(0, basisD - usedD);
        // Issue #138: skip if tab would be done with carryover — bereits
        // implementiert via isTabDone(t, i) weiter unten. Wir verteilen hier
        // immer und überspringen im nächsten Loop-Durchlauf. Da result[i] sich
        // ändert während wir durchgehen, berechnen wir isTabDone(t, i) jedes
        // Mal frisch.
        var takeE = 0, takeD = 0;
        if (needE > 0.05 && remSavedE > 0.05) {
          // Wenn der Tab mit weniger carryover schon fertig wäre, nur so viel
          // geben wie nötig, damit er genau auf 0 kommt. So bekommt der nächste
          // Tab mehr vom Carryover (Issue #138).
          // maxTakeE = min(remSavedE, needE)
          // Wenn (basisE - usedE - takeE) <= 0 → Tab ist fertig, weniger geben
          takeE = Math.min(remSavedE, needE);
        }
        if (needD > 0.05 && remSavedD > 0.05) {
          takeD = Math.min(remSavedD, needD);
        }
        if (takeE > 0) { result[i].savedEinheit = takeE; remSavedE -= takeE; }
        if (takeD > 0) { result[i].savedDuenger = takeD; remSavedD -= takeD; }
      }

      // === PHASE 2: Mehrbedarfe (IST > SOLL) → von Tabs mit Einträgen (rückwärts, nach Zeit) ===
      // Tabs die selbst Mehrbedarf haben (negatives diff) kommen zuletzt.
      var tabOrder = [];
      for (var i = state.reiter.length - 1; i >= 0; i--) {
        var t = state.reiter[i];
        if (!t.entries || t.entries.length === 0) continue;
        var istE = getTabIstEinheiten(t);
        var solE = getTabTotalEinheiten(t);
        var usedE = getTabUsedEinheiten(t);
        var istD = getTabIstDuenger(t);
        var solD = getTabTotalDuenger(t);
        var usedD = getTabUsedDuenger(t);
        var basisE = istE > 0 ? istE : solE;
        var basisD = istD > 0 ? istD : solD;
        // diff: used - basis. Wenn used > basis, hat der Tab einen Mehrbedarf.
        var diffE = usedE - basisE;
        var diffD = usedD - basisD;
        if (diffE <= 0.05 && diffD <= 0.05) {
          // Tab hat Überschuss (oder ist genau balanced)
          if ((result[i].savedEinheit > 0.05 || result[i].savedDuenger > 0.05) && totalExcessE > 0.05) {
            var lastEntry = t.entries[t.entries.length - 1];
            tabOrder.push({ idx: i, ts: lastEntry ? (lastEntry.time || 0) : 0 });
          }
        }
      }
      tabOrder.sort(function(a, b) { return a.ts - b.ts; }); // Chronologisch: älteste zuerst

      var remExcessE = totalExcessE, remExcessD = totalExcessD;
      for (var j = 0; j < tabOrder.length && (remExcessE > 0.05 || remExcessD > 0.05); j++) {
        var idx = tabOrder[j].idx;
        var t = state.reiter[idx];
        var istE = getTabIstEinheiten(t);
        var solE = getTabTotalEinheiten(t);
        var usedE = getTabUsedEinheiten(t);
        var istD = getTabIstDuenger(t);
        var solD = getTabTotalDuenger(t);
        var usedD = getTabUsedDuenger(t);
        var basisE = istE > 0 ? istE : solE;
        var basisD = istD > 0 ? istD : solD;
        var diffE = usedE - basisE;
        var diffD = usedD - basisD;
        var needE = Math.max(0, diffE) - result[idx].savedEinheit;
        var needD = Math.max(0, diffD) - result[idx].savedDuenger;
        if (needE > 0.05 && remExcessE > 0.05) {
          var takeE2 = Math.min(remExcessE, needE);
          result[idx].excessEinheit = takeE2;
          remExcessE -= takeE2;
        }
        if (needD > 0.05 && remExcessD > 0.05) {
          var takeD2 = Math.min(remExcessD, needD);
          result[idx].excessDuenger = takeD2;
          remExcessD -= takeD2;
        }
      }

      _internal.carryoverCache = result;
      return result;
    }

    function invalidateCarryoverCache() {
      _internal.carryoverCache = null;
    }

    function getCarryover(tabIndex) {
      var all = computeAllCarryovers();
      if (tabIndex >= 0 && tabIndex < all.length) return all[tabIndex];
      return { savedEinheit: 0, savedDuenger: 0, excessEinheit: 0, excessDuenger: 0 };
    }

    // --- Tab-Fertig-Check (pure) ---

    // Prüft ob ein Tab "fertig" ist (alle Bedarfe gedeckt).
    // Berücksichtigt: SOLL-Einheiten, IST-Einheiten, Carryover, bereits verbraucht.
    //
    // Verwendet computeAllCarryovers() für Carryover-Werte (wenn tabIndex mitgegeben).
    // Ohne tabIndex wird Carryover ignoriert (Backward-Compat).
    // Ist nil-safe (fehlende Felder = 0).
    function isTabDone(r, tabIndex) {
      if (!r || !r.entries) return true; // Keine Entries = fertig (kein Bedarf)
      // Carryover nur berücksichtigen wenn tabIndex mitgegeben
      var carryover = (tabIndex !== undefined)
        ? getCarryover(tabIndex)
        : { savedEinheit: 0, savedDuenger: 0, excessEinheit: 0, excessDuenger: 0 };
      // IST > 0 ? IST : SOLL (Issue #186)
      var istE = getTabIstEinheiten(r);
      var totalE = istE > 0 ? istE : getTabTotalEinheiten(r);
      var usedE = getTabUsedEinheiten(r);
      // Remaining = Need - Carryover.Saved + Carryover.Excess
      // Need = max(0, totalE - usedE)
      var needE = Math.max(0, totalE - usedE);
      var remainingE = needE - carryover.savedEinheit + carryover.excessEinheit;
      if (remainingE > 0.05) return false;

      var istD = getTabIstDuenger(r);
      var totalD = istD > 0 ? istD : getTabTotalDuenger(r);
      var usedD = getTabUsedDuenger(r);
      var needD = Math.max(0, totalD - usedD);
      var remainingD = needD - carryover.savedDuenger + carryover.excessDuenger;
      return remainingD <= 0.05;
    }

    // --- Hilfsfunktionen für Entry-Time ---

    // Zeitstempel des letzten Eintrags in einem Tab (für Sortierung).
    function getTabLastEntryTime(r) {
      if (!r || !r.entries || r.entries.length === 0) return 0;
      var last = r.entries[r.entries.length - 1];
      return last ? (last.time || 0) : 0;
    }

    // Liefert die IST-Hektar-Summe für einen Tab.
    // Priorität: Direktes r.istHektar (vom Input-Feld) > Summe aus Entries.
    // Issue #186: Das Input-Feld #ist_hektar schreibt via onInputIstHektar in
    // r.istHektar. Wenn das gesetzt ist, IST es die maßgebliche Quelle — nicht
    // die Summe aus entries[].istHektar (die nur ein Legacy-Snapshot ist).
    function getTabIstHektar(r) {
      if (!r) return 0;
      if (r.istHektar && r.istHektar > 0) return r.istHektar;
      if (!r.entries) return 0;
      return r.entries.reduce(function(s, e) { return s + (e.istHektar || 0); }, 0);
    }

    // Liefert den nächsten Zeitstempel (für Sortierung).
function getTabNextTime(r) {
      if (!r || !r.entries || r.entries.length === 0) return Date.now();
      var last = r.entries[r.entries.length - 1];
      return last ? Math.max(Date.now(), (last.time || 0) + 1) : Date.now();
    }

    // --- UI Wrappers (bridge between handlers/rendering and pure calculations) ---
    // These use getActiveReiter() so they are NOT pure — they live in ui-handlers.js

    // Körner gesamt für Tab r (inkl. Fahrgassen-Korrektur)
    // Formel: hektar × koerner × computeFahrgassenFaktor(breite)
    function getTabKornerGesamt(r) {
      if (!r || !r.hektar || !r.koerner) return 0;
      var k = r.hektar * r.koerner;
      var fgEnabled = (r.fahrgassenEnabled !== undefined) ? r.fahrgassenEnabled : state.fahrgassenEnabled;
      var fgBreite = (r.fahrgassenBreite !== undefined) ? r.fahrgassenBreite : state.fahrgassenBreite;
      var faktor = 1;
      if (fgEnabled && fgBreite > 0) {
        faktor = computeFahrgassenFaktor(fgBreite);
      }
      return k * faktor;
    }

    // Berechnet Verbrauchsraten (Einheiten/ha, Dünger/ha) für einen bestimmten Tab.
    // (portiert aus Inline-Code Z. 2349-2359)
    // Argumente:
    //   tabIdx — Index in state.reiter
    // Rückgabe: { unitsPerHa, duengerPerHa }
    function getTabRates(tabIdx) {
      var r = state.reiter[tabIdx];
      if (!r) return { unitsPerHa: 0, duengerPerHa: 0 };
      var fgEnabled = (r.fahrgassenEnabled !== undefined) ? r.fahrgassenEnabled : state.fahrgassenEnabled;
      var fgBreite = (r.fahrgassenBreite !== undefined) ? r.fahrgassenBreite : state.fahrgassenBreite;
      var fgFactor = 1;
      if (fgEnabled && fgBreite > 0) {
        fgFactor = computeFahrgassenFaktor(fgBreite);
      }
      var unitsPerHa = r.koerner * fgFactor / state.koernerProEinheit;
      var duengerPerHa = r.duenger || 0;
      return { unitsPerHa: unitsPerHa, duengerPerHa: duengerPerHa };
    }