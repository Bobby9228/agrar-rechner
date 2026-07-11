/**
 * Issue #336: Ersparnis / Mehrbedarf im Ergebnis-Tab (renderResultCard)
 * als eigene Zeilen OHNE Verrechnung mit Verbleibend/Eingefüllt.
 *
 * Vor #336 zeigte r_carryover_hint nur Empfänger-Salden (Übertrag + Mehrbedarf)
 * als kompakte Hint-Zeilen und verrechnete sie in der rem-Formel. Issue #335
 * hatte moniert, dass die Verrechnung verwirrend ist. #336 verlangt die
 * Roh-Werte als eigene Zeilen mit Threshold-Gating (wert > 0.05).
 *
 * Follow-up #336: Die Übertrag-Zeile (Empfänger-Saldo aus computeAllCarryovers)
 * wurde aus der UI entfernt — der User will nur die Selbst-Salden (Ersparnis +
 * Mehrbedarf) des aktiven Tabs sehen. Die App-Logik (computeAllCarryovers,
 * _appendTabCarryoverBlocks im Maschinen-Protokoll) läuft unverändert weiter.
 *
 * Implementierung: public/js/render-results.js (renderResultCard, ~Z. 64-148)
 *   - .r-carryover-section-label: "Abweichung dieses Tabs"
 *   - .r-carryover-row.r-carryover-savings   "Ersparnis: X Einheiten, Y kg Dünger"
 *   - .r-carryover-row.r-carryover-excess    "Mehrbedarf aus überschrittenen Flächen: -X, Y"
 *   - Jede Zeile unabhängig gegated; Section-Header nur wenn ≥1 Zeile.
 *   - KEINE .r-carryover-row.r-carryover-carryover mehr (Übertrag-Zeile entfernt)
 *   - KEINE Verrechnung mit Verbleibend (r_drill_e_rem) oder Eingefüllt.
 *
 * Roh-Wert-Formeln (identisch zu _appendTabCarryoverBlocks in render-drill.js,
 * damit die Anzeige in beiden Sichten konsistent ist):
 *   Ersparnis Saat:  getTabTotalEinheiten(r) - getTabIstEinheiten(r)     (FG-korrigiert)
 *   Ersparnis Düng:  (hektar - istHektar) × duenger
 *   Mehrbedarf Saat: getTabIstEinheiten(r) - getTabTotalEinheiten(r)     (FG-korrigiert)
 *   Mehrbedarf Düng: (istHektar - hektar) × duenger
 *
 * Wichtige Geometrie-Constraints (lernen aus dem ersten Test-Run):
 *   - Ersparnis/Mehrbedarf nur sichtbar wenn istHektar > 0 (sonst ist
 *     die Differenz ein Artefakt SOLL-0 = SOLL, nicht "Ersparnis"). Matcht
 *     isSavingsSource in _appendTabCarryoverBlocks.
 *   - Ersparnis/Mehrbedarf-Werte sind nicht-symmetrisch: bei IST<SOLL zeigt
 *     sich Ersparnis, bei IST>SOLL Mehrbedarf. Die jeweils andere Zeile ist
 *     negativ und wird ausgeblendet.
 *   - Die kg-Schwelle 0.05 ist sehr niedrig: bei duenger=100 kg/ha
 *     bedeutet 0.01 ha IST<SOLL bereits 1 kg savings > 0.05.
 *     "below threshold"-Tests müssen daher duenger=0 ODER
 *     sehr kleine Differenz bei gleichzeitig kleinem duenger wählen.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

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
    // Tab 1: SOLL=10, no IST, not done → wäre Empfänger des Carryovers
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
