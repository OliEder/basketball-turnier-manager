# Turniermanager Phase 1: Planer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based tournament planner for the Fibalon U11-Summer Cup that lets an organizer configure teams, tournament mode, venue constraints, auto-generate a schedule, manually adjust it, and export as PDF/Web/JSON.

**Architecture:** React + Vite single-page app, no backend. All data persisted in localStorage. Schedule generation runs in the browser. Exports (PDF, static HTML, JSON) are generated client-side and downloaded.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, Vitest, react-pdf, uuid

---

## File Structure

```
src/
├── types/
│   └── index.ts              # All TypeScript types (Team, Player, Tournament, Game, etc.)
├── lib/
│   ├── storage.ts            # localStorage read/write helpers
│   ├── schedule-generator.ts # Round-robin pairing + slot allocation algorithm
│   ├── game-duration.ts      # Calculate game duration from settings
│   └── export/
│       ├── json-export.ts    # JSON download
│       ├── pdf-export.ts     # PDF generation with react-pdf
│       └── html-export.ts    # Static HTML page generation + ZIP download
├── store/
│   └── tournament-store.ts   # Zustand store — single source of truth
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx      # Nav + page wrapper
│   │   └── PageHeader.tsx    # Reusable page title
│   ├── teams/
│   │   ├── TeamList.tsx      # List of teams with edit/delete
│   │   ├── TeamCard.tsx      # Single team display
│   │   └── TeamForm.tsx      # Add/edit team form
│   ├── config/
│   │   ├── TournamentForm.tsx  # Name, mode, fields
│   │   └── GameSettingsForm.tsx # Periods, duration, buffers
│   ├── venue/
│   │   ├── VenueForm.tsx       # Venue name, availability, setup buffers
│   │   └── BlackoutList.tsx    # Add/remove blackout periods
│   ├── schedule/
│   │   ├── ScheduleView.tsx    # Timeline view of all games
│   │   ├── GameRow.tsx         # Single game row (editable time)
│   │   └── ConflictBadge.tsx   # Visual conflict indicator
│   └── export/
│       └── ExportPanel.tsx     # PDF / Web / JSON export buttons
└── pages/
    ├── TeamsPage.tsx
    ├── ConfigPage.tsx
    ├── SchedulePage.tsx
    └── ExportPage.tsx
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`
- Create: `src/main.tsx`, `src/App.tsx`
- Create: `tailwind.config.ts`, `postcss.config.js`
- Create: `src/index.css`

- [ ] **Step 1: Scaffold Vite + React + TypeScript project**

```bash
cd /Users/oliver-marcuseder/01-vibe-coding/00-Basektball/06-tunier-manager
npm create vite@latest . -- --template react-ts
```

Expected: project files created, `package.json` present.

- [ ] **Step 2: Install dependencies**

```bash
npm install
npm install zustand uuid @types/uuid
npm install -D tailwindcss postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
npx tailwindcss init -p
```

