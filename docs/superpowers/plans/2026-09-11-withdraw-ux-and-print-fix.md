# Implementierungsplan: Withdraw-UX-Fixes und fehlende Ergebnisse im Print-Export

Spec: `docs/superpowers/specs/2026-09-11-withdraw-ux-and-print-fix-design.md`

Arbeitsverzeichnis: das Hauptrepository `/Users/oliver-marcuseder/01-vibe-coding/00-Basektball/08-Fibalon-Baskets/02-turnier-manager` auf Branch `main` (kein separater Worktree mehr nötig für diese kleinen Fixes — falls die bisherige Konvention aus früheren Plänen ein Feature-Branch/Worktree vorsieht, einen neuen Branch `fix/withdraw-ux-and-print` von `main` erstellen und dort arbeiten, dann per PR/Merge zurück nach `main`).

## Task 1: `withdrawTeam` setzt 0:0 statt leerem Ergebnis

**Files:** Modify `src/store/tournament-store.ts`, Modify `src/store/tournament-store.test.ts`

- [ ] **Step 1: Bestehenden Test anpassen, der auf leeres Ergebnis nach Rückzug prüft**

Lies `src/store/tournament-store.test.ts` vollständig (insbesondere `describe('withdrawTeam', ...)`, aktuell Zeilen 109-166). Der Test `'cancels an open game in the current round and credits the opponent'` (Zeilen 125-143) prüft aktuell nur `expect(updatedGame.cancelledReason).toBe('withdrawal')`, macht keine Aussage über `periodScores` — bleibt unverändert gültig, aber ergänze eine zusätzliche Assertion direkt danach:

```typescript
    expect(updatedGame.periodScores).toEqual([{ period: 1, homeScore: 0, awayScore: 0 }])
```

Run: `npm test -- --run src/store/tournament-store.test.ts`
Expected: FAIL — aktuell ist `periodScores` bei einem annullierten Spiel noch `[]`.

- [ ] **Step 2: Implementierung**

In `src/store/tournament-store.ts`, `withdrawTeam` (aktuell Zeilen 309-335), Zeile 314-321:

Aktuell:
```typescript
    const gamesAfterCancellation = schedule.games.map(g => {
      if (g.round !== currentRound || g.stage !== 'swiss') return g
      const involvesWithdrawing = g.homeTeamId === teamId || g.awayTeamId === teamId
      if (involvesWithdrawing && g.periodScores.length === 0) {
        return { ...g, cancelledReason: 'withdrawal' as const }
      }
      return g
    })
```
ändern zu:
```typescript
    const gamesAfterCancellation = schedule.games.map(g => {
      if (g.round !== currentRound || g.stage !== 'swiss') return g
      const involvesWithdrawing = g.homeTeamId === teamId || g.awayTeamId === teamId
      if (involvesWithdrawing && g.periodScores.length === 0) {
        return {
          ...g,
          cancelledReason: 'withdrawal' as const,
          periodScores: [{ period: 1, homeScore: 0, awayScore: 0 }],
        }
      }
      return g
    })
```

Wichtig: `computeStandings` (`src/lib/standings.ts`) behandelt annullierte Spiele bereits über einen separaten, vorrangigen Zweig (`if (game.cancelledReason === 'withdrawal' && ...)`, VOR dem allgemeinen `isScorableGame`-Pfad geprüft — verifiziere das durch Lesen von `standings.ts`, insbesondere dass der `cancelledReason`-Zweig `continue`/früh zurückkehrt und den `0:0`-Inhalt von `periodScores` gar nicht mehr für die Punkteberechnung liest). Das `0:0` dient hier ausschließlich der UI-Anzeige (`hasResult`-Flag) und dem "Runde ausgewertet"-Zustand, nicht der Punktevergabe — keine Änderung an `standings.ts` nötig.

- [ ] **Step 3: Test ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/store/tournament-store.test.ts`
Expected: alle Tests PASS, inklusive der neuen Assertion und der beiden anderen bereits bestehenden `withdrawTeam`-Tests (die `0:0`-Änderung darf keine der bestehenden Assertions zu `playedGame.periodScores` — Zeile 122, betrifft ein ANDERES, bereits regulär gespieltes Spiel, nicht das annullierte — brechen, da dieser Test einen anderen Teamrückzug ohne offenes Spiel prüft).

- [ ] **Step 4: Vollen Testlauf + Build**

Run: `npm test -- --run && npm run build`
Expected: alle grün.

- [ ] **Step 5: Commit**

```bash
git add src/store/tournament-store.ts src/store/tournament-store.test.ts
git commit -m "fix: score a cancelled withdrawal game as 0:0 instead of leaving it empty"
```

---

## Task 2: SwissResultsPage — annulliertes Spiel zeigt keine leeren Eingabefelder mehr, Withdraw-Button wird zum roten Status-Badge, Text "Zurückziehen"/"Zurückgezogen"

**Files:** Modify `src/pages/SwissResultsPage.tsx`, Modify `src/pages/SwissResultsPage.test.tsx`

### Step 1: Bestehende Tests anpassen

Lies `src/pages/SwissResultsPage.test.tsx` vollständig. Der Test `'marks a team withdrawn and cancels its open game when the organizer confirms'` (aktuell Zeilen 265-276) klickt aktuell auf einen Button mit Name `` `${teamAbbreviation} ausgeschieden` ``. Da Task 1 bereits `periodScores: [{ homeScore: 0, awayScore: 0 }]` beim Rückzug setzt, UND dieser Task den Button-Text auf "Zurückziehen" ändert, muss der Test-Selektor angepasst werden:

```tsx
    fireEvent.click(screen.getByRole('button', { name: `${teamAbbreviation} zurückziehen` }))
```

Run: `npm test -- --run src/pages/SwissResultsPage.test.tsx`
Expected: FAIL zunächst (Button-Text noch nicht geändert), nach Step 2 wieder PASS.

### Step 2: Neue Tests ergänzen

Innerhalb desselben `describe`-Blocks, nach dem bestehenden Withdraw-Test:

```tsx
  it('shows the score as 0:0 with no editable inputs once a game is cancelled by a withdrawal', () => {
    setupSwissTournament(4, 2)
    render(<SwissResultsPage />)
    const teams = useTournamentStore.getState().tournament.teams
    const game = useTournamentStore.getState().schedule!.games.find(g => g.round === 1 && g.field > 0)!
    const teamAbbreviation = getTeamAbbreviation(teams.find(t => t.id === game.homeTeamId)!)

    fireEvent.click(screen.getByRole('button', { name: `${teamAbbreviation} zurückziehen` }))

    expect(screen.queryByLabelText(`Ergebnis Heim, Spiel ${game.gameNumber}`)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(`Ergebnis Auswärts, Spiel ${game.gameNumber}`)).not.toBeInTheDocument()
  })

  it('shows a solid red withdrawn badge instead of the withdraw button once a team has been withdrawn', () => {
    setupSwissTournament(4, 2)
    render(<SwissResultsPage />)
    const teams = useTournamentStore.getState().tournament.teams
    const game = useTournamentStore.getState().schedule!.games.find(g => g.round === 1 && g.field > 0)!
    const teamAbbreviation = getTeamAbbreviation(teams.find(t => t.id === game.homeTeamId)!)

    fireEvent.click(screen.getByRole('button', { name: `${teamAbbreviation} zurückziehen` }))

    expect(screen.queryByRole('button', { name: `${teamAbbreviation} zurückziehen` })).not.toBeInTheDocument()
    const badge = screen.getByText(`${teamAbbreviation} zurückgezogen`)
    expect(badge).toHaveClass('bg-destructive')
  })
