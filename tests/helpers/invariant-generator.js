// Carryover-Invariante-Generator: erzeugt reproduzierbare state.reiter-Szenarien.
//
// Dependency-free, deterministisch (seed → mulberry32 PRNG). Wird von
// tests/55-carryover-invariants.test.js verwendet, um 5 Carryover-Regeln
// gegen 200+ Zufallsszenarien pro Invariante zu prüfen.
//
// API: generateScenarios(seed, count) → Array<state>
//   - seed: 32-bit unsigned int (z.B. 0xC0FFEE)
//   - count: Anzahl zu generierender Szenarien
//   - Rückgabe: Array von { reiter: [...], koernerProEinheit }
//
// Szenario-Aufbau:
//   - 3–5 Tabs pro Szenario
//   - pro Tab: hektar 1–20, istHektar (0 oder hektar ± delta),
//              koerner 40 000–120 000, duenger 100–300 kg/ha
//   - 0–2 Entries pro Tab mit einheit/duenger/time
//   - Bereiche so gewählt, dass realistische Carryover-Szenarien entstehen
//     (Mix aus Ersparnis-Tabs und Mehrbedarf-Tabs).

// Mulberry32: kleiner, schneller, seedbarer PRNG. Public domain.
function mulberry32(seed) {
    let s = seed >>> 0;
    return function () {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const NAMES = ['Acker Nord', 'Acker Süd', 'Acker Ost', 'Acker West', 'Acker Mitte'];

export function generateScenarios(seed, count) {
    const rand = mulberry32(seed);
    const scenarios = [];
    for (let s = 0; s < count; s++) {
        const tabCount = 3 + Math.floor(rand() * 3); // 3–5
        const kpe = 40000 + Math.floor(rand() * 5) * 10000; // 40k, 50k, 60k, 70k, 80k
        const reiter = [];
        for (let i = 0; i < tabCount; i++) {
            const hektar = +(1 + rand() * 19).toFixed(2); // 1–20
            const istHektar = rand() < 0.85
                ? Math.max(0, +(hektar + (rand() - 0.5) * 4).toFixed(2)) // ±2ha um hektar
                : 0; // 15% Chance: istHektar=0 (kein IST erfasst)
            const koerner = 40000 + Math.floor(rand() * 9) * 10000; // 40k–120k in 10k steps
            const duenger = 100 + Math.floor(rand() * 21) * 10; // 100–300 in 10er steps
            const entryCount = Math.floor(rand() * 3); // 0–2
            const entries = [];
            for (let e = 0; e < entryCount; e++) {
                const einheit = +(rand() * 25).toFixed(2);
                const entryDuenger = +(rand() * 2000).toFixed(2);
                const hh = 7 + Math.floor(rand() * 12); // 07:00–18:59
                const mm = Math.floor(rand() * 60);
                entries.push({
                    einheit, duenger: entryDuenger,
                    time: String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'),
                });
            }
            reiter.push({
                name: NAMES[i % NAMES.length] + ' ' + (i + 1),
                hektar, istHektar, koerner, duenger,
                entries,
                fahrgassenEnabled: false, fahrgassenBreite: 0,
            });
        }
        scenarios.push({ reiter, koernerProEinheit: kpe });
    }
    return scenarios;
}