# Turniermanager — Einstufungsturnier im Schweizer System

**Datum:** 2026-09-11
**Anlass:** Ligaeinstufungsturnier (nach dem Summer Cup) — möglichst effiziente, kurze Turnierform ohne manuelle Auslosung/Auswertung
**Scope:** Neuer Turniermodus `"swiss"` — Paarungslogik, Tabellen-/Standings-Berechnung, rundenweiser Zeitplan-Ablauf, Ergebniserfassung, zwei neue UI-Ansichten (Erfassung + Aushang/Print)

---

## Überblick

Bisher unterstützt der Generator `"round-robin"` (Jeder-gegen-Jeden) und `"round-robin+finals"` (Vorrunde + KO-Playoff-Bracket). Beide werden **einmalig komplett generiert** — es gibt keine Ergebniserfassung und keine Tabellenberechnung im Produkt; Spielergebnisse (`periodScores`) werden nirgends eingegeben oder ausgewertet.

Das Schweizer System ist strukturell anders: die Paarungen jeder Runde ab Runde 2 hängen von den **Ergebnissen** der vorherigen Runde ab. Das erfordert:

1. Eine echte Ergebniserfassung (gab es bisher nicht)
2. Eine Tabellen-/Standings-Berechnung (gab es bisher nicht)
3. Eine Paarungslogik, die pro Runde neu rechnet, statt einmalig im Voraus
4. Einen UI-Flow, der zwischen "Turnier läuft, Ergebnisse werden erfasst" und "nächste Runde ist ausgelost" unterscheidet

Ziel: Der Turnierleiter kann ein Einstufungsturnier mit mehreren Ligateams durchführen, ohne von Hand Tabellen zu führen oder Paarungen auszulosen.

**Leitprinzip (höchste Priorität):** Das Tool darf den Turnierablauf am Turniertag nie blockieren. Jede automatische Berechnung (Paarung, Zeitplan) muss einen manuellen Reparaturweg haben, statt nur einen `Error` zu werfen, der den Organisator ohne Ausweg zurücklässt. Der Hauptzweck des Tools ist, den Organisationsaufwand am Turniertag zu minimieren und einen guten Ablauf zu ermöglichen — Automatisierung ist Mittel zum Zweck, nicht Selbstzweck. Siehe eigener Abschnitt „Betriebssicherheit & manuelle Eingriffe“ weiter unten.

---

## Datenmodell-Ergänzungen

### TournamentMode / TournamentConfig

```typescript
export type TournamentMode = 'round-robin' | 'round-robin+finals' | 'swiss'

export interface TournamentConfig {
  // ... bestehende Felder
  swissRounds?: number  // nur relevant wenn mode === 'swiss'
                         // Default beim Umschalten auf 'swiss': ceil(log2(teams.length)), min. 3
}
```

`swissRounds` ist vom Organisator überschreibbar (siehe UI-Ergänzung unten). Es gibt **keine Obergrenze** im Typsystem — die Validierung gegen die Hallenzeit erfolgt beim Generieren (siehe Fehlerfälle).

### Game

```typescript
export type GameStage = 'group' | 'semifinal' | 'final' | 'swiss'

export interface Game {
  // ... bestehende Felder
  stage: GameStage
  round: number          // Swiss-Rundennummer bei stage === 'swiss' (1-basiert)
  byeTeamId?: string      // gesetzt statt homeTeamId/awayTeamId, wenn dieses "Spiel" ein Freilos ist
  cancelledReason?: 'withdrawal'  // gesetzt, wenn das Spiel wegen Team-Ausfall storniert wurde (siehe Betriebssicherheit Punkt 2);
                                   // Spiel bleibt sichtbar, aber ohne Score, Gegner bekommt die Punkte separat über den Bye-Mechanismus gutgeschrieben
}
```

