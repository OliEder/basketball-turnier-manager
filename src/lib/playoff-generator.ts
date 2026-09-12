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
  // When provided (Endrunde 3: qualification restricted to each group's rank-1 team), seeds the
  // semifinals' homeSourceRank/awaySourceRank in bracket order: [sf1.home, sf1.away, sf2.home,
  // sf2.away] for a 4-bracket, [final.home, final.away] for a 2-bracket. Omitted for the
  // pre-existing simple round-robin+finals feature, which has no group-phase qualification.
  qualifierSourceRanks?: { groupId: string; rank: number }[]
}

export function generatePlayoffGames(input: PlayoffInput): Game[] {
  const {
    finalsBracketSize, fields, gameSettings, blackoutPeriods,
    availabilityEnd, fieldNextFree, teamCount, startGameNumber, qualifierSourceRanks,
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
      ...(qualifierSourceRanks && {
        homeSourceRank: qualifierSourceRanks[0],
        awaySourceRank: qualifierSourceRanks[1],
      }),
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
      ...(qualifierSourceRanks && {
        homeSourceRank: qualifierSourceRanks[2],
        awaySourceRank: qualifierSourceRanks[3],
      }),
    })

    const latestAfterSemis = maxTime(
      addMinutes(sf1Start, slotDuration),
      addMinutes(sf2Start, slotDuration),
    )
    const roundThreeStart = findNextSlot(
      addMinutes(latestAfterSemis, gameSettings.breakBetweenRoundsMin),
      gameDuration,
      blackoutPeriods,
      availabilityEnd,
    )
    if (!roundThreeStart) {
      throw new Error('Kein Zeitfenster für Finale verfügbar — Hallenzeit reicht nicht aus')
    }
    const roundThreeEnd = addMinutes(roundThreeStart, gameDuration)

    let finalStart: string
    let finalField: number
    let thirdPlaceStart: string
    let thirdPlaceField: number
    if (fields >= 2) {
      finalStart = roundThreeStart
      finalField = 1
      thirdPlaceStart = roundThreeStart
      thirdPlaceField = 2
    } else {
      thirdPlaceStart = roundThreeStart
      thirdPlaceField = 1
      const finalSlotStart = findNextSlot(
        addMinutes(roundThreeStart, slotDuration),
        gameDuration,
        blackoutPeriods,
        availabilityEnd,
      )
      if (!finalSlotStart) {
        throw new Error('Kein Zeitfenster für Finale verfügbar — Hallenzeit reicht nicht aus')
      }
      finalStart = finalSlotStart
      finalField = 1
    }

    games.push({
      id: uuidv4(),
      homeTeamId: null,
      awayTeamId: null,
      homeLabel: 'Verlierer HF 1',
      awayLabel: 'Verlierer HF 2',
      stage: 'third-place',
      field: thirdPlaceField,
      scheduledStart: thirdPlaceStart,
      scheduledEnd: thirdPlaceStart === roundThreeStart ? roundThreeEnd : addMinutes(thirdPlaceStart, gameDuration),
      round: 3,
      gameNumber: gameNumber++,
      periodScores: [],
      homeSourceSemifinal: { semifinalIndex: 1, outcome: 'loser' },
      awaySourceSemifinal: { semifinalIndex: 2, outcome: 'loser' },
    })

    games.push({
      id: uuidv4(),
      homeTeamId: null,
      awayTeamId: null,
      homeLabel: 'Sieger HF 1',
      awayLabel: 'Sieger HF 2',
      stage: 'final',
      field: finalField,
      scheduledStart: finalStart,
      scheduledEnd: addMinutes(finalStart, gameDuration),
      round: 3,
      gameNumber: gameNumber++,
      periodScores: [],
      homeSourceSemifinal: { semifinalIndex: 1, outcome: 'winner' },
      awaySourceSemifinal: { semifinalIndex: 2, outcome: 'winner' },
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
