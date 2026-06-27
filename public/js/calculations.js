// ============================================================================
// BERECHNUNGEN — Pure Functions für alle landwirtschaftlichen Berechnungen
//
// Alle Funktionen sind pure: gleiche Eingabe → gleiche Ausgabe, kein State-Zugriff.
// Das macht sie einfach testbar und vorhersehbar.
// Keine Seiteneffekte, keine DOM-Manipulation.
// ============================================================================

// --- Format/Parser Utilities (pure) ---

// fmt — Runde auf 1 Dezimalstelle, deutsche Formatierung mit Komma.
// DE-Rundung: "round half up" — ab .5 wird aufgerundet.
// Beispiel: 0.05 → '0,1' (nicht '0,0' wie toFixed default).
// Issue #9: aus main.js hierher verschoben — pure Funktion, gehört zu den
// Berechnungs-Helfern und macht die AppGlobals-Abhängigkeit explizit.
function fmt(n) {
  if (n === null || n === undefined || isNaN(n)) return '0,0';
  var x = n * 10;
  var rounded = (x >= 0 ? Math.floor(x + 0.5) : -Math.floor(-x + 0.5)) / 10;
  return String(rounded.toFixed(1)).replace('.', ',');
}

// fmtCompact — wie fmt(), aber lässt das nachstehende ",0" für ganze Zahlen weg.
// Wird im Dashboard verwendet (Tests 26, 40 erwarten "12" statt "12,0").
// Issue #9: aus main.js hierher verschoben (pure Funktion).
function fmtCompact(n) {
  var s = fmt(n);
  if (s.endsWith(',0')) s = s.slice(0, -2);
  return s;
}

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

// Liefert den Fahrgassen-Faktor für ein Tab-Objekt r.
// Per-Tab-Override (r.fahrgassenEnabled / r.fahrgassenBreite) fällt auf den
// globalen Default (AppGlobals.state.*) zurück, wenn nicht gesetzt.
// Gibt 1 zurück, wenn Fahrgassen deaktiviert oder Breite ≤ 0.
// (Vorher 4× identisch in getTotalEinheiten, getTabIstEinheiten,
// getTabKornerGesamt, getTabRates dupliziert — Issue #4.)
function getTabFahrgassenFaktor(r) {
  var enabled = (r.fahrgassenEnabled !== undefined) ? r.fahrgassenEnabled : AppGlobals.state.fahrgassenEnabled;
  var breite  = (r.fahrgassenBreite  !== undefined) ? r.fahrgassenBreite  : AppGlobals.state.fahrgassenBreite;
  if (!enabled || breite <= 0) return 1;
  return computeFahrgassenFaktor(breite);
}

// --- Einheiten-Berechnung (SOLL) ---

// Berechnet die Anzahl Einheiten für ein gegebenes Feld (SOLL).
// Berücksichtigt: Körner/ha, Körner/Einheit, Hektar, Fahrgassen-Korrektur.
//
// Formel:
//   einheiten = (hektar × koerner) / koernerProEinheit
//   einheiten × computeFahrgassenFaktor(breite)  falls fahrgassenEnabled
//
// Argumente:
//   r                  — Tab-Objekt mit hektar, koerner, fahrgassenEnabled, fahrgassenBreite, etc.
//   koernerProEinheit  — Körner pro Einheit (Standard: state.koernerProEinheit)
//
// Rückgabe: number (Einheiten, immer ≥ 0)
//
// Issue #7: Konsolidierung — dies ist jetzt die *einzige* kanonische Berechnung
// für SOLL-Einheiten. Vorher gab es zwei redundante Funktionen
// (getTotalEinheiten + getTabTotalEinheiten), die jeweils die gleiche Logik
// ausführten. ui-handlers.js exportiert weiterhin getTotalEinheiten() als
// No-arg-Kompatibilitäts-Wrapper, der an die aktive Reiter delegiert.
function getTabTotalEinheiten(r, koernerProEinheit) {
  var kpe = (koernerProEinheit !== undefined) ? koernerProEinheit : AppGlobals.state.koernerProEinheit;
  if (!r || !r.hektar || !r.koerner || kpe <= 0) return 0;
  var faktor = getTabFahrgassenFaktor(r);
  var einheiten = (r.hektar * r.koerner) / kpe;
  return Math.max(0, einheiten * faktor);
}

