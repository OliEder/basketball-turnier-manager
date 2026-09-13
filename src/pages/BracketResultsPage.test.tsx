import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BracketResultsPage from './BracketResultsPage'
import { useTournamentStore } from '@/store/tournament-store'

describe('BracketResultsPage', () => {
  beforeEach(() => {
    const tournament = {
      ...useTournamentStore.getState().tournament,
      mode: 'round-robin+finals' as const,
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
            scheduledStart: '11:00', scheduledEnd: '11:30', round: 2, gameNumber: 1, periodScores: [],
            rankTier: 1, placementFrom: 1,
          },
          {
            id: 'f2', homeTeamId: 't3', awayTeamId: 't4', stage: 'final', matchIndex: 0, field: 1,
            scheduledStart: '11:00', scheduledEnd: '11:30', round: 2, gameNumber: 2, periodScores: [],
            rankTier: 2, placementFrom: 5,
          },
        ],
        totalDurationMin: 60, estimatedEnd: '11:30',
      },
    })
  })

  it('shows one tab per rank tier and defaults to the first', () => {
    render(<BracketResultsPage />, { wrapper: MemoryRouter })
    expect(screen.getByRole('button', { name: /Rangstufe 1/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Rangstufe 2/ })).toBeInTheDocument()
    expect(screen.getByText('Team Eins')).toBeInTheDocument()
    expect(screen.queryByText('Team Drei')).not.toBeInTheDocument()
  })

  it('switches to a different rank tier when its tab is clicked', () => {
    render(<BracketResultsPage />, { wrapper: MemoryRouter })
    fireEvent.click(screen.getByRole('button', { name: /Rangstufe 2/ }))
    expect(screen.getByText('Team Drei')).toBeInTheDocument()
    expect(screen.queryByText('Team Eins')).not.toBeInTheDocument()
  })

  it('lets the organizer save a result for the active rank tier only', () => {
    render(<BracketResultsPage />, { wrapper: MemoryRouter })
    fireEvent.change(screen.getByLabelText('Ergebnis Heim, Spiel 1'), { target: { value: '20' } })
    fireEvent.change(screen.getByLabelText('Ergebnis Auswärts, Spiel 1'), { target: { value: '15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    const saved = useTournamentStore.getState().schedule!.games.find(g => g.id === 'f1')!
    expect(saved.periodScores).toEqual([{ period: 1, homeScore: 20, awayScore: 15 }])
  })
})
