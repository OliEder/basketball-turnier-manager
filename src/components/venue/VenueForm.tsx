import { useTournamentStore } from '@/store/tournament-store'
import { TextInput } from '@bbv/dss-design-system/react'

export default function VenueForm({ disabled = false }: { disabled?: boolean }) {
  const { tournament, updateVenue } = useTournamentStore()
  const venue = tournament.venue
  const window = venue.availabilityWindows[0] ?? { start: '09:00', end: '20:00' }

  return (
    <div className="space-y-4 max-w-xl">
      <TextInput id="venue-name" label="Hallenname" value={venue.name} onChange={e => updateVenue({ name: e.target.value })} disabled={disabled} />
      <div className="grid grid-cols-2 gap-4">
        <TextInput
          id="venue-open" label="Öffnet" type="time" value={window.start}
          onChange={e => updateVenue({ availabilityWindows: [{ ...window, start: e.target.value }] })}
          disabled={disabled}
        />
        <TextInput
          id="venue-close" label="Schließt" type="time" value={window.end}
          onChange={e => updateVenue({ availabilityWindows: [{ ...window, end: e.target.value }] })}
          disabled={disabled}
        />
        <TextInput
          id="setup-buffer" label="Aufbauzeit (Min)" type="number" min={0} max={120}
          value={venue.setupBufferMin}
          onChange={e => updateVenue({ setupBufferMin: Number(e.target.value) })}
          disabled={disabled}
        />
        <TextInput
          id="teardown-buffer" label="Abbauzeit (Min)" type="number" min={0} max={120}
          value={venue.teardownBufferMin}
          onChange={e => updateVenue({ teardownBufferMin: Number(e.target.value) })}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
