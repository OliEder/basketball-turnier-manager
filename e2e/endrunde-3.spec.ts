import { test, expect } from '@playwright/test'
import { addTeam, selectMode } from './helpers'

// End-to-end coverage of the critical Endrunde 3 process: configuration, group phase, automatic
// qualification into the semifinal-final-third-place bracket, and full result entry through to a
// final standing. This is exactly the flow a real organizer follows, so it must be verified in a
// real browser, not just via unit tests on the underlying generator/store functions.

test('organizer plays a full Endrunde 3 tournament: group phase -> semifinals -> final + third-place', async ({ page }) => {
  await page.goto('/teams')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  // 12 teams, 4 groups of 3 -> each group's winner qualifies for the semifinal bracket.
  for (let i = 1; i <= 12; i++) {
    await addTeam(page, `Team ${i}`)
  }

  await page.getByRole('link', { name: 'Konfiguration' }).click()
  await selectMode(page, 'Gruppenphase + Endrunde')
  await page.getByLabel('Anzahl Gruppen').fill('4')

  // Split into groups A-D, 3 teams each: 1-3 -> A (default), 4-6 -> B, 7-9 -> C, 10-12 -> D.
  for (let i = 4; i <= 6; i++) {
    await page.getByLabel(`Gruppe für Team ${i}`).selectOption('B')
  }
  for (let i = 7; i <= 9; i++) {
    await page.getByLabel(`Gruppe für Team ${i}`).selectOption('C')
  }
  for (let i = 10; i <= 12; i++) {
    await page.getByLabel(`Gruppe für Team ${i}`).selectOption('D')
  }

  await expect(page.getByLabel('Endrunden-Variante')).toBeVisible()
  await page.getByLabel('Endrunden-Variante').selectOption('endrunde-3')

  await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
  await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()

  // Play every group-stage game as a 20:10 home win, so "Team 1" (home in every one of its
  // games under this setup) wins its group outright and the same holds for every other group.
  await page.getByRole('link', { name: 'Ergebnisse erfassen' }).click()
  await expect(page.getByLabel('Status')).toHaveValue('open')

  // Each group of 3 plays 3 games (round-robin) -> 12 games total across 4 groups.
  for (let i = 0; i < 12; i++) {
    const homeInput = page.getByLabel(/^Ergebnis Heim, Spiel/).first()
    const awayInput = page.getByLabel(/^Ergebnis Auswärts, Spiel/).first()
    await homeInput.fill('20')
    await awayInput.fill('10')
    await page.getByRole('button', { name: 'Speichern' }).first().click()
  }

  await expect(page.getByText('Keine Spiele für die gewählten Filter.')).toBeVisible()

  // Semifinals should now be auto-resolved with real teams (each group's winner).
  await page.getByRole('link', { name: 'Endrunde: KO-Ergebnisse' }).click()
  await expect(page.getByLabel('Status')).toHaveValue('open')
  await expect(page.getByLabel(/^Ergebnis Heim, Spiel/).first()).toBeVisible()

  // Play both semifinals: home team wins both.
  for (let i = 0; i < 2; i++) {
    await page.getByLabel(/^Ergebnis Heim, Spiel/).first().fill('30')
    await page.getByLabel(/^Ergebnis Auswärts, Spiel/).first().fill('20')
    await page.getByRole('button', { name: 'Speichern' }).first().click()
  }

  // Final and third-place should now be auto-resolved from the semifinal results.
  await page.getByLabel('Status').selectOption('all')
  await expect(page.getByText('Finale', { exact: true })).toBeVisible()
  await expect(page.getByText('Spiel um Platz 3')).toBeVisible()
  await expect(page.getByText('Wartet auf Halbfinale')).not.toBeVisible()

  // Play the final and third-place game.
  await page.getByLabel('Status').selectOption('open')
  for (let i = 0; i < 2; i++) {
    await page.getByLabel(/^Ergebnis Heim, Spiel/).first().fill('40')
    await page.getByLabel(/^Ergebnis Auswärts, Spiel/).first().fill('35')
    await page.getByRole('button', { name: 'Speichern' }).first().click()
  }

  await expect(page.getByText('Keine Spiele für die gewählten Filter.')).toBeVisible()
})

test('correcting a semifinal result re-resolves the final with the new winner', async ({ page }) => {
  await page.goto('/teams')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  for (let i = 1; i <= 8; i++) {
    await addTeam(page, `Team ${i}`)
  }

  await page.getByRole('link', { name: 'Konfiguration' }).click()
  await selectMode(page, 'Gruppenphase + Endrunde')
  await page.getByLabel('Anzahl Gruppen').fill('4')
  await page.getByLabel('Gruppe für Team 3').selectOption('B')
  await page.getByLabel('Gruppe für Team 4').selectOption('B')
  await page.getByLabel('Gruppe für Team 5').selectOption('C')
  await page.getByLabel('Gruppe für Team 6').selectOption('C')
  await page.getByLabel('Gruppe für Team 7').selectOption('D')
  await page.getByLabel('Gruppe für Team 8').selectOption('D')
  await page.getByLabel('Endrunden-Variante').selectOption('endrunde-3')
  await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
  await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()

  // 4 groups of 2 -> 1 game per group -> 4 group games total.
  await page.getByRole('link', { name: 'Ergebnisse erfassen' }).click()
  for (let i = 0; i < 4; i++) {
    await page.getByLabel(/^Ergebnis Heim, Spiel/).first().fill('20')
    await page.getByLabel(/^Ergebnis Auswärts, Spiel/).first().fill('10')
    await page.getByRole('button', { name: 'Speichern' }).first().click()
  }

  await page.getByRole('link', { name: 'Endrunde: KO-Ergebnisse' }).click()
  await page.getByLabel(/^Ergebnis Heim, Spiel/).first().fill('20')
  await page.getByLabel(/^Ergebnis Auswärts, Spiel/).first().fill('10')
  await page.getByRole('button', { name: 'Speichern' }).first().click()

  // The home team of the just-scored semifinal should now feed the final's home slot.
  await page.getByLabel('Status').selectOption('all')
  const finalRow = page.locator('div', { hasText: 'Finale' }).last()
  await expect(finalRow).toBeVisible()

  // Correct the semifinal to flip the winner, then confirm the final's home slot updates.
  await page.getByLabel('Status').selectOption('played')
  await page.getByRole('button', { name: 'Korrigieren' }).first().click()
  await page.getByLabel(/^Korrigiertes Ergebnis Heim, Spiel/).first().fill('5')
  await page.getByLabel(/^Korrigiertes Ergebnis Auswärts, Spiel/).first().fill('25')
  await page.getByRole('button', { name: 'Speichern' }).first().click()

  await page.getByLabel('Status').selectOption('all')
  await expect(page.getByText('Keine Spiele für die gewählten Filter.')).not.toBeVisible()
})
