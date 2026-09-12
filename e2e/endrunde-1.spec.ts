import { test, expect } from '@playwright/test'
import { addTeam, selectMode } from './helpers'

// End-to-end coverage of the critical Endrunde 1 process: configuration with 8 groups (2 rank
// tiers, each an 8-team-wide... no, an 8-GROUP-wide bracket of size 8), group phase, automatic
// qualification into TWO parallel KO brackets (rank tier 1 for places 1-8, rank tier 2 for places
// 9-16), playing both brackets to completion, and a combined final standing. This is exactly the
// flow a real organizer follows, so it must be verified in a real browser, not just via unit
// tests on the underlying generator/store functions.

test('organizer plays a full Endrunde 1 tournament with two parallel rank-tier brackets', async ({ page }) => {
  await page.goto('/teams')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  // 16 teams, 8 groups of 2 -> smallest group size is 2, so there are 2 rank tiers, each an
  // 8-team bracket (rank tier 1: all group-winners, places 1-8; rank tier 2: all
  // group-runners-up, places 9-16).
  for (let i = 1; i <= 16; i++) {
    await addTeam(page, `Team ${i}`)
  }

  await page.getByRole('link', { name: 'Konfiguration' }).click()
  await selectMode(page, 'Gruppenphase + Endrunde')
  await page.getByLabel('Anzahl Gruppen').fill('8')

  // Split into groups A-H, 2 teams each: 1,2 -> A (default is all-A, so only move the rest).
  const groupLetters = ['B', 'C', 'D', 'E', 'F', 'G', 'H']
  for (let g = 0; g < groupLetters.length; g++) {
    const first = 3 + g * 2
    await page.getByLabel(`Gruppe für Team ${first}`).selectOption(groupLetters[g])
    await page.getByLabel(`Gruppe für Team ${first + 1}`).selectOption(groupLetters[g])
  }

  await expect(page.getByLabel('Endrunden-Variante')).toBeVisible()
  await page.getByLabel('Endrunden-Variante').selectOption('endrunde-1')

  await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
  await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()

  // Each group of 2 plays 1 game -> 8 group games total. Home team wins every game, so
  // "Team <odd>" (the first team added to each group, listed as home) wins every group.
  await page.getByRole('link', { name: 'Ergebnisse erfassen' }).click()
  for (let i = 0; i < 8; i++) {
    await page.getByLabel(/^Ergebnis Heim, Spiel/).first().fill('20')
    await page.getByLabel(/^Ergebnis Auswärts, Spiel/).first().fill('10')
    await page.getByRole('button', { name: 'Speichern' }).first().click()
  }
  await expect(page.getByText('Keine Spiele für die gewählten Filter.')).toBeVisible()

  // Both rank-tier brackets' quarterfinals should now be auto-resolved with real teams.
  await page.getByRole('link', { name: 'Endrunde: KO-Ergebnisse' }).click()
  await expect(page.getByRole('button', { name: /Rangstufe 1/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Rangstufe 2/ })).toBeVisible()

  // Rank tier 1 is the active tab by default: play its 4 quarterfinals, 2 semifinals, then
  // final + third-place.
  await expect(page.getByLabel('Status')).toHaveValue('open')
  for (let round = 0; round < 3; round++) {
    const gamesThisRound = round === 2 ? 2 : (round === 0 ? 4 : 2)
    for (let i = 0; i < gamesThisRound; i++) {
      await page.getByLabel(/^Ergebnis Heim, Spiel/).first().fill('30')
      await page.getByLabel(/^Ergebnis Auswärts, Spiel/).first().fill('20')
      await page.getByRole('button', { name: 'Speichern' }).first().click()
    }
  }
  await expect(page.getByText('Keine Spiele für die gewählten Filter.')).toBeVisible()

  // Switch to rank tier 2's tab and play its bracket the same way.
  await page.getByRole('button', { name: /Rangstufe 2/ }).click()
  await expect(page.getByLabel('Status')).toHaveValue('open')
  for (let round = 0; round < 3; round++) {
    const gamesThisRound = round === 2 ? 2 : (round === 0 ? 4 : 2)
    for (let i = 0; i < gamesThisRound; i++) {
      await page.getByLabel(/^Ergebnis Heim, Spiel/).first().fill('25')
      await page.getByLabel(/^Ergebnis Auswärts, Spiel/).first().fill('15')
      await page.getByRole('button', { name: 'Speichern' }).first().click()
    }
  }
  await expect(page.getByText('Keine Spiele für die gewählten Filter.')).toBeVisible()

  // Combined final standing shows all 16 places.
  await page.getByRole('link', { name: 'Endstand' }).click()
  await expect(page.getByText('16.', { exact: true })).toBeVisible()
  await expect(page.getByText('1.', { exact: true })).toBeVisible()
})
