import { pdf, Document, Page, Text, View } from '@react-pdf/renderer'
import { createElement } from 'react'
import type { TournamentConfig, Schedule } from '@/types'
import type { TeamStanding } from '@/lib/standings'
import { getTeamAbbreviation } from '@/lib/utils'
import { computeRoundPageBreaks } from '@/lib/print-pagination'
import { pdfBaseStyles } from './pdf-theme'
import { RoundTable } from './pdf-round-table'

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
      StandingsTable({ standings, teamMap }),
    ),
    ...roundPages.map((pageRounds, i) => createElement(Page, { key: `rounds-${i}`, size: 'A4', style: pdfBaseStyles.page },
      i === 0 && createElement(Text, { style: pdfBaseStyles.h2 }, 'Zeitplan'),
      ...pageRounds.map(round => RoundTable({ round, games: schedule.games, teamMap })),
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
