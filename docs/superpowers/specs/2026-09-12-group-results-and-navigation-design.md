# Design: Ergebniserfassung + Gruppen-Navigation für Round-Robin/Gruppenphase

## Use-Cases (Ausgangspunkt)

**Teilnehmer/Zuschauer** möchte wissen: wo/wann spielt mein Team, wie steht es aktuell in der Tabelle, wie hat mein nächster Gegner bisher gespielt (Einzelergebnisse UND Tabellenposition).

**Turnierleiter** möchte möglichst effizient Ergebnisse eintragen, ohne lange nach dem passenden Spiel suchen zu müssen.

**Wichtige Rahmenbedingung:** Die App läuft rein lokal (kein Server, kein Login, Zustand nur in `localStorage` des jeweiligen Geräts). Eine individuelle "Mein Team"-Ansicht würde nur dem Gerät nützen, auf dem der Turnierleiter gerade arbeitet — für Teilnehmer/Zuschauer ist die (ggf. ausgedruckte/ausgehängte) Gruppenübersicht der einzige praktikable Informationskanal. Diese muss deshalb allein durch Tabelle + Zeitplan mit Ergebnissen beide Informationsbedürfnisse abdecken: der nächste Gegner ist über den Zeitplan erkennbar, seine bisherigen Ergebnisse und seine Tabellenposition über die Tabelle bzw. den bereits gespielten Teil des Zeitplans.

## Problem (bestätigt)

1. **Keine Ergebniserfassung für Round-Robin/Gruppenphase.** `GameRow` (verwendet von `ScheduleView` und `GroupOverviewPage`) bietet nur ein Startzeit-Feld oder (mit `showResult`) eine reine Ergebnis-Anzeige — kein Eingabeformular, kein Speichern-Button. `submitGameResult`/`correctGameResult` im Store sind bereits stage-unabhängig nutzbar, werden aber für `stage === 'group'` von keiner UI aufgerufen.
2. **`GroupOverviewPage` wird bei vielen Gruppen unübersichtlich.** Alle Gruppentabellen und der komplette (gruppenübergreifend vermischte) Zeitplan stehen lang untereinander — bei z. B. 16 Gruppen ist das kaum noch nutzbar (verifiziert mit dem 64-Teams/16-Gruppen-Stresstest aus einer vorherigen Iteration dieses Features).

## Umfang dieses Designs

1. `GroupOverviewPage`: Tabs statt Untereinander-Liste.
2. Druckfunktion für die Gruppenübersicht (aktuelle Gruppe oder alle Gruppen, mit Seitenumbruch pro Gruppe).
3. Neue Seite „Ergebnisse erfassen" für Gruppenphase-Spiele.

## Explizit NICHT Teil dieses Designs

- **Mehrtägigkeit** (Datum je Spiel/Turnier, mehrere Hallentage mit ggf. unterschiedlicher Feldanzahl) — eigenständiges, späteres Feature. Das aktuelle Datenmodell (`Game.scheduledStart`/`scheduledEnd` als reine `HH:MM`-Strings ohne Datum) bleibt unverändert.
- **Endrunden-Ergebniserfassung** (Halbfinale/Finale, `stage !== 'group'`) — bleibt weiterhin ohne dediziertes Eingabe-UI, wie bisher.
- Eine individuelle "Mein Team"-Ansicht (siehe Rahmenbedingung oben) — nicht sinnvoll ohne Server-Hosting.
- Änderungen am Swiss-System — komplett unberührt.

## Baustein 1: `GroupOverviewPage` — Tabs statt Liste

**Aktuell:** alle Gruppen (Tabelle je Gruppe) und der komplette gruppenübergreifende Zeitplan (nach Runde sortiert) stehen untereinander auf einer Seite.

**Neu:** Tab-Leiste oben mit einem Button je Gruppe (`Gruppe A`, `Gruppe B`, …). Es ist immer nur eine Gruppe aktiv sichtbar — sowohl deren Tabelle als auch deren gefilterter Zeitplan (nur Spiele mit `groupId === aktive Gruppe`, weiterhin nach Runde gruppiert innerhalb der Gruppe). Standardauswahl beim ersten Aufruf: immer Gruppe A (erste Gruppe alphabetisch).

