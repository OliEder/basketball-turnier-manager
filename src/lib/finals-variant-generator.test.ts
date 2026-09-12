import { describe, it, expect } from 'vitest'
import { computeGroupPhaseBuchholz, buildPlacementCohorts, buildPlacementGames, buildQualifierSeeds } from './finals-variant-generator'
import { computeGroupStandings } from './group-standings'
import type { Game, GameSettings, Team } from '@/types'
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
  withdrawn: false,
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

  it('also counts games where the queried team played as the away side', () => {
    const games = [
      makeGame({ groupId: 'A', homeTeamId: 't2', awayTeamId: 't1', periodScores: [{ period: 1, homeScore: 10, awayScore: 20 }] }),
    ]
    const standingsByTeamId = new Map([
      ['t1', standing('t1', 2)],
      ['t2', standing('t2', 5)],
    ])
    // t1 played as away side against t2 (5 pts) -> buchholz = 5
    expect(computeGroupPhaseBuchholz('t1', games, standingsByTeamId)).toBe(5)
  })

  it('treats a missing opponent standing as 0 points, for both home and away sides', () => {
    const games = [
      makeGame({ id: 'g1', groupId: 'A', homeTeamId: 't1', awayTeamId: 'ghost1', periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }] }),
      makeGame({ id: 'g2', groupId: 'A', homeTeamId: 'ghost2', awayTeamId: 't1', periodScores: [{ period: 1, homeScore: 10, awayScore: 20 }] }),
    ]
    // Neither "ghost1" nor "ghost2" has a standings entry (e.g. withdrawn/filtered out elsewhere).
    const standingsByTeamId = new Map([['t1', standing('t1', 4)]])
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
    // 2 groups -> each cohort spans 2 places: cohort 1 = places 1-2, cohort 2 = places 3-4
    expect(cohorts[0]).toEqual({ rankTier: 1, placementFrom: 1, teamIds: ['a1', 'b1'] })
    expect(cohorts[1]).toEqual({ rankTier: 2, placementFrom: 3, teamIds: ['a2', 'b2'] })
  })

  it('spans placement ranges by the actual group count, not a fixed size (4 groups -> 1-4, 5-8, ...)', () => {
    const teams = [
      makeTeam('a1', 'A'), makeTeam('a2', 'A'),
      makeTeam('b1', 'B'), makeTeam('b2', 'B'),
      makeTeam('c1', 'C'), makeTeam('c2', 'C'),
      makeTeam('d1', 'D'), makeTeam('d2', 'D'),
    ]
    const games = [
      makeGame({ id: 'gA', groupId: 'A', homeTeamId: 'a1', awayTeamId: 'a2', periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }] }),
      makeGame({ id: 'gB', groupId: 'B', homeTeamId: 'b1', awayTeamId: 'b2', periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }] }),
      makeGame({ id: 'gC', groupId: 'C', homeTeamId: 'c1', awayTeamId: 'c2', periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }] }),
      makeGame({ id: 'gD', groupId: 'D', homeTeamId: 'd1', awayTeamId: 'd2', periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }] }),
    ]
    const groupIds = ['A', 'B', 'C', 'D']
    const standingsByGroup = new Map(groupIds.map(g => [g, computeGroupStandings(teams, games, g)]))
    const cohorts = buildPlacementCohorts(standingsByGroup)
    expect(cohorts).toHaveLength(2)
    expect(cohorts[0].placementFrom).toBe(1)
    expect(cohorts[1].placementFrom).toBe(5)
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

const gameSettings: GameSettings = {
  periodsCount: 4, periodDurationMin: 5, breakBetweenPeriodsMin: 1,
  halfTimeBreakMin: 5, bufferBetweenGamesMin: 5, breakBetweenRoundsMin: 15, awardCeremonyMin: 15,
}

