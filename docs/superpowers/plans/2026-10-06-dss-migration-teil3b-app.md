# DSS-Migration Teil 3b (App: Navigation, Seiten, Farben, Demo-Turniere) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Turnier-App nutzt die DSS-Komponenten aus `@bbv/dss-design-system@0.8.0` für Navigation, Tabellen, Reiter, Leerzustände und Formularfelder, hat keine Tailwind-Übergangsschicht mehr und bietet die fünf Demo-Turniere über eine eigene Seite `/demos` an.

**Architecture:** Ein reines Navigationsmodell (`src/lib/navigation.ts`) baut die gruppierte Struktur für `AppNav`; `AppShell` besteht nur noch aus `TopBar` + `AppNav` + `Outlet`. Seiten wechseln auf `Table`, `Tabs`, `Stepper`, `EmptyState`, `Select`, `Checkbox`. Die Tailwind-Alt-Namen (`brand.*`, `muted`, `card`, `border`, `tint` …) werden per Codemod durch dauerhafte Semantik-Klassen (`text-fg`, `text-mute`, `border-line`, `bg-hover`, `bg-surface`, `bg-page`, `bg-err`) ersetzt, die auf `--dss-*`-Variablen zeigen; ein Guard-Test verbietet die alten Namen. Demo-Laden nutzt `parseTournamentImport` und `importTournament` samt vorhandener Sperr-Bestätigung.

**Tech Stack:** React 18, React Router 6, Vite 6, Tailwind 3, Zustand, Vitest + Testing Library, Playwright + `@axe-core/playwright`, `@bbv/dss-design-system` (git-Abhängigkeit, ab Task 0 `#v0.8.0`).

**Arbeitsverzeichnis:** ein neuer Worktree des App-Repos `~/01-vibe-coding/00-Basektball/08-Fibalon-Baskets/02-turnier-manager` (Task 0). Nie im Haupt-Arbeitsverzeichnis arbeiten (hat uncommittete Doku-Änderungen). Kein Push, PR oder Merge ohne ausdrückliche Rückfrage.

**Spec:** `docs/superpowers/specs/2026-10-06-dss-migration-teil3-design.md` (Abschnitt „3b — App“). Voraussetzung: DSS `v0.8.0` ist gemergt und getaggt (erledigt).

**Konventionen (einhalten):**
- E2E zuerst: Für jeden neuen Nutzerfluss steht ein roter Playwright-Test vor der Umsetzung (Memory: e2e-first).
- Commit-Footer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (zweites `-m`); PR-Texte enden mit `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Das Wort `innerHTML` darf in keiner Datei vorkommen.
- Vitest stubbt CSS-Imports (auch `?raw`): Dateien in Tests per `node:fs` lesen.
- Pflichtfeld-Stern im Label: `getByRole('textbox', { name: 'Name' })` statt `getByLabelText('Name')`.
- DSS-Steuerelemente sind 44 px hoch (kompakt 36 px). Tailwind lädt VOR dem DSS-CSS: Utilities, die eine von DSS gesetzte Eigenschaft überschreiben, brauchen `!` (`!px-1`, `!font-mono`, `!h-9`).
- Befehle, die die Test-Suites betreffen: `npx vitest run` (Unit), `npx tsc -b` bzw. `npm run typecheck` (falls vorhanden, sonst `npx tsc --noEmit`), `npx playwright test` (E2E, startet den Dev-/Preview-Server laut `playwright.config.ts`).

---

## Datei-Übersicht

| Datei | Aktion | Verantwortung |
|---|---|---|
| `package.json`, `package-lock.json` | ändern | Abhängigkeit `#v0.8.0` |
| `e2e/helpers.ts` | erweitern | `goTo(page, label)` |
| `e2e/navigation.spec.ts`, `e2e/demo-tournaments.spec.ts` | neu | Nutzerflüsse (zuerst rot) |
| `src/lib/navigation.ts` + `.test.ts` | neu | Navigationsmodell |
| `src/components/layout/AppShell.tsx` + `.test.tsx` | umschreiben | TopBar + AppNav |
| `src/lib/demos.ts` + `.test.ts` | neu | Manifest der Demo-Turniere |
| `src/pages/DemosPage.tsx` + `.test.tsx`, `src/App.tsx` | neu/ändern | Seite `/demos` |
| `src/components/shared/ScheduleRequired.tsx` | neu | gemeinsamer EmptyState „Zeitplan fehlt“ |
| Seiten/Komponenten (siehe Tasks 5–8) | ändern | Table, Tabs, Stepper, EmptyState, Select, Checkbox, Zeilen |
| `tailwind.config.ts`, `src/index.css`, ~27 Dateien | ändern | Farb-Codemod, Übergangsschicht raus |
| `src/lib/legacy-classes.test.ts` | neu | Guard-Test |
| `e2e/accessibility.spec.ts` | erweitern | +4 Fälle (12 → 16) |
| `docs/…` | ändern | UC8, arc42 8.10/8.13/11.14/QS-4, ADR-13, 4b-Plan-Selektoren |

---

### Task 0: Worktree, Abhängigkeit auf v0.8.0, Grundlinie

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Worktree von `origin/main` anlegen und die Doku-Commits übernehmen**

```bash
cd ~/01-vibe-coding/00-Basektball/08-Fibalon-Baskets/02-turnier-manager
git fetch origin -q
git worktree add .worktrees/dss-teil3b -b feat/dss-teil3b origin/main
cd .worktrees/dss-teil3b
git cherry-pick 5805cc6 e387038 6067cde      # Spec + Plan 3a-1 aus Branch docs/dss-teil3-spec
git log --oneline -4
```

Falls der Plan-3b-Commit auf `docs/dss-teil3-spec` existiert, zusätzlich dessen SHA mit cherry-picken (`git log docs/dss-teil3-spec --oneline | head`). Expected: Die Spec-/Plan-Dateien liegen unter `docs/superpowers/`.

- [ ] **Step 2: Abhängigkeit anheben**

```bash
sed -i '' 's|github:OliEder/dss-design-system#v0.7.0|github:OliEder/dss-design-system#v0.8.0|' package.json
npm install 2>&1 | tail -4
git diff --stat package.json package-lock.json
grep -n "dss-design-system" package.json
```

Expected: nur der Versions-Tag in `package.json` und die zugehörigen Einträge in `package-lock.json` ändern sich. Danach `ls node_modules/@bbv/dss-design-system/dist/react/index.js node_modules/@bbv/dss-design-system/js/appnav.js` (beide müssen existieren) und
`node -e "import('@bbv/dss-design-system/react').then(m=>console.log(typeof m.AppNav, typeof m.Table, typeof m.EmptyState, typeof m.Stepper, typeof m.TopBar, typeof m.Checkbox))"` → `function function function function function object`.

- [ ] **Step 3: `npm ci` im sauberen Zustand prüfen**

Run: `rm -rf node_modules && npm ci 2>&1 | tail -3` (Speicherplatz knapp: erst `df -h .`; wenn < 3 GB frei, diesen Step überspringen und im Bericht vermerken).
Expected: Installation ohne SSH-Fehler (https-Tarball).

- [ ] **Step 4: Grundlinie**

Run: `npx vitest run 2>&1 | tail -6 && npx tsc --noEmit && npx playwright test 2>&1 | tail -6`
Expected: Unit-Tests grün (419), `tsc` still, E2E grün (41). Abweichende Zahlen im Bericht nennen.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: bump @bbv/dss-design-system to v0.8.0" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 1: E2E zuerst — `goTo`-Helfer, Navigations- und Demo-Spezifikationen (rot)

**Files:**
- Modify: `e2e/helpers.ts`
- Create: `e2e/navigation.spec.ts`, `e2e/demo-tournaments.spec.ts`

- [ ] **Step 1: `goTo`-Helfer ergänzen**

An `e2e/helpers.ts` anhängen:

```ts
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
```

- [ ] **Step 2: Navigations-Spezifikation schreiben**

`e2e/navigation.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { addTeam, goTo, selectMode } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/teams')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('Hauptnavigation ist nach Zweck gruppiert und navigiert über die Gruppen', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  for (const group of ['Vorbereiten', 'Spielen', 'Ansehen', 'Hilfe']) {
    await expect(nav.getByRole('button', { name: group, exact: true })).toBeVisible()
  }
  await expect(nav.getByRole('link', { name: 'Export', exact: true })).toBeVisible()

  await goTo(page, 'Konfiguration')
  await expect(page).toHaveURL(/\/config$/)
  await expect(nav.getByRole('button', { name: 'Vorbereiten', exact: true })).toHaveAttribute('aria-expanded', 'false')
  await goTo(page, 'Anleitung')
  await expect(page).toHaveURL(/\/anleitung$/)
})

test('Gruppe lässt sich mit Esc schließen, der Fokus kehrt zum Auslöser zurück', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  const trigger = nav.getByRole('button', { name: 'Vorbereiten', exact: true })
  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await nav.getByRole('link', { name: 'Teams', exact: true }).focus()
  await page.keyboard.press('Escape')
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(trigger).toBeFocused()
})

test('aktuelle Seite ist mit aria-current markiert', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await nav.getByRole('button', { name: 'Vorbereiten', exact: true }).click()
  await expect(nav.getByRole('link', { name: 'Teams', exact: true })).toHaveAttribute('aria-current', 'page')
})

test('Einträge, die einen Zeitplan brauchen, sind vorher gesperrt und danach Links', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await nav.getByRole('button', { name: 'Ansehen', exact: true }).click()
  const locked = nav.getByRole('link', { name: /^Zeitplan/ })
  await expect(locked).toHaveAttribute('aria-disabled', 'true')
  await expect(locked).not.toHaveAttribute('href', /.*/)

  await addTeam(page, 'Team A')
  await addTeam(page, 'Team B')
  await goTo(page, 'Konfiguration')
  await selectMode(page, 'Jeder gegen Jeden')
  await page.getByRole('button', { name: 'Zeitplan generieren' }).click()
  await expect(page.getByText(/Spiele · Ende ca\./)).toBeVisible()

  await goTo(page, 'Zeitplan')
  await expect(page).toHaveURL(/\/schedule$/)
})

test('auf dem Handy öffnet der Menü-Button die Navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  const toggle = nav.getByRole('button', { name: 'Menü' })
  await expect(toggle).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Vorbereiten', exact: true })).toBeHidden()
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await nav.getByRole('button', { name: 'Vorbereiten', exact: true }).click()
  await nav.getByRole('link', { name: 'Konfiguration', exact: true }).click()
  await expect(page).toHaveURL(/\/config$/)
})
```

Hinweis: Die Moduslabel-Zeichenkette in `selectMode` muss dem tatsächlichen Optionstext entsprechen; vor dem Schreiben `grep -n "Jeder gegen Jeden" src/components/config/TournamentForm.tsx` und ggf. anpassen.

