/**
 * Tests for Issue #371 — Carryover-Regel 6: unfilled-Pool als Netting-Quelle.
 *
 * Physische Realität: das Material für einen Mehrbedarf-Tab wurde aus
 * noch-ungefüllten Tabs entnommen (used < basis). Das aktuelle Phase-0.5
 * Pool-Definition `max(0, exc - netExcess) = min(saved, exc)` ignoriert
 * diese unfilled Amounts vollständig — d.h. wenn es KEINE Ersparnis-Tabs
 * (IST<SOLL) gibt, wird auch nichts genettet. Korrekt muss die Pool-Definition
 * die Summe aller unfilled Amounts (basis - used) in Nicht-Mehrbedarf-Tabs
 * erfassen (Regel 6 der Carryover-Spec).
 *
 * Konkretes User-Szenario (vom User bestätigt, 2026-06-30):
 *
 *   Tab 1: 15ha SOLL, 16ha IST, voll          → Mehrbedarf 1,6E Saat, exc=200kg Dünger
 *   Tab 2: 7,5ha SOLL=IST, voll                → neutral
 *   Tab 3: 5ha SOLL=IST, teils (1,6E unfilled) → neutral, Pool-Quelle 1,6E Saat + 200kg Dünger
 *
 *   koernerProEinheit = 50000, koerner = 80000 → 1ha = 1,6 Einheiten, duenger = 200 kg/ha
 *     Tab 1: SOLL=24,0E, IST=25,6E, exc=1,6E (Mehrbedarf)
 *            Dünger: SOLL=3000kg, IST=3200kg, exc=200kg
 *     Tab 2: SOLL=IST=12,0E, voll → unfilled=0
 *     Tab 3: SOLL=IST=8,0E, used=6,4E → unfilled=1,6E
 *            Dünger: SOLL=IST=1000kg, used=800kg → unfilled=200kg
 *
 *   Erwartet mit Regel 6: PoolE = 0+1,6 = 1,6 → Tab1 nettedEinheit=1,6 → remaining=0
 *                         PoolD = 0+200 = 200 → Tab1 nettedDuenger=200 → remaining=0
 *
 *   Aktuell (vor #371): PoolE = max(0, excE - netExcessE) = max(0, 1,6−1,6) = 0
 *                        → Tab1 nettedEinheit=0 → remaining=1,6E (BUG).
 *
 *   Tab 2 und Tab 3 sind "NICHT Mehrbedarf" — daher tragen sie zum Pool bei.
 *   Tab 1 ist Mehrbedarf-Empfänger → aus Pool ausgeschlossen.
 *
 *   Edge-Case 1: unfilled < Mehrbedarf (1,0E < 1,6E) → Pool kann nur 1,0E decken,
 *                Tab1 netted=1,0, remaining=0,6E.
 *   Edge-Case 2: kein unfilled in anderen Tabs (Tab2+Tab3 voll) → Pool=0,
 *                netted=0, Tab1 zeigt exc=1,6E.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

// ── Hinweis: Was dieser Test NICHT deckt (Issue #371 Reopen Teil 2) ────────
//
// Die `getTabRemaining === 0`-Assertions unten sind nicht falsch, aber nicht
// aussagekräftig: für einen voll befüllten Mehrbedarf-Tab ist `getTabRemaining`
// IMMER 0 (Formel `max(0, basisE − usedE − ... − netted)` mit `basisE=usedE`).
// Der eigentliche User-Bug — die sichtbare "Mehrbedarf"-Zeile in der Ergebnis-
// Karte, die trotz remaining=0 weiterhin 1,6 E anzeigt — wird davon NICHT
// erfasst. Der echte Regressionsschutz für diesen Bug lebt in
// tests/57-render-excess-netted.test.js, der `computeShownExcess` und die
// `.r-carryover-excess`-DOM-Zeile direkt prüft.
// ──────────────────────────────────────────────────────────────────────────

describe('Carryover Regel 6 — unfilled-Pool als Netting-Quelle (Issue #371)', () => {
    let w;

    beforeEach(() => {
        const result = createDom();
        w = result.window;
        w.state.koernerProEinheit = 50000;
    });

    // ── User-Hauptszenario ─────────────────────────────────────────────────
    //
    // Tab 1: 15ha SOLL, 16ha IST, used=25,6E (= basis). Mehrbedarf 1,6E.
    // Tab 2: 7,5ha SOLL=IST, used=12E (= basis). Neutral, leerer Pool.
    // Tab 3: 5ha SOLL=IST, used=6,4E (basis−1,6E). Pool-Quelle 1,6E Saat + 200kg Dünger.
    function setupUserScenario() {
        w.state.reiter[0] = {
            name: 'Acker 1', hektar: 15, istHektar: 16, koerner: 80000, duenger: 200,
            entries: [{ einheit: 25.6, duenger: 3200, time: '11:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[1] = {
            name: 'Acker 2', hektar: 7.5, istHektar: 7.5, koerner: 80000, duenger: 200,
            entries: [{ einheit: 12, duenger: 1500, time: '12:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[2] = {
            name: 'Acker 3', hektar: 5, istHektar: 5, koerner: 80000, duenger: 200,
            entries: [{ einheit: 6.4, duenger: 800, time: '13:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        if (w.invalidateCarryoverCache) w.invalidateCarryoverCache();
    }

    it('User-Szenario: Tab1 (Mehrbedarf) zeigt remaining Saat = 0', () => {
        setupUserScenario();
        const r1 = w.state.reiter[0];
        const rem = w.getTabRemaining(r1, 0);
        // Erwartet: 1,6E Pool aus Tab3 → nettedEinheit=1,6
        //   remaining = max(0, 25,6 − 25,6 − 0 + 0 − 1,6) = 0
        expect(rem.remainingE).toBeCloseTo(0, 1);
    });

    it('User-Szenario: Tab1 zeigt remaining Dünger = 0', () => {
        setupUserScenario();
        const r1 = w.state.reiter[0];
        const rem = w.getTabRemaining(r1, 0);
        // Pool=200kg aus Tab3 → nettedDuenger=200
        //   remaining = max(0, 3200 − 3200 − 0 + 0 − 200) = 0
        expect(rem.remainingD).toBeCloseTo(0, 1);
    });

    it('User-Szenario: Tab1 nettedEinheit === 1,6 (komplette Pool-Zuweisung)', () => {
        setupUserScenario();
        const co = w.getCarryover(0);
        expect(co.nettedEinheit).toBeCloseTo(1.6, 1);
    });

    it('User-Szenario: Tab1 nettedDuenger === 200 (komplette Pool-Zuweisung)', () => {
        setupUserScenario();
        const co = w.getCarryover(0);
        expect(co.nettedDuenger).toBeCloseTo(200, 0);
    });

    it('User-Szenario: Tab3 (Pool-Quelle) bleibt unverändert (netted=0, saved=0)', () => {
        setupUserScenario();
        const co = w.getCarryover(2);
        // Tab3 ist neutral — unfilled wird nur als Pool-Größe erfasst, NICHT als
        // savedCarryover dieses Tabs.
        expect(co.nettedEinheit).toBe(0);
        expect(co.nettedDuenger).toBe(0);
        expect(co.savedEinheit).toBe(0);
        expect(co.savedDuenger).toBe(0);
    });

    // ── Edge-Case 1: unfilled < Mehrbedarf ─────────────────────────────────

    it('Edge: unfilled 1,0E < Mehrbedarf 1,6E → Tab1 netted=1,0 (Pool aufgebraucht)', () => {
        // Tab3: used=7,0E → unfilled=1,0E (statt 1,6E).
        // Pool=1,0E < exc=1,6E → Tab1 netted=1,0 (Pool leer), 0,6E Mehrbedarf UNABDECKT.
        w.state.reiter[0] = {
            name: 'Acker 1', hektar: 15, istHektar: 16, koerner: 80000, duenger: 200,
            entries: [{ einheit: 25.6, duenger: 3200, time: '11:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[1] = {
            name: 'Acker 2', hektar: 7.5, istHektar: 7.5, koerner: 80000, duenger: 200,
            entries: [{ einheit: 12, duenger: 1500, time: '12:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[2] = {
            name: 'Acker 3', hektar: 5, istHektar: 5, koerner: 80000, duenger: 200,
            entries: [{ einheit: 7, duenger: 875, time: '13:00' }], // used=7 → unfilled=1E
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.invalidateCarryoverCache();
        const co = w.getCarryover(0);
        // Pool=1,0E < exc=1,6E → Tab1 bekommt 1,0 aus dem Pool, 0,6E bleibt offen.
        expect(co.nettedEinheit).toBeCloseTo(1.0, 1);
        // exc − netted = 1,6 − 1,0 = 0,6 → das ist der ungedeckte Mehrbedarf-Anteil,
        // der im UI als "Mehrbedarf verbleibend" angezeigt wird (exc - netted, nicht
        // getTabRemaining.remainingE — siehe renderResults für die genaue Anzeige).
        expect(1.6 - co.nettedEinheit).toBeCloseTo(0.6, 1);
    });

    // ── Edge-Case 2: kein unfilled in anderen Tabs ────────────────────────

    it('Edge: kein unfilled in anderen Tabs → Tab1 netted=0 (kein Pool)', () => {
        // Tab2 und Tab3 sind vollständig gefüllt → unfilled = 0.
        w.state.reiter[0] = {
            name: 'Acker 1', hektar: 15, istHektar: 16, koerner: 80000, duenger: 200,
            entries: [{ einheit: 25.6, duenger: 3200, time: '11:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[1] = {
            name: 'Acker 2', hektar: 7.5, istHektar: 7.5, koerner: 80000, duenger: 200,
            entries: [{ einheit: 12, duenger: 1500, time: '12:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[2] = {
            name: 'Acker 3', hektar: 5, istHektar: 5, koerner: 80000, duenger: 200,
            entries: [{ einheit: 8, duenger: 1000, time: '13:00' }], // voll
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.invalidateCarryoverCache();
        const co = w.getCarryover(0);
        // Pool=0 → Tab1 netted=0
        expect(co.nettedEinheit).toBe(0);
        expect(co.nettedDuenger).toBe(0);
    });

    // ── Edge-Case 3: mehrere unfilled-Quellen ─────────────────────────────

    it('Edge: mehrere unfilled-Quellen — Pool = Summe über alle nicht-Mehrbedarf-Tabs', () => {
        // Tab1: Mehrbedarf 1,6E. Tab2: 0,6E unfilled. Tab3: 1,0E unfilled.
        // Pool = 0,6 + 1,0 = 1,6E → deckt komplett.
        w.state.reiter[0] = {
            name: 'Acker 1', hektar: 15, istHektar: 16, koerner: 80000, duenger: 200,
            entries: [{ einheit: 25.6, duenger: 3200, time: '11:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[1] = {
            name: 'Acker 2', hektar: 7.5, istHektar: 7.5, koerner: 80000, duenger: 200,
            // used=11,4 → unfilled=0,6E (basis=12)
            entries: [{ einheit: 11.4, duenger: 1425, time: '12:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[2] = {
            name: 'Acker 3', hektar: 5, istHektar: 5, koerner: 80000, duenger: 200,
            // used=7 → unfilled=1,0E (basis=8)
            entries: [{ einheit: 7, duenger: 875, time: '13:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.invalidateCarryoverCache();
        const co = w.getCarryover(0);
        // Pool = 0,6 + 1,0 = 1,6E = exc → Tab1 komplett abgedeckt
        expect(co.nettedEinheit).toBeCloseTo(1.6, 1);
    });
});
