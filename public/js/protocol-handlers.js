// ============================================================================
// PROTOCOL-HANDLERS — Lokales Protokoll-Redesign
//
// Aus ui-handlers.js (Issue #416 Welle 7) in ein eigenes Modul extrahiert.
// Enthält:
//   - setProtocolView
//   - toggleProtocolAccordion
//   - requestLocalProtocolDelete, closeLocalProtocolSheet,
//     confirmLocalProtocolDelete
//   - privater Modulzustand _localProtocolSheetTarget
//
// Lade-Reihenfolge (siehe index.html):
//   drill-handlers.js → protocol-handlers.js → tab-handlers.js
//
// protocol-handlers.js wird NACH drill-handlers.js geladen, damit
// confirmLocalProtocolDelete die AppGlobals-Brücke zu drillRemove und
// drillMachineRemove vorfindet (die defensive Auflösung passiert beim
// Nutzeraufruf; eine spätere Reihenfolge wäre aber gefährlich, sobald
// der defensive Pfad wegfällt). Wird VOR tab-handlers.js geladen —
// konsistentes Wellen-Bild #416: drill → protocol → tab.
//
// Die klassischen Top-Level-Deklarationen bleiben für bestehende
// HTML-/Window-Nutzung erhalten; zusätzlich registriert
// Object.assign(window.AppGlobals, …) die bisherige AppGlobals-API.
// Verbraucher sind render-local-protocol.js (über AppGlobals defensiv),
// index.html (inline onclick="AppGlobals.…") und die Test-Suite
// (direkter window-Aufruf).
//
// Braucht zur Laufzeit (AppGlobals):
//   - state, saveState, appEmit (state.js / main.js)
//   - drillRemove, drillMachineRemove (drill-handlers.js) — erst
//     beim Nutzeraufruf aufgelöst (Funktionsaufruf, nicht Modul-Load)
//   - renderLocalProtocolFields (render-local-protocol.js) — erst
//     beim Nutzeraufruf aufgelöst
//
// Bewusst NICHT in protocol-handlers.js:
//   - Import/Export (buildExportEnvelope, exportData, …) lebt seit
//     Issue #416 Welle 8 in public/js/data-io-handlers.js
//     (geladen zwischen render-local-protocol.js und main.js).
//   - Kultur / Tabs / Settings / Reset / Drill / Input / Render
//
// Verhaltensgleich zur ui-handlers.js-Variante (Issue #416 Welle 7 —
// reine lexikalische Konsolidierung, keine Logik-, State-, Persistenz-,
// DOM-Semantik oder Accessibility-Änderung).
// ============================================================================

    // --- Lokales Protokoll-Redesign — Action-Sheet, View-Toggle, Accordion ---
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
  // Issue #417: Persistenz + Re-Render zentral über den
  // State-Coordinator (eventType PROTOCOL_VIEW_CHANGED).
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
  // Issue #417: Persistenz + Re-Render zentral über den
  // State-Coordinator (eventType PROTOCOL_ACCORDION_TOGGLED).
  AppGlobals.appEmit('PROTOCOL_ACCORDION_TOGGLED', { tabIdx: tabIdx, dateKey: dateKey, cardKey: cardKey });
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

// Register exposed globals on AppGlobals (ADR-001 Schritt 3, Issue #278).
// Damit sind sie sowohl für bestehende HTML-/Window-Nutzung (inline
// onclick="AppGlobals.setProtocolView(...)", render-local-protocol.js
// via AppGlobals defensiv) als auch für Tests erreichbar.
Object.assign(window.AppGlobals, {
  setProtocolView: setProtocolView,
  toggleProtocolAccordion: toggleProtocolAccordion,
  requestLocalProtocolDelete: requestLocalProtocolDelete,
  closeLocalProtocolSheet: closeLocalProtocolSheet,
  confirmLocalProtocolDelete: confirmLocalProtocolDelete,
});
