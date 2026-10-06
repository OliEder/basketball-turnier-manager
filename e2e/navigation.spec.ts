import { test, expect } from '@playwright/test'
import { addTeam, goTo, selectMode } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/teams')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('Hauptnavigation ist nach Zweck gruppiert und navigiert über die Gruppen', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  for (const group of ['Vorbereiten', 'Spielen', 'Ansehen', 'Hilfe']) {
    await expect(nav.getByRole('button', { name: group, exact: true })).toBeVisible()
  }
  await expect(nav.getByRole('link', { name: 'Export', exact: true })).toBeVisible()

  await goTo(page, 'Konfiguration')
  await expect(page).toHaveURL(/\/config$/)
  await expect(nav.getByRole('button', { name: 'Vorbereiten', exact: true })).toHaveAttribute('aria-expanded', 'false')
  await goTo(page, 'Anleitung')
  await expect(page).toHaveURL(/\/anleitung$/)
})

test('Gruppe lässt sich mit Esc schließen, der Fokus kehrt zum Auslöser zurück', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  const trigger = nav.getByRole('button', { name: 'Vorbereiten', exact: true })
  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await nav.getByRole('link', { name: 'Teams', exact: true }).focus()
  await page.keyboard.press('Escape')
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(trigger).toBeFocused()
})

test('aktuelle Seite ist mit aria-current markiert', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await nav.getByRole('button', { name: 'Vorbereiten', exact: true }).click()
  await expect(nav.getByRole('link', { name: 'Teams', exact: true })).toHaveAttribute('aria-current', 'page')
})

test('Einträge, die einen Zeitplan brauchen, sind vorher gesperrt und danach Links', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await nav.getByRole('button', { name: 'Ansehen', exact: true }).click()
  const locked = nav.getByRole('link', { name: /^Zeitplan/ })
  await expect(locked).toHaveAttribute('aria-disabled', 'true')
  await expect(locked).not.toHaveAttribute('href', /.*/)

  await addTeam(page, 'Team A')
  await addTeam(page, 'Team B')
  await goTo(page, 'Konfiguration')
  await selectMode(page, 'Jeder gegen Jeden')
  await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
  await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()

  await goTo(page, 'Zeitplan')
  await expect(page).toHaveURL(/\/schedule$/)
})

test('auf dem Handy öffnet der Menü-Button die Navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  const toggle = nav.getByRole('button', { name: 'Menü' })
  await expect(toggle).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Vorbereiten', exact: true })).toBeHidden()
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await nav.getByRole('button', { name: 'Vorbereiten', exact: true }).click()
  await nav.getByRole('link', { name: 'Konfiguration', exact: true }).click()
  await expect(page).toHaveURL(/\/config$/)
})
