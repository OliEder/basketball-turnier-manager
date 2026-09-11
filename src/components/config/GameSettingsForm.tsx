import { useTournamentStore } from '@/store/tournament-store'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { calcGameDurationMin } from '@/lib/game-duration'

export default function GameSettingsForm({ disabled = false }: { disabled?: boolean }) {
  const { tournament, updateGameSettings } = useTournamentStore()
  const gs = tournament.gameSettings
  const totalMin = calcGameDurationMin(gs)

  const numField = (field: keyof typeof gs) => (e: React.ChangeEvent<HTMLInputElement>) =>
    updateGameSettings({ [field]: Number(e.target.value) })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 max-w-xl">
        <div className="space-y-1">
          <Label htmlFor="periods-count">Anzahl Spielabschnitte</Label>
          <Input id="periods-count" type="number" min={2} max={8} value={gs.periodsCount} onChange={numField('periodsCount')} disabled={disabled} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="period-duration">Dauer pro Abschnitt (Min)</Label>
          <Input id="period-duration" type="number" min={1} max={30} value={gs.periodDurationMin} onChange={numField('periodDurationMin')} disabled={disabled} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="period-break">Pause zwischen Abschnitten (Min)</Label>
          <Input id="period-break" type="number" min={0} max={15} value={gs.breakBetweenPeriodsMin} onChange={numField('breakBetweenPeriodsMin')} disabled={disabled} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="halftime-break">Halbzeitpause (Min)</Label>
          <Input id="halftime-break" type="number" min={0} max={30} value={gs.halfTimeBreakMin} onChange={numField('halfTimeBreakMin')} disabled={disabled} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="buffer">Wechselzeit zwischen Spielen (Min)</Label>
          <Input id="buffer" type="number" min={0} max={30} value={gs.bufferBetweenGamesMin} onChange={numField('bufferBetweenGamesMin')} disabled={disabled} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="round-break">Pause zwischen Runden (Min)</Label>
          <Input id="round-break" type="number" min={0} max={60} value={gs.breakBetweenRoundsMin} onChange={numField('breakBetweenRoundsMin')} disabled={disabled} />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Spielzeit gesamt: <strong>{totalMin} Minuten</strong> (ohne Wechselzeit)
      </p>
    </div>
  )
}
