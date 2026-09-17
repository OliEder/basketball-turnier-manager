import { describe, it, expect } from 'vitest'
import { isValidElement } from 'react'
import { buildSwissOverviewDocument } from './swiss-overview-pdf'
import { computeStandings } from '@/lib/standings'
import type { TournamentConfig, Schedule } from '@/types'

const tournament: TournamentConfig = {
  id: 't1', name: 'Einstufungsturnier', mode: 'swiss', swissRounds: 2, fields: 2,
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
      id: 'g1', homeTeamId: 't1', awayTeamId: 't2', stage: 'swiss', field: 1,
      scheduledStart: '09:30', scheduledEnd: '10:00', round: 1, gameNumber: 1,
      periodScores: [{ period: 1, homeScore: 20, awayScore: 15 }],
    },
  ],
  totalDurationMin: 30, estimatedEnd: '10:00',
}

describe('buildSwissOverviewDocument', () => {
  it('produces a valid react-pdf Document element', () => {
    const standings = computeStandings(tournament.teams, schedule.games, 1)
    const doc = buildSwissOverviewDocument(tournament, schedule, standings)
    expect(isValidElement(doc)).toBe(true)
  })

  it('marks a withdrawn team in the standings table', () => {
    const standings = computeStandings(tournament.teams, schedule.games, 1)
    standings[0].withdrawn = true
    const doc = buildSwissOverviewDocument(tournament, schedule, standings)
    const json = JSON.stringify(doc, (_key, value) =>
      isValidElement(value) ? { type: (value as { type: unknown }).type, props: (value as { props: unknown }).props } : value,
    )
    expect(json).toContain('zurückgezogen')
  })
})
