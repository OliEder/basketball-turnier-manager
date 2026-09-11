import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useTournamentStore } from '@/store/tournament-store'
import { clearAll } from '@/lib/storage'
import ConfigPage from './ConfigPage'

beforeEach(() => {
  clearAll()
  useTournamentStore.setState({
    tournament: {
      id: 't1', name: 'Test', mode: 'round-robin', fields: 2,
      gameSettings: {
        periodsCount: 4, periodDurationMin: 5, breakBetweenPeriodsMin: 1,
        halfTimeBreakMin: 5, bufferBetweenGamesMin: 5, breakBetweenRoundsMin: 15,
        awardCeremonyMin: 15,
      },
      venue: {
        name: 'Halle', availabilityWindows: [{ start: '09:00', end: '20:00' }],
        blackoutPeriods: [], setupBufferMin: 30, teardownBufferMin: 30,
      },
      teams: [],
    },
    schedule: null,
  })
})

describe('ConfigPage', () => {
  it('disables "Zeitplan generieren" with fewer than 2 teams', () => {
    render(<ConfigPage />)
    expect(screen.getByRole('button', { name: /zeitplan generieren/i })).toBeDisabled()
    expect(screen.getByText(/mindestens 2 teams erforderlich/i)).toBeInTheDocument()
  })

  it('generates and saves a schedule when clicked with at least 2 teams', () => {
    useTournamentStore.getState().addTeam({ name: 'Team A', logoUrl: '', color: '#000', contact: '' })
    useTournamentStore.getState().addTeam({ name: 'Team B', logoUrl: '', color: '#000', contact: '' })
    render(<ConfigPage />)

    const button = screen.getByRole('button', { name: /zeitplan generieren/i })
    expect(button).toBeEnabled()
    fireEvent.click(button)

    expect(useTournamentStore.getState().schedule).not.toBeNull()
    expect(useTournamentStore.getState().schedule!.games.length).toBeGreaterThan(0)
  })

  it('shows a suggestion help text under "Anzahl Runden" in swiss mode', () => {
    useTournamentStore.getState().setMode('swiss')
    for (let i = 1; i <= 4; i++) {
      useTournamentStore.getState().addTeam({ name: `Team ${i}`, logoUrl: '', color: '#000', contact: '' })
    }
    render(<ConfigPage />)

    expect(screen.getByText(/vorschlag nach standard-schweizer-formel: 2 runden/i)).toBeInTheDocument()
  })
})
