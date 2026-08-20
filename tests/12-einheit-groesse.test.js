/**
 * Tests for einheitGroesseToggle() and einheitGroesseUpdate()
 * — custom Koerner pro Einheit setting (default 50000).
 */
import { describe, it, expect, beforeEach } from 'vitest';
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
