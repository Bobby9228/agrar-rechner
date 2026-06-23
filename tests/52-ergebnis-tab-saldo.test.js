/**
 * Issue #336 follow-up #5: Cross-Tab-Saldo ist im Ergebnis-Tab (NICHT im
 * Maschinen-Protokoll). User-Feedback 2026-06-23 (4. Runde):
 *
 *   „Unter, Dünger verbleibend 2500kg Steht, Ersparnis 2,0 Einheiten
 *    200kg Dünger. Die Ersparnis soll durch den Saldo aus getauscht
 *    werden und der Saldo soll aus dem Maschinen Protokoll entfernt
 *    werden."
 *
 * Konkretes Layout nach dem Fix:
 *   Ergebnis-Tab (gelb, unter "Dünger verbleibend"):
 *     Label: "Saldo (alle Tabs)"
 *     Zeile: "Ersparnis: X Einheiten Saatgut, Y kg Dünger"
 *            oder "Mehrbedarf aus überschrittenen Flächen: -X, -Y"
 *     Aggregiert über ALLE reiter (kein Per-Tab-Shape mehr).
 *
 *   Maschinen-Protokoll: nur noch Per-Tab-Sub-Header +
 *     drill-savings/drill-carryover/drill-excess Blöcke.
 *     KEIN "Gesamt-Saldo (alle Tabs)"-Block mehr oben.
 *
 *   Drill-Log: dito, nur Per-Tab-Header + Carryover-Blöcke.
 *     KEIN Net-Totals-Block mehr.
 *
 * Berechnung (Pattern 3 Single Source of Truth mit _computeTabSelfSaldo
 * aus render-drill.js):
 *   Für jeden reiter:
 *     savingsE = max(0, getTabTotalEinheiten - getTabIstEinheiten)
 *     savingsD = max(0, (hektar - istHektar) * duenger)
 *     excessE  = max(0, getTabIstEinheiten - getTabTotalEinheiten)
 *     excessD  = max(0, (istHektar - hektar) * duenger)
 *   totalSavE = Σ savingsE, totalExcE = Σ excessE
 *   netE = totalSavE - totalExcE (analog für netD)
 *   netE > 0  → grüne "Ersparnis"-Zeile
 *   netE < 0  → rote "Mehrbedarf"-Zeile
 *   |net| ≤ 0.05 → Zeile versteckt
 *
 * Worked Example (User-Szenario aus dem Screenshot-Text):
 *   Tab1 sav=2/200, Tab2 exc=1/100, Tab3 neutral
 *   → netE=2-1=1, netD=200-100=100
 *   → "Ersparnis: 1,0 Einheiten Saatgut, 100 kg Dünger"
 *
 * NICHT-Empfänger-Saldo (computeAllCarryovers) im Ergebnis-Tab — bleibt
 * weg, User-Decision 2026-06-23.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Issue #336 follow-up #5: Cross-Tab-Saldo im Ergebnis-Tab, NICHT im Maschinen-Protokoll', () => {
  let w, doc;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
  });

  // ── Helpers ────────────────────────────────────────────────────────────

  function ergebnisHint() { return doc.getElementById('r_carryover_hint'); }
  function drillLog() { return doc.getElementById('drill_entries'); }
  function maschinenProtokoll() { return doc.getElementById('drill_machine_log'); }
  function saldoSavings() { return ergebnisHint() ? ergebnisHint().querySelector('.net-totals-savings') : null; }
  function saldoExcess() { return ergebnisHint() ? ergebnisHint().querySelector('.net-totals-excess') : null; }
  function saldoLabel() { return ergebnisHint() ? ergebnisHint().querySelector('.r-carryover-section-label') : null; }
  function perTabSavings() { return ergebnisHint() ? ergebnisHint().querySelector('.r-carryover-savings') : null; }
  function perTabExcess() { return ergebnisHint() ? ergebnisHint().querySelector('.r-carryover-excess') : null; }

  // ── Ergebnis-Tab: Cross-Tab-Saldo (NICHT Per-Tab) ────────────────────

  it('Ergebnis-Tab: Label ist "Saldo (alle Tabs)" (NICHT "Abweichung dieses Tabs")', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 9, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    const l = saldoLabel();
    expect(l).not.toBeNull();
    expect(l.textContent).toBe('Saldo (alle Tabs)');
  });

  it('Ergebnis-Tab: KEIN Per-Tab-Shape (PR #337/#339) mehr', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 9, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    expect(perTabSavings()).toBeNull();
    expect(perTabExcess()).toBeNull();
  });

  it('Ergebnis-Tab: Worked Example (Tab sav=2/200 + Tab exc=1/100 + neutral) → "Ersparnis: 1,0 Einheiten Saatgut, 100 kg Dünger"', () => {
    w.state.koernerProEinheit = 90000;
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 8, koerner: 90000, duenger: 100, entries: []
    };
    w.state.reiter[1] = {
      ...w.state.reiter[1],
      hektar: 5,  istHektar: 6, koerner: 90000, duenger: 100, entries: []
    };
    w.state.reiter[2] = {
      ...w.state.reiter[2],
      hektar: 7,  istHektar: 7, koerner: 90000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    const s = saldoSavings();
    expect(s).not.toBeNull();
    expect(s.textContent).toBe('Ersparnis: 1,0 Einheiten Saatgut, 100 kg Dünger');
    expect(s.classList.contains('net-totals-savings')).toBe(true);
    expect(saldoExcess()).toBeNull();
  });

  it('Ergebnis-Tab: Pure Mehrbedarf → rote "Mehrbedarf"-Zeile', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 5,  istHektar: 6, koerner: 50000, duenger: 100, entries: []
    };
    w.state.reiter[1] = {
      ...w.state.reiter[1],
      hektar: 10, istHektar: 10, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    const e = saldoExcess();
    expect(e).not.toBeNull();
    expect(e.textContent).toContain('Mehrbedarf');
    expect(e.textContent).toContain('1,0');
    expect(e.textContent).toContain('100');
    expect(e.classList.contains('net-totals-excess')).toBe(true);
    expect(saldoSavings()).toBeNull();
  });

  it('Ergebnis-Tab: Cross-Tab (nicht nur aktiver Tab) — activeReiter irrelevant für Saldo', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 8, koerner: 50000, duenger: 100, entries: []
    };
    w.state.reiter[1] = {
      ...w.state.reiter[1],
      hektar: 5,  istHektar: 5, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 1;  // neutral
    w.renderResults();
    const s = saldoSavings();
    expect(s).not.toBeNull();
    expect(s.textContent).toContain('2,0');
    expect(s.textContent).toContain('200');
  });

  it('Ergebnis-Tab: alle Tabs neutral → komplett versteckt (KEIN Saldo-Label)', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 10, koerner: 50000, duenger: 100, entries: []
    };
    w.renderResults();
    expect(saldoSavings()).toBeNull();
    expect(saldoExcess()).toBeNull();
    expect(saldoLabel()).toBeNull();
  });

  // ── Maschinen-Protokoll: KEIN Net-Totals-Block mehr ─────────────────

  it('Maschinen-Protokoll: KEIN "Gesamt-Saldo (alle Tabs)"-Block', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 9, koerner: 50000, duenger: 100, entries: []
    };
    w.renderMachineLog();
    const proto = maschinenProtokoll();
    expect(proto.querySelector('.drill-net-totals-header')).toBeNull();
    expect(proto.querySelectorAll('.net-totals-savings').length).toBe(0);
    expect(proto.querySelectorAll('.net-totals-excess').length).toBe(0);
  });

  it('Maschinen-Protokoll: KEIN "Ersparnis: 1,0"-Text (das ist im Ergebnis-Tab)', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 9, koerner: 50000, duenger: 100, entries: []
    };
    w.renderMachineLog();
    const protoText = maschinenProtokoll().textContent;
    expect(protoText).not.toContain('Gesamt-Saldo (alle Tabs)');
    // Per-Tab drill-savings darf es noch geben (das ist OK, kommt aus _appendTabCarryoverBlocks)
  });

  // ── Drill-Log: KEIN Net-Totals-Block mehr ────────────────────────────

  it('Drill-Log: KEIN "Gesamt-Saldo (alle Tabs)"-Block', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 9, koerner: 50000, duenger: 100, entries: []
    };
    w.renderDrillLog();
    const log = drillLog();
    expect(log.querySelector('.drill-net-totals-header')).toBeNull();
    expect(log.querySelectorAll('.net-totals-savings').length).toBe(0);
    expect(log.querySelectorAll('.net-totals-excess').length).toBe(0);
  });

  // ── Per-Tab-Blocks im Maschinen-Protokoll bleiben ────────────────────

  it('Maschinen-Protokoll: Per-Tab drill-savings/drill-excess bleiben (nur Net-Totals ist raus)', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 8, koerner: 50000, duenger: 100, entries: []
    };
    w.renderMachineLog();
    const proto = maschinenProtokoll();
    expect(proto.querySelectorAll('.drill-savings').length).toBeGreaterThan(0);
  });

  // ── Re-Render Hygiene ─────────────────────────────────────────────────

  it('Re-Render: keine stale Saldo-Zeile aus vorherigem Render', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 9, koerner: 50000, duenger: 100, entries: []
    };
    w.renderResults();
    expect(saldoSavings()).not.toBeNull();
    // Switch zu neutralem Tab
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 10, koerner: 50000, duenger: 100, entries: []
    };
    w.renderResults();
    expect(saldoSavings()).toBeNull();
    expect(saldoLabel()).toBeNull();
  });
});
