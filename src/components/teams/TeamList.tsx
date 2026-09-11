import { useState } from 'react'
import { useTournamentStore } from '@/store/tournament-store'
import TeamCard from './TeamCard'
import TeamForm from './TeamForm'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DestructiveConfirmDialog } from '@/components/ui/destructive-confirm-dialog'
import type { Team } from '@/types'

export default function TeamList() {
  const { tournament, addTeam, updateTeam, removeTeam, isTournamentLocked } = useTournamentStore()
  const locked = isTournamentLocked()
  const [showAdd, setShowAdd] = useState(false)
  const [editTeam, setEditTeam] = useState<Team | null>(null)
  const [pendingAdd, setPendingAdd] = useState<Omit<Team, 'id' | 'players'> | null>(null)
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null)

  const handleAddSubmit = (data: Omit<Team, 'id' | 'players'>) => {
    setShowAdd(false)
    if (locked) {
      setPendingAdd(data)
    } else {
      addTeam(data)
    }
  }

  const handleRemove = (id: string) => {
    if (locked) {
      setPendingRemoveId(id)
    } else {
      removeTeam(id)
    }
  }

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
            onDelete={() => handleRemove(team.id)}
          />
        ))}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Team hinzufügen</DialogTitle></DialogHeader>
          <TeamForm
            onSubmit={(data) => handleAddSubmit({ ...data, abbreviation: data.abbreviation.trim() || undefined })}
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
              onSubmit={(data) => {
                updateTeam(editTeam.id, { ...data, abbreviation: data.abbreviation.trim() || undefined })
                setEditTeam(null)
              }}
              onCancel={() => setEditTeam(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <DestructiveConfirmDialog
        open={pendingAdd !== null || pendingRemoveId !== null}
        onOpenChange={(open) => { if (!open) { setPendingAdd(null); setPendingRemoveId(null) } }}
        title="Änderung am laufenden Turnier"
        description="Das Turnier läuft bereits (mindestens ein Ergebnis wurde erfasst). Teams hinzuzufügen oder zu entfernen kann den weiteren Turnierverlauf beeinträchtigen."
        confirmWord="ÄNDERN"
        onConfirm={() => {
          if (pendingAdd) addTeam(pendingAdd)
          if (pendingRemoveId) removeTeam(pendingRemoveId)
          setPendingAdd(null)
          setPendingRemoveId(null)
        }}
      />
    </div>
  )
}
