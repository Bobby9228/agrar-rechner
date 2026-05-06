/**
 * Tests for theme/dark mode: toggleTheme, applyTheme, initTheme, getStoredTheme, setStoredTheme
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('toggleTheme', () => {
  let w;
  beforeEach(() => {
    w = createDom().window;
    // initTheme() runs during script load. In jsdom matchMedia is undefined,
    // so applyTheme(undefined) toggles dark ON (classList.toggle without force).
    // We reset to a known light state before each test.
    w.applyTheme(false);
    w.setStoredTheme('light');
  });

  it('toggles from light to dark', () => {
    w.toggleTheme();
    expect(w.document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('toggles from dark to light', () => {
    w.toggleTheme(); // to dark
    w.toggleTheme(); // back to light
    expect(w.document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('updates theme toggle button emoji', () => {
    var btn = w.document.getElementById('theme_toggle');
    expect(btn.textContent).toBe('🌙');
    w.toggleTheme();
    expect(btn.textContent).toBe('☀️');
    w.toggleTheme();
    expect(btn.textContent).toBe('🌙');
  });

  it('persists theme to localStorage', () => {
    w.toggleTheme();
    expect(w.localStorage.getItem('mais_rechner_theme')).toBe('dark');
    w.toggleTheme();
    expect(w.localStorage.getItem('mais_rechner_theme')).toBe('light');
  });

  it('updates theme-color meta tag to dark', () => {
    w.toggleTheme();
    var meta = w.document.querySelector('meta[name="theme-color"]');
    expect(meta.getAttribute('content')).toBe('#1a1f16');
  });

  it('updates theme-color meta tag to light', () => {
    w.toggleTheme(); // dark
    w.toggleTheme(); // light
    var meta = w.document.querySelector('meta[name="theme-color"]');
    expect(meta.getAttribute('content')).toBe('#2d5016');
  });
});

describe('applyTheme', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('adds dark class when dark=true', () => {
    w.applyTheme(true);
    expect(w.document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes dark class when dark=false', () => {
    w.document.documentElement.classList.add('dark');
    w.applyTheme(false);
    expect(w.document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('sets button emoji correctly for dark', () => {
    w.applyTheme(true);
    expect(w.document.getElementById('theme_toggle').textContent).toBe('☀️');
  });

  it('sets button emoji correctly for light', () => {
    w.applyTheme(false);
    expect(w.document.getElementById('theme_toggle').textContent).toBe('🌙');
  });

  it('sets meta theme-color for dark', () => {
    w.applyTheme(true);
    expect(w.document.querySelector('meta[name="theme-color"]').getAttribute('content')).toBe('#1a1f16');
  });

  it('sets meta theme-color for light', () => {
    w.applyTheme(false);
    expect(w.document.querySelector('meta[name="theme-color"]').getAttribute('content')).toBe('#2d5016');
  });
});

describe('getStoredTheme / setStoredTheme', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('returns null when no theme stored', () => {
    expect(w.getStoredTheme()).toBeNull();
  });

  it('returns stored theme value', () => {
    w.setStoredTheme('dark');
    expect(w.getStoredTheme()).toBe('dark');
  });

  it('stores "light" theme', () => {
    w.setStoredTheme('light');
    expect(w.getStoredTheme()).toBe('light');
  });

  it('handles localStorage errors gracefully (get)', () => {
    // Override localStorage to throw
    Object.defineProperty(w, 'localStorage', {
      value: { getItem: () => { throw new Error('denied'); } },
      writable: true,
    });
    expect(w.getStoredTheme()).toBeNull();
  });

  it('handles localStorage errors gracefully (set)', () => {
    Object.defineProperty(w, 'localStorage', {
      value: { setItem: () => { throw new Error('denied'); } },
      writable: true,
    });
    // Should not throw
    expect(() => w.setStoredTheme('dark')).not.toThrow();
  });
});

describe('initTheme', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('applies dark when stored theme is dark', () => {
    w.setStoredTheme('dark');
    w.initTheme();
    expect(w.document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('applies light when stored theme is light', () => {
    w.setStoredTheme('light');
    w.initTheme();
    expect(w.document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('applies dark when system prefers dark and no stored theme', () => {
    // jsdom doesn't support matchMedia by default, so we mock it
    w.matchMedia = (query) => ({ matches: query === '(prefers-color-scheme: dark)' });
    w.localStorage.removeItem('mais_rechner_theme');
    w.initTheme();
    expect(w.document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('applies light when system prefers light and no stored theme', () => {
    w.matchMedia = () => ({ matches: false });
    w.localStorage.removeItem('mais_rechner_theme');
    w.initTheme();
    expect(w.document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('prefers stored theme over system preference', () => {
    w.setStoredTheme('light');
    w.matchMedia = () => ({ matches: true }); // system says dark
    w.initTheme();
    expect(w.document.documentElement.classList.contains('dark')).toBe(false);
  });
});
