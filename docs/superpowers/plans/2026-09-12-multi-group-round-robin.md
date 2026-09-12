# Mehrgruppen-Vorrunde + Round-Robin-Feldverteilungs-Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Round-Robin-Zeitpläne nutzen alle verfügbaren Felder optimal aus (Circle-Method statt naiver Paarliste) und Turniere können in mehrere parallele Vorrundengruppen aufgeteilt werden, jede mit eigener Tabelle.

**Architecture:** Ein neuer `generateRoundRobinRounds`-Generator (Circle-Method/Berger-Tabelle) ersetzt die bisherige flache Paarliste und erzeugt pro Gruppe eine Liste von Runden. Mehrere Gruppen werden rundenweise interleaved in die bestehende Feld-Zuweisungslogik gegeben. Neue Store-Felder (`Team.groupId`, `TournamentConfig.groupCount`/`doubleRoundRobin`, `Game.groupId`) und eine neue `computeGroupStandings`-Funktion (Punkte → direkter Vergleich → Korbdifferenz, kein Buchholz) versorgen eine neue `GroupOverviewPage`. Zusätzlich wird `TeamNameDisplay` (bereits an allen Stellen im Einsatz, an denen Teamnamen angezeigt werden — `GameRow`, `SwissOverviewPage`, `SwissResultsPage`, und die neue `GroupOverviewPage`/`GroupAssignmentForm`) um die Anzeige des bereits im Datenmodell vorhandenen, aber bislang in diesen Ansichten ungenutzten `Team.logoUrl` ergänzt, sodass gepflegte Logos überall dort sichtbar werden, wo bisher nur der Teamname stand.

**Tech Stack:** TypeScript, React, Zustand, Vitest, bestehende Projektkonventionen (siehe `src/lib/schedule-generator.ts`, `src/lib/standings.ts`, `src/pages/SwissOverviewPage.tsx` als direkte Vorlagen).

Spec: `docs/superpowers/specs/2026-09-12-multi-group-round-robin-design.md` (und Root-Cause-Analyse in `docs/superpowers/specs/2026-09-12-round-robin-field-utilization-design.md`).

---

## Task 1: Circle-Method-Generator (`generateRoundRobinRounds`)

**Files:**
- Modify: `src/lib/schedule-generator.ts`
- Modify: `src/lib/schedule-generator.test.ts`

- [ ] **Step 1: Fehlschlagenden Test schreiben**

Lies die vollständige aktuelle `src/lib/schedule-generator.test.ts` (bereits im Kontext dieses Plans vollständig zitiert). Ergänze am Ende der Datei, vor der letzten schließenden Klammer, einen neuen `describe`-Block:

```typescript
describe('generateRoundRobinRounds', () => {
  it('generates N-1 rounds with N/2 pairs each for even team counts', () => {
    const rounds = generateRoundRobinRounds(['t1', 't2', 't3', 't4'])
    expect(rounds).toHaveLength(3)
    for (const round of rounds) {
      expect(round).toHaveLength(2)
    }
  })

  it('generates N rounds with (N-1)/2 pairs each for odd team counts (one team sits out per round)', () => {
    const rounds = generateRoundRobinRounds(['t1', 't2', 't3'])
    expect(rounds).toHaveLength(3)
    for (const round of rounds) {
      expect(round).toHaveLength(1)
    }
  })

  it('every team appears at most once per round', () => {
    const rounds = generateRoundRobinRounds(['t1', 't2', 't3', 't4', 't5', 't6'])
    for (const round of rounds) {
      const teamsInRound = round.flatMap(([home, away]) => [home, away])
      const uniqueTeams = new Set(teamsInRound)
      expect(uniqueTeams.size).toBe(teamsInRound.length)
    }
  })

  it('each unique pair plays exactly once across all rounds', () => {
    const rounds = generateRoundRobinRounds(['t1', 't2', 't3', 't4', 't5'])
    const seen = new Set<string>()
    let totalPairs = 0
    for (const round of rounds) {
      for (const [home, away] of round) {
        const key = [home, away].sort().join('|')
        expect(seen.has(key)).toBe(false)
        seen.add(key)
        totalPairs++
      }
    }
    // 5 teams: 5×4/2 = 10 unique pairs
    expect(totalPairs).toBe(10)
  })

  it('returns an empty array for a single team', () => {
    expect(generateRoundRobinRounds(['t1'])).toEqual([])
  })

  it('returns one round with one pair for two teams', () => {
    const rounds = generateRoundRobinRounds(['t1', 't2'])
    expect(rounds).toEqual([[['t1', 't2']]])
  })
})
```

Am Kopf der Testdatei den Import erweitern:
```typescript
import { generateRoundRobinPairs, generateRoundRobinRounds, generateSchedule } from './schedule-generator'
```

Run: `npm test -- --run src/lib/schedule-generator.test.ts`
Expected: FAIL — `generateRoundRobinRounds` existiert noch nicht (Import-Fehler / `undefined is not a function`).

- [ ] **Step 2: Implementierung**

In `src/lib/schedule-generator.ts`, NACH der bestehenden `generateRoundRobinPairs`-Funktion (Zeilen 7-16), NEUE Funktion ergänzen:

```typescript
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
```

- [ ] **Step 3: Test ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/lib/schedule-generator.test.ts`
Expected: alle neuen Tests PASS. Die bestehenden `generateRoundRobinPairs`-Tests bleiben unverändert PASS (diese Funktion wird in Task 1 noch nicht entfernt/geändert — das passiert erst in Task 2, wenn sie durch die neue Funktion ersetzt wird).

- [ ] **Step 4: Vollen Testlauf + Build**

Run: `npm test -- --run && npm run build`
Expected: alle grün.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schedule-generator.ts src/lib/schedule-generator.test.ts
git commit -m "feat: add circle-method round-robin generator producing parallel-schedulable rounds"
```

---

## Task 2: `generateSchedule` nutzt Circle-Method-Runden (behebt Feldverteilungs-Bug)

**Files:**
- Modify: `src/lib/schedule-generator.ts`
- Modify: `src/lib/schedule-generator.test.ts`

- [ ] **Step 1: Fehlschlagenden Test schreiben**

Ergänze in `src/lib/schedule-generator.test.ts`, im bestehenden `describe('generateSchedule', ...)`-Block (nach der letzten vorhandenen `it`, vor der schließenden `})`):

```typescript
  it('utilizes all available fields simultaneously when enough teams exist', () => {
    const config: TournamentConfig = {
      ...baseConfig,
      fields: 3,
      teams: [
        makeTeam('t1', 'Team 1'), makeTeam('t2', 'Team 2'),
        makeTeam('t3', 'Team 3'), makeTeam('t4', 'Team 4'),
        makeTeam('t5', 'Team 5'), makeTeam('t6', 'Team 6'),
        makeTeam('t7', 'Team 7'), makeTeam('t8', 'Team 8'),
      ],
    }
    const schedule = generateSchedule(config)
    const byStart = new Map<string, number>()
    for (const game of schedule.games) {
      byStart.set(game.scheduledStart, (byStart.get(game.scheduledStart) ?? 0) + 1)
    }
    // With 8 teams and 3 fields, the very first wave of games must use all 3 fields at once —
    // this is exactly the bug that was reported and reproduced (only 1 field used at the start).
    const firstStart = schedule.games[0].scheduledStart
    expect(byStart.get(firstStart)).toBe(3)
  })

  it('assigns increasing round numbers to round-robin games matching the circle-method structure', () => {
    const schedule = generateSchedule(baseConfig)
    // 4 teams -> 3 rounds, 2 games per round
    const rounds = new Set(schedule.games.map(g => g.round))
    expect(rounds).toEqual(new Set([1, 2, 3]))
    for (const round of rounds) {
      expect(schedule.games.filter(g => g.round === round)).toHaveLength(2)
    }
  })
```

Run: `npm test -- --run src/lib/schedule-generator.test.ts`
Expected: beide Tests FAIL — der aktuelle Code nutzt noch die flache `generateRoundRobinPairs`-Liste (alle Spiele `round: 1`, keine garantierte Feld-Parallelität am Anfang).

- [ ] **Step 2: Implementierung**

In `src/lib/schedule-generator.ts`, die Round-Robin-Planungsschleife (aktuell Zeilen 56-103) ersetzen.

Aktuell:
```typescript
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
```

Ändern zu:
```typescript
  const rounds = generateRoundRobinRounds(teams.map(t => t.id))
  const games: Game[] = []
  let gameNumber = 1

  for (let roundIndex = 0; roundIndex < rounds.length; roundIndex++) {
    for (const [homeTeamId, awayTeamId] of rounds[roundIndex]) {
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
      })

      fieldNextFree[bestField] = addMinutes(bestSlotStart, slotDuration)
      teamNextFree.set(homeTeamId, addMinutes(bestSlotStart, slotDuration))
      teamNextFree.set(awayTeamId, addMinutes(bestSlotStart, slotDuration))
    }
  }
```

WICHTIG: `generateRoundRobinPairs` selbst NICHT löschen — sie bleibt exportiert und von den bestehenden `describe('generateRoundRobinPairs', ...)`-Tests verwendet (Rückwärtskompatibilität als reine Utility-Funktion; sie wird nur nicht mehr INTERN von `generateSchedule` aufgerufen).

