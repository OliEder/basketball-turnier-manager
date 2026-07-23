export interface Player {
  id: string
  firstName: string
  lastName: string
  jerseyNumber: string // 1-2 digits, e.g. "00", "7" — validated as /^[0-9]{1,2}$/
}

export interface Team {
  id: string
  name: string
  logoUrl: string
  color: string   // hex, e.g. "#004174"
  contact: string
  players: Player[]
}

export interface TimeWindow {
  start: string    // "HH:MM"
  end: string      // "HH:MM"
  reason?: string
}

export interface GameSettings {
  periodsCount: number        // e.g. 4 quarters
  periodDurationMin: number   // e.g. 5 minutes per quarter
  breakBetweenPeriodsMin: number  // short break between periods
  halfTimeBreakMin: number        // longer halftime break (includes side switch)
  bufferBetweenGamesMin: number   // changeover time between games on same field
}

export interface Venue {
  name: string
  availabilityWindows: TimeWindow[]
  blackoutPeriods: TimeWindow[]
  setupBufferMin: number     // one-time setup at tournament start
  teardownBufferMin: number  // one-time teardown at tournament end
}

export type TournamentMode = 'round-robin' | 'round-robin+finals'

export interface TournamentConfig {
  id: string
  name: string
  mode: TournamentMode
  fields: number
  gameSettings: GameSettings
  venue: Venue
  teams: Team[]
}

export interface PeriodScore {
  period: number   // 1-based
  homeScore: number
  awayScore: number
}

export interface Game {
  id: string
  homeTeamId: string
  awayTeamId: string
  field: number          // 1-based
  scheduledStart: string // "HH:MM"
  scheduledEnd: string   // "HH:MM"
  round: number
  gameNumber: number
  periodScores: PeriodScore[]
}

export interface Schedule {
  id: string
  tournamentId: string
  generatedAt: string    // ISO timestamp
  games: Game[]
  totalDurationMin: number
  estimatedEnd: string   // "HH:MM"
}
