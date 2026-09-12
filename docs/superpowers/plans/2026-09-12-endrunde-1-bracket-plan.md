# Endrunde 1 (Mehrfach-KO-Bracket je Rangstufe) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement "Endrunde 1" — after the group phase, every rank tier (all group-winners, all
group-runners-up, ...) plays its own KO bracket (quarterfinal/semifinal/final/third-place as
needed) for its own place range, restricted to group counts that are an exact power of 2 (2, 4, 8,
16, 32).

**Architecture:** Migrate the existing fixed `homeSourceSemifinal`/`awaySourceSemifinal` pointers
(introduced for Endrunde 3) to generic `homeSourceMatch`/`awaySourceMatch: {stage, matchIndex,
outcome}` pointers that scale to arbitrary bracket depth. Add a new `buildBracket()` generator
that recursively builds a KO tree of any supported size, generalizing the existing
`finalsBracketSize === 4` branch in `playoff-generator.ts`. Wire it into `generateSchedule` once
per rank tier (reusing the rank-tier-count logic already used by Endrunde 4). Extend
`resolvePlaceholders` to resolve matches generically by `{stage, matchIndex}` instead of a fixed
two-semifinal assumption. Add a new tab-based results page and a new final-standings aggregator.

**Tech Stack:** TypeScript, Vitest (unit + coverage), Playwright (E2E), React, Zustand.

---

## Important context for every task

- Work happens in the existing worktree at
  `/Users/oliver-marcuseder/01-vibe-coding/00-Basektball/08-Fibalon-Baskets/02-turnier-manager/.worktrees/feature-endrunde-1`,
  branch `feature/endrunde-1`. Run all commands from that directory.
- Design spec: `docs/superpowers/specs/2026-09-12-endrunde-1-bracket-design.md` — read it before
  starting if anything in this plan is unclear about *why*, not just *what*.
- After every task: run `npx vitest run` (must stay at the count noted per task, no regressions)
  and `npx tsc --noEmit` (must be clean) before committing.
- Coverage: after Task 3 (once `@vitest/coverage-v8` config exists — it already does, from a
  prior session), run `npm run test:coverage` at the end of each task that touches
  `src/lib/**`/`src/store/**` and confirm no per-file threshold violation. If one appears, add the
  missing test case for that specific branch before moving to the next task — don't defer it.
- German UI strings and error messages throughout — match the existing tone (formal, teacher/coach
  addressing an organizer) seen in sibling files.
- Commit after each task with a message describing the *why*, matching the repo's existing commit
  style (see `git log --oneline` for examples — no comment describing what the diff shows, since
  that's visible in the diff itself).

---

### Task 1: Migrate the data model — generic match-source pointers

**Files:**
- Modify: `src/types/index.ts:73-106`
- Test: no dedicated test file for types; verified via the type-checker and by the tests touched
  in Tasks 2-4 compiling.

- [ ] **Step 1: Update `GameStage` and the `Game` interface**

Replace lines 73-106 of `src/types/index.ts` with:

```typescript
export type GameStage =
  | 'group' | 'swiss' | 'placement'
  | 'round-of-32' | 'round-of-16' | 'quarterfinal' | 'semifinal' | 'final' | 'third-place'
  // 'placement' = a round-robin placement-cohort game (Endrunde 4), e.g. "all group winners play
  // each other for places 1-4"
  // 'round-of-32' | 'round-of-16' | 'quarterfinal' | 'semifinal' = named KO-bracket rounds,
  // supporting bracket sizes up to 32 (Endrunde 1 and 3)
  // 'third-place' = the losers of the two semifinals play each other for place 3

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
  groupId?: string        // which group this game belongs to (only stage === 'group' with multiple groups)
  rankTier?: number  // which placement cohort or KO bracket this game belongs to (1 = group
    // winners, 2 = runners-up, ...); set for stage === 'placement' (Endrunde 4) AND for all KO
    // bracket stages (Endrunde 1/3) — a KO game's rankTier + stage + matchIndex together identify
    // it uniquely, since multiple rank tiers can each have their own quarterfinal running at once.
  placementFrom?: number  // the best (lowest-numbered) place this cohort/bracket is playing for,
    // e.g. 1, 5, 9; used to label/sort the final standings page
  matchIndex?: number  // 0-based index of this game among all games sharing the same {rankTier,
    // stage} — e.g. a rankTier-1 bracket's 4 quarterfinal games have matchIndex 0-3, its 2
    // semifinal games have matchIndex 0-1. Only set for KO bracket stages.
  homeSourceRank?: { groupId: string; rank: number }  // which group-phase rank feeds the home slot;
    // stays set even after resolution, so a later group-phase correction can re-resolve this slot.
    // Only set on a bracket's FIRST round (its qualifying round) and on 'placement' games.
  awaySourceRank?: { groupId: string; rank: number }  // same for the away slot
  homeSourceMatch?: { stage: GameStage; matchIndex: number; outcome: 'winner' | 'loser' }  // which
    // earlier-round match's winner/loser feeds the home slot; stays set even after resolution, so
    // a later result correction can re-resolve this slot. Only set on bracket rounds AFTER the
    // first (semifinal onward for a 4-bracket, quarterfinal onward for an 8-bracket, etc.).
  awaySourceMatch?: { stage: GameStage; matchIndex: number; outcome: 'winner' | 'loser' }  // same for the away slot
}
```

This removes `homeSourceSemifinal`/`awaySourceSemifinal` entirely (no parallel field — every
consumer is migrated in the tasks below).

- [ ] **Step 2: Confirm the type-checker now shows the expected breakage**

Run: `npx tsc --noEmit`

Expected: several errors in `src/lib/playoff-generator.ts`, `src/store/tournament-store.ts`,
`src/lib/playoff-generator.test.ts`, `src/store/tournament-store.test.ts`, and
`src/pages/PlayoffResultsPage.test.tsx` referencing `homeSourceSemifinal`/`awaySourceSemifinal`/
`semifinalIndex` not existing. This confirms Step 1 took effect — these are fixed in Tasks 2-5.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "$(cat <<'EOF'
refactor: generalize match-source pointers for arbitrary bracket depth

homeSourceSemifinal/awaySourceSemifinal (Endrunde 3) hardcoded a fixed
semifinalIndex: 1|2, which can't represent a quarterfinal->semifinal
link or any bracket deeper than 4. Replaces them with generic
homeSourceMatch/awaySourceMatch: {stage, matchIndex, outcome}, plus a
new matchIndex field on Game itself (0-based position among games
sharing the same {rankTier, stage}) and three new GameStage values
(round-of-32, round-of-16, quarterfinal) to name the additional KO
rounds a bracket of up to 32 needs.

This is a straight migration, not an additive change -- the type
checker will show every call site that needs updating next.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ALVWiCue7JpbdjkwWKAH4p
EOF
)"
```

---

### Task 2: Migrate `playoff-generator.ts` and its tests to the new pointer model

**Files:**
- Modify: `src/lib/playoff-generator.ts:140-172`
- Modify: `src/lib/playoff-generator.test.ts:80-92`

- [ ] **Step 1: Update the failing test expectations first**

In `src/lib/playoff-generator.test.ts`, replace lines 80-92 (inside the `'bracket size 4 with 2
fields...'` test) with:

```typescript
    expect(thirdPlace.stage).toBe('third-place')
    expect(thirdPlace.homeLabel).toBe('Verlierer HF 1')
    expect(thirdPlace.awayLabel).toBe('Verlierer HF 2')
    expect(thirdPlace.homeSourceMatch).toEqual({ stage: 'semifinal', matchIndex: 0, outcome: 'loser' })
    expect(thirdPlace.awaySourceMatch).toEqual({ stage: 'semifinal', matchIndex: 1, outcome: 'loser' })

    expect(final.stage).toBe('final')
    expect(final.homeLabel).toBe('Sieger HF 1')
    expect(final.awayLabel).toBe('Sieger HF 2')
    expect(final.field).toBe(1)
    expect(final.gameNumber).toBe(10)
    expect(final.homeSourceMatch).toEqual({ stage: 'semifinal', matchIndex: 0, outcome: 'winner' })
    expect(final.awaySourceMatch).toEqual({ stage: 'semifinal', matchIndex: 1, outcome: 'winner' })
  })
```

(Note: `matchIndex` is 0-based, so semifinal 1 is `matchIndex: 0` and semifinal 2 is
`matchIndex: 1` — this changes the *values* compared to the old 1-based `semifinalIndex`, not just
the field name.)

- [ ] **Step 2: Run the test file to confirm it fails on the new expectations**

Run: `npx vitest run src/lib/playoff-generator.test.ts`

Expected: FAIL on the `'bracket size 4 with 2 fields...'` test — `thirdPlace.homeSourceMatch` is
`undefined` (the source still writes the old field name).

- [ ] **Step 3: Update `generatePlayoffGames` to emit the new fields**

In `src/lib/playoff-generator.ts`, also add `matchIndex` to both semifinal games (they didn't
carry one before, since the old model didn't need it — the new generic resolver in Task 4 needs
it to look games up by `{stage, matchIndex}`). Replace lines 48-65 (first semifinal push) with:

```typescript
    games.push({
      id: uuidv4(),
      homeTeamId: null,
      awayTeamId: null,
      homeLabel: '1. der Vorrunde',
      awayLabel: '4. der Vorrunde',
      stage: 'semifinal',
      matchIndex: 0,
      field: 1,
      scheduledStart: sf1Start,
      scheduledEnd: sf1End,
      round: 2,
      gameNumber: gameNumber++,
      periodScores: [],
      ...(qualifierSourceRanks && {
        homeSourceRank: qualifierSourceRanks[0],
        awaySourceRank: qualifierSourceRanks[1],
      }),
    })
```

Replace lines 81-98 (second semifinal push) with:

```typescript
    games.push({
      id: uuidv4(),
      homeTeamId: null,
      awayTeamId: null,
      homeLabel: '2. der Vorrunde',
      awayLabel: '3. der Vorrunde',
      stage: 'semifinal',
      matchIndex: 1,
      field: sf2Field,
      scheduledStart: sf2Start,
      scheduledEnd: sf2End,
      round: 2,
      gameNumber: gameNumber++,
      periodScores: [],
      ...(qualifierSourceRanks && {
        homeSourceRank: qualifierSourceRanks[2],
        awaySourceRank: qualifierSourceRanks[3],
      }),
    })
```

Replace lines 140-155 (third-place push) with:

```typescript
    games.push({
      id: uuidv4(),
      homeTeamId: null,
      awayTeamId: null,
      homeLabel: 'Verlierer HF 1',
      awayLabel: 'Verlierer HF 2',
      stage: 'third-place',
      matchIndex: 0,
      field: thirdPlaceField,
      scheduledStart: thirdPlaceStart,
      scheduledEnd: thirdPlaceStart === roundThreeStart ? roundThreeEnd : addMinutes(thirdPlaceStart, gameDuration),
      round: 3,
      gameNumber: gameNumber++,
      periodScores: [],
      homeSourceMatch: { stage: 'semifinal', matchIndex: 0, outcome: 'loser' },
      awaySourceMatch: { stage: 'semifinal', matchIndex: 1, outcome: 'loser' },
    })
```

Replace lines 157-172 (final push) with:

```typescript
    games.push({
      id: uuidv4(),
      homeTeamId: null,
      awayTeamId: null,
      homeLabel: 'Sieger HF 1',
      awayLabel: 'Sieger HF 2',
      stage: 'final',
      matchIndex: 0,
      field: finalField,
      scheduledStart: finalStart,
      scheduledEnd: addMinutes(finalStart, gameDuration),
      round: 3,
      gameNumber: gameNumber++,
      periodScores: [],
      homeSourceMatch: { stage: 'semifinal', matchIndex: 0, outcome: 'winner' },
      awaySourceMatch: { stage: 'semifinal', matchIndex: 1, outcome: 'winner' },
    })
```

- [ ] **Step 4: Run the test file to confirm it now passes**

Run: `npx vitest run src/lib/playoff-generator.test.ts`

Expected: PASS, all 8 tests.

- [ ] **Step 5: Full check**

Run: `npx tsc --noEmit && npx vitest run`

Expected: `tsc` clean except for remaining errors in `tournament-store.ts` / `.test.ts` /
`PlayoffResultsPage.test.tsx` (fixed in Tasks 3-4). `vitest run` will show failures in
`src/store/tournament-store.test.ts` and `src/pages/PlayoffResultsPage.test.tsx` — expected at
this point, fixed next.

- [ ] **Step 6: Commit**

```bash
git add src/lib/playoff-generator.ts src/lib/playoff-generator.test.ts
git commit -m "$(cat <<'EOF'
refactor: migrate playoff-generator.ts to generic match-source pointers

Updates generatePlayoffGames' third-place and final games to use the
new homeSourceMatch/awaySourceMatch fields instead of the removed
homeSourceSemifinal/awaySourceSemifinal, and adds matchIndex (0-based)
to both semifinal games so later resolution logic can look games up
generically by {rankTier, stage, matchIndex} instead of a hardcoded
two-semifinal assumption.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ALVWiCue7JpbdjkwWKAH4p
EOF
)"
```

