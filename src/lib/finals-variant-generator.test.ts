import { describe, it, expect } from 'vitest'
import { computeGroupPhaseBuchholz } from './finals-variant-generator'
import type { Game } from '@/types'
import type { GroupStanding } from './group-standings'

const makeGame = (overrides: Partial<Game>): Game => ({
  id: 'g', homeTeamId: null, awayTeamId: null, stage: 'group', field: 1,
  scheduledStart: '09:00', scheduledEnd: '09:30', round: 1, gameNumber: 1,
  periodScores: [], groupId: 'A',
  ...overrides,
})

const standing = (teamId: string, points: number): GroupStanding => ({
  teamId, points, wins: 0, draws: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, pointsDiff: 0,
})

describe('computeGroupPhaseBuchholz', () => {
  it('sums the final points of every opponent a team played in its own group', () => {
    const games = [
      makeGame({ groupId: 'A', homeTeamId: 't1', awayTeamId: 't2', periodScores: [{ period: 1, homeScore: 20, awayScore: 15 }] }),
      makeGame({ groupId: 'A', homeTeamId: 't1', awayTeamId: 't3', periodScores: [{ period: 1, homeScore: 20, awayScore: 15 }] }),
    ]
    const standingsByTeamId = new Map([
      ['t1', standing('t1', 4)],
      ['t2', standing('t2', 0)],
      ['t3', standing('t3', 2)],
    ])
    // t1 played t2 (0 pts) and t3 (2 pts) -> buchholz = 2
    expect(computeGroupPhaseBuchholz('t1', games, standingsByTeamId)).toBe(2)
  })

  it('returns 0 for a team with no scored games', () => {
    const games = [makeGame({ groupId: 'A', homeTeamId: 't1', awayTeamId: 't2', periodScores: [] })]
    const standingsByTeamId = new Map([['t1', standing('t1', 0)], ['t2', standing('t2', 0)]])
    expect(computeGroupPhaseBuchholz('t1', games, standingsByTeamId)).toBe(0)
  })
})
