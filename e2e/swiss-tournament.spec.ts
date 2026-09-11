import { test, expect } from '@playwright/test'
import { addTeam, selectMode } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('plays through a full 5-team swiss tournament including a bye', async ({ page }) => {
  // Teams anlegen
  await page.getByRole('link', { name: 'Teams' }).click()
  for (const name of ['Team A', 'Team B', 'Team C', 'Team D', 'Team E']) {
    await addTeam(page, name)
  }
  await expect(page.getByText('5 Teams')).toBeVisible()

  // Konfiguration: Swiss-Modus
  await page.getByRole('link', { name: 'Konfiguration' }).click()
  await selectMode(page, 'Einstufungsturnier (Schweizer System)')
  await expect(page.getByLabel('Anzahl Runden')).toBeVisible()

  const totalRoundsStr = await page.getByLabel('Anzahl Runden').inputValue()
  const totalRounds = Number(totalRoundsStr)
  expect(totalRounds).toBeGreaterThan(0)

  // Zeitplan generieren (Route /schedule, kein Nav-Link im Swiss-Modus)
  await page.goto('/schedule')
  await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
  await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()

  await page.getByRole('link', { name: 'Ergebnisse erfassen' }).click()
  await expect(page.getByText(new RegExp(`Runde 1 von ${totalRounds}`))).toBeVisible()

  for (let round = 1; round <= totalRounds; round++) {
    await expect(page.getByText(new RegExp(`Runde ${round} von ${totalRounds}`))).toBeVisible()

    const homeInputs = page.getByLabel(/^Ergebnis Heim, Spiel/)
    const gameCount = await homeInputs.count()

    for (let i = 0; i < gameCount; i++) {
      await page.getByLabel(/^Ergebnis Heim, Spiel/).nth(i).fill('20')
      await page.getByLabel(/^Ergebnis Auswärts, Spiel/).nth(i).fill('10')
    }

    if (round < totalRounds) {
      await page.getByRole('button', { name: 'Nächste Runde auslosen' }).click()
    }
  }

  await expect(page.getByText('Turnier abgeschlossen. Siehe Turnierübersicht für das Endergebnis.')).toBeVisible()

  await page.getByRole('link', { name: 'Turnierübersicht' }).click()
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Team A' })).toBeVisible()
})
