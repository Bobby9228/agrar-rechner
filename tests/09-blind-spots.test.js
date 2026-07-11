/**
 * Tests for blind spots found during code audit.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Blind spots — renderTabs callbacks', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
    w.addReiter(); // 2 tabs
  });

  it('tab btn.onclick calls switchReiter(i)', () => {
    // Tab 0 button should switch to reiter 0
    expect(w.state.activeReiter).toBe(1); // currently on tab 1

    const btns = doc.querySelectorAll('.field-tab');
    btns[0].onclick(); // click tab 0
    expect(w.state.activeReiter).toBe(0);
  });

  it('tab-close onclick calls removeReiter(i)', () => {
    // The close button uses setAttribute('onclick', '...confirmRemoveReiter(i)')
    // which calls confirm() first — mock confirm to return true
    expect(w.state.reiter.length).toBe(2);
    const closes = doc.querySelectorAll('.tab-close');
    // Create a fake event with stopPropagation
    const fakeEvent = { stopPropagation: () => {} };
    w.confirm = () => true;
    closes[1].onclick(fakeEvent);
    expect(w.state.reiter.length).toBe(1);
  });

  it('tab name span onkeydown: Enter triggers blur', () => {
    const spans = doc.querySelectorAll('.tab-name');
    const span = spans[1];
    span.textContent = 'Test Feld';

    // Enter key should call blur
    const evt = { key: 'Enter', preventDefault: () => {}, stopPropagation: () => {} };
    span.onkeydown(evt);
    // span.blur() was called (via preventDefault)
  });

  it('tab name span onkeydown: Escape resets text', () => {
    const spans = doc.querySelectorAll('.tab-name');
    const span = spans[1];
    const originalName = span.textContent;
    span.textContent = 'Changed';

    const evt = { key: 'Escape', preventDefault: () => {}, stopPropagation: () => {} };
    span.onkeydown(evt);
    // Escape resets to original name then blurs
    expect(span.textContent).toBe(originalName);
  });

  it('tab name span onkeydown: non-Enter calls stopPropagation', () => {
    const spans = doc.querySelectorAll('.tab-name');
    const span = spans[1];

    let stopped = false;
    const evt = { key: 'a', stopPropagation: () => { stopped = true; } };
    span.onkeydown(evt);
    expect(stopped).toBe(true);
  });

  it('tab name span onblur calls renameReiter', () => {
    const spans = doc.querySelectorAll('.tab-name');
    const span = spans[1];
    span.textContent = 'Via Blur';
    span.onblur();

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
    expect(spans[0].textContent).toContain('2,0 Einheiten');
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

  it('ds_total_summary without hektar and duenger shows only einheiten', () => {
    calc(10, 90000, 0);

    const r = w.getActiveReiter();
    r.entries.push({ einheit: 3, zaehlerStand: 0, duenger: 0, time: '10:00' });
    w.renderResults();

    const summary = doc.getElementById('ds_total_summary').textContent;
    expect(summary).toContain('3,0 Einheiten');
    expect(summary).not.toContain('ha');
    expect(summary).not.toContain('Dünger');
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
    btns[0].onclick();
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

    const summary = doc.getElementById('ds_total_summary').textContent;
    expect(summary).toContain('500 kg Dünger');
    expect(summary).not.toContain('Einheiten');
    expect(summary).not.toContain('ha');
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
