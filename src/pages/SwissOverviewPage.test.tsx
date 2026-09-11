import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { useTournamentStore } from '@/store/tournament-store'
import { clearAll } from '@/lib/storage'
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
      expect(screen.getAllByText(team.name).length).toBeGreaterThan(0)
    }
    expect(screen.getByRole('heading', { level: 3, name: 'Runde 1' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Runde 2' })).toBeInTheDocument()
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
    const winnerRow = within(table).getByText(winner.name).closest('tr')!
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
    const byeTeamRow = within(table).getByText(byeTeam.name).closest('tr')!
    const pointsCell = within(byeTeamRow).getAllByRole('cell')[2]
    expect(pointsCell).toHaveTextContent('0')
  })

  it('renders both the full team name (visible by default) and the explicit abbreviation (visible only below the md breakpoint)', () => {
    setupSwissTournament(4, 2)
    const team = useTournamentStore.getState().tournament.teams[0]
    useTournamentStore.getState().updateTeam(team.id, { abbreviation: 'XYZ' })

    render(<SwissOverviewPage />)

    const table = screen.getByRole('table')
    const fullNameEl = within(table).getByText(team.name)
    expect(fullNameEl).toHaveClass('md:inline')
    const abbreviationEl = within(table).getByText('XYZ')
    expect(abbreviationEl).toHaveClass('md:hidden')
  })

  it('shows an explanation of the sort order and buchholz calculation under the standings heading', () => {
    setupSwissTournament(4, 2)
    render(<SwissOverviewPage />)
    expect(screen.getByText(/Sortierung: 1\. Punkte, 2\. Buchholz-Zahl, 3\. Korbdifferenz/)).toBeInTheDocument()
    expect(screen.getByText(/Buchholz-Zahl ist die Summe der Punkte aller bisherigen Gegner/)).toBeInTheDocument()
    expect(screen.getByText(/bei einem Freilos zählen die eigenen Punkte/)).toBeInTheDocument()
    expect(screen.getByText(/zurückgezogen wurde, zählt die Partie nicht mit/)).toBeInTheDocument()
  })

  it('does not show a wins-draws-losses column in the standings table', () => {
    setupSwissTournament(4, 2)
    render(<SwissOverviewPage />)
    expect(screen.queryByText('S-U-N')).not.toBeInTheDocument()
  })

  it('renders a table of contents linking to the standings and each round', () => {
    setupSwissTournament(4, 2)
    render(<SwissOverviewPage />)
    const nav = screen.getByRole('navigation', { name: 'Inhalt' })
    expect(within(nav).getByRole('link', { name: 'Tabelle' })).toHaveAttribute('href', '#tabelle')
    expect(within(nav).getByRole('link', { name: 'Runde 1' })).toHaveAttribute('href', '#runde-1')
    expect(within(nav).getByRole('link', { name: 'Runde 2' })).toHaveAttribute('href', '#runde-2')
  })

  it('adds matching anchor ids to the standings heading and each round heading', () => {
    setupSwissTournament(4, 2)
    render(<SwissOverviewPage />)
    expect(screen.getByRole('heading', { level: 2, name: 'Tabelle' })).toHaveAttribute('id', 'tabelle')
    expect(screen.getByRole('heading', { level: 3, name: 'Runde 1' })).toHaveAttribute('id', 'runde-1')
    expect(screen.getByRole('heading', { level: 3, name: 'Runde 2' })).toHaveAttribute('id', 'runde-2')
  })

  it('marks the round heading right after the 15-game print threshold is crossed, and not an earlier round', () => {
    setupSwissTournament(13, 4)
    render(<SwissOverviewPage />)
    const { schedule } = useTournamentStore.getState()
    const rounds = [...new Set(schedule!.games.map(g => g.round))].sort((a, b) => a - b)
    let runningSum = 0
    let expectedBreakRound: number | null = null
    for (const round of rounds) {
      const count = schedule!.games.filter(g => g.round === round && g.field > 0).length
      if (runningSum >= 15) {
        expectedBreakRound = round
        break
      }
      runningSum += count
    }
    expect(expectedBreakRound).not.toBeNull()
    expect(screen.getByRole('heading', { level: 3, name: `Runde ${expectedBreakRound}` })).toHaveClass('print:break-before-page')
    expect(screen.getByRole('heading', { level: 3, name: 'Runde 1' })).not.toHaveClass('print:break-before-page')
  })
})
