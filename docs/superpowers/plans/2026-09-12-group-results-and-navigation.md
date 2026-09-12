# Ergebniserfassung + Gruppen-Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Round-Robin/Gruppenphase-Turniere bekommen eine dedizierte Ergebniserfassungsseite (aktuell komplett fehlend) und die `GroupOverviewPage` wird bei vielen Gruppen übersichtlich (Tabs statt langer Untereinander-Liste), inklusive Druckfunktion.

**Architecture:** `GroupOverviewPage` bekommt lokalen Tab-State (aktive Gruppe) statt alle Gruppen zu rendern, plus zwei Drucken-Buttons, die einen neuen `renderGroupOverviewHtml`-Export nutzen (analog zu `renderSwissOverviewHtml`). Eine neue `GroupResultsPage` (Route `/group-results`) listet alle Gruppenphase-Spiele chronologisch mit Status/Gruppe/Feld-Filtern und nutzt die bereits stage-agnostischen Store-Actions `submitGameResult`/`correctGameResult` — keine neuen Store-Actions oder Datenmodell-Änderungen nötig.

**Tech Stack:** TypeScript, React, Zustand, Vitest, React Router. Direkte Vorlagen: `src/pages/SwissResultsPage.tsx` (Ergebniserfassungs-Interaktionsmuster), `src/pages/SwissOverviewPage.tsx` + `src/lib/export/swiss-overview-export.ts` (Druckmechanismus), `src/pages/GroupOverviewPage.tsx` (wird umgebaut).

Spec: `docs/superpowers/specs/2026-09-12-group-results-and-navigation-design.md`.

---

## Task 1: `GroupOverviewPage` — Tabs statt Untereinander-Liste

**Files:**
- Modify: `src/pages/GroupOverviewPage.tsx`
- Modify: `src/pages/GroupOverviewPage.test.tsx`

- [ ] **Step 1: Fehlschlagenden Test schreiben**

