# Endrunde 4 (Phase 1 der Endrunden-Varianten) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship "Endrunde 4" (Round-Robin-Platzierungsgruppen: alle Gruppenersten spielen jeder-gegen-jeden um Platz 1–4, alle Gruppenzweiten um Platz 5–8, usw.) as a usable, deployable feature ahead of an imminent real tournament — this is the fastest-to-ship slice of the full finals-variants design (`docs/superpowers/specs/2026-09-12-finals-variants-design.md`), deliberately excluding the KO-bracket variants (Endrunde 1/2/2a-c/3), which need more machinery (bracket generalization, third-place games, seeding cross-tables) and are NOT time-critical.

**Architecture:** New data fields on `TournamentConfig`/`Team`/`Game` describe a finals variant and per-game placeholder-resolution metadata. A new pure module `finals-variant-generator.ts` computes qualifier pools per rank tier (with Buchholz-based wildcard tiebreaking for uneven groups) and builds round-robin placement cohorts reusing the existing `generateRoundRobinRounds`. The store gains a `resolvePlaceholders` step (runs after every result save) that fills in placeholder games once their source stage is complete, plus group-stage withdrawal and finals-cohort dropout handling. Three new/extended UI surfaces: a "Endrunden-Variante" config section, a finals results-entry page (clone of the existing `GroupResultsPage` pattern), and a final-standings page.

**Tech Stack:** TypeScript, React, Zustand store, Vitest + Testing Library — all consistent with the existing codebase, no new dependencies.

---

## Task 1: Data model additions

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add the new fields**

Add to `TournamentConfig` (after the existing `doubleRoundRobin?: boolean` line):

```typescript
  finalsVariant?: 'endrunde-4'  // only relevant when mode === 'round-robin+finals' and groupCount > 1;
    // more variants ('endrunde-1' | 'endrunde-2' | ...) are added in a later phase — see
    // docs/superpowers/specs/2026-09-12-finals-variants-design.md
  dropoutHandling?: 'walkover' | 'next-best-fills-in'  // default 'next-best-fills-in'; governs what
    // happens when a team withdraws after already qualifying for a finals cohort
```

Add to `Team` (after `groupId?: string`):

```typescript
  withdrawnAfterStage?: 'group' | 'finals'  // set when the team withdrew during the group phase or
    // during the finals stage; distinct from the swiss-only withdrawnAfterRound above
```

Change `GameStage` from:

```typescript
export type GameStage = 'group' | 'semifinal' | 'final' | 'swiss'
```

to:

```typescript
export type GameStage = 'group' | 'semifinal' | 'final' | 'swiss' | 'placement'
  // 'placement' = a round-robin placement-cohort game (Endrunde 4), e.g. "all group winners play
  // each other for places 1-4"
```

Add to `Game` (after `groupId?: string`):

```typescript
  rankTier?: number  // which placement cohort this game belongs to (1 = group winners' cohort playing
    // for places 1-4, 2 = runners-up cohort playing for places 5-8, ...); only set when stage === 'placement'
  placementFrom?: number  // the best (lowest-numbered) place this cohort is playing for, e.g. 1, 5, 9;
    // only set when stage === 'placement' — used to label/sort the final standings page
  sourceRank?: { groupId: string; rank: number }  // which group-phase rank feeds this team slot;
    // undefined once homeTeamId/awayTeamId has been resolved to a real team
```

Since `Game.homeTeamId`/`awayTeamId` are per-slot, a placement-cohort game needs two `sourceRank` values (one per side). Represent this as a pair instead of a single field — replace the single `sourceRank` line above with:

```typescript
  homeSourceRank?: { groupId: string; rank: number }  // which group-phase rank feeds the home slot;
    // undefined once homeTeamId has been resolved to a real team
  awaySourceRank?: { groupId: string; rank: number }  // same for the away slot
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors (these are all optional fields, nothing consumes them yet).

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add data model fields for Endrunde 4 finals variant"
```

---

## Task 2: Group-phase Buchholz helper (cross-group wildcard tiebreak)

**Files:**
- Create: `src/lib/finals-variant-generator.ts`
- Create: `src/lib/finals-variant-generator.test.ts`

Per the design spec, when a placement cohort needs more qualifiers than direct group ranks provide (uneven group sizes), the next-best non-qualified teams fill in, ranked by: points → point difference → points scored → **group-phase Buchholz** (sum of the final points of every opponent this team played in its own group) → manual (out of scope for automated code, surfaced as a UI tie warning in Task 6).

- [ ] **Step 1: Write the failing test for the Buchholz helper**

```typescript
import { describe, it, expect } from 'vitest'
import { computeGroupPhaseBuchholz } from './finals-variant-generator'
import type { Game, Team } from '@/types'
import type { GroupStanding } from './group-standings'

const makeTeam = (id: string, groupId: string): Team => ({
  id, name: id, logoUrl: '', color: '#000', contact: '', players: [], groupId,
})

const makeGame = (overrides: Partial<Game>): Game => ({
  id: 'g', homeTeamId: null, awayTeamId: null, stage: 'group', field: 1,
  scheduledStart: '09:00', scheduledEnd: '09:30', round: 1, gameNumber: 1,
  periodScores: [], groupId: 'A',
  ...overrides,
})

const standing = (teamId: string, points: number): GroupStanding => ({
  teamId, points, wins: 0, draws: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, pointsDiff: 0,
})

describe('computeGroupPhaseBuchholz', () => {
  it('sums the final points of every opponent a team played in its own group', () => {
    const teams = [makeTeam('t1', 'A'), makeTeam('t2', 'A'), makeTeam('t3', 'A')]
    const games = [
      makeGame({ groupId: 'A', homeTeamId: 't1', awayTeamId: 't2', periodScores: [{ period: 1, homeScore: 20, awayScore: 15 }] }),
      makeGame({ groupId: 'A', homeTeamId: 't1', awayTeamId: 't3', periodScores: [{ period: 1, homeScore: 20, awayScore: 15 }] }),
    ]
    const standingsByTeamId = new Map([
      ['t1', standing('t1', 4)],
      ['t2', standing('t2', 0)],
      ['t3', standing('t3', 2)],
    ])
    // t1 played t2 (0 pts) and t3 (2 pts) -> buchholz = 2
    expect(computeGroupPhaseBuchholz('t1', games, standingsByTeamId)).toBe(2)
  })

  it('returns 0 for a team with no scored games', () => {
    const games = [makeGame({ groupId: 'A', homeTeamId: 't1', awayTeamId: 't2', periodScores: [] })]
    const standingsByTeamId = new Map([['t1', standing('t1', 0)], ['t2', standing('t2', 0)]])
    expect(computeGroupPhaseBuchholz('t1', games, standingsByTeamId)).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/finals-variant-generator.test.ts`
Expected: FAIL — `finals-variant-generator.ts` does not exist yet / `computeGroupPhaseBuchholz` is not exported.

- [ ] **Step 3: Implement the helper**

Create `src/lib/finals-variant-generator.ts`:

```typescript
import type { Game } from '@/types'
import type { GroupStanding } from './group-standings'

function isScorableGame(game: Game): game is Game & { homeTeamId: string; awayTeamId: string } {
  return !game.cancelledReason && !!game.homeTeamId && !!game.awayTeamId && game.periodScores.length > 0
}

/**
 * Sum of the final points of every opponent `teamId` played in its own group-phase games.
 * Used as a cross-group tiebreaker when ranking wildcard candidates for a placement cohort —
 * teams from different groups never played each other directly, so head-to-head (used within
 * a single group's standings) doesn't apply; Buchholz approximates "strength of opposition faced".
 */
export function computeGroupPhaseBuchholz(
  teamId: string,
  games: Game[],
  standingsByTeamId: Map<string, GroupStanding>,
): number {
  let buchholz = 0
  for (const game of games) {
    if (!isScorableGame(game)) continue
    if (game.homeTeamId === teamId) {
      buchholz += standingsByTeamId.get(game.awayTeamId)?.points ?? 0
    } else if (game.awayTeamId === teamId) {
      buchholz += standingsByTeamId.get(game.homeTeamId)?.points ?? 0
    }
  }
  return buchholz
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/finals-variant-generator.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/finals-variant-generator.ts src/lib/finals-variant-generator.test.ts
git commit -m "feat: add group-phase Buchholz helper for cross-group wildcard tiebreaking"
```

---

## Task 3: `buildQualifierPool` — determine cohort membership per rank tier

**Files:**
- Modify: `src/lib/finals-variant-generator.ts`
- Modify: `src/lib/finals-variant-generator.test.ts`

For Endrunde 4, every rank tier needs exactly 4 slots (one per group, since the requirement is literally "the four group winners", "the four runners-up", etc.). Per the design decisions: the number of rank tiers is capped at the **smallest** group's size (so every team gets a finals game), and if a group is short at the requested rank tier for some reason (already covered by the cap, but kept defensive), that slot is simply dropped rather than back-filled with a wildcard — wildcards are a KO-variant-only concept per the spec (Endrunde 4 has no "free bracket slot" to fill), so `buildQualifierPool` for Endrunde 4 is a direct 1-groupId-per-rank mapping, no wildcard logic needed here. (The Buchholz helper from Task 2 is still exported for reuse when Phase 2 implements the KO variants' wildcard qualification — it is not dead code, just not called from this phase's callers yet. Do not remove it.)

- [ ] **Step 1: Write the failing test**

```typescript
import { computeGroupStandings } from './group-standings'
import { buildPlacementCohorts } from './finals-variant-generator'
// (add this import to the top of the existing test file, next to the others)
```

Add to `src/lib/finals-variant-generator.test.ts`:

```typescript
describe('buildPlacementCohorts', () => {
  const makeStandingsFixture = () => {
    const teams = [
      makeTeam('a1', 'A'), makeTeam('a2', 'A'),
      makeTeam('b1', 'B'), makeTeam('b2', 'B'),
    ]
    const games = [
      makeGame({ id: 'gA', groupId: 'A', homeTeamId: 'a1', awayTeamId: 'a2', periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }] }),
      makeGame({ id: 'gB', groupId: 'B', homeTeamId: 'b1', awayTeamId: 'b2', periodScores: [{ period: 1, homeScore: 15, awayScore: 12 }] }),
    ]
    return { teams, games }
  }

  it('groups teams by group-phase rank across all groups: cohort 1 = every group winner, cohort 2 = every runner-up', () => {
    const { teams, games } = makeStandingsFixture()
    const groupIds = ['A', 'B']
    const standingsByGroup = new Map(groupIds.map(g => [g, computeGroupStandings(teams, games, g)]))
    const cohorts = buildPlacementCohorts(standingsByGroup)
    expect(cohorts).toHaveLength(2)
    expect(cohorts[0]).toEqual({ rankTier: 1, placementFrom: 1, teamIds: ['a1', 'b1'] })
    expect(cohorts[1]).toEqual({ rankTier: 2, placementFrom: 5, teamIds: ['a2', 'b2'] })
  })

  it('caps the number of rank tiers at the smallest group size', () => {
    const teams = [
      makeTeam('a1', 'A'), makeTeam('a2', 'A'), makeTeam('a3', 'A'),
      makeTeam('b1', 'B'), makeTeam('b2', 'B'),
    ]
    const games = [
      makeGame({ id: 'g1', groupId: 'A', homeTeamId: 'a1', awayTeamId: 'a2', periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }] }),
      makeGame({ id: 'g2', groupId: 'A', homeTeamId: 'a2', awayTeamId: 'a3', periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }] }),
      makeGame({ id: 'g3', groupId: 'B', homeTeamId: 'b1', awayTeamId: 'b2', periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }] }),
    ]
    const standingsByGroup = new Map([
      ['A', computeGroupStandings(teams, games, 'A')],
      ['B', computeGroupStandings(teams, games, 'B')],
    ])
    const cohorts = buildPlacementCohorts(standingsByGroup)
    // group B only has 2 teams, so only 2 rank tiers are formed even though group A has 3 ranks;
    // group A's 3rd-place team (a3) is excluded from any cohort.
    expect(cohorts).toHaveLength(2)
    expect(cohorts.every(c => !c.teamIds.includes('a3'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/finals-variant-generator.test.ts`
Expected: FAIL — `buildPlacementCohorts` is not exported.

- [ ] **Step 3: Implement**

Add to `src/lib/finals-variant-generator.ts` (below the existing `computeGroupPhaseBuchholz`):

