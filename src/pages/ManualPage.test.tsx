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

  it('links to all five demo tournament files', () => {
    render(<ManualPage />)
    const demoFiles = [
      '01-jeder-gegen-jeden-9-teams-laufend.json',
      '02-gruppenphase-endrunde-9-teams-laufend.json',
      '03-schweizer-system-9-teams-laufend.json',
      '04-grossturnier-64-teams-16-gruppen-ungespielt.json',
      '05-grossturnier-64-teams-16-gruppen-laufend.json',
    ]
    const links = screen.getAllByRole('link').map(link => link.getAttribute('href'))
    for (const file of demoFiles) {
      expect(links.some(href => href?.includes(file))).toBe(true)
    }
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

  it('renders a floating back-to-top button', () => {
    render(<ManualPage />)
    expect(screen.getByRole('button', { name: 'Nach oben' })).toBeInTheDocument()
  })

  it('renders a screenshot image for each referenced screenshot', () => {
    render(<ManualPage />)
    const images = screen.getAllByRole('img')
    expect(images.length).toBe(29)
    expect(images[0]).toHaveAttribute('src', expect.stringContaining('01-teams-leer.png'))
  })

  it('renders screenshots for the new group-configuration and group-standings sections', () => {
    render(<ManualPage />)
    const images = screen.getAllByRole('img')
    const sources = images.map(img => img.getAttribute('src'))
    expect(sources.some(src => src?.includes('24-konfiguration-gruppen.png'))).toBe(true)
    expect(sources.some(src => src?.includes('26-gruppentabellen-64-teams.png'))).toBe(true)
    expect(sources.some(src => src?.includes('27-konfiguration-gruppen-64-teams.png'))).toBe(true)
  })

  it('renders screenshots for the tabbed group-overview navigation, printing, and the new results-entry page', () => {
    render(<ManualPage />)
    const images = screen.getAllByRole('img')
    const sources = images.map(img => img.getAttribute('src'))
    expect(sources.some(src => src?.includes('28-gruppentabellen-tabs-drucken.png'))).toBe(true)
    expect(sources.some(src => src?.includes('29-ergebnisse-erfassen-gruppenphase.png'))).toBe(true)
    expect(sources.some(src => src?.includes('30-ergebnis-gespeichert-link-gruppentabelle.png'))).toBe(true)
  })

  it('documents the results-entry page for the group stage', () => {
    render(<ManualPage />)
    expect(
      screen.getByRole('heading', { name: '3.2 Jeder gegen Jeden und Gruppenphase: Ergebnisse erfassen' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/Status/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Korrigieren/).length).toBeGreaterThan(0)
  })

  it('links to the results-entry sub-section from the table of contents', () => {
    render(<ManualPage />)
    const toc = screen.getByRole('navigation', { name: /inhalt/i })
    expect(
      within(toc).getByRole('link', { name: '3.2 Jeder gegen Jeden und Gruppenphase: Ergebnisse erfassen' }),
    ).toHaveAttribute('href', '#konfiguration-gruppenergebnisse')
  })

  it('documents multi-group round-robin and double round-robin configuration', () => {
    render(<ManualPage />)
    expect(
      screen.getByRole('heading', { name: '3.1 Jeder gegen Jeden und Gruppenphase: Gruppen & Rückrunde' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/Anzahl Gruppen/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Mit Rückspiel \(Hin- und Rückrunde\)/).length).toBeGreaterThan(0)
  })

  it('documents the group-standings overview page', () => {
    render(<ManualPage />)
    expect(
      screen.getByRole('heading', { name: '5.1 Gruppentabellen (bei mehreren Gruppen)' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Direkter Vergleich/)).toBeInTheDocument()
  })

  it('links to the new sub-sections from the table of contents', () => {
    render(<ManualPage />)
    const toc = screen.getByRole('navigation', { name: /inhalt/i })
    expect(within(toc).getByRole('link', { name: /Gruppen & Rückrunde/i })).toHaveAttribute(
      'href',
      '#konfiguration-gruppen',
    )
    expect(within(toc).getByRole('link', { name: /Gruppentabellen/i })).toHaveAttribute(
      'href',
      '#turnieruebersicht-gruppentabellen',
    )
  })
})
