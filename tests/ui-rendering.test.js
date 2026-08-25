import { createDom } from './helpers.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * UI-Rendering (Input-Format, Dashboard, Theme/Dark-Mode, View)
 * Zusammengeführt in Issue #419 (Welle 4) aus:
 * 02-onInputFormat.test.js, 11-dashboard.test.js, 13-theme-darkmode.test.js, 15-render-view.test.js, 23-dark-mode.test.js, 29-open-close-dashboard.test.js
 * Jede Quelldatei ist als eigener describe-Block vollständig
 * erhalten (nur Import-Zeilen dedupliziert) — keine Assertions
 * wurden verändert oder entfernt.
 */

describe('UI-Rendering (Input-Format, Dashboard, Theme/Dark-Mode, View) — übernommen aus 02-onInputFormat.test.js', () => {
/**
 * Tests for onInputFormat() — strips invalid chars while typing.
 */

describe('onInputFormat', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  function makeInput(value) {
    const el = doc.createElement('input');
    el.value = value;
    el.dataset.prev = '';
    el.dataset.cleaned = '';
    doc.body.appendChild(el);
    return el;
  }

  describe('integer mode', () => {
    it('keeps digits only', () => {
      const el = makeInput('12345');
      w.onInputFormat(el, 'integer');
      expect(el.value).toBe('12345');
    });

    it('removes letters', () => {
      const el = makeInput('12abc34');
      w.onInputFormat(el, 'integer');
      expect(el.value).toBe('1234');
    });

    it('removes comma', () => {
      const el = makeInput('12,5');
      w.onInputFormat(el, 'integer');
      expect(el.value).toBe('125');
    });

    it('removes dots', () => {
      const el = makeInput('1.000');
      w.onInputFormat(el, 'integer');
      expect(el.value).toBe('1000');
    });

    it('removes special chars', () => {
      const el = makeInput('12!@#$%34');
      w.onInputFormat(el, 'integer');
      expect(el.value).toBe('1234');
    });

    it('leaves empty string as-is', () => {
      const el = makeInput('');
      w.onInputFormat(el, 'integer');
      expect(el.value).toBe('');
    });

    it('handles only-non-digits input', () => {
      const el = makeInput('abc');
      w.onInputFormat(el, 'integer');
      expect(el.value).toBe('');
    });
  });

  describe('decimal mode', () => {
    it('keeps digits and comma', () => {
      const el = makeInput('12,5');
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('12,5');
    });

    it('allows only one comma (keeps first comma + first decimal part)', () => {
      const el = makeInput('12,5,3');
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('12,5');
    });

    it('removes letters', () => {
      const el = makeInput('12abc,5');
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('12,5');
    });

    it('removes dots (no thousand separator)', () => {
      const el = makeInput('1.234,5');
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('1234,5');
    });

    it('handles just comma', () => {
      const el = makeInput(',');
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe(',');
    });

    it('handles empty string', () => {
      const el = makeInput('');
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('');
    });

    it('handles comma at start', () => {
      const el = makeInput(',5');
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe(',5');
    });

    it('handles comma at end', () => {
      const el = makeInput('12,');
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('12,');
    });

    it('removes special characters', () => {
      const el = makeInput('12!@#34,5');
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('1234,5');
    });

    // iOS with English keyboard: inputmode="decimal" sends '.' instead of ','
    it('iOS decimal dot: converts dot to comma (12.5 → 12,5)', () => {
      const el = makeInput('12.5');
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('12,5');
    });

    it('iOS decimal dot: handles 1.234,5 gracefully (dot before comma)', () => {
      const el = makeInput('1.234,5');
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('1234,5');
    });

    it('iOS decimal dot: handles 0.5 → 0,5', () => {
      const el = makeInput('0.5');
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('0,5');
    });

    it('iOS decimal dot: second dot stripped after comma conversion', () => {
      const el = makeInput('12..5');
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('12,5');
    });
  });

  describe('cursor position preservation', () => {
    it('decimal: cursor at end stays at end after cleaning dots', () => {
      const el = makeInput('1.234,5');
      el.setSelectionRange(7, 7);
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('1234,5');
      expect(el.selectionStart).toBe(6);
    });

    it('decimal: cursor in middle stays proportional after removing dots', () => {
      const el = makeInput('1.234,5');
      el.setSelectionRange(1, 1);
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('1234,5');
      expect(el.selectionStart).toBe(1);
    });

    it('decimal: cursor at start stays at start after removing dots', () => {
      const el = makeInput('1.234,5');
      el.setSelectionRange(0, 0);
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('1234,5');
      expect(el.selectionStart).toBe(0);
    });

    it('integer: cursor at end stays at end after cleaning dots', () => {
      const el = makeInput('1.000');
      el.setSelectionRange(5, 5);
      w.onInputFormat(el, 'integer');
      expect(el.value).toBe('1000');
      expect(el.selectionStart).toBe(4);
    });

    it('integer: cursor in middle stays proportional after cleaning dots', () => {
      const el = makeInput('1.000');
      el.setSelectionRange(2, 2);
      w.onInputFormat(el, 'integer');
      expect(el.value).toBe('1000');
      expect(el.selectionStart).toBe(2);
    });

    it('decimal: no change = cursor unchanged (not called setSelectionRange)', () => {
      const el = makeInput('12,5');
      el.setSelectionRange(3, 3);
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('12,5');
      expect(el.selectionStart).toBe(3);
    });
  });

  describe('auto-comma detection (browser inserts comma between digits)', () => {
    // This is the critical bug scenario: typing "25" in a decimal field
    // should result in "25", not have a comma auto-inserted between the digits.

    it('type 25: user types 2 then 5, browser sends 2 then 25 → "2" then "25"', () => {
      const el = makeInput('');
      // First keystroke: browser sends '2' (user typed '2')
      el.value = '2';
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('2');
      expect(el.dataset.prev).toBe('2');
      
      // Second keystroke: browser sends '25' (user typed '5')
      el.value = '25';
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('25'); // ← THIS IS THE KEY TEST
    });

    it('type 25: browser auto-inserts comma on first keystroke → "2," → result "2"', () => {
      const el = makeInput('');
      // First keystroke: browser sends '2,' (auto-inserted comma)
      el.value = '2,';
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('2'); // comma removed as auto-insert
      expect(el.dataset.prev).toBe('2');
      
      // Second keystroke: browser sends '2,5'
      el.value = '2,5';
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('25'); // comma removed as auto-insert
    });

    it('manual comma: user types 2 then , manually → comma STAYS', () => {
      const el = makeInput('');
      // User types '2'
      el.value = '2';
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('2');
      
      // User types ',' manually → val='2,' prev='2'
      // auto-comma check: withoutComma='2' len=1, prev.len+1=2 → NO match
      // → comma is kept (not auto-insert)
      el.value = '2,';
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('2,'); // COMMA STAYS - user typed it manually!
      expect(el.dataset.prev).toBe('2,');
    });

    it('iOS dot: 1 → 12 → 12. → 12, → 12,5', () => {
      const el = makeInput('');
      el.value = '1';
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('1');
      
      el.value = '12';
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('12');
      
      el.value = '12.'; // iOS decimal key sends '.'
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('12,'); // dot→comma
      
      el.value = '12.5'; // iOS sends '.' then '5'
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('12,5');
    });

    it('does not break normal decimal input: 12,5 stays 12,5', () => {
      const el = makeInput('');
      el.value = '12,5';
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('12,5');
    });
  });
});
});

