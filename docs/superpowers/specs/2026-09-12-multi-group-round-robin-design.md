# Design: Mehrgruppen-Vorrunde (+ Round-Robin-Feldverteilungs-Fix)

## Kontext und Root-Cause (bereits verifiziert)

`generateRoundRobinPairs` (`src/lib/schedule-generator.ts`) erzeugt Paarungen in fester Reihenfolge `(1,2), (1,3), ..., (1,N), (2,3), ...` ohne Rundenstruktur. Die anschließende Slot-Zuweisung plant diese Liste streng sequenziell — dadurch bleiben Felder leer, solange die nächsten Paarungen in der Liste zufällig bereits verplante Teams enthalten (reproduziert: 8 Teams/3 Felder, die ersten beiden Zeitfenster nutzen nur 1 von 3 Feldern). Dieser Fix ist Teil dieses Designs (Schritt 1 unten) und gilt für ALLE Round-Robin-Fälle (auch 1-Gruppen-Fälle), nicht nur für Mehrgruppen-Turniere.

Der Nutzer möchte zusätzlich eine Mehrgruppen-Vorrunde ermöglichen (mehrere parallele Round-Robin-Gruppen, deren Sieger später — in einem SPÄTEREN, separaten Feature — in eine Endrunde einziehen). Dieses Design deckt NUR die Mehrgruppen-Vorrunde ab; Endrunden-Varianten (basierend auf "1. der Gruppe A", "2. der Gruppe B" usw.) sind explizit ein zweites, späteres Teilprojekt.

## Modus-Modell

- **"Jeder gegen Jeden"** (`mode: 'round-robin'`): unverändert im Verhalten — exakt eine Gruppe, kein Endrunden-Anschluss. Nutzt intern denselben (jetzt korrigierten) Circle-Method-Generator.
- **"Gruppenphase + Endrunde"** (`mode: 'round-robin+finals'`, NEUES sichtbares Label statt bisher "Jeder gegen Jeden + Finale", interner Modus-Wert unverändert): Gruppenanzahl frei wählbar (Standard-Vorschlag siehe unten, auch 1 möglich — entspricht dann exakt dem heutigen Halbfinale/Finale-Verhalten). Die Endrunden-Generierung selbst bleibt für dieses Design unverändert (nimmt weiterhin unspezifisch "1./2./3./4. der Vorrunde", ohne Kenntnis von Gruppen — das wird erst im zweiten Teilprojekt aufgelöst).

## Datenmodell-Erweiterungen

```typescript
// Team (src/types/index.ts)
groupId?: string  // Gruppenzuordnung; fehlt = Standardgruppe "A" (Rückwärtskompatibilität)

// TournamentConfig
groupCount?: number       // Anzahl Gruppen, nur bei mode === 'round-robin+finals' relevant; Standard 1
doubleRoundRobin?: boolean // Hin- UND Rückrunde (jedes Team spielt jedes andere zweimal); Standard false

// Game
groupId?: string  // welcher Gruppe dieses Spiel angehört (nur stage === 'group')
```

Ein neuer, einfacher Typ wird NICHT eingeführt — Gruppen werden nicht als eigenständige Entität mit Namen/Metadaten verwaltet, sondern rein über die `groupId`-Zeichenkette referenziert (`"A"`, `"B"`, `"C"`, ...), generiert aus `groupCount` (`String.fromCharCode(65 + i)`). Das hält das Datenmodell minimal — YAGNI, es gibt aktuell keinen Bedarf für gruppenspezifische Zusatzdaten über die ID hinaus.

## Circle-Method-Generator (Fix + Grundlage für Mehrgruppen)

Neue Funktion `generateRoundRobinRounds(teamIds: string[]): string[][][]` in `schedule-generator.ts` (ersetzt `generateRoundRobinPairs` als primäre Erzeugungsfunktion; `generateRoundRobinPairs` bleibt als Hilfsfunktion oder wird zu einem internen Implementierungsdetail — je nach Umsetzungsdetail im Plan) — gibt eine Liste von Runden zurück, jede Runde eine Liste von `[homeId, awayId]`-Paaren:

