import { useTournamentStore } from '@/store/tournament-store'
import { Input } from '@/components/ui/input'
import ConflictBadge from './ConflictBadge'
import { overlapsBlackout } from '@/lib/game-duration'
import { getTeamAbbreviation } from '@/lib/utils'
import { computeFinalScore } from '@/lib/standings'
import type { Game } from '@/types'

interface Props {
  game: Game
  showResult?: boolean
}

export default function GameRow({ game, showResult = false }: Props) {
  const { tournament, updateGameTime } = useTournamentStore()
  const teams = tournament.teams
  const home = teams.find(t => t.id === game.homeTeamId)
  const away = teams.find(t => t.id === game.awayTeamId)
  const hasResult = game.periodScores.length > 0
  const finalScore = hasResult ? computeFinalScore(game) : null

  const hasBlackoutConflict = tournament.venue.blackoutPeriods.some(b =>
    overlapsBlackout(game.scheduledStart, game.scheduledEnd, b)
  )

  return (
    <div className="flex items-center gap-4 py-3 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground w-6">#{game.gameNumber}</span>
      <span className="text-sm font-mono w-8 text-center bg-tint rounded-sm px-1">F{game.field}</span>
      {showResult && finalScore ? (
        <span
          className="text-sm font-mono w-28 text-center"
          aria-label={`Endstand Spiel ${game.gameNumber}: ${finalScore.home}:${finalScore.away}`}
        >
          <span>{finalScore.home}</span>
          {' : '}
          <span>{finalScore.away}</span>
        </span>
      ) : (
        <>
          <Input
            type="time"
            value={game.scheduledStart}
            onChange={e => updateGameTime(game.id, e.target.value)}
            className="w-28 font-mono"
            aria-label={`Startzeit Spiel ${game.gameNumber}`}
          />
          <span className="text-sm text-muted-foreground">–{game.scheduledEnd}</span>
        </>
      )}
      <div className="flex items-center gap-2 flex-1">
        <span className="font-medium" title={home?.name}>
          {game.homeTeamId ? (home ? getTeamAbbreviation(home) : '?') : game.homeLabel ?? '?'}
        </span>
        <span className="text-muted-foreground text-sm">vs</span>
        <span className="font-medium" title={away?.name}>
          {game.awayTeamId ? (away ? getTeamAbbreviation(away) : '?') : game.awayLabel ?? '?'}
        </span>
      </div>
      {hasBlackoutConflict && <ConflictBadge message="Sperrzeit!" />}
    </div>
  )
}
