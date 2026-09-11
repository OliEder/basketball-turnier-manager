# Design: JSON-Import auf der Konfigurationsseite

## Problem

Der bestehende JSON-Export (`src/lib/export/json-export.ts`, `downloadJson`) exportiert `{ tournament, schedule, exportedAt }` als Datei. Es gibt aktuell keinen Weg, eine solche Datei wieder einzulesen — nützlich für: ein Turnier auf einem anderen Gerät/Browser fortsetzen, ein Backup wiederherstellen, oder (wie in dieser Session geschehen) einen exportierten Turnierstand zur Fehleranalyse bereitstellen.

**Nicht Teil dieser Änderung**: Mehrfach-Turnier-Verwaltung (mehrere Turniere parallel speichern/auswählen). Das Datenmodell speichert aktuell genau ein Turnier unter einem festen `localStorage`-Schlüssel (`src/lib/storage.ts`) — ein Import ersetzt dieses eine Turnier vollständig. Mehrfach-Verwaltung ist ein separates, größeres Feature für später.

## Ort

Der Import wird auf der Konfigurationsseite (`ConfigPage.tsx`) angeboten, als neuer Abschnitt "Turnier importieren" — thematisch näher an "Turnier einrichten" als am Export (`ExportPanel.tsx`, der den Export weiterhin unverändert behält).

## Ablauf

1. Datei-Auswahl-Button ("JSON importieren") öffnet den nativen Datei-Dialog (`<input type="file" accept=".json">`), keine Drag&Drop-Anforderung.
2. Datei wird gelesen und geparst. Bei ungültigem JSON oder fehlenden Pflichtfeldern (`tournament.id`, `tournament.name`, `tournament.teams` als Array, etc. — Validierung gegen die bestehenden `TournamentConfig`/`Schedule`-Typen) wird eine klare Fehlermeldung gezeigt, es wird NICHTS überschrieben.
3. **Konfliktbehandlung**: Existiert bereits ein Turnier mit Ergebnissen (`isTournamentLocked()` true — bereits vorhandener Store-Selector, wiederverwendet), läuft der Import durch den bestehenden `DestructiveConfirmDialog` (Texteingabe-Bestätigung "ÄNDERN"), analog zum bereits vorhandenen "Zeitplan neu generieren"-Fall. Existiert noch kein gesperrtes Turnier (leer oder nur Vorbereitungsphase ohne Ergebnisse), wird direkt importiert ohne zusätzliche Bestätigung — konsistent mit der bestehenden Logik in `ConfigPage.tsx`.
4. Nach erfolgreichem Import: `tournament` und `schedule` im Store werden vollständig durch den Dateiinhalt ersetzt (inklusive `saveTournament`/`saveSchedule` in `localStorage`, damit der Zustand nach einem Reload erhalten bleibt), Erfolgsmeldung angezeigt.

## Store-Erweiterung

Neue Store-Action `importTournament(tournament: TournamentConfig, schedule: Schedule | null): void` in `tournament-store.ts` — ersetzt `tournament`/`schedule` komplett und persistiert beides, analog zum bestehenden Muster anderer Actions (`set({...}); saveTournament(...); saveSchedule(...)`).

## Validierung

Eine leichtgewichtige Runtime-Validierungsfunktion (kein volles Schema-Validierungsframework nötig für den Projektumfang) prüft die Kernstruktur, bevor `importTournament` aufgerufen wird: `tournament` ist ein Objekt mit `id`/`name`/`mode`/`teams` (Array), `schedule` ist entweder `null` oder ein Objekt mit `games` (Array). Bei fehlender/falscher Struktur: Fehlermeldung, kein Import.
