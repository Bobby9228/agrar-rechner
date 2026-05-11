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
    el.dataset.prev = '';
    el.dataset.cleaned = '';
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

    // iOS with English keyboard: inputmode="decimal" sends '.' instead of ','
    it('iOS decimal dot: converts dot to comma (12.5 → 12,5)', () => {
      const el = makeInput('12.5');
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('12,5');
    });

    it('iOS decimal dot: handles 1.234,5 gracefully (dot before comma)', () => {
      const el = makeInput('1.234,5');
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('1234,5');
    });

    it('iOS decimal dot: handles 0.5 → 0,5', () => {
      const el = makeInput('0.5');
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('0,5');
    });

    it('iOS decimal dot: second dot stripped after comma conversion', () => {
      const el = makeInput('12..5');
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('12,5');
    });
  });

  describe('cursor position preservation', () => {
    it('decimal: cursor at end stays at end after cleaning dots', () => {
      const el = makeInput('1.234,5');
      el.setSelectionRange(7, 7);
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('1234,5');
      expect(el.selectionStart).toBe(6);
    });

    it('decimal: cursor in middle stays proportional after removing dots', () => {
      const el = makeInput('1.234,5');
      el.setSelectionRange(1, 1);
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('1234,5');
      expect(el.selectionStart).toBe(1);
    });

    it('decimal: cursor at start stays at start after removing dots', () => {
      const el = makeInput('1.234,5');
      el.setSelectionRange(0, 0);
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
      expect(el.selectionStart).toBe(3);
    });
  });

  describe('auto-comma detection (browser inserts comma between digits)', () => {
    // This is the critical bug scenario: typing "25" in a decimal field
    // should result in "25", not have a comma auto-inserted between the digits.

    it('type 25: user types 2 then 5, browser sends 2 then 25 → "2" then "25"', () => {
      const el = makeInput('');
      // First keystroke: browser sends '2' (user typed '2')
      el.value = '2';
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('2');
      expect(el.dataset.prev).toBe('2');
      
      // Second keystroke: browser sends '25' (user typed '5')
      el.value = '25';
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('25'); // ← THIS IS THE KEY TEST
    });

    it('type 25: browser auto-inserts comma on first keystroke → "2," → result "2"', () => {
      const el = makeInput('');
      // First keystroke: browser sends '2,' (auto-inserted comma)
      el.value = '2,';
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('2'); // comma removed as auto-insert
      expect(el.dataset.prev).toBe('2');
      
      // Second keystroke: browser sends '2,5'
      el.value = '2,5';
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('25'); // comma removed as auto-insert
    });

    it('manual comma: user types 2 then , manually → comma STAYS', () => {
      const el = makeInput('');
      // User types '2'
      el.value = '2';
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('2');
      
      // User types ',' manually → val='2,' prev='2'
      // auto-comma check: withoutComma='2' len=1, prev.len+1=2 → NO match
      // → comma is kept (not auto-insert)
      el.value = '2,';
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('2,'); // COMMA STAYS - user typed it manually!
      expect(el.dataset.prev).toBe('2,');
    });

    it('iOS dot: 1 → 12 → 12. → 12, → 12,5', () => {
      const el = makeInput('');
      el.value = '1';
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('1');
      
      el.value = '12';
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('12');
      
      el.value = '12.'; // iOS decimal key sends '.'
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('12,'); // dot→comma
      
      el.value = '12.5'; // iOS sends '.' then '5'
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('12,5');
    });

    it('does not break normal decimal input: 12,5 stays 12,5', () => {
      const el = makeInput('');
      el.value = '12,5';
      w.onInputFormat(el, 'decimal');
      expect(el.value).toBe('12,5');
    });
  });
});
