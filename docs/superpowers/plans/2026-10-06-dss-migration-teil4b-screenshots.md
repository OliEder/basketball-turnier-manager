# DSS-Migration Teil 4b — Anleitungs-Screenshots und -Text Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die 30 Screenshots der Anleitung (`public/anleitung/01…30-*.png`) mit einem reproduzierbaren Playwright-Skript im DSS-Design neu erzeugen und den Anleitungstext (`src/content/manual.md`) an die tatsächliche App angleichen.

**Architecture:** Ein eigener Playwright-Lauf (`playwright.screenshots.config.ts`, `screenshots/manual-screenshots.spec.ts`, Befehl `npm run screenshots:manual`), getrennt von der E2E-Suite und nicht in der CI. Eine Tabelle `MANUAL_SHOTS` (`screenshots/manual-shots.ts`) hält Dateiname und Originalmaße je Bild; das Skript und ein Unit-Test lesen dieselbe Tabelle. Zustände entstehen über die UI (Schweizer Turnier, Bilder 01–23) bzw. über geseedetes `localStorage` aus den Demo-Daten (Gruppenbilder 24–30).

**Tech Stack:** Playwright (`@playwright/test`, bereits vorhanden), Vitest (node), `magick`/`pdftoppm` (Homebrew, vorhanden, nur für die Prüfung).

**Spec:** `docs/superpowers/specs/2026-10-06-dss-migration-teil4-design.md` (Abschnitt „4b“). **Voraussetzung:** 4a ist gemergt (`docs/superpowers/plans/2026-10-06-dss-migration-teil4a-pdf-html.md`), damit das Anleitungs-PDF mit den neuen Schriften geprüft wird.

## Erkenntnisse aus der Plan-Recherche

- **Neue Navigation (Teil 3b, nachgezogen):** Die App hat statt der alten Linkleiste jetzt TopBar + AppNav (gruppierte Dropdowns, mobil ein Menü). Die Screenshots zeigen daher die neue Navigation. Hauptnavigationseinträge werden im Skript über `goTo(page, '…')` aus `e2e/helpers` angesteuert (öffnet bei Bedarf die Gruppe); Runden- und Gruppenreiter haben die Rolle `tab` statt `button`.
- **Offene Frage (in 4b klären):** Soll ein Screenshot der neuen Seite „Demo-Turniere“ (`/demos`) ergänzt werden (und ggf. ein Hinweis im Anleitungstext)? Entscheidung steht aus; `manual.md` erwähnt bisher die Demo-Downloads.

- Die Originale wurden in festen Viewports aufgenommen: 01–23: 694×833 (Bild 03: 694×885), 24: 776×501, 25: 900×560, 26: 1100×700, 27: 900×700, 28–30: 900×520. Keine Vollseiten-Bilder.
- **Bild 25 ist in `manual.md` nicht referenziert** (Waise). Der Plan erzeugt es trotzdem neu (kein Altbranding im Repo) und markiert es in der Tabelle mit `referenced: false`.
- Schweizer Szenario der Originale: 8 Teams (TSV Nord, SG Ost 2, BC Mitte, TuS West, Adler Süd, Falken City [Kürzel FCY], Panther Rheinau, Hornets Talstadt), „Talstadt Einstufungsturnier 2026“, 3 Felder, 3 Runden, in Runde 2 ist TSV zurückgezogen.
- Gruppen-Szenario der Originale: Gruppe A mit Musterstadt Baskets, SG Nord, TV Süd, BC West, Donau Hawks (alle Tabellenwerte 0), zwei Gruppen. Die Demo-Teams heißen anders (TV 1875 Burglengenfeld usw.); der Plan benennt Demo 02 um und leert die Ergebnisse.
- Die App speichert unter `tm_tournament` und `tm_schedule` (`localStorage`); die Demo-Dateien haben die Form `{ tournament, schedule, exportedAt }`.
- Eine Korrektur in Runde 1 ist nur möglich, solange Runde 2 kein Ergebnis hat; ein Rückzug annulliert ein Spiel mit 0:0. Deshalb wird die Reihenfolge der Aufnahmen gegenüber den Dateinummern umgestellt: erst Korrektur (15–17), dann Rückzug (14).
- Selektoren (aus dem Code gelesen): Navigationslinks `Teams`, `Konfiguration`, `Ergebnisse erfassen`, `Turnierübersicht`, `Gruppentabellen`, `Export`; Buttons `Team hinzufügen`, `Bearbeiten`, `Speichern`, `Abbrechen`, `Zeitplan generieren`, `Nächste Runde auslosen`, `Runde N`, `Zur aktuellen Runde`, `Korrigieren`, `Bearbeitung freischalten`, `<Kürzel> zurückziehen` (native `confirm`); Eingaben `Ergebnis Heim, Spiel N` / `Ergebnis Auswärts, Spiel N` / `Korrigiertes Ergebnis …`; Select `#tourney-mode`, `#tourney-fields`; Überschriften `Spieleinstellungen`, `Halle`, `Spielplan generieren`, `Turnier importieren`, `Gruppen`, `Tabelle`, `Zeitplan`.

## Konventionen

- **Arbeitsverzeichnis:** ein eigener Worktree (Task 0). **Haupt-Arbeitsverzeichnis (`…/02-turnier-manager`) und der Worktree `.worktrees/feat-pdf-export` nicht anfassen.**
- **Commit-Messages** enden mit `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; **PR-Beschreibungen** mit `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **Nicht pushen, kein PR** ohne ausdrückliche Freigabe (Task 9).
- Verifikationsbefehle: `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`; nach `typecheck`/`build` `git checkout -- tsconfig.tsbuildinfo` und `rm -rf dist`.
- Platz kann knapp sein (`df -h /`); den npm-Cache nicht löschen. Das Skript läuft auf Port **5174** (die E2E-Suite nutzt 5173).
- `$SP=/private/tmp/claude-501/-Users-oliver-marcuseder-01-vibe-coding-00-Basektball-08-Fibalon-Baskets-02-turnier-manager/c5eb9565-c502-4a38-ae43-0427395e75c2/scratchpad` (Kontaktbögen, Vergleichsbilder; nicht committen).

## Dateistruktur

