// ============================================================================
// DATA-IO-HANDLERS — Daten-Export/Import (versionierter JSON-Backup & Restore)
//
// Aus ui-handlers.js (Issue #416 Welle 8) in ein eigenes Modul extrahiert.
// Enthält:
//   - Konstanten: EXPORT_APP_KEY, EXPORT_FORMAT_VERSION, EXPORT_MAX_BYTES
//   - Envelope-Builder: buildExportEnvelope, serializeEnvelope,
//     makeExportFilename
//   - Export-Download: exportData
//   - Import-Validierung: validateImportText, importErrorMessage,
//     showImportError
//   - Vorschau-Modal: showImportPreview, openImportModal, closeImportModal,
//     confirmImportFromModal, cancelImportFromModal
//   - Commit: syncImportedSettingsUI, commitImportedState
//   - Status-Bereich: setExportSuccess, showExportError, showStatusError,
//     showStatus
//   - File-Reader-Hook: handleImportFile, onImportFileChange,
//     triggerImportClick
//   - Bootstrap: initDataExportImport
//
// Lade-Reihenfolge (siehe index.html):
//   render-local-protocol.js → data-io-handlers.js → main.js
//
// data-io-handlers.js wird NACH render-local-protocol.js geladen, damit
// commitImportedState die AppGlobals-Brücke zu renderLocalProtocol
// (render-local-protocol.js) vorfindet — die defensive Auflösung
// passiert beim Nutzeraufruf; eine frühere Reihenfolge wäre gefährlich,
// sobald der defensive Pfad wegfällt. Wird VOR main.js geladen, weil
// main.js → initUIBindings() die hier registrierten AppGlobals-Handler an
// die statischen Footer-Elemente bindet. Wäre data-io-handlers.js danach
// geladen, fehlten die Handler beim ersten Boot.
//
// Die klassischen Top-Level-Deklarationen bleiben für bestehende
// HTML-/Window-Nutzung erhalten; zusätzlich registriert
// Object.assign(window.AppGlobals, …) die bisherige AppGlobals-API.
// Verbraucher sind index.html (Footer-Buttons, Status-Bereich),
// main.js (statische Bindings in initUIBindings),
// render-* (commitImportedState → defensive AppGlobals.renderTabs/
// renderResults/renderView/...) und die Test-Suite.
//
// Braucht zur Laufzeit (AppGlobals) — alle defensiv beim Nutzeraufruf:
//   - state, saveState, parseAndSanitizeState, invalidateCarryoverCache
//     (state.js)
//   - syncStateFromInputs, syncInputsFromState (input-handlers.js)
//   - fmtCompact (calculations.js)
//   - renderTabs, renderView, renderDrillTabList, renderDrillSummary,
//     renderResults (render-tabs.js / render-drill.js / render-results.js)
//   - renderDashboard (render-dashboard.js)
//   - renderLocalProtocol (render-local-protocol.js)
//   - renderKulturBadge, _renderKulturEmpfehlung, openKulturFirstRun,
//     closeKulturFirstRun (culture-handlers.js)
//
// Bewusst NICHT in data-io-handlers.js (bleiben woanders):
//   - Tabs / Settings / Reset / Drill / Kultur / Input / Render / Berechnung
//
// Verhaltensgleich zur ui-handlers.js-Variante (Issue #416 Welle 8 —
// reine lexikalische Konsolidierung, keine Logik-, Sanitizer-,
// Größenlimit-, Dateinamen-, Blob/URL-, FileReader-, Modal-, Fokus-,
// Status-, Rollback-, Persistenz-, Render-, Ereignis- oder
// UI-Logik-Änderung).
// ============================================================================

// --- Konstanten ---

var EXPORT_APP_KEY = 'agrar-rechner';
var EXPORT_FORMAT_VERSION = 1;
// 10 MB harte Obergrenze: deutlich über realem Bedarf (Komplett-Backup
// inkl. Notizen, Drill-Entries, machineLog liegt typisch bei < 100 KB),
// schützt aber vor versehentlich eingespielten Riesen-Dateien.
var EXPORT_MAX_BYTES = 10 * 1024 * 1024;

// --- Envelope-Builder ---

function buildExportEnvelope() {
  // Sicherstellen, dass pending Eingaben (Input-Feld hat Fokus, hat aber
  // noch keinen blur gefeuert) im State landen, bevor wir exportieren.
  if (typeof AppGlobals.syncStateFromInputs === 'function') {
    AppGlobals.syncStateFromInputs();
  }
  return {
    app: EXPORT_APP_KEY,
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    state: AppGlobals.state
  };
}

