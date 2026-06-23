/**
 * Issue #336 follow-up: Im Ergebnis-Tab sollen nur die SELBST-Salden
 * (Ersparnis + Mehrbedarf) des aktiven Tabs gezeigt werden, NICHT der
 * Übertrag-Empfänger-Saldo aus computeAllCarryovers(). Begründung: User
 * will nur sehen "was habe ich auf diesem Tab gespart oder mehr gebraucht"
 * — keine Cross-Tab-Verrechnung in der UI. Das Maschinen-Protokoll
 * (_appendTabCarryoverBlocks in render-drill.js) bleibt unverändert.
 *
 * Konkretes Szenario: 3 Tabs mit soll=10/7,5/5 ha, ist=9/7,5/5 ha →
 * User sieht in Tab 1 nur "Abweichung dieses Tabs / Ersparnis: 1 ha ..."
 * ohne dass intern ein Carryover-Verteil-Saldo angezeigt wird.
 *
 * Implementierung: public/js/render-results.js (renderResultCard, ~Z. 64-148)
 *   - Section-Label: "Abweichung dieses Tabs" (nicht mehr "Carryover ... ohne Verrechnung")
 *   - Zeilen: .r-carryover-row.r-carryover-savings / .r-carryover-excess
 *   - KEINE Übertrag-Zeile (auch wenn computeAllCarryovers noch läuft)
 *   - KEINE Cross-Tab-Verrechnung in der UI — die App-Logik dahinter ist unangetastet.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('Issue #336 follow-up: kein Übertrag-Empfänger-Saldo im Ergebnis-Tab', () => {
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
  function excessRow() {
    return hintContainer().querySelector('.r-carryover-excess');
  }
  // Carryover-Row ist absichtlich entfernt — der Selector existiert nur als
  // Negativ-Test. Wenn der Code zurückfällt, schlägt jeder Test fehl, der
  // diesen Selector benutzt.
  function carryoverRow() {
    return hintContainer().querySelector('.r-carryover-carryover');
  }
  function sectionLabel() {
    return hintContainer().querySelector('.r-carryover-section-label');
  }
  function hintText() {
    const h = hintContainer();
    return h ? h.textContent : '';
  }

  // ── 3-Tab-Szenario aus dem User-Feedback ───────────────────────────────

  it('3 Tabs (10/7,5/5 soll, 9/7,5/5 ist): Tab 1 zeigt nur "Ersparnis", Tab 2 und 3 sind leer', () => {
    w.addReiter();
    w.addReiter();
    // Tab 0: SOLL=10, IST=9 → Ersparnis 1 ha
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 10, istHektar: 9, koerner: 50000, duenger: 100, entries: []
    };
    // Tab 1: SOLL=7.5, IST=7.5 → keine Abweichung
    w.state.reiter[1] = {
      ...w.state.reiter[1], hektar: 7.5, istHektar: 7.5, koerner: 50000, duenger: 100, entries: []
    };
    // Tab 2: SOLL=5, IST=5 → keine Abweichung
    w.state.reiter[2] = {
      ...w.state.reiter[2], hektar: 5, istHektar: 5, koerner: 50000, duenger: 100, entries: []
    };

    // Tab 0 prüfen: "Abweichung dieses Tabs" + "Ersparnis: ..." sichtbar
    w.state.activeReiter = 0;
    w.renderResults();
    expect(sectionLabel()).not.toBeNull();
    expect(sectionLabel().textContent).toContain('Abweichung dieses Tabs');
    expect(savingsRow()).not.toBeNull();
    expect(savingsRow().textContent).toContain('Ersparnis');
    // 1 ha Ersparnis bei 50000 Koerner/ha = 50000 Koerner = 1,0 Einheiten Saatgut
    expect(savingsRow().textContent).toContain('1,0');
    expect(savingsRow().textContent).toContain('Einheiten Saatgut');
    // 1 ha × 100 kg/ha → 100 kg Dünger
    expect(savingsRow().textContent).toContain('100');
    expect(savingsRow().textContent).toContain('kg Dünger');
    // KEINE Mehrbedarf-Zeile (Tab 0 hat IST<SOLL)
    expect(excessRow()).toBeNull();
    // KEINE Übertrag-Zeile (auch wenn intern ein Carryover-Verteil-Saldo existieren würde)
    expect(carryoverRow()).toBeNull();
    // Negativ-Assertion auf Klartext: kein "Übertrag" in der UI sichtbar
    expect(hintText()).not.toContain('Übertrag');

    // Tab 1: IST=SOLL → komplett leer
    w.state.activeReiter = 1;
    w.renderResults();
    expect(sectionLabel()).toBeNull();
    expect(savingsRow()).toBeNull();
    expect(excessRow()).toBeNull();
    expect(carryoverRow()).toBeNull();
    expect(hintText()).not.toContain('Übertrag');

    // Tab 2: IST=SOLL → komplett leer
    w.state.activeReiter = 2;
    w.renderResults();
    expect(sectionLabel()).toBeNull();
    expect(savingsRow()).toBeNull();
    expect(excessRow()).toBeNull();
    expect(carryoverRow()).toBeNull();
    expect(hintText()).not.toContain('Übertrag');
  });

  // ── Negativ-Test: auch wenn andere Tabs theoretisch als Carryover-Quelle dienen könnten ──

  it('zeigt keine Übertrag-Zeile wenn ein anderer Tab IST<SOLL hat (Tab-Empfänger)', () => {
    w.addReiter();
    // Tab 0: SOLL=10, IST=9 → savings source (würde intern Carryover an Tab 1 spenden)
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 10, istHektar: 9, koerner: 50000, duenger: 100, entries: []
    };
    // Tab 1: SOLL=10, kein IST → wäre der Empfänger des Carryovers
    w.state.reiter[1] = {
      ...w.state.reiter[1], hektar: 10, koerner: 50000, duenger: 100, entries: []
    };
    // App-Logik läuft: computeAllCarryovers() würde Tab 1 etwas zuweisen.
    // Aber: in der UI darf KEIN Übertrag-Empfänger-Saldo erscheinen.
    w.state.activeReiter = 1;
    w.renderResults();
    // Tab 1 hat kein istHektar → keine Abweichung, keine Section.
    expect(sectionLabel()).toBeNull();
    expect(savingsRow()).toBeNull();
    expect(excessRow()).toBeNull();
    expect(carryoverRow()).toBeNull();
    expect(hintText()).not.toContain('Übertrag');
  });

  // ── Negativ-Test: Section-Label umbenannt ──────────────────────────────

  it('Section-Label heißt "Abweichung dieses Tabs", nicht "Carryover dieses Tabs"', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 8, istHektar: 7, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    const label = sectionLabel();
    expect(label).not.toBeNull();
    expect(label.textContent).toBe('Abweichung dieses Tabs');
    // Alttext "Carryover dieses Tabs" muss weg sein.
    expect(label.textContent).not.toContain('Carryover');
  });

  // ── Mehrbedarf bleibt funktional ───────────────────────────────────────

  it('zeigt "Mehrbedarf" weiterhin korrekt wenn IST>SOLL', () => {
    w.state.reiter[0] = {
      ...w.state.reiter[0], hektar: 8, istHektar: 10, koerner: 50000, duenger: 100, entries: []
    };
    w.state.activeReiter = 0;
    w.renderResults();
    const e = excessRow();
    expect(e).not.toBeNull();
    expect(e.textContent).toContain('Mehrbedarf');
    // 2 ha × 50000 Körner/ha = 100.000 Körner = 2 Einheiten Saatgut
    expect(e.textContent).toContain('2,0');
    expect(e.textContent).toContain('Einheiten Saatgut');
    // 2 ha × 100 kg/ha = 200 kg Dünger
    expect(e.textContent).toContain('200');
    expect(e.textContent).toContain('kg Dünger');
    expect(savingsRow()).toBeNull();
    expect(carryoverRow()).toBeNull();
    expect(hintText()).not.toContain('Übertrag');
  });
});
