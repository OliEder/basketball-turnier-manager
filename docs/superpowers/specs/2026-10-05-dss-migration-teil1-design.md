# Turniermanager — Umstellung auf das DSS-Design-System, Teil 1

**Datum:** 2026-10-05
**Scope:** Fundament (Tokens, Schriften, Tailwind) und Basis-Komponenten. Teil 1 von 4.
**Design-System:** https://github.com/OliEder/dss-design-system (v0.6, Pre-release → Ziel v0.7.0)

---

## Überblick

Der Turnier-Manager nutzt bisher das Fibalon-Branding (FBNM: Blau/Cyan, INSOLENT/ALLER/Montserrat).
Da das Projekt nicht mehr für Fibalon entsteht, wird es auf das DSS-Design-System umgestellt
(Ink · Amber · Sky, Sora/Manrope/JetBrains Mono, WCAG 2.1 AAA).

DSS liefert Tokens, ein Tailwind-Preset, Vanilla-CSS (`css/components.css`) und Svelte-Referenzkomponenten,
aber **keine React-Komponenten**. Die Umstellung ist deshalb eine volle Portierung der relevanten
DSS-Komponenten nach React und läuft inkrementell in vier Teilen:

| Teil | Inhalt |
|---|---|
| **1 (diese Spec)** | Fundament + Basis-Komponenten (Button, TextInput, Select, Modal, Card, Tabs, Icon, Banner), Ablösung der `ui/*`-Wrapper |
| 2 | ursprünglich „Basis-Komponenten“, aber in Teil 1 gezogen, weil die `ui/*`-Wrapper nur mit den neuen Komponenten ablösbar sind; Nummer bleibt unbelegt, damit Teil 3 und 4 stabil bleiben |
| 3 | Weitere Komponenten (Table, Stepper, TopBar, EmptyState, Skeleton, MatchCard …), Seiten-Migration, Löschen der Übergangsschicht |
| 4 | react-pdf-Exporte (Schriften/Farben), Druckansichten, `/anleitung`-Screenshots, Restdoku |

Nicht Teil dieser Spec: Dark-Mode (vorerst fest hell), DBB-Compat-Preset, Umbau der Svelte-Komponenten.

## Entscheidungen

1. **Umfang:** Volle Portierung der DSS-Komponenten nach React.
2. **Ablageort:** React-Komponenten liegen im **DSS-Repo** (`react/`, neben `svelte/`), der Turnier-Manager
   bindet sie per npm (Git-Dependency) ein. DSS bleibt einzige Quelle.
3. **Verhalten:** Modal und Select bauen auf **Radix** (`peerDependencies`), wie heute im Turnier-Manager.
4. **Dark-Mode:** Vorerst nur hell (`data-theme="light"`), Dark später als eigenes Feature.
5. **Strategie:** Inkrementell mit temporärer Übergangsschicht (Variante A).
6. **Paritätsregel (DSS-Repo):** Jede neue oder bisher fehlende Komponente wird in **allen drei Formaten**
   geliefert: Svelte, Vanilla-CSS, React.

---

## 1. Aufbau des React-Pakets (DSS-Repo)

**Struktur:** `react/` mit TypeScript-Komponenten und `index.ts` als Einstiegspunkt.

**Umfang Teil 1 und Paritätsmatrix:**

| Komponente | Svelte | Vanilla CSS | React |
|---|---|---|---|
| Button, Card, Tabs, TextInput, Icon | vorhanden | vorhanden (Icon: Sprite teilen) | neu |
| Modal | vorhanden | neu (`dss-modal*` aus dem Scoped-Style extrahieren) | neu |
| Select | neu | vorhanden (`dss-select`), bei Bedarf ergänzen | neu |
| Banner (ersetzt `Alert`) | neu | neu (`dss-banner*`) | neu |

Select und Banner gehören nicht zu den ursprünglich genannten sechs Komponenten, werden aber gebraucht,
um alle `ui/*`-Wrapper abzulösen. Fallen beim Durchgehen der Seiten weitere Komponenten auf, die DSS nicht
kennt, folgen sie derselben Dreier-Regel (Teil 1 oder Teil 3).

**Styling:** Einzige CSS-Quelle ist `css/components.css`. React rendert nur `dss-*`-Klassen, ohne CSS-in-JS
und ohne Tailwind-Abhängigkeit im Paket. Neue Svelte-Komponenten (Select, Banner) nutzen ebenfalls die
`dss-*`-Klassen und bringen keine eigenen Scoped-Styles mit. Die bestehenden Svelte-Komponenten bleiben
unverändert; die dort doppelt existierenden Styles werden als bekannte Schuld dokumentiert.

