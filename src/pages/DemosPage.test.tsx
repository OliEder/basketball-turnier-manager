import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useTournamentStore } from '@/store/tournament-store'
import { clearAll } from '@/lib/storage'
import { DEMOS } from '@/lib/demos'
import DemosPage from './DemosPage'

const demoJson = (name: string, played = false) =>
  JSON.stringify({
    tournament: { id: 'd1', name, mode: 'round-robin', fields: 1, gameSettings: {}, venue: {}, teams: [{ id: 'x' }] },
    schedule: { id: 's1', tournamentId: 'd1', games: [{ id: 'g1', periodScores: played ? [{ period: 1, homeScore: 1, awayScore: 0 }] : [] }] },
  })

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/demos']}>
      <Routes>
        <Route path="/demos" element={<DemosPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  clearAll()
  useTournamentStore.getState().resetTournament()
  vi.restoreAllMocks()
})

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const loadButton = (title: string) => screen.getByRole('button', { name: new RegExp(`${escapeRegExp(title)}.*laden`) })

describe('DemosPage', () => {
  it('listet alle Demo-Turniere mit Beschreibung', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'Demo-Turniere', level: 1 })).toBeInTheDocument()
    for (const demo of DEMOS) {
      expect(screen.getByRole('heading', { name: demo.title })).toBeInTheDocument()
      expect(screen.getByText(demo.description)).toBeInTheDocument()
    }
  })

  it('lädt ein Demo ohne Rückfrage, wenn das aktuelle Turnier keine Ergebnisse hat, und navigiert', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(demoJson(DEMOS[0].title)))
    renderPage()
    fireEvent.click(loadButton(DEMOS[0].title))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/schedule'))
    expect(useTournamentStore.getState().tournament.name).toBe(DEMOS[0].title)
  })

  it('fragt bei laufendem Turnier nach und importiert erst nach Bestätigung', async () => {
    useTournamentStore.getState().importTournament(
      JSON.parse(demoJson('Altes Turnier', true)).tournament,
      JSON.parse(demoJson('Altes Turnier', true)).schedule,
    )
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(demoJson(DEMOS[0].title)))
    renderPage()
    fireEvent.click(loadButton(DEMOS[0].title))
    const dialog = await screen.findByRole('dialog')
    expect(useTournamentStore.getState().tournament.name).toBe('Altes Turnier')
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ÄNDERN' } })
    fireEvent.click(screen.getByRole('button', { name: 'Bestätigen' }))
    await waitFor(() => expect(useTournamentStore.getState().tournament.name).toBe(DEMOS[0].title))
    expect(dialog).not.toBeInTheDocument()
  })

  it('zeigt einen Fehler, wenn das Laden scheitert', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 404 }))
    renderPage()
    fireEvent.click(loadButton(DEMOS[0].title))
    expect(await screen.findByRole('alert')).toHaveTextContent(/konnte nicht geladen werden/)
  })
})
