// ============================================================================
// TAB-HANDLERS — Tab-/Ansichtsverwaltung
//
// Aus ui-handlers.js (Issue #416 Welle 2) in ein eigenes Modul extrahiert.
// Enthält:
//   - addReiter, removeReiter, _closeDashboardIfOpen,
//     switchReiter, switchToProtokoll, switchToRechner, renameReiter
//
// Lade-Reihenfolge (siehe index.html):
//   ui-handlers.js → drill-handlers.js → tab-handlers.js → render-tabs.js
//
// Braucht zur Laufzeit (AppGlobals):
//   - state, appEmit, isValidCultureKey, getDefaultKoernerProEinheit
//     (state.js / culture.js)
//   - syncStateFromInputs (input-handlers.js)
//   - _syncActiveTabLock (drill-handlers.js; deshalb wird dieses Modul
//     nach drill-handlers.js geladen)
//   - renderDrillTabList (render-drill.js) und closeDashboard
//     (render-dashboard.js), beide erst beim späteren Nutzeraufruf aufgelöst
//
// _closeDashboardIfOpen ist ein modul-interner Helper (Underscore-Präfix):
// er wird ausschließlich von switchReiter/switchToProtokoll/switchToRechner
// aufgerufen und ist nicht Teil der öffentlichen API.
// ============================================================================

// Schließt die Übersicht (Dashboard), falls offen. Übersicht ist eine
// vollflächige Ansicht wie Rechner/Protokoll (kein Popup mehr) — beim
// Wechsel zu einer der anderen Ansichten muss sie daher mit verlassen werden,
// sonst bliebe sie sichtbar über der neu gewählten Ansicht liegen.
function _closeDashboardIfOpen() {
  var sheet = document.getElementById('dashboard_sheet');
  if (sheet && sheet.classList.contains('open') && typeof AppGlobals.closeDashboard === 'function') {
    AppGlobals.closeDashboard();
  }
}

function addReiter() {
  AppGlobals.syncStateFromInputs();
  // Neue Tabs erben koerner/duenger vom zuvor aktiven Reiter (Test-RED
  // tests/tab-management.test.js): der aktive Reiter ist nach
  // syncStateFromInputs() auf Stand, also direkt aus state.reiter lesen.
  var sourceTab = AppGlobals.state.reiter[AppGlobals.state.activeReiter];
  var maxIdx = 0;
  AppGlobals.state.reiter.forEach(function(r, i) { var m = parseInt(r.name.replace(/\D+/g, '')); if (!isNaN(m) && m > maxIdx) maxIdx = m; });
  // Per-Tab Einheitsgröße: neuen Schlag mit aktuellem Kultur-Standard
  // initialisieren. Wenn eine gültige Kultur gesetzt ist, gilt der
  // Profil-Default (Mais=DEFAULT_KOERNER_PRO_EINHEIT, Raps=1.500.000,
  // Sonstiges=0). Ohne gültige Kultur fällt es auf den globalen
  // koernerProEinheit zurück (Mais-Backstop=DEFAULT_KOERNER_PRO_EINHEIT)
  // — damit Frisch-Installs nicht im "Sonstiges"-Pfad landen.
  var newKpe;
  if (AppGlobals.isValidCultureKey(AppGlobals.state.kultur)) {
    newKpe = AppGlobals.getDefaultKoernerProEinheit(AppGlobals.state.kultur);
  } else if (typeof AppGlobals.state.koernerProEinheit === 'number'
             && AppGlobals.state.koernerProEinheit > 0) {
    newKpe = AppGlobals.state.koernerProEinheit;
  } else {
    newKpe = AppGlobals.DEFAULT_KOERNER_PRO_EINHEIT;
  }
  AppGlobals.state.reiter.push({ name: 'Schlag ' + (maxIdx + 1), hektar: 0, istHektar: 0, koerner: sourceTab.koerner, duenger: sourceTab.duenger, entries: [], done: false, fahrgassenEnabled: AppGlobals.state.fahrgassenEnabled, fahrgassenBreite: AppGlobals.state.fahrgassenBreite, koernerProEinheit: newKpe, notizen: '' });
  AppGlobals.state.activeReiter = AppGlobals.state.reiter.length - 1;
  AppGlobals.state.drillPriorities[AppGlobals.state.activeReiter] = 1;
  AppGlobals.appEmit('TAB_ADDED', { tabIdx: AppGlobals.state.activeReiter });
  document.getElementById('hektar').focus();
}

