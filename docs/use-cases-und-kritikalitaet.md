# Use-Cases und Geschäftsprozesse: Übersicht und Kritikalität

Dieses Dokument ist eine **lebende** Übersicht der Geschäftsprozesse (Use-Cases) des Turnier-Managers,
mit einer Einschätzung, wie kritisch jeder Prozess ist und wie er aktuell testtechnisch abgesichert
ist. Es soll verhindern, dass Änderungen an einem Teil der App unbemerkt einen anderen, aus
Organisator-Sicht wichtigen Ablauf brechen — genau das ist am 2026-09-13 dreimal in Folge passiert
(siehe „Bekannte Vorfälle" unten).

**Pflegeregel:** Bei jeder `superpowers:brainstorming`-Session wird dieses Dokument geprüft und bei
Bedarf ergänzt/korrigiert — neue Use-Cases, geänderte Kritikalität, neue/entfernte Testabsicherung.
Diese Regel ist in `AGENTS.md` verankert.

## Kritikalitäts-Skala

| Stufe | Bedeutung | Testanforderung |
|---|---|---|
| 🔴 **Kritisch** | Bricht dieser Prozess, ist die App für ein laufendes oder bevorstehendes reales Turnier unbrauchbar. Muss vor jedem Merge auf `main` funktionieren. | Muss durch mindestens einen E2E-Test (Playwright, echter Browser) abgedeckt sein, der den vollständigen Organizer-Flow nachspielt — nicht nur die zugrundeliegende Funktion isoliert. |
| 🟡 **Wichtig** | Bricht dieser Prozess, ist die App noch nutzbar, aber der Organisator stößt auf eine echte, störende Lücke (Fehlermeldung fehlt, Feature unbedienbar, aber es gibt einen Workaround oder es betrifft nur einen Teilmodus). | Sollte E2E-getestet sein; Unit-Tests der zugrundeliegenden Logik sind das Minimum. |
| ⚪ **Nice-to-have** | Komfortfunktion, deren Ausfall niemanden am Durchführen eines Turniers hindert. | Unit-Tests genügen. |

## Kritische Prozesse (🔴)

| # | Use-Case | Kurzbeschreibung | Testabsicherung | Status |
|---|---|---|---|---|
| K1 | Turnier konfigurieren → Spielplan generieren (Jeder-gegen-Jeden) | Teams anlegen, Modus „Jeder gegen Jeden" wählen, Zeitplan generieren, Zeitplan ist vollständig und plausibel (alle Paarungen, keine Doppelbelegung von Feld/Team). | `e2e/all-tournament-variants.spec.ts` (Variante 1) | ✅ |
| K2 | Turnier konfigurieren → Spielplan generieren (Gruppenphase + Endrunde) | Wie K1, aber mit Gruppen und einer gewählten Endrunden-Variante (1/3/4). Ohne gewählte Variante darf der Button gar nicht erst aktiv sein (siehe Vorfall V2). | `e2e/all-tournament-variants.spec.ts` (Var. 2-4), `e2e/multi-group-round-robin*.spec.ts`, `e2e/endrunde-1.spec.ts`, `e2e/endrunde-3.spec.ts`, `e2e/config-validation.spec.ts` | ✅ |
| K3 | Turnier konfigurieren → Spielplan generieren (Schweizer System) | Teams anlegen, Swiss-Modus, Rundenzahl, Zeitplan generieren, jede Runde erst nach voller Auswertung der Vorrunde. | `e2e/all-tournament-variants.spec.ts` (Var. 5-6), `e2e/swiss-tournament*.spec.ts` | ✅ |
| K4 | Ergebnis erfassen und anschließende Rundenfreigabe (Swiss) | Ergebnis eintragen → nächste Runde wird erst freigegeben, wenn alle Spiele der aktuellen Runde ausgewertet sind. | `e2e/swiss-tournament.spec.ts` | ✅ |
| K5 | Ergebnis erfassen → automatische Platzhalter-Auflösung (Endrunde) | Gruppenphase-Ergebnis eintragen → `resolvePlaceholders` befüllt Halbfinale/Finale/Platz-3-Spiel automatisch mit den richtigen Teams, sobald deren Quelle (Gruppentabelle oder Vorspiel) feststeht. | `e2e/endrunde-1.spec.ts`, `e2e/endrunde-3.spec.ts` | ✅ |
| K6 | Ergebnis-Korrektur mit Neuauflösung nachgelagerter Spiele | Ein bereits eingetragenes Ergebnis wird korrigiert, während die Folgestufe noch kein eigenes Ergebnis hat → die Folgestufe wird automatisch neu befüllt (Team kann wechseln). Hat die Folgestufe bereits ein Ergebnis, bleibt sie unverändert. | `e2e/endrunde-3.spec.ts` (Korrektur-Test), `e2e/swiss-tournament.spec.ts` (Korrektur-Test) | ✅ |
| K7 | Spielplan-Generierung respektiert Hallenzeit, Sperrzeiten und Feldanzahl | Kein Spiel wird außerhalb der Hallenöffnungszeit oder innerhalb einer Sperrzeit angesetzt; alle konfigurierten Felder werden genutzt, keines wird ignoriert. Schlägt die Generierung fehl (Halle zu kurz), muss das sichtbar gemeldet werden, statt den alten Zeitplan stillschweigend stehen zu lassen (siehe Vorfall V1, V3). | `e2e/config-validation.spec.ts` | ✅ |
| K8 | Team-Rückzug während des Turniers (Swiss) | Ein Team zieht sich zurück → verbleibende Spiele werden korrekt annulliert/als Walkover gewertet, künftige Runden werden neu gemischt, das Turnier bleibt fortsetzbar. | `e2e/swiss-operational-safety.spec.ts` | ✅ |
| K9 | Daten-Export als Ergebnissicherung | Der Organisator kann das Turnier jederzeit als JSON exportieren (Datensicherung, da alles nur in `localStorage` liegt) und diese Datei wieder importieren. | Kein dedizierter E2E-Test für den Export-Klick selbst; Import ist indirekt über `multi-group-round-robin-large.spec.ts` abgedeckt. `json-import.ts` hat Unit-Tests. | 🟡 teilweise |

## Wichtige Prozesse (🟡)

| # | Use-Case | Kurzbeschreibung | Testabsicherung | Status |
|---|---|---|---|---|
| W1 | Team-Rückzug während der Gruppenphase/Endrunde (Nicht-Swiss) | Analog zu K8, aber für Gruppenphase/Platzierungsgruppen. `withdrawNonSwissTeam` deckt aktuell Gruppen-/Placement-Stages ab, **nicht** die K.-o.-Bracket-Stages (`quarterfinal`/`semifinal`/`final`/`third-place` etc.) — dort existiert aber auch keine UI, die einen Rückzug in dieser Phase überhaupt anbietet, das Risiko ist also aktuell nicht erreichbar. | Store-Unit-Tests (`tournament-store.test.ts`) | 🟡 teilweise, siehe Risiko R1 |
| W2 | Manuelle Zeitverschiebung eines einzelnen Spiels | Organisator verschiebt ein einzelnes Spiel per Uhrzeit-Editor — ohne automatische Sperrzeiten-Prüfung (bewusste manuelle Aktion, siehe Kapitel 8 der arc42-Doku). | Kein E2E-Test bekannt | ⚪ ungetestet |
| W3 | Barrierefreiheit der zentralen Seiten (WCAG 2.1 AA) | Teams-, Konfigurations-, Ergebnis- und Übersichtsseiten sind für Screenreader/Tastaturnutzung zugänglich. | `e2e/accessibility.spec.ts` (axe-core) | ✅ |
| W4 | Manuelle Bye-Zuteilung bei ungerader Teamzahl (Swiss) | Wenn die automatische Paarung erschöpft ist, kann der Organisator manuell paaren/ein Freilos vergeben. | `e2e/swiss-operational-safety.spec.ts` | ✅ |
| W5 | Import eines fremden/älteren JSON-Turniers | Ein JSON-Export (auch aus einer älteren App-Version) lässt sich wieder importieren, ohne dass die App abstürzt. | `json-import.ts` Unit-Tests, indirekt `multi-group-round-robin-large.spec.ts` | 🟡 teilweise |
| W6 | Kombinierte Endstand-Anzeige über mehrere Rangstufen (Endrunde 1) | Nach Abschluss aller Rangstufen-Brackets zeigt „Endstand" eine durchgehende 1..N-Rangliste. Bekannte Einschränkung: bei Bracket-Größen >4 werden nur die obersten 4 Plätze je Rangstufe belegt, dazwischenliegende Plätze bleiben frei (Design-Entscheidung, siehe Risiko R2). | `e2e/endrunde-1.spec.ts` | ✅ (im dokumentierten Rahmen) |

## Nice-to-have (⚪)

| # | Use-Case | Kurzbeschreibung | Testabsicherung |
|---|---|---|---|
| N1 | PDF-Export des Spielplans | Formatierter Ausdruck für Aushang in der Halle. | Kein E2E-Test bekannt |
| N2 | Web-Export (ZIP) | Statische HTML-Version des Turniers zum Weitergeben. | Kein E2E-Test bekannt |
| N3 | Team-Logos in Spielplan/Ergebnissen | Rein visuelle Aufwertung, dekorativ (`alt=""`). | Unit-Tests für die Alt-Text-Behandlung |
| N4 | Eingebautes Anleitungs-Handbuch (`/anleitung`) | Statische Hilfeseite in der App. | Kein Test (rein statischer Inhalt) |

## Bekannte Vorfälle (Beispiele, warum diese Übersicht existiert)

Alle drei am 2026-09-13 gefunden und behoben — festgehalten, weil sie zeigen, welche Art von Lücke
diese Übersicht künftig verhindern soll:

- **V1**: K7 war verletzt — das Feld-Auswahl-Dropdown im UI war hart auf 1-4 begrenzt, obwohl das
  Datenmodell beliebige Feldanzahlen erlaubt. Bei Turnieren mit vielen Gruppen aber wenigen Feldern
  wirkte das wie ein Gruppen/Feld-Zuordnungsfehler, war aber ein UI-Limit. → behoben, jetzt bis 6
  Felder wählbar, E2E-abgesichert.
- **V2**: K2 war verletzt — „Gruppenphase + Endrunde" mit mehreren Gruppen ließ sich ohne gewählte
  Endrunden-Variante generieren, was zu strukturell nie auflösbaren Platzhaltern im Halbfinale
  führte. → behoben, Generierung ist jetzt gesperrt, bis eine Variante gewählt ist.
- **V3**: K7 war verletzt — scheiterte die Spielplan-Generierung (z. B. weil eine neu hinzugefügte
  Sperrzeit die Hallenzeit sprengt), wurde der Fehler nirgends abgefangen; der Store behielt
  stillschweigend den alten, jetzt veralteten Zeitplan. Der Organisator sah keine Fehlermeldung und
  hätte einen veralteten Plan für echt gehalten. → behoben, `scheduleGenerationError` wird jetzt
  sichtbar angezeigt.

## Bekannte Risiken (siehe auch arc42 Kapitel 11)

- **R1**: `withdrawNonSwissTeam` deckt keine K.-o.-Bracket-Stages ab (siehe W1). Aktuell folgenlos,
  da keine UI einen Rückzug in dieser Phase anbietet — wird aber zu einem echten Risiko, sobald
  jemand eine solche UI ergänzt, ohne diese Lücke zu kennen.
- **R2**: `computeEndrunde1Standings` vergibt nur 4 Plätze je Rangstufe, unabhängig von der
  Bracket-Größe (bewusste Design-Entscheidung, siehe `docs/superpowers/specs/2026-09-12-endrunde-1-bracket-design.md`).
  Bei einem 8er- oder größeren Bracket bleiben Plätze in der Mitte der Rangstufe unbelegt — für einen
  Organisator, der das nicht weiß, wirkt das wie eine fehlende Funktion.

## Verweise

- Vollständige Architekturdokumentation: `docs/architecture/arc42/` (arc42-Standard, 12 Kapitel)
- Design-Spezifikationen der einzelnen Features: `docs/superpowers/specs/`
- Implementierungspläne: `docs/superpowers/plans/`
