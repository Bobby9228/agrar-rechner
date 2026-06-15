/**
 * Tests for the "What's New" Update Banner (Issue #149).
 *
 * All banner elements use the real DOM from index.html.
 * Tests use initUI() which calls maybeShowUpdateHint internally.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Update Banner ("What\'s New")', () => {
  let w, doc, store;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
    store = result.store;
    delete store['agrar_rechner_version_seen'];
  });

  afterEach(() => {
    delete store['agrar_rechner_version_seen'];
  });

  describe('maybeShowUpdateHint() via initUI', () => {
    it('shows banner on first visit (no version seen)', () => {
      delete store['agrar_rechner_version_seen'];
      w.initUI();
      const banner = doc.getElementById('update_banner');
      expect(banner).toBeTruthy();
      expect(banner.classList.contains('show')).toBe(true);
    });

    it('fills version text correctly', () => {
      delete store['agrar_rechner_version_seen'];
      w.initUI();
      const verEl = doc.getElementById('update_version');
      expect(verEl.textContent).toBe('v1.0.0');
    });

    it('fills changelog text correctly', () => {
      delete store['agrar_rechner_version_seen'];
      w.initUI();
      const changelogEl = doc.getElementById('update_changelog');
      expect(changelogEl.textContent.length).toBeGreaterThan(0);
    });

    it('shows banner when older version was seen', () => {
      store['agrar_rechner_version_seen'] = 'v0.9.0';
      w.initUI();
      const banner = doc.getElementById('update_banner');
      expect(banner).toBeTruthy();
      expect(banner.classList.contains('show')).toBe(true);
    });
  });

  describe('dismissUpdateHint()', () => {
    it('hides the banner after dismiss', () => {
      delete store['agrar_rechner_version_seen'];
      w.initUI();
      w.dismissUpdateHint();
      const banner = doc.getElementById('update_banner');
      expect(banner.classList.contains('show')).toBe(false);
    });

    it('saves current version to localStorage after dismiss', () => {
      delete store['agrar_rechner_version_seen'];
      w.dismissUpdateHint();
      expect(store['agrar_rechner_version_seen']).toBe('v1.0.0');
    });

    it('second initUI does not re-show banner after dismiss', () => {
      delete store['agrar_rechner_version_seen'];
      w.initUI();
      w.dismissUpdateHint();
      w.initUI();
      const banner = doc.getElementById('update_banner');
      expect(banner.classList.contains('show')).toBe(false);
    });
  });

  describe('APP_VERSION constant', () => {
    it('APP_VERSION is defined as v1.0.0', () => {
      expect(w.APP_VERSION).toBe('v1.0.0');
    });

    it('APP_BUILD_DATE is a non-empty string', () => {
      expect(typeof w.APP_BUILD_DATE).toBe('string');
      expect(w.APP_BUILD_DATE.length).toBeGreaterThan(0);
    });

    it('UPDATE_CHANGELOG is a non-empty string', () => {
      expect(typeof w.UPDATE_CHANGELOG).toBe('string');
      expect(w.UPDATE_CHANGELOG.length).toBeGreaterThan(0);
    });
  });

  describe('version footer', () => {
    it('version footer shows APP_VERSION and APP_BUILD_DATE after initUI', () => {
      delete store['agrar_rechner_version_seen'];
      w.initUI();
      const footer = doc.getElementById('version_footer');
      expect(footer).toBeTruthy();
      expect(footer.textContent).toBe('v1.0.0 · Mai 2025');
    });
  });
});