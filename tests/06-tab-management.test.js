/**
 * Tests for Tab management: addReiter, removeReiter, switchReiter, renameReiter, renderTabs
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Tab management', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  describe('addReiter()', () => {
    it('adds a new tab and switches to it', () => {
      expect(w.state.reiter.length).toBe(1);
      w.addReiter();
      expect(w.state.reiter.length).toBe(2);
      expect(w.state.activeReiter).toBe(1);
      expect(w.state.reiter[1].name).toBe('Schlag 2');
    });

    it('new tab has default values for non-inherited fields', () => {
      w.addReiter();
      const r = w.state.reiter[1];
      expect(r.hektar).toBe(0);
      expect(r.istHektar).toBe(0);
      expect(r.entries).toEqual([]);
      expect(r.done).toBe(false);
      expect(r.notizen).toBe('');
      // koerner/duenger are inherited from the previously active tab
      // (Schlag 1 is the default empty state here → 0/0).
      expect(r.koerner).toBe(0);
      expect(r.duenger).toBe(0);
    });

    it('inherits koerner and duenger from the previously active tab', () => {
      w.state.reiter[0].koerner = 90000;
      w.state.reiter[0].duenger = 200;
      w.state.activeReiter = 0;
      w.syncInputsFromState();

      w.addReiter();
      const r = w.state.reiter[1];
      expect(r.koerner).toBe(90000);
      expect(r.duenger).toBe(200);
      // andere Felder bleiben leer
      expect(r.hektar).toBe(0);
      expect(r.istHektar).toBe(0);
      expect(r.entries).toEqual([]);
      expect(r.done).toBe(false);
      expect(r.notizen).toBe('');
    });

    it('inherits koerner and duenger from DOM-typed values via syncStateFromInputs', () => {
      doc.getElementById('koerner').value = '85000';
      doc.getElementById('duenger').value = '180';
      // kein expliziter syncStateFromInputs-Call — addReiter muss selbst syncen.
      w.addReiter();
      const r = w.state.reiter[1];
      expect(r.koerner).toBe(85000);
      expect(r.duenger).toBe(180);
      // hektar wurde im DOM nicht gesetzt → bleibt 0
      expect(r.hektar).toBe(0);
      expect(r.istHektar).toBe(0);
      expect(r.entries).toEqual([]);
    });

    it('inherited values in new tab are normally overridable', () => {
      doc.getElementById('koerner').value = '90000';
      doc.getElementById('duenger').value = '200';
      w.addReiter();
      // Tab 1 ist aktiv und hat geerbte Werte. Jetzt überschreiben:
      doc.getElementById('koerner').value = '75000';
      doc.getElementById('duenger').value = '150';
      w.syncStateFromInputs();
      expect(w.state.reiter[1].koerner).toBe(75000);
      expect(w.state.reiter[1].duenger).toBe(150);
    });


    it('inherits zero values unchanged', () => {
      w.state.reiter[0].koerner = 0;
      w.state.reiter[0].duenger = 0;

      w.addReiter();
      const r = w.state.reiter[1];
      expect(r.koerner).toBe(0);
      expect(r.duenger).toBe(0);
    });

    it('each additional tab inherits from the currently active predecessor', () => {
      doc.getElementById('koerner').value = '90000';
      doc.getElementById('duenger').value = '200';
      w.addReiter();

      doc.getElementById('koerner').value = '75000';
      doc.getElementById('duenger').value = '150';
      w.addReiter();

      expect(w.state.reiter[2].koerner).toBe(75000);
      expect(w.state.reiter[2].duenger).toBe(150);
    });

    it('adds multiple tabs with incrementing names', () => {
      w.addReiter();
      w.addReiter();
      w.addReiter();
      expect(w.state.reiter.length).toBe(4);
      expect(w.state.reiter[1].name).toBe('Schlag 2');
      expect(w.state.reiter[2].name).toBe('Schlag 3');
      expect(w.state.reiter[3].name).toBe('Schlag 4');
    });

    it('preserves first tab data when adding new tab', () => {
      doc.getElementById('hektar').value = '10';
      doc.getElementById('koerner').value = '90000';
      w.syncStateFromInputs();

      w.addReiter();
      expect(w.state.reiter[0].hektar).toBe(10);
      expect(w.state.reiter[0].koerner).toBe(90000);
    });

    it('clears non-inherited inputs for new tab and shows inherited values', () => {
      doc.getElementById('hektar').value = '10';
      doc.getElementById('koerner').value = '90000';
      w.syncStateFromInputs();

      w.addReiter();
      // Hektar bleibt im neuen Tab leer → Input wird geleert.
      expect(doc.getElementById('hektar').value).toBe('');
      // Koerner wird vererbt → Input zeigt den geerbten Wert.
      expect(doc.getElementById('koerner').value).toBe('90000');
    });
  });

  describe('removeReiter()', () => {
    it('removes the specified tab', () => {
      w.addReiter();
      expect(w.state.reiter.length).toBe(2);
      w.removeReiter(1);
      expect(w.state.reiter.length).toBe(1);
    });

    it('does not remove if only one tab remains', () => {
      expect(w.state.reiter.length).toBe(1);
      w.removeReiter(0);
      expect(w.state.reiter.length).toBe(1);
    });

    it('adjusts activeReiter when removing active tab', () => {
      w.addReiter(); // now 2 tabs, active = 1
      w.removeReiter(1); // remove the active one
      expect(w.state.activeReiter).toBe(0);
    });

    it('adjusts activeReiter when removing tab before active', () => {
      w.addReiter(); // 2 tabs, active = 1
      w.addReiter(); // 3 tabs, active = 2
      w.removeReiter(0); // remove first, active should adjust
      expect(w.state.activeReiter).toBe(1); // shifted down
    });

    it('syncs state before removing (preserves unsaved input)', () => {
      w.addReiter();
      // Active is tab 1. Switch to tab 0.
      w.switchReiter(0);
      // Type something in hektar
      doc.getElementById('hektar').value = '25';
      // Remove tab 1 (should sync current tab 0 first)
      w.removeReiter(1);
      expect(w.state.reiter[0].hektar).toBe(25);
    });

    it('shows inputs from remaining tab after removal', () => {
      doc.getElementById('hektar').value = '15';
      w.syncStateFromInputs();
      w.addReiter(); // tab 1 active
      w.removeReiter(1); // back to tab 0
      expect(doc.getElementById('hektar').value).toBe('15');
    });
  });

  describe('switchReiter()', () => {
    it('switches to the specified tab', () => {
      w.addReiter();
      w.switchReiter(0);
      expect(w.state.activeReiter).toBe(0);
    });

    it('does nothing when switching to current tab', () => {
      w.addReiter(); // active = 1
      const prevState = JSON.parse(JSON.stringify(w.state));
      w.switchReiter(1); // same tab
      expect(w.state.activeReiter).toBe(prevState.activeReiter);
    });

    it('saves current tab inputs before switching', () => {
      w.addReiter();
      doc.getElementById('hektar').value = '30';
      doc.getElementById('koerner').value = '85000';
      w.switchReiter(0);
      // Tab 1 should have saved data
      expect(w.state.reiter[1].hektar).toBe(30);
      expect(w.state.reiter[1].koerner).toBe(85000);
    });

    it('loads inputs from target tab', () => {
      w.state.reiter[0].hektar = 15;
      w.state.reiter[0].koerner = 80000;
      w.state.activeReiter = 0; // ensure we're on tab 0 first
      w.syncInputsFromState();
      w.addReiter();
      // Now on tab 1 (empty)
      expect(doc.getElementById('hektar').value).toBe('');
      w.switchReiter(0);
      expect(doc.getElementById('hektar').value).toBe('15');
    });

    it('shows results if target tab has data', () => {
      w.state.reiter[0].hektar = 10;
      w.state.reiter[0].koerner = 90000;
      w.state.activeReiter = 0; // ensure we're on tab 0
      w.syncInputsFromState();
      w.addReiter();
      w.switchReiter(0);
      expect(doc.getElementById('results').style.display).toBe('block');
    });

    it('hides results if target tab has no data', () => {
      w.state.reiter[0].hektar = 10;
      w.state.reiter[0].koerner = 90000;
      w.addReiter(); // tab 1 is empty
      // switchReiter won't fire because activeReiter already is 1
      // But we can test via switchReiter(0) then switchReiter(1)
      w.switchReiter(0);
      w.switchReiter(1);
      expect(doc.getElementById('results').style.display).toBe('none');
    });
  });

  describe('renameReiter()', () => {
    it('renames a tab', () => {
      w.addReiter();
      w.renameReiter(1, 'Feld A');
      expect(w.state.reiter[1].name).toBe('Feld A');
    });

    it('truncates name to 20 characters', () => {
      w.addReiter();
      w.renameReiter(1, 'A'.repeat(30));
      expect(w.state.reiter[1].name.length).toBe(20);
    });

    it('allows empty name', () => {
      w.addReiter();
      w.renameReiter(1, '');
      expect(w.state.reiter[1].name).toBe('');
    });

    it('renames first tab', () => {
      w.renameReiter(0, 'Mein Feld');
      expect(w.state.reiter[0].name).toBe('Mein Feld');
    });
  });

  describe('renderTabs()', () => {
    it('shows single tab button when only 1 reiter (for rename)', () => {
      w.renderTabs();
      const btns = doc.querySelectorAll('.field-tab');
      expect(btns.length).toBe(1);
    });

    it('shows tab buttons when 2+ reiter', () => {
      w.addReiter();
      const btns = doc.querySelectorAll('.field-tab');
      expect(btns.length).toBe(2);
    });

    it('hides close button when only 1 tab', () => {
      w.renderTabs();
      const closes = doc.querySelectorAll('.tab-close');
      expect(closes.length).toBe(0);
    });

    it('shows close buttons when 2+ tabs', () => {
      w.addReiter();
      const closes = doc.querySelectorAll('.tab-close');
      expect(closes.length).toBe(2);
    });

    it('marks active tab with "active" class', () => {
      w.addReiter(); // active = 1
      const btns = doc.querySelectorAll('.tab-btn');
      expect(btns[1].classList.contains('active')).toBe(true);
      expect(btns[0].classList.contains('active')).toBe(false);
    });

    it('always shows tab-add button', () => {
      w.renderTabs();
      expect(doc.querySelector('.tab-add')).toBeTruthy();
    });

    it('shows close button on each tab when 2+ reiter', () => {
      w.addReiter();
      const closes = doc.querySelectorAll('.tab-close');
      expect(closes.length).toBe(2);
    });

    it('tab name span is visible and editable with only 1 tab', () => {
      w.renderTabs();
      const spans = doc.querySelectorAll('.tab-name');
      expect(spans.length).toBe(1);
      expect(spans[0].textContent).toBe('Schlag 1');
      // Simulate renaming by setting textContent and triggering blur
      spans[0].textContent = 'Mein Feld';
      // Issue #418 Welle 5: Handler ist per addEventListener gebunden.
      // Erst fokussieren, dann blur() — jsdom feuert Blur-Event nur,
      // wenn das Element vorher fokussiert war.
      spans[0].focus();
      spans[0].blur();
      expect(w.state.reiter[0].name).toBe('Mein Feld');
    });

    it('tab name span shows correct name', () => {
      w.addReiter();
      w.renameReiter(1, 'Test');
      w.renderTabs();
      const spans = doc.querySelectorAll('.tab-name');
      expect(spans[1].textContent).toBe('Test');
    });
  });
});
