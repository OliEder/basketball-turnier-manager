import { describe, it, expect } from 'vitest'
import { generatePlayoffGames } from './playoff-generator'
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
    // starts breakBetweenRoundsMin (15) after the later field clock (11:00)
    expect(final.scheduledStart).toBe('11:15')
  })

  it('bracket size 4 with 2 fields runs semifinals in parallel on separate fields, plus a third-place game', () => {
    const games = generatePlayoffGames({
      finalsBracketSize: 4,
      fields: 2,
      gameSettings,
      blackoutPeriods: [],
      availabilityEnd: '19:30',
      fieldNextFree: ['11:00', '10:45'],
      teamCount: 4,
      startGameNumber: 7,
    })
    expect(games).toHaveLength(4)
    const [sf1, sf2, thirdPlace, final] = games
    expect(sf1.stage).toBe('semifinal')
    expect(sf2.stage).toBe('semifinal')
    expect(sf1.homeLabel).toBe('1. der Vorrunde')
    expect(sf1.awayLabel).toBe('4. der Vorrunde')
    expect(sf2.homeLabel).toBe('2. der Vorrunde')
    expect(sf2.awayLabel).toBe('3. der Vorrunde')
    // both start at the later of the two field clocks (11:00), on separate fields
    expect(sf1.scheduledStart).toBe('11:00')
    expect(sf2.scheduledStart).toBe('11:00')
    expect(sf1.field).toBe(1)
    expect(sf2.field).toBe(2)

    expect(thirdPlace.stage).toBe('third-place')
    expect(thirdPlace.homeLabel).toBe('Verlierer HF 1')
    expect(thirdPlace.awayLabel).toBe('Verlierer HF 2')
    expect(thirdPlace.homeSourceMatch).toEqual({ stage: 'semifinal', matchIndex: 0, outcome: 'loser' })
    expect(thirdPlace.awaySourceMatch).toEqual({ stage: 'semifinal', matchIndex: 1, outcome: 'loser' })

    expect(final.stage).toBe('final')
    expect(final.homeLabel).toBe('Sieger HF 1')
    expect(final.awayLabel).toBe('Sieger HF 2')
    expect(final.field).toBe(1)
    expect(final.gameNumber).toBe(10)
    expect(final.homeSourceMatch).toEqual({ stage: 'semifinal', matchIndex: 0, outcome: 'winner' })
    expect(final.awaySourceMatch).toEqual({ stage: 'semifinal', matchIndex: 1, outcome: 'winner' })
  })

  it('sets homeSourceRank/awaySourceRank on semifinal games when qualifierSourceRanks is provided (Endrunde 3)', () => {
    const games = generatePlayoffGames({
      finalsBracketSize: 4,
      fields: 2,
      gameSettings,
      blackoutPeriods: [],
      availabilityEnd: '19:30',
      fieldNextFree: ['11:00', '11:00'],
      teamCount: 4,
      startGameNumber: 1,
      qualifierSourceRanks: [
        { groupId: 'A', rank: 1 },
        { groupId: 'D', rank: 1 },
        { groupId: 'B', rank: 1 },
        { groupId: 'C', rank: 1 },
      ],
    })
    const [sf1, sf2] = games
    expect(sf1.homeSourceRank).toEqual({ groupId: 'A', rank: 1 })
    expect(sf1.awaySourceRank).toEqual({ groupId: 'D', rank: 1 })
    expect(sf2.homeSourceRank).toEqual({ groupId: 'B', rank: 1 })
    expect(sf2.awaySourceRank).toEqual({ groupId: 'C', rank: 1 })
  })

  it('bracket size 4 with 1 field runs semifinals, third-place game and final sequentially on field 1', () => {
    const games = generatePlayoffGames({
      finalsBracketSize: 4,
      fields: 1,
      gameSettings,
      blackoutPeriods: [],
      availabilityEnd: '19:30',
      fieldNextFree: ['11:00'],
      teamCount: 4,
      startGameNumber: 7,
    })
    const [sf1, sf2, thirdPlace, final] = games
    expect(sf1.field).toBe(1)
    expect(sf2.field).toBe(1)
    expect(sf2.scheduledStart >= sf1.scheduledEnd).toBe(true)
    expect(thirdPlace.field).toBe(1)
    expect(final.field).toBe(1)
    expect(thirdPlace.scheduledStart >= sf2.scheduledEnd).toBe(true)
    expect(final.scheduledStart >= thirdPlace.scheduledEnd).toBe(true)
  })

  it('final and third-place game respect breakBetweenRoundsMin after the later semifinal ends, running in parallel on separate fields', () => {
    const games = generatePlayoffGames({
      finalsBracketSize: 4,
      fields: 2,
      gameSettings,
      blackoutPeriods: [],
      availabilityEnd: '19:30',
      fieldNextFree: ['11:00', '11:00'],
      teamCount: 4,
      startGameNumber: 1,
    })
    const [, , thirdPlace, final] = games
    const sfEnd = games[0].scheduledEnd // both semis end at same time here
    const expectedStart = new Date(0)
    // sfEnd + bufferBetweenGamesMin (5) + breakBetweenRoundsMin (15) = +20min from sfEnd
    const [h, m] = sfEnd.split(':').map(Number)
    expectedStart.setHours(h, m + 5 + 15)
    const expectedStr = `${String(expectedStart.getHours()).padStart(2, '0')}:${String(expectedStart.getMinutes()).padStart(2, '0')}`
    expect(final.scheduledStart).toBe(expectedStr)
    expect(thirdPlace.scheduledStart).toBe(expectedStr)
    expect(final.field).toBe(1)
    expect(thirdPlace.field).toBe(2)
  })

  it('throws instead of producing an invalid slot when the venue is too short for the semifinals', () => {
    expect(() =>
      generatePlayoffGames({
        finalsBracketSize: 4,
        fields: 2,
        gameSettings,
        blackoutPeriods: [],
        availabilityEnd: '19:30',
        fieldNextFree: ['19:25', '19:25'],
        teamCount: 4,
        startGameNumber: 7,
      })
    ).toThrow('Kein Zeitfenster für Halbfinale verfügbar')
  })

  it('throws instead of producing an invalid slot when the venue is too short for the final', () => {
    expect(() =>
      generatePlayoffGames({
        finalsBracketSize: 2,
        fields: 2,
        gameSettings,
        blackoutPeriods: [],
        availabilityEnd: '19:30',
        fieldNextFree: ['19:25', '19:25'],
        teamCount: 2,
        startGameNumber: 2,
      })
    ).toThrow('Kein Zeitfenster für Finale verfügbar')
  })
})
