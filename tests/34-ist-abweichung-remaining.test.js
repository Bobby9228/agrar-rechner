/**
 * Tests for IST<SOLL remaining display in renderResults().
 *
 * DIAGNOSTIC FINDINGS (verified on 2026-05-04):
 *
 * Key facts:
 * - koernerProEinheit = 50000 (default, set by einheitGroesseUpdate when input is empty)
 * - SOLL_units = r.hektar * r.koerner / 50000
 * - IST_units  = r.istHektar * r.koerner / 50000  (only when istHektar > 0)
 * - remaining = max(0, IST_units - (used + carryover.savedEinheit + carryover.excessEinheit))
 *
 * With koerner=80000, hektar=10:
 * - SOLL_units = 10 * 80000 / 50000 = 16.0
 * - IST_units (istHektar=10) = 16.0
 * - IST_units (istHektar=7)  = 11.2
 * - IST_units (istHektar=12) = 19.2
 *
 * Carryover logic (getCarryover(idx) returns savings FOR tab idx):
 * - Tab i's own savings = max(0, SOLL_units_i - IST_units_i) when IST<SOLL
 * - These savings are distributed to NOT-yet-done tabs (cascading forward)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('IST<SOLL remaining display', () => {
  let w, doc;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
    w.initUI();
  });

  // ── SOLL/IST/DIFF section ────────────────────────────────────────────────

  it('soll-ist section hidden when no istHektar', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('ist_hektar').value = '';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200';
    w.berechne();
    expect(doc.getElementById('r_soll_ist_section').style.display).toBe('none');
  });

  it('soll-ist section visible when istHektar is set', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('ist_hektar').value = '7';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200';
    w.berechne();
    expect(doc.getElementById('r_soll_ist_section').style.display).toBe('block');
  });

  it('soll-ist section shows correct SOLL hectare', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('ist_hektar').value = '7';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200';
    w.berechne();
    expect(doc.getElementById('r_soll_ha').textContent).toBe('10,0 ha');
  });

  it('soll-ist section shows correct IST hectare', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('ist_hektar').value = '7';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200';
    w.berechne();
    expect(doc.getElementById('r_ist_ha').textContent).toBe('7,0 ha');
  });

  it('soll-ist section shows negative diff with negative class', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('ist_hektar').value = '7';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200';
    w.berechne();
    expect(doc.getElementById('r_diff_ha').textContent).toBe('-3,0 ha');
    expect(doc.getElementById('r_diff_ha').className).toContain('negative');
  });

  it('soll-ist section shows positive diff with plus sign', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('ist_hektar').value = '12';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200';
    w.berechne();
    expect(doc.getElementById('r_diff_ha').textContent).toBe('+2,0 ha');
    expect(doc.getElementById('r_diff_ha').className).toContain('positive');
  });

  it('soll-ist section shows +0,0 ha for zero diff (positive class)', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('ist_hektar').value = '10';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200';
    w.berechne();
    // Code shows +0,0 ha when diff is 0 (always uses positive class)
    expect(doc.getElementById('r_diff_ha').textContent).toBe('+0,0 ha');
  });

  // ── Remaining units (koerner=80000, koernerProEinheit=50000 → factor=1.6) ───

  /**
   * SOLL=10, IST=10, koerner=80000 → SOLL_units=IST_units=16.0
   * Entry: 3.0 → remaining = max(0, 16.0 - 3.0) = 13.0
   */
  it('remaining = 13.0 when SOLL=IST=10 and 3.0 units used', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('ist_hektar').value = '10';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200';
    w.berechne();
    w.getActiveReiter().entries.push({ einheit: 3.0, zaehlerStand: 1.875, duenger: 0, time: '09:00' });
    w.renderResults();
    expect(doc.getElementById('r_drill_e_rem').textContent).toBe('13,0 Einheiten');
  });

  /**
   * SOLL=10, IST=10 → SOLL_units=16.0
   * Entry: 16.0 → remaining = max(0, 16.0 - 16.0) = 0
   */
  it('remaining = 0 when exactly filled to SOLL', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('ist_hektar').value = '10';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200';
    w.berechne();
    w.getActiveReiter().entries.push({ einheit: 16.0, zaehlerStand: 10, duenger: 0, time: '10:00' });
    w.renderResults();
    expect(doc.getElementById('r_drill_e_rem').textContent).toBe('0,0 Einheiten');
  });

  /**
   * SOLL=10, IST=12 → SOLL_units=16.0, IST_units=19.2
   * Entry: 16.0 → remaining = max(0, 19.2 - 16.0) = 3.2
   */
  it('remaining = 0 when IST>SOLL (excess covers SOLL shortfall)', () => {
    // SOLL=10, IST=12, koerner=80000 → SOLL_units=16, IST_units=19.2, excess=3.2
    // Entry: 16.0 → effectiveUsed = 16.0 + 3.2 (excess) = 19.2
    // remaining = max(0, 19.2 - 19.2) = 0
    doc.getElementById('hektar').value = '10';
    doc.getElementById('ist_hektar').value = '12';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200';
    w.berechne();
    w.getActiveReiter().entries.push({ einheit: 16.0, zaehlerStand: 10, duenger: 0, time: '10:00' });
    w.renderResults();
    expect(doc.getElementById('r_drill_e_rem').textContent).toBe('0,0 Einheiten');
  });

  /**
   * SOLL=10, IST=12 → IST_units=19.2
   * Entry: 19.2 → remaining = max(0, 19.2 - 19.2) = 0
   */
  it('remaining = 0 when IST units exactly filled', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('ist_hektar').value = '12';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200';
    w.berechne();
    w.getActiveReiter().entries.push({ einheit: 19.2, zaehlerStand: 12, duenger: 0, time: '10:00' });
    w.renderResults();
    expect(doc.getElementById('r_drill_e_rem').textContent).toBe('0,0 Einheiten');
  });

  /**
   * SOLL=10, IST=7 → SOLL_units=16.0, IST_units=11.2, carryover=4.8
   * Entry: 11.2 (fills IST) → effectiveUsed=11.2+4.8=16.0 → remaining=max(0,11.2-16.0)=0
   */
  it('remaining = 0 when IST<SOLL and IST units covered by entry+carryover', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('ist_hektar').value = '7';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200';
    w.berechne();
    w.getActiveReiter().entries.push({ einheit: 11.2, zaehlerStand: 7, duenger: 0, time: '09:00' });
    w.renderResults();
    expect(doc.getElementById('r_drill_e_rem').textContent).toBe('0,0 Einheiten');
  });

  // ── Multi-entry ──────────────────────────────────────────────────────────

  /**
   * SOLL=10, IST=10 → 16.0 units
   * Entry1: 6.0, Entry2: 6.0 → total 12.0 → remaining = 4.0
   */
  it('remaining = 4.0 after two partial entries', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('ist_hektar').value = '10';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200';
    w.berechne();
    const r = w.getActiveReiter();
    r.entries.push({ einheit: 6.0, zaehlerStand: 3.75, duenger: 0, time: '09:00' });
    r.entries.push({ einheit: 6.0, zaehlerStand: 7.5, duenger: 0, time: '10:00' });
    w.renderResults();
    expect(doc.getElementById('r_drill_e_rem').textContent).toBe('4,0 Einheiten');
  });

  // ── Carryover hint ───────────────────────────────────────────────────────

  it('carryover hint not shown when no carryover', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('ist_hektar').value = '10';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200';
    w.berechne();
    w.getActiveReiter().entries.push({ einheit: 16.0, zaehlerStand: 10, duenger: 0, time: '10:00' });
    w.renderResults();
    expect(doc.getElementById('r_info').textContent).not.toMatch(/carryover|gespart|übrig/i);
  });
});
