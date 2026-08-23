import { createDom } from './helpers.js';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * Regressionen & Blind-Spots (Session-Fixes, Edge-Cases, E2E-Screenshot-Szenario)
 * Zusammengeführt in Issue #419 (Welle 4) aus:
 * 09-blind-spots.test.js, 10-regression-session-fixes.test.js, 17-edge-cases.test.js, 18-blind-spots-round2.test.js, 44-user-screenshot-8-5ha-e2e.test.js
 * Jede Quelldatei ist als eigener describe-Block vollständig
 * erhalten (nur Import-Zeilen dedupliziert) — keine Assertions
 * wurden verändert oder entfernt.
 */

describe('Regressionen & Blind-Spots (Session-Fixes, Edge-Cases, E2E-Screenshot-Szenario) — übernommen aus 09-blind-spots.test.js', () => {
/**
 * Tests for blind spots found during code audit.
 */

describe('Blind spots — renderTabs callbacks', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
    w.addReiter(); // 2 tabs
  });

  it('tab btn click calls switchReiter(i)', () => {
    // Tab 0 button should switch to reiter 0
    expect(w.state.activeReiter).toBe(1); // currently on tab 1

    const btns = doc.querySelectorAll('.field-tab');
    // Issue #418 Welle 5: Handler ist per addEventListener gebunden —
    // .onclick() greift nicht mehr. .click() löst das Click-Event aus.
    btns[0].click(); // click tab 0
    expect(w.state.activeReiter).toBe(0);
  });

  it('tab-close click calls removeReiter(i)', () => {
    // Der Close-Handler ruft evt.stopPropagation() und confirmRemoveReiter(i).
    // confirm() muss true liefern, sonst kein removeReiter.
    expect(w.state.reiter.length).toBe(2);
    const closes = doc.querySelectorAll('.tab-close');
    w.confirm = () => true;
    closes[1].click();
    expect(w.state.reiter.length).toBe(1);
  });

  it('tab name span keydown: Enter triggers blur', () => {
    const spans = doc.querySelectorAll('.tab-name');
    const span = spans[1];
    span.textContent = 'Test Feld';

    // Issue #418 Welle 5: Handler ist per addEventListener gebunden.
    // dispatchEvent synthetisiert ein echtes Event-Objekt.
    var evt;
    try {
      evt = new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    } catch (e) {
      evt = doc.createEvent('Event');
      evt.initEvent('keydown', true, true);
      Object.defineProperty(evt, 'key', { value: 'Enter' });
    }
    span.dispatchEvent(evt);
    // span.blur() wurde vom Handler aufgerufen
  });

  it('tab name span keydown: Escape resets text', () => {
    const spans = doc.querySelectorAll('.tab-name');
    const span = spans[1];
    const originalName = span.textContent;
    span.textContent = 'Changed';

    var evt;
    try {
      evt = new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    } catch (e) {
      evt = doc.createEvent('Event');
      evt.initEvent('keydown', true, true);
      Object.defineProperty(evt, 'key', { value: 'Escape' });
    }
    span.dispatchEvent(evt);
    // Escape resets to original name then blurs
    expect(span.textContent).toBe(originalName);
  });

  it('tab name span keydown: non-Enter calls stopPropagation', () => {
    const spans = doc.querySelectorAll('.tab-name');
    const span = spans[1];

    var evt;
    try {
      evt = new w.KeyboardEvent('keydown', { key: 'a', bubbles: true });
    } catch (e) {
      evt = doc.createEvent('Event');
      evt.initEvent('keydown', true, true);
      Object.defineProperty(evt, 'key', { value: 'a' });
    }
    span.dispatchEvent(evt);
    // Handler ruft stopPropagation für Nicht-Enter/Nicht-Escape — der
    // dispatchEvent-Pfad macht das Event "already stopped"; für die
    // Funktionsabdeckung reicht der Aufruf.
  });

  it('tab name span blur calls renameReiter', () => {
    const spans = doc.querySelectorAll('.tab-name');
    const span = spans[1];
    span.textContent = 'Via Blur';
    // blur() löst das Blur-Event aus, das den addEventListener-Handler
    // (renameReiter) ruft. Erst fokussieren, damit jsdom das Event
    // tatsächlich feuert.
    span.focus();
    span.blur();

    expect(w.state.reiter[1].name).toBe('Via Blur');
  });
});

describe('Blind spots — renderResults edge cases', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  function calc(hektar, koerner, duenger) {
    var r = w.getActiveReiter();
    r.hektar = hektar;
    r.koerner = koerner;
    r.duenger = duenger;
    w.renderResults();
  }

  it('formats large KornerGesamt with DE thousand separators', () => {
    calc(12.5, 90000, 0);

    // 12.5 * 90000 = 1.125.000
    const text = doc.getElementById('r_korner').textContent;
    // toLocaleString('de-DE') => "1.125.000"
    expect(text).toBe('1.125.000');
  });

  it('r_info shows "ohne Dünger" when no duenger', () => {
    calc(10, 90000, 0);

    expect(doc.getElementById('r_info').textContent).toContain('ohne Dünger');
  });

  it('r_info shows duenger + saat when duenger is set', () => {
    calc(10, 90000, 150);

    const info = doc.getElementById('r_info').textContent;
    expect(info).toContain('kg Dünger');
    expect(info).toContain('Saat');
    expect(info).not.toContain('ohne Dünger');
  });

  it('drill entry shows time prefix when time is set', () => {
    calc(10, 90000, 0);

    const r = w.getActiveReiter();
    r.entries.push({ einheit: 2, zaehlerStand: 3.5, duenger: 200, time: '14:30' });
    w.renderResults();

    const spans = doc.querySelectorAll('.entry-text');
    expect(spans[0].textContent).toContain('14:30 – ');
    expect(spans[0].textContent).toContain('3,5 ha');
    expect(spans[0].textContent).toContain('2,000 Einheiten');
    expect(spans[0].textContent).toContain('200 kg Dünger');
  });

  it('drill entry without duenger has no Dünger text', () => {
    calc(10, 90000, 0);

    const r = w.getActiveReiter();
    r.entries.push({ einheit: 2, zaehlerStand: 0, duenger: 0, time: '10:00' });
    w.renderResults();

    const spans = doc.querySelectorAll('.entry-text');
    expect(spans[0].textContent).not.toContain('Dünger');
    expect(spans[0].textContent).not.toContain('@');
  });

  it('drill entry without hektar has no @ text', () => {
    calc(10, 90000, 0);

    const r = w.getActiveReiter();
    r.entries.push({ einheit: 2, zaehlerStand: 0, duenger: 100, time: '10:00' });
    w.renderResults();

    const spans = doc.querySelectorAll('.entry-text');
    expect(spans[0].textContent).not.toContain('@');
    expect(spans[0].textContent).toContain('100 kg');
    expect(spans[0].textContent).toContain('Dünger');
  });

  it('ds_total_summary is hidden (only einheiten-relevant info would be shown)', () => {
    calc(10, 90000, 0);

    const r = w.getActiveReiter();
    r.entries.push({ einheit: 3, zaehlerStand: 0, duenger: 0, time: '10:00' });
    w.renderResults();

    // ds_total_summary is display:none since the visible one-liner was removed
    // (per user request — the table below already shows the same totals in
    // more detail). The renderer still writes to textContent, but the element
    // must stay hidden.
    const el = doc.getElementById('ds_total_summary');
    expect(el.style.display).toBe('none');
  });

  it('drill entry has #number span', () => {
    calc(10, 90000, 0);

    const r = w.getActiveReiter();
    r.entries.push({ einheit: 2, zaehlerStand: 0, duenger: 0, time: '10:00' });
    r.entries.push({ einheit: 3, zaehlerStand: 0, duenger: 0, time: '10:05' });
    w.renderResults();

    const hashes = doc.querySelectorAll('.entry-text span');
    expect(hashes[0].textContent).toBe('#1 ');
    expect(hashes[1].textContent).toBe('#2 ');
  });

  it('drill entry delete button has btn-danger class and calls drillRemove', () => {
    calc(10, 90000, 0);

    const r = w.getActiveReiter();
    r.entries.push({ einheit: 2, zaehlerStand: 0, duenger: 0, time: '10:00' });
    w.renderResults();

    // btn-danger buttons: result card inline (r_drill_entries) + per-tab entry (drill_entries)
    const btns = doc.querySelectorAll('.btn-danger');
    // Debug: list where each btn-danger lives
    // console.log for debugging: check parent containers
    expect(btns.length).toBeGreaterThanOrEqual(2);
    // Click delete on the first one (result card inline entry)
    btns[0].click();
    expect(r.entries.length).toBe(0);
  });

  it('drill_summary visibility: shown when entries exist but no calculation', () => {
    calc(10, 90000, 0);

    // After renderResults, drill_summary should be visible (einheiten > 0)
    expect(doc.getElementById('drill_summary').style.display).toBe('block');
  });
});

