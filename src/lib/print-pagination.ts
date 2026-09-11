export function computeRoundPageBreaks(
  rounds: number[],
  gamesPerRound: Map<number, number>,
  threshold = 15,
): Set<number> {
  let runningSum = 0
  const breakBefore = new Set<number>()

  for (const round of rounds) {
    if (runningSum >= threshold) {
      breakBefore.add(round)
      runningSum = 0
    }
    runningSum += gamesPerRound.get(round) ?? 0
  }

  return breakBefore
}
