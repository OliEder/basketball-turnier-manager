import { test, expect } from '@playwright/test'
import { addTeam, selectMode, setupSwissTournament } from './helpers'

async function expectValidPdfDownload(downloadPromise: Promise<import('@playwright/test').Download>) {
  const download = await downloadPromise
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  const buffer = Buffer.concat(chunks)
  expect(buffer.length).toBeGreaterThan(0)
  expect(buffer.subarray(0, 5).toString('utf-8')).toBe('%PDF-')
}

test('organizer downloads the schedule as a PDF', async ({ page }) => {
  await page.goto('/teams')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await addTeam(page, 'Team A')
  await addTeam(page, 'Team B')

  await page.getByRole('link', { name: 'Konfiguration' }).click()
  await selectMode(page, 'Jeder gegen Jeden')
  await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
  await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()

  await page.getByRole('link', { name: 'Export' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'PDF herunterladen' }).click()
  await expectValidPdfDownload(downloadPromise)
})

test('organizer downloads the manual as a PDF', async ({ page }) => {
  await page.goto('/anleitung')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Als PDF herunterladen' }).click()
  await expectValidPdfDownload(downloadPromise)
})

test('organizer downloads the swiss-system overview as a PDF', async ({ page }) => {
  await setupSwissTournament(page, ['Team A', 'Team B', 'Team C', 'Team D'])

  await page.getByRole('link', { name: 'Turnierübersicht' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'PDF herunterladen' }).click()
  await expectValidPdfDownload(downloadPromise)
})

test('organizer downloads a single group overview as a PDF', async ({ page }) => {
  await page.goto('/teams')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  for (let i = 1; i <= 8; i++) {
    await addTeam(page, `Team ${i}`)
  }

  await page.getByRole('link', { name: 'Konfiguration' }).click()
  await selectMode(page, 'Gruppenphase + Endrunde')
  // 8 teams suggest 2 groups by default -- confirm and accept it, matching "Variante 3" in
  // all-tournament-variants.spec.ts. A groupCount > 1 config requires a chosen finals variant,
  // otherwise the generic single-bracket fallback produces semifinal/final placeholders that
  // can never resolve to real teams and schedule generation fails validation.
  await expect(page.getByText(/Vorschlag: 2 Gruppen/)).toBeVisible()

  for (let i = 5; i <= 8; i++) {
    await page.getByLabel(`Gruppe für Team ${i}`).selectOption('B')
  }

  // Required whenever groupCount > 1 -- without a chosen variant the generic single-bracket
  // fallback produces a semifinal/final whose placeholders can never resolve to real teams.
  await page.getByLabel('Endrunden-Variante').selectOption('endrunde-4')
  await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
  await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()

  await page.getByRole('link', { name: 'Gruppentabellen' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Diese Gruppe als PDF herunterladen' }).click()
  await expectValidPdfDownload(downloadPromise)
})
