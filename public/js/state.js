// ============================================================================
// STATE MANAGEMENT — Zentrales state-Objekt und Persistenz
//
// state: Single Source of Truth für die gesamte App.
// Wird nach jeder Änderung via saveState() in localStorage geschrieben.
//
// Struktur:
//   reiter[]       — Array von Feld-Tabs (jeder Tab = ein Feld)
//   activeReiter   — Index des aktuell ausgewählten Tabs
//   activeView     — 'protokoll' = Drill-Protokoll-Ansicht, sonst null
//   dashboardOpen  — true, wenn die Übersicht (Dashboard) zuletzt offen war;
//                    wird beim Neuladen der Seite genutzt, um wieder dorthin
//                    zurückzukehren (Issue: Reload während offenem Dashboard
//                    landete sonst "verloren" auf der vorherigen Ansicht).
//   fahrgassen*    — Fahrgassen-Korrektur
//   einheitGroesse* — Anpassung der Körner-pro-Einheit
//   machineLog[]   — Globales Maschinen-Protokoll
// ============================================================================

var state = {
  reiter: [{
    name:       'Schlag 1',
    hektar:     0,
    istHektar:  0,
    koerner:    0,
    duenger:    0,
    entries:    [],
    done:       false
  }],
  activeReiter:   0,
  activeView:     null,
  dashboardOpen:  false,
  fahrgassenEnabled: false,
  fahrgassenBreite:   0,
  einheitGroesseEnabled: false,
  koernerProEinheit:  50000,
  machineLog:    [],
  drillPriorities: {}
};

// --- Persistenz ---

// --- localStorage-Key-Migration (Issue #235) ---
// Frühere localStorage-Keys hießen `mais_rechner*`. Repo und Domain heißen
// `agrar-rechner`, daher wurden alle Keys auf `agrar_rechner*` umgestellt.
// Beim ersten Start lesen wir die alten Keys, schreiben den Wert in den
// neuen Key (falls dort noch nichts liegt) und löschen den alten Key.
// Migration läuft synchron, bevor loadState()/saveState() aufgerufen werden.
var LEGACY_KEY_MAP = {
  'mais_rechner':              'agrar_rechner',
  'mais_rechner_theme':        'theme', // bereits in Migration 3→4 erledigt — hier nur Defensiv-Remap
};

function migrateLegacyStorageKeys() {
  try {
    for (var oldKey in LEGACY_KEY_MAP) {
      if (!Object.prototype.hasOwnProperty.call(LEGACY_KEY_MAP, oldKey)) continue;
      var newKey = LEGACY_KEY_MAP[oldKey];
      var oldVal;
      try { oldVal = localStorage.getItem(oldKey); } catch(e) { continue; }
      if (oldVal === null) continue;
      try {
        if (localStorage.getItem(newKey) === null) {
          localStorage.setItem(newKey, oldVal);
        }
      } catch(e) { /* write-fehler → nicht kritisch */ }
      try { localStorage.removeItem(oldKey); } catch(e) { /* egal */ }
    }
  } catch(e) {
    // localStorage komplett nicht verfügbar — silently skip
  }
}

// Migration frühestmöglich ausführen — vor dem ersten saveState()/loadState().
migrateLegacyStorageKeys();

function saveState() {
  AppGlobals.invalidateCarryoverCache();
  try {
    localStorage.setItem('agrar_rechner', JSON.stringify(state));
  } catch(e) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_FILE_CANT_CREATE') {
      showSaveError();
    }
    console.error('saveState failed:', e);
  }
}

function showSaveError() {
  var el = document.getElementById('save_error_banner');
  if (el) el.style.display = 'flex';
}

function dismissSaveError() {
  var el = document.getElementById('save_error_banner');
  if (el) el.style.display = 'none';
}

// --- Schema-Validierung (Issue #237) ---
// Verteidigt loadState() gegen manipulierten localStorage-Inhalt (XSS auf
// gleicher Domain, andere App mit gleichem Origin, Man-in-the-Middle bei
// unsicherer Konfiguration). Stillschweigendes Verwerfen: ungültige Felder
// werden auf sinnvolle Defaults zurückgesetzt, sodass die App lauffähig
// bleibt statt zu crashen.
//
// Erlaubte Keys (Whitelist) — alles andere wird im Reviver verworfen.
// Hinzufügen neuer Felder erfordert eine bewusste Entscheidung.
var ALLOWED_TOP_KEYS = [
  'reiter', 'activeReiter', 'activeView', 'dashboardOpen',
  'fahrgassenEnabled', 'fahrgassenBreite',
  'einheitGroesseEnabled', 'koernerProEinheit',
  'machineLog', 'drillPriorities',
  '_lv',
  // Legacy-Keys (nur für Migration 0→1 lesend toleriert)
  'hektar', 'istHektar', 'koerner', 'duenger', 'entries',
  'name'
];
var ALLOWED_TAB_KEYS = [
  'name', 'hektar', 'istHektar', 'koerner', 'duenger',
  'entries', 'fahrgassenEnabled', 'fahrgassenBreite',
  'done'
];