---

### Task 3: Migrate `resolvePlaceholders` (tournament-store.ts) to generic match resolution

**Files:**
- Modify: `src/store/tournament-store.ts:246-329`
- Modify: `src/store/tournament-store.test.ts:598-751` (approximate range; search for
  `homeSourceSemifinal`/`awaySourceSemifinal` to find exact lines, since Task 1/2 edits may have
  shifted line numbers slightly)

This task also fixes a latent bug in the current code, not just renames it: the existing
`semifinalsByIndex` map is built from `games.filter(g => g.stage === 'semifinal')` **globally**,
taking the first two matches in the whole schedule. That's correct only because Endrunde 3 has
exactly one bracket (2 semifinals total). Endrunde 1 will have multiple rank tiers, each with
their own semifinal games — a global "first two semifinals" lookup would silently mix up
different rank tiers' brackets. The new resolver must scope the lookup by `rankTier`.

- [ ] **Step 1: Update the existing tests' fixtures to the new field names first**

In `src/store/tournament-store.test.ts`, every game object that currently has
`homeSourceSemifinal: { semifinalIndex: N as const, outcome: '...' as const }` needs to become
`homeSourceMatch: { stage: 'semifinal' as const, matchIndex: N - 1, outcome: '...' as const }`
(matchIndex is 0-based, so semifinalIndex 1 → matchIndex 0, semifinalIndex 2 → matchIndex 1).
There are 4 occurrences of each field (`homeSourceSemifinal` and `awaySourceSemifinal`) — find them
with:

```bash
grep -n "homeSourceSemifinal\|awaySourceSemifinal" src/store/tournament-store.test.ts
```

Replace every occurrence following that mapping. For example, this existing block:

```typescript
    const thirdPlace = {
      id: 'tp1', homeTeamId: null, awayTeamId: null, stage: 'third-place' as const, field: 2,
      scheduledStart: '11:00', scheduledEnd: '11:30', round: 3, gameNumber: 3, periodScores: [],
      homeSourceSemifinal: { semifinalIndex: 1 as const, outcome: 'loser' as const },
      awaySourceSemifinal: { semifinalIndex: 2 as const, outcome: 'loser' as const },
    }
```

becomes:

```typescript
    const thirdPlace = {
      id: 'tp1', homeTeamId: null, awayTeamId: null, stage: 'third-place' as const, field: 2,
      scheduledStart: '11:00', scheduledEnd: '11:30', round: 3, gameNumber: 3, periodScores: [],
      homeSourceMatch: { stage: 'semifinal' as const, matchIndex: 0, outcome: 'loser' as const },
      awaySourceMatch: { stage: 'semifinal' as const, matchIndex: 1, outcome: 'loser' as const },
    }
```

Also, every `semifinal`-stage game object in these tests (`sf1`, `sf2` fixtures) needs a
`matchIndex` field added: `sf1` gets `matchIndex: 0`, `sf2` gets `matchIndex: 1`. These fixtures
currently have no `matchIndex` at all — add it alongside `stage: 'semifinal' as const`.

Additionally, every one of these test tournaments needs `groupCount: 1` and a `rankTier` on every
KO-stage game object it constructs, since the new resolver (Step 3 below) scopes its lookup by
`rankTier`. Add `rankTier: 1` to every `semifinal`/`final`/`third-place` game fixture in this test
file (the existing fixtures that test this resolution logic all implicitly assume a single
bracket, which is rank tier 1).

- [ ] **Step 2: Run the affected tests to confirm they now fail on the missing new fields**

Run: `npx vitest run src/store/tournament-store.test.ts`

Expected: FAIL — the resolver in the source still reads the old field names, so the new
`homeSourceMatch`/`matchIndex` fixtures aren't picked up and resolution doesn't happen as expected
in the affected tests (search output for the specific test names: `'resolves the final and
third-place game from semifinal results...'`, `'does not resolve the final/third-place game
while...'`, `'re-resolves the final after a semifinal result correction...'`).

- [ ] **Step 3: Rewrite the resolver in `src/store/tournament-store.ts`**

Replace lines 246-329 (the `semifinalOutcomeTeamId` function through the end of
`resolvePlaceholders`) with:

```typescript
/**
 * Determines the winner/loser team ID of a completed match, or undefined if it hasn't been scored
 * yet or was cancelled (a cancelled match has no meaningful winner/loser to feed forward).
 */
function matchOutcomeTeamId(match: Game | undefined, outcome: 'winner' | 'loser'): string | undefined {
  if (!match || match.cancelledReason || match.periodScores.length === 0) return undefined
  if (!match.homeTeamId || !match.awayTeamId) return undefined
  const { home, away } = computeFinalScore(match)
  if (home === away) return undefined // no winner/loser on an unresolved draw
  const winnerId = home > away ? match.homeTeamId : match.awayTeamId
  const loserId = home > away ? match.awayTeamId : match.homeTeamId
  return outcome === 'winner' ? winnerId : loserId
}

/**
 * Fills in real team IDs on any 'placement' (Endrunde 4) or KO-bracket game (Endrunde 1/3: any of
 * 'round-of-32' | 'round-of-16' | 'quarterfinal' | 'semifinal' | 'final' | 'third-place') whose
 * source pointers can now be resolved:
 *
 * - Any game with homeSourceRank/awaySourceRank (placement games, and a KO bracket's qualifying
 *   round) resolves from group-phase standings once the pointed-at group is fully scored — a
 *   group counts as "fully scored" when every one of its group-stage games has either a result or
 *   a cancellation reason (mirrors the existing isRoundFullyEvaluated pattern, but per-group
 *   instead of per-swiss-round).
 * - Any game with homeSourceMatch/awaySourceMatch (every KO round after the qualifying round)
 *   resolves once the pointed-at match (same rankTier, given stage + matchIndex) has itself been
 *   scored — its winner feeds one side, its loser the other, per each pointer's `outcome`.
 *
 * Match lookups are scoped by rankTier: Endrunde 1 runs multiple independent brackets in parallel
 * (one per rank tier), so a "semifinal, matchIndex 0" pointer must resolve against THIS bracket's
 * semifinal, not some other rank tier's.
 *
 * Re-runs unconditionally for every such game whose OWN periodScores are still empty, so a later
 * correction (of a group-stage OR bracket-match result) can flip the resolved team — the source
 * pointers are never cleared, exactly so this re-resolution can happen without needing separate
 * bookkeeping. A game that has already been scored itself is left untouched, regardless of what its
 * source stage does afterward. A withdrawn team is excluded from the qualifying ranks (see
 * standingsByGroup below) — walkover wins it banked before withdrawing must not let it occupy a
 * placement-cohort or bracket slot.
 */
function resolvePlaceholders(games: Game[], teams: Team[]): Game[] {
  const groupIds = [...new Set(teams.map(t => t.groupId ?? 'A'))]
  const groupIsComplete = new Map<string, boolean>()
  for (const groupId of groupIds) {
    const groupGames = games.filter(g => g.stage === 'group' && (g.groupId ?? 'A') === groupId)
    groupIsComplete.set(groupId, groupGames.length > 0 && groupGames.every(g => g.cancelledReason || g.periodScores.length > 0))
  }

  // Recomputed on every submitGameResult/correctGameResult call, not cached across calls — cheap
  // at this app's tournament sizes (small team/group counts), so not worth the added complexity.
  // A withdrawn team is excluded from the qualifying ranks — walkover wins it banked before
  // withdrawing must not let it occupy a placement-cohort slot (Endrunde 4 has no
  // wildcard/next-best-fills-in concept, so the slot simply is not filled from this group).
  const standingsByGroup = new Map(
    groupIds.map(id => [id, computeGroupStandings(teams, games, id).filter(s => !s.withdrawn)]),
  )

  // Keyed by `${rankTier ?? 1}:${stage}:${matchIndex}` — rankTier defaults to 1 for the
  // pre-existing simple round-robin+finals feature and Endrunde 3, neither of which sets rankTier.
  const matchesByKey = new Map<string, Game>()
  for (const g of games) {
    if (g.matchIndex === undefined) continue
    matchesByKey.set(`${g.rankTier ?? 1}:${g.stage}:${g.matchIndex}`, g)
  }

  return games.map(g => {
    if (g.periodScores.length > 0) return g
    if (g.stage !== 'placement' && g.stage !== 'round-of-32' && g.stage !== 'round-of-16' &&
        g.stage !== 'quarterfinal' && g.stage !== 'semifinal' && g.stage !== 'final' && g.stage !== 'third-place') {
      return g
    }

    let { homeTeamId, awayTeamId } = g
    const { homeSourceRank, awaySourceRank, homeSourceMatch, awaySourceMatch } = g

    if (homeSourceRank && groupIsComplete.get(homeSourceRank.groupId)) {
      const standing = standingsByGroup.get(homeSourceRank.groupId)?.[homeSourceRank.rank - 1]
      if (standing) homeTeamId = standing.teamId
    }
    if (awaySourceRank && groupIsComplete.get(awaySourceRank.groupId)) {
      const standing = standingsByGroup.get(awaySourceRank.groupId)?.[awaySourceRank.rank - 1]
      if (standing) awayTeamId = standing.teamId
    }
    if (homeSourceMatch) {
      const sourceGame = matchesByKey.get(`${g.rankTier ?? 1}:${homeSourceMatch.stage}:${homeSourceMatch.matchIndex}`)
      const teamId = matchOutcomeTeamId(sourceGame, homeSourceMatch.outcome)
      if (teamId) homeTeamId = teamId
    }
    if (awaySourceMatch) {
      const sourceGame = matchesByKey.get(`${g.rankTier ?? 1}:${awaySourceMatch.stage}:${awaySourceMatch.matchIndex}`)
      const teamId = matchOutcomeTeamId(sourceGame, awaySourceMatch.outcome)
      if (teamId) awayTeamId = teamId
    }

    if (homeTeamId === g.homeTeamId && awayTeamId === g.awayTeamId) return g
    return { ...g, homeTeamId, awayTeamId }
  })
}
```

- [ ] **Step 4: Run the tests again**

Run: `npx vitest run src/store/tournament-store.test.ts`

Expected: PASS, all tests in this file.

- [ ] **Step 5: Full suite + typecheck**

Run: `npx tsc --noEmit && npx vitest run`

Expected: `tsc` clean except for `PlayoffResultsPage.test.tsx` (fixed in Task 4). `vitest run` will
still show that one file failing — expected at this point.

- [ ] **Step 6: Coverage check on the changed file**

Run: `npm run test:coverage`

Expected: no threshold error mentioning `tournament-store.ts`. If one appears, identify the
uncovered branch from the printed line numbers and add a targeted test case to
`src/store/tournament-store.test.ts` before proceeding (e.g. a case where `matchesByKey.get(...)`
returns `undefined` because the source match doesn't exist yet at all, exercising the
`sourceGame` being `undefined` branch inside `matchOutcomeTeamId`).

- [ ] **Step 7: Commit**

```bash
git add src/store/tournament-store.ts src/store/tournament-store.test.ts
git commit -m "$(cat <<'EOF'
refactor: resolve KO-bracket placeholders generically by rankTier+stage+matchIndex

Replaces the semifinal-specific resolution logic (which assumed
exactly one bracket, found via "the first two semifinal games in the
whole schedule") with a generic lookup keyed by {rankTier, stage,
matchIndex}. This was a real latent bug for the upcoming Endrunde 1
feature: with multiple rank tiers each running their own parallel
bracket, a global "first two semifinals" lookup would have resolved a
final against the wrong rank tier's semifinal results. rankTier
defaults to 1 for the pre-existing simple bracket and Endrunde 3,
neither of which sets it, so this is not a behavior change for them.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ALVWiCue7JpbdjkwWKAH4p
EOF
)"
```

---

### Task 4: Migrate `PlayoffResultsPage.test.tsx` fixtures

**Files:**
- Modify: `src/pages/PlayoffResultsPage.test.tsx:34-47`

- [ ] **Step 1: Update the test fixtures**

Replace lines 34-47 of `src/pages/PlayoffResultsPage.test.tsx` with:

```typescript
          {
            id: 'sf1', homeTeamId: 't1', awayTeamId: 't4', stage: 'semifinal', matchIndex: 0, field: 1,
            scheduledStart: '10:00', scheduledEnd: '10:30', round: 2, gameNumber: 1, periodScores: [],
            homeLabel: '1. der Vorrunde', awayLabel: '4. der Vorrunde',
          },
          {
            id: 'sf2', homeTeamId: 't2', awayTeamId: 't3', stage: 'semifinal', matchIndex: 1, field: 2,
            scheduledStart: '10:00', scheduledEnd: '10:30', round: 2, gameNumber: 2, periodScores: [],
            homeLabel: '2. der Vorrunde', awayLabel: '3. der Vorrunde',
          },
          {
            id: 'tp1', homeTeamId: null, awayTeamId: null, stage: 'third-place', matchIndex: 0, field: 2,
            scheduledStart: '11:00', scheduledEnd: '11:30', round: 3, gameNumber: 3, periodScores: [],
            homeLabel: 'Verlierer HF 1', awayLabel: 'Verlierer HF 2',
            homeSourceMatch: { stage: 'semifinal', matchIndex: 0, outcome: 'loser' },
            awaySourceMatch: { stage: 'semifinal', matchIndex: 1, outcome: 'loser' },
          },
          {
            id: 'f1', homeTeamId: null, awayTeamId: null, stage: 'final', matchIndex: 0, field: 1,
            scheduledStart: '11:00', scheduledEnd: '11:30', round: 3, gameNumber: 4, periodScores: [],
            homeLabel: 'Sieger HF 1', awayLabel: 'Sieger HF 2',
            homeSourceMatch: { stage: 'semifinal', matchIndex: 0, outcome: 'winner' },
            awaySourceMatch: { stage: 'semifinal', matchIndex: 1, outcome: 'winner' },
          },
```

