import type { TournamentConfig, Schedule } from '@/types'

export function downloadJson(tournament: TournamentConfig, schedule: Schedule | null): void {
  const data = { tournament, schedule, exportedAt: new Date().toISOString() }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${tournament.name.replace(/\s+/g, '-')}-zeitplan.json`
  a.click()
  URL.revokeObjectURL(url)
}
