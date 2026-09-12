import { describe, it, expect, beforeEach } from 'vitest'
import { useTournamentStore, getCurrentSwissRound, isRoundFullyEvaluated } from './tournament-store'
import { clearAll } from '@/lib/storage'
import { computeStandings } from '@/lib/standings'
import { computeGroupStandings } from '@/lib/group-standings'
import type { TournamentConfig } from '@/types'

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
    expect(updatedGame.periodScores).toEqual([{ period: 1, homeScore: 0, awayScore: 0 }])
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

describe('importTournament', () => {
  it('replaces the current tournament and schedule with the imported ones', () => {
    const { addTeam, importTournament } = useTournamentStore.getState()
    addTeam({ name: 'Old Team', logoUrl: '', color: '#000', contact: '' })

    const importedTournament: TournamentConfig = {
      id: 'imported-1', name: 'Importiertes Turnier', mode: 'swiss', fields: 3,
      gameSettings: {
        periodsCount: 4, periodDurationMin: 5, breakBetweenPeriodsMin: 1,
        halfTimeBreakMin: 5, bufferBetweenGamesMin: 5, breakBetweenRoundsMin: 15,
        awardCeremonyMin: 15,
      },
      venue: {
        name: 'Importierte Halle', availabilityWindows: [{ start: '09:00', end: '20:00' }],
        blackoutPeriods: [], setupBufferMin: 30, teardownBufferMin: 30,
      },
      teams: [{ id: 'it1', name: 'Imported Team', logoUrl: '', color: '#000', contact: '', players: [] }],
    }
    importTournament(importedTournament, null)

    const state = useTournamentStore.getState()
    expect(state.tournament.name).toBe('Importiertes Turnier')
    expect(state.tournament.teams).toHaveLength(1)
    expect(state.tournament.teams[0].name).toBe('Imported Team')
    expect(state.schedule).toBeNull()
  })

  it('clears a pre-existing schedule from localStorage when importing with schedule set to null', () => {
    const { addTeam, setFields, generateAndSaveSchedule, importTournament } = useTournamentStore.getState()
    addTeam({ name: 'A', logoUrl: '', color: '#000', contact: '' })
    addTeam({ name: 'B', logoUrl: '', color: '#000', contact: '' })
    setFields(1)
    generateAndSaveSchedule()
    expect(localStorage.getItem('tm_schedule')).not.toBeNull()

    const importedTournament: TournamentConfig = {
      id: 'imported-1', name: 'Importiertes Turnier', mode: 'swiss', fields: 3,
      gameSettings: {
        periodsCount: 4, periodDurationMin: 5, breakBetweenPeriodsMin: 1,
        halfTimeBreakMin: 5, bufferBetweenGamesMin: 5, breakBetweenRoundsMin: 15,
        awardCeremonyMin: 15,
      },
      venue: {
        name: 'Importierte Halle', availabilityWindows: [{ start: '09:00', end: '20:00' }],
        blackoutPeriods: [], setupBufferMin: 30, teardownBufferMin: 30,
      },
      teams: [{ id: 'it1', name: 'Imported Team', logoUrl: '', color: '#000', contact: '', players: [] }],
    }
    importTournament(importedTournament, null)

    expect(localStorage.getItem('tm_schedule')).toBeNull()
  })
})

