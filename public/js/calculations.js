// Pure functions für landwirtschaftliche Berechnungen.
// Gleiche Eingabe → gleiche Ausgabe, kein State-Zugriff, keine DOM-Manipulation.

// --- Per-Tab Einheitsgröße ---
//
// Migration 5→6 (Kultur-Feature): r.koernerProEinheit ist ab jetzt die
// authoritative Quelle für die Einheitsgröße. Der globale state.koernerProEinheit
// bleibt als "Profil-Default" (vom aktuellen Kultur-Profil gesetzt), wird
// beim Anlegen eines neuen Tabs kopiert, und dient als Fallback für ältere
// Tabs ohne per-Tab-Feld.
//
// Reihenfolge (alle Berechnungen einheitlich):
//   1. expliziter Funktionsparameter (Tests, Sonderszenarien) — wenn > 0
//   2. r.koernerProEinheit — jeder endliche Wert zählt (auch 0 = Sonstiges leer)
//   3. AppGlobals.state.koernerProEinheit — nur wenn r keinen Wert hat
//   4. 50000 (Mais-Backstop für Frisch-Installs ohne Kultur)
//
// Ein kpe von 0 ist ein gültiger Wert ("Sonstiges ohne Eingabe") — die
// Aufrufer prüfen separat (getTabKoernerProEinheit / renderResultCard) und
// blenden die Berechnung mit einem Placeholder aus.
function resolveKoernerProEinheit(r, koernerProEinheit) {
  if (koernerProEinheit !== undefined && koernerProEinheit !== null) {
    var n = Number(koernerProEinheit);
    if (isFinite(n) && n > 0) return n;
    if (n === 0) return 0; // explizit übergebene 0 respektieren
  }
  if (r && typeof r.koernerProEinheit === 'number' && isFinite(r.koernerProEinheit)) {
    return r.koernerProEinheit;
  }
  var g = AppGlobals.state && AppGlobals.state.koernerProEinheit;
  if (typeof g === 'number' && isFinite(g)) return g;
  // Issue #447 Welle 1.4: Mais-Backstop aus zentraler SSOT-Konstante
  // (state.js → AppGlobals.DEFAULT_KOERNER_PRO_EINHEIT). Spiegelt
  // CULTURE_PROFILES.mais.defaultKoernerProEinheit (siehe
  // tests/state-ssot.test.js).
  return AppGlobals.DEFAULT_KOERNER_PRO_EINHEIT;
}

// Helper für Aufrufer, die wissen wollen, ob der Tab eine sinnvolle
// Einheitsgröße hat (für UI: "Bitte Körner pro Einheit angeben").
// Sonstiges-Tabs vor User-Eingabe geben hier 0 zurück.
//
// Per-Tab-0 ist die explizite Aussage „nicht angegeben" (Sonstiges ohne
// Eingabe, oder vom User bewusst geleert) und wird respektiert — er fällt
// NICHT auf den globalen Profil-Default zurück. Nur wenn r.koernerProEinheit
// gar nicht gesetzt/ungültig ist, wird das globale Profil konsultiert.
function getTabKoernerProEinheit(r) {
  if (r && typeof r.koernerProEinheit === 'number' && isFinite(r.koernerProEinheit)) {
    return r.koernerProEinheit;
  }
  var g = AppGlobals.state && AppGlobals.state.koernerProEinheit;
  if (typeof g === 'number' && isFinite(g) && g > 0) return g;
  return 0;
}

// --- Format/Parser Utilities (pure) ---

// fmt — Runde auf 1 Dezimalstelle, deutsche Formatierung mit Komma.
// DE-Rundung: "round half up" — ab .5 wird aufgerundet (0.05 → '0,1', nicht '0,0').
// Issue #445 Welle 1: nicht-endliche Werte (NaN, Infinity, -Infinity) liefern
// '0,0' statt 'Infinity' / 'NaN' in der UI. Vorher landete Infinity als Text
// "Infinity" auf dem Bildschirm, weil toFixed(1) den Wert nicht abfängt.
function fmt(n) {
  if (n === null || n === undefined || !isFinite(n)) return '0,0';
  var x = n * 10;
  var rounded = (x >= 0 ? Math.floor(x + 0.5) : -Math.floor(-x + 0.5)) / 10;
  return String(rounded.toFixed(1)).replace('.', ',');
}

