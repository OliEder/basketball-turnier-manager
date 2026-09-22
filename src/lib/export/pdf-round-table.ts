import { Text, View } from '@react-pdf/renderer'
import { createElement } from 'react'
import type { TournamentConfig, Schedule } from '@/types'
import { computeFinalScore } from '@/lib/standings'
import { getTeamAbbreviation } from '@/lib/utils'
import { pdfBaseStyles } from './pdf-theme'

// Shared by group-overview-pdf.ts and swiss-overview-pdf.ts: both render one round's games as a
// table, with the same column layout, zebra-striping, and played-score-vs-scheduled-time cell
// logic. Extracted here so the two exports can't silently drift from each other.
export function RoundTable({ round, games, teamMap }: {
  round: number
  games: Schedule['games']
  teamMap: Map<string, TournamentConfig['teams'][number]>
}) {
  return createElement(View, { key: round, style: { marginBottom: 10 } },
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
