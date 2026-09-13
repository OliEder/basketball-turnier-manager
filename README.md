# Basketball Turnier-Manager

Eine Web-App zur Planung und Durchführung von Basketball-Turnieren: Teams verwalten, Spielplan
generieren, Ergebnisse erfassen und Endstände berechnen — komplett offline im Browser, ohne
Server oder Anmeldung.

Alle Daten werden ausschließlich lokal im Browser (`localStorage`) gespeichert. Es gibt kein
Backend und keine Datenübertragung an Dritte.

## Funktionen

- **Turniermodi:** Jeder-gegen-Jeden, Gruppenphase mit Endrunde, Schweizer System
- **Endrunden-Varianten:**
  - *Endrunde 1* — K.-o.-Runden je Rangstufe (alle Gruppenersten, -zweiten, ... spielen eigene
    K.-o.-Bäume), für 2, 4, 8, 16 oder 32 Gruppen
  - *Endrunde 3* — Halbfinale, Finale, Spiel um Platz 3 (bei genau 4 Gruppen)
  - *Endrunde 4* — Platzierungsgruppen (jeder gegen jeden je Rangstufe)
- Automatische Spielplan-Erstellung mit mehreren Feldern, Pausenregeln und Hallenzeiten
- Ergebniserfassung inkl. nachträglicher Korrektur
- Rückzug/Abmeldung einzelner Teams während des Turniers (Swiss- und Nicht-Swiss-Modi)
- Import/Export von Turnierdaten als JSON
- Eingebautes Anleitungs-Handbuch (`/anleitung`) direkt in der App
- Barrierefreiheit nach WCAG 2.1 AA (automatisiert per axe-core getestet)

## Tech-Stack

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/)
- [Zustand](https://github.com/pmndrs/zustand) für State Management
- [React Router](https://reactrouter.com/) für Navigation
- [Tailwind CSS](https://tailwindcss.com/) für Styling
- [Vitest](https://vitest.dev/) für Unit-Tests, [Playwright](https://playwright.dev/) für
  End-to-End-Tests

## Loslegen

```bash
npm install
npm run dev
```

Die App läuft dann unter `http://localhost:5173`.

### Weitere Skripte

```bash
npm run build         # Produktions-Build
npm run preview        # Produktions-Build lokal ansehen
npm run test           # Unit-Tests (Vitest)
npm run test:coverage  # Unit-Tests mit Coverage-Report
npm run test:e2e       # End-to-End-Tests (Playwright)
npm run typecheck      # TypeScript-Typprüfung ohne Build
```

## Mitwirken

Issues und Pull Requests sind willkommen. Für größere Änderungen bitte vorher ein Issue öffnen,
um das Vorhaben kurz abzustimmen.

## Lizenz

Dieses Projekt steht unter der [MIT-Lizenz](LICENSE) — freie Nutzung, Veränderung und
Weiterverbreitung, auch kommerziell, unter Erhalt des Copyright-Hinweises.

Der Urheber ist alleiniger Rechteinhaber und behält sich vor, zukünftige Versionen unter einer
anderen Lizenz zu veröffentlichen. Bereits veröffentlichte Versionen bleiben davon unberührt und
weiterhin unter der MIT-Lizenz nutzbar.

## Unterstützen

Wenn dir dieses Projekt hilft, freue ich mich über einen Kaffee ☕

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-FFDD00?logo=buymeacoffee&logoColor=black)](https://www.buymeacoffee.com/olivermarcus.eder)
