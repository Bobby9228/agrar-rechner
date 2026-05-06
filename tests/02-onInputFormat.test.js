/**
 * Tests for onInputFormat() — strips invalid chars while typing.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('onInputFormat', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;
  });

  function makeInput(value) {
    const el = doc.createElement('input');
    el.value = value;
    doc.body.appendChild(el);
    return el;
  }

  describe('integer mode', () => {
    it('keeps digits only', () => {
      const el = makeInput('12345');
      w.onInputFormat(el, 'integer');
      expect(el.value).toBe('12345');
    });

    it('removes letters', () => {
      const el = makeInput('12abc34');
      w.onInputFormat(el, 'integer');
      expect(el.value).toBe('1234');
    });

    it('removes comma', () => {
      const el = makeInput('12,5');
      w.onInputFormat(el, 'integer');
      expect(el.value).toBe('125');
    });

    it('removes dots', () => {
      const el = makeInput('1.000');
      w.onInputFormat(el, 'integer');
      expect(el.value).toBe('1000');
    });

    it('removes special chars', () => {
      const el = makeInput('12!@#$%34');
      w.onInputFormat(el, 'integer');
      expect(el.value).toBe('1234');
    });

    it('leaves empty string as-is', () => {
      const el = makeInput('');
      w.onInputFormat(el, 'integer');
      expect(el.value).toBe('');
    });

    it('handles only-non-digits input', () => {
      const el = makeInput('abc');
      w.onInputFormat(el, 'integer');
      expect(el.value).toBe('');
    });
  });

  describe('decimal mode', () => {
    it('keeps digits and comma', () => {
      const el = makeInput('12,5');
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('12,5');
    });

    it('allows only one comma (keeps first comma + first decimal part)', () => {
      const el = makeInput('12,5,3');
      w.onInputFormat(el, 'decimal');
      // split by comma: ["12","5","3"] -> parts[0]+","+parts[1] = "12,5"
      expect(el.value).toBe('12,5');
    });

    it('removes letters', () => {
      const el = makeInput('12abc,5');
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('12,5');
    });

    it('removes dots (no thousand separator)', () => {
      const el = makeInput('1.234,5');
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('1234,5');
    });

    it('handles just comma', () => {
      const el = makeInput(',');
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe(',');
    });

    it('handles empty string', () => {
      const el = makeInput('');
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('');
    });

    it('handles comma at start', () => {
      const el = makeInput(',5');
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe(',5');
    });

    it('handles comma at end', () => {
      const el = makeInput('12,');
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('12,');
    });

    it('removes special characters', () => {
      const el = makeInput('12!@#34,5');
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('1234,5');
    });
  });

  describe('cursor position preservation', () => {
    it('decimal: cursor at end stays at end after cleaning dots', () => {
      const el = makeInput('1.234,5');
      el.setSelectionRange(7, 7); // after "5"
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('1234,5');
      expect(el.selectionStart).toBe(6); // "1234,5" length = 6
    });

    it('decimal: cursor in middle stays proportional after removing dots', () => {
      const el = makeInput('1.234,5');
      // "1.234,5" — cursor after the first "1" (position 1)
      // After cleaning: "1234,5" — cursor should be proportional: round(1 * 6 / 7) = 1
      el.setSelectionRange(1, 1);
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('1234,5');
      expect(el.selectionStart).toBe(1);
    });

    it('decimal: cursor at start stays at start after removing dots', () => {
      const el = makeInput('1.234,5');
      el.setSelectionRange(0, 0); // at start
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('1234,5');
      expect(el.selectionStart).toBe(0);
    });

    it('integer: cursor at end stays at end after cleaning dots', () => {
      const el = makeInput('1.000');
      el.setSelectionRange(5, 5);
      w.onInputFormat(el, 'integer');
      expect(el.value).toBe('1000');
      expect(el.selectionStart).toBe(4);
    });

    it('integer: cursor in middle stays proportional after cleaning dots', () => {
      const el = makeInput('1.000');
      // "1.000" — cursor after "1." (position 2)
      // After cleaning: "1000" — cursor: round(2 * 4 / 5) = 2
      el.setSelectionRange(2, 2);
      w.onInputFormat(el, 'integer');
      expect(el.value).toBe('1000');
      expect(el.selectionStart).toBe(2);
    });

    it('decimal: no change = cursor unchanged (not called setSelectionRange)', () => {
      const el = makeInput('12,5');
      el.setSelectionRange(3, 3);
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('12,5');
      expect(el.selectionStart).toBe(3); // value unchanged, cursor untouched
    });
  });
});
