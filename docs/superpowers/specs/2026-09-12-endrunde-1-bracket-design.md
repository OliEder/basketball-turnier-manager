# Design: Endrunde 1 — Mehrfach-KO-Bracket je Rangstufe

## Kontext

Nach der Gruppenphase (mehrere gleich große Gruppen) qualifizieren sich bei "Endrunde 1" **alle
Rangstufen** für ein eigenes KO-Turnier: die Gruppenersten aller Gruppen spielen ein Halbfinale/
Viertelfinale-usw.+Finale+Spiel-um-Platz-3 um Platz 1–N, die Gruppenzweiten ebenso um die nächsten
N Plätze, und so weiter — begrenzt durch die kleinste Gruppengröße (jede Gruppe hat garantiert
einen Rang 1..kleinsteGruppengröße).

Das ist strukturell eine Kombination aus zwei bereits gebauten Features:

- **Endrunde 4** (`finals-variant-generator.ts`, `buildPlacementCohorts`): mehrere parallele
  Rangstufen-Kohorten, eine pro Gruppenrang, begrenzt durch die kleinste Gruppengröße.
- **Endrunde 3** (`playoff-generator.ts`, `resolvePlaceholders` in `tournament-store.ts`):
  Halbfinale+Finale+Spiel-um-Platz-3 als KO-Baum mit automatischer Platzhalter-Auflösung.

Der Unterschied zu Endrunde 4: statt Round-Robin je Kohorte wird pro Rangstufe ein **KO-Baum**
gespielt. Der Unterschied zu Endrunde 3: es gibt **mehrere** KO-Bäume gleichzeitig (einen pro
Rangstufe), nicht nur einen für die Gruppenersten.

## Scope-Reduktion (explizite Entscheidung dieser Session)

Drei ursprünglich diskutierte Erweiterungen sind **bewusst nicht Teil dieser Spec**, da sie den
Rahmen sprengen würden:

1. **Freilose bei Nicht-Zweierpotenz-Gruppenzahlen.** Endrunde 1 ist nur aktivierbar, wenn die
   Gruppenanzahl exakt einer unterstützten Bracket-Größe entspricht: 2, 4, 8, 16 oder 32. Bei
   anderen Gruppenzahlen bleibt die Option deaktiviert — analog zur bestehenden
   Endrunde-3-Einschränkung auf genau 4 Gruppen.
2. **Buchholz-basiertes Seeding.** Qualifikations-Seeding bleibt wie bei Endrunde 3 rein
   alphabetisch nach Gruppen-ID (Gruppe A = Seed 1, B = Seed 2, ...), nicht nach
   Gruppenphase-Stärke. `computeGroupPhaseBuchholz` (bereits vorhanden, ungenutzt seit Endrunde 4)
   bleibt weiterhin nur für eine mögliche spätere Wildcard-Erweiterung vorgehalten.
3. **Nachträgliche Zeitplan-Generierung nach Gruppenphase-Ende.** Wie bei Endrunde 3/4 wird der
   komplette Zeitplan (inkl. aller KO-Spiele als Platzhalter) **sofort bei Konfiguration**
   generiert, nicht erst nachdem die Gruppenphase gespielt wurde. Das ist nur möglich, weil das
   Seeding rein von der (zur Generierungszeit bereits bekannten) Gruppen-ID abhängt, nicht von
   Ergebnissen.

Diese drei Punkte sind mögliche spätere Erweiterungen (eigene, separate Specs), keine
Teilaufgaben dieser Implementierung.

## Datenmodell-Änderung: generische Turnierbaum-Zeiger

**Migration, kein Parallelbetrieb:** Die bestehenden Felder `homeSourceSemifinal` /
`awaySourceSemifinal` (`{ semifinalIndex: 1 | 2; outcome: 'winner' | 'loser' }`, eingeführt für
Endrunde 3 in `src/types/index.ts:102-105`) werden ersetzt durch generische Zeiger, die auf
beliebige Baumtiefe skalieren:

```typescript
homeSourceMatch?: { stage: GameStage; matchIndex: number; outcome: 'winner' | 'loser' }
awaySourceMatch?: { stage: GameStage; matchIndex: number; outcome: 'winner' | 'loser' }
```

`matchIndex` nummeriert die parallelen Spiele **einer Stufe innerhalb einer Rangstufe** durch,
0-basiert, in der festen Reihenfolge, in der `buildBracket` sie erzeugt (siehe unten). Beispiel
für ein 8er-Bracket (Rangstufe 1): Viertelfinale hat `matchIndex` 0–3, Halbfinale 0–1. Das
Spiel-um-Platz-3 und das Finale verweisen beide auf die **Halbfinale**-Spiele
(`{ stage: 'semifinal', matchIndex: 0 }` / `{ stage: 'semifinal', matchIndex: 1 }`), analog zum
bestehenden Endrunde-3-Muster.