// fmtCompact — wie fmt(), aber ohne nachstehendes ",0" für ganze Zahlen.
// Erbt den Finite-Guard aus fmt() automatisch.
function fmtCompact(n) {
  var s = fmt(n);
  if (s.endsWith(',0')) s = s.slice(0, -2);
  return s;
}

// --- Konstanten ---

// Schwelle unter der Floating-Point-Restwerte als "nichts" gelten.
var EPSILON_QUANTITY = 0.05;

// Saatgut-Einheiten werden intern auf 6 Nachkommastellen begrenzt (s. round6).
// Die UI zeigt 3 Stellen: Einzelwerte, die dabei noch als 0,000 erscheinen
// würden, gelten nur für Anzeige/Fertig-Status als 0. Intern bleiben sie für
// Summen und Carryover vollständig erhalten. Hektar/Dünger bleiben unverändert.
var EPSILON_EINHEIT = 0.000499999;

// Rundet auf 6 Nachkommastellen, damit Gleitkomma-Reste (z.B. -0.04 vs.
// -0.040000000000000036) in der Carryover-/Remaining-Logik konsistent
// verschwinden und UI-Vergleiche stabil bleiben.
function round6(n) {
  if (!isFinite(n)) return n;
  return Math.round(n * 1e6) / 1e6;
}

// Saatgut-Einheiten ohne Label: immer 3 sichtbare Nachkommastellen.
// fmt() bleibt bewusst bei einer Stelle, weil es auch Hektar und Dünger nutzt.
function fmtEinheit(n) {
  if (n === null || n === undefined || isNaN(n)) return '0,000';
  var x = round6(n) * 1000;
  var rounded = (x >= 0 ? Math.floor(x + 0.5) : -Math.floor(-x + 0.5)) / 1000;
  return String(rounded.toFixed(3)).replace('.', ',');
}

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
// Saatgut-Einheiten werden intern auf 6 Nachkommastellen begrenzt, damit
// Carryover/Remaining keine Gleitkomma-Reste (z.B. -0.040000000000000036)
// weitertragen.
function getTabTotalEinheiten(r, koernerProEinheit) {
  var kpe = resolveKoernerProEinheit(r, koernerProEinheit);
  if (!r || !r.hektar || !r.koerner || kpe <= 0) return 0;
  var faktor = getTabFahrgassenFaktor(r);
  var einheiten = (r.hektar * r.koerner) / kpe;
  if (!isFinite(einheiten)) return 0;
  return round6(Math.max(0, einheiten * faktor));
}

// IST-Einheiten basierend auf der IST-Fläche (r.istHektar).
function getTabIstEinheiten(r) {
  if (!r || !r.istHektar || !r.koerner) return 0;
  var kpe = resolveKoernerProEinheit(r);
  if (kpe <= 0) return 0;
  var faktor = getTabFahrgassenFaktor(r);
  var einheiten = (r.istHektar * r.koerner) / kpe;
  if (!isFinite(einheiten)) return 0;
  return round6(Math.max(0, einheiten * faktor));
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
  if (!r || !r.duenger || !r.koerner) return 0;
  var kpe = resolveKoernerProEinheit(r, koernerProEinheit);
  if (!kpe) return 0;
  var result = r.duenger * kpe / r.koerner;
  return isFinite(result) ? result : 0;
}

// Berechnet IST-Dünger (kg) basierend auf istHektar.
// Formel: r.istHektar * r.duenger (kg/ha) → kg total.
function getTabIstDuenger(r) {
  if (!r || !r.istHektar || !r.duenger) return 0;
  return Math.max(0, r.istHektar * r.duenger);
}

