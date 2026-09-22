import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { useTournamentStore } from '@/store/tournament-store'
import { clearAll } from '@/lib/storage'
import GroupOverviewPage from './GroupOverviewPage'

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

describe('GroupOverviewPage', () => {
  it('shows a message when no schedule exists yet', () => {
    render(<GroupOverviewPage />)
    expect(screen.getByText(/bitte zuerst einen zeitplan generieren/i)).toBeInTheDocument()
  })

  it('shows a tab per group and only renders the active group\'s table', () => {
    setupMultiGroupTournament()
    render(<GroupOverviewPage />)
    expect(screen.getByRole('button', { name: 'Gruppe A' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gruppe B' })).toBeInTheDocument()
    // Only one group's table/schedule is visible at a time.
    expect(screen.getAllByRole('table')).toHaveLength(1)
  })

  it('defaults to the first group (A) being active', () => {
    setupMultiGroupTournament()
    render(<GroupOverviewPage />)
    const teams = useTournamentStore.getState().tournament.teams
    const groupATeamNames = teams.filter(t => t.groupId === 'A').map(t => t.name)
    const table = screen.getByRole('table')
    for (const name of groupATeamNames) {
      expect(within(table).getByText(name)).toBeInTheDocument()
    }
  })

  it('switches to another group\'s table and schedule when its tab is clicked', () => {
    setupMultiGroupTournament()
    render(<GroupOverviewPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Gruppe B' }))

    const teams = useTournamentStore.getState().tournament.teams
    const groupBTeamNames = teams.filter(t => t.groupId === 'B').map(t => t.name)
    const table = screen.getByRole('table')
    for (const name of groupBTeamNames) {
      expect(within(table).getByText(name)).toBeInTheDocument()
    }
    const groupATeamNames = teams.filter(t => t.groupId === 'A').map(t => t.name)
    for (const name of groupATeamNames) {
      expect(within(table).queryByText(name)).not.toBeInTheDocument()
    }
  })

  it('only lists a group\'s own teams in its table', () => {
    setupMultiGroupTournament()
    render(<GroupOverviewPage />)
    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')
    // header row + 4 team rows
    expect(rows).toHaveLength(5)
  })

  it('updates points after a group-stage result is submitted', () => {
    setupMultiGroupTournament()
    const { schedule, submitGameResult, tournament } = useTournamentStore.getState()
    const game = schedule!.games.find(g => g.stage === 'group' && g.groupId === 'A')!
    submitGameResult(game.id, [{ period: 1, homeScore: 20, awayScore: 10 }])
    const winner = tournament.teams.find(t => t.id === game.homeTeamId)!

    render(<GroupOverviewPage />)
    const table = screen.getByRole('table')
    expect(within(table).getByText(winner.name)).toBeInTheDocument()
  })

  it('only shows the active group\'s schedule, filtered by round', () => {
    setupMultiGroupTournament()
    render(<GroupOverviewPage />)
    const teams = useTournamentStore.getState().tournament.teams
    const groupBTeamNames = teams.filter(t => t.groupId === 'B').map(t => t.name)
    // Group A is active by default -- none of group B's team names should appear anywhere
    // (neither in the table nor in the schedule section below it).
    for (const name of groupBTeamNames) {
      expect(screen.queryByText(name)).not.toBeInTheDocument()
    }
  })

  it('does not throw when clicking "Diese Gruppe als PDF herunterladen"', () => {
    setupMultiGroupTournament()
    render(<GroupOverviewPage />)
    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Diese Gruppe als PDF herunterladen' }))
    }).not.toThrow()
  })

  it('does not throw when clicking "Alle Gruppen als PDF herunterladen"', () => {
    setupMultiGroupTournament()
    render(<GroupOverviewPage />)
    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Alle Gruppen als PDF herunterladen' }))
    }).not.toThrow()
  })
})
