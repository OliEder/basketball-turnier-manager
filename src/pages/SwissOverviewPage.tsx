import { getCurrentSwissRound, isRoundFullyEvaluated, useTournamentStore } from '@/store/tournament-store'
import { computeStandings } from '@/lib/standings'
import { downloadSwissOverviewPdf } from '@/lib/export/swiss-overview-pdf'
import { computeRoundPageBreaks } from '@/lib/print-pagination'
import { Button, Table, type TableColumn } from '@bbv/dss-design-system/react'
import GameRow from '@/components/schedule/GameRow'
import { TeamNameDisplay } from '@/components/teams/TeamNameDisplay'
import { ScheduleRequired } from '@/components/shared/ScheduleRequired'

const STANDINGS_COLUMNS: TableColumn[] = [
  { key: 'place', label: '#', width: '3rem' },
  { key: 'team', label: 'Team' },
  { key: 'points', label: 'Pkt', align: 'right' },
  { key: 'buchholz', label: 'Buchholz', align: 'right' },
  { key: 'diff', label: 'Diff', align: 'right' },
]

function TableOfContents({ rounds }: { rounds: number[] }) {
  return (
    <nav aria-label="Inhalt" className="rounded-md border border-border bg-tint p-4 text-sm">
      <p className="font-semibold text-brand-primary mb-2">Inhalt</p>
      <ul className="space-y-1">
        <li>
          <a href="#tabelle" className="text-brand-primary hover:underline">Tabelle</a>
        </li>
        {rounds.map(round => (
          <li key={round}>
            <a href={`#runde-${round}`} className="text-brand-primary hover:underline">Runde {round}</a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default function SwissOverviewPage() {
  const { tournament, schedule } = useTournamentStore()

  if (!schedule) {
    return <ScheduleRequired />
  }

  const currentRound = getCurrentSwissRound(schedule.games)
  const lastCompletedRound = currentRound > 0 && isRoundFullyEvaluated(schedule.games, currentRound)
    ? currentRound
    : Math.max(0, currentRound - 1)
  const standings = computeStandings(tournament.teams, schedule.games, lastCompletedRound)
  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))
  const rounds = [...new Set(schedule.games.map(g => g.round))].sort((a, b) => a - b)
  const gamesPerRound = new Map(
    rounds.map(round => [round, schedule.games.filter(g => g.round === round && g.field > 0).length]),
  )
  const roundPageBreaks = computeRoundPageBreaks(rounds, gamesPerRound)

  const handleDownloadPdf = () => {
    void downloadSwissOverviewPdf(tournament, schedule, standings)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={handleDownloadPdf}>PDF herunterladen</Button>
      </div>

      <TableOfContents rounds={rounds} />

      <div>
        <h2 id="tabelle" className="font-display text-lg uppercase mb-2">Tabelle</h2>
        <p className="text-xs text-muted-foreground mb-2">
          Sortierung: 1. Punkte, 2. Buchholz-Zahl, 3. Korbdifferenz. Die Buchholz-Zahl ist die Summe der
          Punkte aller bisherigen Gegner (zeigt, wie stark die bisherigen Gegner abgeschnitten haben; bei
          einem Freilos zählen die eigenen Punkte, bei einem Gegner, der zurückgezogen wurde, zählt die
          Partie nicht mit).
        </p>
        <Table density="compact" caption="Tabelle" columns={STANDINGS_COLUMNS}>
          {standings.map((s, i) => (
            <tr key={s.teamId}>
              <td>{i + 1}</td>
              <td>
                <div className="flex items-center gap-1">
                  <TeamNameDisplay team={teamMap.get(s.teamId)!} />
                  {s.withdrawn && <span className="dss-chip dss-chip--err dss-chip--mono shrink-0">zurückgezogen</span>}
                </div>
              </td>
              <td className="num lead">{s.points}</td>
              <td className="num">{s.buchholz}</td>
              <td className="num">{s.pointsDiff > 0 ? '+' : ''}{s.pointsDiff}</td>
            </tr>
          ))}
        </Table>
      </div>

      <div className="print:break-before-page">
        <h2 className="font-display text-lg uppercase mb-2">Zeitplan</h2>
        {rounds.map(round => (
          <div key={round} className="mb-4">
            <h3
              id={`runde-${round}`}
              className={`text-sm font-semibold text-muted-foreground mb-1${roundPageBreaks.has(round) ? ' print:break-before-page' : ''}`}
            >
              Runde {round}
            </h3>
            <div className="border border-border rounded-md p-4 bg-card">
              {schedule.games
                .filter(g => g.round === round && g.field > 0)
                .map(game => <GameRow key={game.id} game={game} showResult />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
