# DSS-Migration Teil 3a-1 (DSS-Repo, Version 0.8.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das DSS-Repo liefert in Version 0.8.0 sechs weitere Komponenten (Table, TopBar, EmptyState, Stepper, AppNav, Checkbox) jeweils als Svelte, Vanilla-CSS und React, mit gemeinsamer CSS-Quelle in `css/components.css`.

**Architecture:** Das Scoped-CSS der vier bestehenden Svelte-Komponenten (Table, TopBar, EmptyState, Stepper) wandert nach `css/components.css` (`dss-*`-Klassen, `--dss-*`-Aliase), die Svelte-Dateien verlieren ihr `<style>`. Zwei Svelte-Komponenten sind neu (AppNav, Checkbox). React-Komponenten folgen den Mustern von `react/Tabs.tsx` und `react/TextInput.tsx`. Bereits vom Vereinsregister genutzte Klassen (`.dss-topbar`, `.dss-empty`, `.dss-tbl`, `.dss-frame`) werden nur additiv erweitert (Modifier-Klassen), nie verändert. Ein Storybook-Screenshot-Vergleich vorher/nachher fängt visuelle Regressionen der Svelte-Komponenten ab.

**Tech Stack:** Svelte 5.55 (Runes), React 18, TypeScript 5.8, Vitest 4 + jsdom + Testing Library + axe-core, tsup, Storybook 10 (svelte-vite), Playwright 1.63 (nur für den Screenshot-Vergleich), ImageMagick (`magick compare`).

**Arbeitsverzeichnis für alle Tasks:** das lokale DSS-Klon `~/01-vibe-coding/00-Basektball/dss-design-system` (Branch `main`, sauber, `node_modules` vorhanden). Alle Befehle laufen dort. Kein Push, kein PR, kein Merge ohne ausdrückliche Rückfrage bei der Nutzerin/dem Nutzer.

**Referenzen:** Spec `docs/superpowers/specs/2026-10-06-dss-migration-teil3-design.md` (App-Repo). Bestehende Muster: `react/Tabs.tsx`, `react/TextInput.tsx`, `react/Banner.tsx`, `react/*.test.tsx`, `tests/parity.test.ts`, `tests/components-css.test.ts`.

**Konventionen (aus dem Bestand, einhalten):**
- Klassen immer `dss-*`; Modifier `dss-x--variant`; Zustände `is-active|is-open|is-disabled`.
- Farben, die im Dark-Modus wechseln sollen, laufen über `--dss-*`-Aliase; rein dunkle Flächen (TopBar, dunkler Table-Frame) nutzen die Roh-Tokens wie die Svelte-Vorlage.
- React-Komponenten: benannte Exporte, `cn()` aus `./cn`, deutsche Texte für Screenshot-/Screenreader-Strings, `forwardRef` bei Formularelementen, jeder Test endet mit `expectNoA11yViolations`.
- Commit-Footer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (zweites `-m`).
- Das Wort `innerHTML` darf in keiner Datei vorkommen (Security-Hook); DOM in Tests per `DOMParser` + `importNode` aufbauen.

---

## Datei-Übersicht

| Datei | Aktion | Verantwortung |
|---|---|---|
| `scripts/visual-compare.mjs` | neu | Storybook bauen, Screenshots vor/nach, `magick compare` |
| `stories/EmptyState.stories.ts`, `stories/components/EmptyStateDemo.svelte` | neu | Story für die Baseline und spätere Doku |
| `stories/Checkbox.stories.ts`, `stories/components/CheckboxDemo.svelte` | neu | Story |
| `stories/AppNav.stories.ts`, `stories/components/AppNavDemo.svelte` | neu | Story |
| `css/components.css` | erweitern | Abschnitt „v0.8“ mit Checkbox, Table, TopBar, EmptyState, Stepper, AppNav |
| `svelte/Table.svelte`, `TopBar.svelte`, `EmptyState.svelte`, `Stepper.svelte` | umschreiben | `<style>` entfernt, nur `dss-*`-Klassen |
| `svelte/Checkbox.svelte`, `svelte/AppNav.svelte` | neu | |
| `react/Checkbox.tsx`, `Table.tsx`, `TopBar.tsx`, `EmptyState.tsx`, `Stepper.tsx`, `AppNav.tsx` (+ `.test.tsx`) | neu | |
| `react/index.ts` | erweitern | Exporte |
| `js/appnav.js`, `tests/appnav.test.ts` | neu | Vanilla-Verhalten der AppNav |
| `parity.manifest.json`, `tests/parity.test.ts`, `tests/components-css.test.ts` | erweitern | Parität, CSS-Klassen-Pflichtliste |
| `package.json`, `package-lock.json`, `README.md`, `CHANGELOG.md`, `.gitignore` | ändern | Version 0.8.0, Exporte, Doku |

---

### Task 0: Branch anlegen

**Files:** keine

- [ ] **Step 1: Sauberen Stand prüfen und Branch erzeugen**

```bash
cd ~/01-vibe-coding/00-Basektball/dss-design-system
git status --short          # erwartet: leer
git fetch origin -q && git switch main && git pull --ff-only
git switch -c feat/v0.8.0
```

Expected: `Switched to a new branch 'feat/v0.8.0'`.

- [ ] **Step 2: Grundlinie der Tests**

Run: `npm test 2>&1 | tail -6 && npm run typecheck`
Expected: alle Tests grün, `tsc` ohne Ausgabe.

---

### Task 1: Visuelle Baseline (Screenshot-Tooling + EmptyState-Story, „vorher“-Aufnahme)

Die Svelte-Komponenten Table, TopBar, EmptyState, Stepper verlieren in den Tasks 3–6 ihr Scoped-CSS. Vorher werden Referenz-Screenshots aus dem gebauten Storybook erzeugt.

**Files:**
- Create: `scripts/visual-compare.mjs`, `stories/components/EmptyStateDemo.svelte`, `stories/EmptyState.stories.ts`
- Modify: `package.json` (devDependency + Scripts), `.gitignore`

- [ ] **Step 1: Playwright als devDependency**

```bash
npm install --save-dev playwright@^1.63.0
ls ~/Library/Caches/ms-playwright | grep -E "chromium(_headless_shell)?-1243"
```

Expected: beide Browser-Ordner vorhanden (aus dem App-Repo gecacht). Fehlt einer: `npx playwright install chromium`.

- [ ] **Step 2: `.gitignore` ergänzen**

An das Ende von `.gitignore` anhängen:

```
# Visueller Vergleich (Task 1/8)
.visual/
```

- [ ] **Step 3: EmptyState-Demo und Story schreiben**

`stories/components/EmptyStateDemo.svelte`:

```svelte
<script lang="ts">
  import EmptyState from '../../svelte/EmptyState.svelte';

  let { tone = 'neutral' }: { tone?: 'neutral' | 'action' | 'error' } = $props();

  const content = {
    neutral: { title: 'Noch keine Spiele', body: 'Sobald ein Spielplan existiert, erscheinen die Partien hier.' },
    action: { title: 'Zeitplan fehlt', body: 'Erzeuge zuerst einen Zeitplan, um Ergebnisse zu erfassen.', cta: 'Zeitplan erzeugen' },
    error: { title: 'Laden fehlgeschlagen', body: 'Die Daten konnten nicht geladen werden.', cta: 'Erneut versuchen' },
  } as const;
</script>

<div style="padding: 24px;">
  <EmptyState {tone} {...content[tone]} />
</div>
```

`stories/EmptyState.stories.ts`:

```ts
import EmptyStateDemo from './components/EmptyStateDemo.svelte';

export default {
  title: 'Components/EmptyState',
  component: EmptyStateDemo,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
**EmptyState** — Leer-, Hinweis- und Fehlerzustände mit klarem nächsten Schritt.

- **neutral** — keine Daten / Erstnutzung
- **action** — etwas fehlt, die Nutzerin kann es beheben (Amber)
- **error** — Laden fehlgeschlagen, Wiederholen möglich (Rot)
        `.trim(),
      },
    },
  },
  argTypes: { tone: { control: 'inline-radio', options: ['neutral', 'action', 'error'] } },
  args: { tone: 'neutral' },
};

export const Neutral = { args: { tone: 'neutral' } };
export const Action = { args: { tone: 'action' } };
export const Error = { args: { tone: 'error' } };
```

In `.storybook/preview.ts` die `storySort`-Liste unter `'Components'` um `'EmptyState'` erweitern (nach `'Table'`).

- [ ] **Step 4: Vergleichsskript schreiben**

`scripts/visual-compare.mjs`:

```js
#!/usr/bin/env node
/**
 * Visueller Vorher/Nachher-Vergleich der Svelte-Stories (Storybook-Static).
 *
 *   node scripts/visual-compare.mjs capture before   # baut Storybook, speichert .visual/before/*.png
 *   node scripts/visual-compare.mjs capture after
 *   node scripts/visual-compare.mjs compare          # magick compare, Diffs nach .visual/diff/
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const ROOT = new URL('../', import.meta.url).pathname;
const STATIC_DIR = join(ROOT, 'storybook-static');
const OUT = join(ROOT, '.visual');
const TITLES = ['Components/Table', 'Components/Navigation', 'Components/EmptyState'];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png' };

function serveStatic() {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    const file = join(STATIC_DIR, path === '/' ? 'index.html' : path);
    if (!existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(await readFile(file));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function capture(label) {
  execFileSync('npx', ['storybook', 'build', '-o', 'storybook-static', '--quiet'], { cwd: ROOT, stdio: 'inherit' });
  const index = JSON.parse(await readFile(join(STATIC_DIR, 'index.json'), 'utf8'));
  const ids = Object.values(index.entries).filter((e) => e.type === 'story' && TITLES.includes(e.title)).map((e) => e.id);
  if (ids.length === 0) throw new Error('Keine Stories gefunden');

  const dir = join(OUT, label);
  await mkdir(dir, { recursive: true });
  const server = await serveStatic();
  const { port } = server.address();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 1 });
    for (const id of ids) {
      await page.goto(`http://127.0.0.1:${port}/iframe.html?id=${id}&viewMode=story`, { waitUntil: 'networkidle' });
      await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: join(dir, `${id}.png`), fullPage: true });
      console.log(`  ${label}/${id}.png`);
    }
  } finally {
    await browser.close();
    server.close();
  }
}

async function compare() {
  const beforeDir = join(OUT, 'before');
  const afterDir = join(OUT, 'after');
  const diffDir = join(OUT, 'diff');
  await mkdir(diffDir, { recursive: true });
  let changed = 0;
  for (const file of (await readdir(beforeDir)).filter((f) => f.endsWith('.png'))) {
    const result = spawnSync('magick', ['compare', '-metric', 'AE', join(beforeDir, file), join(afterDir, file), join(diffDir, file)], { encoding: 'utf8' });
    const detail = (result.stderr || '').trim();
    const differing = result.status === 0 ? 0 : result.status === 1 ? Number.parseInt(detail, 10) : -1;
    if (differing !== 0) changed++;
    console.log(`${differing === 0 ? 'gleich   ' : differing < 0 ? 'GRÖSSE   ' : 'ABWEICHT '} ${file}${differing > 0 ? `  (${differing} px)` : ''}${differing < 0 ? `  ${detail}` : ''}`);
  }
  console.log(changed === 0 ? '\nKeine Abweichungen.' : `\n${changed} Abweichung(en) — Diffs in .visual/diff/, einzeln bewerten.`);
}

const [mode, label] = process.argv.slice(2);
if (mode === 'capture' && (label === 'before' || label === 'after')) await capture(label);
else if (mode === 'compare') await compare();
else { console.error('Aufruf: visual-compare.mjs capture <before|after> | compare'); process.exit(2); }
```

- [ ] **Step 5: Scripts in `package.json` eintragen**

Im Block `"scripts"` ergänzen:

```json
    "visual:before": "node scripts/visual-compare.mjs capture before",
    "visual:after": "node scripts/visual-compare.mjs capture after",
    "visual:compare": "node scripts/visual-compare.mjs compare",
```

- [ ] **Step 6: Baseline aufnehmen**

Run: `npm run visual:before 2>&1 | tail -20`
Expected: Storybook-Build ohne Fehler, danach Zeilen `before/components-table--….png`, `before/components-navigation--….png`, `before/components-emptystate--….png` (mindestens 9 Dateien). Prüfen: `ls .visual/before | wc -l`.

- [ ] **Step 7: Mindestens zwei Aufnahmen ansehen**

Ein Table- und ein Navigation-PNG per Read-Tool öffnen. Expected: Komponenten sichtbar und gestaltet (kein leerer Canvas, keine Storybook-Fehlerseite). Sonst Skript fixen (z. B. längeres Warten), bevor es weitergeht.

- [ ] **Step 8: Commit**

```bash
git add scripts/visual-compare.mjs stories/EmptyState.stories.ts stories/components/EmptyStateDemo.svelte .storybook/preview.ts package.json package-lock.json .gitignore
git commit -m "test: add storybook screenshot compare tooling and EmptyState story" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Checkbox (CSS + Svelte + React)

**Files:**
- Modify: `css/components.css`, `parity.manifest.json`, `tests/parity.test.ts`, `tests/components-css.test.ts`, `react/index.ts`
- Create: `svelte/Checkbox.svelte`, `react/Checkbox.tsx`, `react/Checkbox.test.tsx`, `stories/components/CheckboxDemo.svelte`, `stories/Checkbox.stories.ts`

- [ ] **Step 1: Failing test schreiben**

`react/Checkbox.test.tsx`:

```tsx
import { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Checkbox } from './Checkbox';
import { expectNoA11yViolations } from './test-utils';

describe('Checkbox', () => {
  it('ist über das Label als checkbox auffindbar und schaltet per Klick', () => {
    const onChange = vi.fn();
    render(<Checkbox label="Mit Rückspiel" onChange={onChange} />);
    const box = screen.getByRole('checkbox', { name: 'Mit Rückspiel' });
    expect(box).not.toBeChecked();
    fireEvent.click(screen.getByText('Mit Rückspiel'));
    expect(box).toBeChecked();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('ist kontrolliert über checked', () => {
    const { rerender } = render(<Checkbox label="A" checked={false} onChange={() => {}} />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    rerender(<Checkbox label="A" checked onChange={() => {}} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('verknüpft den Hinweistext per aria-describedby', () => {
    render(<Checkbox label="Mit Rückspiel" hint="Jede Paarung wird zweimal gespielt." />);
    expect(screen.getByRole('checkbox')).toHaveAccessibleDescription('Jede Paarung wird zweimal gespielt.');
  });

  it('setzt Dichte- und Disabled-Klassen', () => {
    const { container } = render(<Checkbox label="A" density="compact" disabled />);
    expect(container.querySelector('label')).toHaveClass('dss-check', 'dss-check--compact', 'is-disabled');
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('reicht die ref an das input durch', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Checkbox label="A" ref={ref} />);
    expect(ref.current).toBe(screen.getByRole('checkbox'));
  });

  it('hat keine A11y-Verstöße', async () => {
    const { container } = render(<Checkbox label="Mit Rückspiel" hint="Hinweis" />);
    await expectNoA11yViolations(container);
  });
});
```

- [ ] **Step 2: Test laufen lassen (rot)**

Run: `npx vitest run react/Checkbox.test.tsx`
Expected: FAIL (`Failed to resolve import "./Checkbox"`).

- [ ] **Step 3: CSS-Abschnitt „v0.8“ anlegen**

An das Ende von `css/components.css` anhängen:

```css

/* ══════════════════════════════════════════════════════════════
   v0.8 · Checkbox, Tabelle (aus Svelte extrahiert), TopBar dark,
   EmptyState-Tonalitäten, Stepper, AppNav
   Bereits genutzte Klassen (.dss-tbl, .dss-frame, .dss-topbar,
   .dss-empty) werden nur ergänzt, nie verändert.
   ══════════════════════════════════════════════════════════════ */

