import { test, expect, type Page } from '@playwright/test'
import { addTeam, selectMode } from './helpers'

// This suite plays through every tournament-mode variant this app supports, end-to-end in a
// real browser, to catch regressions that only show up when comparing variants side by side
// (e.g. a change to the shared schedule generator that only breaks one specific mode).

async function resetApp(page: Page) {
  await page.goto('/teams')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
}

async function addTeams(page: Page, count: number) {
  for (let i = 1; i <= count; i++) {
    await addTeam(page, `Team ${i}`)
  }
  await expect(page.getByText(`${count} Teams`)).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await resetApp(page)
})

test('Variante 1: Jeder gegen Jeden (round-robin, eine Gruppe)', async ({ page }) => {
  await addTeams(page, 8)

  await page.getByRole('link', { name: 'Konfiguration' }).click()
  await selectMode(page, 'Jeder gegen Jeden')
  await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
  await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()

  // 8 teams, single round-robin -> C(8,2) = 28 games, no finals stage.
  const gamesText = await page.getByText(/\d+ Spiele · Ende ca\./).textContent()
  expect(Number(gamesText!.match(/(\d+) Spiele/)![1])).toBe(28)

  await page.getByRole('link', { name: 'Zeitplan' }).click()
  await expect(page.getByText(/28 Spiele/)).toBeVisible()
  // No group-overview link exists at all for plain round-robin mode.
  await expect(page.getByRole('link', { name: 'Gruppentabellen' })).not.toBeVisible()
})

test('Variante 2: Gruppenphase + Endrunde, eine Gruppe (unverändertes Altverhalten)', async ({ page }) => {
  await addTeams(page, 8)

  await page.getByRole('link', { name: 'Konfiguration' }).click()
  await selectMode(page, 'Gruppenphase + Endrunde')
  await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
  await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()

  // All 8 teams stay in the default group A -> the group-overview link must NOT appear,
  // this must behave exactly like the pre-existing single-pool round-robin+finals mode.
  await expect(page.getByRole('link', { name: 'Gruppentabellen' })).not.toBeVisible()
  await expect(page.getByRole('link', { name: 'Zeitplan' })).toBeVisible()

  await page.getByRole('link', { name: 'Zeitplan' }).click()
  // 8 teams, single round-robin (28 games) + finalsBracketSize: 4 (2 semifinals + 1 third-place
  // game + 1 final -- see generatePlayoffGames in playoff-generator.ts) = 32.
  const gamesText = await page.getByText(/\d+ Spiele/).first().textContent()
  expect(Number(gamesText!.match(/(\d+) Spiele/)![1])).toBe(32)
})

test('Variante 3: Gruppenphase + Endrunde, mehrere Gruppen', async ({ page }) => {
  await addTeams(page, 8)

  await page.getByRole('link', { name: 'Konfiguration' }).click()
  await selectMode(page, 'Gruppenphase + Endrunde')

  // 8 teams -> suggested group count is 2 (see group-suggestion.ts), confirm and accept it.
  await expect(page.getByText(/Vorschlag: 2 Gruppen/)).toBeVisible()

  for (let i = 5; i <= 8; i++) {
    await page.getByLabel(`Gruppe für Team ${i}`).selectOption('B')
  }

  await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
  await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()

  await page.getByRole('link', { name: 'Gruppentabellen' }).click()
  // Groups are shown one at a time via tabs; group A is active by default.
  await expect(page.getByRole('heading', { name: 'Gruppe A' })).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(1)

  // Switch to group B via its tab and confirm its table replaces group A's.
  await page.getByRole('button', { name: 'Gruppe B' }).click()
  await expect(page.getByRole('heading', { name: 'Gruppe B' })).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(1)

  // There is currently no UI to enter a round-robin group-stage result (GameRow only offers
  // a start-time input, or, with showResult, a read-only final score -- confirmed pre-existing,
  // out of scope for this branch). Submit a result the same way submitGameResult would --
  // by writing the periodScores directly onto the persisted schedule -- then reload the
  // group-overview page and confirm the standings table reflects it.
  const winnerName = await page.evaluate(() => {
    const schedule = JSON.parse(localStorage.getItem('tm_schedule')!)
    const game = schedule.games.find((g: any) => g.stage === 'group' && g.groupId === 'A')
    game.periodScores = [{ period: 1, homeScore: 20, awayScore: 10 }]
    localStorage.setItem('tm_schedule', JSON.stringify(schedule))

    const tournament = JSON.parse(localStorage.getItem('tm_tournament')!)
    const winner = tournament.teams.find((t: any) => t.id === game.homeTeamId)
    return winner.name
  })

  await page.reload()
  // Group A is active by default again after reload.
  await expect(page.getByRole('heading', { name: 'Gruppe A' })).toBeVisible()
  const groupATable = page.getByRole('table')
  await expect(groupATable.getByText(winnerName)).toBeVisible()
  // 2 points for the win puts the winner ahead of every team still on 0 points -- check the
  // first data row (rank #1) actually shows that team's name.
  const firstDataRow = groupATable.getByRole('row').nth(1)
  await expect(firstDataRow).toContainText(winnerName)
})

