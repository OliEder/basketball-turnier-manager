# PDF-Export für Übersichtsseiten und Anleitung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `window.print()`-popup export path on `GroupOverviewPage`, `SwissOverviewPage`, and `ManualPage` with real, direct PDF downloads built with `@react-pdf/renderer`, matching the visual theme (blue headers, zebra rows) of the existing print CSS, and retrofit test coverage onto the previously-untested schedule PDF export.

**Architecture:** Two new tabular PDF renderers (`group-overview-pdf.ts`, `swiss-overview-pdf.ts`) reuse a shared `pdf-theme.ts` StyleSheet. The manual page is migrated from 609 lines of JSX to a single `src/content/manual.md` Markdown file, tokenized once with `marked`, and rendered by two small custom renderers — one to web JSX (replacing the current JSX), one to react-pdf elements — so the manual has one source of truth for both the web page and its PDF export.

**Tech Stack:** `@react-pdf/renderer` (already installed, v4.5.1), `marked` (new dependency, v18.0.13), Vitest, Playwright.

---

## Spec Reference

Full design: `docs/superpowers/specs/2026-09-17-pdf-export-design.md`. Read it before starting if anything below is unclear on the "why."

## Task Sequencing

Tasks 1-3 (shared theme, group-overview PDF, swiss-overview PDF) are independent of the manual migration and can be done first — they deliver two of the three "Ziel"-buttons working end-to-end. Tasks 4-9 (manual markdown migration) are a separate, larger unit of work. Task 10 retrofits tests onto the pre-existing schedule PDF export. Do them in order; each task's tests must stay green before starting the next.

---

### Task 1: Shared PDF color theme

**Files:**
- Create: `src/lib/export/pdf-theme.ts`
- Test: `src/lib/export/pdf-theme.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/export/pdf-theme.test.ts
import { describe, it, expect } from 'vitest'
import { pdfColors, pdfBaseStyles } from './pdf-theme'

describe('pdf-theme', () => {
  it('exposes the brand color palette used across all PDF exports', () => {
    expect(pdfColors.brandBlue).toBe('#004174')
    expect(pdfColors.textDark).toBe('#002751')
    expect(pdfColors.zebra).toBe('#f0f7fc')
    expect(pdfColors.white).toBe('#fff')
    expect(pdfColors.border).toBe('#e2e8f0')
  })

  it('gives table header cells a blue background and white text', () => {
    expect(pdfBaseStyles.tableHeaderRow.backgroundColor).toBe(pdfColors.brandBlue)
    expect(pdfBaseStyles.tableHeaderCell.color).toBe(pdfColors.white)
  })

  it('gives even table rows the zebra background', () => {
    expect(pdfBaseStyles.tableRowEven.backgroundColor).toBe(pdfColors.zebra)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/export/pdf-theme.test.ts`
Expected: FAIL with "Cannot find module './pdf-theme'"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/export/pdf-theme.ts
import { StyleSheet } from '@react-pdf/renderer'

export const pdfColors = {
  brandBlue: '#004174',
  textDark: '#002751',
  zebra: '#f0f7fc',
  white: '#fff',
  border: '#e2e8f0',
}

export const pdfBaseStyles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica' },
  h1: { fontSize: 20, fontWeight: 'bold', color: pdfColors.brandBlue, textTransform: 'uppercase', marginBottom: 8 },
  h2: { fontSize: 14, fontWeight: 'bold', color: pdfColors.brandBlue, textTransform: 'uppercase', marginTop: 16, marginBottom: 6 },
  h3: { fontSize: 11, fontWeight: 'bold', color: pdfColors.brandBlue, marginTop: 10, marginBottom: 4 },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: pdfColors.brandBlue },
  tableHeaderCell: { color: pdfColors.white, fontSize: 9, fontWeight: 600, padding: 4 },
  tableRow: { flexDirection: 'row', borderBottom: `1px solid ${pdfColors.border}` },
  tableRowEven: { backgroundColor: pdfColors.zebra },
  cell: { fontSize: 9, color: pdfColors.textDark, padding: 4 },
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/export/pdf-theme.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/pdf-theme.ts src/lib/export/pdf-theme.test.ts
git commit -m "$(cat <<'EOF'
feat: add shared react-pdf color theme for the export PDFs

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VmqdNxoJkbcNN2uj8e6nB7
EOF
)"
```

---

### Task 2: Group-overview PDF renderer

**Files:**
- Create: `src/lib/export/group-overview-pdf.ts`
- Test: `src/lib/export/group-overview-pdf.test.ts`
- Delete: `src/lib/export/group-overview-export.ts`, `src/lib/export/group-overview-export.test.ts` (in Step 7)

This replaces `renderGroupOverviewHtml` (HTML-string based) with a react-pdf element tree. Reference implementation for the old behavior: `src/lib/export/group-overview-export.ts` (do not delete until Step 7).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/export/group-overview-pdf.test.ts
import { describe, it, expect } from 'vitest'
import { isValidElement } from 'react'
import { buildGroupOverviewDocument } from './group-overview-pdf'
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

describe('buildGroupOverviewDocument', () => {
  it('creates one Page per section, in order', () => {
    const sections = [
      { groupId: 'A', standings: computeGroupStandings(tournament.teams, schedule.games, 'A') },
      { groupId: 'B', standings: computeGroupStandings(tournament.teams, schedule.games, 'B') },
    ]
    const doc = buildGroupOverviewDocument(tournament, schedule, sections)
    expect(isValidElement(doc)).toBe(true)
    // Document -> children is an array of Page elements, one per section
    const pages = (doc.props as { children: unknown[] }).children
    expect(pages).toHaveLength(2)
  })

  it('includes the played score for a finished game and the scheduled time for an open one', () => {
    const sections = [{ groupId: 'A', standings: computeGroupStandings(tournament.teams, schedule.games, 'A') }]
    const doc = buildGroupOverviewDocument(tournament, schedule, sections)
    const json = JSON.stringify(doc, (_key, value) =>
      isValidElement(value) ? { type: (value as { type: unknown }).type, props: (value as { props: unknown }).props } : value,
    )
    expect(json).toContain('20 : 15')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/export/group-overview-pdf.test.ts`
Expected: FAIL with "Cannot find module './group-overview-pdf'"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/export/group-overview-pdf.ts
import { pdf, Document, Page, Text, View } from '@react-pdf/renderer'
import { createElement } from 'react'
import type { TournamentConfig, Schedule } from '@/types'
import type { GroupStanding } from '@/lib/group-standings'
import { computeFinalScore } from '@/lib/standings'
import { getTeamAbbreviation } from '@/lib/utils'
import { pdfBaseStyles } from './pdf-theme'

export interface GroupOverviewSection {
  groupId: string
  standings: GroupStanding[]
}

function StandingsTable({ standings, teamMap }: {
  standings: GroupStanding[]
  teamMap: Map<string, TournamentConfig['teams'][number]>
}) {
  return createElement(View, { style: { marginBottom: 12 } },
    createElement(View, { style: pdfBaseStyles.tableHeaderRow },
      createElement(Text, { style: [pdfBaseStyles.tableHeaderCell, { width: '8%' }] }, '#'),
      createElement(Text, { style: [pdfBaseStyles.tableHeaderCell, { width: '32%' }] }, 'Team'),
      createElement(Text, { style: [pdfBaseStyles.tableHeaderCell, { width: '15%' }] }, 'Pkt'),
      createElement(Text, { style: [pdfBaseStyles.tableHeaderCell, { width: '15%' }] }, 'Diff'),
      createElement(Text, { style: [pdfBaseStyles.tableHeaderCell, { width: '30%' }] }, 'S-U-N'),
    ),
    ...standings.map((s, i) => {
      const team = teamMap.get(s.teamId)
      const name = team ? getTeamAbbreviation(team) : '?'
      return createElement(View, {
        key: s.teamId,
        style: i % 2 === 1 ? [pdfBaseStyles.tableRow, pdfBaseStyles.tableRowEven] : pdfBaseStyles.tableRow,
      },
        createElement(Text, { style: [pdfBaseStyles.cell, { width: '8%' }] }, String(i + 1)),
        createElement(Text, { style: [pdfBaseStyles.cell, { width: '32%' }] }, name),
        createElement(Text, { style: [pdfBaseStyles.cell, { width: '15%' }] }, String(s.points)),
        createElement(Text, { style: [pdfBaseStyles.cell, { width: '15%' }] }, `${s.pointsDiff > 0 ? '+' : ''}${s.pointsDiff}`),
        createElement(Text, { style: [pdfBaseStyles.cell, { width: '30%' }] }, `${s.wins}-${s.draws}-${s.losses}`),
      )
    }),
  )
}

