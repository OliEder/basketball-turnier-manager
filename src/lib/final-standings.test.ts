import { describe, it, expect } from 'vitest'
import { computeFinalStandings } from './final-standings'
import type { Game, Team } from '@/types'

const makeTeam = (id: string): Team => ({
  id, name: id, logoUrl: '', color: '#000', contact: '', players: [],
})

const makePlacementGame = (overrides: Partial<Game>): Game => ({
  id: 'g', homeTeamId: null, awayTeamId: null, stage: 'placement', field: 1,
  scheduledStart: '10:00', scheduledEnd: '10:30', round: 1, gameNumber: 1,
  periodScores: [], rankTier: 1, placementFrom: 1,
  ...overrides,
})

describe('computeFinalStandings', () => {
  it('orders teams within a cohort by placement points, then concatenates cohorts by placementFrom', () => {
    const teams = [makeTeam('a1'), makeTeam('b1'), makeTeam('a2'), makeTeam('b2')]
    const games = [
      makePlacementGame({ id: 'g1', rankTier: 1, placementFrom: 1, homeTeamId: 'a1', awayTeamId: 'b1', periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }] }),
      makePlacementGame({ id: 'g2', rankTier: 2, placementFrom: 5, homeTeamId: 'a2', awayTeamId: 'b2', periodScores: [{ period: 1, homeScore: 5, awayScore: 15 }] }),
    ]
    const standings = computeFinalStandings(teams, games)
    expect(standings.map(s => s.teamId)).toEqual(['a1', 'b1', 'b2', 'a2'])
    expect(standings.map(s => s.place)).toEqual([1, 2, 5, 6])
  })

  it('marks a cohort as incomplete when it still has unplayed games', () => {
    const teams = [makeTeam('a1'), makeTeam('b1')]
    const games = [
      makePlacementGame({ id: 'g1', rankTier: 1, placementFrom: 1, homeTeamId: 'a1', awayTeamId: 'b1', periodScores: [] }),
    ]
    const standings = computeFinalStandings(teams, games)
    expect(standings.every(s => s.pending)).toBe(true)
  })
})