- [ ] **Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init
```

When prompted: TypeScript=yes, style=Default, base color=Slate, CSS variables=yes, React Server Components=no.

Then add needed components:

```bash
npx shadcn@latest add button input label card form select badge dialog alert
```

- [ ] **Step 4: Configure Tailwind**

Replace `tailwind.config.ts` content:

```ts
import type { Config } from 'tailwindcss'

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Fibalon Baskets brand colors — update after checking fibalon-baskets.de
        brand: {
          primary: '#E8300B',   // placeholder — verify against fibalon-baskets.de
          secondary: '#1A1A1A',
          accent: '#FFFFFF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config
```

- [ ] **Step 5: Configure Vitest**

In `vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

Create `src/test-setup.ts`:

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Verify dev server starts**

```bash
npm run dev
```

Expected: Vite server starts at `http://localhost:5173`, no errors.

- [ ] **Step 7: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold React + Vite + Tailwind + shadcn/ui project"
```

---

## Task 2: Type Definitions

**Files:**
- Create: `src/types/index.ts`
- Create: `src/types/index.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/types/index.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { Team, Player, TournamentConfig, Game, Schedule, TimeWindow, PeriodScore } from './index'

describe('Type shapes', () => {
  it('Team has required fields', () => {
    const team: Team = {
      id: 'uuid-1',
      name: 'Fibalon Baskets',
      logoUrl: 'https://fibalon-baskets.de/logo.png',
      color: '#E8300B',
      contact: 'Max Mustermann',
      players: [],
    }
    expect(team.id).toBe('uuid-1')
    expect(team.players).toEqual([])
  })

  it('Player jerseyNumber is a string', () => {
    const player: Player = {
      id: 'uuid-2',
      firstName: 'Jonas',
      lastName: 'Weber',
      jerseyNumber: '00',
    }
    expect(typeof player.jerseyNumber).toBe('string')
  })

  it('Game has periodScores array', () => {
    const game: Game = {
      id: 'uuid-3',
      homeTeamId: 'uuid-1',
      awayTeamId: 'uuid-4',
      field: 1,
      scheduledStart: '09:00',
      scheduledEnd: '09:30',
      round: 1,
      gameNumber: 1,
      periodScores: [],
    }
    expect(game.periodScores).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/types/index.test.ts
```

Expected: FAIL — "Cannot find module './index'"

- [ ] **Step 3: Write types**

Create `src/types/index.ts`:

```ts
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
  color: string   // hex, e.g. "#E8300B"
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/types/index.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/
git commit -m "feat: add TypeScript type definitions"
```

---

## Task 3: Game Duration Calculator

**Files:**
- Create: `src/lib/game-duration.ts`
- Create: `src/lib/game-duration.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/game-duration.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { calcGameDurationMin, addMinutes, isTimeInWindow } from './game-duration'
import type { GameSettings } from '@/types'

const settings: GameSettings = {
  periodsCount: 4,
  periodDurationMin: 5,
  breakBetweenPeriodsMin: 1,
  halfTimeBreakMin: 5,
  bufferBetweenGamesMin: 5,
}

describe('calcGameDurationMin', () => {
  it('calculates 4x5min quarters correctly', () => {
    // 4 periods × 5min = 20min play
    // 3 breaks: Q1-Q2 (1min), halftime (5min), Q3-Q4 (1min) = 7min breaks
    // total = 27min
    expect(calcGameDurationMin(settings)).toBe(27)
  })

  it('calculates 2 halves correctly', () => {
    const s: GameSettings = { ...settings, periodsCount: 2, periodDurationMin: 10, breakBetweenPeriodsMin: 2, halfTimeBreakMin: 10 }
    // 2 × 10min = 20min play
    // 1 break (halftime) = 10min
    // total = 30min
    expect(calcGameDurationMin(s)).toBe(30)
  })
})

describe('addMinutes', () => {
  it('adds minutes to HH:MM string', () => {
    expect(addMinutes('09:00', 30)).toBe('09:30')
    expect(addMinutes('09:45', 30)).toBe('10:15')
    expect(addMinutes('23:30', 45)).toBe('00:15')
  })
})

describe('isTimeInWindow', () => {
  it('returns true when time is inside window', () => {
    expect(isTimeInWindow('10:00', { start: '09:00', end: '20:00' })).toBe(true)
  })
  it('returns false when time is outside window', () => {
    expect(isTimeInWindow('21:00', { start: '09:00', end: '20:00' })).toBe(false)
  })
  it('returns false when time is on the boundary (end)', () => {
    expect(isTimeInWindow('20:00', { start: '09:00', end: '20:00' })).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/game-duration.test.ts
```

Expected: FAIL — "Cannot find module './game-duration'"

- [ ] **Step 3: Implement**

Create `src/lib/game-duration.ts`:

```ts
import type { GameSettings, TimeWindow } from '@/types'

/** Convert "HH:MM" to total minutes since midnight */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** Convert total minutes since midnight to "HH:MM" */
export function minutesToTime(minutes: number): string {
  const totalMins = ((minutes % 1440) + 1440) % 1440 // wrap around midnight
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Add minutes to a "HH:MM" string, returns "HH:MM" */
export function addMinutes(time: string, minutes: number): string {
  return minutesToTime(timeToMinutes(time) + minutes)
}

/**
 * Calculate total game duration in minutes (excluding bufferBetweenGamesMin).
 * Halftime break applies after period periodsCount/2.
 */
export function calcGameDurationMin(settings: GameSettings): number {
  const { periodsCount, periodDurationMin, breakBetweenPeriodsMin, halfTimeBreakMin } = settings
  const playTime = periodsCount * periodDurationMin
  const halfTimeIndex = periodsCount / 2 // break after this period is halftime

  let breakTime = 0
  for (let i = 1; i < periodsCount; i++) {
    breakTime += i === halfTimeIndex ? halfTimeBreakMin : breakBetweenPeriodsMin
  }
  return playTime + breakTime
}

/** Returns true if time (HH:MM) falls strictly inside [start, end) */
export function isTimeInWindow(time: string, window: TimeWindow): boolean {
  const t = timeToMinutes(time)
  const s = timeToMinutes(window.start)
  const e = timeToMinutes(window.end)
  return t >= s && t < e
}

/** Returns true if a game slot [start, end] overlaps a blackout period */
export function overlapsBlackout(start: string, end: string, blackout: TimeWindow): boolean {
  const gameStart = timeToMinutes(start)
  const gameEnd = timeToMinutes(end)
  const bStart = timeToMinutes(blackout.start)
  const bEnd = timeToMinutes(blackout.end)
  return gameStart < bEnd && gameEnd > bStart
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/game-duration.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/game-duration.ts src/lib/game-duration.test.ts
git commit -m "feat: add game duration calculator and time utilities"
```

---

## Task 4: Schedule Generator

**Files:**
- Create: `src/lib/schedule-generator.ts`
- Create: `src/lib/schedule-generator.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/schedule-generator.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { generateRoundRobinPairs, generateSchedule } from './schedule-generator'
import type { TournamentConfig, Team } from '@/types'

const makeTeam = (id: string, name: string): Team => ({
  id, name, logoUrl: '', color: '#000', contact: '', players: [],
})

const baseConfig: TournamentConfig = {
  id: 'tournament-1',
  name: 'Test Cup',
  mode: 'round-robin',
  fields: 2,
  gameSettings: {
    periodsCount: 4,
    periodDurationMin: 5,
    breakBetweenPeriodsMin: 1,
    halfTimeBreakMin: 5,
    bufferBetweenGamesMin: 5,
  },
  venue: {
    name: 'Testhalle',
    availabilityWindows: [{ start: '09:00', end: '20:00' }],
    blackoutPeriods: [],
    setupBufferMin: 30,
    teardownBufferMin: 30,
  },
  teams: [
    makeTeam('t1', 'Team A'),
    makeTeam('t2', 'Team B'),
    makeTeam('t3', 'Team C'),
    makeTeam('t4', 'Team D'),
  ],
}

describe('generateRoundRobinPairs', () => {
  it('generates correct number of pairs for 4 teams', () => {
    const pairs = generateRoundRobinPairs(['t1', 't2', 't3', 't4'])
    // 4 teams: 4×3/2 = 6 games
    expect(pairs).toHaveLength(6)
  })

  it('each pair plays exactly once', () => {
    const pairs = generateRoundRobinPairs(['t1', 't2', 't3', 't4'])
    const seen = new Set<string>()
    for (const [a, b] of pairs) {
      const key = [a, b].sort().join('|')
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })
})

describe('generateSchedule', () => {
  it('returns a schedule with 6 games for 4 teams', () => {
    const schedule = generateSchedule(baseConfig)
    expect(schedule.games).toHaveLength(6)
  })

  it('no game starts before venue opens (after setup buffer)', () => {
    const schedule = generateSchedule(baseConfig)
    // venue opens at 09:00, setup buffer = 30min → first game at 09:30
    expect(schedule.games[0].scheduledStart).toBe('09:30')
  })

  it('no game overlaps a blackout period', () => {
    const config: TournamentConfig = {
      ...baseConfig,
      venue: {
        ...baseConfig.venue,
        blackoutPeriods: [{ start: '12:00', end: '14:00', reason: 'Mittagshitze' }],
      },
    }
    const schedule = generateSchedule(config)
    for (const game of schedule.games) {
      const startMins = parseInt(game.scheduledStart.replace(':', ''))
      const endMins = parseInt(game.scheduledEnd.replace(':', ''))
      const blackoutStart = 1200
      const blackoutEnd = 1400
      const overlaps = startMins < blackoutEnd && endMins > blackoutStart
      expect(overlaps).toBe(false)
    }
  })

  it('games on same field do not overlap', () => {
    const schedule = generateSchedule(baseConfig)
    const byField = new Map<number, typeof schedule.games>()
    for (const game of schedule.games) {
      if (!byField.has(game.field)) byField.set(game.field, [])
      byField.get(game.field)!.push(game)
    }
    for (const [, games] of byField) {
      const sorted = [...games].sort((a, b) =>
        a.scheduledStart.localeCompare(b.scheduledStart)
      )
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].scheduledStart >= sorted[i - 1].scheduledEnd).toBe(true)
      }
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/schedule-generator.test.ts
```

Expected: FAIL — "Cannot find module './schedule-generator'"

- [ ] **Step 3: Implement**

Create `src/lib/schedule-generator.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/schedule-generator.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/schedule-generator.ts src/lib/schedule-generator.test.ts
git commit -m "feat: add round-robin schedule generator with blackout support"
```

---

## Task 5: Storage Layer

**Files:**
- Create: `src/lib/storage.ts`
- Create: `src/lib/storage.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/storage.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { saveTournament, loadTournament, saveSchedule, loadSchedule, clearAll } from './storage'
import type { TournamentConfig, Schedule } from '@/types'

const mockTournament: TournamentConfig = {
  id: 'tour-1',
  name: 'Test Cup',
  mode: 'round-robin',
  fields: 2,
  gameSettings: {
    periodsCount: 4, periodDurationMin: 5,
    breakBetweenPeriodsMin: 1, halfTimeBreakMin: 5,
    bufferBetweenGamesMin: 5,
  },
  venue: {
    name: 'Halle', availabilityWindows: [{ start: '09:00', end: '20:00' }],
    blackoutPeriods: [], setupBufferMin: 30, teardownBufferMin: 30,
  },
  teams: [],
}

beforeEach(() => clearAll())

describe('saveTournament / loadTournament', () => {
  it('roundtrips tournament config', () => {
    saveTournament(mockTournament)
    expect(loadTournament()).toEqual(mockTournament)
  })

  it('returns null when nothing saved', () => {
    expect(loadTournament()).toBeNull()
  })
})

describe('saveSchedule / loadSchedule', () => {
  it('roundtrips schedule', () => {
    const schedule: Schedule = {
      id: 'sched-1', tournamentId: 'tour-1',
      generatedAt: '2026-06-24T10:00:00Z',
      games: [], totalDurationMin: 0, estimatedEnd: '09:30',
    }
    saveSchedule(schedule)
    expect(loadSchedule()).toEqual(schedule)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/storage.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement**

Create `src/lib/storage.ts`:

```ts
import type { TournamentConfig, Schedule } from '@/types'

const KEYS = {
  tournament: 'tm_tournament',
  schedule: 'tm_schedule',
} as const

export function saveTournament(config: TournamentConfig): void {
  localStorage.setItem(KEYS.tournament, JSON.stringify(config))
}

export function loadTournament(): TournamentConfig | null {
  const raw = localStorage.getItem(KEYS.tournament)
  if (!raw) return null
  return JSON.parse(raw) as TournamentConfig
}

export function saveSchedule(schedule: Schedule): void {
  localStorage.setItem(KEYS.schedule, JSON.stringify(schedule))
}

export function loadSchedule(): Schedule | null {
  const raw = localStorage.getItem(KEYS.schedule)
  if (!raw) return null
  return JSON.parse(raw) as Schedule
}

export function clearAll(): void {
  localStorage.removeItem(KEYS.tournament)
  localStorage.removeItem(KEYS.schedule)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/storage.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/storage.test.ts
git commit -m "feat: add localStorage persistence layer"
```

---

## Task 6: Zustand Store

**Files:**
- Create: `src/store/tournament-store.ts`

- [ ] **Step 1: Install Zustand**

```bash
npm install zustand
```

- [ ] **Step 2: Create store**

Create `src/store/tournament-store.ts`:

```ts
import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { TournamentConfig, Team, Schedule, GameSettings, Venue } from '@/types'
import { saveTournament, loadTournament, saveSchedule, loadSchedule } from '@/lib/storage'
import { generateSchedule } from '@/lib/schedule-generator'

const DEFAULT_GAME_SETTINGS: GameSettings = {
  periodsCount: 4,
  periodDurationMin: 5,
  breakBetweenPeriodsMin: 1,
  halfTimeBreakMin: 5,
  bufferBetweenGamesMin: 5,
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
    set(s => ({ tournament: { ...s.tournament, mode } }))
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
    const { calcGameDurationMin, addMinutes } = require('@/lib/game-duration')
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

  loadFromStorage: () => {
    set({
      tournament: loadTournament() ?? DEFAULT_TOURNAMENT,
      schedule: loadSchedule(),
    })
  },
}))
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/store/tournament-store.ts
git commit -m "feat: add Zustand tournament store with localStorage sync"
```

---

## Task 7: App Shell & Routing

**Files:**
- Create: `src/components/layout/AppShell.tsx`
- Create: `src/pages/TeamsPage.tsx` (stub)
- Create: `src/pages/ConfigPage.tsx` (stub)
- Create: `src/pages/SchedulePage.tsx` (stub)
- Create: `src/pages/ExportPage.tsx` (stub)
- Modify: `src/App.tsx`

- [ ] **Step 1: Install react-router-dom**

```bash
npm install react-router-dom
```

- [ ] **Step 2: Create stub pages**

Create `src/pages/TeamsPage.tsx`:
```tsx
export default function TeamsPage() {
  return <div className="p-6"><h1 className="text-2xl font-bold">Teams</h1></div>
}
```

Create `src/pages/ConfigPage.tsx`:
```tsx
export default function ConfigPage() {
  return <div className="p-6"><h1 className="text-2xl font-bold">Konfiguration</h1></div>
}
```

Create `src/pages/SchedulePage.tsx`:
```tsx
export default function SchedulePage() {
  return <div className="p-6"><h1 className="text-2xl font-bold">Zeitplan</h1></div>
}
```

Create `src/pages/ExportPage.tsx`:
```tsx
export default function ExportPage() {
  return <div className="p-6"><h1 className="text-2xl font-bold">Export</h1></div>
}
```

- [ ] **Step 3: Create AppShell**

Create `src/components/layout/AppShell.tsx`:

```tsx
import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/teams', label: 'Teams' },
  { to: '/config', label: 'Konfiguration' },
  { to: '/schedule', label: 'Zeitplan' },
  { to: '/export', label: 'Export' },
]

export default function AppShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-brand-secondary text-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-6">
          <span className="font-bold text-lg tracking-tight">Turniermanager</span>
          <nav className="flex gap-1">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'px-3 py-1.5 rounded text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-primary text-white'
                      : 'text-white/70 hover:text-white hover:bg-white/10',
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Wire up routing in App.tsx**

Replace `src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from '@/components/layout/AppShell'
import TeamsPage from '@/pages/TeamsPage'
import ConfigPage from '@/pages/ConfigPage'
import SchedulePage from '@/pages/SchedulePage'
import ExportPage from '@/pages/ExportPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<Navigate to="/teams" replace />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="config" element={<ConfigPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="export" element={<ExportPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 5: Verify app loads**

```bash
npm run dev
```

Open `http://localhost:5173` — should see nav with 4 links, redirects to `/teams`.

- [ ] **Step 6: Commit**

```bash
git add src/components/ src/pages/ src/App.tsx
git commit -m "feat: add app shell with navigation and stub pages"
```

---

## Task 8: Teams Page

**Files:**
- Create: `src/components/teams/TeamForm.tsx`
- Create: `src/components/teams/TeamCard.tsx`
- Create: `src/components/teams/TeamList.tsx`
- Modify: `src/pages/TeamsPage.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/teams/TeamForm.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TeamForm from './TeamForm'

describe('TeamForm', () => {
  it('renders all fields', () => {
    render(<TeamForm onSubmit={vi.fn()} />)
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/logo/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/farbe/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/kontakt/i)).toBeInTheDocument()
  })

  it('calls onSubmit with team data', () => {
    const onSubmit = vi.fn()
    render(<TeamForm onSubmit={onSubmit} />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Fibalon Baskets' } })
    fireEvent.submit(screen.getByRole('form'))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Fibalon Baskets' })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/teams/TeamForm.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Implement TeamForm**

Create `src/components/teams/TeamForm.tsx`:

```tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface TeamFormData {
  name: string
  logoUrl: string
  color: string
  contact: string
}

interface Props {
  initial?: TeamFormData
  onSubmit: (data: TeamFormData) => void
  onCancel?: () => void
}

export default function TeamForm({ initial, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<TeamFormData>({
    name: initial?.name ?? '',
    logoUrl: initial?.logoUrl ?? '',
    color: initial?.color ?? '#E8300B',
    contact: initial?.contact ?? '',
  })

  const set = (field: keyof TeamFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <form aria-label="Team-Formular" onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="team-name">Name</Label>
        <Input id="team-name" value={form.name} onChange={set('name')} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="team-logo">Logo-URL</Label>
        <Input id="team-logo" value={form.logoUrl} onChange={set('logoUrl')} placeholder="https://..." />
      </div>
      <div className="space-y-1">
        <Label htmlFor="team-color">Farbe</Label>
        <div className="flex gap-2 items-center">
          <input
            id="team-color"
            type="color"
            value={form.color}
            onChange={set('color')}
            className="h-9 w-12 rounded border cursor-pointer"
          />
          <Input value={form.color} onChange={set('color')} className="w-32 font-mono" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="team-contact">Kontakt</Label>
        <Input id="team-contact" value={form.contact} onChange={set('contact')} />
      </div>
      <div className="flex gap-2">
        <Button type="submit">Speichern</Button>
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>}
      </div>
    </form>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/components/teams/TeamForm.test.tsx
```

Expected: PASS

- [ ] **Step 5: Implement TeamCard and TeamList**

Create `src/components/teams/TeamCard.tsx`:

```tsx
import { Button } from '@/components/ui/button'
import type { Team } from '@/types'

interface Props {
  team: Team
  onEdit: () => void
  onDelete: () => void
}

export default function TeamCard({ team, onEdit, onDelete }: Props) {
  return (
    <div className="flex items-center gap-4 p-4 border rounded-lg bg-card">
      <div
        className="w-10 h-10 rounded-full flex-shrink-0"
        style={{ backgroundColor: team.color }}
      >
        {team.logoUrl && (
          <img src={team.logoUrl} alt={team.name} className="w-full h-full object-contain rounded-full" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{team.name}</p>
        {team.contact && <p className="text-sm text-muted-foreground truncate">{team.contact}</p>}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onEdit}>Bearbeiten</Button>
        <Button size="sm" variant="destructive" onClick={onDelete}>Löschen</Button>
      </div>
    </div>
  )
}
```

Create `src/components/teams/TeamList.tsx`:

```tsx
import { useState } from 'react'
import { useTournamentStore } from '@/store/tournament-store'
import TeamCard from './TeamCard'
import TeamForm from './TeamForm'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Team } from '@/types'

export default function TeamList() {
  const { tournament, addTeam, updateTeam, removeTeam } = useTournamentStore()
  const [showAdd, setShowAdd] = useState(false)
  const [editTeam, setEditTeam] = useState<Team | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{tournament.teams.length} Teams</p>
        <Button onClick={() => setShowAdd(true)}>Team hinzufügen</Button>
      </div>

      {tournament.teams.length === 0 && (
        <p className="text-muted-foreground text-center py-8">Noch keine Teams. Füge das erste Team hinzu.</p>
      )}

      <div className="space-y-2">
        {tournament.teams.map(team => (
          <TeamCard
            key={team.id}
            team={team}
            onEdit={() => setEditTeam(team)}
            onDelete={() => removeTeam(team.id)}
          />
        ))}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Team hinzufügen</DialogTitle></DialogHeader>
          <TeamForm
            onSubmit={(data) => { addTeam(data); setShowAdd(false) }}
            onCancel={() => setShowAdd(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTeam} onOpenChange={() => setEditTeam(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Team bearbeiten</DialogTitle></DialogHeader>
          {editTeam && (
            <TeamForm
              initial={editTeam}
              onSubmit={(data) => { updateTeam(editTeam.id, data); setEditTeam(null) }}
              onCancel={() => setEditTeam(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 6: Wire up TeamsPage**

Replace `src/pages/TeamsPage.tsx`:

```tsx
import TeamList from '@/components/teams/TeamList'

export default function TeamsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Teams</h1>
      <TeamList />
    </div>
  )
}
```

- [ ] **Step 7: Verify in browser**

```bash
npm run dev
```

Navigate to `/teams` — add a team, verify it persists after page refresh.

- [ ] **Step 8: Commit**

```bash
git add src/components/teams/ src/pages/TeamsPage.tsx
git commit -m "feat: add teams management page"
```

---

## Task 9: Config Page

**Files:**
- Create: `src/components/config/TournamentForm.tsx`
- Create: `src/components/config/GameSettingsForm.tsx`
- Modify: `src/pages/ConfigPage.tsx`

- [ ] **Step 1: Implement TournamentForm**

Create `src/components/config/TournamentForm.tsx`:

```tsx
import { useTournamentStore } from '@/store/tournament-store'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function TournamentForm() {
  const { tournament, setTournamentName, setMode, setFields } = useTournamentStore()

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="tourney-name">Turniername</Label>
        <Input
          id="tourney-name"
          value={tournament.name}
          onChange={e => setTournamentName(e.target.value)}
          placeholder="z.B. Fibalon U11-Summer Cup"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="tourney-mode">Turniermodus</Label>
        <Select value={tournament.mode} onValueChange={v => setMode(v as typeof tournament.mode)}>
          <SelectTrigger id="tourney-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="round-robin">Jeder gegen Jeden</SelectItem>
            <SelectItem value="round-robin+finals">Jeder gegen Jeden + Finale</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="tourney-fields">Parallele Felder</Label>
        <Select value={String(tournament.fields)} onValueChange={v => setFields(Number(v))}>
          <SelectTrigger id="tourney-fields">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4].map(n => (
              <SelectItem key={n} value={String(n)}>{n} {n === 1 ? 'Feld' : 'Felder'}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement GameSettingsForm**

Create `src/components/config/GameSettingsForm.tsx`:

```tsx
import { useTournamentStore } from '@/store/tournament-store'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { calcGameDurationMin } from '@/lib/game-duration'

export default function GameSettingsForm() {
  const { tournament, updateGameSettings } = useTournamentStore()
  const gs = tournament.gameSettings
  const totalMin = calcGameDurationMin(gs)

  const numField = (field: keyof typeof gs) => (e: React.ChangeEvent<HTMLInputElement>) =>
    updateGameSettings({ [field]: Number(e.target.value) })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="periods-count">Anzahl Spielabschnitte</Label>
          <Input id="periods-count" type="number" min={2} max={8} value={gs.periodsCount} onChange={numField('periodsCount')} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="period-duration">Dauer pro Abschnitt (Min)</Label>
          <Input id="period-duration" type="number" min={1} max={30} value={gs.periodDurationMin} onChange={numField('periodDurationMin')} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="period-break">Pause zwischen Abschnitten (Min)</Label>
          <Input id="period-break" type="number" min={0} max={15} value={gs.breakBetweenPeriodsMin} onChange={numField('breakBetweenPeriodsMin')} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="halftime-break">Halbzeitpause (Min)</Label>
          <Input id="halftime-break" type="number" min={0} max={30} value={gs.halfTimeBreakMin} onChange={numField('halfTimeBreakMin')} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="buffer">Wechselzeit zwischen Spielen (Min)</Label>
          <Input id="buffer" type="number" min={0} max={30} value={gs.bufferBetweenGamesMin} onChange={numField('bufferBetweenGamesMin')} />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Spielzeit gesamt: <strong>{totalMin} Minuten</strong> (ohne Wechselzeit)
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Wire up ConfigPage**

Replace `src/pages/ConfigPage.tsx`:

```tsx
import TournamentForm from '@/components/config/TournamentForm'
import GameSettingsForm from '@/components/config/GameSettingsForm'

export default function ConfigPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Turnierkonfiguration</h1>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Allgemein</h2>
        <TournamentForm />
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Spieleinstellungen</h2>
        <GameSettingsForm />
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Verify in browser**

Navigate to `/config` — change values, refresh, verify they persist.

- [ ] **Step 5: Commit**

```bash
git add src/components/config/ src/pages/ConfigPage.tsx
git commit -m "feat: add tournament and game settings configuration page"
```

---

## Task 10: Venue Config & Schedule Generation

**Files:**
- Create: `src/components/venue/VenueForm.tsx`
- Create: `src/components/venue/BlackoutList.tsx`
- Create: `src/components/schedule/ScheduleView.tsx`
- Create: `src/components/schedule/GameRow.tsx`
- Create: `src/components/schedule/ConflictBadge.tsx`
- Modify: `src/pages/SchedulePage.tsx`

- [ ] **Step 1: Implement VenueForm**

Create `src/components/venue/VenueForm.tsx`:

```tsx
import { useTournamentStore } from '@/store/tournament-store'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function VenueForm() {
  const { tournament, updateVenue } = useTournamentStore()
  const venue = tournament.venue
  const window = venue.availabilityWindows[0] ?? { start: '09:00', end: '20:00' }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="venue-name">Hallenname</Label>
        <Input id="venue-name" value={venue.name} onChange={e => updateVenue({ name: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="venue-open">Öffnet</Label>
          <Input
            id="venue-open" type="time" value={window.start}
            onChange={e => updateVenue({ availabilityWindows: [{ ...window, start: e.target.value }] })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="venue-close">Schließt</Label>
          <Input
            id="venue-close" type="time" value={window.end}
            onChange={e => updateVenue({ availabilityWindows: [{ ...window, end: e.target.value }] })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="setup-buffer">Aufbauzeit (Min)</Label>
          <Input
            id="setup-buffer" type="number" min={0} max={120}
            value={venue.setupBufferMin}
            onChange={e => updateVenue({ setupBufferMin: Number(e.target.value) })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="teardown-buffer">Abbauzeit (Min)</Label>
          <Input
            id="teardown-buffer" type="number" min={0} max={120}
            value={venue.teardownBufferMin}
            onChange={e => updateVenue({ teardownBufferMin: Number(e.target.value) })}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement BlackoutList**

Create `src/components/venue/BlackoutList.tsx`:

```tsx
import { useState } from 'react'
import { useTournamentStore } from '@/store/tournament-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { TimeWindow } from '@/types'

export default function BlackoutList() {
  const { tournament, updateVenue } = useTournamentStore()
  const blackouts = tournament.venue.blackoutPeriods
  const [newBlackout, setNewBlackout] = useState<TimeWindow>({ start: '12:00', end: '14:00', reason: '' })

  const add = () => {
    updateVenue({ blackoutPeriods: [...blackouts, newBlackout] })
    setNewBlackout({ start: '12:00', end: '14:00', reason: '' })
  }

  const remove = (index: number) => {
    updateVenue({ blackoutPeriods: blackouts.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-4">
      <h3 className="font-medium">Sperrzeiten</h3>
      {blackouts.length === 0 && (
        <p className="text-sm text-muted-foreground">Keine Sperrzeiten definiert.</p>
      )}
      {blackouts.map((b, i) => (
        <div key={i} className="flex items-center gap-3 p-3 border rounded bg-muted/30">
          <span className="font-mono text-sm">{b.start}–{b.end}</span>
          {b.reason && <span className="text-sm text-muted-foreground">{b.reason}</span>}
          <Button size="sm" variant="destructive" className="ml-auto" onClick={() => remove(i)}>Entfernen</Button>
        </div>
      ))}
      <div className="flex gap-2 items-end flex-wrap">
        <div className="space-y-1">
          <Label>Von</Label>
          <Input type="time" value={newBlackout.start} onChange={e => setNewBlackout(p => ({ ...p, start: e.target.value }))} className="w-32" />
        </div>
        <div className="space-y-1">
          <Label>Bis</Label>
          <Input type="time" value={newBlackout.end} onChange={e => setNewBlackout(p => ({ ...p, end: e.target.value }))} className="w-32" />
        </div>
        <div className="space-y-1 flex-1">
          <Label>Grund (optional)</Label>
          <Input value={newBlackout.reason ?? ''} onChange={e => setNewBlackout(p => ({ ...p, reason: e.target.value }))} placeholder="z.B. Mittagshitze" />
        </div>
        <Button onClick={add}>Hinzufügen</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Implement ConflictBadge**

Create `src/components/schedule/ConflictBadge.tsx`:

```tsx
interface Props {
  message: string
}

export default function ConflictBadge({ message }: Props) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-destructive text-destructive-foreground">
      {message}
    </span>
  )
}
```

- [ ] **Step 4: Implement GameRow**

Create `src/components/schedule/GameRow.tsx`:

```tsx
import { useTournamentStore } from '@/store/tournament-store'
import { Input } from '@/components/ui/input'
import ConflictBadge from './ConflictBadge'
import { overlapsBlackout } from '@/lib/game-duration'
import type { Game } from '@/types'

interface Props {
  game: Game
}

export default function GameRow({ game }: Props) {
  const { tournament, updateGameTime } = useTournamentStore()
  const teams = tournament.teams
  const home = teams.find(t => t.id === game.homeTeamId)
  const away = teams.find(t => t.id === game.awayTeamId)

  const hasBlackoutConflict = tournament.venue.blackoutPeriods.some(b =>
    overlapsBlackout(game.scheduledStart, game.scheduledEnd, b)
  )

  return (
    <div className="flex items-center gap-4 py-3 border-b last:border-0">
      <span className="text-sm text-muted-foreground w-6">#{game.gameNumber}</span>
      <span className="text-sm font-mono w-8 text-center bg-muted rounded px-1">F{game.field}</span>
      <Input
        type="time"
        value={game.scheduledStart}
        onChange={e => updateGameTime(game.id, e.target.value)}
        className="w-28 font-mono"
      />
      <span className="text-sm text-muted-foreground">–{game.scheduledEnd}</span>
      <div className="flex items-center gap-2 flex-1">
        <span className="font-medium">{home?.name ?? '?'}</span>
        <span className="text-muted-foreground text-sm">vs</span>
        <span className="font-medium">{away?.name ?? '?'}</span>
      </div>
      {hasBlackoutConflict && <ConflictBadge message="Sperrzeit!" />}
    </div>
  )
}
```

- [ ] **Step 5: Implement ScheduleView**

Create `src/components/schedule/ScheduleView.tsx`:

```tsx
import { useTournamentStore } from '@/store/tournament-store'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import GameRow from './GameRow'

export default function ScheduleView() {
  const { tournament, schedule, generateAndSaveSchedule } = useTournamentStore()

  const canGenerate = tournament.teams.length >= 2

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          {schedule && (
            <p className="text-sm text-muted-foreground">
              {schedule.games.length} Spiele · Ende ca. {schedule.estimatedEnd}
            </p>
          )}
        </div>
        <Button onClick={generateAndSaveSchedule} disabled={!canGenerate}>
          Zeitplan generieren
        </Button>
      </div>

      {!canGenerate && (
        <Alert>
          <AlertDescription>Mindestens 2 Teams erforderlich.</AlertDescription>
        </Alert>
      )}

      {schedule && schedule.games.length === 0 && (
        <Alert>
          <AlertDescription>Kein Zeitplan möglich — Halle zu kurz oder zu viele Sperrzeiten.</AlertDescription>
        </Alert>
      )}

      {schedule && schedule.games.length > 0 && (
        <div className="border rounded-lg p-4 bg-card">
          {schedule.games.map(game => (
            <GameRow key={game.id} game={game} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Wire up SchedulePage**

Replace `src/pages/SchedulePage.tsx`:

```tsx
import VenueForm from '@/components/venue/VenueForm'
import BlackoutList from '@/components/venue/BlackoutList'
import ScheduleView from '@/components/schedule/ScheduleView'

export default function SchedulePage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Zeitplan</h1>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Hallenkonfiguration</h2>
        <VenueForm />
        <BlackoutList />
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Spielplan</h2>
        <ScheduleView />
      </section>
    </div>
  )
}
```

- [ ] **Step 7: Verify in browser**

Navigate to `/schedule` — add teams on `/teams` first, then generate a schedule. Verify blackout periods block game slots.

- [ ] **Step 8: Commit**

```bash
git add src/components/venue/ src/components/schedule/ src/pages/SchedulePage.tsx
git commit -m "feat: add venue configuration, schedule generator, and manual adjustment"
```

---

## Task 11: Export (JSON + PDF + HTML)

**Files:**
- Create: `src/lib/export/json-export.ts`
- Create: `src/lib/export/html-export.ts`
- Create: `src/lib/export/pdf-export.ts`
- Create: `src/components/export/ExportPanel.tsx`
- Modify: `src/pages/ExportPage.tsx`

- [ ] **Step 1: Install dependencies**

```bash
npm install @react-pdf/renderer jszip
npm install -D @types/jszip
```

- [ ] **Step 2: Implement JSON export**

Create `src/lib/export/json-export.ts`:

```ts
import type { TournamentConfig, Schedule } from '@/types'

export function downloadJson(tournament: TournamentConfig, schedule: Schedule | null): void {
  const data = { tournament, schedule, exportedAt: new Date().toISOString() }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${tournament.name.replace(/\s+/g, '-')}-zeitplan.json`
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 3: Implement HTML export**

Create `src/lib/export/html-export.ts`:

```ts
import type { TournamentConfig, Schedule } from '@/types'
import JSZip from 'jszip'

function buildHtml(tournament: TournamentConfig, schedule: Schedule): string {
  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))

  const rows = schedule.games.map(g => {
    const home = teamMap.get(g.homeTeamId)?.name ?? '?'
    const away = teamMap.get(g.awayTeamId)?.name ?? '?'
    return `<tr>
      <td>${g.gameNumber}</td>
      <td>Feld ${g.field}</td>
      <td>${g.scheduledStart} – ${g.scheduledEnd}</td>
      <td>${home} vs ${away}</td>
    </tr>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${tournament.name}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
    h1 { font-size: 1.75rem; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { padding: 0.5rem 1rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { font-weight: 600; background: #f9fafb; }
  </style>
</head>
<body>
  <h1>${tournament.name}</h1>
  <p>${schedule.games.length} Spiele · Ende ca. ${schedule.estimatedEnd}</p>
  <table>
    <thead><tr><th>#</th><th>Feld</th><th>Zeit</th><th>Paarung</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`
}

export async function downloadHtmlZip(tournament: TournamentConfig, schedule: Schedule): Promise<void> {
  const html = buildHtml(tournament, schedule)
  const zip = new JSZip()
  zip.file('index.html', html)
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${tournament.name.replace(/\s+/g, '-')}-zeitplan.zip`
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 4: Implement PDF export**

Create `src/lib/export/pdf-export.ts`:

```ts
import { pdf } from '@react-pdf/renderer'
import { createElement } from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { TournamentConfig, Schedule } from '@/types'

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 11, color: '#6b7280', marginBottom: 20 },
  tableHeader: { flexDirection: 'row', borderBottom: '2px solid #1a1a1a', paddingBottom: 4, marginBottom: 4 },
  tableRow: { flexDirection: 'row', borderBottom: '1px solid #e5e7eb', paddingVertical: 5 },
  cell: { fontSize: 10 },
  col1: { width: '8%' },
  col2: { width: '12%' },
  col3: { width: '20%' },
  col4: { width: '60%' },
})

function SchedulePdf({ tournament, schedule }: { tournament: TournamentConfig; schedule: Schedule }) {
  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))
  return createElement(Document, {},
    createElement(Page, { size: 'A4', style: styles.page },
      createElement(View, {},
        createElement(Text, { style: styles.title }, tournament.name),
        createElement(Text, { style: styles.subtitle },
          `${schedule.games.length} Spiele · Ende ca. ${schedule.estimatedEnd}`
        ),
        createElement(View, { style: styles.tableHeader },
          createElement(Text, { style: { ...styles.cell, ...styles.col1 } }, '#'),
          createElement(Text, { style: { ...styles.cell, ...styles.col2 } }, 'Feld'),
          createElement(Text, { style: { ...styles.cell, ...styles.col3 } }, 'Zeit'),
          createElement(Text, { style: { ...styles.cell, ...styles.col4 } }, 'Paarung'),
        ),
        ...schedule.games.map(g => {
          const home = teamMap.get(g.homeTeamId)?.name ?? '?'
          const away = teamMap.get(g.awayTeamId)?.name ?? '?'
          return createElement(View, { key: g.id, style: styles.tableRow },
            createElement(Text, { style: { ...styles.cell, ...styles.col1 } }, String(g.gameNumber)),
            createElement(Text, { style: { ...styles.cell, ...styles.col2 } }, `Feld ${g.field}`),
            createElement(Text, { style: { ...styles.cell, ...styles.col3 } }, `${g.scheduledStart}–${g.scheduledEnd}`),
            createElement(Text, { style: { ...styles.cell, ...styles.col4 } }, `${home} vs ${away}`),
          )
        }),
      )
    )
  )
}

export async function downloadPdf(tournament: TournamentConfig, schedule: Schedule): Promise<void> {
  const instance = pdf(createElement(SchedulePdf, { tournament, schedule }))
  const blob = await instance.toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${tournament.name.replace(/\s+/g, '-')}-zeitplan.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 5: Implement ExportPanel**

Create `src/components/export/ExportPanel.tsx`:

```tsx
import { useTournamentStore } from '@/store/tournament-store'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { downloadJson } from '@/lib/export/json-export'
import { downloadHtmlZip } from '@/lib/export/html-export'
import { downloadPdf } from '@/lib/export/pdf-export'

export default function ExportPanel() {
  const { tournament, schedule } = useTournamentStore()
  const ready = !!schedule && schedule.games.length > 0

  if (!ready) {
    return (
      <Alert>
        <AlertDescription>Bitte zuerst einen Zeitplan generieren (Seite "Zeitplan").</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {schedule!.games.length} Spiele, Ende ca. {schedule!.estimatedEnd}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => downloadPdf(tournament, schedule!)}
          className="gap-2"
        >
          PDF herunterladen
        </Button>
        <Button
          variant="outline"
          onClick={() => downloadHtmlZip(tournament, schedule!)}
        >
          Web-Seite (ZIP) herunterladen
        </Button>
        <Button
          variant="outline"
          onClick={() => downloadJson(tournament, schedule)}
        >
          JSON herunterladen
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Wire up ExportPage**

Replace `src/pages/ExportPage.tsx`:

```tsx
import ExportPanel from '@/components/export/ExportPanel'

export default function ExportPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Export</h1>
      <ExportPanel />
    </div>
  )
}
```

- [ ] **Step 7: Verify exports work**

```bash
npm run dev
```

Navigate to `/export` — download PDF, ZIP, and JSON. Verify each opens correctly.

- [ ] **Step 8: Commit**

```bash
git add src/lib/export/ src/components/export/ src/pages/ExportPage.tsx
git commit -m "feat: add PDF, HTML, and JSON export"
```

---

## Task 12: Final Polish & Vercel Deploy

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Fix client-side routing for Vercel**

Create `vercel.json`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 3: Build for production**

```bash
npm run build
```

Expected: `dist/` folder created, no errors.

- [ ] **Step 4: Preview production build locally**

```bash
npm run preview
```

Open `http://localhost:4173` — verify all 4 pages work, data persists, exports download.

- [ ] **Step 5: Final commit**

```bash
git add vercel.json
git commit -m "feat: add Vercel routing config and verify production build"
```

- [ ] **Step 6: Deploy to Vercel (optional)**

```bash
npx vercel --prod
```

Expected: deployment URL printed. Share with others.

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Teams anlegen/bearbeiten/löschen (Task 8)
- ✅ Logo-URL, Farbe, Kontakt (Task 8)
- ✅ Player-Datenstruktur vorbereitet (Task 2 — types only)
- ✅ Turniermodus, Felder konfigurieren (Task 9)
- ✅ Spielabschnitte, Dauern, Pausen (Task 9)
- ✅ Hallenverfügbarkeit + Sperrzeiten (Task 10)
- ✅ Rüstzeiten Aufbau/Abbau (Task 10)
- ✅ Zeitplan automatisch generieren (Task 4 + 10)
- ✅ Manuelle Zeitanpassung (Task 10 — GameRow)
- ✅ Konflikte visuell markieren (Task 10 — ConflictBadge)
- ✅ PDF Export (Task 11)
- ✅ Web-Seite Export (Task 11)
- ✅ JSON Export (Task 11)
- ✅ Offline im Browser (kein Backend)
- ✅ Vercel Deploy (Task 12)
- ✅ Design: shadcn/ui + Tailwind + Fibalon Branding (Task 1)