- [ ] **Step 3: Demo-Spezifikation schreiben**

`e2e/demo-tournaments.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { goTo } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/demos')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('ein Demo-Turnier laden füllt Teams und Zeitplan und öffnet die passende Übersicht', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Demo-Turniere', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: /Sommerturnier Musterstadt.*laden/ }).click()
  await expect(page).toHaveURL(/\/schedule$/)
  await goTo(page, 'Teams')
  await expect(page.getByText('9 Teams')).toBeVisible()
})

test('ein Schweizer-System-Demo landet auf der Turnierübersicht', async ({ page }) => {
  await page.getByRole('button', { name: /Einstufungsturnier Bezirksliga.*laden/ }).click()
  await expect(page).toHaveURL(/\/swiss-overview$/)
  await expect(page.getByRole('table')).toBeVisible()
})

test('läuft bereits ein Turnier mit Ergebnissen, ist eine Bestätigung nötig', async ({ page }) => {
  await page.getByRole('button', { name: /Sommerturnier Musterstadt.*laden/ }).click()
  await expect(page).toHaveURL(/\/schedule$/)

  await goTo(page, 'Demo-Turniere')
  await page.getByRole('button', { name: /Einstufungsturnier Bezirksliga.*laden/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Änderung am laufenden Turnier' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Bestätigen' })).toBeDisabled()

  await dialog.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page).toHaveURL(/\/demos$/)

  await page.getByRole('button', { name: /Einstufungsturnier Bezirksliga.*laden/ }).click()
  await dialog.getByRole('textbox').fill('ÄNDERN')
  await dialog.getByRole('button', { name: 'Bestätigen' }).click()
  await expect(page).toHaveURL(/\/swiss-overview$/)
})

test('die leere Teamseite verweist auf die Demo-Turniere', async ({ page }) => {
  await page.goto('/teams')
  await expect(page.getByText('Noch keine Teams')).toBeVisible()
  await page.getByRole('link', { name: 'Demo ansehen' }).click()
  await expect(page).toHaveURL(/\/demos$/)
})
```

- [ ] **Step 4: Rot bestätigen**

Run: `npx playwright test e2e/navigation.spec.ts e2e/demo-tournaments.spec.ts 2>&1 | tail -25`
Expected: alle neuen Tests FAIL (Navigation: Gruppen-Buttons fehlen, `/demos` unbekannt). Diese Rot-Ausgabe im Bericht nennen.

- [ ] **Step 5: Commit**

```bash
git add e2e/helpers.ts e2e/navigation.spec.ts e2e/demo-tournaments.spec.ts
git commit -m "test(e2e): add goTo helper and failing navigation and demo specs" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Navigationsmodell (`buildNavigation`)

**Files:**
- Create: `src/lib/navigation.ts`, `src/lib/navigation.test.ts`

- [ ] **Step 1: Failing Test schreiben**

`src/lib/navigation.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { AppNavGroup, AppNavItem, AppNavLink } from '@bbv/dss-design-system/react'
import type { Schedule, TournamentConfig } from '@/types'
import { buildNavigation, SCHEDULE_REQUIRED_HINT } from './navigation'

function tournament(overrides: Partial<TournamentConfig> = {}, groupIds: string[] = ['A']): TournamentConfig {
  return {
    id: 't1',
    name: 'Test',
    mode: 'round-robin',
    fields: 2,
    teams: groupIds.map((groupId, i) => ({ id: `team${i}`, name: `Team ${i}`, groupId })),
    ...overrides,
  } as unknown as TournamentConfig
}

const SCHEDULE = { id: 's1', tournamentId: 't1', games: [{ id: 'g1' }] } as unknown as Schedule

const isGroup = (item: AppNavItem): item is AppNavGroup => 'items' in item
const group = (items: AppNavItem[], id: string) => items.find((i): i is AppNavGroup => isGroup(i) && i.id === id)!
const labels = (g: AppNavGroup) => g.items.map((i) => i.label)
const find = (items: AppNavItem[], id: string): AppNavLink => {
  for (const item of items) {
    if (isGroup(item)) {
      const hit = item.items.find((l) => l.id === id)
      if (hit) return hit
    } else if (item.id === id) return item
  }
  throw new Error(`kein Eintrag ${id}`)
}

