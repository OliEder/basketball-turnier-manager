import { v4 as uuidv4 } from 'uuid'
import type { Game, GameSettings, GameStage, TimeWindow } from '@/types'
import type { GroupStanding } from './group-standings'
import { generateRoundRobinRounds } from './schedule-generator'
import { calcGameDurationMin, addMinutes, findNextSlot, timeToMinutes, maxTime } from './game-duration'

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

/**
 * Standard single-elimination bracket seed order for `size` slots: pairs seed 1 with seed `size`,
 * seed 2 with seed `size-1`, etc., recursively arranged so the two best seeds can only meet in the
 * final (the well-known "avoid an early final" seeding used by most KO tournaments). Returns a
 * flat list of 0-based seed indices in bracket match order: [match0.home, match0.away, match1.home, match1.away, ...].
 *
 * Worked trace for size=4: half = order(2) = [0,1] (base case pairs 0 with 2-1-0=1, i.e. [0,1]);
 * then each seed in half is paired with its mirror (size-1-seed): 0->3, 1->2, giving [0,3,1,2] —
 * i.e. match0 = seed0 vs seed3 (1v4), match1 = seed1 vs seed2 (2v3). The recursion preserves this
 * mirror-pairing invariant at every level, since halving/mirroring a valid order for size/2 and
 * then mirroring each element against `size-1` always keeps the two lowest (best) seeds in
 * different halves of the bracket until the final round.
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
 * BuildBracketInput.sourceRanks. Consumed pairwise as
 * `sourceRanks[matchIndex*2]`/`sourceRanks[matchIndex*2+1]` (see the `homeSourceRank`/
 * `awaySourceRank` assignment in buildBracket's first-round loop below) — if that indexing
 * convention ever changes, this function's "match order" contract must change with it.
 */
export function buildQualifierSeeds(groupIds: string[], rank: number): { groupId: string; rank: number }[] {
  const size = groupIds.length
  if (![2, 4, 8, 16, 32].includes(size)) {
    throw new Error('Endrunde 1/3 benötigt 2, 4, 8, 16 oder 32 Gruppen')
  }
  const sorted = [...groupIds].sort()
  return standardBracketSeedOrder(size).map(seedIndex => ({ groupId: sorted[seedIndex], rank }))
}

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
  placementFrom: number  // best place this bracket plays for: 1, 5, 9, ... (see PlacementCohort)
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
  const { bracketSize, rankTier, placementFrom, sourceRanks, fields, gameSettings, blackoutPeriods, availabilityEnd, startGameNumber } = input
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
          gameSettings.bufferBetweenGamesMin + gameSettings.breakBetweenRoundsMin,
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
        placementFrom,
        matchIndex,
        field: bestField + 1,
        scheduledStart: bestSlotStart,
        scheduledEnd: slotEnd,
        round: roundIndex + 1,
        gameNumber: gameNumber++,
        periodScores: [],
        // matchIndex*2 / matchIndex*2+1: standard binary-tree parent-child indexing -- this
        // round's match i is fed by the previous round's matches at 2i and 2i+1 (see the doc
        // comment above this function for the general statement of this invariant).
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
    // 4-bracket third-place scheduling). Only when there IS a semifinal to draw losers from — a
    // bare 2-team bracket has no semifinal, so no third-place game either.
    if (stage === 'final' && roundIndex > 0) {
      const semifinalStage = stages[roundIndex - 1]
      let bestField = -1
      let bestSlotStart = ''
      for (let f = 0; f < fields; f++) {
        // Same breakBetweenRoundsMin gate as the main round loop above: the third-place game is
        // fed by semifinal losers, just as the final is fed by semifinal winners, so it must not
        // start any earlier than the final itself is allowed to.
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
        placementFrom,
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
 *
 * Each cohort's placement range spans as many places as there are groups (e.g. 4 groups -> 1-4,
 * 5-8, 9-12; 2 groups -> 1-2, 3-4, 5-6): Endrunde 4 supports any groupCount, matching the
 * multi-group round-robin design this feature builds on — it is NOT fixed to exactly 4 groups
 * just because the user's original requirement text used "vier Gruppenersten" as its example.
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
 * group/rank pair that will later resolve to a real team, via placeholder resolution in the store.
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
    // Relies on generateRoundRobinRounds preserving input order/identity (positional indexing),
    // not sorting ids lexicographically — true today, would need revisiting if that changed.
    const slotIds = cohort.sourceRanks.map((_, i) => String(i))
    const rounds = generateRoundRobinRounds(slotIds)

    // No per-team clock is tracked (unlike generateSchedule's group-phase loop) — safe because
    // (a) generateRoundRobinRounds guarantees a slot appears at most once within a single round,
    // and (b) cohorts are disjoint (buildPlacementCohorts assigns each team to exactly one cohort),
    // so no team can be double-booked across cohorts scheduled in the same pass either.
    rounds.forEach((round, roundIndex) => {
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
          // Throws (rather than schedule-generator.ts's group-phase warn-and-skip) because a
          // dropped placement game would corrupt cohort standings — failing loudly is correct here.
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
          round: roundIndex + 1,
          gameNumber: gameNumber++,
          periodScores: [],
        })

        fieldClocks[bestField] = addMinutes(bestSlotStart, slotDuration)
      }
    })
  }

  return games
}