// --- Saldo-Funktionen (Issue #447 Welle 2a, signed SOLL−IST) ---
//
// SSOT für die signed Subtraktion SOLL−IST. Positive Zahl = Ersparnis
// (SOLL > IST), negative = Mehrverbrauch (IST > SOLL). Nil-safe:
// fehlende Felder werden als 0 behandelt (getTabTotalEinheiten /
// getTabIstEinheiten / getTabTotalDuenger / getTabIstDuenger liefern
// ohnehin 0 bei fehlenden Voraussetzungen).
//
// Bewusst KEIN neues View-Model-Objekt, KEINE Umbenennung bestehender
// getTab*-Funktionen — minimal invasiv: nur die Subtraktion wird zu einer
// benannten Funktion, die Anzeige-Semantik (max(0, ±saldo) → savings /
// excess) bleibt lokal in den Renderern.

// Signed Saat-Saldo: SOLL-Einheiten minus IST-Einheiten.
// runde6-Stabilisierung analog zu getTabTotalEinheiten / getTabIstEinheiten,
// damit Carryover-/Display-Logik keine Gleitkomma-Reste weiterträgt.
function getTabSaldoE(r) {
  return round6(getTabTotalEinheiten(r) - getTabIstEinheiten(r));
}

// Signed Dünger-Saldo: SOLL-Dünger minus IST-Dünger (in kg).
// Keine 6-NK-Rundung hier — Dünger bleibt kg-genau (passt zu
// getTabTotalDuenger / getTabIstDuenger, die ebenfalls ungerundet sind).
function getTabSaldoD(r) {
  return getTabTotalDuenger(r) - getTabIstDuenger(r);
}

// --- Carryover-Berechnung ---

function getTabUsedEinheiten(r) {
  if (!r || !r.entries) return 0;
  return round6(r.entries.reduce(function(s, e) { return s + (e.einheit || 0); }, 0));
}

function getTabUsedDuenger(r) {
  if (!r || !r.entries) return 0;
  return r.entries.reduce(function(s, e) { return s + (e.duenger || 0); }, 0);
}

// --- Carryover-Cache (interner State, nicht pure) ---

var _internal = {
  carryoverCache: null,
  drillCalcTimer: null
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
    // Saatgut-Werte werden am Ende auf 6 Nachkommastellen gerundet, damit
    // keine Gleitkomma-Reste (z.B. -0.040000000000000036) nach außen
    // propagieren. Dünger bleibt unverändert (kg-Granularität).
    var roundResult = isSaat ? round6 : function(x) { return x; };

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
        result[i][fldDev] = roundResult(dev);
        if (dev < 0) result[i][fldSaved] = roundResult(-dev);    // Ersparnis (Hinweis)
        else if (dev > 0) result[i][fldExcess] = roundResult(dev); // Mehrbedarf (Hinweis)
        own = 0;
      } else {
        own = sol - used;
      }
      // Überfüllung der Nicht-Senken schluckt burden (verhindert Doppelfehler).
      if (i !== sinkIdx && own < 0) absorbiert += -own;
    }
    result[sinkIdx][fldSink] = roundResult(burden - absorbiert);
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

// --- Lokales Protokoll-Redesign Helpers (pure) ---
//
// Datumsschlüssel (YYYY-MM-DD) für Entry-Times und Maschinen-Log.
// number → ISO-Datum aus JS-Date; string "HH:MM" → heute (relativ zur
// Systemzeit, da Drill-Einträge sekunden-genau dort liegen); nicht-
// parsbar → '' (kein Datum, gilt als "ungruppiert").
function parseEntryDateKey(t) {
  if (t === null || t === undefined) return '';
  if (typeof t === 'number' && isFinite(t)) {
    var d = new Date(t);
    if (isNaN(d.getTime())) return '';
    return _dateKeyFromDate(d);
  }
  if (typeof t === 'string') {
    var trimmed = t.trim();
    if (!trimmed) return '';
    // "HH:MM" oder "HH:MM:SS" → heute (Landwirt tippt live, Einträge sind
    // tagesgenau innerhalb einer Session). Bewusst KEIN Date-Konstrukt mit
    // Jahr 1970 etc. — wir brauchen nur YYYY-MM-DD relativ zur Systemzeit.
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      return _dateKeyFromDate(new Date());
    }
    // ISO/Date.parse Fallback
    var d2 = Date.parse(trimmed);
    if (!isNaN(d2)) return _dateKeyFromDate(new Date(d2));
  }
  return '';
}

