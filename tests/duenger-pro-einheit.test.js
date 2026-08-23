/**
 * Dünger-pro-Einheit + Einheiten-Präzision.
 *
 * getDuengerProEinheit(tab, kpe) liefert kg/Einheit dimensionsrein
 * (kg/E = kg/ha × kpe / Körner/ha). Die alte *50-Formel (kg/ha²) ist
 * entfernt. Round-Trip gegen getTotalDuenger / getTotalEinheiten
 * verifiziert die algebraische Identität.
 *
 * Einheiten werden intern auf 6 Nachkommastellen begrenzt und in der UI
 * mit 3 Nachkommastellen angezeigt. Kleine Mindermengen dürfen nicht
 * unter der EPSILON_EINHEIT-Schwelle verschwinden (0,0005 E Saatgut
 * bleibt sichtbar). _buildDrillEntry verwendet round6 für Saat.
 *
 * Zugehörige frühere Dateien: tests/duenger-pro-einheit.test.js,
 * tests/duenger-pro-einheit.test.js (Issue #419 Welle 2).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('getDuengerProEinheit — Issue #230', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('is exposed on window', () => {
    expect(typeof w.getDuengerProEinheit).toBe('function');
  });

  it('returns 0 for missing tab.duenger', () => {
    expect(w.getDuengerProEinheit({ hektar: 10, koerner: 90000 }, 50000)).toBe(0);
  });

  it('returns 0 for missing tab.koerner', () => {
    expect(w.getDuengerProEinheit({ hektar: 10, duenger: 150 }, 50000)).toBe(0);
  });

  it('returns 0 for koernerProEinheit <= 0', () => {
    expect(w.getDuengerProEinheit({ hektar: 10, koerner: 90000, duenger: 150 }, 0)).toBe(0);
  });

  it('returns 0 for null tab', () => {
    expect(w.getDuengerProEinheit(null, 50000)).toBe(0);
  });

  it('matches the algebraic identity: kg/Einheit ist dimensionsrein', () => {
    // 10 ha × 90.000 Körner/ha × 1 Einheit/50.000 Körner = 18 Einheiten
    // 10 ha × 150 kg/ha = 1500 kg Dünger
    // → 1500 / 18 ≈ 83.33 kg/Einheit
    var tab = { hektar: 10, koerner: 90000, duenger: 150 };
    expect(w.getDuengerProEinheit(tab, 50000)).toBeCloseTo(83.333, 2);
  });

  it('agrees with getTotalDuenger / getTotalEinheiten quotient', () => {
    // Das ist die algebraische Definition — duengerProEinheit muss
    // totalDuenger / totalEinheit entsprechen.
    var tab = { hektar: 5, koerner: 80000, duenger: 100 };
    var kpe = 50000;
    var totalD = w.getTotalDuenger(tab);                    // 5 × 100 = 500
    var totalE = w.getTotalEinheiten(tab, kpe);              // 5 × 80000 / 50000 = 8
    var expected = totalD / totalE;                          // 500 / 8 = 62.5
    expect(w.getDuengerProEinheit(tab, kpe)).toBeCloseTo(expected, 6);
  });

  it('responds correctly to a non-default koernerProEinheit', () => {
    // 100.000 Körner/Einheit (z.B. Sonnenblumen) → weniger Körner pro Einheit
    // ist schwerer, also kg/Einheit steigt. Konkret: duengerProEinheit ist
    // proportional zu kpe.
    var tab = { hektar: 10, koerner: 90000, duenger: 150 };
    var kgPerEinheit50k = w.getDuengerProEinheit(tab, 50000);
    var kgPerEinheit100k = w.getDuengerProEinheit(tab, 100000);
    // Verdopplung von kpe → Verdopplung von kg/Einheit
    expect(kgPerEinheit100k / kgPerEinheit50k).toBeCloseTo(2, 6);
  });

  it('Issue #230 regression: produces the value the OLD *50 formula CANNOT', () => {
    // Demonstration, dass die alte Formel `tab.duenger / hektar * 50` etwas
    // anderes liefert (mit falscher Dimension kg/ha²) und mit der neuen
    // Formel nicht übereinstimmt.
    var tab = { hektar: 10, koerner: 90000, duenger: 150 };
    var oldFormula = tab.duenger / (tab.hektar || 1) * 50;   // 750 — dimensionslos falsch
    var newFormula = w.getDuengerProEinheit(tab, 50000);      // ≈ 83.33 kg/Einheit
    expect(newFormula).not.toBeCloseTo(oldFormula, 0);
  });
});

describe('Einheiten-Präzision', () => {
    it('berechnet SOLL- und IST-Einheiten auf 6 Nachkommastellen', () => {
        const { window: w } = createDom();
        const r = {
            hektar: 1,
            istHektar: 2,
            koerner: 1,
            koernerProEinheit: 7,
            entries: [],
        };

        expect(w.getTabTotalEinheiten(r)).toBe(0.142857);
        expect(w.getTabIstEinheiten(r)).toBe(0.285714);
    });

    it('zeigt Einheiten mit 3 Nachkommastellen an', () => {
        const { window: w } = createDom();

        expect(w.formatEinheit(0.0444444)).toBe('0,044 Einheiten');
        expect(w.formatEinheit(1.0004)).toBe('1,000 Einheit');
        expect(w.formatEinheit(1.0006)).toBe('1,001 Einheiten');
    });

    it('behält viele kleine Mindermengen in der Gesamtberechnung sichtbar', () => {
        const { window: w } = createDom();
        const reiter = [];

        // Zehn fertige kleine Felder: je 0,004 E weniger benötigt als eingefüllt.
        for (let i = 0; i < 10; i++) {
            reiter.push({
                name: 'Klein ' + (i + 1),
                hektar: 0.1,
                istHektar: 0.096,
                koerner: 50000,
                koernerProEinheit: 50000,
                duenger: 0,
                entries: [{ einheit: 0.1, time: '09:' + String(i).padStart(2, '0') }],
                done: true,
            });
        }
        // Offenes Feld ist die Senke. Die zehn kleinen Mengen ergeben zusammen 0,040 E.
        reiter.push({
            name: 'Offen',
            hektar: 1,
            istHektar: 0,
            koerner: 50000,
            koernerProEinheit: 50000,
            duenger: 0,
            entries: [],
            done: false,
        });

        w.state.reiter = reiter;
        w.state.activeReiter = 10;
        w.invalidateCarryoverCache();

        const carryover = w.getCarryover(10);
        const remaining = w.getTabRemaining(reiter[10], 10);

        expect(carryover.sinkAdjustedE).toBe(-0.04);
        expect(remaining.remainingE).toBe(0.96);
        expect(w.formatEinheit(remaining.remainingE)).toBe('0,960 Einheiten');
        expect(w.isTabDone({ ...reiter[10], hektar: 0.04 })).toBe(false);
    });
});

// ── Task 1 Folgefix: Entry-Bau mit round6 für Saat, 2-Stellen für Dünger ────
//
// Vor 507142b/2be0499 rundete _buildDrillEntry entry.einheit auf zwei
// Nachkommastellen, wodurch 0,004 Saat zu 0 wurde. Mit round6() bleibt der
// 6-Stellen-Wert für Berechnungen erhalten; Dünger behält seine kg-/2-Stellen-
// Logik (Issue: keine Doppel-Architektur einführen).

describe('_buildDrillEntry Saat-Präzision', () => {
    it('0,004 Saat wird auf 6 Nachkommastellen erhalten, nicht auf 0 gerundet', () => {
        const { window: w } = createDom();
        const tab = {
            hektar: 1, koerner: 50, koernerProEinheit: 50,
            fahrgassenEnabled: false, fahrgassenBreite: 0,
            duenger: 0,
        };
        var entry = w._buildDrillEntry(tab, 0.004, 100, 0.5, 0);
        // Saat: 6-Stellen-Semantik erhalten (nicht zu 0 reduziert)
        expect(entry.einheit).toBe(0.004);
        // Dünger: bestehende 2-Stellen-Logik (100 kg) unverändert
        expect(entry.duenger).toBe(100);
    });

    it('0,040 Saat bleibt mit 6 Nachkommastellen im Entry erhalten', () => {
        const { window: w } = createDom();
        const tab = {
            hektar: 1, koerner: 50, koernerProEinheit: 50,
            fahrgassenEnabled: false, fahrgassenBreite: 0,
            duenger: 0,
        };
        var entry = w._buildDrillEntry(tab, 0.04, 50, 0.5, 0);
        expect(entry.einheit).toBe(0.04);
        expect(entry.duenger).toBe(50);
    });
});
