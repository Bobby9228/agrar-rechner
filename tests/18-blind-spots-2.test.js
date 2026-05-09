/**
 * Blind spots round 2 — untested code paths verified against current codebase.
 * Functions tested: drillCalcAll, renderDrillTabList, drillMachineRemove,
 * switchToProtokoll, confirmResetAll, renderView, renderTabs,
 * getStoredTheme, setStoredTheme, applyTheme, toggleTheme, initTheme
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

// ---------------------------------------------------------------------------
// drillCalcAll — distribution algorithm
// ---------------------------------------------------------------------------
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
    w.state.drillPriorities = { 0: 1, 1: 2 };
    doc.getElementById('drill_einheit').value = '15';
    doc.getElementById('drill_duenger').value = '';
    w.drillCalcAll();
    expect(doc.getElementById('dtl_e_0').value).toBe('5,0');
    expect(doc.getElementById('dtl_e_1').value).toBe('10,0');
  });

  it('caps distribution at what tab needs', () => {
    // Both tabs: 10 ha × 50000 / 50000 = 10 units each
    // Tab A: 3 used → needE = 7; Tab B: 0 used → needE = 10
    w.state.reiter[0].entries = [{ einheit: 3, hektar: 3 }];
    w.state.reiter[1].entries = [];
    w.state.drillPriorities = { 0: 1, 1: 2 };
    doc.getElementById('drill_einheit').value = '20';
    doc.getElementById('drill_duenger').value = '';
    w.drillCalcAll();
    expect(doc.getElementById('dtl_e_0').value).toBe('7,0');
    expect(doc.getElementById('dtl_e_1').value).toBe('10,0');
  });

  it('distributes duenger separately from einheit', () => {
    w.state.reiter = [
      { name: 'A', hektar: 10, koerner: 50000, duenger: 100, entries: [] },
      { name: 'B', hektar: 5, koerner: 50000, duenger: 200, entries: [] },
    ];
    w.renderDrillTabList();
    w.state.drillPriorities = { 0: 1, 1: 2 };
    doc.getElementById('drill_einheit').value = '5';
    doc.getElementById('drill_duenger').value = '3000';
    w.drillCalcAll();
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

  it('has numeric inputMode on einheit and duenger inputs', () => {
    w.state.reiter = [{ name: 'A', hektar: 10, koerner: 50000, duenger: 0, entries: [] }];
    w.renderDrillTabList();
    expect(doc.getElementById('dtl_e_0').inputMode).toBe('numeric');
    expect(doc.getElementById('dtl_d_0').inputMode).toBe('numeric');
  });

  it('all main decimal inputs have numeric inputMode (not decimal)', () => {
    // decimal inputs should use numeric to avoid automatic comma insertion on some devices
    const mainInputs = ['hektar', 'ist_hektar', 'duenger', 'fahrgassen_breite', 'drill_einheit', 'drill_duenger', 'drill_hektar'];
    for (const id of mainInputs) {
      const el = doc.getElementById(id);
      expect(el.inputMode).toBe('numeric');
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
    expect(doc.querySelectorAll('.drill-tab-row').length).toBe(1);
  });

  it('toggles back to null when called again', () => {
    w.switchToProtokoll();
    expect(w.state.activeView).toBe('protokoll');
    w.switchToProtokoll();
    expect(w.state.activeView).toBeNull();
  });

  it('persists state', () => {
    w.switchToProtokoll();
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
// confirmResetAll(fullReset)
// ---------------------------------------------------------------------------
describe('confirmResetAll(fullReset)', () => {
  let w;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
  });

  it('confirms with fullReset=true (prompts ALL Daten)', () => {
    let lastMsg = '';
    w.confirm = (msg) => { lastMsg = msg; return false; };
    w.confirmResetAll(true);
    expect(lastMsg).toContain('ALLE Daten');
  });

  it('confirms with fullReset=false (prompts single tab)', () => {
    let lastMsg = '';
    w.confirm = (msg) => { lastMsg = msg; return false; };
    w.confirmResetAll(false);
    expect(lastMsg).not.toContain('ALLE Daten');
  });

  it('resets all tabs when fullReset=true and confirmed', () => {
    w.confirm = () => true;
    w.addReiter();
    w.state.reiter[0].hektar = 10;
    w.state.reiter[1].hektar = 20;
    w.confirmResetAll(true);
    expect(w.state.reiter.length).toBe(1);
    expect(w.state.reiter[0].hektar).toBe(0);
  });

  it('resets only active tab when fullReset=false and confirmed', () => {
    w.confirm = () => true;
    w.addReiter();
    w.state.reiter[0].hektar = 10;
    w.state.reiter[1].hektar = 20;
    w.state.activeReiter = 1;
    w.confirmResetAll(false);
    expect(w.state.reiter.length).toBe(2);
    expect(w.state.reiter[0].hektar).toBe(10);
    expect(w.state.reiter[1].hektar).toBe(0);
  });

  it('does nothing when cancelled', () => {
    w.confirm = () => false;
    w.state.reiter[0].hektar = 99;
    w.confirmResetAll(true);
    expect(w.state.reiter[0].hektar).toBe(99);
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

  it('results hidden when switching to protokoll', () => {
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 90000;
    w.state.activeView = 'protokoll';
    w.renderView();
    expect(doc.getElementById('results').style.display).toBe('none');
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
