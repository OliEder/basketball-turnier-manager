# DSS-Migration Teil 1 — DSS-Repo (D1 + D2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das DSS-Repo (`OliEder/dss-design-system`) um fehlende CSS-Bausteine, zwei neue Svelte-Komponenten (Select, Banner) und ein vollständiges React-Paket (`react/`) erweitern und als **v0.7.0** veröffentlichen.

**Architecture:** Einzige CSS-Quelle ist `css/components.css`; React und die neuen Svelte-Komponenten rendern nur `dss-*`-Klassen. Das React-Paket wird mit `tsup` zu ESM + `.d.ts` gebaut (`prepare`-Script, damit Git-Dependencies sich selbst bauen). Modal nutzt Radix Dialog (`peerDependency`), Select ist ein natives `<select>`. Ein Paritäts-Test erzwingt, dass jede Komponente Svelte + CSS + React hat.

**Tech Stack:** CSS Custom Properties (OKLCH-Tokens), Svelte 5 + Storybook 10, React 18, TypeScript 5.8, tsup, Vitest 4 + Testing Library + axe-core, Radix Dialog.

**Spec:** `docs/superpowers/specs/2026-10-05-dss-migration-teil1-design.md` (im Turnier-Manager-Repo). Dieser Plan gehört zu Teil 1, PRs **D1** und **D2**. Der Plan für T1/T2 liegt in `2026-10-05-dss-migration-teil1-app.md` und setzt Release v0.7.0 voraus.

## Abweichungen vom Spec (bewusst, aus der Plan-Recherche)

1. **Select ist ein natives `<select>`, kein Radix-Select.** `css/components.css` enthält `dss-select` bereits als native Variante, der Rest des Turnier-Managers nutzt native Selects (E2E: `selectOption`), und nur `TournamentForm` hat drei Radix-Selects. Das spart eine Abhängigkeit und ist zugänglicher. Radix bleibt `peerDependency` nur für Modal.
2. **Die Übergangsschicht im Turnier-Manager ist nur das Tailwind-Mapping**, keine zusätzliche `legacy-fbnm-aliases.css`, weil nur `tailwind.config.ts` und `src/index.css` `--fbnm-*` verwenden (siehe App-Plan).

## Konventionen

- **Arbeitsverzeichnis** aller Schritte: das lokale Klon-Verzeichnis `~/01-vibe-coding/00-Basektball/dss-design-system` (Task 0).
- **Commit-Messages** enden mit der Zeile `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; **PR-Beschreibungen** enden mit `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Sprache: Doku und Kommentare deutsch (wie im Repo), Bezeichner englisch.
- Die Icon-Zahl in der README ("54 Glyphen") ist veraltet; der Sprite hat **67** Symbole. Das wird in Task 5 korrigiert.
- Der Sprite wird per `DOMParser` + `importNode` ins Dokument eingefügt, nicht als HTML-String (kein Injektions-Sink, und ein Test fängt kaputtes XML ab).

## Dateistruktur

| Datei | Verantwortung | Task |
|---|---|---|
| `css/components.css` | einzige CSS-Quelle; erweitert um danger/touch, Felder, Select, Banner, Modal, Tabs, Icon | 2 |
| `tests/components-css.test.ts` | prüft, dass alle benötigten Klassen definiert sind | 1 |
| `svelte/Select.svelte`, `svelte/Banner.svelte` | neue Svelte-Komponenten, nur `dss-*`-Klassen | 3 |
| `stories/Select.stories.ts`, `stories/Banner.stories.ts`, `stories/components/{Select,Banner}Demo.svelte` | Storybook | 3 |
| `DSS Design System - Forms.html`, `... - Modals.html` | Spec-Abschnitte Select, Modal-/Banner-Vanilla-CSS | 4 |
| `icons/sprite.ts` | gemeinsame Sprite- und Namensquelle für Svelte und React | 7 |
| `scripts/share-icon-sprite.mjs` | einmaliges Extraktions-Skript | 7 |
| `react/*.tsx` | React-Komponenten + Tests | 6–14 |
| `react/Field.tsx` | internes Label/Hilfetext/Zustand-Wrapper für TextInput und Select | 9 |
| `react/SeverityIcon.tsx` | gemeinsame Status-Icons für Banner und Modal | 8 |
| `parity.manifest.json`, `tests/parity.test.ts` | erzwingt die Dreier-Regel | 15 |
| `tsup.config.ts`, `vitest.config.ts`, `react/tsconfig.json` | Toolchain | 6 |

---

## PR D1: CSS-Bausteine + Svelte Select/Banner + Doku

### Task 0: Klon und Branch

- [ ] **Step 1: Klonen und Branch anlegen**

```bash
test -d ~/01-vibe-coding/00-Basektball/dss-design-system || \
  git clone https://github.com/OliEder/dss-design-system.git ~/01-vibe-coding/00-Basektball/dss-design-system
cd ~/01-vibe-coding/00-Basektball/dss-design-system
git checkout main && git pull --ff-only
git checkout -b feat/dss-css-modal-banner-select
npm ci
```

Expected: `npm ci` endet ohne Fehler, `git status` ist sauber.

### Task 1: Vitest-Grundgerüst + fehlschlagender CSS-Test

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/components-css.test.ts`
- Modify: `package.json` (Script `test`, devDependency `vitest`)

- [ ] **Step 1: Vitest installieren**

```bash
npm install --save-dev vitest@^4.1.11
```

- [ ] **Step 2: `vitest.config.ts` anlegen**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Script ergänzen** — in `package.json` unter `"scripts"` hinzufügen:

```json
    "test": "vitest run",
```

- [ ] **Step 4: Fehlschlagenden Test schreiben** — `tests/components-css.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const css = readFileSync(new URL('../css/components.css', import.meta.url), 'utf8');
const hasClass = (name: string) => new RegExp(`\\.${name}(?![\\w-])`).test(css);

// Klassen, die React-Paket und neue Svelte-Komponenten voraussetzen (v0.7).
const REQUIRED = [
  // Button
  'dss-btn--danger', 'is-touch',
  // Felder
  'dss-field-label', 'dss-field-help', 'dss-field-help--err', 'dss-field-help--ok',
  'dss-field-help--warn', 'is-error', 'is-ok', 'is-warn',
  'dss-input--default', 'dss-input--compact', 'dss-addon--right', 'dss-select--compact',
  // Banner
  'dss-banner', 'dss-banner--info', 'dss-banner--ok', 'dss-banner--warn', 'dss-banner--danger',
  'dss-banner-icon', 'dss-banner-body', 'dss-banner-title',
  // Modal
  'dss-backdrop', 'dss-modal-wrap', 'dss-modal', 'dss-modal--sm', 'dss-modal--wide', 'dss-modal--xwide',
  'dss-m-head', 'dss-m-head-icon', 'dss-m-head-icon--danger', 'dss-m-head-icon--warn',
  'dss-m-head-icon--ok', 'dss-m-head-icon--info', 'dss-m-head-text', 'dss-m-title',
  'dss-m-subtitle', 'dss-m-close', 'dss-m-body', 'dss-m-footer',
  // Tabs
  'dss-tabs--sm', 'dss-tabs--lg', 'dss-tabs--vertical', 'dss-tab-ic', 'dss-tab-count',
  // Icon
  'dss-icon',
];

describe('css/components.css', () => {
  it.each(REQUIRED)('definiert .%s', (name) => {
    expect(hasClass(name)).toBe(true);
  });
});
```

- [ ] **Step 5: Test ausführen, Fehlschlag bestätigen**

Run: `npm test`
Expected: FAIL — viele Fälle `definiert .dss-banner` usw. mit `expected false to be true`.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts tests/components-css.test.ts package.json package-lock.json
git commit -m "test: add CSS class coverage test for v0.7 components"
```

### Task 2: CSS-Ergänzungen in `components.css`

**Files:**
- Modify: `css/components.css` (am Dateiende anhängen)

- [ ] **Step 1: Block am Dateiende anhängen**

```css

/* ══════════════════════════════════════════════════════════════
   v0.7 · Ergänzungen: Button danger/touch, Felder, Banner, Modal,
   Tabs (sm/lg/vertical/Count), Icon
   ══════════════════════════════════════════════════════════════ */

/* ── Button · danger + Hallen-Touch ─────────────────────────── */
.dss-btn--danger { background: var(--err-button); color: var(--ink-0); border-radius: var(--radius-md); }
.dss-btn--danger:hover:not(:disabled) { filter: brightness(1.08); }
.dss-btn.is-touch { height: var(--touch-lg); padding: 0 24px; font-size: 16px; border-radius: var(--radius-lg); }

/* ── Felder · Label, Hilfetext, Zustände, Dichte ────────────── */
.dss-field-label { display: flex; align-items: baseline; gap: 6px; }
.dss-field-label .req { color: var(--err-text); font-weight: 700; }
.dss-field-label .opt {
  margin-left: auto; font-family: var(--font-mono); font-size: 10px;
  color: var(--dss-mute); text-transform: uppercase; letter-spacing: 0.06em;
}
.dss-field-help { font-size: 12px; line-height: 1.4; color: var(--dss-mute); }
.dss-field-help--err { color: var(--err-text); font-weight: 500; }
.dss-field-help--ok { color: var(--ok-text); font-weight: 500; }
.dss-field-help--warn { color: var(--warn-text); font-weight: 500; }
.dss-field.is-error .dss-input-group, .dss-field.is-error .dss-select { border-color: var(--err-fill); }
.dss-field.is-ok .dss-input-group, .dss-field.is-ok .dss-select { border-color: var(--ok-fill); }
.dss-field.is-warn .dss-input-group, .dss-field.is-warn .dss-select { border-color: var(--warn-fill); }
.dss-input--default { height: var(--fld-h-default); }
.dss-input--compact { height: var(--fld-h-compact); font-size: 14px; }
.dss-input:disabled, .dss-select:disabled { color: var(--dss-mute); cursor: not-allowed; }
.dss-addon--right { padding: 0 14px 0 0; }
.dss-select--compact { height: var(--fld-h-compact); }

/* ── Banner (dark-sicher über die Chip-Aliase) ──────────────── */
.dss-banner {
  display: flex; align-items: flex-start; gap: var(--space-3); padding: 12px 16px;
  border-radius: var(--radius-lg); font-size: 14px; line-height: 1.5;
  box-shadow: inset 0 0 0 1px color-mix(in oklch, currentColor 22%, transparent);
}
.dss-banner--info { background: var(--dss-chip-sky-bg); color: var(--dss-chip-sky-fg); }
.dss-banner--ok { background: var(--dss-chip-ok-bg); color: var(--dss-chip-ok-fg); }
.dss-banner--warn { background: var(--dss-chip-warn-bg); color: var(--dss-chip-warn-fg); }
.dss-banner--danger { background: var(--dss-chip-err-bg); color: var(--dss-chip-err-fg); }
.dss-banner-icon { flex-shrink: 0; width: 20px; height: 20px; margin-top: 2px; }
.dss-banner-body { flex: 1; min-width: 0; }
.dss-banner-title { margin: 0 0 2px; font-weight: 700; }
.dss-banner a { color: inherit; text-decoration: underline; text-underline-offset: 3px; }

/* ── Modal (aus svelte/Modal.svelte extrahiert, über --dss-* Aliase) ── */
.dss-backdrop {
  position: fixed; inset: 0; z-index: 100; background: var(--backdrop);
  backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
}
.dss-modal-wrap {
  position: fixed; inset: 0; z-index: 101; display: flex; align-items: center;
  justify-content: center; padding: 24px; pointer-events: none;
}
.dss-modal {
  pointer-events: auto; background: var(--dss-surface); color: var(--dss-fg);
  border-radius: var(--radius-xl); box-shadow: var(--shadow-xl);
  display: flex; flex-direction: column; max-height: calc(100vh - 48px);
  overflow: hidden; width: 480px; max-width: 100%;
}
.dss-modal:focus { outline: none; }
.dss-modal--sm { width: 380px; }
.dss-modal--wide { width: 560px; }
.dss-modal--xwide { width: 720px; }
.dss-m-head { display: flex; align-items: flex-start; gap: 16px; padding: 22px 24px 12px; }
.dss-m-head-icon {
  width: 36px; height: 36px; border-radius: var(--radius-md); flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.dss-m-head-icon svg { width: 16px; height: 16px; }
.dss-m-head-icon--danger { background: var(--dss-chip-err-bg); color: var(--dss-chip-err-fg); }
.dss-m-head-icon--warn { background: var(--dss-chip-warn-bg); color: var(--dss-chip-warn-fg); }
.dss-m-head-icon--ok { background: var(--dss-chip-ok-bg); color: var(--dss-chip-ok-fg); }
.dss-m-head-icon--info { background: var(--dss-chip-sky-bg); color: var(--dss-chip-sky-fg); }
.dss-m-head-text { flex: 1; min-width: 0; }
.dss-m-title { margin: 0; font-family: var(--font-display); font-weight: 700; font-size: 20px; color: var(--dss-fg); }
.dss-m-subtitle {
  margin: 4px 0 0; font-family: var(--font-mono); font-size: 11px; color: var(--dss-mute);
  text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600;
}
.dss-m-close {
  appearance: none; border: 0; background: var(--dss-surface-2); color: var(--dss-fg-soft);
  width: 32px; height: 32px; border-radius: var(--radius-md); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.dss-m-close:hover { background: var(--dss-line); }
.dss-m-close:focus-visible { outline: var(--ring-w) solid var(--ring-color); outline-offset: 2px; }
.dss-m-body {
  padding: 4px 24px 20px; overflow-y: auto; flex: 1; min-height: 0;
  color: var(--dss-fg-soft); font-size: 14.5px; line-height: 1.55;
}
.dss-m-footer {
  display: flex; align-items: center; justify-content: flex-end; gap: 8px;
  padding: 16px 24px 20px; border-top: 1px solid var(--dss-line); background: var(--dss-surface-2);
}

/* ── Tabs · Größen, vertical, Icon, Count, disabled ─────────── */
.dss-tabs--sm .dss-tab { min-height: 36px; padding: 0 10px; font-size: 13px; }
.dss-tabs--lg .dss-tab { min-height: 56px; padding: 0 18px; font-size: 15px; }
.dss-tab-ic { flex-shrink: 0; }
.dss-tab-count {
  display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 18px;
  padding: 0 6px; font-family: var(--font-mono); font-size: 11px; font-weight: 700;
  color: var(--dss-mute); background: var(--dss-surface-2); border-radius: var(--radius-full);
}
.dss-tab.is-active .dss-tab-count, .dss-tab[aria-selected="true"] .dss-tab-count,
.dss-tab[aria-pressed="true"] .dss-tab-count { background: var(--dss-btn-bg); color: var(--dss-btn-fg); }
.dss-tab:disabled, .dss-tab.is-disabled { opacity: 0.45; cursor: not-allowed; }
.dss-tabs--vertical { flex-direction: column; gap: 2px; align-items: stretch; min-width: 220px; }
.dss-tabs--vertical .dss-tab { justify-content: flex-start; padding: 10px 14px; border-radius: var(--radius-md); }
.dss-tabs--vertical .dss-tab:hover:not(.is-active):not(.is-disabled) { background: var(--dss-surface-2); }
.dss-tabs--vertical .dss-tab.is-active, .dss-tabs--vertical .dss-tab[aria-selected="true"] {
  background: var(--dss-surface-2); color: var(--dss-fg); box-shadow: inset 3px 0 0 var(--amber-400);
}

/* ── Icon ───────────────────────────────────────────────────── */
.dss-icon { display: inline-block; vertical-align: -0.15em; color: currentColor; flex-shrink: 0; }
```