| Datei | Aktion | Task |
|---|---|---|
| `screenshots/manual-shots.ts` | neu — Tabelle `MANUAL_SHOTS` (Dateiname, Maße, referenziert) | 1 |
| `src/content/manual-images.test.ts` | neu — prüft Existenz, Maße, Referenzen | 1 |
| `playwright.screenshots.config.ts` | neu | 2 |
| `screenshots/manual-screenshots.spec.ts` | neu — Hilfsfunktionen und Szenarien | 2–4 |
| `package.json` | Script `screenshots:manual` | 2 |
| `public/anleitung/01…30-*.png` | neu erzeugt (gleiche Namen) | 3–5 |
| `src/content/manual.md` | Text angleichen | 6 |
| `docs/architecture/arc42/{08,11}-*.md`, `docs/use-cases-und-kritikalitaet.md` | Doku | 8 |

---

### Task 0: Worktree und Baseline

- [ ] **Step 1: Basis bestimmen und Worktree anlegen**

```bash
cd /Users/oliver-marcuseder/01-vibe-coding/00-Basektball/08-Fibalon-Baskets/02-turnier-manager
git fetch origin
git log --oneline origin/main -5
```

Steht der 4a-PR (`feat: PDF- und HTML-Export im DSS-Design`) auf `origin/main`, ist die Basis `origin/main`. Ist 4a noch nicht gemergt, ist die Basis der Branch `feat/dss-pdf-html` (dann im PR-Text vermerken, dass 4b auf 4a aufbaut):

```bash
BASE=origin/main   # bzw. feat/dss-pdf-html, falls 4a noch nicht gemergt ist
git worktree add ../02-turnier-manager-dss-teil4b -b feat/dss-manual-screenshots $BASE
cd ../02-turnier-manager-dss-teil4b
npm ci
git status --short | head -3 && git log --oneline -2
```

Expected: neuer Worktree, `npm ci` ohne Fehler, sauberer Tree. Alle weiteren Schritte laufen in `…/02-turnier-manager-dss-teil4b`.

- [ ] **Step 2: Baseline**

```bash
npm run typecheck && npm test 2>&1 | tail -5
git checkout -- tsconfig.tsbuildinfo
ls public/anleitung | wc -l
```

Expected: grün; 30 Dateien in `public/anleitung`. **Unit-Anzahl notieren.**

### Task 1: Bildtabelle und Bild-Test

**Files:**
- Create: `screenshots/manual-shots.ts`, `src/content/manual-images.test.ts`

- [ ] **Step 1: Tabelle anlegen** — `screenshots/manual-shots.ts` (reines TypeScript ohne Playwright-Import, damit Vitest es lesen kann):

```ts
export interface ManualShot {
  /** Dateiname in public/anleitung (unverändert gegenüber den Altbildern). */
  file: string
  width: number
  height: number
  /** Ist das Bild in src/content/manual.md referenziert? (25 ist eine Waise.) */
  referenced: boolean
}

const NARROW = { width: 694, height: 833 }

export const MANUAL_SHOTS: ManualShot[] = [
  { file: '01-teams-leer.png', ...NARROW, referenced: true },
  { file: '02-team-dialog-leer.png', ...NARROW, referenced: true },
  { file: '03-teams-liste.png', width: 694, height: 885, referenced: true },
  { file: '04-team-bearbeiten.png', ...NARROW, referenced: true },
  { file: '05-konfiguration-allgemein.png', ...NARROW, referenced: true },
  { file: '06-konfiguration-swiss-rundenvorschlag.png', ...NARROW, referenced: true },
  { file: '07-konfiguration-spieleinstellungen.png', ...NARROW, referenced: true },
  { file: '08-konfiguration-halle.png', ...NARROW, referenced: true },
  { file: '09-konfiguration-zeitplan-generiert.png', ...NARROW, referenced: true },
  { file: '10-ergebnisse-runde1-leer.png', ...NARROW, referenced: true },
  { file: '11-ergebnisse-teilweise-ausgefuellt.png', ...NARROW, referenced: true },
  { file: '12-ergebnisse-runde1-komplett.png', ...NARROW, referenced: true },
  { file: '13-ergebnisse-runde2.png', ...NARROW, referenced: true },
  { file: '14-zurueckziehen-badge.png', ...NARROW, referenced: true },
  { file: '15-runde-auswaehler-vergangene-runde.png', ...NARROW, referenced: true },
  { file: '16-ergebnis-korrigieren.png', ...NARROW, referenced: true },
  { file: '17-ergebnis-korrigiert.png', ...NARROW, referenced: true },
  { file: '18-turnieruebersicht-tabelle.png', ...NARROW, referenced: true },
  { file: '19-turnieruebersicht-zeitplan.png', ...NARROW, referenced: true },
  { file: '20-konfiguration-gesperrt.png', ...NARROW, referenced: true },
  { file: '21-bestaetigungsdialog.png', ...NARROW, referenced: true },
  { file: '22-export-seite.png', ...NARROW, referenced: true },
  { file: '23-json-import-bereich.png', ...NARROW, referenced: true },
  { file: '24-konfiguration-gruppen.png', width: 776, height: 501, referenced: true },
  { file: '25-gruppentabellen-uebersicht.png', width: 900, height: 560, referenced: false },
  { file: '26-gruppentabellen-64-teams.png', width: 1100, height: 700, referenced: true },
  { file: '27-konfiguration-gruppen-64-teams.png', width: 900, height: 700, referenced: true },
  { file: '28-gruppentabellen-tabs-drucken.png', width: 900, height: 520, referenced: true },
  { file: '29-ergebnisse-erfassen-gruppenphase.png', width: 900, height: 520, referenced: true },
  { file: '30-ergebnis-gespeichert-link-gruppentabelle.png', width: 900, height: 520, referenced: true },
]

export function shotByFile(file: string): ManualShot {
  const shot = MANUAL_SHOTS.find(entry => entry.file === file)
  if (!shot) throw new Error(`Kein Eintrag in MANUAL_SHOTS für ${file}`)
  return shot
}
```