function isPlainObject(v) {
  // Schließt null, Arrays, Klassen-Instanzen und speziell
  // Objekte mit abweichendem Prototypen aus. Damit ist der einzige
  // Weg, einen Plain Object zu erzeugen, die Literalschreibweise —
  // also auch kein `Object.create(null)` mit Magic-Proto-Keys.
  if (v === null || typeof v !== 'object') return false;
  if (Array.isArray(v)) return false;
  var proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function sanitizeNumber(v, fallback) {
  // Akzeptiert echte Number und number-konvertierbare Strings,
  // verwirft NaN/Infinity/Objekte. Null/Undefined → fallback.
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'number') return isFinite(v) ? v : fallback;
  if (typeof v === 'string' && v.trim() !== '') {
    var n = Number(v);
    return isFinite(n) ? n : fallback;
  }
  return fallback;
}

function sanitizeString(v, fallback, maxLen) {
  if (typeof v !== 'string') return fallback;
  if (maxLen && v.length > maxLen) v = v.slice(0, maxLen);
  return v;
}

function sanitizeBoolean(v, fallback) {
  if (typeof v === 'boolean') return v;
  return fallback;
}

function sanitizeEntry(raw) {
  // Eintrag: Plain Object, nur erlaubte Keys, jede Property typgeprüft.
  // Unbekannte Keys und falsche Typen → Default. Verwirft auch
  // `__proto__`/`constructor`/`prototype` über den Reviver.
  if (!isPlainObject(raw)) return null;
  var out = {};
  out.time        = sanitizeNumber(raw.time, 0);
  out.einheit     = sanitizeNumber(raw.einheit, 0);
  out.duenger     = sanitizeNumber(raw.duenger, 0);
  out.hektar      = sanitizeNumber(raw.hektar, 0);
  out.istHektar   = sanitizeNumber(raw.istHektar, 0);
  out.koerner     = sanitizeNumber(raw.koerner, 0);
  out.duengerRate = sanitizeNumber(raw.duengerRate, 0);
  if (raw.mlIdx !== undefined) {
    var ml = sanitizeNumber(raw.mlIdx, -1);
    out.mlIdx = ml >= 0 ? Math.floor(ml) : -1;
  }
  return out;
}

function sanitizeMachineLogEntry(raw) {
  if (!isPlainObject(raw)) return null;
  var out = {};
  out.time        = sanitizeNumber(raw.time, 0);
  out.einheit     = sanitizeNumber(raw.einheit, 0);
  out.duenger     = sanitizeNumber(raw.duenger, 0);
  out.hektar      = sanitizeNumber(raw.hektar, 0);
  out.istHektar   = sanitizeNumber(raw.istHektar, 0);
  out.koerner     = sanitizeNumber(raw.koerner, 0);
  out.duengerRate = sanitizeNumber(raw.duengerRate, 0);
  return out;
}

function sanitizeTab(raw) {
  if (!isPlainObject(raw)) {
    return { name: 'Schlag', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false };
  }
  var tab = {
    name:      sanitizeString(raw.name, 'Schlag', 64),
    hektar:    sanitizeNumber(raw.hektar, 0),
    istHektar: sanitizeNumber(raw.istHektar, 0),
    koerner:   sanitizeNumber(raw.koerner, 0),
    duenger:   sanitizeNumber(raw.duenger, 0),
    entries:   [],
    // Issue #377: manuelles "Feld fertig"-Flag pro Tab.
    // `used >= SOLL` ist nur ein Hinweis (render-drill.js "✓ fertig");
    // der Landwirt markiert hier explizit, dass das Feld tatsächlich
    // fertiggefahren wurde und `used` damit nicht mehr im Tank liegt.
    done:      sanitizeBoolean(raw.done, false)
  };
  // done-Flag (Issue #377/#378): manuell markierter Fertig-Status pro Tab.
  // Migration _lv 4→5 belegt fehlendes done mit false (idempotent über sanitizeTab).
  if (raw.done !== undefined) {
    tab.done = sanitizeBoolean(raw.done, false);
  } else {
    tab.done = false;
  }
  // Per-Tab-Overrides (optional, mit globalen Defaults)
  if (raw.fahrgassenEnabled !== undefined) {
    tab.fahrgassenEnabled = sanitizeBoolean(raw.fahrgassenEnabled, false);
  }
  if (raw.fahrgassenBreite !== undefined) {
    tab.fahrgassenBreite = sanitizeNumber(raw.fahrgassenBreite, 0);
  }
  if (Array.isArray(raw.entries)) {
    for (var i = 0; i < raw.entries.length; i++) {
      var e = sanitizeEntry(raw.entries[i]);
      if (e !== null) tab.entries.push(e);
    }
  }
  return tab;
}

