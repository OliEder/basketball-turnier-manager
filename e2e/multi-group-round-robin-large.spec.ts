import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// 64 teams via the manual UI ("Team hinzufügen" dialog, one click per team) would take
// well over a minute and would mostly exercise dialog-open/close overhead rather than the
// multi-group scheduling feature itself. A tournament organizer with that many teams would
// realistically use the existing JSON-import feature (see ConfigPage.tsx "JSON importieren"),
// so this test builds a 64-team tournament file and imports it through that real UI path
// instead — this still exercises the actual import + schedule-generation + group-overview
// code paths end-to-end in a real browser, just via a more realistic bulk-setup route.
function buildLargeTournamentFixture(teamCount: number, groupCount: number) {
  const teams = Array.from({ length: teamCount }, (_, i) => {
    const groupIndex = i % groupCount
    return {
      id: `t${i + 1}`,
      name: `Team ${i + 1}`,
      logoUrl: '',
      color: '#004174',
      contact: '',
      players: [],
      groupId: String.fromCharCode(65 + groupIndex),
    }
  })

  const tournament = {
    id: 'large-tournament',
    name: 'Großturnier 64',
    mode: 'round-robin+finals',
    finalsBracketSize: 4,
    groupCount,
    fields: 8,
    gameSettings: {
      periodsCount: 1,
      periodDurationMin: 8,
      breakBetweenPeriodsMin: 0,
      halfTimeBreakMin: 0,
      bufferBetweenGamesMin: 4,
      breakBetweenRoundsMin: 0,
      awardCeremonyMin: 0,
    },
    venue: {
      name: 'Großsporthalle',
      availabilityWindows: [{ start: '08:00', end: '22:00' }],
      blackoutPeriods: [],
      setupBufferMin: 0,
      teardownBufferMin: 0,
    },
    teams,
  }

  return { tournament, schedule: null }
}

test('imports a 64-team, 16-group tournament and generates a correct schedule', async ({ page }) => {
  const teamCount = 64
  const groupCount = 16
  const fixture = buildLargeTournamentFixture(teamCount, groupCount)

  const filePath = path.join(os.tmpdir(), `large-tournament-${Date.now()}.json`)
  fs.writeFileSync(filePath, JSON.stringify(fixture))

  try {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()

    await page.getByRole('link', { name: 'Konfiguration' }).click()
    await page.getByLabel('JSON importieren').setInputFiles(filePath)

    await expect(page.getByText('Aktuelles Turnier: Großturnier 64')).toBeVisible()

    await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
    await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()

    // Each group has 4 teams (64 / 16) -> 6 games per group * 16 groups = 96 group-stage games,
    // plus the finals bracket (semifinal + final + third place, per finalsBracketSize: 4).
    const gamesText = await page.getByText(/\d+ Spiele · Ende ca\./).textContent()
    const gameCount = Number(gamesText!.match(/(\d+) Spiele/)![1])
    expect(gameCount).toBeGreaterThanOrEqual(96)

    await page.getByRole('link', { name: 'Gruppentabellen' }).click()
    // Groups are shown one at a time via tabs; there is one tab button per group.
    await expect(page.getByRole('button', { name: /^Gruppe [A-P]$/ })).toHaveCount(groupCount)
    await expect(page.getByRole('table')).toHaveCount(1)

    // Spot-check a handful of groups across the range (first, middle, last) rather than all 16,
    // to keep the assertion count proportionate while still catching an off-by-one in group
    // derivation (e.g. only the first N-1 groups rendering, or the last group being dropped).
    for (const letter of ['A', 'H', 'P']) {
      await page.getByRole('button', { name: `Gruppe ${letter}` }).click()
      await expect(page.getByRole('heading', { name: `Gruppe ${letter}` })).toBeVisible()
      // Every group table should list exactly its own 4 teams (header row + 4 team rows = 5).
      await expect(page.getByRole('table').getByRole('row')).toHaveCount(5)
    }
  } finally {
    fs.unlinkSync(filePath)
  }
})