describe('isTournamentLocked', () => {
  it('is false when no schedule exists', () => {
    expect(useTournamentStore.getState().isTournamentLocked()).toBe(false)
  })

  it('is false when a schedule exists but no result has been entered', () => {
    const { addTeam, setFields } = useTournamentStore.getState()
    addTeam({ name: 'A', logoUrl: '', color: '#000', contact: '' })
    addTeam({ name: 'B', logoUrl: '', color: '#000', contact: '' })
    setFields(1)
    useTournamentStore.getState().generateAndSaveSchedule()
    expect(useTournamentStore.getState().isTournamentLocked()).toBe(false)
  })

  it('is true once at least one result has been entered', () => {
    const { addTeam, setFields } = useTournamentStore.getState()
    addTeam({ name: 'A', logoUrl: '', color: '#000', contact: '' })
    addTeam({ name: 'B', logoUrl: '', color: '#000', contact: '' })
    setFields(1)
    useTournamentStore.getState().generateAndSaveSchedule()
    const game = useTournamentStore.getState().schedule!.games[0]
    useTournamentStore.getState().submitGameResult(game.id, [{ period: 1, homeScore: 10, awayScore: 5 }])
    expect(useTournamentStore.getState().isTournamentLocked()).toBe(true)
  })
})

describe('multi-group configuration', () => {
  it('setGroupCount updates tournament.groupCount', () => {
    useTournamentStore.getState().setGroupCount(3)
    expect(useTournamentStore.getState().tournament.groupCount).toBe(3)
  })

  it('setDoubleRoundRobin updates tournament.doubleRoundRobin', () => {
    useTournamentStore.getState().setDoubleRoundRobin(true)
    expect(useTournamentStore.getState().tournament.doubleRoundRobin).toBe(true)
  })

  it('setTeamGroup updates a specific team\'s groupId', () => {
    const { addTeam } = useTournamentStore.getState()
    addTeam({ name: 'Team A', logoUrl: '', color: '#000', contact: '' })
    const teamId = useTournamentStore.getState().tournament.teams[0].id
    useTournamentStore.getState().setTeamGroup(teamId, 'B')
    expect(useTournamentStore.getState().tournament.teams[0].groupId).toBe('B')
  })

  it('setGroupCount reassigns teams whose groupId is now out of range to the last valid group', () => {
    const { addTeam, setGroupCount, setTeamGroup } = useTournamentStore.getState()
    addTeam({ name: 'Team A', logoUrl: '', color: '#000', contact: '' })
    setGroupCount(3)
    const teamId = useTournamentStore.getState().tournament.teams[0].id
    setTeamGroup(teamId, 'C')
    setGroupCount(2)
    expect(useTournamentStore.getState().tournament.teams[0].groupId).toBe('B')
  })

  it('setGroupCount leaves teams with an already-valid groupId untouched', () => {
    const { addTeam, setGroupCount, setTeamGroup } = useTournamentStore.getState()
    addTeam({ name: 'Team A', logoUrl: '', color: '#000', contact: '' })
    setGroupCount(3)
    const teamId = useTournamentStore.getState().tournament.teams[0].id
    setTeamGroup(teamId, 'A')
    setGroupCount(2)
    expect(useTournamentStore.getState().tournament.teams[0].groupId).toBe('A')
  })
})

describe('setFinalsVariant / setDropoutHandling', () => {
  it('setFinalsVariant updates the finals variant', () => {
    const { setFinalsVariant } = useTournamentStore.getState()
    setFinalsVariant('endrunde-4')
    expect(useTournamentStore.getState().tournament.finalsVariant).toBe('endrunde-4')
  })

  it('setDropoutHandling updates the dropout handling mode', () => {
    const { setDropoutHandling } = useTournamentStore.getState()
    setDropoutHandling('walkover')
    expect(useTournamentStore.getState().tournament.dropoutHandling).toBe('walkover')
  })
})

