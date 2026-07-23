import VenueForm from '@/components/venue/VenueForm'
import BlackoutList from '@/components/venue/BlackoutList'
import ScheduleView from '@/components/schedule/ScheduleView'

export default function SchedulePage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl text-brand-primary">Zeitplan</h1>
      <section className="space-y-4">
        <h2 className="text-lg text-brand-primary-light">Hallenkonfiguration</h2>
        <VenueForm />
        <BlackoutList />
      </section>
      <section className="space-y-4">
        <h2 className="text-lg text-brand-primary-light">Spielplan</h2>
        <ScheduleView />
      </section>
    </div>
  )
}