**Neue `GameStage`-Werte** (in `src/types/index.ts`, aktuell `'group' | 'semifinal' | 'final' |
'third-place' | 'swiss' | 'placement'`): `'round-of-32'`, `'round-of-16'`, `'quarterfinal'` —
ergänzen die bestehenden `'semifinal'`, `'final'`, `'third-place'`. Zusammen decken diese 6
KO-Stufen Bracket-Größen bis 32 ab: 32 → Runde-der-32 → Runde-der-16 → Viertelfinale → Halbfinale
→ Finale/Platz-3 (5 Runden insgesamt für ein 32er-Bracket).

**`rankTier`** (bereits vorhanden, aus Endrunde 4) wird auch für Endrunde-1-KO-Spiele gesetzt:
zusammen mit `stage` und `matchIndex` identifiziert es ein Spiel eindeutig, auch wenn mehrere
Rangstufen gleichzeitig ihr eigenes Viertelfinale spielen.

**Betroffene bestehende Dateien (Migration, nicht additiv):**
- `src/types/index.ts` — Felder umbenennen/generalisieren, `GameStage` erweitern.
- `src/lib/playoff-generator.ts` — `homeSourceSemifinal`/`awaySourceSemifinal`-Literale durch
  `homeSourceMatch`/`awaySourceMatch` ersetzen (Zeilen 153-154, 170-171 als Referenz für den
  bestehenden 4er-Fall, der zum Basisfall des neuen generischen Generators wird).
- `src/store/tournament-store.ts` — `resolvePlaceholders`s `semifinalOutcomeTeamId`-Hilfsfunktion
  und der `semifinalsByIndex`-Lookup (Zeilen 268, 306-321 als Referenz) werden durch einen
  generischen `{stage, matchIndex}`-Lookup ersetzt, der über alle Spiele einer Rangstufe indiziert
  statt nur über die zwei Halbfinal-Spiele.
- `e2e/endrunde-3.spec.ts`, `src/lib/playoff-generator.test.ts`,
  `src/store/tournament-store.test.ts` — Tests, die die alten Feldnamen referenzieren, werden auf
  die neuen umgestellt.

## Neuer Baustein: `buildBracket()`

Neue Funktion in `src/lib/finals-variant-generator.ts`, ersetzt/generalisiert den
`finalsBracketSize === 4`-Zweig aus `src/lib/playoff-generator.ts:41-172`:

```typescript
interface BuildBracketInput {
  bracketSize: 2 | 4 | 8 | 16 | 32
  rankTier: number             // welche Rangstufe dieser Baum bedient
  sourceRanks: { groupId: string; rank: number }[]  // bracketSize Einträge, Seed-Reihenfolge
  fields: number
  gameSettings: GameSettings
  blackoutPeriods: TimeWindow[]
  availabilityEnd: string
  fieldNextFree: string[]
  startGameNumber: number
}

function buildBracket(input: BuildBracketInput): Game[]
```

**Rekursive Rundenerzeugung:** für `bracketSize = 2^n`, erzeugt `buildBracket` `n` KO-Runden
(z.B. `bracketSize=8` → Viertelfinale (4 Spiele) → Halbfinale (2 Spiele) → Finale (1) +
Platz-3 (1)). Jede Runde füllt `homeSourceMatch`/`awaySourceMatch` mit Zeigern auf die
Vorrunden-Spielpaare `(2i, 2i+1)` für `matchIndex i` der Folgerunde — Standard-Turnierbaum-Prinzip.
Nur die **erste** Runde bekommt `homeSourceRank`/`awaySourceRank` (Zeiger auf Gruppenphase-Ränge);
alle Folgerunden nutzen ausschließlich `homeSourceMatch`/`awaySourceMatch`.

**Zeitplanung:** wie im bestehenden 4er-Fall — Spiele derselben Runde laufen parallel auf so
vielen Feldern wie verfügbar, sequentiell wenn nicht genug Felder da sind; jede Runde beginnt
`breakBetweenRoundsMin` nach dem spätesten Spielende der Vorrunde. Finale und Platz-3-Spiel laufen
parallel (wie bei Endrunde 3).

