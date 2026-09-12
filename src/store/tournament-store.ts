import { create, type StoreApi } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { TournamentConfig, Team, Schedule, GameSettings, Venue, PeriodScore, Game } from '@/types'
import { saveTournament, loadTournament, saveSchedule, loadSchedule, clearSchedule, clearAll } from '@/lib/storage'
import { generateSchedule } from '@/lib/schedule-generator'
import { calcGameDurationMin, addMinutes } from '@/lib/game-duration'
import { computeStandings } from '@/lib/standings'
import { pairNextSwissRound } from '@/lib/swiss-pairing'
import { computeGroupStandings } from '@/lib/group-standings'

export function getCurrentSwissRound(games: Game[]): number {
  const decided = games.filter(g =>
    g.stage === 'swiss' && (g.homeTeamId !== null || g.byeTeamId !== undefined)
  )
  if (decided.length === 0) return 0
  return Math.max(...decided.map(g => g.round))
}

export function isRoundFullyEvaluated(games: Game[], round: number): boolean {
  const roundGames = games.filter(g => g.stage === 'swiss' && g.round === round)
  return roundGames.every(g =>
    g.byeTeamId !== undefined || g.cancelledReason || g.periodScores.length > 0
  )
}

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
  isTournamentLocked: () => boolean
  // Tournament actions
  setTournamentName: (name: string) => void
  setMode: (mode: TournamentConfig['mode']) => void
  setFinalsBracketSize: (size: 2 | 4) => void
  setGroupCount: (count: number) => void
  setDoubleRoundRobin: (enabled: boolean) => void
  setFinalsVariant: (variant: TournamentConfig['finalsVariant']) => void
  setDropoutHandling: (handling: NonNullable<TournamentConfig['dropoutHandling']>) => void
  setSwissRounds: (rounds: number) => void
  setFields: (fields: number) => void
  updateGameSettings: (settings: Partial<GameSettings>) => void
  updateVenue: (venue: Partial<Venue>) => void
  // Team actions
  addTeam: (team: Omit<Team, 'id' | 'players'>) => void
  updateTeam: (id: string, updates: Partial<Omit<Team, 'id'>>) => void
  setTeamGroup: (id: string, groupId: string) => void
  removeTeam: (id: string) => void
  // Schedule actions
  generateAndSaveSchedule: () => void
  updateGameTime: (gameId: string, scheduledStart: string) => void
  submitGameResult: (gameId: string, periodScores: PeriodScore[]) => void
  advanceSwissRound: () => void
  advanceSwissRoundManually: (pairs: [string, string][], byeTeamId?: string) => void
  withdrawTeam: (teamId: string) => void
  correctGameResult: (gameId: string, periodScores: PeriodScore[]) => void
  // Persistence
  importTournament: (tournament: TournamentConfig, schedule: Schedule | null) => void
  loadFromStorage: () => void
  resetTournament: () => void
}

function applySwissPairing(
  set: StoreApi<TournamentStore>['setState'],
  get: StoreApi<TournamentStore>['getState'],
  round: number,
  pairs: [string, string][],
  byeTeamId: string | undefined,
): void {
  const { schedule } = get()
  if (!schedule) return
  const placeholders = schedule.games.filter(g => g.stage === 'swiss' && g.round === round)
  const teamSlots = placeholders.filter(g => g.field > 0)
  const byeSlot = placeholders.find(g => g.field === 0)

  const updatedGames = schedule.games.map(g => {
    const slotIndex = teamSlots.findIndex(slot => slot.id === g.id)
    if (slotIndex !== -1 && pairs[slotIndex]) {
      return { ...g, homeTeamId: pairs[slotIndex][0], awayTeamId: pairs[slotIndex][1], homeLabel: undefined, awayLabel: undefined }
    }
    if (byeSlot && g.id === byeSlot.id && byeTeamId) {
      return { ...g, byeTeamId }
    }
    return g
  })

  const updated = { ...schedule, games: updatedGames }
  set({ schedule: updated })
  saveSchedule(updated)
}

