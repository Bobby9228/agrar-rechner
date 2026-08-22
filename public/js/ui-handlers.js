// ============================================================================
// UI-HANDLERS — Architektur-Index für ui-handlers.js
//
// ui-handlers.js enthält seit Issue #416 Wellen 1–8 keine ausführbaren
// Funktionsdefinitionen mehr — sämtliche UI-Event-Handler wurden in
// eigene Module extrahiert (culture-, tab-, settings-, reset-,
// drill-, input-, protocol-, data-io-handlers). Diese Datei dient
// jetzt nur noch als kompakter Architektur-Index und Verweis auf die
// jeweiligen Module samt Lade-Reihenfolge.
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
// AppGlobals aufgelöst.

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
// Daten-Export/Import (Konstanten EXPORT_APP_KEY, EXPORT_FORMAT_VERSION,
// EXPORT_MAX_BYTES sowie buildExportEnvelope, exportData,
// validateImportText, …) wird seit Issue #416 Welle 8 in
// public/js/data-io-handlers.js registriert (geladen zwischen
// render-local-protocol.js und main.js).

// --- Daten-Export/Import ---
//
// Daten-Export/Import (Konstanten EXPORT_APP_KEY, EXPORT_FORMAT_VERSION,
// EXPORT_MAX_BYTES sowie buildExportEnvelope, serializeEnvelope,
// makeExportFilename, exportData, validateImportText, importErrorMessage,
// showImportError, showImportPreview, openImportModal, closeImportModal,
// confirmImportFromModal, cancelImportFromModal, syncImportedSettingsUI,
// commitImportedState, setExportSuccess, showExportError, showStatusError,
// showStatus, handleImportFile, onImportFileChange, triggerImportClick,
// initDataExportImport) ist seit Issue #416 Welle 8 in ein eigenes
// Modul ausgelagert: public/js/data-io-handlers.js. Wird zwischen
// render-local-protocol.js und main.js geladen (siehe index.html
// Kommentar). Schnittstelle bleibt unverändert: alle drei Konstanten und
// alle 22 Funktionen bleiben als klassische window-Namen erreichbar;
// die drei internen Helfer showStatusError, showStatus und
// syncImportedSettingsUI bleiben wie zuvor bewusst außerhalb von
// AppGlobals. Alle bisher dort registrierten Namen bleiben zusätzlich auf
// AppGlobals erreichbar. Alle Modulabhängigkeiten (AppGlobals.parseAndSanitizeState,
// saveState, syncStateFromInputs, syncInputsFromState, fmtCompact,
// renderTabs, renderResults, renderView, renderKulturBadge,
// _renderKulturEmpfehlung, openKulturFirstRun, closeKulturFirstRun,
// renderDrillTabList, renderDrillSummary, renderLocalProtocol,
// renderDashboard, invalidateCarryoverCache) werden defensiv beim
// Nutzeraufruf aufgelöst, nicht beim Modul-Load.