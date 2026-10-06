# Turniermanager — DSS-Umstellung, Teil 3: Komponenten, Navigation, Seiten, Demo-Turniere

**Datum:** 2026-10-06
**Scope:** Restliche DSS-Komponenten nach React portieren (im DSS-Repo), die App-Navigation als eigene Komponente neu aufbauen, Seiten auf DSS-Komponenten umstellen, die Tailwind-Übergangsschicht entfernen und Demo-Turniere zugänglich machen. Teil 3 von 4 der DSS-Migration (Teil 1: `2026-10-05-dss-migration-teil1-design.md`, Teil 4: `2026-10-06-dss-migration-teil4-design.md`; Teil 1 und 4a sind gemergt, 4b folgt nach Teil 3).

---

## Entscheidungen

1. **Volle Portierung:** Alle zehn noch fehlenden React-Komponenten (`PENDING_REACT`: Table, PlayByPlay, TopBar, BottomNav, Breadcrumbs, Stepper, MatchCard, PlayerCard, EmptyState, Skeleton) entstehen im DSS-Repo. Zusätzlich neu: **AppNav** und **Checkbox** (je Svelte + Vanilla-CSS + React, Paritätsregel).
2. **Navigation als Komponente `AppNav`** (Variante A: dunkle TopBar, Hamburger-Menü auf dem Handy), gruppiert mit Dropdowns. Dieselbe Komponente soll später im Vereinsregister nutzbar sein (dort nicht Teil von Teil 3).
3. **Informationsarchitektur** trägt eine spätere Mehrturnier-/Live-Version: Liste + Drill-down, Gruppen nach Zweck. Jetzt flache URLs, später `/turniere/:id/...`.
4. **Demo-Turniere** sind Teil von 3b: eigene Seite `/demos`, Nav-Gruppe „Hilfe“.
5. **Lieferung in drei PRs** (je eigener Plan, Review, Merge durch die Nutzerin/den Nutzer): 3a-1 (DSS 0.8.0), 3b (App), 3a-2 (DSS 0.9.0).

---

## 3a — DSS-Repo (`github.com/OliEder/dss-design-system`)

### 3a-1: Version 0.8.0

Sechs Komponenten, je Svelte, Vanilla-CSS (`css/components.css`), React (`react/`), Eintrag in `parity.manifest.json`:

| Komponente | Zweck |
|---|---|
| **Table** | Tabellen mit rechtsbündigen Zahlenspalten, Sortier-/Leerzustand wie in der Svelte-Vorlage |
| **TopBar** | dunkle Kopfleiste (Marke + Slot) |
| **EmptyState** | leere/gesperrte Zustände mit optionaler Aktion |
| **Stepper** | Fortschritt „Runde 2 von 3“ (abgeschlossen/aktuell/kommend) |
| **AppNav** | siehe unten |
| **Checkbox** | fehlt in DSS bisher; ersetzt rohes `<input type="checkbox">` |

**AppNav:**
- Props: `tone` (`dark` | `light`), `items` (Link **oder** Gruppe mit Untereinträgen), `renderLink` (für React Router `NavLink`), `context`-Slot (Platz für späteren Turnierumschalter).
- Aktiver Eintrag über `aria-current="page"`; Gruppe mit aktivem Kind ist ebenfalls markiert.
- Gesperrte Einträge sind nicht fokussierbar und tragen einen Hinweis (z. B. „Erst nach dem Zeitplan verfügbar“).
- Gruppen sind Disclosure-Dropdowns (`aria-expanded`, `aria-controls`); Esc und Klick außerhalb schließen, Fokus kehrt zum Auslöser zurück.
- Mobil: Hamburger-Button, Menü klappt auf; Gruppen werden untereinander aufgelistet.
- Vanilla-Variante mit `js/appnav.js` (gleiche Semantik, ohne Framework).

**CSS-Extraktion:** Das Scoped-CSS der Svelte-Komponenten wird nach `css/components.css` überführt (`dss-*`-Klassen), damit React und Vanilla dieselbe Quelle nutzen. Svelte-Komponenten verwenden danach ebenfalls diese Klassen.

**Visuelle Regression:** Vor der Extraktion Storybook-Screenshots der betroffenen Svelte-Komponenten erzeugen, danach erneut, Vergleich per Playwright + `magick compare`. Abweichungen werden einzeln bewertet; Vereinsregister-Klassen bleiben unverändert.

