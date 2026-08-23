/**
 * Kultur-Migration (alte Schemas → aktuelles Schema).
 *
 * - Migration 5→6: bestehende Schläge behalten ihren effektiven kpe-Wert
 *   (benutzerdefinierter globaler Wert, falls aktiv; sonst 50.000).
 *   Tab mit eigener koernerProEinheit behält Vorrang.
 * - Migration 6→7: Raps-Default-KPE (1.500.000) für unberührte Felder
 *   korrigieren (Bug: bei Auswahl Raps + Erstauswahl blieb Tab 0 auf
 *   kpe=50000, obwohl Raps-Default 1.500.000 beträgt). Idempotent.
 * - Erste Kulturwahl muss einen unberührten migrierten Startschlag auf
 *   den gewählten Kulturstandard umstellen.
 * - isUntouchedInitialField Predicate: Tab 0, KPE exakt 50000, alle
 *   anderen Felder 0/leer/false → gilt als unberührt.
 * - Detection muss sauber über den Rückgabewert von loadState() kommen,
 *   nicht über eine Heuristik ("alle Felder leer").
 *
 * Zugehörige frühere Dateien: tests/62-kultur-migration.test.js,
 * tests/81-kultur-legacy-empty-start-tab.test.js,
 * tests/82-kultur-untouched-field.test.js,
 * tests/83-raps-kpe-migration-6-7.test.js (Issue #419 Welle 1).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Migration 5→6: bestehende Tabs behalten effektiven kpe', () => {
  it('Default (kein einheitGroesseEnabled) → alle bestehenden Tabs bekommen 50.000', () => {
    const { window: w, store } = createDom();
    store['agrar_rechner'] = JSON.stringify({
      _lv: 5,
      reiter: [
        { name: 'A', hektar: 10, koerner: 90000, duenger: 150, entries: [], done: false },
        { name: 'B', hektar: 5,  koerner: 80000, duenger: 100, entries: [], done: false }
      ],
      activeReiter: 0,
      activeView: null,
      einheitGroesseEnabled: false,
      koernerProEinheit: 50000,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      machineLog: [],
      drillPriorities: {}
    });
    w.loadState();
    expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
    expect(w.state.reiter[1].koernerProEinheit).toBe(50000);
  });

  it('einheitGroesseEnabled=true mit benutzerdef. Wert → Tabs bekommen diesen Wert', () => {
    const { window: w, store } = createDom();
    store['agrar_rechner'] = JSON.stringify({
      _lv: 5,
      reiter: [
        { name: 'A', hektar: 10, koerner: 90000, duenger: 150, entries: [], done: false },
        { name: 'B', hektar: 5,  koerner: 80000, duenger: 100, entries: [], done: false }
      ],
      activeReiter: 0,
      activeView: null,
      einheitGroesseEnabled: true,
      koernerProEinheit: 80000,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      machineLog: [],
      drillPriorities: {}
    });
    w.loadState();
    expect(w.state.reiter[0].koernerProEinheit).toBe(80000);
    expect(w.state.reiter[1].koernerProEinheit).toBe(80000);
  });

  it('Tab mit eigener koernerProEinheit behält diesen Wert (Vorrang vor Global)', () => {
    const { window: w, store } = createDom();
    store['agrar_rechner'] = JSON.stringify({
      _lv: 5,
      reiter: [
        { name: 'A', hektar: 10, koerner: 90000, duenger: 150, entries: [], done: false, koernerProEinheit: 75000 }
      ],
      activeReiter: 0,
      activeView: null,
      einheitGroesseEnabled: true,
      koernerProEinheit: 80000,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      machineLog: [],
      drillPriorities: {}
    });
    w.loadState();
    expect(w.state.reiter[0].koernerProEinheit).toBe(75000);
  });

  it('Migration erhält Berechnungs-Ergebnisse: vor Migration berechnen, danach identisch', () => {
    const { window: w, store } = createDom();
    // Vor-Migration State mit einheitGroesseEnabled=true und Wert 80000
    const oldState = {
      _lv: 5,
      reiter: [{ name: 'A', hektar: 10, koerner: 90000, duenger: 150, entries: [], done: false }],
      activeReiter: 0,
      activeView: null,
      einheitGroesseEnabled: true,
      koernerProEinheit: 80000,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      machineLog: [],
      drillPriorities: {}
    };
    // Vor-Migration: Total-Einheiten mit globalem kpe=80000
    const refTotal = 10 * 90000 / 80000; // = 11.25
    // State sichern + loadState triggert Migration
    store['agrar_rechner'] = JSON.stringify(oldState);
    w.loadState();
    // Nach Migration: gleicher Wert über r.koernerProEinheit
    expect(w.getTabTotalEinheiten(w.state.reiter[0])).toBeCloseTo(refTotal, 5);
  });

  it('Migration hebt _lv auf 9 und entfernt mig6-Felder nicht', () => {
    const { window: w, store } = createDom();
    store['agrar_rechner'] = JSON.stringify({
      _lv: 5,
      reiter: [{ name: 'A', hektar: 10, koerner: 90000, duenger: 150, entries: [], done: false }],
      activeReiter: 0,
      activeView: null,
      einheitGroesseEnabled: false,
      koernerProEinheit: 50000,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      machineLog: [],
      drillPriorities: {}
    });
    w.loadState();
    const persisted = JSON.parse(store['agrar_rechner']);
    expect(persisted._lv).toBe(9);
    expect(persisted.kultur).toBeNull();
    expect(persisted.erstauswahlDone).toBe(false);
    expect(persisted.reiter[0].koernerProEinheit).toBe(50000);
  });

  it('Erststart-Modal erscheint NUR für bestehende Nutzer ohne Kultur', () => {
    const { window: w, store } = createDom();
    store['agrar_rechner'] = JSON.stringify({
      _lv: 5,
      reiter: [{ name: 'A', hektar: 10, koerner: 90000, duenger: 150, entries: [], done: false }],
      activeReiter: 0,
      activeView: null,
      einheitGroesseEnabled: false,
      koernerProEinheit: 50000,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      machineLog: [],
      drillPriorities: {}
    });
    w.initUI();
    // Modal sollte offen sein, aber bestehende Schläge unverändert
    const modal = w.document.getElementById('kultur_modal');
    expect(modal.classList.contains('open')).toBe(true);
    // Bestehender Tab bleibt mit kpe=50000
    expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
    expect(w.state.reiter[0].hektar).toBe(10);
    expect(w.state.reiter[0].koerner).toBe(90000);
  });

  it('Nach Erstauswahl (Mais) werden bestehende Schläge NICHT verändert', () => {
    const { window: w, store } = createDom();
    store['agrar_rechner'] = JSON.stringify({
      _lv: 5,
      reiter: [
        { name: 'A', hektar: 10, koerner: 90000, duenger: 150, entries: [], done: false, koernerProEinheit: 80000 },
        { name: 'B', hektar: 5,  koerner: 70000, duenger: 80,  entries: [], done: false, koernerProEinheit: 50000 }
      ],
      activeReiter: 0,
      activeView: null,
      einheitGroesseEnabled: true,
      koernerProEinheit: 80000,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      machineLog: [],
      drillPriorities: {}
    });
    w.initUI();
    w.chooseKultur('mais');
    // bestehende Tabs unverändert
    expect(w.state.reiter[0].koernerProEinheit).toBe(80000);
    expect(w.state.reiter[0].hektar).toBe(10);
    expect(w.state.reiter[0].koerner).toBe(90000);
    expect(w.state.reiter[1].koernerProEinheit).toBe(50000);
    expect(w.state.reiter[1].hektar).toBe(5);
    expect(w.state.reiter[1].koerner).toBe(70000);
    // globaler Default auf Mais
    expect(w.state.koernerProEinheit).toBe(50000);
    expect(w.state.kultur).toBe('mais');
    expect(w.state.erstauswahlDone).toBe(true);
  });
});

describe('Erste Kulturwahl aktualisiert unberührten Legacy-Startschlag', () => {
  function legacyState(overrides = {}, extraTabs = []) {
    return {
      _lv: 5,
      reiter: [{
        name: 'Schlag 1',
        hektar: 0,
        istHektar: 0,
        koerner: 0,
        duenger: 0,
        entries: [],
        done: false,
        ...overrides,
      }, ...extraTabs],
      activeReiter: 0,
      einheitGroesseEnabled: false,
      koernerProEinheit: 50000,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      machineLog: [],
      drillPriorities: {},
    };
  }

  function loadLegacyState(state) {
    const ctx = createDom();
    ctx.store.agrar_rechner = JSON.stringify(state);
    ctx.window.initUI();
    return ctx;
  }

  it('Raps setzt Schlag 1 und den sichtbaren Einheiten-Editor auf 1.500.000', () => {
    const { window: w } = loadLegacyState(legacyState());
    expect(w.state.reiter[0].koernerProEinheit).toBe(50000);

    w.chooseKultur('raps');

    expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
    expect(w.document.getElementById('koerner_pro_einheit').value).toBe('1500000');

    w.einheitGroesseToggle();
    expect(w.document.getElementById('koerner_pro_einheit').value).toBe('1500000');

    w.state = { reiter: [], activeReiter: 0 };
    expect(w.loadState()).toBe(true);
    expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
  });

  it('Sonstiges setzt den unberührten Startschlag auf 0 und zeigt ein leeres Feld', () => {
    const { window: w } = loadLegacyState(legacyState());

    w.chooseKultur('sonstiges');

    expect(w.state.reiter[0].koernerProEinheit).toBe(0);
    expect(w.document.getElementById('koerner_pro_einheit').value).toBe('');
  });

  it.each([
    ['SOLL-Fläche', { hektar: 4 }],
    ['IST-Fläche', { istHektar: 4 }],
    ['Aussaatstärke', { koerner: 300000 }],
    ['Dünger', { duenger: 150 }],
    ['Protokoll', { entries: [{ time: 1, einheit: 1, duenger: 0, hektar: 1, istHektar: 0, koerner: 0, duengerRate: 0 }] }],
    ['Fertig-Markierung', { done: true }],
  ])('ändert einen Startschlag mit %s nicht', (_label, overrides) => {
    const { window: w } = loadLegacyState(legacyState(overrides));

    w.chooseKultur('raps');

    expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
  });

  it('behält eine individuelle Einheitsgröße auch bei vollständig leerem Schlag', () => {
    const { window: w } = loadLegacyState(legacyState({ koernerProEinheit: 75000 }));

    w.chooseKultur('raps');

    expect(w.state.reiter[0].koernerProEinheit).toBe(75000);
  });

  it('ändert keinen weiteren vorhandenen leeren Arbeitsschlag', () => {
    const secondTab = {
      name: 'Schlag 2', hektar: 0, istHektar: 0, koerner: 0, duenger: 0,
      entries: [], done: false, koernerProEinheit: 50000,
    };
    const { window: w } = loadLegacyState(legacyState({}, [secondTab]));

    w.chooseKultur('raps');

    expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
    expect(w.state.reiter[1].koernerProEinheit).toBe(50000);
  });

  it('ein später bestätigter Kulturwechsel lässt den bestehenden Schlag unverändert', () => {
    const { window: w } = loadLegacyState(legacyState());
    w.chooseKultur('raps');

    w.requestChangeKultur();
    w.AppGlobals._pendingKulturChoice = 'mais';
    w.confirmChangeKultur();

    expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
    expect(w.state.kultur).toBe('mais');
  });
});

describe('Regression: Unberührter Startschlag bei Erstauswahl', () => {
    describe('isUntouchedInitialField Predicate', () => {
        it('Tab 0 mit Legacy-Default KPE=50000 und allen Nullen ist unberührt', () => {
            const { window: w } = createDom();
            const tab = {
                name: 'Schlag 1', hektar: 0, istHektar: 0,
                koerner: 0, duenger: 0, entries: [], done: false,
                koernerProEinheit: 50000
            };
            expect(w.AppGlobals.isUntouchedInitialField(tab, 0)).toBe(true);
        });

        it('Tab 0 mit KPE=50000 aber hektar > 0 ist NICHT unberührt', () => {
            const { window: w } = createDom();
            const tab = {
                name: 'Schlag 1', hektar: 5, istHektar: 0,
                koerner: 0, duenger: 0, entries: [], done: false,
                koernerProEinheit: 50000
            };
            expect(w.AppGlobals.isUntouchedInitialField(tab, 0)).toBe(false);
        });

        it('Tab 0 mit KPE=50000 aber entries vorhanden ist NICHT unberührt', () => {
            const { window: w } = createDom();
            const tab = {
                name: 'Schlag 1', hektar: 0, istHektar: 0,
                koerner: 0, duenger: 0,
                entries: [{ time: '10:00', einheit: 1, duenger: 0, hektar: 0, istHektar: 0, koerner: 0, duengerRate: 0 }],
                done: false,
                koernerProEinheit: 50000
            };
            expect(w.AppGlobals.isUntouchedInitialField(tab, 0)).toBe(false);
        });

        it('Tab 0 mit KPE=50000 aber done=true ist NICHT unberührt', () => {
            const { window: w } = createDom();
            const tab = {
                name: 'Schlag 1', hektar: 0, istHektar: 0,
                koerner: 0, duenger: 0, entries: [], done: true,
                koernerProEinheit: 50000
            };
            expect(w.AppGlobals.isUntouchedInitialField(tab, 0)).toBe(false);
        });

        it('Tab 0 mit individueller KPE=70000 ist NICHT unberührt', () => {
            const { window: w } = createDom();
            const tab = {
                name: 'Schlag 1', hektar: 0, istHektar: 0,
                koerner: 0, duenger: 0, entries: [], done: false,
                koernerProEinheit: 70000
            };
            expect(w.AppGlobals.isUntouchedInitialField(tab, 0)).toBe(false);
        });

        it('Tab 1 (nicht Tab 0) ist NICHT unberührt — egal wie leer', () => {
            const { window: w } = createDom();
            const tab = {
                name: 'Schlag 2', hektar: 0, istHektar: 0,
                koerner: 0, duenger: 0, entries: [], done: false,
                koernerProEinheit: 50000
            };
            expect(w.AppGlobals.isUntouchedInitialField(tab, 1)).toBe(false);
        });

        it('Tab 0 mit KPE=0 (Sonstiges-Default) ist NICHT unberührt', () => {
            const { window: w } = createDom();
            const tab = {
                name: 'Schlag 1', hektar: 0, istHektar: 0,
                koerner: 0, duenger: 0, entries: [], done: false,
                koernerProEinheit: 0
            };
            expect(w.AppGlobals.isUntouchedInitialField(tab, 0)).toBe(false);
        });
    });

    describe('chooseKultur mit unberührtem migrierten Startschlag', () => {
        function untouchedMigratedStore() {
            return {
                _lv: 5,
                reiter: [{
                    name: 'Schlag 1',
                    hektar: 0,
                    istHektar: 0,
                    koerner: 0,
                    duenger: 0,
                    entries: [],
                    done: false
                }],
                activeReiter: 0,
                einheitGroesseEnabled: false,
                koernerProEinheit: 50000,
                fahrgassenEnabled: false,
                fahrgassenBreite: 0,
                machineLog: [],
                drillPriorities: {}
            };
        }

        it('Raps: unberührter Schlag 0 wechselt von 50000 auf 1500000', () => {
            const { window: w, store } = createDom();
            store['agrar_rechner'] = JSON.stringify(untouchedMigratedStore());
            w.initUI();
            // Migration setzt Tab 0 auf 50000
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
            // Erstauswahl Raps
            w.chooseKultur('raps');
            // BUG-FIX: unberührter Schlag wird aktualisiert
            expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
        });

        it('Sonstiges: unberührter Schlag 0 wechselt von 50000 auf 0', () => {
            const { window: w, store } = createDom();
            store['agrar_rechner'] = JSON.stringify(untouchedMigratedStore());
            w.initUI();
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
            w.chooseKultur('sonstiges');
            // Sonstiges-Default ist 0
            expect(w.state.reiter[0].koernerProEinheit).toBe(0);
        });

        it('Mais: unberührter Schlag 0 bleibt bei 50000 (gleicher Default)', () => {
            const { window: w, store } = createDom();
            store['agrar_rechner'] = JSON.stringify(untouchedMigratedStore());
            w.initUI();
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
            w.chooseKultur('mais');
            // Mais-Default = 50000 → gleicher Wert
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
        });
    });

    describe('Nicht-unberührte Tabs bleiben unverändert', () => {
        function untouchedMigratedStore() {
            return {
                _lv: 5,
                reiter: [{
                    name: 'Schlag 1',
                    hektar: 0,
                    istHektar: 0,
                    koerner: 0,
                    duenger: 0,
                    entries: [],
                    done: false
                }],
                activeReiter: 0,
                einheitGroesseEnabled: false,
                koernerProEinheit: 50000,
                fahrgassenEnabled: false,
                fahrgassenBreite: 0,
                machineLog: [],
                drillPriorities: {}
            };
        }

        it('Tab 0 mit hektar > 0 bleibt bei 50000 nach Raps-Wahl', () => {
            const { window: w, store } = createDom();
            const s = untouchedMigratedStore();
            s.reiter[0].hektar = 5;
            store['agrar_rechner'] = JSON.stringify(s);
            w.initUI();
            w.chooseKultur('raps');
            // Tab hat Daten → bleibt unverändert
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
        });

        it('Tab 0 mit individueller KPE=70000 bleibt unverändert', () => {
            const { window: w, store } = createDom();
            const s = untouchedMigratedStore();
            s.reiter[0].koernerProEinheit = 70000;
            store['agrar_rechner'] = JSON.stringify(s);
            w.initUI();
            w.chooseKultur('raps');
            expect(w.state.reiter[0].koernerProEinheit).toBe(70000);
        });

        it('Tab 0 mit done=true bleibt unverändert', () => {
            const { window: w, store } = createDom();
            const s = untouchedMigratedStore();
            s.reiter[0].done = true;
            store['agrar_rechner'] = JSON.stringify(s);
            w.initUI();
            w.chooseKultur('raps');
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
        });

        it('Tab 1 existiert zusätzlich → nur Tab 0 (unberührt) wird aktualisiert', () => {
            const { window: w, store } = createDom();
            const s = untouchedMigratedStore();
            s.reiter.push({
                name: 'Schlag 2', hektar: 3, istHektar: 0,
                koerner: 50000, duenger: 0, entries: [], done: false,
                koernerProEinheit: 80000
            });
            store['agrar_rechner'] = JSON.stringify(s);
            w.initUI();
            w.chooseKultur('raps');
            // Tab 0: unberührt → aktualisiert
            expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
            // Tab 1: hat Daten → unverändert
            expect(w.state.reiter[1].koernerProEinheit).toBe(80000);
        });
    });

    describe('confirmChangeKultur bleibt unverändert', () => {
        it('confirmChangeKultur ändert bestehende Tabs NICHT', () => {
            const { window: w } = createDom();
            w.initUI();
            w.chooseKultur('mais');
            // Tab 0 hat 50000 (Mais-Default)
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
            // Wechsel zu Raps via confirmChangeKultur
            w.requestChangeKultur();
            w.AppGlobals._pendingKulturChoice = 'raps';
            w.confirmChangeKultur();
            // Tab 0 bleibt unverändert — confirmChangeKultur ändert keine Tabs
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
            // Globaler Default ist jetzt Raps
            expect(w.state.koernerProEinheit).toBe(1500000);
        });
    });

    describe('KPE-Editor-Sync nach chooseKultur', () => {
        function untouchedMigratedStore() {
            return {
                _lv: 5,
                reiter: [{
                    name: 'Schlag 1',
                    hektar: 0,
                    istHektar: 0,
                    koerner: 0,
                    duenger: 0,
                    entries: [],
                    done: false
                }],
                activeReiter: 0,
                einheitGroesseEnabled: false,
                koernerProEinheit: 50000,
                fahrgassenEnabled: false,
                fahrgassenBreite: 0,
                machineLog: [],
                drillPriorities: {}
            };
        }

        it('#koerner_pro_einheit zeigt 1500000 nach Raps-Erstauswahl', () => {
            const { window: w, store } = createDom();
            store['agrar_rechner'] = JSON.stringify(untouchedMigratedStore());
            w.initUI();
            // Editor öffnen
            w.einheitGroesseToggle();
            const kpEl = w.document.getElementById('koerner_pro_einheit');
            // Vor Erstauswahl: 50000 (Migration-Default)
            expect(kpEl.value).toBe('50000');
            // Raps wählen
            w.chooseKultur('raps');
            // Editor zeigt neuen Wert
            expect(kpEl.value).toBe('1500000');
        });

        it('#koerner_pro_einheit zeigt leer nach Sonstiges-Erstauswahl', () => {
            const { window: w, store } = createDom();
            store['agrar_rechner'] = JSON.stringify(untouchedMigratedStore());
            w.initUI();
            w.einheitGroesseToggle();
            const kpEl = w.document.getElementById('koerner_pro_einheit');
            w.chooseKultur('sonstiges');
            // Sonstiges-Default = 0 → Feld leer
            expect(kpEl.value).toBe('');
        });
    });

    describe('Reload nach Erstauswahl mit Korrektur', () => {
        it('Raps-Wahl auf unberührtem Schlag persistiert nach Reload', () => {
            const { window: w, store } = createDom();
            store['agrar_rechner'] = JSON.stringify({
                _lv: 5,
                reiter: [{
                    name: 'Schlag 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false
                }],
                activeReiter: 0,
                einheitGroesseEnabled: false,
                koernerProEinheit: 50000,
                fahrgassenEnabled: false,
                fahrgassenBreite: 0,
                machineLog: [],
                drillPriorities: {}
            });
            w.initUI();
            w.chooseKultur('raps');
            w.saveState();
            // Reload simulieren
            w.state = { reiter: [], activeReiter: 0 };
            w.loadState();
            expect(w.state.kultur).toBe('raps');
            expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
            expect(w.state.erstauswahlDone).toBe(true);
        });
    });
});

describe('Migration 6→7: Raps-Default-KPE für unberührte Felder', () => {
    let w, store;

    beforeEach(() => {
        const result = createDom();
        w = result.window;
        store = result.store;
    });

    function baseState(overrides) {
        return Object.assign({
            _lv: 6,
            reiter: [{
                name: 'Schlag 1',
                hektar: 0,
                istHektar: 0,
                koerner: 0,
                duenger: 0,
                entries: [],
                done: false,
                koernerProEinheit: 50000
            }],
            activeReiter: 0,
            activeView: null,
            dashboardOpen: false,
            fahrgassenEnabled: false,
            fahrgassenBreite: 0,
            einheitGroesseEnabled: false,
            koernerProEinheit: 50000,
            kultur: 'raps',
            erstauswahlDone: true,
            machineLog: [],
            drillPriorities: {}
        }, overrides);
    }

    describe('Korrektur: Tab 0 KPE 50000 → 1500000', () => {
        it('korrigiert Tab 0 kpe von 50000 auf 1500000 bei unberührtem Raps-State', () => {
            store['agrar_rechner'] = JSON.stringify(baseState());
            w.loadState();
            expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
        });

        it('setzt _lv auf 7 nach Migration', () => {
            store['agrar_rechner'] = JSON.stringify(baseState());
            w.loadState();
            expect(w.state._lv).toBe(9);
        });

        it('persistiert _lv=7 in localStorage', () => {
            store['agrar_rechner'] = JSON.stringify(baseState());
            w.loadState();
            var persisted = JSON.parse(store['agrar_rechner']);
            expect(persisted._lv).toBe(9);
            expect(persisted.reiter[0].koernerProEinheit).toBe(1500000);
        });

        it('zweiter Reload: Migration nicht erneut ausgeführt (idempotent)', () => {
            store['agrar_rechner'] = JSON.stringify(baseState());
            w.loadState();
            var afterFirst = JSON.parse(store['agrar_rechner']);
            expect(afterFirst._lv).toBe(9);
            expect(afterFirst.reiter[0].koernerProEinheit).toBe(1500000);
            // Zweiter Load
            w.loadState();
            var afterSecond = JSON.parse(store['agrar_rechner']);
            expect(afterSecond._lv).toBe(9);
            expect(afterSecond.reiter[0].koernerProEinheit).toBe(1500000);
        });
    });

    describe('Keine Korrektur bei berührtem Tab 0', () => {
        it('ändert nichts wenn hektar > 0', () => {
            store['agrar_rechner'] = JSON.stringify(baseState({
                reiter: [{
                    name: 'Schlag 1', hektar: 5, istHektar: 0, koerner: 0, duenger: 0,
                    entries: [], done: false, koernerProEinheit: 50000
                }]
            }));
            w.loadState();
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
            expect(w.state._lv).toBe(9);
        });

        it('ändert nichts wenn istHektar > 0', () => {
            store['agrar_rechner'] = JSON.stringify(baseState({
                reiter: [{
                    name: 'Schlag 1', hektar: 0, istHektar: 4.5, koerner: 0, duenger: 0,
                    entries: [], done: false, koernerProEinheit: 50000
                }]
            }));
            w.loadState();
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
            expect(w.state._lv).toBe(9);
        });

        it('ändert nichts wenn koerner > 0', () => {
            store['agrar_rechner'] = JSON.stringify(baseState({
                reiter: [{
                    name: 'Schlag 1', hektar: 0, istHektar: 0, koerner: 80000, duenger: 0,
                    entries: [], done: false, koernerProEinheit: 50000
                }]
            }));
            w.loadState();
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
            expect(w.state._lv).toBe(9);
        });

        it('ändert nichts wenn duenger > 0', () => {
            store['agrar_rechner'] = JSON.stringify(baseState({
                reiter: [{
                    name: 'Schlag 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 150,
                    entries: [], done: false, koernerProEinheit: 50000
                }]
            }));
            w.loadState();
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
            expect(w.state._lv).toBe(9);
        });

        it('ändert nichts wenn entries nicht leer', () => {
            store['agrar_rechner'] = JSON.stringify(baseState({
                reiter: [{
                    name: 'Schlag 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 0,
                    entries: [{ time: 1, einheit: 1, duenger: 50, hektar: 0, istHektar: 0, koerner: 0, duengerRate: 0 }],
                    done: false, koernerProEinheit: 50000
                }]
            }));
            w.loadState();
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
            expect(w.state._lv).toBe(9);
        });

        it('ändert nichts wenn done = true', () => {
            store['agrar_rechner'] = JSON.stringify(baseState({
                reiter: [{
                    name: 'Schlag 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 0,
                    entries: [], done: true, koernerProEinheit: 50000
                }]
            }));
            w.loadState();
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
            expect(w.state._lv).toBe(9);
        });
    });

    describe('Keine Korrektur bei anderer Kultur oder individueller KPE', () => {
        it('ändert nichts bei kultur=mais', () => {
            store['agrar_rechner'] = JSON.stringify(baseState({ kultur: 'mais' }));
            w.loadState();
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
            expect(w.state._lv).toBe(9);
        });

        it('ändert nichts bei kultur=sonstiges', () => {
            store['agrar_rechner'] = JSON.stringify(baseState({ kultur: 'sonstiges' }));
            w.loadState();
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
            expect(w.state._lv).toBe(9);
        });

        it('ändert nichts bei kultur=null', () => {
            store['agrar_rechner'] = JSON.stringify(baseState({ kultur: null, erstauswahlDone: false }));
            w.loadState();
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
            expect(w.state._lv).toBe(9);
        });

        it('ändert nichts wenn Tab 0 bereits individuelle kpe hat (≠50000)', () => {
            store['agrar_rechner'] = JSON.stringify(baseState({
                reiter: [{
                    name: 'Schlag 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 0,
                    entries: [], done: false, koernerProEinheit: 80000
                }]
            }));
            w.loadState();
            expect(w.state.reiter[0].koernerProEinheit).toBe(80000);
            expect(w.state._lv).toBe(9);
        });
    });

    describe('Nur Tab 0 betroffen, andere Tabs unverändert', () => {
        it('ändert nichts an Tab 1 (selbst wenn dieser unberührt wäre)', () => {
            store['agrar_rechner'] = JSON.stringify(baseState({
                reiter: [
                    { name: 'Schlag 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false, koernerProEinheit: 50000 },
                    { name: 'Schlag 2', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false, koernerProEinheit: 50000 }
                ]
            }));
            w.loadState();
            // Tab 0 wird korrigiert
            expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
            // Tab 1 bleibt unverändert
            expect(w.state.reiter[1].koernerProEinheit).toBe(50000);
            expect(w.state._lv).toBe(9);
        });
    });

    describe('Andere Migrationen bleiben erhalten', () => {
        it('Migration 0→7: alter flacher State wird migriert und _lv=7', () => {
            store['agrar_rechner'] = JSON.stringify({
                hektar: 10, koerner: 90000, duenger: 150,
                entries: [{ einheit: 5, hektar: 3, duenger: 200, time: '10:00' }]
            });
            w.loadState();
            expect(w.state.reiter).toBeDefined();
            expect(w.state.reiter.length).toBe(1);
            expect(w.state._lv).toBe(9);
        });

        it('Migration 5→7: bestehender State mit _lv=5 wird migriert', () => {
            store['agrar_rechner'] = JSON.stringify({
                _lv: 5,
                reiter: [{ name: 'A', hektar: 10, koerner: 90000, duenger: 150, entries: [], done: false }],
                activeReiter: 0,
                activeView: null,
                einheitGroesseEnabled: false,
                koernerProEinheit: 50000,
                fahrgassenEnabled: false,
                fahrgassenBreite: 0,
                machineLog: [],
                drillPriorities: {}
            });
            w.loadState();
            expect(w.state._lv).toBe(9);
            expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
        });

        it('Migration 6→7: bereits _lv=7 State wird nicht erneut migriert', () => {
            store['agrar_rechner'] = JSON.stringify(baseState({ _lv: 7, reiter: [{
                name: 'Schlag 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 0,
                entries: [], done: false, koernerProEinheit: 1500000
            }] }));
            w.loadState();
            expect(w.state.reiter[0].koernerProEinheit).toBe(1500000);
            expect(w.state._lv).toBe(9);
        });
    });
});
