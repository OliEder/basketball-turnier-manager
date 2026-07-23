import TournamentForm from '@/components/config/TournamentForm'
import GameSettingsForm from '@/components/config/GameSettingsForm'

export default function ConfigPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl text-brand-primary">Turnierkonfiguration</h1>
      <section className="space-y-4">
        <h2 className="text-lg text-brand-primary-light">Allgemein</h2>
        <TournamentForm />
      </section>
      <section className="space-y-4">
        <h2 className="text-lg text-brand-primary-light">Spieleinstellungen</h2>
        <GameSettingsForm />
      </section>
    </div>
  )
}
