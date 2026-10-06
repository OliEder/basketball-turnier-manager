// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pdfColors } from './pdf-theme'
import { oklchToHex } from './oklch'

// Vitest ersetzt CSS-Dateien durch leere Strings (auch mit ?raw) — deshalb per Dateisystem lesen.
const tokensCss = readFileSync(
  join(process.cwd(), 'node_modules/@bbv/dss-design-system/tokens/tokens.css'),
  'utf8',
)

function variable(name: string): string {
  const match = tokensCss.match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!match) throw new Error(`Token --${name} nicht in tokens.css gefunden`)
  return match[1].trim()
}

function tokenToHex(name: string): string {
  const raw = variable(name)
  const match = raw.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+(var\(--[a-z-]+\)|[\d.]+)\s*\)/)
  if (!match) throw new Error(`Token --${name} ist kein einfacher oklch()-Wert: ${raw}`)
  const hueRaw = match[3]
  const hue = hueRaw.startsWith('var(') ? Number(variable(hueRaw.slice(6, -1))) : Number(hueRaw)
  return oklchToHex(Number(match[1]), Number(match[2]), hue)
}

describe('pdf-theme colors', () => {
  // Drift-Test: Ändert das Design-System einen dieser Töne, schlägt dieser Test an.
  it.each([
    ['text', 'ink-900'],
    ['tableHeaderText', 'ink-900'],
    ['accent', 'amber-400'],
    ['textMuted', 'n-600'],
    ['tableHeaderBg', 'n-100'],
    ['zebra', 'n-50'],
    ['border', 'n-200'],
  ] as const)('pdfColors.%s entspricht dem DSS-Token --%s', (key, token) => {
    expect(pdfColors[key]).toBe(tokenToHex(token))
  })

  it('uses plain white', () => {
    expect(pdfColors.white).toBe('#ffffff')
  })
})
