import { describe, it, expect } from 'vitest'
import { pairFirstSwissRound, pairNextSwissRound } from './swiss-pairing'
import type { TeamStanding } from './standings'

describe('pairFirstSwissRound', () => {
  it('pairs all teams exactly once with an even team count', () => {
    const teamIds = ['t1', 't2', 't3', 't4']
    const result = pairFirstSwissRound(teamIds)
    expect(result.pairs).toHaveLength(2)
    expect(result.byeTeamId).toBeUndefined()
    const paired = result.pairs.flat()
    expect(new Set(paired).size).toBe(4)
    for (const id of teamIds) expect(paired).toContain(id)
  })

  it('assigns exactly one bye with an odd team count', () => {
    const teamIds = ['t1', 't2', 't3']
    const result = pairFirstSwissRound(teamIds)
    expect(result.pairs).toHaveLength(1)
    expect(result.byeTeamId).toBeDefined()
    const paired = [...result.pairs.flat(), result.byeTeamId]
    expect(new Set(paired).size).toBe(3)
  })
})

const makeStanding = (teamId: string, points: number, overrides: Partial<TeamStanding> = {}): TeamStanding => ({
  teamId, points, wins: 0, draws: 0, losses: 0,
  pointsFor: 0, pointsAgainst: 0, pointsDiff: 0, buchholz: 0,
  hadBye: false, withdrawn: false, ...overrides,
})

describe('pairNextSwissRound', () => {
  it('pairs teams with similar points, avoiding repeated pairings', () => {
    const standings = [
      makeStanding('t1', 4),
      makeStanding('t2', 4),
      makeStanding('t3', 2),
      makeStanding('t4', 2),
    ]
    // t1 already played t2 in a previous round
    const playedPairs = new Set(['t1|t2'])
    const result = pairNextSwissRound({ standings, playedPairs })
    expect(result.pairs).toHaveLength(2)
    const pairKeys = result.pairs.map(([a, b]) => [a, b].sort().join('|'))
    expect(pairKeys).not.toContain('t1|t2')
  })

  it('never repeats a pairing that has already been played', () => {
    const standings = [
      makeStanding('t1', 6),
      makeStanding('t2', 4),
      makeStanding('t3', 4),
      makeStanding('t4', 2),
    ]
    const playedPairs = new Set(['t1|t2', 't3|t4'])
    const result = pairNextSwissRound({ standings, playedPairs })
    const pairKeys = result.pairs.map(([a, b]) => [a, b].sort().join('|'))
    for (const key of pairKeys) {
      expect(playedPairs.has(key)).toBe(false)
    }
  })

  it('assigns the bye to the lowest-ranked team that has not had one yet', () => {
    const standings = [
      makeStanding('t1', 8),
      makeStanding('t2', 6),
      makeStanding('t3', 4),
      makeStanding('t4', 2, { hadBye: true }),
      makeStanding('t5', 0),
    ]
    const result = pairNextSwissRound({ standings, playedPairs: new Set() })
    expect(result.byeTeamId).toBe('t5')
  })

  it('excludes withdrawn teams from pairing', () => {
    const standings = [
      makeStanding('t1', 4),
      makeStanding('t2', 4, { withdrawn: true }),
      makeStanding('t3', 2),
      makeStanding('t4', 0),
    ]
    const result = pairNextSwissRound({ standings, playedPairs: new Set() })
    const paired = result.pairs.flat()
    expect(paired).not.toContain('t2')
  })

  it('backtracks to find a valid pairing when the greedy top-down attempt would fail', () => {
    // t1 has played t2 and t3 already; only t4 remains as a valid opponent for t1.
    // A naive greedy pass from the top could pair t2-t3 first, leaving t1 with no option.
    const standings = [
      makeStanding('t1', 4),
      makeStanding('t2', 4),
      makeStanding('t3', 2),
      makeStanding('t4', 2),
    ]
    const playedPairs = new Set(['t1|t2', 't1|t3'])
    const result = pairNextSwissRound({ standings, playedPairs })
    const pairKeys = result.pairs.map(([a, b]) => [a, b].sort().join('|'))
    expect(pairKeys).toContain('t1|t4')
    expect(pairKeys).toContain('t2|t3')
  })

  it('throws PairingConflictError when no valid pairing exists', () => {
    // With only 4 teams, if every possible pair has already been played, no valid round remains.
    const standings = [
      makeStanding('t1', 6),
      makeStanding('t2', 4),
      makeStanding('t3', 2),
      makeStanding('t4', 0),
    ]
    const playedPairs = new Set(['t1|t2', 't1|t3', 't1|t4', 't2|t3', 't2|t4', 't3|t4'])
    expect(() => pairNextSwissRound({ standings, playedPairs })).toThrow(
      'Keine gültige Paarung mehr möglich',
    )
  })
})
