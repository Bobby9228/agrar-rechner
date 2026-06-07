# ESLint Baseline — Phase 2

Erfasst am 2026-06-07 nach Setup der Flat-Config (`eslint.config.js`).

## Gesamtergebnis

```
pnpm lint  →  Exit-Code 1 (erwartet — 841 Errors, siehe unten)
pnpm test  →  345 fail / 358 pass (703 Tests)
                identisch zur Baseline auf dev-HEAD (pre-existing)
```

**Linter läuft ohne Absturz** ✔ — Akzeptanzkriterium erfüllt.

## Verteilung der Befunde (Top-Regeln)

| Regel              | Anzahl | Severity | Auto-Fix? |
|--------------------|-------:|----------|-----------|
| `quotes`           | 4 166  | warn     | ja        |
| `no-var`           |   512  | error    | ja        |
| `no-undef`         |   290  | error    | nein      |
| `no-unused-vars`   |    50  | warn     | nein      |
| `no-redeclare`     |    35  | error    | ja        |
| `no-multi-spaces`  |    15  | warn     | ja        |
| `eol-last`         |     9  | warn     | ja        |
| `no-trailing-spaces` |   6  | warn     | ja        |
| `no-useless-assignment` |  4 | warn    | nein      |
| `no-console`       |     3  | warn     | nein      |
| `no-alert`         |     1  | warn     | nein      |
| **Gesamt**         | **5 203** (887 Errors / 4 316 Warnings) | | 4 735 auto-fixbar |
| _Phase 2 Baseline_ | _5 091 (841 / 4 250) — Phase 3 fügte +46 Errors / +66 Warnings durch neue Module_ | | |

## Beobachtungen

1. **`quotes` (4 166) dominiert.** Legacy-Code mischt Single- und Double-Quotes.
   Auto-Fixbar — bewusst NICHT in Phase 2 ausgeführt, um Diff überschaubar zu halten.
2. **`no-var` (512)** ist der größte Fehler-Treiber. Auch auto-fixbar (`var` → `let`,
   soweit keine Re-Assignments). Tritt gehäuft in `public/js/calculations.js`,
   `public/js/state.js` und `public/js/ui-handlers.js` auf.
3. **`no-undef` (290)** deutet auf implizite Globals (häufig: `Tab`/`state` aus
   anderen Modulen, die im Lint-Scope nicht sichtbar sind). Erfordert manuelle
   Prüfung / ggf. `/* global Tab */` Direktiven.
4. **`no-redeclare` (35)** und **`no-unused-vars` (50)** sind manuelle Reviews.
5. `pnpm test`-Baseline (345 fail / 358 pass) entspricht dem Stand auf
   `dev-HEAD` — kein Test wurde durch die ESLint-Einrichtung gebrochen.

## Empfehlung für Phase 3+

Phase 2 etabliert die Lint-Pipeline, ohne bestehenden Code anzufassen. Folgeschritte:

- **`quotes` + `semi` per `--fix` über alle Dateien** → ~4 200 Warnungen in einem Rutsch.
- **`no-var` per Codemod** (`var` → `let`, semantisch korrekt) → 512 Errors in 1-2 Commits.
- **`no-undef` manuell** in 2-3 dedizierten Commits pro Datei.
- Nach jedem Auto-Fix-Lauf: `pnpm test` zur Verifikation, dass keine Verhaltensänderung.

## Reproduktion

```bash
cd /root/workspace/agrar-rechner
pnpm install
pnpm lint   # Baseline reproduzieren
```
