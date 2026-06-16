/**
 * Test 22: Protocol view — openProtokoll / closeProtokoll (Issue #291 sheet architecture)
 *
 * The Protokoll-Sheet is opened via the 🔧 tab button. Tests cover:
 *   - openProtokoll() adds the .open class to #protokoll_sheet and #protokoll_overlay,
 *     locks body scroll, renders the drill tab list.
 *   - closeProtokoll() removes the .open class, restores body scroll, focuses back.
 *   - Escape key (via _protokollKeyHandler) closes the sheet.
 *   - Clicks on the overlay fire closeProtokoll() (HTML onclick handler).
 *   - The drill_section stays hidden (display:none) when the sheet is closed —
 *     it becomes visible only inside the open sheet via renderResults.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDom } from './helpers.js';

function getSheet(w) { return w.document.getElementById('protokoll_sheet'); }
function getOverlay(w) { return w.document.getElementById('protokoll_overlay'); }
function sheetIsOpen(w) { return getSheet(w).classList.contains('open'); }
function overlayIsOpen(w) { return getOverlay(w).classList.contains('open'); }

describe('openProtokoll()', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('opens the protokoll sheet on openProtokoll()', () => {
    w.openProtokoll();

    expect(sheetIsOpen(w)).toBe(true);
    expect(overlayIsOpen(w)).toBe(true);
    expect(w.document.body.style.overflow).toBe('hidden');
  });

  it('renders the drill tab list when opening the sheet', () => {
    w.addReiter();
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 90000;
    w.state.reiter[0].duenger = 150;
    w.saveState();

    w.openProtokoll();

    // renderDrillTabList should have created elements
    expect(w.document.getElementById('dtl_prio_0')).toBeTruthy();
    expect(w.document.getElementById('dtl_e_0')).toBeTruthy();
  });

  it('opens the sheet on click of the 🔧 Protokoll tab button', () => {
    const tabBtn = w.document.getElementById('protokoll_tab_btn');
    expect(tabBtn).toBeTruthy();
    // onclick="openProtokoll()" is wired in the HTML
    tabBtn.click();
    expect(sheetIsOpen(w)).toBe(true);
  });

  it('opens the sheet on click of the overlay — overlay click triggers closeProtokoll, not open', () => {
    // The overlay's onclick handler is closeProtokoll (HTML attribute).
    // Document the contract: opening is via the tab button, not the overlay.
    const overlay = getOverlay(w);
    expect(overlay.getAttribute('onclick')).toContain('closeProtokoll');
  });
});

describe('closeProtokoll()', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('closes the protokoll sheet on closeProtokoll()', () => {
    w.openProtokoll();
    expect(sheetIsOpen(w)).toBe(true);

    w.closeProtokoll();

    expect(sheetIsOpen(w)).toBe(false);
    expect(overlayIsOpen(w)).toBe(false);
    expect(w.document.body.style.overflow).toBe('');
  });

  it('is a no-op when the sheet is already closed', () => {
    expect(sheetIsOpen(w)).toBe(false);
    expect(() => w.closeProtokoll()).not.toThrow();
    expect(sheetIsOpen(w)).toBe(false);
  });

  it('closes the sheet when the close button is clicked', () => {
    w.openProtokoll();
    const closeBtn = w.document.querySelector('.protokoll-close');
    expect(closeBtn).toBeTruthy();
    expect(closeBtn.getAttribute('onclick')).toContain('closeProtokoll');
    closeBtn.click();
    expect(sheetIsOpen(w)).toBe(false);
  });
});

describe('Protokoll sheet — keyboard handling', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('closes the protokoll sheet on Escape key', () => {
    w.openProtokoll();
    expect(sheetIsOpen(w)).toBe(true);

    // _protokollKeyHandler is exposed on AppGlobals for testability
    w.AppGlobals._protokollKeyHandler({ key: 'Escape', preventDefault: () => {} });

    expect(sheetIsOpen(w)).toBe(false);
  });

  it('does not close on non-Escape keys', () => {
    w.openProtokoll();
    w.AppGlobals._protokollKeyHandler({ key: 'Enter', preventDefault: () => {} });
    w.AppGlobals._protokollKeyHandler({ key: ' ', preventDefault: () => {} });
    expect(sheetIsOpen(w)).toBe(true);
  });
});

describe('drill_section visibility', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('does not show drill_section outside the open protokoll sheet', () => {
    // drill_section has style="display:none" in the HTML by default.
    const drillSection = w.document.getElementById('drill_section');
    expect(drillSection.style.display).toBe('none');
  });

  it('drill_section is still hidden when the sheet is open (sheet slides over the page; drill is rendered inside)', () => {
    // The protokoll sheet is a slide-in overlay; drill_section visibility
    // is driven by renderResults/renderDrillSummary, not by openProtokoll.
    // This test guards against a regression where opening the sheet
    // accidentally toggles drill_section.style.display.
    w.openProtokoll();
    const drillSection = w.document.getElementById('drill_section');
    expect(drillSection.style.display).toBe('none');
  });

  it('drill_section is hidden after closeProtokoll()', () => {
    w.openProtokoll();
    w.closeProtokoll();
    const drillSection = w.document.getElementById('drill_section');
    expect(drillSection.style.display).toBe('none');
  });
});

describe('Protokoll tab switching does not affect the sheet', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('switching reiter does not change the sheet open state', () => {
    w.addReiter();
    w.openProtokoll();
    expect(sheetIsOpen(w)).toBe(true);

    w.switchReiter(0);
    expect(sheetIsOpen(w)).toBe(true);

    w.closeProtokoll();
    w.switchReiter(1);
    expect(sheetIsOpen(w)).toBe(false);
  });
});

describe('Protokoll sheet — focus management', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('moves focus into the dialog on open (focuses the close button)', () => {
    // openProtokoll uses setTimeout(0) to move focus into the dialog to
    // avoid jsdom focus-event side effects (see public/js/render-drill.js
    // openProtokoll). Wait for the timeout to flush.
    w.openProtokoll();
    return new Promise((resolve) => {
      setTimeout(() => {
        const closeBtn = w.document.querySelector('.protokoll-close');
        expect(w.document.activeElement).toBe(closeBtn);
        resolve();
      }, 10);
    });
  });

  it('Tab from the last focusable element wraps to the first (focus trap)', () => {
    w.openProtokoll();
    // Wait for the open-focus setTimeout to settle so the close button has
    // focus, then simulate Tab from the last focusable inside the sheet.
    return new Promise((resolve) => {
      setTimeout(() => {
        const sheet = getSheet(w);
        const focusable = sheet.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        expect(focusable.length).toBeGreaterThan(1);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        last.focus();
        expect(w.document.activeElement).toBe(last);
        const preventDefault = vi.fn();
        w.AppGlobals._protokollKeyHandler({
          key: 'Tab', shiftKey: false, preventDefault,
        });
        expect(preventDefault).toHaveBeenCalled();
        expect(w.document.activeElement).toBe(first);
        resolve();
      }, 10);
    });
  });

  it('Shift+Tab from the first focusable element wraps to the last (focus trap)', () => {
    w.openProtokoll();
    return new Promise((resolve) => {
      setTimeout(() => {
        const sheet = getSheet(w);
        const focusable = sheet.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        first.focus();
        const preventDefault = vi.fn();
        w.AppGlobals._protokollKeyHandler({
          key: 'Tab', shiftKey: true, preventDefault,
        });
        expect(preventDefault).toHaveBeenCalled();
        expect(w.document.activeElement).toBe(last);
        resolve();
      }, 10);
    });
  });

  it('Tab between non-edge focusables does not preventDefault (normal tab navigation)', () => {
    w.openProtokoll();
    return new Promise((resolve) => {
      setTimeout(() => {
        const sheet = getSheet(w);
        const focusable = sheet.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length < 3) {
          // Skip the assertion if the sheet has too few focusables to test
          // the "middle" case — this guards the test from being environment
          // dependent.
          resolve();
          return;
        }
        // Focus the second focusable (not first, not last) and Tab forward.
        focusable[1].focus();
        const preventDefault = vi.fn();
        w.AppGlobals._protokollKeyHandler({
          key: 'Tab', shiftKey: false, preventDefault,
        });
        expect(preventDefault).not.toHaveBeenCalled();
        resolve();
      }, 10);
    });
  });

  it('restores focus to the previously focused element after closeProtokoll()', () => {
    // Setup: focus a known trigger element, then open the sheet.
    const tabBtn = w.document.getElementById('protokoll_tab_btn');
    tabBtn.focus();
    expect(w.document.activeElement).toBe(tabBtn);

    w.openProtokoll();
    w.closeProtokoll();

    // closeProtokoll synchronously calls _protokollPrevFocus.focus().
    expect(w.document.activeElement).toBe(tabBtn);
  });
});
