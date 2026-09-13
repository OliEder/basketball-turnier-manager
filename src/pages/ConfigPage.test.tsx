import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { useTournamentStore } from '@/store/tournament-store'
import { clearAll } from '@/lib/storage'
import ConfigPage from './ConfigPage'

function renderConfigPage() {
  return render(
    <MemoryRouter>
      <ConfigPage />
    </MemoryRouter>
  )
}

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
    renderConfigPage()
    expect(screen.getByRole('button', { name: /zeitplan generieren/i })).toBeDisabled()
    expect(screen.getByText(/mindestens 2 teams erforderlich/i)).toBeInTheDocument()
  })

  it('generates and saves a schedule when clicked with at least 2 teams', () => {
    useTournamentStore.getState().addTeam({ name: 'Team A', logoUrl: '', color: '#000', contact: '' })
    useTournamentStore.getState().addTeam({ name: 'Team B', logoUrl: '', color: '#000', contact: '' })
    renderConfigPage()

    const button = screen.getByRole('button', { name: /zeitplan generieren/i })
    expect(button).toBeEnabled()
    fireEvent.click(button)

    expect(useTournamentStore.getState().schedule).not.toBeNull()
    expect(useTournamentStore.getState().schedule!.games.length).toBeGreaterThan(0)
  })

  it('disables "Zeitplan generieren" for multiple groups without a chosen finals variant', () => {
    const { addTeam, setMode, setGroupCount } = useTournamentStore.getState()
    for (let i = 1; i <= 8; i++) addTeam({ name: `Team ${i}`, logoUrl: '', color: '#000', contact: '' })
    setMode('round-robin+finals')
    setGroupCount(4)

    renderConfigPage()

    expect(screen.getByRole('button', { name: /zeitplan generieren/i })).toBeDisabled()
    expect(screen.getByText(/endrunden-variante auswählen/i)).toBeInTheDocument()
  })

  it('enables "Zeitplan generieren" for multiple groups once a finals variant is chosen', () => {
    const { addTeam, setMode, setGroupCount, setFinalsVariant } = useTournamentStore.getState()
    for (let i = 1; i <= 8; i++) addTeam({ name: `Team ${i}`, logoUrl: '', color: '#000', contact: '' })
    setMode('round-robin+finals')
    setGroupCount(4)
    setFinalsVariant('endrunde-3')

    renderConfigPage()

    expect(screen.getByRole('button', { name: /zeitplan generieren/i })).toBeEnabled()
    expect(screen.queryByText(/endrunden-variante auswählen/i)).not.toBeInTheDocument()
  })

  it('does not require a finals variant when groupCount is 1', () => {
    const { addTeam, setMode, setGroupCount } = useTournamentStore.getState()
    addTeam({ name: 'Team A', logoUrl: '', color: '#000', contact: '' })
    addTeam({ name: 'Team B', logoUrl: '', color: '#000', contact: '' })
    setMode('round-robin+finals')
    setGroupCount(1)

    renderConfigPage()

    expect(screen.getByRole('button', { name: /zeitplan generieren/i })).toBeEnabled()
  })

  it('shows the group assignment section only in round-robin+finals mode', () => {
    useTournamentStore.getState().setMode('round-robin')
    const { unmount } = renderConfigPage()
    expect(screen.queryByText('Gruppen')).not.toBeInTheDocument()
    unmount()

    useTournamentStore.getState().setMode('round-robin+finals')
    renderConfigPage()
    expect(screen.getByText('Gruppen')).toBeInTheDocument()
  })

  it('shows a suggestion help text under "Anzahl Runden" in swiss mode', () => {
    useTournamentStore.getState().setMode('swiss')
    for (let i = 1; i <= 4; i++) {
      useTournamentStore.getState().addTeam({ name: `Team ${i}`, logoUrl: '', color: '#000', contact: '' })
    }
    renderConfigPage()

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

    renderConfigPage()

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

    renderConfigPage()

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

    renderConfigPage()

    fireEvent.click(screen.getAllByRole('button', { name: 'Bearbeitung freischalten' })[0])
    fireEvent.change(screen.getByLabelText(/Bestätigungswort/i), { target: { value: 'ÄNDERN' } })
    fireEvent.click(screen.getByRole('button', { name: 'Bestätigen' }))

    expect(screen.getByLabelText('Turniername')).toBeEnabled()
    expect(screen.getByLabelText('Hallenname')).toBeDisabled()
  })

  it('imports a tournament from a JSON file, replacing the current one, when not locked', async () => {
    const { addTeam } = useTournamentStore.getState()
    addTeam({ name: 'Altes Team', logoUrl: '', color: '#000', contact: '' })

    renderConfigPage()

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

    renderConfigPage()

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

    renderConfigPage()

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

  it('requires typing "LÖSCHEN" (not "ÄNDERN") to confirm a tournament reset', () => {
    useTournamentStore.getState().addTeam({ name: 'A', logoUrl: '', color: '#000', contact: '' })
    renderConfigPage()

    fireEvent.click(screen.getByRole('button', { name: 'Turnier zurücksetzen' }))
    expect(screen.getByRole('button', { name: 'Bestätigen' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Bestätigungswort/i), { target: { value: 'ÄNDERN' } })
    expect(screen.getByRole('button', { name: 'Bestätigen' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Bestätigungswort/i), { target: { value: 'LÖSCHEN' } })
    expect(screen.getByRole('button', { name: 'Bestätigen' })).toBeEnabled()
  })

  it('opens the reset confirmation dialog even when the tournament is not locked', () => {
    renderConfigPage()

    expect(useTournamentStore.getState().isTournamentLocked()).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Turnier zurücksetzen' }))

    expect(screen.getByRole('button', { name: 'Bestätigen' })).toBeInTheDocument()
  })

  it('downloads a JSON backup, resets the tournament and navigates to /teams on confirmed reset', () => {
    URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = vi.fn()

    const { addTeam, setFields, generateAndSaveSchedule, submitGameResult } = useTournamentStore.getState()
    addTeam({ name: 'A', logoUrl: '', color: '#000', contact: '' })
    addTeam({ name: 'B', logoUrl: '', color: '#000', contact: '' })
    setFields(1)
    generateAndSaveSchedule()
    const game = useTournamentStore.getState().schedule!.games[0]
    submitGameResult(game.id, [{ period: 1, homeScore: 10, awayScore: 5 }])

    render(
      <MemoryRouter initialEntries={['/config']}>
        <Routes>
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/teams" element={<div>Teams-Seite</div>} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Turnier zurücksetzen' }))
    fireEvent.change(screen.getByLabelText(/Bestätigungswort/i), { target: { value: 'LÖSCHEN' } })
    fireEvent.click(screen.getByRole('button', { name: 'Bestätigen' }))

    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(useTournamentStore.getState().tournament.teams).toHaveLength(0)
    expect(useTournamentStore.getState().schedule).toBeNull()
    expect(localStorage.getItem('tm_tournament')).toBeNull()
    expect(localStorage.getItem('tm_schedule')).toBeNull()
    expect(screen.getByText('Teams-Seite')).toBeInTheDocument()
  })
})
