// ============================================================================
// STATE-COORDINATOR — Zentrale Mutations-/Persistenz-/Render-Schicht (Issue #417)
//
// Vor Issue #417 verteilte sich die Persistenz (saveState) und die Re-Render-
// Orchestrierung über viele Module: render-tabs.js Subscriber-switch,
// render-drill.js + render-dashboard.js + protocol-handlers.js +
// culture-handlers.js + reset-handlers.js mit direkten saveState()-Calls.
// Folge: kein Single Source of Truth, leicht Doppel-Persistenz oder
// vergessene Persistenz, Render-Funktionen mit nicht dokumentierten
// Nebenwirkungen.
//
// Datenfluss nach Issue #417:
//
//   Benutzeraktion → Handler mutiert AppGlobals.state → appDispatch(type, data)
//     → 1. saveState() falls EVENT_PERSIST[type] === true
//     → 2. _handle<Typ>() ruft die in EVENT_RENDERERS[type] dokumentierten
//            Renderer (und ggf. Inline-Spezialfaelle).
//
// Drei Regeln ab jetzt:
//
//   1. Handler dürfen AppGlobals.state direkt mutieren (kein API-Wrapper).
//   2. Handler rufen KEIN saveState() mehr — Persistenz geht über appDispatch.
//   3. Render-Funktionen sind PRÄSENTATION — kein saveState, kein appEmit.
//
// appEmit (low-level, aus main.js) bleibt für die Cross-Tab-Sync-Bridge
// erhalten und für externe Listener; die zentrale Koordination läuft aber
// über appDispatch, das die EVENT_PLAN-Tabelle konsultiert.
//
// EVENT_PLAN — Single Source of Truth für die Frage "was passiert bei
// welchem Event?". Die Liste ist absichtlich im Code und nicht in einer
// separaten Doku-Datei, damit Renderer/Daten-Flow an einer Stelle
// beieinanderstehen (kein Drift zwischen Code und Doku).
//
// Format: [eventType, [renderer-funktionsnamen]]
//
//   TAB_CHANGED             | syncInputs, renderTabs, renderResults, renderView
//   TAB_ADDED               | syncInputs, renderTabs, renderView
//   TAB_REMOVED             | syncInputs, renderTabs, renderResults, renderView
//   TAB_RENAMED             | renderTabs
//   TAB_RESET               | renderTabs, renderResults, renderView
//                                          (+ inline: Inputs/Errors/Sections auf Leerzustand)
//   RESET_ALL               | renderTabs, renderResults, renderView,
//                                          renderKulturBadge, _renderKulturEmpfehlung,
//                                          openKulturFirstRun
//   ENTRY_CHANGED           | renderTabs, renderResults, renderView
//                                          (+ detail: renderLocalProtocol wenn Protokoll-View,
//                                           renderDashboard wenn Dashboard offen)
//   SETTINGS_CHANGED        | renderResults
//   VIEW_CHANGED            | renderTabs, renderView
//                                          (+ detail: renderDrillTabList wenn Protokoll-View)
//   PROTOCOL_VIEW_CHANGED   | renderLocalProtocol
//   PROTOCOL_ACCORDION_TOGGLED | renderLocalProtocolFields
//   DRILL_ENTRY_ADDED       | renderDrillTabList, renderResults, drillCalcAll
//                                          (+ detail: renderLocalProtocol wenn Protokoll-View)
//   DRILL_ENTRY_REMOVED     | renderDrillTabList, renderResults, drillCalcAll
//                                          (+ detail: renderLocalProtocol wenn Protokoll-View)
//   DRILL_PRIORITY_CHANGED  | drillCalcAll
//   DRILL_DONE_CHANGED      | drillCalcAll, renderTabs, renderResults, renderView
//                                          (+ detail: renderLocalProtocol wenn Protokoll-View)
//   DASHBOARD_OPENED        | renderTabs (Nav-Indikator), renderDashboard (im Caller)
//   DASHBOARD_CLOSED        | renderTabs (Nav-Indikator)
//   KULTUR_CHANGED          | renderKulturBadge, _renderKulturEmpfehlung, renderResults
//
// Hinweis DASHBOARD_*: das eigentliche openDashboard()/closeDashboard()
// DASHBOARD-Sheet bleibt im Caller (openDashboard) — der Coordinator
// re-rendert nur die Top-Level-Nav, damit der "Übersicht"-Button korrekt
// hervorgehoben wird.
//
// Sonderfälle NICHT im Plan:
//   - Cross-Tab-Sync (storage-Event) läuft weiter direkt in render-tabs.js
//     initUI (assignt AppGlobals.state remote, ruft Renderer direkt, KEIN
//     appDispatch — sonst Endlosschleife via storage-Event-Broadcast).
//   - Daten-Import (data-io-handlers.js commitImportedState) macht
//     saveState() selbst, um atomar persistieren-und-rendern zu können.
//     Import ist eine vollständige Zustandsübernahme, kein einzelner
//     Event; er umgeht den Coordinator mit Absicht.
//
// Braucht zur Laufzeit (AppGlobals):
//   - saveState (state.js)
//   - syncInputsFromState, getActiveReiter (input-handlers.js)
//   - renderTabs, renderResults, renderView, _renderKulturEmpfehlung
//     (render-tabs.js) — defensiv aufgelöst
//   - renderDrillTabList, drillCalcAll (render-drill.js / drill-handlers.js) — defensiv
//   - renderDashboard, openDashboard (render-dashboard.js) — defensiv
//   - renderLocalProtocol, renderLocalProtocolFields (render-local-protocol.js) — defensiv
//   - renderKulturBadge, openKulturFirstRun, closeKulturFirstRun
//     (culture-handlers.js) — defensiv
//   - invalidateCarryoverCache (calculations.js) — defensiv
//
// Das Modul wird zwischen render-tabs.js und render-results.js geladen,
// damit render-tabs.js initUI die AppGlobals-Brücke vorfindet. Tests laden
// es zwischen render-tabs.js und render-results.js (siehe helpers.js).
// ============================================================================

