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
