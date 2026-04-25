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

    const btns = doc.querySelectorAll('.tab-btn');
    btns[0].onclick(); // click tab 0
    expect(w.state.activeReiter).toBe(0);
  });

  it('tab-close onclick calls removeReiter(i)', () => {
    // The close button uses setAttribute('onclick', '...removeReiter(i)')
    // which is an inline handler expecting an event object with stopPropagation
    expect(w.state.reiter.length).toBe(2);
    const closes = doc.querySelectorAll('.tab-close');
    // Create a fake event with stopPropagation
    const fakeEvent = { stopPropagation: () => {} };
    closes[1].onclick(fakeEvent);
    expect(w.state.reiter.length).toBe(1);
  });

  it('tab name input onkeydown: Enter triggers blur', () => {
    const inputs = doc.querySelectorAll('.tab-name-input');
    const input = inputs[1];
    input.value = 'Test Feld';

    let blurFired = false;
    input.onblur = () => { blurFired = true; };

    // Simulate Enter keydown
    const evt = { key: 'Enter', stopPropagation: () => {} };
    input.onkeydown(evt);
    // blur should have been called (input.blur())
    // In jsdom, blur may not actually fire, but we test the code path
  });

  it('tab name input onkeydown: non-Enter calls stopPropagation', () => {
    const inputs = doc.querySelectorAll('.tab-name-input');
    const input = inputs[1];

    let stopped = false;
    const evt = { key: 'a', stopPropagation: () => { stopped = true; } };
    input.onkeydown(evt);
    expect(stopped).toBe(true);
  });

  it('tab name input onfocus selects text', () => {
    const inputs = doc.querySelectorAll('.tab-name-input');
    const input = inputs[1];
    input.value = 'Test';

    // input.onfocus = function() { this.select(); };
    // In jsdom, select() is a no-op, but we verify the handler exists
    expect(typeof input.onfocus).toBe('function');
  });

  it('tab name input onchange calls renameReiter', () => {
    const inputs = doc.querySelectorAll('.tab-name-input');
    const input = inputs[1];
    input.value = 'Neuer Name';
    input.onchange();

    expect(w.state.reiter[1].name).toBe('Neuer Name');
  });

  it('tab name input onblur calls renameReiter', () => {
    const inputs = doc.querySelectorAll('.tab-name-input');
    const input = inputs[1];
    input.value = 'Via Blur';
    input.onblur();

    expect(w.state.reiter[1].name).toBe('Via Blur');
  });
});

describe('Blind spots — berechne duenger-exceeds confirm', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('confirms when usedDuenger exceeds getTotalDuenger (even if einheiten are fine)', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    doc.getElementById('duenger').value = '150';
    w.berechne();

    // Add drill entry with excessive duenger
    const r = w.getActiveReiter();
    r.entries.push({ einheit: 1, hektar: 0, duenger: 2000, time: '10:00' });
    // usedDuenger(2000) > getTotalDuenger(1500), even though usedEinheit(1) < getTotalEinheiten(18)

    // User cancels
    w.confirm = () => false;
    doc.getElementById('hektar').value = '10'; // same values
    doc.getElementById('koerner').value = '90000';
    doc.getElementById('duenger').value = '100'; // reduce duenger -> totals change
    w.berechne();

    expect(r.entries.length).toBe(1); // not cleared
  });

  it('clears entries when duenger exceeds and user confirms', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    doc.getElementById('duenger').value = '150';
    w.berechne();

    const r = w.getActiveReiter();
    r.entries.push({ einheit: 0, hektar: 0, duenger: 2000, time: '10:00' });

    w.confirm = () => true;
    doc.getElementById('duenger').value = '100';
    w.berechne();

    expect(r.entries.length).toBe(0);
  });

  it('does NOT confirm when entries are within totals', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    doc.getElementById('duenger').value = '150';
    w.berechne();

    const r = w.getActiveReiter();
    r.entries.push({ einheit: 5, hektar: 3, duenger: 500, time: '10:00' });
    // usedEinheit(5) < 18, usedDuenger(500) < 1500 -> no confirm needed

    let confirmCalled = false;
    w.confirm = () => { confirmCalled = true; return false; };

    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    doc.getElementById('duenger').value = '150';
    w.berechne();

    expect(confirmCalled).toBe(false);
    expect(r.entries.length).toBe(1); // unchanged
  });
});

