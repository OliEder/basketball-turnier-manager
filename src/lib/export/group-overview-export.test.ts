import { describe, it, expect } from 'vitest'
import { renderGroupOverviewHtml } from './group-overview-export'
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

describe('renderGroupOverviewHtml', () => {
  it('renders only the requested group\'s table and schedule when given a single group', () => {
    const standingsA = computeGroupStandings(tournament.teams, schedule.games, 'A')
    const html = renderGroupOverviewHtml(tournament, schedule, [{ groupId: 'A', standings: standingsA }])
    expect(html).toContain('Gruppe A')
    expect(html).toContain('Team A')
    expect(html).toContain('Team B')
    expect(html).not.toContain('Team C')
    expect(html).not.toContain('Team D')
  })

  it('renders every group when given multiple groups, each starting a new print page', () => {
    const standingsA = computeGroupStandings(tournament.teams, schedule.games, 'A')
    const standingsB = computeGroupStandings(tournament.teams, schedule.games, 'B')
    const html = renderGroupOverviewHtml(tournament, schedule, [
      { groupId: 'A', standings: standingsA },
      { groupId: 'B', standings: standingsB },
    ])
    expect(html).toContain('Team A')
    expect(html).toContain('Team C')
    // Every group except the very first gets a forced page break before its heading.
    expect(html).toMatch(/<h2[^>]*>Gruppe A<\/h2>/)
    expect(html).toMatch(/<h2 style="page-break-before: always"[^>]*>Gruppe B<\/h2>/)
  })

  it('shows the final score instead of the scheduled time for a played game', () => {
    const standingsA = computeGroupStandings(tournament.teams, schedule.games, 'A')
    const html = renderGroupOverviewHtml(tournament, schedule, [{ groupId: 'A', standings: standingsA }])
    expect(html).toContain('20 : 15')
  })

  it('shows the scheduled time for a game that has not been played yet', () => {
    const standingsB = computeGroupStandings(tournament.teams, schedule.games, 'B')
    const html = renderGroupOverviewHtml(tournament, schedule, [{ groupId: 'B', standings: standingsB }])
    expect(html).toContain('09:30 – 10:00')
  })

  it('escapes HTML in team names', () => {
    const maliciousTournament: TournamentConfig = {
      ...tournament,
      teams: [{ ...tournament.teams[0], name: '<script>alert(1)</script>' }, ...tournament.teams.slice(1)],
    }
    const standingsA = computeGroupStandings(maliciousTournament.teams, schedule.games, 'A')
    const html = renderGroupOverviewHtml(maliciousTournament, schedule, [{ groupId: 'A', standings: standingsA }])
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
