import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTournamentStore } from '@/store/tournament-store'
import { Banner, Button, TextInput, EmptyState, Select } from '@bbv/dss-design-system/react'
import { TeamNameDisplay } from '@/components/teams/TeamNameDisplay'
import { computeFinalScore } from '@/lib/standings'
import type { Game, Team } from '@/types'
import { ScheduleRequired } from '@/components/shared/ScheduleRequired'

type StatusFilter = 'open' | 'played' | 'all'

export default function FinalsResultsPage() {
  const { tournament, schedule, submitGameResult, correctGameResult, withdrawTeam } = useTournamentStore()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open')
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>({})
  const [correctingGameId, setCorrectingGameId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  if (!schedule) {
    return <ScheduleRequired />
  }

  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))
  const finalsGames = schedule.games.filter(g => g.stage === 'placement')
  const filteredGames = finalsGames
    .filter(g => {
      const hasResult = g.periodScores.length > 0
      if (statusFilter === 'open') return !hasResult
      if (statusFilter === 'played') return hasResult
      return true
    })
    .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))

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
    setSaved(true)
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
      <h1 className="text-2xl text-brand-primary">Endrunde: Ergebnisse erfassen</h1>

      {saved && (
        <Banner>
          Ergebnis gespeichert.{' '}
          <Link to="/final-standings" className="underline">Endstand ansehen →</Link>
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
          const isUnresolved = !game.homeTeamId || !game.awayTeamId
          const finalScore = hasResult ? computeFinalScore(game) : null

          return (
            <div key={game.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
              <span className="text-xs font-mono text-muted-foreground w-16">{game.scheduledStart}</span>
              <span className="dss-chip dss-chip--mono">F{game.field}</span>
              <span className="dss-chip dss-chip--mono">
                Rangstufe {game.rankTier} — Platz {game.placementFrom}+
              </span>
              <div className="flex-1 min-w-0 flex items-center gap-2">
                {homeTeam ? <TeamNameDisplay team={homeTeam} /> : <span>{`Platz ${game.homeSourceRank?.rank} der Gruppe ${game.homeSourceRank?.groupId}`}</span>}
                {renderWithdrawControl(homeTeam)}
                <span className="text-muted-foreground text-sm">vs</span>
                {awayTeam ? <TeamNameDisplay team={awayTeam} /> : <span>{`Platz ${game.awaySourceRank?.rank} der Gruppe ${game.awaySourceRank?.groupId}`}</span>}
                {renderWithdrawControl(awayTeam)}
              </div>

              {isUnresolved ? (
                <span className="text-xs text-muted-foreground">Wartet auf Gruppenphase</span>
              ) : hasResult && !isCorrecting ? (
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
