/**
 * Senken-Modell (Prio-Workfront) — Praxis-Tests + Erhaltungs-Invariante.
 *
 * Modell: Felder werden in PRIO-Reihenfolge bearbeitet. Der Netto-Saldo aus
 * IST-Abweichungen (Mehrbedarf/Ersparnis) wandert vorwärts und bleibt am zuletzt
 * befüllten Tab („Senke") hängen. Überfüllungen anderer Tabs schlucken den
 * Saldo (sonst Doppelfehler).
 *
 * Spec = der 4-Tab-Feld-Tag des Landwirts (3 Momente) + Erhaltung.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';
import { generateScenarios } from './helpers/invariant-generator.js';

const TOL = 0.5;

// 4-Tab-Szenario: alle 100000 Körner/ha, 200 kg Dünger/ha, kpe 50000 → 2 E/ha.
// Prio: T1=1, T2=2, T4=3, T3=4 (T3 zuletzt).
function baseTabs() {
    return [
        { name: 'F1', hektar: 10, istHektar: 0, koerner: 100000, duenger: 200,
          fahrgassenEnabled: false, fahrgassenBreite: 0, entries: [], done: false },
        { name: 'F2', hektar: 8, istHektar: 0, koerner: 100000, duenger: 200,
          fahrgassenEnabled: false, fahrgassenBreite: 0, entries: [], done: false },
        { name: 'F3', hektar: 10, istHektar: 0, koerner: 100000, duenger: 200,
          fahrgassenEnabled: false, fahrgassenBreite: 0, entries: [], done: false },
        { name: 'F4', hektar: 8, istHektar: 0, koerner: 100000, duenger: 200,
          fahrgassenEnabled: false, fahrgassenBreite: 0, entries: [], done: false },
    ];
}

describe('Senken-Modell: 4-Tab-Feld-Tag (3 Momente)', () => {
    let w;
    beforeEach(() => { w = createDom().window; });

    it('Moment 1 — nach Befüllung 1 (unbearbeitet): T2 nur Dünger 100 kg offen', () => {
        w.state.koernerProEinheit = 50000;
        w.state.drillPriorities = { 0: 1, 1: 2, 2: 4, 3: 3 };
        w.state.reiter = baseTabs();
        w.state.reiter[0].entries = [{ einheit: 20, duenger: 2000, time: '08:00' }];
        w.state.reiter[1].entries = [{ einheit: 16, duenger: 1500, time: '08:00' }];
        w.invalidateCarryoverCache();
        const rem = w.state.reiter.map((r, i) => w.getTabRemaining(r, i));
        expect(rem[0].remainingE).toBeCloseTo(0, 1); expect(rem[0].remainingD).toBeCloseTo(0, 0);
        expect(rem[1].remainingE).toBeCloseTo(0, 1); expect(rem[1].remainingD).toBeCloseTo(100, 0);
        expect(rem[2].remainingE).toBeCloseTo(20, 1); expect(rem[2].remainingD).toBeCloseTo(2000, 0);
        expect(rem[3].remainingE).toBeCloseTo(16, 1); expect(rem[3].remainingD).toBeCloseTo(1600, 0);
    });

    it('Moment 2 — Feld 1 fertig (IST 12): Mehrbedarf +4E/+400kg wandert auf T2 (Senke)', () => {
        w.state.koernerProEinheit = 50000;
        w.state.drillPriorities = { 0: 1, 1: 2, 2: 4, 3: 3 };
        w.state.reiter = baseTabs();
        w.state.reiter[0].istHektar = 12;
        w.state.reiter[0].entries = [{ einheit: 20, duenger: 2000, time: '08:00' }];
        w.state.reiter[1].entries = [{ einheit: 16, duenger: 1500, time: '08:00' }];
        w.invalidateCarryoverCache();
        const rem = w.state.reiter.map((r, i) => w.getTabRemaining(r, i));
        expect(rem[0].remainingE).toBeCloseTo(0, 1); expect(rem[0].remainingD).toBeCloseTo(0, 0);
        expect(rem[1].remainingE).toBeCloseTo(4, 1); expect(rem[1].remainingD).toBeCloseTo(500, 0);
        expect(rem[2].remainingE).toBeCloseTo(20, 1); expect(rem[2].remainingD).toBeCloseTo(2000, 0);
        expect(rem[3].remainingE).toBeCloseTo(16, 1); expect(rem[3].remainingD).toBeCloseTo(1600, 0);
        // Senke ist T2 (höchste Prio unter den 08:00-Tabs).
        expect(w.getCarryover(1).isSink).toBe(true);
    });

    it('Moment 3 — nach Befüllung 2: Mehrbedarf auf T3 (zuletzt bearbeitet), T2 wieder 0', () => {
        w.state.koernerProEinheit = 50000;
        w.state.drillPriorities = { 0: 1, 1: 2, 2: 4, 3: 3 };
        w.state.reiter = baseTabs();
        w.state.reiter[0].istHektar = 12;
        w.state.reiter[0].entries = [{ einheit: 20, duenger: 2000, time: '08:00' }];
        w.state.reiter[1].istHektar = 8;
        w.state.reiter[1].entries = [{ einheit: 16, duenger: 1500, time: '08:00' }, { einheit: 4, duenger: 500, time: '11:00' }];
        w.state.reiter[2].entries = [{ einheit: 16, duenger: 1400, time: '11:00' }]; // T3 unbearbeitet
        w.state.reiter[3].istHektar = 8;
        w.state.reiter[3].entries = [{ einheit: 16, duenger: 1600, time: '11:00' }];
        w.invalidateCarryoverCache();
        const rem = w.state.reiter.map((r, i) => w.getTabRemaining(r, i));
        expect(rem[0].remainingE).toBeCloseTo(0, 1); expect(rem[0].remainingD).toBeCloseTo(0, 0);
        expect(rem[1].remainingE).toBeCloseTo(0, 1); expect(rem[1].remainingD).toBeCloseTo(0, 0);
        expect(rem[2].remainingE).toBeCloseTo(4, 1); expect(rem[2].remainingD).toBeCloseTo(600, 0);
        expect(rem[3].remainingE).toBeCloseTo(0, 1); expect(rem[3].remainingD).toBeCloseTo(0, 0);
        // Senke = T3 (höchste Prio 4 unter den 11:00-Tabs).
        expect(w.getCarryover(2).isSink).toBe(true);
        // Σ = 4 E / 600 kg = Gesamt-Mehrbedarf des Auftrags.
        const sumE = rem.reduce((a, r) => a + r.remainingE, 0);
        const sumD = rem.reduce((a, r) => a + r.remainingD, 0);
        expect(sumE).toBeCloseTo(4, 1);
        expect(sumD).toBeCloseTo(600, 0);
    });
});

describe('Senken-Modell: Senken-Auswahl (Prio/Zeit/Index)', () => {
    let w;
    beforeEach(() => { w = createDom().window; });

    it('höchste Prio gewinnt bei gleicher Befüll-Zeit', () => {
        w.state.koernerProEinheit = 50000;
        w.state.drillPriorities = { 0: 1, 1: 3, 2: 2 };
        w.state.reiter = [
            { name: 'A', hektar: 5, istHektar: 6, koerner: 50000, duenger: 0, entries: [{ einheit: 5, duenger: 0, time: '09:00' }], done: false },
            { name: 'B', hektar: 5, istHektar: 5, koerner: 50000, duenger: 0, entries: [{ einheit: 5, duenger: 0, time: '09:00' }], done: false },
            { name: 'C', hektar: 5, istHektar: 5, koerner: 50000, duenger: 0, entries: [{ einheit: 5, duenger: 0, time: '09:00' }], done: false },
        ];
        w.invalidateCarryoverCache();
        // A überbestellt (IST 6>SOLL 5) → Mehrbedarf 1E; Senke = B (Prio 3, höchste).
        expect(w.getCarryover(1).isSink).toBe(true);
        expect(w.getCarryover(0).isSink).toBe(false);
        expect(w.getCarryover(2).isSink).toBe(false);
    });

    it('Fallback ohne Prio: zuletzt befüllt nach Uhrzeit', () => {
        w.state.koernerProEinheit = 50000;
        w.state.drillPriorities = {};
        w.state.reiter = [
            { name: 'A', hektar: 5, istHektar: 6, koerner: 50000, duenger: 0, entries: [{ einheit: 5, duenger: 0, time: '08:00' }], done: false },
            { name: 'B', hektar: 5, istHektar: 5, koerner: 50000, duenger: 0, entries: [{ einheit: 5, duenger: 0, time: '10:00' }], done: false },
        ];
        w.invalidateCarryoverCache();
        // Keine Prio → spätere Uhrzeit (B, 10:00) ist Senke.
        expect(w.getCarryover(1).isSink).toBe(true);
    });

    it('done-Tabs kommen nicht als Senke in Frage', () => {
        w.state.koernerProEinheit = 50000;
        w.state.drillPriorities = { 0: 1, 1: 2 };
        w.state.reiter = [
            { name: 'A', hektar: 5, istHektar: 6, koerner: 50000, duenger: 0, entries: [{ einheit: 5, duenger: 0, time: '12:00' }], done: true },
            { name: 'B', hektar: 5, istHektar: 5, koerner: 50000, duenger: 0, entries: [{ einheit: 5, duenger: 0, time: '10:00' }], done: false },
        ];
        w.invalidateCarryoverCache();
        // A ist done (obwohl später/höhere Prio) → B wird Senke.
        expect(w.getCarryover(0).isSink).toBe(false);
        expect(w.getCarryover(1).isSink).toBe(true);
    });
});

describe('Senken-Modell: Materialerhaltung', () => {
    let w;
    beforeEach(() => { w = createDom().window; });

    // physical = Σ(IST-Bedarf für bearb. + SOLL-Bedarf für unbearb.) − Σ used.
    function physical(rems, reiter) {
        let physE = 0, physD = 0;
        for (let i = 0; i < reiter.length; i++) {
            const r = reiter[i];
            const worked = r.istHektar > 0;
            const needE = worked ? w.getTabIstEinheiten(r) : w.getTabTotalEinheiten(r);
            const needD = worked ? w.getTabIstDuenger(r) : w.getTabTotalDuenger(r);
            physE += needE; physD += needD;
        }
        const usedE = reiter.reduce((a, r) => a + w.getTabUsedEinheiten(r), 0);
        const usedD = reiter.reduce((a, r) => a + w.getTabUsedDuenger(r), 0);
        return { E: physE - usedE, D: physD - usedD };
    }

    it('Clean-Szenarien (keine Senke-Clampung): Σ remaining === physical', () => {
        const scenarios = generateScenarios(0xC0FFEE, 400);
        let checked = 0;
        for (let s = 0; s < scenarios.length; s++) {
            w.state.koernerProEinheit = scenarios[s].koernerProEinheit;
            w.state.reiter = scenarios[s].reiter;
            // Generator setzt keine drillPriorities → Fallback Uhrzeit. Prio leer.
            w.state.drillPriorities = {};
            if (w.invalidateCarryoverCache) w.invalidateCarryoverCache();
            const rems = scenarios[s].reiter.map((r, i) => w.getTabRemaining(r, i));
            const cos = scenarios[s].reiter.map((_, i) => w.getCarryover(i));
            const sink = cos.findIndex(c => c.isSink);
            // Clean = kein Nicht-Senke überfüllt UND Senke nicht gecclamppt
            // (eigenes own + sinkAdjusted ≥ 0).
            const nonSinkOverfill = rems.some((r, i) => {
                if (i === sink) return false;
                const own = r.basisE - r.usedE;
                return own < -TOL; // überfüllt
            });
            const sinkClampedE = sink >= 0
                ? (rems[sink].basisE - rems[sink].usedE + cos[sink].sinkAdjustedE) < -TOL
                : false;
            if (nonSinkOverfill || sinkClampedE) continue;
            checked++;
            const phys = physical(rems, scenarios[s].reiter);
            const sumE = rems.reduce((a, r) => a + r.remainingE, 0);
            if (Math.abs(sumE - phys.E) > TOL) {
                throw new Error(`Erhaltung Saat verletzt Szenario[${s}]: Σrem=${sumE.toFixed(2)} ≠ phys=${phys.E.toFixed(2)}`);
            }
        }
        expect(checked).toBeGreaterThan(0);
    });

    it('Σ remaining ≥ 0 (niemals negativ)', () => {
        const scenarios = generateScenarios(0xC0FFEE, 200);
        for (let s = 0; s < scenarios.length; s++) {
            w.state.koernerProEinheit = scenarios[s].koernerProEinheit;
            w.state.reiter = scenarios[s].reiter;
            w.state.drillPriorities = {};
            if (w.invalidateCarryoverCache) w.invalidateCarryoverCache();
            const rems = scenarios[s].reiter.map((r, i) => w.getTabRemaining(r, i));
            for (const r of rems) {
                expect(r.remainingE).toBeGreaterThanOrEqual(-TOL);
                expect(r.remainingD).toBeGreaterThanOrEqual(-TOL);
            }
        }
    });
});
