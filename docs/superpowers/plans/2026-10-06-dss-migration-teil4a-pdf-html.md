# DSS-Migration Teil 4a — PDF-Theme und HTML-Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die vier PDF-Exporte und den HTML-Export von Fibalon-Blau/Helvetica auf das DSS-Design (Ink · Amber · Grau, Sora + Manrope) umstellen, die Standard-Teamfarbe ablösen und den Guard-Test verschärfen.

**Architecture:** Die Farben stehen einmal in `export-colors.ts` (Hex, per Konverter aus den DSS-OKLCH-Tokens abgeleitet und per Drift-Test an `tokens.css` gebunden); PDF-Theme und HTML-Export lesen sie von dort. Sora und Manrope kommen aus den bereits installierten `@fontsource`-Paketen: für react-pdf als statische WOFF (`Font.register`, einmalig und idempotent), für den HTML-Export als WOFF2-Dateien in der ZIP. Tests, die PDFs wirklich rendern, registrieren die Schriften als Data-URI aus dem Dateisystem.

**Tech Stack:** TypeScript, `@react-pdf/renderer` 4.5, `jszip`, Vite `?url`-Importe, Vitest (jsdom und node), Playwright (nur für die Sichtprüfung), `pdftoppm`/`pdfinfo` (Poppler, vorhanden).

**Spec:** `docs/superpowers/specs/2026-10-06-dss-migration-teil4-design.md` (Abschnitt „4a“). Dieser Plan setzt 4a um; 4b (Screenshots) folgt in einem eigenen Plan.

## Abweichungen vom Spec (aus der Plan-Recherche)

1. **Schriftgewichte:** Manrope **400, 600, 700** (statt 400, 500, 700). Die Tabellenköpfe nutzen `fontWeight: 600`; 500 kommt nirgends vor. Sora **600, 700** (Überschriften 700, Unterüberschrift 600). Für den HTML-Export genügen drei Dateien: Sora 700, Manrope 400 und 600.
2. **Keine Kursivschnitte:** Weder Sora noch Manrope haben eine Italic-Variante, und react-pdf kann sie nicht synthetisieren; `fontStyle: 'italic'` an einer registrierten Familie ohne Italic-Schnitt würde das Rendern abbrechen. Die Betonung (`*…*`) im Anleitungs-PDF wird deshalb **halbfett (Gewicht 600)** gesetzt, fett (`**…**`) bleibt 700.
3. **Amber-Linie als eigene Fläche:** Der Haupttitel bekommt die Linie über ein schmales `View` (neue Hilfsfunktion `PageTitle`), nicht über `borderBottom` am `Text` (Rahmen an Text-Knoten sind in react-pdf nicht verlässlich). Am Tabellenkopf (`View`) funktioniert `borderBottom`.
4. **Farben in eigener Datei:** `src/lib/export/export-colors.ts` (neu), damit der HTML-Export die Palette teilt, ohne `@react-pdf/renderer` zu importieren. `pdfColors` bleibt als Alias exportiert.

## Konventionen

- **Arbeitsverzeichnis:** der Worktree `/Users/oliver-marcuseder/01-vibe-coding/00-Basektball/08-Fibalon-Baskets/02-turnier-manager-dss-teil4` (Branch `feat/dss-pdf-html`, Basis `origin/main`, enthält den Spec-Commit; `node_modules` ist installiert). **Das Haupt-Arbeitsverzeichnis (`…/02-turnier-manager`) nicht anfassen** (fremde uncommittete Änderungen), ebenso den fremden Worktree `.worktrees/feat-pdf-export`.
- **Commit-Messages** enden mit der Zeile `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; **PR-Beschreibungen** mit `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **Nicht pushen, kein PR** ohne ausdrückliche Freigabe der Nutzerin/des Nutzers (steht am Ende des Plans).
- Verifikationsbefehle: `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`. Nach `typecheck`/`build` die Datei `tsconfig.tsbuildinfo` mit `git checkout -- tsconfig.tsbuildinfo` zurücksetzen und `dist/` löschen (nicht committen).
- Platz auf der Platte kann knapp werden (`df -h /` vor großen Läufen); den npm-Cache nicht löschen.
- Referenzwerte (unabhängig mit Python gerechnet, Ground Truth für die Tests):

| Token | OKLCH | Hex |
|---|---|---|
| `--ink-900` | `0.130 0.008 60` (`--h-ink`) | `#0a0705` |
| `--amber-400` | `0.800 0.165 83` (`--h-amber`) | `#f1b200` |
| `--n-50` | `0.985 0.003 250` | `#f9fafc` |
| `--n-100` | `0.965 0.005 250` | `#f1f4f7` |
| `--n-200` | `0.925 0.006 250` | `#e3e7ea` |
| `--n-600` | `0.420 0.011 250` | `#494e53` |
| `--sky-700` | `0.450 0.135 252` (= `--h-sky` 244 + 8) | `#00569d` |

  Kontraste: Ink-900 auf Weiß 20,1:1, auf Grau 100 18,2:1, auf Zebra (Grau 50) 19,2:1; Grau 600 auf Weiß 8,4:1 (alles AAA).

## Dateistruktur

| Datei | Aktion | Task |
|---|---|---|
| `src/lib/export/oklch.ts` (+ `.test.ts`) | neu — OKLCH → Hex | 1 |
| `src/lib/export/export-colors.ts` | neu — gemeinsame Palette | 2 |
| `src/lib/export/pdf-theme.ts` (+ `.test.ts`) | Farben/Stile/Fonts; Drift-Test | 2, 4 |
| `src/lib/export/pdf-title.ts` (+ Test) | neu — Haupttitel mit Amber-Linie | 4 |
| `src/lib/export/pdf-fonts.ts` (+ `.test.ts`) | neu — Registrierung | 3 |
| `src/test-utils/pdf-fonts.ts` | neu — Registrierung für Tests (Data-URI) | 3 |
| `src/lib/export/{pdf-export,group-overview-pdf,swiss-overview-pdf,manual-pdf}.ts` | `registerPdfFonts()` + `PageTitle` | 4, 5 |
| `src/lib/manual-markdown-pdf.ts` | Farben, Betonung | 4 |
| `src/lib/export/html-export.ts` (+ `.test.ts`) | neu geschrieben | 6 |
| `src/components/teams/TeamForm.tsx` (+ Test), `e2e/multi-group-round-robin-large.spec.ts` | Standardfarbe | 7 |
| `src/styles/no-fbnm-leftovers.test.ts` | verschärft | 8 |
| `docs/architecture/arc42/{08,09,11}-*.md`, `docs/use-cases-und-kritikalitaet.md` | Doku | 10 |

---

### Task 0: Baseline und Sichtprüfungs-Werkzeug

**Files:**
- Create (nur Scratchpad, nicht committen): `$SP/pdf-capture.cjs`

Alle Pfade mit `$SP=/private/tmp/claude-501/-Users-oliver-marcuseder-01-vibe-coding-00-Basektball-08-Fibalon-Baskets-02-turnier-manager/c5eb9565-c502-4a38-ae43-0427395e75c2/scratchpad`.

- [ ] **Step 1: Zustand prüfen und Unit-Baseline festhalten**

```bash
cd /Users/oliver-marcuseder/01-vibe-coding/00-Basektball/08-Fibalon-Baskets/02-turnier-manager-dss-teil4
git branch --show-current && git status --short | head -3 && git log --oneline -2
npm run typecheck && npm test 2>&1 | tail -6
git checkout -- tsconfig.tsbuildinfo
```

Expected: Branch `feat/dss-pdf-html`, sauberer Tree, letzter Commit der Spec; Typecheck und Tests grün. **Anzahl der Unit-Tests notieren** (`Tests N passed`), sie ist der Vergleichswert.

- [ ] **Step 2: PDF-Capture-Skript anlegen** — `$SP/pdf-capture.cjs` (erzeugt echte PDFs über die UI aus den Demo-Daten):

