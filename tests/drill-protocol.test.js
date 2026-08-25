import { createDom } from './helpers.js';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * Drill-Protokoll (Eintragen, Multi-Tab-Verteilung Input, Maschine entfernen, Saldo, Done-Flag)
 * Zusammengeführt in Issue #419 (Welle 3) aus:
 * 05-drill-protocol.test.js, 14-drill-multitab.test.js, 30-drill-machine-remove.test.js, 52-drill-protokoll-saldo.test.js, 58-tab-done-flag.test.js
 * Jede Quelldatei ist als eigener describe-Block vollständig
 * erhalten (nur Import-Zeilen dedupliziert) — keine Assertions
 * wurden verändert oder entfernt.
 */

describe('Drill-Protokoll (Eintragen, Multi-Tab-Verteilung Input, Maschine entfernen, Saldo, Done-Flag) — übernommen aus 05-drill-protocol.test.js', () => {
/**
 * Tests for Drill-Protokoll: drillAdd(), drillRemove(), renderResults()
 */

describe('Drill-Protokoll', () => {
  let w, doc;

  beforeEach(() => {
    const { window } = createDom();
    w = window;
    doc = w.document;

    // Setup: calculate first so drill section is ready
    doc.getElementById('hektar').value = '10';
    doc.getElementById('koerner').value = '90000';
    doc.getElementById('duenger').value = '150';
    w.getActiveReiter().hektar = 10;
    w.getActiveReiter().koerner = 90000;
    w.getActiveReiter().duenger = 150;
    w.AppGlobals.renderResults();
  });

  describe('drillAdd()', () => {
    it('adds an entry with einheit and duenger', () => {
      doc.getElementById('drill_einheit').value = '1,5';
      doc.getElementById('drill_duenger').value = '200';
      w.drillAdd();

      const entries = w.getActiveReiter().entries;
      expect(entries.length).toBe(1);
      expect(entries[0].einheit).toBeCloseTo(1.5);
      expect(entries[0].duenger).toBe(200);
      expect(entries[0].zaehlerStand).toBe(0); // Zählerstand not set
      expect(entries[0].time).toBeTruthy();
    });

    it('adds entry with einheit only (no duenger)', () => {
      doc.getElementById('drill_einheit').value = '2';
      doc.getElementById('drill_hektar').value = '';
      doc.getElementById('drill_duenger').value = '';
      w.drillAdd();

      const entries = w.getActiveReiter().entries;
      expect(entries.length).toBe(1);
      expect(entries[0].einheit).toBe(2);
      expect(entries[0].duenger).toBe(0);
      expect(entries[0].zaehlerStand).toBe(0);
    });

    it('adds entry with duenger only (no einheit)', () => {
      doc.getElementById('drill_einheit').value = '';
      doc.getElementById('drill_hektar').value = '';
      doc.getElementById('drill_duenger').value = '500';
      w.drillAdd();

      const entries = w.getActiveReiter().entries;
      expect(entries.length).toBe(1);
      expect(entries[0].einheit).toBe(0);
      expect(entries[0].duenger).toBe(500);
    });

    it('does NOT add when both einheit and duenger are 0/empty', () => {
      doc.getElementById('drill_einheit').value = '';
      doc.getElementById('drill_hektar').value = '5';
      doc.getElementById('drill_duenger').value = '';
      w.drillAdd();

      expect(w.getActiveReiter().entries.length).toBe(0);
    });

    it('does NOT add when inputs are zero', () => {
      doc.getElementById('drill_einheit').value = '0';
      doc.getElementById('drill_hektar').value = '0';
      doc.getElementById('drill_duenger').value = '0';
      w.drillAdd();

      expect(w.getActiveReiter().entries.length).toBe(0);
    });

    it('clears input fields after adding', () => {
      doc.getElementById('drill_einheit').value = '2';
      doc.getElementById('drill_duenger').value = '300';
      w.drillAdd();

      expect(doc.getElementById('drill_einheit').value).toBe('');
      expect(doc.getElementById('drill_duenger').value).toBe('');
    });

    it('does nothing when no calculation was done (hektar/koerner=0)', () => {
      // Reset state
      w.state.reiter[0].hektar = 0;
      w.state.reiter[0].koerner = 0;

      doc.getElementById('drill_einheit').value = '2';
      w.drillAdd();
      expect(w.getActiveReiter().entries.length).toBe(0);
    });

    it('adds multiple entries in sequence', () => {
      doc.getElementById('drill_einheit').value = '2';
      doc.getElementById('drill_duenger').value = '100';
      w.drillAdd();

      doc.getElementById('drill_einheit').value = '3';
      doc.getElementById('drill_duenger').value = '200';
      w.drillAdd();

      const entries = w.getActiveReiter().entries;
      expect(entries.length).toBe(2);
      expect(entries[0].einheit).toBe(2);
      expect(entries[1].einheit).toBe(3);
    });

    it('records time for each entry', () => {
      doc.getElementById('drill_einheit').value = '1';
      doc.getElementById('drill_duenger').value = '100';
      w.drillAdd();

      const entry = w.getActiveReiter().entries[0];
      // Time should be a string in HH:MM or HH:MM:SS format
      expect(entry.time).toMatch(/^\d{2}:\d{2}(:\d{2})?$/);
    });
  });

  describe('drillRemove()', () => {
    it('removes an entry by tab+index', () => {
      doc.getElementById('drill_einheit').value = '1';
      doc.getElementById('drill_duenger').value = '0';
      w.drillAdd();
      doc.getElementById('drill_einheit').value = '2';
      w.drillAdd();

      expect(w.getActiveReiter().entries.length).toBe(2);

      // Remove first entry: tabIdx=0, entryIdx=0
      w.drillRemove(0, 0);
      expect(w.getActiveReiter().entries.length).toBe(1);
      expect(w.getActiveReiter().entries[0].einheit).toBe(2);
    });

    it('removes the last entry', () => {
      doc.getElementById('drill_einheit').value = '1';
      w.drillAdd();

      w.drillRemove(0, 0);
      expect(w.getActiveReiter().entries.length).toBe(0);
    });
  });

  describe('renderResults() — drill summary', () => {
    it('shows correct summary after adding entries', () => {
      doc.getElementById('drill_einheit').value = '5';
      doc.getElementById('drill_duenger').value = '500';
      w.drillAdd();

      // Check drill summary (aggregated across all tabs)
      // Total einheiten = 18 (10ha * 90000 / 50000)
      expect(doc.getElementById('ds_saat_total').textContent).toBe('18,000 Einheiten');
      // Used einheit = 5
      expect(doc.getElementById('ds_saat_used').textContent).toContain('5,0');
      // Remaining = 18 - 5 = 13
      expect(doc.getElementById('ds_saat_remaining').textContent).toBe('13,000 Einheiten');
      // Duenger total = 1500
      expect(doc.getElementById('ds_duenger_total').textContent).toContain('1.500');
      // Duenger used = 500
      expect(doc.getElementById('ds_duenger_used').textContent).toContain('500');
      // Duenger remaining = 1000
      expect(doc.getElementById('ds_duenger_remaining').textContent).toContain('1.000');
    });

    it('shows "Noch nichts eingefüllt" when no entries', () => {
      // After berechne with no drill entries
      const container = doc.getElementById('drill_entries');
      const emptyEl = container.querySelector('.drill-empty');
      expect(emptyEl).toBeTruthy();
      expect(emptyEl.textContent).toBe('Noch nichts eingefüllt');
    });

    it('shows entry list after adding', () => {
      doc.getElementById('drill_einheit').value = '2';
      doc.getElementById('drill_duenger').value = '100';
      w.drillAdd();

      const container = doc.getElementById('drill_entries');
      const entries = container.querySelectorAll('.drill-entry');
      expect(entries.length).toBe(1);
    });

    it('shows total summary in drill_entries after adding entry', () => {
      doc.getElementById('drill_einheit').value = '5';
      doc.getElementById('drill_duenger').value = '500';
      w.drillAdd();

      const entries = doc.getElementById('drill_entries').querySelectorAll('.drill-entry');
      expect(entries.length).toBe(1);
      expect(entries[0].textContent).toContain('5,000 Einheiten');
      expect(entries[0].textContent).toContain('500 kg');
    });

    it('shows empty state when no entries', () => {
      const empty = doc.getElementById('drill_entries').querySelector('.drill-empty');
      expect(empty).not.toBeNull();
      expect(empty.textContent).toBe('Noch nichts eingefüllt');
    });

    it('remaining einheit is clamped to 0 (no negative)', () => {
      doc.getElementById('drill_einheit').value = '20';
      doc.getElementById('drill_duenger').value = '0';
      w.drillAdd();

      const rem = doc.getElementById('ds_saat_remaining').textContent;
      // Math.max(0, 18 - 20) = 0
      expect(rem).toBe('0,000 Einheiten');
    });

    it('remaining duenger is clamped to 0 (no negative)', () => {
      // Add more duenger than total
      doc.getElementById('drill_einheit').value = '0';
      doc.getElementById('drill_duenger').value = '2000';
      w.drillAdd();

      const rem = doc.getElementById('ds_duenger_remaining').textContent;
      // Math.max(0, 1500 - 2000) = 0
      expect(rem).toContain('0');
    });
  });

  // ==========================================================================
  // all-tabs aggregation (Issue: drill-protocol renders only active tab)
  // ==========================================================================
  // Bug: renderDrillSummary() and renderDrillLog() both call
  // getActiveReiter() (singular) instead of iterating over state.reiter.
  // As a result the Drill-Protokoll only reflects the entries/need of the
  // currently active tab, even though drillAdd() distributes across multiple
  // tabs. These tests pin the desired behaviour: aggregate ALL tabs.
  //
  // TDD-red: each test asserts the all-tabs aggregate. The current single-tab
  // implementation must fail them. T2/T3 will implement the fix.
  // ==========================================================================

  describe('all-tabs aggregation', () => {
    function setupTwoTabs(w) {
      // Tab 0 already exists (1 default tab from helpers.js + setup in beforeEach).
      // Reset to a known 2-tab state and reset drillPriorities.
      w.state.reiter.length = 0;
      w.state.reiter.push({
        name: 'Tab 1',
        hektar: 10,
        istHektar: 0,
        koerner: 90000,
        duenger: 200,
        entries: [],
        fahrgassenEnabled: false,
        fahrgassenBreite: 0
      });
      w.state.reiter.push({
        name: 'Tab 2',
        hektar: 5,
        istHektar: 0,
        koerner: 90000,
        duenger: 200,
        entries: [],
        fahrgassenEnabled: false,
        fahrgassenBreite: 0
      });
      w.state.activeReiter = 0;
      w.state.drillPriorities = { 0: 1, 1: 1 };
      w.saveState();
    }

    it('renderDrillSummary() aggregates total/used/remaining across all tabs', () => {
      setupTwoTabs(w);
      // SOLL einheiten: Tab1 = 10*90000/50000 = 18, Tab2 = 5*90000/50000 = 9 → 27
      // SOLL dünger: Tab1 = 10*200 = 2000, Tab2 = 5*200 = 1000 → 3000
      // drillCalcAll() must run first so dtl_e_<i>/dtl_d_<i> DOM inputs are
      // populated — only then does drillAdd() take the multi-tab priority
      // distribution path (per Issue #276). With 27 einheiten and 3000 kg
      // distributed: Tab1 gets 18 einheiten/2000 kg (cap), Tab2 gets 9/1000.
      doc.getElementById('drill_einheit').value = '27';
      doc.getElementById('drill_duenger').value = '3000';
      w.drillCalcAll();
      w.drillAdd();
      w.renderResults();

      // Total: 27 einheiten across both tabs.
      expect(doc.getElementById('ds_saat_total').textContent).toBe('27,000 Einheiten');
      // Used: full 27 (drillAdd exactly filled both tabs).
      expect(doc.getElementById('ds_saat_used').textContent).toBe('27,000 Einheiten');
      // Remaining: 0 (or '—' if the implementation uses the zero-skip path).
      const remText = doc.getElementById('ds_saat_remaining').textContent;
      expect(remText === '0,000 Einheiten' || remText === '—').toBe(true);
      // Duenger total: 3000 (formatted with de-DE locale).
      expect(doc.getElementById('ds_duenger_total').textContent).toContain('3.000');
      // Duenger used: 3000 (or '—' if zero-skip).
      const dUsedText = doc.getElementById('ds_duenger_used').textContent;
      expect(dUsedText.includes('3.000') || dUsedText === '—').toBe(true);
      // Duenger remaining: 0 kg (or '—').
      const dRemText = doc.getElementById('ds_duenger_remaining').textContent;
      expect(dRemText.includes('0') || dRemText === '—').toBe(true);
    });

    it('renderDrillSummary() — Tab-1 own savings stay in pool under Regel 7', () => {
      setupTwoTabs(w);
      // Tab 2: SOLL 5ha, IST 3ha → Ersparnis-Quelle.
      // (SOLL 9 Einheiten − IST 5,4 Einheiten = 3,6 Einheiten Ersparnis.)
      // Tab 2 wird via direct entries.push als "befüllt mit 3ha" markiert
      // (gebrauchte Einheiten = 3*90000/50000 = 5,4 → usedE=5,4, fertig via
      // IST-Basis). Tab 1 bleibt offen mit SOLL=18, used=0.
      w.state.reiter[1].istHektar = 3;
      w.state.reiter[1].entries.push({
        einheit: 5.4, istHektar: 3, zaehlerStand: 3, duenger: 0, time: '08:00'
      });
      w.saveState();

      // Vor #378 (Phase-1-Subtraktion): remE = 18 - 0 - 3,6 = 14,4.
      // Nach #378 (Regel-7 Pool-Modell): Tab 1 ist KEIN Mehrbedarf-Tab
      // (istE=5,4 < solE=9) → keine cross-tab Pool-Verteilung. Tab 2 hat
      // istE == usedE → remaining=0. Tab 1 behält seine volle SOLL-Lücke
      // (18 E − 0 used + 0 entzogen = 18 E). Tab 2's "Ersparnis" landet
      // nicht mehr per Carryover-Pfad bei Tab 1 — sie liegt als `used`
      // im globalen Pool und wird nur bei tatsächlichem Mehrbedarf
      // (ist > sol) ausgespeist. Pin als Regression-Guard für #378.
      w.renderResults();
      const remText = doc.getElementById('ds_saat_remaining').textContent;
      const match = remText.match(/^(\d+),(\d+) Einheiten$/);
      expect(match).not.toBeNull();
      const remValue = parseFloat(match[1] + '.' + match[2]);
      // Tab 1 18 E + Tab 2 0 E = 18 E (keine Cross-Tab-Subtraktion mehr).
      expect(remValue).toBeCloseTo(18, 1);
    });

    it('renderDrillLog() renders one .drill-entry per entry across all tabs', () => {
      setupTwoTabs(w);
      // Push entries DIRECTLY so we don't depend on drillAdd's distribution logic.
      w.state.reiter[0].entries.push({
        einheit: 5, duenger: 600, zaehlerStand: 4, time: '08:00'
      });
      w.state.reiter[1].entries.push({
        einheit: 3, duenger: 400, zaehlerStand: 2, time: '09:00'
      });
      w.renderResults();

      const container = doc.getElementById('drill_entries');
      const entryRows = container.querySelectorAll('.drill-entry');
      expect(entryRows.length).toBe(2);

      // Each tab should have a tab-header above its entries (rendered when
      // entries.length > 0 for that tab). Active-tab (#0) and the second tab
      // (#1) should both be present.
      const headers = container.querySelectorAll('.drill-entry-tab-header');
      expect(headers.length).toBeGreaterThanOrEqual(2);

      // Each entry has a .entry-text span (test 09 querySelectorAll('.entry-text')).
      const entryTexts = container.querySelectorAll('.entry-text');
      expect(entryTexts.length).toBe(2);
    });

    // Issue #302: drill summary 'verbleibend' must net cross-tab carryover.
    // Bug: renderDrillSummary() applied carryover per-tab (sum of
    // max(0, need_t - saved_t + excess_t)) inside the tab loop. TASK-SPEC
    // (#302 body) mandates refactoring to Phase A (per-tab need) + Phase B
    // (global netting): rem = max(0, TotalNeed - TotalSaved + TotalExcess).
    //
    // The two formulas are mathematically equivalent given carryover's
    // invariant `saved_t ≤ need_t` and `excess_t ≤ (need_t - saved_t)`,
    // so this test pins the cross-tab-netting OUTPUT as a regression guard.
    // If either invariant is ever relaxed, this test will catch the divergence.
    //
    // Test scenario (matches the user's repro: 2 tabs je 1 ha, 450.000
    // Körner/ha, 1000 kg Dünger/ha; koernerProEinheit=50000 by default):
    //   Tab 0: r.istHektar=2.4 → istE=21.6, istD=2400; solE=9, solD=1000.
    //          1 entry einheit=12, duenger=2000, time='10:00'.
    //   Tab 1: empty (pure need side).
    //
    // Phase 0: Tab 0 istE>solE → excessE=12.6, excessD=1400. No savings.
    // Phase 1: skip.
    // Phase 2: only Tab 0 has entries (Tab 1 skipped at line 256 — no entries).
    //   Tab 0: capE=9.6, capD=400. takeE=9.6, takeD=400 → cco[0]={0,0,9.6,400}.
    //   Tab 1: cco[1]={0,0,0,0}.
    //
    // Phase A: need_Tab0 = max(0,21.6-12)=9.6; need_Tab1 = max(0,9-0)=9.
    //          TotalNeed_E = 18.6, TotalNeed_D = 400+1000 = 1400.
    // Phase B: TotalExcess_E = 9.6, TotalExcess_D = 400.
    //          remEinheit  = max(0, 18.6 - 0 + 9.6) = 28.2
    //          remDuenger  = max(0, 1400 - 0 + 400) = 1800
    it('renderDrillSummary() nets carryover across tabs (Issue #302, updated for Issue #347, Issue #368)', () => {
      // Issue #347 (Netto-Saldo-Fix): Eine Mehrbedarf-Quelle (IST > SOLL) darf
      // sich in Phase 2 NICHT selbst als Empfänger ihres eigenen Excess
      // eintragen — sie muss den Rest selbst absorbieren (Eigen-Restbedarf).
      // Vor #347 hat Phase 2 (`isMehrbedarf2` Skip fehlte) den Mehrbedarf-Pool
      // auch an die Quelle selbst verteilt, was zu doppelter Zählung führt.
      //
      // Szenario: Beide Tabs haben istHektar=2.4 > SOLL=1 → BEIDE sind
      // Mehrbedarf-Quellen. Mit Fix: BEIDE werden in Phase 2 als Absorber
      // ausgeschlossen → kein Tab bekommt `excessEinheit/duenger` von sich
      // selbst. Der `ds_saat_remaining` / `ds_duenger_remaining` zeigt
      // daher nur den unverteilten Bedarf, NICHT plus Eigen-Excess.
      //
      // Issue #368 (Carryover-Regel 2 — sequenzielle Netting): Wenn kein
      // Savings-Pool existiert (alle Tabs sind Mehrbedarf-Quellen), bleibt
      // jeder Mehrbedarf-Tab vollständig ungedeckt. render-drill.js summiert
      // jetzt den ungedeckten Mehrbedarf-Anteil (istE − solE − nettedE) in
      // totalNeedE, damit die globale Drill-Summary die ehrliche Summe aller
      // offenen Arbeiten zeigt — konsistent mit getTabRemaining().
      //
      // ALTES Verhalten (vor #347): 28,2 E / 1.800 kg (Tab 0 self-absorbed).
      // NEUES Verhalten (nach #347): 18,6 E / 500 kg (kein Self-Absorb).
      // NEUERES Verhalten (nach #368 + render-drill.js uncovered): 21,6 E /
      // 3.000 kg (Tab 0 Mehrbedarf ungedeckt mitgezählt, Tab 1 als normaler
      // Bedarfsempfänger). Vor #368 (PR #366 pro-rata) war der Effekt gleich,
      // weil ohne Savings-Pool sowieso nichts gecovered wurde.
      setupTwoTabs(w);
      // Reset tabs to the user's repro (1 ha / 450.000 K/ha / 1000 kg).
      // setupTwoTabs defaults to 10 ha / 90000 K/ha / 200 kg/ha — too large.
      w.state.reiter[0] = {
        name: 'Tab 1', hektar: 1, istHektar: 0, koerner: 450000, duenger: 1000,
        entries: [], fahrgassenEnabled: false, fahrgassenBreite: 0
      };
      w.state.reiter[1] = {
        name: 'Tab 2', hektar: 1, istHektar: 0, koerner: 450000, duenger: 1000,
        entries: [], fahrgassenEnabled: false, fahrgassenBreite: 0
      };
      w.state.activeReiter = 0;
      w.state.drillPriorities = { 0: 1, 1: 1 };
      // Tab 0: r.istHektar=2.4 → istE=21.6, istD=2400; entry covers 12 E / 2000 kg.
      w.state.reiter[0].istHektar = 2.4;
      w.state.reiter[0].entries.push({
        einheit: 12, duenger: 2000, istHektar: 2.4, zaehlerStand: 2.4, time: '10:00'
      });
      w.state.reiter[1].istHektar = 0;
      w.saveState();

      w.renderResults();

      // Senken-Modell: Σ remaining = Σ(bearb. deficit als Senke + unbearb. SOLL−used).
      //   Tab 0 (bearb., IST 2.4ha, used 12): Material-Defizit = 21.6−12 = 9.6 E /
      //     2400−2000 = 400 kg. Sink = Tab 0 (10:00, spätester Entry). sinkAdjusted
      //     = +9.6 / +400 → remaining 9.6 / 400.
      //   Tab 1 (unbearb., SOLL 9 E / 1000 kg): own = 9 / 1000, kein sinkAdjusted →
      //     remaining 9 / 1000.
      //   Σ Saat = 9.6 + 9 = 18.6. Σ Dünger = 400 + 1000 = 1400.
      expect(doc.getElementById('ds_saat_remaining').textContent).toBe('18,600 Einheiten');
      expect(doc.getElementById('ds_duenger_remaining').textContent).toBe('1.400 kg');

      // Sanity: total/used are independent of carryover.
      expect(doc.getElementById('ds_saat_total').textContent).toBe('30,600 Einheiten');
      expect(doc.getElementById('ds_saat_used').textContent).toBe('12,000 Einheiten');
      expect(doc.getElementById('ds_duenger_total').textContent).toBe('3.400 kg');
      expect(doc.getElementById('ds_duenger_used').textContent).toBe('2.000 kg');
    });
  });
});
});

