import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { buildHtml, createHtmlZip, HTML_EXPORT_FONTS } from './html-export'
import { exportColors } from './export-colors'
import type { TournamentConfig, Schedule } from '@/types'

const tournament: TournamentConfig = {
  id: 't1', name: 'Sommer <Cup>', mode: 'round-robin', fields: 1,
  gameSettings: {
    periodsCount: 4, periodDurationMin: 5, breakBetweenPeriodsMin: 1,
    halfTimeBreakMin: 5, bufferBetweenGamesMin: 5, breakBetweenRoundsMin: 15,
    awardCeremonyMin: 15,
  },
  venue: {
    name: 'Halle', availabilityWindows: [{ start: '09:00', end: '20:00' }],
    blackoutPeriods: [], setupBufferMin: 30, teardownBufferMin: 30,
  },
  teams: [
    { id: 'a', name: 'Team A', logoUrl: '', color: '#000', contact: '', players: [] },
    { id: 'b', name: 'Team B', logoUrl: '', color: '#000', contact: '', players: [] },
  ],
}

const schedule: Schedule = {
  id: 's1', tournamentId: 't1', generatedAt: '2026-10-06T10:00:00Z',
  games: [
    {
      id: 'g1', homeTeamId: 'a', awayTeamId: 'b', stage: 'group', field: 1,
      scheduledStart: '09:30', scheduledEnd: '10:00', round: 1, gameNumber: 1, periodScores: [],
    },
  ],
  totalDurationMin: 30, estimatedEnd: '10:00',
}

describe('buildHtml', () => {
  const html = buildHtml(tournament, schedule)

  it('escapes the tournament name and lists the games', () => {
    expect(html).toContain('Sommer &lt;Cup&gt;')
    expect(html).toContain('Team A vs Team B')
    expect(html).toContain('1 Spiele · Ende ca. 10:00')
  })

  it('uses the shared DSS palette and no Fibalon colors or fonts', () => {
    expect(html).toContain(exportColors.tableHeaderBg)
    expect(html).toContain(exportColors.accent)
    expect(html).toContain(exportColors.zebra)
    expect(html).not.toMatch(/#004174|#002751|#f0f7fc/i)
    expect(html).not.toMatch(/Aller/)
  })

  it('declares one @font-face per bundled font with a relative fonts/ path', () => {
    for (const font of HTML_EXPORT_FONTS) {
      expect(html).toContain(`url('fonts/${font.fileName}') format('woff2')`)
      expect(html).toContain(`font-family: '${font.family}'`)
    }
    expect(html.match(/@font-face/g)).toHaveLength(HTML_EXPORT_FONTS.length)
  })
})

describe('createHtmlZip', () => {
  it('contains index.html and every referenced font file', async () => {
    const fonts = HTML_EXPORT_FONTS.map(f => ({ fileName: f.fileName, data: new Uint8Array([1, 2, 3]) }))
    const bytes = await createHtmlZip(tournament, schedule, fonts)
    const zip = await JSZip.loadAsync(bytes)

    expect(Object.keys(zip.files)).toContain('index.html')
    const html = await zip.file('index.html')!.async('string')
    const referenced = [...html.matchAll(/url\('(fonts\/[^']+)'\)/g)].map(m => m[1])
    expect(referenced.length).toBe(HTML_EXPORT_FONTS.length)
    for (const path of referenced) {
      expect(zip.file(path), `${path} fehlt in der ZIP`).not.toBeNull()
    }
  })
})