describe('buildNavigation', () => {
  it('liefert die Gruppen Vorbereiten, Spielen, Ansehen, den Export-Link und Hilfe', () => {
    const nav = buildNavigation({ tournament: tournament(), schedule: null })
    expect(nav.map((i) => i.id)).toEqual(['prepare', 'play', 'view', 'export', 'help'])
    expect(labels(group(nav, 'prepare'))).toEqual(['Teams', 'Konfiguration'])
    expect(labels(group(nav, 'help'))).toEqual(['Anleitung', 'Demo-Turniere'])
    expect(isGroup(find(nav, 'export'))).toBe(false)
  })

  it('sperrt Einträge, die einen Zeitplan brauchen, solange keiner existiert', () => {
    const nav = buildNavigation({ tournament: tournament(), schedule: null })
    for (const id of ['results', 'schedule']) {
      expect(find(nav, id)).toMatchObject({ disabled: true, hint: SCHEDULE_REQUIRED_HINT })
    }
    for (const id of ['teams', 'config', 'export', 'manual', 'demos']) {
      expect(find(nav, id).disabled).toBeUndefined()
    }
  })

  it('schaltet die Einträge frei, sobald ein Zeitplan mit Spielen existiert', () => {
    const nav = buildNavigation({ tournament: tournament(), schedule: SCHEDULE })
    expect(find(nav, 'results').disabled).toBeUndefined()
    expect(find(nav, 'schedule').disabled).toBeUndefined()
  })

  it('behandelt einen Zeitplan ohne Spiele wie keinen Zeitplan', () => {
    const empty = { ...SCHEDULE, games: [] } as unknown as Schedule
    expect(find(buildNavigation({ tournament: tournament(), schedule: empty }), 'schedule').disabled).toBe(true)
  })

  it('zeigt im Schweizer System Ergebnisse und Turnierübersicht, aber keinen Zeitplan', () => {
    const nav = buildNavigation({ tournament: tournament({ mode: 'swiss' }), schedule: SCHEDULE })
    expect(labels(group(nav, 'play'))).toEqual(['Ergebnisse erfassen'])
    expect(labels(group(nav, 'view'))).toEqual(['Turnierübersicht'])
    expect(find(nav, 'results').href).toBe('/swiss-results')
    expect(find(nav, 'overview').href).toBe('/swiss-overview')
  })

  it('zeigt Gruppentabellen nur bei mehreren Gruppen', () => {
    const single = buildNavigation({ tournament: tournament({}, ['A', 'A']), schedule: SCHEDULE })
    const multi = buildNavigation({ tournament: tournament({}, ['A', 'B']), schedule: SCHEDULE })
    expect(labels(group(single, 'view'))).toEqual(['Zeitplan'])
    expect(labels(group(multi, 'view'))).toEqual(['Zeitplan', 'Gruppentabellen'])
  })

  it('ergänzt bei Endrunde 4 Endrunden-Ergebnisse und Endstand', () => {
    const t = tournament({ mode: 'round-robin+finals', finalsVariant: 'endrunde-4' }, ['A', 'B'])
    const nav = buildNavigation({ tournament: t, schedule: SCHEDULE })
    expect(labels(group(nav, 'play'))).toEqual(['Ergebnisse erfassen', 'Endrunde: Ergebnisse'])
    expect(labels(group(nav, 'view'))).toEqual(['Zeitplan', 'Gruppentabellen', 'Endstand'])
  })

  it('ergänzt bei Endrunde 3 die KO-Ergebnisse ohne Endstand', () => {
    const t = tournament({ mode: 'round-robin+finals', finalsVariant: 'endrunde-3' }, ['A', 'B'])
    const nav = buildNavigation({ tournament: t, schedule: SCHEDULE })
    expect(labels(group(nav, 'play'))).toEqual(['Ergebnisse erfassen', 'Endrunde: KO-Ergebnisse'])
    expect(labels(group(nav, 'view'))).not.toContain('Endstand')
  })

  it('ergänzt bei Endrunde 1 die K.-o.-Ergebnisse und den Endstand', () => {
    const t = tournament({ mode: 'round-robin+finals', finalsVariant: 'endrunde-1' }, ['A', 'B'])
    const nav = buildNavigation({ tournament: t, schedule: SCHEDULE })
    expect(labels(group(nav, 'play'))).toEqual(['Ergebnisse erfassen', 'Endrunde: K.-o.-Ergebnisse'])
    expect(labels(group(nav, 'view'))).toContain('Endstand')
  })

  it('ignoriert eine Endrunden-Variante, wenn der Modus keine Endrunde hat', () => {
    const t = tournament({ mode: 'round-robin', finalsVariant: 'endrunde-4' })
    const nav = buildNavigation({ tournament: t, schedule: SCHEDULE })
    expect(labels(group(nav, 'play'))).toEqual(['Ergebnisse erfassen'])
  })

  it('stellt basePath allen Pfaden voran', () => {
    const nav = buildNavigation({ tournament: tournament(), schedule: SCHEDULE, basePath: '/turniere/abc' })
    expect(find(nav, 'teams').href).toBe('/turniere/abc/teams')
    expect(find(nav, 'demos').href).toBe('/turniere/abc/demos')
  })

  it('lässt keine Gruppe leer', () => {
    for (const mode of ['round-robin', 'swiss', 'round-robin+finals'] as const) {
      const nav = buildNavigation({ tournament: tournament({ mode }), schedule: null })
      for (const item of nav) if (isGroup(item)) expect(item.items.length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Rot bestätigen**

Run: `npx vitest run src/lib/navigation.test.ts 2>&1 | tail -8`
Expected: FAIL (`Failed to resolve import "./navigation"`).

- [ ] **Step 3: Implementieren**

`src/lib/navigation.ts`:

```ts
import type { AppNavItem, AppNavLink } from '@bbv/dss-design-system/react'
import type { Schedule, TournamentConfig } from '@/types'

export const SCHEDULE_REQUIRED_HINT = 'Bitte zuerst einen Zeitplan generieren'

interface NavigationInput {
  tournament: TournamentConfig
  schedule: Schedule | null
  /** Präfix für alle Pfade; später `/turniere/:id` für die Mehrturnier-Version (ADR-13). */
  basePath?: string
}

/** Baut die gruppierte Hauptnavigation für `AppNav` aus Turniermodus, Endrunden-Variante und Zeitplan-Zustand. */
export function buildNavigation({ tournament, schedule, basePath = '' }: NavigationInput): AppNavItem[] {
  const hasSchedule = !!schedule && schedule.games.length > 0
  const isSwiss = tournament.mode === 'swiss'
  const variant = tournament.mode === 'round-robin+finals' ? tournament.finalsVariant : undefined
  const hasMultipleGroups = new Set(tournament.teams.map((t) => t.groupId ?? 'A')).size > 1

  const link = (id: string, label: string, path: string, needsSchedule = false): AppNavLink => ({
    id,
    label,
    href: `${basePath}${path}`,
    ...(needsSchedule && !hasSchedule ? { disabled: true, hint: SCHEDULE_REQUIRED_HINT } : {}),
  })

  const play: AppNavLink[] = isSwiss
    ? [link('results', 'Ergebnisse erfassen', '/swiss-results', true)]
    : [
        link('results', 'Ergebnisse erfassen', '/group-results', true),
        ...(variant === 'endrunde-4' ? [link('finals-results', 'Endrunde: Ergebnisse', '/finals-results', true)] : []),
        ...(variant === 'endrunde-3' ? [link('playoff-results', 'Endrunde: KO-Ergebnisse', '/playoff-results', true)] : []),
        ...(variant === 'endrunde-1' ? [link('bracket-results', 'Endrunde: K.-o.-Ergebnisse', '/bracket-results', true)] : []),
      ]

  const view: AppNavLink[] = isSwiss
    ? [link('overview', 'Turnierübersicht', '/swiss-overview', true)]
    : [
        link('schedule', 'Zeitplan', '/schedule', true),
        ...(hasMultipleGroups ? [link('group-overview', 'Gruppentabellen', '/group-overview', true)] : []),
        ...(variant === 'endrunde-4' || variant === 'endrunde-1'
          ? [link('final-standings', 'Endstand', '/final-standings', true)]
          : []),
      ]

  return [
    { id: 'prepare', label: 'Vorbereiten', items: [link('teams', 'Teams', '/teams'), link('config', 'Konfiguration', '/config')] },
    { id: 'play', label: 'Spielen', items: play },
    { id: 'view', label: 'Ansehen', items: view },
    link('export', 'Export', '/export'),
    {
      id: 'help',
      label: 'Hilfe',
      items: [link('manual', 'Anleitung', '/anleitung'), link('demos', 'Demo-Turniere', '/demos')],
    },
  ]
}
```

- [ ] **Step 4: Grün bestätigen**

Run: `npx vitest run src/lib/navigation.test.ts && npx tsc --noEmit`
Expected: 12 Tests grün, `tsc` still.

- [ ] **Step 5: Commit**

```bash
git add src/lib/navigation.ts src/lib/navigation.test.ts
git commit -m "feat: add navigation model for the grouped main navigation" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: AppShell mit TopBar + AppNav, Unit-Tests, E2E-Umstellung auf `goTo`

**Files:**
- Modify: `src/components/layout/AppShell.tsx`, `src/components/layout/AppShell.test.tsx`, alle `e2e/*.spec.ts`, `e2e/helpers.ts`

- [ ] **Step 1: `AppShell.tsx` ersetzen**

```tsx
import { Link, Outlet, useLocation } from 'react-router-dom'
import { AppNav, TopBar } from '@bbv/dss-design-system/react'
import { useTournamentStore } from '@/store/tournament-store'
import { buildNavigation } from '@/lib/navigation'

export default function AppShell() {
  const { tournament, schedule } = useTournamentStore()
  const { pathname } = useLocation()
  const items = buildNavigation({ tournament, schedule })

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar as="header" brand="Basketball Turnier-Manager" mark="T" />
      <AppNav
        items={items}
        currentHref={pathname}
        ariaLabel="Hauptnavigation"
        renderLink={({ item, className, ariaCurrent, onNavigate, children }) => (
          <Link to={item.href} className={className} aria-current={ariaCurrent} onClick={onNavigate}>
            {children}
          </Link>
        )}
      />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
```

(Die Klassen `bg-background text-foreground` bleiben bis Task 9 und werden dort per Codemod ersetzt.)

- [ ] **Step 2: `AppShell.test.tsx` neu schreiben**

Die 16 bisherigen Fälle testen Logik, die jetzt in `navigation.test.ts` liegt. Ersetze die Datei durch Integrationstests (Beibehalten: `beforeEach`, `renderShell` mit Router wie bisher, aber `initialEntries` konfigurierbar):

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { useTournamentStore } from '@/store/tournament-store'
import { clearAll } from '@/lib/storage'
import AppShell from './AppShell'

beforeEach(() => {
  clearAll()
  useTournamentStore.setState({
    tournament: {
      id: 't1', name: 'Test', mode: 'round-robin', fields: 2,
      gameSettings: {
        periodsCount: 4, periodDurationMin: 5, breakBetweenPeriodsMin: 1,
        halfTimeBreakMin: 5, bufferBetweenGamesMin: 5, breakBetweenRoundsMin: 15,
        awardCeremonyMin: 15,
      },
      venue: {
        name: 'Halle', availabilityWindows: [{ start: '09:00', end: '20:00' }],
        blackoutPeriods: [], setupBufferMin: 30, teardownBufferMin: 30,
      },
      teams: [],
    },
    schedule: null,
  })
})

function renderShell(path = '/teams') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route path="teams" element={<div>Teams page</div>} />
          <Route path="schedule" element={<div>Schedule page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

const nav = () => screen.getByRole('navigation', { name: 'Hauptnavigation' })

function addTwoTeamsAndSchedule() {
  const store = useTournamentStore.getState()
  store.addTeam({ name: 'Team A', logoUrl: '', color: '#000', contact: '' })
  store.addTeam({ name: 'Team B', logoUrl: '', color: '#000', contact: '' })
  store.generateAndSaveSchedule()
}

describe('AppShell', () => {
  it('rendert Kopfleiste und gruppierte Hauptnavigation', () => {
    renderShell()
    expect(screen.getByRole('banner')).toHaveTextContent('Basketball Turnier-Manager')
    for (const name of ['Vorbereiten', 'Spielen', 'Ansehen', 'Hilfe']) {
      expect(within(nav()).getByRole('button', { name })).toBeInTheDocument()
    }
    expect(within(nav()).getByRole('link', { name: 'Export' })).toBeInTheDocument()
  })

  it('markiert die aktuelle Seite mit aria-current', () => {
    renderShell('/teams')
    fireEvent.click(within(nav()).getByRole('button', { name: 'Vorbereiten' }))
    expect(within(nav()).getByRole('link', { name: 'Teams' })).toHaveAttribute('aria-current', 'page')
  })

  it('zeigt „Zeitplan“ ohne Zeitplan als gesperrten Eintrag mit Hinweis', () => {
    renderShell()
    fireEvent.click(within(nav()).getByRole('button', { name: 'Ansehen' }))
    const locked = within(nav()).getByRole('link', { name: /Zeitplan/ })
    expect(locked).toHaveAttribute('aria-disabled', 'true')
    expect(locked).not.toHaveAttribute('href')
    expect(locked).toHaveAttribute('title', 'Bitte zuerst einen Zeitplan generieren')
  })

  it('zeigt „Zeitplan“ mit Zeitplan als Link', () => {
    addTwoTeamsAndSchedule()
    renderShell()
    fireEvent.click(within(nav()).getByRole('button', { name: 'Ansehen' }))
    expect(within(nav()).getByRole('link', { name: 'Zeitplan' })).toHaveAttribute('href', '/schedule')
  })

  it('zeigt im Schweizer System die Turnierübersicht statt des Zeitplans', () => {
    useTournamentStore.getState().setMode('swiss')
    renderShell()
    fireEvent.click(within(nav()).getByRole('button', { name: 'Ansehen' }))
    expect(within(nav()).getByText('Turnierübersicht')).toBeInTheDocument()
    expect(within(nav()).queryByText('Zeitplan')).not.toBeInTheDocument()
  })

  it('schaltet das mobile Menü über den Menü-Button', () => {
    renderShell()
    const toggle = within(nav()).getByRole('button', { name: 'Menü' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('führt nach Klick auf einen Link zur Seite und schließt das Dropdown', () => {
    addTwoTeamsAndSchedule()
    renderShell()
    fireEvent.click(within(nav()).getByRole('button', { name: 'Ansehen' }))
    fireEvent.click(within(nav()).getByRole('link', { name: 'Zeitplan' }))
    expect(screen.getByText('Schedule page')).toBeInTheDocument()
    expect(within(nav()).getByRole('button', { name: 'Ansehen' })).toHaveAttribute('aria-expanded', 'false')
  })
})
```

Run: `npx vitest run src/components/layout/AppShell.test.tsx`
Expected: 7 Tests grün. Schlägt `getByRole('banner')` fehl (zwei Banner?), prüfen, dass nur `TopBar as="header"` einen `<header>` rendert.

- [ ] **Step 3: E2E-Codemod für alle Spezifikationen**

Skript im Scratch-Verzeichnis (NICHT committen) `scratchpad/codemod-goto.mjs`:

```js
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const LABELS = ['Teams', 'Konfiguration', 'Ergebnisse erfassen', 'Endrunde: Ergebnisse', 'Endrunde: KO-Ergebnisse',
  'Endrunde: K.-o.-Ergebnisse', 'Zeitplan', 'Turnierübersicht', 'Gruppentabellen', 'Endstand', 'Export', 'Anleitung']
const dir = process.argv[2]
const pattern = new RegExp(`await page\\.getByRole\\('link', \\{ name: '(${LABELS.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})'(?:, exact: true)? \\}\\)\\.click\\(\\)`, 'g')

for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'helpers.ts' && !f.startsWith('navigation') && !f.startsWith('demo'))) {
  const path = join(dir, file)
  const src = readFileSync(path, 'utf8')
  const out = src.replace(pattern, (_m, label) => `await goTo(page, '${label}')`)
  if (out === src) continue
  const withImport = /from '\.\/helpers'/.test(out)
    ? out.replace(/import \{([^}]*)\} from '\.\/helpers'/, (m, names) => (names.includes('goTo') ? m : `import {${names.trimEnd()}, goTo } from './helpers'`))
    : out.replace(/^(import [^\n]+\n)+/m, (m) => `${m}import { goTo } from './helpers'\n`)
  writeFileSync(path, withImport)
  console.log('umgestellt:', file)
}
```

Run: `node <scratchpad>/codemod-goto.mjs e2e && git diff --stat e2e | tail -3`
Danach alle Reste suchen und von Hand beheben: `grep -rn "getByRole('link'" e2e | grep -v "navigation.spec\|demo-tournaments"`. Verbleibende Treffer sind (a) `expect(...)` auf Navigationslinks (z. B. „link Zeitplan ist sichtbar“) → Dropdown öffnen und gegen `nav.getByRole('link', …)` prüfen oder auf die Seitenüberschrift/URL umstellen; (b) Seiteninhalts-Links (z. B. „Tabelle für Gruppe … ansehen“) → unverändert lassen. `e2e/helpers.ts` ersetzt dabei seine Navigation selbst: in `setupSwissTournament` die beiden `page.getByRole('link', …).click()` durch `goTo(page, 'Konfiguration')` und `goTo(page, 'Ergebnisse erfassen')` ersetzen.

- [ ] **Step 4: Seiten-Tabs vorbereiten (nur Notiz, kein Code)**

Die Selektoren `getByRole('button', { name: 'Gruppe B' })` und `getByRole('button', { name: 'Runde 1', exact: true })` ändern sich erst in Task 6 (Tabs). Jetzt NICHT anfassen.

- [ ] **Step 5: Typecheck, Unit- und E2E-Lauf**

Run: `npx tsc --noEmit && npx vitest run 2>&1 | tail -6 && npx playwright test 2>&1 | tail -15`
Expected: Unit grün; E2E: `navigation.spec.ts` grün (außer dem Test mit der Moduslabel-Zeichenkette, falls noch nicht angepasst — dann dort fixen); `demo-tournaments.spec.ts` weiterhin rot (kommt in Task 4); alle übrigen Spezifikationen grün. Rote Alt-Tests prüfen: oft fehlt ein `goTo`-Import oder eine Navigation ohne Zeitplan.

- [ ] **Step 6: Screenshot-Sichtprüfung**

Dev-Server starten (`npm run dev`) und per Playwright-Skript (Scratch) Desktop 1280×800 und Mobil 390×800 von `/teams` aufnehmen, jeweils mit geöffneter Gruppe „Vorbereiten“; per Read-Tool ansehen. Prüfen: TopBar, Navigationsleiste, Dropdown ohne Überlappung, Ausrichtung zum 5xl-Inhaltscontainer akzeptabel, Mobil-Menü lesbar. Auffälligkeiten (z. B. Navigationsleiste nicht am Inhalt ausgerichtet) im Bericht nennen und bei eindeutigen Fehlern beheben.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout e2e
git commit -m "feat: replace header with TopBar and grouped AppNav, switch e2e to goTo" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Demo-Turniere (Manifest, Seite, Route)

**Files:**
- Create: `src/lib/demos.ts`, `src/lib/demos.test.ts`, `src/pages/DemosPage.tsx`, `src/pages/DemosPage.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Failing Test für das Manifest**

`src/lib/demos.test.ts`:

```ts
// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { DEMOS, demoUrl, landingPathFor } from './demos'
import { parseTournamentImport } from './import/json-import'

const root = new URL('../../', import.meta.url)
const read = (file: string) => readFileSync(new URL(`public/demos/${file}`, root), 'utf8')

describe('DEMOS', () => {
  it('enthält fünf Einträge mit eindeutigen IDs und Dateien', () => {
    expect(DEMOS).toHaveLength(5)
    expect(new Set(DEMOS.map((d) => d.id)).size).toBe(5)
    expect(new Set(DEMOS.map((d) => d.file)).size).toBe(5)
  })

  it.each(DEMOS)('$file stimmt mit dem Manifest überein und ist importierbar', (entry) => {
    const result = parseTournamentImport(read(entry.file))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const games = result.schedule?.games ?? []
    expect(result.tournament.name).toBe(entry.title)
    expect(result.tournament.mode).toBe(entry.mode)
    expect(result.tournament.teams).toHaveLength(entry.teams)
    expect(new Set(result.tournament.teams.map((t) => t.groupId ?? 'A')).size).toBe(entry.groups)
    expect(games).toHaveLength(entry.games)
    expect(games.filter((g) => g.periodScores.length > 0)).toHaveLength(entry.played)
  })
})

describe('demoUrl', () => {
  it('hängt die Datei an die Basis-URL', () => {
    expect(demoUrl(DEMOS[0], '/basketball/')).toBe(`/basketball/demos/${DEMOS[0].file}`)
  })
})

describe('landingPathFor', () => {
  it('führt Schweizer System auf die Turnierübersicht', () => {
    expect(landingPathFor({ mode: 'swiss', groups: 1 })).toBe('/swiss-overview')
  })
  it('führt mehrere Gruppen auf die Gruppentabellen', () => {
    expect(landingPathFor({ mode: 'round-robin+finals', groups: 2 })).toBe('/group-overview')
  })
  it('führt Jeder gegen Jeden auf den Zeitplan', () => {
    expect(landingPathFor({ mode: 'round-robin', groups: 1 })).toBe('/schedule')
  })
})
```

Run: `npx vitest run src/lib/demos.test.ts 2>&1 | tail -6` → Expected: FAIL (Import fehlt).

- [ ] **Step 2: Manifest implementieren**

`src/lib/demos.ts`:

```ts
import type { TournamentConfig } from '@/types'
import { parseTournamentImport, type TournamentImportResult } from '@/lib/import/json-import'

export interface DemoEntry {
  id: string
  file: string
  /** Muss dem Turniernamen in der JSON-Datei entsprechen (Test prüft das). */
  title: string
  description: string
  mode: TournamentConfig['mode']
  teams: number
  groups: number
  games: number
  played: number
}

export const DEMOS: DemoEntry[] = [
  {
    id: 'round-robin',
    file: '01-jeder-gegen-jeden-9-teams-laufend.json',
    title: 'Sommerturnier Musterstadt (Jeder gegen Jeden)',
    description: 'Neun Teams spielen eine einfache Runde, acht Spiele sind bereits erfasst.',
    mode: 'round-robin',
    teams: 9,
    groups: 1,
    games: 36,
    played: 8,
  },
  {
    id: 'groups-finals',
    file: '02-gruppenphase-endrunde-9-teams-laufend.json',
    title: 'Verbandsturnier Rhein-Main (Gruppenphase + Endrunde)',
    description: 'Zwei Gruppen mit anschließender Endrunde, acht Gruppenspiele sind erfasst.',
    mode: 'round-robin+finals',
    teams: 9,
    groups: 2,
    games: 20,
    played: 8,
  },
  {
    id: 'swiss',
    file: '03-schweizer-system-9-teams-laufend.json',
    title: 'Einstufungsturnier Bezirksliga (Schweizer System)',
    description: 'Neun Teams im Schweizer System, die erste Runde ist teilweise gespielt.',
    mode: 'swiss',
    teams: 9,
    groups: 1,
    games: 20,
    played: 4,
  },
  {
    id: 'large-fresh',
    file: '04-grossturnier-64-teams-16-gruppen-ungespielt.json',
    title: 'Verbandsturnier Süd (Großturnier, 64 Teams)',
    description: '64 Teams in 16 Gruppen mit Endrunde, noch kein Spiel erfasst.',
    mode: 'round-robin+finals',
    teams: 64,
    groups: 16,
    games: 100,
    played: 0,
  },
  {
    id: 'large-running',
    file: '05-grossturnier-64-teams-16-gruppen-laufend.json',
    title: 'Verbandsturnier Süd (Großturnier, 64 Teams, laufend)',
    description: '64 Teams in 16 Gruppen mit Endrunde, 32 Spiele sind erfasst.',
    mode: 'round-robin+finals',
    teams: 64,
    groups: 16,
    games: 100,
    played: 32,
  },
]

export function demoUrl(entry: DemoEntry, base: string = import.meta.env.BASE_URL): string {
  return `${base}demos/${entry.file}`
}

/** Seite, auf der ein frisch geladenes Demo-Turnier startet. */
export function landingPathFor(entry: Pick<DemoEntry, 'mode' | 'groups'>): string {
  if (entry.mode === 'swiss') return '/swiss-overview'
  if (entry.groups > 1) return '/group-overview'
  return '/schedule'
}

export async function loadDemo(entry: DemoEntry, fetcher: typeof fetch = fetch): Promise<TournamentImportResult> {
  let response: Response
  try {
    response = await fetcher(demoUrl(entry))
  } catch {
    return { ok: false, error: 'Das Demo-Turnier konnte nicht geladen werden (keine Verbindung).' }
  }
  if (!response.ok) {
    return { ok: false, error: `Das Demo-Turnier konnte nicht geladen werden (Fehler ${response.status}).` }
  }
  return parseTournamentImport(await response.text())
}
```

Run: `npx vitest run src/lib/demos.test.ts` → Expected: grün (5 + 5 + 1 + 3 Fälle). Weicht eine Zahl/ein Name ab, die Datei ist maßgeblich: Manifest anpassen.

- [ ] **Step 3: Failing Test für die Seite**

`src/pages/DemosPage.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useTournamentStore } from '@/store/tournament-store'
import { clearAll } from '@/lib/storage'
import { DEMOS } from '@/lib/demos'
import DemosPage from './DemosPage'

const demoJson = (name: string, played = false) =>
  JSON.stringify({
    tournament: { id: 'd1', name, mode: 'round-robin', fields: 1, gameSettings: {}, venue: {}, teams: [{ id: 'x' }] },
    schedule: { id: 's1', tournamentId: 'd1', games: [{ id: 'g1', periodScores: played ? [{ period: 1, homeScore: 1, awayScore: 0 }] : [] }] },
  })

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/demos']}>
      <Routes>
        <Route path="/demos" element={<DemosPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  clearAll()
  useTournamentStore.getState().resetTournament()
  vi.restoreAllMocks()
})

const loadButton = (title: string) => screen.getByRole('button', { name: new RegExp(`${title.replace(/[()]/g, '\\$&')}.*laden`) })

describe('DemosPage', () => {
  it('listet alle Demo-Turniere mit Beschreibung', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'Demo-Turniere', level: 1 })).toBeInTheDocument()
    for (const demo of DEMOS) {
      expect(screen.getByRole('heading', { name: demo.title })).toBeInTheDocument()
      expect(screen.getByText(demo.description)).toBeInTheDocument()
    }
  })

  it('lädt ein Demo ohne Rückfrage, wenn das aktuelle Turnier keine Ergebnisse hat, und navigiert', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(demoJson(DEMOS[0].title)))
    renderPage()
    fireEvent.click(loadButton(DEMOS[0].title))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/schedule'))
    expect(useTournamentStore.getState().tournament.name).toBe(DEMOS[0].title)
  })

  it('fragt bei laufendem Turnier nach und importiert erst nach Bestätigung', async () => {
    useTournamentStore.getState().importTournament(
      JSON.parse(demoJson('Altes Turnier', true)).tournament,
      JSON.parse(demoJson('Altes Turnier', true)).schedule,
    )
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(demoJson(DEMOS[0].title)))
    renderPage()
    fireEvent.click(loadButton(DEMOS[0].title))
    const dialog = await screen.findByRole('dialog')
    expect(useTournamentStore.getState().tournament.name).toBe('Altes Turnier')
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ÄNDERN' } })
    fireEvent.click(screen.getByRole('button', { name: 'Bestätigen' }))
    await waitFor(() => expect(useTournamentStore.getState().tournament.name).toBe(DEMOS[0].title))
    expect(dialog).not.toBeInTheDocument()
  })

  it('zeigt einen Fehler, wenn das Laden scheitert', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 404 }))
    renderPage()
    fireEvent.click(loadButton(DEMOS[0].title))
    expect(await screen.findByRole('alert')).toHaveTextContent(/konnte nicht geladen werden/)
  })
})
```

Run: `npx vitest run src/pages/DemosPage.test.tsx 2>&1 | tail -6` → Expected: FAIL (Import fehlt). Hinweis: `Response.text()` in jsdom/Node 18+ vorhanden; falls `Response` fehlt, in `src/test-setup.ts` prüfen (Node-Global).

- [ ] **Step 4: Seite implementieren**

`src/pages/DemosPage.tsx`:

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banner, Button, Card } from '@bbv/dss-design-system/react'
import { DestructiveConfirmDialog } from '@/components/shared/DestructiveConfirmDialog'
import { DEMOS, landingPathFor, loadDemo, type DemoEntry } from '@/lib/demos'
import { useTournamentStore } from '@/store/tournament-store'
import type { Schedule, TournamentConfig } from '@/types'

interface Pending {
  entry: DemoEntry
  tournament: TournamentConfig
  schedule: Schedule | null
}

const MODE_LABEL: Record<DemoEntry['mode'], string> = {
  'round-robin': 'Jeder gegen Jeden',
  'round-robin+finals': 'Gruppen + Endrunde',
  swiss: 'Schweizer System',
}

export default function DemosPage() {
  const navigate = useNavigate()
  const { isTournamentLocked, importTournament } = useTournamentStore()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)

  const apply = ({ entry, tournament, schedule }: Pending) => {
    importTournament(tournament, schedule)
    navigate(landingPathFor(entry))
  }

  const handleLoad = async (entry: DemoEntry) => {
    setError(null)
    setLoadingId(entry.id)
    const result = await loadDemo(entry)
    setLoadingId(null)
    if (!result.ok) {
      setError(result.error)
      return
    }
    const next = { entry, tournament: result.tournament, schedule: result.schedule }
    if (isTournamentLocked()) setPending(next)
    else apply(next)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl text-brand-primary">Demo-Turniere</h1>
        <p className="text-muted-foreground">
          Lade ein Beispielturnier, um die App auszuprobieren. Ein bestehendes Turnier wird dabei ersetzt.
        </p>
      </div>

      {error && <Banner severity="danger">{error}</Banner>}

      <ul className="grid gap-4 sm:grid-cols-2">
        {DEMOS.map(entry => (
          <li key={entry.id}>
            <Card
              header={<h2 className="text-lg">{entry.title}</h2>}
              footer={
                <Button
                  size="sm"
                  disabled={loadingId !== null}
                  aria-label={`${entry.title} laden`}
                  onClick={() => void handleLoad(entry)}
                >
                  {loadingId === entry.id ? 'Lädt …' : 'Laden'}
                </Button>
              }
            >
              <p className="mb-2">{entry.description}</p>
              <p className="text-sm text-muted-foreground">
                {MODE_LABEL[entry.mode]} · {entry.teams} Teams · {entry.games} Spiele · {entry.played} erfasst
              </p>
            </Card>
          </li>
        ))}
      </ul>

      <DestructiveConfirmDialog
        open={pending !== null}
        onOpenChange={open => {
          if (!open) setPending(null)
        }}
        title="Änderung am laufenden Turnier"
        description="Das aktuelle Turnier läuft bereits (mindestens ein Ergebnis wurde erfasst). Das Laden eines Demo-Turniers ersetzt es vollständig."
        confirmWord="ÄNDERN"
        onConfirm={() => {
          if (pending) apply(pending)
          setPending(null)
        }}
      />
    </div>
  )
}
```

