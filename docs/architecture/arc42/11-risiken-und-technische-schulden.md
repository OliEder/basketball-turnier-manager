# 11. Risiken und technische Schulden

Ehrliche, konkrete Auflistung offener Probleme — keine Plattitüden. Jeder Punkt ist im Code oder
in den Design-Specs verifiziert; Vermutungen sind als solche gekennzeichnet.

## 11.1 Unvollständige Endrunden-Vereinheitlichung (höchste Priorität)

Der ursprüngliche Design-Spec (`docs/superpowers/specs/2026-09-12-finals-variants-design.md`)
sah vor, dass Endrunde 1, 2, 2a, 2b, 2c und 3 **eine einzige parametrisierte K.-o.-Logik** sind
(Parameter: `directQualifyRanksPerGroup`, `rankTiers`, `bracketDepth`) statt getrennter
Code-Pfade — mit einer gemeinsamen `buildQualifierPool`/`buildSeededBracket`-Pipeline.

Tatsächlich umgesetzt wurden nur Endrunde 1, 3, 4 — und zwar **nicht** als Spezialfälle eines
gemeinsamen Bausteins:

- `playoff-generator.ts` (Endrunde 3, ursprünglich für den generischen 2/4er-Fall gebaut) und
  `finals-variant-generator.ts`s `buildBracket` (Endrunde 1, generisch für 2/4/8/16/32) lösen
  strukturell dasselbe Problem (KO-Baum mit Halbfinale/Platz-3-Spiel) unabhängig voneinander.
  Im Code selbst als Duplikation markiert: `playoff-generator.ts` Zeile 44-47, Kommentar
  "duplicates the same ideas now implemented generically in finals-variant-generator.ts's
  buildBracket() ... a future cleanup could have this branch call buildBracket() instead of
  hand-rolling the same shape".
- Endrunde 2/2a/2b/2c (KO-Baum für Top-2-je-Gruppe mit gestaffelter Ausspielung weiterer Plätze)
  wurden nie gebaut.

**Konsequenz**: Jede künftige Änderung an der KO-Baum-Logik (z. B. ein Bugfix in der
Feldzeitrechnung) muss potenziell an ZWEI Stellen nachgezogen werden, nicht an einer. Der bereits
gefundene `placementFrom`-Bug (Kapitel 9, ADR-07) betraf nur `buildBracket` — ein äquivalenter
Bug in `playoff-generator.ts` wäre durch dieselbe Code-Review-Struktur nicht automatisch
mitgeprüft worden, weil beide Pfade als getrennte Features behandelt werden.

**Empfehlung** (nicht umgesetzt, nur festgehalten): vor dem Bau von Endrunde 2/2a-c die bestehende
Duplikation zwischen `playoff-generator.ts` und `finals-variant-generator.ts` auflösen, statt eine
dritte Variante der KO-Baum-Logik hinzuzufügen.

## 11.2 Zielbasierter Modus-Wizard — nur als Idee, nicht spezifiziert

