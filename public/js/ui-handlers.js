// ============================================================================
// UI-HANDLERS — Eingaben, Drill-Protokoll, Import/Export und lokale Modals
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
// public/js/tab-handlers.js. Wird zwischen ui-handlers.js und render-tabs.js
// geladen (siehe index.html Kommentar). Schnittstelle bleibt unverändert;
// bisher lexikalische Abhängigkeiten werden über AppGlobals aufgelöst:
// syncStateFromInputs/_syncActiveTabLock aus diesem Modul sowie die später
// geladenen Renderer-Funktionen renderDrillTabList/closeDashboard.

// --- Einstellungen-Handler ---
//
// Fahrgassen- und Einheiten-Größe-Handler (fahrgassenToggle,
// fahrgassenUpdate, einheitGroesseToggle, einheitGroesseUpdate,
// syncEinheitGroesseEditorFromTab) sind seit Issue #416 Welle 3 in ein
// eigenes Modul ausgelagert: public/js/settings-handlers.js. Wird zwischen
// ui-handlers.js und tab-handlers.js geladen (siehe index.html Kommentar).
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
// AppGlobals aufgelöst. Das in dieser Datei verbleibende Lokale Protokoll
// greift defensiv über AppGlobals.drillRemove und AppGlobals.drillMachineRemove
// zu (beim Funktionsaufruf, nicht beim Modul-Load).

    // --- Input Binding (reactive writes to state) ---

    function onInputHektar(el) {
      var r = AppGlobals.getActiveReiter();
      var v = AppGlobals.parseDE(el.value);
      if (r.hektar !== v) { r.hektar = v; AppGlobals.appEmit('ENTRY_CHANGED'); }
    }

    function onInputIstHektar(el) {
      var r = AppGlobals.getActiveReiter();
      var v = AppGlobals.parseDE(el.value);
      if (r.istHektar !== v) { r.istHektar = v; AppGlobals.appEmit('ENTRY_CHANGED'); }
    }

    function onInputKoerner(el) {
      var r = AppGlobals.getActiveReiter();
      var v = AppGlobals.parseDE(el.value);
      if (r.koerner !== v) { r.koerner = v; AppGlobals.appEmit('ENTRY_CHANGED'); }
    }

    function onInputDuenger(el) {
      var r = AppGlobals.getActiveReiter();
      var v = AppGlobals.parseDE(el.value);
      if (r.duenger !== v) { r.duenger = v; AppGlobals.appEmit('ENTRY_CHANGED'); }
    }

    // Migration 8→9 (Notizen pro Schlag): freier Text pro Tab/Reiter.
    // Persistenz via saveState() wird über den 'ENTRY_CHANGED'-Event
    // getriggert (render-tabs.js Subscriber ruft saveState() und
    // renderTabs()/renderResults()). Pro Tab getrennt: Tab-Wechsel
    // liest via syncInputsFromState() den Wert des Ziel-Tabs in die
    // textarea, ältere Notizen anderer Tabs bleiben im state erhalten.
    function onInputNotizen(el) {
      var r = AppGlobals.getActiveReiter();
      var v = typeof el.value === 'string' ? el.value : '';
      if (r.notizen !== v) { r.notizen = v; AppGlobals.appEmit('ENTRY_CHANGED'); }
    }

    // --- UI Wrappers (bridge: pure calculations → active tab context) ---
    // getTabKornerGesamt is in calculations.js; getActiveReiter is in ui-handlers.js
    function getKornerGesamt() {
      return AppGlobals.getTabKornerGesamt(AppGlobals.getActiveReiter());
    }

    // Issue #186: Convenience-Wrapper für aktiven Reiter.
    // delegieren an AppGlobals.getTabTotalEinheiten(r) / getTabTotalDuenger(r)
    // (Issue #7 — getTabTotalEinheiten/getTabTotalDuenger sind seit dem
    // Issue-7-Refactor die kanonischen Funktionen in calculations.js).
    function getActiveTotalEinheiten() {
      return AppGlobals.getTabTotalEinheiten(AppGlobals.getActiveReiter());
    }

    function getActiveTotalDuenger() {
      return AppGlobals.getTabTotalDuenger(AppGlobals.getActiveReiter());
    }

    // No-arg API-Kompatibilitäts-Wrapper (Issue #266).
    //
    // Tests rufen getTotalEinheiten() bzw. getTotalDuenger() ohne Argumente
    // auf. calculations.js exportiert diese Namen nicht mehr direkt
    // (Issue #7 — Konsolidierung auf getTabTotalEinheiten/getTabTotalDuenger).
    // Da ui-handlers.js NACH calculations.js geladen wird, gewinnen die
    // Wrapper im globalen Scope. Mittels arguments.length wird zwischen
    // Argument- und No-Arg-Aufruf dispatcht.
    //
    // No-arg: rechnet gegen state.koernerProEinheit für aktiven Reiter.
    // Arg-Version: delegiert an calculations.js-Kanone (mit optionalem
    // kpe-Override für Tests, die explizit einen Wert mitgeben).
    function getTotalEinheiten(r, koernerProEinheit) {
      if (arguments.length === 0) {
        return AppGlobals.getActiveTotalEinheiten();
      }
      return AppGlobals.getTabTotalEinheiten(r, koernerProEinheit);
    }
    function getTotalDuenger(r) {
      if (arguments.length === 0) {
        return AppGlobals.getActiveTotalDuenger();
      }
      return AppGlobals.getTabTotalDuenger(r);
    }

    // --- Input Formatierung (portiert aus Inline-Code Z. 2438-2546) ---
    //
    // Bereinigt Benutzereingaben während des Tippens.
    //
    // Modus 'integer': Nur Ziffern erlaubt (für Körner/ha).
    // Modus 'decimal': Ziffern + maximal ein Komma (für Hektar, Dünger).
    //
    // Auto-Komma-Erkennung: Manche Android-Tastaturen fügen automatisch
    // ein Komma ein – teils im selben input-Event wie die Ziffer, teils
    // in einem zweiten separaten Reformatierungs-Event (2-Pass-Verhalten).
    // Das keydown-Zähler-Heuristik scheitert beim 2-Pass-Fall, weil `prev`
    // nach dem ersten Event bereits die Ziffer enthält.
    //
    // Lösung: InputEvent.data als primäres Signal nutzen.
    //   e.data === ',' oder '.'  → User hat Dezimaltaste gedrückt → Komma behalten
    //   e.data = Ziffer / null   → Auto-Insert oder Reformatierung   → Komma entfernen
    //   Kein e / kein e.data     → Fallback auf _pendingKey (physische Tastatur)
    //
    // Beispiel decimal: '12..5' → '12,5' (Punkt→Komma, zweiter Punkt entfernt)
    //                  '12,5,5' → '12,5' (nur erstes Komma bleibt)
    function onInputFormat(el, mode, e) {
      var val = el.value;
      if (!val) { el.dataset.prev = ''; el.dataset.cleaned = ''; return; }
      var prev = el.dataset.prev || '';
      var cleaned;
      if (mode === 'integer') {
        // Nur Ziffern
        cleaned = val.replace(/[^\d]/g, '');
      } else {
        // Dezimal: Ziffern + ein Komma maximal
        // iOS mit englischer Tastatur: inputmode="decimal" liefert '.' statt ','.
        // Nur den ersten Punkt in ein Komma umwandeln, wenn noch kein Komma
        // vorhanden ist (sonst wäre es ein Tausenderpunkt in "1.234,5").
        var hasComma = val.indexOf(',') !== -1;
        if (!hasComma) {
          var firstDot = val.indexOf('.');
          if (firstDot > -1) {
            val = val.substring(0, firstDot) + ',' + val.substring(firstDot + 1);
          }
        }
        // Auto-Komma-Erkennung:
        // Wenn ein neues Komma auftaucht, prüfen ob der User es absichtlich
        // getippt hat.
        //
        // Strategie (Priorität absteigend):
        // 1. InputEvent.data vorhanden und nicht leer → zuverlässigstes Signal:
        //    data === ',' oder '.'  → User-Dezimaltaste        → Komma behalten
        //    data = Ziffer o.Ä.    → Auto-Insert (Android)     → Komma entfernen
        // 2. e.inputType = Komposition/Ersetzung → Android 2-Pass-Reformatierung → entfernen
        // 3. Kein e.data (Tests, ältere Browser): Fallback _pendingKey + Ziffernvergleich
        if (prev.indexOf(',') === -1 && val.indexOf(',') > 0) {
          var eventData = e ? e.data : undefined;
          var isDecimalInput;
          if (eventData !== null && eventData !== undefined && eventData !== '') {
            // InputEvent.data vorhanden: Dezimalseparator = User-Absicht, sonst Auto-Insert
            isDecimalInput = (eventData === ',' || eventData === '.');
          } else if (e && (e.inputType === 'insertCompositionText' || e.inputType === 'insertReplacementText')) {
            // Android 2-Pass-Reformatierung: Komma wurde nachträglich eingefügt → entfernen
            isDecimalInput = false;
          } else {
            // Kein e.data (Testumgebung, alte Browser): Fallback auf _pendingKey + Ziffernvergleich
            var key = _pendingKey;
            var isDecimalKey = (key === ',' || key === '.' || key === 'Decimal' || key === 'Comma');
            if (isDecimalKey) {
              isDecimalInput = true;
            } else if (key !== null && key !== 'Unidentified') {
              // Bekannte Nicht-Komma-Taste → Auto-Insert → entfernen
              isDecimalInput = false;
            } else {
              // null oder Unidentified: wenn genau 1 neue Ziffer + Komma im selben Event → Auto-Insert
              var withoutComma = val.replace(',', '');
              isDecimalInput = (withoutComma.length !== prev.length + 1);
            }
          }
          if (!isDecimalInput) {
            val = val.replace(',', '');
          }
        }
        cleaned = val.replace(/[^\d,]/g, '');
        // Nur das erste Komma behalten, Rest abschneiden
        var parts = cleaned.split(',');
        cleaned = parts[0] + (parts[1] !== undefined ? ',' + parts[1] : '');
      }
      el.dataset.prev = cleaned;
      el.dataset.cleaned = cleaned;
      if (el.value !== cleaned) {
        // Cursorposition proportional merken, damit Editierung in der Mitte nicht ans Ende springt
        var oldLen = el.value.length;
        var selStart = el.selectionStart;
        el.value = cleaned;
        var newPos;
        if (selStart === oldLen) {
          // Cursor war am Ende → am Ende bleiben
          newPos = cleaned.length;
        } else {
          // Cursor war in der Mitte → proportional anpassen
          newPos = Math.round(selStart * cleaned.length / oldLen);
        }
        el.setSelectionRange(newPos, newPos);
      }
    }

    // --- Helpers ---

