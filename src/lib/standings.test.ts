import { describe, it, expect } from 'vitest'
import { computeFinalScore, computeStandings } from './standings'
import type { Game, Team } from '@/types'

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

const makeTeam = (id: string, overrides: Partial<Team> = {}): Team => ({
  id, name: id, logoUrl: '', color: '#000', contact: '', players: [], ...overrides,
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

describe('computeStandings', () => {
  it('awards 2 points for a win, 0 for a loss', () => {
    const teams = [makeTeam('t1'), makeTeam('t2')]
    const games = [
      makeGame({
        homeTeamId: 't1', awayTeamId: 't2', round: 1,
        periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }],
      }),
    ]
    const standings = computeStandings(teams, games, 1)
    const t1 = standings.find(s => s.teamId === 't1')!
    const t2 = standings.find(s => s.teamId === 't2')!
    expect(t1.points).toBe(2)
    expect(t1.wins).toBe(1)
    expect(t2.points).toBe(0)
    expect(t2.losses).toBe(1)
  })

  it('awards 1 point each for a draw', () => {
    const teams = [makeTeam('t1'), makeTeam('t2')]
    const games = [
      makeGame({
        homeTeamId: 't1', awayTeamId: 't2', round: 1,
        periodScores: [{ period: 1, homeScore: 15, awayScore: 15 }],
      }),
    ]
    const standings = computeStandings(teams, games, 1)
    expect(standings.find(s => s.teamId === 't1')!.points).toBe(1)
    expect(standings.find(s => s.teamId === 't2')!.points).toBe(1)
    expect(standings.find(s => s.teamId === 't1')!.draws).toBe(1)
  })

  it('computes pointsFor, pointsAgainst and pointsDiff', () => {
    const teams = [makeTeam('t1'), makeTeam('t2')]
    const games = [
      makeGame({
        homeTeamId: 't1', awayTeamId: 't2', round: 1,
        periodScores: [{ period: 1, homeScore: 20, awayScore: 12 }],
      }),
    ]
    const standings = computeStandings(teams, games, 1)
    const t1 = standings.find(s => s.teamId === 't1')!
    expect(t1.pointsFor).toBe(20)
    expect(t1.pointsAgainst).toBe(12)
    expect(t1.pointsDiff).toBe(8)
  })

  it('a bye awards 2 points and does not affect pointsFor/pointsAgainst', () => {
    const teams = [makeTeam('t1'), makeTeam('t2')]
    const games = [
      makeGame({
        homeTeamId: null, awayTeamId: null, byeTeamId: 't1', round: 1,
        field: 0, scheduledStart: '10:00', scheduledEnd: '10:00', periodScores: [],
      }),
    ]
    const standings = computeStandings(teams, games, 1)
    const t1 = standings.find(s => s.teamId === 't1')!
    expect(t1.points).toBe(2)
    expect(t1.hadBye).toBe(true)
    expect(t1.pointsFor).toBe(0)
    expect(t1.pointsAgainst).toBe(0)
  })

  it('only counts games up to and including throughRound', () => {
    const teams = [makeTeam('t1'), makeTeam('t2')]
    const games = [
      makeGame({
        homeTeamId: 't1', awayTeamId: 't2', round: 1,
        periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }],
      }),
      makeGame({
        id: 'g2', homeTeamId: 't2', awayTeamId: 't1', round: 2,
        periodScores: [{ period: 1, homeScore: 30, awayScore: 5 }],
      }),
    ]
    const standings = computeStandings(teams, games, 1)
    expect(standings.find(s => s.teamId === 't1')!.points).toBe(2)
  })

  it('sorts by points desc, then buchholz desc, then pointsDiff desc', () => {
    const teams = [makeTeam('t1'), makeTeam('t2'), makeTeam('t3')]
    const games = [
      makeGame({
        id: 'g1', homeTeamId: 't1', awayTeamId: 't2', round: 1,
        periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }],
      }),
      makeGame({
        id: 'g2', homeTeamId: 't3', awayTeamId: 't1', round: 2,
        periodScores: [{ period: 1, homeScore: 5, awayScore: 25 }],
      }),
    ]
    const standings = computeStandings(teams, games, 2)
    expect(standings[0].teamId).toBe('t1') // 4 points, clear leader
  })
})
