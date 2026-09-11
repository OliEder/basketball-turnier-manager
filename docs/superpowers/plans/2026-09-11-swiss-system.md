# Schweizer-System-Turniermodus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Einen neuen Turniermodus `"swiss"` implementieren, mit dem ein Einstufungsturnier im Schweizer System ohne manuelle Tabellenführung oder Auslosung durchgeführt werden kann — inklusive Ergebniserfassung, Standings-Berechnung und Betriebssicherheits-Mechanismen (manuelle Paarung, Team-Ausfall, Ergebnis-Korrektur), die verhindern, dass das Tool den Turnierablauf blockiert.

**Architecture:** Neue reine Funktionsmodule (`standings.ts`, `swiss-pairing.ts`, `swiss-schedule.ts`) folgen dem bestehenden Muster von `playoff-generator.ts`/`game-duration.ts` (pure Funktionen, keine Store-Kopplung). Der Zustand lebt weiterhin zentral im bestehenden Zustand-Store (`tournament-store.ts`), erweitert um Swiss-spezifische Actions. Zwei neue Seiten (`SwissResultsPage`, `SwissOverviewPage`) nutzen bestehende UI-Komponenten (`GameRow`, `Alert`, `Button`) wieder, wo möglich.

**Tech Stack:** React, TypeScript, Zustand (Store), Vitest (Tests), bestehendes FBNM-Styling (Tailwind-Klassen aus bestehenden Komponenten übernehmen), React Router.

**Referenz-Spec:** `docs/superpowers/specs/2026-09-11-swiss-system-design.md`

---

## Wichtiger Hinweis zur Reihenfolge

Dieser Plan ist in sich abhängige Phasen gegliedert. Jede Phase endet in einem grünen Build (`npm run build` bzw. `npm test`). Innerhalb einer Phase bauen die Tasks aufeinander auf — bitte in Reihenfolge abarbeiten.

- **Phase 0:** Rename `breakBeforeFinalsMin` → `breakBetweenRoundsMin` (Grundlage für alles Weitere)
- **Phase 1:** Datenmodell-Erweiterungen (Types)
- **Phase 2:** Standings-Berechnung (`standings.ts`)
- **Phase 3:** Paarungslogik (`swiss-pairing.ts`)
- **Phase 4:** Zeitplan-Generierung (`swiss-schedule.ts` + Integration in `schedule-generator.ts`)
- **Phase 5:** Store-Actions (inkl. Betriebssicherheit: manuelle Paarung, Team-Ausfall, Korrektur)
- **Phase 6:** UI — Formular-Erweiterung, `SwissResultsPage`, `SwissOverviewPage`, Routing/Navigation
- **Phase 7:** Print-Export

---

## Phase 0: Rename `breakBeforeFinalsMin` → `breakBetweenRoundsMin`

### Task 0.1: Feld umbenennen im Typsystem und allen Verwendungsstellen

**Files:**
- Modify: `src/types/index.ts:29`
- Modify: `src/store/tournament-store.ts:14`
- Modify: `src/lib/playoff-generator.ts:92,117`
- Modify: `src/components/config/GameSettingsForm.tsx`
- Modify: `src/lib/schedule-generator.test.ts:21`
- Modify: `src/lib/playoff-generator.test.ts:11`
- Modify: `src/lib/storage.test.ts:13`

- [ ] **Step 1: Umbenennen in `src/types/index.ts`**

Zeile 29 ändern von:
```typescript
  breakBeforeFinalsMin: number    // extra pause between group stage and playoffs
```
zu:
```typescript
  breakBetweenRoundsMin: number   // pause between group stage and playoffs, and between swiss rounds
```

- [ ] **Step 2: Umbenennen in `src/store/tournament-store.ts`**

Zeile 14 ändern von `breakBeforeFinalsMin: 15,` zu `breakBetweenRoundsMin: 15,`

- [ ] **Step 3: Umbenennen in `src/lib/playoff-generator.ts`**

Zeile 92 und 117 (beide: `gameSettings.breakBeforeFinalsMin`) zu `gameSettings.breakBetweenRoundsMin` ändern.

- [ ] **Step 4: Label in `GameSettingsForm.tsx` ergänzen**

Lies zuerst den aktuellen Inhalt der Datei (bereits im Kontext vorhanden: 5 Eingabefelder in einem `grid grid-cols-2`). Füge nach dem `buffer`-Feld (Zeile 33-36) ein neues Feld hinzu:

```tsx
        <div className="space-y-1">
          <Label htmlFor="round-break">Pause zwischen Runden (Min)</Label>
          <Input id="round-break" type="number" min={0} max={60} value={gs.breakBetweenRoundsMin} onChange={numField('breakBetweenRoundsMin')} />
        </div>
```

(Dieses Feld existierte vorher nicht im Formular — `breakBeforeFinalsMin` war bisher nirgends im UI editierbar, nur im Store-Default. Jetzt wird es sichtbar, weil es sowohl für Playoffs als auch für Swiss-Runden gebraucht wird.)

- [ ] **Step 5: Test-Fixtures umbenennen**

In `src/lib/schedule-generator.test.ts:21`, `src/lib/playoff-generator.test.ts:11`, `src/lib/storage.test.ts:13`: `breakBeforeFinalsMin: 15` → `breakBetweenRoundsMin: 15` (bzw. den entsprechenden Wert in `storage.test.ts`, dort `breakBeforeFinalsMin: 15,` → `breakBetweenRoundsMin: 15,`).

- [ ] **Step 6: Build und Tests laufen lassen**

Run: `npm run build && npm test -- --run`
Expected: Build erfolgreich, alle bestehenden Tests grün (keine Referenz auf `breakBeforeFinalsMin` mehr im Code).

Verifiziere zusätzlich, dass kein Vorkommen mehr übrig ist:
Run: `grep -rn "breakBeforeFinalsMin" src/`
Expected: keine Treffer.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: rename breakBeforeFinalsMin to breakBetweenRoundsMin"
```

---

## Phase 1: Datenmodell-Erweiterungen

### Task 1.1: TournamentMode, TournamentConfig, Team, Game erweitern

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/types/index.test.ts`

- [ ] **Step 1: Typen erweitern**

In `src/types/index.ts`, `TournamentMode` (aktuell Zeile 41) ändern:
```typescript
export type TournamentMode = 'round-robin' | 'round-robin+finals' | 'swiss'
```

`TournamentConfig` (aktuell Zeilen 43-52) um `swissRounds` erweitern:
```typescript
export interface TournamentConfig {
  id: string
  name: string
  mode: TournamentMode
  finalsBracketSize?: 2 | 4  // only relevant when mode === 'round-robin+finals'; 4 = semifinals+final, 2 = final only
  swissRounds?: number       // only relevant when mode === 'swiss'; number of swiss rounds to play
  fields: number
  gameSettings: GameSettings
  venue: Venue
  teams: Team[]
}
```

`Team` (aktuell Zeilen 8-15) um `withdrawnAfterRound` erweitern:
```typescript
export interface Team {
  id: string
  name: string
  logoUrl: string
  color: string   // hex, e.g. "#004174"
  contact: string
  players: Player[]
  withdrawnAfterRound?: number  // set when the team withdrew mid-tournament (injury, etc.);
                                 // value = last round the team played normally
}
```

`GameStage` (aktuell Zeile 60) erweitern:
```typescript
export type GameStage = 'group' | 'semifinal' | 'final' | 'swiss'
```

`Game` (aktuell Zeilen 62-75) um `byeTeamId` und `cancelledReason` erweitern:
```typescript
export interface Game {
  id: string
  homeTeamId: string | null  // null = playoff slot not yet decided
  awayTeamId: string | null  // null = playoff slot not yet decided
  homeLabel?: string  // placeholder text shown when homeTeamId is null, e.g. "1. der Vorrunde"
  awayLabel?: string  // placeholder text shown when awayTeamId is null, e.g. "Sieger HF 1"
  stage: GameStage
  field: number          // 1-based; 0 = no real slot (bye)
  scheduledStart: string // "HH:MM"
  scheduledEnd: string   // "HH:MM"
  round: number
  gameNumber: number
  periodScores: PeriodScore[]
  byeTeamId?: string      // set instead of home/awayTeamId when this "game" is a bye
  cancelledReason?: 'withdrawal'  // set when the game was cancelled due to a team withdrawing
}
```

- [ ] **Step 2: Test für neue Typfelder ergänzen**

In `src/types/index.test.ts`, nach dem bestehenden `it('Game has periodScores array', ...)`-Block (endet Zeile 43) folgenden Test ergänzen:

```typescript
  it('Game supports bye and cancelled-due-to-withdrawal shape', () => {
    const bye: Game = {
      id: 'uuid-5',
      homeTeamId: null,
      awayTeamId: null,
      byeTeamId: 'uuid-1',
      stage: 'swiss',
      field: 0,
      scheduledStart: '10:00',
      scheduledEnd: '10:00',
      round: 2,
      gameNumber: 5,
      periodScores: [],
    }
    expect(bye.byeTeamId).toBe('uuid-1')

    const cancelled: Game = {
      id: 'uuid-6',
      homeTeamId: 'uuid-1',
      awayTeamId: 'uuid-2',
      stage: 'swiss',
      field: 1,
      scheduledStart: '10:00',
      scheduledEnd: '10:30',
      round: 3,
      gameNumber: 6,
      periodScores: [],
      cancelledReason: 'withdrawal',
    }
    expect(cancelled.cancelledReason).toBe('withdrawal')
  })

  it('Team supports withdrawnAfterRound', () => {
    const team: Team = {
      id: 'uuid-7',
      name: 'Team X',
      logoUrl: '',
      color: '#000',
      contact: '',
      players: [],
      withdrawnAfterRound: 2,
    }
    expect(team.withdrawnAfterRound).toBe(2)
  })
```

Ergänze den Import am Kopf der Datei um `Team`, falls noch nicht vorhanden (Zeile 2 ist bereits `import type { Team, Player, Game } from './index'` — kein Änderungsbedarf).

- [ ] **Step 3: Tests laufen lassen**

Run: `npm test -- --run src/types/index.test.ts`
Expected: alle Tests PASS (reine Typ-Shape-Tests, kein Verhalten zu testen).

- [ ] **Step 4: Build prüfen**

Run: `npm run build`
Expected: erfolgreich (keine Stelle im Code verwendet die neuen Felder noch falsch).

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/types/index.test.ts
git commit -m "feat: add swiss-mode fields to type system (swissRounds, byeTeamId, withdrawnAfterRound, cancelledReason)"
```

---

## Phase 2: Standings-Berechnung

### Task 2.1: `computeFinalScore`

**Files:**
- Create: `src/lib/standings.ts`
- Create: `src/lib/standings.test.ts`

- [ ] **Step 1: Fehlschlagenden Test schreiben**

```typescript
// src/lib/standings.test.ts
import { describe, it, expect } from 'vitest'
import { computeFinalScore } from './standings'
import type { Game } from '@/types'

const makeGame = (overrides: Partial<Game> = {}): Game => ({
  id: 'g1',
  homeTeamId: 't1',
  awayTeamId: 't2',
  stage: 'swiss',
  field: 1,
  scheduledStart: '10:00',
  scheduledEnd: '10:30',
  round: 1,
  gameNumber: 1,
  periodScores: [],
  ...overrides,
})

describe('computeFinalScore', () => {
  it('sums periodScores for home and away', () => {
    const game = makeGame({
      periodScores: [
        { period: 1, homeScore: 10, awayScore: 8 },
        { period: 2, homeScore: 12, awayScore: 14 },
      ],
    })
    expect(computeFinalScore(game)).toEqual({ home: 22, away: 22 })
  })

  it('throws when periodScores is empty (game not yet played)', () => {
    const game = makeGame({ periodScores: [] })
    expect(() => computeFinalScore(game)).toThrow('Spiel wurde noch nicht ausgewertet')
  })
})
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npm test -- --run src/lib/standings.test.ts`
Expected: FAIL — `Failed to resolve import "./standings"` (Datei existiert noch nicht).

- [ ] **Step 3: Minimale Implementierung**

```typescript
// src/lib/standings.ts
import type { Game } from '@/types'

