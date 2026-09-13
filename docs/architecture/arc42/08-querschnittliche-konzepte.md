# 8. Querschnittliche Konzepte

Dieses Kapitel macht stillschweigende Kopplungen und Invarianten explizit, die im Code verteilt
sind und deren Verletzung bereits mehrfach zu Bugs geführt hat. Es ist der zentrale Ort, um vor
einer Änderung zu prüfen: "gibt es eine Regel, die ich hier übersehen könnte?"

## 8.1 Feldanzahl, Gruppenanzahl und Bracket-Größe sind UNABHÄNGIGE Werte

`TournamentConfig.fields` (wie viele Basketballfelder physisch verfügbar sind) und
`TournamentConfig.groupCount` (wie viele Gruppen die Vorrunde hat) sind komplett unabhängige
Konfigurationswerte — es gibt keine Formel, die eine aus der anderen ableitet. Die
Zeitplan-Generatoren verteilen Spiele stets über die tatsächliche `fields`-Anzahl, unabhängig
davon, wie viele Gruppen es gibt (`schedule-generator.ts`s Batch-Zuweisungsschleife über
`fieldNextFree[0..fields-1]`).

**Bekannter Fehler, der aus einer Verwechslung dieser beiden Werte entstand:** Die
"Anzahl Felder"-Auswahl in der UI (`TournamentForm.tsx`) war ursprünglich hart auf 1–4 begrenzt.
Bei einem Turnier mit vielen Gruppen (z. B. 16) aber wenigen Feldern wirkte das Ergebnis wie eine
"Gruppenanzahl statt Feldanzahl"-Verwechslung im Generator, obwohl die Ursache eine künstliche
UI-Obergrenze war, die verhinderte, die tatsächlich vorhandene Feldanzahl (z. B. 12 laut
Großturnier-Demo) überhaupt einzustellen. Fix: Obergrenze auf 6 angehoben (bewusste, realistische
Obergrenze für eine einzelne Halle, keine technische Beschränkung).

## 8.2 Bracket-Größen sind auf Zweierpotenzen 2/4/8/16/32 beschränkt

`buildBracket` (`finals-variant-generator.ts`) unterstützt ausschließlich `bracketSize ∈
{2,4,8,16,32}` (`BRACKET_STAGE_SEQUENCE`). Endrunde 1 ist deshalb nur aktivierbar, wenn
`groupCount` exakt einem dieser Werte entspricht (`canUseEndrunde1` in `FinalsVariantForm.tsx`);
Endrunde 3 ist fest auf genau 4 Gruppen beschränkt. Es gibt **keine** Freilos-Logik für
Nicht-Zweierpotenz-Gruppenzahlen — das ist eine bewusste Scope-Reduktion
(`docs/superpowers/specs/2026-09-12-endrunde-1-bracket-design.md`, Abschnitt "Scope-Reduktion"),
keine technische Notwendigkeit.

## 8.3 Bei mehreren Gruppen ist eine Endrunden-Variante PFLICHT

Sobald `mode === 'round-robin+finals'` UND `groupCount > 1`, MUSS `finalsVariant` gesetzt sein,
bevor ein Zeitplan generiert werden darf. Ohne diese Wahl fällt der Generator sonst auf einen
generischen Halbfinale/Finale-Fallback zurück (`generatePlayoffGames` ohne
`qualifierSourceRanks`), der keinerlei Gruppenrang-Zeiger setzt — die entstehenden Platzhalter
("1. der Vorrunde") können sich dann NIE automatisch auflösen, unabhängig vom Spielausgang.

Erzwungen in `ConfigPage.tsx` über `needsFinalsVariant`, das den "Zeitplan generieren"-Button
deaktiviert und einen erklärenden Hinweis zeigt, solange die Bedingung nicht erfüllt ist. Bei
`groupCount === 1` gilt diese Pflicht NICHT — eine einzelne Gruppe mit dem alten,
variantenlosen `finalsBracketSize`-Verhalten (2 oder 4) ist weiterhin ein gültiger, sich stets
korrekt auflösender Anwendungsfall (kein Gruppenbezug nötig, da es nur eine Gruppe gibt).

## 8.4 Die Gruppenanzahl-Vorschlagslogik schreibt sich selbst in den Store

