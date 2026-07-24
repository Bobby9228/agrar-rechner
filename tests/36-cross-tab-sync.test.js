/**
 * Tests for Cross-Tab-Synchronisation (Issue #128)
 *
 * Verifies that a `storage` event listener is registered during initUI()
 * and correctly updates state + UI when another tab writes to localStorage.
 */
import { describe, it, expect, vi } from 'vitest';
import { createDom } from './helpers.js';

function setup() {
  const { dom, window: w, store } = createDom();
  w.initUI();
  return { dom, w, store };
}

/**
 * Simulates a storage event as fired by another tab writing to localStorage.
 * The storage event only fires in OTHER windows/tabs — not the originating one.
 */
function fireStorageEvent(w, key, newValue) {
  const event = new w.Event('storage');
  event.key = key;
  event.newValue = newValue;
  event.oldValue = null;
  event.storageArea = w.localStorage;
  w.dispatchEvent(event);
}

describe('Cross-Tab-Synchronisation (#128)', () => {
  it('registers a storage event listener in initUI', () => {
    const { w } = setup();
    // Verify the listener is registered by dispatching a storage event
    // and checking that state changes
    const newState = JSON.parse(JSON.stringify(w.state));
    newState.reiter[0].hektar = 99.5;
    fireStorageEvent(w, 'agrar_rechner', JSON.stringify(newState));
    expect(w.state.reiter[0].hektar).toBe(99.5);
  });

  it('updates state when another tab saves to agrar_rechner', () => {
    const { w } = setup();
    const remote = JSON.parse(JSON.stringify(w.state));
    remote.reiter[0].koerner = 42;
    remote.reiter[0].duenger = 123;

    fireStorageEvent(w, 'agrar_rechner', JSON.stringify(remote));

    expect(w.state.reiter[0].koerner).toBe(42);
    expect(w.state.reiter[0].duenger).toBe(123);
  });

  it('ignores storage events for other keys', () => {
    const { w } = setup();
    const origHektar = w.state.reiter[0].hektar;

    fireStorageEvent(w, 'theme', '"dark"');

    expect(w.state.reiter[0].hektar).toBe(origHektar);
  });

  it('ignores storage events with null newValue (item removed)', () => {
    const { w } = setup();
    const origHektar = w.state.reiter[0].hektar;

    const event = new w.Event('storage');
    event.key = 'agrar_rechner';
    event.newValue = null;
    w.dispatchEvent(event);

    expect(w.state.reiter[0].hektar).toBe(origHektar);
  });

  it('ignores invalid JSON in newValue without crashing', () => {
    const { w } = setup();
    const origHektar = w.state.reiter[0].hektar;

    // Should not throw
    fireStorageEvent(w, 'agrar_rechner', 'not-valid-json');

    expect(w.state.reiter[0].hektar).toBe(origHektar);
  });

  it('does not re-render when remote state is identical to local state', () => {
    const { w } = setup();

    // Spy on syncInputsFromState to verify it's NOT called for identical state
    const syncSpy = vi.spyOn(w, 'syncInputsFromState');

    // Fire event with the exact same state
    fireStorageEvent(w, 'agrar_rechner', JSON.stringify(w.state));

    expect(syncSpy).not.toHaveBeenCalled();
    syncSpy.mockRestore();
  });

  it('syncs multi-tab state from another browser tab', () => {
    const { w } = setup();

    // Simulate remote state with 2 tabs
    const remote = JSON.parse(JSON.stringify(w.state));
    remote.reiter.push({ name: 'Tab 2', hektar: 5, koerner: 200, duenger: 50, istHektar: 0, entries: [] });

    fireStorageEvent(w, 'agrar_rechner', JSON.stringify(remote));

    expect(w.state.reiter.length).toBe(2);
    expect(w.state.reiter[1].name).toBe('Tab 2');
    expect(w.state.reiter[1].hektar).toBe(5);
  });

  it('updates activeReiter when changed remotely', () => {
    const { w } = setup();

    // Add a second tab manually
    w.state.reiter.push({ name: 'Tab 2', hektar: 10, koerner: 150, duenger: 80, istHektar: 0, entries: [] });
    w.activeReiter = 0;

    const remote = JSON.parse(JSON.stringify(w.state));
    remote.activeReiter = 1;

    fireStorageEvent(w, 'agrar_rechner', JSON.stringify(remote));

    expect(w.state.activeReiter).toBe(1);
  });
});

