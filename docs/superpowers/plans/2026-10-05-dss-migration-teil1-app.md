# DSS-Migration Teil 1 — Turnier-Manager (T1 + T2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den Turnier-Manager vom Fibalon-Branding (FBNM) auf das DSS-Design-System umstellen: erst das Fundament (Tokens, Schriften, Tailwind), dann alle `ui/*`-Wrapper durch die DSS-React-Komponenten ersetzen.

**Architecture:** DSS wird als Git-Dependency (`@bbv/dss-design-system` v0.7.0) eingebunden. `tokens.css` und `components.css` liefern Optik, Tailwind bleibt für Layout. Im Tailwind-Config bilden die Alt-Namen (`brand.*`, `muted`, `border` …) vorübergehend auf DSS-Variablen ab, damit nicht migrierte Seiten weiterlaufen (Übergangsschicht bis Teil 3). In T2 wechseln die 55 Import-Stellen auf `@bbv/dss-design-system/react`, danach wird `src/components/ui/` gelöscht.

**Tech Stack:** React 18, Tailwind 3, Vite 6, Vitest 4, Playwright, `@bbv/dss-design-system` 0.7.0, `@fontsource/{sora,manrope,jetbrains-mono}`.

**Spec:** `docs/superpowers/specs/2026-10-05-dss-migration-teil1-design.md`. **Voraussetzung:** DSS-Release **v0.7.0** (Plan `2026-10-05-dss-migration-teil1-dss-repo.md`, PRs D1 + D2 gemergt, Tag gesetzt).

## Abweichungen vom Spec

1. **Keine `legacy-fbnm-aliases.css`.** Außerhalb von `src/styles/fbnm/` verwenden nur `tailwind.config.ts` und `src/index.css` `--fbnm-*`-Variablen. Die Übergangsschicht ist deshalb allein das Tailwind-Mapping; der ganze Ordner `src/styles/fbnm/` wird in T1 gelöscht.
2. **Select ist natives `<select>`** (DSS `Select`), kein Radix. Betrifft die drei Selects in `TournamentForm`; Unit-Tests und E2E-Helfer werden von Klicken auf `role=option` auf `selectOption` umgestellt.
3. **`git+https://` statt `github:`** als Dependency-Spezifikation, damit die Lockfile eine HTTPS-URL enthält und `npm ci` in der CI ohne SSH-Schlüssel funktioniert.

## Konventionen

- **Arbeitsverzeichnis:** `/Users/oliver-marcuseder/01-vibe-coding/00-Basektball/08-Fibalon-Baskets/02-turnier-manager`.
- **Commit-Messages** enden mit der Zeile `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; **PR-Beschreibungen** enden mit `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **Uncommittete Änderungen anderer Arbeit** (`docs/architecture/arc42/*` gehören vermutlich zum PDF-Export, plus `.github/copilot-instructions.md`, `.github/instructions/`): niemals mit committen. Immer nur gezielt stagen (`git add <datei>` für eigene Dateien, `git add -p` für arc42-Dateien mit fremden Hunks).
- Vorgehen je PR in einem eigenen Worktree empfohlen (`superpowers:using-git-worktrees`), damit die fremden uncommitteten Änderungen im Haupt-Arbeitsverzeichnis unberührt bleiben.
- **Verifikationsbefehle** (je Task angegeben, vor jedem PR komplett): `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`.

## Dateistruktur

| Datei | Aktion | Task |
|---|---|---|
| `src/styles/no-fbnm-leftovers.test.ts` | neu — Guard gegen FBNM-Reste und fehlendes Theme | 1 |
| `package.json`, `package-lock.json` | DSS + Fontsource ergänzen; später `@radix-ui/react-select` entfernen | 2, 13 |
| `src/styles/fonts.ts` | neu — Schrift-Imports | 3 |
| `src/main.tsx`, `index.html` | CSS-Importreihenfolge, `data-theme="light"` | 3 |
| `src/index.css` | neu geschrieben (Tailwind + DSS-Basis + temporäre Regel für rohe Controls) | 4 |
| `tailwind.config.ts` | DSS-Preset + Übergangs-Mapping | 5 |
| `src/styles/fbnm/`, `public/fonts/` | löschen | 6 |
| `src/components/shared/DestructiveConfirmDialog.tsx` (+ Test) | verschoben aus `ui/`, auf DSS-Modal | 11 |
| `src/components/**`, `src/pages/**` (55 Import-Stellen) | Migration auf DSS-Komponenten | 7–12 |
| `scripts/codemod-dss.mjs` | neu — mechanischer Codemod für Button und Alert | 7 |
| `e2e/helpers.ts`, `e2e/config-validation.spec.ts` | Select-Interaktion auf `selectOption` | 12 |
| `src/components/ui/` | löschen | 13 |
| `docs/architecture/arc42/*`, `docs/superpowers/**` | Doku (ADR-11, 11.14 u. a.) | 6, 14 |

---

## PR T1: Fundament (Tokens, Schriften, Tailwind) — keine Komponenten-Änderung

### Task 0: Voraussetzungen und Baseline

- [ ] **Step 1: DSS-Release prüfen**

```bash
git ls-remote --tags https://github.com/OliEder/dss-design-system.git v0.7.0
```

Expected: eine Zeile mit `refs/tags/v0.7.0`. Fehlt sie, **stoppen**: zuerst den DSS-Plan abschließen.

- [ ] **Step 2: Worktree und Branch anlegen**

```bash
git fetch origin
git worktree add ../02-turnier-manager-dss-foundation -b feat/dss-foundation origin/main
cd ../02-turnier-manager-dss-foundation
npm ci
```

Expected: Worktree liegt neben dem Hauptordner, `npm ci` ohne Fehler. Alle folgenden Schritte laufen in diesem Worktree (`.../02-turnier-manager-dss-foundation`).

- [ ] **Step 3: Grüne Baseline festhalten**

```bash
npm run typecheck && npm test && npm run build
npx playwright install chromium
npm run test:e2e
```

Expected: alles grün. Anzahl der bestehenden Tests notieren (`Tests  N passed` und Playwright-Zusammenfassung); sie ist der Vergleichswert für T1 und T2. Schlägt etwas schon hier fehl, ist das ein vorbestehender Fehler: melden, nicht mit der Migration vermischen.

### Task 1: Guard-Test (schlägt zuerst fehl)

**Files:**
- Create: `src/styles/no-fbnm-leftovers.test.ts`

- [ ] **Step 1: Test schreiben**

```ts
import { describe, it, expect } from 'vitest'
import indexHtml from '../../index.html?raw'

// Alle Quelldateien als Rohtext (Vite-Glob), damit der Test ohne Node-fs auskommt.
const sources = import.meta.glob('/src/**/*.{ts,tsx,css}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const FORBIDDEN = /fbnm|FBNM|INSOLENT|ALLER|Montserrat/

describe('DSS-Fundament', () => {
  it('enthält keine FBNM-Reste (Tokens, Schriften, Klassen) mehr in src/', () => {
    const offenders = Object.entries(sources)
      .filter(([path]) => !path.endsWith('no-fbnm-leftovers.test.ts'))
      .filter(([, content]) => FORBIDDEN.test(content))
      .map(([path]) => path)
    expect(offenders).toEqual([])
  })

  it('setzt das helle DSS-Theme fest auf <html>', () => {
    expect(indexHtml).toMatch(/<html[^>]*data-theme="light"/)
  })
})
```

- [ ] **Step 2: Test ausführen, Fehlschlag bestätigen**

Run: `npx vitest run src/styles/no-fbnm-leftovers.test.ts`
Expected: FAIL — beide Tests: `offenders` listet u. a. `/src/index.css`, `/src/styles/fbnm/*.css`; das `data-theme`-Muster fehlt in `index.html`.

- [ ] **Step 3: Commit**

```bash
git add src/styles/no-fbnm-leftovers.test.ts
git commit -m "test: guard against FBNM leftovers and missing light theme"
```

### Task 2: Abhängigkeiten

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: DSS und Schriften installieren**

```bash
npm install "git+https://github.com/OliEder/dss-design-system.git#v0.7.0"
npm install @fontsource/sora @fontsource/manrope @fontsource/jetbrains-mono
```

- [ ] **Step 2: Installationsergebnis prüfen**

```bash
grep -n "dss-design-system\|fontsource" package.json
grep -n "dss-design-system" package-lock.json | head -5
ls node_modules/@bbv/dss-design-system/dist/react/index.js node_modules/@bbv/dss-design-system/css/components.css
```

Expected: In `package.json` steht `"@bbv/dss-design-system": "git+https://github.com/OliEder/dss-design-system.git#v0.7.0"`; die Lockfile enthält `git+https://github.com/OliEder/dss-design-system.git#<sha>` (**kein** `git+ssh`); beide Dateien existieren, d. h. `prepare` hat das Paket gebaut.

