import { describe, it, expect } from 'vitest'
import type { Team, Player, Game } from './index'

describe('Type shapes', () => {
  it('Team has required fields', () => {
    const team: Team = {
      id: 'uuid-1',
      name: 'Fibalon Baskets',
      logoUrl: 'https://fibalon-baskets.de/logo.png',
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
      field: 1,
      scheduledStart: '09:00',
      scheduledEnd: '09:30',
      round: 1,
      gameNumber: 1,
      periodScores: [],
    }
    expect(game.periodScores).toEqual([])
  })
})
