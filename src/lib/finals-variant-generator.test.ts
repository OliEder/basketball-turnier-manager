import { describe, it, expect } from 'vitest'
import { computeGroupPhaseBuchholz, buildPlacementCohorts } from './finals-variant-generator'
import { computeGroupStandings } from './group-standings'
import type { Game, Team } from '@/types'
import type { GroupStanding } from './group-standings'

const makeGame = (overrides: Partial<Game>): Game => ({
  id: 'g', homeTeamId: null, awayTeamId: null, stage: 'group', field: 1,
  scheduledStart: '09:00', scheduledEnd: '09:30', round: 1, gameNumber: 1,
  periodScores: [], groupId: 'A',
  ...overrides,
})

const makeTeam = (id: string, groupId: string): Team => ({
  id, name: id, logoUrl: '', color: '#000000', contact: '', players: [], groupId,
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

describe('buildPlacementCohorts', () => {
  const makeStandingsFixture = () => {
    const teams = [
      makeTeam('a1', 'A'), makeTeam('a2', 'A'),
      makeTeam('b1', 'B'), makeTeam('b2', 'B'),
    ]
    const games = [
      makeGame({ id: 'gA', groupId: 'A', homeTeamId: 'a1', awayTeamId: 'a2', periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }] }),
      makeGame({ id: 'gB', groupId: 'B', homeTeamId: 'b1', awayTeamId: 'b2', periodScores: [{ period: 1, homeScore: 15, awayScore: 12 }] }),
    ]
    return { teams, games }
  }

  it('groups teams by group-phase rank across all groups: cohort 1 = every group winner, cohort 2 = every runner-up', () => {
    const { teams, games } = makeStandingsFixture()
    const groupIds = ['A', 'B']
    const standingsByGroup = new Map(groupIds.map(g => [g, computeGroupStandings(teams, games, g)]))
    const cohorts = buildPlacementCohorts(standingsByGroup)
    expect(cohorts).toHaveLength(2)
    expect(cohorts[0]).toEqual({ rankTier: 1, placementFrom: 1, teamIds: ['a1', 'b1'] })
    expect(cohorts[1]).toEqual({ rankTier: 2, placementFrom: 5, teamIds: ['a2', 'b2'] })
  })

  it('caps the number of rank tiers at the smallest group size', () => {
    const teams = [
      makeTeam('a1', 'A'), makeTeam('a2', 'A'), makeTeam('a3', 'A'),
      makeTeam('b1', 'B'), makeTeam('b2', 'B'),
    ]
    const games = [
      makeGame({ id: 'g1', groupId: 'A', homeTeamId: 'a1', awayTeamId: 'a2', periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }] }),
      makeGame({ id: 'g2', groupId: 'A', homeTeamId: 'a2', awayTeamId: 'a3', periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }] }),
      makeGame({ id: 'g3', groupId: 'B', homeTeamId: 'b1', awayTeamId: 'b2', periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }] }),
    ]
    const standingsByGroup = new Map([
      ['A', computeGroupStandings(teams, games, 'A')],
      ['B', computeGroupStandings(teams, games, 'B')],
    ])
    const cohorts = buildPlacementCohorts(standingsByGroup)
    // group B only has 2 teams, so only 2 rank tiers are formed even though group A has 3 ranks;
    // group A's 3rd-place team (a3) is excluded from any cohort.
    expect(cohorts).toHaveLength(2)
    expect(cohorts.every(c => !c.teamIds.includes('a3'))).toBe(true)
  })
})
