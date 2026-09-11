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

  it('disables the tournament and venue forms once the tournament is locked, and unlocks them after typed confirmation', () => {
    const { addTeam, setFields } = useTournamentStore.getState()
    addTeam({ name: 'A', logoUrl: '', color: '#000', contact: '' })
    addTeam({ name: 'B', logoUrl: '', color: '#000', contact: '' })
    setFields(1)
    useTournamentStore.getState().generateAndSaveSchedule()
    const game = useTournamentStore.getState().schedule!.games[0]
    useTournamentStore.getState().submitGameResult(game.id, [{ period: 1, homeScore: 10, awayScore: 5 }])

    render(<ConfigPage />)

    expect(screen.getByLabelText('Turniername')).toBeDisabled()
    expect(screen.getAllByText(/Turnier läuft bereits/).length).toBeGreaterThan(0)

    fireEvent.click(screen.getAllByRole('button', { name: 'Bearbeitung freischalten' })[0])
    fireEvent.change(screen.getByLabelText(/Bestätigungswort/i), { target: { value: 'ÄNDERN' } })
    fireEvent.click(screen.getByRole('button', { name: 'Bestätigen' }))

    expect(screen.getByLabelText('Turniername')).toBeEnabled()
  })

  it('requires typed confirmation before regenerating an already-played schedule', () => {
    const { addTeam, setFields } = useTournamentStore.getState()
    addTeam({ name: 'A', logoUrl: '', color: '#000', contact: '' })
    addTeam({ name: 'B', logoUrl: '', color: '#000', contact: '' })
    setFields(1)
    useTournamentStore.getState().generateAndSaveSchedule()
    const game = useTournamentStore.getState().schedule!.games[0]
    useTournamentStore.getState().submitGameResult(game.id, [{ period: 1, homeScore: 10, awayScore: 5 }])

    render(<ConfigPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Zeitplan generieren' }))
    expect(screen.getByRole('button', { name: 'Bestätigen' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Bestätigungswort/i), { target: { value: 'ÄNDERN' } })
    fireEvent.click(screen.getByRole('button', { name: 'Bestätigen' }))

    expect(screen.queryByRole('button', { name: 'Bestätigen' })).not.toBeInTheDocument()
  })

  it('unlocking the tournament section does not unlock the venue section', () => {
    const { addTeam, setFields } = useTournamentStore.getState()
    addTeam({ name: 'A', logoUrl: '', color: '#000', contact: '' })
    addTeam({ name: 'B', logoUrl: '', color: '#000', contact: '' })
    setFields(1)
    useTournamentStore.getState().generateAndSaveSchedule()
    const game = useTournamentStore.getState().schedule!.games[0]
    useTournamentStore.getState().submitGameResult(game.id, [{ period: 1, homeScore: 10, awayScore: 5 }])

    render(<ConfigPage />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Bearbeitung freischalten' })[0])
    fireEvent.change(screen.getByLabelText(/Bestätigungswort/i), { target: { value: 'ÄNDERN' } })
    fireEvent.click(screen.getByRole('button', { name: 'Bestätigen' }))

    expect(screen.getByLabelText('Turniername')).toBeEnabled()
    expect(screen.getByLabelText('Hallenname')).toBeDisabled()
  })

  it('imports a tournament from a JSON file, replacing the current one, when not locked', async () => {
    const { addTeam } = useTournamentStore.getState()
    addTeam({ name: 'Altes Team', logoUrl: '', color: '#000', contact: '' })

    render(<ConfigPage />)

    const file = new File(
      [JSON.stringify({
        tournament: {
          id: 'imported-1', name: 'Importiertes Turnier', mode: 'swiss', fields: 2,
          gameSettings: {
            periodsCount: 4, periodDurationMin: 5, breakBetweenPeriodsMin: 1,
            halfTimeBreakMin: 5, bufferBetweenGamesMin: 5, breakBetweenRoundsMin: 15,
            awardCeremonyMin: 15,
          },
          venue: {
            name: 'Halle', availabilityWindows: [{ start: '09:00', end: '20:00' }],
            blackoutPeriods: [], setupBufferMin: 30, teardownBufferMin: 30,
          },
          teams: [{ id: 'it1', name: 'Neues Team', logoUrl: '', color: '#000', contact: '', players: [] }],
        },
        schedule: null,
      })],
      'turnier.json',
      { type: 'application/json' },
    )

    const input = screen.getByLabelText(/JSON importieren/i) as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await screen.findByDisplayValue('Importiertes Turnier')
    expect(useTournamentStore.getState().tournament.teams).toHaveLength(1)
    expect(useTournamentStore.getState().tournament.teams[0].name).toBe('Neues Team')
  })

  it('shows an error and does not change the tournament when the imported file is invalid', async () => {
    const { addTeam } = useTournamentStore.getState()
    addTeam({ name: 'Bestehendes Team', logoUrl: '', color: '#000', contact: '' })

    render(<ConfigPage />)

    const file = new File(['not valid json'], 'kaputt.json', { type: 'application/json' })
    const input = screen.getByLabelText(/JSON importieren/i) as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByText(/kein gültiges JSON/i)).toBeInTheDocument()
    expect(useTournamentStore.getState().tournament.teams).toHaveLength(1)
    expect(useTournamentStore.getState().tournament.teams[0].name).toBe('Bestehendes Team')
  })

  it('requires typed confirmation before importing when the current tournament is locked', async () => {
    const { addTeam, setFields, generateAndSaveSchedule, submitGameResult } = useTournamentStore.getState()
    addTeam({ name: 'A', logoUrl: '', color: '#000', contact: '' })
    addTeam({ name: 'B', logoUrl: '', color: '#000', contact: '' })
    setFields(1)
    generateAndSaveSchedule()
    const game = useTournamentStore.getState().schedule!.games[0]
    submitGameResult(game.id, [{ period: 1, homeScore: 10, awayScore: 5 }])

    render(<ConfigPage />)

    const file = new File(
      [JSON.stringify({
        tournament: {
          id: 'imported-1', name: 'Importiertes Turnier', mode: 'swiss', fields: 2,
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
      })],
      'turnier.json',
      { type: 'application/json' },
    )
    const input = screen.getByLabelText(/JSON importieren/i) as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByRole('button', { name: 'Bestätigen' })).toBeInTheDocument()
    expect(useTournamentStore.getState().tournament.name).not.toBe('Importiertes Turnier')

    fireEvent.change(screen.getByLabelText(/Bestätigungswort/i), { target: { value: 'ÄNDERN' } })
    fireEvent.click(screen.getByRole('button', { name: 'Bestätigen' }))

    expect(useTournamentStore.getState().tournament.name).toBe('Importiertes Turnier')
  })
})
