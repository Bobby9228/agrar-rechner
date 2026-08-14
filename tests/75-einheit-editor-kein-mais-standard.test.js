/**
 * Bug-Fix #2: Der statische Hilfetext im Einheiten-Editor
 * (#einheit_groesse_settings) nannte hartcodiert "üblich: 50.000" — das
 * ist der Mais-Standard und irreführend für Raps oder Sonstiges.
 *
 * Vereinbarung: kulturunabhängige Formulierung, die den globalen Standard
 * NICHT als Zahl nennt.
 *
 * Test liest direkt die echte public/index.html und sucht NUR im
 * Editor-Bereich (#einheit_groesse_settings), nirgends sonst.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(__dirname, '../public/index.html');
const htmlSource = readFileSync(htmlPath, 'utf-8');

function getEditorInfoText() {
  // Parsen gegen echtes HTML, damit der Test an genau der Stelle
  // ansetzt, die auch im Browser gerendert wird.
  const dom = new JSDOM(htmlSource);
  const settings = dom.window.document.getElementById('einheit_groesse_settings');
  if (!settings) return '';
  const info = settings.querySelector('.fahrgassen-info');
  return info ? info.textContent : '';
}

describe('Einheiten-Editor (statischer Hilfetext) ist kulturunabhängig', () => {
  it('echte index.html: keine Mais-spezifische Standard-Zahl im Editor-Hilfetext', () => {
    const infoText = getEditorInfoText();
    expect(infoText).toBeTruthy(); // Editor muss überhaupt einen Hilfetext haben

    // Hauptbefund: kein hartcodierter Mais-Standard mehr
    expect(infoText.indexOf('üblich: 50.000')).toBe(-1);
    expect(infoText.indexOf('üblich: 50000')).toBe(-1);
    expect(infoText.indexOf('50.000')).toBe(-1);

    // Auch keine anderen konkreten Kultur-Defaults
    expect(infoText.indexOf('Mais')).toBe(-1);
    expect(infoText.indexOf('Raps')).toBe(-1);
    expect(infoText.indexOf('Sonstiges')).toBe(-1);
  });
});