- [ ] **Step 2: Test ausführen**

Run: `npm test`
Expected: PASS — alle Fälle von `css/components.css` grün.

- [ ] **Step 3: Commit**

```bash
git add css/components.css
git commit -m "feat(css): add danger/touch buttons, field states, banner, modal, tabs extras and icon"
```

### Task 3: Svelte `Select` und `Banner` + Stories

**Files:**
- Create: `svelte/Select.svelte`
- Create: `svelte/Banner.svelte`
- Create: `stories/components/SelectDemo.svelte`, `stories/components/BannerDemo.svelte`
- Create: `stories/Select.stories.ts`, `stories/Banner.stories.ts`
- Modify: `.storybook/preview.ts` (components.css einbinden, Story-Reihenfolge)
- Modify: `package.json` (`exports`: `./svelte/Select`, `./svelte/Banner`)

- [ ] **Step 1: `svelte/Select.svelte` anlegen**

```svelte
<script lang="ts">
  /**
   * DSS Select · Svelte 5
   * --------------------------------------------------------------
   * Natives <select> im DSS-Look. Nutzt ausschließlich die Klassen aus
   * css/components.css (kein eigener Scoped-Style) — tokens.css und
   * components.css müssen im App-Root importiert sein.
   */
  type State = 'default' | 'error' | 'ok' | 'warn';
  type Density = 'default' | 'compact';
  type Option = { value: string; label: string; disabled?: boolean };

  let {
    label = '',
    value = $bindable(''),
    options,
    help = '',
    state = 'default',
    density = 'default',
    disabled = false,
    required = false,
    id = undefined,
    name = undefined,
    onchange,
  }: {
    label?: string;
    value?: string;
    options: Option[];
    help?: string;
    state?: State;
    density?: Density;
    disabled?: boolean;
    required?: boolean;
    id?: string;
    name?: string;
    onchange?: (e: Event) => void;
  } = $props();

  const uid = $props.id();
  const selectId = $derived(id ?? `dss-select-${uid}`);
  const helpId = $derived(`${selectId}-help`);
</script>

<div class="dss-field" class:is-error={state === 'error'} class:is-ok={state === 'ok'} class:is-warn={state === 'warn'}>
  {#if label}
    <label class="dss-field-label" for={selectId}>
      {label}
      {#if required}<span class="req" aria-hidden="true">*</span>{/if}
    </label>
  {/if}

  <select
    id={selectId}
    {name}
    {disabled}
    {required}
    class="dss-select"
    class:dss-select--compact={density === 'compact'}
    aria-invalid={state === 'error' ? 'true' : undefined}
    aria-describedby={help ? helpId : undefined}
    bind:value
    {onchange}
  >
    {#each options as option (option.value)}
      <option value={option.value} disabled={option.disabled}>{option.label}</option>
    {/each}
  </select>

  {#if help}
    <div
      id={helpId}
      class="dss-field-help"
      class:dss-field-help--err={state === 'error'}
      class:dss-field-help--ok={state === 'ok'}
      class:dss-field-help--warn={state === 'warn'}
    >
      {help}
    </div>
  {/if}
</div>
```

- [ ] **Step 2: `svelte/Banner.svelte` anlegen**

```svelte
<script lang="ts">
  /**
   * DSS Banner · Svelte 5
   * --------------------------------------------------------------
   * Inline-Hinweis (info · ok · warn · danger). Nutzt nur die Klassen aus
   * css/components.css. `role` ist standardmäßig "alert" für warn/danger
   * und "status" für info/ok.
   */
  import type { Snippet } from 'svelte';

  type Severity = 'info' | 'ok' | 'warn' | 'danger';

  let {
    severity = 'info',
    title = '',
    icon = true,
    role = undefined,
    children,
  }: {
    severity?: Severity;
    title?: string;
    icon?: boolean;
    role?: 'alert' | 'status' | 'none';
    children: Snippet;
  } = $props();

  const resolvedRole = $derived(role ?? (severity === 'warn' || severity === 'danger' ? 'alert' : 'status'));
</script>

<div class="dss-banner dss-banner--{severity}" role={resolvedRole}>
  {#if icon}
    <svg class="dss-banner-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      {#if severity === 'danger'}
        <g stroke-width="1.8"><circle cx="8" cy="8" r="6.5" /><path d="M5.2 10.8l5.6-5.6" /></g>
      {:else if severity === 'warn'}
        <g stroke-width="1.8"><path d="M8 1.5L15 14H1z" /><path d="M8 6v3M8 11.5v.05" /></g>
      {:else if severity === 'ok'}
        <g stroke-width="2.2"><path d="M3 8.2l3.5 3.5L13 5" /></g>
      {:else}
        <g stroke-width="1.8"><circle cx="8" cy="8" r="6.5" /><path d="M8 7v4M8 4.5v.05" /></g>
      {/if}
    </svg>
  {/if}
  <div class="dss-banner-body">
    {#if title}<p class="dss-banner-title">{title}</p>{/if}
    {@render children()}
  </div>
</div>
```

- [ ] **Step 3: Demos anlegen** — `stories/components/SelectDemo.svelte`:

```svelte
<script>
  import Select from '../../svelte/Select.svelte';

  let {
    label = 'Turniermodus',
    state = 'default',
    density = 'default',
    disabled = false,
    required = false,
    help = '',
  } = $props();

  const options = [
    { value: 'round-robin', label: 'Jeder gegen Jeden' },
    { value: 'round-robin+finals', label: 'Gruppenphase + Endrunde' },
    { value: 'swiss', label: 'Einstufungsturnier (Schweizer System)' },
  ];
  let value = $state('round-robin');
</script>

<div style="max-width: 360px">
  <Select {label} {options} {state} {density} {disabled} {required} {help} bind:value />
</div>
```

`stories/components/BannerDemo.svelte`:

```svelte
<script>
  import Banner from '../../svelte/Banner.svelte';

  let { severity = 'info', title = '', icon = true, body = 'Geschätzte Gesamtdauer: 180 Minuten.' } = $props();
</script>

<div style="max-width: 560px">
  <Banner {severity} {title} {icon}>{body}</Banner>
</div>
```

- [ ] **Step 4: Stories anlegen** — `stories/Select.stories.ts`:

```ts
import SelectDemo from './components/SelectDemo.svelte';

export default {
  title: 'Components/Select',
  component: SelectDemo,
  tags: ['autodocs'],
  argTypes: {
    state:    { control: 'inline-radio', options: ['default', 'error', 'ok', 'warn'] },
    density:  { control: 'inline-radio', options: ['default', 'compact'] },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
    label:    { control: 'text' },
    help:     { control: 'text' },
  },
  args: { label: 'Turniermodus', state: 'default', density: 'default', disabled: false, required: false, help: '' },
};

export const Standard = {};
export const Pflichtfeld = { args: { required: true } };
export const Kompakt = { args: { density: 'compact' } };
export const Fehler = { args: { state: 'error', help: 'Bitte einen Modus wählen.' } };
export const Deaktiviert = { args: { disabled: true } };
```

`stories/Banner.stories.ts`:

```ts
import BannerDemo from './components/BannerDemo.svelte';

export default {
  title: 'Components/Banner',
  component: BannerDemo,
  tags: ['autodocs'],
  argTypes: {
    severity: { control: 'inline-radio', options: ['info', 'ok', 'warn', 'danger'] },
    icon:     { control: 'boolean' },
    title:    { control: 'text' },
    body:     { control: 'text' },
  },
  args: { severity: 'info', title: '', icon: true, body: 'Geschätzte Gesamtdauer: 180 Minuten.' },
};

export const Info = {};
export const Erfolg = { args: { severity: 'ok', body: 'Spielplan gespeichert.' } };
export const Warnung = { args: { severity: 'warn', title: 'Hallenzeit knapp', body: 'Das passt nur mit weniger Runden in die verfügbare Hallenzeit.' } };
export const Fehler = { args: { severity: 'danger', title: 'Export fehlgeschlagen', body: 'Bitte erneut versuchen.' } };
export const OhneIcon = { args: { icon: false } };
```

- [ ] **Step 5: `.storybook/preview.ts` anpassen** — nach `import '../tokens/tokens.css';` ergänzen:

```ts
import '../css/components.css';
```

und in `storySort.order` den `Components`-Eintrag ersetzen durch:

```ts
          'Components', ['Button', 'TextInput', 'Select', 'Modal', 'Banner', 'Card', 'Card Library', 'Tabs', 'Navigation', 'Table', 'PlayByPlay', 'Icon'],
```

- [ ] **Step 6: `package.json` — `exports` ergänzen** (nach der Zeile `"./svelte/Icon": ...`):

```json
    "./svelte/Select":      "./svelte/Select.svelte",
    "./svelte/Banner":      "./svelte/Banner.svelte",
```

- [ ] **Step 7: Storybook-Build prüfen**

Run: `npm run build-storybook`
Expected: Build endet ohne Fehler, `storybook-static/` entsteht (nicht committen, steht in `.gitignore`).

- [ ] **Step 8: Commit**

```bash
git add svelte/Select.svelte svelte/Banner.svelte stories .storybook/preview.ts package.json
git commit -m "feat(svelte): add Select and Banner components with stories"
```

