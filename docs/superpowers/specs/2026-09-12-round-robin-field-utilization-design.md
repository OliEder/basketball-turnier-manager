# Design: Round-Robin-Zeitplan nutzt Felder nicht optimal aus

## Problem (bestätigt reproduziert)

`generateSchedule` (`src/lib/schedule-generator.ts`) plant Round-Robin-Paarungen in der von `generateRoundRobinPairs` erzeugten, festen Reihenfolge: `(1,2), (1,3), ..., (1,N), (2,3), (2,4), ..., (N-1,N)`. Diese Liste wird strikt sequenziell, ein Spiel nach dem anderen, per "größter verfügbarer Zeitgewinn"-Heuristik (Greedy) auf Felder verteilt.

**Konkret reproduziert** (8 Teams, 3 Felder): die ersten beiden Zeitfenster nutzen nur 1 von 3 Feldern, obwohl 4 Spiele gleichzeitig möglich wären — weil die ersten 7 Paarungen alle Team 1 enthalten und Team 1 nur an einem Spiel gleichzeitig teilnehmen kann. Erst ab dem Punkt, wo genug unterschiedliche Teams "in der Zeitplan-Warteschlange" auftauchen, wird die Feldauslastung besser — bricht zum Ende hin aber wieder ein, da die letzten Paarungen überproportional oft bereits verplante Teams betreffen.

**Nachgewiesene Symptome**: (a) am Anfang und Ende des Turniers bleiben Felder ungenutzt, obwohl noch spielbare, unabhängige Paarungen offen wären; (b) die Reihenfolge der Begegnungen wirkt für Zuschauer/Organisatoren "seltsam" (Team 1 spielt sofort mehrfach hintereinander in großem Abstand, andere Teams erscheinen erst spät zum ersten Mal).

## Root Cause

Fehlende Rundenstruktur. Ein klassisches Round-Robin-Turnier lässt sich immer so in Runden aufteilen, dass **innerhalb jeder Runde jedes Team höchstens einmal spielt** (Circle-Method / Berger-Tabelle, Standardverfahren) — dadurch sind pro Runde automatisch bis zu `floor(N/2)` Spiele gleichzeitig unabhängig voneinander, unabhängig von der Reihenfolge der Runden untereinander. Der aktuelle Code hat dieses Konzept nicht; er plant eine flache Liste ohne Rundenzugehörigkeit.

## Fix

`generateRoundRobinPairs` wird durch eine rundenbewusste Erzeugung ersetzt, die die Circle-Method implementiert:

- Bei gerader Teamzahl `N`: `N - 1` Runden, jede Runde hat genau `N / 2` Paarungen, jedes Team spielt in jeder Runde genau einmal.
- Bei ungerader Teamzahl `N`: ein Freilos-Platzhalter wird ergänzt (analog zum bereits bestehenden Freilos-Konzept im Schweizer System — `Game.byeTeamId`), `N` Runden, jede Runde hat `(N-1) / 2` echte Spiele und ein Freilos.

Referenzalgorithmus (Standard-Circle-Method): ein Team fix an Position 0, die übrigen `N-1` Teams rotieren im Kreis um eine Position pro Runde; für ungerade `N` wird vorher ein "Bye"-Platzhalter als `N+1`-tes Element ergänzt.

**Zeitplan-Konsequenz**: `generateSchedule`s Planungsschleife iteriert dann über die Runden IN Reihenfolge, aber INNERHALB einer Runde über alle ihre (bis zu `floor(N/2)`) Paarungen OHNE Rücksicht auf Team-Verfügbarkeit aus einer vorherigen Runde zu nehmen (das ist bereits durch die Rundenstruktur sichergestellt — kein Team taucht zweimal in derselben Runde auf). Die bestehende Feld-Zuweisungslogik (frühester verfügbarer Slot je Feld) bleibt inhaltlich unverändert, wird aber jetzt PRO RUNDE angewendet: alle Spiele einer Runde versuchen, möglichst gleichzeitig zu starten (die vorhandene Logik erreicht das bereits automatisch, wenn die Paarungen in der richtigen, unabhängigen Reihenfolge vorliegen — das eigentliche Problem war rein die Eingabereihenfolge, nicht der Slot-Zuweisungsalgorithmus selbst).

**`round-robin+finals`**: unverändert — die Finalrunden-Generierung (`generatePlayoffGames`) baut bereits auf dem fertigen `fieldNextFree`-Zustand nach der Gruppenphase auf und ist von dieser Änderung nicht betroffen, solange `generateSchedule`s Rückgabestruktur (`Game[]` mit `round`-Feld) gleich bleibt.

**Zu erwartende Datenmodell-Änderung**: `Game.round` wird für Round-Robin-Spiele jetzt sinnvoll gefüllt (aktuell hardcodiert `round: 1` für alle Gruppenspiele, siehe `schedule-generator.ts` Zeile 95) — jedes Spiel bekommt seine tatsächliche Runden-Nummer der Circle-Method. Das ist eine Verbesserung, kein Kompatibilitätsbruch, da `round` im Typsystem bereits für alle Modi vorgesehen ist.

## Nicht Teil dieser Änderung

- Das Schweizer System (`swiss-schedule.ts`) ist bereits rundenbasiert und unberührt von diesem Bug.
- Keine Änderung an der Feld-Zuweisungs-/Blackout-/Verfügbarkeits-Logik selbst (`findNextSlot`, `maxTime`) — nur an der Reihenfolge, in der Paarungen dieser Logik zugeführt werden.
