import { useTournamentStore } from '@/store/tournament-store'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function VenueForm({ disabled = false }: { disabled?: boolean }) {
  const { tournament, updateVenue } = useTournamentStore()
  const venue = tournament.venue
  const window = venue.availabilityWindows[0] ?? { start: '09:00', end: '20:00' }

  return (
    <div className="space-y-4 max-w-xl">
      <div className="space-y-1">
        <Label htmlFor="venue-name">Hallenname</Label>
        <Input id="venue-name" value={venue.name} onChange={e => updateVenue({ name: e.target.value })} disabled={disabled} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="venue-open">Öffnet</Label>
          <Input
            id="venue-open" type="time" value={window.start}
            onChange={e => updateVenue({ availabilityWindows: [{ ...window, start: e.target.value }] })}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="venue-close">Schließt</Label>
          <Input
            id="venue-close" type="time" value={window.end}
            onChange={e => updateVenue({ availabilityWindows: [{ ...window, end: e.target.value }] })}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="setup-buffer">Aufbauzeit (Min)</Label>
          <Input
            id="setup-buffer" type="number" min={0} max={120}
            value={venue.setupBufferMin}
            onChange={e => updateVenue({ setupBufferMin: Number(e.target.value) })}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="teardown-buffer">Abbauzeit (Min)</Label>
          <Input
            id="teardown-buffer" type="number" min={0} max={120}
            value={venue.teardownBufferMin}
            onChange={e => updateVenue({ teardownBufferMin: Number(e.target.value) })}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  )
}
