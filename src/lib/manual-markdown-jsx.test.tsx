import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { tokenizeManualMarkdown } from './markdown-tokens'
import { renderManualMarkdownToJsx } from './manual-markdown-jsx'

describe('renderManualMarkdownToJsx', () => {
  it('renders a level-2 heading, a paragraph with bold text, and a list', () => {
    const md = '## Section Title\n\nSome **bold** text.\n\n- item one\n- item two\n'
    const tokens = tokenizeManualMarkdown(md)
    render(<>{renderManualMarkdownToJsx(tokens)}</>)

    expect(screen.getByRole('heading', { name: 'Section Title', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('bold', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText('item one')).toBeInTheDocument()
    expect(screen.getByText('item two')).toBeInTheDocument()
  })

  it('renders an image token as an <img> with its alt text', () => {
    const md = '![Leere Teamübersicht](01-teams-leer.png)\n'
    const tokens = tokenizeManualMarkdown(md)
    render(<>{renderManualMarkdownToJsx(tokens)}</>)

    const img = screen.getByRole('img', { name: 'Leere Teamübersicht' })
    expect(img).toHaveAttribute('src', expect.stringContaining('01-teams-leer.png'))
  })

  it('renders a callout token with its title and body', () => {
    const md = '::: callout Hinweis\nDies ist wichtig.\n:::\n'
    const tokens = tokenizeManualMarkdown(md)
    render(<>{renderManualMarkdownToJsx(tokens)}</>)

    expect(screen.getByText('Hinweis')).toBeInTheDocument()
    expect(screen.getByText(/Dies ist wichtig/)).toBeInTheDocument()
  })

  it('renders a link with its href', () => {
    const md = '[Downloadlink](demos/example.json)\n'
    const tokens = tokenizeManualMarkdown(md)
    render(<>{renderManualMarkdownToJsx(tokens)}</>)

    expect(screen.getByRole('link', { name: 'Downloadlink' })).toHaveAttribute('href', expect.stringContaining('demos/example.json'))
  })
})
