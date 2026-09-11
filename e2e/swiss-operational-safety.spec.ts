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

  const advanceButton = page.getByRole('button', { name: 'Nächste Runde auslosen' })
  await expect(advanceButton).toBeDisabled()

  // Das zweite (noch nicht befüllte) Spiel ist jetzt die letzte Zeile mit einem leeren
  // Eingabefeld. Zeile über die feste Spielzeilen-Klasse ermitteln (eine pro Spiel der
  // Runde), dann eines der beiden "zurückziehen"-Buttons in dieser Zeile anklicken (welches
  // der beiden Teams betroffen ist, ist für diesen Test irrelevant).
  const gameRows = page.locator('div.py-2.border-b')
  await expect(gameRows).toHaveCount(2)
  const remainingRow = gameRows.last()
  const withdrawButtons = remainingRow.getByRole('button', { name: /zurückziehen$/ })
  await expect(withdrawButtons).toHaveCount(2)

  page.once('dialog', dialog => dialog.accept())
  await withdrawButtons.first().click()

  // Der geklickte Button ist einem roten Status-Badge gewichen, nur noch ein
  // "zurückziehen"-Button (für das Gegnerteam) bleibt in dieser Zeile übrig.
  await expect(remainingRow.getByRole('button', { name: /zurückziehen$/ })).toHaveCount(1)
  await expect(remainingRow.getByText(/zurückgezogen$/)).toBeVisible()

  // Die Runde gilt jetzt als vollständig ausgewertet (das zweite Spiel wurde durch den
  // Rückzug annulliert, das erste hat ein lokal befülltes, gültiges Ergebnis), daher darf
  // die nächste Runde ausgelost werden.
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
      await page.getByLabel(/^Ergebnis Heim, Spiel/).nth(i).fill('20')
      await page.getByLabel(/^Ergebnis Auswärts, Spiel/).nth(i).fill('10')
    }

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

test('withdrawal that makes the active team count odd reshapes a not-yet-drawn future round to include a bye', async ({ page }) => {
  // 6 Teams (gerade) -> künftige Runden haben 3 echte Spiele und kein Freilos-Slot
  // (siehe generateSwissSchedule: hasByeEachRound ist nur bei ungerader Teamzahl true).
  const teamNames = ['Team A', 'Team B', 'Team C', 'Team D', 'Team E', 'Team F']
  await setupSwissTournament(page, teamNames, 4)

  // Runde 1 vollständig auswerten, damit Runde 3 beim späteren Rückzug in Runde 2 wirklich
  // eine "noch nicht ausgeloste" künftige Runde ist (nicht die gerade aktive).
  await expect(page.getByText(/Runde 1 von 4/)).toBeVisible()
  const round1HomeInputs = page.getByLabel(/^Ergebnis Heim, Spiel/)
  const round1Count = await round1HomeInputs.count()
  expect(round1Count).toBe(3)
  for (let i = 0; i < round1Count; i++) {
    await page.getByLabel(/^Ergebnis Heim, Spiel/).nth(i).fill('20')
    await page.getByLabel(/^Ergebnis Auswärts, Spiel/).nth(i).fill('10')
  }
  await page.getByRole('button', { name: 'Nächste Runde auslosen' }).click()
  await expect(page.getByText(/Runde 2 von 4/)).toBeVisible()

  // Vor dem Rückzug: Runde 3 (noch nicht ausgelost) in der Turnierübersicht inspizieren.
  // Placeholder-Spiele tragen dort homeLabel/awayLabel wie "Runde 3 – Spiel N (Heim)"
  // (siehe reshapeFutureSwissRounds / generateSwissSchedule); Freilos-Slots (field === 0)
  // werden von SwissOverviewPage bewusst herausgefiltert (g.field > 0), sind dort also
  // nicht sichtbar — nur die Anzahl echter Spiel-Slots lässt sich hier prüfen.
  await page.getByRole('link', { name: 'Turnierübersicht' }).click()
  await expect(page.getByRole('heading', { name: 'Runde 3', exact: true })).toBeVisible()
  const round3PlaceholdersBefore = page.getByText(/^Runde 3 – Spiel \d+ \(Heim\)$/)
  await expect(round3PlaceholdersBefore).toHaveCount(3)

  await page.getByRole('link', { name: 'Ergebnisse erfassen' }).click()
  await expect(page.getByText(/Runde 2 von 4/)).toBeVisible()

  // In Runde 2 ein noch offenes Spiel finden (gleiches Muster wie im ersten Test dieser
  // Datei) und eines der beiden beteiligten Teams zurückziehen. 6 -> 5 aktive
  // Teams macht die Teamzahl ungerade.
  const openInput = page.getByLabel(/^Ergebnis Heim, Spiel/).first()
  const withdrawRow = page.locator('div').filter({ has: openInput }).last()
  const withdrawButtons = withdrawRow.getByRole('button', { name: /zurückziehen$/ })
  await expect(withdrawButtons).toHaveCount(2)
  page.once('dialog', dialog => dialog.accept())
  await withdrawButtons.first().click()

  // Runde 1 (bereits abgeschlossen) darf vom Rückzug nicht berührt worden sein.
  await page.getByRole('button', { name: 'Runde 1', exact: true }).click()
  await expect(page.getByText(/bereits abgeschlossene Runde/)).toBeVisible()
  await expect(page.getByLabel(/^Ergebnis Heim, Spiel/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Zur aktuellen Runde' }).click()
  await expect(page.getByText(/Runde 2 von 4/)).toBeVisible()

  // Nach dem Rückzug: Runde 3 hat jetzt nur noch floor(5/2) = 2 echte Spiel-Slots statt 3,
  // der überzählige Slot wurde laut reshapeFutureSwissRounds in einen Freilos-Slot
  // umgewandelt (5 aktive Teams sind ungerade -> needsBye = true).
  await page.getByRole('link', { name: 'Turnierübersicht' }).click()
  await expect(page.getByRole('heading', { name: 'Runde 3', exact: true })).toBeVisible()
  const round3PlaceholdersAfter = page.getByText(/^Runde 3 – Spiel \d+ \(Heim\)$/)
  await expect(round3PlaceholdersAfter).toHaveCount(2)

  // Restliche offene Spiele der Runde 2 auswerten und Runde 3 tatsächlich auslosen, um das
  // Freilos dort real zu sehen (nicht nur die Slot-Anzahl in der Übersicht).
  await page.getByRole('link', { name: 'Ergebnisse erfassen' }).click()
  await expect(page.getByText(/Runde 2 von 4/)).toBeVisible()
  const remainingHomeInputs = page.getByLabel(/^Ergebnis Heim, Spiel/)
  const remainingCount = await remainingHomeInputs.count()
  for (let i = 0; i < remainingCount; i++) {
    await page.getByLabel(/^Ergebnis Heim, Spiel/).nth(i).fill('20')
    await page.getByLabel(/^Ergebnis Auswärts, Spiel/).nth(i).fill('10')
  }
  await page.getByRole('button', { name: 'Nächste Runde auslosen' }).click()

  await expect(page.getByText(/Runde 3 von 4/)).toBeVisible()
  await expect(page.getByLabel(/^Ergebnis Heim, Spiel/)).toHaveCount(2)
  await expect(page.getByText(/^Freilos: /)).toBeVisible()
})