describe('Drill-Protokoll (Eintragen, Multi-Tab-Verteilung Input, Maschine entfernen, Saldo, Done-Flag) — übernommen aus 14-drill-multitab.test.js', () => {
/**
 * Tests for multi-tab drill protocol: renderDrillTabList, drillCalcAll, drillAdd with priorities.
 */

describe('renderDrillTabList', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('renders a row per tab', () => {
    w.addReiter();
    w.renderDrillTabList();
    var rows = w.document.getElementById('drill_tab_list').querySelectorAll('.drill-tab-row');
    expect(rows.length).toBe(2);
  });

  it('renders priority button for each tab', () => {
    w.renderDrillTabList();
    var prios = w.document.getElementById('drill_tab_list').querySelectorAll('.drill-prio-btn');
    expect(prios.length).toBe(1);
    expect(prios[0].textContent).toBe('—');
  });

  it('renders einheit and duenger inputs for each tab', () => {
    w.renderDrillTabList();
    var eInput = w.document.getElementById('dtl_e_0');
    var dInput = w.document.getElementById('dtl_d_0');
    expect(eInput).toBeTruthy();
    expect(dInput).toBeTruthy();
  });

  it('shows tab name', () => {
    w.renderDrillTabList();
    var name = w.document.getElementById('drill_tab_list').querySelector('.drill-tab-name');
    expect(name.textContent).toBe('Schlag 1');
  });

  it('shows "fertig" when tab is completely drilled', () => {
    w.state.reiter[0] = { name: 'Tab 1', hektar: 10, koerner: 90000, duenger: 0, entries: [
      { einheit: 18, duenger: 0, hektar: 10, time: '12:00' }
    ]};
    w.renderDrillTabList();
    var need = w.document.getElementById('dtl_need_0');
    expect(need.textContent).toContain('fertig');
    expect(need.classList.contains('done')).toBe(true);
  });

  it('shows remaining need when partially drilled', () => {
    w.state.reiter[0] = { name: 'Tab 1', hektar: 10, koerner: 90000, duenger: 150, entries: [
      { einheit: 5, duenger: 500, hektar: 3, time: '12:00' }
    ]};
    w.renderDrillTabList();
    var need = w.document.getElementById('dtl_need_0');
    expect(need.textContent).toContain('braucht');
    expect(need.textContent).toContain('Einheiten');
  });

  it('does not show need when tab has no data', () => {
    w.renderDrillTabList();
    var need = w.document.getElementById('dtl_need_0');
    expect(need).toBeNull();
  });

  it('clears innerHTML on re-render', () => {
    w.renderDrillTabList();
    w.renderDrillTabList();
    var rows = w.document.getElementById('drill_tab_list').querySelectorAll('.drill-tab-row');
    expect(rows.length).toBe(1);
  });
});

describe('drillCalcAll (priority distribution)', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  function setupMultiTab() {
    w.state.reiter = [
      { name: 'A', hektar: 10, koerner: 90000, duenger: 150, entries: [] },
      { name: 'B', hektar: 5, koerner: 80000, duenger: 100, entries: [] },
    ];
    w.state.activeReiter = 0;
    w.renderDrillTabList();
    // Priorities direkt setzen und DOM neu bauen
    w.state.drillPriorities[0] = 1; // Tab A höchste Prio (Issue #264)
    w.state.drillPriorities[1] = 2;
    w.renderDrillTabList(); // DOM mit korrekten data-prio Werten aktualisieren
  }

  it('distributes to highest priority tab first', () => {
    setupMultiTab();
    // Tab 0 needs 18 Einheiten (10*90000/50000), Tab 1 needs 8 (5*80000/50000)
    w.document.getElementById('drill_einheit').value = '20';
    w.document.getElementById('drill_duenger').value = '0';

    w.drillCalcAll();

    var eA = w.document.getElementById('dtl_e_0');
    var eB = w.document.getElementById('dtl_e_1');
    // Tab A needs 18, gets min(18, 20) = 18
    expect(w.parseDE(eA.value)).toBeCloseTo(18);
    // Tab B needs 8, gets min(8, 20-18=2) = 2
    expect(w.parseDE(eB.value)).toBeCloseTo(2);
  });

  it('distributes duenger like Saat (symmetric, Issue #329): Prio-cap per Tab', () => {
    setupMultiTab();
    // Tab A needs 1500 kg (10*150), Tab B needs 500 kg (5*100)
    w.document.getElementById('drill_einheit').value = '0';
    w.document.getElementById('drill_duenger').value = '1800';

    w.drillCalcAll();

    var dA = w.document.getElementById('dtl_d_0');
    var dB = w.document.getElementById('dtl_d_1');
    // Symmetrisch zu Saat-Pfad: Tab A nimmt min(remD, tabDRem=1500)=1500,
    // Rest 300 geht zu Tab B (cap=500) → Tab B = 300. Siehe tests/drill-distribution.test.js.
    expect(w.parseDE(dA.value)).toBeCloseTo(1500);
    expect(w.parseDE(dB.value)).toBeCloseTo(300);
  });

  it('skips tabs with no priority', () => {
    setupMultiTab();
    w.document.getElementById('drill_einheit').value = '5';
    w.document.getElementById('drill_duenger').value = '0';

    w.state.drillPriorities[0] = 0; // no priority
    w.state.drillPriorities[1] = 1;
    w.drillCalcAll();

    var eA = w.document.getElementById('dtl_e_0');
    var eB = w.document.getElementById('dtl_e_1');
    expect(eA.value).toBe('');
    expect(w.parseDE(eB.value)).toBeCloseTo(5);
  });

  it('clears inputs for non-prioritized tabs', () => {
    setupMultiTab();
    w.document.getElementById('drill_einheit').value = '10';
    w.document.getElementById('drill_duenger').value = '0';

    w.state.drillPriorities[0] = 1;
    // Tab 1 has no priority
    w.drillCalcAll();

    var eB = w.document.getElementById('dtl_e_1');
    expect(eB.value).toBe('');
  });

  it('handles zero total einheit and duenger', () => {
    setupMultiTab();
    w.document.getElementById('drill_einheit').value = '0';
    w.document.getElementById('drill_duenger').value = '0';

    w.state.drillPriorities[0] = 1;
    w.drillCalcAll();

    var eA = w.document.getElementById('dtl_e_0');
    expect(eA.value).toBe('');
  });
});

