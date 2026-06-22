/**
 * Test 44: End-to-End Reproduktion des User-Screenshots 2026-06-22
 *
 * Setup (genau wie im Screenshot):
 *   - Tab 1: 8 ha SOLL, 90000 Körner/ha, 200 kg/ha Dünger → SOLL Saat = 14,4 E, Dünger = 1600 kg
 *   - Tab 2: 5 ha SOLL, 90000 Körner/ha, 200 kg/ha Dünger → SOLL Saat = 9 E, Dünger = 1000 kg
 *   - SOLL gesamt: 23,4 Einheiten / 2.600 kg
 *
 * User-Aktionen:
 *   - Fill #1: 18 Einheiten / 1.500 kg Dünger
 *   - Fill #2: 12 Einheiten / 1.000 kg Dünger
 *
 * Erwartung nach Issue #329 (Saat/Dünger-Symmetrie):
 *   - Dünger folgt identischer Prio-Cap-Logik wie Saat:
 *     plan[p.idx].giveD = Math.min(remD, tabDRem);
 *     tabDRem = max(0, SOLL - used)
 *   - Fill #1: Tab 1 Saat-Rest 14,4 (nimmt 14,4), Dünger-Rest 1600 (nimmt 1500 → 100 Rest)
 *     Tab 2 Saat-Rest 5,4 (von 9, nimmt 3,6 → 5,4 Rest), Dünger-Rest 1000 (nimmt 0)
 *   - Fill #2: Tab 1 Saat-Rest 0 (nimmt 0), Dünger-Rest 100 (nimmt 100 → 0 Rest)
 *     Tab 2 Saat-Rest 5,4 (nimmt 5,4 → 0 Rest), Dünger-Rest 1000 (nimmt 900 → 100 Rest)
 *
 *   Resultat:
 *     - Tab 1: Entry#1 (14,4 E + 1500 kg), Entry#2 (0 E + 100 kg) → Σ 14,4 E + 1600 kg = SOLL
 *     - Tab 2: Entry#1 (3,6 E + 0 kg), Entry#2 (5,4 E + 900 kg) → Σ 9,0 E + 900 kg
 *     - Total eingegeben: 2500 kg, total in Tabs: 2500 kg (1600+900), Dünger verbleibend: 100 kg
 *
 * Anti-Regression gegen:
 *   - Issue #315: Math.min(duengerRaw, duengerPerUnit * units)-Cap (war in _buildDrillEntry)
 *   - Issue #326: tabDCap-Cap (war in _calcDrillDistribution)
 *   - Issue #329: aktuelle Symmetrie zwischen Saat- und Dünger-Pfad
 */
import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

function setup8_5ha(w) {
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

    fill(w, 18, 1500);   // Fill #1
    fill(w, 12, 1000);   // Fill #2

    const tab1 = w.state.reiter[0];
    const tab2 = w.state.reiter[1];

    // 1) Entry-Anzahl: 2 pro Tab
    expect(tab1.entries.length).toBe(2);
    expect(tab2.entries.length).toBe(2);

    // 2) Per-Tab Saat: Tab 1 = 14,4 (SOLL), Tab 2 = 9,0 (SOLL)
    const tab1Saat = tab1.entries.reduce((s, e) => s + (e.einheit || 0), 0);
    const tab2Saat = tab2.entries.reduce((s, e) => s + (e.einheit || 0), 0);
    expect(tab1Saat).toBeCloseTo(14.4, 2);
    expect(tab2Saat).toBeCloseTo(9.0, 2);

    // 3) Per-Tab Dünger — symmetrisch zu Saat-Logik (Issue #329):
    //    Tab 1: Fill #1 nimmt 1500 (cap 1600), Fill #2 nimmt 100 (Rest bis SOLL) → Σ 1600 = SOLL ✓
    //    Tab 2: Fill #1 nimmt 0 (Saat ging nur an Tab 2, kein Dünger übrig),
    //           Fill #2 nimmt 900 (Rest von 1000 kg minus 100 die Tab 1 nimmt) → Σ 900
    const tab1Duenger = tab1.entries.reduce((s, e) => s + (e.duenger || 0), 0);
    const tab2Duenger = tab2.entries.reduce((s, e) => s + (e.duenger || 0), 0);
    expect(tab1Duenger).toBeCloseTo(1600, 0);
    expect(tab2Duenger).toBeCloseTo(900, 0);

    // 4) Total eingegeben = Total in Tabs (kein Verlust)
    const totalDuenger = tab1Duenger + tab2Duenger;
    expect(totalDuenger).toBeCloseTo(2500, 0);  // 1500 + 1000
  });

  it('Dünger-verbleibend is exactly the difference SOLL - used (no off-by-100s)', () => {
    const { window: w } = createDom();
    setup8_5ha(w);

    fill(w, 18, 1500);
    fill(w, 12, 1000);

    // 2.600 kg SOLL - 2.500 kg used = 100 kg verbleibend
    // Vor Fix: 500 kg (siehe Screenshot) weil Dünger-Caps stillschweigend Mengen schluckten.
    const totalUsed = w.state.reiter[0].entries
      .concat(w.state.reiter[1].entries)
      .reduce((s, e) => s + (e.duenger || 0), 0);
    expect(2600 - totalUsed).toBeCloseTo(100, 0);
  });
});
