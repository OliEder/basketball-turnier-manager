import { test, expect } from '@playwright/test'
import { setupSwissTournament } from './helpers'

test('plays through a full 13-team swiss tournament with a bye every round', async ({ page }) => {
  const teamNames = Array.from({ length: 13 }, (_, i) => `Team ${i + 1}`)
  await setupSwissTournament(page, teamNames)

  // setupSwissTournament navigates away from /config, daher die Rundenzahl aus der
  // Ergebnisseiten-Überschrift lesen statt das Konfigurationsfeld erneut zu öffnen
  // (gleiches Muster wie in swiss-tournament.spec.ts).
  const headingText = await page.getByText(/Runde 1 von \d+/).textContent()
  const totalRounds = Number(headingText!.match(/Runde 1 von (\d+)/)![1])
  expect(totalRounds).toBeGreaterThan(0)
  // 13 Teams -> Standard-Rundenzahl ist ceil(log2(13)) = 4 (siehe TournamentForm.tsx).
  expect(totalRounds).toBe(4)

  const byeTeamsPerRound: string[] = []

  for (let round = 1; round <= totalRounds; round++) {
    await expect(page.getByText(new RegExp(`Runde ${round} von ${totalRounds}`))).toBeVisible()

    // 13 Teams -> immer 6 echte Spiele + 1 Freilos pro Runde.
    const homeInputs = page.getByLabel(/^Ergebnis Heim, Spiel/)
    await expect(homeInputs).toHaveCount(6)

    const byeText = await page.getByText(/^Freilos: /).textContent()
    expect(byeText).toBeTruthy()
    byeTeamsPerRound.push(byeText!.replace('Freilos: ', '').trim())

    const gameCount = await homeInputs.count()
    for (let i = 0; i < gameCount; i++) {
      await page.getByLabel(/^Ergebnis Heim, Spiel/).nth(i).fill('20')
      await page.getByLabel(/^Ergebnis Auswärts, Spiel/).nth(i).fill('10')
    }

    if (round < totalRounds) {
      await page.getByRole('button', { name: 'Nächste Runde auslosen' }).click()
    }
  }

  await expect(page.getByText('Turnier abgeschlossen. Siehe Turnierübersicht für das Endergebnis.')).toBeVisible()

  // Jede Runde hat ein Freilos bekommen (garantiert, da 13 Teams ungerade sind);
  // welches Team konkret pausiert, ist laut pairNextSwissRound (bevorzugt ein Team ohne
  // bisheriges Freilos) nicht strikt vorhersagbar, daher wird nur die Anzahl geprüft.
  expect(byeTeamsPerRound).toHaveLength(totalRounds)
  const distinctByeTeams = new Set(byeTeamsPerRound)
  expect(distinctByeTeams.size).toBeGreaterThanOrEqual(2)

  await page.getByRole('link', { name: 'Turnierübersicht' }).click()
  await expect(page.getByRole('table')).toBeVisible()
  for (const name of teamNames) {
    await expect(page.getByRole('cell', { name, exact: true })).toBeVisible()
  }

  for (let round = 1; round <= totalRounds; round++) {
    await expect(page.getByRole('heading', { name: `Runde ${round}`, exact: true })).toBeVisible()
  }
})
