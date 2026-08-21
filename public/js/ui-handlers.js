// ============================================================================
// UI-HANDLERS — Drill-Protokoll, Import/Export und lokale Modals
//
// Alle Funktionen die UI-Events behandeln und state ändern.
// Jede state-Änderung löst appEmit() aus → Subscriber kümmert sich um rendern.
// Keine render*-Aufrufe direkt in diesen Funktionen (außer wo sofort nötig).
// ============================================================================

    // --- Kultur-Auswahl ---
    // Die Kultur-Auswahl und die Kultur-Modal-Accessibility (Fokus-Trap,
    // Escape-Verhalten) leben seit Issue #416 Welle 1 in einem eigenen
    // Modul: public/js/culture-handlers.js. Wird zwischen calculations.js
    // und ui-handlers.js geladen (siehe index.html Kommentar). Schnittstelle
    // bleibt unverändert: chooseKultur, renderKulturBadge, openKulturFirstRun,
    // closeKulturFirstRun, requestChangeKultur, confirmChangeKultur,
    // cancelChangeKultur, _onKulturChangeSelectChange, isUntouchedInitialField,
    // AppGlobals._pendingKulturChoice.

// --- Tab-Verwaltung ---
//
// Tab-/Ansichtsverwaltung (addReiter, removeReiter, _closeDashboardIfOpen,
// switchReiter, switchToProtokoll, switchToRechner, renameReiter) ist seit
// Issue #416 Welle 2 in ein eigenes Modul ausgelagert:
// public/js/tab-handlers.js. Wird zwischen input-handlers.js und render-tabs.js
// geladen (siehe index.html Kommentar). Schnittstelle bleibt unverändert;
// bisher lexikalische Abhängigkeiten werden über AppGlobals aufgelöst:
// syncStateFromInputs/_syncActiveTabLock aus input-handlers.js /
// drill-handlers.js sowie die später geladenen Renderer-Funktionen
// renderDrillTabList/closeDashboard.

// --- Einstellungen-Handler ---
//
// Fahrgassen- und Einheiten-Größe-Handler (fahrgassenToggle,
// fahrgassenUpdate, einheitGroesseToggle, einheitGroesseUpdate,
// syncEinheitGroesseEditorFromTab) sind seit Issue #416 Welle 3 in ein
// eigenes Modul ausgelagert: public/js/settings-handlers.js. Wird zwischen
// input-handlers.js und tab-handlers.js geladen (siehe index.html Kommentar).
// Schnittstelle bleibt unverändert; syncInputsFromState ruft die Editor-
// Sync-Funktion über die AppGlobals-Brücke auf
// (AppGlobals.syncEinheitGroesseEditorFromTab) statt über den früheren
// lexikalischen Verweis.

// --- Reset ---
//
// Reset-Verantwortung (DOM_IDS, _resetInput, resetActiveTab, resetAll,
// _countAllEntries, _populateResetContext, openResetModal, closeResetModal,
// _onOverlayClick, _onResetTab, _onResetAll, _onCancel) ist seit Issue #416
// Welle 4 in ein eigenes Modul ausgelagert: public/js/reset-handlers.js.
// Wird zwischen settings-handlers.js und tab-handlers.js geladen (siehe
// index.html Kommentar). Schnittstelle bleibt unverändert; alle
// Modulabhängigkeiten (state, saveState, resetLoadStateEverSucceeded,
// getActiveReiter, renderTabs, renderKulturBadge, openKulturFirstRun)
// werden zur Laufzeit über AppGlobals aufgelöst.

// --- Drill-Handler ---
//
// Drill-Einfüllung, Verteilung und Maschinen-Log (_parseDrillInputs,
// _resolvePerTabDistribution, _buildDrillEntry, _pushEntryToTab,
// _buildMachineLogEntry, _readActivePerTabValues, _clearDrillInputs,
// drillAdd, drillRemove, _calcDrillDistribution, _applyDrillPlan,
// drillCalcAll, _syncActiveTabLock, drillCalcDebounced, drillMachineRemove)
// sind seit Issue #416 Welle 5 in ein eigenes Modul ausgelagert:
// public/js/drill-handlers.js. Wird zwischen reset-handlers.js und
// tab-handlers.js geladen (siehe index.html Kommentar). Schnittstelle
// bleibt unverändert; alle Modulabhängigkeiten werden zur Laufzeit über
// AppGlobals aufgelöst.

