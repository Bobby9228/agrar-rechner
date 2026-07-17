// ============================================================================
// APP-GLOBALS — Single namespace for implicit globals (ADR-001, Issue #278)
//
// Wird vor allen anderen public/js-Dateien geladen. Jedes weitere Modul
// registriert am Dateiende seine Exporte via Object.assign(window.AppGlobals, …).
// Konsumenten greifen dann über AppGlobals.X zu — kein impliziter globaler
// Scope mehr. Direkter Zugriff auf window.state etc. bleibt absichtlich
// für HTML-inline-event-handler (`onclick="state.foo()"`) erlaubt, weil
// HTML-Event-Handler-Attribute im window-Scope evaluiert werden.
//
// ESM-Migration bleibt hinter konkreten Triggern (siehe ADR-001).
//
// `AppGlobals.state` ist ein Live-Alias für die `var state` aus state.js.
// Getter/Setter propagieren Reassignments (loadState,
// Cross-Tab-Sync) in beide Richtungen, sodass `AppGlobals.state` und
// `window.state` immer dasselbe Objekt referenzieren. state.js darf beim
// Registrieren daher NICHT `state: state` mitführen — sonst würde
// Object.assign den Getter mit einem Plain-Property überschreiben.
// ============================================================================

var AppGlobals = window.AppGlobals = {};
Object.defineProperty(AppGlobals, 'state', {
    get: function () { return window.state; },
    set: function (v) { window.state = v; },
    configurable: true,
    enumerable: true
});