```typescript
export interface PlacementCohort {
  rankTier: number       // 1 = group winners, 2 = runners-up, ...
  placementFrom: number  // best place this cohort plays for: 1, 5, 9, ...
  teamIds: string[]      // one team per group, in group-alphabetical order
}

/**
 * Splits group-phase standings into placement cohorts for Endrunde 4: cohort 1 contains every
 * group's rank-1 team, cohort 2 every group's rank-2 team, and so on. The number of cohorts is
 * capped at the smallest group's size, so every team ends up in exactly one cohort — a group
 * with more teams than the smallest group simply has its lowest-ranked team(s) excluded from any
 * finals cohort (see docs/superpowers/specs/2026-09-12-finals-variants-design.md, "Anzahl Rangstufen").
 */
export function buildPlacementCohorts(
  standingsByGroup: Map<string, { teamId: string }[]>,
): PlacementCohort[] {
  const groupIds = [...standingsByGroup.keys()].sort()
  const smallestGroupSize = Math.min(...groupIds.map(g => standingsByGroup.get(g)!.length))

  const cohorts: PlacementCohort[] = []
  for (let rankIndex = 0; rankIndex < smallestGroupSize; rankIndex++) {
    const teamIds = groupIds.map(groupId => standingsByGroup.get(groupId)![rankIndex].teamId)
    cohorts.push({ rankTier: rankIndex + 1, placementFrom: rankIndex * groupIds.length + 1, teamIds })
  }
  return cohorts
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/finals-variant-generator.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/finals-variant-generator.ts src/lib/finals-variant-generator.test.ts
git commit -m "feat: build placement cohorts from group standings for Endrunde 4"
```

---

## Task 4: Generate placement-cohort games (round-robin scheduling)

**Files:**
- Modify: `src/lib/finals-variant-generator.ts`
- Modify: `src/lib/finals-variant-generator.test.ts`

Each cohort plays a single round-robin among its `teamIds` (4 teams → 3 rounds via the existing circle method), reusing `generateRoundRobinRounds` from `schedule-generator.ts` — no new pairing logic. All cohorts' games are generated with placeholder `homeSourceRank`/`awaySourceRank` (not real team IDs yet), since at schedule-generation time (before the group phase is played) we don't know which real team will occupy each cohort slot — only which group/rank does. Store-level placeholder resolution (Task 7) fills in real team IDs once the group phase is complete.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/finals-variant-generator.test.ts`:

```typescript
import { buildPlacementGames } from './finals-variant-generator'
import type { GameSettings } from '@/types'

const gameSettings: GameSettings = {
  periodsCount: 4, periodDurationMin: 5, breakBetweenPeriodsMin: 1,
  halfTimeBreakMin: 5, bufferBetweenGamesMin: 5, breakBetweenRoundsMin: 15, awardCeremonyMin: 15,
}

