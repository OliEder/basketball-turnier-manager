import { useState } from 'react'
import { useTournamentStore, getCurrentSwissRound } from '@/store/tournament-store'
import { PairingConflictError } from '@/lib/swiss-pairing'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function SwissResultsPage() {
  const { tournament, schedule, submitGameResult, advanceSwissRound, advanceSwissRoundManually, withdrawTeam, correctGameResult } = useTournamentStore()
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>({})
  const [error, setError] = useState<string | null>(null)
  const [manualPairingNeeded, setManualPairingNeeded] = useState(false)
  const [manualAssignments, setManualAssignments] = useState<Record<string, string>>({})
  const [correctingGameId, setCorrectingGameId] = useState<string | null>(null)

  if (!schedule) {
    return (
      <Alert>
        <AlertDescription>Bitte zuerst einen Zeitplan generieren (Seite „Konfiguration“).</AlertDescription>
      </Alert>
    )
  }

  const displayRound = getCurrentSwissRound(schedule.games) || 1
  const roundGames = schedule.games.filter(g => g.stage === 'swiss' && g.round === displayRound)
  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))
  const totalRounds = tournament.swissRounds ?? 1
  const allEvaluated = roundGames.every(
    g => g.byeTeamId !== undefined || g.cancelledReason || g.periodScores.length > 0
  )
  const tournamentFinished = displayRound >= totalRounds && allEvaluated

  const handleSubmit = (gameId: string) => {
    const entry = scores[gameId]
    if (!entry) return
    const home = Number(entry.home)
    const away = Number(entry.away)
    setError(null)
    try {
      submitGameResult(gameId, [{ period: 1, homeScore: home, awayScore: away }])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleAdvance = () => {
    setError(null)
    try {
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
          const home = game.homeTeamId ? teamMap.get(game.homeTeamId)?.name ?? '?' : game.homeLabel ?? '?'
          const away = game.awayTeamId ? teamMap.get(game.awayTeamId)?.name ?? '?' : game.awayLabel ?? '?'
          const hasResult = game.periodScores.length > 0
          return (
            <div key={game.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
              <span className="text-sm font-mono w-8 text-center bg-tint rounded-sm px-1">F{game.field}</span>
              <span className="flex-1 font-medium">{home} vs {away}</span>
              {hasResult && correctingGameId !== game.id ? (
                <>
                  <span className="text-sm text-muted-foreground">
                    {game.periodScores[0].homeScore} : {game.periodScores[0].awayScore}
                  </span>
                  <Button variant="outline" size="sm" className="text-muted-foreground" onClick={() => setCorrectingGameId(game.id)}>
                    Korrigieren
                  </Button>
                </>
              ) : !hasResult ? (
                <>
                  <Input
                    type="number"
                    className="w-16"
                    aria-label={`Ergebnis Heim, Spiel ${game.gameNumber}`}
                    onChange={e => setScores(s => ({ ...s, [game.id]: { home: e.target.value, away: s[game.id]?.away ?? '' } }))}
                  />
                  <span>:</span>
                  <Input
                    type="number"
                    className="w-16"
                    aria-label={`Ergebnis Auswärts, Spiel ${game.gameNumber}`}
                    onChange={e => setScores(s => ({ ...s, [game.id]: { home: s[game.id]?.home ?? '', away: e.target.value } }))}
                  />
                  <Button onClick={() => handleSubmit(game.id)}>Speichern</Button>
                </>
              ) : (
                <>
                  <Input
                    type="number"
                    className="w-16"
                    defaultValue={game.periodScores[0].homeScore}
                    aria-label={`Korrigiertes Ergebnis Heim, Spiel ${game.gameNumber}`}
                    onChange={e => setScores(s => ({ ...s, [game.id]: { home: e.target.value, away: s[game.id]?.away ?? String(game.periodScores[0].awayScore) } }))}
                  />
                  <span>:</span>
                  <Input
                    type="number"
                    className="w-16"
                    defaultValue={game.periodScores[0].awayScore}
                    aria-label={`Korrigiertes Ergebnis Auswärts, Spiel ${game.gameNumber}`}
                    onChange={e => setScores(s => ({ ...s, [game.id]: { home: s[game.id]?.home ?? String(game.periodScores[0].homeScore), away: e.target.value } }))}
                  />
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
                </>
              )}
              {game.homeTeamId && game.awayTeamId && (
                <div className="flex gap-1 ml-2 pl-2 border-l border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    onClick={() => {
                      if (confirm(`${home} als ausgeschieden markieren?`)) withdrawTeam(game.homeTeamId!)
                    }}
                  >
                    {home} ausgeschieden
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    onClick={() => {
                      if (confirm(`${away} als ausgeschieden markieren?`)) withdrawTeam(game.awayTeamId!)
                    }}
                  >
                    {away} ausgeschieden
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {tournamentFinished ? (
        <Alert>
          <AlertDescription>Turnier abgeschlossen. Siehe Turnierübersicht für das Endergebnis.</AlertDescription>
        </Alert>
      ) : (
        <Button onClick={handleAdvance} disabled={!allEvaluated}>
          Nächste Runde auslosen
        </Button>
      )}

      {manualPairingNeeded && (
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
