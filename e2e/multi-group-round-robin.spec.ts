import { test, expect } from '@playwright/test'
import { addTeam, selectMode } from './helpers'

test('organizer sets up a multi-group round-robin tournament and sees per-group standings', async ({ page }) => {
  await page.goto('/teams')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  for (let i = 1; i <= 8; i++) {
    await addTeam(page, `Team ${i}`)
  }

  await page.getByRole('link', { name: 'Konfiguration' }).click()
  await selectMode(page, 'Gruppenphase + Endrunde')

  // 8 teams -> the group-count suggestion should default to 2 groups of 4.
  await expect(page.getByText(/Vorschlag: 2 Gruppen/)).toBeVisible()
  await expect(page.getByLabel('Anzahl Gruppen')).toHaveValue('2')

  // Split the 8 teams evenly: Team 1-4 stay in group A, Team 5-8 move to group B.
  for (let i = 5; i <= 8; i++) {
    await page.getByLabel(`Gruppe für Team ${i}`).selectOption('B')
  }

  await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
  await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()

  await page.getByRole('link', { name: 'Gruppentabellen' }).click()
  // Groups are shown one at a time via tabs; group A is active by default.
  await expect(page.getByRole('heading', { name: 'Gruppe A' })).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(1)

  // Each 4-team single round-robin group plays 6 games; group stage games should
  // be spread across more than one round, confirming the circle-method fix is in effect
  // (the reported bug had every round-robin game bunched into a single round).
  await expect(page.getByText(/Runde 1/)).toBeVisible()
  await expect(page.getByText(/Runde 2/)).toBeVisible()
  await expect(page.getByText(/Runde 3/)).toBeVisible()

  // Switch to group B via its tab and confirm its table replaces group A's.
  await page.getByRole('button', { name: 'Gruppe B' }).click()
  await expect(page.getByRole('heading', { name: 'Gruppe B' })).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(1)
})

test('a single-group round-robin+finals tournament does not show the group-overview nav link', async ({ page }) => {
  await page.goto('/teams')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  for (const name of ['Team 1', 'Team 2', 'Team 3', 'Team 4']) {
    await addTeam(page, name)
  }

  await page.getByRole('link', { name: 'Konfiguration' }).click()
  await selectMode(page, 'Gruppenphase + Endrunde')
  await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
  await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()

  // All 4 teams stay in the default group A -- only one group exists, so the
  // dedicated group-standings page must not appear in the nav (the existing
  // schedule view is enough for a single group).
  await expect(page.getByRole('link', { name: 'Gruppentabellen' })).not.toBeVisible()
  await expect(page.getByRole('link', { name: 'Zeitplan' })).toBeVisible()
})
