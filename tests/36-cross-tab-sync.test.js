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
