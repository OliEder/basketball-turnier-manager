# Design: Turnier zurücksetzen

## Problem

Es gibt aktuell keinen direkten Weg, ein Turnier komplett zurückzusetzen, um ein neues zu beginnen — nur den Umweg über den JSON-Import mit einer leeren/anderen Datei. Ein expliziter "Reset"-Button auf der Konfigurationsseite deckt diesen Anwendungsfall direkt ab.

## Ort

Neuer Abschnitt "Turnier zurücksetzen" auf `ConfigPage.tsx`, direkt nach dem bestehenden "Turnier importieren"-Abschnitt (beide Aktionen ersetzen/löschen den aktuellen Turnierstand, gehören inhaltlich zusammen).

## Ablauf

1. Button "Turnier zurücksetzen" öffnet den bestehenden `DestructiveConfirmDialog` — unabhängig vom Sperr-Zustand (`isTournamentLocked()`), IMMER mit Bestätigung, da ein Reset per Definition immer eine vollständige, unwiderrufliche Löschung ist (anders als die bereits bestehenden Sperr-Fälle, die nur greifen, wenn das Turnier bereits läuft).
2. Bestätigungswort: **„LÖSCHEN"** (nicht „ÄNDERN" wie bei den anderen Dialogen — semantisch passender, da hier nichts geändert, sondern alles entfernt wird).
3. Beschreibungstext macht klar: das aktuelle Turnier wird vollständig gelöscht, vorher wird automatisch eine JSON-Sicherungsdatei heruntergeladen.
4. Nach Bestätigung (Klick auf „Bestätigen", erst nach korrektem „LÖSCHEN"):
   a. Automatischer JSON-Download des AKTUELLEN Turnierstands (`downloadJson(tournament, schedule)`, bereits vorhandene Funktion) — passiert IMMER, unabhängig davon ob das Turnier bereits Teams/Ergebnisse enthält (einfache, immer gleiche Regel, kein Sonderfall für "leeres Turnier").
   b. Danach vollständiger Reset: `localStorage` leeren (`clearAll()`, bereits vorhanden) und der Store auf den Ausgangszustand zurückgesetzt (`DEFAULT_TOURNAMENT` plus `schedule: null` — analog zum bereits bestehenden Store-Initialisierungsmuster).
5. Nach dem Reset landet der Nutzer sinnvollerweise wieder auf der Teams-Seite (frischer Start, analog zum Grundzustand der App) — kurze Erfolgsmeldung reicht aus, kein Muss für eine Weiterleitung, aber sinnvoll (siehe Umsetzungsdetail).

## Neue Store-Action

`resetTournament(): void` in `tournament-store.ts` — kombiniert `clearAll()` (Storage) mit `set({ tournament: { ...DEFAULT_TOURNAMENT, id: uuidv4() }, schedule: null })` (frische Turnier-ID, damit kein alter Zustand über die ID referenzierbar bleibt). Der JSON-Download selbst passiert NICHT innerhalb dieser Store-Action (reine Zustandsverwaltung), sondern im aufrufenden UI-Code auf `ConfigPage.tsx`, direkt vor dem `resetTournament()`-Aufruf — Trennung von Persistenz-Logik und Datei-Download-Nebeneffekt, konsistent mit dem bestehenden Muster (`downloadJson` wird bereits ausschließlich aus UI-Code heraus aufgerufen, nie aus dem Store).

## Nicht Teil dieser Änderung

Keine Bestätigungs-Mail, kein Cloud-Backup — nur der bereits etablierte lokale JSON-Download-Mechanismus.
