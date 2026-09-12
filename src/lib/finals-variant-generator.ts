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
