# 9. Architekturentscheidungen (ADRs)

Kurzform-ADRs, extrahiert aus `docs/superpowers/specs/*.md` und aus dem Code selbst. Nur
Entscheidungen aufgeführt, die sich tatsächlich belegen lassen — Vermutungen sind explizit
gekennzeichnet.

---

### ADR-01: Kein Server-Backend, ausschließlich `localStorage`

- **Kontext**: Die App soll auch ohne Internetverbindung in einer Sporthalle funktionieren.
- **Entscheidung**: Vollständig clientseitige SPA, Persistenz nur im Browser-`localStorage`.
- **Konsequenz**: Kein Multi-Geräte-Sync, kein Mehrbenutzerbetrieb, keine Live-Daten für
  Zuschauer auf anderen Geräten — Export/Import als bewusster manueller Ersatz.
- **Beleg**: `docs/superpowers/specs/2026-06-23-planer-phase1-design.md` ("Der Planer läuft lokal
  im Browser ... Phase 2 (Spieltag mit Live-Daten, Go-Backend, Raspberry Pi) ist bewusst
  ausgeklammert").

---

### ADR-02: Circle-Method statt naiver Paarliste für Round-Robin

- **Kontext**: Die ursprüngliche `generateRoundRobinPairs`-Reihenfolge (`(1,2),(1,3),...`) ließ
  Felder am Turnieranfang/-ende ungenutzt, weil aufeinanderfolgende Paarungen zufällig dieselben
  Teams wiederholt betrafen.
- **Entscheidung**: `generateRoundRobinRounds` implementiert die Standard-Circle-Method
  (Berger-Tabelle) — garantiert, dass jedes Team pro Runde höchstens einmal spielt, wodurch alle
  Paarungen einer Runde parallelisierbar sind.
- **Konsequenz**: `Game.round` wird für Gruppenphasen-Spiele jetzt sinnvoll befüllt (vorher fix
  `1` für alle).
- **Beleg**: `docs/superpowers/specs/2026-09-12-round-robin-field-utilization-design.md`.

---

### ADR-03: Gruppen sind reine String-IDs, keine eigene Entität

- **Kontext**: Mehrgruppen-Vorrunde sollte eingeführt werden, ohne das Datenmodell unnötig
  aufzublähen.
- **Entscheidung**: `Team.groupId?: string` und `Game.groupId?: string` referenzieren Gruppen rein
  über ihre alphabetische ID (`"A"`, `"B"`, ...) — kein eigener `Group`-Typ mit Namen/Metadaten.
- **Konsequenz**: Sehr einfaches Datenmodell, aber keine Möglichkeit, einer Gruppe z. B. einen
  eigenen Namen zu geben (nicht nachgefragt, daher nicht als Mangel zu werten).
- **Beleg**: `docs/superpowers/specs/2026-09-12-multi-group-round-robin-design.md` ("Ein neuer,
  einfacher Typ wird NICHT eingeführt ... YAGNI").

---

### ADR-04: Vollständige Zeitplan-Generierung im Voraus statt verzögerter Generierung

- **Kontext**: Bei mehrstufigen Formaten (Gruppenphase + Endrunde) stehen die Teams der späteren
  Phasen zum Konfigurationszeitpunkt noch nicht fest.
- **Entscheidung**: Der komplette Zeitplan (inkl. aller späteren Spiele als Platzhalter mit
  Zeiger-Feldern) wird SOFORT bei Konfiguration erzeugt, nicht erst nach Abschluss der Vorstufe.
- **Konsequenz**: Der Organisator sieht von Anfang an die volle Turnierstruktur inkl. Uhrzeiten;
  im Gegenzug ist eine Verzögerung der Endrunden-Generierung (z. B. um erst nach der Gruppenphase
  auf Basis tatsächlicher Ergebnisse zu planen) NICHT möglich, ohne diese Entscheidung zu
  revidieren — explizit als mögliche spätere Erweiterung zurückgestellt, nicht umgesetzt.
- **Beleg**: `docs/superpowers/specs/2026-09-12-endrunde-1-bracket-design.md`, Abschnitt
  "Scope-Reduktion", Punkt 3.

---

### ADR-05: Generische `{stage, matchIndex, outcome}`-Zeiger statt fixer `homeSourceSemifinal`

- **Kontext**: Endrunde 3 führte ursprünglich ein festes Feld `homeSourceSemifinal: {semifinalIndex:
  1|2, outcome}` ein, das nur exakt EIN Halbfinale referenzieren konnte.
- **Entscheidung**: Migration (kein Parallelbetrieb) zu `homeSourceMatch?: {stage: GameStage,
  matchIndex: number, outcome: 'winner'|'loser'}` — generisch genug, um KO-Bäume beliebiger Tiefe
  (bis 32 Teilnehmer) mit derselben Auflösungslogik abzubilden.
- **Konsequenz**: `resolvePlaceholders` braucht nur noch EINE generische Lookup-Logik
  (`{rankTier, stage, matchIndex}` → Spiel) statt einer Sonderbehandlung pro Bracket-Tiefe.
  Erkauft mit einem Migrations-Aufwand über mehrere Dateien (`types`, `playoff-generator`,
  `tournament-store`, zugehörige Tests).
- **Beleg**: `docs/superpowers/specs/2026-09-12-endrunde-1-bracket-design.md`, Abschnitt
  "Datenmodell-Änderung: generische Turnierbaum-Zeiger".

---

### ADR-06: Alphabetisches Seeding statt Stärke-basiertem Cross-Group-Seeding

- **Kontext**: Beim Zusammenführen mehrerer Gruppen in einen KO-Baum (Endrunde 1/3) müsste ein
  "richtiges" Turnierseeding eigentlich die Stärke der Gruppen berücksichtigen — vor der
  Gruppenphase ist diese aber unbekannt.
- **Entscheidung**: Seeding erfolgt rein alphabetisch nach `groupId`, nach Standard-Turnierbaum-
  Reihenfolge (Setzlisten-Platz 1 trifft den zuletzt gesetzten Platz). `computeGroupPhaseBuchholz`
  wurde zwar bereits implementiert, aber bewusst NICHT für dieses Seeding verwendet.
- **Konsequenz**: Einfach, deterministisch, aber "unfair" im Sinne einer echten Stärke-Setzung —
  akzeptiert als bewusste Scope-Reduktion für eine spätere Erweiterung.
- **Beleg**: `docs/superpowers/specs/2026-09-12-endrunde-1-bracket-design.md`, "Scope-Reduktion",
  Punkt 2; `finals-variant-generator.ts`, Kommentar zu `buildQualifierSeeds`.

---

### ADR-07: Subagent-Driven Development für größere Implementierungspläne

- **Kontext**: Größere Features (z. B. Endrunde 1) sollen mit hoher Qualität, aber ohne den
  gesamten Kontext in einer einzigen, langen Session zu halten, umgesetzt werden.
- **Entscheidung**: Pro Teilaufgabe eines Implementierungsplans wird ein frischer
  Implementierungs-Agent beauftragt, gefolgt von zwei unabhängigen Review-Durchläufen
  (Spezifikations-Konformität, dann Code-Qualität) vor der nächsten Teilaufgabe.
- **Konsequenz**: Höherer Koordinationsaufwand pro Feature, aber wiederholt nachgewiesen, echte
  Bugs zu finden, bevor sie in den Hauptzweig gelangen (z. B. ein fehlendes `placementFrom`-Feld,
  dokumentiert direkt im Implementierungsplan als "Post-Task-10 correction").
- **Beleg**: `docs/superpowers/plans/2026-09-12-endrunde-1-bracket-plan.md`.

---

### ADR-08: MIT-Lizenz mit Vorbehalt künftiger Relizenzierung

- **Kontext**: Das Projekt soll offen nutzbar sein, dem Alleinurheber aber die Option offenhalten,
  künftige Versionen anders zu lizenzieren.
- **Entscheidung**: MIT-Lizenz für den aktuellen Stand; README weist explizit darauf hin, dass der
  Urheber als alleiniger Rechteinhaber künftige Versionen umlizenzieren kann, ohne bereits
  veröffentlichte MIT-Versionen zu berühren.
- **Beleg**: `LICENSE`, `README.md`.

---

### ADR-09 (vermutlich, nicht explizit dokumentiert): Kein Lint-Schritt

Es gibt weder eine ESLint-Konfiguration noch einen Lint-Job in der CI-Pipeline. Nicht als
explizite Design-Entscheidung in den Specs belegt — vermutlich bewusst zugunsten von
TypeScript-Strict-Mode plus Testabdeckung, aber diese Annahme ist NICHT im Code oder in
`docs/superpowers/` verifiziert.

---

### ADR-10: Markdown als gemeinsame Inhaltsquelle für Web-Anleitung und PDF-Export

- **Kontext**: Alle vier Export-Buttons (Zeitplan, Gruppentabellen, Schweizer-System-Übersicht,
  Anleitung) sollten von `window.print()`-Popups auf echte PDF-Downloads umgestellt werden
  (`@react-pdf/renderer`, bereits für den Zeitplan-Export im Einsatz). Für die Anleitung
  (609 Zeilen handgeschriebenes JSX, 29 Screenshots, Fließtext, Listen, Hinweisboxen) hätte das
  bedeutet, entweder den Inhalt zwischen Web-Seite und PDF zu duplizieren, oder ein Zwischenformat
  zu finden, aus dem beide Darstellungen erzeugt werden können.
- **Geprüfte Alternativen**: `react-markdown` (seit 18 Monaten nicht aktualisiert, geht von
  DOM-Struktur aus — dokumentiert fragil mit react-pdf, siehe verlinkte GitHub-Issues in der
  Design-Spec); `react-pdf-html` (führt mit HTML ein drittes Zwischenformat ein, das Web- und
  PDF-Renderer wieder unabhängig interpretieren könnten); Raster-Ansätze wie `html2pdf.js`
  (verschlechtern die PDF-Qualität — nicht mehr durchsuchbar/selektierbar, ein Rückschritt
  gegenüber dem bereits bestehenden nativen react-pdf-Zeitplan-Export); ein eigenes,
  JSON-basiertes Rich-Content-Format (mehr Aufwand als der Rest des Features zusammen, siehe
  Design-Spec).
- **Entscheidung**: Der Anleitungsinhalt wird EINMAL als Markdown (`src/content/manual.md`)
  gepflegt, mit `marked` (aktiv gepflegt, keine Laufzeit-Abhängigkeiten) tokenisiert und von zwei
  eigens geschriebenen, kleinen Renderern konsumiert — einer zu Web-JSX
  (`manual-markdown-jsx.tsx`), einer zu react-pdf-Elementen (`manual-markdown-pdf.ts`). Eine
  projekteigene `::: callout Titel ... :::`-Konvention deckt Hinweisboxen ab, die `marked` nicht
  nativ kennt.
- **Konsequenz**: Kein Duplikat-Pflegeaufwand zwischen Web-Seite und PDF, aber ein eigener,
  kleiner Tokenizer/Renderer-Layer (`markdown-tokens.ts` + zwei Renderer) muss selbst gewartet
  werden statt eine fertige Bibliothek zu nutzen. Eine echte, mehrwöchige Alternative (ein Fork von
  `@react-pdf/renderer` mit Tagged-PDF/PDF-UA-Unterstützung, die auch das
  Barrierefreiheits-Problem lösen würde) wurde als eigenständiges, späteres Projekt zurückgestellt
  (siehe Kapitel 11).
- **Beleg**: `docs/superpowers/specs/2026-09-17-pdf-export-design.md`, Abschnitt "Markdown als
  gemeinsame Inhaltsquelle für die Anleitung"; `docs/superpowers/plans/2026-09-17-pdf-export.md`.

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
  eingebetteten Zeichen (gemessen in der Sichtprüfung: je ca. 8 bis 20 KB, Anleitung +28 KB). Zeichen außerhalb des
  Latin-Subsets (z. B. →) werden im Anleitungs-PDF ersetzt.
- **Beleg**: `docs/superpowers/specs/2026-10-06-dss-migration-teil4-design.md`,
  `docs/superpowers/plans/2026-10-06-dss-migration-teil4a-pdf-html.md`.

### ADR-13: Navigationsarchitektur (gruppierte AppNav, flache URLs, basePath)

- **Kontext**: Die alte Linkleiste zeigte alle Seiten nebeneinander und wuchs mit jeder Seite. Zugleich sind
  Mehrturnier- und Live-Ansichten (siehe 11.11, 11.12) als Vision vorgemerkt und werden die URL-Struktur berühren.
  DSS 0.8.0 liefert `TopBar` und `AppNav` (Liste mit Drill-down).
- **Geprüfte Alternativen**: Unterstrichene Leiste ohne Gruppen (einfach, skaliert nicht und bleibt auf dem Handy
  unübersichtlich); Seitenleiste (braucht dauerhaft Breite, die Druck-/Hallenansichten nicht haben).
- **Entscheidung**: Die Navigation besteht aus `TopBar` + `AppNav`, gruppiert nach Zweck (Vorbereiten, Spielen,
  Ansehen, Export, Hilfe). Das Modell ist rein und getestet: `buildNavigation` (`src/lib/navigation.ts`) liefert die
  Gruppen samt gesperrten Einträgen (je nach Modus/Zustand) und nimmt einen `basePath` entgegen. Die URLs bleiben
  vorerst flach (`/teams`, `/config`, `/demos` ...); eine spätere Struktur `/turniere/:id/...` wird über `basePath`
  möglich, ohne das Modell umzuschreiben.
- **Konsequenz**: E2E-Tests navigieren über den Helfer `goTo(page, label)`, der bei Bedarf die Gruppe öffnet; neue
  Seiten müssen im Navigationsmodell und im Helfer (`NAV_GROUP`) gepflegt werden. Die Seite „Demo-Turniere“ liegt in
  der Gruppe „Hilfe“. Die Dropdown-Zustände der Navigation sind eigene A11y-Testfälle (siehe 8.10).
- **Beleg**: `docs/superpowers/specs/2026-10-06-dss-migration-teil3-design.md`;
  `docs/superpowers/plans/2026-10-06-dss-migration-teil3b-app.md`.