```

Prüfe vor dem Schreiben die exakten bereits vorhandenen Imports/Helper (`setupSwissTournament`, `getTeamAbbreviation`) in der Datei — an das bestehende Muster anpassen, nicht neu erfinden. Die zweite Assertion (`toHaveClass('bg-destructive')`) geht davon aus, dass die neue Statusanzeige (Step 3) die `Button`-Komponente mit `variant="destructive"` nutzt, was laut `src/components/ui/button.tsx` die Klasse `bg-destructive` liefert — verifiziere das durch Lesen der Datei, passe die Assertion an, falls die tatsächliche Implementierung eine andere Darstellungsform wählt (z.B. ein reines `<span>`-Badge statt eines `Button`s mit `disabled`).

Run: `npm test -- --run src/pages/SwissResultsPage.test.tsx`
Expected: FAIL — Implementierung fehlt noch.

### Step 3: Implementierung

Lies die vollständige aktuelle `src/pages/SwissResultsPage.tsx` (siehe Plan-Kontext oben — Grid-Layout mit `gridTemplateColumns: '140px 1fr 42px 16px 42px 1fr 140px auto auto'`, zwei symmetrische Withdraw-Button-Spalten links und rechts).

Für JEDE der beiden Withdraw-Button-Stellen (Heim, aktuell Zeilen 143-155, und Auswärts, aktuell Zeilen 205-217) das gleiche Muster anwenden — hier exemplarisch für die Heim-Spalte:

Aktuell:
```tsx
                {canWithdraw ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs text-muted-foreground border-dashed border-destructive w-full min-w-0 truncate"
                    title={`${home} ausgeschieden`}
                    onClick={() => {
                      if (confirm(`${home} als ausgeschieden markieren?`)) withdrawTeam(game.homeTeamId!)
                    }}
                  >
                    {home} ausgeschieden
                  </Button>
                ) : <span />}
```
ändern zu:
```tsx
                {homeTeam?.withdrawnAfterRound !== undefined ? (
                  <span className="text-xs font-semibold uppercase tracking-wide rounded-sm bg-destructive text-destructive-foreground w-full min-w-0 truncate px-3 py-1.5 text-center">
                    {home} zurückgezogen
                  </span>
                ) : canWithdraw ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs text-muted-foreground border-dashed border-destructive w-full min-w-0 truncate"
                    title={`${home} zurückziehen`}
                    onClick={() => {
                      if (confirm(`${home} als zurückgezogen markieren?`)) withdrawTeam(game.homeTeamId!)
                    }}
                  >
                    {home} zurückziehen
                  </Button>
                ) : <span />}
```

Analog für die Auswärts-Spalte (`awayTeam?.withdrawnAfterRound`, `away`, `game.awayTeamId!`).

WICHTIGER HINWEIS: `homeTeam`/`awayTeam` sind in dieser Datei bereits als `Team | undefined` definiert (aus einer früheren Kürzel-Anzeige-Aufgabe: `const homeTeam = game.homeTeamId ? teamMap.get(game.homeTeamId) : undefined`) — kein neuer Lookup nötig, nur die bereits vorhandenen Variablen verwenden.

Falls der Step-2-Test `toHaveClass('bg-destructive')` gegen ein `<span>` statt einen `Button` prüft, passe entweder den Test oder die Implementierung an, sodass beides konsistent ist — bevorzuge das `<span>` (kein Klick-Handler mehr nötig für einen reinen Status, kein potenziell verwirrender "klickbar aussehender, aber inert" Button).

Da nach `withdrawTeam` `periodScores` bereits `[{ homeScore: 0, awayScore: 0 }]` enthält (Task 1), zeigt der bestehende `hasResult`-Zweig (Zeile 161-162 bzw. 182-183, `{hasResult && correctingGameId !== game.id ? <span>...{game.periodScores[0].homeScore}</span> : ...}`) automatisch `0` statt eines leeren Eingabefelds — hier ist KEINE zusätzliche Änderung nötig, das ergibt sich automatisch aus Task 1's Store-Fix. Verifiziere das trotzdem explizit beim Testen (Step 2's erster neuer Test).

### Step 4: Test ausführen, Erfolg verifizieren

Run: `npm test -- --run src/pages/SwissResultsPage.test.tsx`
Expected: alle Tests PASS.

### Step 5: Vollen Testlauf + Build + E2E

Run: `npm test -- --run && npm run build && npm run test:e2e`
Expected: alle grün. Prüfe insbesondere `e2e/swiss-operational-safety.spec.ts`, das den Withdraw-Flow per Button-Text-Matching (`getByRole('button', { name: /ausgeschieden$/ })`) testet — dieser e2e-Test MUSS an den neuen Text angepasst werden (`/zurückziehen$/` statt `/ausgeschieden$/`, und ggf. eine zusätzliche Prüfung, dass nach dem Rückzug KEIN Button mit diesem Namen mehr existiert, sondern das rote Badge). Lies die Datei vollständig und passe alle betroffenen Selektoren/Confirm-Dialog-Texte an (`page.once('dialog', ...)`-Handler prüfen ggf. auch auf den Dialog-Text, falls vorhanden).

### Step 6: Manuell im Browser verifizieren

`npm run dev`, Playwright MCP: Turnier mit 4+ Teams starten, ein Team über den (jetzt "zurückziehen" beschrifteten) Button zurückziehen, bestätigen:
1. Kein leeres Eingabefeld mehr sichtbar für das annullierte Spiel — stattdessen `0 : 0`.
2. Der geklickte Button ist verschwunden, stattdessen ein deutlich als Vollton-Rot erkennbares Badge "X zurückgezogen" an derselben Stelle.
3. Das GEGNERTEAM in diesem annullierten Spiel zeigt weiterhin seinen normalen, klickbaren "zurückziehen"-Button (nur das zurückgezogene Team selbst bekommt das Badge).
4. Die Runde lässt sich normal weiter auslosen, ohne dass für das annullierte Spiel noch manuell etwas eingetragen werden muss.

Report, ob durchgeführt.

### Step 7: Commit

```bash
git add src/pages/SwissResultsPage.tsx src/pages/SwissResultsPage.test.tsx e2e/swiss-operational-safety.spec.ts
git commit -m "feat: show withdrawn status as a solid red badge and rename the action to \"zurückziehen\""
```
(Datei-Liste an tatsächlich geänderte Dateien anpassen — z.B. falls weitere e2e-Dateien betroffen sind.)

---

## Task 3: JSON-Import auf der Konfigurationsseite

Spec: `docs/superpowers/specs/2026-09-11-json-import-design.md`

**Files:** Modify `src/store/tournament-store.ts`, Modify `src/store/tournament-store.test.ts`, Create `src/lib/import/json-import.ts`, Create `src/lib/import/json-import.test.ts`, Modify `src/pages/ConfigPage.tsx`, Modify `src/pages/ConfigPage.test.tsx`

### Kontext

Der bestehende JSON-Export (`src/lib/export/json-export.ts`, `downloadJson`) exportiert `{ tournament, schedule, exportedAt }`. Es gibt noch keinen Weg, eine solche Datei wieder einzulesen. Das Datenmodell speichert aktuell genau EIN Turnier (`src/lib/storage.ts`, feste `localStorage`-Schlüssel) — ein Import ersetzt dieses eine Turnier vollständig. Mehrfach-Turnier-Verwaltung ist explizit NICHT Teil dieses Tasks (separates, späteres Feature).

Wiederverwendung bestehender Bausteine: die bereits vorhandene `isTournamentLocked()`-Selector-Funktion und der bereits vorhandene `DestructiveConfirmDialog` (siehe `ConfigPage.tsx`s "Zeitplan neu generieren"-Fall) werden für die Konfliktbehandlung genutzt, kein neuer Bestätigungsmechanismus nötig.

### Step 1: Validierungsfunktion — fehlschlagenden Test schreiben

Erstelle `src/lib/import/json-import.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseTournamentImport } from './json-import'

