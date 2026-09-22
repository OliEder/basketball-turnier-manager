import { describe, it, expect } from 'vitest'
import { pdfColors, pdfBaseStyles } from './pdf-theme'

describe('pdf-theme', () => {
  it('exposes the brand color palette used across all PDF exports', () => {
    expect(pdfColors.brandBlue).toBe('#004174')
    expect(pdfColors.textDark).toBe('#002751')
    expect(pdfColors.zebra).toBe('#f0f7fc')
    expect(pdfColors.white).toBe('#fff')
    expect(pdfColors.border).toBe('#e2e8f0')
  })

  it('gives table header cells a blue background and white text', () => {
    expect(pdfBaseStyles.tableHeaderRow.backgroundColor).toBe(pdfColors.brandBlue)
    expect(pdfBaseStyles.tableHeaderCell.color).toBe(pdfColors.white)
  })

  it('gives even table rows the zebra background', () => {
    expect(pdfBaseStyles.tableRowEven.backgroundColor).toBe(pdfColors.zebra)
  })
})
