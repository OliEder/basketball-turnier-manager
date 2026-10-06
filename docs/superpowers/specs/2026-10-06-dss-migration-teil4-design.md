# Turniermanager — DSS-Umstellung, Teil 4: PDF-/HTML-Export und Anleitung

**Datum:** 2026-10-06
**Scope:** PDF-Layouts (react-pdf), HTML-Export und die Screenshots der Anleitung auf das DSS-Design-System umstellen. Teil 4 von 4 der DSS-Migration (Teil 1 siehe `2026-10-05-dss-migration-teil1-design.md`, gemergt als PR #22/#23).

---

## Überblick

Nach Teil 1 verwendet die App Ink · Amber · Sky mit Sora/Manrope. Drei Ausgaben zeigen noch das Fibalon-Branding:

1. **PDF-Exporte** (Zeitplan, Gruppentabellen, Schweizer-System-Übersicht, Anleitung). Die Optik kommt zentral aus
   `src/lib/export/pdf-theme.ts`: fünf Farben im FBNM-Blau (`#004174`, `#002751`, `#f0f7fc`, `#e2e8f0`, `#fff`) und die
   eingebaute Schrift `Helvetica`.
2. **HTML-Export** (`src/lib/export/html-export.ts`): ZIP mit einer `index.html` und eigener Inline-CSS, FBNM-Farben und
   `font-family: 'Aller'`.
3. **Anleitung** (`/anleitung`, `src/content/manual.md`): 30 Screenshots (`public/anleitung/01…30-*.png`, 1,5 MB) zeigen die
   alte Oberfläche und werden auch ins Anleitungs-PDF eingebettet. Der Text beschreibt außerdem an zwei Stellen
   „Drucken“/„druckfertige Seite öffnen“ (Zeilen ~221 und ~242), obwohl die Buttons seit dem PDF-Export Downloads sind.

Die Arbeit teilt sich in zwei unabhängige PRs:

| PR | Inhalt |
|---|---|
| **4a** | PDF-Theme (Farben, Schriften), HTML-Export, Standard-Teamfarbe, verschärfter Guard-Test |
| **4b** | Screenshot-Skript, 30 neue Bilder, Anleitungstext |

Nicht Teil dieses Specs: Tagged-PDF/PDF-UA (arc42 11.13, bleibt offen), Dark-Mode, Teil 3 der Migration (rohe
`<input>`/`<select>`, Übergangsschicht in Tailwind), DSS-Fokusring.

## Entscheidungen

1. **PDF-Schriften:** Sora (Überschriften) und Manrope (Fließtext, Tabellen) werden eingebettet.
2. **Tabellenkopf:** hell (Grau 100) mit Ink-Schrift und Amber-Linie darunter, druckfreundlich.
3. **HTML-Export:** Sora und Manrope als WOFF2-Dateien in der ZIP, per `@font-face` eingebunden.
4. **Screenshots:** ein reproduzierbares Playwright-Skript statt Handarbeit.
5. **Anleitungstext:** wird bei der Gelegenheit an die tatsächliche App angeglichen, ohne neue Inhalte.
6. **Reihenfolge:** 4a vor 4b, getrennte PRs; Merge durch die Nutzerin/den Nutzer.

---

## 4a: PDF-Theme und HTML-Export

### Farben (`src/lib/export/pdf-theme.ts`)

react-pdf kennt kein `oklch()`; die DSS-Tokens (`node_modules/@bbv/dss-design-system/tokens/tokens.css`) müssen als Hex
vorliegen. Sie werden **nicht von Hand abgetippt**, sondern über einen kleinen Konverter abgeleitet und gegen Abweichung
getestet.

- Neue Schlüssel nach Rolle (statt `brandBlue`/`textDark`/`zebra`):

| Schlüssel | DSS-Token | Verwendung |
|---|---|---|
| `text` | `--ink-900` | Fließtext, Überschriften |
| `textMuted` | `--n-600` | gedämpfter Text (AAA auf Weiß) |
| `tableHeaderBg` | `--n-100` | Tabellenkopf-Hintergrund |
| `tableHeaderText` | `--ink-900` | Tabellenkopf-Schrift |
| `accent` | `--amber-400` | schmale Linie unter Haupttitel und Tabellenkopf, **nie als Textfarbe** |
| `zebra` | `--n-50` | gerade Tabellenzeilen |
| `border` | `--n-200` | Zeilenlinien |
| `white` | — | `#ffffff` |

- Neue Datei `src/lib/export/oklch.ts` (reine Funktion, ohne Abhängigkeit, ca. 25 Zeilen): `oklchToHex(l, c, h)`.
  Benötigt werden nur Ink-900, Amber-400 und die Neutral-Töne 50/100/200/600. Ink und Amber stehen als
  `oklch(L C var(--h-ink))` bzw. `oklch(L C var(--h-amber))` in `tokens.css`; der Test löst diese beiden Hue-Variablen aus
  `:root` auf. Die Neutral-Töne haben einen festen Hue (250). Tokens mit `calc()` (z. B. Amber ab 600, Sky ab 500) werden
  nicht gebraucht; das Sky-700-Hex der Standard-Teamfarbe wird einmalig mit demselben Konverter bestimmt (siehe unten).
- **Drift-Test** (`pdf-theme.test.ts`, `// @vitest-environment node`): liest `tokens.css` per `node:fs`, löst die
  Token-Werte auf, wandelt sie mit `oklchToHex` um und vergleicht mit `pdfColors`. Ändert das Design-System einen dieser
  Töne, schlägt der Test an. (Vitest ersetzt CSS-Dateien beim Import durch leere Strings, deshalb `node:fs`.)
- Kontrast: Ink-900 auf Weiß erreicht AAA (≥ 7:1); Amber trägt nie Text.
- Bei den Überschriften entfällt `textTransform: 'uppercase'` (die App setzt Überschriften nicht in Großbuchstaben).

### Schriften (`src/lib/export/pdf-fonts.ts`, neu)

- `registerPdfFonts()` registriert per `Font.register`: Sora 600 und 700, Manrope 400, 500 und 700. Idempotent (merkt sich
  die Registrierung), wird von jedem Export vor dem Rendern aufgerufen.
- Quelle sind die bereits installierten `@fontsource/sora` und `@fontsource/manrope` (statische Schnitte). react-pdf liest
  TTF und WOFF, **kein WOFF2 und keine Variable-Fonts**; deshalb die statischen `.woff`-Dateien
  (`…/files/sora-latin-600-normal.woff` usw.), per Vite-`?url`-Import eingebunden. react-pdf bettet nur die genutzten
  Zeichen ein.
- `pdfBaseStyles` nutzt Sora für `h1`–`h3` und Manrope für Seite, Zellen und Tabellenköpfe.
- Das Latin-Subset deckt Deutsch ab. Zeichen anderer Alphabete waren mit der eingebauten Helvetica ebenfalls nicht
  darstellbar; es ist keine Verschlechterung.
- Fehlt eine Schriftdatei, **schlägt die Registrierung laut fehl**; es gibt keinen stillen Rückfall auf Helvetica.

### HTML-Export (`src/lib/export/html-export.ts`)

- Gleiche DSS-Farben (heller Tabellenkopf, Amber-Linie, Zebra), Überschriften in Sora, Text in Manrope.
- Sora und Manrope (Latin, dieselben Gewichte) als `.woff2` in einem Ordner `fonts/` der ZIP, eingebunden per
  `@font-face` mit relativem Pfad. `downloadHtmlZip` lädt die Dateien über `?url`-Importe und legt sie in die ZIP.
  Die Seite funktioniert offline und ohne installierte Schrift; die ZIP wächst um ca. 50–100 KB.

### Standard-Teamfarbe

`src/components/teams/TeamForm.tsx` (`initial?.color ?? '#004174'`) und die E2E-Fixture
`e2e/multi-group-round-robin-large.spec.ts` (`color: '#004174'`) wechseln auf ein DSS-Sky-Blau (Hex aus `--sky-700`,
mit demselben Konverter bestimmt; Wert in der Planung festzulegen). Das ist ein Datenstandard, kein Branding im engeren
Sinn, bleibt aber FBNM-Blau, wenn man es nicht ändert.

### Guard-Test

`src/styles/no-fbnm-leftovers.test.ts` (liest bereits per `node:fs`) wird verschärft: zusätzlich verboten werden die
FBNM-Hex-Farben (`#004174`, `#002751`, `#f0f7fc`, Groß-/Kleinschreibung egal) und `font-family:\s*'Aller'`. Bisher fing
der Test `'Aller'` mit kleinem `l` nicht, weil er case-sensitiv auf `ALLER` prüfte.

### Tests 4a

- Drift-Test der Farben (siehe oben).
- Registrierungstest: nach `registerPdfFonts()` enthält `Font.getRegisteredFontFamilies()` Sora und Manrope; die
  erwarteten Gewichte sind registriert.
- `oklch.ts`: Unit-Tests mit bekannten Werten (Weiß, Schwarz, ein Ink- und ein Amber-Token).
- ZIP-Test: `index.html` und `fonts/*.woff2` sind enthalten, jede im `@font-face` referenzierte Datei existiert.
- Bestehend: die Render-Unit-Tests der PDF-Exporte und `e2e/pdf-export.spec.ts` (vier PDF-Downloads, Prüfung `%PDF-`).

---

## 4b: Screenshots und Anleitungstext

### Skript

- Ein eigener Playwright-Lauf, **getrennt von der normalen E2E-Suite**: `playwright.screenshots.config.ts` und
  `screenshots/manual-screenshots.spec.ts`, gestartet mit `npm run screenshots:manual`. Er läuft nur auf Abruf und nicht
  in der CI. Der Dev-Server startet über das vorhandene `webServer`; es kommt keine neue Abhängigkeit hinzu.
- Eine Tabelle `SHOTS` mit einem Eintrag je Bild: Dateiname (unverändert `NN-….png`), Viewport in den **Originalmaßen**
  (01–23: 694×833, 03: 694×885, 24: 776×501, 25: 900×560, 26: 1100×700, 27: 900×700, 28–30: 900×520), `setup(page)` und
  optional ein Ausschnitt. Dadurch bleibt das Layout der Anleitung und des Anleitungs-PDFs unverändert.
- Zustände: Wo ein Demo-JSON existiert (`public/demos/01…05`), wird per `localStorage` geseedet. Leere Zustände, Dialoge
  und Teilzustände (leere Teamliste, Dialog, teilweise ausgefüllte Ergebnisse, Rückzug, Korrektur, gesperrte
  Konfiguration, Bestätigungsdialog) entstehen über die vorhandenen E2E-Helfer (`e2e/helpers.ts`) und UI-Schritte.
- Reproduzierbarkeit: `locale: 'de-DE'`, `timezoneId: 'Europe/Berlin'` (die alten Bilder zeigen teils 12-Stunden-Zeiten),
  `reducedMotion: 'reduce'`, Warten auf `document.fonts.ready`, Animationen und Caret aus, feste Teamnamen.
  Zwei Läufe hintereinander müssen identische Dateien liefern.
- Ausgabe: `public/anleitung/NN-….png`, überschreibt die vorhandenen Dateien.

### Absicherung

- Neuer Unit-Test: Jedes in `src/content/manual.md` referenzierte Bild existiert und hat die Maße aus `SHOTS`
  (PNG-Header, Bytes 16–23, ohne Abhängigkeit). `SHOTS` liegt dafür in einem importierbaren Modul
  (`screenshots/manual-shots.ts`).
- Bestehend: `ManualPage.test.tsx` (Bildanzahl, Referenzen).

### Anleitungstext (`src/content/manual.md`)

- Jedes Bild wird nach dem Erzeugen angesehen und mit dem umgebenden Text abgeglichen.
- Zu korrigieren sind: die „Drucken“-Passagen (~Zeilen 221, 242, Bildunterschrift 28) → PDF-Download; Beschreibungen wie
  „grünes Häkchen“ und „rotes … zurückgezogen-Feld“, soweit sie nicht mehr zum Bild passen; Button-Beschriftungen, die
  sich mit der Migration geändert haben.
- Es werden keine neuen Inhalte erfunden. Die Anleitung bleibt in Struktur und Umfang gleich.

---

## Risiken

1. **Schriftformat:** react-pdf liest kein WOFF2 und keine Variable-Fonts. Die statischen WOFF-Dateien müssen in den
   installierten `@fontsource`-Paketen existieren (in der Planung zu prüfen). Fehlt eine, stoppt die Umsetzung.
2. **Seitenumbrüche:** Sora/Manrope haben andere Metriken als Helvetica. `computeRoundPageBreaks`
   (`src/lib/print-pagination.ts`) und nicht umbrechende Blöcke im Anleitungs-PDF (ein früheres Review fand dort einen
   Überlauf) können sich verschieben. Gegenmaßnahme: PDFs aus den Demo-Daten (inkl. 64 Teams) erzeugen, react-pdf-Warnungen
   auswerten und die Seiten als Bild ansehen.
3. **Dateigröße:** PDF-Größe vor und nach der Umstellung messen, besonders das Anleitungs-PDF mit 30 Bildern.
4. **Screenshot-Determinismus:** Zeiten, Locale und Schriftladen können Bilder zwischen Läufen verändern; siehe feste
   Einstellungen und Doppellauf.
5. **Binäre Diffs sind schwer zu reviewen:** Dem PR liegt eine Kontaktbogen-Ansicht der neuen Bilder bei.
6. **Seed-Format:** Die Demo-JSONs müssen mit dem aktuellen Importformat laden; ein Fehler wird gemeldet, nicht umgangen.

## Dokumentation (laut `AGENTS.md`)

- **arc42 Kapitel 08:** neue Kopplung PDF-Theme ↔ DSS-Tokens samt Drift-Test; Hinweis auf das Screenshot-Skript.
- **arc42 Kapitel 09:** neuer ADR (nächste freie Nummer, aktuell ADR-12): eingebettete Schriften in PDF und HTML-Export, mit
  den verworfenen Alternativen (Helvetica behalten; nur Überschriften in Sora; Systemschrift im HTML-Export).
- **arc42 Kapitel 11:** In 11.14 die erledigten Punkte von Teil 4 streichen; 11.13 (Tagged-PDF) bleibt.
- **Use-Case-Übersicht** (`docs/use-cases-und-kritikalitaet.md`): UC6 (PDF/HTML-Export, Testabsicherung: Drift-Test,
  Registrierungstest, ZIP-Test, E2E-Downloads) und N2 (Anleitung: Bild-Test) aktualisieren. Keine neuen Use-Cases, keine
  geänderte Kritikalität (UC6 PDF/HTML bleibt ⚪, N2 bleibt ⚪).
- **A11y-Liste** (`e2e/accessibility.spec.ts`): unverändert; keine neue Route und keine neuen UI-Zustände.
- **Memory:** Die Notiz „Manual/screenshot update workflow“ wird durch den neuen Befehl ersetzt.

## Offene Punkte für die Implementierungsplanung

- Exakte Hex-Werte der Tabelle (Ergebnis des Konverters) und das Sky-700-Hex der Standard-Teamfarbe.
- Dateinamen und -pfade der `@fontsource`-WOFF/WOFF2-Dateien (statische Schnitte, Latin) und die Vite-`?url`-Importe.
- Wie die erzeugten PDFs visuell geprüft werden (z. B. `pdftoppm`, falls vorhanden; sonst Alternative festlegen).
- Aufteilung von `SHOTS` in Szenarien und welche Bilder aus Demo-JSONs bzw. aus UI-Schritten entstehen.
