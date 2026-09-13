# 1. Einführung und Ziele

## 1.1 Aufgabenstellung

Der **Basketball Turnier-Manager** ist eine Single-Page-Application, mit der ein Turnier-Organisator
ein Basketballturnier vollständig ohne Server und ohne Internetverbindung während des laufenden
Betriebs planen, terminieren, durchführen und dokumentieren kann:

- Teams erfassen (Name, Kürzel, Logo-URL, Farbe, Kontakt, Spieler).
- Einen von drei Turniermodi wählen: Jeder-gegen-Jeden, Gruppenphase mit anschließender Endrunde,
  oder Einstufungsturnier im Schweizer System.
- Einen vollständigen Zeitplan generieren lassen — unter Berücksichtigung von Feldanzahl,
  Spieldauer, Pausen, Hallenöffnungszeiten und Sperrzeiten (z. B. Mittagspause).
- Ergebnisse laufend erfassen und nachträglich korrigieren.
- Bei mehrstufigen Formaten (Gruppenphase + Endrunde) automatisch aus Gruppenergebnissen die
  richtigen Teams in Halbfinale/Viertelfinale/Platzierungsgruppen einsetzen zu lassen.
- Ein Turnier als PDF, druckbare Webseite oder JSON exportieren bzw. aus JSON wieder importieren.
- Ein Team während des Turniers zurückziehen, ohne den Zeitplan von Hand reparieren zu müssen.

Die App wird typischerweise am Spieltag selbst auf einem Laptop in der Halle genutzt — daher ist
die vollständige Offline-Fähigkeit (kein Server, kein Backend, alle Daten in `localStorage` des
Browsers) eine harte Anforderung, kein Implementierungsdetail.

## 1.2 Qualitätsziele

Sortiert nach Priorität, so wie sie sich aus dem Code, den Tests und der Entwicklungshistorie
(`docs/superpowers/specs/`) ablesen lassen:

| # | Qualitätsziel | Begründung / Beleg |
|---|---|---|
| 1 | **Offline-Fähigkeit ohne Server** | Kein Backend im gesamten Projekt; `src/lib/storage.ts` schreibt ausschließlich in `localStorage`. Ursprüngliche Anforderung laut `docs/superpowers/specs/2026-06-23-planer-phase1-design.md`: "Der Planer läuft lokal im Browser". |
| 2 | **Korrektheit der Zeitplan-Generierung unter harten Nebenbedingungen** | Feldanzahl, Hallenzeiten, Sperrzeiten und Pausenregeln dürfen nie verletzt werden — mehrere Bugfix-Specs (`round-robin-field-utilization-design.md`) und die aktuell laufende Session (Sperrzeiten-Bug, Feldanzahl-Bug) drehen sich genau darum. Sichergestellt durch `findNextSlot`/`overlapsBlackout` (siehe Kapitel 5, 8) und eine breite Generator-Testsuite. |
| 3 | **Nachvollziehbare, automatische Team-Auflösung in mehrstufigen Formaten** | `resolvePlaceholders` muss nach jedem Ergebnis (inkl. Korrekturen) zuverlässig die richtigen Teams in Folgespiele eintragen — Kernstück von drei der vier Endrunden-Varianten. |
| 4 | **Barrierefreiheit (WCAG 2.1 AA)** | Eigene E2E-Testsuite (`e2e/accessibility.spec.ts`) mit `@axe-core/playwright`, geprüft auf allen kritischen Seiten/Zuständen. |
| 5 | **Testbarkeit / Regressionssicherheit** | 80 %-Branch-Coverage-Schwelle pro Datei (nicht nur im Aggregat) für `src/lib/**` und `src/store/**`; E2E-first-Grundsatz für jeden neuen kritischen Prozess (siehe Kapitel 2). |
| 6 | **Datensicherheit vor destruktiven Aktionen** | Turnier-Reset lädt automatisch ein JSON-Backup herunter, bevor gelöscht wird (`docs/superpowers/specs/2026-09-11-tournament-reset-design.md`); ein fehlgeschlagener Zeitplan-Neugenerierungsversuch verwirft nie den zuletzt funktionierenden Zeitplan (`scheduleGenerationError`, siehe Kapitel 6). |

## 1.3 Stakeholder

| Rolle | Erwartungshaltung |
|---|---|
| **Turnier-Organisator** (Hauptnutzer) | Möchte mit möglichst wenig manuellem Aufwand einen belastbaren Zeitplan bekommen und während des Turniertags schnell Ergebnisse eintragen können, auch unter Zeitdruck und ohne Internetverbindung in der Halle. |
| **Team-Betreuer / Zuschauer** | Konsumieren den (ggf. ausgedruckten oder als Webseite exportierten) Zeitplan und die Tabellen — keine eigene Interaktion mit der App. |
| **Entwickler (aktuell: eine Einzelperson + Claude Code als Pair-Programming-Partner)** | Möchte über Sessions hinweg nachvollziehen können, welche Entscheidungen warum getroffen wurden (Motivation dieser arc42-Dokumentation), und verlässlich per TDD/E2E-first weiterentwickeln können. |

## 1.4 Nicht-Ziele (bewusst außerhalb des Scopes)

Aus den Design-Dokumenten wiederholt explizit ausgeschlossen:

- Mehrere Turniere parallel verwalten (`localStorage` hält genau einen Turnierstand).
- Mehrtägige Turniere (mehrere Hallentage) — bislang nur als Kapazitäts-*Warnung*, nicht als
  eigenständiges Feature umgesetzt.
- Ein Server-/Live-Betrieb-Backend ("Phase 2" laut `2026-06-23-planer-phase1-design.md`, nie begonnen).
- Internationalisierung — die App ist konsequent auf Deutsch, ohne i18n-Abstraktion (siehe Kapitel 8).
