// ============================================================================
// MAIN.JS — Einstiegspunkt für agrar-rechner
//
// Lädt alle Module und initialisiert die App.
// Reihenfolge: state.js → calculations.js → ui-handlers.js → render-tabs.js
//   → render-results.js → render-drill.js → render-dashboard.js → main.js
// ============================================================================

// --- App Constants ---
var APP_VERSION = 'v1.1.6';
var APP_BUILD_DATE = 'August 2026';

// --- Format/Parser Utilities (used across modules) ---
//
// Issue #9: fmt()/fmtCompact() sind nach calculations.js umgezogen, weil sie
// pure Funktionen sind und nicht von App-Bootstrap abhängen. parseDE() und
// formatEinheit() bleiben hier (werden vom Input-Format-Pfad gebraucht, der
// im App-Init-Block läuft).

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
  var rounded = AppGlobals.round6(n);
  return AppGlobals.fmtEinheit(rounded) + (Math.round(rounded * 1000) / 1000 === 1 ? ' Einheit' : ' Einheiten');
}

// --- Event Emitter ---

var _stateListeners = [];

function appOnStateChange(listener) {
  _stateListeners.push(listener);
  return listener;
}

function appEmit(type, data) {
  _stateListeners.forEach(function(listener) {
    try { listener(type, data); } catch(e) { console.error('state listener error:', e); }
  });
}

// --- App Namespace ---
// Hinweis: nur die Members, die von Tests (tests/44) referenziert werden,
// bleiben hier. Die anderen (onStateChange, emit, etc.) liegen ausschließlich
// auf AppGlobals (Issue #278, ADR-001).
window.app = {
  migrateLegacyStorageKeys: AppGlobals.migrateLegacyStorageKeys,
  LEGACY_KEY_MAP:            AppGlobals.LEGACY_KEY_MAP
};

// --- Dark Mode (portiert aus Inline-Code Z. 3415-3448) ---
// Key: 'theme' in localStorage (Wert: 'dark' oder 'light', null wenn nicht
// gesetzt). Phase-3-Migration hat den Key vereinheitlicht (vorher
// 'mais_rechner_theme' oder '_lv:4'-Migration).
function getStoredTheme() {
  try {
    var v = localStorage.getItem('theme');
    if (v !== null) return v;
    // Migration: ältere Keys
    v = localStorage.getItem('mais_rechner_theme');
    if (v !== null) return v;
    return null;
  } catch(e) { return null; }
}
function setStoredTheme(theme) {
  try {
    localStorage.setItem('theme', theme);
    // Migration: Auch ins Legacy-Key schreiben, damit Tests/Contracts, die
    // noch 'mais_rechner_theme' lesen (Phase-3-Migration), weiterhin
    // konsistente Werte sehen.
    localStorage.setItem('mais_rechner_theme', theme);
  } catch(e) {}
}
function applyTheme(dark) {
  document.documentElement.classList.toggle('dark', dark);       // CSS .dark Klasse
  var btns = document.querySelectorAll('.theme-toggle');
  btns.forEach(function(btn) { btn.textContent = dark ? '☀️' : '🌙'; });  // Icon: Hell=Dunkel-Modus, Dunkel=Hell-Modus
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
  AppGlobals.initUI();
});

