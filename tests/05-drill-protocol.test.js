/**
 * Tests for Drill-Protokoll: drillAdd(), drillRemove(), renderResults()
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

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
    w.berechne();
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
      expect(doc.getElementById('ds_saat_total').textContent).toBe('18,0 Einheiten');
      // Used einheit = 5
      expect(doc.getElementById('ds_saat_used').textContent).toContain('5,0');
      // Remaining = 18 - 5 = 13
      expect(doc.getElementById('ds_saat_remaining').textContent).toBe('13,0 Einheiten');
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
      expect(entries[0].textContent).toContain('5,0 Einheiten');
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
      expect(rem).toBe('0,0 Einheiten');
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
      expect(doc.getElementById('ds_saat_total').textContent).toBe('27,0 Einheiten');
      // Used: full 27 (drillAdd exactly filled both tabs).
      expect(doc.getElementById('ds_saat_used').textContent).toBe('27,0 Einheiten');
      // Remaining: 0 (or '—' if the implementation uses the zero-skip path).
      const remText = doc.getElementById('ds_saat_remaining').textContent;
      expect(remText === '0,0 Einheiten' || remText === '—').toBe(true);
      // Duenger total: 3000 (formatted with de-DE locale).
      expect(doc.getElementById('ds_duenger_total').textContent).toContain('3.000');
      // Duenger used: 3000 (or '—' if zero-skip).
      const dUsedText = doc.getElementById('ds_duenger_used').textContent;
      expect(dUsedText.includes('3.000') || dUsedText === '—').toBe(true);
      // Duenger remaining: 0 kg (or '—').
      const dRemText = doc.getElementById('ds_duenger_remaining').textContent;
      expect(dRemText.includes('0') || dRemText === '—').toBe(true);
    });

    it('renderDrillSummary() — remaining einheiten after carryover is smaller than total need', () => {
      setupTwoTabs(w);
      // Tab 2: SOLL 5ha, IST 3ha → Ersparnis-Quelle.
      // (SOLL 9 Einheiten − IST 5,4 Einheiten = 3,6 Einheiten Ersparnis.)
      // Tab 2 wird via direct entries.push als "befüllt mit 3ha" markiert
      // (gebrauchte Einheiten = 3*90000/50000 = 5,4 → usedE=5,4, fertig via
      // Carryover-Savings). Tab 1 bleibt offen mit SOLL=18, used=0.
      w.state.reiter[1].istHektar = 3;
      w.state.reiter[1].entries.push({
        einheit: 5.4, istHektar: 3, zaehlerStand: 3, duenger: 0, time: '08:00'
      });
      w.saveState();

      // Total ohne Carryover-Konsum = 18 (Tab 1) + 5,4 (Tab 2) − 0 (used) = 23,4.
      // Tab 2 ist Ersparnis-Quelle mit 3,6 Einheiten. Nach Verteilung der
      // Ersparnis auf Tab 1 verbleiben 23,4 − 5,4 − 3,6 = 14,4.
      // Buggy single-tab-Version zeigt 18 (nur Tab 1: SOLL 18, used 0).
      w.renderResults();
      const remText = doc.getElementById('ds_saat_remaining').textContent;
      // Erwartetes Format: 'X,Y Einheiten' (formatEinheit-Round auf 1 Dezimalstelle).
      const match = remText.match(/^(\d+),(\d+) Einheiten$/);
      expect(match).not.toBeNull();
      const remValue = parseFloat(match[1] + '.' + match[2]);
      // Nach Carryover muss remaining strikt kleiner sein als totalNeed (23,4 − 5,4 = 18).
      expect(remValue).toBeLessThan(18);
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
    it('renderDrillSummary() nets carryover across tabs (Issue #302, updated for Issue #347)', () => {
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
      // ALTES Verhalten (vor #347): 28,2 E / 1.800 kg (Tab 0 self-absorbed).
      // NEUES Verhalten (nach #347): 18,6 E / 500 kg (kein Self-Absorb).
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

      // Phase A + Phase B per Issue #302 spec, MIT Netto-Saldo-Korrektur #347.
      //
      // Fix-Reihenfolge:
      //   PR #348 → Netto-Saldo in computeAllCarryovers(). Self-Absorb-Skip
      //             verhindert Doppel-Zählung in der Cross-Tab-Formel.
      //   PR #<dieser> → Folge-Bug: in renderDrillSummary() Phase A zählte
      //                  Tab 0 (Mehrbedarf-Quelle, istE=21.6 > solE=9) als
      //                  Bedarfsempfänger mit needE=9.6 (sein Restbedarf auf
      //                  IST-Fläche). Das ist konzeptuell Quellen-Mehraufwand,
      //                  nicht "zu wenig". Mit dem Mehrbedarf-Skip für Phase A
      //                  landet nur der echte Bedarf von Tab 1 (needE=9) im
      //                  totalNeedE.
      //
      // TotalNeed_E = 0 (Tab 0 ist Mehrbedarf → Skip) + (9-0) (Tab 1)
      //             = 9
      // TotalSaved_E = 0, TotalExcess_E = 0 (Tab 0 self-excess,
      //                Phase 2 verteilt 0 dank Self-Absorb-Skip #348).
      // → remEinheit = max(0, 9 - 0 + 0) = 9
      //
      // HINWEIS: Der vorherige Wert "18,6 Einheiten" (PR #348's Update)
      // entsprach dem ALTEN Phase-A-Verhalten, in dem Tab 0 als
      // Bedarfsempfänger mit 9.6 E gezählt wurde. Mit der Issue-#347-Folge-
      // Korrektur (Mehrbedarf-Tabs zählen NICHT als Bedarfsempfänger) ist
      // 9,0 der korrekte Wert.
      expect(doc.getElementById('ds_saat_remaining').textContent).toBe('9,0 Einheiten');
      // TotalNeed_D = 0 (Tab 0 Mehrbedarf) + (1000-0) (Tab 1) = 1000
      expect(doc.getElementById('ds_duenger_remaining').textContent).toBe('1.000 kg');

      // Sanity: total/used are independent of carryover.
      expect(doc.getElementById('ds_saat_total').textContent).toBe('30,6 Einheiten');
      expect(doc.getElementById('ds_saat_used').textContent).toBe('12,0 Einheiten');
      expect(doc.getElementById('ds_duenger_total').textContent).toBe('3.400 kg');
      expect(doc.getElementById('ds_duenger_used').textContent).toBe('2.000 kg');
    });
  });
});
