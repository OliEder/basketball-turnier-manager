import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import FinalsResultsPage from './FinalsResultsPage'
import { useTournamentStore } from '@/store/tournament-store'

describe('FinalsResultsPage', () => {
  beforeEach(() => {
    const tournament = {
      ...useTournamentStore.getState().tournament,
      mode: 'round-robin+finals' as const,
      finalsVariant: 'endrunde-4' as const,
      teams: [
        { id: 't1', name: 'Team Eins', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
        { id: 't2', name: 'Team Zwei', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'B' },
      ],
    }
    useTournamentStore.setState({
      tournament,
      schedule: {
        id: 's1', tournamentId: tournament.id, generatedAt: new Date().toISOString(),
        games: [
          {
            id: 'pg1', homeTeamId: 't1', awayTeamId: 't2', stage: 'placement', field: 1,
            scheduledStart: '10:00', scheduledEnd: '10:30', round: 1, gameNumber: 1, periodScores: [],
            rankTier: 1, placementFrom: 1,
            homeSourceRank: { groupId: 'A', rank: 1 }, awaySourceRank: { groupId: 'B', rank: 1 },
          },
          {
            id: 'pg2', homeTeamId: null, awayTeamId: null, stage: 'placement', field: 1,
            scheduledStart: '11:00', scheduledEnd: '11:30', round: 2, gameNumber: 2, periodScores: [],
            rankTier: 2, placementFrom: 5,
            homeSourceRank: { groupId: 'A', rank: 2 }, awaySourceRank: { groupId: 'B', rank: 2 },
          },
        ],
        totalDurationMin: 90, estimatedEnd: '11:30',
      },
    })
  })

  it('shows a resolved placement game with entry fields and a rank-tier tag', () => {
    render(<FinalsResultsPage />, { wrapper: MemoryRouter })
    expect(screen.getByText(/Rangstufe 1/)).toBeInTheDocument()
    expect(screen.getByText('Team Eins')).toBeInTheDocument()
    expect(screen.getByLabelText(/Ergebnis Heim/)).toBeInTheDocument()
  })

  it('shows an unresolved placement game as read-only, without entry fields', () => {
    render(<FinalsResultsPage />, { wrapper: MemoryRouter })
    expect(screen.getByText(/Rangstufe 2/)).toBeInTheDocument()
    expect(screen.getByText('Wartet auf Gruppenphase')).toBeInTheDocument()
  })

  it('saves a result via submitGameResult', () => {
    render(<FinalsResultsPage />, { wrapper: MemoryRouter })
    fireEvent.change(screen.getByLabelText('Ergebnis Heim, Spiel 1'), { target: { value: '20' } })
    fireEvent.change(screen.getByLabelText('Ergebnis Auswärts, Spiel 1'), { target: { value: '15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    const saved = useTournamentStore.getState().schedule!.games.find(g => g.id === 'pg1')!
    expect(saved.periodScores).toEqual([{ period: 1, homeScore: 20, awayScore: 15 }])
  })

  it('lets the organizer withdraw a team from a resolved placement game', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<FinalsResultsPage />, { wrapper: MemoryRouter })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'all' } })

    fireEvent.click(screen.getByRole('button', { name: 'Team Eins zurückziehen' }))

    const withdrawnTeam = useTournamentStore.getState().tournament.teams.find(t => t.id === 't1')!
    expect(withdrawnTeam.withdrawnAfterStage).toBe('finals')
    expect(screen.queryByRole('button', { name: 'Team Eins zurückziehen' })).not.toBeInTheDocument()
    expect(screen.getByText('Team Eins zurückgezogen')).toBeInTheDocument()
  })

  it('does not offer a withdraw button for a still-unresolved placeholder slot', () => {
    render(<FinalsResultsPage />, { wrapper: MemoryRouter })
    // Only the two resolved-slot teams (Team Eins, Team Zwei) may offer a withdraw button;
    // the unresolved pg2 slots (rank 2 of group A/B) must not.
    const withdrawButtons = screen.getAllByRole('button', { name: /zurückziehen$/ })
    expect(withdrawButtons).toHaveLength(2)
  })
})