// --- initUIBindings (Issue #418 Welle 1+) ---
//
// Zentrale Registrierung aller DOM-Event-Handler, die NICHT von dynamisch
// erzeugten Elementen abhängen. Wird aus initUI() (render-tabs.js)
// aufgerufen — sowohl in Production (main.js DOMContentLoaded → initUI)
// als auch in jsdom (tests/helpers.js → initUI). Idempotent: ein zweiter
// Aufruf registriert KEINE doppelten Listener.
//
// Bewusst NICHT hier:
//   - Dynamisch erzeugte Elemente (Tabs, Drill-Inputs, Protokoll-Entries):
//     werden per addEventListener beim Erzeugen gebunden (render-tabs.js,
//     render-drill.js, render-local-protocol.js).
//   - Lokales-Protokoll-Sheet-Backdrop + Escape: lebt in render-local-
//     protocol.js (Modul-Load, weil die Elemente zu Modul-Load-Zeit
//     bereits existieren und die Bindings über die App-Lebenszeit
//     stabil sind).
//   - data_export_btn / data_import_btn / data_import_file /
//     import_modal_* / import_overlay: bleiben in initDataExportImport
//     (data-io-handlers.js) — werden in Welle 4 von dort übernommen.
function _bindClick(id, handler) {
  var el = document.getElementById(id);
  if (el && typeof handler === 'function') {
    el.addEventListener('click', handler);
  }
}
// Issue #418 Welle 2: input/change/blur-Timing 1:1 erhalten.
//   oninput          → Live-Formatierung (onInputFormat), ohne State-Write
//   onchange + onblur → State-Write (onInputHektar/…/einheitGroesseUpdate/…).
//                      blur UND change sind absichtlich beide gebunden —
//                      Browser feuern je nach Focus-Pfad nur eins der beiden
//                      Events (Mobile: blur; Desktop+Tab: change → blur).
//
// Wichtig (Migration on*="onInputX(this)" → addEventListener): der
// Inline-Handler bekam das Element als `this` zugespielt, der
// addEventListener-Aufruf bekommt das Event als ersten Parameter.
// Wir wrappen den Handler daher in eine Closure, die das Element
// fest übergibt — sonst würde z.B. onInputHektar(undefined) aufgerufen
// und parseDE(undefined) → 0 den State zurückschreiben.
function _bindNumberInput(id, mode, stateHandler) {
  var el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', function(e) {
    if (mode === 'integer') AppGlobals.onInputFormat(el, 'integer', e);
    else AppGlobals.onInputFormat(el, 'decimal', e);
  });
  if (typeof stateHandler === 'function') {
    el.addEventListener('change', function() { stateHandler(el); });
    el.addEventListener('blur', function() { stateHandler(el); });
  }
}
function initUIBindings() {
  if (AppGlobals._uiBindingsRegistered) return;
  AppGlobals._uiBindingsRegistered = true;

  // Header / Navigation
  // Theme-Toggle: es gibt mehrere .theme-toggle-Buttons (Header + Dashboard).
  // querySelectorAll + forEach deckt beide mit einem Aufruf ab.
  var themeToggles = document.querySelectorAll('.theme-toggle');
  for (var ti = 0; ti < themeToggles.length; ti++) {
    themeToggles[ti].addEventListener('click', toggleTheme);
  }
  _bindClick('dashboard_open_btn', AppGlobals.openDashboard);
  _bindClick('nav_rechner', AppGlobals.switchToRechner);
  _bindClick('nav_protokoll', AppGlobals.switchToProtokoll);
  _bindClick('nav_uebersicht', AppGlobals.openDashboard);
  _bindClick('protokoll_tab_btn', AppGlobals.switchToProtokoll);
  _bindClick('dashboard_overlay', AppGlobals.closeDashboard);

  // Save-Error-Banner: Schließen-Button (Issue #243 — Inline-Handler
  // entfernt). Es gibt genau einen <button> innerhalb des Banners.
  var saveBanner = document.getElementById('save_error_banner');
  if (saveBanner) {
    var saveBannerClose = saveBanner.querySelector('button');
    if (saveBannerClose) saveBannerClose.addEventListener('click', AppGlobals.dismissSaveError);
  }

  // Formulare — Hektar/Koerner/Duenger/Notizen/IST-Fläche/Einheitsgröße/Fahrgassenbreite.
  // Timing ist kritisch: input feuert pro Tastendruck (Format), change/blur
  // feuern bei Fokus-Wechsel (State-Write). Browser-spezifisch feuert manchmal
  // nur change, manchmal nur blur → wir binden BEIDE, damit der State auf
  // jedem Pfad konsistent landet. Issue #262 / #416 / #418.
  _bindNumberInput('hektar', 'decimal', AppGlobals.onInputHektar);
  _bindNumberInput('koerner', 'integer', AppGlobals.onInputKoerner);
  _bindNumberInput('duenger', 'decimal', AppGlobals.onInputDuenger);
  _bindNumberInput('ist_hektar', 'decimal', AppGlobals.onInputIstHektar);
  _bindNumberInput('koerner_pro_einheit', 'integer', AppGlobals.einheitGroesseUpdate);
  _bindNumberInput('fahrgassen_breite', 'decimal', AppGlobals.fahrgassenUpdate);

  // Notizen: nur input (textarea feuert keinen change auf Autocomplete-Tap).
  var notizenEl = document.getElementById('notizen');
  if (notizenEl) notizenEl.addEventListener('input', AppGlobals.onInputNotizen);

  // Settings-Toggles: reine click-Handler, kein input.
  _bindClick('einheit_groesse_toggle', AppGlobals.einheitGroesseToggle);
  _bindClick('fahrgassen_toggle', AppGlobals.fahrgassenToggle);

  // Drill-Eingabefelder + "+ Einfüllen" (Welle 3).
  // drill_einheit / drill_duenger feuern drillCalcDebounced + Live-Format.
  // drill_hektar feuert NUR Live-Format (kein State-Write — der Wert wird
  // erst beim "+ Einfüllen"-Klick in den Entry übernommen, siehe
  // _parseDrillInputs in drill-handlers.js).
  function _bindDrillInput(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', function(e) {
      if (id === 'drill_einheit' || id === 'drill_duenger') {
        AppGlobals.drillCalcDebounced();
      }
      AppGlobals.onInputFormat(el, 'decimal', e);
    });
  }
  _bindDrillInput('drill_einheit');
  _bindDrillInput('drill_duenger');
  _bindDrillInput('drill_hektar');
  // "+ Einfüllen" — der statische Button im HTML. Innerhalb von
  // .drill_mask; nur einer existiert. Dynamische Drill-Buttons
  // (prioBtn, doneBtn, removeBtn) werden in render-drill.js beim
  // Erzeugen gebunden — siehe Welle 5.
  var drillAddBtn = document.querySelector('#drill_mask .btn-add');
  if (drillAddBtn) drillAddBtn.addEventListener('click', AppGlobals.drillAdd);

  // Footer Reset / Daten-I/O
  _bindClick('footer_reset_btn', AppGlobals.openResetModal);
  // Footer Daten-I/O (data_export_btn, data_import_btn, data_import_file,
  // import_modal_*) bleibt in initDataExportImport (data-io-handlers.js).
  // Welle 4 zieht die letzten drei hierher um — danach bleibt in
  // initDataExportImport nur noch die Konstanten/Funktionen-Registrierung
  // übrig (die Buttons selbst wandern hier in initUIBindings).
  _bindClick('import_modal_x', AppGlobals.cancelImportFromModal);
  _bindClick('import_modal_cancel', AppGlobals.cancelImportFromModal);
  _bindClick('import_modal_confirm', AppGlobals.confirmImportFromModal);
  var importOverlay = document.getElementById('import_overlay');
  if (importOverlay) {
    importOverlay.addEventListener('click', function(e) {
      if (e && e.target && e.target.id === 'import_overlay') {
        AppGlobals.cancelImportFromModal();
      }
    });
  }

  // Reset-Modal
  _bindClick('reset_modal_x', AppGlobals._onCancel);
  _bindClick('reset_modal_cancel', AppGlobals._onCancel);
  _bindClick('reset_modal_tab', AppGlobals._onResetTab);
  _bindClick('reset_modal_confirm_all', AppGlobals._onResetAll);
  // Der zweite "Abbrechen"-Button innerhalb des Reset-Modals (ohne ID
  // im Markup) — querySelector innerhalb des Modals.
  var resetModal = document.getElementById('reset_modal');
  if (resetModal) {
    var cancelButtons = resetModal.querySelectorAll('button.reset-modal-cancel');
    for (var rci = 0; rci < cancelButtons.length; rci++) {
      cancelButtons[rci].addEventListener('click', AppGlobals._onCancel);
    }
  }
  // reset_overlay: Klick auf Overlay schließt das Modal (nur wenn direkt
  // auf das Overlay geklickt, nicht auf ein Kind-Element — _onOverlayClick
  // enthält genau diese Logik).
  var resetOverlay = document.getElementById('reset_overlay');
  if (resetOverlay) {
    resetOverlay.addEventListener('click', AppGlobals._onOverlayClick);
  }

  // Kultur-Auswahl (Erststart + Wechsel)
  _bindClick('kultur_choice_mais', function() { AppGlobals.chooseKultur('mais'); });
  _bindClick('kultur_choice_raps', function() { AppGlobals.chooseKultur('raps'); });
  _bindClick('kultur_choice_sonstiges', function() { AppGlobals.chooseKultur('sonstiges'); });
  _bindClick('kultur_badge_change', AppGlobals.requestChangeKultur);
  _bindClick('kultur_confirm_cancel', AppGlobals.cancelChangeKultur);
  _bindClick('kultur_confirm_cancel_btn', AppGlobals.cancelChangeKultur);
  _bindClick('kultur_confirm_ok', AppGlobals.confirmChangeKultur);
  var kulturChangeSelect = document.getElementById('kultur_change_select');
  if (kulturChangeSelect) {
    kulturChangeSelect.addEventListener('change', function(e) {
      AppGlobals._onKulturChangeSelectChange(e.target);
    });
  }

  // Lokales Protokoll — View-Toggle + Action-Sheet
  _bindClick('lp_view_fields_btn', function() { AppGlobals.setProtocolView('fields'); });
  _bindClick('lp_view_machine_btn', function() { AppGlobals.setProtocolView('machine'); });
  _bindClick('local_protocol_sheet_delete', AppGlobals.confirmLocalProtocolDelete);
  _bindClick('local_protocol_sheet_cancel', AppGlobals.closeLocalProtocolSheet);
}

// Register exposed globals on AppGlobals (ADR-001 Schritt 3, Issue #278).
Object.assign(window.AppGlobals, {
  APP_VERSION: APP_VERSION,
  APP_BUILD_DATE: APP_BUILD_DATE,
  parseDE: parseDE,
  formatEinheit: formatEinheit,
  appOnStateChange: appOnStateChange,
  appEmit: appEmit,
  getStoredTheme: getStoredTheme,
  setStoredTheme: setStoredTheme,
  applyTheme: applyTheme,
  toggleTheme: toggleTheme,
  initTheme: initTheme,
  initUIBindings: initUIBindings,
});