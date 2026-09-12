import { describe, it, expect } from 'vitest'
import { suggestGroupCount } from './group-suggestion'

describe('suggestGroupCount', () => {
  it('suggests 2 groups for 6 teams (single-leg): |6/2 - 3.5| = 0.5 beats |6/1 - 3.5| = 2.5 and |6/4 - 3.5| = 2', () => {
    // candidates <= 6: [1, 2, 4]
    // |6/1 - 3.5| = |6 - 3.5| = 2.5
    // |6/2 - 3.5| = |3 - 3.5| = 0.5   <- smallest distance
    // |6/4 - 3.5| = |1.5 - 3.5| = 2
    expect(suggestGroupCount(6, false)).toBe(2)
  })

  it('suggests 2 groups for 9 teams (single-leg): |9/2 - 3.5| = 1 beats |9/1 - 3.5| = 5.5 and |9/4 - 3.5| = 1.25', () => {
    // candidates <= 9: [1, 2, 4, 8]
    // |9/1 - 3.5| = |9 - 3.5| = 5.5
    // |9/2 - 3.5| = |4.5 - 3.5| = 1     <- smallest distance
    // |9/4 - 3.5| = |2.25 - 3.5| = 1.25
    // |9/8 - 3.5| = |1.125 - 3.5| = 2.375
    expect(suggestGroupCount(9, false)).toBe(2)
  })

  it('suggests 4 groups for 16 teams (single-leg): |16/4 - 3.5| = 0.5 is the best fit', () => {
    // candidates <= 16: [1, 2, 4, 8, 16]
    // |16/1 - 3.5| = |16 - 3.5| = 12.5
    // |16/2 - 3.5| = |8 - 3.5| = 4.5
    // |16/4 - 3.5| = |4 - 3.5| = 0.5    <- smallest distance
    // |16/8 - 3.5| = |2 - 3.5| = 1.5
    // |16/16 - 3.5| = |1 - 3.5| = 2.5
    expect(suggestGroupCount(16, false)).toBe(4)
  })

  it('suggests more/smaller groups when doubleRoundRobin is true', () => {
    // 16 teams, double round robin: target size 2
    // candidates <= 16: [1, 2, 4, 8, 16]
    // |16/1 - 2| = 14
    // |16/2 - 2| = 6
    // |16/4 - 2| = 2
    // |16/8 - 2| = |2 - 2| = 0          <- smallest distance (exact fit)
    // |16/16 - 2| = |1 - 2| = 1
    expect(suggestGroupCount(16, true)).toBe(8)
  })

  it('returns 1 as a safe fallback for the boundary case of a single team', () => {
    // candidates <= 1: [1] -> only candidate is 1
    expect(suggestGroupCount(1, false)).toBe(1)
  })
})
