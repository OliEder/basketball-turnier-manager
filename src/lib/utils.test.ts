import { describe, expect, it } from 'vitest'
import { cn, getTeamAbbreviation } from './utils'
import type { Team } from '@/types'

describe('cn', () => {
  it('lets a later width class override an earlier conflicting one, regardless of Tailwind generation order', () => {
    // w-full and w-12 both exist in the actual generated stylesheet; without proper
    // Tailwind-aware merging, whichever rule happens to come later in the generated
    // CSS wins, not whichever class appears later in this call — tailwind-merge fixes
    // that by understanding these are the same CSS property (width) and keeping only
    // the last one.
    const result = cn('w-full', 'w-12')
    expect(result).not.toContain('w-full')
    expect(result).toContain('w-12')
  })

  it('keeps non-conflicting classes from both arguments', () => {
    const result = cn('flex h-9 rounded-sm', 'w-12')
    expect(result).toContain('flex')
    expect(result).toContain('h-9')
    expect(result).toContain('rounded-sm')
    expect(result).toContain('w-12')
  })
})

const makeTeam = (overrides: Partial<Team> = {}): Team => ({
  id: 't1', name: 'Team A', logoUrl: '', color: '#000', contact: '', players: [],
  ...overrides,
})

describe('getTeamAbbreviation', () => {
  it('returns the explicit abbreviation unchanged when set', () => {
    const team = makeTeam({ name: 'Team A', abbreviation: 'XYZ' })
    expect(getTeamAbbreviation(team)).toBe('XYZ')
  })

  it('derives the first 3 letters uppercased when no abbreviation is set and the name has no trailing digit', () => {
    const team = makeTeam({ name: 'Team A' })
    expect(getTeamAbbreviation(team)).toBe('TEA')
  })

  it('appends a trailing digit to the derived abbreviation', () => {
    const team = makeTeam({ name: 'TSV Nord 2' })
    expect(getTeamAbbreviation(team)).toBe('TSV2')
  })

  it('handles a name with an umlaut ending in a digit', () => {
    const team = makeTeam({ name: 'München2' })
    expect(getTeamAbbreviation(team)).toBe('MÜN2')
  })

  it('returns the whole name uppercased when shorter than 3 characters', () => {
    const team = makeTeam({ name: 'Ax' })
    expect(getTeamAbbreviation(team)).toBe('AX')
  })
})