**Algorithmus (Standard Circle-Method / Berger-Tabelle)**:
1. Bei ungerader Teamzahl: einen `null`-Platzhalter ("Freilos-Slot", siehe Terminologie-Hinweis unten) als zusätzliches Element ergänzen, sodass die Länge gerade ist.
2. Ein Team fest an Position 0 belassen, die übrigen `N-1` (bzw. `N` bei geradem Original) Elemente rotieren pro Runde um eine Position im Kreis.
3. `N-1` Runden (gerade Teamzahl) bzw. `N` Runden (ursprünglich ungerade Teamzahl, eine Runde mehr wegen des Platzhalters). Jede Runde: die Elemente werden paarweise von außen nach innen zusammengeführt (Position 0 mit letzter Position, Position 1 mit vorletzter, usw.).
4. Ein Paar, das den `null`-Platzhalter enthält, wird aus der Runde herausgefiltert (das zugehörige Team pausiert in dieser Runde — KEIN Freilos-Punktegewinn, anders als beim Schweizer System, da hier die Tabelle ausschließlich auf tatsächlich gespielten Spielen basiert).

**Terminologie-Klarstellung** (wichtig, um Verwechslung mit dem Schweizer-System-Freilos zu vermeiden): in der Round-Robin-Gruppenphase wird dieser Fall intern NICHT als "Bye"/"Freilos" bezeichnet und erzeugt KEIN `Game` mit `byeTeamId` — es wird schlicht kein Spiel für dieses Team in dieser Runde generiert. Kein Punkte-Bonus, keine Sonderanzeige nötig (das Team taucht einfach in dieser Runde nicht im Zeitplan auf).

**Bei `doubleRoundRobin: true`**: nach den `N-1`/`N` "Hinrunden" folgen ebenso viele "Rückrunden" mit denselben Paarungen, aber vertauschten Heim-/Auswärts-Rollen (`[away, home]` statt `[home, away]`) — als eigene Runden-Nummern fortlaufend angehängt, nicht vermischt.

## Mehrgruppen-Zeitplanung (Interleaving)

1. `generateRoundRobinRounds` wird PRO GRUPPE separat aufgerufen (nur mit den `teamIds` dieser Gruppe).
2. Die Rundenlisten aller Gruppen werden "interleaved": Runde 1 aller Gruppen wird zu einem gemeinsamen Paarungs-Batch zusammengeführt und EINMAL an die bestehende Feld-Zuweisungslogik übergeben (die bereits über alle in diesem Batch enthaltenen Paarungen automatisch möglichst viele Felder gleichzeitig auslastet, da alle Paarungen im Batch garantiert unterschiedliche Teams betreffen — sowohl gruppenintern durch die Circle-Method als auch gruppenübergreifend, da ein Team nur in genau einer Gruppe ist). Danach Runde 2 aller Gruppen, usw.
3. Ungleiche Gruppengrößen (z. B. 9 Teams auf 2 Gruppen à 5/4): die größere Gruppe hat mehr Runden (Circle-Method-Rundenzahl = Teamzahl der jeweiligen Gruppe minus 1, aufgerundet auf gerade). Beim Interleaving werden Runden nach Index zusammengeführt — hat eine kleinere Gruppe keine Runde N mehr, tragen für diesen Batch nur die verbleibenden, noch nicht fertigen Gruppen bei. Das ist unproblematisch: die Feld-Zuweisungslogik verarbeitet einfach weniger Paarungen in diesem Batch, keine Sonderbehandlung nötig.
4. `Game.round` wird pro Team-übergreifendem Batch-Index vergeben (Batch 1 → `round: 1` für alle darin enthaltenen Spiele, unabhängig davon aus welcher Gruppe), sodass die Zeitplan-Anzeige weiterhin sinnvoll nach "Runde X" gruppieren kann, mit Spielen mehrerer Gruppen darin.

## Gruppenanzahl-Vorschlag

Analog zum bestehenden Swiss-Rundenvorschlag-Hilfetext (`TournamentForm.tsx`). Formel:

```
zielgröße = 3.5  // Mittelwert des Zielbereichs 3-4 Teams/Gruppe
kandidaten = [1, 2, 4, 8, 16]  // Zweierpotenzen, praktikable Obergrenze für Turniere dieser Größenordnung
vorschlag = das Element aus kandidaten, für das |teamCount / kandidat - zielgröße| minimal ist
           (bei Gleichstand: die KLEINERE Gruppenanzahl bevorzugen — weniger Gruppen sind einfacher zu organisieren)
```

