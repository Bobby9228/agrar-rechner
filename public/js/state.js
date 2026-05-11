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
        var lv = data._lv || 0;
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
        data._lv = 3;
        state = data;
        return true;
      } catch(e) {
        console.error('loadState failed:', e);
        return false;
      }
    }

    // --- iOS Install Hint ---
    function showIOSInstallHint() {
      var standalone = window.matchMedia('(display-mode: standalone)').matches;
      var iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (iOS && !standalone && !state.iosInstallHintShown) {
        var el = document.getElementById('ios_install_hint');
        if (el) { el.style.display = 'block'; state.iosInstallHintShown = true; }
      }
    }

    function dismissIOSInstallHint() {
      var el = document.getElementById('ios_install_hint');
      if (el) el.style.display = 'none';
    }