- [ ] **Step 2: Test schreiben** — `src/content/manual-images.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { MANUAL_SHOTS } from '../../screenshots/manual-shots'

const root = process.cwd()
const manual = readFileSync(join(root, 'src/content/manual.md'), 'utf8')
const referenced = [...manual.matchAll(/!\[[^\]]*\]\(([^)\s]+\.png)\)/g)].map(match => match[1])

function pngSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(file)
  // PNG-Signatur: 0x89 'P' 'N' 'G'; danach IHDR mit Breite/Höhe als Big-Endian-uint32 ab Byte 16.
  if (bytes.subarray(1, 4).toString('ascii') !== 'PNG') throw new Error(`${file} ist keine PNG-Datei`)
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

describe('Anleitungs-Screenshots', () => {
  it('jedes in manual.md referenzierte Bild steht in MANUAL_SHOTS und ist als referenziert markiert', () => {
    for (const file of referenced) {
      const shot = MANUAL_SHOTS.find(entry => entry.file === file)
      expect(shot, `${file} fehlt in MANUAL_SHOTS`).toBeDefined()
      expect(shot!.referenced, `${file} ist referenziert, aber nicht so markiert`).toBe(true)
    }
  })

  it('die Markierung "referenced" stimmt mit manual.md überein (keine unmarkierten Waisen)', () => {
    for (const shot of MANUAL_SHOTS) {
      expect(referenced.includes(shot.file), shot.file).toBe(shot.referenced)
    }
  })

  it.each(MANUAL_SHOTS.map(shot => [shot.file, shot] as const))('%s existiert und hat die Originalmaße', (_file, shot) => {
    const path = join(root, 'public/anleitung', shot.file)
    expect(existsSync(path)).toBe(true)
    expect(pngSize(path)).toEqual({ width: shot.width, height: shot.height })
  })

  it('in public/anleitung liegt kein PNG ohne Eintrag in MANUAL_SHOTS', () => {
    const known = new Set(MANUAL_SHOTS.map(shot => shot.file))
    const stray = readdirSync(join(root, 'public/anleitung')).filter(name => name.endsWith('.png') && !known.has(name))
    expect(stray).toEqual([])
  })
})
```

Run: `npx vitest run src/content/manual-images.test.ts`
Expected: PASS (33 Tests), weil die Altbilder bereits die Originalmaße haben. Der Test ist hier eine Absicherung gegen spätere Fehler (falscher Viewport, vergessenes Bild). Schlägt ein Maß-Test jetzt fehl, ist die Tabelle falsch: Maße der Datei mit `file public/anleitung/<datei>` prüfen und die Tabelle korrigieren, nicht das Bild.

- [ ] **Step 3: Typecheck und Commit**

```bash
npm run typecheck; git checkout -- tsconfig.tsbuildinfo
git add screenshots/manual-shots.ts src/content/manual-images.test.ts
git commit -m "test: guard manual screenshots (existence, dimensions, references)"
```

### Task 2: Konfiguration, Script und Hilfsfunktionen (mit Smoke-Aufnahme)

**Files:**
- Create: `playwright.screenshots.config.ts`, `screenshots/manual-screenshots.spec.ts`
- Modify: `package.json`

- [ ] **Step 1: Konfiguration** — `playwright.screenshots.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

// Eigener Lauf für die Anleitungs-Screenshots (npm run screenshots:manual). Getrennt von der
// E2E-Suite (testDir ./e2e) und nicht Teil der CI. Eigener Port, damit er neben `npm run dev` läuft.
const PORT = 5174

export default defineConfig({
  testDir: './screenshots',
  testMatch: /manual-screenshots\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], deviceScaleFactor: 1, viewport: { width: 694, height: 833 } } },
  ],
})
```

- [ ] **Step 2: Script** — in `package.json` unter `"scripts"` ergänzen:

```json
    "screenshots:manual": "playwright test --config playwright.screenshots.config.ts",
```

- [ ] **Step 3: Hilfsfunktionen und Smoke-Test** — `screenshots/manual-screenshots.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { shotByFile } from './manual-shots'
import { goTo } from '../e2e/helpers'

const OUT_DIR = join(process.cwd(), 'public/anleitung')

// ---------- Hilfsfunktionen ----------

/** Setzt den Viewport auf die Originalmaße des Bildes und speichert genau den Viewport. */
async function shoot(page: Page, file: string): Promise<void> {
  const shot = shotByFile(file)
  await page.setViewportSize({ width: shot.width, height: shot.height })
  await page.evaluate(() => document.fonts.ready)
  // Kein zufälliger Fokusring und kein Hover-Zustand in den Bildern.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.mouse.move(0, 0)
  await page.screenshot({ path: join(OUT_DIR, file), animations: 'disabled', caret: 'hide' })
}

/** Scrollt eine Überschrift an den oberen Rand (mit etwas Luft). */
async function scrollToHeading(page: Page, name: string): Promise<void> {
  const heading = page.getByRole('heading', { name, exact: true }).first()
  await heading.evaluate(element => element.scrollIntoView({ block: 'start' }))
  await page.evaluate(() => window.scrollBy(0, -24))
}

async function scrollToTop(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0))
}

async function clearStorage(page: Page): Promise<void> {
  await page.goto('/teams')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
}

async function addTeamViaUi(page: Page, name: string, abbreviation?: string): Promise<void> {
  await page.getByRole('button', { name: 'Team hinzufügen' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'Name' }).fill(name)
  if (abbreviation) await dialog.getByLabel('Kürzel (optional)').fill(abbreviation)
  await dialog.getByRole('button', { name: 'Speichern' }).click()
  await expect(dialog).not.toBeVisible()
}

/** Trägt ein Ergebnis in die n-te Zeile (0-basiert) der aktuellen Ergebnisseite ein. */
async function fillResultRow(page: Page, row: number, home: number, away: number): Promise<void> {
  await page.getByLabel(/^Ergebnis Heim, Spiel/).nth(row).fill(String(home))
  await page.getByLabel(/^Ergebnis Auswärts, Spiel/).nth(row).fill(String(away))
}

interface DemoFile {
  tournament: Record<string, any> & { teams: Array<Record<string, any>>; name: string }
  schedule: Record<string, any> & { games: Array<Record<string, any>> }
}

function loadDemo(file: string): DemoFile {
  return JSON.parse(readFileSync(join(process.cwd(), 'public/demos', file), 'utf8')) as DemoFile
}

/** Schreibt Turnier und Zeitplan in den localStorage und öffnet danach die Zielseite. */
async function seed(page: Page, demo: DemoFile, route: string): Promise<void> {
  await page.goto('/teams')
  await page.evaluate(([tournament, schedule]) => {
    localStorage.setItem('tm_tournament', tournament)
    localStorage.setItem('tm_schedule', schedule)
  }, [JSON.stringify(demo.tournament), JSON.stringify(demo.schedule)])
  await page.goto(route)
}

// ---------- Szenarien ----------

test.describe.configure({ mode: 'serial' })

test('Smoke: leere Teamübersicht (Bild 01)', async ({ page }) => {
  await clearStorage(page)
  await expect(page.getByRole('button', { name: 'Team hinzufügen' })).toBeVisible()
  await shoot(page, '01-teams-leer.png')
})

export { shoot, scrollToHeading, scrollToTop, clearStorage, addTeamViaUi, fillResultRow, loadDemo, seed }
```

