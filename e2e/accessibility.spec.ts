import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { addTeam, selectMode, setupSwissTournament } from './helpers'

async function expectNoSeriousViolations(page: Page) {
  // Wait for web fonts to finish loading/settling before measuring color contrast.
  // Without this, axe-core can sample glyphs mid-swap between a fallback font and
  // the intended web font, which is especially likely to misfire on a machine that
  // also has a same-named system font installed (e.g. "Aller") — the two can race
  // for which one paints the text, producing flaky, non-representative contrast
  // readings that don't match the actual (correct) CSS color values. document.fonts.ready
  // only guarantees the font-loading process has settled, not that every face resolved
  // successfully, so a short fixed wait is added as a pragmatic buffer for the final paint.
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test.describe('WCAG 2.1 AA — critical pages', () => {
  test('teams page', async ({ page }) => {
    await page.goto('/teams')
    await expectNoSeriousViolations(page)
  })

  test('teams page with a team added (list + card state)', async ({ page }) => {
    await page.goto('/teams')
    await addTeam(page, 'Team A')
    await expectNoSeriousViolations(page)
  })

  test('config page', async ({ page }) => {
    await page.goto('/config')
    await expectNoSeriousViolations(page)
  })

  test('config page with swiss mode selected (reveals rounds field + alert)', async ({ page }) => {
    await page.goto('/config')
    await selectMode(page, 'Einstufungsturnier (Schweizer System)')
    await expect(page.getByLabel('Anzahl Runden')).toBeVisible()
    await expectNoSeriousViolations(page)
  })

  test('swiss results page', async ({ page }) => {
    await setupSwissTournament(page, ['Team A', 'Team B', 'Team C', 'Team D'])
    await expectNoSeriousViolations(page)
  })

  test('swiss overview page', async ({ page }) => {
    await setupSwissTournament(page, ['Team A', 'Team B', 'Team C', 'Team D'])
    await page.getByRole('link', { name: 'Turnierübersicht' }).click()
    await expect(page.getByRole('table')).toBeVisible()
    await expectNoSeriousViolations(page)
  })

  test('score entry UI state', async ({ page }) => {
    await setupSwissTournament(page, ['Team A', 'Team B', 'Team C', 'Team D'])

    const home = page.getByLabel(/^Ergebnis Heim, Spiel/).first()
    const away = page.getByLabel(/^Ergebnis Auswärts, Spiel/).first()
    await home.fill('20')
    await away.fill('10')
    await expect(page.getByLabel(/^Ergebnis erfasst, Spiel/)).toBeVisible()

    await expectNoSeriousViolations(page)
  })

  test('manual pairing dialog state', async ({ page }) => {
    // 4 Teams => nur 6 einzigartige Paarungen möglich. Mit genügend Runden und immer
    // identischem Ergebnismuster (Heimteam gewinnt) läuft der Paarungsalgorithmus
    // (Backtracking ohne Wiederholung gespielter Paare) irgendwann in eine Sackgasse —
    // siehe e2e/swiss-operational-safety.spec.ts für den vollständigen Regressionstest
    // dieses Verhaltens; hier interessiert uns nur der gerenderte Zustand des Dialogs.
    await setupSwissTournament(page, ['Team A', 'Team B', 'Team C', 'Team D'], 8)

    let manualPairingShown = false

    for (let round = 1; round <= 8; round++) {
      await expect(page.getByText(new RegExp(`Runde ${round} von`))).toBeVisible()

      const homeInputs = page.getByLabel(/^Ergebnis Heim, Spiel/)
      const gameCount = await homeInputs.count()
      if (gameCount === 0) break

      for (let i = 0; i < gameCount; i++) {
        await page.getByLabel(/^Ergebnis Heim, Spiel/).nth(i).fill('20')
        await page.getByLabel(/^Ergebnis Auswärts, Spiel/).nth(i).fill('10')
      }

      if (await page.getByText('Turnier abgeschlossen. Siehe Turnierübersicht für das Endergebnis.').isVisible().catch(() => false)) {
        break
      }

      const advanceButton = page.getByRole('button', { name: 'Nächste Runde auslosen' })
      if (!(await advanceButton.isVisible().catch(() => false))) break
      await advanceButton.click()

      if (await page.getByText(/Automatische Paarung nicht möglich/).isVisible().catch(() => false)) {
        manualPairingShown = true
        break
      }
    }

    expect(manualPairingShown, 'Paarungskonflikt wurde nicht ausgelöst — Testaufbau prüfen').toBe(true)
    await expect(page.getByRole('button', { name: 'Paarungen übernehmen' })).toBeVisible()

    await expectNoSeriousViolations(page)
  })

  test('export page', async ({ page }) => {
    await page.goto('/export')
    await expectNoSeriousViolations(page)
  })

  test('Endrunde 4 results page (Platzierungsgruppen)', async ({ page }) => {
    // 8 teams, 2 groups of 4 -> smallest group size 4 -> up to 4 rank tiers, each a
    // round-robin placement cohort. Minimal valid Endrunde-4 setup.
    await page.goto('/teams')
    for (let i = 1; i <= 8; i++) {
      await addTeam(page, `Team ${i}`)
    }
    await page.getByRole('link', { name: 'Konfiguration' }).click()
    await selectMode(page, 'Gruppenphase + Endrunde')
    await page.getByLabel('Anzahl Gruppen').fill('2')
    for (let i = 5; i <= 8; i++) {
      await page.getByLabel(`Gruppe für Team ${i}`).selectOption('B')
    }
    await page.getByLabel('Endrunden-Variante').selectOption('endrunde-4')
    await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
    await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()

    await page.getByRole('link', { name: 'Endrunde: Ergebnisse' }).click()
    await expect(page.getByLabel('Status')).toBeVisible()
    await expectNoSeriousViolations(page)
  })

  test('Endrunde 1 bracket results page (per-rank-tier tabs)', async ({ page }) => {
    // 8 teams, 2 groups of 4 -> group phase produces real group-stage games; the KO-bracket
    // tabs are visible immediately, even before any group result is entered.
    await page.goto('/teams')
    for (let i = 1; i <= 8; i++) {
      await addTeam(page, `Team ${i}`)
    }
    await page.getByRole('link', { name: 'Konfiguration' }).click()
    await selectMode(page, 'Gruppenphase + Endrunde')
    await page.getByLabel('Anzahl Gruppen').fill('2')
    for (let i = 5; i <= 8; i++) {
      await page.getByLabel(`Gruppe für Team ${i}`).selectOption('B')
    }
    await page.getByLabel('Endrunden-Variante').selectOption('endrunde-1')
    await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
    await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()

    await page.getByRole('link', { name: 'Endrunde: K.-o.-Ergebnisse' }).click()
    await expect(page.getByRole('button', { name: /Rangstufe 1/ })).toBeVisible()
    await expectNoSeriousViolations(page)
  })

  test('final standings page (combined 1..N ranking)', async ({ page }) => {
    // "Endstand" only exists for Endrunde 1 and Endrunde 4 (see AppShell.tsx's nav-item
    // gating) -- Endrunde 3 has no combined standings page at all, only its KO-results page.
    // Use Endrunde 4 (2 groups of 4), play the group phase so the placement-cohort games
    // (fed by group standings) resolve, then check the standings table renders real rows.
    await page.goto('/teams')
    for (let i = 1; i <= 8; i++) {
      await addTeam(page, `Team ${i}`)
    }
    await page.getByRole('link', { name: 'Konfiguration' }).click()
    await selectMode(page, 'Gruppenphase + Endrunde')
    await page.getByLabel('Anzahl Gruppen').fill('2')
    for (let i = 5; i <= 8; i++) {
      await page.getByLabel(`Gruppe für Team ${i}`).selectOption('B')
    }
    await page.getByLabel('Endrunden-Variante').selectOption('endrunde-4')
    await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
    await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()

    // 2 groups of 4 -> 6 games per group (single round-robin) -> 12 group games total.
    await page.getByRole('link', { name: 'Ergebnisse erfassen' }).click()
    for (let i = 0; i < 12; i++) {
      await page.getByLabel(/^Ergebnis Heim, Spiel/).first().fill('20')
      await page.getByLabel(/^Ergebnis Auswärts, Spiel/).first().fill('10')
      await page.getByRole('button', { name: 'Speichern' }).first().click()
    }

    await page.getByRole('link', { name: 'Endstand' }).click()
    await expect(page.getByText('1.', { exact: true })).toBeVisible()
    await expectNoSeriousViolations(page)
  })
})
