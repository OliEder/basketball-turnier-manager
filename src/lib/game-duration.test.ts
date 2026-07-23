import { describe, it, expect } from 'vitest'
import { calcGameDurationMin, addMinutes, isTimeInWindow } from './game-duration'
import type { GameSettings } from '@/types'

const settings: GameSettings = {
  periodsCount: 4,
  periodDurationMin: 5,
  breakBetweenPeriodsMin: 1,
  halfTimeBreakMin: 5,
  bufferBetweenGamesMin: 5,
  breakBeforeFinalsMin: 15,
  awardCeremonyMin: 15,
}

describe('calcGameDurationMin', () => {
  it('calculates 4x5min quarters correctly', () => {
    // 4 periods × 5min = 20min play
    // 3 breaks: Q1-Q2 (1min), halftime (5min), Q3-Q4 (1min) = 7min breaks
    // total = 27min
    expect(calcGameDurationMin(settings)).toBe(27)
  })

  it('calculates 2 halves correctly', () => {
    const s: GameSettings = { ...settings, periodsCount: 2, periodDurationMin: 10, breakBetweenPeriodsMin: 2, halfTimeBreakMin: 10 }
    // 2 × 10min = 20min play
    // 1 break (halftime) = 10min
    // total = 30min
    expect(calcGameDurationMin(s)).toBe(30)
  })
})

describe('addMinutes', () => {
  it('adds minutes to HH:MM string', () => {
    expect(addMinutes('09:00', 30)).toBe('09:30')
    expect(addMinutes('09:45', 30)).toBe('10:15')
    expect(addMinutes('23:30', 45)).toBe('00:15')
  })
})

describe('isTimeInWindow', () => {
  it('returns true when time is inside window', () => {
    expect(isTimeInWindow('10:00', { start: '09:00', end: '20:00' })).toBe(true)
  })
  it('returns false when time is outside window', () => {
    expect(isTimeInWindow('21:00', { start: '09:00', end: '20:00' })).toBe(false)
  })
  it('returns false when time is on the boundary (end)', () => {
    expect(isTimeInWindow('20:00', { start: '09:00', end: '20:00' })).toBe(false)
  })
})
