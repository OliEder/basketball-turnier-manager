# Turniermanager — Phase 1: Planer

**Datum:** 2026-06-23  
**Turnier:** Fibalon U11-Summer Cup  
**Scope:** Planungsphase (vor dem Spieltag)

---

## Überblick

Eine Web-App für den Organisator zur Vorbereitung eines Basketballturniers. Der Planer läuft lokal im Browser, erzeugt einen optimierten Zeitplan und ermöglicht den Export als PDF und als deploybare statische Web-Seite (z.B. Vercel).

Phase 2 (Spieltag mit Live-Daten, Go-Backend, Raspberry Pi) ist bewusst ausgeklammert — der Planer exportiert einen JSON-Spielplan, den Phase 2 importiert.

---

## Datenmodell

### Team

```typescript
{
  id: string;           // UUID
  name: string;
  logoUrl: string;      // URL zu externem Logo (kein Datei-Upload in Phase 1)
  color: string;        // Hex-Farbe, z.B. "#ff6600"
  contact: string;      // Ansprechpartner (Name, optional)
  players: Player[];    // In Phase 1 leer, Datenstruktur vorbereitet
}
```

### Player (vorbereitet, UI in späterer Phase)

```typescript
{
  id: string;           // UUID
  firstName: string;
  lastName: string;
  jerseyNumber: string; // 1-2 Ziffern, z.B. "00", "01", "7" — kein Zahlentyp
                        // Validierung: ^[0-9]{1,2}$
}
```

### Turnierkonfiguration

```typescript
{
  id: string;
  name: string;         // z.B. "Fibalon U11-Summer Cup"
  mode: "round-robin" | "round-robin+finals"; // Jeder-gegen-Jeden, optional Finalrunde
  fields: number;       // Anzahl parallele Felder (z.B. 2)
  gameSettings: {
    periodsCount: number;       // Anzahl Spielabschnitte (z.B. 4 Viertel, 2 Halbzeiten, 8 Achtel)
    periodDurationMin: number;  // Dauer pro Abschnitt in Minuten (z.B. 5)
    breakBetweenPeriodsMin: number;  // Pause zwischen Abschnitten (kurz)
    halfTimeBreakMin: number;        // Halbzeitpause (länger, inkl. Seitenwechsel)
    bufferBetweenGamesMin: number; // Puffer/Wechselzeit zwischen zwei Spielen auf demselben Feld
  };
  venue: {
    name: string;
    availabilityWindows: TimeWindow[]; // z.B. [{ start: "09:00", end: "20:00" }]
    blackoutPeriods: TimeWindow[];     // Sperrzeiten, z.B. [{ start: "12:00", end: "14:00", reason: "Mittagshitze" }]
    setupBufferMin: number;    // Rüstzeit Beginn (Aufbau)
    teardownBufferMin: number; // Rüstzeit Ende (Abbau)
  };
  teams: Team[];
}
```

### TimeWindow

```typescript
{
  start: string;   // "HH:MM"
  end: string;     // "HH:MM"
  reason?: string; // optionale Beschreibung (z.B. "Mittagshitze")
}
```

### Spiel

```typescript
{
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  field: number;         // 1-basiert
  scheduledStart: string; // "HH:MM"
  scheduledEnd: string;
  round: number;
  gameNumber: number;    // fortlaufend
  periodScores: PeriodScore[]; // In Phase 1 leer, Phase 2 befüllt sie live
}
```

### PeriodScore

```typescript
{
  period: number;        // 1-basiert (Viertel, Halbzeit, Achtel — je nach Konfiguration)
  homeScore: number;
  awayScore: number;
}
```

### Zeitplan

```typescript
{
  id: string;
  tournamentId: string;
  generatedAt: string;   // ISO timestamp
  games: Game[];
  totalDurationMin: number;
  estimatedEnd: string;  // "HH:MM"
}
```

---

## Module (Phase 1)

### Modul 1 — Team-Verwaltung

- Teams anlegen, bearbeiten, löschen
- Felder: Name, Logo-URL, Farbe (Color Picker), Kontaktperson
- Spieler-Datenstruktur wird gespeichert, aber keine UI in Phase 1
- Mindestens 2 Teams erforderlich, empfohlen 4–16

### Modul 2 — Turnierkonfiguration

- Turniermodus wählen: Jeder-gegen-Jeden / Jeder-gegen-Jeden + Finalrunde
- Anzahl parallele Felder (1–4)
- Spielparameter:
  - Anzahl Spielabschnitte (Standard: 4 — Viertel)
  - Dauer pro Abschnitt in Minuten (Standard: 5)
  - Pause nach Halbzeit (Standard: 5 Min)
  - Pause zwischen anderen Abschnitten (Standard: 1 Min)
  - Puffer/Wechselzeit zwischen Spielen auf demselben Feld (Standard: 5 Min)

### Modul 3 — Hallenkonfiguration & Zeitplan-Generator