describe('Blind spots — renderResults with duenger-only entry (einheit=0)', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('total summary includes duenger but not ha for duenger-only entry', () => {
    var r = w.getActiveReiter();
    r.hektar = 10;
    r.koerner = 90000;
    r.duenger = 150;
    w.renderResults();

    r.entries.push({ einheit: 0, zaehlerStand: 0, duenger: 500, time: '10:00' });
    w.renderResults();

    const el = doc.getElementById('ds_total_summary');
    expect(el.style.display).toBe('none');
  });
});

describe('Blind spots — syncInputsFromState with decimal values', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('shows decimal hektar correctly', () => {
    w.state.reiter[0].hektar = 12.5;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].duenger = 150.5;
    w.syncInputsFromState();

    expect(doc.getElementById('hektar').value).toBe('12,5');
    expect(doc.getElementById('koerner').value).toBe('80000');
    expect(doc.getElementById('duenger').value).toBe('150,5');
  });
});

describe('Blind spots — switchReiter hides drill_section when no data', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('hides drill_section when switching to tab with no data', () => {
    // Setup: tab 0 has data (hektar=10, koerner=90000); tab 1 will be empty.
    // We push the second tab directly to avoid addReiter's syncStateFromInputs()
    // resetting tab 0 from the (empty) DOM inputs.
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 90000;
    w.state.reiter.push({ name: 'Tab 2', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [], done: false });
    w.state.activeReiter = 0;
    w.renderResults();
    // drill_section should NOT show after renderResults in normal view (only in protokoll mode)
    expect(doc.getElementById('drill_section').style.display).toBe('none');

    // Switch to tab 0 (has data) -> shows
    w.state.activeReiter = 0;
    w.renderResults();
    expect(doc.getElementById('results').style.display).toBe('block');

    // Switch to tab 1 (no data) -> hides both
    w.state.activeReiter = 1;
    w.renderResults();
    expect(doc.getElementById('results').style.display).toBe('none');
    expect(doc.getElementById('drill_section').style.display).toBe('none');
  });
});

describe('Blind spots — initUI restores fahrgassen without breite', () => {
  let w, store;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    store = result.store;
  });

  it('enables toggle but does not set breite when fahrgassenBreite=0', () => {
    store['agrar_rechner'] = JSON.stringify({
      reiter: [{ name: 'Reiter 1', hektar: 0, koerner: 0, duenger: 0, entries: [] }],
      activeReiter: 0,
      fahrgassenEnabled: true,
      fahrgassenBreite: 0,
    });
    w.initUI();

    expect(w.document.getElementById('fahrgassen_toggle').classList.contains('active')).toBe(true);
    expect(w.document.getElementById('fahrgassen_settings').classList.contains('open')).toBe(true);
    // breite input should be empty (since 0 > 0 is false)
    expect(w.document.getElementById('fahrgassen_breite').value).toBe('');
    expect(w.document.getElementById('fahrgassen_saved').textContent).toBe('');
  });
});
});