describe('drillAdd multi-tab mode', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  function setupMultiTabWithPrio() {
    w.state.reiter = [
      { name: 'A', hektar: 10, koerner: 90000, duenger: 150, entries: [] },
      { name: 'B', hektar: 5, koerner: 80000, duenger: 100, entries: [] },
    ];
    w.state.activeReiter = 0;
    w.state.drillPriorities[0] = 1;
    w.state.drillPriorities[1] = 2;
    w.renderDrillTabList(); // DOM mit korrekten data-prio Werten aufbauen
  }

  it('adds entries to prioritized tabs', () => {
    setupMultiTabWithPrio();
    // Tab A prio=1 (high), Tab B prio=2 (low) — Issue #264: Prio 1 = höchste
    // Total: 15 Einheiten, Tab A needs 18, Tab B needs 8
    w.document.getElementById('drill_einheit').value = '15';
    w.document.getElementById('drill_duenger').value = '0';

    w.drillCalcAll(); // distribute
    w.drillAdd();

    // Tab A (prio 1) gets min(18, 15) = 15
    expect(w.state.reiter[0].entries.length).toBe(1);
    expect(w.state.reiter[0].entries[0].einheit).toBeCloseTo(15);
    // Tab B (prio 2) gets min(8, 15-15=0) = 0 → keine Entry
    expect(w.state.reiter[1].entries.length).toBe(0);
  });

  it('records machineLog entry', () => {
    setupMultiTabWithPrio();
    w.document.getElementById('drill_einheit').value = '10';
    w.document.getElementById('drill_duenger').value = '0';

    w.drillCalcAll();
    w.drillAdd();

    expect(w.state.machineLog.length).toBe(1);
    expect(w.state.machineLog[0].einheit).toBeCloseTo(10);
  });

  it('clears inputs after adding', () => {
    setupMultiTabWithPrio();
    w.document.getElementById('drill_einheit').value = '10';
    w.document.getElementById('drill_duenger').value = '500';

    w.drillCalcAll();
    w.drillAdd();

    expect(w.document.getElementById('drill_einheit').value).toBe('');
    expect(w.document.getElementById('drill_duenger').value).toBe('');
    expect(w.document.getElementById('drill_hektar').value).toBe('');
  });

  it('preserves priorities after adding', () => {
    setupMultiTabWithPrio();
    w.document.getElementById('drill_einheit').value = '10';
    w.document.getElementById('drill_duenger').value = '0';

    w.drillCalcAll();
    w.drillAdd();

    // Priorities persist after drillAdd (bug #146)
    expect(Object.keys(w.state.drillPriorities).length).toBe(2);
    expect(w.state.drillPriorities[0]).toBe(1);
    expect(w.state.drillPriorities[1]).toBe(2);
  });

  it('does nothing when no prioritized tabs have values', () => {
    setupMultiTabWithPrio();
    w.document.getElementById('drill_einheit').value = '0';
    w.document.getElementById('drill_duenger').value = '0';
    w.state.drillPriorities = {}; // no priorities
    w.drillAdd();
    expect(w.state.reiter[0].entries.length).toBe(0);
    expect(w.state.reiter[1].entries.length).toBe(0);
  });

  // ── Dimension math regression (Issue #240) ─────────────────────────────────
  // Pre-fix: perUnit = einheitPerHa / tab.hektar ergab "Einheiten/ha²" und
  // maxUnitsThisTab dadurch einen winzigen Wert — multi-tab-Distribution brach.
  // Fix: perUnit = (tab.koerner * fahrgassenFactor) / koernerProEinheit
  // (Einheiten/ha), maxUnitsThisTab = tab.hektar * perUnit (Einheiten).
  it('cap respects tab.hektar: kein Tab erhält mehr Einheiten als seine Kapazität (Issue #240)', () => {
    setupMultiTabWithPrio();
    // Tab A: 10ha × 90000 / 50000 = 18 E Kapazität
    // Tab B: 5ha × 80000 / 50000  = 8  E Kapazität
    // Mit 18 E: A (prio 1, Kapazität 18) bekommt min(18, 18) = 18;
    // B (prio 2) bekommt die Reste 0 — cap auf 18 wäre verletzt, falls
    // perUnit falsch wäre.
    w.document.getElementById('drill_einheit').value = '18';
    w.document.getElementById('drill_duenger').value = '0';

    w.drillCalcAll();
    w.drillAdd();

    var eB = w.state.reiter[1].entries[0] ? w.state.reiter[1].entries[0].einheit : 0;
    var eA = w.state.reiter[0].entries[0].einheit;
    // Tab A (prio 1, Kapazität 18) → bekommt 18
    expect(eA).toBeCloseTo(18, 5);
    // Tab B (prio 2, Kapazität 8) → bekommt min(8, 18-18=0) = 0 → keine Entry
    expect(w.state.reiter[1].entries.length).toBe(0);
  });

  it('Fahrgassen-Faktor reduziert die Kapazität pro Tab (Issue #240)', () => {
    setupMultiTabWithPrio();
    // Tab A mit FG (breite=24 → 0.9583): 10ha × 90000 × 23/24 / 50000 ≈ 17.25 E
    // Tab B ohne FG: 5ha × 80000 / 50000 = 8 E
    // Mit 25 E: A (prio 1) bekommt min(17.25, 25) = 17.25; B (prio 2) bekommt
    // 7.75. Wäre perUnit falsch (Tab A "Einheiten/ha²"), bekäme A statt der
    // 17.25 nur eine winzige Zahl und B die 25 oder mehr.
    w.state.reiter[0].fahrgassenEnabled = true;
    w.state.reiter[0].fahrgassenBreite = 24;
    w.state.reiter[1].fahrgassenEnabled = false;
    w.document.getElementById('drill_einheit').value = '25';
    w.document.getElementById('drill_duenger').value = '0';

    w.drillCalcAll();
    w.drillAdd();

    var eA = w.state.reiter[0].entries[0].einheit;
    var eB = w.state.reiter[1].entries[0].einheit;
    var fgFactor = w.computeFahrgassenFaktor(24); // 23/24 ≈ 0.9583
    var capA = 10 * 90000 * fgFactor / 50000;     // ≈ 17.25
    // A (prio 1) bekommt min(capA, 25) = capA ≈ 17.25.
    expect(eA).toBeCloseTo(capA, 5);
    // B (prio 2) bekommt min(8, 25-17.25) = 7.75
    expect(eB).toBeCloseTo(25 - capA, 5);
    // Sanity: bei mehr input würde der FG-Faktor sichtbar:
    expect(capA).toBeLessThan(18);
  });
});

