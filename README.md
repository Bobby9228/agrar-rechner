# Agrar-Rechner — Dokumentation

> Versionsstand: siehe Abschnitt [Versionierung & Cache](#versionierung--cache). Commit-Hash, LOC- und Test-Zähler in früheren README-Versionen wurden in #449 entfernt, weil sie bei jedem Commit veralten und keinen Doku-Mehrwert hatten.

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
19. [Versionierung & Cache](#versionierung--cache)
20. [Bekannte Limitationen](#bekannte-limitationen)
21. [Mitmachen](#mitmachen)

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
- **24 Test-Suiten, 1256 Tests** (Vitest + jsdom, fachliche Suiten ohne Nummern-Präfix; exakte Zahlen siehe `pnpm test` Lauf)

---

## Architektur & Datenmodell

### Technologie-Stack

- **Vanilla JS** — keine Bundler, kein TypeScript, kein Framework. ES5-Syntax mit `var`, split in 21 Module.
- **Statische PWA** — `index.html` + 1 CSS + 21 JS-Module + `manifest.json` + `sw.js`. Kein Build-Step.
- **Persistenz** — `localStorage` mit JSON-Serialisierung, eigene Schema-Validierung.
- **Tests** — Vitest + jsdom, fachliche Suiten ohne Nummern-Präfix.

### Dateistruktur

```
agrar-rechner/
├── public/                          # Statische Assets (Cloudflare Pages Root)
│   ├── index.html                   # Single HTML — nur Markup + Inline-Handler
│   ├── manifest.json                # PWA-Manifest
│   ├── sw.js                        # Service Worker (Network-First)
│   ├── _headers                     # Cloudflare-Pages-Header (Cache + Security)
│   ├── css/
│   │   └── styles.css               # ~3.180 Zeilen, Custom Properties, Dark Mode, self-hosted Fonts
│   ├── fonts/                       # WOFF2 (Inter, Source Serif 4) — self-hosted, offline
│   ├── js/                          # 21 Module, Lade-Reihenfolge via <script>-Tags
│   │   ├── app-globals.js           # Namespace (AppGlobals), state-Live-Alias
│   │   ├── state.js                 # state-Objekt, Schema-Validierung, Persistenz
│   │   ├── culture.js               # Kultur-Profile (Mais/Raps/Sonstiges)
│   │   ├── calculations.js          # Pure Berechnungen + Carryover-Senken-Modell
│   │   ├── culture-handlers.js      # Kultur-Auswahl, -Wechsel, Badge, Empfehlung
│   │   ├── ui-handlers.js           # UI-Utilities (Einheiten-Editor, Fahrgassen-Toggle)
│   │   ├── input-handlers.js        # Input-Bindings (onInputFormat, onInputX)
│   │   ├── settings-handlers.js     # Einstellungen (Einheiten-Größe, Fahrgassen)
│   │   ├── reset-handlers.js        # Reset-Modal + Reset-Logik
│   │   ├── drill-handlers.js        # Drill-Verteilung (Prio-Modell), machineLog
│   │   ├── protocol-handlers.js     # Protokoll-View-Wechsel, Buchungs-Löschung
│   │   ├── tab-handlers.js          # Tab-Verwaltung (add/remove/switch/rename)
│   │   ├── render-tabs.js           # Tab-Bar-Rendering, Cross-Tab-Sync, initUI
│   │   ├── state-coordinator.js     # Zentrale Persistenz+Render-Koordination (#417)
│   │   ├── render-results.js        # Rechner-Ergebniskarten
│   │   ├── render-drill.js          # Drill-Protokoll + Maschinen-Log (Rendering)
│   │   ├── render-dashboard.js      # Dashboard-Übersicht aller Felder
│   │   ├── render-local-protocol.js # Lokales Protokoll (Schläge/Maschine-Tabs)
│   │   ├── data-io-handlers.js      # Daten-Export/Import (JSON-Envelope)
│   │   └── main.js                  # Init, Theme, Service-Worker-Registration
│   └── icon*.{svg,png}              # PWA-Icons
├── tests/                           # Vitest, fachliche Suiten ohne Nummern-Präfix
│   ├── helpers.js                   # DOM-Mock, Module-Loader (spiegelt index.html)
│   ├── helpers/                     # Thematische Test-Helper (z.B. Invarianten)
│   └── *.test.js                    # Fachliche Suiten ohne Nummern-Präfix (#419)
├── AGENTS.md                        # Working Agreement für AI-Agents
├── IDEAS.md                         # Roadmap
├── eslint.config.js                 # Flat Config, ESM
├── vitest.config.js                 # jsdom env
├── wrangler.jsonc                   # Cloudflare Pages
├── .nvmrc                           # Node 22
└── .github/workflows/deploy.yml     # Lint + Test (kein Deploy-Step — Deploy via Cloudflare Dashboard Git Integration)
```

### Lade-Reihenfolge der JS-Module

Per `<script>`-Tags am Ende von `index.html` — kritisch wegen implizitem Window-Scope und ADR-001-Namespace-Pattern (siehe [`docs/ADR-001.md`](docs/ADR-001.md)):

```
app-globals.js → state.js → culture.js → calculations.js
  → culture-handlers.js → ui-handlers.js → input-handlers.js
  → settings-handlers.js → reset-handlers.js → drill-handlers.js
  → protocol-handlers.js → tab-handlers.js → render-tabs.js
  → state-coordinator.js → render-results.js → render-drill.js
  → render-dashboard.js → render-local-protocol.js
  → data-io-handlers.js → main.js
```

Die Kongruenz dieser Liste mit `index.html` und dem Service-Worker-Precache
(`STATIC_ASSETS`) wird von `tests/deploy-sanity.test.js` erzwungen.

Jedes Modul registriert seine Exporte am Dateiende via `Object.assign(window.AppGlobals, …)`. Konsumenten greifen über `AppGlobals.funktionName()` zu, nicht über `window.funktionName()`. [ADR-001](docs/ADR-001.md) (Issue #278) dokumentiert die Migration.

### Datenfluss

```
User-Input (HTML <input>)          Cross-Tab-Sync
        ↓                                ↓
onInputFormat / onInputX              storage-Event
(input-handlers)                       ↓
        ↓                          AppGlobals.state = remote
syncStateFromInputs()              (parseAndSanitizeState-Pipeline)
        ↓                                ↓
AppGlobals.state.X = Wert          direkte Renderer-Aufrufe
        ↓                          (bewusst KEIN appDispatch,
appEmit(EVENTTYP)  →  state-coordinator.js (appDispatch)   ↓
        ↓                          sonst Endlosschleife)
EVENT_PLAN: persist? + Renderer-Liste
        ↓
saveState()  →  localStorage
        ↓
geplante Renderer (renderTabs / renderResults / renderView / …)
        ↓
DOM-Update
```

Seit #417 entscheidet der `EVENT_PLAN` im `state-coordinator.js` zentral,
welcher Eventtyp persistiert wird und welche Renderer laufen — Handler und
Renderer selbst rufen kein `saveState()` mehr auf (einziger dokumentierter
Sonderfall: `commitImportedState` beim Daten-Import).

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
    done:       false,          // Manueller User-Toggle "Tab fertig"
    koernerProEinheit: 50000,   // Per-Tab Einheitsgröße (Migration 5→6; Sonstiges = 0/leer)
    notizen:    ''              // Freier Notiz-Text pro Schlag (Migration 8→9; max. 500 Zeichen)
  }],
  activeReiter:    0,           // Index des aktiven Tabs
  activeView:      null,        // null = Rechner, 'protokoll' = Drill-Protokoll-Ansicht
  dashboardOpen:   false,       // Letzte Ansicht vor Reload (für Restore)
  fahrgassenEnabled:  false,    // Globale Fahrgassen-Korrektur
  fahrgassenBreite:    0,       // Globale Fahrgassenbreite (m)
  einheitGroesseEnabled: false, // Benutzerdefinierte Einheiten-Größe (UI-Auf-/Zuklapp-Toggle)
  koernerProEinheit: 50000,     // Default für NEUE Tabs, bis Kultur gewählt ist
  kultur:           null,        // 'mais' | 'raps' | 'sonstiges' (Migration 5→6)
  erstauswahlDone:  false,      // Kultur-Erstauswahl abgeschlossen (steuert das Pflicht-Modal)
  machineLog:    [],            // Globales Maschinen-Log (alle Einfüllungen, alle Tabs)
  drillPriorities: {},          // { tabIndex: 0|1|2|... } — 0 = keine Prio
  protocolView:  'fields',      // Lokales Protokoll: 'fields' (Schläge) | 'machine' (Migration 7→8)
  protocolOpenCards: {}         // YYYY-MM-DD → true im Schläge-Accordion geöffnet (Migration 7→8)
};
```

### Schema-Validierung

`loadState()` und Cross-Tab-Sync teilen sich die gleiche Validierungspipeline
(`AppGlobals.parseAndSanitizeState` in `state.js`). Der Eingabe-Rohstring
durchläuft:

- `parsePersistedState(raw)` — `JSON.parse(raw, jsonReviver)` (Reviver blockiert
  `__proto__`/`constructor`/`prototype` auf jeder Verschachtelungsebene)
- `sanitizeNumber(v, fallback)` — Number + Finite + NaN-Guard
- `sanitizeString(v, fallback, maxLen)` — String + Length-Limit (Memory-Bomb-Schutz)
- `sanitizeBoolean(v, fallback)` — Boolean-Coercion
- `sanitizeEntryTime(v)` — Drill-Protokoll-`time`: numer oder `"HH:MM"`-String
- `sanitizeEntry(raw)` — Drill-Protokoll-Eintrag
- `sanitizeMachineLogEntry(raw)` — Maschinen-Log-Eintrag
- `sanitizeTab(raw)` — Komplettes Tab-Objekt (Per-Feld-typgeprüft, mit
  `notizen`-String-Cap bei 500 Zeichen; siehe `STATE_LIMITS` für die absolute
  Worst-Case-Obergrenze)
- `isPlainObject(v)` — Helper: nur `{}`-Literale (keine Klassen-Instanzen,
  kein `Object.create(null)`)
- Schema-Migrationen `0→1`, `1→2`, …, `8→9` (z. B. Single-Flat → Tab-Array,
  globale `entries` → per-Tab-`entries`, Notizen pro Schlag)
- Top-Level-Whitelist `ALLOWED_TOP_KEYS` strippt unbekannte Keys

**Defense-in-Depth gegen manipulierten localStorage:** Prototype-Pollution-Schutz
(jsonReviver), Type-Injection-Schutz (Per-Feld-Sanity in `sanitizeTab`/`sanitizeEntry`/
`sanitizeMachineLogEntry`), `ALLOWED_TOP_KEYS`-Whitelist, Längen-Limits auf alle
Strings, Cardinality-Ceilings über `STATE_LIMITS` (Defense-in-Depth #445 Welle 1;
Tests dürfen einzelne Werte live absenken). `sanitizeEntry`/`sanitizeMachineLogEntry`/
`sanitizeTab` filtern auch `__proto__`/`constructor`/`prototype`-Keys (Per-Feld +
JSON-Reviver, doppelt). (#448 Welle 1: `ALLOWED_TAB_KEYS` wurde entfernt — die
Tab-Felder werden per Per-Feld-Sanitizer in `sanitizeTab()` typgeprüft.)

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

`onInputFormat(el, mode, e)` (in `input-handlers.js`) verarbeitet Tastendrücke in Input-Feldern mit `inputmode="decimal"`:

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
| `getTabUsedEinheiten(r)` / `getTabUsedDuenger(r)` | Summe aller Drill-Entries |
| `getTabRemaining(r, tabIdx)` | Noch einzufüllende Einheiten (Carryover-aware) |
| `getTabRates(tabIdx)` | Saat/Dünger-Raten (kg/ha, ha/Einheit) für Maschinen-Log |

(#448 Welle 1: `getDuengerProEinheit` und `isTabDone` wurden entfernt — keine produktiven Konsumenten. Ersteres war eine Test-Fixture ohne UI-Anker; Letzteres lief rein im Carryover-Cache, der jetzt über `getTabRemaining()` ablesbar ist.)

---

## Tab-Verwaltung

`render-tabs.js` kümmert sich um die Tab-Bar (Rendering + `fitTabNames`), `tab-handlers.js` um die Fachlogik (add/remove/switch/rename).

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

Tab-Namen sind **`span[contenteditable]`** — direktes Bearbeiten per Klick, kein separates Input-Feld. Lange Namen werden per `fitTabNames()` (render-tabs.js) automatisch per CSS-`transform: scale()` verkleinert, bis sie in die Tab-Breite passen.

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

`renderMachineLog` (in `render-drill.js`) zeigt pro Log-Eintrag:
- Eingefüllte Einheiten + Dünger
- Tatsächliche Rate (kg Dünger/Einheit Saat)
- Soll-Rate (basierend auf `getTabRates`)
- Abweichung

---

## Carryover-System (Senken-Modell)

> **Algorithmus seit #335/#371/#377:** Senken-Modell (Prio-Workfront). Die alte zweiphasige Vorwärts/Rückwärts-Verteilung wurde entfernt (Carryover-Suiten: `tests/carryover.test.js`).

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

`computeAllCarryovers()` cached das Ergebnis in `AppGlobals.calcInternals.carryoverCache`. `invalidateCarryoverCache()` wird bei jedem `saveState()` aufgerufen.

### Tab-Fertig-Logik (Issue #377/#378/#448)

Ein Tab gilt als „fertig", wenn die Summe aus:
- `usedEinheit` (eingetragene Einheiten)
- `savedEinheit` (Ersparnis aus anderen Tabs)
- `excessEinheit` (Mehrbedarf zu anderen Tabs)

≥ `totalE` (SOLL- oder IST-Einheiten je nach Verfügbarkeit), mit Toleranz `EPSILON_QUANTITY = 0.05`.

**Hinweis:** `r.done` ist ein **expliziter User-Toggle** (Issue #377), unabhängig
von der reinen SOLL-/IST-Rechnung. Die alte Helfer-Funktion `isTabDone()`
wurde in #448 Welle 1 entfernt — die zugrundeliegende Formel lebt jetzt im
Per-Tab-Saldo-/Carryover-Pfad (`getTabRemaining()`) und wird in
`tests/carryover.test.js` durch einen lokalen Test-Orakel `tabDone(w, r, i)`
gespiegelt.

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

`migrateLegacyStorageKeys()` (in `state.js`) läuft synchron beim Modul-Load (also beim ersten Page-Load):

```javascript
var LEGACY_KEY_MAP = {
  'mais_rechner':              'agrar_rechner',     // Hauptrepo-Rename
  'mais_rechner_theme':        'agrar_rechner_theme' // Theme-Key-Konsolidierung (#448 Welle 1)
};
```

Liest alte Keys, schreibt in neue (falls dort noch nichts), löscht alte. Idempotent.

`parsePersistedState()` (in `state.js`) führt Schema-Migrationen durch:
- Alte Single-Flat-State-Struktur (ohne Tabs) → neues Tab-Schema
- Globale `entries` → per-Tab `entries`
- Fehlende Felder (`machineLog`, `drillPriorities`, `done`, `dashboardOpen`) auf Default-Werte

### Schema-Validierung (Defense-in-Depth)

Siehe [State → Schema-Validierung](#schema-validierung). Verhindert Crashes bei manipuliertem oder korruptem localStorage.

### Cross-Tab-Sync

In `render-tabs.js` (`_installCrossTabSync`, aufgerufen aus `initUI`): Listener
auf `window.addEventListener('storage', …)`. Der `storage`-Event feuert nur in
Tabs, die den Wert nicht selbst geschrieben haben. Wenn ein anderer Tab den
State schreibt, läuft der Remote-JSON durch dieselbe Pipeline wie
`loadState()` — `AppGlobals.parseAndSanitizeState(e.newValue)` —
inklusive `jsonReviver`, Schema-Migrationen (0→1, 1→2, …, 8→9) und
Top-Level-Whitelist (`ALLOWED_TOP_KEYS`). Nur wenn `result.state` von
`AppGlobals.state` abweicht, wird `AppGlobals.state = remote` gesetzt und
direkt re-rendert (`syncInputsFromState`, `renderTabs`, `renderResults`,
`_syncKulturUI`).

Das Re-Render läuft **bewusst am State-Coordinator vorbei** — eine
`appDispatch`-Schleife über `saveState → storage-Event → andere Tabs → deren
appDispatch` wäre eine Endlosschleife. Begründung im Header-Kommentar
`_installCrossTabSync` (Issue #417).

### Quota-Handling

`saveState()` fängt `QuotaExceededError` ab und zeigt `#save_error_banner` (Role=alert, persistent solange nicht dismissed).

### Theme-Migration (separater Key)

`localStorage['agrar_rechner_theme']` (Wert: `'dark'` oder `'light'`). Migration der Legacy-Keys läuft beim Lesen (`getStoredTheme()` spiegelt den ersten gefundenen Legacy-Wert auf den neuen Key und entfernt die Legacy-Einträge; #448 Welle 1). Legacy-Kette in Altersreihenfolge: `'mais_rechner_theme'` (vor Phase 3) → `'theme'` (Primärschlüssel bis #448 Welle 1) → `'agrar_rechner_theme'`.

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

Implementiert in `reset-handlers.js`. Cancel-Buttons (X, „Abbrechen", Overlay-Click).

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

- **Initialer Theme-Load** synchron beim Modul-Load (`initTheme()` in `main.js`), um FOUC zu vermeiden.
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

### HSTS

**HSTS (`Strict-Transport-Security`) wird bewusst nicht über `public/_headers` gesetzt**, sondern auf der Cloudflare-Zone gepflegt (Dashboard → SSL/TLS → Edge Certificates → HSTS). Begründung:

- HSTS wirkt **zone-weit** auf alle Hostnames unter `agrar-rechner-dev.pages.dev` (und ggf. Custom-Domains), unabhängig vom Pfad-Match der `_headers`-Datei. Es gehört damit zur Edge-Konfiguration, nicht zur Applikations-Konfiguration.
- Ein einzelner Header-Eintrag in `_headers` würde nur für die gematchten Pfade greifen — sicherheitstechnisch schwächer und operativ leicht zu vergessen.
- Der CSP-Stand in `_headers` bleibt für lokale Deployments referenziell nachvollziehbar; HSTS wird in einem einzigen Dashboard gepflegt.

Empfohlene Cloudflare-HSTS-Konfiguration für `agrar-rechner-dev` (und alle Custom-Domains):

| Feld | Wert | Begründung |
|------|------|------------|
| **Status** | **Enabled** | Erzwingt HTTPS für alle Folgerequests nach erstem Besuch |
| **max-age** | **≥ 31536000** (1 Jahr) | Über der 6-Monats-Mindestempfehlung von HSTS-Preload-Listen |
| **includeSubdomains** | nur wenn **alle** Subdomains TLS haben | Sonst bricht der Subdomain-Zugriff für Clients, die den Header bereits gespeichert haben |
| **preload** | entfällt für `.dev` | Die TLD ist gemäß hstspreload.org bereits TLD-weit preloaded — ein separates preload-Flag bringt nichts mehr (Review #445 W2) |

Aktivierung **erst nach** Bestätigung, dass alle Custom-Domains TLS-fähig sind (HTTP→HTTPS-Redirect auf Edge-Ebene existiert seit Projektstart). Status und Änderungen werden in diesem README dokumentiert; eine CI-Erinnerung ist nicht möglich, da das Dashboard manuell gepflegt wird.

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

// isTabDone wurde in #448 Welle 1 entfernt — die gleiche Aussage liefert
// getTabRemaining(r, tabIdx).remainingE (≤ EPSILON_EINHEIT) + remainingD
// (≤ EPSILON_QUANTITY).
```

---

## Testabdeckung

Fachliche Suiten ohne Nummern-Präfixe (seit #419: `kultur-*`, `carryover`,
`drill-distribution`, `app-shell-parity`, `cross-tab-sync`,
`data-export-import`, `deploy-sanity`, …). Aktuelle Suiten- und Test-Zahlen
zeigt `pnpm test` direkt — wir pflegen hier bewusst keinen statischen Zähler
mehr (veraltet sonst bei jeder Welle, siehe Issue #449).

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

`CACHE_VERSION` ist nur noch Namespace für den Offline-Cache; muss seit der Network-First-Umstellung **nicht** mehr manuell gebumpt werden. Aktueller Stand siehe `sw.js`; Vertrag (Format + Untergrenze) in `tests/deploy-sanity.test.js`.

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

## Versionierung & Cache

Die App pflegt **drei parallele Versionsstempel**, die jeweils eine andere
Cache- oder Nutzer-Frage beantworten. Alle drei werden in
`tests/deploy-sanity.test.js` vertraglich abgesichert.

| Stempel | Wert (heute) | Wo | Wofür | Wann bumpen |
|---------|--------------|----|-------|-------------|
| `APP_VERSION` | `v1.1.6` (in `public/js/main.js`) | Nutzersichtbar im Versions-Footer (`_setVersionFooter` in `render-tabs.js`) und im `pnpm test`-Pin (deploy-sanity) | Kommunikation „Was läuft beim Kunden?" | Bei jedem **fachlichen Release**, der dem Endnutzer mitgeteilt werden soll |
| `APP_BUILD_DATE` | `August 2026` (in `public/js/main.js`) | Nutzersichtbar neben `APP_VERSION` | Zeitstempel des letzten Releases | Bei jedem Release (zusammen mit `APP_VERSION`) |
| `CACHE_VERSION` | `agrar-rechner-v55` (in `public/sw.js`) | Service-Worker-Namespace für den **Offline-Fallback-Cache**; `activate`-Handler löscht ältere Caches | Garantiert, dass Offline-Clients einen frischen Precache bekommen | Nur wenn sich der Precache-Inhalt (`STATIC_ASSETS`) ändert — also neue Dateien dazu, alte raus, oder `?v=…`-Cache-Busting |
| `?v=N` je Asset | aktuell `?v=22` (CSS, ui-handlers), `?v=21` (calculations, render-results), `?v=3` (render-local-protocol) | In `index.html` und `sw.js STATIC_ASSETS` | Browser-/CDN-Cache-Busting für genau dieses Asset | Bei Änderungen an der jeweiligen Datei; **muss zwischen `index.html` und `STATIC_ASSETS` immer kongruent sein** (Test: `Kongruenz: jede lokale index.html-Ressource ist in STATIC_ASSETS`) |

### Wann bumpe ich was?

- **Fachliche / UI-Änderung** → `APP_VERSION` (Minor- oder Patch-Bump) +
  `APP_BUILD_DATE` + das/die `?v=N` an den **tatsächlich** geänderten
  Assets. **Nicht** `CACHE_VERSION` — das Network-First-Design stellt
  bei jedem Online-Besuch ohnehin die neueste Version bereit.
- **Neue Datei** in `index.html`/`sw.js`-Precache → `?v=N` ist nicht
  nötig, aber `STATIC_ASSETS` muss den neuen Eintrag enthalten.
  `CACHE_VERSION` muss gebumpt werden, damit der `activate`-Handler
  alte Caches aufräumt.
- **Reines Refactor ohne Verhaltensänderung** → kein Bump. Die Tests
  bleiben grün, die Doku-/Code-Linienreferenzen passen weiterhin.

### Vertrags-Tests

- `APP_VERSION`-Format (`v\d+\.\d+\.\d+`) und `APP_BUILD_DATE`-Vorhandensein:
  `tests/deploy-sanity.test.js > main.js exposes the current minor release
  version and build date`.
- `CACHE_VERSION`-Format (`^agrar-rechner-v\d+$`) + numerische Untergrenze
  (≥ v53 nach Font-Deduplizierung #443): `tests/deploy-sanity.test.js >
  sw.js CACHE_VERSION hat gültiges Format agrar-rechner-vN ≥ v53`.
- `STATIC_ASSETS ↔ index.html`-Kongruenz:
  `tests/deploy-sanity.test.js > Kongruenz: jede lokale index.html-Ressource
  ist in STATIC_ASSETS`.
- Modulzahl-Konsistenz `index.html == public/js/*.js == README`:
  `tests/deploy-sanity.test.js > Issue #449 — Modulzahl-Konsistenz`.

---

## Bekannte Limitationen

- **`style-src 'unsafe-inline'`** — UI-Module setzen dynamisch `.style.cssText` (z.B. Carryover-Hints). `script-src` kommt seit #418/#436 **ohne** `'unsafe-inline'` aus (keine Inline-Handler mehr, alle Bindings via `addEventListener`).
- **Cross-Tab-Sync umgeht Teile der Schema-Validierung nicht mehr** — Remote-State läuft seit #418-Ära über dieselbe `parseAndSanitizeState`-Pipeline wie `loadState()`. Verbleibend: ein kompromittierter Tab kann weiterhin gültig aussehenden, aber fachlich falschen State schreiben (kein Signatur-Schutz).
- **CSS-Version `?v=22`** an mehreren Stellen (`index.html` + `sw.js`) — Drift-Risiko bei künftigen CSS-Änderungen. Langfristig auf network-first-Cache-Busting umstellen.
- **WCAG-Kontrast** an einigen Stellen unter 4,5:1 (Placeholder, Dashboard-Statusfarben). Verbesserung offen.
- **System-Theme-Änderung** wird nach Start nicht verfolgt (kein `matchMedia(...).addEventListener('change', …)`).
- **Keine responsiven Breakpoints** im CSS — einzige `@media`-Regel ist `prefers-reduced-motion`.
- **`onInputFormat` ist eine lange Funktion** mit mehreren Verzweigungen — Testbarkeit eingeschränkt, Extraktion als pure function offen.

Bereits erledigte Punkte, die in früheren Limitationen-Listen auftauchten
und hier nur noch als Referenz stehen:

- ~~**Touch-Targets teilweise < 44×44 px**~~ — umgesetzt in #446 Welle 2a.
- ~~**WAI-ARIA Tab-Pattern** unvollständig~~ — `role="tablist"` +
  Arrow-Key-Navigation seit #446 Welle 2b.
- ~~**Reset-Modal ohne Focus-Trap / Escape-Handler**~~ — generischer
  Dialog-Helper (`dialog-a11y.js`) mit Trap + Escape seit #446 Welle 1
  (`openResetModal()` nutzt `installDialogA11y`).
- ~~**Dashboard ohne `.dashboard-close`-Element**~~ — Suche nach dem
  nicht-existenten Selector wurde in #446 Welle 1 entfernt; das
  Dashboard-Overlay nutzt ebenfalls den Dialog-Helper.
- ~~**Test-Numerierung kollidiert**~~ — Konsolidierung in #419: alle
  Suiten ohne Nummern-Präfix.
- ~~**`ui-handlers.js` ist 997-LOC-God-File**~~ — aufgeteilt in
  `tab-handlers.js`, `settings-handlers.js`, `reset-handlers.js`,
  `drill-handlers.js`, `protocol-handlers.js`, `data-io-handlers.js`
  (Issues #212, #416).
- ~~**`0.05` Magic-Number** 43× statt Konstante `EPSILON_QUANTITY`~~ —
  zentrale Konstante in `calculations.js` seit #447 Welle 1.

Detaillierte Liste: siehe die jeweiligen Modul-Header-Kommentare in `public/js/`.

---

## Mitmachen

- Issues und PRs gegen `dev`-Branch
- Vor PR: `pnpm lint && pnpm test` lokal grün
- Conventional Commits: `feat:`, `fix:`, `refactor:`, `chore:`, `dx:`
- AGENTS.md ist Pflichtlektüre für AI-Agents