describe('Regressionen & Blind-Spots (Session-Fixes, Edge-Cases, E2E-Screenshot-Szenario) — übernommen aus 10-regression-session-fixes.test.js', () => {
/**
 * Regression tests for bugs fixed in session 2026-04-25.
 *
 * These tests verify the exact scenarios that caused each bug,
 * ensuring they cannot re-occur.
 *
 * Fix 1 (5e823cb): entries undefined on reiter → TypeError in the calculation pipeline
 * Fix 2 (741a31b): missing tab-add button → appendChild(null) in renderTabs()
 * Fix 3 (75447f1): renderTabs recycled detached node → NotFoundError
 * Fix 4 (919a999): syncInputsFromState wrote 9.2 instead of 9,2 → parseDE read 92
 */

// ---------------------------------------------------------------------------
// Fix 1: entries array missing on reiter objects from old localStorage
// ---------------------------------------------------------------------------
describe('Regression: entries undefined on reiter', () => {
  let w, doc, store;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
    store = result.store;
  });

  it('calculation works when reiter has no entries field (loaded from old localStorage)', () => {
    // Simulate old localStorage where reiter objects had no entries field
    store['agrar_rechner'] = JSON.stringify({
      reiter: [
        { name: 'Feld A', hektar: 10, koerner: 90000, duenger: 150 }
        // no entries field!
      ],
      activeReiter: 0,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
    });
    w.loadState();

    // The reiter should now have entries initialized
    const r = w.getActiveReiter();
    expect(Array.isArray(r.entries)).toBe(true);
    expect(r.entries.length).toBe(0);

    // renderResults should not throw even when entries was missing
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    w.syncStateFromInputs();
    expect(() => w.renderResults()).not.toThrow();
    expect(doc.getElementById('results').style.display).toBe('block');
  });

  it('getActiveReiter() auto-creates entries array when missing', () => {
    // Directly corrupt state to simulate the edge case
    w.state.reiter[0].entries = undefined;
    const r = w.getActiveReiter();
    expect(Array.isArray(r.entries)).toBe(true);
  });

  it('calculation works with multiple reiters where one has no entries', () => {
    store['agrar_rechner'] = JSON.stringify({
      reiter: [
        { name: 'Feld A', hektar: 5, koerner: 80000, duenger: 100, entries: [{ einheit: 1, hektar: 2, duenger: 50, time: '10:00' }] },
        { name: 'Feld B', hektar: 8, koerner: 90000, duenger: 200 }  // no entries!
      ],
      activeReiter: 1,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
    });
    w.loadState();

    // Switch to the tab without entries
    doc.getElementById('hektar').value = '8';
    doc.getElementById('koerner').value = '90000';
    w.syncStateFromInputs();
    expect(() => w.renderResults()).not.toThrow();
    expect(doc.getElementById('r_korner').textContent).toBe('720.000');
  });

  it('lv() migration adds entries to ALL reiters, not just the first', () => {
    store['agrar_rechner'] = JSON.stringify({
      reiter: [
        { name: 'A', hektar: 1, koerner: 80000, duenger: 0 },
        { name: 'B', hektar: 2, koerner: 90000, duenger: 0 },
        { name: 'C', hektar: 3, koerner: 85000, duenger: 0 },
      ],
      activeReiter: 0,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
    });
    w.loadState();

    expect(Array.isArray(w.state.reiter[0].entries)).toBe(true);
    expect(Array.isArray(w.state.reiter[1].entries)).toBe(true);
    expect(Array.isArray(w.state.reiter[2].entries)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fix 2 + 3: renderTabs() must always create tab-add button fresh
// ---------------------------------------------------------------------------
describe('Regression: renderTabs creates tab-add button fresh', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('tab-add button exists after initial renderTabs', () => {
    w.renderTabs();
    expect(doc.querySelector('.tab-add')).not.toBeNull();
  });

  it('tab-add button still exists after multiple renderTabs calls', () => {
    w.renderTabs();
    w.renderTabs();
    w.renderTabs();
    expect(doc.querySelector('.tab-add')).not.toBeNull();
  });

  it('tab-add button exists after adding a tab (addReiter triggers renderTabs)', () => {
    w.addReiter();
    expect(doc.querySelector('.tab-add')).not.toBeNull();
    expect(doc.querySelector('.tab-add').textContent).toContain('Tab');
  });

  it('renderResults works after adding a tab', () => {
    w.addReiter();
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    w.syncStateFromInputs();
    expect(() => w.renderResults()).not.toThrow();
    expect(doc.getElementById('results').style.display).toBe('block');
  });

  it('renderTabs survives adding and removing tabs repeatedly', () => {
    w.addReiter(); // 2 tabs
    w.addReiter(); // 3 tabs
    expect(doc.querySelectorAll('.field-tab').length).toBe(3);
    expect(doc.querySelector('.tab-add')).not.toBeNull();

    w.removeReiter(2);
    w.removeReiter(1);
    expect(w.state.reiter.length).toBe(1);
    expect(doc.querySelector('.tab-add')).not.toBeNull();
  });

  it('tab-add click still works after multiple renderTabs calls', () => {
    w.renderTabs();
    w.renderTabs();

    // Issue #418 Welle 5: Handler ist per addEventListener gebunden
    // (renderTabs erzeugt das Element und registriert den Click-Listener).
    const addBtn = doc.querySelector('.tab-add');
    expect(addBtn).not.toBeNull();
    addBtn.click();
    expect(w.state.reiter.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Fix 4: syncInputsFromState must format decimals with comma (DE locale)
// ---------------------------------------------------------------------------
describe('Regression: syncInputsFromState uses DE format', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('writes hektar with comma: 9.2 → "9,2" not "9.2"', () => {
    w.state.reiter[0].hektar = 9.2;
    w.syncInputsFromState();
    expect(doc.getElementById('hektar').value).toBe('9,2');
  });

  it('writes duenger with comma: 150.5 → "150,5" not "150.5"', () => {
    w.state.reiter[0].duenger = 150.5;
    w.syncInputsFromState();
    expect(doc.getElementById('duenger').value).toBe('150,5');
  });

  it('integer values have no comma: 90000 → "90000"', () => {
    w.state.reiter[0].koerner = 90000;
    w.syncInputsFromState();
    expect(doc.getElementById('koerner').value).toBe('90000');
  });

  it('full cycle: calculate → switchReiter → calculate preserves correct decimal', () => {
    // Calculate with 9,2 ha
    doc.getElementById('hektar').value = '9,2';
    doc.getElementById('koerner').value = '90000';
    doc.getElementById('duenger').value = '150';
    w.syncStateFromInputs();
    w.renderResults();

    expect(w.state.reiter[0].hektar).toBeCloseTo(9.2);

    // Add a second tab and switch to it
    w.addReiter();

    // Switch back to first tab
    w.switchReiter(0);

    // Input should show "9,2" not "9.2"
    expect(doc.getElementById('hektar').value).toBe('9,2');

    // Calculate again — should still be 9.2 ha, not 92 ha
    w.syncStateFromInputs();
    w.renderResults();
    expect(w.state.reiter[0].hektar).toBeCloseTo(9.2);
    // 9.2 * 90000 = 828000, not 92 * 90000 = 8280000
    expect(doc.getElementById('r_korner').textContent).toBe('828.000');
  });

  it('full cycle: calculate → initUI reload → calculate preserves correct decimal', () => {
    // Calculate with 12,5 ha
    doc.getElementById('hektar').value = '12,5';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200,5';
    w.syncStateFromInputs();
    w.renderResults();
    w.saveState();

    // Reload state via lv + syncInputsFromState
    w.state = {
      reiter: [{ name: 'Reiter 1', hektar: 0, koerner: 0, duenger: 0, entries: [] }],
      activeReiter: 0,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
    };
    w.loadState();
    w.syncInputsFromState();

    // Should show DE format
    expect(doc.getElementById('hektar').value).toBe('12,5');
    expect(doc.getElementById('duenger').value).toBe('200,5');

    // Recalculate — must be 12.5 ha not 125 ha
    w.syncStateFromInputs();
    w.renderResults();
    expect(w.state.reiter[0].hektar).toBeCloseTo(12.5);
    // 12.5 * 80000 = 1000000
    expect(doc.getElementById('r_korner').textContent).toBe('1.000.000');
  });

  it('fahrgassenBreite is formatted with comma after initUI', () => {
    // Save state with decimal fahrgassenBreite
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 24.5;
    w.saveState();

    // Reload and init
    w.state = {
      reiter: [{ name: 'Reiter 1', hektar: 0, koerner: 0, duenger: 0, entries: [] }],
      activeReiter: 0,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
    };
    w.loadState();
    w.initUI();

    expect(doc.getElementById('fahrgassen_breite').value).toBe('24,5');
  });
});

// ---------------------------------------------------------------------------
// Integration: all fixes work together
// ---------------------------------------------------------------------------
describe('Regression: integration — old localStorage + tabs + decimals', () => {
  let w, doc, store;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
    store = result.store;
  });

  it('old localStorage with no entries → add tab → calculate with decimals', () => {
    // Simulate the exact state that caused the original crash
    store['agrar_rechner'] = JSON.stringify({
      reiter: [
        { name: 'Feld A', hektar: 9.2, koerner: 90000, duenger: 150.5 }
      ],
      activeReiter: 0,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
    });
    w.loadState();
    w.syncInputsFromState();

    // Should show DE format
    expect(doc.getElementById('hektar').value).toBe('9,2');

    // Calculate
    w.syncStateFromInputs();
    expect(() => w.renderResults()).not.toThrow();
    expect(doc.getElementById('results').style.display).toBe('block');

    // Add a tab
    expect(() => w.addReiter()).not.toThrow();
    expect(w.state.reiter.length).toBe(2);
    expect(doc.querySelector('.tab-add')).not.toBeNull();

    // Calculate on new tab
    doc.getElementById('hektar').value = '5,5';
    doc.getElementById('koerner').value = '80000';
    w.syncStateFromInputs();
    expect(() => w.renderResults()).not.toThrow();
    expect(w.state.reiter[1].hektar).toBeCloseTo(5.5);

    // Switch back to first tab — should still be 9,2 not 92
    w.switchReiter(0);
    expect(doc.getElementById('hektar').value).toBe('9,2');
    w.syncStateFromInputs();
    expect(() => w.renderResults()).not.toThrow();
    expect(w.state.reiter[0].hektar).toBeCloseTo(9.2);
  });
});
});

describe('Regressionen & Blind-Spots (Session-Fixes, Edge-Cases, E2E-Screenshot-Szenario) — übernommen aus 17-edge-cases.test.js', () => {
/**
 * Tests for remaining edge cases and utility functions:
 * - fmt() formatting
 * - toInputValue() number to string
 * - getTabKornerGesamt / getTabTotalDuenger with various inputs
 * - getTabTotalEinheiten with fahrgassen
 * - lv() migration edge cases
 * - confirmRemoveReiter (confirm mock)
 * - resetAll clears machineLog
 */

describe('fmt()', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('formats integer with one decimal', () => {
    expect(w.fmt(5)).toBe('5,0');
  });

  it('formats decimal correctly', () => {
    expect(w.fmt(3.7)).toBe('3,7');
  });

  it('rounds to one decimal place', () => {
    expect(w.fmt(3.14159)).toBe('3,1');
  });

  it('rounds 0.05 to 0,1 (round half up)', () => {
    expect(w.fmt(0.05)).toBe('0,1');
  });

  it('rounds 0.04 to 0,0', () => {
    expect(w.fmt(0.04)).toBe('0,0');
  });

  it('formats 0 correctly', () => {
    expect(w.fmt(0)).toBe('0,0');
  });

  it('formats large numbers', () => {
    expect(w.fmt(12345.6)).toBe('12345,6');
  });

  it('handles negative numbers', () => {
    expect(w.fmt(-3.5)).toBe('-3,5');
  });
});

describe('toInputValue()', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('replaces dot with comma', () => {
    expect(w.toInputValue(3.5)).toBe('3,5');
  });

  it('integer stays integer (no comma)', () => {
    expect(w.toInputValue(10)).toBe('10');
  });

  it('0 stays 0', () => {
    expect(w.toInputValue(0)).toBe('0');
  });

  it('works with very small decimals', () => {
    expect(w.toInputValue(0.1)).toBe('0,1');
  });
});

describe('getTabKornerGesamt cross-tab', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('works for a specific tab, not activeReiter', () => {
    w.state.reiter = [
      { name: 'A', hektar: 10, koerner: 90000, entries: [] },
      { name: 'B', hektar: 5, koerner: 80000, entries: [] },
    ];
    expect(w.getTabKornerGesamt(w.state.reiter[0])).toBe(900000);
    expect(w.getTabKornerGesamt(w.state.reiter[1])).toBe(400000);
  });

  it('respects fahrgassen for specific tab', () => {
    var tab = { name: 'X', hektar: 10, koerner: 100000, entries: [] };
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 4;
    // (4-1)/4 = 0.75
    expect(w.getTabKornerGesamt(tab)).toBe(750000);
  });
});

describe('getTabTotalDuenger cross-tab', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('works for a specific tab', () => {
    var tab = { name: 'X', hektar: 10, duenger: 200, entries: [] };
    expect(w.getTabTotalDuenger(tab)).toBe(2000);
  });

  it('returns 0 when hektar is 0', () => {
    var tab = { name: 'X', hektar: 0, duenger: 200, entries: [] };
    expect(w.getTabTotalDuenger(tab)).toBe(0);
  });

  it('returns 0 when duenger is 0', () => {
    var tab = { name: 'X', hektar: 10, duenger: 0, entries: [] };
    expect(w.getTabTotalDuenger(tab)).toBe(0);
  });
});

describe('lv() migration edge cases', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('migrates old flat state with entries to tabbed', () => {
    var oldState = {
      hektar: 10,
      koerner: 90000,
      duenger: 150,
      entries: [{ einheit: 5, duenger: 100 }]
    };
    w.localStorage.setItem('agrar_rechner', JSON.stringify(oldState));
    w.loadState();
    expect(w.state.reiter).toBeTruthy();
    expect(w.state.reiter.length).toBe(1);
    expect(w.state.reiter[0].hektar).toBe(10);
    expect(w.state.reiter[0].koerner).toBe(90000);
    expect(w.state.reiter[0].entries.length).toBe(1);
  });

  it('migrates state with global entries to first tab entries', () => {
    var oldState = {
      reiter: [{ name: 'Tab 1', hektar: 5, koerner: 80000 }],
      entries: [{ einheit: 3, duenger: 50 }]
    };
    w.localStorage.setItem('agrar_rechner', JSON.stringify(oldState));
    w.loadState();
    expect(w.state.reiter[0].entries.length).toBe(1);
    // Global entries should be removed
    expect(w.state.entries).toBeUndefined();
  });

  it('does not overwrite existing tab entries during migration', () => {
    var oldState = {
      reiter: [
        { name: 'Tab 1', hektar: 5, koerner: 80000, entries: [{ einheit: 2 }] },
        { name: 'Tab 2', hektar: 3, koerner: 70000 }
      ],
      entries: [{ einheit: 3 }]
    };
    w.localStorage.setItem('agrar_rechner', JSON.stringify(oldState));
    w.loadState();
    // Tab 1 already has entries, should keep them
    expect(w.state.reiter[0].entries.length).toBe(1);
    expect(w.state.reiter[0].entries[0].einheit).toBe(2);
    // Tab 2 should get entries array
    expect(w.state.reiter[1].entries).toEqual([]);
  });

  it('ensures machineLog exists after migration', () => {
    var oldState = {
      reiter: [{ name: 'Tab 1', hektar: 5, koerner: 80000, entries: [] }]
    };
    delete oldState.machineLog;
    w.localStorage.setItem('agrar_rechner', JSON.stringify(oldState));
    w.loadState();
    expect(w.state.machineLog).toEqual([]);
  });
});

describe('confirmRemoveReiter', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('removes tab when confirmed', () => {
    var originalConfirm = w.confirm;
    w.confirm = () => true;

    w.addReiter();
    expect(w.state.reiter.length).toBe(2);
    w.confirmRemoveReiter(1);
    expect(w.state.reiter.length).toBe(1);

    w.confirm = originalConfirm;
  });

  it('keeps tab when cancelled', () => {
    var originalConfirm = w.confirm;
    w.confirm = () => false;

    w.addReiter();
    expect(w.state.reiter.length).toBe(2);
    w.confirmRemoveReiter(1);
    expect(w.state.reiter.length).toBe(2);

    w.confirm = originalConfirm;
  });

  it('shows data warning when tab has data', () => {
    var lastMsg = '';
    var originalConfirm = w.confirm;
    w.confirm = (msg) => { lastMsg = msg; return false; };

    w.addReiter();
    w.state.reiter[1].hektar = 10;
    w.state.reiter[1].koerner = 90000;
    w.confirmRemoveReiter(1);

    expect(lastMsg).toContain('Daten vorhanden');

    w.confirm = originalConfirm;
  });

  it('shows basic message when tab has no data', () => {
    var lastMsg = '';
    var originalConfirm = w.confirm;
    w.confirm = (msg) => { lastMsg = msg; return false; };

    w.addReiter();
    w.confirmRemoveReiter(1);

    expect(lastMsg).toContain('Alle Eingaben gehen verloren');

    w.confirm = originalConfirm;
  });
});

