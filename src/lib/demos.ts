import type { TournamentConfig } from '@/types'
import { parseTournamentImport, type TournamentImportResult } from '@/lib/import/json-import'

export interface DemoEntry {
  id: string
  file: string
  /** Muss dem Turniernamen in der JSON-Datei entsprechen (Test prüft das). */
  title: string
  description: string
  mode: TournamentConfig['mode']
  teams: number
  groups: number
  games: number
  played: number
}

export const DEMOS: DemoEntry[] = [
  {
    id: 'round-robin',
    file: '01-jeder-gegen-jeden-9-teams-laufend.json',
    title: 'Sommerturnier Musterstadt (Jeder gegen Jeden)',
    description: 'Neun Teams spielen eine einfache Runde, acht Spiele sind bereits erfasst.',
    mode: 'round-robin',
    teams: 9,
    groups: 1,
    games: 36,
    played: 8,
  },
  {
    id: 'groups-finals',
    file: '02-gruppenphase-endrunde-9-teams-laufend.json',
    title: 'Verbandsturnier Rhein-Main (Gruppenphase + Endrunde)',
    description: 'Zwei Gruppen mit anschließender Endrunde, acht Gruppenspiele sind erfasst.',
    mode: 'round-robin+finals',
    teams: 9,
    groups: 2,
    games: 20,
    played: 8,
  },
  {
    id: 'swiss',
    file: '03-schweizer-system-9-teams-laufend.json',
    title: 'Einstufungsturnier Bezirksliga (Schweizer System)',
    description: 'Neun Teams im Schweizer System, die erste Runde ist teilweise gespielt.',
    mode: 'swiss',
    teams: 9,
    groups: 1,
    games: 20,
    played: 4,
  },
  {
    id: 'large-fresh',
    file: '04-grossturnier-64-teams-16-gruppen-ungespielt.json',
    title: 'Verbandsturnier Süd (Großturnier, 64 Teams)',
    description: '64 Teams in 16 Gruppen mit Endrunde, noch kein Spiel erfasst.',
    mode: 'round-robin+finals',
    teams: 64,
    groups: 16,
    games: 100,
    played: 0,
  },
  {
    id: 'large-running',
    file: '05-grossturnier-64-teams-16-gruppen-laufend.json',
    title: 'Verbandsturnier Süd (Großturnier, 64 Teams, laufend)',
    description: '64 Teams in 16 Gruppen mit Endrunde, 32 Spiele sind erfasst.',
    mode: 'round-robin+finals',
    teams: 64,
    groups: 16,
    games: 100,
    played: 32,
  },
]

export function demoUrl(entry: DemoEntry, base: string = import.meta.env.BASE_URL): string {
  return `${base}demos/${entry.file}`
}

/** Seite, auf der ein frisch geladenes Demo-Turnier startet. */
export function landingPathFor(entry: Pick<DemoEntry, 'mode' | 'groups'>): string {
  if (entry.mode === 'swiss') return '/swiss-overview'
  if (entry.groups > 1) return '/group-overview'
  return '/schedule'
}

export async function loadDemo(entry: DemoEntry, fetcher: typeof fetch = fetch): Promise<TournamentImportResult> {
  let response: Response
  try {
    response = await fetcher(demoUrl(entry))
  } catch {
    return { ok: false, error: 'Das Demo-Turnier konnte nicht geladen werden (keine Verbindung).' }
  }
  if (!response.ok) {
    return { ok: false, error: `Das Demo-Turnier konnte nicht geladen werden (Fehler ${response.status}).` }
  }
  return parseTournamentImport(await response.text())
}