Ein Bye wird als eigener `Game`-Eintrag mit `byeTeamId` gesetzt und `homeTeamId`/`awayTeamId` = `null`, `homeLabel`/`awayLabel` = `undefined`. `field`, `scheduledStart` und `scheduledEnd` bleiben Pflichtfelder im Typ (keine Typänderung nötig) und werden bei einem Bye auf `field: 0` und `scheduledStart === scheduledEnd` (= Startzeit der jeweiligen Runde) gesetzt, als Konvention für "kein realer Slot". `ScheduleView`/`GameRow`/die neuen Swiss-Views erkennen einen Bye-Eintrag an `byeTeamId != null` und zeigen ihn als "Freilos: {Teamname}" ohne Feld-/Uhrzeit-Spalte, statt `field: 0` roh darzustellen. Ein Bye belegt keinen Zeitslot und zählt sofort als Ergebnis (siehe Standings).

Kein neues Feld für das Endergebnis — das wird aus `periodScores` abgeleitet (siehe `standings.ts`).

### Team-Ausfall (neu)

```typescript
export interface Team {
  // ... bestehende Felder
  withdrawnAfterRound?: number  // gesetzt, wenn das Team während des Turniers ausgeschieden ist (Verletzung o.ä.);
                                 // Wert = letzte Runde, die das Team noch regulär gespielt hat
}
```

Ein Team ohne `withdrawnAfterRound` gilt als aktiv. Auswirkungen sind in „Betriebssicherheit & manuelle Eingriffe“ beschrieben.

### Neues Modul: `src/lib/standings.ts`

```typescript
export interface TeamStanding {
  teamId: string
  points: number          // 2 pro Sieg, 1 pro Unentschieden, 0 pro Niederlage; Bye = 2
  wins: number
  draws: number
  losses: number
  pointsFor: number       // Summe erzielte Körbe (aus periodScores), Bye zählt nicht mit
  pointsAgainst: number
  pointsDiff: number       // pointsFor - pointsAgainst
  buchholz: number         // Summe der `points` aller bisherigen Gegner (Bye-Gegner zählt mit dessen aktuellem Punktestand)
  hadBye: boolean
  withdrawn: boolean        // true, wenn Team.withdrawnAfterRound gesetzt ist
}

/** Computes final score of a game from its periodScores. Throws if periodScores is empty (game not yet played). */
export function computeFinalScore(game: Game): { home: number; away: number }

/** Builds the standings table for all games up to and including a given round, sorted by points desc, buchholz desc, pointsDiff desc. */
export function computeStandings(teams: Team[], games: Game[], throughRound: number): TeamStanding[]
```

**Sortierreihenfolge laut Vorgabe:** `points` → `buchholz` → `pointsDiff` (kein direkter Vergleich als Kriterium).

**Buchholz-Berechnung:** Summe der aktuellen `points` aller bisherigen Gegner eines Teams (Standard-Buchholz, inkl. Bye-Runde: der "Gegner" beim Bye zählt mit dessen tatsächlichem Punktestand zum Zeitpunkt der Berechnung, wie im Schach üblich).

**Ausgeschiedene Teams** (`withdrawnAfterRound` gesetzt) bleiben mit allen bis dahin gespielten Ergebnissen unverändert in der Tabelle stehen (siehe „Betriebssicherheit“) und zählen für die Buchholz-Berechnung ihrer bisherigen Gegner normal weiter. Sie erscheinen weiterhin in `computeStandings`, aber mit einem Hinweis-Flag `withdrawn: true` im `TeamStanding`, damit die UI sie sichtbar als ausgeschieden markieren kann.

---

## Paarungslogik: `src/lib/swiss-pairing.ts`

```typescript
export interface SwissPairingInput {
  standings: TeamStanding[]     // aktuelle Tabelle vor dieser Runde, bereits sortiert
  playedPairs: Set<string>       // "teamIdA|teamIdB" (sortiert), alle bisher gespielten Paarungen
}

export interface SwissPairingResult {
  pairs: [string, string][]      // [homeTeamId, awayTeamId][]
  byeTeamId?: string              // gesetzt, wenn ungerade Teamzahl
}

export function pairNextSwissRound(input: SwissPairingInput): SwissPairingResult
```