describe('parseTournamentImport', () => {
  it('parses a valid export payload', () => {
    const json = JSON.stringify({
      tournament: { id: 't1', name: 'Test', mode: 'swiss', fields: 2, gameSettings: {}, venue: {}, teams: [] },
      schedule: { id: 's1', tournamentId: 't1', generatedAt: '2026-01-01T00:00:00.000Z', games: [], totalDurationMin: 0, estimatedEnd: '10:00' },
      exportedAt: '2026-01-01T00:00:00.000Z',
    })
    const result = parseTournamentImport(json)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.tournament.name).toBe('Test')
      expect(result.schedule?.id).toBe('s1')
    }
  })

  it('accepts a payload with schedule set to null', () => {
    const json = JSON.stringify({
      tournament: { id: 't1', name: 'Test', mode: 'round-robin', fields: 2, gameSettings: {}, venue: {}, teams: [] },
      schedule: null,
    })
    const result = parseTournamentImport(json)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.schedule).toBeNull()
  })

  it('rejects invalid JSON', () => {
    const result = parseTournamentImport('not json')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBeTruthy()
  })

  it('rejects a payload missing the tournament field', () => {
    const result = parseTournamentImport(JSON.stringify({ schedule: null }))
    expect(result.ok).toBe(false)
  })

  it('rejects a payload where tournament.teams is not an array', () => {
    const json = JSON.stringify({
      tournament: { id: 't1', name: 'Test', mode: 'swiss', fields: 2, gameSettings: {}, venue: {}, teams: 'not-an-array' },
      schedule: null,
    })
    const result = parseTournamentImport(json)
    expect(result.ok).toBe(false)
  })

  it('rejects a payload where schedule is present but missing games', () => {
    const json = JSON.stringify({
      tournament: { id: 't1', name: 'Test', mode: 'swiss', fields: 2, gameSettings: {}, venue: {}, teams: [] },
      schedule: { id: 's1', tournamentId: 't1' },
    })
    const result = parseTournamentImport(json)
    expect(result.ok).toBe(false)
  })
})
```

Run: `npm test -- --run src/lib/import/json-import.test.ts`
Expected: FAIL — Datei existiert noch nicht.

### Step 2: Validierungsfunktion implementieren

Erstelle `src/lib/import/json-import.ts`:

```typescript
import type { TournamentConfig, Schedule } from '@/types'

export type TournamentImportResult =
  | { ok: true; tournament: TournamentConfig; schedule: Schedule | null }
  | { ok: false; error: string }

function isValidTournament(value: unknown): value is TournamentConfig {
  if (typeof value !== 'object' || value === null) return false
  const t = value as Record<string, unknown>
  return (
    typeof t.id === 'string' &&
    typeof t.name === 'string' &&
    typeof t.mode === 'string' &&
    typeof t.fields === 'number' &&
    typeof t.gameSettings === 'object' && t.gameSettings !== null &&
    typeof t.venue === 'object' && t.venue !== null &&
    Array.isArray(t.teams)
  )
}

function isValidSchedule(value: unknown): value is Schedule {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Record<string, unknown>
  return (
    typeof s.id === 'string' &&
    typeof s.tournamentId === 'string' &&
    Array.isArray(s.games)
  )
}