`suggestGroupCount(teamCount, doubleRoundRobin)` (`group-suggestion.ts`) schlägt aus der
Teamanzahl eine Gruppenanzahl vor (Zweierpotenzen-Kandidatenliste `[1,2,4,8,16]`, Zielgröße 3,5
bzw. 2 Teams/Gruppe). `GroupAssignmentForm.tsx` committet diesen Vorschlag automatisch in
`tournament.groupCount`, sobald Teams vorhanden sind und `groupCount` noch `undefined` ist (nicht
nur als visueller Platzhalter) — ein Turnier mit z. B. 8 Teams hat deshalb schon `groupCount: 2`
im Store, auch wenn der Organisator die Team-zu-Gruppe-Zuordnung nie manuell geändert hat und alle
Teams optisch noch in Gruppe A stehen. Das ist eine reale Fallstricke-Quelle für Tests und manuelle
Konfiguration: "alle Teams sind noch in Gruppe A" bedeutet NICHT automatisch `groupCount === 1`.

## 8.5 `resolvePlaceholders` — Auflösungsregeln im Detail

Zentrale Funktion in `tournament-store.ts`, läuft nach jedem `submitGameResult`,
`correctGameResult` und `withdrawNonSwissTeam`-Aufruf über ALLE Spiele erneut (keine
Zwischenspeicherung/Memoisierung über Aufrufe hinweg — bei den Turniergrößen dieser App bewusst
in Kauf genommen, siehe Kommentar im Code):

- Ein Spiel mit `homeSourceRank`/`awaySourceRank` löst auf, sobald die referenzierte Gruppe
  **vollständig** ausgewertet ist (jedes Gruppenspiel hat entweder ein Ergebnis oder eine
  Annullierung — `groupIsComplete`).
- Ein Spiel mit `homeSourceMatch`/`awaySourceMatch` löst auf, sobald das referenzierte Vorgängerspiel
  (gleiche `rankTier`, per `{stage, matchIndex}` identifiziert) selbst ein Ergebnis hat.
- Ein bereits selbst ausgewertetes Spiel (`periodScores.length > 0`) wird NIE erneut überschrieben
  — eine spätere Korrektur der Vorstufe kann ein noch offenes Folgespiel neu befüllen, aber niemals
  ein bereits gespieltes Folgespiel rückwirkend ändern.
- Zurückgezogene Teams werden aus den Gruppenrängen herausgefiltert, bevor sie als Quelle für
  Endrunden-Plätze dienen können (`standingsByGroup`-Filterung `!s.withdrawn`).
- Match-Lookups sind IMMER nach `rankTier` skaliert (Schlüssel
  `` `${rankTier ?? 1}:${stage}:${matchIndex}` ``) — notwendig, weil Endrunde 1 mehrere parallele
  Rangstufen-Bäume gleichzeitig unterhält, deren Runden sonst kollidieren würden.

## 8.6 Rückzug (Withdraw) — drei strukturell verschiedene Pfade

| Modus/Phase | Funktion | Verhalten |
|---|---|---|
| Schweizer System | `withdrawSwissTeam` | Annulliert das laufende Spiel des Teams als Walkover, formt ALLE künftigen Runden neu (`reshapeFutureSwissRounds`), da diese erst zur Laufzeit generiert werden. |
| Gruppenphase (`stage: 'group'`) | `withdrawNonSwissTeam` | Annulliert verbleibende Gruppenspiele als Walkover, löst danach `resolvePlaceholders` erneut aus (eine Gruppenphase-Annullierung kann eine Gruppe gerade eben vollständig machen). |
| Platzierungsgruppe (`stage: 'placement'`, Endrunde 4) | `withdrawNonSwissTeam` | Wie oben — Kohorten-Spiele sind strukturell identisch zu Gruppenphasen-Spielen. |
| **KO-Bracket-Stages** (`round-of-32` … `third-place`, Endrunde 1/3) | — | **NICHT abgedeckt.** `withdrawNonSwissTeam` filtert explizit nur `stage === 'group' \|\| stage === 'placement'` — ein Rückzug während eines laufenden KO-Baums annulliert dessen Spiele nicht. Siehe Kapitel 11. |

