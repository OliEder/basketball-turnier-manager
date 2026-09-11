import { test, expect } from '@playwright/test'
import { setupSwissTournament } from './helpers'

test('withdrawing a team mid-tournament does not permanently block round progress', async ({ page }) => {
  await setupSwissTournament(page, ['Team A', 'Team B', 'Team C', 'Team D'])

  // 4 Teams -> Runde 1 hat 2 Spiele (kein Freilos). Nur das erste Spiel auswerten,
  // damit "Nächste Runde auslosen" zunächst noch deaktiviert bleibt.
  await expect(page.getByLabel(/^Ergebnis Heim, Spiel/)).toHaveCount(2)

  const firstHome = page.getByLabel(/^Ergebnis Heim, Spiel/).first()
  const firstAway = page.getByLabel(/^Ergebnis Auswärts, Spiel/).first()
  await firstHome.fill('20')
  await firstAway.fill('10')
  await page.getByRole('button', { name: 'Speichern' }).first().click()

  const advanceButton = page.getByRole('button', { name: 'Nächste Runde auslosen' })
  await expect(advanceButton).toBeDisabled()

  // Das zweite (noch offene) Spiel ist jetzt die einzige verbleibende Zeile mit Eingabefeldern.
  // Zeile über das (accessible) Eingabefeld statt über CSS-Klassen ermitteln, dann den exakten
  // Teamnamen aus dem Accessible Name eines der "ausgeschieden"-Buttons in dieser Zeile lesen,
  // um gezielt eines der beiden beteiligten Teams als ausgeschieden zu markieren.
  const openInput = page.getByLabel(/^Ergebnis Heim, Spiel/)
  const remainingRow = page.locator('div').filter({ has: openInput }).last()
  const withdrawButtons = remainingRow.getByRole('button', { name: /ausgeschieden$/ })
  await expect(withdrawButtons).toHaveCount(2)
  const buttonLabel = await withdrawButtons.first().textContent()
  expect(buttonLabel).toBeTruthy()
  const teamToWithdraw = buttonLabel!.replace(/ ausgeschieden$/, '')

  const withdrawButton = remainingRow.getByRole('button', { name: `${teamToWithdraw} ausgeschieden`, exact: true })

  page.once('dialog', dialog => dialog.accept())
  await withdrawButton.click()

  // Die Runde gilt jetzt als vollständig ausgewertet (das zweite Spiel wurde durch den
  // Rückzug annulliert), daher darf die nächste Runde ausgelost werden. Hinweis: Die UI
  // rendert für annullierte Spiele weiterhin die (nun funktionslosen) Eingabefelder, da
  // sie nur zwischen "Ergebnis vorhanden" und "kein Ergebnis" unterscheidet, nicht nach
  // cancelledReason — daher wird hier direkt der Freigabe-Status des Buttons geprüft statt
  // der Eingabefelder-Anzahl.
  await expect(advanceButton).toBeEnabled()
  await advanceButton.click()

  await expect(page.getByText(/Runde 2 von/)).toBeVisible()
})

test('manual pairing dialog appears when automatic pairing is exhausted', async ({ page }) => {
  // 4 Teams => nur 6 einzigartige Paarungen möglich. Mit genügend Runden und immer
  // identischem Ergebnismuster (Heimteam gewinnt) wird der Paarungsalgorithmus
  // (Backtracking ohne Wiederholung gespielter Paare) irgendwann in eine Sackgasse laufen.
  await setupSwissTournament(page, ['Team A', 'Team B', 'Team C', 'Team D'], 8)

  let manualPairingShown = false
  let tournamentFinished = false

  for (let round = 1; round <= 8; round++) {
    // Sicherstellen, dass die Runden-Überschrift (und damit die Spiel-Zeilen) tatsächlich
    // gerendert wurde, bevor Eingabefelder gezählt werden — sonst kann ein Navigations-/
    // Render-Race dazu führen, dass gameCount fälschlich 0 ist und die Schleife sofort
    // abbricht, ohne je eine Runde auszuwerten.
    await expect(page.getByText(new RegExp(`Runde ${round} von`))).toBeVisible()

    const homeInputs = page.getByLabel(/^Ergebnis Heim, Spiel/)
    const gameCount = await homeInputs.count()
    if (gameCount === 0) break

    for (let i = 0; i < gameCount; i++) {
      const home = page.getByLabel(/^Ergebnis Heim, Spiel/).first()
      const away = page.getByLabel(/^Ergebnis Auswärts, Spiel/).first()
      await home.fill('20')
      await away.fill('10')
      await page.getByRole('button', { name: 'Speichern' }).first().click()
    }
    await expect(page.getByLabel(/^Ergebnis Heim, Spiel/)).toHaveCount(0)

    if (await page.getByText('Turnier abgeschlossen. Siehe Turnierübersicht für das Endergebnis.').isVisible().catch(() => false)) {
      tournamentFinished = true
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

  // Falls das Turnier vor einem Paarungskonflikt regulär beendet wurde, ist die Rundenzahl
  // (8) für 4 Teams mit diesem Ergebnismuster nicht ausreichend, um eine Sackgasse zu
  // erzwingen — das wäre ein Testdesign-Problem, kein Fehlschlag der eigentlichen Prüfung.
  expect(tournamentFinished, 'Turnier wurde beendet, bevor ein Paarungskonflikt auftrat').toBe(false)

  expect(manualPairingShown).toBe(true)
  await expect(page.getByText(/Automatische Paarung nicht möglich/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Paarungen übernehmen' })).toBeVisible()

  // Manuelle Paarung tatsächlich durchführen, um den kompletten Fallback-Pfad zu testen.
  const selects = page.locator('select[aria-label^="Gegner für"]')
  const selectCount = await selects.count()
  expect(selectCount).toBeGreaterThan(0)

  const teamNames: string[] = []
  for (let i = 0; i < selectCount; i++) {
    const label = await selects.nth(i).getAttribute('aria-label')
    teamNames.push(label!.replace('Gegner für ', ''))
  }

  // Teams paarweise verbinden (i mit i+1), symmetrisch wie handleManualPair es erwartet.
  for (let i = 0; i < selectCount; i += 2) {
    if (i + 1 >= selectCount) break
    await selects.nth(i).selectOption({ label: teamNames[i + 1] })
  }

  await page.getByRole('button', { name: 'Paarungen übernehmen' }).click()
  await expect(page.getByText(/Automatische Paarung nicht möglich/)).not.toBeVisible()
})