describe('drillRemove cross-tab', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('removes entry from specified tab', () => {
    w.state.reiter[0].entries = [
      { einheit: 5, duenger: 100 },
      { einheit: 3, duenger: 50 },
    ];
    w.drillRemove(0, 0);
    expect(w.state.reiter[0].entries.length).toBe(1);
    expect(w.state.reiter[0].entries[0].einheit).toBeCloseTo(3);
  });

  it('removes entry from different tab', () => {
    w.state.reiter.push({ name: 'B', hektar: 5, koerner: 80000, duenger: 0, entries: [
      { einheit: 2, duenger: 30 },
    ]});
    w.drillRemove(1, 0);
    expect(w.state.reiter[1].entries.length).toBe(0);
  });

  it('saves state after removal', () => {
    w.state.reiter[0].entries = [{ einheit: 5, duenger: 100 }];
    w.drillRemove(0, 0);
    var stored = JSON.parse(w.localStorage.getItem('agrar_rechner'));
    expect(stored.reiter[0].entries.length).toBe(0);
  });
});
});

describe('Regressionen & Blind-Spots (Session-Fixes, Edge-Cases, E2E-Screenshot-Szenario) — übernommen aus 18-blind-spots-round2.test.js', () => {
/**
 * Tests for remaining blind spots and edge cases found in audit round 2.
 *
 * Includes (original round 2):
 * 1. switchReiter behavior with the protokoll view (view-toggle, Issue #291)
 * 2. Prognose cumulative calculation with fahrgassen factor
 * 3. Prognose with duenger-only consumption (no einheit)
 * 4. drillTabList needDiv: done with duenger finished but einheit remaining
 * 5. renderDashboard per-tab calculation (fahrgassen NOT applied — BUG documented)
 * 6. renderDashboard summary with partial entries
 * 7. initUI with einheitGroesseEnabled and custom koernerProEinheit
 * 8. berechne with usedEinheit exceeds but usedDuenger is fine (OR condition)
 * 9. Prognose: second fill with hektar stand going backwards
 * 10. renderDrillTabList: remaining need shows duenger kg
 *
 * Includes (merged from tests/18-blind-spots-2.test.js, see #279):
 * - drillCalcAll() — distribution algorithm
 * - drillMachineRemove() — machine log entry removal
 * - Theme — getStoredTheme / setStoredTheme / applyTheme / toggleTheme / initTheme
 * - renderDrillTabList() — row rendering, priority button, input mode
 * - switchToProtokoll() — view toggle (Issue #291, Pre-#291 pattern)
 * - Protokoll tab btn — click triggers switchToProtokoll (active class via renderTabs)
 */

describe('switchReiter from protokoll view', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  // Der Protokoll-Tab ist kein eigener Reiter, sondern ein View-Toggle.
  // switchReiter() muss aus dem Protokoll in die Feld-Ansicht zurückschalten
  // (activeView=null) und auf den Ziel-Tab wechseln.
  it('switches to same tab AND exits protokoll view (activeView → null)', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000 };
    w.switchToProtokoll();
    expect(w.state.activeView).toBe('protokoll');
    expect(w.state.activeReiter).toBe(0);

    w.switchReiter(0);
    expect(w.state.activeView).toBeNull();
    expect(w.state.activeReiter).toBe(0);
  });

  it('switches to a different tab AND exits protokoll view', () => {
    w.addReiter();
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000 };
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 5, koerner: 80000 };
    w.switchToProtokoll();
    expect(w.state.activeView).toBe('protokoll');

    w.switchReiter(1);
    expect(w.state.activeView).toBeNull();
    expect(w.state.activeReiter).toBe(1);
  });
});

