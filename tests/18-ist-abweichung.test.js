/**
 * Tests for IST/SOLL/Abweichung calculation in result area.
 * IST comes from r.istHektar (user input per tab), not derived from entries.
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

function setup() {
  const { dom, window: w, store } = createDom();
  w.initUI();
  return { dom, w, store };
}

describe('IST/SOLL Abweichung', () => {
  it('hides SOLL/IST section when no istHektar set', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '50000';
    w.berechne();

    // No istHektar → section hidden
    const section = w.document.getElementById('r_soll_ist_section');
    expect(section.style.display).toBe('none');
  });

  it('shows IST and Abweichung when istHektar is set', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('ist_hektar').value = '9,5';
    w.document.getElementById('koerner').value = '50000';
    w.berechne();

    expect(w.document.getElementById('r_soll_ha').textContent).toBe('10,0 ha');
    expect(w.document.getElementById('r_ist_ha').textContent).toBe('9,5 ha');
    expect(w.document.getElementById('r_diff_ha').textContent).toBe('-0,5 ha');
  });

  it('shows positive Abweichung when IST > SOLL', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('ist_hektar').value = '11';
    w.document.getElementById('koerner').value = '50000';
    w.berechne();

    expect(w.document.getElementById('r_diff_ha').textContent).toBe('+1,0 ha');
    const diffEl = w.document.getElementById('r_diff_ha');
    expect(diffEl.className).toContain('positive');
  });

  it('shows zero Abweichung when IST = SOLL', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('ist_hektar').value = '10';
    w.document.getElementById('koerner').value = '50000';
    w.berechne();

    expect(w.document.getElementById('r_diff_ha').textContent).toBe('+0,0 ha');
  });

  it('updates IST when istHektar changes and berechne is called', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('ist_hektar').value = '8';
    w.document.getElementById('koerner').value = '50000';
    w.berechne();

    expect(w.document.getElementById('r_ist_ha').textContent).toBe('8,0 ha');

    // Update IST
    w.document.getElementById('ist_hektar').value = '9';
    w.berechne();

    expect(w.document.getElementById('r_ist_ha').textContent).toBe('9,0 ha');
    expect(w.document.getElementById('r_diff_ha').textContent).toBe('-1,0 ha');
  });

  it('IST-based Einheiten used in remaining calculation', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('ist_hektar').value = '8';
    w.document.getElementById('koerner').value = '50000';
    w.document.getElementById('duenger').value = '100';
    w.berechne();

    // SOLL: 10 Einheiten, IST: 8 Einheiten → savings = 2
    // Add 5 Einheiten → remaining = 8 - 5 = 3, minus carryover savings 2 → 1
    w.document.getElementById('drill_einheit').value = '5';
    w.drillAdd();

    const remText = w.document.getElementById('r_drill_e_rem').textContent;
    expect(remText).toContain('1,0');
  });

  it('IST-based Duenger used in remaining calculation', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('ist_hektar').value = '8';
    w.document.getElementById('koerner').value = '50000';
    w.document.getElementById('duenger').value = '100';
    w.berechne();

    // SOLL: 1000 kg, IST: 800 kg → savings = 200 kg
    w.document.getElementById('drill_einheit').value = '5';
    w.document.getElementById('drill_duenger').value = '400';
    w.drillAdd();

    // IST: 800 kg, used: 400 kg → remaining = 400, minus carryover savings 200 → 200
    const remD = w.document.getElementById('r_drill_d_rem').textContent;
    expect(remD).toContain('200');
  });

  it('syncs istHektar to state on tab switch', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('ist_hektar').value = '9';
    w.document.getElementById('koerner').value = '50000';
    w.berechne();

    expect(w.state.reiter[0].istHektar).toBe(9);
  });

  it('syncs istHektar from state to input on tab switch', () => {
    const { w } = setup();
    w.state.reiter[0].istHektar = 7.5;
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 50000;
    w.syncInputsFromState();

    expect(w.document.getElementById('ist_hektar').value).toBe('7,5');
  });
});
