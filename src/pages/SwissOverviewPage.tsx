import { useTournamentStore } from '@/store/tournament-store'
import { computeStandings } from '@/lib/standings'
import { renderSwissOverviewHtml } from '@/lib/export/swiss-overview-export'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import GameRow from '@/components/schedule/GameRow'
import { getTeamAbbreviation } from '@/lib/utils'

export default function SwissOverviewPage() {
  const { tournament, schedule } = useTournamentStore()

  if (!schedule) {
    return (
      <Alert>
        <AlertDescription>Bitte zuerst einen Zeitplan generieren (Seite „Konfiguration“).</AlertDescription>
      </Alert>
    )
  }

  const totalRounds = tournament.swissRounds ?? 1
  const standings = computeStandings(tournament.teams, schedule.games, totalRounds)
  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))
  const rounds = [...new Set(schedule.games.map(g => g.round))].sort((a, b) => a - b)

  const teamAbbrev = (teamId: string) => {
    const team = teamMap.get(teamId)
    return team ? getTeamAbbreviation(team) : '?'
  }

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

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={handlePrint}>Drucken</Button>
      </div>
      <div>
        <h2 className="font-display text-lg uppercase mb-2">Tabelle</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-sm text-muted-foreground border-b border-border">
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">Team</th>
              <th className="py-1 pr-2">Pkt</th>
              <th className="py-1 pr-2">Buchholz</th>
              <th className="py-1 pr-2">Diff</th>
              <th className="py-1 pr-2">S-U-N</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <tr key={s.teamId} className="border-b border-border last:border-0">
                <td className="py-1 pr-2">{i + 1}</td>
                <td className="py-1 pr-2 font-medium" title={teamMap.get(s.teamId)?.name}>
                  {teamAbbrev(s.teamId)}
                  {s.withdrawn && <span className="text-muted-foreground text-xs ml-1">(ausgeschieden)</span>}
                </td>
                <td className="py-1 pr-2">{s.points}</td>
                <td className="py-1 pr-2">{s.buchholz}</td>
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
              {schedule.games
                .filter(g => g.round === round && g.field > 0)
                .map(game => <GameRow key={game.id} game={game} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
