// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pdfColors, pdfBaseStyles, pdfFonts } from './pdf-theme'
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

describe('pdf-theme styles', () => {
  it('uses Manrope for body text and Sora for headings', () => {
    expect(pdfFonts).toEqual({ heading: 'Sora', body: 'Manrope' })
    expect(pdfBaseStyles.page.fontFamily).toBe('Manrope')
    expect(pdfBaseStyles.h1.fontFamily).toBe('Sora')
    expect(pdfBaseStyles.h2.fontFamily).toBe('Sora')
    expect(pdfBaseStyles.h3.fontFamily).toBe('Sora')
    expect(pdfBaseStyles.cell.fontFamily).toBe('Manrope')
    expect(pdfBaseStyles.tableHeaderCell.fontFamily).toBe('Manrope')
  })

  it('only uses font weights that are registered', () => {
    expect([pdfBaseStyles.h1.fontWeight, pdfBaseStyles.h2.fontWeight]).toEqual([700, 700])
    expect(pdfBaseStyles.h3.fontWeight).toBe(600)
    expect(pdfBaseStyles.tableHeaderCell.fontWeight).toBe(600)
    expect(pdfBaseStyles.cell.fontWeight).toBe(400)
  })

  it('gives the table header a light background, dark text and an amber rule', () => {
    expect(pdfBaseStyles.tableHeaderRow.backgroundColor).toBe(pdfColors.tableHeaderBg)
    expect(pdfBaseStyles.tableHeaderRow.borderBottom).toBe(`2px solid ${pdfColors.accent}`)
    expect(pdfBaseStyles.tableHeaderCell.color).toBe(pdfColors.tableHeaderText)
  })

  it('gives even table rows the zebra background and does not uppercase headings', () => {
    expect(pdfBaseStyles.tableRowEven.backgroundColor).toBe(pdfColors.zebra)
    expect(pdfBaseStyles.h1).not.toHaveProperty('textTransform')
    expect(pdfBaseStyles.h2).not.toHaveProperty('textTransform')
  })
})