// Formatiert Entry-Time ausschließlich als "HH:MM" (keine Sekunden).
// number → Date-Locale "HH:MM"; string "HH:MM" / "HH:MM:SS" → auf "HH:MM"
// gekürzt; leer → "".
function formatEntryTimeHHMM(t) {
  if (t === null || t === undefined) return '';
  if (typeof t === 'number' && isFinite(t)) {
    var d = new Date(t);
    if (isNaN(d.getTime())) return '';
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    return hh + ':' + mm;
  }
  if (typeof t === 'string') {
    var m = t.trim().match(/^(\d{1,2}):(\d{2})/);
    if (m) return String(m[1]).padStart(2, '0') + ':' + m[2];
  }
  return '';
}

// Formatiert Entry-Time als kompakte Karten-Zeile:
//   "15.08.2026 · 10:12 Uhr"
// Robuste Behandlung alter Time-Formen (render-results.js Inline-Protokoll):
//   - number (ms seit Epoch)         → echtes Datum + HH:MM (lokale Zeit)
//   - string "HH:MM" / "HH:MM:SS"    → heutiges Datum + HH:MM
//   - string mit anderem Format       → Date.parse-Fallback; bei Erfolg
//                                      dasselbe Format, sonst "" (graceful,
//                                      kein Crash auf korrupten Einträgen)
//   - null/undefined/leer             → ""
function formatEntryTimeCard(t) {
  if (t === null || t === undefined) return '';
  var dateObj = null;
  var hhmm = '';
  if (typeof t === 'number') {
    // 0 ist der Sanitizer-Default für fehlende Alt-Zeitwerte; negative Werte
    // liegen ebenfalls vor Unix-Epoch und sind keine gültigen Buchungszeiten.
    if (!isFinite(t) || t <= 0) return '';
    var dn = new Date(t);
    if (!isNaN(dn.getTime())) dateObj = dn;
  } else if (typeof t === 'string') {
    var trimmed = t.trim();
    if (trimmed) {
      var m = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      if (m) {
        var hours = parseInt(m[1], 10);
        var minutes = parseInt(m[2], 10);
        var seconds = m[3] === undefined ? 0 : parseInt(m[3], 10);
        if (hours > 23 || minutes > 59 || seconds > 59) return '';
        hhmm = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
        dateObj = new Date();
      } else {
        var parsed = Date.parse(trimmed);
        if (!isNaN(parsed)) dateObj = new Date(parsed);
      }
    }
  }
  if (!dateObj) return '';
  if (!hhmm) {
    hhmm = String(dateObj.getHours()).padStart(2, '0') + ':' +
           String(dateObj.getMinutes()).padStart(2, '0');
  }
  var dd = String(dateObj.getDate()).padStart(2, '0');
  var mo = String(dateObj.getMonth() + 1).padStart(2, '0');
  var yyyy = dateObj.getFullYear();
  return dd + '.' + mo + '.' + yyyy + ' \u00B7 ' + hhmm + ' Uhr';
}

// YYYY-MM-DD aus JS-Date (lokale Zeit, nicht UTC) — verhindert
// Timezone-Drift für "Heute, 14. Aug."-Header.
function _dateKeyFromDate(d) {
  var y = d.getFullYear();
  var mo = String(d.getMonth() + 1).padStart(2, '0');
  var da = String(d.getDate()).padStart(2, '0');
  return y + '-' + mo + '-' + da;
}

// Deutsches Datum lang: "14. August 2026"
var _MONTHS_DE_LONG = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];
function formatDateKeyGerman(key) {
  if (typeof key !== 'string') return '';
  var parts = key.split('-');
  if (parts.length !== 3) return '';
  var y = parseInt(parts[0], 10);
  var mi = parseInt(parts[1], 10) - 1;
  var da = parseInt(parts[2], 10);
  if (!isFinite(y) || !isFinite(mi) || !isFinite(da)) return '';
  if (mi < 0 || mi > 11) return '';
  return da + '. ' + _MONTHS_DE_LONG[mi] + ' ' + y;
}

