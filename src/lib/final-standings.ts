import type { Game, Team } from '@/types'
import { computeGroupStandings } from './group-standings'
import { computeFinalScore } from './standings'

export interface FinalStanding {
  teamId: string
  place: number
  pending: boolean  // true if this team's cohort still has an unplayed game
}

/**
 * Resolves a placement game's homeSourceRank/awaySourceRank into a real team id, the same way
 * resolvePlaceholders (tournament-store.ts) does, so a cohort's membership can be determined even
 * before every one of its games has itself been played — a placement game only carries a real
 * homeTeamId/awayTeamId once BOTH its own result AND the group phase are complete, but the source
 * group standings are often already knowable well before that.
 */
function resolveSourceRankTeamId(
  sourceRank: { groupId: string; rank: number } | undefined,
  groupStandingsByGroupId: Map<string, ReturnType<typeof computeGroupStandings>>,
): string | undefined {
  if (!sourceRank) return undefined
  return groupStandingsByGroupId.get(sourceRank.groupId)?.[sourceRank.rank - 1]?.teamId
}

/**
 * Builds the overall 1..N tournament ranking from Endrunde-4 placement-cohort results. Each
 * cohort's internal order comes from computeGroupStandings (points -> head-to-head -> point
 * diff) reused here by relabeling the cohort as a synthetic "group" keyed by its rankTier, since a
 * placement cohort is structurally identical to a group-phase round-robin group. Every team that
 * belongs to a cohort (per its games' homeSourceRank/awaySourceRank) is represented, even if its
 * slot hasn't been resolved into a real game yet — such teams appear as pending rows without a
 * teamId, rather than being silently omitted from the standings.
 */
export function computeFinalStandings(teams: Team[], games: Game[]): FinalStanding[] {
  const placementGames = games.filter(g => g.stage === 'placement')
  const rankTiers = [...new Set(placementGames.map(g => g.rankTier!))].sort((a, b) => a - b)

  // A withdrawn team is excluded from the qualifying ranks here too, mirroring resolvePlaceholders
  // (tournament-store.ts) — the displayed standings must not show a withdrawn team occupying a
  // placement-cohort slot it never actually played its way into.
  const groupIds = [...new Set(teams.map(t => t.groupId ?? 'A'))]
  const groupStandingsByGroupId = new Map(
    groupIds.map(id => [id, computeGroupStandings(teams, games, id).filter(s => !s.withdrawn)]),
  )

  const results: FinalStanding[] = []
  for (const rankTier of rankTiers) {
    const cohortGames = placementGames.filter(g => g.rankTier === rankTier)
    const placementFrom = cohortGames[0].placementFrom!
    const pending = cohortGames.some(g => g.periodScores.length === 0 && !g.cancelledReason)

    const cohortTeamIds = new Set(
      cohortGames.flatMap(g => [
        g.homeTeamId ?? resolveSourceRankTeamId(g.homeSourceRank, groupStandingsByGroupId),
        g.awayTeamId ?? resolveSourceRankTeamId(g.awaySourceRank, groupStandingsByGroupId),
      ].filter((id): id is string => !!id)),
    )
    const tierGroupId = `tier-${rankTier}`
    // computeGroupStandings filters BOTH teams and games by groupId, so relabel both sides —
    // relabeling only the games would silently produce empty standings (teams keep their real
    // group-phase groupId, which never matches the synthetic tier id).
    const cohortTeams = teams.filter(t => cohortTeamIds.has(t.id)).map(t => ({ ...t, groupId: tierGroupId }))
    const resolvedCohortGames = cohortGames
      .map(g => ({
        ...g,
        homeTeamId: g.homeTeamId ?? resolveSourceRankTeamId(g.homeSourceRank, groupStandingsByGroupId) ?? null,
        awayTeamId: g.awayTeamId ?? resolveSourceRankTeamId(g.awaySourceRank, groupStandingsByGroupId) ?? null,
      }))
      .filter(g => g.homeTeamId && g.awayTeamId)
      .map(g => ({ ...g, stage: 'group' as const, groupId: tierGroupId }))
    const cohortStandings = computeGroupStandings(cohortTeams, resolvedCohortGames, tierGroupId)

    cohortStandings.forEach((standing, index) => {
      results.push({ teamId: standing.teamId, place: placementFrom + index, pending })
    })
  }
  return results
}

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
// `teams` isn't needed here (unlike computeFinalStandings) -- Endrunde-1 KO games always carry a
// real homeTeamId/awayTeamId once played, so there's no group-standings-based placeholder
// resolution to do. The parameter stays for call-site symmetry with computeFinalStandings.
export function computeEndrunde1Standings(_teams: Team[], games: Game[]): FinalStanding[] {
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