### Task 4: HTML-Spec-Abschnitte (Forms, Modals)

Die HTML-Dateien sind eigenständige Spec-Seiten mit eigenem eingebettetem CSS. Neue Abschnitte dokumentieren Klassen und Markup als Code-Snippet; Live-Demos liegen im Storybook.

**Files:**
- Modify: `DSS Design System - Forms.html`
- Modify: `DSS Design System - Modals.html`

- [ ] **Step 1: Forms — Abschnitt 06 Select anhängen.** Mit dem Edit-Tool in `DSS Design System - Forms.html` zuerst die letzte Section öffnen:

`old_string`: `<section class="s" data-screen-label="05 Live Scoring" style="border-bottom: 0;">`
`new_string`: `<section class="s" data-screen-label="05 Live Scoring">`

Dann vor `<div class="foot">` einfügen (`old_string`: `  <div class="foot">`, `new_string`: Abschnitt + `  <div class="foot">`):

```html
  <section class="s" data-screen-label="06 Select" style="border-bottom: 0;">
    <div class="s-head">
      <div class="s-num">06 — Select</div>
      <div class="s-title">
        <h2>Natives Select im DSS-Look.</h2>
        <p>
          Bewusst ein natives <code>&lt;select&gt;</code>: Tastatur, Screenreader und Mobile-Picker kommen vom
          Betriebssystem. Verfügbar als Svelte-Komponente, als Vanilla-CSS (<code>dss-select</code>) und als
          React-Komponente. Live-Demos: Storybook, Components / Select.
        </p>
      </div>
    </div>
    <div class="s-body">
<pre style="background:#f4f4f2;padding:16px;border-radius:8px;overflow:auto;font-size:13px">&lt;div class="dss-field"&gt;
  &lt;label class="dss-field-label" for="modus"&gt;Turniermodus&lt;/label&gt;
  &lt;select id="modus" class="dss-select"&gt;
    &lt;option value="round-robin"&gt;Jeder gegen Jeden&lt;/option&gt;
    &lt;option value="swiss"&gt;Schweizer System&lt;/option&gt;
  &lt;/select&gt;
&lt;/div&gt;

Modifier: dss-select--compact (36 px) · Zustände auf dem Wrapper: is-error · is-ok · is-warn
Hilfetext: &lt;div class="dss-field-help dss-field-help--err"&gt;…&lt;/div&gt;</pre>
    </div>
  </section>

```

Und die Fußzeile ersetzen: `Input-Types · States · Spielbericht-Setup · Team-Config · Live Scoring · Follow-Up-Dialoge` → `Input-Types · States · Spielbericht-Setup · Team-Config · Live Scoring · Follow-Up-Dialoge · Select`.

- [ ] **Step 2: Modals — Abschnitt 07 Vanilla-CSS anhängen.** In `DSS Design System - Modals.html`:

`old_string`: `<section class="s" data-screen-label="06 Endbericht" style="border-bottom: 0;">`
`new_string`: `<section class="s" data-screen-label="06 Endbericht">`

Vor `  <div class="foot">` einfügen:

```html
  <section class="s" data-screen-label="07 Vanilla CSS" style="border-bottom: 0;">
    <div class="s-head">
      <div class="s-num">07 — Vanilla CSS &amp; React</div>
      <div class="s-title">
        <h2>Modal und Banner ohne Framework.</h2>
        <p>
          <code>css/components.css</code> enthält <code>dss-modal*</code> und <code>dss-banner*</code>.
          Dasselbe Markup rendern die Svelte- und React-Komponenten. Das React-Modal nutzt Radix Dialog
          (Fokus-Falle, Escape, ARIA); <code>dismissOnBackdrop={false}</code> verhindert das Schließen per Klick
          außerhalb. Live-Demos: Storybook, Components / Modal und Banner.
        </p>
      </div>
    </div>
    <div class="s-body">
<pre style="background:#f4f4f2;padding:16px;border-radius:8px;overflow:auto;font-size:13px">&lt;!-- Banner: severity = info | ok | warn | danger --&gt;
&lt;div class="dss-banner dss-banner--warn" role="alert"&gt;
  &lt;div class="dss-banner-body"&gt;
    &lt;p class="dss-banner-title"&gt;Hallenzeit knapp&lt;/p&gt;
    Rundenzahl reduzieren oder mehr Felder einplanen.
  &lt;/div&gt;
&lt;/div&gt;

&lt;!-- Modal: Größen dss-modal--sm | (md) | --wide | --xwide --&gt;
&lt;div class="dss-backdrop"&gt;&lt;/div&gt;
&lt;div class="dss-modal-wrap"&gt;
  &lt;div class="dss-modal" role="dialog" aria-modal="true" aria-labelledby="t"&gt;
    &lt;div class="dss-m-head"&gt;
      &lt;div class="dss-m-head-icon dss-m-head-icon--danger"&gt;…&lt;/div&gt;
      &lt;div class="dss-m-head-text"&gt;&lt;h2 class="dss-m-title" id="t"&gt;Turnier löschen?&lt;/h2&gt;&lt;/div&gt;
    &lt;/div&gt;
    &lt;div class="dss-m-body"&gt;…&lt;/div&gt;
    &lt;div class="dss-m-footer"&gt;&lt;button class="dss-btn dss-btn--ghost dss-btn--md"&gt;Abbrechen&lt;/button&gt;&lt;/div&gt;
  &lt;/div&gt;
&lt;/div&gt;</pre>
    </div>
  </section>

```

Fußzeile: `Anatomy · 4 Confirms · 2 Sheets · Drawer · 3 Toasts · 4 Banner · 3 Popover · Endbericht` → `Anatomy · 4 Confirms · 2 Sheets · Drawer · 3 Toasts · 4 Banner · 3 Popover · Endbericht · Vanilla CSS`.

- [ ] **Step 3: Prüfen, dass das HTML noch wohlgeformt ist**

Run:

```bash
grep -c '<section' "DSS Design System - Forms.html" "DSS Design System - Modals.html"
grep -c '</section>' "DSS Design System - Forms.html" "DSS Design System - Modals.html"
```

Expected: je Datei gleiche Anzahl öffnender und schließender Tags (Forms: 6/6, Modals: 7/7).

- [ ] **Step 4: Commit**

```bash
git add "DSS Design System - Forms.html" "DSS Design System - Modals.html"
git commit -m "docs: document Select, Banner and Modal vanilla CSS in the spec pages"
```

### Task 5: CHANGELOG, README und PR D1

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `README.md`

- [ ] **Step 1: CHANGELOG** — im Abschnitt `## [Unreleased] — Vanilla-CSS-Komponenten` unter `### Neu` anhängen:

```markdown
- `dss-btn--danger`, `dss-btn.is-touch`; Feld-Bausteine `dss-field-help*`, Zustände `is-error|ok|warn`,
  Dichte `dss-input--default|compact`, `dss-select--compact`, `dss-addon--right`.
- `dss-banner*` (info · ok · warn · danger) und `dss-modal*` (aus `svelte/Modal.svelte` extrahiert,
  dark-sicher über die `--dss-*`-Aliase).
- Tabs: Größen `sm|lg`, Variante `vertical`, `dss-tab-count`, `dss-tab-ic`; `dss-icon`.
- Svelte: neue Komponenten `Select` (natives `<select>`) und `Banner`, beide nur mit `dss-*`-Klassen.
- Storybook lädt jetzt `css/components.css`; Stories für Select und Banner.
- Tests: `tests/components-css.test.ts` (Vitest) prüft die benötigten Klassen.
```

- [ ] **Step 2: README** — in der Struktur-Übersicht (`## Was ist drin`) die Zeile `Icon.svelte  ← v0.6 (54 Glyphen)` ersetzen durch `Icon.svelte  ← v0.6 (67 Glyphen)` und unter `svelte/` ergänzen:

```
  Select.svelte         ← v0.7 · natives <select> im DSS-Look
  Banner.svelte         ← v0.7 · Inline-Hinweis
```

Außerdem im Abschnitt „Komponenten-Referenzen“ die Tabellenzeile `| **Icons** *(v0.6)* | 54 Glyphen: …` auf `67 Glyphen` ändern.

- [ ] **Step 3: Verifikation**

Run: `npm test && npm run build-storybook`
Expected: Tests grün, Storybook-Build ohne Fehler.

- [ ] **Step 4: Commit, Push, PR D1**

```bash
git add CHANGELOG.md README.md
git commit -m "docs: changelog and readme for v0.7 css additions"
git push -u origin feat/dss-css-modal-banner-select
gh pr create --base main --title "feat: v0.7 CSS-Bausteine, Svelte Select/Banner, Modal-CSS" --body "$(cat <<'EOF'
## Inhalt
- `css/components.css`: danger/touch-Button, Feld-Zustände und -Dichte, Banner, Modal (aus Svelte extrahiert), Tabs-Extras, Icon
- Svelte: neue Komponenten `Select` (nativ) und `Banner`, nur mit `dss-*`-Klassen
- Storybook lädt `components.css`; Stories für Select und Banner
- Spec-Seiten Forms/Modals um Select, Modal- und Banner-CSS ergänzt
- Vitest-Test für die CSS-Klassen

## Test
- `npm test`, `npm run build-storybook`

Voraussetzung für das React-Paket (D2) und die Migration des Turnier-Managers.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Auf Merge warten.** D2 beginnt erst, wenn D1 in `main` gemergt ist (D2 setzt die neuen CSS-Klassen voraus).

---

## PR D2: React-Paket + Build + Release v0.7.0

### Task 6: Toolchain

**Files:**
- Modify: `package.json`
- Create: `react/tsconfig.json`, `tsup.config.ts`, `react/test-setup.ts`, `react/test-utils.ts`, `react/cn.ts`, `react/cn.test.ts`
- Modify: `vitest.config.ts`

- [ ] **Step 1: Branch von aktuellem `main`**

```bash
cd ~/01-vibe-coding/00-Basektball/dss-design-system
git checkout main && git pull --ff-only
git checkout -b feat/react-package
```

- [ ] **Step 2: Abhängigkeiten installieren**

```bash
npm install --save-dev react@^18.3.1 react-dom@^18.3.1 @types/react@^18.3.31 @types/react-dom@^18.3.7 \
  @radix-ui/react-dialog@^1.1.21 typescript@~5.8.3 tsup@^8.5.0 jsdom@^29.1.1 \
  @testing-library/react@^16.3.2 @testing-library/jest-dom@^7.0.0 axe-core@^4.11.0
```

Expected: Installation ohne Fehler. Schlägt eine Version fehl, die nächstkleinere kompatible Minor-Version nehmen und im PR vermerken.

- [ ] **Step 3: `package.json` — Felder anpassen** (jeweils den betreffenden Block ersetzen bzw. ergänzen):

`"version"`: `"0.7.0"`

`"exports"` — folgende Einträge **zusätzlich** (nach `"./tailwind"`):

```json
    "./components.css": "./css/components.css",
    "./react": {
      "types":  "./dist/react/index.d.ts",
      "import": "./dist/react/index.js"
    },
```

`"files"`:

```json
  "files": [
    "tokens/",
    "css/",
    "icons/",
    "svelte/",
    "dist/",
    "README.md",
    "CHANGELOG.md"
  ],
```

`"scripts"` — zusätzlich:

```json
    "build:react":  "tsup",
    "typecheck":    "tsc -p react/tsconfig.json --noEmit",
    "prepare":      "npm run build:react",
```

`"peerDependencies"` und `"peerDependenciesMeta"` — zusätzlich:

```json
    "react":                  "^18.0.0",
    "react-dom":              "^18.0.0",
    "@radix-ui/react-dialog": "^1.1.0"
```

```json
    "react":                  { "optional": true },
    "react-dom":              { "optional": true },
    "@radix-ui/react-dialog": { "optional": true }
```

`"repository"."url"`: `"git+https://github.com/OliEder/dss-design-system.git"`

`"keywords"` — zusätzlich `"react"`.

- [ ] **Step 4: `react/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["./**/*.ts", "./**/*.tsx", "../icons/**/*.ts"]
}
```

- [ ] **Step 5: `tsup.config.ts`**

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { 'react/index': 'react/index.ts' },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  outDir: 'dist',
  tsconfig: 'react/tsconfig.json',
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
});
```

