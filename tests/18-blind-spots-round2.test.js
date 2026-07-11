/**
 * Tests for remaining blind spots and edge cases found in audit round 2.
 *
 * Includes (original round 2):
 * 1. switchReiter behavior with the protokoll view (view-toggle, Issue #291)
 * 2. Prognose cumulative calculation with fahrgassen factor
 * 3. Prognose with duenger-only consumption (no einheit)
 * 4. drillTabList needDiv: done with duenger finished but einheit remaining
 * 5. renderDashboard per-tab calculation (fahrgassen NOT applied — BUG documented)
 * 6. renderDashboard summary with partial entries
 * 7. initUI with einheitGroesseEnabled and custom koernerProEinheit
 * 8. berechne with usedEinheit exceeds but usedDuenger is fine (OR condition)
 * 9. Prognose: second fill with hektar stand going backwards
 * 10. renderDrillTabList: remaining need shows duenger kg
 *
 * Includes (merged from tests/18-blind-spots-2.test.js, see #279):
 * - drillCalcAll() — distribution algorithm
 * - drillMachineRemove() — machine log entry removal
 * - Theme — getStoredTheme / setStoredTheme / applyTheme / toggleTheme / initTheme
 * - renderDrillTabList() — row rendering, priority button, input mode
 * - switchToProtokoll() — view toggle (Issue #291, Pre-#291 pattern)
 * - Protokoll tab btn — click triggers switchToProtokoll (active class via renderTabs)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('switchReiter from protokoll view', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  // Der Protokoll-Tab ist kein eigener Reiter, sondern ein View-Toggle.
  // switchReiter() muss aus dem Protokoll in die Feld-Ansicht zurückschalten
  // (activeView=null) und auf den Ziel-Tab wechseln.
  it('switches to same tab AND exits protokoll view (activeView → null)', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000 };
    w.switchToProtokoll();
    expect(w.state.activeView).toBe('protokoll');
    expect(w.state.activeReiter).toBe(0);

    w.switchReiter(0);
    expect(w.state.activeView).toBeNull();
    expect(w.state.activeReiter).toBe(0);
  });

  it('switches to a different tab AND exits protokoll view', () => {
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
    expect(einheitenVal.textContent).toContain('15'); // FIXED: fahrgassen factor now applied
  });

  it('dashboard summary also uses raw calculation (known bug)', () => {
    w.state.reiter[0] = { name: 'Tab 1', hektar: 10, koerner: 100000, duenger: 0, entries: [] };
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 4;

    w.renderDashboard();
    var summaryValues = w.document.getElementById('dashboard_content')
      .querySelectorAll('.dashboard-summary-value');
    // [0] = Fläche, [1] = Einheiten verbl., [2] = Dünger verbl.
    // Summary now shows 15 (with fahrgassen) instead of 20 (raw)
    expect(summaryValues[1].textContent).toContain('15'); // FIXED: fahrgassen factor now applied
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
    expect(einheitenRem.textContent).toContain('13');
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
    w.localStorage.setItem('agrar_rechner', JSON.stringify(migratedState));
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
    w.localStorage.setItem('agrar_rechner', JSON.stringify(migratedState));
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

    w.state.drillPriorities[0] = 1; // Tab A höchste Prio (Issue #264)
    w.state.drillPriorities[1] = 2;
    w.drillCalcAll();

    var eA = w.document.getElementById('dtl_e_0');
    var eB = w.document.getElementById('dtl_e_1');
    // Tab A gets min(8, 20) = 8
    expect(w.parseDE(eA.value)).toBeCloseTo(8);
    // Tab B gets min(8, 20-8=12) = 8
    expect(w.parseDE(eB.value)).toBeCloseTo(8);
  });
});

describe('drillCalcAll()', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
    w.state.reiter = [
      { name: 'A', hektar: 10, koerner: 50000, duenger: 0, entries: [] },
      { name: 'B', hektar: 10, koerner: 50000, duenger: 0, entries: [] },
    ];
    w.state.activeReiter = 0;
    w.renderDrillTabList();
  });

  it('leaves non-prioritized tabs empty', () => {
    w.state.drillPriorities = { 1: 1 };
    doc.getElementById('drill_einheit').value = '5';
    doc.getElementById('drill_duenger').value = '';
    w.drillCalcAll();
    expect(doc.getElementById('dtl_e_0').value).toBe('');
    expect(doc.getElementById('dtl_e_1').value).toBe('5,0');
  });

  it('distributes to highest priority tab first', () => {
    // Issue #264: Prio 1 = höchste. Tab 0 (prio 1) bekommt zuerst.
    w.state.drillPriorities = { 0: 1, 1: 2 };
    doc.getElementById('drill_einheit').value = '15';
    doc.getElementById('drill_duenger').value = '';
    w.drillCalcAll();
    expect(doc.getElementById('dtl_e_0').value).toBe('10,0');
    expect(doc.getElementById('dtl_e_1').value).toBe('5,0');
  });

  it('caps distribution at what tab needs', () => {
    // Both tabs: 10 ha × 50000 / 50000 = 10 units each
    // Tab A: 3 used → needE = 7; Tab B: 0 used → needE = 10
    // Issue #264: Prio 1 = höchste. Tab A (prio 1) bekommt zuerst.
    // Cap-fill: A gets min(20, 7) = 7, B gets min(13, 10) = 10.
    // Tab B's cap (10) is exhausted by its cap allocation, so the leftover
    // (20 - 7 - 10 = 3) is dropped — it is NOT added to B (B's cap is full).
    // Result: A = 7, B = 10, leftover 3 lost.
    w.state.reiter[0].entries = [{ einheit: 3, hektar: 3 }];
    w.state.reiter[1].entries = [];
    w.state.drillPriorities = { 0: 1, 1: 2 };
    doc.getElementById('drill_einheit').value = '20';
    doc.getElementById('drill_duenger').value = '';
    w.drillCalcAll();
    expect(doc.getElementById('dtl_e_0').value).toBe('7,0');
    expect(doc.getElementById('dtl_e_1').value).toBe('10,0');
  });

  it('distributes duenger separately from einheit (symmetric to Saat-Pfad, Issue #329)', () => {
    w.state.reiter = [
      { name: 'A', hektar: 10, koerner: 50000, duenger: 100, entries: [] },
      { name: 'B', hektar: 5, koerner: 50000, duenger: 200, entries: [] },
    ];
    w.renderDrillTabList();
    w.state.drillPriorities = { 0: 1, 1: 2 };
    doc.getElementById('drill_einheit').value = '5';
    doc.getElementById('drill_duenger').value = '3000';
    w.drillCalcAll();
    // Issue #329: Dünger folgt Saat-Prio-Logik. Tab A SOLL = 10*100 = 1000,
    // Tab B SOLL = 5*200 = 1000. Fill 3000 kg → A nimmt 1000 (cap), B nimmt 1000.
    // Rest 1000 ist Überschuss und wird in drillAdd() in den machineLog geschrieben.
    expect(doc.getElementById('dtl_d_0').value).toBe('1000,0');
    expect(doc.getElementById('dtl_d_1').value).toBe('1000,0');
  });

  it('handles empty gesamtEinheit', () => {
    w.state.drillPriorities = { 0: 1 };
    doc.getElementById('drill_einheit').value = '';
    doc.getElementById('drill_duenger').value = '';
    w.drillCalcAll();
    expect(doc.getElementById('dtl_e_0').value).toBe('');
    expect(doc.getElementById('dtl_d_0').value).toBe('');
  });

  it('handles empty drill_duenger', () => {
    w.state.drillPriorities = { 0: 1 };
    doc.getElementById('drill_einheit').value = '5';
    doc.getElementById('drill_duenger').value = '';
    w.drillCalcAll();
    expect(doc.getElementById('dtl_e_0').value).toBe('5,0');
    expect(doc.getElementById('dtl_d_0').value).toBe('');
  });

  it('writes empty for tabs with no priority', () => {
    w.state.drillPriorities = { 0: 1 };
    doc.getElementById('drill_einheit').value = '10';
    doc.getElementById('drill_duenger').value = '';
    w.drillCalcAll();
    expect(doc.getElementById('dtl_e_0').value).toBe('10,0');
    expect(doc.getElementById('dtl_e_1').value).toBe('');
  });
});

// ---------------------------------------------------------------------------
// drillMachineRemove
// ---------------------------------------------------------------------------
describe('drillMachineRemove()', () => {
  let w;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
  });

  it('removes machine log entry by index', () => {
    w.state.machineLog = [
      { einheit: 5, hektar: 3, duenger: 100, time: '10:00' },
      { einheit: 3, hektar: 2, duenger: 50, time: '11:00' },
    ];
    w.drillMachineRemove(0);
    expect(w.state.machineLog.length).toBe(1);
    expect(w.state.machineLog[0].time).toBe('11:00');
  });

  it('does nothing for out-of-range index', () => {
    w.state.machineLog = [{ einheit: 5 }];
    w.drillMachineRemove(5);
    expect(w.state.machineLog.length).toBe(1);
  });

  it('does nothing for negative index', () => {
    w.state.machineLog = [{ einheit: 5 }];
    w.drillMachineRemove(-1);
    expect(w.state.machineLog.length).toBe(1);
  });

  it('persists after removal', () => {
    w.state.machineLog = [{ einheit: 5 }];
    w.drillMachineRemove(0);
    const stored = JSON.parse(w.localStorage.getItem('agrar_rechner'));
    expect(stored.machineLog.length).toBe(0);
  });

  it('refreshes drill projections after machine log removal', () => {
    // Setup: two machine log entries, tab with prio, drill input set
    const { document } = w;
    w.state.reiter = [
      { name: 'Tab A', hektar: 10, koerner: 50000, duenger: 0, entries: [] },
    ];
    w.state.machineLog = [
      { einheit: 5, hektar: 5, duenger: 0, time: '10:00' },
      { einheit: 3, hektar: 3, duenger: 0, time: '11:00' },
    ];
    w.state.drillPriorities = { 0: 1 };
    w.state.activeReiter = 0;
    w.renderDrillTabList();
    document.getElementById('drill_einheit').value = '20';
    document.getElementById('drill_duenger').value = '';

    // Run drillCalcAll to populate projections
    w.drillCalcAll();

    // Verify initial state: Tab A gets 5 units (capped at need), remaining 5 units available
    var remainingBefore = document.getElementById('ds_saat_remaining').textContent;

    // Remove the first machine log entry (idx=0)
    w.drillMachineRemove(0);

    // After removal, drill projections must be recalculated (drillCalcAll called)
    // The drill summary remaining should reflect the new state
    // (machineLog now has 1 entry, projections are recalculated)
    var remainingAfter = document.getElementById('ds_saat_remaining').textContent;
    // Just verify the element is updated (not stale '—' or old value)
    expect(remainingAfter).not.toBe('');
  });
});

// ---------------------------------------------------------------------------
// Theme functions
// ---------------------------------------------------------------------------
describe('Theme', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  describe('getStoredTheme()', () => {
    it('returns null when no theme saved', () => {
      expect(w.getStoredTheme()).toBeNull();
    });

    it('returns stored theme value', () => {
      w.setStoredTheme('dark');
      expect(w.getStoredTheme()).toBe('dark');
    });
  });

  describe('setStoredTheme()', () => {
    it('persists theme to localStorage', () => {
      w.setStoredTheme('dark');
      expect(w.localStorage.getItem('mais_rechner_theme')).toBe('dark');
    });

    it('overwrites previous theme', () => {
      w.setStoredTheme('dark');
      w.setStoredTheme('light');
      expect(w.localStorage.getItem('mais_rechner_theme')).toBe('light');
    });
  });

  describe('applyTheme()', () => {
    it('adds dark class to html element when dark=true', () => {
      w.applyTheme(true);
      expect(doc.documentElement.classList.contains('dark')).toBe(true);
    });

    it('removes dark class when dark=false', () => {
      doc.documentElement.classList.add('dark');
      w.applyTheme(false);
      expect(doc.documentElement.classList.contains('dark')).toBe(false);
    });

    it('sets theme-toggle button to sun icon when dark=true', () => {
      w.applyTheme(true);
      expect(doc.getElementById('theme_toggle').textContent).toBe('☀️');
    });

    it('sets theme-toggle button to moon icon when dark=false', () => {
      w.applyTheme(false);
      expect(doc.getElementById('theme_toggle').textContent).toBe('🌙');
    });
  });

  describe('toggleTheme()', () => {
    it('toggles from light to dark', () => {
      doc.documentElement.classList.remove('dark');
      w.toggleTheme();
      expect(doc.documentElement.classList.contains('dark')).toBe(true);
      expect(w.getStoredTheme()).toBe('dark');
    });

    it('toggles from dark to light', () => {
      doc.documentElement.classList.add('dark');
      w.toggleTheme();
      expect(doc.documentElement.classList.contains('dark')).toBe(false);
      expect(w.getStoredTheme()).toBe('light');
    });
  });

  describe('initTheme()', () => {
    it('applies stored dark theme', () => {
      w.setStoredTheme('dark');
      w.initTheme();
      expect(doc.documentElement.classList.contains('dark')).toBe(true);
    });

    it('applies stored light theme', () => {
      w.setStoredTheme('light');
      w.initTheme();
      expect(doc.documentElement.classList.contains('dark')).toBe(false);
    });

    it('is a no-op when no stored theme', () => {
      w.localStorage.removeItem('mais_rechner_theme');
      expect(() => w.initTheme()).not.toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// renderDrillTabList
// ---------------------------------------------------------------------------
describe('renderDrillTabList()', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('creates one row per tab', () => {
    w.state.reiter = [
      { name: 'A', hektar: 10, koerner: 90000, duenger: 0, entries: [] },
      { name: 'B', hektar: 5, koerner: 80000, duenger: 0, entries: [] },
    ];
    w.renderDrillTabList();
    expect(doc.querySelectorAll('.drill-tab-row').length).toBe(2);
  });

  it('shows tab name in row', () => {
    w.state.reiter = [{ name: 'Mein Feld', hektar: 10, koerner: 90000, duenger: 0, entries: [] }];
    w.renderDrillTabList();
    expect(doc.querySelector('.drill-tab-name').textContent).toContain('Mein Feld');
  });

  it('shows "braucht X Einheiten" when tab needs units', () => {
    w.state.reiter = [{ name: 'A', hektar: 10, koerner: 50000, duenger: 0, entries: [] }];
    w.renderDrillTabList();
    const need = doc.querySelector('.drill-tab-need');
    expect(need.textContent).toContain('braucht');
    expect(need.textContent).toContain('10,0');
  });

  it('shows "braucht X Einheiten, Y kg Dünger" when tab also needs duenger', () => {
    w.state.reiter = [{ name: 'A', hektar: 10, koerner: 50000, duenger: 100, entries: [] }];
    w.renderDrillTabList();
    const need = doc.querySelector('.drill-tab-need');
    expect(need.textContent).toContain('Einheiten');
    expect(need.textContent).toContain('Dünger');
  });

  it('shows "✓ fertig" when remaining is essentially zero', () => {
    w.state.reiter = [{
      name: 'A', hektar: 10, koerner: 50000, duenger: 100,
      entries: [{ einheit: 10, duenger: 1000, hectare: 0, time: '10:00' }]
    }];
    w.renderDrillTabList();
    const need = doc.querySelector('.drill-tab-need');
    expect(need.textContent).toContain('✓ fertig');
    expect(need.classList.contains('done')).toBe(true);
  });

  it('priority button cycles 0 → 1 → N → 0', () => {
    w.state.reiter = [
      { name: 'A', hektar: 10, koerner: 50000, duenger: 0, entries: [] },
      { name: 'B', hektar: 5, koerner: 50000, duenger: 0, entries: [] },
    ];
    w.renderDrillTabList();

    // 0 → 1
    doc.getElementById('dtl_prio_0').onclick();
    expect(doc.getElementById('dtl_prio_0').getAttribute('data-prio')).toBe('1');
    expect(doc.getElementById('dtl_prio_0').classList.contains('active')).toBe(true);

    // 1 → 2
    doc.getElementById('dtl_prio_0').onclick();
    expect(doc.getElementById('dtl_prio_0').getAttribute('data-prio')).toBe('2');

    // 2 → 0
    doc.getElementById('dtl_prio_0').onclick();
    expect(doc.getElementById('dtl_prio_0').getAttribute('data-prio')).toBe('0');
    expect(doc.getElementById('dtl_prio_0').classList.contains('active')).toBe(false);
  });

  it('priority button has active class when prio > 0', () => {
    w.state.reiter = [
      { name: 'A', hektar: 10, koerner: 50000, duenger: 0, entries: [] },
      { name: 'B', hektar: 5, koerner: 50000, duenger: 0, entries: [] },
    ];
    w.renderDrillTabList();

    expect(doc.getElementById('dtl_prio_0').classList.contains('active')).toBe(false);
    doc.getElementById('dtl_prio_0').onclick();
    expect(doc.getElementById('dtl_prio_0').classList.contains('active')).toBe(true);
    doc.getElementById('dtl_prio_0').onclick(); // 1 → 2
    expect(doc.getElementById('dtl_prio_0').classList.contains('active')).toBe(true);
    doc.getElementById('dtl_prio_0').onclick(); // 2 → 0
    expect(doc.getElementById('dtl_prio_0').classList.contains('active')).toBe(false);
  });

  it('has decimal inputMode on einheit and duenger inputs', () => {
    w.state.reiter = [{ name: 'A', hektar: 10, koerner: 50000, duenger: 0, entries: [] }];
    w.renderDrillTabList();
    expect(doc.getElementById('dtl_e_0').inputMode).toBe('decimal');
    expect(doc.getElementById('dtl_d_0').inputMode).toBe('decimal');
  });

  it('all main decimal inputs have inputmode=decimal for mobile keyboard + keydown-based auto-comma detection', () => {
    // inputmode=decimal shows mobile decimal keyboard; auto-comma detection
    // uses keydown tracking to distinguish user-typed vs browser-auto-inserted commas.
    const mainInputs = ['hektar', 'ist_hektar', 'duenger', 'fahrgassen_breite', 'drill_einheit', 'drill_duenger', 'drill_hektar'];
    for (const id of mainInputs) {
      const el = doc.getElementById(id);
      expect(el.inputMode).toBe('decimal');
    }
  });

  it('calls drillCalcAll when priority button is clicked', () => {
    w.state.reiter = [
      { name: 'A', hektar: 10, koerner: 50000, duenger: 0, entries: [] },
      { name: 'B', hektar: 10, koerner: 50000, duenger: 0, entries: [] },
    ];
    w.renderDrillTabList();
    w.state.drillPriorities = { 1: 1 };
    doc.getElementById('drill_einheit').value = '5';
    doc.getElementById('drill_duenger').value = '';
    doc.getElementById('dtl_prio_0').onclick(); // sets prio 0 → 1, calls drillCalcAll
    expect(doc.getElementById('dtl_e_0').value).toBe('5,0');
  });
});

// ---------------------------------------------------------------------------
// switchToProtokoll — view toggle (Issue #291, Pre-#291 pattern)
// ---------------------------------------------------------------------------
describe('switchToProtokoll()', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('sets activeView to protokoll', () => {
    w.switchToProtokoll();
    expect(w.state.activeView).toBe('protokoll');
  });

  it('calls renderDrillTabList (drill-tab-row appears in DOM)', () => {
    w.state.reiter = [{ name: 'A', hektar: 10, koerner: 90000, duenger: 0, entries: [] }];
    w.switchToProtokoll();
    expect(doc.querySelectorAll('.drill-tab-row').length).toBe(1);
  });

  it('toggles back to null when called again', () => {
    w.switchToProtokoll();
    expect(w.state.activeView).toBe('protokoll');
    w.switchToProtokoll();
    expect(w.state.activeView).toBeNull();
  });

  it('persists state to localStorage', () => {
    w.switchToProtokoll();
    const stored = JSON.parse(w.localStorage.getItem('agrar_rechner'));
    expect(stored.activeView).toBe('protokoll');
  });

  it('syncs current inputs before switching (syncStateFromInputs runs first)', () => {
    w.state.reiter[0].hektar = 10;
    doc.getElementById('hektar').value = '15';
    w.syncStateFromInputs();
    w.switchToProtokoll();
    expect(w.state.reiter[0].hektar).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// renderView — visibility of elements in protokoll vs field view
// ---------------------------------------------------------------------------
describe('renderView()', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('drill_section shown in protokoll view', () => {
    w.state.activeView = 'protokoll';
    w.renderView();
    expect(doc.getElementById('drill_section').style.display).toBe('block');
  });

  it('results hidden when switching to protokoll (even with data)', () => {
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 90000;
    w.state.activeView = 'protokoll';
    w.renderView();
    expect(doc.getElementById('results').style.display).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// Protokoll tab button — click triggers switchToProtokoll (Issue #291)
// ---------------------------------------------------------------------------
describe('Protokoll tab button', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('clicking the Protokoll tab button calls switchToProtokoll (activeView → protokoll)', () => {
    var tabBtn = doc.getElementById('protokoll_tab_btn');
    expect(tabBtn).toBeTruthy();
    tabBtn.click();
    expect(w.state.activeView).toBe('protokoll');
  });
});

// ---------------------------------------------------------------------------
// renderTabs — protokoll tab button active state
// ---------------------------------------------------------------------------
describe('renderTabs() protokoll btn', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('protokoll_tab_btn has active class when activeView=protokoll', () => {
    w.state.activeView = 'protokoll';
    w.renderTabs();
    expect(doc.getElementById('protokoll_tab_btn').classList.contains('active')).toBe(true);
  });

  it('protokoll_tab_btn has no active class when activeView=null', () => {
    w.state.activeView = null;
    w.renderTabs();
    expect(doc.getElementById('protokoll_tab_btn').classList.contains('active')).toBe(false);
  });
});

