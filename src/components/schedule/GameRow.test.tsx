import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useTournamentStore } from '@/store/tournament-store'
import { clearAll } from '@/lib/storage'
import GameRow from './GameRow'
import type { Game } from '@/types'

beforeEach(() => {
  clearAll()
  useTournamentStore.setState({
    tournament: {
      id: 't1', name: 'Test', mode: 'swiss', fields: 1,
      gameSettings: {
        periodsCount: 4, periodDurationMin: 5, breakBetweenPeriodsMin: 1,
        halfTimeBreakMin: 5, bufferBetweenGamesMin: 5, breakBetweenRoundsMin: 15,
        awardCeremonyMin: 15,
      },
      venue: {
        name: 'Halle', availabilityWindows: [{ start: '09:00', end: '20:00' }],
        blackoutPeriods: [], setupBufferMin: 30, teardownBufferMin: 30,
      },
      teams: [
        { id: 'h', name: 'Team Home', logoUrl: '', color: '#000', contact: '', players: [] },
        { id: 'a', name: 'Team Away', logoUrl: '', color: '#000', contact: '', players: [] },
      ],
    },
    schedule: null,
  })
})

const baseGame: Game = {
  id: 'g1', homeTeamId: 'h', awayTeamId: 'a', stage: 'swiss', field: 1,
  scheduledStart: '10:00', scheduledEnd: '10:20', round: 1, gameNumber: 1,
  periodScores: [],
}

describe('GameRow', () => {
  it('shows the editable start time by default (no showResult prop)', () => {
    render(<GameRow game={baseGame} />)
    expect(screen.getByLabelText('Startzeit Spiel 1')).toBeInTheDocument()
  })

  it('shows the editable start time when showResult is set but no result exists yet', () => {
    render(<GameRow game={baseGame} showResult />)
    expect(screen.getByLabelText('Startzeit Spiel 1')).toBeInTheDocument()
  })

  it('shows the final score instead of the time when showResult is set and a result exists', () => {
    const played: Game = { ...baseGame, periodScores: [{ period: 1, homeScore: 45, awayScore: 37 }] }
    render(<GameRow game={played} showResult />)
    expect(screen.queryByLabelText('Startzeit Spiel 1')).not.toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('37')).toBeInTheDocument()
    expect(screen.getByLabelText('Endstand Spiel 1: 45:37')).toBeInTheDocument()
  })
})