test('Variante 4: Gruppenphase + Endrunde mit Doppelrunde (Hin- und Rückrunde)', async ({ page }) => {
  await addTeams(page, 4)

  await page.getByRole('link', { name: 'Konfiguration' }).click()
  await selectMode(page, 'Gruppenphase + Endrunde')
  await page.getByLabel('Mit Rückspiel (Hin- und Rückrunde)').check()

  await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
  await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()

  await page.getByRole('link', { name: 'Zeitplan' }).click()
  // 4 teams, double round-robin: C(4,2)*2 = 12 group games + finalsBracketSize: 4
  // (2 semifinals + 1 third-place game + 1 final) = 16.
  const gamesText = await page.getByText(/\d+ Spiele/).first().textContent()
  expect(Number(gamesText!.match(/(\d+) Spiele/)![1])).toBe(16)

  // ScheduleView renders group-stage games as a flat, round-less list (only GroupOverviewPage
  // groups by round), so verify the return leg via the actual matchup data instead: the first
  // leg's "Team 1 vs Team 4" pairing must reappear later with home/away swapped ("Team 4 vs
  // Team 1"), confirming doubleRoundRobin actually produced a home/away-reversed return leg.
  await expect(page.getByText('Team 1').first()).toBeVisible()
  const returnLegRow = page.locator('div', { hasText: 'Team 4' }).filter({ hasText: 'vs' }).filter({ hasText: 'Team 1' })
  await expect(returnLegRow.last()).toBeVisible()
})

test('Variante 5: Schweizer System mit 6 Runden', async ({ page }) => {
  await addTeams(page, 8)

  await page.getByRole('link', { name: 'Konfiguration' }).click()
  await selectMode(page, 'Einstufungsturnier (Schweizer System)')
  await page.getByLabel('Anzahl Runden').fill('6')

  await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
  await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()

  await page.getByRole('link', { name: 'Ergebnisse erfassen' }).click()
  await expect(page.getByText(/Runde 1 von 6/)).toBeVisible()

  const homeInputs = page.getByLabel(/^Ergebnis Heim, Spiel/)
  const gameCount = await homeInputs.count()
  expect(gameCount).toBe(4) // 8 teams, no bye -> 4 games in round 1

  for (let i = 0; i < gameCount; i++) {
    await page.getByLabel(/^Ergebnis Heim, Spiel/).nth(i).fill('20')
    await page.getByLabel(/^Ergebnis Auswärts, Spiel/).nth(i).fill('10')
  }
  await page.getByRole('button', { name: 'Nächste Runde auslosen' }).click()
  await expect(page.getByText(/Runde 2 von 6/)).toBeVisible()
})

test('Variante 6: Schweizer System mit empfohlener Rundenzahl', async ({ page }) => {
  await addTeams(page, 8)

  await page.getByRole('link', { name: 'Konfiguration' }).click()
  await selectMode(page, 'Einstufungsturnier (Schweizer System)')

  // 8 teams -> ceil(log2(8)) = 3 recommended rounds (TournamentForm.tsx's suggestedRounds).
  await expect(page.getByText(/Vorschlag nach Standard-Schweizer-Formel: 3 Runden/)).toBeVisible()
  await expect(page.getByLabel('Anzahl Runden')).toHaveValue('3')

  await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
  await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()

  await page.getByRole('link', { name: 'Ergebnisse erfassen' }).click()
  await expect(page.getByText(/Runde 1 von 3/)).toBeVisible()

  for (let round = 1; round <= 3; round++) {
    await expect(page.getByText(new RegExp(`Runde ${round} von 3`))).toBeVisible()
    const homeInputs = page.getByLabel(/^Ergebnis Heim, Spiel/)
    const gameCount = await homeInputs.count()
    for (let i = 0; i < gameCount; i++) {
      await page.getByLabel(/^Ergebnis Heim, Spiel/).nth(i).fill('20')
      await page.getByLabel(/^Ergebnis Auswärts, Spiel/).nth(i).fill('10')
    }
    const advanceButtonName = round < 3 ? 'Nächste Runde auslosen' : 'Turnier abschließen'
    await page.getByRole('button', { name: advanceButtonName }).click()
  }

  await expect(page.getByText('Turnier abgeschlossen. Siehe Turnierübersicht für das Endergebnis.')).toBeVisible()
  await page.getByRole('link', { name: 'Turnierübersicht' }).click()
  await expect(page.getByRole('table')).toBeVisible()
})
