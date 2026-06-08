/**
 * Test 22: Protocol view — switchToProtokoll + renderView
 */
import { describe, it, expect, vi } from 'vitest';
import { createDom } from './helpers.js';

describe('switchToProtokoll', () => {
  it('switches to protokoll view from field view', () => {
    const { window: w } = createDom();
    // Set up some data
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '90000';
    w.berechne();

    expect(w.state.activeView).toBeNull();
    w.switchToProtokoll();

    expect(w.state.activeView).toBe('protokoll');
  });

  it('switches back to field view when already in protokoll', () => {
    const { window: w } = createDom();
    w.switchToProtokoll(); // → protokoll
    w.switchToProtokoll(); // → back to null

    expect(w.state.activeView).toBeNull();
  });

  it('calls renderDrillTabList when entering protokoll', () => {
    const { window: w } = createDom();
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
    const { window: w } = createDom();
    w.document.getElementById('hektar').value = '15';
    w.document.getElementById('koerner').value = '80000';

    w.switchToProtokoll();

    // syncStateFromInputs reads hektar/koerner inputs into state
    expect(w.state.reiter[0].hektar).toBe(15);
    expect(w.state.reiter[0].koerner).toBe(80000);
  });

  it('persists view state to localStorage', () => {
    const { window: w, store } = createDom();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '90000';
    w.berechne(); // Ensure state is initialized and sv() works

    w.switchToProtokoll();

    const saved = JSON.parse(store['agrar_rechner']);
    expect(saved.activeView).toBe('protokoll');
  });
});

describe('renderView', () => {
  it('hides all cards in protokoll mode', () => {
    const { window: w } = createDom();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '90000';
    w.berechne();
    w.switchToProtokoll();

    // Input cards should be hidden (drill_section stays visible in protokoll mode)
    const cards = w.document.querySelectorAll('.card');
    cards.forEach(c => {
      if (c.id === 'drill_section') {
        expect(c.style.display).toBe('block');
      } else {
        expect(c.style.display).toBe('none');
      }
    });
  });

  it('shows all cards in field mode', () => {
    const { window: w } = createDom();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '90000';
    w.berechne();

    w.renderView();

    const cards = w.document.querySelectorAll('.card');
    cards.forEach(c => {
      // zaehler_section and drill_section may be hidden if no data — that's fine
      if (c.id === 'zaehler_section' || c.id === 'drill_section') return;
      expect(c.style.display).not.toBe('none');
    });
  });

  it('hides results in protokoll mode even with data', () => {
    const { window: w } = createDom();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '90000';
    w.berechne();

    w.state.activeView = 'protokoll';
    w.renderView();

    const results = w.document.getElementById('results');
    expect(results.style.display).toBe('none');
  });

  it('shows drill section in protokoll mode', () => {
    const { window: w } = createDom();
    w.state.activeView = 'protokoll';
    w.renderView();

    const drillSection = w.document.getElementById('drill_section');
    expect(drillSection.style.display).toBe('block');
  });

  it('shows drill mask in protokoll mode', () => {
    const { window: w } = createDom();
    w.state.activeView = 'protokoll';
    w.renderView();

    const drillMask = w.document.getElementById('drill_mask');
    expect(drillMask.style.display).not.toBe('none');
  });

  it('hides drill section in field mode', () => {
    const { window: w } = createDom();
    w.renderView();

    const drillSection = w.document.getElementById('drill_section');
    expect(drillSection.style.display).toBe('none');
  });

  it('hides footer buttons in protokoll mode', () => {
    const { window: w } = createDom();
    w.state.activeView = 'protokoll';
    w.renderView();

    expect(w.document.getElementById('berechnen_btn').style.display).toBe('none');
    expect(w.document.getElementById('reset_btn').style.display).toBe('none');
    expect(w.document.getElementById('reset_all_btn').style.display).toBe('none');
  });

  it('hides sticky footer in protokoll mode', () => {
    const { window: w } = createDom();
    w.state.activeView = 'protokoll';
    w.renderView();

    expect(w.document.getElementById('sticky_footer').style.display).toBe('none');
  });

  it('shows results in field mode when data exists', () => {
    const { window: w } = createDom();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '90000';
    w.berechne();

    const results = w.document.getElementById('results');
    expect(results.style.display).toBe('block');
  });

  it('hides results when no data in field mode', () => {
    const { window: w } = createDom();
    w.renderView();

    const results = w.document.getElementById('results');
    expect(results.style.display).toBe('none');
  });
});