// ============================================================================
// Lokales Protokoll-Redesign — Action-Sheet, View-Toggle, Accordion
// ============================================================================
//
// Verhalten dieser UI-Funktionen:
// - setProtocolView(view): wechselt 'fields' ⇄ 'machine' im neuen
//   Protokoll-Tab. Persistent (state.protocolView).
// - toggleProtocolAccordion(tabIdx, dateKey, cardKey): Single-Open-Logik
//   "ein Schlag gleichzeitig offen". Speichert das aktuell offene pro
//   Datum, sodass beim Wechsel auf einen anderen Schlag der vorherige
//   automatisch schließt. Beim Klick auf denselben Schlag wird er
//   geschlossen (toggle).
// - requestLocalProtocolDelete(kind, payload, timeLabel): öffnet das
//   Action-Sheet (Bottom-Sheet statt roter X), ruft beim Klick auf
//   "Buchung löschen" confirmLocalProtocolDelete(kind, payload) auf,
//   das die zugrundeliegende Datenoperation anstößt (drillRemove oder
//   drillMachineRemove — KEINE neuen Mutations, nur vorhandene Pfade).
//
// Die hier definierten Funktionen sind reine DOM-State-Bridge-Funktionen
// (kein Berechnungs-Code, keine Demowerte). Felder, die zuvor ein ✕
// hatten, sind jetzt entry-action (Drei-Punkte) → confirm-flow.

