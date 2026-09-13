import { test, expect } from '@playwright/test'
import { addTeam, selectMode } from './helpers'

test('the field-count dropdown offers up to 6 fields, not just 4', async ({ page }) => {
  await page.goto('/teams')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  for (let i = 1; i <= 2; i++) await addTeam(page, `Team ${i}`)

  await page.getByRole('link', { name: 'Konfiguration' }).click()
  await page.locator('#tourney-fields').click()

  // Regression test: this dropdown was hardcoded to only 1-4 fields, so once an organizer
  // touched it they could never select more than 4 fields again -- with many groups but a
  // starved field count, games queue up almost entirely sequentially, which looks like a
  // group-to-field mapping bug but is really just this artificial cap.
  await expect(page.getByRole('option', { name: '6 Felder' })).toBeVisible()
  await page.getByRole('option', { name: '6 Felder' }).click()
  await expect(page.locator('#tourney-fields')).toContainText('6 Felder')
})

test('organizer cannot generate a schedule for multiple groups without choosing a finals variant', async ({ page }) => {
  await page.goto('/teams')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  for (let i = 1; i <= 8; i++) await addTeam(page, `Team ${i}`)

  await page.getByRole('link', { name: 'Konfiguration' }).click()
  await selectMode(page, 'Gruppenphase + Endrunde')
  await page.getByLabel('Anzahl Gruppen').fill('4')

  // Regression test: without this gate, generateSchedule falls through to a generic
  // single-bracket path with no group-rank source for the semifinal/final -- those placeholders
  // ("1. der Vorrunde" etc.) can then NEVER resolve to real teams, no matter how the group phase
  // turns out.
  await expect(page.getByRole('button', { name: 'Zeitplan generieren' })).toBeDisabled()
  await expect(page.getByText(/Endrunden-Variante auswählen/i)).toBeVisible()

  await page.locator('#finals-variant').selectOption('endrunde-3')

  await expect(page.getByRole('button', { name: 'Zeitplan generieren' })).toBeEnabled()
  await expect(page.getByText(/Endrunden-Variante auswählen/i)).not.toBeVisible()
})

test('a failed schedule regeneration shows an explanatory alert instead of silently keeping the stale schedule', async ({ page }) => {
  await page.goto('/teams')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  // 12 teams, 4 groups of 3 -- same configuration as the endrunde-3 E2E spec, known to fit
  // comfortably within the default venue hours.
  for (let i = 1; i <= 12; i++) await addTeam(page, `Team ${i}`)

  await page.getByRole('link', { name: 'Konfiguration' }).click()
  await selectMode(page, 'Gruppenphase + Endrunde')
  await page.getByLabel('Anzahl Gruppen').fill('4')
  for (let i = 4; i <= 6; i++) await page.getByLabel(`Gruppe für Team ${i}`).selectOption('B')
  for (let i = 7; i <= 9; i++) await page.getByLabel(`Gruppe für Team ${i}`).selectOption('C')
  for (let i = 10; i <= 12; i++) await page.getByLabel(`Gruppe für Team ${i}`).selectOption('D')
  await page.getByLabel('Endrunden-Variante').selectOption('endrunde-3')

  await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
  await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()

  // Shrink the venue so drastically (after a schedule already exists) that the
  // semifinal/final/third-place bracket can no longer fit -- this is the same shape of change
  // as adding a blackout period that eats the only remaining slot: a regeneration attempt that
  // must fail, without silently discarding the previously generated, still-valid schedule.
  await page.getByLabel('Öffnet').fill('09:00')
  await page.getByLabel('Schließt').fill('09:05')

  await page.getByRole('button', { name: 'Zeitplan generieren' }).click()

  await expect(page.getByText(/Zeitplan konnte nicht neu generiert werden/i)).toBeVisible()
  await expect(page.getByText(/Hallenzeit/)).toBeVisible()
  // The schedule summary line reflects the last successfully generated schedule, still intact.
  await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()
})
