import type { Game, Team } from '@/types'

export function computeFinalScore(game: Game): { home: number; away: number } {
  if (game.periodScores.length === 0) {
    throw new Error('Spiel wurde noch nicht ausgewertet')
  }
  return game.periodScores.reduce(
    (acc, p) => ({ home: acc.home + p.homeScore, away: acc.away + p.awayScore }),
    { home: 0, away: 0 },
  )
}

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

function isScorableGame(game: Game): game is Game & { homeTeamId: string; awayTeamId: string } {
  return !game.cancelledReason && !!game.homeTeamId && !!game.awayTeamId && game.periodScores.length > 0
}

export function computeStandings(teams: Team[], games: Game[], throughRound: number): TeamStanding[] {
  const relevantGames = games.filter(g => g.stage === 'swiss' && g.round <= throughRound)

  const standingsByTeamId = new Map<string, TeamStanding>(
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
      const s = standingsByTeamId.get(game.byeTeamId)
      if (s) {
        s.points += 2
        s.hadBye = true
      }
      continue
    }
    if (game.cancelledReason === 'withdrawal' && game.homeTeamId && game.awayTeamId) {
      const withdrawingIsHome = standingsByTeamId.get(game.homeTeamId)?.withdrawn
      const survivingTeamId = withdrawingIsHome ? game.awayTeamId : game.homeTeamId
      const survivor = standingsByTeamId.get(survivingTeamId)
      if (survivor) {
        survivor.points += 2
        survivor.hadBye = true
      }
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

  for (const game of relevantGames) {
    if (game.byeTeamId) {
      const byeStanding = standingsByTeamId.get(game.byeTeamId)
      if (byeStanding) byeStanding.buchholz += byeStanding.points
      continue
    }
    if (!isScorableGame(game)) continue
    const homeStanding = standingsByTeamId.get(game.homeTeamId)
    const awayStanding = standingsByTeamId.get(game.awayTeamId)
    if (homeStanding && awayStanding) {
      homeStanding.buchholz += awayStanding.points
      awayStanding.buchholz += homeStanding.points
    }
  }

  return [...standingsByTeamId.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz
    return b.pointsDiff - a.pointsDiff
  })
}
