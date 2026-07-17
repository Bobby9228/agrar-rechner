/**
 * Test 22: Protocol view — switchToProtokoll + renderView
 *
 * The Protokoll view is a View-Toggle (Issue #291, Pre-#291 pattern): the
 * 🔧 tab button is NOT a separate tab; it's a view-mode toggle that swaps
 * the main content between "Feld" (input/results cards) and "Protokoll"
 * (drill_section). `state.activeView` tracks the current view:
 *   - 'protokoll' → Protokoll-Ansicht (drill_section sichtbar)
 *   - null        → Feld-Ansicht (input/results cards sichtbar)
 *
 * Tests cover:
 *   - switchToProtokoll() sets/clears state.activeView
 *   - renderView() toggles .card visibility (drill_section on, rest off)
 *   - renderView() hides results even when tab has data, when in protokoll
 *   - state.activeView roundtrips through localStorage
 *   - switchReiter() resets activeView to null (Tab-Wechsel beendet Protokoll)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

function getDrillSection(w) { return w.document.getElementById('drill_section'); }
function getDrillMask(w) { return w.document.getElementById('drill_mask'); }
function getResults(w) { return w.document.getElementById('results'); }
function getProtokollBtn(w) { return w.document.getElementById('protokoll_tab_btn'); }

describe('switchToProtokoll()', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('switches to protokoll view from field view', () => {
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '90000';
    w.syncStateFromInputs();
    w.renderResults();

    expect(w.state.activeView).toBeNull();
    w.switchToProtokoll();

    expect(w.state.activeView).toBe('protokoll');
  });

  it('switches back to field view when already in protokoll', () => {
    w.switchToProtokoll(); // → protokoll
    expect(w.state.activeView).toBe('protokoll');

    w.switchToProtokoll(); // → back to null
    expect(w.state.activeView).toBeNull();
  });

  it('calls renderDrillTabList when entering protokoll', () => {
    w.addReiter();
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 90000;
    w.state.reiter[0].duenger = 150;
    w.saveState();

    w.switchToProtokoll();

    // renderDrillTabList should have created elements
    expect(w.document.getElementById('dtl_prio_0')).toBeTruthy();
    expect(w.document.getElementById('dtl_e_0')).toBeTruthy();
  });

  it('syncs state from inputs before switching', () => {
    w.document.getElementById('hektar').value = '15';
    w.document.getElementById('koerner').value = '80000';

    w.switchToProtokoll();

    // syncStateFromInputs reads hektar/koerner inputs into state
    expect(w.state.reiter[0].hektar).toBe(15);
    expect(w.state.reiter[0].koerner).toBe(80000);
  });

  it('persists view state to localStorage', () => {
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '90000';
    w.syncStateFromInputs();
    w.renderResults(); // Ensure state is initialized and sv() works

    w.switchToProtokoll();

    const saved = JSON.parse(w.localStorage.getItem('agrar_rechner'));
    expect(saved.activeView).toBe('protokoll');
  });

  it('marks protokoll tab button as active when entering protokoll', () => {
    w.switchToProtokoll();
    expect(getProtokollBtn(w).classList.contains('active')).toBe(true);
  });

  it('unmarks protokoll tab button when leaving protokoll', () => {
    w.switchToProtokoll();
    w.switchToProtokoll();
    expect(getProtokollBtn(w).classList.contains('active')).toBe(false);
  });
});

describe('renderView()', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('hides all cards except drill_section when in protokoll view', () => {
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '90000';
    w.syncStateFromInputs();
    w.renderResults();
    w.switchToProtokoll();

    const cards = w.document.querySelectorAll('.card');
    cards.forEach(c => {
      if (c.id === 'drill_section') {
        expect(c.style.display).toBe('block');
      } else {
        expect(c.style.display).toBe('none');
      }
    });
  });

  it('hides results in protokoll mode even with data', () => {
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '90000';
    w.syncStateFromInputs();
    w.renderResults();

    w.state.activeView = 'protokoll';
    w.renderView();

    expect(getResults(w).style.display).toBe('none');
  });

  it('shows drill section in protokoll mode', () => {
    w.state.activeView = 'protokoll';
    w.renderView();
    expect(getDrillSection(w).style.display).toBe('block');
  });

  it('shows drill mask in protokoll mode (clears display:none)', () => {
    w.state.activeView = 'protokoll';
    w.renderView();
    // drill_mask starts with style="display:none" in the HTML — renderView
    // resets it to '' (default) when in protokoll mode
    expect(getDrillMask(w).style.display).toBe('');
  });

  it('hides drill section in field mode', () => {
    w.renderView();
    expect(getDrillSection(w).style.display).toBe('none');
  });

  it('shows results in field mode when tab has data', () => {
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '90000';
    w.syncStateFromInputs();
    w.renderResults();

    expect(getResults(w).style.display).toBe('block');
  });

  it('hides results when no data in field mode', () => {
    w.renderView();
    expect(getResults(w).style.display).toBe('none');
  });
});

describe('switchReiter resets activeView from protokoll', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('switchReiter(0) when in protokoll view returns to field view (same tab)', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000 };
    w.switchToProtokoll();
    expect(w.state.activeView).toBe('protokoll');
    expect(w.state.activeReiter).toBe(0);

    // Tab-Klick aus dem Protokoll-Tab zurück in den Feld-Tab:
    // activeView muss null werden, sonst bleibt das Protokoll sichtbar.
    w.switchReiter(0);
    expect(w.state.activeView).toBeNull();
    expect(w.state.activeReiter).toBe(0);
  });

  it('switchReiter(1) when in protokoll view switches tab AND exits protokoll', () => {
    w.addReiter();
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000 };
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 5, koerner: 80000 };
    w.switchToProtokoll();
    expect(w.state.activeView).toBe('protokoll');

    w.switchReiter(1);
    expect(w.state.activeView).toBeNull();
    expect(w.state.activeReiter).toBe(1);
  });

  it('switchReiter from protokoll triggers renderView so drill_section hides', () => {
    w.addReiter();
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000 };
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 5, koerner: 80000 };
    w.switchToProtokoll();
    expect(getDrillSection(w).style.display).toBe('block');

    w.switchReiter(1);
    // Nach Tab-Wechsel ist drill_section wieder versteckt
    expect(getDrillSection(w).style.display).toBe('none');
  });
});

describe('state.activeView persistence', () => {
  it('roundtrips activeView=protokoll through localStorage', () => {
    const { window: w, store } = createDom();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '90000';
    w.syncStateFromInputs();
    w.renderResults();
    w.switchToProtokoll();
    expect(w.state.activeView).toBe('protokoll');

    // Re-read from localStorage
    const saved = JSON.parse(store['agrar_rechner']);
    expect(saved.activeView).toBe('protokoll');
  });

  it('roundtrips activeView=null through localStorage', () => {
    const { window: w, store } = createDom();
    w.saveState();
    const saved = JSON.parse(store['agrar_rechner']);
    expect(saved.activeView).toBeNull();
  });
});
