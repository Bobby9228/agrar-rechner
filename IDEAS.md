# Feature-Ideen für den Mais-Rechner

## Hohe Priorität

- [ ] **Kundenverwaltung mit Feldbuch** — Tabs für Kunden statt für Felder. Jeder Kunde hat mehrere Felder mit Status (offen/läuft/fertig). Gesamtübersicht: Hektar offen/fertig/fehlend auf einen Blick
- [ ] **PDF-Export des Protokolls** — Drill-Protokoll als druckbares PDF exportieren (per Browser-Print oder jsPDF)
- [ ] **WhatsApp-Protokoll-Export** — Ein Button generiert formatierten Text und teilt via `navigator.share()` direkt in WhatsApp (kein PDF, kein Backend)
- [x] ~~Restmengen-Countdown mit Flächen-Prognose~~ — Implementiert (drill-summary zeigt verbleibende Einheiten + Hektar-Prognose)
- [ ] **Tagesabschluss-Report** — Ein Button generiert strukturierte Tageszusammenfassung aller Felder: Hektar gesamt, Einheiten, Dünger, Laufzeit. Arbeitsbericht, Abrechnungsgrundlage und Dokumentation in einem.
- [ ] **Daten exportieren/importieren** — JSON-Datei mit allen Protokollen und Reitern exportieren und wieder importieren
- [ ] **Mehrere Druckerprofile speichern** — Eigene Sorte/Dichte-Kombinationen als Vorlage abspeichern

## Mittlere Priorität

- [ ] **Variable Einheiten Größe** — Einheiten-Größe (aktuell fix 50.000) als Eingabefeld konfigurierbar machen
- [ ] **Dark Mode** — Dunkles Farbschema für Abend-/Nachteinsatz
- [ ] **Dünger pro Reiter individualisieren** — Statt kg/ha eine absolute Düngermenge eingeben
- [ ] **Sprachauswahl DE/EN** — bilinguale Oberfläche
- [ ] **Kornreihen-Abstand** — Zusatzfeld für Reihenabstand (cm) für genauere Berechnung der Fahrgassen
- [ ] **History/Undo** — Letzte 10 Berechnungen als History speichern

## Niedrige Priorität

- [ ] **Widget/iOS Shortcut** — Home Screen Widget mit letztem Ergebnis
- [ ] **Sprachausgabe** — "Noch 3.5 Einheiten einfüllen" vorlesen (Voice)
- [ ] ** Kamera-Scan** — QR-Code auf Saatgut-Tüte scannen für auto-Ausfüllung von Körner/ha
- [ ] **Multi-User / Cloud-Sync** — Protokolle über Cloudflare KV synchronisieren
- [ ] **Bilder-Anhang** — Foto vom Schlag als Referenz pro Reiter
- [ ] **Dashboard** — Übersicht aller Reiter/Protokolle auf einen Blick

## Abgelehnt / Zurückgestellt

- [x] ~~Mehrere Reiter~~ — Implementiert (#23)
- [x] ~~Tausenderpunkte~~ — Implementiert
- [x] ~~Timestamp im Protokoll~~ — Implementiert
- [x] ~~Zusammenfassung der eingefüllten Werte~~ — Implementiert
