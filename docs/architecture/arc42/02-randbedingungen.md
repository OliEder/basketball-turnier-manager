# 2. Randbedingungen

## 2.1 Technische Randbedingungen

| Randbedingung | Ausprägung | Quelle |
|---|---|---|
| Frontend-Framework | React 18 + TypeScript 5.8 (strict, `noUnusedLocals`/`noUnusedParameters`/`noFallthroughCasesInSwitch` aktiv) | `package.json`, `tsconfig.json` |
| Build-Tool | Vite 6 | `vite.config.ts` |
| State Management | Zustand 5 (ein einziger globaler Store, `src/store/tournament-store.ts`) | `package.json` |
| Styling | Tailwind CSS 3 | `package.json`, `tailwind.config.ts` |
| Routing | React Router 7 (Client-seitig, `BrowserRouter`) | `src/App.tsx` |
| UI-Primitives | Radix UI (`react-select`, `react-dialog`) für zugängliche Select-/Dialog-Komponenten | `package.json` |
| Persistenz | Ausschließlich `localStorage` — kein Server, keine Datenbank, keine externe API-Anbindung außer optionalen Team-Logo-Bild-URLs | `src/lib/storage.ts` |
| Export-Formate | JSON (Turnierdatensatz), PDF (`@react-pdf/renderer`), statisches HTML+ZIP (`jszip`) | `src/lib/export/*` |
| Testing | Vitest 4 + Testing Library (Unit/Komponente), Playwright 1.63 (E2E), `@axe-core/playwright` (Barrierefreiheit) | `package.json` |
| Node-Version (CI) | Node 22 | `.github/workflows/ci.yml` |
| Hosting | Statisches Bundle, wahlweise GitHub Pages (`deploy-pages.yml`, Pfad-Präfix `/basketball-turnier-manager/`) oder Vercel (`vercel.json`, SPA-Rewrite auf `index.html`) | `.github/workflows/deploy-pages.yml`, `vercel.json` |
| Lizenz | MIT, mit explizitem Vorbehalt einer künftigen Relizenzierung für neue Versionen (Alleinurheberschaft) | `LICENSE`, `README.md` |

## 2.2 Organisatorische Randbedingungen

- **Projektgröße**: Einzelentwickler-Projekt, entstanden aus einem realen Bedarf für ein konkretes
  Vereinsturnier (Fibalon U11-Summer-Cup, siehe `docs/superpowers/specs/2026-06-23-planer-phase1-design.md`).
- **Entwicklungsmethodik**: Strikt Test-Driven Development. Jede neue Funktion beginnt mit einem
  fehlschlagenden Test, dann Implementierung, dann Verifikation (`npx tsc --noEmit && npx vitest
  run`), dann Commit. Für neue *kritische Nutzerprozesse* gilt zusätzlich **"E2E-first"**: ein
  Playwright-Test, der den vollständigen Organisator-Flow abbildet, wird VOR der Implementierung
  geschrieben und muss zunächst nachweislich aus dem richtigen Grund fehlschlagen (Feature
  existiert noch nicht) — dieser Grundsatz ist explizit in mehreren Design-Specs verankert
  (z. B. `2026-09-12-endrunde-1-bracket-design.md`, Abschnitt "Testing-Strategie").
- **Coverage-Gate als harte CI-Schranke**: 80 % Branch-Coverage, **pro Datei einzeln** (nicht nur im
  Durchschnitt), erzwungen für `src/lib/**` und `src/store/**` (`vite.config.ts`, `thresholds:
  { branches: 80, perFile: true }`). Ein PR mit einer Datei unter dieser Schwelle scheitert an CI.
- **Subagent-Driven Development** für größere Features: bei umfangreicheren Implementierungsplänen
  (z. B. Endrunde 1, siehe `docs/superpowers/plans/2026-09-12-endrunde-1-bracket-plan.md`) wird pro
  Teilaufgabe ein frischer Implementierungs-Agent beauftragt, gefolgt von zwei unabhängigen
  Review-Durchläufen (Spezifikations-Konformität, dann Code-Qualität), bevor die nächste Teilaufgabe
  beginnt. Das ist ein bewusstes Verfahren, kein Zufallsprodukt — dokumentiert in den
  `docs/superpowers/`-Plänen dieses Projekts.
- **Dokumentation von Entscheidungen**: Vor jeder größeren Änderung wird ein Design-Dokument unter
  `docs/superpowers/specs/` angelegt, das Problem, Root-Cause (falls Bugfix) und Lösung festhält,
  bevor ein Implementierungsplan (`docs/superpowers/plans/`) und danach Code entstehen.

## 2.3 Konventionen

- Alle sichtbaren Texte (UI, Fehlermeldungen, Commit-Beschreibungen zur Fachlichkeit) sind auf
  Deutsch. Code-Identifier, Kommentare und interne Dokumentation sind auf Englisch — mit
  Ausnahme dieser arc42-Dokumentation und der `docs/superpowers/`-Spezifikationen, die konsequent
  auf Deutsch verfasst sind, weil sie sich an den (deutschsprachigen) Projektverantwortlichen richten.
- Pfad-Alias `@/*` verweist auf `src/*` (`tsconfig.json`, `vite.config.ts`).
- Es gibt **keinen** Lint-Schritt in der CI-Pipeline und keine ESLint-Konfiguration im Projekt
  (nicht verifiziert als bewusste Entscheidung, aber durchgängig so im Repository) — Codequalität
  wird stattdessen über TypeScript-Strict-Mode, Testabdeckung und Code-Reviews durch Subagenten
  sichergestellt.
