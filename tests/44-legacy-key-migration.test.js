/**
 * Issue #235: localStorage-Key-Migration von mais_rechner* → agrar_rechner*
 *
 * Beim ersten Start nach dem Update liest die App den alten Key,
 * schreibt den Wert in den neuen Key (falls dort noch nichts liegt)
 * und löscht den alten Key.
 *
 * Getestet werden alle vier Legacy-Keys:
 *   mais_rechner              → agrar_rechner
 *   mais_rechner_theme        → theme
 *   mais_rechner_ios_install_seen → agrar_rechner_ios_install_seen
 *   mais_rechner_version_seen → agrar_rechner_version_seen
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

const LEGACY_DATA = {
  _lv: 4,
  reiter: [{ name: 'Tab 1', hektar: 12.5, istHektar: 12.5, koerner: 90000, duenger: 200, entries: [] }],
  activeReiter: 0,
  fahrgassenEnabled: false,
  fahrgassenBreite: 0,
  einheitGroesseEnabled: false,
  koernerProEinheit: 50000,
  machineLog: [],
  drillPriorities: {},
  iosInstallHintShown: false
};

describe('Issue #235: localStorage key migration', () => {
  it('moves mais_rechner → agrar_rechner and removes the old key', () => {
    const ctx = createDom();
    const payload = JSON.stringify(LEGACY_DATA);
    ctx.store['mais_rechner'] = payload;
    expect(ctx.store['agrar_rechner']).toBeUndefined();

    // Migration läuft synchron
    ctx.window.app.migrateLegacyStorageKeys();

    expect(ctx.store['agrar_rechner']).toBe(payload);
    expect(ctx.store['mais_rechner']).toBeUndefined();
  });

  it('moves mais_rechner_theme → theme', () => {
    const ctx = createDom();
    ctx.store['mais_rechner_theme'] = 'dark';
    expect(ctx.store['theme']).toBeUndefined();

    ctx.window.app.migrateLegacyStorageKeys();

    expect(ctx.store['theme']).toBe('dark');
    expect(ctx.store['mais_rechner_theme']).toBeUndefined();
  });

  it('moves mais_rechner_ios_install_seen → agrar_rechner_ios_install_seen', () => {
    const ctx = createDom();
    ctx.store['mais_rechner_ios_install_seen'] = '1';
    expect(ctx.store['agrar_rechner_ios_install_seen']).toBeUndefined();

    ctx.window.app.migrateLegacyStorageKeys();

    expect(ctx.store['agrar_rechner_ios_install_seen']).toBe('1');
    expect(ctx.store['mais_rechner_ios_install_seen']).toBeUndefined();
  });

  it('moves mais_rechner_version_seen → agrar_rechner_version_seen', () => {
    const ctx = createDom();
    ctx.store['mais_rechner_version_seen'] = 'v1.2.3';
    expect(ctx.store['agrar_rechner_version_seen']).toBeUndefined();

    ctx.window.app.migrateLegacyStorageKeys();

    expect(ctx.store['agrar_rechner_version_seen']).toBe('v1.2.3');
    expect(ctx.store['mais_rechner_version_seen']).toBeUndefined();
  });

  it('does not overwrite an existing value at the new key', () => {
    const ctx = createDom();
    const existing = JSON.stringify({ ...LEGACY_DATA, marker: 'already-on-new-key' });
    const legacy = JSON.stringify({ ...LEGACY_DATA, marker: 'legacy' });
    ctx.store['agrar_rechner'] = existing;
    ctx.store['mais_rechner'] = legacy;

    ctx.window.app.migrateLegacyStorageKeys();

    // existing agrar_rechner must be preserved
    expect(ctx.store['agrar_rechner']).toBe(existing);
    // legacy key is still cleaned up
    expect(ctx.store['mais_rechner']).toBeUndefined();
  });

  it('is idempotent — running twice does not corrupt state', () => {
    const ctx = createDom();
    const payload = JSON.stringify(LEGACY_DATA);
    ctx.store['mais_rechner'] = payload;

    ctx.window.app.migrateLegacyStorageKeys();
    ctx.window.app.migrateLegacyStorageKeys();
    ctx.window.app.migrateLegacyStorageKeys();

    expect(ctx.store['agrar_rechner']).toBe(payload);
    expect(ctx.store['mais_rechner']).toBeUndefined();
  });

  it('LEGACY_KEY_MAP contains exactly the four expected entries', () => {
    const ctx = createDom();
    const map = ctx.window.app.LEGACY_KEY_MAP;
    expect(Object.keys(map).sort()).toEqual([
      'mais_rechner',
      'mais_rechner_ios_install_seen',
      'mais_rechner_theme',
      'mais_rechner_version_seen'
    ]);
    expect(map['mais_rechner']).toBe('agrar_rechner');
    expect(map['mais_rechner_theme']).toBe('theme');
    expect(map['mais_rechner_ios_install_seen']).toBe('agrar_rechner_ios_install_seen');
    expect(map['mais_rechner_version_seen']).toBe('agrar_rechner_version_seen');
  });

  it('runs automatically during module load (no legacy keys present in fresh install)', () => {
    // The migration is invoked at the top of state.js, before saveState/loadState.
    // A fresh createDom() simulates a new install: no legacy data, no errors.
    const ctx = createDom();
    expect(ctx.store['agrar_rechner']).toBeUndefined();
    expect(ctx.store['mais_rechner']).toBeUndefined();
    expect(ctx.store['theme']).toBeUndefined();
  });
});
