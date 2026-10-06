// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { DEMOS, demoUrl, landingPathFor } from './demos'
import { parseTournamentImport } from './import/json-import'

const root = new URL('../../', import.meta.url)
const read = (file: string) => readFileSync(new URL(`public/demos/${file}`, root), 'utf8')

describe('DEMOS', () => {
  it('enthält fünf Einträge mit eindeutigen IDs und Dateien', () => {
    expect(DEMOS).toHaveLength(5)
    expect(new Set(DEMOS.map((d) => d.id)).size).toBe(5)
    expect(new Set(DEMOS.map((d) => d.file)).size).toBe(5)
  })

  it.each(DEMOS)('$file stimmt mit dem Manifest überein und ist importierbar', (entry) => {
    const result = parseTournamentImport(read(entry.file))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const games = result.schedule?.games ?? []
    expect(result.tournament.name).toBe(entry.title)
    expect(result.tournament.mode).toBe(entry.mode)
    expect(result.tournament.teams).toHaveLength(entry.teams)
    expect(new Set(result.tournament.teams.map((t) => t.groupId ?? 'A')).size).toBe(entry.groups)
    expect(games).toHaveLength(entry.games)
    expect(games.filter((g) => g.periodScores.length > 0)).toHaveLength(entry.played)
  })
})

describe('demoUrl', () => {
  it('hängt die Datei an die Basis-URL', () => {
    expect(demoUrl(DEMOS[0], '/basketball/')).toBe(`/basketball/demos/${DEMOS[0].file}`)
  })
})

describe('landingPathFor', () => {
  it('führt Schweizer System auf die Turnierübersicht', () => {
    expect(landingPathFor({ mode: 'swiss', groups: 1 })).toBe('/swiss-overview')
  })
  it('führt mehrere Gruppen auf die Gruppentabellen', () => {
    expect(landingPathFor({ mode: 'round-robin+finals', groups: 2 })).toBe('/group-overview')
  })
  it('führt Jeder gegen Jeden auf den Zeitplan', () => {
    expect(landingPathFor({ mode: 'round-robin', groups: 1 })).toBe('/schedule')
  })
})
