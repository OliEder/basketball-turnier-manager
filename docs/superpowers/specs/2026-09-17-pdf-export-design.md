# PDF-Export für Übersichtsseiten und Anleitung

## Kontext

Der Zeitplan-Export (`ExportPanel.tsx`) lädt bereits ein echtes PDF herunter, gebaut mit
`@react-pdf/renderer` (`src/lib/export/pdf-export.ts`). Drei weitere Stellen im Code nutzen
stattdessen noch den Umweg über ein HTML-Popup-Fenster und `window.print()`:

- `GroupOverviewPage.tsx` (Gruppentabellen + Zeitplan je Gruppe)
- `SwissOverviewPage.tsx` (Schweizer-System-Tabelle + Rundenspielpläne)
- `ManualPage.tsx` (Nutzeranleitung mit Screenshots, über `manual-print-export.ts`)

Der Popup/Print-Weg zwingt den Nutzer zu einem zusätzlichen "Als PDF speichern"-Schritt im
Browser-Druckdialog und lässt sich nicht automatisiert testen (der Druckdialog blockiert
Playwright, siehe Memory `playwright_mcp_print_dialog`). Ziel dieser Arbeit: alle drei Stellen
auf einen echten, direkten PDF-Download umstellen — gleiches Muster wie beim Zeitplan-Export.

## Ziel

„Drucken"-Buttons auf `GroupOverviewPage`, `SwissOverviewPage` und `ManualPage` werden zu
„PDF herunterladen"-Buttons, die ein layouttechnisch der bestehenden HTML/Print-Ansicht
entsprechendes PDF direkt herunterladen — kein Zwischenschritt über einen Druckdialog.

**Visuelle Vorgabe:** Das PDF soll nicht wie ein nüchternes Schwarz-Weiß-Dokument aussehen,
sondern das bestehende Farbschema der HTML/Print-Ansicht übernehmen: blaue Tabellenköpfe
(`#004174` mit weißer Schrift), dunkelblauer Fließtext (`#002751`), Zebra-Streifen
(`#f0f7fc`) auf geraden Zeilen, großgeschriebene blaue Überschriften.

## Architektur

Drei neue react-pdf-Renderer-Module, analog zum bestehenden `pdf-export.ts`:

- `src/lib/export/group-overview-pdf.ts` → `downloadGroupOverviewPdf(tournament, schedule, sections)`
- `src/lib/export/swiss-overview-pdf.ts` → `downloadSwissOverviewPdf(tournament, schedule, standings)`
- `src/lib/export/manual-pdf.ts` → `downloadManualPdf(images)`

Ein neues, gemeinsames Modul `src/lib/export/pdf-theme.ts` definiert die geteilten Farben und
`StyleSheet`-Fragmente (Werte 1:1 aus dem bestehenden Print-CSS in `group-overview-export.ts`
übernommen), damit alle PDF-Module optisch konsistent bleiben und die Farbwerte nicht
mehrfach dupliziert werden:

```ts
export const pdfColors = {
  brandBlue: '#004174',
  textDark: '#002751',
  zebra: '#f0f7fc',
  white: '#fff',
  border: '#e2e8f0',
}

export const pdfBaseStyles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica' },
  h1: { fontSize: 20, fontWeight: 'bold', color: pdfColors.brandBlue, textTransform: 'uppercase' },
  h2: { fontSize: 14, fontWeight: 'bold', color: pdfColors.brandBlue, marginTop: 16, marginBottom: 6 },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: pdfColors.brandBlue },
  tableHeaderCell: { color: pdfColors.white, fontSize: 10, fontWeight: 600, padding: 4 },
  tableRow: { flexDirection: 'row', borderBottom: `1px solid ${pdfColors.border}` },
  tableRowEven: { backgroundColor: pdfColors.zebra },
  cell: { fontSize: 10, color: pdfColors.textDark, padding: 4 },
})
```

Die bestehenden HTML/Print-Module werden komplett entfernt, nicht nur ungenutzt gelassen:

- `src/lib/export/group-overview-export.ts` (+ zugehöriger Test) → ersetzt durch `group-overview-pdf.ts`
- `src/lib/export/swiss-overview-export.ts` (+ zugehöriger Test) → ersetzt durch `swiss-overview-pdf.ts`
- `src/lib/export/manual-print-export.ts` (+ zugehöriger Test) → ersetzt durch `manual-pdf.ts`

`src/lib/print-pagination.ts` (`computeRoundPageBreaks`) bleibt unverändert bestehen und wird
von `swiss-overview-pdf.ts` weiterverwendet, um zu entscheiden, vor welcher Runde eine neue
`Page`-Komponente beginnt (statt eines CSS `page-break-before`).