describe('buildPlacementGames', () => {
  it('generates a full round-robin per cohort with placeholder source ranks, no real team IDs', () => {
    const cohorts = [
      { rankTier: 1, placementFrom: 1, sourceRanks: [{ groupId: 'A', rank: 1 }, { groupId: 'B', rank: 1 }, { groupId: 'C', rank: 1 }, { groupId: 'D', rank: 1 }] },
    ]
    const games = buildPlacementGames({
      cohorts,
      fields: 2,
      gameSettings,
      blackoutPeriods: [],
      availabilityEnd: '19:30',
      fieldNextFree: ['15:00', '15:00'],
      startGameNumber: 20,
    })
    // 4 teams round-robin = 6 games (3 rounds x 2 games/round)
    expect(games).toHaveLength(6)
    expect(games.every(g => g.stage === 'placement')).toBe(true)
    expect(games.every(g => g.rankTier === 1)).toBe(true)
    expect(games.every(g => g.placementFrom === 1)).toBe(true)
    expect(games.every(g => g.homeTeamId === null && g.awayTeamId === null)).toBe(true)
    expect(games.every(g => g.homeSourceRank && g.awaySourceRank)).toBe(true)
    expect(games[0].gameNumber).toBe(20)
  })

  it('assigns each cohort its own games and keeps gameNumber sequential across cohorts', () => {
    const cohorts = [
      { rankTier: 1, placementFrom: 1, sourceRanks: [{ groupId: 'A', rank: 1 }, { groupId: 'B', rank: 1 }, { groupId: 'C', rank: 1 }, { groupId: 'D', rank: 1 }] },
      { rankTier: 2, placementFrom: 5, sourceRanks: [{ groupId: 'A', rank: 2 }, { groupId: 'B', rank: 2 }, { groupId: 'C', rank: 2 }, { groupId: 'D', rank: 2 }] },
    ]
    const games = buildPlacementGames({
      cohorts,
      fields: 2,
      gameSettings,
      blackoutPeriods: [],
      availabilityEnd: '19:30',
      fieldNextFree: ['15:00', '15:00'],
      startGameNumber: 1,
    })
    expect(games).toHaveLength(12)
    const gameNumbers = games.map(g => g.gameNumber)
    expect(new Set(gameNumbers).size).toBe(12) // all unique
    expect(games.filter(g => g.rankTier === 2)).toHaveLength(6)
  })

  it('throws when the venue is too short to fit all placement games', () => {
    expect(() =>
      buildPlacementGames({
        cohorts: [{ rankTier: 1, placementFrom: 1, sourceRanks: [{ groupId: 'A', rank: 1 }, { groupId: 'B', rank: 1 }, { groupId: 'C', rank: 1 }, { groupId: 'D', rank: 1 }] }],
        fields: 1,
        gameSettings,
        blackoutPeriods: [],
        availabilityEnd: '15:10',
        fieldNextFree: ['15:00'],
        startGameNumber: 1,
      })
    ).toThrow('Kein Zeitfenster für die Endrunde verfügbar')
  })
})

describe('buildQualifierSeeds', () => {
  it('seeds exactly 4 groups into semifinal order: [0]v[3], [1]v[2] by alphabetical groupId', () => {
    const seeds = buildQualifierSeeds(['A', 'B', 'C', 'D'])
    // sf1.home, sf1.away, sf2.home, sf2.away
    expect(seeds).toEqual([
      { groupId: 'A', rank: 1 },
      { groupId: 'D', rank: 1 },
      { groupId: 'B', rank: 1 },
      { groupId: 'C', rank: 1 },
    ])
  })

  it('sorts group IDs alphabetically regardless of input order', () => {
    const seeds = buildQualifierSeeds(['D', 'A', 'C', 'B'])
    expect(seeds).toEqual([
      { groupId: 'A', rank: 1 },
      { groupId: 'D', rank: 1 },
      { groupId: 'B', rank: 1 },
      { groupId: 'C', rank: 1 },
    ])
  })

  it('throws when there are not exactly 4 groups', () => {
    expect(() => buildQualifierSeeds(['A', 'B', 'C'])).toThrow('Endrunde 3 benötigt genau 4 Gruppen')
    expect(() => buildQualifierSeeds(['A', 'B', 'C', 'D', 'E'])).toThrow('Endrunde 3 benötigt genau 4 Gruppen')
  })
})