// Deutsches Datum kurz: "14. Aug." — verwendet im Gesamtbilanz-Header
// ("Heute, 14. Aug.").
var _MONTHS_DE_SHORT = [
  'Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni',
  'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'
];
function formatDateKeyShort(key) {
  if (typeof key !== 'string') return '';
  var parts = key.split('-');
  if (parts.length !== 3) return '';
  var y = parseInt(parts[0], 10);
  var mi = parseInt(parts[1], 10) - 1;
  var da = parseInt(parts[2], 10);
  if (!isFinite(y) || !isFinite(mi) || !isFinite(da)) return '';
  if (mi < 0 || mi > 11) return '';
  return da + '. ' + _MONTHS_DE_SHORT[mi];
}

// "Heute"-Marker für Gesamtbilanz-Header: relativ zur Systemzeit.
function isTodayKey(key) {
  if (typeof key !== 'string') return false;
  return key === _dateKeyFromDate(new Date());
}

function invalidateCarryoverCache() {
  _internal.carryoverCache = null;
}

function getCarryover(tabIndex) {
  var all = computeAllCarryovers();
  if (tabIndex >= 0 && tabIndex < all.length) return all[tabIndex];
  return { savedEinheit: 0, savedDuenger: 0, excessEinheit: 0, excessDuenger: 0, nettedEinheit: 0, nettedDuenger: 0, sinkAdjustedE: 0, sinkAdjustedD: 0, selfDeviationE: 0, selfDeviationD: 0, isSink: false };
}