// --- Input-Handler ---
//
// Eingaben, Formatierung und State-Synchronisierung (onInputHektar,
// onInputIstHektar, onInputKoerner, onInputDuenger, onInputNotizen,
// getKornerGesamt, getActiveTotalEinheiten, getActiveTotalDuenger,
// getTotalEinheiten, getTotalDuenger, onInputFormat, getActiveReiter,
// syncStateFromInputs, toInputValue, syncInputsFromState) sind seit
// Issue #416 Welle 6 in ein eigenes Modul ausgelagert:
// public/js/input-handlers.js. Wird zwischen ui-handlers.js und
// settings-handlers.js geladen (siehe index.html Kommentar). Schnittstelle
// bleibt unverändert; alle Modulabhängigkeiten (AppGlobals.getActiveReiter,
// AppGlobals.parseDE, AppGlobals.appEmit,
// AppGlobals.syncEinheitGroesseEditorFromTab) werden zur Laufzeit über
// AppGlobals aufgelöst. Die in dieser Datei verbleibenden
// Import-/Export-Pfade greifen defensiv über
// AppGlobals.syncStateFromInputs und AppGlobals.syncInputsFromState zu
// (beim Funktionsaufruf, nicht beim Modul-Load).

// ============================================================================
// Lokales Protokoll-Redesign — Action-Sheet, View-Toggle, Accordion
// ============================================================================
//
// Verhalten dieser UI-Funktionen (jetzt in public/js/protocol-handlers.js,
// Issue #416 Welle 7): setProtocolView, toggleProtocolAccordion,
// requestLocalProtocolDelete, closeLocalProtocolSheet,
// confirmLocalProtocolDelete sowie der private Modulzustand
// _localProtocolSheetTarget. Wird zwischen drill-handlers.js und
// tab-handlers.js geladen (siehe index.html Kommentar). Schnittstelle
// bleibt unverändert: alle fünf Funktionen bleiben sowohl als
// klassische window-Namen als auch auf AppGlobals erreichbar. Die
// Löschpfade confirmLocalProtocolDelete → AppGlobals.drillRemove /
// AppGlobals.drillMachineRemove werden defensiv beim Nutzeraufruf
// aufgelöst, nicht beim Modul-Load.
// Kultur-Funktionen (chooseKultur, requestChangeKultur, …) und
// AppGlobals._pendingKulturChoice werden seit Issue #416 Welle 1 in
// public/js/culture-handlers.js registriert.
// Tab-/Ansichtsverwaltung (addReiter, removeReiter, switchReiter, …) wird
// seit Issue #416 Welle 2 in public/js/tab-handlers.js registriert.
// Einstellungs-Handler (fahrgassenToggle, fahrgassenUpdate,
// einheitGroesseToggle, einheitGroesseUpdate,
// syncEinheitGroesseEditorFromTab) werden seit Issue #416 Welle 3 in
// public/js/settings-handlers.js registriert.
// Drill-Handler (_parseDrillInputs, _resolvePerTabDistribution,
// _buildDrillEntry, _pushEntryToTab, _buildMachineLogEntry,
// _readActivePerTabValues, _clearDrillInputs, drillAdd, drillRemove,
// _calcDrillDistribution, _applyDrillPlan, drillCalcAll,
// _syncActiveTabLock, drillCalcDebounced, drillMachineRemove) werden seit
// Issue #416 Welle 5 in public/js/drill-handlers.js registriert.
// Lokales Protokoll (setProtocolView, toggleProtocolAccordion,
// requestLocalProtocolDelete, closeLocalProtocolSheet,
// confirmLocalProtocolDelete) wird seit Issue #416 Welle 7 in
// public/js/protocol-handlers.js registriert.
// Input-Handler (onInputHektar, onInputIstHektar, onInputKoerner, onInputDuenger,
// onInputNotizen, getKornerGesamt, getActiveTotalEinheiten, getActiveTotalDuenger,
// getTotalEinheiten, getTotalDuenger, onInputFormat, getActiveReiter,
// syncStateFromInputs, toInputValue, syncInputsFromState) werden seit
// Issue #416 Welle 6 in public/js/input-handlers.js registriert.