function serializeEnvelope(env) {
  return JSON.stringify(env, null, 2);
}

function makeExportFilename(date) {
  var d = date || new Date();
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var yyyy = d.getFullYear();
  var mm = pad(d.getMonth() + 1);
  var dd = pad(d.getDate());
  var hh = pad(d.getHours());
  var mi = pad(d.getMinutes());
  return 'agrar-rechner-export-' + yyyy + '-' + mm + '-' + dd + '-' + hh + mi + '.json';
}

// --- Export-Download ---

function exportData() {
  var env = buildExportEnvelope();
  var text = serializeEnvelope(env);
  var filename = makeExportFilename();
  var blob;
  try {
    blob = new Blob([text], { type: 'application/json' });
  } catch (e) {
    showExportError('Download konnte nicht vorbereitet werden.');
    return;
  }
  var url = URL.createObjectURL(blob);
  var anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  try {
    anchor.click();
    setExportSuccess('Daten exportiert (' + filename + ')');
  } catch (e) {
    showExportError('Download konnte nicht ausgelöst werden.');
  }
  setTimeout(function () {
    try { document.body.removeChild(anchor); } catch (e) {}
    try { URL.revokeObjectURL(url); } catch (e) {}
  }, 0);
}

// --- Import-Validierung ---

function validateImportText(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, error: 'empty-file' };
  }
  // Größen-Check via AppGlobals-Property, damit Tests das Limit temporär
  // heruntersetzen können (sonst wäre eine echte 10 MB-Allokation nötig).
  var maxBytes = (AppGlobals && typeof AppGlobals.EXPORT_MAX_BYTES === 'number')
    ? AppGlobals.EXPORT_MAX_BYTES
    : EXPORT_MAX_BYTES;
  if (raw.length > maxBytes) {
    return { ok: false, error: 'too-large' };
  }
  var envelope;
  try {
    envelope = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: 'invalid-json' };
  }
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    return { ok: false, error: 'invalid-format' };
  }
  if (envelope.app !== EXPORT_APP_KEY) {
    return { ok: false, error: 'foreign-format' };
  }
  if (typeof envelope.formatVersion !== 'number') {
    return { ok: false, error: 'invalid-format' };
  }
  if (envelope.formatVersion !== EXPORT_FORMAT_VERSION) {
    return { ok: false, error: 'foreign-format' };
  }
  if (!envelope.state || typeof envelope.state !== 'object' || Array.isArray(envelope.state)) {
    return { ok: false, error: 'invalid-format' };
  }
  // Issue #445 Welle 1 B: Kardinalitäts-Check auf dem ROHEN Envelope.state,
  // BEVOR die Sanitizer-Pipeline läuft. So bekommt der Nutzer einen klaren
  // Fehlercode statt eines stillen Clamps. STATE_LIMITS wird dynamisch
  // über AppGlobals gelesen — Tests können die Limits live absenken.
  var rawState = envelope.state;
  // Single Source of Truth: getStateLimits() liest dieselbe STATE_LIMITS-
  // Instanz wie der Sanitizer — keine duplizierten Fallback-Literale hier.
  var limits = AppGlobals.getStateLimits();
  var maxTabs = limits.maxTabs;
  var maxEntriesPerTab = limits.maxEntriesPerTab;
  var maxMachineLog = limits.maxMachineLog;
  if (Array.isArray(rawState.reiter) && rawState.reiter.length > maxTabs) {
    return { ok: false, error: 'too-many-tabs' };
  }
  if (Array.isArray(rawState.reiter)) {
    for (var rci = 0; rci < rawState.reiter.length; rci++) {
      var rt = rawState.reiter[rci];
      if (rt && Array.isArray(rt.entries) && rt.entries.length > maxEntriesPerTab) {
        return { ok: false, error: 'too-many-entries' };
      }
    }
  }
  if (Array.isArray(rawState.machineLog) && rawState.machineLog.length > maxMachineLog) {
    return { ok: false, error: 'too-many-log-entries' };
  }
  // Vollständige Schema-/Sanitizer-Pipeline (wie loadState) — Verteidigungs-
  // linie gegen manipulierten state-Block innerhalb des Envelopes.
  var result = AppGlobals.parseAndSanitizeState(JSON.stringify(envelope.state));
  if (!result || !result.state || !Array.isArray(result.state.reiter) || result.state.reiter.length === 0) {
    return { ok: false, error: 'invalid-state' };
  }
  var state = result.state;
  var tabCount = state.reiter.length;
  var entryCount = 0;
  for (var ti = 0; ti < state.reiter.length; ti++) {
    var tab = state.reiter[ti];
    if (tab && Array.isArray(tab.entries)) entryCount += tab.entries.length;
  }
  return {
    ok: true,
    state: state,
    originalLv: result.originalLv,
    counts: { tabs: tabCount, entries: entryCount }
  };
}