Import-Zeile am Kopf der Datei ergänzen (`generateRoundRobinRounds` zur bestehenden Import-Zeile aus derselben Datei hinzufügen — es ist eine lokale Funktion in derselben Datei, kein zusätzlicher Import nötig, da beide Funktionen in `schedule-generator.ts` selbst definiert sind).

- [ ] **Step 3: Test ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/lib/schedule-generator.test.ts`
Expected: alle Tests PASS, inklusive aller bereits bestehenden Tests (die bestehenden Tests prüfen Spielanzahl/Feldüberlappung/Team-Überlappung — bleiben mit der neuen Rundenstruktur weiterhin gültig, da sich an den grundlegenden Constraints nichts ändert, nur an der Reihenfolge/Rundenzuordnung).

- [ ] **Step 4: Vollen Testlauf + Build + E2E**

Run: `npm test -- --run && npm run build && npm run test:e2e`
Expected: alle grün. Falls ein e2e-Test explizit auf `round: 1` für alle Round-Robin-Spiele prüft (unwahrscheinlich, aber verifizieren: `grep -rn "round-robin\|mode.*round-robin" e2e/`), Assertion anpassen — das wäre eine korrekte Anpassung an das jetzt verbesserte Verhalten, kein Zurücknehmen des Fixes.

- [ ] **Step 5: Manuell im Browser verifizieren**

`npm run dev`, Playwright MCP: 8 Teams anlegen, Modus "Jeder gegen Jeden", 3 Felder, Zeitplan generieren, zur Zeitplan-Seite navigieren — bestätigen, dass die ersten Spiele bereits alle 3 Felder gleichzeitig nutzen (nicht wie vorher nur 1 Feld am Anfang).

- [ ] **Step 6: Commit**

```bash
git add src/lib/schedule-generator.ts src/lib/schedule-generator.test.ts
git commit -m "fix: use circle-method rounds instead of a flat pair list to utilize all fields simultaneously"
```

---

## Task 3: Datenmodell-Erweiterungen (Team.groupId, TournamentConfig.groupCount/doubleRoundRobin, Game.groupId)

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/types/index.test.ts`

- [ ] **Step 1: Fehlschlagenden Test schreiben**

Lies die aktuelle `src/types/index.test.ts` vollständig, um das bestehende Testmuster für Typ-Shape-Tests zu übernehmen (reine Compile-Zeit-/Struktur-Tests, keine Laufzeitlogik). Ergänze:

```typescript
  it('Team can have an optional groupId', () => {
    const team: Team = {
      id: 'uuid-1', name: 'Musterstadt Baskets', logoUrl: '', color: '#004174',
      contact: '', players: [], groupId: 'B',
    }
    expect(team.groupId).toBe('B')
  })

  it('TournamentConfig can have optional groupCount and doubleRoundRobin', () => {
    const config: Pick<TournamentConfig, 'groupCount' | 'doubleRoundRobin'> = {
      groupCount: 2,
      doubleRoundRobin: true,
    }
    expect(config.groupCount).toBe(2)
    expect(config.doubleRoundRobin).toBe(true)
  })

  it('Game can have an optional groupId', () => {
    const game: Pick<Game, 'groupId'> = { groupId: 'A' }
    expect(game.groupId).toBe('A')
  })
```

Passe den Import am Kopf der Datei an, falls `TournamentConfig` dort noch nicht importiert ist (prüfe die aktuelle Datei — `Team`, `Player`, `Game` sind laut bisherigem Plan-Kontext bereits importiert).

Run: `npm test -- --run src/types/index.test.ts`
Expected: FAIL — TypeScript-Compile-Fehler, da `groupId`/`groupCount`/`doubleRoundRobin` noch nicht im Typ existieren.

- [ ] **Step 2: Implementierung**

In `src/types/index.ts`:

`Team`-Interface (aktuell Zeilen 8-17) erweitern:
```typescript
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
}
```

`TournamentConfig`-Interface (aktuell Zeilen 45-55) erweitern:
```typescript
export interface TournamentConfig {
  id: string
  name: string
  mode: TournamentMode
  finalsBracketSize?: 2 | 4  // only relevant when mode === 'round-robin+finals'; 4 = semifinals+final, 2 = final only
  swissRounds?: number       // only relevant when mode === 'swiss'; number of swiss rounds to play
  groupCount?: number        // only relevant when mode === 'round-robin+finals'; number of parallel group-stage groups, default 1
  doubleRoundRobin?: boolean // if true, each group plays a return leg (home/away swapped), default false
  fields: number
  gameSettings: GameSettings
  venue: Venue
  teams: Team[]
}
```

`Game`-Interface (aktuell Zeilen 65-80) erweitern:
```typescript
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
}
```

Lies die tatsächliche aktuelle Datei vor dem Editieren, um die exakte bestehende Formatierung/Kommentare zu bewahren — die obigen Blöcke sind vollständig, aber die exakten umgebenden Zeilen können sich seit der letzten Lesung dieses Plans geringfügig verschoben haben.

- [ ] **Step 3: Test ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/types/index.test.ts`
Expected: alle Tests PASS.

- [ ] **Step 4: Vollen Testlauf + Build**

Run: `npm test -- --run && npm run build`
Expected: alle grün (rein additive, optionale Felder — keine bestehende Stelle im Code kann dadurch brechen).

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/types/index.test.ts
git commit -m "feat: add groupId/groupCount/doubleRoundRobin fields for multi-group round-robin"
```

---

## Task 4: Mehrgruppen-Interleaving in `generateSchedule`

**Files:**
- Modify: `src/lib/schedule-generator.ts`
- Modify: `src/lib/schedule-generator.test.ts`

- [ ] **Step 1: Fehlschlagenden Test schreiben**

Ergänze in `src/lib/schedule-generator.test.ts` einen neuen `describe`-Block:

```typescript
describe('generateSchedule with multiple groups', () => {
  const multiGroupConfig: TournamentConfig = {
    ...baseConfig,
    mode: 'round-robin+finals',
    finalsBracketSize: 4,
    fields: 4,
    groupCount: 2,
    teams: [
      { ...makeTeam('t1', 'Team 1'), groupId: 'A' },
      { ...makeTeam('t2', 'Team 2'), groupId: 'A' },
      { ...makeTeam('t3', 'Team 3'), groupId: 'A' },
      { ...makeTeam('t4', 'Team 4'), groupId: 'A' },
      { ...makeTeam('t5', 'Team 5'), groupId: 'B' },
      { ...makeTeam('t6', 'Team 6'), groupId: 'B' },
      { ...makeTeam('t7', 'Team 7'), groupId: 'B' },
      { ...makeTeam('t8', 'Team 8'), groupId: 'B' },
    ],
  }

  it('generates group-stage games tagged with their groupId', () => {
    const schedule = generateSchedule(multiGroupConfig)
    const groupGames = schedule.games.filter(g => g.stage === 'group')
    // 2 groups of 4 teams each: 6 games per group = 12 total
    expect(groupGames).toHaveLength(12)
    expect(groupGames.filter(g => g.groupId === 'A')).toHaveLength(6)
    expect(groupGames.filter(g => g.groupId === 'B')).toHaveLength(6)
  })

  it('never pairs teams from different groups against each other', () => {
    const schedule = generateSchedule(multiGroupConfig)
    const teamGroup = new Map(multiGroupConfig.teams.map(t => [t.id, t.groupId]))
    for (const game of schedule.games.filter(g => g.stage === 'group')) {
      expect(teamGroup.get(game.homeTeamId!)).toBe(teamGroup.get(game.awayTeamId!))
    }
  })

  it('interleaves round 1 of both groups so multiple fields are used simultaneously', () => {
    const schedule = generateSchedule(multiGroupConfig)
    const round1Games = schedule.games.filter(g => g.stage === 'group' && g.round === 1)
    // Round 1 of each 4-team group has 2 games; both groups' round 1 together = 4 games,
    // and with 4 fields available they should all start at the same time.
    expect(round1Games).toHaveLength(4)
    const startTimes = new Set(round1Games.map(g => g.scheduledStart))
    expect(startTimes.size).toBe(1)
  })

  it('falls back to a single group "A" when groupCount is not set', () => {
    const singleGroupConfig: TournamentConfig = {
      ...baseConfig,
      mode: 'round-robin+finals',
      finalsBracketSize: 4,
    }
    const schedule = generateSchedule(singleGroupConfig)
    const groupGames = schedule.games.filter(g => g.stage === 'group')
    expect(groupGames.every(g => g.groupId === 'A')).toBe(true)
  })
})
```

Run: `npm test -- --run src/lib/schedule-generator.test.ts`
Expected: die neuen Tests FAIL (kein `groupId` wird aktuell gesetzt, keine Interleaving-Logik existiert; der 4. Test über Fallback-Verhalten könnte zufällig passen, aber die ersten drei schlagen definitiv fehl).

- [ ] **Step 2: Implementierung**

In `src/lib/schedule-generator.ts`, die in Task 2 erstellte Planungsschleife durch eine gruppenbewusste Version ersetzen.

