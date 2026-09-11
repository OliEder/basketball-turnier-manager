import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Team } from '@/types'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function getTeamAbbreviation(team: Team): string {
  if (team.abbreviation) return team.abbreviation
  const trimmed = team.name.trim()
  const lastChar = trimmed.slice(-1)
  const hasTrailingDigit = /\d/.test(lastChar)
  const base = trimmed.slice(0, 3).toUpperCase()
  return hasTrailingDigit ? `${base}${lastChar}` : base
}
