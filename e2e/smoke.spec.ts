import { test, expect } from '@playwright/test'

test('app loads and shows the manual as the landing page', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Nutzeranleitung: Basketball Turnier-Manager' })).toBeVisible()
})

test('the teams page is reachable and shows the team management UI', async ({ page }) => {
  await page.goto('/teams')
  await expect(page.getByRole('button', { name: 'Team hinzufügen' })).toBeVisible()
})
