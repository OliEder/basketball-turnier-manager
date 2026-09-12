import { describe, it, expect } from 'vitest'
import { generateRoundRobinPairs, generateSchedule, generateRoundRobinRounds } from './schedule-generator'
import { timeToMinutes } from './game-duration'
import type { TournamentConfig, Team } from '@/types'

const makeTeam = (id: string, name: string): Team => ({
  id, name, logoUrl: '', color: '#000', contact: '', players: [],
})

const baseConfig: TournamentConfig = {
  id: 'tournament-1',
  name: 'Test Cup',
  mode: 'round-robin',
  fields: 2,
  gameSettings: {
    periodsCount: 4,
    periodDurationMin: 5,
    breakBetweenPeriodsMin: 1,
    halfTimeBreakMin: 5,
    bufferBetweenGamesMin: 5,
    breakBetweenRoundsMin: 15,
    awardCeremonyMin: 15,
  },
  venue: {
    name: 'Testhalle',
    availabilityWindows: [{ start: '09:00', end: '20:00' }],
    blackoutPeriods: [],
    setupBufferMin: 30,
    teardownBufferMin: 30,
  },
  teams: [
    makeTeam('t1', 'Team A'),
    makeTeam('t2', 'Team B'),
    makeTeam('t3', 'Team C'),
    makeTeam('t4', 'Team D'),
  ],
}

describe('generateRoundRobinPairs', () => {
  it('generates correct number of pairs for 4 teams', () => {
    const pairs = generateRoundRobinPairs(['t1', 't2', 't3', 't4'])
    // 4 teams: 4×3/2 = 6 games
    expect(pairs).toHaveLength(6)
  })

  it('each pair plays exactly once', () => {
    const pairs = generateRoundRobinPairs(['t1', 't2', 't3', 't4'])
    const seen = new Set<string>()
    for (const [a, b] of pairs) {
      const key = [a, b].sort().join('|')
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })
})

describe('generateSchedule', () => {
  it('returns a schedule with 6 games for 4 teams', () => {
    const schedule = generateSchedule(baseConfig)
    expect(schedule.games).toHaveLength(6)
  })

  it('no game starts before venue opens (after setup buffer)', () => {
    const schedule = generateSchedule(baseConfig)
    // venue opens at 09:00, setup buffer = 30min → first game at 09:30
    expect(schedule.games[0].scheduledStart).toBe('09:30')
  })

  it('no game overlaps a blackout period', () => {
    const config: TournamentConfig = {
      ...baseConfig,
      venue: {
        ...baseConfig.venue,
        blackoutPeriods: [{ start: '12:00', end: '14:00', reason: 'Mittagshitze' }],
      },
    }
    const schedule = generateSchedule(config)
    for (const game of schedule.games) {
      const startMins = parseInt(game.scheduledStart.replace(':', ''))
      const endMins = parseInt(game.scheduledEnd.replace(':', ''))
      const blackoutStart = 1200
      const blackoutEnd = 1400
      const overlaps = startMins < blackoutEnd && endMins > blackoutStart
      expect(overlaps).toBe(false)
    }
  })

  it('games on same field do not overlap', () => {
    const schedule = generateSchedule(baseConfig)
    const byField = new Map<number, typeof schedule.games>()
    for (const game of schedule.games) {
      if (!byField.has(game.field)) byField.set(game.field, [])
      byField.get(game.field)!.push(game)
    }
    for (const [, games] of byField) {
      const sorted = [...games].sort((a, b) =>
        a.scheduledStart.localeCompare(b.scheduledStart)
      )
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].scheduledStart >= sorted[i - 1].scheduledEnd).toBe(true)
      }
    }
  })

  it('no team plays two games at the same time on different fields', () => {
    const schedule = generateSchedule(baseConfig)
    const byTeam = new Map<string, typeof schedule.games>()
    for (const game of schedule.games) {
      for (const teamId of [game.homeTeamId, game.awayTeamId]) {
        if (!teamId) continue
        if (!byTeam.has(teamId)) byTeam.set(teamId, [])
        byTeam.get(teamId)!.push(game)
      }
    }
    for (const [, games] of byTeam) {
      const sorted = [...games].sort((a, b) =>
        a.scheduledStart.localeCompare(b.scheduledStart)
      )
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].scheduledStart >= sorted[i - 1].scheduledEnd).toBe(true)
      }
    }
  })

  it('utilizes all available fields simultaneously when enough teams exist', () => {
    const config: TournamentConfig = {
      ...baseConfig,
      fields: 3,
      teams: [
        makeTeam('t1', 'Team 1'), makeTeam('t2', 'Team 2'),
        makeTeam('t3', 'Team 3'), makeTeam('t4', 'Team 4'),
        makeTeam('t5', 'Team 5'), makeTeam('t6', 'Team 6'),
        makeTeam('t7', 'Team 7'), makeTeam('t8', 'Team 8'),
      ],
    }
    const schedule = generateSchedule(config)
    const byStart = new Map<string, number>()
    for (const game of schedule.games) {
      byStart.set(game.scheduledStart, (byStart.get(game.scheduledStart) ?? 0) + 1)
    }
    // With 8 teams and 3 fields, the very first wave of games must use all 3 fields at once —
    // this is exactly the bug that was reported and reproduced (only 1 field used at the start).
    const firstStart = schedule.games[0].scheduledStart
    expect(byStart.get(firstStart)).toBe(3)
  })

  it('assigns increasing round numbers to round-robin games matching the circle-method structure', () => {
    const schedule = generateSchedule(baseConfig)
    // 4 teams -> 3 rounds, 2 games per round
    const rounds = new Set(schedule.games.map(g => g.round))
    expect(rounds).toEqual(new Set([1, 2, 3]))
    for (const round of rounds) {
      expect(schedule.games.filter(g => g.round === round)).toHaveLength(2)
    }
  })
})

