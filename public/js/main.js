// ============================================================================
// MAIN.JS — Einstiegspunkt für agrar-rechner
//
// Lädt alle Module und initialisiert die App.
// Reihenfolge: state.js → calculations.js → ui-handlers.js → render-tabs.js
//   → render-results.js → render-drill.js → render-dashboard.js → main.js
// ============================================================================

// --- App Constants ---
var APP_VERSION = 'v1.0.0';
var APP_BUILD_DATE = 'Mai 2025';

// --- Format/Parser Utilities (used across modules) ---

function fmt(n) {
  if (n === null || n === undefined || isNaN(n)) return '0';
  // Runde auf 2 Dezimalstellen, dann deutsche Formatierung
  var rounded = Math.round(n * 100) / 100;
  return String(rounded).replace('.', ',');
}

// Issue #262: Rückgabe war 'null' für ungültige/leere Eingaben — hat 207 Tests rot
// gemacht und Null-Werte in den State geschleust. Jetzt wieder 0 mit NaN-Guard.
function parseDE(val) {
  if (typeof val === 'number') return (isNaN(val) ? 0 : val);
  if (!val) return 0;
  var s = val.toString().trim();
  var cleaned = s.replace(/\./g, '').replace(',', '.');
  var num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// Issue #262: Vorherige Version hat die Einheit-Label und den Infinity-Schutz
// verloren. Restored to pre-Phase-3 (vor 398a6f9) Verhalten.
function formatEinheit(n) {
  if (!isFinite(n)) return '—';
  var rounded = Math.round(n * 10) / 10;  // DE Rundung: ab .5 aufrunden
  return rounded.toFixed(1).replace('.', ',') + (rounded === 1.0 ? ' Einheit' : ' Einheiten');
}

// --- Event Emitter ---

var _stateListeners = [];

function appOnStateChange(listener) {
  _stateListeners.push(listener);
  return listener;
}

function appOffStateChange(listener) {
  _stateListeners = _stateListeners.filter(function(l) { return l !== listener; });
}

function appEmit(type, data) {
  _stateListeners.forEach(function(listener) {
    try { listener(type, data); } catch(e) { console.error('state listener error:', e); }
  });
}

function dispatch(action) {
  appEmit(action.type, action.data);
}

// --- App Namespace ---

window.app = {
  onStateChange:  appOnStateChange,
  offStateChange: appOffStateChange,
  emit:           appEmit,
  dispatch:       dispatch,
  invalidateCarryoverCache: function() { _internal.carryoverCache = null; },
  migrateLegacyStorageKeys: migrateLegacyStorageKeys,
  LEGACY_KEY_MAP:            LEGACY_KEY_MAP,
  _internal: _internal
};

// --- Dark Mode (portiert aus Inline-Code Z. 3415-3448) ---
// Key: 'theme' in localStorage (Wert: 'dark' oder 'light', null wenn nicht gesetzt).
// Migration 3→4 in state.js + migrateLegacyStorageKeys() (#235) vereinheitlicht
// 'mais_rechner_theme' → 'theme'.
// initTheme(): Stored Preference → System-Präferenz als Fallback.
// applyTheme(dark): Setzt CSS-Klasse .dark auf <html>, Button-Icon, Meta-Theme-Color.
// toggleTheme(): Liest aktuellen Zustand → toggled → speichert + anwendet.
function getStoredTheme() {
  try { return localStorage.getItem('theme'); } catch(e) { return null; }
}
function setStoredTheme(theme) {
  try { localStorage.setItem('theme', theme); } catch(e) {}
}
function applyTheme(dark) {
  document.documentElement.classList.toggle('dark', dark);       // CSS .dark Klasse
  var btn = document.getElementById('theme_toggle');
  if (btn) btn.textContent = dark ? '☀️' : '🌙';                 // Icon: Hell=Dunkel-Modus, Dunkel=Hell-Modus
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#1a1f16' : '#2d5016');  // Android Status Bar
}
function toggleTheme() {
  var isDark = document.documentElement.classList.contains('dark');
  var next = !isDark;
  setStoredTheme(next ? 'dark' : 'light');
  applyTheme(next);
}
// initTheme — Lädt das gespeicherte Theme oder fällt auf die System-Einstellung zurück.
// Wird einmalig vor DOMContentLoaded aufgerufen (kein async/await, also synchron).
function initTheme() {
  var stored = getStoredTheme();
  if (stored === 'dark') { applyTheme(true); return; }
  if (stored === 'light') { applyTheme(false); return; }
  // Keine gespeicherte Präferenz → Systemeinstellung verwenden
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(prefersDark);
}

// --- Service Worker Registration (portiert aus Inline-Code Z. 3450-3459) ---
if ('serviceWorker' in navigator) {
  try {
    var swReg = navigator.serviceWorker.register('sw.js').catch(function(err) {
      console.warn('SW-Registrierung fehlgeschlagen:', err);
    });
    if (swReg && swReg.then) {
      swReg.then(function(reg) { reg.update(); });
    }
  } catch(swErr) {}
}

// --- initTheme (Inline-Code Z. 3461) ---
// Wird einmalig beim Modul-Load ausgeführt, damit das Theme vor dem ersten
// Render sichtbar ist (kein Flash of Unstyled Theme).
initTheme();

// --- Input keydown tracking für onInputFormat (physische Tastaturen) ---
// (portiert aus Inline-Code Z. 2441-2446). Tests nutzen diese globalen Vars.
var _pendingKey = null;
document.addEventListener('keydown', function(e) {
  _pendingKey = e.key;
});
document.addEventListener('input', function() {
  _pendingKey = null; // Nach jedem Input zurücksetzen, damit kein veralteter Wert hängt
});

document.addEventListener('DOMContentLoaded', function() {
  initUI();
});