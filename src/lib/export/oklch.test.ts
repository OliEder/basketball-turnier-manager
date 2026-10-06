import { describe, it, expect } from 'vitest'
import { oklchToHex } from './oklch'

describe('oklchToHex', () => {
  it('maps lightness 1 / chroma 0 to white and lightness 0 to black', () => {
    expect(oklchToHex(1, 0, 0)).toBe('#ffffff')
    expect(oklchToHex(0, 0, 0)).toBe('#000000')
  })

  // Referenzwerte unabhängig gerechnet (Björn Ottosson, OKLab -> linear sRGB -> sRGB-Gamma).
  it.each([
    ['ink-900', 0.13, 0.008, 60, '#0a0705'],
    ['amber-400', 0.8, 0.165, 83, '#f1b200'],
    ['n-50', 0.985, 0.003, 250, '#f9fafc'],
    ['n-100', 0.965, 0.005, 250, '#f1f4f7'],
    ['n-200', 0.925, 0.006, 250, '#e3e7ea'],
    ['n-600', 0.42, 0.011, 250, '#494e53'],
    ['sky-700', 0.45, 0.135, 252, '#00569d'],
  ])('converts DSS token %s', (_name, l, c, h, hex) => {
    expect(oklchToHex(l, c, h)).toBe(hex)
  })

  it('clamps out-of-gamut values into the sRGB range', () => {
    expect(oklchToHex(0.7, 0.4, 150)).toMatch(/^#[0-9a-f]{6}$/)
  })
})
