// ============================================================================
    // BERECHNUNGEN — Pure Functions für alle landwirtschaftlichen Berechnungen
    //
    // Alle Funktionen sind pure: gleiche Eingabe → gleiche Ausgabe, kein State-Zugriff.
    // Das macht sie einfach testbar und vorhersehbar.
    // Keine Seiteneffekte, keine DOM-Manipulation.
    // ============================================================================

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
      var faktor = 1;
      if (r.fahrgassenEnabled && r.fahrgassenBreite > 0) {
        faktor = computeFahrgassenFaktor(r.fahrgassenBreite);
      }
      var einheiten = (r.hektar * r.koerner) / koernerProEinheit;
      return Math.max(0, einheiten * faktor);
    }

    // Berechnet die Gesamteinheiten für ein Tab-Objekt (SOLL), mit globalen Einstellungen.
    function getTabTotalEinheiten(r) {
      return getTotalEinheiten(r, 50000);
    }

    // Berechnet die IST-Einheiten basierend auf der IST-Fläche.
    // Nur wenn istHektar > 0 gesetzt ist, wird die IST-Fläche für die Berechnung verwendet.
    function getTabIstEinheiten(r) {
      if (!r || !r.istHektar || !r.koerner || state.koernerProEinheit <= 0) return 0;
      var faktor = 1;
      if (r.fahrgassenEnabled && r.fahrgassenBreite > 0) {
        faktor = computeFahrgassenFaktor(r.fahrgassenBreite);
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
    // Phase 1: Ersparnisse (IST > SOLL → saved) werden an unfertige Tabs verteilt.
    // Phase 2: Mehrbedarfe (IST < SOLL → excess) werden aus Mehrbedarfs-Tabs gedeckt.
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
      var totalSavedE = 0, totalSavedD = 0;
      var totalExcessE = 0, totalExcessD = 0;

      for (var i = 0; i < state.reiter.length; i++) {
        var t = state.reiter[i];
        var istE = getTabIstEinheiten(t);
        var totalE = istE > 0 ? istE : getTabTotalEinheiten(t);
        var usedE = getTabUsedEinheiten(t);
        var diffE = totalE - usedE;

        var istD = getTabIstDuenger(t);
        var totalD = istD > 0 ? istD : getTabTotalDuenger(t);
        var usedD = getTabUsedDuenger(t);
        var diffD = totalD - usedD;

        if (diffE >= 0) totalSavedE += diffE; else totalExcessE += Math.abs(diffE);
        if (diffD >= 0) totalSavedD += diffD; else totalExcessD += Math.abs(diffD);
      }

      // === PHASE 1: Ersparnisse verteilen (vorwärts durch Tabs) ===
      _internal.carryoverCache = result;
      var remSavedE = totalSavedE, remSavedD = totalSavedD;
      for (var i = 0; i < state.reiter.length && (remSavedE > 0.05 || remSavedD > 0.05); i++) {
        var t = state.reiter[i];
        if (isTabDone(t, i)) continue; // Dieser Tab ist bereits fertig
        var istE = getTabIstEinheiten(t);
        var totalE = istE > 0 ? istE : getTabTotalEinheiten(t);
        var usedE = getTabUsedEinheiten(t);
        var diffE = totalE - usedE;
        if (diffE < -0.05 && remSavedE > 0.05) {
          var takeE = Math.min(remSavedE, Math.abs(diffE));
          result[i].savedEinheit = takeE;
          remSavedE -= takeE;
        }
        var istD = getTabIstDuenger(t);
        var totalD = istD > 0 ? istD : getTabTotalDuenger(t);
        var usedD = getTabUsedDuenger(t);
        var diffD = totalD - usedD;
        if (diffD < -0.05 && remSavedD > 0.05) {
          var takeD = Math.min(remSavedD, Math.abs(diffD));
          result[i].savedDuenger = takeD;
          remSavedD -= takeD;
        }
      }

      // === PHASE 2: Mehrbedarfe (IST > SOLL) → von Tabs mit Einträgen (rückwärts, nach Zeit) ===
      // Tabs die selbst Mehrbedarf haben (negatives diff) kommen zuletzt.
      var tabOrder = [];
      for (var i = state.reiter.length - 1; i >= 0; i--) {
        var t = state.reiter[i];
        if (!t.entries || t.entries.length === 0) continue;
        var istE = getTabIstEinheiten(t);
        var totalE = istE > 0 ? istE : getTabTotalEinheiten(t);
        var usedE = getTabUsedEinheiten(t);
        var diffE = totalE - usedE;
        var istD = getTabIstDuenger(t);
        var totalD = istD > 0 ? istD : getTabTotalDuenger(t);
        var usedD = getTabUsedDuenger(t);
        var diffD = totalD - usedD;
        if (diffE >= -0.05 && diffD >= -0.05) {
          // Tab hat Überschuss (oder ist genau平衡)
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
        var totalE = istE > 0 ? istE : getTabTotalEinheiten(t);
        var usedE = getTabUsedEinheiten(t);
        var diffE = totalE - usedE;
        var istD = getTabIstDuenger(t);
        var totalD = istD > 0 ? istD : getTabTotalDuenger(t);
        var usedD = getTabUsedDuenger(t);
        var diffD = totalD - usedD;
        var needE = Math.abs(diffE) - result[idx].savedEinheit;
        var needD = Math.abs(diffD) - result[idx].savedDuenger;
        if (needE > 0.05 && remExcessE > 0.05) {
          var takeE = Math.min(remExcessE, needE);
          result[idx].excessEinheit = takeE;
          remExcessE -= takeE;
        }
        if (needD > 0.05 && remExcessD > 0.05) {
          var takeD = Math.min(remExcessD, needD);
          result[idx].excessDuenger = takeD;
          remExcessD -= takeD;
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
    // Verwendet computeAllCarryovers() für Carryover-Werte.
    //Ist nil-safe (fehlende Felder = 0).
    function isTabDone(r, tabIndex) {
      if (!r || !r.entries) return true; // Keine Entries = fertig (kein Bedarf)
      var carryover = getCarryover(tabIndex);
      var istE = getTabIstEinheiten(r);
      var totalE = istE > 0 ? istE : getTabTotalEinheiten(r);
      var usedE = getTabUsedEinheiten(r);
      var remaining = totalE - usedE + carryover.savedEinheit - carryover.excessEinheit;
      if (remaining > 0.05) return false;

      var istD = getTabIstDuenger(r);
      var totalD = istD > 0 ? istD : getTabTotalDuenger(r);
      var usedD = getTabUsedDuenger(r);
      var remainingD = totalD - usedD + carryover.savedDuenger - carryover.excessDuenger;
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
      var faktor = 1;
      if (r.fahrgassenEnabled && r.fahrgassenBreite > 0) {
        faktor = computeFahrgassenFaktor(r.fahrgassenBreite);
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
      var fgFactor = 1;
      if (state.fahrgassenEnabled && state.fahrgassenBreite > 0) {
        fgFactor = computeFahrgassenFaktor(state.fahrgassenBreite);
      }
      var unitsPerHa = r.koerner * fgFactor / state.koernerProEinheit;
      var duengerPerHa = r.duenger || 0;
      return { unitsPerHa: unitsPerHa, duengerPerHa: duengerPerHa };
    }