import { describe, it, expect } from 'vitest'
import { parseTournamentImport } from './json-import'

describe('parseTournamentImport', () => {
  it('parses a valid export payload', () => {
    const json = JSON.stringify({
      tournament: { id: 't1', name: 'Test', mode: 'swiss', fields: 2, gameSettings: {}, venue: {}, teams: [] },
      schedule: { id: 's1', tournamentId: 't1', generatedAt: '2026-01-01T00:00:00.000Z', games: [], totalDurationMin: 0, estimatedEnd: '10:00' },
      exportedAt: '2026-01-01T00:00:00.000Z',
    })
    const result = parseTournamentImport(json)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.tournament.name).toBe('Test')
      expect(result.schedule?.id).toBe('s1')
    }
  })

  it('accepts a payload with schedule set to null', () => {
    const json = JSON.stringify({
      tournament: { id: 't1', name: 'Test', mode: 'round-robin', fields: 2, gameSettings: {}, venue: {}, teams: [] },
      schedule: null,
    })
    const result = parseTournamentImport(json)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.schedule).toBeNull()
  })

  it('rejects invalid JSON', () => {
    const result = parseTournamentImport('not json')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBeTruthy()
  })

  it('rejects a payload missing the tournament field', () => {
    const result = parseTournamentImport(JSON.stringify({ schedule: null }))
    expect(result.ok).toBe(false)
  })

  it('rejects a payload where tournament.teams is not an array', () => {
    const json = JSON.stringify({
      tournament: { id: 't1', name: 'Test', mode: 'swiss', fields: 2, gameSettings: {}, venue: {}, teams: 'not-an-array' },
      schedule: null,
    })
    const result = parseTournamentImport(json)
    expect(result.ok).toBe(false)
  })

  it('rejects a payload where a team element is null or missing an id', () => {
    const json = JSON.stringify({
      tournament: { id: 't1', name: 'Test', mode: 'swiss', fields: 2, gameSettings: {}, venue: {}, teams: [null] },
      schedule: null,
    })
    const result = parseTournamentImport(json)
    expect(result.ok).toBe(false)
  })

  it('rejects a payload where schedule is present but missing games', () => {
    const json = JSON.stringify({
      tournament: { id: 't1', name: 'Test', mode: 'swiss', fields: 2, gameSettings: {}, venue: {}, teams: [] },
      schedule: { id: 's1', tournamentId: 't1' },
    })
    const result = parseTournamentImport(json)
    expect(result.ok).toBe(false)
  })
})
