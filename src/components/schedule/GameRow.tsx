import { useTournamentStore } from '@/store/tournament-store'
import { Input } from '@/components/ui/input'
import ConflictBadge from './ConflictBadge'
import { overlapsBlackout } from '@/lib/game-duration'
import type { Game } from '@/types'

interface Props {
  game: Game
}

export default function GameRow({ game }: Props) {
  const { tournament, updateGameTime } = useTournamentStore()
  const teams = tournament.teams
  const home = teams.find(t => t.id === game.homeTeamId)
  const away = teams.find(t => t.id === game.awayTeamId)

  const hasBlackoutConflict = tournament.venue.blackoutPeriods.some(b =>
    overlapsBlackout(game.scheduledStart, game.scheduledEnd, b)
  )

  return (
    <div className="flex items-center gap-4 py-3 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground w-6">#{game.gameNumber}</span>
      <span className="text-sm font-mono w-8 text-center bg-tint rounded-sm px-1">F{game.field}</span>
      <Input
        type="time"
        value={game.scheduledStart}
        onChange={e => updateGameTime(game.id, e.target.value)}
        className="w-28 font-mono"
        aria-label={`Startzeit Spiel ${game.gameNumber}`}
      />
      <span className="text-sm text-muted-foreground">–{game.scheduledEnd}</span>
      <div className="flex items-center gap-2 flex-1">
        <span className="font-medium">{home?.name ?? '?'}</span>
        <span className="text-muted-foreground text-sm">vs</span>
        <span className="font-medium">{away?.name ?? '?'}</span>
      </div>
      {hasBlackoutConflict && <ConflictBadge message="Sperrzeit!" />}
    </div>
  )
}
