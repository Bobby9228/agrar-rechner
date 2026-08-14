/**
 * Kultur profiles: Mais / Raps / Sonstiges
 *
 * Feature: globale Kultur-Auswahl mit persistentem Standard
 *   - Mais: 50.000 Körner/Einheit, Empfehlung "üblich: 80.000 – 100.000"
 *   - Raps: 1.500.000 Körner/Einheit, Empfehlung "üblich: 250.000 – 350.000"
 *   - Sonstiges: 0/leer (kein numerischer Default, keine numerische Empfehlung)
 *
 * Die Profile sind die Quelle der Wahrheit für den Kultur-Standard.
 * Beim Anlegen eines neuen Schlags wird der aktuelle Kultur-Default
 * (Körner pro Einheit) auf den neuen Schlag kopiert — `r.koerner` selbst
 * bleibt 0/leer, der Landwirt trägt das später manuell ein.
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

describe('Kultur-Profile (Mais / Raps / Sonstiges)', () => {
  it('exposes a Mais profile with 50.000 Körner/Einheit', () => {
    const { window: w } = createDom();
    const p = w.getCultureProfile('mais');
    expect(p).toBeTruthy();
    expect(p.defaultKoernerProEinheit).toBe(50000);
    expect(p.empfehlung).toContain('80.000');
    expect(p.empfehlung).toContain('100.000');
  });

  it('exposes a Raps profile with 1.500.000 Körner/Einheit', () => {
    const { window: w } = createDom();
    const p = w.getCultureProfile('raps');
    expect(p).toBeTruthy();
    expect(p.defaultKoernerProEinheit).toBe(1500000);
    expect(p.empfehlung).toContain('250.000');
    expect(p.empfehlung).toContain('350.000');
  });

  it('exposes a Sonstiges profile with 0/empty default and no numeric recommendation', () => {
    const { window: w } = createDom();
    const p = w.getCultureProfile('sonstiges');
    expect(p).toBeTruthy();
    expect(p.defaultKoernerProEinheit).toBe(0);
    // Sonstiges hat keine numerische Empfehlung — kann leer sein oder
    // qualitativ (z.B. "individuell"), aber darf KEINE Zahl enthalten.
    if (p.empfehlung) {
      expect(/\d/.test(p.empfehlung)).toBe(false);
    }
  });

  it('returns a label and emoji per culture for the UI badge', () => {
    const { window: w } = createDom();
    expect(w.getCultureLabel('mais')).toBe('Mais');
    expect(w.getCultureLabel('raps')).toBe('Raps');
    expect(w.getCultureLabel('sonstiges')).toBe('Sonstiges');
    expect(w.getCultureEmoji('mais')).toBeTruthy();
    expect(w.getCultureEmoji('raps')).toBeTruthy();
    expect(w.getCultureEmoji('sonstiges')).toBeTruthy();
  });

  it('returns the default kpe for a given culture', () => {
    const { window: w } = createDom();
    expect(w.getDefaultKoernerProEinheit('mais')).toBe(50000);
    expect(w.getDefaultKoernerProEinheit('raps')).toBe(1500000);
    expect(w.getDefaultKoernerProEinheit('sonstiges')).toBe(0);
  });

  it('returns the recommendation text for a given culture', () => {
    const { window: w } = createDom();
    expect(w.getCultureEmpfehlung('mais')).toContain('80.000');
    expect(w.getCultureEmpfehlung('mais')).toContain('100.000');
    expect(w.getCultureEmpfehlung('raps')).toContain('250.000');
    expect(w.getCultureEmpfehlung('raps')).toContain('350.000');
  });

  it('getCultureProfile returns null for unknown culture keys', () => {
    const { window: w } = createDom();
    expect(w.getCultureProfile('unknown')).toBeNull();
    expect(w.getCultureProfile(null)).toBeNull();
  });
});