import { describe, it, expect } from 'vitest'
import type { Team, Player, Game, TournamentConfig } from './index'

describe('Type shapes', () => {
  it('Team has required fields', () => {
    const team: Team = {
      id: 'uuid-1',
      name: 'Musterstadt Baskets',
      logoUrl: 'https://example.com/logo.png',
      color: '#004174',
      contact: 'Max Mustermann',
      players: [],
    }
    expect(team.id).toBe('uuid-1')
    expect(team.players).toEqual([])
  })

  it('Player jerseyNumber is a string', () => {
    const player: Player = {
      id: 'uuid-2',
      firstName: 'Jonas',
      lastName: 'Weber',
      jerseyNumber: '00',
    }
    expect(typeof player.jerseyNumber).toBe('string')
  })

  it('Game has periodScores array', () => {
    const game: Game = {
      id: 'uuid-3',
      homeTeamId: 'uuid-1',
      awayTeamId: 'uuid-4',
      stage: 'group',
      field: 1,
      scheduledStart: '09:00',
      scheduledEnd: '09:30',
      round: 1,
      gameNumber: 1,
      periodScores: [],
    }
    expect(game.periodScores).toEqual([])
  })

  it('Game supports bye shape', () => {
    const bye: Game = {
      id: 'uuid-5',
      homeTeamId: null,
      awayTeamId: null,
      byeTeamId: 'uuid-1',
      stage: 'swiss',
      field: 0,
      scheduledStart: '10:00',
      scheduledEnd: '10:00',
      round: 2,
      gameNumber: 5,
      periodScores: [],
    }
    expect(bye.byeTeamId).toBe('uuid-1')
  })

  it('Game supports cancelled-due-to-withdrawal shape', () => {
    const cancelled: Game = {
      id: 'uuid-6',
      homeTeamId: 'uuid-1',
      awayTeamId: 'uuid-2',
      stage: 'swiss',
      field: 1,
      scheduledStart: '10:00',
      scheduledEnd: '10:30',
      round: 3,
      gameNumber: 6,
      periodScores: [],
      cancelledReason: 'withdrawal',
    }
    expect(cancelled.cancelledReason).toBe('withdrawal')
  })

  it('Team supports withdrawnAfterRound', () => {
    const team: Team = {
      id: 'uuid-7',
      name: 'Team X',
      logoUrl: '',
      color: '#000',
      contact: '',
      players: [],
      withdrawnAfterRound: 2,
    }
    expect(team.withdrawnAfterRound).toBe(2)
  })

  it('Team can have an optional groupId', () => {
    const team: Team = {
      id: 'uuid-1', name: 'Musterstadt Baskets', logoUrl: '', color: '#004174',
      contact: '', players: [], groupId: 'B',
    }
    expect(team.groupId).toBe('B')
  })

  it('TournamentConfig can have optional groupCount and doubleRoundRobin', () => {
    const config: Pick<TournamentConfig, 'groupCount' | 'doubleRoundRobin'> = {
      groupCount: 2,
      doubleRoundRobin: true,
    }
    expect(config.groupCount).toBe(2)
    expect(config.doubleRoundRobin).toBe(true)
  })

  it('Game can have an optional groupId', () => {
    const game: Pick<Game, 'groupId'> = { groupId: 'A' }
    expect(game.groupId).toBe('A')
  })
})
