/**
 * Issue #336 follow-up #2: r_carryover_hint zeigt EINE aggregierte
 * Netto-Zeile über ALLE Tabs (statt der bisherigen pro-Tab-Eigen-Salden).
 *
 * Vorher (PR #337/#339): pro aktiver Tab eine eigene Ersparnis/Mehrbedarf-
 * Zeile, basierend auf den Eigen-Salden dieses Tabs.
 *
 * Nachher (dieser Fix): eine einzige aggregierte Netto-Zeile, die über ALLE
 * Tabs summiert:
 *   netE = Σ (EigenersparnisSaat jedes Tabs) − Σ (EigenmehrbedarfSaat jedes Tabs)
 *   netD = Σ (EigenersparnisDünger jedes Tabs) − Σ (EigenmehrbedarfDünger jedes Tabs)
 * Ersparnis pro Tab: nur bei istHektar > 0 && istHektar < hektar
 * Mehrbedarf pro Tab: nur bei istHektar > hektar
 *
 *   - net > 0 → grüne Zeile "Ersparnis: X Einheiten, Y kg Dünger"
 *   - net < 0 → rote Zeile "Mehrbedarf aus überschrittenen Flächen: -X, Y"
 *   - beide innerhalb ±0.05 → Zeile komplett versteckt
 *   - mixed (netE positiv, netD negativ) → zwei Zeilen
 *
 * Implementierung: public/js/render-results.js renderResultCard()
 *   - Neue Funktion renderNetCrossTabTotals() (modul-intern)
 *   - Selektoren: .net-totals-line.net-totals-savings / .net-totals-excess
 *   - KEINE Empfänger-Salden (computeAllCarryovers) im Ergebnis-Tab
 *   - KEINE Per-Tab-Zeilen (das war PR #337/#339, jetzt überschrieben)
 *   - KEIN "Übertrag aus ersparten Flächen" im Klartext
 *
 * Formeln (identisch zu _appendTabCarryoverBlocks in render-drill.js:247-248
 * und 273-274, damit die Anzeige in Maschinen-Protokoll + Ergebnis-Tab
 * dieselbe Selbst-Saldo-Summe zeigt):
 *   selfSavingsE  = getTabTotalEinheiten(t) - getTabIstEinheiten(t)    (FG-korr.)
 *   selfSavingsD  = (t.hektar - t.istHektar) * (t.duenger || 0)
 *   selfExcessE   = getTabIstEinheiten(t) - getTabTotalEinheiten(t)
 *   selfExcessD   = (t.istHektar - t.hektar) * (t.duenger || 0)
 *   selfSavings nur sinnvoll wenn t.istHektar > 0 && t.istHektar < t.hektar
 *   selfExcess   nur sinnvoll wenn t.istHektar > t.hektar
 *
 * Worked Example (User-Feedback 2026-06-23): Tabs mit gemischten
 * self-saldos so dass totalSavE − totalExcE = +1 E und +100 kg → grüne
 * Zeile "Ersparnis: 1,0 Einheiten, 100 kg Dünger".
 *
 * Threshold: 0.05 für jeden Net (Saat UND Dünger). Wenn beide Nets
 * innerhalb ±0.05 → Zeile komplett versteckt.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Issue #336 follow-up #2: Ergebnis-Tab zeigt Netto-Cross-Tab (nicht Per-Tab)', () => {
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
  function savingsLine() {
    return hintContainer().querySelector('.net-totals-savings');
  }
  function excessLine() {
    return hintContainer().querySelector('.net-totals-excess');
  }
  function sectionLabel() {
    return hintContainer().querySelector('.r-carryover-section-label');
  }
  // Carryover-Row per-Tab (PR #337/#339) ist überschrieben — der Selector
  // existiert NICHT mehr in der neuen Form. Negativ-Tests stellen sicher,
  // dass der Code nicht zurückfällt.
  function oldSavingsRow() {
    return hintContainer().querySelector('.r-carryover-savings');
  }
  function oldExcessRow() {
    return hintContainer().querySelector('.r-carryover-excess');
  }

  // ── Worked Example (User-Feedback 2026-06-23) ─────────────────────────
  // User-Beispiel: "im Beispiel wären es 1 Einheit und 100 kg Ersparnis"
  // → totalSav − totalExc = +1 E, +100 kg → grüne Netto-Zeile.
  // Konkretes Setup: Tab 1 hat 10 ha SOLL, 9,5 IST (0,5 ha Ersparnis →
  //   0,5 E, 50 kg). Tab 2 hat 5 ha SOLL, 6 IST (1 ha Mehrbedarf → 1 E,
  //   100 kg). Andere Tabs neutral. Σ sav = 0,5 E + 50 kg,
  //   Σ exc = 1 E + 100 kg. Net = −0,5 E, −50 kg → rote Mehrbedarfs-Zeile.
  //   (Der User sagt "1 Einheit und 100 kg Ersparnis" — also ein
  //   überwiegend-savings Setup, z.B. Tab 1 mit 10 ha SOLL, 9 IST
  //   (1 E, 100 kg) und Tab 2 mit 5 ha SOLL, 5 IST → neutral. Dann
  //   Net = +1 E, +100 kg → grüne Zeile. Wir testen diesen Fall.)

  it('Worked Example: Tab 1 (10/9, istHektar=9) + Tab 2 (5/5) → "Ersparnis: 1,0 Einheiten, 100 kg Dünger"', () => {
    w.addReiter();
    // Tab 0: SOLL 10, IST 9 → 1 E und 100 kg savings
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 9, koerner: 50000, duenger: 100, entries: []
    };
    // Tab 1: SOLL 5, IST 5 → neutral
    w.state.reiter[1] = {
      ...w.state.reiter[1],
      hektar: 5, istHektar: 5, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();

    const s = savingsLine();
    expect(s).not.toBeNull();
    expect(s.classList.contains('net-totals-line')).toBe(true);
    expect(s.classList.contains('net-totals-savings')).toBe(true);
    expect(s.textContent).toContain('Ersparnis');
    expect(s.textContent).toContain('1,0');
    expect(s.textContent).toContain('Einheiten');
    expect(s.textContent).toContain('100');
    expect(s.textContent).toContain('kg Dünger');
    expect(excessLine()).toBeNull();
  });

  // ── Aggregations-Logik ────────────────────────────────────────────────

  it('Cross-Tab: Tab 0 savings + Tab 1 excess → Net kann negativ sein (Mehrbedarf-Zeile)', () => {
    w.addReiter();
    // Tab 0: SOLL 10, IST 9.5 → 0,5 E savings, 50 kg savings
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 9.5, koerner: 50000, duenger: 100, entries: []
    };
    // Tab 1: SOLL 5, IST 6 → 1 E excess, 100 kg excess
    w.state.reiter[1] = {
      ...w.state.reiter[1],
      hektar: 5, istHektar: 6, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();

    // Σ savE = 0,5, Σ excE = 1,0 → netE = −0,5
    // Σ savD = 50, Σ excD = 100 → netD = −50
    const e = excessLine();
    expect(e).not.toBeNull();
    expect(e.classList.contains('net-totals-line')).toBe(true);
    expect(e.classList.contains('net-totals-excess')).toBe(true);
    expect(e.textContent).toContain('Mehrbedarf');
    // 0,5 E und 50 kg → als positive Werte im "Mehrbedarf" angezeigt
    expect(e.textContent).toContain('0,5');
    expect(e.textContent).toContain('50');
    expect(savingsLine()).toBeNull();
  });

  it('Mixed per-Material: netE positiv, netD negativ → ZWEI Zeilen (savings + excess)', () => {
    w.addReiter();
    // Tab 0: SOLL 10, IST 9, duenger=0 → 1 E savings, 0 kg savings
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 9, koerner: 50000, duenger: 0, entries: []
    };
    // Tab 1: SOLL 5, IST 5, duenger=100 → neutral in Saat, 0 in Dünger
    w.state.reiter[1] = {
      ...w.state.reiter[1],
      hektar: 5, istHektar: 5, koerner: 50000, duenger: 100, entries: []
    };
    w.state.reiter[1].entries.push({ einheit: 5, zaehlerStand: 5, duenger: 0, time: '08:00' });
    // Tab 2: SOLL 5, IST 6, duenger=100 → 1 E excess, 100 kg excess
    w.state.reiter[2] = {
      ...w.state.reiter[2],
      hektar: 5, istHektar: 6, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();

    // Σ savE = 1, Σ excE = 1 → netE = 0 (< 0.05)
    // Σ savD = 0, Σ excD = 100 → netD = -100
    // → nur Mehrbedarf-Zeile (netE ist 0)
    const e = excessLine();
    expect(e).not.toBeNull();
    expect(e.textContent).toContain('100');
    expect(savingsLine()).toBeNull();
  });

  it('Threshold ±0.05: beide Nets unter Schwelle → komplett versteckt', () => {
    w.addReiter();
    // Tab 0: SOLL 8, IST 7.99 → 0,01 E savings, 1 kg savings (savingsD
    // > 0.05 wenn duenger=100; nutzen wir duenger=0)
    // 0,01 E (< 0.05), 0 kg (= 0, < 0.05)
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 8, istHektar: 7.99, koerner: 50000, duenger: 0, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    // Keine savings-Zeile (Wert < 0.05), keine excess-Zeile, kein Label
    expect(savingsLine()).toBeNull();
    expect(excessLine()).toBeNull();
    expect(sectionLabel()).toBeNull();
  });

  it('Threshold: exakt 0.05 wird NICHT angezeigt (strikt >)', () => {
    // Tab 0: SOLL 8, IST 7.99999, duenger=0 → 0,00001 E < 0.05, 0 kg
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 8, istHektar: 7.99999, koerner: 50000, duenger: 0, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    expect(savingsLine()).toBeNull();
  });

  // ── Tab-Iteration ─────────────────────────────────────────────────────

  it('Multi-Tab: aggregiert über ALLE reiter (nicht nur active)', () => {
    w.addReiter();
    w.addReiter();
    // Tab 0: SOLL 10, IST 8 → 2 E, 200 kg savings
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 8, koerner: 50000, duenger: 100, entries: []
    };
    // Tab 1: SOLL 10, IST 8 → 2 E, 200 kg savings
    w.state.reiter[1] = {
      ...w.state.reiter[1],
      hektar: 10, istHektar: 8, koerner: 50000, duenger: 100, entries: []
    };
    // Tab 2: SOLL 5, IST 5 → neutral
    w.state.reiter[2] = {
      ...w.state.reiter[2],
      hektar: 5, istHektar: 5, koerner: 50000, duenger: 100, entries: []
    };
    // Switch zu Tab 2 (neutral) — Aggregation muss trotzdem alle Tabs
    // umfassen, nicht nur den aktiven.
    w.state.activeReiter = 2;
    w.renderResults();
    // Σ savE = 4, Σ savD = 400
    const s = savingsLine();
    expect(s).not.toBeNull();
    expect(s.textContent).toContain('4,0');
    expect(s.textContent).toContain('400');
  });

  it('Tab ohne istHektar (istHektar=0) trägt nichts bei', () => {
    w.addReiter();
    // Tab 0: SOLL 10, IST 0 → keine savings (nur sinnvoll bei istHektar > 0)
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 0, koerner: 50000, duenger: 100, entries: []
    };
    // Tab 1: SOLL 5, IST 5 → neutral
    w.state.reiter[1] = {
      ...w.state.reiter[1],
      hektar: 5, istHektar: 5, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    // Tab 0 zählt nicht (istHektar=0); Tab 1 neutral → keine Zeile
    expect(savingsLine()).toBeNull();
    expect(excessLine()).toBeNull();
  });

  it('Single Tab mit IST<SOLL: verhält sich wie das Worked Example', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 9, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    const s = savingsLine();
    expect(s).not.toBeNull();
    expect(s.textContent).toContain('1,0');
    expect(s.textContent).toContain('100');
    expect(s.classList.contains('net-totals-savings')).toBe(true);
    expect(excessLine()).toBeNull();
  });

  it('Single Tab mit IST>SOLL: verhält sich wie Mehrbedarf (negativer Net)', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 8, istHektar: 10, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    const e = excessLine();
    expect(e).not.toBeNull();
    expect(e.textContent).toContain('2,0');
    expect(e.textContent).toContain('200');
    expect(e.classList.contains('net-totals-excess')).toBe(true);
    expect(savingsLine()).toBeNull();
  });

  // ── Negativ-Tests: alte Per-Tab-Shape weg ─────────────────────────────

  it('Negativ: KEINE r-carryover-savings / r-carryover-excess Per-Tab-Zeilen', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 9, koerner: 50000, duenger: 100, entries: []
    };
    w.state.reiter[1] = {
      ...w.state.reiter[1],
      hektar: 5, istHektar: 5, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    // Per-Tab-Selectoren (PR #337/#339) dürfen NICHT mehr matchen.
    expect(oldSavingsRow()).toBeNull();
    expect(oldExcessRow()).toBeNull();
    // "Abweichung dieses Tabs" Section-Label wurde ebenfalls ersatzlos
    // gestrichen (Cross-Tab-Aggregation braucht kein Per-Tab-Label).
    expect(sectionLabel()).toBeNull();
  });

  it('Negativ: kein "Übertrag" im Klartext (kein Receiver-Saldo)', () => {
    w.addReiter();
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 8, koerner: 50000, duenger: 100, entries: []
    };
    w.state.reiter[0].entries.push({ einheit: 8, zaehlerStand: 8, duenger: 800, time: '08:00' });
    // Tab 1: not done, neutral → wäre Empfänger
    w.state.reiter[1] = {
      ...w.state.reiter[1],
      hektar: 10, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 1;
    w.renderResults();
    // Auch wenn computeAllCarryovers() intern etwas zuweist, zeigt der
    // Ergebnis-Tab KEINEN Empfänger-Saldo ("Übertrag"). Ersparnis ist
    // hier die Cross-Tab-Aggregation (kein Receiver-Saldo), das ist
    // explizit gewollt.
    expect(hintContainer().textContent).not.toContain('Übertrag');
    // Tab 0 ist die einzige Tab mit IST<SOLL → 2 E + 200 kg savings (Net)
    // Aber activeReiter = 1: der Hint aggregiert trotzdem ÜBER ALLE Tabs.
    // → Savings-Zeile sichtbar (2 E + 200 kg)
    const s = savingsLine();
    expect(s).not.toBeNull();
    expect(s.textContent).toContain('2,0');
    expect(s.textContent).toContain('200');
  });

  it('Negativ: keine alten .carryover-hint / .excess-hint Klassen', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 9, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    expect(hintContainer().querySelectorAll('.carryover-hint').length).toBe(0);
    expect(hintContainer().querySelectorAll('.excess-hint').length).toBe(0);
  });

  // ── Re-Render Hygiene ─────────────────────────────────────────────────

  it('Re-Render: keine stale children aus vorherigem Render', () => {
    w.addReiter();
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 9, koerner: 50000, duenger: 100, entries: []
    };
    w.state.reiter[1] = {
      ...w.state.reiter[1],
      hektar: 5, istHektar: 5, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    expect(hintContainer().children.length).toBeGreaterThan(0);
    // Switch auf einen neutralen Tab → Hint muss leer sein, KEINE
    // Überreste.
    w.state.reiter[0] = {
      ...w.state.reiter[0],
      hektar: 10, istHektar: 10, koerner: 50000, duenger: 100, entries: []
    };
    w.renderResults();
    // Σ savE = 0, Σ excE = 0, Σ savD = 0, Σ excD = 0 → komplett leer
    expect(savingsLine()).toBeNull();
    expect(excessLine()).toBeNull();
    expect(hintContainer().children.length).toBe(0);
  });
});
