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
  abbreviation?: string  // optional, max. 4 Zeichen; wird in platzbeschränkten Ansichten anstelle des vollen Namens angezeigt
  withdrawnAfterRound?: number  // set when the team withdrew mid-tournament; value = last round played normally
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
  bufferBetweenGamesMin: number   // changeover time between rounds/waves of games
  breakBetweenRoundsMin: number   // pause between group stage and playoffs, and between swiss rounds
  awardCeremonyMin: number        // duration of the award ceremony after the final
}

export interface Venue {
  name: string
  availabilityWindows: TimeWindow[]
  blackoutPeriods: TimeWindow[]
  setupBufferMin: number     // one-time setup at tournament start
  teardownBufferMin: number  // one-time teardown at tournament end
}

export type TournamentMode = 'round-robin' | 'round-robin+finals' | 'swiss'

export interface TournamentConfig {
  id: string
  name: string
  mode: TournamentMode
  finalsBracketSize?: 2 | 4  // only relevant when mode === 'round-robin+finals'; 4 = semifinals+final, 2 = final only
  swissRounds?: number       // only relevant when mode === 'swiss'; number of swiss rounds to play
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

export type GameStage = 'group' | 'semifinal' | 'final' | 'swiss'

export interface Game {
  id: string
  homeTeamId: string | null  // null = playoff slot not yet decided
  awayTeamId: string | null  // null = playoff slot not yet decided
  homeLabel?: string  // placeholder text shown when homeTeamId is null, e.g. "1. der Vorrunde"
  awayLabel?: string  // placeholder text shown when awayTeamId is null, e.g. "Sieger HF 1"
  stage: GameStage
  field: number          // 1-based; 0 = no real slot (bye)
  scheduledStart: string // "HH:MM"
  scheduledEnd: string   // "HH:MM"
  round: number
  gameNumber: number
  periodScores: PeriodScore[]
  byeTeamId?: string      // set instead of home/awayTeamId when this "game" is a bye
  cancelledReason?: 'withdrawal'  // set when the game was cancelled due to a team withdrawing
}

export interface Schedule {
  id: string
  tournamentId: string
  generatedAt: string    // ISO timestamp
  games: Game[]
  totalDurationMin: number
  estimatedEnd: string   // "HH:MM"
  awardCeremonyEstimate?: string // "HH:MM", only set when a final exists
}
