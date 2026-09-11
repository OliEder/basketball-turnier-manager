import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useTournamentStore } from '@/store/tournament-store'
import { clearAll } from '@/lib/storage'
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

  it('renders round 1 with both team names for a game', () => {
    setupSwissTournament(4, 2)
    render(<SwissResultsPage />)
    expect(screen.getByText(/runde 1 von 2/i)).toBeInTheDocument()
    const teams = useTournamentStore.getState().tournament.teams
    for (const team of teams) {
      expect(screen.getAllByText(new RegExp(team.name)).length).toBeGreaterThan(0)
    }
  })

  it('submits a score and shows the saved result instead of inputs', () => {
    setupSwissTournament(4, 2)
    render(<SwissResultsPage />)
    const game = useTournamentStore.getState().schedule!.games.find(g => g.round === 1 && g.field > 0)!

    fireEvent.change(screen.getByLabelText(`Ergebnis Heim, Spiel ${game.gameNumber}`), { target: { value: '20' } })
    fireEvent.change(screen.getByLabelText(`Ergebnis Auswärts, Spiel ${game.gameNumber}`), { target: { value: '15' } })
    fireEvent.click(screen.getAllByRole('button', { name: /speichern/i })[0])

    const updated = useTournamentStore.getState().schedule!.games.find(g => g.id === game.id)!
    expect(updated.periodScores).toEqual([{ period: 1, homeScore: 20, awayScore: 15 }])
    expect(screen.getByText('20 : 15')).toBeInTheDocument()
    expect(screen.queryByLabelText(`Ergebnis Heim, Spiel ${game.gameNumber}`)).not.toBeInTheDocument()
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
    expect(screen.getByText('20 : 15')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: /korrigieren/i })[0])
    const homeInput = screen.getByLabelText(`Korrigiertes Ergebnis Heim, Spiel ${game.gameNumber}`)
    fireEvent.change(homeInput, { target: { value: '30' } })
    fireEvent.click(screen.getAllByRole('button', { name: /speichern/i })[0])

    const updated = useTournamentStore.getState().schedule!.games.find(g => g.id === game.id)!
    expect(updated.periodScores).toEqual([{ period: 1, homeScore: 30, awayScore: 15 }])
    expect(screen.getByText('30 : 15')).toBeInTheDocument()
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

  it('marks a team withdrawn and cancels its open game when the organizer confirms', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    setupSwissTournament(4, 2)
    render(<SwissResultsPage />)
    const game = useTournamentStore.getState().schedule!.games.find(g => g.round === 1 && g.field > 0)!
    const teamName = useTournamentStore.getState().tournament.teams.find(t => t.id === game.homeTeamId)!.name

    fireEvent.click(screen.getByRole('button', { name: `${teamName} ausgeschieden` }))

    const team = useTournamentStore.getState().tournament.teams.find(t => t.id === game.homeTeamId)!
    expect(team.withdrawnAfterRound).toBe(1)
    const updatedGame = useTournamentStore.getState().schedule!.games.find(g => g.id === game.id)!
    expect(updatedGame.cancelledReason).toBe('withdrawal')
  })
})