describe('generateSchedule with doubleRoundRobin', () => {
  it('doubles the number of group-stage games with reversed home/away in the return leg', () => {
    const config: TournamentConfig = {
      ...baseConfig,
      doubleRoundRobin: true,
    }
    const schedule = generateSchedule(config)
    // 4 teams, single leg = 6 games; double leg = 12
    expect(schedule.games).toHaveLength(12)
  })

  it('return-leg games have home/away swapped compared to the first leg', () => {
    const config: TournamentConfig = {
      ...baseConfig,
      doubleRoundRobin: true,
    }
    const schedule = generateSchedule(config)
    const firstLegPairs = new Map(
      schedule.games.filter(g => g.round <= 3).map(g => [
        [g.homeTeamId, g.awayTeamId].sort().join('|'),
        [g.homeTeamId, g.awayTeamId],
      ]),
    )
    const returnLegGames = schedule.games.filter(g => g.round > 3)
    expect(returnLegGames).toHaveLength(6)
    for (const game of returnLegGames) {
      const key = [game.homeTeamId, game.awayTeamId].sort().join('|')
      const [firstHome] = firstLegPairs.get(key)!
      // In the return leg, whoever was away in the first leg is now home.
      expect(game.homeTeamId).not.toBe(firstHome)
    }
  })

  it('assigns continuing round numbers to the return leg (not restarting at 1)', () => {
    const config: TournamentConfig = {
      ...baseConfig,
      doubleRoundRobin: true,
    }
    const schedule = generateSchedule(config)
    const rounds = new Set(schedule.games.map(g => g.round))
    // 4 teams: 3 rounds per leg, 2 legs = rounds 1-6
    expect(rounds).toEqual(new Set([1, 2, 3, 4, 5, 6]))
  })
})

