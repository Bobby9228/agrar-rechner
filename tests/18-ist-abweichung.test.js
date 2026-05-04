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

// ─── Zähler SOLL/IST/DIFF ────────────────────────────────────────────────────
// zaehlerUpdate() reads zaehler_stand from DOM and updates state.
// renderResults() updates z_soll / z_ist_sum / z_diff display.

describe('Zähler SOLL/IST/DIFF', () => {
  it('hides zaehler_soll_ist section when no hektar set', () => {
    const { w } = setup();
    w.document.getElementById('zaehler_stand').value = '100';
    w.zaehlerUpdate(); // sets state.zaehlerstand and shows zaehler_result
    w.renderResults();

    const section = w.document.getElementById('zaehler_soll_ist');
    expect(section.style.display).toBe('none');
  });

  it('hides zaehler_soll_ist section when no istHektar set (only SOLL known)', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '50000';
    w.document.getElementById('zaehler_stand').value = '100';
    w.zaehlerUpdate();
    w.renderResults();

    const section = w.document.getElementById('zaehler_soll_ist');
    expect(section.style.display).toBe('none');
  });

  it('shows zaehler_soll_ist section when both SOLL and IST are set', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('ist_hektar').value = '9';
    w.document.getElementById('koerner').value = '50000';
    w.syncStateFromInputs(); // sync DOM → state so renderResults can read r.hektar
    w.document.getElementById('zaehler_stand').value = '100';
    w.zaehlerUpdate();
    w.renderResults();

    const section = w.document.getElementById('zaehler_soll_ist');
    expect(section.style.display).not.toBe('none');
  });

  it('z_soll shows SOLL hectares from hektar field', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('ist_hektar').value = '9';
    w.document.getElementById('koerner').value = '50000';
    w.syncStateFromInputs();
    w.document.getElementById('zaehler_stand').value = '100';
    w.zaehlerUpdate();
    w.renderResults();

    expect(w.document.getElementById('z_soll').textContent).toBe('10,0 ha');
  });

  it('z_ist_sum shows istHektar (user-entered IST-Fläche), NOT zaehlerstand', () => {
    // zaehlerstand → z_total (raw counter value)
    // r.istHektar   → z_ist_sum (user-entered actual field area)
    // These are different values; z_ist_sum is NOT the zaehlerstand
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('ist_hektar').value = '9';
    w.document.getElementById('koerner').value = '50000';
    w.syncStateFromInputs();
    w.document.getElementById('zaehler_stand').value = '1200';
    w.zaehlerUpdate();
    w.renderResults();

    // z_ist_sum shows r.istHektar = 9, not zaehlerstand = 1200
    expect(w.document.getElementById('z_ist_sum').textContent).toBe('9,0 ha');
  });

  it('z_diff shows (istHektar - hektar), independent of zaehlerstand', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('ist_hektar').value = '9';
    w.document.getElementById('koerner').value = '50000';
    w.syncStateFromInputs();
    w.document.getElementById('zaehler_stand').value = '5000'; // 50 ha counter — irrelevant
    w.zaehlerUpdate();
    w.renderResults();

    // z_diff = istHektar - hektar = 9 - 10 = -1
    const zDiffEl = w.document.getElementById('z_diff');
    expect(zDiffEl.textContent).toBe('-1,0 ha');
    expect(zDiffEl.className).toContain('negative');
  });

  it('z_diff positive when istHektar > hektar', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('ist_hektar').value = '12';
    w.document.getElementById('koerner').value = '50000';
    w.syncStateFromInputs();
    w.document.getElementById('zaehler_stand').value = '500';
    w.zaehlerUpdate();
    w.renderResults();

    const zDiffEl = w.document.getElementById('z_diff');
    expect(zDiffEl.textContent).toBe('+2,0 ha');
    expect(zDiffEl.className).toContain('positive');
  });

  it('z_diff +0 when istHektar = hektar', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('ist_hektar').value = '10';
    w.document.getElementById('koerner').value = '50000';
    w.syncStateFromInputs();
    w.document.getElementById('zaehler_stand').value = '900';
    w.zaehlerUpdate();
    w.renderResults();

    const zDiffEl = w.document.getElementById('z_diff');
    expect(zDiffEl.textContent).toBe('+0,0 ha');
  });

  it('z_soll/ist/diff reflect istHektar changes (not zaehlerstand)', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('ist_hektar').value = '5';
    w.document.getElementById('koerner').value = '50000';
    w.syncStateFromInputs();
    w.document.getElementById('zaehler_stand').value = '500';
    w.zaehlerUpdate();
    w.renderResults();

    expect(w.document.getElementById('z_ist_sum').textContent).toBe('5,0 ha');
    expect(w.document.getElementById('z_diff').textContent).toBe('-5,0 ha');

    // Update istHektar — diff changes
    w.document.getElementById('ist_hektar').value = '12';
    w.syncStateFromInputs();
    w.renderResults();

    expect(w.document.getElementById('z_ist_sum').textContent).toBe('12,0 ha');
    expect(w.document.getElementById('z_diff').textContent).toBe('+2,0 ha');
  });

  it('z_soll reflects activeReiter hektar, not first tab', () => {
    const { w } = setup();
    w.addReiter();
    w.state.activeReiter = 1;
    w.state.reiter[1].hektar = 8;
    w.state.reiter[1].istHektar = 7;
    w.state.reiter[1].koerner = 50000;
    w.syncInputsFromState();
    w.document.getElementById('zaehler_stand').value = '700';
    w.zaehlerUpdate();
    w.renderResults();

    expect(w.document.getElementById('z_soll').textContent).toBe('8,0 ha');
    expect(w.document.getElementById('z_ist_sum').textContent).toBe('7,0 ha');
    expect(w.document.getElementById('z_diff').textContent).toBe('-1,0 ha');
  });
});

