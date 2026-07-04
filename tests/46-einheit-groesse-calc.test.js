/**
 * Tests for variable koernerProEinheit values and their impact on calculations.
 *
 * Coverage: Bisher nur UI/Toggle-Tests in test/24.
 * Diese Datei: Berechnungs-logische Auswirkungen auf SOLL/IST/Remaining/carryover.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Variable koernerProEinheit — calculation impact', () => {
  let w, doc;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
    w.initUI();
  });

  // ── SOLL/IST/Einheiten with different koernerProEinheit ──────────────────

  /**
   * Default: koernerProEinheit = 50000
   * 10 ha × 80000 Körner → 800000 / 50000 = 16.0 Einheiten
   */
  it('SOLL einheiten = 16.0 with default (50000)', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200';
    w.berechne();
    expect(doc.getElementById('r_einheiten').textContent).toBe('16,0 Einheiten');
  });

  /**
   * koernerProEinheit = 100000
   * 10 ha × 80000 Körner → 800000 / 100000 = 8.0 Einheiten
   */
  it('SOLL einheiten = 8.0 when koernerProEinheit = 100000', () => {
    doc.getElementById('koerner_pro_einheit').value = '100000';
    w.einheitGroesseUpdate();
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200';
    w.berechne();
    expect(doc.getElementById('r_einheiten').textContent).toBe('8,0 Einheiten');
  });

  /**
   * koernerProEinheit = 40000
   * 10 ha × 80000 Körner → 800000 / 40000 = 20.0 Einheiten
   */
  it('SOLL einheiten = 20.0 when koernerProEinheit = 40000', () => {
    doc.getElementById('koerner_pro_einheit').value = '40000';
    w.einheitGroesseUpdate();
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200';
    w.berechne();
    expect(doc.getElementById('r_einheiten').textContent).toBe('20,0 Einheiten');
  });

  /**
   * koernerProEinheit = 25000 (4 units per ha)
   * 10 ha × 80000 Körner → 800000 / 25000 = 32.0 Einheiten
   */
  it('SOLL einheiten = 32.0 when koernerProEinheit = 25000', () => {
    doc.getElementById('koerner_pro_einheit').value = '25000';
    w.einheitGroesseUpdate();
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200';
    w.berechne();
    expect(doc.getElementById('r_einheiten').textContent).toBe('32,0 Einheiten');
  });

  // ── Remaining display with different koernerProEinheit ───────────────────

  /**
   * koernerProEinheit = 100000
   * SOLL = 10 ha × 80000 / 100000 = 8.0 units
   * Entry 5.0 → remaining = 8.0 - 5.0 = 3.0
   */
  it('remaining = 3.0 with koernerProEinheit = 100000', () => {
    doc.getElementById('koerner_pro_einheit').value = '100000';
    w.einheitGroesseUpdate();
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200';
    w.berechne();
    w.getActiveReiter().entries.push({ einheit: 5.0, zaehlerStand: 6.25, duenger: 0, time: '09:00' });
    w.renderResults();
    expect(doc.getElementById('r_drill_e_rem').textContent).toBe('3,0 Einheiten');
  });

  /**
   * koernerProEinheit = 25000
   * SOLL = 10 ha × 80000 / 25000 = 32.0 units
   * Entry 20.0 → remaining = 32.0 - 20.0 = 12.0
   */
  it('remaining = 12.0 with koernerProEinheit = 25000', () => {
    doc.getElementById('koerner_pro_einheit').value = '25000';
    w.einheitGroesseUpdate();
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200';
    w.berechne();
    w.getActiveReiter().entries.push({ einheit: 20.0, zaehlerStand: 6.25, duenger: 0, time: '09:00' });
    w.renderResults();
    expect(doc.getElementById('r_drill_e_rem').textContent).toBe('12,0 Einheiten');
  });

  // ── IST<SOLL carryover with different koernerProEinheit ─────────────────

  /**
   * koernerProEinheit = 100000
   * SOLL=10 ha (8.0 units), IST=7 ha (5.6 units)
   * Entry 3.0 units
   *
   * REMOVED (#378 Regel-7): 'carryover savings scaled correctly with
   *   koernerProEinheit = 100000' — Phase-1 Ersparnis-Subtraktion ist
   *   gelöscht. Unter Regel 7 ist `savedEinheit=0`; remaining basiert rein
   *   auf IST - used (ohne Carryover-Subtraktion).
   *   Vor #378: remaining = max(0, 5.6 - 3.0 - 2.4) = 0.2
   *   Nach #378: remaining = max(0, 5.6 - 3.0) = 2.6
   */
  it('remaining = IST - used with koernerProEinheit = 100000 (Regel 7, kein savings-carryover)', () => {
    doc.getElementById('koerner_pro_einheit').value = '100000';
    w.einheitGroesseUpdate();
    doc.getElementById('hektar').value = '10';
    doc.getElementById('ist_hektar').value = '7';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200';
    w.berechne();
    w.getActiveReiter().entries.push({ einheit: 3.0, zaehlerStand: 3.75, duenger: 0, time: '09:00' });
    w.renderResults();
    // Regel 7: remaining = max(0, istE - usedE) = max(0, 5.6 - 3.0) = 2.6
    expect(doc.getElementById('r_drill_e_rem').textContent).toBe('2,6 Einheiten');
  });

  // ── IST-Fläche-Basis für Remaining (Issue #184) ─────────────────────────

  /**
   * Issue #184: Wenn IST gesetzt ist, muss remaining auf IST basieren, nicht SOLL.
   * SOLL=18,5 ha → 33,3 E, IST=18,0 ha → 32,4 E, used=30 E
   *
   * REMOVED (#378 Regel-7): Carryover-Subtraktion aus dem Pin. Unter Regel 7
   *   ist `savedEinheit=0`, also: remaining = max(0, 32,4 - 30) = 2,4
   *   (IST-basiert, ohne Carryover-Subtraktion).
   *   Vor #378: max(0, 32,4 - 30 - 0,9) = 1,5 E (Carryover-Subtraktion aktiv)
   *   Nach #378: max(0, 32,4 - 30) = 2,4 E (Regel 7: nur IST - used)
   *
   *   Der Pin auf IST-BASIS bleibt erhalten (Issue #184) — die Subtraktion
   *   der SOLL-IST-Ersparnis (Issue #305) ist unter Regel 7 obsolet.
   */
  it('remaining uses IST as basis when IST<SOLL (issue #184)', () => {
    // DE format: hektar='18,5', ist_hektar='18,0', koerner='90.000'
    doc.getElementById('hektar').value = '18,5';
    doc.getElementById('ist_hektar').value = '18,0';
    doc.getElementById('koerner').value = '90.000';
    doc.getElementById('duenger').value = '2.000';
    w.berechne();
    w.getActiveReiter().entries.push({ einheit: 30.0, zaehlerStand: 18.0, duenger: 0, time: '09:00' });
    w.renderResults();
    // IST=18,0 ha → 32,4 E, used=30, savings=0 (Regel 7) → remaining = 32,4 - 30 = 2,4
    expect(doc.getElementById('r_drill_e_rem').textContent).toBe('2,4 Einheiten');
  });

  // ── Changing koernerProEinheit after entries exist ──────────────────────

  /**
   * Change koernerProEinheit mid-session should re-render and update remaining.
   * Start: 10 ha × 80000 with koernerProEinheit=50000 → 16.0 units
   * Change to koernerProEinheit=100000 → now 8.0 units needed
   * Existing entry of 8.0 units would then exactly fill.
   */
  it('changing koernerProEinheit re-renders results with new calculation', () => {
    // Setup: 10 ha, 80000, koernerProEinheit=50000 → 16.0 units
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200';
    w.berechne();
    w.getActiveReiter().entries.push({ einheit: 8.0, zaehlerStand: 5, duenger: 0, time: '09:00' });
    w.renderResults();

    // Remaining should be 16.0 - 8.0 = 8.0
    expect(doc.getElementById('r_drill_e_rem').textContent).toBe('8,0 Einheiten');

    // Change koernerProEinheit to 100000 → now 8.0 units needed
    doc.getElementById('koerner_pro_einheit').value = '100000';
    w.einheitGroesseUpdate();

    // Remaining should now be 0 (8.0 needed, 8.0 used)
    expect(doc.getElementById('r_drill_e_rem').textContent).toBe('0,0 Einheiten');
  });

  // ── Dünger unaffected by koernerProEinheit ───────────────────────────────

  /**
   * koernerProEinheit only affects seed units, not fertilizer.
   * Dünger stays in kg, based on r.duenger directly.
   */
  it('duenger display is unaffected by koernerProEinheit change', () => {
    doc.getElementById('koerner_pro_einheit').value = '100000';
    w.einheitGroesseUpdate();
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '300';
    w.berechne();

    // Dünger = 10 ha × 300 kg = 3000 kg (unaffected by koernerProEinheit)
    expect(doc.getElementById('r_duenger').textContent).toBe('3.000 kg');
  });

  // ── Edge: fractional units rounding ──────────────────────────────────────

  /**
   * 10 ha × 83000 Körner / 50000 = 16.6 units
   * Should round to 16,6 (one decimal place)
   */
  it('handles fractional SOLL units correctly', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '83000';
    doc.getElementById('duenger').value = '200';
    w.berechne();
    // 10*83000/50000 = 16.6
    expect(doc.getElementById('r_einheiten').textContent).toBe('16,6 Einheiten');
  });

  /**
   * 10 ha × 83000 Körner / 100000 = 8.3 units
   */
  it('handles fractional SOLL units with koernerProEinheit = 100000', () => {
    doc.getElementById('koerner_pro_einheit').value = '100000';
    w.einheitGroesseUpdate();
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '83000';
    doc.getElementById('duenger').value = '200';
    w.berechne();
    // 10*83000/100000 = 8.3
    expect(doc.getElementById('r_einheiten').textContent).toBe('8,3 Einheiten');
  });

  // ── Dashboard with different koernerProEinheit ───────────────────────────

  /**
   * Dashboard total should reflect the current koernerProEinheit.
   * With koernerProEinheit=100000, 10 ha × 80000 → 8.0 units per tab.
   */
  it('dashboard shows correct total with koernerProEinheit = 100000', () => {
    doc.getElementById('koerner_pro_einheit').value = '100000';
    w.einheitGroesseUpdate();
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200';
    w.berechne();

    w.openDashboard();
    const content = doc.getElementById('dashboard_content').textContent;
    // Total should show 8 Einheiten (not 16,0). fmtCompact strips trailing ",0"
    // for integer values, so the text contains "8" but not "8,0".
    expect(content).toMatch(/8(?![,\d])/);
    expect(content).not.toMatch(/16/);
  });
});
