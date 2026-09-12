# Design: Endrunden-Varianten (Endrunde 1–4, 2a–2c)

## Kontext

Dieses Design ist das zweite Teilprojekt, das im Design [[2026-09-12-multi-group-round-robin-design]] explizit als "Nicht Teil dieses Designs" ausgeklammert wurde. Voraussetzung ist die dort implementierte Mehrgruppen-Vorrunde (Gruppen, Round-Robin, `computeGroupStandings`, tabbed `GroupOverviewPage`, `GroupResultsPage`).

**Ursprüngliche Anforderung** (aus einer Excel-Vorlage des Nutzers, siehe Memory `finals-variants-requirements`):

- **Endrunde 1**: alle Gruppenersten spielen Halbfinale+Finale+Spiel um Platz 3 um Platz 1–4; alle Gruppenzweiten ebenso um Platz 5–8; usw. für jede Rangstufe.
- **Endrunde 2**: Gruppenerste + Gruppenzweite qualifizieren für ein Viertelfinale+Halbfinale+Finale+Spiel um Platz 3 (Top 4).
- **Endrunde 2a**: wie 2, zusätzlich KO-Runde für Platz 5–8.
- **Endrunde 2b**: wie 2a, zusätzlich KO-Runde für Platz 9–16.
- **Endrunde 2c**: wie 2a, zusätzlich werden auch die restlichen Plätze in KO-Runden ausgespielt.
- **Endrunde 3**: nur die Gruppenersten spielen Halbfinale+Finale+Spiel um Platz 3 um Platz 1–4.
- **Endrunde 4**: alle Gruppenersten spielen in einer Vierergruppe (Round-Robin) um Platz 1–4; alle Gruppenzweiten ebenso um Platz 5–8; usw.

## Vorgelagerte Lücke, die dieses Design mit schließt

Der bestehende Code (`src/lib/playoff-generator.ts`) erzeugt Halbfinale/Finale ausschließlich mit Platzhaltertext (`homeTeamId: null`, `homeLabel: '1. der Vorrunde'`) — es existiert **kein** Mechanismus, der diese Platzhalter je automatisch durch echte Teams ersetzt, und **kein** Spiel um Platz 3. Das betrifft bereits das heutige einfache "Halbfinale+Finale"-Feature, nicht nur die neuen Varianten, und wird hier nachgerüstet, da alle Endrunden-Varianten darauf aufbauen.

Ebenfalls fehlend: ein Rückzugs-Mechanismus für die Gruppenphase (`withdrawTeam` ist aktuell hart auf `stage === 'swiss'` beschränkt). Wird hier auf `stage === 'group'` erweitert, da er Voraussetzung für sinnvolles Endrunden-Dropout ist.

## Datenmodell-Erweiterungen

```typescript
// TournamentConfig
finalsVariant?: 'endrunde-1' | 'endrunde-2' | 'endrunde-2a' | 'endrunde-2b' | 'endrunde-2c' | 'endrunde-3' | 'endrunde-4'
  // nur relevant bei mode === 'round-robin+finals' UND groupCount > 1; ersetzt die bisherige
  // implizite "Halbfinale+Finale ab 1./2./3./4. der Vorrunde"-Logik für den Mehrgruppen-Fall.
  // Bei groupCount === 1 bleibt das bestehende finalsBracketSize-Verhalten (2|4) unverändert nutzbar
  // (kein finalsVariant nötig — Endrunde 3 mit einer Gruppe ist ohnehin dasselbe wie heute).
dropoutHandling?: 'walkover' | 'next-best-fills-in'  // Standard: 'next-best-fills-in'; Verhalten bei
  // Rückzug eines für die Endrunde qualifizierten Teams, siehe Abschnitt "Dropout"

// Game — generalisiert:
finalsBracketSize?: number  // jetzt beliebige Zweierpotenz (2,4,8,16,32) statt bisher nur 2|4
rankTier?: number  // Rangstufen-Kohorte (1 = Gruppenerste, 2 = Gruppenzweite, ...) bei Endrunde 1/4;
  // undefined bei Endrunde 2/2a-c/3 (dort gibt es nur eine Kohorte: den Top-N-Pool)
placementFrom?: number  // niedrigster Zielrang dieses Brackets/dieser Kohorte (1, 5, 9, ...) —
  // Grundlage für Anzeige/Sortierung der Abschlusstabelle
sourceRank?: { groupId: string; rank: number } | { wildcardIndex: number }
  // welcher Gruppenrang (oder welcher Nachrücker-Slot) diesen Platzhalter befüllt;
  // Grundlage der automatischen Team-Befüllung (siehe unten)

// Team
withdrawnAfterStage?: 'group' | { bracketRound: number }  // Rückzugszeitpunkt in der Endrunde,
  // analog zum bestehenden Swiss-`withdrawnAfterRound`, aber stage-bezogen statt rundenbezogen
```

