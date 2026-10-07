import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banner, Button, Card } from '@bbv/dss-design-system/react'
import { DestructiveConfirmDialog } from '@/components/shared/DestructiveConfirmDialog'
import { DEMOS, landingPathFor, loadDemo, type DemoEntry } from '@/lib/demos'
import { useTournamentStore } from '@/store/tournament-store'
import type { Schedule, TournamentConfig } from '@/types'

interface Pending {
  entry: DemoEntry
  tournament: TournamentConfig
  schedule: Schedule | null
}

const MODE_LABEL: Record<DemoEntry['mode'], string> = {
  'round-robin': 'Jeder gegen Jeden',
  'round-robin+finals': 'Gruppen + Endrunde',
  swiss: 'Schweizer System',
}

export default function DemosPage() {
  const navigate = useNavigate()
  const { isTournamentLocked, importTournament } = useTournamentStore()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const apply = ({ entry, tournament, schedule }: Pending) => {
    importTournament(tournament, schedule)
    navigate(landingPathFor(entry))
  }

  const handleLoad = async (entry: DemoEntry) => {
    setError(null)
    setLoadingId(entry.id)
    const result = await loadDemo(entry)
    // Wurde die Seite währenddessen verlassen, soll das Demo das Turnier nicht mehr ersetzen.
    if (!mounted.current) return
    setLoadingId(null)
    if (!result.ok) {
      setError(result.error)
      return
    }
    const next = { entry, tournament: result.tournament, schedule: result.schedule }
    if (isTournamentLocked()) setPending(next)
    else apply(next)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl text-fg">Demo-Turniere</h1>
        <p className="text-mute">
          Lade ein Beispielturnier, um die App auszuprobieren. Ein bestehendes Turnier wird dabei ersetzt.
        </p>
      </div>

      {error && <Banner severity="danger">{error}</Banner>}

      <ul className="grid gap-4 sm:grid-cols-2">
        {DEMOS.map(entry => (
          <li key={entry.id} className="flex">
            <Card
              className="w-full"
              header={<h2 className="text-lg">{entry.title}</h2>}
              footer={
                <Button
                  size="sm"
                  disabled={loadingId !== null}
                  aria-label={`${entry.title} laden`}
                  onClick={() => void handleLoad(entry)}
                >
                  {loadingId === entry.id ? 'Lädt …' : 'Laden'}
                </Button>
              }
            >
              <p className="mb-2">{entry.description}</p>
              <p className="text-sm text-mute">
                {MODE_LABEL[entry.mode]} · {entry.teams} Teams · {entry.games} Spiele · {entry.played} erfasst
              </p>
            </Card>
          </li>
        ))}
      </ul>

      <DestructiveConfirmDialog
        open={pending !== null}
        onOpenChange={open => {
          if (!open) setPending(null)
        }}
        title="Änderung am laufenden Turnier"
        description="Das aktuelle Turnier läuft bereits (mindestens ein Ergebnis wurde erfasst). Das Laden eines Demo-Turniers ersetzt es vollständig."
        confirmWord="ÄNDERN"
        onConfirm={() => {
          if (pending) apply(pending)
          setPending(null)
        }}
      />
    </div>
  )
}
