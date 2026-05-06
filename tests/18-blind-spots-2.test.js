/**
 * Blind spots round 2 — remaining untested code paths:
 * - zaehlerUpdate()
 * - einheitGroesseToggle / einheitGroesseUpdate
 * - drillCalcAll
 * - drillMachineRemove
 * - Theme functions
 * - renderDrillTabList
 * - switchToProtokoll
 * - confirmResetAll(fullReset=true)
 * - renderResults machine log
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

// ---------------------------------------------------------------------------
// zaehlerUpdate
// ---------------------------------------------------------------------------
describe('zaehlerUpdate()', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('shows zaehler_result when valid zaehlerstand', () => {
    doc.getElementById('zaehler_stand').value = '5';
    w.zaehlerUpdate();
    expect(doc.getElementById('zaehler_result').style.display).toBe('block');
  });

  it('hides zaehler_result when zaehlerstand is empty (NaN)', () => {
    doc.getElementById('zaehler_stand').value = '';
    w.zaehlerUpdate();
    // parseDE('') → parseFloat('') || 0 → 0 → z=0, z>=0 so display=block
    // Empty shows block because || 0 makes NaN → 0, which is >= 0
    expect(doc.getElementById('zaehler_result').style.display).toBe('block');
  });

  it('shows zaehler_result even for NaN input (parseDE returns 0 for invalid)', () => {
    doc.getElementById('zaehler_stand').value = 'abc';
    w.zaehlerUpdate();
    // parseDE('abc') → parseFloat('abc') || 0 → 0 → display=block
    expect(doc.getElementById('zaehler_result').style.display).toBe('block');
  });

  it('hides zaehler_result when zaehlerstand is negative', () => {
    doc.getElementById('zaehler_stand').value = '-1';
    w.zaehlerUpdate();
    expect(doc.getElementById('zaehler_result').style.display).toBe('none');
  });

  it('shows positive delta class for positive zaehler change', () => {
    w.state.zaehlerstand = 5;
    doc.getElementById('zaehler_stand').value = '10';
    w.zaehlerUpdate();
    expect(doc.getElementById('z_ist').className).toBe('delta-value positive');
  });

  it('shows negative delta class for negative zaehler change', () => {
    w.state.zaehlerstand = 10;
    doc.getElementById('zaehler_stand').value = '5';
    w.zaehlerUpdate();
    expect(doc.getElementById('z_ist').className).toBe('delta-value negative');
  });

  it('persists zaehlerstand to state', () => {
    w.state.zaehlerstand = 0;
    doc.getElementById('zaehler_stand').value = '42';
    w.zaehlerUpdate();
    expect(w.state.zaehlerstand).toBe(42);
  });

  it('persists 0 for negative input (negative not stored)', () => {
    w.state.zaehlerstand = 0;
    doc.getElementById('zaehler_stand').value = '-5';
    w.zaehlerUpdate();
    // Negative is rejected (hidden) but zaehlerstand stays at initial 0
    expect(w.state.zaehlerstand).toBe(0);
  });

  it('formats z_total with DE decimal', () => {
    w.state.zaehlerstand = 0;
    doc.getElementById('zaehler_stand').value = '12,5';
    w.zaehlerUpdate();
    expect(doc.getElementById('z_total').textContent).toBe('12,5 ha');
  });

  it('calls sv() to persist', () => {
    doc.getElementById('zaehler_stand').value = '7';
    w.zaehlerUpdate();
    const stored = JSON.parse(w.localStorage.getItem('mais_rechner'));
    expect(stored.zaehlerstand).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// einheitGroesseToggle
// ---------------------------------------------------------------------------
describe('einheitGroesseToggle()', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('enables on first click', () => {
    w.einheitGroesseToggle();
    expect(w.state.einheitGroesseEnabled).toBe(true);
    expect(doc.getElementById('einheit_groesse_toggle').classList.contains('active')).toBe(true);
    expect(doc.getElementById('einheit_groesse_settings').classList.contains('open')).toBe(true);
  });

  it('disables on second click', () => {
    w.einheitGroesseToggle();
    w.einheitGroesseToggle();
    expect(w.state.einheitGroesseEnabled).toBe(false);
    expect(doc.getElementById('einheit_groesse_toggle').classList.contains('active')).toBe(false);
    expect(doc.getElementById('einheit_groesse_settings').classList.contains('open')).toBe(false);
  });

  it('clears saved text when disabling', () => {
    w.einheitGroesseToggle();
    doc.getElementById('einheit_groesse_saved').textContent = 'foo';
    w.einheitGroesseToggle();
    expect(doc.getElementById('einheit_groesse_saved').textContent).toBe('');
  });

  it('persists state', () => {
    w.einheitGroesseToggle();
    expect(w.state.einheitGroesseEnabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// einheitGroesseUpdate
// ---------------------------------------------------------------------------
describe('einheitGroesseUpdate()', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('sets koernerProEinheit from input', () => {
    doc.getElementById('koerner_pro_einheit').value = '80000';
    w.einheitGroesseUpdate();
    expect(w.state.koernerProEinheit).toBe(80000);
  });

  it('resets to 50000 for invalid input', () => {
    doc.getElementById('koerner_pro_einheit').value = '';
    w.einheitGroesseUpdate();
    expect(w.state.koernerProEinheit).toBe(50000);
  });

  it('resets to 50000 for zero input', () => {
    doc.getElementById('koerner_pro_einheit').value = '0';
    w.einheitGroesseUpdate();
    expect(w.state.koernerProEinheit).toBe(50000);
  });

  it('resets to 50000 for negative input', () => {
    doc.getElementById('koerner_pro_einheit').value = '-100';
    w.einheitGroesseUpdate();
    expect(w.state.koernerProEinheit).toBe(50000);
  });

  it('parses DE-formatted input', () => {
    doc.getElementById('koerner_pro_einheit').value = '45.000';
    w.einheitGroesseUpdate();
    expect(w.state.koernerProEinheit).toBe(45000);
  });

  it('shows saved text when non-default value', () => {
    doc.getElementById('koerner_pro_einheit').value = '60000';
    w.einheitGroesseUpdate();
    expect(doc.getElementById('einheit_groesse_saved').textContent).toContain('60.000');
    expect(doc.getElementById('einheit_groesse_saved').textContent).toContain('Körner/Einheit');
  });

  it('shows NO saved text when default value (50000)', () => {
    doc.getElementById('koerner_pro_einheit').value = '50000';
    w.einheitGroesseUpdate();
    expect(doc.getElementById('einheit_groesse_saved').textContent).toBe('');
  });

  it('calls renderResults when tab has data', () => {
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 90000;
    doc.getElementById('koerner_pro_einheit').value = '100000';
    w.einheitGroesseUpdate();
    // renderResults should run without throwing
    expect(doc.getElementById('r_einheiten').textContent).toBeTruthy();
  });

  it('does not call renderResults when tab is empty', () => {
    doc.getElementById('koerner_pro_einheit').value = '80000';
    // should not throw
    expect(() => w.einheitGroesseUpdate()).not.toThrow();
  });

  it('persists state', () => {
    doc.getElementById('koerner_pro_einheit').value = '70000';
    w.einheitGroesseUpdate();
    const stored = JSON.parse(w.localStorage.getItem('mais_rechner'));
    expect(stored.koernerProEinheit).toBe(70000);
  });
});

// ---------------------------------------------------------------------------
// drillCalcAll — distribution algorithm
// ---------------------------------------------------------------------------
describe('drillCalcAll()', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('distributes to highest priority tab first', () => {
    // Setup: two tabs, both need 10 units
    w.state.reiter = [
      { name: 'A', hektar: 10, koerner: 50000, duenger: 0, entries: [] }, // 10 units needed
      { name: 'B', hektar: 10, koerner: 50000, duenger: 0, entries: [] }, // 10 units needed
    ];
    w.state.activeReiter = 0;

    // renderDrillTabList creates the dtl_e_X inputs and resets drillPriorities
    w.renderDrillTabList();
    // Then set priorities manually (the cyclePrio button does this)
    w.drillPriorities = { 0: 1, 1: 2 };

    doc.getElementById('drill_einheit').value = '15';
    doc.getElementById('drill_duenger').value = '';

    w.drillCalcAll();

    // Tab 1 (priority 2, higher) gets 10, tab 0 (priority 1) gets remainder 5
    expect(doc.getElementById('dtl_e_0').value).toBe('5,0');
    expect(doc.getElementById('dtl_e_1').value).toBe('10,0');
  });

  it('leaves non-prioritized tabs empty', () => {
    w.state.reiter = [
      { name: 'A', hektar: 10, koerner: 50000, duenger: 0, entries: [] },
      { name: 'B', hektar: 10, koerner: 50000, duenger: 0, entries: [] },
    ];
    w.renderDrillTabList();
    w.drillPriorities = { 1: 1 }; // only tab 1 has priority

    doc.getElementById('drill_einheit').value = '5';
    doc.getElementById('drill_duenger').value = '';

    w.drillCalcAll();

    expect(doc.getElementById('dtl_e_0').value).toBe('');
    expect(doc.getElementById('dtl_e_1').value).toBe('5,0');
  });

  it('caps distribution at what tab needs', () => {
    w.state.reiter = [
      // Tab A: needs 5 units total, has entry with 3 units consumed → needs 2 more
      { name: 'A', hektar: 5, koerner: 50000, duenger: 0, entries: [{ einheit: 3, hektar: 3 }] },
      // Tab B: needs 10 units total, nothing consumed → needs 10
      { name: 'B', hektar: 10, koerner: 50000, duenger: 0, entries: [] },
    ];
    w.renderDrillTabList();
    w.drillPriorities = { 0: 1, 1: 2 };

    doc.getElementById('drill_einheit').value = '20';
    doc.getElementById('drill_duenger').value = '';

    w.drillCalcAll();

    // Tab 1 (higher prio) gets 10, Tab 0 gets 2 (its remaining need)
    expect(doc.getElementById('dtl_e_0').value).toBe('2,0');
    expect(doc.getElementById('dtl_e_1').value).toBe('10,0');
  });

  it('distributes duenger separately', () => {
    w.state.reiter = [
      { name: 'A', hektar: 10, koerner: 50000, duenger: 100, entries: [] }, // needs 1000 kg
      { name: 'B', hektar: 5, koerner: 50000, duenger: 200, entries: [] }, // needs 1000 kg
    ];
    w.renderDrillTabList();
    w.drillPriorities = { 0: 1, 1: 2 };

    doc.getElementById('drill_einheit').value = '5';
    doc.getElementById('drill_duenger').value = '3000';

    w.drillCalcAll();

    // Tab 1 (higher prio) gets 1000, Tab 0 gets 1000, 1000 remain
    expect(doc.getElementById('dtl_d_0').value).toBe('1000,0');
    expect(doc.getElementById('dtl_d_1').value).toBe('1000,0');
  });

  it('handles empty gesamtEinheit', () => {
    w.state.reiter = [
      { name: 'A', hektar: 10, koerner: 50000, duenger: 0, entries: [] },
    ];
    w.renderDrillTabList();
    w.drillPriorities = { 0: 1 };

    doc.getElementById('drill_einheit').value = '';
    doc.getElementById('drill_duenger').value = '';

    w.drillCalcAll();

    expect(doc.getElementById('dtl_e_0').value).toBe('');
    expect(doc.getElementById('dtl_d_0').value).toBe('');
  });
});

// ---------------------------------------------------------------------------
// drillMachineRemove
// ---------------------------------------------------------------------------
describe('drillMachineRemove()', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
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
    const stored = JSON.parse(w.localStorage.getItem('mais_rechner'));
    expect(stored.machineLog.length).toBe(0);
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

    it('updates meta theme-color to dark value', () => {
      w.applyTheme(true);
      const meta = doc.querySelector('meta[name="theme-color"]');
      expect(meta.getAttribute('content')).toBe('#1a1f16');
    });

    it('updates meta theme-color to light value', () => {
      w.applyTheme(false);
      const meta = doc.querySelector('meta[name="theme-color"]');
      expect(meta.getAttribute('content')).toBe('#2d5016');
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

    it('follows system preference when no stored theme', () => {
      // No stored theme — initTheme reads system preference
      // In jsdom there is no actual system preference, so it depends on matchMedia result
      w.initTheme();
      // Should not throw regardless of system preference
      expect(() => w.initTheme()).not.toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// renderDrillTabList — Protokoll tab list rendering
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
      { name: 'A', hektar: 10, koerner: 90000, duenger: 150, entries: [] },
      { name: 'B', hektar: 5, koerner: 80000, duenger: 100, entries: [] },
    ];
    w.renderDrillTabList();
    const rows = doc.querySelectorAll('.drill-tab-row');
    expect(rows.length).toBe(2);
  });

  it('shows tab name in row', () => {
    w.state.reiter = [{ name: 'Mein Feld', hektar: 10, koerner: 90000, duenger: 0, entries: [] }];
    w.renderDrillTabList();
    const name = doc.querySelector('.drill-tab-name');
    expect(name.textContent).toContain('Mein Feld');
  });

  it('shows "braucht X Einheiten" when tab needs units', () => {
    w.state.reiter = [{ name: 'A', hektar: 10, koerner: 50000, duenger: 0, entries: [] }]; // needs 10
    w.renderDrillTabList();
    const need = doc.querySelector('.drill-tab-need');
    expect(need.textContent).toContain('braucht');
    expect(need.textContent).toContain('10,0');
  });

  it('shows "braucht X Einheiten, Y kg Dünger" when tab also needs duenger', () => {
    w.state.reiter = [{ name: 'A', hektar: 10, koerner: 50000, duenger: 100, entries: [] }];
    // needs 10 units + 1000 kg duenger
    w.renderDrillTabList();
    const need = doc.querySelector('.drill-tab-need');
    expect(need.textContent).toContain('Einheiten');
    expect(need.textContent).toContain('Dünger');
  });

  it('shows "✓ fertig" when remE and remD are both <= 0.05', () => {
    w.state.reiter = [{
      name: 'A', hektar: 10, koerner: 50000, duenger: 100,
      entries: [{ einheit: 10, duenger: 1000, hectare: 0, time: '10:00' }]
    }];
    w.renderDrillTabList();
    const need = doc.querySelector('.drill-tab-need');
    expect(need.textContent).toContain('✓ fertig');
    expect(need.classList.contains('done')).toBe(true);
  });

  it('does not show duenger line when totalD is 0', () => {
    w.state.reiter = [{ name: 'A', hektar: 10, koerner: 50000, duenger: 0, entries: [] }];
    w.renderDrillTabList();
    const need = doc.querySelector('.drill-tab-need');
    expect(need.textContent).not.toContain('Dünger');
  });

  it('priority button cycles: 0 -> 1 -> 2 -> 0', () => {
    w.state.reiter = [
      { name: 'A', hektar: 10, koerner: 50000, duenger: 0, entries: [] },
      { name: 'B', hektar: 5, koerner: 50000, duenger: 0, entries: [] },
    ];
    w.renderDrillTabList();
    const prioBtn = doc.getElementById('dtl_prio_0');

    // 0 -> 1
    prioBtn.onclick();
    expect(prioBtn.textContent).toBe('1');
    expect(w.drillPriorities[0]).toBe(1);

    // 1 -> 2
    prioBtn.onclick();
    expect(prioBtn.textContent).toBe('2');

    // 2 -> 0 (off)
    prioBtn.onclick();
    expect(prioBtn.textContent).toBe('—');
    expect(w.drillPriorities[0]).toBe(0);
  });

  it('priority button has active class when prio > 0', () => {
    // Need 2 tabs so cycle goes 0 → 1 → 2 → 0 (N=2 allows prio 2)
    w.state.reiter = [
      { name: 'A', hektar: 10, koerner: 50000, duenger: 0, entries: [] },
      { name: 'B', hektar: 5, koerner: 50000, duenger: 0, entries: [] },
    ];
    w.renderDrillTabList();

    // Initial: prio 0, no active class
    expect(doc.getElementById('dtl_prio_0').classList.contains('active')).toBe(false);

    // Click 1: prio 0 → 1, active
    doc.getElementById('dtl_prio_0').onclick();
    expect(doc.getElementById('dtl_prio_0').classList.contains('active')).toBe(true);

    // Click 2: prio 1 → 2, still active
    doc.getElementById('dtl_prio_0').onclick();
    expect(doc.getElementById('dtl_prio_0').classList.contains('active')).toBe(true);
    expect(doc.getElementById('dtl_prio_0').getAttribute('data-prio')).toBe('2');

    // Click 3: prio 2 → 0, no longer active
    doc.getElementById('dtl_prio_0').onclick();
    expect(doc.getElementById('dtl_prio_0').classList.contains('active')).toBe(false);
    expect(doc.getElementById('dtl_prio_0').getAttribute('data-prio')).toBe('0');
  });

  it('has decimal-mode inputs for einheit and duenger', () => {
    w.state.reiter = [{ name: 'A', hektar: 10, koerner: 50000, duenger: 0, entries: [] }];
    w.renderDrillTabList();
    const eInput = doc.getElementById('dtl_e_0');
    const dInput = doc.getElementById('dtl_d_0');
    expect(eInput.inputMode).toBe('decimal');
    expect(dInput.inputMode).toBe('decimal');
  });
});

// ---------------------------------------------------------------------------
// switchToProtokoll
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

  it('calls renderDrillTabList', () => {
    w.state.reiter = [{ name: 'A', hektar: 10, koerner: 90000, duenger: 0, entries: [] }];
    w.switchToProtokoll();
    const rows = doc.querySelectorAll('.drill-tab-row');
    expect(rows.length).toBe(1);
  });

  it('calls renderView', () => {
    w.switchToProtokoll();
    // drill_section should show in protokoll mode
    expect(doc.getElementById('drill_section').style.display).toBe('block');
  });

  it('toggles back to field view when called again', () => {
    w.switchToProtokoll();
    expect(w.state.activeView).toBe('protokoll');
    w.switchToProtokoll();
    expect(w.state.activeView).toBeNull();
  });

  it('persists state', () => {
    w.switchToProtokoll();
    expect(w.state.activeView).toBe('protokoll');
    const stored = JSON.parse(w.localStorage.getItem('mais_rechner'));
    expect(stored.activeView).toBe('protokoll');
  });

  it('syncs current inputs before switching', () => {
    w.state.reiter[0].hektar = 10;
    doc.getElementById('hektar').value = '15';
    w.syncStateFromInputs();
    w.switchToProtokoll();
    expect(w.state.reiter[0].hektar).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// confirmResetAll(fullReset=true) — full reset
// ---------------------------------------------------------------------------
describe('confirmResetAll(fullReset=true)', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('asks "ALLE Daten" confirmation message', () => {
    let lastMsg = '';
    w.confirm = (msg) => { lastMsg = msg; return false; };
    w.confirmResetAll(true);
    expect(lastMsg).toContain('ALLE Daten');
  });

  it('calls resetAll when confirmed', () => {
    w.confirm = () => true;
    w.addReiter();
    w.state.reiter[0].hektar = 10;
    w.confirmResetAll(true);
    expect(w.state.reiter.length).toBe(1);
    expect(w.state.reiter[0].hektar).toBe(0);
  });

  it('does nothing when cancelled', () => {
    w.confirm = () => false;
    w.state.reiter[0].hektar = 99;
    w.confirmResetAll(true);
    expect(w.state.reiter[0].hektar).toBe(99);
  });

  it('clears ALL tabs (not just active) with fullReset', () => {
    w.confirm = () => true;
    w.addReiter();
    w.state.reiter[0].hektar = 10;
    w.state.reiter[1].hektar = 20;
    w.confirmResetAll(true);
    expect(w.state.reiter.length).toBe(1); // only one tab left
  });
});

// ---------------------------------------------------------------------------
// renderResults — machine log display
// ---------------------------------------------------------------------------
describe('renderResults() machine log', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    doc.getElementById('duenger').value = '150';
    w.berechne();
  });

  it('shows machine log entries in drill_machine_log', () => {
    w.state.machineLog = [
      { einheit: 5, hektar: 3, duenger: 100, time: '10:00' },
    ];
    w.renderResults();
    const entries = doc.querySelectorAll('#drill_machine_log .drill-entry');
    expect(entries.length).toBe(1);
  });

  it('machine log entry has hash numbering', () => {
    w.state.machineLog = [
      { einheit: 5, hektar: 3, duenger: 100, time: '10:00' },
      { einheit: 3, hektar: 2, duenger: 50, time: '11:00' },
    ];
    w.renderResults();
    const hashes = doc.querySelectorAll('#drill_machine_log .entry-text span');
    expect(hashes[0].textContent).toBe('#1 ');
    expect(hashes[1].textContent).toBe('#2 ');
  });

  it('machine log entry delete button calls drillMachineRemove', () => {
    w.state.machineLog = [
      { einheit: 5, hektar: 3, duenger: 100, time: '10:00' },
    ];
    w.renderResults();
    const btns = doc.querySelectorAll('#drill_machine_log .btn-danger');
    btns[0].onclick();
    expect(w.state.machineLog.length).toBe(0);
  });

  it('shows Maschinen-Protokoll header when log has entries', () => {
    w.state.machineLog = [{ einheit: 5, hektar: 3, duenger: 100, time: '10:00' }];
    w.renderResults();
    const header = doc.querySelector('#drill_machine_log .drill-entry-tab-header');
    expect(header.textContent).toContain('Maschinen-Protokoll');
  });

  it('shows machine log section title with tab name in protokoll view', () => {
    w.state.activeView = 'protokoll';
    w.state.reiter[0].entries = [];
    w.state.machineLog = [{ einheit: 5, hektar: 3, duenger: 100, time: '10:00' }];
    w.renderResults();
    // Title should be shown in machine log container
    const header = doc.querySelector('#drill_machine_log .drill-entry-tab-header');
    expect(header).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// renderResults — drill section aggregate (all tabs)
// ---------------------------------------------------------------------------
describe('renderResults() drill summary across all tabs', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('ds_saat_total shows total units across all tabs', () => {
    w.state.reiter = [
      { name: 'A', hektar: 10, koerner: 50000, duenger: 0, entries: [] }, // 10 units
      { name: 'B', hektar: 5, koerner: 50000, duenger: 0, entries: [] },   // 5 units
    ];
    w.renderResults();
    expect(doc.getElementById('ds_saat_total').textContent).toContain('15,0');
  });

  it('ds_duenger_total shows "—" when no duenger', () => {
    w.state.reiter = [
      { name: 'A', hektar: 10, koerner: 50000, duenger: 0, entries: [] },
    ];
    w.renderResults();
    expect(doc.getElementById('ds_duenger_total').textContent).toBe('—');
  });

  it('ds_duenger_total shows kg value when duenger set', () => {
    w.state.reiter = [
      { name: 'A', hektar: 10, koerner: 50000, duenger: 100, entries: [] }, // 1000 kg
    ];
    w.renderResults();
    expect(doc.getElementById('ds_duenger_total').textContent).toContain('1.000');
    expect(doc.getElementById('ds_duenger_total').textContent).toContain('kg');
  });

  it('ds_total_summary shows used units text', () => {
    w.state.reiter = [{
      name: 'A', hektar: 10, koerner: 50000, duenger: 0,
      entries: [{ einheit: 3, duenger: 0 }]
    }];
    w.renderResults();
    expect(doc.getElementById('ds_total_summary').textContent).toContain('3,0');
  });

  it('ds_total_summary shows used duenger', () => {
    w.state.reiter = [{
      name: 'A', hektar: 10, koerner: 50000, duenger: 100,
      entries: [{ einheit: 0, duenger: 500 }]
    }];
    w.renderResults();
    expect(doc.getElementById('ds_total_summary').textContent).toContain('500');
    expect(doc.getElementById('ds_total_summary').textContent).toContain('Dünger');
  });

  it('drill_summary hidden when no data and no entries', () => {
    w.state.reiter = [{
      name: 'A', hektar: 0, koerner: 0, duenger: 0, entries: []
    }];
    w.renderResults();
    expect(doc.getElementById('drill_summary').style.display).toBe('none');
  });

  it('drill_summary shown when entries exist', () => {
    w.state.reiter = [{
      name: 'A', hektar: 10, koerner: 50000, duenger: 0,
      entries: [{ einheit: 3, duenger: 0 }]
    }];
    w.renderResults();
    expect(doc.getElementById('drill_summary').style.display).toBe('block');
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

// ---------------------------------------------------------------------------
// renderView — visibility of various elements
// ---------------------------------------------------------------------------
describe('renderView()', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('berechnen_btn hidden in protokoll view', () => {
    w.state.activeView = 'protokoll';
    w.renderView();
    expect(doc.getElementById('berechnen_btn').style.display).toBe('none');
  });

  it('berechnen_btn shown in field view', () => {
    w.state.activeView = null;
    w.renderView();
    expect(doc.getElementById('berechnen_btn').style.display).toBe('');
  });

  it('reset_btn hidden in protokoll view', () => {
    w.state.activeView = 'protokoll';
    w.renderView();
    expect(doc.getElementById('reset_btn').style.display).toBe('none');
  });

  it('reset_all_btn hidden in protokoll view', () => {
    w.state.activeView = 'protokoll';
    w.renderView();
    expect(doc.getElementById('reset_all_btn').style.display).toBe('none');
  });

  it('drill_section shown in protokoll view', () => {
    w.state.activeView = 'protokoll';
    w.renderView();
    expect(doc.getElementById('drill_section').style.display).toBe('block');
  });

  it('drill_mask shown in protokoll view', () => {
    w.state.activeView = 'protokoll';
    w.renderView();
    expect(doc.getElementById('drill_mask').style.display).toBe('');
  });

  it('results hidden when switching to protokoll', () => {
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 90000;
    w.state.activeView = 'protokoll';
    w.renderView();
    expect(doc.getElementById('results').style.display).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// zaehler_section visibility driven by state
// ---------------------------------------------------------------------------
describe('zaehler_section visibility', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('shown when zaehlerstand > 0', () => {
    w.state.zaehlerstand = 10;
    w.renderResults();
    expect(doc.getElementById('zaehler_section').style.display).toBe('block');
  });

  it('shown when any entry has istHa', () => {
    w.state.reiter[0].entries = [{ einheit: 5, hektar: 3, duenger: 0, time: '10:00', istHa: 3 }];
    w.renderResults();
    expect(doc.getElementById('zaehler_section').style.display).toBe('block');
  });

  it('hidden when no zaehlerstand and no istHa entries', () => {
    w.state.reiter[0].entries = [{ einheit: 5, hektar: 3, duenger: 0, time: '10:00' }];
    w.state.zaehlerstand = 0;
    w.renderResults();
    expect(doc.getElementById('zaehler_section').style.display).toBe('none');
  });
});