**Hallenkonfiguration:**
- Hallenname
- Verfügbarkeitsfenster (Start- und Endzeit, z.B. 09:00–20:00)
- Sperrzeiten (beliebig viele, mit optionalem Grund), z.B.:
  - 12:00–14:00 "Mittagshitze"
- Rüstzeit Beginn (Aufbau, z.B. 30 Min)
- Rüstzeit Ende (Abbau, z.B. 30 Min)

**Zeitplan-Generator:**
- Berechnet automatisch alle Paarungen (Round Robin)
- Verteilt Spiele optimal auf verfügbare Zeitfenster und Felder
- Respektiert Sperrzeiten — kein Spiel startet oder endet in einer Sperrzeit
- Minimiert Spiele in der Mittagszeit (Sperrzeiten haben höchste Priorität, "heißes Fenster" optional gewichtbar)
- Gibt Warnung aus wenn Zeitplan nicht in Hallenverfügbarkeit passt

**Manuelle Anpassung:**
- Einzelne Spiele per Drag & Drop oder Zeitfeld verschieben
- Konflikte (Überschneidung, Sperrzeit) werden visuell markiert

### Modul 4 — Export

- **PDF**: Vollständiger Zeitplan, druckbar, mit Turniername und Datum
- **Web-Seite**: Statische HTML/CSS-Seite mit Zeitplan, deploybar auf Vercel/Netlify
- **JSON**: Maschinenlesbarer Export für Phase 2 (Spieltag-Backend)
- Alle Exporte enthalten: Spielpaarungen, Zeiten, Felder, Team-Logos (via URL)

---

## Architektur

```
Frontend (React + Vite)
├── Planer-App (läuft lokal, kein Server nötig)
│   ├── /teams          — Team-Verwaltung
│   ├── /config         — Turnierkonfiguration
│   ├── /schedule       — Hallenkonfiguration + Zeitplan
│   └── /export         — Export (PDF, Web, JSON)
│
├── Datenpersistenz
│   └── localStorage / IndexedDB (kein Backend in Phase 1)
│       → JSON-Export als "Backup" / Weitergabe
│
└── Export-Engine
    ├── PDF-Generator (Browser-seitig, z.B. jsPDF oder react-pdf)
    ├── Statische HTML-Seite (generiert im Browser, ZIP-Download)
    └── JSON-Export (direkter Download)
```

**Kein Backend in Phase 1.** Alle Daten leben im Browser. Der JSON-Export ist die Schnittstelle zu Phase 2.

**Phase 2 (Spieltag) — Ausblick:**
- Go-Backend auf Raspberry Pi 4/400
- WebSocket-Server für Live-Daten (Ergebnisse, Tabelle)
- Mehrere parallele Eingabe-Clients (Tablets/Smartphones im Browser)
- Display-Views für Aufenthaltsraum etc.
- Importiert JSON-Export aus Phase 1

---

## Technologie-Stack

| Schicht | Technologie | Begründung |
|---|---|---|
| Framework | React + Vite | Schnell, kein Server nötig, große Community |
| UI-Komponenten | shadcn/ui + Tailwind CSS | Fertige professionelle Komponenten, vollständig anpassbar |
| Datenpersistenz | localStorage + IndexedDB | Kein Backend, funktioniert offline |
| PDF-Export | jsPDF oder react-pdf | Browser-seitig, kein Server |
| Deployment (Share) | Vercel | Ein-Klick-Deploy für statische Apps |

---

## Design & Branding

- **UI-Ästhetik**: Orientiert sich an modernem Basketball-Branding — klar, kontraststark, typografisch stark, keine unnötigen Schnörkel. Referenz: [ALBA Berlin Digital Rebranding](https://mor-design.de/case/alba-berlin-digital-rebranding-de)
- **Vereinsbranding**: Logo und Farbgebung werden von [fibalon-baskets.de](https://fibalon-baskets.de) übernommen
- **Umsetzung**: shadcn/ui + Tailwind CSS — fertige Komponenten als Basis, Vereinsfarben und Sportästhetik als Anpassungsschicht

---

## Nicht im Scope (Phase 1)

- Spieler-Erfassung UI (Datenstruktur vorbereitet)
- Live-Ergebnisse / Tabelle
- Anmeldeprozess für Teams
- Schiedsrichter-Zuweisung
- Mehrere Turniere gleichzeitig verwalten (Single-Tournament-App)
- Authentifizierung / Benutzerkonten

---

## Erfolgskriterien

1. Organisator kann Teams mit Logo-URL erfassen
2. Turniermodus und Spielparameter konfigurieren
3. Hallenverfügbarkeit + Sperrzeiten eingeben
4. Zeitplan wird automatisch generiert und respektiert alle Sperrzeiten
5. Zeitplan kann manuell angepasst werden
6. Export als PDF, Web-Seite und JSON funktioniert
7. App läuft vollständig offline im Browser
