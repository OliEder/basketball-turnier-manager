import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import FinalStandingsPage from './FinalStandingsPage'
import { useTournamentStore } from '@/store/tournament-store'

describe('FinalStandingsPage', () => {
  beforeEach(() => {
    const tournament = {
      ...useTournamentStore.getState().tournament,
      mode: 'round-robin+finals' as const,
      finalsVariant: 'endrunde-4' as const,
      teams: [
        { id: 't1', name: 'Team Eins', logoUrl: '', color: '#000', contact: '', players: [] },
        { id: 't2', name: 'Team Zwei', logoUrl: '', color: '#000', contact: '', players: [] },
      ],
    }
    useTournamentStore.setState({
      tournament,
      schedule: {
        id: 's1', tournamentId: tournament.id, generatedAt: new Date().toISOString(),
        games: [
          {
            id: 'pg1', homeTeamId: 't1', awayTeamId: 't2', stage: 'placement', field: 1,
            scheduledStart: '10:00', scheduledEnd: '10:30', round: 1, gameNumber: 1,
            periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }],
            rankTier: 1, placementFrom: 1,
          },
        ],
        totalDurationMin: 30, estimatedEnd: '10:30',
      },
    })
  })

  it('shows the final ranking with places and team names', () => {
    render(<FinalStandingsPage />)
    expect(screen.getByText('1.')).toBeInTheDocument()
    expect(screen.getByText('Team Eins')).toBeInTheDocument()
    expect(screen.getByText('2.')).toBeInTheDocument()
    expect(screen.getByText('Team Zwei')).toBeInTheDocument()
  })

  it('shows a combined 1..N standing for Endrunde 1 across two rank tiers', () => {
    const tournament = {
      ...useTournamentStore.getState().tournament,
      finalsVariant: 'endrunde-1' as const,
      teams: [
        { id: 't1', name: 'Team Eins', logoUrl: '', color: '#000', contact: '', players: [] },
        { id: 't2', name: 'Team Zwei', logoUrl: '', color: '#000', contact: '', players: [] },
        { id: 't3', name: 'Team Drei', logoUrl: '', color: '#000', contact: '', players: [] },
        { id: 't4', name: 'Team Vier', logoUrl: '', color: '#000', contact: '', players: [] },
      ],
    }
    useTournamentStore.setState({
      tournament,
      schedule: {
        id: 's1', tournamentId: tournament.id, generatedAt: new Date().toISOString(),
        games: [
          {
            id: 'f1', homeTeamId: 't1', awayTeamId: 't2', stage: 'final', matchIndex: 0, field: 1,
            scheduledStart: '11:00', scheduledEnd: '11:30', round: 2, gameNumber: 1,
            periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }], rankTier: 1, placementFrom: 1,
          },
          {
            id: 'tp1', homeTeamId: 't3', awayTeamId: 't4', stage: 'third-place', matchIndex: 0, field: 2,
            scheduledStart: '11:00', scheduledEnd: '11:30', round: 2, gameNumber: 2,
            periodScores: [{ period: 1, homeScore: 15, awayScore: 12 }], rankTier: 1, placementFrom: 1,
          },
        ],
        totalDurationMin: 30, estimatedEnd: '11:30',
      },
    })
    render(<FinalStandingsPage />)
    expect(screen.getByText('1.')).toBeInTheDocument()
    expect(screen.getByText('Team Eins')).toBeInTheDocument()
    expect(screen.getByText('4.')).toBeInTheDocument()
    expect(screen.getByText('Team Vier')).toBeInTheDocument()
  })
})
