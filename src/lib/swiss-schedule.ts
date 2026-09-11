import { v4 as uuidv4 } from 'uuid'
import type { Game, GameSettings, TimeWindow } from '@/types'
import { calcGameDurationMin, addMinutes, findNextSlot, maxTime } from './game-duration'
import { pairFirstSwissRound } from './swiss-pairing'

export interface SwissScheduleInput {
  teamIds: string[]
  swissRounds: number
  fields: number
  gameSettings: GameSettings
  blackoutPeriods: TimeWindow[]
  firstGameStart: string
  availabilityEnd: string
  startGameNumber: number
}

export interface SwissScheduleResult {
  games: Game[]
}

interface ScheduleRoundSlotsInput {
  slotCount: number
  fields: number
  gameDuration: number
  bufferMin: number
  blackoutPeriods: TimeWindow[]
  availabilityEnd: string
  roundStart: string
}

function scheduleRoundSlots(input: ScheduleRoundSlotsInput): { starts: string[]; roundEnd: string } {
  const { slotCount, fields, gameDuration, bufferMin, blackoutPeriods, availabilityEnd, roundStart } = input
  const fieldClocks = Array.from({ length: fields }, () => roundStart)
  const starts: string[] = []
  let roundEnd = roundStart

  for (let i = 0; i < slotCount; i++) {
    const fieldIndex = i % fields
    const start = findNextSlot(fieldClocks[fieldIndex], gameDuration, blackoutPeriods, availabilityEnd)
    if (!start) {
      throw new Error('Zeitplan passt nicht in die verfügbare Hallenzeit — Rundenzahl reduzieren oder mehr Felder einplanen')
    }
    const end = addMinutes(start, gameDuration)
    starts.push(start)
    fieldClocks[fieldIndex] = addMinutes(end, bufferMin)
    roundEnd = maxTime(roundEnd, end)
  }

  return { starts, roundEnd }
}

export function generateSwissSchedule(input: SwissScheduleInput): SwissScheduleResult {
  const { teamIds, swissRounds, fields, gameSettings, blackoutPeriods, firstGameStart, availabilityEnd, startGameNumber } = input
  const gameDuration = calcGameDurationMin(gameSettings)
  const games: Game[] = []
  let gameNumber = startGameNumber

  const { pairs: round1Pairs, byeTeamId: round1Bye } = pairFirstSwissRound(teamIds)
  const { starts, roundEnd } = scheduleRoundSlots({
    slotCount: round1Pairs.length,
    fields,
    gameDuration,
    bufferMin: gameSettings.bufferBetweenGamesMin,
    blackoutPeriods,
    availabilityEnd,
    roundStart: firstGameStart,
  })

  for (let i = 0; i < round1Pairs.length; i++) {
    games.push({
      id: uuidv4(),
      homeTeamId: round1Pairs[i][0],
      awayTeamId: round1Pairs[i][1],
      stage: 'swiss',
      field: (i % fields) + 1,
      scheduledStart: starts[i],
      scheduledEnd: addMinutes(starts[i], gameDuration),
      round: 1,
      gameNumber: gameNumber++,
      periodScores: [],
    })
  }
  if (round1Bye) {
    games.push({
      id: uuidv4(),
      homeTeamId: null,
      awayTeamId: null,
      byeTeamId: round1Bye,
      stage: 'swiss',
      field: 0, // field: 0 marks a bye — no real venue slot is used
      scheduledStart: firstGameStart,
      scheduledEnd: firstGameStart,
      round: 1,
      gameNumber: gameNumber++,
      periodScores: [],
    })
  }

  let previousRoundEnd = roundEnd
  const gamesPerFutureRound = Math.floor(teamIds.length / 2)
  const hasByeEachRound = !!round1Bye

  for (let round = 2; round <= swissRounds; round++) {
    const roundStart = addMinutes(previousRoundEnd, gameSettings.bufferBetweenGamesMin + gameSettings.breakBetweenRoundsMin)
    const { starts: roundStarts, roundEnd: thisRoundEnd } = scheduleRoundSlots({
      slotCount: gamesPerFutureRound,
      fields,
      gameDuration,
      bufferMin: gameSettings.bufferBetweenGamesMin,
      blackoutPeriods,
      availabilityEnd,
      roundStart,
    })

    for (let i = 0; i < gamesPerFutureRound; i++) {
      const label = `Runde ${round} – Spiel ${i + 1}`
      games.push({
        id: uuidv4(),
        homeTeamId: null,
        awayTeamId: null,
        homeLabel: label,
        awayLabel: label,
        stage: 'swiss',
        field: (i % fields) + 1,
        scheduledStart: roundStarts[i],
        scheduledEnd: addMinutes(roundStarts[i], gameDuration),
        round,
        gameNumber: gameNumber++,
        periodScores: [],
      })
    }
    if (hasByeEachRound) {
      games.push({
        id: uuidv4(),
        homeTeamId: null,
        awayTeamId: null,
        stage: 'swiss',
        field: 0,
        scheduledStart: roundStart,
        scheduledEnd: roundStart,
        round,
        gameNumber: gameNumber++,
        periodScores: [],
      })
    }

    previousRoundEnd = thisRoundEnd
  }

  return { games }
}