Kein neuer eigenständiger Typ für "Rangstufe" oder "Bracket" — beides bleibt reine Zusatzinformation an bestehenden `Game`-Objekten, konsistent mit dem YAGNI-Prinzip aus dem Vorgänger-Design (Gruppen sind auch nur eine String-ID, keine eigene Entität).

## Generator-Architektur

Vier neue, gezielt kleine Bausteine in `src/lib/playoff-generator.ts` (bzw. eine neue Datei `src/lib/finals-variant-generator.ts`, falls `playoff-generator.ts` dadurch zu groß würde):

### 1. `buildQualifierPool`

```typescript
function buildQualifierPool(
  groupStandings: Map<string, GroupStanding[]>,  // je Gruppe die fertige Tabelle
  variant: FinalsVariant,
  rankTier: number,  // 1 = "Gruppenerste", 2 = "Gruppenzweite", ...
  directQualifyRanksPerGroup: number,  // wie viele Ränge pro Gruppe direkt qualifizieren (z.B. 2 bei Endrunde 2)
  targetPoolSize: number,  // wie viele Slots das Bracket/die Kohorte braucht (nächste Zweierpotenz bzw. exakt 4 bei Endrunde 1/3/4)
): QualifierSlot[]  // QualifierSlot = { sourceRank: {groupId, rank} } | { wildcardIndex: number }
```

- Direkt qualifiziert: alle Teams mit Gruppenrang `≤ directQualifyRanksPerGroup` innerhalb der betrachteten Rangstufe (bei Endrunde 1/4 ist das einfach "Rang `rankTier`" je Gruppe; bei Endrunde 2/2a-c ist es "Rang 1 und 2" unabhängig von `rankTier`, da es dort keine Rangstufen-Wiederholung gibt).
- Fehlende Plätze werden mit den besten NICHT direkt qualifizierten Teams aufgefüllt (Nachrücker), sortiert nach: 1. Punkte, 2. Korbdifferenz, 3. erzielte Körbe, 4. Buchholz, 5. manuelle Organisator-Entscheidung. Der Buchholz-Wert hier ist eine NEUE Berechnung (`computeGroupPhaseBuchholz`, eigene kleine Funktion) — Summe der Endpunktzahlen aller Gegner, gegen die das Team in seiner eigenen Gruppenphase gespielt hat. Das ist eigenständig von `standings.ts`s Swiss-Buchholz (unterschiedliche Datengrundlage: Gruppenspiele statt Swiss-Runden), auch wenn dieselbe Grundidee ("Stärke der bisherigen Gegner") dahintersteht.
- Bei Endrunde 1/4 (mehrere Rangstufen): die Anzahl der Rangstufen wird durch die KLEINSTE Gruppengröße begrenzt — jede Gruppe hat garantiert einen Rang 1..kleinsteGruppengröße, sodass kein Team ohne Endrundenspiel bleibt.

### 2. `buildSeededBracket`

