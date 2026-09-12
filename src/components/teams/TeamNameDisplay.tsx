import type { Team } from '@/types'
import { cn, getTeamAbbreviation } from '@/lib/utils'

interface TeamNameDisplayProps {
  team: Team
  className?: string
}

export function TeamNameDisplay({ team, className }: TeamNameDisplayProps) {
  return (
    <span title={team.name} className={cn('inline-flex items-center gap-1.5 min-w-0 font-medium', className)}>
      {team.logoUrl && (
        <img
          src={team.logoUrl}
          alt={team.name}
          className="w-5 h-5 flex-shrink-0 object-contain rounded-full"
        />
      )}
      <span className="truncate min-w-0">
        <span data-team-name="full" className="hidden md:inline">{team.name}</span>
        <span data-team-name="abbreviation" className="md:hidden">{getTeamAbbreviation(team)}</span>
      </span>
    </span>
  )
}
