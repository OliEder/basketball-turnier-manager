import { useState } from 'react'
import { useTournamentStore, getCurrentSwissRound } from '@/store/tournament-store'
import { PairingConflictError } from '@/lib/swiss-pairing'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { getTeamAbbreviation } from '@/lib/utils'
import { TeamNameDisplay } from '@/components/teams/TeamNameDisplay'

export default function SwissResultsPage() {
  const { tournament, schedule, submitGameResult, advanceSwissRound, advanceSwissRoundManually, withdrawTeam, correctGameResult } = useTournamentStore()
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>({})
  const [error, setError] = useState<string | null>(null)
  const [manualPairingNeeded, setManualPairingNeeded] = useState(false)
  const [manualAssignments, setManualAssignments] = useState<Record<string, string>>({})
  const [correctingGameId, setCorrectingGameId] = useState<string | null>(null)
  const [viewedRound, setViewedRound] = useState<number | null>(null)

  if (!schedule) {
    return (
      <Alert>
        <AlertDescription>Bitte zuerst einen Zeitplan generieren (Seite „Konfiguration“).</AlertDescription>
      </Alert>
    )
  }

  const displayRound = getCurrentSwissRound(schedule.games) || 1
  const currentViewedRound = viewedRound ?? displayRound
  const isViewingPastRound = currentViewedRound !== displayRound
  const roundGames = schedule.games.filter(g => g.stage === 'swiss' && g.round === currentViewedRound)
  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))
  const totalRounds = tournament.swissRounds ?? 1

  const isScoreEntered = (gameId: string) => {
    const entry = scores[gameId]
    return !!entry && entry.home.trim() !== '' && entry.away.trim() !== '' && !Number.isNaN(Number(entry.home)) && !Number.isNaN(Number(entry.away))
  }

  const allEvaluated = roundGames.every(
    g => g.byeTeamId !== undefined || g.cancelledReason || g.periodScores.length > 0 || isScoreEntered(g.id)
  )
  const activeRoundGames = schedule.games.filter(g => g.stage === 'swiss' && g.round === displayRound)
  const activeRoundEvaluated = activeRoundGames.every(
    g => g.byeTeamId !== undefined || g.cancelledReason || g.periodScores.length > 0 || isScoreEntered(g.id)
  )
  const tournamentFinished = displayRound >= totalRounds && activeRoundEvaluated

  const handleAdvance = () => {
    setError(null)
    try {
      for (const game of roundGames) {
        if (game.periodScores.length === 0 && isScoreEntered(game.id)) {
          const entry = scores[game.id]
          submitGameResult(game.id, [{ period: 1, homeScore: Number(entry.home), awayScore: Number(entry.away) }])
        }
      }
      advanceSwissRound()
    } catch (err) {
      if (err instanceof PairingConflictError) {
        setManualPairingNeeded(true)
      } else {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
  }

  const activeTeams = tournament.teams.filter(t => !t.withdrawnAfterRound)

  const handleManualPair = (teamId: string, opponentId: string) => {
    setManualAssignments(a => ({ ...a, [teamId]: opponentId, [opponentId]: teamId }))
  }

  const handleManualSubmit = () => {
    const seen = new Set<string>()
    const pairs: [string, string][] = []
    for (const [a, b] of Object.entries(manualAssignments)) {
      if (seen.has(a) || seen.has(b)) continue
      pairs.push([a, b])
      seen.add(a)
      seen.add(b)
    }
    advanceSwissRoundManually(pairs)
    setManualPairingNeeded(false)
    setManualAssignments({})
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg uppercase">
        Runde {displayRound} von {totalRounds}
      </h2>

      <div className="flex gap-1 flex-wrap">
        {Array.from({ length: displayRound }, (_, i) => i + 1).map(r => (
          <Button
            key={r}
            variant={r === currentViewedRound ? undefined : 'outline'}
            size="sm"
            onClick={() => setViewedRound(r)}
          >
            Runde {r}
          </Button>
        ))}
      </div>

      {isViewingPastRound && (
        <Alert>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>Du siehst eine bereits abgeschlossene Runde — nicht die aktuell aktive Runde.</span>
            <Button size="sm" onClick={() => setViewedRound(null)}>Zur aktuellen Runde</Button>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="border border-border rounded-md p-4 bg-card space-y-3">
        {roundGames.map(game => {
          if (game.byeTeamId) {
            return (
              <div key={game.id} className="text-sm text-muted-foreground">
                Freilos: {teamMap.get(game.byeTeamId)?.name ?? '?'}
              </div>
            )
          }
          const homeTeam = game.homeTeamId ? teamMap.get(game.homeTeamId) : undefined
          const awayTeam = game.awayTeamId ? teamMap.get(game.awayTeamId) : undefined
          const home = homeTeam ? getTeamAbbreviation(homeTeam) : game.homeLabel ?? '?'
          const away = awayTeam ? getTeamAbbreviation(awayTeam) : game.awayLabel ?? '?'
          const hasResult = game.periodScores.length > 0
          const canWithdraw = game.homeTeamId && game.awayTeamId
          return (
            <div key={game.id} className="py-2 border-b border-border last:border-0">
              <span className="text-xs font-mono text-muted-foreground">F{game.field}</span>
              <div
                className="grid items-center gap-2"
                style={{ gridTemplateColumns: '140px 1fr 42px 16px 42px 1fr 140px auto auto' }}
              >
                {canWithdraw ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs text-muted-foreground border-dashed border-destructive w-full min-w-0 truncate"
                    title={`${home} ausgeschieden`}
                    onClick={() => {
                      if (confirm(`${home} als ausgeschieden markieren?`)) withdrawTeam(game.homeTeamId!)
                    }}
                  >
                    {home} ausgeschieden
                  </Button>
                ) : <span />}

                <div className="text-right min-w-0">
                  {homeTeam ? <TeamNameDisplay team={homeTeam} className="text-right" /> : <span className="font-medium truncate">{home}</span>}
                </div>

                {hasResult && correctingGameId !== game.id ? (
                  <span className="text-sm text-muted-foreground text-right">{game.periodScores[0].homeScore}</span>
                ) : !hasResult ? (
                  <Input
                    type="number"
                    className="w-full no-spinner px-1 text-center"
                    aria-label={`Ergebnis Heim, Spiel ${game.gameNumber}`}
                    onChange={e => setScores(s => ({ ...s, [game.id]: { home: e.target.value, away: s[game.id]?.away ?? '' } }))}
                  />
                ) : (
                  <Input
                    type="number"
                    className="w-full no-spinner px-1 text-center"
                    defaultValue={game.periodScores[0].homeScore}
                    aria-label={`Korrigiertes Ergebnis Heim, Spiel ${game.gameNumber}`}
                    onChange={e => setScores(s => ({ ...s, [game.id]: { home: e.target.value, away: s[game.id]?.away ?? String(game.periodScores[0].awayScore) } }))}
                  />
                )}

                <span className="text-center">:</span>

                {hasResult && correctingGameId !== game.id ? (
                  <span className="text-sm text-muted-foreground text-left">{game.periodScores[0].awayScore}</span>
                ) : !hasResult ? (
                  <Input
                    type="number"
                    className="w-full no-spinner px-1 text-center"
                    aria-label={`Ergebnis Auswärts, Spiel ${game.gameNumber}`}
                    onChange={e => setScores(s => ({ ...s, [game.id]: { home: s[game.id]?.home ?? '', away: e.target.value } }))}
                  />
                ) : (
                  <Input
                    type="number"
                    className="w-full no-spinner px-1 text-center"
                    defaultValue={game.periodScores[0].awayScore}
                    aria-label={`Korrigiertes Ergebnis Auswärts, Spiel ${game.gameNumber}`}
                    onChange={e => setScores(s => ({ ...s, [game.id]: { home: s[game.id]?.home ?? String(game.periodScores[0].homeScore), away: e.target.value } }))}
                  />
                )}

                <div className="text-left min-w-0">
                  {awayTeam ? <TeamNameDisplay team={awayTeam} className="text-left" /> : <span className="font-medium truncate">{away}</span>}
                </div>

                {canWithdraw ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs text-muted-foreground border-dashed border-destructive w-full min-w-0 truncate"
                    title={`${away} ausgeschieden`}
                    onClick={() => {
                      if (confirm(`${away} als ausgeschieden markieren?`)) withdrawTeam(game.awayTeamId!)
                    }}
                  >
                    {away} ausgeschieden
                  </Button>
                ) : <span />}

                {!hasResult && isScoreEntered(game.id) ? (
                  <span aria-label={`Ergebnis erfasst, Spiel ${game.gameNumber}`} className="text-green-600" title="Ergebnis erfasst">
                    ✓
                  </span>
                ) : <span />}

                {hasResult && correctingGameId !== game.id ? (
                  <Button variant="outline" size="sm" className="text-muted-foreground" onClick={() => setCorrectingGameId(game.id)}>
                    Korrigieren
                  </Button>
                ) : hasResult ? (
                  <Button onClick={() => {
                    const entry = scores[game.id]
                    if (!entry) { setCorrectingGameId(null); return }
                    try {
                      correctGameResult(game.id, [{ period: 1, homeScore: Number(entry.home), awayScore: Number(entry.away) }])
                      setCorrectingGameId(null)
                    } catch (err) {
                      setError(err instanceof Error ? err.message : String(err))
                    }
                  }}>
                    Speichern
                  </Button>
                ) : <span />}
              </div>
            </div>
          )
        })}
      </div>

      {tournamentFinished ? (
        <Alert>
          <AlertDescription>Turnier abgeschlossen. Siehe Turnierübersicht für das Endergebnis.</AlertDescription>
        </Alert>
      ) : !isViewingPastRound ? (
        <Button onClick={handleAdvance} disabled={!allEvaluated}>
          Nächste Runde auslosen
        </Button>
      ) : null}

      {!isViewingPastRound && manualPairingNeeded && (
        <div className="border border-border rounded-md p-4 bg-card space-y-3">
          <p className="text-sm font-medium">
            Automatische Paarung nicht möglich — bitte Paarungen für die nächste Runde manuell zuweisen.
          </p>
          {activeTeams.map(team => (
            <div key={team.id} className="flex items-center gap-3">
              <span className="w-32 text-sm">{team.name}</span>
              <select
                aria-label={`Gegner für ${team.name}`}
                className="border border-border rounded-sm px-2 py-1 text-sm"
                value={manualAssignments[team.id] ?? ''}
                onChange={e => handleManualPair(team.id, e.target.value)}
              >
                <option value="">– Gegner wählen –</option>
                {activeTeams.filter(t => t.id !== team.id).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          ))}
          <Button onClick={handleManualSubmit}>Paarungen übernehmen</Button>
        </div>
      )}
    </div>
  )
}
