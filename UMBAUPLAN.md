# Agrar-Rechner – Umbau in Etappen

> **Stand:** Die Deep-Dive-Runden **#441–#448** sind abgeschlossen
> (Daten-Export/Import-Rückverdrahtung, Test-Harness-Härtung, Versionspins,
> CSP- und Runtime-Cache-Härtung, A11y-Welle 1+2, Konstanten-/Event-SSOT,
> Renderer-Entkopplung, `initUI()`-Zerlegung, Theme-Key-SSOT, CSS-Dead-Code
> + `color-scheme`/`reduced-motion`). Verweise auf die jeweiligen Issues
> finden sich in den Commit-Messages und im README-Änderungsverlauf
> (`git log --grep "#[0-9]\+:"`).
>
> **Offen:** das zentrale Tracking-Issue für ausstehende Aufräumarbeiten
> heißt **#440** und sammelt die Themen, die aus den Deep-Dive-Runden
> als „nice to have" übrig geblieben sind (z. B. einzelne
> `render-results.js`-Helper-Konsolidierungen, weitere
> Konstanten-Extraktionen). Doku-Wahrheitspass läuft in **#449**.

## Ziel

Den bestehenden Agrar-Rechner schrittweise zu einer besonders zuverlässigen, leicht bedienbaren und später erweiterbaren App umbauen – **ohne riskanten Komplett-Neubau**.

Die App soll während des gesamten Umbaus funktionsfähig bleiben. Nach jeder Etappe gibt es einen stabilen Zwischenstand.

## Grundregeln für den Umbau

- Kein Big-Bang-Rewrite.
- Bestehende Nutzerdaten dürfen nicht verloren gehen.
- Berechnungsergebnisse dürfen sich durch technische Umbauten nicht unbemerkt verändern.
- Erst das Fundament verbessern, danach neue Funktionen ergänzen.
- Änderungen in kleinen, einzeln rücksetzbaren Schritten durchführen.
- Nach jedem Schritt `pnpm lint` und `pnpm test` ausführen.
- Weiterhin Vanilla JavaScript, statische PWA und Cloudflare Pages verwenden.
- Kein Framework, Backend oder Cloud-Zwang ohne echten praktischen Bedarf.

---

## Etappe 1 – Sicherheitsnetz aufbauen

### Ziel

Vor dem eigentlichen Umbau müssen Daten und bestehendes Verhalten abgesichert werden.

### Änderungen

1. **Datenexport als JSON-Datei**
   - Der vollständige Datenstand kann heruntergeladen werden.
   - Die Datei enthält eine Formatversion und das Exportdatum.

2. **Datenimport**
   - Eine Sicherungsdatei kann wieder eingelesen werden.
   - Importierte Daten laufen durch dieselbe Prüfung wie gespeicherte Browserdaten.
   - Vor dem Überschreiben vorhandener Daten erscheint eine Bestätigung.

3. **Wichtige Praxisszenarien als Referenztests**
   - Schlag anlegen und umbenennen
   - Soll- und Ist-Fläche eintragen
   - Einfüllung hinzufügen und löschen
   - mehrere Schläge und Prioritäten
   - Ersparnis, Mehrbedarf und Senken-Auswahl
   - Fertig-Markierung
   - Reset
   - Neuladen der App
   - Cross-Tab-Synchronisierung

### Warum diese Etappe zuerst kommt

Bevor das Innenleben verändert wird, braucht die App ein Fangnetz. Export und Import schützen echte Nutzerdaten. Die Referenztests stellen sicher, dass nach einem Umbau noch dieselben fachlichen Ergebnisse herauskommen.

### Fertig, wenn

- Ein vollständiger Datenstand exportiert und verlustfrei importiert werden kann.
- Ungültige Importdateien sicher abgewiesen werden.
- Die wichtigsten realen Arbeitsabläufe automatisch getestet werden.
- Lint und sämtliche Tests grün sind.

---

## Etappe 2 – Zukunftsfähiges Datenmodell

### Ziel

Schläge, Einfüllungen und Protokolle erhalten eine stabile Identität und hängen nicht mehr nur von ihrer Position in einer Liste ab.

### Änderungen

