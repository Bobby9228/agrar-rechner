// ============================================================================
// SETTINGS-HANDLERS — Einstellungs-Handler
//
// Aus ui-handlers.js (Issue #416 Welle 3) in ein eigenes Modul extrahiert.
// Enthält:
//   - fahrgassenToggle, fahrgassenUpdate
//   - einheitGroesseToggle, einheitGroesseUpdate
//   - syncEinheitGroesseEditorFromTab (per-Tab kpe-Editor-Sync)
//
// Lade-Reihenfolge (siehe index.html):
//   ui-handlers.js → settings-handlers.js → tab-handlers.js → render-tabs.js
//
// Braucht zur Laufzeit (AppGlobals):
//   - state, appEmit (state.js)
//   - parseDE (calculations.js)
//   - getActiveReiter (ui-handlers.js)
//
// Öffentliche Namen sind sowohl für bestehende Inline-HTML-/Window-Nutzung
// (onclick="fahrgassenToggle()" etc.) als auch für AppGlobals-Konsumenten
// (Tests, render-tabs.js, culture-handlers.js) erreichbar — siehe
// Object.assign(window.AppGlobals, …) am Dateiende.
//
// DOM_IDS bleibt in ui-handlers.js, weil Reset (resetAll / resetActiveTab)
// die IDs weiter nutzt. Diese Funktionen lesen ihre IDs direkt aus dem DOM
// — keine DOM_IDS-Abhängigkeit.
// ============================================================================

    // --- Fahrgassen ---

    function fahrgassenToggle() {
      AppGlobals.state.fahrgassenEnabled = !AppGlobals.state.fahrgassenEnabled;
      var btn = document.getElementById('fahrgassen_toggle');
      if (AppGlobals.state.fahrgassenEnabled) {
        document.getElementById('fahrgassen_settings').classList.add('open');
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        document.getElementById('fahrgassen_settings').classList.remove('open');
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
        AppGlobals.state.fahrgassenBreite = 0;
        document.getElementById('fahrgassen_saved').textContent = '';
      }
      // 5a: per-Tab-State synchronisieren — Berechnungen lesen r.fahrgassenEnabled
      AppGlobals.state.reiter.forEach(function(r) {
        r.fahrgassenEnabled = AppGlobals.state.fahrgassenEnabled;
        r.fahrgassenBreite = AppGlobals.state.fahrgassenBreite;
      });
      AppGlobals.appEmit('SETTINGS_CHANGED', { setting: 'fahrgassenEnabled' });
    }

    function fahrgassenUpdate() {
      var raw = document.getElementById('fahrgassen_breite').value;
      var val = AppGlobals.parseDE(raw);
      // 5d: breite < 2 → State unverändert, Feld zurücksetzen
      if (val >= 2) {
        AppGlobals.state.fahrgassenBreite = val;
        // 5c: Prozent-Info anzeigen
        // Anteil produktiv mit Fahrgassen: (breite-1)/breite → 23/24 = 95.83% für breite=24
        var pct = ((val - 1) / val) * 100;
        document.getElementById('fahrgassen_saved').textContent = val + ' m -> ~' + pct.toFixed(1) + '% bestellt';
        document.getElementById('fahrgassen_breite').style.borderColor = '';
        // 5a: per-Tab-State syncen
        AppGlobals.state.reiter.forEach(function(r) {
          r.fahrgassenEnabled = AppGlobals.state.fahrgassenEnabled;
          r.fahrgassenBreite = val;
        });
      } else {
        // breite 0/leer/< 2 → saved text leeren, State auf 0
        document.getElementById('fahrgassen_saved').textContent = '';
        document.getElementById('fahrgassen_breite').style.borderColor = '';
        if (val === 0 || isNaN(val)) {
          AppGlobals.state.fahrgassenBreite = 0;
        }
        // val < 2 (aber > 0): State bleibt auf letztem gültigen Wert
        // Feld wird nicht überschrieben — User sieht Eingabe, kann korrigieren
        if (val > 0 && val < 2) {
          document.getElementById('fahrgassen_saved').textContent = 'Fahrgassenbreite muss mindestens 2m betragen';
          // Feld auf vorherigen gültigen Wert zurücksetzen (oder leer wenn State 0)
          document.getElementById('fahrgassen_breite').value = AppGlobals.state.fahrgassenBreite > 0
            ? String(AppGlobals.state.fahrgassenBreite)
            : '';
        }
        if (val === 0 || isNaN(val)) {
          AppGlobals.state.reiter.forEach(function(r) {
            r.fahrgassenEnabled = AppGlobals.state.fahrgassenEnabled;
            r.fahrgassenBreite = 0;
          });
        }
      }
      AppGlobals.appEmit('SETTINGS_CHANGED', { setting: 'fahrgassenBreite' });
    }

    // --- Einheiten-Groesse ---

    // HIGH 5: einheitGroesseToggle ist nur noch Auf-/Zuklappen des
    // per-Schlag-Editors. Schließen darf weder den aktiven Tab-Wert
    // (r.koernerProEinheit) noch den Kultur-Standard
    // (state.koernerProEinheit) verändern. Beim erneuten Öffnen erscheint
    // der korrekte Tab-Wert (syncEinheitGroesseEditorFromTab).
    function einheitGroesseToggle() {
      AppGlobals.state.einheitGroesseEnabled = !AppGlobals.state.einheitGroesseEnabled;
      var btn = document.getElementById('einheit_groesse_toggle');
      var settings = document.getElementById('einheit_groesse_settings');
      if (AppGlobals.state.einheitGroesseEnabled) {
        if (settings) settings.classList.add('open');
        if (btn) {
          btn.classList.add('active');
          btn.setAttribute('aria-pressed', 'true');
        }
      } else {
        if (settings) settings.classList.remove('open');
        if (btn) {
          btn.classList.remove('active');
          btn.setAttribute('aria-pressed', 'false');
        }
      }
      // Editor (Feld + saved-Text) aus dem aktuellen Tab rekonstruieren
      // — beim Öffnen sieht der User den korrekten Tab-Wert, beim
      // Schließen wird kein State angefasst.
      syncEinheitGroesseEditorFromTab(AppGlobals.getActiveReiter());
      AppGlobals.appEmit('SETTINGS_CHANGED', { setting: 'einheitGroesseEnabled' });
    }

    function einheitGroesseUpdate() {
      var raw = document.getElementById('koerner_pro_einheit').value;
      var val = AppGlobals.parseDE(raw);
      var kpEl = document.getElementById('koerner_pro_einheit');
      if (val !== null && val > 0) {
        var rounded = Math.round(val);
        // HIGH 4: schreibt NUR auf den aktiven Tab. state.koernerProEinheit
        // ist der Kultur-Profil-Default und darf durch manuelle Eingabe
        // NICHT überschrieben werden — sonst verlieren neue Tabs ihren
        // Kultur-Standard.
        var activeTab = AppGlobals.state.reiter[AppGlobals.state.activeReiter];
        if (activeTab) activeTab.koernerProEinheit = rounded;
        kpEl.style.borderColor = '';
      } else {
        kpEl.style.borderColor = '#c00';
      }
      // Editor (saved-Text + Feld) aus dem aktuellen Tab rekonstruieren,
      // damit der Wert konsistent mit r.koernerProEinheit angezeigt wird.
      syncEinheitGroesseEditorFromTab(AppGlobals.getActiveReiter());
      AppGlobals.appEmit('SETTINGS_CHANGED', { setting: 'koernerProEinheit' });
    }

    // Synchronisiert den per-Schlag-Editor (Eingabefeld + saved-Text) aus
    // dem aktuellen Tab. Wird von syncInputsFromState (ui-handlers.js,
    // via AppGlobals-Brücke) aufgerufen und kann auch direkt (z. B. nach
    // Korrekturen via DevTools) genutzt werden.
    // 0/leer → Feld leer, saved-Text leer.
    // 50000 (Mais-Default) → Feld zeigt 50000, saved-Text leer (Default).
    function syncEinheitGroesseEditorFromTab(r) {
      var kpEl = document.getElementById('koerner_pro_einheit');
      var savedEl = document.getElementById('einheit_groesse_saved');
      var tabKpe = (r && typeof r.koernerProEinheit === 'number'
                    && isFinite(r.koernerProEinheit)
                    && r.koernerProEinheit > 0)
        ? r.koernerProEinheit
        : 0;
      if (kpEl) {
        // Rohe Ganzzahl (kein Tausender-Punkt) damit parseDE() in
        // einheitGroesseUpdate() den Wert korrekt zurückschreibt.
        var v = tabKpe > 0 ? String(tabKpe) : '';
        kpEl.value = v;
        kpEl.dataset.prev = v;
        kpEl.dataset.cleaned = v;
        kpEl.style.borderColor = '';
      }
      if (savedEl) {
        // Konsistent mit einheitGroesseUpdate(): 50000 (Mais-Default) ist
        // kein Hinweis wert; alles andere zeigt den Körner/Einheit-Text.
        if (tabKpe > 0 && tabKpe !== 50000) {
          savedEl.textContent = tabKpe.toLocaleString('de-DE') + ' Körner/Einheit';
        } else {
          savedEl.textContent = '';
        }
      }
    }

// Register exposed globals on AppGlobals (ADR-001 Schritt 3, Issue #278).
// Damit sind sie sowohl für bestehende HTML-/Window-Nutzung
// (onclick="fahrgassenToggle()" etc.) als auch für AppGlobals-Konsumenten
// (Tests, render-tabs.js, culture-handlers.js) erreichbar.
Object.assign(window.AppGlobals, {
  fahrgassenToggle: fahrgassenToggle,
  fahrgassenUpdate: fahrgassenUpdate,
  einheitGroesseToggle: einheitGroesseToggle,
  einheitGroesseUpdate: einheitGroesseUpdate,
  syncEinheitGroesseEditorFromTab: syncEinheitGroesseEditorFromTab,
});