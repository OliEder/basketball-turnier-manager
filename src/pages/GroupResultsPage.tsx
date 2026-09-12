import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTournamentStore } from '@/store/tournament-store'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TeamNameDisplay } from '@/components/teams/TeamNameDisplay'
import { computeFinalScore } from '@/lib/standings'
import type { Game, Team } from '@/types'

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
    return (
      <Alert>
        <AlertDescription>Bitte zuerst einen Zeitplan generieren (Seite „Konfiguration“).</AlertDescription>
      </Alert>
    )
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
        <span className="text-xs font-semibold uppercase tracking-wide rounded-sm bg-destructive text-destructive-foreground px-2 py-0.5">
          {team.name} zurückgezogen
        </span>
      )
    }
    return (
      <Button
        variant="outline"
        size="sm"
        className="text-xs text-muted-foreground border-dashed border-destructive"
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
      <h1 className="text-2xl text-brand-primary">Ergebnisse erfassen</h1>

      {savedGroupId && (
        <Alert>
          <AlertDescription>
            Ergebnis gespeichert.{' '}
            <Link to="/group-overview" className="underline">
              Tabelle für Gruppe {savedGroupId} ansehen →
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-4 flex-wrap items-end">
        <div className="space-y-1">
          <Label htmlFor="status-filter">Status</Label>
          <select
            id="status-filter"
            className="border border-border rounded-sm px-2 py-1 text-sm"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="open">Offen</option>
            <option value="played">Erfasst</option>
            <option value="all">Alle</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="group-filter">Gruppe</Label>
          <select
            id="group-filter"
            className="border border-border rounded-sm px-2 py-1 text-sm"
            value={groupFilter}
            onChange={e => setGroupFilter(e.target.value)}
          >
            <option value="all">Alle Gruppen</option>
            {groupIds.map(groupId => (
              <option key={groupId} value={groupId}>Gruppe {groupId}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="field-filter">Feld</Label>
          <select
            id="field-filter"
            className="border border-border rounded-sm px-2 py-1 text-sm"
            value={fieldFilter}
            onChange={e => setFieldFilter(e.target.value)}
          >
            <option value="all">Alle Felder</option>
            {Array.from({ length: tournament.fields }, (_, i) => i + 1).map(field => (
              <option key={field} value={field}>Feld {field}</option>
            ))}
          </select>
        </div>
      </div>

      {filteredGames.length === 0 && (
        <Alert>
          <AlertDescription>Keine Spiele für die gewählten Filter.</AlertDescription>
        </Alert>
      )}

      <div className="border border-border rounded-md p-4 bg-card space-y-3">
        {filteredGames.map(game => {
          const homeTeam = game.homeTeamId ? teamMap.get(game.homeTeamId) : undefined
          const awayTeam = game.awayTeamId ? teamMap.get(game.awayTeamId) : undefined
          const hasResult = game.periodScores.length > 0
          const isCorrecting = correctingGameId === game.id
          const finalScore = hasResult ? computeFinalScore(game) : null

          return (
            <div key={game.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
              <span className="text-xs font-mono text-muted-foreground w-16">{game.scheduledStart}</span>
              <span className="text-xs font-mono w-8 text-center bg-tint rounded-sm px-1">F{game.field}</span>
              <span className="text-xs font-mono w-8 text-center bg-tint rounded-sm px-1">
                Gruppe {game.groupId ?? 'A'}
              </span>
              <div className="flex-1 min-w-0 flex items-center gap-2">
                {homeTeam ? <TeamNameDisplay team={homeTeam} /> : <span>{game.homeLabel ?? '?'}</span>}
                {renderWithdrawControl(homeTeam)}
                <span className="text-muted-foreground text-sm">vs</span>
                {awayTeam ? <TeamNameDisplay team={awayTeam} /> : <span>{game.awayLabel ?? '?'}</span>}
                {renderWithdrawControl(awayTeam)}
              </div>

              {hasResult && !isCorrecting ? (
                <>
                  <span className="text-sm font-mono w-20 text-center">
                    {finalScore!.home} : {finalScore!.away}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setCorrectingGameId(game.id)}>
                    Korrigieren
                  </Button>
                </>
              ) : (
                <>
                  <Input
                    type="number"
                    className="w-16 no-spinner px-1 text-center"
                    aria-label={isCorrecting ? `Korrigiertes Ergebnis Heim, Spiel ${game.gameNumber}` : `Ergebnis Heim, Spiel ${game.gameNumber}`}
                    defaultValue={isCorrecting ? game.periodScores[0].homeScore : undefined}
                    onChange={e => setScores(s => ({ ...s, [game.id]: { home: e.target.value, away: s[game.id]?.away ?? (isCorrecting ? String(game.periodScores[0].awayScore) : '') } }))}
                  />
                  <span>:</span>
                  <Input
                    type="number"
                    className="w-16 no-spinner px-1 text-center"
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