export function parseTournamentImport(raw: string): TournamentImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'Die Datei enthält kein gültiges JSON.' }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: 'Unerwartetes Dateiformat.' }
  }
  const data = parsed as Record<string, unknown>

  if (!isValidTournament(data.tournament)) {
    return { ok: false, error: 'Die Datei enthält kein gültiges Turnier (fehlende oder falsche Felder).' }
  }

  if (data.schedule !== null && data.schedule !== undefined && !isValidSchedule(data.schedule)) {
    return { ok: false, error: 'Die Datei enthält einen ungültigen Zeitplan.' }
  }

  return {
    ok: true,
    tournament: data.tournament,
    schedule: (data.schedule as Schedule | null | undefined) ?? null,
  }
}
```

### Step 3: Validierungs-Test ausführen, Erfolg verifizieren

Run: `npm test -- --run src/lib/import/json-import.test.ts`
Expected: alle Tests PASS.

### Step 4: Store-Action — fehlschlagenden Test schreiben

Lies `src/store/tournament-store.test.ts` vollständig, um das bestehende Testmuster zu übernehmen. Ergänze:

```typescript
describe('importTournament', () => {
  it('replaces the current tournament and schedule with the imported ones', () => {
    const { addTeam, importTournament } = useTournamentStore.getState()
    addTeam({ name: 'Old Team', logoUrl: '', color: '#000', contact: '' })

    const importedTournament: TournamentConfig = {
      id: 'imported-1', name: 'Importiertes Turnier', mode: 'swiss', fields: 3,
      gameSettings: {
        periodsCount: 4, periodDurationMin: 5, breakBetweenPeriodsMin: 1,
        halfTimeBreakMin: 5, bufferBetweenGamesMin: 5, breakBetweenRoundsMin: 15,
        awardCeremonyMin: 15,
      },
      venue: {
        name: 'Importierte Halle', availabilityWindows: [{ start: '09:00', end: '20:00' }],
        blackoutPeriods: [], setupBufferMin: 30, teardownBufferMin: 30,
      },
      teams: [{ id: 'it1', name: 'Imported Team', logoUrl: '', color: '#000', contact: '', players: [] }],
    }
    importTournament(importedTournament, null)

    const state = useTournamentStore.getState()
    expect(state.tournament.name).toBe('Importiertes Turnier')
    expect(state.tournament.teams).toHaveLength(1)
    expect(state.tournament.teams[0].name).toBe('Imported Team')
    expect(state.schedule).toBeNull()
  })
})
```

Prüfe den exakten Import von `TournamentConfig` am Kopf der Testdatei (ergänzen falls nicht vorhanden: `import type { TournamentConfig } from '@/types'`).

Run: `npm test -- --run src/store/tournament-store.test.ts`
Expected: FAIL — `importTournament` existiert noch nicht.

### Step 5: Store-Action implementieren

In `src/store/tournament-store.ts`, Interface `TournamentStore` um eine neue Action ergänzen, im `// Persistence`-Abschnitt (direkt vor `loadFromStorage`):

```typescript
  importTournament: (tournament: TournamentConfig, schedule: Schedule | null) => void
```

In der Store-Implementierung (bei den anderen Action-Definitionen, z.B. direkt vor `loadFromStorage`):

```typescript
  importTournament: (tournament, schedule) => {
    set({ tournament, schedule })
    saveTournament(tournament)
    if (schedule) saveSchedule(schedule)
  },
```

(Exakte Einfügeposition an der bestehenden `set`/`get`-Signatur ausrichten — lies die Datei vollständig, um die exakte Stelle zu bestätigen.)

### Step 6: Store-Test ausführen, Erfolg verifizieren

Run: `npm test -- --run src/store/tournament-store.test.ts`
Expected: alle Tests PASS.

### Step 7: Vollen Testlauf + Build

Run: `npm test -- --run && npm run build`
Expected: alle grün.

### Step 8: UI — fehlschlagenden Test schreiben

Lies `src/pages/ConfigPage.test.tsx` vollständig, um das bestehende Testmuster (Store-Reset, `render`-Konvention, wie der bestehende `DestructiveConfirmDialog`-Fall für "Zeitplan neu generieren" getestet wird) zu übernehmen. Ergänze:

```tsx
  it('imports a tournament from a JSON file, replacing the current one, when not locked', async () => {
    const { addTeam } = useTournamentStore.getState()
    addTeam({ name: 'Altes Team', logoUrl: '', color: '#000', contact: '' })

    render(<ConfigPage />)

    const file = new File(
      [JSON.stringify({
        tournament: {
          id: 'imported-1', name: 'Importiertes Turnier', mode: 'swiss', fields: 2,
          gameSettings: {
            periodsCount: 4, periodDurationMin: 5, breakBetweenPeriodsMin: 1,
            halfTimeBreakMin: 5, bufferBetweenGamesMin: 5, breakBetweenRoundsMin: 15,
            awardCeremonyMin: 15,
          },
          venue: {
            name: 'Halle', availabilityWindows: [{ start: '09:00', end: '20:00' }],
            blackoutPeriods: [], setupBufferMin: 30, teardownBufferMin: 30,
          },
          teams: [{ id: 'it1', name: 'Neues Team', logoUrl: '', color: '#000', contact: '', players: [] }],
        },
        schedule: null,
      })],
      'turnier.json',
      { type: 'application/json' },
    )

    const input = screen.getByLabelText(/JSON importieren/i) as HTMLInputElement
    await userEvent.upload(input, file)

    expect(await screen.findByText('Importiertes Turnier')).toBeInTheDocument()
    expect(useTournamentStore.getState().tournament.teams).toHaveLength(1)
    expect(useTournamentStore.getState().tournament.teams[0].name).toBe('Neues Team')
  })

  it('shows an error and does not change the tournament when the imported file is invalid', async () => {
    const { addTeam } = useTournamentStore.getState()
    addTeam({ name: 'Bestehendes Team', logoUrl: '', color: '#000', contact: '' })

    render(<ConfigPage />)

    const file = new File(['not valid json'], 'kaputt.json', { type: 'application/json' })
    const input = screen.getByLabelText(/JSON importieren/i) as HTMLInputElement
    await userEvent.upload(input, file)

    expect(await screen.findByText(/kein gültiges JSON/i)).toBeInTheDocument()
    expect(useTournamentStore.getState().tournament.teams).toHaveLength(1)
    expect(useTournamentStore.getState().tournament.teams[0].name).toBe('Bestehendes Team')
  })

  it('requires typed confirmation before importing when the current tournament is locked', async () => {
    const { addTeam, setFields, generateAndSaveSchedule, submitGameResult } = useTournamentStore.getState()
    addTeam({ name: 'A', logoUrl: '', color: '#000', contact: '' })
    addTeam({ name: 'B', logoUrl: '', color: '#000', contact: '' })
    setFields(1)
    generateAndSaveSchedule()
    const game = useTournamentStore.getState().schedule!.games[0]
    submitGameResult(game.id, [{ period: 1, homeScore: 10, awayScore: 5 }])

    render(<ConfigPage />)

    const file = new File(
      [JSON.stringify({
        tournament: {
          id: 'imported-1', name: 'Importiertes Turnier', mode: 'swiss', fields: 2,
          gameSettings: {
            periodsCount: 4, periodDurationMin: 5, breakBetweenPeriodsMin: 1,
            halfTimeBreakMin: 5, bufferBetweenGamesMin: 5, breakBetweenRoundsMin: 15,
            awardCeremonyMin: 15,
          },
          venue: {
            name: 'Halle', availabilityWindows: [{ start: '09:00', end: '20:00' }],
            blackoutPeriods: [], setupBufferMin: 30, teardownBufferMin: 30,
          },
          teams: [],
        },
        schedule: null,
      })],
      'turnier.json',
      { type: 'application/json' },
    )
    const input = screen.getByLabelText(/JSON importieren/i) as HTMLInputElement
    await userEvent.upload(input, file)

    expect(screen.getByRole('button', { name: 'Bestätigen' })).toBeInTheDocument()
    expect(useTournamentStore.getState().tournament.name).not.toBe('Importiertes Turnier')

    await userEvent.type(screen.getByLabelText(/Bestätigungswort/i), 'ÄNDERN')
    await userEvent.click(screen.getByRole('button', { name: 'Bestätigen' }))

    expect(useTournamentStore.getState().tournament.name).toBe('Importiertes Turnier')
  })
```

