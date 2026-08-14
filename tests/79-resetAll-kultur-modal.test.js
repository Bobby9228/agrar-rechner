/**
 * Regression: resetAll() muss sofort nach dem Reset Badge/Empfehlung
 * aktualisieren und den verpflichtenden First-run-Kulturdialog öffnen,
 * ohne Reload oder manuelles initUI.
 *
 * Bug-Beschreibung (bestätigter Review-Fehler):
 *   resetAll() hat state komplett zurückgesetzt (kultur=null,
 *   erstauswahlDone=false) und renders/repaint durchgeführt — aber
 *   - das Kultur-Badge wurde nicht neu gerendert (zeigte weiterhin die
 *     alte Kultur mit Emoji/Label)
 *   - der Empfehlungstext wurde nicht aktualisiert (zeigte weiterhin
 *     z.B. "80.000 – 100.000" obwohl gar keine Kultur mehr gewählt war)
 *   - das First-run-Modal wurde NICHT geöffnet. Der Landwirt sah einen
 *     vermeintlich leeren Rechner und konnte sofort Daten eingeben,
 *     obwohl der State vorsah, dass die Kultur zwingend zu wählen ist.
 *   Im Production-Fall half hier nur ein Reload, der dann initUI()
 *   samt First-run-Modal-Pfad nachzog.
 *
 *   Erwartet: resetAll() muss dieselbe Badge/Empfehlung/Modal-Aktualisierung
 *   triggern, die auch der initUI-Pfad am Ende ausführt. Kein Reload,
 *   kein manueller Re-Init-Aufruf.
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

describe('resetAll() aktualisiert Kultur-UI sofort (Badge, Empfehlung, First-run-Modal)', () => {
  it('nach resetAll() mit vorher gewählter Kultur: Badge ist versteckt, Modal ist offen', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('raps');
    // Vor resetAll: Badge sichtbar, Modal zu
    const badge = w.document.getElementById('kultur_badge');
    expect(badge.hidden).toBe(false);
    const modal = w.document.getElementById('kultur_modal');
    expect(modal.classList.contains('open')).toBe(false);

    w.resetAll();

    // State korrekt zurückgesetzt
    expect(w.state.kultur).toBeNull();
    expect(w.state.erstauswahlDone).toBe(false);

    // Badge versteckt (kein gültiger Kultur-Key)
    expect(badge.hidden).toBe(true);

    // First-run-Modal geöffnet
    expect(modal.classList.contains('open')).toBe(true);
  });

  it('nach resetAll(): Empfehlungstext #koerner_empfehlung ist verborgen (kultur=null)', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    const emp = w.document.getElementById('koerner_empfehlung');
    expect(emp.textContent).toContain('80.000');
    expect(emp.hidden).toBe(false);

    w.resetAll();

    // Nach resetAll: keine gültige Kultur → Empfehlung versteckt und leer
    expect(emp.hidden).toBe(true);
    expect(emp.textContent).toBe('');
  });

  it('nach resetAll() auf Frisch-Install: Modal öffnet sich, Badge versteckt, Empfehlung versteckt', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('sonstiges'); // kultur + erstauswahlDone = true
    // Modal ist zu (Erstauswahl bereits erledigt)
    expect(w.document.getElementById('kultur_modal').classList.contains('open')).toBe(false);

    w.resetAll();

    // First-run-Modal muss GEÖFFNET sein (sonst kann der Nutzer nicht weiterarbeiten)
    const modal = w.document.getElementById('kultur_modal');
    expect(modal.classList.contains('open')).toBe(true);

    // Badge versteckt
    expect(w.document.getElementById('kultur_badge').hidden).toBe(true);

    // Empfehlung versteckt
    const emp = w.document.getElementById('koerner_empfehlung');
    expect(emp.hidden).toBe(true);
  });

  it('resetAll() muss NICHT auf initUI() angewiesen sein (kein Reload nötig)', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('raps');
    // Kein zweiter initUI()-Aufruf erfolgt hier — Reset muss eigenständig wirken
    w.resetAll();

    // Trotzdem: Modal ist offen, Badge ist versteckt
    expect(w.document.getElementById('kultur_modal').classList.contains('open')).toBe(true);
    expect(w.document.getElementById('kultur_badge').hidden).toBe(true);
  });

  it('resetAll() öffnet das Modal auch dann, wenn vorher schon ein Reset-Modal geöffnet war', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('raps');
    // Reset-Modal manuell öffnen (per Code-Pfad: openResetModal)
    w.openResetModal();
    // "Alle Daten löschen" klicken → _onResetAll() → resetAll()
    w._onResetAll();
    // First-run-Modal ist jetzt offen
    const modal = w.document.getElementById('kultur_modal');
    expect(modal.classList.contains('open')).toBe(true);
    // Reset-Modal selbst wurde durch _onResetAll() geschlossen
    expect(w.document.getElementById('reset_modal').classList.contains('open')).toBe(false);
  });
});
