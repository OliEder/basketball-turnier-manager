import { describe, it, expect } from 'vitest'
import { generatePlayoffGames } from './playoff-generator'
import type { GameSettings } from '@/types'

const gameSettings: GameSettings = {
  periodsCount: 4,
  periodDurationMin: 5,
  breakBetweenPeriodsMin: 1,
  halfTimeBreakMin: 5,
  bufferBetweenGamesMin: 5,
  breakBeforeFinalsMin: 15,
  awardCeremonyMin: 15,
}

describe('generatePlayoffGames', () => {
  it('throws when there are fewer teams than the bracket size', () => {
    expect(() =>
      generatePlayoffGames({
        finalsBracketSize: 4,
        fields: 2,
        gameSettings,
        blackoutPeriods: [],
        availabilityEnd: '19:30',
        fieldNextFree: ['11:00', '11:00'],
        teamCount: 3,
        startGameNumber: 7,
      })
    ).toThrow('Mindestens 4 Teams für Halbfinale benötigt')
  })

  it('bracket size 2 generates only a final with group-placement labels', () => {
    const games = generatePlayoffGames({
      finalsBracketSize: 2,
      fields: 2,
      gameSettings,
      blackoutPeriods: [],
      availabilityEnd: '19:30',
      fieldNextFree: ['11:00', '10:45'],
      teamCount: 2,
      startGameNumber: 2,
    })
    expect(games).toHaveLength(1)
    const [final] = games
    expect(final.stage).toBe('final')
    expect(final.homeTeamId).toBeNull()
    expect(final.awayTeamId).toBeNull()
    expect(final.homeLabel).toBe('1. der Vorrunde')
    expect(final.awayLabel).toBe('2. der Vorrunde')
    expect(final.field).toBe(1)
    expect(final.gameNumber).toBe(2)
    // starts breakBeforeFinalsMin (15) after the later field clock (11:00)
    expect(final.scheduledStart).toBe('11:15')
  })
})