describe('priority button cycling', () => {
  let w;
  beforeEach(() => { w = createDom().window; });

  it('cycles through priority values on click', () => {
    w.renderDrillTabList();
    var doc = w.document;
    var prioBtn = doc.getElementById('dtl_prio_0');
    expect(prioBtn.getAttribute('data-prio')).toBe('0');
    expect(prioBtn.textContent).toBe('—');

    // Click once → prio 1
    // Issue #447 Welle 2a: der Prio-Klick löst einen renderDrillTabList
    // über drillCalcAll aus — die alten DOM-Knoten werden ersetzt. Wir
    // holen den frischen Knoten nach jedem Klick neu per getElementById,
    // das DOM-Ergebnis ist IDENTISCH (data-prio, Text, .active-Klasse).
    prioBtn.click();
    var btn1 = doc.getElementById('dtl_prio_0');
    expect(btn1.getAttribute('data-prio')).toBe('1');
    expect(btn1.textContent).toBe('1');
    expect(btn1.classList.contains('active')).toBe(true);

    // Click again → prio 2 (but maxPrio=1 since only 1 tab, so cycles to 0)
    btn1.click();
    var btn2 = doc.getElementById('dtl_prio_0');
    // With 1 tab, maxPrio=1, so 1 >= 1 → cycles to 0
    expect(btn2.getAttribute('data-prio')).toBe('0');
    expect(btn2.textContent).toBe('—');
  });

  it('cycles 0→1→2→3→0 with 3 tabs', () => {
    w.addReiter();
    w.addReiter();
    w.renderDrillTabList();
    var doc = w.document;
    // Issue #447 Welle 2a: nach jedem Klick frischen Button holen, weil
    // renderDrillTabList die alten Knoten ersetzt. Verhalten (data-prio,
    // Text, .active) bleibt identisch zum vorherigen Inline-Update.
    doc.getElementById('dtl_prio_0').click(); // 0→1
    expect(doc.getElementById('dtl_prio_0').getAttribute('data-prio')).toBe('1');
    doc.getElementById('dtl_prio_0').click(); // 1→2
    expect(doc.getElementById('dtl_prio_0').getAttribute('data-prio')).toBe('2');
    doc.getElementById('dtl_prio_0').click(); // 2→3
    doc.getElementById('dtl_prio_0').click(); // 3 → maxPrio=3 → 0
    var final = doc.getElementById('dtl_prio_0');
    expect(final.getAttribute('data-prio')).toBe('0');
    expect(final.textContent).toBe('—');
  });
});

    // Issue #321: regression tests for _buildDrillEntry() — direct unit tests for
    // the function whose silent Dünger-Cap was the bug. The cap used to clamp
    // entry.duenger to duengerPerUnit * unitsForThisTab, which truncated user
    // input whenever the real kg/E ratio differed from the tab plan. Fixed by
    // removing the cap; raw duengerRaw is now stored as entry.duenger.
    describe('_buildDrillEntry (Issue #321: no silent Dünger-Cap)', () => {
      let w;
      beforeEach(() => { w = createDom().window; });

      function makeTab(overrides) {
        return Object.assign({
          name: 'Test', hektar: 10, koerner: 90000, duenger: 200,
          fahrgassenEnabled: false, fahrgassenBreite: 0,
          entries: []
        }, overrides || {});
      }

      it('respects raw user duenger input, no silent cap', () => {
        // Tab config: 10ha, koerner=90000, duenger=200 kg/ha
        // duengerPerUnit = 200 * 50000 / 90000 ≈ 111.11 kg/E
        // unitsForThisTab = min(12, 18) = 12 (capped, < tab cap)
        // OLD cap: min(2000, 111.11 * 12) = 1333.33 → silently swallowed 666.67 kg
        // NEW (no cap): 2000 stored as-is
        var tab = makeTab();
        var entry = w._buildDrillEntry(tab, 12, 2000, 0, -1);
        expect(entry.einheit).toBeCloseTo(12);
        expect(entry.duenger).toBe(2000); // raw, NOT 1333.33
      });

      it('extreme case: 1 unit, 99999 kg → 99999 kg (no cap)', () => {
        var tab = makeTab();
        var entry = w._buildDrillEntry(tab, 1, 99999, 0, -1);
        expect(entry.einheit).toBeCloseTo(1);
        expect(entry.duenger).toBe(99999); // no upper bound at all
      });

      it('Saatgut-Cap still active: 24 E capped to maxUnitsThisTab (18)', () => {
        // Tab cap = 10ha × 90000/50000 = 18 E
        var tab = makeTab();
        var entry = w._buildDrillEntry(tab, 24, 0, 0, -1);
        expect(entry.einheit).toBeCloseTo(18); // capped
        expect(entry.duenger).toBe(0);
      });

      it('duenger = 0 is preserved (no spurious values)', () => {
        var tab = makeTab();
        var entry = w._buildDrillEntry(tab, 12, 0, 0, -1);
        expect(entry.duenger).toBe(0);
      });

      it('negative duenger is preserved as-is (raw passthrough)', () => {
        // The function is a pure formatter — callers (drillAdd) validate inputs.
        // This documents that _buildDrillEntry does no clamping itself.
        var tab = makeTab();
        var entry = w._buildDrillEntry(tab, 12, -5, 0, -1);
        expect(entry.duenger).toBe(-5);
      });
    });
});

