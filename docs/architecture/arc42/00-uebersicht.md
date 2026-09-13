# Architekturdokumentation — Übersicht

Diese Dokumentation folgt dem [arc42](https://arc42.org/)-Standard und beschreibt die Architektur
des Basketball Turnier-Managers so, wie sie sich Stand 2026-09-13 tatsächlich im Code darstellt —
für das Onboarding neuer Sessions/Personen, um stillschweigende Kopplungen explizit zu machen
(mehrere reale Bugs entstanden bereits aus undokumentierten Annahmen), und als Grundlage für die
geplante Vereinheitlichung der Endrunden-Varianten. Ergänzend dazu: die lebende
[Use-Case- und Kritikalitätsübersicht](../../use-cases-und-kritikalitaet.md), die bei jeder
Brainstorming-Session gepflegt wird.

| Kapitel | Inhalt |
|---|---|
| [01 Einführung und Ziele](01-einfuehrung-und-ziele.md) | Was die App leistet, priorisierte Qualitätsziele, Stakeholder, bewusste Nicht-Ziele. |
| [02 Randbedingungen](02-randbedingungen.md) | Tech-Stack, organisatorische Rahmenbedingungen, Entwicklungsprozess. |
| [03 Kontextabgrenzung](03-kontextabgrenzung.md) | Fachlicher und technischer Kontext — wer/was interagiert mit der App und wie. |
| [04 Lösungsstrategie](04-loesungsstrategie.md) | Die grundlegenden Architekturentscheidungen auf hoher Flughöhe. |
| [05 Bausteinsicht](05-bausteinsicht.md) | Modulstruktur mit Blackbox-Beschreibung jedes Generators — der zentrale Ort für "wo muss ich für eine Änderung hin". |
| [06 Laufzeitsicht](06-laufzeitsicht.md) | Zentrale Abläufe als Sequenzdiagramme, inkl. eines realen Bugfix-Beispiels. |
| [07 Verteilungssicht](07-verteilungssicht.md) | Build, Hosting, CI-Pipeline. |
| [08 Querschnittliche Konzepte](08-querschnittliche-konzepte.md) | Die stillschweigenden Kopplungen/Invarianten, die bereits zu Bugs geführt haben — Pflichtlektüre vor größeren Änderungen. |
| [09 Architekturentscheidungen](09-architekturentscheidungen.md) | ADRs, aus den Design-Specs und dem Code extrahiert. |
| [10 Qualitätsanforderungen](10-qualitaetsanforderungen.md) | Konkrete, testbare Qualitätsszenarien je Qualitätsziel. |
| [11 Risiken und technische Schulden](11-risiken-und-technische-schulden.md) | Ehrliche Liste offener Probleme, allen voran die unvollständige Endrunden-Vereinheitlichung. |
| [12 Glossar](12-glossar.md) | Fach- und projektspezifische technische Begriffe. |

## Pflegehinweis

Bei größeren strukturellen Änderungen (neue Architekturentscheidung, neuer Baustein, geänderte
Kopplung zwischen Modulen) das passende Kapitel hier ergänzen — insbesondere Kapitel 08
(Querschnittliche Konzepte), 09 (Architekturentscheidungen) und 11 (Risiken). Diese Regel ist in
`AGENTS.md` verankert.