Prüfe, ob `@testing-library/user-event` bereits im Projekt genutzt wird (`grep -rn "@testing-library/user-event" src/`) — falls nicht als Muster vorhanden, orientiere dich an `fireEvent` statt `userEvent` (Datei-Upload lässt sich auch über `fireEvent.change(input, { target: { files: [file] } })` simulieren, falls `userEvent.upload` nicht ohne Weiteres verfügbar ist — wähle die im Projekt bereits etablierte Konvention).

Run: `npm test -- --run src/pages/ConfigPage.test.tsx`
Expected: alle drei neuen Tests FAIL — UI existiert noch nicht.

### Step 9: UI implementieren

Lies die aktuelle vollständige `src/pages/ConfigPage.tsx` (siehe Plan-Kontext oben — `confirmTarget`-State bereits vorhanden mit `'tournament' | 'venue' | 'regenerate' | null`).

Erweitere den `ConfirmTarget`-Typ um `'import'`:
```typescript
type ConfirmTarget = 'tournament' | 'venue' | 'regenerate' | 'import' | null
```

Ergänze neuen lokalen State und einen Ref für das Datei-Input, sowie einen State für einen gepufferten Import-Payload (analog zum bereits etablierten Pending-Muster aus `TeamList.tsx`s Team-hinzufügen/löschen-Sperre) und einen Fehlertext-State:
```tsx
import { useRef, useState } from 'react'
import { parseTournamentImport } from '@/lib/import/json-import'
```
```tsx
  const [pendingImport, setPendingImport] = useState<{ tournament: TournamentConfig; schedule: Schedule | null } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { importTournament } = useTournamentStore()
```
(`TournamentConfig`/`Schedule`-Typen importieren: `import type { TournamentConfig, Schedule } from '@/types'`.)

```tsx
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImportError(null)
    const text = await file.text()
    const result = parseTournamentImport(text)
    if (!result.ok) {
      setImportError(result.error)
      return
    }
    if (locked) {
      setPendingImport({ tournament: result.tournament, schedule: result.schedule })
      setConfirmTarget('import')
    } else {
      importTournament(result.tournament, result.schedule)
    }
  }
```

Neue Sektion im JSX ergänzen, z.B. nach der "Spielplan generieren"-Sektion:
```tsx
      <section className="space-y-4">
        <h2 className="text-lg text-brand-primary-light">Turnier importieren</h2>
        <div className="space-y-1">
          <label htmlFor="tournament-import-input" className="inline-block">
            <span className="sr-only">JSON importieren</span>
            <Button type="button" onClick={() => fileInputRef.current?.click()}>
              JSON importieren
            </Button>
          </label>
          <input
            ref={fileInputRef}
            id="tournament-import-input"
            type="file"
            accept="application/json,.json"
            aria-label="JSON importieren"
            className="sr-only"
            onChange={handleFileSelected}
          />
        </div>
        {importError && (
          <Alert>
            <AlertDescription>{importError}</AlertDescription>
          </Alert>
        )}
        {tournament.name && (
          <p className="text-sm text-muted-foreground">Aktuelles Turnier: {tournament.name}</p>
        )}
      </section>
```

WICHTIG zur `aria-label`/`sr-only`-Konstruktion oben: das ist eine Vorlage, kein Copy-Paste-Garant für korrekte Testbarkeit via `getByLabelText`. Verifiziere beim Implementieren, dass `screen.getByLabelText(/JSON importieren/i)` aus Step 8 tatsächlich das `<input type="file">`-Element trifft (nicht den `<Button>`) — bei Bedarf das sichtbare `<Button>`-Element per `onClick` weiterhin den echten `<input>` triggern lassen (wie oben skizziert über `fileInputRef.current?.click()`), aber sicherstellen, dass das `<input>` selbst über `aria-label` oder ein verknüpftes `<label htmlFor>` eindeutig auffindbar ist. Passe die Struktur an, falls die Vorlage beim Testen nicht sauber funktioniert — das Kernverhalten (Klick auf sichtbaren Button öffnet den Datei-Dialog, `<input type="file">` bleibt visuell versteckt aber für Tests/Screenreader erreichbar) ist das eigentliche Ziel, nicht die exakte Markup-Form.

`DestructiveConfirmDialog`s `description`/`onConfirm` erweitern:
```tsx
        description={
          confirmTarget === 'regenerate'
            ? 'Der Zeitplan wurde bereits gespielt. Neu generieren verwirft die aktuelle Rundenstruktur — bereits erfasste Ergebnisse können dadurch inkonsistent werden.'
            : confirmTarget === 'import'
            ? 'Das aktuelle Turnier läuft bereits (mindestens ein Ergebnis wurde erfasst). Ein Import ersetzt es vollständig durch den Inhalt der ausgewählten Datei.'
            : 'Das Turnier läuft bereits (mindestens ein Ergebnis wurde erfasst). Diese Änderung kann den weiteren Turnierverlauf beeinträchtigen.'
        }
        confirmWord="ÄNDERN"
        onConfirm={() => {
          if (confirmTarget === 'tournament') setTournamentUnlocked(true)
          if (confirmTarget === 'venue') setVenueUnlocked(true)
          if (confirmTarget === 'regenerate') generateAndSaveSchedule()
          if (confirmTarget === 'import' && pendingImport) {
            importTournament(pendingImport.tournament, pendingImport.schedule)
            setPendingImport(null)
          }
          setConfirmTarget(null)
        }}
```

Passe exakt an die reale, bereits existierende Struktur von `ConfigPage.tsx` an (Imports, JSX-Einrückung) — die obigen Snippets sind eine Vorlage, kein Copy-Paste-Ersatz für das Lesen der echten Datei.

### Step 10: Test ausführen, Erfolg verifizieren

Run: `npm test -- --run src/pages/ConfigPage.test.tsx`
Expected: alle Tests PASS.

### Step 11: Vollen Testlauf + Build + E2E

Run: `npm test -- --run && npm run build && npm run test:e2e`
Expected: alle grün.

### Step 12: Manuell im Browser verifizieren