// --- Renderer-Lookup (defensiv, Funktionsaufruf-Zeitpunkt) ---
//
// Diese Helfer umschließen die AppGlobals-Auflösung, damit der Coordinator
// jeden Renderer mit `try/catch` aufrufen kann. Hintergrund: in der Test-
// und Modul-Initialisierung kann ein Renderer kurzzeitig undefined sein —
// ein einzelner fehlender Renderer darf NICHT den ganzen Subscriber-Call
// abbrechen.

function _tryCall(name) {
  var fn = AppGlobals[name];
  if (typeof fn !== 'function') return false;
  try {
    fn();
    return true;
  } catch (e) {
    console.error('state-coordinator: renderer "' + name + '" threw:', e);
    return false;
  }
}

function _tryCallEach(names) {
  for (var i = 0; i < names.length; i++) _tryCall(names[i]);
}

// --- EVENT_PLAN: Renderer-Liste pro Eventtyp ---
//
// Jeder dokumentierte Eventtyp persistiert IMMER (kein persist-Flag —
// das wäre für 100 % der Fälle informationslos). saveState wird in
// appDispatch() unbedingt gerufen, sobald der Plan-Eintrag existiert.
//
// Inline-Spezialfälle pro Eventtyp leben als optionales `inline`-Property
// und werden nach den dokumentierten Renderern ausgeführt.

