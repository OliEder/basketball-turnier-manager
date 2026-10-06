import JSZip from 'jszip'
import type { TournamentConfig, Schedule } from '@/types'
import { exportColors } from './export-colors'
import sora700 from '@fontsource/sora/files/sora-latin-700-normal.woff2?url'
import manrope400 from '@fontsource/manrope/files/manrope-latin-400-normal.woff2?url'
import manrope600 from '@fontsource/manrope/files/manrope-latin-600-normal.woff2?url'

/** Schriften, die in die ZIP gelegt werden (nur die tatsächlich genutzten Schnitte). */
export const HTML_EXPORT_FONTS = [
  { family: 'Sora', weight: 700, fileName: 'sora-latin-700-normal.woff2', url: sora700 },
  { family: 'Manrope', weight: 400, fileName: 'manrope-latin-400-normal.woff2', url: manrope400 },
  { family: 'Manrope', weight: 600, fileName: 'manrope-latin-600-normal.woff2', url: manrope600 },
] as const

export interface HtmlExportFontData {
  fileName: string
  data: Uint8Array
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const fontFaces = HTML_EXPORT_FONTS.map(
  font => `    @font-face { font-family: '${font.family}'; font-weight: ${font.weight}; font-style: normal; font-display: swap; src: url('fonts/${font.fileName}') format('woff2'); }`,
).join('\n')

export function buildHtml(tournament: TournamentConfig, schedule: Schedule): string {
  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))

  const rows = schedule.games.map(g => {
    const home = escapeHtml(g.homeTeamId ? (teamMap.get(g.homeTeamId)?.name ?? '?') : (g.homeLabel ?? '?'))
    const away = escapeHtml(g.awayTeamId ? (teamMap.get(g.awayTeamId)?.name ?? '?') : (g.awayLabel ?? '?'))
    return `<tr>
      <td>${g.gameNumber}</td>
      <td>Feld ${g.field}</td>
      <td>${g.scheduledStart} – ${g.scheduledEnd}</td>
      <td>${home} vs ${away}</td>
    </tr>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(tournament.name)}</title>
  <style>
${fontFaces}
    body { font-family: 'Manrope', system-ui, sans-serif; font-weight: 400; max-width: 800px; margin: 2rem auto; padding: 0 1rem; color: ${exportColors.text}; }
    h1 { font-family: 'Sora', system-ui, sans-serif; font-size: 1.75rem; font-weight: 700; color: ${exportColors.text}; margin-bottom: 0.25rem; padding-bottom: 0.4rem; border-bottom: 3px solid ${exportColors.accent}; }
    p { color: ${exportColors.textMuted}; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { padding: 0.5rem 1rem; text-align: left; border-bottom: 1px solid ${exportColors.border}; }
    th { font-weight: 600; background: ${exportColors.tableHeaderBg}; color: ${exportColors.tableHeaderText}; border-bottom: 2px solid ${exportColors.accent}; }
    tr:nth-child(even) td { background: ${exportColors.zebra}; }
  </style>
</head>
<body>
  <h1>${escapeHtml(tournament.name)}</h1>
  <p>${schedule.games.length} Spiele · Ende ca. ${schedule.estimatedEnd}</p>
  <table>
    <thead><tr><th>#</th><th>Feld</th><th>Zeit</th><th>Paarung</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`
}

/** Baut die ZIP-Datei (index.html + fonts/*.woff2) als Bytes; rein, damit sie testbar ist. */
export async function createHtmlZip(
  tournament: TournamentConfig,
  schedule: Schedule,
  fonts: HtmlExportFontData[],
): Promise<Uint8Array> {
  const zip = new JSZip()
  zip.file('index.html', buildHtml(tournament, schedule))
  for (const font of fonts) zip.file(`fonts/${font.fileName}`, font.data)
  return zip.generateAsync({ type: 'uint8array' })
}

async function loadFonts(): Promise<HtmlExportFontData[]> {
  return Promise.all(
    HTML_EXPORT_FONTS.map(async font => {
      const response = await fetch(font.url)
      if (!response.ok) throw new Error(`Schrift ${font.fileName} konnte nicht geladen werden (${response.status})`)
      return { fileName: font.fileName, data: new Uint8Array(await response.arrayBuffer()) }
    }),
  )
}

export async function downloadHtmlZip(tournament: TournamentConfig, schedule: Schedule): Promise<void> {
  const bytes = await createHtmlZip(tournament, schedule, await loadFonts())
  const blob = new Blob([bytes], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${tournament.name.replace(/\s+/g, '-')}-zeitplan.zip`
  a.click()
  URL.revokeObjectURL(url)
}
