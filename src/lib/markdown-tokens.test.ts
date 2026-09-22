import { describe, it, expect } from 'vitest'
import { tokenizeManualMarkdown } from './markdown-tokens'

describe('tokenizeManualMarkdown', () => {
  it('tokenizes a heading and a paragraph', () => {
    const tokens = tokenizeManualMarkdown('# Title\n\nSome text.\n')
    expect(tokens[0]).toMatchObject({ type: 'heading', depth: 1, text: 'Title' })
    expect(tokens.some(t => t.type === 'paragraph')).toBe(true)
  })

  it('converts a ::: callout block into a single callout token carrying its title and inner tokens', () => {
    const md = '::: callout Wichtiger Hinweis\nDies ist der Inhalt.\n:::\n'
    const tokens = tokenizeManualMarkdown(md)
    const callout = tokens.find(t => t.type === 'callout') as { type: string; title: string; tokens: { type: string }[] }
    expect(callout).toBeDefined()
    expect(callout.title).toBe('Wichtiger Hinweis')
    expect(callout.tokens.some(t => t.type === 'paragraph')).toBe(true)
  })

  it('leaves normal markdown outside a callout block untouched', () => {
    const md = '# Heading\n\n::: callout Note\nInside.\n:::\n\nAfter.\n'
    const tokens = tokenizeManualMarkdown(md)
    expect(tokens[0].type).toBe('heading')
    expect(tokens.some(t => t.type === 'callout')).toBe(true)
    expect(tokens.some(t => t.type === 'paragraph' && (t as { text?: string }).text === 'After.')).toBe(true)
  })

  it('recovers a callout block even when not followed by a blank line, without losing the following text', () => {
    const md = '::: callout Hinweis\nInhalt.\n:::\nDirekt danach, ohne Leerzeile.\n'
    const tokens = tokenizeManualMarkdown(md)
    const callout = tokens.find(t => t.type === 'callout') as { type: string; title: string }
    expect(callout).toBeDefined()
    expect(callout.title).toBe('Hinweis')
    const fullText = tokens.map(t => (t as { raw?: string }).raw ?? '').join('')
    expect(fullText).not.toContain('CALLOUT_PLACEHOLDER')
    expect(tokens.some(t => t.type === 'paragraph' && (t as { text?: string }).text?.includes('Direkt danach'))).toBe(true)
  })
})
