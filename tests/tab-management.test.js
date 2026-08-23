import { createDom } from './helpers.js';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * Tab-Management & Reset-Init-Sync
 * Zusammengeführt in Issue #419 (Welle 4) aus:
 * 06-tab-management.test.js, 08-reset-init-sync.test.js
 * Jede Quelldatei ist als eigener describe-Block vollständig
 * erhalten (nur Import-Zeilen dedupliziert) — keine Assertions
 * wurden verändert oder entfernt.
 */

describe('Tab-Management & Reset-Init-Sync — übernommen aus 06-tab-management.test.js', () => {
/**
 * Tests for Tab management: addReiter, removeReiter, switchReiter, renameReiter, renderTabs
 */

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
});

describe('Tab-Management & Reset-Init-Sync — übernommen aus 08-reset-init-sync.test.js', () => {
/**
 * Tests for resetAll() and initUI()
 */

describe('resetAll()', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;

    // Setup: read DOM values into state, then render.
    // (Replaces legacy w.berechne() removed by PR #388; the reactive
    // pipeline (syncStateFromInputs + renderResults) replaces it.)
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    doc.getElementById('duenger').value = '150';
    w.syncStateFromInputs();
    w.renderResults();

    doc.getElementById('drill_einheit').value = '2';
    doc.getElementById('drill_duenger').value = '200';
    w.drillAdd();

    // Add fahrgassen
    w.fahrgassenToggle();
    doc.getElementById('fahrgassen_breite').value = '24';
    w.fahrgassenUpdate();
  });

  it('resets all input fields', () => {
    w.resetAll();
    expect(doc.getElementById('hektar').value).toBe('');
    expect(doc.getElementById('koerner').value).toBe('');
    expect(doc.getElementById('duenger').value).toBe('');
  });

  it('clears error messages', () => {
    doc.getElementById('err_hektar').textContent = 'Some error';
    w.resetAll();
    expect(doc.getElementById('err_hektar').textContent).toBe('');
    expect(doc.getElementById('err_koerner').textContent).toBe('');
  });

  it('clears border colors', () => {
    doc.getElementById('hektar').style.borderColor = '#d32f2f';
    w.resetAll();
    expect(doc.getElementById('hektar').style.borderColor).toBe('');
    expect(doc.getElementById('koerner').style.borderColor).toBe('');
  });

  it('hides results section', () => {
    w.resetAll();
    expect(doc.getElementById('results').style.display).toBe('none');
  });

  it('hides drill section', () => {
    w.resetAll();
    expect(doc.getElementById('drill_section').style.display).toBe('none');
  });

  it('resets fahrgassen toggle', () => {
    w.resetAll();
    expect(w.state.fahrgassenEnabled).toBe(false);
    expect(doc.getElementById('fahrgassen_toggle').classList.contains('active')).toBe(false);
    expect(doc.getElementById('fahrgassen_settings').classList.contains('open')).toBe(false);
  });

  it('clears fahrgassen breite input', () => {
    w.resetAll();
    expect(doc.getElementById('fahrgassen_breite').value).toBe('');
    expect(doc.getElementById('fahrgassen_saved').textContent).toBe('');
  });

  it('resets state to default', () => {
    w.resetAll();
    expect(w.state.reiter.length).toBe(1);
    expect(w.state.activeReiter).toBe(0);
    expect(w.state.fahrgassenEnabled).toBe(false);
    expect(w.state.fahrgassenBreite).toBe(0);
    expect(w.state.reiter[0].hektar).toBe(0);
    expect(w.state.reiter[0].koerner).toBe(0);
    expect(w.state.reiter[0].duenger).toBe(0);
    expect(w.state.reiter[0].entries).toEqual([]);
  });

  it('gibt dem ersten Schlag nach neuer Kulturwahl Priorität 1', () => {
    w.resetAll();
    w.chooseKultur('raps');

    expect(w.state.drillPriorities[0]).toBe(1);
  });

  it('clears drill entries', () => {
    expect(w.getActiveReiter().entries.length).toBe(1);
    w.resetAll();
    expect(w.getActiveReiter().entries.length).toBe(0);
  });

  it('removes extra tabs', () => {
    w.addReiter();
    w.addReiter();
    expect(w.state.reiter.length).toBe(3);
    w.resetAll();
    expect(w.state.reiter.length).toBe(1);
  });
});

