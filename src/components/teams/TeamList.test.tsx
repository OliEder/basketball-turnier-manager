import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useTournamentStore } from '@/store/tournament-store'
import { clearAll } from '@/lib/storage'
import TeamList from './TeamList'

beforeEach(() => {
  clearAll()
  useTournamentStore.setState({
    tournament: {
      id: 't1', name: 'Test', mode: 'swiss', fields: 1,
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

describe('TeamList', () => {
  it('adds a team immediately when the tournament is not locked', () => {
    render(<TeamList />)
    fireEvent.click(screen.getByRole('button', { name: 'Team hinzufügen' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Team C' } })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(screen.queryByRole('button', { name: 'Bestätigen' })).not.toBeInTheDocument()
    expect(useTournamentStore.getState().tournament.teams).toHaveLength(1)
  })

  it('requires typed confirmation before adding a team once the tournament is locked', () => {
    const { addTeam, setFields } = useTournamentStore.getState()
    addTeam({ name: 'A', logoUrl: '', color: '#000', contact: '' })
    addTeam({ name: 'B', logoUrl: '', color: '#000', contact: '' })
    setFields(1)
    useTournamentStore.getState().generateAndSaveSchedule()
    const game = useTournamentStore.getState().schedule!.games[0]
    useTournamentStore.getState().submitGameResult(game.id, [{ period: 1, homeScore: 10, awayScore: 5 }])

    render(<TeamList />)
    fireEvent.click(screen.getByRole('button', { name: 'Team hinzufügen' }))

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Team C' } })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(screen.getByRole('button', { name: 'Bestätigen' })).toBeInTheDocument()
    expect(useTournamentStore.getState().tournament.teams).toHaveLength(2)

    fireEvent.change(screen.getByLabelText(/Bestätigungswort/i), { target: { value: 'ÄNDERN' } })
    fireEvent.click(screen.getByRole('button', { name: 'Bestätigen' }))
    expect(useTournamentStore.getState().tournament.teams).toHaveLength(3)
  })

  it('removes a team immediately when the tournament is not locked', () => {
    const { addTeam } = useTournamentStore.getState()
    addTeam({ name: 'A', logoUrl: '', color: '#000', contact: '' })

    render(<TeamList />)
    fireEvent.click(screen.getAllByRole('button', { name: /löschen/i })[0])

    expect(screen.queryByRole('button', { name: 'Bestätigen' })).not.toBeInTheDocument()
    expect(useTournamentStore.getState().tournament.teams).toHaveLength(0)
  })

  it('requires typed confirmation before removing a team once the tournament is locked', () => {
    const { addTeam, setFields } = useTournamentStore.getState()
    addTeam({ name: 'A', logoUrl: '', color: '#000', contact: '' })
    addTeam({ name: 'B', logoUrl: '', color: '#000', contact: '' })
    setFields(1)
    useTournamentStore.getState().generateAndSaveSchedule()
    const game = useTournamentStore.getState().schedule!.games[0]
    useTournamentStore.getState().submitGameResult(game.id, [{ period: 1, homeScore: 10, awayScore: 5 }])

    render(<TeamList />)
    fireEvent.click(screen.getAllByRole('button', { name: /löschen/i })[0])

    expect(screen.getByRole('button', { name: 'Bestätigen' })).toBeInTheDocument()
    expect(useTournamentStore.getState().tournament.teams).toHaveLength(2)

    fireEvent.change(screen.getByLabelText(/Bestätigungswort/i), { target: { value: 'ÄNDERN' } })
    fireEvent.click(screen.getByRole('button', { name: 'Bestätigen' }))
    expect(useTournamentStore.getState().tournament.teams).toHaveLength(1)
  })

  it('does not require confirmation for editing team name/logo/abbreviation/color even when locked', () => {
    const { addTeam, setFields } = useTournamentStore.getState()
    addTeam({ name: 'A', logoUrl: '', color: '#000', contact: '' })
    addTeam({ name: 'B', logoUrl: '', color: '#000', contact: '' })
    setFields(1)
    useTournamentStore.getState().generateAndSaveSchedule()
    const game = useTournamentStore.getState().schedule!.games[0]
    useTournamentStore.getState().submitGameResult(game.id, [{ period: 1, homeScore: 10, awayScore: 5 }])

    render(<TeamList />)
    fireEvent.click(screen.getAllByRole('button', { name: /bearbeiten/i })[0])
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Team A Neu' } })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(screen.queryByRole('button', { name: 'Bestätigen' })).not.toBeInTheDocument()
    expect(useTournamentStore.getState().tournament.teams[0].name).toBe('Team A Neu')
  })
})