function jsonReviver(key, value) {
  // Defense-in-Depth gegen Prototype Pollution: blockiere die drei
  // gefährlichen Keys auf jeder Verschachtelungsebene. JSON.parse
  // ignoriert __proto__ zwar weitgehend, aber konsistentes Whitelisting
  // ist robust und dokumentiert die erlaubte Form.
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
    return undefined; // Schlüssel wird aus dem Result entfernt
  }
  return value;
}

function parsePersistedState(raw) {
  // Wrapper: nutzt jsonReviver, um gefährliche Keys auf jeder Ebene
  // abzufangen, BEVOR die nachfolgende Sanitisierung läuft.
  return JSON.parse(raw, jsonReviver);
}

function parseAndSanitizeState(raw) {
  // Wandelt einen JSON-String in einen validierten Zustand.
  // Führt dieselbe Parse-/Migrations-/Sanitisierungs-Pipeline aus wie
  // loadState(), jedoch ohne lokale Storage-Nebenwirkungen und ohne
  // den globalen `state` zu mutieren.
  //
  // Gibt { state: <sanitizedObj>, originalLv: <number> } bei Erfolg
  // zurück, oder null wenn der String kein gültiger Zustand ist.
  //
  // Verwendung: Cross-Tab-Sync (storage-Event) — ein anderer Tab darf
  // die Schema-/Typ-Wache der loadState-Pipeline nicht umgehen, indem
  // er einen manipulierten JSON-String direkt in localStorage schreibt.
  try {
    var data = parsePersistedState(raw);
    if (!isPlainObject(data)) return null;
    var originalLv = data._lv || 0;
    var lv = originalLv;
    // Migration 0→1: Einzelne Felder → Tab-Array
    if (!data.reiter && (data.hektar !== undefined || data.koerner !== undefined)) {
      data = { reiter: [{ name: 'Schlag 1', hektar: data.hektar || 0, istHektar: data.istHektar || 0, koerner: data.koerner || 0, duenger: data.duenger || 0, entries: data.entries || [], done: false }], activeReiter: 0, activeView: null, fahrgassenEnabled: false, fahrgassenBreite: 0, einheitGroesseEnabled: false, koernerProEinheit: 50000, machineLog: data.machineLog || [], drillPriorities: {}, _lv: 1 };
      lv = 1;
    }
    // Migration 1→2: Globale entries → per-Tab entries
    if (lv < 2 && data.entries && Array.isArray(data.entries)) {
      // Bestehende tab-entries nicht überschreiben (Issue #266 / Migration-Korrektur)
      if (data.reiter && data.reiter[0] && (!data.reiter[0].entries || data.reiter[0].entries.length === 0)) {
        data.reiter[0].entries = data.entries;
      }
      delete data.entries;
      lv = 2;
    }
    // Migration 2→3: Fehlende Felder
    if (lv < 3) {
      if (!data.drillPriorities) data.drillPriorities = {};
      if (!data.machineLog) data.machineLog = [];
      lv = 3;
    }
    // Migration 3→4: neue Defaults (in-memory only — die Theme-Key-
    //   Migration in localStorage wird im loadState-Pfad zusätzlich
    //   ausgeführt, weil sie Storage-Nebenwirkungen hat).
    if (lv < 4) {
      if (data.koernerProEinheit === undefined) data.koernerProEinheit = 50000;
      if (data.einheitGroesseEnabled === undefined) data.einheitGroesseEnabled = false;
      if (!data.drillPriorities) data.drillPriorities = {};
    }
    // Migration 4→5 (Issue #377): manuelles "Feld fertig"-Flag pro Tab.
    // sanitizeTab() vergibt `done: false` als Default, daher sind keine
    // Daten-Änderungen am reiter-Array nötig — die Persistenz-Schwelle
    // wird weiter unten auf `_lv = 5` gehoben.
    if (lv < 5) lv = 5;
    // Validate und übernehmen — Schema-strict ab _lv=4
    if (!Array.isArray(data.reiter) || data.reiter.length === 0) return null;
    var sanitizedReiter = [];
    for (var i = 0; i < data.reiter.length; i++) {
      sanitizedReiter.push(sanitizeTab(data.reiter[i]));
    }
    // Globale Felder typgeprüft + Defaults
    var activeReiterRaw = sanitizeNumber(data.activeReiter, 0);
    data.activeReiter = activeReiterRaw >= 0 && activeReiterRaw < sanitizedReiter.length
      ? Math.floor(activeReiterRaw)
      : 0;
    data.activeView = (data.activeView === 'protokoll') ? 'protokoll' : null;
    data.dashboardOpen = sanitizeBoolean(data.dashboardOpen, false);
    if (data.fahrgassenEnabled === undefined) data.fahrgassenEnabled = false;
    if (data.fahrgassenBreite === undefined) data.fahrgassenBreite = 0;
    data.fahrgassenEnabled = sanitizeBoolean(data.fahrgassenEnabled, false);
    data.fahrgassenBreite = sanitizeNumber(data.fahrgassenBreite, 0);
    if (data.einheitGroesseEnabled === undefined) data.einheitGroesseEnabled = false;
    data.einheitGroesseEnabled = sanitizeBoolean(data.einheitGroesseEnabled, false);
    if (data.koernerProEinheit === undefined) data.koernerProEinheit = 50000;
    data.koernerProEinheit = sanitizeNumber(data.koernerProEinheit, 50000);
    // machineLog sanitizen
    var machineLog = [];
    if (Array.isArray(data.machineLog)) {
      for (var mi = 0; mi < data.machineLog.length; mi++) {
        var me = sanitizeMachineLogEntry(data.machineLog[mi]);
        if (me !== null) machineLog.push(me);
      }
    }
    data.machineLog = machineLog;
    // drillPriorities muss Plain Object sein
    if (!isPlainObject(data.drillPriorities)) data.drillPriorities = {};
    // Final: sanitisiertes reiter einsetzen
    data.reiter = sanitizedReiter;
    // Unbekannte Top-Level-Keys strippen (Whitelist)
    var cleaned = {};
    for (var ki = 0; ki < ALLOWED_TOP_KEYS.length; ki++) {
        var k = ALLOWED_TOP_KEYS[ki];
        if (data[k] !== undefined) cleaned[k] = data[k];
    }
    cleaned._lv = 5;
    return { state: cleaned, originalLv: originalLv };
  } catch(e) {
    return null;
  }
}

