import { describe, it, expect } from 'vitest'
import { isValidElement } from 'react'
import { PageTitle } from './pdf-title'
import { pdfColors } from './pdf-theme'

function serialize(node: unknown): string {
  return JSON.stringify(node, (_key, value) =>
    isValidElement(value) ? { type: (value as { type: unknown }).type, props: (value as { props: unknown }).props } : value,
  )
}

describe('PageTitle', () => {
  it('renders the title text followed by an amber accent rule', () => {
    const element = PageTitle('Sommer-Cup 2026')
    expect(isValidElement(element)).toBe(true)
    const json = serialize(element)
    expect(json).toContain('Sommer-Cup 2026')
    expect(json).toContain(pdfColors.accent)
  })
})
