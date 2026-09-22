## 1. Kurzreferenz: Typischer Ablauf
<!-- #kurzreferenz -->

1. **Teams** → alle teilnehmenden Teams anlegen
1. **Konfiguration** → Modus „Einstufungsturnier" wählen, Rundenzahl/Felder/Halle festlegen, Zeitplan generieren
1. **Ergebnisse erfassen** → Runde für Runde Ergebnisse eintragen, auf „Nächste Runde auslosen" bzw. „Turnier abschließen" klicken
1. Bei Bedarf: Team zurückziehen, vergangene Ergebnisse korrigieren
1. **Turnierübersicht** → laufende Tabelle verfolgen, am Ende ausdrucken
1. **Export** → Turnier als PDF/ZIP/JSON sichern

## 2. Überblick
<!-- #ueberblick -->

Der Basketball Turnier-Manager unterstützt drei Turnierformen:

- **Jeder gegen Jeden** (Round-Robin) — alle Teams spielen einmal (optional zweimal, siehe unten) gegeneinander, keine Gruppenaufteilung, keine Endrunde
- **Gruppenphase + Endrunde** — Teams werden in eine oder mehrere Gruppen aufgeteilt, spielen innerhalb ihrer Gruppe jeder gegen jeden, anschließend folgt eine K.O.-Endrunde (Halbfinale + Finale oder nur Finale)
- **Einstufungsturnier (Schweizer System)** — automatische, leistungsbasierte Paarung über mehrere Runden, ideal für Verbandsturniere mit vielen Teams und begrenzter Zeit

Diese Anleitung führt einmal komplett durch ein Einstufungsturnier (Schweizer System), da es die meisten Funktionen des Tools nutzt. Die Abschnitte 2–4 (Teams, Grundkonfiguration, Zeitplan generieren) gelten für alle drei Turnierformen gleichermaßen. Die Besonderheiten von „Jeder gegen Jeden" und „Gruppenphase + Endrunde" (Gruppenaufteilung, Rückrunde) sind in Abschnitt 4.1 gesondert beschrieben.

Alle Daten werden ausschließlich lokal im Browser gespeichert (kein Server, kein Konto nötig). Über den JSON-Export/-Import (Abschnitt 8/9) lässt sich ein Turnier auf ein anderes Gerät übertragen oder sichern.

::: callout Zum Ausprobieren: Demo-Turniere
Wer das Tool erst einmal unverbindlich testen möchte, muss nicht bei null anfangen — fünf vorbereitete, bereits laufende Beispielturniere stehen zum Herunterladen bereit (Liste darunter). Eine heruntergeladene Datei lässt sich über „Turnier importieren" auf der Konfigurationsseite (Abschnitt 9) direkt laden. Der typische Ablauf ist auch in der Kurzreferenz (Abschnitt 1) zusammengefasst.
:::

Je eines pro Turnierform (mit ca. 9 Teams, einige Ergebnisse bereits eingetragen) sowie zwei Großturnier-Beispiele mit 64 Teams in 16 Gruppen (einmal ohne, einmal mit Ergebnissen), um die Skalierung bei sehr vielen Teilnehmern zu zeigen:

- [Jeder gegen Jeden, 9 Teams](demos/01-jeder-gegen-jeden-9-teams-laufend.json)
- [Gruppenphase + Endrunde, 9 Teams / 2 Gruppen](demos/02-gruppenphase-endrunde-9-teams-laufend.json)
- [Einstufungsturnier (Schweizer System), 9 Teams](demos/03-schweizer-system-9-teams-laufend.json)
- [Großturnier, 64 Teams / 16 Gruppen (ohne Ergebnisse)](demos/04-grossturnier-64-teams-16-gruppen-ungespielt.json)
- [Großturnier, 64 Teams / 16 Gruppen (mit Ergebnissen)](demos/05-grossturnier-64-teams-16-gruppen-laufend.json)

## 3. Teams anlegen
<!-- #teams -->

![Leere Teamübersicht](01-teams-leer.png)

Auf der Startseite **Teams** beginnt jedes Turnier. Über den Button **„Team hinzufügen"** öffnet sich ein Dialog zur Eingabe von Name, Logo-URL, Vereinsfarbe, Kontakt und optional einem **Kürzel**.

![Dialog zum Anlegen eines Teams](02-team-dialog-leer.png)