```typescript
function buildSeededBracket(
  slots: QualifierSlot[],  // Länge = Zweierpotenz (bereits von buildQualifierPool aufgefüllt)
  bracketSize: 2 | 4 | 8 | 16 | 32,
  scheduling: PlayoffInput,  // gleiche Felder wie bisher (fields, gameSettings, blackoutPeriods, ...)
): Game[]
```

- Generalisiert die bestehende `generatePlayoffGames`-Logik von `finalsBracketSize: 2|4` auf beliebige Zweierpotenzen, per Standard-Turnier-Seeding (Rang 1 vs. Rang N, Rang 2 vs. Rang N-1, ...), rekursiv pro Runde (Achtelfinale → Viertelfinale → Halbfinale → Finale).
- **Neu für alle Bracket-Größen**: jedes Halbfinale (die letzten 2 Spiele vor dem Finale) erzeugt zusätzlich ein Spiel um Platz 3 (fehlte bisher komplett, auch im bestehenden `4`-Fall).
- `Game.round`/`Game.gameNumber` wie bisher fortlaufend vergeben; `rankTier`/`placementFrom` an jedes erzeugte Spiel durchgereicht.

### 3. `buildPlacementRoundRobinGroup`

```typescript
function buildPlacementRoundRobinGroup(
  slots: QualifierSlot[],  // exakt 4 Slots (Vierergruppe laut Anforderung)
  scheduling: PlayoffInput,
): Game[]
```

- Nur für Endrunde 4: erzeugt eine Round-Robin-Kohorte, nutzt das bestehende `generateRoundRobinRounds` aus `schedule-generator.ts` wieder (keine neue Round-Robin-Logik). Kein Spiel um Platz 3 nötig — die Rangfolge ergibt sich aus der Kohorten-Tabelle selbst. Die `slots` kommen wie bei den KO-Varianten aus `buildQualifierPool` (hier: `directQualifyRanksPerGroup: 1`, `targetPoolSize: 4`, `mode: 'round-robin'`) — derselbe Baustein liefert für beide Modi die Teilnehmerliste, nur die Spielerzeugung selbst unterscheidet sich (KO-Baum vs. Round-Robin).

### 4. Varianten-Konfigurationstabelle

Eine reine Datenstruktur (kein Code-Zweig pro Variante), die für jedes `finalsVariant` festlegt:

```typescript
interface FinalsVariantConfig {
  rankTiers: 'all' | 1  // 'all' = so viele wie kleinste Gruppengröße (Endrunde 1, 4); 1 = nur Top-Pool (2, 2a-c, 3)
  directQualifyRanksPerGroup: number  // 1 (Endrunde 1, 3) oder 2 (Endrunde 2/2a-c, 4)
  bracketDepth: 'single' | 'placement-5-8' | 'placement-9-16' | 'placement-all'  // steuert 2 vs. 2a vs. 2b vs. 2c
  mode: 'ko' | 'round-robin'  // 'round-robin' nur bei Endrunde 4
}
```

`Endrunde 2/2a/2b/2c` unterscheiden sich ausschließlich in `bracketDepth` — ein Parameter statt vier Code-Pfade, wie in der ursprünglichen Anforderungs-Analyse vermutet.

## Automatische Team-Befüllung

Neue Store-Funktion `resolvePlaceholders()` in `tournament-store.ts`, aufgerufen am Ende von `submitGameResult` und `correctGameResult` (stage-unabhängig, läuft also auch nach Gruppenphase- und nach Bracket-Ergebnissen):

1. Für jedes Spiel mit `homeTeamId === null` oder `awayTeamId === null`: prüfe, ob das/die zugehörige(n) `sourceRank`-Ziel(e) bereits auflösbar sind — d. h. die Stufe, aus der der Rang stammt (Gruppenphase fertig, oder das vorherige Bracket-Spiel hat ein Ergebnis), ist vollständig ausgewertet.
2. Ist das der Fall: trage die reale `teamId` ein, lösche das Label-Feld.
3. Läuft nach jedem Speichern erneut (billige Operation, keine Performance-Sorge bei Turniergrößen dieser App).

