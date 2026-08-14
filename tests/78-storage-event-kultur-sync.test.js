/**
 * Regression: storage-Event-Handler in render-tabs.js muss remote
 * synchronisierte Kultur-State auch auf Badge, #koerner_empfehlung und
 * First-run-Modal konsistent anwenden.
 *
 * Bug-Beschreibung (bestätigter Review-Fehler):
 *   Beim Cross-Tab-Sync wurde der kultur-State bereits korrekt in
 *   AppGlobals.state übernommen (loadState-Pipeline), aber das DOM wurde
 *   NICHT aktualisiert:
 *     - #kultur_badge zeigte weiterhin die alte/leere Kultur
 *     - #koerner_empfehlung zeigte weiterhin den Text der alten Kultur
 *     - das First-run-Modal (#kultur_modal) blieb offen, obwohl der
 *       Remote-Tab längst eine gültige Kultur gesetzt hatte
 *     - umgekehrt: blieb das Modal zu, wenn der Remote-Tab die Auswahl
 *       verworfen hatte (kultur=null, erstauswahlDone=false)
 *
 *   Erwartet: der storage-Event-Handler muss dieselben Render-Aufrufe
 *   ausführen wie der Init-Pfad (renderKulturBadge, _renderKulturEmpfehlung,
 *   open/closeKulturFirstRun).
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

function fireStorageEvent(w, key, newValue) {
  const event = new w.Event('storage');
  event.key = key;
  event.newValue = newValue;
  event.oldValue = null;
  event.storageArea = w.localStorage;
  w.dispatchEvent(event);
}

describe('storage-Event sync: kultur Badge + Empfehlung + First-run-Modal', () => {
  it('remote sync mit gültiger Kultur (Raps) → Badge zeigt Raps, Empfehlung aktualisiert, First-run-Modal wird geschlossen', () => {
    const { window: w } = createDom();
    w.initUI();
    // Erwartet: first-run-Modal ist offen (kein gespeicherter State)
    const confirmModal = w.document.getElementById('kultur_modal');
    expect(confirmModal.classList.contains('open')).toBe(true);

    // Remote-Tab simulieren: hat zwischenzeitlich Raps gewählt
    const remote = JSON.parse(JSON.stringify(w.state));
    remote.kultur = 'raps';
    remote.erstauswahlDone = true;
    remote.koernerProEinheit = 1500000;
    fireStorageEvent(w, 'agrar_rechner', JSON.stringify(remote));

    // Badge umgestellt
    const badge = w.document.getElementById('kultur_badge');
    const emoji = w.document.getElementById('kultur_badge_emoji');
    const label = w.document.getElementById('kultur_badge_label');
    expect(badge.hidden).toBe(false);
    expect(emoji.textContent).toBe('🌼');
    expect(label.textContent).toBe('Raps');

    // Empfehlungstext aktualisiert
    const emp = w.document.getElementById('koerner_empfehlung');
    expect(emp.textContent).toContain('250.000');
    expect(emp.hidden).toBe(false);

    // First-run-Modal geschlossen
    expect(confirmModal.classList.contains('open')).toBe(false);
  });

  it('remote sync von Mais → Sonstiges → Empfehlung versteckt und Text leer', () => {
    const { window: w } = createDom();
    w.initUI();
    // Wähle Mais, damit wir überhaupt einen Remote-Sync sinnvoll triggern können
    w.chooseKultur('mais');
    // Snapshot mit Sonstiges aus dem "anderen Tab"
    const remote = JSON.parse(JSON.stringify(w.state));
    remote.kultur = 'sonstiges';
    remote.erstauswahlDone = true;
    remote.koernerProEinheit = 0;
    fireStorageEvent(w, 'agrar_rechner', JSON.stringify(remote));

    const emp = w.document.getElementById('koerner_empfehlung');
    // Sonstiges → keine Zahl sichtbar
    expect(/\d/.test(emp.textContent)).toBe(false);
    expect(emp.hidden).toBe(true);

    // Badge zeigt Sonstiges
    const emoji = w.document.getElementById('kultur_badge_emoji');
    const label = w.document.getElementById('kultur_badge_label');
    expect(emoji.textContent).toBe('🌱');
    expect(label.textContent).toBe('Sonstiges');
  });

  it('remote sync verwirft Auswahl (kultur=null, erstauswahlDone=false) → First-run-Modal öffnet sich', () => {
    const { window: w } = createDom();
    w.initUI();
    // User hatte bereits Mais gewählt
    w.chooseKultur('mais');
    const confirmModal = w.document.getElementById('kultur_modal');
    expect(confirmModal.classList.contains('open')).toBe(false);

    // Remote-Tab hat State komplett zurückgesetzt (kultur=null, erstauswahlDone=false)
    const remote = JSON.parse(JSON.stringify(w.state));
    remote.kultur = null;
    remote.erstauswahlDone = false;
    // state.koernerProEinheit: der "loadState-default" 50000 ist legitim;
    // wir testen nur das kultur-Feld-Verhalten
    fireStorageEvent(w, 'agrar_rechner', JSON.stringify(remote));

    // First-run-Modal ist wieder offen
    expect(confirmModal.classList.contains('open')).toBe(true);

    // Badge ist versteckt (kein gültiger Kultur-Key)
    const badge = w.document.getElementById('kultur_badge');
    expect(badge.hidden).toBe(true);
  });

  it('remote sync mit gleichem state → Badge bleibt unverändert (kein Re-Render-Flicker)', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('raps');
    const emoji = w.document.getElementById('kultur_badge_emoji').textContent;

    // Identischer state → storage-Event löst keinen JSON.stringify-Unterschied aus
    fireStorageEvent(w, 'agrar_rechner', JSON.stringify(w.state));
    expect(w.document.getElementById('kultur_badge_emoji').textContent).toBe(emoji);
  });
});
