import { test, expect } from '@playwright/test'

test('app loads and shows the teams page', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('FBNM Turniermanager')).toBeVisible()
})
