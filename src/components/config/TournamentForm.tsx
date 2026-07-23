import { useTournamentStore } from '@/store/tournament-store'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import type { TournamentMode } from '@/types'

export default function TournamentForm() {
  const { tournament, setTournamentName, setMode, setFields } = useTournamentStore()

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
          </SelectContent>
        </Select>
      </div>
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