(Die Hilfsfunktionen stehen vorerst in derselben Datei, damit Task 3 und 4 sie direkt nutzen. Der `export`-Block am Ende entfällt, sobald alle Szenarien in der Datei stehen, wenn `noUnusedLocals` o. Ä. stört; Playwright-Spec-Dateien dürfen exportieren.)

- [ ] **Step 4: Smoke-Lauf**

```bash
npm run screenshots:manual 2>&1 | tail -12
file public/anleitung/01-teams-leer.png
git status --short
```

Expected: 1 passed; `file` meldet `694 x 833`; `git status` zeigt `public/anleitung/01-teams-leer.png` als geändert (neues Bild). **Bild ansehen** (Read-Werkzeug auf die PNG): erwartet die leere Teamübersicht im DSS-Look (dunkle Kopfleiste mit amberfarbener aktiver Navigation, DSS-Schriften, „Team hinzufügen“-Button). Läuft der Dev-Server nicht an: `npx vite --port 5174 --strictPort` manuell testen.

- [ ] **Step 5: Zweiter Lauf, Determinismus-Probe**

```bash
shasum -a 256 public/anleitung/01-teams-leer.png > $SP/sha-1.txt
npm run screenshots:manual 2>&1 | tail -3
shasum -a 256 public/anleitung/01-teams-leer.png | diff - $SP/sha-1.txt && echo "identisch"
```

Expected: `identisch`. Weicht das Bild ab, die Ursache suchen (z. B. Schrift nicht fertig geladen, Animation): in `shoot` zusätzlich auf `networkidle` warten (`await page.waitForLoadState('networkidle')`) und erneut prüfen. Nicht mit Toleranzen arbeiten.

- [ ] **Step 6: Commit** (Smoke-Bild 01 darf schon mit committet werden; es wird in Task 3 ohnehin überschrieben)

```bash
git add playwright.screenshots.config.ts screenshots/manual-screenshots.spec.ts package.json public/anleitung/01-teams-leer.png
git commit -m "feat(screenshots): add playwright runner for the manual screenshots"
```

### Task 3: Schweizer Szenario (Bilder 01–23)

**Files:**
- Modify: `screenshots/manual-screenshots.spec.ts` (Smoke-Test durch das Szenario ersetzen)

- [ ] **Step 1: Szenario schreiben.** Den Smoke-Test `Smoke: leere Teamübersicht (Bild 01)` entfernen und stattdessen diesen Test einfügen (Hilfsfunktionen aus Task 2 bleiben):

```ts
const SWISS_TEAMS: Array<[string, string?]> = [
  ['TSV Nord'], ['SG Ost 2'], ['BC Mitte'], ['TuS West'],
  ['Adler Süd'], ['Falken City', 'FCY'], ['Panther Rheinau'], ['Hornets Talstadt'],
]

test('Schweizer Einstufungsturnier (Bilder 01–23)', async ({ page }) => {
  await test.step('Teams (01–04)', async () => {
    await clearStorage(page)
    await expect(page.getByRole('button', { name: 'Team hinzufügen' })).toBeVisible()
    await shoot(page, '01-teams-leer.png')

    await page.getByRole('button', { name: 'Team hinzufügen' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await shoot(page, '02-team-dialog-leer.png')
    await page.getByRole('dialog').getByRole('button', { name: 'Abbrechen' }).click()

    for (const [name, abbreviation] of SWISS_TEAMS) await addTeamViaUi(page, name, abbreviation)
    await expect(page.getByText('8 Teams')).toBeVisible()
    await shoot(page, '03-teams-liste.png')

    await page.getByRole('button', { name: 'Bearbeiten' }).nth(5).click() // Falken City (mit Kürzel)
    await expect(page.getByRole('dialog', { name: 'Team bearbeiten' })).toBeVisible()
    await shoot(page, '04-team-bearbeiten.png')
    await page.getByRole('dialog').getByRole('button', { name: 'Abbrechen' }).click()
  })

  await test.step('Konfiguration (05–09)', async () => {
    await goTo(page, 'Konfiguration')
    await page.getByLabel('Turniername').fill('Talstadt Einstufungsturnier 2026')
    await scrollToTop(page)
    await shoot(page, '05-konfiguration-allgemein.png')

    await page.locator('#tourney-mode').selectOption({ label: 'Einstufungsturnier (Schweizer System)' })
    await expect(page.getByLabel('Anzahl Runden')).toBeVisible()
    await shoot(page, '06-konfiguration-swiss-rundenvorschlag.png')

    await scrollToHeading(page, 'Spieleinstellungen')
    await shoot(page, '07-konfiguration-spieleinstellungen.png')

    await page.getByLabel('Hallenname').fill('Sporthalle Talstadt')
    await scrollToHeading(page, 'Halle')
    await shoot(page, '08-konfiguration-halle.png')

    await page.locator('#tourney-fields').selectOption('3')
    await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
    await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()
    await scrollToHeading(page, 'Spielplan generieren')
    await shoot(page, '09-konfiguration-zeitplan-generiert.png')
  })

  await test.step('Runde 1 (10–12) und Runde 2 (13)', async () => {
    await goTo(page, 'Ergebnisse erfassen')
    await expect(page.getByText(/Runde 1 von 3/)).toBeVisible()
    await scrollToTop(page)
    await shoot(page, '10-ergebnisse-runde1-leer.png')

    await fillResultRow(page, 0, 45, 38)
    await fillResultRow(page, 1, 52, 41)
    await shoot(page, '11-ergebnisse-teilweise-ausgefuellt.png')

    await fillResultRow(page, 2, 61, 55)
    await fillResultRow(page, 3, 48, 44)
    await shoot(page, '12-ergebnisse-runde1-komplett.png')

    await page.getByRole('button', { name: 'Nächste Runde auslosen' }).click()
    await expect(page.getByText(/Runde 2 von 3/)).toBeVisible()
    await scrollToTop(page)
    await shoot(page, '13-ergebnisse-runde2.png')
  })

  // Reihenfolge der Aufnahmen: Die Korrektur in Runde 1 geht nur, solange Runde 2 noch kein Ergebnis
  // hat; ein Rückzug annulliert ein Spiel mit 0:0. Deshalb zuerst 15–17, danach 14.
  await test.step('Vergangene Runde und Korrektur (15–17)', async () => {
    await page.getByRole('tab', { name: 'Runde 1', exact: true }).click()
    await expect(page.getByText(/bereits abgeschlossene Runde/)).toBeVisible()
    await scrollToTop(page)
    await shoot(page, '15-runde-auswaehler-vergangene-runde.png')

    await page.getByRole('button', { name: 'Korrigieren' }).first().click()
    await expect(page.getByLabel(/^Korrigiertes Ergebnis Heim, Spiel/)).toBeVisible()
    await shoot(page, '16-ergebnis-korrigieren.png')

    await page.getByLabel(/^Korrigiertes Ergebnis Heim, Spiel/).fill('47')
    await page.getByLabel(/^Korrigiertes Ergebnis Auswärts, Spiel/).fill('40')
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await expect(page.getByLabel(/^Korrigiertes Ergebnis Heim, Spiel/)).toHaveCount(0)
    await shoot(page, '17-ergebnis-korrigiert.png')

    await page.getByRole('button', { name: 'Zur aktuellen Runde' }).click()
    await expect(page.getByText(/Runde 2 von 3/)).toBeVisible()
  })

  await test.step('Rückzug (14)', async () => {
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'TSV zurückziehen' }).first().click()
    await expect(page.getByText(/zurückgezogen/i).first()).toBeVisible()
    await scrollToTop(page)
    await shoot(page, '14-zurueckziehen-badge.png')
  })

  await test.step('Turnierübersicht (18–19)', async () => {
    await goTo(page, 'Turnierübersicht')
    await expect(page.getByRole('heading', { name: 'Tabelle', exact: true })).toBeVisible()
    await scrollToTop(page)
    await shoot(page, '18-turnieruebersicht-tabelle.png')

    await scrollToHeading(page, 'Zeitplan')
    await shoot(page, '19-turnieruebersicht-zeitplan.png')
  })

  await test.step('Änderungsschutz (20–21)', async () => {
    await goTo(page, 'Konfiguration')
    await expect(page.getByText(/Turnier läuft bereits/).first()).toBeVisible()
    await scrollToTop(page)
    await shoot(page, '20-konfiguration-gesperrt.png')

    await page.getByRole('button', { name: 'Bearbeitung freischalten' }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await shoot(page, '21-bestaetigungsdialog.png')
    await page.getByRole('dialog').getByRole('button', { name: 'Abbrechen' }).click()
  })

  await test.step('Export und Import (22–23)', async () => {
    await goTo(page, 'Export')
    await expect(page.getByRole('button', { name: 'PDF herunterladen' })).toBeVisible()
    await shoot(page, '22-export-seite.png')

    await goTo(page, 'Konfiguration')
    await scrollToHeading(page, 'Turnier importieren')
    await shoot(page, '23-json-import-bereich.png')
  })
})
```

