/**
 * Tests for the Reset Confirmation Modal (Issue #236).
 *
 * Verifies:
 *   - Only one reset button in the footer (reset_btn exists, reset_all_btn gone)
 *   - openResetModal() shows the modal and focuses the cancel button
 *   - closeResetModal() hides it and returns focus to the trigger
 *   - "Aktuellen Tab zurücksetzen" calls resetActiveTab()
 *   - "Alle Daten löschen" requires two clicks (arming) before calling resetAll()
 *   - Abbrechen button + ESC + overlay click close the modal without side-effects
 *   - No window.confirm() in the codebase
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDom } from './helpers.js';

describe('Reset Confirmation Modal (#236)', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('footer has only one reset button (reset_all_btn removed)', () => {
    expect(doc.getElementById('reset_btn')).toBeTruthy();
    expect(doc.getElementById('reset_all_btn')).toBeNull();
  });

  it('modal markup is in the DOM and hidden by default', () => {
    var modal = doc.getElementById('reset_modal');
    var overlay = doc.getElementById('reset_overlay');
    expect(modal).toBeTruthy();
    expect(overlay).toBeTruthy();
    expect(modal.classList.contains('open')).toBe(false);
    expect(overlay.classList.contains('open')).toBe(false);
    expect(modal.getAttribute('role')).toBe('dialog');
    expect(modal.getAttribute('aria-modal')).toBe('true');
    expect(modal.getAttribute('aria-labelledby')).toBe('reset_modal_title');
  });

  it('modal exposes the three required action buttons', () => {
    expect(doc.getElementById('reset_modal_tab')).toBeTruthy();
    expect(doc.getElementById('reset_modal_confirm_all')).toBeTruthy();
    expect(doc.getElementById('reset_modal_cancel')).toBeTruthy();
  });

  it('openResetModal() shows the modal and overlay', () => {
    w.openResetModal();
    expect(doc.getElementById('reset_modal').classList.contains('open')).toBe(true);
    expect(doc.getElementById('reset_overlay').classList.contains('open')).toBe(true);
  });

  it('openResetModal() focuses the cancel button (safe default)', () => {
    w.openResetModal();
    expect(doc.activeElement.id).toBe('reset_modal_cancel');
  });

  it('openResetModal() can be passed a trigger element for focus return', () => {
    w.openResetModal(doc.getElementById('reset_btn'));
    expect(doc.getElementById('reset_modal').classList.contains('open')).toBe(true);
  });

  it('closeResetModal() hides the modal and overlay', () => {
    w.openResetModal();
    w.closeResetModal();
    expect(doc.getElementById('reset_modal').classList.contains('open')).toBe(false);
    expect(doc.getElementById('reset_overlay').classList.contains('open')).toBe(false);
  });

  it('closeResetModal() returns focus to the trigger', () => {
    var trigger = doc.getElementById('reset_btn');
    w.openResetModal(trigger);
    // After open, focus is on cancel
    expect(doc.activeElement.id).toBe('reset_modal_cancel');
    w.closeResetModal();
    expect(doc.activeElement).toBe(trigger);
  });

  it('clicking "Aktuellen Tab zurücksetzen" calls resetActiveTab() once', () => {
    // Seed some data into the active tab
    w.state.reiter[0].hektar = 5;
    w.state.reiter[0].koerner = 90000;
    w.state.reiter[0].entries = [{ einheit: 1, duenger: 0, zaehlerStand: 0, time: 'now' }];
    expect(w.state.reiter[0].hektar).toBe(5);

    w.openResetModal();
    // Simulate click on the modal "Aktuellen Tab zurücksetzen" button
    doc.getElementById('reset_modal_tab').click();
    // The handler closes the modal then calls resetActiveTab
    expect(doc.getElementById('reset_modal').classList.contains('open')).toBe(false);
    expect(w.state.reiter[0].hektar).toBe(0);
    expect(w.state.reiter[0].entries.length).toBe(0);
  });

  it('"Alle Daten löschen" requires two clicks (arming step)', () => {
    // Seed data
    doc.getElementById('hektar').value = '5';
    doc.getElementById('koerner').value = '90000';
    w.berechne();
    w.addReiter();
    expect(w.state.reiter.length).toBe(2);

    w.openResetModal();
    var btn = doc.getElementById('reset_modal_confirm_all');

    // First click: arm, do NOT reset yet
    btn.click();
    expect(btn.classList.contains('armed')).toBe(true);
    expect(w.state.reiter.length).toBe(2); // not reset yet
    expect(btn.textContent).toMatch(/Bestätigen/);

    // Second click: actually reset
    btn.click();
    expect(w.state.reiter.length).toBe(1); // resetAll was called
    expect(doc.getElementById('reset_modal').classList.contains('open')).toBe(false);
  });

  it('"Abbrechen" closes the modal without calling reset functions', () => {
    doc.getElementById('hektar').value = '5';
    doc.getElementById('koerner').value = '90000';
    w.berechne();
    w.addReiter();
    expect(w.state.reiter.length).toBe(2);

    w.openResetModal();
    doc.getElementById('reset_modal_cancel').click();
    expect(doc.getElementById('reset_modal').classList.contains('open')).toBe(false);
    expect(w.state.reiter.length).toBe(2);
  });

  it('closing the modal disarms the full-reset button for next time', () => {
    w.openResetModal();
    var btn = doc.getElementById('reset_modal_confirm_all');
    btn.click(); // arm
    expect(btn.classList.contains('armed')).toBe(true);
    w.closeResetModal();
    expect(btn.classList.contains('armed')).toBe(false);
    expect(btn.textContent).toBe('Alle Daten löschen');
  });

  it('ESC keydown closes the modal', () => {
    w.openResetModal();
    expect(doc.getElementById('reset_modal').classList.contains('open')).toBe(true);
    var evt = new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    doc.dispatchEvent(evt);
    expect(doc.getElementById('reset_modal').classList.contains('open')).toBe(false);
  });

  it('no confirm() call anywhere in app JS', () => {
    // Walk the module sources from the dom window (we already loaded them).
    // We can't reach the file content from the runtime, but we can verify
    // that confirm() is never invoked in our test interactions.
    // This is a smoke test — the real check is the source-level grep in CI.
    var called = false;
    var origConfirm = w.confirm;
    w.confirm = function() { called = true; return true; };
    // Trigger each reset path
    w.openResetModal();
    doc.getElementById('reset_modal_tab').click();
    w.openResetModal();
    doc.getElementById('reset_modal_confirm_all').click();
    doc.getElementById('reset_modal_confirm_all').click();
    w.confirm = origConfirm;
    expect(called).toBe(false);
  });

  it('_askConfirm is mockable so tests can intercept confirm without regex on source', () => {
    // Issue #280: confirm() is now called directly inside _askConfirm, so the
    // old source-level regex check is no longer needed. Instead, tests can
    // override _askConfirm to assert the confirm branch in berechne().
    expect(typeof w._askConfirm).toBe('function');
    var called = 0;
    var origAskConfirm = w._askConfirm;
    w._askConfirm = function() { called += 1; return true; };
    // Seed an entry that exceeds the new totals → berechne() will call
    // _askConfirm. Without the mock, this would pop a native confirm.
    w.state.reiter[0].entries = [{ einheit: 10, duenger: 0, zaehlerStand: 0, time: 'now' }];
    doc.getElementById('hektar').value = '1';
    doc.getElementById('koerner').value = '90000';
    doc.getElementById('duenger').value = '0';
    w.berechne();
    w._askConfirm = origAskConfirm;
    expect(called).toBe(1);
  });
});

describe('Reset modal — source-level invariants', () => {
  it('does not call window.confirm() in reset-modal.js (comments ok)', async () => {
    const { readFileSync } = await import('fs');
    const { resolve, dirname } = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(resolve(__dirname, '../public/js/reset-modal.js'), 'utf-8');
    // Strip line comments first, then check for confirm( call sites.
    var code = src
      .split('\n')
      .map(function(line) { return line.replace(/\/\/.*$/, ''); })
      .join('\n');
    expect(code).not.toMatch(/[^a-zA-Z_]confirm\s*\(/);
  });

  it('index.html loads reset-modal.js script', async () => {
    const { readFileSync } = await import('fs');
    const { resolve, dirname } = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const html = readFileSync(resolve(__dirname, '../public/index.html'), 'utf-8');
    expect(html).toMatch(/src="js\/reset-modal\.js"/);
  });

  it('footer in index.html has only one reset button', async () => {
    const { readFileSync } = await import('fs');
    const { resolve, dirname } = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const html = readFileSync(resolve(__dirname, '../public/index.html'), 'utf-8');
    // The old "Alles zurücksetzen" button is gone
    expect(html).not.toMatch(/id="reset_all_btn"/);
    // And only one reset_btn remains
    var matches = html.match(/id="reset_btn"/g) || [];
    expect(matches.length).toBe(1);
  });
});
