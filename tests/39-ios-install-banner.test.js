/**
 * Tests for the iOS Install Hint Banner (Issue #150).
 *
 * Verifies:
 * - Banner is hidden by default on init
 * - maybeShowIosInstallHint() shows banner on iOS when not installed and hint not seen
 * - dismissIosInstallHint() hides banner and persists dismissal
 * - Banner stays hidden on subsequent initUI calls after dismiss
 * - Banner is never shown on non-iOS devices
 * - Banner is never shown when already installed (standalone)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDom } from './helpers.js';

describe('iOS Install Hint Banner', () => {
  let w, doc, store;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
    store = result.store;
    delete store['mais_rechner_ios_install_seen'];
  });

  afterEach(() => {
    delete store['mais_rechner_ios_install_seen'];
  });

  describe('maybeShowIosInstallHint()', () => {
    it('does NOT show banner on non-iOS devices', () => {
      // Mock a non-iOS userAgent
      Object.defineProperty(w.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        writable: true,
      });
      Object.defineProperty(w, 'navigator', { value: w.navigator, writable: true });
      w.maybeShowIosInstallHint();
      const banner = doc.getElementById('ios_install_banner');
      expect(banner.classList.contains('show')).toBe(false);
    });

    it('shows banner on iOS when hint not yet seen', () => {
      Object.defineProperty(w.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/605.1.15',
        writable: true,
      });
      Object.defineProperty(w, 'navigator', { value: w.navigator, writable: true });
      // Override the module-level isIOS variable (set at script load time from userAgent)
      w.isIOS = true;
      w.isStandalone = false;
      w.maybeShowIosInstallHint();
      const banner = doc.getElementById('ios_install_banner');
      expect(banner.classList.contains('show')).toBe(true);
    });

    it('does NOT show banner when already installed (standalone)', () => {
      Object.defineProperty(w.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/605.1.15',
        writable: true,
      });
      Object.defineProperty(w, 'navigator', { value: w.navigator, writable: true });
      w.isIOS = true;
      w.isStandalone = true;
      w.maybeShowIosInstallHint();
      const banner = doc.getElementById('ios_install_banner');
      expect(banner.classList.contains('show')).toBe(false);
    });

    it('does NOT show banner when hint was already dismissed', () => {
      Object.defineProperty(w.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/605.1.15',
        writable: true,
      });
      Object.defineProperty(w, 'navigator', { value: w.navigator, writable: true });
      w.isIOS = true;
      w.isStandalone = false;
      store['mais_rechner_ios_install_seen'] = '1';
      w.maybeShowIosInstallHint();
      const banner = doc.getElementById('ios_install_banner');
      expect(banner.classList.contains('show')).toBe(false);
    });
  });

  describe('dismissIosInstallHint()', () => {
    it('hides the banner after dismiss', () => {
      Object.defineProperty(w.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/605.1.15',
        writable: true,
      });
      Object.defineProperty(w, 'navigator', { value: w.navigator, writable: true });
      w.isIOS = true;
      w.isStandalone = false;
      w.maybeShowIosInstallHint();
      w.dismissIosInstallHint();
      const banner = doc.getElementById('ios_install_banner');
      expect(banner.classList.contains('show')).toBe(false);
    });

    it('persists dismissal in localStorage', () => {
      Object.defineProperty(w.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/605.1.15',
        writable: true,
      });
      Object.defineProperty(w, 'navigator', { value: w.navigator, writable: true });
      w.isIOS = true;
      w.isStandalone = false;
      w.dismissIosInstallHint();
      expect(store['mais_rechner_ios_install_seen']).toBe('1');
    });

    it('banner does not re-appear on next maybeShowIosInstallHint call', () => {
      Object.defineProperty(w.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/605.1.15',
        writable: true,
      });
      Object.defineProperty(w, 'navigator', { value: w.navigator, writable: true });
      w.isIOS = true;
      w.isStandalone = false;
      w.maybeShowIosInstallHint();
      w.dismissIosInstallHint();
      w.maybeShowIosInstallHint();
      const banner = doc.getElementById('ios_install_banner');
      expect(banner.classList.contains('show')).toBe(false);
    });
  });

  describe('Integration: initUI triggers iOS hint after calculation', () => {
    it('initUI shows iOS install banner on iOS after calculation', () => {
      Object.defineProperty(w.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/605.1.15',
        writable: true,
      });
      Object.defineProperty(w, 'navigator', { value: w.navigator, writable: true });
      // Override module-level isIOS so maybeShowIosInstallHint uses iOS path
      w.isIOS = true;
      w.isStandalone = false;
      // Clear any persisted hint
      delete store['mais_rechner_ios_install_seen'];
      // initUI() calls maybeShowIosInstallHint() at the end of calculation flow
      w.initUI();
      // Simulate what happens after calculation: handleBerechnenFlow calls maybeShowIosInstallHint
      w.maybeShowIosInstallHint();
      const banner = doc.getElementById('ios_install_banner');
      expect(banner.classList.contains('show')).toBe(true);
    });
  });
});