/**
 * Tests for resetAll() and initUI()
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('resetAll()', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;

    // Setup: calculate and add drill entries
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    doc.getElementById('duenger').value = '150';
    w.berechne();

    doc.getElementById('drill_einheit').value = '2';
    doc.getElementById('drill_duenger').value = '200';
    w.drillAdd();

    // Add fahrgassen
    w.fahrgassenToggle();
    doc.getElementById('fahrgassen_breite').value = '24';
    w.fahrgassenUpdate();
  });

  it('resets all input fields', () => {
    w.resetAll();
    expect(doc.getElementById('hektar').value).toBe('');
    expect(doc.getElementById('koerner').value).toBe('');
    expect(doc.getElementById('duenger').value).toBe('');
  });

  it('clears error messages', () => {
    doc.getElementById('err_hektar').textContent = 'Some error';
    w.resetAll();
    expect(doc.getElementById('err_hektar').textContent).toBe('');
    expect(doc.getElementById('err_koerner').textContent).toBe('');
  });

  it('clears border colors', () => {
    doc.getElementById('hektar').style.borderColor = '#d32f2f';
    w.resetAll();
    expect(doc.getElementById('hektar').style.borderColor).toBe('');
    expect(doc.getElementById('koerner').style.borderColor).toBe('');
  });

  it('hides results section', () => {
    w.resetAll();
    expect(doc.getElementById('results').style.display).toBe('none');
  });

  it('hides drill section', () => {
    w.resetAll();
    expect(doc.getElementById('drill_section').style.display).toBe('none');
  });

  it('resets fahrgassen toggle', () => {
    w.resetAll();
    expect(w.state.fahrgassenEnabled).toBe(false);
    expect(doc.getElementById('fahrgassen_toggle').classList.contains('active')).toBe(false);
    expect(doc.getElementById('fahrgassen_settings').classList.contains('open')).toBe(false);
  });

  it('clears fahrgassen breite input', () => {
    w.resetAll();
    expect(doc.getElementById('fahrgassen_breite').value).toBe('');
    expect(doc.getElementById('fahrgassen_saved').textContent).toBe('');
  });

  it('resets state to default', () => {
    w.resetAll();
    expect(w.state.reiter.length).toBe(1);
    expect(w.state.activeReiter).toBe(0);
    expect(w.state.fahrgassenEnabled).toBe(false);
    expect(w.state.fahrgassenBreite).toBe(0);
    expect(w.state.reiter[0].hektar).toBe(0);
    expect(w.state.reiter[0].koerner).toBe(0);
    expect(w.state.reiter[0].duenger).toBe(0);
    expect(w.state.reiter[0].entries).toEqual([]);
  });

  it('clears drill entries', () => {
    expect(w.getActiveReiter().entries.length).toBe(1);
    w.resetAll();
    expect(w.getActiveReiter().entries.length).toBe(0);
  });

  it('removes extra tabs', () => {
    w.addReiter();
    w.addReiter();
    expect(w.state.reiter.length).toBe(3);
    w.resetAll();
    expect(w.state.reiter.length).toBe(1);
  });
});

describe('initUI()', () => {
  let w, doc, store;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
    store = result.store;
  });

  it('loads state from localStorage', () => {
    store['agrar_rechner'] = JSON.stringify({
      reiter: [{ name: 'Test', hektar: 15, koerner: 80000, duenger: 200, entries: [] }],
      activeReiter: 0,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
    });
    w.initUI();
    expect(doc.getElementById('hektar').value).toBe('15');
    expect(doc.getElementById('koerner').value).toBe('80000');
  });

  it('shows results when state has valid data', () => {
    store['agrar_rechner'] = JSON.stringify({
      reiter: [{ name: 'Reiter 1', hektar: 10, koerner: 90000, duenger: 150, entries: [] }],
      activeReiter: 0,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
    });
    w.initUI();
    expect(doc.getElementById('results').style.display).toBe('block');
  });

  it('hides results when state has no valid data', () => {
    store['agrar_rechner'] = JSON.stringify({
      reiter: [{ name: 'Reiter 1', hektar: 0, koerner: 0, duenger: 0, entries: [] }],
      activeReiter: 0,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
    });
    w.initUI();
    expect(doc.getElementById('results').style.display).toBe('none');
  });

  it('restores fahrgassen state', () => {
    store['agrar_rechner'] = JSON.stringify({
      reiter: [{ name: 'Reiter 1', hektar: 10, koerner: 90000, duenger: 150, entries: [] }],
      activeReiter: 0,
      fahrgassenEnabled: true,
      fahrgassenBreite: 24,
    });
    w.initUI();
    expect(doc.getElementById('fahrgassen_toggle').classList.contains('active')).toBe(true);
    expect(doc.getElementById('fahrgassen_settings').classList.contains('open')).toBe(true);
    expect(doc.getElementById('fahrgassen_breite').value).toBe('24');
  });

  it('renders tabs from saved state', () => {
    store['agrar_rechner'] = JSON.stringify({
      reiter: [
        { name: 'Feld A', hektar: 10, koerner: 90000, duenger: 150, entries: [] },
        { name: 'Feld B', hektar: 5, koerner: 80000, duenger: 100, entries: [] },
      ],
      activeReiter: 1,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
    });
    w.initUI();
    // Tab buttons should appear (2 tabs)
    const btns = doc.querySelectorAll('.field-tab');
    expect(btns.length).toBe(2);
    // Active should be tab 1
    expect(w.state.activeReiter).toBe(1);
    // Inputs should show tab 1 data
    expect(doc.getElementById('hektar').value).toBe('5');
  });

  it('works with empty localStorage', () => {
    // No saved state
    w.initUI();
    expect(doc.getElementById('hektar').value).toBe('');
    expect(w.state.reiter.length).toBe(1);
  });
});

describe('syncStateFromInputs / syncInputsFromState', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('syncStateFromInputs reads DOM values into state', () => {
    doc.getElementById('hektar').value = '12,5';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200';
    w.syncStateFromInputs();

    const r = w.getActiveReiter();
    expect(r.hektar).toBeCloseTo(12.5);
    expect(r.koerner).toBe(80000);
    expect(r.duenger).toBe(200);
  });

  it('syncStateFromInputs handles empty inputs as 0', () => {
    doc.getElementById('hektar').value = '';
    doc.getElementById('koerner').value = '';
    doc.getElementById('duenger').value = '';
    w.syncStateFromInputs();

    const r = w.getActiveReiter();
    expect(r.hektar).toBe(0);
    expect(r.koerner).toBe(0);
    expect(r.duenger).toBe(0);
  });

  it('syncInputsFromState writes state values into DOM', () => {
    w.state.reiter[0].hektar = 15;
    w.state.reiter[0].koerner = 85000;
    w.state.reiter[0].duenger = 175;
    w.syncInputsFromState();

    expect(doc.getElementById('hektar').value).toBe('15');
    expect(doc.getElementById('koerner').value).toBe('85000');
    expect(doc.getElementById('duenger').value).toBe('175');
  });

  it('syncInputsFromState shows empty for zero values', () => {
    w.state.reiter[0].hektar = 0;
    w.state.reiter[0].koerner = 0;
    w.state.reiter[0].duenger = 0;
    w.syncInputsFromState();

    expect(doc.getElementById('hektar').value).toBe('');
    expect(doc.getElementById('koerner').value).toBe('');
    expect(doc.getElementById('duenger').value).toBe('');
  });

  it('getActiveReiter returns correct tab', () => {
    w.addReiter();
    expect(w.getActiveReiter()).toBe(w.state.reiter[1]);
    w.switchReiter(0);
    expect(w.getActiveReiter()).toBe(w.state.reiter[0]);
  });
});
