/**
 * Extended tests for SOLL/IST feature — covers gaps not in 18/19:
 *   - Zaehler SOLL/IST/DIFF (zaehlerUpdate)
 *   - IST with Fahrgassen factor
 *   - IST with custom Einheiten-Groesse (koernerProEinheit)
 *   - IST persistence across tab switches and localStorage
 *   - IST reset (active tab + full reset)
 *   - Multi-tab IST scenarios (protocol aggregation)
 *   - Edge cases (zero, negative, very small, very large IST)
 *   - Drill protocol per-tab SOLL/IST display
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

function setup() {
  const { dom, window: w, store } = createDom();
  w.initUI();
  return { dom, w, store };
}

// Helper: set fields and calculate
function calc(w, { hektar, ist, koerner, duenger }) {
  if (hektar !== undefined) w.document.getElementById('hektar').value = String(hektar);
  if (ist !== undefined) w.document.getElementById('ist_hektar').value = String(ist);
  if (koerner !== undefined) w.document.getElementById('koerner').value = String(koerner);
  if (duenger !== undefined) w.document.getElementById('duenger').value = String(duenger);
  w.berechne();
}

// ─── Zaehler SOLL/IST/DIFF ──────────────────────────────────────────
describe('Zaehler SOLL/IST/DIFF', () => {
  it('shows zaehler_soll_ist section when zaehlerstand > 0 and hektar > 0', () => {
    const { w } = setup();
    calc(w, { hektar: 10, koerner: 50000 });
    w.document.getElementById('zaehler_stand').value = '5';
    w.zaehlerUpdate();

    expect(w.document.getElementById('zaehler_soll_ist').style.display).toBe('block');
  });

  it('hides zaehler_soll_ist when zaehlerstand is 0', () => {
    const { w } = setup();
    calc(w, { hektar: 10, koerner: 50000 });
    w.document.getElementById('zaehler_stand').value = '0';
    w.zaehlerUpdate();

    expect(w.document.getElementById('zaehler_result').style.display).toBe('none');
  });

  it('shows correct SOLL/IST/DIFF in zaehler section', () => {
    const { w } = setup();
    calc(w, { hektar: 10, ist: '7,5', koerner: 50000 });
    w.document.getElementById('zaehler_stand').value = '7,5';
    w.zaehlerUpdate();

    expect(w.document.getElementById('z_soll').textContent).toBe('10,0 ha');
    expect(w.document.getElementById('z_ist_sum').textContent).toBe('7,5 ha');
    expect(w.document.getElementById('z_diff').textContent).toBe('-2,5 ha');
    expect(w.document.getElementById('z_diff').className).toContain('negative');
  });

  it('zaehler diff positive when IST > SOLL', () => {
    const { w } = setup();
    calc(w, { hektar: 10, ist: '12', koerner: 50000 });
    w.document.getElementById('zaehler_stand').value = '12';
    w.zaehlerUpdate();

    expect(w.document.getElementById('z_diff').textContent).toBe('+2,0 ha');
    expect(w.document.getElementById('z_diff').className).toContain('positive');
  });

  it('zaehler diff zero when IST = SOLL', () => {
    const { w } = setup();
    calc(w, { hektar: 10, ist: '10', koerner: 50000 });
    w.document.getElementById('zaehler_stand').value = '10';
    w.zaehlerUpdate();

    expect(w.document.getElementById('z_diff').textContent).toBe('+0,0 ha');
  });

  it('hides zaehler_soll_ist when no hektar set', () => {
    const { w } = setup();
    w.document.getElementById('zaehler_stand').value = '5';
    w.zaehlerUpdate();

    expect(w.document.getElementById('zaehler_soll_ist').style.display).toBe('none');
  });

  it('zaehler delta shows IST-Flaeche seit letztem Eintrag', () => {
    const { w } = setup();
    calc(w, { hektar: 10, koerner: 50000 });
    // First reading
    w.document.getElementById('zaehler_stand').value = '5';
    w.zaehlerUpdate();
    expect(w.document.getElementById('z_ist').textContent).toContain('5,0 ha');

    // Second reading: delta = 8 - 5 = 3
    w.document.getElementById('zaehler_stand').value = '8';
    w.zaehlerUpdate();
    expect(w.document.getElementById('z_ist').textContent).toContain('3,0 ha');
    expect(w.document.getElementById('z_total').textContent).toContain('8,0 ha');
  });

  it('zaehler persists zaehlerstand in state', () => {
    const { w } = setup();
    calc(w, { hektar: 10, koerner: 50000 });
    w.document.getElementById('zaehler_stand').value = '7,5';
    w.zaehlerUpdate();

    expect(w.state.zaehlerstand).toBe(7.5);
  });
});

// ─── IST with Fahrgassen ────────────────────────────────────────────
describe('IST with Fahrgassen', () => {
  it('IST-based Einheiten include Fahrgassen factor', () => {
    const { w } = setup();
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 3; // 1/3 reduction = (3-1)/3 = 2/3

    calc(w, { hektar: 12, ist: '9', koerner: 50000 });

    // SOLL Einheiten: 12 * 50000 * (2/3) / 50000 = 12 * 2/3 = 8
    // IST Einheiten:  9 * 50000 * (2/3) / 50000 = 9 * 2/3 = 6
    var r = w.getActiveReiter();
    expect(w.getTabTotalEinheiten(r)).toBeCloseTo(8, 1);
    expect(w.getTabIstEinheiten(r)).toBeCloseTo(6, 1);
  });

  it('IST-based Duenger is unaffected by Fahrgassen', () => {
    const { w } = setup();
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 3;

    calc(w, { hektar: 10, ist: '8', koerner: 50000, duenger: 100 });

    var r = w.getActiveReiter();
    // Duenger is always ha * duenger/ha, no Fahrgassen factor
    expect(w.getTabIstDuenger(r)).toBe(800);
    expect(w.getTabTotalDuenger(r)).toBe(1000);
  });

  it('Savings include Fahrgassen factor in Saatgut', () => {
    const { w } = setup();
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 2; // factor 1/2

    calc(w, { hektar: 10, ist: '8', koerner: 50000 });

    // SOLL Einheiten: 10 * 50000 * 0.5 / 50000 = 5
    // IST Einheiten:  8 * 50000 * 0.5 / 50000 = 4
    // Savings = 1 Einheit
    var r = w.getActiveReiter();
    var savings = w.getTabTotalEinheiten(r) - w.getTabIstEinheiten(r);
    expect(savings).toBeCloseTo(1, 1);
  });
});

// ─── IST with custom Einheiten-Groesse ──────────────────────────────
describe('IST with custom Einheiten-Groesse', () => {
  it('IST-based Einheiten uses koernerProEinheit from state', () => {
    const { w } = setup();
    w.state.koernerProEinheit = 25000; // half the default

    calc(w, { hektar: 10, ist: '8', koerner: 50000 });

    // SOLL: 10 * 50000 / 25000 = 20 Einheiten
    // IST:  8 * 50000 / 25000 = 16 Einheiten
    var r = w.getActiveReiter();
    expect(w.getTabTotalEinheiten(r)).toBe(20);
    expect(w.getTabIstEinheiten(r)).toBe(16);
  });

  it('Savings scale correctly with custom Einheiten-Groesse', () => {
    const { w } = setup();
    w.state.koernerProEinheit = 25000;

    calc(w, { hektar: 10, ist: '9', koerner: 50000 });

    // SOLL: 20, IST: 18 → savings = 2
    var r = w.getActiveReiter();
    var savings = w.getTabTotalEinheiten(r) - w.getTabIstEinheiten(r);
    expect(savings).toBe(2);
  });
});

// ─── IST persistence ────────────────────────────────────────────────
describe('IST persistence', () => {
  it('istHektar is saved to localStorage via sv()', () => {
    const { w, store } = setup();
    calc(w, { hektar: 10, ist: '7,5', koerner: 50000 });

    const saved = JSON.parse(store['mais_rechner']);
    expect(saved.reiter[0].istHektar).toBe(7.5);
  });

  it('istHektar survives tab switch away and back', () => {
    const { w } = setup();
    calc(w, { hektar: 10, ist: '7,5', koerner: 50000 });
    w.addReiter();
    // Tab 1 is now active
    calc(w, { hektar: 5, koerner: 40000 });

    // Switch back to tab 0
    w.switchReiter(0);

    expect(w.state.reiter[0].istHektar).toBe(7.5);
    expect(w.document.getElementById('ist_hektar').value).toBe('7,5');
  });

  it('istHektar restored from localStorage on initUI', () => {
    const { dom, store } = createDom();
    // Pre-populate localStorage
    store['mais_rechner'] = JSON.stringify({
      reiter: [{ name: 'Tab 1', hektar: 10, istHektar: 8.3, koerner: 50000, duenger: 100, entries: [] }],
      activeReiter: 0,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      einheitGroesseEnabled: false,
      koernerProEinheit: 50000,
      machineLog: [],
      zaehlerstand: 0
    });

    const w = dom.window;
    w.initUI();

    expect(w.state.reiter[0].istHektar).toBe(8.3);
    expect(w.document.getElementById('ist_hektar').value).toBe('8,3');
  });

  it('istHektar empty in input when state has 0', () => {
    const { w } = setup();
    calc(w, { hektar: 10, koerner: 50000 });
    // istHektar was not set → should be 0, input empty
    expect(w.state.reiter[0].istHektar).toBe(0);
    expect(w.document.getElementById('ist_hektar').value).toBe('');
  });
});

// ─── IST reset ──────────────────────────────────────────────────────
describe('IST reset', () => {
  it('resetActiveTab clears istHektar', () => {
    const { w } = setup();
    calc(w, { hektar: 10, ist: '7,5', koerner: 50000 });

    w.resetActiveTab();

    expect(w.state.reiter[0].istHektar).toBe(0);
    expect(w.document.getElementById('ist_hektar').value).toBe('');
  });

  it('resetAll clears all istHektar across tabs', () => {
    const { w } = setup();
    calc(w, { hektar: 10, ist: '7,5', koerner: 50000 });
    w.addReiter();
    calc(w, { hektar: 8, ist: '6', koerner: 40000 });

    w.resetAll();

    // After resetAll, only 1 tab with istHektar=0
    expect(w.state.reiter.length).toBe(1);
    expect(w.state.reiter[0].istHektar).toBe(0);
    expect(w.document.getElementById('ist_hektar').value).toBe('');
  });

  it('SOLL/IST section hidden after reset', () => {
    const { w } = setup();
    calc(w, { hektar: 10, ist: '7,5', koerner: 50000 });
    expect(w.document.getElementById('r_soll_ist_section').style.display).toBe('block');

    w.resetActiveTab();

    // resetActiveTab hides results but doesn't re-render SOLL/IST section
    // Verify results are hidden (which contains the SOLL/IST section)
    expect(w.document.getElementById('results').style.display).toBe('none');
    // istHektar is cleared
    expect(w.state.reiter[0].istHektar).toBe(0);
  });
});

// ─── Multi-tab IST scenarios ────────────────────────────────────────
describe('Multi-tab IST scenarios', () => {
  it('each tab has independent istHektar', () => {
    const { w } = setup();
    calc(w, { hektar: 10, ist: '7,5', koerner: 50000 });
    w.addReiter();
    calc(w, { hektar: 8, ist: '6', koerner: 40000 });

    expect(w.state.reiter[0].istHektar).toBe(7.5);
    expect(w.state.reiter[1].istHektar).toBe(6);
  });

  it('protocol shows SOLL/IST info per tab with istHektar', () => {
    const { w } = setup();
    w.addReiter();

    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, istHektar: 8, koerner: 50000, duenger: 100 };
    w.state.reiter[0].entries.push({ einheit: 8, zaehlerStand: 8, duenger: 800, time: '09:00' });
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 6, istHektar: 5.5, koerner: 50000, duenger: 80 };
    w.state.reiter[1].entries.push({ einheit: 3, zaehlerStand: 3, duenger: 240, time: '10:00' });

    w.renderResults();

    const container = w.document.getElementById('drill_entries');
    // Both tabs have entries with istHektar → should show SOLL/IST summary
    const summaryDivs = container.querySelectorAll('.drill-entry');
    const sollIstTexts = Array.from(summaryDivs)
      .map(el => el.textContent)
      .filter(t => t.includes('SOLL') && t.includes('IST'));
    expect(sollIstTexts.length).toBeGreaterThanOrEqual(2);
  });

  it('drill summary aggregates IST across tabs correctly', () => {
    const { w } = setup();
    w.addReiter();

    // Tab 0: SOLL=10, IST=8 → 8 Einheiten IST
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, istHektar: 8, koerner: 50000, duenger: 100 };
    // Tab 1: SOLL=6, no IST → 6 Einheiten SOLL (= IST fallback)
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 6, koerner: 50000, duenger: 80 };

    w.renderResults();

    // ds_saat_total should show IST-aggregated total = 8 + 6 = 14
    expect(w.document.getElementById('ds_saat_total').textContent).toContain('14,0');
    // ds_duenger_total: IST duenger = 800 + 480 = 1280
    expect(w.document.getElementById('ds_duenger_total').textContent).toContain('1.280');
  });

  it('drill summary savings = SOLL total - IST total', () => {
    const { w } = setup();
    w.addReiter();

    // Tab 0: SOLL=10, IST=8 → savings = 2 Einheiten, 200 kg
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, istHektar: 8, koerner: 50000, duenger: 100 };
    // Tab 1: SOLL=6, no IST → no savings
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 6, koerner: 50000, duenger: 80 };

    w.renderResults();

    const savingsEl = w.document.getElementById('ds_savings');
    expect(savingsEl.style.display).not.toBe('none');
    expect(savingsEl.textContent).toContain('2,0 Einheiten Saatgut');
    expect(savingsEl.textContent).toContain('200,0 kg Dünger');
  });

  it('tab remove preserves istHektar of remaining tabs', () => {
    const { w } = setup();
    calc(w, { hektar: 10, ist: '7,5', koerner: 50000 });
    w.addReiter();
    calc(w, { hektar: 8, ist: '6', koerner: 40000 });

    // Remove tab 1 — tab 0 should keep its istHektar
    w.confirm = () => true;
    w.removeReiter(1);

    expect(w.state.reiter[0].istHektar).toBe(7.5);
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────
describe('IST edge cases', () => {
  it('IST = 0 treated as not set (section hidden)', () => {
    const { w } = setup();
    calc(w, { hektar: 10, ist: '0', koerner: 50000 });

    // istHektar=0 → falsy → section hidden
    expect(w.document.getElementById('r_soll_ist_section').style.display).toBe('none');
  });

  it('very small IST difference shows correct formatted diff', () => {
    const { w } = setup();
    calc(w, { hektar: 10, ist: '10,1', koerner: 50000 });

    expect(w.document.getElementById('r_diff_ha').textContent).toBe('+0,1 ha');
  });

  it('IST larger than SOLL shows negative class on diff', () => {
    // Wait — IST > SOLL means diff is positive (IST is bigger)
    const { w } = setup();
    calc(w, { hektar: 5, ist: '8', koerner: 50000 });

    // diff = IST - SOLL = 8 - 5 = 3
    expect(w.document.getElementById('r_diff_ha').textContent).toBe('+3,0 ha');
    expect(w.document.getElementById('r_diff_ha').className).toContain('positive');
  });

  it('IST < SOLL shows negative diff', () => {
    const { w } = setup();
    calc(w, { hektar: 10, ist: '3', koerner: 50000 });

    // diff = 3 - 10 = -7
    expect(w.document.getElementById('r_diff_ha').textContent).toBe('-7,0 ha');
    expect(w.document.getElementById('r_diff_ha').className).toContain('negative');
  });

  it('large IST value works correctly', () => {
    const { w } = setup();
    calc(w, { hektar: 500, ist: '480,5', koerner: 50000 });

    expect(w.document.getElementById('r_soll_ha').textContent).toBe('500,0 ha');
    expect(w.document.getElementById('r_ist_ha').textContent).toBe('480,5 ha');
    expect(w.document.getElementById('r_diff_ha').textContent).toBe('-19,5 ha');
  });

  it('getTabIstEinheiten returns SOLL when istHektar is 0', () => {
    const { w } = setup();
    calc(w, { hektar: 10, koerner: 50000 });

    var r = w.getActiveReiter();
    // istHektar=0 → fallback to SOLL
    expect(w.getTabIstEinheiten(r)).toBe(w.getTabTotalEinheiten(r));
  });

  it('getTabIstDuenger returns SOLL when istHektar is 0', () => {
    const { w } = setup();
    calc(w, { hektar: 10, koerner: 50000, duenger: 100 });

    var r = w.getActiveReiter();
    expect(w.getTabIstDuenger(r)).toBe(w.getTabTotalDuenger(r));
  });

  it('getTabIstHektar returns 0 when not set', () => {
    const { w } = setup();
    calc(w, { hektar: 10, koerner: 50000 });

    var r = w.getActiveReiter();
    expect(w.getTabIstHektar(r)).toBe(0);
  });

  it('istHektar with DE comma format parsed correctly', () => {
    const { w } = setup();
    calc(w, { hektar: 10, ist: '9,75', koerner: 50000 });

    expect(w.state.reiter[0].istHektar).toBeCloseTo(9.75, 2);
  });

  it('SOLL/IST section hidden when only hektar, no koerner', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('ist_hektar').value = '8';
    w.document.getElementById('koerner').value = '';
    w.berechne(); // fails validation → no results

    expect(w.document.getElementById('r_soll_ist_section').style.display).toBe('none');
  });
});

// ─── IST Einheiten/Duenger in drill remaining ───────────────────────
describe('IST Einheiten/Duenger in drill remaining', () => {
  it('remaining Einheiten uses IST-based total when IST is set', () => {
    const { w } = setup();
    calc(w, { hektar: 10, ist: '8', koerner: 50000 });
    // IST = 8 → 8 Einheiten needed. Savings = SOLL(10) - IST(8) = 2 Einheiten

    w.document.getElementById('drill_einheit').value = '5';
    w.drillAdd();

    // Remaining = IST(8) - filled(5) - carryover savings(2) = 1
    // The carryover from SOLL-IST difference is applied
    const remText = w.document.getElementById('r_drill_e_rem').textContent;
    expect(remText).toContain('1,0');
  });

  it('remaining Duenger uses IST-based total when IST is set', () => {
    const { w } = setup();
    calc(w, { hektar: 10, ist: '8', koerner: 50000, duenger: 200 });
    // IST Dünger = 8 * 200 = 1600 kg. Savings = SOLL(2000) - IST(1600) = 400 kg

    w.document.getElementById('drill_einheit').value = '5';
    w.document.getElementById('drill_duenger').value = '800';
    w.drillAdd();

    // Remaining = IST(1600) - filled(800) - carryover savings(400) = 400
    const remD = w.document.getElementById('r_drill_d_rem').textContent;
    expect(remD).toContain('400');
  });

  it('isTabDone uses IST-based totals when IST is set', () => {
    const { w } = setup();
    calc(w, { hektar: 10, ist: '8', koerner: 50000, duenger: 100 });

    // Fill exactly IST amount
    w.document.getElementById('drill_einheit').value = '8';
    w.document.getElementById('drill_duenger').value = '800';
    w.drillAdd();

    var r = w.getActiveReiter();
    expect(w.isTabDone(r, 0)).toBe(true);
  });

  it('isTabDone false when IST-based fill incomplete', () => {
    const { w } = setup();
    calc(w, { hektar: 10, ist: '8', koerner: 50000, duenger: 100 });

    w.document.getElementById('drill_einheit').value = '5';
    w.document.getElementById('drill_duenger').value = '400';
    w.drillAdd();

    var r = w.getActiveReiter();
    expect(w.isTabDone(r, 0)).toBe(false);
  });
});

// ─── IST with Fahrgassen + Einheiten combined ───────────────────────
describe('IST with Fahrgassen + custom Einheiten combined', () => {
  it('both factors applied to IST Einheiten', () => {
    const { w } = setup();
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 2; // factor = 1/2
    w.state.koernerProEinheit = 25000;

    calc(w, { hektar: 10, ist: '6', koerner: 50000 });

    // IST Einheiten: 6 * 50000 * 0.5 / 25000 = 6
    // SOLL Einheiten: 10 * 50000 * 0.5 / 25000 = 10
    var r = w.getActiveReiter();
    expect(w.getTabIstEinheiten(r)).toBeCloseTo(6, 1);
    expect(w.getTabTotalEinheiten(r)).toBeCloseTo(10, 1);
  });
});
