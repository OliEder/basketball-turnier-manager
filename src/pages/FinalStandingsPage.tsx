import { useTournamentStore } from '@/store/tournament-store'
import { EmptyState, Table, type TableColumn } from '@bbv/dss-design-system/react'
import { TeamNameDisplay } from '@/components/teams/TeamNameDisplay'
import { computeFinalStandings, computeEndrunde1Standings } from '@/lib/final-standings'
import { ScheduleRequired } from '@/components/shared/ScheduleRequired'

const COLUMNS: TableColumn[] = [
  { key: 'place', label: 'Platz', width: '3rem' },
  { key: 'team', label: 'Team' },
  { key: 'status', label: 'Status' },
]

export default function FinalStandingsPage() {
  const { tournament, schedule } = useTournamentStore()

  if (!schedule) {
    return <ScheduleRequired />
  }

  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))
  const standings = tournament.finalsVariant === 'endrunde-1'
    ? computeEndrunde1Standings(tournament.teams, schedule.games)
    : computeFinalStandings(tournament.teams, schedule.games)

  if (standings.length === 0) {
    return <EmptyState title="Noch keine Endrunden-Ergebnisse vorhanden." />
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl text-fg">Endstand</h1>
      <Table density="compact" caption="Endstand" columns={COLUMNS}>
        {standings.map(s => (
          <tr key={s.teamId}>
            <td>{s.place}.</td>
            <td>{teamMap.get(s.teamId) && <TeamNameDisplay team={teamMap.get(s.teamId)!} />}</td>
            <td className="text-xs text-mute">{s.pending ? 'ausstehend' : ''}</td>
          </tr>
        ))}
      </Table>
    </div>
  )
}
