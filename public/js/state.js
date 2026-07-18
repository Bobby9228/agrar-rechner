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
  fahrgassenEnabled: false,
  fahrgassenBreite:   0,
  einheitGroesseEnabled: false,
  koernerProEinheit:  50000,
  machineLog:    [],
  drillPriorities: {},
  iosInstallHintShown: false
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
  'mais_rechner_ios_install_seen': 'agrar_rechner_ios_install_seen',
  'mais_rechner_version_seen': 'agrar_rechner_version_seen'
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
  'reiter', 'activeReiter', 'activeView',
  'fahrgassenEnabled', 'fahrgassenBreite',
  'einheitGroesseEnabled', 'koernerProEinheit',
  'machineLog', 'drillPriorities', 'iosInstallHintShown',
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

function loadState() {
  try {
    var saved = localStorage.getItem('agrar_rechner');
    if (!saved) return false;
    var data = parsePersistedState(saved);
    if (!isPlainObject(data)) return false;
    var originalLv = data._lv || 0;
    var lv = originalLv;
    // Migration 0→1: Einzelne Felder → Tab-Array
    if (!data.reiter && (data.hektar !== undefined || data.koerner !== undefined)) {
      data = { reiter: [{ name: 'Schlag 1', hektar: data.hektar || 0, istHektar: data.istHektar || 0, koerner: data.koerner || 0, duenger: data.duenger || 0, entries: data.entries || [], done: false }], activeReiter: 0, activeView: null, fahrgassenEnabled: false, fahrgassenBreite: 0, einheitGroesseEnabled: false, koernerProEinheit: 50000, machineLog: data.machineLog || [], drillPriorities: {}, iosInstallHintShown: false, _lv: 1 };
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
      if (!data.iosInstallHintShown) data.iosInstallHintShown = false;
      if (!data.machineLog) data.machineLog = [];
      lv = 3;
    }
    // Migration 3→4: Theme-Key vereinheitlichen, neue Defaults
    if (lv < 4) {
      // Theme: alten Key 'mais_rechner_theme' → neuen Key 'theme'
      // (durch migrateLegacyStorageKeys() oben meist schon erledigt —
      //  hier nur Defensiv-Fallback für direkt migrierte Snapshots)
      try {
        var oldTheme = localStorage.getItem('mais_rechner_theme');
        if (oldTheme && !localStorage.getItem('theme')) {
          localStorage.setItem('theme', oldTheme);
        }
        if (oldTheme) localStorage.removeItem('mais_rechner_theme');
      } catch(e) {}
      // koernerProEinheit Default (falls noch aus alter Migration fehlend)
      if (data.koernerProEinheit === undefined) data.koernerProEinheit = 50000;
      // einheitGroesseEnabled Default
      if (data.einheitGroesseEnabled === undefined) data.einheitGroesseEnabled = false;
      // drillPriorities Default
      if (!data.drillPriorities) data.drillPriorities = {};
    }
    // Migration 4→5 (Issue #377): manuelles "Feld fertig"-Flag pro Tab.
    // sanitizeTab() vergibt `done: false` als Default, daher sind keine
    // Daten-Änderungen am reiter-Array nötig — die Persistenz-Schwelle
    // wird weiter unten auf `_lv = 5` gehoben.
    if (lv < 5) lv = 5;
    // Validate und übernehmen — Schema-strict ab _lv=4
    if (!Array.isArray(data.reiter) || data.reiter.length === 0) return false;
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
    // iosInstallHintShown
    if (data.iosInstallHintShown === undefined) data.iosInstallHintShown = false;
    data.iosInstallHintShown = sanitizeBoolean(data.iosInstallHintShown, false);
    // Final: sanitisiertes reiter einsetzen
    data.reiter = sanitizedReiter;
    // Unbekannte Top-Level-Keys strippen (Whitelist)
    var cleaned = {};
    for (var ki = 0; ki < ALLOWED_TOP_KEYS.length; ki++) {
        var k = ALLOWED_TOP_KEYS[ki];
        if (data[k] !== undefined) cleaned[k] = data[k];
    }
    cleaned._lv = 5;
    data = cleaned;
    state = data;
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

// --- iOS Safari Detection (portiert aus Inline-Code Z. 1490-1492) ---
// Wird einmalig beim Modul-Load ausgewertet; Tests können isIOS/isStandalone
// per window.isIOS = true überschreiben.
var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
var isStandalone = window.navigator.standalone === true;

// --- iOS Install Hint (portiert aus Inline-Code Z. 1494-1507) ---
// Zeigt einmalig einen Hinweis zum Installieren der PWA auf iOS Safari.
// Nur auf iOS/Safari, nur wenn noch nicht installiert und noch nicht dismissed.
function maybeShowIosInstallHint() {
  var hintSeen = null;
  try { hintSeen = localStorage.getItem('agrar_rechner_ios_install_seen'); } catch(e) {}
  if (!isIOS || isStandalone || hintSeen) return;
  var banner = document.getElementById('ios_install_banner');
  if (banner) banner.classList.add('show');
}
function dismissIosInstallHint() {
  try { localStorage.setItem('agrar_rechner_ios_install_seen', '1'); } catch(e) {}
  var banner = document.getElementById('ios_install_banner');
  if (banner) banner.classList.remove('show');
}

// --- "What's New" Update Banner (portiert aus Inline-Code Z. 1509-1531) ---
// Zeigt einmalig einen Hinweis nach App-Updates (neue SW-Version).
// currentVersion muss bei jedem Release manuell aktualisiert werden.
// (APP_VERSION + APP_BUILD_DATE sind in main.js definiert.)
var UPDATE_CHANGELOG = 'Erste Veröffentlichung der App.';
function maybeShowUpdateHint() {
  var seenVersion = null;
  try { seenVersion = localStorage.getItem('agrar_rechner_version_seen'); } catch(e) {}
  if (seenVersion === APP_VERSION) return;
  var banner = document.getElementById('update_banner');
  var verEl = document.getElementById('update_version');
  var changelogEl = document.getElementById('update_changelog');
  if (banner) {
    if (verEl) verEl.textContent = APP_VERSION;
    if (changelogEl) changelogEl.textContent = UPDATE_CHANGELOG;
    banner.classList.add('show');
  }
}
function dismissUpdateHint() {
  try { localStorage.setItem('agrar_rechner_version_seen', APP_VERSION); } catch(e) {}
  var banner = document.getElementById('update_banner');
  if (banner) banner.classList.remove('show');
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
  isIOS: isIOS,
  isStandalone: isStandalone,
  UPDATE_CHANGELOG: UPDATE_CHANGELOG,
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
  loadState: loadState,
  maybeShowIosInstallHint: maybeShowIosInstallHint,
  dismissIosInstallHint: dismissIosInstallHint,
  maybeShowUpdateHint: maybeShowUpdateHint,
  dismissUpdateHint: dismissUpdateHint,
});
