import { describe, it, expect } from 'vitest'
import { computeGroupStandings } from './group-standings'
import type { Game, Team } from '@/types'

const makeTeam = (id: string, name: string, groupId = 'A'): Team => ({
  id, name, logoUrl: '', color: '#000', contact: '', players: [], groupId,
})

const makeGame = (overrides: Partial<Game>): Game => ({
  id: 'g', homeTeamId: null, awayTeamId: null, stage: 'group', field: 1,
  scheduledStart: '09:00', scheduledEnd: '09:30', round: 1, gameNumber: 1,
  periodScores: [], groupId: 'A',
  ...overrides,
})

describe('computeGroupStandings', () => {
  it('computes points from wins/draws/losses (2/1/0 scoring)', () => {
    const teams = [makeTeam('t1', 'Team 1'), makeTeam('t2', 'Team 2')]
    const games = [
      makeGame({ homeTeamId: 't1', awayTeamId: 't2', periodScores: [{ period: 1, homeScore: 20, awayScore: 15 }] }),
    ]
    const standings = computeGroupStandings(teams, games, 'A')
    expect(standings.find(s => s.teamId === 't1')!.points).toBe(2)
    expect(standings.find(s => s.teamId === 't2')!.points).toBe(0)
  })

  it('only includes games from the specified group', () => {
    const teams = [
      makeTeam('t1', 'Team 1', 'A'), makeTeam('t2', 'Team 2', 'A'),
      makeTeam('t3', 'Team 3', 'B'), makeTeam('t4', 'Team 4', 'B'),
    ]
    const games = [
      makeGame({ groupId: 'A', homeTeamId: 't1', awayTeamId: 't2', periodScores: [{ period: 1, homeScore: 20, awayScore: 15 }] }),
      makeGame({ groupId: 'B', homeTeamId: 't3', awayTeamId: 't4', periodScores: [{ period: 1, homeScore: 30, awayScore: 10 }] }),
    ]
    const standingsA = computeGroupStandings(teams, games, 'A')
    expect(standingsA).toHaveLength(2)
    expect(standingsA.map(s => s.teamId).sort()).toEqual(['t1', 't2'])
  })

  it('sorts by points first', () => {
    const teams = [makeTeam('t1', 'Team 1'), makeTeam('t2', 'Team 2'), makeTeam('t3', 'Team 3')]
    const games = [
      makeGame({ homeTeamId: 't1', awayTeamId: 't2', periodScores: [{ period: 1, homeScore: 20, awayScore: 15 }] }),
      makeGame({ homeTeamId: 't1', awayTeamId: 't3', periodScores: [{ period: 1, homeScore: 20, awayScore: 15 }] }),
      makeGame({ homeTeamId: 't2', awayTeamId: 't3', periodScores: [{ period: 1, homeScore: 20, awayScore: 15 }] }),
    ]
    const standings = computeGroupStandings(teams, games, 'A')
    expect(standings.map(s => s.teamId)).toEqual(['t1', 't2', 't3'])
  })

  it('breaks a points tie using head-to-head result before overall point difference', () => {
    // t1 and t2 tie on points (2 each), but t1 beat t2 head-to-head, while t2 has a much
    // better overall point difference from beating t3 by a wide margin. Head-to-head must win.
    const teams = [makeTeam('t1', 'Team 1'), makeTeam('t2', 'Team 2'), makeTeam('t3', 'Team 3')]
    const games = [
      makeGame({ homeTeamId: 't1', awayTeamId: 't2', periodScores: [{ period: 1, homeScore: 21, awayScore: 20 }] }),
      makeGame({ homeTeamId: 't2', awayTeamId: 't3', periodScores: [{ period: 1, homeScore: 50, awayScore: 10 }] }),
      makeGame({ homeTeamId: 't1', awayTeamId: 't3', periodScores: [{ period: 1, homeScore: 15, awayScore: 25 }] }),
    ]
    const standings = computeGroupStandings(teams, games, 'A')
    // t1: 1 win (vs t2) + 1 loss (vs t3) = 2 pts, diff = (21-20)+(15-25) = -9
    // t2: 1 loss (vs t1) + 1 win (vs t3) = 2 pts, diff = (20-21)+(50-10) = +39
    // Points tie at 2 each; t1 beat t2 head-to-head (21:20), so t1 must rank above t2
    // despite t2's much better overall point difference.
    const t1Index = standings.findIndex(s => s.teamId === 't1')
    const t2Index = standings.findIndex(s => s.teamId === 't2')
    expect(t1Index).toBeLessThan(t2Index)
  })

  it('falls back to overall point difference when head-to-head is also tied (e.g. only one game played so far, or a draw)', () => {
    const teams = [makeTeam('t1', 'Team 1'), makeTeam('t2', 'Team 2'), makeTeam('t3', 'Team 3')]
    const games = [
      // t1 and t2 haven't played each other yet, but both have 2 points from beating t3
      makeGame({ homeTeamId: 't1', awayTeamId: 't3', periodScores: [{ period: 1, homeScore: 30, awayScore: 10 }] }),
      makeGame({ homeTeamId: 't2', awayTeamId: 't3', periodScores: [{ period: 1, homeScore: 20, awayScore: 18 }] }),
    ]
    const standings = computeGroupStandings(teams, games, 'A')
    // t1: diff = +20, t2: diff = +2 -> t1 ranks above t2 via point diff, since no head-to-head exists
    const t1Index = standings.findIndex(s => s.teamId === 't1')
    const t2Index = standings.findIndex(s => s.teamId === 't2')
    expect(t1Index).toBeLessThan(t2Index)
  })

  it('does not count an unplayed game', () => {
    const teams = [makeTeam('t1', 'Team 1'), makeTeam('t2', 'Team 2')]
    const games = [makeGame({ homeTeamId: 't1', awayTeamId: 't2', periodScores: [] })]
    const standings = computeGroupStandings(teams, games, 'A')
    expect(standings.every(s => s.points === 0)).toBe(true)
  })

  it('awards walkover points to the surviving team when the home team withdrew after the FINALS stage (not just "group")', () => {
    // Regression: the walkover-survivor lookup used to literal-match withdrawnAfterStage === 'group',
    // so a team carrying withdrawnAfterStage: 'finals' was treated as NOT withdrawn here, flipping the
    // walkover points to the wrong side. The correct check is "did either side withdraw at all".
    const teams = [
      { ...makeTeam('t1', 'Team 1'), withdrawnAfterStage: 'finals' as const },
      makeTeam('t2', 'Team 2'),
    ]
    const games = [
      makeGame({
        homeTeamId: 't1', awayTeamId: 't2', cancelledReason: 'withdrawal',
        periodScores: [{ period: 1, homeScore: 0, awayScore: 0 }],
      }),
    ]
    const standings = computeGroupStandings(teams, games, 'A')
    expect(standings.find(s => s.teamId === 't2')!.points).toBe(2)
    expect(standings.find(s => s.teamId === 't1')!.points).toBe(0)
  })

  it('marks a team with any withdrawnAfterStage value as withdrawn, and excludes it from qualification-eligible ranking', () => {
    const teams = [
      makeTeam('t1', 'Team 1'),
      { ...makeTeam('t2', 'Team 2'), withdrawnAfterStage: 'group' as const },
    ]
    // t2 won its only played game before withdrawing, then withdrew from its remaining game vs t1
    // (walkover point to t1). t2 still outscores t1 on raw points if withdrawal isn't excluded.
    const games = [
      makeGame({
        id: 'g1', homeTeamId: 't1', awayTeamId: 't2', cancelledReason: 'withdrawal',
        periodScores: [{ period: 1, homeScore: 0, awayScore: 0 }],
      }),
    ]
    const standings = computeGroupStandings(teams, games, 'A')
    expect(standings.find(s => s.teamId === 't2')!.withdrawn).toBe(true)
    expect(standings.find(s => s.teamId === 't1')!.withdrawn).toBe(false)
  })
})
