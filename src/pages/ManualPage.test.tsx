import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import ManualPage from './ManualPage'

describe('ManualPage', () => {
  it('renders the manual heading and all numbered sections', () => {
    render(<ManualPage />)
    expect(screen.getByText(/Nutzeranleitung: Basketball Turnier-Manager/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '1. Überblick' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '4. Ergebnisse erfassen' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '9. Kurzreferenz: Typischer Ablauf' })).toBeInTheDocument()
  })

  it('renders a table of contents with anchor links to every section', () => {
    render(<ManualPage />)
    const toc = screen.getByRole('navigation', { name: /inhalt/i })
    expect(within(toc).getByRole('link', { name: /Überblick/i })).toHaveAttribute('href', '#ueberblick')
    expect(within(toc).getByRole('link', { name: /Kurzreferenz/i })).toHaveAttribute('href', '#kurzreferenz')
    expect(within(toc).getByRole('link', { name: /Turnierübersicht/i })).toHaveAttribute('href', '#turnieruebersicht')
    expect(within(toc).getByRole('link', { name: /zieht sich zurück/i })).toHaveAttribute(
      'href',
      '#ergebnisse-zurueckziehen',
    )
  })

  it('renders the PDF download button', () => {
    render(<ManualPage />)
    expect(screen.getByRole('button', { name: 'Als PDF herunterladen' })).toBeInTheDocument()
  })

  it('renders a screenshot image for each referenced screenshot', () => {
    render(<ManualPage />)
    const images = screen.getAllByRole('img')
    expect(images.length).toBe(23)
    expect(images[0]).toHaveAttribute('src', expect.stringContaining('01-teams-leer.png'))
  })
})
