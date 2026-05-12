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
   * carryover saved = 8.0 - 5.6 = 2.4 units
   * Entry 3.0 → effectiveUsed = 3.0 + 2.4 = 5.4
   * remaining = max(0, 5.6 - 5.4) = 0.2
   */
  it('carryover savings scaled correctly with koernerProEinheit = 100000', () => {
    doc.getElementById('koerner_pro_einheit').value = '100000';
    w.einheitGroesseUpdate();
    doc.getElementById('hektar').value = '10';
    doc.getElementById('ist_hektar').value = '7';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200';
    w.berechne();
    w.getActiveReiter().entries.push({ einheit: 3.0, zaehlerStand: 3.75, duenger: 0, time: '09:00' });
    w.renderResults();
    // remaining = max(0, IST - used) = max(0, 5.6 - 3.0) = 2.6
    // (saved carryover is NOT subtracted from remaining — IST basis already accounts for field size)
    expect(doc.getElementById('r_drill_e_rem').textContent).toBe('2,6 Einheiten');
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
    // Total should show 8,0 Einheiten (not 16,0)
    expect(content).toMatch(/8,0/);
    expect(content).not.toMatch(/16,0/);
  });
});
