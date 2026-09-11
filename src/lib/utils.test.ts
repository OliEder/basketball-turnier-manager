import { describe, expect, it } from 'vitest'
import { cn } from './utils'

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