function removeReiter(idx) {
  if (AppGlobals.state.reiter.length <= 1) return;
  AppGlobals.syncStateFromInputs();
  AppGlobals.state.reiter.splice(idx, 1);
  if (idx < AppGlobals.state.activeReiter) {
    AppGlobals.state.activeReiter -= 1; // Tab before active was removed — shift active left
  } else if (AppGlobals.state.activeReiter >= AppGlobals.state.reiter.length) {
    AppGlobals.state.activeReiter = AppGlobals.state.reiter.length - 1; // Active tab removed — clamp to last
  }
  var newPriorities = {};
  Object.keys(AppGlobals.state.drillPriorities).forEach(function(key) {
    var k = parseInt(key, 10);
    if (k < idx) newPriorities[k] = AppGlobals.state.drillPriorities[k];
    else if (k > idx) newPriorities[k - 1] = AppGlobals.state.drillPriorities[k];
  });
  AppGlobals.state.drillPriorities = newPriorities;
  AppGlobals.appEmit('TAB_REMOVED', { tabIdx: idx });
}

function switchReiter(idx) {
  if (idx === AppGlobals.state.activeReiter && AppGlobals.state.activeView !== 'protokoll') return;
  AppGlobals.syncStateFromInputs();
  AppGlobals.state.activeReiter = idx;
  // Beim Tab-Wechsel aus der Protokoll-Ansicht zurück in die Feld-Ansicht
  // (Issue #291 View-Toggle-Pattern: Tab-Klick = Feld-Tab zeigen, Protokoll-Tab
  // ist kein eigener Reiter sondern ein View-Toggle).
  AppGlobals.state.activeView = null;
  _closeDashboardIfOpen();
  AppGlobals.appEmit('TAB_CHANGED', { tabIdx: idx });
  // Issue #377 (PR #379 Follow-up): TAB_CHANGED triggert im render-tabs-Subscriber
  // KEIN drillCalcAll — also würde der globale Lock auf drill_einheit / drill_duenger /
  // drill_hektar am vorherigen activeReiter verkleben. Direkt hier syncen ist
  // minimal-invasiv (kein Event-Coupling, kein Re-Render, vgl. Review-Variante A).
  AppGlobals._syncActiveTabLock();
}

function switchToProtokoll() {
  AppGlobals.syncStateFromInputs();
  _closeDashboardIfOpen();
  if (AppGlobals.state.activeView === 'protokoll') {
    AppGlobals.state.activeView = null;
  } else {
    AppGlobals.state.activeView = 'protokoll';
    AppGlobals.renderDrillTabList();
  }
  AppGlobals.appEmit('VIEW_CHANGED', { view: AppGlobals.state.activeView });
}

// Für die persistente untere Navigation (Issue: UI-Angleichung an Demo).
// Bringt die Ansicht zurück auf "Rechner": verlässt die Protokoll-Ansicht
// (falls aktiv) und schließt das Dashboard-Sheet (falls offen). Reine
// View-Navigation, ändert keine Berechnungswerte.
function switchToRechner() {
  AppGlobals.syncStateFromInputs();
  if (AppGlobals.state.activeView === 'protokoll') {
    AppGlobals.state.activeView = null;
    AppGlobals.appEmit('VIEW_CHANGED', { view: null });
  }
  _closeDashboardIfOpen();
}

function renameReiter(idx, name) {
  AppGlobals.state.reiter[idx].name = name.substring(0, 20);
  AppGlobals.appEmit('TAB_RENAMED', { tabIdx: idx });
}

// Register exposed globals on AppGlobals (ADR-001 Schritt 3, Issue #278).
// Damit sind sie sowohl für bestehende HTML-/Window-Nutzung (onclick="addReiter()")
// als auch für AppGlobals-Konsumenten (render-tabs, Tests) erreichbar.
Object.assign(window.AppGlobals, {
  addReiter: addReiter,
  removeReiter: removeReiter,
  switchReiter: switchReiter,
  switchToProtokoll: switchToProtokoll,
  switchToRechner: switchToRechner,
  renameReiter: renameReiter,
});
