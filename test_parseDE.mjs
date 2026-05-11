
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const jsDir = resolve('./public/js');
const load = n => readFileSync(resolve(jsDir, n), 'utf-8');
const html = readFileSync('./public/index.html', 'utf-8');
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/' });

Object.defineProperty(dom.window, 'matchMedia', {
    value: (q) => ({ matches: false, media: q, onchange: null, addListener: () => {}, removeListener: () => {} }),
    writable: true,
});
Object.defineProperty(dom.window.navigator, 'standalone', { value: undefined, writable: true });
Object.defineProperty(dom.window.navigator, 'serviceWorker', { value: { register: () => {} }, writable: true });
const store = {};
const ls = {
    getItem: (key) => store[key] ?? null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => {},
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i] ?? null,
};
Object.defineProperty(dom.window, 'localStorage', { value: ls, writable: true });
Object.defineProperty(dom.window, 'sessionStorage', { value: ls, writable: true });

const moduleScript = [
    'var _internal = { carryoverCache: null, drillCalcTimer: null, pendingKey: null };',
    load('state.js'),
    load('calculations.js'),
    load('ui-handlers.js'),
    load('rendering.js'),
    load('main.js').replace("document.addEventListener('DOMContentLoaded', initUI);", ''),
].join('\n');

dom.window.eval(moduleScript);
dom.window.initUI();

// Test parseDE
const tests = [
    ['', 'empty string'],
    [null, 'null'],
    [undefined, 'undefined'],
    ['123', 'string number'],
    ['123,5', 'DE decimal'],
    [123, 'already number'],
];
for (const [input, label] of tests) {
    try {
        const result = dom.window.parseDE(input);
        console.log(`parseDE(${label}) = ${JSON.stringify(result)} (typeof: ${typeof result})`);
    } catch (e) {
        console.log(`parseDE(${label}) ERROR: ${e.message}`);
    }
}