**Paritätstest:** `PENDING_REACT` verliert die in 3a-1 gelieferten Einträge (Table, TopBar, EmptyState, Stepper).

### 3a-2: Version 0.9.0

BottomNav, Breadcrumbs, MatchCard, PlayerCard, PlayByPlay, Skeleton (je drei Varianten, gleiche CSS-Extraktion und Vergleichsmethode). `PENDING_REACT` wird leer. Die App benötigt diese sechs noch nicht; 3a-2 läuft parallel zu oder nach 3b.

---

## 3b — App

### Navigation

- **Navigationsmodell** `src/lib/navigation.ts`: reine Funktion `buildNavigation({ tournament, schedule, basePath })` liefert die Struktur für `AppNav`. Sie übernimmt die bisherige Logik aus `AppShell.tsx` (Modus Schweizer System, Gruppen-/Rundenturnier, Endrunden-Varianten `endrunde-4/-3/-1`, Freischaltung nach Zeitplan; vor dem Zeitplan bleiben nur Teams, Konfiguration, Export und Anleitung frei).
- **Gruppen:**
  - *Vorbereiten:* Teams, Konfiguration
  - *Spielen:* Ergebnisse erfassen, Endrunde-Ergebnisse (je nach Variante)
  - *Ansehen:* Zeitplan, Turnierübersicht bzw. Gruppentabellen, Endstand
  - *Export*
  - *Hilfe:* Anleitung, Demo-Turniere
- **`AppShell.tsx`** wird auf `TopBar` + `AppNav` + `buildNavigation` reduziert; Router-Links über `renderLink` (`NavLink`).
- **URLs:** bleiben flach. Das Modell erhält `basePath`, damit die spätere Umstellung auf `/turniere/:id/...` lokal bleibt (ADR-13).

### Komponenten in den Seiten

- **Table** für die drei handgebauten Tabellen (Schweizer Übersicht, Gruppentabellen, Endstand); „zurückgezogen“ als rotes Chip.
- **Tabs** (vorhanden) für Rundenauswahl der Swiss-Ergebnisse und Gruppen-Reiter. Die Rolle wechselt von `button` zu `tab`; betroffene Tests/Selektoren (`getByRole('button', { name: 'Runde …' })` u. a.) werden gezielt nachgezogen.
- **Stepper** für „Runde x von y“ auf den Swiss-Seiten.
- **EmptyState** für leere/gesperrte Zustände („Bitte zuerst einen Zeitplan generieren“, „Keine Spiele für die gewählten Filter“, „Noch keine Endrunden-Ergebnisse“, Teamseite ohne Teams). **Banner** bleibt für Hinweise, Warnungen, Fehler.
- **Spielzeilen** (`GameRow`) mit `dss-rows`/`dss-row` und `dss-chip dss-chip--mono` für Feld-Badges.
- **Select** (vorhanden, kompakte Dichte für Filter) für die 10 rohen Selects; **Checkbox** (neu) für „Mit Rückspiel“ (`GroupAssignmentForm`/Konfiguration). Bewusst roh bleiben nur der native Farbwähler in `TeamForm` und der versteckte Datei-Input (dokumentierte Ausnahmen).

### Tailwind-Übergangsschicht entfernen

Die temporären Namen (`brand.*`, `muted`, `card`, `border`, `border-ui`, `secondary`, `tint`, `destructive`, `background`, `foreground`) werden durch dauerhafte, auf `--dss-*`-Aliase zeigende Semantik-Klassen ersetzt (dark-sicher):

| alt | neu |
|---|---|
| `text-brand-primary*`, `text-foreground` | `text-fg` |
| `text-muted-foreground` | `text-mute` |
| `border-border` | `border-line` |
| `bg-tint` | `bg-hover` |
| `bg-card` | `bg-surface` |
| `bg-background` | `bg-page` |
| `bg-destructive` / `text-destructive` | `bg-err` / `text-err` |

`font-display` bleibt. Ein Codemod stellt die rund 35 betroffenen Dateien um; ein Guard-Test (`node:fs`) verbietet die alten Namen. Die `:where()`-Regel für rohe Controls in `src/index.css` und die alten Schlüssel in `tailwind.config.ts` entfallen. Wo Tailwind-Utilities DSS-Komponenten überschreiben, bleiben `!`-Modifier nötig (siehe arc42 8.13).

