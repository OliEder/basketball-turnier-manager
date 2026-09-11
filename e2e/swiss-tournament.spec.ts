import { test, expect, type Page } from '@playwright/test'

async function addTeam(page: Page, name: string) {
  await page.getByRole('button', { name: 'Team hinzufügen' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name').fill(name)
  await dialog.getByRole('button', { name: 'Speichern' }).click()
  await expect(dialog).not.toBeVisible()
}

async function selectMode(page: Page, label: string) {
  await page.locator('#tourney-mode').click()
  await page.getByRole('option', { name: label }).click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('plays through a full 5-team swiss tournament including a bye and a correction', async ({ page }) => {
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

  let correctionDone = false

  for (let round = 1; round <= totalRounds; round++) {
    await expect(page.getByText(new RegExp(`Runde ${round} von ${totalRounds}`))).toBeVisible()

    const homeInputs = page.getByLabel(/^Ergebnis Heim, Spiel/)
    const gameCount = await homeInputs.count()

    for (let i = 0; i < gameCount; i++) {
      // Re-query each time: after Speichern, the row switches from inputs to a result+Korrigieren display,
      // which shifts indices of the remaining "not yet entered" inputs.
      const home = page.getByLabel(/^Ergebnis Heim, Spiel/).first()
      const away = page.getByLabel(/^Ergebnis Auswärts, Spiel/).first()
      await home.fill('20')
      await away.fill('10')
      await page.getByRole('button', { name: 'Speichern' }).first().click()
    }

    // Alle Spiele der Runde sollten jetzt ausgewertet sein (Ergebnis + "Korrigieren"-Button sichtbar)
    await expect(page.getByLabel(/^Ergebnis Heim, Spiel/)).toHaveCount(0)

    if (round === 1 && !correctionDone) {
      // Ergebnis-Korrektur vor Rundenauslosung testen
      await page.getByRole('button', { name: 'Korrigieren' }).first().click()
      const correctedHome = page.getByLabel(/^Korrigiertes Ergebnis Heim/).first()
      const correctedAway = page.getByLabel(/^Korrigiertes Ergebnis Auswärts/).first()
      await correctedHome.fill('18')
      await correctedAway.fill('22')
      await page.getByRole('button', { name: 'Speichern' }).first().click()
      await expect(page.getByRole('button', { name: 'Korrigieren' })).toHaveCount(gameCount)
      correctionDone = true
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