describe('generateSchedule with round-robin+finals mode', () => {
  it('appends semifinal and final games after the group stage', () => {
    const config: TournamentConfig = {
      ...baseConfig,
      mode: 'round-robin+finals',
      finalsBracketSize: 4,
    }
    const schedule = generateSchedule(config)
    // 6 group games + 2 semis + 1 third-place + 1 final = 10
    expect(schedule.games).toHaveLength(10)
    const stages = schedule.games.map(g => g.stage)
    expect(stages.filter(s => s === 'group')).toHaveLength(6)
    expect(stages.filter(s => s === 'semifinal')).toHaveLength(2)
    expect(stages.filter(s => s === 'third-place')).toHaveLength(1)
    expect(stages.filter(s => s === 'final')).toHaveLength(1)
  })

  it('sets awardCeremonyEstimate after the final ends', () => {
    const config: TournamentConfig = {
      ...baseConfig,
      mode: 'round-robin+finals',
      finalsBracketSize: 4,
    }
    const schedule = generateSchedule(config)
    const final = schedule.games.find(g => g.stage === 'final')!
    expect(schedule.awardCeremonyEstimate).toBeDefined()
    expect(timeToMinutes(schedule.awardCeremonyEstimate!)).toBe(
      timeToMinutes(final.scheduledEnd) + 15,
    )
  })

  it('generates placement-cohort games instead of a KO bracket when finalsVariant is endrunde-4', () => {
    const config: TournamentConfig = {
      ...baseConfig,
      mode: 'round-robin+finals',
      groupCount: 2,
      finalsVariant: 'endrunde-4',
      teams: [
        { ...makeTeam('t1', 'T1'), groupId: 'A' },
        { ...makeTeam('t2', 'T2'), groupId: 'A' },
        { ...makeTeam('t3', 'T3'), groupId: 'B' },
        { ...makeTeam('t4', 'T4'), groupId: 'B' },
      ],
    }
    const schedule = generateSchedule(config)
    const placementGames = schedule.games.filter(g => g.stage === 'placement')
    // 2 groups of 2 teams each -> smallest group size is 2 -> 2 rank tiers (group winners' cohort
    // playing for places 1-2, runners-up cohort playing for places 3-4), each cohort has 2 teams
    // (one per group) -> 1 round-robin game per cohort -> 2 placement games total.
    expect(placementGames).toHaveLength(2)
    expect(placementGames.map(g => g.rankTier).sort()).toEqual([1, 2])
    expect(schedule.games.some(g => g.stage === 'semifinal' || g.stage === 'final')).toBe(false)
  })

  it('generates a semifinal+final+third-place bracket seeded by group winners when finalsVariant is endrunde-3', () => {
    const config: TournamentConfig = {
      ...baseConfig,
      mode: 'round-robin+finals',
      groupCount: 4,
      finalsVariant: 'endrunde-3',
      teams: [
        { ...makeTeam('t1', 'T1'), groupId: 'A' },
        { ...makeTeam('t2', 'T2'), groupId: 'A' },
        { ...makeTeam('t3', 'T3'), groupId: 'A' },
        { ...makeTeam('t4', 'T4'), groupId: 'B' },
        { ...makeTeam('t5', 'T5'), groupId: 'B' },
        { ...makeTeam('t6', 'T6'), groupId: 'B' },
        { ...makeTeam('t7', 'T7'), groupId: 'C' },
        { ...makeTeam('t8', 'T8'), groupId: 'C' },
        { ...makeTeam('t9', 'T9'), groupId: 'C' },
        { ...makeTeam('t10', 'T10'), groupId: 'D' },
        { ...makeTeam('t11', 'T11'), groupId: 'D' },
        { ...makeTeam('t12', 'T12'), groupId: 'D' },
      ],
    }
    const schedule = generateSchedule(config)
    const semifinals = schedule.games.filter(g => g.stage === 'semifinal')
    const thirdPlace = schedule.games.filter(g => g.stage === 'third-place')
    const finals = schedule.games.filter(g => g.stage === 'final')
    expect(semifinals).toHaveLength(2)
    expect(thirdPlace).toHaveLength(1)
    expect(finals).toHaveLength(1)
    expect(schedule.games.some(g => g.stage === 'placement')).toBe(false)

    // Group winners seeded alphabetically: A vs D, B vs C (per buildQualifierSeeds).
    expect(semifinals[0].homeSourceRank).toEqual({ groupId: 'A', rank: 1 })
    expect(semifinals[0].awaySourceRank).toEqual({ groupId: 'D', rank: 1 })
    expect(semifinals[1].homeSourceRank).toEqual({ groupId: 'B', rank: 1 })
    expect(semifinals[1].awaySourceRank).toEqual({ groupId: 'C', rank: 1 })
  })

  it('generates one KO bracket per rank tier when finalsVariant is endrunde-1, capped by the smallest group size', () => {
    const config: TournamentConfig = {
      ...baseConfig,
      mode: 'round-robin+finals',
      groupCount: 4,
      finalsVariant: 'endrunde-1',
      teams: [
        { ...makeTeam('t1', 'T1'), groupId: 'A' },
        { ...makeTeam('t2', 'T2'), groupId: 'A' },
        { ...makeTeam('t3', 'T3'), groupId: 'B' },
        { ...makeTeam('t4', 'T4'), groupId: 'B' },
        { ...makeTeam('t5', 'T5'), groupId: 'C' },
        { ...makeTeam('t6', 'T6'), groupId: 'C' },
        { ...makeTeam('t7', 'T7'), groupId: 'D' },
        { ...makeTeam('t8', 'T8'), groupId: 'D' },
      ],
    }
    const schedule = generateSchedule(config)
    // 4 groups of 2 -> smallest group size 2 -> 2 rank tiers, each a 4-team bracket
    // (semifinal x2 + third-place + final = 4 games per tier -> 8 KO games total).
    const koGames = schedule.games.filter(g =>
      g.stage === 'semifinal' || g.stage === 'final' || g.stage === 'third-place')
    expect(koGames).toHaveLength(8)
    expect(koGames.filter(g => g.rankTier === 1)).toHaveLength(4)
    expect(koGames.filter(g => g.rankTier === 2)).toHaveLength(4)
    expect(schedule.games.some(g => g.stage === 'placement')).toBe(false)

    const rankTier1Semifinals = koGames.filter(g => g.rankTier === 1 && g.stage === 'semifinal')
    expect(rankTier1Semifinals[0].homeSourceRank).toEqual({ groupId: 'A', rank: 1 })
    expect(rankTier1Semifinals[0].awaySourceRank).toEqual({ groupId: 'D', rank: 1 })
    const rankTier2Semifinals = koGames.filter(g => g.rankTier === 2 && g.stage === 'semifinal')
    expect(rankTier2Semifinals[0].homeSourceRank).toEqual({ groupId: 'A', rank: 2 })
    expect(rankTier2Semifinals[0].awaySourceRank).toEqual({ groupId: 'D', rank: 2 })

    // Regression guard for field-clock threading between successive buildBracket calls: baseConfig
    // only has 2 fields, so rank tier 1's bracket alone occupies both fields across 2 rounds
    // (semifinals, then final+third-place). If generateSchedule failed to carry each field's
    // actual next-free time forward into rank tier 2's buildBracket call, tier 2's games would be
    // scheduled as if the fields were still free from the very start of the tournament, causing an
    // impossible time overlap with tier 1's games on the same field. No game on field 1 (or field
    // 2) may start before every EARLIER-starting game already scheduled on that same field has
    // ended.
    for (const field of [1, 2]) {
      const gamesOnField = schedule.games.filter(g => g.field === field).sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))
      for (let i = 1; i < gamesOnField.length; i++) {
        expect(gamesOnField[i].scheduledStart >= gamesOnField[i - 1].scheduledEnd).toBe(true)
      }
    }
  })
})