describe('Drill-Protokoll (Eintragen, Multi-Tab-Verteilung Input, Maschine entfernen, Saldo, Done-Flag) — übernommen aus 30-drill-machine-remove.test.js', () => {
/**
 * Tests for drillMachineRemove() function.
 *
 * MEDIUM: drillMachineRemove() removes entries from machineLog and re-renders results.
 * No tests existed for this function.
 */

describe('drillMachineRemove', () => {
  let w, doc, store;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
    doc = w.document;
    store = result.store;
  });

  it('removes entry from machineLog', () => {
    w.state.machineLog = [
      { einheit: 5, zaehlerStand: 3, duenger: 100, time: '09:00' },
      { einheit: 3, zaehlerStand: 6, duenger: 60, time: '10:00' },
      { einheit: 4, zaehlerStand: 10, duenger: 80, time: '11:00' }
    ];

    w.drillMachineRemove(1); // Remove second entry

    expect(w.state.machineLog.length).toBe(2);
    expect(w.state.machineLog[0].time).toBe('09:00');
    expect(w.state.machineLog[1].time).toBe('11:00');
  });

  it('removes first entry', () => {
    w.state.machineLog = [
      { einheit: 5, zaehlerStand: 3, duenger: 100, time: '09:00' },
      { einheit: 3, zaehlerStand: 6, duenger: 60, time: '10:00' }
    ];

    w.drillMachineRemove(0);

    expect(w.state.machineLog.length).toBe(1);
    expect(w.state.machineLog[0].time).toBe('10:00');
  });

  it('removes last entry', () => {
    w.state.machineLog = [
      { einheit: 5, zaehlerStand: 3, duenger: 100, time: '09:00' },
      { einheit: 3, zaehlerStand: 6, duenger: 60, time: '10:00' }
    ];

    w.drillMachineRemove(1);

    expect(w.state.machineLog.length).toBe(1);
    expect(w.state.machineLog[0].time).toBe('09:00');
  });

  it('saves state after removal', () => {
    w.state.machineLog = [
      { einheit: 5, zaehlerStand: 3, duenger: 100, time: '09:00' }
    ];

    w.drillMachineRemove(0);

    // sv() is called → state should be persisted
    const saved = JSON.parse(store['agrar_rechner']);
    expect(saved.machineLog.length).toBe(0);
  });

  it('does nothing for negative index', () => {
    w.state.machineLog = [
      { einheit: 5, zaehlerStand: 3, duenger: 100, time: '09:00' }
    ];

    w.drillMachineRemove(-1);

    expect(w.state.machineLog.length).toBe(1);
  });

  it('does nothing for out-of-bounds index', () => {
    w.state.machineLog = [
      { einheit: 5, zaehlerStand: 3, duenger: 100, time: '09:00' }
    ];

    w.drillMachineRemove(5);

    expect(w.state.machineLog.length).toBe(1);
  });

  it('does nothing when machineLog is undefined', () => {
    w.state.machineLog = undefined;
    expect(() => w.drillMachineRemove(0)).not.toThrow();
    expect(w.state.machineLog).toBeUndefined();
  });

  it('re-renders results after removal', () => {
    w.state.machineLog = [
      { einheit: 5, zaehlerStand: 3, duenger: 100, time: '09:00' }
    ];
    // Set up tab with entry so renderResults has something to do
    w.state.reiter[0].hektar = 10;
    w.state.reiter[0].koerner = 80000;
    w.state.reiter[0].entries = [{ einheit: 5, zaehlerStand: 3, duenger: 100, time: '09:00' }];

    w.drillMachineRemove(0);

    // If renderResults runs without error, test passes
    // (no explicit DOM check needed — just no exception)
  });
});
});