describe('Cross-Tab-Sync hardening — sanitize pipeline (Issue #128)', () => {
  describe('Dangerous / unknown keys are stripped', () => {
    it('does not transfer injected __proto__ on remote entries', () => {
      const { w } = setup();
      const sentinel = '__polluted_' + Date.now();
      const remote = JSON.parse(JSON.stringify(w.state));
      // __proto__ als EIGENE Property via defineProperty — sonst greift
      // der Object-Literal-Setter den Schlüssel ab und JSON.stringify
      // lässt ihn weg, sodass der jsonReviver auf dem storage-Event-Pfad
      // gar nicht beansprucht würde.
      const entry = { einheit: 5, duenger: 100, time: 1 };
      Object.defineProperty(entry, '__proto__', {
        value: { [sentinel]: true },
        enumerable: true,
        configurable: true,
        writable: true,
      });
      remote.reiter[0].entries = [entry];

      fireStorageEvent(w, 'agrar_rechner', JSON.stringify(remote));

      // Object.prototype wurde nicht verseucht
      expect(({})[sentinel]).toBeUndefined();
      // Eintrag ist sauber, __proto__ nicht als eigene Property
      const adopted = w.state.reiter[0].entries[0];
      expect(Object.prototype.hasOwnProperty.call(adopted, '__proto__')).toBe(false);
      expect(adopted.einheit).toBe(5);
    });

    it('drops unknown top-level keys from remote state', () => {
      const { w } = setup();
      const origHektar = w.state.reiter[0].hektar;
      const remote = {
        reiter: [{ name: 'S', hektar: 7, istHektar: 0, koerner: 0, duenger: 0, entries: [] }],
        activeReiter: 0,
        xss: '<script>alert(1)</script>',
        injected: { evil: true },
        onload: 'evil()',
        eval: 'malicious',
        _lv: 5
      };

      fireStorageEvent(w, 'agrar_rechner', JSON.stringify(remote));

      expect(w.state.xss).toBeUndefined();
      expect(w.state.injected).toBeUndefined();
      expect(w.state.onload).toBeUndefined();
      expect(w.state.eval).toBeUndefined();
      // Sanitisierte Werte wurden übernommen
      expect(w.state.reiter[0].hektar).toBe(7);
      expect(w.state.reiter[0].hektar).not.toBe(origHektar);
    });

    it('drops unknown keys on remote tabs', () => {
      const { w } = setup();
      const remote = JSON.parse(JSON.stringify(w.state));
      remote.reiter[0].onclick = 'evil()';
      remote.reiter[0].onload = 'malicious';
      remote.reiter[0].__evil = 'xss';

      fireStorageEvent(w, 'agrar_rechner', JSON.stringify(remote));

      const tab = w.state.reiter[0];
      expect(tab.onclick).toBeUndefined();
      expect(tab.onload).toBeUndefined();
      expect(tab.__evil).toBeUndefined();
    });
  });

  describe('Wrong field types / invalid entries are sanitized', () => {
    it('coerces string-typed number fields to 0', () => {
      const { w } = setup();
      const remote = JSON.parse(JSON.stringify(w.state));
      remote.reiter[0].hektar = '<script>alert(1)</script>';
      remote.reiter[0].koerner = { evil: true };
      remote.reiter[0].duenger = [1, 2, 3];

      fireStorageEvent(w, 'agrar_rechner', JSON.stringify(remote));

      expect(w.state.reiter[0].hektar).toBe(0);
      expect(w.state.reiter[0].koerner).toBe(0);
      expect(w.state.reiter[0].duenger).toBe(0);
    });

    it('rejects NaN / Infinity in remote number fields', () => {
      const { w } = setup();
      const remote = JSON.parse(JSON.stringify(w.state));
      remote.reiter[0].hektar = NaN;
      remote.reiter[0].koerner = Infinity;
      remote.reiter[0].duenger = -Infinity;

      fireStorageEvent(w, 'agrar_rechner', JSON.stringify(remote));

      expect(w.state.reiter[0].hektar).toBe(0);
      expect(w.state.reiter[0].koerner).toBe(0);
      expect(w.state.reiter[0].duenger).toBe(0);
    });

    it('drops non-plain entries from remote state', () => {
      const { w } = setup();
      const remote = JSON.parse(JSON.stringify(w.state));
      remote.reiter[0].entries = [
        { einheit: 1, duenger: 100, time: 1 }, // valid
        'not-an-object',                        // drop
        null,                                   // drop
        [1, 2, 3],                              // drop (array)
        { xss: '<script>', einheit: 2 }         // xss raus, einheit bleibt
      ];

      fireStorageEvent(w, 'agrar_rechner', JSON.stringify(remote));

      expect(w.state.reiter[0].entries.length).toBe(2);
      expect(w.state.reiter[0].entries[0].einheit).toBe(1);
      expect(w.state.reiter[0].entries[1].einheit).toBe(2);
      expect(w.state.reiter[0].entries[1].xss).toBeUndefined();
    });

    it('coerces non-string activeView to null', () => {
      const { w } = setup();
      const remote = JSON.parse(JSON.stringify(w.state));
      remote.activeView = 42;
      remote.activeReiter = 0;

      fireStorageEvent(w, 'agrar_rechner', JSON.stringify(remote));

      expect(w.state.activeView).toBeNull();
    });

    it('clamps activeReiter out of range to 0', () => {
      const { w } = setup();
      const remote = JSON.parse(JSON.stringify(w.state));
      remote.activeReiter = 99;

      fireStorageEvent(w, 'agrar_rechner', JSON.stringify(remote));

      // Nur 1 reiter lokal → 99 ist out of range → auf 0 geklemmt
      expect(w.state.activeReiter).toBe(0);
    });

    it('falls back to defaults for invalid koernerProEinheit', () => {
      const { w } = setup();
      const remote = JSON.parse(JSON.stringify(w.state));
      remote.koernerProEinheit = 'pickle';

      fireStorageEvent(w, 'agrar_rechner', JSON.stringify(remote));

      expect(w.state.koernerProEinheit).toBe(50000);
    });
  });

  describe('Invalid schema is ignored', () => {
    it('ignores remote state with missing reiter', () => {
      const { w } = setup();
      const origHektar = w.state.reiter[0].hektar;

      fireStorageEvent(w, 'agrar_rechner', JSON.stringify({ activeReiter: 0, _lv: 5 }));

      expect(w.state.reiter[0].hektar).toBe(origHektar);
      expect(w.state.reiter.length).toBe(1);
    });

    it('ignores remote state with empty reiter array', () => {
      const { w } = setup();
      const origHektar = w.state.reiter[0].hektar;

      fireStorageEvent(w, 'agrar_rechner', JSON.stringify({ reiter: [], activeReiter: 0, _lv: 5 }));

      expect(w.state.reiter[0].hektar).toBe(origHektar);
      expect(w.state.reiter.length).toBe(1);
    });

    it('ignores remote state where root is not a plain object', () => {
      const { w } = setup();
      const origHektar = w.state.reiter[0].hektar;

      fireStorageEvent(w, 'agrar_rechner', '[]');
      expect(w.state.reiter[0].hektar).toBe(origHektar);

      fireStorageEvent(w, 'agrar_rechner', '"just a string"');
      expect(w.state.reiter[0].hektar).toBe(origHektar);

      fireStorageEvent(w, 'agrar_rechner', '42');
      expect(w.state.reiter[0].hektar).toBe(origHektar);
    });

    it('ignores remote state whose reiter is not an array', () => {
      const { w } = setup();
      const origHektar = w.state.reiter[0].hektar;

      fireStorageEvent(w, 'agrar_rechner', JSON.stringify({ reiter: 'not-an-array', _lv: 5 }));

      expect(w.state.reiter[0].hektar).toBe(origHektar);
    });

    it('does not throw on completely malformed JSON', () => {
      const { w } = setup();
      const origHektar = w.state.reiter[0].hektar;

      expect(() => {
        fireStorageEvent(w, 'agrar_rechner', '{reiter: [}');
      }).not.toThrow();
      expect(w.state.reiter[0].hektar).toBe(origHektar);
    });
  });

  describe('Valid multi-tab state still works', () => {
    it('syncs a two-tab state including per-tab entries and settings', () => {
      const { w } = setup();
      const remote = {
        reiter: [
          {
            name: 'Schlag A',
            hektar: 5.5,
            istHektar: 5,
            koerner: 90000,
            duenger: 200,
            entries: [
              { time: 1000, einheit: 1, duenger: 100, hektar: 1, istHektar: 1, koerner: 90000, duengerRate: 100 }
            ],
            done: true
          },
          {
            name: 'Schlag B',
            hektar: 3.2,
            istHektar: 3,
            koerner: 50000,
            duenger: 100,
            entries: [],
            done: false
          }
        ],
        activeReiter: 1,
        activeView: 'protokoll',
        dashboardOpen: false,
        fahrgassenEnabled: true,
        fahrgassenBreite: 18,
        einheitGroesseEnabled: false,
        koernerProEinheit: 50000,
        machineLog: [{ time: 1000, einheit: 1, duenger: 100, hektar: 1, istHektar: 1, koerner: 90000, duengerRate: 100 }],
        drillPriorities: { '0': 1 },
        _lv: 5
      };

      fireStorageEvent(w, 'agrar_rechner', JSON.stringify(remote));

      expect(w.state.reiter.length).toBe(2);
      expect(w.state.reiter[0].name).toBe('Schlag A');
      expect(w.state.reiter[0].hektar).toBe(5.5);
      expect(w.state.reiter[0].entries.length).toBe(1);
      expect(w.state.reiter[0].entries[0].einheit).toBe(1);
      expect(w.state.reiter[0].done).toBe(true);
      expect(w.state.reiter[1].name).toBe('Schlag B');
      expect(w.state.reiter[1].hektar).toBe(3.2);
      expect(w.state.activeReiter).toBe(1);
      expect(w.state.activeView).toBe('protokoll');
      expect(w.state.fahrgassenEnabled).toBe(true);
      expect(w.state.fahrgassenBreite).toBe(18);
      expect(w.state.machineLog.length).toBe(1);
      expect(w.state.machineLog[0].einheit).toBe(1);
    });

    it('does not write back to localStorage when applying remote state', () => {
      const { w, store } = setup();
      const before = store['agrar_rechner'];

      const remote = JSON.parse(JSON.stringify(w.state));
      remote.reiter[0].hektar = 12.5;

      fireStorageEvent(w, 'agrar_rechner', JSON.stringify(remote));

      // Cross-Tab-Sync darf KEINEN Storage-Effekt haben (kein Persistieren)
      expect(store['agrar_rechner']).toBe(before);
      // State wurde trotzdem im Memory übernommen
      expect(w.state.reiter[0].hektar).toBe(12.5);
    });

    it('ignores remote state with dangerous keys but still picks up the safe fields', () => {
      const { w } = setup();
      const remote = JSON.parse(JSON.stringify(w.state));
      remote.reiter[0].hektar = 8.25;
      remote.reiter[0].onclick = 'evil()';
      // __proto__ als EIGENE Property via defineProperty — sonst ändert die
      // Zuweisung nur die Prototyp-Kette und wird von JSON.stringify nicht
      // als literaler Schlüssel serialisiert; der jsonReviver würde gar
      // nicht gefordert.
      Object.defineProperty(remote.reiter[0], '__proto__', {
        value: { polluted: true },
        enumerable: true,
        configurable: true,
        writable: true,
      });
      remote.injected = 'xss';

      fireStorageEvent(w, 'agrar_rechner', JSON.stringify(remote));

      const tab = w.state.reiter[0];
      expect(tab.hektar).toBe(8.25);
      expect(tab.onclick).toBeUndefined();
      expect(w.state.injected).toBeUndefined();
      expect(({}).polluted).toBeUndefined();
    });
  });
});