**Algorithmus:**

1. Bei ungerader Teamzahl: Bye geht an das Team mit der **niedrigsten** aktuellen Punktzahl, das noch **kein** Bye hatte (bei Gleichstand: das zuerst in der sortierten Tabelle stehende, d.h. tabellarisch am weitesten hinten). Dieses Team wird aus dem Paarungspool entfernt.
2. Restliche Teams bleiben in Tabellenreihenfolge (punktbeste zuerst).
3. Greedy-Paarung von oben nach unten: Für das oberste noch unpaarte Team wird das nächstbeste noch unpaarte Team gesucht, gegen das es **noch nicht gespielt hat** (`playedPairs`-Check). Gefunden → Paar bilden, beide aus dem Pool entfernen, weiter mit dem nächsten obersten Team.
4. Kann für das oberste unpaarte Team unter den verbleibenden Kandidaten kein noch nicht gespielter Gegner gefunden werden, wird rekursiv zurückgegangen (Standard-Backtracking): das zuletzt gebildete Paar wird aufgelöst, und für dessen oberes Team wird der nächste noch nicht probierte Kandidat in der sortierten Restliste versucht. Das setzt sich fort, bis entweder eine vollständige gültige Paarung für alle Teams gefunden ist, oder alle Kombinationen erschöpft sind. Im letzten Fall wirft `pairNextSwissRound` einen `PairingConflictError` statt eines generischen `Error` — dieser wird vom UI **nicht** als Sackgasse behandelt, sondern löst den manuellen Reparaturweg aus (siehe „Betriebssicherheit & manuelle Eingriffe“). Das ist ein bewusst seltener Grenzfall (sehr wenige Teams, hohe Rundenzahl, z.B. 4 Teams + 5 Runden).

**Runde 1 (Sonderfall):** keine Tabelle vorhanden → zufällige Paarung aller Teams (Fisher-Yates-Shuffle der Team-IDs, dann paarweise), Bye ebenfalls zufällig bei ungerader Anzahl.

**Ausgeschiedene Teams** (`Team.withdrawnAfterRound` gesetzt) werden aus dem Paarungspool jeder noch nicht ausgelosten Runde entfernt, bevor der Algorithmus läuft — sie tauchen in `pairNextSwissRound` gar nicht erst als Kandidat auf.

---

## Betriebssicherheit & manuelle Eingriffe

Dieser Abschnitt hat Vorrang vor den übrigen Regeln, wo sie in Konflikt stehen: **kein automatischer Mechanismus darf den Turnierablauf blockieren, ohne dass der Organisator sofort selbst weitermachen kann.**

### 1. Pairing- oder Zeitplan-Sackgasse → manuelle Paarungszuweisung

Wenn `pairNextSwissRound` einen `PairingConflictError` wirft, oder `generateSwissSchedule` feststellt, dass die verbleibende Hallenzeit für die nächste Runde nicht mehr reicht, zeigt `SwissResultsPage` statt einer reinen Fehlermeldung einen **manuellen Paarungsdialog**:

- Alle noch nicht verplanten Teams der nächsten Runde werden als freie Liste angezeigt.
- Der Organisator bildet Paare selbst per Auswahl (zwei Dropdowns oder Klick-Klick-Zuweisung), das UI warnt (nicht blockiert) bei einer Wiederholung einer bereits gespielten Paarung, da das im Ausnahmefall die einzig verbleibende Lösung sein kann.
- Bei Zeitmangel (Hallenzeit-Fall) kann der Organisator hier auch direkt `gameSettings.periodDurationMin` oder `breakBetweenRoundsMin` für die verbleibenden Runden verkürzen (Link zu den Turniereinstellungen) oder die Rundenzahl (`swissRounds`) nachträglich reduzieren — beides über bereits bestehende Store-Actions.
- Ergebnis der manuellen Zuweisung wird genauso wie ein Algorithmus-Ergebnis in die bestehenden Platzhalter-Slots der nächsten Runde geschrieben (gleicher Store-Aufruf wie bei `advanceSwissRound`, nur mit manuell übergebenen Paaren statt Algorithmus-Output).