- [ ] **Step 6: `vitest.config.ts` auf jsdom umstellen**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./react/test-setup.ts'],
    include: ['react/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 7: `react/test-setup.ts` und `react/test-utils.ts`**

```ts
// react/test-setup.ts
import '@testing-library/jest-dom/vitest';
```

```ts
// react/test-utils.ts
import axe from 'axe-core';
import { expect } from 'vitest';

/** axe-Lauf ohne Kontrast (jsdom hat kein Layout) und ohne Landmark-Regel (Komponenten-Ausschnitt). */
export async function expectNoA11yViolations(root: Element = document.body): Promise<void> {
  const results = await axe.run(root, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}
```

- [ ] **Step 8: Fehlschlagenden Test für `cn` schreiben** — `react/cn.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('verbindet Klassen mit Leerzeichen', () => {
    expect(cn('a', 'b')).toBe('a b');
  });
  it('ignoriert falsy-Werte', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b');
  });
  it('liefert einen leeren String ohne Eingabe', () => {
    expect(cn()).toBe('');
  });
});
```

Run: `npx vitest run react/cn.test.ts`
Expected: FAIL — `Cannot find module './cn'`.

- [ ] **Step 9: `react/cn.ts` implementieren**

```ts
/** Minimaler Klassen-Join ohne Abhängigkeit (kein Tailwind-Merge im Paket). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
```

Run: `npx vitest run react/cn.test.ts`
Expected: PASS (3 Tests).

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json react tsup.config.ts vitest.config.ts
git commit -m "build: add react toolchain (tsup, vitest/jsdom, axe) and cn helper"
```

### Task 7: Gemeinsamer Icon-Sprite + `Icon`

**Files:**
- Create: `scripts/share-icon-sprite.mjs`
- Create (generiert): `icons/sprite.ts`
- Modify (generiert): `svelte/Icon.svelte`
- Create: `react/Icon.tsx`, `react/Icon.test.tsx`

- [ ] **Step 1: Extraktions-Skript** — `scripts/share-icon-sprite.mjs`:

```js
// Einmaliges Skript: zieht Namen + Sprite aus svelte/Icon.svelte nach icons/sprite.ts und lässt
// Icon.svelte dieselbe Quelle importieren (damit Svelte und React einen Sprite teilen).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const svelteFile = 'svelte/Icon.svelte';
const src = readFileSync(svelteFile, 'utf8');

const names = src.match(/export const ICON_NAMES = (\[[\s\S]*?\]) as const;/);
const sprite = src.match(/const SPRITE = `([\s\S]*?)`;/);
const header = src.match(/<script lang="ts" module>\s*(\/\*\*[\s\S]*?\*\/)/);
if (!names || !sprite || !header) {
  throw new Error('svelte/Icon.svelte hat nicht mehr die erwartete Struktur — Skript anpassen.');
}

mkdirSync('icons', { recursive: true });
writeFileSync(
  'icons/sprite.ts',
  `/**
 * DSS Icon-Sprite · gemeinsame Quelle für svelte/Icon.svelte und react/Icon.tsx.
 * Namen und Symbole stammen 1:1 aus der Icons-Spec (DSS Design System - Icons.html).
 */
export const ICON_NAMES = ${names[1]} as const;

export type IconName = typeof ICON_NAMES[number];

export const SPRITE_ID = 'dss-icon-sprite';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Der Sprite als SVG-Quelltext (ohne Namespace, siehe parseSprite). */
export const SPRITE = \`${sprite[1]}\`;

/** Parst den Sprite zu einem SVG-Element (kein HTML-String-Einfügen, kaputtes XML fällt im Test auf). */
export function parseSprite(): SVGElement {
  const xml = SPRITE.replace('<svg ', \`<svg xmlns="\${SVG_NS}" \`);
  const doc = new DOMParser().parseFromString(xml, 'image/svg+xml');
  return doc.documentElement as unknown as SVGElement;
}
`,
);

const moduleEnd = src.indexOf('</script>') + '</script>'.length;
const rest = src.slice(moduleEnd);

writeFileSync(
  svelteFile,
  `<script lang="ts" module>
  ${header[1]}

  import { ICON_NAMES, SPRITE_ID, parseSprite, type IconName } from '../icons/sprite';

  export { ICON_NAMES };
  export type { IconName };

  // ── Sprite wird beim ersten Gebrauch einmal ins Dokument eingefügt ──
  export function ensureSprite() {
    if (typeof document === 'undefined' || document.getElementById(SPRITE_ID)) return;
    const wrap = document.createElement('div');
    wrap.id = SPRITE_ID;
    wrap.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.appendChild(document.importNode(parseSprite(), true));
    document.body.insertBefore(wrap, document.body.firstChild);
  }
</script>${rest}`,
);
console.log(`icons/sprite.ts geschrieben, ${svelteFile} umgestellt.`);
```

- [ ] **Step 2: Skript ausführen und Ergebnis prüfen**

```bash
node scripts/share-icon-sprite.mjs
node -e "
const s=require('fs').readFileSync('icons/sprite.ts','utf8');
console.log('symbols', (s.match(/<symbol id=/g)||[]).length);
"
head -22 svelte/Icon.svelte
```

Expected: `symbols 67`; `svelte/Icon.svelte` beginnt mit `<script lang="ts" module>`, dem Header-Kommentar und dem Import aus `../icons/sprite`; der zweite `<script lang="ts">`-Block (`onMount(ensureSprite)`) und das Markup sind unverändert.

- [ ] **Step 3: Storybook-Build prüfen** (Svelte-Icon importiert jetzt aus `icons/`)

Run: `npm run build-storybook`
Expected: Build ohne Fehler.

- [ ] **Step 4: Fehlschlagenden Test schreiben** — `react/Icon.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Icon } from './Icon';
import { ICON_NAMES, SPRITE } from '../icons/sprite';
import { expectNoA11yViolations } from './test-utils';

describe('Icon', () => {
  it('ist ohne title dekorativ (aria-hidden)', () => {
    const { container } = render(<Icon name="trophy" />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).not.toHaveAttribute('aria-label');
    expect(svg.querySelector('use')).toHaveAttribute('href', '#i-trophy');
  });

  it('wird mit title zum beschrifteten Bild', () => {
    render(<Icon name="warn" title="Warnung" />);
    expect(screen.getByRole('img', { name: 'Warnung' })).toBeInTheDocument();
  });

  it('übernimmt size und className', () => {
    const { container } = render(<Icon name="home" size={16} className="extra" />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('width', '16');
    expect(svg).toHaveAttribute('height', '16');
    expect(svg).toHaveClass('dss-icon', 'extra');
  });

  it('fügt den Sprite genau einmal ein und parst alle Symbole', () => {
    render(
      <>
        <Icon name="home" />
        <Icon name="trophy" />
      </>,
    );
    expect(document.querySelectorAll('#dss-icon-sprite')).toHaveLength(1);
    // Fängt kaputtes XML ab: bei einem Parse-Fehler gäbe es kein einziges <symbol>.
    expect(document.querySelectorAll('#dss-icon-sprite symbol')).toHaveLength(ICON_NAMES.length);
  });

  it('hat für jeden Namen ein Symbol im Sprite', () => {
    for (const name of ICON_NAMES) {
      expect(SPRITE, `Symbol i-${name}`).toContain(`id="i-${name}"`);
    }
  });

  it('hat keine axe-Verstöße', async () => {
    const { container } = render(<Icon name="trophy" title="Pokal" />);
    await expectNoA11yViolations(container);
  });
});
```

Run: `npx vitest run react/Icon.test.tsx`
Expected: FAIL — `Cannot find module './Icon'`.

- [ ] **Step 5: `react/Icon.tsx` implementieren**

```tsx
import { useEffect, type SVGAttributes } from 'react';
import { SPRITE_ID, parseSprite, type IconName } from '../icons/sprite';
import { cn } from './cn';

export { ICON_NAMES, type IconName } from '../icons/sprite';

/** Fügt den gemeinsamen Sprite einmal pro Dokument ein. */
export function ensureSprite(): void {
  if (typeof document === 'undefined' || document.getElementById(SPRITE_ID)) return;
  const wrap = document.createElement('div');
  wrap.id = SPRITE_ID;
  wrap.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.appendChild(document.importNode(parseSprite(), true));
  document.body.insertBefore(wrap, document.body.firstChild);
}

export interface IconProps extends Omit<SVGAttributes<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number | string;
  /** Mit title wird das Icon als Bild angesagt, ohne title ist es dekorativ. */
  title?: string;
}

export function Icon({ name, size = 24, title, className, ...rest }: IconProps) {
  useEffect(ensureSprite, []);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cn('dss-icon', className)}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <use href={`#i-${name}`} />
    </svg>
  );
}
```

- [ ] **Step 6: Test ausführen**

Run: `npx vitest run react/Icon.test.tsx`
Expected: PASS (6 Tests). Schlägt `parst alle Symbole` fehl, ist der Sprite kein wohlgeformtes XML (z. B. unquotiertes Attribut); dann den Fehler in `icons/sprite.ts` korrigieren und dieselbe Korrektur im Icons-Spec-HTML nachziehen.

- [ ] **Step 7: Commit**

```bash
git add scripts/share-icon-sprite.mjs icons svelte/Icon.svelte react/Icon.tsx react/Icon.test.tsx
git commit -m "feat(react): add Icon and share the sprite between svelte and react"
```

### Task 8: `SeverityIcon` + `Button`

**Files:**
- Create: `react/SeverityIcon.tsx`, `react/Button.tsx`, `react/Button.test.tsx`

- [ ] **Step 1: `react/SeverityIcon.tsx`** (von Banner und Modal genutzt; Pfade stammen aus `svelte/Modal.svelte`)

```tsx
import type { ReactNode } from 'react';

export type Severity = 'info' | 'ok' | 'warn' | 'danger';

const GLYPHS: Record<Severity, { strokeWidth: number; paths: ReactNode }> = {
  danger: {
    strokeWidth: 1.8,
    paths: (
      <>
        <circle cx="8" cy="8" r="6.5" />
        <path d="M5.2 10.8l5.6-5.6" />
      </>
    ),
  },
  warn: {
    strokeWidth: 1.8,
    paths: (
      <>
        <path d="M8 1.5L15 14H1z" />
        <path d="M8 6v3M8 11.5v.05" />
      </>
    ),
  },
  ok: { strokeWidth: 2.2, paths: <path d="M3 8.2l3.5 3.5L13 5" /> },
  info: {
    strokeWidth: 1.8,
    paths: (
      <>
        <circle cx="8" cy="8" r="6.5" />
        <path d="M8 7v4M8 4.5v.05" />
      </>
    ),
  },
};

