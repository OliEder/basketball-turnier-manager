import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { TournamentConfig, Team, Schedule, GameSettings, Venue, PeriodScore } from '@/types'
import { saveTournament, loadTournament, saveSchedule, loadSchedule } from '@/lib/storage'
import { generateSchedule } from '@/lib/schedule-generator'
import { calcGameDurationMin, addMinutes } from '@/lib/game-duration'

const DEFAULT_GAME_SETTINGS: GameSettings = {
  periodsCount: 4,
  periodDurationMin: 5,
  breakBetweenPeriodsMin: 1,
  halfTimeBreakMin: 5,
  bufferBetweenGamesMin: 5,
  breakBetweenRoundsMin: 15,
  awardCeremonyMin: 15,
}

const DEFAULT_VENUE: Venue = {
  name: '',
  availabilityWindows: [{ start: '09:00', end: '20:00' }],
  blackoutPeriods: [],
  setupBufferMin: 30,
  teardownBufferMin: 30,
}

const DEFAULT_TOURNAMENT: TournamentConfig = {
  id: uuidv4(),
  name: '',
  mode: 'round-robin',
  finalsBracketSize: 4,
  fields: 2,
  gameSettings: DEFAULT_GAME_SETTINGS,
  venue: DEFAULT_VENUE,
  teams: [],
}

interface TournamentStore {
  tournament: TournamentConfig
  schedule: Schedule | null
  // Tournament actions
  setTournamentName: (name: string) => void
  setMode: (mode: TournamentConfig['mode']) => void
  setFinalsBracketSize: (size: 2 | 4) => void
  setFields: (fields: number) => void
  updateGameSettings: (settings: Partial<GameSettings>) => void
  updateVenue: (venue: Partial<Venue>) => void
  // Team actions
  addTeam: (team: Omit<Team, 'id' | 'players'>) => void
  updateTeam: (id: string, updates: Partial<Omit<Team, 'id'>>) => void
  removeTeam: (id: string) => void
  // Schedule actions
  generateAndSaveSchedule: () => void
  updateGameTime: (gameId: string, scheduledStart: string) => void
  submitGameResult: (gameId: string, periodScores: PeriodScore[]) => void
  // Persistence
  loadFromStorage: () => void
}

export const useTournamentStore = create<TournamentStore>((set, get) => ({
  tournament: loadTournament() ?? DEFAULT_TOURNAMENT,
  schedule: loadSchedule(),

  setTournamentName: (name) => {
    set(s => ({ tournament: { ...s.tournament, name } }))
    saveTournament(get().tournament)
  },

  setMode: (mode) => {
    set(s => ({
      tournament: {
        ...s.tournament,
        mode,
        finalsBracketSize: mode === 'round-robin+finals' ? (s.tournament.finalsBracketSize ?? 4) : s.tournament.finalsBracketSize,
      },
    }))
    saveTournament(get().tournament)
  },

  setFinalsBracketSize: (size) => {
    set(s => ({ tournament: { ...s.tournament, finalsBracketSize: size } }))
    saveTournament(get().tournament)
  },

  setFields: (fields) => {
    set(s => ({ tournament: { ...s.tournament, fields } }))
    saveTournament(get().tournament)
  },

  updateGameSettings: (settings) => {
    set(s => ({
      tournament: {
        ...s.tournament,
        gameSettings: { ...s.tournament.gameSettings, ...settings },
      },
    }))
    saveTournament(get().tournament)
  },

  updateVenue: (venue) => {
    set(s => ({
      tournament: {
        ...s.tournament,
        venue: { ...s.tournament.venue, ...venue },
      },
    }))
    saveTournament(get().tournament)
  },

  addTeam: (teamData) => {
    const team: Team = { ...teamData, id: uuidv4(), players: [] }
    set(s => ({
      tournament: { ...s.tournament, teams: [...s.tournament.teams, team] },
    }))
    saveTournament(get().tournament)
  },

  updateTeam: (id, updates) => {
    set(s => ({
      tournament: {
        ...s.tournament,
        teams: s.tournament.teams.map(t => t.id === id ? { ...t, ...updates } : t),
      },
    }))
    saveTournament(get().tournament)
  },

  removeTeam: (id) => {
    set(s => ({
      tournament: {
        ...s.tournament,
        teams: s.tournament.teams.filter(t => t.id !== id),
      },
    }))
    saveTournament(get().tournament)
  },

  generateAndSaveSchedule: () => {
    const schedule = generateSchedule(get().tournament)
    set({ schedule })
    saveSchedule(schedule)
  },

  updateGameTime: (gameId, scheduledStart) => {
    const { schedule, tournament } = get()
    if (!schedule) return
    const duration = calcGameDurationMin(tournament.gameSettings)
    const updatedGames = schedule.games.map(g =>
      g.id === gameId
        ? { ...g, scheduledStart, scheduledEnd: addMinutes(scheduledStart, duration) }
        : g
    )
    const updated = { ...schedule, games: updatedGames }
    set({ schedule: updated })
    saveSchedule(updated)
  },

  submitGameResult: (gameId, periodScores) => {
    const { schedule } = get()
    if (!schedule) return
    const game = schedule.games.find(g => g.id === gameId)
    if (!game) return
    if (!game.homeTeamId || !game.awayTeamId) {
      throw new Error('Spiel hat noch keine feststehenden Teams')
    }
    const updatedGames = schedule.games.map(g =>
      g.id === gameId ? { ...g, periodScores } : g
    )
    const updated = { ...schedule, games: updatedGames }
    set({ schedule: updated })
    saveSchedule(updated)
  },

  loadFromStorage: () => {
    set({
      tournament: loadTournament() ?? DEFAULT_TOURNAMENT,
      schedule: loadSchedule(),
    })
  },
}))