**Seeding:** `sourceRanks` kommt vom Aufrufer (siehe unten) in Standard-Turnier-Seed-Reihenfolge
(Seed 1 vs. Seed `bracketSize`, Seed 2 vs. Seed `bracketSize-1`, ...), rekursiv nach Runde
aufgelöst — Verallgemeinerung von `buildQualifierSeeds`s bisherigem festen 4er-Muster
(A vs. D, B vs. C).

`playoff-generator.ts`s bestehender `generatePlayoffGames`-Entry-Point (für den einfachen,
Nicht-Gruppen-basierten Halbfinale+Finale-Fall ohne `finalsVariant`) bleibt unverändert bestehen
und ruft intern `buildBracket` für `bracketSize=4` bzw. die bestehende Nur-Finale-Logik für
`bracketSize=2` auf — kein Verhaltensunterschied für den bereits existierenden, einfachen
Anwendungsfall.

## `generateSchedule`-Integration

Neuer Zweig in `src/lib/schedule-generator.ts`, analog zum bestehenden
`finalsVariant === 'endrunde-4'`-Zweig (Round-Robin-Kohorten) und
`finalsVariant === 'endrunde-3'`-Zweig (ein KO-Baum):

```typescript
if (config.mode === 'round-robin+finals' && config.finalsVariant === 'endrunde-1') {
  // groupCount muss 2, 4, 8, 16 oder 32 sein (validiert in der Config-UI, siehe unten)
  const standingsByGroup = new Map(groupIds.map(groupId => [groupId, computeGroupStandings(teams, games, groupId)]))
  const rankTierCount = Math.min(...standingsByGroup.values().map(s => s.length))  // wie Endrunde 4
  for (let rankTier = 1; rankTier <= rankTierCount; rankTier++) {
    const sourceRanks = buildQualifierSeeds(groupIds, rankTier)  // generalisiert, siehe unten
    const bracketGames = buildBracket({ bracketSize: groupIds.length, rankTier, sourceRanks, ... })
    games.push(...bracketGames)
  }
}
```

`buildQualifierSeeds` (bestehend, `src/lib/finals-variant-generator.ts`, aktuell hart auf genau 4
Gruppen und Rang 1 beschränkt) wird generalisiert: nimmt zusätzlich `rankTier` entgegen und
unterstützt beliebige Zweierpotenz-Gruppenzahlen, liefert weiterhin alphabetisch sortierte,
Standard-Turnier-Seed-Paare.

**Kapazitäts-Warnung:** analog zur bestehenden Endrunde-4-Warnung in `FinalsVariantForm.tsx` — bei
vielen Rangstufen × großem Bracket kann die Spielanzahl schnell wachsen (z.B. 16 Gruppen → 4
Rangstufen × 15 KO-Spiele = 60 zusätzliche Spiele). Gleiche Schätzformel-Idee, angepasst auf
KO-Bracket-Spielanzahl (`bracketSize - 1` Spiele pro Baum plus ein Platz-3-Spiel) statt
Round-Robin-Spielanzahl.

## Store-Integration: `resolvePlaceholders`

Erweitert um generische Turnierbaum-Auflösung (ersetzt die bisherige, nur auf `semifinal`
beschränkte Logik):

- Für jede Rangstufe wird eine `Map<string, Game>` aufgebaut, keyed by `` `${stage}:${matchIndex}` ``,
  über alle KO-Spiele dieser Rangstufe.
- Ein Spiel mit `homeSourceMatch`/`awaySourceMatch` löst gegen diese Map auf: `semifinalOutcomeTeamId`
  wird zu einer stage/matchIndex-agnostischen `matchOutcomeTeamId`-Funktion.
- Ein Spiel mit `homeSourceRank`/`awaySourceRank` (nur die erste Bracket-Runde) löst wie bisher
  gegen die Gruppenphase-Standings auf, inkl. Ausschluss zurückgezogener Teams (bestehendes
  Verhalten, unverändert).
- Jede Seite löst weiterhin unabhängig auf; ein Spiel mit nur einer bekannten Seite bleibt auf der
  anderen Seite ein Platzhalter, bis auch diese Quelle feststeht (bestehendes Verhalten aus
  Endrunde 3/4, unverändert).

## Config-UI

`FinalsVariantForm.tsx`: "Endrunde 1" als weitere Option im Dropdown, nach dem bestehenden
Endrunde-3-Muster:

```
<option value="endrunde-1" disabled={!canUseEndrunde1}>
  Endrunde 1 — K.-o.-Runden je Rangstufe (alle Gruppenersten, -zweiten, ...)
</option>
```

`canUseEndrunde1 = [2, 4, 8, 16, 32].includes(groupCount)`. Bei deaktivierter Option:
Erklärtext "Endrunde 1 benötigt eine Gruppenanzahl von 2, 4, 8, 16 oder 32 (aktuell: N)."

