import type { TournamentConfig, Schedule } from '@/types'
import type { TeamStanding } from '@/lib/standings'
import { computeFinalScore } from '@/lib/standings'
import { getTeamAbbreviation } from '@/lib/utils'
import { computeRoundPageBreaks } from '@/lib/print-pagination'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function renderSwissOverviewHtml(
  tournament: TournamentConfig,
  schedule: Schedule,
  standings: TeamStanding[],
): string {
  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))

  const standingsRows = standings.map((s, i) => {
    const team = teamMap.get(s.teamId)
    const displayName = team ? getTeamAbbreviation(team) : '?'
    const fullName = team?.name ?? '?'
    return `<tr>
    <td>${i + 1}</td>
    <td title="${escapeHtml(fullName)}">${escapeHtml(displayName)}${s.withdrawn ? ' (zurückgezogen)' : ''}</td>
    <td>${s.points}</td>
    <td>${s.buchholz}</td>
    <td>${s.pointsDiff > 0 ? '+' : ''}${s.pointsDiff}</td>
  </tr>`
  }).join('\n')

  const rounds = [...new Set(schedule.games.map(g => g.round))].sort((a, b) => a - b)
  const gamesPerRound = new Map(
    rounds.map(round => [round, schedule.games.filter(g => g.round === round && g.field > 0).length]),
  )
  const roundPageBreaks = computeRoundPageBreaks(rounds, gamesPerRound)

  const tocRounds = rounds.map(round => `<li><a href="#runde-${round}">Runde ${round}</a></li>`).join('\n')

  const scheduleSections = rounds.map(round => {
    const rows = schedule.games
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
    const breakStyle = roundPageBreaks.has(round) ? ' style="page-break-before: always"' : ''
    return `<h3 id="runde-${round}"${breakStyle}>Runde ${round}</h3>
      <table><thead><tr><th>#</th><th>Feld</th><th>Zeit</th><th>Paarung</th></tr></thead>
      <tbody>${rows}</tbody></table>`
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
    nav.toc { border: 1px solid rgba(0, 65, 116, 0.3); background: #f0f7fc; border-radius: 6px; padding: 1rem; margin-bottom: 1.5rem; font-size: 0.875rem; }
    nav.toc p { font-weight: 600; color: #004174; margin: 0 0 0.5rem; }
    nav.toc ul { list-style: none; margin: 0; padding: 0; }
    nav.toc li { margin: 0.25rem 0; }
    nav.toc a { color: #004174; text-decoration: none; }
    nav.toc a:hover { text-decoration: underline; }
    @media print {
      body { margin: 0; max-width: none; }
      h1 { font-size: 1.4rem; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(tournament.name)}</h1>
  <nav class="toc" aria-label="Inhalt">
    <p>Inhalt</p>
    <ul>
      <li><a href="#tabelle">Tabelle</a></li>
      ${tocRounds}
    </ul>
  </nav>
  <h2 id="tabelle">Tabelle</h2>
  <p style="font-size: 0.8rem; color: #64748b; margin: -0.25rem 0 0.5rem;">
    Sortierung: 1. Punkte, 2. Buchholz-Zahl, 3. Korbdifferenz. Die Buchholz-Zahl ist die Summe der Punkte aller bisherigen Gegner
    (zeigt, wie stark die bisherigen Gegner abgeschnitten haben; bei einem Freilos zählen die eigenen Punkte, bei einem Gegner,
    der zurückgezogen wurde, zählt die Partie nicht mit).
  </p>
  <table>
    <thead><tr><th>#</th><th>Team</th><th>Pkt</th><th>Buchholz</th><th>Diff</th></tr></thead>
    <tbody>${standingsRows}</tbody>
  </table>
  <h2 style="page-break-before: always">Zeitplan</h2>
  ${scheduleSections}
</body>
</html>`
}
