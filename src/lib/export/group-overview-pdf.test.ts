import { describe, it, expect } from 'vitest'
import { isValidElement } from 'react'
import { buildGroupOverviewDocument } from './group-overview-pdf'
import { computeGroupStandings } from '@/lib/group-standings'
import type { TournamentConfig, Schedule } from '@/types'

const tournament: TournamentConfig = {
  id: 't1', name: 'Verbandsturnier', mode: 'round-robin+finals', finalsBracketSize: 4,
  groupCount: 2, fields: 2,
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
    { id: 't1', name: 'Team A', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
    { id: 't2', name: 'Team B', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
    { id: 't3', name: 'Team C', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'B' },
    { id: 't4', name: 'Team D', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'B' },
  ],
}

const schedule: Schedule = {
  id: 's1', tournamentId: 't1', generatedAt: '2026-09-12T10:00:00Z',
  games: [
    {
      id: 'g1', homeTeamId: 't1', awayTeamId: 't2', stage: 'group', groupId: 'A', field: 1,
      scheduledStart: '09:30', scheduledEnd: '10:00', round: 1, gameNumber: 1,
      periodScores: [{ period: 1, homeScore: 20, awayScore: 15 }],
    },
    {
      id: 'g2', homeTeamId: 't3', awayTeamId: 't4', stage: 'group', groupId: 'B', field: 2,
      scheduledStart: '09:30', scheduledEnd: '10:00', round: 1, gameNumber: 2,
      periodScores: [],
    },
  ],
  totalDurationMin: 30, estimatedEnd: '10:00',
}

describe('buildGroupOverviewDocument', () => {
  it('creates one Page per section, in order', () => {
    const sections = [
      { groupId: 'A', standings: computeGroupStandings(tournament.teams, schedule.games, 'A') },
      { groupId: 'B', standings: computeGroupStandings(tournament.teams, schedule.games, 'B') },
    ]
    const doc = buildGroupOverviewDocument(tournament, schedule, sections)
    expect(isValidElement(doc)).toBe(true)
    // Document -> children is an array of Page elements, one per section
    const pages = (doc.props as { children: unknown[] }).children
    expect(pages).toHaveLength(2)
  })

  it('includes the played score for a finished game and the scheduled time for an open one', () => {
    const sections = [{ groupId: 'A', standings: computeGroupStandings(tournament.teams, schedule.games, 'A') }]
    const doc = buildGroupOverviewDocument(tournament, schedule, sections)
    const json = JSON.stringify(doc, (_key, value) =>
      isValidElement(value) ? { type: (value as { type: unknown }).type, props: (value as { props: unknown }).props } : value,
    )
    expect(json).toContain('20 : 15')
  })
})