function loadState() {
  try {
    var saved = localStorage.getItem('agrar_rechner');
    if (!saved) return false;
    var result = parseAndSanitizeState(saved);
    if (!result) return false;
    var originalLv = result.originalLv;
    state = result.state;
    // Migration 3→4 localStorage side effect: Theme-Key vereinheitlichen.
    // (migrateLegacyStorageKeys() hat das meist schon erledigt — hier nur
    //  Defensiv-Fallback für direkt migrierte Snapshots.)
    if (originalLv < 4) {
      try {
        var oldTheme = localStorage.getItem('mais_rechner_theme');
        if (oldTheme && !localStorage.getItem('theme')) {
          localStorage.setItem('theme', oldTheme);
        }
        if (oldTheme) localStorage.removeItem('mais_rechner_theme');
      } catch(e) {}
    }
    // Migration-Persistenz: Wenn die Daten nicht bereits _lv=5 waren,
    // schreibe den migrierten Snapshot einmalig zurück, damit nachfolgende
    // Page-Loads die Migration überspringen können.
    if (originalLv < 5) {
      try {
        localStorage.setItem('agrar_rechner', JSON.stringify(state));
      } catch(e) {
        // Nicht kritisch — Migration war erfolgreich im Memory, beim
        // nächsten Load wird sie einfach erneut durchgeführt (idempotent).
        console.warn('loadState: migrated snapshot could not be persisted:', e);
      }
    }
    return true;
  } catch(e) {
    console.error('loadState failed:', e);
    return false;
  }
}

// Register exposed globals on AppGlobals (ADR-001 Schritt 3, Issue #278).
// `state` ist absichtlich NICHT hier registriert — AppGlobals.state ist
// bereits in app-globals.js als Live-Alias für die `var state` definiert
// (Getter/Setter). Ein hier eingefügter `state: state` würde den Getter
// mit einem Plain-Property überschreiben und Reassignments (loadState,
// Cross-Tab-Sync) brechen.
Object.assign(window.AppGlobals, {
  LEGACY_KEY_MAP: LEGACY_KEY_MAP,
  ALLOWED_TOP_KEYS: ALLOWED_TOP_KEYS,
  ALLOWED_TAB_KEYS: ALLOWED_TAB_KEYS,
  migrateLegacyStorageKeys: migrateLegacyStorageKeys,
  saveState: saveState,
  showSaveError: showSaveError,
  dismissSaveError: dismissSaveError,
  isPlainObject: isPlainObject,
  sanitizeNumber: sanitizeNumber,
  sanitizeString: sanitizeString,
  sanitizeBoolean: sanitizeBoolean,
  sanitizeEntry: sanitizeEntry,
  sanitizeMachineLogEntry: sanitizeMachineLogEntry,
  sanitizeTab: sanitizeTab,
  jsonReviver: jsonReviver,
  parsePersistedState: parsePersistedState,
  parseAndSanitizeState: parseAndSanitizeState,
  loadState: loadState,
});
