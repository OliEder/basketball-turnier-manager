import { useTournamentStore } from '@/store/tournament-store'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { calcGameDurationMin, timeToMinutes, addMinutes } from '@/lib/game-duration'
import type { TournamentMode } from '@/types'

export default function TournamentForm() {
  const { tournament, setTournamentName, setMode, setFields, setFinalsBracketSize, setSwissRounds } = useTournamentStore()

  const suggestedRounds = Math.max(1, Math.ceil(Math.log2(tournament.teams.length || 1)))
  const rounds = tournament.swissRounds ?? suggestedRounds

  return (
    <div className="space-y-4 max-w-md">
      <div className="space-y-1">
        <Label htmlFor="tourney-name">Turniername</Label>
        <Input
          id="tourney-name"
          value={tournament.name}
          onChange={e => setTournamentName(e.target.value)}
          placeholder="z.B. Fibalon Sommer-Cup 2026"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="tourney-mode">Turniermodus</Label>
        <Select value={tournament.mode} onValueChange={v => setMode(v as TournamentMode)}>
          <SelectTrigger id="tourney-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="round-robin">Jeder gegen Jeden</SelectItem>
            <SelectItem value="round-robin+finals">Jeder gegen Jeden + Finale</SelectItem>
            <SelectItem value="swiss">Einstufungsturnier (Schweizer System)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {tournament.mode === 'round-robin+finals' && (
        <div className="space-y-1">
          <Label htmlFor="tourney-bracket-size">Finalrunde</Label>
          <Select
            value={String(tournament.finalsBracketSize ?? 4)}
            onValueChange={v => setFinalsBracketSize(Number(v) as 2 | 4)}
          >
            <SelectTrigger id="tourney-bracket-size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="4">Halbfinale + Finale</SelectItem>
              <SelectItem value="2">Nur Finale</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      {tournament.mode === 'swiss' && (
        <div className="space-y-1">
          <Label htmlFor="swiss-rounds">Anzahl Runden</Label>
          <Input
            id="swiss-rounds"
            type="number"
            min={1}
            value={rounds}
            onChange={e => setSwissRounds(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">
            Vorschlag nach Standard-Schweizer-Formel: {suggestedRounds} Runden — bei Bedarf anpassbar.
          </p>
          {(() => {
            const gameDuration = calcGameDurationMin(tournament.gameSettings)
            const gamesPerRound = Math.floor(tournament.teams.length / 2)
            const roundsWorthOfSlots = Math.max(1, Math.ceil(gamesPerRound / tournament.fields))
            const roundDurationMin = roundsWorthOfSlots * (gameDuration + tournament.gameSettings.bufferBetweenGamesMin)
            const totalMin = rounds * roundDurationMin + (rounds - 1) * tournament.gameSettings.breakBetweenRoundsMin
            const venueOpen = tournament.venue.availabilityWindows[0]?.start ?? '09:00'
            const venueClose = tournament.venue.availabilityWindows[0]?.end ?? '20:00'
            const firstStart = addMinutes(venueOpen, tournament.venue.setupBufferMin)
            const availabilityEnd = addMinutes(venueClose, -tournament.venue.teardownBufferMin)
            const fitsInVenue = timeToMinutes(firstStart) + totalMin <= timeToMinutes(availabilityEnd)
            return (
              <Alert>
                <AlertDescription className={fitsInVenue ? '' : 'text-red-600'}>
                  Geschätzte Gesamtdauer: {totalMin} Minuten.
                  {!fitsInVenue && ' Das passt nicht in die verfügbare Hallenzeit — Rundenzahl reduzieren oder mehr Felder einplanen.'}
                </AlertDescription>
              </Alert>
            )
          })()}
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="tourney-fields">Anzahl Felder</Label>
        <Select value={String(tournament.fields)} onValueChange={v => setFields(Number(v))}>
          <SelectTrigger id="tourney-fields">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4].map(n => (
              <SelectItem key={n} value={String(n)}>{n} {n === 1 ? 'Feld' : 'Felder'}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
