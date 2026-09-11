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

  // Zeitplan generieren (auf der Konfigurationsseite)
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

    await expect(page.getByText('Turnier abgeschlossen. Siehe Turnierübersicht für das Endergebnis.')).not.toBeVisible()
    await page.getByRole('button', { name: 'Nächste Runde auslosen' }).click()
  }

  await expect(page.getByText('Turnier abgeschlossen. Siehe Turnierübersicht für das Endergebnis.')).toBeVisible()

  await page.getByRole('link', { name: 'Turnierübersicht' }).click()
  await expect(page.getByRole('table')).toBeVisible()
  // Kurze Teamnamen wie "Team A".."Team E" passen ohne Overflow in die Tabellenspalte, daher
  // zeigt die Tabelle den vollen Namen, nicht mehr das Kürzel.
  for (const name of ['Team A', 'Team B', 'Team C', 'Team D', 'Team E']) {
    await expect(page.getByRole('cell', { name, exact: true })).toBeVisible()
  }

  // Jedes gespielte Spiel (20:10, kein Unentschieden) verteilt genau 2 Punkte auf Heim+Auswärts,
  // jedes Freilos gibt dem Freilos-Team ebenfalls 2 Punkte. Pro Runde mit 5 Teams sind das
  // 2 Spiele (2 Punkte) + 1 Freilos (2 Punkte) = 6 Punkte, macht über totalRounds Runden
  // 6*totalRounds Punkte in Summe. Stimmt diese Summe, wurden ALLE Runden inkl. der letzten
  // tatsächlich gespeichert — würde die letzte Runde verloren gehen, fehlten hier 6 Punkte.
  const rows = page.getByRole('table').getByRole('row')
  const rowCount = await rows.count()
  let totalPoints = 0
  for (let i = 1; i < rowCount; i++) {
    const pointsCell = rows.nth(i).locator('td').nth(2)
    totalPoints += Number(await pointsCell.textContent())
  }
  expect(totalPoints).toBe(6 * totalRounds)
})

test('shows the team abbreviation instead of the full name once the viewport is below the md breakpoint', async ({ page }) => {
  await page.getByRole('link', { name: 'Teams' }).click()
  for (const name of ['Team A', 'Team B']) {
    await addTeam(page, name)
  }
  await expect(page.getByText('2 Teams')).toBeVisible()

  await page.getByRole('link', { name: 'Konfiguration' }).click()
  await selectMode(page, 'Einstufungsturnier (Schweizer System)')
  await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
  await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()

  await page.getByRole('link', { name: 'Turnierübersicht' }).click()
  await expect(page.getByRole('table')).toBeVisible()

  // Bei der Standard-Desktop-Breite (>= md, 768px) ist der volle Name sichtbar, das Kürzel
  // per CSS ausgeblendet (display:none), daher nicht "sichtbar" im Playwright-Sinne.
  await expect(page.getByRole('cell', { name: 'Team A', exact: true })).toBeVisible()
  await expect(page.getByText('TEA', { exact: true }).first()).not.toBeVisible()

  // Unterhalb von md schaltet reines CSS (keine JS-Messung) um: das Kürzel wird sichtbar,
  // der volle Name per CSS ausgeblendet.
  await page.setViewportSize({ width: 500, height: 800 })
  await expect(page.getByText('TEA', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Team A', exact: true })).not.toBeVisible()
})

test('lets the organizer navigate back to a completed round and correct a result through the UI', async ({ page }) => {
  await page.getByRole('link', { name: 'Teams' }).click()
  for (const name of ['Team A', 'Team B', 'Team C', 'Team D']) {
    await addTeam(page, name)
  }
  await expect(page.getByText('4 Teams')).toBeVisible()

  await page.getByRole('link', { name: 'Konfiguration' }).click()
  await selectMode(page, 'Einstufungsturnier (Schweizer System)')
  await page.getByLabel('Anzahl Runden').fill('2')

  await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
  await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()

  await page.getByRole('link', { name: 'Ergebnisse erfassen' }).click()
  await expect(page.getByText(/Runde 1 von 2/)).toBeVisible()

  const homeInputs = page.getByLabel(/^Ergebnis Heim, Spiel/)
  const gameCount = await homeInputs.count()
  for (let i = 0; i < gameCount; i++) {
    await page.getByLabel(/^Ergebnis Heim, Spiel/).nth(i).fill('20')
    await page.getByLabel(/^Ergebnis Auswärts, Spiel/).nth(i).fill('10')
  }
  await page.getByRole('button', { name: 'Nächste Runde auslosen' }).click()

  await expect(page.getByText(/Runde 2 von 2/)).toBeVisible()
  await expect(page.getByText(/bereits abgeschlossene Runde/)).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Nächste Runde auslosen' })).toBeVisible()

  await page.getByRole('button', { name: 'Runde 1', exact: true }).click()

  await expect(page.getByText(/bereits abgeschlossene Runde/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nächste Runde auslosen' })).not.toBeVisible()

  const correctButtons = page.getByRole('button', { name: 'Korrigieren' })
  await correctButtons.first().click()

  const correctedHomeInput = page.getByLabel(/^Korrigiertes Ergebnis Heim, Spiel/).first()
  await correctedHomeInput.fill('55')
  await page.getByRole('button', { name: 'Speichern' }).first().click()

  await expect(page.getByText('55')).toBeVisible()

  await page.getByRole('button', { name: 'Zur aktuellen Runde' }).click()
  await expect(page.getByText(/Runde 2 von 2/)).toBeVisible()
  await expect(page.getByText(/bereits abgeschlossene Runde/)).not.toBeVisible()
})