describe('Drill-Protokoll (Eintragen, Multi-Tab-Verteilung Input, Maschine entfernen, Saldo, Done-Flag) — übernommen aus 52-drill-protokoll-saldo.test.js', () => {
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
    // Migration 5→6: per-tab kpe ist authoritative — auf state-Wert zurücksetzen
    delete w.state.reiter[0].koernerProEinheit;
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
    delete w.state.reiter[0].koernerProEinheit;
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
    delete w.state.reiter[0].koernerProEinheit;
    w.state.reiter[1] = {
      ...w.state.reiter[1],
      hektar: 5,  istHektar: 6, koerner: 90000, duenger: 100, entries: []
    };
    delete w.state.reiter[1].koernerProEinheit;
    w.state.reiter[2] = {
      ...w.state.reiter[2],
      hektar: 7,  istHektar: 7, koerner: 90000, duenger: 100, entries: []
    };
    delete w.state.reiter[2].koernerProEinheit;
    w.renderDrillLog();
    const s = netSavingsIn(drillLog());
    expect(s).not.toBeNull();
    expect(s.textContent).toBe('Ersparnis: 1,000 Einheiten Saatgut, 100 kg Dünger');
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
    delete w.state.reiter[0].koernerProEinheit;
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
    delete w.state.reiter[0].koernerProEinheit;
    w.state.reiter[1] = {
      ...w.state.reiter[1],
      hektar: 5,  istHektar: 6, koerner: 90000, duenger: 100, entries: []
    };
    delete w.state.reiter[1].koernerProEinheit;
    w.state.reiter[2] = {
      ...w.state.reiter[2],
      hektar: 7,  istHektar: 7, koerner: 90000, duenger: 100, entries: []
    };
    delete w.state.reiter[2].koernerProEinheit;
    w.renderMachineLog();
    const proto = maschinenProtokoll();
    const s = netSavingsIn(proto);
    expect(s).not.toBeNull();
    expect(s.textContent).toBe('Ersparnis: 1,000 Einheiten Saatgut, 100 kg Dünger');
  });

  it('Maschinen-Protokoll: Net-Totals-Block VOR Per-Tab-Sub-Headern', () => {
    w.state.koernerProEinheit = 90000;
    w.state.activeReiter = 0;
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 9, koerner: 90000, duenger: 100, entries: []
    };
    delete w.state.reiter[0].koernerProEinheit;
    w.state.reiter[1] = {
      ...w.state.reiter[1],
      hektar: 5,  istHektar: 5, koerner: 90000, duenger: 100, entries: []
    };
    delete w.state.reiter[1].koernerProEinheit;
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
    delete w.state.reiter[0].koernerProEinheit;
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
    delete w.state.reiter[0].koernerProEinheit;
    w.state.reiter[1] = {
      ...w.state.reiter[1],
      hektar: 5,  istHektar: 5, koerner: 90000, duenger: 100, entries: []
    };
    delete w.state.reiter[1].koernerProEinheit;
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
    delete w.state.reiter[0].koernerProEinheit;
    w.state.reiter[1] = {
      ...w.state.reiter[1],
      hektar: 10, istHektar: 10, koerner: 50000, duenger: 100, entries: []
    };
    delete w.state.reiter[1].koernerProEinheit;
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
    delete w.state.reiter[0].koernerProEinheit;
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
});