function importErrorMessage(code) {
  switch (code) {
    case 'empty-file':          return 'Die Datei ist leer.';
    case 'too-large':           return 'Die Datei ist zu groß (Maximum 10 MB).';
    case 'invalid-json':        return 'Die Datei enthält kein gültiges JSON.';
    case 'invalid-format':      return 'Die Datei hat ein unbekanntes Format.';
    case 'foreign-format':      return 'Diese Datei stammt nicht aus dem Agrar-Rechner.';
    case 'invalid-state':       return 'Die Datei enthält keinen gültigen App-Zustand.';
    case 'too-many-tabs':       return 'Der Backup enthält mehr Schläge als unterstützt (max. 200).';
    case 'too-many-entries':    return 'Der Backup enthält mehr Buchungen pro Schlag als unterstützt (max. 5.000).';
    case 'too-many-log-entries': return 'Der Backup enthält mehr Maschinen-Log-Einträge als unterstützt (max. 2.000).';
    default:                    return 'Import fehlgeschlagen.';
  }
}

// --- Vorschau-Modal ---
//
// Issue #446 Welle 1: Initialfokus liegt NICHT mehr auf der destruktiven
// Bestätigung (#import_modal_confirm), sondern auf einem sicheren Pfad:
// bevorzugt der ✕-Abbrechen oben rechts (#import_modal_x), sonst der
// untere Abbrechen-Button (#import_modal_cancel). Escape delegiert an
// cancelImportFromModal. Fokus-Rückgabe auf den Auslöser
// (#data_import_btn). Fokus-/Trap-/Escape-Verwaltung läuft über den
// generischen Dialog-Helper (AppGlobals.installDialogA11y).

function _installImportModalA11y(modal) {
  if (!modal || typeof AppGlobals.installDialogA11y !== 'function') return;
  // Sicherer Initialfokus: Abbrechen-Buttons vermeiden versehentliche
  // Bestätigungen per Enter auf der destruktiven Schaltfläche.
  // Priorität: ✕-Button oben rechts (sichtbar, eindeutig), dann unterer
  // "Abbrechen"-Button. data_import_file ist HIDDEN und somit kein echtes
  // Fokus-Ziel — wir lassen es deshalb bewusst aus.
  var initialFocus = document.getElementById('import_modal_x')
    || document.getElementById('import_modal_cancel');
  AppGlobals.installDialogA11y(modal, {
    initialFocus: initialFocus || undefined,
    // Späte Bindung über AppGlobals (siehe reset-handlers): der Escape-Pfad
    // löst zur Laufzeit über das App-Globals-Objekt auf.
    onEscape: function () { AppGlobals.cancelImportFromModal(); },
    restoreFocusTo: document.getElementById('data_import_btn')
  });
}

function showImportPreview(parsed) {
  if (!parsed || !parsed.ok) return;
  var modal = document.getElementById('import_modal');
  var overlay = document.getElementById('import_overlay');
  var counts = document.getElementById('import_modal_counts');
  if (counts) {
    var tabs = parsed.counts.tabs;
    var entries = parsed.counts.entries;
    counts.textContent = tabs + (tabs === 1 ? ' Schlag' : ' Schläge') + ' · ' +
                        entries + ' Buchung' + (entries === 1 ? '' : 'en');
  }
  if (modal) modal._importParsed = parsed;
  if (modal) {
    modal.hidden = false;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }
  if (overlay) {
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
  }
  _installImportModalA11y(modal);
}

function openImportModal() {
  var modal = document.getElementById('import_modal');
  var overlay = document.getElementById('import_overlay');
  if (modal) {
    modal.hidden = false;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }
  if (overlay) {
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
  }
  _installImportModalA11y(modal);
}

function closeImportModal() {
  var modal = document.getElementById('import_modal');
  var overlay = document.getElementById('import_overlay');
  if (modal && typeof AppGlobals.runDialogA11yCleanup === 'function') {
    AppGlobals.runDialogA11yCleanup(modal);
  }
  if (modal) {
    modal._importParsed = null;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    modal.hidden = true;
  }
  if (overlay) {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }
}