Neue Store-Action:

```typescript
advanceSwissRoundManually(pairs: [string, string][], byeTeamId?: string): void
// Wie advanceSwissRound(), aber überspringt pairNextSwissRound() und übernimmt die übergebenen Paare direkt.
// Gleiche Vorbedingung (aktuelle Runde vollständig ausgewertet).
```

### 2. Team scheidet während des Turniers aus (Verletzung o.ä.)

Neue Store-Action:

```typescript
withdrawTeam(teamId: string): void
// Setzt Team.withdrawnAfterRound = currentSwissRound (oder currentSwissRound - 1,
// falls das Team in der laufenden Runde noch gar nicht gespielt hat).
// Bereits gespielte Ergebnisse bleiben unverändert stehen (siehe Standings-Abschnitt).
// Betrifft die laufende Runde:
//   - Hat das ausscheidende Team in der aktuellen Runde noch ein offenes (nicht ausgewertetes) Spiel,
//     wird dieses Spiel storniert und der Gegner bekommt automatisch die vollen 2 Punkte gutgeschrieben
//     (technisch wie ein nachträglicher Bye-Eintrag für den Gegner, Originalspiel bleibt mit einem
//     `cancelledReason: 'withdrawal'`-Vermerk sichtbar, aber ohne Score).
// Betrifft künftige Runden:
//   - Alle noch nicht ausgelosten Runden werden ohne das ausgeschiedene Team weitergeplant
//     (siehe Pairing-Abschnitt). Die Zahl der Spiele pro künftiger Runde kann sich dadurch von
//     floor(teams.length / 2) auf floor(activeTeams.length / 2) ändern — bereits feststehende
//     Zeitslots der nächsten Runde(n), die dadurch überzählig werden, werden aus dem Zeitplan entfernt.
```

Zugänglich über einen Button "Team hat ausgeschieden" in der Team-Verwaltung (`TeamCard.tsx`) oder direkt aus `SwissResultsPage`, sobald `tournament.mode === 'swiss'` — mit Bestätigungsdialog, da es den bereits generierten Zeitplan verändert (unkritische, aber sichtbare Konsequenz, daher Bestätigung statt versehentlichem Klick).

### 3. Ergebnis-Korrektur nach Auslosung der Folgerunde

Ein bereits eingetragenes Ergebnis von Runde N darf korrigiert werden, **solange noch kein Ergebnis von Runde N+1 eingetragen wurde**. Sobald das erste Ergebnis von Runde N+1 erfasst ist, gelten alle Runde-N-Ergebnisse als eingefroren (sonst widerspräche die Tabelle der bereits gespielten Folgerunde).

Neue Store-Action:

```typescript
correctGameResult(gameId: string, periodScores: PeriodScore[]): void
// Wie submitGameResult, aber erlaubt auch für Spiele, die bereits ein Ergebnis hatten.
// Wirft einen Error, wenn game.round < currentSwissRound und bereits mindestens ein Spiel
// von round === game.round + 1 ein Ergebnis hat ("Ergebnis kann nicht mehr korrigiert werden —
// die nächste Runde wurde bereits ausgewertet").
// Nach erfolgreicher Korrektur: keine automatische Neu-Auslosung der Folgerunde (die steht ja
// noch nicht fest, wenn die Korrektur überhaupt erlaubt ist).
```

UI: In `SwissResultsPage` und `SwissOverviewPage` bekommt jedes bereits ausgewertete Spiel der zuletzt abgeschlossenen Runde (nicht älter) einen "Korrigieren"-Button, der das Score-Eingabefeld wieder editierbar macht — verschwindet automatisch, sobald die Sperrbedingung eintritt.

---

## Zeitplan-Generierung: Erweiterung `schedule-generator.ts` + neues `src/lib/swiss-schedule.ts`

### Gesamtablauf bei `mode === 'swiss'`

Beim ersten Generieren wird der **komplette Turnierablauf für alle `swissRounds` Runden auf einmal** erzeugt:

1. Runde 1: Paarungen sofort per Zufall bestimmt → echte Team-Namen in `homeTeamId`/`awayTeamId`.
2. Runde 2..N: Paarungen sind unbekannt (hängen von Ergebnissen ab) → Spiele werden mit `homeTeamId: null`, `awayTeamId: null` und Labels `"Runde {round} – Spiel {n}"` (`homeLabel`, `awayLabel` identisch, da die Zuordnung zu diesem Zeitpunkt beliebig ist) angelegt. Die **Anzahl Spiele pro Runde und Feldbelegung** steht aber fest: bei `teams.length` Teams sind das `floor(teams.length / 2)` Spiele pro Runde (+ 1 Bye-Eintrag ohne Zeitslot bei ungerader Anzahl).

### Zeitlogik pro Runde

Für jede Runde gilt (neu, abweichend vom bisherigen fortlaufenden Round-Robin-Scheduling):

- Alle Spiele einer Runde starten **gleichzeitig**, verteilt auf die verfügbaren Felder.
- Reichen die Felder nicht für alle Spiele einer Runde, werden die überzähligen Spiele **innerhalb derselben Runde** sequentiell nachgeschoben, sodass alle Felder maximal ausgelastet sind (z.B. 3 Felder, 5 Spiele einer Runde → Spiele 1–3 parallel, Spiele 4–5 direkt danach parallel auf Feld 1+2, sobald die ersten drei fertig sind).
- Nach Ende der letzten Runden-Partie: `gameSettings.bufferBetweenGamesMin` als Pause, **danach zusätzlich `gameSettings.breakBeforeFinalsMin`** als Rundenpause (Wiederverwendung des bestehenden Feldes — inhaltlich jetzt "Pause zwischen Swiss-Runden", nicht mehr nur "vor dem Finale"; siehe Umbenennung unten), bevor die nächste Runde beginnt.
- `findNextSlot` (bestehend, aus `game-duration.ts`) wird weiterhin für Blackout-/Venue-Ende-Prüfung pro Spiel verwendet.

**Feldnamens-Klarstellung:** `breakBeforeFinalsMin` wird in `breakBetweenRoundsMin` umbenannt, da es jetzt sowohl vor dem Finale (bestehender `round-robin+finals`-Modus, unverändert in der Wirkung) als auch zwischen jeder Swiss-Runde verwendet wird. Migration: bestehende gespeicherte Turniere (localStorage) lesen das alte Feld beim Laden als Fallback (`breakBetweenRoundsMin ?? breakBeforeFinalsMin ?? 0`), neue Turniere schreiben nur noch das neue Feld. `GameSettingsForm.tsx` wird entsprechend umbeschriftet ("Pause zwischen Runden").

### Validierung / Fehlerfälle

- `teams.length < 2` → bestehender Fehler wie in `round-robin` ("Mindestens 2 Teams erforderlich"). Das ist ein Konfigurationsfehler vor Turnierbeginn (kein laufendes Turnier blockiert), daher hier weiterhin ein blockierender Form-Validierungsfehler statt eines Reparaturdialogs.
- Wenn die Gesamtdauer aller `swissRounds` Runden die Venue-Verfügbarkeit **beim initialen Generieren** (vor Turnierstart) überschreitet: `generateSwissSchedule` wirft einen `Error` mit Hinweistext, der Organisator passt Rundenzahl/Felder im Formular an, bevor das Turnier beginnt — hier ist noch kein laufender Turniertag betroffen, ein Formular-Fehler ist zumutbar.
- Tritt der gleiche Engpass **während des laufenden Turniers** auf (z.B. weil eine vorherige Runde durch Blackouts länger dauerte als geplant, oder weil `withdrawTeam` die Feldauslastung verändert hat), greift **nicht** dieser Fehlerpfad, sondern der manuelle Reparaturdialog aus „Betriebssicherheit & manuelle Eingriffe“ (Punkt 1) — der laufende Turniertag darf nie an einer Zeitrechnung scheitern.
- Rundenzahl-Vorschlag `ceil(log2(teams.length))` wird im UI direkt neben dem Eingabefeld mit der **berechneten Gesamtdauer** angezeigt (nicht nur als reiner Zahlenvorschlag), sodass der Organisator vor dem Generieren sieht, ob die Rundenzahl zur Hallenzeit passt — als Warnhinweis (Alert-Komponente, bestehendes Muster aus `ScheduleView.tsx`), nicht als blockierende Validierung im Formular selbst (blockiert wird erst beim tatsächlichen Generieren, s.o.).