**API:** `forwardRef`, native Props werden durchgereicht, `variant` und `size` heißen wie in Svelte
(`primary | amber | secondary | danger | ghost`, `sm | md | lg`). `className` wird über einen kleinen
eigenen Join-Helper zusammengeführt. Abhängigkeiten: nur React und Radix (Dialog, Select) als
`peerDependencies`.

**Verhalten:** Modal und Select nutzen Radix. Tabs übernimmt die Tastaturlogik der Svelte-Version
(Pfeiltasten, Roving-Tabindex). Icon rendert die 54 Glyphen als Sprite, gleiche Quelle wie Svelte.
Das Modal bekommt die Prop `dismissOnBackdrop` (Standard `true`, wie DSS), weil der Turnier-Manager
das Schließen per Klick außerhalb bewusst unterbindet (`onInteractOutside` wird abgefangen) und `false` übergibt.

**Dokumentation im DSS-Repo:** Jede neue Komponente bekommt eine Story in `stories/` und einen Abschnitt in
der passenden HTML-Spec (Select in Forms, Banner und Modal in Modals).

## 2. Build, Einbindung und Fundament

### Build und Versionierung (DSS-Repo)

- `react/` wird mit `tsup` zu ESM plus `.d.ts` gebaut. Ein `prepare`-Script baut das Paket beim
  `npm install` einer Git-Dependency.
- Neue `exports`: `./react`, `./components.css`. Bestehende (`./tokens.css`, `./tailwind`, `./svelte/*`) bleiben.
- Release **v0.7.0** (Minor, keine Breaking Changes) mit CHANGELOG-Eintrag.
- Der Turnier-Manager pinnt `github:OliEder/dss-design-system#v0.7.0`. Während der Entwicklung wird `npm link`
  genutzt, gepinnt wird erst nach dem Tag.

### Einbindung (Turnier-Manager)

- `src/index.css` importiert `tokens.css` und `components.css`. `index.html` setzt `data-theme="light"` auf `<html>`.
- **Schriften werden selbst gehostet** (`@fontsource-variable/sora`, `manrope`, `jetbrains-mono`) statt per
  Google-Fonts-Link: keine externen Requests (DSGVO), offline-fähig, von Vite gebündelt.
  `public/fonts` (leere FBNM-Hülle) wird entfernt. Die react-pdf-Schriften bleiben bis Teil 4 unverändert.
- Das DSS-Tailwind-Preset wird eingebunden (`ink-*`, `amber-*`, `sky-*`, `neutral-*`). Tailwind bleibt für
  Layout und Abstände zuständig. Die Preset-Farben sind OKLCH-Strings, Alpha-Modifier (`/60`) funktionieren
  nicht; betroffene Stellen werden beim Codemod gefunden und auf `--dss-*`-Aliase oder eigene Klassen umgestellt.

### Temporäre Übergangsschicht (bis Teil 3)

- `src/styles/legacy-fbnm-aliases.css` bildet `--fbnm-color-*` auf DSS-Tokens ab.
- Im Tailwind-Config zeigen `brand.*`, `muted` und `border` auf DSS-Werte.
- So laufen die betroffenen Dateien (`brand-*`: 18, `text-muted-foreground`: 22, `border-border`: 21) ohne Änderung weiter.
- Beides wird in Teil 3 gelöscht; ein Eintrag in arc42 Kapitel 11 samt Checkliste hält das fest.
- Die globale Regel `h1–h3 { uppercase; INSOLENT }` in `src/index.css` entfällt zugunsten des DSS-Überschriftenstils.

### Ablösung der `ui/*`-Wrapper

Die 55 Import-Stellen (button 15, alert 14, input 12, label 11, destructive-confirm-dialog 2, dialog 1,
select 1) wechseln per mechanischem Codemod auf `@bbv/dss-design-system/react`:

| Alt | Neu |
|---|---|
| `variant="default"` | `variant="primary"` |
| `variant="outline"` | `variant="ghost"` |
| `variant="destructive"` | `variant="danger"` |
| `size="default"` | `size="md"` |
| `Alert` / `AlertDescription` | `Banner` |
| `DestructiveConfirmDialog` | `Modal severity="danger"` |
| `Label` + `Input` | `TextInput` mit `label` |

