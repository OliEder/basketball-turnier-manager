const SCREENSHOT_FILENAMES = [
  '01-teams-leer.png',
  '02-team-dialog-leer.png',
  '03-teams-liste.png',
  '04-team-bearbeiten.png',
  '05-konfiguration-allgemein.png',
  '06-konfiguration-swiss-rundenvorschlag.png',
  '07-konfiguration-spieleinstellungen.png',
  '08-konfiguration-halle.png',
  '09-konfiguration-zeitplan-generiert.png',
  '10-ergebnisse-runde1-leer.png',
  '11-ergebnisse-teilweise-ausgefuellt.png',
  '12-ergebnisse-runde1-komplett.png',
  '13-ergebnisse-runde2.png',
  '14-zurueckziehen-badge.png',
  '15-runde-auswaehler-vergangene-runde.png',
  '16-ergebnis-korrigieren.png',
  '17-ergebnis-korrigiert.png',
  '18-turnieruebersicht-tabelle.png',
  '19-turnieruebersicht-zeitplan.png',
  '20-konfiguration-gesperrt.png',
  '21-bestaetigungsdialog.png',
  '22-export-seite.png',
  '23-json-import-bereich.png',
] as const

async function fileToDataUri(url: string): Promise<string> {
  const response = await fetch(url)
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function loadManualScreenshotsAsDataUris(): Promise<Record<string, string>> {
  const base = import.meta.env.BASE_URL
  const entries = await Promise.all(
    SCREENSHOT_FILENAMES.map(async filename => {
      const dataUri = await fileToDataUri(`${base}anleitung/${filename}`)
      return [filename, dataUri] as const
    }),
  )
  return Object.fromEntries(entries)
}

export function renderManualPrintHtml(container: HTMLElement, images: Record<string, string>): string {
  const clone = container.cloneNode(true) as HTMLElement
  clone.querySelectorAll('img').forEach(img => {
    const filename = img.getAttribute('src')?.split('/').pop()
    if (filename && images[filename]) {
      img.setAttribute('src', images[filename])
    }
  })
  clone.querySelectorAll('button').forEach(button => button.remove())
  clone.querySelectorAll('nav[aria-label="Inhalt"]').forEach(nav => nav.remove())

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nutzeranleitung: Basketball Turnier-Manager</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; color: #002751; }
    h1, h2, h3 { font-family: 'Arial Black', sans-serif; text-transform: uppercase; color: #004174; }
    h1 { font-size: 1.6rem; }
    h2 { font-size: 1.2rem; margin-top: 2rem; }
    h3 { font-size: 1rem; }
    p, li { line-height: 1.5; }
    img { max-width: 100%; border: 1px solid #e2e8f0; border-radius: 4px; margin: 0.5rem 0; }
    ul, ol { padding-left: 1.5rem; }
    section { margin-bottom: 2rem; page-break-inside: avoid; }
    div[class*="border-brand-primary"] { border: 1px solid #94b8d1; background: #f0f7fc; border-radius: 4px; padding: 1rem; margin: 0.75rem 0; }
    @media print {
      body { margin: 0; max-width: none; }
      section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  ${clone.innerHTML}
</body>
</html>`
}

export async function openManualPrintWindow(): Promise<void> {
  const container = document.getElementById('manual-content')
  if (!container) return

  const images = await loadManualScreenshotsAsDataUris()
  const html = renderManualPrintHtml(container, images)
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const printWindow = window.open(url, '_blank')
  if (printWindow) {
    printWindow.addEventListener('load', () => {
      printWindow.print()
      URL.revokeObjectURL(url)
    })
  } else {
    URL.revokeObjectURL(url)
  }
}
