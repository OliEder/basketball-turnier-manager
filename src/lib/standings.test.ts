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

describe('computeStandings buchholz', () => {
  it('buchholz is the sum of points of all opponents played so far', () => {
    // t1 beats t2 (round 1), t1 beats t3 (round 2)
    // t2's final points: 0 (round1 loss) + 2 (t2 beats t4 round 2) = 2
    // t4's final points: 2 (round1 win vs t3) + 0 (round2 loss vs t2) = 2
    const teams = [makeTeam('t1'), makeTeam('t2'), makeTeam('t3'), makeTeam('t4')]
    const games = [
      makeGame({
        id: 'g1', homeTeamId: 't1', awayTeamId: 't2', round: 1,
        periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }],
      }),
      makeGame({
        id: 'g2', homeTeamId: 't3', awayTeamId: 't4', round: 1,
        periodScores: [{ period: 1, homeScore: 5, awayScore: 15 }],
      }),
      makeGame({
        id: 'g3', homeTeamId: 't1', awayTeamId: 't3', round: 2,
        periodScores: [{ period: 1, homeScore: 18, awayScore: 12 }],
      }),
      makeGame({
        id: 'g4', homeTeamId: 't2', awayTeamId: 't4', round: 2,
        periodScores: [{ period: 1, homeScore: 22, awayScore: 20 }],
      }),
    ]
    const standings = computeStandings(teams, games, 2)
    // t1's opponents: t2 (final points 2) + t3 (final points 0) = buchholz 2
    expect(standings.find(s => s.teamId === 't1')!.buchholz).toBe(2)
    // t3's opponents: t4 (final points 2) + t1 (final points 4) = buchholz 6
    expect(standings.find(s => s.teamId === 't3')!.buchholz).toBe(6)
  })

  it('a bye counts as an opponent worth the bye team\'s own points for buchholz', () => {
    const teams = [makeTeam('t1'), makeTeam('t2'), makeTeam('t3')]
    const games = [
      makeGame({
        id: 'g1', homeTeamId: 't1', awayTeamId: 't2', round: 1,
        periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }],
      }),
      makeGame({
        id: 'g2', homeTeamId: null, awayTeamId: null, byeTeamId: 't3', round: 1,
        field: 0, scheduledStart: '10:00', scheduledEnd: '10:00', periodScores: [],
      }),
    ]
    const standings = computeStandings(teams, games, 1)
    // t3 had a bye worth 2 points, so t3's own buchholz includes its own points from the bye
    expect(standings.find(s => s.teamId === 't3')!.buchholz).toBe(2)
  })
})
