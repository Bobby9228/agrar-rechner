/**
 * Issue #371 (Reopen) Teil 2 — render-results.js Mehrbedarf-Anzeige zieht
 * Cross-Tab-Netting (co.nettedEinheit/nettedDuenger) ab.
 *
 * Bug-Hintergrund:
 *   PR #373 (Teil 1) hat `getCarryover` korrekt erweitert — `co.nettedEinheit`
 *   reflektiert jetzt den Cross-Tab-Pool, der den Mehrbedarf deckt.
 *   `getTabRemaining` für einen *voll befüllten* Mehrbedarf-Tab ist darum
 *   bereits 0. ABER die vom User gesehene "Mehrbedarf aus überschrittenen
 *   Flächen"-Zeile in `renderResultCard` (render-results.js) wurde aus dem
 *   ROHEN IST−SOLL gebildet und zog `netted*` NICHT ab — also zeigte sie
 *   weiterhin 1,6 E Saatgut, obwohl `remaining = 0` ist.
 *
 * Fix:
 *   - Neue Pure-Helper-Funktion `computeShownExcess(raw, co)` in
 *     public/js/render-results.js. Sie subtrahiert co.nettedEinheit/
 *     nettedDuenger vom Roh-Mehrbedarf und klemmt bei 0.
 *   - renderResultCard nutzt den Helper und blendet die Mehrbedarf-Zeile
 *     komplett aus, wenn beide Komponenten ≤ 0.05 sind.
 *
 * Test-Strategie (ANTI-ZIRKULÄR):
 *   Wir asserten auf `computeShownExcess` direkt und auf den gerenderten DOM
 *   (`.r-carryover-excess` Zeile fehlt/zeigt angepassten Wert) — NICHT auf
 *   `getTabRemaining`. Grund: `getTabRemaining` für volle Mehrbedarf-Tabs ist
 *   IMMER 0 (Formel max(0, basis−used−...) mit basis=used), darum konnte der
 *   alte Test in `tests/56-unfilled-pool-netting.test.js` grün sein, obwohl
 *   die Anzeige noch kaputt war. Siehe auskommentierten Hinweis in tests/56.
 *
 * User-Szenario (Issue #371, vom User bestätigt):
 *   Tab 1: 15ha SOLL, 16ha IST, voll         → Mehrbedarf 1,6E Saat + 200kg Dünger
 *   Tab 2: 7,5ha SOLL=IST, voll              → neutral, Pool leer
 *   Tab 3: 5ha SOLL=IST, 1,6E unfilled        → neutral, Pool-Quelle 1,6E Saat + 200kg Dünger
 *
 *   koernerProEinheit=50000, koerner=80000 → 1ha = 1,6 E, duenger=200 kg/ha
 *
 *   Erwartung:
 *     - computeShownExcess für Tab1 mit co.nettedEinheit=1.6, nettedDuenger=200
 *       → shownExcessE=0, shownExcessD=0.
 *     - renderResultCard zeigt für aktiven Tab1 KEINE .r-carryover-excess-Zeile.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Issue #371 (Reopen) Teil 2 — render-results Mehrbedarf zieht Netting ab', () => {
    let w, doc;

    beforeEach(() => {
        const result = createDom();
        w = result.window;
        doc = w.document;
        w.state.koernerProEinheit = 50000;
    });

    // ── User-Hauptszenario: 3 Tabs, Tab1 Mehrbedarf + Tab3 Pool-Quelle ─────

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

    it('User-Szenario: computeShownExcess für Tab1 liefert shownExcessE=0', () => {
        setupUserScenario();
        const r1 = w.state.reiter[0];
        // Roh-Mehrbedarf: 16ha - 15ha = 1ha → 1.6 E Saatgut
        const rawE = w.getTabIstEinheiten(r1) - w.getTabTotalEinheiten(r1);
        expect(rawE).toBeCloseTo(1.6, 1);
        // Carryover für Tab1: nettedEinheit = 1.6 (Pool aus Tab3 deckt komplett)
        const co = w.getCarryover(0);
        expect(co.nettedEinheit).toBeCloseTo(1.6, 1);
        // Helper: 1.6 - 1.6 = 0
        const shown = w.computeShownExcess({ excessE: rawE, excessD: 200 }, co);
        expect(shown.shownExcessE).toBeCloseTo(0, 1);
    });

    it('User-Szenario: computeShownExcess für Tab1 liefert shownExcessD=0', () => {
        setupUserScenario();
        const co = w.getCarryover(0);
        expect(co.nettedDuenger).toBeCloseTo(200, 0);
        const shown = w.computeShownExcess({ excessE: 1.6, excessD: 200 }, co);
        expect(shown.shownExcessD).toBeCloseTo(0, 0);
    });

    it('User-Szenario: renderResultCard blendet Mehrbedarf-Zeile für Tab1 komplett aus', () => {
        setupUserScenario();
        w.state.activeReiter = 0;
        w.renderResults();
        // Keine .r-carryover-excess-Zeile im Hint-Container.
        const hint = doc.getElementById('r_carryover_hint');
        expect(hint).not.toBeNull();
        const excess = hint.querySelector('.r-carryover-excess');
        expect(excess).toBeNull();
    });

    it('User-Szenario: renderResultCard für Tab1 zeigt keine "Mehrbedarf"-Zeile im Klartext', () => {
        setupUserScenario();
        w.state.activeReiter = 0;
        w.renderResults();
        const hint = doc.getElementById('r_carryover_hint');
        expect(hint.textContent).not.toContain('Mehrbedarf');
    });

    // ── Edge-Case 1: Pool < Mehrbedarf → Rest-Mehrbedarf sichtbar ─────
    //
    // Regel 7 Pool (Issue #378): Pool = Σ used(done=false, non-Mehrbedarf).
    // Wir bauen absichtlich einen Pool kleiner als den Mehrbedarf (Tab1 hat
    // used=0,5E < Tab0 Lücke=1,6E), damit shownExcess > 0 bleibt.
    //   Tab0 (active): solE=10, istE=11.6, koerner=50000, kpe=50000, duenger=200
    //           → Mehrbedarf 1,6 E Saat + 320 kg Dünger
    //   Tab1:        hectare=10, istHektar=10, kein Mehrbedarf, used=0,5/100
    //           → Pool Saat=0,5, Pool Dünger=100. Tab0 netted = 0,5/100.
    //           → shownExcessE = 1,6 - 0,5 = 1,1; shownExcessD = 320 - 100 = 220.

    it('Edge 1: Pool=0,5E < Mehrbedarf 1,6E → shownExcessE=1,1 (Rest sichtbar)', () => {
        w.state.reiter[0] = {
            name: 'Acker 1', hektar: 10, istHektar: 11.6, koerner: 50000, duenger: 200,
            entries: [{ einheit: 11.6, duenger: 2320, time: '11:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[1] = {
            name: 'Acker 2', hektar: 10, istHektar: 10, koerner: 50000, duenger: 200,
            entries: [{ einheit: 0.5, duenger: 100, time: '12:00' }], // kleiner Spender
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.invalidateCarryoverCache();
        const co = w.getCarryover(0);
        // Pool=0,5E < exc=1,6E → Tab0 netted=0,5
        expect(co.nettedEinheit).toBeCloseTo(0.5, 1);
        // Helper: 1,6 - 0,5 = 1,1 (Rest-Mehrbedarf)
        const shown = w.computeShownExcess({ excessE: 1.6, excessD: 320 }, co);
        expect(shown.shownExcessE).toBeCloseTo(1.1, 1);
        // Dünger: Pool D=100, exc D=320, taken=100, Rest=220.
        expect(co.nettedDuenger).toBeCloseTo(100, 0);
        expect(shown.shownExcessD).toBeCloseTo(220, 0);
    });

    it('Edge 1: renderResultCard zeigt die Mehrbedarf-Zeile mit Rest-Werten', () => {
        w.state.reiter[0] = {
            name: 'Acker 1', hektar: 10, istHektar: 11.6, koerner: 50000, duenger: 200,
            entries: [{ einheit: 11.6, duenger: 2320, time: '11:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[1] = {
            name: 'Acker 2', hektar: 10, istHektar: 10, koerner: 50000, duenger: 200,
            entries: [{ einheit: 0.5, duenger: 100, time: '12:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.invalidateCarryoverCache();
        w.state.activeReiter = 0;
        w.renderResults();
        const excess = doc.querySelector('.r-carryover-excess');
        expect(excess).not.toBeNull();
        // Rest-Mehrbedarf 1,1 E Saatgut (fmt formatiert mit Komma)
        expect(excess.textContent).toContain('1,1');
        expect(excess.textContent).toContain('Einheiten Saatgut');
    });

    // ── Edge-Case 2: kein Pool (alle anderen Tabs done) → voller Mehrbedarf ────

    it('Edge 2: alle anderen Tabs done → Pool=0 → shownExcessE=1,6 (voller Mehrbedarf)', () => {
        // Tab0: Mehrbedarf 1,6 E Saat + 320 kg Dünger.
        // Tab1: done=true → sein used zählt NICHT in den Pool (Regel 7.1).
        w.state.reiter[0] = {
            name: 'Acker 1', hektar: 10, istHektar: 11.6, koerner: 50000, duenger: 200,
            entries: [{ einheit: 11.6, duenger: 2320, time: '11:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[1] = {
            name: 'Acker 2', hektar: 10, istHektar: 10, koerner: 50000, duenger: 200,
            entries: [{ einheit: 0.5, duenger: 100, time: '12:00' }],
            done: true,  // done → raus aus dem Pool
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.invalidateCarryoverCache();
        const co = w.getCarryover(0);
        // Pool=0 → netted=0
        expect(co.nettedEinheit).toBe(0);
        expect(co.nettedDuenger).toBe(0);
        // Helper: 1,6 - 0 = 1,6 (voller Mehrbedarf)
        const shown = w.computeShownExcess({ excessE: 1.6, excessD: 320 }, co);
        expect(shown.shownExcessE).toBeCloseTo(1.6, 1);
        expect(shown.shownExcessD).toBeCloseTo(320, 0);
    });

    it('Edge 2: renderResultCard zeigt die volle Mehrbedarf-Zeile (1,6 E Saatgut)', () => {
        w.state.reiter[0] = {
            name: 'Acker 1', hektar: 10, istHektar: 11.6, koerner: 50000, duenger: 200,
            entries: [{ einheit: 11.6, duenger: 2320, time: '11:00' }],
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.state.reiter[1] = {
            name: 'Acker 2', hektar: 10, istHektar: 10, koerner: 50000, duenger: 200,
            entries: [{ einheit: 0.5, duenger: 100, time: '12:00' }],
            done: true,
            fahrgassenEnabled: false, fahrgassenBreite: 0
        };
        w.invalidateCarryoverCache();
        w.state.activeReiter = 0;
        w.renderResults();
        const excess = doc.querySelector('.r-carryover-excess');
        expect(excess).not.toBeNull();
        expect(excess.textContent).toContain('1,6');
        expect(excess.textContent).toContain('Einheiten Saatgut');
    });

    // ── Pure-Helper-Invariante (kein DOM, keine Setup-Abhängigkeit) ──────

    it('Helper: shownExcess klemmt bei 0 wenn netted > raw (numerische Klammerung)', () => {
        // Rein arithmetischer Test des Helpers — kein State-Setup nötig.
        const shown = w.computeShownExcess(
            { excessE: 1.0, excessD: 100 },
            { nettedEinheit: 1.5, nettedDuenger: 200 } // netted > raw (unmöglich in
                                                       // echter Logik, aber Helper
                                                       // muss robust klemmen)
        );
        expect(shown.shownExcessE).toBe(0);
        expect(shown.shownExcessD).toBe(0);
    });

    it('Helper: nil-safe — fehlende/undefined Felder werden als 0 behandelt', () => {
        // Garantiert, dass renderResultCard nicht abstürzt, wenn die Carryover-
        // Pipeline (noch) keinen gültigen Wert liefert (Edge: leerer State).
        expect(() => w.computeShownExcess(undefined, undefined)).not.toThrow();
        const empty = w.computeShownExcess(undefined, undefined);
        expect(empty.shownExcessE).toBe(0);
        expect(empty.shownExcessD).toBe(0);
        // Teilweise undefined (z.B. wenn netted* noch nicht gesetzt ist)
        const partial = w.computeShownExcess({ excessE: 0.5 }, { savedEinheit: 0 });
        expect(partial.shownExcessE).toBe(0.5);
        expect(partial.shownExcessD).toBe(0);
    });

    it('Helper: reiner Durchreich-Wert ohne Carryover-Einfluss', () => {
        // Wenn netted=0, muss der Helper den Roh-Wert unverändert durchreichen.
        const shown = w.computeShownExcess(
            { excessE: 2.5, excessD: 75 },
            { nettedEinheit: 0, nettedDuenger: 0 }
        );
        expect(shown.shownExcessE).toBeCloseTo(2.5, 2);
        expect(shown.shownExcessD).toBeCloseTo(75, 0);
    });
});