export function computeFinalScore(game: Game): { home: number; away: number } {
  if (game.periodScores.length === 0) {
    throw new Error('Spiel wurde noch nicht ausgewertet')
  }
  return game.periodScores.reduce(
    (acc, p) => ({ home: acc.home + p.homeScore, away: acc.away + p.awayScore }),
    { home: 0, away: 0 },
  )
}
```

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/lib/standings.test.ts`
Expected: PASS (beide Tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/standings.ts src/lib/standings.test.ts
git commit -m "feat: add computeFinalScore to standings module"
```

### Task 2.2: `computeStandings` — Grundberechnung (Punkte, Bilanz, Korbdifferenz)

**Files:**
- Modify: `src/lib/standings.ts`
- Modify: `src/lib/standings.test.ts`

- [ ] **Step 1: Fehlschlagende Tests schreiben**

Am Ende von `src/lib/standings.test.ts` ergänzen:

```typescript
import { computeStandings } from './standings'
import type { Team } from '@/types'

const makeTeam = (id: string, overrides: Partial<Team> = {}): Team => ({
  id, name: id, logoUrl: '', color: '#000', contact: '', players: [], ...overrides,
})

describe('computeStandings', () => {
  it('awards 2 points for a win, 0 for a loss', () => {
    const teams = [makeTeam('t1'), makeTeam('t2')]
    const games = [
      makeGame({
        homeTeamId: 't1', awayTeamId: 't2', round: 1,
        periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }],
      }),
    ]
    const standings = computeStandings(teams, games, 1)
    const t1 = standings.find(s => s.teamId === 't1')!
    const t2 = standings.find(s => s.teamId === 't2')!
    expect(t1.points).toBe(2)
    expect(t1.wins).toBe(1)
    expect(t2.points).toBe(0)
    expect(t2.losses).toBe(1)
  })

  it('awards 1 point each for a draw', () => {
    const teams = [makeTeam('t1'), makeTeam('t2')]
    const games = [
      makeGame({
        homeTeamId: 't1', awayTeamId: 't2', round: 1,
        periodScores: [{ period: 1, homeScore: 15, awayScore: 15 }],
      }),
    ]
    const standings = computeStandings(teams, games, 1)
    expect(standings.find(s => s.teamId === 't1')!.points).toBe(1)
    expect(standings.find(s => s.teamId === 't2')!.points).toBe(1)
    expect(standings.find(s => s.teamId === 't1')!.draws).toBe(1)
  })

  it('computes pointsFor, pointsAgainst and pointsDiff', () => {
    const teams = [makeTeam('t1'), makeTeam('t2')]
    const games = [
      makeGame({
        homeTeamId: 't1', awayTeamId: 't2', round: 1,
        periodScores: [{ period: 1, homeScore: 20, awayScore: 12 }],
      }),
    ]
    const standings = computeStandings(teams, games, 1)
    const t1 = standings.find(s => s.teamId === 't1')!
    expect(t1.pointsFor).toBe(20)
    expect(t1.pointsAgainst).toBe(12)
    expect(t1.pointsDiff).toBe(8)
  })

  it('a bye awards 2 points and does not affect pointsFor/pointsAgainst', () => {
    const teams = [makeTeam('t1'), makeTeam('t2')]
    const games = [
      makeGame({
        homeTeamId: null, awayTeamId: null, byeTeamId: 't1', round: 1,
        field: 0, scheduledStart: '10:00', scheduledEnd: '10:00', periodScores: [],
      }),
    ]
    const standings = computeStandings(teams, games, 1)
    const t1 = standings.find(s => s.teamId === 't1')!
    expect(t1.points).toBe(2)
    expect(t1.hadBye).toBe(true)
    expect(t1.pointsFor).toBe(0)
    expect(t1.pointsAgainst).toBe(0)
  })

  it('only counts games up to and including throughRound', () => {
    const teams = [makeTeam('t1'), makeTeam('t2')]
    const games = [
      makeGame({
        homeTeamId: 't1', awayTeamId: 't2', round: 1,
        periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }],
      }),
      makeGame({
        id: 'g2', homeTeamId: 't2', awayTeamId: 't1', round: 2,
        periodScores: [{ period: 1, homeScore: 30, awayScore: 5 }],
      }),
    ]
    const standings = computeStandings(teams, games, 1)
    expect(standings.find(s => s.teamId === 't1')!.points).toBe(2)
  })

  it('sorts by points desc, then buchholz desc, then pointsDiff desc', () => {
    const teams = [makeTeam('t1'), makeTeam('t2'), makeTeam('t3')]
    const games = [
      makeGame({
        id: 'g1', homeTeamId: 't1', awayTeamId: 't2', round: 1,
        periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }],
      }),
      makeGame({
        id: 'g2', homeTeamId: 't3', awayTeamId: 't1', round: 2,
        periodScores: [{ period: 1, homeScore: 5, awayScore: 25 }],
      }),
    ]
    const standings = computeStandings(teams, games, 2)
    expect(standings[0].teamId).toBe('t1') // 4 points, clear leader
  })
})
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npm test -- --run src/lib/standings.test.ts`
Expected: FAIL — `computeStandings is not exported` / `is not a function`.

- [ ] **Step 3: Implementierung**

In `src/lib/standings.ts` ergänzen:

```typescript
import type { Game, Team } from '@/types'

export interface TeamStanding {
  teamId: string
  points: number
  wins: number
  draws: number
  losses: number
  pointsFor: number
  pointsAgainst: number
  pointsDiff: number
  buchholz: number
  hadBye: boolean
  withdrawn: boolean
}

function pointsForResult(home: number, away: number): [number, number] {
  if (home > away) return [2, 0]
  if (home < away) return [0, 2]
  return [1, 1]
}

export function computeStandings(teams: Team[], games: Game[], throughRound: number): TeamStanding[] {
  const relevantGames = games.filter(g => g.stage === 'swiss' && g.round <= throughRound)

  const base = new Map<string, TeamStanding>(
    teams.map(t => [t.id, {
      teamId: t.id,
      points: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointsDiff: 0,
      buchholz: 0,
      hadBye: false,
      withdrawn: t.withdrawnAfterRound != null,
    }]),
  )

  for (const game of relevantGames) {
    if (game.byeTeamId) {
      const s = base.get(game.byeTeamId)
      if (s) {
        s.points += 2
        s.hadBye = true
      }
      continue
    }
    if (game.cancelledReason === 'withdrawal' && game.homeTeamId && game.awayTeamId) {
      const withdrawingIsHome = base.get(game.homeTeamId)?.withdrawn
      const survivingTeamId = withdrawingIsHome ? game.awayTeamId : game.homeTeamId
      const survivor = base.get(survivingTeamId)
      if (survivor) {
        survivor.points += 2
        survivor.hadBye = true
      }
      continue
    }
    if (game.cancelledReason || !game.homeTeamId || !game.awayTeamId || game.periodScores.length === 0) {
      continue
    }
    const { home, away } = computeFinalScore(game)
    const [homePoints, awayPoints] = pointsForResult(home, away)
    const homeStanding = base.get(game.homeTeamId)
    const awayStanding = base.get(game.awayTeamId)
    if (homeStanding) {
      homeStanding.points += homePoints
      homeStanding.pointsFor += home
      homeStanding.pointsAgainst += away
      if (homePoints === 2) homeStanding.wins++
      else if (homePoints === 1) homeStanding.draws++
      else homeStanding.losses++
    }
    if (awayStanding) {
      awayStanding.points += awayPoints
      awayStanding.pointsFor += away
      awayStanding.pointsAgainst += home
      if (awayPoints === 2) awayStanding.wins++
      else if (awayPoints === 1) awayStanding.draws++
      else awayStanding.losses++
    }
  }

  for (const standing of base.values()) {
    standing.pointsDiff = standing.pointsFor - standing.pointsAgainst
  }

  for (const game of relevantGames) {
    if (game.byeTeamId) {
      const byeStanding = base.get(game.byeTeamId)
      if (byeStanding) byeStanding.buchholz += byeStanding.points
      continue
    }
    if (!game.homeTeamId || !game.awayTeamId || game.cancelledReason) continue
    const homeStanding = base.get(game.homeTeamId)
    const awayStanding = base.get(game.awayTeamId)
    if (homeStanding && awayStanding) {
      homeStanding.buchholz += awayStanding.points
      awayStanding.buchholz += homeStanding.points
    }
  }

  return [...base.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz
    return b.pointsDiff - a.pointsDiff
  })
}

export function computeFinalScore(game: Game): { home: number; away: number } {
  if (game.periodScores.length === 0) {
    throw new Error('Spiel wurde noch nicht ausgewertet')
  }
  return game.periodScores.reduce(
    (acc, p) => ({ home: acc.home + p.homeScore, away: acc.away + p.awayScore }),
    { home: 0, away: 0 },
  )
}
```

Hinweis: `computeFinalScore` steht jetzt nach `computeStandings` in der Datei — das ist funktional unerheblich in TypeScript (Funktionsdeklarationen werden gehoisted), aber achte darauf, die bereits bestehende Definition aus Task 2.1 nicht zu duplizieren; ersetze sie an ihrer ursprünglichen Stelle durch diese Version (identisch, keine Änderung nötig) oder lasse sie stehen und füge nur `computeStandings` und `TeamStanding` neu hinzu.

Die `cancelledReason === 'withdrawal'`-Sonderbehandlung ist hier bereits enthalten (wird in Phase 5 von `withdrawTeam` benötigt) — das ist bewusst vorgezogen, damit `standings.ts` nicht zweimal angefasst werden muss.

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/lib/standings.test.ts`
Expected: alle Tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/standings.ts src/lib/standings.test.ts
git commit -m "feat: compute swiss-system standings (points, bilanz, pointsDiff)"
```

### Task 2.3: Buchholz-Berechnung über mehrere Runden (inkl. Bye-Gegner)

**Files:**
- Modify: `src/lib/standings.test.ts`

Die Buchholz-Logik ist bereits in Task 2.2 implementiert (Summe der `points` aller Gegner, Bye-Gegner zählt mit dessen eigenem `points`-Wert). Dieser Task verifiziert das explizit mit einem dedizierten Test, da Buchholz das komplexeste Kriterium ist.

- [ ] **Step 1: Test schreiben**

Ergänze in `src/lib/standings.test.ts`:

```typescript
describe('computeStandings buchholz', () => {
  it('buchholz is the sum of points of all opponents played so far', () => {
    // t1 beats t2 (round 1), t1 beats t3 (round 2)
    // t2's points after round 2: 0 (round1 loss) + 2 (say t2 beats t4 round 2) = 2
    // t3's points after round 2: 0 (round 2 loss, no round 1 game)
    const teams = [makeTeam('t1'), makeTeam('t2'), makeTeam('t3'), makeTeam('t4')]
    const games = [
      makeGame({
        id: 'g1', homeTeamId: 't1', awayTeamId: 't2', round: 1,
        periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }],
      }),
      makeGame({
        id: 'g2', homeTeamId: 't3', awayTeamId: 't4', round: 1,
        periodScores: [{ period: 1, homeScore: 5, awayScore: 15 }],
      }),
      makeGame({
        id: 'g3', homeTeamId: 't1', awayTeamId: 't3', round: 2,
        periodScores: [{ period: 1, homeScore: 18, awayScore: 12 }],
      }),
      makeGame({
        id: 'g4', homeTeamId: 't2', awayTeamId: 't4', round: 2,
        periodScores: [{ period: 1, homeScore: 22, awayScore: 20 }],
      }),
    ]
    const standings = computeStandings(teams, games, 2)
    // t1's opponents: t2 (final points 2) + t3 (final points 0) = buchholz 2
    expect(standings.find(s => s.teamId === 't1')!.buchholz).toBe(2)
    // t3's opponents: t4 (final points 0) + t1 (final points 4) = buchholz 4
    expect(standings.find(s => s.teamId === 't3')!.buchholz).toBe(4)
  })

  it('a bye counts as an opponent worth the bye team\'s own points for buchholz', () => {
    const teams = [makeTeam('t1'), makeTeam('t2'), makeTeam('t3')]
    const games = [
      makeGame({
        id: 'g1', homeTeamId: 't1', awayTeamId: 't2', round: 1,
        periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }],
      }),
      makeGame({
        id: 'g2', homeTeamId: null, awayTeamId: null, byeTeamId: 't3', round: 1,
        field: 0, scheduledStart: '10:00', scheduledEnd: '10:00', periodScores: [],
      }),
    ]
    const standings = computeStandings(teams, games, 1)
    // t3 had a bye worth 2 points, so t3's own buchholz includes its own points from the bye
    expect(standings.find(s => s.teamId === 't3')!.buchholz).toBe(2)
  })
})
```

- [ ] **Step 2: Test ausführen**

Run: `npm test -- --run src/lib/standings.test.ts`
Expected: alle Tests PASS (Implementierung existiert bereits aus Task 2.2).

- [ ] **Step 3: Falls ein Test fehlschlägt, Implementierung korrigieren**

Falls der Bye-Buchholz-Test fehlschlägt: prüfe, dass die Bye-Buchholz-Schleife in `computeStandings` (Task 2.2, letzte Schleife) `byeStanding.buchholz += byeStanding.points` verwendet — das ist beabsichtigt (Bye zählt als "Gegner mit dem eigenen aktuellen Punktestand", analog Schach-Konvention).

- [ ] **Step 4: Commit**

```bash
git add src/lib/standings.test.ts
git commit -m "test: verify buchholz calculation across rounds including bye"
```

### Task 2.4: Ausgeschiedene Teams bleiben mit `withdrawn: true` in der Tabelle

**Files:**
- Modify: `src/lib/standings.test.ts`

- [ ] **Step 1: Test schreiben**

Ergänze in `src/lib/standings.test.ts`:

```typescript
describe('computeStandings withdrawn teams', () => {
  it('keeps a withdrawn team in the table with its past results and withdrawn: true', () => {
    const teams = [makeTeam('t1'), makeTeam('t2', { withdrawnAfterRound: 1 })]
    const games = [
      makeGame({
        homeTeamId: 't1', awayTeamId: 't2', round: 1,
        periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }],
      }),
    ]
    const standings = computeStandings(teams, games, 1)
    const t2 = standings.find(s => s.teamId === 't2')!
    expect(t2.withdrawn).toBe(true)
    expect(t2.points).toBe(0)
    expect(t2.pointsFor).toBe(10)
  })

  it('credits the surviving opponent when a game was cancelled due to withdrawal', () => {
    const teams = [makeTeam('t1'), makeTeam('t2', { withdrawnAfterRound: 1 })]
    const games = [
      makeGame({
        homeTeamId: 't1', awayTeamId: 't2', round: 2,
        periodScores: [], cancelledReason: 'withdrawal',
      }),
    ]
    const standings = computeStandings(teams, games, 2)
    expect(standings.find(s => s.teamId === 't1')!.points).toBe(2)
    expect(standings.find(s => s.teamId === 't2')!.points).toBe(0)
  })
})
```

- [ ] **Step 2: Test ausführen**

Run: `npm test -- --run src/lib/standings.test.ts`
Expected: PASS (Implementierung aus Task 2.2 setzt `withdrawn: t.withdrawnAfterRound != null` und die Stornierungs-Gutschrift bereits korrekt um).

- [ ] **Step 3: Commit**

```bash
git add src/lib/standings.test.ts
git commit -m "test: verify withdrawn teams remain in standings, opponent credited on cancellation"
```

---

## Phase 3: Paarungslogik

### Task 3.1: Runde 1 — zufällige Paarung

**Files:**
- Create: `src/lib/swiss-pairing.ts`
- Create: `src/lib/swiss-pairing.test.ts`

- [ ] **Step 1: Fehlschlagenden Test schreiben**

```typescript
// src/lib/swiss-pairing.test.ts
import { describe, it, expect } from 'vitest'
import { pairFirstSwissRound } from './swiss-pairing'