Die Hilfsfunktionen und der abschließende `export { … }`-Block aus Task 2 bleiben unverändert.

- [ ] **Step 2: Lauf und iteratives Nachschärfen**

```bash
npm run screenshots:manual 2>&1 | tail -30
```

Expected: 1 passed. Scheitert ein Schritt, die Fehlermeldung genau lesen und **nur den betroffenen Locator** anpassen (Selektoren stehen im Abschnitt „Erkenntnisse“; bei Zweifeln den Seitencode lesen: `src/pages/SwissResultsPage.tsx`, `src/pages/ConfigPage.tsx`). Häufige Stellen: (a) `getByText('8 Teams')` (die Anzeige kann „8 Teams“ lauten, sonst den sichtbaren Text prüfen), (b) `getByLabel('Hallenname')` (Label-Text in `VenueForm.tsx`), (c) `getByText(/Turnier läuft bereits/)` (Text in `LockedSectionGate.tsx`), (d) der Rückzug: erscheint nach dem Klick keine Zeile mit „zurückgezogen“, den sichtbaren Text im Browser prüfen. Jede Anpassung im Bericht nennen; Maße und Dateinamen nie ändern.

- [ ] **Step 3: Bilder prüfen.** Alle 23 Bilder ansehen (Read-Werkzeug) oder zunächst als Kontaktbogen:

```bash
magick montage $(ls public/anleitung/0[1-9]-*.png public/anleitung/1[0-9]-*.png public/anleitung/2[0-3]-*.png) -tile 6x -geometry 232x+6+6 -background '#888' $SP/contact-swiss.png
ls -la $SP/contact-swiss.png
```

Im Bericht je Bild einen Satz beschreiben: zeigt es den im Alt-Text genannten Zustand (z. B. 13: „Ansicht der zweiten Runde“, 14: ein Team als zurückgezogen markiert, 21: Bestätigungsdialog), im DSS-Look, ohne abgeschnittene Bereiche, ohne zufälligen Fokusring. Auffälligkeiten (z. B. Bild zeigt nicht den erwarteten Zustand) nennen und beheben.

- [ ] **Step 4: Maße prüfen und committen**

```bash
npx vitest run src/content/manual-images.test.ts 2>&1 | tail -6
git add screenshots/manual-screenshots.spec.ts public/anleitung
git commit -m "feat(screenshots): regenerate the Swiss tournament screenshots (01-23) in the DSS design"
```

Expected: Bild-Test PASS (Maße stimmen).

### Task 4: Gruppen-Szenario (Bilder 24–30)

**Files:**
- Modify: `screenshots/manual-screenshots.spec.ts`

- [ ] **Step 1: Szenarien anhängen** (nach dem Schweizer Test, vor dem `export`-Block):