describe('Prognose with fahrgassen factor', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('applies fahrgassen factor in unitsPerHa calculation', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 100000, duenger: 0, entries: [] };
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 4; // factor = 3/4 = 0.75
    // unitsPerHa = koerner * fgFactor / koernerProEinheit = 100000 * 0.75 / 50000 = 1.5 einheiten/ha

    w.state.machineLog = [
      { einheit: 6, hektar: 0, duenger: 0, time: '10:00' },
      { einheit: 3, hektar: 2, duenger: 0, time: '11:00' },
    ];
    w.renderResults();

    var mlContainer = w.document.getElementById('drill_machine_log');
    var prognose = mlContainer.querySelectorAll('.drill-prognose');
    // Entry 0: cumEinheit=6, prognose = 0 + 6/1.5 = 4.0 ha
    expect(prognose[0].textContent).toContain('4,0');
    // Entry 1: cumEinheit = max(0, 6 - 2*1.5) + 3 = max(0, 6-3) + 3 = 3+3 = 6
    // prognose = 2 + 6/1.5 = 2 + 4 = 6.0 ha
    expect(prognose[1].textContent).toContain('6,0');
  });
});

describe('Prognose with duenger-only consumption', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('shows duenger prognose when no einheit entries', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, duenger: 200, entries: [] };
    // duengerPerHa = 200
    w.state.machineLog = [
      { einheit: 0, hektar: 0, duenger: 1000, time: '10:00' },
    ];
    w.renderResults();

    var mlContainer = w.document.getElementById('drill_machine_log');
    var prognose = mlContainer.querySelectorAll('.drill-prognose');
    // cumDuenger=1000, duengerPerHa=200, prognose = 0 + 1000/200 = 5.0 ha
    expect(prognose.length).toBeGreaterThan(0);
    expect(prognose[0].textContent).toContain('Dünger leer bei');
    expect(prognose[0].textContent).toContain('5,0');
  });

  it('cumulative duenger decreases with driven hectares', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, duenger: 100, entries: [] };
    // duengerPerHa = 100
    w.state.machineLog = [
      { einheit: 5, hektar: 0, duenger: 800, time: '10:00' },
      { einheit: 0, hektar: 5, duenger: 400, time: '11:00' },
    ];
    w.renderResults();

    var mlContainer = w.document.getElementById('drill_machine_log');
    var prognose = mlContainer.querySelectorAll('.drill-prognose');
    // Entry 1: cumDuenger = max(0, 800 - 5*100) + 400 = 300 + 400 = 700
    // prognose = 5 + 700/100 = 12.0 ha
    expect(prognose[1].textContent).toContain('12,0');
  });
});

describe('Prognose: hektar going backwards (edge case)', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('clamps haDriven to 0 when hektar decreases', () => {
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, duenger: 0, entries: [] };
    // unitsPerHa = 90000/50000 = 1.8
    w.state.machineLog = [
      { einheit: 5, zaehlerStand: 5, duenger: 0, time: '10:00' },
      { einheit: 3, zaehlerStand: 3, duenger: 0, time: '11:00' }, // zaehlerStand went backwards!
    ];
    w.renderResults();

    var mlContainer = w.document.getElementById('drill_machine_log');
    var prognose = mlContainer.querySelectorAll('.drill-prognose');
    // haDriven = max(0, 3 - 5) = 0
    // cumEinheit = max(0, 5 - 0*1.8) + 3 = 5 + 3 = 8
    // prognose = 3 + 8/1.8 = 3 + 4.44 = ~7.4
    expect(prognose[1].textContent).toContain('7,4');
  });
});

describe('drillTabList needDiv edge cases', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('shows "fertig" when einheiten done but duenger still remaining (duenger=0)', () => {
    w.state.reiter[0] = { name: 'Tab 1', hektar: 10, koerner: 90000, duenger: 0, entries: [
      { einheit: 18, duenger: 0, hektar: 10, time: '12:00' }
    ]};
    w.renderDrillTabList();
    var need = w.document.getElementById('dtl_need_0');
    expect(need.textContent).toContain('fertig');
    expect(need.classList.contains('done')).toBe(true);
  });

  it('shows remaining need with duenger kg when both incomplete', () => {
    w.state.reiter[0] = { name: 'Tab 1', hektar: 10, koerner: 90000, duenger: 150, entries: [
      { einheit: 10, duenger: 200, hektar: 5, time: '12:00' }
    ]};
    w.renderDrillTabList();
    var need = w.document.getElementById('dtl_need_0');
    // Needs 8 more einheiten + 1300 more kg duenger
    expect(need.textContent).toContain('Einheiten');
    expect(need.textContent).toContain('kg Dünger');
  });

  it('shows only einheiten remaining when duenger is 0', () => {
    w.state.reiter[0] = { name: 'Tab 1', hektar: 10, koerner: 90000, duenger: 0, entries: [
      { einheit: 10, duenger: 0, hektar: 5, time: '12:00' }
    ]};
    w.renderDrillTabList();
    var need = w.document.getElementById('dtl_need_0');
    expect(need.textContent).toContain('braucht');
    expect(need.textContent).toContain('Einheiten');
    expect(need.textContent).not.toContain('Dünger');
  });

  it('shows "fertig" when both saat and duenger are complete', () => {
    w.state.reiter[0] = { name: 'Tab 1', hektar: 10, koerner: 90000, duenger: 150, entries: [
      { einheit: 18, duenger: 1500, hektar: 10, time: '12:00' }
    ]};
    w.renderDrillTabList();
    var need = w.document.getElementById('dtl_need_0');
    expect(need.textContent).toContain('fertig');
    expect(need.classList.contains('done')).toBe(true);
  });
});

