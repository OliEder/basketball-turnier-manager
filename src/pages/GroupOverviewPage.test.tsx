import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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

  it('renders one table per group with a heading', () => {
    setupMultiGroupTournament()
    render(<GroupOverviewPage />)
    expect(screen.getByRole('heading', { name: 'Gruppe A' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Gruppe B' })).toBeInTheDocument()
    expect(screen.getAllByRole('table')).toHaveLength(2)
  })

  it('only lists a group\'s own teams in its table', () => {
    setupMultiGroupTournament()
    render(<GroupOverviewPage />)
    const tables = screen.getAllByRole('table')
    for (const table of tables) {
      const rows = within(table).getAllByRole('row')
      // header row + 4 team rows
      expect(rows).toHaveLength(5)
    }
  })

  it('updates points after a group-stage result is submitted', () => {
    setupMultiGroupTournament()
    const { schedule, submitGameResult, tournament } = useTournamentStore.getState()
    const game = schedule!.games.find(g => g.stage === 'group' && g.groupId === 'A')!
    submitGameResult(game.id, [{ period: 1, homeScore: 20, awayScore: 10 }])
    const winner = tournament.teams.find(t => t.id === game.homeTeamId)!

    render(<GroupOverviewPage />)
    const groupATable = screen.getByRole('heading', { name: 'Gruppe A' }).closest('div')!
    expect(within(groupATable).getByText(winner.name)).toBeInTheDocument()
  })
})