```ts
const GROUP_TEAM_NAMES = [
  'Musterstadt Baskets', 'SG Nord', 'TV Süd', 'BC West', 'Donau Hawks', // Gruppe A (5 Teams)
  'Rhein Rockets', 'Eintracht Süd', 'Lions Ost', 'TuS Mitte', // Gruppe B (4 Teams)
]

/** Demo 02 (9 Teams, 2 Gruppen) mit eigenen Teamnamen und ohne Ergebnisse. */
function unplayedGroupTournament(): DemoFile {
  const demo = loadDemo('02-gruppenphase-endrunde-9-teams-laufend.json')
  demo.tournament.name = 'Musterstadt Gruppenturnier 2026'
  demo.tournament.teams.forEach((team, index) => {
    team.name = GROUP_TEAM_NAMES[index]
    delete team.abbreviation
  })
  for (const game of demo.schedule.games) game.periodScores = []
  return demo
}

test('Gruppenphase mit 2 Gruppen (Bilder 24, 25, 28, 29, 30)', async ({ page }) => {
  await seed(page, unplayedGroupTournament(), '/group-overview')
  await expect(page.getByRole('heading', { name: 'Gruppe A', exact: true })).toBeVisible()
  await shoot(page, '28-gruppentabellen-tabs-drucken.png')
  await shoot(page, '25-gruppentabellen-uebersicht.png')

  await goTo(page, 'Konfiguration')
  await scrollToHeading(page, 'Gruppen')
  await shoot(page, '24-konfiguration-gruppen.png')

  await goTo(page, 'Ergebnisse erfassen')
  await expect(page.getByLabel(/^Ergebnis Heim, Spiel/).first()).toBeVisible()
  await scrollToTop(page)
  await shoot(page, '29-ergebnisse-erfassen-gruppenphase.png')

  await fillResultRow(page, 0, 52, 47)
  await page.getByRole('button', { name: 'Speichern' }).first().click()
  await expect(page.getByText(/Ergebnis gespeichert/)).toBeVisible()
  await scrollToTop(page)
  await shoot(page, '30-ergebnis-gespeichert-link-gruppentabelle.png')
})

test('Großturnier mit 64 Teams (Bilder 26, 27)', async ({ page }) => {
  await seed(page, loadDemo('04-grossturnier-64-teams-16-gruppen-ungespielt.json'), '/group-overview')
  await expect(page.getByRole('heading', { name: 'Gruppe A', exact: true })).toBeVisible()
  await shoot(page, '26-gruppentabellen-64-teams.png')

  await goTo(page, 'Konfiguration')
  await scrollToHeading(page, 'Gruppen')
  await shoot(page, '27-konfiguration-gruppen-64-teams.png')
})
```

- [ ] **Step 2: Lauf und Nachschärfen**

```bash
npm run screenshots:manual 2>&1 | tail -20
```

Expected: 3 passed (Schweizer Szenario und die zwei neuen). Bei Fehlern wie in Task 3 nur Locator oder Seed-Erwartung anpassen (z. B. wenn die Tabelle eine andere Überschrift als „Gruppe A“ hat: Seitencode `src/pages/GroupOverviewPage.tsx`). Läuft der Seed nicht an (Seite zeigt „Bitte zuerst einen Zeitplan generieren“), prüfen, ob `tm_tournament`/`tm_schedule` gesetzt sind und ob die Demo-Struktur ungültig geworden ist (z. B. durch `delete team.abbreviation`); das melden, nicht umgehen.

- [ ] **Step 3: Bilder ansehen.** Bilder 24–30 einzeln ansehen. Erwartung: 28 und 25 zeigen Gruppe A mit fünf Teams (Musterstadt Baskets, SG Nord, TV Süd, BC West, Donau Hawks, alle Tabellenwerte 0) und den Gruppen-Reitern A/B; 24 zeigt den Abschnitt „Gruppen“ mit Gruppenvorschlag, Rückspiel-Option und Zuordnung; 26/27 zeigen das 64-Teams-Turnier (16 Reiter bzw. Vorschlag „16 Gruppen“); 29 zeigt die Ergebnisliste mit den drei Filtern; 30 zeigt die Bestätigung „Ergebnis gespeichert.“ mit Link zur Gruppentabelle. Abweichungen nennen und beheben.

- [ ] **Step 4: Commit**

```bash
npx vitest run src/content/manual-images.test.ts 2>&1 | tail -6
git add screenshots/manual-screenshots.spec.ts public/anleitung
git commit -m "feat(screenshots): regenerate the group stage screenshots (24-30) in the DSS design"
```

### Task 5: Gesamtlauf, Determinismus, Kontaktbogen

- [ ] **Step 1: Sauberer Gesamtlauf und Doppelprobe**

```bash
npm run screenshots:manual 2>&1 | tail -8
(cd public/anleitung && shasum -a 256 *.png) > $SP/sha-run1.txt
npm run screenshots:manual 2>&1 | tail -4
(cd public/anleitung && shasum -a 256 *.png) | diff - $SP/sha-run1.txt && echo "alle 30 Bilder identisch"
git status --short | head -5
```

Expected: 3 passed je Lauf; `alle 30 Bilder identisch`; `git status` zeigt nach dem zweiten Lauf keine Änderung gegenüber dem Commit aus Task 4 (die Bilder sind byte-identisch). Weichen einzelne Bilder ab, diese Bilder und die Ursache nennen (Schriftladen, relative Zeiten, Fokus) und im Skript beheben (z. B. `networkidle` vor dem Screenshot, `await page.waitForTimeout(100)` nach Layoutwechsel, feste Daten); keine Toleranz einführen.

- [ ] **Step 2: Kontaktbogen aller 30 Bilder** (für die PR-Beschreibung und die Nutzerin/den Nutzer)

```bash
magick montage public/anleitung/*.png -tile 6x -geometry 232x+6+6 -background '#888' $SP/contact-all-30.png
ls -la $SP/contact-all-30.png
du -sh public/anleitung
```

Expected: eine Datei `contact-all-30.png`; Gesamtgröße von `public/anleitung` vergleichen mit vorher (1,5 MB); wächst sie auf mehr als ca. 3 MB, im Bericht nennen (und `pngquant`/`oxipng` nur vorschlagen, nicht eigenmächtig einführen).

### Task 6: Anleitungstext angleichen

**Files:**
- Modify: `src/content/manual.md`, ggf. `src/pages/ManualPage.test.tsx`