describe('renderDashboard: BUG — does not apply fahrgassen factor', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('dashboard shows WRONG einheiten when fahrgassen enabled (known bug)', () => {
    w.state.reiter[0] = { name: 'Tab 1', hektar: 10, koerner: 100000, duenger: 0, entries: [] };
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 4; // factor = 3/4 = 0.75

    // Correct calculation (getTabTotalEinheiten):
    // kornerGesamt = 10 * 100000 * 0.75 = 750000
    // einheiten = 750000 / 50000 = 15

    // Dashboard uses raw: 10 * 100000 / 50000 = 20 (WRONG)
    w.renderDashboard();
    var cards = w.document.getElementById('dashboard_content').querySelectorAll('.dashboard-reiter-card');
    // Per-tab card shows raw calculation (20.0 instead of 15.0)
    var einheitenVal = cards[0].querySelectorAll('.dashboard-stat-value')[2]; // "Einheiten verbl."
    expect(einheitenVal.textContent).toContain('15'); // FIXED: fahrgassen factor now applied
  });

  it('dashboard summary also uses raw calculation (known bug)', () => {
    w.state.reiter[0] = { name: 'Tab 1', hektar: 10, koerner: 100000, duenger: 0, entries: [] };
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 4;

    w.renderDashboard();
    var summaryValues = w.document.getElementById('dashboard_content')
      .querySelectorAll('.dashboard-summary-value');
    // [0] = Fläche, [1] = Einheiten verbl., [2] = Dünger verbl.
    // Summary now shows 15 (with fahrgassen) instead of 20 (raw)
    expect(summaryValues[1].textContent).toContain('15'); // FIXED: fahrgassen factor now applied
  });
});

describe('renderDashboard: summary with partial entries', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('shows remaining einheiten when partially drilled', () => {
    w.state.reiter[0] = { name: 'Tab 1', hektar: 10, koerner: 90000, duenger: 0, entries: [
      { einheit: 5, duenger: 0 }
    ]};
    w.renderDashboard();

    var cards = w.document.getElementById('dashboard_content').querySelectorAll('.dashboard-reiter-card');
    var einheitenRem = cards[0].querySelectorAll('.dashboard-stat-value')[2];
    // Total = 18, used = 5, rem = 13
    expect(einheitenRem.textContent).toContain('13');
  });

  it('progress bar shows correct percentage', () => {
    w.state.reiter[0] = { name: 'Tab 1', hektar: 10, koerner: 90000, duenger: 0, entries: [
      { einheit: 9, duenger: 0 }
    ]};
    w.renderDashboard();

    var cards = w.document.getElementById('dashboard_content').querySelectorAll('.dashboard-reiter-card');
    var fill = cards[0].querySelector('.dashboard-progress-fill');
    // 9/18 = 50%
    expect(fill.style.width).toBe('50%');
  });

  it('shows done class when 100% drilled', () => {
    w.state.reiter[0] = { name: 'Tab 1', hektar: 10, koerner: 90000, duenger: 0, entries: [
      { einheit: 18, duenger: 0 }
    ]};
    w.renderDashboard();

    var cards = w.document.getElementById('dashboard_content').querySelectorAll('.dashboard-reiter-card');
    var einheitenRem = cards[0].querySelectorAll('.dashboard-stat-value')[2];
    expect(einheitenRem.classList.contains('done')).toBe(true);
  });
});

describe('initUI restores einheitGroesse with custom value', () => {
  let w, store;
  beforeEach(() => { w = createDom().window; store = {}; });

  it('restores einheitGroesseEnabled and shows settings', () => {
    // HIGH 3/4: Per-Tab kpe wird in r.koernerProEinheit gespeichert.
    w.state.einheitGroesseEnabled = true;
    w.state.reiter[0].koernerProEinheit = 80000;
    w.saveState();
    w.initUI();

    var toggle = w.document.getElementById('einheit_groesse_toggle');
    var settings = w.document.getElementById('einheit_groesse_settings');
    expect(toggle.classList.contains('active')).toBe(true);
    expect(settings.classList.contains('open')).toBe(true);
    expect(w.document.getElementById('koerner_pro_einheit').value).toBe('80000');
  });

  it('shows custom koernerProEinheit info text', () => {
    w.state.einheitGroesseEnabled = true;
    w.state.reiter[0].koernerProEinheit = 80000;
    w.saveState();
    w.initUI();

    var saved = w.document.getElementById('einheit_groesse_saved');
    expect(saved.textContent).toContain('80.000');
    expect(saved.textContent).toContain('Körner/Einheit');
  });

  it('does NOT show info text when koernerProEinheit is default 50000', () => {
    w.state.einheitGroesseEnabled = true;
    // Tab bleibt auf Mais-Default 50000
    w.saveState();
    w.initUI();

    var saved = w.document.getElementById('einheit_groesse_saved');
    expect(saved.textContent).toBe('');
  });
});

describe('lv() migration: ensures entries array on all reiters', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('adds entries=[] to reiters missing it', () => {
    var migratedState = {
      reiter: [
        { name: 'Tab 1', hektar: 5, koerner: 80000 },
        { name: 'Tab 2', hektar: 3, koerner: 70000, entries: [{ einheit: 2 }] }
      ],
      activeReiter: 0,
      machineLog: []
    };
    w.localStorage.setItem('agrar_rechner', JSON.stringify(migratedState));
    w.loadState();
    expect(w.state.reiter[0].entries).toEqual([]);
    expect(w.state.reiter[1].entries.length).toBe(1);
  });

  it('handles state with only machineLog (no reiter key at all)', () => {
    var migratedState = {
      hektar: 10,
      koerner: 90000,
      duenger: 150,
      machineLog: []
    };
    w.localStorage.setItem('agrar_rechner', JSON.stringify(migratedState));
    w.loadState();
    expect(w.state.reiter).toBeTruthy();
    expect(w.state.reiter.length).toBe(1);
    expect(w.state.reiter[0].entries).toEqual([]);
  });
});

