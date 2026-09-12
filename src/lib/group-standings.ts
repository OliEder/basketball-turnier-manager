import type { Game, Team } from '@/types'
import { computeFinalScore } from './standings'

export interface GroupStanding {
  teamId: string
  points: number
  wins: number
  draws: number
  losses: number
  pointsFor: number
  pointsAgainst: number
  pointsDiff: number
  withdrawn: boolean
}

function pointsForResult(home: number, away: number): [number, number] {
  if (home > away) return [2, 0]
  if (home < away) return [0, 2]
  return [1, 1]
}

function isScorableGame(game: Game): game is Game & { homeTeamId: string; awayTeamId: string } {
  return !game.cancelledReason && !!game.homeTeamId && !!game.awayTeamId && game.periodScores.length > 0
}

function headToHeadPointsDiff(teamA: string, teamB: string, games: Game[]): number {
  let diff = 0
  for (const game of games) {
    if (!isScorableGame(game)) continue
    const involvesBoth =
      (game.homeTeamId === teamA && game.awayTeamId === teamB) ||
      (game.homeTeamId === teamB && game.awayTeamId === teamA)
    if (!involvesBoth) continue
    const { home, away } = computeFinalScore(game)
    diff += game.homeTeamId === teamA ? home - away : away - home
  }
  return diff
}

export function computeGroupStandings(teams: Team[], games: Game[], groupId: string): GroupStanding[] {
  const groupTeamIds = new Set(teams.filter(t => (t.groupId ?? 'A') === groupId).map(t => t.id))
  const relevantGames = games.filter(g => g.stage === 'group' && (g.groupId ?? 'A') === groupId)

  const teamsById = new Map(teams.map(t => [t.id, t]))

  const standingsByTeamId = new Map<string, GroupStanding>(
    [...groupTeamIds].map(teamId => [teamId, {
      teamId, points: 0, wins: 0, draws: 0, losses: 0,
      pointsFor: 0, pointsAgainst: 0, pointsDiff: 0,
      withdrawn: teamsById.get(teamId)?.withdrawnAfterStage != null,
    }]),
  )

  for (const game of relevantGames) {
    if (game.cancelledReason === 'withdrawal' && game.homeTeamId && game.awayTeamId) {
      const homeWithdrawn = teamsById.get(game.homeTeamId)?.withdrawnAfterStage != null
      const survivorId = homeWithdrawn ? game.awayTeamId : game.homeTeamId
      const survivor = standingsByTeamId.get(survivorId)
      if (survivor) survivor.points += 2 // walkover win; no pointsFor/pointsAgainst — no game was actually played
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

  for (const standing of standingsByTeamId.values()) {
    standing.pointsDiff = standing.pointsFor - standing.pointsAgainst
  }

  return [...standingsByTeamId.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const h2h = headToHeadPointsDiff(a.teamId, b.teamId, relevantGames)
    if (h2h !== 0) return -h2h
    return b.pointsDiff - a.pointsDiff
  })
}
