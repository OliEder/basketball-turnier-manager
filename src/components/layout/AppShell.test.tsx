import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { useTournamentStore } from '@/store/tournament-store'
import { clearAll } from '@/lib/storage'
import AppShell from './AppShell'

beforeEach(() => {
  clearAll()
  useTournamentStore.setState({
    tournament: {
      id: 't1', name: 'Test', mode: 'round-robin', fields: 2,
      gameSettings: {
        periodsCount: 4, periodDurationMin: 5, breakBetweenPeriodsMin: 1,
        halfTimeBreakMin: 5, bufferBetweenGamesMin: 5, breakBetweenRoundsMin: 15,
        awardCeremonyMin: 15,
      },
      venue: {
        name: 'Halle', availabilityWindows: [{ start: '09:00', end: '20:00' }],
        blackoutPeriods: [], setupBufferMin: 30, teardownBufferMin: 30,
      },
      teams: [],
    },
    schedule: null,
  })
})

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/teams']}>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route path="teams" element={<div>Teams page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('AppShell', () => {
  it('renders "Zeitplan" as a non-clickable label when no schedule exists (round-robin)', () => {
    renderShell()
    expect(screen.queryByRole('link', { name: 'Zeitplan' })).not.toBeInTheDocument()
    expect(screen.getByText('Zeitplan')).toBeInTheDocument()
  })

  it('renders "Zeitplan" as a clickable link once a schedule with games exists', () => {
    useTournamentStore.getState().addTeam({ name: 'Team A', logoUrl: '', color: '#000', contact: '' })
    useTournamentStore.getState().addTeam({ name: 'Team B', logoUrl: '', color: '#000', contact: '' })
    useTournamentStore.getState().generateAndSaveSchedule()

    renderShell()

    expect(screen.getByRole('link', { name: 'Zeitplan' })).toBeInTheDocument()
  })

  it('renders swiss-mode nav items as non-clickable labels when no schedule exists', () => {
    useTournamentStore.getState().setMode('swiss')
    renderShell()

    expect(screen.queryByRole('link', { name: 'Ergebnisse erfassen' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Turnierübersicht' })).not.toBeInTheDocument()
    expect(screen.getByText('Ergebnisse erfassen')).toBeInTheDocument()
    expect(screen.getByText('Turnierübersicht')).toBeInTheDocument()
  })

  it('renders swiss-mode nav items as clickable links once a schedule with games exists', () => {
    useTournamentStore.getState().setMode('swiss')
    useTournamentStore.getState().addTeam({ name: 'Team A', logoUrl: '', color: '#000', contact: '' })
    useTournamentStore.getState().addTeam({ name: 'Team B', logoUrl: '', color: '#000', contact: '' })
    useTournamentStore.getState().generateAndSaveSchedule()

    renderShell()

    expect(screen.getByRole('link', { name: 'Ergebnisse erfassen' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Turnierübersicht' })).toBeInTheDocument()
  })

  it('always renders Teams, Konfiguration and Export as clickable links', () => {
    renderShell()
    expect(screen.getByRole('link', { name: 'Teams' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Konfiguration' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Export' })).toBeInTheDocument()
  })

  it('renders Anleitung as a clickable link even when no schedule exists', () => {
    renderShell()
    expect(screen.getByRole('link', { name: 'Anleitung' })).toBeInTheDocument()
  })

  it('shows the "Gruppentabellen" nav link only when teams are actually split across multiple groups', () => {
    const { addTeam, setTeamGroup } = useTournamentStore.getState()
    useTournamentStore.getState().setMode('round-robin+finals')
    useTournamentStore.getState().setGroupCount(2)
    addTeam({ name: 'Team 1', logoUrl: '', color: '#000', contact: '' })
    addTeam({ name: 'Team 2', logoUrl: '', color: '#000', contact: '' })
    const teams = useTournamentStore.getState().tournament.teams
    setTeamGroup(teams[0].id, 'A')
    setTeamGroup(teams[1].id, 'A')
    const { unmount } = renderShell()
    expect(screen.queryByText('Gruppentabellen')).not.toBeInTheDocument()
    unmount()

    setTeamGroup(teams[1].id, 'B')
    renderShell()
    expect(screen.getByText('Gruppentabellen')).toBeInTheDocument()
  })

  it('shows "Ergebnisse erfassen" as a link for round-robin mode once a schedule exists', () => {
    useTournamentStore.getState().addTeam({ name: 'Team A', logoUrl: '', color: '#000', contact: '' })
    useTournamentStore.getState().addTeam({ name: 'Team B', logoUrl: '', color: '#000', contact: '' })
    useTournamentStore.getState().generateAndSaveSchedule()

    renderShell()

    expect(screen.getByRole('link', { name: 'Ergebnisse erfassen' })).toHaveAttribute('href', '/group-results')
  })

  it('shows "Ergebnisse erfassen" as a non-clickable label for round-robin mode when no schedule exists', () => {
    renderShell()
    expect(screen.queryByRole('link', { name: 'Ergebnisse erfassen' })).not.toBeInTheDocument()
    expect(screen.getByText('Ergebnisse erfassen')).toBeInTheDocument()
  })

  it('shows the "Gruppentabellen" nav link when teams are split across multiple groups, even if groupCount was never explicitly set', () => {
    const { addTeam, setTeamGroup } = useTournamentStore.getState()
    useTournamentStore.getState().setMode('round-robin+finals')
    addTeam({ name: 'Team 1', logoUrl: '', color: '#000', contact: '' })
    addTeam({ name: 'Team 2', logoUrl: '', color: '#000', contact: '' })
    const teams = useTournamentStore.getState().tournament.teams
    setTeamGroup(teams[0].id, 'A')
    setTeamGroup(teams[1].id, 'B')
    // groupCount was never explicitly set — it should still show the link because teams are actually split
    expect(useTournamentStore.getState().tournament.groupCount).toBeUndefined()
    renderShell()
    expect(screen.getByText('Gruppentabellen')).toBeInTheDocument()
  })

  describe('mobile navigation toggle', () => {
    it('renders a menu toggle button for small screens', () => {
      renderShell()
      expect(screen.getByRole('button', { name: /menü/i })).toBeInTheDocument()
    })

    it('hides the nav panel until the menu toggle is opened, then shows it', () => {
      renderShell()
      const nav = screen.getByRole('navigation', { name: /haupt/i })
      expect(nav).toHaveClass('hidden')

      fireEvent.click(screen.getByRole('button', { name: /menü/i }))
      expect(nav).not.toHaveClass('hidden')
    })

    it('closes the nav panel again after navigating to a page', () => {
      renderShell()
      fireEvent.click(screen.getByRole('button', { name: /menü/i }))
      const nav = screen.getByRole('navigation', { name: /haupt/i })
      expect(nav).not.toHaveClass('hidden')

      fireEvent.click(screen.getByRole('link', { name: 'Teams' }))
      expect(nav).toHaveClass('hidden')
    })

    it('toggles the panel open and closed on repeated clicks of the menu button', () => {
      renderShell()
      const toggle = screen.getByRole('button', { name: /menü/i })
      const nav = screen.getByRole('navigation', { name: /haupt/i })

      fireEvent.click(toggle)
      expect(nav).not.toHaveClass('hidden')
      fireEvent.click(toggle)
      expect(nav).toHaveClass('hidden')
    })
  })
})
