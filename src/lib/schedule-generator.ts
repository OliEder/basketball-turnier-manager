import { v4 as uuidv4 } from 'uuid'
import type { TournamentConfig, Game, Schedule } from '@/types'
import { calcGameDurationMin, addMinutes, timeToMinutes, maxTime, findNextSlot } from './game-duration'
import { generatePlayoffGames } from './playoff-generator'
import { generateSwissSchedule } from './swiss-schedule'
import { buildPlacementCohorts, buildPlacementGames, buildQualifierSeeds } from './finals-variant-generator'
import { computeGroupStandings } from './group-standings'

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
 * Generate round-robin rounds using the circle method (Berger tables): each round contains
 * every team at most once, so all rounds can be scheduled in parallel across available fields.
 * Odd team counts get one sitting-out team per round (no bye game is generated for it — this
 * differs from the swiss-system bye, which awards points; a round-robin sit-out earns nothing).
 */
export function generateRoundRobinRounds(teamIds: string[]): [string, string][][] {
  if (teamIds.length < 2) return []

  const hasOddCount = teamIds.length % 2 === 1
  const working: (string | null)[] = hasOddCount ? [...teamIds, null] : [...teamIds]
  const n = working.length
  const roundCount = n - 1
  const rounds: [string, string][][] = []

  const rotating = working.slice(1)
  const fixed = working[0]

  for (let r = 0; r < roundCount; r++) {
    const roundTeams = [fixed, ...rotating]
    const roundPairs: [string, string][] = []
    for (let i = 0; i < n / 2; i++) {
      const home = roundTeams[i]
      const away = roundTeams[n - 1 - i]
      if (home !== null && away !== null) {
        roundPairs.push([home, away])
      }
    }
    rounds.push(roundPairs)
    rotating.unshift(rotating.pop()!)
  }

  return rounds
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
      // log2(teams) rounds are enough to separate all teams by a unique win/loss record in a swiss system
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

  const groupIds = [...new Set(teams.map(t => t.groupId ?? 'A'))].sort()
  const roundsByGroup = new Map(
    groupIds.map(groupId => {
      const firstLeg = generateRoundRobinRounds(teams.filter(t => (t.groupId ?? 'A') === groupId).map(t => t.id))
      if (!config.doubleRoundRobin) return [groupId, firstLeg] as const
      const returnLeg = firstLeg.map(round => round.map(([home, away]) => [away, home] as [string, string]))
      return [groupId, [...firstLeg, ...returnLeg]] as const
    }),
  )
  const maxRoundCount = Math.max(0, ...[...roundsByGroup.values()].map(r => r.length))

  const games: Game[] = []
  let gameNumber = 1

  for (let roundIndex = 0; roundIndex < maxRoundCount; roundIndex++) {
    const batchPairs: { groupId: string; homeTeamId: string; awayTeamId: string }[] = []
    for (const [groupId, groupRounds] of roundsByGroup) {
      const roundPairs = groupRounds[roundIndex]
      if (!roundPairs) continue
      for (const [homeTeamId, awayTeamId] of roundPairs) {
        batchPairs.push({ groupId, homeTeamId, awayTeamId })
      }
    }

    for (const { groupId, homeTeamId, awayTeamId } of batchPairs) {
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
        round: roundIndex + 1,
        gameNumber: gameNumber++,
        periodScores: [],
        groupId,
      })

      fieldNextFree[bestField] = addMinutes(bestSlotStart, slotDuration)
      teamNextFree.set(homeTeamId, addMinutes(bestSlotStart, slotDuration))
      teamNextFree.set(awayTeamId, addMinutes(bestSlotStart, slotDuration))
    }
  }

  if (config.mode === 'round-robin+finals' && config.finalsVariant === 'endrunde-4') {
    // Group phase hasn't been played yet at this point (periodScores are all empty), so
    // computeGroupStandings here yields all-zero, arbitrarily-ordered rankings — cohort.teamIds
    // from buildPlacementCohorts is therefore NOT a real team assignment and must not be used as
    // one. Only cohort.rankTier (e.g. "rank 1 in each group") and cohort.teamIds.length (how many
    // groups feed this cohort) are meaningful at generation time; sourceRanks are synthesized from
    // the real, stable groupIds paired with rankTier instead. Actual team resolution happens later,
    // once the group phase has real results.
    const standingsByGroup = new Map(groupIds.map(groupId => [groupId, computeGroupStandings(teams, games, groupId)]))
    // buildPlacementCohorts always builds teamIds as groupIds.map(...), so every cohort spans
    // all groups — no need to size sourceRanks off cohort.teamIds.length, groupIds is equivalent.
    const cohortInputs = buildPlacementCohorts(standingsByGroup).map(cohort => ({
      rankTier: cohort.rankTier,
      placementFrom: cohort.placementFrom,
      sourceRanks: groupIds.map(groupId => ({ groupId, rank: cohort.rankTier })),
    }))
    const placementGames = buildPlacementGames({
      cohorts: cohortInputs,
      fields,
      gameSettings,
      blackoutPeriods: venue.blackoutPeriods,
      availabilityEnd,
      fieldNextFree,
      startGameNumber: gameNumber,
    })
    games.push(...placementGames)
  } else if (config.mode === 'round-robin+finals' && config.finalsVariant === 'endrunde-3') {
    // Only the 4 group-winners qualify, regardless of how many teams are actually in each group —
    // teamCount is fixed at 4 (the qualifying pool size), not teams.length (the whole tournament).
    const qualifierSourceRanks = buildQualifierSeeds(groupIds, 1)
    const playoffGames = generatePlayoffGames({
      finalsBracketSize: 4,
      fields,
      gameSettings,
      blackoutPeriods: venue.blackoutPeriods,
      availabilityEnd,
      fieldNextFree,
      teamCount: 4,
      startGameNumber: gameNumber,
      qualifierSourceRanks,
    })
    games.push(...playoffGames)
  } else if (config.mode === 'round-robin+finals') {
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