- [ ] **Step 2: Run the full test suite and typecheck**

Run: `npx tsc --noEmit && npx vitest run`

Expected: both clean — 343 tests passing (the baseline count from before this plan started; run
`npx vitest run` once at the very start of Task 1 if you want to confirm the exact starting
number in your environment, since demo-tournament-generation tests etc. may shift it slightly
between sessions).

- [ ] **Step 3: Commit**

```bash
git add src/pages/PlayoffResultsPage.test.tsx
git commit -m "$(cat <<'EOF'
refactor: migrate PlayoffResultsPage test fixtures to new match-source pointers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ALVWiCue7JpbdjkwWKAH4p
EOF
)"
```

---

### Task 5: E2E-first — write the failing critical-process test for Endrunde 1

Per the user's explicit process requirement: before building any new generator/store logic for
Endrunde 1 itself, write the end-to-end test for the full organizer flow. It must fail for the
right reason (feature doesn't exist yet), not a typo — verify the failure message names something
genuinely missing (e.g. the "Endrunde 1" option not existing yet), not a broken selector.

**Files:**
- Create: `e2e/endrunde-1.spec.ts`

- [ ] **Step 1: Write the E2E spec**

```typescript
import { test, expect } from '@playwright/test'
import { addTeam, selectMode } from './helpers'

// End-to-end coverage of the critical Endrunde 1 process: configuration with 8 groups (2 rank
// tiers, each an 8-team-wide... no, an 8-GROUP-wide bracket of size 8), group phase, automatic
// qualification into TWO parallel KO brackets (rank tier 1 for places 1-8, rank tier 2 for places
// 9-16), playing both brackets to completion, and a combined final standing. This is exactly the
// flow a real organizer follows, so it must be verified in a real browser, not just via unit
// tests on the underlying generator/store functions.

test('organizer plays a full Endrunde 1 tournament with two parallel rank-tier brackets', async ({ page }) => {
  await page.goto('/teams')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  // 16 teams, 8 groups of 2 -> smallest group size is 2, so there are 2 rank tiers, each an
  // 8-team bracket (rank tier 1: all group-winners, places 1-8; rank tier 2: all
  // group-runners-up, places 9-16).
  for (let i = 1; i <= 16; i++) {
    await addTeam(page, `Team ${i}`)
  }

  await page.getByRole('link', { name: 'Konfiguration' }).click()
  await selectMode(page, 'Gruppenphase + Endrunde')
  await page.getByLabel('Anzahl Gruppen').fill('8')

  // Split into groups A-H, 2 teams each: 1,2 -> A (default is all-A, so only move the rest).
  const groupLetters = ['B', 'C', 'D', 'E', 'F', 'G', 'H']
  for (let g = 0; g < groupLetters.length; g++) {
    const first = 3 + g * 2
    await page.getByLabel(`Gruppe für Team ${first}`).selectOption(groupLetters[g])
    await page.getByLabel(`Gruppe für Team ${first + 1}`).selectOption(groupLetters[g])
  }

  await expect(page.getByLabel('Endrunden-Variante')).toBeVisible()
  await page.getByLabel('Endrunden-Variante').selectOption('endrunde-1')

  await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
  await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()

  // Each group of 2 plays 1 game -> 8 group games total. Home team wins every game, so
  // "Team <odd>" (the first team added to each group, listed as home) wins every group.
  await page.getByRole('link', { name: 'Ergebnisse erfassen' }).click()
  for (let i = 0; i < 8; i++) {
    await page.getByLabel(/^Ergebnis Heim, Spiel/).first().fill('20')
    await page.getByLabel(/^Ergebnis Auswärts, Spiel/).first().fill('10')
    await page.getByRole('button', { name: 'Speichern' }).first().click()
  }
  await expect(page.getByText('Keine Spiele für die gewählten Filter.')).toBeVisible()

  // Both rank-tier brackets' quarterfinals should now be auto-resolved with real teams.
  await page.getByRole('link', { name: 'Endrunde: KO-Ergebnisse' }).click()
  await expect(page.getByRole('button', { name: /Rangstufe 1/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Rangstufe 2/ })).toBeVisible()

  // Rank tier 1 is the active tab by default: play its 4 quarterfinals, 2 semifinals, then
  // final + third-place.
  await expect(page.getByLabel('Status')).toHaveValue('open')
  for (let round = 0; round < 3; round++) {
    const gamesThisRound = round === 2 ? 2 : (round === 0 ? 4 : 2)
    for (let i = 0; i < gamesThisRound; i++) {
      await page.getByLabel(/^Ergebnis Heim, Spiel/).first().fill('30')
      await page.getByLabel(/^Ergebnis Auswärts, Spiel/).first().fill('20')
      await page.getByRole('button', { name: 'Speichern' }).first().click()
    }
  }
  await expect(page.getByText('Keine Spiele für die gewählten Filter.')).toBeVisible()

  // Switch to rank tier 2's tab and play its bracket the same way.
  await page.getByRole('button', { name: /Rangstufe 2/ }).click()
  await expect(page.getByLabel('Status')).toHaveValue('open')
  for (let round = 0; round < 3; round++) {
    const gamesThisRound = round === 2 ? 2 : (round === 0 ? 4 : 2)
    for (let i = 0; i < gamesThisRound; i++) {
      await page.getByLabel(/^Ergebnis Heim, Spiel/).first().fill('25')
      await page.getByLabel(/^Ergebnis Auswärts, Spiel/).first().fill('15')
      await page.getByRole('button', { name: 'Speichern' }).first().click()
    }
  }
  await expect(page.getByText('Keine Spiele für die gewählten Filter.')).toBeVisible()

  // Combined final standing shows all 16 places.
  await page.getByRole('link', { name: 'Endstand' }).click()
  await expect(page.getByText('16.', { exact: true })).toBeVisible()
  await expect(page.getByText('1.', { exact: true })).toBeVisible()
})
```

- [ ] **Step 2: Run it and confirm it fails for the right reason**

Run: `npx playwright test e2e/endrunde-1.spec.ts --reporter=list`

Expected: FAIL. Read the actual error carefully — at this point in the plan (Tasks 1-4 done,
nothing Endrunde-1-specific built yet), the failure should be at
`await page.getByRole('option', { name: 'endrunde-1' })` / `.selectOption('endrunde-1')` not
matching anything, or similar — i.e., failing because "Endrunde 1" doesn't exist as a config
option yet. If it fails for a different, unexpected reason (e.g. a typo in a selector unrelated
to the missing feature), fix the test itself before proceeding — don't move on with a test that's
failing for the wrong reason.

- [ ] **Step 3: Commit the failing test**

```bash
git add e2e/endrunde-1.spec.ts
git commit -m "$(cat <<'EOF'
test: add failing e2e spec for the full Endrunde 1 critical process

Written before any Endrunde-1-specific implementation, per the
e2e-first process for new user flows: configure 8 groups (2 rank
tiers, each an 8-team bracket), play the group phase, play both
parallel rank-tier brackets (quarterfinal -> semifinal -> final +
third-place) to completion via the tab-based results page, confirm a
combined 1..16 final standing. Currently fails because "Endrunde 1"
doesn't exist as a selectable finals variant yet -- expected, and will
go green only once the full feature (Tasks 6-11) is implemented.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ALVWiCue7JpbdjkwWKAH4p
EOF
)"
```

---

### Task 6: `buildBracket()` — the recursive KO-tree generator

**Files:**
- Modify: `src/lib/finals-variant-generator.ts` (add new function; existing content stays)
- Modify: `src/lib/finals-variant-generator.test.ts` (add new `describe` block)

This is the core new piece of logic. It generalizes `playoff-generator.ts`'s
`finalsBracketSize === 4` branch (Task 2) to any of 2/4/8/16/32, and additionally threads
`rankTier` through every game it creates (something the 4-only version never needed, since
Endrunde 3 only ever has one bracket).

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/finals-variant-generator.test.ts` (after the existing `buildQualifierSeeds`
`describe` block):

```typescript
describe('buildBracket', () => {
  const gameSettings: GameSettings = {
    periodsCount: 4, periodDurationMin: 5, breakBetweenPeriodsMin: 1,
    halfTimeBreakMin: 5, bufferBetweenGamesMin: 5, breakBetweenRoundsMin: 15, awardCeremonyMin: 15,
  }

  it('bracket size 2 generates only a final with rankTier and sourceRanks set', () => {
    const games = buildBracket({
      bracketSize: 2,
      rankTier: 1,
      sourceRanks: [{ groupId: 'A', rank: 1 }, { groupId: 'B', rank: 1 }],
      fields: 2,
      gameSettings,
      blackoutPeriods: [],
      availabilityEnd: '19:30',
      fieldNextFree: ['11:00', '11:00'],
      startGameNumber: 1,
    })
    expect(games).toHaveLength(1)
    const [final] = games
    expect(final.stage).toBe('final')
    expect(final.rankTier).toBe(1)
    expect(final.matchIndex).toBe(0)
    expect(final.homeSourceRank).toEqual({ groupId: 'A', rank: 1 })
    expect(final.awaySourceRank).toEqual({ groupId: 'B', rank: 1 })
  })

  it('bracket size 4 generates 2 semifinals + third-place + final, matching the existing 4-bracket shape', () => {
    const games = buildBracket({
      bracketSize: 4,
      rankTier: 1,
      sourceRanks: [
        { groupId: 'A', rank: 1 }, { groupId: 'D', rank: 1 },
        { groupId: 'B', rank: 1 }, { groupId: 'C', rank: 1 },
      ],
      fields: 2,
      gameSettings,
      blackoutPeriods: [],
      availabilityEnd: '19:30',
      fieldNextFree: ['11:00', '11:00'],
      startGameNumber: 1,
    })
    expect(games).toHaveLength(4)
    const semifinals = games.filter(g => g.stage === 'semifinal')
    const thirdPlace = games.find(g => g.stage === 'third-place')!
    const final = games.find(g => g.stage === 'final')!
    expect(semifinals).toHaveLength(2)
    expect(semifinals[0].matchIndex).toBe(0)
    expect(semifinals[0].homeSourceRank).toEqual({ groupId: 'A', rank: 1 })
    expect(semifinals[0].awaySourceRank).toEqual({ groupId: 'D', rank: 1 })
    expect(semifinals[1].matchIndex).toBe(1)
    expect(semifinals[1].homeSourceRank).toEqual({ groupId: 'B', rank: 1 })
    expect(semifinals[1].awaySourceRank).toEqual({ groupId: 'C', rank: 1 })
    expect(thirdPlace.homeSourceMatch).toEqual({ stage: 'semifinal', matchIndex: 0, outcome: 'loser' })
    expect(thirdPlace.awaySourceMatch).toEqual({ stage: 'semifinal', matchIndex: 1, outcome: 'loser' })
    expect(final.homeSourceMatch).toEqual({ stage: 'semifinal', matchIndex: 0, outcome: 'winner' })
    expect(final.awaySourceMatch).toEqual({ stage: 'semifinal', matchIndex: 1, outcome: 'winner' })
    expect(games.every(g => g.rankTier === 1)).toBe(true)
  })

  it('bracket size 8 generates 4 quarterfinals + 2 semifinals + third-place + final', () => {
    // sourceRanks is ALWAYS pre-paired match order ([match0.home, match0.away, match1.home, ...]),
    // never plain seed order -- this is the exact shape buildQualifierSeeds (Task 7) produces, and
    // buildBracket itself does no seeding/reordering of its own, only sequential pairing. For 8
    // groups A-H, the standard "avoid an early final" bracket seed order is A/H, D/E, B/G, C/F
    // (verified against Task 7's standardBracketSeedOrder(8) = [0,7,3,4,1,6,2,5]).
    const games = buildBracket({
      bracketSize: 8,
      rankTier: 2,
      sourceRanks: [
        { groupId: 'A', rank: 2 }, { groupId: 'H', rank: 2 },
        { groupId: 'D', rank: 2 }, { groupId: 'E', rank: 2 },
        { groupId: 'B', rank: 2 }, { groupId: 'G', rank: 2 },
        { groupId: 'C', rank: 2 }, { groupId: 'F', rank: 2 },
      ],
      fields: 4,
      gameSettings,
      blackoutPeriods: [],
      availabilityEnd: '23:30',
      fieldNextFree: ['11:00', '11:00', '11:00', '11:00'],
      startGameNumber: 1,
    })
    expect(games).toHaveLength(8)
    const quarterfinals = games.filter(g => g.stage === 'quarterfinal')
    const semifinals = games.filter(g => g.stage === 'semifinal')
    const thirdPlace = games.find(g => g.stage === 'third-place')!
    const final = games.find(g => g.stage === 'final')!
    expect(quarterfinals).toHaveLength(4)
    expect(quarterfinals.map(g => g.matchIndex).sort()).toEqual([0, 1, 2, 3])
    expect(semifinals).toHaveLength(2)
    // Semifinal 0 must be fed by quarterfinals 0 and 1 (winners); semifinal 1 by quarterfinals 2 and 3.
    const sf0 = semifinals.find(g => g.matchIndex === 0)!
    const sf1 = semifinals.find(g => g.matchIndex === 1)!
    expect(sf0.homeSourceMatch).toEqual({ stage: 'quarterfinal', matchIndex: 0, outcome: 'winner' })
    expect(sf0.awaySourceMatch).toEqual({ stage: 'quarterfinal', matchIndex: 1, outcome: 'winner' })
    expect(sf1.homeSourceMatch).toEqual({ stage: 'quarterfinal', matchIndex: 2, outcome: 'winner' })
    expect(sf1.awaySourceMatch).toEqual({ stage: 'quarterfinal', matchIndex: 3, outcome: 'winner' })
    expect(thirdPlace.homeSourceMatch).toEqual({ stage: 'semifinal', matchIndex: 0, outcome: 'loser' })
    expect(thirdPlace.awaySourceMatch).toEqual({ stage: 'semifinal', matchIndex: 1, outcome: 'loser' })
    expect(final.homeSourceMatch).toEqual({ stage: 'semifinal', matchIndex: 0, outcome: 'winner' })
    expect(final.awaySourceMatch).toEqual({ stage: 'semifinal', matchIndex: 1, outcome: 'winner' })
    expect(games.every(g => g.rankTier === 2)).toBe(true)
    // matchIndex 0's quarterfinal is fed directly by sourceRanks[0]/[1] -- the first pre-paired
    // matchup, i.e. seed A vs seed H (NOT plain sequential A vs B; buildBracket does not reorder
    // its input, so this is really testing "buildBracket consumes pre-paired input positionally,"
    // not "buildBracket seeds A vs H" -- that seeding decision belongs to buildQualifierSeeds).
    expect(quarterfinals[0].homeSourceRank).toEqual({ groupId: 'A', rank: 2 })
    expect(quarterfinals[0].awaySourceRank).toEqual({ groupId: 'H', rank: 2 })
  })

  it('assigns unique, increasing gameNumbers across all rounds starting from startGameNumber', () => {
    const games = buildBracket({
      bracketSize: 8,
      rankTier: 1,
      sourceRanks: Array.from({ length: 8 }, (_, i) => ({ groupId: String.fromCharCode(65 + i), rank: 1 })),
      fields: 4,
      gameSettings,
      blackoutPeriods: [],
      availabilityEnd: '23:30',
      fieldNextFree: ['11:00', '11:00', '11:00', '11:00'],
      startGameNumber: 50,
    })
    const gameNumbers = games.map(g => g.gameNumber)
    expect(new Set(gameNumbers).size).toBe(8)
    expect(Math.min(...gameNumbers)).toBe(50)
    expect(Math.max(...gameNumbers)).toBe(57)
  })

  it('schedules a later round only after breakBetweenRoundsMin past the latest game of the previous round', () => {
    const games = buildBracket({
      bracketSize: 4,
      rankTier: 1,
      sourceRanks: [
        { groupId: 'A', rank: 1 }, { groupId: 'D', rank: 1 },
        { groupId: 'B', rank: 1 }, { groupId: 'C', rank: 1 },
      ],
      fields: 2,
      gameSettings,
      blackoutPeriods: [],
      availabilityEnd: '19:30',
      fieldNextFree: ['11:00', '11:00'],
      startGameNumber: 1,
    })
    const semifinals = games.filter(g => g.stage === 'semifinal')
    const final = games.find(g => g.stage === 'final')!
    const latestSemiEnd = semifinals.reduce((max, g) => (g.scheduledEnd > max ? g.scheduledEnd : max), '00:00')
    // gameDuration(4*5 + 3*1 + 5 = 28) + bufferBetweenGamesMin(5) + breakBetweenRoundsMin(15) = +20min from latestSemiEnd
    const [h, m] = latestSemiEnd.split(':').map(Number)
    const expected = new Date(0)
    expected.setHours(h, m + 5 + 15)
    const expectedStr = `${String(expected.getHours()).padStart(2, '0')}:${String(expected.getMinutes()).padStart(2, '0')}`
    expect(final.scheduledStart).toBe(expectedStr)
  })

  it('throws when bracketSize does not have exactly enough sourceRanks', () => {
    expect(() =>
      buildBracket({
        bracketSize: 4,
        rankTier: 1,
        sourceRanks: [{ groupId: 'A', rank: 1 }, { groupId: 'B', rank: 1 }],
        fields: 2,
        gameSettings,
        blackoutPeriods: [],
        availabilityEnd: '19:30',
        fieldNextFree: ['11:00', '11:00'],
        startGameNumber: 1,
      })
    ).toThrow('sourceRanks muss genau 4 Einträge für ein 4er-Bracket enthalten')
  })

  it('throws when the venue is too short for any round', () => {
    expect(() =>
      buildBracket({
        bracketSize: 4,
        rankTier: 1,
        sourceRanks: [
          { groupId: 'A', rank: 1 }, { groupId: 'D', rank: 1 },
          { groupId: 'B', rank: 1 }, { groupId: 'C', rank: 1 },
        ],
        fields: 2,
        gameSettings,
        blackoutPeriods: [],
        availabilityEnd: '11:05',
        fieldNextFree: ['11:00', '11:00'],
        startGameNumber: 1,
      })
    ).toThrow('Kein Zeitfenster für die Endrunde verfügbar')
  })
})
```

Also add the necessary import at the top of the test file — check the current imports first:

```bash
head -5 src/lib/finals-variant-generator.test.ts
```

Add `buildBracket` to the existing `import { ... } from './finals-variant-generator'` line.

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx vitest run src/lib/finals-variant-generator.test.ts`

Expected: FAIL with `buildBracket is not a function` (or a TypeScript compile error if run via
`tsc`, but Vitest will report it as a runtime error since `buildBracket` is `undefined`).

- [ ] **Step 3: Implement `buildBracket`**

Add to `src/lib/finals-variant-generator.ts` (after the existing `buildQualifierSeeds`, before
`PlacementCohort`):

```typescript
const BRACKET_STAGE_SEQUENCE: Record<number, GameStage[]> = {
  2: ['final'],
  4: ['semifinal', 'final'],
  8: ['quarterfinal', 'semifinal', 'final'],
  16: ['round-of-16', 'quarterfinal', 'semifinal', 'final'],
  32: ['round-of-32', 'round-of-16', 'quarterfinal', 'semifinal', 'final'],
}

export interface BuildBracketInput {
  bracketSize: 2 | 4 | 8 | 16 | 32
  rankTier: number
  sourceRanks: { groupId: string; rank: number }[]  // bracketSize entries, in seed order
  fields: number
  gameSettings: GameSettings
  blackoutPeriods: TimeWindow[]
  availabilityEnd: string
  fieldNextFree: string[]
  startGameNumber: number
}

/**
 * Builds a complete single-elimination KO bracket for one rank tier: bracketSize teams enter via
 * the first named round (fed by homeSourceRank/awaySourceRank, i.e. group-phase standings), every
 * later round is fed by the previous round's winners (homeSourceMatch/awaySourceMatch), and a
 * third-place game is fed by the two semifinal losers. Generalizes the fixed
 * finalsBracketSize===4 logic in playoff-generator.ts to any of 2/4/8/16/32.
 *
 * Round N+1's game at matchIndex i is fed by round N's games at matchIndex 2i (home) and 2i+1
 * (away) — the standard single-elimination bracket-tree layout, applied recursively per round.
 */
export function buildBracket(input: BuildBracketInput): Game[] {
  const { bracketSize, rankTier, sourceRanks, fields, gameSettings, blackoutPeriods, availabilityEnd, startGameNumber } = input
  const stages = BRACKET_STAGE_SEQUENCE[bracketSize]
  if (sourceRanks.length !== bracketSize) {
    throw new Error(`sourceRanks muss genau ${bracketSize} Einträge für ein ${bracketSize}er-Bracket enthalten`)
  }

  const gameDuration = calcGameDurationMin(gameSettings)
  const slotDuration = gameDuration + gameSettings.bufferBetweenGamesMin
  const fieldClocks = [...input.fieldNextFree]
  const games: Game[] = []
  let gameNumber = startGameNumber
  let gamesInPreviousRound: Game[] = []

  stages.forEach((stage, roundIndex) => {
    const isFirstRound = roundIndex === 0
    const matchCount = bracketSize / 2 ** (roundIndex + 1)
    const roundGames: Game[] = []

    // Every game in this round starts no earlier than breakBetweenRoundsMin after the LATEST game
    // of the previous round ends (all games of a round can run in parallel across fields, but the
    // next round can't start until every feeding game of this round has finished).
    const roundEarliestStart = isFirstRound
      ? fieldClocks.reduce((max, t) => (t > max ? t : max), fieldClocks[0])
      : addMinutes(
          gamesInPreviousRound.reduce((max, g) => (g.scheduledEnd > max ? g.scheduledEnd : max), '00:00'),
          gameSettings.breakBetweenRoundsMin,
        )

    for (let matchIndex = 0; matchIndex < matchCount; matchIndex++) {
      let bestField = -1
      let bestSlotStart = ''
      for (let f = 0; f < fields; f++) {
        const earliestForField = maxTime(fieldClocks[f], roundEarliestStart)
        const slotStart = findNextSlot(earliestForField, gameDuration, blackoutPeriods, availabilityEnd)
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

      const game: Game = {
        id: uuidv4(),
        homeTeamId: null,
        awayTeamId: null,
        stage,
        rankTier,
        matchIndex,
        field: bestField + 1,
        scheduledStart: bestSlotStart,
        scheduledEnd: slotEnd,
        round: roundIndex + 1,
        gameNumber: gameNumber++,
        periodScores: [],
        ...(isFirstRound
          ? {
              homeSourceRank: sourceRanks[matchIndex * 2],
              awaySourceRank: sourceRanks[matchIndex * 2 + 1],
            }
          : {
              homeSourceMatch: { stage: stages[roundIndex - 1], matchIndex: matchIndex * 2, outcome: 'winner' as const },
              awaySourceMatch: { stage: stages[roundIndex - 1], matchIndex: matchIndex * 2 + 1, outcome: 'winner' as const },
            }),
      }
      roundGames.push(game)
      fieldClocks[bestField] = addMinutes(bestSlotStart, slotDuration)
    }

    games.push(...roundGames)
    gamesInPreviousRound = roundGames

    // The final's round also gets a third-place game, fed by the two semifinal losers, scheduled
    // in parallel with the final wherever a field is free (mirrors playoff-generator.ts's existing
    // 4-bracket third-place scheduling). Only applies when there IS a semifinal round to draw
    // losers from -- a bracketSize-2 bracket's only round IS 'final' (roundIndex === 0), with no
    // preceding round, so it must not get a third-place game.
    if (stage === 'final' && roundIndex > 0) {
      const semifinalStage = stages[roundIndex - 1]
      let bestField = -1
      let bestSlotStart = ''
      for (let f = 0; f < fields; f++) {
        // Respects the same roundEarliestStart gate as the final itself, not just "whenever this
        // field is next free" -- otherwise the third-place game could be scheduled BEFORE the
        // semifinals it depends on have even finished, if some field happened to sit idle.
        const earliestForField = maxTime(fieldClocks[f], roundEarliestStart)
        const slotStart = findNextSlot(earliestForField, gameDuration, blackoutPeriods, availabilityEnd)
        if (!slotStart) continue
        if (bestField === -1 || timeToMinutes(slotStart) < timeToMinutes(bestSlotStart)) {
          bestField = f
          bestSlotStart = slotStart
        }
      }
      if (bestField === -1) {
        throw new Error('Kein Zeitfenster für die Endrunde verfügbar — Hallenzeit reicht nicht aus')
      }
      games.push({
        id: uuidv4(),
        homeTeamId: null,
        awayTeamId: null,
        stage: 'third-place',
        rankTier,
        matchIndex: 0,
        field: bestField + 1,
        scheduledStart: bestSlotStart,
        scheduledEnd: addMinutes(bestSlotStart, gameDuration),
        round: roundIndex + 1,
        gameNumber: gameNumber++,
        periodScores: [],
        homeSourceMatch: { stage: semifinalStage, matchIndex: 0, outcome: 'loser' },
        awaySourceMatch: { stage: semifinalStage, matchIndex: 1, outcome: 'loser' },
      })
      fieldClocks[bestField] = addMinutes(bestSlotStart, slotDuration)
    }
  })

  return games
}
```

Add the missing imports at the top of `src/lib/finals-variant-generator.ts` — check what's
already imported and add `GameStage` to the type import and `maxTime`, `timeToMinutes` to the
value import if not already present:

```bash
head -6 src/lib/finals-variant-generator.ts
```

The existing import line is `import type { Game, GameSettings, TimeWindow } from '@/types'` — add
`GameStage`. The existing value import is
`import { calcGameDurationMin, addMinutes, findNextSlot, timeToMinutes } from './game-duration'` —
add `maxTime`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/finals-variant-generator.test.ts`

Expected: PASS, all tests including the 7 new ones.

- [ ] **Step 5: Full check + coverage**

Run: `npx tsc --noEmit && npx vitest run && npm run test:coverage`

Expected: all clean, no per-file threshold violation for `finals-variant-generator.ts`. If
`buildBracket`'s branch coverage is short, the most likely gap is the `bestField === -1` throw
paths inside the loop (only one of the two "throw when venue too short" tests above exercises the
main-round path; if the third-place-specific throw branch isn't covered, add a dedicated test:
a fixture where every round fits except there's no time left for the third-place game specifically
— e.g. `availabilityEnd` set just past the final's own slot but not enough for one more game).

- [ ] **Step 6: Commit**

```bash
git add src/lib/finals-variant-generator.ts src/lib/finals-variant-generator.test.ts
git commit -m "$(cat <<'EOF'
feat: add buildBracket, a recursive KO-tree generator for any bracket size

Generalizes playoff-generator.ts's fixed finalsBracketSize===4 branch
to any of 2/4/8/16/32: builds every round from the qualifying round
(fed by group-phase homeSourceRank/awaySourceRank) through to
final+third-place (fed by the previous round's winners/losers via
homeSourceMatch/awaySourceMatch), threading rankTier through every
game so multiple brackets (one per Endrunde-1 rank tier) can coexist
in the same schedule without their matchIndex lookups colliding.

This is prerequisite groundwork for Endrunde 1 (multiple parallel
brackets, one per rank tier) but is itself variant-agnostic --
playoff-generator.ts's existing 4-bracket path is a candidate for a
follow-up refactor to call this instead of duplicating the logic, not
done here to keep this change additive and low-risk.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ALVWiCue7JpbdjkwWKAH4p
EOF
)"
```

---

### Task 7: Generalize `buildQualifierSeeds` to any power-of-2 group count and a given rank

**Files:**
- Modify: `src/lib/finals-variant-generator.ts:34-56`
- Modify: `src/lib/finals-variant-generator.test.ts:198-224`

- [ ] **Step 1: Update the existing tests to the new signature**

Replace lines 198-224 of `src/lib/finals-variant-generator.test.ts` with:

```typescript
describe('buildQualifierSeeds', () => {
  it('seeds exactly 4 groups into semifinal order: [0]v[3], [1]v[2] by alphabetical groupId', () => {
    const seeds = buildQualifierSeeds(['A', 'B', 'C', 'D'], 1)
    // sf1.home, sf1.away, sf2.home, sf2.away
    expect(seeds).toEqual([
      { groupId: 'A', rank: 1 },
      { groupId: 'D', rank: 1 },
      { groupId: 'B', rank: 1 },
      { groupId: 'C', rank: 1 },
    ])
  })

  it('sorts group IDs alphabetically regardless of input order', () => {
    const seeds = buildQualifierSeeds(['D', 'A', 'C', 'B'], 1)
    expect(seeds).toEqual([
      { groupId: 'A', rank: 1 },
      { groupId: 'D', rank: 1 },
      { groupId: 'B', rank: 1 },
      { groupId: 'C', rank: 1 },
    ])
  })

  it('uses the given rank for every seed, for a non-1 rank tier', () => {
    const seeds = buildQualifierSeeds(['A', 'B', 'C', 'D'], 2)
    expect(seeds.every(s => s.rank === 2)).toBe(true)
  })

  it('seeds 2 groups into a single final matchup', () => {
    expect(buildQualifierSeeds(['A', 'B'], 1)).toEqual([
      { groupId: 'A', rank: 1 },
      { groupId: 'B', rank: 1 },
    ])
  })

  it('seeds 8 groups into quarterfinal order: standard 1-vs-8, 2-vs-7, ... bracket seeding', () => {
    const seeds = buildQualifierSeeds(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], 1)
    // Standard seed order for 8: 1v8, 4v5, 2v7, 3v6 (matches how a single-elimination bracket
    // avoids the two best seeds meeting before the final) -- pairs, in quarterfinal matchIndex order.
    expect(seeds).toEqual([
      { groupId: 'A', rank: 1 }, { groupId: 'H', rank: 1 },
      { groupId: 'D', rank: 1 }, { groupId: 'E', rank: 1 },
      { groupId: 'B', rank: 1 }, { groupId: 'G', rank: 1 },
      { groupId: 'C', rank: 1 }, { groupId: 'F', rank: 1 },
    ])
  })

  it('throws when the group count is not exactly 2, 4, 8, 16, or 32', () => {
    expect(() => buildQualifierSeeds(['A', 'B', 'C'], 1)).toThrow('Endrunde 1/3 benötigt 2, 4, 8, 16 oder 32 Gruppen')
    expect(() => buildQualifierSeeds(['A', 'B', 'C', 'D', 'E'], 1)).toThrow('Endrunde 1/3 benötigt 2, 4, 8, 16 oder 32 Gruppen')
  })
})
```

- [ ] **Step 2: Run to confirm the expected failures**

Run: `npx vitest run src/lib/finals-variant-generator.test.ts`

Expected: FAIL — `buildQualifierSeeds(['A','B','C','D'], 1)` doesn't match the current
single-argument signature (a TypeScript error would normally catch this, but Vitest transpiles
per-file so it'll surface as either a type error at transpile time or, since the extra argument is
just ignored by JS at runtime, some tests may pass by accident while the new ones — the 8-group
seeding and the updated throw message — fail). Confirm specifically that the 8-group test and the
throw-message test fail.

- [ ] **Step 3: Rewrite `buildQualifierSeeds`**

Replace lines 34-56 of `src/lib/finals-variant-generator.ts` with:

```typescript
/**
 * Standard single-elimination bracket seed order for `size` slots: pairs seed 1 with seed `size`,
 * seed 2 with seed `size-1`, etc., recursively arranged so the two best seeds can only meet in the
 * final (the well-known "avoid an early final" seeding used by most KO tournaments). Returns a
 * flat list of 0-based seed indices in bracket match order: [match0.home, match0.away, match1.home, match1.away, ...].
 */