`npm run dev`, Playwright MCP:
1. Ein Turnier ohne Ergebnisse anlegen, über den bestehenden Export ("JSON herunterladen" auf der Export-Seite) eine Datei erzeugen.
2. Ein anderes Turnier anlegen (andere Teams/Name), zur Konfigurationsseite navigieren, "JSON importieren" klicken, die zuvor exportierte Datei auswählen — bestätigen, dass das Turnier sofort (ohne Dialog) durch den Dateiinhalt ersetzt wird.
3. Ein Ergebnis eintragen (Turnier jetzt gesperrt), erneut versuchen zu importieren — bestätigen, dass der Bestätigungsdialog erscheint, falsches Wort den Bestätigen-Button deaktiviert hält, korrektes Wort ("ÄNDERN") den Import durchführt.
4. Eine ungültige/kaputte Datei importieren (z.B. eine Text-Datei mit falschem Inhalt) — bestätigen, dass eine klare Fehlermeldung erscheint und NICHTS am aktuellen Turnier verändert wird.

Report, ob durchgeführt.

### Step 13: Commit

```bash
git add src/lib/import/json-import.ts src/lib/import/json-import.test.ts src/store/tournament-store.ts src/store/tournament-store.test.ts src/pages/ConfigPage.tsx src/pages/ConfigPage.test.tsx
git commit -m "feat: add JSON tournament import on the configuration page"
```

---

## Task 4: Turnierübersicht-Tabelle — "(ausgeschieden)" → "(zurückgezogen)"

**Files:** Modify `src/pages/SwissOverviewPage.tsx`, Modify `src/pages/SwissOverviewPage.test.tsx` (falls dort ein Test explizit auf den Text prüft)

### Step 1: Vorkommen finden und anpassen

Run: `grep -n "ausgeschieden" src/pages/SwissOverviewPage.tsx src/pages/SwissOverviewPage.test.tsx`

Falls ein Vorkommen wie `{s.withdrawn && <span ...>(ausgeschieden)</span>}` existiert, den sichtbaren Text auf `(zurückgezogen)` ändern. Falls ein Test explizit auf `'(ausgeschieden)'` als sichtbaren Text prüft, den Test entsprechend anpassen.

### Step 2: Test ausführen, Erfolg verifizieren

Run: `npm test -- --run src/pages/SwissOverviewPage.test.tsx`
Expected: PASS.

### Step 3: Commit

```bash
git add src/pages/SwissOverviewPage.tsx src/pages/SwissOverviewPage.test.tsx
git commit -m "feat: rename withdrawn-team label to \"zurückgezogen\" on the tournament overview"
```
(Falls keine Testdatei betroffen ist, nur `SwissOverviewPage.tsx` committen.)

---

## Task 5: Print-Export zeigt Ergebnisse statt Uhrzeit für gespielte Partien

**Files:** Modify `src/lib/export/swiss-overview-export.ts`, Modify `src/lib/export/swiss-overview-export.test.ts`

### Step 1: Fehlschlagenden Test schreiben

Lies `src/lib/export/swiss-overview-export.test.ts` vollständig (insbesondere die bestehenden Fixtures — ein Spiel mit `periodScores: [{ period: 1, homeScore: 20, awayScore: 15 }]`, Zeilen 28-29 laut Plan-Kontext).

Ergänze im bestehenden `describe`-Block (oder einem neuen, thematisch passenden):

```typescript
  it('shows the final score instead of the scheduled time for a played game', () => {
    const html = renderSwissOverviewHtml(tournament, schedule, standings)
    expect(html).toContain('20 : 15')
    expect(html).not.toContain('09:30 – 10:00')
  })

  it('shows the scheduled time for a game that has not been played yet', () => {
    const unplayedSchedule = {
      ...schedule,
      games: schedule.games.map(g => g.id === schedule.games[0].id ? { ...g, periodScores: [] } : g),
    }
    const html = renderSwissOverviewHtml(tournament, unplayedSchedule, standings)
    expect(html).toContain('09:30 – 10:00')
  })
```

Passe die exakten Fixture-Werte (Uhrzeiten, Scores, Spiel-Referenz) an das tatsächlich in der Datei vorhandene Fixture an — die obigen Werte (`20:15`, `09:30–10:00`) sind aus dem bereits bekannten Fixture-Inhalt dieses Plans übernommen, verifiziere sie durch Lesen der echten Datei vor dem Schreiben.

Run: `npm test -- --run src/lib/export/swiss-overview-export.test.ts`
Expected: erster neuer Test FAIL (Export zeigt noch die Uhrzeit statt des Ergebnisses), zweiter PASS (Verhalten für ungespielte Spiele ändert sich nicht).

### Step 2: Implementierung

In `src/lib/export/swiss-overview-export.ts`:

Import erweitern:
```typescript
import { computeFinalScore } from '@/lib/standings'
```

Zeilen 34-45 (innerhalb `scheduleSections`), aktuell:
```typescript
      .map(g => {
        const homeTeam = g.homeTeamId ? teamMap.get(g.homeTeamId) : undefined
        const awayTeam = g.awayTeamId ? teamMap.get(g.awayTeamId) : undefined
        const home = escapeHtml(homeTeam ? getTeamAbbreviation(homeTeam) : (g.homeLabel ?? '?'))
        const away = escapeHtml(awayTeam ? getTeamAbbreviation(awayTeam) : (g.awayLabel ?? '?'))
        const pairingTitle = escapeHtml([homeTeam?.name, awayTeam?.name].filter(Boolean).join(' vs '))
        return `<tr>
          <td>${g.gameNumber}</td>
          <td>Feld ${g.field}</td>
          <td>${g.scheduledStart} – ${g.scheduledEnd}</td>
          <td title="${pairingTitle}">${home} vs ${away}</td>
        </tr>`
      }).join('\n')
```
ändern zu:
```typescript
      .map(g => {
        const homeTeam = g.homeTeamId ? teamMap.get(g.homeTeamId) : undefined
        const awayTeam = g.awayTeamId ? teamMap.get(g.awayTeamId) : undefined
        const home = escapeHtml(homeTeam ? getTeamAbbreviation(homeTeam) : (g.homeLabel ?? '?'))
        const away = escapeHtml(awayTeam ? getTeamAbbreviation(awayTeam) : (g.awayLabel ?? '?'))
        const pairingTitle = escapeHtml([homeTeam?.name, awayTeam?.name].filter(Boolean).join(' vs '))
        const timeOrScore = g.periodScores.length > 0
          ? (() => { const { home, away } = computeFinalScore(g); return `${home} : ${away}` })()
          : `${g.scheduledStart} – ${g.scheduledEnd}`
        return `<tr>
          <td>${g.gameNumber}</td>
          <td>Feld ${g.field}</td>
          <td>${timeOrScore}</td>
          <td title="${pairingTitle}">${home} vs ${away}</td>
        </tr>`
      }).join('\n')
```