function RoundTable({ round, games, teamMap }: {
  round: number
  games: Schedule['games']
  teamMap: Map<string, TournamentConfig['teams'][number]>
}) {
  return createElement(View, { style: { marginBottom: 10 } },
    createElement(Text, { style: pdfBaseStyles.h3 }, `Runde ${round}`),
    createElement(View, { style: pdfBaseStyles.tableHeaderRow },
      createElement(Text, { style: [pdfBaseStyles.tableHeaderCell, { width: '8%' }] }, '#'),
      createElement(Text, { style: [pdfBaseStyles.tableHeaderCell, { width: '12%' }] }, 'Feld'),
      createElement(Text, { style: [pdfBaseStyles.tableHeaderCell, { width: '20%' }] }, 'Zeit'),
      createElement(Text, { style: [pdfBaseStyles.tableHeaderCell, { width: '60%' }] }, 'Paarung'),
    ),
    ...games.filter(g => g.round === round && g.field > 0).map((g, i) => {
      const homeTeam = g.homeTeamId ? teamMap.get(g.homeTeamId) : undefined
      const awayTeam = g.awayTeamId ? teamMap.get(g.awayTeamId) : undefined
      const home = homeTeam ? getTeamAbbreviation(homeTeam) : (g.homeLabel ?? '?')
      const away = awayTeam ? getTeamAbbreviation(awayTeam) : (g.awayLabel ?? '?')
      const timeOrScore = g.periodScores.length > 0
        ? (() => { const { home, away } = computeFinalScore(g); return `${home} : ${away}` })()
        : `${g.scheduledStart} – ${g.scheduledEnd}`
      return createElement(View, {
        key: g.id,
        style: i % 2 === 1 ? [pdfBaseStyles.tableRow, pdfBaseStyles.tableRowEven] : pdfBaseStyles.tableRow,
      },
        createElement(Text, { style: [pdfBaseStyles.cell, { width: '8%' }] }, String(g.gameNumber)),
        createElement(Text, { style: [pdfBaseStyles.cell, { width: '12%' }] }, `Feld ${g.field}`),
        createElement(Text, { style: [pdfBaseStyles.cell, { width: '20%' }] }, timeOrScore),
        createElement(Text, { style: [pdfBaseStyles.cell, { width: '60%' }] }, `${home} vs ${away}`),
      )
    }),
  )
}

export function buildGroupOverviewDocument(
  tournament: TournamentConfig,
  schedule: Schedule,
  sections: GroupOverviewSection[],
) {
  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))

  return createElement(Document, { title: `${tournament.name} — Gruppentabellen` },
    ...sections.map(({ groupId, standings }) => {
      const groupGames = schedule.games.filter(g => g.stage === 'group' && (g.groupId ?? 'A') === groupId)
      const rounds = [...new Set(groupGames.map(g => g.round))].sort((a, b) => a - b)
      return createElement(Page, { key: groupId, size: 'A4', style: pdfBaseStyles.page },
        createElement(Text, { style: pdfBaseStyles.h1 }, tournament.name),
        createElement(Text, { style: pdfBaseStyles.h2 }, `Gruppe ${groupId}`),
        createElement(StandingsTable, { standings, teamMap }),
        ...rounds.map(round => createElement(RoundTable, { key: round, round, games: groupGames, teamMap })),
      )
    }),
  )
}

export async function downloadGroupOverviewPdf(
  tournament: TournamentConfig,
  schedule: Schedule,
  sections: GroupOverviewSection[],
): Promise<void> {
  const doc = buildGroupOverviewDocument(tournament, schedule, sections)
  const blob = await pdf(doc as Parameters<typeof pdf>[0]).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const suffix = sections.length === 1 ? `gruppe-${sections[0].groupId}` : 'alle-gruppen'
  a.download = `${tournament.name.replace(/\s+/g, '-')}-${suffix}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/export/group-overview-pdf.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Update `GroupOverviewPage.tsx` to use the new PDF download**

Read the current file at `src/pages/GroupOverviewPage.tsx` first (it has two print buttons: "Diese Gruppe drucken" and "Alle Gruppen drucken", both calling `renderGroupOverviewHtml` via `openPrintWindow`). Replace:

```tsx
import { renderGroupOverviewHtml } from '@/lib/export/group-overview-export'
```

with:

```tsx
import { downloadGroupOverviewPdf } from '@/lib/export/group-overview-pdf'
```

Replace the `openPrintWindow`/`handlePrintCurrentGroup`/`handlePrintAllGroups` block:

```tsx
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
```

with:

```tsx
  const handleDownloadCurrentGroupPdf = () => {
    void downloadGroupOverviewPdf(tournament, schedule, [{ groupId: currentGroupId, standings }])
  }

  const handleDownloadAllGroupsPdf = () => {
    const sections = groupIds.map(groupId => ({
      groupId,
      standings: computeGroupStandings(tournament.teams, schedule.games, groupId),
    }))
    void downloadGroupOverviewPdf(tournament, schedule, sections)
  }
```

And the two buttons:

```tsx
          <Button variant="outline" size="sm" onClick={handlePrintCurrentGroup}>Diese Gruppe drucken</Button>
          <Button variant="outline" size="sm" onClick={handlePrintAllGroups}>Alle Gruppen drucken</Button>
```

with:

```tsx
          <Button variant="outline" size="sm" onClick={handleDownloadCurrentGroupPdf}>Diese Gruppe als PDF herunterladen</Button>
          <Button variant="outline" size="sm" onClick={handleDownloadAllGroupsPdf}>Alle Gruppen als PDF herunterladen</Button>
```

- [ ] **Step 6: Update `GroupOverviewPage.test.tsx` for the renamed buttons**

Find `src/pages/GroupOverviewPage.test.tsx`, search for `'Diese Gruppe drucken'` and `'Alle Gruppen drucken'` button-name assertions, and update them to `'Diese Gruppe als PDF herunterladen'` / `'Alle Gruppen als PDF herunterladen'`. If tests assert on `window.open`/print behavior, remove those assertions (no popup window exists anymore) — replace with an assertion that clicking the button doesn't throw (react-pdf's `pdf().toBlob()` is async but the click handler itself should not throw synchronously).

- [ ] **Step 7: Delete the replaced HTML-print module**

```bash
rm src/lib/export/group-overview-export.ts src/lib/export/group-overview-export.test.ts
```

- [ ] **Step 8: Run the full test suite and typecheck**

Run: `npx vitest run src/pages/GroupOverviewPage.test.tsx src/lib/export/group-overview-pdf.test.ts && npx tsc --noEmit`
Expected: All PASS, no type errors, no remaining references to `group-overview-export` or `renderGroupOverviewHtml` (search with `grep -rn "group-overview-export\|renderGroupOverviewHtml" src/` — should return nothing)

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: replace group-overview print popup with a real PDF download

Replaces renderGroupOverviewHtml (HTML string + window.print() popup)
with buildGroupOverviewDocument/downloadGroupOverviewPdf, a native
react-pdf element tree using the shared blue/zebra theme -- same
pattern as the existing schedule PDF export. One Page per group,
matching the previous page-break-per-group behavior.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VmqdNxoJkbcNN2uj8e6nB7
EOF
)"
```

---

### Task 3: Swiss-overview PDF renderer

**Files:**
- Create: `src/lib/export/swiss-overview-pdf.ts`
- Test: `src/lib/export/swiss-overview-pdf.test.ts`
- Delete: `src/lib/export/swiss-overview-export.ts`, `src/lib/export/swiss-overview-export.test.ts` (in Step 7)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/export/swiss-overview-pdf.test.ts
import { describe, it, expect } from 'vitest'
import { isValidElement } from 'react'
import { buildSwissOverviewDocument } from './swiss-overview-pdf'
import { computeStandings } from '@/lib/standings'
import type { TournamentConfig, Schedule } from '@/types'

const tournament: TournamentConfig = {
  id: 't1', name: 'Einstufungsturnier', mode: 'swiss', swissRounds: 2, fields: 2,
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
    { id: 't1', name: 'Team A', logoUrl: '', color: '#000', contact: '', players: [] },
    { id: 't2', name: 'Team B', logoUrl: '', color: '#000', contact: '', players: [] },
  ],
}

const schedule: Schedule = {
  id: 's1', tournamentId: 't1', generatedAt: '2026-09-12T10:00:00Z',
  games: [
    {
      id: 'g1', homeTeamId: 't1', awayTeamId: 't2', stage: 'swiss', field: 1,
      scheduledStart: '09:30', scheduledEnd: '10:00', round: 1, gameNumber: 1,
      periodScores: [{ period: 1, homeScore: 20, awayScore: 15 }],
    },
  ],
  totalDurationMin: 30, estimatedEnd: '10:00',
}

