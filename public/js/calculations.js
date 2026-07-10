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

// Carryover-Pool (Regel 7, Issue #378) für die reiter-Liste.
//
// NEUES POOL-MODELL (Ersetzt Phase 0 / Phase 0.5 / Phase 2 / Netting-Coverage):
//   pool_E = Σ used_E   für alle Tabs mit done === false
//   pool_D = Σ used_D   für alle Tabs mit done === false
//
// Physische Begründung: Material, das im Tank liegt (used), ist verfügbar.
// Material von fertig-bestätigten Tabs (done=true, Issue #377) ist bereits in
// der Erde — raus aus dem Pool. Das alte Modell (Σ max(0, basis−used) =
// unfilled-Lücke) war ein theoretisches Konstrukt und wird komplett ersetzt.
//
// Vor #378 (PR #379 + #377 / done-Flag): Diese Funktion gab die unkompensierten
// Phase-0-Savings/Excess-Totale zurück. Mit #378 ist sie obsolet — wird aber
// für Backward-Compat und Anzeige-Pfade weiterhin exportiert (mit `legacy`-
// Feldern). Sie wird nicht mehr von computeAllCarryovers() konsumiert.
function _computeNetCarryoverPools(reiter) {
  var poolE = 0, poolD = 0;
  var totalUsedE = 0, totalUsedD = 0;
  var legacySavedE = 0, legacyExcessE = 0;
  var legacySavedD = 0, legacyExcessD = 0;

  for (let i = 0; i < reiter.length; i++) {
    var t = reiter[i];
    var usedE = getTabUsedEinheiten(t);
    var usedD = getTabUsedDuenger(t);
    totalUsedE += usedE;
    totalUsedD += usedD;
    if (!t || !t.done) {
      poolE += usedE;
      poolD += usedD;
    }
    // Legacy-Felder (für Anzeige / Kompatibilität)
    var istE = getTabIstEinheiten(t);
    var solE = getTabTotalEinheiten(t);
    var istD = getTabIstDuenger(t);
    var solD = getTabTotalDuenger(t);
    if (istE > 0) {
      if (solE > istE) legacySavedE += (solE - istE);
      else if (istE > solE) legacyExcessE += (istE - solE);
    }
    if (istD > 0) {
      if (solD > istD) legacySavedD += (solD - istD);
      else if (istD > solD) legacyExcessD += (istD - solD);
    }
  }

  return {
    poolE: poolE, poolD: poolD,
    totalUsedE: totalUsedE, totalUsedD: totalUsedD,
    legacySavedE: legacySavedE, legacyExcessE: legacyExcessE,
    legacySavedD: legacySavedD, legacyExcessD: legacyExcessD,
  };
}

