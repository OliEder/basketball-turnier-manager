import { useEffect } from 'react'
import { useTournamentStore } from '@/store/tournament-store'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { suggestGroupCount } from '@/lib/group-suggestion'
import { TeamNameDisplay } from '@/components/teams/TeamNameDisplay'

export default function GroupAssignmentForm({ disabled = false }: { disabled?: boolean }) {
  const { tournament, setGroupCount, setDoubleRoundRobin, setTeamGroup } = useTournamentStore()
  const doubleRoundRobin = tournament.doubleRoundRobin ?? false
  const suggestedGroupCount = suggestGroupCount(tournament.teams.length || 1, doubleRoundRobin)
  const groupCount = tournament.groupCount ?? suggestedGroupCount
  const groupLetters = Array.from({ length: groupCount }, (_, i) => String.fromCharCode(65 + i))

  // Commits the suggested value into the store as soon as it's displayed. Without this, the
  // input's displayed value comes from the ?? fallback while tournament.groupCount stays
  // undefined — if the organizer's intended value happens to equal the suggestion (a common
  // case), typing/confirming it produces no visible DOM change, so React's controlled-input
  // change tracking never fires onChange and groupCount is never actually written to the store.
  // Any UI gated on "groupCount > 1" (e.g. the Endrunden-Variante section) would then silently
  // never appear despite the field showing the correct number.
  useEffect(() => {
    if (tournament.groupCount === undefined && tournament.teams.length > 0) {
      setGroupCount(suggestedGroupCount)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament.groupCount, tournament.teams.length, suggestedGroupCount])

  return (
    <div className="space-y-4 max-w-md">
      <div className="space-y-1">
        <Label htmlFor="group-count">Anzahl Gruppen</Label>
        <Input
          id="group-count"
          type="number"
          min={1}
          value={groupCount}
          onChange={e => {
            const parsed = Number(e.target.value)
            if (Number.isInteger(parsed) && parsed >= 1) {
              setGroupCount(parsed)
            }
          }}
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">
          Vorschlag: {suggestedGroupCount} Gruppen (ca. {Math.round(tournament.teams.length / suggestedGroupCount)} Teams je Gruppe) — bei Bedarf anpassbar.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <input
          id="double-round-robin"
          type="checkbox"
          checked={doubleRoundRobin}
          onChange={e => setDoubleRoundRobin(e.target.checked)}
          disabled={disabled}
        />
        <Label htmlFor="double-round-robin">Mit Rückspiel (Hin- und Rückrunde)</Label>
      </div>
      <div className="space-y-2">
        {tournament.teams.map(team => (
          <div key={team.id} className="flex items-center justify-between gap-3">
            <TeamNameDisplay team={team} className="text-sm" />
            <select
              aria-label={`Gruppe für ${team.name}`}
              className="border border-border rounded-sm px-2 py-1 text-sm"
              value={team.groupId ?? 'A'}
              onChange={e => setTeamGroup(team.id, e.target.value)}
              disabled={disabled}
            >
              {groupLetters.map(letter => (
                <option key={letter} value={letter}>Gruppe {letter}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}
