// One-off generator for the demo tournament files under public/demos/.
// Run with: npx tsx scripts/generate-demo-tournaments.mts
//
// Builds each demo using the app's own scheduling/pairing/standings functions
// (not hand-typed JSON), so every file is guaranteed structurally valid and
// importable via the app's "JSON importieren" feature on the Konfiguration page.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateSchedule } from '../src/lib/schedule-generator.ts'
import { pairFirstSwissRound, pairNextSwissRound } from '../src/lib/swiss-pairing.ts'
import { computeStandings } from '../src/lib/standings.ts'
import type { TournamentConfig, Team, Game, Schedule } from '../src/types/index.ts'
import { REAL_CLUBS } from './fixtures/real-clubs.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'demos')

// Real Bavarian basketball clubs and their actual basketball-bund.net logo URLs (see
// scripts/fixtures/real-clubs.ts) -- used instead of made-up names so the demo tournaments
// exercise a real logoUrl end-to-end rather than leaving it '', which is otherwise essentially
// untested. 144 entries is enough to give every demo (including the 64-team ones) distinct,
// non-repeating real club names/logos.
function makeTeam(id: string, index: number, groupId?: string): Team {
  const { name, logoUrl } = REAL_CLUBS[index % REAL_CLUBS.length]
  return { id, name, logoUrl, color: '#004174', contact: '', players: [], ...(groupId ? { groupId } : {}) }
}

const baseGameSettings = {
  periodsCount: 4, periodDurationMin: 8, breakBetweenPeriodsMin: 1,
  halfTimeBreakMin: 5, bufferBetweenGamesMin: 5, breakBetweenRoundsMin: 15,
  awardCeremonyMin: 15,
}
const baseVenue = {
  name: 'Sporthalle am Ring', availabilityWindows: [{ start: '09:00', end: '20:00' }],
  blackoutPeriods: [{ start: '12:30', end: '13:30', reason: 'Mittagspause' }],
  setupBufferMin: 30, teardownBufferMin: 30,
}
// The 64-team demos need a much longer window and no blackout to fit within a
// reasonable field count -- this mirrors a realistic multi-court event hall.
const largeVenue = {
  name: 'Großsporthalle Süd', availabilityWindows: [{ start: '08:00', end: '22:00' }],
  blackoutPeriods: [], setupBufferMin: 0, teardownBufferMin: 0,
}

function writeDemo(filename: string, tournament: TournamentConfig, schedule: Schedule | null) {
  const data = { tournament, schedule, exportedAt: new Date().toISOString() }
  const filePath = path.join(OUTPUT_DIR, filename)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
  console.log(`wrote ${filename} (${schedule?.games.length ?? 0} games)`)
}

function playResult(game: Game, homeScore: number, awayScore: number): Game {
  return { ...game, periodScores: [{ period: 1, homeScore, awayScore }] }
}

// --- Demo 1: Jeder gegen Jeden, 9 Teams, teilweise gespielt ---
function buildRoundRobinDemo() {
  const teams = Array.from({ length: 9 }, (_, i) => makeTeam(`t${i + 1}`, i))
  const tournament: TournamentConfig = {
    id: 'demo-round-robin', name: 'Sommerturnier Musterstadt (Jeder gegen Jeden)',
    mode: 'round-robin', fields: 3, gameSettings: baseGameSettings, venue: baseVenue, teams,
  }
  const schedule = generateSchedule(tournament)
  // Play the first two rounds' worth of games.
  const gamesToPlay = schedule.games.filter(g => g.round <= 2)
  const playedIds = new Set(gamesToPlay.map(g => g.id))
  const games = schedule.games.map(g =>
    playedIds.has(g.id) ? playResult(g, 18 + Math.floor(Math.random() * 15), 12 + Math.floor(Math.random() * 15)) : g
  )
  writeDemo('01-jeder-gegen-jeden-9-teams-laufend.json', tournament, { ...schedule, games })
}

// --- Demo 2: Gruppenphase + Endrunde, 9 Teams / 2 Gruppen, teilweise gespielt ---
function buildGroupPhaseDemo() {
  const groupATeams = Array.from({ length: 5 }, (_, i) => makeTeam(`t${i + 1}`, i, 'A'))
  const groupBTeams = Array.from({ length: 4 }, (_, i) => makeTeam(`t${i + 6}`, i + 5, 'B'))
  const teams = [...groupATeams, ...groupBTeams]
  const tournament: TournamentConfig = {
    id: 'demo-group-phase', name: 'Verbandsturnier Rhein-Main (Gruppenphase + Endrunde)',
    mode: 'round-robin+finals', finalsBracketSize: 4, groupCount: 2, fields: 4,
    gameSettings: baseGameSettings, venue: baseVenue, teams,
  }
  const schedule = generateSchedule(tournament)
  const gamesToPlay = schedule.games.filter(g => g.stage === 'group' && g.round <= 2)
  const playedIds = new Set(gamesToPlay.map(g => g.id))
  const games = schedule.games.map(g =>
    playedIds.has(g.id) ? playResult(g, 20 + Math.floor(Math.random() * 12), 14 + Math.floor(Math.random() * 12)) : g
  )
  writeDemo('02-gruppenphase-endrunde-9-teams-laufend.json', tournament, { ...schedule, games })
}