function confirmImportFromModal() {
  var modal = document.getElementById('import_modal');
  var parsed = modal && modal._importParsed;
  if (!parsed || !parsed.ok) {
    closeImportModal();
    return;
  }
  var state = parsed.state;
  var counts = parsed.counts;
  modal._importParsed = null;
  closeImportModal();
  if (!commitImportedState(state)) {
    showExportError('Import fehlgeschlagen: Der neue Stand konnte nicht gespeichert werden. Der bisherige Stand bleibt erhalten.');
    return;
  }
  setExportSuccess(counts.tabs + (counts.tabs === 1 ? ' Schlag' : ' Schläge') +
                  ' · ' + counts.entries + ' Buchung' +
                  (counts.entries === 1 ? '' : 'en') + ' importiert');
}

function cancelImportFromModal() {
  closeImportModal();
  setExportSuccess('Import abgebrochen');
}

function showImportError(codeOrMessage) {
  var msg = importErrorMessage(codeOrMessage);
  showStatusError(msg);
}

// --- Commit: State ersetzen, persistieren, rendern ---

function syncImportedSettingsUI() {
  var fgEnabled = !!AppGlobals.state.fahrgassenEnabled;
  var fgToggle = document.getElementById('fahrgassen_toggle');
  var fgSettings = document.getElementById('fahrgassen_settings');
  var fgBreite = document.getElementById('fahrgassen_breite');
  if (fgToggle) {
    fgToggle.classList.toggle('active', fgEnabled);
    fgToggle.setAttribute('aria-pressed', fgEnabled ? 'true' : 'false');
  }
  if (fgSettings) fgSettings.classList.toggle('open', fgEnabled);
  if (fgBreite) {
    fgBreite.value = AppGlobals.state.fahrgassenBreite > 0
      ? AppGlobals.fmtCompact(AppGlobals.state.fahrgassenBreite)
      : '';
    fgBreite.dataset.prev = fgBreite.value;
    fgBreite.dataset.cleaned = fgBreite.value;
  }

  var kpeEnabled = !!AppGlobals.state.einheitGroesseEnabled;
  var kpeToggle = document.getElementById('einheit_groesse_toggle');
  var kpeSettings = document.getElementById('einheit_groesse_settings');
  if (kpeToggle) {
    kpeToggle.classList.toggle('active', kpeEnabled);
    kpeToggle.setAttribute('aria-pressed', kpeEnabled ? 'true' : 'false');
  }
  if (kpeSettings) kpeSettings.classList.toggle('open', kpeEnabled);
}

function commitImportedState(newState) {
  var previousState = AppGlobals.state;
  AppGlobals.state = newState;
  AppGlobals.state.activeReiter = 0;
  AppGlobals.state.activeView = null;
  AppGlobals.state.dashboardOpen = false;

  // Erst persistieren, dann rendern. Bei Storage-/Quota-Fehler bleibt der
  // bisherige Stand sowohl im Speicher als auch in localStorage erhalten.
  if (typeof AppGlobals.saveState !== 'function' || AppGlobals.saveState() !== true) {
    AppGlobals.state = previousState;
    if (typeof AppGlobals.invalidateCarryoverCache === 'function') {
      AppGlobals.invalidateCarryoverCache();
    }
    return false;
  }

  var dashboardSheet = document.getElementById('dashboard_sheet');
  var dashboardOverlay = document.getElementById('dashboard_overlay');
  if (dashboardSheet) dashboardSheet.classList.remove('open');
  if (dashboardOverlay) dashboardOverlay.classList.remove('open');
  document.body.style.overflow = '';

  if (typeof AppGlobals.invalidateCarryoverCache === 'function') {
    AppGlobals.invalidateCarryoverCache();
  }
  if (typeof AppGlobals.renderTabs === 'function') {
    AppGlobals.renderTabs();
  }
  if (typeof AppGlobals.syncInputsFromState === 'function') {
    AppGlobals.syncInputsFromState();
  }
  syncImportedSettingsUI();
  if (typeof AppGlobals.renderResults === 'function') {
    AppGlobals.renderResults();
  }
  if (typeof AppGlobals.renderView === 'function') {
    AppGlobals.renderView();
  }
  if (typeof AppGlobals.renderKulturBadge === 'function') {
    AppGlobals.renderKulturBadge();
  }
  if (typeof AppGlobals._renderKulturEmpfehlung === 'function') {
    AppGlobals._renderKulturEmpfehlung();
  }
  if (!AppGlobals.state.erstauswahlDone && !AppGlobals.state.kultur) {
    if (typeof AppGlobals.openKulturFirstRun === 'function') {
      AppGlobals.openKulturFirstRun();
    }
  } else if (typeof AppGlobals.closeKulturFirstRun === 'function') {
    AppGlobals.closeKulturFirstRun();
  }
  if (AppGlobals.state.activeView === 'protokoll') {
    if (typeof AppGlobals.renderDrillTabList === 'function') {
      AppGlobals.renderDrillTabList();
    }
    if (typeof AppGlobals.renderDrillSummary === 'function') {
      AppGlobals.renderDrillSummary();
    }
    if (typeof AppGlobals.renderLocalProtocol === 'function') {
      AppGlobals.renderLocalProtocol();
    }
  }
  if (AppGlobals.state.dashboardOpen && typeof AppGlobals.renderDashboard === 'function') {
    AppGlobals.renderDashboard();
  }
  return true;
}