describe('generateSchedule with swiss mode', () => {
  it('generates a swiss schedule when mode is swiss', () => {
    const config: TournamentConfig = {
      ...baseConfig,
      mode: 'swiss',
      swissRounds: 2,
    }
    const schedule = generateSchedule(config)
    const rounds = new Set(schedule.games.map(g => g.round))
    expect(rounds).toEqual(new Set([1, 2]))
    expect(schedule.games.every(g => g.stage === 'swiss')).toBe(true)
  })

  it('does not set awardCeremonyEstimate for swiss mode', () => {
    const config: TournamentConfig = {
      ...baseConfig,
      mode: 'swiss',
      swissRounds: 2,
    }
    const schedule = generateSchedule(config)
    expect(schedule.awardCeremonyEstimate).toBeUndefined()
  })
})

describe('generateSchedule with multiple groups', () => {
  const multiGroupConfig: TournamentConfig = {
    ...baseConfig,
    mode: 'round-robin+finals',
    finalsBracketSize: 4,
    fields: 4,
    groupCount: 2,
    teams: [
      { ...makeTeam('t1', 'Team 1'), groupId: 'A' },
      { ...makeTeam('t2', 'Team 2'), groupId: 'A' },
      { ...makeTeam('t3', 'Team 3'), groupId: 'A' },
      { ...makeTeam('t4', 'Team 4'), groupId: 'A' },
      { ...makeTeam('t5', 'Team 5'), groupId: 'B' },
      { ...makeTeam('t6', 'Team 6'), groupId: 'B' },
      { ...makeTeam('t7', 'Team 7'), groupId: 'B' },
      { ...makeTeam('t8', 'Team 8'), groupId: 'B' },
    ],
  }

  it('generates group-stage games tagged with their groupId', () => {
    const schedule = generateSchedule(multiGroupConfig)
    const groupGames = schedule.games.filter(g => g.stage === 'group')
    // 2 groups of 4 teams each: 6 games per group = 12 total
    expect(groupGames).toHaveLength(12)
    expect(groupGames.filter(g => g.groupId === 'A')).toHaveLength(6)
    expect(groupGames.filter(g => g.groupId === 'B')).toHaveLength(6)
  })

  it('never pairs teams from different groups against each other', () => {
    const schedule = generateSchedule(multiGroupConfig)
    const teamGroup = new Map(multiGroupConfig.teams.map(t => [t.id, t.groupId]))
    for (const game of schedule.games.filter(g => g.stage === 'group')) {
      expect(teamGroup.get(game.homeTeamId!)).toBe(teamGroup.get(game.awayTeamId!))
    }
  })

  it('interleaves round 1 of both groups so multiple fields are used simultaneously', () => {
    const schedule = generateSchedule(multiGroupConfig)
    const round1Games = schedule.games.filter(g => g.stage === 'group' && g.round === 1)
    // Round 1 of each 4-team group has 2 games; both groups' round 1 together = 4 games,
    // and with 4 fields available they should all start at the same time.
    expect(round1Games).toHaveLength(4)
    const startTimes = new Set(round1Games.map(g => g.scheduledStart))
    expect(startTimes.size).toBe(1)
  })

  it('falls back to a single group "A" when groupCount is not set', () => {
    const singleGroupConfig: TournamentConfig = {
      ...baseConfig,
      mode: 'round-robin+finals',
      finalsBracketSize: 4,
    }
    const schedule = generateSchedule(singleGroupConfig)
    const groupGames = schedule.games.filter(g => g.stage === 'group')
    expect(groupGames.every(g => g.groupId === 'A')).toBe(true)
  })

  it('handles uneven group sizes without dropping or duplicating games', () => {
    const unevenConfig: TournamentConfig = {
      ...baseConfig,
      mode: 'round-robin+finals',
      finalsBracketSize: 4,
      fields: 4,
      groupCount: 3,
      teams: [
        { ...makeTeam('t1', 'Team 1'), groupId: 'A' },
        { ...makeTeam('t2', 'Team 2'), groupId: 'A' },
        { ...makeTeam('t3', 'Team 3'), groupId: 'A' },
        { ...makeTeam('t4', 'Team 4'), groupId: 'A' },
        { ...makeTeam('t5', 'Team 5'), groupId: 'B' },
        { ...makeTeam('t6', 'Team 6'), groupId: 'B' },
        { ...makeTeam('t7', 'Team 7'), groupId: 'B' },
        { ...makeTeam('t8', 'Team 8'), groupId: 'C' },
        { ...makeTeam('t9', 'Team 9'), groupId: 'C' },
        { ...makeTeam('t10', 'Team 10'), groupId: 'C' },
        { ...makeTeam('t11', 'Team 11'), groupId: 'C' },
        { ...makeTeam('t12', 'Team 12'), groupId: 'C' },
        { ...makeTeam('t13', 'Team 13'), groupId: 'C' },
      ],
    }
    const schedule = generateSchedule(unevenConfig)
    const groupGames = schedule.games.filter(g => g.stage === 'group')
    // Group A: 4 teams -> C(4,2) = 6 games. Group B: 3 teams -> C(3,2) = 3 games.
    // Group C: 6 teams -> C(6,2) = 15 games. Total = 24.
    expect(groupGames).toHaveLength(24)
    expect(groupGames.filter(g => g.groupId === 'A')).toHaveLength(6)
    expect(groupGames.filter(g => g.groupId === 'B')).toHaveLength(3)
    expect(groupGames.filter(g => g.groupId === 'C')).toHaveLength(15)
  })

  it('gives a single-team group zero group-stage games without crashing', () => {
    const soloGroupConfig: TournamentConfig = {
      ...baseConfig,
      mode: 'round-robin+finals',
      finalsBracketSize: 4,
      fields: 4,
      groupCount: 2,
      teams: [
        { ...makeTeam('t1', 'Team 1'), groupId: 'A' },
        { ...makeTeam('t2', 'Team 2'), groupId: 'A' },
        { ...makeTeam('t3', 'Team 3'), groupId: 'A' },
        { ...makeTeam('t4', 'Team 4'), groupId: 'B' },
      ],
    }
    expect(() => generateSchedule(soloGroupConfig)).not.toThrow()
    const schedule = generateSchedule(soloGroupConfig)
    const groupGames = schedule.games.filter(g => g.stage === 'group')
    expect(groupGames.filter(g => g.groupId === 'B')).toHaveLength(0)
    expect(groupGames.filter(g => g.groupId === 'A')).toHaveLength(3)
  })
})

