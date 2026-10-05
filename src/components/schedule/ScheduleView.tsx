import { useTournamentStore } from '@/store/tournament-store'
import { Banner } from '@bbv/dss-design-system/react'
import GameRow from './GameRow'

export default function ScheduleView() {
  const { schedule } = useTournamentStore()

  if (!schedule) {
    return (
      <Banner>
        Bitte zuerst einen Zeitplan generieren (Seite „Konfiguration“).
      </Banner>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {schedule.games.length} Spiele · Ende ca. {schedule.estimatedEnd}
      </p>

      {schedule.games.length === 0 && (
        <Banner severity="warn" role="status">
          Kein Zeitplan möglich — Halle zu kurz oder zu viele Sperrzeiten.
        </Banner>
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