// ─── SOLL/IST section visibility ─────────────────────────────────────────────

describe('SOLL/IST section visibility', () => {
  it('result card section hidden when istHektar=0 even if hektar>0', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '50000';
    w.berechne();

    expect(w.document.getElementById('r_soll_ist_section').style.display).toBe('none');
  });

  it('result card section hidden when hektar=0 even if istHektar>0', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '0';
    w.document.getElementById('ist_hektar').value = '9';
    w.document.getElementById('koerner').value = '50000';
    w.berechne();

    expect(w.document.getElementById('r_soll_ist_section').style.display).toBe('none');
  });

  it('result card section shown only when both hektar>0 AND istHektar>0', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('ist_hektar').value = '9';
    w.document.getElementById('koerner').value = '50000';
    w.berechne();

    expect(w.document.getElementById('r_soll_ist_section').style.display).not.toBe('none');
  });

  it('result card section shows IST and SOLL values correctly', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('ist_hektar').value = '9,5';
    w.document.getElementById('koerner').value = '50000';
    w.berechne();

    expect(w.document.getElementById('r_soll_ha').textContent).toBe('10,0 ha');
    expect(w.document.getElementById('r_ist_ha').textContent).toBe('9,5 ha');
    expect(w.document.getElementById('r_diff_ha').textContent).toBe('-0,5 ha');
    expect(w.document.getElementById('r_diff_ha').className).toContain('negative');
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('IST/SOLL edge cases', () => {
  it('handles very small IST values (0.01 ha)', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('ist_hektar').value = '0,01';
    w.document.getElementById('koerner').value = '50000';
    w.berechne();

    expect(w.document.getElementById('r_ist_ha').textContent).toBe('0,0 ha'); // rounded
    expect(w.document.getElementById('r_diff_ha').textContent).toBe('-10,0 ha');
  });

  it('handles IST very close to SOLL (diff < 0.05 rounds to zero)', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('ist_hektar').value = '10,04';
    w.document.getElementById('koerner').value = '50000';
    w.berechne();

    // diff = 0.04 → rounds to +0.0 ha
    expect(w.document.getElementById('r_diff_ha').textContent).toBe('+0,0 ha');
  });

  it('handles decimal precision in SOLL/IST display', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10,555';
    w.document.getElementById('ist_hektar').value = '9,444';
    w.document.getElementById('koerner').value = '50000';
    w.berechne();

    // fmt() rounds to 1 decimal
    expect(w.document.getElementById('r_soll_ha').textContent).toBe('10,6 ha');
    expect(w.document.getElementById('r_ist_ha').textContent).toBe('9,4 ha');
    expect(w.document.getElementById('r_diff_ha').textContent).toBe('-1,1 ha');
  });

  it('handles large hectare values', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '500';
    w.document.getElementById('ist_hektar').value = '480';
    w.document.getElementById('koerner').value = '50000';
    w.berechne();

    expect(w.document.getElementById('r_diff_ha').textContent).toBe('-20,0 ha');
    expect(w.document.getElementById('r_diff_ha').className).toContain('negative');
  });

  it('IST-based remaining = 0 when exactly filled', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('ist_hektar').value = '8';
    w.document.getElementById('koerner').value = '50000';
    w.berechne();

    // IST: 8 Einheiten needed
    w.document.getElementById('drill_einheit').value = '8';
    w.drillAdd();

    expect(w.document.getElementById('r_drill_e_rem').textContent).toContain('0,0');
  });

  it('negative remaining (overfilled) shows 0, not negative', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('ist_hektar').value = '8';
    w.document.getElementById('koerner').value = '50000';
    w.berechne();

    // IST: 8 Einheiten needed, but fill 10
    w.document.getElementById('drill_einheit').value = '10';
    w.drillAdd();

    // Math.max(0, ...) means 0, not negative
    expect(w.document.getElementById('r_drill_e_rem').textContent).toContain('0,0');
  });

  it('result card section uses activeReiter, not first tab', () => {
    const { w } = setup();
    w.addReiter();
    w.state.activeReiter = 1;
    w.state.reiter[1].hektar = 8;
    w.state.reiter[1].istHektar = 7;
    w.state.reiter[1].koerner = 50000;
    w.syncInputsFromState();
    w.berechne();
    w.renderResults(); // berechne() doesn't call renderResults() — call it explicitly

    expect(w.document.getElementById('r_soll_ist_section').style.display).not.toBe('none');
    expect(w.document.getElementById('r_soll_ha').textContent).toBe('8,0 ha');
    expect(w.document.getElementById('r_ist_ha').textContent).toBe('7,0 ha');
    expect(w.document.getElementById('r_diff_ha').textContent).toBe('-1,0 ha');
  });
});

