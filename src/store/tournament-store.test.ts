import { describe, it, expect, beforeEach } from 'vitest'
import { useTournamentStore, getCurrentSwissRound } from './tournament-store'
import { clearAll } from '@/lib/storage'

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

describe('submitGameResult', () => {
  it('writes periodScores onto the game', () => {
    setupSwissTournament(4, 2)
    const { schedule, submitGameResult } = useTournamentStore.getState()
    const game = schedule!.games.find(g => g.round === 1)!
    submitGameResult(game.id, [{ period: 1, homeScore: 20, awayScore: 15 }])
    const updated = useTournamentStore.getState().schedule!.games.find(g => g.id === game.id)!
    expect(updated.periodScores).toEqual([{ period: 1, homeScore: 20, awayScore: 15 }])
  })

  it('throws when the game is still a placeholder without real team IDs', () => {
    setupSwissTournament(4, 2)
    const { schedule, submitGameResult } = useTournamentStore.getState()
    const placeholder = schedule!.games.find(g => g.round === 2)!
    expect(() => submitGameResult(placeholder.id, [{ period: 1, homeScore: 10, awayScore: 5 }])).toThrow(
      'Spiel hat noch keine feststehenden Teams',
    )
  })
})

describe('getCurrentSwissRound', () => {
  it('returns the highest round number that has real team assignments', () => {
    setupSwissTournament(4, 3)
    const { schedule } = useTournamentStore.getState()
    expect(getCurrentSwissRound(schedule!.games)).toBe(1)
  })
})

describe('advanceSwissRound', () => {
  it('fills in the next round once all games of the current round have results', () => {
    setupSwissTournament(4, 2)
    const { schedule, submitGameResult, advanceSwissRound } = useTournamentStore.getState()
    const round1Games = schedule!.games.filter(g => g.round === 1 && g.field > 0)
    for (const g of round1Games) {
      submitGameResult(g.id, [{ period: 1, homeScore: 20, awayScore: 10 }])
    }
    advanceSwissRound()
    const round2Games = useTournamentStore.getState().schedule!.games.filter(g => g.round === 2)
    expect(round2Games.every(g => g.homeTeamId !== null)).toBe(true)
  })

  it('throws when the current round is not fully evaluated', () => {
    setupSwissTournament(4, 2)
    const { advanceSwissRound } = useTournamentStore.getState()
    expect(() => advanceSwissRound()).toThrow('Runde ist noch nicht vollständig ausgewertet')
  })
})

describe('advanceSwissRoundManually', () => {
  it('applies manually specified pairs instead of running the algorithm', () => {
    setupSwissTournament(4, 2)
    const { schedule, submitGameResult, advanceSwissRoundManually } = useTournamentStore.getState()
    const round1Games = schedule!.games.filter(g => g.round === 1 && g.field > 0)
    for (const g of round1Games) {
      submitGameResult(g.id, [{ period: 1, homeScore: 20, awayScore: 10 }])
    }
    const teamIds = useTournamentStore.getState().tournament.teams.map(t => t.id)
    const manualPairs: [string, string][] = [[teamIds[0], teamIds[3]], [teamIds[1], teamIds[2]]]
    advanceSwissRoundManually(manualPairs)
    const round2Games = useTournamentStore.getState().schedule!.games.filter(g => g.round === 2 && g.field > 0)
    const assignedPairs = round2Games.map(g => [g.homeTeamId, g.awayTeamId])
    expect(assignedPairs).toEqual(manualPairs)
  })

  it('still requires the current round to be fully evaluated', () => {
    setupSwissTournament(4, 2)
    const { advanceSwissRoundManually } = useTournamentStore.getState()
    expect(() => advanceSwissRoundManually([['t1', 't2']])).toThrow('Runde ist noch nicht vollständig ausgewertet')
  })
})
