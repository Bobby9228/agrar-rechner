// Pure functions für landwirtschaftliche Berechnungen.
// Gleiche Eingabe → gleiche Ausgabe, kein State-Zugriff, keine DOM-Manipulation.

// --- Format/Parser Utilities (pure) ---

// fmt — Runde auf 1 Dezimalstelle, deutsche Formatierung mit Komma.
// DE-Rundung: "round half up" — ab .5 wird aufgerundet (0.05 → '0,1', nicht '0,0').
function fmt(n) {
  if (n === null || n === undefined || isNaN(n)) return '0,0';
  var x = n * 10;
  var rounded = (x >= 0 ? Math.floor(x + 0.5) : -Math.floor(-x + 0.5)) / 10;
  return String(rounded.toFixed(1)).replace('.', ',');
}

// fmtCompact — wie fmt(), aber ohne nachstehendes ",0" für ganze Zahlen.
function fmtCompact(n) {
  var s = fmt(n);
  if (s.endsWith(',0')) s = s.slice(0, -2);
  return s;
}

// --- Konstanten ---

// Schwelle unter der Floating-Point-Restwerte als "nichts" gelten.
var EPSILON_QUANTITY = 0.05;

// --- Fahrgassen-Faktor (zentrale Berechnung) ---

// Produktivitätsfaktor für Fahrgassen: (breite - 1) / breite.
// Guard: breite < 2 → 1.0 (keine Korrektur). 1m Fahrspur pro `breite` Meter.
function computeFahrgassenFaktor(breite) {
  if (!breite || breite < 2) return 1;
  return (breite - 1) / breite;
}

// Liefert den Fahrgassen-Faktor für einen Tab r.
// Per-Tab-Override (r.fahrgassenEnabled/Breite) fällt auf den globalen
// Default (AppGlobals.state.*) zurück, wenn nicht gesetzt.
function getTabFahrgassenFaktor(r) {
  var enabled = (r.fahrgassenEnabled !== undefined) ? r.fahrgassenEnabled : AppGlobals.state.fahrgassenEnabled;
  var breite  = (r.fahrgassenBreite  !== undefined) ? r.fahrgassenBreite  : AppGlobals.state.fahrgassenBreite;
  if (!enabled || breite <= 0) return 1;
  return computeFahrgassenFaktor(breite);
}

// --- Einheiten-Berechnung (SOLL) ---

// Berechnet die SOLL-Einheiten für ein Tab-Objekt r.
// Formel: (hektar × koerner / koernerProEinheit) × Fahrgassen-Faktor.
// Gibt 0 zurück, wenn r.hektar/koerner fehlen oder kpe ≤ 0.
function getTabTotalEinheiten(r, koernerProEinheit) {
  var kpe = (koernerProEinheit !== undefined) ? koernerProEinheit : AppGlobals.state.koernerProEinheit;
  if (!r || !r.hektar || !r.koerner || kpe <= 0) return 0;
  var faktor = getTabFahrgassenFaktor(r);
  var einheiten = (r.hektar * r.koerner) / kpe;
  return Math.max(0, einheiten * faktor);
}

// IST-Einheiten basierend auf der IST-Fläche (r.istHektar).
function getTabIstEinheiten(r) {
  if (!r || !r.istHektar || !r.koerner || AppGlobals.state.koernerProEinheit <= 0) return 0;
  var faktor = getTabFahrgassenFaktor(r);
  var einheiten = (r.istHektar * r.koerner) / AppGlobals.state.koernerProEinheit;
  return Math.max(0, einheiten * faktor);
}

// --- Dünger-Berechnung (SOLL) ---

// Berechnet Düngermenge in kg (kg/ha × ha = kg).
// Rückgabe ist kg, nicht Einheiten — Aufrufer hängen ' kg' an.
function getTabTotalDuenger(r) {
  if (!r || !r.hektar || !r.duenger) return 0;
  return Math.max(0, r.hektar * r.duenger);
}

// kg Dünger pro Einheit Saatgut für einen Tab.
// Formel: r.duenger × koernerProEinheit / r.koerner
// (Herleitung: (hektar × duenger) ÷ (hektar × koerner / kpe) = duenger × kpe / koerner)
function getDuengerProEinheit(r, koernerProEinheit) {
  if (!r || !r.duenger || !r.koerner || !koernerProEinheit) return 0;
  return r.duenger * koernerProEinheit / r.koerner;
}

// Berechnet IST-Dünger (kg) basierend auf istHektar.
// Formel: r.istHektar * r.duenger (kg/ha) → kg total.
function getTabIstDuenger(r) {
  if (!r || !r.istHektar || !r.duenger) return 0;
  return Math.max(0, r.istHektar * r.duenger);
}

