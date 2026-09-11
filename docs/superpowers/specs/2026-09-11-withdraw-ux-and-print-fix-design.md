# Design: Withdraw-UX-Fixes und fehlende Ergebnisse im Print-Export

## Problem 1: Annulliertes Spiel verlangt scheinbar noch ein Ergebnis

Wenn ein Team über den Withdraw-Button zurückgezogen wird, setzt `withdrawTeam` (`tournament-store.ts`) `cancelledReason: 'withdrawal'` auf dem betroffenen, noch nicht gespielten Spiel, lässt `periodScores` aber leer. `SwissResultsPage.tsx` prüft für die Anzeige des Eingabefelds nur `hasResult = game.periodScores.length > 0` — ein annulliertes Spiel zeigt also weiterhin leere `Ergebnis Heim/Auswärts`-Eingabefelder, obwohl `allEvaluated`/`activeRoundEvaluated` das Spiel bereits als ausgewertet zählen (`g.cancelledReason || ...`). Das verwirrt: der Organisator sieht ein scheinbar noch auszufüllendes Feld für ein Spiel, das gar nicht mehr stattfindet.

**Fix**: `withdrawTeam` setzt beim Annullieren direkt `periodScores: [{ period: 1, homeScore: 0, awayScore: 0 }]` statt nur `cancelledReason`. Das Spiel gilt damit sofort als "hat ein Ergebnis" (0:0), erscheint auf der Ergebnisseite als bereits ausgewertete Zeile (Punktestand `0 : 0`, kein Eingabefeld mehr) und braucht keine manuelle Nacheingabe. Die Punkteberechnung in `standings.ts` bleibt unberührt — dort wird ein annulliertes Spiel bereits über den separaten `cancelledReason === 'withdrawal'`-Zweig behandelt (Sieger bekommt 2 Punkte für den Walkover, unabhängig vom `periodScores`-Inhalt), sodass `0:0` in `periodScores` keine Doppelzählung o.ä. auslöst — es dient nur der UI-Anzeige/dem "ausgewertet"-Zustand, nicht der Punkteberechnung selbst.

## Problem 2: Zurückgezogener Status ist visuell nicht erkennbar

Aktuell sieht der "Zurückziehen"-Button (aktuell "ausgeschieden") für ein aktives und ein bereits zurückgezogenes Team identisch aus (`outline` + gestrichelter roter Rahmen) — der Organisator kann auf einen Blick nicht erkennen, ob ein Team bereits zurückgezogen wurde.

**Fix**: Sobald ein Team `withdrawnAfterRound` gesetzt hat, zeigt die zugehörige Spielzeile (Freilos-artig, siehe unten) einen klar abweichenden, in Vollton roten Button/Badge (`variant="destructive"`, volle rote Fläche statt gestricheltem Umriss) mit Text wie "Zurückgezogen" (Zustand, nicht mehr klickbarer CTA) statt "Zurückziehen" (Aktion). Ein bereits zurückgezogenes Team hat ohnehin ab der nächsten Runde keine neuen Spiele mehr (siehe `reshapeFutureSwissRounds`), betrifft also nur die Anzeige des zum Zeitpunkt des Rückzugs annullierten Spiels in der aktuellen/rückblickend betrachteten Runde.

## Problem 3: CTA-Text "Ausscheiden" → "Zurückziehen"

Der Button-Text sowie der Confirm-Dialog-Text wechseln von "ausgeschieden"/"als ausgeschieden markieren?" zu "Zurückziehen"/"zurückgezogen"/"als zurückgezogen markieren?". Interne Bezeichner (`withdrawTeam`, `withdrawnAfterRound`) bleiben unverändert, nur die sichtbaren deutschen UI-Texte ändern sich — bereits semantisch passend zueinander (withdraw = zurückziehen).

## Problem 4: Ergebnisse fehlen im Print-Export

`renderSwissOverviewHtml` (`swiss-overview-export.ts`) zeigt in der Zeitplan-Sektion pro Spiel nur `${scheduledStart} – ${scheduledEnd}`, nie das tatsächliche Ergebnis — obwohl die interaktive Turnierübersicht (`SwissOverviewPage.tsx` über `GameRow` mit `showResult`) bereits Endergebnisse statt Uhrzeit anzeigt, sobald ein Spiel gespielt ist. Der Print-Export wurde bei dieser früheren Änderung nicht mitgezogen.

**Fix**: analog zu `GameRow`s `showResult`-Logik — wenn `g.periodScores.length > 0`, zeigt die Zeitplan-Zeile im Export das Endergebnis (`homeScore : awayScore`, über `computeFinalScore` summiert) statt der Uhrzeit; sonst bleibt die geplante Uhrzeit wie bisher. Ein annulliertes/zurückgezogenes Spiel (Problem 1's Fix) zeigt entsprechend `0 : 0` — optional zusätzlich ein Hinweis "(zurückgezogen)", analog zur bereits vorhandenen "(ausgeschieden)"-Markierung in der Tabellensektion (die dort in "(zurückgezogen)" umbenannt wird, siehe Problem 3).

## Problem 5: Sortierlogik der Tabelle (Buchholz vor Korbdifferenz) ist für Laien nicht erklärt — und die S-U-N-Spalte verstärkt die Verwirrung

Bei Punktegleichstand sortiert die Tabelle zuerst nach Buchholz-Zahl (Summe der Punkte aller bisherigen Gegner), erst danach nach eigener Korbdifferenz. Das ist Standard-Schweizer-System-Konvention und bleibt inhaltlich unverändert (**kein Bug** — anhand eines konkreten Turnierverlaufs verifiziert: ein Team mit schlechterer eigener Diff, aber stärkeren bisherigen Gegnern, steht zu Recht vor einem Team mit besserer eigener Diff, aber schwächeren Gegnern).

Ein zusätzlicher, eigenständiger Verwirrungsfaktor: die S-U-N-Spalte (Sieg-Unentschieden-Niederlage) zählt nur echte gespielte Partien, nicht Freilose — ein Team mit einem Freilos (2 Punkte) und zwei Niederlagen zeigt "0-0-2", obwohl es 2 Punkte hat. Das sieht wie ein Rechenfehler aus, ist aber korrekt (Freilos = Punkte ohne "Spiel"). Statt das nur zu erklären, wird die S-U-N-Spalte komplett entfernt — sie liefert ohnehin keine zusätzliche, für die Platzierung relevante Information (die Sortierung nutzt nur Punkte/Buchholz/Diff, nie S-U-N) und ist die eigentliche Quelle des scheinbaren Widerspruchs.

**Fix**:
1. S-U-N-Spalte überall entfernen — sowohl in der interaktiven Tabelle (`SwissOverviewPage.tsx`) als auch im Print-Export (`swiss-overview-export.ts`).
2. Ein kurzer, immer sichtbarer Hinweistext direkt unter der "Tabelle"-Überschrift, der sowohl die Sortierpriorität als auch die Buchholz-Berechnung konkret erklärt, z.B.: "Sortierung: 1. Punkte, 2. Buchholz-Zahl, 3. Korbdifferenz. Die Buchholz-Zahl ist die Summe der Punkte aller bisherigen Gegner (zeigt, wie stark die bisherigen Gegner abgeschnitten haben)." — an derselben Stelle wie ursprünglich geplant, sowohl auf der interaktiven Seite als auch im Print-Export.