::: callout Hinweis zum Kürzel
Wird kein Kürzel eingetragen, leitet das Tool automatisch eines ab (erste drei Buchstaben des Namens, plus angehängte Ziffer, falls der Name auf eine Zahl endet — z. B. „SG Ost 2" → „SGO2"). Das Kürzel wird an Stellen mit wenig Platz (Ergebniserfassung, Zeitplanzeilen) verwendet, wenn der volle Name nicht mehr passt. Auf der Teamübersicht bleibt immer der volle Name die Hauptanzeige, das Kürzel erscheint dort nur ergänzend in Klammern.
:::

Nach dem Anlegen mehrerer Teams zeigt die Übersicht alle Teams als Karten:

![Teamübersicht mit mehreren Teams](03-teams-liste.png)

Über den **„Bearbeiten"**-Button lässt sich jedes Team jederzeit anpassen (Name, Logo, Farbe, Kontakt, Kürzel):

![Dialog zum Bearbeiten eines Teams](04-team-bearbeiten.png)

Für ein Einstufungsturnier werden mindestens 2 Teams benötigt — praktisch sinnvoll sind es aber deutlich mehr (Verbandsturniere typischerweise 8+).

## 4. Turnier konfigurieren
<!-- #konfiguration -->

Auf der Seite **Konfiguration** werden Turniermodus, Spieleinstellungen, Hallendaten festgelegt und am Ende der Zeitplan generiert.

![Konfiguration, Abschnitt Allgemein](05-konfiguration-allgemein.png)

Im Abschnitt **Allgemein**: Turniername eintragen, Turniermodus auf **„Einstufungsturnier (Schweizer System)"** stellen. Es erscheint das Feld **„Anzahl Runden"** mit einem automatischen Vorschlag nach der Standard-Schweizer-Formel (basierend auf der Teamanzahl) — dieser Vorschlag kann bei Bedarf manuell angepasst werden:

![Automatischer Rundenvorschlag](06-konfiguration-swiss-rundenvorschlag.png)

Darunter zeigt das Tool eine geschätzte Gesamtdauer des Turniers, basierend auf Rundenzahl, Spieldauer und Anzahl der Felder.

### 4.1 Jeder gegen Jeden und Gruppenphase: Gruppen & Rückrunde
<!-- #konfiguration-gruppen -->

Bei den Modi **„Jeder gegen Jeden"** und **„Gruppenphase + Endrunde"** plant das Tool die Begegnungen nach der klassischen **Rundensystem-Methode** (Circle-Method): alle Spiele einer Runde betreffen unterschiedliche Teams, dadurch werden alle verfügbaren Felder von Anfang an gleichzeitig genutzt statt nacheinander abgearbeitet.

Bei **„Jeder gegen Jeden"** spielt immer die komplette Teamliste in einer einzigen Gruppe gegeneinander — es gibt keine weitere Einstellung dazu, und keine anschließende Endrunde.

Beim Modus **„Gruppenphase + Endrunde"** erscheint zusätzlich der Abschnitt **Gruppen**, in dem sich das Turnier auf mehrere parallele Vorrundengruppen aufteilen lässt:

- **Anzahl Gruppen** — wie viele Gruppen es geben soll. Das Tool schlägt automatisch einen sinnvollen Wert vor (basierend auf der Teamanzahl, mit dem Ziel, Gruppen von etwa 3–4 Teams zu bilden und die spätere Endrunde ohne Freilose planen zu können) — der Vorschlag lässt sich jederzeit manuell überschreiben. Bei „Anzahl Gruppen" gleich 1 verhält sich der Modus wie eine einzelne Vorrundengruppe mit anschließender Endrunde (das bisherige, unveränderte Verhalten).
- **Mit Rückspiel (Hin- und Rückrunde)** — wenn aktiviert, spielt jedes Team innerhalb seiner Gruppe zweimal gegen jeden Gegner (einmal als Heim-, einmal als Auswärtsteam mit vertauschten Rollen), statt nur einmal.
- Für jedes angelegte Team lässt sich per Dropdown die **Gruppe** (A, B, C, …) auswählen, in der es spielen soll. Neu angelegte Teams landen zunächst automatisch in Gruppe A.

![Abschnitt Gruppen mit Gruppenvorschlag, Rückspiel-Option und Team-Zuordnung](24-konfiguration-gruppen.png)

::: callout Wichtig: Gruppengröße
Eine Gruppe sollte praktisch nicht mehr als etwa 6, besser 3–4 Teams umfassen — sonst wird die Gruppenphase selbst sehr lang. Bei vielen Teams ist es sinnvoller, mehr, dafür kleinere Gruppen zu bilden (das schlägt das Tool auch automatisch so vor).
:::