// --- Demo 3: Schweizer System, 9 Teams, Runde 1 gespielt + Runde 2 ausgelost ---
function buildSwissDemo() {
  const teams = Array.from({ length: 9 }, (_, i) => makeTeam(`t${i + 1}`, i))
  const tournament: TournamentConfig = {
    id: 'demo-swiss', name: 'Einstufungsturnier Bezirksliga (Schweizer System)',
    mode: 'swiss', swissRounds: 4, fields: 2, gameSettings: baseGameSettings, venue: baseVenue, teams,
  }
  const schedule = generateSchedule(tournament)

  // Round 1 is already laid out by generateSchedule for swiss mode; play it out.
  const round1Games = schedule.games.filter(g => g.stage === 'swiss' && g.round === 1)
  let games = schedule.games.map(g => {
    if (g.round !== 1 || g.stage !== 'swiss') return g
    if (g.byeTeamId) return g
    return playResult(g, 18 + Math.floor(Math.random() * 15), 12 + Math.floor(Math.random() * 15))
  })

  // Pair round 2 using the real swiss-pairing function against round-1 results.
  const standings = computeStandings(teams, games, 1)
  const playedPairs = new Set(
    round1Games.filter(g => g.homeTeamId && g.awayTeamId).map(g => [g.homeTeamId!, g.awayTeamId!].sort().join('|'))
  )
  const { pairs, byeTeamId } = pairNextSwissRound({ standings, playedPairs })

  const round2Placeholders = games.filter(g => g.stage === 'swiss' && g.round === 2)
  const teamSlots = round2Placeholders.filter(g => g.field > 0)
  const byeSlot = round2Placeholders.find(g => g.field === 0)
  games = games.map(g => {
    const slotIndex = teamSlots.findIndex(slot => slot.id === g.id)
    if (slotIndex !== -1 && pairs[slotIndex]) {
      return { ...g, homeTeamId: pairs[slotIndex][0], awayTeamId: pairs[slotIndex][1], homeLabel: undefined, awayLabel: undefined }
    }
    if (byeSlot && g.id === byeSlot.id && byeTeamId) {
      return { ...g, byeTeamId }
    }
    return g
  })

  writeDemo('03-schweizer-system-9-teams-laufend.json', tournament, { ...schedule, games })
}

// --- Demo 4: 64 Teams / 16 Gruppen, frisch generiert (ungespielt) ---
function buildLarge64UnplayedDemo() {
  const teamCount = 64
  const groupCount = 16
  const teams = Array.from({ length: teamCount }, (_, i) =>
    makeTeam(`t${i + 1}`, i, String.fromCharCode(65 + (i % groupCount)))
  )
  const tournament: TournamentConfig = {
    id: 'demo-large-64-unplayed', name: 'Verbandsturnier Süd (Großturnier, 64 Teams)',
    mode: 'round-robin+finals', finalsBracketSize: 4, groupCount, fields: 12,
    gameSettings: baseGameSettings, venue: largeVenue, teams,
  }
  const schedule = generateSchedule(tournament)
  writeDemo('04-grossturnier-64-teams-16-gruppen-ungespielt.json', tournament, schedule)
}

// --- Demo 5: 64 Teams / 16 Gruppen, mit einigen Ergebnissen ---
function buildLarge64PlayedDemo() {
  const teamCount = 64
  const groupCount = 16
  const teams = Array.from({ length: teamCount }, (_, i) =>
    makeTeam(`t${i + 1}`, i, String.fromCharCode(65 + (i % groupCount)))
  )
  const tournament: TournamentConfig = {
    id: 'demo-large-64-played', name: 'Verbandsturnier Süd (Großturnier, 64 Teams, laufend)',
    mode: 'round-robin+finals', finalsBracketSize: 4, groupCount, fields: 12,
    gameSettings: baseGameSettings, venue: largeVenue, teams,
  }
  const schedule = generateSchedule(tournament)
  // Play round 1 for every group, so every group's table shows some movement.
  const gamesToPlay = schedule.games.filter(g => g.stage === 'group' && g.round === 1)
  const playedIds = new Set(gamesToPlay.map(g => g.id))
  const games = schedule.games.map(g =>
    playedIds.has(g.id) ? playResult(g, 16 + Math.floor(Math.random() * 18), 10 + Math.floor(Math.random() * 18)) : g
  )
  writeDemo('05-grossturnier-64-teams-16-gruppen-laufend.json', tournament, { ...schedule, games })
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true })
buildRoundRobinDemo()
buildGroupPhaseDemo()
buildSwissDemo()
buildLarge64UnplayedDemo()
buildLarge64PlayedDemo()
