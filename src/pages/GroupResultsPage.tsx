import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTournamentStore } from '@/store/tournament-store'
import { Banner, Button, TextInput, EmptyState, Select } from '@bbv/dss-design-system/react'
import { TeamNameDisplay } from '@/components/teams/TeamNameDisplay'
import { computeFinalScore } from '@/lib/standings'
import type { Game, Team } from '@/types'
import { ScheduleRequired } from '@/components/shared/ScheduleRequired'

type StatusFilter = 'open' | 'played' | 'all'

export default function GroupResultsPage() {
  const { tournament, schedule, submitGameResult, correctGameResult, withdrawTeam } = useTournamentStore()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open')
  const [groupFilter, setGroupFilter] = useState<string>('all')
  const [fieldFilter, setFieldFilter] = useState<string>('all')
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>({})
  const [correctingGameId, setCorrectingGameId] = useState<string | null>(null)
  const [savedGroupId, setSavedGroupId] = useState<string | null>(null)

  if (!schedule) {
    return <ScheduleRequired />
  }

  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))
  const groupIds = [...new Set(tournament.teams.map(t => t.groupId ?? 'A'))].sort()

  const groupGames = schedule.games.filter(g => g.stage === 'group')
  const filteredGames = groupGames
    .filter(g => {
      const hasResult = g.periodScores.length > 0
      if (statusFilter === 'open') return !hasResult
      if (statusFilter === 'played') return hasResult
      return true
    })
    .filter(g => groupFilter === 'all' || (g.groupId ?? 'A') === groupFilter)
    .filter(g => fieldFilter === 'all' || g.field === Number(fieldFilter))
    .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))

  // Resolves the value that would actually be submitted for a given side (home/away) of a
  // game's score. If the field was never touched at all, an in-progress correction falls back
  // to the game's existing (already-valid) score. But once the user has touched the field --
  // even to clear it to an empty string -- that typed value (however invalid) is authoritative
  // and must NOT silently fall back to the old score.
  const resolvedHomeScore = (game: Game): number | undefined => {
    const entry = scores[game.id]
    if (entry?.home !== undefined) return entry.home.trim() === '' ? NaN : Number(entry.home)
    if (game.periodScores.length > 0) return game.periodScores[0].homeScore
    return undefined
  }

  const resolvedAwayScore = (game: Game): number | undefined => {
    const entry = scores[game.id]
    if (entry?.away !== undefined) return entry.away.trim() === '' ? NaN : Number(entry.away)
    if (game.periodScores.length > 0) return game.periodScores[0].awayScore
    return undefined
  }

  const canSave = (game: Game): boolean => {
    const home = resolvedHomeScore(game)
    const away = resolvedAwayScore(game)
    return home !== undefined && away !== undefined && !Number.isNaN(home) && !Number.isNaN(away)
  }

  const handleSave = (game: Game) => {
    if (!canSave(game)) return
    const homeScore = resolvedHomeScore(game) as number
    const awayScore = resolvedAwayScore(game) as number
    const hasResult = game.periodScores.length > 0
    if (hasResult) {
      correctGameResult(game.id, [{ period: 1, homeScore, awayScore }])
    } else {
      submitGameResult(game.id, [{ period: 1, homeScore, awayScore }])
    }
    setCorrectingGameId(null)
    setSavedGroupId(game.groupId ?? 'A')
  }

  const renderWithdrawControl = (team: Team | undefined) => {
    if (!team) return null
    if (team.withdrawnAfterStage) {
      return (
        <span className="dss-chip dss-chip--err dss-chip--mono">
          {team.name} zurückgezogen
        </span>
      )
    }
    return (
      <Button
        variant="ghost"
        size="sm"
        className="!text-xs !h-9 !px-3"
        title={`${team.name} zurückziehen`}
        onClick={() => {
          if (confirm(`${team.name} als zurückgezogen markieren?`)) withdrawTeam(team.id)
        }}
      >
        {team.name} zurückziehen
      </Button>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl text-fg">Ergebnisse erfassen</h1>

      {savedGroupId && (
        <Banner>
          Ergebnis gespeichert.{' '}
          <Link to="/group-overview" className="underline">
            Tabelle für Gruppe {savedGroupId} ansehen →
          </Link>
        </Banner>
      )}

      <div className="flex gap-4 flex-wrap items-end">
        <Select
          id="status-filter"
          label="Status"
          density="compact"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          options={[
            { value: 'open', label: 'Offen' },
            { value: 'played', label: 'Erfasst' },
            { value: 'all', label: 'Alle' },
          ]}
        />
        <Select
          id="group-filter"
          label="Gruppe"
          density="compact"
          value={groupFilter}
          onChange={e => setGroupFilter(e.target.value)}
          options={[
            { value: 'all', label: 'Alle Gruppen' },
            ...groupIds.map(groupId => ({ value: groupId, label: `Gruppe ${groupId}` })),
          ]}
        />
        <Select
          id="field-filter"
          label="Feld"
          density="compact"
          value={fieldFilter}
          onChange={e => setFieldFilter(e.target.value)}
          options={[
            { value: 'all', label: 'Alle Felder' },
            ...Array.from({ length: tournament.fields }, (_, i) => i + 1).map(field => ({ value: String(field), label: `Feld ${field}` })),
          ]}
        />
      </div>

      {filteredGames.length === 0 && (
        <EmptyState title="Keine Spiele für die gewählten Filter." />
      )}

      <div className="dss-rows">
        {filteredGames.map(game => {
          const homeTeam = game.homeTeamId ? teamMap.get(game.homeTeamId) : undefined
          const awayTeam = game.awayTeamId ? teamMap.get(game.awayTeamId) : undefined
          const hasResult = game.periodScores.length > 0
          const isCorrecting = correctingGameId === game.id
          const finalScore = hasResult ? computeFinalScore(game) : null

          return (
            <div key={game.id} className="flex items-center gap-3 px-4 py-3 border-b border-line last:border-0">
              <span className="text-xs font-mono text-mute w-16">{game.scheduledStart}</span>
              <span className="dss-chip dss-chip--mono">F{game.field}</span>
              <span className="dss-chip dss-chip--mono whitespace-nowrap shrink-0">
                Gruppe {game.groupId ?? 'A'}
              </span>
              <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
                {homeTeam ? <TeamNameDisplay team={homeTeam} /> : <span>{game.homeLabel ?? '?'}</span>}
                {renderWithdrawControl(homeTeam)}
                <span className="text-mute text-sm">vs</span>
                {awayTeam ? <TeamNameDisplay team={awayTeam} /> : <span>{game.awayLabel ?? '?'}</span>}
                {renderWithdrawControl(awayTeam)}
              </div>

              {hasResult && !isCorrecting ? (
                <>
                  <span className="text-sm font-mono w-20 text-center">
                    {finalScore!.home} : {finalScore!.away}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setCorrectingGameId(game.id)}>
                    Korrigieren
                  </Button>
                </>
              ) : (
                <>
                  <TextInput
                    density="compact"
                    type="number"
                    fieldClassName="w-16"
                    className="no-spinner !px-1 text-center"
                    aria-label={isCorrecting ? `Korrigiertes Ergebnis Heim, Spiel ${game.gameNumber}` : `Ergebnis Heim, Spiel ${game.gameNumber}`}
                    defaultValue={isCorrecting ? game.periodScores[0].homeScore : undefined}
                    onChange={e => setScores(s => ({ ...s, [game.id]: { home: e.target.value, away: s[game.id]?.away ?? (isCorrecting ? String(game.periodScores[0].awayScore) : '') } }))}
                  />
                  <span>:</span>
                  <TextInput
                    density="compact"
                    type="number"
                    fieldClassName="w-16"
                    className="no-spinner !px-1 text-center"
                    aria-label={isCorrecting ? `Korrigiertes Ergebnis Auswärts, Spiel ${game.gameNumber}` : `Ergebnis Auswärts, Spiel ${game.gameNumber}`}
                    defaultValue={isCorrecting ? game.periodScores[0].awayScore : undefined}
                    onChange={e => setScores(s => ({ ...s, [game.id]: { home: s[game.id]?.home ?? (isCorrecting ? String(game.periodScores[0].homeScore) : ''), away: e.target.value } }))}
                  />
                  <Button
                    size="sm"
                    disabled={!canSave(game)}
                    onClick={() => handleSave(game)}
                  >
                    Speichern
                  </Button>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