// Action-Sheet-Pending-Targets: was im offenen Sheet "schwebt".
// { kind: 'field'|'machine', payload: {tabIdx, entryIdx} | {mlIdx} }
var _localProtocolSheetTarget = null;

function setProtocolView(view) {
  if (view !== 'fields' && view !== 'machine') return;
  if (AppGlobals.state.protocolView === view) return;
  AppGlobals.state.protocolView = view;
  AppGlobals.saveState();
  AppGlobals.appEmit('PROTOCOL_VIEW_CHANGED', { view: view });
}

function toggleProtocolAccordion(tabIdx, dateKey, cardKey) {
  var openMap = AppGlobals.state.protocolOpenCards || (AppGlobals.state.protocolOpenCards = {});
  var key = String(tabIdx);
  var wasOpen = openMap[dateKey] === key;
  // Es darf im gesamten Protokoll nur eine Karte offen sein, nicht eine pro Tag.
  Object.keys(openMap).forEach(function(openDateKey) {
    delete openMap[openDateKey];
  });
  if (!wasOpen) {
    openMap[dateKey] = key;
  }
  AppGlobals.saveState();
  // Re-Render nur des Schläge-Panels (nicht der gesamten App).
  if (typeof AppGlobals.renderLocalProtocolFields === 'function') {
    AppGlobals.renderLocalProtocolFields();
  }
}

