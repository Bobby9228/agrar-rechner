/**
 * Einheit-Größe (Körner pro Einheit, "kpe") pro Schlag.
 *
 * einheitGroesseToggle() ist der Auf-/Zuklapp-Toggle für den
 * Per-Schlag-Editor. einheitGroesseUpdate() liest die Eingabe und
 * schreibt sie auf r.koernerProEinheit des aktiven Tabs (HIGH 4).
 * Nach dem Update werden Ergebnis-Cards neu gerendert, sofern Daten
 * vorhanden sind.
 *
 * Migration 5→6: Per-Tab kpe ist authoritative — state.koernerProEinheit
 * ist nur Fallback, falls der Tab keinen eigenen Wert führt.
 *
 * Zugehörige frühere Dateien: tests/12-einheit-groesse.test.js,
 * tests/24-einheit-groesse.test.js (Issue #419 Welle 2).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDom } from './helpers.js';

describe('einheitGroesseToggle', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('enables on first click', () => {
    expect(w.state.einheitGroesseEnabled).toBe(false);
    w.einheitGroesseToggle();
    expect(w.state.einheitGroesseEnabled).toBe(true);
  });

  it('toggles active class on button', () => {
    var btn = w.document.getElementById('einheit_groesse_toggle');
    w.einheitGroesseToggle();
    expect(btn.classList.contains('active')).toBe(true);
    w.einheitGroesseToggle();
    expect(btn.classList.contains('active')).toBe(false);
  });

  it('toggles open class on settings div', () => {
    var settings = w.document.getElementById('einheit_groesse_settings');
    w.einheitGroesseToggle();
    expect(settings.classList.contains('open')).toBe(true);
    w.einheitGroesseToggle();
    expect(settings.classList.contains('open')).toBe(false);
  });

  it('clears saved text when disabling', () => {
    var saved = w.document.getElementById('einheit_groesse_saved');
    saved.textContent = '80.000 Körner/Einheit';
    w.einheitGroesseToggle(); // enable
    w.einheitGroesseToggle(); // disable
    expect(saved.textContent).toBe('');
  });

  it('saves state via sv()', () => {
    w.einheitGroesseToggle();
    var stored = JSON.parse(w.localStorage.getItem('agrar_rechner'));
    expect(stored.einheitGroesseEnabled).toBe(true);
  });
});

describe('einheitGroesseUpdate', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('updates koernerProEinheit on active tab from input', () => {
    // HIGH 4: Handler schreibt nur auf r.koernerProEinheit, nicht mehr
    // auf state.koernerProEinheit. Tab-Wert bleibt der globale Profil-
    // Standard, manuelle Eingaben sind pro Schlag.
    w.document.getElementById('koerner_pro_einheit').value = '80000';
    w.einheitGroesseUpdate();
    expect(w.state.reiter[0].koernerProEinheit).toBe(80000);
  });

  it('uses default 50000 when input is empty', () => {
    w.document.getElementById('koerner_pro_einheit').value = '';
    w.einheitGroesseUpdate();
    // Tab-Wert bleibt unverändert (default 50000) — Handler verwirft
    // ungültige Eingabe still.
    expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
  });

  it('uses default 50000 when input is 0', () => {
    w.document.getElementById('koerner_pro_einheit').value = '0';
    w.einheitGroesseUpdate();
    expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
  });

  it('uses default 50000 when input is negative', () => {
    w.document.getElementById('koerner_pro_einheit').value = '-100';
    w.einheitGroesseUpdate();
    expect(w.state.reiter[0].koernerProEinheit).toBe(50000);
  });

  it('shows info text when custom value is set', () => {
    w.document.getElementById('koerner_pro_einheit').value = '80000';
    w.einheitGroesseUpdate();
    var saved = w.document.getElementById('einheit_groesse_saved');
    expect(saved.textContent).toContain('80.000');
    expect(saved.textContent).toContain('Körner/Einheit');
  });

  it('clears info text when set to default 50000', () => {
    w.state.reiter[0].koernerProEinheit = 80000;
    w.document.getElementById('koerner_pro_einheit').value = '50000';
    w.einheitGroesseUpdate();
    expect(w.document.getElementById('einheit_groesse_saved').textContent).toBe('');
  });

  it('parses DE-formatted input (comma decimal)', () => {
    w.document.getElementById('koerner_pro_einheit').value = '80.000';
    // parseDE treats dot as thousand separator → 80000
    w.einheitGroesseUpdate();
    expect(w.state.reiter[0].koernerProEinheit).toBe(80000);
  });

  it('saves state via sv()', () => {
    w.document.getElementById('koerner_pro_einheit').value = '60000';
    w.einheitGroesseUpdate();
    var stored = JSON.parse(w.localStorage.getItem('agrar_rechner'));
    // Per-Tab-Wert wird gespeichert, NICHT state.koernerProEinheit
    expect(stored.reiter[0].koernerProEinheit).toBe(60000);
  });

  it('affects getTotalEinheiten calculation', () => {
    // Migration 5→6: Per-Tab kpe ist authoritative — state.koernerProEinheit
    // ist nur Fallback. Test prüft explizit den Tab-Wert.
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 100000, koernerProEinheit: 50000 };
    expect(w.getTotalEinheiten()).toBe(20);

    w.state.reiter[0].koernerProEinheit = 100000;
    expect(w.getTotalEinheiten()).toBe(10);
  });

  it('re-renders results when data exists after update', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, duenger: 0, entries: [], koernerProEinheit: 50000 };
    // First render with default 50000
    w.renderResults();
    // Now update per-tab koernerProEinheit to 80000 — renderResults is called
    w.state.reiter[0].koernerProEinheit = 80000;
    w.renderResults();
    var einheiten = w.document.getElementById('r_einheiten').textContent;
    // 10 * 90000 / 80000 = 11.25 → fmt rounds to 11,3
    expect(einheiten).toContain('11,250');
  });
});

describe('getTabTotalEinheiten with custom koernerProEinheit', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('divides by koernerProEinheit', () => {
    var r = { hektar: 10, koerner: 100000, entries: [] };
    w.state.koernerProEinheit = 80000;
    expect(w.getTabTotalEinheiten(r)).toBeCloseTo(12.5);
  });

  it('returns 0 when hektar is 0', () => {
    var r = { hektar: 0, koerner: 100000, entries: [] };
    w.state.koernerProEinheit = 80000;
    expect(w.getTabTotalEinheiten(r)).toBe(0);
  });

  it('returns 0 when koerner is 0', () => {
    var r = { hektar: 10, koerner: 0, entries: [] };
    w.state.koernerProEinheit = 80000;
    expect(w.getTabTotalEinheiten(r)).toBe(0);
  });

  // Regression: Issue #229 — getTabTotalEinheiten() must read state.koernerProEinheit,
  // not a hardcoded 50000. Otherwise carryover / dashboard "Einheiten verbl." /
  // drill-summary are silently wrong whenever the user changes the unit size.
  it('regression #229: uses state.koernerProEinheit, not hardcoded 50000', () => {
    var r = { hektar: 10, koerner: 100000, entries: [] };
    w.state.koernerProEinheit = 40000; // 2.5× the default
    // 10 * 100000 / 40000 = 25.0 — with hardcoded 50000 this would have returned 20.0
    expect(w.getTabTotalEinheiten(r)).toBeCloseTo(25.0);
  });
});

describe('einheitGroesseToggle — Issue #24 (siebenstellige Werte)', () => {
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

describe('einheitGroesseUpdate — Issue #24 (siebenstellige Werte)', () => {
  it('updates active tab koernerProEinheit from input', () => {
    // HIGH 4: Handler schreibt nur auf r.koernerProEinheit, nicht
    // mehr auf state.koernerProEinheit.
    const { window: w } = createDom();
    w.document.getElementById('koerner_pro_einheit').value = '40000';

    w.einheitGroesseUpdate();

    expect(w.state.reiter[0].koernerProEinheit).toBe(40000);
  });

  it.each([1000000, 1500000])('accepts seven-digit unit sizes such as %i', (value) => {
    const { window: w, store } = createDom();
    const input = w.document.getElementById('koerner_pro_einheit');
    input.value = String(value);

    w.einheitGroesseUpdate();

    expect(w.state.reiter[0].koernerProEinheit).toBe(value);
    expect(input.style.borderColor).toBe('');
    expect(w.document.getElementById('einheit_groesse_saved').textContent)
      .toContain(value.toLocaleString('de-DE'));
    expect(JSON.parse(store['agrar_rechner']).reiter[0].koernerProEinheit).toBe(value);
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

    // Migration 5→6: einheitGroesseUpdate setzt jetzt den per-Tab kpe,
    // nicht mehr den globalen. Hier setzen wir ihn manuell und re-rendern.
    w.state.reiter[0].koernerProEinheit = 40000;
    w.renderResults();

    // Einheiten should now be based on 40000 instead of 50000
    const einheiten = w.document.getElementById('r_einheiten').textContent;
    // 10*90000/40000 = 22.5
    expect(einheiten).toBe('22,500 Einheiten');
  });

  it('persists state after update', () => {
    const { window: w, store } = createDom();
    w.document.getElementById('koerner_pro_einheit').value = '40000';
    w.einheitGroesseUpdate();

    const saved = JSON.parse(store['agrar_rechner']);
    // HIGH 4: Per-Tab-Wert wird gespeichert, nicht state.koernerProEinheit.
    expect(saved.reiter[0].koernerProEinheit).toBe(40000);
  });
});

describe('initUI einheitGroesse restoration', () => {
  it('restores einheitGroesse toggle when enabled in saved state', () => {
    const { window: w, store } = createDom();
    // Set up saved state with einheitGroesse enabled
    const savedState = {
      reiter: [{ name: 'Tab 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false }],
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
      reiter: [{ name: 'Tab 1', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false }],
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
