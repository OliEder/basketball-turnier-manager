import { describe, it, expect } from 'vitest'
import { renderSwissOverviewHtml } from './swiss-overview-export'
import { getTeamAbbreviation } from '@/lib/utils'
import type { TournamentConfig, Schedule } from '@/types'
import type { TeamStanding } from '@/lib/standings'

const tournament: TournamentConfig = {
  id: 't1', name: 'Einstufungsturnier', mode: 'swiss', swissRounds: 1, fields: 2,
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
  id: 's1', tournamentId: 't1', generatedAt: '2026-09-11T10:00:00Z',
  games: [{
    id: 'g1', homeTeamId: 't1', awayTeamId: 't2', stage: 'swiss', field: 1,
    scheduledStart: '09:30', scheduledEnd: '10:00', round: 1, gameNumber: 1,
    periodScores: [{ period: 1, homeScore: 20, awayScore: 15 }],
  }],
  totalDurationMin: 30, estimatedEnd: '10:00',
}

const standings: TeamStanding[] = [
  { teamId: 't1', points: 2, wins: 1, draws: 0, losses: 0, pointsFor: 20, pointsAgainst: 15, pointsDiff: 5, buchholz: 0, hadBye: false, withdrawn: false },
  { teamId: 't2', points: 0, wins: 0, draws: 0, losses: 1, pointsFor: 15, pointsAgainst: 20, pointsDiff: -5, buchholz: 2, hadBye: false, withdrawn: false },
]

describe('renderSwissOverviewHtml', () => {
  it('includes tournament name, team abbreviations, and standings', () => {
    const html = renderSwissOverviewHtml(tournament, schedule, standings)
    expect(html).toContain('Einstufungsturnier')
    expect(html).toContain(getTeamAbbreviation(tournament.teams[0]))
    expect(html).toContain(getTeamAbbreviation(tournament.teams[1]))
    expect(html).toContain('@media print')
  })

  it('escapes HTML in team names', () => {
    const maliciousTournament: TournamentConfig = {
      ...tournament,
      teams: [{ ...tournament.teams[0], name: '<script>alert(1)</script>' }],
    }
    const html = renderSwissOverviewHtml(maliciousTournament, schedule, standings)
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('renderSwissOverviewHtml team abbreviation', () => {
  it('shows the team abbreviation instead of the full name, with the full name as a tooltip', () => {
    const tournamentWithAbbrev: TournamentConfig = {
      ...tournament,
      teams: [
        { ...tournament.teams[0], abbreviation: 'TMA' },
        tournament.teams[1],
      ],
    }
    const html = renderSwissOverviewHtml(tournamentWithAbbrev, schedule, standings)
    expect(html).toContain('TMA')
    expect(html).toContain('title="Team A"')
    expect(html).toContain(getTeamAbbreviation(tournament.teams[1]))
  })

  it('escapes HTML in a malicious abbreviation', () => {
    const maliciousTournament: TournamentConfig = {
      ...tournament,
      teams: [{ ...tournament.teams[0], abbreviation: '<script>alert(1)</script>' }],
    }
    const html = renderSwissOverviewHtml(maliciousTournament, schedule, standings)
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
