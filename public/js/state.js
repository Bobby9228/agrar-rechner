// ============================================================================
    // STATE MANAGEMENT — Zentrales state-Objekt und Persistenz
    //
    // state: Single Source of Truth für die gesamte App.
    // Wird nach jeder Änderung via saveState() in localStorage geschrieben.
    //
    // Struktur:
    //   reiter[]       — Array von Feld-Tabs (jeder Tab = ein Feld)
    //   activeReiter   — Index des aktuell ausgewählten Tabs
    //   activeView     — 'protokoll' = Drill-Protokoll-Ansicht, sonst null
    //   fahrgassen*    — Fahrgassen-Korrektur
    //   einheitGroesse* — Anpassung der Körner-pro-Einheit
    //   machineLog[]   — Globales Maschinen-Protokoll
    // ============================================================================

    var state = {
      reiter: [{
        name:       'Tab 1',
        hektar:     0,
        istHektar:  0,
        koerner:    0,
        duenger:    0,
        entries:    []
      }],
      activeReiter:   0,
      activeView:     null,
      fahrgassenEnabled: false,
      fahrgassenBreite:   0,
      einheitGroesseEnabled: false,
      koernerProEinheit:  50000,
      machineLog:    [],
      drillPriorities: {},
      iosInstallHintShown: false
    };

    // --- Persistenz ---

    function saveState() {
      invalidateCarryoverCache();
      try {
        localStorage.setItem('mais_rechner', JSON.stringify(state));
      } catch(e) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_FILE_CANT_CREATE') {
          showSaveError();
        }
        console.error('saveState failed:', e);
      }
    }

    function showSaveError() {
      var el = document.getElementById('save_error_banner');
      if (el) el.style.display = 'flex';
    }

    function dismissSaveError() {
      var el = document.getElementById('save_error_banner');
      if (el) el.style.display = 'none';
    }

    function loadState() {
      try {
        var saved = localStorage.getItem('mais_rechner');
        if (!saved) return false;
        var data = JSON.parse(saved);
        var originalLv = data._lv || 0;
        var lv = originalLv;
        // Migration 0→1: Einzelne Felder → Tab-Array
        if (!data.reiter && (data.hektar !== undefined || data.koerner !== undefined)) {
          data = { reiter: [{ name: 'Tab 1', hektar: data.hektar || 0, istHektar: data.istHektar || 0, koerner: data.koerner || 0, duenger: data.duenger || 0, entries: data.entries || [] }], activeReiter: 0, activeView: null, fahrgassenEnabled: false, fahrgassenBreite: 0, einheitGroesseEnabled: false, koernerProEinheit: 50000, machineLog: data.machineLog || [], drillPriorities: {}, iosInstallHintShown: false, _lv: 1 };
          lv = 1;
        }
        // Migration 1→2: Globale entries → per-Tab entries
        if (lv < 2 && data.entries && Array.isArray(data.entries)) {
          if (data.reiter && data.reiter[0]) data.reiter[0].entries = data.entries;
          delete data.entries;
          lv = 2;
        }
        // Migration 2→3: Fehlende Felder
        if (lv < 3) {
          if (!data.drillPriorities) data.drillPriorities = {};
          if (!data.iosInstallHintShown) data.iosInstallHintShown = false;
          if (!data.machineLog) data.machineLog = [];
          lv = 3;
        }
        // Migration 3→4: Theme-Key vereinheitlichen, neue Defaults
        if (lv < 4) {
          // Theme: alten Key 'mais_rechner_theme' → neuen Key 'theme'
          try {
            var oldTheme = localStorage.getItem('mais_rechner_theme');
            if (oldTheme && !localStorage.getItem('theme')) {
              localStorage.setItem('theme', oldTheme);
            }
            if (oldTheme) localStorage.removeItem('mais_rechner_theme');
          } catch(e) {}
          // koernerProEinheit Default (falls noch aus alter Migration fehlend)
          if (data.koernerProEinheit === undefined) data.koernerProEinheit = 50000;
          // einheitGroesseEnabled Default
          if (data.einheitGroesseEnabled === undefined) data.einheitGroesseEnabled = false;
          // drillPriorities Default
          if (!data.drillPriorities) data.drillPriorities = {};
        }
        // Validate und übernehmen
        if (!Array.isArray(data.reiter) || data.reiter.length === 0) return false;
        data.reiter.forEach(function(r) {
          if (!r.entries) r.entries = [];
          if (r.hektar === undefined) r.hektar = 0;
          if (r.istHektar === undefined) r.istHektar = 0;
          if (r.koerner === undefined) r.koerner = 0;
          if (r.duenger === undefined) r.duenger = 0;
          if (!r.name) r.name = 'Tab';
        });
        data._lv = 4;
        state = data;
        // Migration-Persistenz: Wenn die Daten nicht bereits _lv=4 waren,
        // schreibe den migrierten Snapshot einmalig zurück, damit nachfolgende
        // Page-Loads die Migration überspringen können.
        if (originalLv < 4) {
          try {
            localStorage.setItem('mais_rechner', JSON.stringify(state));
          } catch(e) {
            // Nicht kritisch — Migration war erfolgreich im Memory, beim
            // nächsten Load wird sie einfach erneut durchgeführt (idempotent).
            console.warn('loadState: migrated snapshot could not be persisted:', e);
          }
        }
        return true;
      } catch(e) {
        console.error('loadState failed:', e);
        return false;
      }
    }

    // --- iOS Safari Detection (portiert aus Inline-Code Z. 1490-1492) ---
    // Wird einmalig beim Modul-Load ausgewertet; Tests können isIOS/isStandalone
    // per window.isIOS = true überschreiben.
    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    var isStandalone = window.navigator.standalone === true;

    // --- iOS Install Hint (portiert aus Inline-Code Z. 1494-1507) ---
    // Zeigt einmalig einen Hinweis zum Installieren der PWA auf iOS Safari.
    // Nur auf iOS/Safari, nur wenn noch nicht installiert und noch nicht dismissed.
    function maybeShowIosInstallHint() {
      var hintSeen = null;
      try { hintSeen = localStorage.getItem('mais_rechner_ios_install_seen'); } catch(e) {}
      if (!isIOS || isStandalone || hintSeen) return;
      var banner = document.getElementById('ios_install_banner');
      if (banner) banner.classList.add('show');
    }
    function dismissIosInstallHint() {
      try { localStorage.setItem('mais_rechner_ios_install_seen', '1'); } catch(e) {}
      var banner = document.getElementById('ios_install_banner');
      if (banner) banner.classList.remove('show');
    }

    // --- "What's New" Update Banner (portiert aus Inline-Code Z. 1509-1531) ---
    // Zeigt einmalig einen Hinweis nach App-Updates (neue SW-Version).
    // currentVersion muss bei jedem Release manuell aktualisiert werden.
    // (APP_VERSION + APP_BUILD_DATE sind in main.js definiert.)
    var UPDATE_CHANGELOG = 'Erste Veröffentlichung der App.';
    function maybeShowUpdateHint() {
      var seenVersion = null;
      try { seenVersion = localStorage.getItem('mais_rechner_version_seen'); } catch(e) {}
      if (seenVersion === APP_VERSION) return;
      var banner = document.getElementById('update_banner');
      var verEl = document.getElementById('update_version');
      var changelogEl = document.getElementById('update_changelog');
      if (banner) {
        if (verEl) verEl.textContent = APP_VERSION;
        if (changelogEl) changelogEl.textContent = UPDATE_CHANGELOG;
        banner.classList.add('show');
      }
    }
    function dismissUpdateHint() {
      try { localStorage.setItem('mais_rechner_version_seen', APP_VERSION); } catch(e) {}
      var banner = document.getElementById('update_banner');
      if (banner) banner.classList.remove('show');
    }
