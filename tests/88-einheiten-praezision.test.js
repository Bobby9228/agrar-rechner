/**
 * Einheiten werden intern auf 6 Nachkommastellen begrenzt und in der UI mit
 * 3 Nachkommastellen angezeigt. Kleine Feldabweichungen dürfen dabei nicht
 * unter der bisherigen 0,05-Einheiten-Schwelle verschwinden.
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

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
