// ============================================================================
// RENDERING — aufgeteilt in 4 Module (Issue #212)
//
// Früher: ~732 Zeilen in einer Datei.
// Jetzt:
//   js/render-tabs.js       — Tab-Verwaltung, View-Toggle, App-Init
//   js/render-results.js    — Ergebnis-Karte, Mini-Footer, Hauptergebnis
//   js/render-drill.js      — Drill-Protokoll (Tab-Liste, Summary, Log)
//   js/render-dashboard.js  — Dashboard-Übersicht + open/closeDashboard
//
// Lade-Reihenfolge (laut index.html):
//   state.js → calculations.js → ui-handlers.js
//     → render-tabs.js → render-results.js → render-drill.js → render-dashboard.js
//     → main.js
// ============================================================================