export function SeverityIcon({ severity, className }: { severity: Severity; className?: string }) {
  const { strokeWidth, paths } = GLYPHS[severity];
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {paths}
    </svg>
  );
}
```

- [ ] **Step 2: Fehlschlagenden Test schreiben** — `react/Button.test.tsx`:

```tsx
import { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';
import { expectNoA11yViolations } from './test-utils';

describe('Button', () => {
  it('rendert primary/md als Standard mit type=button', () => {
    render(<Button>Speichern</Button>);
    const btn = screen.getByRole('button', { name: 'Speichern' });
    expect(btn).toHaveClass('dss-btn', 'dss-btn--primary', 'dss-btn--md');
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('setzt Variante und Größe als Klassen', () => {
    render(<Button variant="danger" size="lg">Löschen</Button>);
    expect(screen.getByRole('button')).toHaveClass('dss-btn--danger', 'dss-btn--lg');
  });

  it('touch fügt is-touch hinzu', () => {
    render(<Button touch>2 Punkte</Button>);
    expect(screen.getByRole('button')).toHaveClass('is-touch');
  });

  it('erlaubt type=submit, merged className und reicht native Props durch', () => {
    render(<Button type="submit" className="extra" aria-label="Senden">OK</Button>);
    const btn = screen.getByRole('button', { name: 'Senden' });
    expect(btn).toHaveAttribute('type', 'submit');
    expect(btn).toHaveClass('extra', 'dss-btn');
  });

  it('feuert onClick, aber nicht wenn disabled', () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Klick</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<Button onClick={onClick} disabled>Klick</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('leitet die ref an das button-Element weiter', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('hat keine axe-Verstöße', async () => {
    const { container } = render(<Button>Speichern</Button>);
    await expectNoA11yViolations(container);
  });
});
```

Run: `npx vitest run react/Button.test.tsx`
Expected: FAIL — `Cannot find module './Button'`.

- [ ] **Step 3: `react/Button.tsx` implementieren**

```tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'amber' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Hallen-Touch-Ziel (64 px). */
  touch?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', touch = false, type = 'button', className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn('dss-btn', `dss-btn--${variant}`, `dss-btn--${size}`, touch && 'is-touch', className)}
      {...rest}
    />
  );
});
```

Run: `npx vitest run react/Button.test.tsx`
Expected: PASS (7 Tests).

- [ ] **Step 4: Commit**

```bash
git add react/SeverityIcon.tsx react/Button.tsx react/Button.test.tsx
git commit -m "feat(react): add Button and shared SeverityIcon"
```

### Task 9: `Field` + `TextInput`

**Files:**
- Create: `react/Field.tsx`, `react/TextInput.tsx`, `react/TextInput.test.tsx`

- [ ] **Step 1: Fehlschlagenden Test schreiben** — `react/TextInput.test.tsx`:

```tsx
import { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TextInput } from './TextInput';
import { expectNoA11yViolations } from './test-utils';

describe('TextInput', () => {
  it('verknüpft Label und Eingabefeld', () => {
    render(<TextInput label="Name" />);
    expect(screen.getByLabelText('Name')).toBeInstanceOf(HTMLInputElement);
  });

  it('übernimmt eine übergebene id für die Label-Verknüpfung', () => {
    render(<TextInput id="team-name" label="Name" />);
    expect(screen.getByLabelText('Name')).toHaveAttribute('id', 'team-name');
  });

  it('markiert Pflichtfelder: required am Input, Stern nur visuell', () => {
    render(<TextInput label="Name" required />);
    const input = screen.getByLabelText('Name');
    expect(input).toBeRequired();
    expect(document.querySelector('.req')).toHaveAttribute('aria-hidden', 'true');
  });

  it('zeigt optional-Hinweis im Label-Bereich', () => {
    render(<TextInput label="Kürzel" optional="optional" />);
    expect(document.querySelector('.opt')).toHaveTextContent('optional');
  });

  it('verbindet Hilfetext per aria-describedby', () => {
    render(<TextInput label="Name" help="Mindestens 2 Zeichen" />);
    const input = screen.getByLabelText('Name');
    const help = screen.getByText('Mindestens 2 Zeichen');
    expect(input).toHaveAttribute('aria-describedby', help.id);
    expect(help).toHaveClass('dss-field-help');
  });

  it('error-Zustand: aria-invalid, is-error am Wrapper, Hilfetext-Modifier', () => {
    render(<TextInput label="Name" state="error" help="Pflichtfeld" />);
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    expect(document.querySelector('.dss-field')).toHaveClass('is-error');
    expect(screen.getByText('Pflichtfeld')).toHaveClass('dss-field-help--err');
  });

  it('Dichte: default → dss-input--default, compact → dss-input--compact, touch → keine', () => {
    const { rerender } = render(<TextInput label="A" />);
    expect(screen.getByLabelText('A')).toHaveClass('dss-input', 'dss-input--default');
    rerender(<TextInput label="A" density="compact" />);
    expect(screen.getByLabelText('A')).toHaveClass('dss-input--compact');
    rerender(<TextInput label="A" density="touch" />);
    expect(screen.getByLabelText('A')).not.toHaveClass('dss-input--default', 'dss-input--compact');
  });

  it('rendert prefix und suffix als Addons', () => {
    render(<TextInput label="Betrag" prefix="€" suffix="netto" />);
    expect(screen.getByText('€')).toHaveClass('dss-addon');
    expect(screen.getByText('netto')).toHaveClass('dss-addon', 'dss-addon--right');
  });

  it('className geht an das Input, fieldClassName an den Wrapper', () => {
    render(<TextInput label="A" className="on-input" fieldClassName="on-field" />);
    expect(screen.getByLabelText('A')).toHaveClass('on-input');
    expect(document.querySelector('.dss-field')).toHaveClass('on-field');
  });

  it('funktioniert kontrolliert und leitet die ref weiter', () => {
    const onChange = vi.fn();
    const ref = createRef<HTMLInputElement>();
    render(<TextInput ref={ref} label="Name" value="Alt" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Neu' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('reicht aria-label ohne sichtbares Label durch', () => {
    render(<TextInput aria-label="Suche" />);
    expect(screen.getByLabelText('Suche')).toBeInTheDocument();
  });

  it('hat keine axe-Verstöße', async () => {
    const { container } = render(<TextInput label="Name" help="Hinweis" required />);
    await expectNoA11yViolations(container);
  });
});
```

Run: `npx vitest run react/TextInput.test.tsx`
Expected: FAIL — `Cannot find module './TextInput'`.

- [ ] **Step 2: `react/Field.tsx` (intern)**

```tsx
import type { ReactNode } from 'react';
import { cn } from './cn';

export type FieldState = 'default' | 'error' | 'ok' | 'warn';

const HELP_MODIFIER: Record<Exclude<FieldState, 'default'>, string> = {
  error: 'dss-field-help--err',
  ok: 'dss-field-help--ok',
  warn: 'dss-field-help--warn',
};

export interface FieldProps {
  /** id des Steuerelements, auf das Label und Hilfetext zeigen. */
  controlId: string;
  label?: ReactNode;
  optional?: string;
  required?: boolean;
  help?: ReactNode;
  state: FieldState;
  className?: string;
  children: ReactNode;
}

/** Interner Wrapper für Label, Steuerelement und Hilfetext (TextInput, Select). */
export function Field({ controlId, label, optional, required, help, state, className, children }: FieldProps) {
  return (
    <div className={cn('dss-field', state !== 'default' && `is-${state}`, className)}>
      {label ? (
        <label className="dss-field-label" htmlFor={controlId}>
          {label}
          {required ? <span className="req" aria-hidden="true">*</span> : null}
          {optional ? <span className="opt">{optional}</span> : null}
        </label>
      ) : null}
      {children}
      {help ? (
        <div
          id={`${controlId}-help`}
          className={cn('dss-field-help', state !== 'default' && HELP_MODIFIER[state])}
        >
          {help}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: `react/TextInput.tsx` implementieren**

```tsx
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { Field, type FieldState } from './Field';
import { cn } from './cn';

export type { FieldState } from './Field';
export type TextInputDensity = 'touch' | 'default' | 'compact';

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: ReactNode;
  /** Kleiner Hinweis rechts im Label-Bereich, z. B. "optional". */
  optional?: string;
  help?: ReactNode;
  state?: FieldState;
  density?: TextInputDensity;
  prefix?: ReactNode;
  suffix?: ReactNode;
  /** Klassen für den äußeren Feld-Wrapper (className geht an das Input). */
  fieldClassName?: string;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  {
    label,
    optional,
    help,
    state = 'default',
    density = 'default',
    prefix,
    suffix,
    fieldClassName,
    className,
    id,
    required,
    'aria-describedby': describedByProp,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = [describedByProp, help ? `${inputId}-help` : undefined].filter(Boolean).join(' ') || undefined;

  return (
    <Field
      controlId={inputId}
      label={label}
      optional={optional}
      required={required}
      help={help}
      state={state}
      className={fieldClassName}
    >
      <div className="dss-input-group">
        {prefix ? <span className="dss-addon">{prefix}</span> : null}
        <input
          ref={ref}
          id={inputId}
          className={cn('dss-input', density !== 'touch' && `dss-input--${density}`, className)}
          required={required}
          aria-invalid={state === 'error' ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        {suffix ? <span className="dss-addon dss-addon--right">{suffix}</span> : null}
      </div>
    </Field>
  );
});
```

Run: `npx vitest run react/TextInput.test.tsx`
Expected: PASS (12 Tests).

- [ ] **Step 4: Commit**

```bash
git add react/Field.tsx react/TextInput.tsx react/TextInput.test.tsx
git commit -m "feat(react): add TextInput with shared Field wrapper"
```

### Task 10: `Select`

**Files:**
- Create: `react/Select.tsx`, `react/Select.test.tsx`

- [ ] **Step 1: Fehlschlagenden Test schreiben** — `react/Select.test.tsx`:

```tsx
import { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Select } from './Select';
import { expectNoA11yViolations } from './test-utils';

const OPTIONS = [
  { value: 'rr', label: 'Jeder gegen Jeden' },
  { value: 'swiss', label: 'Schweizer System' },
  { value: 'ko', label: 'K.-o.-Runde', disabled: true },
];

describe('Select', () => {
  it('rendert ein natives select mit Label und Optionen', () => {
    render(<Select label="Turniermodus" options={OPTIONS} defaultValue="rr" />);
    const select = screen.getByRole('combobox', { name: 'Turniermodus' });
    expect(select).toBeInstanceOf(HTMLSelectElement);
    expect(select).toHaveClass('dss-select');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Jeder gegen Jeden',
      'Schweizer System',
      'K.-o.-Runde',
    ]);
    expect(screen.getByRole('option', { name: 'K.-o.-Runde' })).toBeDisabled();
  });

  it('akzeptiert stattdessen children', () => {
    render(
      <Select label="Feld" defaultValue="2">
        <option value="1">1 Feld</option>
        <option value="2">2 Felder</option>
      </Select>,
    );
    expect(screen.getByRole('combobox', { name: 'Feld' })).toHaveValue('2');
  });

  it('meldet Änderungen und funktioniert kontrolliert', () => {
    const onChange = vi.fn();
    render(<Select label="Modus" options={OPTIONS} value="rr" onChange={onChange} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'swiss' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('compact setzt dss-select--compact', () => {
    render(<Select label="Modus" options={OPTIONS} density="compact" />);
    expect(screen.getByRole('combobox')).toHaveClass('dss-select--compact');
  });

  it('error-Zustand und Hilfetext', () => {
    render(<Select label="Modus" options={OPTIONS} state="error" help="Bitte wählen" />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAttribute('aria-describedby', screen.getByText('Bitte wählen').id);
    expect(document.querySelector('.dss-field')).toHaveClass('is-error');
  });

  it('übernimmt id, disabled und leitet die ref weiter', () => {
    const ref = createRef<HTMLSelectElement>();
    render(<Select ref={ref} id="tourney-mode" label="Modus" options={OPTIONS} disabled />);
    expect(screen.getByLabelText('Modus')).toHaveAttribute('id', 'tourney-mode');
    expect(screen.getByLabelText('Modus')).toBeDisabled();
    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
  });

  it('hat keine axe-Verstöße', async () => {
    const { container } = render(<Select label="Modus" options={OPTIONS} help="Hinweis" required />);
    await expectNoA11yViolations(container);
  });
});
```

Run: `npx vitest run react/Select.test.tsx`
Expected: FAIL — `Cannot find module './Select'`.

- [ ] **Step 2: `react/Select.tsx` implementieren**

```tsx
import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Field, type FieldState } from './Field';
import { cn } from './cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  help?: ReactNode;
  state?: FieldState;
  density?: 'default' | 'compact';
  /** Optionen als Daten; alternativ <option>-Kinder. */
  options?: SelectOption[];
  /** Klassen für den äußeren Feld-Wrapper (className geht an das select). */
  fieldClassName?: string;
}

/** Natives <select> im DSS-Look — Tastatur und Screenreader-Verhalten kommen vom Browser. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    help,
    state = 'default',
    density = 'default',
    options,
    fieldClassName,
    className,
    id,
    required,
    children,
    'aria-describedby': describedByProp,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const describedBy = [describedByProp, help ? `${selectId}-help` : undefined].filter(Boolean).join(' ') || undefined;

  return (
    <Field controlId={selectId} label={label} required={required} help={help} state={state} className={fieldClassName}>
      <select
        ref={ref}
        id={selectId}
        className={cn('dss-select', density === 'compact' && 'dss-select--compact', className)}
        required={required}
        aria-invalid={state === 'error' ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      >
        {options
          ? options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))
          : children}
      </select>
    </Field>
  );
});
```

Run: `npx vitest run react/Select.test.tsx`
Expected: PASS (7 Tests).

- [ ] **Step 3: Commit**

```bash
git add react/Select.tsx react/Select.test.tsx
git commit -m "feat(react): add native Select"
```

### Task 11: `Banner`

**Files:**
- Create: `react/Banner.tsx`, `react/Banner.test.tsx`

- [ ] **Step 1: Fehlschlagenden Test schreiben** — `react/Banner.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Banner } from './Banner';
import { expectNoA11yViolations } from './test-utils';

describe('Banner', () => {
  it('rendert info als Standard mit role=status', () => {
    render(<Banner>Geschätzte Dauer: 180 Minuten.</Banner>);
    const banner = screen.getByRole('status');
    expect(banner).toHaveClass('dss-banner', 'dss-banner--info');
    expect(banner).toHaveTextContent('Geschätzte Dauer: 180 Minuten.');
  });

  it.each([
    ['ok', 'status'],
    ['warn', 'alert'],
    ['danger', 'alert'],
  ] as const)('severity %s hat role=%s', (severity, role) => {
    render(<Banner severity={severity}>Text</Banner>);
    expect(screen.getByRole(role)).toHaveClass(`dss-banner--${severity}`);
  });

  it('erlaubt ein explizites role', () => {
    render(<Banner severity="warn" role="status">Text</Banner>);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('rendert den Titel und ein dekoratives Icon', () => {
    const { container } = render(<Banner severity="warn" title="Hallenzeit knapp">Text</Banner>);
    expect(screen.getByText('Hallenzeit knapp')).toHaveClass('dss-banner-title');
    expect(container.querySelector('svg.dss-banner-icon')).toHaveAttribute('aria-hidden', 'true');
  });

  it('lässt das Icon mit icon={false} weg', () => {
    const { container } = render(<Banner icon={false}>Text</Banner>);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('merged className und reicht native Props durch', () => {
    render(<Banner className="extra" data-testid="b">Text</Banner>);
    expect(screen.getByTestId('b')).toHaveClass('extra', 'dss-banner');
  });

  it('hat keine axe-Verstöße', async () => {
    const { container } = render(<Banner severity="danger" title="Fehler">Export fehlgeschlagen</Banner>);
    await expectNoA11yViolations(container);
  });
});
```

Run: `npx vitest run react/Banner.test.tsx`
Expected: FAIL — `Cannot find module './Banner'`.

- [ ] **Step 2: `react/Banner.tsx` implementieren**

```tsx
import type { HTMLAttributes, ReactNode } from 'react';
import { SeverityIcon, type Severity } from './SeverityIcon';
import { cn } from './cn';

export type BannerSeverity = Severity;

export interface BannerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  severity?: BannerSeverity;
  title?: ReactNode;
  icon?: boolean;
}

/** Inline-Hinweis. role: "alert" für warn/danger, "status" für info/ok (überschreibbar). */
export function Banner({ severity = 'info', title, icon = true, role, className, children, ...rest }: BannerProps) {
  const resolvedRole = role ?? (severity === 'warn' || severity === 'danger' ? 'alert' : 'status');
  return (
    <div role={resolvedRole} className={cn('dss-banner', `dss-banner--${severity}`, className)} {...rest}>
      {icon ? <SeverityIcon severity={severity} className="dss-banner-icon" /> : null}
      <div className="dss-banner-body">
        {title ? <p className="dss-banner-title">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}
```

Run: `npx vitest run react/Banner.test.tsx`
Expected: PASS (9 Tests).

- [ ] **Step 3: Commit**

```bash
git add react/Banner.tsx react/Banner.test.tsx
git commit -m "feat(react): add Banner"
```

### Task 12: `Card`

**Files:**
- Create: `react/Card.tsx`, `react/Card.test.tsx`

- [ ] **Step 1: Fehlschlagenden Test schreiben** — `react/Card.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Card } from './Card';
import { expectNoA11yViolations } from './test-utils';

describe('Card', () => {
  it('rendert default/md mit Body', () => {
    const { container } = render(<Card>Inhalt</Card>);
    const card = container.firstElementChild!;
    expect(card).toHaveClass('dss-card', 'dss-card--default', 'dss-card--pad-md');
    expect(card.querySelector('.dss-card-body')).toHaveTextContent('Inhalt');
  });

  it('setzt variant und padding', () => {
    const { container } = render(<Card variant="elevated" padding="lg">X</Card>);
    expect(container.firstElementChild).toHaveClass('dss-card--elevated', 'dss-card--pad-lg');
  });

  it('rendert header und footer in ihren Bereichen', () => {
    const { container } = render(<Card header="Titel" footer="Fuß">Body</Card>);
    expect(container.querySelector('.dss-card-head')).toHaveTextContent('Titel');
    expect(container.querySelector('.dss-card-foot')).toHaveTextContent('Fuß');
  });

  it('wird mit href zum Link', () => {
    render(<Card href="/teams/1">Team</Card>);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/teams/1');
  });

  it('rendert as=article', () => {
    render(<Card as="article">Beitrag</Card>);
    expect(screen.getByRole('article')).toBeInTheDocument();
  });

  it('klickbares div: role=button, tabIndex=0, Enter und Space lösen onClick aus', () => {
    const onClick = vi.fn();
    render(<Card variant="hoverable" onClick={onClick}>Klick</Card>);
    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('tabindex', '0');

    fireEvent.click(card);
    fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.keyDown(card, { key: ' ' });
    fireEvent.keyDown(card, { key: 'a' });
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it('hat keine axe-Verstöße', async () => {
    const { container } = render(<Card header="Titel" footer="Fuß">Body</Card>);
    await expectNoA11yViolations(container);
  });
});
```

Run: `npx vitest run react/Card.test.tsx`
Expected: FAIL — `Cannot find module './Card'`.

- [ ] **Step 2: `react/Card.tsx` implementieren**

```tsx
import { forwardRef, type ElementType, type HTMLAttributes, type KeyboardEvent, type ReactNode, type SyntheticEvent } from 'react';
import { cn } from './cn';

export type CardVariant = 'default' | 'elevated' | 'flat' | 'hoverable';
export type CardPadding = 'sm' | 'md' | 'lg';

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'onClick' | 'title'> {
  variant?: CardVariant;
  padding?: CardPadding;
  as?: 'div' | 'article' | 'section' | 'a' | 'button';
  /** Mit href wird die Karte automatisch zum Link. */
  href?: string;
  onClick?: (event: SyntheticEvent<HTMLElement>) => void;
  header?: ReactNode;
  footer?: ReactNode;
}

export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  { variant = 'default', padding = 'md', as = 'div', href, onClick, onKeyDown, header, footer, className, children, ...rest },
  ref,
) {
  const Tag: ElementType = href ? 'a' : as;
  const interactiveDiv = Tag === 'div' && Boolean(onClick);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    onKeyDown?.(event);
    if (!event.defaultPrevented && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onClick?.(event);
    }
  };

  return (
    <Tag
      ref={ref}
      href={href}
      onClick={onClick}
      onKeyDown={interactiveDiv ? handleKeyDown : onKeyDown}
      role={interactiveDiv ? 'button' : undefined}
      tabIndex={interactiveDiv ? 0 : undefined}
      className={cn('dss-card', `dss-card--${variant}`, `dss-card--pad-${padding}`, className)}
      {...rest}
    >
      {header ? <div className="dss-card-head">{header}</div> : null}
      <div className="dss-card-body">{children}</div>
      {footer ? <div className="dss-card-foot">{footer}</div> : null}
    </Tag>
  );
});
```

Run: `npx vitest run react/Card.test.tsx`
Expected: PASS (7 Tests).

- [ ] **Step 3: Commit**

```bash
git add react/Card.tsx react/Card.test.tsx
git commit -m "feat(react): add Card"
```

### Task 13: `Tabs`

**Files:**
- Create: `react/Tabs.tsx`, `react/Tabs.test.tsx`

Bewusste Abweichung von der Svelte-Referenz: Im Multi-Modus (Pills als Filter-Gruppe) bleibt jeder Button normal per Tab erreichbar (kein Roving-Tabindex), weil sonst inaktive Filter nicht fokussierbar wären. Im CHANGELOG als Svelte-Follow-up vermerkt.

- [ ] **Step 1: Fehlschlagenden Test schreiben** — `react/Tabs.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tabs, type TabItem } from './Tabs';
import { expectNoA11yViolations } from './test-utils';

const ITEMS: TabItem[] = [
  { id: 'overview', label: 'Übersicht' },
  { id: 'roster', label: 'Aufstellung', count: 12 },
  { id: 'locked', label: 'Gesperrt', disabled: true },
  { id: 'box', label: 'Boxscore', icon: 'stats' },
];

describe('Tabs (single)', () => {
  it('rendert tablist/tab und wählt standardmäßig den ersten Tab', () => {
    render(<Tabs items={ITEMS} ariaLabel="Bereiche" />);
    expect(screen.getByRole('tablist', { name: 'Bereiche' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Übersicht' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Aufstellung/ })).toHaveAttribute('aria-selected', 'false');
  });

  it('zeigt Count, Icon und deaktiviert Tabs', () => {
    const { container } = render(<Tabs items={ITEMS} />);
    expect(container.querySelector('.dss-tab-count')).toHaveTextContent('12');
    expect(container.querySelector('svg.dss-tab-ic')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Gesperrt' })).toBeDisabled();
  });

  it('wechselt per Klick (unkontrolliert) und meldet onValueChange', () => {
    const onValueChange = vi.fn();
    render(<Tabs items={ITEMS} onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('tab', { name: /Aufstellung/ }));
    expect(screen.getByRole('tab', { name: /Aufstellung/ })).toHaveAttribute('aria-selected', 'true');
    expect(onValueChange).toHaveBeenCalledWith('roster');
  });

  it('ist kontrolliert über value', () => {
    const { rerender } = render(<Tabs items={ITEMS} value="roster" />);
    expect(screen.getByRole('tab', { name: /Aufstellung/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Übersicht' }));
    expect(screen.getByRole('tab', { name: /Aufstellung/ })).toHaveAttribute('aria-selected', 'true');
    rerender(<Tabs items={ITEMS} value="overview" />);
    expect(screen.getByRole('tab', { name: 'Übersicht' })).toHaveAttribute('aria-selected', 'true');
  });

  it('Roving-Tabindex: nur der aktive Tab ist per Tab erreichbar', () => {
    render(<Tabs items={ITEMS} />);
    expect(screen.getByRole('tab', { name: 'Übersicht' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: /Aufstellung/ })).toHaveAttribute('tabindex', '-1');
  });

  it('Pfeiltasten wechseln, überspringen deaktivierte Tabs und laufen um', () => {
    render(<Tabs items={ITEMS} defaultValue="roster" />);
    const roster = screen.getByRole('tab', { name: /Aufstellung/ });
    fireEvent.keyDown(roster, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: /Boxscore/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByRole('tab', { name: /Boxscore/ }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Übersicht' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Übersicht' }), { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: /Boxscore/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('vertical nutzt ArrowDown/ArrowUp und aria-orientation', () => {
    render(<Tabs items={ITEMS} variant="vertical" />);
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'vertical');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Übersicht' }), { key: 'ArrowDown' });
    expect(screen.getByRole('tab', { name: /Aufstellung/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('setzt Variante und Größe als Klassen', () => {
    render(<Tabs items={ITEMS} variant="segmented" size="lg" />);
    expect(screen.getByRole('tablist')).toHaveClass('dss-tabs', 'dss-tabs--segmented', 'dss-tabs--lg');
  });

  it('hat keine axe-Verstöße', async () => {
    const { container } = render(<Tabs items={ITEMS} ariaLabel="Bereiche" />);
    await expectNoA11yViolations(container);
  });
});

describe('Tabs (multi)', () => {
  it('nutzt group + aria-pressed und toggelt mehrere aktive Einträge', () => {
    const onActiveIdsChange = vi.fn();
    render(<Tabs items={ITEMS} multi variant="pills" onActiveIdsChange={onActiveIdsChange} ariaLabel="Filter" />);
    expect(screen.getByRole('group', { name: 'Filter' })).toBeInTheDocument();

    const overview = screen.getByRole('button', { name: 'Übersicht' });
    fireEvent.click(overview);
    fireEvent.click(screen.getByRole('button', { name: /Aufstellung/ }));
    expect(overview).toHaveAttribute('aria-pressed', 'true');
    expect(onActiveIdsChange).toHaveBeenLastCalledWith(['overview', 'roster']);

    fireEvent.click(overview);
    expect(overview).toHaveAttribute('aria-pressed', 'false');
    expect(onActiveIdsChange).toHaveBeenLastCalledWith(['roster']);
  });

  it('lässt alle Buttons natürlich per Tab erreichbar (kein Roving-Tabindex)', () => {
    render(<Tabs items={ITEMS} multi variant="pills" />);
    expect(screen.getByRole('button', { name: 'Übersicht' })).not.toHaveAttribute('tabindex');
  });
});
```

Run: `npx vitest run react/Tabs.test.tsx`
Expected: FAIL — `Cannot find module './Tabs'`.

- [ ] **Step 2: `react/Tabs.tsx` implementieren**

```tsx
import { useRef, useState, type KeyboardEvent } from 'react';
import { Icon, type IconName } from './Icon';
import { cn } from './cn';

export interface TabItem {
  id: string;
  label: string;
  icon?: IconName;
  count?: number;
  disabled?: boolean;
}

export type TabsVariant = 'underline' | 'segmented' | 'pills' | 'vertical';
export type TabsSize = 'sm' | 'md' | 'lg';

export interface TabsProps {
  items: TabItem[];
  variant?: TabsVariant;
  size?: TabsSize;
  ariaLabel?: string;
  className?: string;
  /** Einzelauswahl: kontrolliert (value) oder unkontrolliert (defaultValue). */
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  /** Mehrfachauswahl (Pills als Filter): kontrolliert (activeIds) oder unkontrolliert. */
  multi?: boolean;
  activeIds?: string[];
  defaultActiveIds?: string[];
  onActiveIdsChange?: (ids: string[]) => void;
}

export function Tabs({
  items,
  variant = 'underline',
  size = 'md',
  ariaLabel = 'Tabs',
  className,
  value: valueProp,
  defaultValue,
  onValueChange,
  multi = false,
  activeIds: activeIdsProp,
  defaultActiveIds = [],
  onActiveIdsChange,
}: TabsProps) {
  const firstEnabled = items.find((item) => !item.disabled)?.id ?? '';
  const [innerValue, setInnerValue] = useState(defaultValue ?? firstEnabled);
  const [innerActiveIds, setInnerActiveIds] = useState(defaultActiveIds);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  const value = valueProp ?? innerValue;
  const activeIds = activeIdsProp ?? innerActiveIds;
  const isActive = (id: string) => (multi ? activeIds.includes(id) : value === id);

  const select = (item: TabItem) => {
    if (item.disabled) return;
    if (multi) {
      const next = activeIds.includes(item.id) ? activeIds.filter((id) => id !== item.id) : [...activeIds, item.id];
      setInnerActiveIds(next);
      onActiveIdsChange?.(next);
    } else {
      setInnerValue(item.id);
      onValueChange?.(item.id);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (multi) return;
    const horizontal = variant !== 'vertical';
    const nextKey = horizontal ? 'ArrowRight' : 'ArrowDown';
    const prevKey = horizontal ? 'ArrowLeft' : 'ArrowUp';
    if (event.key !== nextKey && event.key !== prevKey) return;

    event.preventDefault();
    const direction = event.key === nextKey ? 1 : -1;
    let next = index;
    for (let i = 0; i < items.length; i++) {
      next = (next + direction + items.length) % items.length;
      if (!items[next].disabled) break;
    }
    select(items[next]);
    buttons.current[next]?.focus();
  };

  return (
    <div
      className={cn('dss-tabs', `dss-tabs--${variant}`, `dss-tabs--${size}`, className)}
      role={multi ? 'group' : 'tablist'}
      aria-label={ariaLabel}
      aria-orientation={!multi && variant === 'vertical' ? 'vertical' : undefined}
    >
      {items.map((item, index) => {
        const active = isActive(item.id);
        return (
          <button
            key={item.id}
            ref={(el) => {
              buttons.current[index] = el;
            }}
            type="button"
            className={cn('dss-tab', active && 'is-active', item.disabled && 'is-disabled')}
            role={multi ? undefined : 'tab'}
            aria-selected={multi ? undefined : active}
            aria-pressed={multi ? active : undefined}
            disabled={item.disabled}
            tabIndex={multi ? undefined : active ? 0 : -1}
            onClick={() => select(item)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {item.icon ? <Icon name={item.icon} size={16} className="dss-tab-ic" /> : null}
            <span className="dss-tab-label">{item.label}</span>
            {item.count !== undefined ? <span className="dss-tab-count">{item.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
```

Run: `npx vitest run react/Tabs.test.tsx`
Expected: PASS (11 Tests).

- [ ] **Step 3: Commit**

```bash
git add react/Tabs.tsx react/Tabs.test.tsx
git commit -m "feat(react): add Tabs"
```

### Task 14: `Modal` (Radix Dialog)

**Files:**
- Create: `react/Modal.tsx`, `react/Modal.test.tsx`

Radix registriert seinen Außen-Klick-Listener erst nach einem Tick; die Tests warten deshalb einmal `setTimeout(0)`.

- [ ] **Step 1: Fehlschlagenden Test schreiben** — `react/Modal.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from './Modal';
import { Button } from './Button';
import { expectNoA11yViolations } from './test-utils';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const clickBackdrop = () => {
  const backdrop = document.querySelector('.dss-backdrop')!;
  fireEvent.pointerDown(backdrop, { button: 0, pointerType: 'mouse' });
  fireEvent.pointerUp(backdrop, { button: 0, pointerType: 'mouse' });
  fireEvent.click(backdrop);
};

describe('Modal', () => {
  it('rendert nichts, wenn es geschlossen ist', () => {
    render(<Modal open={false} onOpenChange={() => {}} title="Titel">Inhalt</Modal>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('rendert einen Dialog, benannt nach dem Titel, mit Untertitel, Inhalt und Footer', () => {
    render(
      <Modal open onOpenChange={() => {}} title="Spielbericht freigeben" subtitle="17. Spieltag" footer={<Button>OK</Button>}>
        Inhalt
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'Spielbericht freigeben' })).toBeInTheDocument();
    expect(screen.getByText('17. Spieltag')).toHaveClass('dss-m-subtitle');
    expect(screen.getByText('Inhalt')).toBeInTheDocument();
    expect(document.querySelector('.dss-m-footer')).toContainElement(screen.getByRole('button', { name: 'OK' }));
  });

  it('setzt Größen-Modifier außer für md', () => {
    const { rerender } = render(<Modal open onOpenChange={() => {}} title="T" size="wide">x</Modal>);
    expect(screen.getByRole('dialog')).toHaveClass('dss-modal', 'dss-modal--wide');
    rerender(<Modal open onOpenChange={() => {}} title="T" size="md">x</Modal>);
    expect(screen.getByRole('dialog')).not.toHaveClass('dss-modal--md');
  });

  it('zeigt bei severity ein Header-Icon, bei default keins', () => {
    const { rerender } = render(<Modal open onOpenChange={() => {}} title="T" severity="danger">x</Modal>);
    expect(document.querySelector('.dss-m-head-icon--danger svg')).toBeInTheDocument();
    rerender(<Modal open onOpenChange={() => {}} title="T">x</Modal>);
    expect(document.querySelector('.dss-m-head-icon')).toBeNull();
  });

  it('schließt über den Schließen-Button', () => {
    const onOpenChange = vi.fn();
    render(<Modal open onOpenChange={onOpenChange} title="T">x</Modal>);
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('erlaubt ein eigenes closeLabel', () => {
    render(<Modal open onOpenChange={() => {}} title="T" closeLabel="Close">x</Modal>);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('schließt mit Escape', () => {
    const onOpenChange = vi.fn();
    render(<Modal open onOpenChange={onOpenChange} title="T">x</Modal>);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('schließt standardmäßig bei Klick auf den Hintergrund', async () => {
    const onOpenChange = vi.fn();
    render(<Modal open onOpenChange={onOpenChange} title="T">x</Modal>);
    await tick();
    clickBackdrop();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('schließt bei dismissOnBackdrop={false} nicht per Hintergrund-Klick, aber per Button', async () => {
    const onOpenChange = vi.fn();
    render(<Modal open onOpenChange={onOpenChange} title="T" dismissOnBackdrop={false}>x</Modal>);
    await tick();
    clickBackdrop();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closable={false}: kein Schließen-Button, Escape und Hintergrund schließen nicht', async () => {
    const onOpenChange = vi.fn();
    render(<Modal open onOpenChange={onOpenChange} title="T" closable={false}>x</Modal>);
    await tick();
    expect(screen.queryByRole('button', { name: 'Schließen' })).toBeNull();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    clickBackdrop();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('hat keine axe-Verstöße', async () => {
    render(<Modal open onOpenChange={() => {}} title="Turnier löschen?" severity="danger" footer={<Button>OK</Button>}>Inhalt</Modal>);
    await expectNoA11yViolations(document.body);
  });
});
```

Run: `npx vitest run react/Modal.test.tsx`
Expected: FAIL — `Cannot find module './Modal'`.

- [ ] **Step 2: `react/Modal.tsx` implementieren**

```tsx
import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { SeverityIcon, type Severity } from './SeverityIcon';
import { cn } from './cn';

export type ModalSeverity = 'default' | Severity;
export type ModalSize = 'sm' | 'md' | 'wide' | 'xwide';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  severity?: ModalSeverity;
  size?: ModalSize;
  /** Zeigt den Schließen-Button und erlaubt Escape/Hintergrund-Klick (Standard: true). */
  closable?: boolean;
  /** Schließen per Klick auf den Hintergrund (Standard: true). Mit false bleibt das Modal offen. */
  dismissOnBackdrop?: boolean;
  closeLabel?: string;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Modal({
  open,
  onOpenChange,
  title,
  subtitle,
  severity = 'default',
  size = 'md',
  closable = true,
  dismissOnBackdrop = true,
  closeLabel = 'Schließen',
  footer,
  className,
  children,
}: ModalProps) {
  const blockOutsideDismiss = !closable || !dismissOnBackdrop;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dss-backdrop" />
        <div className="dss-modal-wrap">
          <Dialog.Content
            aria-describedby={undefined}
            className={cn('dss-modal', size !== 'md' && `dss-modal--${size}`, className)}
            onInteractOutside={(event) => {
              if (blockOutsideDismiss) event.preventDefault();
            }}
            onEscapeKeyDown={(event) => {
              if (!closable) event.preventDefault();
            }}
          >
            <div className="dss-m-head">
              {severity !== 'default' ? (
                <div className={`dss-m-head-icon dss-m-head-icon--${severity}`}>
                  <SeverityIcon severity={severity} />
                </div>
              ) : null}
              <div className="dss-m-head-text">
                <Dialog.Title className="dss-m-title">{title}</Dialog.Title>
                {subtitle ? <div className="dss-m-subtitle">{subtitle}</div> : null}
              </div>
              {closable ? (
                <Dialog.Close className="dss-m-close" aria-label={closeLabel}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" focusable="false">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </Dialog.Close>
              ) : null}
            </div>
            <div className="dss-m-body">{children}</div>
            {footer ? <div className="dss-m-footer">{footer}</div> : null}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

Run: `npx vitest run react/Modal.test.tsx`
Expected: PASS (11 Tests). Schlägt nur `schließt standardmäßig bei Klick auf den Hintergrund` fehl, feuert jsdom das `pointerdown` nicht bis zum Radix-Listener; dann prüfen, ob `PointerEvent` im jsdom definiert ist (`node -e "console.log(typeof new (require('jsdom').JSDOM)('').window.PointerEvent)"` muss `function` liefern). Solange dieser positive Test nicht grün ist, beweist der negative Test (`dismissOnBackdrop={false}`) nichts — beide müssen grün sein.

- [ ] **Step 3: Commit**

```bash
git add react/Modal.tsx react/Modal.test.tsx
git commit -m "feat(react): add Modal on Radix Dialog with dismissOnBackdrop"
```

### Task 15: Barrel-Export + Paritäts-Test

**Files:**
- Create: `react/index.ts`, `parity.manifest.json`, `tests/parity.test.ts`

- [ ] **Step 1: `react/index.ts`**

```ts
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './Button';
export { TextInput, type TextInputProps, type TextInputDensity, type FieldState } from './TextInput';
export { Select, type SelectProps, type SelectOption } from './Select';
export { Modal, type ModalProps, type ModalSeverity, type ModalSize } from './Modal';
export { Banner, type BannerProps, type BannerSeverity } from './Banner';
export { Card, type CardProps, type CardVariant, type CardPadding } from './Card';
export { Tabs, type TabsProps, type TabItem, type TabsVariant, type TabsSize } from './Tabs';
export { Icon, ICON_NAMES, ensureSprite, type IconProps, type IconName } from './Icon';
```

- [ ] **Step 2: `parity.manifest.json`**

```json
{
  "Button":    { "svelte": "svelte/Button.svelte",    "react": "react/Button.tsx",    "css": ["dss-btn", "dss-btn--danger", "is-touch"] },
  "TextInput": { "svelte": "svelte/TextInput.svelte", "react": "react/TextInput.tsx", "css": ["dss-field", "dss-input", "dss-input-group"] },
  "Select":    { "svelte": "svelte/Select.svelte",    "react": "react/Select.tsx",    "css": ["dss-select"] },
  "Modal":     { "svelte": "svelte/Modal.svelte",     "react": "react/Modal.tsx",     "css": ["dss-modal", "dss-backdrop", "dss-m-head"] },
  "Banner":    { "svelte": "svelte/Banner.svelte",    "react": "react/Banner.tsx",    "css": ["dss-banner"] },
  "Card":      { "svelte": "svelte/Card.svelte",      "react": "react/Card.tsx",      "css": ["dss-card"] },
  "Tabs":      { "svelte": "svelte/Tabs.svelte",      "react": "react/Tabs.tsx",      "css": ["dss-tabs", "dss-tab"] },
  "Icon":      { "svelte": "svelte/Icon.svelte",      "react": "react/Icon.tsx",      "css": ["dss-icon"] }
}
```

- [ ] **Step 3: `tests/parity.test.ts`** (erzwingt die Dreier-Regel; die Liste `PENDING_REACT` darf nur schrumpfen)

```ts
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

type Entry = { svelte: string; react: string; css: string[] };

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('parity.manifest.json', root), 'utf8')) as Record<string, Entry>;
const css = readFileSync(new URL('css/components.css', root), 'utf8');
const indexTs = readFileSync(new URL('react/index.ts', root), 'utf8');

// Bestehende Svelte-Komponenten ohne React-Version. Diese Liste darf nur kürzer werden:
// Jede NEUE Komponente muss ins Manifest (Svelte + CSS + React) — sonst schlägt der Test fehl.
const PENDING_REACT = [
  'Table', 'PlayByPlay', 'TopBar', 'BottomNav', 'Breadcrumbs',
  'Stepper', 'MatchCard', 'PlayerCard', 'EmptyState', 'Skeleton',
];

describe.each(Object.entries(manifest))('Parität: %s', (name, entry) => {
  it('hat eine Svelte-Version', () => {
    expect(existsSync(new URL(entry.svelte, root))).toBe(true);
  });

  it('hat eine React-Version, die aus react/index.ts exportiert wird', () => {
    expect(existsSync(new URL(entry.react, root))).toBe(true);
    expect(indexTs).toMatch(new RegExp(`\\b${name}\\b[^;]*from '\\./${name}'`));
  });

  it.each(entry.css)('definiert die CSS-Klasse .%s', (cls) => {
    expect(new RegExp(`\\.${cls}(?![\\w-])`).test(css)).toBe(true);
  });
});

describe('Parität: Vollständigkeit', () => {
  it('jede Svelte-Komponente steht im Manifest oder ist als PENDING_REACT vermerkt', () => {
    const svelteComponents = readdirSync(new URL('svelte/', root))
      .filter((file) => file.endsWith('.svelte'))
      .map((file) => file.replace('.svelte', ''));
    const known = new Set([...Object.keys(manifest), ...PENDING_REACT]);
    expect(svelteComponents.filter((name) => !known.has(name))).toEqual([]);
  });

  it('PENDING_REACT enthält nichts, was bereits im Manifest steht', () => {
    expect(PENDING_REACT.filter((name) => name in manifest)).toEqual([]);
  });
});
```

Der Svelte-Dateiname von `TextInput` ist `TextInput.svelte`, passt zum Manifest-Schlüssel.

- [ ] **Step 4: Alle Tests, Typecheck und Build**

```bash
npm test
npm run typecheck
npm run build:react
ls dist/react
```

Expected: alle Tests grün; Typecheck ohne Fehler; `dist/react/` enthält `index.js`, `index.d.ts` (und Sourcemaps).

- [ ] **Step 5: Commit**

```bash
git add react/index.ts parity.manifest.json tests/parity.test.ts
git commit -m "feat(react): export all components and enforce svelte/css/react parity"
```

### Task 16: Paket-Verifikation, Doku, PR D2, Release

**Files:**
- Modify: `CHANGELOG.md`, `README.md`

- [ ] **Step 1: Paketinhalt prüfen**

```bash
npm pack --dry-run 2>&1 | grep -E "dist/react/index|css/components|icons/sprite|svelte/Select|svelte/Banner"
```

Expected: Zeilen für `dist/react/index.js`, `dist/react/index.d.ts`, `css/components.css`, `icons/sprite.ts`, `svelte/Select.svelte`, `svelte/Banner.svelte`.

- [ ] **Step 2: Installation wie ein Konsument simulieren** (Tarball, damit `prepare` mitläuft)

```bash
S=/private/tmp/claude-501/-Users-oliver-marcuseder-01-vibe-coding-00-Basektball-08-Fibalon-Baskets-02-turnier-manager/c5eb9565-c502-4a38-ae43-0427395e75c2/scratchpad
rm -rf $S/consumer && mkdir -p $S/consumer && cd $S/consumer && npm init -y >/dev/null
TARBALL=$(cd ~/01-vibe-coding/00-Basektball/dss-design-system && npm pack --silent | tail -1)
npm install ~/01-vibe-coding/00-Basektball/dss-design-system/$TARBALL react@18 react-dom@18 @radix-ui/react-dialog
node --input-type=module -e "import('@bbv/dss-design-system/react').then(m => console.log(Object.keys(m).sort().join(',')))"
test -f node_modules/@bbv/dss-design-system/css/components.css && echo "components.css ok"
rm ~/01-vibe-coding/00-Basektball/dss-design-system/$TARBALL
cd ~/01-vibe-coding/00-Basektball/dss-design-system
```

Expected: Ausgabe `Banner,Button,Card,ICON_NAMES,Icon,Modal,Select,Tabs,TextInput,ensureSprite` und `components.css ok`.

- [ ] **Step 3: CHANGELOG** — neuen Abschnitt über `## [Unreleased] — Vanilla-CSS-Komponenten` einfügen und den `[Unreleased]`-Titel auf `## [0.7.0]` umbenennen (Inhalt von D1 gehört zu 0.7.0):

```markdown
## [0.7.0] — React-Paket + Vanilla-CSS

### Neu
- **React-Paket** (`@bbv/dss-design-system/react`): `Button`, `TextInput`, `Select` (nativ), `Modal` (Radix Dialog),
  `Banner`, `Card`, `Tabs`, `Icon`. Rendert nur `dss-*`-Klassen aus `css/components.css`
  (`@bbv/dss-design-system/components.css`). `react`, `react-dom` und `@radix-ui/react-dialog` sind optionale
  `peerDependencies`; das Paket baut sich per `prepare` (tsup) selbst, auch als Git-Dependency.
- `Modal`: Prop `dismissOnBackdrop` (Standard `true`) für Dialoge, die nicht per Klick außerhalb schließen sollen.
- Gemeinsamer Icon-Sprite (`icons/sprite.ts`) für Svelte und React.
- Paritäts-Test (`parity.manifest.json`, `tests/parity.test.ts`): neue Komponenten brauchen Svelte + CSS + React.
- Tests: Vitest + Testing Library + axe-core für alle React-Komponenten.

### Bekannt / Follow-up
- `Tabs` (React) lässt im Multi-Modus alle Buttons per Tab erreichbar; `svelte/Tabs.svelte` setzt dort noch
  `tabindex="-1"` auf inaktive Einträge.
- Die Svelte-Komponenten Button, TextInput, Modal, Card und Tabs enthalten weiterhin eigene Scoped-Styles, die
  `css/components.css` doppeln.
- `css/`, `icons/` und `dist/` sind jetzt in `files` des Pakets (zuvor fehlte `css/`).
```

- [ ] **Step 4: README** — im Abschnitt `## Was ist drin` den Baum um `react/`, `icons/`, `css/` ergänzen und einen Abschnitt „React" nach „Vanilla CSS (ohne Svelte)" einfügen:

````markdown
## React

```bash
npm install github:OliEder/dss-design-system#v0.7.0 react react-dom @radix-ui/react-dialog
```

```tsx
import '@bbv/dss-design-system/tokens.css';
import '@bbv/dss-design-system/components.css';
import { Button, TextInput, Select, Modal, Banner } from '@bbv/dss-design-system/react';

<Button variant="amber">Speichern</Button>
<TextInput label="Name" required />
<Modal open={open} onOpenChange={setOpen} title="Turnier löschen?" severity="danger" dismissOnBackdrop={false}>…</Modal>
```

Tailwind-Nutzer: `components.css` **nach** `@tailwind base` laden (Preflight setzt sonst Button-Hintergründe zurück).
````

(Die Fences mit vier Backticks oben dienen nur der Darstellung im Plan; in die README gehört der Inhalt mit normalen drei Backticks.)

- [ ] **Step 5: Verifikation und Commit**

```bash
npm test && npm run typecheck && npm run build:react && npm run build-storybook
git add CHANGELOG.md README.md
git commit -m "docs: changelog and readme for v0.7.0 react package"
```

Expected: alles grün.

- [ ] **Step 6: Push und PR D2**

```bash
git push -u origin feat/react-package
gh pr create --base main --title "feat: React-Paket (v0.7.0)" --body "$(cat <<'EOF'
## Inhalt
- `react/`: Button, TextInput, Select (nativ), Modal (Radix Dialog, `dismissOnBackdrop`), Banner, Card, Tabs, Icon
- Gemeinsamer Icon-Sprite für Svelte und React
- Build mit tsup (`prepare`), neue `exports` (`./react`, `./components.css`), `files` um `css/` ergänzt
- Vitest + Testing Library + axe-core; Paritäts-Test erzwingt Svelte + CSS + React für neue Komponenten
- Version 0.7.0, CHANGELOG, README

## Test
- `npm test`, `npm run typecheck`, `npm run build:react`, `npm run build-storybook`
- Konsumenten-Simulation per `npm pack` + Installation in einem leeren Projekt

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 7: Nach dem Merge taggen**

```bash
git checkout main && git pull --ff-only
git tag -a v0.7.0 -m "v0.7.0 · React-Paket, Select, Banner, Modal-CSS"
git push origin v0.7.0
```

Expected: Tag `v0.7.0` auf GitHub sichtbar. **Damit ist die Voraussetzung für T1 erfüllt.**

---

## Self-Review (gegen den Spec)

- **§1 Aufbau React-Paket:** Struktur `react/` + `index.ts` (Task 6, 15); Umfang + Paritätsmatrix (Tasks 2, 3, 7–14); Styling nur `dss-*` (Task 2, keine CSS-in-JS-Datei in `react/`); API `forwardRef`/`variant`/`size`/`cn` (Tasks 6, 8–14); Radix nur als Peer, nur Modal (Task 14, Abweichung 1 dokumentiert); `dismissOnBackdrop` (Task 14); Doku/Stories/HTML-Spec (Tasks 3, 4).
- **§2 Build/Versionierung:** `tsup`, `prepare`, `exports`, v0.7.0, CHANGELOG (Tasks 6, 16). Konsumenten-Installation per Tarball (Task 16).
- **§3 Tests:** Vitest + RTL + axe pro Komponente inkl. Tastatur (Tabs, Modal) (Tasks 7–14); Paritäts-Manifest und -Test (Task 15). Kontrast-Prüfung läuft im Storybook-a11y-Addon, nicht in jsdom (axe-Kontrast ist in jsdom nicht auswertbar, bewusst deaktiviert).
- **Offene Punkte aus dem Spec:** „Select in components.css ergänzen?" → `dss-select` reicht, nur `--compact` und Zustände ergänzt (Task 2).
- **Typkonsistenz:** `Severity` (`info|ok|warn|danger`) wird in `SeverityIcon` definiert und von `Banner` (`BannerSeverity`) und `Modal` (`ModalSeverity = 'default' | Severity`) verwendet; `FieldState` in `Field.tsx`, re-exportiert aus `TextInput.tsx`; `TabItem.icon` nutzt `IconName` aus `icons/sprite.ts`; `ensureSprite` heißt in `Icon.tsx`, im Svelte-Icon und im Index gleich; `parseSprite`/`SPRITE_ID` kommen aus `icons/sprite.ts`.
- **Platzhalter-Scan:** keine offenen Stellen; alle Codeschritte enthalten vollständigen Code.
