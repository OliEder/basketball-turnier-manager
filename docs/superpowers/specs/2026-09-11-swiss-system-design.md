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
}
```

Ein Bye wird als eigener `Game`-Eintrag mit `byeTeamId` gesetzt und `homeTeamId`/`awayTeamId` = `null`, `homeLabel`/`awayLabel` = `undefined`. `field`, `scheduledStart` und `scheduledEnd` bleiben Pflichtfelder im Typ (keine Typänderung nötig) und werden bei einem Bye auf `field: 0` und `scheduledStart === scheduledEnd` (= Startzeit der jeweiligen Runde) gesetzt, als Konvention für "kein realer Slot". `ScheduleView`/`GameRow`/die neuen Swiss-Views erkennen einen Bye-Eintrag an `byeTeamId != null` und zeigen ihn als "Freilos: {Teamname}" ohne Feld-/Uhrzeit-Spalte, statt `field: 0` roh darzustellen. Ein Bye belegt keinen Zeitslot und zählt sofort als Ergebnis (siehe Standings).

Kein neues Feld für das Endergebnis — das wird aus `periodScores` abgeleitet (siehe `standings.ts`).

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
}

/** Computes final score of a game from its periodScores. Throws if periodScores is empty (game not yet played). */
export function computeFinalScore(game: Game): { home: number; away: number }

/** Builds the standings table for all games up to and including a given round, sorted by points desc, buchholz desc, pointsDiff desc. */
export function computeStandings(teams: Team[], games: Game[], throughRound: number): TeamStanding[]
```

**Sortierreihenfolge laut Vorgabe:** `points` → `buchholz` → `pointsDiff` (kein direkter Vergleich als Kriterium).

**Buchholz-Berechnung:** Summe der aktuellen `points` aller bisherigen Gegner eines Teams (Standard-Buchholz, inkl. Bye-Runde: der "Gegner" beim Bye zählt mit dessen tatsächlichem Punktestand zum Zeitpunkt der Berechnung, wie im Schach üblich).

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
4. Kann für das oberste unpaarte Team unter den verbleibenden Kandidaten kein noch nicht gespielter Gegner gefunden werden, wird rekursiv zurückgegangen (Standard-Backtracking): das zuletzt gebildete Paar wird aufgelöst, und für dessen oberes Team wird der nächste noch nicht probierte Kandidat in der sortierten Restliste versucht. Das setzt sich fort, bis entweder eine vollständige gültige Paarung für alle Teams gefunden ist, oder alle Kombinationen erschöpft sind. Im letzten Fall wird ein `Error` geworfen: `"Keine gültige Paarung mehr möglich — zu viele Runden für die Teamanzahl"` (Grenzfall bei sehr wenigen Teams und hoher Rundenzahl, z.B. 4 Teams + 5 Runden).

**Runde 1 (Sonderfall):** keine Tabelle vorhanden → zufällige Paarung aller Teams (Fisher-Yates-Shuffle der Team-IDs, dann paarweise), Bye ebenfalls zufällig bei ungerader Anzahl.

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

- `teams.length < 2` → bestehender Fehler wie in `round-robin` ("Mindestens 2 Teams erforderlich").
- Wenn die Gesamtdauer aller `swissRounds` Runden die Venue-Verfügbarkeit überschreitet: kein stiller Abbruch einzelner Spiele (anders als der bestehende `console.warn`-Fallback in `round-robin`!) — stattdessen wirft `generateSwissSchedule` einen `Error`: `"Zeitplan passt nicht in die verfügbare Hallenzeit — Rundenzahl reduzieren oder mehr Felder einplanen"`. Begründung: bei Swiss ist ein abgeschnittener Zeitplan (fehlende letzte Runde) inhaltlich unbrauchbar, da die Tabelle sonst nicht vollständig ausgespielt werden kann.
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
```

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

Bewusst **keine** Tabelle, kein voller Zeitplan hier — reiner Eingabe-Fokus laut Vorgabe.

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
- Zu viele Runden für Hallenzeit → wirft `Error` (kein stiller Abbruch)
- Ungerade Teamzahl: Bye-Eintrag ohne Zeitslot/Feld

**Erweiterung `tournament-store.test.ts`** (ggf. neu anzulegen, falls noch nicht vorhanden):
- `submitGameResult` schreibt Score, wirft bei Platzhalter-Spiel ohne Team-IDs
- `advanceSwissRound` befüllt nächste Runde korrekt, wirft wenn Runde unvollständig

---

## Out of Scope

- Ergebniserfassung per Smartphone / Mehrgerät-Sync (nur architektonisch vorbereitet über `submitGameResult` als eigene Store-Action, kein Sync-Layer wird gebaut).
- Direkter Vergleich als Tie-Break-Kriterium (laut Vorgabe nicht gewünscht).
- Doppelrunden / Rückrunden im Schweizer System.
- Manuelle Korrektur einer bereits generierten Paarung durch den Organisator (z.B. Drag&Drop-Umsortierung) — Paarung ist deterministisch aus dem Algorithmus.
- Nachträgliche Korrektur eines bereits eingetragenen Ergebnisses, nachdem `advanceSwissRound()` für die Folgerunde schon ausgeführt wurde (würde die bereits ausgeloste Folgerunde inkonsistent machen) — wird nicht verhindert, aber auch nicht unterstützt; Organisator muss das aktuell selbst vermeiden.
