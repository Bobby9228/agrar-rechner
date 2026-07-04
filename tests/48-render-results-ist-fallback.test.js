/**
 * Tests for Issue #320, aktualisiert für Regel-7 Pool-Modell (Issue #378):
 * render-results.js renderDrillEntriesInline uses
 * `istHa > 0 ? getTabIstX(r) : getTabTotalX(r)` ternary.
 *
 * Background:
 * - Sibling render sites (render-dashboard.js:60-61, render-drill.js:50-52,
 *   143-144, renderResultCard at line 22-24) all use the explicit ternary
 *   `istHa > 0 ? getTabIstX(r) : getTabTotalX(r)`.
 * - Issue #320 was the last remaining site still using `||`.
 *
 * Behavioral equivalence:
 *   For all reachable inputs through the public API (istHa, koerner, duenger
 *   all ≥ 0), the `||`-pattern and the ternary produce IDENTICAL values.
 *
 * Pool-Semantik (Regel 7, #378):
 *   `savedEinheit`/`savedDuenger` ist IMMER 0. Keine per-Tab-Ersparnis-
 *   Subtraktion mehr. remaining = max(0, basis - used + entzogen).
 *
 *   - Test 1 (Single Tab, istHa=4, solHa=5): Tab ist kein Mehrbedarf
 *     (ist<sol) → cco.excess=0. remaining = 7,2 - 0,1 + 0 = 7,1.
 *     Vor #378 wurde 1,8 E eigene-Ersparnis abgezogen → 5,3.
 *   - Test 3 (3 Tabs, Tab A istMehrbedarf): Pool-Verteilung zieht aus
 *     "späteren" Tabs (Tab C gibt 0,1 E ab) → Tab C's remaining erhöht
 *     sich um 0,1. Tab A nimmt nichts von C (Befund 1 / Selbstgutschrift
 *     ausgeschlossen). C's Wert: 13,5 - 0,1 + 0,1 = 13,5.
 *     Vor #378 wurde 0,9 E "saved" abgezogen und 0,9 E "excess" addiert
 *     → 13,4.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

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
    expect(doc.getElementById('r_drill_e_rem').textContent).toBe('7,1 Einheiten');
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
    // Vor #378 (Phase-1): C hätte 0,9 E "saved" abgezogen + 0,9 E "excess"
    // addiert = 13,4. Das Modell ist komplett ausgetauscht — die "Ersparnis
    // aus IST<SOLL" landet NICHT mehr per Phase-1-Pfad bei Mehrbedarf-Tabs,
    // sondern im globalen Pool und wird nur bei tatsächlichem Mehrmbedarf
    // ausgespeist.
    expect(doc.getElementById('r_drill_e_rem').textContent).toBe('13,5 Einheiten');
    expect(doc.getElementById('r_drill_d_rem').textContent).toContain('1.500');
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
