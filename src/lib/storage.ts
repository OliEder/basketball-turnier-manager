import type { TournamentConfig, Schedule } from '@/types'

const KEYS = {
  tournament: 'tm_tournament',
  schedule: 'tm_schedule',
} as const

export function saveTournament(config: TournamentConfig): void {
  localStorage.setItem(KEYS.tournament, JSON.stringify(config))
}

export function loadTournament(): TournamentConfig | null {
  const raw = localStorage.getItem(KEYS.tournament)
  if (!raw) return null
  return JSON.parse(raw) as TournamentConfig
}

export function saveSchedule(schedule: Schedule): void {
  localStorage.setItem(KEYS.schedule, JSON.stringify(schedule))
}

export function loadSchedule(): Schedule | null {
  const raw = localStorage.getItem(KEYS.schedule)
  if (!raw) return null
  return JSON.parse(raw) as Schedule
}

export function clearSchedule(): void {
  localStorage.removeItem(KEYS.schedule)
}

export function clearAll(): void {
  localStorage.removeItem(KEYS.tournament)
  localStorage.removeItem(KEYS.schedule)
}