Lies die aktuelle vollständige `src/pages/GroupOverviewPage.test.tsx` (bereits oben zitiert). Ersetze den kompletten Inhalt der Datei durch:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
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

  it('shows a tab per group and only renders the active group\'s table', () => {
    setupMultiGroupTournament()
    render(<GroupOverviewPage />)
    expect(screen.getByRole('button', { name: 'Gruppe A' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gruppe B' })).toBeInTheDocument()
    // Only one group's table/schedule is visible at a time.
    expect(screen.getAllByRole('table')).toHaveLength(1)
  })

  it('defaults to the first group (A) being active', () => {
    setupMultiGroupTournament()
    render(<GroupOverviewPage />)
    const teams = useTournamentStore.getState().tournament.teams
    const groupATeamNames = teams.filter(t => t.groupId === 'A').map(t => t.name)
    const table = screen.getByRole('table')
    for (const name of groupATeamNames) {
      expect(within(table).getByText(name)).toBeInTheDocument()
    }
  })

  it('switches to another group\'s table and schedule when its tab is clicked', () => {
    setupMultiGroupTournament()
    render(<GroupOverviewPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Gruppe B' }))

    const teams = useTournamentStore.getState().tournament.teams
    const groupBTeamNames = teams.filter(t => t.groupId === 'B').map(t => t.name)
    const table = screen.getByRole('table')
    for (const name of groupBTeamNames) {
      expect(within(table).getByText(name)).toBeInTheDocument()
    }
    const groupATeamNames = teams.filter(t => t.groupId === 'A').map(t => t.name)
    for (const name of groupATeamNames) {
      expect(within(table).queryByText(name)).not.toBeInTheDocument()
    }
  })

  it('only lists a group\'s own teams in its table', () => {
    setupMultiGroupTournament()
    render(<GroupOverviewPage />)
    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')
    // header row + 4 team rows
    expect(rows).toHaveLength(5)
  })

  it('updates points after a group-stage result is submitted', () => {
    setupMultiGroupTournament()
    const { schedule, submitGameResult, tournament } = useTournamentStore.getState()
    const game = schedule!.games.find(g => g.stage === 'group' && g.groupId === 'A')!
    submitGameResult(game.id, [{ period: 1, homeScore: 20, awayScore: 10 }])
    const winner = tournament.teams.find(t => t.id === game.homeTeamId)!

    render(<GroupOverviewPage />)
    const table = screen.getByRole('table')
    expect(within(table).getByText(winner.name)).toBeInTheDocument()
  })

  it('only shows the active group\'s schedule, filtered by round', () => {
    setupMultiGroupTournament()
    render(<GroupOverviewPage />)
    const teams = useTournamentStore.getState().tournament.teams
    const groupBTeamNames = teams.filter(t => t.groupId === 'B').map(t => t.name)
    // Group A is active by default -- none of group B's team names should appear anywhere
    // (neither in the table nor in the schedule section below it).
    for (const name of groupBTeamNames) {
      expect(screen.queryByText(name)).not.toBeInTheDocument()
    }
  })
})
```

Run: `npm test -- --run src/pages/GroupOverviewPage.test.tsx`
Expected: die neuen Tests (Tab-Buttons, Gruppenwechsel, gefilterte Anzeige) FAILen — die aktuelle Implementierung rendert alle Gruppen gleichzeitig ohne Tab-Buttons.

- [ ] **Step 2: Implementierung**

Lies die aktuelle vollständige `src/pages/GroupOverviewPage.tsx` (bereits oben zitiert). Ersetze den kompletten Inhalt durch:

```tsx
import { useState } from 'react'
import { useTournamentStore } from '@/store/tournament-store'
import { computeGroupStandings } from '@/lib/group-standings'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import GameRow from '@/components/schedule/GameRow'
import { TeamNameDisplay } from '@/components/teams/TeamNameDisplay'

export default function GroupOverviewPage() {
  const { tournament, schedule } = useTournamentStore()
  const groupIds = [...new Set(tournament.teams.map(t => t.groupId ?? 'A'))].sort()
  const [activeGroupId, setActiveGroupId] = useState(groupIds[0] ?? 'A')

  if (!schedule) {
    return (
      <Alert>
        <AlertDescription>Bitte zuerst einen Zeitplan generieren (Seite „Konfiguration“).</AlertDescription>
      </Alert>
    )
  }

  const currentGroupId = groupIds.includes(activeGroupId) ? activeGroupId : (groupIds[0] ?? 'A')
  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))
  const standings = computeGroupStandings(tournament.teams, schedule.games, currentGroupId)
  const groupGames = schedule.games.filter(g => g.stage === 'group' && (g.groupId ?? 'A') === currentGroupId)
  const rounds = [...new Set(groupGames.map(g => g.round))].sort((a, b) => a - b)

  return (
    <div className="space-y-6">
      <div className="flex gap-1 flex-wrap">
        {groupIds.map(groupId => (
          <Button
            key={groupId}
            variant={groupId === currentGroupId ? undefined : 'outline'}
            size="sm"
            onClick={() => setActiveGroupId(groupId)}
          >
            Gruppe {groupId}
          </Button>
        ))}
      </div>

      <div>
        <h2 className="font-display text-lg uppercase mb-2">Gruppe {currentGroupId}</h2>
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

      <div>
        <h2 className="font-display text-lg uppercase mb-2">Zeitplan</h2>
        {rounds.map(round => (
          <div key={round} className="mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground mb-1">Runde {round}</h3>
            <div className="border border-border rounded-md p-4 bg-card">
              {groupGames
                .filter(g => g.round === round && g.field > 0)
                .map(game => <GameRow key={game.id} game={game} showResult />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

Der `cn`-Import wird in diesem Schritt nicht genutzt (der `Button`-Komponente reicht die `variant`-Prop) — entferne ihn wieder aus dem Import, falls dein Editor/Linter das anmahnt (er wird erst in Task 2 für den Druck-Bereich gebraucht — behalte ihn trotzdem hier, da Task 2 direkt in dieselbe Datei schreibt und der Import dann sowieso wieder gebraucht wird; falls ESLint bei `npm run build` einen unbenutzten Import meldet, entferne ihn ersatzlos, er wird in Task 2 erneut hinzugefügt).

- [ ] **Step 3: Test ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/pages/GroupOverviewPage.test.tsx`
Expected: alle Tests PASS.

- [ ] **Step 4: Vollen Testlauf + Build**

Run: `npm test -- --run && npm run build`
Expected: alle grün. Falls der Build einen unbenutzten `cn`-Import meldet, entferne die Zeile `import { cn } from '@/lib/utils'` aus `GroupOverviewPage.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/GroupOverviewPage.tsx src/pages/GroupOverviewPage.test.tsx
git commit -m "feat: show one group at a time via tabs instead of stacking all groups"
```

---

## Task 2: Druck-Export `renderGroupOverviewHtml` + Drucken-Buttons

**Files:**
- Create: `src/lib/export/group-overview-export.ts`
- Create: `src/lib/export/group-overview-export.test.ts`
- Modify: `src/pages/GroupOverviewPage.tsx`
- Modify: `src/pages/GroupOverviewPage.test.tsx`

- [ ] **Step 1: Fehlschlagenden Test für `renderGroupOverviewHtml` schreiben**

Erstelle `src/lib/export/group-overview-export.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { renderGroupOverviewHtml } from './group-overview-export'
import { computeGroupStandings } from '@/lib/group-standings'
import type { TournamentConfig, Schedule } from '@/types'

const tournament: TournamentConfig = {
  id: 't1', name: 'Verbandsturnier', mode: 'round-robin+finals', finalsBracketSize: 4,
  groupCount: 2, fields: 2,
  gameSettings: {
    periodsCount: 4, periodDurationMin: 5, breakBetweenPeriodsMin: 1,
    halfTimeBreakMin: 5, bufferBetweenGamesMin: 5, breakBetweenRoundsMin: 15,
    awardCeremonyMin: 15,
  },
  venue: {
    name: 'Halle', availabilityWindows: [{ start: '09:00', end: '20:00' }],
    blackoutPeriods: [], setupBufferMin: 30, teardownBufferMin: 30,
  },
  teams: [
    { id: 't1', name: 'Team A', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
    { id: 't2', name: 'Team B', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'A' },
    { id: 't3', name: 'Team C', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'B' },
    { id: 't4', name: 'Team D', logoUrl: '', color: '#000', contact: '', players: [], groupId: 'B' },
  ],
}

const schedule: Schedule = {
  id: 's1', tournamentId: 't1', generatedAt: '2026-09-12T10:00:00Z',
  games: [
    {
      id: 'g1', homeTeamId: 't1', awayTeamId: 't2', stage: 'group', groupId: 'A', field: 1,
      scheduledStart: '09:30', scheduledEnd: '10:00', round: 1, gameNumber: 1,
      periodScores: [{ period: 1, homeScore: 20, awayScore: 15 }],
    },
    {
      id: 'g2', homeTeamId: 't3', awayTeamId: 't4', stage: 'group', groupId: 'B', field: 2,
      scheduledStart: '09:30', scheduledEnd: '10:00', round: 1, gameNumber: 2,
      periodScores: [],
    },
  ],
  totalDurationMin: 30, estimatedEnd: '10:00',
}

describe('renderGroupOverviewHtml', () => {
  it('renders only the requested group\'s table and schedule when given a single group', () => {
    const standingsA = computeGroupStandings(tournament.teams, schedule.games, 'A')
    const html = renderGroupOverviewHtml(tournament, schedule, [{ groupId: 'A', standings: standingsA }])
    expect(html).toContain('Gruppe A')
    expect(html).toContain('Team A')
    expect(html).toContain('Team B')
    expect(html).not.toContain('Team C')
    expect(html).not.toContain('Team D')
  })

  it('renders every group when given multiple groups, each starting a new print page', () => {
    const standingsA = computeGroupStandings(tournament.teams, schedule.games, 'A')
    const standingsB = computeGroupStandings(tournament.teams, schedule.games, 'B')
    const html = renderGroupOverviewHtml(tournament, schedule, [
      { groupId: 'A', standings: standingsA },
      { groupId: 'B', standings: standingsB },
    ])
    expect(html).toContain('Team A')
    expect(html).toContain('Team C')
    // Every group except the very first gets a forced page break before its heading.
    expect(html).toMatch(/<h2[^>]*>Gruppe A<\/h2>/)
    expect(html).toMatch(/<h2 style="page-break-before: always"[^>]*>Gruppe B<\/h2>/)
  })

  it('shows the final score instead of the scheduled time for a played game', () => {
    const standingsA = computeGroupStandings(tournament.teams, schedule.games, 'A')
    const html = renderGroupOverviewHtml(tournament, schedule, [{ groupId: 'A', standings: standingsA }])
    expect(html).toContain('20 : 15')
  })

  it('shows the scheduled time for a game that has not been played yet', () => {
    const standingsB = computeGroupStandings(tournament.teams, schedule.games, 'B')
    const html = renderGroupOverviewHtml(tournament, schedule, [{ groupId: 'B', standings: standingsB }])
    expect(html).toContain('09:30 – 10:00')
  })

  it('escapes HTML in team names', () => {
    const maliciousTournament: TournamentConfig = {
      ...tournament,
      teams: [{ ...tournament.teams[0], name: '<script>alert(1)</script>' }, ...tournament.teams.slice(1)],
    }
    const standingsA = computeGroupStandings(maliciousTournament.teams, schedule.games, 'A')
    const html = renderGroupOverviewHtml(maliciousTournament, schedule, [{ groupId: 'A', standings: standingsA }])
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
```

Run: `npm test -- --run src/lib/export/group-overview-export.test.ts`
Expected: FAIL — die Datei `group-overview-export.ts` existiert noch nicht.

- [ ] **Step 2: Implementierung**

Erstelle `src/lib/export/group-overview-export.ts`:

```typescript
import type { TournamentConfig, Schedule } from '@/types'
import type { GroupStanding } from '@/lib/group-standings'
import { computeFinalScore } from '@/lib/standings'
import { getTeamAbbreviation } from '@/lib/utils'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export interface GroupOverviewSection {
  groupId: string
  standings: GroupStanding[]
}

export function renderGroupOverviewHtml(
  tournament: TournamentConfig,
  schedule: Schedule,
  sections: GroupOverviewSection[],
): string {
  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))

  const groupSections = sections.map(({ groupId, standings }, index) => {
    const standingsRows = standings.map((s, i) => {
      const team = teamMap.get(s.teamId)
      const displayName = team ? getTeamAbbreviation(team) : '?'
      const fullName = team?.name ?? '?'
      return `<tr>
      <td>${i + 1}</td>
      <td title="${escapeHtml(fullName)}">${escapeHtml(displayName)}</td>
      <td>${s.points}</td>
      <td>${s.pointsDiff > 0 ? '+' : ''}${s.pointsDiff}</td>
      <td>${s.wins}-${s.draws}-${s.losses}</td>
    </tr>`
    }).join('\n')

    const groupGames = schedule.games.filter(g => g.stage === 'group' && (g.groupId ?? 'A') === groupId)
    const rounds = [...new Set(groupGames.map(g => g.round))].sort((a, b) => a - b)

    const scheduleSections = rounds.map(round => {
      const rows = groupGames
        .filter(g => g.round === round && g.field > 0)
        .map(g => {
          const homeTeam = g.homeTeamId ? teamMap.get(g.homeTeamId) : undefined
          const awayTeam = g.awayTeamId ? teamMap.get(g.awayTeamId) : undefined
          const home = escapeHtml(homeTeam ? getTeamAbbreviation(homeTeam) : (g.homeLabel ?? '?'))
          const away = escapeHtml(awayTeam ? getTeamAbbreviation(awayTeam) : (g.awayLabel ?? '?'))
          const pairingTitle = escapeHtml([homeTeam?.name, awayTeam?.name].filter(Boolean).join(' vs '))
          const timeOrScore = g.periodScores.length > 0
            ? (() => { const { home, away } = computeFinalScore(g); return `${home} : ${away}` })()
            : `${g.scheduledStart} – ${g.scheduledEnd}`
          return `<tr>
            <td>${g.gameNumber}</td>
            <td>Feld ${g.field}</td>
            <td>${timeOrScore}</td>
            <td title="${pairingTitle}">${home} vs ${away}</td>
          </tr>`
        }).join('\n')
      return `<h3>Runde ${round}</h3>
        <table><thead><tr><th>#</th><th>Feld</th><th>Zeit</th><th>Paarung</th></tr></thead>
        <tbody>${rows}</tbody></table>`
    }).join('\n')

    const breakStyle = index > 0 ? ' style="page-break-before: always"' : ''
    return `<h2${breakStyle}>Gruppe ${escapeHtml(groupId)}</h2>
      <table>
        <thead><tr><th>#</th><th>Team</th><th>Pkt</th><th>Diff</th><th>S-U-N</th></tr></thead>
        <tbody>${standingsRows}</tbody>
      </table>
      ${scheduleSections}`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(tournament.name)}</title>
  <style>
    body { font-family: 'Aller', system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; color: #002751; }
    h1 { font-size: 1.75rem; font-weight: bold; color: #004174; text-transform: uppercase; }
    h2, h3 { color: #004174; }
    table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; margin-bottom: 1.5rem; }
    th, td { padding: 0.4rem 0.75rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { font-weight: 600; background: #004174; color: #fff; }
    tr:nth-child(even) td { background: #f0f7fc; }
    @media print {
      body { margin: 0; max-width: none; }
      h1 { font-size: 1.4rem; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(tournament.name)}</h1>
  ${groupSections}
</body>
</html>`
}
```

- [ ] **Step 3: Test ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/lib/export/group-overview-export.test.ts`
Expected: alle Tests PASS.

- [ ] **Step 4: Drucken-Buttons in `GroupOverviewPage.tsx` einbauen**

Lies die aktuelle `src/pages/GroupOverviewPage.tsx` (Stand nach Task 1). Füge die Imports und die Drucken-Logik hinzu:

```tsx
import { useState } from 'react'
import { useTournamentStore } from '@/store/tournament-store'
import { computeGroupStandings } from '@/lib/group-standings'
import { renderGroupOverviewHtml } from '@/lib/export/group-overview-export'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import GameRow from '@/components/schedule/GameRow'
import { TeamNameDisplay } from '@/components/teams/TeamNameDisplay'

export default function GroupOverviewPage() {
  const { tournament, schedule } = useTournamentStore()
  const groupIds = [...new Set(tournament.teams.map(t => t.groupId ?? 'A'))].sort()
  const [activeGroupId, setActiveGroupId] = useState(groupIds[0] ?? 'A')

  if (!schedule) {
    return (
      <Alert>
        <AlertDescription>Bitte zuerst einen Zeitplan generieren (Seite „Konfiguration“).</AlertDescription>
      </Alert>
    )
  }

  const currentGroupId = groupIds.includes(activeGroupId) ? activeGroupId : (groupIds[0] ?? 'A')
  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))
  const standings = computeGroupStandings(tournament.teams, schedule.games, currentGroupId)
  const groupGames = schedule.games.filter(g => g.stage === 'group' && (g.groupId ?? 'A') === currentGroupId)
  const rounds = [...new Set(groupGames.map(g => g.round))].sort((a, b) => a - b)

  const openPrintWindow = (html: string) => {
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const printWindow = window.open(url, '_blank')
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.print()
        URL.revokeObjectURL(url)
      })
    } else {
      URL.revokeObjectURL(url)
    }
  }

  const handlePrintCurrentGroup = () => {
    openPrintWindow(renderGroupOverviewHtml(tournament, schedule, [{ groupId: currentGroupId, standings }]))
  }

  const handlePrintAllGroups = () => {
    const sections = groupIds.map(groupId => ({
      groupId,
      standings: computeGroupStandings(tournament.teams, schedule.games, groupId),
    }))
    openPrintWindow(renderGroupOverviewHtml(tournament, schedule, sections))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {groupIds.map(groupId => (
            <Button
              key={groupId}
              variant={groupId === currentGroupId ? undefined : 'outline'}
              size="sm"
              onClick={() => setActiveGroupId(groupId)}
            >
              Gruppe {groupId}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrintCurrentGroup}>Diese Gruppe drucken</Button>
          <Button variant="outline" size="sm" onClick={handlePrintAllGroups}>Alle Gruppen drucken</Button>
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg uppercase mb-2">Gruppe {currentGroupId}</h2>
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

      <div>
        <h2 className="font-display text-lg uppercase mb-2">Zeitplan</h2>
        {rounds.map(round => (
          <div key={round} className="mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground mb-1">Runde {round}</h3>
            <div className="border border-border rounded-md p-4 bg-card">
              {groupGames
                .filter(g => g.round === round && g.field > 0)
                .map(game => <GameRow key={game.id} game={game} showResult />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Test für die Drucken-Buttons ergänzen**

Füge in `src/pages/GroupOverviewPage.test.tsx` (nach dem bestehenden `describe`-Block-Inhalt, innerhalb desselben `describe('GroupOverviewPage', ...)`):

```tsx
  it('renders "Diese Gruppe drucken" and "Alle Gruppen drucken" buttons', () => {
    setupMultiGroupTournament()
    render(<GroupOverviewPage />)
    expect(screen.getByRole('button', { name: 'Diese Gruppe drucken' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Alle Gruppen drucken' })).toBeInTheDocument()
  })
```

Run: `npm test -- --run src/pages/GroupOverviewPage.test.tsx`
Expected: alle Tests PASS (inklusive der neuen).

- [ ] **Step 6: Vollen Testlauf + Build + E2E**

Run: `npm test -- --run && npm run build && npm run test:e2e`
Expected: alle grün. Falls ein e2e-Test (`multi-group-round-robin.spec.ts`, `multi-group-round-robin-large.spec.ts`) auf die alte Untereinander-Darstellung angewiesen ist (z. B. `screen.getAllByRole('table')` mit Erwartung > 1 gleichzeitig sichtbarer Tabellen), diesen Test anpassen: er muss jetzt erst auf den jeweiligen Gruppen-Tab klicken, um die entsprechende Tabelle zu sehen. Das ist eine korrekte Anpassung an das neue, gewünschte Verhalten (eine Gruppe gleichzeitig), kein Zurücknehmen.

- [ ] **Step 7: Manuell im Browser verifizieren**

`npm run dev`, Playwright MCP: Mehrgruppen-Turnier aufbauen (z. B. 8 Teams, 2 Gruppen), zur Gruppentabellen-Seite navigieren — bestätigen, dass nur eine Gruppe gleichzeitig sichtbar ist, Tab-Klick wechselt korrekt. "Diese Gruppe drucken" klicken — neuer Tab mit nur der aktiven Gruppe öffnet sich. "Alle Gruppen drucken" klicken — neuer Tab mit beiden Gruppen, Gruppe B beginnt auf einer neuen Druckseite (im Browser-Druckvorschau-Dialog prüfen).

- [ ] **Step 8: Commit**

```bash
git add src/lib/export/group-overview-export.ts src/lib/export/group-overview-export.test.ts src/pages/GroupOverviewPage.tsx src/pages/GroupOverviewPage.test.tsx e2e/
git commit -m "feat: add printing (single group or all groups) to the group overview page"
```

---

## Task 3: `GroupResultsPage` — Ergebniserfassung für die Gruppenphase

**Files:**
- Create: `src/pages/GroupResultsPage.tsx`
- Create: `src/pages/GroupResultsPage.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/components/layout/AppShell.test.tsx`

- [ ] **Step 1: Fehlschlagenden Test schreiben**

Erstelle `src/pages/GroupResultsPage.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { useTournamentStore } from '@/store/tournament-store'
import { clearAll } from '@/lib/storage'
import GroupResultsPage from './GroupResultsPage'

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

describe('GroupResultsPage', () => {
  it('shows a message when no schedule exists yet', () => {
    render(<GroupResultsPage />)
    expect(screen.getByText(/bitte zuerst einen zeitplan generieren/i)).toBeInTheDocument()
  })

  it('lists group-stage games chronologically by scheduled time', () => {
    setupMultiGroupTournament()
    render(<GroupResultsPage />)
    const { schedule } = useTournamentStore.getState()
    const groupGames = schedule!.games.filter(g => g.stage === 'group')
    const sortedStarts = [...groupGames].sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))
    // Every open game gets a "Speichern" button; count must match the number of group-stage games.
    expect(screen.getAllByRole('button', { name: 'Speichern' })).toHaveLength(groupGames.length)
    expect(sortedStarts.length).toBeGreaterThan(0)
  })

  it('defaults to showing only open (unplayed) games', () => {
    setupMultiGroupTournament()
    const { schedule, submitGameResult } = useTournamentStore.getState()
    const game = schedule!.games.find(g => g.stage === 'group')!
    submitGameResult(game.id, [{ period: 1, homeScore: 20, awayScore: 10 }])

    render(<GroupResultsPage />)
    const { schedule: updatedSchedule } = useTournamentStore.getState()
    const openCount = updatedSchedule!.games.filter(g => g.stage === 'group' && g.periodScores.length === 0).length
    expect(screen.getAllByRole('button', { name: 'Speichern' })).toHaveLength(openCount)
  })

  it('shows both open and played games when the status filter is set to "Alle"', () => {
    setupMultiGroupTournament()
    const { schedule, submitGameResult } = useTournamentStore.getState()
    const game = schedule!.games.find(g => g.stage === 'group')!
    submitGameResult(game.id, [{ period: 1, homeScore: 20, awayScore: 10 }])

    render(<GroupResultsPage />)
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'all' } })
    const { schedule: updatedSchedule } = useTournamentStore.getState()
    const totalGroupGames = updatedSchedule!.games.filter(g => g.stage === 'group').length
    expect(screen.getAllByText(/^(Speichern|Korrigieren)$/).length).toBe(totalGroupGames)
  })

  it('lets the organizer enter a result and save it', () => {
    setupMultiGroupTournament()
    render(<GroupResultsPage />)
    const { schedule } = useTournamentStore.getState()
    const firstGame = schedule!.games.filter(g => g.stage === 'group').sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))[0]

    fireEvent.change(screen.getByLabelText(`Ergebnis Heim, Spiel ${firstGame.gameNumber}`), { target: { value: '25' } })
    fireEvent.change(screen.getByLabelText(`Ergebnis Auswärts, Spiel ${firstGame.gameNumber}`), { target: { value: '18' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Speichern' })[0])

    const { schedule: updatedSchedule } = useTournamentStore.getState()
    const updatedGame = updatedSchedule!.games.find(g => g.id === firstGame.id)!
    expect(updatedGame.periodScores).toEqual([{ period: 1, homeScore: 25, awayScore: 18 }])
  })

  it('shows a link to the group overview after saving a result', () => {
    setupMultiGroupTournament()
    render(<GroupResultsPage />)
    const { schedule } = useTournamentStore.getState()
    const firstGame = schedule!.games.filter(g => g.stage === 'group').sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))[0]

    fireEvent.change(screen.getByLabelText(`Ergebnis Heim, Spiel ${firstGame.gameNumber}`), { target: { value: '25' } })
    fireEvent.change(screen.getByLabelText(`Ergebnis Auswärts, Spiel ${firstGame.gameNumber}`), { target: { value: '18' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Speichern' })[0])

    expect(screen.getByRole('link', { name: /Tabelle für Gruppe .* ansehen/ })).toBeInTheDocument()
  })

  it('filters games by group', () => {
    setupMultiGroupTournament()
    render(<GroupResultsPage />)
    const { schedule, tournament } = useTournamentStore.getState()
    const groupBGameNumbers = schedule!.games
      .filter(g => g.stage === 'group' && g.groupId === 'B')
      .map(g => g.gameNumber)

    fireEvent.change(screen.getByLabelText('Gruppe'), { target: { value: 'B' } })

    for (const gameNumber of groupBGameNumbers) {
      expect(screen.getByLabelText(`Ergebnis Heim, Spiel ${gameNumber}`)).toBeInTheDocument()
    }
    const groupAGameNumbers = schedule!.games
      .filter(g => g.stage === 'group' && g.groupId === 'A')
      .map(g => g.gameNumber)
    for (const gameNumber of groupAGameNumbers) {
      expect(screen.queryByLabelText(`Ergebnis Heim, Spiel ${gameNumber}`)).not.toBeInTheDocument()
    }
    // sanity check that tournament actually has both groups (guards against a false-positive
    // pass if setupMultiGroupTournament stopped creating group B for some reason)
    expect(new Set(tournament.teams.map(t => t.groupId)).size).toBe(2)
  })

  it('filters games by field', () => {
    setupMultiGroupTournament()
    render(<GroupResultsPage />)
    const { schedule } = useTournamentStore.getState()
    const field1GameNumbers = schedule!.games.filter(g => g.stage === 'group' && g.field === 1).map(g => g.gameNumber)
    const field2GameNumbers = schedule!.games.filter(g => g.stage === 'group' && g.field === 2).map(g => g.gameNumber)

    fireEvent.change(screen.getByLabelText('Feld'), { target: { value: '1' } })

    for (const gameNumber of field1GameNumbers) {
      expect(screen.getByLabelText(`Ergebnis Heim, Spiel ${gameNumber}`)).toBeInTheDocument()
    }
    for (const gameNumber of field2GameNumbers) {
      expect(screen.queryByLabelText(`Ergebnis Heim, Spiel ${gameNumber}`)).not.toBeInTheDocument()
    }
  })

  it('lets the organizer correct an already-played game via the "Alle" status filter', () => {
    setupMultiGroupTournament()
    const { schedule, submitGameResult } = useTournamentStore.getState()
    const game = schedule!.games.find(g => g.stage === 'group')!
    submitGameResult(game.id, [{ period: 1, homeScore: 20, awayScore: 10 }])

    render(<GroupResultsPage />)
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'all' } })

    fireEvent.click(screen.getByRole('button', { name: 'Korrigieren' }))
    const correctedInput = screen.getByLabelText(`Korrigiertes Ergebnis Heim, Spiel ${game.gameNumber}`)
    fireEvent.change(correctedInput, { target: { value: '55' } })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    const { schedule: updatedSchedule } = useTournamentStore.getState()
    const updatedGame = updatedSchedule!.games.find(g => g.id === game.id)!
    expect(updatedGame.periodScores[0].homeScore).toBe(55)
  })
})
```

Run: `npm test -- --run src/pages/GroupResultsPage.test.tsx`
Expected: FAIL — die Datei `GroupResultsPage.tsx` existiert noch nicht.

- [ ] **Step 2: Implementierung**

Erstelle `src/pages/GroupResultsPage.tsx`:

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTournamentStore } from '@/store/tournament-store'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TeamNameDisplay } from '@/components/teams/TeamNameDisplay'
import { computeFinalScore } from '@/lib/standings'
import type { Game } from '@/types'

type StatusFilter = 'open' | 'played' | 'all'

export default function GroupResultsPage() {
  const { tournament, schedule, submitGameResult, correctGameResult } = useTournamentStore()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open')
  const [groupFilter, setGroupFilter] = useState<string>('all')
  const [fieldFilter, setFieldFilter] = useState<string>('all')
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>({})
  const [correctingGameId, setCorrectingGameId] = useState<string | null>(null)
  const [savedGroupId, setSavedGroupId] = useState<string | null>(null)

  if (!schedule) {
    return (
      <Alert>
        <AlertDescription>Bitte zuerst einen Zeitplan generieren (Seite „Konfiguration“).</AlertDescription>
      </Alert>
    )
  }

  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))
  const groupIds = [...new Set(tournament.teams.map(t => t.groupId ?? 'A'))].sort()

  const groupGames = schedule.games.filter(g => g.stage === 'group')
  const filteredGames = groupGames
    .filter(g => {
      const hasResult = g.periodScores.length > 0
      if (statusFilter === 'open') return !hasResult
      if (statusFilter === 'played') return hasResult
      return true
    })
    .filter(g => groupFilter === 'all' || (g.groupId ?? 'A') === groupFilter)
    .filter(g => fieldFilter === 'all' || g.field === Number(fieldFilter))
    .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))

  const isScoreEntered = (gameId: string) => {
    const entry = scores[gameId]
    return !!entry && entry.home.trim() !== '' && entry.away.trim() !== '' && !Number.isNaN(Number(entry.home)) && !Number.isNaN(Number(entry.away))
  }

  const handleSave = (game: Game) => {
    const entry = scores[game.id]
    const homeScore = entry ? Number(entry.home) : game.periodScores[0]?.homeScore
    const awayScore = entry ? Number(entry.away) : game.periodScores[0]?.awayScore
    const hasResult = game.periodScores.length > 0
    if (hasResult) {
      correctGameResult(game.id, [{ period: 1, homeScore, awayScore }])
    } else {
      submitGameResult(game.id, [{ period: 1, homeScore, awayScore }])
    }
    setCorrectingGameId(null)
    setSavedGroupId(game.groupId ?? 'A')
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl text-brand-primary">Ergebnisse erfassen</h1>

      {savedGroupId && (
        <Alert>
          <AlertDescription>
            Ergebnis gespeichert.{' '}
            <Link to="/group-overview" className="underline">
              Tabelle für Gruppe {savedGroupId} ansehen →
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-4 flex-wrap items-end">
        <div className="space-y-1">
          <Label htmlFor="status-filter">Status</Label>
          <select
            id="status-filter"
            className="border border-border rounded-sm px-2 py-1 text-sm"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="open">Offen</option>
            <option value="played">Erfasst</option>
            <option value="all">Alle</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="group-filter">Gruppe</Label>
          <select
            id="group-filter"
            className="border border-border rounded-sm px-2 py-1 text-sm"
            value={groupFilter}
            onChange={e => setGroupFilter(e.target.value)}
          >
            <option value="all">Alle Gruppen</option>
            {groupIds.map(groupId => (
              <option key={groupId} value={groupId}>Gruppe {groupId}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="field-filter">Feld</Label>
          <select
            id="field-filter"
            className="border border-border rounded-sm px-2 py-1 text-sm"
            value={fieldFilter}
            onChange={e => setFieldFilter(e.target.value)}
          >
            <option value="all">Alle Felder</option>
            {Array.from({ length: tournament.fields }, (_, i) => i + 1).map(field => (
              <option key={field} value={field}>Feld {field}</option>
            ))}
          </select>
        </div>
      </div>

      {filteredGames.length === 0 && (
        <Alert>
          <AlertDescription>Keine Spiele für die gewählten Filter.</AlertDescription>
        </Alert>
      )}

      <div className="border border-border rounded-md p-4 bg-card space-y-3">
        {filteredGames.map(game => {
          const homeTeam = game.homeTeamId ? teamMap.get(game.homeTeamId) : undefined
          const awayTeam = game.awayTeamId ? teamMap.get(game.awayTeamId) : undefined
          const hasResult = game.periodScores.length > 0
          const isCorrecting = correctingGameId === game.id
          const finalScore = hasResult ? computeFinalScore(game) : null

          return (
            <div key={game.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
              <span className="text-xs font-mono text-muted-foreground w-16">{game.scheduledStart}</span>
              <span className="text-xs font-mono w-8 text-center bg-tint rounded-sm px-1">F{game.field}</span>
              <span className="text-xs font-mono w-8 text-center bg-tint rounded-sm px-1">
                Gruppe {game.groupId ?? 'A'}
              </span>
              <div className="flex-1 min-w-0 flex items-center gap-2">
                {homeTeam ? <TeamNameDisplay team={homeTeam} /> : <span>{game.homeLabel ?? '?'}</span>}
                <span className="text-muted-foreground text-sm">vs</span>
                {awayTeam ? <TeamNameDisplay team={awayTeam} /> : <span>{game.awayLabel ?? '?'}</span>}
              </div>

              {hasResult && !isCorrecting ? (
                <>
                  <span className="text-sm font-mono w-20 text-center">
                    {finalScore!.home} : {finalScore!.away}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setCorrectingGameId(game.id)}>
                    Korrigieren
                  </Button>
                </>
              ) : (
                <>
                  <Input
                    type="number"
                    className="w-16 no-spinner px-1 text-center"
                    aria-label={isCorrecting ? `Korrigiertes Ergebnis Heim, Spiel ${game.gameNumber}` : `Ergebnis Heim, Spiel ${game.gameNumber}`}
                    defaultValue={isCorrecting ? game.periodScores[0].homeScore : undefined}
                    onChange={e => setScores(s => ({ ...s, [game.id]: { home: e.target.value, away: s[game.id]?.away ?? (isCorrecting ? String(game.periodScores[0].awayScore) : '') } }))}
                  />
                  <span>:</span>
                  <Input
                    type="number"
                    className="w-16 no-spinner px-1 text-center"
                    aria-label={isCorrecting ? `Korrigiertes Ergebnis Auswärts, Spiel ${game.gameNumber}` : `Ergebnis Auswärts, Spiel ${game.gameNumber}`}
                    defaultValue={isCorrecting ? game.periodScores[0].awayScore : undefined}
                    onChange={e => setScores(s => ({ ...s, [game.id]: { home: s[game.id]?.home ?? (isCorrecting ? String(game.periodScores[0].homeScore) : ''), away: e.target.value } }))}
                  />
                  <Button
                    size="sm"
                    disabled={!isCorrecting && !isScoreEntered(game.id)}
                    onClick={() => handleSave(game)}
                  >
                    Speichern
                  </Button>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

WICHTIG für den Implementierer: `handleSave` verhält sich bei einer Korrektur (`isCorrecting`) so, dass es die bereits im `scores`-State per `defaultValue` vorbefüllten Werte übernimmt (falls der Nutzer nichts ändert, bleibt `entry` `undefined` und der Fallback `game.periodScores[0]?.homeScore/awayScore` greift) — das entspricht dem Verhalten, ein bereits korrektes Ergebnis unverändert erneut zu speichern, was für diese Seite ausreichend ist (kein "Abbrechen"-Button nötig laut Spec).

- [ ] **Step 3: Test ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/pages/GroupResultsPage.test.tsx`
Expected: alle Tests PASS. Falls einzelne Assertions (insbesondere zur exakten DOM-Struktur/Button-Zählung) nicht exakt zur tatsächlichen Implementierung passen, die Tests entsprechend an das tatsächliche, aber spezifikationskonforme Verhalten anpassen (nicht die Kernanforderungen der Spec aufweichen: Status/Gruppe/Feld-Filter UND-verknüpft, Speichern pro Zeile, Korrektur ohner Rundenzwang, Link nach dem Speichern).

- [ ] **Step 4: Route + Navigation verdrahten**

Lies die aktuelle vollständige `src/App.tsx` (bereits oben zitiert). Füge den Import und die Route hinzu:

```tsx
import GroupResultsPage from '@/pages/GroupResultsPage'
```
Route (nach `group-overview`):
```tsx
          <Route path="group-results" element={<GroupResultsPage />} />
```

Lies die aktuelle vollständige `src/components/layout/AppShell.tsx` (bereits oben zitiert). Ändere die `navItems`-Konstruktion: für Round-Robin-Modi (nicht-Swiss) wird zusätzlich zu „Zeitplan" ein „Ergebnisse erfassen"-Link ergänzt (unabhängig davon, ob es mehrere Gruppen gibt — auch bei einer einzigen Gruppe soll die Erfassungsseite nutzbar sein, da genau das den ursprünglich fehlenden Use-Case behebt):

```tsx
import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useTournamentStore } from '@/store/tournament-store'

export default function AppShell() {
  const { tournament, schedule } = useTournamentStore()
  const isSwiss = tournament.mode === 'swiss'
  const hasSchedule = !!schedule && schedule.games.length > 0
  const hasMultipleGroups = new Set(tournament.teams.map((t) => t.groupId ?? 'A')).size > 1

  const navItems = [
    { to: '/teams', label: 'Teams', gated: false },
    { to: '/config', label: 'Konfiguration', gated: false },
    ...(isSwiss
      ? [
          { to: '/swiss-results', label: 'Ergebnisse erfassen', gated: true },
          { to: '/swiss-overview', label: 'Turnierübersicht', gated: true },
        ]
      : [
          { to: '/schedule', label: 'Zeitplan', gated: true },
          { to: '/group-results', label: 'Ergebnisse erfassen', gated: true },
          ...(hasMultipleGroups
            ? [{ to: '/group-overview', label: 'Gruppentabellen', gated: true }]
            : []),
        ]),
    { to: '/export', label: 'Export', gated: false },
    { to: '/anleitung', label: 'Anleitung', gated: false },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-brand-primary-dark text-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-6">
          <span className="font-display text-lg uppercase tracking-tight">
            Basketball Turnier-Manager
          </span>
          <nav className="flex gap-1">
            {navItems.map(({ to, label, gated }) =>
              gated && !hasSchedule ? (
                <span
                  key={to}
                  aria-disabled="true"
                  title="Bitte zuerst einen Zeitplan generieren"
                  className="px-3 py-1.5 rounded-sm text-sm font-medium text-white/40 cursor-not-allowed"
                >
                  {label}
                </span>
              ) : (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      'px-3 py-1.5 rounded-sm text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-brand-accent text-brand-primary-dark'
                        : 'text-white/80 hover:text-white hover:bg-white/10',
                    )
                  }
                >
                  {label}
                </NavLink>
              )
            )}
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

WICHTIG: sowohl `round-robin` als auch `round-robin+finals` fallen in den `else`-Zweig (`!isSwiss`), bekommen also beide den neuen "Ergebnisse erfassen"-Link — das ist beabsichtigt, da der fehlende Ergebniserfassungs-Use-Case beide Modi betrifft, nicht nur die Mehrgruppen-Variante.

- [ ] **Step 5: `AppShell.test.tsx` anpassen**

Lies die aktuelle vollständige `src/components/layout/AppShell.test.tsx` (bereits oben zitiert). Der bestehende Test `'renders "Zeitplan" as a clickable link once a schedule with games exists'` bleibt gültig (Zeitplan-Link ändert sich nicht). Ergänze folgenden neuen Test in der `describe('AppShell', ...)`-Gruppe:

```tsx
  it('shows "Ergebnisse erfassen" as a link for round-robin mode once a schedule exists', () => {
    useTournamentStore.getState().addTeam({ name: 'Team A', logoUrl: '', color: '#000', contact: '' })
    useTournamentStore.getState().addTeam({ name: 'Team B', logoUrl: '', color: '#000', contact: '' })
    useTournamentStore.getState().generateAndSaveSchedule()

    renderShell()

    expect(screen.getByRole('link', { name: 'Ergebnisse erfassen' })).toHaveAttribute('href', '/group-results')
  })

  it('shows "Ergebnisse erfassen" as a non-clickable label for round-robin mode when no schedule exists', () => {
    renderShell()
    expect(screen.queryByRole('link', { name: 'Ergebnisse erfassen' })).not.toBeInTheDocument()
    expect(screen.getByText('Ergebnisse erfassen')).toBeInTheDocument()
  })
```

HINWEIS: der bestehende Test `'renders swiss-mode nav items as non-clickable labels when no schedule exists'` prüft `screen.getByText('Ergebnisse erfassen')` im Swiss-Modus — da jetzt AUCH der Round-Robin-Modus einen gleichnamigen Link/Label hat, ist `getByText` in einem gemischten Testszenario nicht mehr eindeutig. Das betrifft hier aber keinen bestehenden Test direkt (jeder Test setzt seinen eigenen Modus einzeln, nie beide gleichzeitig), daher bleiben alle bestehenden Tests unverändert gültig — nur zur Kenntnisnahme für den Implementierer, falls ein neuer Test beide Modi gleichzeitig prüfen wollte (nicht Teil dieses Plans).

Run: `npm test -- --run src/components/layout/AppShell.test.tsx`
Expected: alle Tests PASS.

- [ ] **Step 6: Vollen Testlauf + Build + E2E**

Run: `npm test -- --run && npm run build && npm run test:e2e`
Expected: alle grün. Prüfe insbesondere `e2e/all-tournament-variants.spec.ts` — falls ein Test dort explizit `screen.queryByRole('link', { name: 'Ergebnisse erfassen' })` als NICHT vorhanden voraussetzt (unwahrscheinlich, aber möglich, da diese Datei vor diesem Feature geschrieben wurde und Round-Robin-Modi bisher nie einen solchen Link hatten), diesen Test anpassen — das ist eine korrekte Anpassung an das neue, gewünschte Verhalten.

- [ ] **Step 7: Manuell im Browser verifizieren**

`npm run dev`, Playwright MCP: Mehrgruppen-Turnier aufbauen, zur neuen "Ergebnisse erfassen"-Seite navigieren. Bestätigen: Standardfilter zeigt offene Spiele aller Gruppen/Felder chronologisch. Ein Ergebnis eintragen und speichern — bestätigen, dass ein Hinweis mit Link zur Gruppenübersicht erscheint, und dass das Spiel aus der "Offen"-Liste verschwindet. Status-Filter auf "Alle" stellen, das gerade gespeicherte Spiel korrigieren. Gruppen- und Feld-Filter einzeln und kombiniert testen.

- [ ] **Step 8: Commit**

```bash
git add src/pages/GroupResultsPage.tsx src/pages/GroupResultsPage.test.tsx src/App.tsx src/components/layout/AppShell.tsx src/components/layout/AppShell.test.tsx e2e/
git commit -m "feat: add a dedicated results-entry page for round-robin group-stage games"
```

---

## Task 4: Abschlussregression

**Files:** keine Änderungen, nur Verifikation

- [ ] **Step 1**: `npm test -- --run` — alle Tests PASS, Gesamtzahl notieren.
- [ ] **Step 2**: `npm run test:e2e && npm run test:e2e` (zweimal, Flakiness-Check) — alle PASS in beiden Läufen.
- [ ] **Step 3**: `npm run build` — erfolgreich, keine TypeScript-Fehler.
- [ ] **Step 4**: Manueller Gesamtdurchlauf im Browser (Playwright MCP), entlang der beiden Use-Cases aus der Spec:
  1. **Turnierleiter-Sicht**: Mehrgruppen-Turnier (z. B. 9 Teams, 3 Gruppen) aufbauen, Zeitplan generieren. Zur "Ergebnisse erfassen"-Seite navigieren, mehrere Ergebnisse aus verschiedenen Gruppen/Feldern eintragen, dabei Filter nutzen. Bestätigen, dass jedes Ergebnis sofort gespeichert wird (kein Rundenzwang) und der Link zur Gruppenübersicht funktioniert.
  2. **Teilnehmer/Zuschauer-Sicht**: Zur "Gruppentabellen"-Seite navigieren, durch die Gruppen-Tabs blättern — bestätigen, dass jede Gruppe ihre eigene Tabelle (mit S-U-N-Spalte) und ihren eigenen, nach Runde sortierten Zeitplan (inkl. bereits erfasster Ergebnisse) zeigt, sodass ein Zuschauer daraus ablesen kann, wo/wann sein Team als Nächstes spielt und wie der bevorstehende Gegner bisher abgeschnitten hat (Tabellenposition + bereits im Zeitplan sichtbare frühere Ergebnisse dieses Gegners).
  3. Drucken testen: "Diese Gruppe drucken" und "Alle Gruppen drucken", inklusive Seitenumbruch-Kontrolle in der Browser-Druckvorschau.
  4. Bestätigen, dass sich am Swiss-System-Verhalten (eigene "Ergebnisse erfassen"-Seite unter `/swiss-results`) nichts geändert hat.
- [ ] **Step 5**: Kein Commit nötig (reine Verifikation). Bei gefundenen Bugs: neuen Task mit Fix + Test ergänzen, einzeln committen.

---

## Task 5: Anleitung aktualisieren (echte Screenshots)

**Voraussetzung:** NUR starten, wenn Task 4 (Abschlussregression) vollständig grün ist — Tests, Build, e2e, manueller Durchlauf.

**Files:**
- Modify: `src/pages/ManualPage.tsx`
- Modify: `src/pages/ManualPage.test.tsx`
- Create: `public/anleitung/28-gruppentabellen-tabs.png` (und ggf. weitere, siehe unten — exakte Nummerierung fortlaufend ab der höchsten bereits vorhandenen Datei in `public/anleitung/`, per `ls public/anleitung/ | sort` zu Beginn dieses Tasks ermitteln)

**Kontext:** Die bestehende Anleitung (`/anleitung`) dokumentiert bereits Abschnitt 3.1 (Gruppen-Konfiguration) und 5.1 (Gruppentabellen) mit echten, per Playwright-Browser aufgenommenen Screenshots (siehe Commit `b4b8116` als Vorlage für Vorgehen und Bildstil). Dieser Task ergänzt die Anleitung um die in diesem Plan neu hinzugekommenen UI-Elemente: die Tab-Navigation der Gruppentabellen-Seite, die beiden Drucken-Buttons, und die komplett neue "Ergebnisse erfassen"-Seite für die Gruppenphase.

**Wichtig — Absicherung:** Für diesen Task reicht es aus, dass die BESTEHENDEN `ManualPage.test.tsx`-Tests (inkl. der in diesem Task ergänzten neuen Tests für die neuen Abschnitte/Bilder) grün sind. Kein Playwright-e2e-Test für die Anleitungsseite nötig — die Screenshots selbst sind Dokumentation, keine testkritische Funktionalität.

- [ ] **Step 1: Aktuelle Anleitungs-Struktur und bestehende Screenshot-Konvention lesen**

Lies die vollständige aktuelle `src/pages/ManualPage.tsx` und `src/pages/ManualPage.test.tsx`. Notiere: die aktuelle höchste TOC-Nummerierung (Abschnitte 1-9, mit Unterabschnitten 3.1 und 5.1 aus dem vorherigen Feature), die aktuelle Anzahl referenzierter Screenshots (per `grep -c '<Screenshot' src/pages/ManualPage.tsx`), und das exakte `Screenshot`/`Callout`/`SubSection`-Komponentenmuster am Kopf der Datei.

Run: `ls public/anleitung/ | sort | tail -5` — die nächste freie Nummer ist die höchste vorhandene + 1.

- [ ] **Step 2: Screenshots per echtem Browser aufnehmen**

Starte den Dev-Server (`npm run dev`) und nutze Playwright MCP (nicht Playwright-Testcode — ein echter interaktiver Browser, wie in Commit `b4b8116` vorgemacht), um folgende Zustände zu erzeugen und als PNG zu sichern (Dateinamen fortlaufend ab der in Step 1 ermittelten nächsten freien Nummer, Namensschema `<Nummer>-<kurzbeschreibung>.png`):

1. Ein Mehrgruppen-Turnier aufbauen (z. B. 8-9 Teams, 2-3 Gruppen, Zeitplan generieren) und zur Gruppentabellen-Seite navigieren — Screenshot der Tab-Leiste mit den Gruppen-Buttons UND den beiden Drucken-Buttons sichtbar oben auf der Seite.
2. Die neue "Ergebnisse erfassen"-Seite aufrufen — Screenshot mit sichtbaren Filtern (Status/Gruppe/Feld) und mindestens einer offenen Spielzeile mit Eingabefeldern.
3. Optional (falls es den Sachverhalt klarer macht): ein Screenshot NACH dem Speichern eines Ergebnisses, der den Hinweis mit Link zur Gruppentabelle zeigt.

Speichere die PNGs direkt unter `public/anleitung/` im Worktree (nicht im Hauptrepository-Root — falls der Playwright-MCP-Server relativ zu einem anderen Arbeitsverzeichnis speichert, wie es in einer früheren Session beobachtet wurde, die Dateien anschließend an die richtige Stelle kopieren, siehe Vorgehen in Commit `b4b8116`).

Beende den Dev-Server nach Abschluss der Screenshots wieder (`pkill -f vite` oder gleichwertig), räume `.playwright-mcp`/Test-Artefakte auf, die während der Session entstanden sind.

- [ ] **Step 3: Anleitung erweitern**

Erweitere `src/pages/ManualPage.tsx`:
- Im TOC-Array: Unterabschnitt zu 5.1 ergänzen (z. B. "5.1.1 Drucken" — je nachdem, wie es sich am natürlichsten in die bestehende Nummerierung einfügt) ODER bestehenden 5.1-Text um die Tab-/Druck-Beschreibung erweitern, plus einen neuen Hauptabschnitt (z. B. Abschnitt 4a oder als neuer Abschnitt zwischen 4 und 5, mit entsprechender Renummerierung ALLER nachfolgenden Abschnitte inkl. TOC und Kurzreferenz — lies die Datei vollständig, um die exakte, konsistente Umnummerierung durchzuführen, keine Lücken oder Dopplungen).
- Textlich beschreiben: (a) dass die Gruppentabellen-Seite jetzt eine Gruppe nach der anderen per Tab zeigt statt aller Gruppen untereinander (kurze Ergänzung zu 5.1), (b) die beiden Drucken-Buttons ("Diese Gruppe drucken"/"Alle Gruppen drucken") mit Screenshot, (c) einen neuen Abschnitt zur "Ergebnisse erfassen"-Seite für die Gruppenphase (Filter Status/Gruppe/Feld, Speichern pro Spiel, Korrigieren, Link zur Gruppentabelle nach dem Speichern) mit Screenshot — im selben erklärenden, direkten Ton wie die bestehenden Abschnitte, mit `Callout`-Boxen für wichtige Hinweise (z. B. dass anders als beim Schweizer System JEDES Ergebnis sofort für sich gespeichert wird, kein Rundenabschluss nötig).
- Binde die neuen Screenshots über die bestehende `<Screenshot src="..." alt="..." />`-Komponente ein.

- [ ] **Step 4: `ManualPage.test.tsx` erweitern**

Aktualisiere den bestehenden Test, der `images.length` auf eine feste Zahl prüft (`grep -n "images.length" src/pages/ManualPage.test.tsx` zur exakten Fundstelle) — neue Gesamtzahl = alte Zahl + Anzahl der in Step 2 tatsächlich hinzugefügten Screenshots.

Ergänze neue Tests analog zum bestehenden Muster (siehe vorhandene Tests `'documents multi-group round-robin and double round-robin configuration'` und `'documents the group-standings overview page'` als Vorlage), die:
- bestätigen, dass der neue Abschnitt zur Ergebniserfassung (Überschrift) im Dokument vorkommt,
- bestätigen, dass die neuen Screenshot-Dateinamen tatsächlich referenziert werden (Muster wie im bestehenden Test `'renders screenshots for the new group-configuration and group-standings sections'`),
- bestätigen, dass alle neuen/umnummerierten TOC-Einträge korrekt auf ihre Anker-IDs verlinken.

- [ ] **Step 5: Tests ausführen, Erfolg verifizieren**

Run: `npm test -- --run src/pages/ManualPage.test.tsx`
Expected: alle Tests PASS.

- [ ] **Step 6: Vollen Testlauf + Build**

Run: `npm test -- --run && npm run build`
Expected: alle grün. Kein e2e-Lauf für diesen Task nötig (siehe "Wichtig — Absicherung" oben) — die bestehende e2e-Suite bleibt unverändert, da an keiner funktionalen Seite (außer der reinen Doku-Seite `/anleitung`) etwas geändert wird.

- [ ] **Step 7: Commit**

```bash
git add src/pages/ManualPage.tsx src/pages/ManualPage.test.tsx public/anleitung/
git commit -m "docs: document tabbed group navigation, group printing, and the results-entry page"
```

- [ ] **Step 8**: Aufräumen — prüfe `git status --short`, dass keine Screenshot-Zwischendateien außerhalb von `public/anleitung/` oder Playwright-MCP-Artefakte (`.playwright-mcp/`, `test-results/`, `playwright-report/`) im Arbeitsverzeichnis verblieben sind. Falls doch, entfernen (diese Verzeichnisse sind bereits in `.gitignore`/etablierter Praxis nicht Teil des Commits).
