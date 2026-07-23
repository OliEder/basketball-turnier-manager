import type { GameSettings, TimeWindow } from '@/types'

/** Convert "HH:MM" to total minutes since midnight */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** Convert total minutes since midnight to "HH:MM" */
export function minutesToTime(minutes: number): string {
  const totalMins = ((minutes % 1440) + 1440) % 1440 // wrap around midnight
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Add minutes to a "HH:MM" string, returns "HH:MM" */
export function addMinutes(time: string, minutes: number): string {
  return minutesToTime(timeToMinutes(time) + minutes)
}

/**
 * Calculate total game duration in minutes (excluding bufferBetweenGamesMin).
 * Halftime break applies after period periodsCount/2.
 */
export function calcGameDurationMin(settings: GameSettings): number {
  const { periodsCount, periodDurationMin, breakBetweenPeriodsMin, halfTimeBreakMin } = settings
  const playTime = periodsCount * periodDurationMin
  const halfTimeIndex = periodsCount / 2 // break after this period is halftime

  let breakTime = 0
  for (let i = 1; i < periodsCount; i++) {
    breakTime += i === halfTimeIndex ? halfTimeBreakMin : breakBetweenPeriodsMin
  }
  return playTime + breakTime
}

/** Returns true if time (HH:MM) falls strictly inside [start, end) */
export function isTimeInWindow(time: string, window: TimeWindow): boolean {
  const t = timeToMinutes(time)
  const s = timeToMinutes(window.start)
  const e = timeToMinutes(window.end)
  return t >= s && t < e
}

/** Returns true if a game slot [start, end] overlaps a blackout period */
export function overlapsBlackout(start: string, end: string, blackout: TimeWindow): boolean {
  const gameStart = timeToMinutes(start)
  const gameEnd = timeToMinutes(end)
  const bStart = timeToMinutes(blackout.start)
  const bEnd = timeToMinutes(blackout.end)
  return gameStart < bEnd && gameEnd > bStart
}
