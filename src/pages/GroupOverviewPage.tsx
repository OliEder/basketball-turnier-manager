import { useState } from 'react'
import { useTournamentStore } from '@/store/tournament-store'
import { computeGroupStandings } from '@/lib/group-standings'
import { downloadGroupOverviewPdf } from '@/lib/export/group-overview-pdf'
import { Button, Table, Tabs, type TableColumn } from '@bbv/dss-design-system/react'
import GameRow from '@/components/schedule/GameRow'
import { TeamNameDisplay } from '@/components/teams/TeamNameDisplay'
import { ScheduleRequired } from '@/components/shared/ScheduleRequired'

const STANDINGS_COLUMNS: TableColumn[] = [
  { key: 'place', label: '#', width: '3rem' },
  { key: 'team', label: 'Team' },
  { key: 'points', label: 'Pkt', align: 'right' },
  { key: 'diff', label: 'Diff', align: 'right' },
  { key: 'record', label: 'S-U-N', align: 'right' },
]

export default function GroupOverviewPage() {
  const { tournament, schedule } = useTournamentStore()
  const groupIds = [...new Set(tournament.teams.map(t => t.groupId ?? 'A'))].sort()
  const [activeGroupId, setActiveGroupId] = useState(groupIds[0] ?? 'A')

  if (!schedule) {
    return <ScheduleRequired />
  }

  const currentGroupId = groupIds.includes(activeGroupId) ? activeGroupId : (groupIds[0] ?? 'A')
  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))
  const standings = computeGroupStandings(tournament.teams, schedule.games, currentGroupId)
  const groupGames = schedule.games.filter(g => g.stage === 'group' && (g.groupId ?? 'A') === currentGroupId)
  const rounds = [...new Set(groupGames.map(g => g.round))].sort((a, b) => a - b)

  const handleDownloadCurrentGroupPdf = () => {
    void downloadGroupOverviewPdf(tournament, schedule, [{ groupId: currentGroupId, standings }])
  }

  const handleDownloadAllGroupsPdf = () => {
    const sections = groupIds.map(groupId => ({
      groupId,
      standings: computeGroupStandings(tournament.teams, schedule.games, groupId),
    }))
    void downloadGroupOverviewPdf(tournament, schedule, sections)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Tabs
          variant="pills"
          size="sm"
          ariaLabel="Gruppen"
          items={groupIds.map(id => ({ id, label: `Gruppe ${id}` }))}
          value={currentGroupId}
          onValueChange={setActiveGroupId}
        />
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleDownloadCurrentGroupPdf}>Diese Gruppe als PDF herunterladen</Button>
          <Button variant="ghost" size="sm" onClick={handleDownloadAllGroupsPdf}>Alle Gruppen als PDF herunterladen</Button>
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg uppercase mb-2">Gruppe {currentGroupId}</h2>
        <Table density="compact" caption={`Tabelle Gruppe ${currentGroupId}`} columns={STANDINGS_COLUMNS}>
          {standings.map((s, i) => (
            <tr key={s.teamId}>
              <td>{i + 1}</td>
              <td>{teamMap.get(s.teamId) && <TeamNameDisplay team={teamMap.get(s.teamId)!} />}</td>
              <td className="num lead">{s.points}</td>
              <td className="num">{s.pointsDiff > 0 ? '+' : ''}{s.pointsDiff}</td>
              <td className="num">{s.wins}-{s.draws}-{s.losses}</td>
            </tr>
          ))}
        </Table>
      </div>

      <div>
        <h2 className="font-display text-lg uppercase mb-2">Zeitplan</h2>
        {rounds.map(round => (
          <div key={round} className="mb-4">
            <h3 className="text-sm font-semibold text-mute mb-1">Runde {round}</h3>
            <div className="border border-line rounded-md p-4 bg-surface">
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
