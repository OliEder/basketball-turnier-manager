# 6. Laufzeitsicht

## 6.1 Szenario: Turnier konfigurieren → Zeitplan generieren

```mermaid
sequenceDiagram
    actor O as Organisator
    participant UI as ConfigPage
    participant Store as tournament-store
    participant Gen as schedule-generator

    O->>UI: Modus, Felder, Gruppen,\nEndrunden-Variante, Halle wählen
    UI->>Store: setMode / setFields / setGroupCount /\nsetFinalsVariant / updateVenue (je Eingabe)
    Store->>Store: localStorage sofort aktualisieren
    O->>UI: Klick "Zeitplan generieren"
    UI->>Store: generateAndSaveSchedule()
    Store->>Gen: generateSchedule(tournament)
    alt Hallenzeit reicht aus
        Gen-->>Store: Schedule (inkl. noch offener\nEndrunden-Platzhalter)
        Store->>Store: schedule setzen,\nscheduleGenerationError = null,\nin localStorage speichern
        Store-->>UI: neuer Zeitplan sichtbar
    else Hallenzeit reicht NICHT aus
        Gen-->>Store: throw Error("Kein Zeitfenster ...")
        Store->>Store: scheduleGenerationError setzen,\nALTER schedule bleibt unverändert
        Store-->>UI: Fehler-Alert sichtbar,\nletzter funktionierender Zeitplan bleibt erhalten
    end
```

Wichtig: Bei mehreren Gruppen (`groupCount > 1`) blockiert `ConfigPage` den Button bereits VORHER,
wenn keine `finalsVariant` gewählt ist (`needsFinalsVariant`-Prüfung) — das verhindert, dass
überhaupt ein Zeitplan mit nie auflösbaren Endrunden-Platzhaltern entstehen kann (siehe Kapitel 8).

## 6.2 Szenario: Ergebnis eintragen → automatische Platzhalter-Auflösung

Beispiel Endrunde 3 (ein KO-Baum: Halbfinale → Finale/Platz-3), analog für Endrunde 1 (mehrere
parallele Bäume) und Endrunde 4 (Platzierungsgruppen als Kohorten statt Baum-Zeiger).

```mermaid
sequenceDiagram
    actor O as Organisator
    participant UI as GroupResultsPage
    participant Store as tournament-store
    participant Resolve as resolvePlaceholders

    O->>UI: letztes Ergebnis der Gruppe A einträgt
    UI->>Store: submitGameResult(gameId, periodScores)
    Store->>Store: periodScores auf das Spiel schreiben
    Store->>Resolve: resolvePlaceholders(alleSpiele, teams)
    Resolve->>Resolve: prüfen: ist Gruppe A jetzt vollständig ausgewertet?
    Resolve->>Resolve: ja → computeGroupStandings(Gruppe A)\nRang 1 = Sieger, Rang 4 = Letzter
    Resolve->>Resolve: Halbfinale-Spiel mit homeSourceRank\n{groupId: "A", rank: 1} → homeTeamId setzen
    Resolve-->>Store: aktualisierte Spieleliste
    Store->>Store: schedule speichern (Store + localStorage)
    Store-->>UI: Halbfinale zeigt jetzt echten\nTeamnamen statt "1. der Vorrunde"
```

Bei einer **Korrektur** eines bereits erfassten Ergebnisses (`correctGameResult`) läuft exakt
derselbe `resolvePlaceholders`-Durchlauf erneut — ein Folgespiel wird dabei nur überschrieben, wenn
es selbst noch KEIN eigenes Ergebnis hat (`g.periodScores.length > 0` blockiert die Neubefüllung).
Ein bereits gespieltes Halbfinale wird also nie rückwirkend durch eine spätere
Gruppenphase-Korrektur "repariert" — das ist eine bewusste Grenze, kein Bug (siehe Kapitel 8).

## 6.3 Szenario: Fehlgeschlagene Zeitplan-Regenerierung (Bugfix-Beispiel)

Dieses Szenario dokumentiert einen tatsächlich aufgetretenen und behobenen Fehler, weil er die
Bedeutung von "Fehler sichtbar machen statt schweigend verwerfen" als Architekturprinzip greifbar
macht (siehe Qualitätsziel 6 in Kapitel 1).

**Vorher (Fehlerbild):** Ein Organisator fügt nachträglich eine Mittagspause (Sperrzeit) hinzu und
klickt erneut auf "Zeitplan generieren". Die Hallenzeit reicht dadurch nicht mehr für die
Endrunde. `generateSchedule` wirft eine Exception. Diese wurde nirgends abgefangen — der
`set({ schedule })`-Aufruf im Store wurde nie erreicht. Ergebnis: Der Organisator sieht weiterhin
den ALTEN Zeitplan (ohne die neue Sperrzeit berücksichtigt) und hält ihn fälschlich für aktuell und
korrekt.

**Nachher (Fix):**

```mermaid
sequenceDiagram
    actor O as Organisator
    participant UI as ConfigPage
    participant Store as tournament-store
    participant Gen as schedule-generator

    O->>UI: Sperrzeit hinzufügen,\ndie den letzten freien Slot belegt
    O->>UI: Klick "Zeitplan generieren"
    UI->>Store: generateAndSaveSchedule()
    Store->>Gen: generateSchedule(tournament)
    Gen-->>Store: throw Error("Kein Zeitfenster für die\nEndrunde verfügbar — Hallenzeit\nreicht nicht aus")
    Store->>Store: catch: scheduleGenerationError = Fehlertext\nschedule bleibt unverändert (alter Stand)
    Store-->>UI: Alert: "Zeitplan konnte nicht neu generiert\nwerden: ... — der zuletzt erfolgreich\ngenerierte Zeitplan bleibt bestehen."
    Note over O,UI: Organisator weiß jetzt zweifelsfrei:\nseine Änderung wurde NICHT übernommen.
```

Diese Verhaltensänderung liegt in `generateAndSaveSchedule` (`tournament-store.ts`): ein
`try/catch` um den `generateSchedule`-Aufruf, das bei Fehlschlag `scheduleGenerationError` statt
`schedule` setzt. `ConfigPage.tsx` zeigt diesen Zustand als eigenen `Alert` unterhalb des
"Zeitplan generieren"-Buttons an.