## Komponenten im Detail

### `group-overview-pdf.ts`

Pro Gruppe eine eigene react-pdf `Page` (Entsprechung des bisherigen
`page-break-before: always` zwischen Gruppen). Je Gruppe:

1. Überschrift „Gruppe {groupId}"
2. Standings-Tabelle: `#`, Team (Abkürzung, mit vollem Namen als Titel-Attribut-Äquivalent
   nicht möglich in PDF — voller Name wird stattdessen direkt angezeigt, da PDFs keine
   Hover-Tooltips unterstützen), Pkt, Diff, S-U-N
3. Je Runde eine Tabelle: `#`, Feld, Zeit/Ergebnis, Paarung

Datengrundlage identisch zu `renderGroupOverviewHtml` (gleiche `GroupOverviewSection`-Typen),
nur als react-pdf-Elementbaum statt HTML-Template-String.

### `swiss-overview-pdf.ts`

1. Eine Gesamt-Standings-Tabelle: `#`, Team (inkl. „(zurückgezogen)"-Vermerk), Pkt, Buchholz, Diff
2. Je Runde eine Spieltabelle: `#`, Feld, Zeit/Ergebnis, Paarung

`computeRoundPageBreaks(rounds, gamesPerRound)` bestimmt, vor welchen Runden eine neue `Page`
beginnt — identische Berechnung wie bisher, nur als Trigger für eine neue react-pdf-`Page`
statt eines CSS-Page-Breaks.

### Markdown als gemeinsame Inhaltsquelle für die Anleitung

**Hintergrund:** `ManualPage.tsx` ist aktuell 609 Zeilen JSX mit 29 Screenshots über 9
Abschnitte, durchsetzt mit Fließtext, Listen, Links und Callout-Boxen — kein einfaches
Titel+Bild+Text-Schema. Eine generische Datenstruktur wie `{ id, title, paragraphs }` würde
diesen Reichtum nicht abbilden können. Recherche ergab: `react-markdown` ist seit 18 Monaten
unverändert und geht von DOM-Struktur aus (dokumentiert fragil mit react-pdf); `react-pdf-html`
führt ein drittes Zwischenformat (HTML) ein; Raster-Ansätze (html2pdf.js) verschlechtern die
PDF-Qualität gegenüber dem bestehenden nativen react-pdf-Export. Der tragfähige Ansatz:
**`marked`** (aktiv gepflegt, 0 Dependencies) zum Parsen von Markdown-Text in Tokens, plus ein
selbst geschriebener, gemeinsamer Renderer, der jeden Token-Typ einmal auf Web-JSX und einmal
auf react-pdf-Elemente abbildet.

**Neue Dateien:**

- `src/content/manual.md` — der komplette Anleitungstext, migriert aus `ManualPage.tsx`.
  Callout-Boxen werden über eine Fenced-Container-Konvention markiert:
  ```markdown
  ::: callout Hinweis zum Kürzel
  Wird kein Kürzel eingetragen, leitet das Tool automatisch eines ab ...
  :::
  ```
  Screenshots über normale Markdown-Bildsyntax mit Alt-Text: `![Leere Teamübersicht](01-teams-leer.png)`.
  Abschnittsüberschriften über normale `#`/`##`/`###`-Syntax (ersetzt `Section`/`SubSection`).

- `src/lib/markdown-tokens.ts` — dünner Wrapper um `marked.lexer(markdown)`, plus eine
  Vorverarbeitung, die `::: callout Titel\n...\n:::`-Blöcke zu einem eigenen Token-Typ
  `{ type: 'callout', title: string, tokens: Token[] }` umformt (da `marked` das nicht nativ
  kennt — die Callout-Blöcke werden vor dem eigentlichen `marked.lexer()`-Aufruf per Regex aus
  dem Markdown-Text herausgeschnitten und durch einen Platzhalter ersetzt, dessen Kindinhalt
  rekursiv mit `marked.lexer()` weiterverarbeitet wird).

- `src/lib/manual-markdown-jsx.ts` — `renderManualMarkdownToJsx(tokens: Token[]): ReactNode[]`.
  Wandelt Tokens in JSX um: `heading` → `<h2>`/`<h3>` mit den bestehenden
  `font-display text-xl uppercase text-brand-primary`-Klassen, `paragraph`/`text` → `<p>` mit
  `strong`/`em`/`a`-Inline-Verarbeitung, `list` → `<ul>`/`<ol>`, `image` → die bestehende
  `Screenshot`-Komponente (Pfad-Präfix `${import.meta.env.BASE_URL}anleitung/` + Dateiname aus
  dem Markdown-Bild-`src`), `callout` → die bestehende `Callout`-Komponente.

- `src/lib/manual-markdown-pdf.ts` — `renderManualMarkdownToPdf(tokens: Token[], images: Record<string, string>): ReactElement[]`.
  Gleiche Token-Typen, aber react-pdf-Ziel: `heading` → `<Text style={pdfBaseStyles.h2}>`,
  `paragraph` → `<Text style={pdfBaseStyles.cell}>` (Inline-`strong` als separates `<Text style={{fontWeight:'bold'}}>`-Fragment
  im selben `<Text>`-Parent, da react-pdf Inline-Formatierung durch verschachtelte `<Text>`
  statt HTML-Tags handhabt), `list` → `<View>` mit einem `<Text>` pro Listenpunkt (Präfix „• "
  bzw. „{n}. "), `image` → `<Image src={images[filename]} />` gefolgt von einem `<Text>` mit
  dem Alt-Text als sichtbare Bildunterschrift (siehe A11y-Abschnitt), `callout` → ein `<View>`
  mit hellblauem Hintergrund (`pdfColors.zebra`) und Rahmen, Titel fett.

  Jeder Abschnitt (oberste `##`-Ebene) wird in eine react-pdf `View` mit `wrap={false}`
  gruppiert, damit react-pdf den ganzen Abschnitt inklusive Überschrift auf die nächste Seite
  schiebt statt mitten im Abschnitt umzubrechen — erreicht die Vorgabe „Umbruch möglichst vor
  einer Überschrift" ohne manuelle Seitenzahl-Berechnung.

- `src/lib/export/manual-pdf.ts` — `downloadManualPdf(): Promise<void>`. Lädt
  `src/content/manual.md` (als Vite `?raw`-Import), parst es über `markdown-tokens.ts`, lädt
  die referenzierten Screenshots als Data-URIs (Funktion aus `manual-print-export.ts`
  übernommen, umbenannt zu `fetchImagesAsDataUris` da nicht mehr print-spezifisch), rendert
  über `manual-markdown-pdf.ts` und triggert den Download — analog zu `downloadPdf` in
  `pdf-export.ts`.

**`ManualPage.tsx`** wird auf einen dünnen Wrapper reduziert: lädt `manual.md` (`?raw`-Import),
parst über `markdown-tokens.ts`, rendert über `manual-markdown-jsx.ts`. Die
Inhaltskomponenten `Section`/`SubSection`/`Screenshot`/`Callout` bleiben als von
`manual-markdown-jsx.ts` verwendete Bausteine erhalten (nur ihre Aufrufer ändern sich), ebenso
`TableOfContents`/`TOC_ITEMS` (bleiben statisch, da die IDs aus den `#`/`##`-Überschriften im
Markdown den bisherigen `id`-Attributen entsprechen müssen — TOC_ITEMS wird beim Migrieren mit
den `#`-Überschriften im neuen `manual.md` abgeglichen, damit die Anker weiterhin funktionieren).

Diese eine Markdown-Datei ist damit die einzige Quelle der Wahrheit für Web-Seite und PDF —
keine Duplikation von Anleitungstext.

## UI-Änderungen

In allen drei Pages: Button-Label „Drucken" → „PDF herunterladen", Handler von
`handlePrint` (öffnet Popup-Fenster, ruft `window.print()`) zu `onClick={() => downloadXPdf(...)}`
geändert. Kein Popup-Fenster mehr, kein `window.open`.

## Testing

**Unit-Tests** (Vitest) für alle drei neuen Module, nach dem Muster der bisherigen
`group-overview-export.test.ts`/`swiss-overview-export.test.ts`, aber angepasst auf
react-pdf-Elementbäume statt HTML-Strings: Assertions direkt auf der von `createElement`
zurückgegebenen Baumstruktur (z. B. Anzahl der Gruppen-`Page`s, Tabellenzeilen-Anzahl,
enthaltene Textwerte), nicht auf einem geparsten PDF-Binary — das hält die Tests schnell und
robust.

**Nachrüsten:** Der bestehende `pdf-export.ts` (Zeitplan-Export) hat aktuell weder Unit- noch
E2E-Tests. Im Rahmen dieser Arbeit wird `pdf-export.test.ts` nach demselben neuen Muster
ergänzt.

**Refactor-Absicherung:** Da `ManualPage.tsx` auf einen Markdown-Wrapper umgebaut wird, wird
vor der Migration ein `ManualPage.test.tsx` geschrieben (oder ergänzt, falls schon vorhanden),
das die bestehende gerenderte Ausgabe absichert: alle 9 Abschnitts-Überschriften vorhanden, alle
29 Bild-`alt`-Texte vorhanden, Abschnittsreihenfolge unverändert. Der Umbau darf am sichtbaren
Ergebnis der Seite nichts ändern — dieser Test bleibt unverändert bestehen und muss nach der
Migration weiterhin grün sein. Zusätzlich: `markdown-tokens.test.ts` (Callout-Block-Erkennung,
Tokenisierung eines Minimalbeispiels), `manual-markdown-jsx.test.ts` und
`manual-markdown-pdf.test.ts` (je Token-Typ wird korrekt umgesetzt: Überschrift, Absatz,
Liste, Bild, Callout).

**E2E-Tests** (Playwright), analog zum kürzlich gemergten `e2e/export.spec.ts`
(UC6 JSON-Export): pro PDF ein Test, der den echten Download abfängt
(`page.waitForEvent('download')`) und prüft, dass die heruntergeladene Datei eine gültige,
nicht-leere PDF-Datei ist (Byte-Signatur `%PDF-` am Dateianfang, Größe > 0). Vier E2E-Tests
insgesamt: Zeitplan-PDF (nachgerüstet), Gruppenübersicht-PDF, Schweizer-System-PDF,
Anleitung-PDF.

## Barrierefreiheit (bestmögliche Annäherung)

**Technische Grenze:** `@react-pdf/renderer` unterstützt aktuell kein Tagged-PDF/PDF-UA
(offenes, ungelöstes Upstream-Issue). Ein echter Tagged-PDF-Output wäre nur über die
PDFKit-API erreichbar, die eine komplett andere, imperative Programmierschnittstelle hat und
nicht mit react-pdf kombinierbar ist — ein Umstieg würde alle vier PDF-Renderer (inkl. des
bereits gemergten Zeitplan-Exports) neu schreiben und ist damit außerhalb des Scopes dieser
Arbeit (siehe Memory `react_pdf_fork_idea` für die separate, spätere Idee eines Forks).

**Was innerhalb der react-pdf-Grenze umgesetzt wird:**

- **Dokument-Metadaten:** `Document`-Props `title`, `author`, `language="de"` auf allen vier
  PDFs setzen (react-pdf unterstützt das; wird bisher nirgends gesetzt).
- **Alt-Texte für Bilder:** Wo react-pdf es zulässt, den Screenshots in `manual-pdf.ts`
  aussagekräftige Alt-Beschreibungen mitgeben (Bildunterschrift als sichtbarer Text neben dem
  `<Image>`, da react-pdf kein echtes `alt`-Attribut mit Screenreader-Wirkung hat — der
  sichtbare Text ist damit der pragmatische Ersatz).
- **Farbkontrast:** bereits geprüft — alle vier relevanten Kombinationen liegen weit über der
  WCAG-AA-Anforderung von 4.5:1 (`#004174` auf Weiß: 10.46:1, `#002751` auf Weiß: 14.90:1,
  `#002751` auf Zebra-`#f0f7fc`: 13.78:1, Weiß auf `#004174`-Tabellenkopf: 10.46:1). Keine
  Anpassung der Farbwerte nötig.
- **Lesereihenfolge:** Der react-pdf-Elementbaum wird so aufgebaut, dass die visuelle
  Reihenfolge (oben nach unten, links nach rechts) der DOM-Reihenfolge entspricht — react-pdf
  rendert Text-Layer in Dokumentreihenfolge, sodass ein Screenreader mit Text-Layer-Zugriff
  (nicht die volle Struktur, aber immerhin linearer Text) die Inhalte in sinnvoller Reihenfolge
  vorliest.
- **Kein Tagged-PDF, keine Tabellen-Semantik, keine Landmark-Struktur** — das bleibt eine
  bekannte, dokumentierte Lücke.

Diese Maßnahmen werden nicht separat getestet (kein automatisiertes PDF-A11y-Tooling ist
Teil des Scopes), sondern als Teil der Implementierung direkt in `pdf-theme.ts` und den drei
neuen Modulen umgesetzt.

## Neue Abhängigkeit

`marked` (aktuell aktiv gepflegt, 0 Runtime-Dependencies) wird als neue Dependency in
`package.json` aufgenommen — ausschließlich für `markdown-tokens.ts`.

## Aufräumen

- `src/lib/print-pagination.test.ts` bleibt (testet weiterhin `computeRoundPageBreaks`,
  das unverändert weiterverwendet wird).
- `src/lib/export/manual-print-export.ts`, `group-overview-export.ts`,
  `swiss-overview-export.ts` (+ jeweilige Tests) werden gelöscht (ersetzt durch die neuen
  `*-pdf.ts`-Module bzw. den Markdown-Renderer).
- Memory `pdf_export_followup.md` wird nach Abschluss als erledigt markiert.
