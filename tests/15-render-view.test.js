/**
 * Tests for the Protokoll-Sheet (Issue #291) — openProtokoll / closeProtokoll.
 *
 * Note: The old per-view renderer and the per-view state field that lived
 * in `w.state` were removed in the sheet-architecture refactor (the
 * Protokoll tab is now a slide-in sheet with an overlay). openProtokoll()
 * and closeProtokoll() in public/js/render-drill.js drive the sheet.
 *
 * This file covers sheet open/close semantics. Visibility of inner elements
 * (drill_section, results, sticky footer) is covered by tests/22-protocol-view.test.js
 * and the regular render-* tests.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

function getSheet(w) { return w.document.getElementById('protokoll_sheet'); }
function getOverlay(w) { return w.document.getElementById('protokoll_overlay'); }

describe('Protokoll sheet open/close', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('is closed by default on a fresh page', () => {
    expect(getSheet(w).classList.contains('open')).toBe(false);
    expect(getOverlay(w).classList.contains('open')).toBe(false);
  });

  it('openProtokoll() adds .open to sheet and overlay and locks body scroll', () => {
    w.openProtokoll();
    expect(getSheet(w).classList.contains('open')).toBe(true);
    expect(getOverlay(w).classList.contains('open')).toBe(true);
    expect(w.document.body.style.overflow).toBe('hidden');
  });

  it('closeProtokoll() removes .open from sheet and overlay and restores body scroll', () => {
    w.openProtokoll();
    w.closeProtokoll();
    expect(getSheet(w).classList.contains('open')).toBe(false);
    expect(getOverlay(w).classList.contains('open')).toBe(false);
    expect(w.document.body.style.overflow).toBe('');
  });

  it('openProtokoll is idempotent (calling it twice keeps the sheet open)', () => {
    w.openProtokoll();
    w.openProtokoll();
    expect(getSheet(w).classList.contains('open')).toBe(true);
  });

  it('closeProtokoll is a no-op when the sheet is already closed', () => {
    expect(() => w.closeProtokoll()).not.toThrow();
    expect(getSheet(w).classList.contains('open')).toBe(false);
  });

  it('does not save anything to localStorage on open/close (sheet state is DOM-only)', () => {
    const { window: w, store } = createDom();
    w.openProtokoll();
    w.closeProtokoll();
    // Sheet state is intentionally not persisted — opening the page
    // starts with the sheet closed, regardless of last session.
    expect(store['agrar_rechner']).toBeUndefined();
  });
});
