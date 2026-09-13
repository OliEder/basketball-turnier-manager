# 4. Lösungsstrategie

Kurzüberblick der grundlegenden Entscheidungen, die die Architektur prägen. Details und
Begründungen dazu in Kapitel 8 (Konzepte) und Kapitel 9 (Architekturentscheidungen).

## 4.1 Offline-first, kein Backend

Die gesamte Anwendungslogik läuft im Browser; der einzige "Persistenz-Layer" ist `localStorage`
(`src/lib/storage.ts`, zwei Schlüssel: `tm_tournament`, `tm_schedule`). Das erzwingt, dass jede
Geschäftslogik (Zeitplan-Generierung, Tabellenberechnung, Platzhalter-Auflösung) synchron und ohne
Netzwerk-Roundtrip läuft — ein bewusster Designzwang, der die App auch bei Hallen ohne
Internetverbindung funktionsfähig hält.

## 4.2 Ein zentraler, flacher Zustand statt verteiltem Component-State

`useTournamentStore` (Zustand) hält den gesamten fachlichen Zustand (`tournament`, `schedule`,
`scheduleGenerationError`) an einer Stelle. Seiten-Komponenten lesen daraus und rufen
Store-Aktionen auf; sie halten selbst nur rein UI-bezogenen, flüchtigen Zustand (z. B. offene
Formularfelder, Filter-Einstellungen). Jede Store-Aktion, die den Zustand ändert, persistiert
synchron in `localStorage` (`saveTournament`/`saveSchedule` nach jedem `set(...)`-Aufruf) — es gibt
keine separate "Speichern"-Aktion, jede Änderung ist sofort dauerhaft.

## 4.3 Deterministische, reine Generator-Funktionen für die Zeitplanung

Die eigentliche Zeitplan-Erzeugung liegt vollständig in reinen Funktionen unter `src/lib/`
(`schedule-generator.ts`, `playoff-generator.ts`, `finals-variant-generator.ts`,
`swiss-schedule.ts`), die aus `TournamentConfig` deterministisch ein `Schedule`-Objekt erzeugen —
keine Zufallskomponente außer der ersten Schweizer-Runden-Paarung (`shuffle` in
`swiss-pairing.ts`, dort bewusst zufällig, damit die erste Runde nicht immer dieselbe
alphabetische Paarung ergibt). Das macht diese Funktionen einzeln, ohne UI oder Store, vollständig
testbar — der Großteil der Testsuite deckt genau diese Schicht ab.

## 4.4 Platzhalter-Modell statt Nachträglicher Generierung

Mehrstufige Formate (Gruppenphase + Endrunde) generieren **den kompletten Zeitplan sofort bei
Konfiguration**, inklusive aller späteren KO-/Platzierungsspiele — deren Teams zu diesem Zeitpunkt
noch nicht feststehen. Statt echter `Team`-Referenzen tragen diese Spiele Zeiger auf ihre künftige
Quelle (`homeSourceRank`/`awaySourceRank` auf einen Gruppenrang, `homeSourceMatch`/
`awaySourceMatch` auf ein früheres Turnierbaum-Spiel). Eine zentrale Store-Funktion
(`resolvePlaceholders`) läuft nach jedem Ergebnis-Eintrag erneut über alle Spiele und trägt echte
Teams ein, sobald ihre Quelle feststeht. Diese Entscheidung ist bewusst und mehrfach in den
Design-Specs bestätigt (siehe ADR in Kapitel 9) — die Alternative (Zeitplan erst nach Abschluss der
Vorstufe erzeugen) wurde für Endrunde 1 explizit als Erweiterung zurückgestellt.

## 4.5 Generische, wiederverwendbare Turnierbaum-Zeiger

Um KO-Bäume beliebiger Tiefe (2 bis 32 Teams) mit derselben Auflösungslogik zu unterstützen, wurde
das ursprünglich feste `homeSourceSemifinal`-Feld (nur für genau ein Halbfinale) zu einem
generischen `{ stage, matchIndex, outcome }`-Zeiger migriert. Diese Migration ist ein zentrales
Beispiel für "im Nachhinein generalisieren, sobald ein zweiter konkreter Anwendungsfall es
erfordert" statt vorzeitiger Abstraktion (siehe Kapitel 9, ADR zu `homeSourceMatch`).

## 4.6 Test-first als Architekturprinzip, nicht nur als Prozessregel

Die 80 %-Branch-Coverage-Schwelle *pro Datei* und die "E2E-first für kritische Prozesse"-Regel
wirken direkt auf den Zuschnitt der Module zurück: Geschäftslogik wird bevorzugt in kleine, pure
Funktionen ausgelagert (leicht isoliert testbar), UI-Komponenten bleiben bewusst "dünn" und
delegieren an den Store bzw. an `src/lib`-Funktionen.

## 4.7 Unvollständige Vereinheitlichung als bekannter Zwischenzustand

Die vier "Endrunden"-Konzepte (Platzierungsgruppen, drei verschiedene KO-Baum-Ausprägungen) waren
ursprünglich als EIN parametrisierter Baustein geplant (`docs/superpowers/specs/
2026-09-12-finals-variants-design.md`, Abschnitt "Generator-Architektur"), wurden aber bisher nur
teilweise so umgesetzt: Endrunde 4 (Platzierungsgruppen) und die KO-Baum-Familie (Endrunde 1 und 3)
existieren als separate, funktionierende, aber nicht vollständig deduplizierte Implementierungen.
Diese Lösungsstrategie wird in Kapitel 11 (Risiken) explizit als offener Punkt geführt, nicht
stillschweigend als abgeschlossen dargestellt.
