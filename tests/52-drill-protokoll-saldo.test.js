/**
 * Issue #336 follow-up #5b: Cross-Tab-Saldo ist im Drill-Log und
 * Maschinen-Protokoll, NICHT im Ergebnis-Tab. User-Feedback 2026-06-23,
 * 5. Runde:
 *
 *   „Es soll in den Ergebnissen Bereich unter dünger verbleibend im
 *    Protokoll/drill log"
 *
 * Konkretes Layout nach dem Fix:
 *   Ergebnis-Tab (gelb): Per-Tab-Shape zurück (PR #337/#339):
 *     Label: "Abweichung dieses Tabs"
 *     Zeile: "Ersparnis: ..." (per aktiver Tab)
 *     KEIN .net-totals-* im Ergebnis-Tab.
 *
 *   Drill-Log (`#drill_entries`): Cross-Tab-Saldo als erster Block,
 *     VOR den Per-Tab-Headern. Label: "Gesamt-Saldo (alle Tabs)".
 *     Zeile: "Ersparnis: X Einheiten Saatgut, Y kg Dünger" (oder
 *     "Mehrbedarf aus überschrittenen Flächen: -X, -Y").
 *     Darunter die Per-Tab-Header + drill-savings/drill-carryover/
 *     drill-excess Blöcke wie bisher.
 *
 *   Maschinen-Protokoll (`#drill_machine_log`): Cross-Tab-Saldo als
 *     erster Block nach dem "Maschinen-Protokoll"-Header, VOR den
 *     Per-Tab-Sub-Headern.
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
 * Worked Example: Tab1 sav=2/200, Tab2 exc=1/100, Tab3 neutral
 *   → netE=1, netD=100 → "Ersparnis: 1,0 Einheiten Saatgut, 100 kg Dünger"
 *
 * NICHT-Empfänger-Saldo (computeAllCarryovers) im Drill-Log/Protokoll —
 * bleibt weg, User-Decision 2026-06-23.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Issue #336 follow-up #5b: Cross-Tab-Saldo im Drill-Log + Maschinen-Protokoll, NICHT im Ergebnis-Tab', () => {
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
  function netSavingsIn(container) { return container ? container.querySelector('.net-totals-savings') : null; }
  function netExcessIn(container) { return container ? container.querySelector('.net-totals-excess') : null; }
  function netHeaderIn(container) { return container ? container.querySelector('.drill-net-totals-header') : null; }
  // Per-Tab-Shape (PR #337/#339) ist zurück im Ergebnis-Tab.
  function perTabSavings() { return ergebnisHint() ? ergebnisHint().querySelector('.r-carryover-savings') : null; }
  function perTabExcess() { return ergebnisHint() ? ergebnisHint().querySelector('.r-carryover-excess') : null; }
  function perTabLabel() { return ergebnisHint() ? ergebnisHint().querySelector('.r-carryover-section-label') : null; }

  // ── Ergebnis-Tab: Per-Tab-Shape zurück, KEIN .net-totals-* ──────────

  it('Ergebnis-Tab: KEIN .net-totals-* (Saldo lebt in Drill-Log/Protokoll)', () => {
    w.state.koernerProEinheit = 90000;
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 9, koerner: 90000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    expect(ergebnisHint().querySelectorAll('.net-totals-savings').length).toBe(0);
    expect(ergebnisHint().querySelectorAll('.net-totals-excess').length).toBe(0);
  });

  it('Ergebnis-Tab: Per-Tab-Shape (PR #337/#339) ist zurück — Label "Abweichung dieses Tabs"', () => {
    w.state.koernerProEinheit = 90000;
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 9, koerner: 90000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    const s = perTabSavings();
    expect(s).not.toBeNull();
    expect(s.textContent).toContain('Ersparnis');
    expect(s.textContent).toContain('1,0');
    expect(s.textContent).toContain('100');
    const l = perTabLabel();
    expect(l).not.toBeNull();
    expect(l.textContent).toBe('Abweichung dieses Tabs');
  });

  // ── Drill-Log: Cross-Tab-Saldo als erster Block ──────────────────────

  it('Drill-Log: Worked Example (Tab sav=2/200 + exc=1/100 + neutral) → "Ersparnis: 1,0/100"', () => {
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
    w.renderDrillLog();
    const s = netSavingsIn(drillLog());
    expect(s).not.toBeNull();
    expect(s.textContent).toBe('Ersparnis: 1,0 Einheiten Saatgut, 100 kg Dünger');
    const l = netHeaderIn(drillLog());
    expect(l).not.toBeNull();
    expect(l.textContent).toBe('Gesamt-Saldo (alle Tabs)');
  });

  it('Drill-Log: Net-Totals-Block VOR Per-Tab-Headern', () => {
    w.state.koernerProEinheit = 90000;
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 9, koerner: 90000, duenger: 100, entries: []
    };
    w.renderDrillLog();
    const children = Array.from(drillLog().children);
    const idxNet = children.findIndex(c => c.classList.contains('net-totals-savings'));
    const idxTabHeader = children.findIndex(c =>
      c.classList.contains('drill-entry-tab-header') && !c.classList.contains('drill-net-totals-header')
    );
    expect(idxNet).toBeGreaterThanOrEqual(0);
    if (idxTabHeader >= 0) expect(idxTabHeader).toBeGreaterThan(idxNet);
  });

  it('Drill-Log: alle Tabs neutral → komplett versteckt (KEIN Header)', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 10, koerner: 50000, duenger: 100, entries: []
    };
    w.renderDrillLog();
    expect(netSavingsIn(drillLog())).toBeNull();
    expect(netHeaderIn(drillLog())).toBeNull();
  });

  // ── Maschinen-Protokoll: Cross-Tab-Saldo als erster Block ────────────

  it('Maschinen-Protokoll: Worked Example → "Ersparnis: 1,0/100"', () => {
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
    w.renderMachineLog();
    const proto = maschinenProtokoll();
    const s = netSavingsIn(proto);
    expect(s).not.toBeNull();
    expect(s.textContent).toBe('Ersparnis: 1,0 Einheiten Saatgut, 100 kg Dünger');
  });

  it('Maschinen-Protokoll: Net-Totals-Block VOR Per-Tab-Sub-Headern', () => {
    w.state.koernerProEinheit = 90000;
    w.state.activeReiter = 0;
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 9, koerner: 90000, duenger: 100, entries: []
    };
    w.state.reiter[1] = {
      ...w.state.reiter[1],
      hektar: 5,  istHektar: 5, koerner: 90000, duenger: 100, entries: []
    };
    w.renderMachineLog();
    const children = Array.from(maschinenProtokoll().children);
    const idxNet = children.findIndex(c => c.classList.contains('net-totals-savings'));
    const idxSub = children.findIndex(c => c.classList.contains('drill-machine-log-tab-subheader'));
    expect(idxNet).toBeGreaterThanOrEqual(0);
    expect(idxSub).toBeGreaterThan(idxNet);
  });

  it('Maschinen-Protokoll: Reihenfolge Maschinen-Header → Net-Totals → Sub-Header', () => {
    w.state.koernerProEinheit = 90000;
    w.state.activeReiter = 0;
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 9, koerner: 90000, duenger: 100, entries: []
    };
    w.renderMachineLog();
    const children = Array.from(maschinenProtokoll().children);
    // [0] = Maschinen-Protokoll-Header, [1] = Gesamt-Saldo-Header, [2] = Ersparnis-Zeile, [3+] = Sub-Header
    expect(children[0].textContent).toBe('Maschinen-Protokoll');
    expect(children[1].textContent).toBe('Gesamt-Saldo (alle Tabs)');
  });

  // ── Multi-Tab-Aggregation unabhängig von activeReiter ────────────────

  it('Cross-Tab läuft über ALLE reiter — auch wenn activeReiter neutral', () => {
    w.state.koernerProEinheit = 90000;
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 8, koerner: 90000, duenger: 100, entries: []
    };
    w.state.reiter[1] = {
      ...w.state.reiter[1],
      hektar: 5,  istHektar: 5, koerner: 90000, duenger: 100, entries: []
    };
    w.state.activeReiter = 1;
    w.renderDrillLog();
    const s = netSavingsIn(drillLog());
    expect(s).not.toBeNull();
    expect(s.textContent).toContain('2,0');
    expect(s.textContent).toContain('200');
  });

  // ── Pure Mehrbedarf: rote Zeile ───────────────────────────────────────

  it('Pure Mehrbedarf: rote "Mehrbedarf"-Zeile mit positiven Beträgen', () => {
    w.state.koernerProEinheit = 50000;
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 5,  istHektar: 6, koerner: 50000, duenger: 100, entries: []
    };
    w.state.reiter[1] = {
      ...w.state.reiter[1],
      hektar: 10, istHektar: 10, koerner: 50000, duenger: 100, entries: []
    };
    w.renderDrillLog();
    const e = netExcessIn(drillLog());
    expect(e).not.toBeNull();
    expect(e.textContent).toContain('Mehrbedarf');
    expect(e.textContent).toContain('1,0');
    expect(e.textContent).toContain('100');
    expect(e.classList.contains('net-totals-excess')).toBe(true);
  });

  // ── Per-Tab drill-savings bleibt im Maschinen-Protokoll ──────────────

  it('Maschinen-Protokoll: Per-Tab drill-savings bleibt (nur Net-Totals wurde ergänzt)', () => {
    w.state.koernerProEinheit = 90000;
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 8, koerner: 50000, duenger: 100, entries: []
    };
    w.renderMachineLog();
    const proto = maschinenProtokoll();
    expect(proto.querySelectorAll('.drill-savings').length).toBeGreaterThan(0);
    expect(proto.querySelector('.drill-net-totals-header')).not.toBeNull();
  });

  // ── Re-Render Hygiene ─────────────────────────────────────────────────

  it('Re-Render: keine stale Saldo-Zeile aus vorherigem Render', () => {
    w.state.koernerProEinheit = 90000;
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 9, koerner: 50000, duenger: 100, entries: []
    };
    w.renderDrillLog();
    expect(netSavingsIn(drillLog())).not.toBeNull();
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 10, koerner: 50000, duenger: 100, entries: []
    };
    w.renderDrillLog();
    expect(netSavingsIn(drillLog())).toBeNull();
    expect(netHeaderIn(drillLog())).toBeNull();
  });
});