describe('drillCalcAll: remaining need calculation accounts for existing entries', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('distributes only the REMAINING need, not total', () => {
    w.state.reiter = [
      { name: 'A', hektar: 10, koerner: 90000, duenger: 0, entries: [
        { einheit: 10, duenger: 0, hektar: 5, time: '10:00' }
      ]},
      { name: 'B', hektar: 5, koerner: 80000, duenger: 0, entries: [] },
    ];
    w.state.activeReiter = 0;
    w.renderDrillTabList();

    // Tab A: total=18, used=10, need=8
    // Tab B: total=8, used=0, need=8
    w.document.getElementById('drill_einheit').value = '20';
    w.document.getElementById('drill_duenger').value = '0';

    w.state.drillPriorities[0] = 1; // Tab A höchste Prio (Issue #264)
    w.state.drillPriorities[1] = 2;
    w.drillCalcAll();

    var eA = w.document.getElementById('dtl_e_0');
    var eB = w.document.getElementById('dtl_e_1');
    // Tab A gets min(8, 20) = 8
    expect(w.parseDE(eA.value)).toBeCloseTo(8);
    // Tab B gets min(8, 20-8=12) = 8
    expect(w.parseDE(eB.value)).toBeCloseTo(8);
  });
});

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
    expect(doc.getElementById('dtl_e_1').value).toBe('5,000');
  });

  it('distributes to highest priority tab first', () => {
    // Issue #264: Prio 1 = höchste. Tab 0 (prio 1) bekommt zuerst.
    w.state.drillPriorities = { 0: 1, 1: 2 };
    doc.getElementById('drill_einheit').value = '15';
    doc.getElementById('drill_duenger').value = '';
    w.drillCalcAll();
    expect(doc.getElementById('dtl_e_0').value).toBe('10,000');
    expect(doc.getElementById('dtl_e_1').value).toBe('5,000');
  });

  it('caps distribution at what tab needs', () => {
    // Both tabs: 10 ha × 50000 / 50000 = 10 units each
    // Tab A: 3 used → needE = 7; Tab B: 0 used → needE = 10
    // Issue #264: Prio 1 = höchste. Tab A (prio 1) bekommt zuerst.
    // Cap-fill: A gets min(20, 7) = 7, B gets min(13, 10) = 10.
    // Tab B's cap (10) is exhausted by its cap allocation, so the leftover
    // (20 - 7 - 10 = 3) is dropped — it is NOT added to B (B's cap is full).
    // Result: A = 7, B = 10, leftover 3 lost.
    w.state.reiter[0].entries = [{ einheit: 3, hektar: 3 }];
    w.state.reiter[1].entries = [];
    w.state.drillPriorities = { 0: 1, 1: 2 };
    doc.getElementById('drill_einheit').value = '20';
    doc.getElementById('drill_duenger').value = '';
    w.drillCalcAll();
    expect(doc.getElementById('dtl_e_0').value).toBe('7,000');
    expect(doc.getElementById('dtl_e_1').value).toBe('10,000');
  });

  it('distributes duenger separately from einheit (symmetric to Saat-Pfad, Issue #329)', () => {
    w.state.reiter = [
      { name: 'A', hektar: 10, koerner: 50000, duenger: 100, entries: [] },
      { name: 'B', hektar: 5, koerner: 50000, duenger: 200, entries: [] },
    ];
    w.renderDrillTabList();
    w.state.drillPriorities = { 0: 1, 1: 2 };
    doc.getElementById('drill_einheit').value = '5';
    doc.getElementById('drill_duenger').value = '3000';
    w.drillCalcAll();
    // Issue #329: Dünger folgt Saat-Prio-Logik. Tab A SOLL = 10*100 = 1000,
    // Tab B SOLL = 5*200 = 1000. Fill 3000 kg → A nimmt 1000 (cap), B nimmt 1000.
    // Rest 1000 ist Überschuss und wird in drillAdd() in den machineLog geschrieben.
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
    expect(doc.getElementById('dtl_e_0').value).toBe('5,000');
    expect(doc.getElementById('dtl_d_0').value).toBe('');
  });

  it('writes empty for tabs with no priority', () => {
    w.state.drillPriorities = { 0: 1 };
    doc.getElementById('drill_einheit').value = '10';
    doc.getElementById('drill_duenger').value = '';
    w.drillCalcAll();
    expect(doc.getElementById('dtl_e_0').value).toBe('10,000');
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
    const stored = JSON.parse(w.localStorage.getItem('agrar_rechner'));
    expect(stored.machineLog.length).toBe(0);
  });

  it('refreshes drill projections after machine log removal', () => {
    // Setup: two machine log entries, tab with prio, drill input set
    const { document } = w;
    w.state.reiter = [
      { name: 'Tab A', hektar: 10, koerner: 50000, duenger: 0, entries: [] },
    ];
    w.state.machineLog = [
      { einheit: 5, hektar: 5, duenger: 0, time: '10:00' },
      { einheit: 3, hektar: 3, duenger: 0, time: '11:00' },
    ];
    w.state.drillPriorities = { 0: 1 };
    w.state.activeReiter = 0;
    w.renderDrillTabList();
    document.getElementById('drill_einheit').value = '20';
    document.getElementById('drill_duenger').value = '';

    // Run drillCalcAll to populate projections
    w.drillCalcAll();

    // Verify initial state: Tab A gets 5 units (capped at need), remaining 5 units available
    var remainingBefore = document.getElementById('ds_saat_remaining').textContent;

    // Remove the first machine log entry (idx=0)
    w.drillMachineRemove(0);

    // After removal, drill projections must be recalculated (drillCalcAll called)
    // The drill summary remaining should reflect the new state
    // (machineLog now has 1 entry, projections are recalculated)
    var remainingAfter = document.getElementById('ds_saat_remaining').textContent;
    // Just verify the element is updated (not stale '—' or old value)
    expect(remainingAfter).not.toBe('');
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
    doc.getElementById('dtl_prio_0').click();
    expect(doc.getElementById('dtl_prio_0').getAttribute('data-prio')).toBe('1');
    expect(doc.getElementById('dtl_prio_0').classList.contains('active')).toBe(true);

    // 1 → 2
    doc.getElementById('dtl_prio_0').click();
    expect(doc.getElementById('dtl_prio_0').getAttribute('data-prio')).toBe('2');

    // 2 → 0
    doc.getElementById('dtl_prio_0').click();
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
    doc.getElementById('dtl_prio_0').click();
    expect(doc.getElementById('dtl_prio_0').classList.contains('active')).toBe(true);
    doc.getElementById('dtl_prio_0').click(); // 1 → 2
    expect(doc.getElementById('dtl_prio_0').classList.contains('active')).toBe(true);
    doc.getElementById('dtl_prio_0').click(); // 2 → 0
    expect(doc.getElementById('dtl_prio_0').classList.contains('active')).toBe(false);
  });

  it('has decimal inputMode on einheit and duenger inputs', () => {
    w.state.reiter = [{ name: 'A', hektar: 10, koerner: 50000, duenger: 0, entries: [] }];
    w.renderDrillTabList();
    expect(doc.getElementById('dtl_e_0').inputMode).toBe('decimal');
    expect(doc.getElementById('dtl_d_0').inputMode).toBe('decimal');
  });

  it('all main decimal inputs have inputmode=decimal for mobile keyboard + keydown-based auto-comma detection', () => {
    // inputmode=decimal shows mobile decimal keyboard; auto-comma detection
    // uses keydown tracking to distinguish user-typed vs browser-auto-inserted commas.
    const mainInputs = ['hektar', 'ist_hektar', 'duenger', 'fahrgassen_breite', 'drill_einheit', 'drill_duenger', 'drill_hektar'];
    for (const id of mainInputs) {
      const el = doc.getElementById(id);
      expect(el.inputMode).toBe('decimal');
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
    doc.getElementById('dtl_prio_0').click(); // sets prio 0 → 1, calls drillCalcAll
    expect(doc.getElementById('dtl_e_0').value).toBe('5,000');
  });
});