Das funktioniert auch bei sehr großen Turnieren zuverlässig: bei 64 angemeldeten Teams schlägt das Tool automatisch 16 Gruppen zu je 4 Teams vor (statt z. B. 2 riesiger Gruppen zu 32 Teams), damit die Gruppenphase selbst überschaubar bleibt:

![Automatischer Gruppenvorschlag bei 64 Teams: 16 Gruppen à 4 Teams](27-konfiguration-gruppen-64-teams.png)

Sobald mehr als eine Gruppe existiert (also mindestens ein Team einer zweiten Gruppe zugewiesen wurde), erscheint nach dem Generieren des Zeitplans zusätzlich der Navigationspunkt **„Gruppentabellen"** (siehe Abschnitt 6.1) — bei nur einer Gruppe reicht weiterhin die normale Zeitplan-Ansicht.

::: callout Hinweis: kein Freilos in der Gruppenphase
Anders als beim Schweizer System (Abschnitt 5) gibt es in der Gruppenphase kein Freilos. Ist eine Gruppe ungerade groß, setzt in jeder Runde einfach das jeweils passende Team aus — ohne Spiel und ohne Punktgutschrift für diese Runde.
:::

### 4.2 Jeder gegen Jeden und Gruppenphase: Ergebnisse erfassen
<!-- #konfiguration-gruppenergebnisse -->

Sobald ein Zeitplan generiert wurde, steht für die Modi „Jeder gegen Jeden" und „Gruppenphase + Endrunde" der Navigationspunkt **„Ergebnisse erfassen"** zur Verfügung. Dort erscheinen alle Spiele der Gruppenphase chronologisch nach Uhrzeit sortiert — unabhängig davon, aus welcher Gruppe oder von welchem Feld sie stammen:

![Ergebnisse erfassen mit Status-, Gruppen- und Feld-Filter](29-ergebnisse-erfassen-gruppenphase.png)

Drei Filter lassen sich beliebig miteinander kombinieren:

- **Status** — „Offen" (Standardeinstellung, zeigt nur noch nicht gespielte Partien), „Erfasst" (nur bereits eingetragene Ergebnisse) oder „Alle".
- **Gruppe** — auf eine einzelne Gruppe eingrenzen, oder „Alle Gruppen" (Standard).
- **Feld** — auf ein einzelnes Feld eingrenzen, oder „Alle Felder" (Standard).

Bei jeder Zeile lässt sich das Ergebnis direkt eintragen: Heim- und Auswärtspunkte eingeben, auf **„Speichern"** klicken — fertig. Nach dem Speichern erscheint ein Hinweis mit einem Link direkt zur aktualisierten Tabelle der betroffenen Gruppe:

![Bestätigung nach dem Speichern eines Ergebnisses mit Link zur Gruppentabelle](30-ergebnis-gespeichert-link-gruppentabelle.png)

::: callout Wichtig: jedes Ergebnis wird sofort für sich gespeichert
Anders als beim Schweizer System (Abschnitt 5) gibt es hier keinen Rundenabschluss-Schritt — jedes Ergebnis wird unabhängig von allen anderen Spielen direkt beim Klick auf „Speichern" übernommen. Mehrere Gruppen können dadurch völlig unabhängig voneinander und in beliebiger Reihenfolge bearbeitet werden.
:::

Bereits erfasste Ergebnisse lassen sich jederzeit korrigieren: über den Status-Filter „Alle" oder „Erfasst" anzeigen lassen, dann bei der betreffenden Zeile auf **„Korrigieren"** klicken — die Eingabefelder erscheinen mit dem bisherigen Ergebnis vorausgefüllt, erneutes „Speichern" übernimmt die Änderung. Eine Korrektur ist — anders als beim Schweizer System — zu jedem Zeitpunkt möglich, auch wenn bereits weitere Spiele dieser oder anderer Gruppen gespielt wurden.

Im Abschnitt **Spieleinstellungen** werden Anzahl und Dauer der Spielabschnitte, Pausen und Wechselzeiten festgelegt:

![Konfiguration, Abschnitt Spieleinstellungen](07-konfiguration-spieleinstellungen.png)

Im Abschnitt **Halle**: Hallenname, Verfügbarkeitszeiten, Auf-/Abbauzeiten sowie optionale Sperrzeiten (z. B. Mittagspause):

