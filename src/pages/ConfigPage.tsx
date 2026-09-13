import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TournamentForm from '@/components/config/TournamentForm'
import GroupAssignmentForm from '@/components/config/GroupAssignmentForm'
import FinalsVariantForm from '@/components/config/FinalsVariantForm'
import GameSettingsForm from '@/components/config/GameSettingsForm'
import VenueForm from '@/components/venue/VenueForm'
import BlackoutList from '@/components/venue/BlackoutList'
import { LockedSectionGate } from '@/components/config/LockedSectionGate'
import { DestructiveConfirmDialog } from '@/components/ui/destructive-confirm-dialog'
import { useTournamentStore } from '@/store/tournament-store'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { parseTournamentImport } from '@/lib/import/json-import'
import { downloadJson } from '@/lib/export/json-export'
import type { TournamentConfig, Schedule } from '@/types'

type ConfirmTarget = 'tournament' | 'venue' | 'regenerate' | 'import' | 'reset' | null

export default function ConfigPage() {
  const navigate = useNavigate()
  const { tournament, schedule, generateAndSaveSchedule, isTournamentLocked, importTournament, resetTournament } = useTournamentStore()
  const locked = isTournamentLocked()

  const [tournamentUnlocked, setTournamentUnlocked] = useState(false)
  const [venueUnlocked, setVenueUnlocked] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null)
  const [pendingImport, setPendingImport] = useState<{ tournament: TournamentConfig; schedule: Schedule | null } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const needsFinalsVariant = tournament.mode === 'round-robin+finals' && (tournament.groupCount ?? 1) > 1 && !tournament.finalsVariant
  const canGenerate = tournament.teams.length >= 2 && !needsFinalsVariant

  const handleGenerateClick = () => {
    if (locked) {
      setConfirmTarget('regenerate')
    } else {
      generateAndSaveSchedule()
    }
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImportError(null)
    const text = await file.text()
    const result = parseTournamentImport(text)
    if (!result.ok) {
      setImportError(result.error)
      return
    }
    if (locked) {
      setPendingImport({ tournament: result.tournament, schedule: result.schedule })
      setConfirmTarget('import')
    } else {
      importTournament(result.tournament, result.schedule)
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
      {tournament.mode === 'round-robin+finals' && (
        <section className="space-y-4">
          <h2 className="text-lg text-brand-primary-light">Gruppen</h2>
          <LockedSectionGate locked={locked} unlocked={tournamentUnlocked} onUnlock={() => setConfirmTarget('tournament')}>
            {(disabled) => <GroupAssignmentForm disabled={disabled} />}
          </LockedSectionGate>
        </section>
      )}
      {tournament.mode === 'round-robin+finals' && (tournament.groupCount ?? 1) > 1 && (
        <section className="space-y-4">
          <h2 className="text-lg text-brand-primary-light">Endrunden-Variante</h2>
          <LockedSectionGate locked={locked} unlocked={tournamentUnlocked} onUnlock={() => setConfirmTarget('tournament')}>
            {(disabled) => <FinalsVariantForm disabled={disabled} />}
          </LockedSectionGate>
        </section>
      )}
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

        {tournament.teams.length < 2 && (
          <Alert>
            <AlertDescription>Mindestens 2 Teams erforderlich.</AlertDescription>
          </Alert>
        )}

        {needsFinalsVariant && (
          <Alert>
            <AlertDescription>
              Bitte zuerst eine Endrunden-Variante auswählen (Abschnitt „Endrunden-Variante" oben) — bei mehreren Gruppen kann sonst kein sinnvoller Spielplan für die Endrunde erzeugt werden.
            </AlertDescription>
          </Alert>
        )}

        {schedule && schedule.games.length === 0 && (
          <Alert>
            <AlertDescription>Kein Zeitplan möglich — Halle zu kurz oder zu viele Sperrzeiten.</AlertDescription>
          </Alert>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg text-brand-primary-light">Turnier importieren</h2>
        <div className="space-y-1">
          <Button type="button" onClick={() => fileInputRef.current?.click()}>
            JSON importieren
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            aria-label="JSON importieren"
            className="sr-only"
            onChange={handleFileSelected}
          />
        </div>
        {importError && (
          <Alert>
            <AlertDescription>{importError}</AlertDescription>
          </Alert>
        )}
        {tournament.name && (
          <p className="text-sm text-muted-foreground">Aktuelles Turnier: {tournament.name}</p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg text-brand-primary-light">Turnier zurücksetzen</h2>
        <Button type="button" variant="destructive" onClick={() => setConfirmTarget('reset')}>
          Turnier zurücksetzen
        </Button>
      </section>

      <DestructiveConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => { if (!open) setConfirmTarget(null) }}
        title="Änderung am laufenden Turnier"
        description={
          confirmTarget === 'regenerate'
            ? 'Der Zeitplan wurde bereits gespielt. Neu generieren verwirft die aktuelle Rundenstruktur — bereits erfasste Ergebnisse können dadurch inkonsistent werden.'
            : confirmTarget === 'import'
            ? 'Das aktuelle Turnier läuft bereits (mindestens ein Ergebnis wurde erfasst). Ein Import ersetzt es vollständig durch den Inhalt der ausgewählten Datei.'
            : confirmTarget === 'reset'
            ? 'Das aktuelle Turnier wird vollständig gelöscht. Vorher wird automatisch eine JSON-Sicherungsdatei heruntergeladen.'
            : 'Das Turnier läuft bereits (mindestens ein Ergebnis wurde erfasst). Diese Änderung kann den weiteren Turnierverlauf beeinträchtigen.'
        }
        confirmWord={confirmTarget === 'reset' ? 'LÖSCHEN' : 'ÄNDERN'}
        onConfirm={() => {
          if (confirmTarget === 'tournament') setTournamentUnlocked(true)
          if (confirmTarget === 'venue') setVenueUnlocked(true)
          if (confirmTarget === 'regenerate') generateAndSaveSchedule()
          if (confirmTarget === 'import' && pendingImport) {
            importTournament(pendingImport.tournament, pendingImport.schedule)
            setPendingImport(null)
          }
          if (confirmTarget === 'reset') {
            downloadJson(tournament, schedule)
            resetTournament()
            navigate('/teams')
          }
          setConfirmTarget(null)
        }}
      />
    </div>
  )
}