---

## Rundenweiser Ablauf nach dem ersten Generieren

Neue Store-Actions in `tournament-store.ts`:

```typescript
submitGameResult(gameId: string, periodScores: PeriodScore[]): void
// Schreibt periodScores ins Game. Wirft, wenn das Spiel ein Playoff-/Swiss-Platzhalter ohne echte Team-IDs ist.

advanceSwissRound(): void
// Voraussetzung: alle Spiele der aktuellen Runde (stage === 'swiss', round === currentRound) haben periodScores (oder sind Bye).
// 1. computeStandings() bis zur aktuellen Runde
// 2. pairNextSwissRound() für die nächste Runde
// 3. Findet die bereits als Platzhalter angelegten Game-Einträge der nächsten Runde (Zeitslots stehen schon fest)
//    und befüllt homeTeamId/awayTeamId (bzw. byeTeamId), löscht die Platzhalter-Labels.
// Wirft Error, wenn Voraussetzung nicht erfüllt (sollte durch disabled-Button im UI ohnehin nicht erreichbar sein).
// Wirft pairNextSwissRound() einen PairingConflictError, fängt der Aufrufer (SwissResultsPage) diesen
// gezielt ab und öffnet den manuellen Paarungsdialog statt die Exception weiterzureichen.
```

Weitere Store-Actions für den manuellen Eingriff (`advanceSwissRoundManually`, `withdrawTeam`, `correctGameResult`) sind in „Betriebssicherheit & manuelle Eingriffe“ spezifiziert.

`currentSwissRound` wird als abgeleiteter Wert berechnet (nicht separat gespeichert): höchste `round`-Zahl unter den Spielen mit `stage === 'swiss'`, die bereits reale Team-IDs (oder Bye) haben.

**Warum `submitGameResult` als eigene Store-Action (statt direkt in der Komponente):** kapselt die Schreiblogik, damit ein späteres Sync-Feature (Ergebnis-Eingabe per Smartphone) an dieser einen Stelle andocken kann, ohne die UI-Komponenten anzufassen. Kein Sync wird in diesem Scope gebaut — nur die Trennung wird jetzt schon vorgenommen.

---

## UI-Ergänzungen

### TournamentForm.tsx

Neue Option `"swiss"` im Modus-Select ("Einstufungsturnier (Schweizer System)"). Bei Auswahl erscheint zusätzlich:
- Eingabefeld "Anzahl Runden" (number input), vorbefüllt mit `ceil(log2(teams.length))`, min. 1
- Danebenstehender Hinweistext mit berechneter Gesamtdauer (reaktiv auf Feldanzahl/Rundenzahl-Änderung), als `Alert`, wenn die Dauer die Hallenzeit übersteigt

### Neue Seite: `src/pages/SwissResultsPage.tsx` ("Ergebnisse erfassen")