```js
// Nutzung (im Worktree-Root): NODE_PATH=$PWD/node_modules node $SP/pdf-capture.cjs <ausgabeordner>
const { chromium } = require('@playwright/test')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const out = process.argv[2]
if (!out) throw new Error('Ausgabeordner fehlt')
fs.mkdirSync(out, { recursive: true })

const PORT = 5189
const BASE = `http://localhost:${PORT}`
const demo = file => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/demos', file), 'utf8'))
const SEEDS = {
  swiss: '03-schweizer-system-9-teams-laufend.json',
  groups: '02-gruppenphase-endrunde-9-teams-laufend.json',
  big: '05-grossturnier-64-teams-16-gruppen-laufend.json',
}
const JOBS = [
  { name: 'zeitplan-swiss', seed: 'swiss', route: '/export', button: 'PDF herunterladen' },
  { name: 'zeitplan-64', seed: 'big', route: '/export', button: 'PDF herunterladen' },
  { name: 'swiss-uebersicht', seed: 'swiss', route: '/swiss-overview', button: 'PDF herunterladen' },
  { name: 'gruppen-alle-9', seed: 'groups', route: '/group-overview', button: 'Alle Gruppen als PDF herunterladen' },
  { name: 'gruppen-alle-64', seed: 'big', route: '/group-overview', button: 'Alle Gruppen als PDF herunterladen' },
  { name: 'anleitung', seed: 'swiss', route: '/anleitung', button: 'Als PDF herunterladen' },
]

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(BASE); if (r.ok) return } catch { /* noch nicht bereit */ }
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error('Dev-Server startet nicht')
}

;(async () => {
  const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: false })
  try {
    await waitForServer()
    const browser = await chromium.launch()
    for (const job of JOBS) {
      const { tournament, schedule } = demo(SEEDS[job.seed])
      const context = await browser.newContext({ locale: 'de-DE', timezoneId: 'Europe/Berlin', acceptDownloads: true })
      const page = await context.newPage()
      const warnings = []
      page.on('console', m => { if (['warning', 'error'].includes(m.type())) warnings.push(m.text().slice(0, 200)) })
      await page.addInitScript(([t, s]) => {
        localStorage.setItem('tm_tournament', JSON.stringify(t))
        localStorage.setItem('tm_schedule', JSON.stringify(s))
      }, [tournament, schedule])
      await page.goto(BASE + job.route)
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 180000 }),
        page.getByRole('button', { name: job.button }).click(),
      ])
      const file = path.join(out, `${job.name}.pdf`)
      await download.saveAs(file)
      console.log(`${job.name}: ${(fs.statSync(file).size / 1024).toFixed(0)} KB, Warnungen/Fehler: ${warnings.length}${warnings.length ? ' -> ' + warnings.join(' | ') : ''}`)
      await context.close()
    }
    await browser.close()
  } finally {
    server.kill()
  }
})().catch(err => { console.error(err); process.exit(1) })
```

- [ ] **Step 3: Baseline-PDFs mit dem aktuellen (alten) Stand erzeugen**

```bash
SP=/private/tmp/claude-501/-Users-oliver-marcuseder-01-vibe-coding-00-Basektball-08-Fibalon-Baskets-02-turnier-manager/c5eb9565-c502-4a38-ae43-0427395e75c2/scratchpad
NODE_PATH=$PWD/node_modules node $SP/pdf-capture.cjs $SP/pdf-before
for f in $SP/pdf-before/*.pdf; do echo "$(basename $f): $(pdfinfo $f | grep Pages | tr -s ' ')"; done
pgrep -fl "vite --port 5189" || echo "kein Dev-Server mehr aktiv"
```

Expected: sechs PDFs, Größen in KB, Seitenzahlen; keine Konsolenfehler. **Größen und Seitenzahlen notieren** (Vergleich in Task 9). Schlägt ein Job fehl (Button-Name/Route), Fehlermeldung wiedergeben und das Skript anpassen (Namen stehen in `ExportPanel.tsx`, `SwissOverviewPage.tsx`, `GroupOverviewPage.tsx`, `ManualPage.tsx`); beendet sich der Dev-Server nicht, `pkill -f "vite --port 5189"`.

### Task 1: OKLCH → Hex (TDD)

**Files:**
- Create: `src/lib/export/oklch.test.ts`, `src/lib/export/oklch.ts`

- [ ] **Step 1: Test schreiben** — `src/lib/export/oklch.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { oklchToHex } from './oklch'

describe('oklchToHex', () => {
  it('maps lightness 1 / chroma 0 to white and lightness 0 to black', () => {
    expect(oklchToHex(1, 0, 0)).toBe('#ffffff')
    expect(oklchToHex(0, 0, 0)).toBe('#000000')
  })

  // Referenzwerte unabhängig gerechnet (Björn Ottosson, OKLab -> linear sRGB -> sRGB-Gamma).
  it.each([
    ['ink-900', 0.13, 0.008, 60, '#0a0705'],
    ['amber-400', 0.8, 0.165, 83, '#f1b200'],
    ['n-50', 0.985, 0.003, 250, '#f9fafc'],
    ['n-100', 0.965, 0.005, 250, '#f1f4f7'],
    ['n-200', 0.925, 0.006, 250, '#e3e7ea'],
    ['n-600', 0.42, 0.011, 250, '#494e53'],
    ['sky-700', 0.45, 0.135, 252, '#00569d'],
  ])('converts DSS token %s', (_name, l, c, h, hex) => {
    expect(oklchToHex(l, c, h)).toBe(hex)
  })

  it('clamps out-of-gamut values into the sRGB range', () => {
    expect(oklchToHex(0.7, 0.4, 150)).toMatch(/^#[0-9a-f]{6}$/)
  })
})
```

Run: `npx vitest run src/lib/export/oklch.test.ts`
Expected: FAIL — `Failed to resolve import "./oklch"`.

- [ ] **Step 2: Implementieren** — `src/lib/export/oklch.ts`:

```ts
/**
 * OKLCH -> sRGB-Hex. react-pdf und ältere Browser kennen kein oklch(); die DSS-Tokens (tokens.css)
 * liegen aber als OKLCH vor. Reine Funktion ohne Abhängigkeit, Farben außerhalb des sRGB-Gamuts
 * werden pro Kanal begrenzt.
 */
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))

const gammaEncode = (linear: number): number => {
  const v = clamp01(linear)
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
}

export function oklchToHex(lightness: number, chroma: number, hueDegrees: number): string {
  const hue = (hueDegrees * Math.PI) / 180
  const a = chroma * Math.cos(hue)
  const b = chroma * Math.sin(hue)

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3

  const red = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const green = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const blue = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s

  return (
    '#' +
    [red, green, blue]
      .map(channel => Math.round(gammaEncode(channel) * 255).toString(16).padStart(2, '0'))
      .join('')
  )
}
```

Run: `npx vitest run src/lib/export/oklch.test.ts`
Expected: PASS (10 Tests). Weicht ein Wert um eine Stelle ab, ist das ein Rundungsunterschied zur Python-Referenz: Konverter und Test **nicht** aneinander anpassen, sondern die Rechnung prüfen (Matrixkoeffizienten) und berichten.

- [ ] **Step 3: Commit**

```bash
git add src/lib/export/oklch.ts src/lib/export/oklch.test.ts
git commit -m "feat(export): add OKLCH to hex converter for DSS tokens"
```

### Task 2: Gemeinsame Palette und Drift-Test (TDD)

**Files:**
- Create: `src/lib/export/export-colors.ts`
- Modify: `src/lib/export/pdf-theme.ts` (nur Farben), `src/lib/export/pdf-theme.test.ts`
- Modify (Schlüsselumbenennung): `src/lib/export/pdf-export.ts`, `src/lib/manual-markdown-pdf.ts`

- [ ] **Step 1: Test ersetzen** — `src/lib/export/pdf-theme.test.ts` vollständig:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pdfColors } from './pdf-theme'
import { oklchToHex } from './oklch'

// Vitest ersetzt CSS-Dateien durch leere Strings (auch mit ?raw) — deshalb per Dateisystem lesen.
const tokensCss = readFileSync(
  join(process.cwd(), 'node_modules/@bbv/dss-design-system/tokens/tokens.css'),
  'utf8',
)

function variable(name: string): string {
  const match = tokensCss.match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!match) throw new Error(`Token --${name} nicht in tokens.css gefunden`)
  return match[1].trim()
}

function tokenToHex(name: string): string {
  const raw = variable(name)
  const match = raw.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+(var\(--[a-z-]+\)|[\d.]+)\s*\)/)
  if (!match) throw new Error(`Token --${name} ist kein einfacher oklch()-Wert: ${raw}`)
  const hueRaw = match[3]
  const hue = hueRaw.startsWith('var(') ? Number(variable(hueRaw.slice(6, -1))) : Number(hueRaw)
  return oklchToHex(Number(match[1]), Number(match[2]), hue)
}

describe('pdf-theme colors', () => {
  // Drift-Test: Ändert das Design-System einen dieser Töne, schlägt dieser Test an.
  it.each([
    ['text', 'ink-900'],
    ['tableHeaderText', 'ink-900'],
    ['accent', 'amber-400'],
    ['textMuted', 'n-600'],
    ['tableHeaderBg', 'n-100'],
    ['zebra', 'n-50'],
    ['border', 'n-200'],
  ] as const)('pdfColors.%s entspricht dem DSS-Token --%s', (key, token) => {
    expect(pdfColors[key]).toBe(tokenToHex(token))
  })

  it('uses plain white', () => {
    expect(pdfColors.white).toBe('#ffffff')
  })
})
```

