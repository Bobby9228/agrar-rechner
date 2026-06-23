/**
 * Issue #336 follow-up #3: Cross-Tab-Netto-Aggregation landet im
 * MASCHINEN-PROTOKOLL, nicht im Ergebnis-Tab.
 *
 * Vorher (PR #340): die aggregierte Netto-Zeile wurde in der
 * Ergebnis-Karte angezeigt. User-Feedback 2026-06-23: „Im Ergebnis
 * Feld von den tabs, mach das wieder rückgängig so wie es vorher war.
 * Ich wollte die Änderung im Ergebnis Feld vom Protokoll."
 *
 * Erwartung jetzt:
 *   1. Ergebnis-Tab (`#r_carryover_hint`): KEIN `.net-totals-*`. Die
 *      Per-Tab-Eigen-Salden aus PR #337/#339 (`.r-carryover-row`) sind
 *      zurück — wie nach PR #339.
 *   2. Maschinen-Protokoll (`#drill_machine_log`): Cross-Tab-Netto-
 *      Block als erster Eintrag, VOR den Per-Tab-Sub-Headern. Label:
 *      „Gesamt-Saldo (alle Tabs)". Klasse: `.net-totals-savings` /
 *      `.net-totals-excess` (Farben grün/rot).
 *   3. Drill-Log (`#drill_entries`): Cross-Tab-Netto-Block ebenfalls
 *      als erster Eintrag, vor den Per-Tab-Headern. (Beide Render-
 *      Sites nutzen denselben `_appendNetTotalsBlock`-Helper, das ist
 *      der „single source of truth"-Ansatz aus PR #309/Pattern 3.)
 *
 * Formeln (identisch zu _appendTabCarryoverBlocks in render-drill.js):
 *   selfSavingsE  = getTabTotalEinheiten(t) - getTabIstEinheiten(t)
 *   selfSavingsD  = (t.hektar - t.istHektar) * (t.duenger || 0)
 *   selfExcessE   = getTabIstEinheiten(t) - getTabTotalEinheiten(t)
 *   selfExcessD   = (t.istHektar - t.hektar) * (t.duenger || 0)
 *   selfSavings nur sinnvoll wenn t.istHektar > 0 && t.istHektar < t.hektar
 *   selfExcess   nur sinnvoll wenn t.istHektar > t.hektar
 *   netE = Σ savE − Σ excE, netD = Σ savD − Σ excD
 *   net > 0  → grüne Zeile „Ersparnis: X Einheiten Saatgut, Y kg Dünger"
 *   net < 0  → rote Zeile „Mehrbedarf aus überschrittenen Flächen: -X, -Y"
 *   beide innerhalb ±0.05 → Block komplett versteckt
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Issue #336 follow-up #3: Cross-Tab-Netto im Maschinen-Protokoll, NICHT im Ergebnis-Tab', () => {
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
  // Per-Tab-Shape (PR #337/#339, jetzt zurück im Ergebnis-Tab).
  function perTabSavings() { return ergebnisHint() ? ergebnisHint().querySelector('.r-carryover-savings') : null; }
  function perTabExcess() { return ergebnisHint() ? ergebnisHint().querySelector('.r-carryover-excess') : null; }

  // ── Ergebnis-Tab: KEIN net-totals, JEDOCH Per-Tab-Shape zurück ────────

  it('Ergebnis-Tab: KEIN .net-totals-* (das lebt jetzt nur im Protokoll)', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 9, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    expect(ergebnisHint().querySelectorAll('.net-totals-savings').length).toBe(0);
    expect(ergebnisHint().querySelectorAll('.net-totals-excess').length).toBe(0);
  });

  it('Ergebnis-Tab: Per-Tab-Shape (PR #337/#339) ist zurück — „Abweichung dieses Tabs"', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 9, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    const s = perTabSavings();
    expect(s).not.toBeNull();
    expect(s.textContent).toContain('Ersparnis');
    expect(s.textContent).toContain('1,0');
    expect(s.textContent).toContain('100');
    expect(s.textContent).toContain('kg Dünger');
  });

  // ── Maschinen-Protokoll: Cross-Tab-Netto ist da, VOR Per-Tab-Headern ───

  it('Maschinen-Protokoll: Worked Example (Tab SOLL=10/IST=9 + neutral) → grüne Zeile', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 9, koerner: 50000, duenger: 100, entries: []
    };
    w.state.reiter[1] = {
      ...w.state.reiter[1],
      hektar: 5, istHektar: 5, koerner: 50000, duenger: 100, entries: []
    };
    w.renderMachineLog();
    const proto = maschinenProtokoll();
    const s = netSavingsIn(proto);
    expect(s).not.toBeNull();
    expect(s.textContent).toContain('Ersparnis');
    expect(s.textContent).toContain('1,0');
    expect(s.textContent).toContain('100');
    expect(s.textContent).toContain('kg Dünger');
    // Label „Gesamt-Saldo (alle Tabs)" muss da sein
    const label = netHeaderIn(proto);
    expect(label).not.toBeNull();
    expect(label.textContent).toContain('Gesamt-Saldo');
  });

  it('Maschinen-Protokoll: Mixed (Savings + Excess) → rote Mehrbedarf-Zeile', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 9.5, koerner: 50000, duenger: 100, entries: []
    };
    w.state.reiter[1] = {
      ...w.state.reiter[1],
      hektar: 5, istHektar: 6, koerner: 50000, duenger: 100, entries: []
    };
    w.renderMachineLog();
    // Σ savE = 0.5, Σ excE = 1.0 → netE = -0.5
    // Σ savD = 50, Σ excD = 100 → netD = -50
    const e = netExcessIn(maschinenProtokoll());
    expect(e).not.toBeNull();
    expect(e.textContent).toContain('Mehrbedarf');
    expect(e.textContent).toContain('0,5');
    expect(e.textContent).toContain('50');
  });

  it('Maschinen-Protokoll: Reihenfolge — Net-Totals-Block VOR Per-Tab-Sub-Headern', () => {
    // activeReiter = 0 (Savings source), zweiter Tab ist neutral. Damit
    // rendert renderMachineLog auch einen Per-Tab-Sub-Header (Issue #309).
    w.state.activeReiter = 0;
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 9, koerner: 50000, duenger: 100, entries: []
    };
    w.state.reiter[1] = {
      ...w.state.reiter[1],
      hektar: 5, istHektar: 5, koerner: 50000, duenger: 100, entries: []
    };
    w.renderMachineLog();
    const proto = maschinenProtokoll();
    const children = Array.from(proto.children);
    const idxNet = children.findIndex(c => c.classList.contains('net-totals-savings'));
    // Suche den Per-Tab-Sub-Header (hat Klasse drill-machine-log-tab-subheader),
    // NICHT den Haupt-Header „Maschinen-Protokoll".
    const idxSubHeader = children.findIndex(c => c.classList.contains('drill-machine-log-tab-subheader'));
    expect(idxNet).toBeGreaterThanOrEqual(0);
    expect(idxSubHeader).toBeGreaterThan(idxNet);
  });

  it('Maschinen-Protokoll: kein Net-Totals wenn alle Tabs neutral (Σ=0)', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 10, koerner: 50000, duenger: 100, entries: []
    };
    w.renderMachineLog();
    expect(netSavingsIn(maschinenProtokoll())).toBeNull();
    expect(netExcessIn(maschinenProtokoll())).toBeNull();
    expect(netHeaderIn(maschinenProtokoll())).toBeNull();
  });

  // ── Drill-Log: gleiche Logik über _appendNetTotalsBlock ───────────────

  it('Drill-Log: Net-Totals-Block erscheint auch hier (gleicher Helper)', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 9, koerner: 50000, duenger: 100, entries: []
    };
    w.renderDrillLog();
    const log = drillLog();
    const s = netSavingsIn(log);
    expect(s).not.toBeNull();
    expect(s.textContent).toContain('Ersparnis');
    expect(s.textContent).toContain('1,0');
    expect(s.textContent).toContain('100');
  });

  it('Drill-Log: Net-Totals-Block VOR Per-Tab-Headern', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 9, koerner: 50000, duenger: 100, entries: []
    };
    w.renderDrillLog();
    const log = drillLog();
    const children = Array.from(log.children);
    const idxNet = children.findIndex(c => c.classList.contains('net-totals-savings'));
    const idxTabHeader = children.findIndex(c =>
      c.classList.contains('drill-entry-tab-header') && !c.classList.contains('drill-net-totals-header')
    );
    expect(idxNet).toBeGreaterThanOrEqual(0);
    if (idxTabHeader >= 0) {
      expect(idxTabHeader).toBeGreaterThan(idxNet);
    }
  });

  // ── Multi-Tab-Aggregation (egal welcher Tab aktiv) ─────────────────────

  it('Aggregation läuft über ALLE reiter — auch wenn activeReiter der neutrale ist', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 8, koerner: 50000, duenger: 100, entries: []
    };
    w.state.reiter[1] = {
      ...w.state.reiter[1],
      hektar: 5, istHektar: 5, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 1;  // neutral
    w.renderMachineLog();
    const s = netSavingsIn(maschinenProtokoll());
    expect(s).not.toBeNull();
    expect(s.textContent).toContain('2,0');
    expect(s.textContent).toContain('200');
  });

  // ── Re-Render Hygiene ─────────────────────────────────────────────────

  it('Re-Render: keine stale Net-Totals aus vorherigem Render', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 9, koerner: 50000, duenger: 100, entries: []
    };
    w.renderMachineLog();
    expect(netSavingsIn(maschinenProtokoll())).not.toBeNull();
    // Switch zu neutralem Tab → Net-Totals muss weg sein
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 10, koerner: 50000, duenger: 100, entries: []
    };
    w.renderMachineLog();
    expect(netSavingsIn(maschinenProtokoll())).toBeNull();
    expect(netHeaderIn(maschinenProtokoll())).toBeNull();
  });
});