1. **Feste IDs einführen**
   - Jeder Schlag erhält eine eindeutige `fieldId`.
   - Jede Einfüllung erhält eine eindeutige `entryId`.
   - Protokolle verweisen auf diese IDs statt auf „erster, zweiter oder dritter Tab“.

2. **Daten übersichtlich gliedern**
   - Planung eines Schlags
   - tatsächliche Werte
   - Fahrgassen-Einstellungen
   - Einfüllungen
   - Fertig-Status

3. **Neue Datenversion anlegen**
   - Das Datenmodell bekommt eine neue Versionsnummer.
   - Alte gespeicherte Daten werden beim ersten Laden automatisch umgewandelt.
   - Die Migration darf keine vorhandenen Werte oder Einträge verlieren.

### Warum das wichtig ist

Eine Position kann sich ändern, wenn ein Schlag gelöscht oder verschoben wird. Eine feste ID bleibt dagegen immer gleich. Das ist die wichtigste technische Voraussetzung für spätere Kundenverwaltung, Feldbuch, Import/Export oder Synchronisierung mehrerer Geräte.

### Fertig, wenn

- Jeder Schlag und jeder relevante Eintrag eine stabile ID besitzt.
- Bestehende Browserdaten automatisch migriert werden.
- Die Migration mehrfach ausgeführt werden kann, ohne Daten erneut zu verändern.
- Alle bisherigen Funktionen weiterhin gleich arbeiten.

---

## Etappe 3 – Eine zentrale Steuerung für Änderungen

### Ziel

Jede Datenänderung läuft durch genau eine kontrollierte Schaltstelle.

### Änderungen

1. **Zentrale Store-Schnittstelle einführen**
   - aktuellen Zustand lesen
   - Änderung ausführen
   - Zustand vollständig ersetzen, etwa nach Import oder Cross-Tab-Sync
   - Ansichten über Änderungen informieren

2. **Benannte Aktionen verwenden**
   - Schlag hinzugefügt
   - Schlag entfernt
   - Planung geändert
   - Ist-Fläche geändert
   - Einfüllung hinzugefügt
   - Einfüllung entfernt
   - Fertig-Status geändert
   - Einstellung geändert

3. **Speichern zentralisieren**
   - Nicht mehr verschiedene Dateien rufen selbstständig `saveState()` auf.
   - Eine erfolgreiche Änderung führt genau einmal zum Speichern.
   - Berechnungs-Caches werden dabei zuverlässig ungültig gemacht.

4. **Cross-Tab-Sync integrieren**
   - Daten aus einem zweiten Browser-Tab laufen durch dieselbe Prüfung und Steuerung.

### Warum das wichtig ist

Heute müssen verschiedene Stellen daran denken, Daten zu ändern, zu speichern und die richtigen Anzeigen zu erneuern. Eine zentrale Steuerung verhindert widersprüchliche Ansichten und vergessene Speichervorgänge.

### Fertig, wenn

- UI- und Renderer-Dateien den Zustand nicht mehr beliebig direkt verändern.
- Speichern und Cache-Aktualisierung zentral erfolgen.
- Rechner, Protokoll und Übersicht nach jeder Änderung denselben Stand zeigen.

---

## Etappe 4 – Code nach Fachbereichen ordnen

### Ziel

Große Sammeldateien werden in kleinere, verständliche und unabhängig testbare Bereiche zerlegt.

### Änderungen

1. **`ui-handlers.js` schrittweise aufteilen**
   - Schlagverwaltung
   - Einstellungen
   - Drill-/Einfüllaktionen
   - Reset
   - Eingabeformatierung

2. **Berechnungen fachlich trennen**
   - Grundmengen und Fahrgassen
   - Carryover/Senken-Modell
   - Fertig-Status und Restmengen
   - Zahlenformatierung

3. **Gemeinsame Datenaufbereitung für Ansichten**
   - Eine Stelle bereitet Soll, Ist, eingefüllt, verbleibend, Ersparnis und Mehrbedarf auf.
   - Rechner, Protokoll und Übersicht verwenden dieselben aufbereiteten Werte.

