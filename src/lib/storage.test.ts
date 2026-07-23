import { describe, it, expect, beforeEach } from 'vitest'
import { saveTournament, loadTournament, saveSchedule, loadSchedule, clearAll } from './storage'
import type { TournamentConfig, Schedule } from '@/types'

const mockTournament: TournamentConfig = {
  id: 'tour-1',
  name: 'Test Cup',
  mode: 'round-robin',
  fields: 2,
  gameSettings: {
    periodsCount: 4, periodDurationMin: 5,
    breakBetweenPeriodsMin: 1, halfTimeBreakMin: 5,
    bufferBetweenGamesMin: 5,
  },
  venue: {
    name: 'Halle', availabilityWindows: [{ start: '09:00', end: '20:00' }],
    blackoutPeriods: [], setupBufferMin: 30, teardownBufferMin: 30,
  },
  teams: [],
}

beforeEach(() => clearAll())

describe('saveTournament / loadTournament', () => {
  it('roundtrips tournament config', () => {
    saveTournament(mockTournament)
    expect(loadTournament()).toEqual(mockTournament)
  })

  it('returns null when nothing saved', () => {
    expect(loadTournament()).toBeNull()
  })
})

describe('saveSchedule / loadSchedule', () => {
  it('roundtrips schedule', () => {
    const schedule: Schedule = {
      id: 'sched-1', tournamentId: 'tour-1',
      generatedAt: '2026-06-24T10:00:00Z',
      games: [], totalDurationMin: 0, estimatedEnd: '09:30',
    }
    saveSchedule(schedule)
    expect(loadSchedule()).toEqual(schedule)
  })
})