function standardBracketSeedOrder(size: number): number[] {
  if (size === 1) return [0]
  const half = standardBracketSeedOrder(size / 2)
  const order: number[] = []
  for (const seed of half) {
    order.push(seed, size - 1 - seed)
  }
  return order
}

/**
 * Seeds `groupIds.length` groups (must be exactly 2, 4, 8, 16, or 32) into KO-bracket qualifying
 * slots for the given rank tier: standard cross-bracket seeding (best vs. weakest) isn't
 * meaningful here since groups can't be compared against each other before any results exist
 * (each group's rank is only known relative to its own group) — so seeding is simply by groupId,
 * alphabetically sorted, then arranged via the standard single-elimination seed order so the
 * "best" (alphabetically-first) groups are spread across the bracket rather than clustered. This
 * mirrors the deterministic-by-groupId approach already used for Endrunde 4's placement cohorts.
 *
 * Returns groupIds.length sourceRanks in bracket match order — for direct use as
 * BuildBracketInput.sourceRanks.
 */
export function buildQualifierSeeds(groupIds: string[], rank: number): { groupId: string; rank: number }[] {
  const size = groupIds.length
  if (![2, 4, 8, 16, 32].includes(size)) {
    throw new Error('Endrunde 1/3 benötigt 2, 4, 8, 16 oder 32 Gruppen')
  }
  const sorted = [...groupIds].sort()
  return standardBracketSeedOrder(size).map(seedIndex => ({ groupId: sorted[seedIndex], rank }))
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/finals-variant-generator.test.ts`

Expected: PASS, all tests. Double-check the 8-group seed order test's expected value against the
actual output once — the comment claims "1v8, 4v5, 2v7, 3v6" which is the well-known standard
bracket seeding; if `standardBracketSeedOrder(8)` produces a different but still-valid
avoid-early-final ordering, adjust the test's expected array to match the actual (correct)
output rather than forcing a specific ordering that doesn't match what the recursive algorithm
naturally produces — the important property to preserve in the test is "no two adjacent seeds meet
before the final," not one specific permutation.

- [ ] **Step 5: Update the two existing call sites**

`src/lib/schedule-generator.ts:193` currently calls `buildQualifierSeeds(groupIds)` (no second
argument) for Endrunde 3. Update it to `buildQualifierSeeds(groupIds, 1)` (Endrunde 3 only ever
qualifies rank 1). This file is edited again in Task 8 for the main Endrunde-1 wiring, so this is
a small standalone fix — do it now so the codebase isn't left in a broken intermediate state.

Run: `npx tsc --noEmit`

Expected: clean (this was the only remaining call site).

- [ ] **Step 6: Full check**

Run: `npx vitest run`

Expected: all passing.

- [ ] **Step 7: Coverage check**

Run: `npm run test:coverage`

Expected: no threshold violation for `finals-variant-generator.ts`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/finals-variant-generator.ts src/lib/finals-variant-generator.test.ts src/lib/schedule-generator.ts
git commit -m "$(cat <<'EOF'
feat: generalize buildQualifierSeeds to any power-of-2 group count and rank tier

Was hardcoded to exactly 4 groups and rank 1 (Endrunde 3's only use
case). Now accepts any of 2/4/8/16/32 groups and an explicit rank
parameter, using the standard single-elimination "avoid an early
final" seed order (recursively pairing seed i with seed size-1-i) —
prerequisite for Endrunde 1, which needs to seed every rank tier's
bracket, not just rank 1's.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ALVWiCue7JpbdjkwWKAH4p
EOF
)"
```

---

### Task 8: Wire Endrunde 1 into `generateSchedule`

**Files:**
- Modify: `src/types/index.ts:56` (the `finalsVariant` union)
- Modify: `src/lib/schedule-generator.ts:164-218`
- Modify: `src/lib/schedule-generator.test.ts` (add a new test, following the existing
  `'generates a semifinal+final+third-place bracket seeded by group winners when finalsVariant is
  endrunde-3'` test as a pattern — find it with
  `grep -n "endrunde-3" src/lib/schedule-generator.test.ts`)

- [ ] **Step 1: Update the `finalsVariant` type**

In `src/types/index.ts`, change line 56 from:

```typescript
  finalsVariant?: 'endrunde-3' | 'endrunde-4'  // only relevant when mode === 'round-robin+finals' and
```

to:

```typescript
  finalsVariant?: 'endrunde-1' | 'endrunde-3' | 'endrunde-4'  // only relevant when mode === 'round-robin+finals' and
```

- [ ] **Step 2: Write the failing schedule-generator test**

Add to `src/lib/schedule-generator.test.ts`, right after the existing Endrunde-3 test (find its
closing `})` with `grep -n "endrunde-3" src/lib/schedule-generator.test.ts` and insert after):

```typescript
  it('generates one KO bracket per rank tier when finalsVariant is endrunde-1, capped by the smallest group size', () => {
    const config: TournamentConfig = {
      ...baseConfig,
      mode: 'round-robin+finals',
      groupCount: 4,
      finalsVariant: 'endrunde-1',
      teams: [
        { ...makeTeam('t1', 'T1'), groupId: 'A' },
        { ...makeTeam('t2', 'T2'), groupId: 'A' },
        { ...makeTeam('t3', 'T3'), groupId: 'B' },
        { ...makeTeam('t4', 'T4'), groupId: 'B' },
        { ...makeTeam('t5', 'T5'), groupId: 'C' },
        { ...makeTeam('t6', 'T6'), groupId: 'C' },
        { ...makeTeam('t7', 'T7'), groupId: 'D' },
        { ...makeTeam('t8', 'T8'), groupId: 'D' },
      ],
    }
    const schedule = generateSchedule(config)
    // 4 groups of 2 -> smallest group size 2 -> 2 rank tiers, each a 4-team bracket
    // (semifinal x2 + third-place + final = 4 games per tier -> 8 KO games total).
    const koGames = schedule.games.filter(g =>
      g.stage === 'semifinal' || g.stage === 'final' || g.stage === 'third-place')
    expect(koGames).toHaveLength(8)
    expect(koGames.filter(g => g.rankTier === 1)).toHaveLength(4)
    expect(koGames.filter(g => g.rankTier === 2)).toHaveLength(4)
    expect(schedule.games.some(g => g.stage === 'placement')).toBe(false)

    const rankTier1Semifinals = koGames.filter(g => g.rankTier === 1 && g.stage === 'semifinal')
    expect(rankTier1Semifinals[0].homeSourceRank).toEqual({ groupId: 'A', rank: 1 })
    expect(rankTier1Semifinals[0].awaySourceRank).toEqual({ groupId: 'D', rank: 1 })
    const rankTier2Semifinals = koGames.filter(g => g.rankTier === 2 && g.stage === 'semifinal')
    expect(rankTier2Semifinals[0].homeSourceRank).toEqual({ groupId: 'A', rank: 2 })
    expect(rankTier2Semifinals[0].awaySourceRank).toEqual({ groupId: 'D', rank: 2 })

    // Regression guard for field-clock threading between successive buildBracket calls: baseConfig
    // only has 2 fields, so rank tier 1's bracket alone occupies both fields across 2 rounds
    // (semifinals, then final+third-place). If generateSchedule failed to carry each field's
    // actual next-free time forward into rank tier 2's buildBracket call, tier 2's games would be
    // scheduled as if the fields were still free from the very start of the tournament, causing an
    // impossible time overlap with tier 1's games on the same field. No game on field 1 (or field
    // 2) may start before every EARLIER-starting game already scheduled on that same field has
    // ended.
    for (const field of [1, 2]) {
      const gamesOnField = schedule.games.filter(g => g.field === field).sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))
      for (let i = 1; i < gamesOnField.length; i++) {
        expect(gamesOnField[i].scheduledStart >= gamesOnField[i - 1].scheduledEnd).toBe(true)
      }
    }
  })
```

- [ ] **Step 3: Run to confirm it fails**

Run: `npx vitest run src/lib/schedule-generator.test.ts`

Expected: FAIL — no `endrunde-1` branch exists yet in `generateSchedule`, so no KO games are
generated at all (`koGames` will be empty).

- [ ] **Step 4: Add the `endrunde-1` branch to `generateSchedule`**

In `src/lib/schedule-generator.ts`, add the import for `buildBracket` alongside the existing
`finals-variant-generator` imports (line 6):

```typescript
import { buildPlacementCohorts, buildPlacementGames, buildQualifierSeeds, buildBracket } from './finals-variant-generator'
```

Then insert a new branch right after the existing `endrunde-4` branch (before
`else if (config.mode === 'round-robin+finals' && config.finalsVariant === 'endrunde-3')` — see
current line 190):

```typescript
  } else if (config.mode === 'round-robin+finals' && config.finalsVariant === 'endrunde-1') {
    // Every rank tier gets its own bracket, same rank-tier-count logic as Endrunde 4: capped by
    // the smallest group's size, so every team ends up in exactly one bracket.
    const standingsByGroup = new Map(groupIds.map(groupId => [groupId, computeGroupStandings(teams, games, groupId)]))
    const rankTierCount = Math.min(...[...standingsByGroup.values()].map(s => s.length))
    for (let rankTier = 1; rankTier <= rankTierCount; rankTier++) {
      const sourceRanks = buildQualifierSeeds(groupIds, rankTier)
      const bracketGames = buildBracket({
        bracketSize: groupIds.length as 2 | 4 | 8 | 16 | 32,
        rankTier,
        sourceRanks,
        fields,
        gameSettings,
        blackoutPeriods: venue.blackoutPeriods,
        availabilityEnd,
        fieldNextFree,
        startGameNumber: gameNumber,
      })
      games.push(...bracketGames)
      gameNumber += bracketGames.length
      // buildBracket takes an internal COPY of fieldNextFree and never writes back to it (same
      // contract as generatePlayoffGames) -- since this loop calls it once PER RANK TIER sharing
      // the same fieldNextFree array, the next tier's bracket must start from where this tier's
      // games actually left each field, or two rank tiers' brackets would get scheduled as if
      // they were the only thing using the venue, double-booking fields. Recompute each field's
      // next-free time from what this call actually produced (slotDuration is already computed
      // once at the top of generateSchedule, from the same gameSettings).
      for (const g of bracketGames) {
        const fieldIndex = g.field - 1
        const candidateNextFree = addMinutes(g.scheduledStart, slotDuration)
        if (timeToMinutes(candidateNextFree) > timeToMinutes(fieldNextFree[fieldIndex])) {
          fieldNextFree[fieldIndex] = candidateNextFree
        }
      }
    }
  } else if (config.mode === 'round-robin+finals' && config.finalsVariant === 'endrunde-3') {
```

(Note: `groupIds.length as 2 | 4 | 8 | 16 | 32` is safe here because the config UI, built in Task
9, only allows selecting Endrunde 1 when `groupCount` is exactly one of those five values — the
cast documents that invariant rather than re-validating it, matching how `buildQualifierSeeds`
itself throws if the invariant is ever violated by a caller that skips the UI, e.g. a hand-crafted
imported JSON file.

Also note the `candidateNextFree` computed from `g.scheduledStart` rather than `g.scheduledEnd` is
intentional and matches `buildBracket`'s own internal field-clock bookkeeping exactly — see its
`fieldClocks[bestField] = addMinutes(bestSlotStart, slotDuration)` lines — so the "one bracket's
leftover field state" this loop reconstructs is bit-for-bit consistent with what `buildBracket`
itself would have used had it been given that state as its `fieldNextFree` input.)

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/lib/schedule-generator.test.ts`

Expected: PASS.

- [ ] **Step 6: Full check + coverage**

Run: `npx tsc --noEmit && npx vitest run && npm run test:coverage`

Expected: all clean.

- [ ] **Step 7: Commit**

```bash
git add src/types/index.ts src/lib/schedule-generator.ts src/lib/schedule-generator.test.ts
git commit -m "$(cat <<'EOF'
feat: wire Endrunde 1 into generateSchedule, one bracket per rank tier

Adds 'endrunde-1' to the finalsVariant union and a new branch in
generateSchedule: for every rank tier (capped by the smallest group's
size, same logic Endrunde 4 already uses), seeds that tier's
qualifiers via the now-generalized buildQualifierSeeds and generates
its bracket via buildBracket. groupCount is cast to the bracket-size
union since the config UI (next task) only allows selecting Endrunde 1
for an exact-power-of-2 group count -- buildQualifierSeeds itself
still throws if that invariant is ever violated by a non-UI path (e.g.
a hand-edited imported JSON file).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ALVWiCue7JpbdjkwWKAH4p
EOF
)"
```

---

### Task 9: Config UI — make Endrunde 1 selectable

**Files:**
- Modify: `src/components/config/FinalsVariantForm.tsx`
- Modify: `src/components/config/FinalsVariantForm.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `src/components/config/FinalsVariantForm.test.tsx`, after the existing Endrunde-3 tests:

```typescript
  it('offers Endrunde 1 as an option and disables it unless the group count is an exact power of 2 up to 32', () => {
    // beforeEach sets up groupCount: 2 -- Endrunde 1 IS usable at groupCount 2, so re-set to 3 to test the disabled case.
    // Set state BEFORE the only render() call in this test -- RTL's auto-cleanup only runs
    // between tests (afterEach), not between renders within one test, so an earlier render-then-
    // setState-then-render-again sequence here would leave two mounted trees both reacting to the
    // setState, duplicating the warning text below and breaking the singular getByText assertion.
    useTournamentStore.setState({
      tournament: { ...useTournamentStore.getState().tournament, groupCount: 3 },
    })
    render(<FinalsVariantForm />)
    const endrunde1Options = screen.getAllByRole('option', { name: /Endrunde 1/ })
    expect(endrunde1Options[endrunde1Options.length - 1]).toBeDisabled()
    expect(screen.getByText(/Endrunde 1.*2, 4, 8, 16 oder 32 Gruppen/)).toBeInTheDocument()
  })

  it('lets the organizer select Endrunde 1 when the group count is a supported power of 2', () => {
    useTournamentStore.setState({
      tournament: {
        ...useTournamentStore.getState().tournament,
        groupCount: 8,
        teams: Array.from({ length: 16 }, (_, i) => ({
          id: `t${i}`, name: `T${i}`, logoUrl: '', color: '#000', contact: '', players: [],
          groupId: String.fromCharCode(65 + (i % 8)),
        })),
      },
    })
    render(<FinalsVariantForm />)
    const endrunde1Options = screen.getAllByRole('option', { name: /Endrunde 1/ })
    expect(endrunde1Options[endrunde1Options.length - 1]).not.toBeDisabled()

    const select = screen.getByLabelText('Endrunden-Variante')
    fireEvent.change(select, { target: { value: 'endrunde-1' } })
    expect(useTournamentStore.getState().tournament.finalsVariant).toBe('endrunde-1')
  })
```

