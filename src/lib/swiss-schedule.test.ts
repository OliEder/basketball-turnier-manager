import { describe, it, expect } from 'vitest'
import { generateSwissSchedule } from './swiss-schedule'
import type { GameSettings } from '@/types'

const gameSettings: GameSettings = {
  periodsCount: 4,
  periodDurationMin: 5,
  breakBetweenPeriodsMin: 1,
  halfTimeBreakMin: 5,
  bufferBetweenGamesMin: 5,
  breakBetweenRoundsMin: 15,
  awardCeremonyMin: 15,
}

describe('generateSwissSchedule', () => {
  it('round 1 games have real team IDs', () => {
    const result = generateSwissSchedule({
      teamIds: ['t1', 't2', 't3', 't4'],
      swissRounds: 3,
      fields: 2,
      gameSettings,
      blackoutPeriods: [],
      firstGameStart: '09:30',
      availabilityEnd: '19:30',
      startGameNumber: 1,
    })
    const round1Games = result.games.filter(g => g.round === 1)
    expect(round1Games).toHaveLength(2)
    for (const g of round1Games) {
      expect(g.homeTeamId).not.toBeNull()
      expect(g.awayTeamId).not.toBeNull()
      expect(g.stage).toBe('swiss')
    }
  })
})

describe('generateSwissSchedule future rounds', () => {
  it('creates placeholder games for round 2+ with fixed time slots but no team IDs', () => {
    const result = generateSwissSchedule({
      teamIds: ['t1', 't2', 't3', 't4'],
      swissRounds: 3,
      fields: 2,
      gameSettings,
      blackoutPeriods: [],
      firstGameStart: '09:30',
      availabilityEnd: '19:30',
      startGameNumber: 1,
    })
    const round2Games = result.games.filter(g => g.round === 2)
    expect(round2Games).toHaveLength(2)
    for (const g of round2Games) {
      expect(g.homeTeamId).toBeNull()
      expect(g.awayTeamId).toBeNull()
      expect(g.homeLabel).toBe(`Runde 2 – Spiel ${round2Games.indexOf(g) + 1}`)
      expect(g.awayLabel).toBe(g.homeLabel)
    }
  })

  it('generates the correct total number of rounds', () => {
    const result = generateSwissSchedule({
      teamIds: ['t1', 't2', 't3', 't4'],
      swissRounds: 3,
      fields: 2,
      gameSettings,
      blackoutPeriods: [],
      firstGameStart: '09:30',
      availabilityEnd: '19:30',
      startGameNumber: 1,
    })
    const rounds = new Set(result.games.map(g => g.round))
    expect(rounds).toEqual(new Set([1, 2, 3]))
  })

  it('all fields are used in parallel per round, overflow games run sequentially', () => {
    // 5 teams, 1 bye -> 2 games per round; only 1 field -> games run sequentially within the round
    const result = generateSwissSchedule({
      teamIds: ['t1', 't2', 't3', 't4', 't5'],
      swissRounds: 1,
      fields: 1,
      gameSettings,
      blackoutPeriods: [],
      firstGameStart: '09:30',
      availabilityEnd: '19:30',
      startGameNumber: 1,
    })
    const round1Games = result.games.filter(g => g.round === 1 && g.field > 0)
    expect(round1Games).toHaveLength(2)
    const sorted = [...round1Games].sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))
    expect(sorted[1].scheduledStart >= sorted[0].scheduledEnd).toBe(true)
  })

  it('applies breakBetweenRoundsMin before the next round starts', () => {
    const result = generateSwissSchedule({
      teamIds: ['t1', 't2', 't3', 't4'],
      swissRounds: 2,
      fields: 2,
      gameSettings,
      blackoutPeriods: [],
      firstGameStart: '09:30',
      availabilityEnd: '19:30',
      startGameNumber: 1,
    })
    const round1End = Math.max(...result.games.filter(g => g.round === 1).map(g => {
      const [h, m] = g.scheduledEnd.split(':').map(Number)
      return h * 60 + m
    }))
    const round2Start = Math.min(...result.games.filter(g => g.round === 2).map(g => {
      const [h, m] = g.scheduledStart.split(':').map(Number)
      return h * 60 + m
    }))
    // bufferBetweenGamesMin (5) + breakBetweenRoundsMin (15) = 20
    expect(round2Start - round1End).toBe(20)
  })

  it('odd team count produces a bye entry with no field/time slot for every round', () => {
    const result = generateSwissSchedule({
      teamIds: ['t1', 't2', 't3'],
      swissRounds: 2,
      fields: 2,
      gameSettings,
      blackoutPeriods: [],
      firstGameStart: '09:30',
      availabilityEnd: '19:30',
      startGameNumber: 1,
    })
    const byes = result.games.filter(g => g.field === 0)
    expect(byes).toHaveLength(2) // one per round
  })

  it('throws when the schedule does not fit the available venue time', () => {
    expect(() =>
      generateSwissSchedule({
        teamIds: ['t1', 't2', 't3', 't4'],
        swissRounds: 20,
        fields: 1,
        gameSettings,
        blackoutPeriods: [],
        firstGameStart: '09:30',
        availabilityEnd: '10:00',
        startGameNumber: 1,
      })
    ).toThrow('Zeitplan passt nicht in die verfügbare Hallenzeit')
  })
})
