import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { createElement } from 'react'
import type { TournamentConfig, Schedule } from '@/types'
import { pdfBaseStyles, pdfColors } from './pdf-theme'

// Column widths are specific to this export's 4-column table and have no shared equivalent in
// pdf-theme.ts; the colors, headings, and table row/cell styles below all come from the shared
// theme so this export stays visually consistent with the other three PDF exports.
const styles = StyleSheet.create({
  subtitle: { fontSize: 11, color: pdfColors.textDark, marginBottom: 20 },
  col1: { width: '8%' },
  col2: { width: '12%' },
  col3: { width: '20%' },
  col4: { width: '60%' },
})

function SchedulePdf({ tournament, schedule }: { tournament: TournamentConfig; schedule: Schedule }) {
  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))
  return createElement(Document, {},
    createElement(Page, { size: 'A4', style: pdfBaseStyles.page },
      createElement(View, {},
        createElement(Text, { style: pdfBaseStyles.h1 }, tournament.name),
        createElement(Text, { style: styles.subtitle },
          `${schedule.games.length} Spiele · Ende ca. ${schedule.estimatedEnd}`
        ),
        createElement(View, { style: pdfBaseStyles.tableHeaderRow },
          createElement(Text, { style: [pdfBaseStyles.tableHeaderCell, styles.col1] }, '#'),
          createElement(Text, { style: [pdfBaseStyles.tableHeaderCell, styles.col2] }, 'Feld'),
          createElement(Text, { style: [pdfBaseStyles.tableHeaderCell, styles.col3] }, 'Zeit'),
          createElement(Text, { style: [pdfBaseStyles.tableHeaderCell, styles.col4] }, 'Paarung'),
        ),
        ...schedule.games.map((g, i) => {
          const home = g.homeTeamId ? (teamMap.get(g.homeTeamId)?.name ?? '?') : (g.homeLabel ?? '?')
          const away = g.awayTeamId ? (teamMap.get(g.awayTeamId)?.name ?? '?') : (g.awayLabel ?? '?')
          return createElement(View, {
            key: g.id,
            style: i % 2 === 1 ? [pdfBaseStyles.tableRow, pdfBaseStyles.tableRowEven] : pdfBaseStyles.tableRow,
          },
            createElement(Text, { style: [pdfBaseStyles.cell, styles.col1] }, String(g.gameNumber)),
            createElement(Text, { style: [pdfBaseStyles.cell, styles.col2] }, `Feld ${g.field}`),
            createElement(Text, { style: [pdfBaseStyles.cell, styles.col3] }, `${g.scheduledStart}–${g.scheduledEnd}`),
            createElement(Text, { style: [pdfBaseStyles.cell, styles.col4] }, `${home} vs ${away}`),
          )
        }),
      )
    )
  )
}

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
