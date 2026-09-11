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
