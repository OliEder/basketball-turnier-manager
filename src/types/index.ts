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
  groupId?: string  // Gruppenzuordnung in der Mehrgruppen-Vorrunde; fehlt = Standardgruppe "A"
  withdrawnAfterStage?: 'group' | 'finals'  // set when the team withdrew during the group phase or
    // during the finals stage; distinct from the swiss-only withdrawnAfterRound above
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
  groupCount?: number        // only relevant when mode === 'round-robin+finals'; number of parallel group-stage groups, default 1
  doubleRoundRobin?: boolean // if true, each group plays a return leg (home/away swapped), default false
  finalsVariant?: 'endrunde-4'  // only relevant when mode === 'round-robin+finals' and groupCount > 1;
    // more variants ('endrunde-1' | 'endrunde-2' | ...) are added in a later phase — see
    // docs/superpowers/specs/2026-09-12-finals-variants-design.md
  dropoutHandling?: 'walkover' | 'next-best-fills-in'  // default 'next-best-fills-in'; governs what
    // happens when a team withdraws after already qualifying for a finals cohort
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

export type GameStage = 'group' | 'semifinal' | 'final' | 'swiss' | 'placement'
  // 'placement' = a round-robin placement-cohort game (Endrunde 4), e.g. "all group winners play
  // each other for places 1-4"

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
  groupId?: string        // which group this game belongs to (only stage === 'group' with multiple groups)
  rankTier?: number  // which placement cohort this game belongs to (1 = group winners' cohort playing
    // for places 1-4, 2 = runners-up cohort playing for places 5-8, ...); only set when stage === 'placement'
  placementFrom?: number  // the best (lowest-numbered) place this cohort is playing for, e.g. 1, 5, 9;
    // only set when stage === 'placement' — used to label/sort the final standings page
  homeSourceRank?: { groupId: string; rank: number }  // which group-phase rank feeds the home slot;
    // stays set even after resolution, so a later group-phase correction can re-resolve this slot
  awaySourceRank?: { groupId: string; rank: number }  // same for the away slot
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
