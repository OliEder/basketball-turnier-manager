import type { TournamentConfig, Schedule } from '@/types'

export type TournamentImportResult =
  | { ok: true; tournament: TournamentConfig; schedule: Schedule | null }
  | { ok: false; error: string }

function isValidTournament(value: unknown): value is TournamentConfig {
  if (typeof value !== 'object' || value === null) return false
  const t = value as Record<string, unknown>
  return (
    typeof t.id === 'string' &&
    typeof t.name === 'string' &&
    typeof t.mode === 'string' &&
    typeof t.fields === 'number' &&
    typeof t.gameSettings === 'object' && t.gameSettings !== null &&
    typeof t.venue === 'object' && t.venue !== null &&
    Array.isArray(t.teams)
  )
}

function isValidSchedule(value: unknown): value is Schedule {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Record<string, unknown>
  return (
    typeof s.id === 'string' &&
    typeof s.tournamentId === 'string' &&
    Array.isArray(s.games)
  )
}

export function parseTournamentImport(raw: string): TournamentImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'Die Datei enthält kein gültiges JSON.' }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: 'Unerwartetes Dateiformat.' }
  }
  const data = parsed as Record<string, unknown>

  if (!isValidTournament(data.tournament)) {
    return { ok: false, error: 'Die Datei enthält kein gültiges Turnier (fehlende oder falsche Felder).' }
  }

  if (data.schedule !== null && data.schedule !== undefined && !isValidSchedule(data.schedule)) {
    return { ok: false, error: 'Die Datei enthält einen ungültigen Zeitplan.' }
  }

  return {
    ok: true,
    tournament: data.tournament,
    schedule: (data.schedule as Schedule | null | undefined) ?? null,
  }
}
