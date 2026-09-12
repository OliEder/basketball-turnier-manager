import { useTournamentStore } from '@/store/tournament-store'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function FinalsVariantForm({ disabled = false }: { disabled?: boolean }) {
  const { tournament, setFinalsVariant, setDropoutHandling } = useTournamentStore()

  const groupSizes = new Map<string, number>()
  for (const team of tournament.teams) {
    const groupId = team.groupId ?? 'A'
    groupSizes.set(groupId, (groupSizes.get(groupId) ?? 0) + 1)
  }
  const sizes = [...groupSizes.values()]
  // More than one distinct group size (among groups that actually have teams) means the groups
  // aren't all equal; a single group never counts as "uneven".
  const hasUnevenGroups = sizes.length > 1 && new Set(sizes).size > 1

  // Rough estimate assuming every group reaches every rank tier (errs toward overestimating,
  // never under) — a round-robin of n teams plays n*(n-1)/2 games, one cohort per rank tier.
  const groupCount = tournament.groupCount ?? 1
  const smallestGroupSize = sizes.length > 0 ? Math.min(...sizes) : 0
  const gamesPerCohort = (groupCount * (groupCount - 1)) / 2
  const estimatedExtraGames = smallestGroupSize * gamesPerCohort
  const showCapacityWarning = estimatedExtraGames >= 20

  return (
    <div className="space-y-4 max-w-md">
      <div className="space-y-1">
        <Label htmlFor="finals-variant">Endrunden-Variante</Label>
        <select
          id="finals-variant"
          className="border border-border rounded-sm px-2 py-1 text-sm w-full"
          value={tournament.finalsVariant ?? 'endrunde-4'}
          onChange={e => setFinalsVariant(e.target.value as 'endrunde-4')}
          disabled={disabled}
        >
          <option value="endrunde-4">
            Endrunde 4 — Platzierungsgruppen (jeder gegen jeden je Rangstufe)
          </option>
        </select>
      </div>

      {hasUnevenGroups && (
        <Alert>
          <AlertDescription>
            Die Gruppen sind unterschiedlich groß. Die Anzahl der Rangstufen richtet sich nach der
            kleinsten Gruppe — Teams auf niedrigeren Rängen in größeren Gruppen nehmen an keiner
            Platzierungsgruppe teil.
          </AlertDescription>
        </Alert>
      )}

      {showCapacityWarning && (
        <Alert>
          <AlertDescription>
            Diese Konfiguration erzeugt schätzungsweise {estimatedExtraGames} zusätzliche Spiele für
            die Endrunde. Prüfe, ob die verfügbare Hallenzeit und Feldanzahl dafür ausreichen —
            ansonsten Gruppenanzahl reduzieren oder mehr Felder/Zeit einplanen.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-1">
        <Label htmlFor="dropout-handling">Bei Rückzug in der Endrunde</Label>
        <select
          id="dropout-handling"
          className="border border-border rounded-sm px-2 py-1 text-sm w-full"
          value={tournament.dropoutHandling ?? 'next-best-fills-in'}
          onChange={e => setDropoutHandling(e.target.value as 'walkover' | 'next-best-fills-in')}
          disabled={true}
        >
          <option value="next-best-fills-in">Nächster Nachrücker rückt nach</option>
          <option value="walkover">Gegner rückt kampflos vor (Walkover)</option>
        </select>
        <p className="text-xs text-muted-foreground">
          Bei „Endrunde 4“ gibt es keine Nachrücker — ein Rückzug wird immer als Walkover gewertet.
          Diese Einstellung wird erst für künftige KO-Endrunden-Varianten wirksam.
        </p>
      </div>
    </div>
  )
}