// --- Status-Bereich (Erfolgs-/Fehlermeldungen) ---

function setExportSuccess(message) {
  showStatus(message, 'success');
}

function showExportError(message) {
  showStatus(message, 'error');
}

function showStatusError(message) {
  showStatus(message, 'error');
}

function showStatus(message, kind) {
  var el = document.getElementById('data_io_status');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('data-io-status--success', 'data-io-status--error');
  if (kind === 'error' || kind === 'success') {
    el.classList.add('data-io-status--' + kind);
  }
}

// --- File-Reader-Hook ---

function handleImportFile(file) {
  if (!file) return;
  var maxBytes = (AppGlobals && typeof AppGlobals.EXPORT_MAX_BYTES === 'number')
    ? AppGlobals.EXPORT_MAX_BYTES
    : EXPORT_MAX_BYTES;
  if (typeof file.size === 'number' && file.size > maxBytes) {
    showImportError('too-large');
    return;
  }
  var reader;
  try {
    reader = new FileReader();
  } catch (e) {
    showImportError('invalid-format');
    return;
  }
  reader.onload = function (e) {
    var text = e && e.target && typeof e.target.result === 'string' ? e.target.result : '';
    var parsed = validateImportText(text);
    if (!parsed.ok) {
      showImportError(parsed.error);
      return;
    }
    showImportPreview(parsed);
  };
  reader.onerror = function () {
    showImportError('invalid-format');
  };
  try {
    reader.readAsText(file);
  } catch (e) {
    showImportError('invalid-format');
  }
}

function onImportFileChange(event) {
  var file = event && event.target && event.target.files && event.target.files[0];
  if (!file) return;
  handleImportFile(file);
  try { event.target.value = ''; } catch (e) {}
}

function triggerImportClick() {
  var input = document.getElementById('data_import_file');
  if (input && typeof input.click === 'function') {
    try { input.click(); } catch (e) {}
  }
}

function initDataExportImport() {
  // Issue #441: Die DOM-Event-Bindings (data_export_btn, data_import_btn,
  // data_import_file change sowie import_modal_x/_cancel/_confirm/_overlay)
  // leben zentral in main.js → initUIBindings() — dort sind sie
  // idempotent (AppGlobals._uiBindingsRegistered) und neben allen anderen
  // App-Shell-Bindings dokumentiert. Doppel-Bindings wurden vermieden,
  // indem initDataExportImport hier KEIN addEventListener mehr aufruft.
  // Die Funktion bleibt auf AppGlobals registriert, weil sie in der
  // Test-Suite (tests/app-shell-parity.test.js) als Modul-API-Vertrag
  // geprüft wird — und weil ein zukünftiger Aufrufer aus einem
  // Bootstrap-Pfad sie weiterhin erwarten darf (siehe AGENTS.md).
}

Object.assign(window.AppGlobals, {
  EXPORT_APP_KEY: EXPORT_APP_KEY,
  EXPORT_FORMAT_VERSION: EXPORT_FORMAT_VERSION,
  EXPORT_MAX_BYTES: EXPORT_MAX_BYTES,
  buildExportEnvelope: buildExportEnvelope,
  serializeEnvelope: serializeEnvelope,
  makeExportFilename: makeExportFilename,
  exportData: exportData,
  validateImportText: validateImportText,
  importErrorMessage: importErrorMessage,
  showImportPreview: showImportPreview,
  openImportModal: openImportModal,
  closeImportModal: closeImportModal,
  confirmImportFromModal: confirmImportFromModal,
  cancelImportFromModal: cancelImportFromModal,
  showImportError: showImportError,
  commitImportedState: commitImportedState,
  setExportSuccess: setExportSuccess,
  showExportError: showExportError,
  handleImportFile: handleImportFile,
  onImportFileChange: onImportFileChange,
  triggerImportClick: triggerImportClick,
  initDataExportImport: initDataExportImport,
});