// Berechnet Carryover für alle Tabs — REGEL 7 POOL-MODELL (Issue #378).
//
// Ersetzt komplett die vorherige Phase-0/0.5/1/2-Architektur. Physisches
// Modell: ein gemeinsamer Tank (Pool) pro Material (Saat + Dünger getrennt,
// Regel 4). Mehrbedarf-Lücken wandern rueckwaerts durch die nicht-fertigen
// Tabs (Regel 7.2). Ein Tab kann nicht gleichzeitig Spender und Empfaenger
// sein (Befund 1 / I6: Selbstgutschrift ausgeschlossen).
//
// Return pro Tab: { savedEinheit, savedDuenger, excessEinheit, excessDuenger,
//                   nettedEinheit, nettedDuenger }
//   - nettedEinheit/nettedDuenger: wie viel vom Mehrbedarf dieses Tabs wurde
//     durch Cross-Tab-Pool gedeckt (immer = exc, wenn er selbst Mehrbedarf hat;
//     sonst 0).
//   - excessEinheit/excessDuenger: entzogen_i (Menge, die ANDERE Tabs von
//     diesem Tab abgezogen haben). Bei Mehrbedarf-Tabs typischerweise 0
//     (sie ziehen selbst, werden aber nicht weiter bespendet).
//   - savedEinheit/savedDuenger: 0 (Regel 7 kennt kein SAV-Symbol — die
//     `sol - used` Ersparnis eines Tabs ist konzeptuell Teil des globalen
//     Pools und wird im `getTabRemaining` ueber `remaining = max(0, soll -
//     used + entzogen)` abgebildet. Bleibt fuer Backward-Compat mit
//     Render-Sites erhalten).
//
// Cached in _internal.carryoverCache; invalidateCarryoverCache() bei Änderung.
function computeAllCarryovers() {
  if (_internal.carryoverCache !== null) return _internal.carryoverCache;

  var reiter = AppGlobals.state.reiter;
  var n = reiter.length;

  var result = [];
  for (let i = 0; i < n; i++) {
    result.push({ savedEinheit: 0, savedDuenger: 0, excessEinheit: 0, excessDuenger: 0, nettedEinheit: 0, nettedDuenger: 0 });
  }

  // --- Hilfsfunktionen ---
  var lastEntryTime = function(i) {
    var tab = reiter[i];
    if (!tab || !tab.entries || tab.entries.length === 0) return 0;
    var last = tab.entries[tab.entries.length - 1];
    return parseEntryTime(last ? (last.time || 0) : 0);
  };
  // Bearbeitungs-Reihenfolge: lastEntry.time aufsteigend, Tiebreaker Tab-Index
  var byTimeAsc = function(a, b) {
    var ta = lastEntryTime(a), tb = lastEntryTime(b);
    if (ta !== tb) return ta - tb;
    return a - b;
  };

  // PRO MATERIAL (Saat, Dünger) getrennt.
  for (var mat = 0; mat < 2; mat++) {
    var isSaat = (mat === 0);
    var getUsed = isSaat ? getTabUsedEinheiten : getTabUsedDuenger;
    var getIst  = isSaat ? getTabIstEinheiten    : getTabIstDuenger;
    var getSol  = isSaat ? getTabTotalEinheiten  : getTabTotalDuenger;
    var usedField  = isSaat ? 'nettedEinheit' : 'nettedDuenger';
    var excField   = isSaat ? 'excessEinheit' : 'excessDuenger';

    // 1. Pool berechnen (Regel 7.1): Σ used_i für alle Tabs mit done===false.
    //    `used` ist hier die im Tank liegende Menge — Fertige (done=true) ist
    //    raus, ihr Material ist in der Erde.
    var pool = 0;
    for (let i = 0; i < n; i++) {
      if (!reiter[i] || reiter[i].done) continue;
      pool += getUsed(reiter[i]);
    }

    // 2. Mehrbedarf-Tabs sammeln (ist > sol && ist > 0), in Bearbeitungs-
    //    Reihenfolge sortiert (FRÜHESTE zuerst).
    var mehrbedarfTabs = [];
    for (let i = 0; i < n; i++) {
      var r = reiter[i];
      if (!r) continue;
      var ist = getIst(r);
      var sol = getSol(r);
      if (ist > 0 && ist > sol) {
        mehrbedarfTabs.push({ idx: i, exc: ist - sol });
      }
    }
    mehrbedarfTabs.sort(byTimeAsc);

    // 3. Verteilung: Mehrbedarf-Lücke wandert RÜCKWÄRTS durch nicht-fertige
    //    Tabs (Regel 7.2). KONKRET:
    //    - Pro Mehrbedarf-Tab: ziehe `exc` aus dem Pool.
    //      Der Pool wird gespeist durch die `used`-Werte der nicht-fertigen
    //      Tabs in INVERSER Bearbeitungs-Reihenfolge (letzter bearbeiteter
    //      Tab zuerst). Jeder Spender kann max(used) abgeben (Regel 7.3).
    //    - Ein Mehrbedarf-Tab kann nicht Spender sein (auch wenn er used > 0
    //      hat: sein used ist bereits "verbraucht" für die Lücke). Befund 1.
    //    - Die `excess*`-Felder pro Tab akkumulieren, wie viel ANDERE Tabs
    //      diesem Tab entzogen haben (für isTabDone/getTabRemaining).
    var remPool = pool;

    // Aufnahmekapazität-Reihenfolge: INVERS Bearbeitungs-Reihenfolge,
    // Mehrbedarf-Tabs raus, done-Tabs raus. stable sort.
    var spenderOrder = [];
    for (let i = 0; i < n; i++) {
      var r = reiter[i];
      if (!r) continue;
      if (r.done) continue;
      var ist = getIst(r);
      var sol = getSol(r);
      var isMehrbedarf = (ist > 0 && ist > sol);
      if (isMehrbedarf) continue;
      spenderOrder.push(i);
    }
    spenderOrder.sort(function(a, b) {
      var ta = lastEntryTime(a), tb = lastEntryTime(b);
      if (ta !== tb) return tb - ta; // INVERS: descending
      return a - b;
    });

    var remMbh = function() {
      var sum = 0;
      for (var k = 0; k < mehrbedarfTabs.length; k++) sum += mehrbedarfTabs[k].exc;
      return sum;
    };

    // Greedy: jeder Mehrbedarf-Tab zieht sequenziell seine Lücke aus dem
    // Pool. Spender werden in inverser Reihenfolge befragt, jeder gibt
    // maximal seinen used-Wert. Pool wird kleiner; ist Pool leer, ist die
    // Lücke "echter Fehlbetrag" (Regel 7.5).
    for (var k = 0; k < mehrbedarfTabs.length; k++) {
      var mt = mehrbedarfTabs[k];
      var need = mt.exc;
      var taken = 0;
      for (var s = 0; s < spenderOrder.length && need > 0.05; s++) {
        var sIdx = spenderOrder[s];
        var available = getUsed(reiter[sIdx]) - result[sIdx][excField];
        if (available <= 0.05) continue;
        var give = Math.min(need, available);
        result[sIdx][excField] += give;
        need -= give;
        taken += give;
      }
      // Volle Deckung: netted = exc (Regel 6: Mehrbedarf-Tab zeigt 0).
      // Bei Knappheit: netted = taken (< exc, Rest = echter Fehlbetrag).
      result[mt.idx][usedField] = taken;
      // Wichtig: Mehrbedarf-Tab konsumiert NICHT aus dem Pool der "verbraucht"
      // Tabs — sein Material liegt bereits im Boden (ist eingefüllt). Die
      // Lücke `exc` ist NICHT-VORHANDENES Material, das die Maschine aus
      // dem Tank der Folgetabs zieht. Daher: das, was wir als `taken`
      // buchen, geht zu LASTEN der Spender (excessErhöhung), nicht als
      // "extra" Verbrauch beim Mehrbedarf-Tab.
      //
      // Korrektur-Buchung: Wir hatten oben `pool = Σ used (nicht-Mehrbedarf)`
      // — der Pool verringert sich NICHT durch Mehrbedarf-Ziehung selbst,
      // sondern NUR durch Spenden-Beiträge. Daher ist `taken` = Summe der
      // Spender-Beiträge (excessField-Increment). konsistent.
      void remPool; // Pool als Konzept (Σ used doned=false Tabs) bleibt konstant; Buchung erfolgt via excessField
      void remMbh;   // Hilfs-API (siehe oben) — nicht im Hot-Path benötigt
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
  return { savedEinheit: 0, savedDuenger: 0, excessEinheit: 0, excessDuenger: 0, nettedEinheit: 0, nettedDuenger: 0 };
}

// Liefert pro Tab die auf Carryover genetteten Restbedarfe (Saatgut + Dünger)
// sowie Basis + Used, damit Render-Sites die Anzeige konsistent speisen.
//
// REGEL 7 (Issue #378) — NEUE FORMEL:
//   remaining_i = max(0, soll_i − used_i + entzogen_i − netted_i)
// `entzogen_i` = Menge, die ANDERE Tabs (Mehrbedarf-Lücken, rückwärts
//   verteilt) DIESEM Tab abgezogen haben (Spender-Tabs, excess*).
// `netted_i`   = Menge, mit der der Mehrbedarf DIESES Tabs bereits durch
//   den Cross-Tab-Pool gedeckt wurde (Empfänger-Tabs, netted*).
//
// WICHTIG (Doppelzählungs-Fix): entzogen und netted sind zwei Seiten derselben
// Buchung (Σ entzogen === Σ netted === gedeckter Mehrbedarf). Beide müssen in
// die Formel eingehen, sonst wird der gedeckte Mehrbedarf zweimal gezählt —
// einmal in der offenen Lücke des Empfänger-Tabs (remaining nicht um netted
// reduziert) UND einmal im aufgeblähten remaining des Spender-Tabs (+entzogen).
// Mit beiden Termen gilt Materialerhaltung:
//   Σ remaining_i = Σ basis_i − Σ used_i   (da Σ netted − Σ entzogen = 0).
//
// Null-safe (fehlende Felder = 0). IST-Flaeche hat Vorrang vor SOLL.
function getTabRemaining(r, tabIdx) {
  var istE = getTabIstEinheiten(r);
  var istD = getTabIstDuenger(r);
  var solE = istE > 0 ? istE : getTabTotalEinheiten(r);
  var solD = istD > 0 ? istD : getTabTotalDuenger(r);
  var usedE  = getTabUsedEinheiten(r);
  var usedD  = getTabUsedDuenger(r);
  var co     = getCarryover(tabIdx);
  // Regel 7: entzogen = was ANDERE Tabs (nicht dieser) von ihm genommen haben
  var entzogenE = co.excessEinheit;
  var entzogenD = co.excessDuenger;
  // netted = Anteil des eigenen Mehrbedarfs, der bereits durch den Pool
  // gedeckt ist (muss abgezogen werden, sonst Doppelzählung mit entzogen).
  var nettedE = co.nettedEinheit;
  var nettedD = co.nettedDuenger;
  return {
    basisE:     solE,
    basisD:     solD,
    usedE:      usedE,
    usedD:      usedD,
    remainingE: Math.max(0, solE - usedE + entzogenE - nettedE),
    remainingD: Math.max(0, solD - usedD + entzogenD - nettedD)
  };
}

// --- Tab-Fertig-Check (pure) ---

// Prueft ob ein Tab "fertig" ist.
//
// REGEL 7 (Issue #378): Fertig = remaining = 0 ODER done=true.
// Carryover wird nur beruecksichtigt, wenn tabIndex mitgegeben wird
// (Backward-Compat). Nil-safe (fehlende Felder = 0).
//
// Formel (konsistent mit getTabRemaining):
//   remaining = max(0, soll − used + entzogen − netted)
// netted wird abgezogen, damit ein Mehrbedarf-Tab, dessen Lücke voll durch
// den Pool gedeckt ist und dessen Plan-Bedarf erfüllt ist, als fertig gilt.
function isTabDone(r, tabIndex) {
  if (!r || !r.entries) return true; // Keine Entries = fertig (kein Bedarf)
  if (r.done) return true; // Manuell abgeschlossen (Issue #377)
  // Carryover nur beruecksichtigen wenn tabIndex mitgegeben
  var carryover = (tabIndex !== undefined)
    ? getCarryover(tabIndex)
    : { savedEinheit: 0, savedDuenger: 0, excessEinheit: 0, excessDuenger: 0, nettedEinheit: 0, nettedDuenger: 0 };
  // IST > 0 ? IST : SOLL
  var istE = getTabIstEinheiten(r);
  var totalE = istE > 0 ? istE : getTabTotalEinheiten(r);
  var usedE = getTabUsedEinheiten(r);
  // remaining = soll - used + entzogen - netted (Regel 7, Doppelzählungs-Fix)
  var remainingE = Math.max(0, totalE - usedE + carryover.excessEinheit - carryover.nettedEinheit);
  if (remainingE > 0.05) return false;

  var istD = getTabIstDuenger(r);
  var totalD = istD > 0 ? istD : getTabTotalDuenger(r);
  var usedD = getTabUsedDuenger(r);
  var remainingD = Math.max(0, totalD - usedD + carryover.excessDuenger - carryover.nettedDuenger);
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