4. **Klare Modulabhängigkeiten**
   - Abhängigkeiten zwischen Dateien werden ausdrücklich sichtbar.
   - Die heutige globale `AppGlobals`-Sammelstelle wird langfristig verkleinert.
   - Eine mögliche Umstellung auf Browser-ES-Module erfolgt nur schrittweise und nach gesonderter Freigabe, weil die aktuelle Modulstruktur laut `AGENTS.md` geschützt ist.

### Warum das wichtig ist

Kleine Fachmodule lassen sich leichter verstehen, testen und erweitern. Eine Änderung am Drill-Protokoll soll nicht versehentlich Tab-Verwaltung oder Eingabeformatierung beschädigen.

### Fertig, wenn

- Keine einzelne Datei mehrere unabhängige Fachbereiche vermischt.
- Agrarberechnungen weder DOM noch Browser-Speicher kennen.
- Anzeigen ihre Werte nicht mehr mehrfach und unterschiedlich berechnen.
- Nach jedem herausgelösten Bereich die vollständige Testsuite grün bleibt.

---

## Etappe 5 – Bedienung und Robustheit perfektionieren

### Ziel

Die App wird unter realen Bedingungen in der Maschinenkabine besonders sicher und verständlich bedienbar.

### Änderungen

1. **Rückgängig-Funktion**
   - Einfüllung löschen
   - Schlag löschen
   - Schlag zurücksetzen
   - alle Daten zurücksetzen
   - zunächst nur die letzte riskante Aktion, kein komplizierter Verlauf

2. **Klare Speicher- und Offline-Anzeige**
   - gespeichert
   - speichert
   - Speicherfehler
   - offline

3. **Größere und sichere Touch-Ziele**
   - wichtige Buttons mindestens ungefähr 44 × 44 CSS-Pixel
   - keine winzigen Löschflächen
   - Bedienung mit einer Hand berücksichtigen

4. **Barrierefreiheit**
   - korrekte Tab-Rollen und Tastatursteuerung
   - Dialoge mit Escape-Taste und Focus-Trap
   - Fokus nach dem Schließen sinnvoll zurückgeben
   - klickbare Elemente als echte Buttons ausführen
   - Kontrast in Light und Dark prüfen

5. **Echte Gerätetests**
   - Smartphone im Hoch- und Querformat
   - direktes Sonnenlicht
   - schlechte oder fehlende Verbindung
   - Neuladen während eines Arbeitsschritts
   - versehentliche Mehrfachberührung

### Warum das wichtig ist

Eine fachlich richtige App ist noch nicht perfekt, wenn sie während der Arbeit leicht fehlbedient werden kann oder der Nutzer nicht weiß, ob seine Eingabe gespeichert wurde.

### Fertig, wenn

- Riskante Aktionen rückgängig gemacht werden können.
- Speicher- und Offline-Zustand verständlich sichtbar sind.
- Die Kernbedienung mit Finger und Tastatur zuverlässig funktioniert.
- Die App auf einem echten Smartphone unter Praxisbedingungen geprüft wurde.

---

## Etappe 6 – Praktischen Nutzwert erweitern

### Ziel

Auf dem stabilen Fundament entstehen Funktionen, die den Arbeitsalltag direkt erleichtern.

### Änderungen

1. **Tagesabschluss-Report**
   - bearbeitete Schläge
   - Soll- und Ist-Flächen
   - Saatgut und Dünger
   - Einfüllungen
   - Restmengen und Abweichungen

2. **Druck- und PDF-Ansicht**
   - druckfreundliches Layout
   - PDF-Erzeugung zunächst über die Browser-Druckfunktion
   - keine unnötige Laufzeit-Abhängigkeit

3. **WhatsApp-/Text-Export**
   - verständlich formatierter Bericht
   - Teilen über `navigator.share()`
   - Kopieren als Rückfalllösung

4. **Vorlagen**
   - häufig verwendete Sorte
   - Körner pro Hektar
   - Körner pro Einheit
   - Düngerwerte

### Warum das wichtig ist

Diese Funktionen schaffen unmittelbaren Praxisnutzen, ohne ein Backend oder Benutzerkonto zu benötigen.

### Fertig, wenn

