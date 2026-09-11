# Design: Letzte Runde kann verloren gehen — "Turnier abgeschlossen" erscheint vor dem Speichern

## Problem (kritisch — möglicher Datenverlust)

In `SwissResultsPage.tsx`:

```typescript
const activeRoundGames = schedule.games.filter(g => g.stage === 'swiss' && g.round === displayRound)
const activeRoundEvaluated = activeRoundGames.every(
  g => g.byeTeamId !== undefined || g.cancelledReason || g.periodScores.length > 0 || isScoreEntered(g.id)
)
const tournamentFinished = displayRound >= totalRounds && activeRoundEvaluated
```

`isScoreEntered(gameId)` prüft NUR lokalen React-State (`scores`), nicht den Store. Das bedeutet: sobald der Nutzer das letzte Ergebnis der letzten Runde eintippt (bevor irgendein Button geklickt wurde), wird `activeRoundEvaluated` sofort `true` — rein durch das Tippen, ohne dass `submitGameResult` jemals aufgerufen wurde.

`tournamentFinished` wird dadurch ebenfalls sofort `true`. Der JSX-Ausdruck, der den "Nächste Runde auslosen"-Button rendert oder stattdessen die "Turnier abgeschlossen"-Meldung zeigt, reagiert auf genau diesen Render:

```tsx
{tournamentFinished ? (
  <Alert><AlertDescription>Turnier abgeschlossen...</AlertDescription></Alert>
) : !isViewingPastRound ? (
  <Button onClick={handleAdvance} disabled={!allEvaluated}>Nächste Runde auslosen</Button>
) : null}
```

`handleAdvance` (der einzige Codepfad, der `submitGameResult` für die lokal eingetippten Werte aufruft) hängt aber genau an diesem Button. Sobald `tournamentFinished` true wird, verschwindet der Button — noch BEVOR der Nutzer ihn klicken konnte. Die Ergebnisse der letzten Runde bleiben für immer nur im flüchtigen React-State (`scores`), werden nie an `submitGameResult`/den Store/`localStorage` übergeben. Ein Reload, ein Tab-Wechsel oder einfach das Verlassen der Seite verliert diese Ergebnisse komplett — die Turnierübersicht/Tabelle zeigt dann die letzte Runde als nie gespielt.

**Reproduktion**: 1-Runden-Turnier (oder: letzte Runde eines Mehr-Runden-Turniers) — alle Ergebnisse der letzten Runde eintippen. Sobald das letzte Feld ausgefüllt ist, verschwindet der "Nächste Runde auslosen"-Button sofort durch "Turnier abgeschlossen", ohne dass die Werte je gespeichert wurden.

## Root Cause

Vermischung von zwei unterschiedlichen Bedeutungen unter einem Namen: "ist die Runde im UI-Sinn vollständig ausgefüllt" (für den Button-Enable-Zustand, wo lokale Eingaben korrekt mitzählen sollen — der Button muss ja aktivierbar sein, BEVOR man ihn klickt) vs. "ist die Runde im Store-Sinn tatsächlich abgeschlossen" (für die Entscheidung, ob das Turnier fertig ist — hier dürfen NUR bereits gespeicherte Ergebnisse zählen, da genau diese Prüfung darüber entscheidet, ob der Speicher-Button überhaupt noch erreichbar ist).

## Fix

Zwei separate Prüfungen statt einer:

- `allEvaluated` (steuert `disabled` des "Nächste Runde auslosen"-Buttons) bleibt UNVERÄNDERT — lokale Eingaben zählen korrekt mit, das ist der Zweck dieser Prüfung.
- `activeRoundEvaluated` (bisher: identische Logik wie `allEvaluated`, aber für `displayRound` statt `currentViewedRound`) wird umbenannt/umgebaut zu einer Prüfung, die AUSSCHLIESSLICH auf bereits im Store gespeicherte Ergebnisse schaut (`g.byeTeamId !== undefined || g.cancelledReason || g.periodScores.length > 0` — OHNE `isScoreEntered(g.id)`-Fallback). Nur diese gestrafte Prüfung darf in `tournamentFinished` einfließen.

Ergebnis: `tournamentFinished` wird erst dann `true`, wenn die letzten Ergebnisse TATSÄCHLICH per `handleAdvance`/`submitGameResult` gespeichert wurden — der Button bleibt so lange sichtbar und klickbar, bis das wirklich passiert ist. Nach dem Klick verschwindet er korrekt (da `submitGameResult` dann echte `periodScores` gesetzt hat, BEVOR `advanceSwissRound()` — das bei der letzten Runde ggf. nichts weiter auslöst außer dass keine neue Runde mehr existiert — aufgerufen wird und der nächste Render `tournamentFinished` korrekt `true` liefert).

Rand-Check verifiziert: `advanceSwissRound()` bei `displayRound === totalRounds` wirft KEINEN Fehler — `applySwissPairing(..., currentRound + 1, ...)` findet für die nicht-existente Folgerunde einfach keine Platzhalter-Spiele (`placeholders = []`) und ist ein stiller No-Op (`schedule` bleibt inhaltlich unverändert, nur erneut gespeichert). Kein Crash, aber unnötiger Aufruf. Sauberer: `handleAdvance` ruft `advanceSwissRound()` nur auf, wenn noch eine Folgerunde existiert (`displayRound < totalRounds`) — bei der letzten Runde reicht das reine Speichern der Scores, `tournamentFinished` wird danach durch den nächsten Render korrekt aus den jetzt echten `periodScores` abgeleitet.
