import { useTournamentStore } from '@/store/tournament-store'
import { Button } from '@bbv/dss-design-system/react'
import { downloadJson } from '@/lib/export/json-export'
import { downloadHtmlZip } from '@/lib/export/html-export'
import { downloadPdf } from '@/lib/export/pdf-export'
import { ScheduleRequired } from '@/components/shared/ScheduleRequired'

export default function ExportPanel() {
  const { tournament, schedule } = useTournamentStore()
  const ready = !!schedule && schedule.games.length > 0

  if (!ready) {
    return <ScheduleRequired page="Zeitplan" />
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {schedule!.games.length} Spiele, Ende ca. {schedule!.estimatedEnd}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => downloadPdf(tournament, schedule!)}>
          PDF herunterladen
        </Button>
        <Button variant="ghost" onClick={() => downloadHtmlZip(tournament, schedule!)}>
          Web-Seite (ZIP) herunterladen
        </Button>
        <Button variant="ghost" onClick={() => downloadJson(tournament, schedule)}>
          JSON herunterladen
        </Button>
      </div>
    </div>
  )
}
