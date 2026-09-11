import { v4 as uuidv4 } from 'uuid'
import type { Game, GameSettings, TimeWindow } from '@/types'
import { calcGameDurationMin, addMinutes, findNextSlot } from './game-duration'
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

export function generateSwissSchedule(input: SwissScheduleInput): SwissScheduleResult {
  const { teamIds, fields, gameSettings, blackoutPeriods, firstGameStart, availabilityEnd, startGameNumber } = input
  const gameDuration = calcGameDurationMin(gameSettings)

  const { pairs, byeTeamId } = pairFirstSwissRound(teamIds)
  const games: Game[] = []
  let gameNumber = startGameNumber
  const fieldClocks = Array.from({ length: fields }, () => firstGameStart)

  for (let i = 0; i < pairs.length; i++) {
    const fieldIndex = i % fields
    const start = findNextSlot(fieldClocks[fieldIndex], gameDuration, blackoutPeriods, availabilityEnd)
    if (!start) {
      throw new Error('Zeitplan passt nicht in die verfügbare Hallenzeit — Rundenzahl reduzieren oder mehr Felder einplanen')
    }
    const end = addMinutes(start, gameDuration)
    games.push({
      id: uuidv4(),
      homeTeamId: pairs[i][0],
      awayTeamId: pairs[i][1],
      stage: 'swiss',
      field: fieldIndex + 1,
      scheduledStart: start,
      scheduledEnd: end,
      round: 1,
      gameNumber: gameNumber++,
      periodScores: [],
    })
    fieldClocks[fieldIndex] = addMinutes(end, gameSettings.bufferBetweenGamesMin)
  }

  if (byeTeamId) {
    games.push({
      id: uuidv4(),
      homeTeamId: null,
      awayTeamId: null,
      byeTeamId,
      stage: 'swiss',
      field: 0,
      scheduledStart: firstGameStart,
      scheduledEnd: firstGameStart,
      round: 1,
      gameNumber: gameNumber++,
      periodScores: [],
    })
  }

  return { games }
}