Nur sichtbar/relevant wenn `tournament.mode === 'swiss'`. Zeigt **ausschließlich**:
- Kopfzeile: "Runde {currentSwissRound} von {swissRounds}"
- Liste der Spiele der aktuellen Runde (Feld, Team-Namen, Score-Eingabe pro Team — einfaches Zahlenfeld für Endergebnis, keine Perioden-Einzeleingabe im UI; intern als ein `PeriodScore`-Eintrag mit `period: 1` gespeichert, um das bestehende Datenmodell ohne Änderung wiederzuverwenden)
- Freilos-Eintrag der Runde wird informativ angezeigt (kein Eingabefeld, da Ergebnis feststeht)
- Button "Nächste Runde auslosen" — `disabled`, bis alle Spiele der Runde ein Ergebnis haben; bei Klick `advanceSwissRound()`
- Nach der letzten Runde: statt des Buttons ein Hinweis "Turnier abgeschlossen" + Link zur Turnierübersicht
- Bereits ausgewertete Spiele der aktuellen bzw. zuletzt abgeschlossenen Runde zeigen einen "Korrigieren"-Button (siehe Betriebssicherheit Punkt 3)
- Button "Team ist ausgeschieden" pro sichtbarem Team der aktuellen Runde (siehe Betriebssicherheit Punkt 2)
- Bei `PairingConflictError` oder Zeit-Engpass beim Klick auf "Nächste Runde auslosen": statt Fehlermeldung öffnet sich der manuelle Paarungsdialog (siehe Betriebssicherheit Punkt 1) direkt auf dieser Seite

Bewusst **keine** volle Tabelle, kein voller Zeitplan hier — reiner Eingabe-Fokus laut Vorgabe. Die genannten Eingriffsmöglichkeiten sind Ausnahmefälle, keine Standard-Bedienelemente, und werden entsprechend zurückhaltend platziert (z.B. sekundäre Buttons, kein prominenter Bereich).

### Neue Seite: `src/pages/SwissOverviewPage.tsx` ("Turnierübersicht")

Nur sichtbar/relevant wenn `tournament.mode === 'swiss'`. Rein lesend, zeigt:
- Aktuelle Tabelle (`computeStandings`) mit Rang, Team, Punkte, Buchholz, Korbdifferenz, Bilanz (S-U-N)
- Kompletter Zeitplan aller Runden, gruppiert nach Runde (Wiederverwendung von `GameRow.tsx` mit dessen bestehendem Platzhalter-Fallback-Muster, das bereits `homeLabel`/`awayLabel` unterstützt — keine Änderung an `GameRow.tsx` nötig)
- Button "Drucken" oben rechts, öffnet eine Print-Ansicht

**Print-Ansicht:** Wiederverwendung des bestehenden Export-Musters (`src/lib/export/html-export.ts` als Vorlage) — neue Funktion `renderSwissOverviewHtml(tournament, schedule, standings)`, die eine eigenständige, druckoptimierte HTML-Seite (Tabelle + Zeitplan, ohne Eingabeelemente, `@media print`-taugliches CSS) erzeugt und wie der bestehende Export in einem neuen Tab/Fenster geöffnet bzw. als HTML-Datei angeboten wird (gleicher Mechanismus wie `ExportPanel.tsx`, kein neuer Download-Weg).

### Navigation (`AppShell.tsx`)

Zwei neue Menüpunkte, nur sichtbar wenn `tournament.mode === 'swiss'`: "Ergebnisse erfassen" und "Turnierübersicht" — anstelle des bisherigen "Zeitplan"-Menüpunkts (der bleibt für `round-robin`/`round-robin+finals` wie gehabt bestehen).

---

## Fixes an bestehenden, betroffenen Stellen

- **`GameRow.tsx`:** keine Änderung nötig (Platzhalter-Fallback existiert bereits für `homeLabel`/`awayLabel`).
- **`GameSettingsForm.tsx`:** Label-Text von `breakBeforeFinalsMin` zu "Pause zwischen Runden" ändern (Feld selbst wird zu `breakBetweenRoundsMin` umbenannt, s.o.).
- **`storage.ts`:** Migrationslogik beim Laden für `breakBeforeFinalsMin` → `breakBetweenRoundsMin` (Fallback-Read, s.o.).
- **Bestehende Tests** (`schedule-generator.test.ts`, `playoff-generator.test.ts`, `game-duration.test.ts`, `storage.test.ts`, `types/index.test.ts`): Fixtures von `breakBeforeFinalsMin` auf `breakBetweenRoundsMin` umstellen.

---

## Testplan

