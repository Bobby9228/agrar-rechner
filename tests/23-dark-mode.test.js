/**
 * Test 23: Dark mode — getStoredTheme, setStoredTheme, applyTheme, toggleTheme, initTheme
 */
import { describe, it, expect, vi } from 'vitest';
import { createDom } from './helpers.js';

describe('getStoredTheme', () => {
  it('returns null when no theme stored', () => {
    const { window: w } = createDom();
    expect(w.getStoredTheme()).toBeNull();
  });

  it('returns stored theme value', () => {
    const { window: w, store } = createDom();
    store['mais_rechner_theme'] = 'dark';
    expect(w.getStoredTheme()).toBe('dark');
  });

  it('returns light theme when stored', () => {
    const { window: w, store } = createDom();
    store['mais_rechner_theme'] = 'light';
    expect(w.getStoredTheme()).toBe('light');
  });
});

describe('setStoredTheme', () => {
  it('stores dark theme in localStorage', () => {
    const { window: w, store } = createDom();
    w.setStoredTheme('dark');
    expect(store['mais_rechner_theme']).toBe('dark');
  });

  it('stores light theme in localStorage', () => {
    const { window: w, store } = createDom();
    w.setStoredTheme('light');
    expect(store['mais_rechner_theme']).toBe('light');
  });

  it('overwrites previous theme', () => {
    const { window: w, store } = createDom();
    w.setStoredTheme('dark');
    w.setStoredTheme('light');
    expect(store['mais_rechner_theme']).toBe('light');
  });
});

describe('applyTheme', () => {
  it('adds dark class to html element when dark=true', () => {
    const { window: w } = createDom();
    w.applyTheme(true);
    expect(w.document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes dark class when dark=false', () => {
    const { window: w } = createDom();
    w.applyTheme(true);
    w.applyTheme(false);
    expect(w.document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('sets button text to sun emoji in dark mode', () => {
    const { window: w } = createDom();
    w.applyTheme(true);
    expect(w.document.getElementById('theme_toggle').textContent).toBe('☀️');
  });

  it('sets button text to moon emoji in light mode', () => {
    const { window: w } = createDom();
    w.applyTheme(false);
    expect(w.document.getElementById('theme_toggle').textContent).toBe('🌙');
  });

  it('sets meta theme-color to dark value in dark mode', () => {
    const { window: w } = createDom();
    w.applyTheme(true);
    const meta = w.document.querySelector('meta[name="theme-color"]');
    expect(meta.getAttribute('content')).toBe('#1a1f16');
  });

  it('sets meta theme-color to light value in light mode', () => {
    const { window: w } = createDom();
    w.applyTheme(false);
    const meta = w.document.querySelector('meta[name="theme-color"]');
    expect(meta.getAttribute('content')).toBe('#2d5016');
  });
});

describe('toggleTheme', () => {
  it('switches from light to dark', () => {
    const { window: w, store } = createDom();
    // Start in light mode
    w.applyTheme(false);
    w.toggleTheme();

    expect(w.document.documentElement.classList.contains('dark')).toBe(true);
    expect(store['mais_rechner_theme']).toBe('dark');
  });

  it('switches from dark to light', () => {
    const { window: w, store } = createDom();
    w.applyTheme(true);
    w.toggleTheme();

    expect(w.document.documentElement.classList.contains('dark')).toBe(false);
    expect(store['mais_rechner_theme']).toBe('light');
  });
});

describe('initTheme', () => {
  it('applies dark when stored theme is dark', () => {
    const { window: w, store } = createDom();
    store['mais_rechner_theme'] = 'dark';
    w.initTheme();
    expect(w.document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('applies light when stored theme is light', () => {
    const { window: w, store } = createDom();
    store['mais_rechner_theme'] = 'light';
    w.initTheme();
    expect(w.document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('follows system preference when no stored theme', () => {
    const { window: w } = createDom();
    // jsdom matchMedia defaults to no matches → light
    w.initTheme();
    expect(w.document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('applies dark when system prefers dark and no stored theme', () => {
    const { window: w } = createDom();
    // Mock matchMedia to return dark preference
    w.matchMedia = vi.fn().mockReturnValue({ matches: true });
    w.initTheme();
    expect(w.document.documentElement.classList.contains('dark')).toBe(true);
  });
});
