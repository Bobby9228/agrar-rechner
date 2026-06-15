# Agrar-Rechner — Dokumentation

## Inhaltsverzeichnis

1. [Überblick](#überblick)
2. [Architektur & Datenmodell](#architektur--datenmodell)
3. [State (Zustand)](#state-zustand)
4. [Core-Berechnungsfunktionen](#core-berechnungsfunktionen)
5. [Tab-Verwaltung](#tab-verwaltung)
6. [Drill-Protokoll](#drill-protokoll)
7. [Carryover-System (Überträge)](#carryover-system-überträge)
8. [Hektarzähler](#hektarzähler)
9. [Fahrgassen & Einheiten-Größe](#fahrgassen--einheiten-größe)
10. [Persistenz & Migration](#persistenz--migration)
11. [Dashboard](#dashboard)
12. [Formatierung & Lokalisierung](#formatierung--lokalisierung)
13. [Theme / Dark Mode](#theme--dark-mode)
14. [Berechnungsformeln im Detail](#berechnungsformeln-im-detail)

---

## Überblick

Der **Agrar-Rechner** ist eine Single-Page Progressive Web App (PWA) für Landwirte, die bei der Aussaat von Mais die benötigte **Saatgut-Menge (Einheiten)** und **Dünger-Menge (kg)** präzise berechnet. Er verwaltet mehrere Felder gleichzeitig über Tabs, führt ein **Drill-Protokoll** über eingefüllte Mengen, berechnet automatisch **Überträge (Carryover)** zwischen Feldern bei Flächenabweichungen und zeigt eine **Dashboard-Übersicht** aller Felder.

**Typische Workflows:**
1. Landwirt gibt für ein Feld (Tab) Hektar, Körner/ha und Dünger/kg ein → App berechnet automatisch Gesamtkörner, Einheiten und Dünger
2. Während der Arbeit wird eingefüllte Menge per "Einfüllen"-Button protokolliert
3. Die App zeigt, wie viel noch verbleibt
4. Bei mehreren Feldern: Wenn IST-Fläche < SOLL-Fläche, wird die Ersparnis automatisch auf andere Felder verteilt (Carryover)

---

## Architektur & Datenmodell

### Technologie-Stack
- **Reines Vanilla JS** (kein Framework) — ES5-Syntax mit `var`
- **Single HTML file** (`public/index.html`) — HTML, CSS und JS in einer Datei
- **PWA-fähig** — manifest.json + Service Worker (`public/sw.js`)
- **Persistenz** — `localStorage` mit JSON-Serialisierung
- **Tests** — Vitest (35+ Tests in `tests/`)

### Dateistruktur
```
agrar-rechner/
├── public/
│   ├── index.html          # Hauptsächlich — HTML + CSS + JS (ca. 2900 Zeilen)
│   ├── sw.js               # Service Worker für Offline-/PWA
│   ├── manifest.json        # PWA-Manifest
│   └── icon.svg / *.png    # Icons
├── tests/                  # 35 Vitest-Testdateien
├── vitest.config.js
├── package.json
└── wrangler.jsonc          # Cloudflare Workers Konfiguration (optional)
```

### Der State (Zustandsobjekt)

Das zentrale Datenobjekt — **ein einziges `state`-Objekt** wird stets im Speicher gehalten und nach jeder Änderung via `sv()` in den `localStorage` geschrieben.

```javascript
var state = {
  reiter: [
    {
      name:       'Tab 1',      // Anzeigename des Tabs
      hektar:     0,             // SOLL-Fläche (geplant, in Hektar)
      istHektar:  0,             // IST-Fläche (tatsächlich bearbeitt, in Hektar)
      koerner:    0,             // Körner pro Hektar (Aussaatstärke)
      duenger:    0,             // Dünger in kg/ha
      entries:    []             // Array von Drill-Einträgen {einheit, duenger, zaehlerStand, time}
    },
    // ... weitere Tabs
  ],
  activeReiter:   0,             // Index des aktiven Tabs
  activeView:     null,          // null='field', 'protokoll' = Protokoll-Ansicht
  fahrgassenEnabled:  false,     // Fahrgassen-Korrektur aktiviert
  fahrgassenBreite:   0,        // Fahrgassenbreite in Metern
  einheitGroesseEnabled: false,  // Benutzerdefinierte Einheitengröße aktiviert
  koernerProEinheit:  50000,    // Körner pro Saatgut-Einheit (Standard: 50.000)
  machineLog:    [],             // Globales Maschinen-Protokoll (alle Einfüllungen)
  zaehlerstand:  0               // Aktueller Hektarzähler-Stand
};
```

### Datenfluss

```
User Input → syncStateFromInputs() → state-Objekt → berechne() → renderResults()
                                     ↓
                               sv() → localStorage
                                     ↓
                               lv() ← App-Start (Wiederherstellung)
```

---

## State (Zustand)

### Initialisierung

Beim App-Start wird `lv()` (Load from View / localStorage) aufgerufen:

```javascript
function lv() {
  // Liest state aus localStorage unter Key 'mais_rechner'
  // Führt Migrationen durch:
  // 1. Altes Schema (einzelne Felder ohne Tabs) → neues Tab-Schema
  // 2. Globale entries → per-Tab entries
  // 3. Fehlende Felder (machineLog, zaehlerstand) auf Default-Werte
}
```

### Speichern

```javascript
function sv() {
  // Serialisiert state als JSON in localStorage['mais_rechner']
  // Fehler werden still (try/catch) ignoriert (z.B. bei vollem Speicher)
}
```

**Wichtig:** `sv()` wird nach jeder relevanten Zustandsänderung aufgerufen — aber nicht bei jedem Tastendruck, sondern erst bei bestätigten Aktionen (Tabs wechseln, Berechnen, Einfüllen).

---

## Core-Berechnungsfunktionen

### Grundformel

```
Körner gesamt  = Hektar × Körner/ha
Einheiten      = Körner gesamt ÷ Körner_pro_Einheit
Dünger gesamt  = Hektar × Dünger/kg
```

Mit Fahrgassen-Korrektur:
```
Körner nach Fahrgassen = Körner gesamt × (Fahrgassenbreite - 1) / Fahrgassenbreite
```

### `berechne()` — Hauptberechnung

Wird im Live-Pfad nicht mehr aufgerufen — die `onInput*`-Handler in `ui-handlers.js` schreiben direkt in den State und emittieren `ENTRY_CHANGED`, woraufhin `AppGlobals.renderResults()` (siehe `render-results.js`) die Ergebnis-Karte rendert. `berechne()` existiert weiterhin auf `AppGlobals` als Back-Compat-Shim für die Test-Suite (siehe `tests/03-berechne.test.js`).

**Validierung:**
- Hektar > 0 erforderlich (ansonsten rote Fehlermeldung + Border)
- Körner > 0 erforderlich
- Dünger darf 0 sein (optional)

**Schutz des Drill-Protokolls:**
Wenn die neuen SOLL-Werte geringer sind als die bereits eingetragenen Verbräuche (`usedEinheit > istE` oder `usedDuenger > istD`), fragt die App **per `confirm()`**, ob das Drill-Protokoll zurückgesetzt werden soll. Damit wird verhindert, dass versehentlich Verbrauchsdaten verworfen werden.

```javascript
function berechne() {
  // 1. Validiere Eingaben (Hektar > 0, Körner > 0)
  // 2. Lese Werte aus Input-Feldern + schreibe in state
  // 3. Prüfe: Sind bereits mehr Einheiten eingetragen als neu berechnet?
  //    → Ja: confirm() → entries.length = 0 (Reset)
  //    → Nein: mache weiter
  // 4. sv() + renderTabs() + renderResults() + renderView()
}
```

### Berechnungs-Hilfsfunktionen

| Funktion | Beschreibung |
|---|---|
| `getKornerGesamt()` | Körner gesamt für aktiven Tab (berücksichtigt Fahrgassen) |
| `getTabKornerGesamt(r)` | Körner gesamt für Tab `r` (berücksichtigt Fahrgassen) |
| `getTotalEinheiten()` | Einheiten gesamt für aktiven Tab |
| `getTabTotalEinheiten(r)` | Einheiten für Tab `r` |
| `getTotalDuenger()` | Dünger gesamt für aktiven Tab |
| `getTabTotalDuenger(r)` | Dünger für Tab `r` |
| `getTabIstHektar(r)` | IST-Fläche von Tab `r` (direkter Wert, nicht aus Entries abgeleitet) |
| `getTabIstEinheiten(r)` | Einheiten basierend auf IST-Fläche (wenn vorhanden) |
| `getTabIstDuenger(r)` | Dünger basierend auf IST-Fläche |

**Fahrgassen-Formel** (in `getTabKornerGesamt` und `getTabIstEinheiten`):
```javascript
if (state.fahrgassenEnabled && state.fahrgassenBreite > 0) {
  k = k * ((state.fahrgassenBreite - 1) / state.fahrgassenBreite);
}
```
Beispiel: Bei 24 m Fahrgassenbreite → `23/24 = 0,958` → **~4,2 % weniger Körner**.

**IST vs. SOLL:** Wenn eine IST-Fläche (`r.istHektar > 0`) eingetragen ist, verwendet `berechne()` automatisch diese anstelle der SOLL-Fläche für die Berechnung der verbleibenden Mengen. Das bedeutet: Wenn ein Landwirt 10 ha bestellen wollte, aber nur 9 ha bestellen konnte, werden die Einheiten für 9 ha berechnet. Die Differenz (Ersparnis) wird über das Carryover-System auf andere Felder verteilt.

---

## Tab-Verwaltung

### Render-Tabs

```javascript
function renderTabs() {
  // Baut die Tab-Leiste neu auf:
  // - Ein Button pro Tab (mit integriertem Namensfeld + Schließen-Button)
  // - Aktiver Tab: grüner Hintergrund
  // - "+ Tab"-Button zum Hinzufügen
  // - "🔧 Protokoll"-Button für die Protokoll-Ansicht
}
```

**Tab-Buttons** haben ein **integriertes `<input>`-Feld** für den Namen — das ist ein besonderes UI-Muster:
- Normaler Klick auf den Tab → wechselt den Tab
- Klick auf das Namensfeld → editiert den Namen
- Enter im Namensfeld → bestätigt und blurrt
- Escape → verwirft (nicht implementiert, aktuell wird trotzdem gespeichert)

### Tab-Operationen

| Funktion | Verhalten |
|---|---|
| `addReiter()` | Neuen Tab mit Namen "Tab N" anhängen, aktivieren, Eingabefokus auf Hektar |
| `confirmRemoveReiter(idx)` | `confirm()`-Dialog, nur löschen wenn bestätigt + Daten vorhanden |
| `removeReiter(idx)` | Tab entfernen, activeReiter korrigieren, neu rendern |
| `switchReiter(idx)` | Aktuellen Tab-Zustand speichern (`syncStateFromInputs`), Tab wechseln |
| `renameReiter(idx, name)` | Tab-Name auf max. 20 Zeichen kürzen |
| `switchToProtokoll()` | Wechselt zur Protokoll-Ansicht (drill-Protokoll-Overlay) |

### Multi-Tab-Verteilung

Im Protokoll-Modus kann der Landwirt beim "Einfüllen" einstellen, **welche Tabs wie viel bekommen** — über die Prioritäts-Buttons (1, 2, 3…) im Drill-Bereich:
- Prio 1 = erste Priorität (wird zuerst bedient)
- Prio 2 = zweite Priorität (bekommt Rest)
- Button 0 (= "—") = dieser Tab bekommt nichts

---

## Drill-Protokoll

### Was wird protokolliert?

Für jede Maschinen-Befüllung wird ein Eintrag erstellt:

```javascript
{
  einheit:       4.5,       // Eingefüllte Einheiten Saatgut
  duenger:       200,       // Eingefüllte kg Dünger
  zaehlerStand:  5.2,       // Hektarzähler-Stand bei der Befüllung
  time:          '14:30'    // Uhrzeit als String (HH:MM)
}
```

### Maschinen-Protokoll vs. Tab-Protokoll

- **`machineLog`**: Jede einzelne Maschinen-Befüllung wird hier gespeichert (unabhängig von der Verteilung auf Tabs). Wird für die **Prognose** ("Saat leer bei ~X ha") und die Maschinen-Ansicht im Protokoll verwendet.
- **`r.entries`** (pro Tab): Verteilung einer Befüllung auf die Tabs. Eine Maschinen-Befüllung kann auf mehrere Tabs aufgeteilt werden (wenn der Landwirt Prio-Buttons nutzt).

### Prognose-Berechnung (Maschinen-Protokoll)

Für jeden Eintrag im Maschinen-Protokoll wird berechnet, wann die eingefüllte Saatgut-/Düngermenge voraussichtlich aufgebraucht sein wird:

```javascript
// Beim zweiten und jedem weiteren Eintrag:
var haDriven = (m.zaehlerStand || 0) - (prevM.zaehlerStand || 0);
cumEinheit = Math.max(0, cumEinheit - haDriven * unitsPerHa) + m.einheit;
cumDuenger = Math.max(0, cumDuenger - haDriven * duengerPerHa) + m.duenger;

// Prognose: Restmenge / Verbrauchsrate
var prognoseSaat = (m.zaehlerStand || 0) + cumEinheit / unitsPerHa;
```

**Verbrauchsraten:**
- `unitsPerHa = r.koerner × fahrgassenFaktor / koernerProEinheit` (Einheiten pro ha)
- `duengerPerHa = r.duenger` (kg pro ha)

### Drill-Buttons

| Funktion | Verhalten |
|---|---|
| `drillAdd()` | Eintrag aus Inputs erzeugen, auf Tabs mit Prio > 0 verteilen, maschinenLog erweitern |
| `drillCalcAll()` | Verteilung bei Eingabe in Echtzeit berechnen (AUTO-Modus) |
| `drillRemove(tabIdx, entryIdx)` | Einzelnen Eintrag aus Tab-Log entfernen |
| `drillMachineRemove(idx)` | Eintrag aus Maschinen-Log entfernen |

---

## Carryover-System (Überträge)

### Das Problem, das es löst

Wenn ein Landwirt mehrere Felder (Tabs) hat und die **IST-Fläche eines Feldes kleiner ist als die SOLL-Fläche** (z.B. weil ein Teil nass war), dann "spart" er Saatgut und Dünger ein. Umgekehrt: Wenn die IST-Fläche größer ist als geplant, hat er "Mehrbedarf".

Das Carryover-System verteilt diese Überschüsse und Defizite automatisch auf alle Tabs.

### Wie es funktioniert

**`computeAllCarryovers()`** berechnet für jeden Tab drei Arten von Überträgen:

```javascript
{
  savedEinheit:    0,    // Aus Ersparnis (IST < SOLL) → an andere Tabs weitergeben
  savedDuenger:    0,
  excessEinheit:   0,    // Aus Mehrverbrauch (IST > SOLL) → von anderen Tabs nehmen
  excessDuenger:   0
}
```

### Algorithmus — Zwei Phasen

**Phase 1 — Ersparnisse verteilen (vorwärts):**
```
Für jeden Tab (IST < SOLL):
  → Ersparnis = SOLL_need - IST_need für diesen Tab
  → Verteilung auf noch nicht fertige Tabs (isTabDone = false)
  → Priorität: der erste nicht fertige Tab zuerst
  → Rest geht an den nächsten
```

**Phase 2 — Mehrbedarf verteilen (rückwärts):**
```
Für jeden Tab mit Einträgen (IST > SOLL):
  → Mehrbedarf = IST_need - SOLL_need
  → Wird von der Ersparnis anderer Tabs abgezogen
  → Sortierung: umgekehrt chronologisch (neueste Einträge zuerst)
```

### Beispiel

```
Tab A: SOLL = 10 ha, IST = 8 ha → Ersparnis = 2 ha × Rate
Tab B: SOLL = 12 ha, IST = 12 ha → neutral
Tab C: SOLL = 10 ha, IST = 9 ha, noch nicht fertig → bekommt 1 ha × Rate von Tab A
```

### isTabDone()

Ein Tab gilt als "fertig" (`isTabDone = true`), wenn die Summe aus:
- `usedEinheit` (eingetragene Einheiten)
- `savedEinheit` (Ersparnis aus anderen Tabs)
- `excessEinheit` (Mehrbedarf zu anderen Tabs)

≥ `totalE` (SOLL- oder IST-Einheiten je nach Verfügbarkeit)

Mit einer Toleranz von **0,05 Einheiten**.

---

## Hektarzähler

Der Hektarzähler ist ein **manueller Eingabefeld** für den aktuellen Zählerstand. Er wird in der Praxis oft von einem realen Zähler am Traktor abgelesen.

```javascript
function zaehlerUpdate() {
  // Wird bei onblur und Enter auf dem Zähler-Input aufgerufen
  // Berechnet: delta = neuer Stand - vorheriger Stand
  // Anzeige:
  //   - Delta (bearbeitete Fläche seit letztem Eintrag)
  //   - Gesamte bearbeitete Fläche (kumuliert)
  //   - SOLL / IST / Abweichung (wenn SOLL-Fläche im aktiven Tab gesetzt)
}
```

**Delta-Anzeige:**
- Positives Delta → grün ("+X ha")
- Negatives Delta → rot ("−X ha")

**SOLL/IST/Abweichung:** Wird nur angezeigt, wenn `r.hektar > 0`. Die IST-Fläche wird aus `r.istHektar` genommen (direkte Nutzereingabe im Feld "IST-Fläche"), nicht aus den Drill-Entries.

---

## Fahrgassen & Einheiten-Größe

### Fahrgassen

Wenn der Landwirt mit **Fahrgassen** arbeitet (unbefahrene Streifen im Feld), wird weniger Saatgut pro Fläche benötigt, weil die Fahrgassen nicht besät werden.

**Korrekturformel:**
```javascript
var k = r.hektar * r.koerner;
k = k * ((state.fahrgassenBreite - 1) / state.fahrgassenBreite);
```

**Beispiel:** Bei 24 m Fahrgassenbreite:
- Fahrgasse = 1 m befahrbar → 23 m effektive Saatfläche
- Faktor = 23/24 ≈ 0,9583
- Reduktion = 4,17 %

### Einheiten-Größe

Standard: **50.000 Körner pro Einheit** (gängige Handelsform von Maissaatgut).

Der Landwirt kann über den Toggle "Einheiten-Größe anpassen" einen anderen Wert eintragen. Die App berechnet dann:
```
Einheiten = Körner gesamt / koernerProEinheit
```

Übliche Werte: 50.000 (Standard) oder 100.000 (bei manchen Saatgut-Herstellern).

---

## Persistenz & Migration

### Speicher-Key
`localStorage['mais_rechner']`

### Migrationen (in `lv()`)

Die App hat mehrere Schema-Versionen durchlaufen. Beim Laden werden alte Schemata automatisch erkannt und migriert:

**Migration 1 — Tab-loses Schema → Tab-Schema:**
```javascript
// Altes Schema:
{ hektar, koerner, duenger, entries, ... }
// → Neues Schema:
{ reiter: [{ hektar, koerner, duenger, entries, name: 'Tab 1' }], ... }
```

**Migration 2 — Globale entries → Per-Tab entries:**
Falls `parsed.entries` existiert (altes global), wird es nach `reiter[0].entries` verschoben.

**Migration 3 — Fehlende Felder:**
Alle fehlenden Felder (`machineLog`, `zaehlerstand`, `koernerProEinheit`, `entries` pro Tab) werden auf Default-Werte gesetzt.

### Kein Passwortschutz
Die Daten liegen unverschlüsselt im localStorage. Das ist für eine lokale landwirtschaftliche App akzeptabel.

---

## Dashboard

Das Dashboard ist eine **Overlay-Sheet** (von unten aufschiebbar), das eine Übersicht über alle Tabs zeigt.

**Öffnen:** `openDashboard()` — wird als `onclick` auf den "📊 Dashboard"-Button gelegt.

**Schließen:** `closeDashboard()` — via Overlay-Klick oder ✕-Button.

**Inhalt:**
- **Zusammenfassung** ganz oben: Gesamttonnen, Einheiten gesamt, Einheiten verbleibend (grün/rot)
- **Pro Tab:**
  - Name
  - 4 Statistiken: SOLL ha, IST ha, Körner, Einheiten (2-Spalten-Grid)
  - Fortschrittsbalken (bearbeitete Fläche / SOLL-Fläche)
  - Fälligkeits-Status (done = grün, remaining = rot)

```javascript
// Fortschrittsbalken:
var pct = (r.hektar > 0 && r.koerner > 0)
  ? (usedEinheit / istEinheiten * 100) + '%'
  : '0%';
```

---

## Formatierung & Lokalisierung

### Deutsches Zahlenformat

Alle Ein- und Ausgaben verwenden das deutsche Dezimalformat:
- **Eingabe:** Komma als Dezimaltrennzeichen, Punkt als Tausendertrennzeichen (z.B. `12,5` oder `1.500,3`)
- **Ausgabe:** Komma als Dezimaltrennzeichen (z.B. `12,5`)

### `parseDE(val)` — DE → Zahl

Parst einen deutschen String in eine JavaScript-Zahl:

```javascript
function parseDE(val) {
  // '12,5'    → 12.5
  // '1.500,3' → 1500.3
  // '1500'    → 1500
  // ''        → 0
}
```

**Regeln:**
- Wenn Komma vorhanden → alles vor dem Komma als Ganzzahl, Komma → Punkt, alles danach als Dezimal
- Tausenderpunkte werden immer entfernt (auch bei Werten ohne Dezimalkomma)
- `parseFloat()` am Ende → NaN → 0

### `formatDE(n)` — Zahl → DE

```javascript
function formatDE(n) {
  return String(n).replace('.', ',');
}
// 12.5 → '12,5'
```

### `fmt(n)` — Standard-Formatierung

Wird für die meisten Anzeigen im UI verwendet:
```javascript
function fmt(n) {
  var rounded = Math.round(n * 10) / 10;  // Eine Dezimalstelle
  return rounded.toFixed(1).replace('.', ',');
}
// 12.555 → '12,6'
// 12.0   → '12,0'
```

### `formatEinheit(n)` — Spezialformat für Einheiten

```javascript
function formatEinheit(n) {
  var rounded = Math.round(n * 10) / 10;
  return rounded.toFixed(1).replace('.', ',') +
    (rounded === 1.0 ? ' Einheit' : ' Einheiten');
}
// 1.0 → '1,0 Einheit'
// 4.5 → '4,5 Einheiten'
```

### `onInputFormat(el, mode)` — Eingabe-Bereinigung

Während der Eingabe werden ungültige Zeichen entfernt:

**Modus `'integer'`:**
- Erlaubt: nur Ziffern (`0-9`)
- Alles andere wird entfernt

**Modus `'decimal'`:**
- Erlaubt: Ziffern + maximal ein Komma
- Bei Eingabe von zwei Kommas: alles nach dem ersten Komma bleibt beim ersten, Rest wird verworfen
- Tausenderpunkte werden **nicht** unterstützt (würde das Eingabeerlebnis kompliziert machen)

**Wichtig:** Diese Funktion läuft bei `oninput` (also bei jedem Tastendruck) und korrigiert die Eingabe, wenn sie nicht dem Format entspricht.

---

## Theme / Dark Mode

### Toggle

Der 🌙-Button oben rechts ruft `toggleTheme()` auf.

### Implementierung

**Speicherung:** `localStorage['mais_theme']` = `'dark'` oder `'light'`

**Anwendung:** Die Klasse `html.dark` auf dem `<html>`-Element:
```css
html.dark body { background: #1a1f16; color: #e0e8d6; }
html.dark .card { background: #252b20; }
html.dark .btn { background: #5a9a2a; }
/* usw. — nahezu jedes Element hat eine explizite Dark-Variante */
```

**Keine automatische System-Erkennung** — nur manueller Toggle. Die Farbpalette ist komplett invertiert (dunkler Agrar-Hintergrund #1a1f16, grüne Akzente bleiben als Grüntöne erhalten).

---

## Berechnungsformeln im Detail

### Saatgut-Gesamtbedarf (SOLL)

```
Körner_SOLL = hektar × koerner × fahrgassenFaktor
Einheiten_SOLL = Körner_SOLL / koernerProEinheit
```

### Saatgut-Gesamtbedarf (IST)

```
Körner_IST = istHektar × koerner × fahrgassenFaktor
Einheiten_IST = Körner_IST / koernerProEinheit
```

### Dünger

```
Dünger_SOLL = hektar × duenger
Dünger_IST  = istHektar × duenger
```

### Fahrgassen-Faktor

```
fahrgassenFaktor = (fahrgassenBreite - 1) / fahrgassenBreite
```

### Verbleibende Menge

```
verbliebene_Einheiten = max(0, Einheiten_IST - usedEinheit - carryover)
verbliebener_Dünger   = max(0, Dünger_IST  - usedDuenger  - carryover)
```

### Prognose (Maschinen-Log)

```
Verbrauch_je_ha_Saat = koerner × fahrgassenFaktor / koernerProEinheit
Verbrauch_je_ha_Dünger = duenger

Nach jeder neuen Befüllung (ab der 2.):
  ha_gefahren = aktuellerZählerstand - vorherigerZählerstand
  rest_Saat = max(0, vorherigerRest - ha_gefahren × sat_je_ha) + neueBefüllung
  rest_Dünger = max(0, vorherigerRest - ha_gefahren × dünger_je_ha) + neueBefüllung

Prognose_Saat_leer_bei = aktuellerZählerstand + rest_Saat / sat_je_ha
Prognose_Dünger_leer_bei = aktuellerZählerstand + rest_Dünger / dünger_je_ha
```

### Carryover — Ersparnis-Verteilung

```
totalSavedE = Σ max(0, Einheiten_SOLL - Einheiten_IST)  über alle Tabs
totalSavedD = Σ max(0, Dünger_SOLL - Dünger_IST)        über alle Tabs

Verteile totalSavedE/D auf nicht-feratige Tabs (isTabDone=false):
  gib_i = min(restSaved, tab_i_bedarf)
  restSaved -= gib_i
```

### Carryover — Mehrbedarfs-Verteilung

```
totalExcessE = Σ max(0, Einheiten_IST - Einheiten_SOLL)  über alle Tabs
totalExcessD = Σ max(0, Dünger_IST - Dünger_SOLL)        über alle Tabs

Fülle rückwärts in Tabs mit Einträgen (sortiert nach neuestem Eintrag zuerst):
  nimm_i = min(restExcess, tab_i_restBedarf)
  restExcess -= nimm_i
```

---

## UI-Komponenten

### Sticky Footer

Die Aktions-Buttons ("Berechnen", "Zurücksetzen", "Reset All") sind in einem **sticky Footer** fixiert, damit sie auf dem Handy immer erreichbar sind. Der Footer wird in der **Protokoll-Ansicht ausgeblendet**.

### Mini-Result

Im Sticky Footer über den Buttons wird eine **Mini-Zusammenfassung** angezeigt:
```
12,5 Einheiten | 1.875 kg
```
Das gibt dem Landwirt auch ohne Scrolling eine schnelle Orientierung.

### Cards

Jede logische Sektion (Fläche & Aussaatstärke, Dünger, Ergebnis, Hektarzähler, Drill-Protokoll) ist in einer **Card** (`div.card`) gekapselt mit:
- Weißer Hintergrund, abgerundete Ecken (16px)
- leichter Schatten
- Überschrift mit grüner Unterkante

### Tabs

Die Tab-Leiste ist eine **Custom-Implementierung** (kein `<select>` und kein natives Tab-System):
- Flexbox mit `flex-wrap` für Zeilenumbruch
- Jeder Tab ist ein `<button>` mit eingebettetem `<input>` für den Namen
- Aktiver Tab: grüner Hintergrund
- Schließen-Button (nur sichtbar wenn > 1 Tab)

### Dashboard Sheet

Ein **Bottom Sheet** (von unten aufschiebbar), das über das Dashboard geöffnet wird:
- `z-index: 101`, Overlay bei `z-index: 100`
- `max-height: 80vh`, `overflow-y: auto`
- `border-radius: 20px 20px 0 0` für die abgerundete obere Ecke

---

## Testabdeckung

Das Projekt hat **35+ Tests** in Vitest. Alle Tests sind im Ordner `tests/` und folgen dem Namensschema:

```
01-parseDE-calculations.test.js     → parseDE(), formatDE(), fmt()
02-onInputFormat.test.js             → onInputFormat()
03-berechne.test.js                   → berechne() Validierung
04-fahrgassen.test.js                 → Fahrgassen-Berechnung
05-drill-protocol.test.js             → drillAdd(), drillRemove()
06-tab-management.test.js             → addReiter(), removeReiter(), switchReiter()
07-state-persistence.test.js          → sv(), lv(), Migrationen
08-reset-init-sync.test.js            → resetActiveTab(), resetAll()
09-blind-spots.test.js                → Edge Cases (leere Eingaben etc.)
10-regression-session-fixes.test.js   → Regressionstests für behobene Bugs
11-dashboard.test.js                  → Dashboard-Rendering
...bis 35
```

Die Tests nutzen ein `helpers.js`-Modul, das den DOM mockt und den globalen `state` und die Funktionen aus `index.html` importiert.

---

## Sicherheitsbetrachtungen

- **XSS:** Die App verwendet `textContent` statt `innerHTML` bei fast allen Nutzerdaten. Lediglich bei `innerHTML` für dynamisch generierte HTML-Strings (Carryover-Hints, Dashboard) werden nur vertrauenswürdige statische Strings + Zahlen-Formatierung eingesetzt — keine Nutzereingaben direkt als HTML.
- **localStorage:** Keine Verschlüsselung — Daten sind für jeden, der das Gerät in die Hand bekommt, lesbar.
- **Kein Backend** — Alle Berechnungen laufen client-seitig im Browser.

---

**`renderMachineLog()` existiert nicht als eigenständige Funktion.** `drillAdd()` rief diese nicht-existente Funktion auf — das wurde korrigiert. Das Maschinen-Protokoll wird stattdessen direkt in `renderResults()` über `#drill_machine_log` gerendert.

## Bekannte Limitationen

1. **Kein Undo/Redo** — Gelöschte Tab-Einträge sind sofort weg
2. **Kein Export/Import** — Daten können nicht als CSV oder JSON exportiert werden
3. **Keine Offline-Warnung** — Service Worker cached die App, aber es gibt keine Meldung bei fehlender Verbindung
4. **Max. Tab-Name: 20 Zeichen** — hardcodiert in `renameReiter`
5. **Prioritäts-Buttons** — Bei mehr als 9 Tabs funktioniert die Prio-Zahl noch, aber die Anzeige kann eng werden
6. **Kein Druckmodus** — Für das Protokoll als Beleg beim Landwirt

---

## Deployment

Deployed als **Cloudflare Pages** (Static Assets):

```bash
npx wrangler pages deploy public/
```

Die `wrangler.jsonc` ist als Workers Static Assets konfiguriert (`"assets": { "directory": "./public" }`).
Für reine statische Sites wird `wrangler pages deploy` empfohlen.

### Cache-Header

`public/_headers` definiert Cache-Control-Regeln für Cloudflare:

| Pfad | Cache-Strategie |
|------|----------------|
| `/sw.js` | `no-cache, no-store, must-revalidate` — Service Worker muss immer aktuell sein |
| `/*.html` | `no-cache` |
| `/*.png`, `/*.svg` | `public, max-age=604800` (7 Tage) |
| `/manifest.json` | `no-cache` |

### Service Worker Cache-Version

Der Service Worker nutzt `CACHE_VERSION` (`sw.js` Zeile 2) um alte Caches zu löschen und neue Assets zu cachen.
**Nach jedem Deployment muss dieser String manuell gebumpet werden** — sonst bekommen Nutzer die alte Version aus dem Browser-Cache.

Im Code ist ein Kommentar (`// ⚠️ CACHE_VERSION muss bei jedem Release manuell gebumpet werden!`) der daran erinnert.

alternative: Ein Build-Script, das den Hash oder Zeitstempel automatisch injiziert — PRs welcome.