(Using `getAllByRole` + last element for the disabled-state assertion, since the surrounding
capacity-warning text also contains the word "Endrunde" and could otherwise make the query
ambiguous depending on final wording — being defensive here avoids a flaky selector.)

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/components/config/FinalsVariantForm.test.tsx`

Expected: FAIL — no "Endrunde 1" option exists in the `<select>` yet.

- [ ] **Step 3: Add the option to `FinalsVariantForm.tsx`**

Replace the `canUseEndrunde3` line and the `<select>` block:

```typescript
  const canUseEndrunde3 = groupCount === 4
  const canUseEndrunde1 = [2, 4, 8, 16, 32].includes(groupCount)

  return (
    <div className="space-y-4 max-w-md">
      <div className="space-y-1">
        <Label htmlFor="finals-variant">Endrunden-Variante</Label>
        <select
          id="finals-variant"
          className="border border-border rounded-sm px-2 py-1 text-sm w-full"
          value={tournament.finalsVariant ?? 'endrunde-4'}
          onChange={e => setFinalsVariant(e.target.value as 'endrunde-1' | 'endrunde-3' | 'endrunde-4')}
          disabled={disabled}
        >
          <option value="endrunde-4">
            Endrunde 4 — Platzierungsgruppen (jeder gegen jeden je Rangstufe)
          </option>
          <option value="endrunde-3" disabled={!canUseEndrunde3}>
            Endrunde 3 — Halbfinale, Finale, Spiel um Platz 3 (nur Gruppenerste)
          </option>
          <option value="endrunde-1" disabled={!canUseEndrunde1}>
            Endrunde 1 — K.-o.-Runden je Rangstufe (alle Gruppenersten, -zweiten, ...)
          </option>
        </select>
        {!canUseEndrunde3 && (
          <p className="text-xs text-muted-foreground">
            Endrunde 3 benötigt genau 4 Gruppen (aktuell: {groupCount}).
          </p>
        )}
        {!canUseEndrunde1 && (
          <p className="text-xs text-muted-foreground">
            Endrunde 1 benötigt 2, 4, 8, 16 oder 32 Gruppen (aktuell: {groupCount}).
          </p>
        )}
      </div>
```

(Worded as "...32 Gruppen (aktuell: ...)" rather than "...eine Gruppenanzahl von 2, 4, 8, 16 oder 32 (aktuell: ...)" so the literal substring "2, 4, 8, 16 oder 32 Gruppen" lands in one JSX text node — the original wording split "32" and "Gruppen" across the interpolation boundary in a way that still renders fine visually but doesn't satisfy the test's `/…32 Gruppen/` regex against `textContent`.)

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/config/FinalsVariantForm.test.tsx`

Expected: PASS, all tests.

- [ ] **Step 5: Full check + coverage**

Run: `npx tsc --noEmit && npx vitest run && npm run test:coverage`

Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/config/FinalsVariantForm.tsx src/components/config/FinalsVariantForm.test.tsx
git commit -m "$(cat <<'EOF'
feat: make Endrunde 1 selectable in the finals-variant config UI

Adds "Endrunde 1" as a third option, disabled with an explanatory
message unless the tournament has a group count that's an exact power
of 2 up to 32 (2, 4, 8, 16, or 32) -- the qualifying pool size each
rank tier's bracket requires.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ALVWiCue7JpbdjkwWKAH4p
EOF
)"
```

---

### Task 10: `computeEndrunde1Standings` — combined final standing across rank tiers

**Files:**
- Modify: `src/lib/final-standings.ts` (add new function; existing `computeFinalStandings` stays
  untouched, since it's Endrunde-4-specific)
- Modify: `src/lib/final-standings.test.ts` (add new `describe` block)

- [ ] **Step 1: Check the existing test file's structure first**

```bash
head -10 src/lib/final-standings.test.ts
```

- [ ] **Step 2: Write the failing tests**

Add to `src/lib/final-standings.test.ts`:

```typescript
describe('computeEndrunde1Standings', () => {
  const makeKoGame = (overrides: Partial<Game>): Game => ({
    id: 'g', homeTeamId: null, awayTeamId: null, stage: 'final', field: 1,
    scheduledStart: '10:00', scheduledEnd: '10:30', round: 1, gameNumber: 1,
    periodScores: [], rankTier: 1, placementFrom: 1, matchIndex: 0,
    ...overrides,
  })

  it('orders a single rank tier by final winner, final loser, third-place winner, third-place loser', () => {
    const teams = [makeTeam('a1'), makeTeam('a2'), makeTeam('a3'), makeTeam('a4')]
    const games = [
      makeKoGame({
        id: 'f1', stage: 'final', rankTier: 1, placementFrom: 1,
        homeTeamId: 'a1', awayTeamId: 'a2', periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }],
      }),
      makeKoGame({
        id: 'tp1', stage: 'third-place', rankTier: 1, placementFrom: 1,
        homeTeamId: 'a3', awayTeamId: 'a4', periodScores: [{ period: 1, homeScore: 15, awayScore: 12 }],
      }),
    ]
    const standings = computeEndrunde1Standings(teams, games)
    expect(standings).toEqual([
      { teamId: 'a1', place: 1, pending: false },
      { teamId: 'a2', place: 2, pending: false },
      { teamId: 'a3', place: 3, pending: false },
      { teamId: 'a4', place: 4, pending: false },
    ])
  })

  it('offsets place numbers for a second rank tier by placementFrom', () => {
    const teams = [makeTeam('b1'), makeTeam('b2'), makeTeam('b3'), makeTeam('b4')]
    const games = [
      makeKoGame({
        id: 'f2', stage: 'final', rankTier: 2, placementFrom: 5,
        homeTeamId: 'b1', awayTeamId: 'b2', periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }],
      }),
      makeKoGame({
        id: 'tp2', stage: 'third-place', rankTier: 2, placementFrom: 5,
        homeTeamId: 'b3', awayTeamId: 'b4', periodScores: [{ period: 1, homeScore: 15, awayScore: 12 }],
      }),
    ]
    const standings = computeEndrunde1Standings(teams, games)
    expect(standings.map(s => s.place)).toEqual([5, 6, 7, 8])
  })

  it('marks a rank tier pending when its final or third-place game has not been played yet', () => {
    const teams = [makeTeam('a1'), makeTeam('a2'), makeTeam('a3'), makeTeam('a4')]
    const games = [
      makeKoGame({
        id: 'f1', stage: 'final', rankTier: 1, placementFrom: 1,
        homeTeamId: 'a1', awayTeamId: 'a2', periodScores: [],
      }),
      makeKoGame({
        id: 'tp1', stage: 'third-place', rankTier: 1, placementFrom: 1,
        homeTeamId: null, awayTeamId: null, periodScores: [],
      }),
    ]
    const standings = computeEndrunde1Standings(teams, games)
    expect(standings.every(s => s.pending)).toBe(true)
  })

  it('combines two rank tiers into one sorted 1..N list', () => {
    const teams = [makeTeam('a1'), makeTeam('a2'), makeTeam('a3'), makeTeam('a4'), makeTeam('b1'), makeTeam('b2'), makeTeam('b3'), makeTeam('b4')]
    const games = [
      makeKoGame({ id: 'f1', stage: 'final', rankTier: 1, placementFrom: 1, homeTeamId: 'a1', awayTeamId: 'a2', periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }] }),
      makeKoGame({ id: 'tp1', stage: 'third-place', rankTier: 1, placementFrom: 1, homeTeamId: 'a3', awayTeamId: 'a4', periodScores: [{ period: 1, homeScore: 15, awayScore: 12 }] }),
      makeKoGame({ id: 'f2', stage: 'final', rankTier: 2, placementFrom: 5, homeTeamId: 'b1', awayTeamId: 'b2', periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }] }),
      makeKoGame({ id: 'tp2', stage: 'third-place', rankTier: 2, placementFrom: 5, homeTeamId: 'b3', awayTeamId: 'b4', periodScores: [{ period: 1, homeScore: 15, awayScore: 12 }] }),
    ]
    const standings = computeEndrunde1Standings(teams, games)
    expect(standings.map(s => s.place)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(standings.map(s => s.teamId)).toEqual(['a1', 'a2', 'a3', 'a4', 'b1', 'b2', 'b3', 'b4'])
  })

  it('returns an empty list when there are no KO-bracket games at all', () => {
    expect(computeEndrunde1Standings([], [])).toEqual([])
  })
})
```

Check the `makeTeam` helper already exists in this test file (it should, reused from
`computeFinalStandings`'s tests) — if not, add a minimal one matching the pattern in
`src/lib/final-standings.test.ts`'s existing `describe('computeFinalStandings', ...)` block. Also
add `computeEndrunde1Standings` to the import line at the top of the test file.

- [ ] **Step 3: Run to confirm failure**

Run: `npx vitest run src/lib/final-standings.test.ts`

Expected: FAIL with `computeEndrunde1Standings is not a function`.

- [ ] **Step 4: Implement `computeEndrunde1Standings`**

Add to `src/lib/final-standings.ts` (after the existing `computeFinalStandings` function):

```typescript
/**
 * Builds the overall 1..N tournament ranking from Endrunde-1 KO-bracket results: for each rank
 * tier, place 1 (of that tier) = the final's winner, place 2 = the final's loser, place 3 = the
 * third-place game's winner, place 4 = the third-place game's loser — then every tier's places are
 * offset by its placementFrom and concatenated into one combined list, sorted by place.
 *
 * A rank tier is "pending" as a whole if its final OR third-place game hasn't been scored yet
 * (unlike computeFinalStandings' per-cohort pending flag, this is necessarily coarse: without a
 * completed final AND third-place game, none of the 4 places in that tier can be assigned at all,
 * since resolvePlaceholders may not even have filled in real team IDs yet).
 */
