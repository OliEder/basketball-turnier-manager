import type { TeamStanding } from './standings'

export interface SwissPairingResult {
  pairs: [string, string][]
  byeTeamId?: string
}

export class PairingConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PairingConflictError'
  }
}

export interface SwissPairingInput {
  standings: TeamStanding[]
  playedPairs: Set<string>
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function pairFirstSwissRound(teamIds: string[]): SwissPairingResult {
  const shuffled = shuffle(teamIds)
  let byeTeamId: string | undefined
  if (shuffled.length % 2 === 1) {
    byeTeamId = shuffled.pop()
  }
  const pairs: [string, string][] = []
  for (let i = 0; i < shuffled.length; i += 2) {
    pairs.push([shuffled[i], shuffled[i + 1]])
  }
  return { pairs, byeTeamId }
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|')
}

function backtrackPairs(pool: string[], playedPairs: Set<string>): [string, string][] | null {
  if (pool.length === 0) return []
  const [first, ...rest] = pool
  for (let i = 0; i < rest.length; i++) {
    const candidate = rest[i]
    if (playedPairs.has(pairKey(first, candidate))) continue
    const remaining = [...rest.slice(0, i), ...rest.slice(i + 1)]
    const subResult = backtrackPairs(remaining, playedPairs)
    if (subResult !== null) {
      return [[first, candidate], ...subResult]
    }
  }
  return null
}

export function pairNextSwissRound(input: SwissPairingInput): SwissPairingResult {
  const { standings, playedPairs } = input
  const active = standings.filter(s => !s.withdrawn)

  let byeTeamId: string | undefined
  let pool = active.map(s => s.teamId)

  if (pool.length % 2 === 1) {
    const byeCandidates = [...active].sort((a, b) => a.points - b.points)
    const chosen = byeCandidates.find(s => !s.hadBye) ?? byeCandidates[0]
    byeTeamId = chosen.teamId
    pool = pool.filter(id => id !== byeTeamId)
  }

  const result = backtrackPairs(pool, playedPairs)
  if (result === null) {
    throw new PairingConflictError('Keine gültige Paarung mehr möglich — zu viele Runden für die Teamanzahl')
  }

  return { pairs: result, byeTeamId }
}
