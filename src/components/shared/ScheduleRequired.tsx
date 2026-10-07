import { Link } from 'react-router-dom'
import { EmptyState } from '@bbv/dss-design-system/react'

/** Leerzustand für alle Seiten, die erst nach dem Generieren eines Zeitplans Sinn ergeben. */
export function ScheduleRequired({ page = 'Konfiguration' }: { page?: string }) {
  return (
    <EmptyState
      tone="action"
      title="Noch kein Zeitplan"
      body={`Bitte zuerst einen Zeitplan generieren (Seite „${page}“).`}
      actions={
        <Link to="/config" className="dss-btn dss-btn--md dss-btn--amber">
          Zur Konfiguration
        </Link>
      }
    />
  )
}
