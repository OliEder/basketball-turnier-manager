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
 * diff) reused here by relabeling the cohort as a synthetic "group" keyed by its rankTier, since a
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
    const tierGroupId = `tier-${rankTier}`
    // computeGroupStandings filters BOTH teams and games by groupId, so relabel both sides —
    // relabeling only the games would silently produce empty standings (teams keep their real
    // group-phase groupId, which never matches the synthetic tier id).
    const cohortTeams = teams.filter(t => cohortTeamIds.has(t.id)).map(t => ({ ...t, groupId: tierGroupId }))
    const pending = cohortGames.some(g => g.periodScores.length === 0 && !g.cancelledReason)

    const relabeledGames = cohortGames.map(g => ({ ...g, stage: 'group' as const, groupId: tierGroupId }))
    const cohortStandings = computeGroupStandings(cohortTeams, relabeledGames, tierGroupId)

    cohortStandings.forEach((standing, index) => {
      results.push({ teamId: standing.teamId, place: placementFrom + index, pending })
    })
  }
  return results
}