## Neue Seite: `BracketResultsPage.tsx`

Tab-basierte Ansicht analog zu `GroupOverviewPage.tsx`: ein Tab pro Rangstufe (Label z.B.
"Rangstufe 1 (Platz 1–4)"), zeigt innerhalb des aktiven Tabs den KO-Baum dieser Rangstufe als
Ergebniserfassungs-Liste (wiederverwendet das bestehende Score-Entry/Correction-Muster aus
`PlayoffResultsPage.tsx`, gruppiert nach Runde: Viertelfinale-Zeilen, dann Halbfinale-Zeilen, dann
Finale/Platz-3-Zeilen). Route: `/bracket-results`. Nav-Label: "Endrunde: K.-o.-Ergebnisse"
(ersetzt für `finalsVariant === 'endrunde-1'` das bestehende `/playoff-results`, das für Endrunde 3
mit nur einer Rangstufe weiterhin greift).

## Neue Zusammenfassung: Gesamt-Endstand

Neue Funktion `computeEndrunde1Standings` (Datei `src/lib/final-standings.ts`, neben dem
bestehenden `computeFinalStandings` für Endrunde 4): führt für jede Rangstufe das Ergebnis ihres
Finales und Platz-3-Spiels zu 4 Plätzen zusammen (Finale-Sieger = bester Platz der Rangstufe,
Finale-Verlierer = zweitbester, Platz-3-Sieger = drittbester, Platz-3-Verlierer = schlechtester),
analog zu `placementFrom` bei Endrunde 4. Angezeigt auf einer neuen oder erweiterten
Endstand-Seite (Wiederverwendung von `FinalStandingsPage.tsx`s Tabellen-Layout, mit
variantenabhängiger Datenquelle).

## Testing-Strategie

**E2E-first (kritischer Prozess):** vor jeglicher Implementierung wird
`e2e/endrunde-1.spec.ts` geschrieben, das den vollständigen Organizer-Flow abdeckt: 8 Gruppen
konfigurieren, Endrunde 1 wählen, Gruppenphase spielen, Rangstufe-1-Viertelfinale automatisch
aufgelöst sehen, durch Viertelfinale → Halbfinale → Finale/Platz-3 spielen, Rangstufe-2-Baum
parallel ebenso durchspielen, Gesamt-Endstand prüfen. Dieser Test schlägt zunächst fehl (Feature
existiert nicht) und wird erst grün, wenn die Implementierung vollständig ist.

**TDD pro Baustein:** `buildBracket` (Unit-Tests für 2/4/8er-Bracket-Struktur, Zeitplanung,
Zeiger-Korrektheit), generalisiertes `buildQualifierSeeds`, `resolvePlaceholders`-Erweiterung
(Unit-Tests analog zu den bestehenden Endrunde-3-Resolver-Tests, aber mit mehrstufigen Bäumen),
`computeEndrunde1Standings`.

**Coverage:** jede neue/geänderte Datei muss die bestehende 80%-Branch-Coverage-Schwelle
(`vite.config.ts`, `perFile: true`) einzeln einhalten — insbesondere `buildBracket`s rekursive
Rundenlogik braucht Tests für jede unterstützte Bracket-Größe (2, 4, 8 mindestens; 16/32 können
sich strukturell aus denselben Codepfaden ergeben, sollten aber mit mindestens einem Test pro
zusätzlicher Verzweigung abgedeckt sein, falls die Rekursion bracket-größenabhängige Sonderfälle
hat).

## Demo-Turnier

Wie in der Vorgänger-Memory vermerkt: mindestens ein Demo-Turnier für eine mehrstufige Variante
wie Endrunde 1 wird über `scripts/generate-demo-tournaments.mts` (echter Generator-Code, nie
hand-getippt) ergänzt — Nice-to-have, kein Blocker für den ersten Merge, wenn Zeit/Budget knapp
wird.

## Nicht Teil dieser Spec (siehe "Scope-Reduktion")

- Freilose bei Nicht-Zweierpotenz-Gruppenzahlen.
- Buchholz-basiertes Cross-Group-Seeding.
- Nachträgliche (verzögerte) Zeitplan-Generierung nach Gruppenphase-Abschluss.
- Endrunde 2/2a/2b/2c (separate, spätere Phase — nutzen laut Ursprungs-Spec einen gemeinsamen
  `directQualifyRanksPerGroup`/`bracketDepth`-Mechanismus, der auf `buildBracket` aufbauen kann,
  sobald dieses existiert).
