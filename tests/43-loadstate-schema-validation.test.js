/**
 * Tests for loadState() schema validation (Issue #237).
 * Covers: type injection on tab fields, prototype pollution via entries,
 * unknown / malicious keys, missing fields, and round-trip safety.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDom } from './helpers.js';

describe('loadState() schema validation (Issue #237)', () => {
    let w, doc, store;

    beforeEach(() => {
        const result = createDom();
        w = result.window;
        doc = w.document;
        store = result.store;
    });

    describe('Type injection on tab fields', () => {
        it('coerces string-typed number fields to numbers (rejected as invalid → 0)', () => {
            store['agrar_rechner'] = JSON.stringify({
                reiter: [{
                    name: 'Injected',
                    hektar: '"<script>alert(1)</script>"',  // String statt Zahl
                    istHektar: null,
                    koerner: { evil: true },
                    duenger: [1, 2, 3],
                    entries: []
                }],
                _lv: 4
            });
            w.loadState();
            // Alle ungültigen Number-Felder müssen auf 0 landen, App lauffähig.
            expect(w.state.reiter[0].hektar).toBe(0);
            expect(w.state.reiter[0].istHektar).toBe(0);
            expect(w.state.reiter[0].koerner).toBe(0);
            expect(w.state.reiter[0].duenger).toBe(0);
        });

        it('accepts finite numbers and number-coercible strings as tab fields', () => {
            store['agrar_rechner'] = JSON.stringify({
                reiter: [{
                    name: 'OK',
                    hektar: 12.5,
                    istHektar: '10',       // string "10" → 10
                    koerner: 85000,
                    duenger: '175',
                    entries: []
                }],
                _lv: 4
            });
            w.loadState();
            expect(w.state.reiter[0].hektar).toBe(12.5);
            expect(w.state.reiter[0].istHektar).toBe(10);
            expect(w.state.reiter[0].koerner).toBe(85000);
            expect(w.state.reiter[0].duenger).toBe(175);
        });

        it('rejects NaN and Infinity in number fields', () => {
            store['agrar_rechner'] = JSON.stringify({
                reiter: [{
                    name: 'Bad',
                    hektar: null,
                    istHektar: NaN,
                    koerner: Infinity,
                    duenger: -Infinity,
                    entries: []
                }],
                _lv: 4
            });
            w.loadState();
            // sanitizeNumber: NaN, Infinity, -Infinity, null → fallback (0)
            expect(w.state.reiter[0].hektar).toBe(0);
            expect(w.state.reiter[0].istHektar).toBe(0);
            expect(w.state.reiter[0].koerner).toBe(0);
            expect(w.state.reiter[0].duenger).toBe(0);
        });

        it('falls back to "Schlag" when name is missing or non-string', () => {
            store['agrar_rechner'] = JSON.stringify({
                reiter: [{ hektar: 0, koerner: 0, duenger: 0, entries: [] }],
                _lv: 4
            });
            w.loadState();
            expect(w.state.reiter[0].name).toBe('Schlag');
        });

        it('truncates oversize name to 64 chars', () => {
            const longName = 'A'.repeat(200);
            store['agrar_rechner'] = JSON.stringify({
                reiter: [{ name: longName, entries: [] }],
                _lv: 4
            });
            w.loadState();
            expect(w.state.reiter[0].name.length).toBe(64);
        });
    });

    describe('Prototype pollution protection', () => {
        it('strips __proto__ from entries', () => {
            store['agrar_rechner'] = JSON.stringify({
                reiter: [{
                    name: 'P',
                    entries: [{
                        __proto__: { polluted: true },
                        einheit: 5,
                        duenger: 200,
                        time: 12345
                    }]
                }],
                _lv: 4
            });
            w.loadState();
            // Kein Object.prototype-Feld "polluted" auf irgendeinem Object
            expect(({}).polluted).toBeUndefined();
            // Entry ist sauber, nur erlaubte Felder
            const entry = w.state.reiter[0].entries[0];
            expect(entry.polluted).toBeUndefined();
            expect(entry.einheit).toBe(5);
        });

        it('strips constructor and prototype keys at any nesting level', () => {
            store['agrar_rechner'] = JSON.stringify({
                reiter: [{
                    entries: [{
                        constructor: { polluted: true },
                        prototype: { polluted: true },
                        einheit: 1
                    }]
                }],
                _lv: 4
            });
            w.loadState();
            // 1) Kein Object.prototype-Feld wurde injiziert
            expect(({}).polluted).toBeUndefined();
            // 2) entry.constructor ist die echte Object-Constructor-Funktion
            //    (kein eigenes "constructor"-Property injiziert). jsdom-Realm-
            //    aware: nutze den live-Auslese über entry.__proto__.constructor
            const entry = w.state.reiter[0].entries[0];
            expect(Object.prototype.hasOwnProperty.call(entry, 'constructor')).toBe(false);
            // 3) entry.prototype ist nicht versehentlich persistiert
            expect(Object.prototype.hasOwnProperty.call(entry, 'prototype')).toBe(false);
        });

        it('rejects non-plain entries (arrays, class instances, null)', () => {
            store['agrar_rechner'] = JSON.stringify({
                reiter: [{
                    entries: [
                        [1, 2, 3],                       // Array statt Object
                        'just a string',                 // String
                        null,                            // null
                        { einheit: 5, duenger: 1, time: 1 }  // valid
                    ]
                }],
                _lv: 4
            });
            w.loadState();
            // Nur der eine valide Eintrag überlebt
            expect(w.state.reiter[0].entries.length).toBe(1);
            expect(w.state.reiter[0].entries[0].einheit).toBe(5);
        });

        it('does not pollute Object.prototype via the reviver', () => {
            const sentinel = '__polluted_' + Date.now();
            // JSON.parse kann __proto__ per Spec nicht direkt setzen,
            // aber der Reviver entzieht ihm jeden Angriffsvektor.
            store['agrar_rechner'] = JSON.stringify({
                reiter: [{ entries: [{ __proto__: { [sentinel]: true } }] }],
                _lv: 4
            });
            w.loadState();
            expect(({})[sentinel]).toBeUndefined();
        });
    });

    describe('Unknown / extra fields are stripped', () => {
        it('drops unknown keys from tab objects', () => {
            store['agrar_rechner'] = JSON.stringify({
                reiter: [{
                    name: 'X',
                    hektar: 0,
                    entries: [],
                    // Beliebige eingeschleuste Felder
                    __evil: 'xss',
                    onload: 'alert(1)',
                    eval: 'malicious',
                    toString: 'tampered'
                }],
                _lv: 4
            });
            w.loadState();
            const tab = w.state.reiter[0];
            expect(tab.__evil).toBeUndefined();
            expect(tab.onload).toBeUndefined();
            expect(tab.eval).toBeUndefined();
            // toString bleibt Object.prototype.toString (Function), kein überschriebener String
            expect(typeof tab.toString).toBe('function');
        });

        it('a state without the removed top-level keys is still valid (Issue #291)', () => {
            // Fresh state from a current build: the field that was removed in
            // the protokoll-sheet refactor (Issue #291) is no longer in the
            // schema. loadState must accept a state that does not carry it
            // and not complain about the missing key.
            store['agrar_rechner'] = JSON.stringify({
                reiter: [{ entries: [] }],
                _lv: 4
            });
            expect(() => w.loadState()).not.toThrow();
            // State should be loadable and the reiter should still be there
            expect(w.state.reiter.length).toBe(1);
        });

        it('drops unknown keys from entry objects', () => {
            store['agrar_rechner'] = JSON.stringify({
                reiter: [{
                    entries: [{
                        einheit: 1,
                        duenger: 1,
                        time: 1,
                        xss: '<script>',
                        onclick: 'evil()',
                        extra: { nested: true }
                    }]
                }],
                _lv: 4
            });
            w.loadState();
            const entry = w.state.reiter[0].entries[0];
            expect(entry.xss).toBeUndefined();
            expect(entry.onclick).toBeUndefined();
            expect(entry.extra).toBeUndefined();
            // Erlaubte Felder bleiben erhalten
            expect(entry.einheit).toBe(1);
            expect(entry.time).toBe(1);
        });

        it('strips unknown top-level state fields but keeps recognized ones', () => {
            store['agrar_rechner'] = JSON.stringify({
                reiter: [{ name: 'Tab 1', entries: [] }],
                _lv: 4,
                xss: 'top-level',
                injected: { evil: true },
                activeReiter: 0
            });
            w.loadState();
            expect(w.state.xss).toBeUndefined();
            expect(w.state.injected).toBeUndefined();
            // Recognized field ist noch da
            expect(w.state.activeReiter).toBe(0);
        });
    });

    describe('activeView coercion (Pre-#291 View-Toggle pattern)', () => {
        it('coerces activeView to null unless literally "protokoll"', () => {
            store['agrar_rechner'] = JSON.stringify({
                reiter: [{ name: 'Tab 1', entries: [] }],
                activeView: 'random-string',
                _lv: 4
            });
            w.loadState();
            expect(w.state.activeView).toBeNull();
        });

        it('preserves activeView = "protokoll"', () => {
            store['agrar_rechner'] = JSON.stringify({
                reiter: [{ name: 'Tab 1', entries: [] }],
                activeView: 'protokoll',
                _lv: 4
            });
            w.loadState();
            expect(w.state.activeView).toBe('protokoll');
        });

        it('coerces non-string activeView values (numbers, objects, arrays) to null', () => {
            store['agrar_rechner'] = JSON.stringify({
                reiter: [{ name: 'Tab 1', entries: [] }],
                activeView: 42,
                _lv: 4
            });
            w.loadState();
            expect(w.state.activeView).toBeNull();

            store['agrar_rechner'] = JSON.stringify({
                reiter: [{ name: 'Tab 1', entries: [] }],
                activeView: { evil: true },
                _lv: 4
            });
            w.loadState();
            expect(w.state.activeView).toBeNull();
        });

        it('defaults activeView to null when missing from persisted state', () => {
            store['agrar_rechner'] = JSON.stringify({
                reiter: [{ name: 'Tab 1', entries: [] }],
                _lv: 4
            });
            w.loadState();
            expect(w.state.activeView).toBeNull();
        });
    });

    describe('Missing / malformed fields use safe defaults', () => {
        it('fills missing tab fields with zero defaults', () => {
            store['agrar_rechner'] = JSON.stringify({
                reiter: [{ entries: [] }],   // komplett leerer Tab
                _lv: 4
            });
            w.loadState();
            const t = w.state.reiter[0];
            expect(t.hektar).toBe(0);
            expect(t.istHektar).toBe(0);
            expect(t.koerner).toBe(0);
            expect(t.duenger).toBe(0);
            expect(t.name).toBe('Schlag');
        });

        it('uses empty array for missing entries', () => {
            store['agrar_rechner'] = JSON.stringify({
                reiter: [{ name: 'NoEntries' }],   // keine entries
                _lv: 4
            });
            w.loadState();
            expect(w.state.reiter[0].entries).toEqual([]);
        });

        it('uses empty array when entries is not an array', () => {
            store['agrar_rechner'] = JSON.stringify({
                reiter: [{ name: 'X', entries: 'not-an-array' }],
                _lv: 4
            });
            w.loadState();
            expect(w.state.reiter[0].entries).toEqual([]);
        });

        it('clamps activeReiter into valid range', () => {
            store['agrar_rechner'] = JSON.stringify({
                reiter: [{ name: 'A', entries: [] }],
                activeReiter: 99,        // out of range
                _lv: 4
            });
            w.loadState();
            expect(w.state.activeReiter).toBe(0);

            store['agrar_rechner'] = JSON.stringify({
                reiter: [{ name: 'A', entries: [] }, { name: 'B', entries: [] }],
                activeReiter: -1,        // negative
                _lv: 4
            });
            w.loadState();
            expect(w.state.activeReiter).toBe(0);

            store['agrar_rechner'] = JSON.stringify({
                reiter: [{ name: 'A', entries: [] }, { name: 'B', entries: [] }],
                activeReiter: 1,         // valid
                _lv: 4
            });
            w.loadState();
            expect(w.state.activeReiter).toBe(1);
        });

        it('falls back to 50000 for invalid koernerProEinheit', () => {
            store['agrar_rechner'] = JSON.stringify({
                reiter: [{ entries: [] }],
                koernerProEinheit: 'pickle',
                _lv: 4
            });
            w.loadState();
            expect(w.state.koernerProEinheit).toBe(50000);
        });

        it('uses defaults for falsy/empty machineLog and drillPriorities', () => {
            store['agrar_rechner'] = JSON.stringify({
                reiter: [{ entries: [] }],
                machineLog: 'not-an-array',
                drillPriorities: [1, 2, 3],   // Array, kein Plain Object
                _lv: 4
            });
            w.loadState();
            expect(w.state.machineLog).toEqual([]);
            expect(w.state.drillPriorities).toEqual({});
        });

        it('sanitizes machineLog entries and drops invalid ones', () => {
            store['agrar_rechner'] = JSON.stringify({
                reiter: [{ entries: [] }],
                machineLog: [
                    { time: 1000, einheit: 5, duenger: 200 },                  // OK
                    'not an object',                                            // drop
                    null,                                                       // drop
                    { time: 'bad', einheit: 1, duenger: 1, xss: 'evil' }       // xss raus
                ],
                _lv: 4
            });
            w.loadState();
            expect(w.state.machineLog.length).toBe(2);
            expect(w.state.machineLog[0].einheit).toBe(5);
            expect(w.state.machineLog[1].xss).toBeUndefined();
        });
    });

    describe('Manipulated state does not crash app', () => {
        it('loadState() returns true on partially malformed but recoverable state', () => {
            store['agrar_rechner'] = JSON.stringify({
                reiter: [{
                    name: 'T',
                    hektar: 'NaN-ish',
                    koerner: undefined,
                    entries: [{ einheit: 1 }, null, { __proto__: { x: 1 } }]
                }],
                activeReiter: 'oops',
                _lv: 4
            });
            expect(() => w.loadState()).not.toThrow();
            // App bleibt in lauffähigem Zustand
            expect(Array.isArray(w.state.reiter)).toBe(true);
            expect(w.state.reiter.length).toBe(1);
            expect(typeof w.state.reiter[0].name).toBe('string');
        });

        it('loadState() rejects completely malformed root (string, number, array)', () => {
            store['agrar_rechner'] = '"just a string"';
            expect(() => w.loadState()).not.toThrow();
            // State unverändert (Default bleibt)
            expect(w.state.reiter.length).toBe(1);
            expect(w.state.reiter[0].name).toBe('Schlag 1');

            store['agrar_rechner'] = '42';
            expect(() => w.loadState()).not.toThrow();

            store['agrar_rechner'] = '[]';
            expect(() => w.loadState()).not.toThrow();
            expect(w.state.reiter.length).toBe(1);
        });
    });

    describe('Round-trip safety: save → load preserves valid data, drops garbage', () => {
        it('a cleanly saved state round-trips without data loss', () => {
            w.state.reiter[0].hektar = 7.5;
            w.state.reiter[0].koerner = 90000;
            w.state.reiter[0].duenger = 150;
            w.state.reiter[0].entries = [
                { time: 1, einheit: 1, duenger: 50, hektar: 1, istHektar: 0, koerner: 90000, duengerRate: 150 }
            ];
            w.saveState();

            // Reset state und re-load
            w.state = {
                reiter: [{ name: 'Reset', hektar: 0, istHektar: 0, koerner: 0, duenger: 0, entries: [] }],
                activeReiter: 0
            };
            w.loadState();
            expect(w.state.reiter[0].hektar).toBe(7.5);
            expect(w.state.reiter[0].koerner).toBe(90000);
            expect(w.state.reiter[0].entries.length).toBe(1);
            expect(w.state.reiter[0].entries[0].einheit).toBe(1);
        });

        it('corrupting stored state in place is repaired silently on next load', () => {
            w.state.reiter[0].hektar = 5;
            w.saveState();

            // Direkt den gespeicherten String manipulieren
            const raw = JSON.parse(store['agrar_rechner']);
            raw.reiter[0].hektar = '<script>';
            raw.reiter[0].entries = [{ einheit: 1, xss: 'evil', __proto__: { polluted: true } }];
            store['agrar_rechner'] = JSON.stringify(raw);

            w.loadState();
            expect(w.state.reiter[0].hektar).toBe(0);          // default
            expect(w.state.reiter[0].entries[0].xss).toBeUndefined();
            expect(({}).polluted).toBeUndefined();
        });
    });
});