describe('pairFirstSwissRound', () => {
  it('pairs all teams exactly once with an even team count', () => {
    const teamIds = ['t1', 't2', 't3', 't4']
    const result = pairFirstSwissRound(teamIds)
    expect(result.pairs).toHaveLength(2)
    expect(result.byeTeamId).toBeUndefined()
    const paired = result.pairs.flat()
    expect(new Set(paired).size).toBe(4)
    for (const id of teamIds) expect(paired).toContain(id)
  })

  it('assigns exactly one bye with an odd team count', () => {
    const teamIds = ['t1', 't2', 't3']
    const result = pairFirstSwissRound(teamIds)
    expect(result.pairs).toHaveLength(1)
    expect(result.byeTeamId).toBeDefined()
    const paired = [...result.pairs.flat(), result.byeTeamId]
    expect(new Set(paired).size).toBe(3)
  })
})
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npm test -- --run src/lib/swiss-pairing.test.ts`
Expected: FAIL — Modul existiert nicht.

- [ ] **Step 3: Implementierung**

```typescript
// src/lib/swiss-pairing.ts
export interface SwissPairingResult {
  pairs: [string, string][]
  byeTeamId?: string
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function pairFirstSwissRound(teamIds: string[]): SwissPairingResult {
  const shuffled = shuffle(teamIds)
  let byeTeamId: string | undefined
  if (shuffled.length % 2 === 1) {
    byeTeamId = shuffled.pop()
  }
  const pairs: [string, string][] = []
  for (let i = 0; i < shuffled.length; i += 2) {
    pairs.push([shuffled[i], shuffled[i + 1]])
  }
  return { pairs, byeTeamId }
}
```

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/lib/swiss-pairing.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/swiss-pairing.ts src/lib/swiss-pairing.test.ts
git commit -m "feat: add random pairing for the first swiss round"
```

### Task 3.2: Folgerunden — Paarung nach Punktzahl ohne Wiederholung

**Files:**
- Modify: `src/lib/swiss-pairing.ts`
- Modify: `src/lib/swiss-pairing.test.ts`

- [ ] **Step 1: Fehlschlagende Tests schreiben**

Ergänze in `src/lib/swiss-pairing.test.ts`:

```typescript
import { pairNextSwissRound } from './swiss-pairing'
import type { TeamStanding } from './standings'

const makeStanding = (teamId: string, points: number, overrides: Partial<TeamStanding> = {}): TeamStanding => ({
  teamId, points, wins: 0, draws: 0, losses: 0,
  pointsFor: 0, pointsAgainst: 0, pointsDiff: 0, buchholz: 0,
  hadBye: false, withdrawn: false, ...overrides,
})

describe('pairNextSwissRound', () => {
  it('pairs teams with similar points, avoiding repeated pairings', () => {
    const standings = [
      makeStanding('t1', 4),
      makeStanding('t2', 4),
      makeStanding('t3', 2),
      makeStanding('t4', 2),
    ]
    // t1 already played t2 in a previous round
    const playedPairs = new Set(['t1|t2'])
    const result = pairNextSwissRound({ standings, playedPairs })
    expect(result.pairs).toHaveLength(2)
    const pairKeys = result.pairs.map(([a, b]) => [a, b].sort().join('|'))
    expect(pairKeys).not.toContain('t1|t2')
  })

  it('never repeats a pairing that has already been played', () => {
    const standings = [
      makeStanding('t1', 6),
      makeStanding('t2', 4),
      makeStanding('t3', 4),
      makeStanding('t4', 2),
    ]
    const playedPairs = new Set(['t1|t2', 't3|t4'])
    const result = pairNextSwissRound({ standings, playedPairs })
    const pairKeys = result.pairs.map(([a, b]) => [a, b].sort().join('|'))
    for (const key of pairKeys) {
      expect(playedPairs.has(key)).toBe(false)
    }
  })

  it('assigns the bye to the lowest-ranked team that has not had one yet', () => {
    const standings = [
      makeStanding('t1', 6),
      makeStanding('t2', 4),
      makeStanding('t3', 2, { hadBye: true }),
      makeStanding('t4', 0),
    ]
    const result = pairNextSwissRound({ standings, playedPairs: new Set() })
    expect(result.byeTeamId).toBe('t4')
  })

  it('excludes withdrawn teams from pairing', () => {
    const standings = [
      makeStanding('t1', 4),
      makeStanding('t2', 4, { withdrawn: true }),
      makeStanding('t3', 2),
      makeStanding('t4', 0),
    ]
    const result = pairNextSwissRound({ standings, playedPairs: new Set() })
    const paired = result.pairs.flat()
    expect(paired).not.toContain('t2')
  })

  it('backtracks to find a valid pairing when the greedy top-down attempt would fail', () => {
    // t1 has played t2 and t3 already; only t4 remains as a valid opponent for t1.
    // A naive greedy pass from the top could pair t2-t3 first, leaving t1 with no option.
    const standings = [
      makeStanding('t1', 4),
      makeStanding('t2', 4),
      makeStanding('t3', 2),
      makeStanding('t4', 2),
    ]
    const playedPairs = new Set(['t1|t2', 't1|t3'])
    const result = pairNextSwissRound({ standings, playedPairs })
    const pairKeys = result.pairs.map(([a, b]) => [a, b].sort().join('|'))
    expect(pairKeys).toContain('t1|t4')
    expect(pairKeys).toContain('t2|t3')
  })

  it('throws PairingConflictError when no valid pairing exists', () => {
    // With only 4 teams, if every possible pair has already been played, no valid round remains.
    const standings = [
      makeStanding('t1', 6),
      makeStanding('t2', 4),
      makeStanding('t3', 2),
      makeStanding('t4', 0),
    ]
    const playedPairs = new Set(['t1|t2', 't1|t3', 't1|t4', 't2|t3', 't2|t4', 't3|t4'])
    expect(() => pairNextSwissRound({ standings, playedPairs })).toThrow(
      'Keine gültige Paarung mehr möglich',
    )
  })
})
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npm test -- --run src/lib/swiss-pairing.test.ts`
Expected: FAIL — `pairNextSwissRound is not exported`.

- [ ] **Step 3: Implementierung**

Ergänze in `src/lib/swiss-pairing.ts`:

```typescript
import type { TeamStanding } from './standings'

export class PairingConflictError extends Error {}

export interface SwissPairingInput {
  standings: TeamStanding[]
  playedPairs: Set<string>
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|')
}

function backtrackPairs(pool: string[], playedPairs: Set<string>): [string, string][] | null {
  if (pool.length === 0) return []
  const [first, ...rest] = pool
  for (let i = 0; i < rest.length; i++) {
    const candidate = rest[i]
    if (playedPairs.has(pairKey(first, candidate))) continue
    const remaining = [...rest.slice(0, i), ...rest.slice(i + 1)]
    const subResult = backtrackPairs(remaining, playedPairs)
    if (subResult !== null) {
      return [[first, candidate], ...subResult]
    }
  }
  return null
}

export function pairNextSwissRound(input: SwissPairingInput): SwissPairingResult {
  const { standings, playedPairs } = input
  const active = standings.filter(s => !s.withdrawn)

  let byeTeamId: string | undefined
  let pool = active.map(s => s.teamId)

  if (pool.length % 2 === 1) {
    const byeCandidates = [...active].sort((a, b) => a.points - b.points)
    const chosen = byeCandidates.find(s => !s.hadBye) ?? byeCandidates[0]
    byeTeamId = chosen.teamId
    pool = pool.filter(id => id !== byeTeamId)
  }

  const result = backtrackPairs(pool, playedPairs)
  if (result === null) {
    throw new PairingConflictError('Keine gültige Paarung mehr möglich — zu viele Runden für die Teamanzahl')
  }

  return { pairs: result, byeTeamId }
}
```

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/lib/swiss-pairing.test.ts`
Expected: alle Tests PASS.

Hinweis zum Backtracking: `pool` ist bereits nach Punktzahl sortiert (Reihenfolge kommt aus `standings`, welches von `computeStandings` sortiert zurückgegeben wird). `backtrackPairs` probiert für das oberste Element der Restliste (`first`) alle Kandidaten in Reihenfolge durch — das entspricht "ähnliche Punktzahl bevorzugt, mit Fallback auf entferntere Kandidaten bei Konflikt", wie in der Spec beschrieben.

- [ ] **Step 5: Commit**

```bash
git add src/lib/swiss-pairing.ts src/lib/swiss-pairing.test.ts
git commit -m "feat: pair subsequent swiss rounds by standings with backtracking"
```

---

## Phase 4: Zeitplan-Generierung

### Task 4.1: `swiss-schedule.ts` — Runde-1-Spiele mit echten Team-IDs

**Files:**
- Create: `src/lib/swiss-schedule.ts`
- Create: `src/lib/swiss-schedule.test.ts`

- [ ] **Step 1: Fehlschlagenden Test schreiben**

```typescript
// src/lib/swiss-schedule.test.ts
import { describe, it, expect } from 'vitest'
import { generateSwissSchedule } from './swiss-schedule'
import type { GameSettings } from '@/types'

const gameSettings: GameSettings = {
  periodsCount: 4,
  periodDurationMin: 5,
  breakBetweenPeriodsMin: 1,
  halfTimeBreakMin: 5,
  bufferBetweenGamesMin: 5,
  breakBetweenRoundsMin: 15,
  awardCeremonyMin: 15,
}

describe('generateSwissSchedule', () => {
  it('round 1 games have real team IDs', () => {
    const result = generateSwissSchedule({
      teamIds: ['t1', 't2', 't3', 't4'],
      swissRounds: 3,
      fields: 2,
      gameSettings,
      blackoutPeriods: [],
      firstGameStart: '09:30',
      availabilityEnd: '19:30',
      startGameNumber: 1,
    })
    const round1Games = result.games.filter(g => g.round === 1)
    expect(round1Games).toHaveLength(2)
    for (const g of round1Games) {
      expect(g.homeTeamId).not.toBeNull()
      expect(g.awayTeamId).not.toBeNull()
      expect(g.stage).toBe('swiss')
    }
  })
})
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npm test -- --run src/lib/swiss-schedule.test.ts`
Expected: FAIL — Modul existiert nicht.

- [ ] **Step 3: Minimale Implementierung (nur Runde 1, feste Rundenanzahl kommt in Task 4.2)**

```typescript
// src/lib/swiss-schedule.ts
import { v4 as uuidv4 } from 'uuid'
import type { Game, GameSettings, TimeWindow } from '@/types'
import { calcGameDurationMin, addMinutes, findNextSlot } from './game-duration'
import { pairFirstSwissRound } from './swiss-pairing'

export interface SwissScheduleInput {
  teamIds: string[]
  swissRounds: number
  fields: number
  gameSettings: GameSettings
  blackoutPeriods: TimeWindow[]
  firstGameStart: string
  availabilityEnd: string
  startGameNumber: number
}

export interface SwissScheduleResult {
  games: Game[]
}

export function generateSwissSchedule(input: SwissScheduleInput): SwissScheduleResult {
  const { teamIds, fields, gameSettings, blackoutPeriods, firstGameStart, availabilityEnd, startGameNumber } = input
  const gameDuration = calcGameDurationMin(gameSettings)

  const { pairs, byeTeamId } = pairFirstSwissRound(teamIds)
  const games: Game[] = []
  let gameNumber = startGameNumber
  const fieldClocks = Array.from({ length: fields }, () => firstGameStart)

  for (let i = 0; i < pairs.length; i++) {
    const fieldIndex = i % fields
    const start = findNextSlot(fieldClocks[fieldIndex], gameDuration, blackoutPeriods, availabilityEnd)
    if (!start) {
      throw new Error('Zeitplan passt nicht in die verfügbare Hallenzeit — Rundenzahl reduzieren oder mehr Felder einplanen')
    }
    const end = addMinutes(start, gameDuration)
    games.push({
      id: uuidv4(),
      homeTeamId: pairs[i][0],
      awayTeamId: pairs[i][1],
      stage: 'swiss',
      field: fieldIndex + 1,
      scheduledStart: start,
      scheduledEnd: end,
      round: 1,
      gameNumber: gameNumber++,
      periodScores: [],
    })
    fieldClocks[fieldIndex] = addMinutes(end, gameSettings.bufferBetweenGamesMin)
  }

  if (byeTeamId) {
    games.push({
      id: uuidv4(),
      homeTeamId: null,
      awayTeamId: null,
      byeTeamId,
      stage: 'swiss',
      field: 0,
      scheduledStart: firstGameStart,
      scheduledEnd: firstGameStart,
      round: 1,
      gameNumber: gameNumber++,
      periodScores: [],
    })
  }

  return { games }
}
```

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/lib/swiss-schedule.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/swiss-schedule.ts src/lib/swiss-schedule.test.ts
git commit -m "feat: generate round-1 swiss games with real team assignments"
```

### Task 4.2: Runden 2..N mit Platzhaltern, alle Felder pro Runde ausgelastet

**Files:**
- Modify: `src/lib/swiss-schedule.ts`
- Modify: `src/lib/swiss-schedule.test.ts`

- [ ] **Step 1: Fehlschlagende Tests schreiben**

Ergänze in `src/lib/swiss-schedule.test.ts`:

```typescript
describe('generateSwissSchedule future rounds', () => {
  it('creates placeholder games for round 2+ with fixed time slots but no team IDs', () => {
    const result = generateSwissSchedule({
      teamIds: ['t1', 't2', 't3', 't4'],
      swissRounds: 3,
      fields: 2,
      gameSettings,
      blackoutPeriods: [],
      firstGameStart: '09:30',
      availabilityEnd: '19:30',
      startGameNumber: 1,
    })
    const round2Games = result.games.filter(g => g.round === 2)
    expect(round2Games).toHaveLength(2)
    for (const g of round2Games) {
      expect(g.homeTeamId).toBeNull()
      expect(g.awayTeamId).toBeNull()
      expect(g.homeLabel).toBe(`Runde 2 – Spiel ${round2Games.indexOf(g) + 1}`)
      expect(g.awayLabel).toBe(g.homeLabel)
    }
  })

  it('generates the correct total number of rounds', () => {
    const result = generateSwissSchedule({
      teamIds: ['t1', 't2', 't3', 't4'],
      swissRounds: 3,
      fields: 2,
      gameSettings,
      blackoutPeriods: [],
      firstGameStart: '09:30',
      availabilityEnd: '19:30',
      startGameNumber: 1,
    })
    const rounds = new Set(result.games.map(g => g.round))
    expect(rounds).toEqual(new Set([1, 2, 3]))
  })

  it('all fields are used in parallel per round, overflow games run sequentially', () => {
    // 5 teams, 1 bye -> 2 games per round; only 1 field -> games run sequentially within the round
    const result = generateSwissSchedule({
      teamIds: ['t1', 't2', 't3', 't4', 't5'],
      swissRounds: 1,
      fields: 1,
      gameSettings,
      blackoutPeriods: [],
      firstGameStart: '09:30',
      availabilityEnd: '19:30',
      startGameNumber: 1,
    })
    const round1Games = result.games.filter(g => g.round === 1 && g.field > 0)
    expect(round1Games).toHaveLength(2)
    const sorted = [...round1Games].sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))
    expect(sorted[1].scheduledStart >= sorted[0].scheduledEnd).toBe(true)
  })

  it('applies breakBetweenRoundsMin before the next round starts', () => {
    const result = generateSwissSchedule({
      teamIds: ['t1', 't2', 't3', 't4'],
      swissRounds: 2,
      fields: 2,
      gameSettings,
      blackoutPeriods: [],
      firstGameStart: '09:30',
      availabilityEnd: '19:30',
      startGameNumber: 1,
    })
    const round1End = Math.max(...result.games.filter(g => g.round === 1).map(g => {
      const [h, m] = g.scheduledEnd.split(':').map(Number)
      return h * 60 + m
    }))
    const round2Start = Math.min(...result.games.filter(g => g.round === 2).map(g => {
      const [h, m] = g.scheduledStart.split(':').map(Number)
      return h * 60 + m
    }))
    // bufferBetweenGamesMin (5) + breakBetweenRoundsMin (15) = 20
    expect(round2Start - round1End).toBe(20)
  })

  it('odd team count produces a bye entry with no field/time slot for every round', () => {
    const result = generateSwissSchedule({
      teamIds: ['t1', 't2', 't3'],
      swissRounds: 2,
      fields: 2,
      gameSettings,
      blackoutPeriods: [],
      firstGameStart: '09:30',
      availabilityEnd: '19:30',
      startGameNumber: 1,
    })
    const byes = result.games.filter(g => g.field === 0)
    expect(byes).toHaveLength(2) // one per round
  })

  it('throws when the schedule does not fit the available venue time', () => {
    expect(() =>
      generateSwissSchedule({
        teamIds: ['t1', 't2', 't3', 't4'],
        swissRounds: 20,
        fields: 1,
        gameSettings,
        blackoutPeriods: [],
        firstGameStart: '09:30',
        availabilityEnd: '10:00',
        startGameNumber: 1,
      })
    ).toThrow('Zeitplan passt nicht in die verfügbare Hallenzeit')
  })
})
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npm test -- --run src/lib/swiss-schedule.test.ts`
Expected: FAIL (Runde 2+ wird noch nicht generiert).

- [ ] **Step 3: Implementierung erweitern**

Ersetze den kompletten Inhalt von `src/lib/swiss-schedule.ts` mit:

```typescript
import { v4 as uuidv4 } from 'uuid'
import type { Game, GameSettings, TimeWindow } from '@/types'
import { calcGameDurationMin, addMinutes, findNextSlot, maxTime } from './game-duration'
import { pairFirstSwissRound } from './swiss-pairing'

export interface SwissScheduleInput {
  teamIds: string[]
  swissRounds: number
  fields: number
  gameSettings: GameSettings
  blackoutPeriods: TimeWindow[]
  firstGameStart: string
  availabilityEnd: string
  startGameNumber: number
}

export interface SwissScheduleResult {
  games: Game[]
}

function scheduleRoundSlots(
  slotCount: number,
  fields: number,
  gameDuration: number,
  bufferMin: number,
  blackoutPeriods: TimeWindow[],
  availabilityEnd: string,
  roundStart: string,
): { starts: string[]; roundEnd: string } {
  const fieldClocks = Array.from({ length: fields }, () => roundStart)
  const starts: string[] = []
  let roundEnd = roundStart

  for (let i = 0; i < slotCount; i++) {
    const fieldIndex = i % fields
    const start = findNextSlot(fieldClocks[fieldIndex], gameDuration, blackoutPeriods, availabilityEnd)
    if (!start) {
      throw new Error('Zeitplan passt nicht in die verfügbare Hallenzeit — Rundenzahl reduzieren oder mehr Felder einplanen')
    }
    const end = addMinutes(start, gameDuration)
    starts.push(start)
    fieldClocks[fieldIndex] = addMinutes(end, bufferMin)
    roundEnd = maxTime(roundEnd, end)
  }

  return { starts, roundEnd }
}

export function generateSwissSchedule(input: SwissScheduleInput): SwissScheduleResult {
  const { teamIds, swissRounds, fields, gameSettings, blackoutPeriods, firstGameStart, availabilityEnd, startGameNumber } = input
  const gameDuration = calcGameDurationMin(gameSettings)
  const games: Game[] = []
  let gameNumber = startGameNumber

  const { pairs: round1Pairs, byeTeamId: round1Bye } = pairFirstSwissRound(teamIds)
  const slotsNeeded = round1Pairs.length
  const { starts, roundEnd } = scheduleRoundSlots(
    slotsNeeded, fields, gameDuration, gameSettings.bufferBetweenGamesMin,
    blackoutPeriods, availabilityEnd, firstGameStart,
  )

  for (let i = 0; i < round1Pairs.length; i++) {
    games.push({
      id: uuidv4(),
      homeTeamId: round1Pairs[i][0],
      awayTeamId: round1Pairs[i][1],
      stage: 'swiss',
      field: (i % fields) + 1,
      scheduledStart: starts[i],
      scheduledEnd: addMinutes(starts[i], gameDuration),
      round: 1,
      gameNumber: gameNumber++,
      periodScores: [],
    })
  }
  if (round1Bye) {
    games.push({
      id: uuidv4(),
      homeTeamId: null,
      awayTeamId: null,
      byeTeamId: round1Bye,
      stage: 'swiss',
      field: 0,
      scheduledStart: firstGameStart,
      scheduledEnd: firstGameStart,
      round: 1,
      gameNumber: gameNumber++,
      periodScores: [],
    })
  }

  let previousRoundEnd = roundEnd
  const gamesPerFutureRound = Math.floor(teamIds.length / 2)
  const hasByeEachRound = teamIds.length % 2 === 1

  for (let round = 2; round <= swissRounds; round++) {
    const roundStart = addMinutes(previousRoundEnd, gameSettings.bufferBetweenGamesMin + gameSettings.breakBetweenRoundsMin)
    const { starts: roundStarts, roundEnd: thisRoundEnd } = scheduleRoundSlots(
      gamesPerFutureRound, fields, gameDuration, gameSettings.bufferBetweenGamesMin,
      blackoutPeriods, availabilityEnd, roundStart,
    )

    for (let i = 0; i < gamesPerFutureRound; i++) {
      const label = `Runde ${round} – Spiel ${i + 1}`
      games.push({
        id: uuidv4(),
        homeTeamId: null,
        awayTeamId: null,
        homeLabel: label,
        awayLabel: label,
        stage: 'swiss',
        field: (i % fields) + 1,
        scheduledStart: roundStarts[i],
        scheduledEnd: addMinutes(roundStarts[i], gameDuration),
        round,
        gameNumber: gameNumber++,
        periodScores: [],
      })
    }
    if (hasByeEachRound) {
      games.push({
        id: uuidv4(),
        homeTeamId: null,
        awayTeamId: null,
        stage: 'swiss',
        field: 0,
        scheduledStart: roundStart,
        scheduledEnd: roundStart,
        round,
        gameNumber: gameNumber++,
        periodScores: [],
      })
    }

    previousRoundEnd = thisRoundEnd
  }

  return { games }
}
```

Hinweis: Der Platzhalter-Bye-Eintrag für Runden 2+ hat noch kein `byeTeamId` (das Team steht ja noch nicht fest) — er wird erst beim `advanceSwissRound` in Phase 5 mit dem tatsächlichen Bye-Team befüllt, analog zu den Team-Platzhaltern. Er ist an `field === 0 && !byeTeamId` erkennbar, bis er befüllt wird.

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/lib/swiss-schedule.test.ts`
Expected: alle Tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/swiss-schedule.ts src/lib/swiss-schedule.test.ts
git commit -m "feat: generate placeholder slots for swiss rounds 2+ with full field utilization"
```

### Task 4.3: Integration in `schedule-generator.ts`

**Files:**
- Modify: `src/lib/schedule-generator.ts`
- Modify: `src/lib/schedule-generator.test.ts`

- [ ] **Step 1: Fehlschlagenden Test schreiben**

Ergänze am Ende von `src/lib/schedule-generator.test.ts`:

```typescript
describe('generateSchedule with swiss mode', () => {
  it('generates a swiss schedule when mode is swiss', () => {
    const config: TournamentConfig = {
      ...baseConfig,
      mode: 'swiss',
      swissRounds: 2,
    }
    const schedule = generateSchedule(config)
    const rounds = new Set(schedule.games.map(g => g.round))
    expect(rounds).toEqual(new Set([1, 2]))
    expect(schedule.games.every(g => g.stage === 'swiss')).toBe(true)
  })

  it('does not set awardCeremonyEstimate for swiss mode', () => {
    const config: TournamentConfig = {
      ...baseConfig,
      mode: 'swiss',
      swissRounds: 2,
    }
    const schedule = generateSchedule(config)
    expect(schedule.awardCeremonyEstimate).toBeUndefined()
  })
})
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npm test -- --run src/lib/schedule-generator.test.ts`
Expected: FAIL (aktuell generiert `generateSchedule` bei `mode === 'swiss'` weiterhin nur Round-Robin, da kein Sonderfall existiert).

- [ ] **Step 3: `generateSchedule` erweitern**

In `src/lib/schedule-generator.ts`, Import ergänzen (Zeile 4):
```typescript
import { generatePlayoffGames } from './playoff-generator'
import { generateSwissSchedule } from './swiss-schedule'
```

Die Funktion `generateSchedule` (aktuell Zeilen 17-113) am Anfang um eine Verzweigung für `mode === 'swiss'` erweitern. Ersetze den Beginn der Funktion (ab `export function generateSchedule` bis vor `if (config.mode === 'round-robin+finals')`, das sind Zeilen 17-79) mit:

```typescript
export function generateSchedule(config: TournamentConfig): Schedule {
  const { teams, fields, gameSettings, venue } = config

  const venueOpen = venue.availabilityWindows[0]?.start ?? '09:00'
  const venueClose = venue.availabilityWindows[0]?.end ?? '20:00'
  const firstGameStart = addMinutes(venueOpen, venue.setupBufferMin)
  const availabilityEnd = addMinutes(venueClose, -venue.teardownBufferMin)

  if (config.mode === 'swiss') {
    const { games } = generateSwissSchedule({
      teamIds: teams.map(t => t.id),
      swissRounds: config.swissRounds ?? Math.max(1, Math.ceil(Math.log2(teams.length || 1))),
      fields,
      gameSettings,
      blackoutPeriods: venue.blackoutPeriods,
      firstGameStart,
      availabilityEnd,
      startGameNumber: 1,
    })
    const lastEnd = games.reduce((max, g) => (g.scheduledEnd > max ? g.scheduledEnd : max), '00:00')
    const firstStart = games[0]?.scheduledStart ?? firstGameStart
    return {
      id: uuidv4(),
      tournamentId: config.id,
      generatedAt: new Date().toISOString(),
      games,
      totalDurationMin: timeToMinutes(lastEnd) - timeToMinutes(firstStart),
      estimatedEnd: lastEnd,
    }
  }

  const gameDuration = calcGameDurationMin(gameSettings)
  const slotDuration = gameDuration + gameSettings.bufferBetweenGamesMin

  // Field clocks: track when each field is next free
  const fieldNextFree: string[] = Array.from({ length: fields }, () => firstGameStart)
  // Team clocks: track when each team is next free (a team can't play two games at once)
  const teamNextFree = new Map<string, string>()

  const pairs = generateRoundRobinPairs(teams.map(t => t.id))
  const games: Game[] = []
  let gameNumber = 1
```

Der Rest der Funktion (die Round-Robin-Schleife, der `round-robin+finals`-Block, und die abschließende Rückgabe) bleibt **unverändert** — er ist bereits nach diesem eingefügten Block vorhanden (vorher Zeilen 80-113, jetzt entsprechend verschoben). Prüfe nach dem Einfügen, dass keine doppelten `const`-Deklarationen für `venueOpen`, `venueClose`, `firstGameStart`, `availabilityEnd` übrig bleiben (diese wurden im obigen Block bereits nach oben gezogen — die alten Zeilen, die sie erneut deklarierten, müssen entfernt sein).

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/lib/schedule-generator.test.ts`
Expected: alle Tests PASS (inkl. der bereits bestehenden Round-Robin- und Playoff-Tests, die durch die Umstellung nicht beeinflusst werden dürfen).

- [ ] **Step 5: Vollen Testlauf + Build prüfen**

Run: `npm test -- --run && npm run build`
Expected: alle Tests grün, Build erfolgreich.

- [ ] **Step 6: Commit**

```bash
git add src/lib/schedule-generator.ts src/lib/schedule-generator.test.ts
git commit -m "feat: wire swiss mode into generateSchedule"
```

---

## Phase 5: Store-Actions

### Task 5.1: `submitGameResult` und abgeleiteter `currentSwissRound`

**Files:**
- Modify: `src/store/tournament-store.ts`
- Create: `src/store/tournament-store.test.ts`

- [ ] **Step 1: Fehlschlagenden Test schreiben**

```typescript
// src/store/tournament-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useTournamentStore } from './tournament-store'
import { clearAll } from '@/lib/storage'
import type { Team } from '@/types'

function setupSwissTournament(teamCount: number, swissRounds: number) {
  const store = useTournamentStore.getState()
  store.setMode('swiss')
  for (let i = 1; i <= teamCount; i++) {
    store.addTeam({ name: `Team ${i}`, logoUrl: '', color: '#000', contact: '' })
  }
  useTournamentStore.setState(s => ({
    tournament: { ...s.tournament, swissRounds, teams: s.tournament.teams.slice(-teamCount) },
  }))
  store.generateAndSaveSchedule()
}

beforeEach(() => {
  clearAll()
  useTournamentStore.setState({
    tournament: {
      id: 't1', name: 'Test', mode: 'round-robin', fields: 2,
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
  })
})

describe('submitGameResult', () => {
  it('writes periodScores onto the game', () => {
    setupSwissTournament(4, 2)
    const { schedule, submitGameResult } = useTournamentStore.getState()
    const game = schedule!.games.find(g => g.round === 1)!
    submitGameResult(game.id, [{ period: 1, homeScore: 20, awayScore: 15 }])
    const updated = useTournamentStore.getState().schedule!.games.find(g => g.id === game.id)!
    expect(updated.periodScores).toEqual([{ period: 1, homeScore: 20, awayScore: 15 }])
  })

  it('throws when the game is still a placeholder without real team IDs', () => {
    setupSwissTournament(4, 2)
    const { schedule, submitGameResult } = useTournamentStore.getState()
    const placeholder = schedule!.games.find(g => g.round === 2)!
    expect(() => submitGameResult(placeholder.id, [{ period: 1, homeScore: 10, awayScore: 5 }])).toThrow(
      'Spiel hat noch keine feststehenden Teams',
    )
  })
})
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npm test -- --run src/store/tournament-store.test.ts`
Expected: FAIL — `submitGameResult is not a function`.

- [ ] **Step 3: Store erweitern**

In `src/store/tournament-store.ts`:

Zeile 3 Import erweitern:
```typescript
import type { TournamentConfig, Team, Schedule, GameSettings, Venue, PeriodScore, Game } from '@/types'
```

Interface `TournamentStore` (Zeilen 37-56) um neue Actions erweitern — füge nach `updateGameTime` (Zeile 53) ein:
```typescript
  submitGameResult: (gameId: string, periodScores: PeriodScore[]) => void
```

Implementierung nach `updateGameTime` (nach Zeile 154, vor `loadFromStorage`) ergänzen:
```typescript
  submitGameResult: (gameId, periodScores) => {
    const { schedule } = get()
    if (!schedule) return
    const game = schedule.games.find(g => g.id === gameId)
    if (!game) return
    if (!game.homeTeamId || !game.awayTeamId) {
      throw new Error('Spiel hat noch keine feststehenden Teams')
    }
    const updatedGames = schedule.games.map(g =>
      g.id === gameId ? { ...g, periodScores } : g
    )
    const updated = { ...schedule, games: updatedGames }
    set({ schedule: updated })
    saveSchedule(updated)
  },
```

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/store/tournament-store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/tournament-store.ts src/store/tournament-store.test.ts
git commit -m "feat: add submitGameResult store action"
```

### Task 5.2: `currentSwissRound`-Hilfsfunktion und `advanceSwissRound`

**Files:**
- Modify: `src/store/tournament-store.ts`
- Modify: `src/store/tournament-store.test.ts`

- [ ] **Step 1: Fehlschlagende Tests schreiben**

Ergänze in `src/store/tournament-store.test.ts`:

```typescript
import { getCurrentSwissRound } from './tournament-store'

describe('getCurrentSwissRound', () => {
  it('returns the highest round number that has real team assignments', () => {
    setupSwissTournament(4, 3)
    const { schedule } = useTournamentStore.getState()
    expect(getCurrentSwissRound(schedule!.games)).toBe(1)
  })
})

describe('advanceSwissRound', () => {
  it('fills in the next round once all games of the current round have results', () => {
    setupSwissTournament(4, 2)
    const { schedule, submitGameResult, advanceSwissRound } = useTournamentStore.getState()
    const round1Games = schedule!.games.filter(g => g.round === 1 && g.field > 0)
    for (const g of round1Games) {
      submitGameResult(g.id, [{ period: 1, homeScore: 20, awayScore: 10 }])
    }
    advanceSwissRound()
    const round2Games = useTournamentStore.getState().schedule!.games.filter(g => g.round === 2)
    expect(round2Games.every(g => g.homeTeamId !== null)).toBe(true)
  })

  it('throws when the current round is not fully evaluated', () => {
    setupSwissTournament(4, 2)
    const { advanceSwissRound } = useTournamentStore.getState()
    expect(() => advanceSwissRound()).toThrow('Runde ist noch nicht vollständig ausgewertet')
  })
})
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npm test -- --run src/store/tournament-store.test.ts`
Expected: FAIL — `getCurrentSwissRound`/`advanceSwissRound` fehlen.

- [ ] **Step 3: Implementierung**

In `src/store/tournament-store.ts` Import erweitern:
```typescript
import { computeStandings } from '@/lib/standings'
import { pairNextSwissRound, PairingConflictError } from '@/lib/swiss-pairing'
```

(`PairingConflictError` wird hier re-exportiert genutzt — die UI importiert ihn später direkt aus `@/lib/swiss-pairing`, nicht über den Store.)

Nach den bestehenden Imports, vor `const DEFAULT_GAME_SETTINGS`, exportierte Hilfsfunktionen ergänzen:
```typescript
export function getCurrentSwissRound(games: Game[]): number {
  const decided = games.filter(g =>
    g.stage === 'swiss' && (g.homeTeamId !== null || g.byeTeamId !== undefined)
  )
  if (decided.length === 0) return 0
  return Math.max(...decided.map(g => g.round))
}

function isRoundFullyEvaluated(games: Game[], round: number): boolean {
  const roundGames = games.filter(g => g.stage === 'swiss' && g.round === round)
  return roundGames.every(g =>
    g.byeTeamId !== undefined || g.cancelledReason || g.periodScores.length > 0
  )
}
```

Interface `TournamentStore` um weitere Actions erweitern (nach `submitGameResult`):
```typescript
  advanceSwissRound: () => void
  advanceSwissRoundManually: (pairs: [string, string][], byeTeamId?: string) => void
```

(`advanceSwissRoundManually` wird bereits hier im Interface ergänzt, auch wenn die Implementierung erst in Task 5.3 folgt — das Interface einmal komplett zu deklarieren vermeidet einen weiteren Diff an derselben Stelle.)

Implementierung nach `submitGameResult` ergänzen:
```typescript
  advanceSwissRound: () => {
    const { schedule, tournament } = get()
    if (!schedule) return
    const currentRound = getCurrentSwissRound(schedule.games)
    if (!isRoundFullyEvaluated(schedule.games, currentRound)) {
      throw new Error('Runde ist noch nicht vollständig ausgewertet')
    }
    const standings = computeStandings(tournament.teams, schedule.games, currentRound)
    const playedPairs = new Set(
      schedule.games
        .filter(g => g.homeTeamId && g.awayTeamId)
        .map(g => [g.homeTeamId!, g.awayTeamId!].sort().join('|'))
    )
    const pairingResult = pairNextSwissRound({ standings, playedPairs })
    applySwissPairing(set, get, currentRound + 1, pairingResult.pairs, pairingResult.byeTeamId)
  },

  advanceSwissRoundManually: (pairs, byeTeamId) => {
    const { schedule } = get()
    if (!schedule) return
    const currentRound = getCurrentSwissRound(schedule.games)
    if (!isRoundFullyEvaluated(schedule.games, currentRound)) {
      throw new Error('Runde ist noch nicht vollständig ausgewertet')
    }
    applySwissPairing(set, get, currentRound + 1, pairs, byeTeamId)
  },
```

(`advanceSwissRoundManually` wird funktional erst in Task 5.3 getestet, aber da sie dieselbe Hilfsfunktion `applySwissPairing` nutzt wie `advanceSwissRound`, ist es einfacher, beide hier zusammen zu implementieren. `PairingConflictError`, ausgelöst innerhalb von `pairNextSwissRound`, wird bewusst **nicht** hier abgefangen — sie propagiert zum Aufrufer (der UI-Komponente in Task 6.4), die sie gezielt behandelt.)

Nach der `advanceSwissRound`/`advanceSwissRoundManually`-Implementierung, aber außerhalb des `create<TournamentStore>((set, get) => ({ ... }))`-Aufrufs, eine Hilfsfunktion `applySwissPairing` ergänzen (damit sie von beiden Actions gemeinsam genutzt werden kann). Füge sie **vor** `export const useTournamentStore = create<TournamentStore>(...)` ein:

```typescript
function applySwissPairing(
  set: (fn: (s: TournamentStore) => Partial<TournamentStore>) => void,
  get: () => TournamentStore,
  round: number,
  pairs: [string, string][],
  byeTeamId: string | undefined,
): void {
  const { schedule } = get()
  if (!schedule) return
  const placeholders = schedule.games.filter(g => g.stage === 'swiss' && g.round === round)
  const teamSlots = placeholders.filter(g => g.field > 0)
  const byeSlot = placeholders.find(g => g.field === 0)

  const updatedGames = schedule.games.map(g => {
    const slotIndex = teamSlots.indexOf(g)
    if (slotIndex !== -1 && pairs[slotIndex]) {
      return { ...g, homeTeamId: pairs[slotIndex][0], awayTeamId: pairs[slotIndex][1], homeLabel: undefined, awayLabel: undefined }
    }
    if (byeSlot && g.id === byeSlot.id && byeTeamId) {
      return { ...g, byeTeamId }
    }
    return g
  })

  const updated = { ...schedule, games: updatedGames }
  set(() => ({ schedule: updated }))
  saveSchedule(updated)
}
```

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/store/tournament-store.test.ts`
Expected: alle Tests PASS.

- [ ] **Step 5: Vollen Testlauf + Build prüfen**

Run: `npm test -- --run && npm run build`
Expected: alle Tests grün, Build erfolgreich.

- [ ] **Step 6: Commit**

```bash
git add src/store/tournament-store.ts src/store/tournament-store.test.ts
git commit -m "feat: add advanceSwissRound and advanceSwissRoundManually store actions"
```

### Task 5.3: Betriebssicherheit — `advanceSwissRoundManually` verifizieren

**Files:**
- Modify: `src/store/tournament-store.test.ts`

Die Implementierung von `advanceSwissRoundManually` existiert bereits aus Task 5.2 (dort zusammen mit `advanceSwissRound` implementiert, da beide dieselbe `applySwissPairing`-Hilfsfunktion teilen). Dieser Task ergänzt die dedizierten Tests dafür.

- [ ] **Step 1: Tests schreiben**

Ergänze in `src/store/tournament-store.test.ts`:

```typescript
describe('advanceSwissRoundManually', () => {
  it('applies manually specified pairs instead of running the algorithm', () => {
    setupSwissTournament(4, 2)
    const { schedule, submitGameResult, advanceSwissRoundManually } = useTournamentStore.getState()
    const round1Games = schedule!.games.filter(g => g.round === 1 && g.field > 0)
    for (const g of round1Games) {
      submitGameResult(g.id, [{ period: 1, homeScore: 20, awayScore: 10 }])
    }
    const teamIds = useTournamentStore.getState().tournament.teams.map(t => t.id)
    const manualPairs: [string, string][] = [[teamIds[0], teamIds[3]], [teamIds[1], teamIds[2]]]
    advanceSwissRoundManually(manualPairs)
    const round2Games = useTournamentStore.getState().schedule!.games.filter(g => g.round === 2 && g.field > 0)
    const assignedPairs = round2Games.map(g => [g.homeTeamId, g.awayTeamId])
    expect(assignedPairs).toEqual(manualPairs)
  })

  it('still requires the current round to be fully evaluated', () => {
    setupSwissTournament(4, 2)
    const { advanceSwissRoundManually } = useTournamentStore.getState()
    expect(() => advanceSwissRoundManually([['t1', 't2']])).toThrow('Runde ist noch nicht vollständig ausgewertet')
  })
})
```

- [ ] **Step 2: Test ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/store/tournament-store.test.ts`
Expected: alle Tests PASS (Implementierung existiert bereits).

- [ ] **Step 3: Commit**

```bash
git add src/store/tournament-store.test.ts
git commit -m "test: verify advanceSwissRoundManually applies manual pairs and enforces preconditions"
```

### Task 5.4: Betriebssicherheit — `withdrawTeam`

**Files:**
- Modify: `src/store/tournament-store.ts`
- Modify: `src/store/tournament-store.test.ts`

- [ ] **Step 1: Fehlschlagende Tests schreiben**

Ergänze in `src/store/tournament-store.test.ts`:

```typescript
import { computeStandings } from '@/lib/standings'

describe('withdrawTeam', () => {
  it('marks the team as withdrawn but keeps past results', () => {
    setupSwissTournament(4, 2)
    const { schedule, submitGameResult, withdrawTeam } = useTournamentStore.getState()
    const round1Games = schedule!.games.filter(g => g.round === 1 && g.field > 0)
    for (const g of round1Games) {
      submitGameResult(g.id, [{ period: 1, homeScore: 20, awayScore: 10 }])
    }
    const teamIdToWithdraw = round1Games[0].homeTeamId!
    withdrawTeam(teamIdToWithdraw)
    const team = useTournamentStore.getState().tournament.teams.find(t => t.id === teamIdToWithdraw)!
    expect(team.withdrawnAfterRound).toBe(1)
    const playedGame = useTournamentStore.getState().schedule!.games.find(g => g.id === round1Games[0].id)!
    expect(playedGame.periodScores).toEqual([{ period: 1, homeScore: 20, awayScore: 10 }])
  })

  it('cancels an open game in the current round and credits the opponent', () => {
    setupSwissTournament(4, 2)
    const { schedule, submitGameResult, withdrawTeam } = useTournamentStore.getState()
    const round1Games = schedule!.games.filter(g => g.round === 1 && g.field > 0)
    // Only submit results for one game, leave the other open
    submitGameResult(round1Games[0].id, [{ period: 1, homeScore: 20, awayScore: 10 }])
    const openGame = round1Games[1]
    const teamToWithdraw = openGame.homeTeamId!
    const opponent = openGame.awayTeamId!
    withdrawTeam(teamToWithdraw)
    const updatedGame = useTournamentStore.getState().schedule!.games.find(g => g.id === openGame.id)!
    expect(updatedGame.cancelledReason).toBe('withdrawal')
    const standings = computeStandings(
      useTournamentStore.getState().tournament.teams,
      useTournamentStore.getState().schedule!.games,
      1,
    )
    expect(standings.find(s => s.teamId === opponent)!.points).toBe(2)
  })

  it('removes surplus placeholder slots in not-yet-drawn future rounds', () => {
    // 4 teams, 2 games per future round. After one team withdraws, only 3 active
    // teams remain, so future rounds only need 1 game (+ 1 bye) instead of 2 games.
    setupSwissTournament(4, 3)
    const { schedule, submitGameResult, withdrawTeam } = useTournamentStore.getState()
    const round1Games = schedule!.games.filter(g => g.round === 1 && g.field > 0)
    for (const g of round1Games) {
      submitGameResult(g.id, [{ period: 1, homeScore: 20, awayScore: 10 }])
    }
    const teamToWithdraw = round1Games[0].homeTeamId!
    withdrawTeam(teamToWithdraw)
    const round2Games = useTournamentStore.getState().schedule!.games.filter(g => g.round === 2 && g.field > 0)
    const round2Byes = useTournamentStore.getState().schedule!.games.filter(g => g.round === 2 && g.field === 0)
    expect(round2Games).toHaveLength(1)
    expect(round2Byes).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npm test -- --run src/store/tournament-store.test.ts`
Expected: FAIL — `withdrawTeam is not a function`.

- [ ] **Step 3: Implementierung**

Interface `TournamentStore` ergänzen:
```typescript
  withdrawTeam: (teamId: string) => void
```

Implementierung ergänzen. Die Stornierungs-Gutschrift in `computeStandings` (`cancelledReason === 'withdrawal'`) wurde bereits in Task 2.2 mit implementiert. Neben dem Markieren der aktuellen Runde muss `withdrawTeam` außerdem noch nicht ausgeloste künftige Runden anpassen: laut Spec ändert sich die Zahl der Plätze pro künftiger Runde von `floor(teams.length / 2)` auf `floor(activeTeams.length / 2)`, überzählige Platzhalter-Slots werden entfernt (das betrifft nur Runden, die noch keine echten Team-Zuweisungen haben, d.h. `round > currentRound`).

```typescript
  withdrawTeam: (teamId) => {
    const { schedule, tournament } = get()
    if (!schedule) return
    const currentRound = getCurrentSwissRound(schedule.games)

    const gamesAfterCancellation = schedule.games.map(g => {
      if (g.round !== currentRound || g.stage !== 'swiss') return g
      const involvesWithdrawing = g.homeTeamId === teamId || g.awayTeamId === teamId
      if (involvesWithdrawing && g.periodScores.length === 0) {
        return { ...g, cancelledReason: 'withdrawal' as const }
      }
      return g
    })

    const activeTeamCount = tournament.teams.filter(t => t.id === teamId ? false : !t.withdrawnAfterRound).length
    const gamesPerFutureRound = Math.floor(activeTeamCount / 2)
    const needsByeEachRound = activeTeamCount % 2 === 1

    const updatedGames = gamesAfterCancellation.filter(g => {
      if (g.stage !== 'swiss' || g.round <= currentRound) return true
      const slotsInRound = gamesAfterCancellation.filter(x => x.stage === 'swiss' && x.round === g.round)
      const teamSlotsInRound = slotsInRound.filter(x => x.field > 0)
      const byeSlotsInRound = slotsInRound.filter(x => x.field === 0)
      if (g.field > 0) {
        const indexInRound = teamSlotsInRound.indexOf(g)
        return indexInRound < gamesPerFutureRound
      }
      const byeIndexInRound = byeSlotsInRound.indexOf(g)
      return needsByeEachRound ? byeIndexInRound < 1 : false
    })

    const updatedTeams = tournament.teams.map(t =>
      t.id === teamId ? { ...t, withdrawnAfterRound: currentRound } : t
    )

    const updatedSchedule = { ...schedule, games: updatedGames }
    const updatedTournament = { ...tournament, teams: updatedTeams }
    set({ schedule: updatedSchedule, tournament: updatedTournament })
    saveSchedule(updatedSchedule)
    saveTournament(updatedTournament)
  },
```

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/store/tournament-store.test.ts src/lib/standings.test.ts`
Expected: alle Tests PASS (die `computeStandings`-Stornierungslogik wurde bereits in Task 2.2/2.4 verifiziert).

- [ ] **Step 5: Vollen Testlauf + Build prüfen**

Run: `npm test -- --run && npm run build`
Expected: alle Tests grün, Build erfolgreich.

- [ ] **Step 6: Commit**

```bash
git add src/store/tournament-store.ts src/store/tournament-store.test.ts
git commit -m "feat: add withdrawTeam action, cancel open games and credit opponent"
```

### Task 5.5: Betriebssicherheit — `correctGameResult`

**Files:**
- Modify: `src/store/tournament-store.ts`
- Modify: `src/store/tournament-store.test.ts`

- [ ] **Step 1: Fehlschlagende Tests schreiben**

Ergänze in `src/store/tournament-store.test.ts`:

```typescript
describe('correctGameResult', () => {
  it('allows correcting a result before the next round has any result', () => {
    setupSwissTournament(4, 2)
    const { schedule, submitGameResult, correctGameResult } = useTournamentStore.getState()
    const game = schedule!.games.filter(g => g.round === 1 && g.field > 0)[0]
    submitGameResult(game.id, [{ period: 1, homeScore: 20, awayScore: 10 }])
    correctGameResult(game.id, [{ period: 1, homeScore: 18, awayScore: 22 }])
    const updated = useTournamentStore.getState().schedule!.games.find(g => g.id === game.id)!
    expect(updated.periodScores).toEqual([{ period: 1, homeScore: 18, awayScore: 22 }])
  })

  it('throws once the next round already has a result', () => {
    setupSwissTournament(4, 2)
    const { schedule, submitGameResult, advanceSwissRound, correctGameResult } = useTournamentStore.getState()
    const round1Games = schedule!.games.filter(g => g.round === 1 && g.field > 0)
    for (const g of round1Games) {
      submitGameResult(g.id, [{ period: 1, homeScore: 20, awayScore: 10 }])
    }
    advanceSwissRound()
    const round2Game = useTournamentStore.getState().schedule!.games.filter(g => g.round === 2 && g.field > 0)[0]
    useTournamentStore.getState().submitGameResult(round2Game.id, [{ period: 1, homeScore: 15, awayScore: 12 }])
    expect(() =>
      correctGameResult(round1Games[0].id, [{ period: 1, homeScore: 5, awayScore: 30 }])
    ).toThrow('Ergebnis kann nicht mehr korrigiert werden')
  })
})
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npm test -- --run src/store/tournament-store.test.ts`
Expected: FAIL — `correctGameResult is not a function`.

- [ ] **Step 3: Implementierung**

Interface `TournamentStore` ergänzen:
```typescript
  correctGameResult: (gameId: string, periodScores: PeriodScore[]) => void
```

Implementierung ergänzen:
```typescript
  correctGameResult: (gameId, periodScores) => {
    const { schedule } = get()
    if (!schedule) return
    const game = schedule.games.find(g => g.id === gameId)
    if (!game) return
    const nextRoundHasResult = schedule.games.some(
      g => g.stage === 'swiss' && g.round === game.round + 1 && g.periodScores.length > 0
    )
    if (nextRoundHasResult) {
      throw new Error('Ergebnis kann nicht mehr korrigiert werden — die nächste Runde wurde bereits ausgewertet')
    }
    const updatedGames = schedule.games.map(g =>
      g.id === gameId ? { ...g, periodScores } : g
    )
    const updated = { ...schedule, games: updatedGames }
    set({ schedule: updated })
    saveSchedule(updated)
  },
```

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/store/tournament-store.test.ts`
Expected: alle Tests PASS.

- [ ] **Step 5: Vollen Testlauf + Build prüfen**

Run: `npm test -- --run && npm run build`
Expected: alle Tests grün, Build erfolgreich.

- [ ] **Step 6: Commit**

```bash
git add src/store/tournament-store.ts src/store/tournament-store.test.ts
git commit -m "feat: add correctGameResult action, locked once next round has a result"
```

### Task 5.6: `setSwissRounds` Store-Action

**Files:**
- Modify: `src/store/tournament-store.ts`
- Modify: `src/store/tournament-store.test.ts`

- [ ] **Step 1: Fehlschlagenden Test schreiben**

Ergänze in `src/store/tournament-store.test.ts`:

```typescript
describe('setSwissRounds', () => {
  it('updates swissRounds on the tournament', () => {
    const { setSwissRounds } = useTournamentStore.getState()
    setSwissRounds(4)
    expect(useTournamentStore.getState().tournament.swissRounds).toBe(4)
  })
})
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npm test -- --run src/store/tournament-store.test.ts`
Expected: FAIL — `setSwissRounds is not a function`.

- [ ] **Step 3: Implementierung**

Interface ergänzen:
```typescript
  setSwissRounds: (rounds: number) => void
```

`setMode` (Zeilen 67-76) erweitern, damit beim Wechsel zu `swiss` ein Default für `swissRounds` gesetzt wird:

```typescript
  setMode: (mode) => {
    set(s => ({
      tournament: {
        ...s.tournament,
        mode,
        finalsBracketSize: mode === 'round-robin+finals' ? (s.tournament.finalsBracketSize ?? 4) : s.tournament.finalsBracketSize,
        swissRounds: mode === 'swiss'
          ? (s.tournament.swissRounds ?? Math.max(1, Math.ceil(Math.log2(s.tournament.teams.length || 1))))
          : s.tournament.swissRounds,
      },
    }))
    saveTournament(get().tournament)
  },
```

Neue Action ergänzen (nach `setFinalsBracketSize`):
```typescript
  setSwissRounds: (rounds) => {
    set(s => ({ tournament: { ...s.tournament, swissRounds: rounds } }))
    saveTournament(get().tournament)
  },
```

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/store/tournament-store.test.ts`
Expected: PASS.

- [ ] **Step 5: Vollen Testlauf + Build prüfen**

Run: `npm test -- --run && npm run build`
Expected: alle Tests grün, Build erfolgreich.

- [ ] **Step 6: Commit**

```bash
git add src/store/tournament-store.ts src/store/tournament-store.test.ts
git commit -m "feat: add setSwissRounds action with log2-based default"
```

---

## Phase 6: UI

### Task 6.1: `TournamentForm.tsx` — Swiss-Modus-Option und Rundenzahl-Eingabe

**Files:**
- Modify: `src/components/config/TournamentForm.tsx`
- Read first: `src/components/ui/alert.tsx` (Props prüfen)

- [ ] **Step 1: Alert-Komponente auf unterstützte Props prüfen**

Lies `src/components/ui/alert.tsx` und notiere, ob ein `variant`-Prop existiert. Passe Step 2 entsprechend an: falls kein `variant`-Prop existiert, das Prop in den unten stehenden Codeblöcken weglassen und stattdessen bedingt eine zusätzliche `className` (z.B. `text-red-600` bei Nichtpassen) auf `AlertDescription` setzen.

- [ ] **Step 2: Modus-Option ergänzen**

In `src/components/config/TournamentForm.tsx`, `SelectContent` des Modus-Selects (Zeilen 27-30) erweitern:

```tsx
          <SelectContent>
            <SelectItem value="round-robin">Jeder gegen Jeden</SelectItem>
            <SelectItem value="round-robin+finals">Jeder gegen Jeden + Finale</SelectItem>
            <SelectItem value="swiss">Einstufungsturnier (Schweizer System)</SelectItem>
          </SelectContent>
```

- [ ] **Step 3: Rundenzahl-Eingabe mit Gesamtdauer-Hinweis ergänzen**

Import erweitern (Zeile 1-5):
```tsx
import { useTournamentStore } from '@/store/tournament-store'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { calcGameDurationMin, timeToMinutes, addMinutes } from '@/lib/game-duration'
import type { TournamentMode } from '@/types'
```

Store-Destrukturierung (Zeile 8) erweitern:
```tsx
  const { tournament, setTournamentName, setMode, setFields, setFinalsBracketSize, setSwissRounds } = useTournamentStore()
```

Nach dem `finalsBracketSize`-Block (Zeilen 33-49) einen neuen Block für `swiss` einfügen:

```tsx
      {tournament.mode === 'swiss' && (
        <div className="space-y-1">
          <Label htmlFor="swiss-rounds">Anzahl Runden</Label>
          <Input
            id="swiss-rounds"
            type="number"
            min={1}
            value={tournament.swissRounds ?? Math.max(1, Math.ceil(Math.log2(tournament.teams.length || 1)))}
            onChange={e => setSwissRounds(Number(e.target.value))}
          />
          {(() => {
            const rounds = tournament.swissRounds ?? Math.max(1, Math.ceil(Math.log2(tournament.teams.length || 1)))
            const gameDuration = calcGameDurationMin(tournament.gameSettings)
            const gamesPerRound = Math.floor(tournament.teams.length / 2)
            const roundsWorthOfSlots = Math.max(1, Math.ceil(gamesPerRound / tournament.fields))
            const roundDurationMin = roundsWorthOfSlots * (gameDuration + tournament.gameSettings.bufferBetweenGamesMin)
            const totalMin = rounds * roundDurationMin + (rounds - 1) * tournament.gameSettings.breakBetweenRoundsMin
            const venueOpen = tournament.venue.availabilityWindows[0]?.start ?? '09:00'
            const venueClose = tournament.venue.availabilityWindows[0]?.end ?? '20:00'
            const firstStart = addMinutes(venueOpen, tournament.venue.setupBufferMin)
            const availabilityEnd = addMinutes(venueClose, -tournament.venue.teardownBufferMin)
            const fitsInVenue = timeToMinutes(firstStart) + totalMin <= timeToMinutes(availabilityEnd)
            return (
              <Alert>
                <AlertDescription className={fitsInVenue ? '' : 'text-red-600'}>
                  Geschätzte Gesamtdauer: {totalMin} Minuten.
                  {!fitsInVenue && ' Das passt nicht in die verfügbare Hallenzeit — Rundenzahl reduzieren oder mehr Felder einplanen.'}
                </AlertDescription>
              </Alert>
            )
          })()}
        </div>
      )}
```

(Diese Version verwendet bewusst kein `variant`-Prop auf `Alert`, sondern eine bedingte `className` auf `AlertDescription`, um unabhängig vom tatsächlichen Prop-Angebot der bestehenden `Alert`-Komponente zu funktionieren. Falls `alert.tsx` doch ein `variant`-Prop unterstützt, kann optional `variant={fitsInVenue ? 'default' : 'destructive'}` zusätzlich ergänzt werden — nicht zwingend für die Funktion.)

- [ ] **Step 4: Manuell im Browser prüfen**

Run: `npm run dev` (falls noch nicht laufend)

Öffne die Konfigurationsseite, wähle "Einstufungsturnier (Schweizer System)" im Modus-Select, füge mindestens 2 Teams über die Team-Seite hinzu, und prüfe:
- Das Rundenzahl-Feld erscheint mit einem sinnvollen Default.
- Der Hinweistext mit der Gesamtdauer erscheint und aktualisiert sich beim Ändern der Rundenzahl.

- [ ] **Step 5: Build prüfen**

Run: `npm run build`
Expected: erfolgreich.

- [ ] **Step 6: Commit**

```bash
git add src/components/config/TournamentForm.tsx
git commit -m "feat: add swiss mode option and round-count input to tournament form"
```

### Task 6.2: `SwissResultsPage` — Grundgerüst mit Score-Eingabe

**Files:**
- Create: `src/pages/SwissResultsPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/AppShell.tsx`
- Read first: `src/components/ui/button.tsx` (Props prüfen)

- [ ] **Step 1: Button-Komponente auf unterstützte Props prüfen**

Lies `src/components/ui/button.tsx` und notiere, ob `size`- und `variant`-Props existieren. Passe die folgenden Code-Beispiele entsprechend an (Props weglassen, falls nicht unterstützt).

- [ ] **Step 2: Seite erstellen**

```tsx
// src/pages/SwissResultsPage.tsx
import { useState } from 'react'
import { useTournamentStore, getCurrentSwissRound } from '@/store/tournament-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function SwissResultsPage() {
  const { tournament, schedule, submitGameResult, advanceSwissRound } = useTournamentStore()
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>({})
  const [error, setError] = useState<string | null>(null)

  if (!schedule) {
    return (
      <Alert>
        <AlertDescription>Bitte zuerst einen Zeitplan generieren (Seite „Konfiguration“).</AlertDescription>
      </Alert>
    )
  }

  const displayRound = getCurrentSwissRound(schedule.games) || 1
  const roundGames = schedule.games.filter(g => g.stage === 'swiss' && g.round === displayRound)
  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))
  const totalRounds = tournament.swissRounds ?? 1
  const allEvaluated = roundGames.every(
    g => g.byeTeamId !== undefined || g.cancelledReason || g.periodScores.length > 0
  )
  const tournamentFinished = displayRound >= totalRounds && allEvaluated

  const handleSubmit = (gameId: string) => {
    const entry = scores[gameId]
    if (!entry) return
    const home = Number(entry.home)
    const away = Number(entry.away)
    submitGameResult(gameId, [{ period: 1, homeScore: home, awayScore: away }])
  }

  const handleAdvance = () => {
    setError(null)
    try {
      advanceSwissRound()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg uppercase">
        Runde {displayRound} von {totalRounds}
      </h2>

      {error && (
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="border border-border rounded-md p-4 bg-card space-y-3">
        {roundGames.map(game => {
          if (game.byeTeamId) {
            return (
              <div key={game.id} className="text-sm text-muted-foreground">
                Freilos: {teamMap.get(game.byeTeamId)?.name ?? '?'}
              </div>
            )
          }
          const home = game.homeTeamId ? teamMap.get(game.homeTeamId)?.name ?? '?' : game.homeLabel ?? '?'
          const away = game.awayTeamId ? teamMap.get(game.awayTeamId)?.name ?? '?' : game.awayLabel ?? '?'
          const hasResult = game.periodScores.length > 0
          return (
            <div key={game.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
              <span className="text-sm font-mono w-8 text-center bg-tint rounded-sm px-1">F{game.field}</span>
              <span className="flex-1 font-medium">{home} vs {away}</span>
              {hasResult ? (
                <span className="text-sm text-muted-foreground">
                  {game.periodScores[0].homeScore} : {game.periodScores[0].awayScore}
                </span>
              ) : (
                <>
                  <Input
                    type="number"
                    className="w-16"
                    aria-label={`Ergebnis Heim, Spiel ${game.gameNumber}`}
                    onChange={e => setScores(s => ({ ...s, [game.id]: { home: e.target.value, away: s[game.id]?.away ?? '' } }))}
                  />
                  <span>:</span>
                  <Input
                    type="number"
                    className="w-16"
                    aria-label={`Ergebnis Auswärts, Spiel ${game.gameNumber}`}
                    onChange={e => setScores(s => ({ ...s, [game.id]: { home: s[game.id]?.home ?? '', away: e.target.value } }))}
                  />
                  <Button onClick={() => handleSubmit(game.id)}>Speichern</Button>
                </>
              )}
            </div>
          )
        })}
      </div>

      {tournamentFinished ? (
        <Alert>
          <AlertDescription>Turnier abgeschlossen. Siehe Turnierübersicht für das Endergebnis.</AlertDescription>
        </Alert>
      ) : (
        <Button onClick={handleAdvance} disabled={!allEvaluated}>
          Nächste Runde auslosen
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Routing ergänzen**

In `src/App.tsx`, Import ergänzen:
```tsx
import SwissResultsPage from '@/pages/SwissResultsPage'
```

Route ergänzen (nach `schedule`):
```tsx
          <Route path="swiss-results" element={<SwissResultsPage />} />
```

- [ ] **Step 4: Navigation ergänzen**

In `src/components/layout/AppShell.tsx`, `navItems` bedingt um den Swiss-Eintrag erweitern. Da `navItems` aktuell eine statische Konstante außerhalb der Komponente ist (Zeilen 4-9), muss sie in die Komponente verschoben werden, um auf den Store zuzugreifen:

Ersetze den kompletten Dateiinhalt mit:
```tsx
import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useTournamentStore } from '@/store/tournament-store'

export default function AppShell() {
  const { tournament } = useTournamentStore()
  const isSwiss = tournament.mode === 'swiss'

  const navItems = [
    { to: '/teams', label: 'Teams' },
    { to: '/config', label: 'Konfiguration' },
    ...(isSwiss
      ? [
          { to: '/swiss-results', label: 'Ergebnisse erfassen' },
          { to: '/swiss-overview', label: 'Turnierübersicht' },
        ]
      : [{ to: '/schedule', label: 'Zeitplan' }]),
    { to: '/export', label: 'Export' },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-brand-primary-dark text-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-6">
          <span className="font-display text-lg uppercase tracking-tight">
            FBNM Turniermanager
          </span>
          <nav className="flex gap-1">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'px-3 py-1.5 rounded-sm text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-accent text-brand-primary-dark'
                      : 'text-white/80 hover:text-white hover:bg-white/10',
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
```

(`/swiss-overview`-Route wird in Task 6.3 ergänzt — bis dahin führt der Link ins Leere, was für den Zwischenstand dieses Tasks akzeptabel ist, da beide Tasks in derselben Phase kurz hintereinander folgen.)

- [ ] **Step 5: Build prüfen**

Run: `npm run build`
Expected: erfolgreich (auch wenn `/swiss-overview` noch keine Route hat — React Router wirft dafür keinen Build-Fehler, nur eine Runtime-404, die in Task 6.3 behoben wird).

- [ ] **Step 6: Manuell im Browser prüfen**

Run: `npm run dev`

Wechsle den Turniermodus auf "Einstufungsturnier", füge 4 Teams hinzu, generiere den Zeitplan (Konfigurationsseite oder eine vorläufige Aktion — falls keine UI-Aktion existiert, in der Browser-Konsole `useTournamentStore.getState().generateAndSaveSchedule()` aufrufen). Navigiere zu "Ergebnisse erfassen" und prüfe:
- Runde 1 zeigt echte Team-Namen.
- Ergebniseingabe funktioniert, "Speichern" schreibt das Ergebnis.
- Nach allen Ergebnissen wird "Nächste Runde auslosen" aktiv.

- [ ] **Step 7: Commit**

```bash
git add src/pages/SwissResultsPage.tsx src/App.tsx src/components/layout/AppShell.tsx
git commit -m "feat: add SwissResultsPage for round-by-round result entry"
```

### Task 6.3: `SwissOverviewPage` — Tabelle + vollständiger Zeitplan

**Files:**
- Create: `src/pages/SwissOverviewPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Seite erstellen**

```tsx
// src/pages/SwissOverviewPage.tsx
import { useTournamentStore } from '@/store/tournament-store'
import { computeStandings } from '@/lib/standings'
import { Alert, AlertDescription } from '@/components/ui/alert'
import GameRow from '@/components/schedule/GameRow'

export default function SwissOverviewPage() {
  const { tournament, schedule } = useTournamentStore()

  if (!schedule) {
    return (
      <Alert>
        <AlertDescription>Bitte zuerst einen Zeitplan generieren (Seite „Konfiguration“).</AlertDescription>
      </Alert>
    )
  }

  const totalRounds = tournament.swissRounds ?? 1
  const standings = computeStandings(tournament.teams, schedule.games, totalRounds)
  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))
  const rounds = [...new Set(schedule.games.map(g => g.round))].sort((a, b) => a - b)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg uppercase mb-2">Tabelle</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-sm text-muted-foreground border-b border-border">
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">Team</th>
              <th className="py-1 pr-2">Pkt</th>
              <th className="py-1 pr-2">Buchholz</th>
              <th className="py-1 pr-2">Diff</th>
              <th className="py-1 pr-2">S-U-N</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <tr key={s.teamId} className="border-b border-border last:border-0">
                <td className="py-1 pr-2">{i + 1}</td>
                <td className="py-1 pr-2 font-medium">
                  {teamMap.get(s.teamId)?.name ?? '?'}
                  {s.withdrawn && <span className="text-muted-foreground text-xs ml-1">(ausgeschieden)</span>}
                </td>
                <td className="py-1 pr-2">{s.points}</td>
                <td className="py-1 pr-2">{s.buchholz}</td>
                <td className="py-1 pr-2">{s.pointsDiff > 0 ? '+' : ''}{s.pointsDiff}</td>
                <td className="py-1 pr-2">{s.wins}-{s.draws}-{s.losses}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="font-display text-lg uppercase mb-2">Zeitplan</h2>
        {rounds.map(round => (
          <div key={round} className="mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground mb-1">Runde {round}</h3>
            <div className="border border-border rounded-md p-4 bg-card">
              {schedule.games
                .filter(g => g.round === round && g.field > 0)
                .map(game => <GameRow key={game.id} game={game} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Routing ergänzen**

In `src/App.tsx`:
```tsx
import SwissOverviewPage from '@/pages/SwissOverviewPage'
```
```tsx
          <Route path="swiss-overview" element={<SwissOverviewPage />} />
```

- [ ] **Step 3: Build prüfen**

Run: `npm run build`
Expected: erfolgreich.

- [ ] **Step 4: Manuell im Browser prüfen**

Run: `npm run dev`

Navigiere zu "Turnierübersicht" und prüfe:
- Tabelle zeigt alle Teams mit Punkten/Buchholz/Diff, initial alle 0.
- Zeitplan zeigt alle Runden gruppiert, Runde 2+ mit Platzhalter-Labels (`GameRow` sollte diese bereits über den bestehenden Fallback korrekt anzeigen).
- Nachdem in "Ergebnisse erfassen" ein Ergebnis eingetragen wurde, aktualisiert sich die Tabelle beim erneuten Besuch dieser Seite.

- [ ] **Step 5: Commit**

```bash
git add src/pages/SwissOverviewPage.tsx src/App.tsx
git commit -m "feat: add SwissOverviewPage with standings table and full schedule"
```

### Task 6.4: Manueller Paarungsdialog (Betriebssicherheit)

**Files:**
- Modify: `src/pages/SwissResultsPage.tsx`

- [ ] **Step 1: Dialog-State und Fehlerbehandlung ergänzen**

In `src/pages/SwissResultsPage.tsx`, Import erweitern:
```tsx
import { useState } from 'react'
import { useTournamentStore, getCurrentSwissRound } from '@/store/tournament-store'
import { PairingConflictError } from '@/lib/swiss-pairing'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
```

Store-Destrukturierung erweitern:
```tsx
  const { tournament, schedule, submitGameResult, advanceSwissRound, advanceSwissRoundManually } = useTournamentStore()
```

`handleAdvance` anpassen, um `PairingConflictError` gezielt abzufangen und einen Paarungsdialog zu öffnen. Ersetze die bestehende `handleAdvance`-Definition:

```tsx
  const [manualPairingNeeded, setManualPairingNeeded] = useState(false)
  const [manualAssignments, setManualAssignments] = useState<Record<string, string>>({})

  const handleAdvance = () => {
    setError(null)
    try {
      advanceSwissRound()
    } catch (err) {
      if (err instanceof PairingConflictError) {
        setManualPairingNeeded(true)
      } else {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
  }

  const activeTeams = tournament.teams.filter(t => !t.withdrawnAfterRound)

  const handleManualPair = (teamId: string, opponentId: string) => {
    setManualAssignments(a => ({ ...a, [teamId]: opponentId, [opponentId]: teamId }))
  }

  const handleManualSubmit = () => {
    const seen = new Set<string>()
    const pairs: [string, string][] = []
    for (const [a, b] of Object.entries(manualAssignments)) {
      if (seen.has(a) || seen.has(b)) continue
      pairs.push([a, b])
      seen.add(a)
      seen.add(b)
    }
    advanceSwissRoundManually(pairs)
    setManualPairingNeeded(false)
    setManualAssignments({})
  }
```

Im JSX, nach dem "Nächste Runde auslosen"-Button, den manuellen Dialog bedingt einblenden:

```tsx
      {manualPairingNeeded && (
        <div className="border border-border rounded-md p-4 bg-card space-y-3">
          <p className="text-sm font-medium">
            Automatische Paarung nicht möglich — bitte Paarungen für die nächste Runde manuell zuweisen.
          </p>
          {activeTeams.map(team => (
            <div key={team.id} className="flex items-center gap-3">
              <span className="w-32 text-sm">{team.name}</span>
              <select
                className="border border-border rounded-sm px-2 py-1 text-sm"
                value={manualAssignments[team.id] ?? ''}
                onChange={e => handleManualPair(team.id, e.target.value)}
              >
                <option value="">– Gegner wählen –</option>
                {activeTeams.filter(t => t.id !== team.id).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          ))}
          <Button onClick={handleManualSubmit}>Paarungen übernehmen</Button>
        </div>
      )}
```

- [ ] **Step 2: Build prüfen**

Run: `npm run build`
Expected: erfolgreich.

- [ ] **Step 3: Manuell im Browser prüfen**

Ein Pairing-Conflict lässt sich leicht mit 4 Teams und 5 Swiss-Runden provozieren (siehe Spec-Grenzfall). Setze `swissRounds` entsprechend hoch, spiele alle Runden mit immer gleichen Ergebnissen durch, bis der Konflikt auftritt, und prüfe, dass der manuelle Dialog erscheint und funktioniert.

- [ ] **Step 4: Commit**

```bash
git add src/pages/SwissResultsPage.tsx
git commit -m "feat: add manual pairing dialog for pairing-conflict fallback"
```

### Task 6.5: "Team ausgeschieden"-Button und Ergebnis-Korrektur-UI

**Files:**
- Modify: `src/pages/SwissResultsPage.tsx`

- [ ] **Step 1: `withdrawTeam` und `correctGameResult` einbinden**

Store-Destrukturierung erweitern:
```tsx
  const { tournament, schedule, submitGameResult, advanceSwissRound, advanceSwissRoundManually, withdrawTeam, correctGameResult } = useTournamentStore()
```

State für Korrektur-Modus ergänzen:
```tsx
  const [correctingGameId, setCorrectingGameId] = useState<string | null>(null)
```

Im Rendering jedes Spiels (innerhalb der `roundGames.map`-Schleife), den Ergebnis-Anzeige-/Eingabe-Bereich um Korrektur und "ausgeschieden"-Buttons erweitern. Ersetze den kompletten bedingten Block ab `{hasResult ? (` bis zum schließenden `)}` dieses Ausdrucks mit:

```tsx
              {hasResult && correctingGameId !== game.id ? (
                <>
                  <span className="text-sm text-muted-foreground">
                    {game.periodScores[0].homeScore} : {game.periodScores[0].awayScore}
                  </span>
                  <Button onClick={() => setCorrectingGameId(game.id)}>
                    Korrigieren
                  </Button>
                </>
              ) : !hasResult ? (
                <>
                  <Input
                    type="number"
                    className="w-16"
                    aria-label={`Ergebnis Heim, Spiel ${game.gameNumber}`}
                    onChange={e => setScores(s => ({ ...s, [game.id]: { home: e.target.value, away: s[game.id]?.away ?? '' } }))}
                  />
                  <span>:</span>
                  <Input
                    type="number"
                    className="w-16"
                    aria-label={`Ergebnis Auswärts, Spiel ${game.gameNumber}`}
                    onChange={e => setScores(s => ({ ...s, [game.id]: { home: s[game.id]?.home ?? '', away: e.target.value } }))}
                  />
                  <Button onClick={() => handleSubmit(game.id)}>Speichern</Button>
                </>
              ) : (
                <>
                  <Input
                    type="number"
                    className="w-16"
                    defaultValue={game.periodScores[0].homeScore}
                    aria-label={`Korrigiertes Ergebnis Heim, Spiel ${game.gameNumber}`}
                    onChange={e => setScores(s => ({ ...s, [game.id]: { home: e.target.value, away: s[game.id]?.away ?? String(game.periodScores[0].awayScore) } }))}
                  />
                  <span>:</span>
                  <Input
                    type="number"
                    className="w-16"
                    defaultValue={game.periodScores[0].awayScore}
                    aria-label={`Korrigiertes Ergebnis Auswärts, Spiel ${game.gameNumber}`}
                    onChange={e => setScores(s => ({ ...s, [game.id]: { home: s[game.id]?.home ?? String(game.periodScores[0].homeScore), away: e.target.value } }))}
                  />
                  <Button onClick={() => {
                    const entry = scores[game.id]
                    if (!entry) { setCorrectingGameId(null); return }
                    try {
                      correctGameResult(game.id, [{ period: 1, homeScore: Number(entry.home), awayScore: Number(entry.away) }])
                      setCorrectingGameId(null)
                    } catch (err) {
                      setError(err instanceof Error ? err.message : String(err))
                    }
                  }}>
                    Speichern
                  </Button>
                </>
              )}
              {game.homeTeamId && game.awayTeamId && (
                <div className="flex gap-1">
                  <Button onClick={() => {
                    if (confirm(`${home} als ausgeschieden markieren?`)) withdrawTeam(game.homeTeamId!)
                  }}>
                    {home} ausgeschieden
                  </Button>
                  <Button onClick={() => {
                    if (confirm(`${away} als ausgeschieden markieren?`)) withdrawTeam(game.awayTeamId!)
                  }}>
                    {away} ausgeschieden
                  </Button>
                </div>
              )}
```

- [ ] **Step 2: Build prüfen**

Run: `npm run build`
Expected: erfolgreich.

- [ ] **Step 3: Manuell im Browser prüfen**

- Ein Ergebnis eintragen, "Korrigieren" klicken, neuen Wert eintragen, speichern — prüfen, dass sich der Wert ändert.
- Zur nächsten Runde weitergehen, ein Ergebnis der neuen Runde eintragen, dann versuchen ein Ergebnis der Vorrunde zu korrigieren — muss fehlschlagen mit sichtbarer Fehlermeldung.
- "Team ausgeschieden" für ein Team mit noch offenem Spiel klicken — prüfen, dass das Spiel als storniert markiert wird und in der Turnierübersicht der Gegner die Punkte bekommt.

- [ ] **Step 4: Commit**

```bash
git add src/pages/SwissResultsPage.tsx
git commit -m "feat: add result correction and team withdrawal controls to results page"
```

---

## Phase 7: Print-Export

### Task 7.1: `renderSwissOverviewHtml`

**Files:**
- Create: `src/lib/export/swiss-overview-export.ts`
- Create: `src/lib/export/swiss-overview-export.test.ts`

- [ ] **Step 1: Fehlschlagenden Test schreiben**

```typescript
// src/lib/export/swiss-overview-export.test.ts
import { describe, it, expect } from 'vitest'
import { renderSwissOverviewHtml } from './swiss-overview-export'
import type { TournamentConfig, Schedule } from '@/types'
import type { TeamStanding } from '@/lib/standings'

const tournament: TournamentConfig = {
  id: 't1', name: 'Einstufungsturnier', mode: 'swiss', swissRounds: 1, fields: 2,
  gameSettings: {
    periodsCount: 4, periodDurationMin: 5, breakBetweenPeriodsMin: 1,
    halfTimeBreakMin: 5, bufferBetweenGamesMin: 5, breakBetweenRoundsMin: 15,
    awardCeremonyMin: 15,
  },
  venue: {
    name: 'Halle', availabilityWindows: [{ start: '09:00', end: '20:00' }],
    blackoutPeriods: [], setupBufferMin: 30, teardownBufferMin: 30,
  },
  teams: [
    { id: 't1', name: 'Team A', logoUrl: '', color: '#000', contact: '', players: [] },
    { id: 't2', name: 'Team B', logoUrl: '', color: '#000', contact: '', players: [] },
  ],
}

const schedule: Schedule = {
  id: 's1', tournamentId: 't1', generatedAt: '2026-09-11T10:00:00Z',
  games: [{
    id: 'g1', homeTeamId: 't1', awayTeamId: 't2', stage: 'swiss', field: 1,
    scheduledStart: '09:30', scheduledEnd: '10:00', round: 1, gameNumber: 1,
    periodScores: [{ period: 1, homeScore: 20, awayScore: 15 }],
  }],
  totalDurationMin: 30, estimatedEnd: '10:00',
}

const standings: TeamStanding[] = [
  { teamId: 't1', points: 2, wins: 1, draws: 0, losses: 0, pointsFor: 20, pointsAgainst: 15, pointsDiff: 5, buchholz: 0, hadBye: false, withdrawn: false },
  { teamId: 't2', points: 0, wins: 0, draws: 0, losses: 1, pointsFor: 15, pointsAgainst: 20, pointsDiff: -5, buchholz: 2, hadBye: false, withdrawn: false },
]

describe('renderSwissOverviewHtml', () => {
  it('includes tournament name, team names, and standings', () => {
    const html = renderSwissOverviewHtml(tournament, schedule, standings)
    expect(html).toContain('Einstufungsturnier')
    expect(html).toContain('Team A')
    expect(html).toContain('Team B')
    expect(html).toContain('@media print')
  })

  it('escapes HTML in team names', () => {
    const maliciousTournament: TournamentConfig = {
      ...tournament,
      teams: [{ ...tournament.teams[0], name: '<script>alert(1)</script>' }],
    }
    const html = renderSwissOverviewHtml(maliciousTournament, schedule, standings)
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `npm test -- --run src/lib/export/swiss-overview-export.test.ts`
Expected: FAIL — Modul existiert nicht.

- [ ] **Step 3: Implementierung**

```typescript
// src/lib/export/swiss-overview-export.ts
import type { TournamentConfig, Schedule } from '@/types'
import type { TeamStanding } from '@/lib/standings'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function renderSwissOverviewHtml(
  tournament: TournamentConfig,
  schedule: Schedule,
  standings: TeamStanding[],
): string {
  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))

  const standingsRows = standings.map((s, i) => `<tr>
    <td>${i + 1}</td>
    <td>${escapeHtml(teamMap.get(s.teamId)?.name ?? '?')}${s.withdrawn ? ' (ausgeschieden)' : ''}</td>
    <td>${s.points}</td>
    <td>${s.buchholz}</td>
    <td>${s.pointsDiff > 0 ? '+' : ''}${s.pointsDiff}</td>
    <td>${s.wins}-${s.draws}-${s.losses}</td>
  </tr>`).join('\n')

  const rounds = [...new Set(schedule.games.map(g => g.round))].sort((a, b) => a - b)
  const scheduleSections = rounds.map(round => {
    const rows = schedule.games
      .filter(g => g.round === round && g.field > 0)
      .map(g => {
        const home = escapeHtml(g.homeTeamId ? (teamMap.get(g.homeTeamId)?.name ?? '?') : (g.homeLabel ?? '?'))
        const away = escapeHtml(g.awayTeamId ? (teamMap.get(g.awayTeamId)?.name ?? '?') : (g.awayLabel ?? '?'))
        return `<tr>
          <td>${g.gameNumber}</td>
          <td>Feld ${g.field}</td>
          <td>${g.scheduledStart} – ${g.scheduledEnd}</td>
          <td>${home} vs ${away}</td>
        </tr>`
      }).join('\n')
    return `<h3>Runde ${round}</h3>
      <table><thead><tr><th>#</th><th>Feld</th><th>Zeit</th><th>Paarung</th></tr></thead>
      <tbody>${rows}</tbody></table>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(tournament.name)}</title>
  <style>
    body { font-family: 'Aller', system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; color: #002751; }
    h1 { font-size: 1.75rem; font-weight: bold; color: #004174; text-transform: uppercase; }
    h2, h3 { color: #004174; }
    table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; margin-bottom: 1.5rem; }
    th, td { padding: 0.4rem 0.75rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { font-weight: 600; background: #004174; color: #fff; }
    tr:nth-child(even) td { background: #f0f7fc; }
    @media print {
      body { margin: 0; max-width: none; }
      h1 { font-size: 1.4rem; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(tournament.name)}</h1>
  <h2>Tabelle</h2>
  <table>
    <thead><tr><th>#</th><th>Team</th><th>Pkt</th><th>Buchholz</th><th>Diff</th><th>S-U-N</th></tr></thead>
    <tbody>${standingsRows}</tbody>
  </table>
  <h2>Zeitplan</h2>
  ${scheduleSections}
</body>
</html>`
}
```

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/lib/export/swiss-overview-export.test.ts`
Expected: alle Tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/swiss-overview-export.ts src/lib/export/swiss-overview-export.test.ts
git commit -m "feat: add print-ready HTML export for the swiss tournament overview"
```

### Task 7.2: Druck-Button in `SwissOverviewPage.tsx`

**Files:**
- Modify: `src/pages/SwissOverviewPage.tsx`

Sicherheitshinweis: `document.write()` in einem neu geöffneten Fenster ist eine bekannte XSS-Angriffsfläche und wird hier bewusst **nicht** verwendet. Stattdessen wird das bereits im Projekt etablierte Blob-URL-Muster aus `src/lib/export/html-export.ts` (`downloadHtmlZip`) wiederverwendet: der generierte HTML-String wird als `Blob` verpackt, dafür eine Object-URL erzeugt und diese in einem neuen Tab geöffnet — der Browser rendert die Blob-URL als eigenständiges Dokument, ganz ohne Skript-Injection in ein fremdes Fenster.

- [ ] **Step 1: Druck-Handler mit Blob-URL ergänzen**

Import in `src/pages/SwissOverviewPage.tsx` erweitern:
```tsx
import { renderSwissOverviewHtml } from '@/lib/export/swiss-overview-export'
import { Button } from '@/components/ui/button'
```

Handler-Funktion ergänzen (innerhalb der Komponente, vor dem `return`):
```tsx
  const handlePrint = () => {
    const html = renderSwissOverviewHtml(tournament, schedule, standings)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const printWindow = window.open(url, '_blank')
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.print()
        URL.revokeObjectURL(url)
      })
    } else {
      URL.revokeObjectURL(url)
    }
  }
```

Im JSX, oben rechts über der Tabelle einen Button ergänzen. Ersetze den öffnenden `<div className="space-y-6">`-Block-Anfang:

```tsx
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={handlePrint}>Drucken</Button>
      </div>
      <div>
        <h2 className="font-display text-lg uppercase mb-2">Tabelle</h2>
```

(Der Rest der Datei bleibt unverändert — nur der öffnende Container-Div und der neue Button-Block werden eingefügt.)

- [ ] **Step 2: Build prüfen**

Run: `npm run build`
Expected: erfolgreich.

- [ ] **Step 3: Manuell im Browser prüfen**

Auf der Turnierübersicht-Seite "Drucken" klicken, prüfen dass sich ein neues Fenster/Tab mit der druckoptimierten Ansicht öffnet und der Browser-Druckdialog erscheint. Prüfen, dass Popup-Blocker-Meldungen (falls der Browser das Öffnen blockiert) für den Organisator verständlich wären — falls `window.open` `null` zurückgibt, aktuell kein sichtbarer Hinweis; das ist für den Scope dieses Plans akzeptabel, da es sich um ein reines Nice-to-have (Print-Ansicht) handelt und keinen Turnierablauf blockiert.

- [ ] **Step 4: Commit**

```bash
git add src/pages/SwissOverviewPage.tsx
git commit -m "feat: add print button using blob-url pattern (no document.write)"
```

---

## Abschlussprüfung

### Task 8.1: Vollständiger Regressionslauf

**Files:** keine Änderungen, nur Verifikation

- [ ] **Step 1: Kompletten Testlauf ausführen**

Run: `npm test -- --run`
Expected: alle Tests (bestehend + neu) PASS, keine Warnungen zu fehlenden Fixtures.

- [ ] **Step 2: Build ausführen**

Run: `npm run build`
Expected: erfolgreich, keine TypeScript-Fehler.

- [ ] **Step 3: Manueller End-to-End-Durchlauf im Browser**

Run: `npm run dev`

Kompletten Ablauf durchspielen:
1. Turniermodus auf "Einstufungsturnier" stellen, 5 Teams anlegen (ungerade Zahl, um Bye zu testen), Zeitplan generieren.
2. Runde 1 komplett mit Ergebnissen befüllen (inkl. Bye-Team beachten), "Nächste Runde auslosen" klicken.
3. Prüfen, dass Runde 2 jetzt echte Team-Namen zeigt (keine Platzhalter mehr) und die Tabelle in der Turnierübersicht aktualisiert ist.
4. Ein Ergebnis der aktuellen Runde korrigieren, bevor die nächste Runde ausgelost wird — muss funktionieren.
5. Alle Runden bis zum Ende durchspielen, "Turnier abgeschlossen"-Hinweis prüfen.
6. Turnierübersicht drucken, Layout im Druckfenster prüfen.

- [ ] **Step 4: Kein Commit nötig (reine Verifikation)**

Falls bei der manuellen Prüfung Bugs auffallen, einen neuen Task mit Fix + Test ergänzen und einzeln committen, statt Änderungen unkommentiert in bestehende Commits einzuarbeiten.
