import { useState } from 'react'
import { useTournamentStore } from '@/store/tournament-store'
import { computeGroupStandings } from '@/lib/group-standings'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import GameRow from '@/components/schedule/GameRow'
import { TeamNameDisplay } from '@/components/teams/TeamNameDisplay'

export default function GroupOverviewPage() {
  const { tournament, schedule } = useTournamentStore()
  const groupIds = [...new Set(tournament.teams.map(t => t.groupId ?? 'A'))].sort()
  const [activeGroupId, setActiveGroupId] = useState(groupIds[0] ?? 'A')

  if (!schedule) {
    return (
      <Alert>
        <AlertDescription>Bitte zuerst einen Zeitplan generieren (Seite „Konfiguration“).</AlertDescription>
      </Alert>
    )
  }

  const currentGroupId = groupIds.includes(activeGroupId) ? activeGroupId : (groupIds[0] ?? 'A')
  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))
  const standings = computeGroupStandings(tournament.teams, schedule.games, currentGroupId)
  const groupGames = schedule.games.filter(g => g.stage === 'group' && (g.groupId ?? 'A') === currentGroupId)
  const rounds = [...new Set(groupGames.map(g => g.round))].sort((a, b) => a - b)

  return (
    <div className="space-y-6">
      <div className="flex gap-1 flex-wrap">
        {groupIds.map(groupId => (
          <Button
            key={groupId}
            variant={groupId === currentGroupId ? undefined : 'outline'}
            size="sm"
            onClick={() => setActiveGroupId(groupId)}
          >
            Gruppe {groupId}
          </Button>
        ))}
      </div>

      <div>
        <h2 className="font-display text-lg uppercase mb-2">Gruppe {currentGroupId}</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-sm text-muted-foreground border-b border-border">
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">Team</th>
              <th className="py-1 pr-2">Pkt</th>
              <th className="py-1 pr-2">Diff</th>
              <th className="py-1 pr-2">S-U-N</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <tr key={s.teamId} className="border-b border-border last:border-0">
                <td className="py-1 pr-2">{i + 1}</td>
                <td className="py-1 pr-2 font-medium">
                  {teamMap.get(s.teamId) && <TeamNameDisplay team={teamMap.get(s.teamId)!} />}
                </td>
                <td className="py-1 pr-2">{s.points}</td>
                <td className="py-1 pr-2">{s.pointsDiff > 0 ? '+' : ''}{s.pointsDiff}</td>
                <td className="py-1 pr-2">{s.wins}-{s.draws}-{s.losses}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="font-display text-lg uppercase mb-2">Zeitplan</h2>
        {rounds.map(round => (
          <div key={round} className="mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground mb-1">Runde {round}</h3>
            <div className="border border-border rounded-md p-4 bg-card">
              {groupGames
                .filter(g => g.round === round && g.field > 0)
                .map(game => <GameRow key={game.id} game={game} showResult />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