// Berechnet die IST-Einheiten basierend auf der IST-Fläche.
// Nur wenn istHektar > 0 gesetzt ist, wird die IST-Fläche für die Berechnung verwendet.
function getTabIstEinheiten(r) {
  if (!r || !r.istHektar || !r.koerner || AppGlobals.state.koernerProEinheit <= 0) return 0;
  var faktor = getTabFahrgassenFaktor(r);
  var einheiten = (r.istHektar * r.koerner) / AppGlobals.state.koernerProEinheit;
  return Math.max(0, einheiten * faktor);
}

// --- Dünger-Berechnung (SOLL) ---

// Berechnet Düngermenge in kg (kg/ha × ha = kg) für ein Tab-Objekt (SOLL).
// Formel: r.hektar * r.duenger
//
// Issue #191: Vorherige Version dividierte fälschlich durch 50
// (aus der "1 Einheit = 50 kg" Annahme), was zu 50× zu kleinen kg-Werten
// im SOLL-Pfad führte. Aufrufer hängen ' kg' an den Wert — die Funktion
// muss kg liefern. Konsistent mit getTabIstDuenger (PR #190).
//
// Issue #7: Konsolidierung — dies ist jetzt die *einzige* kanonische Berechnung
// für SOLL-Dünger. Vorher gab es getTotalDuenger + getTabTotalDuenger als
// triviale Wrapper-Duplikate (letztere rief nur erstere auf). ui-handlers.js
// exportiert weiterhin getTotalDuenger() als No-arg-Kompatibilitäts-Wrapper.
function getTabTotalDuenger(r) {
  if (!r || !r.hektar || !r.duenger) return 0;
  return Math.max(0, r.hektar * r.duenger);
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
  for (let i = 0; i < AppGlobals.state.reiter.length; i++) {
    result.push({ savedEinheit: 0, savedDuenger: 0, excessEinheit: 0, excessDuenger: 0 });
  }

  // --- PHASE 0: Bedarfsberechnung ---
  // Savings: SOLL - IST wenn IST > 0 && IST < SOLL (Ersparnis = nicht bepflanzte Fläche)
  // Excess: IST - SOLL wenn IST > SOLL
  // Need: max(0, IST - used) wenn IST > 0 (sonst SOLL - used)
  // Wenn IST=0 → keine Carryover (keine Ersparnis, kein Bedarf jenseits SOLL)
  var totalSavedE = 0, totalSavedD = 0;
  var totalExcessE = 0, totalExcessD = 0;

  for (let i = 0; i < AppGlobals.state.reiter.length; i++) {
    var t = AppGlobals.state.reiter[i];
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

  // === NETTO-SALDO (vor Phase 1 und 2) ===
  //
  // Fix Issue #XXX: Ersparnis-Pool und Mehrbedarf-Pool werden zuerst
  // gegenseitig aufgerechnet (Netting). Nur der verbleibende Netto-Saldo
  // wird an Phase 1 (Ersparnisse) bzw. Phase 2 (Mehrbedarfe) übergeben.
  //
  // Ohne Netting: Ein Tab mit IST > SOLL (Mehrbedarf) erhält in Phase 1
  // fälschlicherweise Ersparnis-Carryover (weil istCovered=FALSE und
  // isSource=FALSE). Gleichzeitig gibt Phase 2 den vollen totalExcess als
  // Bürde an Folge-Tabs — saved und excess auf dem Folge-Tab heben sich
  // NICHT auf, sondern addieren sich als doppelter Fehler.
  //
  // Mit Netting: netSaved = max(0, totalSaved - totalExcess).
  //              netExcess = max(0, totalExcess - totalSaved).
  // Phase 1 verteilt nur netSaved, Phase 2 vergibt nur netExcess.
  var netSavedE  = Math.max(0, totalSavedE  - totalExcessE);
  var netExcessE = Math.max(0, totalExcessE - totalSavedE);
  var netSavedD  = Math.max(0, totalSavedD  - totalExcessD);
  var netExcessD = Math.max(0, totalExcessD - totalSavedD);

  // === PHASE 1: Ersparnisse verteilen — Saat und Dünger getrennt ===
  //
  // Issue #315: Saat und Dünger sollen UNABHÄNGIG durch die Carryover-Prios
  // fließen. Ein Tab, der Saat-Bedarf hat, bekommt nicht automatisch auch
  // Dünger-Carryover (oder umgekehrt). Wenn der Saat-Pool leer ist, aber der
  // Dünger-Pool noch was hat, läuft nur der Dünger-Pass weiter.
  //
  // Carryover-Bedarf ist IST-basiert (basis = istE/D wenn istHa > 0, sonst
  // solE/D). Das ist die Original-Semantik aus Phase 0: Tab X hat Bedarf
  // solange usedX < basisX. Issue #138 (Skip für "fertige" Tabs) wird
  // beibehalten — eine Quelle MIT eigenem Restbedarf kann Carryover empfangen.
  //
  // Skip-Regel (Issue #138): Ersparnis-Quellen, deren IST-Fläche bereits
  // gedeckt ist (usedE >= istE bei istE > 0), bekommen KEINEN Carryover. Die
  // Ersparnis war für ANDERE Tabs gedacht — diese Quelle soll nicht "doppelt
  // profitieren".
  //
  // Zusätzlicher Skip (Netto-Fix): Tabs mit IST > SOLL (Mehrbedarf) dürfen
  // keine Ersparnis aus Phase 1 empfangen. Ihr Mehrbedarf ist bereits durch
  // den Netto-Saldo aus dem Excess-Pool herausgerechnet.
  _internal.carryoverCache = result;
  var remSavedE = netSavedE;
  var remSavedD = netSavedD;
  for (var mat = 0; mat < 2; mat++) {
    var isSaatPass = (mat === 0);
    var remSaved = isSaatPass ? remSavedE : remSavedD;
    while (remSaved > 0.05) {
      var distributed = false;
      for (let i = 0; i < AppGlobals.state.reiter.length; i++) {
        if (remSaved <= 0.05) break;
        var t = AppGlobals.state.reiter[i];
        var istE = getTabIstEinheiten(t);
        var solE = getTabTotalEinheiten(t);
        var usedE = getTabUsedEinheiten(t);
        var istD = getTabIstDuenger(t);
        var solD = getTabTotalDuenger(t);
        var usedD = getTabUsedDuenger(t);
        // IST-basiert (Original-Semantik aus Phase 0).
        var basis = isSaatPass ? (istE > 0 ? istE : solE) : (istD > 0 ? istD : solD);
        var need = Math.max(0, basis - usedE - result[i].savedEinheit);
        var needD = Math.max(0, basis - usedD - result[i].savedDuenger);
        var need_ = isSaatPass ? need : needD;
        // Issue #138: Skip wenn IST-Fläche bereits gedeckt UND dieser Tab
        // eine Ersparnis-Quelle für dieses Material ist.
        var istCovered = isSaatPass
          ? (istE > 0 && usedE >= istE)
          : (istD > 0 && usedD >= istD);
        var isSource = isSaatPass
          ? (solE > istE && istE > 0)
          : (solD > istD && istD > 0);
        // Netto-Fix: Tabs mit IST > SOLL (Mehrbedarf) überspringen.
        // Ihr Mehrverbrauch ist bereits durch den Netto-Saldo herausgerechnet.
        var hasMehrbedarf = isSaatPass
          ? (istE > 0 && istE > solE)
          : (istD > 0 && istD > solD);
        // Issue #347 Mini-Korrektur: kein hasNoEntries-Skip in Phase 1.
        // Leere Empfänger-Tabs sollen Carryover (saved) empfangen können.
        // Phase 2 hat ihren eigenen t2.entries.length === 0 Skip (für capacity
        // als Absorber). Phase 1 muss aber leere Tabs als Empfänger zulassen,
        // damit das SAV-Budget an die nächsten nicht-fertigen Tabs kaskadiert.
        // Der bestehende `need_ <= 0.05` Skip reicht als Filter.
        if (need_ <= 0.05) continue;
        if (istCovered && isSource) continue;
        if (hasMehrbedarf) continue;
        if (need_ > 0.05 && remSaved > 0.05) {
          var take = Math.min(remSaved, need_);
          if (take > 0) {
            if (isSaatPass) result[i].savedEinheit += take;
            else result[i].savedDuenger += take;
            remSaved -= take;
            distributed = true;
          }
        }
      }
      // Schutz gegen Endlosschleife: wenn keine Verteilung mehr stattfand
      // (z.B. weil keiner der Tabs Bedarf hat), brechen wir ab statt zu rotieren.
      if (!distributed) break;
    }
    if (isSaatPass) remSavedE = remSaved;
    else remSavedD = remSaved;
  }

  // === PHASE 2: Mehrbedarfe absorbieren — Saat und Dünger getrennt ===
  //
  // Issue #315: Auch hier entkoppeln. Capacity-Sort und Absorption laufen
  // für jedes Material separat. Self-Mehrbedarf (used > basis) bleibt
  // ignoriert wie bisher — keine Verteilung an andere Tabs.
  for (var mat2 = 0; mat2 < 2; mat2++) {
    var isSaatPass2 = (mat2 === 0);
    var remExcess = isSaatPass2 ? netExcessE : netExcessD;

    // Tabs mit Capacity für dieses Material sammeln + sortieren.
    // Capacity = max(0, basis − used − saved_received) — IST-basiert
    // (Original-Semantik aus Phase 0). Self-Excess (used > basis):
    // ignoriert (kein negativer Carryover).
    // Netto-Fix: Tabs mit IST > SOLL (Mehrbedarf-Quellen) werden als Absorber
    // ausgeschlossen. Ihr Excess ist bereits durch den Netto-Saldo verrechnet —
    // sie sollen ihn nicht zurückbekommen.
    var tabOrder2 = [];
    for (let i = 0; i < AppGlobals.state.reiter.length; i++) {
      var t2 = AppGlobals.state.reiter[i];
      if (!t2.entries || t2.entries.length === 0) continue;
      var istE2 = getTabIstEinheiten(t2);
      var solE2 = getTabTotalEinheiten(t2);
      var usedE2 = getTabUsedEinheiten(t2);
      var istD2 = getTabIstDuenger(t2);
      var solD2 = getTabTotalDuenger(t2);
      var usedD2 = getTabUsedDuenger(t2);
      // Mehrbedarf-Quellen überspringen (Netto-Fix)
      var isMehrbedarf2 = isSaatPass2
        ? (istE2 > 0 && istE2 > solE2)
        : (istD2 > 0 && istD2 > solD2);
      if (isMehrbedarf2) continue;
      var basis2 = isSaatPass2
        ? (istE2 > 0 ? istE2 : solE2)
        : (istD2 > 0 ? istD2 : solD2);
      var cap = 0, selfExcess = 0;
      if (isSaatPass2) {
        cap = Math.max(0, basis2 - usedE2) - result[i].savedEinheit;
        selfExcess = Math.max(0, usedE2 - basis2);
      } else {
        cap = Math.max(0, basis2 - usedD2) - result[i].savedDuenger;
        selfExcess = Math.max(0, usedD2 - basis2);
      }
      if (cap <= 0.05 && selfExcess <= 0.05) continue;
      var lastEntry2 = t2.entries[t2.entries.length - 1];
      var ts2 = parseEntryTime(lastEntry2 ? (lastEntry2.time || 0) : 0);
      tabOrder2.push({ idx: i, ts: ts2, cap: cap, selfExcess: selfExcess });
    }
    // Sort: capacity-positive zuerst (last-filled first), dann self-excess tabs.
    tabOrder2.sort(function(a, b) {
      var aHasCap = a.cap > 0.05 ? 1 : 0;
      var bHasCap = b.cap > 0.05 ? 1 : 0;
      if (aHasCap !== bHasCap) return bHasCap - aHasCap;
      return b.ts - a.ts;
    });

    for (var j2 = 0; j2 < tabOrder2.length && remExcess > 0.05; j2++) {
      var entry2 = tabOrder2[j2];
      var idx2 = entry2.idx;
      if (entry2.cap > 0.05) {
        var takeCap = Math.min(remExcess, entry2.cap);
        if (takeCap > 0.05) {
          if (isSaatPass2) result[idx2].excessEinheit += takeCap;
          else result[idx2].excessDuenger += takeCap;
          remExcess -= takeCap;
        }
      }
      // self-excess: weiter ignoriert (kein negativer Carryover)
    }
    if (isSaatPass2) totalExcessE = remExcess;
    else totalExcessD = remExcess;
  }

  _internal.carryoverCache = result;
  return result;
}

// --- Entry-Time-Helpers (Issue 5 / Code-Review) ---
//
// `parseEntryTime` ist nach `computeAllCarryovers` rausgezogen, weil:
//   (a) die Logik echte Wert-Berechnung enthält (HH:MM, ISO-Fallback),
//       die isoliert testbar sein soll;
//   (b) bei jedem Aufruf neu erzeugte Function-Closures Closure-Overhead
//       verursachen.
// `formatEntryTime` ergänzt das Rendering: 3× Inline-Ternary in
// render-drill.js / render-results.js wird hier zusammengefasst.

// Parst eine Entry-Time in einen vergleichbaren Zahlenwert.
// Akzeptiert:
//   - number  → unverändert (typischerweise Date.now() / Timestamp in ms
//               oder bereits normalisierte Minuten)
//   - string  "HH:MM" / "HH:MM:SS" → Minuten seit Mitternacht
//               ISO-8601 oder andere parseable → Date.parse → ms seit Epoch
//   - sonstiges / leer → 0
function parseEntryTime(t) {
  if (typeof t === 'number') return t;
  if (typeof t === 'string') {
    // Format "HH:MM" oder "HH:MM:SS"
    var m = t.match(/^(\d{1,2}):(\d{2})/);
    if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    // ISO oder andere Formate → Date.parse Fallback
    var d = Date.parse(t);
    if (!isNaN(d)) return d;
  }
  return 0;
}

// Formatiert eine Entry-Time für die UI. Number → lokales Datum/Zeit-String,
// String → unverändert ausgegeben. Leerer Input → leerer String.
// Verhalten ist identisch zum vorherigen Inline-Ternary in den Render-Files.
function formatEntryTime(t) {
  if (!t) return '';
  if (typeof t === 'number') return new Date(t).toLocaleString('de-DE');
  return String(t);
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
  var faktor = getTabFahrgassenFaktor(r);
  return k * faktor;
}

// Berechnet Verbrauchsraten (Einheiten/ha, Dünger/ha) für einen bestimmten Tab.
// (portiert aus Inline-Code Z. 2349-2359)
// Argumente:
//   tabIdx — Index in AppGlobals.state.reiter
// Rückgabe: { unitsPerHa, duengerPerHa }
function getTabRates(tabIdx) {
  var r = AppGlobals.state.reiter[tabIdx];
  if (!r) return { unitsPerHa: 0, duengerPerHa: 0 };
  var fgFactor = getTabFahrgassenFaktor(r);
  var unitsPerHa = r.koerner * fgFactor / AppGlobals.state.koernerProEinheit;
  var duengerPerHa = r.duenger || 0;
  return { unitsPerHa: unitsPerHa, duengerPerHa: duengerPerHa };
}

// Register exposed globals on AppGlobals (ADR-001 Schritt 3, Issue #278).
Object.assign(window.AppGlobals, {
  fmt: fmt,
  fmtCompact: fmtCompact,
  EPSILON_QUANTITY: EPSILON_QUANTITY,
  _internal: _internal,
  computeFahrgassenFaktor: computeFahrgassenFaktor,
  getTabTotalEinheiten: getTabTotalEinheiten,
  getTabIstEinheiten: getTabIstEinheiten,
  getTabTotalDuenger: getTabTotalDuenger,
  getDuengerProEinheit: getDuengerProEinheit,
  getTabIstDuenger: getTabIstDuenger,
  getTabUsedEinheiten: getTabUsedEinheiten,
  getTabUsedDuenger: getTabUsedDuenger,
  computeAllCarryovers: computeAllCarryovers,
  invalidateCarryoverCache: invalidateCarryoverCache,
  getCarryover: getCarryover,
  isTabDone: isTabDone,
  getTabLastEntryTime: getTabLastEntryTime,
  getTabIstHektar: getTabIstHektar,
  getTabNextTime: getTabNextTime,
  getTabKornerGesamt: getTabKornerGesamt,
  getTabRates: getTabRates,
  parseEntryTime: parseEntryTime,
  formatEntryTime: formatEntryTime,
});