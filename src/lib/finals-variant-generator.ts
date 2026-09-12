import { v4 as uuidv4 } from 'uuid'
import type { Game, GameSettings, TimeWindow } from '@/types'
import type { GroupStanding } from './group-standings'
import { generateRoundRobinRounds } from './schedule-generator'
import { calcGameDurationMin, addMinutes, findNextSlot, timeToMinutes } from './game-duration'

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