![Konfiguration, Abschnitt Halle](08-konfiguration-halle.png)

Zuletzt die **Anzahl Felder** festlegen (wie viele Spiele parallel laufen können) und auf **„Zeitplan generieren"** klicken. Bei Erfolg erscheint die Spielanzahl und das geschätzte Ende:

![Erfolgreich generierter Zeitplan](09-konfiguration-zeitplan-generiert.png)

::: callout Hinweis
Reicht die verfügbare Hallenzeit nicht aus, meldet das Tool „Kein Zeitplan möglich" — dann müssen Rundenzahl, Feldanzahl oder Hallenzeiten angepasst werden.
:::

Sobald ein Zeitplan existiert, werden die Navigationspunkte **„Ergebnisse erfassen"** und **„Turnierübersicht"** freigeschaltet (vorher grau/nicht klickbar).

## 5. Ergebnisse erfassen
<!-- #ergebnisse -->

Auf der Seite **Ergebnisse erfassen** werden die Ergebnisse rundenweise eingetragen.

![Leere Ergebniserfassung für Runde 1](10-ergebnisse-runde1-leer.png)

Jede Zeile zeigt Feldnummer, beide Teams und zwei schmale Eingabefelder für das Ergebnis. Nach Eingabe eines Ergebnisses erscheint ein grünes Häkchen — das bestätigt nur, dass der Wert lokal erfasst wurde, **gespeichert wird erst beim Klick auf den Rundenbutton** (siehe unten):

![Teilweise ausgefüllte Ergebnisse](11-ergebnisse-teilweise-ausgefuellt.png)

Solange nicht alle Spiele der Runde ein Ergebnis haben, bleibt der Button unten deaktiviert. Sind alle Ergebnisse eingetragen, wird er aktiv:

![Vollständig ausgefüllte Ergebnisse für Runde 1](12-ergebnisse-runde1-komplett.png)

::: callout Wichtig
Der Button heißt bei einer nicht-letzten Runde **„Nächste Runde auslosen"** — ein Klick speichert alle eingetragenen Ergebnisse dieser Runde UND lost automatisch die nächste Runde nach dem Schweizer System aus (leistungsbasierte Paarung, keine Wiederholung bereits gespielter Paarungen). Bei der **letzten** Runde des Turniers heißt derselbe Button **„Turnier abschließen"** — auch hier muss geklickt werden, damit die letzten Ergebnisse tatsächlich gespeichert werden.
:::

Nach dem Auslosen zeigt die Seite automatisch die neue Runde:

![Ansicht der zweiten Runde](13-ergebnisse-runde2.png)

Ein **Freilos** (bei ungerader Teamzahl) wird als eigene Zeile ohne Eingabefelder angezeigt und automatisch mit 2 Punkten gewertet.

### 5.1 Sonderfall: Ein Team zieht sich zurück
<!-- #ergebnisse-zurueckziehen -->

Muss ein Team während des Turniers aussteigen (z. B. Verletzung, kein Erscheinen), lässt sich das direkt in der Ergebniszeile über den Button **„… zurückziehen"** neben dem Teamnamen erledigen — nach einer Sicherheitsabfrage wird das laufende Spiel automatisch mit 0:0 annulliert und der Gegner erhält die Punkte für das Freilos:

![Zurückgezogenes Team in der Ergebniszeile](14-zurueckziehen-badge.png)

Das betroffene Team ist danach deutlich als **rotes „… zurückgezogen"-Feld** erkennbar; der Gegner behält seinen normalen, weiterhin klickbaren Button. Das zurückgezogene Team wird ab der nächsten Runde automatisch aus der Auslosung entfernt — der Turnierverlauf wird dabei nicht unterbrochen. Bereits gespielte Ergebnisse dieses Teams aus früheren Runden bleiben unverändert erhalten.

### 5.2 Vergangene Runden ansehen und Ergebnisse korrigieren
<!-- #ergebnisse-korrigieren -->

Über die Rundenbuttons oben auf der Seite lässt sich jederzeit zu einer bereits abgeschlossenen Runde zurückspringen:

![Rundenauswahl mit vergangener Runde](15-runde-auswaehler-vergangene-runde.png)

Ein deutlicher Hinweisbalken macht klar, dass man sich nicht in der aktuell aktiven Runde befindet, mit einem Ein-Klick-Button **„Zur aktuellen Runde"**. In dieser Ansicht steht bei jedem Spiel ein **„Korrigieren"**-Button, statt eines neuen Ergebnisses einzugeben:

![Ergebnis korrigieren](16-ergebnis-korrigieren.png)

Nach Eingabe des korrigierten Ergebnisses auf **„Speichern"** klicken:

![Korrigiertes Ergebnis](17-ergebnis-korrigiert.png)

::: callout Einschränkung
Ein Ergebnis lässt sich nur korrigieren, solange die **darauffolgende** Runde noch kein einziges Ergebnis hat. Sobald die nächste Runde begonnen hat, ist eine Korrektur der vorherigen Runde nicht mehr möglich — das verhindert Inkonsistenzen zwischen bereits ausgeloster Paarung und nachträglich verändertem Tabellenstand.
:::

### 5.3 Automatische Paarung nicht möglich
<!-- #ergebnisse-manuelle-paarung -->

In seltenen Fällen (meist bei kleinen Teamzahlen und vielen Runden) findet der Algorithmus keine gültige Paarung mehr, die alle bisherigen Begegnungen vermeidet. In diesem Fall erscheint ein Hinweis mit der Möglichkeit, die Paarungen für die nächste Runde manuell per Dropdown zuzuweisen — der Turnierablauf wird dadurch nie blockiert.

## 6. Turnierübersicht
<!-- #turnieruebersicht -->

Auf der Seite **Turnierübersicht** erscheinen die laufende Tabelle und der komplette Zeitplan mit Ergebnissen.

![Tabelle der Turnierübersicht](18-turnieruebersicht-tabelle.png)

Die Tabelle ist sortiert nach:

1. **Punkte** (Sieg = 2, Unentschieden = 1, Niederlage = 0)
1. **Buchholz-Zahl** — die Summe der Punkte aller bisherigen Gegner (zeigt, wie stark die bisherigen Gegner insgesamt abgeschnitten haben). Bei einem Freilos zählen die eigenen Punkte, bei einem Gegner, der zurückgezogen wurde, zählt diese Partie nicht mit.
1. **Korbdifferenz**

Diese Reihenfolge entspricht der Standard-Konvention des Schweizer Systems — sie wird direkt über der Tabelle erklärt, da die Buchholz-Priorität vor der eigenen Korbdifferenz auf den ersten Blick nicht immer intuitiv ist.

Zurückgezogene Teams sind in der Tabelle mit dem Zusatz **„(zurückgezogen)"** markiert.

Darunter folgt der komplette Zeitplan, gruppiert nach Runde. Bereits gespielte Partien zeigen das Endergebnis, noch ausstehende Partien die geplante Uhrzeit:

![Zeitplan der Turnierübersicht](19-turnieruebersicht-zeitplan.png)

Über den Button **„Drucken"** oben rechts lässt sich die komplette Übersicht (Tabelle + Zeitplan) als druckfertige Seite öffnen — praktisch für einen Aushang vor Ort.

### 6.1 Gruppentabellen (bei mehreren Gruppen)
<!-- #turnieruebersicht-gruppentabellen -->

Im Modus „Gruppenphase + Endrunde" erscheint bei mehr als einer Gruppe (siehe Abschnitt 4.1) statt der oben beschriebenen Turnierübersicht der Navigationspunkt **„Gruppentabellen"**. Über die Reiter oben (**„Gruppe A"**, **„Gruppe B"**, …) lässt sich zwischen den Gruppen wechseln — es wird immer nur eine Gruppe gleichzeitig angezeigt (Tabelle plus der vollständige Zeitplan dieser Gruppe), damit die Seite auch bei vielen Gruppen übersichtlich bleibt:

![Gruppentabellen-Seite mit Gruppen-Reitern und Drucken-Buttons](28-gruppentabellen-tabs-drucken.png)

Jede Gruppentabelle ist sortiert nach:

1. **Punkte** (Sieg = 2, Unentschieden = 1, Niederlage = 0)
1. **Direkter Vergleich** — bei Punktgleichstand entscheidet zunächst das Ergebnis der direkten Begegnung(en) der betroffenen Teams untereinander
1. **Korbdifferenz** — erst wenn auch der direkte Vergleich keinen Unterschied ergibt (z. B. weil die Teams noch nicht gegeneinander gespielt haben), entscheidet die Gesamt-Korbdifferenz