- [ ] **Step 3: Saubere Neuinstallation wie in der CI**

```bash
rm -rf node_modules && npm ci
ls node_modules/@bbv/dss-design-system/dist/react/index.js
```

Expected: `npm ci` ohne Fehler, Datei vorhanden. Schlägt `prepare` fehl, Fehlermeldung prüfen (häufig fehlende devDependency `tsup` im DSS-Paket → im DSS-Repo beheben und v0.7.1 taggen, hier die Version anheben).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add DSS design system and self-hosted fonts"
```

### Task 3: Schriften, CSS-Importreihenfolge, Theme

**Files:**
- Create: `src/styles/fonts.ts`
- Modify: `src/main.tsx`, `index.html`

- [ ] **Step 1: `src/styles/fonts.ts`** (Gewichte wie im DSS-Quick-Start: Sora 400/600/700/800, Manrope 400–700, JetBrains Mono 500/700; nur Latin, deckt Deutsch ab)

```ts
import '@fontsource/sora/latin-400.css'
import '@fontsource/sora/latin-600.css'
import '@fontsource/sora/latin-700.css'
import '@fontsource/sora/latin-800.css'
import '@fontsource/manrope/latin-400.css'
import '@fontsource/manrope/latin-500.css'
import '@fontsource/manrope/latin-600.css'
import '@fontsource/manrope/latin-700.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import '@fontsource/jetbrains-mono/latin-700.css'
```

- [ ] **Step 2: `src/main.tsx` — Imports ergänzen.** Der Block oben wird zu:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/fonts'
// Reihenfolge ist wichtig: Tailwind (Preflight + Utilities) zuerst, DSS danach — sonst setzt
// Preflights `[type='button'] { background-color: transparent }` die DSS-Button-Hintergründe zurück.
import './index.css'
import '@bbv/dss-design-system/tokens.css'
import '@bbv/dss-design-system/components.css'
```

Der Rest der Datei (Redirect-Logik, `ReactDOM.createRoot`) bleibt unverändert.

- [ ] **Step 3: `index.html` — Theme setzen.** `<html lang="de">` ersetzen durch:

```html
<html lang="de" data-theme="light">
```

- [ ] **Step 4: Commit**

```bash
git add src/styles/fonts.ts src/main.tsx index.html
git commit -m "feat: load DSS tokens, components and self-hosted fonts; pin light theme"
```

### Task 4: `src/index.css` neu schreiben

**Files:**
- Modify: `src/index.css` (komplett ersetzen)

- [ ] **Step 1: Inhalt ersetzen**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    font-family: var(--font-body);
    background: var(--page-bg);
    color: var(--dss-fg);
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  h1, h2, h3, h4 {
    font-family: var(--font-display);
    letter-spacing: -0.01em;
  }

  /* DSS-Fokusring (3 px, --ring-color). Komponenten setzen denselben Ring, hier die Absicherung für rohe Elemente. */
  :focus-visible {
    outline: var(--ring-w) solid var(--ring-color);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }

  /*
   * TEMPORÄR (bis Teil 3 der DSS-Migration): rohe <input>/<select>/<textarea> ohne DSS-Komponente
   * bekommen weiterhin einen sichtbaren Rahmen (Tailwind-Preflight setzt border-width auf 0).
   * :where() hält die Spezifität bei 0, damit DSS-Klassen und Utilities gewinnen.
   */
  :where(
    input:not([type='checkbox']):not([type='radio']):not([type='range']):not([type='color']):not(.dss-input),
    textarea,
    select:not(.dss-select)
  ) {
    border: 2px solid var(--n-500);
    border-radius: var(--radius-md);
    background-color: var(--dss-surface);
    color: var(--dss-fg);
  }
}

.no-spinner {
  appearance: textfield;
  -moz-appearance: textfield;
}

.no-spinner::-webkit-outer-spin-button,
.no-spinner::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/index.css
git commit -m "feat: replace FBNM base styles with DSS base layer"
```

### Task 5: Tailwind-Config (Preset + Übergangs-Mapping)

**Files:**
- Modify: `tailwind.config.ts` (komplett ersetzen)

- [ ] **Step 1: Inhalt ersetzen**

```ts
import type { Config } from 'tailwindcss'
import dssPreset from '@bbv/dss-design-system/tailwind'

/**
 * DSS-Preset (ink-*, amber-*, sky-*, neutral-*) plus eine ÜBERGANGSSCHICHT: die Alt-Namen
 * (brand.*, muted, card, border, secondary, tint …) zeigen auf DSS-Variablen, damit Seiten, die noch
 * nicht migriert sind, weiterlaufen. Die Schicht wird in Teil 3 der DSS-Migration gelöscht, sobald
 * keine Datei mehr `brand-*`, `text-muted-foreground`, `border-border` usw. verwendet.
 * Hinweis: Die Preset-Farben sind OKLCH-Strings — Alpha-Modifier wie `bg-ink-900/50` funktionieren nicht.
 */
export default {
  presets: [dssPreset],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'var(--ink-800)',
          'primary-dark': 'var(--ink-900)',
          'primary-light': 'var(--ink-700)',
          accent: 'var(--amber-400)',
          'accent-text': 'var(--dss-accent-text)',
        },
        background: 'var(--page-bg)',
        foreground: 'var(--dss-fg)',
        muted: {
          DEFAULT: 'var(--dss-surface-2)',
          foreground: 'var(--dss-mute)',
        },
        card: 'var(--dss-surface)',
        border: 'var(--dss-line)',
        'border-ui': 'var(--n-500)',
        secondary: {
          DEFAULT: 'var(--dss-surface-2)',
          hover: 'var(--dss-line)',
          border: 'var(--dss-line-strong)',
        },
        destructive: {
          DEFAULT: 'var(--err-button)',
          foreground: '#ffffff',
        },
        tint: 'var(--dss-hover-bg)',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        sans: ['var(--font-body)'],
        caption: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
    },
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 2: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat: map tailwind theme to DSS tokens (transition layer for legacy classes)"
```

### Task 6: FBNM entfernen, Fundament verifizieren, PR T1

**Files:**
- Delete: `src/styles/fbnm/`, `public/fonts/`
- Modify: `docs/architecture/arc42/02-randbedingungen.md`, `08-querschnittliche-konzepte.md`, `09-architekturentscheidungen.md`, `11-risiken-und-technische-schulden.md`

- [ ] **Step 1: Ordner löschen**

```bash
git rm -r src/styles/fbnm public/fonts
```

- [ ] **Step 2: Guard-Test, Typecheck, Unit-Tests, Build**

```bash
npx vitest run src/styles/no-fbnm-leftovers.test.ts
npm run typecheck && npm test && npm run build
```

Expected: Guard-Test PASS (2 Tests); Typecheck, alle Unit-Tests (gleiche Anzahl wie die Baseline plus 2 neue) und Build grün. Schlägt ein bestehender Unit-Test an Klassennamen oder Farben fehl, prüfen, ob er an `brand-*`-Klassen hängt; die Übergangsschicht sollte das abfangen.

- [ ] **Step 3: E2E und Barrierefreiheit**

Run: `npm run test:e2e`
Expected: gleiche Anzahl grüner Tests wie in der Baseline. Insbesondere `e2e/accessibility.spec.ts` muss grün bleiben. Schlagen dort Kontrast-Regeln an, betrifft das Farbpaare aus der Übergangsschicht (z. B. `text-muted-foreground` auf `bg-tint`); Zuordnung in `tailwind.config.ts` anpassen (nicht die Tests lockern).

- [ ] **Step 4: Sichtprüfung mit Playwright** (Dev-Server läuft über `npm run dev`; Druckdialoge nicht auslösen, siehe bekanntes Hängen von `window.print()`)

Seiten `/`, `/teams` (mit „Team hinzufügen“-Dialog), `/config`, eine Ergebnisseite und `/anleitung` öffnen und prüfen:

- Überschriften in Sora, Fließtext in Manrope (in der Konsole: `document.fonts.check('600 16px Sora')` und `document.fonts.check('400 16px Manrope')` liefern `true`).
- Ink/Amber/Sky statt Fibalon-Blau; Buttons (noch die alten `ui/button`) haben Hintergrundfarbe `ink-800`.
- Rohe Eingabefelder haben einen sichtbaren Rahmen; kein Text auf zu hellem Grund.

Die Ergebnisse (Beobachtungen, ggf. Screenshots in den Scratchpad) im PR vermerken.

- [ ] **Step 5: arc42 ergänzen.** Zuerst prüfen, welche Dateien fremde uncommittete Änderungen tragen (im Haupt-Arbeitsverzeichnis `git status`; im Worktree sind sie nicht vorhanden, dort gilt der Stand von `origin/main`).

Kapitel 02, Tabelle 2.1: Zeile `| Styling | Tailwind CSS 3 | ... |` ersetzen durch:

```markdown
| Styling | Tailwind CSS 3 (Layout/Abstände) + DSS-Design-System `@bbv/dss-design-system` 0.7 (Tokens `tokens.css`, Komponenten-CSS `components.css`, React-Komponenten); Schriften Sora/Manrope/JetBrains Mono selbst gehostet über `@fontsource/*`; Theme fest hell (`data-theme="light"`) | `package.json`, `tailwind.config.ts`, `src/main.tsx`, ADR-11 |
```

Kapitel 08 (Querschnittliche Konzepte): neuen Abschnitt am Ende anhängen (Nummer fortsetzen, vorher mit `grep -n "^## 8\." docs/architecture/arc42/08-querschnittliche-konzepte.md | tail -1` die nächste freie bestimmen, hier als `8.N`):

```markdown
## 8.N Design-System-Kopplung (DSS) und Übergangsschicht

