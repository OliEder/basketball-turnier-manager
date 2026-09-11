import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { useTournamentStore } from '@/store/tournament-store'
import { clearAll } from '@/lib/storage'
import { getTeamAbbreviation } from '@/lib/utils'
import SwissOverviewPage from './SwissOverviewPage'

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

describe('SwissOverviewPage', () => {
  it('shows a message when no schedule exists yet', () => {
    render(<SwissOverviewPage />)
    expect(screen.getByText(/bitte zuerst einen zeitplan generieren/i)).toBeInTheDocument()
  })

  it('renders standings for all teams and the schedule grouped by round', () => {
    setupSwissTournament(4, 2)
    render(<SwissOverviewPage />)
    const teams = useTournamentStore.getState().tournament.teams
    for (const team of teams) {
      const abbrev = getTeamAbbreviation(team)
      expect(screen.getAllByText(new RegExp(`^${abbrev}$`)).length).toBeGreaterThan(0)
    }
    expect(screen.getByText('Runde 1')).toBeInTheDocument()
    expect(screen.getByText('Runde 2')).toBeInTheDocument()
  })

  it('opens a printable blob URL when clicking "Drucken"', () => {
    setupSwissTournament(4, 2)
    URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = vi.fn()
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)

    render(<SwissOverviewPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Drucken' }))

    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(openSpy).toHaveBeenCalledWith('blob:mock-url', '_blank')
  })

  it('updates points in the standings after a result is submitted', () => {
    setupSwissTournament(4, 2)
    const { schedule, submitGameResult, tournament } = useTournamentStore.getState()
    const round1Games = schedule!.games.filter(g => g.round === 1 && g.field > 0)
    for (const g of round1Games) {
      submitGameResult(g.id, [{ period: 1, homeScore: 20, awayScore: 10 }])
    }
    const game = round1Games[0]
    const winner = tournament.teams.find(t => t.id === game.homeTeamId)!

    render(<SwissOverviewPage />)
    const table = screen.getByRole('table')
    const winnerRow = within(table).getByText(getTeamAbbreviation(winner)).closest('tr')!
    expect(winnerRow).toHaveTextContent('2')
  })

  it('does not count a bye from an already-drawn future round that has not been played yet', () => {
    setupSwissTournament(5, 3)
    const store = useTournamentStore.getState()
    let { schedule } = store
    const round1Games = schedule!.games.filter(g => g.round === 1 && g.field > 0)
    for (const g of round1Games) {
      store.submitGameResult(g.id, [{ period: 1, homeScore: 20, awayScore: 10 }])
    }
    store.advanceSwissRound()

    ;({ schedule } = useTournamentStore.getState())
    const round2Bye = schedule!.games.find(g => g.round === 2 && g.byeTeamId)
    expect(round2Bye).toBeDefined()
    const byeTeam = useTournamentStore.getState().tournament.teams.find(t => t.id === round2Bye!.byeTeamId)!

    render(<SwissOverviewPage />)
    const table = screen.getByRole('table')
    const byeTeamRow = within(table).getByText(getTeamAbbreviation(byeTeam)).closest('tr')!
    const pointsCell = within(byeTeamRow).getAllByRole('cell')[2]
    expect(pointsCell).toHaveTextContent('0')
  })

  it('shows an explicitly set team abbreviation instead of the derived one', () => {
    setupSwissTournament(4, 2)
    const team = useTournamentStore.getState().tournament.teams[0]
    useTournamentStore.getState().updateTeam(team.id, { abbreviation: 'XYZ' })

    render(<SwissOverviewPage />)

    const table = screen.getByRole('table')
    expect(within(table).getByText('XYZ')).toBeInTheDocument()
    expect(within(table).queryByText(team.name)).not.toBeInTheDocument()
  })
})
