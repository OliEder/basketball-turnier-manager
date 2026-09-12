import { useTournamentStore } from '@/store/tournament-store'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TeamNameDisplay } from '@/components/teams/TeamNameDisplay'
import { computeFinalStandings } from '@/lib/final-standings'

export default function FinalStandingsPage() {
  const { tournament, schedule } = useTournamentStore()

  if (!schedule) {
    return (
      <Alert>
        <AlertDescription>Bitte zuerst einen Zeitplan generieren (Seite „Konfiguration“).</AlertDescription>
      </Alert>
    )
  }

  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))
  const standings = computeFinalStandings(tournament.teams, schedule.games)

  if (standings.length === 0) {
    return (
      <Alert>
        <AlertDescription>Noch keine Endrunden-Ergebnisse vorhanden.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl text-brand-primary">Endstand</h1>
      <table className="w-full border-collapse">
        <tbody>
          {standings.map(s => (
            <tr key={s.teamId} className="border-b border-border last:border-0">
              <td className="py-1 pr-2 font-medium w-12">{s.place}.</td>
              <td className="py-1 pr-2">
                {teamMap.get(s.teamId) && <TeamNameDisplay team={teamMap.get(s.teamId)!} />}
              </td>
              <td className="py-1 pr-2 text-xs text-muted-foreground">
                {s.pending ? 'ausstehend' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