- **Kopplung:** `src/main.tsx` importiert Tailwind (`index.css`) **vor** `@bbv/dss-design-system/tokens.css` und
  `components.css`. Die Reihenfolge ist Pflicht: Tailwinds Preflight setzt `[type='button']`-Hintergründe zurück und
  würde bei umgekehrter Reihenfolge die `dss-btn--*`-Hintergründe überschreiben.
- **Übergangsschicht (bis Teil 3 der DSS-Migration):** `tailwind.config.ts` bildet die Alt-Namen (`brand.*`, `muted`,
  `card`, `border`, `border-ui`, `secondary`, `tint`, `destructive`) auf DSS-Variablen ab. `src/index.css` enthält eine
  temporäre `:where(...)`-Regel, die rohen `<input>`/`<select>`/`<textarea>` einen Rahmen gibt.
- **OKLCH und Alpha:** Die DSS-Preset-Farben sind OKLCH-Strings; Tailwind-Alpha-Modifier (`bg-ink-900/50`) funktionieren
  nicht. Für Transparenz `--dss-*`-Aliase oder eigene Klassen verwenden.
- **Guard:** `src/styles/no-fbnm-leftovers.test.ts` schlägt fehl, sobald `fbnm`/`INSOLENT`/`ALLER`/`Montserrat` wieder
  in `src/` auftauchen.
```

Kapitel 09: neuen ADR **ADR-11** nach ADR-10 anhängen:

```markdown
### ADR-11: Umstellung auf das DSS-Design-System mit React-Komponenten im DSS-Repo

- **Kontext**: Das Projekt entstand für ein Fibalon-Turnier und trug dessen Branding (FBNM: Blau/Cyan, INSOLENT/ALLER).
  Das Branding wird nicht mehr gebraucht; als Ersatz dient das eigene DSS-Design-System (Ink · Amber · Sky,
  WCAG 2.1 AAA). DSS lieferte Tokens, ein Tailwind-Preset, Vanilla-CSS und Svelte-Referenzkomponenten, aber keine
  React-Komponenten.
- **Geprüfte Alternativen**: Nur Token-Austausch ohne Komponenten (schnell, aber nur ungefähre DSS-Optik); React-
  Komponenten ausschließlich im Turnier-Manager (nicht wiederverwendbar, driftet von der Svelte-Referenz);
  Radix-Select statt nativem Select (mehr Abhängigkeit, die App nutzt sonst native Selects).
- **Entscheidung**: React-Komponenten liegen im DSS-Repo (`react/`, v0.7.0) und rendern nur die `dss-*`-Klassen aus
  `css/components.css` (einzige CSS-Quelle). Modal baut auf Radix Dialog (Peer-Dependency), Select ist ein natives
  `<select>`. Einbindung als Git-Dependency (`git+https://…#v0.7.0`, damit `npm ci` ohne SSH läuft). Schriften werden
  selbst gehostet (`@fontsource`, keine externen Requests, DSGVO). Dark-Mode vorerst nicht (fest `data-theme="light"`).
  Migration inkrementell mit temporärer Tailwind-Übergangsschicht.
- **Konsequenz**: Zwei Repos müssen abgestimmt versioniert werden (Tag + Pin). Die Svelte-Komponenten und
  `components.css` doppeln teilweise Styles (Schuld im DSS-Repo, siehe dessen CHANGELOG). Controls sind 44 px hoch
  (vorher 36 px); Ergebnis-Eingabegrids verwenden die Dichte `compact`.
- **Beleg**: `docs/superpowers/specs/2026-10-05-dss-migration-teil1-design.md`;
  `docs/superpowers/plans/2026-10-05-dss-migration-teil1-{dss-repo,app}.md`.
```

Kapitel 11: Abschnitt **11.14** anhängen:

```markdown
## 11.14 DSS-Migration: Übergangsschicht und Folgearbeiten (offen seit 2026-10-05)

Nach Teil 1 der DSS-Migration (Fundament + Basis-Komponenten) bleiben bewusst offen:

- **Teil 3:** Übergangsschicht entfernen — `brand.*`, `muted`, `card`, `border`, `border-ui`, `secondary`, `tint` in
  `tailwind.config.ts` und die temporäre `:where(...)`-Regel in `src/index.css`; Seiten auf DSS-Komponenten
  (Table, Stepper, TopBar, EmptyState, Skeleton, MatchCard …) und rohe `<input>`/`<select>` auf `TextInput`/`Select`
  umstellen. Checkliste: `grep -rn "brand-\|text-muted-foreground\|border-border\|bg-tint" src` muss leer sein.
- **Teil 4:** react-pdf-Exporte (hartcodierte Farben, `Helvetica`) und Druckansichten auf DSS-Optik; `/anleitung`-
  Screenshots (zeigen noch das Fibalon-Branding) neu erstellen.
- **Standard-Teamfarbe** in `TeamForm` ist noch `#004174` (FBNM-Blau).
- **DSS-Repo:** doppelte Scoped-Styles in den Svelte-Komponenten (Button, TextInput, Modal, Card, Tabs).
```

Regel für das Stagen (Worktree-Stand von `origin/main` enthält ADR-10 evtl. noch nicht; dann die Nummern an den tatsächlichen letzten ADR anpassen): im Haupt-Arbeitsverzeichnis niemals `git add docs/architecture/arc42/`, sondern `git add -p` und nur die eigenen Hunks bestätigen.

- [ ] **Step 6: Commit**

```bash
git add -A src public tailwind.config.ts docs/architecture/arc42/02-randbedingungen.md \
  docs/architecture/arc42/08-querschnittliche-konzepte.md \
  docs/architecture/arc42/09-architekturentscheidungen.md \
  docs/architecture/arc42/11-risiken-und-technische-schulden.md
git status --short
git commit -m "feat: remove FBNM styles and fonts, document DSS foundation (ADR-11)"
```

Expected: `git status --short` zeigt vor dem Commit nur eigene Änderungen (im Worktree gibt es keine fremden).

- [ ] **Step 7: Push und PR T1**

```bash
git push -u origin feat/dss-foundation
gh pr create --base main --title "feat: DSS-Fundament (Tokens, Schriften, Tailwind-Mapping)" --body "$(cat <<'EOF'
## Inhalt
- DSS v0.7.0 als Git-Dependency (`git+https`), selbst gehostete Schriften (Sora, Manrope, JetBrains Mono)
- `tokens.css` + `components.css` nach Tailwind eingebunden, `data-theme="light"`
- Tailwind-Config mit DSS-Preset und Übergangs-Mapping für die Alt-Klassen (`brand-*` usw.)
- FBNM-Tokens, -Schriften und `public/fonts` entfernt; Guard-Test gegen FBNM-Reste
- arc42: Kapitel 02, 08, 09 (ADR-11), 11 (11.14)

Keine Komponenten-Änderung (folgt in T2). Optik wechselt von Fibalon-Blau auf Ink/Amber/Sky.

## Test
- `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` (inkl. Barrierefreiheit) grün
- Sichtprüfung der Hauptseiten

## Prüfen
- CI (`npm ci` mit Git-Dependency) und Vercel-Preview müssen bauen.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 8: CI und Vercel-Preview abwarten**

Run: `gh pr checks --watch`
Expected: alle Checks grün, insbesondere `npm ci`-basierte Jobs (Git-Dependency + `prepare`-Build). Schlägt `npm ci` an der DSS-Dependency fehl, Logs lesen (Netzwerk, `prepare`, Node-Version) und im DSS-Repo beheben; den Fehler nicht durch Entfernen der Dependency umgehen. Nach grünen Checks mergen lassen (PR-Review durch die Nutzerin/den Nutzer), dann T2 starten.

