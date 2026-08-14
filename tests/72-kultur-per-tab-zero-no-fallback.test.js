/**
 * Regression: getTabKoernerProEinheit(r) muss bei explizitem r.koernerProEinheit=0
 * 0 zurückgeben und NICHT auf den globalen Profil-Default zurückfallen.
 *
 * Hintergrund: ein per-Tab-0 ist die explizite Aussage „nicht angegeben"
 * (Sonstiges-Tabs vor User-Eingabe, oder User hat das Feld bewusst geleert).
 * Wenn der globale Profil-Default > 0 ist (Mais=50000, Raps=1.500.000), würde
 * ein Fallback irreführende Einheiten-Berechnungen aus einem vermeintlich
 * leeren Tab produzieren.
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

describe('Regression: per-Tab koernerProEinheit=0 fällt NICHT auf global zurück', () => {
  it('getTabKoernerProEinheit(r) = 0 wenn r.koernerProEinheit=0, auch wenn global > 0', () => {
    const { window: w } = createDom();
    w.state.koernerProEinheit = 50000; // global Default Mais
    const r = { koernerProEinheit: 0 };
    expect(w.getTabKoernerProEinheit(r)).toBe(0);
  });

  it('getTabKoernerProEinheit(r) = 0 wenn r.koernerProEinheit=0, auch wenn global=1500000 (Raps)', () => {
    const { window: w } = createDom();
    w.state.koernerProEinheit = 1500000;
    const r = { koernerProEinheit: 0 };
    expect(w.getTabKoernerProEinheit(r)).toBe(0);
  });

  it('getTabKoernerProEinheit(r) > 0 wenn r.koernerProEinheit > 0 (unverändert)', () => {
    const { window: w } = createDom();
    w.state.koernerProEinheit = 50000;
    const r = { koernerProEinheit: 75000 };
    expect(w.getTabKoernerProEinheit(r)).toBe(75000);
  });

  it('getTabKoernerProEinheit(r) fällt auf global zurück wenn r.koernerProEinheit undefined', () => {
    const { window: w } = createDom();
    w.state.koernerProEinheit = 80000;
    const r = {};
    expect(w.getTabKoernerProEinheit(r)).toBe(80000);
  });

  it('getTabKoernerProEinheit(r) fällt auf global zurück wenn r.koernerProEinheit NaN/string', () => {
    const { window: w } = createDom();
    w.state.koernerProEinheit = 80000;
    expect(w.getTabKoernerProEinheit({ koernerProEinheit: NaN })).toBe(80000);
    expect(w.getTabKoernerProEinheit({ koernerProEinheit: '50000' })).toBe(80000);
    expect(w.getTabKoernerProEinheit({ koernerProEinheit: undefined })).toBe(80000);
  });
});
