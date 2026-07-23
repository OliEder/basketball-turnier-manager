# Turniermanager — Finalrunde im Zeitplan-Generator

**Datum:** 2026-07-23
**Turnier:** Fibalon U11-Summer Cup
**Scope:** `mode: "round-robin+finals"` im Zeitplan-Generator implementieren (vorher nur im Typsystem/UI angelegt, aber nie generiert)

---

## Überblick

Der Turniermodus `"round-robin+finals"` existiert bereits als Auswahl im Konfigurationsformular (`TournamentForm.tsx`) und im Typsystem, aber `generateSchedule()` erzeugt bisher ausschließlich die Vorrunde (Jeder-gegen-Jeden) — der Modus hat keine Auswirkung auf den generierten Zeitplan.

Zusätzlich wurde bereits (unvollständig) an den Typen gearbeitet, um Playoff-Slots abzubilden: `Game.stage`, nullable `homeTeamId`/`awayTeamId` mit `homeLabel`/`awayLabel`-Platzhaltern, `GameSettings.breakBeforeFinalsMin` und `Schedule.awardCeremonyEstimate`. Diese Typänderungen haben den Build kaputt gemacht (Exporte und Tests passen nicht mehr), ohne dass die eigentliche Generierungslogik nachgezogen wurde.

Es gibt in der Codebase noch keine Tabellen-/Standings-Logik (Ergebnisse werden noch nirgends erfasst oder ausgewertet). Diese Spec behandelt daher ausschließlich die **Zeitplan-Erzeugung** für die Finalrunde (Zeitslots, Felder, Platzhalter-Labels) — nicht die spätere Auflösung, welches Team tatsächlich im Halbfinale/Finale steht. Das ist bewusst außerhalb des Scopes.

---

## Datenmodell-Ergänzungen

### TournamentConfig

```typescript
{
  // ... bestehende Felder
  mode: "round-robin" | "round-robin+finals";
  finalsBracketSize?: 2 | 4;  // nur relevant wenn mode === "round-robin+finals"
                              // 4 = Halbfinale + Finale, 2 = nur Finale
                              // Default beim Umschalten auf "round-robin+finals": 4
}
```

### GameSettings

```typescript
{
  // ... bestehende Felder (inkl. bereits vorhandenem breakBeforeFinalsMin)
  breakBeforeFinalsMin: number;  // Pause NUR vor dem eigentlichen Finale (nicht vor dem Halbfinale)
  awardCeremonyMin: number;      // NEU — Dauer der Siegerehrung nach Spielende des Finales, Default 15
}
```

Alle übrigen bereits vorhandenen Typänderungen (`GameStage`, nullable Team-IDs, Labels, `awardCeremonyEstimate`) bleiben wie im aktuellen Diff und werden nicht weiter verändert.

---

## Ablauf der Generierung

### 1. Vorrunde (unverändert)

`schedule-generator.ts` erzeugt die Vorrunde exakt wie bisher (Round-Robin über alle Teams, Feld-Zuteilung nach frühester Verfügbarkeit). Jedes erzeugte Spiel bekommt zusätzlich `stage: "group"`.

### 2. Playoff-Runde (neu, `src/lib/playoff-generator.ts`)

Nur wenn `config.mode === "round-robin+finals"`. Wird von `generateSchedule()` nach der Vorrunden-Schleife aufgerufen mit: Turnierkonfiguration, aktuellem Feld-Uhren-Stand (`fieldNextFree`), Venue-Infos (Blackouts, `availabilityEnd`) und der nächsten `gameNumber`.

**Validierung:** Wirft einen `Error`, wenn `teams.length < finalsBracketSize` (z.B. `"Mindestens 4 Teams für Halbfinale benötigt"`). Kein stiller Fallback.

**Halbfinale** (nur bei `finalsBracketSize === 4`):
- SF1: `"1. der Vorrunde"` vs. `"4. der Vorrunde"`, SF2: `"2. der Vorrunde"` vs. `"3. der Vorrunde"`.
- Laufen **parallel**: beide starten zur gleichen Zeit = `max(fieldNextFree[0], fieldNextFree[1])`, auf Feld 1 und Feld 2.
- Ausnahme bei nur 1 konfiguriertem Feld: SF2 läuft sequentiell nach SF1 (+ `bufferBetweenGamesMin`), beide auf Feld 1.
- `stage: "semifinal"`, `round: 2`.
- Kein Team-Konflikt-Check nötig (Teams sind noch nicht real zugeordnet, `homeTeamId`/`awayTeamId` = `null`).
- Start-/Endzeiten respektieren weiterhin Blackout-Perioden und Venue-Schließzeit über die bestehende `findNextSlot`-Logik.

