import { pdf, Document, Page, Text, View } from '@react-pdf/renderer'
import { createElement } from 'react'
import type { TournamentConfig, Schedule } from '@/types'
import type { GroupStanding } from '@/lib/group-standings'
import { getTeamAbbreviation } from '@/lib/utils'
import { pdfBaseStyles } from './pdf-theme'
import { RoundTable } from './pdf-round-table'

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
        StandingsTable({ standings, teamMap }),
        ...rounds.map(round => RoundTable({ round, games: groupGames, teamMap })),
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
