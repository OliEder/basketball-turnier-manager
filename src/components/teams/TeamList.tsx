import { useState } from 'react'
import { useTournamentStore } from '@/store/tournament-store'
import TeamCard from './TeamCard'
import TeamForm from './TeamForm'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Team } from '@/types'

export default function TeamList() {
  const { tournament, addTeam, updateTeam, removeTeam } = useTournamentStore()
  const [showAdd, setShowAdd] = useState(false)
  const [editTeam, setEditTeam] = useState<Team | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{tournament.teams.length} Teams</p>
        <Button onClick={() => setShowAdd(true)}>Team hinzufügen</Button>
      </div>

      {tournament.teams.length === 0 && (
        <p className="text-muted-foreground text-center py-8">Noch keine Teams. Füge das erste Team hinzu.</p>
      )}

      <div className="space-y-2">
        {tournament.teams.map(team => (
          <TeamCard
            key={team.id}
            team={team}
            onEdit={() => setEditTeam(team)}
            onDelete={() => removeTeam(team.id)}
          />
        ))}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Team hinzufügen</DialogTitle></DialogHeader>
          <TeamForm
            onSubmit={(data) => { addTeam(data); setShowAdd(false) }}
            onCancel={() => setShowAdd(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTeam} onOpenChange={() => setEditTeam(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Team bearbeiten</DialogTitle></DialogHeader>
          {editTeam && (
            <TeamForm
              initial={editTeam}
              onSubmit={(data) => { updateTeam(editTeam.id, data); setEditTeam(null) }}
              onCancel={() => setEditTeam(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