export function computeEndrunde1Standings(teams: Team[], games: Game[]): FinalStanding[] {
  const koGames = games.filter(g => g.stage === 'final' || g.stage === 'third-place')
  const rankTiers = [...new Set(koGames.map(g => g.rankTier!))].sort((a, b) => a - b)

  const results: FinalStanding[] = []
  for (const rankTier of rankTiers) {
    const final = koGames.find(g => g.rankTier === rankTier && g.stage === 'final')
    const thirdPlace = koGames.find(g => g.rankTier === rankTier && g.stage === 'third-place')
    if (!final || !thirdPlace) continue
    const placementFrom = final.placementFrom ?? thirdPlace.placementFrom ?? 1

    const pending =
      final.periodScores.length === 0 || thirdPlace.periodScores.length === 0 ||
      !final.homeTeamId || !final.awayTeamId || !thirdPlace.homeTeamId || !thirdPlace.awayTeamId

    if (pending) {
      // Without a completed final AND third-place game there's no reliable way to name all 4
      // teams in this tier yet (a still-unresolved semifinal upstream may mean the placeholder
      // team IDs on final/thirdPlace aren't real teams at all) -- report the tier as 4 pending
      // rows with whatever team IDs are currently known, consistent with computeFinalStandings'
      // "never silently omit a team" rule.
      const knownIds = [final.homeTeamId, final.awayTeamId, thirdPlace.homeTeamId, thirdPlace.awayTeamId]
      knownIds.forEach((teamId, index) => {
        if (teamId) results.push({ teamId, place: placementFrom + index, pending: true })
      })
      continue
    }

    const { home: finalHome, away: finalAway } = computeFinalScore(final)
    const { home: tpHome, away: tpAway } = computeFinalScore(thirdPlace)
    const finalWinner = finalHome > finalAway ? final.homeTeamId! : final.awayTeamId!
    const finalLoser = finalHome > finalAway ? final.awayTeamId! : final.homeTeamId!
    const tpWinner = tpHome > tpAway ? thirdPlace.homeTeamId! : thirdPlace.awayTeamId!
    const tpLoser = tpHome > tpAway ? thirdPlace.awayTeamId! : thirdPlace.homeTeamId!

    results.push(
      { teamId: finalWinner, place: placementFrom, pending: false },
      { teamId: finalLoser, place: placementFrom + 1, pending: false },
      { teamId: tpWinner, place: placementFrom + 2, pending: false },
      { teamId: tpLoser, place: placementFrom + 3, pending: false },
    )
  }
  return results.sort((a, b) => a.place - b.place)
}
```

Add `computeFinalScore` to the imports at the top of `src/lib/final-standings.ts` if not already
present:

```bash
head -3 src/lib/final-standings.ts
```

It currently imports `computeGroupStandings` from `./group-standings` — add
`import { computeFinalScore } from './standings'` as a new line.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/lib/final-standings.test.ts`

Expected: PASS, all tests including the new ones.

- [ ] **Step 6: Full check + coverage**

Run: `npx tsc --noEmit && npx vitest run && npm run test:coverage`

Expected: all clean, no threshold violation for `final-standings.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/final-standings.ts src/lib/final-standings.test.ts
git commit -m "$(cat <<'EOF'
feat: add computeEndrunde1Standings, combining all rank-tier brackets into one 1..N table

Each rank tier's 4 places come directly from its final (winner/loser)
and third-place game (winner/loser), offset by that tier's
placementFrom and concatenated across tiers into one sorted list --
distinct from computeFinalStandings (Endrunde 4's round-robin-cohort
standings), since Endrunde 1's KO-bracket places come from match
outcomes, not accumulated points.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ALVWiCue7JpbdjkwWKAH4p
EOF
)"
```

---

### Task 11: `BracketResultsPage.tsx` — tab-based results entry per rank tier

**Files:**
- Create: `src/pages/BracketResultsPage.tsx`
- Create: `src/pages/BracketResultsPage.test.tsx`
- Modify: `src/App.tsx` (add route + import)
- Modify: `src/components/layout/AppShell.tsx` (add nav item, gated on `finalsVariant ===
  'endrunde-1'`)
- Modify: `src/components/layout/AppShell.test.tsx` (add a nav-visibility test)
- Modify: `src/pages/FinalStandingsPage.tsx` (branch on `finalsVariant` to call the right
  standings function)
- Modify: `src/pages/FinalStandingsPage.test.tsx` (add an Endrunde-1 case)

- [ ] **Step 1: Write the failing page test**

Create `src/pages/BracketResultsPage.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BracketResultsPage from './BracketResultsPage'
import { useTournamentStore } from '@/store/tournament-store'

describe('BracketResultsPage', () => {
  beforeEach(() => {
    const tournament = {
      ...useTournamentStore.getState().tournament,
      mode: 'round-robin+finals' as const,
      finalsVariant: 'endrunde-1' as const,
      teams: [
        { id: 't1', name: 'Team Eins', logoUrl: '', color: '#000', contact: '', players: [] },
        { id: 't2', name: 'Team Zwei', logoUrl: '', color: '#000', contact: '', players: [] },
        { id: 't3', name: 'Team Drei', logoUrl: '', color: '#000', contact: '', players: [] },
        { id: 't4', name: 'Team Vier', logoUrl: '', color: '#000', contact: '', players: [] },
      ],
    }
    useTournamentStore.setState({
      tournament,
      schedule: {
        id: 's1', tournamentId: tournament.id, generatedAt: new Date().toISOString(),
        games: [
          {
            id: 'f1', homeTeamId: 't1', awayTeamId: 't2', stage: 'final', matchIndex: 0, field: 1,
            scheduledStart: '11:00', scheduledEnd: '11:30', round: 2, gameNumber: 1, periodScores: [],
            rankTier: 1, placementFrom: 1,
          },
          {
            id: 'f2', homeTeamId: 't3', awayTeamId: 't4', stage: 'final', matchIndex: 0, field: 1,
            scheduledStart: '11:00', scheduledEnd: '11:30', round: 2, gameNumber: 2, periodScores: [],
            rankTier: 2, placementFrom: 5,
          },
        ],
        totalDurationMin: 60, estimatedEnd: '11:30',
      },
    })
  })

  it('shows one tab per rank tier and defaults to the first', () => {
    render(<BracketResultsPage />, { wrapper: MemoryRouter })
    expect(screen.getByRole('button', { name: /Rangstufe 1/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Rangstufe 2/ })).toBeInTheDocument()
    expect(screen.getByText('Team Eins')).toBeInTheDocument()
    expect(screen.queryByText('Team Drei')).not.toBeInTheDocument()
  })

  it('switches to a different rank tier when its tab is clicked', () => {
    render(<BracketResultsPage />, { wrapper: MemoryRouter })
    fireEvent.click(screen.getByRole('button', { name: /Rangstufe 2/ }))
    expect(screen.getByText('Team Drei')).toBeInTheDocument()
    expect(screen.queryByText('Team Eins')).not.toBeInTheDocument()
  })

  it('lets the organizer save a result for the active rank tier only', () => {
    render(<BracketResultsPage />, { wrapper: MemoryRouter })
    fireEvent.change(screen.getByLabelText('Ergebnis Heim, Spiel 1'), { target: { value: '20' } })
    fireEvent.change(screen.getByLabelText('Ergebnis Auswärts, Spiel 1'), { target: { value: '15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    const saved = useTournamentStore.getState().schedule!.games.find(g => g.id === 'f1')!
    expect(saved.periodScores).toEqual([{ period: 1, homeScore: 20, awayScore: 15 }])
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/pages/BracketResultsPage.test.tsx`

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `BracketResultsPage.tsx`**

Base this closely on `PlayoffResultsPage.tsx` and the tab pattern from `GroupOverviewPage.tsx`:

