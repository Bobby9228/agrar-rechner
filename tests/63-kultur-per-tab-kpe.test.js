/**
 * Per-Schlag Einheitsgröße: neuer Schlag übernimmt aktuellen Kultur-Standard.
 *
 * Feature-Spec:
 *   "Beim Anlegen eines neuen Schlags wird der aktuelle Kultur-Standard
 *    kopiert. ... Körner/ha bleibt bei jedem neuen Schlag leer/0."
 *
 * Konkret:
 *   - state.koernerProEinheit (vom Kultur-Profil gesetzt) wird auf
 *     r.koernerProEinheit des neuen Tabs kopiert
 *   - r.koerner bleibt 0 (Landwirt trägt später ein)
 *   - Bei Kultur-Wechsel bekommen NUR künftige Tabs den neuen Standard,
 *     bestehende Tabs behalten ihren Wert
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

describe('Neuer Schlag übernimmt aktuellen Kultur-Standard', () => {
  it('Frischer Erststart + Mais → neuer Tab hat r.koernerProEinheit=50000 und r.koerner=0', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.addReiter();
    const r = w.state.reiter[w.state.reiter.length - 1];
    expect(r.koernerProEinheit).toBe(50000);
    expect(r.koerner).toBe(0);
    expect(r.hektar).toBe(0);
    expect(r.duenger).toBe(0);
    expect(r.entries).toEqual([]);
  });

  it('Raps → neuer Tab hat r.koernerProEinheit=1.500.000', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('raps');
    w.addReiter();
    const r = w.state.reiter[w.state.reiter.length - 1];
    expect(r.koernerProEinheit).toBe(1500000);
  });

  it('Sonstiges → neuer Tab hat r.koernerProEinheit=0 (kein Default)', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('sonstiges');
    w.addReiter();
    const r = w.state.reiter[w.state.reiter.length - 1];
    expect(r.koernerProEinheit).toBe(0);
  });

  it('mehrere neue Tabs nach Kultur-Wechsel bekommen jeweils den aktuellen Standard', () => {
    const { window: w } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    w.addReiter();
    w.addReiter();
    w.addReiter();
    for (var i = 1; i < w.state.reiter.length; i++) {
      expect(w.state.reiter[i].koernerProEinheit).toBe(50000);
    }
  });

  it('Manuelle Einheitsgröße eines Tabs überlebt Tab-Wechsel und Reload', () => {
    const { window: w, store } = createDom();
    w.initUI();
    w.chooseKultur('mais');
    // Auf Tab 0 manuell ändern
    w.state.reiter[0].koernerProEinheit = 75000;
    // Neuen Tab hinzufügen → bekommt Mais-Standard 50000
    w.addReiter();
    // Zurück auf Tab 0
    w.switchReiter(0);
    expect(w.state.reiter[0].koernerProEinheit).toBe(75000);
    // Neuer Tab (Tab 1) hat Mais-Standard
    expect(w.state.reiter[1].koernerProEinheit).toBe(50000);
    // Save + reload
    w.saveState();
    const saved = JSON.parse(store['agrar_rechner']);
    expect(saved.reiter[0].koernerProEinheit).toBe(75000);
    expect(saved.reiter[1].koernerProEinheit).toBe(50000);
  });
});