function reshapeFutureSwissRounds(games: Game[], afterRound: number, activeTeamCount: number): Game[] {
  const gamesPerFutureRound = Math.floor(activeTeamCount / 2)
  const needsBye = activeTeamCount % 2 === 1

  const untouched = games.filter(g => g.stage !== 'swiss' || g.round <= afterRound)
  const futureRounds = new Set(
    games.filter(g => g.stage === 'swiss' && g.round > afterRound).map(g => g.round)
  )

  const reshaped: Game[] = []
  for (const round of futureRounds) {
    const roundGames = games.filter(g => g.stage === 'swiss' && g.round === round)
    const teamSlots = roundGames.filter(g => g.field > 0)
    const byeSlots = roundGames.filter(g => g.field === 0)

    const keptTeamSlots = teamSlots.slice(0, gamesPerFutureRound)
    reshaped.push(...keptTeamSlots.map((g, i) => ({
      ...g,
      homeLabel: `Runde ${round} – Spiel ${i + 1} (Heim)`,
      awayLabel: `Runde ${round} – Spiel ${i + 1} (Auswärts)`,
    })))

    if (needsBye) {
      // Even team counts never get a pre-provisioned bye slot for future rounds (see swiss-schedule.ts);
      // if a withdrawal makes the active count odd, repurpose a surplus team-slot into a bye instead.
      const existingBye = byeSlots[0]
      const surplusTeamSlot = teamSlots[gamesPerFutureRound]
      const byeSource = existingBye ?? surplusTeamSlot
      if (byeSource) {
        reshaped.push({
          ...byeSource,
          homeTeamId: null,
          awayTeamId: null,
          homeLabel: undefined,
          awayLabel: undefined,
          field: 0,
        })
      }
    }
  }

  return [...untouched, ...reshaped]
}

function withdrawSwissTeam(
  set: StoreApi<TournamentStore>['setState'],
  get: StoreApi<TournamentStore>['getState'],
  teamId: string,
): void {
  const { schedule, tournament } = get()
  if (!schedule) return
  const currentRound = getCurrentSwissRound(schedule.games)

  const gamesAfterCancellation = schedule.games.map(g => {
    if (g.round !== currentRound || g.stage !== 'swiss') return g
    const involvesWithdrawing = g.homeTeamId === teamId || g.awayTeamId === teamId
    if (involvesWithdrawing && g.periodScores.length === 0) {
      return {
        ...g,
        cancelledReason: 'withdrawal' as const,
        periodScores: [{ period: 1, homeScore: 0, awayScore: 0 }],
      }
    }
    return g
  })

  const activeTeamCount = tournament.teams.filter(t => t.id !== teamId && !t.withdrawnAfterRound).length
  const updatedGames = reshapeFutureSwissRounds(gamesAfterCancellation, currentRound, activeTeamCount)

  const updatedTeams = tournament.teams.map(t =>
    t.id === teamId ? { ...t, withdrawnAfterRound: currentRound } : t
  )

  const updatedSchedule = { ...schedule, games: updatedGames }
  const updatedTournament = { ...tournament, teams: updatedTeams }
  set({ schedule: updatedSchedule, tournament: updatedTournament })
  saveSchedule(updatedSchedule)
  saveTournament(updatedTournament)
}

/**
 * Non-swiss withdrawal: cancels the team's remaining unplayed games (group-stage or, once already
 * resolved into a placement cohort, placement-stage) as a walkover. Unlike swiss withdrawal, there
 * is no future-round reshaping — both group-phase pairings and placement-cohort round-robins are
 * fixed at schedule-generation time and never regenerated round-by-round.
 */
function withdrawNonSwissTeam(
  set: StoreApi<TournamentStore>['setState'],
  get: StoreApi<TournamentStore>['getState'],
  teamId: string,
): void {
  const { schedule, tournament } = get()
  if (!schedule) return

  const wasInPlacementStage = schedule.games.some(
    g => g.stage === 'placement' && (g.homeTeamId === teamId || g.awayTeamId === teamId)
  )

  const updatedGames = schedule.games.map(g => {
    if (g.stage !== 'group' && g.stage !== 'placement') return g
    const involvesWithdrawing = g.homeTeamId === teamId || g.awayTeamId === teamId
    if (involvesWithdrawing && g.periodScores.length === 0) {
      return {
        ...g,
        cancelledReason: 'withdrawal' as const,
        periodScores: [{ period: 1, homeScore: 0, awayScore: 0 }],
      }
    }
    return g
  })

  const updatedTeams = tournament.teams.map(t =>
    t.id === teamId ? { ...t, withdrawnAfterStage: wasInPlacementStage ? 'finals' as const : 'group' as const } : t
  )

  // A group-stage withdrawal can be the last unplayed game in its group, newly completing that
  // group — re-run placeholder resolution so any waiting placement game picks this up immediately,
  // consistent with submitGameResult/correctGameResult.
  const resolvedGames = resolvePlaceholders(updatedGames, updatedTeams)

  const updatedSchedule = { ...schedule, games: resolvedGames }
  const updatedTournament = { ...tournament, teams: updatedTeams }
  set({ schedule: updatedSchedule, tournament: updatedTournament })
  saveSchedule(updatedSchedule)
  saveTournament(updatedTournament)
}

