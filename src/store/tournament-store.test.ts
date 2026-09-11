import { describe, it, expect, beforeEach } from 'vitest'
import { useTournamentStore } from './tournament-store'
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