---

## PR T2: `ui/*`-Wrapper durch DSS-Komponenten ersetzen

### Task 7: Branch, Codemod-Skript, Button-Migration

**Files:**
- Create: `scripts/codemod-dss.mjs`
- Modify: 15 Dateien mit `components/ui/button`

- [ ] **Step 1: Worktree von aktuellem `main`**

```bash
cd /Users/oliver-marcuseder/01-vibe-coding/00-Basektball/08-Fibalon-Baskets/02-turnier-manager
git fetch origin
git worktree add ../02-turnier-manager-dss-components -b feat/dss-components origin/main
cd ../02-turnier-manager-dss-components
npm ci
npm run typecheck && npm test
```

Expected: grün (Baseline für T2, T1 ist gemergt). Test-Anzahl notieren.

- [ ] **Step 2: Codemod-Skript** — `scripts/codemod-dss.mjs` (mechanisch für Button und Alert; Label/Input, Dialog und Select folgen manuell):

```js
// Mechanischer Codemod für die DSS-Migration. Nutzung: node scripts/codemod-dss.mjs button|alert <datei...>
import { readFileSync, writeFileSync } from 'node:fs';

const DSS = '@bbv/dss-design-system/react';

/** Ersetzt den ui-Import durch den DSS-Import und führt mehrere DSS-Importe einer Datei zu einem zusammen. */
function rewriteImports(source, uiModule, names) {
  const uiImport = new RegExp(`import \\{[^}]*\\} from '@/components/ui/${uiModule}'\\n`);
  if (!uiImport.test(source)) return source;
  let out = source.replace(uiImport, `import { ${names.join(', ')} } from '${DSS}'\n`);

  const dssImports = [...out.matchAll(new RegExp(`import \\{([^}]*)\\} from '${DSS}'\\n`, 'g'))];
  if (dssImports.length > 1) {
    const merged = [...new Set(dssImports.flatMap((m) => m[1].split(',').map((n) => n.trim()).filter(Boolean)))];
    let first = true;
    out = out.replace(new RegExp(`import \\{[^}]*\\} from '${DSS}'\\n`, 'g'), () => {
      if (!first) return '';
      first = false;
      return `import { ${merged.join(', ')} } from '${DSS}'\n`;
    });
  }
  return out;
}

const transforms = {
  button(source) {
    return rewriteImports(source, 'button', ['Button'])
      .replaceAll('variant="outline"', 'variant="ghost"')
      .replaceAll('variant="destructive"', 'variant="danger"');
  },
  alert(source) {
    return rewriteImports(source, 'alert', ['Banner'])
      .replaceAll('<Alert>', '<Banner>')
      .replaceAll('</Alert>', '</Banner>')
      .replaceAll(/<Alert(\s)/g, '<Banner$1')
      .replaceAll('<AlertDescription', '<div')
      .replaceAll('</AlertDescription>', '</div>');
  },
};

const [kind, ...files] = process.argv.slice(2);
if (!transforms[kind] || files.length === 0) {
  console.error('Nutzung: node scripts/codemod-dss.mjs button|alert <datei...>');
  process.exit(1);
}
for (const file of files) {
  const before = readFileSync(file, 'utf8');
  const after = transforms[kind](before);
  if (after !== before) {
    writeFileSync(file, after);
    console.log(`geändert: ${file}`);
  } else {
    console.log(`unverändert: ${file}`);
  }
}
```

- [ ] **Step 3: Button-Dateien migrieren**

```bash
FILES=$(grep -rl "components/ui/button'" src --include='*.tsx' | grep -v '/ui/')
echo "$FILES"
node scripts/codemod-dss.mjs button $FILES
grep -rn "components/ui/button" src --include='*.tsx' | grep -v '/ui/' || echo "keine ui/button-Imports mehr"
```

Expected: 15 Dateien (`LockedSectionGate`, `ExportPanel`, `TeamCard`, `TeamForm`, `TeamList`, `BlackoutList`, `BracketResultsPage`, `ConfigPage`, `FinalsResultsPage`, `GroupOverviewPage`, `GroupResultsPage`, `ManualPage`, `PlayoffResultsPage`, `SwissOverviewPage`, `SwissResultsPage`) werden geändert; keine Imports aus `ui/button` mehr außerhalb von `ui/`.

- [ ] **Step 4: Manuelle Nacharbeit prüfen**

```bash
git diff --stat
grep -rn "<Button" src --include='*.tsx' | grep -v '\.test\.' | grep 'className'
```

Für jede Zeile mit `className` an einem `<Button>` (erwartet: 3 Stellen) prüfen, ob die Klassen noch sinnvoll sind (Layout wie `ml-2`, `w-full` bleibt; Farb-/Rahmenklassen wie `bg-*`, `border-*`, `text-*` an `Button` entfernen, weil die DSS-Variante die Optik trägt). Spezialfall: Wo ein `Button` im Zeilen-Grid sehr klein sein muss, `size="sm"` beibehalten.

Außerdem: alle `<Button>` innerhalb von `<form>` ohne explizites `type="submit"` suchen, weil DSS-Buttons standardmäßig `type="button"` sind (der alte Button hatte keinen Default):

```bash
for f in $(grep -rl '<form' src --include='*.tsx' | grep -v '\.test\.'); do echo "-- $f"; grep -n '<Button\|<form\|type="submit"\|type="button"' "$f"; done
```

Expected: `TeamForm.tsx` hat `type="submit"` und `type="button"` bereits explizit (Stand der Recherche); andere Formulare gibt es nicht. Taucht ein weiteres `<form>` mit Button ohne `type` auf, `type="submit"` ergänzen.

- [ ] **Step 5: Verifikation**

```bash
npm run typecheck && npm test
```

Expected: grün. Fehlschläge in Tests, die Buttons über Klassen statt Rollen finden, auf Rollen umstellen.

- [ ] **Step 6: Commit**

```bash
git add scripts/codemod-dss.mjs src
git commit -m "refactor: migrate Button usages to the DSS React Button"
```

### Task 8: Alert → Banner

**Files:**
- Modify: 14 Dateien mit `components/ui/alert`; Sonderfall `TournamentForm.tsx` in Task 10

- [ ] **Step 1: Mechanisch migrieren**

```bash
FILES=$(grep -rl "components/ui/alert'" src --include='*.tsx' | grep -v '/ui/')
echo "$FILES"
node scripts/codemod-dss.mjs alert $FILES
```

Expected: 14 Dateien (`FinalsVariantForm`, `LockedSectionGate`, `TournamentForm`, `ExportPanel`, `ScheduleView`, `BracketResultsPage`, `ConfigPage`, `FinalStandingsPage`, `FinalsResultsPage`, `GroupOverviewPage`, `GroupResultsPage`, `PlayoffResultsPage`, `SwissOverviewPage`, `SwissResultsPage`).

- [ ] **Step 2: Inhaltlich prüfen.** Jedes `<Banner>` zeigt jetzt den Standard `severity="info"` mit der `div`-Hülle aus `AlertDescription`. Überall dort, wo die Nachricht eine Warnung oder einen Fehler ausdrückt (Text enthält „nicht“, „fehlt“, „ungültig“, rote Klassen wie `text-red-600`), die Severity setzen und die Farbklasse entfernen:

```bash
grep -rn "text-red\|text-destructive" src --include='*.tsx' | grep -v '\.test\.'
```

Beispiel-Umbau (aus `TournamentForm.tsx`, vollständig in Task 10 enthalten):

```tsx
<Banner severity={fitsInVenue ? 'info' : 'danger'}>
  <div>
    Geschätzte Gesamtdauer: {totalMin} Minuten.
    {!fitsInVenue && ' Das passt nicht in die verfügbare Hallenzeit — Rundenzahl reduzieren oder mehr Felder einplanen.'}
  </div>
</Banner>
```

Die äußere `<div>` (ehemals `AlertDescription`) darf bleiben, wenn sie `className` für Layout trägt (z. B. `flex items-center justify-between gap-3` in `LockedSectionGate`); trägt sie keine Klasse, `<div>` und `</div>` entfernen, sodass der Text direkt in `<Banner>` steht.

- [ ] **Step 3: Verifikation**

```bash
npm run typecheck && npm test
```

Expected: grün. Tests, die `getByRole('alert')` verwenden, gab es laut Recherche nicht; falls doch einer auftaucht: info/ok-Banner haben `role="status"`, warn/danger `role="alert"`.

- [ ] **Step 4: Commit**

```bash
git add src
git commit -m "refactor: migrate Alert usages to the DSS Banner"
```

