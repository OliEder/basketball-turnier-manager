import { describe, it, expect } from 'vitest'
import type { AppNavGroup, AppNavItem, AppNavLink } from '@bbv/dss-design-system/react'
import type { Schedule, TournamentConfig } from '@/types'
import { buildNavigation, SCHEDULE_REQUIRED_HINT } from './navigation'

function tournament(overrides: Partial<TournamentConfig> = {}, groupIds: string[] = ['A']): TournamentConfig {
  return {
    id: 't1',
    name: 'Test',
    mode: 'round-robin',
    fields: 2,
    teams: groupIds.map((groupId, i) => ({ id: `team${i}`, name: `Team ${i}`, groupId })),
    ...overrides,
  } as unknown as TournamentConfig
}

const SCHEDULE = { id: 's1', tournamentId: 't1', games: [{ id: 'g1' }] } as unknown as Schedule

const isGroup = (item: AppNavItem): item is AppNavGroup => 'items' in item
const group = (items: AppNavItem[], id: string) => items.find((i): i is AppNavGroup => isGroup(i) && i.id === id)!
const labels = (g: AppNavGroup) => g.items.map((i) => i.label)
const find = (items: AppNavItem[], id: string): AppNavLink => {
  for (const item of items) {
    if (isGroup(item)) {
      const hit = item.items.find((l) => l.id === id)
      if (hit) return hit
    } else if (item.id === id) return item
  }
  throw new Error(`kein Eintrag ${id}`)
}

describe('buildNavigation', () => {
  it('liefert die Gruppen Vorbereiten, Spielen, Ansehen, den Export-Link und Hilfe', () => {
    const nav = buildNavigation({ tournament: tournament(), schedule: null })
    expect(nav.map((i) => i.id)).toEqual(['prepare', 'play', 'view', 'export', 'help'])
    expect(labels(group(nav, 'prepare'))).toEqual(['Teams', 'Konfiguration'])
    expect(labels(group(nav, 'help'))).toEqual(['Anleitung', 'Demo-Turniere'])
    expect(isGroup(find(nav, 'export'))).toBe(false)
  })

  it('sperrt Einträge, die einen Zeitplan brauchen, solange keiner existiert', () => {
    const nav = buildNavigation({ tournament: tournament(), schedule: null })
    for (const id of ['results', 'schedule']) {
      expect(find(nav, id)).toMatchObject({ disabled: true, hint: SCHEDULE_REQUIRED_HINT })
    }
    for (const id of ['teams', 'config', 'export', 'manual', 'demos']) {
      expect(find(nav, id).disabled).toBeUndefined()
    }
  })

  it('schaltet die Einträge frei, sobald ein Zeitplan mit Spielen existiert', () => {
    const nav = buildNavigation({ tournament: tournament(), schedule: SCHEDULE })
    expect(find(nav, 'results').disabled).toBeUndefined()
    expect(find(nav, 'schedule').disabled).toBeUndefined()
  })

  it('behandelt einen Zeitplan ohne Spiele wie keinen Zeitplan', () => {
    const empty = { ...SCHEDULE, games: [] } as unknown as Schedule
    expect(find(buildNavigation({ tournament: tournament(), schedule: empty }), 'schedule').disabled).toBe(true)
  })

  it('zeigt im Schweizer System Ergebnisse und Turnierübersicht, aber keinen Zeitplan', () => {
    const nav = buildNavigation({ tournament: tournament({ mode: 'swiss' }), schedule: SCHEDULE })
    expect(labels(group(nav, 'play'))).toEqual(['Ergebnisse erfassen'])
    expect(labels(group(nav, 'view'))).toEqual(['Turnierübersicht'])
    expect(find(nav, 'results').href).toBe('/swiss-results')
    expect(find(nav, 'overview').href).toBe('/swiss-overview')
  })

  it('zeigt Gruppentabellen nur bei mehreren Gruppen', () => {
    const single = buildNavigation({ tournament: tournament({}, ['A', 'A']), schedule: SCHEDULE })
    const multi = buildNavigation({ tournament: tournament({}, ['A', 'B']), schedule: SCHEDULE })
    expect(labels(group(single, 'view'))).toEqual(['Zeitplan'])
    expect(labels(group(multi, 'view'))).toEqual(['Zeitplan', 'Gruppentabellen'])
  })

  it('ergänzt bei Endrunde 4 Endrunden-Ergebnisse und Endstand', () => {
    const t = tournament({ mode: 'round-robin+finals', finalsVariant: 'endrunde-4' }, ['A', 'B'])
    const nav = buildNavigation({ tournament: t, schedule: SCHEDULE })
    expect(labels(group(nav, 'play'))).toEqual(['Ergebnisse erfassen', 'Endrunde: Ergebnisse'])
    expect(labels(group(nav, 'view'))).toEqual(['Zeitplan', 'Gruppentabellen', 'Endstand'])
  })

  it('ergänzt bei Endrunde 3 die KO-Ergebnisse ohne Endstand', () => {
    const t = tournament({ mode: 'round-robin+finals', finalsVariant: 'endrunde-3' }, ['A', 'B'])
    const nav = buildNavigation({ tournament: t, schedule: SCHEDULE })
    expect(labels(group(nav, 'play'))).toEqual(['Ergebnisse erfassen', 'Endrunde: KO-Ergebnisse'])
    expect(labels(group(nav, 'view'))).not.toContain('Endstand')
  })

  it('ergänzt bei Endrunde 1 die K.-o.-Ergebnisse und den Endstand', () => {
    const t = tournament({ mode: 'round-robin+finals', finalsVariant: 'endrunde-1' }, ['A', 'B'])
    const nav = buildNavigation({ tournament: t, schedule: SCHEDULE })
    expect(labels(group(nav, 'play'))).toEqual(['Ergebnisse erfassen', 'Endrunde: K.-o.-Ergebnisse'])
    expect(labels(group(nav, 'view'))).toContain('Endstand')
  })

  it('ignoriert eine Endrunden-Variante, wenn der Modus keine Endrunde hat', () => {
    const t = tournament({ mode: 'round-robin', finalsVariant: 'endrunde-4' })
    const nav = buildNavigation({ tournament: t, schedule: SCHEDULE })
    expect(labels(group(nav, 'play'))).toEqual(['Ergebnisse erfassen'])
  })

  it('stellt basePath allen Pfaden voran', () => {
    const nav = buildNavigation({ tournament: tournament(), schedule: SCHEDULE, basePath: '/turniere/abc' })
    expect(find(nav, 'teams').href).toBe('/turniere/abc/teams')
    expect(find(nav, 'demos').href).toBe('/turniere/abc/demos')
  })

  it('lässt keine Gruppe leer', () => {
    for (const mode of ['round-robin', 'swiss', 'round-robin+finals'] as const) {
      const nav = buildNavigation({ tournament: tournament({ mode }), schedule: null })
      for (const item of nav) if (isGroup(item)) expect(item.items.length).toBeGreaterThan(0)
    }
  })
})