/* ── Checkbox ───────────────────────────────────────────────── */
.dss-check {
  display: inline-flex; align-items: center; gap: 10px; min-height: var(--fld-h-default);
  cursor: pointer; font-family: var(--font-body); font-size: 14px; color: var(--dss-fg);
}
.dss-check--compact { min-height: var(--fld-h-compact); }
.dss-check.is-disabled { cursor: not-allowed; opacity: 0.5; }
.dss-check-input {
  appearance: none; -webkit-appearance: none; flex-shrink: 0; margin: 0; width: 22px; height: 22px;
  display: grid; place-content: center; cursor: inherit;
  border: 2px solid var(--dss-mute); border-radius: 6px; background: var(--dss-surface);
  transition: background 0.12s, border-color 0.12s;
}
.dss-check-input::after {
  content: ''; width: 6px; height: 11px; border: solid var(--dss-btn-fg); border-width: 0 2.5px 2.5px 0;
  transform: translateY(-1px) rotate(45deg) scale(0); transition: transform 0.1s;
}
.dss-check-input:checked { background: var(--dss-btn-bg); border-color: var(--dss-btn-bg); }
.dss-check-input:checked::after { transform: translateY(-1px) rotate(45deg) scale(1); }
.dss-check-input:focus-visible { outline: var(--ring-w) solid var(--ring-color); outline-offset: 2px; }
.dss-check-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dss-check-label { font-weight: 500; line-height: 1.3; }
.dss-check-hint { font-size: 12px; line-height: 1.4; color: var(--dss-mute); }
```

- [ ] **Step 4: React-Komponente**

`react/Checkbox.tsx`:

```tsx
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

export type CheckboxDensity = 'default' | 'compact';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label: ReactNode;
  /** Erklärender Zusatztext unter dem Label (wird per aria-describedby verknüpft). */
  hint?: ReactNode;
  density?: CheckboxDensity;
}

/** Natives Kontrollkästchen im DSS-Look; die Klickfläche ist das gesamte Label (≥ 44 px, kompakt 36 px). */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, hint, density = 'default', className, id, disabled, 'aria-describedby': describedByProp, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const describedBy = [describedByProp, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <label
      htmlFor={inputId}
      className={cn('dss-check', density === 'compact' && 'dss-check--compact', disabled && 'is-disabled')}
    >
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className={cn('dss-check-input', className)}
        disabled={disabled}
        aria-describedby={describedBy}
        {...rest}
      />
      <span className="dss-check-text">
        <span className="dss-check-label">{label}</span>
        {hint ? (
          <span id={hintId} className="dss-check-hint">
            {hint}
          </span>
        ) : null}
      </span>
    </label>
  );
});
```

In `react/index.ts` anhängen:

```ts
export { Checkbox, type CheckboxProps, type CheckboxDensity } from './Checkbox';
```

- [ ] **Step 5: Svelte-Komponente**

`svelte/Checkbox.svelte`:

```svelte
<script lang="ts" module>
  let seq = 0;
</script>

<script lang="ts">
  /**
   * DSS Checkbox · Svelte 5
   * --------------------------------------------------------------
   * Natives Kontrollkästchen im DSS-Look. Die Klickfläche ist das
   * gesamte Label (≥ 44 px, `density="compact"` 36 px). Nutzt nur
   * die Klassen aus css/components.css.
   */
  let {
    label,
    hint = '',
    checked = $bindable(false),
    disabled = false,
    density = 'default',
    id = undefined,
    name = undefined,
    onchange = undefined,
  }: {
    label: string;
    hint?: string;
    checked?: boolean;
    disabled?: boolean;
    density?: 'default' | 'compact';
    id?: string;
    name?: string;
    onchange?: (checked: boolean) => void;
  } = $props();

  const autoId = `dss-check-${++seq}`;
  const inputId = $derived(id ?? autoId);
</script>

<label
  for={inputId}
  class="dss-check"
  class:dss-check--compact={density === 'compact'}
  class:is-disabled={disabled}
>
  <input
    id={inputId}
    {name}
    type="checkbox"
    class="dss-check-input"
    bind:checked
    {disabled}
    aria-describedby={hint ? `${inputId}-hint` : undefined}
    onchange={() => onchange?.(checked)}
  />
  <span class="dss-check-text">
    <span class="dss-check-label">{label}</span>
    {#if hint}<span id={`${inputId}-hint`} class="dss-check-hint">{hint}</span>{/if}
  </span>
</label>
```

- [ ] **Step 6: Story**

`stories/components/CheckboxDemo.svelte`:

```svelte
<script lang="ts">
  import Checkbox from '../../svelte/Checkbox.svelte';

  let { density = 'default', disabled = false }: { density?: 'default' | 'compact'; disabled?: boolean } = $props();
  let withReturn = $state(true);
  let seeded = $state(false);
</script>

<div style="padding: 24px; display: flex; flex-direction: column; gap: 8px; max-width: 420px;">
  <Checkbox label="Mit Rückspiel" hint="Jede Paarung wird zweimal gespielt." bind:checked={withReturn} {density} {disabled} />
  <Checkbox label="Teams setzen" bind:checked={seeded} {density} {disabled} />
</div>
```

`stories/Checkbox.stories.ts`:

```ts
import CheckboxDemo from './components/CheckboxDemo.svelte';

export default {
  title: 'Components/Checkbox',
  component: CheckboxDemo,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Natives Kontrollkästchen im DSS-Look. Die gesamte Label-Fläche ist klickbar (≥ 44 px). Optionaler Hinweistext wird per `aria-describedby` verknüpft.',
      },
    },
  },
  argTypes: { density: { control: 'inline-radio', options: ['default', 'compact'] }, disabled: { control: 'boolean' } },
  args: { density: 'default', disabled: false },
};

export const Default = {};
export const Kompakt = { args: { density: 'compact' } };
export const Deaktiviert = { args: { disabled: true } };
```

In `.storybook/preview.ts` `'Checkbox'` in die `storySort`-Liste einfügen (nach `'Select'`).

- [ ] **Step 7: Parität und CSS-Pflichtliste**

`parity.manifest.json`: vor der schließenden `}` (Komma an der Icon-Zeile ergänzen) einfügen:

```json
  "Checkbox":  { "svelte": "svelte/Checkbox.svelte",  "react": "react/Checkbox.tsx",  "css": ["dss-check", "dss-check--compact", "dss-check-input", "dss-check-label", "dss-check-hint"] }
```

`tests/components-css.test.ts`: in `REQUIRED` vor `// Icon` ergänzen:

```ts
  // Checkbox (v0.8)
  'dss-check', 'dss-check--compact', 'dss-check-input', 'dss-check-text', 'dss-check-label', 'dss-check-hint',
```

- [ ] **Step 8: Alles prüfen**

Run: `npx vitest run && npm run typecheck`
Expected: Checkbox-Tests und Paritätstests grün (`Parität: Checkbox` 7 Fälle), `tsc` ohne Ausgabe.

- [ ] **Step 9: Commit**

```bash
git add css/components.css svelte/Checkbox.svelte react/Checkbox.tsx react/Checkbox.test.tsx react/index.ts parity.manifest.json tests stories .storybook/preview.ts
git commit -m "feat: add Checkbox (css, svelte, react)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Table (CSS-Extraktion + Svelte + React)

**Files:**
- Modify: `css/components.css`, `svelte/Table.svelte`, `parity.manifest.json`, `tests/parity.test.ts`, `tests/components-css.test.ts`, `react/index.ts`
- Create: `react/Table.tsx`, `react/Table.test.tsx`

- [ ] **Step 1: Failing test schreiben**

`react/Table.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Table, type TableColumn } from './Table';
import { expectNoA11yViolations } from './test-utils';

const COLUMNS: TableColumn[] = [
  { key: 'team', label: 'Team' },
  { key: 'pts', label: 'Punkte', align: 'right', sortable: true, sort: 'desc' },
  { key: 'dif', label: 'Diff', align: 'center', width: '80px' },
];

const ROWS = (
  <tr>
    <td>Alpha</td>
    <td className="num">12</td>
    <td className="center">+4</td>
  </tr>
);

describe('Table', () => {
  it('rendert Kopfbereich mit Titel, Meta und Live-Marke', () => {
    const { container } = render(
      <Table title="Tabelle" meta="Gruppe A" live columns={COLUMNS}>
        {ROWS}
      </Table>,
    );
    expect(screen.getByRole('heading', { name: 'Tabelle', level: 3 })).toBeInTheDocument();
    expect(container.querySelector('.dss-frame-meta')).toHaveTextContent('Gruppe A');
    expect(container.querySelector('.dss-crumb')).toHaveTextContent('Live');
  });

  it('nutzt die gewünschte Überschriftenebene', () => {
    render(
      <Table title="Tabelle" titleAs="h2" columns={COLUMNS}>
        {ROWS}
      </Table>,
    );
    expect(screen.getByRole('heading', { name: 'Tabelle', level: 2 })).toBeInTheDocument();
  });

  it('rendert ohne Titel, Meta und Live keinen Kopfbereich', () => {
    const { container } = render(<Table columns={COLUMNS}>{ROWS}</Table>);
    expect(container.querySelector('.dss-frame-head')).toBeNull();
  });

  it('setzt Spalten-Ausrichtung, Breite und aria-sort', () => {
    render(<Table columns={COLUMNS}>{ROWS}</Table>);
    const pts = screen.getByRole('columnheader', { name: 'Punkte' });
    expect(pts).toHaveClass('right', 'sortable', 'sort-desc');
    expect(pts).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getByRole('columnheader', { name: 'Diff' })).toHaveStyle({ width: '80px' });
    expect(screen.getByRole('columnheader', { name: 'Team' })).not.toHaveAttribute('aria-sort');
  });

  it('setzt Dichte, Striping und dunkle Fläche', () => {
    const { container } = render(
      <Table density="dense" striped dark columns={COLUMNS}>
        {ROWS}
      </Table>,
    );
    expect(container.firstElementChild).toHaveClass('dss-frame', 'dss-frame--dark');
    expect(container.querySelector('table')).toHaveClass('dss-tbl', 'dss-tbl--dense', 'dss-tbl--striped');
  });

  it('rendert tfoot und gibt der Tabelle über caption einen Namen', () => {
    const { container } = render(
      <Table caption="Tabellenstand" columns={COLUMNS} foot={<tr><td>Summe</td><td className="num">12</td><td /></tr>}>
        {ROWS}
      </Table>,
    );
    expect(screen.getByRole('table', { name: 'Tabellenstand' })).toBeInTheDocument();
    expect(container.querySelector('tfoot')).toHaveTextContent('Summe');
  });

  it('hat keine A11y-Verstöße', async () => {
    const { container } = render(
      <Table title="Tabelle" caption="Tabellenstand" columns={COLUMNS}>
        {ROWS}
      </Table>,
    );
    await expectNoA11yViolations(container);
  });
});
```

- [ ] **Step 2: Test laufen lassen (rot)**

Run: `npx vitest run react/Table.test.tsx`
Expected: FAIL (`Failed to resolve import "./Table"`).

- [ ] **Step 3: CSS ergänzen**

An das Ende von `css/components.css` anhängen:

```css

/* ── Tabelle · Rahmenkopf, Dichten, Sortierung, Footer, Dark ── */
.dss-frame--dark { background: var(--n-1000); border-color: var(--n-800); color: var(--n-100); }
.dss-frame-head {
  display: flex; justify-content: space-between; align-items: center; padding: 16px 22px;
  border-bottom: 1px solid var(--dss-line); background: var(--dss-hover-bg);
}
.dss-frame--dark .dss-frame-head { background: var(--n-950); border-color: var(--n-800); }
.dss-frame-title { margin: 0; font-family: var(--font-display); font-weight: 600; font-size: 16px; color: inherit; letter-spacing: -0.005em; }
.dss-frame-meta {
  display: flex; gap: 14px; align-items: center; font-family: var(--font-mono); font-size: 11px;
  color: var(--dss-mute); letter-spacing: 0.06em; text-transform: uppercase;
}
.dss-frame--dark .dss-frame-meta { color: var(--n-400); }
.dss-crumb { display: inline-flex; align-items: center; gap: 6px; }
.dss-crumb-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ok-fill); animation: dss-pulse 2s infinite; }
@keyframes dss-pulse {
  0%   { box-shadow: 0 0 0 0 oklch(0.65 0.18 150 / 0.6); }
  70%  { box-shadow: 0 0 0 8px oklch(0.65 0.18 150 / 0); }
  100% { box-shadow: 0 0 0 0 oklch(0.65 0.18 150 / 0); }
}
@media (prefers-reduced-motion: reduce) { .dss-crumb-dot { animation: none; } }

.dss-tbl th { position: sticky; top: 0; z-index: 1; }
.dss-tbl th.right, .dss-tbl td.right { text-align: right; font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-weight: 500; }
.dss-tbl td.num.dim { color: var(--dss-mute); }
.dss-tbl th.sortable { cursor: pointer; user-select: none; }
.dss-tbl th.sortable::after {
  content: ''; display: inline-block; width: 0; height: 0; border: 4px solid transparent;
  border-top-color: var(--dss-mute); margin-left: 6px; vertical-align: -2px; opacity: 0.5;
}
.dss-tbl th.sort-asc::after { border-top: 0; border-bottom-color: var(--dss-fg-soft); opacity: 1; vertical-align: 1px; }
.dss-tbl th.sort-desc::after { border-top-color: var(--dss-fg-soft); opacity: 1; }
.dss-tbl--touch td { height: 60px; font-size: 15px; }
.dss-tbl--dense td { height: 32px; font-size: 13px; padding: 0 10px; }
.dss-tbl--dense th { padding: 0 10px; height: 32px; }
.dss-tbl--striped tbody tr:nth-child(even) td { background: var(--dss-hover-bg); }
.dss-tbl tfoot td {
  font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-weight: 700; color: var(--dss-fg);
  background: var(--dss-surface-2); border-top: 1px solid var(--dss-line-strong); border-bottom: 0; height: 42px;
}
.dss-frame--dark .dss-tbl th { color: var(--n-400); background: var(--n-950); border-bottom-color: var(--n-800); }
.dss-frame--dark .dss-tbl td { border-bottom-color: var(--n-800); color: var(--n-200); }
.dss-frame--dark .dss-tbl tbody tr:hover td { background: var(--n-900); }
.dss-frame--dark .dss-tbl td.num.lead { color: var(--n-50); }
.dss-frame--dark .dss-tbl th.sort-asc::after { border-bottom-color: var(--n-50); }
.dss-frame--dark .dss-tbl th.sort-desc::after { border-top-color: var(--n-50); }
.dss-frame--dark .dss-tbl--striped tbody tr:nth-child(even) td { background: var(--n-900); }
.dss-frame--dark .dss-tbl tfoot td { background: var(--n-900); color: var(--n-50); border-top-color: var(--n-700); }