**Korrektur-Verhalten**: wird ein Ergebnis der Vorstufe korrigiert, während die Folgestufe noch KEIN eigenes Ergebnis hat, wird die Folgestufe bei diesem Lauf automatisch neu befüllt (Team kann wechseln) — analog zum bestehenden Swiss-Korrekturmuster ("nur solange die nächste Runde noch offen ist"). Hat die Folgestufe bereits ein Ergebnis, bleibt sie unverändert (keine rückwirkende Anpassung eines bereits gespielten Spiels).

## Dropout (Rückzug) in der Endrunde

Erweiterung des bestehenden Rückzugs-Features (`docs/superpowers/specs/2026-09-11-withdraw-ux-and-print-fix-design.md`), das aktuell nur für `stage === 'swiss'` existiert:

1. **Gruppenphase-Rückzug** (neu, Voraussetzung für 2): `withdrawTeam` wird auf `stage === 'group'` erweitert. Verbleibende ungespielte Gruppenspiele des Teams werden annulliert (`cancelledReason: 'withdrawal'`, `periodScores: [{period: 1, homeScore: 0, awayScore: 0}]`, Gegner erhält die Punkte als Walkover) — ohne Swiss-typisches Neu-Mischen künftiger Runden (`reshapeFutureSwissRounds` hat in der Gruppenphase kein Äquivalent, da Gruppenpaarungen bereits zu Beginn feststehen und nicht rundenweise neu erzeugt werden).
2. **Rückzug NACH Qualifikation, Bracket-Runde noch nicht begonnen**: gesteuert über `dropoutHandling` (Standard `'next-best-fills-in'`):
   - `'next-best-fills-in'`: `buildQualifierPool` wird für die betroffene Rangstufe/Kohorte neu berechnet, der nächstbeste bisher nicht qualifizierte Nachrücker füllt den frei gewordenen Slot.
   - `'walkover'`: das anstehende Spiel des zurückgezogenen Teams wird annulliert, der Gegner rückt kampflos vor (wie beim bestehenden Swiss-Freilos-Muster).
3. **Rückzug NACHDEM die Bracket-Runde bereits terminiert/begonnen hat**: Nachrücken ist dann nicht mehr sinnvoll möglich — es greift IMMER automatisch der Walkover-Fall für das anstehende Spiel, unabhängig von der `dropoutHandling`-Einstellung (analog zur bestehenden Korrektur-Grenze "nur solange die nächste Runde noch offen ist").
4. Bei Endrunde 4 (Round-Robin-Kohorte): Rückzug innerhalb der Kohorte annulliert die verbleibenden Kohorten-Spiele des Teams als Walkover (kein Nachrücker-Konzept dort, da keine KO-Struktur mit "freiem Slot" existiert).

## UI

### Konfigurationsseite — neuer Abschnitt "Endrunden-Variante"

Sichtbar nur bei `mode === 'round-robin+finals'` UND `groupCount > 1`:

- **Auswahl** der 7 Varianten (Radio-Gruppe oder Dropdown, mit Kurzbeschreibung je Option wie in der ursprünglichen Anforderung formuliert).
- **Warnhinweis bei ungleichen Gruppengrößen** (Alert-Style, direkt im Gruppen-Konfigurationsabschnitt aus dem Vorgänger-Design ergänzt, nicht erst hier): informiert den Organisator schon bei der Gruppeneinteilung, dass ungleiche Gruppen zu entfallenden Rangstufen bzw. reduzierter Rangstufen-Anzahl führen.
- **Seeding-Vorschau**:
  - Bei KO-Varianten (1, 2, 2a–2c, 3): Kreuztabelle je Gruppenpaar — zeigt pro Zelle die früheste Stufe (Viertelfinale/Halbfinale/Finale), in der zwei Gruppen aufeinandertreffen könnten. Kompakt, skaliert gut mit vielen Gruppen (siehe Mockup-Vergleich mit Baum-Diagramm — Kreuztabelle bleibt bei 8 Gruppen deutlich lesbarer als ein SVG-Baum).
  - Bei Endrunde 4 (Round-Robin-Kohorten): keine Kreuztabelle nötig (jede Kohorte spielt ohnehin komplett gegeneinander) — stattdessen eine einfache Liste der Rangstufen-Kohorten, z. B. "Rangstufe 1 (Platz 1–4): Gruppenerste aller Gruppen".
