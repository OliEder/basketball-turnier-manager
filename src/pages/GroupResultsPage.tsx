import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTournamentStore } from '@/store/tournament-store'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TeamNameDisplay } from '@/components/teams/TeamNameDisplay'
import { computeFinalScore } from '@/lib/standings'
import type { Game } from '@/types'

type StatusFilter = 'open' | 'played' | 'all'

export default function GroupResultsPage() {
  const { tournament, schedule, submitGameResult, correctGameResult } = useTournamentStore()
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

  const isScoreEntered = (gameId: string) => {
    const entry = scores[gameId]
    return !!entry && entry.home.trim() !== '' && entry.away.trim() !== '' && !Number.isNaN(Number(entry.home)) && !Number.isNaN(Number(entry.away))
  }

  const handleSave = (game: Game) => {
    const entry = scores[game.id]
    const homeScore = entry ? Number(entry.home) : game.periodScores[0]?.homeScore
    const awayScore = entry ? Number(entry.away) : game.periodScores[0]?.awayScore
    const hasResult = game.periodScores.length > 0
    if (hasResult) {
      correctGameResult(game.id, [{ period: 1, homeScore, awayScore }])
    } else {
      submitGameResult(game.id, [{ period: 1, homeScore, awayScore }])
    }
    setCorrectingGameId(null)
    setSavedGroupId(game.groupId ?? 'A')
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
                <span className="text-muted-foreground text-sm">vs</span>
                {awayTeam ? <TeamNameDisplay team={awayTeam} /> : <span>{game.awayLabel ?? '?'}</span>}
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
                    disabled={!isCorrecting && !isScoreEntered(game.id)}
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
