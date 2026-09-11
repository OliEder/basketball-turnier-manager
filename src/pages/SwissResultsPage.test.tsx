import { describe, it, expect, beforeEach } from 'vitest'
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
      expect(screen.getByText(new RegExp(team.name))).toBeInTheDocument()
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
})