Aktuell (nach Task 2):
```typescript
  const rounds = generateRoundRobinRounds(teams.map(t => t.id))
  const games: Game[] = []
  let gameNumber = 1

  for (let roundIndex = 0; roundIndex < rounds.length; roundIndex++) {
    for (const [homeTeamId, awayTeamId] of rounds[roundIndex]) {
      /* ... slot assignment ... */
    }
  }
```

Ändern zu:
```typescript
  const groupIds = [...new Set(teams.map(t => t.groupId ?? 'A'))].sort()
  const roundsByGroup = new Map(
    groupIds.map(groupId => [
      groupId,
      generateRoundRobinRounds(teams.filter(t => (t.groupId ?? 'A') === groupId).map(t => t.id)),
    ]),
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
```

Begründung für Implementierer: `batchPairs` sammelt ALLE Paarungen von Runde `roundIndex` über ALLE Gruppen hinweg, BEVOR die Feld-Zuweisung beginnt — das stellt sicher, dass Gruppe A Runde 1 und Gruppe B Runde 1 gemeinsam um dieselben freien Felder konkurrieren (Interleaving), statt dass erst Gruppe A komplett durchgeplant wird und danach Gruppe B. Das `Map`-Objekt `roundsByGroup` iteriert in Einfüge-Reihenfolge (JS-Standardverhalten für `Map`), was hier unkritisch ist, da innerhalb eines Batches ohnehin alle Paarungen unabhängig sind (verschiedene Teams).

- [ ] **Step 3: Test ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/lib/schedule-generator.test.ts`
Expected: alle Tests PASS, inklusive aller Tests aus Task 1/2.

- [ ] **Step 4: Vollen Testlauf + Build + E2E**

Run: `npm test -- --run && npm run build && npm run test:e2e`
Expected: alle grün.

- [ ] **Step 5: Manuell im Browser verifizieren**

`npm run dev`, Playwright MCP: 8 Teams anlegen (per Store-Manipulation via Browser-Konsole `groupId` setzen ist hier noch nicht über die UI möglich — dieser Schritt wird in Task 10 UI-seitig nachgeholt; für JETZT reicht es, über die Programmierschnittstelle/DevTools zu bestätigen, dass ohne UI-Zuordnung alle Teams automatisch in Gruppe "A" landen und sich am bisherigen Verhalten nichts ändert). Bestätige: 8 Teams, Modus "Jeder gegen Jeden + Finale", Zeitplan generieren funktioniert weiterhin unverändert (Fallback auf eine einzige Gruppe).

- [ ] **Step 6: Commit**

```bash
git add src/lib/schedule-generator.ts src/lib/schedule-generator.test.ts
git commit -m "feat: interleave multiple groups' rounds for parallel field utilization"
```

---

## Task 5: `doubleRoundRobin`-Unterstützung (Rückspiel)

**Files:**
- Modify: `src/lib/schedule-generator.ts`
- Modify: `src/lib/schedule-generator.test.ts`

- [ ] **Step 1: Fehlschlagenden Test schreiben**

Ergänze in `src/lib/schedule-generator.test.ts`:

```typescript
describe('generateSchedule with doubleRoundRobin', () => {
  it('doubles the number of group-stage games with reversed home/away in the return leg', () => {
    const config: TournamentConfig = {
      ...baseConfig,
      doubleRoundRobin: true,
    }
    const schedule = generateSchedule(config)
    // 4 teams, single leg = 6 games; double leg = 12
    expect(schedule.games).toHaveLength(12)
  })

  it('return-leg games have home/away swapped compared to the first leg', () => {
    const config: TournamentConfig = {
      ...baseConfig,
      doubleRoundRobin: true,
    }
    const schedule = generateSchedule(config)
    const firstLegPairs = new Map(
      schedule.games.filter(g => g.round <= 3).map(g => [
        [g.homeTeamId, g.awayTeamId].sort().join('|'),
        [g.homeTeamId, g.awayTeamId],
      ]),
    )
    const returnLegGames = schedule.games.filter(g => g.round > 3)
    expect(returnLegGames).toHaveLength(6)
    for (const game of returnLegGames) {
      const key = [game.homeTeamId, game.awayTeamId].sort().join('|')
      const [firstHome] = firstLegPairs.get(key)!
      // In the return leg, whoever was away in the first leg is now home.
      expect(game.homeTeamId).not.toBe(firstHome)
    }
  })

  it('assigns continuing round numbers to the return leg (not restarting at 1)', () => {
    const config: TournamentConfig = {
      ...baseConfig,
      doubleRoundRobin: true,
    }
    const schedule = generateSchedule(config)
    const rounds = new Set(schedule.games.map(g => g.round))
    // 4 teams: 3 rounds per leg, 2 legs = rounds 1-6
    expect(rounds).toEqual(new Set([1, 2, 3, 4, 5, 6]))
  })
})
```

Run: `npm test -- --run src/lib/schedule-generator.test.ts`
Expected: alle drei Tests FAIL (aktuell wird `doubleRoundRobin` komplett ignoriert).

- [ ] **Step 2: Implementierung**

In `src/lib/schedule-generator.ts`, die `roundsByGroup`-Konstruktion aus Task 4 erweitern, um bei `config.doubleRoundRobin` eine Rückrunde mit vertauschten Rollen anzuhängen:

Aktuell (nach Task 4):
```typescript
  const groupIds = [...new Set(teams.map(t => t.groupId ?? 'A'))].sort()
  const roundsByGroup = new Map(
    groupIds.map(groupId => [
      groupId,
      generateRoundRobinRounds(teams.filter(t => (t.groupId ?? 'A') === groupId).map(t => t.id)),
    ]),
  )
```

Ändern zu:
```typescript
  const groupIds = [...new Set(teams.map(t => t.groupId ?? 'A'))].sort()
  const roundsByGroup = new Map(
    groupIds.map(groupId => {
      const firstLeg = generateRoundRobinRounds(teams.filter(t => (t.groupId ?? 'A') === groupId).map(t => t.id))
      if (!config.doubleRoundRobin) return [groupId, firstLeg] as const
      const returnLeg = firstLeg.map(round => round.map(([home, away]) => [away, home] as [string, string]))
      return [groupId, [...firstLeg, ...returnLeg]] as const
    }),
  )
```

Keine weitere Änderung an der Batch-/Feld-Zuweisungslogik nötig — sie iteriert bereits generisch über `roundsByGroup`s Rundenanzahl (`maxRoundCount`), unabhängig davon ob diese Runden aus einer oder zwei "Legs" stammen.

- [ ] **Step 3: Test ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/lib/schedule-generator.test.ts`
Expected: alle Tests PASS, inklusive aller vorherigen Tasks.

- [ ] **Step 4: Vollen Testlauf + Build**

