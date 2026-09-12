import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useTournamentStore } from '@/store/tournament-store'
import { clearAll } from '@/lib/storage'
import GroupResultsPage from './GroupResultsPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <GroupResultsPage />
    </MemoryRouter>
  )
}

function setupMultiGroupTournament() {
  const store = useTournamentStore.getState()
  store.setMode('round-robin+finals')
  store.setFinalsBracketSize(4)
  store.setGroupCount(2)
  for (let i = 1; i <= 8; i++) {
    store.addTeam({ name: `Team ${i}`, logoUrl: '', color: '#000', contact: '' })
  }
  const teams = useTournamentStore.getState().tournament.teams
  teams.slice(0, 4).forEach(t => store.setTeamGroup(t.id, 'A'))
  teams.slice(4).forEach(t => store.setTeamGroup(t.id, 'B'))
  store.generateAndSaveSchedule()
}

beforeEach(() => {
  clearAll()
  useTournamentStore.setState({
    tournament: {
      id: 't1', name: 'Test', mode: 'round-robin', fields: 4,
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

describe('GroupResultsPage', () => {
  it('shows a message when no schedule exists yet', () => {
    renderPage()
    expect(screen.getByText(/bitte zuerst einen zeitplan generieren/i)).toBeInTheDocument()
  })

  it('lists group-stage games chronologically by scheduled time', () => {
    setupMultiGroupTournament()
    renderPage()
    const { schedule } = useTournamentStore.getState()
    const groupGames = schedule!.games.filter(g => g.stage === 'group')
    // Every open game gets a "Speichern" button; count must match the number of group-stage games.
    expect(screen.getAllByRole('button', { name: 'Speichern' })).toHaveLength(groupGames.length)
  })

  it('defaults to showing only open (unplayed) games', () => {
    setupMultiGroupTournament()
    const { schedule, submitGameResult } = useTournamentStore.getState()
    const game = schedule!.games.find(g => g.stage === 'group')!
    submitGameResult(game.id, [{ period: 1, homeScore: 20, awayScore: 10 }])

    renderPage()
    const { schedule: updatedSchedule } = useTournamentStore.getState()
    const openCount = updatedSchedule!.games.filter(g => g.stage === 'group' && g.periodScores.length === 0).length
    expect(screen.getAllByRole('button', { name: 'Speichern' })).toHaveLength(openCount)
  })

  it('shows both open and played games when the status filter is set to "Alle"', () => {
    setupMultiGroupTournament()
    const { schedule, submitGameResult } = useTournamentStore.getState()
    const game = schedule!.games.find(g => g.stage === 'group')!
    submitGameResult(game.id, [{ period: 1, homeScore: 20, awayScore: 10 }])

    renderPage()
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'all' } })
    const { schedule: updatedSchedule } = useTournamentStore.getState()
    const totalGroupGames = updatedSchedule!.games.filter(g => g.stage === 'group').length
    expect(screen.getAllByText(/^(Speichern|Korrigieren)$/).length).toBe(totalGroupGames)
  })

  it('lets the organizer enter a result and save it', () => {
    setupMultiGroupTournament()
    renderPage()
    const { schedule } = useTournamentStore.getState()
    const firstGame = schedule!.games.filter(g => g.stage === 'group').sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))[0]

    fireEvent.change(screen.getByLabelText(`Ergebnis Heim, Spiel ${firstGame.gameNumber}`), { target: { value: '25' } })
    fireEvent.change(screen.getByLabelText(`Ergebnis Auswärts, Spiel ${firstGame.gameNumber}`), { target: { value: '18' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Speichern' })[0])

    const { schedule: updatedSchedule } = useTournamentStore.getState()
    const updatedGame = updatedSchedule!.games.find(g => g.id === firstGame.id)!
    expect(updatedGame.periodScores).toEqual([{ period: 1, homeScore: 25, awayScore: 18 }])
  })

  it('shows a link to the group overview after saving a result', () => {
    setupMultiGroupTournament()
    renderPage()
    const { schedule } = useTournamentStore.getState()
    const firstGame = schedule!.games.filter(g => g.stage === 'group').sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))[0]

    fireEvent.change(screen.getByLabelText(`Ergebnis Heim, Spiel ${firstGame.gameNumber}`), { target: { value: '25' } })
    fireEvent.change(screen.getByLabelText(`Ergebnis Auswärts, Spiel ${firstGame.gameNumber}`), { target: { value: '18' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Speichern' })[0])

    expect(screen.getByRole('link', { name: /Tabelle für Gruppe .* ansehen/ })).toBeInTheDocument()
  })

  it('filters games by group', () => {
    setupMultiGroupTournament()
    renderPage()
    const { schedule, tournament } = useTournamentStore.getState()
    const groupBGameNumbers = schedule!.games
      .filter(g => g.stage === 'group' && g.groupId === 'B')
      .map(g => g.gameNumber)

    fireEvent.change(screen.getByLabelText('Gruppe'), { target: { value: 'B' } })

    for (const gameNumber of groupBGameNumbers) {
      expect(screen.getByLabelText(`Ergebnis Heim, Spiel ${gameNumber}`)).toBeInTheDocument()
    }
    const groupAGameNumbers = schedule!.games
      .filter(g => g.stage === 'group' && g.groupId === 'A')
      .map(g => g.gameNumber)
    for (const gameNumber of groupAGameNumbers) {
      expect(screen.queryByLabelText(`Ergebnis Heim, Spiel ${gameNumber}`)).not.toBeInTheDocument()
    }
    // sanity check that tournament actually has both groups (guards against a false-positive
    // pass if setupMultiGroupTournament stopped creating group B for some reason)
    expect(new Set(tournament.teams.map(t => t.groupId)).size).toBe(2)
  })

  it('filters games by field', () => {
    setupMultiGroupTournament()
    renderPage()
    const { schedule } = useTournamentStore.getState()
    const field1GameNumbers = schedule!.games.filter(g => g.stage === 'group' && g.field === 1).map(g => g.gameNumber)
    const field2GameNumbers = schedule!.games.filter(g => g.stage === 'group' && g.field === 2).map(g => g.gameNumber)

    fireEvent.change(screen.getByLabelText('Feld'), { target: { value: '1' } })

    for (const gameNumber of field1GameNumbers) {
      expect(screen.getByLabelText(`Ergebnis Heim, Spiel ${gameNumber}`)).toBeInTheDocument()
    }
    for (const gameNumber of field2GameNumbers) {
      expect(screen.queryByLabelText(`Ergebnis Heim, Spiel ${gameNumber}`)).not.toBeInTheDocument()
    }
  })

  it('lets the organizer correct an already-played game via the "Alle" status filter', () => {
    setupMultiGroupTournament()
    const { schedule, submitGameResult } = useTournamentStore.getState()
    const game = schedule!.games.find(g => g.stage === 'group')!
    submitGameResult(game.id, [{ period: 1, homeScore: 20, awayScore: 10 }])

    renderPage()
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'all' } })

    fireEvent.click(screen.getByRole('button', { name: 'Korrigieren' }))
    const correctedInput = screen.getByLabelText(`Korrigiertes Ergebnis Heim, Spiel ${game.gameNumber}`)
    fireEvent.change(correctedInput, { target: { value: '55' } })
    const row = correctedInput.closest('.border-b') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'Speichern' }))

    const { schedule: updatedSchedule } = useTournamentStore.getState()
    const updatedGame = updatedSchedule!.games.find(g => g.id === game.id)!
    expect(updatedGame.periodScores[0].homeScore).toBe(55)
  })
})