describe('generateRoundRobinRounds', () => {
  it('generates N-1 rounds with N/2 pairs each for even team counts', () => {
    const rounds = generateRoundRobinRounds(['t1', 't2', 't3', 't4'])
    expect(rounds).toHaveLength(3)
    for (const round of rounds) {
      expect(round).toHaveLength(2)
    }
  })

  it('generates N rounds with (N-1)/2 pairs each for odd team counts (one team sits out per round)', () => {
    const rounds = generateRoundRobinRounds(['t1', 't2', 't3'])
    expect(rounds).toHaveLength(3)
    for (const round of rounds) {
      expect(round).toHaveLength(1)
    }
  })

  it('every team appears at most once per round', () => {
    const rounds = generateRoundRobinRounds(['t1', 't2', 't3', 't4', 't5', 't6'])
    for (const round of rounds) {
      const teamsInRound = round.flatMap(([home, away]) => [home, away])
      const uniqueTeams = new Set(teamsInRound)
      expect(uniqueTeams.size).toBe(teamsInRound.length)
    }
  })

  it('each unique pair plays exactly once across all rounds', () => {
    const rounds = generateRoundRobinRounds(['t1', 't2', 't3', 't4', 't5'])
    const seen = new Set<string>()
    let totalPairs = 0
    for (const round of rounds) {
      for (const [home, away] of round) {
        const key = [home, away].sort().join('|')
        expect(seen.has(key)).toBe(false)
        seen.add(key)
        totalPairs++
      }
    }
    // 5 teams: 5×4/2 = 10 unique pairs
    expect(totalPairs).toBe(10)
  })

  it('returns an empty array for a single team', () => {
    expect(generateRoundRobinRounds(['t1'])).toEqual([])
  })

  it('returns one round with one pair for two teams', () => {
    const rounds = generateRoundRobinRounds(['t1', 't2'])
    expect(rounds).toEqual([[['t1', 't2']]])
  })
})
