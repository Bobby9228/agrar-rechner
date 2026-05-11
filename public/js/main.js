// ============================================================================
// MAIN.JS — Einstiegspunkt für agrar-rechner
//
// Lädt alle Module und initialisiert die App.
// Reihenfolge: state.js → calculations.js → ui-handlers.js → rendering.js
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

function parseDE(val) {
  if (!val || typeof val !== 'string') return null;
  // Deutsche Zahl: Komma = Dezimaltrennzeichen, Punkt = Tausender
  var cleaned = val.replace(/\./g, '').replace(',', '.');
  var num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function formatEinheit(n) {
  if (!n || isNaN(n)) return '0';
  var rounded = Math.round(n * 10) / 10;
  return String(rounded).replace('.', ',');
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
  _internal: _internal
};

// --- initTheme (runs immediately, before DOMContentLoaded) ---

(function() {
  var savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark');
  } else if (savedTheme === 'light') {
    document.body.classList.remove('dark');
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.classList.add('dark');
  }
  var toggleBtn = document.getElementById('theme_toggle');
  if (toggleBtn) {
    toggleBtn.onclick = function() {
      document.body.classList.toggle('dark');
      localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    };
  }
})();

// --- initUI (after DOMContentLoaded) ---

document.addEventListener('DOMContentLoaded', function() {
  initUI();
  // Input keydown tracking für onInputFormat (physische Tastaturen)
  document.addEventListener('keydown', function(e) {
    _internal.pendingKey = e.key;
  });
  document.addEventListener('input', function() {
    _internal.pendingKey = null;
  });
});