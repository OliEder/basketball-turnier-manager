import { describe, it, expect } from 'vitest'
import { computeFinalScore } from './standings'
import type { Game } from '@/types'

const makeGame = (overrides: Partial<Game> = {}): Game => ({
  id: 'g1',
  homeTeamId: 't1',
  awayTeamId: 't2',
  stage: 'swiss',
  field: 1,
  scheduledStart: '10:00',
  scheduledEnd: '10:30',
  round: 1,
  gameNumber: 1,
  periodScores: [],
  ...overrides,
})

describe('computeFinalScore', () => {
  it('sums periodScores for home and away', () => {
    const game = makeGame({
      periodScores: [
        { period: 1, homeScore: 10, awayScore: 8 },
        { period: 2, homeScore: 12, awayScore: 14 },
      ],
    })
    expect(computeFinalScore(game)).toEqual({ home: 22, away: 22 })
  })

  it('throws when periodScores is empty (game not yet played)', () => {
    const game = makeGame({ periodScores: [] })
    expect(() => computeFinalScore(game)).toThrow('Spiel wurde noch nicht ausgewertet')
  })
})