describe('buildSwissOverviewDocument', () => {
  it('produces a valid react-pdf Document element', () => {
    const standings = computeStandings(tournament.teams, schedule.games, 1)
    const doc = buildSwissOverviewDocument(tournament, schedule, standings)
    expect(isValidElement(doc)).toBe(true)
  })

  it('marks a withdrawn team in the standings table', () => {
    const standings = computeStandings(tournament.teams, schedule.games, 1)
    standings[0].withdrawn = true
    const doc = buildSwissOverviewDocument(tournament, schedule, standings)
    const json = JSON.stringify(doc, (_key, value) =>
      isValidElement(value) ? { type: (value as { type: unknown }).type, props: (value as { props: unknown }).props } : value,
    )
    expect(json).toContain('zurückgezogen')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/export/swiss-overview-pdf.test.ts`
Expected: FAIL with "Cannot find module './swiss-overview-pdf'"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/export/swiss-overview-pdf.ts
import { pdf, Document, Page, Text, View } from '@react-pdf/renderer'
import { createElement } from 'react'
import type { TournamentConfig, Schedule } from '@/types'
import type { TeamStanding } from '@/lib/standings'
import { computeFinalScore } from '@/lib/standings'
import { getTeamAbbreviation } from '@/lib/utils'
import { computeRoundPageBreaks } from '@/lib/print-pagination'
import { pdfBaseStyles } from './pdf-theme'

function StandingsTable({ standings, teamMap }: {
  standings: TeamStanding[]
  teamMap: Map<string, TournamentConfig['teams'][number]>
}) {
  return createElement(View, { style: { marginBottom: 12 } },
    createElement(View, { style: pdfBaseStyles.tableHeaderRow },
      createElement(Text, { style: [pdfBaseStyles.tableHeaderCell, { width: '8%' }] }, '#'),
      createElement(Text, { style: [pdfBaseStyles.tableHeaderCell, { width: '40%' }] }, 'Team'),
      createElement(Text, { style: [pdfBaseStyles.tableHeaderCell, { width: '15%' }] }, 'Pkt'),
      createElement(Text, { style: [pdfBaseStyles.tableHeaderCell, { width: '17%' }] }, 'Buchholz'),
      createElement(Text, { style: [pdfBaseStyles.tableHeaderCell, { width: '20%' }] }, 'Diff'),
    ),
    ...standings.map((s, i) => {
      const team = teamMap.get(s.teamId)
      const name = team ? getTeamAbbreviation(team) : '?'
      return createElement(View, {
        key: s.teamId,
        style: i % 2 === 1 ? [pdfBaseStyles.tableRow, pdfBaseStyles.tableRowEven] : pdfBaseStyles.tableRow,
      },
        createElement(Text, { style: [pdfBaseStyles.cell, { width: '8%' }] }, String(i + 1)),
        createElement(Text, { style: [pdfBaseStyles.cell, { width: '40%' }] }, `${name}${s.withdrawn ? ' (zurückgezogen)' : ''}`),
        createElement(Text, { style: [pdfBaseStyles.cell, { width: '15%' }] }, String(s.points)),
        createElement(Text, { style: [pdfBaseStyles.cell, { width: '17%' }] }, String(s.buchholz)),
        createElement(Text, { style: [pdfBaseStyles.cell, { width: '20%' }] }, `${s.pointsDiff > 0 ? '+' : ''}${s.pointsDiff}`),
      )
    }),
  )
}

function RoundTable({ round, games, teamMap }: {
  round: number
  games: Schedule['games']
  teamMap: Map<string, TournamentConfig['teams'][number]>
}) {
  return createElement(View, { style: { marginBottom: 10 } },
    createElement(Text, { style: pdfBaseStyles.h3 }, `Runde ${round}`),
    createElement(View, { style: pdfBaseStyles.tableHeaderRow },
      createElement(Text, { style: [pdfBaseStyles.tableHeaderCell, { width: '8%' }] }, '#'),
      createElement(Text, { style: [pdfBaseStyles.tableHeaderCell, { width: '12%' }] }, 'Feld'),
      createElement(Text, { style: [pdfBaseStyles.tableHeaderCell, { width: '20%' }] }, 'Zeit'),
      createElement(Text, { style: [pdfBaseStyles.tableHeaderCell, { width: '60%' }] }, 'Paarung'),
    ),
    ...games.filter(g => g.round === round && g.field > 0).map((g, i) => {
      const homeTeam = g.homeTeamId ? teamMap.get(g.homeTeamId) : undefined
      const awayTeam = g.awayTeamId ? teamMap.get(g.awayTeamId) : undefined
      const home = homeTeam ? getTeamAbbreviation(homeTeam) : (g.homeLabel ?? '?')
      const away = awayTeam ? getTeamAbbreviation(awayTeam) : (g.awayLabel ?? '?')
      const timeOrScore = g.periodScores.length > 0
        ? (() => { const { home, away } = computeFinalScore(g); return `${home} : ${away}` })()
        : `${g.scheduledStart} – ${g.scheduledEnd}`
      return createElement(View, {
        key: g.id,
        style: i % 2 === 1 ? [pdfBaseStyles.tableRow, pdfBaseStyles.tableRowEven] : pdfBaseStyles.tableRow,
      },
        createElement(Text, { style: [pdfBaseStyles.cell, { width: '8%' }] }, String(g.gameNumber)),
        createElement(Text, { style: [pdfBaseStyles.cell, { width: '12%' }] }, `Feld ${g.field}`),
        createElement(Text, { style: [pdfBaseStyles.cell, { width: '20%' }] }, timeOrScore),
        createElement(Text, { style: [pdfBaseStyles.cell, { width: '60%' }] }, `${home} vs ${away}`),
      )
    }),
  )
}

export function buildSwissOverviewDocument(
  tournament: TournamentConfig,
  schedule: Schedule,
  standings: TeamStanding[],
) {
  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))
  const rounds = [...new Set(schedule.games.map(g => g.round))].sort((a, b) => a - b)
  const gamesPerRound = new Map(
    rounds.map(round => [round, schedule.games.filter(g => g.round === round && g.field > 0).length]),
  )
  const roundPageBreaks = computeRoundPageBreaks(rounds, gamesPerRound)

  // Group rounds into pages: a new page starts at round 1 and at every round marked by
  // computeRoundPageBreaks.
  const roundPages: number[][] = []
  for (const round of rounds) {
    if (roundPages.length === 0 || roundPageBreaks.has(round)) {
      roundPages.push([round])
    } else {
      roundPages[roundPages.length - 1].push(round)
    }
  }

  return createElement(Document, { title: `${tournament.name} — Turnierübersicht` },
    createElement(Page, { key: 'standings', size: 'A4', style: pdfBaseStyles.page },
      createElement(Text, { style: pdfBaseStyles.h1 }, tournament.name),
      createElement(Text, { style: pdfBaseStyles.h2 }, 'Tabelle'),
      createElement(StandingsTable, { standings, teamMap }),
    ),
    ...roundPages.map((pageRounds, i) => createElement(Page, { key: `rounds-${i}`, size: 'A4', style: pdfBaseStyles.page },
      i === 0 && createElement(Text, { style: pdfBaseStyles.h2 }, 'Zeitplan'),
      ...pageRounds.map(round => createElement(RoundTable, { key: round, round, games: schedule.games, teamMap })),
    )),
  )
}

export async function downloadSwissOverviewPdf(
  tournament: TournamentConfig,
  schedule: Schedule,
  standings: TeamStanding[],
): Promise<void> {
  const doc = buildSwissOverviewDocument(tournament, schedule, standings)
  const blob = await pdf(doc as Parameters<typeof pdf>[0]).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${tournament.name.replace(/\s+/g, '-')}-turnieruebersicht.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/export/swiss-overview-pdf.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Update `SwissOverviewPage.tsx` to use the new PDF download**

Replace:

```tsx
import { renderSwissOverviewHtml } from '@/lib/export/swiss-overview-export'
```

with:

```tsx
import { downloadSwissOverviewPdf } from '@/lib/export/swiss-overview-pdf'
```

Replace the `handlePrint` function body:

```tsx
  const handlePrint = () => {
    const html = renderSwissOverviewHtml(tournament, schedule, standings)
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
```

with:

```tsx
  const handleDownloadPdf = () => {
    void downloadSwissOverviewPdf(tournament, schedule, standings)
  }
```

And the button:

```tsx
        <Button onClick={handlePrint}>Drucken</Button>
```

with:

```tsx
        <Button onClick={handleDownloadPdf}>PDF herunterladen</Button>
```

- [ ] **Step 6: Update `SwissOverviewPage.test.tsx` for the renamed button**

Find `src/pages/SwissOverviewPage.test.tsx`, search for a `'Drucken'` button-name assertion and update it to `'PDF herunterladen'`. Remove/adjust any assertion on `window.open`/print behavior.

- [ ] **Step 7: Delete the replaced HTML-print module**

```bash
rm src/lib/export/swiss-overview-export.ts src/lib/export/swiss-overview-export.test.ts
```

- [ ] **Step 8: Run the full test suite and typecheck**

Run: `npx vitest run src/pages/SwissOverviewPage.test.tsx src/lib/export/swiss-overview-pdf.test.ts && npx tsc --noEmit`
Expected: All PASS, no type errors. Verify no remaining references: `grep -rn "swiss-overview-export\|renderSwissOverviewHtml" src/` returns nothing.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: replace swiss-overview print popup with a real PDF download

Replaces renderSwissOverviewHtml (HTML string + window.print() popup)
with buildSwissOverviewDocument/downloadSwissOverviewPdf. Reuses the
existing computeRoundPageBreaks logic to decide where a new react-pdf
Page starts, same threshold-based grouping as before.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VmqdNxoJkbcNN2uj8e6nB7
EOF
)"
```

---

### Task 4: Install `marked` and add the callout-block preprocessor

**Files:**
- Modify: `package.json` (add dependency)
- Create: `src/lib/markdown-tokens.ts`
- Test: `src/lib/markdown-tokens.test.ts`

- [ ] **Step 1: Install marked**

```bash
npm install marked@18.0.13
```

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/markdown-tokens.test.ts
import { describe, it, expect } from 'vitest'
import { tokenizeManualMarkdown } from './markdown-tokens'

describe('tokenizeManualMarkdown', () => {
  it('tokenizes a heading and a paragraph', () => {
    const tokens = tokenizeManualMarkdown('# Title\n\nSome text.\n')
    expect(tokens[0]).toMatchObject({ type: 'heading', depth: 1, text: 'Title' })
    expect(tokens.some(t => t.type === 'paragraph')).toBe(true)
  })

  it('converts a ::: callout block into a single callout token carrying its title and inner tokens', () => {
    const md = '::: callout Wichtiger Hinweis\nDies ist der Inhalt.\n:::\n'
    const tokens = tokenizeManualMarkdown(md)
    const callout = tokens.find(t => t.type === 'callout') as { type: string; title: string; tokens: { type: string }[] }
    expect(callout).toBeDefined()
    expect(callout.title).toBe('Wichtiger Hinweis')
    expect(callout.tokens.some(t => t.type === 'paragraph')).toBe(true)
  })

  it('leaves normal markdown outside a callout block untouched', () => {
    const md = '# Heading\n\n::: callout Note\nInside.\n:::\n\nAfter.\n'
    const tokens = tokenizeManualMarkdown(md)
    expect(tokens[0].type).toBe('heading')
    expect(tokens.some(t => t.type === 'callout')).toBe(true)
    expect(tokens.some(t => t.type === 'paragraph' && (t as { text?: string }).text === 'After.')).toBe(true)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/markdown-tokens.test.ts`
Expected: FAIL with "Cannot find module './markdown-tokens'"

- [ ] **Step 4: Write minimal implementation**

```ts
// src/lib/markdown-tokens.ts
import { marked, type Token } from 'marked'

export interface CalloutToken {
  type: 'callout'
  raw: string
  title: string
  tokens: Token[]
}

export type ManualToken = Token | CalloutToken

const CALLOUT_PATTERN = /^::: callout (.+)\n([\s\S]*?)\n:::$/gm

// marked has no native concept of a callout/admonition block, so callout regions are cut out
// of the raw markdown text before tokenizing (replaced by a unique placeholder line), then
// re-inserted as a single `callout` token whose own content is tokenized recursively -- this
// keeps normal markdown before/after the callout completely unaffected.
export function tokenizeManualMarkdown(markdown: string): ManualToken[] {
  const callouts: CalloutToken[] = []
  const withPlaceholders = markdown.replace(CALLOUT_PATTERN, (raw, title: string, body: string) => {
    const placeholder = `CALLOUT_PLACEHOLDER_${callouts.length}`
    callouts.push({ type: 'callout', raw, title, tokens: marked.lexer(body) })
    return placeholder
  })

  const rawTokens = marked.lexer(withPlaceholders)
  const result: ManualToken[] = []
  for (const token of rawTokens) {
    if (token.type === 'paragraph' && /^CALLOUT_PLACEHOLDER_\d+$/.test(token.text.trim())) {
      const index = Number(token.text.trim().replace('CALLOUT_PLACEHOLDER_', ''))
      result.push(callouts[index])
    } else {
      result.push(token)
    }
  }
  return result
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/markdown-tokens.test.ts`
Expected: PASS (3 tests). If the placeholder ends up wrapped differently by `marked` (e.g. as its own paragraph vs. merged with surrounding text), adjust the placeholder-detection regex in Step 4 to match what `marked.lexer()` actually produces — run `node -e "const {marked}=require('marked'); console.log(JSON.stringify(marked.lexer('Before\n\nCALLOUT_PLACEHOLDER_0\n\nAfter'),null,2))"` to inspect if the test fails unexpectedly.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/markdown-tokens.ts src/lib/markdown-tokens.test.ts
git commit -m "$(cat <<'EOF'
feat: add marked-based tokenizer with a callout-block extension

marked has no native admonition/callout concept, so ::: callout
Title\n...\n:::  blocks are cut out of the raw markdown before
tokenizing and re-inserted as a single callout token with its own
recursively-tokenized content -- this will back the manual page's
migration from JSX to a single markdown source.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VmqdNxoJkbcNN2uj8e6nB7
EOF
)"
```

---

### Task 5: Web-JSX renderer for manual tokens

**Files:**
- Create: `src/lib/manual-markdown-jsx.ts`
- Test: `src/lib/manual-markdown-jsx.test.tsx`

This renders `ManualToken[]` (from Task 4) to the same JSX shape `ManualPage.tsx` currently produces by hand, using the existing `Section`/`SubSection`/`Screenshot`/`Callout` visual components (still defined in `ManualPage.tsx` at this point — Task 8 wires them together).

- [ ] **Step 1: Write the failing test**

```tsx
// src/lib/manual-markdown-jsx.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { tokenizeManualMarkdown } from './markdown-tokens'
import { renderManualMarkdownToJsx } from './manual-markdown-jsx'

describe('renderManualMarkdownToJsx', () => {
  it('renders a level-2 heading, a paragraph with bold text, and a list', () => {
    const md = '## Section Title\n\nSome **bold** text.\n\n- item one\n- item two\n'
    const tokens = tokenizeManualMarkdown(md)
    render(<>{renderManualMarkdownToJsx(tokens)}</>)

    expect(screen.getByRole('heading', { name: 'Section Title', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('bold', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText('item one')).toBeInTheDocument()
    expect(screen.getByText('item two')).toBeInTheDocument()
  })

  it('renders an image token as an <img> with its alt text', () => {
    const md = '![Leere Teamübersicht](01-teams-leer.png)\n'
    const tokens = tokenizeManualMarkdown(md)
    render(<>{renderManualMarkdownToJsx(tokens)}</>)

    const img = screen.getByRole('img', { name: 'Leere Teamübersicht' })
    expect(img).toHaveAttribute('src', expect.stringContaining('01-teams-leer.png'))
  })

  it('renders a callout token with its title and body', () => {
    const md = '::: callout Hinweis\nDies ist wichtig.\n:::\n'
    const tokens = tokenizeManualMarkdown(md)
    render(<>{renderManualMarkdownToJsx(tokens)}</>)

    expect(screen.getByText('Hinweis')).toBeInTheDocument()
    expect(screen.getByText(/Dies ist wichtig/)).toBeInTheDocument()
  })

  it('renders a link with its href', () => {
    const md = '[Downloadlink](demos/example.json)\n'
    const tokens = tokenizeManualMarkdown(md)
    render(<>{renderManualMarkdownToJsx(tokens)}</>)

    expect(screen.getByRole('link', { name: 'Downloadlink' })).toHaveAttribute('href', expect.stringContaining('demos/example.json'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/manual-markdown-jsx.test.tsx`
Expected: FAIL with "Cannot find module './manual-markdown-jsx'"

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/lib/manual-markdown-jsx.ts
import type { ReactNode } from 'react'
import type { Tokens } from 'marked'
import type { ManualToken } from './markdown-tokens'

function renderInline(tokens: Tokens.Generic[]): ReactNode[] {
  return tokens.map((token, i) => {
    switch (token.type) {
      case 'strong':
        return <strong key={i}>{renderInline((token as Tokens.Strong).tokens)}</strong>
      case 'em':
        return <em key={i}>{renderInline((token as Tokens.Em).tokens)}</em>
      case 'link': {
        const link = token as Tokens.Link
        return <a key={i} href={link.href} className="text-brand-primary underline">{renderInline(link.tokens)}</a>
      }
      case 'text':
        return <span key={i}>{(token as Tokens.Text).text}</span>
      default:
        return null
    }
  })
}

function renderListItems(items: Tokens.ListItem[]): ReactNode[] {
  return items.map((item, i) => <li key={i}>{renderInline(item.tokens)}</li>)
}

export function renderManualMarkdownToJsx(tokens: ManualToken[]): ReactNode[] {
  return tokens.map((token, i) => {
    switch (token.type) {
      case 'heading': {
        const heading = token as Tokens.Heading
        const className = heading.depth === 2
          ? 'font-display text-xl uppercase text-brand-primary'
          : 'font-display text-base uppercase text-brand-primary-light'
        const id = heading.text.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-+|-+$/g, '')
        return heading.depth === 2
          ? <h2 key={i} id={id} className={className}>{heading.text}</h2>
          : <h3 key={i} id={id} className={className}>{heading.text}</h3>
      }
      case 'paragraph':
        return <p key={i}>{renderInline((token as Tokens.Paragraph).tokens)}</p>
      case 'list': {
        const list = token as Tokens.List
        const className = 'list-disc pl-6 space-y-1'
        return list.ordered
          ? <ol key={i} className="list-decimal pl-6 space-y-1">{renderListItems(list.items)}</ol>
          : <ul key={i} className={className}>{renderListItems(list.items)}</ul>
      }
      case 'image': {
        const image = token as Tokens.Image
        return (
          <img
            key={i}
            src={`${import.meta.env.BASE_URL}anleitung/${image.href}`}
            alt={image.text}
            className="rounded-md border border-border shadow-sm max-w-full"
          />
        )
      }
      case 'callout': {
        const callout = token as import('./markdown-tokens').CalloutToken
        return (
          <div key={i} className="rounded-md border border-brand-primary/30 bg-tint p-4 text-sm">
            <p className="font-semibold text-brand-primary mb-1">{callout.title}</p>
            <div>{renderManualMarkdownToJsx(callout.tokens as ManualToken[])}</div>
          </div>
        )
      }
      case 'space':
        return null
      default:
        return null
    }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/manual-markdown-jsx.test.tsx`
Expected: PASS (4 tests). If the heading `id` generation doesn't match expectations, note this is a placeholder scheme — Task 8 overrides ids explicitly per top-level section anyway (see Task 8), so exact auto-generated ids here are not load-bearing for anchors; adjust the test to match actual output rather than the reverse.

- [ ] **Step 5: Commit**

```bash
git add src/lib/manual-markdown-jsx.ts src/lib/manual-markdown-jsx.test.tsx
git commit -m "$(cat <<'EOF'
feat: add a manual-token-to-web-JSX renderer

Renders the ManualToken tree from markdown-tokens.ts to the same
visual shape ManualPage.tsx currently hand-writes: h2/h3 headings,
paragraphs with bold/italic/link inline formatting, lists, images,
and callout boxes.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VmqdNxoJkbcNN2uj8e6nB7
EOF
)"
```

---

### Task 6: react-pdf renderer for manual tokens

**Files:**
- Create: `src/lib/manual-markdown-pdf.ts`
- Test: `src/lib/manual-markdown-pdf.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/manual-markdown-pdf.test.ts
import { describe, it, expect } from 'vitest'
import { isValidElement } from 'react'
import { tokenizeManualMarkdown } from './markdown-tokens'
import { renderManualMarkdownToPdf } from './manual-markdown-pdf'

function toPlainJson(el: unknown): unknown {
  return JSON.stringify(el, (_key, value) =>
    isValidElement(value) ? { type: (value as { type: unknown }).type, props: (value as { props: unknown }).props } : value,
  )
}

describe('renderManualMarkdownToPdf', () => {
  it('renders a heading as a Text element and a paragraph as a Text element', () => {
    const tokens = tokenizeManualMarkdown('## Title\n\nBody text.\n')
    const elements = renderManualMarkdownToPdf(tokens, {})
    expect(elements.every(isValidElement)).toBe(true)
    expect(toPlainJson(elements)).toContain('Title')
    expect(toPlainJson(elements)).toContain('Body text.')
  })

  it('renders an image token using the provided data-URI map, with alt text as a visible caption', () => {
    const tokens = tokenizeManualMarkdown('![Leere Teamübersicht](01-teams-leer.png)\n')
    const elements = renderManualMarkdownToPdf(tokens, { '01-teams-leer.png': 'data:image/png;base64,AAAA' })
    const json = toPlainJson(elements)
    expect(json).toContain('data:image/png;base64,AAAA')
    expect(json).toContain('Leere Teamübersicht')
  })

  it('renders a callout token with a highlighted background', () => {
    const tokens = tokenizeManualMarkdown('::: callout Hinweis\nWichtig.\n:::\n')
    const elements = renderManualMarkdownToPdf(tokens, {})
    const json = toPlainJson(elements)
    expect(json).toContain('Hinweis')
    expect(json).toContain('Wichtig.')
    expect(json).toContain('#f0f7fc')
  })

  it('renders a list as one Text per item prefixed with a bullet', () => {
    const tokens = tokenizeManualMarkdown('- first\n- second\n')
    const elements = renderManualMarkdownToPdf(tokens, {})
    const json = toPlainJson(elements)
    expect(json).toContain('• first')
    expect(json).toContain('• second')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/manual-markdown-pdf.test.ts`
Expected: FAIL with "Cannot find module './manual-markdown-pdf'"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/manual-markdown-pdf.ts
import { Text, View, Image } from '@react-pdf/renderer'
import { createElement, type ReactElement } from 'react'
import type { Tokens } from 'marked'
import type { ManualToken, CalloutToken } from './markdown-tokens'
import { pdfBaseStyles, pdfColors } from './export/pdf-theme'

function renderInlineText(tokens: Tokens.Generic[]): ReactElement[] {
  return tokens.map((token, i) => {
    switch (token.type) {
      case 'strong':
        return createElement(Text, { key: i, style: { fontWeight: 'bold' } }, ...renderInlineText((token as Tokens.Strong).tokens))
      case 'em':
        return createElement(Text, { key: i, style: { fontStyle: 'italic' } }, ...renderInlineText((token as Tokens.Em).tokens))
      case 'link':
        return createElement(Text, { key: i, style: { textDecoration: 'underline' } }, ...renderInlineText((token as Tokens.Link).tokens))
      case 'text':
      default:
        return createElement(Text, { key: i }, (token as Tokens.Text).text ?? '')
    }
  })
}

export function renderManualMarkdownToPdf(tokens: ManualToken[], images: Record<string, string>): ReactElement[] {
  const elements: ReactElement[] = []
  tokens.forEach((token, i) => {
    switch (token.type) {
      case 'heading': {
        const heading = token as Tokens.Heading
        const style = heading.depth === 2 ? pdfBaseStyles.h2 : pdfBaseStyles.h3
        elements.push(createElement(Text, { key: i, style }, heading.text))
        break
      }
      case 'paragraph':
        elements.push(createElement(Text, { key: i, style: pdfBaseStyles.cell }, ...renderInlineText((token as Tokens.Paragraph).tokens)))
        break
      case 'list': {
        const list = token as Tokens.List
        elements.push(createElement(View, { key: i, style: { marginBottom: 6 } },
          ...list.items.map((item, itemIndex) => {
            const prefix = list.ordered ? `${(list.start || 1) + itemIndex}. ` : '• '
            return createElement(Text, { key: itemIndex, style: pdfBaseStyles.cell }, prefix, ...renderInlineText(item.tokens))
          }),
        ))
        break
      }
      case 'image': {
        const image = token as Tokens.Image
        const src = images[image.href]
        elements.push(createElement(View, { key: i, style: { marginBottom: 8 } },
          src ? createElement(Image, { src, style: { maxWidth: '100%' } }) : null,
          createElement(Text, { style: { fontSize: 8, color: pdfColors.textDark, marginTop: 2 } }, image.text),
        ))
        break
      }
      case 'callout': {
        const callout = token as CalloutToken
        elements.push(createElement(View, {
          key: i,
          style: { backgroundColor: pdfColors.zebra, borderRadius: 4, padding: 8, marginBottom: 8 },
        },
          createElement(Text, { style: { fontWeight: 'bold', color: pdfColors.brandBlue, marginBottom: 4, fontSize: 9 } }, callout.title),
          ...renderManualMarkdownToPdf(callout.tokens as ManualToken[], images),
        ))
        break
      }
      case 'space':
      default:
        break
    }
  })
  return elements
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/manual-markdown-pdf.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/manual-markdown-pdf.ts src/lib/manual-markdown-pdf.test.ts
git commit -m "$(cat <<'EOF'
feat: add a manual-token-to-react-pdf renderer

Mirrors manual-markdown-jsx.ts but targets react-pdf primitives:
headings/paragraphs/lists as styled Text/View, images embedded from a
pre-fetched data-URI map with the alt text rendered as a visible
caption underneath (react-pdf has no screen-reader-facing alt
attribute), and callouts as a tinted View box.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VmqdNxoJkbcNN2uj8e6nB7
EOF
)"
```

---

### Task 7: Write `src/content/manual.md` via careful transcription

**Files:**
- Create: `src/content/manual.md`

This task converts the 609 lines of JSX in `src/pages/ManualPage.tsx` (inside the `<div id="manual-content">` block, i.e. everything from the `<Section id="kurzreferenz"...>` through the closing `</Section>` of `id="import"`) into Markdown, then verifies the conversion is complete and correct against the existing `ManualPage.test.tsx` assertions (which will be re-pointed at the new rendering path in Task 8, but its assertions describe exactly what must survive the conversion unchanged).

- [ ] **Step 1: Read the full current manual content**

Read `src/pages/ManualPage.tsx` completely (already done during planning — see the plan's context). The content to convert is the JSX children of the 9 `<Section id="...">` blocks (`kurzreferenz`, `ueberblick`, `teams`, `konfiguration` with 2 nested `<SubSection>`s, `ergebnisse` with 3 nested `<SubSection>`s, `turnieruebersicht` with 1 nested `<SubSection>`, `aenderungsschutz`, `export`, `import`).

- [ ] **Step 2: Write `manual.md` by hand, following these exact conversion rules**

Because the JSX has irregular structure (inline `<strong>` mid-sentence, `{' '}` whitespace joins, nested nav nodes), a careful manual transcription cross-checked against the existing test assertions is more reliable here than a fully-automated AST-to-markdown script. Write `src/content/manual.md` directly, applying these rules to every JSX node currently in `ManualPage.tsx`'s `<div id="manual-content">` block:

- `<Section id="X" title="N. Title">` → `## N. Title` (with an explicit HTML anchor comment `<!-- #X -->` immediately after the heading line, so Task 8's ID-mapping step can locate it — see below)
- `<SubSection id="X" title="N.M Title">` → `### N.M Title` followed by `<!-- #X -->`
- `<p>...</p>` → a plain paragraph, blank line before/after
- `<strong>text</strong>` → `**text**`
- `<ul className="list-disc ..."><li>...</li></ul>` → `- ` bullet list
- `<ol className="list-decimal ..."><li>...</li></ol>` → `1. ` numbered list (use literal `1.` for every item; markdown renumbers automatically)
- `<Screenshot src="X.png" alt="Y" />` → `![Y](X.png)` on its own line
- `<Callout title="T">...</Callout>` → 
  ```
  ::: callout T
  ...(body, converted using the same paragraph/list/strong rules)...
  :::
  ```
- `<a href="...">text</a>` (external/demo links) → `[text](href)`
- Nested inline JSX like `<strong>„Team hinzufügen"</strong>` → `**„Team hinzufügen"**` (preserve the German guillemet-style quotes exactly as written in the source)

Because the anchor IDs matter (the table of contents links to them, and `ManualPage.test.tsx` asserts exact `href="#id"` values), add an explicit anchor comment after every `##`/`###` heading using the format `<!-- #id -->` with the exact same id string currently used in the JSX `id` prop. Task 8's renderer extracts this comment to set the rendered heading's `id` attribute (do not rely on auto-slugified ids from heading text, since several existing ids like `konfiguration-gruppenergebnisse` don't match a slugified version of their title).

Work through the file top to bottom; for the two large `<SubSection>` blocks with multiple `<Screenshot>`/`<Callout>` (`konfiguration-gruppen`, `turnieruebersicht-gruppentabellen`), keep every screenshot and callout — do not summarize or omit content.

- [ ] **Step 3: Verify no content was dropped**

Run this to count screenshots and headings in both the old and new source, and confirm the numbers match:

```bash
echo "Old JSX screenshots:"; grep -c '<Screenshot' src/pages/ManualPage.tsx
echo "New markdown images:"; grep -c '!\[' src/content/manual.md
echo "Old JSX Section/SubSection count:"; grep -cE '<(Section|SubSection) id=' src/pages/ManualPage.tsx
echo "New markdown ## / ### count:"; grep -cE '^(##|###) ' src/content/manual.md
echo "Old JSX Callout count:"; grep -c '<Callout' src/pages/ManualPage.tsx
echo "New markdown callout count:"; grep -c '^::: callout' src/content/manual.md
```

Expected: 29 / 29 screenshots, 9+6=15 / 15 headings, and matching callout counts (count `<Callout` occurrences in the source first — the plan does not hardcode this number since it wasn't tallied during planning; whatever the JSX count is, the markdown count must match exactly).

If any count mismatches, find the missing item by diffing section-by-section rather than guessing — do not proceed to Task 8 until they match.

- [ ] **Step 4: Commit**

```bash
git add src/content/manual.md
git commit -m "$(cat <<'EOF'
docs: migrate the user manual content to a single Markdown source

Transcribes ManualPage.tsx's 609 lines of hand-written JSX (9
sections, 6 subsections, 29 screenshots, callout boxes) into
src/content/manual.md, using a ::: callout Title ... ::: convention
for callout boxes and <!-- #id --> anchor comments after each heading
to preserve the existing table-of-contents anchor ids exactly.
ManualPage.tsx itself is not yet updated to use this file -- that's
Task 8.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VmqdNxoJkbcNN2uj8e6nB7
EOF
)"
```

---

### Task 8: Wire `ManualPage.tsx` to render from `manual.md`

**Files:**
- Modify: `src/pages/ManualPage.tsx`
- Modify: `src/lib/manual-markdown-jsx.ts` (add anchor-comment handling)

marked's lexer emits HTML comments as a separate `html` token type, positioned as a sibling right after the `heading` token (not nested inside it). This step teaches the renderer to associate a `html` comment token matching `<!-- #(\S+) -->` with the immediately preceding `heading` token.

- [ ] **Step 1: Write the failing test for anchor-id extraction**

```ts
// Add to src/lib/manual-markdown-jsx.test.tsx
it('assigns the id from a `<!-- #id -->` comment to the immediately preceding heading', () => {
  const md = '## Section Title\n<!-- #my-custom-id -->\n\nBody.\n'
  const tokens = tokenizeManualMarkdown(md)
  render(<>{renderManualMarkdownToJsx(tokens)}</>)
  expect(screen.getByRole('heading', { name: 'Section Title' })).toHaveAttribute('id', 'my-custom-id')
})
```

(Add the necessary import of `tokenizeManualMarkdown` if not already imported in this test file from Task 5.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/manual-markdown-jsx.test.tsx -t "assigns the id"`
Expected: FAIL — either the id doesn't match (still auto-slugified) or the comment leaks into rendered output.

- [ ] **Step 3: Implement anchor-id extraction in `renderManualMarkdownToJsx`**

Update `src/lib/manual-markdown-jsx.ts`: before the `switch` in `renderManualMarkdownToJsx`, scan for a following `html` token matching the anchor comment pattern, and skip rendering `html` tokens entirely (they're metadata, not content). Use `String.prototype.match()` (not `RegExp.prototype.exec()`, to keep a plain match-and-capture read) to pull the id out:

```ts
const ANCHOR_COMMENT = /^<!-- #(\S+) -->$/

export function renderManualMarkdownToJsx(tokens: ManualToken[]): ReactNode[] {
  const nodes: ReactNode[] = []
  tokens.forEach((token, i) => {
    if (token.type === 'html') return // anchor comments are consumed by the following check, never rendered
    if (token.type === 'heading') {
      const heading = token as Tokens.Heading
      const next = tokens[i + 1]
      const anchorMatch = next?.type === 'html' ? (next as Tokens.HTML).raw.trim().match(ANCHOR_COMMENT) : null
      const id = anchorMatch?.[1] ?? heading.text.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-+|-+$/g, '')
      const className = heading.depth === 2
        ? 'font-display text-xl uppercase text-brand-primary'
        : 'font-display text-base uppercase text-brand-primary-light'
      nodes.push(heading.depth === 2
        ? <h2 key={i} id={id} className={className}>{heading.text}</h2>
        : <h3 key={i} id={id} className={className}>{heading.text}</h3>)
      return
    }
    // ... rest of the existing switch cases from Task 5, unchanged, pushing to `nodes` instead of returning directly
  })
  return nodes
}
```

Restructure the existing `switch` from Task 5 to push into `nodes` inside this `forEach` instead of using `.map()`'s return value (needed because we now need lookahead to the next token for the heading case). Keep all other case bodies identical to Task 5's implementation.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/manual-markdown-jsx.test.tsx`
Expected: PASS (all tests from Task 5 plus the new one)

- [ ] **Step 5: Rewrite `ManualPage.tsx` as a thin markdown-driven wrapper**

Read the full current `src/pages/ManualPage.tsx` before editing (needed for the exact `TOC_ITEMS`/`TableOfContents`/back-to-top-button/PDF-button JSX to preserve). Replace the file's content-rendering section. Keep `TOC_ITEMS`, `TableOfContents`, the "Nach oben" button, and the top-level `<h1>` + PDF-download button exactly as they are today. Replace only:

```tsx
import { Button } from '@/components/ui/button'
import { openManualPrintWindow } from '@/lib/export/manual-print-export'

function Callout({ title, children }: { title: string; children: React.ReactNode }) {
  ...
}

function Screenshot({ src, alt }: { src: string; alt: string }) {
  ...
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  ...
}

function SubSection({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  ...
}
```

with:

```tsx
import { Button } from '@/components/ui/button'
import manualMarkdown from '@/content/manual.md?raw'
import { tokenizeManualMarkdown } from '@/lib/markdown-tokens'
import { renderManualMarkdownToJsx } from '@/lib/manual-markdown-jsx'
import { downloadManualPdf } from '@/lib/export/manual-pdf'
```

And replace the `<div id="manual-content" className="space-y-10">...609 lines of Section/SubSection...</div>` block with:

```tsx
      <div id="manual-content" className="space-y-10">
        {renderManualMarkdownToJsx(tokenizeManualMarkdown(manualMarkdown))}
      </div>
```

And replace the PDF-download button's handler:

```tsx
        <Button onClick={() => void openManualPrintWindow()} className="shrink-0">
          Als PDF herunterladen
        </Button>
```

with:

```tsx
        <Button onClick={() => void downloadManualPdf()} className="shrink-0">
          Als PDF herunterladen
        </Button>
```

- [ ] **Step 6: Run the pre-existing `ManualPage.test.tsx` unchanged**

Run: `npx vitest run src/pages/ManualPage.test.tsx`
Expected: PASS, unmodified — every assertion in this file (heading names, TOC hrefs, image count of 29, image srcs for specific filenames, PDF button, back-to-top button) must pass exactly as before. This is the regression gate for the whole migration.

If any assertion fails, the failure identifies precisely what's missing or different in `manual.md`/the renderer — fix the root cause (usually a missed anchor id, a missing screenshot, or a heading text mismatch) rather than editing the test.

- [ ] **Step 7: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If `?raw` imports aren't typed, confirm `src/vite-env.d.ts` still has `/// <reference types="vite/client" />` (it does, per Task investigation — no change needed here).

- [ ] **Step 8: Commit**

```bash
git add src/pages/ManualPage.tsx src/lib/manual-markdown-jsx.ts src/lib/manual-markdown-jsx.test.tsx
git commit -m "$(cat <<'EOF'
refactor: render ManualPage from the migrated manual.md source

ManualPage.tsx no longer hand-writes its 609 lines of Section/
SubSection/Screenshot/Callout JSX -- it loads manual.md as a raw
string, tokenizes it, and renders via renderManualMarkdownToJsx.
Heading ids are taken from <!-- #id --> anchor comments in the
markdown (not auto-slugified from heading text) so every existing
table-of-contents anchor keeps working unchanged. The pre-existing
ManualPage.test.tsx (heading names, TOC hrefs, 29 image sources)
passes unmodified, confirming the migration preserved the page's
rendered output exactly.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VmqdNxoJkbcNN2uj8e6nB7
EOF
)"
```

---

### Task 9: Manual PDF download + delete the old print module

**Files:**
- Create: `src/lib/export/manual-pdf.ts`
- Test: `src/lib/export/manual-pdf.test.ts`
- Delete: `src/lib/export/manual-print-export.ts`, `src/lib/export/manual-print-export.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/export/manual-pdf.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchImagesAsDataUris } from './manual-pdf'

describe('fetchImagesAsDataUris', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      blob: () => Promise.resolve(new Blob(['fake-image-bytes'], { type: 'image/png' })),
    })
  })

  it('fetches every referenced screenshot filename and returns a filename-to-data-URI map', async () => {
    const result = await fetchImagesAsDataUris(['01-teams-leer.png', '02-team-dialog-leer.png'])
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(Object.keys(result)).toEqual(['01-teams-leer.png', '02-team-dialog-leer.png'])
    expect(result['01-teams-leer.png']).toMatch(/^data:/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/export/manual-pdf.test.ts`
Expected: FAIL with "Cannot find module './manual-pdf'"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/export/manual-pdf.ts
import { pdf, Document, Page, Text, View } from '@react-pdf/renderer'
import { createElement } from 'react'
import manualMarkdown from '@/content/manual.md?raw'
import { tokenizeManualMarkdown, type ManualToken } from '@/lib/markdown-tokens'
import { renderManualMarkdownToPdf } from '@/lib/manual-markdown-pdf'
import { pdfBaseStyles } from './pdf-theme'

async function fileToDataUri(url: string): Promise<string> {
  const response = await fetch(url)
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function fetchImagesAsDataUris(filenames: string[]): Promise<Record<string, string>> {
  const base = import.meta.env.BASE_URL
  const entries = await Promise.all(
    filenames.map(async filename => {
      const dataUri = await fileToDataUri(`${base}anleitung/${filename}`)
      return [filename, dataUri] as const
    }),
  )
  return Object.fromEntries(entries)
}

function collectImageFilenames(tokens: ManualToken[]): string[] {
  const filenames: string[] = []
  for (const token of tokens) {
    if (token.type === 'image') filenames.push((token as { href: string }).href)
    if (token.type === 'callout') filenames.push(...collectImageFilenames((token as { tokens: ManualToken[] }).tokens))
  }
  return filenames
}

// Groups top-level tokens into per-section chunks (each starting at a depth-2 heading), so each
// section becomes its own non-wrapping react-pdf View -- keeps a section's heading and its first
// content together on one page instead of breaking immediately after the heading.
function groupIntoSections(tokens: ManualToken[]): ManualToken[][] {
  const sections: ManualToken[][] = []
  for (const token of tokens) {
    if (token.type === 'heading' && (token as { depth: number }).depth === 2) {
      sections.push([token])
    } else if (sections.length === 0) {
      sections.push([token])
    } else {
      sections[sections.length - 1].push(token)
    }
  }
  return sections
}

export async function downloadManualPdf(): Promise<void> {
  const tokens = tokenizeManualMarkdown(manualMarkdown)
  const images = await fetchImagesAsDataUris(collectImageFilenames(tokens))
  const sections = groupIntoSections(tokens)

  const doc = createElement(Document, { title: 'Nutzeranleitung: Basketball Turnier-Manager' },
    createElement(Page, { size: 'A4', style: pdfBaseStyles.page },
      createElement(Text, { style: pdfBaseStyles.h1 }, 'Nutzeranleitung: Basketball Turnier-Manager'),
      ...sections.map((sectionTokens, i) =>
        createElement(View, { key: i, wrap: false }, ...renderManualMarkdownToPdf(sectionTokens, images)),
      ),
    ),
  )

  const blob = await pdf(doc as Parameters<typeof pdf>[0]).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'nutzeranleitung-basketball-turnier-manager.pdf'
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/export/manual-pdf.test.ts`
Expected: PASS

- [ ] **Step 5: Delete the replaced print module**

```bash
rm src/lib/export/manual-print-export.ts src/lib/export/manual-print-export.test.ts
```

(`ManualPage.tsx` already stopped importing from it in Task 8, Step 5.)

- [ ] **Step 6: Run the full test suite and typecheck**

Run: `npm test -- --run && npx tsc --noEmit`
Expected: all tests pass, no type errors, no remaining references to the deleted module: `grep -rn "manual-print-export\|openManualPrintWindow" src/` returns nothing.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: replace the manual's print popup with a real PDF download

downloadManualPdf() tokenizes manual.md, fetches its screenshots as
data URIs, groups content into per-section (non-wrapping) react-pdf
Views so a section's heading stays with its first content across a
page break, and triggers a direct download -- same pattern as the
other three PDF exports. Deletes manual-print-export.ts, the last
remaining window.print()-popup code path in the app.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VmqdNxoJkbcNN2uj8e6nB7
EOF
)"
```

---

### Task 10: Retrofit tests onto the pre-existing schedule PDF export

**Files:**
- Modify: `src/lib/export/pdf-export.ts`
- Test: `src/lib/export/pdf-export.test.ts`

The schedule PDF export (`src/lib/export/pdf-export.ts`, used by `ExportPanel.tsx`) predates this plan and has no tests. This task closes that gap using the same element-tree-assertion pattern established in Tasks 2-3, without changing `pdf-export.ts`'s runtime behavior.

- [ ] **Step 1: Read the current implementation**

Read `src/lib/export/pdf-export.ts` in full (it's short, ~60 lines) to confirm its exact exported function name (`downloadPdf`) and internal structure (`SchedulePdf` is a non-exported function building the `Document`). Since `SchedulePdf` isn't exported, the test must go through the fact that `downloadPdf` builds the element tree internally — to make this element tree testable without triggering an actual browser download in the test, export a `buildSchedulePdfDocument` function analogous to `buildGroupOverviewDocument`/`buildSwissOverviewDocument` from Tasks 2-3.

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/export/pdf-export.test.ts
import { describe, it, expect } from 'vitest'
import { isValidElement } from 'react'
import { buildSchedulePdfDocument } from './pdf-export'
import type { TournamentConfig, Schedule } from '@/types'

const tournament: TournamentConfig = {
  id: 't1', name: 'Testturnier', mode: 'round-robin', fields: 1,
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
    { id: 't1', name: 'Team A', logoUrl: '', color: '#000', contact: '', players: [] },
    { id: 't2', name: 'Team B', logoUrl: '', color: '#000', contact: '', players: [] },
  ],
}

const schedule: Schedule = {
  id: 's1', tournamentId: 't1', generatedAt: '2026-09-12T10:00:00Z',
  games: [
    {
      id: 'g1', homeTeamId: 't1', awayTeamId: 't2', stage: 'group', field: 1,
      scheduledStart: '09:30', scheduledEnd: '10:00', round: 1, gameNumber: 1,
      periodScores: [],
    },
  ],
  totalDurationMin: 30, estimatedEnd: '10:00',
}

describe('buildSchedulePdfDocument', () => {
  it('produces a valid react-pdf Document element containing the tournament name and game count', () => {
    const doc = buildSchedulePdfDocument(tournament, schedule)
    expect(isValidElement(doc)).toBe(true)
    const json = JSON.stringify(doc, (_key, value) =>
      isValidElement(value) ? { type: (value as { type: unknown }).type, props: (value as { props: unknown }).props } : value,
    )
    expect(json).toContain('Testturnier')
    expect(json).toContain('1 Spiele')
  })

  it('shows each game\'s teams, field, and scheduled time', () => {
    const doc = buildSchedulePdfDocument(tournament, schedule)
    const json = JSON.stringify(doc, (_key, value) =>
      isValidElement(value) ? { type: (value as { type: unknown }).type, props: (value as { props: unknown }).props } : value,
    )
    expect(json).toContain('Team A vs Team B')
    expect(json).toContain('Feld 1')
    expect(json).toContain('09:30–10:00')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/export/pdf-export.test.ts`
Expected: FAIL with "buildSchedulePdfDocument is not exported" or similar

- [ ] **Step 4: Export `buildSchedulePdfDocument` from `pdf-export.ts`**

In `src/lib/export/pdf-export.ts`, keep `SchedulePdf` as-is, but add a new exported function that wraps it (matching the naming convention from Tasks 2-3), and have `downloadPdf` call it:

```ts
export function buildSchedulePdfDocument(tournament: TournamentConfig, schedule: Schedule) {
  return SchedulePdf({ tournament, schedule }) as React.ReactElement<
    import('@react-pdf/renderer').DocumentProps
  >
}

export async function downloadPdf(tournament: TournamentConfig, schedule: Schedule): Promise<void> {
  const doc = buildSchedulePdfDocument(tournament, schedule)
  const instance = pdf(doc)
  const blob = await instance.toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${tournament.name.replace(/\s+/g, '-')}-zeitplan.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
```

(This removes the inline `const doc = SchedulePdf(...) as ...` cast from `downloadPdf` and replaces it with a call to the new exported function — no behavior change.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/export/pdf-export.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Run full test suite and typecheck**

Run: `npm test -- --run && npx tsc --noEmit`
Expected: all pass, no type errors

- [ ] **Step 7: Commit**

```bash
git add src/lib/export/pdf-export.ts src/lib/export/pdf-export.test.ts
git commit -m "$(cat <<'EOF'
test: add unit test coverage for the schedule PDF export

pdf-export.ts (used by ExportPanel's "PDF herunterladen" button) had
no tests since it was added. Exports buildSchedulePdfDocument
(previously an inline, untestable expression inside downloadPdf) so
its react-pdf element tree can be asserted on directly, following the
same pattern as group-overview-pdf.ts and swiss-overview-pdf.ts.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VmqdNxoJkbcNN2uj8e6nB7
EOF
)"
```

---

### Task 11: E2E coverage for all four PDF downloads

**Files:**
- Create: `e2e/pdf-export.spec.ts`

Follows the pattern of `e2e/export.spec.ts` (UC6 JSON export, already in `main`). Each test triggers a real download and asserts the file is a non-empty, valid PDF (checks the `%PDF-` byte signature).

- [ ] **Step 1: Check `e2e/helpers.ts` for existing setup utilities**

Read `e2e/helpers.ts` to confirm `addTeam`/`selectMode` signatures (already seen in `e2e/export.spec.ts`). If group-mode or swiss-mode setup helpers don't exist yet, they'll need equivalents — check first with `grep -n "export " e2e/helpers.ts`.

- [ ] **Step 2: Write the E2E tests**

```ts
// e2e/pdf-export.spec.ts
import { test, expect } from '@playwright/test'
import { addTeam, selectMode } from './helpers'

async function expectValidPdfDownload(downloadPromise: Promise<import('@playwright/test').Download>) {
  const download = await downloadPromise
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  const buffer = Buffer.concat(chunks)
  expect(buffer.length).toBeGreaterThan(0)
  expect(buffer.subarray(0, 5).toString('utf-8')).toBe('%PDF-')
}

test('organizer downloads the schedule as a PDF', async ({ page }) => {
  await page.goto('/teams')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await addTeam(page, 'Team A')
  await addTeam(page, 'Team B')

  await page.getByRole('link', { name: 'Konfiguration' }).click()
  await selectMode(page, 'Jeder gegen Jeden')
  await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
  await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()

  await page.getByRole('link', { name: 'Export' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'PDF herunterladen' }).click()
  await expectValidPdfDownload(downloadPromise)
})

test('organizer downloads the manual as a PDF', async ({ page }) => {
  await page.goto('/anleitung')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Als PDF herunterladen' }).click()
  await expectValidPdfDownload(downloadPromise)
})

test('organizer downloads the swiss-system overview as a PDF', async ({ page }) => {
  await page.goto('/teams')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await addTeam(page, 'Team A')
  await addTeam(page, 'Team B')
  await addTeam(page, 'Team C')
  await addTeam(page, 'Team D')

  await page.getByRole('link', { name: 'Konfiguration' }).click()
  await selectMode(page, 'Einstufungsturnier (Schweizer System)')
  await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
  await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()

  await page.getByRole('link', { name: 'Turnierübersicht' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'PDF herunterladen' }).click()
  await expectValidPdfDownload(downloadPromise)
})

test('organizer downloads a single group overview as a PDF', async ({ page }) => {
  await page.goto('/teams')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await addTeam(page, 'Team A')
  await addTeam(page, 'Team B')
  await addTeam(page, 'Team C')
  await addTeam(page, 'Team D')

  await page.getByRole('link', { name: 'Konfiguration' }).click()
  await selectMode(page, 'Gruppenphase + Endrunde')
  // Set 2 groups if the config UI requires it -- check the actual Konfiguration page controls
  // for "Anzahl Gruppen" (a number input or select) if this step fails; adjust accordingly.
  await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
  await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()

  await page.getByRole('link', { name: 'Gruppentabellen' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Diese Gruppe als PDF herunterladen' }).click()
  await expectValidPdfDownload(downloadPromise)
})
```

Note: the last test's group-count setup is left as a checkpoint comment because the exact "Anzahl Gruppen" control wasn't inspected during planning — when implementing, read `src/pages/ConfigurationPage.tsx` (or wherever group count is configured) to fill in the real interaction, following the existing pattern from other group-mode E2E tests (search `grep -rln "Gruppenphase + Endrunde" e2e/` for a reference test to copy the setup from).

- [ ] **Step 3: Run the E2E tests**

Run: `npx playwright test e2e/pdf-export.spec.ts`
Expected: 4 passed. If a selector doesn't match (e.g. a button label changed during Tasks 2/3/9, or the group-count setup needs adjustment), fix the test to match the real UI — don't weaken the assertions.

- [ ] **Step 4: Commit**

```bash
git add e2e/pdf-export.spec.ts
git commit -m "$(cat <<'EOF'
test: add E2E coverage for all four PDF export downloads

Covers the schedule, manual, swiss-overview, and group-overview PDF
downloads end-to-end: each test captures the real browser download
and verifies it's a non-empty file starting with the %PDF- byte
signature, following the same page.waitForEvent('download') pattern
established for the UC6 JSON export.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VmqdNxoJkbcNN2uj8e6nB7
EOF
)"
```

---

### Task 12: Final verification and PR

**Files:**
- None (verification and memory-update only)

- [ ] **Step 1: Run the complete test suite one final time**

```bash
npm test -- --run
npx playwright test
npx tsc --noEmit
```

Expected: all green.

- [ ] **Step 2: Confirm no dead code remains**

```bash
grep -rn "window.print\|openManualPrintWindow\|renderGroupOverviewHtml\|renderSwissOverviewHtml" src/
```

Expected: no output.

- [ ] **Step 3: Update the `pdf_export_followup` memory to mark it resolved**

(This step is for whoever executes the plan to remember doing, not a git change — update the memory file at `/Users/oliver-marcuseder/.claude/projects/-Users-oliver-marcuseder-01-vibe-coding-00-Basektball-08-Fibalon-Baskets-02-turnier-manager/memory/pdf_export_followup.md` to note the feature is complete, referencing this plan and the spec.)

- [ ] **Step 4: Open a PR**

Follow the repo's existing PR conventions (squash-mergeable, CI must pass: Unit tests / Typecheck / Build / E2E tests / CodeQL). Title suggestion: "feat: replace print-popup exports with real PDF downloads (group/swiss/manual)".

---

## Self-Review Notes

- **Spec coverage:** Shared theme (Task 1) ✓, group-overview PDF (Task 2) ✓, swiss-overview PDF (Task 3) ✓, marked + callout preprocessor (Task 4) ✓, manual web-JSX renderer (Task 5) ✓, manual react-pdf renderer (Task 6) ✓, manual.md migration (Task 7) ✓, ManualPage wiring + anchor-id preservation (Task 8) ✓, manual PDF download + cleanup (Task 9) ✓, schedule-PDF test retrofit (Task 10) ✓, E2E coverage for all four (Task 11) ✓, A11y measures (document metadata, alt-text-as-caption, contrast, reading order) are folded into Tasks 2/3/6/9's implementations per the spec — contrast values are already verified in the spec itself, so no separate task needed for that.
- **Placeholder scan:** no TBD/TODO left; the two explicitly-flagged "adjust at implementation time" spots (Task 4 Step 5's placeholder-detection regex, Task 11 Step 2's group-count UI interaction) are flagged with a concrete fallback action (inspect actual token output / inspect actual page markup), not silent gaps.
- **Type consistency:** `downloadGroupOverviewPdf(tournament, schedule, sections: GroupOverviewSection[])`, `downloadSwissOverviewPdf(tournament, schedule, standings: TeamStanding[])`, `downloadManualPdf()`, `downloadPdf(tournament, schedule)` (unchanged) are used consistently between their defining task and their call-site update task. `ManualToken`/`CalloutToken` types from Task 4 are imported identically in Tasks 5, 6, 8, 9.
