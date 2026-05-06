/**
 * Tests for parseDE() edge cases.
 *
 * KLEIN: parseDE() converts German-formatted number strings.
 * Edge cases: empty strings, whitespace, thousand dots, comma decimals.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('parseDE edge cases', () => {
  let w, doc, store;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
    store = result.store;
  });

  // ── German thousand/comma decimal format ─────────────────────────────────

  it('parses comma decimal correctly', () => {
    expect(w.parseDE('123,5')).toBe(123.5);
    expect(w.parseDE('0,1')).toBe(0.1);
    expect(w.parseDE('1,234')).toBe(1.234);
  });

  it('parses integer without decimal', () => {
    expect(w.parseDE('100')).toBe(100);
    expect(w.parseDE('0')).toBe(0);
  });

  it('parses thousand dot separator', () => {
    expect(w.parseDE('1.000')).toBe(1000);
    expect(w.parseDE('1.000.000')).toBe(1000000);
  });

  it('parses thousand dot + comma decimal', () => {
    expect(w.parseDE('1.000,5')).toBe(1000.5);
    expect(w.parseDE('12.345,67')).toBe(12345.67);
  });

  // ── Whitespace ──────────────────────────────────────────────────────────

  it('strips whitespace', () => {
    expect(w.parseDE('  123,5  ')).toBe(123.5);
    expect(w.parseDE('\t100\t')).toBe(100);
  });

  // ── Zero / empty ────────────────────────────────────────────────────────

  it('returns 0 for empty string', () => {
    expect(w.parseDE('')).toBe(0);
  });

  it('returns 0 for null', () => {
    expect(w.parseDE(null)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(w.parseDE(undefined)).toBe(0);
  });

  // ── Already numeric ─────────────────────────────────────────────────────

  it('returns number unchanged', () => {
    expect(w.parseDE(123.5)).toBe(123.5);
    expect(w.parseDE(0)).toBe(0);
    expect(w.parseDE(-42)).toBe(-42);
  });

  // ── Invalid input ──────────────────────────────────────────────────────

  it('returns 0 for non-numeric strings', () => {
    expect(w.parseDE('abc')).toBe(0);
    expect(w.parseDE('abc,123')).toBe(0);
    expect(w.parseDE('12abc')).toBe(12); // leading digits parsed
  });

  it('handles comma as thousands separator (no decimal part)', () => {
    // "1,000" could be interpreted as 1.0 or 1000 depending on locale
    // parseDE treats last comma as decimal separator
    expect(w.parseDE('1,000')).toBe(1.0); // "1,000" → split on comma → ["1", "000"] → "1000" → 1000? No...
    // Let's check actual behavior: split on comma → parts = ["1", "000"]
    // Replace dots in "1" → "1", replace comma with dot → "1.000" → 1.0
    // Wait: s.replace(/\./g, '').replace(',', '.') → for "1,000":
    // s.split(',') → ["1", "000"]
    // s = "1,000", parts.length > 1, so s.replace(/\./g, '').replace(',', '.') → "1.000" → parseFloat → 1
    expect(w.parseDE('1,000')).toBe(1.0);
  });
});
