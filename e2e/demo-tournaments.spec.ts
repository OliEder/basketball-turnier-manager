import { test, expect } from '@playwright/test'
import { goTo } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/demos')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('ein Demo-Turnier laden füllt Teams und Zeitplan und öffnet die passende Übersicht', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Demo-Turniere', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: /Sommerturnier Musterstadt.*laden/ }).click()
  await expect(page).toHaveURL(/\/schedule$/)
  await goTo(page, 'Teams')
  await expect(page.getByText('9 Teams')).toBeVisible()
})

test('ein Schweizer-System-Demo landet auf der Turnierübersicht', async ({ page }) => {
  await page.getByRole('button', { name: /Einstufungsturnier Bezirksliga.*laden/ }).click()
  await expect(page).toHaveURL(/\/swiss-overview$/)
  await expect(page.getByRole('table')).toBeVisible()
})

test('läuft bereits ein Turnier mit Ergebnissen, ist eine Bestätigung nötig', async ({ page }) => {
  await page.getByRole('button', { name: /Sommerturnier Musterstadt.*laden/ }).click()
  await expect(page).toHaveURL(/\/schedule$/)

  await goTo(page, 'Demo-Turniere')
  await page.getByRole('button', { name: /Einstufungsturnier Bezirksliga.*laden/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Änderung am laufenden Turnier' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Bestätigen' })).toBeDisabled()

  await dialog.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page).toHaveURL(/\/demos$/)

  await page.getByRole('button', { name: /Einstufungsturnier Bezirksliga.*laden/ }).click()
  await dialog.getByRole('textbox').fill('ÄNDERN')
  await dialog.getByRole('button', { name: 'Bestätigen' }).click()
  await expect(page).toHaveURL(/\/swiss-overview$/)
})

test('die leere Teamseite verweist auf die Demo-Turniere', async ({ page }) => {
  await page.goto('/teams')
  await expect(page.getByText('Noch keine Teams')).toBeVisible()
  await page.getByRole('link', { name: 'Demo ansehen' }).click()
  await expect(page).toHaveURL(/\/demos$/)
})