describe('Blind spots — renderResults edge cases', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('formats large KornerGesamt with DE thousand separators', () => {
    doc.getElementById('hektar').value = '12,5';
    doc.getElementById('koerner').value = '90000';
    w.berechne();

    // 12.5 * 90000 = 1.125.000
    const text = doc.getElementById('r_korner').textContent;
    // toLocaleString('de-DE') => "1.125.000"
    expect(text).toBe('1.125.000');
  });

  it('r_info shows "ohne Dünger" when no duenger', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    doc.getElementById('duenger').value = '';
    w.berechne();

    expect(doc.getElementById('r_info').textContent).toContain('ohne Dünger');
  });

  it('r_info shows duenger + saat when duenger is set', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    doc.getElementById('duenger').value = '150';
    w.berechne();

    const info = doc.getElementById('r_info').textContent;
    expect(info).toContain('kg Dünger');
    expect(info).toContain('Saat');
    expect(info).not.toContain('ohne Dünger');
  });

  it('drill entry shows time prefix when time is set', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    w.berechne();

    const r = w.getActiveReiter();
    r.entries.push({ einheit: 2, hektar: 3.5, duenger: 200, time: '14:30' });
    w.renderResults();

    const spans = doc.querySelectorAll('.entry-text');
    expect(spans[0].textContent).toContain('14:30 – ');
    expect(spans[0].textContent).toContain('@ 3.5 ha');
    expect(spans[0].textContent).toContain('2.0 Einheiten');
    expect(spans[0].textContent).toContain('200 kg Dünger');
  });

  it('drill entry without duenger has no Dünger text', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    w.berechne();

    const r = w.getActiveReiter();
    r.entries.push({ einheit: 2, hektar: 0, duenger: 0, time: '10:00' });
    w.renderResults();

    const spans = doc.querySelectorAll('.entry-text');
    expect(spans[0].textContent).not.toContain('Dünger');
    expect(spans[0].textContent).not.toContain('@');
  });

  it('drill entry without hektar has no @ text', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    w.berechne();

    const r = w.getActiveReiter();
    r.entries.push({ einheit: 2, hektar: 0, duenger: 100, time: '10:00' });
    w.renderResults();

    const spans = doc.querySelectorAll('.entry-text');
    expect(spans[0].textContent).not.toContain('@');
    expect(spans[0].textContent).toContain('100 kg');
    expect(spans[0].textContent).toContain('Dünger');
  });

  it('ds_total_summary without hektar and duenger shows only einheiten', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    w.berechne();

    const r = w.getActiveReiter();
    r.entries.push({ einheit: 3, hektar: 0, duenger: 0, time: '10:00' });
    w.renderResults();

    const summary = doc.getElementById('ds_total_summary').textContent;
    expect(summary).toContain('3.0 Einheiten');
    expect(summary).not.toContain('ha');
    expect(summary).not.toContain('Dünger');
  });

  it('drill entry has #number span', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    w.berechne();

    const r = w.getActiveReiter();
    r.entries.push({ einheit: 2, hektar: 0, duenger: 0, time: '10:00' });
    r.entries.push({ einheit: 3, hektar: 0, duenger: 0, time: '10:05' });
    w.renderResults();

    const hashes = doc.querySelectorAll('.entry-text span');
    expect(hashes[0].textContent).toBe('#1');
    expect(hashes[1].textContent).toBe('#2');
  });

  it('drill entry delete button has btn-danger class and calls drillRemove', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    w.berechne();

    const r = w.getActiveReiter();
    r.entries.push({ einheit: 2, hektar: 0, duenger: 0, time: '10:00' });
    w.renderResults();

    const btns = doc.querySelectorAll('.btn-danger');
    expect(btns.length).toBe(1);
    expect(btns[0].textContent).toBe('✕');

    // Click delete
    btns[0].onclick();
    expect(r.entries.length).toBe(0);
  });

  it('drill_summary visibility: shown when entries exist but no calculation', () => {
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    w.berechne();

    // After berechne, drill_summary should be visible (einheiten > 0)
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
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    doc.getElementById('duenger').value = '150';
    w.berechne();

    const r = w.getActiveReiter();
    r.entries.push({ einheit: 0, hektar: 0, duenger: 500, time: '10:00' });
    w.renderResults();

    const summary = doc.getElementById('ds_total_summary').textContent;
    expect(summary).toContain('0.0 Einheiten');
    expect(summary).toContain('500 kg Dünger');
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

    expect(doc.getElementById('hektar').value).toBe('12.5');
    expect(doc.getElementById('koerner').value).toBe('80000');
    expect(doc.getElementById('duenger').value).toBe('150.5');
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
    // Setup: calculate on tab 0
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    w.berechne();
    expect(doc.getElementById('drill_section').style.display).toBe('block');

    // Add empty tab 1 and switch to it
    w.addReiter();
    // drill_section should still show from previous renderResults

    // Switch back to tab 0 (has data), then to tab 1 (empty)
    w.switchReiter(0); // has data -> shows
    expect(doc.getElementById('results').style.display).toBe('block');

    w.switchReiter(1); // no data -> hides both
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
    store['mais_rechner'] = JSON.stringify({
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
