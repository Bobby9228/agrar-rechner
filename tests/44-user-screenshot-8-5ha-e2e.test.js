/**
 * Test 44: End-to-End Reproduktion des User-Screenshots 2026-06-22
 *
 * Setup (genau wie im Screenshot):
 *   - Tab 1: 8 ha SOLL, 90000 Körner/ha, 200 kg/ha Dünger
 *   - Tab 2: 5 ha SOLL, 90000 Körner/ha, 200 kg/ha Dünger
 *   - SOLL gesamt: 23,4 Einheiten / 2.600 kg
 *
 * User-Aktionen:
 *   - Fill #1: 18 Einheiten / 1.500 kg Dünger
 *   - Fill #2: 12 Einheiten / 1.000 kg Dünger
 *
 * Erwartung nach allen Fixes (PR #322 _buildDrillEntry + PR #327 _calcDrillDistribution):
 *   - Total Einträge: 4 (2 pro Tab, jeweils 1 pro Fill)
 *   - Saat gesamt: 23,4 E (= SOLL)
 *   - Dünger gesamt: 2.500 kg (= was tatsächlich eingefüllt wurde)
 *   - Tab 1 SOLL ist erfüllt nach Fill #1 → Fill #2 gibt Tab 1 nur Dünger
 *   - Tab 2 braucht nur noch Saat → Fill #2 gibt Tab 2 nur Saat
 *
 * Anti-Regression gegen:
 *   - Issue #315: Math.min(duengerRaw, duengerPerUnit * units)-Cap
 *   - Issue #326: tabDCap in _calcDrillDistribution
 *
 * Vorher (mit Caps):
 *   - Tab 2 Entry #2 hätte `duenger = min(1000, 5.4 × 111.11) = 600` (Bugs sehen)
 *   - Tab 1 Entry #2 hätte `einheit = 0` (durch tabDCap wäre Dünger auch gecappt)
 * Nachher (mit Fixes):
 *   - Einträge spiegeln die tatsächliche Verteilung nach Prio
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

function setup8_5ha(w) {
  // Reset und exaktes Setup
  w.state.reiter = [
    { name: 'Tab 1', hektar: 8, istHektar: 0, koerner: 90000, duenger: 200, entries: [] },
    { name: 'Tab 2', hektar: 5, istHektar: 0, koerner: 90000, duenger: 200, entries: [] },
  ];
  w.state.drillPriorities = { 0: 1, 1: 2 };
  w.state.koernerProEinheit = 50000;
  w.renderDrillTabList();
  w.renderTabs();
}

function fill(w, einheit, duenger) {
  w.document.getElementById('drill_einheit').value = String(einheit);
  w.document.getElementById('drill_duenger').value = String(duenger);
  w.drillCalcAll();
  w.drillAdd();
}

describe('E2E: User-Screenshot 2026-06-22 (8ha + 5ha Setup)', () => {
  it('reproduces the exact user scenario and verifies correct totals', () => {
    const { window: w } = createDom();
    setup8_5ha(w);

    // Fill #1: 18 E / 1.500 kg
    fill(w, 18, 1500);

    // Fill #2: 12 E / 1.000 kg
    fill(w, 12, 1000);

    const tab1 = w.state.reiter[0];
    const tab2 = w.state.reiter[1];

    // 1) Entry-Anzahl: 2 pro Tab
    expect(tab1.entries.length).toBe(2);
    expect(tab2.entries.length).toBe(2);

    // 2) SOLL-Totals matchen
    const totalSaat = tab1.entries.concat(tab2.entries).reduce((s, e) => s + (e.einheit || 0), 0);
    const totalDuenger = tab1.entries.concat(tab2.entries).reduce((s, e) => s + (e.duenger || 0), 0);
    expect(totalSaat).toBeCloseTo(23.4, 2);
    expect(totalDuenger).toBeCloseTo(2500, 0);  // 1500 + 1000

    // 3) Per-Tab Saat: Tab 1 = 14,4 (SOLL), Tab 2 = 9,0 (SOLL)
    const tab1Saat = tab1.entries.reduce((s, e) => s + (e.einheit || 0), 0);
    const tab2Saat = tab2.entries.reduce((s, e) => s + (e.einheit || 0), 0);
    expect(tab1Saat).toBeCloseTo(14.4, 2);
    expect(tab2Saat).toBeCloseTo(9.0, 2);

    // 4) Per-Tab Dünger: Tab 1 bekommt Fill #1 (1500) + Fill #2 (1000) = 2500
    //    Tab 2 bekommt 0 Dünger (Tab 1 hat Prio 1 und vollen Dünger-Bedarf)
    //    WICHTIG: kein Math.min-Cap (Issue #315), kein tabDCap (Issue #326)
    const tab1Duenger = tab1.entries.reduce((s, e) => s + (e.duenger || 0), 0);
    const tab2Duenger = tab2.entries.reduce((s, e) => s + (e.duenger || 0), 0);
    expect(tab1Duenger).toBeCloseTo(2500, 0);
    expect(tab2Duenger).toBeCloseTo(0, 0);
  });

  it('Dünger-verbleibend is exactly the difference SOLL - used (no off-by-100s)', () => {
    const { window: w } = createDom();
    setup8_5ha(w);

    fill(w, 18, 1500);
    fill(w, 12, 1000);

    // 2.600 kg SOLL - 2.500 kg used = 100 kg verbleibend
    // Der User-Screenshot zeigte "500 kg" — das war ein Effekt der verlorenen 400 kg.
    const totalUsed = w.state.reiter[0].entries
      .concat(w.state.reiter[1].entries)
      .reduce((s, e) => s + (e.duenger || 0), 0);
    expect(2600 - totalUsed).toBeCloseTo(100, 0);
  });
});
