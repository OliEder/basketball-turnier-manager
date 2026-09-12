import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useTournamentStore } from '@/store/tournament-store'
import { clearAll } from '@/lib/storage'
import GroupAssignmentForm from './GroupAssignmentForm'

beforeEach(() => {
  clearAll()
  useTournamentStore.setState({
    tournament: {
      id: 't1', name: 'Test', mode: 'round-robin+finals', fields: 2,
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

describe('GroupAssignmentForm', () => {
  it('shows the group-count suggestion based on team count', () => {
    const { addTeam } = useTournamentStore.getState()
    for (let i = 1; i <= 9; i++) {
      addTeam({ name: `Team ${i}`, logoUrl: '', color: '#000', contact: '' })
    }
    render(<GroupAssignmentForm />)
    expect(screen.getByText(/Vorschlag: 2 Gruppen/)).toBeInTheDocument()
  })

  it('updates groupCount when the input changes', () => {
    const { addTeam } = useTournamentStore.getState()
    addTeam({ name: 'Team 1', logoUrl: '', color: '#000', contact: '' })
    render(<GroupAssignmentForm />)
    fireEvent.change(screen.getByLabelText('Anzahl Gruppen'), { target: { value: '3' } })
    expect(useTournamentStore.getState().tournament.groupCount).toBe(3)
  })

  it('commits the suggested group count into the store as soon as teams exist, even before any explicit change', () => {
    // Regression: the input used to only display groupCount ?? suggestedGroupCount without ever
    // writing the suggestion into the store. If the organizer's intended value happened to equal
    // the suggestion (a common case), typing/confirming it produced no visible DOM change, so
    // React's controlled-input change tracking never fired onChange and groupCount was never
    // actually written -- any UI gated on "groupCount > 1" (e.g. the Endrunden-Variante section)
    // then silently never appeared despite the field showing the correct number. Committing the
    // suggestion eagerly closes this gap: by the time the organizer looks at the field, the store
    // already holds a real value.
    const { addTeam } = useTournamentStore.getState()
    for (let i = 1; i <= 12; i++) {
      addTeam({ name: `Team ${i}`, logoUrl: '', color: '#000', contact: '' })
    }
    render(<GroupAssignmentForm />)
    // 12 teams -> suggested group count is 4 (see group-suggestion.ts).
    expect(screen.getByLabelText('Anzahl Gruppen')).toHaveValue(4)
    expect(useTournamentStore.getState().tournament.groupCount).toBe(4)
  })

  it('toggles doubleRoundRobin via the checkbox', () => {
    render(<GroupAssignmentForm />)
    fireEvent.click(screen.getByLabelText('Mit Rückspiel (Hin- und Rückrunde)'))
    expect(useTournamentStore.getState().tournament.doubleRoundRobin).toBe(true)
  })

  it('renders a group dropdown per team and updates the team\'s groupId on change', () => {
    const { addTeam } = useTournamentStore.getState()
    addTeam({ name: 'Team Alpha', logoUrl: '', color: '#000', contact: '' })
    useTournamentStore.getState().setGroupCount(2)
    render(<GroupAssignmentForm />)
    const dropdown = screen.getByLabelText('Gruppe für Team Alpha')
    fireEvent.change(dropdown, { target: { value: 'B' } })
    expect(useTournamentStore.getState().tournament.teams[0].groupId).toBe('B')
  })

  it('does not update groupCount or crash when the input is cleared or non-numeric', () => {
    const { addTeam } = useTournamentStore.getState()
    addTeam({ name: 'Team 1', logoUrl: '', color: '#000', contact: '' })
    useTournamentStore.getState().setGroupCount(3)
    render(<GroupAssignmentForm />)
    const input = screen.getByLabelText('Anzahl Gruppen')
    expect(() => fireEvent.change(input, { target: { value: '' } })).not.toThrow()
    expect(useTournamentStore.getState().tournament.groupCount).toBe(3)
    expect(() => fireEvent.change(input, { target: { value: 'abc' } })).not.toThrow()
    expect(useTournamentStore.getState().tournament.groupCount).toBe(3)
  })
})
