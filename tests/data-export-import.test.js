import { createDom } from './helpers.js';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Daten-Export/Import
 * Zusammengeführt in Issue #419 (Welle 4) aus:
 * 45-data-export-import.test.js
 * Jede Quelldatei ist als eigener describe-Block vollständig
 * erhalten (nur Import-Zeilen dedupliziert) — keine Assertions
 * wurden verändert oder entfernt.
 */

describe('Daten-Export/Import — übernommen aus 45-data-export-import.test.js', () => {
/**
 * Tests für Daten-Export/Import (Issue: IDEAS.md Hohe Priorität
 * „Daten exportieren/importieren").
 *
 * Verhalten:
 *   1. Export: synchronisiert DOM → state, lädt JSON-Datei mit versioniertem
 *      Envelope (app, formatVersion, exportedAt, state). Dateiname nach
 *      deutschem Datum/Uhrzeit-Schema.
 *   2. UI: Footer-Buttons "Daten exportieren" und "Daten importieren" neben
 *      dem Reset-Button. Verstecktes <input type=file>.
 *   3. Import: liest Datei vollständig, läuft durch parseAndSanitizeState.
 *      Fremdes Format, kaputtes JSON, leere/zu große Dateien und ungültiger
 *      State werden sicher abgelehnt — kein Eingriff in aktuellen State.
 *   4. Vorschau-Modal zeigt Anzahl Schläge & Einträge. Erst nach Bestätigung
 *      wird der bestehende State ersetzt, gespeichert und vollständig
 *      aktualisiert.
 *   5. UI-Ansicht im State wird auf Rechner/ersten gültigen Tab
 *      normalisiert.
 *   6. Erfolgs-/Fehlermeldungen zugänglich (role="alert" / aria-live).
 *   7. Keine Merge-Logik — kompletter Replace.
 *
 * Testet NUR AppGlobals-API und DOM-Vertrag; keine echte Datei-Download-
 * /Upload-IO (jsdom-spezifisch). Mockt URL.createObjectURL & createElement('a')
 * für Export; nutzt validateImportText(text) als direkten Einstieg für den
 * reinen Reader-unabhängigen Pfad.
 */

// ───────────────────────── helpers ─────────────────────────

function makeExportCapture(w) {
  // Mockt URL.createObjectURL/revokeObjectURL und überschreibt anchor-Click,
  // damit exportData() keinen echten Download auslöst. Außerdem wird Blob
  // abgefangen, sodass die Tests den JSON-Inhalt synchron lesen können.
  const captures = [];
  const origCreate = w.URL.createObjectURL;
  const origRevoke = w.URL.revokeObjectURL;
  const origClick = w.HTMLAnchorElement.prototype.click;
  const OrigBlob = w.Blob;

  function MockBlob(parts, opts) {
    this._parts = parts || [];
    this._opts = opts || {};
  }
  MockBlob.prototype = OrigBlob.prototype;
  w.Blob = MockBlob;

  w.URL.createObjectURL = vi.fn(function (blob) {
    captures.push({ blob: blob, filename: null, href: null });
    return 'blob:mock#' + captures.length;
  });
  w.URL.revokeObjectURL = vi.fn();
  w.HTMLAnchorElement.prototype.click = vi.fn(function () {
    const last = captures[captures.length - 1];
    if (last) {
      last.filename = this.download || null;
      last.href = this.href || null;
    }
  });

  function readTextSync() {
    const last = captures[captures.length - 1];
    if (!last || !last.blob) return null;
    const parts = last.blob._parts || [];
    return parts.join('');
  }

  return {
    getLast: function () { return captures[captures.length - 1] || null; },
    getCount: function () { return captures.length; },
    readTextSync: readTextSync,
    restore: function () {
      w.URL.createObjectURL = origCreate;
      w.URL.revokeObjectURL = origRevoke;
      w.HTMLAnchorElement.prototype.click = origClick;
      w.Blob = OrigBlob;
    }
  };
}

// Erzeugt einen minimalen, aber gültigen Envelope-String — die Tests
// passen nur die state-Properties an und nutzen validateImportText().
function makeEnvelope(stateObj) {
  return JSON.stringify({
    app: 'agrar-rechner',
    formatVersion: 1,
    exportedAt: '2026-08-20T12:00:00.000Z',
    state: stateObj
  });
}

// ───────────────────────── Geteilte Fixtures ─────────────────────────
//
// createDom() ist teuer (HTML parsen + alle Module evaluieren). Wir
// bauen pro describe-Block nur EINEN DOM und nutzen die AppGlobals-API
// zur State-Mutation. Größenlimit-Tests umgehen die 10 MB-Allokation
// durch Überschreiben von AppGlobals.EXPORT_MAX_BYTES.

let domHandle = null;
function sharedDom() {
  if (!domHandle) domHandle = createDom();
  return domHandle;
}
function resetState() {
  // Minimaler Reset des bestehenden DOM: ein einzelner Schlag, leer.
  const h = sharedDom();
  const w = h.window;
  const doc = w.document;
  w.state.reiter = [{
    name: 'Schlag 1',
    hektar: 0, istHektar: 0, koerner: 0, duenger: 0,
    entries: [], done: false, koernerProEinheit: 50000, notizen: ''
  }];
  w.state.activeReiter = 0;
  w.state.activeView = null;
  w.state.dashboardOpen = false;
  w.state.fahrgassenEnabled = false;
  w.state.fahrgassenBreite = 0;
  w.state.einheitGroesseEnabled = false;
  w.state.koernerProEinheit = 50000;
  w.state.kultur = null;
  w.state.erstauswahlDone = false;
  w.state.machineLog = [];
  w.state.drillPriorities = {};
  w.state.protocolView = 'fields';
  w.state.protocolOpenCards = {};
  // DOM-Eingabefelder ebenfalls leeren, damit exportData() →
  // syncStateFromInputs() den State nicht mit DOM-Stale-Werten überschreibt.
  ['hektar', 'ist_hektar', 'koerner', 'duenger', 'fahrgassen_breite', 'koerner_pro_einheit', 'notizen'].forEach(function (id) {
    var el = doc.getElementById(id);
    if (el) {
      el.value = '';
      if ('prev' in el.dataset) el.dataset.prev = '';
      if ('cleaned' in el.dataset) el.dataset.cleaned = '';
    }
  });
  h.store['agrar_rechner'] = JSON.stringify(w.state);
}

// ───────────────────────── HTML-Contract ─────────────────────────

describe('Daten-Export/Import — HTML-Contract', () => {
  let w, doc;
  beforeAll(() => { sharedDom(); });
  beforeEach(() => { w = sharedDom().window; doc = w.document; resetState(); });

  it('Footer enthält "Daten exportieren" und "Daten importieren" Button', () => {
    const exportBtn = doc.getElementById('data_export_btn');
    const importBtn = doc.getElementById('data_import_btn');
    expect(exportBtn).toBeTruthy();
    expect(importBtn).toBeTruthy();
    expect(exportBtn.tagName.toLowerCase()).toBe('button');
    expect(importBtn.tagName.toLowerCase()).toBe('button');
    expect(exportBtn.textContent).toMatch(/exportieren/i);
    expect(importBtn.textContent).toMatch(/importieren/i);
  });

  it('Hidden file input existiert mit accept="application/json"', () => {
    const fileInput = doc.getElementById('data_import_file');
    expect(fileInput).toBeTruthy();
    expect(fileInput.type).toBe('file');
    expect(fileInput.accept).toContain('application/json');
    const isHidden = fileInput.hidden || fileInput.style.display === 'none';
    expect(isHidden).toBe(true);
  });

  it('Import-Modal existiert mit Vorschau-Bereich + Bestätigen/Abbrechen', () => {
    const modal = doc.getElementById('import_modal');
    const overlay = doc.getElementById('import_overlay');
    expect(modal).toBeTruthy();
    expect(overlay).toBeTruthy();
    expect(doc.getElementById('import_modal_counts')).toBeTruthy();
    expect(doc.getElementById('import_modal_confirm')).toBeTruthy();
    expect(doc.getElementById('import_modal_cancel')).toBeTruthy();
    expect(modal.getAttribute('aria-modal')).toBe('true');
    expect(modal.getAttribute('role')).toBe('dialog');
  });

  it('Status-Bereich für Erfolgs-/Fehlermeldungen ist aria-live / role=alert', () => {
    const status = doc.getElementById('data_io_status');
    expect(status).toBeTruthy();
    const hasAlert = status.getAttribute('role') === 'alert';
    const hasLive = (status.getAttribute('aria-live') || '').length > 0;
    expect(hasAlert || hasLive).toBe(true);
  });

  it('Footer "Daten exportieren" / "Daten importieren" liegen in .footer-actions', () => {
    const exportBtn = doc.getElementById('data_export_btn');
    const actions = exportBtn.closest('.footer-actions');
    expect(actions).toBeTruthy();
    const resetBtn = actions.querySelector('.footer-reset-btn');
    expect(resetBtn).toBeTruthy();
  });
});

// ───────────────────────── Export: Envelope + Dateiname ─────────────────────────

describe('Daten-Export — Envelope + Dateiname', () => {
  let w, doc;
  beforeAll(() => { sharedDom(); });
  beforeEach(() => { w = sharedDom().window; doc = w.document; resetState(); });

  it('exportData() schreibt versionierten Envelope mit App-Kennung, Formatversion, Exportzeitpunkt, state', () => {
    // State UND DOM setzen — exportData ruft syncStateFromInputs(), das
    // DOM-Werte in den State zurückschreibt. Wenn das DOM leer ist,
    // würde syncStateFromInputs die State-Werte mit 0 überschreiben.
    w.state.reiter[0].hektar = 12.5;
    w.state.reiter[0].koerner = 90000;
    w.state.reiter[0].duenger = 200;
    doc.getElementById('hektar').value = '12,5';
    doc.getElementById('koerner').value = '90000';
    doc.getElementById('duenger').value = '200';
    w.state.machineLog = [{ time: '10:00', einheit: 1, duenger: 10, hektar: 2 }];
    w.state.drillPriorities = { 0: 1 };
    w.state.kultur = 'mais';
    w.state.erstauswahlDone = true;

    const cap = makeExportCapture(w);
    try {
      w.exportData();
      const captured = cap.getLast();
      expect(captured).toBeTruthy();
      const text = cap.readTextSync();
      expect(text).toBeTruthy();
      const env = JSON.parse(text);
      expect(env.app).toBe('agrar-rechner');
      expect(env.formatVersion).toBe(1);
      expect(typeof env.exportedAt).toBe('string');
      expect(new Date(env.exportedAt).toString()).not.toBe('Invalid Date');
      expect(env.state.reiter.length).toBe(1);
      expect(env.state.reiter[0].hektar).toBeCloseTo(12.5);
      expect(env.state.reiter[0].koerner).toBe(90000);
      expect(env.state.machineLog.length).toBe(1);
      expect(env.state.drillPriorities['0']).toBe(1);
    } finally {
      cap.restore();
    }
  });

  it('exportData() liefert Dateiname nach deutschem Datum/Uhrzeit-Schema', () => {
    w.state.reiter[0].hektar = 1;
    w.state.reiter[0].koerner = 90000;

    const cap = makeExportCapture(w);
    try {
      w.exportData();
      const captured = cap.getLast();
      expect(captured.filename).toBeTruthy();
      expect(captured.filename).toMatch(/^agrar-rechner-export-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
      const m = captured.filename.match(/^agrar-rechner-export-(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})\.json$/);
      expect(m).toBeTruthy();
      const yyyy = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      const dd = parseInt(m[3], 10);
      const hh = parseInt(m[4], 10);
      const mi = parseInt(m[5], 10);
      const now = new Date();
      expect(yyyy).toBe(now.getFullYear());
      expect(mm).toBe(now.getMonth() + 1);
      expect(dd).toBe(now.getDate());
      expect(hh).toBeGreaterThanOrEqual(0);
      expect(hh).toBeLessThanOrEqual(23);
      expect(mi).toBeGreaterThanOrEqual(0);
      expect(mi).toBeLessThanOrEqual(59);
    } finally {
      cap.restore();
    }
  });

  it('exportData() synchronisiert DOM-Eingaben in den State VOR dem Export', () => {
    doc.getElementById('hektar').value = '15,7';
    doc.getElementById('koerner').value = '80000';
    doc.getElementById('duenger').value = '175';

    expect(w.state.reiter[0].hektar).toBe(0);

    const cap = makeExportCapture(w);
    try {
      w.exportData();
      // buildExportEnvelope wurde aufgerufen (syncStateFromInputs davor)
      expect(w.state.reiter[0].hektar).toBeCloseTo(15.7);
      expect(w.state.reiter[0].koerner).toBe(80000);
      expect(w.state.reiter[0].duenger).toBe(175);
    } finally {
      cap.restore();
    }
  });

  it('exportData() enthält alle Schläge, Notizen, done-Flag, Einstellungen, drillPriorities, protocolView, machineLog', () => {
    w.addReiter();
    w.state.reiter[0].name = 'Nord';
    w.state.reiter[0].hektar = 8;
    w.state.reiter[0].koerner = 90000;
    w.state.reiter[0].duenger = 100;
    w.state.reiter[0].notizen = 'Vorgewende nass';
    w.state.reiter[0].done = true;
    w.state.reiter[0].entries = [{ time: '08:00', einheit: 2, duenger: 50, hektar: 1.5, istHektar: 1.5 }];
    w.state.reiter[1].name = 'Süd';
    w.state.reiter[1].hektar = 5;
    w.state.reiter[1].koerner = 80000;
    w.state.reiter[1].duenger = 80;
    w.state.activeReiter = 1;
    w.state.protocolView = 'machine';
    w.state.protocolOpenCards = { '2026-08-20': '0' };
    w.state.drillPriorities = { 0: 1, 1: 2 };
    w.state.machineLog = [{ time: '08:00', einheit: 2, duenger: 50, hektar: 1.5 }];
    w.state.kultur = 'raps';
    w.state.erstauswahlDone = true;
    w.state.fahrgassenEnabled = true;
    w.state.fahrgassenBreite = 24;

    const env = w.AppGlobals.buildExportEnvelope();
    expect(env.state.reiter.length).toBe(2);
    expect(env.state.reiter[0].name).toBe('Nord');
    expect(env.state.reiter[0].notizen).toBe('Vorgewende nass');
    expect(env.state.reiter[0].done).toBe(true);
    expect(env.state.reiter[0].entries.length).toBe(1);
    expect(env.state.reiter[1].name).toBe('Süd');
    expect(env.state.protocolView).toBe('machine');
    expect(env.state.protocolOpenCards['2026-08-20']).toBe('0');
    expect(env.state.drillPriorities[0]).toBe(1);
    expect(env.state.drillPriorities[1]).toBe(2);
    expect(env.state.machineLog.length).toBe(1);
    expect(env.state.kultur).toBe('raps');
    expect(env.state.fahrgassenEnabled).toBe(true);
    expect(env.state.fahrgassenBreite).toBe(24);
  });
});

// ───────────────────────── Import: Validierung ─────────────────────────

describe('Daten-Import — Validierung (validateImportText)', () => {
  let w;
  beforeAll(() => { sharedDom(); });
  beforeEach(() => { w = sharedDom().window; resetState(); });

  it('akzeptiert gültigen Envelope → ok=true, state + counts', () => {
    const text = makeEnvelope({
      reiter: [
        { name: 'A', hektar: 5, koerner: 80000, duenger: 100, entries: [{ einheit: 1, duenger: 10, time: '08:00' }] },
        { name: 'B', hektar: 3, koerner: 90000, duenger: 80, entries: [] }
      ],
      activeReiter: 0,
      kultur: 'mais',
      erstauswahlDone: true,
      machineLog: [],
      drillPriorities: {},
      _lv: 9
    });
    const result = w.validateImportText(text);
    expect(result.ok).toBe(true);
    expect(result.counts.tabs).toBe(2);
    expect(result.counts.entries).toBe(1);
    expect(result.state.reiter.length).toBe(2);
  });

  it('lehnt fremden app-Key ab', () => {
    const text = JSON.stringify({
      app: 'andere-app',
      formatVersion: 1,
      exportedAt: '2026-08-20T12:00:00.000Z',
      state: { reiter: [{ name: 'A', entries: [] }] }
    });
    const r = w.validateImportText(text);
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it('lehnt fremde Format-Version ab', () => {
    const text = JSON.stringify({
      app: 'agrar-rechner',
      formatVersion: 99,
      exportedAt: '2026-08-20T12:00:00.000Z',
      state: { reiter: [{ name: 'A', entries: [] }] }
    });
    const r = w.validateImportText(text);
    expect(r.ok).toBe(false);
  });

  it('lehnt kaputtes JSON ab', () => {
    const r = w.validateImportText('{ kaputt: wahr, keine Anführungszeichen,, }');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('invalid-json');
  });

  it('lehnt leere Datei ab', () => {
    expect(w.validateImportText('').ok).toBe(false);
    expect(w.validateImportText('   ').ok).toBe(false);
  });

  it('lehnt Datei > Größenlimit ab (bei künstlich heruntergesetztem Limit)', () => {
    // 10 MB-Allokation für jeden Test ist unnötig. Wir setzen das Limit
    // temporär herunter und prüfen die Reject-Logik mit kleinem String.
    const originalMax = w.AppGlobals.EXPORT_MAX_BYTES;
    w.AppGlobals.EXPORT_MAX_BYTES = 100;
    try {
      const text = 'x'.repeat(200); // 200 Bytes > 100 Bytes Limit
      const r = w.validateImportText(text);
      expect(r.ok).toBe(false);
      expect(r.error).toBe('too-large');
    } finally {
      w.AppGlobals.EXPORT_MAX_BYTES = originalMax;
    }
  });

  it('lehnt envelope mit ungültigem state ab (kein reiter-Array)', () => {
    const text = makeEnvelope({ foo: 'bar' });
    // makeEnvelope expects state, legt aber reiter nicht an — fabricate one:
    const text2 = JSON.stringify({
      app: 'agrar-rechner',
      formatVersion: 1,
      exportedAt: '2026-08-20T12:00:00.000Z',
      state: { foo: 'bar' }
    });
    const r = w.validateImportText(text2);
    expect(r.ok).toBe(false);
  });

  it('zeigt sinnvolle deutsche Fehlermeldung je Fehlercode', () => {
    const codes = ['empty-file', 'too-large', 'invalid-json', 'invalid-format', 'foreign-format', 'invalid-state'];
    codes.forEach(function (code) {
      const msg = w.importErrorMessage(code);
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
      expect(msg).not.toBe(code);
    });
  });

  it('importErrorMessage liefert sinnvolle deutsche Texte für die neuen Kardinalitäts-Codes (#445)', () => {
    const codes = ['too-many-tabs', 'too-many-entries', 'too-many-log-entries'];
    codes.forEach(function (code) {
      const msg = w.importErrorMessage(code);
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
      expect(msg).not.toBe(code);
      // Mindestens eine sinnvolle, fachliche Andeutung:
      expect(msg).toMatch(/schl|tab|buch|log|eintr/i);
    });
  });
});

// ───────────────────────── Issue #445 B — Import-Kardinalitäts-Checks ─────────────────────────
//
// Welle 1: validateImportText prüft die ROHEN Array-Längen in
// envelope.state gegen STATE_LIMITS, BEVOR parseAndSanitizeState läuft.
// Bei Überschreitung gibt es einen spezifischen Fehlercode, der Import
// bricht früh ab statt still zu kürzen.

describe('Issue #445 B — Import-Kardinalitäts-Checks gegen STATE_LIMITS', () => {
  let w;
  beforeAll(() => { sharedDom(); });
  beforeEach(() => { w = sharedDom().window; resetState(); });

  function envelope(state) {
    return JSON.stringify({
      app: 'agrar-rechner',
      formatVersion: 1,
      exportedAt: '2026-08-20T12:00:00.000Z',
      state: state
    });
  }

  it('lehnt Envelope mit reiter.length > STATE_LIMITS.maxTabs mit "too-many-tabs" ab', () => {
    const orig = w.AppGlobals.STATE_LIMITS.maxTabs;
    w.AppGlobals.STATE_LIMITS.maxTabs = 3;
    try {
      const text = envelope({
        reiter: [
          { name: 'A', entries: [] },
          { name: 'B', entries: [] },
          { name: 'C', entries: [] },
          { name: 'D', entries: [] }
        ],
        _lv: 9
      });
      const r = w.validateImportText(text);
      expect(r.ok).toBe(false);
      expect(r.error).toBe('too-many-tabs');
    } finally {
      w.AppGlobals.STATE_LIMITS.maxTabs = orig;
    }
  });

  it('lehnt Envelope mit zu vielen Einträgen pro Tab mit "too-many-entries" ab', () => {
    const orig = w.AppGlobals.STATE_LIMITS.maxEntriesPerTab;
    w.AppGlobals.STATE_LIMITS.maxEntriesPerTab = 5;
    try {
      const bigEntries = [];
      for (let i = 0; i < 7; i++) bigEntries.push({ einheit: i + 1, duenger: 0, time: '08:00' });
      const text = envelope({
        reiter: [{ name: 'X', entries: bigEntries }],
        _lv: 9
      });
      const r = w.validateImportText(text);
      expect(r.ok).toBe(false);
      expect(r.error).toBe('too-many-entries');
    } finally {
      w.AppGlobals.STATE_LIMITS.maxEntriesPerTab = orig;
    }
  });

  it('lehnt Envelope mit zu vielen machineLog-Einträgen mit "too-many-log-entries" ab', () => {
    const orig = w.AppGlobals.STATE_LIMITS.maxMachineLog;
    w.AppGlobals.STATE_LIMITS.maxMachineLog = 4;
    try {
      const bigLog = [];
      for (let i = 0; i < 6; i++) bigLog.push({ einheit: 1, duenger: 0, time: '08:00' });
      const text = envelope({
        reiter: [{ name: 'X', entries: [] }],
        machineLog: bigLog,
        _lv: 9
      });
      const r = w.validateImportText(text);
      expect(r.ok).toBe(false);
      expect(r.error).toBe('too-many-log-entries');
    } finally {
      w.AppGlobals.STATE_LIMITS.maxMachineLog = orig;
    }
  });

  it('akzeptiert Envelope genau an der Grenze (maxTabs exakt erfüllt)', () => {
    const orig = w.AppGlobals.STATE_LIMITS.maxTabs;
    w.AppGlobals.STATE_LIMITS.maxTabs = 3;
    try {
      const text = envelope({
        reiter: [
          { name: 'A', entries: [] },
          { name: 'B', entries: [] },
          { name: 'C', entries: [] }
        ],
        _lv: 9
      });
      const r = w.validateImportText(text);
      expect(r.ok).toBe(true);
    } finally {
      w.AppGlobals.STATE_LIMITS.maxTabs = orig;
    }
  });

  it('validateImportText nutzt AppGlobals.STATE_LIMITS zur Kardinalitäts-Prüfung (Tests senken live)', () => {
    // Default = STATE_LIMITS.maxTabs=200, maxEntriesPerTab=5000.
    // Mit den Defaults muss ein "riesiger" (aber realistisch großer)
    // Envelope noch durchgehen — die Limits sind bewusst großzügig.
    const tabs = [];
    for (let i = 0; i < 50; i++) {
      tabs.push({ name: 'T' + i, entries: [] });
    }
    const text = envelope({ reiter: tabs, _lv: 9 });
    const r = w.validateImportText(text);
    expect(r.ok).toBe(true);
  });
});

// ───────────────────────── Import: Vorschau + Bestätigen ─────────────────────────

describe('Daten-Import — Vorschau + Bestätigen', () => {
  let w, doc, store;
  beforeAll(() => { sharedDom(); });
  beforeEach(() => {
    const h = sharedDom();
    w = h.window; doc = w.document; store = h.store;
    resetState();
  });

  it('Import zeigt Vorschau mit Anzahl Schläge + Anzahl Buchungen', () => {
    const text = makeEnvelope({
      reiter: [
        { name: 'A', hektar: 5, koerner: 80000, duenger: 100, entries: [
          { einheit: 1, duenger: 10, time: '08:00' },
          { einheit: 1, duenger: 10, time: '09:00' }
        ] },
        { name: 'B', hektar: 3, koerner: 90000, duenger: 80, entries: [] }
      ],
      _lv: 9
    });
    const parsed = w.validateImportText(text);
    expect(parsed.ok).toBe(true);
    w.showImportPreview(parsed);
    const counts = doc.getElementById('import_modal_counts');
    expect(counts.textContent).toContain('2 Schläge');
    expect(counts.textContent).toContain('2 Buchungen');
    const modal = doc.getElementById('import_modal');
    expect(modal.classList.contains('open')).toBe(true);
    expect(modal.hidden).toBe(false);
    expect(modal.getAttribute('aria-hidden')).toBe('false');
  });

  it('Bestätigen ersetzt State, persistiert in localStorage und rendert vollständig', () => {
    w.state.reiter[0].hektar = 999;
    w.state.reiter[0].koerner = 12345;
    w.state.kultur = 'sonstiges';

    const text = makeEnvelope({
      reiter: [
        { name: 'Import-Nord', hektar: 7.5, koerner: 85000, duenger: 120, entries: [{ einheit: 2, duenger: 10, time: '14:00' }] },
        { name: 'Import-Süd', hektar: 4, koerner: 80000, duenger: 90, entries: [] }
      ],
      activeReiter: 0,
      activeView: null,
      kultur: 'mais',
      erstauswahlDone: true,
      machineLog: [],
      drillPriorities: { 0: 1 },
      _lv: 9
    });
    const parsed = w.validateImportText(text);
    w.showImportPreview(parsed);
    w.confirmImportFromModal();

    expect(w.state.reiter.length).toBe(2);
    expect(w.state.reiter[0].name).toBe('Import-Nord');
    expect(w.state.reiter[0].hektar).toBeCloseTo(7.5);
    expect(w.state.reiter[1].name).toBe('Import-Süd');
    expect(w.state.kultur).toBe('mais');
    expect(w.state.reiter[0].koerner).not.toBe(12345);

    const raw = store['agrar_rechner'];
    expect(raw).toBeTruthy();
    const persisted = JSON.parse(raw);
    expect(persisted.reiter.length).toBe(2);
    expect(persisted.reiter[0].name).toBe('Import-Nord');

    expect(doc.getElementById('import_modal').classList.contains('open')).toBe(false);

    // syncInputsFromState füllt Input-Felder aus state
    w.syncInputsFromState();
    expect(doc.getElementById('hektar').value).toBe('7,5');
  });

  it('normalisiert den importierten UI-Zustand auf ersten Schlag und Rechneransicht', () => {
    const text = makeEnvelope({
      reiter: [
        { name: 'A', hektar: 1, koerner: 80000, duenger: 0, entries: [] },
        { name: 'B', hektar: 2, koerner: 80000, duenger: 0, entries: [] }
      ],
      activeReiter: 5,
      activeView: 'protokoll',
      dashboardOpen: true,
      _lv: 9
    });
    const parsed = w.validateImportText(text);
    w.showImportPreview(parsed);
    w.confirmImportFromModal();

    expect(w.state.activeReiter).toBe(0);
    expect(w.state.activeView).toBe(null);
    expect(w.state.dashboardOpen).toBe(false);
    expect(doc.getElementById('drill_section').style.display).toBe('none');
  });

  it('zeigt keinen Erfolg und behält den bisherigen Stand, wenn Speichern fehlschlägt', () => {
    w.state.reiter[0].name = 'Alter Stand';
    w.state.reiter[0].hektar = 9;
    const previousRaw = store['agrar_rechner'];
    const originalSetItem = w.localStorage.setItem;
    const text = makeEnvelope({
      reiter: [{ name: 'Neuer Stand', hektar: 3, koerner: 80000, duenger: 0, entries: [] }],
      kultur: 'mais',
      erstauswahlDone: true,
      _lv: 9
    });
    const parsed = w.validateImportText(text);
    w.showImportPreview(parsed);
    const consoleError = vi.spyOn(w.console, 'error').mockImplementation(function () {});
    w.localStorage.setItem = function () {
      const error = new Error('voll');
      error.name = 'QuotaExceededError';
      throw error;
    };
    try {
      w.confirmImportFromModal();
    } finally {
      w.localStorage.setItem = originalSetItem;
      consoleError.mockRestore();
    }

    expect(w.state.reiter[0].name).toBe('Alter Stand');
    expect(w.state.reiter[0].hektar).toBe(9);
    expect(store['agrar_rechner']).toBe(previousRaw);
    expect(doc.getElementById('data_io_status').textContent).toMatch(/nicht gespeichert|fehlgeschlagen/i);
    expect(doc.getElementById('data_io_status').textContent).not.toMatch(/importiert$/i);
  });

  it('synchronisiert importierte Einstellungs-Schalter und Panels sichtbar', () => {
    const text = makeEnvelope({
      reiter: [{
        name: 'A', hektar: 1, koerner: 80000, duenger: 0, entries: [],
        fahrgassenEnabled: true, fahrgassenBreite: 24, koernerProEinheit: 70000
      }],
      fahrgassenEnabled: true,
      fahrgassenBreite: 24,
      einheitGroesseEnabled: true,
      koernerProEinheit: 70000,
      kultur: 'mais',
      erstauswahlDone: true,
      _lv: 9
    });
    w.showImportPreview(w.validateImportText(text));
    w.confirmImportFromModal();

    const fgToggle = doc.getElementById('fahrgassen_toggle');
    const fgSettings = doc.getElementById('fahrgassen_settings');
    const kpeToggle = doc.getElementById('einheit_groesse_toggle');
    const kpeSettings = doc.getElementById('einheit_groesse_settings');
    expect(fgToggle.classList.contains('active')).toBe(true);
    expect(fgToggle.getAttribute('aria-pressed')).toBe('true');
    expect(fgSettings.classList.contains('open')).toBe(true);
    expect(kpeToggle.classList.contains('active')).toBe(true);
    expect(kpeToggle.getAttribute('aria-pressed')).toBe('true');
    expect(kpeSettings.classList.contains('open')).toBe(true);
  });

  it('Erfolgsmeldung wird im Status-Bereich angezeigt', () => {
    const text = makeEnvelope({
      reiter: [{ name: 'A', hektar: 1, koerner: 80000, duenger: 0, entries: [] }],
      _lv: 9
    });
    const parsed = w.validateImportText(text);
    w.showImportPreview(parsed);
    w.confirmImportFromModal();
    const status = doc.getElementById('data_io_status');
    expect(status.textContent).toMatch(/import/i);
  });
});

// ───────────────────────── Import: Abbruch bleibt unverändert ─────────────────────────

describe('Daten-Import — Abbruch bleibt unverändert', () => {
  let w, doc;
  beforeAll(() => { sharedDom(); });
  beforeEach(() => { w = sharedDom().window; doc = w.document; resetState(); });

  it('Abbrechen im Vorschau-Modal lässt State unverändert', () => {
    w.state.reiter[0].hektar = 99;
    w.state.reiter[0].name = 'Unverändert';
    w.state.kultur = 'raps';

    const text = makeEnvelope({
      reiter: [{ name: 'Import', hektar: 1, koerner: 1, duenger: 1, entries: [] }],
      kultur: 'mais',
      _lv: 9
    });
    const parsed = w.validateImportText(text);
    w.showImportPreview(parsed);
    w.cancelImportFromModal();

    expect(w.state.reiter[0].hektar).toBe(99);
    expect(w.state.reiter[0].name).toBe('Unverändert');
    expect(w.state.kultur).toBe('raps');
    const modal = doc.getElementById('import_modal');
    expect(modal.classList.contains('open')).toBe(false);
    expect(modal.hidden).toBe(true);
    expect(modal.getAttribute('aria-hidden')).toBe('true');
  });
});

// ───────────────────────── Import: Fehlerpfade ─────────────────────────

describe('Daten-Import — Fehlerpfade (fremd / kaputt / zu groß)', () => {
  let w, doc;
  beforeAll(() => { sharedDom(); });
  beforeEach(() => { w = sharedDom().window; doc = w.document; resetState(); });

  it('fremder app-Key ändert State nicht', () => {
    w.state.reiter[0].hektar = 12;
    const text = JSON.stringify({
      app: 'irgendein-anders-tool',
      formatVersion: 1,
      exportedAt: '2026-08-20T12:00:00.000Z',
      state: { reiter: [{ name: 'X', hektar: 999, koerner: 1, entries: [] }] }
    });
    const parsed = w.validateImportText(text);
    expect(parsed.ok).toBe(false);
    w.showImportError(parsed.error);
    const status = doc.getElementById('data_io_status');
    expect(status.textContent.length).toBeGreaterThan(0);
    expect(w.state.reiter[0].hektar).toBe(12);
  });

  it('kaputtes JSON ändert State nicht', () => {
    w.state.reiter[0].hektar = 7;
    const parsed = w.validateImportText('kein json {{{ ');
    expect(parsed.ok).toBe(false);
    w.showImportError(parsed.error);
    expect(w.state.reiter[0].hektar).toBe(7);
  });

  it('zu große Datei ändert State nicht', () => {
    w.state.reiter[0].hektar = 7;
    const originalMax = w.AppGlobals.EXPORT_MAX_BYTES;
    w.AppGlobals.EXPORT_MAX_BYTES = 50;
    try {
      const parsed = w.validateImportText('x'.repeat(100));
      expect(parsed.ok).toBe(false);
      expect(parsed.error).toBe('too-large');
      w.showImportError(parsed.error);
      expect(w.state.reiter[0].hektar).toBe(7);
    } finally {
      w.AppGlobals.EXPORT_MAX_BYTES = originalMax;
    }
  });

  it('leere Datei ändert State nicht', () => {
    w.state.reiter[0].hektar = 7;
    const parsed = w.validateImportText('');
    expect(parsed.ok).toBe(false);
    w.showImportError(parsed.error);
    expect(w.state.reiter[0].hektar).toBe(7);
  });

  it('Envelope ohne state-Property (Manipulation) wird abgelehnt', () => {
    w.state.reiter[0].hektar = 7;
    const parsed = w.validateImportText(JSON.stringify({
      app: 'agrar-rechner',
      formatVersion: 1,
      exportedAt: '2026-08-20T12:00:00.000Z'
    }));
    expect(parsed.ok).toBe(false);
    expect(w.state.reiter[0].hektar).toBe(7);
  });

  it('fehlerhafte showImportError öffnet KEIN Vorschau-Modal', () => {
    w.showImportError('foreign-format');
    expect(doc.getElementById('import_modal').classList.contains('open')).toBe(false);
  });
});

// ───────────────────────── AppGlobals-API ─────────────────────────

describe('Daten-Export/Import — AppGlobals-API', () => {
  let w;
  beforeAll(() => { sharedDom(); });
  beforeEach(() => { w = sharedDom().window; resetState(); });

  it('API ist auf AppGlobals verfügbar', () => {
    expect(typeof w.AppGlobals.exportData).toBe('function');
    expect(typeof w.AppGlobals.validateImportText).toBe('function');
    expect(typeof w.AppGlobals.showImportPreview).toBe('function');
    expect(typeof w.AppGlobals.confirmImportFromModal).toBe('function');
    expect(typeof w.AppGlobals.cancelImportFromModal).toBe('function');
    expect(typeof w.AppGlobals.showImportError).toBe('function');
    expect(typeof w.AppGlobals.importErrorMessage).toBe('function');
    expect(typeof w.AppGlobals.buildExportEnvelope).toBe('function');
    expect(typeof w.AppGlobals.makeExportFilename).toBe('function');
  });

  it('EXPORT_APP_KEY und EXPORT_FORMAT_VERSION sind stabil', () => {
    expect(w.AppGlobals.EXPORT_APP_KEY).toBe('agrar-rechner');
    expect(typeof w.AppGlobals.EXPORT_FORMAT_VERSION).toBe('number');
    expect(w.AppGlobals.EXPORT_FORMAT_VERSION).toBeGreaterThanOrEqual(1);
  });

  it('EXPORT_MAX_BYTES ist sinnvoll gesetzt', () => {
    expect(typeof w.AppGlobals.EXPORT_MAX_BYTES).toBe('number');
    expect(w.AppGlobals.EXPORT_MAX_BYTES).toBeGreaterThan(1024);
    expect(w.AppGlobals.EXPORT_MAX_BYTES).toBeLessThanOrEqual(100 * 1024 * 1024);
  });
});

// ───────────────────────── Issue #441 — UI-Bindings-Wiring ─────────────────────────
//
// Issue #441: Export und Import im echten UI wieder verdrahten.
// Commit 2165d1f (Issue #418 Welle 4) hat die DOM-Event-Bindings aus
// initDataExportImport entfernt, ohne sie in initUIBindings zu übernehmen.
// Folge: Klick auf #data_export_btn / #data_import_btn lösten im echten UI
// keine App-Aktion mehr aus. Diese Tests prüfen den realen DOM-Contract
// über Klick-/change-Events (nicht über direkte Handler-Aufrufe) und die
// Idempotenz-Garantie von initUIBindings.

describe('Issue #441 — UI-Bindings-Wiring für Daten-Export/Import', () => {
  let w, doc;
  beforeAll(() => { sharedDom(); });
  beforeEach(() => { w = sharedDom().window; doc = w.document; resetState(); });

  it('Klick auf #data_export_btn erzeugt genau einen gültigen JSON-Export', () => {
    const exportBtn = doc.getElementById('data_export_btn');
    expect(exportBtn).toBeTruthy();
    w.state.reiter[0].hektar = 12.5;
    w.state.reiter[0].koerner = 90000;
    w.state.reiter[0].duenger = 200;
    doc.getElementById('hektar').value = '12,5';
    doc.getElementById('koerner').value = '90000';
    doc.getElementById('duenger').value = '200';
    w.state.kultur = 'mais';
    w.state.erstauswahlDone = true;

    const cap = makeExportCapture(w);
    try {
      exportBtn.click();
      const captured = cap.getLast();
      expect(captured, 'exportData() wurde nicht durch den Klick ausgelöst — #data_export_btn hat keinen initUIBindings-Binding').toBeTruthy();
      const text = cap.readTextSync();
      expect(text, 'Export-Blob ist leer').toBeTruthy();
      const env = JSON.parse(text);
      expect(env.app).toBe('agrar-rechner');
      expect(env.formatVersion).toBe(1);
      expect(typeof env.exportedAt).toBe('string');
      expect(env.state.reiter[0].hektar).toBeCloseTo(12.5);
      expect(env.state.reiter[0].koerner).toBe(90000);
    } finally {
      cap.restore();
    }
  });

  it('Klick auf #data_import_btn löst genau einen click auf #data_import_file aus', () => {
    const importBtn = doc.getElementById('data_import_btn');
    const fileInput = doc.getElementById('data_import_file');
    expect(importBtn).toBeTruthy();
    expect(fileInput).toBeTruthy();
    // spyOn ersetzt nur die Property auf dieser Instanz — exakt der Pfad,
    // den triggerImportClick() über document.getElementById nimmt.
    const clickSpy = vi.spyOn(fileInput, 'click');

    importBtn.click();

    expect(clickSpy, 'triggerImportClick() wurde nicht durch den Klick ausgelöst — #data_import_btn hat keinen initUIBindings-Binding').toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });

  it('change auf #data_import_file mit gültiger JSON öffnet das Vorschau-Modal mit erwarteten Counts (echter FileReader-Pfad)', async () => {
    const fileInput = doc.getElementById('data_import_file');
    expect(fileInput).toBeTruthy();
    const envelope = makeEnvelope({
      reiter: [
        { name: 'A', hektar: 5, koerner: 80000, duenger: 100, entries: [
          { einheit: 1, duenger: 10, time: '08:00' },
          { einheit: 1, duenger: 10, time: '09:00' }
        ] },
        { name: 'B', hektar: 3, koerner: 90000, duenger: 80, entries: [] }
      ],
      _lv: 9
    });
    const file = new w.File([envelope], 'agrar-import.json', { type: 'application/json' });
    // Echter jsdom-File + FileReader-Pfad: nur die FileList-Schnittstelle
    // simulieren (jsdom stellt DataTransfer hier nicht als Konstruktor
    // bereit — der onImportFileChange-Pfad liest ausschließlich
    // event.target.files[0] + new FileReader(), beides ist verfügbar).
    Object.defineProperty(fileInput, 'files', {
      value: { 0: file, length: 1, item: function (i) { return i === 0 ? file : null; } },
      configurable: true,
    });
    fileInput.dispatchEvent(new w.Event('change', { bubbles: true }));

    // FileReader ist async → deterministisch auf das Modal-Öffnen warten.
    const modal = doc.getElementById('import_modal');
    await vi.waitFor(function () {
      expect(modal.classList.contains('open')).toBe(true);
    }, { timeout: 2000, interval: 10 });

    expect(modal.classList.contains('open'), 'Vorschau-Modal wurde nicht geöffnet — #data_import_file change hat keinen initUIBindings-Binding').toBe(true);
    expect(modal.hidden).toBe(false);
    const counts = doc.getElementById('import_modal_counts');
    expect(counts.textContent).toContain('2 Schläge');
    expect(counts.textContent).toContain('2 Buchungen');
  });

  it('initUIBindings() registriert die drei Listener nicht doppelt (idempotent)', () => {
    const exportBtn = doc.getElementById('data_export_btn');
    const importBtn = doc.getElementById('data_import_btn');
    const fileInput = doc.getElementById('data_import_file');
    const cap = makeExportCapture(w);
    const fileClickSpy = vi.spyOn(fileInput, 'click');
    try {
      // createDom() hat initUIBindings bereits einmal aufgerufen. Weitere
      // Aufrufe müssen dank _uiBindingsRegistered echte No-ops bleiben.
      w.AppGlobals.initUIBindings();
      w.AppGlobals.initUIBindings();
      w.AppGlobals.initUIBindings();

      exportBtn.click();
      importBtn.click();

      expect(cap.getCount(), 'Export-Listener wurde mehrfach registriert').toBe(1);
      expect(fileClickSpy, 'Import-Listener wurde mehrfach registriert').toHaveBeenCalledTimes(1);
    } finally {
      fileClickSpy.mockRestore();
      cap.restore();
    }
  });
});
});