Route in `src/App.tsx` ergänzen (Import + `<Route path="demos" element={<DemosPage />} />` vor `anleitung`).

Prüfen: Hat DSS-`Card` die Props `header`/`footer` und akzeptiert `<ul><li>`-Kinder? (`react/Card.tsx`: `header`, `footer`, `variant`, `padding`.) Hat `Banner` `severity="danger"`? (ja, `BannerSeverity`.)

- [ ] **Step 5: Grün bestätigen**

Run: `npx vitest run src/pages/DemosPage.test.tsx src/lib/demos.test.ts && npx tsc --noEmit`
Expected: grün.

- [ ] **Step 6: E2E-Demospezifikation grün**

Run: `npx playwright test e2e/demo-tournaments.spec.ts 2>&1 | tail -15`
Expected: Tests 1–3 grün. Test 4 („leere Teamseite“) bleibt rot bis Task 5 (EmptyState auf der Teamseite).

- [ ] **Step 7: Commit**

```bash
git add src/lib/demos.ts src/lib/demos.test.ts src/pages/DemosPage.tsx src/pages/DemosPage.test.tsx src/App.tsx
git commit -m "feat: add demo tournaments page with confirmation for running tournaments" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: EmptyState statt Hinweis-Bannern (inkl. Teamseite mit Demo-CTA)

**Files:**
- Create: `src/components/shared/ScheduleRequired.tsx`, `src/components/shared/ScheduleRequired.test.tsx`
- Modify: `GroupResultsPage`, `SwissResultsPage`, `SwissOverviewPage`, `GroupOverviewPage`, `FinalsResultsPage`, `PlayoffResultsPage`, `BracketResultsPage`, `FinalStandingsPage`, `ScheduleView`, `ExportPanel`, `TeamList` (alle unter `src/pages` bzw. `src/components`)

- [ ] **Step 1: Failing Test für die gemeinsame Komponente**

`src/components/shared/ScheduleRequired.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ScheduleRequired } from './ScheduleRequired'