/**
 * Fills in real team IDs on any 'placement' (Endrunde 4) game whose homeSourceRank/awaySourceRank
 * points at a group that is now fully scored. A group counts as "fully scored" when every one of
 * its group-stage games has either a result or a cancellation reason (mirrors the existing
 * isRoundFullyEvaluated pattern, but per-group instead of per-swiss-round). Re-runs unconditionally
 * for every 'placement' game whose OWN periodScores are still empty, so a later group-phase
 * correction can flip the resolved team — homeSourceRank/awaySourceRank are never cleared, exactly
 * so this re-resolution can happen without needing separate bookkeeping. A placement game that has
 * already been scored itself is left untouched, regardless of what the group phase does afterward.
 * A withdrawn team is excluded from the qualifying ranks (see standingsByGroup below) — walkover
 * wins it banked before withdrawing must not let it occupy a placement-cohort slot.
 */
function resolvePlaceholders(games: Game[], teams: Team[]): Game[] {
  const groupIds = [...new Set(teams.map(t => t.groupId ?? 'A'))]
  const groupIsComplete = new Map<string, boolean>()
  for (const groupId of groupIds) {
    const groupGames = games.filter(g => g.stage === 'group' && (g.groupId ?? 'A') === groupId)
    groupIsComplete.set(groupId, groupGames.length > 0 && groupGames.every(g => g.cancelledReason || g.periodScores.length > 0))
  }

  // Recomputed on every submitGameResult/correctGameResult call, not cached across calls — cheap
  // at this app's tournament sizes (small team/group counts), so not worth the added complexity.
  // A withdrawn team is excluded from the qualifying ranks — walkover wins it banked before
  // withdrawing must not let it occupy a placement-cohort slot (Endrunde 4 has no
  // wildcard/next-best-fills-in concept, so the slot simply is not filled from this group).
  const standingsByGroup = new Map(
    groupIds.map(id => [id, computeGroupStandings(teams, games, id).filter(s => !s.withdrawn)]),
  )

  return games.map(g => {
    if (g.stage !== 'placement' || g.periodScores.length > 0) return g
    let { homeTeamId, awayTeamId } = g
    const { homeSourceRank, awaySourceRank } = g
    if (homeSourceRank && groupIsComplete.get(homeSourceRank.groupId)) {
      const standing = standingsByGroup.get(homeSourceRank.groupId)?.[homeSourceRank.rank - 1]
      if (standing) homeTeamId = standing.teamId
    }
    if (awaySourceRank && groupIsComplete.get(awaySourceRank.groupId)) {
      const standing = standingsByGroup.get(awaySourceRank.groupId)?.[awaySourceRank.rank - 1]
      if (standing) awayTeamId = standing.teamId
    }
    if (homeTeamId === g.homeTeamId && awayTeamId === g.awayTeamId) return g
    return { ...g, homeTeamId, awayTeamId }
  })
}