describe('UI-Rendering (Input-Format, Dashboard, Theme/Dark-Mode, View) — übernommen aus 11-dashboard.test.js', () => {
/**
 * Tests for Dashboard feature: openDashboard, closeDashboard, renderDashboard
 */

describe('Dashboard', () => {
  let w, doc, store;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
    store = result.store;
  });

  describe('openDashboard() / closeDashboard()', () => {
    it('opens the dashboard sheet and overlay', () => {
      w.openDashboard();
      expect(doc.getElementById('dashboard_sheet').classList.contains('open')).toBe(true);
      expect(doc.getElementById('dashboard_overlay').classList.contains('open')).toBe(true);
    });

    it('sets body overflow to hidden when open', () => {
      w.openDashboard();
      expect(doc.body.style.overflow).toBe('hidden');
    });

    it('closes the dashboard sheet and overlay', () => {
      w.openDashboard();
      w.closeDashboard();
      expect(doc.getElementById('dashboard_sheet').classList.contains('open')).toBe(false);
      expect(doc.getElementById('dashboard_overlay').classList.contains('open')).toBe(false);
    });

    it('restores body overflow on close', () => {
      w.openDashboard();
      w.closeDashboard();
      expect(doc.body.style.overflow).toBe('');
    });

    it('renderDashboard is called when opening', () => {
      // Setup state with one tab that has data
      w.state.reiter[0].hektar = 10;
      w.state.reiter[0].koerner = 90000;
      w.state.reiter[0].duenger = 150;
      w.openDashboard();
      // Should have a card in the content
      const cards = doc.getElementById('dashboard_content').querySelectorAll('.dashboard-reiter-card');
      expect(cards.length).toBe(1);
    });

    it('shows empty state when no reiter', () => {
      w.state.reiter = [];
      w.openDashboard();
      const empty = doc.getElementById('dashboard_content').querySelector('.dashboard-empty');
      expect(empty).toBeTruthy();
    });
  });

  describe('renderDashboard() — single tab', () => {
    it('shows tab name', () => {
      w.state.reiter[0].name = 'Feld A';
      w.state.reiter[0].hektar = 10;
      w.state.reiter[0].koerner = 90000;
      w.openDashboard();
      const nameEl = doc.querySelector('.dashboard-reiter-name');
      expect(nameEl.textContent).toContain('Feld A');
    });

    it('marks active tab with "(aktiv)"', () => {
      w.addReiter();
      // addReiter already sets activeReiter=1, so tab 1 is active
      w.openDashboard();
      const names = doc.querySelectorAll('.dashboard-reiter-name');
      expect(names[1].textContent).toContain('(aktiv)');
    });

    it('shows hektar value', () => {
      w.state.reiter[0].hektar = 12.5;
      w.state.reiter[0].koerner = 90000;
      w.openDashboard();
      const values = doc.querySelectorAll('.dashboard-stat-value');
      expect(values[0].textContent).toContain('12,5');
    });

    it('shows koerner value with DE formatting', () => {
      w.state.reiter[0].hektar = 10;
      w.state.reiter[0].koerner = 90000;
      w.openDashboard();
      const values = doc.querySelectorAll('.dashboard-stat-value');
      expect(values[1].textContent).toBe('90.000');
    });

    it('shows — when hektar is 0', () => {
      w.state.reiter[0].hektar = 0;
      w.state.reiter[0].koerner = 90000;
      w.openDashboard();
      const values = doc.querySelectorAll('.dashboard-stat-value');
      expect(values[0].textContent).toBe('—');
    });

    it('shows — when koerner is 0', () => {
      w.state.reiter[0].hektar = 10;
      w.state.reiter[0].koerner = 0;
      w.openDashboard();
      const values = doc.querySelectorAll('.dashboard-stat-value');
      expect(values[1].textContent).toBe('—');
    });

    it('shows remaining einheiten with remaining class when partially filled', () => {
      w.state.reiter[0].hektar = 10;
      w.state.reiter[0].koerner = 50000; // 10 units
      w.state.reiter[0].entries = [{ einheit: 5, hektar: 0, duenger: 0, time: '08:00' }];
      w.openDashboard();
      // The einheiten remaining stat is at index 2
      const values = doc.querySelectorAll('.dashboard-stat-value');
      // Issue #266: Dashboard nutzt fmtCompact (ganze Zahlen ohne ",0").
      expect(values[2].textContent).toContain('5');
      expect(values[2].classList.contains('remaining')).toBe(true);
    });

    it('shows remaining duenger with remaining class when partially filled', () => {
      // Setup: both einheiten and duenger are partially filled
      // so that the min (not max) of their fill ratios drives the display
      w.state.reiter[0].hektar = 10;
      w.state.reiter[0].koerner = 90000;  // 10 * 90000 / 50000 = 18 units total
      w.state.reiter[0].duenger = 150;
      // Fill 5 of 18 einheiten (= 27.8%) AND 75 of 1500 kg duenger (= 5%)
      // minFilled = 0.05 → pct = 5 → 'remaining' class
      w.state.reiter[0].entries = [
        { einheit: 5, hektar: 0, duenger: 75, time: '08:00' }
      ];
      w.openDashboard();
      const values = doc.querySelectorAll('.dashboard-stat-value');
      // Find duenger remaining (should be 1425 kg)
      const duengerRem = Array.from(values).find(v => v.textContent.includes('kg'));
      expect(duengerRem.classList.contains('remaining')).toBe(true);
    });

    it('shows done class when fully filled', () => {
      w.state.reiter[0].hektar = 10;
      w.state.reiter[0].koerner = 50000;
      w.state.reiter[0].entries = [{ einheit: 10, hektar: 0, duenger: 0, time: '08:00' }];
      w.openDashboard();
      const values = doc.querySelectorAll('.dashboard-stat-value');
      // First remaining stat
      expect(values[2].classList.contains('done')).toBe(true);
    });

    it('progress bar shows 0% when no calculation', () => {
      w.state.reiter[0].hektar = 0;
      w.state.reiter[0].koerner = 0;
      w.openDashboard();
      const fill = doc.querySelector('.dashboard-progress-fill');
      expect(fill.style.width).toBe('0%');
    });

    it('progress bar shows correct percentage', () => {
      w.state.reiter[0].hektar = 10;
      w.state.reiter[0].koerner = 50000;
      w.state.reiter[0].entries = [{ einheit: 5, hektar: 0, duenger: 0, time: '08:00' }]; // 50%
      w.openDashboard();
      const fill = doc.querySelector('.dashboard-progress-fill');
      expect(fill.style.width).toBe('50%');
    });
  });

  describe('renderDashboard() — multiple tabs', () => {
    it('renders one card per tab', () => {
      w.addReiter();
      w.addReiter();
      w.openDashboard();
      const cards = doc.querySelectorAll('.dashboard-reiter-card');
      expect(cards.length).toBe(3);
    });

    it('each card shows its respective values', () => {
      // Tab 0: 10 ha, 90000 k → 18 units
      w.state.reiter[0].hektar = 10;
      w.state.reiter[0].koerner = 90000;
      // Tab 1: 20 ha, 80000 k → 32 units (pushed directly, no addReiter to avoid syncStateFromInputs overwriting tab 0)
      // Push directly to avoid addReiter's syncStateFromInputs overwriting tab 0
      w.state.reiter.push({
        name: 'Tab 2', hektar: 20, koerner: 80000, duenger: 0, entries: []
      });
      w.state.activeReiter = 0;
      w.openDashboard();
      const cards = doc.querySelectorAll('.dashboard-reiter-card');
      // First card: 10 ha
      const firstHa = cards[0].querySelectorAll('.dashboard-stat-value')[0];
      expect(firstHa.textContent).toContain('10');
      // Second card: 20 ha
      const secondHa = cards[1].querySelectorAll('.dashboard-stat-value')[0];
      expect(secondHa.textContent).toContain('20');
    });
  });
});
});

