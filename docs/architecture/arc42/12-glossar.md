# 12. Glossar

## Fachbegriffe

| Begriff | Definition |
|---|---|
| **Rangstufe** | Eine Gruppe von Teams mit demselben Rang aus verschiedenen Gruppen — z. B. "Rangstufe 1" = alle Gruppenersten, "Rangstufe 2" = alle Gruppenzweiten. Zentral für Endrunde 1 und 4, die jeweils eine eigene Endrunden-Phase je Rangstufe erzeugen. |
| **Endrunde 1** | Jede Rangstufe spielt einen eigenen K.-o.-Baum (mit Halbfinale, Finale, Spiel um Platz 3) um ihren eigenen Platzbereich — Rangstufe 1 um Platz 1-4, Rangstufe 2 um Platz 5-8 usw. Erfordert eine Gruppenanzahl, die exakt einer Zweierpotenz (2/4/8/16/32) entspricht. |
| **Endrunde 3** | Nur die Gruppenersten (Rangstufe 1) spielen einen K.-o.-Baum um Platz 1-4. Erfordert genau 4 Gruppen. |
| **Endrunde 4** | Jede Rangstufe spielt eine eigene Round-Robin-Kohorte ("Platzierungsgruppe") um ihren Platzbereich, statt eines K.-o.-Baums. Kein Spiel um Platz 3 nötig, da sich die Platzierung direkt aus der Kohorten-Tabelle ergibt. |
| **Endrunde 2 / 2a / 2b / 2c** | Geplante, aber (Stand dieser Doku) NICHT implementierte Variante: Top-2-je-Gruppe qualifizieren sich für ein Viertelfinale, mit gestaffelter Ausspielung weiterer Plätze (2 = nur Top 4, 2a = zusätzlich Platz 5-8, 2b = zusätzlich Platz 9-16, 2c = alle Plätze). |
| **Platzierungsgruppe** | Die Round-Robin-Kohorte einer Rangstufe bei Endrunde 4 (siehe oben). |
| **K.-o.-Baum** | Single-Elimination-Turnierbaum: Verlierer scheiden aus, bis nur noch ein Sieger übrig ist. Unterstützte Größen in dieser App: 2, 4, 8, 16, 32 Teilnehmer. |
| **Spiel um Platz 3** | Zusatzspiel zwischen den beiden Halbfinal-Verlierern eines K.-o.-Baums, um Platz 3 zu vergeben. Wird ab Bracket-Größe 4 automatisch erzeugt. |
| **Rückrunde** | Bei aktiviertem "Hin- und Rückrunde" (`doubleRoundRobin`) die zweite Ausspielung jeder Gruppenpaarung mit vertauschten Heim-/Auswärtsrollen. |
| **Walkover** | Kampflose Wertung eines Spiels (i. d. R. 2:0 bzw. entsprechende Standardpunkte) zugunsten des verbleibenden Teams, wenn der Gegner zurückgezogen wurde. |
| **Sperrzeit (Blackout Period)** | Ein Zeitfenster innerhalb der Hallenöffnungszeit, in dem KEIN Spiel angesetzt werden darf (z. B. Mittagspause). Wird vom Zeitplan-Generator zwingend respektiert (siehe Kapitel 8.1, 10.2 QS-1). |
| **Buchholz-Zahl** | Kennzahl aus dem Schweizer System: Summe der Punkte aller bisherigen Gegner eines Teams — ein Maß für die "Stärke der bisherigen Gegner", genutzt als Tie-Breaker in der Tabelle. Es gibt zwei unabhängige Implementierungen für unterschiedliche Datengrundlagen (siehe `computeGroupPhaseBuchholz` vs. das Buchholz-Feld in `standings.ts`). |
| **Freilos (Bye)** | Ein Team pausiert eine Runde, ohne zu spielen — im Schweizer System bei ungerader Teamzahl, mit einem Punktebonus (anders als das echte Aussetzen in der Circle-Method-Gruppenphase, siehe Kapitel 5.2). |

## Technische Begriffe (projektspezifisch)

| Begriff | Definition |
|---|---|
| `rankTier` | Numerisches Feld auf `Game`, identifiziert, zu welcher Rangstufe (siehe oben) ein Spiel gehört. `undefined`/fehlend bedeutet implizit Rangstufe 1 (Standardfall für Formate ohne mehrere parallele Rangstufen, z. B. Endrunde 3). |
| `placementFrom` | Numerisches Feld, das den niedrigsten (besten) Platz angibt, um den eine Rangstufe/Kohorte spielt (1, 5, 9, ... bei Vierergruppen). Grundlage für die Sortierung/Nummerierung des Endstands. |
| `sourceRank` (`homeSourceRank`/`awaySourceRank`) | Zeiger auf `Game`, der referenziert, welcher Rang (`{groupId, rank}`) einer Gruppentabelle diesen Platzhalter befüllen soll. Nur relevant für die erste Runde eines K.-o.-Baums bzw. für Endrunde-3/4-Kohorten. |
| `sourceMatch` (`homeSourceMatch`/`awaySourceMatch`) | Generischer Zeiger `{stage, matchIndex, outcome}`, der referenziert, welches Vorgängerspiel (Sieger oder Verlierer) diesen Platzhalter befüllen soll. Ersetzt die ursprüngliche, auf genau ein Halbfinale beschränkte `homeSourceSemifinal`-Struktur (siehe Kapitel 9, ADR-05). |
| `matchIndex` | 0-basierter Index eines Spiels INNERHALB seiner Runde/Stage, eindeutig innerhalb `{rankTier, stage}` — Schlüssel für die `sourceMatch`-Auflösung. |
| `finalsVariant` | Feld auf `TournamentConfig`, wählt zwischen `'endrunde-1' \| 'endrunde-3' \| 'endrunde-4' \| undefined`. `undefined` bei `groupCount === 1` erlaubt (alter, variantenloser Fallback bleibt gültig); bei `groupCount > 1` zwingend erforderlich (Kapitel 8.3). |
| `finalsBracketSize` | Ältestes, generischstes Feld (`2 \| 4`), steuert den variantenlosen Fallback-KO-Baum (Halbfinale+Finale oder nur Finale) für den Fall einer einzelnen Gruppe. |
| `qualifierSourceRanks` | Parameter von `generatePlayoffGames` (Endrunde 3), die vorab berechnete Setzliste (Reihenfolge der Gruppenränge), mit der die erste Runde des K.-o.-Baums befüllt wird. |
| `resolvePlaceholders` | Zentrale Store-Funktion, die nach jeder Ergebniseingabe/-korrektur/jedem Rückzug erneut über alle Spiele läuft und Platzhalter durch reale Team-IDs ersetzt, sobald deren Quelle feststeht (siehe Kapitel 5.4, 8.5). |
| `scheduleGenerationError` | Store-Feld, das eine von `generateSchedule` geworfene Exception festhält, damit ein fehlgeschlagener Regenerierungsversuch sichtbar bleibt, statt den vorherigen Zeitplan stillschweigend zu ersetzen/zu verwerfen (Kapitel 6, 10.2 QS-3). |
| `fieldNextFree` | Array (ein Eintrag je Feld), das während der Zeitplan-Generierung fortlaufend den nächsten freien Zeitpunkt je Feld verfolgt — durchgereicht und aktualisiert über alle Turnierphasen hinweg (Kapitel 5.2). |
| `withdrawnAfterRound` / `withdrawnAfterStage` | Felder auf `Team`, die festhalten, wann genau (Swiss-Runde bzw. Turnierphase) ein Rückzug erfolgte — Grundlage für die korrekte rückwirkende Punktebehandlung. |