function requestLocalProtocolDelete(kind, payload, timeLabel) {
  // Sheet-Backdrop + Sheet sichtbar machen, Label/Pending speichern.
  _localProtocolSheetTarget = { kind: kind, payload: payload, timeLabel: timeLabel };
  var backdrop = document.getElementById('local_protocol_sheet_backdrop');
  var sheet = document.getElementById('local_protocol_action_sheet');
  var label = document.getElementById('local_protocol_sheet_label');
  var deleteBtn = document.getElementById('local_protocol_sheet_delete');
  if (label) {
    var sheetTimeLabel = timeLabel || '—';
    label.textContent = kind === 'machine'
      ? 'Maschinenfüllung um ' + sheetTimeLabel
      : 'Buchung um ' + sheetTimeLabel;
  }
  if (deleteBtn) {
    deleteBtn.textContent = kind === 'machine' ? 'Füllung löschen' : 'Buchung löschen';
  }
  if (backdrop) {
    backdrop.hidden = false;
    backdrop.classList.add('show');
  }
  if (sheet) {
    sheet.hidden = false;
    sheet.classList.add('show');
  }
}

function closeLocalProtocolSheet() {
  _localProtocolSheetTarget = null;
  var backdrop = document.getElementById('local_protocol_sheet_backdrop');
  var sheet = document.getElementById('local_protocol_action_sheet');
  if (backdrop) {
    backdrop.classList.remove('show');
    backdrop.hidden = true;
  }
  if (sheet) {
    sheet.classList.remove('show');
    sheet.hidden = true;
  }
}

