/**
 * Tests for parseDE(), formatEinheit(), and core calculation functions.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('parseDE', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('parses simple integer', () => expect(w.parseDE('42')).toBe(42));
  it('parses decimal with comma', () => expect(w.parseDE('12,5')).toBeCloseTo(12.5));
  it('parses number with thousand separator dots', () => {
    expect(w.parseDE('1.000')).toBe(1000);
    expect(w.parseDE('1.234.567')).toBe(1234567);
  });
  it('parses number with both thousand dots and decimal comma', () => {
    expect(w.parseDE('1.234,56')).toBeCloseTo(1234.56);
    expect(w.parseDE('12.345,67')).toBeCloseTo(12345.67);
  });
  it('returns 0 for empty string', () => expect(w.parseDE('')).toBe(0));
  it('returns 0 for null', () => expect(w.parseDE(null)).toBe(0));
  it('returns 0 for undefined', () => expect(w.parseDE(undefined)).toBe(0));
  it('returns number when already a number', () => expect(w.parseDE(42.5)).toBeCloseTo(42.5));
  it('handles whitespace', () => expect(w.parseDE('  12,5  ')).toBeCloseTo(12.5));
  it('returns 0 for non-numeric string', () => expect(w.parseDE('abc')).toBe(0));
  it('returns 0 for just comma', () => expect(w.parseDE(',')).toBe(0));
  it('returns 0 for just dot', () => expect(w.parseDE('.')).toBe(0));
  it('parses zero correctly', () => {
    expect(w.parseDE('0')).toBe(0);
    expect(w.parseDE('0,0')).toBe(0);
  });
  it('handles negative numbers', () => expect(w.parseDE('-5')).toBe(-5));
  it('parses very large numbers', () => {
    expect(w.parseDE('90000')).toBe(90000);
    expect(w.parseDE('90.000')).toBe(90000);
  });
  it('parses ",5" as 0.5', () => expect(w.parseDE(',5')).toBeCloseTo(0.5));
  it('parses "0,1" correctly', () => expect(w.parseDE('0,1')).toBeCloseTo(0.1));
  it('parses "1.000.000,50"', () => expect(w.parseDE('1.000.000,50')).toBeCloseTo(1000000.5));
});

describe('formatEinheit', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('1.0 => singular "Einheit"', () => expect(w.formatEinheit(1.0)).toBe('1,0 Einheit'));
  it('2.0 => plural "Einheiten"', () => expect(w.formatEinheit(2.0)).toBe('2,0 Einheiten'));
  it('1.5 => plural', () => expect(w.formatEinheit(1.5)).toBe('1,5 Einheiten'));
  it('0.5 => plural', () => expect(w.formatEinheit(0.5)).toBe('0,5 Einheiten'));
  it('0.0 => plural (not 1.0)', () => expect(w.formatEinheit(0.0)).toBe('0,0 Einheiten'));
  it('100 => plural', () => expect(w.formatEinheit(100)).toBe('100,0 Einheiten'));
});

describe('Core calculations', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  describe('getKornerGesamt', () => {
    it('returns 0 when hektar is 0', () => {
      w.state.reiter[0] = { ...w.state.reiter[0], hektar: 0, koerner: 90000 };
      expect(w.getKornerGesamt()).toBe(0);
    });
    it('returns 0 when koerner is 0', () => {
      w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 0 };
      expect(w.getKornerGesamt()).toBe(0);
    });
    it('calculates hektar * koerner', () => {
      w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000 };
      expect(w.getKornerGesamt()).toBe(900000);
    });
    it('calculates with decimal hektar', () => {
      w.state.reiter[0] = { ...w.state.reiter[0], hektar: 12.5, koerner: 80000 };
      expect(w.getKornerGesamt()).toBe(1000000);
    });
    it('applies Fahrgassen reduction', () => {
      w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000 };
      w.state.fahrgassenEnabled = true;
      w.state.fahrgassenBreite = 24;
      expect(w.getKornerGesamt()).toBe(862500);
    });
    it('does NOT apply Fahrgassen when disabled', () => {
      w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000 };
      w.state.fahrgassenEnabled = false;
      w.state.fahrgassenBreite = 24;
      expect(w.getKornerGesamt()).toBe(900000);
    });
    it('does NOT apply Fahrgassen when breite is 0', () => {
      w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000 };
      w.state.fahrgassenEnabled = true;
      w.state.fahrgassenBreite = 0;
      expect(w.getKornerGesamt()).toBe(900000);
    });
    it('Fahrgassen with breite=2 reduces by 50%', () => {
      w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 100000 };
      w.state.fahrgassenEnabled = true;
      w.state.fahrgassenBreite = 2;
      expect(w.getKornerGesamt()).toBe(500000);
    });
  });

  describe('getTotalEinheiten', () => {
    it('returns 0 when no data', () => expect(w.getTotalEinheiten()).toBe(0));
    it('calculates kornerGesamt / 50000', () => {
      w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000 };
      expect(w.getTotalEinheiten()).toBe(18);
    });
    it('works with Fahrgassen', () => {
      w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000 };
      w.state.fahrgassenEnabled = true;
      w.state.fahrgassenBreite = 24;
      expect(w.getTotalEinheiten()).toBeCloseTo(17.25);
    });
  });

  describe('getTotalDuenger', () => {
    it('returns 0 when no hektar', () => {
      w.state.reiter[0] = { ...w.state.reiter[0], hektar: 0, duenger: 150 };
      expect(w.getTotalDuenger()).toBe(0);
    });
    it('calculates hektar * duenger', () => {
      w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, duenger: 150 };
      expect(w.getTotalDuenger()).toBe(1500);
    });
    it('handles decimal hektar', () => {
      w.state.reiter[0] = { ...w.state.reiter[0], hektar: 12.5, duenger: 200 };
      expect(w.getTotalDuenger()).toBe(2500);
    });
    it('returns 0 when duenger is 0', () => {
      w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, duenger: 0 };
      expect(w.getTotalDuenger()).toBe(0);
    });
  });
});