Run: `npx vitest run src/lib/export/pdf-theme.test.ts`
Expected: FAIL — `pdfColors.text` ist `undefined` (alte Schlüssel).

- [ ] **Step 2: Palette anlegen** — `src/lib/export/export-colors.ts`:

```ts
/**
 * Gemeinsame Farbpalette der Exporte (PDF und HTML-ZIP), Hex-Werte der DSS-Tokens aus
 * @bbv/dss-design-system/tokens/tokens.css (OKLCH, per oklch.ts umgerechnet). Der Drift-Test in
 * pdf-theme.test.ts hält die Werte synchron. Amber ist nie eine Textfarbe (nur Linie/Fläche).
 */
export const exportColors = {
  text: '#0a0705', // --ink-900
  textMuted: '#494e53', // --n-600
  tableHeaderBg: '#f1f4f7', // --n-100
  tableHeaderText: '#0a0705', // --ink-900
  accent: '#f1b200', // --amber-400
  zebra: '#f9fafc', // --n-50
  border: '#e3e7ea', // --n-200
  white: '#ffffff',
} as const
```

- [ ] **Step 3: `pdf-theme.ts` – nur die Farben umstellen.** Den Block `export const pdfColors = { … }` (Zeilen 3–9) ersetzen durch:

```ts
import { exportColors } from './export-colors'

export const pdfColors = exportColors
```

und die Verweise in `pdfBaseStyles` zunächst minimal an die neuen Schlüssel anpassen (Schriften und Linien folgen in Task 4): `pdfColors.brandBlue` → `pdfColors.text` (in `h1`, `h2`, `h3`), `tableHeaderRow.backgroundColor: pdfColors.brandBlue` → `pdfColors.tableHeaderBg`, `tableHeaderCell.color: pdfColors.white` → `pdfColors.tableHeaderText`, `cell.color: pdfColors.textDark` → `pdfColors.text`. Der `import { StyleSheet } …` bleibt die erste Zeile.

- [ ] **Step 4: Verbraucher umstellen**
  - `src/lib/export/pdf-export.ts`, `subtitle`: `color: pdfColors.textDark` → `color: pdfColors.textMuted`.
  - `src/lib/manual-markdown-pdf.ts`: Zeile mit der Bildunterschrift (`color: pdfColors.textDark`) → `pdfColors.textMuted`; Callout-Titel (`color: pdfColors.brandBlue`) → `pdfColors.text`.

- [ ] **Step 5: Tests und Typecheck**

```bash
npx vitest run src/lib/export/pdf-theme.test.ts && npm run typecheck
```

Expected: Drift-Test PASS (8 Tests), Typecheck grün (keine Verweise auf `brandBlue`/`textDark` mehr: `grep -rn "brandBlue\|textDark" src` leer).

- [ ] **Step 6: Commit**

```bash
git add src/lib/export/export-colors.ts src/lib/export/pdf-theme.ts src/lib/export/pdf-theme.test.ts src/lib/export/pdf-export.ts src/lib/manual-markdown-pdf.ts
git commit -m "feat(export): derive PDF colors from DSS tokens with a drift test"
```

### Task 3: PDF-Schriften registrieren (TDD)

**Files:**
- Create: `src/lib/export/pdf-fonts.test.ts`, `src/lib/export/pdf-fonts.ts`, `src/test-utils/pdf-fonts.ts`

- [ ] **Step 1: Registrierung für Tests** — `src/test-utils/pdf-fonts.ts` (Data-URI aus dem Dateisystem, weil react-pdf in Node/jsdom keine Vite-URLs laden kann):

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { registerPdfFonts } from '@/lib/export/pdf-fonts'

/** Vite liefert `?url`-Importe in Vitest als Root-relative Pfade (`/node_modules/...`). */
function toDataUri(url: string): string {
  const relative = url.split('?')[0].replace(/^\/@fs/, '')
  const file = relative.startsWith(process.cwd()) ? relative : join(process.cwd(), relative)
  return `data:font/woff;base64,${readFileSync(file).toString('base64')}`
}

export function registerPdfFontsForTests(): void {
  registerPdfFonts(toDataUri)
}
```

- [ ] **Step 2: Test schreiben** — `src/lib/export/pdf-fonts.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { Font, pdf, Document, Page, Text } from '@react-pdf/renderer'
import { createElement } from 'react'
import { PDF_FONT_FILES, registerPdfFonts } from './pdf-fonts'
import { registerPdfFontsForTests } from '@/test-utils/pdf-fonts'

describe('pdf-fonts', () => {
  it('describes Sora 600/700 and Manrope 400/600/700 as WOFF files', () => {
    expect(PDF_FONT_FILES.Sora.map(f => f.weight)).toEqual([600, 700])
    expect(PDF_FONT_FILES.Manrope.map(f => f.weight)).toEqual([400, 600, 700])
    for (const file of [...PDF_FONT_FILES.Sora, ...PDF_FONT_FILES.Manrope]) {
      expect(file.src).toMatch(/\.woff(\?.*)?$/)
    }
  })

  it('registers both families, and registering twice is harmless', () => {
    registerPdfFontsForTests()
    registerPdfFonts() // zweiter Aufruf: kein erneutes Registrieren
    const families = Font.getRegisteredFontFamilies()
    expect(families).toContain('Sora')
    expect(families).toContain('Manrope')
  })

  it('renders a real PDF using the registered fonts at every used weight', async () => {
    registerPdfFontsForTests()
    const doc = createElement(Document, {},
      createElement(Page, { size: 'A4' },
        createElement(Text, { style: { fontFamily: 'Sora', fontWeight: 700 } }, 'Überschrift'),
        createElement(Text, { style: { fontFamily: 'Sora', fontWeight: 600 } }, 'Unterüberschrift'),
        createElement(Text, { style: { fontFamily: 'Manrope', fontWeight: 400 } }, 'Fließtext äöüß'),
        createElement(Text, { style: { fontFamily: 'Manrope', fontWeight: 600 } }, 'Tabellenkopf'),
        createElement(Text, { style: { fontFamily: 'Manrope', fontWeight: 700 } }, 'Fett'),
      ),
    )
    const blob = await pdf(doc as Parameters<typeof pdf>[0]).toBlob()
    expect(blob.size).toBeGreaterThan(1000)
  })
})
```

Run: `npx vitest run src/lib/export/pdf-fonts.test.ts`
Expected: FAIL — `Failed to resolve import "./pdf-fonts"`.

- [ ] **Step 3: Implementieren** — `src/lib/export/pdf-fonts.ts`:

```ts
import { Font } from '@react-pdf/renderer'
import sora600 from '@fontsource/sora/files/sora-latin-600-normal.woff?url'
import sora700 from '@fontsource/sora/files/sora-latin-700-normal.woff?url'
import manrope400 from '@fontsource/manrope/files/manrope-latin-400-normal.woff?url'
import manrope600 from '@fontsource/manrope/files/manrope-latin-600-normal.woff?url'
import manrope700 from '@fontsource/manrope/files/manrope-latin-700-normal.woff?url'

