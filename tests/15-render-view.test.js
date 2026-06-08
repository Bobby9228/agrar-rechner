/**
 * Tests for renderView() — show/hide logic for field vs. protokoll views.
 * Also tests switchToProtokoll() and related view switching.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

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

  it('hides berechnen_btn when in protokoll view', () => {
    w.state.activeView = 'protokoll';
    w.renderView();
    expect(w.document.getElementById('berechnen_btn').style.display).toBe('none');
  });

  it('shows berechnen_btn when not in protokoll view', () => {
    w.state.activeView = null;
    w.renderView();
    expect(w.document.getElementById('berechnen_btn').style.display).toBe('');
  });

  it('hides reset_btn when in protokoll view', () => {
    w.state.activeView = 'protokoll';
    w.renderView();
    expect(w.document.getElementById('reset_btn').style.display).toBe('none');
  });

  it('hides sticky_footer when in protokoll view', () => {
    w.state.activeView = 'protokoll';
    w.renderView();
    expect(w.document.getElementById('sticky_footer').style.display).toBe('none');
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

  it('saves state via sv()', () => {
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

describe('mini-result in sticky footer', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('shows "Bitte Hektar und Körner eingeben" when no data', () => {
    w.renderResults();
    var mini = w.document.getElementById('mini_result');
    expect(mini.textContent).toContain('Bitte Hektar und Körner eingeben');
    expect(mini.classList.contains('mini-result-empty')).toBe(true);
  });

  it('shows einheiten when data exists', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, duenger: 0, entries: [] };
    w.renderResults();
    var mini = w.document.getElementById('mini_result');
    expect(mini.textContent).toContain('Einheiten');
    expect(mini.classList.contains('mini-result-empty')).toBe(false);
  });

  it('shows duenger when duenger > 0', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, duenger: 150, entries: [] };
    w.renderResults();
    var mini = w.document.getElementById('mini_result');
    expect(mini.textContent).toContain('kg');
  });

  it('has mr-einheiten span class', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, duenger: 0, entries: [] };
    w.renderResults();
    var mini = w.document.getElementById('mini_result');
    var einheitSpan = mini.querySelector('.mr-einheiten');
    expect(einheitSpan).toBeTruthy();
    expect(einheitSpan.textContent).toContain('Einheiten');
  });
});
