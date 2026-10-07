// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const root = new URL('../../', import.meta.url).pathname
const srcDir = join(root, 'src')

// Namen der entfernten Tailwind-Übergangsschicht (Teil 3 der DSS-Migration).
const LEGACY = /(?<![\w-])(?:text|bg|border|ring|divide|fill|stroke|outline|placeholder)-(?:brand(?:-[a-z]+)*|muted(?:-foreground)?|card|border(?:-ui)?|secondary(?:-[a-z]+)*|tint|destructive(?:-foreground)?|background|foreground)(?![\w-])/g

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

describe('Tailwind-Übergangsschicht ist entfernt', () => {
  const files = walk(srcDir).filter((f) => /\.(tsx?|css)$/.test(f) && !f.endsWith('legacy-classes.test.ts'))

  it('keine Datei in src/ nutzt die alten Klassennamen', () => {
    const hits = files.flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(LEGACY)].map((m) => `${file.replace(root, '')}: ${m[0]}`),
    )
    expect(hits).toEqual([])
  })

  it('tailwind.config.ts definiert keine Alt-Farben mehr', () => {
    const config = readFileSync(join(root, 'tailwind.config.ts'), 'utf8')
    for (const key of ['brand:', 'muted:', 'card:', "'border-ui'", 'secondary:', 'tint:', 'destructive:', 'background:', 'foreground:']) {
      expect(config, `tailwind.config.ts enthält noch ${key}`).not.toContain(key)
    }
  })

  it('index.css enthält die :where()-Regel für rohe Controls nicht mehr', () => {
    expect(readFileSync(join(srcDir, 'index.css'), 'utf8')).not.toContain(':where(')
  })
})
