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

  const pairs = generateRoundRobinPairs(teams.map(t => t.id))
  const games: Game[] = []
  let gameNumber = 1

  for (const [homeTeamId, awayTeamId] of pairs) {
    // Pick field with earliest availability
    let bestField = 0
    for (let f = 1; f < fields; f++) {
      if (timeToMinutes(fieldNextFree[f]) < timeToMinutes(fieldNextFree[bestField])) {
        bestField = f
      }
    }

    const slotStart = findNextSlot(
      fieldNextFree[bestField],
      gameDuration,
      venue.blackoutPeriods,
      addMinutes(venueClose, -venue.teardownBufferMin),
    )

    if (!slotStart) {
      console.warn(`No available slot for game ${gameNumber} — venue too short`)
      continue
    }

    const slotEnd = addMinutes(slotStart, gameDuration)

    games.push({
      id: uuidv4(),
      homeTeamId,
      awayTeamId,
      field: bestField + 1,
      scheduledStart: slotStart,
      scheduledEnd: slotEnd,
      round: 1,
      gameNumber: gameNumber++,
      periodScores: [],
    })

    fieldNextFree[bestField] = addMinutes(slotStart, slotDuration)
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
