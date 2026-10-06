import { expect, type Page } from '@playwright/test'
import { REAL_CLUBS } from '../scripts/fixtures/real-clubs.ts'

// Cycles through real club logo URLs (see scripts/fixtures/real-clubs.ts) so E2E-created teams
// exercise the logoUrl field end-to-end instead of always leaving it empty, which was otherwise
// essentially untested by this suite. Keyed off the team name so the same name always gets the
// same logo across a single test run, without needing every call site to pass one explicitly.
function logoUrlFor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return REAL_CLUBS[hash % REAL_CLUBS.length].logoUrl
}

export async function addTeam(page: Page, name: string) {
  await page.getByRole('button', { name: 'Team hinzufügen' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name').fill(name)
  await dialog.getByLabel('Logo-URL').fill(logoUrlFor(name))
  await dialog.getByRole('button', { name: 'Speichern' }).click()
  await expect(dialog).not.toBeVisible()
}

export async function selectMode(page: Page, label: string) {
  await page.locator('#tourney-mode').selectOption({ label })
}

export async function setupSwissTournament(page: Page, teamNames: string[], swissRounds?: number) {
  await page.goto('/teams')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  for (const name of teamNames) {
    await addTeam(page, name)
  }

  await goTo(page, 'Konfiguration')
  await selectMode(page, 'Einstufungsturnier (Schweizer System)')
  if (swissRounds !== undefined) {
    await page.getByLabel('Anzahl Runden').fill(String(swissRounds))
  }

  await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
  await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()

  await goTo(page, 'Ergebnisse erfassen')
  await expect(page.getByText(/Runde 1 von/)).toBeVisible()
}

// Gruppe, in der ein Navigationseintrag der Hauptnavigation liegt (null = direkter Link in der Leiste).
const NAV_GROUP: Record<string, string | null> = {
  Teams: 'Vorbereiten',
  Konfiguration: 'Vorbereiten',
  'Ergebnisse erfassen': 'Spielen',
  'Endrunde: Ergebnisse': 'Spielen',
  'Endrunde: KO-Ergebnisse': 'Spielen',
  'Endrunde: K.-o.-Ergebnisse': 'Spielen',
  Zeitplan: 'Ansehen',
  Turnierübersicht: 'Ansehen',
  Gruppentabellen: 'Ansehen',
  Endstand: 'Ansehen',
  Export: null,
  Anleitung: 'Hilfe',
  'Demo-Turniere': 'Hilfe',
}

/** Navigiert über die Hauptnavigation: öffnet bei Bedarf die Gruppe und klickt den Link. */
export async function goTo(page: Page, label: string) {
  if (!(label in NAV_GROUP)) throw new Error(`goTo: unbekannter Navigationseintrag „${label}“`)
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  const group = NAV_GROUP[label]
  if (group) {
    const trigger = nav.getByRole('button', { name: group, exact: true })
    if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click()
  }
  await nav.getByRole('link', { name: label, exact: true }).click()
}