describe('buildPlacementGames', () => {
  it('generates a full round-robin per cohort with placeholder source ranks, no real team IDs', () => {
    const cohorts = [
      { rankTier: 1, placementFrom: 1, sourceRanks: [{ groupId: 'A', rank: 1 }, { groupId: 'B', rank: 1 }, { groupId: 'C', rank: 1 }, { groupId: 'D', rank: 1 }] },
    ]
    const games = buildPlacementGames({
      cohorts,
      fields: 2,
      gameSettings,
      blackoutPeriods: [],
      availabilityEnd: '19:30',
      fieldNextFree: ['15:00', '15:00'],
      startGameNumber: 20,
    })
    // 4 teams round-robin = 6 games (3 rounds x 2 games/round)
    expect(games).toHaveLength(6)
    expect(games.every(g => g.stage === 'placement')).toBe(true)
    expect(games.every(g => g.rankTier === 1)).toBe(true)
    expect(games.every(g => g.placementFrom === 1)).toBe(true)
    expect(games.every(g => g.homeTeamId === null && g.awayTeamId === null)).toBe(true)
    expect(games.every(g => g.homeSourceRank && g.awaySourceRank)).toBe(true)
    expect(games[0].gameNumber).toBe(20)
  })

  it('assigns each cohort its own games and keeps gameNumber sequential across cohorts', () => {
    const cohorts = [
      { rankTier: 1, placementFrom: 1, sourceRanks: [{ groupId: 'A', rank: 1 }, { groupId: 'B', rank: 1 }, { groupId: 'C', rank: 1 }, { groupId: 'D', rank: 1 }] },
      { rankTier: 2, placementFrom: 5, sourceRanks: [{ groupId: 'A', rank: 2 }, { groupId: 'B', rank: 2 }, { groupId: 'C', rank: 2 }, { groupId: 'D', rank: 2 }] },
    ]
    const games = buildPlacementGames({
      cohorts,
      fields: 2,
      gameSettings,
      blackoutPeriods: [],
      availabilityEnd: '19:30',
      fieldNextFree: ['15:00', '15:00'],
      startGameNumber: 1,
    })
    expect(games).toHaveLength(12)
    const gameNumbers = games.map(g => g.gameNumber)
    expect(new Set(gameNumbers).size).toBe(12) // all unique
    expect(games.filter(g => g.rankTier === 2)).toHaveLength(6)
  })

  it('throws when the venue is too short to fit all placement games', () => {
    expect(() =>
      buildPlacementGames({
        cohorts: [{ rankTier: 1, placementFrom: 1, sourceRanks: [{ groupId: 'A', rank: 1 }, { groupId: 'B', rank: 1 }, { groupId: 'C', rank: 1 }, { groupId: 'D', rank: 1 }] }],
        fields: 1,
        gameSettings,
        blackoutPeriods: [],
        availabilityEnd: '15:10',
        fieldNextFree: ['15:00'],
        startGameNumber: 1,
      })
    ).toThrow('Kein Zeitfenster für die Endrunde verfügbar')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/finals-variant-generator.test.ts`
Expected: FAIL — `buildPlacementGames` is not exported.

- [ ] **Step 3: Implement**

Add to the top imports of `src/lib/finals-variant-generator.ts`:

```typescript
import { v4 as uuidv4 } from 'uuid'
import type { Game, GameSettings, TimeWindow } from '@/types'
import { generateRoundRobinRounds } from './schedule-generator'
import { calcGameDurationMin, addMinutes, maxTime, findNextSlot, timeToMinutes } from './game-duration'
```

(merge with the existing `import type { Game } from '@/types'` line — replace it with the fuller import above, and keep the existing `GroupStanding` import.)

Add to `src/lib/finals-variant-generator.ts`:

```typescript
export interface PlacementCohortInput {
  rankTier: number
  placementFrom: number
  sourceRanks: { groupId: string; rank: number }[]  // one per slot in this cohort, in seed order
}

export interface BuildPlacementGamesInput {
  cohorts: PlacementCohortInput[]
  fields: number
  gameSettings: GameSettings
  blackoutPeriods: TimeWindow[]
  availabilityEnd: string
  fieldNextFree: string[]
  startGameNumber: number
}

/**
 * Generates the round-robin games for every Endrunde-4 placement cohort. Teams are not yet known
 * at generation time (the group phase hasn't been played) — each game only carries the
 * group/rank pair that will later resolve to a real team, via `resolvePlaceholders` in the store.
 */
export function buildPlacementGames(input: BuildPlacementGamesInput): Game[] {
  const { cohorts, fields, gameSettings, blackoutPeriods, availabilityEnd, startGameNumber } = input
  const gameDuration = calcGameDurationMin(gameSettings)
  const slotDuration = gameDuration + gameSettings.bufferBetweenGamesMin
  const fieldClocks = [...input.fieldNextFree]
  const games: Game[] = []
  let gameNumber = startGameNumber

  for (const cohort of cohorts) {
    // Use synthetic slot ids ("0", "1", "2", "3") for the round-robin pairing, then map back to
    // this cohort's real sourceRanks — generateRoundRobinRounds only deals in opaque string ids.
    const slotIds = cohort.sourceRanks.map((_, i) => String(i))
    const rounds = generateRoundRobinRounds(slotIds)

    for (const round of rounds) {
      for (const [homeSlot, awaySlot] of round) {
        let bestField = -1
        let bestSlotStart = ''
        for (let f = 0; f < fields; f++) {
          const slotStart = findNextSlot(fieldClocks[f], gameDuration, blackoutPeriods, availabilityEnd)
          if (!slotStart) continue
          if (bestField === -1 || timeToMinutes(slotStart) < timeToMinutes(bestSlotStart)) {
            bestField = f
            bestSlotStart = slotStart
          }
        }
        if (bestField === -1) {
          throw new Error('Kein Zeitfenster für die Endrunde verfügbar — Hallenzeit reicht nicht aus')
        }
        const slotEnd = addMinutes(bestSlotStart, gameDuration)

        games.push({
          id: uuidv4(),
          homeTeamId: null,
          awayTeamId: null,
          homeSourceRank: cohort.sourceRanks[Number(homeSlot)],
          awaySourceRank: cohort.sourceRanks[Number(awaySlot)],
          stage: 'placement',
          rankTier: cohort.rankTier,
          placementFrom: cohort.placementFrom,
          field: bestField + 1,
          scheduledStart: bestSlotStart,
          scheduledEnd: slotEnd,
          round: rounds.indexOf(round) + 1,
          gameNumber: gameNumber++,
          periodScores: [],
        })

        fieldClocks[bestField] = addMinutes(bestSlotStart, slotDuration)
      }
    }
  }

  return games
}
```

Note: `maxTime` is imported but not directly used in this snippet — remove it from the import if `npx tsc --noEmit` flags it as unused after this step (it may be needed once field-clock-vs-team-clock interplay is added in a later refinement; for this phase, cohort games don't need per-team clock tracking since a round-robin's circle-method rounds already guarantee no team plays twice in the same round).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/finals-variant-generator.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If `maxTime` is reported unused, remove it from the import list.

- [ ] **Step 6: Commit**

```bash
git add src/lib/finals-variant-generator.ts src/lib/finals-variant-generator.test.ts
git commit -m "feat: generate round-robin placement-cohort games for Endrunde 4"
```

---

## Task 5: Wire Endrunde 4 into `generateSchedule`

**Files:**
- Modify: `src/lib/schedule-generator.ts`
- Modify: `src/lib/schedule-generator.test.ts`

`generateSchedule` currently always calls `generatePlayoffGames` when `mode === 'round-robin+finals'`. It needs a branch: when `finalsVariant === 'endrunde-4'`, call the new `buildPlacementCohorts` + `buildPlacementGames` instead of `generatePlayoffGames`. Group standings must be computed per group first (via the already-existing `computeGroupStandings`), which requires all group-phase games to exist in `games` already — they do, since this runs after the group-phase game generation loop earlier in the same function.

- [ ] **Step 1: Write the failing test**

Read `src/lib/schedule-generator.test.ts` first to find the exact fixture pattern used for `round-robin+finals` mode tests (config shape, team fixtures), then add a test following that same pattern:

```typescript
it('generates placement-cohort games instead of a KO bracket when finalsVariant is endrunde-4', () => {
  const config = {
    ...baseConfig, // reuse whatever the existing round-robin+finals tests in this file call their base config — check the top of this file for the actual variable name
    mode: 'round-robin+finals' as const,
    groupCount: 2,
    finalsVariant: 'endrunde-4' as const,
    teams: [
      { id: 't1', name: 'T1', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
      { id: 't2', name: 'T2', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
      { id: 't3', name: 'T3', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'B' },
      { id: 't4', name: 'T4', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'B' },
    ],
  }
  const schedule = generateSchedule(config)
  const placementGames = schedule.games.filter(g => g.stage === 'placement')
  // 2 groups of 2 -> 1 rank tier (cohort of 2 teams) -> 1 round-robin game
  expect(placementGames).toHaveLength(1)
  expect(placementGames[0].rankTier).toBe(1)
  expect(schedule.games.some(g => g.stage === 'semifinal' || g.stage === 'final')).toBe(false)
})
```

Adjust the fixture literal to match whatever helper/base-config the existing file already uses (do not invent a new one if `schedule-generator.test.ts` already has a `baseConfig`/`makeConfig` helper — reuse it and only override the fields shown above).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/schedule-generator.test.ts -t "endrunde-4"`
Expected: FAIL — no `placement` games are generated yet (falls through to the existing `generatePlayoffGames` call, or `finalsVariant` field doesn't affect anything).

- [ ] **Step 3: Implement**

In `src/lib/schedule-generator.ts`, add to the imports:

```typescript
import { buildPlacementCohorts, buildPlacementGames } from './finals-variant-generator'
import { computeGroupStandings } from './group-standings'
```

Replace the existing block:

```typescript
  if (config.mode === 'round-robin+finals') {
    const playoffGames = generatePlayoffGames({
      finalsBracketSize: config.finalsBracketSize ?? 4,
      fields,
      gameSettings,
      blackoutPeriods: venue.blackoutPeriods,
      availabilityEnd,
      fieldNextFree,
      teamCount: teams.length,
      startGameNumber: gameNumber,
    })
    games.push(...playoffGames)
  }
```

with:

```typescript
  if (config.mode === 'round-robin+finals' && config.finalsVariant === 'endrunde-4') {
    const standingsByGroup = new Map(groupIds.map(groupId => [groupId, computeGroupStandings(teams, games, groupId)]))
    const cohorts = buildPlacementCohorts(standingsByGroup).map(cohort => ({
      rankTier: cohort.rankTier,
      placementFrom: cohort.placementFrom,
      sourceRanks: groupIds.slice(0, cohort.teamIds.length).map(groupId => ({ groupId, rank: cohort.rankTier })),
    }))
    const placementGames = buildPlacementGames({
      cohorts,
      fields,
      gameSettings,
      blackoutPeriods: venue.blackoutPeriods,
      availabilityEnd,
      fieldNextFree,
      startGameNumber: gameNumber,
    })
    games.push(...placementGames)
  } else if (config.mode === 'round-robin+finals') {
    const playoffGames = generatePlayoffGames({
      finalsBracketSize: config.finalsBracketSize ?? 4,
      fields,
      gameSettings,
      blackoutPeriods: venue.blackoutPeriods,
      availabilityEnd,
      fieldNextFree,
      teamCount: teams.length,
      startGameNumber: gameNumber,
    })
    games.push(...playoffGames)
  }
```

Note: `buildPlacementCohorts` returns cohorts keyed by `teamIds` (real team IDs, since it's built from `computeGroupStandings` which already has the group-phase results at generation time — but wait, at the time `generateSchedule` first runs, the group phase has NOT been played yet, so `computeGroupStandings` will return all-zero standings in arbitrary team order). This means the `sourceRanks` mapping above (`groupIds.slice(0, cohort.teamIds.length).map(groupId => ({ groupId, rank: cohort.rankTier }))`) is what actually matters at generation time — the cohort's `teamIds` from `buildPlacementCohorts` at this pre-group-phase point are meaningless placeholders and must NOT be written into the games. Only `rankTier`/`placementFrom`/the synthesized `sourceRanks` (one per known group, at the fixed rank `cohort.rankTier`) are used. This is correct as written above; do not use `cohort.teamIds` here.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/schedule-generator.test.ts -t "endrunde-4"`
Expected: PASS

- [ ] **Step 5: Run the full schedule-generator suite to check no regressions**

Run: `npx vitest run src/lib/schedule-generator.test.ts`
Expected: all PASS (existing `round-robin+finals` tests without `finalsVariant` set still go through `generatePlayoffGames` unchanged, since the new branch requires `finalsVariant === 'endrunde-4'` explicitly)

- [ ] **Step 6: Commit**

```bash
git add src/lib/schedule-generator.ts src/lib/schedule-generator.test.ts
git commit -m "feat: wire Endrunde 4 placement cohorts into generateSchedule"
```

---

## Task 6: Config UI — "Endrunden-Variante" section + uneven-groups warning

**Files:**
- Create: `src/components/config/FinalsVariantForm.tsx`
- Create: `src/components/config/FinalsVariantForm.test.tsx`
- Modify: `src/components/config/GroupAssignmentForm.tsx`
- Modify: `src/components/config/GroupAssignmentForm.test.tsx`
- Modify: `src/pages/ConfigPage.tsx`
- Modify: `src/store/tournament-store.ts` (add `setFinalsVariant`/`setDropoutHandling` actions)

- [ ] **Step 1: Add store actions (failing test first)**

Read the existing `src/store/tournament-store.test.ts` to find the test pattern used for simple setter actions like `setDoubleRoundRobin`, then add, following that pattern:

```typescript
it('setFinalsVariant updates the finals variant', () => {
  const { setFinalsVariant } = useTournamentStore.getState()
  setFinalsVariant('endrunde-4')
  expect(useTournamentStore.getState().tournament.finalsVariant).toBe('endrunde-4')
})

it('setDropoutHandling updates the dropout handling mode', () => {
  const { setDropoutHandling } = useTournamentStore.getState()
  setDropoutHandling('walkover')
  expect(useTournamentStore.getState().tournament.dropoutHandling).toBe('walkover')
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/store/tournament-store.test.ts -t "setFinalsVariant"`
Expected: FAIL — `setFinalsVariant` is not a function.

- [ ] **Step 3: Implement the store actions**

In `src/store/tournament-store.ts`, add to the `TournamentStore` interface (near `setDoubleRoundRobin`):

```typescript
  setFinalsVariant: (variant: TournamentConfig['finalsVariant']) => void
  setDropoutHandling: (handling: NonNullable<TournamentConfig['dropoutHandling']>) => void
```

Add to the store implementation (near `setDoubleRoundRobin`'s implementation):

```typescript
  setFinalsVariant: (variant) => {
    set(s => ({ tournament: { ...s.tournament, finalsVariant: variant } }))
    saveTournament(get().tournament)
  },

  setDropoutHandling: (handling) => {
    set(s => ({ tournament: { ...s.tournament, dropoutHandling: handling } }))
    saveTournament(get().tournament)
  },
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/store/tournament-store.test.ts -t "setFinalsVariant|setDropoutHandling"`
Expected: PASS

- [ ] **Step 5: Commit the store actions**

```bash
git add src/store/tournament-store.ts src/store/tournament-store.test.ts
git commit -m "feat: add setFinalsVariant/setDropoutHandling store actions"
```

- [ ] **Step 6: Write the failing component test for FinalsVariantForm**

Read `src/components/config/GroupAssignmentForm.test.tsx` first for the exact render/store-mocking pattern this codebase uses for config-form component tests, then create `src/components/config/FinalsVariantForm.test.tsx` following that same pattern:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FinalsVariantForm from './FinalsVariantForm'
import { useTournamentStore } from '@/store/tournament-store'

describe('FinalsVariantForm', () => {
  beforeEach(() => {
    useTournamentStore.setState({
      tournament: {
        ...useTournamentStore.getState().tournament,
        groupCount: 2,
        teams: [
          { id: 't1', name: 'T1', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
          { id: 't2', name: 'T2', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
          { id: 't3', name: 'T3', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'B' },
        ],
      },
    })
  })

  it('lets the organizer select Endrunde 4 as the finals variant', async () => {
    render(<FinalsVariantForm />)
    const select = screen.getByLabelText('Endrunden-Variante')
    await userEvent.selectOptions(select, 'endrunde-4')
    expect(useTournamentStore.getState().tournament.finalsVariant).toBe('endrunde-4')
  })

  it('shows an uneven-groups warning when group sizes differ', () => {
    render(<FinalsVariantForm />)
    expect(screen.getByText(/unterschiedlich groß/i)).toBeInTheDocument()
  })

  it('lets the organizer choose the dropout-handling strategy', async () => {
    render(<FinalsVariantForm />)
    const select = screen.getByLabelText('Bei Rückzug in der Endrunde')
    await userEvent.selectOptions(select, 'walkover')
    expect(useTournamentStore.getState().tournament.dropoutHandling).toBe('walkover')
  })
})
```

- [ ] **Step 7: Run to verify it fails**

Run: `npx vitest run src/components/config/FinalsVariantForm.test.tsx`
Expected: FAIL — `FinalsVariantForm.tsx` does not exist.

- [ ] **Step 8: Implement `FinalsVariantForm.tsx`**

```tsx
import { useTournamentStore } from '@/store/tournament-store'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function FinalsVariantForm({ disabled = false }: { disabled?: boolean }) {
  const { tournament, setFinalsVariant, setDropoutHandling } = useTournamentStore()

  const groupSizes = new Map<string, number>()
  for (const team of tournament.teams) {
    const groupId = team.groupId ?? 'A'
    groupSizes.set(groupId, (groupSizes.get(groupId) ?? 0) + 1)
  }
  const sizes = [...groupSizes.values()]
  const hasUnevenGroups = sizes.length > 1 && new Set(sizes).size > 1

  return (
    <div className="space-y-4 max-w-md">
      <div className="space-y-1">
        <Label htmlFor="finals-variant">Endrunden-Variante</Label>
        <Select
          value={tournament.finalsVariant ?? 'endrunde-4'}
          onValueChange={v => setFinalsVariant(v as 'endrunde-4')}
          disabled={disabled}
        >
          <SelectTrigger id="finals-variant">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="endrunde-4">
              Endrunde 4 — Platzierungsgruppen (jeder gegen jeden je Rangstufe)
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasUnevenGroups && (
        <Alert>
          <AlertDescription>
            Die Gruppen sind unterschiedlich groß. Die Anzahl der Rangstufen richtet sich nach der
            kleinsten Gruppe — Teams auf niedrigeren Rängen in größeren Gruppen nehmen an keiner
            Platzierungsgruppe teil.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-1">
        <Label htmlFor="dropout-handling">Bei Rückzug in der Endrunde</Label>
        <Select
          value={tournament.dropoutHandling ?? 'next-best-fills-in'}
          onValueChange={v => setDropoutHandling(v as 'walkover' | 'next-best-fills-in')}
          disabled={disabled}
        >
          <SelectTrigger id="dropout-handling">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="next-best-fills-in">Nächster Nachrücker rückt nach</SelectItem>
            <SelectItem value="walkover">Gegner rückt kampflos vor (Walkover)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Run to verify it passes**

Run: `npx vitest run src/components/config/FinalsVariantForm.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 10: Wire the section into `ConfigPage.tsx`**

In `src/pages/ConfigPage.tsx`, add the import:

```typescript
import FinalsVariantForm from '@/components/config/FinalsVariantForm'
```

Add a new section right after the existing "Gruppen" section (after its closing `</section>`, before the "Spieleinstellungen" section):

```tsx
      {tournament.mode === 'round-robin+finals' && (tournament.groupCount ?? 1) > 1 && (
        <section className="space-y-4">
          <h2 className="text-lg text-brand-primary-light">Endrunden-Variante</h2>
          <LockedSectionGate locked={locked} unlocked={tournamentUnlocked} onUnlock={() => setConfirmTarget('tournament')}>
            {(disabled) => <FinalsVariantForm disabled={disabled} />}
          </LockedSectionGate>
        </section>
      )}
```

- [ ] **Step 11: Manual verification in the running app**

Run: `npm run dev` (or the project's existing dev script — check `package.json` if unsure)
Navigate to `/config`, set mode to "Gruppenphase + Endrunde", set group count to 2+, confirm the new "Endrunden-Variante" section appears with the variant dropdown and dropout dropdown, and that toggling group sizes to be uneven (assign teams unevenly across groups) shows the warning alert.

- [ ] **Step 12: Commit**

```bash
git add src/components/config/FinalsVariantForm.tsx src/components/config/FinalsVariantForm.test.tsx src/pages/ConfigPage.tsx
git commit -m "feat: add Endrunden-Variante config section with uneven-groups warning"
```

---

## Task 7: Store — `resolvePlaceholders` (auto-fill real teams into placement games)

**Files:**
- Modify: `src/store/tournament-store.ts`
- Modify: `src/store/tournament-store.test.ts`

This is the core "fills in the blanks" mechanism: once every group-phase game is scored, `resolvePlaceholders` looks up each group's final standings and writes the real `teamId` into every `placement`-stage game whose `homeSourceRank`/`awaySourceRank` matches that group+rank, clearing the source-rank field once resolved. It must run after `submitGameResult` and `correctGameResult`, and must be safe to call repeatedly (idempotent — already-resolved games are left alone since their `homeSourceRank`/`awaySourceRank` is already `undefined`).

- [ ] **Step 1: Write the failing test**

Read `src/store/tournament-store.test.ts` first for the exact `beforeEach`/store-reset pattern already used (it must reset `useTournamentStore` state and any `localStorage` mocks between tests — follow whatever the existing `submitGameResult` tests do), then add:

```typescript
describe('resolvePlaceholders (via submitGameResult)', () => {
  it('fills in real team IDs on a placement game once its group is fully scored', () => {
    const tournament = {
      ...useTournamentStore.getState().tournament,
      mode: 'round-robin+finals' as const,
      groupCount: 2,
      finalsVariant: 'endrunde-4' as const,
      teams: [
        { id: 't1', name: 'T1', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
        { id: 't2', name: 'T2', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
        { id: 't3', name: 'T3', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'B' },
        { id: 't4', name: 'T4', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'B' },
      ],
    }
    const groupGame = {
      id: 'gg1', homeTeamId: 't1', awayTeamId: 't2', stage: 'group' as const, field: 1,
      scheduledStart: '09:00', scheduledEnd: '09:30', round: 1, gameNumber: 1, periodScores: [], groupId: 'A',
    }
    const groupGameB = {
      id: 'gg2', homeTeamId: 't3', awayTeamId: 't4', stage: 'group' as const, field: 2,
      scheduledStart: '09:00', scheduledEnd: '09:30', round: 1, gameNumber: 2, periodScores: [], groupId: 'B',
    }
    const placementGame = {
      id: 'pg1', homeTeamId: null, awayTeamId: null, stage: 'placement' as const, field: 1,
      scheduledStart: '10:00', scheduledEnd: '10:30', round: 1, gameNumber: 3, periodScores: [],
      rankTier: 1, placementFrom: 1,
      homeSourceRank: { groupId: 'A', rank: 1 }, awaySourceRank: { groupId: 'B', rank: 1 },
    }
    useTournamentStore.setState({
      tournament,
      schedule: {
        id: 's1', tournamentId: tournament.id, generatedAt: new Date().toISOString(),
        games: [groupGame, groupGameB, placementGame], totalDurationMin: 90, estimatedEnd: '10:30',
      },
    })

    // t1 beats t2 in group A -> t1 is group A's rank 1
    useTournamentStore.getState().submitGameResult('gg1', [{ period: 1, homeScore: 20, awayScore: 10 }])
    // t3 beats t4 in group B -> t3 is group B's rank 1
    useTournamentStore.getState().submitGameResult('gg2', [{ period: 1, homeScore: 20, awayScore: 10 }])

    const resolved = useTournamentStore.getState().schedule!.games.find(g => g.id === 'pg1')!
    expect(resolved.homeTeamId).toBe('t1')
    expect(resolved.awayTeamId).toBe('t3')
    expect(resolved.homeSourceRank).toBeUndefined()
    expect(resolved.awaySourceRank).toBeUndefined()
  })

  it('does not resolve a placement game while its group is still incomplete', () => {
    const tournament = {
      ...useTournamentStore.getState().tournament,
      mode: 'round-robin+finals' as const,
      groupCount: 2,
      finalsVariant: 'endrunde-4' as const,
      teams: [
        { id: 't1', name: 'T1', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
        { id: 't2', name: 'T2', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
      ],
    }
    const groupGame1 = {
      id: 'gg1', homeTeamId: 't1', awayTeamId: 't2', stage: 'group' as const, field: 1,
      scheduledStart: '09:00', scheduledEnd: '09:30', round: 1, gameNumber: 1, periodScores: [], groupId: 'A',
    }
    const groupGame2 = {
      id: 'gg2', homeTeamId: 't1', awayTeamId: 't2', stage: 'group' as const, field: 1,
      scheduledStart: '09:30', scheduledEnd: '10:00', round: 2, gameNumber: 2, periodScores: [], groupId: 'A',
    }
    const placementGame = {
      id: 'pg1', homeTeamId: null, awayTeamId: null, stage: 'placement' as const, field: 1,
      scheduledStart: '10:00', scheduledEnd: '10:30', round: 1, gameNumber: 3, periodScores: [],
      rankTier: 1, placementFrom: 1,
      homeSourceRank: { groupId: 'A', rank: 1 }, awaySourceRank: { groupId: 'A', rank: 2 },
    }
    useTournamentStore.setState({
      tournament,
      schedule: {
        id: 's1', tournamentId: tournament.id, generatedAt: new Date().toISOString(),
        games: [groupGame1, groupGame2, placementGame], totalDurationMin: 90, estimatedEnd: '10:30',
      },
    })

    // only one of group A's two games is scored — group A is not yet complete
    useTournamentStore.getState().submitGameResult('gg1', [{ period: 1, homeScore: 20, awayScore: 10 }])

    const stillPlaceholder = useTournamentStore.getState().schedule!.games.find(g => g.id === 'pg1')!
    expect(stillPlaceholder.homeTeamId).toBeNull()
    expect(stillPlaceholder.homeSourceRank).toEqual({ groupId: 'A', rank: 1 })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/store/tournament-store.test.ts -t "resolvePlaceholders"`
Expected: FAIL — placement games are never touched by `submitGameResult` today.

- [ ] **Step 3: Implement `resolvePlaceholders`**

In `src/store/tournament-store.ts`, add the import:

```typescript
import { computeGroupStandings } from '@/lib/group-standings'
```

Add this function above `useTournamentStore`'s `create(...)` call (near `reshapeFutureSwissRounds`):

```typescript
/**
 * Fills in real team IDs on any 'placement' (Endrunde 4) game whose homeSourceRank/awaySourceRank
 * points at a group that is now fully scored. A group counts as "fully scored" when every one of
 * its group-stage games has either a result or a cancellation reason (mirrors the existing
 * isRoundFullyEvaluated pattern, but per-group instead of per-swiss-round).
 */
function resolvePlaceholders(games: Game[], teams: Team[]): Game[] {
  const groupIds = [...new Set(teams.map(t => t.groupId ?? 'A'))]
  const groupIsComplete = new Map<string, boolean>()
  for (const groupId of groupIds) {
    const groupGames = games.filter(g => g.stage === 'group' && (g.groupId ?? 'A') === groupId)
    groupIsComplete.set(groupId, groupGames.length > 0 && groupGames.every(g => g.cancelledReason || g.periodScores.length > 0))
  }

  const standingsCache = new Map<string, ReturnType<typeof computeGroupStandings>>()
  const standingsFor = (groupId: string) => {
    if (!standingsCache.has(groupId)) {
      standingsCache.set(groupId, computeGroupStandings(teams, games, groupId))
    }
    return standingsCache.get(groupId)!
  }

  return games.map(g => {
    if (g.stage !== 'placement') return g
    let { homeTeamId, awayTeamId, homeSourceRank, awaySourceRank } = g
    if (homeSourceRank && groupIsComplete.get(homeSourceRank.groupId)) {
      const standing = standingsFor(homeSourceRank.groupId)[homeSourceRank.rank - 1]
      if (standing) {
        homeTeamId = standing.teamId
        homeSourceRank = undefined
      }
    }
    if (awaySourceRank && groupIsComplete.get(awaySourceRank.groupId)) {
      const standing = standingsFor(awaySourceRank.groupId)[awaySourceRank.rank - 1]
      if (standing) {
        awayTeamId = standing.teamId
        awaySourceRank = undefined
      }
    }
    if (homeTeamId === g.homeTeamId && awayTeamId === g.awayTeamId) return g
    return { ...g, homeTeamId, awayTeamId, homeSourceRank, awaySourceRank }
  })
}
```

Now call it from both `submitGameResult` and `correctGameResult`. Replace `submitGameResult`'s body:

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

with:

```typescript
  submitGameResult: (gameId, periodScores) => {
    const { schedule, tournament } = get()
    if (!schedule) return
    const game = schedule.games.find(g => g.id === gameId)
    if (!game) return
    if (!game.homeTeamId || !game.awayTeamId) {
      throw new Error('Spiel hat noch keine feststehenden Teams')
    }
    const gamesAfterResult = schedule.games.map(g =>
      g.id === gameId ? { ...g, periodScores } : g
    )
    const updatedGames = resolvePlaceholders(gamesAfterResult, tournament.teams)
    const updated = { ...schedule, games: updatedGames }
    set({ schedule: updated })
    saveSchedule(updated)
  },
```

And replace `correctGameResult`'s body:

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

with:

```typescript
  correctGameResult: (gameId, periodScores) => {
    const { schedule, tournament } = get()
    if (!schedule) return
    const game = schedule.games.find(g => g.id === gameId)
    if (!game) return
    const nextRoundHasResult = schedule.games.some(
      g => g.stage === 'swiss' && g.round === game.round + 1 && g.periodScores.length > 0
    )
    if (nextRoundHasResult) {
      throw new Error('Ergebnis kann nicht mehr korrigiert werden — die nächste Runde wurde bereits ausgewertet')
    }
    const gamesAfterCorrection = schedule.games.map(g =>
      g.id === gameId ? { ...g, periodScores } : g
    )
    // If a group-phase correction changes who ranks 1st/2nd/etc., re-resolve any placement game
    // that hasn't been played yet (its own periodScores are still empty) so it picks up the new
    // team — a placement game that's already been scored itself is left untouched.
    const gamesWithReresolvedPlaceholders = gamesAfterCorrection.map(g => {
      if (g.stage !== 'placement' || g.periodScores.length > 0) return g
      return { ...g, homeSourceRank: findOriginalSourceRank(schedule.games, g.id, 'home'), awaySourceRank: findOriginalSourceRank(schedule.games, g.id, 'away') }
    })
    const updatedGames = resolvePlaceholders(gamesWithReresolvedPlaceholders, tournament.teams)
    const updated = { ...schedule, games: updatedGames }
    set({ schedule: updated })
    saveSchedule(updated)
  },
```

This last step needs a small helper, since once a placement game is resolved its `homeSourceRank` is cleared — to allow re-resolution after a group-phase correction, we must remember the original source rank. Add this helper near `resolvePlaceholders`:

```typescript
/**
 * Placement games clear their sourceRank once resolved (see resolvePlaceholders), but a later
 * group-phase correction needs to know the original rank to re-resolve against. Games track their
 * own rankTier/groupId pairing implicitly through the ORIGINAL schedule (before this correction),
 * so look it up there rather than trying to reverse-engineer it from the now-resolved team ID.
 */
function findOriginalSourceRank(
  originalGames: Game[],
  gameId: string,
  side: 'home' | 'away',
): { groupId: string; rank: number } | undefined {
  const original = originalGames.find(g => g.id === gameId)
  return side === 'home' ? original?.homeSourceRank : original?.awaySourceRank
}
```

Wait — this doesn't work: once a game is resolved, `original.homeSourceRank` is already `undefined` in `originalGames` (which is `schedule.games`, i.e., the state *before* this correction, but *after* whatever previous resolution already happened). There is no stored place to "remember" the original rank once cleared.

**Simplify instead of working around this**: don't clear `homeSourceRank`/`awaySourceRank` when resolving — keep them on the game permanently as a record of "where this slot's team came from", alongside the now-filled `homeTeamId`. Re-resolution then becomes trivial: `resolvePlaceholders` always recomputes `homeTeamId`/`awayTeamId` from `homeSourceRank`/`awaySourceRank` whenever the source group is complete, unconditionally, rather than only when the field was still `null`. Go back and make these changes:

1. In `resolvePlaceholders` (defined above in this same step), remove the two lines `homeSourceRank = undefined` and `awaySourceRank = undefined` — keep the rank fields populated permanently.
2. Delete the `findOriginalSourceRank` helper and the `gamesWithReresolvedPlaceholders` intermediate step in `correctGameResult` — they're no longer needed. `correctGameResult` becomes simply:

```typescript
  correctGameResult: (gameId, periodScores) => {
    const { schedule, tournament } = get()
    if (!schedule) return
    const game = schedule.games.find(g => g.id === gameId)
    if (!game) return
    const nextRoundHasResult = schedule.games.some(
      g => g.stage === 'swiss' && g.round === game.round + 1 && g.periodScores.length > 0
    )
    if (nextRoundHasResult) {
      throw new Error('Ergebnis kann nicht mehr korrigiert werden — die nächste Runde wurde bereits ausgewertet')
    }
    const gamesAfterCorrection = schedule.games.map(g =>
      g.id === gameId ? { ...g, periodScores } : g
    )
    const updatedGames = resolvePlaceholders(gamesAfterCorrection, tournament.teams)
    const updated = { ...schedule, games: updatedGames }
    set({ schedule: updated })
    saveSchedule(updated)
  },
```

3. Go back to Task 1 and update the doc-comment on `homeSourceRank`/`awaySourceRank` in `src/types/index.ts` — change `// undefined once homeTeamId has been resolved to a real team` to `// stays set even after resolution, so a later group-phase correction can re-resolve this slot`.
4. Update the two Task 7 tests above: the assertions `expect(resolved.homeSourceRank).toBeUndefined()` and `expect(resolved.awaySourceRank).toBeUndefined()` in the first test are now wrong — replace them with `expect(resolved.homeSourceRank).toEqual({ groupId: 'A', rank: 1 })` and `expect(resolved.awaySourceRank).toEqual({ groupId: 'B', rank: 1 })` (the rank fields persist; only `homeTeamId`/`awayTeamId` change).
5. Also add a third test to the `resolvePlaceholders` describe block confirming re-resolution on correction:

```typescript
  it('re-resolves a placement game after a group-phase result correction changes the standings', () => {
    const tournament = {
      ...useTournamentStore.getState().tournament,
      mode: 'round-robin+finals' as const,
      groupCount: 1,
      finalsVariant: 'endrunde-4' as const,
      teams: [
        { id: 't1', name: 'T1', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
        { id: 't2', name: 'T2', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
      ],
    }
    const groupGame = {
      id: 'gg1', homeTeamId: 't1', awayTeamId: 't2', stage: 'group' as const, field: 1,
      scheduledStart: '09:00', scheduledEnd: '09:30', round: 1, gameNumber: 1, periodScores: [], groupId: 'A',
    }
    const placementGame = {
      id: 'pg1', homeTeamId: null, awayTeamId: null, stage: 'placement' as const, field: 1,
      scheduledStart: '10:00', scheduledEnd: '10:30', round: 1, gameNumber: 2, periodScores: [],
      rankTier: 1, placementFrom: 1,
      homeSourceRank: { groupId: 'A', rank: 1 }, awaySourceRank: { groupId: 'A', rank: 2 },
    }
    useTournamentStore.setState({
      tournament,
      schedule: {
        id: 's1', tournamentId: tournament.id, generatedAt: new Date().toISOString(),
        games: [groupGame, placementGame], totalDurationMin: 60, estimatedEnd: '10:30',
      },
    })

    useTournamentStore.getState().submitGameResult('gg1', [{ period: 1, homeScore: 20, awayScore: 10 }])
    expect(useTournamentStore.getState().schedule!.games.find(g => g.id === 'pg1')!.homeTeamId).toBe('t1')

    // correction flips the result: t2 now wins group A
    useTournamentStore.getState().correctGameResult('gg1', [{ period: 1, homeScore: 10, awayScore: 20 }])
    const reResolved = useTournamentStore.getState().schedule!.games.find(g => g.id === 'pg1')!
    expect(reResolved.homeTeamId).toBe('t2')
    expect(reResolved.awayTeamId).toBe('t1')
  })
```

Note this last test also implicitly documents the one deliberate gap in this phase: if the placement game ITSELF already has a result when the group-phase correction happens, `resolvePlaceholders` as written will still silently overwrite its `homeTeamId`/`awayTeamId` even though `periodScores` is non-empty. Per the design spec ("Hat die Folgestufe bereits ein Ergebnis, bleibt sie unverändert"), this needs a guard. Add it now: in `resolvePlaceholders`, change the per-game mapping's opening check from `if (g.stage !== 'placement') return g` to:

```typescript
    if (g.stage !== 'placement' || g.periodScores.length > 0) return g
```

- [ ] **Step 4: Run all the new/updated tests to verify they pass**

Run: `npx vitest run src/store/tournament-store.test.ts -t "resolvePlaceholders"`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full store test suite to check no regressions**

Run: `npx vitest run src/store/tournament-store.test.ts`
Expected: all PASS

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/store/tournament-store.ts src/store/tournament-store.test.ts src/types/index.ts
git commit -m "feat: auto-resolve placement-game placeholders once their source group is complete"
```

---

## Task 8: Store — group-phase withdrawal (`withdrawTeam` for `stage === 'group'`)

**Files:**
- Modify: `src/store/tournament-store.ts`
- Modify: `src/store/tournament-store.test.ts`
- Modify: `src/types/index.ts` (already added `withdrawnAfterStage` in Task 1 — used here)

Per the design spec: withdrawing during the group phase cancels the team's remaining unplayed group games as a walkover (opponent gets the win), without any swiss-style future-round reshaping (group pairings are fixed at generation time). This must be a NEW code path, not a modification of the existing swiss-only `withdrawTeam` — the existing function stays untouched; `withdrawTeam` gains a stage-dispatch at its top.

- [ ] **Step 1: Write the failing test**

Add to `src/store/tournament-store.test.ts`:

```typescript
describe('withdrawTeam (group stage)', () => {
  it('cancels a withdrawing team\'s remaining unplayed group games as a walkover', () => {
    const tournament = {
      ...useTournamentStore.getState().tournament,
      mode: 'round-robin+finals' as const,
      groupCount: 1,
      teams: [
        { id: 't1', name: 'T1', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
        { id: 't2', name: 'T2', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
        { id: 't3', name: 'T3', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
      ],
    }
    const playedGame = {
      id: 'gg1', homeTeamId: 't1', awayTeamId: 't2', stage: 'group' as const, field: 1,
      scheduledStart: '09:00', scheduledEnd: '09:30', round: 1, gameNumber: 1,
      periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }], groupId: 'A',
    }
    const unplayedGame = {
      id: 'gg2', homeTeamId: 't2', awayTeamId: 't3', stage: 'group' as const, field: 1,
      scheduledStart: '10:00', scheduledEnd: '10:30', round: 2, gameNumber: 2, periodScores: [], groupId: 'A',
    }
    useTournamentStore.setState({
      tournament,
      schedule: {
        id: 's1', tournamentId: tournament.id, generatedAt: new Date().toISOString(),
        games: [playedGame, unplayedGame], totalDurationMin: 90, estimatedEnd: '10:30',
      },
    })

    useTournamentStore.getState().withdrawTeam('t2')

    const cancelled = useTournamentStore.getState().schedule!.games.find(g => g.id === 'gg2')!
    expect(cancelled.cancelledReason).toBe('withdrawal')
    expect(cancelled.periodScores).toEqual([{ period: 1, homeScore: 0, awayScore: 0 }])
    const untouched = useTournamentStore.getState().schedule!.games.find(g => g.id === 'gg1')!
    expect(untouched.periodScores).toEqual([{ period: 1, homeScore: 20, awayScore: 10 }])
    expect(untouched.cancelledReason).toBeUndefined()

    const withdrawnTeam = useTournamentStore.getState().tournament.teams.find(t => t.id === 't2')!
    expect(withdrawnTeam.withdrawnAfterStage).toBe('group')
  })

  it('does not touch swiss-mode withdrawal behavior', () => {
    const tournament = {
      ...useTournamentStore.getState().tournament,
      mode: 'swiss' as const,
      teams: [
        { id: 't1', name: 'T1', logoUrl: '', color: '#000', contact: '', players: [] },
        { id: 't2', name: 'T2', logoUrl: '', color: '#000', contact: '', players: [] },
      ],
    }
    const swissGame = {
      id: 'sg1', homeTeamId: 't1', awayTeamId: 't2', stage: 'swiss' as const, field: 1,
      scheduledStart: '09:00', scheduledEnd: '09:30', round: 1, gameNumber: 1, periodScores: [],
    }
    useTournamentStore.setState({
      tournament,
      schedule: {
        id: 's1', tournamentId: tournament.id, generatedAt: new Date().toISOString(),
        games: [swissGame], totalDurationMin: 30, estimatedEnd: '09:30',
      },
    })

    useTournamentStore.getState().withdrawTeam('t2')

    const withdrawnTeam = useTournamentStore.getState().tournament.teams.find(t => t.id === 't2')!
    expect(withdrawnTeam.withdrawnAfterRound).toBe(1)
    expect(withdrawnTeam.withdrawnAfterStage).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run to verify the first test fails**

Run: `npx vitest run src/store/tournament-store.test.ts -t "group stage"`
Expected: FAIL — today's `withdrawTeam` only branches on `stage === 'swiss'`, so a group-mode call is a silent no-op (no games get cancelled, `withdrawnAfterStage` never gets set).

- [ ] **Step 3: Implement**

In `src/store/tournament-store.ts`, replace the existing `withdrawTeam` implementation:

```typescript
  withdrawTeam: (teamId) => {
    const { schedule, tournament } = get()
    if (!schedule) return
    const currentRound = getCurrentSwissRound(schedule.games)

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

    const activeTeamCount = tournament.teams.filter(t => t.id !== teamId && !t.withdrawnAfterRound).length
    const updatedGames = reshapeFutureSwissRounds(gamesAfterCancellation, currentRound, activeTeamCount)

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

with:

```typescript
  withdrawTeam: (teamId) => {
    const { tournament } = get()
    if (tournament.mode === 'swiss') {
      withdrawSwissTeam(set, get, teamId)
    } else {
      withdrawGroupStageTeam(set, get, teamId)
    }
  },
```

Add the two extracted helper functions near `reshapeFutureSwissRounds` (above `useTournamentStore`'s `create(...)` call):

```typescript
function withdrawSwissTeam(
  set: StoreApi<TournamentStore>['setState'],
  get: StoreApi<TournamentStore>['getState'],
  teamId: string,
): void {
  const { schedule, tournament } = get()
  if (!schedule) return
  const currentRound = getCurrentSwissRound(schedule.games)

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

  const activeTeamCount = tournament.teams.filter(t => t.id !== teamId && !t.withdrawnAfterRound).length
  const updatedGames = reshapeFutureSwissRounds(gamesAfterCancellation, currentRound, activeTeamCount)

  const updatedTeams = tournament.teams.map(t =>
    t.id === teamId ? { ...t, withdrawnAfterRound: currentRound } : t
  )

  const updatedSchedule = { ...schedule, games: updatedGames }
  const updatedTournament = { ...tournament, teams: updatedTeams }
  set({ schedule: updatedSchedule, tournament: updatedTournament })
  saveSchedule(updatedSchedule)
  saveTournament(updatedTournament)
}

/**
 * Group-phase withdrawal: cancels the team's remaining unplayed group games as a walkover
 * (opponent wins 0:0 for standings purposes — see standings.ts's cancelledReason handling).
 * Unlike swiss withdrawal, there is no future-round reshaping: group-phase pairings are fixed at
 * schedule-generation time and never regenerated round-by-round.
 */
function withdrawGroupStageTeam(
  set: StoreApi<TournamentStore>['setState'],
  get: StoreApi<TournamentStore>['getState'],
  teamId: string,
): void {
  const { schedule, tournament } = get()
  if (!schedule) return

  const updatedGames = schedule.games.map(g => {
    if (g.stage !== 'group') return g
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

  const updatedTeams = tournament.teams.map(t =>
    t.id === teamId ? { ...t, withdrawnAfterStage: 'group' as const } : t
  )

  const updatedSchedule = { ...schedule, games: updatedGames }
  const updatedTournament = { ...tournament, teams: updatedTeams }
  set({ schedule: updatedSchedule, tournament: updatedTournament })
  saveSchedule(updatedSchedule)
  saveTournament(updatedTournament)
}
```

- [ ] **Step 4: Run to verify tests pass**

Run: `npx vitest run src/store/tournament-store.test.ts -t "withdrawTeam"`
Expected: PASS (both new tests, plus all pre-existing swiss `withdrawTeam` tests still pass unchanged)

- [ ] **Step 5: Check `standings.ts`'s withdrawal handling covers group-stage walkovers too**

Read `src/lib/group-standings.ts`'s `isScorableGame` — it already excludes any `cancelledReason` game from scoring entirely (`!game.cancelledReason`), unlike `standings.ts` (swiss) which awards the survivor 2 points for a walkover. This means a group-stage withdrawal game currently scores as if it never happened (0 points to either side), NOT as a walkover win for the opponent, contradicting this task's own test assertion... re-check: the test above only asserts `cancelledReason`/`periodScores` on the game itself, not the resulting standings — so the test as written will pass regardless. But this is a real behavior gap relative to the design spec ("Gegner erhält die Punkte als Walkover"). Fix `computeGroupStandings` now:

In `src/lib/group-standings.ts`, change:

```typescript
function isScorableGame(game: Game): game is Game & { homeTeamId: string; awayTeamId: string } {
  return !game.cancelledReason && !!game.homeTeamId && !!game.awayTeamId && game.periodScores.length > 0
}
```

to keep `isScorableGame` as the "count this in points-for/points-against/win-loss tallies" check (a walkover shouldn't inflate a team's actual point difference), but add explicit walkover handling in the loop, mirroring `standings.ts`'s pattern. Replace the main scoring loop:

```typescript
  for (const game of relevantGames) {
    if (!isScorableGame(game)) continue
    const { home, away } = computeFinalScore(game)
    const [homePoints, awayPoints] = pointsForResult(home, away)
    const homeStanding = standingsByTeamId.get(game.homeTeamId)
    const awayStanding = standingsByTeamId.get(game.awayTeamId)
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
```

with:

```typescript
  for (const game of relevantGames) {
    if (game.cancelledReason === 'withdrawal' && game.homeTeamId && game.awayTeamId) {
      const homeWithdrawn = teams.find(t => t.id === game.homeTeamId)?.withdrawnAfterStage === 'group'
      const survivorId = homeWithdrawn ? game.awayTeamId : game.homeTeamId
      const survivor = standingsByTeamId.get(survivorId)
      if (survivor) survivor.points += 2 // walkover win; no pointsFor/pointsAgainst change (no game was actually played)
      continue
    }
    if (!isScorableGame(game)) continue
    const { home, away } = computeFinalScore(game)
    const [homePoints, awayPoints] = pointsForResult(home, away)
    const homeStanding = standingsByTeamId.get(game.homeTeamId)
    const awayStanding = standingsByTeamId.get(game.awayTeamId)
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
```

- [ ] **Step 6: Write a failing test for the standings fix**

Add to `src/lib/group-standings.test.ts`:

```typescript
it('awards the surviving team 2 walkover points when the opponent withdrew, without counting it as a scored game', () => {
  const teams = [
    makeTeam('t1', 'A'),
    { ...makeTeam('t2', 'A'), withdrawnAfterStage: 'group' as const },
  ]
  const games = [
    makeGame({
      homeTeamId: 't1', awayTeamId: 't2', cancelledReason: 'withdrawal',
      periodScores: [{ period: 1, homeScore: 0, awayScore: 0 }],
    }),
  ]
  const standings = computeGroupStandings(teams, games, 'A')
  expect(standings.find(s => s.teamId === 't1')!.points).toBe(2)
  expect(standings.find(s => s.teamId === 't1')!.pointsFor).toBe(0)
  expect(standings.find(s => s.teamId === 't2')!.points).toBe(0)
})
```

- [ ] **Step 7: Run to verify it fails, then passes after the Step 5 fix**

Run: `npx vitest run src/lib/group-standings.test.ts`
Expected: first run FAILS (before Step 5's fix is in place — reorder if needed so this is truly red/green, i.e. apply Step 5's code change only after confirming Step 6's test fails against the OLD code), then PASSES once the Step 5 change is applied.

- [ ] **Step 8: Run full test suites to check no regressions**

Run: `npx vitest run src/lib/group-standings.test.ts src/store/tournament-store.test.ts`
Expected: all PASS

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 10: Commit**

```bash
git add src/store/tournament-store.ts src/store/tournament-store.test.ts src/lib/group-standings.ts src/lib/group-standings.test.ts
git commit -m "feat: support withdrawing a team during the group phase (walkover scoring)"
```

---

## Task 9: Store — finals-cohort dropout handling (walkover vs. next-best-fills-in)

**Files:**
- Modify: `src/store/tournament-store.ts`
- Modify: `src/store/tournament-store.test.ts`

Withdrawing a team that has already been resolved into a `placement` game (Task 7) needs to either (a) cancel its remaining cohort games as a walkover, or (b) — if `dropoutHandling === 'next-best-fills-in'` and the affected cohort's games haven't started yet (no game in that cohort has a result) — swap in the next-best team not already in any cohort. Per the design spec, "next-best" for Endrunde 4 has no wildcard concept (cohorts are fixed 1-per-group), so "next-best-fills-in" for THIS variant specifically means: the withdrawing team's own group has no other candidate at that exact rank tier to promote, EXCEPT the case where the withdrawal happens during the group phase before finals-resolution (already handled by Task 7/8's re-resolution) — post-resolution, Endrunde 4 has no bench to draw from (unlike the KO variants' wildcard pool). Confirm this scope boundary via a quick clarifying check before implementing, since it changes what code Task 9 actually needs to write.

- [ ] **Step 1: Re-derive the correct scope from the spec before writing code**

Re-read `docs/superpowers/specs/2026-09-12-finals-variants-design.md`'s "Dropout" section, point 4: *"Bei Endrunde 4 (Round-Robin-Kohorte): Rückzug innerhalb der Kohorte annulliert die verbleibenden Kohorten-Spiele des Teams als Walkover (kein Nachrücker-Konzept dort, da keine KO-Struktur mit 'freiem Slot' existiert)."* — this confirms Endrunde 4 has ONLY walkover behavior once a team is in a resolved placement cohort, regardless of the `dropoutHandling` setting (that setting only matters for the KO variants in Phase 2). So Task 9 is simpler than initially scoped above: just walkover cancellation of remaining cohort games, mirroring Task 8's group-stage walkover pattern exactly.

- [ ] **Step 2: Write the failing test**

Add to `src/store/tournament-store.test.ts`:

```typescript
describe('withdrawTeam (finals/placement stage)', () => {
  it('cancels a withdrawing team\'s remaining placement-cohort games as a walkover', () => {
    const tournament = {
      ...useTournamentStore.getState().tournament,
      mode: 'round-robin+finals' as const,
      groupCount: 1,
      finalsVariant: 'endrunde-4' as const,
      teams: [
        { id: 't1', name: 'T1', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
        { id: 't2', name: 'T2', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
        { id: 't3', name: 'T3', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
      ],
    }
    const playedPlacementGame = {
      id: 'pg1', homeTeamId: 't1', awayTeamId: 't2', stage: 'placement' as const, field: 1,
      scheduledStart: '10:00', scheduledEnd: '10:30', round: 1, gameNumber: 1,
      periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }],
      rankTier: 1, placementFrom: 1,
      homeSourceRank: { groupId: 'A', rank: 1 }, awaySourceRank: { groupId: 'A', rank: 2 },
    }
    const unplayedPlacementGame = {
      id: 'pg2', homeTeamId: 't2', awayTeamId: 't3', stage: 'placement' as const, field: 1,
      scheduledStart: '11:00', scheduledEnd: '11:30', round: 2, gameNumber: 2, periodScores: [],
      rankTier: 1, placementFrom: 1,
      homeSourceRank: { groupId: 'A', rank: 2 }, awaySourceRank: { groupId: 'A', rank: 3 },
    }
    useTournamentStore.setState({
      tournament,
      schedule: {
        id: 's1', tournamentId: tournament.id, generatedAt: new Date().toISOString(),
        games: [playedPlacementGame, unplayedPlacementGame], totalDurationMin: 90, estimatedEnd: '11:30',
      },
    })

    useTournamentStore.getState().withdrawTeam('t2')

    const cancelled = useTournamentStore.getState().schedule!.games.find(g => g.id === 'pg2')!
    expect(cancelled.cancelledReason).toBe('withdrawal')
    expect(cancelled.periodScores).toEqual([{ period: 1, homeScore: 0, awayScore: 0 }])
    const untouched = useTournamentStore.getState().schedule!.games.find(g => g.id === 'pg1')!
    expect(untouched.cancelledReason).toBeUndefined()

    const withdrawnTeam = useTournamentStore.getState().tournament.teams.find(t => t.id === 't2')!
    expect(withdrawnTeam.withdrawnAfterStage).toBe('finals')
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/store/tournament-store.test.ts -t "finals/placement stage"`
Expected: FAIL — `withdrawGroupStageTeam` (Task 8) only cancels `stage === 'group'` games; a team already resolved into placement games isn't handled.

- [ ] **Step 4: Implement**

In `src/store/tournament-store.ts`, update `withdrawGroupStageTeam`'s game-cancellation map to also cancel matching placement games, and rename it to reflect the broader scope. Replace:

```typescript
function withdrawGroupStageTeam(
  set: StoreApi<TournamentStore>['setState'],
  get: StoreApi<TournamentStore>['getState'],
  teamId: string,
): void {
  const { schedule, tournament } = get()
  if (!schedule) return

  const updatedGames = schedule.games.map(g => {
    if (g.stage !== 'group') return g
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

  const updatedTeams = tournament.teams.map(t =>
    t.id === teamId ? { ...t, withdrawnAfterStage: 'group' as const } : t
  )

  const updatedSchedule = { ...schedule, games: updatedGames }
  const updatedTournament = { ...tournament, teams: updatedTeams }
  set({ schedule: updatedSchedule, tournament: updatedTournament })
  saveSchedule(updatedSchedule)
  saveTournament(updatedTournament)
}
```

with:

```typescript
/**
 * Non-swiss withdrawal: cancels the team's remaining unplayed games (group-stage or, once already
 * resolved into a placement cohort, placement-stage) as a walkover. Unlike swiss withdrawal, there
 * is no future-round reshaping — both group-phase pairings and placement-cohort round-robins are
 * fixed at schedule-generation time and never regenerated round-by-round.
 */
function withdrawNonSwissTeam(
  set: StoreApi<TournamentStore>['setState'],
  get: StoreApi<TournamentStore>['getState'],
  teamId: string,
): void {
  const { schedule, tournament } = get()
  if (!schedule) return

  const wasInPlacementStage = schedule.games.some(
    g => g.stage === 'placement' && (g.homeTeamId === teamId || g.awayTeamId === teamId)
  )

  const updatedGames = schedule.games.map(g => {
    if (g.stage !== 'group' && g.stage !== 'placement') return g
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

  const updatedTeams = tournament.teams.map(t =>
    t.id === teamId ? { ...t, withdrawnAfterStage: wasInPlacementStage ? 'finals' as const : 'group' as const } : t
  )

  const updatedSchedule = { ...schedule, games: updatedGames }
  const updatedTournament = { ...tournament, teams: updatedTeams }
  set({ schedule: updatedSchedule, tournament: updatedTournament })
  saveSchedule(updatedSchedule)
  saveTournament(updatedTournament)
}
```

Update the call site in `withdrawTeam`:

```typescript
  withdrawTeam: (teamId) => {
    const { tournament } = get()
    if (tournament.mode === 'swiss') {
      withdrawSwissTeam(set, get, teamId)
    } else {
      withdrawNonSwissTeam(set, get, teamId)
    }
  },
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/store/tournament-store.test.ts -t "withdrawTeam"`
Expected: PASS (all withdrawal tests, including Task 8's group-stage ones — `withdrawGroupStageTeam`'s rename to `withdrawNonSwissTeam` doesn't change its group-stage test outcomes since a team not yet in any placement game still gets `withdrawnAfterStage: 'group'`)

- [ ] **Step 6: Check `computeGroupStandings`'s withdrawal check still matches after the rename**

`computeGroupStandings` (Task 8, Step 5) checks `teams.find(t => t.id === game.homeTeamId)?.withdrawnAfterStage === 'group'` to decide which side is the withdrawing one. A team withdrawn during the FINALS stage now has `withdrawnAfterStage === 'finals'`, not `'group'` — but that check only runs on `stage === 'group'` games (via `relevantGames` filtering by `g.stage === 'group' && ...`), and a team already promoted into the finals stage has, by definition, already finished the group stage with `withdrawnAfterStage` still unset at that point. So this check remains correct as-is — no change needed. Confirm by running the full group-standings suite:

Run: `npx vitest run src/lib/group-standings.test.ts`
Expected: all PASS (no change from Task 8)

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add src/store/tournament-store.ts src/store/tournament-store.test.ts
git commit -m "feat: support withdrawing a team already resolved into a placement cohort"
```

---

## Task 10: Finals results-entry page

**Files:**
- Create: `src/pages/FinalsResultsPage.tsx`
- Create: `src/pages/FinalsResultsPage.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/components/layout/AppShell.test.tsx`

Directly analogous to `GroupResultsPage.tsx` (read it again if needed — it's reproduced in full above in this plan's research), but scoped to `stage === 'placement'` games, with a rank-tier tag instead of a group tag, and games whose `homeTeamId`/`awayTeamId` are still `null` (unresolved) shown read-only (no input fields, since the design spec says unresolved games aren't offered for entry).

- [ ] **Step 1: Write the failing test**

Read `src/pages/GroupResultsPage.test.tsx` first (if it exists — check with `find src/pages -name "GroupResultsPage.test.tsx"`) for the exact store-mocking/render pattern used for this style of page test, then create `src/pages/FinalsResultsPage.test.tsx` following that pattern:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import FinalsResultsPage from './FinalsResultsPage'
import { useTournamentStore } from '@/store/tournament-store'

describe('FinalsResultsPage', () => {
  beforeEach(() => {
    const tournament = {
      ...useTournamentStore.getState().tournament,
      mode: 'round-robin+finals' as const,
      finalsVariant: 'endrunde-4' as const,
      teams: [
        { id: 't1', name: 'Team Eins', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
        { id: 't2', name: 'Team Zwei', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'B' },
      ],
    }
    useTournamentStore.setState({
      tournament,
      schedule: {
        id: 's1', tournamentId: tournament.id, generatedAt: new Date().toISOString(),
        games: [
          {
            id: 'pg1', homeTeamId: 't1', awayTeamId: 't2', stage: 'placement', field: 1,
            scheduledStart: '10:00', scheduledEnd: '10:30', round: 1, gameNumber: 1, periodScores: [],
            rankTier: 1, placementFrom: 1,
            homeSourceRank: { groupId: 'A', rank: 1 }, awaySourceRank: { groupId: 'B', rank: 1 },
          },
          {
            id: 'pg2', homeTeamId: null, awayTeamId: null, stage: 'placement', field: 1,
            scheduledStart: '11:00', scheduledEnd: '11:30', round: 2, gameNumber: 2, periodScores: [],
            rankTier: 2, placementFrom: 5,
            homeSourceRank: { groupId: 'A', rank: 2 }, awaySourceRank: { groupId: 'B', rank: 2 },
          },
        ],
        totalDurationMin: 90, estimatedEnd: '11:30',
      },
    })
  })

  it('shows a resolved placement game with entry fields and a rank-tier tag', () => {
    render(<FinalsResultsPage />, { wrapper: MemoryRouter })
    expect(screen.getByText(/Rangstufe 1/)).toBeInTheDocument()
    expect(screen.getByText('Team Eins')).toBeInTheDocument()
    expect(screen.getByLabelText(/Ergebnis Heim/)).toBeInTheDocument()
  })

  it('shows an unresolved placement game as read-only, without entry fields', () => {
    render(<FinalsResultsPage />, { wrapper: MemoryRouter })
    expect(screen.getByText(/Rangstufe 2/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Ergebnis Heim.*Spiel 2/)).not.toBeInTheDocument()
  })

  it('saves a result via submitGameResult', async () => {
    render(<FinalsResultsPage />, { wrapper: MemoryRouter })
    await userEvent.type(screen.getByLabelText(/Ergebnis Heim/), '20')
    await userEvent.type(screen.getByLabelText(/Ergebnis Auswärts/), '15')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    const saved = useTournamentStore.getState().schedule!.games.find(g => g.id === 'pg1')!
    expect(saved.periodScores).toEqual([{ period: 1, homeScore: 20, awayScore: 15 }])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/pages/FinalsResultsPage.test.tsx`
Expected: FAIL — `FinalsResultsPage.tsx` does not exist.

- [ ] **Step 3: Implement `FinalsResultsPage.tsx`**

This mirrors `GroupResultsPage.tsx` closely — same filter/score-state/save pattern, `stage === 'placement'` instead of `'group'`, a "Rangstufe N" tag instead of "Gruppe X", and an early-return read-only row for unresolved games:

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTournamentStore } from '@/store/tournament-store'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TeamNameDisplay } from '@/components/teams/TeamNameDisplay'
import { computeFinalScore } from '@/lib/standings'
import type { Game } from '@/types'

type StatusFilter = 'open' | 'played' | 'all'

export default function FinalsResultsPage() {
  const { tournament, schedule, submitGameResult, correctGameResult } = useTournamentStore()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open')
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>({})
  const [correctingGameId, setCorrectingGameId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  if (!schedule) {
    return (
      <Alert>
        <AlertDescription>Bitte zuerst einen Zeitplan generieren (Seite „Konfiguration“).</AlertDescription>
      </Alert>
    )
  }

  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))
  const finalsGames = schedule.games.filter(g => g.stage === 'placement')
  const filteredGames = finalsGames
    .filter(g => {
      const hasResult = g.periodScores.length > 0
      if (statusFilter === 'open') return !hasResult
      if (statusFilter === 'played') return hasResult
      return true
    })
    .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))

  const resolvedHomeScore = (game: Game): number | undefined => {
    const entry = scores[game.id]
    if (entry?.home !== undefined) return entry.home.trim() === '' ? NaN : Number(entry.home)
    if (game.periodScores.length > 0) return game.periodScores[0].homeScore
    return undefined
  }

  const resolvedAwayScore = (game: Game): number | undefined => {
    const entry = scores[game.id]
    if (entry?.away !== undefined) return entry.away.trim() === '' ? NaN : Number(entry.away)
    if (game.periodScores.length > 0) return game.periodScores[0].awayScore
    return undefined
  }

  const canSave = (game: Game): boolean => {
    const home = resolvedHomeScore(game)
    const away = resolvedAwayScore(game)
    return home !== undefined && away !== undefined && !Number.isNaN(home) && !Number.isNaN(away)
  }

  const handleSave = (game: Game) => {
    if (!canSave(game)) return
    const homeScore = resolvedHomeScore(game) as number
    const awayScore = resolvedAwayScore(game) as number
    const hasResult = game.periodScores.length > 0
    if (hasResult) {
      correctGameResult(game.id, [{ period: 1, homeScore, awayScore }])
    } else {
      submitGameResult(game.id, [{ period: 1, homeScore, awayScore }])
    }
    setCorrectingGameId(null)
    setSaved(true)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl text-brand-primary">Endrunde: Ergebnisse erfassen</h1>

      {saved && (
        <Alert>
          <AlertDescription>
            Ergebnis gespeichert.{' '}
            <Link to="/final-standings" className="underline">Endstand ansehen →</Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-4 flex-wrap items-end">
        <div className="space-y-1">
          <Label htmlFor="status-filter">Status</Label>
          <select
            id="status-filter"
            className="border border-border rounded-sm px-2 py-1 text-sm"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="open">Offen</option>
            <option value="played">Erfasst</option>
            <option value="all">Alle</option>
          </select>
        </div>
      </div>

      {filteredGames.length === 0 && (
        <Alert>
          <AlertDescription>Keine Spiele für die gewählten Filter.</AlertDescription>
        </Alert>
      )}

      <div className="border border-border rounded-md p-4 bg-card space-y-3">
        {filteredGames.map(game => {
          const homeTeam = game.homeTeamId ? teamMap.get(game.homeTeamId) : undefined
          const awayTeam = game.awayTeamId ? teamMap.get(game.awayTeamId) : undefined
          const hasResult = game.periodScores.length > 0
          const isCorrecting = correctingGameId === game.id
          const isUnresolved = !game.homeTeamId || !game.awayTeamId
          const finalScore = hasResult ? computeFinalScore(game) : null

          return (
            <div key={game.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
              <span className="text-xs font-mono text-muted-foreground w-16">{game.scheduledStart}</span>
              <span className="text-xs font-mono w-8 text-center bg-tint rounded-sm px-1">F{game.field}</span>
              <span className="text-xs font-mono text-center bg-tint rounded-sm px-1">
                Rangstufe {game.rankTier} — Platz {game.placementFrom}+
              </span>
              <div className="flex-1 min-w-0 flex items-center gap-2">
                {homeTeam ? <TeamNameDisplay team={homeTeam} /> : <span>{`Platz ${game.homeSourceRank?.rank} der Gruppe ${game.homeSourceRank?.groupId}`}</span>}
                <span className="text-muted-foreground text-sm">vs</span>
                {awayTeam ? <TeamNameDisplay team={awayTeam} /> : <span>{`Platz ${game.awaySourceRank?.rank} der Gruppe ${game.awaySourceRank?.groupId}`}</span>}
              </div>

              {isUnresolved ? (
                <span className="text-xs text-muted-foreground">Wartet auf Gruppenphase</span>
              ) : hasResult && !isCorrecting ? (
                <>
                  <span className="text-sm font-mono w-20 text-center">
                    {finalScore!.home} : {finalScore!.away}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setCorrectingGameId(game.id)}>
                    Korrigieren
                  </Button>
                </>
              ) : (
                <>
                  <Input
                    type="number"
                    className="w-16 no-spinner px-1 text-center"
                    aria-label={isCorrecting ? `Korrigiertes Ergebnis Heim, Spiel ${game.gameNumber}` : `Ergebnis Heim, Spiel ${game.gameNumber}`}
                    defaultValue={isCorrecting ? game.periodScores[0].homeScore : undefined}
                    onChange={e => setScores(s => ({ ...s, [game.id]: { home: e.target.value, away: s[game.id]?.away ?? (isCorrecting ? String(game.periodScores[0].awayScore) : '') } }))}
                  />
                  <span>:</span>
                  <Input
                    type="number"
                    className="w-16 no-spinner px-1 text-center"
                    aria-label={isCorrecting ? `Korrigiertes Ergebnis Auswärts, Spiel ${game.gameNumber}` : `Ergebnis Auswärts, Spiel ${game.gameNumber}`}
                    defaultValue={isCorrecting ? game.periodScores[0].awayScore : undefined}
                    onChange={e => setScores(s => ({ ...s, [game.id]: { home: s[game.id]?.home ?? (isCorrecting ? String(game.periodScores[0].homeScore) : ''), away: e.target.value } }))}
                  />
                  <Button size="sm" disabled={!canSave(game)} onClick={() => handleSave(game)}>
                    Speichern
                  </Button>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/pages/FinalsResultsPage.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Wire the route into `App.tsx`**

Add the import: `import FinalsResultsPage from '@/pages/FinalsResultsPage'`
Add the route (after the existing `group-results` route): `<Route path="finals-results" element={<FinalsResultsPage />} />`

- [ ] **Step 6: Add the nav link in `AppShell.tsx`**

In `src/components/layout/AppShell.tsx`, add a `hasFinalsVariant` check next to the existing `hasMultipleGroups`:

```typescript
  const hasFinalsVariant = tournament.mode === 'round-robin+finals' && !!tournament.finalsVariant
```

Add a nav item inside the existing non-swiss branch's array, right after `group-results`:

```typescript
          ...(hasFinalsVariant ? [{ to: '/finals-results', label: 'Endrunde: Ergebnisse', gated: true }] : []),
```

- [ ] **Step 7: Add/update the AppShell test**

Read `src/components/layout/AppShell.test.tsx` first for its existing pattern (how it sets `mode`/`groupCount` via store state to check which nav links appear), then add a test following that pattern:

```typescript
it('shows the finals-results nav link when a finals variant is configured', () => {
  useTournamentStore.setState({
    tournament: {
      ...useTournamentStore.getState().tournament,
      mode: 'round-robin+finals',
      finalsVariant: 'endrunde-4',
    },
    schedule: { id: 's1', tournamentId: 't1', generatedAt: new Date().toISOString(), games: [{ id: 'g1' } as never], totalDurationMin: 0, estimatedEnd: '10:00' },
  })
  render(<AppShell />, { wrapper: MemoryRouter })
  expect(screen.getByText('Endrunde: Ergebnisse')).toBeInTheDocument()
})
```

(Adjust the exact `render`/wrapper syntax to match whatever the rest of this test file already uses — check the top of the file for its actual test setup before adding this.)

- [ ] **Step 8: Run to verify**

Run: `npx vitest run src/components/layout/AppShell.test.tsx`
Expected: PASS (including all pre-existing tests)

- [ ] **Step 9: Manual verification in the running app**

Run: `npm run dev`
Configure a `round-robin+finals` tournament with `groupCount: 2`+, `finalsVariant: endrunde-4`, add teams, generate the schedule, play out a full group so a placement game resolves, then visit `/finals-results` and confirm: the resolved game shows real team names and entry fields; an unresolved game shows "Wartet auf Gruppenphase"; saving a result works and the confirmation alert links to `/final-standings` (not yet built — expect a 404/blank page here, that's Task 11).

- [ ] **Step 10: Commit**

```bash
git add src/pages/FinalsResultsPage.tsx src/pages/FinalsResultsPage.test.tsx src/App.tsx src/components/layout/AppShell.tsx src/components/layout/AppShell.test.tsx
git commit -m "feat: add finals results-entry page for placement-cohort games"
```

---

## Task 11: Final standings page

**Files:**
- Create: `src/lib/final-standings.ts`
- Create: `src/lib/final-standings.test.ts`
- Create: `src/pages/FinalStandingsPage.tsx`
- Create: `src/pages/FinalStandingsPage.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/AppShell.tsx`

Computes and displays the overall 1..N ranking once placement-cohort games are scored. For Endrunde 4, each cohort's ranking comes directly from a round-robin standings computation (same 2/1/0-point, head-to-head, point-difference logic as `computeGroupStandings` — reuse it, since a placement cohort IS structurally a round-robin group, just with `stage === 'placement'` instead of `'group'`). The overall standing is cohort 1's ranking (places 1-4) followed by cohort 2's (places 5-8), etc., in `placementFrom` order.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { computeFinalStandings } from './final-standings'
import type { Game, Team } from '@/types'

const makeTeam = (id: string): Team => ({
  id, name: id, logoUrl: '', color: '#000', contact: '', players: [],
})

const makePlacementGame = (overrides: Partial<Game>): Game => ({
  id: 'g', homeTeamId: null, awayTeamId: null, stage: 'placement', field: 1,
  scheduledStart: '10:00', scheduledEnd: '10:30', round: 1, gameNumber: 1,
  periodScores: [], rankTier: 1, placementFrom: 1,
  ...overrides,
})

describe('computeFinalStandings', () => {
  it('orders teams within a cohort by placement points, then concatenates cohorts by placementFrom', () => {
    const teams = [makeTeam('a1'), makeTeam('b1'), makeTeam('a2'), makeTeam('b2')]
    const games = [
      makePlacementGame({ id: 'g1', rankTier: 1, placementFrom: 1, homeTeamId: 'a1', awayTeamId: 'b1', periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }] }),
      makePlacementGame({ id: 'g2', rankTier: 2, placementFrom: 5, homeTeamId: 'a2', awayTeamId: 'b2', periodScores: [{ period: 1, homeScore: 5, awayScore: 15 }] }),
    ]
    const standings = computeFinalStandings(teams, games)
    expect(standings.map(s => s.teamId)).toEqual(['a1', 'b1', 'b2', 'a2'])
    expect(standings.map(s => s.place)).toEqual([1, 2, 5, 6])
  })

  it('marks a cohort as incomplete when it still has unplayed games', () => {
    const teams = [makeTeam('a1'), makeTeam('b1')]
    const games = [
      makePlacementGame({ id: 'g1', rankTier: 1, placementFrom: 1, homeTeamId: 'a1', awayTeamId: 'b1', periodScores: [] }),
    ]
    const standings = computeFinalStandings(teams, games)
    expect(standings.every(s => s.pending)).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/final-standings.test.ts`
Expected: FAIL — `final-standings.ts` does not exist.

- [ ] **Step 3: Implement**

```typescript
import type { Game, Team } from '@/types'
import { computeGroupStandings } from './group-standings'

export interface FinalStanding {
  teamId: string
  place: number
  pending: boolean  // true if this team's cohort still has an unplayed game
}

/**
 * Builds the overall 1..N tournament ranking from Endrunde-4 placement-cohort results. Each
 * cohort's internal order comes from computeGroupStandings (points -> head-to-head -> point
 * diff) reused here by pretending the cohort is a "group" keyed by its rankTier, since a
 * placement cohort is structurally identical to a group-phase round-robin group.
 */
export function computeFinalStandings(teams: Team[], games: Game[]): FinalStanding[] {
  const placementGames = games.filter(g => g.stage === 'placement')
  const rankTiers = [...new Set(placementGames.map(g => g.rankTier!))].sort((a, b) => a - b)

  const results: FinalStanding[] = []
  for (const rankTier of rankTiers) {
    const cohortGames = placementGames.filter(g => g.rankTier === rankTier)
    const placementFrom = cohortGames[0].placementFrom!
    const cohortTeamIds = new Set(cohortGames.flatMap(g => [g.homeTeamId, g.awayTeamId].filter((id): id is string => !!id)))
    const cohortTeams = teams.filter(t => cohortTeamIds.has(t.id))
    const pending = cohortGames.some(g => g.periodScores.length === 0 && !g.cancelledReason)

    // computeGroupStandings filters games by `g.stage === 'group' && (g.groupId ?? 'A') === groupId`;
    // reuse it by relabeling this cohort's games as a synthetic group keyed by the rank tier.
    const relabeledGames = cohortGames.map(g => ({ ...g, stage: 'group' as const, groupId: `tier-${rankTier}` }))
    const cohortStandings = computeGroupStandings(cohortTeams, relabeledGames, `tier-${rankTier}`)

    cohortStandings.forEach((standing, index) => {
      results.push({ teamId: standing.teamId, place: placementFrom + index, pending })
    })
  }
  return results
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/final-standings.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit the standings logic**

```bash
git add src/lib/final-standings.ts src/lib/final-standings.test.ts
git commit -m "feat: compute overall final standings from placement-cohort results"
```

- [ ] **Step 6: Write the failing page test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import FinalStandingsPage from './FinalStandingsPage'
import { useTournamentStore } from '@/store/tournament-store'

describe('FinalStandingsPage', () => {
  beforeEach(() => {
    const tournament = {
      ...useTournamentStore.getState().tournament,
      mode: 'round-robin+finals' as const,
      finalsVariant: 'endrunde-4' as const,
      teams: [
        { id: 't1', name: 'Team Eins', logoUrl: '', color: '#000', contact: '', players: [] },
        { id: 't2', name: 'Team Zwei', logoUrl: '', color: '#000', contact: '', players: [] },
      ],
    }
    useTournamentStore.setState({
      tournament,
      schedule: {
        id: 's1', tournamentId: tournament.id, generatedAt: new Date().toISOString(),
        games: [
          {
            id: 'pg1', homeTeamId: 't1', awayTeamId: 't2', stage: 'placement', field: 1,
            scheduledStart: '10:00', scheduledEnd: '10:30', round: 1, gameNumber: 1,
            periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }],
            rankTier: 1, placementFrom: 1,
          },
        ],
        totalDurationMin: 30, estimatedEnd: '10:30',
      },
    })
  })

  it('shows the final ranking with places and team names', () => {
    render(<FinalStandingsPage />)
    expect(screen.getByText('1.')).toBeInTheDocument()
    expect(screen.getByText('Team Eins')).toBeInTheDocument()
    expect(screen.getByText('2.')).toBeInTheDocument()
    expect(screen.getByText('Team Zwei')).toBeInTheDocument()
  })
})
```

- [ ] **Step 7: Run to verify it fails**

Run: `npx vitest run src/pages/FinalStandingsPage.test.tsx`
Expected: FAIL — `FinalStandingsPage.tsx` does not exist.

- [ ] **Step 8: Implement the page**

```tsx
import { useTournamentStore } from '@/store/tournament-store'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TeamNameDisplay } from '@/components/teams/TeamNameDisplay'
import { computeFinalStandings } from '@/lib/final-standings'

export default function FinalStandingsPage() {
  const { tournament, schedule } = useTournamentStore()

  if (!schedule) {
    return (
      <Alert>
        <AlertDescription>Bitte zuerst einen Zeitplan generieren (Seite „Konfiguration“).</AlertDescription>
      </Alert>
    )
  }

  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))
  const standings = computeFinalStandings(tournament.teams, schedule.games)

  if (standings.length === 0) {
    return (
      <Alert>
        <AlertDescription>Noch keine Endrunden-Ergebnisse vorhanden.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl text-brand-primary">Endstand</h1>
      <table className="w-full border-collapse">
        <tbody>
          {standings.map(s => (
            <tr key={s.teamId} className="border-b border-border last:border-0">
              <td className="py-1 pr-2 font-medium w-12">{s.place}.</td>
              <td className="py-1 pr-2">
                {teamMap.get(s.teamId) && <TeamNameDisplay team={teamMap.get(s.teamId)!} />}
              </td>
              <td className="py-1 pr-2 text-xs text-muted-foreground">
                {s.pending ? 'ausstehend' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 9: Run to verify it passes**

Run: `npx vitest run src/pages/FinalStandingsPage.test.tsx`
Expected: PASS

- [ ] **Step 10: Wire the route and nav link**

In `src/App.tsx`: add `import FinalStandingsPage from '@/pages/FinalStandingsPage'` and the route `<Route path="final-standings" element={<FinalStandingsPage />} />` (after the `finals-results` route).

In `src/components/layout/AppShell.tsx`: add another entry right after the `finals-results` one:

```typescript
          ...(hasFinalsVariant ? [{ to: '/final-standings', label: 'Endstand', gated: true }] : []),
```

- [ ] **Step 11: Run the full AppShell test suite**

Run: `npx vitest run src/components/layout/AppShell.test.tsx`
Expected: all PASS

- [ ] **Step 12: Manual verification in the running app**

Run: `npm run dev`
With the same tournament from Task 10's manual check, play out the full placement cohort, visit `/final-standings`, and confirm the ranking table shows correct places and team names, with "ausstehend" shown for any cohort still incomplete.

- [ ] **Step 13: Commit**

```bash
git add src/pages/FinalStandingsPage.tsx src/pages/FinalStandingsPage.test.tsx src/App.tsx src/components/layout/AppShell.tsx
git commit -m "feat: add final standings page for Endrunde 4"
```

---

## Task 12: Capacity warning for many placement-cohort games

**Files:**
- Modify: `src/components/config/FinalsVariantForm.tsx`
- Modify: `src/components/config/FinalsVariantForm.test.tsx`

Endrunde 4 with many groups produces a proportional number of extra games (e.g. 8 groups of 4 → 4 rank tiers × 6 round-robin games each = 24 extra games). Per the design spec this needs a non-blocking capacity Alert, not a hard block — the full solution (multi-day venues) is a separate future feature; this is just a heads-up so the organizer can add fields/time or reconsider before generating.

- [ ] **Step 1: Write the failing test**

Add to `src/components/config/FinalsVariantForm.test.tsx`:

```typescript
it('shows a capacity warning when Endrunde 4 would generate many extra games', () => {
  useTournamentStore.setState({
    tournament: {
      ...useTournamentStore.getState().tournament,
      groupCount: 8,
      finalsVariant: 'endrunde-4',
      teams: Array.from({ length: 32 }, (_, i) => ({
        id: `t${i}`, name: `T${i}`, logoUrl: '', color: '#000', contact: '', players: [],
        groupId: String.fromCharCode(65 + (i % 8)),
      })),
    },
  })
  render(<FinalsVariantForm />)
  expect(screen.getByText(/zusätzliche Spiele/i)).toBeInTheDocument()
})

it('does not show a capacity warning for a small Endrunde 4 setup', () => {
  useTournamentStore.setState({
    tournament: {
      ...useTournamentStore.getState().tournament,
      groupCount: 2,
      finalsVariant: 'endrunde-4',
      teams: [
        { id: 't1', name: 'T1', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
        { id: 't2', name: 'T2', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
        { id: 't3', name: 'T3', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'B' },
        { id: 't4', name: 'T4', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'B' },
      ],
    },
  })
  render(<FinalsVariantForm />)
  expect(screen.queryByText(/zusätzliche Spiele/i)).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/config/FinalsVariantForm.test.tsx -t "capacity"`
Expected: FAIL — no capacity warning exists yet.

- [ ] **Step 3: Implement**

In `src/components/config/FinalsVariantForm.tsx`, add this calculation (a round-robin of `n` teams plays `n*(n-1)/2` games; each rank tier's cohort size is the number of groups, capped implicitly since Endrunde 4 only forms as many tiers as the smallest group has ranks — for a heads-up estimate, assume every group reaches every tier, which is the common case and errs toward slightly overestimating rather than underestimating):

```typescript
  const groupCount = tournament.groupCount ?? 1
  const smallestGroupSize = sizes.length > 0 ? Math.min(...sizes) : 0
  const gamesPerCohort = (groupCount * (groupCount - 1)) / 2
  const estimatedExtraGames = smallestGroupSize * gamesPerCohort
  const showCapacityWarning = estimatedExtraGames >= 20
```

Add this Alert block right after the uneven-groups Alert (inside the same component's returned JSX, before the dropout-handling section):

```tsx
      {showCapacityWarning && (
        <Alert>
          <AlertDescription>
            Diese Konfiguration erzeugt schätzungsweise {estimatedExtraGames} zusätzliche Spiele für
            die Endrunde. Prüfe, ob die verfügbare Hallenzeit und Feldanzahl dafür ausreichen —
            ansonsten Gruppenanzahl reduzieren oder mehr Felder/Zeit einplanen.
          </AlertDescription>
        </Alert>
      )}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/config/FinalsVariantForm.test.tsx`
Expected: PASS (all tests in this file, including the two new ones)

- [ ] **Step 5: Commit**

```bash
git add src/components/config/FinalsVariantForm.tsx src/components/config/FinalsVariantForm.test.tsx
git commit -m "feat: warn when Endrunde 4 would generate a large number of extra games"
```

---

## Task 13: Full regression pass + typecheck + lint

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests PASS, no failures introduced in unrelated files (swiss, export, import, etc.)

- [ ] **Step 2: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Run lint**

Run: `npm run lint` (check `package.json` for the actual script name if this doesn't exist)
Expected: no new lint errors

- [ ] **Step 4: Manual end-to-end walkthrough**

Run: `npm run dev`. From a clean tournament: Teams → add 8 teams → Konfiguration → mode "Gruppenphase + Endrunde", 2 groups, finalsVariant "Endrunde 4" → generate schedule → Ergebnisse erfassen (group games) → play out both groups fully → Endrunde: Ergebnisse (finals-results) shows resolved placement games → play them out → Endstand shows the full 1-N ranking. Also test: withdraw a team mid-group-phase (Teams page's existing withdraw control, if present — check `TeamsPage.tsx` for whether withdrawal is exposed there or only reachable via the store directly; if there's no existing UI entry point for `withdrawTeam` outside swiss mode, note this as a follow-up gap rather than blocking this plan, since building that UI entry point was not in this plan's task list — flag it to the user after this task).

- [ ] **Step 5: Report any UI gap found in Step 4 to the user**

If Step 4 reveals there is no existing button/control that calls `withdrawTeam` for a non-swiss tournament (likely, since the withdraw button referenced in the withdraw-UX design spec was built for swiss mode), do not silently skip this — the withdrawal logic (Tasks 8-9) is otherwise unreachable from the UI for group/finals stages. Surface this explicitly rather than assuming it's out of scope.

---

## Post-plan note: what's deliberately NOT in this phase

Per the design spec and the scoping conversation that produced this plan, Phase 2 (a separate future plan) covers: `endrunde-1`, `endrunde-2`, `endrunde-2a`, `endrunde-2b`, `endrunde-2c`, `endrunde-3` (all KO-bracket variants), the generalized `buildSeededBracket` (any power-of-2 bracket size), third-place games for KO brackets, the wildcard/next-best-fills-in qualifier logic for KO variants (the `computeGroupPhaseBuchholz` helper from Task 2 is already in place for this — Phase 2 just needs to call it), the seeding cross-table config UI, and the capacity warning for many-rank-tier variants. Demo tournaments and manual documentation updates for Endrunde 4 specifically should be added now if time allows (see the spec's "Demo-Tournaments" section) but are not blocking for the imminent real tournament and can trail slightly behind if needed — flag this to the user rather than silently dropping it.
