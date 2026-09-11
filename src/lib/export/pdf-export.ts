import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { createElement } from 'react'
import type { TournamentConfig, Schedule } from '@/types'

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 8, color: '#004174' },
  subtitle: { fontSize: 11, color: '#1a4b76', marginBottom: 20 },
  tableHeader: { flexDirection: 'row', borderBottom: '2px solid #004174', paddingBottom: 4, marginBottom: 4 },
  tableRow: { flexDirection: 'row', borderBottom: '1px solid #e2e8f0', paddingVertical: 5 },
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
          const home = g.homeTeamId ? (teamMap.get(g.homeTeamId)?.name ?? '?') : (g.homeLabel ?? '?')
          const away = g.awayTeamId ? (teamMap.get(g.awayTeamId)?.name ?? '?') : (g.awayLabel ?? '?')
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
  const doc = SchedulePdf({ tournament, schedule }) as React.ReactElement<
    import('@react-pdf/renderer').DocumentProps
  >
  const instance = pdf(doc)
  const blob = await instance.toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${tournament.name.replace(/\s+/g, '-')}-zeitplan.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
