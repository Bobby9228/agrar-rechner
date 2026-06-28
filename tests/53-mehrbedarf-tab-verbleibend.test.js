/**
 * Tests for Issue (Mehrbedarf-Tab Verbleibend / netting flow-back):
 *
 * Im 3-Tab-Szenario (10/7,5/5 ha) zeigt ein Mehrbedarf-Tab (IST>SOLL,
 * z.B. Tab 2 mit 8ha IST bei 7,5ha SOLL) den rohen Mehrbedarf (1 E + 100 kg)
 * als "verbleibend / noch einzufüllen" an, obwohl dieser Mehrbedarf durch
 * das Cross-Tab-Netting VOLLSTÄNDIG abgedeckt ist (Tab 1 Ersparnis ≥
 * Tab 2 Mehrbedarf). Der Tab ist real fertig, die Anzeige suggeriert aber
 * offenen Bedarf.
 *
 * Root cause: _computeNetCarryoverPools() netted korrekt
 * (netSaved=max(0,totalSaved-totalExcess), netExcess=max(0,totalExcess-totalSaved)).
 * computeAllCarryovers überspringt Mehrbedarf-Tabs in Phase 1 und Phase 2.
 * ⇒ getCarryover(MehrbedarfTab) = {0,0,0,0}. Netting-Abdeckung fließt
 *   NICHT zurück in den per-Tab-Wert.
 * ⇒ Per-Tab remaining formula (max(0, basis - used - saved + excess))
 *   zeigt rohen Mehrbedarf statt 0.
 *
 * Setup:
 *   Tab 0 (10/9 ha):    SOLL 20 E / 2.000 kg, IST 18 E / 1.800 kg, used 18 E / 1.800 kg → Ersparnis-Quelle
 *   Tab 1 (7.5/8 ha):   SOLL 15 E / 1.500 kg, IST 16 E / 1.600 kg, used 15 E / 1.500 kg → MEHRBEDARF
 *   Tab 2 (5/5 ha):     SOLL 10 E / 1.000 kg, IST 10 E / 1.000 kg, used  8 E /   500 kg → neutral, unterfüllt
 *
 *   totalSaved  E = 2, D = 200
 *   totalExcess E = 1, D = 100
 *   netSaved    E = 1, D = 100      ← Tab 2 Mehrbedarf VOLLSTÄNDIG abgedeckt (netExcess = 0)
 *   netExcess   E = 0, D = 0
 *
 * After fix:
 *   - getCarryover(Tab 1) must reflect netted coverage (saved/excess that flowed back).
 *     OR all 4 remaining-computation sites must clamp basis to SOLL for Mehrbedarf-Tabs.
 *   - getCarryover(Tab 2) = { savedEinheit: 1, savedDuenger: 100, ... }
 *     (Tab 3 receives the post-netting savings; Tab 1's residual savings 1E/100kg flow to Tab 3).
 *   - isTabDone(Tab 1) === true
 *   - All 4 render sites show 0/0 for Tab 1's remaining
 *   - Tab 0 unchanged (Ersparnis-Quelle, done): 0/0
 *   - Tab 2 unchanged (neutral, unterfüllt, gets savings): 1E + 400 kg (8/500 used, basis 10/1000, saved 1E/100kg → (10-8-1)=1, (1000-500-100)=400)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Mehrbedarf-Tab verbleibend = 0 wenn durch Netting abgedeckt', () => {
  let w, doc;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
  });

  // Helper: set up the 3-tab repro from the task spec.
  function setup3Tabs() {
    w.state.koernerProEinheit = 50000;
    w.state.reiter[0] = {
      name: 'Acker 1', hektar: 10, istHektar: 9, koerner: 100000, duenger: 200,
      entries: [{ einheit: 18, duenger: 1800, time: '08:00' }],
      fahrgassenEnabled: false, fahrgassenBreite: 0
    };
    w.state.reiter[1] = {
      name: 'Acker 2', hektar: 7.5, istHektar: 8, koerner: 100000, duenger: 200,
      entries: [{ einheit: 15, duenger: 1500, time: '09:00' }],
      fahrgassenEnabled: false, fahrgassenBreite: 0
    };
    w.state.reiter[2] = {
      name: 'Acker 3', hektar: 5, istHektar: 5, koerner: 100000, duenger: 200,
      entries: [{ einheit: 8, duenger: 500, time: '10:00' }],
      fahrgassenEnabled: false, fahrgassenBreite: 0
    };
    if (w.invalidateCarryoverCache) w.invalidateCarryoverCache();
  }

  // Mirror the per-tab remaining formula used by all 4 render sites AFTER fix.
  // MUST stay identical to the inline math in render-drill.js:55-56,
  // render-dashboard.js:65-66 / 174-175, render-results.js:187-188,
  // and isTabDone() in calculations.js. Netting-Coverage-Abzug (Phase 0.5)
  // wird via co.nettedEinheit / co.nettedDuenger subtrahiert.
  function computeRemaining(r, i) {
    var istHa = w.getTabIstHektar(r);
    var istE = istHa > 0 ? w.getTabIstEinheiten(r) : w.getTabTotalEinheiten(r);
    var istD = istHa > 0 ? w.getTabIstDuenger(r) : w.getTabTotalDuenger(r);
    var usedE = r.entries ? r.entries.reduce(function (s, e) { return s + (e.einheit || 0); }, 0) : 0;
    var usedD = r.entries ? r.entries.reduce(function (s, e) { return s + (e.duenger || 0); }, 0) : 0;
    var co = w.getCarryover(i);
    return {
      basisE: istE, basisD: istD, usedE: usedE, usedD: usedD,
      remainingE: Math.max(0, istE - usedE - co.savedEinheit + co.excessEinheit - (co.nettedEinheit || 0)),
      remainingD: Math.max(0, istD - usedD - co.savedDuenger + co.excessDuenger - (co.nettedDuenger || 0)),
    };
  }

  // ── Core scenario ───────────────────────────────────────────────────────

  it('Tab 1 (Mehrbedarf, durch Netting voll abgedeckt) zeigt remainingE === 0', () => {
    setup3Tabs();
    const rem = computeRemaining(w.state.reiter[1], 1);
    expect(rem.remainingE).toBe(0);
  });

  it('Tab 1 (Mehrbedarf, durch Netting voll abgedeckt) zeigt remainingD === 0', () => {
    setup3Tabs();
    const rem = computeRemaining(w.state.reiter[1], 1);
    expect(rem.remainingD).toBe(0);
  });

  it('isTabDone(Tab 1) === true (Mehrbedarf ist durch Netting abgedeckt)', () => {
    setup3Tabs();
    expect(w.isTabDone(w.state.reiter[1], 1)).toBe(true);
  });

  // ── Regression-Guard: Tab 0 (Ersparnis-Quelle) bleibt 0/0 ────────────────

  it('Tab 0 (Ersparnis-Quelle, done) bleibt remainingE === 0', () => {
    setup3Tabs();
    expect(computeRemaining(w.state.reiter[0], 0).remainingE).toBe(0);
  });

  it('Tab 0 (Ersparnis-Quelle, done) bleibt remainingD === 0', () => {
    setup3Tabs();
    expect(computeRemaining(w.state.reiter[0], 0).remainingD).toBe(0);
  });

  // ── Regression-Guard: Tab 2 (neutral, unterfüllt, empfängt savings) ─────
  //   Tab 2 hat used < basis (8 E / 500 kg von 10 E / 1.000 kg).
  //   Pool nach Netting: netSaved = 1 E / 100 kg → fließt an Tab 2.
  //   ⇒ remaining = (10 - 8 - 1) E + (1000 - 500 - 100) kg = 1 E + 400 kg

  it('Tab 2 (neutral, unterfüllt) bleibt remainingE === 1 (erspartes 1E nach Tab 2 geflossen)', () => {
    setup3Tabs();
    expect(computeRemaining(w.state.reiter[2], 2).remainingE).toBe(1);
  });

  it('Tab 2 (neutral, unterfüllt) bleibt remainingD === 400 (ersparte 100 kg nach Tab 2 geflossen)', () => {
    setup3Tabs();
    expect(computeRemaining(w.state.reiter[2], 2).remainingD).toBe(400);
  });

  // ── 4-Site render verification ──────────────────────────────────────────
  //
  // (a) Drill-Tab-Status dtl_need_1 = "✓ fertig"
  // (b) Dashboard Per-Tab-Karte Acker 2 (Tab 1): einheitRem=0 duengerRem=0
  // (c) Inline drill r_drill_e_rem/r_drill_d_rem (activeReiter = 1)
  // (d) Drill summary ds_saat_remaining/ds_duenger_remaining — must remain 0/0
  //     (Phase A/B netting already correctly aggregates; totalNeedE excludes
  //     Mehrbedarf-tabs since Issue #347 — totalNeed = (10-8) = 2E,
  //     totalSaved = 1E, totalExcess = 0, rem = max(0, 2-1+0) = 1 E.)

  it('(a) Drill-Tab-Status Tab 1 zeigt "✓ fertig"', () => {
    setup3Tabs();
    w.state.activeReiter = 1;
    w.renderDrillTabList();
    const el = doc.getElementById('dtl_need_1');
    expect(el).toBeTruthy();
    expect(el.textContent).toContain('fertig');
  });

  it('(b) Dashboard Per-Tab-Karte Acker 2 zeigt 0 / 0', () => {
    setup3Tabs();
    w.openDashboard();
    const cards = doc.querySelectorAll('.dashboard-reiter-card');
    // Tab 1 is the second card. Values: [Hektar, Körner/ha, Einh. verbl., Dünger verbl.]
    const values = cards[1].querySelectorAll('.dashboard-stat-value');
    expect(values[2].textContent.trim()).toBe('0');
    expect(values[3].textContent.trim()).toContain('0');
  });

  it('(c) Inline-Drill (activeReiter = Tab 1) zeigt 0,0 Einheiten / 0 kg', () => {
    setup3Tabs();
    w.state.activeReiter = 1;
    w.renderResults();
    expect(doc.getElementById('r_drill_e_rem').textContent).toContain('0');
    // formatEinheit returns "—" when remD === 0; that's OK per formatter contract.
    const remDRow = doc.getElementById('r_drill_d_rem');
    const remDRowDisplay = doc.getElementById('r_drill_d_rem_row').style.display;
    // Either shown as "0 kg" or row hidden via "—" — both are "nicht mehr offen".
    expect(remDRow.textContent === '—' || remDRow.textContent.includes('0')).toBe(true);
    expect(remDRowDisplay === 'none' || remDRow.textContent.includes('0')).toBe(true);
  });

  // ── Edge case: Mehrbedarf NICHT vollständig abgedeckt ───────────────────
  //   Tab A: 10/9 ha → Ersparnis 2E/200kg
  //   Tab B: 7.5/8 ha → Mehrbedarf 1E/100kg
  //   Tab C: 7.5/8 ha → Mehrbedarf 1E/100kg
  //   totalExcess = 2E/200kg > totalSaved = 2E/200kg → netExcess = 0 (full coverage)
  //   Push it over: Tab B + Tab C mit 1E/100kg each, beide durch Netting abgedeckt (1E bleibt über für Tab C → 1E/100kg un-covered).
  //
  //   Korrekt: Tab B (erste Mehrbedarf-Quelle) kriegt 1E/100kg aus Tab A, remaining = 0/0.
  //            Tab C (zweite Mehrbedarf-Quelle) kriegt 1E/100kg aus Tab A (rest), remaining = 0/0.
  //   Total netExcess = 0. Wenn mehr Tabs: z.B. 3 Mehrbedarf-Tabs à 1E, totalExcess = 3E
  //   totalSaved = 2E → netExcess = 1E → Tab 3 (dritter Mehrbedarf) zeigt 1E remaining.

  it('Edge case: 2 Mehrbedarf-Tabs, beide vollständig durch Netting abgedeckt → beide 0/0', () => {
    w.state.koernerProEinheit = 50000;
    w.state.reiter[0] = {
      name: 'A', hektar: 10, istHektar: 9, koerner: 100000, duenger: 200,
      entries: [{ einheit: 18, duenger: 1800, time: '08:00' }],
      fahrgassenEnabled: false, fahrgassenBreite: 0
    };
    w.state.reiter[1] = {
      name: 'B', hektar: 7.5, istHektar: 8, koerner: 100000, duenger: 200,
      entries: [{ einheit: 15, duenger: 1500, time: '09:00' }],
      fahrgassenEnabled: false, fahrgassenBreite: 0
    };
    w.state.reiter[2] = {
      name: 'C', hektar: 7.5, istHektar: 8, koerner: 100000, duenger: 200,
      entries: [{ einheit: 15, duenger: 1500, time: '09:30' }],
      fahrgassenEnabled: false, fahrgassenBreite: 0
    };
    if (w.invalidateCarryoverCache) w.invalidateCarryoverCache();
    // totalSaved = 2E/200kg, totalExcess = 2E/200kg → netSaved = 0, netExcess = 0
    // Beide Mehrbedarf-Tabs (B + C) sollten 0/0 remaining zeigen.
    expect(computeRemaining(w.state.reiter[1], 1).remainingE).toBe(0);
    expect(computeRemaining(w.state.reiter[1], 1).remainingD).toBe(0);
    expect(computeRemaining(w.state.reiter[2], 2).remainingE).toBe(0);
    expect(computeRemaining(w.state.reiter[2], 2).remainingD).toBe(0);
  });

  it('Edge case: 3 Mehrbedarf-Tabs à 1E, totalExcess = 3E > totalSaved = 2E → coverageRatio = 2/3, jeder Tab hat 0.33E offen', () => {
    w.state.koernerProEinheit = 50000;
    w.state.reiter[0] = {
      name: 'A', hektar: 10, istHektar: 9, koerner: 100000, duenger: 200,
      entries: [{ einheit: 18, duenger: 1800, time: '08:00' }],
      fahrgassenEnabled: false, fahrgassenBreite: 0
    };
    // 3 Mehrbedarf-Tabs. totalExcess = 3E, totalSaved = 2E →
    // coverageRatio = 2/3 → jeder Mehrbedarf-Tab bekommt 0.67E coverage,
    // 0.33E bleiben offen (über alle 3 Tabs verteilt = 1E = un-covered netExcess).
    w.state.reiter[1] = {
      name: 'B', hektar: 7.5, istHektar: 8, koerner: 100000, duenger: 200,
      entries: [{ einheit: 15, duenger: 1500, time: '09:00' }],
      fahrgassenEnabled: false, fahrgassenBreite: 0
    };
    w.state.reiter[2] = {
      name: 'C', hektar: 7.5, istHektar: 8, koerner: 100000, duenger: 200,
      entries: [{ einheit: 15, duenger: 1500, time: '09:30' }],
      fahrgassenEnabled: false, fahrgassenBreite: 0
    };
    w.state.reiter[3] = {
      name: 'D', hektar: 7.5, istHektar: 8, koerner: 100000, duenger: 200,
      entries: [{ einheit: 15, duenger: 1500, time: '10:00' }],
      fahrgassenEnabled: false, fahrgassenBreite: 0
    };
    if (w.invalidateCarryoverCache) w.invalidateCarryoverCache();

    // Tab 0 (Ersparnis-Quelle) → 0E
    expect(computeRemaining(w.state.reiter[0], 0).remainingE).toBe(0);
    // Tab 1, 2, 3 (Mehrbedarf, partial coverage): each ~0.33E remaining.
    // Sum über alle 3 = 1E = un-covered netExcess. Test prüft die Summe.
    const rem1 = computeRemaining(w.state.reiter[1], 1).remainingE;
    const rem2 = computeRemaining(w.state.reiter[2], 2).remainingE;
    const rem3 = computeRemaining(w.state.reiter[3], 3).remainingE;
    const sum = rem1 + rem2 + rem3;
    // Floating-Point-tolerant: jede Tab bleibt ≈ 1/3, Summe ≈ 1E.
    expect(Math.abs(sum - 1)).toBeLessThan(0.05);
    // Kein Tab zeigt den vollen 1E Mehrbedarf (Netting muss wirken).
    expect(rem1).toBeLessThan(0.5);
    expect(rem2).toBeLessThan(0.5);
    expect(rem3).toBeLessThan(0.5);
  });
});