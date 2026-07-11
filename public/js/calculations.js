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

// Berechnet Carryover für alle Tabs — SENKEN-MODELL (Prio-Workfront).
//
// Praxis-Modell (sequenzielle Bearbeitung in Prio-Reihenfolge): Die Felder
// werden in PRIO-Reihenfolge bearbeitet (Prio 1 zuerst, höchste Prio zuletzt).
// Weicht ein bearbeitetes Feld von der Planung ab (IST ≠ SOLL), entsteht ein
// Saldo (Mehrbedarf bei Übergröße, Ersparnis bei Untergröße). Dieser Saldo
// wandert vorwärts und bleibt am ZULETZT BEFÜLLTEN Tab (der „Senke" = aktuelle
// Work-Front) hängen — dem Feld, das als Letztes drankam und für das der
// Restbestand bzw. die Fehlmenge anfällt.
//
// Senken-Auswahl: zuletzt befüllter, nicht-done Tab — Sortierung nach
//   lastEntryTime (absteigend) → drillPriority (absteigend) → Index (absteigend).
//   Fallback (keine Prio gesetzt): zuletzt befüllt nach Uhrzeit.
//
// Pro Material (Saat/Dünger getrennt):
//   own_i       = SOLL_Bedarf_i − used_i                (Plan-Rest; <0 = überfüllt)
//   burden      = Σ (IST_Bedarf_i − SOLL_Bedarf_i)      über Tabs mit istHektar>0
//   absorbiert  = Σ max(0, −own_i)                       über Nicht-Senken (Überfüllungen schlucken)
//   burden_net  = burden − absorbiert                    (kann negativ sein = Netto-Ersparnis)
//   remaining_i = max(0, own_i)                          für Nicht-Senken
//   remaining_Senke = max(0, own_Senke + burden_net)
//
// Materialerhaltung: Σ remaining = Σ(IST-Bedarf bearb. + SOLL-Bedarf unbearb.) − Σ used.
//
// Return pro Tab: { savedEinheit, savedDuenger, excessEinheit, excessDuenger,
//   nettedEinheit, nettedDuenger (Legacy/Compat), sinkAdjustedE/D (Senken-Zuschlag),
//   selfDeviationE/D (IST−SOLL für Hinweise), isSink }
// Cached in _internal.carryoverCache; invalidateCarryoverCache() bei Änderung.
function computeAllCarryovers() {
  if (_internal.carryoverCache !== null) return _internal.carryoverCache;

  var reiter = AppGlobals.state.reiter;
  var n = reiter.length;

  var result = [];
  for (let i = 0; i < n; i++) {
    result.push({
      savedEinheit: 0, savedDuenger: 0,
      excessEinheit: 0, excessDuenger: 0,
      nettedEinheit: 0, nettedDuenger: 0,
      sinkAdjustedE: 0, sinkAdjustedD: 0,
      selfDeviationE: 0, selfDeviationD: 0,
      isSink: false
    });
  }
  if (n === 0) { _internal.carryoverCache = result; return result; }

  // --- Hilfsfunktionen ---
  var lastEntryTime = function(i) {
    var tab = reiter[i];
    if (!tab || !tab.entries || tab.entries.length === 0) return 0;
    var last = tab.entries[tab.entries.length - 1];
    return parseEntryTime(last ? (last.time || 0) : 0);
  };
  var prioOf = function(i) {
    var p = AppGlobals.state.drillPriorities;
    if (!p) return 0;
    var v = p[String(i)];
    if (v === undefined) v = p[i];
    return v || 0;
  };

  // Senke = zuletzt befüllter, nicht-done Tab: Zeit desc → Prio desc → Index desc.
  var sinkIdx = -1, sinkTime = -1, sinkPrio = -1;
  for (let i = 0; i < n; i++) {
    var r = reiter[i];
    if (!r || r.done) continue;
    var t = lastEntryTime(i);
    var p = prioOf(i);
    if (sinkIdx === -1
        || t > sinkTime
        || (t === sinkTime && p > sinkPrio)
        || (t === sinkTime && p === sinkPrio && i > sinkIdx)) {
      sinkIdx = i; sinkTime = t; sinkPrio = p;
    }
  }
  if (sinkIdx === -1) { _internal.carryoverCache = result; return result; }
  result[sinkIdx].isSink = true;

  // PRO MATERIAL (Saat, Dünger) getrennt.
  for (var mat = 0; mat < 2; mat++) {
    var isSaat = (mat === 0);
    var getUsed = isSaat ? getTabUsedEinheiten : getTabUsedDuenger;
    var getIst  = isSaat ? getTabIstEinheiten    : getTabIstDuenger;
    var getSol  = isSaat ? getTabTotalEinheiten  : getTabTotalDuenger;
    var fldSink   = isSaat ? 'sinkAdjustedE' : 'sinkAdjustedD';
    var fldDev    = isSaat ? 'selfDeviationE' : 'selfDeviationD';
    var fldSaved  = isSaat ? 'savedEinheit' : 'savedDuenger';
    var fldExcess = isSaat ? 'excessEinheit' : 'excessDuenger';

    var burden = 0;
    var absorbiert = 0;
    for (let i = 0; i < n; i++) {
      var rr = reiter[i];
      if (!rr) continue;
      var sol = getSol(rr);
      var used = getUsed(rr);
      var own;
      // Bearbeitete Tabs (istHektar>0): sind fertig → own=0. Ihr Material-
      // Defizit (IST_Bedarf − used) fließt in den burden (Mehrbedarf bei
      // Übergröße, Überschuss bei Überfüllung). Flächen-Abweichung nur Hinweis.
      if (rr.istHektar > 0) {
        var ist = getIst(rr);
        burden += (ist - used);
        var dev = ist - sol;
        result[i][fldDev] = dev;
        if (dev < 0) result[i][fldSaved] = -dev;       // Ersparnis (Hinweis)
        else if (dev > 0) result[i][fldExcess] = dev;   // Mehrbedarf (Hinweis)
        own = 0;
      } else {
        own = sol - used;
      }
      // Überfüllung der Nicht-Senken schluckt burden (verhindert Doppelfehler).
      if (i !== sinkIdx && own < 0) absorbiert += -own;
    }
    result[sinkIdx][fldSink] = burden - absorbiert;
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
  return { savedEinheit: 0, savedDuenger: 0, excessEinheit: 0, excessDuenger: 0, nettedEinheit: 0, nettedDuenger: 0, sinkAdjustedE: 0, sinkAdjustedD: 0, selfDeviationE: 0, selfDeviationD: 0, isSink: false };
}

// Liefert pro Tab die Restbedarfe (Saatgut + Dünger) sowie Basis + Used,
// damit Render-Sites die Anzeige konsistent speisen.
//
// SENKEN-MODELL: remaining = max(0, SOLL − used + sinkAdjusted)
//   - SOLL-Basis (Plan-Bedarf), nicht IST — die IST-Abweichung fließt über
//     den Netto-Saldo (burden) zentral auf die Senke (zuletzt befüllter Tab).
//   - sinkAdjusted = burden_net für die Senke, sonst 0.
//
// Materialerhaltung: Σ remaining = Σ(SOLL) − Σ(used) + burden_net =
//   Σ(IST-Bedarf bearb. + SOLL-Bedarf unbearb.) − Σ used.
// Null-safe (fehlende Felder = 0).
function getTabRemaining(r, tabIdx) {
  var solE = getTabTotalEinheiten(r);
  var solD = getTabTotalDuenger(r);
  var istE = getTabIstEinheiten(r);
  var istD = getTabIstDuenger(r);
  var usedE = getTabUsedEinheiten(r);
  var usedD = getTabUsedDuenger(r);
  var worked = !!(r && r.istHektar > 0);
  // Bearbeitete Tabs sind fertig (own=0); ihr Defizit liegt im Senken-burden.
  var ownE = worked ? 0 : (solE - usedE);
  var ownD = worked ? 0 : (solD - usedD);
  var co = getCarryover(tabIdx);
  return {
    basisE:     worked ? istE : solE,
    basisD:     worked ? istD : solD,
    usedE:      usedE,
    usedD:      usedD,
    remainingE: Math.max(0, ownE + co.sinkAdjustedE),
    remainingD: Math.max(0, ownD + co.sinkAdjustedD)
  };
}

// --- Tab-Fertig-Check (pure) ---

// Prueft ob ein Tab "fertig" ist.
//
// SENKEN-MODELL: Fertig = remaining = 0 ODER done=true.
// Carryover (sinkAdjusted) wird nur beruecksichtigt, wenn tabIndex mitgegeben
// wird (Backward-Compat). Nil-safe (fehlende Felder = 0).
//
// Formel (konsistent mit getTabRemaining): SOLL-Basis.
//   remaining = max(0, SOLL − used + sinkAdjusted)
function isTabDone(r, tabIndex) {
  if (!r || !r.entries) return true; // Keine Entries = fertig (kein Bedarf)
  if (r.done) return true; // Manuell abgeschlossen (Issue #377)
  // Carryover nur beruecksichtigen wenn tabIndex mitgegeben
  var carryover = (tabIndex !== undefined)
    ? getCarryover(tabIndex)
    : { sinkAdjustedE: 0, sinkAdjustedD: 0 };
  var worked = !!(r && r.istHektar > 0);
  var solE = getTabTotalEinheiten(r);
  var usedE = getTabUsedEinheiten(r);
  var ownE = worked ? 0 : (solE - usedE);
  var remainingE = Math.max(0, ownE + carryover.sinkAdjustedE);
  if (remainingE > 0.05) return false;

  var solD = getTabTotalDuenger(r);
  var usedD = getTabUsedDuenger(r);
  var ownD = worked ? 0 : (solD - usedD);
  var remainingD = Math.max(0, ownD + carryover.sinkAdjustedD);
  return remainingD <= 0.05;
}

// --- Hilfsfunktionen für Entry-Time ---

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
  getTabIstHektar: getTabIstHektar,
  getTabNextTime: getTabNextTime,
  getTabKornerGesamt: getTabKornerGesamt,
  getTabRates: getTabRates,
  parseEntryTime: parseEntryTime,
  formatEntryTime: formatEntryTime,
});