**Finale:**
- Immer auf Feld 1.
- Startzeit = `addMinutes(max(alle fieldNextFree nach Vorrunde/Halbfinale), breakBeforeFinalsMin)`, ebenfalls durch `findNextSlot` geprüft.
- Bei `finalsBracketSize === 4`: Labels `"Sieger HF 1"` vs. `"Sieger HF 2"`, `round: 3`.
- Bei `finalsBracketSize === 2`: Labels `"1. der Vorrunde"` vs. `"2. der Vorrunde"` direkt (kein Halbfinale), `round: 2`.
- `stage: "final"`.
- `homeTeamId`/`awayTeamId` = `null` in allen Playoff-Spielen.

### 3. Award-Ceremony-Schätzung

`schedule-generator.ts` setzt nach der Generierung:
```typescript
schedule.awardCeremonyEstimate = addMinutes(finalGame.scheduledEnd, gameSettings.awardCeremonyMin)
```
Nur gesetzt, wenn ein Finale generiert wurde (d.h. immer bei `mode === "round-robin+finals"`, unabhängig von der Bracket-Größe).

---

## Store & UI-Ergänzung

Damit `finalsBracketSize` überhaupt auf `2` gesetzt werden kann (sonst bliebe der Default `4` immer erzwungen):

- **`tournament-store.ts`:** `setMode` setzt beim Wechsel zu `"round-robin+finals"` `finalsBracketSize: 4` als Default (falls noch nicht gesetzt). Neue Action `setFinalsBracketSize(size: 2 | 4)`.
- **`TournamentForm.tsx`:** Zusätzliches Select (analog zum Modus-Select), das nur sichtbar ist, wenn `tournament.mode === "round-robin+finals"` — Optionen "Halbfinale + Finale" (4) / "Nur Finale" (2).

---

## Fixes an bestehenden, aktuell kaputten Stellen

Der Build ist aktuell rot durch die bereits vorgenommenen Typänderungen. Diese Fixes sind rein mechanisch (stellen den Stand vor der Typänderung wieder her, keine Verhaltensänderung im `"round-robin"`-Modus):

- **`html-export.ts` / `pdf-export.ts`:** Team-Namen-Lookup muss nullable IDs behandeln:
  ```typescript
  const home = g.homeTeamId
    ? escapeHtml(teamMap.get(g.homeTeamId)?.name ?? '?')
    : escapeHtml(g.homeLabel ?? '?')
  ```
  (analog für `away`).
- **`GameRow.tsx`** (Zeitplan-Ansicht): kompiliert zwar noch, würde aber für Playoff-Spiele `"?" vs "?"` statt der Labels anzeigen. Gleiches Fallback-Muster: `game.homeTeamId ? home?.name ?? '?' : game.homeLabel ?? '?'` (analog für away). Ohne diesen Fix wären die neuen Labels in der UI unsichtbar, daher Teil dieses Scopes statt eines späteren Folge-Fixes.
- **Test-Fixtures** (`schedule-generator.test.ts`, `game-duration.test.ts`, `storage.test.ts`, `types/index.test.ts`): `breakBeforeFinalsMin` und `awardCeremonyMin` zu `GameSettings`-Fixtures ergänzen, `stage: "group"` zu `Game`-Fixtures ergänzen.
- **`schedule-generator.ts`:** Vorrunden-Spiele bekommen `stage: "group"` beim Erzeugen.

---

## Testplan

Neue Datei `src/lib/playoff-generator.test.ts`:
- Bracket-Größe 4 mit 2 Feldern → Halbfinals starten parallel (gleiche Startzeit, unterschiedliche Felder).
- Bracket-Größe 4 mit 1 Feld → Halbfinals sequentiell auf Feld 1.
- Bracket-Größe 2 → nur Finale, korrekte Labels.
- Zu wenige Teams → wirft Error mit verständlicher Meldung.
- Label-Korrektheit für alle Fälle.
- `breakBeforeFinalsMin` wirkt nur vor dem Finale, nicht vor dem Halbfinale.
- `awardCeremonyEstimate`-Berechnung.

Erweiterung `schedule-generator.test.ts`: Integrationstest für `mode: "round-robin+finals"` end-to-end.

---

## Out of Scope

- Ermittlung der tatsächlichen Platzierung nach der Vorrunde (Tabellen-/Standings-Logik) und automatisches Auflösen der Platzhalter-Labels zu echten Team-IDs — eigenes zukünftiges Feature.
- Spiel mit drittem Platz (bewusst nicht Teil dieses Designs).