Diese Sortierung unterscheidet sich bewusst von der Turnierübersicht des Schweizer Systems: dort wird als Kriterium die Buchholz-Zahl verwendet (Abschnitt 6), in der Gruppenphase dagegen der direkte Vergleich — das ist die in Vereinsliga- und Gruppenturnieren übliche Konvention. Es gibt in der Gruppentabelle kein Buchholz-Kriterium.

Diese Ansicht funktioniert unverändert auch bei sehr vielen Gruppen — bei 64 Teams in 16 Gruppen erscheinen entsprechend 16 Reiter, jeder mit seinen eigenen 4 Teams:

![Gruppentabellen A, B, C bei einem 64-Teams-Turnier mit 16 Gruppen](26-gruppentabellen-64-teams.png)

Über die Buttons **„Diese Gruppe drucken"** und **„Alle Gruppen drucken"** oben rechts lässt sich entweder nur die gerade angezeigte Gruppe oder das komplette Turnier als druckfertige Seite öffnen. Beim Drucken aller Gruppen beginnt jede Gruppe automatisch auf einer neuen Seite, sodass sich einzelne Gruppen problemlos getrennt aushängen lassen.

## 7. Turnier läuft bereits: Änderungsschutz
<!-- #aenderungsschutz -->

Sobald das erste Ergebnis eines Turniers erfasst wurde, gilt das Turnier als „laufend". Ab diesem Zeitpunkt sind kritische Konfigurationsänderungen nur noch nach einer bewussten Bestätigung möglich — das schützt davor, versehentlich mitten im Turnier Einstellungen zu verändern, die den bisherigen Verlauf durcheinanderbringen würden.

![Gesperrte Konfiguration bei laufendem Turnier](20-konfiguration-gesperrt.png)

Betroffen sind: Turnier-/Spieleinstellungen, Hallenkonfiguration, Teams hinzufügen/löschen sowie ein erneutes Generieren des Zeitplans. Ein Klick auf **„Bearbeitung freischalten"** öffnet einen Bestätigungsdialog, der das Eintippen eines Bestätigungswortes verlangt, bevor die Änderung möglich wird:

![Bestätigungsdialog für gesperrte Änderungen](21-bestaetigungsdialog.png)

**Nicht betroffen** (jederzeit frei änderbar, kein Turnierbezug): Name, Logo, Kürzel und Farbe eines bestehenden Teams bearbeiten, sowie der komplette reguläre Turnierablauf (Ergebnisse erfassen, Runde auslosen, Ergebnis korrigieren, Team zurückziehen).

## 8. Export
<!-- #export -->

Auf der Seite **Export** lässt sich der aktuelle Turnierstand in drei Formaten herunterladen:

![Export-Seite](22-export-seite.png)

- **PDF** — druckfertiger Zeitplan
- **Web-Seite (ZIP)** — eigenständige HTML-Seite zum lokalen Öffnen oder Weitergeben
- **JSON** — maschinenlesbares Format, das den kompletten Turnierstand (Teams, Konfiguration, Zeitplan, alle Ergebnisse) enthält — Grundlage für den Import (nächster Abschnitt)

## 9. Turnier importieren (JSON)
<!-- #import -->

Auf der Konfigurationsseite, im Abschnitt **„Turnier importieren"**, lässt sich eine zuvor exportierte JSON-Datei wieder einlesen:

![Bereich zum JSON-Import](23-json-import-bereich.png)

Das ist nützlich, um:

- ein Turnier auf einem anderen Gerät oder in einem anderen Browser fortzusetzen,
- ein Backup wiederherzustellen,
- oder einen Turnierstand zur Fehleranalyse weiterzugeben.

**Ablauf:** Über den Button „JSON importieren" die zuvor exportierte Datei auswählen.

- Ist das aktuelle Turnier noch **nicht** gestartet (keine Ergebnisse vorhanden), wird sofort ohne Rückfrage ersetzt.
- Ist das aktuelle Turnier bereits **gestartet**, erscheint derselbe Bestätigungsdialog wie in Abschnitt 7 — der Import ersetzt das komplette aktuelle Turnier, das muss bewusst bestätigt werden.
- Ist die ausgewählte Datei beschädigt oder kein gültiges Turnier-JSON, erscheint eine klare Fehlermeldung, und am aktuellen Turnier ändert sich nichts.

::: callout Hinweis
Aktuell verwaltet das Tool immer genau ein Turnier. Ein Import ersetzt dieses vollständig — es gibt (noch) keine Möglichkeit, mehrere Turniere parallel zu speichern und zwischen ihnen zu wechseln.
:::
