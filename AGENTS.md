# Projekt-Hinweise für KI-Coding-Agenten

## Use-Case-Übersicht pflegen

`docs/use-cases-und-kritikalitaet.md` ist eine lebende Übersicht aller Geschäftsprozesse/Use-Cases
mit Kritikalitätseinstufung (🔴 kritisch / 🟡 wichtig / ⚪ nice-to-have) und ihrer aktuellen
Testabsicherung.

**Regel:** Bei jeder `superpowers:brainstorming`-Session (egal ob für ein neues Feature oder eine
Änderung) dieses Dokument prüfen und bei Bedarf aktualisieren:

- Neue Use-Cases, die durch das Brainstorming entstehen, mit Kritikalität eintragen.
- Geänderte Kritikalität bestehender Use-Cases anpassen (z. B. wenn ein bisher nice-to-have-Feature
  durch eine Anforderungsänderung kritisch wird).
- Testabsicherungs-Spalte aktualisieren, sobald neue E2E-/Unit-Tests für einen Use-Case entstehen.
- Bei gefundenen Bugs, die einen kritischen Prozess betrafen, den Vorfall kurz im Abschnitt
  „Bekannte Vorfälle" festhalten — das ist die Grundlage dafür, dass diese Übersicht ihren Zweck
  erfüllt (verhindern, dass dieselbe Art von Lücke unbemerkt wiederkehrt).

Diese Pflege ist kein optionaler Nice-to-have-Schritt, sondern Teil des Brainstorming-Ablaufs für
dieses Projekt.

## Barrierefreiheits-Tests (A11y) aktuell halten

`e2e/accessibility.spec.ts` prüft eine kuratierte, NICHT erschöpfende Liste von
Seiten-/Zustandskombinationen gegen WCAG 2.1 AA (`@axe-core/playwright`, siehe arc42 Kapitel 8.10).
Diese Liste war bereits einmal unvollständig (vier Seiten fehlten, siehe arc42 Kapitel 11.8) — das
darf sich nicht wiederholen:

- Bei jeder neuen Seite/Route einen entsprechenden Test in `e2e/accessibility.spec.ts` ergänzen.
- Bei jedem signifikanten neuen UI-Zustand einer bestehenden Seite (neuer Dialog, neue
  bedingte Anzeige, neuer Fehler-/Leerzustand) prüfen, ob er ebenfalls einen eigenen Testfall
  verdient — analog zu den bereits vorhandenen Zustands-Varianten (z. B. "Konfiguration mit
  Schweizer Modus", "manuelle Paarungsdialog-Zustand").
- Nach Ergänzung/Änderung die Zahl der kuratierten Kombinationen in `docs/architecture/arc42/08-
  querschnittliche-konzepte.md` (Kapitel 8.10) und `10-qualitaetsanforderungen.md` (QS-4)
  konsistent nachziehen.

## Architekturdokumentation

Vollständige arc42-Architekturdokumentation liegt unter `docs/architecture/arc42/`
(Einstieg: `docs/architecture/arc42/00-uebersicht.md`). Bei größeren
strukturellen Änderungen (neue Architekturentscheidung, neuer Baustein, geänderte Kopplung
zwischen Modulen) das passende Kapitel dort ergänzen, insbesondere:

- Kapitel 08 (Querschnittliche Konzepte) für neue stillschweigende Kopplungen/Invarianten.
- Kapitel 09 (Architekturentscheidungen) für neue ADRs.
- Kapitel 11 (Risiken und technische Schulden) für neu erkannte offene Probleme.