Der Nutzer hat die Idee eines Wizards geäußert, der anhand der Turnierziele (z. B. "faire
Stärkesortierung ohne Verzerrung durch die initiale Gruppeneinteilung" → Swiss-Empfehlung) den
passenden Modus über Swiss/Round-Robin/Gruppenphase+Endrunde hinweg vorschlägt. Dies ist
**ausdrücklich noch nicht spezifiziert** (kein Design-Spec, kein Plan) — hier nur als bekanntes,
offenes Vorhaben dokumentiert, damit es bei einer künftigen Brainstorming-Session nicht neu
"entdeckt" werden muss.

## 11.3 `withdrawNonSwissTeam` deckt keine K.-o.-Bracket-Stages ab

Siehe Kapitel 8.6. `withdrawNonSwissTeam` filtert explizit nur `stage === 'group' || stage ===
'placement'`. Für die K.-o.-Bracket-Stages (`quarterfinal`, `semifinal`, `final`, `third-place`,
`round-of-16`, `round-of-32`) — relevant für Endrunde 1 und 3 — existiert kein
Rückzugs-Annullierungspfad.

**Aktuelles Risiko-Niveau: gering, aber latent.** Nicht erreichbar über die heutige UI, da weder
`BracketResultsPage.tsx` noch `PlayoffResultsPage.tsx` einen "Zurückziehen"-Button anbieten. Wird
zu einem echten Bug, sobald jemand eine solche UI ergänzt, ohne diese Lücke zu kennen — dann würde
ein zurückgezogenes Team in einem noch ungespielten K.-o.-Spiel weiterhin als spielberechtigt
gelten, und `resolvePlaceholders`/`matchOutcomeTeamId` würde anstandslos einen "Sieger" aus einem
Spiel mit einem zurückgezogenen Team ermitteln, sobald es (versehentlich) doch bewertet wird.

## 11.4 `dropoutHandling: 'next-best-fills-in'` ist nicht implementiert

Siehe Kapitel 8.7. Das Datenfeld und die UI-Option existieren, sind aber im UI fest deaktiviert.
Nur `'walkover'` ist tatsächlich implementiertes Verhalten. Kein aktives Risiko (die UI verhindert
aktiv, dass der nicht-funktionierende Wert überhaupt gewählt wird), aber technische Schuld: der
Store-Typ suggeriert eine Fähigkeit, die es nicht gibt.

## 11.5 `computeEndrunde1Standings` vergibt nur 4 Plätze je Rangstufe

Siehe `docs/use-cases-und-kritikalitaet.md`, Risiko R2. Bei einem 8er-, 16er- oder 32er-Bracket
werden nur Platz 1-4 (bzw. deren Offset via `placementFrom`) belegt — Verlierer aus früheren
Runden (Viertelfinale, Achtelfinale) bekommen keinen individuellen Endstand-Platz. Dies ist eine
bewusste, im Design-Spec dokumentierte Scope-Reduktion, aber ein Organisator, der ein größeres
Bracket konfiguriert, könnte den fehlenden Rest der Rangliste als Bug missverstehen, ohne diese
Doku gelesen zu haben.

## 11.6 `computeGroupPhaseBuchholz` ist toter Code (bewusst)

`finals-variant-generator.ts` exportiert `computeGroupPhaseBuchholz`, das von KEINEM Aufrufer im
gesamten `src/`-Baum genutzt wird (verifiziert per Suche). Laut Kommentar/Spec bewusst für eine
spätere Nachrücker-/Wildcard-Erweiterung vorgehalten, nicht versehentlich unbenutzt. Risiko: ohne
diese Doku könnte ein künftiges Aufräumen ("ungenutzten Code entfernen") diese Funktion fälschlich
löschen.

## 11.7 Keine Lint-Konfiguration

Siehe Kapitel 9, ADR-09. Weder ESLint noch ein äquivalenter Lint-Job existieren. Nicht explizit als
Entscheidung dokumentiert — TypeScript-Strict-Mode und die Test-Coverage-Schwelle übernehmen
teilweise dieselbe Funktion: `tsconfig.json` hat `strict: true`, `noUnusedLocals: true` und
`noUnusedParameters: true` aktiv (verifiziert), was einen Teil dessen abdeckt, was sonst ein
Linter prüfen würde (dieser Constraint hat während der aktuellen Session bereits mehrfach dazu
geführt, dass ein Implementierungsagent einen ungenutzten Parameter mit `_`-Präfix korrigieren
musste). Stil-/Best-Practice-Verstöße (z. B. inkonsistente Formatierung, keine Prettier-Konfiguration
gefunden) werden dennoch nirgends automatisiert geprüft.

## 11.8 Barrierefreiheits-Abdeckung ist kuratiert, nicht vollständig

`e2e/accessibility.spec.ts` prüft 8 explizit ausgewählte Seiten-/Zustandskombinationen (Kapitel
8.10, 10.2 QS-4). Seiten wie `BracketResultsPage`, `FinalsResultsPage`, `FinalStandingsPage`,
`ExportPage` sind **nicht** in dieser Liste — kein Beleg, dass sie WCAG-Verstöße haben, aber auch
kein automatisierter Nachweis, dass sie keine haben.

## 11.9 `localStorage` als einziger Datenspeicher — kein Multi-Geräte-/Multi-Browser-Betrieb

Kein Bug, sondern eine dokumentierte Grenze (Kapitel 1.4, ADR-01): Löscht der Browser
`localStorage` (privater Modus, manuelles Leeren, ein anderes Gerät), ist der Turnierstand ohne
vorherigen JSON-Export vollständig verloren. Kein automatisches Backup außer dem expliziten
Reset-Backup (Kapitel 1, Qualitätsziel 6) — ein Datenverlust durch z. B. versehentliches Leeren
der Browserdaten MITTEN im Turnier ist nicht abgefangen.

## 11.10 Deferred: externe Vereinsregister-Datenquelle

Ein ~4 MB großer externer Datensatz deutscher Basketballvereine
(`basketball-vereinsregister-deutschland/data/clubs.json`) wurde als mögliche künftige
Datenquelle für Team-Autovervollständigung identifiziert, aber bewusst zurückgestellt (siehe
Memory `vereinsregister_clubs_dataset`). Kein Code-Risiko, nur ein offener Vorschlag.

## 11.11 Vision: Team/Zuschauer als aktiverer Akteur (Live-Ansichten auf Zweitgeräten)

Aktuell ist Team/Zuschauer ein rein passiver Akteur (siehe
`docs/use-cases-und-kritikalitaet.md`, Akteur-Diagramm) — Konsum ausschließlich über Ausdrucke
oder den statischen Web-Export, ohne Live-Bezug zum tatsächlichen Turnierstand im Organisator-Gerät.

**Geäußerte, aber noch nicht spezifizierte Vision:** mehrere Monitore in der Halle sollen künftig
live unterschiedliche Ansichten zeigen können — z. B. ein Bildschirm die Gruppentabellen, ein
anderer den Gesamtzeitplan, jeweils automatisch aktuell.

**Architektur-Implikation, falls umgesetzt:** Dies würde direkt mit ADR-01 (kein Server-Backend)
und der `localStorage`-Beschränkung (Kapitel 3.2, Risiko 11.9) kollidieren — ohne irgendeine Form
von Synchronisation zwischen Geräten (sei es ein minimaler lokaler Server, `BroadcastChannel`
innerhalb desselben Browsers/derselben Geräte-Instanz, oder ein echter Netzwerkdienst) kann ein
zweites Gerät den Live-Zeitplan nicht anzeigen. Explizit nur als bekanntes künftiges Vorhaben
festgehalten, kein Design/Plan vorhanden — nicht zu verwechseln mit dem bereits existierenden,
rein lokalen Web-Export (UC6 in `docs/use-cases-und-kritikalitaet.md`), der einen statischen,
nicht-live-aktualisierten Schnappschuss erzeugt.

## 11.12 Vision: Kampfgericht als neuer, aktiv interagierender Akteur

**Geäußerte, aber noch nicht spezifizierte Vision:** Das Kampfgericht (Schiedsgericht am
Spielfeld) soll künftig Spielergebnisse direkt an den Turnier-Manager übermitteln können, statt
dass der Organisator sie manuell nacherfasst (aktuell UC2 in
`docs/use-cases-und-kritikalitaet.md`, ausschließlich vom Organisator ausgeführt).

**Architektur-Implikation, falls umgesetzt:** Anders als die Zuschauer-Vision (Kapitel 11.11, rein
lesend) wäre dies ein AKTIV schreibender dritter Akteur mit eigenem, eingeschränktem
Schreibzugriff (nur Ergebniseingabe für ein zugewiesenes Spiel, keine Konfigurationsrechte). Das
stellt die aktuelle, im gesamten Datenmodell und Store fest verankerte Grundannahme "genau ein
aktiver Nutzer pro Gerät/Browser, kein Rollen-/Rechtekonzept" (siehe Kapitel 1.4, 3.1) grundlegend
infrage — `tournament-store.ts` hat aktuell keinerlei Konzept von "wer" eine Aktion ausführt, nur
"was" geändert wurde. Wie bei Kapitel 11.11 wäre auch hierfür zwingend irgendeine Form von
Geräte-übergreifender Kommunikation nötig, die es heute nicht gibt (Kapitel 3.2, ADR-01). Explizit
nur als bekanntes künftiges Vorhaben festgehalten, kein Design/Plan, keine Priorisierung gegenüber
Kapitel 11.11 oder dem zielbasierten Wizard (Kapitel 11.2) vorgenommen.