var EVENT_PLAN = {
  TAB_CHANGED:              { renderers: ['syncInputsFromState', 'renderTabs', 'renderResults', 'renderView'] },
  TAB_ADDED:                { renderers: ['syncInputsFromState', 'renderTabs', 'renderView'] },
  TAB_REMOVED:              { renderers: ['syncInputsFromState', 'renderTabs', 'renderResults', 'renderView'] },
  TAB_RENAMED:              { renderers: ['renderTabs'] },
  TAB_RESET:                { renderers: ['renderTabs', 'renderResults', 'renderView'], inline: _inlineAfterTabReset },
  RESET_ALL:                { renderers: ['renderTabs', 'renderResults', 'renderView', 'renderKulturBadge', '_renderKulturEmpfehlung'], inline: _inlineAfterResetAll },
  ENTRY_CHANGED:            { renderers: ['renderTabs', 'renderResults', 'renderView'], inline: _inlineAfterEntryChanged },
  SETTINGS_CHANGED:         { renderers: ['renderResults'] },
  VIEW_CHANGED:             { renderers: ['renderTabs', 'renderView'], inline: _inlineAfterViewChanged },
  PROTOCOL_VIEW_CHANGED:    { renderers: ['renderLocalProtocol'] },
  PROTOCOL_ACCORDION_TOGGLED: { renderers: ['renderLocalProtocolFields'] },
  DRILL_ENTRY_ADDED:        { renderers: ['renderDrillTabList', 'renderResults', 'drillCalcAll'], inline: _inlineAfterDrillChange },
  DRILL_ENTRY_REMOVED:      { renderers: ['renderDrillTabList', 'renderResults', 'drillCalcAll'], inline: _inlineAfterDrillChange },
  DRILL_PRIORITY_CHANGED:   { renderers: ['drillCalcAll'] },
  DRILL_DONE_CHANGED:       { renderers: ['drillCalcAll', 'renderTabs', 'renderResults', 'renderView'], inline: _inlineAfterDrillChange },
  DASHBOARD_OPENED:         { renderers: ['renderTabs'] },
  DASHBOARD_CLOSED:         { renderers: ['renderTabs'] },
  KULTUR_CHANGED:           { renderers: ['renderKulturBadge', '_renderKulturEmpfehlung', 'renderResults'] }
};

// --- Inline-Spezialfälle (Sonderlogik pro Eventtyp) ---

// Detail-Rendering für ENTRY_CHANGED:
//   - Im Protokoll-Modus: lokales Protokoll-Refresh (Gesamtbilanz/Schläge)
//   - Dashboard offen: Dashboard muss frische Werte sehen.
function _inlineAfterEntryChanged(data) {
  if (AppGlobals.state.activeView === 'protokoll') {
    _tryCall('renderLocalProtocol');
  }
  var dashSheet = document.getElementById('dashboard_sheet');
  if (dashSheet && dashSheet.classList.contains('open')) {
    _tryCall('renderDashboard');
  }
}

// Detail-Rendering für VIEW_CHANGED:
//   - activeView === 'protokoll' → renderDrillTabList (öffnet das Drill-Protokoll).
function _inlineAfterViewChanged(data) {
  if (AppGlobals.state.activeView === 'protokoll') {
    _tryCall('renderDrillTabList');
  }
}

// Detail-Rendering für TAB_RESET: Felder + Fehlermeldungen + Sektionen
// zurück in den Leerzustand. Diese DOM-Aufräumarbeit war vor #417 inline
// im render-tabs.js Subscriber und wanderte mit dem Move in den Coordinator.
function _inlineAfterTabReset(data) {
  var resultsEl = document.getElementById('results');
  if (resultsEl) resultsEl.style.display = 'none';
  var drillSection = document.getElementById('drill_section');
  if (drillSection) drillSection.style.display = 'none';
  var errHektar = document.getElementById('err_hektar');
  if (errHektar) errHektar.textContent = '';
  var errKoerner = document.getElementById('err_koerner');
  if (errKoerner) errKoerner.textContent = '';
  var hektar = document.getElementById('hektar');
  if (hektar) hektar.style.borderColor = '';
  var koerner = document.getElementById('koerner');
  if (koerner) koerner.style.borderColor = '';
}

// Detail-Rendering für RESET_ALL: Kultur-UI konsistent nachziehen, damit
// der Landwirt nach "Daten zurücksetzen" wieder die Erstauswahl trifft.
function _inlineAfterResetAll(data) {
  if (!AppGlobals.state.erstauswahlDone && !AppGlobals.state.kultur) {
    _tryCall('openKulturFirstRun');
  } else {
    _tryCall('closeKulturFirstRun');
  }
}