export const useTournamentStore = create<TournamentStore>((set, get) => ({
  tournament: loadTournament() ?? DEFAULT_TOURNAMENT,
  schedule: loadSchedule(),

  isTournamentLocked: () => {
    const { schedule } = get()
    return !!schedule && schedule.games.some(g => g.periodScores.length > 0)
  },

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
        swissRounds: mode === 'swiss'
          ? (s.tournament.swissRounds ?? Math.max(1, Math.ceil(Math.log2(s.tournament.teams.length || 1))))
          : s.tournament.swissRounds,
      },
    }))
    saveTournament(get().tournament)
  },

  setFinalsBracketSize: (size) => {
    set(s => ({ tournament: { ...s.tournament, finalsBracketSize: size } }))
    saveTournament(get().tournament)
  },

  setGroupCount: (count) => {
    const maxLetterIndex = count - 1
    set(s => ({
      tournament: {
        ...s.tournament,
        groupCount: count,
        teams: s.tournament.teams.map(t => {
          const currentIndex = (t.groupId ?? 'A').charCodeAt(0) - 65
          if (currentIndex > maxLetterIndex) {
            return { ...t, groupId: String.fromCharCode(65 + maxLetterIndex) }
          }
          return t
        }),
      },
    }))
    saveTournament(get().tournament)
  },

  setDoubleRoundRobin: (enabled) => {
    set(s => ({ tournament: { ...s.tournament, doubleRoundRobin: enabled } }))
    saveTournament(get().tournament)
  },

  setFinalsVariant: (variant) => {
    set(s => ({ tournament: { ...s.tournament, finalsVariant: variant } }))
    saveTournament(get().tournament)
  },

  setDropoutHandling: (handling) => {
    set(s => ({ tournament: { ...s.tournament, dropoutHandling: handling } }))
    saveTournament(get().tournament)
  },

  setSwissRounds: (rounds) => {
    set(s => ({ tournament: { ...s.tournament, swissRounds: rounds } }))
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

  setTeamGroup: (id, groupId) => {
    set(s => ({
      tournament: {
        ...s.tournament,
        teams: s.tournament.teams.map(t => t.id === id ? { ...t, groupId } : t),
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
    const { schedule, tournament } = get()
    if (!schedule) return
    const game = schedule.games.find(g => g.id === gameId)
    if (!game) return
    if (!game.homeTeamId || !game.awayTeamId) {
      throw new Error('Spiel hat noch keine feststehenden Teams')
    }
    const gamesAfterResult = schedule.games.map(g =>
      g.id === gameId ? { ...g, periodScores } : g
    )
    const updatedGames = resolvePlaceholders(gamesAfterResult, tournament.teams)
    const updated = { ...schedule, games: updatedGames }
    set({ schedule: updated })
    saveSchedule(updated)
  },

  advanceSwissRound: () => {
    const { schedule, tournament } = get()
    if (!schedule) return
    const currentRound = getCurrentSwissRound(schedule.games)
    if (!isRoundFullyEvaluated(schedule.games, currentRound)) {
      throw new Error('Runde ist noch nicht vollständig ausgewertet')
    }
    const standings = computeStandings(tournament.teams, schedule.games, currentRound)
    const playedPairs = new Set(
      schedule.games
        .filter(g => g.homeTeamId && g.awayTeamId)
        .map(g => [g.homeTeamId!, g.awayTeamId!].sort().join('|'))
    )
    const pairingResult = pairNextSwissRound({ standings, playedPairs })
    applySwissPairing(set, get, currentRound + 1, pairingResult.pairs, pairingResult.byeTeamId)
  },

  advanceSwissRoundManually: (pairs, byeTeamId) => {
    const { schedule } = get()
    if (!schedule) return
    const currentRound = getCurrentSwissRound(schedule.games)
    if (!isRoundFullyEvaluated(schedule.games, currentRound)) {
      throw new Error('Runde ist noch nicht vollständig ausgewertet')
    }
    applySwissPairing(set, get, currentRound + 1, pairs, byeTeamId)
  },

  withdrawTeam: (teamId) => {
    const { tournament } = get()
    if (tournament.mode === 'swiss') {
      withdrawSwissTeam(set, get, teamId)
    } else {
      withdrawNonSwissTeam(set, get, teamId)
    }
  },

  correctGameResult: (gameId, periodScores) => {
    const { schedule, tournament } = get()
    if (!schedule) return
    const game = schedule.games.find(g => g.id === gameId)
    if (!game) return
    const nextRoundHasResult = schedule.games.some(
      g => g.stage === 'swiss' && g.round === game.round + 1 && g.periodScores.length > 0
    )
    if (nextRoundHasResult) {
      throw new Error('Ergebnis kann nicht mehr korrigiert werden — die nächste Runde wurde bereits ausgewertet')
    }
    const gamesAfterCorrection = schedule.games.map(g =>
      g.id === gameId ? { ...g, periodScores } : g
    )
    const updatedGames = resolvePlaceholders(gamesAfterCorrection, tournament.teams)
    const updated = { ...schedule, games: updatedGames }
    set({ schedule: updated })
    saveSchedule(updated)
  },

  importTournament: (tournament, schedule) => {
    set({ tournament, schedule })
    saveTournament(tournament)
    if (schedule) saveSchedule(schedule)
    else clearSchedule()
  },

  loadFromStorage: () => {
    set({
      tournament: loadTournament() ?? DEFAULT_TOURNAMENT,
      schedule: loadSchedule(),
    })
  },

  resetTournament: () => {
    clearAll()
    set({ tournament: { ...DEFAULT_TOURNAMENT, id: uuidv4() }, schedule: null })
  },
}))
