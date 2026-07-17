/**
 * Test 24: EinheitGroesse toggle + update, and einheitGroesse restoration in initUI
 */
import { describe, it, expect, vi } from 'vitest';
import { createDom } from './helpers.js';

describe('einheitGroesseToggle', () => {
  it('toggles enabled state on', () => {
    const { window: w } = createDom();
    expect(w.state.einheitGroesseEnabled).toBe(false);

    w.einheitGroesseToggle();
    expect(w.state.einheitGroesseEnabled).toBe(true);
    expect(w.document.getElementById('einheit_groesse_toggle').classList.contains('active')).toBe(true);
    expect(w.document.getElementById('einheit_groesse_settings').classList.contains('open')).toBe(true);
  });

  it('toggles enabled state off', () => {
    const { window: w } = createDom();
    w.einheitGroesseToggle(); // on
    w.einheitGroesseToggle(); // off

    expect(w.state.einheitGroesseEnabled).toBe(false);
    expect(w.document.getElementById('einheit_groesse_toggle').classList.contains('active')).toBe(false);
    expect(w.document.getElementById('einheit_groesse_settings').classList.contains('open')).toBe(false);
  });

  it('clears saved text when toggled off', () => {
    const { window: w } = createDom();
    w.einheitGroesseToggle();
    w.document.getElementById('einheit_groesse_saved').textContent = '40.000 Körner/Einheit';

    w.einheitGroesseToggle(); // off
    expect(w.document.getElementById('einheit_groesse_saved').textContent).toBe('');
  });

  it('persists state to localStorage', () => {
    const { window: w, store } = createDom();
    w.einheitGroesseToggle();

    const saved = JSON.parse(store['agrar_rechner']);
    expect(saved.einheitGroesseEnabled).toBe(true);
  });
});

describe('einheitGroesseUpdate', () => {
  it('updates koernerProEinheit from input', () => {
    const { window: w } = createDom();
    w.document.getElementById('koerner_pro_einheit').value = '40000';

    w.einheitGroesseUpdate();

    expect(w.state.koernerProEinheit).toBe(40000);
  });

  it('shows info text for non-default value', () => {
    const { window: w } = createDom();
    w.document.getElementById('koerner_pro_einheit').value = '40000';

    w.einheitGroesseUpdate();

    const info = w.document.getElementById('einheit_groesse_saved').textContent;
    expect(info).toContain('40.000');
    expect(info).toContain('Körner/Einheit');
  });

  it('shows no info for default 50000', () => {
    const { window: w } = createDom();
    w.document.getElementById('koerner_pro_einheit').value = '50000';

    w.einheitGroesseUpdate();

    expect(w.document.getElementById('einheit_groesse_saved').textContent).toBe('');
  });

  it('falls back to 50000 for invalid input', () => {
    const { window: w } = createDom();
    w.document.getElementById('koerner_pro_einheit').value = 'abc';

    w.einheitGroesseUpdate();

    expect(w.state.koernerProEinheit).toBe(50000);
  });

  it('falls back to 50000 for zero input', () => {
    const { window: w } = createDom();
    w.document.getElementById('koerner_pro_einheit').value = '0';

    w.einheitGroesseUpdate();

    expect(w.state.koernerProEinheit).toBe(50000);
  });

  it('falls back to 50000 for negative input', () => {
    const { window: w } = createDom();
    w.document.getElementById('koerner_pro_einheit').value = '-100';

    w.einheitGroesseUpdate();

    expect(w.state.koernerProEinheit).toBe(50000);
  });

  it('re-renders results when data exists', () => {
    const { window: w } = createDom();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('koerner').value = '90000';
    w.syncStateFromInputs();
    w.renderResults();

    w.document.getElementById('koerner_pro_einheit').value = '40000';
    w.einheitGroesseUpdate();

    // Einheiten should now be based on 40000 instead of 50000
    const einheiten = w.document.getElementById('r_einheiten').textContent;
    // 10*90000/40000 = 22.5
    expect(einheiten).toBe('22,5 Einheiten');
  });

  it('persists state after update', () => {
    const { window: w, store } = createDom();
    w.document.getElementById('koerner_pro_einheit').value = '40000';
    w.einheitGroesseUpdate();

    const saved = JSON.parse(store['agrar_rechner']);
    expect(saved.koernerProEinheit).toBe(40000);
  });
});

describe('initUI einheitGroesse restoration', () => {
  it('restores einheitGroesse toggle when enabled in saved state', () => {
    const { window: w, store } = createDom();
    // Set up saved state with einheitGroesse enabled
    const savedState = {
      reiter: [{ name: 'Tab 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [] }],
      activeReiter: 0,
      activeView: null,
      koernerProEinheit: 40000,
      einheitGroesseEnabled: true,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      zaehlerstand: 0,
      machineLog: [],
    };
    store['agrar_rechner'] = JSON.stringify(savedState);

    w.initUI();

    expect(w.document.getElementById('einheit_groesse_toggle').classList.contains('active')).toBe(true);
    expect(w.document.getElementById('einheit_groesse_settings').classList.contains('open')).toBe(true);
    expect(w.document.getElementById('koerner_pro_einheit').value).toBe('40000');
    // Should show info for non-default
    expect(w.document.getElementById('einheit_groesse_saved').textContent).toContain('40.000');
  });

  it('does not show einheitGroesse when not enabled', () => {
    const { window: w, store } = createDom();
    const savedState = {
      reiter: [{ name: 'Tab 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [] }],
      activeReiter: 0,
      activeView: null,
      koernerProEinheit: 50000,
      einheitGroesseEnabled: false,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
      zaehlerstand: 0,
      machineLog: [],
    };
    store['agrar_rechner'] = JSON.stringify(savedState);

    w.initUI();

    expect(w.document.getElementById('einheit_groesse_toggle').classList.contains('active')).toBe(false);
    expect(w.document.getElementById('einheit_groesse_settings').classList.contains('open')).toBe(false);
  });
});