/**
 * DSS-Schriften für die PDF-Exporte. react-pdf liest TTF und WOFF, aber weder WOFF2 noch
 * Variable-Fonts, deshalb die statischen WOFF-Schnitte aus @fontsource (Latin deckt Deutsch ab).
 * Es gibt bewusst keine Italic-Schnitte: Weder Sora noch Manrope haben welche.
 */
export const PDF_FONT_FILES = {
  Sora: [
    { weight: 600, src: sora600 },
    { weight: 700, src: sora700 },
  ],
  Manrope: [
    { weight: 400, src: manrope400 },
    { weight: 600, src: manrope600 },
    { weight: 700, src: manrope700 },
  ],
} as const

let registered = false

/**
 * Registriert Sora und Manrope bei react-pdf (einmalig, idempotent). `transformUrl` erlaubt Tests,
 * die Vite-URL auf eine ladbare Quelle (Data-URI) abzubilden; im Browser genügt der Standard.
 */
export function registerPdfFonts(transformUrl: (url: string) => string = url => url): void {
  if (registered) return
  for (const [family, files] of Object.entries(PDF_FONT_FILES)) {
    Font.register({
      family,
      fonts: files.map(file => ({ src: transformUrl(file.src), fontWeight: file.weight })),
    })
  }
  registered = true
}
```

Run: `npx vitest run src/lib/export/pdf-fonts.test.ts`
Expected: PASS (3 Tests). Schlägt der Render-Test fehl:
  1. Fehlermeldung genau lesen. Meldet react-pdf, die Quelle sei nicht ladbar, in `toDataUri` zunächst `console.log(url)` prüfen (erwartet `/node_modules/@fontsource/...woff`).
  2. Funktioniert die Data-URI nicht, der Reihe nach probieren: (a) absoluter Dateipfad statt Data-URI (`return file`), (b) `file://` + Pfad. Die funktionierende Variante in `src/test-utils/pdf-fonts.ts` festschreiben und im Bericht nennen.
  3. `Could not resolve font … weight`: Die Gewichte in `PDF_FONT_FILES` und in der Testkomponente müssen übereinstimmen.

- [ ] **Step 4: Commit**

```bash
git add src/lib/export/pdf-fonts.ts src/lib/export/pdf-fonts.test.ts src/test-utils/pdf-fonts.ts
git commit -m "feat(export): register Sora and Manrope for react-pdf"
```

### Task 4: Stile, Titel mit Amber-Linie, Betonung (TDD)

**Files:**
- Create: `src/lib/export/pdf-title.ts`, `src/lib/export/pdf-title.test.ts`
- Modify: `src/lib/export/pdf-theme.ts`, `src/lib/export/pdf-theme.test.ts`, `src/lib/manual-markdown-pdf.ts`
- Modify: `src/lib/export/{pdf-export,group-overview-pdf,swiss-overview-pdf,manual-pdf}.ts` (Titel)
- Modify (nur falls nötig): rendernde Tests

- [ ] **Step 1: Tests ergänzen.** In `src/lib/export/pdf-theme.test.ts` am Ende (vor der letzten Klammerzeile ist alles Bestehende, daher als neuen `describe`-Block anhängen):

```ts
import { pdfBaseStyles, pdfFonts } from './pdf-theme'

describe('pdf-theme styles', () => {
  it('uses Manrope for body text and Sora for headings', () => {
    expect(pdfFonts).toEqual({ heading: 'Sora', body: 'Manrope' })
    expect(pdfBaseStyles.page.fontFamily).toBe('Manrope')
    expect(pdfBaseStyles.h1.fontFamily).toBe('Sora')
    expect(pdfBaseStyles.h2.fontFamily).toBe('Sora')
    expect(pdfBaseStyles.h3.fontFamily).toBe('Sora')
    expect(pdfBaseStyles.cell.fontFamily).toBe('Manrope')
    expect(pdfBaseStyles.tableHeaderCell.fontFamily).toBe('Manrope')
  })

  it('only uses font weights that are registered', () => {
    expect([pdfBaseStyles.h1.fontWeight, pdfBaseStyles.h2.fontWeight]).toEqual([700, 700])
    expect(pdfBaseStyles.h3.fontWeight).toBe(600)
    expect(pdfBaseStyles.tableHeaderCell.fontWeight).toBe(600)
    expect(pdfBaseStyles.cell.fontWeight).toBe(400)
  })

  it('gives the table header a light background, dark text and an amber rule', () => {
    expect(pdfBaseStyles.tableHeaderRow.backgroundColor).toBe(pdfColors.tableHeaderBg)
    expect(pdfBaseStyles.tableHeaderRow.borderBottom).toBe(`2px solid ${pdfColors.accent}`)
    expect(pdfBaseStyles.tableHeaderCell.color).toBe(pdfColors.tableHeaderText)
  })

  it('gives even table rows the zebra background and does not uppercase headings', () => {
    expect(pdfBaseStyles.tableRowEven.backgroundColor).toBe(pdfColors.zebra)
    expect(pdfBaseStyles.h1).not.toHaveProperty('textTransform')
    expect(pdfBaseStyles.h2).not.toHaveProperty('textTransform')
  })
})
```

Den Import `pdfColors` am Dateikopf um `pdfBaseStyles, pdfFonts` ergänzen (eine einzige Importzeile aus `./pdf-theme`; die zweite `import`-Zeile oben im neuen Block entfällt dann).

`src/lib/export/pdf-title.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isValidElement } from 'react'
import { PageTitle } from './pdf-title'
import { pdfColors } from './pdf-theme'

function serialize(node: unknown): string {
  return JSON.stringify(node, (_key, value) =>
    isValidElement(value) ? { type: (value as { type: unknown }).type, props: (value as { props: unknown }).props } : value,
  )
}

describe('PageTitle', () => {
  it('renders the title text followed by an amber accent rule', () => {
    const element = PageTitle('Sommer-Cup 2026')
    expect(isValidElement(element)).toBe(true)
    const json = serialize(element)
    expect(json).toContain('Sommer-Cup 2026')
    expect(json).toContain(pdfColors.accent)
  })
})
```

Run: `npx vitest run src/lib/export/pdf-theme.test.ts src/lib/export/pdf-title.test.ts`
Expected: FAIL (`pdfFonts` fehlt, `pdf-title` fehlt).

- [ ] **Step 2: `pdf-theme.ts` vollständig ersetzen:**

```ts
import { StyleSheet } from '@react-pdf/renderer'
import { exportColors } from './export-colors'

export const pdfColors = exportColors

/** Registrierte Familien (siehe pdf-fonts.ts). */
export const pdfFonts = { heading: 'Sora', body: 'Manrope' } as const

export const pdfBaseStyles = StyleSheet.create({
  page: { padding: 40, fontFamily: pdfFonts.body, fontWeight: 400, color: pdfColors.text },
  h1: { fontFamily: pdfFonts.heading, fontSize: 20, fontWeight: 700, color: pdfColors.text, marginBottom: 4 },
  h2: { fontFamily: pdfFonts.heading, fontSize: 14, fontWeight: 700, color: pdfColors.text, marginTop: 16, marginBottom: 6 },
  h3: { fontFamily: pdfFonts.heading, fontSize: 11, fontWeight: 600, color: pdfColors.text, marginTop: 10, marginBottom: 4 },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: pdfColors.tableHeaderBg,
    borderBottom: `2px solid ${pdfColors.accent}`,
  },
  tableHeaderCell: {
    fontFamily: pdfFonts.body,
    color: pdfColors.tableHeaderText,
    fontSize: 9,
    fontWeight: 600,
    padding: 4,
  },
  tableRow: { flexDirection: 'row', borderBottom: `1px solid ${pdfColors.border}` },
  tableRowEven: { backgroundColor: pdfColors.zebra },
  cell: { fontFamily: pdfFonts.body, fontSize: 9, fontWeight: 400, color: pdfColors.text, padding: 4 },
})
```