// --- Carryover-Berechnung ---

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

// Netto-Carryover-Pools (Phase 0 + Netting) für die reiter-Liste.
//
// Phase 0: Savings = SOLL-IST (IST<SOLL), Excess = IST-SOLL (IST>SOLL), IST=0→0.
// Netting: netSaved  = max(0, totalSaved  - totalExcess),
//          netExcess = max(0, totalExcess - totalSaved).
// Phase 1 verteilt nur netSaved, Phase 2 vergibt nur netExcess.
function _computeNetCarryoverPools(reiter) {
  var totalSavedE = 0, totalSavedD = 0;
  var totalExcessE = 0, totalExcessD = 0;

  for (let i = 0; i < reiter.length; i++) {
    var t = reiter[i];
    var istE = getTabIstEinheiten(t);
    var solE = getTabTotalEinheiten(t);
    var istD = getTabIstDuenger(t);
    var solD = getTabTotalDuenger(t);
    if (istE > 0) {
      if (solE > istE) totalSavedE += (solE - istE);
      else if (istE > solE) totalExcessE += (istE - solE);
    }
    if (istD > 0) {
      if (solD > istD) totalSavedD += (solD - istD);
      else if (istD > solD) totalExcessD += (istD - solD);
    }
  }

  return {
    totalSavedE: totalSavedE, totalExcessE: totalExcessE,
    totalSavedD: totalSavedD, totalExcessD: totalExcessD,
    netSavedE:  Math.max(0, totalSavedE  - totalExcessE),
    netExcessE: Math.max(0, totalExcessE - totalSavedE),
    netSavedD:  Math.max(0, totalSavedD  - totalExcessD),
    netExcessD: Math.max(0, totalExcessD - totalSavedD),
  };
}

// Berechnet Carryover (Ersparnisse/Überschüsse) für alle Tabs.
//
// Phase 1: Ersparnisse (saved = SOLL - IST bei IST < SOLL) an unfertige Tabs.
// Phase 2: Mehrbedarfe (excess bei IST > SOLL) aus Mehrbedarfs-Tabs decken.
// Cached in _internal.carryoverCache; invalidateCarryoverCache() bei Änderung.
function computeAllCarryovers() {
  if (_internal.carryoverCache !== null) return _internal.carryoverCache;

  var result = [];
  for (let i = 0; i < AppGlobals.state.reiter.length; i++) {
    result.push({ savedEinheit: 0, savedDuenger: 0, excessEinheit: 0, excessDuenger: 0 });
  }

  // --- PHASE 0 + NETTING ---
  var _pools = _computeNetCarryoverPools(AppGlobals.state.reiter);
  var netSavedE  = _pools.netSavedE;
  var netExcessE = _pools.netExcessE;
  var netSavedD  = _pools.netSavedD;
  var netExcessD = _pools.netExcessD;

  // === PHASE 1: Ersparnisse verteilen — Saat und Dünger getrennt ===
  //
  // Saat und Dünger fließen UNABHÄNIG: ein Tab mit Saat-Bedarf bekommt
  // nicht automatisch Dünger-Carryover (und umgekehrt).
  // Carryover-Bedarf ist IST-basiert (basis = istE/D wenn istHa > 0, sonst
  // solE/D). Skip für fertige Quellen (usedE >= istE): Ersparnis nicht
  // "doppelt" vergeben. Mehrbedarf-Tabs (IST > SOLL) bekommen keinen
  // Phase-1-Carryover (Netto-Saldo verrechnet ihren Mehrbedarf bereits).
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
        // Skip: IST gedeckt UND Tab ist Ersparnis-Quelle (kein Doppel-Profit).
        var istCovered = isSaatPass
          ? (istE > 0 && usedE >= istE)
          : (istD > 0 && usedD >= istD);
        var isSource = isSaatPass
          ? (solE > istE && istE > 0)
          : (solD > istD && istD > 0);
        // Skip: Mehrbedarf-Tabs (IST > SOLL) — Netto-Saldo verrechnet bereits.
        var hasMehrbedarf = isSaatPass
          ? (istE > 0 && istE > solE)
          : (istD > 0 && istD > solD);
        // Phase 1 erlaubt leere Empfänger-Tabs — SAV-Budget kaskadiert weiter.
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
  // Auch hier entkoppelt: Capacity-Sort + Absorption laufen pro Material.
  // Self-Mehrbedarf (used > basis) wird ignoriert — keine Verteilung.
  for (var mat2 = 0; mat2 < 2; mat2++) {
    var isSaatPass2 = (mat2 === 0);
    var remExcess = isSaatPass2 ? netExcessE : netExcessD;

    // Tabs mit Capacity sammeln + sortieren.
    // Capacity = max(0, basis − used − saved_received), IST-basiert.
    // Self-Excess (used > basis) und Mehrbedarf-Quellen (IST > SOLL) ausgeschlossen.
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
  }

  _internal.carryoverCache = result;
  return result;
}