// ─── IST/SOLL across multiple tabs ───────────────────────────────────────────

describe('IST/SOLL across multiple tabs', () => {
  it('each tab has independent istHektar', () => {
    const { w } = setup();
    w.addReiter();

    // Tab 0: SOLL=10, IST=9
    w.state.activeReiter = 0;
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].istHektar = 9;
    w.state.reiter[0].koerner = 50000;
    w.syncInputsFromState();
    w.berechne();

    expect(w.document.getElementById('r_soll_ha').textContent).toBe('10,0 ha');
    expect(w.document.getElementById('r_ist_ha').textContent).toBe('9,0 ha');

    // Tab 1: SOLL=20, IST=22
    w.state.activeReiter = 1;
    w.state.reiter[1].hektar = 20;
    w.state.reiter[1].istHektar = 22;
    w.state.reiter[1].koerner = 50000;
    w.syncInputsFromState();
    w.berechne();

    expect(w.document.getElementById('r_soll_ha').textContent).toBe('20,0 ha');
    expect(w.document.getElementById('r_ist_ha').textContent).toBe('22,0 ha');
    expect(w.document.getElementById('r_diff_ha').textContent).toBe('+2,0 ha');
    expect(w.document.getElementById('r_diff_ha').className).toContain('positive');
  });

  it('mixed tabs: some with istHektar, some without', () => {
    const { w } = setup();
    w.addReiter();

    // Tab 0: SOLL only
    w.state.activeReiter = 0;
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].istHektar = 0;
    w.state.reiter[0].koerner = 50000;
    w.syncInputsFromState();
    w.berechne();

    expect(w.document.getElementById('r_soll_ist_section').style.display).toBe('none');

    // Tab 1: SOLL + IST
    w.state.activeReiter = 1;
    w.state.reiter[1].hektar = 8;
    w.state.reiter[1].istHektar = 7;
    w.state.reiter[1].koerner = 50000;
    w.syncInputsFromState();
    w.berechne();

    expect(w.document.getElementById('r_soll_ist_section').style.display).not.toBe('none');
    expect(w.document.getElementById('r_diff_ha').textContent).toBe('-1,0 ha');
  });

  it('carryover hint in result card shows savings when IST < SOLL', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('ist_hektar').value = '9';
    w.document.getElementById('koerner').value = '50000';
    w.berechne();

    w.renderResults();

    const hint = w.document.getElementById('r_carryover_hint');
    expect(hint).not.toBeNull();
    // SOLL 10 ha - IST 9 ha = 1 ha savings → carryover hint visible
    expect(hint.innerHTML).toContain('Übertrag aus ersparten Flächen');
    expect(hint.innerHTML).toContain('+1,0');
  });

  it('carryover hint in result card shows excess when IST > SOLL (with entries overfilling)', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('ist_hektar').value = '12';
    w.document.getElementById('koerner').value = '50000';
    w.document.getElementById('duenger').value = '100';
    w.berechne();

    // IST=12 > SOLL=10, but no entries yet → excess not yet materialized → hint empty
    w.renderResults();
    const hint = w.document.getElementById('r_carryover_hint');
    expect(hint).not.toBeNull();
    expect(hint.innerHTML).toBe('');

    // Add an entry that covers the IST-based need plus extra → excess now exists
    w.document.getElementById('drill_einheit').value = '12';
    w.document.getElementById('drill_hektar').value = '12';
    w.drillAdd();
    w.renderResults();

    // IST 12 ha → 12 Einheiten needed, used 12 → remaining 0. Excess = IST - SOLL = 2 Einheiten
    expect(hint.innerHTML).toContain('Mehrwert aus überschrittenen Flächen');
  });

  it('carryover hint hidden when IST = SOLL', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('ist_hektar').value = '10';
    w.document.getElementById('koerner').value = '50000';
    w.berechne();

    w.renderResults();

    const hint = w.document.getElementById('r_carryover_hint');
    expect(hint).not.toBeNull();
    expect(hint.innerHTML).toBe('');
  });
});

