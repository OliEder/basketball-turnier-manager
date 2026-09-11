import { describe, it, expect } from 'vitest'
import { computeRoundPageBreaks } from './print-pagination'

describe('computeRoundPageBreaks', () => {
  it('returns an empty set for an empty rounds array', () => {
    expect(computeRoundPageBreaks([], new Map())).toEqual(new Set())
  })

  it('never breaks before the first round, even if it alone reaches the threshold', () => {
    const rounds = [1]
    const gamesPerRound = new Map([[1, 20]])
    expect(computeRoundPageBreaks(rounds, gamesPerRound)).toEqual(new Set())
  })

  it('does not break when the running sum stays far below the threshold', () => {
    const rounds = [1, 2, 3]
    const gamesPerRound = new Map([[1, 3], [2, 3], [3, 3]])
    expect(computeRoundPageBreaks(rounds, gamesPerRound)).toEqual(new Set())
  })

  it('breaks before the round right after the running sum reaches the threshold exactly', () => {
    const rounds = [1, 2, 3]
    const gamesPerRound = new Map([[1, 15], [2, 6], [3, 6]])
    expect(computeRoundPageBreaks(rounds, gamesPerRound)).toEqual(new Set([2]))
  })

  it('breaks before the round right after the running sum exceeds the threshold', () => {
    const rounds = [1, 2, 3]
    const gamesPerRound = new Map([[1, 16], [2, 6], [3, 6]])
    expect(computeRoundPageBreaks(rounds, gamesPerRound)).toEqual(new Set([2]))
  })

  it('accumulates across multiple rounds before crossing the threshold', () => {
    const rounds = [1, 2, 3, 4]
    const gamesPerRound = new Map([[1, 5], [2, 5], [3, 5], [4, 5]])
    expect(computeRoundPageBreaks(rounds, gamesPerRound)).toEqual(new Set([4]))
  })

  it('resets the running sum after a break and can produce multiple breaks', () => {
    const rounds = [1, 2, 3, 4, 5, 6, 7, 8]
    const gamesPerRound = new Map([
      [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6],
    ])
    expect(computeRoundPageBreaks(rounds, gamesPerRound)).toEqual(new Set([4, 7]))
  })

  it('handles a single round without breaking', () => {
    const rounds = [1]
    const gamesPerRound = new Map([[1, 1]])
    expect(computeRoundPageBreaks(rounds, gamesPerRound)).toEqual(new Set())
  })

  it('treats a missing entry in gamesPerRound as zero games', () => {
    const rounds = [1, 2, 3]
    const gamesPerRound = new Map([[1, 15]])
    expect(computeRoundPageBreaks(rounds, gamesPerRound)).toEqual(new Set([2]))
  })

  it('respects a custom threshold', () => {
    const rounds = [1, 2, 3]
    const gamesPerRound = new Map([[1, 5], [2, 5], [3, 5]])
    expect(computeRoundPageBreaks(rounds, gamesPerRound, 10)).toEqual(new Set([3]))
  })
})
