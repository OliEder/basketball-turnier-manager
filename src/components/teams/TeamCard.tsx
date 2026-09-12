import { Button } from '@/components/ui/button'
import type { Team } from '@/types'

interface Props {
  team: Team
  onEdit: () => void
  onDelete: () => void
}

export default function TeamCard({ team, onEdit, onDelete }: Props) {
  return (
    <div className="flex items-center gap-4 p-4 border border-border rounded-md bg-card">
      <div
        className="w-10 h-10 rounded-full flex-shrink-0"
        style={{ backgroundColor: team.color }}
      >
        {team.logoUrl && (
          // Decorative: the team name is already shown as adjacent text below.
          <img src={team.logoUrl} alt="" className="w-full h-full object-contain rounded-full" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">
          {team.name}
          {team.abbreviation && <span className="text-xs text-muted-foreground ml-2">({team.abbreviation})</span>}
        </p>
        {team.contact && <p className="text-sm text-muted-foreground truncate">{team.contact}</p>}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onEdit}>Bearbeiten</Button>
        <Button size="sm" variant="destructive" onClick={onDelete}>Löschen</Button>
      </div>
    </div>
  )
}
