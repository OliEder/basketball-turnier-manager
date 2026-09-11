import { describe, it, expect, beforeEach } from 'vitest'
import { useTournamentStore, getCurrentSwissRound, isRoundFullyEvaluated } from './tournament-store'
import { clearAll } from '@/lib/storage'
import { computeStandings } from '@/lib/standings'

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

describe('withdrawTeam', () => {
  it('marks the team as withdrawn but keeps past results', () => {
    setupSwissTournament(4, 2)
    const { schedule, submitGameResult, withdrawTeam } = useTournamentStore.getState()
    const round1Games = schedule!.games.filter(g => g.round === 1 && g.field > 0)
    for (const g of round1Games) {
      submitGameResult(g.id, [{ period: 1, homeScore: 20, awayScore: 10 }])
    }
    const teamIdToWithdraw = round1Games[0].homeTeamId!
    withdrawTeam(teamIdToWithdraw)
    const team = useTournamentStore.getState().tournament.teams.find(t => t.id === teamIdToWithdraw)!
    expect(team.withdrawnAfterRound).toBe(1)
    const playedGame = useTournamentStore.getState().schedule!.games.find(g => g.id === round1Games[0].id)!
    expect(playedGame.periodScores).toEqual([{ period: 1, homeScore: 20, awayScore: 10 }])
  })

  it('cancels an open game in the current round and credits the opponent', () => {
    setupSwissTournament(4, 2)
    const { schedule, submitGameResult, withdrawTeam } = useTournamentStore.getState()
    const round1Games = schedule!.games.filter(g => g.round === 1 && g.field > 0)
    // Only submit results for one game, leave the other open
    submitGameResult(round1Games[0].id, [{ period: 1, homeScore: 20, awayScore: 10 }])
    const openGame = round1Games[1]
    const teamToWithdraw = openGame.homeTeamId!
    const opponent = openGame.awayTeamId!
    withdrawTeam(teamToWithdraw)
    const updatedGame = useTournamentStore.getState().schedule!.games.find(g => g.id === openGame.id)!
    expect(updatedGame.cancelledReason).toBe('withdrawal')
    const standings = computeStandings(
      useTournamentStore.getState().tournament.teams,
      useTournamentStore.getState().schedule!.games,
      1,
    )
    expect(standings.find(s => s.teamId === opponent)!.points).toBe(2)
  })

  it('removes surplus placeholder slots in not-yet-drawn future rounds', () => {
    // 4 teams, 2 games per future round. After one team withdraws, only 3 active
    // teams remain, so future rounds only need 1 game (+ 1 bye) instead of 2 games.
    setupSwissTournament(4, 3)
    const { schedule, submitGameResult, withdrawTeam } = useTournamentStore.getState()
    const round1Games = schedule!.games.filter(g => g.round === 1 && g.field > 0)
    for (const g of round1Games) {
      submitGameResult(g.id, [{ period: 1, homeScore: 20, awayScore: 10 }])
    }
    const teamToWithdraw = round1Games[0].homeTeamId!
    withdrawTeam(teamToWithdraw)
    const round2Games = useTournamentStore.getState().schedule!.games.filter(g => g.round === 2 && g.field > 0)
    const round2Byes = useTournamentStore.getState().schedule!.games.filter(g => g.round === 2 && g.field === 0)
    expect(round2Games).toHaveLength(1)
    expect(round2Byes).toHaveLength(1)
    for (const g of round2Games) {
      expect(g.homeLabel).toMatch(/\(Heim\)$/)
      expect(g.awayLabel).toMatch(/\(Auswärts\)$/)
      expect(g.awayLabel).not.toBe(g.homeLabel)
    }
  })
})

describe('correctGameResult', () => {
  it('allows correcting a result before the next round has any result', () => {
    setupSwissTournament(4, 2)
    const { schedule, submitGameResult, correctGameResult } = useTournamentStore.getState()
    const game = schedule!.games.filter(g => g.round === 1 && g.field > 0)[0]
    submitGameResult(game.id, [{ period: 1, homeScore: 20, awayScore: 10 }])
    correctGameResult(game.id, [{ period: 1, homeScore: 18, awayScore: 22 }])
    const updated = useTournamentStore.getState().schedule!.games.find(g => g.id === game.id)!
    expect(updated.periodScores).toEqual([{ period: 1, homeScore: 18, awayScore: 22 }])
  })

  it('throws once the next round already has a result', () => {
    setupSwissTournament(4, 2)
    const { schedule, submitGameResult, advanceSwissRound, correctGameResult } = useTournamentStore.getState()
    const round1Games = schedule!.games.filter(g => g.round === 1 && g.field > 0)
    for (const g of round1Games) {
      submitGameResult(g.id, [{ period: 1, homeScore: 20, awayScore: 10 }])
    }
    advanceSwissRound()
    const round2Game = useTournamentStore.getState().schedule!.games.filter(g => g.round === 2 && g.field > 0)[0]
    useTournamentStore.getState().submitGameResult(round2Game.id, [{ period: 1, homeScore: 15, awayScore: 12 }])
    expect(() =>
      correctGameResult(round1Games[0].id, [{ period: 1, homeScore: 5, awayScore: 30 }])
    ).toThrow('Ergebnis kann nicht mehr korrigiert werden')
  })
})

describe('setSwissRounds', () => {
  it('updates swissRounds on the tournament', () => {
    const { setSwissRounds } = useTournamentStore.getState()
    setSwissRounds(4)
    expect(useTournamentStore.getState().tournament.swissRounds).toBe(4)
  })
})

describe('isRoundFullyEvaluated', () => {
  it('is exported and reports whether a round has every game decided', () => {
    const { setMode, addTeam, setFields, generateAndSaveSchedule, submitGameResult } = useTournamentStore.getState()
    setMode('swiss')
    addTeam({ name: 'A', logoUrl: '', color: '#000', contact: '' })
    addTeam({ name: 'B', logoUrl: '', color: '#000', contact: '' })
    setFields(1)
    generateAndSaveSchedule()
    const game = useTournamentStore.getState().schedule!.games[0]
    expect(isRoundFullyEvaluated(useTournamentStore.getState().schedule!.games, 1)).toBe(false)
    submitGameResult(game.id, [{ period: 1, homeScore: 10, awayScore: 5 }])
    expect(isRoundFullyEvaluated(useTournamentStore.getState().schedule!.games, 1)).toBe(true)
  })
})
