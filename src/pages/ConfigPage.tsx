import { useState } from 'react'
import TournamentForm from '@/components/config/TournamentForm'
import GameSettingsForm from '@/components/config/GameSettingsForm'
import VenueForm from '@/components/venue/VenueForm'
import BlackoutList from '@/components/venue/BlackoutList'
import { LockedSectionGate } from '@/components/config/LockedSectionGate'
import { DestructiveConfirmDialog } from '@/components/ui/destructive-confirm-dialog'
import { useTournamentStore } from '@/store/tournament-store'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

type ConfirmTarget = 'tournament' | 'venue' | 'regenerate' | null

export default function ConfigPage() {
  const { tournament, schedule, generateAndSaveSchedule, isTournamentLocked } = useTournamentStore()
  const locked = isTournamentLocked()

  const [tournamentUnlocked, setTournamentUnlocked] = useState(false)
  const [venueUnlocked, setVenueUnlocked] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null)

  const canGenerate = tournament.teams.length >= 2

  const handleGenerateClick = () => {
    if (locked) {
      setConfirmTarget('regenerate')
    } else {
      generateAndSaveSchedule()
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl text-brand-primary">Turnierkonfiguration</h1>
      <section className="space-y-4">
        <h2 className="text-lg text-brand-primary-light">Allgemein</h2>
        <LockedSectionGate locked={locked} unlocked={tournamentUnlocked} onUnlock={() => setConfirmTarget('tournament')}>
          {(disabled) => <TournamentForm disabled={disabled} />}
        </LockedSectionGate>
      </section>
      <section className="space-y-4">
        <h2 className="text-lg text-brand-primary-light">Spieleinstellungen</h2>
        <LockedSectionGate locked={locked} unlocked={tournamentUnlocked} onUnlock={() => setConfirmTarget('tournament')}>
          {(disabled) => <GameSettingsForm disabled={disabled} />}
        </LockedSectionGate>
      </section>
      <section className="space-y-4">
        <h2 className="text-lg text-brand-primary-light">Halle</h2>
        <LockedSectionGate locked={locked} unlocked={venueUnlocked} onUnlock={() => setConfirmTarget('venue')}>
          {(disabled) => (
            <>
              <VenueForm disabled={disabled} />
              <BlackoutList disabled={disabled} />
            </>
          )}
        </LockedSectionGate>
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
          <Button onClick={handleGenerateClick} disabled={!canGenerate}>
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

      <DestructiveConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => { if (!open) setConfirmTarget(null) }}
        title="Änderung am laufenden Turnier"
        description={
          confirmTarget === 'regenerate'
            ? 'Der Zeitplan wurde bereits gespielt. Neu generieren verwirft die aktuelle Rundenstruktur — bereits erfasste Ergebnisse können dadurch inkonsistent werden.'
            : 'Das Turnier läuft bereits (mindestens ein Ergebnis wurde erfasst). Diese Änderung kann den weiteren Turnierverlauf beeinträchtigen.'
        }
        confirmWord="ÄNDERN"
        onConfirm={() => {
          if (confirmTarget === 'tournament') setTournamentUnlocked(true)
          if (confirmTarget === 'venue') setVenueUnlocked(true)
          if (confirmTarget === 'regenerate') generateAndSaveSchedule()
          setConfirmTarget(null)
        }}
      />
    </div>
  )
}
