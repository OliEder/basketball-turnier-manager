import { describe, it, expect } from 'vitest'
import { isValidElement } from 'react'
import { buildSchedulePdfDocument } from './pdf-export'
import type { TournamentConfig, Schedule } from '@/types'

const tournament: TournamentConfig = {
  id: 't1', name: 'Testturnier', mode: 'round-robin', fields: 1,
  gameSettings: {
    periodsCount: 4, periodDurationMin: 5, breakBetweenPeriodsMin: 1,
    halfTimeBreakMin: 5, bufferBetweenGamesMin: 5, breakBetweenRoundsMin: 15,
    awardCeremonyMin: 15,
  },
  venue: {
    name: 'Halle', availabilityWindows: [{ start: '09:00', end: '20:00' }],
    blackoutPeriods: [], setupBufferMin: 30, teardownBufferMin: 30,
  },
  teams: [
    { id: 't1', name: 'Team A', logoUrl: '', color: '#000', contact: '', players: [] },
    { id: 't2', name: 'Team B', logoUrl: '', color: '#000', contact: '', players: [] },
  ],
}

const schedule: Schedule = {
  id: 's1', tournamentId: 't1', generatedAt: '2026-09-12T10:00:00Z',
  games: [
    {
      id: 'g1', homeTeamId: 't1', awayTeamId: 't2', stage: 'group', field: 1,
      scheduledStart: '09:30', scheduledEnd: '10:00', round: 1, gameNumber: 1,
      periodScores: [],
    },
  ],
  totalDurationMin: 30, estimatedEnd: '10:00',
}

describe('buildSchedulePdfDocument', () => {
  it('produces a valid react-pdf Document element containing the tournament name and game count', () => {
    const doc = buildSchedulePdfDocument(tournament, schedule)
    expect(isValidElement(doc)).toBe(true)
    const json = JSON.stringify(doc, (_key, value) =>
      isValidElement(value) ? { type: (value as { type: unknown }).type, props: (value as { props: unknown }).props } : value,
    )
    expect(json).toContain('Testturnier')
    expect(json).toContain('1 Spiele')
  })

  it('shows each game\'s teams, field, and scheduled time', () => {
    const doc = buildSchedulePdfDocument(tournament, schedule)
    const json = JSON.stringify(doc, (_key, value) =>
      isValidElement(value) ? { type: (value as { type: unknown }).type, props: (value as { props: unknown }).props } : value,
    )
    expect(json).toContain('Team A vs Team B')
    expect(json).toContain('Feld 1')
    expect(json).toContain('09:30–10:00')
  })
})