- [ ] **Step 3: `pdf-title.ts` anlegen:**

```ts
import { Text, View } from '@react-pdf/renderer'
import { createElement } from 'react'
import { pdfBaseStyles, pdfColors } from './pdf-theme'

/**
 * Haupttitel einer PDF-Seite mit schmaler Amber-Linie darunter. Die Linie ist ein eigenes View,
 * weil Rahmen an Text-Knoten in react-pdf nicht verlässlich gezeichnet werden.
 */
export function PageTitle(title: string) {
  return createElement(View, {},
    createElement(Text, { style: pdfBaseStyles.h1 }, title),
    createElement(View, { style: { height: 2, backgroundColor: pdfColors.accent, marginBottom: 10 } }),
  )
}
```

- [ ] **Step 4: Titel in den vier Exporten tauschen.** In jedem Export wird `createElement(Text, { style: pdfBaseStyles.h1 }, <titel>)` zu `PageTitle(<titel>)` und der Import `import { PageTitle } from './pdf-title'` ergänzt. Konkret:
  - `pdf-export.ts`: `createElement(Text, { style: pdfBaseStyles.h1 }, tournament.name),` → `PageTitle(tournament.name),`
  - `group-overview-pdf.ts`: `createElement(Text, { style: pdfBaseStyles.h1 }, tournament.name),` → `PageTitle(tournament.name),`
  - `swiss-overview-pdf.ts`: `createElement(Text, { style: pdfBaseStyles.h1 }, tournament.name),` → `PageTitle(tournament.name),`
  - `manual-pdf.ts`: `createElement(Text, { style: pdfBaseStyles.h1 }, 'Nutzeranleitung: Basketball Turnier-Manager'),` → `PageTitle('Nutzeranleitung: Basketball Turnier-Manager'),`
  Wird `Text` in einer Datei danach nicht mehr verwendet, den Import entfernen (`noUnusedLocals`). `pdf-export.ts`, `group-overview-pdf.ts`, `swiss-overview-pdf.ts` nutzen `Text` weiter.

- [ ] **Step 5: Betonung im Anleitungs-PDF** — `src/lib/manual-markdown-pdf.ts`: die Zeile mit `fontStyle: 'italic'` ersetzen durch halbfett (Italic-Schnitte existieren nicht):

alt: `return createElement(Text, { key: i, style: { fontStyle: 'italic' } }, ...renderInlineText((token as Tokens.Em).tokens, images))`
neu: `return createElement(Text, { key: i, style: { fontWeight: 600 } }, ...renderInlineText((token as Tokens.Em).tokens, images))`

und die fett-Zeile: `{ fontWeight: 'bold' }` → `{ fontWeight: 700 }`, im Callout-Titel `fontWeight: 'bold'` → `fontWeight: 700` (damit kein Alias-Wert `'bold'` an der registrierten Familie hängt).

- [ ] **Step 6: Tests ausführen und rendernde Tests absichern**

```bash
npx vitest run src/lib/export src/lib/manual-markdown-pdf.test.ts src/lib/manual-markdown-jsx.test.tsx 2>&1 | tail -30
```

Expected: Theme- und Title-Tests PASS. Rendert ein Test ein PDF (`pdf(...).toBlob()`, z. B. in `manual-pdf.test.ts`) und scheitert mit einem Fehler wie „Font family not registered: Manrope“, dort in der Datei ergänzen:

```ts
import { beforeAll } from 'vitest'
import { registerPdfFontsForTests } from '@/test-utils/pdf-fonts'

beforeAll(() => registerPdfFontsForTests())
```

(`beforeAll` zu den bestehenden `vitest`-Imports hinzufügen statt eine zweite Importzeile.) Tests, die nur den Elementbaum prüfen (`pdf-export.test.ts`, `group-overview-pdf.test.ts`, `swiss-overview-pdf.test.ts`), brauchen keine Schriften. Danach `npm run typecheck` und `npm test` (Anzahl: Baseline + neue Tests aus Task 1–4, keine Fehlschläge).

- [ ] **Step 7: Commit**

```bash
git add src/lib src/test-utils
git commit -m "feat(export): apply Sora/Manrope, light table headers and amber rules to PDF styles"
```

### Task 5: Schriften in den vier Downloads registrieren

**Files:**
- Modify: `src/lib/export/pdf-export.ts`, `group-overview-pdf.ts`, `swiss-overview-pdf.ts`, `manual-pdf.ts`

- [ ] **Step 1: Registrierung vor dem Rendern.** In jeder der vier `download…`-Funktionen als erste Anweisung `registerPdfFonts()` aufrufen und `import { registerPdfFonts } from './pdf-fonts'` ergänzen:
  - `pdf-export.ts`: in `downloadPdf` vor `const doc = …`
  - `group-overview-pdf.ts`: in `downloadGroupOverviewPdf` vor `const doc = …`
  - `swiss-overview-pdf.ts`: in `downloadSwissOverviewPdf` vor `const doc = …`
  - `manual-pdf.ts`: in `downloadManualPdf` vor `const tokens = …`

  Die `build…Document`-Funktionen bleiben unverändert (reine Elementbäume, von den Tests direkt benutzt).

- [ ] **Step 2: Echte Browser-Downloads prüfen**

```bash
npm run typecheck && npm test 2>&1 | tail -5
npx playwright test e2e/pdf-export.spec.ts 2>&1 | tail -12
```

Expected: Typecheck und Unit-Tests grün; vier E2E-Downloads grün (`%PDF-`-Prüfung). Schlägt ein Download im Browser fehl (Font nicht ladbar), Konsolenausgabe/Netzwerkfehler genau berichten: Der Vite-`?url`-Import muss im Dev-Server auf `/node_modules/.vite/…` oder `/@fs/…` zeigen.

- [ ] **Step 3: Commit**

```bash
git add src/lib/export
git commit -m "feat(export): register the DSS fonts before every PDF download"
```

### Task 6: HTML-Export mit DSS-Optik und Schriften in der ZIP (TDD)

**Files:**
- Create: `src/lib/export/html-export.test.ts`
- Modify (komplett ersetzen): `src/lib/export/html-export.ts`

- [ ] **Step 1: Test schreiben** — `src/lib/export/html-export.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { buildHtml, createHtmlZip, HTML_EXPORT_FONTS } from './html-export'
import { exportColors } from './export-colors'
import type { TournamentConfig, Schedule } from '@/types'

const tournament: TournamentConfig = {
  id: 't1', name: 'Sommer <Cup>', mode: 'round-robin', fields: 1,
  gameSettings: {
    periodsCount: 4, periodDurationMin: 5, breakBetweenPeriodsMin: 1,
    halfTimeBreakMin: 5, bufferBetweenGamesMin: 5, breakBetweenRoundsMin: 15,
    awardCeremonyMin: 15,
  },
  venue: {
    name: 'Halle', availabilityWindows: [{ start: '09:00', end: '20:00' }],
    blackoutPeriods: [], setupBufferMin: 30, teardownBufferMin: 30,
  },
  teams: [
    { id: 'a', name: 'Team A', logoUrl: '', color: '#000', contact: '', players: [] },
    { id: 'b', name: 'Team B', logoUrl: '', color: '#000', contact: '', players: [] },
  ],
}

const schedule: Schedule = {
  id: 's1', tournamentId: 't1', generatedAt: '2026-10-06T10:00:00Z',
  games: [
    {
      id: 'g1', homeTeamId: 'a', awayTeamId: 'b', stage: 'group', field: 1,
      scheduledStart: '09:30', scheduledEnd: '10:00', round: 1, gameNumber: 1, periodScores: [],
    },
  ],
  totalDurationMin: 30, estimatedEnd: '10:00',
}

describe('buildHtml', () => {
  const html = buildHtml(tournament, schedule)

  it('escapes the tournament name and lists the games', () => {
    expect(html).toContain('Sommer &lt;Cup&gt;')
    expect(html).toContain('Team A vs Team B')
    expect(html).toContain('1 Spiele · Ende ca. 10:00')
  })

  it('uses the shared DSS palette and no Fibalon colors or fonts', () => {
    expect(html).toContain(exportColors.tableHeaderBg)
    expect(html).toContain(exportColors.accent)
    expect(html).toContain(exportColors.zebra)
    expect(html).not.toMatch(/#004174|#002751|#f0f7fc/i)
    expect(html).not.toMatch(/Aller/)
  })

  it('declares one @font-face per bundled font with a relative fonts/ path', () => {
    for (const font of HTML_EXPORT_FONTS) {
      expect(html).toContain(`url('fonts/${font.fileName}') format('woff2')`)
      expect(html).toContain(`font-family: '${font.family}'`)
    }
    expect(html.match(/@font-face/g)).toHaveLength(HTML_EXPORT_FONTS.length)
  })
})

describe('createHtmlZip', () => {
  it('contains index.html and every referenced font file', async () => {
    const fonts = HTML_EXPORT_FONTS.map(f => ({ fileName: f.fileName, data: new Uint8Array([1, 2, 3]) }))
    const bytes = await createHtmlZip(tournament, schedule, fonts)
    const zip = await JSZip.loadAsync(bytes)

    expect(Object.keys(zip.files)).toContain('index.html')
    const html = await zip.file('index.html')!.async('string')
    const referenced = [...html.matchAll(/url\('(fonts\/[^']+)'\)/g)].map(m => m[1])
    expect(referenced.length).toBe(HTML_EXPORT_FONTS.length)
    for (const path of referenced) {
      expect(zip.file(path), `${path} fehlt in der ZIP`).not.toBeNull()
    }
  })
})
```

