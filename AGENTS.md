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

## Architekturdokumentation

Vollständige arc42-Architekturdokumentation liegt unter `docs/architecture/arc42/`
(Einstieg: `docs/architecture/arc42/00-uebersicht.md`). Bei größeren
strukturellen Änderungen (neue Architekturentscheidung, neuer Baustein, geänderte Kopplung
zwischen Modulen) das passende Kapitel dort ergänzen, insbesondere:

- Kapitel 08 (Querschnittliche Konzepte) für neue stillschweigende Kopplungen/Invarianten.
- Kapitel 09 (Architekturentscheidungen) für neue ADRs.
- Kapitel 11 (Risiken und technische Schulden) für neu erkannte offene Probleme.
