import { describe, it, expect } from 'vitest'
import { pairFirstSwissRound } from './swiss-pairing'

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