Run: `npx vitest run src/lib/export/html-export.test.ts`
Expected: FAIL — `buildHtml`/`HTML_EXPORT_FONTS` werden nicht exportiert.

- [ ] **Step 2: `html-export.ts` komplett ersetzen:**

```ts
import JSZip from 'jszip'
import type { TournamentConfig, Schedule } from '@/types'
import { exportColors } from './export-colors'
import sora700 from '@fontsource/sora/files/sora-latin-700-normal.woff2?url'
import manrope400 from '@fontsource/manrope/files/manrope-latin-400-normal.woff2?url'
import manrope600 from '@fontsource/manrope/files/manrope-latin-600-normal.woff2?url'

/** Schriften, die in die ZIP gelegt werden (nur die tatsächlich genutzten Schnitte). */
export const HTML_EXPORT_FONTS = [
  { family: 'Sora', weight: 700, fileName: 'sora-latin-700-normal.woff2', url: sora700 },
  { family: 'Manrope', weight: 400, fileName: 'manrope-latin-400-normal.woff2', url: manrope400 },
  { family: 'Manrope', weight: 600, fileName: 'manrope-latin-600-normal.woff2', url: manrope600 },
] as const

export interface HtmlExportFontData {
  fileName: string
  data: Uint8Array
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const fontFaces = HTML_EXPORT_FONTS.map(
  font => `    @font-face { font-family: '${font.family}'; font-weight: ${font.weight}; font-style: normal; font-display: swap; src: url('fonts/${font.fileName}') format('woff2'); }`,
).join('\n')

export function buildHtml(tournament: TournamentConfig, schedule: Schedule): string {
  const teamMap = new Map(tournament.teams.map(t => [t.id, t]))

  const rows = schedule.games.map(g => {
    const home = escapeHtml(g.homeTeamId ? (teamMap.get(g.homeTeamId)?.name ?? '?') : (g.homeLabel ?? '?'))
    const away = escapeHtml(g.awayTeamId ? (teamMap.get(g.awayTeamId)?.name ?? '?') : (g.awayLabel ?? '?'))
    return `<tr>
      <td>${g.gameNumber}</td>
      <td>Feld ${g.field}</td>
      <td>${g.scheduledStart} – ${g.scheduledEnd}</td>
      <td>${home} vs ${away}</td>
    </tr>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(tournament.name)}</title>
  <style>
${fontFaces}
    body { font-family: 'Manrope', system-ui, sans-serif; font-weight: 400; max-width: 800px; margin: 2rem auto; padding: 0 1rem; color: ${exportColors.text}; }
    h1 { font-family: 'Sora', system-ui, sans-serif; font-size: 1.75rem; font-weight: 700; color: ${exportColors.text}; margin-bottom: 0.25rem; padding-bottom: 0.4rem; border-bottom: 3px solid ${exportColors.accent}; }
    p { color: ${exportColors.textMuted}; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { padding: 0.5rem 1rem; text-align: left; border-bottom: 1px solid ${exportColors.border}; }
    th { font-weight: 600; background: ${exportColors.tableHeaderBg}; color: ${exportColors.tableHeaderText}; border-bottom: 2px solid ${exportColors.accent}; }
    tr:nth-child(even) td { background: ${exportColors.zebra}; }
  </style>
</head>
<body>
  <h1>${escapeHtml(tournament.name)}</h1>
  <p>${schedule.games.length} Spiele · Ende ca. ${schedule.estimatedEnd}</p>
  <table>
    <thead><tr><th>#</th><th>Feld</th><th>Zeit</th><th>Paarung</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`
}

/** Baut die ZIP-Datei (index.html + fonts/*.woff2) als Bytes; rein, damit sie testbar ist. */
export async function createHtmlZip(
  tournament: TournamentConfig,
  schedule: Schedule,
  fonts: HtmlExportFontData[],
): Promise<Uint8Array> {
  const zip = new JSZip()
  zip.file('index.html', buildHtml(tournament, schedule))
  for (const font of fonts) zip.file(`fonts/${font.fileName}`, font.data)
  return zip.generateAsync({ type: 'uint8array' })
}

async function loadFonts(): Promise<HtmlExportFontData[]> {
  return Promise.all(
    HTML_EXPORT_FONTS.map(async font => {
      const response = await fetch(font.url)
      if (!response.ok) throw new Error(`Schrift ${font.fileName} konnte nicht geladen werden (${response.status})`)
      return { fileName: font.fileName, data: new Uint8Array(await response.arrayBuffer()) }
    }),
  )
}

