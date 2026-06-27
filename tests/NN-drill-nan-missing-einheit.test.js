// Pin-Test für Issue 2 (Code-Review): render-drill.js:51+53 hatte
//   r.entries.reduce(function(s, e) { return s + e.einheit; }, 0)
// OHNE `|| 0` — produziert NaN, sobald ein Entry ohne `e.einheit` existiert.
//
// Fix: render-drill.js nutzt jetzt AppGlobals.getTabRemaining(r, i),
// das intern getTabUsedEinheiten/getTabUsedDuenger (mit `|| 0` Guards) aufruft.
//
// Erwartung: kein NaN im Status-Text; "remaining" = (basis - used) für
// ein realistisches Szenario mit fehlendem `e.einheit`-Feld.

import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Issue 2: renderDrillTabList ist NaN-frei bei fehlendem e.einheit', () => {
  let w, AG, doc;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    AG = w.AppGlobals;
    doc = w.document;
  });

  it('Status-Text enthält kein "NaN" wenn ein Entry kein einheit-Feld hat', () => {
    // Tab mit zwei Entries — eines davon hat kein `einheit`-Feld.
    AG.state.koernerProEinheit = 50000;
    AG.state.reiter = [
      { name: 'Tab 1', hektar: 10, istHektar: 0, koerner: 100000, duenger: 200,
        fahrgassenEnabled: false, fahrgassenBreite: 0,
        entries: [
          { duenger: 100, time: '08:00' }, // ← kein `einheit`-Feld!
          { einheit: 5, duenger: 100, time: '09:00' },
        ] },
    ];
    if (AG.invalidateCarryoverCache) AG.invalidateCarryoverCache();

    w.renderDrillTabList();

    var need = doc.getElementById('dtl_need_0');
    expect(need).toBeTruthy();
    expect(need.textContent).not.toContain('NaN');
  });

  it('remaining-Einheiten sind > 0 und finit (nicht NaN) bei fehlendem e.einheit', () => {
    // getTabRemaining ist AppGlobals-exportiert; liefert obj mit remainingE/remainingD.
    AG.state.koernerProEinheit = 50000;
    AG.state.reiter = [
      { name: 'Tab 1', hektar: 10, istHektar: 0, koerner: 100000, duenger: 200,
        fahrgassenEnabled: false, fahrgassenBreite: 0,
        entries: [
          { duenger: 100, time: '08:00' }, // ← kein `einheit`-Feld!
        ] },
    ];
    if (AG.invalidateCarryoverCache) AG.invalidateCarryoverCache();

    var rem = AG.getTabRemaining(AG.state.reiter[0], 0);
    expect(Number.isFinite(rem.remainingE)).toBe(true);
    expect(Number.isFinite(rem.remainingD)).toBe(true);
    expect(rem.remainingE).toBeGreaterThan(0);
  });

  it('AppGlobals.getTabRemaining existiert', () => {
    expect(typeof AG.getTabRemaining).toBe('function');
  });

  it('inline-drill in renderDrillEntriesInline ist NaN-frei bei fehlendem e.einheit', () => {
    AG.state.koernerProEinheit = 50000;
    AG.state.activeReiter = 0;
    AG.state.reiter = [
      { name: 'Tab 1', hektar: 10, istHektar: 0, koerner: 100000, duenger: 200,
        fahrgassenEnabled: false, fahrgassenBreite: 0,
        entries: [
          { duenger: 100, time: '08:00' }, // ← kein `einheit`-Feld!
          { einheit: 5, duenger: 100, time: '09:00' },
        ] },
    ];
    if (AG.invalidateCarryoverCache) AG.invalidateCarryoverCache();

    w.renderDrillEntriesInline();
    var remEl = doc.getElementById('r_drill_e_rem');
    expect(remEl).toBeTruthy();
    expect(remEl.textContent).not.toContain('NaN');
  });
});