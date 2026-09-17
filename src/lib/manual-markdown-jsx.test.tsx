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

  it('wraps a level-2 heading and its following content in a <section class="space-y-4">, and level-3 content in a nested <div class="space-y-3">', () => {
    const md = '## Section One\n\nParagraph A.\n\n### Sub One\n\nParagraph B.\n\n## Section Two\n\nParagraph C.\n'
    const tokens = tokenizeManualMarkdown(md)
    render(<>{renderManualMarkdownToJsx(tokens)}</>)

    const sectionOne = screen.getByRole('heading', { name: 'Section One', level: 2 }).closest('section')
    expect(sectionOne).toHaveClass('space-y-4')
    expect(sectionOne).toHaveTextContent('Paragraph A.')
    expect(sectionOne).toHaveTextContent('Sub One')
    expect(sectionOne).toHaveTextContent('Paragraph B.')
    // Section Two's content must NOT leak into Section One's wrapper
    expect(sectionOne).not.toHaveTextContent('Paragraph C.')

    const subOne = screen.getByRole('heading', { name: 'Sub One', level: 3 }).closest('div.space-y-3')
    expect(subOne).toBeTruthy()
    expect(subOne).toHaveTextContent('Paragraph B.')

    const sectionTwo = screen.getByRole('heading', { name: 'Section Two', level: 2 }).closest('section')
    expect(sectionTwo).toHaveClass('space-y-4')
    expect(sectionTwo).toHaveTextContent('Paragraph C.')
    expect(sectionTwo).not.toHaveTextContent('Paragraph A.')
  })
})