Lokaler Komponenten-State (`useState<string>`) für die aktive Gruppe, kein Routing-/URL-Zustand nötig (analog zu `SwissResultsPage`s `viewedRound`-State-Pattern).

## Baustein 2: Druckfunktion

Neuer `renderGroupOverviewHtml`-Export (`src/lib/export/group-overview-export.ts`), strukturell analog zu `renderSwissOverviewHtml` (statisches HTML, Blob-URL, neuer Tab, Browser-Druckdialog — exakt dasselbe Muster wie bei der Swiss-Übersicht, kein neuer Mechanismus).

Auf der `GroupOverviewPage` ein Drucken-Button mit zwei Optionen:
- **„Diese Gruppe drucken"** — rendert nur die aktuell aktive Gruppe (Tabelle + ihr Zeitplan).
- **„Alle Gruppen drucken"** — rendert alle Gruppen nacheinander; jede Gruppe beginnt auf einer neuen Druckseite (`page-break-before: always` auf der ersten Überschrift jeder Gruppe außer der allerersten — exakt das bereits etablierte Muster aus `renderSwissOverviewHtml`, das `computeRoundPageBreaks` für Rundenumbrüche nutzt; hier wird stattdessen ein Umbruch VOR JEDER Gruppe erzwungen, da eine Gruppe geschlossen auf eine Seite soll, nicht nach einem Zeilen-Schwellenwert).

Zwei Buttons statt eines Dropdowns, da nur zwei Optionen existieren (kein zusätzlicher Interaktionsschritt nötig).

## Baustein 3: Neue Seite „Ergebnisse erfassen" (Gruppenphase)

**Neue Route:** `/group-results`, neue Datei `src/pages/GroupResultsPage.tsx`.

**Navigation:** In `AppShell.tsx` erscheint der Link „Ergebnisse erfassen" anstelle von (oder zusätzlich zu) „Zeitplan", sobald der Turniermodus `round-robin` oder `round-robin+finals` ist UND ein Zeitplan existiert — analog zum bestehenden `gated`-Muster. Exakte Positionierung/Benennung im Vergleich zum bestehenden „Zeitplan"-Link: „Zeitplan" bleibt als reine Lesesicht bestehen (unverändert), „Ergebnisse erfassen" ist ein NEUER, zusätzlicher Link (gleiches Verhältnis wie bei Swiss, wo „Ergebnisse erfassen" und „Turnierübersicht" beide nebeneinander existieren — hier folgt „Zeitplan" der Rolle von „Turnierübersicht" als Lesesicht, „Ergebnisse erfassen" ist neu).

**Datenbasis:** alle Spiele mit `stage === 'group'` aus `schedule.games` (Endrunden-Spiele werden nicht einbezogen, siehe Scope-Abgrenzung oben).

**Sortierung:** chronologisch nach `scheduledStart` (nicht nach Runde/Gruppe — der Turnierleiter arbeitet zeitbasiert, wie er es vor Ort erlebt).

**Filter** (drei Stück, UND-verknüpft, alle über einfache `<select>`-Elemente analog zum bestehenden `GroupAssignmentForm`-Stil):
- **Status**: „Offen" (Standard) / „Erfasst" / „Alle" — „Offen" = `periodScores.length === 0`, „Erfasst" = `periodScores.length > 0`.
- **Gruppe**: „Alle Gruppen" (Standard) / einzelne Gruppen-Buchstaben.
- **Feld**: „Alle Felder" (Standard) / einzelne Feldnummern (aus `tournament.fields` abgeleitet).

