import { v4 as uuidv4 } from 'uuid'
import type { Game, GameSettings, TimeWindow } from '@/types'
import { calcGameDurationMin, addMinutes, maxTime, findNextSlot } from './game-duration'

export interface PlayoffInput {
  finalsBracketSize: 2 | 4
  fields: number
  gameSettings: GameSettings
  blackoutPeriods: TimeWindow[]
  availabilityEnd: string
  fieldNextFree: string[]
  teamCount: number
  startGameNumber: number
}

export function generatePlayoffGames(input: PlayoffInput): Game[] {
  const {
    finalsBracketSize, fields, gameSettings, blackoutPeriods,
    availabilityEnd, fieldNextFree, teamCount, startGameNumber,
  } = input

  if (teamCount < finalsBracketSize) {
    throw new Error(
      finalsBracketSize === 4
        ? 'Mindestens 4 Teams für Halbfinale benötigt'
        : 'Mindestens 2 Teams für Finale benötigt'
    )
  }

  const gameDuration = calcGameDurationMin(gameSettings)
  const slotDuration = gameDuration + gameSettings.bufferBetweenGamesMin
  const games: Game[] = []
  let gameNumber = startGameNumber
  const clocks = [...fieldNextFree]

  if (finalsBracketSize === 4) {
    const sf1Start = findNextSlot(maxTime(clocks[0], clocks[1] ?? clocks[0]), gameDuration, blackoutPeriods, availabilityEnd)
    if (!sf1Start) {
      throw new Error('Kein Zeitfenster für Halbfinale verfügbar — Hallenzeit reicht nicht aus')
    }
    const sf1End = addMinutes(sf1Start, gameDuration)

    games.push({
      id: uuidv4(),
      homeTeamId: null,
      awayTeamId: null,
      homeLabel: '1. der Vorrunde',
      awayLabel: '4. der Vorrunde',
      stage: 'semifinal',
      field: 1,
      scheduledStart: sf1Start,
      scheduledEnd: sf1End,
      round: 2,
      gameNumber: gameNumber++,
      periodScores: [],
    })

    let sf2Start: string
    let sf2Field: number
    if (fields >= 2) {
      sf2Start = sf1Start
      sf2Field = 2
    } else {
      sf2Start = findNextSlot(addMinutes(sf1Start, slotDuration), gameDuration, blackoutPeriods, availabilityEnd)
      sf2Field = 1
    }
    if (!sf2Start) {
      throw new Error('Kein Zeitfenster für Halbfinale verfügbar — Hallenzeit reicht nicht aus')
    }
    const sf2End = addMinutes(sf2Start, gameDuration)

    games.push({
      id: uuidv4(),
      homeTeamId: null,
      awayTeamId: null,
      homeLabel: '2. der Vorrunde',
      awayLabel: '3. der Vorrunde',
      stage: 'semifinal',
      field: sf2Field,
      scheduledStart: sf2Start,
      scheduledEnd: sf2End,
      round: 2,
      gameNumber: gameNumber++,
      periodScores: [],
    })

    const latestAfterSemis = maxTime(
      addMinutes(sf1Start, slotDuration),
      addMinutes(sf2Start, slotDuration),
    )
    const finalStart = findNextSlot(
      addMinutes(latestAfterSemis, gameSettings.breakBetweenRoundsMin),
      gameDuration,
      blackoutPeriods,
      availabilityEnd,
    )
    if (!finalStart) {
      throw new Error('Kein Zeitfenster für Finale verfügbar — Hallenzeit reicht nicht aus')
    }
    games.push({
      id: uuidv4(),
      homeTeamId: null,
      awayTeamId: null,
      homeLabel: 'Sieger HF 1',
      awayLabel: 'Sieger HF 2',
      stage: 'final',
      field: 1,
      scheduledStart: finalStart,
      scheduledEnd: addMinutes(finalStart, gameDuration),
      round: 3,
      gameNumber: gameNumber++,
      periodScores: [],
    })
  } else {
    const latest = clocks.reduce((max, t) => maxTime(max, t), clocks[0])
    const finalStart = findNextSlot(
      addMinutes(latest, gameSettings.breakBetweenRoundsMin),
      gameDuration,
      blackoutPeriods,
      availabilityEnd,
    )
    if (!finalStart) {
      throw new Error('Kein Zeitfenster für Finale verfügbar — Hallenzeit reicht nicht aus')
    }
    games.push({
      id: uuidv4(),
      homeTeamId: null,
      awayTeamId: null,
      homeLabel: '1. der Vorrunde',
      awayLabel: '2. der Vorrunde',
      stage: 'final',
      field: 1,
      scheduledStart: finalStart,
      scheduledEnd: addMinutes(finalStart, gameDuration),
      round: 2,
      gameNumber: gameNumber++,
      periodScores: [],
    })
  }

  return games
}