/* Dekorations-Klassen für Boxscore/Roster (Trikotnummer, Position, Pille) */
.dss-tn {
  display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 10px;
  font-family: var(--font-display); font-weight: 800; font-size: 18px; letter-spacing: -0.02em;
  background: var(--n-100); color: var(--ink-900); font-variant-numeric: tabular-nums;
}
.dss-frame--dark .dss-tn { background: var(--n-800); color: var(--n-50); }
.dss-tn.heim { background: var(--team-heim, oklch(0.55 0.20 27)); color: white; }
.dss-tn.gast { background: var(--team-gast, oklch(0.55 0.18 245)); color: white; }
.dss-tn.captain { box-shadow: 0 0 0 2px var(--amber-500); }
.dss-tn.small { width: 32px; height: 32px; font-size: 13.5px; border-radius: 7px; }
.dss-player { display: flex; align-items: center; gap: 12px; }
.dss-player-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dss-player-name { font-family: var(--font-body); font-weight: 600; font-size: 14px; color: var(--dss-fg); letter-spacing: -0.005em; line-height: 1.2; }
.dss-player-meta { font-family: var(--font-mono); font-size: 10.5px; color: var(--dss-mute); letter-spacing: 0.04em; text-transform: uppercase; line-height: 1.2; }
.dss-frame--dark .dss-player-name { color: var(--n-50); }
.dss-frame--dark .dss-player-meta { color: var(--n-400); }
.dss-player.bench .dss-player-name { color: var(--dss-fg-soft); font-weight: 500; }
.dss-player.dnp .dss-player-name { color: var(--dss-mute); text-decoration: line-through; font-weight: 400; }
.dss-pos {
  display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 5px;
  font-family: var(--font-mono); font-weight: 700; font-size: 10px; background: var(--ink-100); color: var(--ink-700);
}
.dss-pos.pg { background: var(--sky-100); color: var(--sky-800); }
.dss-pos.sg { background: var(--info-soft); color: var(--info-text); }
.dss-pos.sf { background: var(--amber-100); color: var(--amber-800); }
.dss-pos.pf { background: var(--warn-soft); color: var(--warn-text); }
.dss-pos.c { background: var(--err-soft); color: var(--err-text); }
.dss-pill-s {
  display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-mono); font-size: 10px; font-weight: 600;
  padding: 3px 7px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.06em; background: var(--n-100); color: var(--n-700);
}
.dss-pill-s.on { background: var(--ok-soft); color: var(--ok-text); }
.dss-pill-s.cap { background: var(--amber-100); color: var(--amber-800); }
.dss-pill-s.dnp { background: var(--err-soft); color: var(--err-text); }
```

- [ ] **Step 4: React-Komponente**

`react/Table.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cn } from './cn';

export type TableDensity = 'touch' | 'default' | 'compact' | 'dense';

export interface TableColumn {
  key: string;
  label: ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
  sortable?: boolean;
  /** Aktuelle Sortierrichtung; setzt `aria-sort` und den Pfeil. */
  sort?: 'asc' | 'desc' | null;
}

export interface TableProps {
  title?: ReactNode;
  /** Überschriftenebene des Titels (Standard h3). */
  titleAs?: 'h2' | 'h3' | 'h4';
  meta?: ReactNode;
  live?: boolean;
  density?: TableDensity;
  dark?: boolean;
  striped?: boolean;
  /** Einfacher Kopf aus Spaltendefinitionen; alternativ `head` für eigene Kopfzeilen. */
  columns?: TableColumn[];
  head?: ReactNode;
  /** Zeilen des tbody (`<tr>`-Elemente). */
  children?: ReactNode;
  foot?: ReactNode;
  /** Unsichtbare Tabellenbeschriftung für Screenreader (wenn kein sichtbarer Titel genügt). */
  caption?: string;
  className?: string;
}

const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const;

