import { useState } from 'react'
import { useTournamentStore } from '@/store/tournament-store'
import { Button, TextInput } from '@bbv/dss-design-system/react'
import type { TimeWindow } from '@/types'

export default function BlackoutList({ disabled = false }: { disabled?: boolean }) {
  const { tournament, updateVenue } = useTournamentStore()
  const blackouts = tournament.venue.blackoutPeriods
  const [newBlackout, setNewBlackout] = useState<TimeWindow>({ start: '12:00', end: '14:00', reason: '' })

  const add = () => {
    updateVenue({ blackoutPeriods: [...blackouts, newBlackout] })
    setNewBlackout({ start: '12:00', end: '14:00', reason: '' })
  }

  const remove = (index: number) => {
    updateVenue({ blackoutPeriods: blackouts.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-4">
      <h3 className="font-caption font-medium">Sperrzeiten</h3>
      {blackouts.length === 0 && (
        <p className="text-sm text-muted-foreground">Keine Sperrzeiten definiert.</p>
      )}
      {blackouts.map((b, i) => (
        <div key={i} className="flex items-center gap-3 p-3 border border-border rounded-md bg-tint">
          <span className="font-mono text-sm">{b.start}–{b.end}</span>
          {b.reason && <span className="text-sm text-muted-foreground">{b.reason}</span>}
          <Button size="sm" variant="danger" className="ml-auto" onClick={() => remove(i)} disabled={disabled}>Entfernen</Button>
        </div>
      ))}
      <div className="flex gap-2 items-end flex-wrap">
        <TextInput id="blackout-start" label="Von" type="time" value={newBlackout.start} onChange={e => setNewBlackout(p => ({ ...p, start: e.target.value }))} fieldClassName="w-32" disabled={disabled} />
        <TextInput id="blackout-end" label="Bis" type="time" value={newBlackout.end} onChange={e => setNewBlackout(p => ({ ...p, end: e.target.value }))} fieldClassName="w-32" disabled={disabled} />
        <TextInput id="blackout-reason" label="Grund (optional)" fieldClassName="flex-1" value={newBlackout.reason ?? ''} onChange={e => setNewBlackout(p => ({ ...p, reason: e.target.value }))} placeholder="z.B. Mittagspause" disabled={disabled} />
        <Button onClick={add} disabled={disabled}>Hinzufügen</Button>
      </div>
    </div>
  )
}