- [ ] **Step 1: Bilder gegen Text prüfen.** Für jede Stelle im Text, die ein Bild beschreibt, das Bild ansehen und mit dem Wortlaut abgleichen. Besonders prüfen (jeweils mit Bild): „grünes Häkchen“ (Bild 11), „rotes … zurückgezogen-Feld“ (Bild 14), „Hinweisbalken … Zur aktuellen Runde“ (Bild 15), Button-Beschriftungen („Nächste Runde auslosen“, „Turnier abschließen“, „Korrigieren“, „Bearbeitung freischalten“), der Abschnitt 4.1 (Bilder 24, 27), „Ergebnis gespeichert“ mit Link (Bild 30). Nicht mehr zutreffende Aussagen korrigieren; **nichts Neues erfinden**.

- [ ] **Step 2: Bekannte veraltete Passagen** (laut Spec, in `manual.md` im Abschnitt 6 und 6.1) ersetzen:

alt (Abschnitt 6): `Über den Button **„Drucken"** oben rechts lässt sich die komplette Übersicht (Tabelle + Zeitplan) als druckfertige Seite öffnen — praktisch für einen Aushang vor Ort.`
neu: `Über den Button **„PDF herunterladen"** oben rechts lässt sich die komplette Übersicht (Tabelle + Zeitplan) als PDF herunterladen — praktisch für einen Aushang vor Ort.`

alt (Abschnitt 6.1): `Über die Buttons **„Diese Gruppe drucken"** und **„Alle Gruppen drucken"** oben rechts lässt sich entweder nur die gerade angezeigte Gruppe oder das komplette Turnier als druckfertige Seite öffnen. Beim Drucken aller Gruppen beginnt jede Gruppe automatisch auf einer neuen Seite, sodass sich einzelne Gruppen problemlos getrennt aushängen lassen.`
neu: `Über die Buttons **„Diese Gruppe als PDF herunterladen"** und **„Alle Gruppen als PDF herunterladen"** oben rechts lässt sich entweder nur die gerade angezeigte Gruppe oder das komplette Turnier als PDF herunterladen. Im PDF mit allen Gruppen beginnt jede Gruppe automatisch auf einer neuen Seite, sodass sich einzelne Gruppen problemlos getrennt aushängen lassen.`

alt (Bildunterschrift zu Bild 28): `![Gruppentabellen-Seite mit Gruppen-Reitern und Drucken-Buttons](28-gruppentabellen-tabs-drucken.png)`
neu: `![Gruppentabellen-Seite mit Gruppen-Reitern und PDF-Buttons](28-gruppentabellen-tabs-drucken.png)` (der Dateiname bleibt aus Gründen der Verlinkung unverändert).

In Abschnitt 1 (Kurzreferenz) „am Ende ausdrucken“ ist weiterhin sinnvoll (PDF zum Ausdrucken), unverändert lassen. Abschnitt 8 („PDF — druckfertiger Zeitplan“, „Web-Seite (ZIP)“) stimmt mit der Export-Seite überein: Button-Beschriftungen auf Bild 22 abgleichen.

- [ ] **Step 3: Tests**

```bash
grep -rn "Drucken-Buttons\|drucken" src --include='*.test.tsx' --include='*.test.ts'
npx vitest run src/pages/ManualPage.test.tsx src/content/manual-images.test.ts src/lib 2>&1 | tail -8
npm run typecheck; git checkout -- tsconfig.tsbuildinfo
```

Expected: PASS. Prüft ein Test die geänderte Bildunterschrift oder einen Text wörtlich, diesen Test an den neuen Wortlaut anpassen (nur dieselbe Aussage) und im Bericht nennen. Der Bildanzahl-Test (`images.length` 29) bleibt unverändert, weil keine Bilder hinzukamen oder wegfielen.

- [ ] **Step 4: Änderungsprotokoll.** Im Bericht eine Liste aller Textänderungen (Zeile, alt → neu) angeben, damit sie ohne Diff-Lesen nachvollziehbar sind.

- [ ] **Step 5: Commit**

```bash
git add src/content/manual.md src/pages/ManualPage.test.tsx
git commit -m "docs(manual): align the manual text with the current app (PDF downloads, screenshots)"
```

(Wurde `ManualPage.test.tsx` nicht geändert, bleibt sie beim `git add` einfach unverändert.)

### Task 7: Gesamtverifikation

- [ ] **Step 1: Alles ausführen**

```bash
npm run typecheck && npm test 2>&1 | tail -6 && npm run build 2>&1 | tail -4 && npm run test:e2e 2>&1 | tail -6
git checkout -- tsconfig.tsbuildinfo; rm -rf dist
```

Expected: alles grün; Unit-Anzahl = Baseline + 33 (Bild-Test); E2E unverändert (41). Die Anleitung ist kein E2E-Gegenstand; der Download-Test `organizer downloads the manual as a PDF` läuft dennoch mit den neuen Bildern.

- [ ] **Step 2: Anleitungs-PDF prüfen.** Falls das PDF-Capture-Skript aus 4a vorhanden ist (`$SP/pdf-capture.cjs`), nur den Job `anleitung` verwenden (oder das Skript vollständig laufen lassen), sonst per Playwright den Button „Als PDF herunterladen“ auf `/anleitung` klicken und speichern:

```bash
NODE_PATH=$PWD/node_modules node $SP/pdf-capture.cjs $SP/pdf-4b
pdfinfo $SP/pdf-4b/anleitung.pdf | grep -E "Pages|File size"
pdffonts $SP/pdf-4b/anleitung.pdf
pdftoppm -r 50 -png -f 1 -l 4 $SP/pdf-4b/anleitung.pdf $SP/png-4b-anleitung
ls $SP/png-4b-anleitung-*.png
```

Expected: keine Konsolenwarnungen (react-pdf); Schriften Sora/Manrope eingebettet; Seitenzahl und Größe plausibel (im Bericht nennen, Vergleich mit der Baseline aus 4a, falls vorhanden). Die ersten Seiten ansehen: Screenshots sind eingebettet, nichts abgeschnitten.

- [ ] **Step 3: Anleitungsseite im Browser prüfen.** Mit einem kurzen Playwright-Skript `/anleitung` laden (Viewport 1280×900), `document.fonts.ready` abwarten, prüfen, dass alle 29 `img` geladen sind (`naturalWidth > 0`) und die Seite nicht horizontal scrollt; Screenshot (Scratchpad) des Seitenanfangs und eines Abschnitts mit Bild ansehen und beschreiben.

### Task 8: Dokumentation