// --- Maschinen-Log Forecast-Walk (Issue #447 Welle 2a, SSOT) ---
//
// PURE Funktion: berechnet den kumulativen Tank-Stand nach jedem Entry
// sowie die "Saat leer bei" / "Dünger leer bei" Prognose-Hektar für den
// letzten Eintrag. Vorher lebte dieser Walk ZWEIMAL fast identisch in
// render-drill.js (renderMachineLog) und render-local-protocol.js
// (_getCurrentMachineForecast) — beide mit dem Issue-#307-Verhalten
// (zaehlerStand=0 darf NICHT auf entry.hektar zurückfallen).
//
// Algorithmus (1:1 portiert aus den Renderern, keine Logik-Änderung):
//   pro Entry:
//     zaehler  = entry.zaehlerStand != null
//                  ? entry.zaehlerStand
//                  : (entry.hektar != null ? entry.hektar : 0)
//     driven   = max(0, zaehler − lastZaehler)
//     wenn unitsPerHa > 0:    cumEinheit = max(0, cumEinheit − driven*unitsPerHa)
//     wenn duengerPerHa > 0:  cumDuenger = max(0, cumDuenger − driven*duengerPerHa)
//     cumEinheit += entry.einheit || 0
//     cumDuenger += entry.duenger || 0
//     lastZaehler = zaehler
//
// Rückgabe (alle Felder; Saat/duenger Leer sind die finalen Prognose-Werte):
//   hasLog       : log.length > 0
//   cumEinheit   : kumulativer Saat-Tank-Stand nach dem letzten Entry
//   cumDuenger   : kumulativer Dünger-Tank-Stand nach dem letzten Entry
//   lastZaehler  : zaehler-Wert des letzten Entries (= Basis für Leer-Prognose)
//   saatLeer     : lastZaehler + cumEinheit/unitsPerHa, oder null
//                   wenn unitsPerHa <= 0 ODER cumEinheit <= 0
//   duengerLeer  : lastZaehler + cumDuenger/duengerPerHa, oder null
//                   wenn duengerPerHa <= 0 ODER cumDuenger <= 0
//
// Nil-safe: log === null/undefined → []; Entry-Felder fehlen → 0.
function computeMachineForecast(log, unitsPerHa, duengerPerHa) {
  var safeLog = log || [];
  var cumEinheit = 0;
  var cumDuenger = 0;
  var lastZaehler = 0;
  for (var i = 0; i < safeLog.length; i++) {
    var entry = safeLog[i] || {};
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
  var saatLeer = (unitsPerHa > 0 && cumEinheit > 0)
    ? lastZaehler + cumEinheit / unitsPerHa
    : null;
  var duengerLeer = (duengerPerHa > 0 && cumDuenger > 0)
    ? lastZaehler + cumDuenger / duengerPerHa
    : null;
  return {
    hasLog: safeLog.length > 0,
    cumEinheit: cumEinheit,
    cumDuenger: cumDuenger,
    lastZaehler: lastZaehler,
    saatLeer: saatLeer,
    duengerLeer: duengerLeer
  };
}

// Serien-Variante (Issue #447 Welle 2a): walkt das Log EINMAL und liefert
// pro Entry-Index den Tank-Snapshot NACH diesem Entry (cumEinheit,
// cumDuenger, zaehler) plus hasLog — dieselbe Schrittlogik wie
// computeMachineForecast, aber O(n) statt Prefix-Walks à O(n²).
// Für Renderer, die je Eintrag eine Zeile mit kumulativem Stand bauen.
// Nil-safe: log === null/undefined → [].
function computeMachineForecastSeries(log, unitsPerHa, duengerPerHa) {
  var safeLog = log || [];
  var cumEinheit = 0;
  var cumDuenger = 0;
  var lastZaehler = 0;
  var series = [];
  for (var i = 0; i < safeLog.length; i++) {
    var entry = safeLog[i] || {};
    var zaehler = entry.zaehlerStand != null
      ? entry.zaehlerStand
      : (entry.hektar != null ? entry.hektar : 0);
    var driven = Math.max(0, zaehler - lastZaehler);
    if (unitsPerHa > 0) cumEinheit = Math.max(0, cumEinheit - driven * unitsPerHa);
    if (duengerPerHa > 0) cumDuenger = Math.max(0, cumDuenger - driven * duengerPerHa);
    cumEinheit += entry.einheit || 0;
    cumDuenger += entry.duenger || 0;
    lastZaehler = zaehler;
    series.push({ cumEinheit: cumEinheit, cumDuenger: cumDuenger, zaehler: zaehler });
  }
  return { hasLog: safeLog.length > 0, series: series };
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
    remainingE: round6(Math.max(0, ownE + co.sinkAdjustedE)),
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
  if (remainingE > EPSILON_EINHEIT) return false;

  var solD = getTabTotalDuenger(r);
  var usedD = getTabUsedDuenger(r);
  var ownD = worked ? 0 : (solD - usedD);
  var remainingD = Math.max(0, ownD + carryover.sinkAdjustedD);
  return remainingD <= EPSILON_QUANTITY;
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
// These use getActiveReiter() so they are NOT pure — their active-tab wrappers
// live in input-handlers.js.

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
  var kpe = resolveKoernerProEinheit(r);
  var unitsPerHa = (kpe > 0) ? r.koerner * fgFactor / kpe : 0;
  var duengerPerHa = r.duenger || 0;
  return { unitsPerHa: unitsPerHa, duengerPerHa: duengerPerHa };
}

// Register exposed globals on AppGlobals.
Object.assign(window.AppGlobals, {
  fmt: fmt,
  fmtCompact: fmtCompact,
  fmtEinheit: fmtEinheit,
  EPSILON_QUANTITY: EPSILON_QUANTITY,
  EPSILON_EINHEIT: EPSILON_EINHEIT,
  round6: round6,
  _internal: _internal,
  resolveKoernerProEinheit: resolveKoernerProEinheit,
  getTabKoernerProEinheit: getTabKoernerProEinheit,
  computeFahrgassenFaktor: computeFahrgassenFaktor,
  getTabTotalEinheiten: getTabTotalEinheiten,
  getTabIstEinheiten: getTabIstEinheiten,
  getTabTotalDuenger: getTabTotalDuenger,
  getDuengerProEinheit: getDuengerProEinheit,
  getTabIstDuenger: getTabIstDuenger,
  getTabSaldoE: getTabSaldoE,
  getTabSaldoD: getTabSaldoD,
  computeMachineForecast: computeMachineForecast,
  computeMachineForecastSeries: computeMachineForecastSeries,
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
  formatEntryTime: formatEntryTime,
  parseEntryDateKey: parseEntryDateKey,
  formatEntryTimeHHMM: formatEntryTimeHHMM,
  formatDateKeyGerman: formatDateKeyGerman,
  formatDateKeyShort: formatDateKeyShort,
  isTodayKey: isTodayKey,
  formatEntryTimeCard: formatEntryTimeCard,
  _dateKeyFromDate: _dateKeyFromDate,
});
