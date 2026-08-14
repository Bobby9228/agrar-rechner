/**
 * Regression: resetActiveTab() muss die per-Schlag-Einheitsgröße
 * (koernerProEinheit) erhalten.
 *
 * Bug-Beschreibung (bestätigter Review-Fehler):
 *   resetActiveTab() ersetzt den aktiven Schlag mit einem frischen Objekt,
 *   das kein koernerProEinheit-Feld führt. Damit verschwindet jede
 *   manuelle Einheitsgröße, sobald der Landwirt Eingaben/Protokoll des
 *   aktiven Schlags leert. Ein anschließender Kultur-Wechsel würde
 *   zudem den geleerten Schlag ohne Schutz „mitziehen".
 *
 * Erwartetes Verhalten:
 *   - resetActiveTab() löscht hektar/istHektar/koerner/duenger/entries/done
 *     und setzt die Fahrgassen-Felder zurück.
 *   - resetActiveTab() BEHÄLT die per-Tab koernerProEinheit des aktiven
 *     Schlags unverändert.
 *   - Nach resetActiveTab() + Kultur-Wechsel bleibt der bestehende Schlag
 *     mit seiner ursprünglichen koernerProEinheit sichtbar — die
 *     Kultur-Profil-Änderung wirkt nur auf künftige Schläge.
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

describe('resetActiveTab() erhält per-Schlag Einheitsgröße', () => {
  it('Manuelle per-Tab koernerProEinheit überlebt resetActiveTab()', () => {
    const { window: w } = createDom();
    // Tab mit Daten + benutzerdefinierter Einheitsgröße
    w.state.reiter[0].hektar = 12;
    w.state.reiter[0].koerner = 90000;
    w.state.reiter[0].duenger = 150;
    w.state.reiter[0].entries = [{ einheit: 2, duenger: 100, time: '10:00' }];
    w.state.reiter[0].koernerProEinheit = 75000; // benutzerdefiniert
    w.resetActiveTab();
    // Eingaben + Protokoll weg, aber Einheitsgröße erhalten
    expect(w.state.reiter[0].hektar).toBe(0);
    expect(w.state.reiter[0].koerner).toBe(0);
    expect(w.state.reiter[0].duenger).toBe(0);
    expect(w.state.reiter[0].entries).toEqual([]);
    expect(w.state.reiter[0].done).toBe(false);
    expect(w.state.reiter[0].koernerProEinheit).toBe(75000);
  });

  it('Sonstiges-Tab (kpe=0) bleibt nach resetActiveTab() bei kpe=0', () => {
    const { window: w } = createDom();
    w.state.koernerProEinheit = 50000; // global = Mais-Default
    w.state.reiter[0].hektar = 5;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].koernerProEinheit = 0; // Sonstiges vor Eingabe
    w.resetActiveTab();
    expect(w.state.reiter[0].koernerProEinheit).toBe(0);
    // resolveKoernerProEinheit darf NICHT auf den globalen Mais-Default fallen
    expect(w.getTabKoernerProEinheit(w.state.reiter[0])).toBe(0);
  });

  it('Kultur-Wechsel nach resetActiveTab() lässt bestehenden Schlag unverändert', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    // Tab 0: manuell auf 75.000 gesetzt
    w.state.reiter[0].hektar = 8;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].koernerProEinheit = 75000;
    // Eingaben + Protokoll leeren
    w.resetActiveTab();
    // Kultur auf Raps wechseln
    w.requestChangeKultur();
    w.AppGlobals._pendingKulturChoice = 'raps';
    w.confirmChangeKultur();
    // Bestehender Schlag behält seine 75.000
    expect(w.state.reiter[0].koernerProEinheit).toBe(75000);
    // Profil-Default wurde umgestellt
    expect(w.state.koernerProEinheit).toBe(1500000);
    // Künftige Schläge bekommen Raps-Standard
    w.addReiter();
    expect(w.state.reiter[1].koernerProEinheit).toBe(1500000);
  });

  it('resetActiveTab() lässt andere Tabs komplett unverändert (auch kpe)', () => {
    const { window: w } = createDom();
    w.addReiter(); // Tab 1
    w.switchReiter(0);                      // active = tab 0
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '90000';
    w.syncStateFromInputs();
    w.state.reiter[0].koernerProEinheit = 60000;
    // Tab 1 via DOM bestücken
    w.switchReiter(1);
    w.document.getElementById('hektar').value = '5';
    w.document.getElementById('koerner').value = '80000';
    w.syncStateFromInputs();
    w.state.reiter[1].koernerProEinheit = 80000;
    // Zurück zu Tab 0 und resetten
    w.switchReiter(0);
    w.resetActiveTab();
    expect(w.state.reiter[0].koernerProEinheit).toBe(60000);
    expect(w.state.reiter[1].hektar).toBe(5);
    expect(w.state.reiter[1].koerner).toBe(80000);
    expect(w.state.reiter[1].koernerProEinheit).toBe(80000);
  });
});