Danach werden `src/components/ui/*` und die zugehörigen Tests gelöscht oder durch Tests der neuen Nutzung ersetzt.

**Sichtbare Folge:** DSS-Controls sind 44 px hoch (heute 36 px). Dichte Formulare und Tabellen werden höher.
Ergebnis-Eingabegrids nutzen die DSS-Dichtestufe `compact`.

## 3. Tests, PR-Reihenfolge, Risiken, Doku

### PR-Reihenfolge

| # | Repo | Inhalt |
|---|---|---|
| D1 | DSS | `components.css` um Modal, Banner (und ggf. Select) ergänzen, Svelte-`Select` und `Banner`, Stories, HTML-Spec-Abschnitte |
| D2 | DSS | `react/`-Paket, `tsup`-Build, Tests, CHANGELOG, Tag **v0.7.0** |
| T1 | Turnier-Manager | Fundament: Dependency, Tokens, Schriften, Preset, Übergangsschicht. Keine Komponenten-Änderung |
| T2 | Turnier-Manager | Codemod der Import-Stellen, `ui/*` löschen, Tests anpassen |

Die Doku geht jeweils mit dem PR mit, zu dem sie gehört.

### Tests

- **DSS-Repo:** Vitest mit Testing Library und axe-core, je React-Komponente für Varianten, Tastatur
  (Tabs, Modal, Select) und Kontrast. Dazu ein Paritäts-Check: Ein Manifest listet jede Komponente, ein Test
  prüft, dass Svelte-Datei, React-Datei und CSS-Klasse existieren (setzt die Dreier-Regel technisch durch).
- **Turnier-Manager:** Es entstehen keine neuen User-Flows. Absicherung sind die bestehenden Unit-Tests,
  die E2E-Suite und `e2e/accessibility.spec.ts`. Vor jedem PR laufen `typecheck`, `test`, `test:e2e`, `build`.
  Es wird kein Visual-Regression-Tooling eingeführt; Hauptseiten werden per Playwright-Screenshot geprüft.
  Der Druckdialog wird nicht live getestet (bekanntes Hängen), nur die Render-Funktion.

### Risiken

1. **Git-Dependency mit `prepare`-Build** kann auf Vercel oder in der CI scheitern → früh über die Vercel-Preview von T1 prüfen.
2. **44-px-Controls** können Ergebnis-Eingabegrids sprengen → `compact`-Dichtestufe.
3. **Modal-Verhalten** weicht zwischen DSS und App ab → Prop `dismissOnBackdrop`.
4. **OKLCH ohne Alpha-Modifier** → betroffene Stellen werden im Codemod gefunden.
5. **Übergangsschicht bleibt liegen** → Eintrag in arc42 Kapitel 11, Checkliste für Teil 3.
6. **Veraltete Artefakte** nach T1: `/anleitung`-Screenshots und PDF-Schriften passen nicht mehr zur Optik → als bekannte Lücke für Teil 4 vermerkt.

### Dokumentationspflichten

- **arc42** (`docs/architecture/arc42/`): Kapitel 02 (Randbedingung Design-System), 05 (Bausteine: `ui/*` wird zum DSS-Paket),
  08 (Kopplung Tailwind–Tokens samt Übergangsschicht), 09 (neue ADR: React-Paket im DSS-Repo, Radix als Peer,
  selbst gehostete Schriften, Dark verschoben), 11 (Schuld: doppelte Svelte-Styles, Übergangsschicht, PDF-Schriften, Screenshots).
- **Use-Case-Übersicht** (`docs/use-cases-und-kritikalitaet.md`): geprüft, keine Änderung nötig (keine neuen
  Use-Cases, keine Verweise auf Optik oder Branding).
- **A11y-Liste** (`e2e/accessibility.spec.ts`): keine neue Route und keine neuen UI-Zustände, die Zahl der
  kuratierten Kombinationen bleibt unverändert. Nach T2 müssen alle bestehenden Kombinationen weiter bestehen.

## Offene Punkte für die Implementierungsplanung

- Genaue Liste der `--dss-*`-Aliase, die die Übergangsschicht für `--fbnm-color-*` verwendet (Mapping-Tabelle im Plan).
- Ob `Select` in `components.css` ergänzt werden muss oder `dss-select` ausreicht (beim Bau von D1 zu klären).
- Konkrete Zielhöhen und `compact`-Einsatzorte werden beim Codemod anhand der Screenshots festgelegt.
