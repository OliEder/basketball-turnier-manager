export interface SwissPairingResult {
  pairs: [string, string][]
  byeTeamId?: string
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
