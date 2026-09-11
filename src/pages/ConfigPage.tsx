import TournamentForm from '@/components/config/TournamentForm'
import GameSettingsForm from '@/components/config/GameSettingsForm'
import VenueForm from '@/components/venue/VenueForm'
import BlackoutList from '@/components/venue/BlackoutList'
import { useTournamentStore } from '@/store/tournament-store'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function ConfigPage() {
  const { tournament, schedule, generateAndSaveSchedule } = useTournamentStore()

  const canGenerate = tournament.teams.length >= 2

  return (
    <div className="space-y-8">
      <h1 className="text-2xl text-brand-primary">Turnierkonfiguration</h1>
      <section className="space-y-4">
        <h2 className="text-lg text-brand-primary-light">Allgemein</h2>
        <TournamentForm />
      </section>
      <section className="space-y-4">
        <h2 className="text-lg text-brand-primary-light">Spieleinstellungen</h2>
        <GameSettingsForm />
      </section>
      <section className="space-y-4">
        <h2 className="text-lg text-brand-primary-light">Halle</h2>
        <VenueForm />
        <BlackoutList />
      </section>
      <section className="space-y-4">
        <h2 className="text-lg text-brand-primary-light">Spielplan generieren</h2>
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
      </section>
    </div>
  )
}