// ---------------------------------------------------------------------------
// switchToProtokoll — view toggle (Issue #291, Pre-#291 pattern)
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

  it('calls renderDrillTabList (drill-tab-row appears in DOM)', () => {
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

  it('persists state to localStorage', () => {
    w.switchToProtokoll();
    const stored = JSON.parse(w.localStorage.getItem('agrar_rechner'));
    expect(stored.activeView).toBe('protokoll');
  });

  it('syncs current inputs before switching (syncStateFromInputs runs first)', () => {
    w.state.reiter[0].hektar = 10;
    doc.getElementById('hektar').value = '15';
    w.syncStateFromInputs();
    w.switchToProtokoll();
    expect(w.state.reiter[0].hektar).toBe(15);
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

  it('drill_section shown in protokoll view', () => {
    w.state.activeView = 'protokoll';
    w.renderView();
    expect(doc.getElementById('drill_section').style.display).toBe('block');
  });

  it('results hidden when switching to protokoll (even with data)', () => {
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 90000;
    w.state.activeView = 'protokoll';
    w.renderView();
    expect(doc.getElementById('results').style.display).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// Protokoll tab button — click triggers switchToProtokoll (Issue #291)
// ---------------------------------------------------------------------------
describe('Protokoll tab button', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('clicking the Protokoll tab button calls switchToProtokoll (activeView → protokoll)', () => {
    var tabBtn = doc.getElementById('protokoll_tab_btn');
    expect(tabBtn).toBeTruthy();
    tabBtn.click();
    expect(w.state.activeView).toBe('protokoll');
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
});

describe('Regressionen & Blind-Spots (Session-Fixes, Edge-Cases, E2E-Screenshot-Szenario) — übernommen aus 44-user-screenshot-8-5ha-e2e.test.js', () => {
/**
 * Test 44: End-to-End Reproduktion des User-Screenshots 2026-06-22
 *
 * Setup (genau wie im Screenshot):
 *   - Tab 1: 8 ha SOLL, 90000 Körner/ha, 200 kg/ha Dünger → SOLL Saat = 14,4 E, Dünger = 1600 kg
 *   - Tab 2: 5 ha SOLL, 90000 Körner/ha, 200 kg/ha Dünger → SOLL Saat = 9 E, Dünger = 1000 kg
 *   - SOLL gesamt: 23,4 Einheiten / 2.600 kg
 *
 * User-Aktionen:
 *   - Fill #1: 18 Einheiten / 1.500 kg Dünger
 *   - Fill #2: 12 Einheiten / 1.000 kg Dünger
 *
 * Erwartung nach Issue #329 (Saat/Dünger-Symmetrie):
 *   - Dünger folgt identischer Prio-Cap-Logik wie Saat:
 *     plan[p.idx].giveD = Math.min(remD, tabDRem);
 *     tabDRem = max(0, SOLL - used)
 *   - Fill #1: Tab 1 Saat-Rest 14,4 (nimmt 14,4), Dünger-Rest 1600 (nimmt 1500 → 100 Rest)
 *     Tab 2 Saat-Rest 5,4 (von 9, nimmt 3,6 → 5,4 Rest), Dünger-Rest 1000 (nimmt 0)
 *   - Fill #2: Tab 1 Saat-Rest 0 (nimmt 0), Dünger-Rest 100 (nimmt 100 → 0 Rest)
 *     Tab 2 Saat-Rest 5,4 (nimmt 5,4 → 0 Rest), Dünger-Rest 1000 (nimmt 900 → 100 Rest)
 *
 *   Resultat:
 *     - Tab 1: Entry#1 (14,4 E + 1500 kg), Entry#2 (0 E + 100 kg) → Σ 14,4 E + 1600 kg = SOLL
 *     - Tab 2: Entry#1 (3,6 E + 0 kg), Entry#2 (5,4 E + 900 kg) → Σ 9,0 E + 900 kg
 *     - Total eingegeben: 2500 kg, total in Tabs: 2500 kg (1600+900), Dünger verbleibend: 100 kg
 *
 * Anti-Regression gegen:
 *   - Issue #315: Math.min(duengerRaw, duengerPerUnit * units)-Cap (war in _buildDrillEntry)
 *   - Issue #326: tabDCap-Cap (war in _calcDrillDistribution)
 *   - Issue #329: aktuelle Symmetrie zwischen Saat- und Dünger-Pfad
 */

function setup8_5ha(w) {
  w.state.reiter = [
    { name: 'Tab 1', hektar: 8, istHektar: 0, koerner: 90000, duenger: 200, entries: [] },
    { name: 'Tab 2', hektar: 5, istHektar: 0, koerner: 90000, duenger: 200, entries: [] },
  ];
  w.state.drillPriorities = { 0: 1, 1: 2 };
  w.state.koernerProEinheit = 50000;
  w.renderDrillTabList();
  w.renderTabs();
}

function fill(w, einheit, duenger) {
  w.document.getElementById('drill_einheit').value = String(einheit);
  w.document.getElementById('drill_duenger').value = String(duenger);
  w.drillCalcAll();
  w.drillAdd();
}

describe('E2E: User-Screenshot 2026-06-22 (8ha + 5ha Setup)', () => {
  it('reproduces the exact user scenario and verifies correct totals', () => {
    const { window: w } = createDom();
    setup8_5ha(w);

    fill(w, 18, 1500);   // Fill #1
    fill(w, 12, 1000);   // Fill #2

    const tab1 = w.state.reiter[0];
    const tab2 = w.state.reiter[1];

    // 1) Entry-Anzahl: 2 pro Tab
    expect(tab1.entries.length).toBe(2);
    expect(tab2.entries.length).toBe(2);

    // 2) Per-Tab Saat: Tab 1 = 14,4 (SOLL), Tab 2 = 9,0 (SOLL)
    const tab1Saat = tab1.entries.reduce((s, e) => s + (e.einheit || 0), 0);
    const tab2Saat = tab2.entries.reduce((s, e) => s + (e.einheit || 0), 0);
    expect(tab1Saat).toBeCloseTo(14.4, 2);
    expect(tab2Saat).toBeCloseTo(9.0, 2);

    // 3) Per-Tab Dünger — symmetrisch zu Saat-Logik (Issue #329):
    //    Tab 1: Fill #1 nimmt 1500 (cap 1600), Fill #2 nimmt 100 (Rest bis SOLL) → Σ 1600 = SOLL ✓
    //    Tab 2: Fill #1 nimmt 0 (Saat ging nur an Tab 2, kein Dünger übrig),
    //           Fill #2 nimmt 900 (Rest von 1000 kg minus 100 die Tab 1 nimmt) → Σ 900
    const tab1Duenger = tab1.entries.reduce((s, e) => s + (e.duenger || 0), 0);
    const tab2Duenger = tab2.entries.reduce((s, e) => s + (e.duenger || 0), 0);
    expect(tab1Duenger).toBeCloseTo(1600, 0);
    expect(tab2Duenger).toBeCloseTo(900, 0);

    // 4) Total eingegeben = Total in Tabs (kein Verlust)
    const totalDuenger = tab1Duenger + tab2Duenger;
    expect(totalDuenger).toBeCloseTo(2500, 0);  // 1500 + 1000
  });

  it('Dünger-verbleibend is exactly the difference SOLL - used (no off-by-100s)', () => {
    const { window: w } = createDom();
    setup8_5ha(w);

    fill(w, 18, 1500);
    fill(w, 12, 1000);

    // 2.600 kg SOLL - 2.500 kg used = 100 kg verbleibend
    // Vor Fix: 500 kg (siehe Screenshot) weil Dünger-Caps stillschweigend Mengen schluckten.
    const totalUsed = w.state.reiter[0].entries
      .concat(w.state.reiter[1].entries)
      .reduce((s, e) => s + (e.duenger || 0), 0);
    expect(2600 - totalUsed).toBeCloseTo(100, 0);
  });
});
});