describe('resolvePlaceholders (via submitGameResult)', () => {
  it('fills in real team IDs on a placement game once its group is fully scored', () => {
    const tournament = {
      ...useTournamentStore.getState().tournament,
      mode: 'round-robin+finals' as const,
      groupCount: 2,
      finalsVariant: 'endrunde-4' as const,
      teams: [
        { id: 't1', name: 'T1', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
        { id: 't2', name: 'T2', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
        { id: 't3', name: 'T3', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'B' },
        { id: 't4', name: 'T4', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'B' },
      ],
    }
    const groupGame = {
      id: 'gg1', homeTeamId: 't1', awayTeamId: 't2', stage: 'group' as const, field: 1,
      scheduledStart: '09:00', scheduledEnd: '09:30', round: 1, gameNumber: 1, periodScores: [], groupId: 'A',
    }
    const groupGameB = {
      id: 'gg2', homeTeamId: 't3', awayTeamId: 't4', stage: 'group' as const, field: 2,
      scheduledStart: '09:00', scheduledEnd: '09:30', round: 1, gameNumber: 2, periodScores: [], groupId: 'B',
    }
    const placementGame = {
      id: 'pg1', homeTeamId: null, awayTeamId: null, stage: 'placement' as const, field: 1,
      scheduledStart: '10:00', scheduledEnd: '10:30', round: 1, gameNumber: 3, periodScores: [],
      rankTier: 1, placementFrom: 1,
      homeSourceRank: { groupId: 'A', rank: 1 }, awaySourceRank: { groupId: 'B', rank: 1 },
    }
    useTournamentStore.setState({
      tournament,
      schedule: {
        id: 's1', tournamentId: tournament.id, generatedAt: new Date().toISOString(),
        games: [groupGame, groupGameB, placementGame], totalDurationMin: 90, estimatedEnd: '10:30',
      },
    })

    // t1 beats t2 in group A -> t1 is group A's rank 1
    useTournamentStore.getState().submitGameResult('gg1', [{ period: 1, homeScore: 20, awayScore: 10 }])
    // t3 beats t4 in group B -> t3 is group B's rank 1
    useTournamentStore.getState().submitGameResult('gg2', [{ period: 1, homeScore: 20, awayScore: 10 }])

    const resolved = useTournamentStore.getState().schedule!.games.find(g => g.id === 'pg1')!
    expect(resolved.homeTeamId).toBe('t1')
    expect(resolved.awayTeamId).toBe('t3')
    // homeSourceRank/awaySourceRank stay set even after resolution (see design decision above) —
    // they are NOT cleared, unlike an earlier draft that considered doing so.
    expect(resolved.homeSourceRank).toEqual({ groupId: 'A', rank: 1 })
    expect(resolved.awaySourceRank).toEqual({ groupId: 'B', rank: 1 })
  })

  it('does not resolve a placement game while its group is still incomplete', () => {
    const tournament = {
      ...useTournamentStore.getState().tournament,
      mode: 'round-robin+finals' as const,
      groupCount: 2,
      finalsVariant: 'endrunde-4' as const,
      teams: [
        { id: 't1', name: 'T1', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
        { id: 't2', name: 'T2', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
      ],
    }
    const groupGame1 = {
      id: 'gg1', homeTeamId: 't1', awayTeamId: 't2', stage: 'group' as const, field: 1,
      scheduledStart: '09:00', scheduledEnd: '09:30', round: 1, gameNumber: 1, periodScores: [], groupId: 'A',
    }
    const groupGame2 = {
      id: 'gg2', homeTeamId: 't1', awayTeamId: 't2', stage: 'group' as const, field: 1,
      scheduledStart: '09:30', scheduledEnd: '10:00', round: 2, gameNumber: 2, periodScores: [], groupId: 'A',
    }
    const placementGame = {
      id: 'pg1', homeTeamId: null, awayTeamId: null, stage: 'placement' as const, field: 1,
      scheduledStart: '10:00', scheduledEnd: '10:30', round: 1, gameNumber: 3, periodScores: [],
      rankTier: 1, placementFrom: 1,
      homeSourceRank: { groupId: 'A', rank: 1 }, awaySourceRank: { groupId: 'A', rank: 2 },
    }
    useTournamentStore.setState({
      tournament,
      schedule: {
        id: 's1', tournamentId: tournament.id, generatedAt: new Date().toISOString(),
        games: [groupGame1, groupGame2, placementGame], totalDurationMin: 90, estimatedEnd: '10:30',
      },
    })

    // only one of group A's two games is scored — group A is not yet complete
    useTournamentStore.getState().submitGameResult('gg1', [{ period: 1, homeScore: 20, awayScore: 10 }])

    const stillPlaceholder = useTournamentStore.getState().schedule!.games.find(g => g.id === 'pg1')!
    expect(stillPlaceholder.homeTeamId).toBeNull()
    expect(stillPlaceholder.homeSourceRank).toEqual({ groupId: 'A', rank: 1 })
  })

  it('re-resolves a placement game after a group-phase result correction changes the standings', () => {
    const tournament = {
      ...useTournamentStore.getState().tournament,
      mode: 'round-robin+finals' as const,
      groupCount: 1,
      finalsVariant: 'endrunde-4' as const,
      teams: [
        { id: 't1', name: 'T1', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
        { id: 't2', name: 'T2', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
      ],
    }
    const groupGame = {
      id: 'gg1', homeTeamId: 't1', awayTeamId: 't2', stage: 'group' as const, field: 1,
      scheduledStart: '09:00', scheduledEnd: '09:30', round: 1, gameNumber: 1, periodScores: [], groupId: 'A',
    }
    const placementGame = {
      id: 'pg1', homeTeamId: null, awayTeamId: null, stage: 'placement' as const, field: 1,
      scheduledStart: '10:00', scheduledEnd: '10:30', round: 1, gameNumber: 2, periodScores: [],
      rankTier: 1, placementFrom: 1,
      homeSourceRank: { groupId: 'A', rank: 1 }, awaySourceRank: { groupId: 'A', rank: 2 },
    }
    useTournamentStore.setState({
      tournament,
      schedule: {
        id: 's1', tournamentId: tournament.id, generatedAt: new Date().toISOString(),
        games: [groupGame, placementGame], totalDurationMin: 60, estimatedEnd: '10:30',
      },
    })

    useTournamentStore.getState().submitGameResult('gg1', [{ period: 1, homeScore: 20, awayScore: 10 }])
    expect(useTournamentStore.getState().schedule!.games.find(g => g.id === 'pg1')!.homeTeamId).toBe('t1')

    // correction flips the result: t2 now wins group A
    useTournamentStore.getState().correctGameResult('gg1', [{ period: 1, homeScore: 10, awayScore: 20 }])
    const reResolved = useTournamentStore.getState().schedule!.games.find(g => g.id === 'pg1')!
    expect(reResolved.homeTeamId).toBe('t2')
    expect(reResolved.awayTeamId).toBe('t1')
  })

  it('does not resolve a withdrawn team into a placement game even if it still ranks first in its group', () => {
    const tournament = {
      ...useTournamentStore.getState().tournament,
      mode: 'round-robin+finals' as const,
      groupCount: 1,
      finalsVariant: 'endrunde-4' as const,
      teams: [
        { id: 't1', name: 'T1', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
        { id: 't2', name: 'T2', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
        { id: 't3', name: 'T3', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
      ],
    }
    const gg1 = {
      id: 'gg1', homeTeamId: 't1', awayTeamId: 't2', stage: 'group' as const, field: 1,
      scheduledStart: '09:00', scheduledEnd: '09:30', round: 1, gameNumber: 1, periodScores: [], groupId: 'A',
    }
    const gg2 = {
      id: 'gg2', homeTeamId: 't1', awayTeamId: 't3', stage: 'group' as const, field: 1,
      scheduledStart: '09:30', scheduledEnd: '10:00', round: 2, gameNumber: 2, periodScores: [], groupId: 'A',
    }
    const gg3 = {
      id: 'gg3', homeTeamId: 't2', awayTeamId: 't3', stage: 'group' as const, field: 1,
      scheduledStart: '10:00', scheduledEnd: '10:30', round: 3, gameNumber: 3, periodScores: [], groupId: 'A',
    }
    const placementGame = {
      id: 'pg1', homeTeamId: null, awayTeamId: null, stage: 'placement' as const, field: 1,
      scheduledStart: '11:00', scheduledEnd: '11:30', round: 1, gameNumber: 4, periodScores: [],
      rankTier: 1, placementFrom: 1,
      homeSourceRank: { groupId: 'A', rank: 1 }, awaySourceRank: { groupId: 'A', rank: 2 },
    }
    useTournamentStore.setState({
      tournament,
      schedule: {
        id: 's1', tournamentId: tournament.id, generatedAt: new Date().toISOString(),
        games: [gg1, gg2, gg3, placementGame], totalDurationMin: 120, estimatedEnd: '11:30',
      },
    })

    // t1 crushes t2, then withdraws before playing t3 (banks a walkover win) -> t1 would still
    // rank #1 in group A on raw points if withdrawal isn't excluded from qualification.
    useTournamentStore.getState().submitGameResult('gg1', [{ period: 1, homeScore: 30, awayScore: 5 }])
    useTournamentStore.getState().withdrawTeam('t1')
    // t2 beats t3 to complete the group
    useTournamentStore.getState().submitGameResult('gg3', [{ period: 1, homeScore: 10, awayScore: 8 }])

    const resolved = useTournamentStore.getState().schedule!.games.find(g => g.id === 'pg1')!
    expect(resolved.homeTeamId).not.toBe('t1')
    expect(resolved.homeTeamId).toBe('t2')
    expect(resolved.awayTeamId).toBe('t3')
  })

  it('does not overwrite a placement game that has already been played itself, even if the group phase is corrected afterward', () => {
    const tournament = {
      ...useTournamentStore.getState().tournament,
      mode: 'round-robin+finals' as const,
      groupCount: 1,
      finalsVariant: 'endrunde-4' as const,
      teams: [
        { id: 't1', name: 'T1', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
        { id: 't2', name: 'T2', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
      ],
    }
    const groupGame = {
      id: 'gg1', homeTeamId: 't1', awayTeamId: 't2', stage: 'group' as const, field: 1,
      scheduledStart: '09:00', scheduledEnd: '09:30', round: 1, gameNumber: 1, periodScores: [], groupId: 'A',
    }
    const placementGame = {
      id: 'pg1', homeTeamId: 't1', awayTeamId: 't2', stage: 'placement' as const, field: 1,
      scheduledStart: '10:00', scheduledEnd: '10:30', round: 1, gameNumber: 2,
      periodScores: [{ period: 1, homeScore: 15, awayScore: 12 }],
      rankTier: 1, placementFrom: 1,
      homeSourceRank: { groupId: 'A', rank: 1 }, awaySourceRank: { groupId: 'A', rank: 2 },
    }
    useTournamentStore.setState({
      tournament,
      schedule: {
        id: 's1', tournamentId: tournament.id, generatedAt: new Date().toISOString(),
        games: [groupGame, placementGame], totalDurationMin: 60, estimatedEnd: '10:30',
      },
    })

    // group A is already scored (t1 won); now correct it to flip the winner
    useTournamentStore.getState().correctGameResult('gg1', [{ period: 1, homeScore: 5, awayScore: 25 }])

    // The placement game already has its OWN result recorded — it must be left untouched even
    // though the group-phase correction would, in isolation, suggest a different team assignment.
    const untouched = useTournamentStore.getState().schedule!.games.find(g => g.id === 'pg1')!
    expect(untouched.homeTeamId).toBe('t1')
    expect(untouched.awayTeamId).toBe('t2')
    expect(untouched.periodScores).toEqual([{ period: 1, homeScore: 15, awayScore: 12 }])
  })
})

describe('resetTournament', () => {
  it('clears the tournament, schedule and localStorage, and issues a fresh tournament id', () => {
    const { addTeam, setFields, generateAndSaveSchedule, resetTournament } = useTournamentStore.getState()
    addTeam({ name: 'A', logoUrl: '', color: '#000', contact: '' })
    addTeam({ name: 'B', logoUrl: '', color: '#000', contact: '' })
    setFields(1)
    generateAndSaveSchedule()
    const game = useTournamentStore.getState().schedule!.games[0]
    useTournamentStore.getState().submitGameResult(game.id, [{ period: 1, homeScore: 10, awayScore: 5 }])
    const previousId = useTournamentStore.getState().tournament.id

    resetTournament()

    const state = useTournamentStore.getState()
    expect(state.tournament.teams).toHaveLength(0)
    expect(state.tournament.name).toBe('')
    expect(state.tournament.id).not.toBe(previousId)
    expect(state.schedule).toBeNull()
    expect(localStorage.getItem('tm_tournament')).toBeNull()
    expect(localStorage.getItem('tm_schedule')).toBeNull()
  })
})

describe('withdrawTeam (group stage)', () => {
  it('cancels a withdrawing team\'s remaining unplayed group games as a walkover', () => {
    const tournament = {
      ...useTournamentStore.getState().tournament,
      mode: 'round-robin+finals' as const,
      groupCount: 1,
      teams: [
        { id: 't1', name: 'T1', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
        { id: 't2', name: 'T2', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
        { id: 't3', name: 'T3', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
      ],
    }
    const playedGame = {
      id: 'gg1', homeTeamId: 't1', awayTeamId: 't2', stage: 'group' as const, field: 1,
      scheduledStart: '09:00', scheduledEnd: '09:30', round: 1, gameNumber: 1,
      periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }], groupId: 'A',
    }
    const unplayedGame = {
      id: 'gg2', homeTeamId: 't2', awayTeamId: 't3', stage: 'group' as const, field: 1,
      scheduledStart: '10:00', scheduledEnd: '10:30', round: 2, gameNumber: 2, periodScores: [], groupId: 'A',
    }
    useTournamentStore.setState({
      tournament,
      schedule: {
        id: 's1', tournamentId: tournament.id, generatedAt: new Date().toISOString(),
        games: [playedGame, unplayedGame], totalDurationMin: 90, estimatedEnd: '10:30',
      },
    })

    useTournamentStore.getState().withdrawTeam('t2')

    const cancelled = useTournamentStore.getState().schedule!.games.find(g => g.id === 'gg2')!
    expect(cancelled.cancelledReason).toBe('withdrawal')
    expect(cancelled.periodScores).toEqual([{ period: 1, homeScore: 0, awayScore: 0 }])
    const untouched = useTournamentStore.getState().schedule!.games.find(g => g.id === 'gg1')!
    expect(untouched.periodScores).toEqual([{ period: 1, homeScore: 20, awayScore: 10 }])
    expect(untouched.cancelledReason).toBeUndefined()

    const withdrawnTeam = useTournamentStore.getState().tournament.teams.find(t => t.id === 't2')!
    expect(withdrawnTeam.withdrawnAfterStage).toBe('group')
  })

  it('completing a group by cancelling the LAST unplayed game via withdrawal immediately resolves a waiting placement game (no separate submitGameResult needed)', () => {
    const tournament = {
      ...useTournamentStore.getState().tournament,
      mode: 'round-robin+finals' as const,
      groupCount: 1,
      finalsVariant: 'endrunde-4' as const,
      teams: [
        { id: 't1', name: 'T1', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
        { id: 't2', name: 'T2', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
      ],
    }
    // Group A's only game is still unplayed; withdrawing t2 cancels it as a walkover, which is
    // ALSO the last game needed for group A to count as complete.
    const gg1 = {
      id: 'gg1', homeTeamId: 't1', awayTeamId: 't2', stage: 'group' as const, field: 1,
      scheduledStart: '09:00', scheduledEnd: '09:30', round: 1, gameNumber: 1, periodScores: [], groupId: 'A',
    }
    const placementGame = {
      id: 'pg1', homeTeamId: null, awayTeamId: null, stage: 'placement' as const, field: 1,
      scheduledStart: '10:00', scheduledEnd: '10:30', round: 1, gameNumber: 2, periodScores: [],
      rankTier: 1, placementFrom: 1,
      homeSourceRank: { groupId: 'A', rank: 1 }, awaySourceRank: { groupId: 'A', rank: 2 },
    }
    useTournamentStore.setState({
      tournament,
      schedule: {
        id: 's1', tournamentId: tournament.id, generatedAt: new Date().toISOString(),
        games: [gg1, placementGame], totalDurationMin: 60, estimatedEnd: '10:30',
      },
    })

    useTournamentStore.getState().withdrawTeam('t2')

    const resolved = useTournamentStore.getState().schedule!.games.find(g => g.id === 'pg1')!
    expect(resolved.homeTeamId).toBe('t1')
  })

  it('handles withdrawal in an uneven group (3 teams) without crashing and scores walkover correctly', () => {
    const tournament = {
      ...useTournamentStore.getState().tournament,
      mode: 'round-robin+finals' as const,
      groupCount: 1,
      teams: [
        { id: 't1', name: 'T1', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
        { id: 't2', name: 'T2', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
        { id: 't3', name: 'T3', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
      ],
    }
    const gg1 = {
      id: 'gg1', homeTeamId: 't1', awayTeamId: 't2', stage: 'group' as const, field: 1,
      scheduledStart: '09:00', scheduledEnd: '09:30', round: 1, gameNumber: 1, periodScores: [], groupId: 'A',
    }
    const gg2 = {
      id: 'gg2', homeTeamId: 't1', awayTeamId: 't3', stage: 'group' as const, field: 1,
      scheduledStart: '09:30', scheduledEnd: '10:00', round: 2, gameNumber: 2, periodScores: [], groupId: 'A',
    }
    const gg3 = {
      id: 'gg3', homeTeamId: 't2', awayTeamId: 't3', stage: 'group' as const, field: 1,
      scheduledStart: '10:00', scheduledEnd: '10:30', round: 3, gameNumber: 3, periodScores: [], groupId: 'A',
    }
    useTournamentStore.setState({
      tournament,
      schedule: {
        id: 's1', tournamentId: tournament.id, generatedAt: new Date().toISOString(),
        games: [gg1, gg2, gg3], totalDurationMin: 90, estimatedEnd: '10:30',
      },
    })

    // t3 withdraws before playing anyone -> both its games become walkovers for its opponents.
    useTournamentStore.getState().withdrawTeam('t3')

    const { tournament: updatedTournament, schedule: updatedSchedule } = useTournamentStore.getState()
    const standings = computeGroupStandings(updatedTournament.teams, updatedSchedule!.games, 'A')
    expect(standings.find(s => s.teamId === 't1')!.points).toBe(2)
    expect(standings.find(s => s.teamId === 't2')!.points).toBe(2)
    expect(standings.find(s => s.teamId === 't3')!.points).toBe(0)
    expect(standings.find(s => s.teamId === 't3')!.withdrawn).toBe(true)
  })

  it('does not touch swiss-mode withdrawal behavior', () => {
    setupSwissTournament(4, 2)
    const { schedule } = useTournamentStore.getState()
    const game = schedule!.games.find(g => g.round === 1)!
    useTournamentStore.getState().withdrawTeam(game.homeTeamId!)
    const withdrawnTeam = useTournamentStore.getState().tournament.teams.find(t => t.id === game.homeTeamId)!
    expect(withdrawnTeam.withdrawnAfterRound).toBe(1)
    expect(withdrawnTeam.withdrawnAfterStage).toBeUndefined()
  })
})

describe('withdrawTeam (finals/placement stage)', () => {
  it('cancels a withdrawing team\'s remaining placement-cohort games as a walkover', () => {
    const tournament = {
      ...useTournamentStore.getState().tournament,
      mode: 'round-robin+finals' as const,
      groupCount: 1,
      finalsVariant: 'endrunde-4' as const,
      teams: [
        { id: 't1', name: 'T1', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
        { id: 't2', name: 'T2', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
        { id: 't3', name: 'T3', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
      ],
    }
    const playedPlacementGame = {
      id: 'pg1', homeTeamId: 't1', awayTeamId: 't2', stage: 'placement' as const, field: 1,
      scheduledStart: '10:00', scheduledEnd: '10:30', round: 1, gameNumber: 1,
      periodScores: [{ period: 1, homeScore: 20, awayScore: 10 }],
      rankTier: 1, placementFrom: 1,
      homeSourceRank: { groupId: 'A', rank: 1 }, awaySourceRank: { groupId: 'A', rank: 2 },
    }
    const unplayedPlacementGame = {
      id: 'pg2', homeTeamId: 't2', awayTeamId: 't3', stage: 'placement' as const, field: 1,
      scheduledStart: '11:00', scheduledEnd: '11:30', round: 2, gameNumber: 2, periodScores: [],
      rankTier: 1, placementFrom: 1,
      homeSourceRank: { groupId: 'A', rank: 2 }, awaySourceRank: { groupId: 'A', rank: 3 },
    }
    useTournamentStore.setState({
      tournament,
      schedule: {
        id: 's1', tournamentId: tournament.id, generatedAt: new Date().toISOString(),
        games: [playedPlacementGame, unplayedPlacementGame], totalDurationMin: 90, estimatedEnd: '11:30',
      },
    })

    useTournamentStore.getState().withdrawTeam('t2')

    const cancelled = useTournamentStore.getState().schedule!.games.find(g => g.id === 'pg2')!
    expect(cancelled.cancelledReason).toBe('withdrawal')
    expect(cancelled.periodScores).toEqual([{ period: 1, homeScore: 0, awayScore: 0 }])
    const untouched = useTournamentStore.getState().schedule!.games.find(g => g.id === 'pg1')!
    expect(untouched.cancelledReason).toBeUndefined()

    const withdrawnTeam = useTournamentStore.getState().tournament.teams.find(t => t.id === 't2')!
    expect(withdrawnTeam.withdrawnAfterStage).toBe('finals')
  })
})

describe('computeGroupStandings walkover scoring (via group-stage withdrawal)', () => {
  it('awards the surviving team 2 walkover points when the opponent withdrew', () => {
    const tournament = {
      ...useTournamentStore.getState().tournament,
      mode: 'round-robin+finals' as const,
      groupCount: 1,
      teams: [
        { id: 't1', name: 'T1', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
        { id: 't2', name: 'T2', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
      ],
    }
    const unplayedGame = {
      id: 'gg1', homeTeamId: 't1', awayTeamId: 't2', stage: 'group' as const, field: 1,
      scheduledStart: '09:00', scheduledEnd: '09:30', round: 1, gameNumber: 1, periodScores: [], groupId: 'A',
    }
    useTournamentStore.setState({
      tournament,
      schedule: {
        id: 's1', tournamentId: tournament.id, generatedAt: new Date().toISOString(),
        games: [unplayedGame], totalDurationMin: 30, estimatedEnd: '09:30',
      },
    })

    useTournamentStore.getState().withdrawTeam('t2')

    const { tournament: updatedTournament, schedule: updatedSchedule } = useTournamentStore.getState()
    const standings = computeGroupStandings(updatedTournament.teams, updatedSchedule!.games, 'A')
    expect(standings.find(s => s.teamId === 't1')!.points).toBe(2)
    expect(standings.find(s => s.teamId === 't1')!.pointsFor).toBe(0)
    expect(standings.find(s => s.teamId === 't2')!.points).toBe(0)
  })
})
