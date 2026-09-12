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

  it('represents every team in a 4-team cohort as a pending row, even when most of the cohort games are still unresolved placeholders', () => {
    // Regression: cohortTeamIds used to be built only from resolved (non-null) homeTeamId/awayTeamId
    // values, so a cohort with only 1 of 6 games resolved+played silently dropped the other teams
    // from the standings instead of showing them as pending.
    const teams = [makeTeam('a1'), makeTeam('a2'), makeTeam('a3'), makeTeam('a4')]
    const games = [
      makePlacementGame({
        id: 'g1', rankTier: 1, placementFrom: 1, homeTeamId: 'a1', awayTeamId: 'a2',
        periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }],
      }),
      // the other 5 round-robin games in this 4-team cohort are still unresolved placeholders
      makePlacementGame({ id: 'g2', rankTier: 1, placementFrom: 1, homeTeamId: null, awayTeamId: null, homeSourceRank: { groupId: 'A', rank: 1 }, awaySourceRank: { groupId: 'A', rank: 3 } }),
      makePlacementGame({ id: 'g3', rankTier: 1, placementFrom: 1, homeTeamId: null, awayTeamId: null, homeSourceRank: { groupId: 'A', rank: 1 }, awaySourceRank: { groupId: 'A', rank: 4 } }),
      makePlacementGame({ id: 'g4', rankTier: 1, placementFrom: 1, homeTeamId: null, awayTeamId: null, homeSourceRank: { groupId: 'A', rank: 2 }, awaySourceRank: { groupId: 'A', rank: 3 } }),
      makePlacementGame({ id: 'g5', rankTier: 1, placementFrom: 1, homeTeamId: null, awayTeamId: null, homeSourceRank: { groupId: 'A', rank: 2 }, awaySourceRank: { groupId: 'A', rank: 4 } }),
      makePlacementGame({ id: 'g6', rankTier: 1, placementFrom: 1, homeTeamId: null, awayTeamId: null, homeSourceRank: { groupId: 'A', rank: 3 }, awaySourceRank: { groupId: 'A', rank: 4 } }),
    ]
    const standings = computeFinalStandings(teams, games)
    expect(standings).toHaveLength(4)
    expect(standings.map(s => s.place).sort()).toEqual([1, 2, 3, 4])
    expect(standings.every(s => s.pending)).toBe(true)
  })
})