describe('initUI()', () => {
  let w, doc, store;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
    store = result.store;
  });

  it('loads state from localStorage', () => {
    store['agrar_rechner'] = JSON.stringify({
      reiter: [{ name: 'Test', hektar: 15, koerner: 80000, duenger: 200, entries: [] }],
      activeReiter: 0,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
    });
    w.initUI();
    expect(doc.getElementById('hektar').value).toBe('15');
    expect(doc.getElementById('koerner').value).toBe('80000');
  });

  it('shows results when state has valid data', () => {
    store['agrar_rechner'] = JSON.stringify({
      reiter: [{ name: 'Reiter 1', hektar: 10, koerner: 90000, duenger: 150, entries: [] }],
      activeReiter: 0,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
    });
    w.initUI();
    expect(doc.getElementById('results').style.display).toBe('block');
  });

  it('hides results when state has no valid data', () => {
    store['agrar_rechner'] = JSON.stringify({
      reiter: [{ name: 'Reiter 1', hektar: 0, koerner: 0, duenger: 0, entries: [] }],
      activeReiter: 0,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
    });
    w.initUI();
    expect(doc.getElementById('results').style.display).toBe('none');
  });

  it('restores fahrgassen state', () => {
    store['agrar_rechner'] = JSON.stringify({
      reiter: [{ name: 'Reiter 1', hektar: 10, koerner: 90000, duenger: 150, entries: [] }],
      activeReiter: 0,
      fahrgassenEnabled: true,
      fahrgassenBreite: 24,
    });
    w.initUI();
    expect(doc.getElementById('fahrgassen_toggle').classList.contains('active')).toBe(true);
    expect(doc.getElementById('fahrgassen_settings').classList.contains('open')).toBe(true);
    expect(doc.getElementById('fahrgassen_breite').value).toBe('24');
  });

  it('renders tabs from saved state', () => {
    store['agrar_rechner'] = JSON.stringify({
      reiter: [
        { name: 'Feld A', hektar: 10, koerner: 90000, duenger: 150, entries: [] },
        { name: 'Feld B', hektar: 5, koerner: 80000, duenger: 100, entries: [] },
      ],
      activeReiter: 1,
      fahrgassenEnabled: false,
      fahrgassenBreite: 0,
    });
    w.initUI();
    // Tab buttons should appear (2 tabs)
    const btns = doc.querySelectorAll('.field-tab');
    expect(btns.length).toBe(2);
    // Active should be tab 1
    expect(w.state.activeReiter).toBe(1);
    // Inputs should show tab 1 data
    expect(doc.getElementById('hektar').value).toBe('5');
  });

  it('works with empty localStorage', () => {
    // No saved state
    w.initUI();
    expect(doc.getElementById('hektar').value).toBe('');
    expect(w.state.reiter.length).toBe(1);
  });
});

describe('syncStateFromInputs / syncInputsFromState', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  it('syncStateFromInputs reads DOM values into state', () => {
    doc.getElementById('hektar').value = '12,5';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '200';
    w.syncStateFromInputs();

    const r = w.getActiveReiter();
    expect(r.hektar).toBeCloseTo(12.5);
    expect(r.koerner).toBe(80000);
    expect(r.duenger).toBe(200);
  });

  it('syncStateFromInputs handles empty inputs as 0', () => {
    doc.getElementById('hektar').value = '';
    doc.getElementById('koerner').value = '';
    doc.getElementById('duenger').value = '';
    w.syncStateFromInputs();

    const r = w.getActiveReiter();
    expect(r.hektar).toBe(0);
    expect(r.koerner).toBe(0);
    expect(r.duenger).toBe(0);
  });

  it('syncInputsFromState writes state values into DOM', () => {
    w.state.reiter[0].hektar = 15;
    w.state.reiter[0].koerner = 85000;
    w.state.reiter[0].duenger = 175;
    w.syncInputsFromState();

    expect(doc.getElementById('hektar').value).toBe('15');
    expect(doc.getElementById('koerner').value).toBe('85000');
    expect(doc.getElementById('duenger').value).toBe('175');
  });

  it('syncInputsFromState shows empty for zero values', () => {
    w.state.reiter[0].hektar = 0;
    w.state.reiter[0].koerner = 0;
    w.state.reiter[0].duenger = 0;
    w.syncInputsFromState();

    expect(doc.getElementById('hektar').value).toBe('');
    expect(doc.getElementById('koerner').value).toBe('');
    expect(doc.getElementById('duenger').value).toBe('');
  });

  it('getActiveReiter returns correct tab', () => {
    w.addReiter();
    expect(w.getActiveReiter()).toBe(w.state.reiter[1]);
    w.switchReiter(0);
    expect(w.getActiveReiter()).toBe(w.state.reiter[0]);
  });
});


describe('resetActiveTab()', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
    // Two tabs, both with data + a drill entry on tab 0 (active)
    w.addReiter();                          // tab 1
    w.switchReiter(0);                      // active = tab 0
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    doc.getElementById('duenger').value = '150';
    w.syncStateFromInputs();
    doc.getElementById('drill_einheit').value = '2';
    doc.getElementById('drill_duenger').value = '200';
    w.drillAdd();
    // Put data on tab 1 too
    w.switchReiter(1);
    doc.getElementById('hektar').value = '5';
    doc.getElementById('koerner').value = '80000';
    w.syncStateFromInputs();
    w.switchReiter(0);                      // back to tab 0
  });

  it('clears the active tab inputs', () => {
    w.resetActiveTab();
    expect(doc.getElementById('hektar').value).toBe('');
    expect(doc.getElementById('koerner').value).toBe('');
  });

  it('clears the active tab state (entries + fields)', () => {
    expect(w.state.reiter[0].entries.length).toBe(1);
    w.resetActiveTab();
    expect(w.state.reiter[0].entries).toEqual([]);
    expect(w.state.reiter[0].hektar).toBe(0);
    expect(w.state.reiter[0].koerner).toBe(0);
    expect(w.state.reiter[0].done).toBe(false);
  });

  it('leaves other tabs untouched', () => {
    w.resetActiveTab();
    expect(w.state.reiter[1].hektar).toBe(5);
    expect(w.state.reiter[1].koerner).toBe(80000);
    expect(w.state.reiter.length).toBe(2);
  });

  it('hides results section', () => {
    w.resetActiveTab();
    expect(doc.getElementById('results').style.display).toBe('none');
  });
});
});