```typescript
import { useState } from 'react'
import { useTournamentStore } from '@/store/tournament-store'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TeamNameDisplay } from '@/components/teams/TeamNameDisplay'
import { computeFinalScore } from '@/lib/standings'
import type { Game } from '@/types'

type StatusFilter = 'open' | 'played' | 'all'

const STAGE_LABELS: Record<string, string> = {
  'round-of-32': 'Runde der 32',
  'round-of-16': 'Runde der 16',
  quarterfinal: 'Viertelfinale',
  semifinal: 'Halbfinale',
  final: 'Finale',
  'third-place': 'Spiel um Platz 3',
}

export default function BracketResultsPage() {
  const { tournament, schedule, submitGameResult, correctGameResult } = useTournamentStore()
  const koGames = schedule?.games.filter(g =>
    g.stage === 'round-of-32' || g.stage === 'round-of-16' || g.stage === 'quarterfinal' ||
    g.stage === 'semifinal' || g.stage === 'final' || g.stage === 'third-place') ?? []
  const rankTiers = [...new Set(koGames.map(g => g.rankTier!))].sort((a, b) => a - b)
  const [activeRankTier, setActiveRankTier] = useState(rankTiers[0] ?? 1)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open')
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>({})
  const [correctingGameId, setCorrectingGameId] = useState<string | null>(null)

  if (!schedule) {
    return (
      <Alert>
        <AlertDescription>Bitte zuerst einen Zeitplan generieren (Seite „Konfiguration“).</AlertDescription>
      </Alert>
    )
  }

  const currentRankTier = rankTiers.includes(activeRankTier) ? activeRankTier : (rankTiers[0] ?? 1)
  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))
  const filteredGames = koGames
    .filter(g => g.rankTier === currentRankTier)
    .filter(g => {
      const hasResult = g.periodScores.length > 0
      if (statusFilter === 'open') return !hasResult
      if (statusFilter === 'played') return hasResult
      return true
    })
    .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart) || a.gameNumber - b.gameNumber)

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
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl text-brand-primary">Endrunde: K.-o.-Ergebnisse</h1>

      <div className="flex gap-1 flex-wrap">
        {rankTiers.map(rankTier => {
          const tierPlacementFrom = koGames.find(g => g.rankTier === rankTier)?.placementFrom
          return (
            <Button
              key={rankTier}
              variant={rankTier === currentRankTier ? undefined : 'outline'}
              size="sm"
              onClick={() => setActiveRankTier(rankTier)}
            >
              Rangstufe {rankTier} (Platz {tierPlacementFrom}+)
            </Button>
          )
        })}
      </div>

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
                {STAGE_LABELS[game.stage] ?? game.stage}
              </span>
              <div className="flex-1 min-w-0 flex items-center gap-2">
                {homeTeam ? <TeamNameDisplay team={homeTeam} /> : <span>{game.homeLabel ?? '?'}</span>}
                <span className="text-muted-foreground text-sm">vs</span>
                {awayTeam ? <TeamNameDisplay team={awayTeam} /> : <span>{game.awayLabel ?? '?'}</span>}
              </div>

              {isUnresolved ? (
                <span className="text-xs text-muted-foreground">Wartet auf vorherige Runde</span>
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
                  <Button
                    size="sm"
                    disabled={!canSave(game)}
                    onClick={() => handleSave(game)}
                  >
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


- [ ] **Step 4: Run the page test**

Run: `npx vitest run src/pages/BracketResultsPage.test.tsx`

Expected: PASS, all 3 tests.

- [ ] **Step 5: Wire the route**

In `src/App.tsx`, add the import:

```typescript
import BracketResultsPage from '@/pages/BracketResultsPage'
```

And the route, right after the `playoff-results` route:

```typescript
          <Route path="bracket-results" element={<BracketResultsPage />} />
```

- [ ] **Step 6: Wire the nav item**

In `src/components/layout/AppShell.tsx`, add a new nav-item branch right after the existing
`endrunde-3` branch:

```typescript
          ...(isRoundRobinFinals && tournament.finalsVariant === 'endrunde-1'
            ? [
                { to: '/bracket-results', label: 'Endrunde: K.-o.-Ergebnisse', gated: true },
                { to: '/final-standings', label: 'Endstand', gated: true },
              ]
            : []),
```

- [ ] **Step 7: Write the failing nav test**

Add to `src/components/layout/AppShell.test.tsx`, after the existing Endrunde-3 nav test (find it
with `grep -n "Endrunde 3\|endrunde-3" src/components/layout/AppShell.test.tsx`):

```typescript
  it('shows "Endrunde: K.-o.-Ergebnisse" and "Endstand" nav links for Endrunde 1', () => {
    useTournamentStore.setState({
      tournament: { ...useTournamentStore.getState().tournament, mode: 'round-robin+finals', finalsVariant: 'endrunde-1' },
    })
    renderShell()
    expect(screen.getByText('Endrunde: K.-o.-Ergebnisse')).toBeInTheDocument()
    expect(screen.getByText('Endstand')).toBeInTheDocument()
    expect(screen.queryByText('Endrunde: KO-Ergebnisse')).not.toBeInTheDocument()
  })
```

Run: `npx vitest run src/components/layout/AppShell.test.tsx`

Expected: PASS (the nav wiring from Step 6 already makes this pass — if you're following strict
TDD order, write this test right after Step 5 and before Step 6, confirm it fails, then do Step 6
and confirm it passes).

- [ ] **Step 8: Make `FinalStandingsPage.tsx` variant-aware**

The existing page always calls `computeFinalStandings` (Endrunde-4-specific round-robin-cohort
logic). Update it to pick the right function based on `finalsVariant`:

```typescript
import { useTournamentStore } from '@/store/tournament-store'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TeamNameDisplay } from '@/components/teams/TeamNameDisplay'
import { computeFinalStandings, computeEndrunde1Standings } from '@/lib/final-standings'

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
  const standings = tournament.finalsVariant === 'endrunde-1'
    ? computeEndrunde1Standings(tournament.teams, schedule.games)
    : computeFinalStandings(tournament.teams, schedule.games)
```

The rest of the component (the `standings.length === 0` guard and the render) stays unchanged.

- [ ] **Step 9: Write the failing FinalStandingsPage test for Endrunde 1**

```bash
head -10 src/pages/FinalStandingsPage.test.tsx
```

Add a new test following the existing file's setup pattern (check the existing Endrunde-4 test's
`beforeEach`/`tournament`/`schedule` shape and mirror it, substituting `finalsVariant:
'endrunde-1'` and KO-stage games instead of `stage: 'placement'` games):

```typescript
  it('shows a combined 1..N standing for Endrunde 1 across two rank tiers', () => {
    const tournament = {
      ...useTournamentStore.getState().tournament,
      finalsVariant: 'endrunde-1' as const,
      teams: [
        { id: 't1', name: 'Team Eins', logoUrl: '', color: '#000', contact: '', players: [] },
        { id: 't2', name: 'Team Zwei', logoUrl: '', color: '#000', contact: '', players: [] },
        { id: 't3', name: 'Team Drei', logoUrl: '', color: '#000', contact: '', players: [] },
        { id: 't4', name: 'Team Vier', logoUrl: '', color: '#000', contact: '', players: [] },
      ],
    }
    useTournamentStore.setState({
      tournament,
      schedule: {
        id: 's1', tournamentId: tournament.id, generatedAt: new Date().toISOString(),
        games: [
          {
            id: 'f1', homeTeamId: 't1', awayTeamId: 't2', stage: 'final', matchIndex: 0, field: 1,
            scheduledStart: '11:00', scheduledEnd: '11:30', round: 2, gameNumber: 1,
            periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }], rankTier: 1, placementFrom: 1,
          },
          {
            id: 'tp1', homeTeamId: 't3', awayTeamId: 't4', stage: 'third-place', matchIndex: 0, field: 2,
            scheduledStart: '11:00', scheduledEnd: '11:30', round: 2, gameNumber: 2,
            periodScores: [{ period: 1, homeScore: 15, awayScore: 12 }], rankTier: 1, placementFrom: 1,
          },
        ],
        totalDurationMin: 30, estimatedEnd: '11:30',
      },
    })
    render(<FinalStandingsPage />)
    expect(screen.getByText('1.')).toBeInTheDocument()
    expect(screen.getByText('Team Eins')).toBeInTheDocument()
    expect(screen.getByText('4.')).toBeInTheDocument()
    expect(screen.getByText('Team Vier')).toBeInTheDocument()
  })
```

Check whether `FinalStandingsPage.test.tsx` wraps its `render` calls in a router (some page tests
in this codebase do, via `{ wrapper: MemoryRouter }`) — match whatever the existing tests in this
file already do.

- [ ] **Step 10: Run the tests**

Run: `npx vitest run src/pages/FinalStandingsPage.test.tsx src/pages/BracketResultsPage.test.tsx src/components/layout/AppShell.test.tsx`

Expected: PASS, all tests.

- [ ] **Step 11: Full check + coverage**

Run: `npx tsc --noEmit && npx vitest run && npm run test:coverage`

Expected: all clean, no threshold violations.

- [ ] **Step 12: Run the E2E suite**

Run: `npx playwright test --reporter=list`

Expected: `e2e/endrunde-1.spec.ts` (written in Task 5) now passes, along with the full existing
E2E suite (no regressions). If it still fails, read the failure carefully — it's likely a text or
selector mismatch between the E2E test's assumptions (written before the UI existed) and what was
actually built; fix the E2E test to match the real, correct UI behavior (not the other way
around) unless the failure reveals an actual implementation bug, in which case fix the
implementation.

- [ ] **Step 13: Commit**

```bash
git add src/pages/BracketResultsPage.tsx src/pages/BracketResultsPage.test.tsx src/App.tsx src/components/layout/AppShell.tsx src/components/layout/AppShell.test.tsx src/pages/FinalStandingsPage.tsx src/pages/FinalStandingsPage.test.tsx
git commit -m "$(cat <<'EOF'
feat: add BracketResultsPage with per-rank-tier tabs, wire up Endrunde 1 end-to-end

New page (/bracket-results, nav label "Endrunde: K.-o.-Ergebnisse")
shows one tab per rank tier (analogous to GroupOverviewPage's
per-group tabs), each tab a self-contained results-entry list for
that tier's bracket (reusing the score-entry/correction pattern from
PlayoffResultsPage). FinalStandingsPage now branches on finalsVariant
to call computeEndrunde1Standings instead of computeFinalStandings
when appropriate, giving Endrunde 1 the same combined 1..N final
standing Endrunde 4 already has.

This closes out the full Endrunde 1 feature -- e2e/endrunde-1.spec.ts
(written failing in an earlier task) should now pass end-to-end.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ALVWiCue7JpbdjkwWKAH4p
EOF
)"
```

---

### Task 12: Full regression pass, coverage audit, and E2E confirmation

**Files:** none modified — verification only, plus fixing anything this step surfaces.

- [ ] **Step 1: Full unit test suite**

Run: `npx vitest run`

Expected: all tests passing, no regressions anywhere in the suite (not just the files touched by
this plan).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: clean.

- [ ] **Step 3: Coverage audit across the whole `src/lib`/`src/store` scope**

Run: `npm run test:coverage`

Expected: no per-file threshold violations anywhere (not just newly-touched files — this catches
any indirect regression, e.g. if a shared helper's branch coverage dropped because of a change in
how it's called). If any file is below 80% branches, add the missing test case for that specific
branch before considering this task done.

- [ ] **Step 4: Full E2E suite**

Run: `npx playwright test --reporter=list`

Expected: all passing, including both `e2e/endrunde-1.spec.ts` tests, `e2e/endrunde-3.spec.ts`
(migrated in Task 2-4, must still pass unchanged in behavior), and every pre-existing spec.

- [ ] **Step 5: Manual smoke check in a real browser (recommended, not strictly required for CI)**

```bash
npm run dev
```

Open the app, configure a small Endrunde-1 tournament (e.g. 4 groups of 2), play through the
group phase and the resulting bracket, and confirm the UI looks reasonable (no obviously broken
layout, sensible German copy) — this plan's automated tests verify correctness, not visual
polish.

- [ ] **Step 6: Update the CI workflow if needed**

Check that `.github/workflows/ci.yml`'s `coverage` job (added in a prior session, before this
plan started) still runs `npm run test:coverage` — no changes needed here unless Task 12's
coverage audit required new test files that changed which paths are covered by the existing
`include`/`exclude` globs in `vite.config.ts` (it shouldn't, since all new files live under the
already-included `src/lib/**` and `src/store/**`).

- [ ] **Step 7: Final commit (only if Steps 1-4 surfaced fixes)**

If everything passed cleanly in Steps 1-4, there's nothing to commit here — the plan is complete
as of Task 11's commit. If fixes were needed, commit them with a message describing what
regression or gap was found and fixed.

---

## Deferred (explicitly out of scope, per the design spec)

Do not implement these as part of this plan — they are noted here only so a future plan doesn't
have to rediscover why they were skipped:

- Byes for non-power-of-2 group counts.
- Buchholz-based cross-group seeding (`computeGroupPhaseBuchholz` stays unused by Endrunde 1,
  exactly as it was unused by Endrunde 3/4).
- Deferred/nachträgliche schedule generation after the group phase completes.
- A demo tournament for Endrunde 1 in `public/demos/` (nice-to-have per the design spec, not a
  blocker — pick up separately if there's time before the PR, otherwise leave for a follow-up).
- Endrunde 2/2a/2b/2c.
