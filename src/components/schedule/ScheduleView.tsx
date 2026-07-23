import { useTournamentStore } from '@/store/tournament-store'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import GameRow from './GameRow'

export default function ScheduleView() {
  const { tournament, schedule, generateAndSaveSchedule } = useTournamentStore()

  const canGenerate = tournament.teams.length >= 2

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          {schedule && (
            <p className="text-sm text-muted-foreground">
              {schedule.games.length} Spiele · Ende ca. {schedule.estimatedEnd}
            </p>
          )}
        </div>
        <Button onClick={generateAndSaveSchedule} disabled={!canGenerate}>
          Zeitplan generieren
        </Button>
      </div>

      {!canGenerate && (
        <Alert>
          <AlertDescription>Mindestens 2 Teams erforderlich.</AlertDescription>
        </Alert>
      )}

      {schedule && schedule.games.length === 0 && (
        <Alert>
          <AlertDescription>Kein Zeitplan möglich — Halle zu kurz oder zu viele Sperrzeiten.</AlertDescription>
        </Alert>
      )}

      {schedule && schedule.games.length > 0 && (
        <div className="border border-border rounded-md p-4 bg-card">
          {schedule.games.map(game => (
            <GameRow key={game.id} game={game} />
          ))}
        </div>
      )}
    </div>
  )
}
