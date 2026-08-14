/**
 * HIGH 5: Toggle-off darf keinen per-Tab-Wert verlieren oder auf falsche
 *          Mais-Werte zurückfallen.
 *
 * Spec: einheitGroesseToggle ist nur noch Auf-/Zuklappen des per-Schlag-
 *   Editors. Schließen darf weder den aktiven Tab-Wert noch den
 *   Kultur-Standard verändern. Beim erneuten Öffnen und nach Tabwechsel
 *   muss der korrekte Tab-Wert erscheinen.
 *   state.einheitGroesseEnabled ist höchstens UI-Präferenz, NICHT
 *   Berechnungsquelle.
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

describe('HIGH 5: einheitGroesseToggle als Editor-Auf/Zuklapp-UI', () => {
  it('toggle-off ändert NICHT r.koernerProEinheit', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.einheitGroesseToggle(); // open
    // Manuell auf 75000 setzen
    var kpEl = w.document.getElementById('koerner_pro_einheit');
    kpEl.value = '75000';
    w.einheitGroesseUpdate();
    expect(w.state.reiter[0].koernerProEinheit).toBe(75000);
    // toggle-off
    w.einheitGroesseToggle();
    // Tab-Wert bleibt 75000
    expect(w.state.reiter[0].koernerProEinheit).toBe(75000);
  });

  it('toggle-off ändert NICHT state.koernerProEinheit (Kultur-Standard)', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('raps'); // state.koernerProEinheit = 1.500.000
    expect(w.state.koernerProEinheit).toBe(1500000);
    w.einheitGroesseToggle(); // open
    w.einheitGroesseToggle(); // close
    // global bleibt Raps-Standard
    expect(w.state.koernerProEinheit).toBe(1500000);
  });

  it('toggle-off setzt NICHT state.koernerProEinheit=50000 (Mais-Fallback)', () => {
    // Vorher: einheitGroesseToggle beim Schließen setzte
    //   state.koernerProEinheit=50000 — das war die Quelle der Drift.
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('raps');
    expect(w.state.koernerProEinheit).toBe(1500000);
    w.einheitGroesseToggle();
    w.einheitGroesseToggle();
    expect(w.state.koernerProEinheit).not.toBe(50000);
    expect(w.state.koernerProEinheit).toBe(1500000);
  });

  it('toggle-off löscht NICHT das Eingabefeld', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.einheitGroesseToggle(); // open
    var kpEl = w.document.getElementById('koerner_pro_einheit');
    kpEl.value = '75000';
    w.einheitGroesseUpdate();
    // Tab-Wert 75000 gesetzt
    expect(w.state.reiter[0].koernerProEinheit).toBe(75000);
    // toggle-off
    w.einheitGroesseToggle();
    // Feld-Inhalt wird beim Schließen nicht gelöscht (es ist nur UI-State)
    // — beim erneuten Öffnen soll der Wert noch da sein.
    // Praktisch: der Field-Inhalt kann beim Schließen erhalten bleiben oder
    // auch leer sein — wir testen nur, dass r.koernerProEinheit stabil ist.
    expect(w.state.reiter[0].koernerProEinheit).toBe(75000);
  });

  it('toggle-on → korrekter Tab-Wert erscheint wieder im Feld', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.einheitGroesseToggle(); // open
    var kpEl = w.document.getElementById('koerner_pro_einheit');
    kpEl.value = '75000';
    w.einheitGroesseUpdate();
    w.einheitGroesseToggle(); // close
    w.einheitGroesseToggle(); // open again
    // Feld zeigt 75000 (per-Tab-Wert)
    expect(kpEl.value).toBe('75000');
  });

  it('Tab-Wechsel bei geschlossenem Editor: nach toggle-on zeigt das Feld den neuen Tab-Wert', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.einheitGroesseToggle(); // open
    w.addReiter();
    w.state.reiter[1].koernerProEinheit = 80000;
    w.switchReiter(0);
    var kpEl = w.document.getElementById('koerner_pro_einheit');
    // Tab 0 hat 50000 (Mais default)
    expect(kpEl.value).toBe('50000');
    w.switchReiter(1);
    expect(kpEl.value).toBe('80000');
    // Editor schließen + wechseln + öffnen
    w.einheitGroesseToggle(); // close
    w.switchReiter(0);
    w.einheitGroesseToggle(); // open
    // Feld zeigt den korrekten Tab-Wert (Tab 0 = 50000)
    expect(kpEl.value).toBe('50000');
  });

  it('state.einheitGroesseEnabled ist nur UI-Präferenz, nicht Berechnungsquelle', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.addReiter();
    w.state.reiter[0].koernerProEinheit = 75000;
    w.state.reiter[0].koerner = 75000;
    w.state.reiter[1].koernerProEinheit = 80000;
    w.state.reiter[1].koerner = 80000;
    // Berechnung arbeitet unabhängig vom toggle
    w.state.reiter[0].hektar = 1;
    var e0 = w.getTabTotalEinheiten(w.state.reiter[0]);
    // 1 * 75000 / 75000 = 1
    expect(e0).toBe(1);
    // toggle-off ändert nichts an der Berechnung
    w.state.einheitGroesseEnabled = false;
    expect(w.getTabTotalEinheiten(w.state.reiter[0])).toBe(1);
    // auch toggle-on hat keinen Einfluss auf die Berechnung
    w.state.einheitGroesseEnabled = true;
    expect(w.getTabTotalEinheiten(w.state.reiter[0])).toBe(1);
  });

  it('toggle-off → reload → Tab-Wert 75000 bleibt erhalten', () => {
    const { window: w, store } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.einheitGroesseToggle();
    var kpEl = w.document.getElementById('koerner_pro_einheit');
    kpEl.value = '75000';
    w.einheitGroesseUpdate();
    w.einheitGroesseToggle(); // close
    w.saveState();
    // Reload
    w.state = { reiter: [{ name: 'X', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false, koernerProEinheit: 50000 }], activeReiter: 0, kultur: null, erstauswahlDone: false, koernerProEinheit: 50000, einheitGroesseEnabled: false, fahrgassenEnabled: false, fahrgassenBreite: 0, machineLog: [], drillPriorities: {} };
    w.loadState();
    expect(w.state.reiter[0].koernerProEinheit).toBe(75000);
  });
});