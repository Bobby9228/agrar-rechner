
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
    clear: () => Object.keys(store).forEach(k => delete store[k]),
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
    load('render-tabs.js'),
    load('render-results.js'),
    load('render-drill.js'),
    load('render-dashboard.js'),
    load('main.js').replace("document.addEventListener('DOMContentLoaded', initUI);", ''),
].join('\n');

dom.window.eval(moduleScript);

if (typeof dom.window.initUI === 'function') {
    dom.window.initUI();
}

const tests = [
    ['parseDE', typeof dom.window.parseDE === 'function'],
    ['fmt', typeof dom.window.fmt === 'function'],
    ['state', typeof dom.window.state === 'object'],
    ['initUI', typeof dom.window.initUI === 'function'],
    ['getCarryover', typeof dom.window.getCarryover === 'function'],
    ['computeAllCarryovers', typeof dom.window.computeAllCarryovers === 'function'],
    ['getTabKornerGesamt', typeof dom.window.getTabKornerGesamt === 'function'],
    ['getKornerGesamt', typeof dom.window.getKornerGesamt === 'function'],
    ['getTotalDuenger', typeof dom.window.getTotalDuenger === 'function'],
    ['getTotalEinheiten', typeof dom.window.getTotalEinheiten === 'function'],
];

let passed = 0, failed = 0;
for (const [name, ok] of tests) {
    if (ok) { passed++; console.log('PASS:', name); }
    else { failed++; console.log('FAIL:', name, '- type:', typeof dom.window[name]); }
}
console.log(passed + '/' + (passed+failed) + ' basic checks passed');
