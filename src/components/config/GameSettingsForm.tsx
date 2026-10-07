import { useTournamentStore } from '@/store/tournament-store'
import { TextInput } from '@bbv/dss-design-system/react'
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
        <TextInput id="periods-count" label="Anzahl Spielabschnitte" type="number" min={2} max={8} value={gs.periodsCount} onChange={numField('periodsCount')} disabled={disabled} />
        <TextInput id="period-duration" label="Dauer pro Abschnitt (Min)" type="number" min={1} max={30} value={gs.periodDurationMin} onChange={numField('periodDurationMin')} disabled={disabled} />
        <TextInput id="period-break" label="Pause zwischen Abschnitten (Min)" type="number" min={0} max={15} value={gs.breakBetweenPeriodsMin} onChange={numField('breakBetweenPeriodsMin')} disabled={disabled} />
        <TextInput id="halftime-break" label="Halbzeitpause (Min)" type="number" min={0} max={30} value={gs.halfTimeBreakMin} onChange={numField('halfTimeBreakMin')} disabled={disabled} />
        <TextInput id="buffer" label="Wechselzeit zwischen Spielen (Min)" type="number" min={0} max={30} value={gs.bufferBetweenGamesMin} onChange={numField('bufferBetweenGamesMin')} disabled={disabled} />
        <TextInput id="round-break" label="Pause zwischen Runden (Min)" type="number" min={0} max={60} value={gs.breakBetweenRoundsMin} onChange={numField('breakBetweenRoundsMin')} disabled={disabled} />
      </div>
      <p className="text-sm text-mute">
        Spielzeit gesamt: <strong>{totalMin} Minuten</strong> (ohne Wechselzeit)
      </p>
    </div>
  )
}
