import { v4 as uuidv4 } from 'uuid'
import type { TournamentConfig, Game, Schedule, TimeWindow } from '@/types'
import { calcGameDurationMin, addMinutes, timeToMinutes, overlapsBlackout } from './game-duration'

/** Generate all unique pairs for round-robin. Returns [homeId, awayId][] */
export function generateRoundRobinPairs(teamIds: string[]): [string, string][] {
  const pairs: [string, string][] = []
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      pairs.push([teamIds[i], teamIds[j]])
    }
  }
  return pairs
}

/** Returns the later of two HH:MM time strings. */
function maxTime(a: string, b: string): string {
  return timeToMinutes(a) >= timeToMinutes(b) ? a : b
}

/**
 * Find the earliest available start time for a game on a given field,
 * respecting blackout periods and venue availability.
 */
function findNextSlot(
  currentTime: string,
  durationMin: number,
  blackoutPeriods: TimeWindow[],
  availabilityEnd: string,
): string {
  let candidate = currentTime
  const maxIterations = 1440 // safety: never loop more than 24h worth of minutes

  for (let i = 0; i < maxIterations; i++) {
    const end = addMinutes(candidate, durationMin)

    // Check if game ends before venue closes
    if (timeToMinutes(end) > timeToMinutes(availabilityEnd)) {
      return '' // no slot found within venue hours
    }

    // Check if game overlaps any blackout
    const conflict = blackoutPeriods.find(b => overlapsBlackout(candidate, end, b))
    if (!conflict) return candidate

    // Move start to end of conflicting blackout
    candidate = conflict.end
  }
  return ''
}

export function generateSchedule(config: TournamentConfig): Schedule {
  const { teams, fields, gameSettings, venue } = config
  const gameDuration = calcGameDurationMin(gameSettings)
  const slotDuration = gameDuration + gameSettings.bufferBetweenGamesMin

  // Field clocks: track when each field is next free
  const venueOpen = venue.availabilityWindows[0]?.start ?? '09:00'
  const venueClose = venue.availabilityWindows[0]?.end ?? '20:00'
  const firstGameStart = addMinutes(venueOpen, venue.setupBufferMin)
  const fieldNextFree: string[] = Array.from({ length: fields }, () => firstGameStart)
  // Team clocks: track when each team is next free (a team can't play two games at once)
  const teamNextFree = new Map<string, string>()
  const availabilityEnd = addMinutes(venueClose, -venue.teardownBufferMin)

  const pairs = generateRoundRobinPairs(teams.map(t => t.id))
  const games: Game[] = []
  let gameNumber = 1

  for (const [homeTeamId, awayTeamId] of pairs) {
    const teamsEarliest = maxTime(
      teamNextFree.get(homeTeamId) ?? firstGameStart,
      teamNextFree.get(awayTeamId) ?? firstGameStart,
    )

    // Pick the field that yields the earliest actual start time for this pair,
    // once both the field's and both teams' availability are taken into account.
    let bestField = -1
    let bestSlotStart = ''
    for (let f = 0; f < fields; f++) {
      const earliestForField = maxTime(fieldNextFree[f], teamsEarliest)
      const slotStart = findNextSlot(earliestForField, gameDuration, venue.blackoutPeriods, availabilityEnd)
      if (!slotStart) continue
      if (bestField === -1 || timeToMinutes(slotStart) < timeToMinutes(bestSlotStart)) {
        bestField = f
        bestSlotStart = slotStart
      }
    }

    if (bestField === -1) {
      console.warn(`No available slot for game ${gameNumber} — venue too short`)
      continue
    }

    const slotEnd = addMinutes(bestSlotStart, gameDuration)

    games.push({
      id: uuidv4(),
      homeTeamId,
      awayTeamId,
      stage: 'group',
      field: bestField + 1,
      scheduledStart: bestSlotStart,
      scheduledEnd: slotEnd,
      round: 1,
      gameNumber: gameNumber++,
      periodScores: [],
    })

    fieldNextFree[bestField] = addMinutes(bestSlotStart, slotDuration)
    teamNextFree.set(homeTeamId, addMinutes(bestSlotStart, slotDuration))
    teamNextFree.set(awayTeamId, addMinutes(bestSlotStart, slotDuration))
  }

  const lastEnd = games.reduce(
    (max, g) => (g.scheduledEnd > max ? g.scheduledEnd : max),
    '00:00',
  )
  const firstStart = games[0]?.scheduledStart ?? firstGameStart
  const totalDurationMin =
    timeToMinutes(lastEnd) - timeToMinutes(firstStart)

  return {
    id: uuidv4(),
    tournamentId: config.id,
    generatedAt: new Date().toISOString(),
    games,
    totalDurationMin,
    estimatedEnd: lastEnd,
  }
}