// --- Entry-Time-Helpers ---

// Parst eine Entry-Time: number → unverändert; "HH:MM"/"HH:MM:SS" → Minuten
// seit Mitternacht; ISO/anderes parseable → Date.parse → ms seit Epoch;
// sonstiges/leer → 0.
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

// Formatiert eine Entry-Time für die UI: number → lokales Datum/Zeit-String;
// string → unverändert; leerer Input → leerer String.
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

// Liefert pro Tab die auf Carryover genetteten Restbedarfe (Saatgut + Dünger)
// sowie Basis + Used, damit Render-Sites die Anzeige konsistent speisen.
// IST-Fläche hat Vorrang vor SOLL. Nutzt getTabUsed* (mit `|| 0`-Guards).
function getTabRemaining(r, tabIdx) {
  var istE = getTabIstEinheiten(r);
  var istD = getTabIstDuenger(r);
  var basisE = istE > 0 ? istE : getTabTotalEinheiten(r);
  var basisD = istD > 0 ? istD : getTabTotalDuenger(r);
  var usedE  = getTabUsedEinheiten(r);
  var usedD  = getTabUsedDuenger(r);
  var co     = getCarryover(tabIdx);
  return {
    basisE:     basisE,
    basisD:     basisD,
    usedE:      usedE,
    usedD:      usedD,
    remainingE: Math.max(0, basisE - usedE - co.savedEinheit + co.excessEinheit),
    remainingD: Math.max(0, basisD - usedD - co.savedDuenger + co.excessDuenger)
  };
}

// --- Tab-Fertig-Check (pure) ---

// Prüft ob ein Tab "fertig" ist (alle Bedarfe gedeckt).
// Carryover wird nur berücksichtigt, wenn tabIndex mitgegeben wird (Backward-Compat).
// Nil-safe (fehlende Felder = 0).
function isTabDone(r, tabIndex) {
  if (!r || !r.entries) return true; // Keine Entries = fertig (kein Bedarf)
  // Carryover nur berücksichtigen wenn tabIndex mitgegeben
  var carryover = (tabIndex !== undefined)
    ? getCarryover(tabIndex)
    : { savedEinheit: 0, savedDuenger: 0, excessEinheit: 0, excessDuenger: 0 };
  // IST > 0 ? IST : SOLL
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

function getTabLastEntryTime(r) {
  if (!r || !r.entries || r.entries.length === 0) return 0;
  var last = r.entries[r.entries.length - 1];
  return last ? (last.time || 0) : 0;
}

// IST-Hektar-Summe für einen Tab.
// Priorität: r.istHektar (Input-Feld) > Summe aus entries[].istHektar.
function getTabIstHektar(r) {
  if (!r) return 0;
  if (r.istHektar && r.istHektar > 0) return r.istHektar;
  if (!r.entries) return 0;
  return r.entries.reduce(function(s, e) { return s + (e.istHektar || 0); }, 0);
}

// Nächster Zeitstempel für Sortierung (letzter Entry + 1 oder now).
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

// Verbrauchsraten (Einheiten/ha, Dünger/ha) für einen Tab.
// unitsPerHa = koerner × fgFaktor / koernerProEinheit; duengerPerHa = duenger.
function getTabRates(tabIdx) {
  var r = AppGlobals.state.reiter[tabIdx];
  if (!r) return { unitsPerHa: 0, duengerPerHa: 0 };
  var fgFactor = getTabFahrgassenFaktor(r);
  var unitsPerHa = r.koerner * fgFactor / AppGlobals.state.koernerProEinheit;
  var duengerPerHa = r.duenger || 0;
  return { unitsPerHa: unitsPerHa, duengerPerHa: duengerPerHa };
}

// Register exposed globals on AppGlobals.
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
  getTabRemaining: getTabRemaining,
  isTabDone: isTabDone,
  getTabLastEntryTime: getTabLastEntryTime,
  getTabIstHektar: getTabIstHektar,
  getTabNextTime: getTabNextTime,
  getTabKornerGesamt: getTabKornerGesamt,
  getTabRates: getTabRates,
  parseEntryTime: parseEntryTime,
  formatEntryTime: formatEntryTime,
});