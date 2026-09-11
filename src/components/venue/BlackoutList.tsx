import { useState } from 'react'
import { useTournamentStore } from '@/store/tournament-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
          <Button size="sm" variant="destructive" className="ml-auto" onClick={() => remove(i)} disabled={disabled}>Entfernen</Button>
        </div>
      ))}
      <div className="flex gap-2 items-end flex-wrap">
        <div className="space-y-1">
          <Label htmlFor="blackout-start">Von</Label>
          <Input id="blackout-start" type="time" value={newBlackout.start} onChange={e => setNewBlackout(p => ({ ...p, start: e.target.value }))} className="w-32" disabled={disabled} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="blackout-end">Bis</Label>
          <Input id="blackout-end" type="time" value={newBlackout.end} onChange={e => setNewBlackout(p => ({ ...p, end: e.target.value }))} className="w-32" disabled={disabled} />
        </div>
        <div className="space-y-1 flex-1">
          <Label htmlFor="blackout-reason">Grund (optional)</Label>
          <Input id="blackout-reason" value={newBlackout.reason ?? ''} onChange={e => setNewBlackout(p => ({ ...p, reason: e.target.value }))} placeholder="z.B. Mittagspause" disabled={disabled} />
        </div>
        <Button onClick={add} disabled={disabled}>Hinzufügen</Button>
      </div>
    </div>
  )
}
