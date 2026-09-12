import { describe, it, expect } from 'vitest'
import { computeFinalStandings, computeEndrunde1Standings } from './final-standings'
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

describe('computeEndrunde1Standings', () => {
  const makeKoGame = (overrides: Partial<Game>): Game => ({
    id: 'g', homeTeamId: null, awayTeamId: null, stage: 'final', field: 1,
    scheduledStart: '10:00', scheduledEnd: '10:30', round: 1, gameNumber: 1,
    periodScores: [], rankTier: 1, placementFrom: 1, matchIndex: 0,
    ...overrides,
  })

  it('orders a single rank tier by final winner, final loser, third-place winner, third-place loser', () => {
    const teams = [makeTeam('a1'), makeTeam('a2'), makeTeam('a3'), makeTeam('a4')]
    const games = [
      makeKoGame({
        id: 'f1', stage: 'final', rankTier: 1, placementFrom: 1,
        homeTeamId: 'a1', awayTeamId: 'a2', periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }],
      }),
      makeKoGame({
        id: 'tp1', stage: 'third-place', rankTier: 1, placementFrom: 1,
        homeTeamId: 'a3', awayTeamId: 'a4', periodScores: [{ period: 1, homeScore: 15, awayScore: 12 }],
      }),
    ]
    const standings = computeEndrunde1Standings(teams, games)
    expect(standings).toEqual([
      { teamId: 'a1', place: 1, pending: false },
      { teamId: 'a2', place: 2, pending: false },
      { teamId: 'a3', place: 3, pending: false },
      { teamId: 'a4', place: 4, pending: false },
    ])
  })

  it('offsets place numbers for a second rank tier by placementFrom', () => {
    const teams = [makeTeam('b1'), makeTeam('b2'), makeTeam('b3'), makeTeam('b4')]
    const games = [
      makeKoGame({
        id: 'f2', stage: 'final', rankTier: 2, placementFrom: 5,
        homeTeamId: 'b1', awayTeamId: 'b2', periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }],
      }),
      makeKoGame({
        id: 'tp2', stage: 'third-place', rankTier: 2, placementFrom: 5,
        homeTeamId: 'b3', awayTeamId: 'b4', periodScores: [{ period: 1, homeScore: 15, awayScore: 12 }],
      }),
    ]
    const standings = computeEndrunde1Standings(teams, games)
    expect(standings.map(s => s.place)).toEqual([5, 6, 7, 8])
  })

  it('marks a rank tier pending when its final or third-place game has not been played yet', () => {
    const teams = [makeTeam('a1'), makeTeam('a2'), makeTeam('a3'), makeTeam('a4')]
    const games = [
      makeKoGame({
        id: 'f1', stage: 'final', rankTier: 1, placementFrom: 1,
        homeTeamId: 'a1', awayTeamId: 'a2', periodScores: [],
      }),
      makeKoGame({
        id: 'tp1', stage: 'third-place', rankTier: 1, placementFrom: 1,
        homeTeamId: null, awayTeamId: null, periodScores: [],
      }),
    ]
    const standings = computeEndrunde1Standings(teams, games)
    expect(standings.every(s => s.pending)).toBe(true)
  })

  it('combines two rank tiers into one sorted 1..N list', () => {
    const teams = [makeTeam('a1'), makeTeam('a2'), makeTeam('a3'), makeTeam('a4'), makeTeam('b1'), makeTeam('b2'), makeTeam('b3'), makeTeam('b4')]
    const games = [
      makeKoGame({ id: 'f1', stage: 'final', rankTier: 1, placementFrom: 1, homeTeamId: 'a1', awayTeamId: 'a2', periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }] }),
      makeKoGame({ id: 'tp1', stage: 'third-place', rankTier: 1, placementFrom: 1, homeTeamId: 'a3', awayTeamId: 'a4', periodScores: [{ period: 1, homeScore: 15, awayScore: 12 }] }),
      makeKoGame({ id: 'f2', stage: 'final', rankTier: 2, placementFrom: 5, homeTeamId: 'b1', awayTeamId: 'b2', periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }] }),
      makeKoGame({ id: 'tp2', stage: 'third-place', rankTier: 2, placementFrom: 5, homeTeamId: 'b3', awayTeamId: 'b4', periodScores: [{ period: 1, homeScore: 15, awayScore: 12 }] }),
    ]
    const standings = computeEndrunde1Standings(teams, games)
    expect(standings.map(s => s.place)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(standings.map(s => s.teamId)).toEqual(['a1', 'a2', 'a3', 'a4', 'b1', 'b2', 'b3', 'b4'])
  })

  it('returns an empty list when there are no KO-bracket games at all', () => {
    expect(computeEndrunde1Standings([], [])).toEqual([])
  })

  it('picks the away team as winner/loser when the away team outscores the home team', () => {
    const teams = [makeTeam('a1'), makeTeam('a2'), makeTeam('a3'), makeTeam('a4')]
    const games = [
      makeKoGame({
        id: 'f1', stage: 'final', rankTier: 1, placementFrom: 1,
        homeTeamId: 'a1', awayTeamId: 'a2', periodScores: [{ period: 1, homeScore: 10, awayScore: 20 }],
      }),
      makeKoGame({
        id: 'tp1', stage: 'third-place', rankTier: 1, placementFrom: 1,
        homeTeamId: 'a3', awayTeamId: 'a4', periodScores: [{ period: 1, homeScore: 12, awayScore: 15 }],
      }),
    ]
    const standings = computeEndrunde1Standings(teams, games)
    expect(standings).toEqual([
      { teamId: 'a2', place: 1, pending: false },
      { teamId: 'a1', place: 2, pending: false },
      { teamId: 'a4', place: 3, pending: false },
      { teamId: 'a3', place: 4, pending: false },
    ])
  })

  it('skips a rank tier that has only a final or only a third-place game (no matching pair)', () => {
    const teams = [makeTeam('a1'), makeTeam('a2')]
    const games = [
      makeKoGame({
        id: 'f1', stage: 'final', rankTier: 1, placementFrom: 1,
        homeTeamId: 'a1', awayTeamId: 'a2', periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }],
      }),
    ]
    expect(computeEndrunde1Standings(teams, games)).toEqual([])
  })
})