### Task 9: Label + Input → TextInput (außer `TournamentForm`)

**Files:**
- Modify: `src/components/teams/TeamForm.tsx`, `src/components/venue/VenueForm.tsx`, `src/components/venue/BlackoutList.tsx`, `src/components/config/GameSettingsForm.tsx`, `src/components/config/GroupAssignmentForm.tsx`, `src/components/config/FinalsVariantForm.tsx`, `src/components/schedule/GameRow.tsx`, `src/pages/BracketResultsPage.tsx`, `src/pages/FinalsResultsPage.tsx`, `src/pages/GroupResultsPage.tsx`, `src/pages/PlayoffResultsPage.tsx`, `src/pages/SwissResultsPage.tsx`

Dieser Schritt ist **nicht mechanisch**, weil der zugängliche Name erhalten bleiben muss (E2E und Unit-Tests finden Felder über `getByLabel`). Regeln für jede Stelle:

1. `<div className="space-y-1"><Label htmlFor="X">Text</Label><Input id="X" … /></div>` wird zu `<TextInput id="X" label="Text" … />`. Das Label bleibt **wortgleich**, auch wenn es „(optional)“ enthält (nicht die Prop `optional` benutzen, sie würde den zugänglichen Namen ändern).
2. `className` mit Breite (`w-32`, `w-20` …) wandert auf **`fieldClassName`**; Schrift-/Ausrichtungsklassen (`font-mono`, `text-center`, `no-spinner`) bleiben auf `className` (gehen aufs Input).
3. Eingabefelder in dichten Gittern (Ergebnis-Eingaben in den `*ResultsPage`-Dateien, `GameRow`) bekommen `density="compact"`, alle anderen die Standarddichte.
4. `Input` ohne `Label` (z. B. mit `aria-label`) wird zu `<TextInput aria-label="…" … />` ohne `label`-Prop.
5. Hilfetexte, die bisher als `<p className="text-xs text-muted-foreground">` unter dem Feld standen und zum Feld gehören, werden `help="…"`.
6. **Pflichtfelder (`required`) und exakte Label-Abfragen:** `TextInput` rendert bei `required` einen Stern (`<span class="req" aria-hidden="true">*</span>`) **im** `<label>`. Der zugängliche Name bleibt „Name“, aber der Label-Text ist „Name*“, und Testing Librarys `getByLabelText('Name')` (exakter Textvergleich) findet das Feld dann nicht. Betroffen ist laut Recherche nur das Feld `team-name` in `TeamForm` (`required`), abgefragt in `src/components/teams/TeamList.test.tsx` (Zeilen 31, 50, 102) und `src/components/teams/TeamForm.test.tsx` (Zeile 27). Dort `screen.getByLabelText('Name')` durch `screen.getByRole('textbox', { name: 'Name' })` ersetzen (gleiche Semantik, geht über den zugänglichen Namen). Playwright (`getByLabel('Name')` in `e2e/helpers.ts`) ist nicht betroffen, es matcht per Teilstring auf den zugänglichen Namen. Vor dem Umbau prüfen, ob weitere Pflichtfelder hinzugekommen sind: `grep -rn "required" src --include='*.tsx' | grep -v '\.test\.'`.

- [ ] **Step 1: Referenzumbau `TeamForm.tsx`.** Komplette neue Fassung der Eingabefelder (Zeilen 39–73 der alten Datei); `Label`-/`Input`-Imports entfallen, `TextInput` kommt aus dem DSS-Paket:

```tsx
import { Button, TextInput } from '@bbv/dss-design-system/react'
```

```tsx
      <TextInput id="team-name" label="Name" value={form.name} onChange={set('name')} required />
      <TextInput
        id="team-abbreviation"
        label="Kürzel (optional)"
        value={form.abbreviation}
        onChange={set('abbreviation')}
        maxLength={4}
      />
      <TextInput id="team-logo" label="Logo-URL" value={form.logoUrl} onChange={set('logoUrl')} placeholder="https://..." />
      <div className="space-y-1">
        <label htmlFor="team-color" className="dss-field-label">Farbe</label>
        <div className="flex gap-2 items-center">
          {/* bestehendes <input id="team-color" type="color" …> unverändert lassen */}
          <TextInput
            aria-label="Farbwert"
            value={form.color}
            onChange={set('color')}
            fieldClassName="w-32"
            className="font-mono"
          />
        </div>
      </div>
      <TextInput id="team-contact" label="Kontakt" value={form.contact} onChange={set('contact')} />
```

Vor dem Ersetzen die alte Datei genau lesen (`Read src/components/teams/TeamForm.tsx`) und die **tatsächlichen** Props der Felder (`maxLength`, `required`, `type` …) übernehmen; die Datei oben ist nur die Muster-Schablone. Das native `<input type="color">` bleibt als rohes Element erhalten; sein `<Label>` wird zu einem `<label className="dss-field-label">`, weil es kein TextInput gibt. Das Wort „Farbwert“ als `aria-label` des Hex-Feldes nur verwenden, wenn der bisherige Name dasselbe war; sonst den bisherigen Namen beibehalten.

- [ ] **Step 2: Übrige elf Dateien nach denselben Regeln migrieren.** Für jede Datei: `grep -n "<Label\|<Input" <datei>` ausführen, Datei lesen, Stellen umbauen, Import `import { Input } from '@/components/ui/input'` und `import { Label } from '@/components/ui/label'` durch `import { TextInput } from '@bbv/dss-design-system/react'` ersetzen (in Dateien, die bereits einen DSS-Import haben, den Namen dort ergänzen).

Besonderheit `BlackoutList.tsx`: die beiden `type="time"`-Felder haben `className="w-32"` → `fieldClassName="w-32"`.

- [ ] **Step 3: Gate — keine alten Imports mehr (außer `TournamentForm` und Dialog-Dateien, siehe nächste Tasks)**

```bash
grep -rln "components/ui/\(input\|label\)'" src --include='*.tsx' | grep -v '/ui/'
```

Expected: nur noch `src/components/config/TournamentForm.tsx` (Task 10).

- [ ] **Step 4: Verifikation**

```bash
npm run typecheck && npm test
```