function confirmLocalProtocolDelete() {
  var target = _localProtocolSheetTarget;
  if (!target) { closeLocalProtocolSheet(); return; }
  if (target.kind === 'field') {
    // drillRemove(tabIdx, entryIdx) ist der kanonische Pfad (render-drill.js)
    if (typeof AppGlobals.drillRemove === 'function') {
      AppGlobals.drillRemove(target.payload.tabIdx, target.payload.entryIdx);
    }
  } else if (target.kind === 'machine') {
    // drillMachineRemove ist der kanonische Pfad für Maschinen-Log.
    if (typeof AppGlobals.drillMachineRemove === 'function') {
      AppGlobals.drillMachineRemove(target.payload.mlIdx);
    }
  }
  closeLocalProtocolSheet();
}

    function getActiveReiter() {
      var r = AppGlobals.state.reiter[AppGlobals.state.activeReiter];
      if (!r) return AppGlobals.state.reiter[0];
      if (!r.entries) r.entries = [];
      return r;
    }

    function syncStateFromInputs() {
      var r = AppGlobals.getActiveReiter();
      r.hektar    = AppGlobals.parseDE(document.getElementById('hektar').value) || 0;
      r.istHektar = AppGlobals.parseDE(document.getElementById('ist_hektar').value) || 0;
      r.koerner   = AppGlobals.parseDE(document.getElementById('koerner').value) || 0;
      r.duenger    = AppGlobals.parseDE(document.getElementById('duenger').value) || 0;
      // Migration 8→9 (Notizen pro Schlag): Freitext-Wert ebenfalls
      // aus DOM übernehmen, damit Tab-Wechsel / Reset-Pfade / Fokus-
      // Shifts (Kultur-Modal) konsistent sind. textarea.value ist
      // immer ein String (Default ''), parseDE würde hier nichts
      // sinnvolles liefern.
      var nEl = document.getElementById('notizen');
      if (nEl) {
        r.notizen = typeof nEl.value === 'string' ? nEl.value : '';
      }
    }

    function toInputValue(n) {
      return String(n).replace('.', ',');
    }

    function syncInputsFromState() {
      var r = AppGlobals.getActiveReiter();
      var h = document.getElementById('hektar');
      var ih = document.getElementById('ist_hektar');
      var k = document.getElementById('koerner');
      var d = document.getElementById('duenger');
      var n = document.getElementById('notizen');
      var hVal = r.hektar > 0    ? toInputValue(r.hektar)    : '';
      var ihVal = r.istHektar > 0 ? toInputValue(r.istHektar) : '';
      var kVal = r.koerner > 0   ? toInputValue(r.koerner)   : '';
      var dVal = r.duenger > 0   ? toInputValue(r.duenger)   : '';
      h.value = hVal;  h.dataset.prev = hVal;  h.dataset.cleaned = hVal;
      ih.value = ihVal; ih.dataset.prev = ihVal; ih.dataset.cleaned = ihVal;
      k.value = kVal;  k.dataset.prev = kVal;  k.dataset.cleaned = kVal;
      d.value = dVal;  d.dataset.prev = dVal;  d.dataset.cleaned = dVal;
      // Migration 8→9 (Notizen pro Schlag): textarea-Inhalt aus dem
      // aktiven Reiter füllen — beim Tab-Wechsel sieht der User die
      // Notiz des neuen Schlags, ältere Notizen bleiben im state
      // (state.reiter[i].notizen) erhalten. sanitizeTab() vergibt für
      // jeden reiter.notizen einen Default '', daher ist typeof-Check
      // defensiv für Backwards-Compat.
      if (n) {
        n.value = typeof r.notizen === 'string' ? r.notizen : '';
      }
      // HIGH 3: Per-Tab kpe-Feld, saved-Text und UI-Zustand müssen bei
      // jedem Tabwechsel und bei init synchron sein, sonst zeigt das
      // Eingabefeld den Wert eines anderen Tabs.
      // Issue #416 Welle 3: syncEinheitGroesseEditorFromTab lebt jetzt
      // in settings-handlers.js — wir greifen über die AppGlobals-Brücke
      // zu. settings-handlers.js wird zwischen ui-handlers.js und
      // tab-handlers.js geladen, AppGlobals.syncEinheitGroesseEditorFromTab
      // ist deshalb zu diesem Zeitpunkt garantiert gesetzt.
      AppGlobals.syncEinheitGroesseEditorFromTab(r);
    }

// Register exposed globals on AppGlobals (ADR-001 Schritt 3, Issue #278).
Object.assign(window.AppGlobals, {
  // syncEinheitGroesseEditorFromTab ist seit Issue #416 Welle 3 in
  // public/js/settings-handlers.js registriert.
  // Reset-Funktionen und -Hilfen (DOM_IDS, _resetInput, resetActiveTab, resetAll,
  // openResetModal, closeResetModal, _onOverlayClick, _onResetTab,
  // _onResetAll, _onCancel, _countAllEntries, _populateResetContext)
  // werden seit Issue #416 Welle 4 in public/js/reset-handlers.js
  // registriert.
  // Lokales Protokoll-Redesign — Action-Sheet + View-Toggle + Accordion
  setProtocolView: setProtocolView,
  toggleProtocolAccordion: toggleProtocolAccordion,
  requestLocalProtocolDelete: requestLocalProtocolDelete,
  closeLocalProtocolSheet: closeLocalProtocolSheet,
  confirmLocalProtocolDelete: confirmLocalProtocolDelete,
});
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
Object.assign(window.AppGlobals, {
  onInputHektar: onInputHektar,
  onInputIstHektar: onInputIstHektar,
  onInputKoerner: onInputKoerner,
  onInputDuenger: onInputDuenger,
  onInputNotizen: onInputNotizen,
  getKornerGesamt: getKornerGesamt,
  getActiveTotalEinheiten: getActiveTotalEinheiten,
  getActiveTotalDuenger: getActiveTotalDuenger,
  getTotalEinheiten: getTotalEinheiten,
  getTotalDuenger: getTotalDuenger,
  onInputFormat: onInputFormat,
  getActiveReiter: getActiveReiter,
  syncStateFromInputs: syncStateFromInputs,
  toInputValue: toInputValue,
  syncInputsFromState: syncInputsFromState,
});

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