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
