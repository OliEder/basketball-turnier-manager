const GROUP_COUNT_CANDIDATES = [1, 2, 4, 8, 16]

/**
 * Suggests a group count for a multi-group round-robin tournament.
 *
 * Picks from a fixed candidate list of power-of-2 group counts (so a later
 * knockout-bracket finals stage can be "clean" without needing byes),
 * choosing whichever candidate makes the resulting group size closest to a
 * target (3.5 teams/group normally, or 2 teams/group when double
 * round-robin is enabled, since double round-robin doubles game count per
 * group so smaller groups make more sense).
 *
 * On an exact tie in distance, prefers the smaller group count.
 */
export function suggestGroupCount(teamCount: number, doubleRoundRobin: boolean): number {
  const targetSize = doubleRoundRobin ? 2 : 3.5
  const validCandidates = GROUP_COUNT_CANDIDATES.filter(c => c <= teamCount)
  if (validCandidates.length === 0) return 1

  let best = validCandidates[0]
  let bestDistance = Math.abs(teamCount / best - targetSize)
  for (const candidate of validCandidates.slice(1)) {
    const distance = Math.abs(teamCount / candidate - targetSize)
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }
  return best
}
