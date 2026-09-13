import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useTournamentStore } from '@/store/tournament-store'
import { clearAll } from '@/lib/storage'
import TournamentForm from './TournamentForm'

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

describe('TournamentForm', () => {
  it('offers field counts up to 6, not just 4', () => {
    render(<TournamentForm />)
    fireEvent.click(screen.getByRole('combobox', { name: /anzahl felder/i }))

    const options = screen.getAllByRole('option').map(o => o.textContent)
    expect(options).toEqual(['1 Feld', '2 Felder', '3 Felder', '4 Felder', '5 Felder', '6 Felder'])
  })

  it('lets the organizer select more than 4 fields', () => {
    render(<TournamentForm />)
    fireEvent.click(screen.getByRole('combobox', { name: /anzahl felder/i }))
    fireEvent.click(screen.getByRole('option', { name: '6 Felder' }))

    expect(useTournamentStore.getState().tournament.fields).toBe(6)
  })
})
