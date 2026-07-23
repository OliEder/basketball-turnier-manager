import type { TournamentConfig, Schedule } from '@/types'
import JSZip from 'jszip'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildHtml(tournament: TournamentConfig, schedule: Schedule): string {
  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))

  const rows = schedule.games.map(g => {
    const home = escapeHtml(teamMap.get(g.homeTeamId)?.name ?? '?')
    const away = escapeHtml(teamMap.get(g.awayTeamId)?.name ?? '?')
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
  <title>${escapeHtml(tournament.name)}</title>
  <style>
    body { font-family: 'Aller', system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; color: #002751; }
    h1 { font-size: 1.75rem; font-weight: bold; color: #004174; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { padding: 0.5rem 1rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { font-weight: 600; background: #004174; color: #fff; }
    tr:nth-child(even) td { background: #f0f7fc; }
  </style>
</head>
<body>
  <h1>${escapeHtml(tournament.name)}</h1>
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
