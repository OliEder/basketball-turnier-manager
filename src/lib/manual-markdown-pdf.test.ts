import { describe, it, expect } from 'vitest'
import { isValidElement } from 'react'
import { tokenizeManualMarkdown } from './markdown-tokens'
import { renderManualMarkdownToPdf } from './manual-markdown-pdf'

function toPlainJson(el: unknown): unknown {
  return JSON.stringify(el, (_key, value) =>
    isValidElement(value) ? { type: (value as { type: unknown }).type, props: (value as { props: unknown }).props } : value,
  )
}

describe('renderManualMarkdownToPdf', () => {
  it('renders a heading as a Text element and a paragraph as a Text element', () => {
    const tokens = tokenizeManualMarkdown('## Title\n\nBody text.\n')
    const elements = renderManualMarkdownToPdf(tokens, {})
    expect(elements.every(isValidElement)).toBe(true)
    expect(toPlainJson(elements)).toContain('Title')
    expect(toPlainJson(elements)).toContain('Body text.')
  })

  it('renders an image token using the provided data-URI map, with alt text as a visible caption', () => {
    const tokens = tokenizeManualMarkdown('![Leere Teamübersicht](01-teams-leer.png)\n')
    const elements = renderManualMarkdownToPdf(tokens, { '01-teams-leer.png': 'data:image/png;base64,AAAA' })
    const json = toPlainJson(elements)
    expect(json).toContain('data:image/png;base64,AAAA')
    expect(json).toContain('Leere Teamübersicht')
  })

  it('renders a callout token with a highlighted background', () => {
    const tokens = tokenizeManualMarkdown('::: callout Hinweis\nWichtig.\n:::\n')
    const elements = renderManualMarkdownToPdf(tokens, {})
    const json = toPlainJson(elements)
    expect(json).toContain('Hinweis')
    expect(json).toContain('Wichtig.')
    expect(json).toContain('#f0f7fc')
  })

  it('renders a list as one Text per item prefixed with a bullet', () => {
    const tokens = tokenizeManualMarkdown('- first\n- second\n')
    const elements = renderManualMarkdownToPdf(tokens, {})
    const json = toPlainJson(elements)
    expect(json).toContain('• first')
    expect(json).toContain('• second')
  })
})
