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

describe('generateSchedule with round-robin+finals mode', () => {
  it('appends semifinal and final games after the group stage', () => {
    const config: TournamentConfig = {
      ...baseConfig,
      mode: 'round-robin+finals',
      finalsBracketSize: 4,
    }
    const schedule = generateSchedule(config)
    // 6 group games + 2 semis + 1 final = 9
    expect(schedule.games).toHaveLength(9)
    const stages = schedule.games.map(g => g.stage)
    expect(stages.filter(s => s === 'group')).toHaveLength(6)
    expect(stages.filter(s => s === 'semifinal')).toHaveLength(2)
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
