import { test, expect } from '@playwright/test'
import { addTeam, selectMode } from './helpers'

// UC6 (docs/use-cases-und-kritikalitaet.md) is rated critical -- the JSON export is the only
// backup path, since the app is otherwise localStorage-only (see arc42 ADR-01). This was
// previously only covered indirectly via the import path (multi-group-round-robin-large.spec.ts
// imports a hand-built fixture of the same shape) -- the export click itself, which actually
// exercises downloadJson() in a real browser, was never triggered. Closes risk R3.

test('organizer downloads a full JSON backup of the tournament', async ({ page }) => {
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
  await expect(page.getByRole('button', { name: 'JSON herunterladen' })).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'JSON herunterladen' }).click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toMatch(/-zeitplan\.json$/)

  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  const content = JSON.parse(Buffer.concat(chunks).toString('utf-8'))

  expect(content.tournament.teams).toHaveLength(2)
  expect(content.tournament.teams.map((t: { name: string }) => t.name).sort()).toEqual(['Team A', 'Team B'])
  expect(content.schedule.games.length).toBeGreaterThan(0)
  expect(content.exportedAt).toBeTruthy()
})