describe('ScheduleRequired', () => {
  it('erklärt, dass zuerst ein Zeitplan nötig ist, und verlinkt zur Konfiguration', () => {
    render(
      <MemoryRouter>
        <ScheduleRequired />
      </MemoryRouter>,
    )
    expect(screen.getByText(/Bitte zuerst einen Zeitplan generieren/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Zur Konfiguration' })).toHaveAttribute('href', '/config')
  })

  it('akzeptiert einen abweichenden Seitenverweis im Text', () => {
    render(
      <MemoryRouter>
        <ScheduleRequired page="Zeitplan" />
      </MemoryRouter>,
    )
    expect(screen.getByText(/Seite „Zeitplan“/)).toBeInTheDocument()
  })
})
```

`src/components/shared/ScheduleRequired.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { EmptyState } from '@bbv/dss-design-system/react'

/** Leerzustand für alle Seiten, die erst nach dem Generieren eines Zeitplans Sinn ergeben. */
export function ScheduleRequired({ page = 'Konfiguration' }: { page?: string }) {
  return (
    <EmptyState
      tone="action"
      title="Noch kein Zeitplan"
      body={`Bitte zuerst einen Zeitplan generieren (Seite „${page}“).`}
      actions={
        <Link to="/config" className="dss-btn dss-btn--md dss-btn--amber">
          Zur Konfiguration
        </Link>
      }
    />
  )
}
```

Run: `npx vitest run src/components/shared/ScheduleRequired.test.tsx` → rot (Import) vor dem Anlegen der Datei, danach grün.

- [ ] **Step 2: Banner „Bitte zuerst einen Zeitplan generieren …“ ersetzen**

Betroffene Stellen (aus `grep -rn "Bitte zuerst einen Zeitplan" src`): `GroupResultsPage`, `SwissResultsPage`, `SwissOverviewPage`, `GroupOverviewPage`, `FinalsResultsPage`, `PlayoffResultsPage`, `BracketResultsPage`, `FinalStandingsPage`, `ScheduleView` (Text „Seite Konfiguration“), `ExportPanel` (Text „Seite Zeitplan“ — dort `page="Zeitplan"` übergeben, prüfen ob der Text so beibehalten werden soll).

Muster, für jede Datei:

```tsx
// vorher
if (!schedule) {
  return (
    <Banner>
      Bitte zuerst einen Zeitplan generieren (Seite „Konfiguration“).
    </Banner>
  )
}
// nachher
if (!schedule) return <ScheduleRequired />
```

plus `import { ScheduleRequired } from '@/components/shared/ScheduleRequired'`; `Banner` aus dem Import entfernen, wenn die Datei es sonst nicht mehr nutzt (sonst `noUnusedLocals`-Fehler). Der Text bleibt unverändert, damit bestehende Tests mit `getByText(/Bitte zuerst einen Zeitplan generieren/)` weiter greifen.

- [ ] **Step 3: „Keine Spiele für die gewählten Filter.“ und „Noch keine Endrunden-Ergebnisse vorhanden.“**

Vier Seiten (`GroupResultsPage`, `FinalsResultsPage`, `PlayoffResultsPage`, `BracketResultsPage`) und `FinalStandingsPage`:

```tsx
// vorher
{filteredGames.length === 0 && (
  <Banner>
    Keine Spiele für die gewählten Filter.
  </Banner>
)}
// nachher
{filteredGames.length === 0 && <EmptyState title="Keine Spiele für die gewählten Filter." />}
```

`EmptyState` ohne `body` rendert nur den Titel als Überschrift — die E2E-Selektoren `getByText('Keine Spiele für die gewählten Filter.')` bleiben gültig. `FinalStandingsPage`: `<EmptyState title="Noch keine Endrunden-Ergebnisse vorhanden." />`. Banner, die Hinweise/Fehler/Erfolg melden (z. B. „Ergebnis gespeichert“, „Du siehst eine bereits abgeschlossene Runde“), BLEIBEN `Banner`.

- [ ] **Step 4: Teamseite ohne Teams**

`src/components/teams/TeamList.tsx`:

```tsx
// vorher
{tournament.teams.length === 0 && (
  <p className="text-muted-foreground text-center py-8">Noch keine Teams. Füge das erste Team hinzu.</p>
)}
// nachher
{tournament.teams.length === 0 && (
  <EmptyState
    title="Noch keine Teams"
    body="Füge das erste Team hinzu (Button oben rechts) oder sieh dir ein Demo-Turnier an."
    actions={<Link to="/demos" className="dss-btn dss-btn--md dss-btn--ghost">Demo ansehen</Link>}
  />
)}
```

Imports ergänzen: `EmptyState` aus `@bbv/dss-design-system/react`, `Link` aus `react-router-dom`. Bewusst gibt es im Leerzustand NUR den Link „Demo ansehen“: ein zweiter Button „Team hinzufügen“ würde `getByRole('button', { name: 'Team hinzufügen' })` im E2E-Helfer `addTeam` und in vielen Tests mehrdeutig machen (Strict Mode).

`TeamList.test.tsx`: Tests, die den alten Text „Noch keine Teams. Füge das erste Team hinzu.“ prüfen, auf `getByText('Noch keine Teams')` umstellen und einen neuen Fall ergänzen (`getByRole('link', { name: 'Demo ansehen' })` hat `href` `/demos`; benötigt `MemoryRouter` im Test-Render). Alle anderen Tests, die `TeamList` ohne Router rendern, müssen in einen `MemoryRouter` eingebettet werden (Compilerfehler/„useHref“-Fehler zeigen die Stellen).

- [ ] **Step 5: Tests und Typecheck**

Run: `npx tsc --noEmit && npx vitest run 2>&1 | tail -8`
Expected: grün. Typische Anpassungen: Tests, die nach der Banner-Rolle (`status`) suchen, auf Text umstellen.

- [ ] **Step 6: E2E**

Run: `npx playwright test e2e/demo-tournaments.spec.ts e2e/endrunde-1.spec.ts e2e/endrunde-3.spec.ts 2>&1 | tail -12`
Expected: alle vier Demo-Tests grün; Endrunden-Spezifikationen unverändert grün.

- [ ] **Step 7: Commit**

```bash
git add -A src
git commit -m "feat: use EmptyState for missing schedule, empty filters and empty team list" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Tabellen (Table) und Reiter (Tabs) in den Seiten

**Files:**
- Modify: `src/pages/GroupOverviewPage.tsx`, `src/pages/SwissOverviewPage.tsx`, `src/pages/FinalStandingsPage.tsx`, `src/pages/SwissResultsPage.tsx`, jeweilige `.test.tsx` und E2E-Selektoren

- [ ] **Step 1: Gruppentabelle (`GroupOverviewPage`)**

```tsx
// vorher: <table className="w-full border-collapse"> … </table>
import { Banner, Button, Table, Tabs, type TableColumn } from '@bbv/dss-design-system/react'

const STANDINGS_COLUMNS: TableColumn[] = [
  { key: 'place', label: '#', width: '3rem' },
  { key: 'team', label: 'Team' },
  { key: 'points', label: 'Pkt', align: 'right' },
  { key: 'diff', label: 'Diff', align: 'right' },
  { key: 'record', label: 'S-U-N', align: 'right' },
]

<Table density="compact" caption={`Tabelle Gruppe ${currentGroupId}`} columns={STANDINGS_COLUMNS}>
  {standings.map((s, i) => (
    <tr key={s.teamId}>
      <td>{i + 1}</td>
      <td>{teamMap.get(s.teamId) && <TeamNameDisplay team={teamMap.get(s.teamId)!} />}</td>
      <td className="num lead">{s.points}</td>
      <td className="num">{s.pointsDiff > 0 ? '+' : ''}{s.pointsDiff}</td>
      <td className="num">{s.wins}-{s.draws}-{s.losses}</td>
    </tr>
  ))}
</Table>
```

Die Gruppen-Schaltflächen oben werden zu Reitern:

```tsx
// vorher: groupIds.map(groupId => <Button … onClick={() => setActiveGroupId(groupId)}>Gruppe {groupId}</Button>)
<Tabs
  variant="pills"
  size="sm"
  ariaLabel="Gruppen"
  items={groupIds.map(id => ({ id, label: `Gruppe ${id}` }))}
  value={currentGroupId}
  onValueChange={setActiveGroupId}
/>
```

Die `<h2>Gruppe {currentGroupId}</h2>` über der Tabelle bleibt (E2E `getByRole('heading', { name: 'Gruppe A' })`). Tests anpassen: `GroupOverviewPage.test.tsx` (Zeilen ~53–73) `getByRole('button', { name: 'Gruppe A' })` → `getByRole('tab', { name: 'Gruppe A' })`; E2E `multi-group-round-robin.spec.ts:45` und `all-tournament-variants.spec.ts:96` → `getByRole('tab', { name: 'Gruppe B' })`.

- [ ] **Step 2: Schweizer Tabelle (`SwissOverviewPage`)**

Gleiches Muster mit `columns = [#, Team, Pkt, Buchholz, Diff]` (numerische Spalten `align: 'right'`, Zellen `className="num"`), `caption="Tabelle"`. Die Team-Zelle behält den Zusatz:

```tsx
<td>
  <div className="flex items-center gap-1">
    <TeamNameDisplay team={teamMap.get(s.teamId)!} />
    {s.withdrawn && <span className="dss-chip dss-chip--err dss-chip--mono shrink-0">zurückgezogen</span>}
  </div>
</td>
```

Prüfen, ob `SwissOverviewPage.test.tsx` auf den Text `(zurückgezogen)` mit Klammern prüft; ggf. Test und Text vereinheitlichen (Text ohne Klammern im Chip, Test anpassen). Der Erklärtext über der Tabelle bleibt `<p className="text-xs text-muted-foreground …">`.

- [ ] **Step 3: Endstand (`FinalStandingsPage`)**

`columns = [Platz (width 3rem), Team, Status]` mit `caption="Endstand"`; Zeilen `<td>{s.place}.</td><td>…Team…</td><td className="text-mute text-xs">{s.pending ? 'ausstehend' : ''}</td>` (Klasse noch `text-muted-foreground`, Task 9 wandelt um — hier die alte Klasse belassen).

- [ ] **Step 4: Rundenreiter + Fortschritt (`SwissResultsPage`)**

```tsx
// vorher: Array.from({ length: displayRound }…).map(r => <Button … onClick={() => setViewedRound(r)}>Runde {r}</Button>)
<Tabs
  variant="pills"
  size="sm"
  ariaLabel="Runden"
  items={Array.from({ length: displayRound }, (_, i) => ({ id: String(i + 1), label: `Runde ${i + 1}` }))}
  value={String(currentViewedRound)}
  onValueChange={id => setViewedRound(Number(id))}
/>
```

Darüber, direkt unter `<h2>Runde {displayRound} von {totalRounds}</h2>`:

```tsx
<Stepper
  variant="compact"
  ariaLabel="Turnierfortschritt"
  steps={Array.from({ length: totalRounds }, (_, i) => ({
    id: `r${i + 1}`,
    label: `Runde ${i + 1}`,
    state: i + 1 < displayRound ? 'done' : i + 1 === displayRound ? 'current' : 'pending',
  }))}
/>
```

Tests/E2E: `swiss-tournament.spec.ts:128`, `swiss-operational-safety.spec.ts:163`: `getByRole('button', { name: 'Runde 1', exact: true })` → `getByRole('tab', { name: 'Runde 1', exact: true })`. Achtung: Der Stepper enthält ebenfalls Text „Runde 1“ (Label des aktuellen Schritts); `exact: true` mit Rolle `tab` trennt das sauber. `getByText(/Runde 1 von/)` (Helfer `setupSwissTournament`) bleibt eindeutig, solange nur die `<h2>` diesen Text hat. `SwissResultsPage.test.tsx`: Button-Selektoren für Runden → `tab`.

- [ ] **Step 5: Tests, Typecheck, E2E**

Run: `npx tsc --noEmit && npx vitest run 2>&1 | tail -8 && npx playwright test e2e/swiss-tournament.spec.ts e2e/swiss-operational-safety.spec.ts e2e/multi-group-round-robin.spec.ts e2e/all-tournament-variants.spec.ts 2>&1 | tail -12`
Expected: grün. Strict-Mode-Verletzungen („resolved to 2 elements“) → Selektor mit `exact` oder `within(...)` schärfen, NICHT die Komponente verbiegen.

- [ ] **Step 6: Screenshot-Sichtprüfung**

`/group-overview`, `/swiss-overview`, `/swiss-results`, `/final-standings` (jeweils mit Demo-Turnier geladen) aufnehmen und per Read-Tool prüfen: Tabellenköpfe, rechtsbündige Zahlen, Chips, Reiter, Stepper. Auffälligkeiten melden/beheben.

- [ ] **Step 7: Commit**

```bash
git add -A src e2e
git commit -m "feat: use DSS Table, Tabs and Stepper on standings and results pages" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Rohe Formularelemente → Select / Checkbox, Spielzeilen

**Files:**
- Modify: `src/components/config/GroupAssignmentForm.tsx`, `src/components/config/FinalsVariantForm.tsx`, `src/pages/GroupResultsPage.tsx`, `FinalsResultsPage.tsx`, `PlayoffResultsPage.tsx`, `BracketResultsPage.tsx`, `SwissResultsPage.tsx`, `src/components/schedule/GameRow.tsx`, zugehörige Tests

Liste der rohen Elemente (Stand `origin/main`): `GroupAssignmentForm.tsx:46` (input checkbox) und `:59` (select), `FinalsVariantForm.tsx:32`/`:79` (select), `GroupResultsPage.tsx:122/135/149`, `FinalsResultsPage.tsx:109`, `PlayoffResultsPage.tsx:81`, `BracketResultsPage.tsx:106`, `SwissResultsPage.tsx:301` (select je Paarung). BLEIBEN roh (dokumentierte Ausnahmen): `TeamForm.tsx:50` (nativer Farbwähler) und `ConfigPage.tsx:150` (versteckter Datei-Input).

- [ ] **Step 1: Filter-Selects**

Muster für jedes Filter-Select (Beispiel `GroupResultsPage`):

```tsx
// vorher
<div className="space-y-1">
  <label htmlFor="status-filter" className="dss-field-label">Status</label>
  <select id="status-filter" className="border border-border rounded-sm px-2 py-1 text-sm"
          value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}>
    <option value="open">Offen</option> …
  </select>
</div>
// nachher
<Select
  id="status-filter"
  label="Status"
  density="compact"
  value={statusFilter}
  onChange={e => setStatusFilter(e.target.value as StatusFilter)}
  options={[
    { value: 'open', label: 'Offen' },
    { value: 'played', label: 'Erfasst' },
    { value: 'all', label: 'Alle' },
  ]}
/>
```

`id`s und Labeltexte bleiben unverändert (E2E nutzt `getByLabel`/`selectOption`). Dynamische Optionen (`groupIds.map`, Felder) per `options={[{ value: 'all', label: 'Alle Gruppen' }, ...groupIds.map(g => ({ value: g, label: \`Gruppe ${g}\` }))]}`. Wrapper-`<div className="space-y-1">` entfällt (der DSS-`Field` bringt Abstand mit). `Select` aus `@bbv/dss-design-system/react` importieren.

- [ ] **Step 2: Paarungs-Selects (`SwissResultsPage`) und Formular-Selects**

`SwissResultsPage:301` (ein Select je Paarung, ohne sichtbares Label): `<Select density="compact" aria-label={…bestehender aria-label…} …/>` mit denselben Optionen; `GroupAssignmentForm:59` (Gruppenwahl je Team) und `FinalsVariantForm:32/79` entsprechend, `label` übernehmen bzw. `aria-label` behalten. Immer zuerst die bestehende Markup-Variante lesen und `id`/`aria-label`/`value`/`onChange` 1:1 übernehmen.

- [ ] **Step 3: Checkbox**

`GroupAssignmentForm.tsx:46`:

```tsx
// vorher: <input type="checkbox" … /> mit separatem <label>
<Checkbox
  id={…bestehende id…}
  label="Mit Rückspiel"
  hint="Jede Paarung wird zweimal gespielt."
  checked={doubleRoundRobin}
  onChange={e => setDoubleRoundRobin(e.target.checked)}
/>
```

Label-/Hinweistext, `id` und Handler aus der bestehenden Datei übernehmen (nicht raten: `sed -n 40,60p src/components/config/GroupAssignmentForm.tsx`). Tests (`GroupAssignmentForm.test.tsx`, `ConfigPage.test.tsx`) greifen über `getByRole('checkbox', { name: … })` — der zugängliche Name enthält jetzt bei vorhandenem Hinweis nur das Label (Hinweis läuft über `aria-describedby`), die Tests sollten unverändert grün sein.

- [ ] **Step 4: Spielzeilen (`GameRow`, Ergebnis-Seiten)**

Container und Zeilen:

```tsx
// Container-Muster (GroupOverviewPage, SwissOverviewPage, GroupResultsPage, … und ScheduleView)
// vorher: <div className="border border-border rounded-md p-4 bg-card space-y-3">
// nachher:
<div className="dss-rows">
```

`GameRow.tsx`: Wurzel `className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0"` (Rahmen/Abstände passend zum Container ohne `p-4`), Feld-Badge:

```tsx
<span className="dss-chip dss-chip--mono">F{game.field}</span>
```

statt `bg-tint rounded-sm px-1 w-8 text-center`. Dasselbe Feld-/Gruppen-Chip in den Ergebnis-Seiten (`GroupResultsPage`: `F{game.field}` und `Gruppe {…}`; `SwissResultsPage`; `FinalsResultsPage`; `PlayoffResultsPage`; `BracketResultsPage`). Das rote „zurückgezogen“-Etikett (`bg-destructive text-destructive-foreground …`) → `<span className="dss-chip dss-chip--err dss-chip--mono">…</span>` (Zeilen in `GroupResultsPage` und `SwissResultsPage`; die `whitespace-nowrap`/`truncate`-Zusätze der Swiss-Variante bleiben als Utilities, ggf. mit `!`).

- [ ] **Step 5: Tests, Typecheck, E2E**

Run: `npx tsc --noEmit && npx vitest run 2>&1 | tail -8 && npx playwright test 2>&1 | tail -12`
Expected: alles grün. Häufige Brüche: Tests, die `getByRole('combobox', { name: … })` nutzen, bleiben gültig; Tests, die `container.querySelector('select')` nutzen, auf Rollen umstellen.

- [ ] **Step 6: Screenshot-Sichtprüfung**

`/group-results` (Demo 02 laden), `/swiss-results` (Demo 03), `/config` aufnehmen und prüfen: Filterleiste (kompakt, 36 px), Checkbox, Chips, Zeilenabstände, „zurückgezogen“-Chip. Auffälligkeiten (Breiten der Zeitfelder, Umbrüche) beheben (`!w-…`).

- [ ] **Step 7: Commit**

```bash
git add -A src e2e
git commit -m "feat: use DSS Select and Checkbox for filters and forms, chips in game rows" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Farb-Codemod und Übergangsschicht entfernen

**Files:**
- Modify: `tailwind.config.ts`, `src/index.css`, ~27 Dateien unter `src/`
- Create: `src/lib/legacy-classes.test.ts`

- [ ] **Step 1: Guard-Test schreiben (rot)**

`src/lib/legacy-classes.test.ts`:

```ts
// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const root = new URL('../../', import.meta.url).pathname
const srcDir = join(root, 'src')

// Namen der entfernten Tailwind-Übergangsschicht (Teil 3 der DSS-Migration).
const LEGACY = /(?<![\w-])(?:text|bg|border|ring|divide|fill|stroke|outline|placeholder)-(?:brand(?:-[a-z]+)*|muted(?:-foreground)?|card|border(?:-ui)?|secondary(?:-[a-z]+)*|tint|destructive(?:-foreground)?|background|foreground)(?![\w-])/g

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

describe('Tailwind-Übergangsschicht ist entfernt', () => {
  const files = walk(srcDir).filter((f) => /\.(tsx?|css)$/.test(f) && !f.endsWith('legacy-classes.test.ts'))

  it('keine Datei in src/ nutzt die alten Klassennamen', () => {
    const hits = files.flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(LEGACY)].map((m) => `${file.replace(root, '')}: ${m[0]}`),
    )
    expect(hits).toEqual([])
  })

  it('tailwind.config.ts definiert keine Alt-Farben mehr', () => {
    const config = readFileSync(join(root, 'tailwind.config.ts'), 'utf8')
    for (const key of ['brand:', 'muted:', 'card:', "'border-ui'", 'secondary:', 'tint:', 'destructive:', 'background:', 'foreground:']) {
      expect(config, `tailwind.config.ts enthält noch ${key}`).not.toContain(key)
    }
  })

  it('index.css enthält die :where()-Regel für rohe Controls nicht mehr', () => {
    expect(readFileSync(join(srcDir, 'index.css'), 'utf8')).not.toContain(':where(')
  })
})
```

Run: `npx vitest run src/lib/legacy-classes.test.ts 2>&1 | tail -15` → Expected: FAIL (viele Treffer, Config-Schlüssel, `:where(`).

- [ ] **Step 2: Semantik-Klassen in `tailwind.config.ts` anlegen**

Im `theme.extend.colors` den kompletten Block der Alt-Namen (`brand`, `background`, `foreground`, `muted`, `card`, `border`, `'border-ui'`, `secondary`, `destructive`, `tint`) ersetzen durch:

```ts
      colors: {
        // Semantische Klassen auf den DSS-Aliasen (dark-sicher): text-fg, bg-surface, border-line …
        fg: 'var(--dss-fg)',
        'fg-soft': 'var(--dss-fg-soft)',
        mute: 'var(--dss-mute)',
        line: 'var(--dss-line)',
        'line-strong': 'var(--dss-line-strong)',
        surface: 'var(--dss-surface)',
        'surface-2': 'var(--dss-surface-2)',
        hover: 'var(--dss-hover-bg)',
        page: 'var(--page-bg)',
        err: 'var(--err-button)',
      },
```

Den Kommentar über der Config („ÜBERGANGSSCHICHT …“) durch einen kurzen Hinweis ersetzen: „DSS-Preset plus semantische Klassen auf den `--dss-*`-Aliasen (ADR-11/13).“ `fontFamily` und `borderRadius` bleiben.

- [ ] **Step 3: Codemod ausführen**

Skript im Scratch-Verzeichnis (NICHT committen) `scratchpad/codemod-colors.mjs`:

```js
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Reihenfolge: längere Namen zuerst.
const MAP = [
  ['text-brand-primary-light', 'text-fg-soft'],
  ['text-brand-primary-dark', 'text-fg'],
  ['text-brand-primary', 'text-fg'],
  ['text-muted-foreground', 'text-mute'],
  ['text-destructive-foreground', 'text-white'],
  ['text-foreground', 'text-fg'],
  ['border-border-ui', 'border-mute'],
  ['border-border', 'border-line'],
  ['bg-destructive', 'bg-err'],
  ['bg-tint', 'bg-hover'],
  ['bg-card', 'bg-surface'],
  ['bg-background', 'bg-page'],
]

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n)
  return statSync(p).isDirectory() ? walk(p) : [p]
})

let changed = 0
for (const file of walk(process.argv[2]).filter((f) => /\.(tsx?)$/.test(f) && !f.endsWith('legacy-classes.test.ts'))) {
  let src = readFileSync(file, 'utf8')
  const before = src
  for (const [from, to] of MAP) {
    src = src.replace(new RegExp(`(?<![\\w-])${from.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(?![\\w-])`, 'g'), to)
  }
  if (src !== before) { writeFileSync(file, src); changed++ }
}
console.log(`${changed} Dateien geändert`)
```

Run: `node <scratchpad>/codemod-colors.mjs src && npx vitest run src/lib/legacy-classes.test.ts 2>&1 | tail -15`
Verbleibende Treffer von Hand lösen: erwartet nur `bg-brand-*` (z. B. `bg-brand-primary`, `bg-brand-primary-light`, `bg-brand-accent` in einzelnen Komponenten): jeweils anhand des Kontexts auf DSS-Klassen/`bg-ink-800`/`bg-amber-400` o. Ä. umstellen. Die Ersetzung `text-destructive-foreground` → `text-white` ist nur dort sinnvoll, wo noch ein roter Hintergrund (`bg-err`) steht; nach Task 7 sollten diese Stellen bereits Chips sein (dann entfällt das Muster ohnehin).

- [ ] **Step 4: `:where()`-Regel in `src/index.css` entfernen**

Den gesamten Block „TEMPORÄR (bis Teil 3 …)“ mit `:where( … )` aus `@layer base` löschen. Vorher bestätigen, dass keine rohen `<input>`/`<select>`/`<textarea>` außer den dokumentierten Ausnahmen übrig sind: `grep -rnE "<(select|textarea)\b|<input" src --include='*.tsx' | grep -v "\.test\."` → nur `TeamForm.tsx` (type="color") und `ConfigPage.tsx` (type="file", hidden). Bei weiteren Treffern zuerst migrieren (Task 7).

- [ ] **Step 5: Guard grün, volle Läufe**

Run: `npx vitest run 2>&1 | tail -8 && npx tsc --noEmit && npm run build 2>&1 | tail -5 && npx playwright test 2>&1 | tail -10`
Expected: Guard-Test grün, alles grün, Build erfolgreich (der Tailwind-Build erzeugt keine Warnung über unbekannte Klassen).

- [ ] **Step 6: Screenshot-Sichtprüfung der Farben**

Alle Seiten mit Demo-Turnier (`/teams`, `/config`, `/schedule`, `/group-results`, `/group-overview`, `/swiss-results`, `/swiss-overview`, `/export`, `/demos`) aufnehmen und mit der Vorher-Sicht (Task 7) vergleichen: Textfarben, Rahmen, Flächen unverändert bis auf DSS-konforme Nuancen. Besonders prüfen: Text, der vorher `brand-primary` (ink-800) war und jetzt `fg` (ink-900) ist, `border-ui` → `mute`.

- [ ] **Step 7: Commit**

```bash
git add -A src tailwind.config.ts
git commit -m "refactor: replace Tailwind transition layer with semantic DSS classes" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Barrierefreiheits-Tests (+4 Fälle) und Doku

**Files:**
- Modify: `e2e/accessibility.spec.ts`, `docs/use-cases-und-kritikalitaet.md`, `docs/architecture/arc42/08-querschnittliche-konzepte.md`, `10-qualitaetsanforderungen.md`, `09-architekturentscheidungen.md`, `11-risiken-und-technische-schulden.md`, `docs/superpowers/plans/2026-10-06-dss-migration-teil4b-screenshots.md`

- [ ] **Step 1: Vier neue A11y-Fälle**

In `e2e/accessibility.spec.ts` (Import `goTo` aus `./helpers` ergänzen) im `describe`-Block anhängen:

```ts
  test('navigation with a group dropdown open', async ({ page }) => {
    await page.goto('/teams')
    await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Vorbereiten', exact: true }).click()
    await expect(page.getByRole('link', { name: 'Konfiguration', exact: true })).toBeVisible()
    await expectNoSeriousViolations(page)
  })

  test('mobile navigation menu open', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await page.goto('/teams')
    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
    await nav.getByRole('button', { name: 'Menü' }).click()
    await nav.getByRole('button', { name: 'Hilfe', exact: true }).click()
    await expect(nav.getByRole('link', { name: 'Demo-Turniere', exact: true })).toBeVisible()
    await expectNoSeriousViolations(page)
  })

  test('demo tournaments page', async ({ page }) => {
    await page.goto('/demos')
    await expect(page.getByRole('heading', { name: 'Demo-Turniere', level: 1 })).toBeVisible()
    await expectNoSeriousViolations(page)
  })

  test('teams page empty state with demo link', async ({ page }) => {
    await page.goto('/teams')
    await expect(page.getByText('Noch keine Teams')).toBeVisible()
    await expectNoSeriousViolations(page)
  })
```

`goTo` wird in diesen vier Fällen nicht gebraucht — Import nur ergänzen, wenn ein bestehender Test ihn nach dem Codemod braucht. Run: `npx playwright test e2e/accessibility.spec.ts 2>&1 | tail -20`. Expected: 16 Tests grün. Verstöße (z. B. Kontrast der gesperrten Navigationseinträge `is-disabled`) sind echte Befunde: in der App/DSS-Nutzung beheben (z. B. Hinweis-Text), nicht den Test lockern; liegt die Ursache in der DSS-Komponente, als Befund dokumentieren (arc42 11.14) und den Fall mit dokumentierter Ausnahme erst nach Rückfrage anpassen.

- [ ] **Step 2: Use-Case-Übersicht (UC8)**

In `docs/use-cases-und-kritikalitaet.md`: Tabellenzeile ergänzen

```
| UC8 | Demo-Turnier laden | 🟡 | `e2e/demo-tournaments.spec.ts`, `src/pages/DemosPage.test.tsx`, `src/lib/demos.test.ts` | ✅ |
```

Mermaid-Diagramm (UC1–UC7-Block) um `UC8[UC8: Demo-Turnier\nladen]` mit `O --> UC8` und `UC8 -.->|include| UC7` ergänzen, einen kurzen Abschnitt „UC8: Demo-Turnier laden“ nach UC7 einfügen (Ziel: Beispieldaten ausprobieren; Ablauf: `/demos` → „Laden“ → bei laufendem Turnier Bestätigung → Weiterleitung auf Übersicht; Testabsicherung wie oben) und die N3-Zeile von „12 kuratierte“ auf „16 kuratierte“ ändern.

- [ ] **Step 3: arc42**

- `08-querschnittliche-konzepte.md` Kapitel 8.10: „zwölf kuratierte“ → „sechzehn kuratierte“ und die vier neuen Zustände in der Aufzählung nennen; Kapitel 8.13: Abschnitt über die Übergangsschicht ersetzen durch „Übergangsschicht entfernt (Teil 3b): semantische Klassen `text-fg`, `text-mute`, `border-line`, `bg-surface`, `bg-hover`, `bg-page`, `bg-err` auf `--dss-*`; Guard-Test `src/lib/legacy-classes.test.ts`“.
- `10-qualitaetsanforderungen.md` (QS-4): „zwölf“ → „sechzehn“.
- `09-architekturentscheidungen.md`: neuen Abschnitt `### ADR-13: Navigationsarchitektur (gruppierte AppNav, flache URLs, basePath)` anhängen: Kontext (Mehrturnier-/Live-Vision, 11.11/11.12), Entscheidung (Liste + Drill-down, Gruppen nach Zweck, reines Modell `buildNavigation` mit `basePath`, flache URLs jetzt, `/turniere/:id/...` später), Alternativen (Unterstrich-Leiste ohne Gruppen, Seitenleiste), Konsequenzen (E2E über `goTo`, Dropdown-Pflege, Demo-Seite in „Hilfe“).
- `11-risiken-und-technische-schulden.md` Kapitel 11.14: Punkte „Übergangsschicht“, „rohe Controls“ und „Teil-3-Komponenten“ als erledigt markieren (Datum 2026-10-06), offen lassen: Teil 4b (Screenshots/Anleitungstext), DSS-Komponenten 0.9.0 (BottomNav, Breadcrumbs, MatchCard, PlayerCard, PlayByPlay, Skeleton), Dark-Modus, Fokusring-Kontrast, bekannte Minor-Punkte aus dem DSS-0.8.0-Review (Dropdown schließt nicht bei Fokusverlust, IDs mit Sonderzeichen).

- [ ] **Step 4: 4b-Plan nachziehen**

In `docs/superpowers/plans/2026-10-06-dss-migration-teil4b-screenshots.md` alle Selektoren der Form `page.getByRole('link', { name: '…' }).click()` für Hauptnavigationseinträge durch `await goTo(page, '…')` ersetzen (Import aus `e2e/helpers`), und die Gruppen-/Rundenreiter-Selektoren (`button` → `tab`). Außerdem im Plan-Kopf vermerken, dass die Screenshots die neue Navigation (TopBar + AppNav) zeigen und dass ein Screenshot der Demo-Seite (`/demos`) ergänzt werden soll (Entscheidung offen, in 4b klären).

- [ ] **Step 5: Zähler-Konsistenz prüfen**

Run: `grep -rn "zwölf\|12 kuratierte\|12 curated\|(12 " docs | grep -v superpowers/` → Expected: keine Treffer mehr, die sich auf die A11y-Kombinationen beziehen.

- [ ] **Step 6: Commit**

```bash
git add e2e/accessibility.spec.ts docs
git commit -m "test(a11y): cover nav dropdown, mobile menu, demo page and empty teams; update docs" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Abschlussprüfung

**Files:** keine

- [ ] **Step 1: Alles ausführen**

```bash
npx vitest run 2>&1 | tail -8
npx tsc --noEmit
npm run build 2>&1 | tail -5
npx playwright test 2>&1 | tail -12
npm audit --omit=dev 2>&1 | tail -3
```

Expected: Unit grün, `tsc` still, Build ok, E2E grün (41 alt + 5 Navigation + 4 Demo + 4 A11y), `npm audit` unverändert gegenüber `origin/main` (bekannte 5 high, Build-Toolchain).

- [ ] **Step 2: Restsuche**

```bash
grep -rnE "brand-|text-muted-foreground|border-border|bg-tint|bg-card" src | grep -v legacy-classes.test.ts   # leer
grep -rn "innerHTML" src e2e docs scripts                                                              # leer
git diff origin/main --stat | tail -3
```

- [ ] **Step 3: Unabhängiger Review**

Reviewer-Subagent (`superpowers:code-reviewer`) über `git diff origin/main...HEAD` gegen Spec (Abschnitt 3b) und diesen Plan. Prüfpunkte: Navigationsmodell vs. altes Verhalten (Modi/Varianten/Gating), Tab-Rollenwechsel in allen Tests, Demo-Fluss inkl. Sperr-Bestätigung, Guard-Test, A11y-Fälle, Doku-Zähler, keine unbeabsichtigte Änderung an PDF-/HTML-Export. Befunde bewerten, wichtige beheben, erneut testen.

- [ ] **Step 4: Übergabe — nichts pushen ohne Rückfrage**

Bericht mit: Branch `feat/dss-teil3b`, Commit-Liste, Teststand, Screenshot-Befunde aus den Sichtprüfungen (Tasks 3, 6, 7, 8), Review-Ergebnis und der Frage, ob gepusht und ein PR geöffnet werden soll (Merge durch die Nutzerin/den Nutzer; `--admin` nur nach ausdrücklicher Freigabe). Der PR enthält auch Spec und Pläne (cherry-picked in Task 0); der Docs-Branch `docs/dss-teil3-spec` ist damit überflüssig.

---

## Self-Review

**Spec-Abdeckung (3b):** Navigationsmodell + `AppShell` mit `AppNav` → Tasks 2–3; `goTo`, Codemod der 64 Stellen → Tasks 1, 3; Table für drei Tabellen, Tabs (Rollenwechsel), Stepper, EmptyState, Spielzeilen, Select/Checkbox → Tasks 5–7; Übergangsschicht entfernen + Guard-Test + `:where()` → Task 8; Demo-Turniere (Manifest, Seite, Bestätigung, Navigationsgruppe „Hilfe“, EmptyState-CTA, E2E zuerst) → Tasks 1, 4, 5; A11y 12 → 16, UC8, arc42 8.10/8.13/QS-4/11.14, ADR-13, 4b-Selektoren → Task 9; Risiken (E2E-Umbau, Tabs-Rollen, Farb-Codemod, Demo-Überschreiben) sind in den Tasks adressiert (Codemod + Voll-Läufe, gezielte Selektor-Updates, Guard-Test + Screenshots, Bestätigungsdialog).

**Platzhalter-Scan:** Neuer Code (Navigationsmodell, Tests, Demo-Manifest, Seite, Guard-Test, Codemod-Skripte, E2E-Spezifikationen) ist vollständig. Seiten-Migrationen (Tasks 5–7) sind als Vorher/Nachher-Muster plus Dateiliste und Abnahmekriterien beschrieben, weil die Dateien dafür ohnehin gelesen werden müssen; jede Änderung ist durch Typecheck, Unit- und E2E-Lauf abgesichert.

**Typ-Konsistenz:** `AppNavItem/AppNavGroup/AppNavLink` kommen aus `@bbv/dss-design-system/react` (Export seit 0.8.0); `buildNavigation` liefert die ids `prepare|play|view|export|help` und Link-ids `teams|config|results|finals-results|playoff-results|bracket-results|schedule|group-overview|final-standings|overview|manual|demos`, die der Test verwendet; `landingPathFor`/`DEMOS` werden in Test und Seite gleich benutzt; `goTo`-Labels entsprechen den Link-Labels des Modells.

**Bekannte Unschärfen:** (1) Genaue Zeichenketten von Moduslabels und bestehenden `id`s/Labels (`selectMode`, Checkbox-Label) müssen beim Umsetzen aus den vorhandenen Dateien übernommen werden (im Plan markiert). (2) Gesperrte Navigationseinträge nutzen `--dss-mute`-Text; der A11y-Kontrast-Check kann hier anschlagen (Task 9, Step 1 beschreibt das Vorgehen). (3) Die Anleitung (`manual.md`) erwähnt Demo-Downloads; die Anpassung des Textes gehört zu 4b.
