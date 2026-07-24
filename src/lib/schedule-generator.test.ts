import { describe, it, expect } from 'vitest'
import { generateRoundRobinPairs, generateSchedule } from './schedule-generator'
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
    breakBeforeFinalsMin: 15,
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
