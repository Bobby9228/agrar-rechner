/**
 * Tests for Issue #368 — Carryover-Netting: pro-rata → sequenziell.
 *
 * Carryover-Regel 2: Wenn die verfügbaren Ersparnisse nicht für alle
 * Mehrbedarf-Tabs reichen, erfolgt die Netting-Abdeckung SEQUENZIELL nach
 * Bearbeitungs-Reihenfolge (parseEntryTime(lastEntry.time) aufsteigend).
 * Das zuerst bearbeitete Feld wird KOMPLETT abgedeckt, dann das nächste,
 * bis die Ersparnis aufgebraucht ist. Tiebreaker gleicher time:
 * Tab-Index aufsteigend (deterministisch).
 *
 * Konkretes Beispiel:
 *   Tab 1: 10 ha SOLL 20 E, 9 ha IST → Ersparnis 2 E (Saat-Quelle)
 *   Tab 2: 7,5 ha SOLL 15 E, 8 ha IST → Mehrbedarf 1 E (time 09:00, FIRST)
 *   Tab 3: 7,5 ha SOLL 15 E, 8 ha IST → Mehrbedarf 1 E (time 10:00, LATER)
 *   totalSaved = 2 E, totalExcess = 2 E → pool = 2 E
 *
 *   Erwartet (sequenziell):
 *     Tab 2 nettedEinheit = 1 (komplett, erste Quelle, pool ≥ ihr Bedarf)
 *     Tab 3 nettedEinheit = 1 (komplett, zweite Quelle, pool-rest = 1 ≥ 1)
 *     Summe nettedEinheit = 2 E
 *
 *   Vor #368 (pro-rata): Tab 2 = 1 E, Tab 3 = 1 E (passt hier zufällig, weil
 *   2 Mehrbedarf-Tabs à 1 E exakt 2 E Pool aufbrauchen).
 *
 * Schärferer Test (pool < 2*excess):
 *   Tab 1: 10 ha SOLL 20 E, 9 ha IST → Ersparnis 2 E
 *   Tab 2: 7,5 ha SOLL 15 E, 8 ha IST → Mehrbedarf 2 E (time 09:00, FIRST)
 *   Tab 3: 7,5 ha SOLL 15 E, 8 ha IST → Mehrbedarf 2 E (time 10:00, LATER)
 *   totalSaved = 2 E, totalExcess = 4 E → pool = 2 E
 *
 *   Erwartet (sequenziell):
 *     Tab 2 nettedEinheit = 2 (komplett, erste Quelle)
 *     Tab 3 nettedEinheit = 0 (nichts mehr übrig)
 *
 *   Vor #368 (pro-rata): Tab 2 = 1, Tab 3 = 1 (BUG).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Sequenzielle Carryover-Netting (Issue #368)', () => {
  let w;

  beforeEach(() => {
    const result = createDom();
    w = result.window;
  });

  // ── Scharfes Szenario: pool < 2 × excess ───────────────────────────────
  //
  // Tab 1 (10/9 ha): Ersparnis 2 E Saat + 200 kg Dünger.
  // Tab 2 (7/8 ha): Mehrbedarf 2 E Saat + 200 kg Dünger (time 09:00, FIRST).
  // Tab 3 (7/8 ha): Mehrbedarf 2 E Saat + 200 kg Dünger (time 10:00, LATER).
  // totalSaved = 2 E / 200 kg. totalExcess = 4 E / 400 kg → pool = 2 E / 200 kg.
  //
  // Erwartet (sequenziell nach Bearbeitungs-Reihenfolge):
  //   Tab 2 nettedEinheit = 2  (komplett, erste Quelle, pool ≥ sein Bedarf)
  //   Tab 3 nettedEinheit = 0  (Pool leer nach Tab 2)
  //
  // Vor #368 (pro-rata): Tab 2 = 1, Tab 3 = 1 (BUG).
  function setupPoolKleinerAlsExcess() {
    w.state.koernerProEinheit = 50000;
    w.state.reiter[0] = {
      name: 'Acker 1', hektar: 10, istHektar: 9, koerner: 100000, duenger: 200,
      entries: [{ einheit: 18, duenger: 1800, time: '08:00' }],
      fahrgassenEnabled: false, fahrgassenBreite: 0
    };
    w.state.reiter[1] = {
      name: 'Acker 2', hektar: 7, istHektar: 8, koerner: 100000, duenger: 200,
      entries: [{ einheit: 14, duenger: 1400, time: '09:00' }],
      fahrgassenEnabled: false, fahrgassenBreite: 0
    };
    w.state.reiter[2] = {
      name: 'Acker 3', hektar: 7, istHektar: 8, koerner: 100000, duenger: 200,
      entries: [{ einheit: 14, duenger: 1400, time: '10:00' }],
      fahrgassenEnabled: false, fahrgassenBreite: 0
    };
    if (w.invalidateCarryoverCache) w.invalidateCarryoverCache();
  }

  it('Tab 2 (FIRST Mehrbedarf, 09:00) wird komplett abgedeckt: nettedEinheit === 2', () => {
    setupPoolKleinerAlsExcess();
    const co = w.getCarryover(1);
    expect(co.nettedEinheit).toBe(2);
  });

  it('Tab 3 (LATER Mehrbedarf, 10:00) bekommt nichts mehr: nettedEinheit === 0', () => {
    setupPoolKleinerAlsExcess();
    const co = w.getCarryover(2);
    expect(co.nettedEinheit).toBe(0);
  });

  it('Summe nettedEinheit über beide Mehrbedarf-Tabs === 2 (Pool-Größe, nicht 4)', () => {
    setupPoolKleinerAlsExcess();
    const sum = w.getCarryover(1).nettedEinheit + w.getCarryover(2).nettedEinheit;
    expect(sum).toBe(2);
  });

  it('Tab 2 ist done (Mehrbedarf voll abgedeckt), Tab 3 nicht (Mehrbedarf offen)', () => {
    setupPoolKleinerAlsExcess();
    expect(w.isTabDone(w.state.reiter[1], 1)).toBe(true);
    expect(w.isTabDone(w.state.reiter[2], 2)).toBe(false);
  });

  // ── Dünger: separater Pool, gleiche sequenzielle Regel ─────────────────
  it('Dünger-Pool identisch sequenziell: Tab 2 nettedDuenger === 200, Tab 3 === 0', () => {
    setupPoolKleinerAlsExcess();
    // Ersparnis Tab 1 = 200 kg (sol=2000, ist=1800). Mehrbedarf Tab 2+3 = je 200 kg.
    // Pool = 200. Erwartet: Tab 2 voll (200), Tab 3 leer (0).
    expect(w.getCarryover(1).nettedDuenger).toBe(200);
    expect(w.getCarryover(2).nettedDuenger).toBe(0);
  });

  // ── Edge: Tab-Reihenfolge ≠ time-Reihenfolge (Tab 3 first entry time ist später)
  //   Hier hat Tab 2 time 11:00, Tab 3 time 09:00.
  //   Sequenziell nach time: Tab 3 zuerst voll, Tab 2 leer.
  it('Reihenfolge folgt lastEntry.time aufsteigend, NICHT Tab-Index', () => {
    w.state.koernerProEinheit = 50000;
    w.state.reiter[0] = {
      name: 'Q', hektar: 10, istHektar: 9, koerner: 100000, duenger: 200,
      entries: [{ einheit: 18, duenger: 1800, time: '08:00' }],
      fahrgassenEnabled: false, fahrgassenBreite: 0
    };
    // Tab B (idx 1) hat SPÄTERE time (11:00), Tab C (idx 2) hat FRÜHERE time (09:00).
    // Sequenziell: Tab C (09:00) zuerst voll, Tab B (11:00) leer.
    // Ersparnis 2 E, Mehrbedarf je 2 E → pool = 2.
    w.state.reiter[1] = {
      name: 'B', hektar: 7, istHektar: 8, koerner: 100000, duenger: 200,
      entries: [{ einheit: 14, duenger: 1400, time: '11:00' }],
      fahrgassenEnabled: false, fahrgassenBreite: 0
    };
    w.state.reiter[2] = {
      name: 'C', hektar: 7, istHektar: 8, koerner: 100000, duenger: 200,
      entries: [{ einheit: 14, duenger: 1400, time: '09:00' }],
      fahrgassenEnabled: false, fahrgassenBreite: 0
    };
    if (w.invalidateCarryoverCache) w.invalidateCarryoverCache();
    expect(w.getCarryover(1).nettedEinheit).toBe(0);  // Tab B (11:00) später
    expect(w.getCarryover(2).nettedEinheit).toBe(2);  // Tab C (09:00) früher
  });

  // ── Edge: gleiche time → Tiebreaker Tab-Index aufsteigend ──────────────
  it('Tiebreaker gleicher time: niedrigerer Tab-Index zuerst', () => {
    w.state.koernerProEinheit = 50000;
    w.state.reiter[0] = {
      name: 'Q', hektar: 10, istHektar: 9, koerner: 100000, duenger: 200,
      entries: [{ einheit: 18, duenger: 1800, time: '08:00' }],
      fahrgassenEnabled: false, fahrgassenBreite: 0
    };
    // Tab B (idx 1, time 09:00), Tab C (idx 2, time 09:00). Bei gleicher time: Tab B zuerst.
    // Ersparnis 2 E, Mehrbedarf je 2 E → pool = 2. Tab B bekommt 2 (komplett), Tab C leer.
    w.state.reiter[1] = {
      name: 'B', hektar: 7, istHektar: 8, koerner: 100000, duenger: 200,
      entries: [{ einheit: 14, duenger: 1400, time: '09:00' }],
      fahrgassenEnabled: false, fahrgassenBreite: 0
    };
    w.state.reiter[2] = {
      name: 'C', hektar: 7, istHektar: 8, koerner: 100000, duenger: 200,
      entries: [{ einheit: 14, duenger: 1400, time: '09:00' }],
      fahrgassenEnabled: false, fahrgassenBreite: 0
    };
    if (w.invalidateCarryoverCache) w.invalidateCarryoverCache();
    expect(w.getCarryover(1).nettedEinheit).toBe(2);
    expect(w.getCarryover(2).nettedEinheit).toBe(0);
  });

  // ── Edge: pool exakt = totalExcess → alle voll abgedeckt ───────────────
  it('Pool === totalExcess (2 Mehrbedarf-Tabs à 1E, 2E Pool): beide voll', () => {
    w.state.koernerProEinheit = 50000;
    w.state.reiter[0] = {
      name: 'Q', hektar: 10, istHektar: 9, koerner: 100000, duenger: 200,
      entries: [{ einheit: 18, duenger: 1800, time: '08:00' }],
      fahrgassenEnabled: false, fahrgassenBreite: 0
    };
    // 7.5/8 ha → Mehrbedarf 1 E. totalExcess = 2 E, totalSaved = 2 E → pool = 2.
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
    expect(w.getCarryover(1).nettedEinheit).toBe(1);
    expect(w.getCarryover(2).nettedEinheit).toBe(1);
  });

  // ── Render-Site-Konsistenz: Tab 2 (done) zeigt 0, Tab 3 (offen) zeigt 2 ──
  it('getTabRemaining: Tab 2 === 0, Tab 3 === 2 (Mehrbedarf offen)', () => {
    setupPoolKleinerAlsExcess();
    const rem2 = w.getTabRemaining(w.state.reiter[1], 1);
    const rem3 = w.getTabRemaining(w.state.reiter[2], 2);
    expect(rem2.remainingE).toBe(0);
    expect(rem3.remainingE).toBe(2);
  });
});
