import { useTournamentStore } from '@/store/tournament-store'
import { Alert, AlertDescription } from '@/components/ui/alert'
import GameRow from './GameRow'

export default function ScheduleView() {
  const { schedule } = useTournamentStore()

  if (!schedule) {
    return (
      <Alert>
        <AlertDescription>Bitte zuerst einen Zeitplan generieren (Seite „Konfiguration“).</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {schedule.games.length} Spiele · Ende ca. {schedule.estimatedEnd}
      </p>

      {schedule.games.length === 0 && (
        <Alert>
          <AlertDescription>Kein Zeitplan möglich — Halle zu kurz oder zu viele Sperrzeiten.</AlertDescription>
        </Alert>
      )}

      {schedule.games.length > 0 && (
        <div className="border border-border rounded-md p-4 bg-card">
          {schedule.games.map(game => (
            <GameRow key={game.id} game={game} />
          ))}
        </div>
      )}
    </div>
  )
}
