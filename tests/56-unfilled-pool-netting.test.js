/**
 * Tests for Carryover-Pool-Definition (Regel 7, Issue #378 / Nachfolger #371).
 *
 * Kontext (PR #380): Der Carryover-Pool ist Σ used der done=false Tabs, OHNE
 * Mehrbedarf-Tabs (die sind Empfänger, nicht Spender). Vorherige Modelle mit
 * `basis - used` (unfilled) oder `Σ max(0, basis - used)` (Issue #371) sind
 * obsolet.
 *
 * Szenario (3 Tabs):
 *   Tab 0: 15ha SOLL, 16ha IST → SOLL 24 E / 3000 kg, IST 25,6 E / 3200 kg
 *          used=25,6 / 3200 (= basis, voll). IST > SOLL → MEHRBEDARF (Lücke 1,6 E / 200 kg).
 *   Tab 1: 7,5ha SOLL=IST, used=12 / 1500 (voll). Neutral. Pool-Spender.
 *   Tab 2: 5ha SOLL=IST, used=6,4 / 800. Neutral. Pool-Spender.
 *
 *   Pool Saat = Σ used (ohne Mehrbedarf) = 12 + 6,4 = 18,4 E.
 *   Pool Düng = 1500 + 800 = 2300 kg.
 *   Tab 0 Lücke 1,6 E / 200 kg wird voll gedeckt → nettedEinheit = 1,6.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Carryover-Pool (Regel 7): Σ used done=false Tabs (Nachfolger Issue #371)', () => {
    let w;

    beforeEach(() => {
        const result = createDom();
        w = result.window;
        w.state.koernerProEinheit = 50000;
    });

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

    it('Pool = Σ used (Regel 7) → Tab 0 (Mehrbedarf) bekommt seine Lücke aus dem Pool', () => {
        setupUserScenario();
        // Tab 0 (Mehrbedarf 1,6 E): Pool (Tab1+Tab2 used = 12+6,4=18,4 E) deckt Lücke voll.
        const co0 = w.getCarryover(0);
        expect(co0.nettedEinheit).toBeCloseTo(1.6, 1);
        expect(co0.nettedDuenger).toBeCloseTo(200, 0);
        // Tab 0: Quelle, spendet nicht selbst (Befund 1 / I6).
        expect(co0.excessEinheit).toBe(0);
        // savedEinheit ist unter Regel 7 immer 0.
        expect(co0.savedEinheit).toBe(0);
    });

    it('Tab 0 remaining = 0 (Mehrbedarf durch Pool gedeckt)', () => {
        setupUserScenario();
        const rem = w.getTabRemaining(w.state.reiter[0], 0);
        // remainingE = max(0, 25,6 - 25,6 + 0) = 0 (used = ist, kein Entzug für Quelle).
        expect(rem.remainingE).toBeCloseTo(0, 1);
        // remainingD = max(0, 3200 - 3200 + 0) = 0.
        expect(rem.remainingD).toBeCloseTo(0, 0);
    });

    it('Tab 2 (latest entry, spender-first) trägt den vollen Lücke-Beitrag', () => {
        setupUserScenario();
        // Tab 2 (13:00, latest by time) ist spender-first. Pool ist groß genug,
        // dass Tab 2 ALLE 1,6 E abgibt → excessE = 1,6.
        const co2 = w.getCarryover(2);
        expect(co2.excessEinheit).toBeCloseTo(1.6, 1);
        expect(co2.excessDuenger).toBeCloseTo(200, 0);
        // Tab 1: nicht angefasst (Pool noch voll).
        const co1 = w.getCarryover(1);
        expect(co1.excessEinheit).toBe(0);
    });

    // ── Edge: Pool < Mehrbedarf (issue #371-Konstellation, jetzt mit used) ──

    it('Edge: Pool < Mehrbedarf (kleine used-Werte) → nur teilweise Deckung', () => {
        // Tab 0: 15ha SOLL, 16ha IST → Lücke 1,6 E.
        // Tab 1: used=0.5 (kein Beitrag). Tab 2: used=0.5 (kein Beitrag).
        // Pool = 1,0 E < exc 1,6 → netted = 1,0; Lücke 0,6 offen.
        w.state.reiter[0] = {
            name: 'A', hektar: 15, istHektar: 16, koerner: 80000, duenger: 200,
            entries: [{ einheit: 25.6, duenger: 3200, time: '11:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[1] = {
            name: 'B', hektar: 7.5, istHektar: 7.5, koerner: 80000, duenger: 200,
            entries: [{ einheit: 0.5, duenger: 62.5, time: '12:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[2] = {
            name: 'C', hektar: 5, istHektar: 5, koerner: 80000, duenger: 200,
            entries: [{ einheit: 0.5, duenger: 62.5, time: '13:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.invalidateCarryoverCache();
        // Pool = 0,5 + 0,5 = 1,0 E. Tab 0 Lücke 1,6 E → netted 1,0.
        expect(w.getCarryover(0).nettedEinheit).toBeCloseTo(1.0, 1);
        // exc - netted = 1,6 - 1,0 = 0,6 ungedeckt (sichtbarer "Mehrbedarf-Rest").
        const ungedeckt = 1.6 - w.getCarryover(0).nettedEinheit;
        expect(ungedeckt).toBeCloseTo(0.6, 1);
    });

    // ── Edge: kein Pool (alle anderen Tabs voll/done) ────────────────────

    it('Edge: kein Pool (andere Tabs voll) → Tab 0 netted=0', () => {
        // Tab 1 + Tab 2 sind done (manuell abgeschlossen). Ihr used zählt
        // NICHT in den Pool (Regel 7.1: done=false).
        w.state.reiter[0] = {
            name: 'A', hektar: 15, istHektar: 16, koerner: 80000, duenger: 200,
            entries: [{ einheit: 25.6, duenger: 3200, time: '11:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[1] = {
            name: 'B', hektar: 7.5, istHektar: 7.5, koerner: 80000, duenger: 200,
            entries: [{ einheit: 12, duenger: 1500, time: '12:00' }],
            done: true,
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[2] = {
            name: 'C', hektar: 5, istHektar: 5, koerner: 80000, duenger: 200,
            entries: [{ einheit: 8, duenger: 1000, time: '13:00' }],
            done: true,
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.invalidateCarryoverCache();
        // Pool = 0 (alle done) → Tab 0 netted=0 → kompletter Mehrbedarf offen.
        expect(w.getCarryover(0).nettedEinheit).toBe(0);
        expect(w.getCarryover(0).nettedDuenger).toBe(0);
    });

    // ── Edge: mehrere Pool-Quellen ───────────────────────────────────────

    it('Edge: mehrere Pool-Quellen → Tab 2 (latest) spendet zuerst, dann Tab 1', () => {
        // Tab 0: Lücke 5 E (ist=21, sol=16). Tab 1: used=3. Tab 2: used=3. Pool = 6.
        // Tab 2 (latest, 13:00) spendet zuerst 3 → Tab 1 spendet Rest 2.
        // kpe=50000, koerner=80000 → solE = 10*80000/50000 = 16. istHektar=13.125 →
        // istE = 13.125*80000/50000 = 21. Mehrbedarf = 5.
        w.state.reiter[0] = {
            name: 'A', hektar: 10, istHektar: 13.125, koerner: 80000, duenger: 200,
            entries: [{ einheit: 21, duenger: 2625, time: '11:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[1] = {
            name: 'B', hektar: 7, istHektar: 7, koerner: 80000, duenger: 200,
            entries: [{ einheit: 3, duenger: 375, time: '12:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[2] = {
            name: 'C', hektar: 5, istHektar: 5, koerner: 80000, duenger: 200,
            entries: [{ einheit: 3, duenger: 375, time: '13:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.invalidateCarryoverCache();
        // Tab 0 Lücke = 5 E → Pool 6 E reicht: netted = 5.
        expect(w.getCarryover(0).nettedEinheit).toBeCloseTo(5, 1);
        // Tab 2 (latest) spendet zuerst 3 → Tab 1 spendet 2.
        // ABER: der Algorithmus sortiert spenderOrder in INVERSE lastEntry.time
        // (letzter zuerst), und alle Tabs (außer Mehrbedarf) sind drin.
        // Tab 2 (13:00) zuerst, Tab 1 (12:00) zweitens.
        // Tab 2 spendet bis Pool-Bedarf gedeckt ist: Tab 0 Lücke 5, Tab 2 hat 3
        // → Tab 2 spendet 3, Tab 0 noch 2 offen → Tab 1 spendet 2.
        expect(w.getCarryover(2).excessEinheit).toBeCloseTo(3, 1);
        expect(w.getCarryover(1).excessEinheit).toBeCloseTo(2, 1);
    });
});