// Detail-Rendering für DRILL_* (außer PRIORITY): im Protokoll-Modus
// zusätzlich das lokale Protokoll-Refresh triggern.
function _inlineAfterDrillChange(data) {
  if (AppGlobals.state.activeView === 'protokoll') {
    _tryCall('renderLocalProtocol');
  }
}

// --- appDispatch: der zentrale Einstiegspunkt ---

// Persistenz + Renderer-Plan zentral ausführen. Idempotent gegen
// Doppelaufrufe (z. B. wenn initUI nach Cross-Tab-Sync selbst auch
// rendert — appDispatch würde nur ein zweites Mal dieselben Renderer
// rufen, was OK ist weil sie ohnehin billig sind und idempotent
// rendern).
function appDispatch(type, data) {
  if (typeof type !== 'string' || !type) return;
  var plan = EVENT_PLAN[type];
  if (!plan) {
    // Unbekanntes Event: kein Plan, kein Persist, kein Render. Defensive
    // default — vorher hat der Switch im Subscriber das Event einfach
    // ignoriert. Konsumenten sollen weiterhin appEmit für unbekannte
    // Events benutzen können.
    return;
  }
  if (typeof AppGlobals.saveState === 'function') {
    AppGlobals.saveState();
  }
  if (plan.renderers && plan.renderers.length) {
    _tryCallEach(plan.renderers);
  }
  if (typeof plan.inline === 'function') {
    try { plan.inline(data); } catch (e) { console.error('state-coordinator: inline handler for "' + type + '" threw:', e); }
  }
}

// appOnStateChange-Listener, der den Coordinator an den bestehenden
// Event-Channel koppelt. Wird EINMAL in initUI() registriert (Issue #417).
function _coordinatorListener(type, data) {
  appDispatch(type, data);
}

// Rückgabe der Event-Plan-Tabelle (read-only-Kopie). Für Tests +
// Doku-Tools, die den Plan programmatisch inspizieren wollen.
// #448 Welle 1: persist wurde als informationsloses Flag entfernt —
// die Rückgabe enthält nur noch `renderers` (immer vorhanden) und
// `inline` (optional, wenn der Eventtyp einen Inline-Spezialfall hat).
function getEventPlan() {
  var out = {};
  for (var key in EVENT_PLAN) {
    if (!Object.prototype.hasOwnProperty.call(EVENT_PLAN, key)) continue;
    var entry = EVENT_PLAN[key];
    var plan = { renderers: entry.renderers.slice() };
    if (typeof entry.inline === 'function') plan.inline = entry.inline;
    out[key] = plan;
  }
  return out;
}

// Register exposed globals on AppGlobals (ADR-001 Schritt 3, Issue #278).
Object.assign(window.AppGlobals, {
  appDispatch: appDispatch,
  getEventPlan: getEventPlan,
  // _coordinatorListener ist die appOnStateChange-Brücke: initUI ruft
  // AppGlobals.registerStateCoordinator() EINMAL auf, danach fließt
  // jeder appEmit() durch appDispatch().
  //
  // Idempotenz (Issue #417 Abnahmekriterium "kein Event wird doppelt
  // persistiert"): Ein zweiter Aufruf darf KEINEN zweiten Listener
  // registrieren — sonst würde jedes appEmit doppelt persistieren und
  // doppelt rendern. Hintergrund: initUI läuft bei Tests manuell UND
  // über den DOMContentLoaded-Handler aus main.js; in der echten App
  // schützt diese Absicherung gegen versehentliche Doppel-Init.
  registerStateCoordinator: function() {
    if (AppGlobals._stateCoordinatorRegistered) return;
    AppGlobals._stateCoordinatorRegistered = true;
    AppGlobals.appOnStateChange(_coordinatorListener);
  }
});
