/**
 * Regression: addReiter() erbt koerner/duenger vom zuvor aktiven Reiter.
 *
 * Hintergrund: Wenn ein Landwirt einen neuen Schlag anlegt, möchte er
 * typischerweise mit derselben Aussaatstärke und Düngermenge weiterplanen —
 * hektar, istHektar, Drill-Entries, Notizen und done sind schlag-spezifisch
 * und bleiben frisch. Die per-Tab Einheitsgröße folgt weiterhin der
 * Kultur-/Global-Settings-Logik (siehe tests/63-kultur-per-tab-kpe), und
 * Fahrgassen übernehmen den globalen Stand (keine Per-Tab-Vererbung).
 *
 * Diese Datei ergänzt tests/06-tab-management.test.js um fokussierte
 * Regressionstests, die das Zusammenspiel aus
 *   - syncStateFromInputs() läuft in addReiter() als erstes,
 *   - Vererbung liest direkt aus state.reiter[activeReiter],
 *   - nicht-vererbte Felder bleiben frisch,
 *   - mehrfaches addReiter() erbt jeweils vom aktuellen Vorgänger,
 *   - syncInputsFromState() im TAB_ADDED-Handler aktualisiert die Inputs,
 * anhand zusätzlicher Edge-Cases abdecken, die in 06 nicht vorkommen.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('addReiter: Vererbung koerner/duenger vom aktiven Reiter', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('erbt nur koerner und duenger; alle anderen Schlag-Felder bleiben frisch', () => {
    w.state.reiter[0].hektar = 12;
    w.state.reiter[0].istHektar = 11.5;
    w.state.reiter[0].koerner = 90000;
    w.state.reiter[0].duenger = 180;
    w.state.reiter[0].entries.push({ einheit: 1, duenger: 5, zaehlerStand: 1, time: 1 });
    w.state.reiter[0].done = true;
    w.state.reiter[0].notizen = 'kein Regen';
    w.state.activeReiter = 0;
    w.syncInputsFromState();

    w.addReiter();
    const r = w.state.reiter[1];

    expect(r.koerner).toBe(90000);
    expect(r.duenger).toBe(180);
    expect(r.hektar).toBe(0);
    expect(r.istHektar).toBe(0);
    expect(r.entries).toEqual([]);
    expect(r.done).toBe(false);
    expect(r.notizen).toBe('');
  });

  it('nimmt frisch getippte DOM-Werte via syncStateFromInputs() zuerst mit', () => {
    doc.getElementById('koerner').value = '95000';
    doc.getElementById('duenger').value = '210';
    w.addReiter();

    const r = w.state.reiter[1];
    expect(r.koerner).toBe(95000);
    expect(r.duenger).toBe(210);
  });

  it('aktualisiert die Eingabefelder nach addReiter (syncInputsFromState im TAB_ADDED-Handler)', () => {
    w.state.reiter[0].koerner = 105000;
    w.state.reiter[0].duenger = 220;
    w.state.activeReiter = 0;
    w.syncInputsFromState();

    doc.getElementById('hektar').value = '7,8';
    w.addReiter();

    expect(doc.getElementById('koerner').value).toBe('105000');
    expect(doc.getElementById('duenger').value).toBe('220');
    expect(doc.getElementById('hektar').value).toBe('');
  });

  it('kette: jeder neue Schlag erbt vom aktuell aktiven Vorgänger', () => {
    doc.getElementById('koerner').value = '90000';
    doc.getElementById('duenger').value = '200';
    w.addReiter();
    expect(w.state.reiter[1].koerner).toBe(90000);
    expect(w.state.reiter[1].duenger).toBe(200);

    doc.getElementById('koerner').value = '75000';
    doc.getElementById('duenger').value = '150';
    w.addReiter();
    expect(w.state.reiter[2].koerner).toBe(75000);
    expect(w.state.reiter[2].duenger).toBe(150);

    doc.getElementById('koerner').value = '65000';
    doc.getElementById('duenger').value = '120';
    w.addReiter();
    expect(w.state.reiter[3].koerner).toBe(65000);
    expect(w.state.reiter[3].duenger).toBe(120);
  });

  it('switchReiter + addReiter erbt vom explizit gesetzten Reiter, nicht vom ersten', () => {
    w.state.reiter.push({ name: 'Schlag 2', hektar: 0, istHektar: 0, koerner: 80000, duenger: 170, entries: [], done: false, koernerProEinheit: 50000, notizen: '' });
    w.state.reiter.push({ name: 'Schlag 3', hektar: 0, istHektar: 0, koerner: 60000, duenger: 140, entries: [], done: false, koernerProEinheit: 50000, notizen: '' });
    w.state.activeReiter = 2;
    w.syncInputsFromState();

    w.addReiter();
    const r = w.state.reiter[3];

    expect(r.koerner).toBe(60000);
    expect(r.duenger).toBe(140);
  });

  it('überschreiben der geerbten Werte via syncStateFromInputs() persistiert', () => {
    doc.getElementById('koerner').value = '90000';
    doc.getElementById('duenger').value = '200';
    w.addReiter();

    doc.getElementById('koerner').value = '55000';
    doc.getElementById('duenger').value = '110';
    w.syncStateFromInputs();

    expect(w.state.reiter[1].koerner).toBe(55000);
    expect(w.state.reiter[1].duenger).toBe(110);
  });

  it('0-Werte aus dem aktiven Reiter werden unverändert als 0 übernommen', () => {
    w.state.reiter[0].koerner = 0;
    w.state.reiter[0].duenger = 0;
    w.state.activeReiter = 0;
    w.syncInputsFromState();

    w.addReiter();
    expect(w.state.reiter[1].koerner).toBe(0);
    expect(w.state.reiter[1].duenger).toBe(0);

    w.state.reiter[1].koerner = 92000;
    w.state.reiter[1].duenger = 195;
    w.state.activeReiter = 1;
    w.syncInputsFromState();

    w.addReiter();
    expect(w.state.reiter[2].koerner).toBe(92000);
    expect(w.state.reiter[2].duenger).toBe(195);
  });

  it('koernerProEinheit wird vom Kultur-/Global-Setting initialisiert, nicht vom Vorgänger', () => {
    w.state.reiter[0].koerner = 85000;
    w.state.reiter[0].duenger = 175;
    w.state.reiter[0].koernerProEinheit = 80000;
    w.state.activeReiter = 0;
    w.syncInputsFromState();

    w.addReiter();
    const r = w.state.reiter[1];

    expect(r.koerner).toBe(85000);
    expect(r.duenger).toBe(175);
    expect(r.koernerProEinheit).toBe(50000);
  });

  it('fahrgassenEnabled und fahrgassenBreite folgen globalem Setting, nicht Per-Tab', () => {
    w.state.reiter[0].koerner = 85000;
    w.state.reiter[0].duenger = 175;
    w.state.reiter[0].fahrgassenEnabled = true;
    w.state.reiter[0].fahrgassenBreite = 36;
    w.state.fahrgassenEnabled = false;
    w.state.fahrgassenBreite = 0;
    w.state.activeReiter = 0;
    w.syncInputsFromState();

    w.addReiter();
    const r = w.state.reiter[1];

    expect(r.koerner).toBe(85000);
    expect(r.duenger).toBe(175);
    expect(r.fahrgassenEnabled).toBe(false);
    expect(r.fahrgassenBreite).toBe(0);
  });

  it('emit TAB_ADDED mit korrektem tabIdx (Index des neuen Reiters)', () => {
    w.state.reiter.push({ name: 'Schlag 2', hektar: 0, istHektar: 0, koerner: 77000, duenger: 160, entries: [], done: false, koernerProEinheit: 50000, notizen: '' });
    w.state.activeReiter = 1;
    w.syncInputsFromState();

    var seen = null;
    w.appOnStateChange(function(type, data) {
      if (type === 'TAB_ADDED') seen = data;
    });

    w.addReiter();
    expect(seen).toBeTruthy();
    expect(seen.tabIdx).toBe(2);
    expect(w.state.activeReiter).toBe(2);
  });

  it('addReiter von einem frisch initialisierten Tab erbt koerner=0, duenger=0', () => {
    w.addReiter();
    const r = w.state.reiter[1];
    expect(r.koerner).toBe(0);
    expect(r.duenger).toBe(0);
    expect(r.hektar).toBe(0);
    expect(r.istHektar).toBe(0);
    expect(r.entries).toEqual([]);
    expect(r.done).toBe(false);
    expect(r.notizen).toBe('');
  });
});