Beachte den Namenskonflikt: die äußeren `home`/`away`-Konstanten (Team-Kürzel-Strings) und die inneren `{ home, away }` aus `computeFinalScore` (Zahlen) haben denselben Namen in unterschiedlichem Scope — das ist in der IIFE oben bewusst so lokal gehalten, um keine Kollision zu erzeugen. Falls das beim Implementieren unklar/fehleranfällig wirkt, alternativ die destrukturierten Werte umbenennen, z.B. `const { home: homeScore, away: awayScore } = computeFinalScore(g)`.

### Step 3: Test ausführen, Erfolg verifizieren

Run: `npm test -- --run src/lib/export/swiss-overview-export.test.ts`
Expected: alle Tests PASS.

### Step 4: Vollen Testlauf + Build

Run: `npm test -- --run && npm run build`
Expected: alle grün.

### Step 5: Manuell im Browser verifizieren

`npm run dev`, Playwright MCP: Turnier mit mindestens einer gespielten und einer noch ungespielten Runde anlegen, zur Turnierübersicht navigieren, "Drucken" klicken, im erzeugten HTML (Blob-Inhalt abfangen, analog zu einer früheren Verifikation dieses Features) bestätigen: gespielte Partien zeigen das Ergebnis, ungespielte weiterhin die Uhrzeit. Zusätzlich: ein zurückgezogenes Team (aus Task 1-3) zeigt im Export `0 : 0` für sein annulliertes Spiel.

### Step 6: Commit

```bash
git add src/lib/export/swiss-overview-export.ts src/lib/export/swiss-overview-export.test.ts
git commit -m "feat: show final score instead of scheduled time for played games in the print export"
```

---

## Task 7: S-U-N-Spalte entfernen, Sortierlogik + Buchholz-Berechnung erklären

**Files:** Modify `src/pages/SwissOverviewPage.tsx`, Modify `src/pages/SwissOverviewPage.test.tsx`, Modify `src/lib/export/swiss-overview-export.ts`, Modify `src/lib/export/swiss-overview-export.test.ts`

### Kontext

Kein Bug — anhand eines echten Turnierverlaufs (Nutzer-Export) explizit nachgerechnet und bestätigt: die Tabelle sortiert korrekt nach Standard-Schweizer-System-Konvention (1. Punkte, 2. Buchholz, 3. Korbdifferenz). Zwei Verwirrungsquellen werden behoben:

1. Die S-U-N-Spalte (Sieg-Unentschieden-Niederlage) zählt nur echte gespielte Partien, nicht Freilose — ein Team mit einem Freilos (2 Punkte) und zwei Niederlagen zeigt "0-0-2", obwohl es 2 Punkte hat, was wie ein Fehler aussieht. Die Spalte liefert ohnehin keine für die Sortierung relevante Information (`computeStandings` sortiert nie nach `wins`/`draws`/`losses`) — sie wird komplett entfernt, nicht nur erklärt.
2. Die Buchholz-vor-Korbdifferenz-Priorität bleibt für Laien erklärungsbedürftig — dafür ein kurzer, permanent sichtbarer Text, der zusätzlich konkret erklärt, WIE sich die Buchholz-Zahl berechnet (Summe der Punkte aller bisherigen Gegner — verifiziert in `src/lib/standings.ts`, Zeilen 102-114: `homeStanding.buchholz += awayStanding.points` etc., inkl. des Freilos-Falls `byeStanding.buchholz += byeStanding.points`).

`TeamStanding.wins`/`.draws`/`.losses` (`src/lib/standings.ts`) bleiben als Datenfelder unverändert bestehen — nur die sichtbare Spalte in Tabelle und Print-Export entfällt, keine Änderung an `computeStandings` selbst nötig.

### Step 1: Fehlschlagenden Test schreiben (Overview-Seite)

Lies `src/pages/SwissOverviewPage.test.tsx` vollständig. Ergänze im bestehenden `describe`-Block:

```tsx
  it('shows an explanation of the sort order and buchholz calculation under the standings heading', () => {
    setupSwissTournament(4, 2)
    render(<SwissOverviewPage />)
    expect(screen.getByText(/Sortierung: 1\. Punkte, 2\. Buchholz-Zahl, 3\. Korbdifferenz/)).toBeInTheDocument()
    expect(screen.getByText(/Buchholz-Zahl ist die Summe der Punkte aller bisherigen Gegner/)).toBeInTheDocument()
  })

  it('does not show a wins-draws-losses column in the standings table', () => {
    setupSwissTournament(4, 2)
    render(<SwissOverviewPage />)
    expect(screen.queryByText('S-U-N')).not.toBeInTheDocument()
  })
```

Passe den exakten Regex/Wortlaut an den in Step 2 tatsächlich gewählten Text an (Platzhalter-Muster oben, exakten Text konsistent zwischen Test und JSX halten).

Run: `npm test -- --run src/pages/SwissOverviewPage.test.tsx`
Expected: erster Test FAIL (Text fehlt noch), zweiter Test FAIL (S-U-N-Spalte existiert noch).

### Step 2: Implementierung (Overview-Seite)

In `src/pages/SwissOverviewPage.tsx`:

Zeile mit der `<h2>`-Überschrift "Tabelle" (aktuell Zeile 49), Erklärungstext ergänzen:

Aktuell:
```tsx
      <div>
        <h2 className="font-display text-lg uppercase mb-2">Tabelle</h2>
        <table className="w-full border-collapse">
```
ändern zu:
```tsx
      <div>
        <h2 className="font-display text-lg uppercase mb-2">Tabelle</h2>
        <p className="text-xs text-muted-foreground mb-2">
          Sortierung: 1. Punkte, 2. Buchholz-Zahl, 3. Korbdifferenz. Die Buchholz-Zahl ist die Summe der
          Punkte aller bisherigen Gegner (zeigt, wie stark die bisherigen Gegner abgeschnitten haben).
        </p>
        <table className="w-full border-collapse">
```

S-U-N-Spaltenkopf entfernen (aktuell Zeile 58, `<th className="py-1 pr-2">S-U-N</th>`) sowie die zugehörige Datenzelle (aktuell Zeile 74, `<td className="py-1 pr-2">{s.wins}-{s.draws}-{s.losses}</td>`) — beide Zeilen ersatzlos löschen.

### Step 3: Test ausführen, Erfolg verifizieren

Run: `npm test -- --run src/pages/SwissOverviewPage.test.tsx`
Expected: alle Tests PASS.

### Step 4: Fehlschlagenden Test schreiben (Print-Export)

Lies `src/lib/export/swiss-overview-export.test.ts` vollständig. Ergänze:

```typescript
  it('includes an explanation of the sort order and buchholz calculation near the standings table', () => {
    const html = renderSwissOverviewHtml(tournament, schedule, standings)
    expect(html).toMatch(/Sortierung: 1\. Punkte, 2\. Buchholz-Zahl, 3\. Korbdifferenz/)
    expect(html).toMatch(/Buchholz-Zahl ist die Summe der Punkte aller bisherigen Gegner/)
  })

  it('does not include a wins-draws-losses column in the standings table', () => {
    const html = renderSwissOverviewHtml(tournament, schedule, standings)
    expect(html).not.toContain('S-U-N')
  })
```

Run: `npm test -- --run src/lib/export/swiss-overview-export.test.ts`
Expected: beide FAIL.

### Step 5: Implementierung (Print-Export)

In `src/lib/export/swiss-overview-export.ts`:

Standings-Tabellenkopf und -Zeilen (aktuell Zeilen 20-28 und 76), das `S-U-N`-Feld entfernen:

Aktuell (Zeile 20-27, `standingsRows`):
```typescript
  const standingsRows = standings.map((s, i) => {
    const team = teamMap.get(s.teamId)
    const displayName = team ? getTeamAbbreviation(team) : '?'
    const fullName = team?.name ?? '?'
    return `<tr>
    <td>${i + 1}</td>
    <td title="${escapeHtml(fullName)}">${escapeHtml(displayName)}${s.withdrawn ? ' (ausgeschieden)' : ''}</td>
    <td>${s.points}</td>
    <td>${s.buchholz}</td>
    <td>${s.pointsDiff > 0 ? '+' : ''}${s.pointsDiff}</td>
    <td>${s.wins}-${s.draws}-${s.losses}</td>
  </tr>`
  }).join('\n')
```
ändern zu (letzte `<td>`-Zeile entfernt):
```typescript
  const standingsRows = standings.map((s, i) => {
    const team = teamMap.get(s.teamId)
    const displayName = team ? getTeamAbbreviation(team) : '?'
    const fullName = team?.name ?? '?'
    return `<tr>
    <td>${i + 1}</td>
    <td title="${escapeHtml(fullName)}">${escapeHtml(displayName)}${s.withdrawn ? ' (ausgeschieden)' : ''}</td>
    <td>${s.points}</td>
    <td>${s.buchholz}</td>
    <td>${s.pointsDiff > 0 ? '+' : ''}${s.pointsDiff}</td>
  </tr>`
  }).join('\n')
```

Tabellenkopf (aktuell Zeile 76, `<thead><tr><th>#</th><th>Team</th><th>Pkt</th><th>Buchholz</th><th>Diff</th><th>S-U-N</th></tr></thead>`) ändern zu:
```typescript
    <thead><tr><th>#</th><th>Team</th><th>Pkt</th><th>Buchholz</th><th>Diff</th></tr></thead>
```

Direkt nach der "Tabelle"-Überschrift (aktuell Zeile 74, `<h2>Tabelle</h2>`) den Erklärungstext ergänzen:

Aktuell:
```typescript
  <h2>Tabelle</h2>
  <table>
```
ändern zu:
```typescript
  <h2>Tabelle</h2>
  <p style="font-size: 0.8rem; color: #64748b; margin: -0.25rem 0 0.5rem;">
    Sortierung: 1. Punkte, 2. Buchholz-Zahl, 3. Korbdifferenz. Die Buchholz-Zahl ist die Summe der
    Punkte aller bisherigen Gegner (zeigt, wie stark die bisherigen Gegner abgeschnitten haben).
  </p>
  <table>
```
(Der Print-Export ist statisches HTML ohne Tailwind-Klassen — inline `style` passend zum bestehenden Stil-Muster dieser Datei, siehe die bereits vorhandenen inline `<style>`-Regeln weiter oben in derselben Funktion.)

### Step 6: Test ausführen, Erfolg verifizieren

Run: `npm test -- --run src/lib/export/swiss-overview-export.test.ts`
Expected: alle Tests PASS.

### Step 7: Vollen Testlauf + Build + E2E

Run: `npm test -- --run && npm run build && npm run test:e2e`
Expected: alle grün. Prüfe insbesondere, ob ein e2e-Test explizit auf die S-U-N-Spalte oder deren Inhalt prüft (`grep -rn "S-U-N" e2e/`) — falls ja, den betroffenen Test entsprechend anpassen (Assertion entfernen, da die Spalte nicht mehr existiert).

### Step 8: Manuell im Browser verifizieren

`npm run dev`, Playwright MCP: Turnier mit gespielten Runden UND mindestens einem Freilos anlegen, zur Turnierübersicht navigieren, bestätigen: keine S-U-N-Spalte mehr sichtbar, Erklärungstext (Sortierung + Buchholz-Berechnung) unter "Tabelle" sichtbar. "Drucken" klicken, im erzeugten HTML dieselben zwei Punkte bestätigen (keine S-U-N-Spalte, Erklärungstext vorhanden).

### Step 9: Commit

```bash
git add src/pages/SwissOverviewPage.tsx src/pages/SwissOverviewPage.test.tsx src/lib/export/swiss-overview-export.ts src/lib/export/swiss-overview-export.test.ts
git commit -m "feat: remove the confusing wins-draws-losses column, explain sort order and buchholz calculation instead"
```
(Datei-Liste um ggf. betroffene e2e-Spec-Dateien aus Step 7 ergänzen.)

---

## Task 8: Abschlussregression

**Files:** keine Änderungen, nur Verifikation

- [ ] **Step 1**: `npm test -- --run` — alle Tests PASS, Gesamtzahl notieren.
- [ ] **Step 2**: `npm run test:e2e` (zweimal, Flakiness-Check) — alle PASS in beiden Läufen.
- [ ] **Step 3**: `npm run build` — erfolgreich.
- [ ] **Step 4**: Manueller Gesamtdurchlauf (Playwright MCP): Turnier mit 5+ Teams, ein Team mitten in einer Runde zurückziehen (offenes Spiel vorhanden), bestätigen:
  1. Kein leeres Eingabefeld für das annullierte Spiel, Runde direkt weiter auslosbar.
  2. Rotes Vollton-Badge "X zurückgezogen" ersetzt den Button nur für das zurückgezogene Team.
  3. Turnierübersicht zeigt "(zurückgezogen)" statt "(ausgeschieden)" in der Tabelle.
  4. Print-Export zeigt für alle gespielten Partien (inkl. der `0:0`-Walkover-Partie) das Ergebnis statt der Uhrzeit, für noch ungespielte Partien weiterhin die Uhrzeit.
  5. Sowohl auf der Turnierübersicht als auch im Print-Export: keine S-U-N-Spalte mehr, stattdessen ein Erklärungstext zur Sortierung und Buchholz-Berechnung unter "Tabelle".
- [ ] **Step 5**: Kein Commit nötig (reine Verifikation). Bei gefundenen Bugs: neuen Task mit Fix + Test ergänzen, einzeln committen.