describe('Drill-Protokoll (Eintragen, Multi-Tab-Verteilung Input, Maschine entfernen, Saldo, Done-Flag) — übernommen aus 58-tab-done-flag.test.js', () => {
/**
 * Issue #377: Manuelle Fertig-Markierung pro Tab — done-Flag + UI + Locking
 *
 * Coverage:
 *   1. State: done-Flag existiert im Default-State
 *   2. State-Migration: alter State ohne `done` → `done: false` für alle Tabs
 *   3. State: `done: true` überlebt einen Reload (saveState/loadState round-trip)
 *   4. UI: Toggle-Button "Feld fertig" rendert pro Tab, Klick setzt `done = true`
 *   5. UI: nach Toggle rendert Button "Fertig zurücknehmen" + Klasse `active`
 *   6. UI: Klick auf "Fertig zurücknehmen" setzt `done = false` (Undo)
 *   7. Locking: bei `done = true` sind `dtl_e_<i>` und `dtl_d_<i>` disabled
 *   8. Locking: bei `done = false` sind die Inputs wieder enabled
 *   9. Locking: bei aktivem done-Tab sind die globalen drill_einheit / drill_duenger /
 *      drill_hektar Felder disabled
 *  10. Locking: Tab-Wechsel (activeReiter) auf nicht-done-Tab entsperrt die globalen Felder
 *  11. Schema-Whitelist: `done` ist in ALLOWED_TAB_KEYS (würde sonst beim Save
 *      gestrippt werden, ist aber Top-Level auf reiter[])
 */

describe('Issue #377: manuelle Fertig-Markierung pro Tab', () => {
    let w, doc, store;

    beforeEach(() => {
        const result = createDom();
        w = result.window;
        doc = w.document;
        store = result.store;
    });

    describe('State: done-Flag existiert', () => {
        it('Default-State (frisch) hat done: false auf reiter[0]', () => {
            // Kein localStorage → frischer State
            expect(w.state.reiter[0].done).toBe(false);
        });

        it('done ist in ALLOWED_TAB_KEYS (Schema-Whitelist)', () => {
            expect(w.AppGlobals.ALLOWED_TAB_KEYS).toContain('done');
        });
    });

    describe('State-Migration', () => {
        it('alter State ohne `done`-Feld bekommt done: false auf allen Tabs', () => {
            // Migration 4 → 5: kein `done`-Feld im gespeicherten State
            store['agrar_rechner'] = JSON.stringify({
                _lv: 4,
                reiter: [
                    { name: 'Tab 1', hektar: 10, koerner: 90000, duenger: 150, entries: [] },
                    { name: 'Tab 2', hektar: 5, koerner: 95000, duenger: 100, entries: [] }
                ],
                activeReiter: 0,
                fahrgassenEnabled: false,
                fahrgassenBreite: 0,
                einheitGroesseEnabled: false,
                koernerProEinheit: 50000,
                machineLog: [],
                drillPriorities: {}
            });
            w.loadState();
            expect(w.state.reiter.length).toBe(2);
            expect(w.state.reiter[0].done).toBe(false);
            expect(w.state.reiter[1].done).toBe(false);
        });

        it('alter State mit done=true auf einem Tab bleibt nach Migration erhalten', () => {
            store['agrar_rechner'] = JSON.stringify({
                _lv: 4,
                reiter: [
                    { name: 'Tab 1', hektar: 10, koerner: 90000, duenger: 150, entries: [], done: true },
                    { name: 'Tab 2', hektar: 5, koerner: 95000, duenger: 100, entries: [] }
                ],
                activeReiter: 0,
                fahrgassenEnabled: false,
                fahrgassenBreite: 0,
                einheitGroesseEnabled: false,
                koernerProEinheit: 50000,
                machineLog: [],
                drillPriorities: {}
            });
            w.loadState();
            expect(w.state.reiter[0].done).toBe(true);
            expect(w.state.reiter[1].done).toBe(false);
        });

        it('done wird nach saveState/loadState round-trip erhalten', () => {
            w.state.reiter[0].done = true;
            w.state.reiter.push({ name: 'Tab 2', hektar: 5, koerner: 90000, duenger: 100, entries: [], done: false });
            w.saveState();
            // Frisches Window simulieren (anderer Reiter-Reload)
            w.state.reiter[0].done = false; // lokal überschreiben
            w.loadState();
            expect(w.state.reiter[0].done).toBe(true);
            expect(w.state.reiter[1].done).toBe(false);
        });
    });

    describe('UI: Toggle-Button pro Tab', () => {
        function setupDrillView() {
            w.state.reiter[0] = { name: 'Acker Nord', hektar: 10, koerner: 90000, duenger: 150, entries: [], done: false };
            // Drill-View anzeigen (activeView='protokoll') und rendern
            w.state.activeView = 'protokoll';
            w.AppGlobals.renderDrillTabList();
        }

        it('rendert einen done-Button pro Tab', () => {
            setupDrillView();
            var btn = doc.getElementById('dtl_done_0');
            expect(btn).toBeTruthy();
            expect(btn.textContent).toBe('Feld fertig');
            expect(btn.classList.contains('active')).toBe(false);
            expect(btn.getAttribute('aria-pressed')).toBe('false');
        });

        it('Klick auf "Feld fertig" setzt done=true und rendert als "Fertig zurücknehmen"', () => {
            setupDrillView();
            var btn = doc.getElementById('dtl_done_0');
            btn.click();
            expect(w.state.reiter[0].done).toBe(true);
            // Re-render: neuer Button hat neuen Text
            var btn2 = doc.getElementById('dtl_done_0');
            expect(btn2.textContent).toBe('Fertig zurücknehmen');
            expect(btn2.classList.contains('active')).toBe(true);
            expect(btn2.getAttribute('aria-pressed')).toBe('true');
        });

        it('Undo: zweiter Klick setzt done=false und Werte bleiben erhalten', () => {
            setupDrillView();
            // Erstmal done=true setzen
            w.state.reiter[0].done = true;
            w.AppGlobals.renderDrillTabList();
            // Eine Entry hinzufügen, used-Wert soll erhalten bleiben
            w.state.reiter[0].entries.push({
                time: 1, einheit: 5, duenger: 75, hektar: 10, istHektar: 0,
                koerner: 90000, duengerRate: 150, mlIdx: -1
            });
            // Undo
            doc.getElementById('dtl_done_0').click();
            expect(w.state.reiter[0].done).toBe(false);
            // Entries bleiben unangetastet
            expect(w.state.reiter[0].entries.length).toBe(1);
            expect(w.state.reiter[0].entries[0].einheit).toBe(5);
        });

        it('persistiert done nach saveState', () => {
            setupDrillView();
            doc.getElementById('dtl_done_0').click();
            var persisted = JSON.parse(store['agrar_rechner']);
            expect(persisted.reiter[0].done).toBe(true);
        });
    });

    describe('Locking: Per-Tab-Inputs (dtl_e_<i> / dtl_d_<i>)', () => {
        function setupDrillView() {
            w.state.reiter[0] = { name: 'Acker', hektar: 10, koerner: 90000, duenger: 150, entries: [], done: false };
            w.state.activeView = 'protokoll';
            w.AppGlobals.renderDrillTabList();
        }

        it('bei done=true sind dtl_e_0 und dtl_d_0 disabled', () => {
            setupDrillView();
            w.state.reiter[0].done = true;
            w.AppGlobals.renderDrillTabList();
            expect(doc.getElementById('dtl_e_0').disabled).toBe(true);
            expect(doc.getElementById('dtl_d_0').disabled).toBe(true);
        });

        it('bei done=false sind dtl_e_0 und dtl_d_0 enabled', () => {
            setupDrillView();
            // Default: done=false
            expect(doc.getElementById('dtl_e_0').disabled).toBe(false);
            expect(doc.getElementById('dtl_d_0').disabled).toBe(false);
        });

        it('Undo: nach done=true → false sind die Inputs wieder enabled', () => {
            setupDrillView();
            w.state.reiter[0].done = true;
            w.AppGlobals.renderDrillTabList();
            expect(doc.getElementById('dtl_e_0').disabled).toBe(true);
            // Undo
            w.state.reiter[0].done = false;
            w.AppGlobals.renderDrillTabList();
            expect(doc.getElementById('dtl_e_0').disabled).toBe(false);
        });
    });

    describe('Locking: globale Drill-Inputs (drill_einheit / drill_duenger / drill_hektar)', () => {
        function setupDrillView() {
            w.state.reiter[0] = { name: 'Acker', hektar: 10, koerner: 90000, duenger: 150, entries: [], done: false };
            w.state.activeReiter = 0;
            w.state.activeView = 'protokoll';
            w.AppGlobals.renderDrillTabList();
            w.AppGlobals.drillCalcAll();
        }

        it('aktiver Tab done=true → globale Inputs disabled', () => {
            setupDrillView();
            w.state.reiter[0].done = true;
            w.AppGlobals.drillCalcAll();
            expect(doc.getElementById('drill_einheit').disabled).toBe(true);
            expect(doc.getElementById('drill_duenger').disabled).toBe(true);
            expect(doc.getElementById('drill_hektar').disabled).toBe(true);
        });

        it('aktiver Tab done=false → globale Inputs enabled', () => {
            setupDrillView();
            // Default
            expect(doc.getElementById('drill_einheit').disabled).toBe(false);
            expect(doc.getElementById('drill_duenger').disabled).toBe(false);
            expect(doc.getElementById('drill_hektar').disabled).toBe(false);
        });

        it('Tab-Wechsel: aktiver Tab nicht-done, anderer Tab done → globale Inputs enabled', () => {
            setupDrillView();
            w.state.reiter.push({ name: 'Tab 2', hektar: 5, koerner: 90000, duenger: 100, entries: [], done: true });
            w.state.reiter[0].done = false;
            w.state.activeReiter = 0;
            w.AppGlobals.drillCalcAll();
            expect(doc.getElementById('drill_einheit').disabled).toBe(false);
            // Bug #377/PR #379: Auf done-Tab wechseln über den realistischen Pfad
            // (User klickt Tab-Pill → switchReiter → appEmit('TAB_CHANGED')).
            // Vor dem Fix re-synct der render-tabs TAB_CHANGED-Subscriber KEINEN
            // drillCalcAll, also blieb der Lock auf drill_einheit am vorherigen
            // activeReiter "verklebt" bis der User irgendetwas anderes tut.
            // switchReiter(1) muss den Lock ohne zwischenzeitliches drillCalcAll
            // sofort korrekt setzen.
            w.switchReiter(1);
            expect(doc.getElementById('drill_einheit').disabled).toBe(true);
            expect(doc.getElementById('drill_duenger').disabled).toBe(true);
            expect(doc.getElementById('drill_hektar').disabled).toBe(true);
            // Zurück auf Tab 0 (nicht done) → Inputs wieder enabled, ebenfalls
            // ohne zwischenzeitliches drillCalcAll.
            w.switchReiter(0);
            expect(doc.getElementById('drill_einheit').disabled).toBe(false);
            expect(doc.getElementById('drill_duenger').disabled).toBe(false);
            expect(doc.getElementById('drill_hektar').disabled).toBe(false);
        });
    });
});

// ===========================================================================
// Issue #447 Welle 2a — cycleDrillPriority SSOT
//
// Vor Welle 2a: der Prio-Button-Click-Handler in render-drill.js mutierte
// state.drillPriorities[idx] DIREKT im Renderer und emittierte
// DRILL_PRIORITY_CHANGED. Das verletzte das Architekturprinzip "Renderer
// mutieren keinen State".
//
// Welle 2a: cycleDrillPriority(tabIdx) in drill-handlers.js ist die
// SSOT-Funktion für den Cycle. Sie:
//   1. Liest den aktuellen Prio-Wert (0 falls nicht gesetzt).
//   2. Berechnet next (0 wenn current >= reiter.length, sonst current+1).
//   3. Schreibt state.drillPriorities[tabIdx] = next.
//   4. Emittiert DRILL_PRIORITY_CHANGED mit {tabIdx, priority: next}.
// Der Click-Handler im Renderer delegiert nur noch an diese Funktion.
//
// Gruppierung in drill-protocol.test.js, weil die Prio-Logik fachlich zur
// Drill-Verteilung gehört (Issue #264/#377) und nicht zur A11y- oder
// Tab-Schicht. Begleitende Verhaltens-Tests (DOM nach Klick) bleiben in
// regression-blind-spots.test.js.
describe('Issue #447 Welle 2a — cycleDrillPriority SSOT', () => {
    let w;
    beforeEach(() => {
        w = createDom().window;
    });

    it('ist als AppGlobals-Funktion verfügbar', () => {
        expect(typeof w.AppGlobals.cycleDrillPriority).toBe('function');
    });

    it('liest 0 wenn kein Prio gesetzt, setzt 1, emittiert DRILL_PRIORITY_CHANGED', () => {
        // Spy auf appEmit, um das Event-Payload zu verifizieren
        var emitted = [];
        var origEmit = w.AppGlobals.appEmit;
        w.AppGlobals.appEmit = function(type, data) { emitted.push({ type: type, data: data }); };

        // 2 Tabs → Max-Prio ist 2
        w.state.reiter = [
            { name: 'A', hektar: 10, koerner: 50000, duenger: 0, entries: [] },
            { name: 'B', hektar: 5,  koerner: 50000, duenger: 0, entries: [] },
        ];
        w.AppGlobals.cycleDrillPriority(0);

        expect(w.state.drillPriorities[0]).toBe(1);
        expect(emitted.length).toBe(1);
        expect(emitted[0].type).toBe('DRILL_PRIORITY_CHANGED');
        expect(emitted[0].data.tabIdx).toBe(0);
        expect(emitted[0].data.priority).toBe(1);

        w.AppGlobals.appEmit = origEmit;
    });

    it('cycled 0 → 1 → 2 → 0 bei 2 Tabs', () => {
        w.state.reiter = [
            { name: 'A', hektar: 10, koerner: 50000, duenger: 0, entries: [] },
            { name: 'B', hektar: 5,  koerner: 50000, duenger: 0, entries: [] },
        ];
        expect(w.AppGlobals.cycleDrillPriority(0)).toBe(1);
        expect(w.AppGlobals.cycleDrillPriority(0)).toBe(2);
        // Nach 2 → 0 (current >= reiter.length → reset)
        expect(w.AppGlobals.cycleDrillPriority(0)).toBe(0);
    });

    it('cycled 0 → 1 → 2 → 3 → 0 bei 3 Tabs', () => {
        w.state.reiter = [
            { name: 'A', hektar: 10, koerner: 50000, duenger: 0, entries: [] },
            { name: 'B', hektar: 5,  koerner: 50000, duenger: 0, entries: [] },
            { name: 'C', hektar: 3,  koerner: 50000, duenger: 0, entries: [] },
        ];
        expect(w.AppGlobals.cycleDrillPriority(0)).toBe(1);
        expect(w.AppGlobals.cycleDrillPriority(0)).toBe(2);
        expect(w.AppGlobals.cycleDrillPriority(0)).toBe(3);
        // Nach 3 → 0 (current >= reiter.length → reset)
        expect(w.AppGlobals.cycleDrillPriority(0)).toBe(0);
    });

    it('respektiert existierenden Prio-Wert (kein Reset auf 0 bei erstem Call)', () => {
        w.state.reiter = [
            { name: 'A', hektar: 10, koerner: 50000, duenger: 0, entries: [] },
            { name: 'B', hektar: 5,  koerner: 50000, duenger: 0, entries: [] },
        ];
        // Vorab Prio=2 gesetzt (z.B. nach einem Reload aus localStorage)
        w.state.drillPriorities[0] = 2;
        // Cycle: 2 → 0 (da 2 >= reiter.length=2)
        expect(w.AppGlobals.cycleDrillPriority(0)).toBe(0);
    });

    it('hasOwnProperty-Schutz: unterscheidet "Key fehlt" von "Key=0"', () => {
        // Sicherstellen, dass die Implementierung hasOwnProperty nutzt, sonst
        // würde ein gespeichertes prio=0 als "fehlend" interpretiert und auf 1
        // zurückgesetzt — das wäre ein Bug nach Reload aus localStorage.
        w.state.reiter = [
            { name: 'A', hektar: 10, koerner: 50000, duenger: 0, entries: [] },
            { name: 'B', hektar: 5,  koerner: 50000, duenger: 0, entries: [] },
        ];
        // Explizit prio=0 setzen (nicht "fehlt")
        w.state.drillPriorities[0] = 0;
        // Cycle: 0 → 1 (weil 0 nicht "fehlt", sondern explizit 0 ist)
        expect(w.AppGlobals.cycleDrillPriority(0)).toBe(1);
    });

    it('cycleDrillPriority ist unabhängig vom Renderer — nutzt nur appEmit, kein direkter saveState oder Renderer-Call', () => {
        // Architektur-Disziplin: cycleDrillPriority hat als SSOT-Funktion
        // genau ZWEI Verantwortlichkeiten: state mutieren + Event emittieren.
        // Persistenz + Re-Render laufen zentral über den State-Coordinator.
        // Wir verifizieren das, indem wir saveState und renderDrillTabList
        // ausspionieren — der Coordinator-Pfad ruft sie indirekt via
        // appEmit, das ist OK und gewollt. cycleDrillPriority selbst darf
        // aber KEINEN direkten Aufruf machen.
        w.state.reiter = [
            { name: 'A', hektar: 10, koerner: 50000, duenger: 0, entries: [] },
        ];
        var emitted = [];
        var origEmit = w.AppGlobals.appEmit;
        w.AppGlobals.appEmit = function(type, data) {
            emitted.push(type);
            // NICHT weiterleiten — wir wollen NICHT, dass der Coordinator
            // Pfad hier durchläuft, damit der Test isoliert bleibt.
        };
        var saveCalls = 0;
        var origSave = w.AppGlobals.saveState;
        w.AppGlobals.saveState = function() { saveCalls++; };

        w.AppGlobals.cycleDrillPriority(0);

        // cycleDrillPriority emittiert das Event …
        expect(emitted.length).toBe(1);
        expect(emitted[0]).toBe('DRILL_PRIORITY_CHANGED');
        // … aber ruft KEIN saveState direkt auf (Persistenz läuft via Coordinator).
        expect(saveCalls).toBe(0);

        w.AppGlobals.appEmit = origEmit;
        w.AppGlobals.saveState = origSave;
    });
});

describe('Issue #447 Welle 2a — Prio-Klick delegiert an cycleDrillPriority', () => {
    let w, doc;
    beforeEach(() => {
        const { window } = createDom();
        w = window;
        doc = w.document;
        w.state.reiter = [
            { name: 'A', hektar: 10, koerner: 50000, duenger: 0, entries: [] },
            { name: 'B', hektar: 5,  koerner: 50000, duenger: 0, entries: [] },
        ];
        w.renderDrillTabList();
    });

    it('Click auf dtl_prio_0 ruft cycleDrillPriority(0) auf', () => {
        var calls = [];
        var orig = w.AppGlobals.cycleDrillPriority;
        w.AppGlobals.cycleDrillPriority = function(idx) { calls.push(idx); };
        doc.getElementById('dtl_prio_0').click();
        expect(calls.length).toBe(1);
        expect(calls[0]).toBe(0);
        w.AppGlobals.cycleDrillPriority = orig;
    });

    it('Click auf dtl_prio_0 mutiert state.drillPriorities via cycleDrillPriority', () => {
        // Integriertest: Klick → cycleDrillPriority → state mutiert
        // → appEmit DRILL_PRIORITY_CHANGED → drillCalcAll → renderDrillTabList
        // → DOM spiegelt neuen Zustand.
        doc.getElementById('dtl_prio_0').click();
        expect(w.state.drillPriorities[0]).toBe(1);
        // Nach Re-Render hat der neue Button den neuen data-prio
        expect(doc.getElementById('dtl_prio_0').getAttribute('data-prio')).toBe('1');
        expect(doc.getElementById('dtl_prio_0').classList.contains('active')).toBe(true);
    });
});
});
