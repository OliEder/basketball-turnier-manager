import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useTournamentStore } from '@/store/tournament-store'
import { clearAll } from '@/lib/storage'
import { getTeamAbbreviation } from '@/lib/utils'
import SwissResultsPage from './SwissResultsPage'

function setupSwissTournament(teamCount: number, swissRounds: number) {
  const store = useTournamentStore.getState()
  store.setMode('swiss')
  for (let i = 1; i <= teamCount; i++) {
    store.addTeam({ name: `Team ${i}`, logoUrl: '', color: '#000', contact: '' })
  }
  useTournamentStore.setState(s => ({
    tournament: { ...s.tournament, swissRounds, teams: s.tournament.teams.slice(-teamCount) },
  }))
  store.generateAndSaveSchedule()
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

describe('SwissResultsPage', () => {
  it('shows a message when no schedule exists yet', () => {
    render(<SwissResultsPage />)
    expect(screen.getByText(/bitte zuerst einen zeitplan generieren/i)).toBeInTheDocument()
  })

  it('renders round 1 with both full team names visible by default for a game', () => {
    setupSwissTournament(4, 2)
    render(<SwissResultsPage />)
    expect(screen.getByText(/runde 1 von 2/i)).toBeInTheDocument()
    const teams = useTournamentStore.getState().tournament.teams
    for (const team of teams) {
      expect(screen.getAllByText(team.name).length).toBeGreaterThan(0)
    }
  })

  it('renders the full team name (visible by default) in the score row even when an explicit abbreviation is set', () => {
    setupSwissTournament(4, 2)
    const game = useTournamentStore.getState().schedule!.games.find(g => g.round === 1 && g.field > 0)!
    const homeTeam = useTournamentStore.getState().tournament.teams.find(t => t.id === game.homeTeamId)!
    useTournamentStore.getState().updateTeam(homeTeam.id, { abbreviation: 'TMA' })

    render(<SwissResultsPage />)

    expect(screen.getByText(homeTeam.name)).toHaveClass('md:inline')
    expect(screen.getByText('TMA', { selector: '[data-team-name="abbreviation"]' })).toHaveClass('md:hidden')
  })

  it('shows a checkmark once both score fields of a row are filled, without writing to the store yet', () => {
    setupSwissTournament(4, 2)
    render(<SwissResultsPage />)
    const game = useTournamentStore.getState().schedule!.games.find(g => g.round === 1 && g.field > 0)!

    expect(screen.queryByLabelText(`Ergebnis erfasst, Spiel ${game.gameNumber}`)).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(`Ergebnis Heim, Spiel ${game.gameNumber}`), { target: { value: '20' } })
    expect(screen.queryByLabelText(`Ergebnis erfasst, Spiel ${game.gameNumber}`)).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(`Ergebnis Auswärts, Spiel ${game.gameNumber}`), { target: { value: '15' } })
    expect(screen.getByLabelText(`Ergebnis erfasst, Spiel ${game.gameNumber}`)).toBeInTheDocument()

    const updated = useTournamentStore.getState().schedule!.games.find(g => g.id === game.id)!
    expect(updated.periodScores).toEqual([])
  })

  it('disables "Nächste Runde auslosen" until every game of the round has both scores entered', () => {
    setupSwissTournament(4, 2)
    render(<SwissResultsPage />)
    const games = useTournamentStore.getState().schedule!.games.filter(g => g.round === 1 && g.field > 0)
    expect(games.length).toBeGreaterThan(1)

    const advanceButton = screen.getByRole('button', { name: /nächste runde auslosen/i })
    expect(advanceButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText(`Ergebnis Heim, Spiel ${games[0].gameNumber}`), { target: { value: '20' } })
    fireEvent.change(screen.getByLabelText(`Ergebnis Auswärts, Spiel ${games[0].gameNumber}`), { target: { value: '15' } })
    expect(advanceButton).toBeDisabled()
  })

  it('commits all pending scores and advances the round in a single click', () => {
    setupSwissTournament(4, 2)
    render(<SwissResultsPage />)
    const games = useTournamentStore.getState().schedule!.games.filter(g => g.round === 1 && g.field > 0)

    for (const g of games) {
      fireEvent.change(screen.getByLabelText(`Ergebnis Heim, Spiel ${g.gameNumber}`), { target: { value: '20' } })
      fireEvent.change(screen.getByLabelText(`Ergebnis Auswärts, Spiel ${g.gameNumber}`), { target: { value: '10' } })
    }

    const advanceButton = screen.getByRole('button', { name: /nächste runde auslosen/i })
    expect(advanceButton).toBeEnabled()
    fireEvent.click(advanceButton)

    for (const g of games) {
      const updated = useTournamentStore.getState().schedule!.games.find(x => x.id === g.id)!
      expect(updated.periodScores).toEqual([{ period: 1, homeScore: 20, awayScore: 10 }])
    }
    const round2Games = useTournamentStore.getState().schedule!.games.filter(g => g.round === 2 && g.field > 0)
    expect(round2Games.every(g => g.homeTeamId !== null)).toBe(true)
  })

  it('shows a manual pairing dialog when no valid automatic pairing remains, and applies the chosen pairs', () => {
    setupSwissTournament(4, 5)
    const teamIds = useTournamentStore.getState().tournament.teams.map(t => t.id)
    const [a, b, c, d] = teamIds

    const { schedule } = useTournamentStore.getState()
    const template = schedule!.games.find(g => g.round === 1 && g.field > 0)!
    const allPairs: [string, string][] = [[a, b], [a, c], [a, d], [b, c], [b, d], [c, d]]
    const playedGames = allPairs.map((pair, i) => ({
      ...template,
      id: `played-${i}`,
      round: 1,
      gameNumber: 1000 + i,
      homeTeamId: pair[0],
      awayTeamId: pair[1],
      periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }],
    }))
    const round1Placeholders = schedule!.games.filter(g => g.round === 1)
    const otherGames = schedule!.games.filter(g => g.round !== 1)
    useTournamentStore.setState(s => ({
      schedule: { ...s.schedule!, games: [...playedGames, ...round1Placeholders.map(g => ({ ...g, homeTeamId: a, awayTeamId: b, periodScores: [{ period: 1, homeScore: 1, awayScore: 0 }] })), ...otherGames] },
    }))

    render(<SwissResultsPage />)
    fireEvent.click(screen.getByRole('button', { name: /nächste runde auslosen/i }))

    expect(screen.getByText(/automatische paarung nicht möglich/i)).toBeInTheDocument()

    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: teamIds[1] } })
    fireEvent.change(selects[2], { target: { value: teamIds[3] } })
    fireEvent.click(screen.getByRole('button', { name: /paarungen übernehmen/i }))

    expect(screen.queryByText(/automatische paarung nicht möglich/i)).not.toBeInTheDocument()
    const round2Games = useTournamentStore.getState().schedule!.games.filter(g => g.round === 2 && g.field > 0)
    const assignedPairs = round2Games.map(g => [g.homeTeamId, g.awayTeamId])
    expect(assignedPairs).toEqual([[teamIds[0], teamIds[1]], [teamIds[2], teamIds[3]]])
  })

  it('lets the organizer correct an already-entered score', () => {
    setupSwissTournament(4, 2)
    const game = useTournamentStore.getState().schedule!.games.find(g => g.round === 1 && g.field > 0)!
    useTournamentStore.getState().submitGameResult(game.id, [{ period: 1, homeScore: 20, awayScore: 15 }])

    render(<SwissResultsPage />)
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: /korrigieren/i })[0])
    const homeInput = screen.getByLabelText(`Korrigiertes Ergebnis Heim, Spiel ${game.gameNumber}`)
    fireEvent.change(homeInput, { target: { value: '30' } })
    fireEvent.click(screen.getAllByRole('button', { name: /speichern/i })[0])

    const updated = useTournamentStore.getState().schedule!.games.find(g => g.id === game.id)!
    expect(updated.periodScores).toEqual([{ period: 1, homeScore: 30, awayScore: 15 }])
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
  })

  it('does not write NaN into the schedule if the save button were somehow triggered with an invalid correction input', () => {
    setupSwissTournament(4, 2)
    const game = useTournamentStore.getState().schedule!.games.find(g => g.round === 1 && g.field > 0)!
    useTournamentStore.getState().submitGameResult(game.id, [{ period: 1, homeScore: 20, awayScore: 15 }])

    render(<SwissResultsPage />)
    fireEvent.click(screen.getAllByRole('button', { name: /korrigieren/i })[0])
    const homeInput = screen.getByLabelText(`Korrigiertes Ergebnis Heim, Spiel ${game.gameNumber}`)
    fireEvent.change(homeInput, { target: { value: '' } })

    const saveButton = screen.getAllByRole('button', { name: /speichern/i })[0]
    expect(saveButton).toBeDisabled()

    const unchanged = useTournamentStore.getState().schedule!.games.find(g => g.id === game.id)!
    expect(unchanged.periodScores).toEqual([{ period: 1, homeScore: 20, awayScore: 15 }])
  })

  it('surfaces an error when correction is no longer allowed because the next round already has a result', () => {
    setupSwissTournament(4, 2)
    const { schedule, submitGameResult, advanceSwissRound } = useTournamentStore.getState()
    const round1Games = schedule!.games.filter(g => g.round === 1 && g.field > 0)
    for (const g of round1Games) {
      submitGameResult(g.id, [{ period: 1, homeScore: 20, awayScore: 10 }])
    }
    advanceSwissRound()
    const round2Game = useTournamentStore.getState().schedule!.games.find(g => g.round === 2 && g.field > 0)!
    useTournamentStore.getState().submitGameResult(round2Game.id, [{ period: 1, homeScore: 5, awayScore: 5 }])

    expect(() =>
      useTournamentStore.getState().correctGameResult(round1Games[0].id, [{ period: 1, homeScore: 1, awayScore: 1 }])
    ).toThrow('Ergebnis kann nicht mehr korrigiert werden — die nächste Runde wurde bereits ausgewertet')
  })

  it('shows the active round with no non-active-round warning right after advancing', () => {
    setupSwissTournament(4, 2)
    render(<SwissResultsPage />)
    const games = useTournamentStore.getState().schedule!.games.filter(g => g.round === 1 && g.field > 0)
    for (const g of games) {
      fireEvent.change(screen.getByLabelText(`Ergebnis Heim, Spiel ${g.gameNumber}`), { target: { value: '20' } })
      fireEvent.change(screen.getByLabelText(`Ergebnis Auswärts, Spiel ${g.gameNumber}`), { target: { value: '10' } })
    }
    fireEvent.click(screen.getByRole('button', { name: /nächste runde auslosen/i }))

    expect(screen.getByText(/runde 2 von 2/i)).toBeInTheDocument()
    expect(screen.queryByText(/bereits abgeschlossene runde/i)).not.toBeInTheDocument()
  })

  it('lets the organizer navigate back to a completed round and shows a clear non-active-round indicator', () => {
    setupSwissTournament(4, 2)
    render(<SwissResultsPage />)
    const round1Games = useTournamentStore.getState().schedule!.games.filter(g => g.round === 1 && g.field > 0)
    for (const g of round1Games) {
      fireEvent.change(screen.getByLabelText(`Ergebnis Heim, Spiel ${g.gameNumber}`), { target: { value: '20' } })
      fireEvent.change(screen.getByLabelText(`Ergebnis Auswärts, Spiel ${g.gameNumber}`), { target: { value: '10' } })
    }
    fireEvent.click(screen.getByRole('button', { name: /nächste runde auslosen/i }))

    fireEvent.click(screen.getByRole('button', { name: /^runde 1$/i }))

    expect(screen.getByText(/bereits abgeschlossene runde/i)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /korrigieren/i }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /nächste runde auslosen/i })).not.toBeInTheDocument()
  })

  it('returns to the active round in one click from a past round view', () => {
    setupSwissTournament(4, 2)
    render(<SwissResultsPage />)
    const round1Games = useTournamentStore.getState().schedule!.games.filter(g => g.round === 1 && g.field > 0)
    for (const g of round1Games) {
      fireEvent.change(screen.getByLabelText(`Ergebnis Heim, Spiel ${g.gameNumber}`), { target: { value: '20' } })
      fireEvent.change(screen.getByLabelText(`Ergebnis Auswärts, Spiel ${g.gameNumber}`), { target: { value: '10' } })
    }
    fireEvent.click(screen.getByRole('button', { name: /nächste runde auslosen/i }))
    fireEvent.click(screen.getByRole('button', { name: /^runde 1$/i }))
    expect(screen.getByText(/bereits abgeschlossene runde/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /zur aktuellen runde/i }))

    expect(screen.queryByText(/bereits abgeschlossene runde/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Turnier abschließen' })).toBeInTheDocument()
  })

  it('lets the organizer correct a result of a past round after navigating back to it', () => {
    setupSwissTournament(4, 2)
    render(<SwissResultsPage />)
    const round1Games = useTournamentStore.getState().schedule!.games.filter(g => g.round === 1 && g.field > 0)
    for (const g of round1Games) {
      fireEvent.change(screen.getByLabelText(`Ergebnis Heim, Spiel ${g.gameNumber}`), { target: { value: '20' } })
      fireEvent.change(screen.getByLabelText(`Ergebnis Auswärts, Spiel ${g.gameNumber}`), { target: { value: '10' } })
    }
    fireEvent.click(screen.getByRole('button', { name: /nächste runde auslosen/i }))
    fireEvent.click(screen.getByRole('button', { name: /^runde 1$/i }))

    fireEvent.click(screen.getAllByRole('button', { name: /korrigieren/i })[0])
    const homeInput = screen.getByLabelText(`Korrigiertes Ergebnis Heim, Spiel ${round1Games[0].gameNumber}`)
    fireEvent.change(homeInput, { target: { value: '30' } })
    fireEvent.click(screen.getAllByRole('button', { name: /speichern/i })[0])

    const updated = useTournamentStore.getState().schedule!.games.find(g => g.id === round1Games[0].id)!
    expect(updated.periodScores).toEqual([{ period: 1, homeScore: 30, awayScore: 10 }])
  })

  it('marks a team withdrawn and cancels its open game when the organizer confirms', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    setupSwissTournament(4, 2)
    render(<SwissResultsPage />)
    const game = useTournamentStore.getState().schedule!.games.find(g => g.round === 1 && g.field > 0)!
    const team = useTournamentStore.getState().tournament.teams.find(t => t.id === game.homeTeamId)!
    const teamAbbreviation = getTeamAbbreviation(team)

    fireEvent.click(screen.getByRole('button', { name: `${teamAbbreviation} zurückziehen` }))

    const updatedTeam = useTournamentStore.getState().tournament.teams.find(t => t.id === game.homeTeamId)!
    expect(updatedTeam.withdrawnAfterRound).toBe(1)
    const updatedGame = useTournamentStore.getState().schedule!.games.find(g => g.id === game.id)!
    expect(updatedGame.cancelledReason).toBe('withdrawal')
  })

  it('shows the score as 0:0 with no editable inputs once a game is cancelled by a withdrawal', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    setupSwissTournament(4, 2)
    render(<SwissResultsPage />)
    const teams = useTournamentStore.getState().tournament.teams
    const game = useTournamentStore.getState().schedule!.games.find(g => g.round === 1 && g.field > 0)!
    const teamAbbreviation = getTeamAbbreviation(teams.find(t => t.id === game.homeTeamId)!)

    fireEvent.click(screen.getByRole('button', { name: `${teamAbbreviation} zurückziehen` }))

    expect(screen.queryByLabelText(`Ergebnis Heim, Spiel ${game.gameNumber}`)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(`Ergebnis Auswärts, Spiel ${game.gameNumber}`)).not.toBeInTheDocument()
  })

  it('shows a solid red withdrawn badge instead of the withdraw button once a team has been withdrawn', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    setupSwissTournament(4, 2)
    render(<SwissResultsPage />)
    const teams = useTournamentStore.getState().tournament.teams
    const game = useTournamentStore.getState().schedule!.games.find(g => g.round === 1 && g.field > 0)!
    const teamAbbreviation = getTeamAbbreviation(teams.find(t => t.id === game.homeTeamId)!)

    fireEvent.click(screen.getByRole('button', { name: `${teamAbbreviation} zurückziehen` }))

    expect(screen.queryByRole('button', { name: `${teamAbbreviation} zurückziehen` })).not.toBeInTheDocument()
    const badge = screen.getByText(`${teamAbbreviation} zurückgezogen`)
    expect(badge).toHaveClass('bg-destructive')
  })

  it('keeps the "Turnier abschließen" button visible and clickable after typing the last score of the final round, and only shows "Turnier abgeschlossen" once those scores are actually saved', () => {
    setupSwissTournament(4, 1)
    render(<SwissResultsPage />)
    const games = useTournamentStore.getState().schedule!.games.filter(g => g.round === 1 && g.field > 0)

    for (const g of games) {
      fireEvent.change(screen.getByLabelText(`Ergebnis Heim, Spiel ${g.gameNumber}`), { target: { value: '20' } })
      fireEvent.change(screen.getByLabelText(`Ergebnis Auswärts, Spiel ${g.gameNumber}`), { target: { value: '10' } })
    }

    expect(screen.queryByText(/turnier abgeschlossen/i)).not.toBeInTheDocument()
    const advanceButton = screen.getByRole('button', { name: 'Turnier abschließen' })
    expect(advanceButton).toBeEnabled()

    for (const g of games) {
      const stored = useTournamentStore.getState().schedule!.games.find(x => x.id === g.id)!
      expect(stored.periodScores).toEqual([])
    }

    fireEvent.click(advanceButton)

    for (const g of games) {
      const stored = useTournamentStore.getState().schedule!.games.find(x => x.id === g.id)!
      expect(stored.periodScores).toEqual([{ period: 1, homeScore: 20, awayScore: 10 }])
    }
    expect(screen.getByText(/turnier abgeschlossen/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Turnier abschließen' })).not.toBeInTheDocument()
  })

  it('labels the advance button "Nächste Runde auslosen" on a non-final round', () => {
    setupSwissTournament(4, 2)
    render(<SwissResultsPage />)
    expect(screen.getByRole('button', { name: 'Nächste Runde auslosen' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Turnier abschließen' })).not.toBeInTheDocument()
  })

  it('does not show the withdrawn badge on a past round where the team actually played a real game', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    setupSwissTournament(4, 2)
    render(<SwissResultsPage />)
    const round1Games = useTournamentStore.getState().schedule!.games.filter(g => g.round === 1 && g.field > 0)
    round1Games.forEach((g, i) => {
      fireEvent.change(screen.getByLabelText(`Ergebnis Heim, Spiel ${g.gameNumber}`), { target: { value: String(20 + i) } })
      fireEvent.change(screen.getByLabelText(`Ergebnis Auswärts, Spiel ${g.gameNumber}`), { target: { value: String(10 + i) } })
    })
    fireEvent.click(screen.getByRole('button', { name: /nächste runde auslosen/i }))

    const teams = useTournamentStore.getState().tournament.teams
    const round2Game = useTournamentStore.getState().schedule!.games.find(g => g.round === 2 && g.field > 0)!
    const teamAbbreviation = getTeamAbbreviation(teams.find(t => t.id === round2Game.homeTeamId)!)
    fireEvent.click(screen.getByRole('button', { name: `${teamAbbreviation} zurückziehen` }))

    fireEvent.click(screen.getByRole('button', { name: /^runde 1$/i }))

    expect(screen.queryByText(`${teamAbbreviation} zurückgezogen`)).not.toBeInTheDocument()
    const round1Game = useTournamentStore.getState().schedule!.games.find(
      g => g.round === 1 && (g.homeTeamId === round2Game.homeTeamId || g.awayTeamId === round2Game.homeTeamId)
    )!
    expect(screen.getByRole('button', { name: `${teamAbbreviation} zurückziehen` })).toBeInTheDocument()
    expect(screen.getByText(String(round1Game.periodScores[0].homeScore))).toBeInTheDocument()
    expect(screen.getByText(String(round1Game.periodScores[0].awayScore))).toBeInTheDocument()
  })
})