- **Kapazitäts-Warnhinweis** (Alert-Farbe, kein hartes Blockieren): grobe Schätzung der zusätzlichen Spielanzahl, wenn diese hoch ist (z. B. Endrunde 1/4 mit vielen Rangstufen). Die vollständige Lösung (mehrere Hallentage) ist Teil des separaten, späteren Mehrtägigkeits-Features — hier reicht der Hinweis, damit der Organisator die Variante ggf. anpasst oder die Konfiguration (Felder/Zeit) erweitert.
- **"Bei Rückzug in der Endrunde"**: Dropdown `Nächster Nachrücker rückt nach` (Standard) / `Gegner rückt kampflos vor (Walkover)`.

### Neue Seite „Endrunde: Ergebnisse erfassen"

Analog zu `GroupResultsPage` (gleiche Filter-/Eingabe-/Korrektur-Interaktion), aber:
- Datenbasis: alle Spiele mit `stage !== 'group'`.
- Zeilen-Tag: Bracket-/Rangstufen-Kennzeichnung (z. B. „Viertelfinale — Platz 1–4" oder „Rangstufe 2 — Platz 5–8") statt Gruppen-Tag.
- Spiele mit noch unaufgelösten Platzhaltern (`homeTeamId === null`) werden nicht zur Ergebniseingabe angeboten (kein Team einzutragen), erscheinen aber informativ mit Platzhaltertext in der Liste.

### Neue Seite „Endstand"

Erscheint in der Navigation, sobald mindestens ein Endrunden-Spiel gespielt wurde; zeigt eine durchgehende Rangliste 1..N, zusammengesetzt aus den Bracket-Endergebnissen (Sieger Finale = höchster Platz der Kohorte, Verlierer Finale = nächster, Sieger Spiel-um-Platz-3 = übernächster, ...) bzw. der Endtabelle der Round-Robin-Kohorte bei Endrunde 4. Unvollständige Kohorten zeigen ihren Teil als "ausstehend".

## Nicht Teil dieses Designs

- Mehrtägigkeit (mehrere Hallentage) — bleibt eigenständiges, späteres Feature; der Kapazitäts-Warnhinweis hier ist bewusst nur ein Hinweis, keine Lösung.
- Automatische, nicht-standardmäßige Seeding-Strategien (z. B. manuell umsortierbarer Bracket-Baum) — das Seeding folgt immer der Standard-Formel (bester Rang trifft schwächsten verbleibenden Rang), nicht manuell veränderbar.
- Änderungen an der Swiss-System-Logik — unberührt, außer der bereits bestehenden `withdrawTeam`-Funktion, die um einen zusätzlichen `stage === 'group'`-Zweig ergänzt wird (der Swiss-Zweig selbst bleibt unverändert).

## Demo-Tournaments

Wie in der Vorgänger-Memory vermerkt: `public/demos/` braucht mindestens ein Demo pro strukturell unterschiedlicher Variante (mindestens: eine einfache Top-4-Variante wie Endrunde 3, eine mehrstufige wie Endrunde 1 oder 2b, eine Round-Robin-Variante wie Endrunde 4), generiert über `scripts/generate-demo-tournaments.mts` durch den echten Generator-Code — nie hand-getippt. Jedes Demo muss weiterhin `parseTournamentImport` bestehen. Das Manual (`docs/anleitung`, siehe Memory `manual_screenshot_workflow`) bekommt einen neuen Abschnitt für die Endrunden-Variantenwahl und die neuen Seiten.
