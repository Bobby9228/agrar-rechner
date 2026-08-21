// ============================================================================
// INPUT-HANDLERS — Eingaben, Formatierung und State-Synchronisierung
//
// Aus ui-handlers.js (Issue #416 Welle 6) in ein eigenes Modul extrahiert.
// Enthält:
//   - onInputHektar, onInputIstHektar, onInputKoerner, onInputDuenger
//   - onInputNotizen
//   - getKornerGesamt, getActiveTotalEinheiten, getActiveTotalDuenger
//   - getTotalEinheiten, getTotalDuenger
//   - onInputFormat
//   - getActiveReiter
//   - syncStateFromInputs, toInputValue, syncInputsFromState
//
// Lade-Reihenfolge (siehe index.html):
//   ui-handlers.js → input-handlers.js → settings-handlers.js
//
// Bewusst NICHT extrahiert (bleiben in ui-handlers.js):
//   - Daten-Export/Import (buildExportEnvelope, exportData,
//     validateImportText, …) — nutzt defensiv
//     AppGlobals.syncStateFromInputs / syncInputsFromState.
//   - Tabs / Settings / Reset / Drill / Kultur
//
// Bewusst ANDERNSWO extrahiert (Issue #416 Welle 7):
//   - Lokales Protokoll (setProtocolView, toggleProtocolAccordion,
//     requestLocalProtocolDelete, closeLocalProtocolSheet,
//     confirmLocalProtocolDelete) lebt in public/js/protocol-handlers.js
//     und wird zwischen drill-handlers.js und tab-handlers.js geladen.
//     Die Brücke AppGlobals.drillRemove / AppGlobals.drillMachineRemove
//     wird dort defensiv über AppGlobals aufgelöst.
//
// ui-handlers.js bleibt VOR input-handlers.js geladen: sein
// Import/Export greift erst zur Laufzeit defensiv auf
// AppGlobals.syncStateFromInputs / AppGlobals.syncInputsFromState zu,
// diese sind zum Modul-Load-Zeitpunkt noch nicht gesetzt. Erst die
// später geladene input-handlers.js füllt die AppGlobals-API.
//
// Braucht zur Laufzeit (AppGlobals):
//   - state, parseDE, appEmit (state.js / calculations.js / main.js)
//   - getTabKornerGesamt, getTabTotalEinheiten, getTabTotalDuenger
//     (calculations.js) — im Funktionsaufruf gelesen, nicht beim
//     Modul-Load
//   - syncEinheitGroesseEditorFromTab (settings-handlers.js) — erst
//     beim Nutzeraufruf aufgelöst (settings-handlers.js wird NACH
//     input-handlers.js geladen)
//
// onInputFormat darf _pendingKey weiterhin als klassischen globalen
// Namen auflösen; main.js definiert ihn später, Aufrufe erfolgen erst
// nach Initialisierung (Issue #262 — physische-Tastatur-Heuristik).
//
// Verhaltensgleich zur ui-handlers.js-Variante (Issue #416 Welle 6 —
// reine lexikalische Konsolidierung, keine Logik-/Parser-/Format-/
// Cursor- oder Persistenz-Änderung).
// ============================================================================

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
    // getTabKornerGesamt is in calculations.js; getActiveReiter is in input-handlers.js
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
    // Da input-handlers.js NACH calculations.js geladen wird, gewinnen die
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
// Damit sind sie sowohl für bestehende HTML-/Window-Nutzung (inline
// oninput="onInputFormat(this, …)", onclick="syncStateFromInputs()")
// als auch für AppGlobals-Konsumenten (render-tabs, render-results,
// reset-handlers, tab-handlers, Tests) erreichbar.
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