Run: `npm test -- --run && npm run build`
Expected: alle grün.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schedule-generator.ts src/lib/schedule-generator.test.ts
git commit -m "feat: support double round-robin (home/away return leg) per group"
```

---

## Task 6: Team-Logo in `TeamNameDisplay` anzeigen

**Files:**
- Modify: `src/components/teams/TeamNameDisplay.tsx`
- Modify: `src/components/teams/TeamNameDisplay.test.tsx`

Kontext: `Team.logoUrl` existiert bereits im Datenmodell und wird bereits in `TeamForm`/`TeamCard` gepflegt bzw. angezeigt (`src/components/teams/TeamCard.tsx:17-19`). In allen Ansichten, die Teamnamen über `TeamNameDisplay` rendern (`GameRow`, `SwissOverviewPage`, `SwissResultsPage`, und die in Task 11 neu entstehende `GroupOverviewPage`), fehlt das Logo bislang komplett — nur der Name/die Abkürzung wird angezeigt. Diese Lücke wird hier geschlossen, damit ein gepflegtes Logo überall automatisch mit auftaucht, wo bisher nur Text stand.

- [ ] **Step 1: Fehlschlagenden Test schreiben**

Lies die aktuelle vollständige `src/components/teams/TeamNameDisplay.test.tsx` (oben bereits zitiert). Ergänze:

```typescript
  it('renders the team logo when logoUrl is set', () => {
    const teamWithLogo: Team = { ...team, logoUrl: 'https://example.com/logo.png' }
    render(<TeamNameDisplay team={teamWithLogo} />)
    const logo = screen.getByRole('img', { name: 'Musterstadt Baskets U11' })
    expect(logo).toHaveAttribute('src', 'https://example.com/logo.png')
  })

  it('renders no image when logoUrl is empty', () => {
    render(<TeamNameDisplay team={team} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
```

Run: `npm test -- --run src/components/teams/TeamNameDisplay.test.tsx`
Expected: der erste neue Test FAILs (kein `<img>` wird gerendert), der zweite PASSt bereits (kein Logo im aktuellen Code, aber auch keins erwartet — dient als Regressionsschutz gegen ein zu unbedingtes Rendern).

- [ ] **Step 2: Implementierung**

Ersetze den Inhalt von `src/components/teams/TeamNameDisplay.tsx`:

```tsx
import type { Team } from '@/types'
import { cn, getTeamAbbreviation } from '@/lib/utils'

interface TeamNameDisplayProps {
  team: Team
  className?: string
}

export function TeamNameDisplay({ team, className }: TeamNameDisplayProps) {
  return (
    <span title={team.name} className={cn('inline-flex items-center gap-1.5 min-w-0 font-medium', className)}>
      {team.logoUrl && (
        <img
          src={team.logoUrl}
          alt={team.name}
          className="w-5 h-5 flex-shrink-0 object-contain rounded-full"
        />
      )}
      <span className="truncate min-w-0">
        <span data-team-name="full" className="hidden md:inline">{team.name}</span>
        <span data-team-name="abbreviation" className="md:hidden">{getTeamAbbreviation(team)}</span>
      </span>
    </span>
  )
}
```

WICHTIG: der äußere `<span>` war zuvor `block truncate` — das musste zu `inline-flex items-center gap-1.5` geändert werden, damit Logo und Name nebeneinander statt übereinander erscheinen; das `truncate`-Verhalten wandert auf den inneren Text-`<span>`, damit ein langer Name weiterhin nicht das Layout sprengt, während das Logo selbst nie schrumpft (`flex-shrink-0`).

- [ ] **Step 3: Test ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/components/teams/TeamNameDisplay.test.tsx`
Expected: alle Tests PASS, inklusive der bereits bestehenden drei Tests (Name/Abkürzung/title-Attribut — das `title`-Attribut sitzt weiterhin auf demselben äußersten `<span>`, daher bleibt `closest('[title]')` in Test 3 unverändert gültig).

- [ ] **Step 4: Alle Verwendungsstellen visuell/funktional prüfen**

Run: `npm test -- --run` (voller Lauf — `GameRow.test.tsx`, `SwissOverviewPage.test.tsx`, `SwissResultsPage.test.tsx` könnten Snapshot- oder Struktur-Annahmen über die exakte DOM-Verschachtelung von `TeamNameDisplay` haben).
Expected: alle PASS. Falls ein Test explizit auf `block truncate`-Klassen des äußeren `<span>` prüft (unwahrscheinlich, aber möglich), diesen an die neue Klasse `inline-flex items-center gap-1.5` anpassen — das ist eine korrekte Anpassung an die neue, gewünschte Darstellung, kein Zurücknehmen.

- [ ] **Step 5: Vollen Testlauf + Build**

Run: `npm test -- --run && npm run build`
Expected: alle grün.

- [ ] **Step 6: Manuell im Browser verifizieren**

`npm run dev`, Playwright MCP: ein Team mit gültiger `logoUrl` anlegen (z. B. über `TeamForm` eine öffentlich erreichbare Bild-URL eintragen), Zeitplan generieren, zur Zeitplan-Seite navigieren — bestätigen, dass das Logo klein neben dem Teamnamen in der `GameRow` erscheint. Bei Swiss-Modus zusätzlich `/swiss-overview` und `/swiss-results` prüfen. Ein Team OHNE Logo prüfen — bestätigen, dass dort weiterhin nur der Name ohne leeren Bildplatz erscheint (kein kaputtes Bild-Icon).

- [ ] **Step 7: Commit**

```bash
git add src/components/teams/TeamNameDisplay.tsx src/components/teams/TeamNameDisplay.test.tsx
git commit -m "feat: show team logo next to the name in TeamNameDisplay"
```

---

## Task 7: `computeGroupStandings` (Gruppentabelle mit direktem Vergleich)

**Files:**
- Create: `src/lib/group-standings.ts`
- Create: `src/lib/group-standings.test.ts`

- [ ] **Step 1: Fehlschlagenden Test schreiben**

Erstelle `src/lib/group-standings.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeGroupStandings } from './group-standings'
import type { Game, Team } from '@/types'

const makeTeam = (id: string, name: string, groupId = 'A'): Team => ({
  id, name, logoUrl: '', color: '#000', contact: '', players: [], groupId,
})

const makeGame = (overrides: Partial<Game>): Game => ({
  id: 'g', homeTeamId: null, awayTeamId: null, stage: 'group', field: 1,
  scheduledStart: '09:00', scheduledEnd: '09:30', round: 1, gameNumber: 1,
  periodScores: [], groupId: 'A',
  ...overrides,
})

describe('computeGroupStandings', () => {
  it('computes points from wins/draws/losses (2/1/0 scoring)', () => {
    const teams = [makeTeam('t1', 'Team 1'), makeTeam('t2', 'Team 2')]
    const games = [
      makeGame({ homeTeamId: 't1', awayTeamId: 't2', periodScores: [{ period: 1, homeScore: 20, awayScore: 15 }] }),
    ]
    const standings = computeGroupStandings(teams, games, 'A')
    expect(standings.find(s => s.teamId === 't1')!.points).toBe(2)
    expect(standings.find(s => s.teamId === 't2')!.points).toBe(0)
  })

  it('only includes games from the specified group', () => {
    const teams = [
      makeTeam('t1', 'Team 1', 'A'), makeTeam('t2', 'Team 2', 'A'),
      makeTeam('t3', 'Team 3', 'B'), makeTeam('t4', 'Team 4', 'B'),
    ]
    const games = [
      makeGame({ groupId: 'A', homeTeamId: 't1', awayTeamId: 't2', periodScores: [{ period: 1, homeScore: 20, awayScore: 15 }] }),
      makeGame({ groupId: 'B', homeTeamId: 't3', awayTeamId: 't4', periodScores: [{ period: 1, homeScore: 30, awayScore: 10 }] }),
    ]
    const standingsA = computeGroupStandings(teams, games, 'A')
    expect(standingsA).toHaveLength(2)
    expect(standingsA.map(s => s.teamId).sort()).toEqual(['t1', 't2'])
  })

  it('sorts by points first', () => {
    const teams = [makeTeam('t1', 'Team 1'), makeTeam('t2', 'Team 2'), makeTeam('t3', 'Team 3')]
    const games = [
      makeGame({ homeTeamId: 't1', awayTeamId: 't2', periodScores: [{ period: 1, homeScore: 20, awayScore: 15 }] }),
      makeGame({ homeTeamId: 't1', awayTeamId: 't3', periodScores: [{ period: 1, homeScore: 20, awayScore: 15 }] }),
      makeGame({ homeTeamId: 't2', awayTeamId: 't3', periodScores: [{ period: 1, homeScore: 20, awayScore: 15 }] }),
    ]
    const standings = computeGroupStandings(teams, games, 'A')
    expect(standings.map(s => s.teamId)).toEqual(['t1', 't2', 't3'])
  })

  it('breaks a points tie using head-to-head result before overall point difference', () => {
    // t1 and t2 tie on points (2 each), but t1 beat t2 head-to-head, while t2 has a much
    // better overall point difference from beating t3 by a wide margin. Head-to-head must win.
    const teams = [makeTeam('t1', 'Team 1'), makeTeam('t2', 'Team 2'), makeTeam('t3', 'Team 3')]
    const games = [
      makeGame({ homeTeamId: 't1', awayTeamId: 't2', periodScores: [{ period: 1, homeScore: 21, awayScore: 20 }] }),
      makeGame({ homeTeamId: 't2', awayTeamId: 't3', periodScores: [{ period: 1, homeScore: 50, awayScore: 10 }] }),
      makeGame({ homeTeamId: 't1', awayTeamId: 't3', periodScores: [{ period: 1, homeScore: 15, awayScore: 25 }] }),
    ]
    const standings = computeGroupStandings(teams, games, 'A')
    // t1: 1 win (vs t2) + 1 loss (vs t3) = 2 pts, diff = (21-20)+(15-25) = -9
    // t2: 1 loss (vs t1) + 1 win (vs t3) = 2 pts, diff = (20-21)+(50-10) = +39
    // Points tie at 2 each; t1 beat t2 head-to-head (21:20), so t1 must rank above t2
    // despite t2's much better overall point difference.
    const t1Index = standings.findIndex(s => s.teamId === 't1')
    const t2Index = standings.findIndex(s => s.teamId === 't2')
    expect(t1Index).toBeLessThan(t2Index)
  })

  it('falls back to overall point difference when head-to-head is also tied (e.g. only one game played so far, or a draw)', () => {
    const teams = [makeTeam('t1', 'Team 1'), makeTeam('t2', 'Team 2'), makeTeam('t3', 'Team 3')]
    const games = [
      // t1 and t2 haven't played each other yet, but both have 2 points from beating t3
      makeGame({ homeTeamId: 't1', awayTeamId: 't3', periodScores: [{ period: 1, homeScore: 30, awayScore: 10 }] }),
      makeGame({ homeTeamId: 't2', awayTeamId: 't3', periodScores: [{ period: 1, homeScore: 20, awayScore: 18 }] }),
    ]
    const standings = computeGroupStandings(teams, games, 'A')
    // t1: diff = +20, t2: diff = +2 -> t1 ranks above t2 via point diff, since no head-to-head exists
    const t1Index = standings.findIndex(s => s.teamId === 't1')
    const t2Index = standings.findIndex(s => s.teamId === 't2')
    expect(t1Index).toBeLessThan(t2Index)
  })

  it('does not count an unplayed game', () => {
    const teams = [makeTeam('t1', 'Team 1'), makeTeam('t2', 'Team 2')]
    const games = [makeGame({ homeTeamId: 't1', awayTeamId: 't2', periodScores: [] })]
    const standings = computeGroupStandings(teams, games, 'A')
    expect(standings.every(s => s.points === 0)).toBe(true)
  })
})
```

Run: `npm test -- --run src/lib/group-standings.test.ts`
Expected: FAIL — Datei existiert noch nicht.

- [ ] **Step 2: Implementierung**

Erstelle `src/lib/group-standings.ts`:

```typescript
import type { Game, Team } from '@/types'
import { computeFinalScore } from './standings'

export interface GroupStanding {
  teamId: string
  points: number
  wins: number
  draws: number
  losses: number
  pointsFor: number
  pointsAgainst: number
  pointsDiff: number
}

function pointsForResult(home: number, away: number): [number, number] {
  if (home > away) return [2, 0]
  if (home < away) return [0, 2]
  return [1, 1]
}

function isScorableGame(game: Game): game is Game & { homeTeamId: string; awayTeamId: string } {
  return !game.cancelledReason && !!game.homeTeamId && !!game.awayTeamId && game.periodScores.length > 0
}

function headToHeadPointsDiff(teamA: string, teamB: string, games: Game[]): number {
  let diff = 0
  for (const game of games) {
    if (!isScorableGame(game)) continue
    const involvesBoth =
      (game.homeTeamId === teamA && game.awayTeamId === teamB) ||
      (game.homeTeamId === teamB && game.awayTeamId === teamA)
    if (!involvesBoth) continue
    const { home, away } = computeFinalScore(game)
    diff += game.homeTeamId === teamA ? home - away : away - home
  }
  return diff
}

export function computeGroupStandings(teams: Team[], games: Game[], groupId: string): GroupStanding[] {
  const groupTeamIds = new Set(teams.filter(t => (t.groupId ?? 'A') === groupId).map(t => t.id))
  const relevantGames = games.filter(g => g.stage === 'group' && (g.groupId ?? 'A') === groupId)

  const standingsByTeamId = new Map<string, GroupStanding>(
    [...groupTeamIds].map(teamId => [teamId, {
      teamId, points: 0, wins: 0, draws: 0, losses: 0,
      pointsFor: 0, pointsAgainst: 0, pointsDiff: 0,
    }]),
  )

  for (const game of relevantGames) {
    if (!isScorableGame(game)) continue
    const { home, away } = computeFinalScore(game)
    const [homePoints, awayPoints] = pointsForResult(home, away)
    const homeStanding = standingsByTeamId.get(game.homeTeamId)
    const awayStanding = standingsByTeamId.get(game.awayTeamId)
    if (homeStanding) {
      homeStanding.points += homePoints
      homeStanding.pointsFor += home
      homeStanding.pointsAgainst += away
      if (homePoints === 2) homeStanding.wins++
      else if (homePoints === 1) homeStanding.draws++
      else homeStanding.losses++
    }
    if (awayStanding) {
      awayStanding.points += awayPoints
      awayStanding.pointsFor += away
      awayStanding.pointsAgainst += home
      if (awayPoints === 2) awayStanding.wins++
      else if (awayPoints === 1) awayStanding.draws++
      else awayStanding.losses++
    }
  }

  for (const standing of standingsByTeamId.values()) {
    standing.pointsDiff = standing.pointsFor - standing.pointsAgainst
  }

  return [...standingsByTeamId.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const h2h = headToHeadPointsDiff(a.teamId, b.teamId, relevantGames)
    if (h2h !== 0) return -h2h
    return b.pointsDiff - a.pointsDiff
  })
}
```

- [ ] **Step 3: Test ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/lib/group-standings.test.ts`
Expected: alle Tests PASS.

- [ ] **Step 4: Vollen Testlauf + Build**

Run: `npm test -- --run && npm run build`
Expected: alle grün.

- [ ] **Step 5: Commit**

```bash
git add src/lib/group-standings.ts src/lib/group-standings.test.ts
git commit -m "feat: add computeGroupStandings with head-to-head tiebreaker before point difference"
```

---

## Task 8: Gruppenanzahl-Vorschlag (Hilfsfunktion)

**Files:**
- Create: `src/lib/group-suggestion.ts`
- Create: `src/lib/group-suggestion.test.ts`

- [ ] **Step 1: Fehlschlagenden Test schreiben**

Erstelle `src/lib/group-suggestion.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { suggestGroupCount } from './group-suggestion'

describe('suggestGroupCount', () => {
  it('suggests 1 group for small team counts (single-leg)', () => {
    expect(suggestGroupCount(6, false)).toBe(1)
  })

  it('suggests 2 groups for 9 teams (single-leg): |9/2 - 3.5| = 1 beats |9/1 - 3.5| = 5.5 and |9/4 - 3.5| = 1.25', () => {
    expect(suggestGroupCount(9, false)).toBe(2)
  })

  it('suggests 4 groups for 16 teams (single-leg): |16/4 - 3.5| = 0.5 is the best fit', () => {
    expect(suggestGroupCount(16, false)).toBe(4)
  })

  it('suggests more/smaller groups when doubleRoundRobin is true', () => {
    // 16 teams, double round robin: target size 2 -> 8 groups of 2 fits exactly
    expect(suggestGroupCount(16, true)).toBe(8)
  })

  it('prefers the smaller group count on a tie', () => {
    // 8 teams, single-leg: |8/1-3.5|=4.5, |8/2-3.5|=0.5, |8/4-3.5|=1.5 -> 2 groups wins outright, no tie here.
    // Use a case with an actual tie: 7 teams -> |7/1-3.5|=2.5, |7/2-3.5|=0, |7/4-3.5|=1.75 -> 2 groups wins outright too.
    // A genuine tie: teamCount=5 -> |5/1-3.5|=2.5, |5/2-3.5|=1, |5/4-3.5|=2 -> 2 groups wins outright.
    // Construct a deliberate tie by comparing candidates 1 and 2 at teamCount=7 is not a tie either;
    // instead assert the documented tie-break directly via the boundary case teamCount=1 (only 1 candidate valid).
    expect(suggestGroupCount(1, false)).toBe(1)
  })
})
```

HINWEIS für den Implementierer: das letzte Testfall-Kommentar im obigen Code ist bewusst als Denkprozess dokumentiert, um zu zeigen, dass ein echter exakter Gleichstand zwischen zwei Kandidaten bei den gewählten Zielwerten (3.5 bzw. 2) mit den Kandidaten `[1, 2, 4, 8, 16]` in der Praxis selten exakt auftritt — prüfe beim Implementieren rechnerisch, ob es eine `teamCount`-Zahl gibt, die einen ECHTEN exakten Gleichstand zwischen zwei benachbarten Kandidaten erzeugt (z. B. `teamCount = 3` bei `zielgröße=3.5`: `|3/1-3.5|=0.5`, `|3/2-3.5|=2`, `|3/4-3.5|=2.75` — kein Gleichstand). Falls du eine passende Zahl findest, ersetze den letzten Testfall durch einen echten Gleichstand-Test mit der exakten erwarteten kleineren Gruppenanzahl; falls nicht, ist der oben stehende Grenzfall-Test (`teamCount=1`) als einfacher Ersatztest ausreichend — dokumentiere kurz, welchen Weg du gewählt hast.

Run: `npm test -- --run src/lib/group-suggestion.test.ts`
Expected: FAIL — Datei existiert noch nicht.

- [ ] **Step 2: Implementierung**

Erstelle `src/lib/group-suggestion.ts`:

```typescript
const GROUP_COUNT_CANDIDATES = [1, 2, 4, 8, 16]

export function suggestGroupCount(teamCount: number, doubleRoundRobin: boolean): number {
  const targetSize = doubleRoundRobin ? 2 : 3.5
  const validCandidates = GROUP_COUNT_CANDIDATES.filter(c => c <= teamCount)
  if (validCandidates.length === 0) return 1

  let best = validCandidates[0]
  let bestDistance = Math.abs(teamCount / best - targetSize)
  for (const candidate of validCandidates.slice(1)) {
    const distance = Math.abs(teamCount / candidate - targetSize)
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }
  return best
}
```

- [ ] **Step 3: Test ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/lib/group-suggestion.test.ts`
Expected: alle Tests PASS. Falls beim rechnerischen Nachprüfen (Step 1's Hinweis) ein echter Gleichstand-Fall gefunden und der Test entsprechend angepasst wurde, sicherstellen dass die Implementierung `best`/`bestDistance` bei GLEICHER Distanz NICHT überschreibt (der `<`-Vergleich, nicht `<=`, in der Implementierung oben sorgt bereits dafür, dass der ERSTE — also kleinere — Kandidat bei einem Gleichstand gewinnt, da `validCandidates` aufsteigend sortiert ist).

- [ ] **Step 4: Vollen Testlauf + Build**

Run: `npm test -- --run && npm run build`
Expected: alle grün.

- [ ] **Step 5: Commit**

```bash
git add src/lib/group-suggestion.ts src/lib/group-suggestion.test.ts
git commit -m "feat: add suggestGroupCount helper for the group-count recommendation"
```

---

## Task 9: Store-Actions (setGroupCount, setDoubleRoundRobin, setTeamGroup)

**Files:**
- Modify: `src/store/tournament-store.ts`
- Modify: `src/store/tournament-store.test.ts`

- [ ] **Step 1: Fehlschlagenden Test schreiben**

Lies `src/store/tournament-store.test.ts` vollständig, um das etablierte Testmuster zu übernehmen. Ergänze:

```typescript
describe('multi-group configuration', () => {
  it('setGroupCount updates tournament.groupCount', () => {
    useTournamentStore.getState().setGroupCount(3)
    expect(useTournamentStore.getState().tournament.groupCount).toBe(3)
  })

  it('setDoubleRoundRobin updates tournament.doubleRoundRobin', () => {
    useTournamentStore.getState().setDoubleRoundRobin(true)
    expect(useTournamentStore.getState().tournament.doubleRoundRobin).toBe(true)
  })

  it('setTeamGroup updates a specific team\'s groupId', () => {
    const { addTeam } = useTournamentStore.getState()
    addTeam({ name: 'Team A', logoUrl: '', color: '#000', contact: '' })
    const teamId = useTournamentStore.getState().tournament.teams[0].id
    useTournamentStore.getState().setTeamGroup(teamId, 'B')
    expect(useTournamentStore.getState().tournament.teams[0].groupId).toBe('B')
  })
})
```

Run: `npm test -- --run src/store/tournament-store.test.ts`
Expected: FAIL — `setGroupCount`/`setDoubleRoundRobin`/`setTeamGroup` existieren noch nicht.

- [ ] **Step 2: Implementierung**

In `src/store/tournament-store.ts`:

Interface `TournamentStore` (aktuell Zeilen 54-82), im `// Tournament actions`-Abschnitt, nach `setFinalsBracketSize` ergänzen:
```typescript
  setGroupCount: (count: number) => void
  setDoubleRoundRobin: (enabled: boolean) => void
```

Im `// Team actions`-Abschnitt, nach `updateTeam` ergänzen:
```typescript
  setTeamGroup: (id: string, groupId: string) => void
```

In der Store-Implementierung, nach `setFinalsBracketSize` (aktuell Zeilen 185-188):
```typescript
  setGroupCount: (count) => {
    set(s => ({ tournament: { ...s.tournament, groupCount: count } }))
    saveTournament(get().tournament)
  },

  setDoubleRoundRobin: (enabled) => {
    set(s => ({ tournament: { ...s.tournament, doubleRoundRobin: enabled } }))
    saveTournament(get().tournament)
  },
```

Nach `updateTeam` (aktuell Zeilen 228-236):
```typescript
  setTeamGroup: (id, groupId) => {
    set(s => ({
      tournament: {
        ...s.tournament,
        teams: s.tournament.teams.map(t => t.id === id ? { ...t, groupId } : t),
      },
    }))
    saveTournament(get().tournament)
  },
```

Lies die tatsächliche aktuelle Datei vor dem Editieren, um die exakte Einfügeposition zu bestätigen (Zeilennummern können sich seit der letzten Lesung geringfügig verschoben haben, insbesondere durch bereits erfolgte Tasks in diesem Plan, die diese Datei nicht direkt ändern, aber durch parallele Entwicklung verschoben sein könnten).

- [ ] **Step 3: Test ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/store/tournament-store.test.ts`
Expected: alle Tests PASS.

- [ ] **Step 4: Vollen Testlauf + Build**

Run: `npm test -- --run && npm run build`
Expected: alle grün.

- [ ] **Step 5: Commit**

```bash
git add src/store/tournament-store.ts src/store/tournament-store.test.ts
git commit -m "feat: add store actions for group count, double round-robin, and team-group assignment"
```

---

## Task 10: Modus-Label umbenennen + "Gruppen"-Konfigurationsabschnitt

**Files:**
- Modify: `src/components/config/TournamentForm.tsx`
- Create: `src/components/config/GroupAssignmentForm.tsx`
- Create: `src/components/config/GroupAssignmentForm.test.tsx`
- Modify: `src/pages/ConfigPage.tsx`
- Modify: `src/pages/ConfigPage.test.tsx`

- [ ] **Step 1: Modus-Label umbenennen**

In `src/components/config/TournamentForm.tsx`, Zeile mit `<SelectItem value="round-robin+finals">Jeder gegen Jeden + Finale</SelectItem>` (aktuell Zeile 35) ändern zu:
```tsx
            <SelectItem value="round-robin+finals">Gruppenphase + Endrunde</SelectItem>
```

Falls ein bestehender Test (`TournamentForm.test.tsx`, falls vorhanden — prüfen via `find src/components/config -name "TournamentForm.test.tsx"`) auf den alten Text "Jeder gegen Jeden + Finale" prüft, diesen anpassen. Falls e2e-Tests (`grep -rln "Jeder gegen Jeden + Finale" e2e/`) diesen Text nutzen, ebenfalls anpassen.

Run: `npm test -- --run && npm run test:e2e`
Expected: alle grün nach eventuellen Anpassungen.

Commit:
```bash
git add src/components/config/TournamentForm.tsx
git commit -m "feat: rename round-robin+finals mode label to \"Gruppenphase + Endrunde\""
```

- [ ] **Step 2: Fehlschlagenden Test für `GroupAssignmentForm` schreiben**

Erstelle `src/components/config/GroupAssignmentForm.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useTournamentStore } from '@/store/tournament-store'
import { clearAll } from '@/lib/storage'
import GroupAssignmentForm from './GroupAssignmentForm'

beforeEach(() => {
  clearAll()
  useTournamentStore.setState({
    tournament: {
      id: 't1', name: 'Test', mode: 'round-robin+finals', fields: 2,
      gameSettings: {
        periodsCount: 4, periodDurationMin: 5, breakBetweenPeriodsMin: 1,
        halfTimeBreakMin: 5, bufferBetweenGamesMin: 5, breakBetweenRoundsMin: 15,
        awardCeremonyMin: 15,
      },
      venue: {
        name: 'Halle', availabilityWindows: [{ start: '09:00', end: '20:00' }],
        blackoutPeriods: [], setupBufferMin: 30, teardownBufferMin: 30,
      },
      teams: [],
    },
    schedule: null,
  })
})

describe('GroupAssignmentForm', () => {
  it('shows the group-count suggestion based on team count', () => {
    const { addTeam } = useTournamentStore.getState()
    for (let i = 1; i <= 9; i++) {
      addTeam({ name: `Team ${i}`, logoUrl: '', color: '#000', contact: '' })
    }
    render(<GroupAssignmentForm />)
    expect(screen.getByText(/Vorschlag: 2 Gruppen/)).toBeInTheDocument()
  })

  it('updates groupCount when the input changes', () => {
    const { addTeam } = useTournamentStore.getState()
    addTeam({ name: 'Team 1', logoUrl: '', color: '#000', contact: '' })
    render(<GroupAssignmentForm />)
    fireEvent.change(screen.getByLabelText('Anzahl Gruppen'), { target: { value: '3' } })
    expect(useTournamentStore.getState().tournament.groupCount).toBe(3)
  })

  it('toggles doubleRoundRobin via the checkbox', () => {
    render(<GroupAssignmentForm />)
    fireEvent.click(screen.getByLabelText('Mit Rückspiel (Hin- und Rückrunde)'))
    expect(useTournamentStore.getState().tournament.doubleRoundRobin).toBe(true)
  })

  it('renders a group dropdown per team and updates the team\'s groupId on change', () => {
    const { addTeam } = useTournamentStore.getState()
    addTeam({ name: 'Team Alpha', logoUrl: '', color: '#000', contact: '' })
    useTournamentStore.getState().setGroupCount(2)
    render(<GroupAssignmentForm />)
    const dropdown = screen.getByLabelText('Gruppe für Team Alpha')
    fireEvent.change(dropdown, { target: { value: 'B' } })
    expect(useTournamentStore.getState().tournament.teams[0].groupId).toBe('B')
  })
})
```

Run: `npm test -- --run src/components/config/GroupAssignmentForm.test.tsx`
Expected: FAIL — Komponente existiert noch nicht.

- [ ] **Step 3: `GroupAssignmentForm` implementieren**

Erstelle `src/components/config/GroupAssignmentForm.tsx`:

```tsx
import { useTournamentStore } from '@/store/tournament-store'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { suggestGroupCount } from '@/lib/group-suggestion'
import { TeamNameDisplay } from '@/components/teams/TeamNameDisplay'

export default function GroupAssignmentForm({ disabled = false }: { disabled?: boolean }) {
  const { tournament, setGroupCount, setDoubleRoundRobin, setTeamGroup } = useTournamentStore()
  const doubleRoundRobin = tournament.doubleRoundRobin ?? false
  const suggestedGroupCount = suggestGroupCount(tournament.teams.length || 1, doubleRoundRobin)
  const groupCount = tournament.groupCount ?? suggestedGroupCount
  const groupLetters = Array.from({ length: groupCount }, (_, i) => String.fromCharCode(65 + i))

  return (
    <div className="space-y-4 max-w-md">
      <div className="space-y-1">
        <Label htmlFor="group-count">Anzahl Gruppen</Label>
        <Input
          id="group-count"
          type="number"
          min={1}
          value={groupCount}
          onChange={e => setGroupCount(Number(e.target.value))}
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">
          Vorschlag: {suggestedGroupCount} Gruppen (ca. {Math.round(tournament.teams.length / suggestedGroupCount)} Teams je Gruppe) — bei Bedarf anpassbar.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <input
          id="double-round-robin"
          type="checkbox"
          checked={doubleRoundRobin}
          onChange={e => setDoubleRoundRobin(e.target.checked)}
          disabled={disabled}
        />
        <Label htmlFor="double-round-robin">Mit Rückspiel (Hin- und Rückrunde)</Label>
      </div>
      <div className="space-y-2">
        {tournament.teams.map(team => (
          <div key={team.id} className="flex items-center justify-between gap-3">
            <TeamNameDisplay team={team} className="text-sm" />
            <select
              aria-label={`Gruppe für ${team.name}`}
              className="border border-border rounded-sm px-2 py-1 text-sm"
              value={team.groupId ?? 'A'}
              onChange={e => setTeamGroup(team.id, e.target.value)}
              disabled={disabled}
            >
              {groupLetters.map(letter => (
                <option key={letter} value={letter}>Gruppe {letter}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/components/config/GroupAssignmentForm.test.tsx`
Expected: alle Tests PASS.

- [ ] **Step 5: In `ConfigPage.tsx` einbinden**

Lies die aktuelle vollständige `src/pages/ConfigPage.tsx` (bereits im Kontext dieses Plans zitiert). Ergänze einen neuen Abschnitt "Gruppen", der NUR bei `tournament.mode === 'round-robin+finals'` sichtbar ist, direkt nach dem "Allgemein"-Abschnitt (vor "Spieleinstellungen") — nutzt denselben `LockedSectionGate`-Sperr-Mechanismus wie die anderen Abschnitte, gekoppelt an den bestehenden `tournamentUnlocked`-State (da eine Gruppenänderung denselben Turnierverlauf-Einfluss hat wie Modus/Rundenzahl-Änderungen):

```tsx
import GroupAssignmentForm from '@/components/config/GroupAssignmentForm'
```

```tsx
      {tournament.mode === 'round-robin+finals' && (
        <section className="space-y-4">
          <h2 className="text-lg text-brand-primary-light">Gruppen</h2>
          <LockedSectionGate locked={locked} unlocked={tournamentUnlocked} onUnlock={() => setConfirmTarget('tournament')}>
            {(disabled) => <GroupAssignmentForm disabled={disabled} />}
          </LockedSectionGate>
        </section>
      )}
```

Platziere diesen Block direkt nach dem bestehenden "Allgemein"-`<section>` (aktuell Zeilen 62-67), vor dem "Spieleinstellungen"-`<section>`.

- [ ] **Step 6: `ConfigPage.test.tsx` um einen Test ergänzen**

Lies die aktuelle vollständige `src/pages/ConfigPage.test.tsx`, um deren `render`/Store-Setup-Konvention (`renderConfigPage()`-Helper, siehe früherer Task in der Projekthistorie) zu übernehmen. Ergänze:

```tsx
  it('shows the group assignment section only in round-robin+finals mode', () => {
    useTournamentStore.getState().setMode('round-robin')
    const { unmount } = renderConfigPage()
    expect(screen.queryByText('Gruppen')).not.toBeInTheDocument()
    unmount()

    useTournamentStore.getState().setMode('round-robin+finals')
    renderConfigPage()
    expect(screen.getByText('Gruppen')).toBeInTheDocument()
  })
```

Run: `npm test -- --run src/pages/ConfigPage.test.tsx`
Expected: PASS (falls der Test vor der Implementierung aus Step 5 geschrieben wird, zunächst FAIL für den zweiten Teil — Reihenfolge in diesem Schritt ist nachgelagert zu Step 5, daher sollte er direkt PASS zeigen; falls stattdessen zuerst geschrieben, TDD-Reihenfolge entsprechend beachten).

- [ ] **Step 7: Vollen Testlauf + Build + E2E**

Run: `npm test -- --run && npm run build && npm run test:e2e`
Expected: alle grün.

- [ ] **Step 8: Manuell im Browser verifizieren**

`npm run dev`, Playwright MCP: 9 Teams anlegen, Modus auf "Gruppenphase + Endrunde" stellen — bestätigen, dass der neue "Gruppen"-Abschnitt erscheint mit Vorschlag "2 Gruppen", jedes Team hat ein Dropdown, Rückspiel-Checkbox vorhanden. Gruppenanzahl auf 3 ändern, ein Team einer anderen Gruppe zuweisen, bestätigen dass die Änderung übernommen wird.

- [ ] **Step 9: Commit**

```bash
git add src/components/config/GroupAssignmentForm.tsx src/components/config/GroupAssignmentForm.test.tsx src/pages/ConfigPage.tsx src/pages/ConfigPage.test.tsx
git commit -m "feat: add group-count and team-group-assignment UI to the configuration page"
```

---

## Task 11: `GroupOverviewPage` (Gruppentabellen-Ansicht)

**Files:**
- Create: `src/pages/GroupOverviewPage.tsx`
- Create: `src/pages/GroupOverviewPage.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/components/layout/AppShell.test.tsx`

- [ ] **Step 1: Fehlschlagenden Test schreiben**

Erstelle `src/pages/GroupOverviewPage.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { useTournamentStore } from '@/store/tournament-store'
import { clearAll } from '@/lib/storage'
import GroupOverviewPage from './GroupOverviewPage'

function setupMultiGroupTournament() {
  const store = useTournamentStore.getState()
  store.setMode('round-robin+finals')
  store.setFinalsBracketSize(4)
  store.setGroupCount(2)
  for (let i = 1; i <= 8; i++) {
    store.addTeam({ name: `Team ${i}`, logoUrl: '', color: '#000', contact: '' })
  }
  const teams = useTournamentStore.getState().tournament.teams
  teams.slice(0, 4).forEach(t => store.setTeamGroup(t.id, 'A'))
  teams.slice(4).forEach(t => store.setTeamGroup(t.id, 'B'))
  store.generateAndSaveSchedule()
}

beforeEach(() => {
  clearAll()
  useTournamentStore.setState({
    tournament: {
      id: 't1', name: 'Test', mode: 'round-robin', fields: 4,
      gameSettings: {
        periodsCount: 4, periodDurationMin: 5, breakBetweenPeriodsMin: 1,
        halfTimeBreakMin: 5, bufferBetweenGamesMin: 5, breakBetweenRoundsMin: 15,
        awardCeremonyMin: 15,
      },
      venue: {
        name: 'Halle', availabilityWindows: [{ start: '09:00', end: '20:00' }],
        blackoutPeriods: [], setupBufferMin: 30, teardownBufferMin: 30,
      },
      teams: [],
    },
    schedule: null,
  })
})

describe('GroupOverviewPage', () => {
  it('shows a message when no schedule exists yet', () => {
    render(<GroupOverviewPage />)
    expect(screen.getByText(/bitte zuerst einen zeitplan generieren/i)).toBeInTheDocument()
  })

  it('renders one table per group with a heading', () => {
    setupMultiGroupTournament()
    render(<GroupOverviewPage />)
    expect(screen.getByRole('heading', { name: 'Gruppe A' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Gruppe B' })).toBeInTheDocument()
    expect(screen.getAllByRole('table')).toHaveLength(2)
  })

  it('only lists a group\'s own teams in its table', () => {
    setupMultiGroupTournament()
    render(<GroupOverviewPage />)
    const tables = screen.getAllByRole('table')
    for (const table of tables) {
      const rows = within(table).getAllByRole('row')
      // header row + 4 team rows
      expect(rows).toHaveLength(5)
    }
  })

  it('updates points after a group-stage result is submitted', () => {
    setupMultiGroupTournament()
    const { schedule, submitGameResult, tournament } = useTournamentStore.getState()
    const game = schedule!.games.find(g => g.stage === 'group' && g.groupId === 'A')!
    submitGameResult(game.id, [{ period: 1, homeScore: 20, awayScore: 10 }])
    const winner = tournament.teams.find(t => t.id === game.homeTeamId)!

    render(<GroupOverviewPage />)
    const groupATable = screen.getByRole('heading', { name: 'Gruppe A' }).closest('div')!
    expect(within(groupATable).getByText(winner.name)).toBeInTheDocument()
  })
})
```

Run: `npm test -- --run src/pages/GroupOverviewPage.test.tsx`
Expected: FAIL — Seite existiert noch nicht.

- [ ] **Step 2: Implementierung**

Erstelle `src/pages/GroupOverviewPage.tsx`:

```tsx
import { useTournamentStore } from '@/store/tournament-store'
import { computeGroupStandings } from '@/lib/group-standings'
import { Alert, AlertDescription } from '@/components/ui/alert'
import GameRow from '@/components/schedule/GameRow'
import { TeamNameDisplay } from '@/components/teams/TeamNameDisplay'

export default function GroupOverviewPage() {
  const { tournament, schedule } = useTournamentStore()

  if (!schedule) {
    return (
      <Alert>
        <AlertDescription>Bitte zuerst einen Zeitplan generieren (Seite „Konfiguration“).</AlertDescription>
      </Alert>
    )
  }

  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))
  const groupIds = [...new Set(tournament.teams.map(t => t.groupId ?? 'A'))].sort()
  const rounds = [...new Set(schedule.games.filter(g => g.stage === 'group').map(g => g.round))].sort((a, b) => a - b)

  return (
    <div className="space-y-8">
      {groupIds.map(groupId => {
        const standings = computeGroupStandings(tournament.teams, schedule.games, groupId)
        return (
          <div key={groupId}>
            <h2 className="font-display text-lg uppercase mb-2">Gruppe {groupId}</h2>
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-sm text-muted-foreground border-b border-border">
                  <th className="py-1 pr-2">#</th>
                  <th className="py-1 pr-2">Team</th>
                  <th className="py-1 pr-2">Pkt</th>
                  <th className="py-1 pr-2">Diff</th>
                  <th className="py-1 pr-2">S-U-N</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => (
                  <tr key={s.teamId} className="border-b border-border last:border-0">
                    <td className="py-1 pr-2">{i + 1}</td>
                    <td className="py-1 pr-2 font-medium">
                      {teamMap.get(s.teamId) && <TeamNameDisplay team={teamMap.get(s.teamId)!} />}
                    </td>
                    <td className="py-1 pr-2">{s.points}</td>
                    <td className="py-1 pr-2">{s.pointsDiff > 0 ? '+' : ''}{s.pointsDiff}</td>
                    <td className="py-1 pr-2">{s.wins}-{s.draws}-{s.losses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}

      <div>
        <h2 className="font-display text-lg uppercase mb-2">Zeitplan</h2>
        {rounds.map(round => (
          <div key={round} className="mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground mb-1">Runde {round}</h3>
            <div className="border border-border rounded-md p-4 bg-card">
              {schedule.games
                .filter(g => g.stage === 'group' && g.round === round && g.field > 0)
                .map(game => <GameRow key={game.id} game={game} showResult />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

HINWEIS: bewusst KEINE S-U-N-Spalten-Entfernung/Erklärungstext wie bei der Swiss-Übersicht — hier ist die Sortierung (Punkte → direkter Vergleich → Diff) einfacher und die S-U-N-Spalte widerspricht sich nicht mit der Punktezahl (kein Freilos-/Walkover-Sonderfall in dieser einfacheren Tabellenform, da Gruppenphase-Spiele immer real gespielt werden). Falls ein späterer Review zeigt, dass auch hier Verwirrung entsteht, kann das analog zur Swiss-Lösung nachgezogen werden — für dieses Design bewusst einfach gehalten (YAGNI).

- [ ] **Step 3: Test ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/pages/GroupOverviewPage.test.tsx`
Expected: alle Tests PASS.

- [ ] **Step 4: Route + Navigation verdrahten**

In `src/App.tsx`, Import ergänzen:
```tsx
import GroupOverviewPage from '@/pages/GroupOverviewPage'
```
Neue Route ergänzen (nach der `swiss-overview`-Route):
```tsx
          <Route path="group-overview" element={<GroupOverviewPage />} />
```

In `src/components/layout/AppShell.tsx`, die `navItems`-Konstruktion (aktuell Zeilen 10-21) erweitern. Aktuell:
```tsx
  const navItems = [
    { to: '/teams', label: 'Teams', gated: false },
    { to: '/config', label: 'Konfiguration', gated: false },
    ...(isSwiss
      ? [
          { to: '/swiss-results', label: 'Ergebnisse erfassen', gated: true },
          { to: '/swiss-overview', label: 'Turnierübersicht', gated: true },
        ]
      : [{ to: '/schedule', label: 'Zeitplan', gated: true }]),
    { to: '/export', label: 'Export', gated: false },
    { to: '/anleitung', label: 'Anleitung', gated: false },
  ]
```
Ändern zu:
```tsx
  const hasMultipleGroups = (tournament.groupCount ?? 1) > 1
  const navItems = [
    { to: '/teams', label: 'Teams', gated: false },
    { to: '/config', label: 'Konfiguration', gated: false },
    ...(isSwiss
      ? [
          { to: '/swiss-results', label: 'Ergebnisse erfassen', gated: true },
          { to: '/swiss-overview', label: 'Turnierübersicht', gated: true },
        ]
      : hasMultipleGroups
      ? [
          { to: '/schedule', label: 'Zeitplan', gated: true },
          { to: '/group-overview', label: 'Gruppentabellen', gated: true },
        ]
      : [{ to: '/schedule', label: 'Zeitplan', gated: true }]),
    { to: '/export', label: 'Export', gated: false },
    { to: '/anleitung', label: 'Anleitung', gated: false },
  ]
```

Begründung: der neue Navigationspunkt "Gruppentabellen" erscheint nur, wenn tatsächlich mehr als eine Gruppe konfiguriert ist — bei `groupCount` 1 (oder `mode: 'round-robin'`, das `groupCount` nie setzt) bleibt die Navigation unverändert, da eine einzelne Gruppe keine zusätzliche Tabellen-Seite braucht (der bestehende `ScheduleView`/`SchedulePage` reicht dafür weiterhin aus — YAGNI, keine Tabellen-Seite für den 1-Gruppen-Fall in diesem Design, das wäre eine spätere, optionale Erweiterung).

- [ ] **Step 5: `AppShell.test.tsx` um einen Test ergänzen**

Lies die aktuelle vollständige `src/components/layout/AppShell.test.tsx`, um deren Test-Konventionen zu übernehmen. Ergänze:

```tsx
  it('shows the "Gruppentabellen" nav link only when multiple groups are configured', () => {
    useTournamentStore.getState().setMode('round-robin+finals')
    useTournamentStore.getState().setGroupCount(1)
    const { unmount } = renderAppShell()
    expect(screen.queryByText('Gruppentabellen')).not.toBeInTheDocument()
    unmount()

    useTournamentStore.getState().setGroupCount(2)
    renderAppShell()
    expect(screen.getByText('Gruppentabellen')).toBeInTheDocument()
  })
```

Passe `renderAppShell()` an die tatsächlich in der Datei bereits vorhandene Render-Hilfsfunktion an (Name könnte abweichen — lies die Datei zuerst).

Run: `npm test -- --run src/components/layout/AppShell.test.tsx`
Expected: PASS (Implementierung aus Step 4 ist bereits erfolgt).

- [ ] **Step 6: Vollen Testlauf + Build + E2E**

Run: `npm test -- --run && npm run build && npm run test:e2e`
Expected: alle grün.

- [ ] **Step 7: Manuell im Browser verifizieren**

`npm run dev`, Playwright MCP: das in Task 10 Step 8 angelegte 9-Teams-Turnier mit 3 Gruppen weiterverwenden (oder neu aufbauen), Zeitplan generieren, zur neuen "Gruppentabellen"-Seite navigieren — bestätigen, dass 3 separate Tabellen erscheinen, je nur mit den Teams der jeweiligen Gruppe. Ein Ergebnis eintragen (über die normale Zeitplan-Seite, Uhrzeit-Feld — Hinweis: für Round-Robin-Modi gibt es aktuell kein eigenes Ergebniserfassungs-UI wie bei Swiss; falls das Eintragen eines Ergebnisses über die UI in diesem Modus nicht möglich ist, das Ergebnis direkt über die Store-Konsole (`useTournamentStore.getState().submitGameResult(...)`) simulieren, zur Seite zurückkehren und bestätigen, dass sich die Tabelle aktualisiert hat — dieser UI-Lücke (keine Ergebniserfassung für Round-Robin) ist ein bekannter, VORBESTEHENDER Zustand außerhalb des Umfangs dieses Plans, nicht neu einzuführen oder zu beheben).

- [ ] **Step 8: Commit**

```bash
git add src/pages/GroupOverviewPage.tsx src/pages/GroupOverviewPage.test.tsx src/App.tsx src/components/layout/AppShell.tsx src/components/layout/AppShell.test.tsx
git commit -m "feat: add group standings overview page with navigation link"
```

---

## Task 12: Abschlussregression

**Files:** keine Änderungen, nur Verifikation

- [ ] **Step 1**: `npm test -- --run` — alle Tests PASS, Gesamtzahl notieren.
- [ ] **Step 2**: `npm run test:e2e && npm run test:e2e` (zweimal, Flakiness-Check) — alle PASS in beiden Läufen.
- [ ] **Step 3**: `npm run build` — erfolgreich, keine TypeScript-Fehler.
- [ ] **Step 4**: Manueller Gesamtdurchlauf im Browser (Playwright MCP):
  1. "Jeder gegen Jeden", 8 Teams, 3 Felder — bestätigen, dass der ursprüngliche Feldverteilungs-Bug behoben ist (alle Felder von Anfang an genutzt).
  2. "Gruppenphase + Endrunde", 9 Teams — Gruppenvorschlag (2 Gruppen) erscheint, Gruppen manuell anpassen (3 Gruppen), Rückspiel-Option aktivieren, Zeitplan generieren — bestätigen, dass die Spiele beider/aller Gruppen parallel über die Felder verteilt sind (nicht Gruppe A komplett vor Gruppe B).
  3. Zur "Gruppentabellen"-Seite navigieren, bestätigen dass alle Gruppen korrekt mit eigener Tabelle erscheinen.
  4. "Jeder gegen Jeden + Finale" mit `groupCount: 1` (Standard) — bestätigen, dass sich am bisherigen Verhalten (Halbfinale/Finale aus einer Gruppe) NICHTS geändert hat, keine "Gruppentabellen"-Navigation erscheint.
- [ ] **Step 5**: Kein Commit nötig (reine Verifikation). Bei gefundenen Bugs: neuen Task mit Fix + Test ergänzen, einzeln committen.
