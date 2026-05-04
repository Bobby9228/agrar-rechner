/**
 * Tests for zaehlerUpdate() edge cases.
 *
 * MEDIUM: zaehlerUpdate() handles counter (Zähler) updates with negative delta
 * and IST/SOLL deviation display.
 *
 * Note: zaehlerUpdate reads from DOM input 'zaehler_stand', not from state directly.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('zaehlerUpdate edge cases', () => {
  let w, doc, store;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
    store = result.store;
  });

  function setCounterValue(val) {
    doc.getElementById('zaehler_stand').value = String(val);
  }

  function calculate(sollHa, istHa, koerner, duenger = 200) {
    doc.getElementById('hektar').value = String(sollHa);
    doc.getElementById('ist_hektar').value = istHa > 0 ? String(istHa) : '';
    doc.getElementById('koerner').value = String(koerner);
    doc.getElementById('duenger').value = duenger > 0 ? String(duenger) : '0';
    w.berechne();
  }
  it('shows negative delta class when counter decreases', () => {
    setCounterValue(10);
    w.zaehlerUpdate();

    setCounterValue(7);
    w.zaehlerUpdate();

    const deltaEl = doc.getElementById('z_ist');
    expect(deltaEl.className).toContain('negative');
  });

  it('shows positive delta class when counter increases', () => {
    setCounterValue(10);
    w.zaehlerUpdate();

    setCounterValue(15);
    w.zaehlerUpdate();

    const deltaEl = doc.getElementById('z_ist');
    expect(deltaEl.className).toContain('positive');
  });

  it('handles delta of exactly 0', () => {
    setCounterValue(10);
    w.zaehlerUpdate();

    setCounterValue(10);
    w.zaehlerUpdate();

    const deltaEl = doc.getElementById('z_ist');
    expect(deltaEl.className).toBe('delta-value positive');
    expect(deltaEl.textContent).toBe('0,0 ha');
  });

  it('hides SOLL/IST section when SOLL hektar is 0', () => {
    w.state.reiter[0].hektar = 0;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].entries = [];

    setCounterValue(10);
    w.zaehlerUpdate();

    const sollIstEl = doc.getElementById('zaehler_soll_ist');
    expect(sollIstEl.style.display).toBe('none');
  });

  it('shows SOLL/IST section when SOLL > 0', () => {
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].entries = [];

    setCounterValue(5);
    w.zaehlerUpdate();

    const sollIstEl = doc.getElementById('zaehler_soll_ist');
    expect(sollIstEl.style.display).toBe('block');
  });

  // zaehlerUpdate: sets state.zaehlerstand from DOM, computes zaehler_diff = new - old
  // then renders z_diff = istHa - sollHa (using zaehler_diff NOT the istHektar-soll diff)

  it('displays negative diff when SOLL > IST (istHektar set from prior berechne)', () => {
    // SOLL=10, IST=7 → z_diff = istHa - sollHa = 7 - 10 = -3
    calculate(10, 7, 80000);
    doc.getElementById('zaehler_stand').value = '5';
    w.zaehlerUpdate();
    const diffEl = doc.getElementById('z_diff');
    expect(diffEl.textContent).toBe('-3,0 ha');
    expect(diffEl.className).toContain('negative');
  });

  it('displays negative diff when SOLL > 0 and IST not set (istHektar=0)', () => {
    // SOLL=5, IST=0 → z_diff = istHa - sollHa = 0 - 5 = -5
    calculate(5, 0, 80000);
    doc.getElementById('zaehler_stand').value = '10';
    w.zaehlerUpdate();
    const diffEl = doc.getElementById('z_diff');
    expect(diffEl.textContent).toBe('-5,0 ha');
    expect(diffEl.className).toContain('negative');
  });

  it('saves state after update', () => {
    setCounterValue(10);
    w.zaehlerUpdate();

    const saved = JSON.parse(store['mais_rechner']);
    expect(saved.zaehlerstand).toBe(10);
  });

  it('hides zaehler_result for empty counter value', () => {
    doc.getElementById('zaehler_stand').value = '';
    w.zaehlerUpdate();

    expect(doc.getElementById('zaehler_result').style.display).toBe('none');
  });

  it('hides zaehler_result when counter value is 0', () => {
    setCounterValue(0);
    w.zaehlerUpdate();

    expect(doc.getElementById('zaehler_result').style.display).toBe('none');
  });

  it('z_ist shows delta (not absolute counter value)', () => {
    setCounterValue(10);
    w.zaehlerUpdate();

    // Delta = 15 - 10 = 5
    setCounterValue(15);
    w.zaehlerUpdate();

    expect(doc.getElementById('z_ist').textContent).toBe('5,0 ha');
  });

  it('z_total shows cumulative counter value', () => {
    setCounterValue(10);
    w.zaehlerUpdate();

    setCounterValue(15);
    w.zaehlerUpdate();

    expect(doc.getElementById('z_total').textContent).toBe('15,0 ha');
  });
});