Expected: grün. Typische Fehlerquellen: Tests mit `getByLabelText` auf geänderte Label-Texte (Label wortgleich lassen), Number-Inputs mit `no-spinner` (Klasse bleibt auf `className`).

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "refactor: migrate Label+Input pairs to DSS TextInput"
```

### Task 10: `TournamentForm` — TextInput, Select, Banner (mit Tests zuerst)

**Files:**
- Modify: `src/components/config/TournamentForm.test.tsx`
- Modify: `src/components/config/TournamentForm.tsx`

- [ ] **Step 1: Tests auf native Select-Interaktion umstellen.** In `src/components/config/TournamentForm.test.tsx` ersetzt dieser Block die beiden bestehenden `it(...)`-Fälle (der Import `fireEvent` bleibt, `render`/`screen` ebenfalls):

```tsx
describe('TournamentForm', () => {
  it('offers field counts up to 6, not just 4', () => {
    render(<TournamentForm />)
    const select = screen.getByRole('combobox', { name: /anzahl felder/i })

    const options = Array.from(select.querySelectorAll('option')).map(o => o.textContent)
    expect(options).toEqual(['1 Feld', '2 Felder', '3 Felder', '4 Felder', '5 Felder', '6 Felder'])
  })

  it('lets the organizer select more than 4 fields', () => {
    render(<TournamentForm />)
    fireEvent.change(screen.getByRole('combobox', { name: /anzahl felder/i }), { target: { value: '6' } })

    expect(useTournamentStore.getState().tournament.fields).toBe(6)
  })

  it('lets the organizer switch the tournament mode', () => {
    render(<TournamentForm />)
    fireEvent.change(screen.getByRole('combobox', { name: /turniermodus/i }), { target: { value: 'swiss' } })

    expect(useTournamentStore.getState().tournament.mode).toBe('swiss')
  })
})
```

Run: `npx vitest run src/components/config/TournamentForm.test.tsx`
Expected: FAIL — `Select` ist noch Radix (`<button role="combobox">` ohne `<option>`-Kinder, `fireEvent.change` bewirkt nichts).

- [ ] **Step 2: `TournamentForm.tsx` umbauen.** Imports ersetzen (Zeilen 2–5 der alten Datei):

```tsx
import { TextInput, Select, Banner } from '@bbv/dss-design-system/react'
```

Rückgabewert der Komponente (alles ab `return (`) vollständig ersetzen:

```tsx
  return (
    <div className="space-y-4 max-w-md">
      <TextInput
        id="tourney-name"
        label="Turniername"
        value={tournament.name}
        onChange={e => setTournamentName(e.target.value)}
        placeholder="z.B. Verbands-Einstufungsturnier 2026"
        disabled={disabled}
      />
      <Select
        id="tourney-mode"
        label="Turniermodus"
        value={tournament.mode}
        onChange={e => setMode(e.target.value as TournamentMode)}
        disabled={disabled}
        options={[
          { value: 'round-robin', label: 'Jeder gegen Jeden' },
          { value: 'round-robin+finals', label: 'Gruppenphase + Endrunde' },
          { value: 'swiss', label: 'Einstufungsturnier (Schweizer System)' },
        ]}
      />
      {tournament.mode === 'round-robin+finals' && (
        <Select
          id="tourney-bracket-size"
          label="Finalrunde"
          value={String(tournament.finalsBracketSize ?? 4)}
          onChange={e => setFinalsBracketSize(Number(e.target.value) as 2 | 4)}
          disabled={disabled}
          options={[
            { value: '4', label: 'Halbfinale + Finale' },
            { value: '2', label: 'Nur Finale' },
          ]}
        />
      )}
      {tournament.mode === 'swiss' && (
        <div className="space-y-2">
          <TextInput
            id="swiss-rounds"
            label="Anzahl Runden"
            type="number"
            min={1}
            value={rounds}
            onChange={e => setSwissRounds(Number(e.target.value))}
            disabled={disabled}
            help={`Vorschlag nach Standard-Schweizer-Formel: ${suggestedRounds} Runden — bei Bedarf anpassbar.`}
          />
          {(() => {
            const gameDuration = calcGameDurationMin(tournament.gameSettings)
            const gamesPerRound = Math.floor(tournament.teams.length / 2)
            const roundsWorthOfSlots = Math.max(1, Math.ceil(gamesPerRound / tournament.fields))
            const roundDurationMin = roundsWorthOfSlots * (gameDuration + tournament.gameSettings.bufferBetweenGamesMin)
            const totalMin = rounds * roundDurationMin + (rounds - 1) * tournament.gameSettings.breakBetweenRoundsMin
            const venueOpen = tournament.venue.availabilityWindows[0]?.start ?? '09:00'
            const venueClose = tournament.venue.availabilityWindows[0]?.end ?? '20:00'
            const firstStart = addMinutes(venueOpen, tournament.venue.setupBufferMin)
            const availabilityEnd = addMinutes(venueClose, -tournament.venue.teardownBufferMin)
            const fitsInVenue = timeToMinutes(firstStart) + totalMin <= timeToMinutes(availabilityEnd)
            return (
              <Banner severity={fitsInVenue ? 'info' : 'danger'}>
                Geschätzte Gesamtdauer: {totalMin} Minuten.
                {!fitsInVenue && ' Das passt nicht in die verfügbare Hallenzeit — Rundenzahl reduzieren oder mehr Felder einplanen.'}
              </Banner>
            )
          })()}
        </div>
      )}
      <Select
        id="tourney-fields"
        label="Anzahl Felder"
        value={String(tournament.fields)}
        onChange={e => setFields(Number(e.target.value))}
        disabled={disabled}
        options={[1, 2, 3, 4, 5, 6].map(n => ({ value: String(n), label: `${n} ${n === 1 ? 'Feld' : 'Felder'}` }))}
      />
    </div>
  )
```

Der Kopf der Funktion (Store-Aufruf, `suggestedRounds`, `rounds`) bleibt unverändert. Das Label „Turniermodus“ usw. bleibt wortgleich zur alten Fassung.

- [ ] **Step 3: Tests ausführen**

Run: `npx vitest run src/components/config/TournamentForm.test.tsx && npm run typecheck`
Expected: PASS (3 Tests), Typecheck grün.

- [ ] **Step 4: Commit**

```bash
git add src/components/config/TournamentForm.tsx src/components/config/TournamentForm.test.tsx
git commit -m "refactor: migrate TournamentForm to DSS TextInput, native Select and Banner"
```

### Task 11: Dialog und `DestructiveConfirmDialog` → DSS-Modal

**Files:**
- Create: `src/components/shared/DestructiveConfirmDialog.tsx`
- Create: `src/components/shared/DestructiveConfirmDialog.test.tsx`
- Modify: `src/components/teams/TeamList.tsx`, `src/components/teams/TeamList.test.tsx`, `src/pages/ConfigPage.tsx`
- Delete (in Task 13): `src/components/ui/destructive-confirm-dialog.tsx`, `.test.tsx`, `dialog.tsx`, `dialog.test.tsx`

- [ ] **Step 1: Test für den verschobenen Dialog** — `src/components/shared/DestructiveConfirmDialog.test.tsx` (Verhalten identisch zum bisherigen Test, nur Importpfad):

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DestructiveConfirmDialog } from './DestructiveConfirmDialog'

describe('DestructiveConfirmDialog', () => {
  it('keeps the confirm button disabled until the exact confirmation word is typed', () => {
    const onConfirm = vi.fn()
    render(
      <DestructiveConfirmDialog
        open
        onOpenChange={() => {}}
        title="Änderung bestätigen"
        description="Das Turnier läuft bereits. Diese Änderung kann den Verlauf beeinträchtigen."
        confirmWord="ÄNDERN"
        onConfirm={onConfirm}
      />
    )

    const confirmButton = screen.getByRole('button', { name: /bestätigen/i })
    expect(confirmButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/bestätigungswort/i), { target: { value: 'falsch' } })
    expect(confirmButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/bestätigungswort/i), { target: { value: 'ÄNDERN' } })
    expect(confirmButton).toBeEnabled()

    fireEvent.click(confirmButton)
    expect(onConfirm).toHaveBeenCalled()
  })

  it('calls onOpenChange(false) and does not call onConfirm when cancelled', () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <DestructiveConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Änderung bestätigen"
        description="Text"
        confirmWord="ÄNDERN"
        onConfirm={onConfirm}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('resets the typed word when reopened', () => {
    const onConfirm = vi.fn()
    const { rerender } = render(
      <DestructiveConfirmDialog
        open
        onOpenChange={() => {}}
        title="t" description="d" confirmWord="ÄNDERN"
        onConfirm={onConfirm}
      />
    )
    fireEvent.change(screen.getByLabelText(/bestätigungswort/i), { target: { value: 'ÄNDERN' } })
    expect(screen.getByRole('button', { name: /bestätigen/i })).toBeEnabled()

    rerender(
      <DestructiveConfirmDialog
        open={false}
        onOpenChange={() => {}}
        title="t" description="d" confirmWord="ÄNDERN"
        onConfirm={onConfirm}
      />
    )
    rerender(
      <DestructiveConfirmDialog
        open
        onOpenChange={() => {}}
        title="t" description="d" confirmWord="ÄNDERN"
        onConfirm={onConfirm}
      />
    )
    expect(screen.getByRole('button', { name: /bestätigen/i })).toBeDisabled()
  })

  it('does not close when clicking outside the dialog', async () => {
    const onOpenChange = vi.fn()
    render(
      <DestructiveConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="t" description="d" confirmWord="ÄNDERN"
        onConfirm={() => {}}
      />
    )
    // Radix registriert seinen pointerdown-Listener erst nach einem Tick (setTimeout 0)
    await new Promise((resolve) => setTimeout(resolve, 0))

    const backdrop = document.querySelector('.dss-backdrop')!
    fireEvent.pointerDown(backdrop, { button: 0, pointerType: 'mouse' })
    fireEvent.pointerUp(backdrop, { button: 0, pointerType: 'mouse' })
    fireEvent.click(backdrop)

    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
```

Run: `npx vitest run src/components/shared/DestructiveConfirmDialog.test.tsx`
Expected: FAIL — `Cannot find module './DestructiveConfirmDialog'`.

- [ ] **Step 2: Komponente anlegen** — `src/components/shared/DestructiveConfirmDialog.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Modal, Button, TextInput } from '@bbv/dss-design-system/react'

interface DestructiveConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmWord: string
  onConfirm: () => void
}

export function DestructiveConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmWord,
  onConfirm,
}: DestructiveConfirmDialogProps) {
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (open) setTyped('')
  }, [open])

  const canConfirm = typed === confirmWord

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      severity="danger"
      dismissOnBackdrop={false}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button variant="danger" disabled={!canConfirm} onClick={onConfirm}>
            Bestätigen
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p>{description}</p>
        <TextInput
          id="destructive-confirm-input"
          label={`Bestätigungswort „${confirmWord}“ eintippen`}
          value={typed}
          onChange={e => setTyped(e.target.value)}
          autoComplete="off"
        />
      </div>
    </Modal>
  )
}
```

Run: `npx vitest run src/components/shared/DestructiveConfirmDialog.test.tsx`
Expected: PASS (4 Tests). Schlägt `does not close when clicking outside` an, obwohl `dismissOnBackdrop={false}` gesetzt ist, ist die DSS-Version zu alt (v0.7.0 setzt die Prop); `npm ls @bbv/dss-design-system` prüfen.

- [ ] **Step 3: Imports in den Aufrufern umstellen**

`src/pages/ConfigPage.tsx`: `import { DestructiveConfirmDialog } from '@/components/ui/destructive-confirm-dialog'` ersetzen durch `import { DestructiveConfirmDialog } from '@/components/shared/DestructiveConfirmDialog'`.

`src/components/teams/TeamList.tsx`: Dialog-Import und Nutzung ersetzen. Import-Zeilen:

```tsx
import { Modal } from '@bbv/dss-design-system/react'
import { DestructiveConfirmDialog } from '@/components/shared/DestructiveConfirmDialog'
```

(`Button` kommt bereits aus dem DSS-Import aus Task 7; die Namen in einem Import zusammenführen: `import { Button, Modal } from '@bbv/dss-design-system/react'`.) Die beiden Dialog-Blöcke (alte Zeilen 57–81) werden zu:

```tsx
      <Modal open={showAdd} onOpenChange={setShowAdd} title="Team hinzufügen" dismissOnBackdrop={false}>
        <TeamForm
          onSubmit={(data) => handleAddSubmit({ ...data, abbreviation: data.abbreviation.trim() || undefined })}
          onCancel={() => setShowAdd(false)}
        />
      </Modal>

      <Modal
        open={!!editTeam}
        onOpenChange={() => setEditTeam(null)}
        title="Team bearbeiten"
        dismissOnBackdrop={false}
      >
        {editTeam && (
          <TeamForm
            initial={editTeam}
            onSubmit={(data) => {
              updateTeam(editTeam.id, { ...data, abbreviation: data.abbreviation.trim() || undefined })
              setEditTeam(null)
            }}
            onCancel={() => setEditTeam(null)}
          />
        )}
      </Modal>
```

Der `<DestructiveConfirmDialog …>`-Block darunter bleibt unverändert.

- [ ] **Step 4: Regressionstest auf App-Ebene** — in `src/components/teams/TeamList.test.tsx` als letzten Fall **innerhalb** von `describe('TeamList', () => { … })` (nach dem Test `does not require confirmation for editing …`) ergänzen. Die Datei rendert `<TeamList />` direkt und setzt den Store in `beforeEach` zurück, es wird also nichts weiter gebraucht:

```tsx
  it('keeps the add-team modal open when clicking outside of it', async () => {
    render(<TeamList />)
    fireEvent.click(screen.getByRole('button', { name: 'Team hinzufügen' }))
    expect(screen.getByRole('dialog', { name: 'Team hinzufügen' })).toBeInTheDocument()

    // Radix registriert seinen pointerdown-Listener erst nach einem Tick (setTimeout 0)
    await new Promise((resolve) => setTimeout(resolve, 0))
    const backdrop = document.querySelector('.dss-backdrop')!
    fireEvent.pointerDown(backdrop, { button: 0, pointerType: 'mouse' })
    fireEvent.pointerUp(backdrop, { button: 0, pointerType: 'mouse' })
    fireEvent.click(backdrop)

    expect(screen.getByRole('dialog', { name: 'Team hinzufügen' })).toBeInTheDocument()
  })
```

Run: `npx vitest run src/components/teams`
Expected: PASS (alle bisherigen TeamList-Tests plus der neue). Der neue Test sichert die alte Garantie (kein Schließen per Klick außerhalb), die zuvor in `ui/dialog.test.tsx` stand. Die bestehenden Fälle suchen Felder per `getByLabelText('Name')` und Buttons per Rolle und müssen mit `TextInput`/`Modal` unverändert grün bleiben.

- [ ] **Step 5: Verifikation und Commit**

```bash
npm run typecheck && npm test
git add src
git commit -m "refactor: replace Dialog and DestructiveConfirmDialog with the DSS Modal"
```

Expected: grün.

### Task 12: E2E-Helfer für das native Select

**Files:**
- Modify: `e2e/helpers.ts`, `e2e/config-validation.spec.ts`

- [ ] **Step 1: Helfer umstellen.** In `e2e/helpers.ts` ersetzt dies `selectMode`:

```ts
export async function selectMode(page: Page, label: string) {
  await page.locator('#tourney-mode').selectOption({ label })
}
```

- [ ] **Step 2: Spec umstellen.** In `e2e/config-validation.spec.ts` den ersten Test (Zeilen 4–21) ersetzen durch:

```ts
test('the field-count dropdown offers up to 6 fields, not just 4', async ({ page }) => {
  await page.goto('/teams')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  for (let i = 1; i <= 2; i++) await addTeam(page, `Team ${i}`)

  await page.getByRole('link', { name: 'Konfiguration' }).click()

  // Regression test: this dropdown was hardcoded to only 1-4 fields, so once an organizer
  // touched it they could never select more than 4 fields again -- with many groups but a
  // starved field count, games queue up almost entirely sequentially, which looks like a
  // group-to-field mapping bug but is really just this artificial cap.
  await expect(page.locator('#tourney-fields option', { hasText: '6 Felder' })).toHaveCount(1)
  await page.locator('#tourney-fields').selectOption({ label: '6 Felder' })
  await expect(page.locator('#tourney-fields')).toHaveValue('6')
})
```

- [ ] **Step 3: Weitere Radix-Select-Stellen in den E2E-Specs suchen**

```bash
grep -rn "getByRole('option'\|#tourney-bracket-size\|#tourney-mode\|#tourney-fields" e2e
```

Expected: nur noch `selectOption`-Aufrufe; keine `getByRole('option', …).click()`. Verbleibende Stellen analog umstellen.

- [ ] **Step 4: Commit**

```bash
git add e2e
git commit -m "test(e2e): drive the tournament selects with selectOption"
```

### Task 13: `ui/*` löschen, Abhängigkeit entfernen, Gate

**Files:**
- Delete: `src/components/ui/`
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Gate: nichts verweist mehr auf `ui/`**

```bash
grep -rn "components/ui/" src e2e --include='*.ts' --include='*.tsx' | grep -v '^src/components/ui/' || echo "keine Verweise auf components/ui"
```

Expected: `keine Verweise auf components/ui`. Treffer zuerst beheben.

- [ ] **Step 1b: Wirkungslose Alpha-Modifier auf Übergangs-Farben ersetzen.** Tailwind 3 wendet keine Alpha-Modifier auf `var()`-Farben an, `border-brand-primary/30` erzeugt also keine Regel (war schon vor der Migration so). Drei Stellen existieren; sie bekommen den DSS-Linienton:

```bash
grep -rnE "(bg|text|border)-(brand|muted|tint|card)[a-z-]*/[0-9]+" src --include='*.tsx'
sed -i '' 's#border border-brand-primary/30#border border-border#g' \
  src/pages/ManualPage.tsx src/pages/SwissOverviewPage.tsx
grep -rnE "(bg|text|border)-(brand|muted|tint|card)[a-z-]*/[0-9]+" src --include='*.tsx' || echo "keine Alpha-Modifier mehr"
```

Expected: erster `grep` listet `ManualPage.tsx:6`, `ManualPage.tsx:76`, `SwissOverviewPage.tsx:12`; nach `sed` meldet der zweite `keine Alpha-Modifier mehr`. (`sed -i ''` ist die macOS-Syntax.)

- [ ] **Step 2: Löschen**

```bash
git rm -r src/components/ui
```

- [ ] **Step 3: Nicht mehr benötigtes Radix-Select entfernen** (Dialog bleibt, es ist die Peer-Dependency des DSS-Pakets)

```bash
grep -rn "react-select" src || echo "react-select wird nicht mehr verwendet"
npm uninstall @radix-ui/react-select
grep -n "radix" package.json
```

Expected: `react-select` ungenutzt; `package.json` enthält noch `@radix-ui/react-dialog`, nicht mehr `@radix-ui/react-select`.

- [ ] **Step 4: Komplette Verifikation**

```bash
npm run typecheck && npm test && npm run build && npm run test:e2e
```

Expected: alles grün. Unit-Tests: Baseline von T2 minus die gelöschten `ui/*`-Tests (`dialog.test` 2 Fälle, `destructive-confirm-dialog.test` 3 Fälle) plus die neuen (`DestructiveConfirmDialog` 4, `TournamentForm` +1, `TeamList` +1), netto +1. Die Anzahl in der Ausgabe von `npm test` mit dieser Rechnung abgleichen. Playwright: gleiche Anzahl wie in der Baseline. `e2e/accessibility.spec.ts` muss vollständig grün sein (AGENTS.md: die kuratierte Zahl der Kombinationen bleibt unverändert, keine neue Route, kein neuer Zustand). Schlagen dort `target-size`-/Kontrast-Regeln an, betrifft das die neuen Controls; die Ursache in der Komponente oder in der Übergangsschicht beheben, nicht den Test aufweichen.

- [ ] **Step 5: Sichtprüfung der 44-px-Folge.** Mit Playwright (Dev-Server) die Seiten Teams, Konfiguration (alle drei Turniermodi), Gruppenergebnisse und Schweizer Ergebnisse öffnen und prüfen, dass Ergebnis-Eingabegrids (`density="compact"`) nicht umbrechen oder überlaufen, Dialoge (Team hinzufügen, Bestätigungsdialog) mittig und mit Fokus-Falle erscheinen und Escape sie schließt. Auffälligkeiten (zu hohe Zeilen, Umbrüche) mit `density="compact"` oder `fieldClassName`-Breite beheben und im PR beschreiben.

- [ ] **Step 6: Commit**

```bash
git add -A src package.json package-lock.json
git commit -m "refactor: remove legacy ui wrappers and unused radix-select"
```

### Task 14: Doku-Nachzug, PR T2

**Files:**
- Modify: `docs/architecture/arc42/05-bausteinsicht.md`, `docs/architecture/arc42/02-randbedingungen.md`, `docs/architecture/arc42/11-risiken-und-technische-schulden.md`

- [ ] **Step 1: arc42 Kapitel 05.** Die Tabellenzeile `| `ui/` | Generische, Radix-basierte Primitives (Button, Select, Dialog, Alert, Input, Label) |` entfernen und stattdessen einfügen:

```markdown
| `shared/` | Projektspezifische, DSS-basierte Bausteine (`DestructiveConfirmDialog` auf `Modal severity="danger"`). Generische UI-Komponenten (Button, TextInput, Select, Modal, Banner, Card, Tabs, Icon) kommen aus dem Paket `@bbv/dss-design-system/react`, nicht mehr aus dem Repo |
```

Davor die Zeile mit `grep -n "ui/" docs/architecture/arc42/05-bausteinsicht.md` lokalisieren; die uncommitteten fremden Änderungen in dieser Datei (PDF-Export) nicht mitcommitten (`git add -p`).

- [ ] **Step 2: Kapitel 02.** In der Zeile `| UI-Primitives | Radix UI (`react-select`, `react-dialog`) … |` den Inhalt ersetzen durch: `| UI-Primitives | DSS-React-Komponenten (`@bbv/dss-design-system/react`); Modal nutzt Radix Dialog (`@radix-ui/react-dialog`), Select ist ein natives `<select>` | `package.json`, ADR-11 |`.

- [ ] **Step 3: Kapitel 11.14.** Den Punkt „Teil 3“ um den erreichten Stand ergänzen: `src/components/ui/` ist gelöscht, `Select`/`Modal`/`Banner`/`TextInput`/`Button` stammen aus DSS; verbleibend sind `Table`-ähnliche Eigenbauten, `TeamCard` (nutzt noch kein DSS-`Card`) und rohe `<input>`/`<select>` (14 Stellen, `grep -rn "<input\|<select" src --include='*.tsx' | grep -v test`).

- [ ] **Step 4: Commit, Push, PR T2**

```bash
git add -p docs/architecture/arc42/05-bausteinsicht.md docs/architecture/arc42/02-randbedingungen.md \
  docs/architecture/arc42/11-risiken-und-technische-schulden.md
git commit -m "docs: update arc42 for the DSS component migration"
git push -u origin feat/dss-components
gh pr create --base main --title "refactor: ui/* durch DSS-React-Komponenten ersetzen" --body "$(cat <<'EOF'
## Inhalt
- Button (15 Dateien), Alert → Banner (14), Label+Input → TextInput (12), Dialog/DestructiveConfirmDialog → DSS-Modal, Radix-Select → natives DSS-Select (`TournamentForm`)
- `src/components/ui/` und `@radix-ui/react-select` entfernt; `DestructiveConfirmDialog` liegt jetzt in `src/components/shared/`
- E2E-Helfer für Selects auf `selectOption` umgestellt
- Regressionstests: Modal schließt nicht per Klick außerhalb (Add-Team-Dialog, Bestätigungsdialog)
- arc42 02/05/11 nachgezogen

## Hinweise
- DSS-Controls sind 44 px hoch (vorher 36 px); Ergebnis-Eingabegrids verwenden `density="compact"`.
- `info`/`ok`-Banner haben jetzt `role="status"` (vorher alle `role="alert"`), `warn`/`danger` bleiben `alert`.

## Test
- `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` (inkl. Barrierefreiheit) grün

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: CI abwarten**

Run: `gh pr checks --watch`
Expected: alle Checks grün. Danach Review durch die Nutzerin/den Nutzer; nach dem Merge Worktrees aufräumen (`git worktree remove ../02-turnier-manager-dss-foundation ../02-turnier-manager-dss-components`).

- [ ] **Step 6: Use-Case-Übersicht und A11y-Liste abschließen.** `docs/use-cases-und-kritikalitaet.md` ist laut Spec unverändert (kein neuer Use-Case). `e2e/accessibility.spec.ts` bleibt unverändert; bestätigen, dass die in arc42 Kapitel 8.10 und QS-4 genannte Zahl der Kombinationen weiterhin stimmt (`grep -c "test(" e2e/accessibility.spec.ts` gegen die dokumentierte Zahl).

---

## Self-Review (gegen den Spec)

- **§2 Einbindung:** `index.css`-Imports (Task 3, 4), `data-theme="light"` (Task 3), selbst gehostete Schriften und Entfernen von `public/fonts` (Tasks 2, 3, 6), Preset (Task 5), Übergangsschicht (Task 5, ohne alias-CSS, Abweichung 1), h1–h3-Regel entfällt (Task 4), react-pdf-Schriften unangetastet (nur `Helvetica`, Teil 4).
- **§2 Ablösung ui/*:** Mapping `default→primary`, `outline→ghost`, `destructive→danger` (Task 7 Codemod), `size default→md` (Standard, kein Code nötig), `Alert→Banner` (Task 8), `DestructiveConfirmDialog→Modal severity="danger"` (Task 11), `Label+Input→TextInput` (Task 9, 10), Select (Task 10, Abweichung 2), `ui/*` löschen (Task 13), compact-Einsatzorte (Task 9 Regel 3, Task 13 Step 5).
- **§3 PR-Reihenfolge:** T1 (Tasks 0–6) ohne Komponenten-Änderung, T2 (Tasks 7–14). Doku je PR (Tasks 6, 14). Risiko 1 (Git-Dependency/`prepare`) → Task 2 Step 3 und CI-Check (Task 6 Step 8); Risiko 2 (44 px) → Task 13 Step 5; Risiko 3 (Modal-Verhalten) → Task 11 Tests; Risiko 4 (OKLCH ohne Alpha) → Task 5 Kommentar plus Arc42-Eintrag, Prüfung via `grep -rn "/[0-9]\+\b" src` nicht automatisiert (siehe unten); Risiko 5 (Übergangsschicht bleibt liegen) → Eintrag 11.14; Risiko 6 (Screenshots/PDF) → 11.14.
- **Offenes aus dem Spec:** „Alias-Mapping“ → entfällt (nur Tailwind-Mapping, Task 5). „Select Radix?“ → natives Select. „Zielhöhen/compact“ → Task 9/13.
- **Alpha-Modifier (Risiko 4):** Der Recherche-Grep fand drei wirkungslose Stellen (`ManualPage` 2×, `SwissOverviewPage` 1×, `border-brand-primary/30`); sie werden in Task 13 Step 1b durch `border-border` ersetzt. `ui/dialog.tsx` (`bg-brand-primary-dark/60`) wird gelöscht.
- **Typkonsistenz:** `Modal` (`open`, `onOpenChange`, `title`, `severity`, `dismissOnBackdrop`, `footer`), `Banner` (`severity`), `TextInput` (`label`, `help`, `density`, `fieldClassName`), `Select` (`options`, `label`, `value`, `onChange`) entsprechen den Signaturen aus dem DSS-Plan. Importpfad überall `@bbv/dss-design-system/react`; `DestructiveConfirmDialog` heißt in Test, Komponente und beiden Aufrufern gleich.
- **Platzhalter-Scan:** Die Schritte der Task 9 (Label+Input in elf Dateien) geben Regeln plus einen vollständigen Referenzumbau statt Code je Datei, weil die Stellen individuell sind und von Tests abgesichert werden; jede Datei ist namentlich genannt und durch das Gate-Kommando (Step 3) überprüfbar.