### Demo-Turniere

- **Manifest** `src/lib/demos.ts`: fünf Demos (Titel, Beschreibung, Modus, Teams, Spiele, Stand) zu `public/demos/01…05-*.json`. Ein Test vergleicht das Manifest per `node:fs` mit den JSON-Dateien.
- **`DemosPage`** (`/demos`): Karten mit „Laden“. Klick → `fetch(`${import.meta.env.BASE_URL}demos/<datei>`)` → `parseTournamentImport` → `importTournament(tournament, schedule)`. Läuft ein Turnier mit Ergebnissen, erscheint die bestehende `DestructiveConfirmDialog`-Bestätigung (wie beim JSON-Import). Danach Weiterleitung auf die Übersichtsseite des Modus. Fehler (Netzwerk/Parsing) als Banner.
- **Teamseite ohne Teams:** `EmptyState` mit „Team hinzufügen“ und „Demo ansehen“ (→ `/demos`).
- Die Anleitung verweist später auf die Seite (Text in 4b).

### Tests

- **E2E zuerst** (rot vor Umbau): Hilfsfunktion `goTo(page, label)`, die auch Dropdown-Gruppen öffnet; Codemod ersetzt die 64 `getByRole('link', { name })`-Stellen in 13 Dateien. Neu: `e2e/demo-tournaments.spec.ts` (Demo laden, Bestätigung bei laufendem Turnier, Leerzustand mit CTA).
- **Unit:** Navigationsmodell (ersetzt den Großteil der 16 `AppShell`-Fälle), Demo-Manifest, Guard-Test Legacy-Klassen, wenige Integrationstests für `AppNav`-Einbindung.
- **A11y** (`e2e/accessibility.spec.ts`): vier neue Fälle — Untermenü geöffnet, mobiles Menü geöffnet, Demo-Seite, leere Teamseite → **12 → 16** kuratierte Kombinationen; arc42 8.10 und QS-4 werden nachgezogen.
- **Use-Case-Übersicht:** UC8 „Demo-Turnier laden“ (🟡 wichtig) mit Testabsicherung eintragen.

### Dokumentation

arc42 8.13 (Übergangsschicht entfällt), 8.10 und QS-4 (16 Kombinationen), 11.14 (Teil 3 erledigt, Rest offen), neuer **ADR-13** (Navigationsarchitektur: Liste + Drill-down, flache URLs jetzt, `basePath` für später). Der 4b-Plan (`2026-10-06-dss-migration-teil4b-screenshots.md`) stellt seine Navigationsselektoren auf `goTo` um.

---

## Reihenfolge

1. **3a-1** (DSS 0.8.0) → Merge, Tag `v0.8.0`
2. **3b** (App; Abhängigkeit auf `v0.8.0`) → Merge
3. **3a-2** (DSS 0.9.0) parallel/danach
4. Danach **4b** (Screenshots/Anleitungstext)

Jede Lieferung: Plan → subagentengestützte Umsetzung mit Spec- und Qualitäts-Review → Push/PR/Merge nur nach Rückfrage.

## Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| E2E-Umbau trifft viele Dateien | `goTo` + Codemod, danach voller Lauf lokal und in CI |
| Tabs-Rollenwechsel bricht Selektoren stillschweigend | gezielte Suche nach Runden-/Gruppen-Reitern, e2e vor Umbau |
| CSS-Extraktion verändert Svelte-Optik | Storybook-Screenshots vorher/nachher, Einzelbewertung |
| Farb-Codemod über ~35 Dateien | Guard-Test, Build, visuelle Stichproben per Screenshot |
| Demo-Laden überschreibt laufendes Turnier | bestehende Sperr-Bestätigung (`DestructiveConfirmDialog`) |
| Git-Abhängigkeit (`@bbv/dss-design-system`) | Version pinnen, `npm ci` nach Bump prüfen |

## Nicht Teil von Teil 3

Dark-Modus, Mehrturnier-Umschalter, Live-Anzeige auf weiteren Geräten/Server (arc42 11.11/11.12), Einführung von `AppNav` im Vereinsregister, Tagged-PDF/PDF-UA (11.13), DSS-Fokusring-Kontrast im PDF, Screenshots/Anleitungstext (4b).
