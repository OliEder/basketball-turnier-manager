import { useTournamentStore } from '@/store/tournament-store'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { downloadJson } from '@/lib/export/json-export'
import { downloadHtmlZip } from '@/lib/export/html-export'
import { downloadPdf } from '@/lib/export/pdf-export'

export default function ExportPanel() {
  const { tournament, schedule } = useTournamentStore()
  const ready = !!schedule && schedule.games.length > 0

  if (!ready) {
    return (
      <Alert>
        <AlertDescription>Bitte zuerst einen Zeitplan generieren (Seite „Zeitplan“).</AlertDescription>
      </Alert>
    )
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
        <Button variant="outline" onClick={() => downloadHtmlZip(tournament, schedule!)}>
          Web-Seite (ZIP) herunterladen
        </Button>
        <Button variant="outline" onClick={() => downloadJson(tournament, schedule)}>
          JSON herunterladen
        </Button>
      </div>
    </div>
  )
}