// ============================================================================
// DATEN-EXPORT/IMPORT — versionierter JSON-Backup & Restore
//
// IDEAS.md „Daten exportieren/importieren" (Hohe Priorität).
//
// Verhalten:
//   1. exportData() synchronisiert DOM → state und lädt eine portable JSON-
//      Datei herunter, die den fachlichen App-State enthält.
//   2. validateImportText(text) liest die Datei vollständig und prüft sie
//      gegen parseAndSanitizeState. Fremdes Format, kaputtes JSON, leere/
//      zu große Dateien und ungültiger State werden sicher abgelehnt.
//   3. showImportPreview(parsed) öffnet ein Modal mit Anzahl Schläge +
//      Buchungen. Erst nach Bestätigung (confirmImportFromModal) wird der
//      komplette bisherige State ersetzt, gespeichert und vollständig
//      aktualisiert; cancelImportFromModal lässt alles unverändert.
//   4. Reine UI-Ansicht wird auf Rechner + ersten Schlag normalisiert,
//      damit der übernommene Arbeitsstand sofort sichtbar ist.
//
// Konsolidiert in ui-handlers.js (statt eigenes Modul): die PWA-Architektur
// hat einen festen STATIC_ASSETS-Vertrag in sw.js (siehe tests/37); ohne
// sw.js-Update lässt sich kein zusätzlicher <script>-Tag einbringen. Diese
// DOM-Modal-Logik gehört funktional zu den anderen Modal-Pfaden in dieser
// Datei (kultur-confirm-modal).
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
    case 'empty-file':       return 'Die Datei ist leer.';
    case 'too-large':        return 'Die Datei ist zu groß (Maximum 10 MB).';
    case 'invalid-json':     return 'Die Datei enthält kein gültiges JSON.';
    case 'invalid-format':   return 'Die Datei hat ein unbekanntes Format.';
    case 'foreign-format':   return 'Diese Datei stammt nicht aus dem Agrar-Rechner.';
    case 'invalid-state':    return 'Die Datei enthält keinen gültigen App-Zustand.';
    default:                 return 'Import fehlgeschlagen.';
  }
}

// --- Vorschau-Modal ---

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
  var confirmBtn = document.getElementById('import_modal_confirm');
  if (confirmBtn && typeof confirmBtn.focus === 'function') {
    try { confirmBtn.focus(); } catch (e) {}
  }
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
}

function closeImportModal() {
  var modal = document.getElementById('import_modal');
  var overlay = document.getElementById('import_overlay');
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
  var exportBtn = document.getElementById('data_export_btn');
  if (exportBtn) exportBtn.addEventListener('click', exportData);
  var importBtn = document.getElementById('data_import_btn');
  if (importBtn) importBtn.addEventListener('click', triggerImportClick);
  var fileInput = document.getElementById('data_import_file');
  if (fileInput) fileInput.addEventListener('change', onImportFileChange);
  var confirmBtn = document.getElementById('import_modal_confirm');
  if (confirmBtn) confirmBtn.addEventListener('click', confirmImportFromModal);
  var cancelBtn = document.getElementById('import_modal_cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', cancelImportFromModal);
  var xBtn = document.getElementById('import_modal_x');
  if (xBtn) xBtn.addEventListener('click', cancelImportFromModal);
  var overlay = document.getElementById('import_overlay');
  if (overlay) overlay.addEventListener('click', function (e) {
    if (e && e.target && e.target.id === 'import_overlay') cancelImportFromModal();
  });
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