**`standings.test.ts`** (neu):
- Punkteberechnung 2/1/0 für Sieg/Unentschieden/Niederlage
- Korbdifferenz-Berechnung
- Buchholz-Berechnung über mehrere Runden inkl. Bye-Gegner
- Sortierreihenfolge: Punkte → Buchholz → Korbdifferenz
- `computeFinalScore` wirft bei leerem `periodScores`

**`swiss-pairing.test.ts`** (neu):
- Runde 1: zufällige Paarung, alle Teams genau einmal verplant
- Folgerunden: keine Wiederholung bereits gespielter Paarungen
- Bye geht an niedrigste Punktzahl, kein Team zweimal Bye
- Backtracking-Fall: Paarung trotz naheliegendem Konflikt lösbar
- Sackgassen-Fall wirft verständlichen `Error`

**`swiss-schedule.test.ts`** (neu):
- Runde-1-Spiele mit echten Team-IDs, Runde-2+-Spiele mit Platzhalter-Labels
- Alle Felder in einer Runde parallel ausgelastet, Restspiele sequentiell nachgeschoben
- Rundenpause (`breakBetweenRoundsMin`) korrekt zwischen Runden eingehalten
- Zu viele Runden für Hallenzeit beim initialen Generieren (vor Turnierstart) → wirft `Error` (kein stiller Abbruch)
- Ungerade Teamzahl: Bye-Eintrag ohne Zeitslot/Feld

**Erweiterung `tournament-store.test.ts`** (ggf. neu anzulegen, falls noch nicht vorhanden):
- `submitGameResult` schreibt Score, wirft bei Platzhalter-Spiel ohne Team-IDs
- `advanceSwissRound` befüllt nächste Runde korrekt, wirft wenn Runde unvollständig
- `advanceSwissRound` fängt `PairingConflictError` intern ab und markiert den Store-Zustand als "wartet auf manuelle Paarung" (Grundlage für den UI-Dialog)
- `advanceSwissRoundManually` übernimmt übergebene Paare unabhängig vom Algorithmus, respektiert aber weiterhin die Vorbedingung (aktuelle Runde vollständig ausgewertet)
- `withdrawTeam`: bereits gespielte Ergebnisse bleiben erhalten; offenes Spiel der laufenden Runde wird storniert und dem Gegner gutgeschrieben; künftige Runden werden ohne das Team neu geplant
- `correctGameResult`: erlaubt vor erster Auswertung der Folgerunde, wirft danach mit verständlicher Fehlermeldung

**`standings.test.ts`** zusätzlich:
- Ausgeschiedenes Team bleibt mit `withdrawn: true` und seinen bisherigen Ergebnissen in der Tabelle

---

## Out of Scope

- Ergebniserfassung per Smartphone / Mehrgerät-Sync (nur architektonisch vorbereitet über `submitGameResult` als eigene Store-Action, kein Sync-Layer wird gebaut).
- Direkter Vergleich als Tie-Break-Kriterium (laut Vorgabe nicht gewünscht).
- Doppelrunden / Rückrunden im Schweizer System.
- Freies, jederzeitiges Überschreiben einer bereits ausgelosten Paarung **ohne** Fehler-/Ausfall-Anlass (z.B. reines "der Organisator möchte einfach umsortieren") — der manuelle Paarungsdialog ist bewusst nur für die drei in „Betriebssicherheit & manuelle Eingriffe“ genannten Fälle vorgesehen (Pairing-/Zeit-Sackgasse, Team-Ausfall, Ergebnis-Korrektur vor Folgerunde), kein allgemeines Drag&Drop-Umsortieren.
- Wiederaufnahme eines bereits als ausgeschieden markierten Teams (`withdrawTeam` ist nicht umkehrbar in diesem Scope).
- Korrektur eines Ergebnisses, nachdem die Folgerunde bereits ein Ergebnis hat — bewusst weiterhin gesperrt (siehe Betriebssicherheit Punkt 3), da sonst die Tabelle rückwirkend inkonsistent zur bereits gespielten Folgerunde würde.
