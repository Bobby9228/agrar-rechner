/**
 * Berechnungs- und Parse-Helpers (Locale-DE: "12,5" / "1.000,5").
 *
 * parseDE() konvertiert deutsch formatierte Zahlen-Strings in Number.
 * formatEinheit() formatiert eine Anzahl Saatgut-Einheiten für die UI
 * (Singular "1,000 Einheit" / Plural "1,000 Einheiten", 3 Nachkommastellen,
 * NaN-/Infinity-Guard).
 * getKornerGesamt() / getTotalEinheiten() / getTotalDuenger() sind die
 * Berechnungs-Primitive, die render-results, render-dashboard,
 * render-drill und das Carryover-System gemeinsam nutzen.
 *
 * Zugehörige frühere Dateien: tests/calculations-parse.test.js,
 * tests/calculations-parse.test.js (Issue #419 Welle 2).
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

describe('parseDE edge cases', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

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

  it('strips whitespace', () => {
    expect(w.parseDE('  123,5  ')).toBe(123.5);
    expect(w.parseDE('\t100\t')).toBe(100);
  });

  it('returns 0 for empty string', () => {
    expect(w.parseDE('')).toBe(0);
  });

  it('returns 0 for null', () => {
    expect(w.parseDE(null)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(w.parseDE(undefined)).toBe(0);
  });

  it('returns number unchanged', () => {
    expect(w.parseDE(123.5)).toBe(123.5);
    expect(w.parseDE(0)).toBe(0);
    expect(w.parseDE(-42)).toBe(-42);
  });

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
    // Replace dots in "1" → "1", replace comma with dot → "1.000" → 1
    // Wait: s.replace(/\./g, '').replace(',', '.') → for "1,000":
    // s.split(',') → ["1", "000"]
    // s = "1,000", parts.length > 1, so s.replace(/\./g, '').replace(',', '.') → "1.000" → parseFloat → 1
    expect(w.parseDE('1,000')).toBe(1.0);
  });
});

describe('formatEinheit', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('1.0 => singular "Einheit"', () => expect(w.formatEinheit(1.0)).toBe('1,000 Einheit'));
  it('2.0 => plural "Einheiten"', () => expect(w.formatEinheit(2.0)).toBe('2,000 Einheiten'));
  it('1.5 => plural', () => expect(w.formatEinheit(1.5)).toBe('1,500 Einheiten'));
  it('0.5 => plural', () => expect(w.formatEinheit(0.5)).toBe('0,500 Einheiten'));
  it('0.0 => plural (not 1.0)', () => expect(w.formatEinheit(0.0)).toBe('0,000 Einheiten'));
  it('100 => plural', () => expect(w.formatEinheit(100)).toBe('100,000 Einheiten'));
  // Rand-Cases aus Issue #85
  it('1.049 => 1,049 Einheiten', () =>
    expect(w.formatEinheit(1.049)).toBe('1,049 Einheiten'));
  it('1.05 => 1,050 Einheiten (Plural)', () =>
    expect(w.formatEinheit(1.05)).toBe('1,050 Einheiten'));
  // Issue #143 — Infinity guard
  it('Infinity => "—" (no crash)', () => expect(w.formatEinheit(Infinity)).toBe('—'));
  it('-Infinity => "—" (no crash)', () => expect(w.formatEinheit(-Infinity)).toBe('—'));
  it('NaN => "—" (no crash)', () => expect(w.formatEinheit(NaN)).toBe('—'));
  // Singular gilt nur, wenn der auf 3 Stellen angezeigte Wert exakt 1,000 ist.
});

/**
 * Issue #445 Welle 1 — E) Formatter gegen nicht-endliche Werte absichern.
 * fmt() rendert '0,0' für null/undefined/NaN; bisher lief Infinity durch
 * und landete als toFixed-Text 'Infinity' in der UI. fmtCompact erbt die
 * Korrektur automatisch (delegiert an fmt()).
 */
describe('Issue #445 E — fmt/fmtCompact gegen nicht-endliche Werte abgesichert', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('fmt(NaN) === "0,0"', () => expect(w.fmt(NaN)).toBe('0,0'));
  it('fmt(Infinity) === "0,0" (KEIN "Infinity"-Text mehr)', () => expect(w.fmt(Infinity)).toBe('0,0'));
  it('fmt(-Infinity) === "0,0"', () => expect(w.fmt(-Infinity)).toBe('0,0'));
  it('fmt(null) === "0,0"', () => expect(w.fmt(null)).toBe('0,0'));
  it('fmt(undefined) === "0,0"', () => expect(w.fmt(undefined)).toBe('0,0'));

  it('fmtCompact(NaN) === "0" (delegiert an fmt)', () => expect(w.fmtCompact(NaN)).toBe('0'));
  it('fmtCompact(Infinity) === "0"', () => expect(w.fmtCompact(Infinity)).toBe('0'));
  it('fmtCompact(-Infinity) === "0"', () => expect(w.fmtCompact(-Infinity)).toBe('0'));
  it('fmtCompact(null) === "0"', () => expect(w.fmtCompact(null)).toBe('0'));
  it('fmtCompact(undefined) === "0"', () => expect(w.fmtCompact(undefined)).toBe('0'));

  it('Regression: fmt(1.5) bleibt "1,5"', () => expect(w.fmt(1.5)).toBe('1,5'));
  it('Regression: fmtCompact(5) bleibt "5"', () => expect(w.fmtCompact(5)).toBe('5'));
  it('Regression: fmtCompact(2.5) bleibt "2,5"', () => expect(w.fmtCompact(2.5)).toBe('2,5'));
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