**Pro Zeile** (ein Spiel):
- Feldnummer, Uhrzeit, Gruppen-Tag (z. B. „Gruppe A" — kleines Tag ähnlich dem bestehenden `F{field}`-Tag in `GameRow`), Teamnamen (via `TeamNameDisplay`, damit Logos erscheinen).
- **Bei offenem Spiel** (`periodScores.length === 0`): zwei Zahlenfelder (Heim/Auswärts, analog zu `SwissResultsPage`s `Input type="number"`-Feldern) + ein „Speichern"-Button, der `submitGameResult(gameId, [{ period: 1, homeScore, awayScore }])` aufruft. Kein Zwischenzustand mit grünem Häkchen wie bei Swiss (dort existiert das, weil das Speichern erst gesammelt beim Rundenabschluss passiert — hier speichert jede Zeile sofort für sich, also ist der Haken redundant: das Ergebnis erscheint direkt als bereits gespeichert).
- **Bei bereits erfasstem Spiel** (`periodScores.length > 0`): Anzeige des Endstands (analog zu `GameRow`s `showResult`-Darstellung) + ein „Korrigieren"-Button, der (nach Klick) dieselben zwei Zahlenfelder mit den aktuellen Werten vorausfüllt (`defaultValue`) und beim erneuten „Speichern" `correctGameResult(gameId, [...])` aufruft — exakt das bestehende Korrektur-Muster aus `SwissResultsPage` (`correctingGameId`-State), nur ohne die dortige Einschränkung „nur solange die nächste Runde noch kein Ergebnis hat" (die gibt es hier nicht, da es kein Rundenkonzept in diesem Sinne gibt — jedes Gruppenphase-Spiel ist unabhängig korrigierbar).

**Nach dem Speichern/Korrigieren:** kein eigener Tabellen-Block auf dieser Seite. Stattdessen ein `Alert`-Hinweis mit einem Link zur (nun tab-basierten) `GroupOverviewPage`, direkt zur betroffenen Gruppe (z. B. „Ergebnis gespeichert. Aktualisierte Tabelle für Gruppe A ansehen →"). Das hält die Erfassungsseite auf ihren Kernzweck fokussiert (schnelles Eintragen), die Tabelle (inkl. S-U-N-Spalte, die die Spielanzahl je Team bereits zeigt) bleibt zentral an einer Stelle (`GroupOverviewPage`), keine Duplikation der Tabellen-Logik.

## Datenfluss-Zusammenfassung

- Keine neuen Store-Actions nötig — `submitGameResult`/`correctGameResult` existieren bereits und sind stage-agnostisch.
- Keine Datenmodell-Änderungen nötig (kein neues Feld an `Game`/`TournamentConfig`).
- Neue reine Funktion `renderGroupOverviewHtml` (Druck-Export), analog zu `renderSwissOverviewHtml`.
- Neue Seite `GroupResultsPage` (Ergebniserfassung), neue Route `/group-results`.
- `GroupOverviewPage` wird umgebaut (Tab-State statt Untereinander-Rendering), Druck-Button ergänzt.
- `AppShell.tsx`: neuer „Ergebnisse erfassen"-Link für Round-Robin-Modi mit vorhandenem Zeitplan.

## Akzeptanzkriterien

- Ein Turnierleiter kann für ein Gruppenphase-Spiel ein Ergebnis eintragen, ohne die Swiss-Ergebnisseite zu benutzen.
- Bei 16 Gruppen zeigt die Gruppenübersicht immer nur eine Gruppe gleichzeitig (Tabelle + Zeitplan dieser Gruppe), navigierbar per Tab.
- Der Druck einer einzelnen Gruppe und aller Gruppen (mit Seitenumbruch je Gruppe) funktioniert über den bestehenden Blob-URL-Mechanismus.
- Die Ergebniserfassungsseite lässt sich nach Status, Gruppe und Feld filtern (UND-verknüpft), Standardfilter zeigt offene Spiele aller Gruppen/Felder.
- Ein bereits erfasstes Ergebnis lässt sich jederzeit korrigieren (kein Rundenabschluss-Zwang wie bei Swiss).
- Bestehendes Swiss-Verhalten, `ScheduleView`, Datenmodell bleiben unverändert.
