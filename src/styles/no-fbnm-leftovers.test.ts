// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Vitest ersetzt CSS-Dateien durch leere Strings (auch mit ?raw) — deshalb direkt über das Dateisystem lesen.
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

const FORBIDDEN = /fbnm|FBNM|INSOLENT|ALLER|Montserrat/
// FBNM-Farben und die Schrift 'Aller' (mit kleinem l): case-insensitiv, aber nur in dieser engen Form,
// weil "aller" auch ein deutsches Wort ist.
const FORBIDDEN_LITERALS = /#004174|#002751|#f0f7fc|font-family:\s*['"]Aller['"]/i
const SELF = 'no-fbnm-leftovers.test.ts'

describe('DSS-Fundament', () => {
  it('enthält keine FBNM-Reste (Tokens, Schriften, Klassen) mehr in src/', () => {
    const offenders = walk('src')
      .filter(path => /\.(ts|tsx|css)$/.test(path) && !path.endsWith(SELF))
      .filter(path => {
        const content = readFileSync(path, 'utf8')
        return FORBIDDEN.test(content) || FORBIDDEN_LITERALS.test(content)
      })
    expect(offenders).toEqual([])
  })

  it('setzt das helle DSS-Theme fest auf <html>', () => {
    expect(readFileSync('index.html', 'utf8')).toMatch(/<html[^>]*data-theme="light"/)
  })
})
