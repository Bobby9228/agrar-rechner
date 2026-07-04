/**
 * Tests for IST/SOLL savings and carryover display in protocol.
 * IST is now a separate field per tab (r.istHektar).
 * Carryover goes to the first NOT-fertig tab, not distributed across all subsequent tabs.
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

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
    w.berechne();

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
    w.berechne();

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
    w.berechne();

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

    // Tab 0 is done → no carryover for it
    var co0 = w.getCarryover(0);
    expect(co0.savedEinheit).toBe(0);
    expect(co0.savedDuenger).toBe(0);
  });

  it('savings calculation is correct for seed and fertilizer', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '10';
    w.document.getElementById('ist_hektar').value = '9,5';
    w.document.getElementById('koerner').value = '50000';
    w.document.getElementById('duenger').value = '200';
    w.berechne();

    // SOLL: 10 Einheiten, 2000 kg Dünger
    // IST: 9.5 ha → 9.5 Einheiten, 1900 kg Dünger
    // Savings: 0.5 Einheiten, 100 kg Dünger
    w.document.getElementById('drill_einheit').value = '9,5';
    w.document.getElementById('drill_hektar').value = '9,5';
    w.drillAdd();

    const savingsEl = w.document.getElementById('ds_savings');
    expect(savingsEl).not.toBeNull();
    expect(savingsEl.textContent).toContain('0,5 Einheiten Saatgut');
  });

  // REMOVED (#378 Regel-7): 'getCarryover: all savings go to first not-done tab'
  //   — Phase-1 Ersparnis-Kaskade gestrichen. `savedEinheit` ist unter Regel 7
  //   IMMER 0. Coverage für die neue Pool-Semantik liegt in tests/55
  //   (Carryover-Invarianten) und tests/56 (Pool-Definition).

  it('no savings shown when no istHektar set', () => {
    const { w } = setup();
    w.document.getElementById('hektar').value = '8';
    w.document.getElementById('koerner').value = '50000';
    w.document.getElementById('duenger').value = '100';
    w.berechne();

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

    // Tab 1 has the latest entry → it's the last-filled tab → gets excess deducted
    var co1 = w.getCarryover(1);
    expect(co1.excessEinheit).toBeCloseTo(2, 1);  // 10 - 8 = 2 ha excess
    expect(co1.excessDuenger).toBeCloseTo(200, 0);
    // Tab 0 gets nothing
    var co0 = w.getCarryover(0);
    expect(co0.excessEinheit).toBe(0);
    expect(co0.savedEinheit).toBe(0);
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

    // Excess-Pool = 3 E. Tab 0 ist Quelle (istE=8 > solE=5) → Skip in Phase 2.
    // Tab 1 (neutral) absorbiert 2 E (volle Cap). Rest 1 E verfällt.
    var co1 = w.getCarryover(1);
    expect(co1.excessEinheit).toBeCloseTo(2, 1);

    // Tab 0 (Mehrbedarf-Quelle): bekommt KEINEN excessEinheit (Self-Absorb
    // ist mit Netto-Fix ausgeschlossen).
    var co0 = w.getCarryover(0);
    expect(co0.excessEinheit).toBeCloseTo(0, 1);
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
    expect(excessDivs[0].textContent).toContain('2,9');
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
      c.classList.contains('drill-entry-tab-header') && c.textContent.includes('Tab 1'));
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