/** Datentabelle im DSS-Rahmen (Titelzeile optional). Zellen liefert die Anwendung als `<tr>`-Kinder. */
export function Table({
  title,
  titleAs: Heading = 'h3',
  meta,
  live = false,
  density = 'default',
  dark = false,
  striped = false,
  columns,
  head,
  children,
  foot,
  caption,
  className,
}: TableProps) {
  const hasHead = Boolean(title || meta || live);
  return (
    <div className={cn('dss-frame', dark && 'dss-frame--dark', className)}>
      {hasHead ? (
        <div className="dss-frame-head">
          {title ? <Heading className="dss-frame-title">{title}</Heading> : <span />}
          <div className="dss-frame-meta">
            {meta ? <span>{meta}</span> : null}
            {live ? (
              <span className="dss-crumb">
                <span className="dss-crumb-dot" aria-hidden="true" /> Live
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="dss-table-scroll">
        <table className={cn('dss-tbl', `dss-tbl--${density}`, striped && 'dss-tbl--striped')}>
          {caption ? <caption className="dss-sr-only">{caption}</caption> : null}
          {columns ? (
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(col.align ?? 'left', col.sortable && 'sortable', col.sort && `sort-${col.sort}`)}
                    style={col.width ? { width: col.width } : undefined}
                    aria-sort={col.sort ? ARIA_SORT[col.sort] : undefined}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
          ) : null}
          {head ? <thead>{head}</thead> : null}
          <tbody>{children}</tbody>
          {foot ? <tfoot>{foot}</tfoot> : null}
        </table>
      </div>
    </div>
  );
}
```

In `react/index.ts` anhängen:

```ts
export { Table, type TableProps, type TableColumn, type TableDensity } from './Table';
```

- [ ] **Step 5: Svelte-Komponente ohne `<style>`**

`svelte/Table.svelte` komplett ersetzen:

```svelte
<script lang="ts">
  /**
   * DSS Table · Svelte 5
   * --------------------------------------------------------------
   * Datentabelle nach der Tables-Spec. Nutzt nur die Klassen aus
   * css/components.css.
   *
   * Dichten : touch (60px) · default (48px) · compact (40px) · dense (32px)
   * Flächen : hell (Standard) · dunkel (Kampfgericht-Tisch)
   * Features: sticky Kopf, Sortier-Pfeil + aria-sort, optionales Striping,
   *           tfoot-Summenzeile, Hover.
   *
   * Zellen kommen vom Aufrufer über die `rows`/`body`-Snippets. Hilfsklassen:
   *   .num · .num.lead · .num.dim · .center
   *   .dss-tn / .dss-pos / .dss-pill-s / .dss-player (Dekoration)
   */
  import type { Snippet } from 'svelte';

  type Density = 'touch' | 'default' | 'compact' | 'dense';

  let {
    title = '',
    meta = '',
    live = false,
    density = 'default',
    dark = false,
    striped = false,
    columns,
    rows,
    head = undefined,
    body,
    foot = undefined,
    class: klass = '',
  }: {
    title?: string;
    meta?: string;
    live?: boolean;
    density?: Density;
    dark?: boolean;
    striped?: boolean;
    columns?: { key: string; label: string; align?: 'left' | 'right' | 'center'; width?: string; sortable?: boolean; sort?: 'asc' | 'desc' | null }[];
    rows?: Snippet;
    head?: Snippet;
    body?: Snippet;
    foot?: Snippet;
    class?: string;
  } = $props();
</script>

<div class={`dss-frame ${dark ? 'dss-frame--dark' : ''} ${klass}`}>
  {#if title || meta || live}
    <div class="dss-frame-head">
      {#if title}<h3 class="dss-frame-title">{title}</h3>{:else}<span></span>{/if}
      <div class="dss-frame-meta">
        {#if meta}<span>{meta}</span>{/if}
        {#if live}<span class="dss-crumb"><span class="dss-crumb-dot" aria-hidden="true"></span> Live</span>{/if}
      </div>
    </div>
  {/if}

  <div class="dss-table-scroll">
    <table class={`dss-tbl dss-tbl--${density} ${striped ? 'dss-tbl--striped' : ''}`}>
      {#if columns}
        <thead>
          <tr>
            {#each columns as col (col.key)}
              <th
                scope="col"
                class={`${col.align ?? 'left'} ${col.sortable ? 'sortable' : ''} ${col.sort ? `sort-${col.sort}` : ''}`}
                style={col.width ? `width: ${col.width};` : ''}
                aria-sort={col.sort === 'asc' ? 'ascending' : col.sort === 'desc' ? 'descending' : undefined}
              >{col.label}</th>
            {/each}
          </tr>
        </thead>
      {/if}
      {#if head}<thead>{@render head()}</thead>{/if}
      {#if body || rows}<tbody>{@render (body ?? rows)?.()}</tbody>{/if}
      {#if foot}<tfoot>{@render foot()}</tfoot>{/if}
    </table>
  </div>
</div>
```

- [ ] **Step 6: Parität und CSS-Pflichtliste**

`parity.manifest.json`: Eintrag ergänzen (Komma am vorherigen Eintrag nicht vergessen):

```json
  "Table":     { "svelte": "svelte/Table.svelte",     "react": "react/Table.tsx",     "css": ["dss-frame", "dss-frame--dark", "dss-frame-head", "dss-crumb", "dss-tbl", "dss-tbl--dense", "dss-tbl--striped"] }
```

`tests/parity.test.ts`: `'Table'` aus `PENDING_REACT` entfernen.

`tests/components-css.test.ts`: in `REQUIRED` vor `// Icon` ergänzen:

```ts
  // Table (v0.8)
  'dss-frame--dark', 'dss-frame-head', 'dss-frame-title', 'dss-frame-meta', 'dss-crumb', 'dss-crumb-dot',
  'dss-tbl--touch', 'dss-tbl--dense', 'dss-tbl--striped', 'dss-tn', 'dss-player', 'dss-pos', 'dss-pill-s',
```

- [ ] **Step 7: Tests, Typecheck, Storybook-Build**

Run: `npx vitest run && npm run typecheck`
Expected: grün.

Run: `npx storybook build -o storybook-static --quiet 2>&1 | tail -5`
Expected: Build erfolgreich, keine Svelte-Kompilierfehler in `Components/Table`.

- [ ] **Step 8: Commit**

```bash
git add css/components.css svelte/Table.svelte react/Table.tsx react/Table.test.tsx react/index.ts parity.manifest.json tests
git commit -m "feat: extract Table css and add React Table" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: TopBar (dunkle Variante: CSS-Extraktion + Svelte + React)

Konflikt: `.dss-topbar` existiert bereits als helle Vereinsregister-Leiste. Die dunkle App-Leiste bekommt `.dss-topbar--dark` (Selektor `.dss-topbar.dss-topbar--dark` schlägt die Basis-Regel), alle Innenklassen werden mit `dss-topbar-` präfixiert.

**Files:**
- Modify: `css/components.css`, `svelte/TopBar.svelte`, `parity.manifest.json`, `tests/parity.test.ts`, `tests/components-css.test.ts`, `react/index.ts`
- Create: `react/TopBar.tsx`, `react/TopBar.test.tsx`

- [ ] **Step 1: Failing test schreiben**

`react/TopBar.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TopBar } from './TopBar';
import { expectNoA11yViolations } from './test-utils';

describe('TopBar', () => {
  it('rendert Marke und Namen, die Marke ist dekorativ', () => {
    const { container } = render(<TopBar brand="Turnier-Manager" mark="T" />);
    expect(container.firstElementChild).toHaveClass('dss-topbar', 'dss-topbar--dark');
    expect(screen.getByText('Turnier-Manager')).toBeInTheDocument();
    expect(container.querySelector('.dss-topbar-mark')).toHaveAttribute('aria-hidden', 'true');
  });

  it('zeigt im Live-Kontext Spielstand und Uhr', () => {
    const { container } = render(<TopBar context="live" matchLabel="17. Spieltag" score="87 : 64" clock="Q4 · 02:14" />);
    expect(container.querySelector('.dss-topbar-live')).toHaveTextContent('Live');
    expect(screen.getByText('87 : 64')).toBeInTheDocument();
    expect(screen.getByText('Q4 · 02:14')).toBeInTheDocument();
  });

  it('zeigt im Admin-Kontext nur das Label', () => {
    render(<TopBar context="admin" matchLabel="Vereinsregister" />);
    expect(screen.getByText('Vereinsregister')).toBeInTheDocument();
    expect(screen.queryByText('Live')).toBeNull();
  });

  it('rendert Slots und Nutzer-Chip', () => {
    render(
      <TopBar
        leading={<span>Vorne</span>}
        center={<span>Mitte</span>}
        actions={<button type="button">Aktion</button>}
        user="Stefan B."
        userInitials="SB"
      />,
    );
    expect(screen.getByText('Vorne')).toBeInTheDocument();
    expect(screen.getByText('Mitte')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aktion' })).toBeInTheDocument();
    expect(screen.getByText('Stefan B.')).toBeInTheDocument();
    expect(screen.getByText('SB')).toHaveClass('dss-topbar-av');
  });

  it('kann als header-Element gerendert werden (banner-Landmark)', () => {
    render(<TopBar as="header" brand="X" />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('hat keine A11y-Verstöße', async () => {
    const { container } = render(<TopBar as="header" brand="Turnier-Manager" mark="T" user="Anna" userInitials="A" />);
    await expectNoA11yViolations(container);
  });
});
```

- [ ] **Step 2: Test laufen lassen (rot)**

Run: `npx vitest run react/TopBar.test.tsx`
Expected: FAIL (`Failed to resolve import "./TopBar"`).

- [ ] **Step 3: CSS ergänzen**

An das Ende von `css/components.css` anhängen:

```css

/* ── TopBar · dunkle App-Leiste (Modifier, die helle Vereinsregister-Leiste bleibt) ── */
.dss-topbar.dss-topbar--dark {
  display: flex; align-items: center; height: 56px; padding: 0 20px; gap: 20px;
  background: var(--ink-1000); color: var(--n-100); border-bottom: 1px solid var(--n-900);
  font-family: var(--font-body);
}
.dss-topbar-brand {
  display: flex; align-items: center; gap: 10px; font-family: var(--font-display); font-weight: 700;
  font-size: 15px; letter-spacing: -0.01em; color: white;
}
.dss-topbar-mark {
  width: 26px; height: 26px; border-radius: 6px; background: var(--amber-400); color: var(--ink-1000);
  display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px;
}
.dss-topbar-ctx {
  display: flex; align-items: center; gap: 14px; margin-left: 28px; font-family: var(--font-mono);
  font-size: 11px; color: var(--n-300); letter-spacing: 0.04em;
}
.dss-topbar-live {
  display: inline-flex; align-items: center; gap: 6px; color: var(--err-fill); font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.1em;
}
.dss-topbar-live::before {
  content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--err-fill);
  animation: dss-tb-pulse 1.6s ease-in-out infinite;
}
@keyframes dss-tb-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
@media (prefers-reduced-motion: reduce) { .dss-topbar-live::before { animation: none; } }
.dss-topbar-score { font-weight: 700; font-size: 14px; color: white; letter-spacing: -0.01em; }
.dss-topbar-clock { color: var(--amber-300); font-weight: 700; }
.dss-topbar-center { flex: 1; display: flex; justify-content: center; }
.dss-topbar-spacer { flex: 1; }
.dss-topbar-user {
  display: flex; align-items: center; gap: 10px; padding: 5px 12px 5px 5px; border-radius: 999px;
  background: var(--n-900); color: var(--n-100); font-size: 12.5px; font-weight: 500;
}
.dss-topbar-av {
  width: 28px; height: 28px; border-radius: 50%; background: var(--sky-600); color: white;
  display: inline-flex; align-items: center; justify-content: center;
  font-family: var(--font-display); font-weight: 700; font-size: 12px;
}
```

- [ ] **Step 4: React-Komponente**

`react/TopBar.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cn } from './cn';

export type TopBarContext = 'default' | 'live' | 'admin';

export interface TopBarProps {
  brand?: string;
  /** Kurzzeichen im Amber-Quadrat (dekorativ). */
  mark?: string;
  context?: TopBarContext;
  matchLabel?: string;
  score?: string;
  clock?: string;
  user?: string;
  userInitials?: string;
  leading?: ReactNode;
  center?: ReactNode;
  actions?: ReactNode;
  /** `header` macht die Leiste zur banner-Landmark (Standard: div). */
  as?: 'header' | 'div';
  className?: string;
}

/** Dunkle App-Leiste (56 px): Marke links, optionaler Spielkontext, Aktionen rechts. */
export function TopBar({
  brand = 'DSS',
  mark = 'D',
  context = 'default',
  matchLabel = '',
  score = '',
  clock = '',
  user = '',
  userInitials = '',
  leading,
  center,
  actions,
  as: Root = 'div',
  className,
}: TopBarProps) {
  return (
    <Root className={cn('dss-topbar', 'dss-topbar--dark', className)}>
      <div className="dss-topbar-brand">
        <span className="dss-topbar-mark" aria-hidden="true">
          {mark}
        </span>
        {brand}
      </div>

      {leading}

      {center ? (
        <div className="dss-topbar-center">{center}</div>
      ) : context === 'live' ? (
        <div className="dss-topbar-ctx">
          <span className="dss-topbar-live">Live</span>
          {matchLabel ? <span>{matchLabel}</span> : null}
          {score ? <span className="dss-topbar-score">{score}</span> : null}
          {clock ? <span className="dss-topbar-clock">{clock}</span> : null}
        </div>
      ) : context === 'admin' && matchLabel ? (
        <div className="dss-topbar-ctx">
          <span>{matchLabel}</span>
        </div>
      ) : null}

      <span className="dss-topbar-spacer" />

      {actions}

      {user ? (
        <div className="dss-topbar-user">
          {userInitials ? <span className="dss-topbar-av">{userInitials}</span> : null}
          {user}
        </div>
      ) : null}
    </Root>
  );
}
```

In `react/index.ts` anhängen:

```ts
export { TopBar, type TopBarProps, type TopBarContext } from './TopBar';
```

- [ ] **Step 5: Svelte-Komponente ohne `<style>`**

`svelte/TopBar.svelte` komplett ersetzen:

```svelte
<script lang="ts">
  /**
   * DSS TopBar · Svelte 5
   * --------------------------------------------------------------
   * App-Shell-Leiste, dunkle Fläche, 56 px. Marke links, optionaler
   * Spielkontext, Aktionen rechts. Nutzt nur Klassen aus css/components.css
   * (`dss-topbar dss-topbar--dark`; die helle `.dss-topbar` bleibt dem
   * Vereinsregister).
   *
   *   default — ruhig, ohne Live-Anzeige
   *   live    — roter Puls + Spielstand + Uhr (Schiri-/Coach-App)
   *   admin   — Breadcrumb-Kontext (Vereinsregister, Einstellungen)
   */
  import type { Snippet } from 'svelte';

  let {
    brand = 'DSS',
    mark = 'D',
    context = 'default',
    matchLabel = '',
    score = '',
    clock = '',
    user = '',
    userInitials = '',
    leading,
    center,
    actions,
  }: {
    brand?: string;
    mark?: string;
    context?: 'default' | 'live' | 'admin';
    matchLabel?: string;
    score?: string;
    clock?: string;
    user?: string;
    userInitials?: string;
    leading?: Snippet;
    center?: Snippet;
    actions?: Snippet;
  } = $props();
</script>

<div class="dss-topbar dss-topbar--dark">
  <div class="dss-topbar-brand">
    <span class="dss-topbar-mark" aria-hidden="true">{mark}</span>
    {brand}
  </div>

  {#if leading}{@render leading()}{/if}

  {#if center}
    <div class="dss-topbar-center">{@render center()}</div>
  {:else if context === 'live'}
    <div class="dss-topbar-ctx">
      <span class="dss-topbar-live">Live</span>
      {#if matchLabel}<span>{matchLabel}</span>{/if}
      {#if score}<span class="dss-topbar-score">{score}</span>{/if}
      {#if clock}<span class="dss-topbar-clock">{clock}</span>{/if}
    </div>
  {:else if context === 'admin' && matchLabel}
    <div class="dss-topbar-ctx">
      <span>{matchLabel}</span>
    </div>
  {/if}

  <span class="dss-topbar-spacer"></span>

  {#if actions}{@render actions()}{/if}

  {#if user}
    <div class="dss-topbar-user">
      {#if userInitials}<span class="dss-topbar-av">{userInitials}</span>{/if}
      {user}
    </div>
  {/if}
</div>
```

- [ ] **Step 6: Parität und CSS-Pflichtliste**

`parity.manifest.json`: Eintrag ergänzen:

```json
  "TopBar":    { "svelte": "svelte/TopBar.svelte",    "react": "react/TopBar.tsx",    "css": ["dss-topbar", "dss-topbar--dark", "dss-topbar-brand", "dss-topbar-mark", "dss-topbar-user"] }
```

`tests/parity.test.ts`: `'TopBar'` aus `PENDING_REACT` entfernen.

`tests/components-css.test.ts`: in `REQUIRED` vor `// Icon` ergänzen:

```ts
  // TopBar (v0.8)
  'dss-topbar--dark', 'dss-topbar-brand', 'dss-topbar-mark', 'dss-topbar-ctx', 'dss-topbar-live',
  'dss-topbar-score', 'dss-topbar-clock', 'dss-topbar-center', 'dss-topbar-spacer', 'dss-topbar-user', 'dss-topbar-av',
```

- [ ] **Step 7: Tests und Typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: grün.

- [ ] **Step 8: Commit**

```bash
git add css/components.css svelte/TopBar.svelte react/TopBar.tsx react/TopBar.test.tsx react/index.ts parity.manifest.json tests
git commit -m "feat: extract dark TopBar css and add React TopBar" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: EmptyState (CSS-Extraktion + Svelte + React)

Konflikt: `.dss-empty` existiert als schlichter Text-Leerzustand des Vereinsregisters und bleibt unverändert. Die Karten-Optik hängt an den Tonalitäts-Modifiern `.dss-empty--neutral|action|error`. Der CTA nutzt künftig die vorhandenen `dss-btn`-Klassen (kleine, gewollte Abweichung gegenüber der alten Eigenform). Titelebene jetzt `h3` (vorher h4, per `titleAs` änderbar).

**Files:**
- Modify: `css/components.css`, `svelte/EmptyState.svelte`, `parity.manifest.json`, `tests/parity.test.ts`, `tests/components-css.test.ts`, `react/index.ts`
- Create: `react/EmptyState.tsx`, `react/EmptyState.test.tsx`

- [ ] **Step 1: Failing test schreiben**

`react/EmptyState.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from './EmptyState';
import { expectNoA11yViolations } from './test-utils';

describe('EmptyState', () => {
  it('rendert Titel und Text in neutraler Tonalität', () => {
    const { container } = render(<EmptyState title="Noch keine Spiele" body="Erzeuge zuerst einen Zeitplan." />);
    expect(container.firstElementChild).toHaveClass('dss-empty', 'dss-empty--neutral');
    expect(screen.getByRole('heading', { name: 'Noch keine Spiele', level: 3 })).toBeInTheDocument();
    expect(screen.getByText('Erzeuge zuerst einen Zeitplan.')).toBeInTheDocument();
  });

  it('setzt Tonalität und Überschriftenebene', () => {
    const { container } = render(<EmptyState tone="error" title="Fehler" titleAs="h2" />);
    expect(container.firstElementChild).toHaveClass('dss-empty--error');
    expect(screen.getByRole('heading', { name: 'Fehler', level: 2 })).toBeInTheDocument();
  });

  it('zeigt einen CTA-Button, der onCta auslöst', () => {
    const onCta = vi.fn();
    render(<EmptyState tone="action" title="Zeitplan fehlt" cta="Zeitplan erzeugen" onCta={onCta} />);
    const button = screen.getByRole('button', { name: 'Zeitplan erzeugen' });
    expect(button).toHaveClass('dss-btn', 'dss-btn--amber');
    fireEvent.click(button);
    expect(onCta).toHaveBeenCalledTimes(1);
  });

  it('rendert beliebige Aktionen und Zusatz-Inhalt', () => {
    render(
      <EmptyState title="Keine Teams" actions={<a href="/demos">Demo ansehen</a>}>
        <span>Tipp</span>
      </EmptyState>,
    );
    expect(screen.getByRole('link', { name: 'Demo ansehen' })).toBeInTheDocument();
    expect(screen.getByText('Tipp')).toBeInTheDocument();
  });

  it('rendert ein Icon aus dem Sprite, wenn icon gesetzt ist', () => {
    const { container } = render(<EmptyState title="X" icon="stats" />);
    expect(container.querySelector('.dss-empty-icon use')).toHaveAttribute('href', '#i-stats');
  });

  it('hat keine A11y-Verstöße', async () => {
    const { container } = render(<EmptyState tone="action" title="Zeitplan fehlt" body="Text" cta="Los" />);
    await expectNoA11yViolations(container);
  });
});
```

- [ ] **Step 2: Test laufen lassen (rot)**

Run: `npx vitest run react/EmptyState.test.tsx`
Expected: FAIL (`Failed to resolve import "./EmptyState"`).

- [ ] **Step 3: CSS ergänzen**

An das Ende von `css/components.css` anhängen:

```css

/* ── EmptyState · Tonalitäten (Basis .dss-empty bleibt der schlichte Text-Zustand) ── */
.dss-empty--neutral, .dss-empty--action, .dss-empty--error {
  display: flex; flex-direction: column; align-items: center; max-width: 460px; margin: 0 auto;
  padding: 40px 32px; border: 1px dashed var(--dss-line-strong); border-radius: 14px;
  background: var(--dss-surface); color: var(--dss-fg-soft); font-family: var(--font-body);
}
.dss-empty--action { border-color: var(--amber-400); background: var(--dss-chip-amber-bg); }
.dss-empty--error { border-color: var(--err-fill); background: var(--dss-chip-err-bg); }
.dss-empty-icon {
  width: 60px; height: 60px; border-radius: 50%; margin-bottom: 14px;
  display: inline-flex; align-items: center; justify-content: center;
}
.dss-empty--neutral .dss-empty-icon { background: var(--dss-surface-2); color: var(--dss-mute); }
.dss-empty--action .dss-empty-icon { background: var(--dss-surface); color: var(--dss-chip-amber-fg); }
.dss-empty--error .dss-empty-icon { background: var(--dss-surface); color: var(--dss-chip-err-fg); }
.dss-empty-title { margin: 0 0 6px; font-family: var(--font-display); font-weight: 700; font-size: 18px; color: var(--dss-fg); letter-spacing: -0.01em; }
.dss-empty-body { margin: 0 0 16px; max-width: 360px; font-size: 14px; line-height: 1.55; color: var(--dss-fg-soft); text-wrap: pretty; }
.dss-empty-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.dss-empty-extra { margin-top: 12px; font-size: 12.5px; color: var(--dss-mute); }
```

- [ ] **Step 4: React-Komponente**

`react/EmptyState.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { cn } from './cn';

export type EmptyStateTone = 'neutral' | 'action' | 'error';

export interface EmptyStateProps {
  tone?: EmptyStateTone;
  title: string;
  body?: ReactNode;
  /** Sprite-Icon; ohne Angabe ein tonalitätsabhängiges Standard-Symbol. */
  icon?: IconName;
  /** Einfacher CTA-Button; für mehrere/andere Aktionen `actions` nutzen. */
  cta?: string;
  onCta?: () => void;
  actions?: ReactNode;
  /** Überschriftenebene (Standard h3). */
  titleAs?: 'h2' | 'h3' | 'h4';
  className?: string;
  /** Zusatz-Inhalt unter den Aktionen. */
  children?: ReactNode;
}

const CTA_VARIANT = { neutral: 'primary', action: 'amber', error: 'danger' } as const;

function ToneIcon({ tone }: { tone: EmptyStateTone }) {
  const common = {
    viewBox: '0 0 24 24',
    width: 28,
    height: 28,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  };
  if (tone === 'error') {
    return (
      <svg {...common}>
        <path d="m12 4 10 17H2L12 4Z" />
        <path d="M12 10v5" />
        <circle cx="12" cy="18.2" r=".7" fill="currentColor" />
      </svg>
    );
  }
  if (tone === 'action') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5" />
        <circle cx="12" cy="16.5" r=".7" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M4 10h16" />
    </svg>
  );
}

/** Leer-, Hinweis- oder Fehlerzustand mit klarem nächsten Schritt. */
export function EmptyState({
  tone = 'neutral',
  title,
  body,
  icon,
  cta,
  onCta,
  actions,
  titleAs: Heading = 'h3',
  className,
  children,
}: EmptyStateProps) {
  return (
    <div className={cn('dss-empty', `dss-empty--${tone}`, className)}>
      <div className="dss-empty-icon">{icon ? <Icon name={icon} size={28} /> : <ToneIcon tone={tone} />}</div>
      <Heading className="dss-empty-title">{title}</Heading>
      {body ? <p className="dss-empty-body">{body}</p> : null}
      {cta || actions ? (
        <div className="dss-empty-actions">
          {cta ? (
            <button type="button" className={cn('dss-btn', 'dss-btn--md', `dss-btn--${CTA_VARIANT[tone]}`)} onClick={onCta}>
              {cta}
            </button>
          ) : null}
          {actions}
        </div>
      ) : null}
      {children ? <div className="dss-empty-extra">{children}</div> : null}
    </div>
  );
}
```

In `react/index.ts` anhängen:

```ts
export { EmptyState, type EmptyStateProps, type EmptyStateTone } from './EmptyState';
```

- [ ] **Step 5: Svelte-Komponente ohne `<style>`**

`svelte/EmptyState.svelte` komplett ersetzen:

```svelte
<script lang="ts">
  /**
   * DSS EmptyState · Svelte 5
   * --------------------------------------------------------------
   * Drei Tonalitäten für „hier ist nichts“-Zustände:
   *
   *   neutral — keine Daten / Erstnutzung (ruhig)
   *   action  — etwas fehlt, die Nutzerin kann es beheben (Amber)
   *   error   — Laden fehlgeschlagen, Wiederholen möglich (Rot)
   *
   * Immer einen nächsten Schritt anbieten (CTA, `actions` oder Hinweis).
   * Nutzt nur Klassen aus css/components.css.
   */
  import type { Snippet } from 'svelte';

  let {
    tone = 'neutral',
    title,
    body = '',
    icon = '',
    cta = '',
    onclick,
    titleAs = 'h3',
    actions,
    children,
  }: {
    tone?: 'neutral' | 'action' | 'error';
    title: string;
    body?: string;
    icon?: string; // Sprite-ID ohne #
    cta?: string;
    onclick?: () => void;
    titleAs?: 'h2' | 'h3' | 'h4';
    actions?: Snippet;
    children?: Snippet;
  } = $props();

  const ctaVariant = $derived(tone === 'error' ? 'danger' : tone === 'action' ? 'amber' : 'primary');
</script>

<div class={`dss-empty dss-empty--${tone}`}>
  <div class="dss-empty-icon">
    {#if icon}
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
        <use href={`#${icon}`}></use>
      </svg>
    {:else if tone === 'error'}
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m12 4 10 17H2L12 4Z"/><path d="M12 10v5"/><circle cx="12" cy="18.2" r=".7" fill="currentColor"/></svg>
    {:else if tone === 'action'}
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><circle cx="12" cy="16.5" r=".7" fill="currentColor"/></svg>
    {:else}
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16"/></svg>
    {/if}
  </div>
  <svelte:element this={titleAs} class="dss-empty-title">{title}</svelte:element>
  {#if body}<p class="dss-empty-body">{body}</p>{/if}
  {#if cta || actions}
    <div class="dss-empty-actions">
      {#if cta}
        <button type="button" class={`dss-btn dss-btn--md dss-btn--${ctaVariant}`} {onclick}>{cta}</button>
      {/if}
      {#if actions}{@render actions()}{/if}
    </div>
  {/if}
  {#if children}<div class="dss-empty-extra">{@render children()}</div>{/if}
</div>
```

- [ ] **Step 6: Parität und CSS-Pflichtliste**

`parity.manifest.json`: Eintrag ergänzen:

```json
  "EmptyState": { "svelte": "svelte/EmptyState.svelte", "react": "react/EmptyState.tsx", "css": ["dss-empty", "dss-empty--neutral", "dss-empty--action", "dss-empty--error", "dss-empty-icon", "dss-empty-title"] }
```

`tests/parity.test.ts`: `'EmptyState'` aus `PENDING_REACT` entfernen.

`tests/components-css.test.ts`: in `REQUIRED` vor `// Icon` ergänzen:

```ts
  // EmptyState (v0.8)
  'dss-empty--neutral', 'dss-empty--action', 'dss-empty--error', 'dss-empty-icon', 'dss-empty-title',
  'dss-empty-body', 'dss-empty-actions', 'dss-empty-extra',
```

- [ ] **Step 7: Tests und Typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: grün.

- [ ] **Step 8: Commit**

```bash
git add css/components.css svelte/EmptyState.svelte react/EmptyState.tsx react/EmptyState.test.tsx react/index.ts parity.manifest.json tests
git commit -m "feat: extract EmptyState css and add React EmptyState" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Stepper (CSS-Extraktion + Svelte + React)

Die Innenklassen (`step`, `dot`, `label`, `line` …) werden mit `dss-step-` präfixiert, Zustände heißen `is-done|is-current|is-pending`. Der Schritt-Punkt ist nur dann ein Button, wenn `onStep` gesetzt ist und der Schritt nicht `pending` ist; sonst ein `span`. Der Zustand wird zusätzlich per sr-only-Text und `aria-current="step"` angesagt.

**Files:**
- Modify: `css/components.css`, `svelte/Stepper.svelte`, `parity.manifest.json`, `tests/parity.test.ts`, `tests/components-css.test.ts`, `react/index.ts`
- Create: `react/Stepper.tsx`, `react/Stepper.test.tsx`

- [ ] **Step 1: Failing test schreiben**

`react/Stepper.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Stepper, type StepItem } from './Stepper';
import { expectNoA11yViolations } from './test-utils';

const STEPS: StepItem[] = [
  { id: 'r1', label: 'Runde 1', state: 'done' },
  { id: 'r2', label: 'Runde 2', description: 'läuft', state: 'current' },
  { id: 'r3', label: 'Runde 3', state: 'pending' },
];

describe('Stepper', () => {
  it('rendert eine geordnete Liste mit aria-current auf dem aktuellen Schritt', () => {
    render(<Stepper steps={STEPS} ariaLabel="Turnierrunden" />);
    expect(screen.getByRole('list', { name: 'Turnierrunden' })).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[0]).not.toHaveAttribute('aria-current');
  });

  it('sagt den Zustand jedes Schritts für Screenreader an', () => {
    render(<Stepper steps={STEPS} />);
    expect(screen.getByText('(erledigt)')).toHaveClass('dss-sr-only');
    expect(screen.getByText('(aktuell)')).toBeInTheDocument();
    expect(screen.getByText('(ausstehend)')).toBeInTheDocument();
  });

  it('setzt Zustandsklassen', () => {
    const { container } = render(<Stepper steps={STEPS} />);
    const items = container.querySelectorAll('.dss-step-item');
    expect(items[0]).toHaveClass('is-done');
    expect(items[1]).toHaveClass('is-current');
    expect(items[2]).toHaveClass('is-pending');
  });

  it('rendert ohne onStep keine Buttons', () => {
    render(<Stepper steps={STEPS} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('rendert mit onStep Buttons für erledigte und aktuelle Schritte, nicht für ausstehende', () => {
    const onStep = vi.fn();
    render(<Stepper steps={STEPS} onStep={onStep} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Runde 1' }));
    expect(onStep).toHaveBeenCalledWith('r1');
  });

  it('zeigt in der kompakten Variante Fortschritt und Namen', () => {
    const { container } = render(<Stepper steps={STEPS} variant="compact" />);
    expect(container.querySelector('.dss-step--c')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(screen.getByText('Runde 2')).toBeInTheDocument();
  });

  it('rendert die vertikale Variante mit Beschreibung', () => {
    const { container } = render(<Stepper steps={STEPS} variant="vertical" />);
    expect(container.querySelector('.dss-step--v')).toBeInTheDocument();
    expect(screen.getByText('läuft')).toBeInTheDocument();
  });

  it.each(['horizontal', 'compact', 'vertical'] as const)('hat in %s keine A11y-Verstöße', async (variant) => {
    const { container } = render(<Stepper steps={STEPS} variant={variant} onStep={() => {}} />);
    await expectNoA11yViolations(container);
  });
});
```

- [ ] **Step 2: Test laufen lassen (rot)**

Run: `npx vitest run react/Stepper.test.tsx`
Expected: FAIL (`Failed to resolve import "./Stepper"`).

- [ ] **Step 3: CSS ergänzen**

An das Ende von `css/components.css` anhängen:

```css

/* ── Stepper (horizontal · kompakt · vertikal) ──────────────── */
.dss-step { font-family: var(--font-body); }
.dss-step--h, .dss-step--v { list-style: none; margin: 0; padding: 0; }
.dss-step-dot {
  appearance: none; flex-shrink: 0; margin: 0; padding: 0; border: 2px solid var(--dss-line-strong);
  border-radius: 50%; background: var(--dss-surface); color: var(--dss-mute);
  display: inline-flex; align-items: center; justify-content: center;
  font-family: var(--font-mono); font-weight: 700; transition: background 0.12s, border-color 0.12s;
}
button.dss-step-dot { cursor: pointer; }
button.dss-step-dot:focus-visible { outline: var(--ring-w) solid var(--ring-color); outline-offset: 2px; }
.dss-step-item.is-done .dss-step-dot { background: var(--ok-fill); border-color: var(--ok-fill); color: white; }
.dss-step-item.is-current .dss-step-dot {
  border-color: var(--amber-500); background: var(--amber-500); color: var(--ink-1000);
  box-shadow: 0 0 0 4px var(--dss-chip-amber-bg);
}
.dss-step-label { font-weight: 600; color: var(--dss-fg-soft); }
.dss-step-item.is-done .dss-step-label { color: var(--dss-fg); }
.dss-step-item.is-current .dss-step-label { color: var(--dss-fg); font-weight: 700; }
.dss-step-item.is-pending .dss-step-label, .dss-step-item.is-pending .dss-step-desc { color: var(--dss-mute); }

/* horizontal */
.dss-step--h { display: flex; align-items: flex-start; }
.dss-step--h .dss-step-item { flex: 1; display: flex; flex-direction: column; align-items: center; position: relative; min-width: 0; }
.dss-step--h .dss-step-dot { width: 32px; height: 32px; font-size: 13px; z-index: 1; }
.dss-step--h .dss-step-label { font-size: 12.5px; margin-top: 8px; text-align: center; max-width: 140px; }
.dss-step--h .dss-step-line { position: absolute; top: 16px; left: calc(50% + 18px); right: calc(-50% + 18px); height: 2px; background: var(--dss-line); z-index: 0; }
.dss-step--h .dss-step-item.is-done .dss-step-line { background: var(--ok-fill); }

/* kompakt */
.dss-step--c { display: flex; flex-direction: column; gap: 8px; }
.dss-step-track { height: 4px; border-radius: 999px; background: var(--dss-line); overflow: hidden; }
.dss-step-fill { height: 100%; background: var(--ok-fill); transition: width 0.3s; }
.dss-step-info { display: flex; gap: 12px; align-items: baseline; font-size: 13px; }
.dss-step-num { font-family: var(--font-mono); font-weight: 700; color: var(--dss-mute); text-transform: uppercase; letter-spacing: 0.08em; font-size: 11px; }
.dss-step-cur { color: var(--dss-fg); font-weight: 600; }

/* vertikal */
.dss-step--v .dss-step-item { display: flex; gap: 14px; padding-bottom: 18px; }
.dss-step--v .dss-step-item:last-child { padding-bottom: 0; }
.dss-step-rail { display: flex; flex-direction: column; align-items: center; width: 32px; flex-shrink: 0; }
.dss-step--v .dss-step-dot { width: 30px; height: 30px; font-size: 12px; }
.dss-step-vline { flex: 1; width: 2px; background: var(--dss-line); margin: 4px 0; min-height: 16px; }
.dss-step--v .dss-step-item.is-done .dss-step-vline { background: var(--ok-fill); }
.dss-step-body { padding-top: 4px; flex: 1; }
.dss-step--v .dss-step-label { font-size: 14px; }
.dss-step-desc { font-size: 13px; color: var(--dss-mute); margin-top: 2px; }
```

- [ ] **Step 4: React-Komponente**

`react/Stepper.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { cn } from './cn';

export type StepState = 'done' | 'current' | 'pending';
export type StepperVariant = 'horizontal' | 'compact' | 'vertical';

export interface StepItem {
  id: string;
  label: string;
  description?: string;
  state: StepState;
}

export interface StepperProps {
  steps: StepItem[];
  variant?: StepperVariant;
  /** Macht erledigte und aktuelle Schritte klickbar (Buttons); ohne Angabe sind es reine Anzeigen. */
  onStep?: (id: string) => void;
  ariaLabel?: string;
  className?: string;
}

const STATE_TEXT: Record<StepState, string> = { done: 'erledigt', current: 'aktuell', pending: 'ausstehend' };

/** Schrittanzeige für mehrstufige Abläufe (Setup, Runden, Onboarding). */
export function Stepper({ steps, variant = 'horizontal', onStep, ariaLabel = 'Fortschritt', className }: StepperProps) {
  const currentIdx = steps.findIndex((s) => s.state === 'current');
  const doneCount = steps.filter((s) => s.state === 'done').length;

  const dot = (step: StepItem, index: number): ReactNode => {
    const content = step.state === 'done' ? <Icon name="check" size={14} /> : <span aria-hidden="true">{index + 1}</span>;
    if (onStep && step.state !== 'pending') {
      return (
        <button type="button" className="dss-step-dot" aria-label={step.label} onClick={() => onStep(step.id)}>
          {content}
        </button>
      );
    }
    return (
      <span className="dss-step-dot" aria-hidden="true">
        {content}
      </span>
    );
  };

  const label = (step: StepItem): ReactNode => (
    <div className="dss-step-label">
      {step.label}
      <span className="dss-sr-only"> ({STATE_TEXT[step.state]})</span>
    </div>
  );

  if (variant === 'compact') {
    return (
      <div className={cn('dss-step', 'dss-step--c', className)} role="group" aria-label={ariaLabel}>
        <div className="dss-step-track" aria-hidden="true">
          <div className="dss-step-fill" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
        <div className="dss-step-info">
          <span className="dss-step-num">
            {currentIdx + 1} / {steps.length}
          </span>
          <span className="dss-step-cur">{steps[currentIdx]?.label ?? '—'}</span>
        </div>
      </div>
    );
  }

  if (variant === 'vertical') {
    return (
      <ol className={cn('dss-step', 'dss-step--v', className)} aria-label={ariaLabel}>
        {steps.map((step, i) => (
          <li
            key={step.id}
            className={cn('dss-step-item', `is-${step.state}`)}
            aria-current={step.state === 'current' ? 'step' : undefined}
          >
            <div className="dss-step-rail">
              {dot(step, i)}
              {i < steps.length - 1 ? <span className="dss-step-vline" aria-hidden="true" /> : null}
            </div>
            <div className="dss-step-body">
              {label(step)}
              {step.description ? <div className="dss-step-desc">{step.description}</div> : null}
            </div>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ol className={cn('dss-step', 'dss-step--h', className)} aria-label={ariaLabel}>
      {steps.map((step, i) => (
        <li
          key={step.id}
          className={cn('dss-step-item', `is-${step.state}`)}
          aria-current={step.state === 'current' ? 'step' : undefined}
        >
          {dot(step, i)}
          {label(step)}
          {i < steps.length - 1 ? <span className="dss-step-line" aria-hidden="true" /> : null}
        </li>
      ))}
    </ol>
  );
}
```

In `react/index.ts` anhängen:

```ts
export { Stepper, type StepperProps, type StepItem, type StepState, type StepperVariant } from './Stepper';
```

- [ ] **Step 5: Svelte-Komponente ohne `<style>`**

`svelte/Stepper.svelte` komplett ersetzen:

```svelte
<script lang="ts">
  /**
   * DSS Stepper · Svelte 5
   * --------------------------------------------------------------
   * Schrittanzeige für Setup-Wizards, Spiel-Vorbereitung, Onboarding.
   * Drei Layouts mit demselben Datenmodell. Nutzt nur Klassen aus
   * css/components.css.
   *
   *   horizontal — Punkte + Verbindungslinien (Standard, Desktop)
   *   compact    — einzeilige Fortschrittsleiste mit aktuellem Schritt
   *   vertical   — gestapelte Liste mit Beschreibung (Sidebar-Wizards)
   *
   * Schrittzustand: done (grün, anklickbar) · current (Amber) · pending (gedämpft).
   * Der Punkt ist nur ein Button, wenn `onstep` gesetzt und der Schritt nicht
   * pending ist; sonst eine reine Anzeige.
   */
  type Step = {
    id: string;
    label: string;
    description?: string;
    state: 'done' | 'current' | 'pending';
  };

  let {
    steps,
    variant = 'horizontal',
    onstep,
    ariaLabel = 'Fortschritt',
  }: {
    steps: Step[];
    variant?: 'horizontal' | 'compact' | 'vertical';
    onstep?: (id: string) => void;
    ariaLabel?: string;
  } = $props();

  const stateText = { done: 'erledigt', current: 'aktuell', pending: 'ausstehend' } as const;

  let currentIdx = $derived(steps.findIndex((s) => s.state === 'current'));
  let doneCount = $derived(steps.filter((s) => s.state === 'done').length);
</script>

{#snippet dot(s: Step, i: number)}
  {#if onstep && s.state !== 'pending'}
    <button type="button" class="dss-step-dot" aria-label={s.label} onclick={() => onstep?.(s.id)}>
      {#if s.state === 'done'}
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>
      {:else}
        <span aria-hidden="true">{i + 1}</span>
      {/if}
    </button>
  {:else}
    <span class="dss-step-dot" aria-hidden="true">
      {#if s.state === 'done'}
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>
      {:else}
        <span>{i + 1}</span>
      {/if}
    </span>
  {/if}
{/snippet}

{#if variant === 'horizontal'}
  <ol class="dss-step dss-step--h" aria-label={ariaLabel}>
    {#each steps as s, i (s.id)}
      <li class={`dss-step-item is-${s.state}`} aria-current={s.state === 'current' ? 'step' : undefined}>
        {@render dot(s, i)}
        <div class="dss-step-label">{s.label}<span class="dss-sr-only"> ({stateText[s.state]})</span></div>
        {#if i < steps.length - 1}<span class="dss-step-line" aria-hidden="true"></span>{/if}
      </li>
    {/each}
  </ol>

{:else if variant === 'compact'}
  <div class="dss-step dss-step--c" role="group" aria-label={ariaLabel}>
    <div class="dss-step-track" aria-hidden="true">
      <div class="dss-step-fill" style={`width: ${(doneCount / steps.length) * 100}%;`}></div>
    </div>
    <div class="dss-step-info">
      <span class="dss-step-num">{currentIdx + 1} / {steps.length}</span>
      <span class="dss-step-cur">{steps[currentIdx]?.label ?? '—'}</span>
    </div>
  </div>

{:else}
  <ol class="dss-step dss-step--v" aria-label={ariaLabel}>
    {#each steps as s, i (s.id)}
      <li class={`dss-step-item is-${s.state}`} aria-current={s.state === 'current' ? 'step' : undefined}>
        <div class="dss-step-rail">
          {@render dot(s, i)}
          {#if i < steps.length - 1}<span class="dss-step-vline" aria-hidden="true"></span>{/if}
        </div>
        <div class="dss-step-body">
          <div class="dss-step-label">{s.label}<span class="dss-sr-only"> ({stateText[s.state]})</span></div>
          {#if s.description}<div class="dss-step-desc">{s.description}</div>{/if}
        </div>
      </li>
    {/each}
  </ol>
{/if}
```

Hinweis: Die bestehenden Storys (`NavigationDemo.svelte`) übergeben `onstep` nicht; Punkte werden dort jetzt als Anzeige statt als Button gerendert (gewollt). Falls die Demo Klickverhalten zeigen soll, in der Demo `onstep={() => {}}` ergänzen.

- [ ] **Step 6: Parität und CSS-Pflichtliste**

`parity.manifest.json`: Eintrag ergänzen:

```json
  "Stepper":   { "svelte": "svelte/Stepper.svelte",   "react": "react/Stepper.tsx",   "css": ["dss-step", "dss-step--h", "dss-step--c", "dss-step--v", "dss-step-item", "dss-step-dot"] }
```

`tests/parity.test.ts`: `'Stepper'` aus `PENDING_REACT` entfernen.

`tests/components-css.test.ts`: in `REQUIRED` vor `// Icon` ergänzen:

```ts
  // Stepper (v0.8)
  'dss-step--h', 'dss-step--c', 'dss-step--v', 'dss-step-item', 'dss-step-dot', 'dss-step-label',
  'dss-step-line', 'dss-step-rail', 'dss-step-vline', 'dss-step-body', 'dss-step-desc',
  'dss-step-track', 'dss-step-fill', 'dss-step-info', 'dss-step-num', 'dss-step-cur',
```

- [ ] **Step 7: Tests und Typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: grün (`Stepper` 10 Fälle).

- [ ] **Step 8: Commit**

```bash
git add css/components.css svelte/Stepper.svelte react/Stepper.tsx react/Stepper.test.tsx react/index.ts parity.manifest.json tests
git commit -m "feat: extract Stepper css and add React Stepper" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: AppNav (CSS + Svelte + React + Vanilla-JS)

Datenmodell (React und Svelte identisch): Einträge sind entweder ein Link `{ id, label, href, disabled?, hint? }` oder eine Gruppe `{ id, label, items: Link[] }`. Aktiv wird über `currentHref` (exakter Vergleich mit `href`) bestimmt; die Komponente setzt `aria-current="page"` selbst. `renderLink` (nur React) erlaubt Router-Links (`Link` statt `a`) und bekommt `{ item, className, ariaCurrent, onNavigate, children }`. Gesperrte Links sind `<span role="link" aria-disabled="true">` ohne Fokus, mit Tooltip und sr-only-Hinweis. Gruppen sind Disclosure-Dropdowns (`aria-expanded`/`aria-controls`, `hidden` am Panel), Esc und Klick außerhalb schließen, der Fokus kehrt zum Auslöser zurück. Unter 720 px ersetzt ein Hamburger-Button („Menü“) die Leiste, Gruppen werden zu Akkordeons.

**Files:**
- Modify: `css/components.css`, `parity.manifest.json`, `tests/parity.test.ts` (nur prüfen), `tests/components-css.test.ts`, `react/index.ts`, `package.json`
- Create: `react/AppNav.tsx`, `react/AppNav.test.tsx`, `svelte/AppNav.svelte`, `js/appnav.js`, `tests/appnav.test.ts`, `stories/components/AppNavDemo.svelte`, `stories/AppNav.stories.ts`

- [ ] **Step 1: Failing React-Test schreiben**

`react/AppNav.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AppNav, type AppNavItem } from './AppNav';
import { expectNoA11yViolations } from './test-utils';

const ITEMS: AppNavItem[] = [
  {
    id: 'prep',
    label: 'Vorbereiten',
    items: [
      { id: 'teams', label: 'Teams', href: '/teams' },
      { id: 'config', label: 'Konfiguration', href: '/konfiguration' },
    ],
  },
  {
    id: 'view',
    label: 'Ansehen',
    items: [{ id: 'schedule', label: 'Zeitplan', href: '/zeitplan', disabled: true, hint: 'Erst nach dem Zeitplan verfügbar' }],
  },
  { id: 'help', label: 'Anleitung', href: '/anleitung' },
];

describe('AppNav', () => {
  it('rendert eine benannte Navigation mit Link und Gruppen-Buttons', () => {
    render(<AppNav items={ITEMS} ariaLabel="Hauptnavigation" />);
    expect(screen.getByRole('navigation', { name: 'Hauptnavigation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Anleitung' })).toHaveAttribute('href', '/anleitung');
    expect(screen.getByRole('button', { name: 'Vorbereiten' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('markiert den aktuellen Link mit aria-current und die Gruppe als aktiv', () => {
    render(<AppNav items={ITEMS} currentHref="/teams" />);
    expect(screen.getByRole('button', { name: 'Vorbereiten' })).toHaveClass('is-active');
    fireEvent.click(screen.getByRole('button', { name: 'Vorbereiten' }));
    expect(screen.getByRole('link', { name: 'Teams' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Konfiguration' })).not.toHaveAttribute('aria-current');
  });

  it('öffnet und schließt eine Gruppe per Klick; es ist immer nur eine offen', () => {
    render(<AppNav items={ITEMS} />);
    const prep = screen.getByRole('button', { name: 'Vorbereiten' });
    const view = screen.getByRole('button', { name: 'Ansehen' });
    expect(screen.queryByRole('link', { name: 'Teams' })).toBeNull();
    fireEvent.click(prep);
    expect(prep).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Teams' })).toBeVisible();
    fireEvent.click(view);
    expect(prep).toHaveAttribute('aria-expanded', 'false');
    expect(view).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(view);
    expect(view).toHaveAttribute('aria-expanded', 'false');
  });

  it('schließt mit Esc und gibt den Fokus an den Auslöser zurück', () => {
    render(<AppNav items={ITEMS} />);
    const prep = screen.getByRole('button', { name: 'Vorbereiten' });
    fireEvent.click(prep);
    fireEvent.keyDown(screen.getByRole('link', { name: 'Teams' }), { key: 'Escape' });
    expect(prep).toHaveAttribute('aria-expanded', 'false');
    expect(prep).toHaveFocus();
  });

  it('schließt bei Klick außerhalb', () => {
    render(
      <div>
        <button type="button">Außen</button>
        <AppNav items={ITEMS} />
      </div>,
    );
    const prep = screen.getByRole('button', { name: 'Vorbereiten' });
    fireEvent.click(prep);
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Außen' }));
    expect(prep).toHaveAttribute('aria-expanded', 'false');
  });

  it('schließt nach Klick auf einen Link', () => {
    render(<AppNav items={ITEMS} />);
    const prep = screen.getByRole('button', { name: 'Vorbereiten' });
    fireEvent.click(prep);
    fireEvent.click(screen.getByRole('link', { name: 'Teams' }));
    expect(prep).toHaveAttribute('aria-expanded', 'false');
  });

  it('rendert gesperrte Einträge ohne Fokus mit Hinweis', () => {
    render(<AppNav items={ITEMS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ansehen' }));
    const locked = screen.getByRole('link', { name: /Zeitplan/ });
    expect(locked).toHaveAttribute('aria-disabled', 'true');
    expect(locked).not.toHaveAttribute('href');
    expect(locked).not.toHaveAttribute('tabindex');
    expect(locked).toHaveAttribute('title', 'Erst nach dem Zeitplan verfügbar');
    expect(within(locked).getByText(/Erst nach dem Zeitplan verfügbar/)).toHaveClass('dss-sr-only');
  });

  it('nutzt renderLink für Router-Links', () => {
    const renderLink = vi.fn(({ item, className, ariaCurrent, onNavigate, children }) => (
      <a data-router href={item.href} className={className} aria-current={ariaCurrent} onClick={onNavigate}>
        {children}
      </a>
    ));
    render(<AppNav items={ITEMS} renderLink={renderLink} currentHref="/anleitung" />);
    const help = screen.getByRole('link', { name: 'Anleitung' });
    expect(help).toHaveAttribute('data-router');
    expect(help).toHaveAttribute('aria-current', 'page');
    expect(renderLink).toHaveBeenCalled();
  });

  it('steuert das mobile Menü über den Menü-Button', () => {
    const { container } = render(<AppNav items={ITEMS} menuLabel="Menü" />);
    const toggle = screen.getByRole('button', { name: 'Menü' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(container.querySelector('nav')).toHaveClass('is-open');
    fireEvent.keyDown(toggle, { key: 'Escape' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('setzt die Tonalität und rendert den Kontext-Slot', () => {
    const { container } = render(<AppNav items={ITEMS} tone="dark" context={<span>Turnier A</span>} />);
    expect(container.querySelector('nav')).toHaveClass('dss-appnav--dark');
    expect(screen.getByText('Turnier A')).toBeInTheDocument();
  });

  it('hat keine A11y-Verstöße (geschlossen und geöffnet)', async () => {
    const { container } = render(<AppNav items={ITEMS} currentHref="/teams" />);
    await expectNoA11yViolations(container);
    fireEvent.click(screen.getByRole('button', { name: 'Ansehen' }));
    await expectNoA11yViolations(container);
  });
});
```

- [ ] **Step 2: Test laufen lassen (rot)**

Run: `npx vitest run react/AppNav.test.tsx`
Expected: FAIL (`Failed to resolve import "./AppNav"`).

- [ ] **Step 3: CSS ergänzen**

An das Ende von `css/components.css` anhängen:

```css

/* ── AppNav · Hauptnavigation mit Gruppen-Dropdowns und mobilem Menü ── */
.dss-appnav { position: relative; background: var(--dss-surface); border-bottom: 1px solid var(--dss-line); font-family: var(--font-body); }
.dss-appnav-bar { display: flex; align-items: center; gap: 4px; padding: 0 12px; }
.dss-appnav-list { display: flex; align-items: center; gap: 4px; list-style: none; margin: 0; padding: 0; }
.dss-appnav-item { position: relative; }
.dss-appnav-context { margin-left: auto; display: flex; align-items: center; gap: 8px; padding: 0 8px; }
.dss-appnav-link, .dss-appnav-group-btn, .dss-appnav-toggle {
  appearance: none; display: inline-flex; align-items: center; gap: 6px; min-height: 48px; padding: 0 12px;
  border: 0; border-bottom: 3px solid transparent; margin-bottom: -1px; background: none;
  font: inherit; font-size: 14px; font-weight: 600; color: var(--dss-fg-soft); text-decoration: none; cursor: pointer;
}
.dss-appnav-link:hover, .dss-appnav-group-btn:hover, .dss-appnav-toggle:hover { color: var(--dss-fg); background: var(--dss-hover-bg); }
.dss-appnav-link.is-active, .dss-appnav-group-btn.is-active { color: var(--dss-fg); border-bottom-color: var(--amber-400); }
.dss-appnav-link.is-disabled { color: var(--dss-mute); cursor: not-allowed; background: none; }
.dss-appnav-link:focus-visible, .dss-appnav-group-btn:focus-visible, .dss-appnav-toggle:focus-visible {
  outline: var(--ring-w) solid var(--ring-color); outline-offset: -3px;
}
.dss-appnav-chev { transition: transform 0.12s; }
.dss-appnav-group-btn.is-open .dss-appnav-chev { transform: rotate(180deg); }
.dss-appnav-panel {
  position: absolute; top: 100%; left: 0; z-index: 50; min-width: 230px; margin: 4px 0 0; padding: 6px;
  list-style: none; background: var(--dss-surface); border: 1px solid var(--dss-line);
  border-radius: var(--radius-md); box-shadow: var(--shadow-md);
}
.dss-appnav-panel[hidden] { display: none; }
.dss-appnav-panel .dss-appnav-link {
  display: flex; width: 100%; min-height: 44px; margin: 0; border-bottom: 0; border-radius: var(--radius-md);
}
.dss-appnav-panel .dss-appnav-link.is-active { background: var(--dss-selected-bg); box-shadow: inset 3px 0 0 var(--amber-400); }
.dss-appnav-toggle { display: none; }

.dss-appnav--dark { background: var(--ink-1000); border-bottom-color: var(--n-900); color: var(--n-100); }
.dss-appnav--dark .dss-appnav-link, .dss-appnav--dark .dss-appnav-group-btn, .dss-appnav--dark .dss-appnav-toggle { color: var(--n-300); }
.dss-appnav--dark .dss-appnav-link:hover, .dss-appnav--dark .dss-appnav-group-btn:hover, .dss-appnav--dark .dss-appnav-toggle:hover { color: white; background: var(--n-900); }
.dss-appnav--dark .dss-appnav-link.is-active, .dss-appnav--dark .dss-appnav-group-btn.is-active { color: white; }
.dss-appnav--dark .dss-appnav-link.is-disabled { color: var(--n-500); background: none; }
.dss-appnav--dark .dss-appnav-link:focus-visible, .dss-appnav--dark .dss-appnav-group-btn:focus-visible, .dss-appnav--dark .dss-appnav-toggle:focus-visible { outline-color: var(--amber-300); }
.dss-appnav--dark .dss-appnav-panel { background: var(--n-950); border-color: var(--n-800); }
.dss-appnav--dark .dss-appnav-panel .dss-appnav-link.is-active { background: var(--n-900); }

@media (max-width: 720px) {
  .dss-appnav-bar { flex-wrap: wrap; padding: 0 8px; }
  .dss-appnav-toggle { display: inline-flex; margin-bottom: 0; border-bottom: 0; }
  .dss-appnav-list { display: none; flex-direction: column; align-items: stretch; width: 100%; gap: 0; padding-bottom: 8px; }
  .dss-appnav.is-open .dss-appnav-list { display: flex; }
  .dss-appnav-link, .dss-appnav-group-btn { width: 100%; justify-content: space-between; border-bottom: 0; margin-bottom: 0; border-radius: var(--radius-md); }
  .dss-appnav-link.is-active, .dss-appnav-group-btn.is-active { background: var(--dss-selected-bg); box-shadow: inset 3px 0 0 var(--amber-400); }
  .dss-appnav--dark .dss-appnav-link.is-active, .dss-appnav--dark .dss-appnav-group-btn.is-active { background: var(--n-900); }
  .dss-appnav-panel { position: static; min-width: 0; margin: 0; padding: 0 0 0 14px; border: 0; box-shadow: none; background: none; }
  .dss-appnav-context { margin-left: auto; }
}
```

- [ ] **Step 4: React-Komponente**

`react/AppNav.tsx`:

```tsx
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from './Icon';
import { cn } from './cn';

export interface AppNavLink {
  id: string;
  label: string;
  href: string;
  /** Gesperrt: nicht fokussierbar, mit Hinweis (Tooltip + Screenreader). */
  disabled?: boolean;
  hint?: string;
}

export interface AppNavGroup {
  id: string;
  label: string;
  items: AppNavLink[];
}

export type AppNavItem = AppNavLink | AppNavGroup;
export type AppNavTone = 'light' | 'dark';

export interface AppNavLinkRenderProps {
  item: AppNavLink;
  className: string;
  ariaCurrent: 'page' | undefined;
  /** Beim Navigieren aufrufen (schließt Dropdown und mobiles Menü). */
  onNavigate: () => void;
  children: ReactNode;
}

export interface AppNavProps {
  items: AppNavItem[];
  /** Aktueller Pfad; ein Link mit gleichem `href` ist aktiv (`aria-current="page"`). */
  currentHref?: string;
  tone?: AppNavTone;
  ariaLabel?: string;
  /** Beschriftung des Hamburger-Buttons (unter 720 px). */
  menuLabel?: string;
  /** Platz rechts in der Leiste, z. B. für einen späteren Turnierumschalter. */
  context?: ReactNode;
  /** Eigene Link-Darstellung, z. B. für React Router (`Link` statt `a`). */
  renderLink?: (props: AppNavLinkRenderProps) => ReactNode;
  className?: string;
}

const isGroup = (item: AppNavItem): item is AppNavGroup => 'items' in item;

/** Hauptnavigation mit Gruppen-Dropdowns (Disclosure), gesperrten Einträgen und mobilem Hamburger-Menü. */
export function AppNav({
  items,
  currentHref,
  tone = 'light',
  ariaLabel = 'Hauptnavigation',
  menuLabel = 'Menü',
  context,
  renderLink,
  className,
}: AppNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const triggers = useRef<Record<string, HTMLButtonElement | null>>({});
  const baseId = useId();

  useEffect(() => {
    if (!openGroup) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenGroup(null);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [openGroup]);

  const closeAll = () => {
    setOpenGroup(null);
    setMenuOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape') return;
    if (openGroup) {
      const id = openGroup;
      setOpenGroup(null);
      triggers.current[id]?.focus();
    } else if (menuOpen) {
      setMenuOpen(false);
      toggleRef.current?.focus();
    }
  };

  const isCurrent = (item: AppNavLink) => currentHref !== undefined && item.href === currentHref;

  const renderItemLink = (item: AppNavLink): ReactNode => {
    if (item.disabled) {
      return (
        <span role="link" aria-disabled="true" className="dss-appnav-link is-disabled" title={item.hint}>
          {item.label}
          {item.hint ? <span className="dss-sr-only"> – {item.hint}</span> : null}
        </span>
      );
    }
    const current = isCurrent(item);
    const linkClass = cn('dss-appnav-link', current && 'is-active');
    const ariaCurrent = current ? 'page' : undefined;
    if (renderLink) {
      return renderLink({ item, className: linkClass, ariaCurrent, onNavigate: closeAll, children: item.label });
    }
    return (
      <a href={item.href} className={linkClass} aria-current={ariaCurrent} onClick={closeAll}>
        {item.label}
      </a>
    );
  };

  return (
    <nav
      ref={rootRef}
      aria-label={ariaLabel}
      className={cn('dss-appnav', `dss-appnav--${tone}`, menuOpen && 'is-open', className)}
      onKeyDown={onKeyDown}
    >
      <div className="dss-appnav-bar">
        <button
          ref={toggleRef}
          type="button"
          className="dss-appnav-toggle"
          aria-expanded={menuOpen}
          aria-controls={`${baseId}-list`}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Icon name={menuOpen ? 'x' : 'menu'} size={20} />
          <span>{menuLabel}</span>
        </button>
        <ul id={`${baseId}-list`} className="dss-appnav-list">
          {items.map((item) => {
            if (!isGroup(item)) {
              return (
                <li key={item.id} className="dss-appnav-item">
                  {renderItemLink(item)}
                </li>
              );
            }
            const open = openGroup === item.id;
            const panelId = `${baseId}-${item.id}`;
            return (
              <li key={item.id} className="dss-appnav-item">
                <button
                  ref={(el) => {
                    triggers.current[item.id] = el;
                  }}
                  type="button"
                  className={cn('dss-appnav-group-btn', item.items.some(isCurrent) && 'is-active', open && 'is-open')}
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpenGroup(open ? null : item.id)}
                >
                  {item.label}
                  <Icon name="chevron-d" size={16} className="dss-appnav-chev" />
                </button>
                <ul id={panelId} className="dss-appnav-panel" hidden={!open}>
                  {item.items.map((child) => (
                    <li key={child.id}>{renderItemLink(child)}</li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
        {context ? <div className="dss-appnav-context">{context}</div> : null}
      </div>
    </nav>
  );
}
```

In `react/index.ts` anhängen:

```ts
export {
  AppNav,
  type AppNavProps,
  type AppNavItem,
  type AppNavLink,
  type AppNavGroup,
  type AppNavTone,
  type AppNavLinkRenderProps,
} from './AppNav';
```

- [ ] **Step 5: Svelte-Komponente**

`svelte/AppNav.svelte`:

```svelte
<script lang="ts" module>
  let seq = 0;
</script>

<script lang="ts">
  /**
   * DSS AppNav · Svelte 5
   * --------------------------------------------------------------
   * Hauptnavigation mit Gruppen-Dropdowns (Disclosure), gesperrten
   * Einträgen und mobilem Hamburger-Menü (< 720 px). Nutzt nur Klassen
   * aus css/components.css. Aktiv ist der Link, dessen href `currentHref`
   * entspricht (aria-current="page").
   */
  import Icon from './Icon.svelte';

  type Link = { id: string; label: string; href: string; disabled?: boolean; hint?: string };
  type Group = { id: string; label: string; items: Link[] };
  type Item = Link | Group;

  let {
    items,
    currentHref = '',
    tone = 'light',
    ariaLabel = 'Hauptnavigation',
    menuLabel = 'Menü',
  }: {
    items: Item[];
    currentHref?: string;
    tone?: 'light' | 'dark';
    ariaLabel?: string;
    menuLabel?: string;
  } = $props();

  const baseId = `dss-appnav-${++seq}`;
  let menuOpen = $state(false);
  let openGroup = $state<string | null>(null);
  let root: HTMLElement | undefined = $state();
  let toggleEl: HTMLButtonElement | undefined = $state();
  const triggers: Record<string, HTMLButtonElement | undefined> = {};

  const isGroup = (item: Item): item is Group => 'items' in item;
  const isCurrent = (link: Link) => currentHref !== '' && link.href === currentHref;

  function closeAll() {
    openGroup = null;
    menuOpen = false;
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    if (openGroup) {
      const id = openGroup;
      openGroup = null;
      triggers[id]?.focus();
    } else if (menuOpen) {
      menuOpen = false;
      toggleEl?.focus();
    }
  }

  function onWindowMousedown(event: MouseEvent) {
    if (openGroup && root && !root.contains(event.target as Node)) openGroup = null;
  }
</script>

<svelte:window onmousedown={onWindowMousedown} />

{#snippet link(l: Link)}
  {#if l.disabled}
    <span role="link" aria-disabled="true" class="dss-appnav-link is-disabled" title={l.hint}>
      {l.label}{#if l.hint}<span class="dss-sr-only"> – {l.hint}</span>{/if}
    </span>
  {:else}
    <a
      class="dss-appnav-link"
      class:is-active={isCurrent(l)}
      href={l.href}
      aria-current={isCurrent(l) ? 'page' : undefined}
      onclick={closeAll}
    >{l.label}</a>
  {/if}
{/snippet}

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<nav
  bind:this={root}
  class="dss-appnav dss-appnav--{tone}"
  class:is-open={menuOpen}
  aria-label={ariaLabel}
  onkeydown={onKeydown}
>
  <div class="dss-appnav-bar">
    <button
      bind:this={toggleEl}
      type="button"
      class="dss-appnav-toggle"
      aria-expanded={menuOpen}
      aria-controls="{baseId}-list"
      onclick={() => (menuOpen = !menuOpen)}
    >
      <Icon name={menuOpen ? 'x' : 'menu'} size={20} />
      <span>{menuLabel}</span>
    </button>
    <ul id="{baseId}-list" class="dss-appnav-list">
      {#each items as item (item.id)}
        {#if isGroup(item)}
          <li class="dss-appnav-item">
            <button
              bind:this={triggers[item.id]}
              type="button"
              class="dss-appnav-group-btn"
              class:is-active={item.items.some(isCurrent)}
              class:is-open={openGroup === item.id}
              aria-expanded={openGroup === item.id}
              aria-controls="{baseId}-{item.id}"
              onclick={() => (openGroup = openGroup === item.id ? null : item.id)}
            >
              {item.label}
              <Icon name="chevron-d" size={16} class="dss-appnav-chev" />
            </button>
            <ul id="{baseId}-{item.id}" class="dss-appnav-panel" hidden={openGroup !== item.id}>
              {#each item.items as child (child.id)}
                <li>{@render link(child)}</li>
              {/each}
            </ul>
          </li>
        {:else}
          <li class="dss-appnav-item">{@render link(item)}</li>
        {/if}
      {/each}
    </ul>
  </div>
</nav>
```

- [ ] **Step 6: Failing Vanilla-Test schreiben**

`tests/appnav.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { initAppNav } from '../js/appnav.js';

const MARKUP = `
<nav class="dss-appnav dss-appnav--light" data-dss-appnav aria-label="Hauptnavigation">
  <div class="dss-appnav-bar">
    <button type="button" class="dss-appnav-toggle" data-appnav-toggle aria-expanded="false" aria-controls="n-list">Menü</button>
    <ul class="dss-appnav-list" id="n-list">
      <li class="dss-appnav-item">
        <button type="button" class="dss-appnav-group-btn" data-appnav-group aria-expanded="false" aria-controls="n-g1">Vorbereiten</button>
        <ul class="dss-appnav-panel" id="n-g1" hidden><li><a class="dss-appnav-link" href="/teams">Teams</a></li></ul>
      </li>
      <li class="dss-appnav-item">
        <button type="button" class="dss-appnav-group-btn" data-appnav-group aria-expanded="false" aria-controls="n-g2">Ansehen</button>
        <ul class="dss-appnav-panel" id="n-g2" hidden><li><a class="dss-appnav-link" href="/zeitplan">Zeitplan</a></li></ul>
      </li>
    </ul>
  </div>
</nav>
<button type="button" id="outside">Außen</button>`;

let cleanup: () => void = () => {};

function mount() {
  const doc = new DOMParser().parseFromString(MARKUP, 'text/html');
  document.body.replaceChildren(...Array.from(doc.body.childNodes).map((node) => document.importNode(node, true)));
  const root = document.querySelector<HTMLElement>('[data-dss-appnav]')!;
  cleanup = initAppNav(root);
  return {
    root,
    toggle: root.querySelector<HTMLButtonElement>('[data-appnav-toggle]')!,
    groups: Array.from(root.querySelectorAll<HTMLButtonElement>('[data-appnav-group]')),
    panel: (id: string) => document.getElementById(id) as HTMLElement,
  };
}

afterEach(() => cleanup());

describe('js/appnav.js', () => {
  it('öffnet und schließt das mobile Menü', () => {
    const { root, toggle } = mount();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(root).toHaveClass('is-open');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(root).not.toHaveClass('is-open');
  });

  it('öffnet eine Gruppe und schließt die andere', () => {
    const { groups, panel } = mount();
    fireEvent.click(groups[0]);
    expect(groups[0]).toHaveAttribute('aria-expanded', 'true');
    expect(panel('n-g1').hidden).toBe(false);
    fireEvent.click(groups[1]);
    expect(groups[0]).toHaveAttribute('aria-expanded', 'false');
    expect(panel('n-g1').hidden).toBe(true);
    expect(panel('n-g2').hidden).toBe(false);
  });

  it('schließt mit Esc und fokussiert den Auslöser', () => {
    const { groups, panel } = mount();
    fireEvent.click(groups[0]);
    fireEvent.keyDown(panel('n-g1').querySelector('a')!, { key: 'Escape' });
    expect(groups[0]).toHaveAttribute('aria-expanded', 'false');
    expect(groups[0]).toHaveFocus();
  });

  it('schließt bei Klick außerhalb', () => {
    const { groups, panel } = mount();
    fireEvent.click(groups[0]);
    fireEvent.mouseDown(document.getElementById('outside')!);
    expect(panel('n-g1').hidden).toBe(true);
  });

  it('schließt Gruppe und Menü nach Klick auf einen Link', () => {
    const { root, toggle, groups, panel } = mount();
    fireEvent.click(toggle);
    fireEvent.click(groups[0]);
    const link = panel('n-g1').querySelector('a')!;
    link.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(link);
    expect(panel('n-g1').hidden).toBe(true);
    expect(root).not.toHaveClass('is-open');
  });

  it('initialisiert dasselbe Element nicht doppelt', () => {
    const { root, toggle } = mount();
    initAppNav(root);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});
```

- [ ] **Step 7: Vanilla-Test laufen lassen (rot)**

Run: `npx vitest run tests/appnav.test.ts`
Expected: FAIL (`Failed to resolve import "../js/appnav.js"`).

- [ ] **Step 8: Vanilla-JS schreiben**

`js/appnav.js`:

```js
/**
 * DSS AppNav · Vanilla-Verhalten
 * --------------------------------------------------------------
 * Ergänzt das Markup der AppNav (css/components.css) um Verhalten, ohne Framework:
 * Hamburger-Menü, Gruppen-Dropdowns (Disclosure), Esc, Klick außerhalb.
 *
 * Markup-Vertrag (Klassen siehe components.css):
 *   <nav class="dss-appnav dss-appnav--light" data-dss-appnav aria-label="Hauptnavigation">
 *     <div class="dss-appnav-bar">
 *       <button type="button" class="dss-appnav-toggle" data-appnav-toggle
 *               aria-expanded="false" aria-controls="nav-list">Menü</button>
 *       <ul class="dss-appnav-list" id="nav-list">
 *         <li class="dss-appnav-item"><a class="dss-appnav-link is-active" aria-current="page" href="/">Start</a></li>
 *         <li class="dss-appnav-item">
 *           <button type="button" class="dss-appnav-group-btn" data-appnav-group
 *                   aria-expanded="false" aria-controls="nav-g1">Gruppe</button>
 *           <ul class="dss-appnav-panel" id="nav-g1" hidden>
 *             <li><a class="dss-appnav-link" href="/a">Seite A</a></li>
 *           </ul>
 *         </li>
 *       </ul>
 *     </div>
 *   </nav>
 *
 * <script type="module" src="…/js/appnav.js"></script> initialisiert alle [data-dss-appnav] automatisch.
 */
const OPEN = 'is-open';

/** Initialisiert eine AppNav; gibt eine Funktion zum Entfernen des globalen Listeners zurück. */
export function initAppNav(root) {
  if (root.dataset.dssAppnavReady) return () => {};
  root.dataset.dssAppnavReady = 'true';

  const toggle = root.querySelector('[data-appnav-toggle]');
  const groups = Array.from(root.querySelectorAll('[data-appnav-group]'));

  const panelOf = (button) => document.getElementById(button.getAttribute('aria-controls'));
  const setGroup = (button, open) => {
    button.setAttribute('aria-expanded', String(open));
    button.classList.toggle(OPEN, open);
    const panel = panelOf(button);
    if (panel) panel.hidden = !open;
  };
  const closeGroups = () => groups.forEach((button) => setGroup(button, false));
  const setMenu = (open) => {
    root.classList.toggle(OPEN, open);
    if (toggle) toggle.setAttribute('aria-expanded', String(open));
  };

  if (toggle) {
    toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  }

  groups.forEach((button) => {
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      closeGroups();
      setGroup(button, open);
    });
  });

  root.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('a[href]')) {
      closeGroups();
      setMenu(false);
    }
  });

  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const openButton = groups.find((button) => button.getAttribute('aria-expanded') === 'true');
    if (openButton) {
      closeGroups();
      openButton.focus();
    } else if (toggle && toggle.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      toggle.focus();
    }
  });

  const onOutside = (event) => {
    if (!root.contains(event.target)) closeGroups();
  };
  document.addEventListener('mousedown', onOutside);
  return () => document.removeEventListener('mousedown', onOutside);
}

/** Initialisiert alle AppNavs im Bereich (Standard: ganzes Dokument). */
export function initAppNavs(scope = document) {
  return Array.from(scope.querySelectorAll('[data-dss-appnav]')).map(initAppNav);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initAppNavs());
  else initAppNavs();
}
```

- [ ] **Step 9: Stories**

`stories/components/AppNavDemo.svelte`:

```svelte
<script lang="ts">
  import AppNav from '../../svelte/AppNav.svelte';
  import TopBar from '../../svelte/TopBar.svelte';

  let { tone = 'light', currentHref = '/ergebnisse' }: { tone?: 'light' | 'dark'; currentHref?: string } = $props();

  const items = [
    { id: 'prep', label: 'Vorbereiten', items: [
      { id: 'teams', label: 'Teams', href: '/teams' },
      { id: 'config', label: 'Konfiguration', href: '/konfiguration' },
    ] },
    { id: 'play', label: 'Spielen', items: [
      { id: 'results', label: 'Ergebnisse erfassen', href: '/ergebnisse' },
    ] },
    { id: 'view', label: 'Ansehen', items: [
      { id: 'schedule', label: 'Zeitplan', href: '/zeitplan', disabled: true, hint: 'Erst nach dem Zeitplan verfügbar' },
      { id: 'overview', label: 'Turnierübersicht', href: '/uebersicht' },
    ] },
    { id: 'export', label: 'Export', href: '/export' },
    { id: 'help', label: 'Hilfe', items: [
      { id: 'manual', label: 'Anleitung', href: '/anleitung' },
      { id: 'demos', label: 'Demo-Turniere', href: '/demos' },
    ] },
  ];
</script>

<div style="min-height: 320px;">
  <TopBar brand="Turnier-Manager" mark="T" />
  <AppNav {items} {tone} {currentHref} />
</div>
```

`stories/AppNav.stories.ts`:

```ts
import AppNavDemo from './components/AppNavDemo.svelte';

export default {
  title: 'Components/AppNav',
  component: AppNavDemo,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
**AppNav** — Hauptnavigation mit Gruppen-Dropdowns (Disclosure), gesperrten Einträgen und mobilem Hamburger-Menü (< 720 px).

- Aktiver Link über \`currentHref\` → \`aria-current="page"\`.
- Gesperrte Einträge sind nicht fokussierbar und tragen einen Hinweis.
- Esc und Klick außerhalb schließen, der Fokus kehrt zum Auslöser zurück.
- Vanilla-Variante: Markup-Vertrag und \`js/appnav.js\` (siehe README).
        `.trim(),
      },
    },
  },
  argTypes: { tone: { control: 'inline-radio', options: ['light', 'dark'] } },
  args: { tone: 'light', currentHref: '/ergebnisse' },
};

export const Hell = { args: { tone: 'light' } };
export const Dunkel = { args: { tone: 'dark' } };
```

In `.storybook/preview.ts` `'AppNav'` in die `storySort`-Liste einfügen (nach `'Navigation'`).

- [ ] **Step 10: Parität, CSS-Pflichtliste, Exporte**

`parity.manifest.json`: Eintrag ergänzen:

```json
  "AppNav":    { "svelte": "svelte/AppNav.svelte",    "react": "react/AppNav.tsx",    "css": ["dss-appnav", "dss-appnav--dark", "dss-appnav-link", "dss-appnav-group-btn", "dss-appnav-panel", "dss-appnav-toggle"] }
```

`tests/components-css.test.ts`: in `REQUIRED` vor `// Icon` ergänzen:

```ts
  // AppNav (v0.8)
  'dss-appnav', 'dss-appnav--dark', 'dss-appnav-bar', 'dss-appnav-list', 'dss-appnav-item', 'dss-appnav-link',
  'dss-appnav-group-btn', 'dss-appnav-chev', 'dss-appnav-panel', 'dss-appnav-toggle', 'dss-appnav-context',
```

`package.json`, im Block `"exports"` nach `"./svelte/Skeleton"` ergänzen (Komma beachten):

```json
    "./svelte/AppNav": "./svelte/AppNav.svelte",
    "./svelte/Checkbox": "./svelte/Checkbox.svelte",
    "./appnav.js": "./js/appnav.js"
```

und in `"files"` `"js/",` nach `"icons/",` einfügen.

- [ ] **Step 11: Tests und Typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: alle grün (`AppNav` 11 React-Fälle, 6 Vanilla-Fälle, Parität `AppNav`).

- [ ] **Step 12: Commit**

```bash
git add css/components.css svelte/AppNav.svelte react/AppNav.tsx react/AppNav.test.tsx react/index.ts js tests parity.manifest.json package.json stories .storybook/preview.ts
git commit -m "feat: add AppNav (css, svelte, react, vanilla js)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Visueller Vergleich, Doku, Version 0.8.0, Abschlussprüfung

**Files:**
- Modify: `README.md`, `CHANGELOG.md`, `package.json`, `package-lock.json`, `tests/parity.test.ts`

- [ ] **Step 1: „Nachher“-Aufnahme und Vergleich**

```bash
npm run visual:after 2>&1 | tail -15
npm run visual:compare
```

Expected: Liste je Story `gleich` oder `ABWEICHT (N px)`. Erwartete, gewollte Abweichungen:
- `components-emptystate--*` (CTA jetzt `dss-btn`, Titel h3, Rahmenfarben über Aliase),
- leichte Tönungsunterschiede in Table-Kopf/Rahmenkopf (`--dss-*`-Aliase statt Roh-Tokens),
- Stepper-Punkte in `components-navigation--*` (Anzeige statt Button, gleiche Optik).

- [ ] **Step 2: Diffs einzeln bewerten**

Jedes `ABWEICHT`-PNG und das zugehörige `.visual/diff/<id>.png` per Read-Tool ansehen. Regel: Layoutverschiebungen, fehlende Elemente, abgeschnittene Texte, falsche Farben/Kontraste sind Fehler und werden im CSS (Task 3–6) korrigiert, danach Task-8-Step 1 wiederholen. Reine Nuancen der oben genannten Art werden im Task-Bericht dokumentiert und akzeptiert. Ergebnis (je Story: gleich / akzeptiert mit Begründung / behoben) in den PR-Text übernehmen.

- [ ] **Step 3: `PENDING_REACT` prüfen**

`tests/parity.test.ts`: `PENDING_REACT` muss jetzt genau diese sechs enthalten: `'PlayByPlay', 'BottomNav', 'Breadcrumbs', 'MatchCard', 'PlayerCard', 'Skeleton'`.

Run: `grep -n "PENDING_REACT = \[" -A 3 tests/parity.test.ts`
Expected: nur noch diese sechs Namen.

- [ ] **Step 4: CHANGELOG**

In `CHANGELOG.md` nach dem Kopfbereich (vor `## [0.7.0]`) einfügen:

```markdown
## [0.8.0] — Table, TopBar, EmptyState, Stepper, AppNav, Checkbox

Sechs weitere Komponenten in allen drei Varianten (Svelte, Vanilla-CSS, React). Das Scoped-CSS von
Table, TopBar, EmptyState und Stepper liegt jetzt in `css/components.css`; die Svelte-Dateien nutzen nur
noch `dss-*`-Klassen. Bereits vom Vereinsregister genutzte Klassen (`.dss-tbl`, `.dss-frame`,
`.dss-topbar`, `.dss-empty`) wurden nur ergänzt, nicht verändert.

### Neu
- **AppNav** (`svelte/AppNav.svelte`, `react/AppNav.tsx`, `js/appnav.js`): Hauptnavigation mit
  Gruppen-Dropdowns (Disclosure), gesperrten Einträgen (nicht fokussierbar, mit Hinweis), `aria-current`,
  Esc/Klick-außerhalb, Hamburger-Menü unter 720 px, Tonalität hell/dunkel, Kontext-Slot, `renderLink` für
  Router-Links (React). Export `@bbv/dss-design-system/appnav.js`.
- **Checkbox** (`dss-check*`): natives Kontrollkästchen, ganze Label-Fläche klickbar (44 px, kompakt 36 px),
  Hinweistext per `aria-describedby`.
- **Table** (React): Rahmenkopf mit Titel/Meta/Live, Dichten, Sortier-Pfeil mit `aria-sort`, Footer,
  dunkle Fläche, `caption` für Screenreader.
- **TopBar** (React): dunkle App-Leiste (`dss-topbar--dark`), Kontexte default/live/admin, Slots, optional
  als `header`-Landmark.
- **EmptyState** (React): Tonalitäten neutral/action/error, CTA oder freie `actions`, Überschriftenebene
  wählbar.
- **Stepper** (React): horizontal/kompakt/vertikal, `aria-current="step"`, Zustand per Screenreader-Text.
- Storybook: Stories für EmptyState, Checkbox, AppNav; `npm run visual:before|after|compare` für den
  Screenshot-Vergleich der Svelte-Stories.

### Geändert
- Svelte `EmptyState`: CTA nutzt `dss-btn`, Titel standardmäßig `h3` (vorher `h4`, per `titleAs`),
  neue Props `titleAs` und `actions`.
- Svelte `Stepper`: der Schritt-Punkt ist nur noch ein Button, wenn `onstep` gesetzt ist und der Schritt
  nicht `pending` ist; Zustand wird per Screenreader-Text angesagt, neue Prop `ariaLabel`.
- Svelte `Table`/`TopBar`: Innen-Klassen heißen jetzt `dss-frame-*` bzw. `dss-topbar-*`.
```

- [ ] **Step 5: README**

In `README.md`:
1. Verzeichnisbaum (Zeilen um 22–26): `Table, TopBar, EmptyState, Stepper` nicht mehr als Svelte-only kennzeichnen; neue Zeilen `AppNav.svelte  ← v0.8 · Hauptnavigation`, `Checkbox.svelte  ← v0.8 · Kontrollkästchen`, `js/appnav.js  ← v0.8 · Vanilla-Verhalten der AppNav` ergänzen; die Zeile `react/ ← v0.7 · React-Komponenten (…)` um `Checkbox, Table, TopBar, EmptyState, Stepper, AppNav` erweitern und auf `v0.8` ändern.
2. Installationsbefehl `#v0.7.0` → `#v0.8.0` (Zeile um 110) und den Beispiel-Import um `AppNav, Checkbox, Table` erweitern.
3. Neuen Abschnitt „AppNav ohne Framework“ am Ende anhängen:

````markdown
## AppNav ohne Framework

`css/components.css` + `js/appnav.js` genügen. Das Skript initialisiert alle `[data-dss-appnav]`.

```html
<link rel="stylesheet" href="…/tokens/tokens.css" />
<link rel="stylesheet" href="…/css/components.css" />

<nav class="dss-appnav dss-appnav--light" data-dss-appnav aria-label="Hauptnavigation">
  <div class="dss-appnav-bar">
    <button type="button" class="dss-appnav-toggle" data-appnav-toggle aria-expanded="false" aria-controls="nav-list">Menü</button>
    <ul class="dss-appnav-list" id="nav-list">
      <li class="dss-appnav-item"><a class="dss-appnav-link is-active" aria-current="page" href="/">Start</a></li>
      <li class="dss-appnav-item">
        <button type="button" class="dss-appnav-group-btn" data-appnav-group aria-expanded="false" aria-controls="nav-g1">Gruppe</button>
        <ul class="dss-appnav-panel" id="nav-g1" hidden>
          <li><a class="dss-appnav-link" href="/a">Seite A</a></li>
        </ul>
      </li>
    </ul>
  </div>
</nav>

<script type="module" src="…/js/appnav.js"></script>
```

Gesperrte Einträge: `<span role="link" aria-disabled="true" class="dss-appnav-link is-disabled" title="Hinweis">Label</span>`.
````

- [ ] **Step 6: Version setzen**

```bash
npm version 0.8.0 --no-git-tag-version
git diff --stat package.json package-lock.json
```

Expected: nur `version`-Felder geändert.

- [ ] **Step 7: Vollständige Prüfung**

```bash
npm test 2>&1 | tail -8
npm run typecheck
npm run build:react 2>&1 | tail -4
npx storybook build -o storybook-static --quiet 2>&1 | tail -3
npm pack --dry-run 2>&1 | grep -E "js/appnav.js|dist/react/index.js|css/components.css|svelte/AppNav.svelte|svelte/Checkbox.svelte"
```

Expected: Tests grün (Gesamtzahl höher als vor Task 0), `tsc` still, tsup-Build erfolgreich (`dist/react/index.js` und `.d.ts`), Storybook-Build ohne Fehler, `npm pack` listet alle fünf Dateien.

- [ ] **Step 8: Exports im gebauten Paket gegenprüfen**

Run: `node -e "import('./dist/react/index.js').then(m => console.log(['Table','TopBar','EmptyState','Stepper','AppNav','Checkbox'].map(n => n+':'+typeof m[n]).join(' ')))"`
Expected: `Table:function TopBar:function EmptyState:function Stepper:function AppNav:function Checkbox:object` (`Checkbox` ist ein `forwardRef`-Objekt; entscheidend ist, dass keiner `undefined` ist).

- [ ] **Step 9: Commit**

```bash
git add README.md CHANGELOG.md package.json package-lock.json tests/parity.test.ts
git commit -m "chore: release v0.8.0 (docs, changelog, version)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 10: Übergabe — nichts pushen**

Bericht an die Nutzerin/den Nutzer mit: Branch `feat/v0.8.0`, Commit-Liste (`git log --oneline main..HEAD`), Teststand, Ergebnis des visuellen Vergleichs (Step 2) und der Frage, ob gepusht und ein PR geöffnet werden soll. Nach Merge durch die Nutzerin/den Nutzer: Tag `v0.8.0` auf dem Merge-Commit setzen und pushen (ebenfalls erst nach Rückfrage); erst danach kann Plan 3b die Abhängigkeit auf `#v0.8.0` heben.

---

## Self-Review

**Spec-Abdeckung (3a-1):**
- Table, TopBar, EmptyState, Stepper, AppNav, Checkbox je Svelte + Vanilla-CSS + React → Tasks 2–7 ✔
- AppNav-Eigenschaften (tone, items Link/Gruppe, `renderLink`, Kontext-Slot, `aria-current`, gesperrte Einträge nicht fokussierbar mit Hinweis, Disclosure, Esc/Außenklick, Hamburger, `js/appnav.js`) → Task 7 ✔
- CSS-Extraktion nach `components.css`, Svelte ohne Scoped-CSS → Tasks 3–6 ✔; Konfliktbehandlung (`.dss-topbar`, `.dss-empty`, `.dss-tbl`) additiv über Modifier → Tasks 3–5 ✔
- Storybook-Vorher/Nachher mit `magick compare`, Vereinsregister-Klassen unverändert → Tasks 1 und 8 ✔
- `PENDING_REACT` verliert Table, TopBar, EmptyState, Stepper → Tasks 3–6, Prüfung Task 8 ✔
- Version 0.8.0, Exporte, CHANGELOG, README → Tasks 7–8 ✔

**Platzhalter-Scan:** keine „TBD/TODO/ähnlich wie“; alle Code-Schritte enthalten den vollständigen Code. Manuelle Doku-Schritte (README Schritt 1/2) nennen Ort und Inhalt konkret.

**Typ-Konsistenz:** `AppNavItem/AppNavLink/AppNavGroup/AppNavLinkRenderProps` (Task 7 Komponente, Export und Test identisch); `StepItem/StepState/StepperVariant`, `onStep` (React) vs. `onstep` (Svelte, bewusst Svelte-Konvention, im CHANGELOG erwähnt); `TableColumn.sort` ↔ `aria-sort`; `EmptyState`: React `cta`+`onCta`, Svelte `cta`+`onclick`; `titleAs` in beiden; `TopBar`: React `as`, kein Svelte-Pendant nötig (Svelte-Komponente rendert div).

**Bekannte, bewusst offene Punkte:** (1) Die Svelte-Variante der AppNav hat kein `renderLink`/`context`-Pendant (Svelte-Nutzer verwenden normale Links bzw. SvelteKit-`a`). (2) `ToneIcon` wiederholt die SVGs der Svelte-Vorlage statt Sprite-Icons, damit die Optik identisch bleibt.
