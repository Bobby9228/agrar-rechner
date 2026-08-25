/**
 * Issue #447 Welle 2a — Saldo- und Forecast-SSOT.
 *
 * Konsolidiert zwei Rechen-Duplikate, die vorher in den Renderern lebten:
 *
 *   - getTabSaldoE / getTabSaldoD: reine signed SOLL−IST-Subtraktion
 *     pro Tab. Vorher 5× dupliziert in render-drill.js + render-local-
 *     protocol.js als `getTabTotalEinheiten(r) - getTabIstEinheiten(r)`
 *     und `(r.hektar - istHek) * (r.duenger || 0)`. Diese Suite testet
 *     die extrahierte Funktion unabhängig von jedem Renderer.
 *
 *   - computeMachineForecast(log, unitsPerHa, duengerPerHa): kumulativer
 *     Tank-Walk über machineLog mit `lastZaehler`/`driven`-Clamp. Vorher
 *     fast identisch in render-drill.js renderMachineLog() und
 *     render-local-protocol.js _getCurrentMachineForecast(). Diese
 *     Suite testet die Walk-Schritte isoliert, ohne DOM/State.
 *
 * Reine Pure-Function-Tests — keine createDom, kein jsdom. Damit die
 * Reine-SSOT-Disziplin auch über die Tests gespiegelt wird.
 *
 * Hintergrund: TDD strikt eingehalten — die Tests in dieser Datei wurden
 * ZUERST geschrieben (RED), die Funktionen wurden DANACH extrahiert
 * (GREEN).
 */

import { describe, it, expect } from 'vitest';
import { createDom } from './helpers.js';

// ---------------------------------------------------------------------------
// getTabSaldoE / getTabSaldoD — signed SOLL−IST-Subtraktion
// ---------------------------------------------------------------------------

