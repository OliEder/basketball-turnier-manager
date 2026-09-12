import { expect, type Page } from '@playwright/test'

export async function addTeam(page: Page, name: string) {
  await page.getByRole('button', { name: 'Team hinzufügen' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name').fill(name)
  await dialog.getByRole('button', { name: 'Speichern' }).click()
  await expect(dialog).not.toBeVisible()
}

export async function selectMode(page: Page, label: string) {
  await page.locator('#tourney-mode').click()
  await page.getByRole('option', { name: label }).click()
}

export async function setupSwissTournament(page: Page, teamNames: string[], swissRounds?: number) {
  await page.goto('/teams')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  for (const name of teamNames) {
    await addTeam(page, name)
  }

  await page.getByRole('link', { name: 'Konfiguration' }).click()
  await selectMode(page, 'Einstufungsturnier (Schweizer System)')
  if (swissRounds !== undefined) {
    await page.getByLabel('Anzahl Runden').fill(String(swissRounds))
  }

  await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
  await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()

  await page.getByRole('link', { name: 'Ergebnisse erfassen' }).click()
  await expect(page.getByText(/Runde 1 von/)).toBeVisible()
}
