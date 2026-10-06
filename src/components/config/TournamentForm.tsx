import { useTournamentStore } from '@/store/tournament-store'
import { TextInput, Select, Banner } from '@bbv/dss-design-system/react'
import { calcGameDurationMin, timeToMinutes, addMinutes } from '@/lib/game-duration'
import type { TournamentMode } from '@/types'

export default function TournamentForm({ disabled = false }: { disabled?: boolean }) {
  const { tournament, setTournamentName, setMode, setFields, setFinalsBracketSize, setSwissRounds } = useTournamentStore()

  const suggestedRounds = Math.max(1, Math.ceil(Math.log2(tournament.teams.length || 1)))
  const rounds = tournament.swissRounds ?? suggestedRounds

  return (
    <div className="space-y-4 max-w-md">
      <TextInput
        id="tourney-name"
        label="Turniername"
        value={tournament.name}
        onChange={e => setTournamentName(e.target.value)}
        placeholder="z.B. Verbands-Einstufungsturnier 2026"
        disabled={disabled}
      />
      <Select
        id="tourney-mode"
        label="Turniermodus"
        value={tournament.mode}
        onChange={e => setMode(e.target.value as TournamentMode)}
        disabled={disabled}
        options={[
          { value: 'round-robin', label: 'Jeder gegen Jeden' },
          { value: 'round-robin+finals', label: 'Gruppenphase + Endrunde' },
          { value: 'swiss', label: 'Einstufungsturnier (Schweizer System)' },
        ]}
      />
      {tournament.mode === 'round-robin+finals' && (
        <Select
          id="tourney-bracket-size"
          label="Finalrunde"
          value={String(tournament.finalsBracketSize ?? 4)}
          onChange={e => setFinalsBracketSize(Number(e.target.value) as 2 | 4)}
          disabled={disabled}
          options={[
            { value: '4', label: 'Halbfinale + Finale' },
            { value: '2', label: 'Nur Finale' },
          ]}
        />
      )}
      {tournament.mode === 'swiss' && (
        <div className="space-y-2">
          <TextInput
            id="swiss-rounds"
            label="Anzahl Runden"
            type="number"
            min={1}
            value={rounds}
            onChange={e => setSwissRounds(Number(e.target.value))}
            disabled={disabled}
            help={`Vorschlag nach Standard-Schweizer-Formel: ${suggestedRounds} Runden — bei Bedarf anpassbar.`}
          />
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
              <Banner severity={fitsInVenue ? 'info' : 'danger'}>
                Geschätzte Gesamtdauer: {totalMin} Minuten.
                {!fitsInVenue && ' Das passt nicht in die verfügbare Hallenzeit — Rundenzahl reduzieren oder mehr Felder einplanen.'}
              </Banner>
            )
          })()}
        </div>
      )}
      <Select
        id="tourney-fields"
        label="Anzahl Felder"
        value={String(tournament.fields)}
        onChange={e => setFields(Number(e.target.value))}
        disabled={disabled}
        options={[1, 2, 3, 4, 5, 6].map(n => ({ value: String(n), label: `${n} ${n === 1 ? 'Feld' : 'Felder'}` }))}
      />
    </div>
  )
}