Bei `doubleRoundRobin: true`: dieselbe Formel wird verwendet, aber mit `zielgröße = 2` statt `3.5` (halbierter Zielwert, da jedes Team in der Gruppe durch die Rückrunde doppelt so viele Spiele hat wie bei einer einfachen Runde — eine kleinere Gruppengröße gleicht das wieder auf eine vergleichbare Gesamt-Spielanzahl pro Team aus). Beispiel: 16 Teams ohne Rückspiel → `zielgröße=3.5` → 4 Gruppen à 4 (`|16/4 - 3.5| = 0.5`, bestes Ergebnis unter den Kandidaten); mit Rückspiel → `zielgröße=2` → 8 Gruppen à 2 (`|16/8 - 2| = 0`). Der Vorschlag bleibt jederzeit manuell überschreibbar.

Anzeige unter dem "Anzahl Gruppen"-Feld: „Vorschlag: {vorschlag} Gruppen (ca. {Math.round(teamCount/vorschlag)} Teams je Gruppe) — bei Bedarf anpassbar."

## UI

**Konfigurationsseite**, neuer Abschnitt "Gruppen" (nur sichtbar wenn `mode === 'round-robin+finals'`):
- "Anzahl Gruppen"-Zahlenfeld mit obigem Vorschlag als Hilfetext.
- "Mit Rückspiel (Hin- und Rückrunde)"-Checkbox.
- Team-zu-Gruppe-Zuordnung: pro Team ein Dropdown ("Gruppe A", "Gruppe B", ...), Standard-Zuordnung beim Ändern von `groupCount` ist eine einfache Reihum-Verteilung (Team 1→A, Team 2→B, ..., Team N→A/B/... zyklisch) als sinnvoller Ausgangspunkt, den der Organisator danach frei per Dropdown ändern kann.

**Neue Tabellen-Ansicht** (analog zur bestehenden Swiss-Übersicht-Seite, aber ohne Buchholz-Spalte/-Erklärung): zeigt bei `mode === 'round-robin'` ODER `mode === 'round-robin+finals'` mit `groupCount > 1` je Gruppe eine eigene Tabelle (Überschrift "Gruppe A", "Gruppe B", ...). Sortierung: 1. Punkte, 2. direkter Vergleich (Mini-Tabelle nur unter den punktgleichen Teams, basierend auf ihren Spielen gegeneinander), 3. Korbdifferenz. Darunter der bestehende Zeitplan, weiterhin nach Runde gruppiert, mit Gruppen-Kennzeichnung pro Spielzeile (z. B. ein kleines "Gruppe A"-Tag neben dem Feld-Label, analog zum bestehenden `F{field}`-Tag).

Bei `mode === 'round-robin+finals'` mit `groupCount === 1` (Grenzfall) verhält sich die Tabellenansicht wie eine einzelne Gruppe — keine Sonderbehandlung nötig, ergibt sich automatisch aus der allgemeinen Logik.

## Standings-Berechnung

Neue Funktion `computeGroupStandings(teams: Team[], games: Game[], groupId: string): GroupStanding[]` (neue, von `computeStandings` — Swiss-spezifisch mit Buchholz — getrennte Funktion, da die Sortierlogik grundverschieden ist). `GroupStanding` enthält KEIN `buchholz`-Feld, dafür `headToHead`-Information wird nicht als eigenes Feld persistiert, sondern zur Sortierzeit aus den bereits vorhandenen `games` on-the-fly berechnet (kein zusätzlicher Zustand nötig).

## Nicht Teil dieses Designs

- Endrunden-Varianten, die auf "1. der Gruppe X" basieren (Endrunde 1, 2, 2a-2c, 4 aus der vom Nutzer bereitgestellten Referenz) — eigenständiges, zweites Teilprojekt, das auf diesem Design aufbaut.
- Automatische (nicht-manuelle) Gruppeneinteilungsalgorithmen (z. B. Setzlisten-basiert) — der Organisator weist Teams manuell zu, nur der initiale Vorschlag beim Ändern der Gruppenanzahl ist automatisch (reihum), keine "faire" Stärke-Verteilung.
- Änderungen an der Swiss-System-Logik — komplett unberührt.
