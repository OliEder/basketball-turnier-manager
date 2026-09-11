# Design: Inhaltsverzeichnis + Druck-Seitenumbruch-Logik auf der Turnierübersicht

## Teil 1: Inhaltsverzeichnis mit Kapitelnavigation

Analog zur bereits umgesetzten Anleitungs-Seite (`ManualPage.tsx`, Commit `aa8b96e`) bekommt `SwissOverviewPage.tsx` eine Sprungmarken-Box direkt unter dem "Drucken"-Button, mit Links zu:
- "Tabelle" (Anker auf die Tabellen-Überschrift)
- Jeder einzelnen Runde ("Runde 1", "Runde 2", ...) als eigener Link auf die jeweilige Rundenüberschrift

Gleiche Optik/Technik wie bei der Anleitung: `<nav aria-label="Inhalt">`, gleiche Tailwind-Klassen (bordered/tinted Box, siehe `Callout`/TOC-Komponente in `ManualPage.tsx` als Vorlage). Anker-`id`s auf die Tabellen-`<h2>` (z. B. `id="tabelle"`) und jede Runden-`<h3>` (z. B. `id="runde-1"`, `id="runde-2"`, ...).

Im Print-Export (`swiss-overview-export.ts`) erscheint dieselbe TOC-Box ebenfalls (statisches HTML mit Anchor-Links funktioniert auch gedruckt/als PDF technisch einwandfrei, im Gegensatz zur Anleitungs-Seite gibt es hier keinen Grund, sie herauszufiltern — sie hilft beim Blättern in einem mehrseitigen Ausdruck). Anchor-Links im PDF sind bei modernen Browsern (Chrome-Druckfunktion) klickbar/funktional erhalten, daher hier explizit **behalten**, nicht wie bei der Anleitung entfernen.

## Teil 2: Seitenumbruch-Logik im Druck

**Regel** (vom Nutzer explizit vorgegeben): Nach der Tabelle erfolgt im Druck immer ein Seitenumbruch, bevor der Zeitplan-Abschnitt beginnt. Innerhalb des Zeitplans erfolgt ein weiterer Seitenumbruch, sobald die aktuelle Seite mindestens 15 Spiele enthält — aber **immer erst direkt vor der nächsten Rundenüberschrift**, nie mitten in einer Runde. Das heißt: der 15-Spiele-Schwellenwert wird laufend mitgezählt; sobald er erreicht/überschritten ist, bekommt die NÄCHSTE Rundenüberschrift (nicht die aktuelle) einen Seitenumbruch davor, und der Zähler wird danach zurückgesetzt.

**Implementierung** (reine Berechnung, kein Layout-Trial-and-Error nötig): eine Hilfsfunktion `computeRoundPageBreaks(rounds: number[], gamesPerRound: Map<number, number>, threshold = 15): Set<number>` (oder inline berechnet), die für jede Runde entscheidet, ob VOR ihrer Überschrift ein Seitenumbruch gesetzt wird. Algorithmus:

```
laufendeSumme = 0
umbruchVor = neues Set
für jede Runde in Reihenfolge (ab der zweiten Runde, vor der ersten nie umbrechen):
  falls laufendeSumme >= 15:
    umbruchVor.add(aktuelleRunde)
    laufendeSumme = 0
  laufendeSumme += spieleInDieserRunde
```

Auf der `<h3>Runde N</h3>` (interaktive Seite: CSS `break-before: page` nur im `@media print`-Kontext via Tailwind `print:break-before-page`-Klasse, bedingt gesetzt; Print-Export: inline `style="page-break-before: always"` oder eine CSS-Klasse im `<style>`-Block, bedingt pro Runde gesetzt) wird dieser Umbruch angewendet, wenn die Runde im berechneten Set enthalten ist.

Nach der Tabelle (vor der "Zeitplan"-Überschrift) IMMER ein Seitenumbruch, unabhängig vom 15er-Zähler — das ist eine fixe Regel, kein berechneter Fall.

**Wichtig**: "Spiele pro Runde" zählt nur echte Spiel-Slots (`g.field > 0`), keine Freilos-Zeilen (`g.field === 0` bzw. `byeTeamId` gesetzt) — konsistent mit der bestehenden Filterung `schedule.games.filter(g => g.round === round && g.field > 0)`, die bereits an beiden Stellen (interaktive Seite, Print-Export) verwendet wird.

## Testbarkeit

Die Seitenumbruch-Berechnung (`computeRoundPageBreaks` o. ä.) sollte als reine, exportierte Funktion in einer eigenen Datei (z. B. `src/lib/print-pagination.ts`) oder direkt in `standings.ts`/einem neuen kleinen Modul liegen, damit sie isoliert mit einfachen Zahlen-Arrays getestet werden kann, ohne echte Turnierdaten aufbauen zu müssen. `@media print`/CSS-Effekte selbst sind in jsdom nicht sinnvoll testbar — hier reicht ein Test, der bestätigt, dass die richtige CSS-Klasse/das richtige Style-Attribut auf der jeweils erwarteten Runden-Überschrift landet (Marker-Attribut prüfen, nicht das tatsächliche Rendering-Verhalten im Druck).
