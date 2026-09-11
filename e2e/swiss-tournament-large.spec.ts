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

  // Jede Runde hat ein Freilos bekommen (garantiert, da 13 Teams ungerade sind). Für dieses
  // konkrete Szenario (13 Teams, nur 4 Runden) sind die Freilos-Teams zusätzlich garantiert
  // paarweise verschieden: pairNextSwissRound wählt das Freilos aus byeCandidates.find(s =>
  // !s.hadBye) und fällt nur dann auf byeCandidates[0] (mögliche Wiederholung) zurück, wenn
  // ALLE aktiven Teams bereits ein Freilos hatten. Da nach Runde k höchstens k Teams ein
  // Freilos hatten und 13 Teams >> 4 Runden, bleiben in jeder Runde mindestens 13 - 3 = 10
  // Teams ohne bisheriges Freilos übrig — der Fallback-Pfad mit möglicher Wiederholung ist
  // hier unerreichbar. Das ist eine Eigenschaft dieses Szenarios (viele Teams, wenige
  // Runden), keine allgemeine Garantie des Algorithmus.
  expect(byeTeamsPerRound).toHaveLength(totalRounds)
  const distinctByeTeams = new Set(byeTeamsPerRound)
  expect(distinctByeTeams.size).toBe(totalRounds)

  await page.getByRole('link', { name: 'Turnierübersicht' }).click()
  await expect(page.getByRole('table')).toBeVisible()
  // "Team 1".."Team 13" zeigen als Kürzel "TEA" + Endziffer (siehe getTeamAbbreviation).
  // Bei zweistelligen Nummern kollidiert das bewusst nicht eindeutig (z.B. "Team 1" und
  // "Team 11" beide "TEA1") — hier reicht die Sichtbarkeitsprüfung pro distinktem Kürzel.
  const table = page.getByRole('table')
  await expect(table).toContainText('TEA1')
  await expect(table).toContainText('TEA9')
  await expect(table).toContainText('TEA0')

  for (let round = 1; round <= totalRounds; round++) {
    await expect(page.getByRole('heading', { name: `Runde ${round}`, exact: true })).toBeVisible()
  }
})
