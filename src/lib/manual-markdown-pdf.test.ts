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

  it('renders italic inline text with a fontStyle: italic Text element', () => {
    const tokens = tokenizeManualMarkdown('Some *italic* text.\n')
    const elements = renderManualMarkdownToPdf(tokens, {})
    const json = toPlainJson(elements)
    expect(json).toContain('italic')
    expect(json).toContain('fontStyle')
  })

  it('renders an inline link as underlined text', () => {
    const tokens = tokenizeManualMarkdown('Some [link text](https://example.com) here.\n')
    const elements = renderManualMarkdownToPdf(tokens, {})
    const json = toPlainJson(elements)
    expect(json).toContain('link text')
    expect(json).toContain('textDecoration')
  })

  it('falls back to plain rendered text for an inline token type it has no dedicated case for (e.g. inline code)', () => {
    const tokens = tokenizeManualMarkdown('Some `code` here.\n')
    const elements = renderManualMarkdownToPdf(tokens, {})
    const json = toPlainJson(elements)
    expect(json).toContain('code')
  })

  it('renders an inline image that shares a paragraph with other text (not a standalone image line)', () => {
    const tokens = tokenizeManualMarkdown('See this: ![Diagramm](diagram.png) for details.\n')
    const elements = renderManualMarkdownToPdf(tokens, { 'diagram.png': 'data:image/png;base64,BBBB' })
    const json = toPlainJson(elements)
    expect(json).toContain('data:image/png;base64,BBBB')
    expect(json).toContain('Diagramm')
    expect(json).toContain('See this:')
    expect(json).toContain('for details.')
  })

  it('renders a top-level image token that is not wrapped in a paragraph (e.g. inside a callout body split by marked)', () => {
    // A callout's inner markdown is tokenized independently by marked.lexer(), which can
    // produce a top-level `image` token (not nested in a paragraph) in some inputs -- this
    // exercises that code path directly rather than relying on marked's exact behavior.
    const tokens = tokenizeManualMarkdown('![Direktes Bild](direct.png)\n')
    const topLevelImageToken = tokens.find(t => t.type === 'image')
    // If marked nested it in a paragraph as usual, force a genuine top-level image token to
    // exercise the dedicated top-level `case 'image'` branch in renderManualMarkdownToPdf.
    const forcedTokens = topLevelImageToken
      ? tokens
      : [{ type: 'image' as const, raw: '![Direktes Bild](direct.png)', href: 'direct.png', title: null, text: 'Direktes Bild' }]
    const elements = renderManualMarkdownToPdf(forcedTokens, { 'direct.png': 'data:image/png;base64,CCCC' })
    const json = toPlainJson(elements)
    expect(json).toContain('data:image/png;base64,CCCC')
    expect(json).toContain('Direktes Bild')
  })
})
