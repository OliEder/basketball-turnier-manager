import { v4 as uuidv4 } from 'uuid'
import type { TournamentConfig, Game, Schedule } from '@/types'
import { calcGameDurationMin, addMinutes, timeToMinutes, maxTime, findNextSlot } from './game-duration'
import { generatePlayoffGames } from './playoff-generator'
import { generateSwissSchedule } from './swiss-schedule'

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

  if (config.mode === 'swiss') {
    const { games } = generateSwissSchedule({
      teamIds: teams.map(t => t.id),
      swissRounds: config.swissRounds ?? Math.max(1, Math.ceil(Math.log2(teams.length || 1))),
      fields,
      gameSettings,
      blackoutPeriods: venue.blackoutPeriods,
      firstGameStart,
      availabilityEnd,
      startGameNumber: 1,
    })
    const lastEnd = games.reduce((max, g) => (g.scheduledEnd > max ? g.scheduledEnd : max), '00:00')
    const firstStart = games[0]?.scheduledStart ?? firstGameStart
    return {
      id: uuidv4(),
      tournamentId: config.id,
      generatedAt: new Date().toISOString(),
      games,
      totalDurationMin: timeToMinutes(lastEnd) - timeToMinutes(firstStart),
      estimatedEnd: lastEnd,
    }
  }

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

  if (config.mode === 'round-robin+finals') {
    const playoffGames = generatePlayoffGames({
      finalsBracketSize: config.finalsBracketSize ?? 4,
      fields,
      gameSettings,
      blackoutPeriods: venue.blackoutPeriods,
      availabilityEnd,
      fieldNextFree,
      teamCount: teams.length,
      startGameNumber: gameNumber,
    })
    games.push(...playoffGames)
  }

  const lastEnd = games.reduce(
    (max, g) => (g.scheduledEnd > max ? g.scheduledEnd : max),
    '00:00',
  )
  const firstStart = games[0]?.scheduledStart ?? firstGameStart
  const totalDurationMin =
    timeToMinutes(lastEnd) - timeToMinutes(firstStart)

  const finalGame = games.find(g => g.stage === 'final')

  return {
    id: uuidv4(),
    tournamentId: config.id,
    generatedAt: new Date().toISOString(),
    games,
    totalDurationMin,
    estimatedEnd: lastEnd,
    ...(finalGame ? { awardCeremonyEstimate: addMinutes(finalGame.scheduledEnd, gameSettings.awardCeremonyMin) } : {}),
  }
}
