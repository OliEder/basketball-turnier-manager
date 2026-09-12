import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PlayoffResultsPage from './PlayoffResultsPage'
import { useTournamentStore } from '@/store/tournament-store'

describe('PlayoffResultsPage', () => {
  beforeEach(() => {
    const tournament = {
      ...useTournamentStore.getState().tournament,
      mode: 'round-robin+finals' as const,
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
            id: 'sf1', homeTeamId: 't1', awayTeamId: 't4', stage: 'semifinal', field: 1,
            scheduledStart: '10:00', scheduledEnd: '10:30', round: 2, gameNumber: 1, periodScores: [],
            homeLabel: '1. der Vorrunde', awayLabel: '4. der Vorrunde', matchIndex: 0,
          },
          {
            id: 'sf2', homeTeamId: 't2', awayTeamId: 't3', stage: 'semifinal', field: 2,
            scheduledStart: '10:00', scheduledEnd: '10:30', round: 2, gameNumber: 2, periodScores: [],
            homeLabel: '2. der Vorrunde', awayLabel: '3. der Vorrunde', matchIndex: 1,
          },
          {
            id: 'tp1', homeTeamId: null, awayTeamId: null, stage: 'third-place', field: 2,
            scheduledStart: '11:00', scheduledEnd: '11:30', round: 3, gameNumber: 3, periodScores: [],
            homeLabel: 'Verlierer HF 1', awayLabel: 'Verlierer HF 2',
            homeSourceMatch: { stage: 'semifinal', matchIndex: 0, outcome: 'loser' },
            awaySourceMatch: { stage: 'semifinal', matchIndex: 1, outcome: 'loser' },
          },
          {
            id: 'f1', homeTeamId: null, awayTeamId: null, stage: 'final', field: 1,
            scheduledStart: '11:00', scheduledEnd: '11:30', round: 3, gameNumber: 4, periodScores: [],
            homeLabel: 'Sieger HF 1', awayLabel: 'Sieger HF 2',
            homeSourceMatch: { stage: 'semifinal', matchIndex: 0, outcome: 'winner' },
            awaySourceMatch: { stage: 'semifinal', matchIndex: 1, outcome: 'winner' },
          },
        ],
        totalDurationMin: 90, estimatedEnd: '11:30',
      },
    })
  })

  it('shows a resolved semifinal with entry fields', () => {
    render(<PlayoffResultsPage />, { wrapper: MemoryRouter })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'all' } })
    expect(screen.getByText('Team Eins')).toBeInTheDocument()
    expect(screen.getByLabelText('Ergebnis Heim, Spiel 1')).toBeInTheDocument()
  })

  it('shows an unresolved final/third-place game as read-only, without entry fields', () => {
    render(<PlayoffResultsPage />, { wrapper: MemoryRouter })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'all' } })
    expect(screen.getAllByText('Wartet auf Halbfinale').length).toBe(2)
  })

  it('saves a semifinal result via submitGameResult', () => {
    render(<PlayoffResultsPage />, { wrapper: MemoryRouter })
    fireEvent.change(screen.getByLabelText('Ergebnis Heim, Spiel 1'), { target: { value: '20' } })
    fireEvent.change(screen.getByLabelText('Ergebnis Auswärts, Spiel 1'), { target: { value: '15' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Speichern' })[0])
    const saved = useTournamentStore.getState().schedule!.games.find(g => g.id === 'sf1')!
    expect(saved.periodScores).toEqual([{ period: 1, homeScore: 20, awayScore: 15 }])
  })

  it('resolves the final and third-place game once both semifinals are scored', () => {
    render(<PlayoffResultsPage />, { wrapper: MemoryRouter })
    fireEvent.change(screen.getByLabelText('Ergebnis Heim, Spiel 1'), { target: { value: '20' } })
    fireEvent.change(screen.getByLabelText('Ergebnis Auswärts, Spiel 1'), { target: { value: '10' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Speichern' })[0])
    fireEvent.change(screen.getByLabelText('Ergebnis Heim, Spiel 2'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('Ergebnis Auswärts, Spiel 2'), { target: { value: '15' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Speichern' })[0])

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'all' } })
    const finalGame = useTournamentStore.getState().schedule!.games.find(g => g.id === 'f1')!
    expect(finalGame.homeTeamId).toBe('t1')
    expect(finalGame.awayTeamId).toBe('t3')
    const thirdPlaceGame = useTournamentStore.getState().schedule!.games.find(g => g.id === 'tp1')!
    expect(thirdPlaceGame.homeTeamId).toBe('t4')
    expect(thirdPlaceGame.awayTeamId).toBe('t2')
  })
})
