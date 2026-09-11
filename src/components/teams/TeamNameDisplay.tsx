import type { Team } from '@/types'
import { cn, getTeamAbbreviation } from '@/lib/utils'

interface TeamNameDisplayProps {
  team: Team
  className?: string
}

export function TeamNameDisplay({ team, className }: TeamNameDisplayProps) {
  return (
    <span title={team.name} className={cn('block truncate min-w-0 font-medium', className)}>
      <span data-team-name="full" className="hidden md:inline">{team.name}</span>
      <span data-team-name="abbreviation" className="md:hidden">{getTeamAbbreviation(team)}</span>
    </span>
  )
}
