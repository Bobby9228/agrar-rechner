/**
 * Issue #446 Welle 2b — Tablist-/Tab-Pattern A11y.
 *
 * Vereinheitlichung der Schlag-Leiste (#tab_bar_left) nach dem
 * WAI-ARIA-Authoring-Practices „Tabs Pattern":
 *   - role="tablist" auf dem Container, aria-label="Schläge"
 *   - role="tab" auf jedem Reiter, aria-selected + tabindex je nach Aktiv-State
 *   - KEIN role="tabpanel"/aria-controls (bewusst — siehe Kommentar im
 *     render-tabs.js: die Reiter wechseln den aktiven Schlag, nicht
 *     1:1-Panels im Sinne des ARIA-Tab-Musters; ein aria-controls wäre
 *     irreführend)
 *   - Pfeiltasten / Home / End bewegen Fokus UND Auswahl (automatic
 *     activation — die Reiter wechseln sofort die Ansicht, das passt
 *     zum UX-Flow)
 *   - Fokus-Restore nach re-render, aber nur wenn Fokus vorher auf
 *     einem .tab-btn lag (kein Klauen aus Input-Feldern)
 *
 * Bewusst NICHT in dieser Welle: Modale/Sheet-A11y (Welle 1, eigene Suite),
 * Live-Region Save-Banner, Drill-Priorität-Beschriftungen,
 * Notizen-Fokusstil.
 *
 * Eigene Datei statt Anbau an tests/tab-management.test.js:
 *   - tab-management.test.js ist „Struktur + Logik" (add/remove/switch/rename);
 *     ein eigener Suite-Titel macht die Welle-Zuordnung (#446 Welle 2b)
 *     sofort sichtbar.
 *   - Parallele zu tests/dialog-accessibility.test.js (Welle 1) — gleicher
 *     thematischer Schnitt, gleiche Schlankheit.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

function fireKey(el, key, opts) {
  opts = opts || {};
  var evt = new el.ownerDocument.defaultView.KeyboardEvent('keydown', {
    key: key,
    bubbles: true,
    cancelable: true,
    shiftKey: !!opts.shiftKey,
  });
  el.dispatchEvent(evt);
  return evt;
}

describe('Issue #446 Welle 2b — Tablist-/Tab-Pattern A11y', () => {
  describe('Markup & ARIA-Rollen', () => {
    let w, doc;
    beforeEach(function() {
      const dom = createDom();
      w = dom.window;
      doc = w.document;
    });

    it('#tab_bar_left hat role="tablist" + aria-label="Schläge" nach renderTabs()', () => {
      var bar = doc.getElementById('tab_bar_left');
      // Rolle auf der strukturell passenden Leiste (die .field-tab Reiter +
      // +Tab-Action enthält). #tab_bar wäre der gemeinsame Container aus
      // Schlag-Reitern UND Protokoll-Toggle, der nicht zum tablist-Pattern
      // passt — Protokoll ist View-Toggle, kein Schlag-Reiter. Begruendung
      // steht im render-tabs.js Header-Kommentar.
      expect(bar.getAttribute('role')).toBe('tablist');
      expect(bar.getAttribute('aria-label')).toBe('Schläge');
    });

    it('role="tablist" ist idempotent (zweimal renderTabs() aendert nichts)', () => {
      w.renderTabs();
      var bar = doc.getElementById('tab_bar_left');
      expect(bar.getAttribute('role')).toBe('tablist');
      w.renderTabs();
      expect(bar.getAttribute('role')).toBe('tablist');
      expect(bar.getAttribute('aria-label')).toBe('Schläge');
    });

    it('jede .field-tab hat role="tab"', () => {
      w.addReiter();
      w.renderTabs();
      var tabs = doc.querySelectorAll('.tab-btn.field-tab');
      expect(tabs.length).toBe(2);
      tabs.forEach(function(t) {
        expect(t.getAttribute('role')).toBe('tab');
      });
    });

    it('aktiver Schlag: aria-selected=true und tabindex=0', () => {
      w.addReiter(); // active = 1
      var btns = doc.querySelectorAll('.tab-btn.field-tab');
      expect(btns.length).toBe(2);
      expect(btns[0].getAttribute('aria-selected')).toBe('false');
      expect(btns[0].getAttribute('tabindex')).toBe('-1');
      expect(btns[1].getAttribute('aria-selected')).toBe('true');
      expect(btns[1].getAttribute('tabindex')).toBe('0');
    });

    it('bei 3 Schlagen: alle drei Positionen pruefen', () => {
      w.addReiter();
      w.addReiter(); // active = 2
      var btns = doc.querySelectorAll('.tab-btn.field-tab');
      expect(btns.length).toBe(3);
      expect(btns[0].getAttribute('aria-selected')).toBe('false');
      expect(btns[0].getAttribute('tabindex')).toBe('-1');
      expect(btns[1].getAttribute('aria-selected')).toBe('false');
      expect(btns[1].getAttribute('tabindex')).toBe('-1');
      expect(btns[2].getAttribute('aria-selected')).toBe('true');
      expect(btns[2].getAttribute('tabindex')).toBe('0');
    });

    it('KEIN aria-controls auf Schlag-Reitern (bewusst, siehe render-tabs.js Kommentar)', () => {
      w.addReiter();
      var btns = doc.querySelectorAll('.tab-btn.field-tab');
      btns.forEach(function(b) {
        expect(b.hasAttribute('aria-controls')).toBe(false);
      });
      // Hinweis: role="tabpanel" existiert im Projekt an anderer Stelle
      // (render-local-protocol, Protokoll-Action-Sheet) — diese Panels sind
      // NICHT durch Schlag-Reiter kontrolliert, sondern eigene Sub-Patterns.
      // Wir pruefen hier nur, dass die Schlag-Reiter KEIN aria-controls auf
      // irgendetwas zeigen (sonst waere die ARIA-Beziehung inkonsistent).
    });

    it('.active-Klasse aus Welle 1+ bleibt erhalten (visuelle Rueckwaertskompat.)', () => {
      w.addReiter(); // active = 1
      var btns = doc.querySelectorAll('.tab-btn.field-tab');
      expect(btns[1].classList.contains('active')).toBe(true);
      expect(btns[0].classList.contains('active')).toBe(false);
    });
  });

  describe('Tastatursteuerung — ArrowKeys + Home/End', () => {
    let w, doc;
    beforeEach(function() {
      const dom = createDom();
      w = dom.window;
      doc = w.document;
      w.addReiter(); // 2 tabs
      w.addReiter(); // 3 tabs, active = 2
    });

    it('ArrowRight auf aktivem Tab → Fokus und activeReiter auf naechsten Schlag', () => {
      var btns = doc.querySelectorAll('.tab-btn.field-tab');
      expect(btns.length).toBe(3);
      btns[2].focus();
      expect(doc.activeElement).toBe(btns[2]);
      fireKey(btns[2], 'ArrowRight');
      // active war 2 → naechster ist 0 (wrap-around)
      expect(w.state.activeReiter).toBe(0);
      // Nach switchReiter + renderTabs: Fokus auf neuem aktiven Reiter
      var newBtns = doc.querySelectorAll('.tab-btn.field-tab');
      expect(doc.activeElement).toBe(newBtns[0]);
    });

    it('ArrowRight mittig: aktiv auf 1 → 2 (kein wrap)', () => {
      w.switchReiter(1); // active = 1
      var btns = doc.querySelectorAll('.tab-btn.field-tab');
      // Re-render: jetzt sind die buttons neu, aber selber Index
      btns = doc.querySelectorAll('.tab-btn.field-tab');
      btns[1].focus();
      fireKey(btns[1], 'ArrowRight');
      expect(w.state.activeReiter).toBe(2);
      var newBtns = doc.querySelectorAll('.tab-btn.field-tab');
      expect(doc.activeElement).toBe(newBtns[2]);
    });

    it('ArrowLeft auf erstem Tab → wrap auf letzten', () => {
      w.switchReiter(0);
      var btns = doc.querySelectorAll('.tab-btn.field-tab');
      btns[0].focus();
      fireKey(btns[0], 'ArrowLeft');
      expect(w.state.activeReiter).toBe(2); // wrap
      var newBtns = doc.querySelectorAll('.tab-btn.field-tab');
      expect(doc.activeElement).toBe(newBtns[2]);
    });

    it('ArrowLeft mittig: aktiv auf 2 → 1', () => {
      var btns = doc.querySelectorAll('.tab-btn.field-tab');
      btns[2].focus();
      fireKey(btns[2], 'ArrowLeft');
      expect(w.state.activeReiter).toBe(1);
      var newBtns = doc.querySelectorAll('.tab-btn.field-tab');
      expect(doc.activeElement).toBe(newBtns[1]);
    });

    it('Home springt auf ersten Schlag', () => {
      var btns = doc.querySelectorAll('.tab-btn.field-tab');
      btns[2].focus();
      fireKey(btns[2], 'Home');
      expect(w.state.activeReiter).toBe(0);
    });

    it('End springt auf letzten Schlag', () => {
      w.switchReiter(0);
      var btns = doc.querySelectorAll('.tab-btn.field-tab');
      btns[0].focus();
      fireKey(btns[0], 'End');
      expect(w.state.activeReiter).toBe(2);
    });

    it('preventDefault NUR bei tatsaechlich behandelter Taste', () => {
      var btns = doc.querySelectorAll('.tab-btn.field-tab');
      btns[2].focus();
      var evtIrrelevant = fireKey(btns[2], 'a'); // unrelated key
      expect(evtIrrelevant.defaultPrevented).toBe(false);
      var evtHandled = fireKey(btns[2], 'ArrowRight');
      expect(evtHandled.defaultPrevented).toBe(true);
    });

    it('ArrowKeys in der .tab-name-Textbox loesen KEINEN Wechsel aus (Texteingabe)', () => {
      var spans = doc.querySelectorAll('.tab-name');
      spans[2].focus(); // Tab-Name des aktiven Schlags
      expect(doc.activeElement).toBe(spans[2]);
      fireKey(spans[2], 'ArrowLeft');
      expect(w.state.activeReiter).toBe(2); // unveraendert
      fireKey(spans[2], 'ArrowRight');
      expect(w.state.activeReiter).toBe(2); // unveraendert
      // Home/End sollen in der Textbox auch nicht in den Reiter-Wechsel
      // durchschlagen (wuerde sonst Cursor-Position-Spruenge verursachen)
      fireKey(spans[2], 'Home');
      expect(w.state.activeReiter).toBe(2);
      fireKey(spans[2], 'End');
      expect(w.state.activeReiter).toBe(2);
    });

    it('ArrowKeys auf .tab-close loesen KEINEN Reiter-Wechsel aus (Enter/Space bleibt nativ)', () => {
      var closes = doc.querySelectorAll('.tab-close');
      closes[2].focus();
      expect(doc.activeElement).toBe(closes[2]);
      fireKey(closes[2], 'ArrowRight');
      expect(w.state.activeReiter).toBe(2); // unveraendert
      fireKey(closes[2], 'ArrowLeft');
      expect(w.state.activeReiter).toBe(2); // unveraendert
    });

    it('Welle-1-Vertrag intakt: Enter/Space auf .tab-close entfernt den Schlag', () => {
      // Welle-1-Vertrag (siehe tests/dialog-accessibility.test.js): .tab-close
      // ist ein echter <button type="button">, Click-Handler ruft
      // confirmRemoveReiter. In echten Browsern emittiert Enter/Space auf
      // fokussiertem Button einen Click — in jsdom nicht automatisch, daher
      // verifizieren wir den Vertrag ueber .click() (das ist exakt das,
      // was Enter/Space in der Real-Browser-Pipeline ausloest).
      w.confirm = function() { return true; };
      var closes = doc.querySelectorAll('.tab-close');
      expect(closes.length).toBe(3);
      expect(w.state.reiter.length).toBe(3);
      closes[0].click();
      expect(w.state.reiter.length).toBe(2);
    });

    it('Switch-Pfad: ArrowRight geht via switchReiter (gleicher Pfad wie Klick)', () => {
      // Sicherstellen, dass der Tastaturpfad DENSELBEN Code wie der Klick-
      // Pfad nutzt — wir spionieren switchReiter aus.
      var calls = [];
      var orig = w.AppGlobals.switchReiter;
      w.AppGlobals.switchReiter = function(idx) { calls.push(idx); if (orig) orig(idx); };
      var btns = doc.querySelectorAll('.tab-btn.field-tab');
      btns[2].focus();
      fireKey(btns[2], 'ArrowRight');
      expect(calls.length).toBe(1);
      expect(calls[0]).toBe(0);
      w.AppGlobals.switchReiter = orig;
    });
  });

  describe('Fokus-Restore nach re-render', () => {
    let w, doc;
    beforeEach(function() {
      const dom = createDom();
      w = dom.window;
      doc = w.document;
      w.addReiter();
      w.addReiter(); // 3 tabs, active = 2
    });

    it('Mit vorherigem Fokus auf .tab-btn: nach re-render liegt Fokus auf neuem aktiven .tab-btn', () => {
      var btns = doc.querySelectorAll('.tab-btn.field-tab');
      btns[2].focus();
      expect(doc.activeElement).toBe(btns[2]);
      // TAB_RENAMED rendert neu, ohne activeReiter zu aendern
      w.renameReiter(2, 'Mein Schlag');
      var newBtns = doc.querySelectorAll('.tab-btn.field-tab');
      expect(w.state.activeReiter).toBe(2);
      expect(doc.activeElement).toBe(newBtns[2]);
    });

    it('Ohne vorherigen Tab-Fokus: Fokus wird NICHT verschoben (kein Klauen aus Input-Feld)', () => {
      var hektar = doc.getElementById('hektar');
      hektar.focus();
      expect(doc.activeElement).toBe(hektar);
      w.renameReiter(2, 'Mein Schlag');
      expect(doc.activeElement).toBe(hektar);
    });

    it('Fokus auf .tab-name: kein Klauen beim re-render', () => {
      // .tab-name ist KEIN .tab-btn — der Restore darf nicht greifen.
      // Beim re-render geht der Fokus auf das alte (entfernte) Element
      // verloren, aber auf keinen Fall wird ein anderes Element fokussiert.
      var spans = doc.querySelectorAll('.tab-name');
      spans[1].focus();
      expect(doc.activeElement).toBe(spans[1]);
      w.renameReiter(1, 'Umbenannt');
      // Fokus ist weg (Spans wurden ersetzt), aber kein .tab-btn hat
      // ungerechtfertigt Fokus bekommen
      var btnsAfter = doc.querySelectorAll('.tab-btn.field-tab');
      var activeAfter = btnsAfter[2]; // active ist immer noch 2
      expect(doc.activeElement === activeAfter).toBe(false);
    });
  });
});