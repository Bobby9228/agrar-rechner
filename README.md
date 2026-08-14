# Agrar-Rechner — Dokumentation

> Stand: `e62a37e` · 425 Commits · 3.601 LOC prod JS · 10.762 LOC Tests · 45 Test-Dateien / 771 Tests

## Inhaltsverzeichnis

1. [Überblick](#überblick)
2. [Architektur & Datenmodell](#architektur--datenmodell)
3. [State (Zustand)](#state-zustand)
4. [Core-Berechnungsfunktionen](#core-berechnungsfunktionen)
5. [Tab-Verwaltung](#tab-verwaltung)
6. [Drill-Protokoll & Maschinen-Log](#drill-protokoll--maschinen-log)
7. [Carryover-System (Senken-Modell)](#carryover-system-senken-modell)
8. [Fahrgassen & Einheiten-Größe](#fahrgassen--einheiten-größe)
9. [Persistenz, Migration & Cross-Tab-Sync](#persistenz-migration--cross-tab-sync)
10. [Dashboard](#dashboard)
11. [Reset & Datenverwaltung](#reset--datenverwaltung)
12. [Formatierung & Lokalisierung](#formatierung--lokalisierung)
13. [Theme / Dark Mode](#theme--dark-mode)
14. [Sicherheit & Header](#sicherheit--header)
15. [UI-Komponenten](#ui-komponenten)
16. [Berechnungsformeln im Detail](#berechnungsformeln-im-detail)
17. [Testabdeckung](#testabdeckung)
18. [Deployment](#deployment)
19. [Bekannte Limitationen](#bekannte-limitationen)
20. [Mitmachen](#mitmachen)

---

## Überblick

Der **Agrar-Rechner** ist eine statische Single-Page Progressive Web App (PWA) für die Aussaat-Planung auf dem Feld. Sie berechnet präzise, wie viele **Saatgut-Einheiten** und **kg Dünger** ein Landwirt für eine gegebene Fläche braucht, protokolliert das tatsächliche Einfüllen während der Arbeit und verteilt **Mehrbedarf bzw. Ersparnis** bei Flächenabweichungen automatisch auf andere Felder.

**Workflow:**

1. Pro Feld (Tab) gibt der Landwirt **SOLL-Fläche** (geplant), **Körner/ha** und **Dünger kg/ha** ein.
2. Die App berechnet daraus sofort **Gesamtkörner**, **benötigte Einheiten** und **kg Dünger**.
3. Optional: tatsächlich gesäte **IST-Fläche** eintragen (z. B. vom Maschinenzähler) — App zeigt Soll-vs-Ist-Vergleich und Mehrbedarf/Ersparnis.
4. Beim Einfüllen gibt der Landwirt per **Drill-Protokoll** ein, was er tatsächlich eingefüllt hat (Einheiten + kg Dünger + Zählerstand-ha). Das wird im **Maschinen-Log** mitprotokolliert.
5. **Dashboard** zeigt Übersicht aller Felder: was noch offen ist, was fertig ist, wo Ersparnis anfällt.

**Hauptmerkmale:**

- **Mehrere Felder parallel** über Tabs verwaltbar (jeder Tab = ein Schlag)
- **Carryover-Senken-Modell**: Ersparnis/Mehrbedarf wandert automatisch auf das zuletzt befüllte Feld (= aktuelle Work-Front)
- **Drill-Protokoll** mit Zeitstempel, Einträge pro Tab + globales Maschinen-Log
- **Fahrgassen-Korrektur** (Per-Tab oder global)
- **Variable Einheiten-Größe** (Standard: 50.000 Körner/Einheit, konfigurierbar)
- **Offline-fähig** (Service Worker mit Network-First-Cache)
- **Dark Mode** mit System-Präferenz-Erkennung
- **Persistenz** in `localStorage` mit Cross-Tab-Synchronisierung
- **45 Test-Dateien, 771 Tests** (Vitest + jsdom)

---

## Architektur & Datenmodell

### Technologie-Stack

- **Vanilla JS** — keine Bundler, kein TypeScript, kein Framework. ES5-Syntax mit `var`, split in 9 Module.
- **Statische PWA** — `index.html` + 1 CSS + 9 JS-Module + `manifest.json` + `sw.js`. Kein Build-Step.
- **Persistenz** — `localStorage` mit JSON-Serialisierung, eigene Schema-Validierung.
- **Tests** — Vitest + jsdom, 45 Test-Dateien, 771 Tests.

### Dateistruktur

```
agrar-rechner/
├── public/                          # Statische Assets (Cloudflare Pages Root)
│   ├── index.html                   # Single HTML — nur Markup + Inline-Handler
│   ├── manifest.json                # PWA-Manifest
│   ├── sw.js                        # Service Worker (Network-First)
│   ├── _headers                     # Cloudflare-Pages-Header (Cache + Security)
│   ├── css/
│   │   └── styles.css               # 1899 Zeilen, Custom Properties, Dark Mode
│   ├── js/                          # 9 Module, Lade-Reihenfolge via <script>-Tags
│   │   ├── app-globals.js           # Namespace (AppGlobals), state-Live-Alias
│   │   ├── state.js                 # state-Objekt, Schema-Validierung, Persistenz
│   │   ├── calculations.js          # Pure Berechnungen + Carryover-Senken-Modell
│   │   ├── ui-handlers.js           # Event-Handler: Tabs, Drill, Reset, Input
│   │   ├── render-tabs.js           # Tab-Bar, Cross-Tab-Sync, Subscriber-Hub
│   │   ├── render-results.js        # Rechner-Ergebniskarten
│   │   ├── render-drill.js          # Drill-Protokoll + Maschinen-Log
│   │   ├── render-dashboard.js      # Dashboard-Übersicht aller Felder
│   │   └── main.js                  # Init, Theme, Service-Worker-Registration
│   └── icon*.{svg,png}              # PWA-Icons
├── tests/                           # Vitest, 45 Dateien, 771 Tests
│   ├── helpers.js                   # DOM-Mock, Module-Loader
│   └── *.test.js                    # Thematisch (manche mit numerischem Präfix)
├── CODE_DEEP_DIVE.md                # Strukturanalyse (großer Audit-Bericht)
├── AGENTS.md                        # Working Agreement für AI-Agents
├── IDEAS.md                         # Roadmap
├── eslint.config.js                 # Flat Config, ESM
├── vitest.config.js                 # jsdom env
├── wrangler.jsonc                   # Cloudflare Pages
├── .nvmrc                           # Node 22
└── .github/workflows/ci.yml         # Lint + Test (kein Deploy-Step mehr)
```

### Lade-Reihenfolge der JS-Module

Per `<script>`-Tags in `index.html` (Zeile 254-276) — kritisch wegen implizitem Window-Scope und ADR-001-Namespace-Pattern:

```
app-globals.js  →  state.js  →  calculations.js  →  ui-handlers.js
   →  render-tabs.js  →  render-results.js  →  render-drill.js
   →  render-dashboard.js  →  main.js
```

Jedes Modul registriert seine Exporte am Dateiende via `Object.assign(window.AppGlobals, …)`. Konsumenten greifen über `AppGlobals.funktionName()` zu, nicht über `window.funktionName()`. ADR-001 (Issue #278) dokumentiert die Migration.

### Datenfluss

```
User-Input (HTML <input>)          Cross-Tab-Sync
        ↓                                ↓
onInputFormat / onInputX (ui-handlers)  storage-Event
        ↓                                ↓
syncStateFromInputs()              AppGlobals.state = remote
        ↓                                ↓
AppGlobals.state.X = Wert                ↓
        ↓                                ↓
appEmit('STATE_CHANGED')                 ↓
        ↓                                ↓
appOnStateChange (Subscriber in render-tabs.js)
        ↓
saveState()  →  localStorage
        ↓
renderTabs() / renderResults() / renderDashboard()
        ↓
DOM-Update
```

---

## State (Zustand)

`state.js` definiert ein **globales `state`-Objekt** — Single Source of Truth der gesamten App:

```javascript
var state = {
  reiter: [{
    name:       'Schlag 1',     // Anzeigename
    hektar:     0,              // SOLL-Fläche (geplant, ha)
    istHektar:  0,              // IST-Fläche (tatsächlich gesät, ha)
    koerner:    0,              // Körner pro Hektar
    duenger:    0,              // Dünger in kg/ha
    entries:    [],             // Drill-Protokoll-Einträge [{einheit, duenger, zaehlerStand, time, ...}]
    done:       false           // Manueller User-Toggle "Tab fertig"
  }],
  activeReiter:    0,           // Index des aktiven Tabs
  activeView:      null,        // null = Rechner, 'protokoll' = Drill-Protokoll-Ansicht
  dashboardOpen:   false,       // Letzte Ansicht vor Reload (für Restore)
  fahrgassenEnabled:  false,    // Globale Fahrgassen-Korrektur
  fahrgassenBreite:    0,       // Globale Fahrgassenbreite (m)
  einheitGroesseEnabled: false, // Benutzerdefinierte Einheiten-Größe
  koernerProEinheit: 50000,     // Körner pro Einheit Saatgut (Standard: 50.000)
  machineLog:    [],            // Globales Maschinen-Log (alle Einfüllungen, alle Tabs)
  drillPriorities: {}           // { tabIndex: 0|1|2|... } — 0 = keine Prio
};
```

### Schema-Validierung

`loadState()` parst jede gespeicherte State-Datei durch eine mehrstufige Validierungspipeline (`state.js:124-230`):

- `sanitizeNumber(v, fallback)` — Number + Finite + NaN-Guard
- `sanitizeString(v, fallback, maxLen)` — String + Length-Limit (verhindert Memory-Bomb)
- `sanitizeBoolean(v, fallback)` — Boolean-Coercion
- `sanitizeEntry(raw)` — Drill-Protokoll-Eintrag
- `sanitizeMachineLogEntry(raw)` — Maschinen-Log-Eintrag
- `sanitizeTab(raw)` — Komplettes Tab-Objekt
- `jsonReviver(key, value)` — Filter für gefährliche Keys auf jeder Verschachtelungsebene
- `parsePersistedState(raw)` — Top-Level-Sanitizer

**Defense-in-Depth gegen manipulierten localStorage:** Prototype-Pollution-Schutz, Type-Injection-Schutz, ALLOWED_TOP_KEYS-Whitelist, ALLOWED_TAB_KEYS-Whitelist, Längen-Limits auf alle Strings, Number-Range-Checks.

---

## Core-Berechnungsfunktionen

`public/js/calculations.js` enthält **pure Funktionen** ohne DOM-Abhängigkeit. Konstanten:

```javascript
var EPSILON_QUANTITY = 0.05;     // Restwerte unter dieser Schwelle gelten als 0
```

### Grundformel: Einheiten (Saatgut)

```
SOLL-Einheiten  =  (hektar × koerner) / koernerProEinheit  ×  Fahrgassen-Faktor
IST-Einheiten   =  (istHektar × koerner) / koernerProEinheit  ×  Fahrgassen-Faktor
```

`koernerProEinheit` ist global konfigurierbar (Standard 50.000). Fahrgassen-Faktor siehe unten.

### Grundformel: Dünger (kg)

```
SOLL-Dünger  =  hektar × duenger       (kg/ha × ha = kg)
IST-Dünger   =  istHektar × duenger    (kg)
Dünger/Einheit =  duenger × koernerProEinheit / koerner   (kg pro Einheit Saat)
```

### Reaktive Eingabe-Verarbeitung

`onInputFormat(el, mode, e)` (in `ui-handlers.js:828`) verarbeitet Tastendrücke in Input-Feldern mit `inputmode="decimal"`:

- **Integer-Modus** (Körner/ha): nur Ziffern behalten
- **Decimal-Modus** (Hektar, Dünger): Ziffern + genau ein Komma
- **iOS-Sonderfall**: Englische Tastatur liefert `.` statt `,` → wird in erstes Komma umgewandelt
- **Auto-Komma-Erkennung** (Android 2-Pass-Reformatierung, Browser-Insertion): wird erkannt und entfernt, falls nicht vom User beabsichtigt
- **Cursor-Position proportional**: bleibt beim Editieren in der Mitte erhalten

### Berechnungs-Hilfsfunktionen

| Funktion | Zweck |
|----------|-------|
| `computeFahrgassenFaktor(breite)` | `(breite - 1) / breite`, Guard `< 2 → 1.0` |
| `getTabFahrgassenFaktor(r)` | Per-Tab-Override, Fallback auf Global |
| `getTabTotalEinheiten(r, kpe)` | SOLL-Einheiten |
| `getTabIstEinheiten(r)` | IST-Einheiten |
| `getTabTotalDuenger(r)` | SOLL-Dünger in kg |
| `getTabIstDuenger(r)` | IST-Dünger in kg |
| `getDuengerProEinheit(r, kpe)` | kg Dünger pro Einheit Saatgut |
| `getTabUsedEinheiten(r)` / `getTabUsedDuenger(r)` | Summe aller Drill-Entries |
| `getTabRemaining(r, tabIdx)` | Noch einzufüllende Einheiten (Carryover-aware) |
| `isTabDone(r, tabIndex)` | true wenn `used + carryover ≥ soll` (innerhalb EPSILON) |
| `getTabRates(tabIdx)` | Saat/Dünger-Raten (kg/ha, ha/Einheit) für Maschinen-Log |

---

## Tab-Verwaltung

`ui-handlers.js` und `render-tabs.js` kümmern sich um die Tab-Bar.

### Tab-Operationen

| Funktion | Verhalten |
|----------|-----------|
| `addReiter()` | Neuen Tab mit Defaults `name='Schlag N', hektar=0, ...` |
| `removeReiter(idx)` | Entfernt Tab + zugehörige Carryovers |
| `switchReiter(idx)` | Setzt `activeReiter`, ruft `switchToRechner()` |
| `renameReiter(idx, name)` | Setzt Tab-Name via `contenteditable` |
| `switchToProtokoll()` | Zeigt Drill-Protokoll-Ansicht (`activeView = 'protokoll'`) |
| `switchToRechner()` | Zeigt Rechner-Ansicht (`activeView = null`) |
| `confirmRemoveReiter(idx)` | Modal-Bestätigung vor Löschen |

### Tab-Namen

Tab-Namen sind **`span[contenteditable]`** — direktes Bearbeiten per Klick, kein separates Input-Feld. Lange Namen werden per `fitTabNames()` (render-tabs.js:88) automatisch per CSS-`transform: scale()` verkleinert, bis sie in die Tab-Breite passen.

### Multi-Tab-Verteilung

Drill-Einfüllungen werden per `_calcDrillDistribution()` auf mehrere Tabs verteilt, gesteuert von `drillPriorities` (1 = höchste Prio, bearbeitet zuerst). Senken-Auswahl siehe Carryover-System.

---

## Drill-Protokoll & Maschinen-Log

Zwei separate, aber verknüpfte Strukturen:

### Tab-Protokoll (`state.reiter[i].entries[]`)

Pro Tab. Eintrag-Form:
```javascript
{
  einheit: 4,          // Eingefüllte Einheiten
  duenger: 200,        // Eingefüllte kg Dünger
  zaehlerStand: 5.2,   // Maschinen-Zählerstand (ha)
  time: 1715000000000, // Unix-Ms
  // ...weitere Felder
}
```

### Maschinen-Log (`state.machineLog[]`)

**Global**, über alle Tabs hinweg. Wird bei jedem Drill-Add zusätzlich befüllt. Dient als Audit-Trail / Tagesprotokoll.

### Drill-Flow

```
1. Landwirt füllt "Maschine eingefüllt (Einheiten)" ein
2. Optional: "Maschine eingefüllt (Dünger kg)" und "Zählerstand (ha)"
3. Klick auf "+ Einfüllen"
4. drillAdd():
   - _parseDrillInputs() liest Werte
   - _resolvePerTabDistribution() verteilt per Prio
   - Pro Tab: _buildDrillEntry() erzeugt Tab-Entry, _pushEntryToTab() hängt an
   - _buildMachineLogEntry() erzeugt Log-Eintrag mit ML-Index
5. drillCalcAll() → renderResults() zeigt neue Soll/Ist/Used/Remaining
```

### Prognose-Berechnung (Maschinen-Protokoll)

`render-drill.js:495-620` (`renderMachineLog`) zeigt pro Log-Eintrag:
- Eingefüllte Einheiten + Dünger
- Tatsächliche Rate (kg Dünger/Einheit Saat)
- Soll-Rate (basierend auf `getTabRates`)
- Abweichung

---

## Carryover-System (Senken-Modell)

> **Algorithmus seit #335/#371/#377:** Senken-Modell (Prio-Workfront). Die alte zweiphasige Vorwärts/Rückwärts-Verteilung wurde entfernt (siehe `tests/19-savings-carryover.test.js:72-79`).

### Das Problem, das es löst

Wenn die **IST-Fläche** eines Felds von der **SOLL-Fläche** abweicht (z. B. weil ein Teil nass war), entsteht ein Saldo:

- IST < SOLL → Ersparnis (zu viel Saatgut/Dünger im Sack)
- IST > SOLL → Mehrbedarf (zu wenig eingefüllt)

### Wie es funktioniert

Die Felder werden in **PRIO-Reihenfolge** bearbeitet (Prio 1 zuerst, höchste Prio zuletzt). Weicht ein bearbeitetes Feld von der Planung ab, wandert der Saldo **vorwärts** und bleibt am **zuletzt befüllten Tab** (= **Senke**, aktuelle Work-Front) hängen — dem Feld, das als Letztes drankam und für das der Restbestand bzw. die Fehlmenge anfällt.

### Senken-Auswahl

Sortierung (absteigend):
1. `lastEntryTime` (zuletzt befüllter Tab gewinnt)
2. `drillPriority` (höhere Prio = später bearbeitet = wahrscheinlicher Senke)
3. `Index` (höherer Index als Tiebreaker)

Fallback (keine Prio gesetzt): zuletzt befüllt nach Uhrzeit.

### Berechnung pro Material (Saat und Dünger getrennt)

```
own_i       =  SOLL_Bedarf_i − used_i                (Plan-Rest; <0 = überfüllt)
burden      =  Σ (IST_Bedarf_i − SOLL_Bedarf_i)      über alle Tabs mit istHektar > 0
absorbiert  =  Σ max(0, −own_i)                       über Nicht-Senken (Überfüllungen schlucken)
burden_net  =  burden − absorbiert                    (negativ = Netto-Ersparnis)
remaining_i =  max(0, own_i)                          für Nicht-Senken
remaining_Senke = max(0, own_Senke + burden_net)
```

### Materialerhaltung

```
Σ remaining = Σ(IST-Bedarf bearb. + SOLL-Bedarf unbearb.) − Σ used
```

Kein Material verschwindet, kein Material wird doppelt gezählt.

### Rückgabe pro Tab

```javascript
{
  savedEinheit:    number,    // Positiv: Ersparnis auf andere Tabs verteilt
  savedDuenger:    number,
  excessEinheit:   number,    // Positiv: Mehrbedarf aus anderen Tabs übernommen
  excessDuenger:   number,
  nettedEinheit:   number,    // Legacy/Compat
  nettedDuenger:   number,
  sinkAdjustedE:   number,    // Senken-Zuschlag
  sinkAdjustedD:   number,
  selfDeviationE:  number,    // IST − SOLL für Hinweise
  selfDeviationD:  number,
  isSink:          boolean    // true = dieser Tab ist die Senke
}
```

### Cache

`computeAllCarryovers()` cached das Ergebnis in `_internal.carryoverCache`. `invalidateCarryoverCache()` wird bei jedem `saveState()` aufgerufen.

### `isTabDone(r, tabIndex)`

Ein Tab gilt als „fertig", wenn die Summe aus:
- `usedEinheit` (eingetragene Einheiten)
- `savedEinheit` (Ersparnis aus anderen Tabs)
- `excessEinheit` (Mehrbedarf zu anderen Tabs)

≥ `totalE` (SOLL- oder IST-Einheiten je nach Verfügbarkeit), mit Toleranz `EPSILON_QUANTITY = 0.05`.

**Hinweis:** `r.done` ist ein **expliziter User-Toggle** (Issue #377), nicht von `isTabDone` abgeleitet. Beide existieren unabhängig.

---

## Fahrgassen & Einheiten-Größe

### Fahrgassen

Produktivitätsfaktor: `(breite - 1) / breite` (Guard: `breite < 2 → 1.0`).

Beispiel: 24m Fahrgassenbreite → Faktor `(24-1)/24 ≈ 0,958`. Bei 12 ha mit 90.000 Körnern/ha sind das:
- Ohne Fahrgassen: 12 × 90.000 / 50.000 = 21,6 Einheiten
- Mit Fahrgassen: 21,6 × 0,958 ≈ 20,7 Einheiten

Per-Tab-Override möglich (`r.fahrgassenEnabled`, `r.fahrgassenBreite`), fällt auf globale Settings zurück.

### Einheiten-Größe

Globale Konfiguration: `state.koernerProEinheit` (Standard 50.000). Mit Toggle `state.einheitGroesseEnabled` wird das Eingabefeld „Körner pro Einheit" sichtbar und editierbar.

---

## Persistenz, Migration & Cross-Tab-Sync

### Speicher-Key

**`localStorage['agrar_rechner']`** — JSON-serialisiertes `state`-Objekt.

### Migrationen

`migrateLegacyStorageKeys()` (state.js:54) läuft synchron beim Modul-Load (also beim ersten Page-Load):

```javascript
var LEGACY_KEY_MAP = {
  'mais_rechner':              'agrar_rechner',     // Hauptrepo-Rename
  'mais_rechner_theme':        'theme'              // Theme-Key-Unifizierung
};
```

Liest alte Keys, schreibt in neue (falls dort noch nichts), löscht alte. Idempotent.

`parsePersistedState()` (state.js:242) führt Schema-Migrationen durch:
- Alte Single-Flat-State-Struktur (ohne Tabs) → neues Tab-Schema
- Globale `entries` → per-Tab `entries`
- Fehlende Felder (`machineLog`, `drillPriorities`, `done`, `dashboardOpen`) auf Default-Werte

### Schema-Validierung (Defense-in-Depth)

Siehe [State → Schema-Validierung](#schema-validierung). Verhindert Crashes bei manipuliertem oder korruptem localStorage.

### Cross-Tab-Sync

`render-tabs.js:146-160`: Listener auf `window.addEventListener('storage', ...)`. Wenn ein anderer Tab den State schreibt, wird der neue State geladen, aber **die Schema-Validierung aus `loadState()` wird NICHT angewendet** (siehe [Bekannte Limitationen](#bekannte-limitationen) TODO-Eintrag).

### Quota-Handling

`saveState()` fängt `QuotaExceededError` ab und zeigt `#save_error_banner` (Role=alert, persistent solange nicht dismissed).

### Theme-Migration (separater Key)

`localStorage['theme']` (Wert: `'dark'` oder `'light'`). Migration von `mais_rechner_theme` läuft ebenfalls beim Modul-Load.

---

## Dashboard

Vollseiten-Ansicht über das Icon 📊 oben rechts oder den Bottom-Nav-Punkt. Im `app-layout` als Flex-Geschwister von `.scrollable-content` (KEIN `position:fixed`, kein Bottom-Sheet).

**Header:** 🌾 Agrar-Rechner + Theme-Toggle-Button.

**Pro Tab eine Card** mit:
- Tab-Name + Done-Toggle + Prio-Toggle (— ➊ ➋ …)
- SOLL-Fläche, IST-Fläche, Differenz
- SOLL-Einheiten, IST-Einheiten, Eingefüllt, **Verbleibend**
- SOLL-Dünger, IST-Dünger, Eingefüllt, Verbleibend
- Hinweise bei Ersparnis/Mehrbedarf/Senke

Das Dashboard stellt via `dashboardOpen` sicher, dass beim Reload die letzte Ansicht wiederhergestellt wird.

---

## Reset & Datenverwaltung

Footer-Button 🗑️ öffnet ein **Reset-Modal** mit zwei Optionen:

| Option | Wirkung |
|--------|---------|
| 🗂️ Tab zurücksetzen | Setzt nur aktiven Tab zurück (Eingaben + Drill-Entries + Carryover-Anteil) |
| 🗑️ Alles zurücksetzen | Setzt gesamten State auf Defaults (1 Tab „Schlag 1", leer) |

Implementiert in `ui-handlers.js:247-405`. Cancel-Buttons (X, „Abbrechen", Overlay-Click).

---

## Formatierung & Lokalisierung

### Deutsche Zahlen-Formatierung

- **Tausendertrennzeichen**: `.` (z. B. `50.000`)
- **Dezimaltrennzeichen**: `,` (z. B. `12,5`)
- **DE-Rundung**: „round half up" — ab `.5` wird aufgerundet (`0,05 → 0,1`, nicht `0,0`)

### `fmt(n)`

Runde auf 1 Dezimalstelle, deutsche Formatierung. Schutz gegen `null`/`undefined`/`NaN` → `'0,0'`.

### `fmtCompact(n)`

Wie `fmt()`, aber ohne nachstehendes `,0` für ganze Zahlen (z. B. `5` statt `5,0`). Verwendet im Dashboard für kompakte Anzeige.

### `parseDE(val)`

- Number → `isNaN`-Guard
- String → `.` entfernen, `,` → `.`, `parseFloat`
- Null/Empty/NaN → `0` (Issue #262: früher `null`, hat 207 Tests rot gemacht)

### `formatEinheit(n)`

`1.0 → "1 Einheit"`, alles andere → `"X,X Einheiten"`. Schutz gegen Infinity → `'—'`.

### Pluralisierung

„1 Einheit" vs. „X Einheiten" hartkodiert mit `=== 1.0`-Check.

---

## Theme / Dark Mode

- **Initialer Theme-Load** synchron beim Modul-Load (`main.js:117 initTheme()`), um FOUC zu vermeiden.
- **Reihenfolge**: 1) gespeicherte User-Präferenz (`localStorage['theme']`), 2) `prefers-color-scheme: dark` System-Settings.
- **Toggle-Buttons** im Header (Rechner-Ansicht) und im Dashboard-Header.
- **CSS-Variablen** in `:root` für Light, in `html.dark` für Dark. **Keine** `@media (prefers-color-scheme: dark)` — nur die `.dark`-Klasse wird umgeschaltet.
- **Theme-Color-Meta-Tag** wird mit umgeschaltet (`#2d5016` für Light, `#1a1f16` für Dark).

---

## Sicherheit & Header

`public/_headers` definiert Cloudflare-Pages-Header. Aktuell:

- **CSP** (`Content-Security-Policy`) — `default-src 'self'`, `'unsafe-inline'` für `script-src` und `style-src` wegen Inline-Event-Handlern und Inline-Styles. Migration auf `addEventListener` ist offen (siehe Limitationen).
- **Referrer-Policy**: `strict-origin-when-cross-origin`
- **Permissions-Policy**: `camera=(), microphone=(), geolocation=(), interest-cohort=()`
- **X-Content-Type-Options**: `nosniff`
- **Cache-Control** pro Pfad: `no-cache` für HTML/JS/CSS/Manifest/SW, `max-age=604800` für Bilder.

### Was die App **nicht** tut (Security-by-Design)

- Kein Backend, kein Auth, keine User-Accounts.
- Keine externen JavaScript-CDNs.
- Keine `eval()`, `Function()`, String-`setTimeout`.
- Keine `insertAdjacentHTML` / `document.write` mit User-Content. Alle Tab-Namen über `textContent`, Maschinen-Log-Texte aus Zahlen/Zeitwerten + `createTextNode`.
- Keine Notifications/Clipboard/Geolocation/Permissions-API.
- `localStorage` bleibt origin-isoliert (Browser-Default).

---

## UI-Komponenten

- **Tab-Bar** (`#tab_bar`) mit Add-Button links, Protokoll-Tab rechts.
- **Rechner-Karte** (`#card_input`) — Fläche & Aussaatstärke, IST-Fläche, Körner pro Hektar, Einheiten-Größe, Dünger.
- **Ergebnis-Bereich** (`#results`) — SOLL/IST/Verbleibend für aktiven Tab.
- **Drill-Bereich** (`#drill_section`) — nur sichtbar wenn Tab Daten hat. Eingaben für Maschine eingefüllt + Zählerstand, Einfüllen-Button.
- **Bottom-Nav** (`.bottom-nav`) — 3 Tabs: Rechner / Protokoll / Übersicht.
- **Header** mit Theme-Toggle + Dashboard-Open.
- **Reset-Modal** (`#reset_modal`) — Tab oder Alles zurücksetzen.
- **Save-Error-Banner** (`#save_error_banner`) — bei `QuotaExceededError`.

---

## Berechnungsformeln im Detail

```
SOLL-Einheiten(r)   = max(0, (r.hektar × r.koerner) / kpe × fahrgassenFaktor(r))
IST-Einheiten(r)    = max(0, (r.istHektar × r.koerner) / kpe × fahrgassenFaktor(r))
SOLL-Dünger(r)      = max(0, r.hektar × r.duenger)
IST-Dünger(r)       = max(0, r.istHektar × r.duenger)
Dünger/Einheit(r)   = r.duenger × kpe / r.koerner
Fahrgassen-Faktor(b) = (b - 1) / b    (b ≥ 2, sonst 1)

own_i          = SOLL_i − used_i
burden         = Σ (IST_i − SOLL_i)   über Tabs mit istHektar > 0
absorbiert     = Σ max(0, −own_i)      über Nicht-Senken
burden_net     = burden − absorbiert
remaining_i    = max(0, own_i)          für Nicht-Senken
remaining_Senke = max(0, own_Senke + burden_net)

isTabDone(r)   = (used + carryover_in − carryover_out) ≥ total  (± EPSILON)
```

---

## Testabdeckung

**45 Test-Dateien, 771 Tests** — alle in Vitest+jsdom, laufen via `pnpm test`.

Die Test-Suite deckt substantiell mehr ab als „happy path":

- **Schema-Validierung** gegen manipulierten localStorage (Prototype-Pollution, Type-Injection, Missing/Extra-Fields, Round-Trip-Safety)
- **Carryover-Konservierung** über mehrere Drill-Operationen (Materialerhaltung)
- **Cross-Tab-Sync** mit malformed JSON (graceful degradation)
- **Defekte A/B/C** (spezifische IST/SOLL-Sync-Bugs die einmal aufgetreten sind)
- **Senken-Modell** für 4-Tab-Szenarien, Senken-Auswahl (Prio/Zeit/Index), Materialerhaltung
- **Per-Tab-Locking** der Drill-Inputs
- **Edge-Cases** (NaN, leerer String, Auto-Komma, Cursor-Position)
- **Migration** alter flat-State-Strukturen und alter localStorage-Keys
- **iOS/Android Input-Sonderfälle**

**Tests ausführen:**

```bash
pnpm test          # einmalig, CI-equivalent
pnpm test:watch    # watch mode
pnpm lint          # eslint
```

---

## Deployment

Deployed als **Cloudflare Pages** (Static Assets), Projekt `agrar-rechner-dev`.

- **Trigger**: Push auf `dev`-Branch (PRs gegen `dev` ebenfalls)
- **Build**: Keiner — die `public/`-Assets werden direkt serviert.
- **Deploy-Mechanik**: Cloudflare Dashboard Git Integration (Workers Builds). GitHub-Actions macht **nur** Lint + Test, kein Deploy-Step (der alte `wrangler-action`-Step wurde entfernt, weil `CLOUDFLARE_API_TOKEN` kein `Account:Read`-Scope hatte).
- **Branch-Modell**: Feature-Branches → PR gegen `dev` → Merge triggert Deploy → periodischer Sync `dev` → `master`. `master` ist der stabile Public-Mirror.

### Service-Worker-Cache-Strategie

**Network-First** für alle Requests (nicht nur HTML). Cache dient nur als Offline-Fallback, nicht als primäre Quelle. `skipWaiting()` + `clients.claim()` für sofortige Aktivierung neuer Versionen.

`CACHE_VERSION = 'agrar-rechner-v47'` ist nur noch Namespace für den Offline-Cache; muss seit der Network-First-Umstellung **nicht** mehr manuell gebumpt werden.

### Cache-Header (`public/_headers`)

| Pfad | Cache-Control |
|------|---------------|
| `/sw.js` | `no-cache, no-store, must-revalidate` |
| `/*.html` | `no-cache` |
| `/js/*.js` | `no-cache` |
| `/css/*.css` | `no-cache` |
| `/manifest.json` | `no-cache` |
| `/*.png`, `/*.svg` | `public, max-age=604800` (7 Tage) |

---

## Bekannte Limitationen

- **Inline-Event-Handler** (`onclick="…"`) — 19 Stellen in `index.html`. CSP muss daher `script-src 'unsafe-inline'` enthalten. Migration auf `addEventListener` ist offen.
- **Google Fonts extern** — `fonts.googleapis.com` als einzige externe Abhängigkeit. Bricht offline-first für Fonts (nicht für App selbst). DSGVO-relevant. Self-Hosting offen (siehe `IDEAS.md`).
- **CSS-Version `?v=18`** an zwei Stellen (`index.html:16` + `sw.js:13`) — Drift-Risiko bei künftigen CSS-Änderungen. Langfristig auf network-first-Cache-Busting umstellen.
- **Cross-Tab-Sync umgeht Schema-Validierung** (`render-tabs.js:151-159`) — wenn ein anderer Tab korrumpierten State schreibt, wird er ohne `parsePersistedState` übernommen. Fix offen.
- **Touch-Targets teilweise < 44×44 px** — `.tab-close`, `.drill-prio-btn`, `.theme-toggle`, `.reset-modal-x`. WCAG-Verbesserung offen.
- **WCAG-Kontrast** an einigen Stellen unter 4,5:1 (Placeholder, Dashboard-Statusfarben). Verbesserung offen.
- **WAI-ARIA Tab-Pattern** unvollständig — kein `role="tablist"`, keine Arrow-Key-Navigation. A11y-Verbesserung offen.
- **Reset-Modal ohne Focus-Trap / Escape-Handler** — `openResetModal()` setzt nur CSS-Klasse.
- **Dashboard ohne `.dashboard-close`-Element** — `render-dashboard.js` sucht danach, es existiert nicht. Focus-Management bricht.
- **System-Theme-Änderung** wird nach Start nicht verfolgt (kein `matchMedia(...).addEventListener('change', …)`).
- **Keine responsiven Breakpoints** im CSS — einzige `@media`-Regel ist `prefers-reduced-motion`.
- **Test-Numerierung kollidiert** (`43-*` 2×, `44-*` 2×, `NN-*`) — Cleanup offen.
- **`onInputFormat` ist 84 LOC mit 5 Verzweigungen** — Testbarkeit eingeschränkt, Extraktion als pure function offen.
- **`ui-handlers.js` ist 997-LOC-God-File** — Tab-Mgmt, Drill, Reset, Input-Format in einer Datei. Split offen.
- **`0.05` Magic-Number** 43× statt Konstante `EPSILON_QUANTITY` — Konsolidierung offen.

Detaillierte Liste mit Datei:Zeile-Referenzen: siehe `CODE_DEEP_DIVE.md`.

---

## Mitmachen

- Issues und PRs gegen `dev`-Branch
- Vor PR: `pnpm lint && pnpm test` lokal grün
- Conventional Commits: `feat:`, `fix:`, `refactor:`, `chore:`, `dx:`
- AGENTS.md ist Pflichtlektüre für AI-Agents