- Ein vollständiger Tagesbericht erzeugt werden kann.
- Der Bericht gedruckt, als PDF gespeichert, geteilt oder kopiert werden kann.
- Berichtswerte direkt aus der zentralen Fachlogik stammen.

---

## Etappe 7 – Kundenverwaltung und Feldbuch

### Ziel

Erst auf dem stabilen Fundament wird die App von einem Einsatzrechner zu einem kleinen digitalen Arbeitsbuch erweitert.

### Vorgesehenes Modell

```text
Kunde
└── Auftrag / Einsatztag
    ├── Schlag A
    ├── Schlag B
    └── Schlag C
        ├── Planung
        ├── Einfüllungen
        └── Abschluss
```

### Vorgehen

1. Zuerst reale Arbeitsabläufe gemeinsam festlegen.
2. Kunden und Aufträge erhalten stabile IDs.
3. Bestehende Schläge werden einem Standardauftrag zugeordnet.
4. Navigation zwischen Kunden, Einsatztagen und Schlägen ergänzen.
5. Tagesberichte auf Kunden und Auftrag beziehen.
6. Export und Import auf die neue Struktur erweitern.

### Warum erst jetzt

Würde die Kundenverwaltung auf das heutige, positionsbasierte Modell gesetzt, müsste sie beim späteren Architekturumbau erneut verändert werden. Nach den vorherigen Etappen ist sie dagegen eine saubere Erweiterung.

---

## Etappe 8 – Optionale spätere Funktionen

Diese Punkte sind erst sinnvoll, wenn ein echter Bedarf besteht:

- Cloud-Sicherung
- Synchronisierung mehrerer Geräte
- mehrere Benutzer
- Deutsch/Englisch
- Kamera- oder QR-Scan
- Spracheingabe oder Sprachausgabe
- Bilder pro Schlag
- Homescreen-Widget

Vor Cloud-Synchronisierung müssen Konfliktregeln geklärt sein: Was geschieht, wenn zwei Geräte denselben Auftrag gleichzeitig verändern?

---

## Was bewusst nicht am Anfang gemacht wird

- kein kompletter Neubau
- kein React-, Vue- oder Svelte-Rewrite
- kein TypeScript-Zwang
- kein Backend und keine Anmeldung
- keine Cloud vor lokaler Sicherung
- kein großes visuelles Redesign gleichzeitig mit dem Architekturumbau
- keine Kamera-, Sprach- oder Widget-Funktionen vor dem Fundament
- keine neue Laufzeit-Abhängigkeit ohne deutlichen praktischen Nutzen

---

## Empfohlene Reihenfolge

```text
Backup und Referenztests
        ↓
stabile IDs und Datenmigration
        ↓
zentrale Änderungssteuerung
        ↓
fachliche Module und reine Berechnungen
        ↓
Undo, Bedienung und Barrierefreiheit
        ↓
Berichte, PDF und Teilen
        ↓
Kundenverwaltung und Feldbuch
        ↓
optionale Cloud- und Komfortfunktionen
```

## Freigabe nach jeder Etappe

Nach jeder Etappe:

```bash
pnpm lint
pnpm test
```

Zusätzlich manuell prüfen:

1. vorhandene Daten laden;
2. Schlag anlegen und umbenennen;
3. Werte eintragen;
4. Einfüllung hinzufügen und löschen;
5. Carryover und Restmengen kontrollieren;
6. Fertig-Markierung prüfen;
7. Dashboard öffnen;
8. App neu laden;
9. offline öffnen;
10. zweiten Browser-Tab für Synchronisierung verwenden;
11. Daten exportieren und wieder importieren.

## Kurzfassung

Die wichtigsten Umbauten sind:

1. **Datensicherung und Referenztests**
2. **stabile IDs und sichere Migrationen**
3. **eine zentrale Stelle für alle Datenänderungen**
4. **reine, unabhängig testbare Agrarberechnungen**
5. **kleine Fachmodule statt großer Sammeldateien**
6. **Undo und zuverlässige Kabinenbedienung**

Alles Weitere wird anschließend einfacher. Die App bleibt dabei während des gesamten Umbaus nutzbar und jeder Zwischenstand kann separat geprüft und veröffentlicht werden.
