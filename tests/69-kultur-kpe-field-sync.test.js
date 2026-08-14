/**
 * HIGH 3: Per-Tab-Editor ist im echten UI nicht per Tab synchron.
 *
 * Symptom: syncInputsFromState aktualisiert #koerner_pro_einheit nicht.
 *   Nach Wechsel von Tab A (kpe=75.000) zu Tab B (kpe=50.000) zeigt das
 *   Feld weiterhin 75.000 — eine Eingabe wäre irreführend.
 *
 * Fix: bei initUI und bei jedem Tabwechsel werden Feld, saved-Text und
 *   nötige UI-Zustände aus r.koernerProEinheit synchronisiert.
 * Tests über echte Handler/DOM, nicht nur direkte State-Zuweisung.
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

describe('HIGH 3: Per-Tab kpe-Feld wird bei jedem Tabwechsel synchronisiert', () => {
  it('Tab A=75000 → Tab B=50000: Feld zeigt nach switchReiter 50000', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.einheitGroesseToggle();  // Editor öffnen via echten Handler
    w.addReiter();
    w.state.reiter[1].koernerProEinheit = 75000;

    const kpEl = w.document.getElementById('koerner_pro_einheit');
    // addReiter setzt active=1, danach manuell auf 0 wechseln
    w.switchReiter(0);
    expect(kpEl.value).toBe('50000');
    // Tab 1 hat 75000
    w.switchReiter(1);
    expect(kpEl.value).toBe('75000');
    // zurück auf Tab 0 → wieder 50000 (HIGH 3: Sync nach jedem Wechsel)
    w.switchReiter(0);
    expect(kpEl.value).toBe('50000');
  });

  it('Tab A=0 (Sonstiges) → Tab B=1500000: Feld zeigt 1500000 nach switchReiter', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('sonstiges');
    w.einheitGroesseToggle();
    w.addReiter();
    // Tab 1: kpe=0 (Sonstiges Standard, manuell bestätigt)
    w.state.reiter[1].koernerProEinheit = 0;
    // Tab 0 auf 1.500.000 setzen
    w.state.reiter[0].koernerProEinheit = 1500000;

    const kpEl = w.document.getElementById('koerner_pro_einheit');
    // active=1 nach addReiter → kpe=0 → Feld leer
    expect(kpEl.value).toBe('');
    // auf Tab 0 wechseln → 1.500.000
    w.switchReiter(0);
    expect(kpEl.value).toBe('1500000');
    // zurück auf Tab 1 → wieder leer (kpe=0)
    w.switchReiter(1);
    expect(kpEl.value).toBe('');
  });

  it('saved-Text (#einheit_groesse_saved) wird beim Tabwechsel aktualisiert', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.einheitGroesseToggle();
    w.addReiter();
    w.state.reiter[1].koernerProEinheit = 75000;
    // syncInputsFromState manuell triggern (sonst zeigt DOM noch alten Wert)
    w.syncInputsFromState();

    const savedEl = w.document.getElementById('einheit_groesse_saved');
    // active=1 nach addReiter → kpe=75000 → saved-Text enthält 75.000
    expect(savedEl.textContent).toContain('75.000');
    // Tab 0 hat kpe=50000 → saved-Text sollte leer sein
    w.switchReiter(0);
    expect(savedEl.textContent).toBe('');
    // zurück zu Tab 1 → wieder 75.000
    w.switchReiter(1);
    expect(savedEl.textContent).toContain('75.000');
  });

  it('Bei initUI mit bestehendem Tab wird das Feld mit dem korrekten Wert gefüllt', () => {
    const { window: w, store } = createDom();
    // Pre-loaded state: zwei Tabs mit unterschiedlichen kpe
    store['agrar_rechner'] = JSON.stringify({
      _lv: 6,
      reiter: [
        { name: 'A', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false, koernerProEinheit: 75000 },
        { name: 'B', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false, koernerProEinheit: 1500000 }
      ],
      activeReiter: 1,
      activeView: null,
      kultur: 'mais',
      erstauswahlDone: true,
      koernerProEinheit: 50000,
      einheitGroesseEnabled: true,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      machineLog: [],
      drillPriorities: {}
    });
    w.initUI();
    // Tab B (active=1) ist aktiv → Feld zeigt 1.500.000
    const kpEl = w.document.getElementById('koerner_pro_einheit');
    expect(kpEl.value).toBe('1500000');
    // saved-Text: 1.500.000 Körner/Einheit
    const savedEl = w.document.getElementById('einheit_groesse_saved');
    expect(savedEl.textContent).toContain('1.500.000');
  });

  it('Field-Sync wird durch echten Handler ausgelöst, nicht durch direkte State-Zuweisung', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.einheitGroesseToggle();
    w.addReiter();
    w.state.reiter[1].koernerProEinheit = 75000;

    const kpEl = w.document.getElementById('koerner_pro_einheit');
    // addReiter setzt active=1; erst auf 0, dann zurück auf 1
    w.switchReiter(0);
    expect(kpEl.value).toBe('50000');
    w.switchReiter(1);
    expect(kpEl.value).toBe('75000');
    // Tab 0 manuell ändern
    w.state.reiter[0].koernerProEinheit = 90000;
    w.switchReiter(0);
    expect(kpEl.value).toBe('90000');
    // Zurück auf Tab 1 → wieder 75000
    w.switchReiter(1);
    expect(kpEl.value).toBe('75000');
  });

  it('Field-Sync via syncInputsFromState (TAB_CHANGED Subscriber)', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.einheitGroesseToggle();
    w.addReiter();
    w.state.reiter[1].koernerProEinheit = 75000;

    const kpEl = w.document.getElementById('koerner_pro_einheit');
    // addReiter setzt active=1
    w.syncInputsFromState();
    expect(kpEl.value).toBe('75000');
    w.switchReiter(0);
    expect(kpEl.value).toBe('50000');
    w.switchReiter(1);
    expect(kpEl.value).toBe('75000');
  });
});