## 8.7 `dropoutHandling` ist im UI deaktiviert — nur Walkover ist implementiert

`TournamentConfig.dropoutHandling` (`'walkover' | 'next-best-fills-in'`) existiert als Datenfeld
und als UI-Auswahl (`FinalsVariantForm.tsx`), aber das Auswahlfeld ist **fest deaktiviert**
(`disabled={true}`) mit dem Hinweistext "Ein Rückzug in der Endrunde wird aktuell immer als
Walkover gewertet — Nachrücker-Logik ist noch nicht implementiert." Der Wert des Felds hat aktuell
keine Auswirkung auf das tatsächliche Store-Verhalten (siehe Kapitel 11).

## 8.8 80 %-Branch-Coverage PRO DATEI, nicht im Aggregat

`vite.config.ts`: `coverage.thresholds = { branches: 80, perFile: true }`, Scope
`include: ['src/lib/**', 'src/store/**']`. Das bedeutet: eine einzelne Datei mit z. B. 60 %
Branch-Coverage lässt den CI-Job scheitern, selbst wenn der Gesamtdurchschnitt über 80 % liegt.
`src/pages/**` und `src/components/**` sind explizit NICHT im Coverage-Scope — UI-Komponenten
werden über E2E- und gezielte Komponententests abgesichert, nicht über dieses Gate.

## 8.9 E2E-first für kritische Prozesse

Für jeden neuen fachlich zentralen Nutzerfluss (z. B. "kompletter Endrunde-1-Turnierdurchlauf")
wird der Playwright-Test VOR der Implementierung geschrieben und muss zunächst — aus dem
korrekten Grund (Feature fehlt, nicht ein Tippfehler im Test) — fehlschlagen. Begründung
(wiederholt in mehreren Design-Specs): Unit-Tests prüfen isolierte Funktionen korrekt, können aber
strukturell nicht erkennen, wenn eine UI-Verkabelung fehlt (z. B. ein Store-Feld existiert, aber
keine Seite zeigt es an) — das deckt nur ein Test auf, der wie ein echter Nutzer durch den Browser
klickt.

## 8.10 Barrierefreiheits-Teststrategie

`e2e/accessibility.spec.ts` prüft mit `@axe-core/playwright` gegen `wcag2a`, `wcag2aa`, `wcag21a`,
`wcag21aa`-Regelsätze, gefiltert auf `impact === 'serious' \|\| impact === 'critical'` — kleinere
(`moderate`/`minor`) Verstöße lassen den Test NICHT scheitern. Geprüft werden zwölf kuratierte
Seiten-/Zustandskombinationen (Teams leer/mit Team, Konfiguration, Schweizer Ergebniserfassung,
-Übersicht, Score-Entry-Zustand, manuelle Paarungsdialog-Zustand, Export-Seite, Endrunde-4-
Ergebnisseite, Endrunde-1-Bracket-Ergebnisseite, kombinierte Endstand-Seite) — nicht jede
Seite/jeder Zustand der App ist abgedeckt (siehe Kapitel 10, 11.8). Diese Liste soll bei jeder
neuen Seite/jedem signifikanten neuen UI-Zustand erweitert werden (siehe `AGENTS.md`).

## 8.11 Keine Internationalisierung

Alle sichtbaren Texte sind fest auf Deutsch codiert (keine i18n-Bibliothek, keine
Sprachdatei-Abstraktion). Das ist eine bewusste Entscheidung angesichts des Einsatzzwecks
(deutschsprachige Vereinsturniere), nicht ein vergessenes Feature — nirgends in den Design-Docs
als geplante Erweiterung erwähnt.

## 8.12 Persistenz-Timing: jede Store-Aktion speichert sofort

Es gibt keinen "ungespeicherten Änderungen"-Zustand. Jede Store-Aktion, die `tournament` oder
`schedule` ändert, ruft am Ende synchron `saveTournament`/`saveSchedule` auf (`src/lib/storage.ts`
→ `localStorage.setItem`). Ein Reload der Seite verliert daher nie den letzten Stand — mit der
Kehrseite, dass es keine "Rückgängig"-Funktion gibt (außer dem expliziten JSON-Backup vor
destruktiven Aktionen, siehe Kapitel 1, Qualitätsziel 6).
