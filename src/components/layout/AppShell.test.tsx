import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
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

function renderShell(path = '/teams') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route path="teams" element={<div>Teams page</div>} />
          <Route path="schedule" element={<div>Schedule page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

const nav = () => screen.getByRole('navigation', { name: 'Hauptnavigation' })

function addTwoTeamsAndSchedule() {
  const store = useTournamentStore.getState()
  store.addTeam({ name: 'Team A', logoUrl: '', color: '#000', contact: '' })
  store.addTeam({ name: 'Team B', logoUrl: '', color: '#000', contact: '' })
  store.generateAndSaveSchedule()
}

describe('AppShell', () => {
  it('rendert Kopfleiste und gruppierte Hauptnavigation', () => {
    renderShell()
    expect(screen.getByRole('banner')).toHaveTextContent('Basketball Turnier-Manager')
    for (const name of ['Vorbereiten', 'Spielen', 'Ansehen', 'Hilfe']) {
      expect(within(nav()).getByRole('button', { name })).toBeInTheDocument()
    }
    expect(within(nav()).getByRole('link', { name: 'Export' })).toBeInTheDocument()
  })

  it('markiert die aktuelle Seite mit aria-current', () => {
    renderShell('/teams')
    fireEvent.click(within(nav()).getByRole('button', { name: 'Vorbereiten' }))
    expect(within(nav()).getByRole('link', { name: 'Teams' })).toHaveAttribute('aria-current', 'page')
  })

  it('zeigt „Zeitplan“ ohne Zeitplan als gesperrten Eintrag mit Hinweis', () => {
    renderShell()
    fireEvent.click(within(nav()).getByRole('button', { name: 'Ansehen' }))
    const locked = within(nav()).getByRole('link', { name: /Zeitplan/ })
    expect(locked).toHaveAttribute('aria-disabled', 'true')
    expect(locked).not.toHaveAttribute('href')
    expect(locked).toHaveAttribute('title', 'Bitte zuerst einen Zeitplan generieren')
  })

  it('zeigt „Zeitplan“ mit Zeitplan als Link', () => {
    addTwoTeamsAndSchedule()
    renderShell()
    fireEvent.click(within(nav()).getByRole('button', { name: 'Ansehen' }))
    expect(within(nav()).getByRole('link', { name: 'Zeitplan' })).toHaveAttribute('href', '/schedule')
  })

  it('zeigt im Schweizer System die Turnierübersicht statt des Zeitplans', () => {
    useTournamentStore.getState().setMode('swiss')
    renderShell()
    fireEvent.click(within(nav()).getByRole('button', { name: 'Ansehen' }))
    expect(within(nav()).getByText('Turnierübersicht')).toBeInTheDocument()
    expect(within(nav()).queryByText('Zeitplan')).not.toBeInTheDocument()
  })

  it('schaltet das mobile Menü über den Menü-Button', () => {
    renderShell()
    const toggle = within(nav()).getByRole('button', { name: 'Menü' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('führt nach Klick auf einen Link zur Seite und schließt das Dropdown', () => {
    addTwoTeamsAndSchedule()
    renderShell()
    fireEvent.click(within(nav()).getByRole('button', { name: 'Ansehen' }))
    fireEvent.click(within(nav()).getByRole('link', { name: 'Zeitplan' }))
    expect(screen.getByText('Schedule page')).toBeInTheDocument()
    expect(within(nav()).getByRole('button', { name: 'Ansehen' })).toHaveAttribute('aria-expanded', 'false')
  })
})