// ─── IST-based calculations with fahrgassen ──────────────────────────────────

describe('IST/SOLL with fahrgassen enabled', () => {
  it('getTabIstEinheiten applies fahrgassen reduction', () => {
    const { w } = setup();
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 8;
    w.state.koernerProEinheit = 50000;

    const r = { hektar: 10, istHektar: 8, koerner: 50000, duenger: 100, entries: [] };

    // Without fahrgassen: 8 * 50000 / 50000 = 8 Einheiten
    // With fahrgassen: 8 * 50000 * (8-1)/8 / 50000 = 7 Einheiten
    expect(w.getTabIstEinheiten(r)).toBe(7);
  });

  it('getTabIstDuenger does NOT apply fahrgassen reduction (unlike getTabIstEinheiten)', () => {
    const { w } = setup();
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 8;
    w.state.koernerProEinheit = 50000;

    const r = { hektar: 10, istHektar: 8, koerner: 50000, duenger: 100, entries: [] };

    // getTabIstDuenger: no fahrgassen reduction applied
    // IST ha = 8, duenger = 100 → 8 * 100 = 800 kg
    expect(w.getTabIstDuenger(r)).toBe(800);
  });

  it('result card remaining uses IST-based values with fahrgassen', () => {
    const { w } = setup();
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 8;
    w.state.koernerProEinheit = 50000;

    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('ist_hektar').value = '8';
    w.document.getElementById('koerner').value = '50000';
    w.document.getElementById('duenger').value = '100';
    w.berechne();

    // IST-based Einheiten with fahrgassen: 8 * 7/8 = 7 Einheiten
    w.document.getElementById('drill_einheit').value = '7';
    w.drillAdd();

    // Exactly filled → 0 remaining
    expect(w.document.getElementById('r_drill_e_rem').textContent).toContain('0,0');
  });

  it('getTabIstEinheiten falls back to SOLL hektar when IST=0', () => {
    const { w } = setup();
    w.state.koernerProEinheit = 50000;

    const r = { hektar: 10, istHektar: 0, koerner: 50000, duenger: 100, entries: [] };

    expect(w.getTabIstEinheiten(r)).toBe(10);
  });

  it('getTabIstDuenger falls back to SOLL hektar when IST=0', () => {
    const { w } = setup();

    const r = { hektar: 10, istHektar: 0, koerner: 50000, duenger: 100, entries: [] };

    expect(w.getTabIstDuenger(r)).toBe(1000);
  });

  it('getTabIstHektar returns 0 for undefined/null istHektar', () => {
    const { w } = setup();

    const r1 = { hektar: 10, istHektar: 0, koerner: 50000, duenger: 100, entries: [] };
    expect(w.getTabIstHektar(r1)).toBe(0);

    const r2 = { hektar: 10, koerner: 50000, duenger: 100, entries: [] };
    expect(w.getTabIstHektar(r2)).toBe(0);
  });
});