**Files:**
- Modify: `docs/architecture/arc42/08-querschnittliche-konzepte.md`, `docs/architecture/arc42/11-risiken-und-technische-schulden.md`, `docs/use-cases-und-kritikalitaet.md`

- [ ] **Step 1: Vorab lesen:** `grep -n "^## 8\." docs/architecture/arc42/08-querschnittliche-konzepte.md | tail -2`, `sed -n '/^## 11.14/,$p' docs/architecture/arc42/11-risiken-und-technische-schulden.md`, `grep -n "N2" docs/use-cases-und-kritikalitaet.md`. Nächste freie Nummern verwenden (nach 4a: 8.14 vergeben, also 8.15, falls 4a gemergt ist; sonst die tatsächlich nächste).

- [ ] **Step 2: arc42 Kapitel 08** — Abschnitt anhängen:

```markdown
## 8.15 Anleitungs-Screenshots (reproduzierbar)

- Die 30 Bilder in `public/anleitung/` entstehen mit `npm run screenshots:manual` (Playwright, eigene Konfiguration
  `playwright.screenshots.config.ts`, Port 5174, nicht Teil der CI). `screenshots/manual-screenshots.spec.ts` führt die
  App in jeden Zustand (Schweizer Turnier über die UI, Gruppenbilder aus geseedetem `localStorage` auf Basis der
  Demo-Dateien) und speichert die Bilder unter unveränderten Dateinamen.
- `screenshots/manual-shots.ts` (`MANUAL_SHOTS`) ist die einzige Quelle für Dateinamen und Maße (Viewport = Bildgröße);
  `src/content/manual-images.test.ts` prüft Existenz, Maße und Referenzen gegen `manual.md`. Feste Locale `de-DE`,
  Zeitzone `Europe/Berlin`, `reducedMotion`: zwei Läufe liefern byte-identische Dateien.
- **Bei jeder sichtbaren UI-Änderung an dokumentierten Seiten** das Skript ausführen und die geänderten Bilder
  committen; danach `manual.md` gegen die Bilder abgleichen.
```

- [ ] **Step 3: arc42 Kapitel 11** — in 11.14 den Spiegelstrich zu den `/anleitung`-Screenshots streichen (erledigt). Ist danach „Teil 4“ vollständig erledigt, den Teil-4-Absatz entfernen bzw. auf „erledigt“ setzen. Neu aufnehmen: „`public/anleitung/25-gruppentabellen-uebersicht.png` ist in `manual.md` nicht referenziert (Waise; `MANUAL_SHOTS.referenced: false`); entweder referenzieren oder löschen.“

- [ ] **Step 4: Use-Case-Übersicht** — Zeile N2 (Anleitung): Testabsicherung von „Kein Test (statischer Inhalt)“ auf „Bild-Test (`manual-images.test.ts`: Existenz, Maße, Referenzen), `ManualPage.test.tsx`; Screenshots reproduzierbar per `npm run screenshots:manual`“ ändern. Kritikalität bleibt ⚪.

- [ ] **Step 5: Commit**

```bash
git add docs/architecture/arc42/08-querschnittliche-konzepte.md docs/architecture/arc42/11-risiken-und-technische-schulden.md docs/use-cases-und-kritikalitaet.md
git commit -m "docs: document the reproducible manual screenshots"
```

### Task 9: Übergabe (nur auf ausdrückliche Freigabe)

- [ ] **Step 1: Nicht ausführen, bevor die Nutzerin/der Nutzer es freigibt.** Danach:

```bash
git push -u origin feat/dss-manual-screenshots
gh pr create --base main --title "feat: Anleitungs-Screenshots im DSS-Design (reproduzierbar)" --body "<Inhalt, Test, Hinweise; Kontaktbogen der 30 Bilder (Pfad/Anhang), Textänderungen als Liste; endet mit der 🤖-Zeile>"
```

Der PR-Text enthält den Hinweis auf die Waise (Bild 25), die Textänderungsliste aus Task 6 und das Ergebnis der Doppelprobe. Merge durch die Nutzerin/den Nutzer (Ruleset verlangt ein Review).

---

## Self-Review (gegen den Spec, Abschnitt 4b)

- **Skript statt Handarbeit, eigener Lauf, Port, Script:** Task 2 (Konfiguration, `npm run screenshots:manual`, `webServer`, nicht in der CI).
- **`SHOTS`-Tabelle mit Originalmaßen:** Task 1 (30 Einträge, Maße aus den Originalen; Waise 25 markiert).
- **Zustände aus Demo-JSON bzw. UI:** Task 3 (Schweizer Turnier komplett über die UI), Task 4 (Gruppen aus Demo 02 umbenannt/geleert, Demo 04 für 64 Teams).
- **Reproduzierbarkeit (Locale, Zeitzone, reducedMotion, Fonts, Animationen, Fokus, feste Namen) und Doppelprobe:** Task 2 Step 5, Task 5 Step 1 (byte-identisch, keine Toleranz).
- **Bild-Test (Existenz, Maße, Referenzen):** Task 1.
- **Anleitungstext angleichen, nichts Neues erfinden:** Task 6 (Bildabgleich, bekannte Druck-Passagen mit exakten alt/neu-Texten, Änderungsprotokoll).
- **Risiken:** Binäre Diffs → Kontaktbogen (Task 5); Seed-Format → Task 4 Step 2; Determinismus → Task 5; PDF-Größe/Layout → Task 7 Step 2.
- **Doku laut `AGENTS.md`:** arc42 08 (8.15), 11.14, Use-Case N2 (Task 8); A11y-Liste unverändert (keine neue Route/kein neuer UI-Zustand).
- **Typkonsistenz:** `MANUAL_SHOTS`/`shotByFile`/`ManualShot` (`file, width, height, referenced`) in Tabelle, Test und Spec; Hilfsfunktionen `shoot`, `scrollToHeading`, `scrollToTop`, `clearStorage`, `addTeamViaUi`, `fillResultRow`, `loadDemo`, `seed` werden in Task 3/4 mit denselben Signaturen genutzt.
- **Platzhalter-Scan:** Die einzigen bewusst offenen Stellen sind die Locator-Nachschärfungen in Task 3/4 Step 2 (Fehlerbilder und Fundorte benannt) und die PR-Texte in Task 9 (Inhalt aus dem Verlauf zu füllen). Beide sind Verifikations- bzw. Übergabeschritte, keine fehlenden Inhalte.