describe('Issue #447 Welle 2a — getTabSaldoE/getTabSaldoD', () => {
  describe('getTabSaldoE — signed Saat-Saldo', () => {
    it('positiver Saldo: SOLL > IST (Ersparnis)', () => {
      const w = createDom().window;
      // 12 ha SOLL, 10 ha IST bei 50000 koerner/ha → Soll=12, Ist=10 → Saldo=+2
      var r = { hektar: 12, istHektar: 10, koerner: 50000, duenger: 0 };
      expect(w.getTabSaldoE(r)).toBe(2);
    });

    it('negativer Saldo: IST > SOLL (Mehrverbrauch)', () => {
      const w = createDom().window;
      // 10 ha SOLL, 12 ha IST → Soll=10, Ist=12 → Saldo=−2
      var r = { hektar: 10, istHektar: 12, koerner: 50000, duenger: 0 };
      expect(w.getTabSaldoE(r)).toBe(-2);
    });

    it('null Saldo: SOLL === IST', () => {
      const w = createDom().window;
      var r = { hektar: 10, istHektar: 10, koerner: 50000, duenger: 0 };
      expect(w.getTabSaldoE(r)).toBe(0);
    });

    it('fehlende Felder → 0 (nil-safe)', () => {
      const w = createDom().window;
      // Leeres Tab-Objekt — darf nicht werfen, liefert 0
      expect(w.getTabSaldoE({})).toBe(0);
    });

    it('Konsistenz mit direktem Aufruf (Round-Trip-Definition)', () => {
      const w = createDom().window;
      // Die Funktion MUSS identisch zur in-place-Subtraktion sein.
      // Test mit Fahrgassen-Korrektur (breite 24 → Faktor 23/24).
      w.state.fahrgassenEnabled = true;
      w.state.fahrgassenBreite = 24;
      var r = { hektar: 12, istHektar: 10, koerner: 90000, duenger: 0 };
      var expected = Math.round(((w.getTabTotalEinheiten(r) - w.getTabIstEinheiten(r))) * 1e6) / 1e6;
      // round6: getTabTotalEinheiten/getTabIstEinheiten geben round6 zurück.
      var actual = w.getTabSaldoE(r);
      // round6 im Helper; exakt gleich, weil 12*90000/50000*(23/24) = 10.35,
      // 10*90000/50000*(23/24) = 8.625, diff = 1.725.
      expect(actual).toBe(expected);
      w.state.fahrgassenEnabled = false;
    });

    it('rundet via round6 (Issue #447 — Saat auf 6 NK)', () => {
      const w = createDom().window;
      // Wähle Werte, bei denen die Subtraktion einen 6-NK-rest ergibt.
      var r = { hektar: 7, istHektar: 3, koerner: 90000, duenger: 0 };
      var v = w.getTabSaldoE(r);
      // 6 NK-Genauigkeit: value * 1e6 muss eine ganze Zahl sein
      expect(Math.round(v * 1e6)).toBe(v * 1e6);
    });
  });

  describe('getTabSaldoD — signed Dünger-Saldo', () => {
    it('positiver Saldo: SOLL > IST (Ersparnis)', () => {
      const w = createDom().window;
      // 12 ha SOLL × 100 kg/ha = 1200 kg SOLL; 10 ha × 100 = 1000 kg IST → Saldo=+200
      var r = { hektar: 12, istHektar: 10, duenger: 100 };
      expect(w.getTabSaldoD(r)).toBe(200);
    });

    it('negativer Saldo: IST > SOLL (Mehrverbrauch)', () => {
      const w = createDom().window;
      var r = { hektar: 10, istHektar: 12, duenger: 100 };
      expect(w.getTabSaldoD(r)).toBe(-200);
    });

    it('null Saldo: SOLL === IST', () => {
      const w = createDom().window;
      var r = { hektar: 10, istHektar: 10, duenger: 100 };
      expect(w.getTabSaldoD(r)).toBe(0);
    });

    it('fehlende Felder → 0 (nil-safe)', () => {
      const w = createDom().window;
      expect(w.getTabSaldoD({})).toBe(0);
    });

    it('fehlender duenger-Rate (Sonstiges) → 0', () => {
      const w = createDom().window;
      var r = { hektar: 12, istHektar: 10 };
      expect(w.getTabSaldoD(r)).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// computeMachineForecast — kumulativer Tank-Walk
// ---------------------------------------------------------------------------

describe('Issue #447 Welle 2a — computeMachineForecast', () => {
  it('leere Log → hasLog=false, alle Werte 0/null', () => {
    const w = createDom().window;
    var fc = w.computeMachineForecast([], 1.8, 100);
    expect(fc.hasLog).toBe(false);
    expect(fc.cumEinheit).toBe(0);
    expect(fc.cumDuenger).toBe(0);
    expect(fc.lastZaehler).toBe(0);
    expect(fc.saatLeer).toBe(null);
    expect(fc.duengerLeer).toBe(null);
  });

  it('Log null/undefined → leere Log (nil-safe)', () => {
    const w = createDom().window;
    expect(() => w.computeMachineForecast(null, 1.8, 100)).not.toThrow();
    var fc = w.computeMachineForecast(null, 1.8, 100);
    expect(fc.hasLog).toBe(false);
  });

  it('Entry ohne zaehlerStand nutzt hektar als Fallback', () => {
    const w = createDom().window;
    // entry: einheit=5, duenger=200, hektar=2 (kein zaehlerStand)
    // lastZaehler startet bei 0, driven = max(0, 2-0) = 2
    // cumEinheit = max(0, 0 - 2*1.8) + 5 = 0 + 5 = 5 (geclampt)
    // cumDuenger = max(0, 0 - 2*100) + 200 = 0 + 200 = 200 (geclampt)
    var log = [{ einheit: 5, duenger: 200, hektar: 2 }];
    var fc = w.computeMachineForecast(log, 1.8, 100);
    expect(fc.cumEinheit).toBe(5);
    expect(fc.cumDuenger).toBe(200);
    expect(fc.lastZaehler).toBe(2);
  });

  it('Entry ohne zaehlerStand UND ohne hektar → zaehler=0', () => {
    const w = createDom().window;
    // Defensive: leeres entry-Objekt → zaehler=0, driven=0, nur Auffüllung
    var log = [{ einheit: 3, duenger: 100 }];
    var fc = w.computeMachineForecast(log, 1.8, 100);
    expect(fc.cumEinheit).toBe(3);
    expect(fc.cumDuenger).toBe(100);
    expect(fc.lastZaehler).toBe(0);
  });

  it('zaehlerStand=0 wird NICHT auf hektar zurückfallthrough (Issue #307 Pattern #1)', () => {
    const w = createDom().window;
    // entry: einheit=24, zaehlerStand=0 (EXPLIZIT 0), hektar=15
    // lastZaehler=0, driven=max(0, 0-0)=0
    // cumEinheit = max(0, 0-0) + 24 = 24
    // cumDuenger = max(0, 0-0) + 2000 = 2000
    var log = [{ einheit: 24, zaehlerStand: 0, duenger: 2000, hektar: 15 }];
    var fc = w.computeMachineForecast(log, 1.8, 200);
    expect(fc.cumEinheit).toBe(24);
    expect(fc.cumDuenger).toBe(2000);
    expect(fc.lastZaehler).toBe(0);
    // saatLeer = 0 + 24/1.8 = 13,333… (genauer: 13.3333...)
    expect(fc.saatLeer).toBeCloseTo(13.333333, 5);
  });

  it('driven-Clamp bei zurückgehendem Zählerstand (kein negativ-Effekt)', () => {
    const w = createDom().window;
    // Erstes entry: zaehlerStand=10 → lastZaehler=10, cumEinheit=5
    // Zweites entry: zaehlerStand=2 (zurück!) → driven=max(0, 2-10)=0
    //   cumEinheit = max(0, 5 - 0) + 3 = 8
    var log = [
      { einheit: 5, zaehlerStand: 10, duenger: 100 },
      { einheit: 3, zaehlerStand: 2, duenger: 50 },
    ];
    var fc = w.computeMachineForecast(log, 1.0, 50);
    expect(fc.cumEinheit).toBe(8);
    expect(fc.cumDuenger).toBe(150);
    expect(fc.lastZaehler).toBe(2);
  });

  it('saatLeer=null wenn unitsPerHa=0 (Rate aus)', () => {
    const w = createDom().window;
    // unitsPerHa=0 → saat-Prognose nicht berechenbar (Division durch 0).
    // duengerPerHa=100 und entry.duenger=200 → cumDuenger=200 → duengerLeer=0+200/100=2.
    var log = [{ einheit: 5, zaehlerStand: 0, duenger: 200 }];
    var fc = w.computeMachineForecast(log, 0, 100);
    expect(fc.saatLeer).toBe(null);
    expect(fc.duengerLeer).toBe(2);
  });

  it('duengerLeer=null wenn duengerPerHa=0 (Rate aus)', () => {
    const w = createDom().window;
    var log = [{ einheit: 5, zaehlerStand: 0 }];
    var fc = w.computeMachineForecast(log, 1.0, 0);
    expect(fc.saatLeer).toBe(5); // 0 + 5/1.0 = 5
    expect(fc.duengerLeer).toBe(null);
  });

  it('saatLeer=null wenn cumEinheit=0 (Tank leer trotz Rate)', () => {
    const w = createDom().window;
    // Entry ohne Einheiten — cum bleibt 0 → saatLeer=null, duengerLeer=null
    var log = [{ einheit: 0, zaehlerStand: 5, duenger: 0 }];
    var fc = w.computeMachineForecast(log, 1.0, 100);
    expect(fc.saatLeer).toBe(null);
    expect(fc.duengerLeer).toBe(null);
  });

  it('Deterministisches 3-Entry-Beispiel handisch nachgerechnet', () => {
    const w = createDom().window;
    // Tab: koerner=90000, kpe=50000, duenger=200 → unitsPerHa=1.8, duengerPerHa=200
    //
    // Entry 1: einheit=24, zaehlerStand=0, duenger=2000
    //   zaehler=0, lastZaehler=0 → driven=0
    //   cumEinheit = max(0, 0-0*1.8) + 24 = 24
    //   cumDuenger = max(0, 0-0*200) + 2000 = 2000
    //   lastZaehler=0
    //   saatLeer = 0 + 24/1.8 = 13.3333
    //   duengerLeer = 0 + 2000/200 = 10
    //
    // Entry 2: einheit=0, zaehlerStand=0, duenger=1000 (Dünger-only refill, Issue #307 Pattern #2)
    //   zaehler=0, lastZaehler=0 → driven=0
    //   cumEinheit = max(0, 24-0) + 0 = 24 (Saat-Prognose überlebt!)
    //   cumDuenger = max(0, 2000-0) + 1000 = 3000
    //   lastZaehler=0
    //   saatLeer = 0 + 24/1.8 = 13.3333 (unverändert!)
    //   duengerLeer = 0 + 3000/200 = 15
    //
    // Entry 3: einheit=5, zaehlerStand=10, duenger=0
    //   zaehler=10, lastZaehler=0 → driven=10
    //   cumEinheit = max(0, 24 - 10*1.8) + 5 = max(0, 24-18) + 5 = 6 + 5 = 11
    //   cumDuenger = max(0, 3000 - 10*200) + 0 = max(0, 3000-2000) + 0 = 1000 + 0 = 1000
    //   lastZaehler=10
    //   saatLeer = 10 + 11/1.8 = 10 + 6.1111 = 16.1111
    //   duengerLeer = 10 + 1000/200 = 10 + 5 = 15
    var log = [
      { einheit: 24, zaehlerStand: 0, duenger: 2000, time: '10:00' },
      { einheit: 0,  zaehlerStand: 0, duenger: 1000, time: '11:00' },
      { einheit: 5,  zaehlerStand: 10, duenger: 0,    time: '12:00' },
    ];
    var fc = w.computeMachineForecast(log, 1.8, 200);

    expect(fc.hasLog).toBe(true);
    expect(fc.lastZaehler).toBe(10);
    // cumEinheit / cumDuenger sind interne Werte, die der Aufrufer normalerweise
    // nicht direkt liest (nur saatLeer/duengerLeer). Aber für deterministische
    // Verifikation prüfen wir auch die internen Akkumulatoren.
    expect(fc.cumEinheit).toBeCloseTo(11, 5);
    expect(fc.cumDuenger).toBeCloseTo(1000, 5);
    // saatLeer für Entry 3:
    expect(fc.saatLeer).toBeCloseTo(16.111111, 5);
    // duengerLeer für Entry 3:
    expect(fc.duengerLeer).toBe(15);
  });

  it('Issue #307 Pattern #2: Saat-Prognose überlebt Dünger-only follow-up entry', () => {
    const w = createDom().window;
    // Reproduktion des existing tests/machine-log.test.js Pattern #2.
    var log = [
      { einheit: 24, zaehlerStand: 0, duenger: 2000, hektar: 15 },
      { einheit: 0,  zaehlerStand: 0, duenger: 1000, hektar: 15 },
    ];
    var fc = w.computeMachineForecast(log, 1.8, 200);
    // Nach 2 Entries: cumEinheit=24 (Saat-Prognose lebt!), saatLeer=13.333
    expect(fc.cumEinheit).toBe(24);
    expect(fc.saatLeer).toBeCloseTo(13.333333, 5);
    // Nach 2 Entries: cumDuenger=3000, duengerLeer=15
    expect(fc.cumDuenger).toBe(3000);
    expect(fc.duengerLeer).toBe(15);
  });

  it('hektar-Fallback greift nur wenn zaehlerStand NICHT gesetzt (Issue #307)', () => {
    const w = createDom().window;
    // entry.hektar ist der Plan-Wert (Soll), nicht der Counter. Wenn
    // zaehlerStand fehlt → fallback auf hektar.
    // entry: einheit=5, zaehlerStand=null/undefined, duenger=100, hektar=10
    // → zaehler=10, driven=10, cumEinheit = max(0, 0 - 10*1.0) + 5 = 0+5 = 5
    var log = [{ einheit: 5, zaehlerStand: null, duenger: 100, hektar: 10 }];
    var fc = w.computeMachineForecast(log, 1.0, 50);
    expect(fc.cumEinheit).toBe(5);
    expect(fc.cumDuenger).toBe(100);
    expect(fc.lastZaehler).toBe(10);
  });
});

describe('Issue #447 Welle 2a — computeMachineForecastSeries', () => {
  it('ist definiert, pure und liefert leere Serie für leeres/null Log', () => {
    const w = createDom().window;
    expect(typeof w.AppGlobals.computeMachineForecastSeries, 'computeMachineForecastSeries fehlt auf AppGlobals').toBe('function');
    expect(w.computeMachineForecastSeries([], 1, 1).series.length).toBe(0);
    expect(w.computeMachineForecastSeries([], 1, 1).hasLog).toBe(false);
    expect(w.computeMachineForecastSeries(null, 1, 1).series.length).toBe(0);
  });

  it('liefert je Entry den Tank-Snapshot NACH dem Entry (handisch nachgerechnet)', () => {
    const w = createDom().window;
    var log = [
      { einheit: 24, duenger: 2000, zaehlerStand: 0 },
      { einheit: 6,  duenger: 500,  zaehlerStand: 8 },
      { einheit: 2,  duenger: 0,    zaehlerStand: 3 },
    ];
    // Raten: 2 E/ha, 300 kg/ha
    var s = w.computeMachineForecastSeries(log, 2, 300).series;
    expect(s.length).toBe(3);
    // Entry 1: driven=0 → cumE=24, cumD=2000, z=0
    expect(s[0].cumEinheit).toBe(24);
    expect(s[0].cumDuenger).toBe(2000);
    expect(s[0].zaehler).toBe(0);
    // Entry 2: driven=8 → cumE=max(0,24-16)+6=14, cumD=max(0,2000-2400)+500=500, z=8
    expect(s[1].cumEinheit).toBe(14);
    expect(s[1].cumDuenger).toBe(500);
    expect(s[1].zaehler).toBe(8);
    // Entry 3: driven=max(0,3-8)=0 (Rückgang geclampt) → cumE=16, cumD=500, z=3
    expect(s[2].cumEinheit).toBe(16);
    expect(s[2].cumDuenger).toBe(500);
    expect(s[2].zaehler).toBe(3);
  });

  it('ist exakt äquivalent zu Prefix-Aufrufen von computeMachineForecast', () => {
    const w = createDom().window;
    // Zufalls-Log mit allen Sonderfällen: Rückgang im Zaehlerstand,
    // fehlende Felder, hektar-Fallback.
    var log = [
      { einheit: 12, zaehlerStand: 0, duenger: 800, hektar: 20 },
      { einheit: 3,  hektar: 9 },                       // zaehlerStand fehlt → Fallback hektar
      { einheit: 7,  zaehlerStand: 25 },                // Sprung nach vorn
      { einheit: 0,  zaehlerStand: 4 },                 // Rückgang → driven=0
      {},                                               // alles leer
      { einheit: 30, zaehlerStand: null, hektar: null } // beides null → z=0
    ];
    var rates = [1.8, 200];
    var s = w.computeMachineForecastSeries(log, rates[0], rates[1]).series;
    for (var i = 0; i < log.length; i++) {
      var prefixFc = w.computeMachineForecast(log.slice(0, i + 1), rates[0], rates[1]);
      expect(s[i].cumEinheit === prefixFc.cumEinheit, 'cumEinheit divergiert bei i=' + i).toBe(true);
      expect(s[i].cumDuenger === prefixFc.cumDuenger, 'cumDuenger divergiert bei i=' + i).toBe(true);
      expect(s[i].zaehler === prefixFc.lastZaehler, 'zaehler divergiert bei i=' + i).toBe(true);
    }
  });
});
