# Mitwirken am Agrar-Rechner

Danke, dass du den Agrar-Rechner verbessern möchtest. Beiträge von Menschen und KI-Agenten sind willkommen.

## Vor dem Start

- Lies für Projektüberblick und Nutzung die [`README.md`](README.md).
- Lies als KI-Agent zusätzlich die [`AGENTS.md`](AGENTS.md). Sie enthält die verbindlichen technischen Leitplanken.
- Prüfe bestehende Issues und Pull Requests, damit keine Arbeit doppelt gemacht wird.
- Größere Änderungen sollten vor der Umsetzung in einem Issue abgestimmt werden.

## Lokale Einrichtung

Benötigt werden **Node.js 22** und **pnpm 9**. Andere Paketmanager werden in diesem Projekt nicht unterstützt.

```bash
git clone https://github.com/Bobby9228/agrar-rechner.git
cd agrar-rechner
pnpm install --frozen-lockfile
```

## Ablauf für Änderungen

Ausgangspunkt für neue Änderungen ist `dev`. `master` ist der stabile öffentliche Stand und kein Ziel für direkte Feature-Änderungen.

```bash
git switch dev
git pull --ff-only origin dev
git switch -c fix/kurze-beschreibung
```

Übliche Branch-Präfixe:

- `feat/` für neue Funktionen
- `fix/` für Fehlerbehebungen
- `refactor/` für interne Umstrukturierungen
- `docs/` für Dokumentation
- `test/` für Tests
- `chore/` oder `ci/` für Wartung und CI

Halte Änderungen möglichst klein und thematisch fokussiert. Die App ist eine statische PWA ohne Build-Schritt; produktiver Code liegt direkt unter `public/`.

## Qualität prüfen

Vor einem Pull Request müssen mindestens Linter und Tests laufen:

```bash
pnpm lint
pnpm test
```

Bei Änderungen an Oberfläche oder Verhalten bitte zusätzlich den betroffenen Ablauf manuell prüfen. Bei sichtbaren UI-Änderungen helfen Vorher-/Nachher-Screenshots im Pull Request.

Wenn eine Prüfung nicht ausgeführt werden konnte oder nicht zutrifft, begründe das im Pull Request kurz und ehrlich.

## Commits

Verwende Conventional Commits und nenne nach Möglichkeit das zugehörige Issue:

```text
fix(#123): Berechnung bei leerer Eingabe korrigieren
feat(#124): Export des Tagesberichts ergänzen
```

Übliche Typen sind `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `ci` und `dx`.

## Pull Requests

- Öffne Pull Requests normalerweise gegen `dev`.
- Nutze das vorhandene Pull-Request-Template vollständig.
- Beschreibe Problem oder Ziel, konkrete Änderungen, Ergebnis und Verifikation.
- Verknüpfe das Issue mit `Closes #123`, wenn der Pull Request es vollständig löst.
- Warte vor dem Merge auf erfolgreiche CI-Prüfungen.

## Änderungen mit besonderem Prüfbedarf

Folgende Bereiche benötigen ausdrücklich eine sorgfältige menschliche Prüfung:

- `public/sw.js` und dessen Cache-Verhalten
- `wrangler.jsonc`
- `.github/workflows/`
- neue Runtime-Abhängigkeiten
- Änderungen an der Modulstruktur unter `public/js/`

Füge keinen Bundler, kein Backend, keine Telemetrie und keine TypeScript-Migration ohne vorherige Abstimmung hinzu. Weitere technische Grenzen stehen in [`AGENTS.md`](AGENTS.md).

## Fehler melden

Ein hilfreicher Fehlerbericht enthält:

- die Schritte, mit denen der Fehler reproduziert werden kann
- das erwartete und das tatsächliche Verhalten
- Browser und Gerät
- nach Möglichkeit einen Screenshot
- die Information, ob bereits gespeicherte App-Daten betroffen sind
