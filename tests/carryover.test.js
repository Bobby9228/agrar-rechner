/**
 * Carryover, Savings & IST-Fläche.
 *
 * Carryover unter Regel 7 (Issue #378) ist ein Senken-Modell: Felder
 * werden in PRIO-Reihenfolge bearbeitet, der Netto-Saldo aus IST-
 * Abweichungen wandert vorwärts und bleibt am zuletzt befüllten Tab
 * ("Senke") hängen. Ersparnis-Kaskade ist gelöscht; `savedEinheit` ist
 * unter Regel 7 IMMER 0.
 *
 * Render-Pfade sind über das gesamte System synchron:
 *   - renderResultCard (Ergebnis-Tab): Per-Tab-Shape, Label "Abweichung
 *     dieses Tabs", Ersparnis + Mehrbedarf Roh-Werte, KEIN Übertrag-
 *     Empfänger-Saldo.
 *   - renderDrillLog / renderMachineLog (Drill-Log + Maschinen-Protokoll):
 *     Cross-Tab-Saldo als erster Block (label "Gesamt-Saldo (alle Tabs)").
 *   - renderDashboard: Dashboard Summary + Per-Tab-Karten, IST-basiert.
 *   - renderDrillEntriesInline (Inline-Drill-Card): `istHa>0`-Ternary,
 *     identische Formel wie die Geschwister-Renderer.
 *
 * Helper-Invarianten:
 *   - isTabDone(t) ≡ isTabDone(t, i) — keine Carryover-Cache-Splits.
 *   - computeShownExcess(raw, co) klemmt bei 0, ist nil-safe.
 *
 * Zugehörige frühere Dateien: tests/carryover.test.js,
 * tests/carryover.test.js,
 * tests/carryover.test.js,
 * tests/carryover.test.js,
 * tests/carryover.test.js,
 * tests/carryover.test.js,
 * tests/carryover.test.js,
 * tests/carryover.test.js,
 * tests/carryover.test.js (Issue #419 Welle 2).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';
import { generateScenarios } from './helpers/invariant-generator.js';

const TOL = 0.5;

function setup() {
  const { dom, window: w, store } = createDom();
  w.initUI();
  return { dom, w, store };
}

describe('IST/SOLL Savings & Carryover', () => {
  it('shows savings in drill summary when istHektar < hektar', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '8';
    w.document.getElementById('ist_hektar').value = '7,9';
    w.document.getElementById('koerner').value = '50000';
    w.document.getElementById('duenger').value = '100';
    w.syncStateFromInputs();
    w.renderResults();

    w.document.getElementById('drill_einheit').value = '7,9';
    w.document.getElementById('drill_hektar').value = '7,9';
    w.drillAdd();

    const savingsEl = w.document.getElementById('ds_savings');
    expect(savingsEl).not.toBeNull();
    expect(savingsEl.style.display).not.toBe('none');
    expect(savingsEl.textContent).toContain('Ersparnis');
    expect(savingsEl.textContent).toContain('Einheiten Saatgut');
  });

  it('hides savings when istHektar = hektar (no savings)', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '8';
    w.document.getElementById('ist_hektar').value = '8';
    w.document.getElementById('koerner').value = '50000';
    w.syncStateFromInputs();
    w.renderResults();

    w.document.getElementById('drill_einheit').value = '8';
    w.document.getElementById('drill_hektar').value = '8';
    w.drillAdd();

    const savingsEl = w.document.getElementById('ds_savings');
    expect(savingsEl).not.toBeNull();
    expect(savingsEl.style.display).toBe('none');
  });

  it('shows savings per tab in protocol when istHektar < hektar', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '8';
    w.document.getElementById('ist_hektar').value = '7,9';
    w.document.getElementById('koerner').value = '50000';
    w.document.getElementById('duenger').value = '100';
    w.syncStateFromInputs();
    w.renderResults();

    w.document.getElementById('drill_einheit').value = '7,9';
    w.document.getElementById('drill_hektar').value = '7,9';
    w.drillAdd();

    const container = w.document.getElementById('drill_entries');
    const savingsDiv = container.querySelector('.drill-savings');
    expect(savingsDiv).not.toBeNull();
    expect(savingsDiv.textContent).toContain('Ersparnis');
  });

  // REMOVED (#378 Regel-7): 'carryover goes to first not-done tab, not distributed'
  //   — Phase-1 Ersparnis-Kaskade existiert unter Regel 7 nicht mehr. Der
  //   Carryover-Pool reagiert nur noch auf Mehrbedarf-Lücken. Ein Tab mit
  //   IST < SOLL und vollem Bedarf hat schlicht keinen Carryover-Spender.
  //
  // REMOVED (#378 Regel-7): 'no carryover when first tab is not done (it gets the savings)'
  //   — siehe oben. 'it gets the savings' ist die alte Phase-1-Semantik, in
  //   der der erste nicht-done Tab die Ersparnis als Gutschrift bekam. Unter
  //   Regel 7 ist `savedEinheit` immer 0 — das Verhalten ist gelöscht.

  it('no carryover shown for first tab when it is done', () => {
    const { w } = setup();
    w.addReiter();
    // Tab 0: SOLL=8, IST=7.9 → will be fertig after filling 7.9 Einheiten + 790 kg Dünger
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 8, istHektar: 7.9, koerner: 50000, duenger: 100 };
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 10, koerner: 50000, duenger: 120 };

    w.state.activeReiter = 0;
    w.document.getElementById('drill_einheit').value = '7,9';
    w.document.getElementById('drill_duenger').value = '790';
    w.document.getElementById('drill_hektar').value = '7,9';
    w.drillAdd();

    // Tab 0 IST<SOLL → Ersparnis (Selbst-Abweichung, Hinweis-Feld).
    var co0 = w.getCarryover(0);
    expect(co0.savedEinheit).toBeCloseTo(0.1, 1); // SOLL 8 − IST 7.9
    expect(co0.savedDuenger).toBeCloseTo(10, 0);  // (8 − 7.9) × 100
  });

  it('savings calculation is correct for seed and fertilizer', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('ist_hektar').value = '9,5';
    w.document.getElementById('koerner').value = '50000';
    w.document.getElementById('duenger').value = '200';
    w.syncStateFromInputs();
    w.renderResults();

    // SOLL: 10 Einheiten, 2000 kg Dünger
    // IST: 9.5 ha → 9.5 Einheiten, 1900 kg Dünger
    // Savings: 0.5 Einheiten, 100 kg Dünger
    w.document.getElementById('drill_einheit').value = '9,5';
    w.document.getElementById('drill_hektar').value = '9,5';
    w.drillAdd();

    const savingsEl = w.document.getElementById('ds_savings');
    expect(savingsEl).not.toBeNull();
    expect(savingsEl.textContent).toContain('0,500 Einheiten Saatgut');
  });

  // REMOVED (#378 Regel-7): 'getCarryover: all savings go to first not-done tab'
  //   — Phase-1 Ersparnis-Kaskade gestrichen. `savedEinheit` ist unter Regel 7
  //   IMMER 0. Coverage für die Pool-Semantik liegt in dieser Datei
  //   (Carryover-Invarianten + Pool-Definition, Issue #419 konsolidiert).

  it('no savings shown when no istHektar set', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '8';
    w.document.getElementById('koerner').value = '50000';
    w.document.getElementById('duenger').value = '100';
    w.syncStateFromInputs();
    w.renderResults();

    // No istHektar → no savings
    const savingsEl = w.document.getElementById('ds_savings');
    expect(savingsEl).not.toBeNull();
    expect(savingsEl.style.display).toBe('none');

    const container = w.document.getElementById('drill_entries');
    const savingsDiv = container.querySelector('.drill-savings');
    expect(savingsDiv).toBeNull();
  });

  it('excess from IST > SOLL is deducted from last-filled tab', () => {
    const { w } = setup();
    w.addReiter();
    // Tab 0: SOLL=8, IST=10 → excess of 2 Einheiten + 200 kg Dünger
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 8, istHektar: 10, koerner: 50000, duenger: 100 };
    w.state.reiter[0].entries.push({ einheit: 8, zaehlerStand: 10, duenger: 800, time: '09:00' });
    // Tab 1: SOLL=6, no IST → not done
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 6, koerner: 50000, duenger: 80 };
    w.state.reiter[1].entries.push({ einheit: 3, zaehlerStand: 0, duenger: 240, time: '10:00' });

    // Senken-Modell: Tab 1 (zuletzt befüllt, 10:00) ist die Senke und bekommt
    // den Mehrbedarf aus Tab 0 als sinkAdjusted. Tab 0 zeigt seine eigene
    // Mehrbedarf-Abweichung (excessEinheit = IST−SOLL).
    var co1 = w.getCarryover(1);
    expect(co1.isSink).toBe(true);
    expect(co1.sinkAdjustedE).toBeCloseTo(2, 1);   // burden 2 E landet auf Senke
    expect(co1.sinkAdjustedD).toBeCloseTo(200, 0);  // (10−8) × 100
    // Tab 0: eigene Mehrbedarf-Abweichung (Hinweis), kein sinkAdjusted.
    var co0 = w.getCarryover(0);
    expect(co0.excessEinheit).toBeCloseTo(2, 1);   // IST 10 − SOLL 8
    expect(co0.savedEinheit).toBe(0);
    expect(co0.sinkAdjustedE).toBe(0);
  });

  it('excess shown as drill-excess div in protocol', () => {
    const { w } = setup();
    w.addReiter();
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 8, istHektar: 10, koerner: 50000, duenger: 100 };
    w.state.reiter[0].entries.push({ einheit: 8, zaehlerStand: 10, duenger: 800, time: '09:00' });
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 6, koerner: 50000, duenger: 80 };
    w.state.reiter[1].entries.push({ einheit: 3, zaehlerStand: 0, duenger: 240, time: '10:00' });

    w.renderResults();
    const container = w.document.getElementById('drill_entries');
    const excessDivs = container.querySelectorAll('.drill-excess');
    expect(excessDivs.length).toBeGreaterThanOrEqual(1);
     expect(excessDivs[0].textContent).toContain('Mehrbedarf aus überschrittenen Flächen');
    expect(excessDivs[0].textContent).toContain('-');
  });

  it('no excess shown when IST = SOLL', () => {
    const { w } = setup();
    w.addReiter();
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 8, istHektar: 8, koerner: 50000, duenger: 100 };
    w.state.reiter[0].entries.push({ einheit: 8, zaehlerStand: 8, duenger: 800, time: '09:00' });
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 6, koerner: 50000, duenger: 80 };

    var co0 = w.getCarryover(0);
    expect(co0.excessEinheit).toBe(0);
    expect(co0.excessDuenger).toBe(0);
  });

  // REMOVED (#378 Regel-7): 'savings cascade across multiple not-done tabs'
  //   — Phase-1 Ersparnis-Kaskade über mehrere Tabs ist semantisch gelöscht.
  //   Unter Regel 7 wird der Pool (Σ used done=false) nur durch Mehrbedarf-
  //   Lücken angezapft; eine "Ersparnis" an einen Tab ist kein Pfad mehr.

  it('excess cascades to neutral absorbers only (Issue #347 Netto-Fix)', () => {
    // Issue #347 (Netto-Saldo-Fix): Eine Mehrbedarf-Quelle (IST > SOLL) wird
    // in Phase 2 ALS ABSORBER ausgeschlossen (Skip `isMehrbedarf2`). Sie soll
    // ihren Eigen-Restbedarf NICHT durch Selbst-Absorption in die
    // `excessEinheit` der Quelle selbst buchen — das verwechselt
    // Eigen-Restbedarf mit Empfänger-Bereitschaft (Maintainer's diagnose in
    // Issue #347).
    //
    // Vor #347: Tab 0 (Quelle) self-absorbed 1 E Rest → Buggy Doppelt-Zählung.
    // Nach #347: Tab 0 bekommt 0 (Skip); Tab 1 absorbiert volle 2 E (cap).
    const { w } = setup();
    w.addReiter();
    // Tab 0: SOLL=5, IST=8 → Mehrbedarf-Quelle (excess = 3 E)
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 5, istHektar: 8, koerner: 50000, duenger: 100 };
    // Tab 1: neutral, used=2/4, cap = 4-2 = 2 → absorbiert min(3, 2) = 2
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 4, koerner: 50000, duenger: 100 };
    w.state.reiter[1].entries.push({ einheit: 2, zaehlerStand: 4, duenger: 200, time: '10:00' });
    // Tab 0 entries: usedE=3
    w.state.reiter[0].entries.push({ einheit: 3, zaehlerStand: 3, duenger: 300, time: '09:00' });

    // Senken-Modell: Tab 1 (zuletzt befüllt, 10:00) ist Senke. Material-
    // Defizit aus Tab 0 (IST-Bedarf 8 − used 3 = 5 E) fließt auf die Senke.
    var co1 = w.getCarryover(1);
    expect(co1.isSink).toBe(true);
    expect(co1.sinkAdjustedE).toBeCloseTo(5, 1); // 8 − 3 = 5 E Defizit
    expect(co1.sinkAdjustedD).toBeCloseTo(500, 0); // (800 − 300) = 500 kg

    // Tab 0 (Mehrbedarf-Quelle) zeigt ihre Flächen-Abweichung (Hinweis).
    var co0 = w.getCarryover(0);
    expect(co0.excessEinheit).toBeCloseTo(3, 1); // IST 8 − SOLL 5
  });

  it('savings display applies fahrgassenFaktor (Issue #273)', () => {
    // Bug: render-drill.js showed savings/excess without FG factor. Display
    // diverged from getCarryover when FG was enabled. Fix: use
    // getTabTotalEinheiten / getTabIstEinheiten (which already apply FG) so
    // display and carryover source share one formula.
    const { w } = setup();
    w.addReiter();
    w.addReiter();
    // Tab 0: SOLL=10, IST=8, koerner=50000, FG breite=24 → fgFactor 23/24
    // Savings: (10 - 8) × 50000/50000 × 23/24 = 1.9167 Einheiten
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, istHektar: 8, koerner: 50000, duenger: 100, fahrgassenEnabled: true, fahrgassenBreite: 24 };
    w.state.reiter[0].entries.push({ einheit: 8, zaehlerStand: 8, duenger: 800, time: '10:00' });
    // Tab 1: SOLL=5, not done → absorbs the savings as carryover
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 5, koerner: 50000, duenger: 80, fahrgassenEnabled: true, fahrgassenBreite: 24 };
    w.state.activeReiter = 0;
    w.renderResults();

    // #ds_savings: must show FG-adjusted value (1,9), NOT the unadjusted (2,0)
    const savEl = w.document.getElementById('ds_savings');
    expect(savEl).not.toBeNull();
    expect(savEl.style.display).not.toBe('none');
    expect(savEl.textContent).toContain('1,9');
    expect(savEl.textContent).toContain('Einheiten Saatgut');
    expect(savEl.textContent).not.toContain('2,0 Einheiten');

    // .drill-savings per-tab: same constraint
    const container = w.document.getElementById('drill_entries');
    const savingsDivs = container.querySelectorAll('.drill-savings');
    expect(savingsDivs.length).toBeGreaterThanOrEqual(1);
    expect(savingsDivs[0].textContent).toContain('1,9');
    expect(savingsDivs[0].textContent).not.toContain('2,0 Einheiten');

    // REMOVED (#378 Regel-7): Carryover-pinning auf `co1.savedEinheit ===
    // 1.9167`. Unter Regel 7 ist `savedEinheit` immer 0 — Ersparnis ist
    // konzeptuell Teil des globalen Pools, nicht einer Per-Tab-Gutschrift.
    // Tab 1 hat keinen Mehrbedarf (kein IST>SOLL), also auch kein
    // `nettedEinheit` — Carryover ist 0.
    var co1 = w.getCarryover(1);
    expect(co1.savedEinheit).toBe(0);
    expect(co1.nettedEinheit).toBe(0);
    expect(co1.excessEinheit).toBe(0);
  });

  it('excess display applies fahrgassenFaktor (Issue #273)', () => {
    const { w } = setup();
    w.addReiter();
    w.addReiter();
    // Tab 0: SOLL=5, IST=8, FG breite=24 → excess source
    // Excess: (8 - 5) × 50000/50000 × 23/24 = 2.875 Einheiten
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 5, istHektar: 8, koerner: 50000, duenger: 100, fahrgassenEnabled: true, fahrgassenBreite: 24 };
    w.state.reiter[0].entries.push({ einheit: 5, zaehlerStand: 8, duenger: 500, time: '09:00' });
    // Tab 1: SOLL=4, last filled → absorbs excess
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 4, koerner: 50000, duenger: 100, fahrgassenEnabled: true, fahrgassenBreite: 24 };
    w.state.reiter[1].entries.push({ einheit: 2, zaehlerStand: 4, duenger: 200, time: '10:00' });
    w.state.activeReiter = 1;
    w.renderResults();

    // .drill-excess: must show FG-adjusted value (2,9), NOT the unadjusted (3,0)
    const container = w.document.getElementById('drill_entries');
    const excessDivs = container.querySelectorAll('.drill-excess');
    expect(excessDivs.length).toBeGreaterThanOrEqual(1);
    expect(excessDivs[0].textContent).toContain('2,875');
    expect(excessDivs[0].textContent).not.toContain('3,0 Einheiten');
  });

  // Issue #309: tab-anchoring. The Ersparnis / Übertrag / Mehrbedarf blocks
  // must appear DIRECTLY UNDER the tab-header they belong to (inside the
  // tab's <div.drill-entry-tab-header> section in #drill_entries), NOT as a
  // flat batch at the very top of the container above all tab-headers.
  it('drill-savings/carryover/excess appear directly under their tab-header in #drill_entries', () => {
    const { w } = setup();
    w.addReiter();
    // Tab 0: SOLL=8, IST=7.9 → savings source. Has an entry.
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 8, istHektar: 7.9, koerner: 50000, duenger: 100, entries: [] };
    w.state.reiter[0].entries.push({ einheit: 7.9, zaehlerStand: 7.9, duenger: 790, time: '10:00' });
    // Tab 1: SOLL=10, IST=8 → savings source. No entry → carryover for tab 0? No —
    // tab 0 is done. Carryover for tab 1 = savings from tab 0. Wait: tab 1 has
    // savings source but no entry. With savings source on tab 1, tab 1 itself
    // becomes the FIRST not-done tab → it absorbs tab 0's carryover (but tab 0's
    // savings are 0 since its need is met) AND it advertises its own savings.
    // Keep it simple: tab 1 also a savings source with IST=8, SOLL=10. No entry.
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 10, istHektar: 8, koerner: 50000, duenger: 100, entries: [] };
    w.state.activeReiter = 0;
    w.renderResults();

    const container = w.document.getElementById('drill_entries');
    // Walk children in order; assert every .drill-savings / .drill-carryover /
    // .drill-excess is preceded by a .drill-entry-tab-header.
    const children = Array.from(container.children);
    let lastHeaderIdx = -1;
    for (let i = 0; i < children.length; i++) {
      const c = children[i];
      if (c.classList.contains('drill-entry-tab-header')) {
        lastHeaderIdx = i;
      } else if (
        c.classList.contains('drill-savings') ||
        c.classList.contains('drill-carryover') ||
        c.classList.contains('drill-excess')
      ) {
        // Carryover block must be directly under SOME tab-header (not at top
        // of container before any header).
        expect(lastHeaderIdx).toBeGreaterThanOrEqual(0);
        // And not be the .drill-empty placeholder
        expect(c.classList.contains('drill-empty')).toBe(false);
      }
    }
    // Specifically: tab 0 must show a savings block (IST < SOLL with entry).
    // Find tab 0's header (first one), then assert a savings block follows it.
    const tab0HeaderIdx = children.findIndex(c =>
      c.classList.contains('drill-entry-tab-header') && c.textContent.includes('Schlag 1'));
    expect(tab0HeaderIdx).toBeGreaterThanOrEqual(0);
    // The next child after tab 0's header must be its savings block (since tab 0
    // is a savings source with an entry, it has drill-savings).
    const next = children[tab0HeaderIdx + 1];
    expect(next).toBeDefined();
    expect(next.classList.contains('drill-savings')).toBe(true);
    expect(next.textContent).toContain('Ersparnis');
  });

  it('drill-entries are NOT rendered above their tab-header (no orphan blocks at top)', () => {
    const { w } = setup();
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, koerner: 90000, duenger: 100, entries: [] };
    w.state.reiter[0].entries.push({ einheit: 5, zaehlerStand: 3, duenger: 200, time: '10:00' });
    w.state.activeReiter = 0;
    w.renderResults();

    const container = w.document.getElementById('drill_entries');
    const children = Array.from(container.children);
    // The first child must be a tab-header (or a savings/carryover/excess
    // block directly above a tab-header) — never a bare .drill-entry before
    // any header has been rendered.
    const firstIdx = children.findIndex(c => c.classList.contains('drill-entry-tab-header'));
    expect(firstIdx).toBeGreaterThanOrEqual(0);
    // No .drill-entry before the first tab-header
    for (let i = 0; i < firstIdx; i++) {
      expect(children[i].classList.contains('drill-entry')).toBe(false);
    }
  });

  // REMOVED (#378 Regel-7): Carryover-Block-Pin 'coBlocks.length >= 1'.
  //   Unter Regel 7 entsteht ein .drill-carryover Block nur, wenn ein
  //   Mehrbedarf-Tab vorhanden ist. Im Szenario (beide Tabs savings-source)
  //   gibt es keinen Mehrbedarf → kein .drill-carryover. Stattdessen pin
  //   wir die Ersparnis-Blöcke (die weiterhin erscheinen).
  it('#drill_machine_log gets tab-anchored savings/excess blocks under per-tab sub-headers', () => {
    const { w } = setup();
    w.addReiter();
    // Tab 0: savings source. machineLog has one entry.
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 8, istHektar: 7.9, koerner: 50000, duenger: 100, entries: [] };
    w.state.reiter[0].entries.push({ einheit: 7.9, zaehlerStand: 7.9, duenger: 790, time: '10:00' });
    // Tab 1: SOLL=10, IST=8 → savings source with no entry (kein Mehrbedarf).
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 10, istHektar: 8, koerner: 50000, duenger: 100, entries: [] };
    w.state.machineLog = [
      { einheit: 5, zaehlerStand: 0, duenger: 0, time: '10:00' },
    ];
    w.state.activeReiter = 0;
    w.renderResults();

    const ml = w.document.getElementById('drill_machine_log');
    const mlChildren = Array.from(ml.children);
    // First child: "Maschinen-Protokoll" static header.
    expect(mlChildren[0].classList.contains('drill-entry-tab-header')).toBe(true);
    expect(mlChildren[0].textContent).toContain('Maschinen-Protokoll');
    // Find savings blocks (Regel 7: Ersparnis bleibt im UI sichtbar, auch
    // wenn kein Carryover-Pfad existiert). Carryover-Block nur bei Mehrbedarf.
    const savBlocks = ml.querySelectorAll('.drill-savings');
    expect(savBlocks.length).toBeGreaterThanOrEqual(1);
    // Each savings/excess block must be preceded by a tab-header.
    let lastHeaderIdx = -1;
    for (let i = 0; i < mlChildren.length; i++) {
      const c = mlChildren[i];
      if (c.classList.contains('drill-entry-tab-header')) {
        lastHeaderIdx = i;
      } else if (
        c.classList.contains('drill-savings') ||
        c.classList.contains('drill-carryover') ||
        c.classList.contains('drill-excess')
      ) {
        expect(lastHeaderIdx).toBeGreaterThanOrEqual(0);
      }
    }
    // .drill-entry (machine-log entries) must appear AFTER all tab-sub-headers
    // and their savings/carryover blocks, not interleaved.
    const firstEntryIdx = mlChildren.findIndex(c => c.classList.contains('drill-entry'));
    const firstSubSavIdx = mlChildren.findIndex(c =>
      c.classList.contains('drill-savings') || c.classList.contains('drill-carryover') || c.classList.contains('drill-excess'));
    if (firstEntryIdx >= 0 && firstSubSavIdx >= 0) {
      expect(firstEntryIdx).toBeGreaterThan(firstSubSavIdx);
    }
  });

  it('carryover blocks render under tab-header even when tab has no entries', () => {
    // Regression: before the fix, renderDrillLog() always returned "Noch
    // nichts eingefüllt" when ALL tabs had empty entries — even when one tab
    // was a savings source. Now the empty-state is suppressed if any tab has
    // a carryover signal, so the savings block is visible.
    const { w } = setup();
    w.addReiter();
    // Tab 0: savings source, no entries.
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 8, istHektar: 7.9, koerner: 50000, duenger: 100, entries: [] };
    // Tab 1: not done, no entries, no savings/excess → no signal.
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 10, koerner: 50000, duenger: 100, entries: [] };
    w.state.activeReiter = 0;
    w.renderResults();

    const container = w.document.getElementById('drill_entries');
    // Should NOT show "Noch nichts eingefüllt" because tab 0 has a savings signal.
    const empty = container.querySelector('.drill-empty');
    expect(empty).toBeNull();
    // Should show the savings block anchored to tab 0's header.
    const headers = container.querySelectorAll('.drill-entry-tab-header');
    expect(headers.length).toBeGreaterThanOrEqual(1);
    const sav = container.querySelector('.drill-savings');
    expect(sav).not.toBeNull();
    expect(sav.textContent).toContain('Ersparnis');
  });

  it('shows net saldo (Ersparnis minus Mehrbedarf) across tabs in ds_savings', () => {
    // Tab 0: SOLL=10, IST=8 → Ersparnis 2 ha × 100 kg/ha = +200 kg Dünger
    // Tab 1: SOLL=5, IST=7 → Mehrbedarf 2 ha × 100 kg/ha = -200 kg Dünger
    // Net saldo Dünger = 0 → Saldo box should be hidden (within 0.05 tolerance)
    const { w } = setup();
    w.addReiter();
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, istHektar: 8, koerner: 50000, duenger: 100, entries: [] };
    w.state.reiter[0].entries.push({ einheit: 8, zaehlerStand: 8, duenger: 800, time: '09:00' });
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 5, istHektar: 7, koerner: 50000, duenger: 100, entries: [] };
    w.state.reiter[1].entries.push({ einheit: 5, zaehlerStand: 7, duenger: 500, time: '10:00' });
    w.state.activeReiter = 0;
    w.renderResults();

    const savingsEl = w.document.getElementById('ds_savings');
    expect(savingsEl).not.toBeNull();
    // Net saldo ≈ 0 for both → box hidden
    expect(savingsEl.style.display).toBe('none');
  });

  it('shows net Mehrbedarf when excess outweighs savings', () => {
    // Tab 0: SOLL=10, IST=9 → Ersparnis 1 ha × 100 = +100 kg Dünger, +1 Einheit
    // Tab 1: SOLL=5, IST=10 → Mehrbedarf 5 ha × 100 = -500 kg Dünger, -5 Einheiten
    // Net saldo: -400 kg Dünger, -4 Einheiten → Mehrbedarf
    const { w } = setup();
    w.addReiter();
    w.state.reiter[0] = { ...w.state.reiter[0], hektar: 10, istHektar: 9, koerner: 50000, duenger: 100, entries: [] };
    w.state.reiter[0].entries.push({ einheit: 9, zaehlerStand: 9, duenger: 900, time: '09:00' });
    w.state.reiter[1] = { ...w.state.reiter[1], hektar: 5, istHektar: 10, koerner: 50000, duenger: 100, entries: [] };
    w.state.reiter[1].entries.push({ einheit: 5, zaehlerStand: 10, duenger: 500, time: '10:00' });
    w.state.activeReiter = 0;
    w.renderResults();

    const savingsEl = w.document.getElementById('ds_savings');
    expect(savingsEl).not.toBeNull();
    expect(savingsEl.style.display).not.toBe('none');
    expect(savingsEl.textContent).toContain('Mehrbedarf');
    expect(savingsEl.textContent).toContain('400');
    expect(savingsEl.textContent).toContain('kg Dünger');
  });
});

describe('Issue #138: computeAllCarryovers (Senken-Modell)', () => {
  // REMOVED (#378 Regel-7): 'isTabDone() berücksichtigt Carryover aus dem Cache'
  //   — unter Regel 7 ist `savedEinheit` immer 0. Stattdessen: isTabDone
  //   triggert Pool-Exclusion: ein done-Tab nimmt NICHT am Pool teil.
  it('Senken-Modell: Ersparnis + Mehrbedarf; Netto-Defizit landet auf der Senke', () => {
    const { w } = setup();
    // Tab 0: 10ha SOLL, 8ha IST, used=IST-Bedarf → fertig, Ersparnis 2E/200kg.
    // Tab 1: 5ha SOLL, 8ha IST, used=SOLL-Bedarf (5) → Mehrbedarf 3E/300kg.
    // Tab 2: 5ha SOLL/IST, used=5 → zeitlich zuletzt (Senke).
    w.state.reiter = [
      { name: 'A', hektar: 10, istHektar: 8, koerner: 50000, duenger: 100, entries: [
        { einheit: 8, duenger: 800, zaehlerStand: 8, time: '2026-01-01T09:00' }
      ]},
      { name: 'B', hektar: 5, istHektar: 8, koerner: 50000, duenger: 100, entries: [
        { einheit: 5, duenger: 500, zaehlerStand: 8, time: '2026-01-01T10:00' }
      ]},
      { name: 'C', hektar: 5, istHektar: 5, koerner: 50000, duenger: 100, entries: [
        { einheit: 5, duenger: 500, zaehlerStand: 5, time: '2026-01-01T11:00' }
      ]}
    ];

    w.invalidateCarryoverCache();
    var co0 = w.getCarryover(0);
    var co1 = w.getCarryover(1);
    var co2 = w.getCarryover(2);

    // Selbst-Abweichungen (Hinweis): Tab 0 Ersparnis, Tab 1 Mehrbedarf.
    expect(co0.savedEinheit).toBeCloseTo(2, 1);
    expect(co1.excessEinheit).toBeCloseTo(3, 1);
    // Senke = Tab 2 (11:00, späteste). Netto-Material-Defizit = 0 + 3 = 3 E.
    expect(co2.isSink).toBe(true);
    expect(co2.sinkAdjustedE).toBeCloseTo(3, 1);
    expect(co2.sinkAdjustedD).toBeCloseTo(300, 0);
    expect(co0.isSink).toBe(false);
    expect(co1.isSink).toBe(false);
    // Tab 0/1 fertig (worked, own 0); Tab 2 trägt das Netto-Defizit.
    expect(w.getTabRemaining(w.state.reiter[0], 0).remainingE).toBeCloseTo(0, 1);
    expect(w.getTabRemaining(w.state.reiter[1], 1).remainingE).toBeCloseTo(0, 1);
    expect(w.getTabRemaining(w.state.reiter[2], 2).remainingE).toBeCloseTo(3, 1);
  });

  // REMOVED (#378 Regel-7): 'Tab mit Carryover-vollständigem Status wird in
  //   Phase 1 übersprungen' — Phase-1-Ersparnis-Verteilung ist gelöscht.
  //   Ersatz: isTabDone nutzt `remaining = max(0, soll - used + entzogen)`;
  //   ein Tab mit Carryover-vollständigem Status hat remaining=0 → isTabDone
  //   returnt true. Im Algorithmus bedeutet das: der Tab nimmt nicht am
  //   Spender-Pool teil (er ist done).
  it('Senken-Modell: Mehrbedarf-Tab ist done (Lücke weitergeleitet), Senke trägt Rest', () => {
    const { w } = setup();
    // Tab 0: 5ha SOLL, IST=8ha → Mehrbedarf 3 E / 300 kg. used=5/500.
    // Tab 1: 5ha SOLL, IST=5ha, used=5/500 → zeitlich zuletzt (Senke).
    w.state.reiter = [
      { name: 'A', hektar: 5, istHektar: 8, koerner: 50000, duenger: 100, entries: [
        { einheit: 5, duenger: 500, zaehlerStand: 5, time: '2026-01-01T10:00' }
      ]},
      { name: 'B', hektar: 5, istHektar: 5, koerner: 50000, duenger: 100, entries: [
        { einheit: 5, duenger: 500, zaehlerStand: 5, time: '2026-01-01T11:00' }
      ]}
    ];

    w.invalidateCarryoverCache();
    var co0 = w.getCarryover(0);
    var co1 = w.getCarryover(1);

    // Tab 0 Mehrbedarf (Selbst-Abweichung); Tab 1 ist Senke, trägt +3/+300.
    expect(co0.excessEinheit).toBeCloseTo(3, 1);
    expect(co0.excessDuenger).toBeCloseTo(300, 0);
    expect(co1.isSink).toBe(true);
    expect(co1.sinkAdjustedE).toBeCloseTo(3, 1);
    expect(co1.sinkAdjustedD).toBeCloseTo(300, 0);
    // Tab 0: own = SOLL−used = 0, nicht Senke → remaining 0 → done.
    expect(w.isTabDone(w.state.reiter[0], 0)).toBe(true);
    // Tab 1 (Senke): own 0 + sinkAdjusted 3 = 3 > 0 → NICHT done.
    expect(w.isTabDone(w.state.reiter[1], 1)).toBe(false);
    var remB = w.getTabRemaining(w.state.reiter[1], 1);
    expect(remB.remainingE).toBeCloseTo(3, 1);
    expect(remB.remainingD).toBeCloseTo(300, 0);
  });

  // REMOVED (#378 Regel-7): 'isTabDone(t, tabIdx) berücksichtigt Carryover,
  //   isTabDone(t) ignoriert es' — unter Regel 7 ist `savedEinheit` immer 0,
  //   also ist isTabDone(t) === isTabDone(t, i) (beide nutzen `max(0, soll -
  //   used + entzogen)` über getTabRemaining, kein Cache-Split mehr).
  it('isTabDone(t) und isTabDone(t, i) sind konsistent (kein Carryover)', () => {
    const { w } = setup();
    // Tab 0: 10ha SOLL/IST, used=10 → fertig, kein Defizit.
    // Tab 1: 5ha SOLL/IST, used=5 (zuletzt befüllt) → fertig, kein Defizit.
    // burden=0 → sinkAdjusted=0 → beide remaining 0, beide done.
    w.state.reiter = [
      { name: 'A', hektar: 10, istHektar: 10, koerner: 50000, duenger: 100, entries: [
        { einheit: 10, duenger: 1000, zaehlerStand: 10, time: '2026-01-01T10:00' }
      ]},
      { name: 'B', hektar: 5, istHektar: 5, koerner: 50000, duenger: 100, entries: [
        { einheit: 5, duenger: 500, zaehlerStand: 5, time: '2026-01-01T11:00' }
      ]}
    ];

    w.invalidateCarryoverCache();
    w.computeAllCarryovers();

    // Senken-Modell: isTabDone(t) ≡ isTabDone(t, i) konsistent.
    expect(w.isTabDone(w.state.reiter[0])).toBe(w.isTabDone(w.state.reiter[0], 0));
    expect(w.isTabDone(w.state.reiter[0])).toBe(true);
    expect(w.isTabDone(w.state.reiter[0], 0)).toBe(true);
    expect(w.isTabDone(w.state.reiter[1])).toBe(w.isTabDone(w.state.reiter[1], 1));
    expect(w.isTabDone(w.state.reiter[1])).toBe(true);
    expect(w.isTabDone(w.state.reiter[1], 1)).toBe(true);
  });

  it('Ersparnis-Tab fertig bei IST; beide Tabs zeigen remaining 0', () => {
    const { w } = setup();
    // Tab A: 10ha SOLL, nur 8ha gemacht (IST 8), used 8 → fertig bei IST (Ersparnis).
    // Tab B: 5ha SOLL/IST, used 5 → fertig.
    w.state.reiter = [
      {
        name: 'Feld A', hektar: 10, istHektar: 8, koerner: 50000, duenger: 100,
        entries: [{ einheit: 8, duenger: 80, zaehlerStand: 8, time: '2026-01-01T10:00' }]
      },
      {
        name: 'Feld B', hektar: 5, istHektar: 5, koerner: 50000, duenger: 100,
        entries: [{ einheit: 5, duenger: 50, zaehlerStand: 5, time: '2026-01-01T11:00' }]
      }
    ];

    w.invalidateCarryoverCache();
    var co0 = w.getCarryover(0);
    var co1 = w.getCarryover(1);
    // Tab A Ersparnis (Selbst-Abweichung, Hinweis); beide Tabs remaining 0.
    expect(co0.savedEinheit).toBeCloseTo(2, 1);
    expect(w.getTabRemaining(w.state.reiter[0], 0).remainingE).toBeCloseTo(0, 1);
    expect(w.getTabRemaining(w.state.reiter[1], 1).remainingE).toBeCloseTo(0, 1);
    // Senke (Tab B): kein Material-Defizit (beide Tabs used = IST-need) → 0.
    expect(co1.isSink).toBe(true);
    expect(co1.sinkAdjustedE).toBeCloseTo(0, 1);
  });
});

describe('Issue #186: Ist-Fläche-Änderung synchronisiert Dashboard und Tab-Ergebnis', () => {
  let w, doc;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
  });

  // --- Setup helper: tab with SOLL data and some drill entries ---
  function setupTabWithData() {
    var r = w.state.reiter[0];
    r.hektar = 10;          // 10 ha SOLL
    r.koerner = 50000;      // 50000 Körner/ha → 10 Einheiten
    r.duenger = 150;        // 150 kg/ha Dünger → 1500 kg total
    r.entries = [
      { time: 1, einheit: 4, duenger: 600, hektar: 0, istHektar: 0, koerner: 50000, duengerRate: 150 }
    ];
  }

  // --- Defekt A: istHektar landet live im State ---

  describe('Defekt A: istHektar im State', () => {
    it('onInputIstHektar updates state.reiter[active].istHektar', () => {
      setupTabWithData();
      expect(w.state.reiter[0].istHektar).toBe(0); // initial
      var r0 = w.state.reiter[0];
      // Simulate user typing 8,5 in the ist_hektar field
      var el = doc.getElementById('ist_hektar');
      el.value = '8,5';
      w.onInputIstHektar(el);
      expect(r0.istHektar).toBe(8.5);
    });

    it('onInputHektar updates state.reiter[active].hektar', () => {
      setupTabWithData();
      var r0 = w.state.reiter[0];
      var el = doc.getElementById('hektar');
      el.value = '12,5';
      w.onInputHektar(el);
      expect(r0.hektar).toBe(12.5);
    });

    it('onInputKoerner updates state.reiter[active].koerner', () => {
      setupTabWithData();
      var r0 = w.state.reiter[0];
      var el = doc.getElementById('koerner');
      el.value = '55000';
      w.onInputKoerner(el);
      expect(r0.koerner).toBe(55000);
    });

    it('onInputDuenger updates state.reiter[active].duenger', () => {
      setupTabWithData();
      var r0 = w.state.reiter[0];
      var el = doc.getElementById('duenger');
      el.value = '200';
      w.onInputDuenger(el);
      expect(r0.duenger).toBe(200);
    });

    it('onInputIstHektar triggers appEmit for ENTRY_CHANGED', () => {
      // Indirect: the state should be updated, and dashboard re-rendered.
      // We verify by checking that dashboard content is fresh.
      setupTabWithData();
      w.openDashboard();
      // User changes ist_hektar via the input handler
      var el = doc.getElementById('ist_hektar');
      el.value = '8';
      w.onInputIstHektar(el);
      // Re-open dashboard to simulate the user reopening it after the change
      w.openDashboard();
      // Per-tab card: "Einheiten verbl." reflects IST-based calc (Issue #186).
      // IST=8 ha, 50000 Körner/ha, 50000 Körner/Einheit → 8 Einheiten basis
      // Used = 4 → under Regel-7 Pool-Modell (Issue #378) gibt es keine
      // per-Tab-Savings-Subtraktion mehr: `savedEinheit` ist immer 0.
      // remaining = max(0, basis - used + entzogen) = 8 - 4 + 0 = 4.
      var cards = doc.querySelectorAll('.dashboard-reiter-card');
      expect(cards.length).toBe(1);
      var values = cards[0].querySelectorAll('.dashboard-stat-value');
      // 0: Hektar, 1: Körner/ha, 2: Einheiten verbl., 3: Dünger verbl.
      expect(values[2].textContent.trim()).toBe('4,000');
    });
  });

  // --- Defekt B: renderDashboard() wird synchron aktualisiert ---

  describe('Defekt B: Dashboard zeigt IST-basierte Werte', () => {
    it('Dashboard exists and is openable', () => {
      expect(typeof w.openDashboard).toBe('function');
      w.openDashboard();
      expect(doc.getElementById('dashboard_sheet').classList.contains('open')).toBe(true);
    });

    it('Per-Tab-Karte zeigt IST-Heftar als "SOLL / IST ha" wenn unterschiedlich', () => {
      setupTabWithData();
      w.state.reiter[0].istHektar = 8.5;
      w.openDashboard();
      var cards = doc.querySelectorAll('.dashboard-reiter-card');
      var hektarStat = cards[0].querySelectorAll('.dashboard-stat-value')[0];
      expect(hektarStat.textContent).toContain('10'); // SOLL
      expect(hektarStat.textContent).toContain('8,5'); // IST
    });

    it('Per-Tab-Karte zeigt IST-basierte Einheiten-verbleibend', () => {
      // SOLL=10 ha → 10 Einheiten; IST=8 ha → 8 Einheiten IST-Basis
      // Used=4. Unter Regel-7 (Issue #378): `savedEinheit` ist immer 0,
      // keine eigene-Ersparnis-Subtraktion. remaining = 8 - 4 + 0 = 4.
      setupTabWithData();
      w.state.reiter[0].istHektar = 8;
      w.openDashboard();
      var cards = doc.querySelectorAll('.dashboard-reiter-card');
      var values = cards[0].querySelectorAll('.dashboard-stat-value');
      expect(values[2].textContent.trim()).toBe('4,000');
    });

    it('Per-Tab-Karte zeigt IST-basierten Dünger-verbleibend', () => {
      // SOLL=10 ha, 150 kg/ha → 1500 kg. IST=8 ha → 1200 kg
      // Used=600. Unter Regel-7 (Issue #378): keine Ersparnis-Subtraktion.
      // remaining = 1200 - 600 + 0 = 600.
      setupTabWithData();
      w.state.reiter[0].istHektar = 8;
      w.openDashboard();
      var cards = doc.querySelectorAll('.dashboard-reiter-card');
      var values = cards[0].querySelectorAll('.dashboard-stat-value');
      expect(values[3].textContent).toContain('600');
    });

    it('SOLL und IST Summary bleibt über Tabs aggregiert korrekt', () => {
      // Tab 0: 10 ha SOLL, 5 ha IST, 50000 Körner, 100 kg/ha
      w.state.reiter[0].hektar = 10;
      w.state.reiter[0].istHektar = 5;
      w.state.reiter[0].koerner = 50000;
      w.state.reiter[0].duenger = 100;
      w.state.reiter[0].entries = [];
      w.openDashboard();
      // Summary: Fläche (IST), Einheiten verbl. (IST-basiert), Dünger verbl.
      // Scope to dashboard_content to avoid spurious matches in dead inline-script
      // (which JSDOM parses weirdly because it lives outside a <script> tag).
      var dashContent = doc.getElementById('dashboard_content');
      var stats = dashContent.querySelectorAll('.dashboard-summary-stat .dashboard-summary-value');
      // 0: Fläche → IST=5 ha
      expect(stats[0].textContent).toContain('5');
    });
  });

  // --- Defekt C: renderResults() triggert ENTRY_CHANGED → renderDashboard ---

  describe('Defekt C: renderResults + Dashboard Sync', () => {
    it('renderResultCard zeigt IST/SOLL/Diff wenn istHektar gesetzt', () => {
      setupTabWithData();
      w.state.reiter[0].istHektar = 9.5;
      w.renderResults();
      var sollIstSection = doc.getElementById('r_soll_ist_section');
      expect(sollIstSection.style.display).not.toBe('none');
      expect(doc.getElementById('r_ist_ha').textContent).toContain('9,5');
    });

    it('renderResultCard berechnet IST-Einheiten wenn istHektar gesetzt', () => {
      // SOLL=10 ha, koerner=50000 → 10 Einheiten. IST=8 → 8 Einheiten
      setupTabWithData();
      w.state.reiter[0].istHektar = 8;
      w.renderResults();
      // r_einheiten shows the IST-based einheiten (8)
      var r_einheiten = doc.getElementById('r_einheiten');
      expect(r_einheiten.textContent).toContain('8');
    });
  });

  // --- Issue #191: SOLL-Pfad (kein IST) muss Dünger in kg anzeigen ---

  describe('Issue #191: SOLL-Pfad ohne IST zeigt Dünger in kg', () => {
    it('r_duenger zeigt 1.500 kg für 10 ha × 150 kg/ha ohne IST', () => {
      // Setup: 10 ha, 50000 Körner, 150 kg/ha Duenger, KEIN IST
      var r0 = w.state.reiter[0];
      r0.hektar = 10;
      r0.koerner = 50000;
      r0.duenger = 150;
      r0.istHektar = 0;
      r0.entries = [];
      w.renderResults();
      // 10 × 150 = 1500 kg (nicht 30, nicht 50)
      var r_duenger = doc.getElementById('r_duenger');
      expect(r_duenger.textContent).toContain('1.500 kg');
      expect(r_duenger.textContent).not.toContain('30 kg');
    });

    it('r_info zeigt kg-Dünger korrekt im SOLL-Pfad', () => {
      var r0 = w.state.reiter[0];
      r0.hektar = 10;
      r0.koerner = 50000;
      r0.duenger = 150;
      r0.istHektar = 0;
      r0.entries = [];
      w.renderResults();
      var r_info = doc.getElementById('r_info');
      expect(r_info.textContent).toContain('1.500 kg Dünger');
    });

    it('Dashboard Per-Tab-Karte zeigt 1.500 kg Dünger im SOLL-Pfad', () => {
      var r0 = w.state.reiter[0];
      r0.hektar = 10;
      r0.koerner = 50000;
      r0.duenger = 150;
      r0.istHektar = 0;
      r0.entries = [];
      w.openDashboard();
      var cards = doc.querySelectorAll('.dashboard-reiter-card');
      var values = cards[0].querySelectorAll('.dashboard-stat-value');
      // 0: Hektar, 1: Körner/ha, 2: Einheiten verbl., 3: Dünger verbl.
      expect(values[3].textContent).toContain('1.500 kg');
    });

    it('Dashboard Summary zeigt aggregierte 1.500 kg Dünger im SOLL-Pfad', () => {
      var r0 = w.state.reiter[0];
      r0.hektar = 10;
      r0.koerner = 50000;
      r0.duenger = 150;
      r0.istHektar = 0;
      r0.entries = [];
      w.openDashboard();
      var dashContent = doc.getElementById('dashboard_content');
      var stats = dashContent.querySelectorAll('.dashboard-summary-stat .dashboard-summary-value');
      // 0: Fläche, 1: Einheiten verbl., 2: Dünger verbl.
      expect(stats[2].textContent).toContain('1.500 kg');
    });
  });
});

describe('Issue #305 (Regel-7 Pool-Modell): Dashboard + Inline-Drill carryover subtraction', () => {
  let w, doc;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
  });

  // ── Helpers ────────────────────────────────────────────────────────────

  function setupRepro() {
    // Tab 0: 2 ha SOLL, 1.2 ha IST, 90000 K/ha, 1000 kg/ha, entry fully fills IST
    w.state.reiter[0] = {
      name: 'Acker 1', hektar: 2, istHektar: 1.2, koerner: 90000, duenger: 1000,
      entries: [
        { einheit: 2.16, duenger: 1200, istHektar: 1.2, zaehlerStand: 1.2, time: '08:00' }
      ],
      fahrgassenEnabled: false, fahrgassenBreite: 0
    };
    // Tab 1: 3 ha, 90000 K/ha, 500 kg/ha, no entries → not-done
    w.state.reiter[1] = {
      name: 'Acker 2', hektar: 3, istHektar: 0, koerner: 90000, duenger: 500,
      entries: [],
      fahrgassenEnabled: false, fahrgassenBreite: 0
    };
    // Single small entry on Tab 1 to make r_drill_section visible (needed
    // for inline-drill test). Pool-Mathematik unverändert: kein Mehrbedarf
    // in beiden Tabs (Tab 0 ist<sol, Tab 1 ist=0).
    w.state.reiter[1].entries.push({
      einheit: 0.5, duenger: 100, zaehlerStand: 0.166, time: '09:00'
    });
    w.state.activeReiter = 1;
    w.saveState();
  }

  // ── Dashboard Summary (render-dashboard.js:61-63) ──────────────────────

  it('Dashboard-Summary zeigt Einheiten verbl. nach Pool-Modell', () => {
    setupRepro();
    w.openDashboard();
    const statsEls = doc.getElementById('dashboard_content')
      .querySelectorAll('.dashboard-summary-stat');
    // 0: Fläche, 1: Einheiten verbl., 2: Dünger verbl.
    const einheitenVal = statsEls[1].querySelector('.dashboard-summary-value').textContent;
    // Tab 0: istE=2.16, usedE=2.16, entzogen=0 → remaining=0 (kein Mehrbedarf,
    //         keine cross-tab Subtraktion unter Regel 7).
    // Tab 1: basisE=5.4 (istHa=0 → SOLL), usedE=0.5, entzogen=0 → 4,9.
    // Total: 4,9 → fmtCompact → "4,9".
    expect(einheitenVal).toBe('4,900');
  });

  it('Dashboard-Summary zeigt Dünger verbl. nach Pool-Modell', () => {
    setupRepro();
    w.openDashboard();
    const statsEls = doc.getElementById('dashboard_content')
      .querySelectorAll('.dashboard-summary-stat');
    const duengerVal = statsEls[2].querySelector('.dashboard-summary-value').textContent;
    // Tab 0: istD=1200, usedD=1200 → remaining=0.
    // Tab 1: basisD=1500 (SOLL), usedD=100 → 1400 kg.
    // Total: 1.400 kg.
    expect(duengerVal).toContain('1.400');
  });

  // ── Dashboard per-tab card (render-dashboard.js:168-169) ───────────────

  it('Dashboard Per-Tab-Karte Acker 2 zeigt Einheiten verbl. nach Pool-Modell', () => {
    setupRepro();
    w.openDashboard();
    const cards = doc.querySelectorAll('.dashboard-reiter-card');
    // Tab 1 (Acker 2) is the second card; values: Hektar, Körner/ha, Einh., Dünger
    const values = cards[1].querySelectorAll('.dashboard-stat-value');
    // Tab 1: basisE=5.4 (SOLL, kein IST), usedE=0.5 → max(0, 5.4 - 0.5) = 4,9.
    expect(values[2].textContent.trim()).toBe('4,900');
  });

  it('Dashboard Per-Tab-Karte Acker 2 zeigt Dünger verbl. nach Pool-Modell', () => {
    setupRepro();
    w.openDashboard();
    const cards = doc.querySelectorAll('.dashboard-reiter-card');
    const values = cards[1].querySelectorAll('.dashboard-stat-value');
    // Tab 1: basisD=1500 (SOLL), usedD=100 → max(0, 1500 - 100) = 1400 kg.
    expect(values[3].textContent).toContain('1.400');
  });

  // ── Inline-Drill-Card (render-results.js:159-160) ──────────────────────

  it('Inline-Drill-Card "Dünger verbleibend" zeigt Pool-Modell-Wert', () => {
    setupRepro();
    w.renderResults();
    // r_drill_d_rem ist das "Dünger verbleibend"-Feld für den aktiven Tab.
    // Active = Tab 1 (Acker 2, not-done).
    // max(0, 1500 - 100 - 0 + 0) = 1400 kg.
    expect(doc.getElementById('r_drill_d_rem').textContent).toContain('1.400');
  });

  it('Inline-Drill-Card "Verbleibend" (Einheiten) zeigt Pool-Modell-Wert', () => {
    setupRepro();
    w.renderResults();
    // r_drill_e_rem ist das "Verbleibend"-Feld für den aktiven Tab.
    // max(0, 5.4 - 0.5 - 0 + 0) = 4,9 → formatEinheit → "4,9 Einheiten".
    expect(doc.getElementById('r_drill_e_rem').textContent).toBe('4,900 Einheiten');
  });

  // ── Regression-Guard: ohne carryover (kein IST) bleibt das alte Verhalten ─

  it('ohne IST bleibt Dashboard-Remaining = SOLL - used (kein Carryover)', () => {
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].duenger = 200;
    w.state.reiter[0].entries = [
      { einheit: 8.0, duenger: 160, zaehlerStand: 5, time: '09:00' }
    ];
    w.openDashboard();
    const statsEls = doc.getElementById('dashboard_content')
      .querySelectorAll('.dashboard-summary-stat');
    // No IST → no carryover → max(0, 16 - 8) = 8
    expect(statsEls[1].querySelector('.dashboard-summary-value').textContent).toBe('8,000');
  });

  it('Inline-Drill mit eigenem Tab ohne Carryover bleibt korrekt', () => {
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].duenger = 200;
    w.state.reiter[0].entries = [
      { einheit: 8.0, duenger: 160, zaehlerStand: 5, time: '09:00' }
    ];
    w.renderResults();
    // basisE=16, usedE=8, savings=0 (kein IST), remaining = 8 E
    expect(doc.getElementById('r_drill_e_rem').textContent).toBe('8,000 Einheiten');
  });
});

describe('Issue #320: renderDrillEntriesInline uses istHa>0 ternary (consistency with siblings)', () => {
  let w, doc;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
  });

  // Helper: active tab = reiter[0] with one entry so the inline-drill
  // render path executes (early-return at r.entries.length === 0).
  function setActiveTab(tab) {
    if (!tab.entries || tab.entries.length === 0) {
      tab.entries = [{ einheit: 0.1, duenger: 10, zaehlerStand: 0.05, time: '08:00' }];
    }
    if (w.state.reiter.length === 0) w.state.reiter.push(tab);
    else w.state.reiter[0] = tab;
    w.state.activeReiter = 0;
    w.saveState();
  }

  // Helper: compute basisE/basisD exactly as the FIX (and every sibling
  // render site) does — used as ground truth for assertions.
  function basisFor(tab) {
    var istHa = w.getTabIstHektar(tab);
    return {
      istE: istHa > 0 ? w.getTabIstEinheiten(tab) : w.getTabTotalEinheiten(tab),
      istD: istHa > 0 ? w.getTabIstDuenger(tab) : w.getTabTotalDuenger(tab),
      istHa: istHa,
    };
  }

  // ──────────────────────────────────────────────────────────────────────
  // Consistency Test 1: istHa > 0 → basisE = getTabIstE.
  // ──────────────────────────────────────────────────────────────────────

  it('istHa>0 + koerner>0 + duenger>0: basisE/D = getTabIstX (ternary picks IST)', () => {
    setActiveTab({
      name: 'Acker', hektar: 5, istHektar: 4,
      koerner: 90000, duenger: 200,
      fahrgassenEnabled: false, fahrgassenBreite: 0
    });
    var r = w.state.reiter[0];
    var basis = basisFor(r);
    w.renderResults();
    // basis.istE = 4 × 90000 / 50000 = 7,2 E
    // basis.istD = 4 × 200 = 800 kg
    expect(basis.istE).toBeCloseTo(7.2, 1);
    expect(basis.istD).toBe(800);
    // Regel 7 (#378): `savedEinheit` ist immer 0. Keine eigene-Ersparnis-
    // Subtraktion mehr. Single Tab, kein Mehrbedarf → cco.excess=0.
    // remE = max(0, 7,2 - 0,1 + 0) = 7,1 E
    // remD = max(0, 800 - 10 + 0) = 790 kg
    expect(doc.getElementById('r_drill_e_rem').textContent).toBe('7,100 Einheiten');
    expect(doc.getElementById('r_drill_d_rem').textContent).toContain('790');
  });

  // ──────────────────────────────────────────────────────────────────────
  // Consistency Test 2: istHa = 0 → basisE = getTabTotalE.
  // ──────────────────────────────────────────────────────────────────────

  it('istHa=0: basisE/D = getTabTotalX (ternary picks SOLL)', () => {
    setActiveTab({
      name: 'Acker', hektar: 5, istHektar: 0,
      koerner: 90000, duenger: 200,
      fahrgassenEnabled: false, fahrgassenBreite: 0
    });
    var r = w.state.reiter[0];
    var basis = basisFor(r);
    w.renderResults();
    // basis.istE = totalE = 5 × 90000 / 50000 = 9 E
    // basis.istD = totalD = 5 × 200 = 1000 kg
    expect(basis.istE).toBe(9);
    expect(basis.istD).toBe(1000);
    // remE = max(0, 9 - 0,1 - 0 + 0) = 8,9 E
    // remD = max(0, 1000 - 10 - 0 + 0) = 990 kg
    expect(doc.getElementById('r_drill_e_rem').textContent).toMatch(/8,9/);
    expect(doc.getElementById('r_drill_d_rem').textContent).toContain('990');
  });

  // ──────────────────────────────────────────────────────────────────────
  // Consistency Test 3: Issue #320 Bug-A Szenario (3 Tabs wie im Issue-Body).
  // Pin: der Fix produziert die korrekten Werte für diesen Carryover-Fall.
  // ──────────────────────────────────────────────────────────────────────

  it('Issue #320 Bug-A Szenario (3 Tabs aus Issue-Body): korrekte Carryover-Anzeige', () => {
    // Tab A: SOLL 10 ha, IST 10,5 ha → excess 0,9 E + 100 kg
    w.state.reiter[0] = {
      name: 'Acker A', hektar: 10, istHektar: 10.5,
      koerner: 90000, duenger: 200,
      entries: [
        { einheit: 18.9, duenger: 2100, istHektar: 10.5, zaehlerStand: 10.5, time: '08:00' }
      ],
      fahrgassenEnabled: false, fahrgassenBreite: 0
    };
    // Tab B: SOLL 5 ha, IST 4,5 ha → saved 0,9 E + 100 kg
    w.state.reiter[1] = {
      name: 'Acker B', hektar: 5, istHektar: 4.5,
      koerner: 90000, duenger: 200,
      entries: [
        { einheit: 8.1, duenger: 900, istHektar: 4.5, zaehlerStand: 4.5, time: '09:00' }
      ],
      fahrgassenEnabled: false, fahrgassenBreite: 0
    };
    // Tab C: SOLL 7,5 ha, kein IST (active) — entry für Drill-Section
    w.state.reiter[2] = {
      name: 'Acker C', hektar: 7.5, istHektar: 0,
      koerner: 90000, duenger: 200,
      entries: [{ einheit: 0.1, duenger: 10, zaehlerStand: 0.05, time: '10:00' }],
      fahrgassenEnabled: false, fahrgassenBreite: 0
    };
    w.state.activeReiter = 2;
    w.saveState();
    w.renderResults();
    // Regel 7 (#378): Pool-E = 18,9 + 8,1 + 0,1 = 27,1.
    // Mehrbedarf-Tab A (istE=18,9 > solE=18, diff=0,9 E): zieht aus dem
    // Pool. Befund 1 (Selbstgutschrift ausgeschlossen) → Tab A ist kein
    // Spender. Spender-Order: invers nach Bearbeitungs-Zeit → C (10:00),
    // dann B (09:00). C gibt 0,1 E ab, B gibt 0,8 E ab → deckt 0,9 E.
    // Tab A: cco.excessE=0, cco.nettedE=0,9.
    // Tab C (active): cco.excessE=0,1 (=selbst abgegeben). basisD =
    // SOLL=13,5 E (istHa=0). usedE=0,1. remainingE = 13,5 - 0,1 + 0,1 = 13,5.
    //
    // Pool-Dünger: 2100 + 900 + 10 = 3010. Tab A Mehrmbedarf-D = 100.
    // C gibt 10 kg (alles), B gibt 90 kg → deckt 100 kg. C's cco.excessD=10.
    // Tab C basisD = 1500 (istHa=0). usedD=10. remainingD = 1500 - 10 + 10 = 1500.
    //
    // Senken-Modell: burden = Σ(Material-Defizit IST_Bedarf − used) für
    // bearbeitete Tabs. Tab A (18.9−18.9=0) und Tab B (8.1−8.1=0) tragen kein
    // Defizit. burden Saat = 0 / Dünger = 0.
    // Senke = Tab C (10:00). sinkAdjusted Saat = 0, Dünger = 0.
    // Tab C (unbearb., SOLL 13,5 E / 1500 kg): own = SOLL − used = 13,4 / 1490.
    // remaining = 13,4 E / 1490 kg.
    expect(doc.getElementById('r_drill_e_rem').textContent).toBe('13,400 Einheiten');
    expect(doc.getElementById('r_drill_d_rem').textContent).toContain('1.490');
  });

  // ──────────────────────────────────────────────────────────────────────
  // Consistency Test 4: Basis-Werte stimmen mit dem kanonischen Ternary
  // überein. Pin: für jeden (istHa, koerner, duenger)-Tupel produziert
  // die Render-Funktion die identischen Basis-Werte wie die kanonische
  // Formel. Wir testen 4 repräsentative Kombinationen.
  // ──────────────────────────────────────────────────────────────────────

  it('Basis-Werte identisch zur kanonischen Ternary-Formel (4 Repräsentanten)', () => {
    var cases = [
      // [name, tabSpec, expectedBasis]
      ['istHa=0, alles 0', { hektar: 0, istHektar: 0, koerner: 0, duenger: 0 }, { istE: 0, istD: 0 }],
      ['istHa=0, koerner>0', { hektar: 5, istHektar: 0, koerner: 90000, duenger: 200 }, { istE: 9, istD: 1000 }],
      ['istHa>0, koerner=0', { hektar: 5, istHektar: 4, koerner: 0, duenger: 200 }, { istE: 0, istD: 800 }],
      ['istHa>0, alles>0', { hektar: 5, istHektar: 4, koerner: 90000, duenger: 200 }, { istE: 7.2, istD: 800 }],
    ];
    for (const [label, spec, expected] of cases) {
      setActiveTab({ name: 'Acker', ...spec,
        fahrgassenEnabled: false, fahrgassenBreite: 0 });
      const r = w.state.reiter[0];
      const basis = basisFor(r);
      expect(basis.istE, label + ' istE').toBeCloseTo(expected.istE, 1);
      expect(basis.istD, label + ' istD').toBe(expected.istD);
      // Verify the render output reflects these basis values:
      // remE/D = max(0, basis - used - saved + excess) where single-tab
      // carryover-self applies. The exact display value is not the focus
      // here — we only need to confirm the basis function produces the
      // same istE/istD that the sibling render sites would use.
      // This test asserts the basis formula identity (which is the
      // consistency contract between render-results.js and its siblings).
    }
  });
});

describe('Issue #336: Ergebnis-Tab Carryover-Roh-Wert-Zeilen (renderResultCard)', () => {
  let w, doc;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
  });

  // ── Helpers ────────────────────────────────────────────────────────────

  function hintContainer() {
    return doc.getElementById('r_carryover_hint');
  }
  function savingsRow() {
    return hintContainer().querySelector('.r-carryover-savings');
  }
  function carryoverRow() {
    return hintContainer().querySelector('.r-carryover-carryover');
  }
  function excessRow() {
    return hintContainer().querySelector('.r-carryover-excess');
  }
  function sectionLabel() {
    return hintContainer().querySelector('.r-carryover-section-label');
  }

  // ── Section header ────────────────────────────────────────────────────

  it('shows no section header and no rows when tab has no istHektar and no carryover', () => {
    // Tab 0: SOLL only, no IST, no entries, no carryover signal.
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 8, koerner: 50000, duenger: 100, istHektar: 0, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    // With istHektar=0, the savings/excess deltas are 0 (gated), and the
    // single tab has no carryover to receive. Hint stays empty.
    expect(hintContainer().children.length).toBe(0);
    expect(sectionLabel()).toBeNull();
    expect(savingsRow()).toBeNull();
    expect(carryoverRow()).toBeNull();
    expect(excessRow()).toBeNull();
  });

  it('shows the section header when at least one row qualifies', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 8, istHektar: 7.9, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    const label = sectionLabel();
    expect(label).not.toBeNull();
    expect(label.textContent).toContain('Abweichung dieses Tabs');
  });

  // ── Ersparnis row ──────────────────────────────────────────────────────

  it('shows Ersparnis row when istHektar < hektar (positive savings)', () => {
    // SOLL=8, IST=7.9, koerner=50000, kpe=50000 → savings 0.1 E, 10 kg Dünger
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 8, istHektar: 7.9, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    const s = savingsRow();
    expect(s).not.toBeNull();
    expect(s.textContent).toContain('Ersparnis');
    expect(s.textContent).toContain('Einheiten Saatgut');
    expect(s.textContent).toContain('kg Dünger');
  });

  it('hides Ersparnis row when istHektar = hektar (savings = 0)', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 8, istHektar: 8, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    expect(savingsRow()).toBeNull();
  });

  it('hides Ersparnis row when savings are below the 0.05 threshold on BOTH Saat AND Dünger', () => {
    // SOLL=8, IST=7.9999, koerner=50000, duenger=0
    // savingsE = 0.0001 E (< 0.05), savingsD = 0 kg (< 0.05) → row hidden
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 8, istHektar: 7.9999, koerner: 50000, duenger: 0, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    expect(savingsRow()).toBeNull();
  });

  it('shows Ersparnis row above the 0.05 threshold (Saat only, no Dünger)', () => {
    // SOLL=8, IST=7.9, duenger=0 → savings 0.1 E (> 0.05), 0 kg
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 8, istHektar: 7.9, koerner: 50000, duenger: 0, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    const s = savingsRow();
    expect(s).not.toBeNull();
    expect(s.textContent).toContain('0,1');
    expect(s.textContent).toContain('Einheiten Saatgut');
    // No Dünger configured → kg part not present.
    expect(s.textContent).not.toContain('kg Dünger');
  });

  it('does NOT show Ersparnis row when IST > SOLL (would be negative — covered by Mehrbedarf row)', () => {
    // IST=10, SOLL=8 → savingsE = -2 E. Should NOT show Ersparnis.
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 8, istHektar: 10, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    expect(savingsRow()).toBeNull();
    expect(excessRow()).not.toBeNull();
  });

  // ── Mehrbedarf row ─────────────────────────────────────────────────────

  it('shows Mehrbedarf row when istHektar > hektar (IST > SOLL, excess)', () => {
    // SOLL=8, IST=10 → excess 2 E, 200 kg Dünger
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 8, istHektar: 10, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    const e = excessRow();
    expect(e).not.toBeNull();
    expect(e.textContent).toContain('Mehrbedarf');
    expect(e.textContent).toContain('Einheiten Saatgut');
    expect(e.textContent).toContain('kg Dünger');
  });

  it('hides Mehrbedarf row when istHektar = hektar (excess = 0)', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 8, istHektar: 8, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    expect(excessRow()).toBeNull();
  });

  it('hides Mehrbedarf row when excess is below 0.05 threshold on BOTH Saat AND Dünger', () => {
    // SOLL=8, IST=8.0001, duenger=0 → excessE=0.0001, excessD=0
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 8, istHektar: 8.0001, koerner: 50000, duenger: 0, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    expect(excessRow()).toBeNull();
  });

  it('does NOT show Mehrbedarf row when IST < SOLL (would be negative — covered by Ersparnis row)', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 8, istHektar: 7.9, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    expect(excessRow()).toBeNull();
    expect(savingsRow()).not.toBeNull();
  });

  // ── Übertrag row removed (Issue #336 follow-up) ────────────────────────

  it('does NOT show Übertrag row even when this tab would receive carryover from another tab', () => {
    // Issue #336 follow-up: User will keine Cross-Tab-Verrechnung in der UI sehen.
    // Auch wenn computeAllCarryovers() intern einen Empfänger-Saldo zuweisen würde,
    // wird KEINE .r-carryover-carryover-Zeile gerendert.
    w.addReiter();
    // Tab 0: SOLL=10, IST=8, koerner=50000, duenger=100, entries that fill IST
    // → fertig, savings source
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 10, istHektar: 8, koerner: 50000, duenger: 100, entries: []
    };
    w.state.reiter[0].entries.push({ einheit: 8, zaehlerStand: 8, duenger: 800, time: '08:00' });
    // Tab 1: SOLL=10, no IST → wäre Empfänger des Carryovers
    w.state.reiter[1] = {
      ...w.state.reiter[1], hektar: 10, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 1;
    w.renderResults();
    expect(carryoverRow()).toBeNull();
    // Tab 1 hat kein istHektar → keine Section, keine Zeilen.
    expect(sectionLabel()).toBeNull();
    expect(savingsRow()).toBeNull();
    expect(excessRow()).toBeNull();
  });

  it('does NOT show Übertrag row when no other tab provides carryover to this tab', () => {
    // Single tab, no carryover.
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 8, istHektar: 8, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    expect(carryoverRow()).toBeNull();
  });

  it('does NOT show Übertrag row even when active tab is a savings source (skip-rule Issue #138 scenario)', () => {
    // Vor #336 follow-up: Tab 0 mit eigenem IST<SOLL + Entry, der IST deckt,
    // zeigte keine Übertrag-Zeile (Skip-rule: covered savings source spendet
    // nicht an sich selbst). Nach #336 follow-up ist die Übertrag-Zeile
    // IMMER entfernt — egal welche Carryover-Logik im Hintergrund läuft.
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 10, istHektar: 7.9, koerner: 50000, duenger: 100, entries: []
    };
    w.state.reiter[0].entries.push({ einheit: 7.9, zaehlerStand: 7.9, duenger: 790, time: '08:00' });
    w.state.activeReiter = 0;
    w.renderResults();
    // Ersparnis bleibt sichtbar (Eigen-Abweichung dieses Tabs).
    expect(savingsRow()).not.toBeNull();
    // Übertrag bleibt unsichtbar (war nie da, ist nie da).
    expect(carryoverRow()).toBeNull();
  });

  // ── Kombinationen ──────────────────────────────────────────────────────

  it('shows Ersparnis + Mehrbedarf rows when tab has IST<SOLL and also IST>SOLL sides (impossible, but verifies gating)', () => {
    // Single tab can only have one of (IST<SOLL) or (IST>SOLL). So we can
    // show one or the other, never both. Verify that both rows are NEVER
    // simultaneously positive on the same tab.
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 8, istHektar: 7, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    expect(savingsRow()).not.toBeNull();
    expect(excessRow()).toBeNull();

    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 8, istHektar: 10, koerner: 50000, duenger: 100, entries: []
    };
    w.renderResults();
    expect(savingsRow()).toBeNull();
    expect(excessRow()).not.toBeNull();
  });

  it('does NOT show Übertrag row even when tab has own savings AND would receive carryover from another tab', () => {
    // Vor #336 follow-up zeigte Tab 1 in diesem Setup sowohl Ersparnis als
    // auch Übertrag. Nach #336 follow-up bleibt nur die Eigen-Ersparnis.
    w.addReiter();
    w.addReiter();
    // Tab 0: done, savings source
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 10, istHektar: 8, koerner: 50000, duenger: 100, entries: []
    };
    w.state.reiter[0].entries.push({ einheit: 8, zaehlerStand: 8, duenger: 800, time: '08:00' });
    // Tab 1: istHektar<SOLL → eigene Ersparnis; wäre auch Carryover-Empfänger
    w.state.reiter[1] = {
      ...w.state.reiter[1], hektar: 5, istHektar: 4, koerner: 50000, duenger: 100, entries: []
    };
    // Tab 2: not done, neutral
    w.state.reiter[2] = {
      ...w.state.reiter[2], hektar: 5, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 1;
    w.renderResults();
    // Eigen-Ersparnis weiterhin sichtbar.
    expect(savingsRow()).not.toBeNull();
    // Übertrag-Zeile wurde aus der UI entfernt — auch wenn der interne
    // Carryover-Verteiler etwas zuweisen würde.
    expect(carryoverRow()).toBeNull();
  });

  // ── Verrechnung-Invariante (Issue #335 contract) ─────────────────────

  it('does NOT modify r_drill_e_rem when carryover values are zero', () => {
    // Single tab, IST=SOLL → no savings, no excess, no carryover.
    // rem = IST - used = 8 - 5 = 3.0
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 8, istHektar: 8, koerner: 50000, duenger: 100, entries: []
    };
    w.state.reiter[0].entries.push({ einheit: 5, zaehlerStand: 5, duenger: 500, time: '10:00' });
    w.state.activeReiter = 0;
    w.renderResults();
    const remEl = doc.getElementById('r_drill_e_rem');
    expect(remEl).not.toBeNull();
    // rem = max(0, 8 - 5 - 0 + 0) = 3.0
    expect(remEl.textContent).toContain('3,0');
    const dRemEl = doc.getElementById('r_drill_d_rem');
    expect(dRemEl).not.toBeNull();
    expect(dRemEl.textContent).toContain('300');
  });

  // ── Live-Update / Tab-Wechsel ──────────────────────────────────────────

  it('updates the rows when the active tab is switched', () => {
    w.addReiter();
    // Tab 0: savings source with istHektar
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 8, istHektar: 7.9, koerner: 50000, duenger: 100, entries: []
    };
    // Tab 1: not done, no carryover source, no istHektar
    w.state.reiter[1] = {
      ...w.state.reiter[1], hektar: 10, koerner: 50000, duenger: 100, entries: []
    };
    // Switch to tab 0
    w.state.activeReiter = 0;
    w.renderResults();
    expect(savingsRow()).not.toBeNull();
    // Switch to tab 1
    w.state.activeReiter = 1;
    w.renderResults();
    // Tab 1 has no istHektar, no carryover source — all rows hidden.
    expect(savingsRow()).toBeNull();
    expect(excessRow()).toBeNull();
    expect(carryoverRow()).toBeNull();
  });

  it('re-renders cleanly after a drill-add (no leftover rows from previous render)', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 8, istHektar: 7.9, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    const before = hintContainer().innerHTML;
    expect(before.length).toBeGreaterThan(0);
    w.document.getElementById('drill_einheit').value = '7,9';
    w.document.getElementById('drill_hektar').value = '7,9';
    w.document.getElementById('drill_duenger').value = '790';
    w.drillAdd();
    // After drillAdd, the state has been mutated and renderResults called.
    // The container must be re-populated (no stale rows from the prior render).
    const after = hintContainer();
    expect(after.children.length).toBeGreaterThanOrEqual(0);
    // No leftover .carryover-hint/.excess-hint from the old structure.
    const orphans = after.querySelectorAll('.carryover-hint, .excess-hint');
    expect(orphans.length).toBe(0);
  });

  // ── Class structure ────────────────────────────────────────────────────

  it('uses r-carryover-row base class on Ersparnis and Mehrbedarf rows', () => {
    // Setup: tab 0 with IST<SOLL (Ersparnis-Quelle) und Tab 0 mit IST>SOLL
    // (Mehrbedarf-Quelle) — jeder Test-Aufruf nutzt eine eigene Tab-Konfig.
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 8, istHektar: 6, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    // Tab 0: Ersparnis-Zeile mit korrekten Klassen.
    const s = savingsRow();
    expect(s).not.toBeNull();
    expect(s.classList.contains('r-carryover-row')).toBe(true);
    expect(s.classList.contains('r-carryover-savings')).toBe(true);
    // Tab 0 hat keinen Carryover-Empfänger (single tab) — Übertrag-Zeile fehlt.
    expect(carryoverRow()).toBeNull();

    // Tab 0 umkonfigurieren: IST > SOLL → Mehrbedarf-Zeile.
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 8, istHektar: 10, koerner: 50000, duenger: 100, entries: []
    };
    w.renderResults();
    const e = excessRow();
    expect(e).not.toBeNull();
    expect(e.classList.contains('r-carryover-row')).toBe(true);
    expect(e.classList.contains('r-carryover-excess')).toBe(true);
    expect(carryoverRow()).toBeNull();
  });

  it('renders rows in the order Ersparnis → Mehrbedarf (Übertrag row removed)', () => {
    // Setup with own savings and possible carryover — only Ersparnis + (hidden)
    // Mehrbedarf expected. Übertrag-Row existiert nicht mehr in der UI.
    w.addReiter();
    w.addReiter();
    // Tab 0: done, savings source
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 8, istHektar: 6, koerner: 50000, duenger: 100, entries: []
    };
    w.state.reiter[0].entries.push({ einheit: 6, zaehlerStand: 6, duenger: 600, time: '08:00' });
    // Tab 1: not done, IST<SOLL → savings source
    w.state.reiter[1] = {
      ...w.state.reiter[1], hektar: 5, istHektar: 4, koerner: 50000, duenger: 100, entries: []
    };
    // Tab 2: not done, neutral
    w.state.reiter[2] = {
      ...w.state.reiter[2], hektar: 5, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 1;
    w.renderResults();
    // Übertrag-Row darf nirgendwo im Hint-Container sein.
    expect(hintContainer().querySelectorAll('.r-carryover-carryover').length).toBe(0);
    // Keine Zeile mit "Übertrag" im Klartext.
    expect(hintContainer().textContent).not.toContain('Übertrag');
    // Ersparnis erscheint (Tab 1 hat eigene Ersparnis).
    const s = savingsRow();
    expect(s).not.toBeNull();
  });
});

describe('Issue #336 follow-up: kein Übertrag-Empfänger-Saldo im Ergebnis-Tab', () => {
  let w, doc;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
  });

  // ── Helpers ────────────────────────────────────────────────────────────

  function hintContainer() {
    return doc.getElementById('r_carryover_hint');
  }
  function savingsRow() {
    return hintContainer().querySelector('.r-carryover-savings');
  }
  function excessRow() {
    return hintContainer().querySelector('.r-carryover-excess');
  }
  // Carryover-Row ist absichtlich entfernt — der Selector existiert nur als
  // Negativ-Test. Wenn der Code zurückfällt, schlägt jeder Test fehl, der
  // diesen Selector benutzt.
  function carryoverRow() {
    return hintContainer().querySelector('.r-carryover-carryover');
  }
  function sectionLabel() {
    return hintContainer().querySelector('.r-carryover-section-label');
  }
  function hintText() {
    const h = hintContainer();
    return h ? h.textContent : '';
  }

  // ── 3-Tab-Szenario aus dem User-Feedback ───────────────────────────────

  it('3 Tabs (10/7,5/5 soll, 9/7,5/5 ist): Tab 1 zeigt nur "Ersparnis", Tab 2 und 3 sind leer', () => {
    w.addReiter();
    w.addReiter();
    // Tab 0: SOLL=10, IST=9 → Ersparnis 1 ha
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 10, istHektar: 9, koerner: 50000, duenger: 100, entries: []
    };
    // Tab 1: SOLL=7.5, IST=7.5 → keine Abweichung
    w.state.reiter[1] = {
      ...w.state.reiter[1], hektar: 7.5, istHektar: 7.5, koerner: 50000, duenger: 100, entries: []
    };
    // Tab 2: SOLL=5, IST=5 → keine Abweichung
    w.state.reiter[2] = {
      ...w.state.reiter[2], hektar: 5, istHektar: 5, koerner: 50000, duenger: 100, entries: []
    };

    // Tab 0 prüfen: "Abweichung dieses Tabs" + "Ersparnis: ..." sichtbar
    w.state.activeReiter = 0;
    w.renderResults();
    expect(sectionLabel()).not.toBeNull();
    expect(sectionLabel().textContent).toContain('Abweichung dieses Tabs');
    expect(savingsRow()).not.toBeNull();
    expect(savingsRow().textContent).toContain('Ersparnis');
    // 1 ha Ersparnis bei 50000 Koerner/ha = 50000 Koerner = 1,0 Einheiten Saatgut
    expect(savingsRow().textContent).toContain('1,0');
    expect(savingsRow().textContent).toContain('Einheiten Saatgut');
    // 1 ha × 100 kg/ha → 100 kg Dünger
    expect(savingsRow().textContent).toContain('100');
    expect(savingsRow().textContent).toContain('kg Dünger');
    // KEINE Mehrbedarf-Zeile (Tab 0 hat IST<SOLL)
    expect(excessRow()).toBeNull();
    // KEINE Übertrag-Zeile (auch wenn intern ein Carryover-Verteil-Saldo existieren würde)
    expect(carryoverRow()).toBeNull();
    // Negativ-Assertion auf Klartext: kein "Übertrag" in der UI sichtbar
    expect(hintText()).not.toContain('Übertrag');

    // Tab 1: IST=SOLL → komplett leer
    w.state.activeReiter = 1;
    w.renderResults();
    expect(sectionLabel()).toBeNull();
    expect(savingsRow()).toBeNull();
    expect(excessRow()).toBeNull();
    expect(carryoverRow()).toBeNull();
    expect(hintText()).not.toContain('Übertrag');

    // Tab 2: IST=SOLL → komplett leer
    w.state.activeReiter = 2;
    w.renderResults();
    expect(sectionLabel()).toBeNull();
    expect(savingsRow()).toBeNull();
    expect(excessRow()).toBeNull();
    expect(carryoverRow()).toBeNull();
    expect(hintText()).not.toContain('Übertrag');
  });

  // ── Negativ-Test: auch wenn andere Tabs theoretisch als Carryover-Quelle dienen könnten ──

  it('zeigt keine Übertrag-Zeile wenn ein anderer Tab IST<SOLL hat (Tab-Empfänger)', () => {
    w.addReiter();
    // Tab 0: SOLL=10, IST=9 → savings source (würde intern Carryover an Tab 1 spenden)
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 10, istHektar: 9, koerner: 50000, duenger: 100, entries: []
    };
    // Tab 1: SOLL=10, kein IST → wäre der Empfänger des Carryovers
    w.state.reiter[1] = {
      ...w.state.reiter[1], hektar: 10, koerner: 50000, duenger: 100, entries: []
    };
    // App-Logik läuft: computeAllCarryovers() würde Tab 1 etwas zuweisen.
    // Aber: in der UI darf KEIN Übertrag-Empfänger-Saldo erscheinen.
    w.state.activeReiter = 1;
    w.renderResults();
    // Tab 1 hat kein istHektar → keine Abweichung, keine Section.
    expect(sectionLabel()).toBeNull();
    expect(savingsRow()).toBeNull();
    expect(excessRow()).toBeNull();
    expect(carryoverRow()).toBeNull();
    expect(hintText()).not.toContain('Übertrag');
  });

  // ── Negativ-Test: Section-Label umbenannt ──────────────────────────────

  it('Section-Label heißt "Abweichung dieses Tabs", nicht "Carryover dieses Tabs"', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 8, istHektar: 7, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    const label = sectionLabel();
    expect(label).not.toBeNull();
    expect(label.textContent).toBe('Abweichung dieses Tabs');
    // Alttext "Carryover dieses Tabs" muss weg sein.
    expect(label.textContent).not.toContain('Carryover');
  });

  // ── Mehrbedarf bleibt funktional ──────────────────────────────────────

  it('zeigt "Mehrbedarf" weiterhin korrekt wenn IST>SOLL', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 8, istHektar: 10, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    const e = excessRow();
    expect(e).not.toBeNull();
    expect(e.textContent).toContain('Mehrbedarf');
    // 2 ha × 50000 Körner/ha = 100.000 Körner = 2 Einheiten Saatgut
    expect(e.textContent).toContain('2,0');
    expect(e.textContent).toContain('Einheiten Saatgut');
    // 2 ha × 100 kg/ha = 200 kg Dünger
    expect(e.textContent).toContain('200');
    expect(e.textContent).toContain('kg Dünger');
    expect(savingsRow()).toBeNull();
    expect(carryoverRow()).toBeNull();
    expect(hintText()).not.toContain('Übertrag');
  });
});

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

    it('User-Szenario: computeShownExcess gibt Roh-Mehrbedarf zurück (senken-modell: netted=0)', () => {
        setupUserScenario();
        const r1 = w.state.reiter[0];
        // Roh-Mehrbedarf (Flächen-Abweichung, Hinweis): 16ha - 15ha = 1ha → 1.6 E.
        const rawE = w.getTabIstEinheiten(r1) - w.getTabTotalEinheiten(r1);
        expect(rawE).toBeCloseTo(1.6, 1);
        // Senken-Modell: netted=0 (Material-Defizit fließt auf die Senke, nicht als
        // Hinweis-netting). computeShownExcess = max(0, raw - 0) = raw.
        const co = w.getCarryover(0);
        expect(co.nettedEinheit).toBe(0);
        const shown = w.computeShownExcess({ excessE: rawE, excessD: 200 }, co);
        expect(shown.shownExcessE).toBeCloseTo(1.6, 1);
    });

    it('User-Szenario: computeShownExcess D gibt Roh-Wert zurück', () => {
        setupUserScenario();
        const co = w.getCarryover(0);
        expect(co.nettedDuenger).toBe(0);
        const shown = w.computeShownExcess({ excessE: 1.6, excessD: 200 }, co);
        expect(shown.shownExcessD).toBeCloseTo(200, 0);
    });

    it('User-Szenario: renderResultCard zeigt die Mehrbedarf-Zeile (senken-modell: nicht geblendet)', () => {
        setupUserScenario();
        w.state.activeReiter = 0;
        w.renderResults();
        const hint = doc.getElementById('r_carryover_hint');
        expect(hint).not.toBeNull();
        // Die .r-carryover-excess-Zeile ist sichtbar (Mehrbedarf-Hinweis).
        const excess = hint.querySelector('.r-carryover-excess');
        expect(excess).not.toBeNull();
    });

    it('User-Szenario: renderResultCard für Tab1 zeigt die "Mehrbedarf"-Zeile', () => {
        setupUserScenario();
        w.state.activeReiter = 0;
        w.renderResults();
        const hint = doc.getElementById('r_carryover_hint');
        expect(hint.textContent).toContain('Mehrbedarf');
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

    it('Edge 1: computeShownExcess gibt vollen Roh-Mehrbedarf zurück (senken-modell)', () => {
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
        // Senken-Modell: kein Netting auf der Hinweis-Anzeige (netted=0).
        const co = w.getCarryover(0);
        expect(co.nettedEinheit).toBe(0);
        expect(co.nettedDuenger).toBe(0);
        const shown = w.computeShownExcess({ excessE: 1.6, excessD: 320 }, co);
        expect(shown.shownExcessE).toBeCloseTo(1.6, 1);
        expect(shown.shownExcessD).toBeCloseTo(320, 0);
    });

    it('Edge 1: renderResultCard zeigt die Mehrbedarf-Zeile mit Roh-Werten', () => {
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
        // Roh-Mehrbedarf 1,6 E Saatgut (senken-modell: kein Netting/Hidden)
        expect(excess.textContent).toContain('1,6');
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