export async function downloadHtmlZip(tournament: TournamentConfig, schedule: Schedule): Promise<void> {
  const bytes = await createHtmlZip(tournament, schedule, await loadFonts())
  const blob = new Blob([bytes], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${tournament.name.replace(/\s+/g, '-')}-zeitplan.zip`
  a.click()
  URL.revokeObjectURL(url)
}
```

Run: `npx vitest run src/lib/export/html-export.test.ts && npm run typecheck`
Expected: PASS (4 Tests), Typecheck grün. Wird beim Typecheck `new Blob([bytes])` wegen `Uint8Array<ArrayBufferLike>` bemängelt, `new Blob([bytes as BlobPart], …)` verwenden.

- [ ] **Step 3: Download im Browser prüfen** — E2E-Test für den HTML-Download ist nicht vorhanden; per Playwright-Skript prüfen (nicht committen): Export-Seite (`/export`) mit Demo-Daten öffnen, den Button „Web-Seite (ZIP) herunterladen“ klicken, ZIP speichern und `unzip -l` ausführen. Erwartet: `index.html` und drei Dateien unter `fonts/`. Ergebnis (Größe der ZIP) im Bericht nennen.

- [ ] **Step 4: Commit**

```bash
git add src/lib/export/html-export.ts src/lib/export/html-export.test.ts
git commit -m "feat(export): restyle the HTML export with the DSS palette and bundle the fonts"
```

### Task 7: Standard-Teamfarbe

**Files:**
- Modify: `src/components/teams/TeamForm.tsx`, `src/components/teams/TeamForm.test.tsx`, `e2e/multi-group-round-robin-large.spec.ts`

- [ ] **Step 1: Test ergänzen** — in `src/components/teams/TeamForm.test.tsx` innerhalb des bestehenden `describe` (Datei vorher lesen und Render-Konvention übernehmen; sie rendert `<TeamForm onSubmit={…} />`):

```tsx
  it('preselects a DSS sky blue as the default team color', () => {
    render(<TeamForm onSubmit={() => {}} />)
    expect(screen.getByLabelText('Farbe')).toHaveValue('#00569d')
  })
```

Run: `npx vitest run src/components/teams/TeamForm.test.tsx`
Expected: FAIL — Wert ist `#004174`.

- [ ] **Step 2: Umstellen.** `src/components/teams/TeamForm.tsx`: `initial?.color ?? '#004174'` → `initial?.color ?? '#00569d'` (DSS `--sky-700`). `e2e/multi-group-round-robin-large.spec.ts` (Zeile mit `color: '#004174',`): → `color: '#00569d',`.

Run: `npx vitest run src/components/teams && grep -rn "004174" src e2e || echo "keine FBNM-Teamfarbe mehr"`
Expected: PASS, kein Treffer mehr in `src`/`e2e`.

- [ ] **Step 3: Commit**

```bash
git add src/components/teams e2e/multi-group-round-robin-large.spec.ts
git commit -m "feat: default team color uses DSS sky blue"
```

### Task 8: Guard-Test verschärfen (TDD)

**Files:**
- Modify: `src/styles/no-fbnm-leftovers.test.ts`

- [ ] **Step 1: Erweitern.** Die bestehende Konstante `FORBIDDEN` bleibt; darunter eine zweite, groß-/kleinschreibungsunabhängige Regel ergänzen und den ersten `it`-Block auf beide prüfen lassen:

```ts
const FORBIDDEN = /fbnm|FBNM|INSOLENT|ALLER|Montserrat/
// FBNM-Farben und die Schrift 'Aller' (mit kleinem l): case-insensitiv, aber nur in dieser engen Form,
// weil "aller" auch ein deutsches Wort ist.
const FORBIDDEN_LITERALS = /#004174|#002751|#f0f7fc|font-family:\s*['"]Aller['"]/i
```

und im Filter:

```ts
      .filter(path => /\.(ts|tsx|css)$/.test(path) && !path.endsWith(SELF))
      .filter(path => {
        const content = readFileSync(path, 'utf8')
        return FORBIDDEN.test(content) || FORBIDDEN_LITERALS.test(content)
      })
```

Run: `npx vitest run src/styles/no-fbnm-leftovers.test.ts`
Expected: PASS (nach Task 2, 6 und 7 gibt es keine Treffer mehr). Zur Gegenprobe kurz `git stash`-frei prüfen: `grep -rniE "#004174|#002751|#f0f7fc|font-family: *'aller'" src` liefert nur den Guard-Test selbst. Die E2E-Dateien liegen außerhalb von `src` und werden nicht gescannt.

- [ ] **Step 2: Commit**

```bash
git add src/styles/no-fbnm-leftovers.test.ts
git commit -m "test: guard against FBNM colors and the Aller font"
```

### Task 9: Gesamtverifikation und Sichtprüfung der PDFs

- [ ] **Step 1: Alles ausführen**

```bash
npm run typecheck && npm test 2>&1 | tail -6 && npm run build 2>&1 | tail -4 && npm run test:e2e 2>&1 | tail -6
git checkout -- tsconfig.tsbuildinfo; rm -rf dist
```

Expected: alles grün; Unit-Anzahl = Baseline + neue Tests (oklch 10, theme-Drift 8 minus alte 3 plus 4 Stil-Tests, fonts 3, title 1, html 4, TeamForm 1; Zahl nennen und mit der Rechnung abgleichen); E2E-Anzahl unverändert (41), inklusive `accessibility.spec.ts` und der vier PDF-Downloads.

- [ ] **Step 2: Neue PDFs erzeugen und mit der Baseline vergleichen**

```bash
SP=/private/tmp/claude-501/-Users-oliver-marcuseder-01-vibe-coding-00-Basektball-08-Fibalon-Baskets-02-turnier-manager/c5eb9565-c502-4a38-ae43-0427395e75c2/scratchpad
NODE_PATH=$PWD/node_modules node $SP/pdf-capture.cjs $SP/pdf-after
for n in zeitplan-swiss zeitplan-64 swiss-uebersicht gruppen-alle-9 gruppen-alle-64 anleitung; do
  echo "$n  vorher: $(du -k $SP/pdf-before/$n.pdf | cut -f1) KB, $(pdfinfo $SP/pdf-before/$n.pdf | awk '/Pages/{print $2}') S.   nachher: $(du -k $SP/pdf-after/$n.pdf | cut -f1) KB, $(pdfinfo $SP/pdf-after/$n.pdf | awk '/Pages/{print $2}') S."
done
pdffonts $SP/pdf-after/zeitplan-swiss.pdf
pgrep -fl "vite --port 5189" || echo "kein Dev-Server mehr aktiv"
```

Expected: keine Konsolenwarnungen/-fehler (react-pdf meldet Überläufe selbst); `pdffonts` zeigt Sora und Manrope (eingebettet, `emb yes`, keine Helvetica mehr); Seitenzahlen ähnlich wie vorher (Abweichungen > 1 Seite je PDF erklären); Größen: das Anleitungs-PDF und die übrigen dürfen wachsen, aber nicht um mehr als ca. 300 KB je Datei (andernfalls berichten).

- [ ] **Step 3: Seiten als Bild ansehen.** Für jedes PDF die erste und, falls vorhanden, eine mittlere Seite rendern und im Bericht beschreiben, was zu sehen ist (Schrift, heller Kopf mit Amber-Linie, Zebra, Titelstrich, nichts abgeschnitten/überlappend):

```bash
for n in zeitplan-swiss swiss-uebersicht gruppen-alle-64 anleitung; do
  pdftoppm -r 60 -png -f 1 -l 2 $SP/pdf-after/$n.pdf $SP/png-after-$n
done
ls $SP/png-after-*.png
```

Die PNGs bleiben im Scratchpad (nicht committen); ihre Pfade im Bericht nennen, damit sie von der Nutzerin/vom Nutzer angesehen werden können.

- [ ] **Step 4: Aufräumen.** Es dürfen keine Artefakte im Git-Status stehen (`git status --short` leer; `dist/`, `playwright-report/`, `test-results/` sind ignoriert). Scratchpad-Dateien sind nicht Teil des Repos.

### Task 10: Dokumentation

**Files:**
- Modify: `docs/architecture/arc42/08-querschnittliche-konzepte.md`, `09-architekturentscheidungen.md`, `11-risiken-und-technische-schulden.md`, `docs/use-cases-und-kritikalitaet.md`

- [ ] **Step 1: Vorab lesen.** Die jeweils letzten Abschnitte bestimmen: `grep -n "^## 8\." docs/architecture/arc42/08-querschnittliche-konzepte.md | tail -2` (letzte Nummer, derzeit 8.13), `grep -n "^### ADR-" docs/architecture/arc42/09-architekturentscheidungen.md | tail -2` (derzeit ADR-11), `sed -n '/^## 11.14/,$p' docs/architecture/arc42/11-risiken-und-technische-schulden.md` (aktueller Text von 11.14), und in `docs/use-cases-und-kritikalitaet.md` die Zeilen `grep -n "UC6\|N2" docs/use-cases-und-kritikalitaet.md`. Nächste freie Nummern verwenden.

- [ ] **Step 2: arc42 Kapitel 08** — am Ende neuen Abschnitt (Nummer = letzte + 1, hier `8.14`) anhängen:

```markdown
## 8.14 Export-Palette und Schriften (PDF, HTML-ZIP)

- **Eine Palette, ein Drift-Test:** `src/lib/export/export-colors.ts` enthält die Hex-Werte der DSS-Tokens (Ink-900,
  Grau 50/100/200/600, Amber-400), abgeleitet über `src/lib/export/oklch.ts` (react-pdf und der HTML-Export kennen kein
  `oklch()`). `pdf-theme.test.ts` liest `node_modules/@bbv/dss-design-system/tokens/tokens.css` per `node:fs`
  (Vitest ersetzt CSS-Dateien beim Import durch leere Strings) und vergleicht jede Farbe mit dem umgerechneten Token.
  Ändert DSS einen dieser Töne, schlägt der Test an. Amber ist nie Textfarbe (nur Linie/Fläche).
- **Schriften:** `src/lib/export/pdf-fonts.ts` registriert Sora (600, 700) und Manrope (400, 600, 700) bei react-pdf
  (statische WOFF aus `@fontsource`; react-pdf liest kein WOFF2 und keine Variable-Fonts). Jeder Download ruft
  `registerPdfFonts()` vor dem Rendern auf. Es gibt keine Italic-Schnitte; die Betonung im Anleitungs-PDF ist halbfett.
  Tests, die PDFs wirklich rendern, nutzen `registerPdfFontsForTests()` (Data-URI aus dem Dateisystem).
- **HTML-Export:** die ZIP enthält `index.html` und `fonts/*.woff2` (Sora 700, Manrope 400/600), per `@font-face` mit
  relativem Pfad; sie funktioniert offline.
```

- [ ] **Step 3: arc42 Kapitel 09** — neuen ADR (Nummer = letzte + 1, hier `ADR-12`) anhängen:

```markdown
### ADR-12: DSS-Schriften und -Farben in PDF- und HTML-Export einbetten

- **Kontext**: Nach der DSS-Umstellung der App (ADR-11) zeigten die PDF-Exporte und der HTML-Export noch das
  Fibalon-Branding (Blau, `Helvetica`/`Aller`). react-pdf kennt kein `oklch()` und keine Systemschriften außer
  den 14 PDF-Standardschriften.
- **Geprüfte Alternativen**: `Helvetica` behalten und nur Farben tauschen (robust, aber typografisch nicht DSS);
  nur Überschriften in Sora (gemischtes Schriftbild); im HTML-Export nur eine Systemschrift (klein, aber ohne
  installierte Schrift nicht DSS).
- **Entscheidung**: Sora und Manrope werden eingebettet: in die PDFs über `Font.register` (statische WOFF aus
  `@fontsource`, nur genutzte Zeichen werden eingebettet), in die HTML-ZIP als WOFF2-Dateien. Die Farben stehen als
  Hex in `export-colors.ts`, per OKLCH-Konverter aus den Tokens abgeleitet und durch einen Drift-Test an `tokens.css`
  gebunden. Tabellenköpfe sind hell mit Amber-Linie (druckfreundlich).
- **Konsequenz**: Kein Italic (die Betonung im Anleitungs-PDF ist halbfett); die Registrierung ist eine zusätzliche
  Fehlerquelle beim Download und in Tests (daher Test-Helfer und Registrierungstest); PDFs wachsen um die
  eingebetteten Zeichen (gemessen in der Sichtprüfung).
- **Beleg**: `docs/superpowers/specs/2026-10-06-dss-migration-teil4-design.md`,
  `docs/superpowers/plans/2026-10-06-dss-migration-teil4a-pdf-html.md`.
```

- [ ] **Step 4: arc42 Kapitel 11** — in 11.14 die erledigten Punkte von Teil 4 streichen: den Spiegelstrich zu „react-pdf-Exporte (hartcodierte Farben, `Helvetica`) und Druckansichten“, den zu `html-export.ts` (`'Aller'`, `#002751`) und den zur Standard-Teamfarbe `#004174`. Stehen lassen: `/anleitung`-Screenshots (kommt in 4b), Fokusring-Kontrast, Hex-Farbfeld ohne Namen, `npm audit`, Teil 3. Falls dadurch der Abschnittskopf nicht mehr „Teil 4“ erwähnt, den Satz anpassen („Teil 4 (nur noch Anleitungs-Screenshots)“). 11.13 (Tagged-PDF) unverändert.

- [ ] **Step 5: Use-Case-Übersicht** — in der UC6-Zeile (Tabelle ~Zeile 95) die Testabsicherungsspalte `🟡 teilweise (PDF/HTML)` um die neuen Tests ergänzen, in der Form `✅ (JSON) / 🟡 teilweise (PDF/HTML: Drift-/Registrierungs-/ZIP-Tests, E2E-Downloads)`; im Slice-Abschnitt zu UC6 (ab ~Zeile 372) einen Satz zur PDF/HTML-Optik und zu den Tests ergänzen. Kritikalität bleibt unverändert (UC6 PDF/HTML ⚪). N2 (Anleitung) wird in 4b angefasst, hier nicht.

- [ ] **Step 6: Commit**

```bash
git add docs/architecture/arc42/08-querschnittliche-konzepte.md docs/architecture/arc42/09-architekturentscheidungen.md docs/architecture/arc42/11-risiken-und-technische-schulden.md docs/use-cases-und-kritikalitaet.md
git commit -m "docs: document export palette, fonts and ADR-12"
```

### Task 11: Übergabe (nur auf ausdrückliche Freigabe)

- [ ] **Step 1: Nicht ausführen, bevor die Nutzerin/der Nutzer es freigibt.** Danach:

```bash
git push -u origin feat/dss-pdf-html
gh pr create --base main --title "feat: PDF- und HTML-Export im DSS-Design" --body "<Inhalt, Test, Hinweise; Sichtprüfung der PDFs; endet mit der 🤖-Zeile>"
```

Das PR enthält Spec und Plan, die Sichtprüfungs-Ergebnisse (Größen vorher/nachher, Seitenzahlen, `pdffonts`) und den Hinweis auf die Betonung als Halbfett. Der Merge liegt bei der Nutzerin/beim Nutzer (Ruleset verlangt ein Review).

---

## Self-Review (gegen den Spec, Abschnitt 4a)

- **Farben/Rollen und Drift-Test:** Tasks 1, 2 (acht Rollen, Drift gegen `tokens.css`, `oklch.ts` mit Referenzwerten); Amber nie als Text (Task 4: nur Linie/Fläche).
- **Schriften:** Task 3 (`pdf-fonts.ts`, Registrierungstest, Render-Probe, Test-Helfer), Task 5 (Aufruf vor jedem Download), Abweichungen 1 und 2 (Gewichte, kein Italic) dokumentiert.
- **Tabellenkopf hell mit Amber-Linie, Titel ohne Uppercase:** Task 4 (Stile, `PageTitle`, Test auf fehlendes `textTransform`).
- **HTML-Export mit WOFF2 in der ZIP:** Task 6 (Palette, `@font-face`, ZIP-Test, Browser-Prüfung).
- **Standard-Teamfarbe:** Task 7 (`#00569d` = Sky-700, Referenzwert aus Tabelle); E2E-Fixture mit umgestellt.
- **Guard-Test verschärft:** Task 8 (Hex-Farben und `'Aller'` case-insensitiv, enge Form).
- **Tests laut Spec:** Drift-Test, Registrierungstest, ZIP-Test, `oklch`-Tests, bestehende Render-/E2E-Download-Tests (Task 4–5, 9).
- **Doku laut `AGENTS.md`:** arc42 08 (8.14), 09 (ADR-12), 11 (11.14), Use-Case-Übersicht UC6 (Task 10); A11y-Liste unverändert (keine neue Route/kein neuer UI-Zustand).
- **Risiken aus dem Spec:** Seitenumbrüche und Dateigröße → Task 9 (Seitenzahlen, Größen, `pdffonts`, Bildansicht); Schriftformat → Task 3 (WOFF-Dateien verifiziert, kein stiller Rückfall: fehlt eine Datei, scheitert der Vite-Import beim Build).
- **Typkonsistenz:** `exportColors`/`pdfColors` (Alias) mit den Schlüsseln `text, textMuted, tableHeaderBg, tableHeaderText, accent, zebra, border, white` in Theme, Tests, `PageTitle`, HTML-Export; `registerPdfFonts(transformUrl?)`/`registerPdfFontsForTests()`; `HTML_EXPORT_FONTS` (`family, weight, fileName, url`) in Export und Test; `createHtmlZip(tournament, schedule, fonts)` liefert `Uint8Array`.
- **Platzhalter-Scan:** Die einzigen bewusst offenen Stellen sind (a) die Fallback-Reihenfolge für das Laden der Test-Schrift (Task 3 Step 3, mit konkreten drei Varianten) und (b) die Browser-Prüfung des HTML-Downloads (Task 6 Step 3, Button-Beschriftung genannt). Beide sind Verifikationsschritte mit eindeutiger Anweisung, keine fehlenden Inhalte.
