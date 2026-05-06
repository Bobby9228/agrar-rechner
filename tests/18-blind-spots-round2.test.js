/**
 * Tests for remaining blind spots and edge cases found in audit round 2.
 *
 * Includes:
 * 1. switchReiter from protokoll view to same tab
 * 2. Prognose cumulative calculation with fahrgassen factor
 * 3. Prognose with duenger-only consumption (no einheit)
 * 4. drillTabList needDiv: done with duenger finished but einheit remaining
 * 5. renderDashboard per-tab calculation (fahrgassen NOT applied — BUG documented)
 * 6. renderDashboard summary with partial entries
 * 7. initUI with einheitGroesseEnabled and custom koernerProEinheit
 * 8. berechne with usedEinheit exceeds but usedDuenger is fine (OR condition)
 * 9. Prognose: second fill with hektar stand going backwards
 * 10. renderDrillTabList: remaining need shows duenger kg
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('switchReiter from protokoll view', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('allows switching to same tab when currently in protokoll view', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000 };
    w.switchToProtokoll();
    expect(w.state.activeView).toBe('protokoll');
    expect(w.state.activeReiter).toBe(0);

    // switchReiter(0) should work even though activeReiter is already 0,
    // because activeView is 'protokoll'
    w.switchReiter(0);
    expect(w.state.activeView).toBeNull();
    expect(w.state.activeReiter).toBe(0);
  });

  it('switches to different tab from protokoll', () => {
    w.addReiter();
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000 };
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 5, koerner: 80000 };
    w.switchToProtokoll();
    expect(w.state.activeView).toBe('protokoll');

    w.switchReiter(1);
    expect(w.state.activeView).toBeNull();
    expect(w.state.activeReiter).toBe(1);
  });
});

describe('Prognose with fahrgassen factor', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('applies fahrgassen factor in unitsPerHa calculation', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 100000, duenger: 0, entries: [] };
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 4; // factor = 3/4 = 0.75
    // unitsPerHa = koerner * fgFactor / koernerProEinheit = 100000 * 0.75 / 50000 = 1.5 einheiten/ha

    w.state.machineLog = [
      { einheit: 6, hektar: 0, duenger: 0, time: '10:00' },
      { einheit: 3, hektar: 2, duenger: 0, time: '11:00' },
    ];
    w.renderResults();

    var mlContainer = w.document.getElementById('drill_machine_log');
    var prognose = mlContainer.querySelectorAll('.drill-prognose');
    // Entry 0: cumEinheit=6, prognose = 0 + 6/1.5 = 4.0 ha
    expect(prognose[0].textContent).toContain('4,0');
    // Entry 1: cumEinheit = max(0, 6 - 2*1.5) + 3 = max(0, 6-3) + 3 = 3+3 = 6
    // prognose = 2 + 6/1.5 = 2 + 4 = 6.0 ha
    expect(prognose[1].textContent).toContain('6,0');
  });
});

describe('Prognose with duenger-only consumption', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('shows duenger prognose when no einheit entries', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, duenger: 200, entries: [] };
    // duengerPerHa = 200
    w.state.machineLog = [
      { einheit: 0, hektar: 0, duenger: 1000, time: '10:00' },
    ];
    w.renderResults();

    var mlContainer = w.document.getElementById('drill_machine_log');
    var prognose = mlContainer.querySelectorAll('.drill-prognose');
    // cumDuenger=1000, duengerPerHa=200, prognose = 0 + 1000/200 = 5.0 ha
    expect(prognose.length).toBeGreaterThan(0);
    expect(prognose[0].textContent).toContain('Dünger leer bei');
    expect(prognose[0].textContent).toContain('5,0');
  });

  it('cumulative duenger decreases with driven hectares', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, duenger: 100, entries: [] };
    // duengerPerHa = 100
    w.state.machineLog = [
      { einheit: 5, hektar: 0, duenger: 800, time: '10:00' },
      { einheit: 0, hektar: 5, duenger: 400, time: '11:00' },
    ];
    w.renderResults();

    var mlContainer = w.document.getElementById('drill_machine_log');
    var prognose = mlContainer.querySelectorAll('.drill-prognose');
    // Entry 1: cumDuenger = max(0, 800 - 5*100) + 400 = 300 + 400 = 700
    // prognose = 5 + 700/100 = 12.0 ha
    expect(prognose[1].textContent).toContain('12,0');
  });
});

describe('Prognose: hektar going backwards (edge case)', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('clamps haDriven to 0 when hektar decreases', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, duenger: 0, entries: [] };
    // unitsPerHa = 90000/50000 = 1.8
    w.state.machineLog = [
      { einheit: 5, zaehlerStand: 5, duenger: 0, time: '10:00' },
      { einheit: 3, zaehlerStand: 3, duenger: 0, time: '11:00' }, // zaehlerStand went backwards!
    ];
    w.renderResults();

    var mlContainer = w.document.getElementById('drill_machine_log');
    var prognose = mlContainer.querySelectorAll('.drill-prognose');
    // haDriven = max(0, 3 - 5) = 0
    // cumEinheit = max(0, 5 - 0*1.8) + 3 = 5 + 3 = 8
    // prognose = 3 + 8/1.8 = 3 + 4.44 = ~7.4
    expect(prognose[1].textContent).toContain('7,4');
  });
});

describe('drillTabList needDiv edge cases', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('shows "fertig" when einheiten done but duenger still remaining (duenger=0)', () => {
    w.state.reiter[0] = { name: 'Tab 1', hektar: 10, koerner: 90000, duenger: 0, entries: [
      { einheit: 18, duenger: 0, hektar: 10, time: '12:00' }
    ]};
    w.renderDrillTabList();
    var need = w.document.getElementById('dtl_need_0');
    expect(need.textContent).toContain('fertig');
    expect(need.classList.contains('done')).toBe(true);
  });

  it('shows remaining need with duenger kg when both incomplete', () => {
    w.state.reiter[0] = { name: 'Tab 1', hektar: 10, koerner: 90000, duenger: 150, entries: [
      { einheit: 10, duenger: 200, hektar: 5, time: '12:00' }
    ]};
    w.renderDrillTabList();
    var need = w.document.getElementById('dtl_need_0');
    // Needs 8 more einheiten + 1300 more kg duenger
    expect(need.textContent).toContain('Einheiten');
    expect(need.textContent).toContain('kg Dünger');
  });

  it('shows only einheiten remaining when duenger is 0', () => {
    w.state.reiter[0] = { name: 'Tab 1', hektar: 10, koerner: 90000, duenger: 0, entries: [
      { einheit: 10, duenger: 0, hektar: 5, time: '12:00' }
    ]};
    w.renderDrillTabList();
    var need = w.document.getElementById('dtl_need_0');
    expect(need.textContent).toContain('braucht');
    expect(need.textContent).toContain('Einheiten');
    expect(need.textContent).not.toContain('Dünger');
  });

  it('shows "fertig" when both saat and duenger are complete', () => {
    w.state.reiter[0] = { name: 'Tab 1', hektar: 10, koerner: 90000, duenger: 150, entries: [
      { einheit: 18, duenger: 1500, hektar: 10, time: '12:00' }
    ]};
    w.renderDrillTabList();
    var need = w.document.getElementById('dtl_need_0');
    expect(need.textContent).toContain('fertig');
    expect(need.classList.contains('done')).toBe(true);
  });
});

describe('renderDashboard: BUG — does not apply fahrgassen factor', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('dashboard shows WRONG einheiten when fahrgassen enabled (known bug)', () => {
    w.state.reiter[0] = { name: 'Tab 1', hektar: 10, koerner: 100000, duenger: 0, entries: [] };
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 4; // factor = 3/4 = 0.75

    // Correct calculation (getTabTotalEinheiten):
    // kornerGesamt = 10 * 100000 * 0.75 = 750000
    // einheiten = 750000 / 50000 = 15

    // Dashboard uses raw: 10 * 100000 / 50000 = 20 (WRONG)
    w.renderDashboard();
    var cards = w.document.getElementById('dashboard_content').querySelectorAll('.dashboard-reiter-card');
    // Per-tab card shows raw calculation (20.0 instead of 15.0)
    var einheitenVal = cards[0].querySelectorAll('.dashboard-stat-value')[2]; // "Einheiten verbl."
    expect(einheitenVal.textContent).toContain('15,0'); // FIXED: fahrgassen factor now applied
  });

  it('dashboard summary also uses raw calculation (known bug)', () => {
    w.state.reiter[0] = { name: 'Tab 1', hektar: 10, koerner: 100000, duenger: 0, entries: [] };
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 4;

    w.renderDashboard();
    var summaryValues = w.document.getElementById('dashboard_content')
      .querySelectorAll('.dashboard-summary-value');
    // [0] = Fläche, [1] = Einheiten verbl., [2] = Dünger verbl.
    // Summary now shows 15,0 (with fahrgassen) instead of 20,0 (raw)
    expect(summaryValues[1].textContent).toContain('15,0'); // FIXED: fahrgassen factor now applied
  });
});

describe('renderDashboard: summary with partial entries', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('shows remaining einheiten when partially drilled', () => {
    w.state.reiter[0] = { name: 'Tab 1', hektar: 10, koerner: 90000, duenger: 0, entries: [
      { einheit: 5, duenger: 0 }
    ]};
    w.renderDashboard();

    var cards = w.document.getElementById('dashboard_content').querySelectorAll('.dashboard-reiter-card');
    var einheitenRem = cards[0].querySelectorAll('.dashboard-stat-value')[2];
    // Total = 18, used = 5, rem = 13
    expect(einheitenRem.textContent).toContain('13,0');
  });

  it('progress bar shows correct percentage', () => {
    w.state.reiter[0] = { name: 'Tab 1', hektar: 10, koerner: 90000, duenger: 0, entries: [
      { einheit: 9, duenger: 0 }
    ]};
    w.renderDashboard();

    var cards = w.document.getElementById('dashboard_content').querySelectorAll('.dashboard-reiter-card');
    var fill = cards[0].querySelector('.dashboard-progress-fill');
    // 9/18 = 50%
    expect(fill.style.width).toBe('50%');
  });

  it('shows done class when 100% drilled', () => {
    w.state.reiter[0] = { name: 'Tab 1', hektar: 10, koerner: 90000, duenger: 0, entries: [
      { einheit: 18, duenger: 0 }
    ]};
    w.renderDashboard();

    var cards = w.document.getElementById('dashboard_content').querySelectorAll('.dashboard-reiter-card');
    var einheitenRem = cards[0].querySelectorAll('.dashboard-stat-value')[2];
    expect(einheitenRem.classList.contains('done')).toBe(true);
  });
});

describe('initUI restores einheitGroesse with custom value', () => {
  let w, store;
  beforeEach(() => { w = createDom().window; store = {}; });

  it('restores einheitGroesseEnabled and shows settings', () => {
    w.state.einheitGroesseEnabled = true;
    w.state.koernerProEinheit = 80000;
    w.saveState();
    w.initUI();

    var toggle = w.document.getElementById('einheit_groesse_toggle');
    var settings = w.document.getElementById('einheit_groesse_settings');
    expect(toggle.classList.contains('active')).toBe(true);
    expect(settings.classList.contains('open')).toBe(true);
    expect(w.document.getElementById('koerner_pro_einheit').value).toBe('80000');
  });

  it('shows custom koernerProEinheit info text', () => {
    w.state.einheitGroesseEnabled = true;
    w.state.koernerProEinheit = 80000;
    w.saveState();
    w.initUI();

    var saved = w.document.getElementById('einheit_groesse_saved');
    expect(saved.textContent).toContain('80.000');
    expect(saved.textContent).toContain('Körner/Einheit');
  });

  it('does NOT show info text when koernerProEinheit is default 50000', () => {
    w.state.einheitGroesseEnabled = true;
    w.state.koernerProEinheit = 50000;
    w.saveState();
    w.initUI();

    var saved = w.document.getElementById('einheit_groesse_saved');
    expect(saved.textContent).toBe('');
  });
});

describe('berechne: OR condition for drill entries exceed check', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('asks confirm when usedEinheit exceeds but usedDuenger is fine', () => {
    var originalConfirm = w.confirm;
    var confirmed = false;
    w.confirm = () => { confirmed = true; return false; };

    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, koerner: 90000, duenger: 150, entries: [
        { einheit: 20, duenger: 500, hektar: 5, time: '10:00' }
      ]
    };
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '90000';
    w.document.getElementById('duenger').value = '150';

    w.berechne();
    // usedEinheit=20 > getTotalEinheiten()=18, should trigger confirm
    expect(confirmed).toBe(true);

    w.confirm = originalConfirm;
  });

  it('clears entries when user confirms after duenger exceeds', () => {
    var originalConfirm = w.confirm;
    w.confirm = () => true;

    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, koerner: 90000, duenger: 150, entries: [
        { einheit: 5, duenger: 2000, hektar: 5, time: '10:00' }
      ]
    };
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '90000';
    w.document.getElementById('duenger').value = '150';

    w.berechne();
    expect(w.state.reiter[0].entries.length).toBe(0);

    w.confirm = originalConfirm;
  });
});

describe('lv() migration: ensures entries array on all reiters', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('adds entries=[] to reiters missing it', () => {
    var migratedState = {
      reiter: [
        { name: 'Tab 1', hektar: 5, koerner: 80000 },
        { name: 'Tab 2', hektar: 3, koerner: 70000, entries: [{ einheit: 2 }] }
      ],
      activeReiter: 0,
      machineLog: []
    };
    w.localStorage.setItem('mais_rechner', JSON.stringify(migratedState));
    w.loadState();
    expect(w.state.reiter[0].entries).toEqual([]);
    expect(w.state.reiter[1].entries.length).toBe(1);
  });

  it('handles state with only machineLog (no reiter key at all)', () => {
    var migratedState = {
      hektar: 10,
      koerner: 90000,
      duenger: 150,
      machineLog: []
    };
    w.localStorage.setItem('mais_rechner', JSON.stringify(migratedState));
    w.loadState();
    expect(w.state.reiter).toBeTruthy();
    expect(w.state.reiter.length).toBe(1);
    expect(w.state.reiter[0].entries).toEqual([]);
  });
});

describe('drillCalcAll: remaining need calculation accounts for existing entries', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('distributes only the REMAINING need, not total', () => {
    w.state.reiter = [
      { name: 'A', hektar: 10, koerner: 90000, duenger: 0, entries: [
        { einheit: 10, duenger: 0, hektar: 5, time: '10:00' }
      ]},
      { name: 'B', hektar: 5, koerner: 80000, duenger: 0, entries: [] },
    ];
    w.state.activeReiter = 0;
    w.renderDrillTabList();

    // Tab A: total=18, used=10, need=8
    // Tab B: total=8, used=0, need=8
    w.document.getElementById('drill_einheit').value = '20';
    w.document.getElementById('drill_duenger').value = '0';

    w.state.drillPriorities[0] = 2; // Tab A highest
    w.state.drillPriorities[1] = 1;
    w.drillCalcAll();

    var eA = w.document.getElementById('dtl_e_0');
    var eB = w.document.getElementById('dtl_e_1');
    // Tab A gets min(8, 20) = 8
    expect(w.parseDE(eA.value)).toBeCloseTo(8);
    // Tab B gets min(8, 20-8=12) = 8
    expect(w.parseDE(eB.value)).toBeCloseTo(8);
  });
});