describe('UI-Rendering (Input-Format, Dashboard, Theme/Dark-Mode, View) — übernommen aus 13-theme-darkmode.test.js', () => {
/**
 * Tests for theme/dark mode: toggleTheme, applyTheme, initTheme, getStoredTheme, setStoredTheme
 */

describe('toggleTheme', () => {
  let w;
  beforeEach(() => {
    w = createDom().window;
    // initTheme() runs during script load. In jsdom matchMedia is undefined,
    // so applyTheme(undefined) toggles dark ON (classList.toggle without force).
    // We reset to a known light state before each test.
    w.applyTheme(false);
    w.setStoredTheme('light');
  });

  it('toggles from light to dark', () => {
    w.toggleTheme();
    expect(w.document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('toggles from dark to light', () => {
    w.toggleTheme(); // to dark
    w.toggleTheme(); // back to light
    expect(w.document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('updates theme toggle button emoji', () => {
    var btn = w.document.getElementById('theme_toggle');
    expect(btn.textContent).toBe('🌙');
    w.toggleTheme();
    expect(btn.textContent).toBe('☀️');
    w.toggleTheme();
    expect(btn.textContent).toBe('🌙');
  });

  it('persists theme to localStorage (SSOT-Key agrar_rechner_theme, #448 Welle 1)', () => {
    w.toggleTheme();
    expect(w.localStorage.getItem('agrar_rechner_theme')).toBe('dark');
    expect(w.localStorage.getItem('theme')).toBeNull();
    w.toggleTheme();
    expect(w.localStorage.getItem('agrar_rechner_theme')).toBe('light');
  });

  it('updates theme-color meta tag to dark', () => {
    w.toggleTheme();
    var meta = w.document.querySelector('meta[name="theme-color"]');
    expect(meta.getAttribute('content')).toBe('#1a1f16');
  });

  it('updates theme-color meta tag to light', () => {
    w.toggleTheme(); // dark
    w.toggleTheme(); // light
    var meta = w.document.querySelector('meta[name="theme-color"]');
    expect(meta.getAttribute('content')).toBe('#2d5016');
  });
});

describe('applyTheme', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('adds dark class when dark=true', () => {
    w.applyTheme(true);
    expect(w.document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes dark class when dark=false', () => {
    w.document.documentElement.classList.add('dark');
    w.applyTheme(false);
    expect(w.document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('sets button emoji correctly for dark', () => {
    w.applyTheme(true);
    expect(w.document.getElementById('theme_toggle').textContent).toBe('☀️');
  });

  it('sets button emoji correctly for light', () => {
    w.applyTheme(false);
    expect(w.document.getElementById('theme_toggle').textContent).toBe('🌙');
  });

  it('sets meta theme-color for dark', () => {
    w.applyTheme(true);
    expect(w.document.querySelector('meta[name="theme-color"]').getAttribute('content')).toBe('#1a1f16');
  });

  it('sets meta theme-color for light', () => {
    w.applyTheme(false);
    expect(w.document.querySelector('meta[name="theme-color"]').getAttribute('content')).toBe('#2d5016');
  });
});

describe('getStoredTheme / setStoredTheme', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('returns null when no theme stored', () => {
    expect(w.getStoredTheme()).toBeNull();
  });

  it('returns stored theme value', () => {
    w.setStoredTheme('dark');
    expect(w.getStoredTheme()).toBe('dark');
  });

  it('stores "light" theme', () => {
    w.setStoredTheme('light');
    expect(w.getStoredTheme()).toBe('light');
  });

  it('handles localStorage errors gracefully (get)', () => {
    // Override localStorage to throw
    Object.defineProperty(w, 'localStorage', {
      value: { getItem: () => { throw new Error('denied'); } },
      writable: true,
    });
    expect(w.getStoredTheme()).toBeNull();
  });

  it('handles localStorage errors gracefully (set)', () => {
    Object.defineProperty(w, 'localStorage', {
      value: { setItem: () => { throw new Error('denied'); } },
      writable: true,
    });
    // Should not throw
    expect(() => w.setStoredTheme('dark')).not.toThrow();
  });
});

describe('initTheme', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('applies dark when stored theme is dark', () => {
    w.setStoredTheme('dark');
    w.initTheme();
    expect(w.document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('applies light when stored theme is light', () => {
    w.setStoredTheme('light');
    w.initTheme();
    expect(w.document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('applies dark when system prefers dark and no stored theme', () => {
    // jsdom doesn't support matchMedia by default, so we mock it
    w.matchMedia = (query) => ({ matches: query === '(prefers-color-scheme: dark)' });
    w.localStorage.removeItem('agrar_rechner_theme');
    w.localStorage.removeItem('theme');
    w.initTheme();
    expect(w.document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('applies light when system prefers light and no stored theme', () => {
    w.matchMedia = () => ({ matches: false });
    w.localStorage.removeItem('agrar_rechner_theme');
    w.localStorage.removeItem('theme');
    w.initTheme();
    expect(w.document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('prefers stored theme over system preference', () => {
    w.setStoredTheme('light');
    w.matchMedia = () => ({ matches: true }); // system says dark
    w.initTheme();
    expect(w.document.documentElement.classList.contains('dark')).toBe(false);
  });
});
});

describe('UI-Rendering (Input-Format, Dashboard, Theme/Dark-Mode, View) — übernommen aus 15-render-view.test.js', () => {
/**
 * Tests for renderView() — show/hide logic for field vs. protokoll views.
 * Also tests switchToProtokoll() and related view switching.
 *
 * View-Toggle-Pattern (Pre-#291, Issue #291-Revert):
 *   - state.activeView === 'protokoll' → drill_section sichtbar, alle
 *     anderen Cards auf display:none (results auch, selbst mit Daten)
 *   - state.activeView === null → Feld-Ansicht, Cards sichtbar je nach
 *     vorhandenen Daten
 *   - protokoll_tab_btn bekommt die `active`-Klasse wenn activeView='protokoll'
 */

describe('renderView', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('hides input cards when in protokoll view (drill_section stays visible)', () => {
    w.state.activeView = 'protokoll';
    w.renderView();
    var cards = w.document.querySelectorAll('.card');
    cards.forEach(function(c) {
      if (c.id === 'drill_section') {
        // drill_section is visible in protokoll mode — it contains the drill protocol
        expect(c.style.display).toBe('block');
      } else {
        expect(c.style.display).toBe('none');
      }
    });
  });

  it('shows cards when in field view', () => {
    w.state.activeView = null;
    w.renderView();
    var cards = w.document.querySelectorAll('.card');
    var anyVisible = false;
    cards.forEach(function(c) {
      if (c.style.display !== 'none') anyVisible = true;
    });
    expect(anyVisible).toBe(true);
  });

  it('shows results when tab has data and not in protokoll', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000 };
    w.state.activeView = null;
    w.renderView();
    expect(w.document.getElementById('results').style.display).toBe('block');
  });

  it('hides results when in protokoll view even with data', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000 };
    w.state.activeView = 'protokoll';
    w.renderView();
    expect(w.document.getElementById('results').style.display).toBe('none');
  });

  it('hides results when no data', () => {
    w.state.activeView = null;
    w.renderView();
    expect(w.document.getElementById('results').style.display).toBe('none');
  });

  it('shows drill_section when in protokoll view', () => {
    w.state.activeView = 'protokoll';
    w.renderView();
    expect(w.document.getElementById('drill_section').style.display).toBe('block');
  });

  it('hides drill_section when not in protokoll view', () => {
    w.state.activeView = null;
    w.renderView();
    expect(w.document.getElementById('drill_section').style.display).toBe('none');
  });

  it('shows drill_mask when in protokoll view', () => {
    w.state.activeView = 'protokoll';
    w.renderView();
    expect(w.document.getElementById('drill_mask').style.display).toBe('');
  });

  it('hides drill_mask when not in protokoll view', () => {
    w.state.activeView = null;
    w.renderView();
    expect(w.document.getElementById('drill_mask').style.display).toBe('none');
  });
});

describe('switchToProtokoll', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('switches to protokoll view', () => {
    w.switchToProtokoll();
    expect(w.state.activeView).toBe('protokoll');
  });

  it('switches back from protokoll to field', () => {
    w.switchToProtokoll(); // enter protokoll
    w.switchToProtokoll(); // leave protokoll
    expect(w.state.activeView).toBeNull();
  });

  it('syncs state from inputs before switching', () => {
    w.document.getElementById('hektar').value = '15';
    w.document.getElementById('koerner').value = '80000';
    w.switchToProtokoll();
    expect(w.state.reiter[0].hektar).toBe(15);
    expect(w.state.reiter[0].koerner).toBe(80000);
  });

  it('renders drill tab list when entering protokoll', () => {
    w.switchToProtokoll();
    // renderDrillTabList should have been called — check that drill_tab_list has content
    var container = w.document.getElementById('drill_tab_list');
    expect(container).toBeTruthy();
    // Should have rendered priority buttons
    expect(w.document.getElementById('dtl_prio_0')).toBeTruthy();
  });

  it('saves state via saveState()', () => {
    w.switchToProtokoll();
    var stored = JSON.parse(w.localStorage.getItem('agrar_rechner'));
    expect(stored.activeView).toBe('protokoll');
  });

  it('marks protokoll tab as active', () => {
    w.switchToProtokoll();
    var protokollBtn = w.document.getElementById('protokoll_tab_btn');
    expect(protokollBtn.classList.contains('active')).toBe(true);
  });

  it('unmarks protokoll tab when switching back', () => {
    w.switchToProtokoll();
    w.switchToProtokoll();
    var protokollBtn = w.document.getElementById('protokoll_tab_btn');
    expect(protokollBtn.classList.contains('active')).toBe(false);
  });
});
});

describe('UI-Rendering (Input-Format, Dashboard, Theme/Dark-Mode, View) — übernommen aus 23-dark-mode.test.js', () => {
/**
 * Test 23: Dark mode — getStoredTheme, setStoredTheme, applyTheme, toggleTheme, initTheme
 * Hinweis (#448 Welle 1): SSOT-Theme-Key ist jetzt 'agrar_rechner_theme'
 * (Phase-3-Migration lief auf 'theme' → nachfolgend konsolidiert auf
 *  'agrar_rechner_theme' als Pendant zum Daten-Key).
 */

describe('getStoredTheme', () => {
  it('returns null when no theme stored', () => {
    const { window: w } = createDom();
    expect(w.getStoredTheme()).toBeNull();
  });

  it('returns stored theme value', () => {
    const { window: w, store } = createDom();
    store['agrar_rechner_theme'] = 'dark';
    expect(w.getStoredTheme()).toBe('dark');
  });

  it('returns light theme when stored', () => {
    const { window: w, store } = createDom();
    store['agrar_rechner_theme'] = 'light';
    expect(w.getStoredTheme()).toBe('light');
  });
});

describe('setStoredTheme', () => {
  it('stores dark theme in localStorage', () => {
    const { window: w, store } = createDom();
    w.setStoredTheme('dark');
    expect(store['agrar_rechner_theme']).toBe('dark');
  });

  it('stores light theme in localStorage', () => {
    const { window: w, store } = createDom();
    w.setStoredTheme('light');
    expect(store['agrar_rechner_theme']).toBe('light');
  });

  it('overwrites previous theme', () => {
    const { window: w, store } = createDom();
    w.setStoredTheme('dark');
    w.setStoredTheme('light');
    expect(store['agrar_rechner_theme']).toBe('light');
  });
});

describe('applyTheme', () => {
  it('adds dark class to html element when dark=true', () => {
    const { window: w } = createDom();
    w.applyTheme(true);
    expect(w.document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes dark class when dark=false', () => {
    const { window: w } = createDom();
    w.applyTheme(true);
    w.applyTheme(false);
    expect(w.document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('sets button text to sun emoji in dark mode', () => {
    const { window: w } = createDom();
    w.applyTheme(true);
    expect(w.document.getElementById('theme_toggle').textContent).toBe('☀️');
  });

  it('sets button text to moon emoji in light mode', () => {
    const { window: w } = createDom();
    w.applyTheme(false);
    expect(w.document.getElementById('theme_toggle').textContent).toBe('🌙');
  });

  it('sets meta theme-color to dark value in dark mode', () => {
    const { window: w } = createDom();
    w.applyTheme(true);
    const meta = w.document.querySelector('meta[name="theme-color"]');
    expect(meta.getAttribute('content')).toBe('#1a1f16');
  });

  it('sets meta theme-color to light value in light mode', () => {
    const { window: w } = createDom();
    w.applyTheme(false);
    const meta = w.document.querySelector('meta[name="theme-color"]');
    expect(meta.getAttribute('content')).toBe('#2d5016');
  });
});

describe('toggleTheme', () => {
  it('switches from light to dark', () => {
    const { window: w, store } = createDom();
    // Start in light mode
    w.applyTheme(false);
    w.toggleTheme();

    expect(w.document.documentElement.classList.contains('dark')).toBe(true);
    expect(store['agrar_rechner_theme']).toBe('dark');
  });

  it('switches from dark to light', () => {
    const { window: w, store } = createDom();
    w.applyTheme(true);
    w.toggleTheme();

    expect(w.document.documentElement.classList.contains('dark')).toBe(false);
    expect(store['agrar_rechner_theme']).toBe('light');
  });
});

describe('initTheme', () => {
  it('applies dark when stored theme is dark', () => {
    const { window: w, store } = createDom();
    store['agrar_rechner_theme'] = 'dark';
    w.initTheme();
    expect(w.document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('applies light when stored theme is light', () => {
    const { window: w, store } = createDom();
    store['agrar_rechner_theme'] = 'light';
    w.initTheme();
    expect(w.document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('follows system preference when no stored theme', () => {
    const { window: w } = createDom();
    // jsdom matchMedia defaults to no matches → light
    w.initTheme();
    expect(w.document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('applies dark when system prefers dark and no stored theme', () => {
    const { window: w } = createDom();
    // Mock matchMedia to return dark preference
    w.matchMedia = vi.fn().mockReturnValue({ matches: true });
    w.initTheme();
    expect(w.document.documentElement.classList.contains('dark')).toBe(true);
  });
});
});

describe('UI-Rendering (Input-Format, Dashboard, Theme/Dark-Mode, View) — übernommen aus 29-open-close-dashboard.test.js', () => {
/**
 * Tests for openDashboard() and closeDashboard().
 *
 * KRITISCH: These functions manage the dashboard overlay + sheet.
 * No tests existed for this feature.
 *
 * Note: openDashboard uses classList.add/remove('open') not inline display styles.
 */

describe('Dashboard open/close', () => {
  let w, doc, store;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
    store = result.store;
  });

  // Drei Tests wurden in Issue #444 Welle 2 entfernt, weil sie mit dem
  // Block "übernommen aus 11-dashboard" (Tests 'opens the dashboard sheet
  // and overlay', 'closes the dashboard sheet and overlay', 'restores body
  // overflow on close') 1:1 deckungsgleich waren — gleicher Testname-
  // Effekt, identische Assertion-Kette. Siehe finalen Bericht in
  // Issue #444 Welle 2.

  it('re-opening dashboard re-renders content', () => {
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].entries = [{ einheit: 8, duenger: 0, zaehlerStand: 5, time: '09:00' }];

    w.openDashboard();
    const content1 = doc.getElementById('dashboard_content').innerHTML;

    w.state.reiter[0].entries = [{ einheit: 16, duenger: 0, zaehlerStand: 10, time: '10:00' }];

    w.closeDashboard();
    w.openDashboard();
    const content2 = doc.getElementById('dashboard_content').innerHTML;

    expect(content1).not.toBe(content2);
  });

  it('dashboard sheet exists in DOM', () => {
    expect(doc.getElementById('dashboard_sheet')).toBeTruthy();
    expect(doc.getElementById('dashboard_content')).toBeTruthy();
    expect(doc.getElementById('dashboard_overlay')).toBeTruthy();
  });

  it('default state has 1 tab shown in dashboard', () => {
    // Default state always has Schlag 1, so dashboard shows it
    w.openDashboard();
    const cards = doc.querySelectorAll('.dashboard-reiter-card');
    expect(cards.length).toBe(1);
    expect(doc.getElementById('dashboard_content').textContent).toContain('Schlag 1');
  });

  it('dashboard shows multiple tabs correctly', () => {
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.addReiter();
    w.state.reiter[1].hektar = 5;
    w.state.reiter[1].koerner = 90000;

    w.openDashboard();
    const cards = doc.querySelectorAll('.dashboard-reiter-card');
    expect(cards.length).toBe(2);
  });

  it('active tab is marked in dashboard', () => {
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.state.activeReiter = 0;
    w.addReiter(); // Sets activeReiter = 1 (new tab)
    w.state.reiter[1].hektar = 5;
    w.state.reiter[1].koerner = 90000;
    // Switch back to tab 0
    w.state.activeReiter = 0;

    w.openDashboard();
    const cards = doc.querySelectorAll('.dashboard-reiter-card');
    // Tab 0 (active) should contain '(aktiv)'
    expect(cards[0].textContent).toContain('(aktiv)');
    // Tab 1 should NOT have (aktiv)
    expect(cards[1].textContent).not.toContain('(aktiv)');
  });

  it('calling openDashboard twice does not double-render', () => {
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;

    w.openDashboard();
    w.openDashboard();
    const cards = doc.querySelectorAll('.dashboard-reiter-card');
    expect(cards.length).toBe(1);
  });

  it('summary stats show correct flaeche for multiple tabs', () => {
    w.state.reiter[0].hektar = 7.5;
    w.state.reiter[0].koerner = 80000;
    w.state.activeReiter = 0;
    w.syncInputsFromState();
    w.addReiter();
    w.state.reiter[1].hektar = 12.3;
    w.state.reiter[1].koerner = 90000;

    w.openDashboard();
    const stats = doc.querySelectorAll('.dashboard-summary-stat');
    const flaeche = stats[0]?.querySelector('.dashboard-summary-value')?.textContent || '';
    expect(flaeche).toBe('19,8 ha'); // 7.5 + 12.3 = 19.8
  });

  it('progress bar shows 0% when nothing used', () => {
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].entries = [];

    w.openDashboard();
    const fill = doc.querySelector('.dashboard-progress-fill');
    expect(fill.style.width).toBe('0%');
  });

  it('progress bar shows 100% when fully used', () => {
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    // 10 ha × 80000 / 50000 = 16 units
    w.state.reiter[0].entries = [{ einheit: 16, duenger: 0, zaehlerStand: 10, time: '10:00' }];

    w.openDashboard();
    const fill = doc.querySelector('.dashboard-progress-fill');
    expect(fill.style.width).toBe('100%');
  });
});

/**
 * Issue #446 Welle 2a — Bottom-Navigation semantisch auszeichnen (aria-current)
 *
 * Die Bottom-Nav (Rechner / Protokoll / Übersicht) hat heute nur eine
 * .active-Klasse. Screenreader können nicht erkennen, welcher Bereich gerade
 * sichtbar ist. WAI-ARIA: aktiver Navigationspunkt bekommt aria-current="page".
 * Setzen + Entfernen läuft zentral in renderTabs() (siehe public/js/render-tabs.js),
 * ein einziger Sync-Punkt für alle drei Nav-Buttons.
 */
describe('Issue #446 Welle 2a — Bottom-Nav aria-current (#nav_rechner/#nav_protokoll/#nav_uebersicht)', () => {
  let w, doc;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
    w.initUI();
  });

  it('Rechner-Ansicht: #nav_rechner hat aria-current="page", die anderen nicht', () => {
    // Default nach initUI(): activeView = null, activeReiter = 0 → Rechner sichtbar.
    w.renderTabs();
    expect(doc.getElementById('nav_rechner').getAttribute('aria-current')).toBe('page');
    expect(doc.getElementById('nav_protokoll').getAttribute('aria-current')).toBeNull();
    expect(doc.getElementById('nav_uebersicht').getAttribute('aria-current')).toBeNull();
  });

  it('Protokoll-Ansicht: #nav_protokoll hat aria-current="page", die anderen nicht', () => {
    w.switchToProtokoll();
    w.renderTabs();
    expect(doc.getElementById('nav_rechner').getAttribute('aria-current')).toBeNull();
    expect(doc.getElementById('nav_protokoll').getAttribute('aria-current')).toBe('page');
    expect(doc.getElementById('nav_uebersicht').getAttribute('aria-current')).toBeNull();
  });

  it('Übersicht offen: #nav_uebersicht hat aria-current="page", die anderen nicht', () => {
    w.openDashboard();
    w.renderTabs();
    expect(doc.getElementById('nav_rechner').getAttribute('aria-current')).toBeNull();
    expect(doc.getElementById('nav_protokoll').getAttribute('aria-current')).toBeNull();
    expect(doc.getElementById('nav_uebersicht').getAttribute('aria-current')).toBe('page');
  });

  it('View-Wechsel: aria-current wandert von #nav_rechner zu #nav_protokoll und zurück', () => {
    w.renderTabs();
    expect(doc.getElementById('nav_rechner').getAttribute('aria-current')).toBe('page');
    w.switchToProtokoll();
    w.renderTabs();
    expect(doc.getElementById('nav_protokoll').getAttribute('aria-current')).toBe('page');
    expect(doc.getElementById('nav_rechner').getAttribute('aria-current')).toBeNull();
    w.switchToRechner();
    w.renderTabs();
    expect(doc.getElementById('nav_rechner').getAttribute('aria-current')).toBe('page');
    expect(doc.getElementById('nav_protokoll').getAttribute('aria-current')).toBeNull();
  });

  it('Übersicht schließen: aria-current auf #nav_uebersicht wird entfernt, Rechner übernimmt', () => {
    w.openDashboard();
    w.renderTabs();
    expect(doc.getElementById('nav_uebersicht').getAttribute('aria-current')).toBe('page');
    w.closeDashboard();
    w.renderTabs();
    expect(doc.getElementById('nav_uebersicht').getAttribute('aria-current')).toBeNull();
    expect(doc.getElementById('nav_rechner').getAttribute('aria-current')).toBe('page');
  });

  it('Nur genau EIN Nav-Button hat aria-current="page" (Exklusivitäts-Vertrag)', () => {
    w.renderTabs();
    // Exklusivität in jeder der drei Hauptansichten prüfen
    var sequence = [
      function() { /* Default Rechner */ },
      function() { w.switchToProtokoll(); },
      function() { w.openDashboard(); },
      function() { w.closeDashboard(); },
    ];
    for (var si = 0; si < sequence.length; si++) {
      sequence[si]();
      w.renderTabs();
      var btns = ['nav_rechner', 'nav_protokoll', 'nav_uebersicht']
        .map(function (id) { return doc.getElementById(id); });
      var withCurrent = btns.filter(function (b) {
        return b.getAttribute('aria-current') === 'page';
      });
      expect(withCurrent.length, 'genau EIN Nav-Button soll aria-current="page" haben, gefunden: ' + withCurrent.length).toBe(1);
    }
  });
});
});
