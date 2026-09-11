import { Button } from '@/components/ui/button'
import { openManualPrintWindow } from '@/lib/export/manual-print-export'

function Callout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-brand-primary/30 bg-tint p-4 text-sm">
      <p className="font-semibold text-brand-primary mb-1">{title}</p>
      <p>{children}</p>
    </div>
  )
}

function Screenshot({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}anleitung/${src}`}
      alt={alt}
      className="rounded-md border border-border shadow-sm max-w-full"
    />
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-4">
      <h2 className="font-display text-xl uppercase text-brand-primary">{title}</h2>
      {children}
    </section>
  )
}

function SubSection({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="space-y-3">
      <h3 className="font-display text-base uppercase text-brand-primary-light">{title}</h3>
      {children}
    </div>
  )
}

const TOC_ITEMS = [
  { id: 'ueberblick', title: '1. Überblick' },
  { id: 'teams', title: '2. Teams anlegen' },
  { id: 'konfiguration', title: '3. Turnier konfigurieren' },
  {
    id: 'ergebnisse',
    title: '4. Ergebnisse erfassen',
    children: [
      { id: 'ergebnisse-zurueckziehen', title: '4.1 Sonderfall: Ein Team zieht sich zurück' },
      { id: 'ergebnisse-korrigieren', title: '4.2 Vergangene Runden ansehen und Ergebnisse korrigieren' },
      { id: 'ergebnisse-manuelle-paarung', title: '4.3 Automatische Paarung nicht möglich' },
    ],
  },
  { id: 'turnieruebersicht', title: '5. Turnierübersicht' },
  { id: 'aenderungsschutz', title: '6. Turnier läuft bereits: Änderungsschutz' },
  { id: 'export', title: '7. Export' },
  { id: 'import', title: '8. Turnier importieren (JSON)' },
  { id: 'kurzreferenz', title: '9. Kurzreferenz: Typischer Ablauf' },
]

function TableOfContents() {
  return (
    <nav aria-label="Inhalt" className="rounded-md border border-brand-primary/30 bg-tint p-4 text-sm">
      <p className="font-semibold text-brand-primary mb-2">Inhalt</p>
      <ul className="space-y-1">
        {TOC_ITEMS.map(item => (
          <li key={item.id}>
            <a href={`#${item.id}`} className="text-brand-primary hover:underline">
              {item.title}
            </a>
            {item.children && (
              <ul className="mt-1 ml-4 space-y-1">
                {item.children.map(child => (
                  <li key={child.id}>
                    <a href={`#${child.id}`} className="text-brand-primary-light hover:underline">
                      {child.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default function ManualPage() {
  return (
    <div className="space-y-10 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-display text-2xl uppercase text-brand-primary">
          Nutzeranleitung: Basketball Turnier-Manager
        </h1>
        <Button onClick={() => void openManualPrintWindow()} className="shrink-0">
          Als PDF herunterladen
        </Button>
      </div>

      <TableOfContents />

      <div id="manual-content" className="space-y-10">
      <Section id="ueberblick" title="1. Überblick">
        <p>Der Basketball Turnier-Manager unterstützt drei Turnierformen:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Jeder gegen Jeden</strong> (Round-Robin)</li>
          <li><strong>Jeder gegen Jeden + Finale</strong> (Round-Robin mit anschließender K.O.-Finalrunde)</li>
          <li>
            <strong>Einstufungsturnier (Schweizer System)</strong> — automatische, leistungsbasierte Paarung über
            mehrere Runden, ideal für Verbandsturniere mit vielen Teams und begrenzter Zeit
          </li>
        </ul>
        <p>
          Diese Anleitung führt einmal komplett durch ein Einstufungsturnier (Schweizer System), da es die meisten
          Funktionen des Tools nutzt. Die Schritte 1–3 (Teams, Grundkonfiguration, Zeitplan generieren) gelten für
          alle drei Turnierformen gleichermaßen.
        </p>
        <p>
          Alle Daten werden ausschließlich lokal im Browser gespeichert (kein Server, kein Konto nötig). Über den
          JSON-Export/-Import (Abschnitt 9) lässt sich ein Turnier auf ein anderes Gerät übertragen oder sichern.
        </p>
      </Section>

      <Section id="teams" title="2. Teams anlegen">
        <Screenshot src="01-teams-leer.png" alt="Leere Teamübersicht" />
        <p>
          Auf der Startseite <strong>Teams</strong> beginnt jedes Turnier. Über den Button
          <strong> „Team hinzufügen"</strong> öffnet sich ein Dialog zur Eingabe von Name, Logo-URL, Vereinsfarbe,
          Kontakt und optional einem <strong>Kürzel</strong>.
        </p>
        <Screenshot src="02-team-dialog-leer.png" alt="Dialog zum Anlegen eines Teams" />
        <Callout title="Hinweis zum Kürzel">
          Wird kein Kürzel eingetragen, leitet das Tool automatisch eines ab (erste drei Buchstaben des Namens, plus
          angehängte Ziffer, falls der Name auf eine Zahl endet — z. B. „SG Ost 2" → „SGO2"). Das Kürzel wird an
          Stellen mit wenig Platz (Ergebniserfassung, Zeitplanzeilen) verwendet, wenn der volle Name nicht mehr
          passt. Auf der Teamübersicht bleibt immer der volle Name die Hauptanzeige, das Kürzel erscheint dort nur
          ergänzend in Klammern.
        </Callout>
        <p>Nach dem Anlegen mehrerer Teams zeigt die Übersicht alle Teams als Karten:</p>
        <Screenshot src="03-teams-liste.png" alt="Teamübersicht mit mehreren Teams" />
        <p>
          Über den <strong>„Bearbeiten"</strong>-Button lässt sich jedes Team jederzeit anpassen (Name, Logo, Farbe,
          Kontakt, Kürzel):
        </p>
        <Screenshot src="04-team-bearbeiten.png" alt="Dialog zum Bearbeiten eines Teams" />
        <p>
          Für ein Einstufungsturnier werden mindestens 2 Teams benötigt — praktisch sinnvoll sind es aber deutlich
          mehr (Verbandsturniere typischerweise 8+).
        </p>
      </Section>

      <Section id="konfiguration" title="3. Turnier konfigurieren">
        <p>
          Auf der Seite <strong>Konfiguration</strong> werden Turniermodus, Spieleinstellungen, Hallendaten
          festgelegt und am Ende der Zeitplan generiert.
        </p>
        <Screenshot src="05-konfiguration-allgemein.png" alt="Konfiguration, Abschnitt Allgemein" />
        <p>
          Im Abschnitt <strong>Allgemein</strong>: Turniername eintragen, Turniermodus auf
          <strong> „Einstufungsturnier (Schweizer System)"</strong> stellen. Es erscheint das Feld
          <strong> „Anzahl Runden"</strong> mit einem automatischen Vorschlag nach der Standard-Schweizer-Formel
          (basierend auf der Teamanzahl) — dieser Vorschlag kann bei Bedarf manuell angepasst werden:
        </p>
        <Screenshot src="06-konfiguration-swiss-rundenvorschlag.png" alt="Automatischer Rundenvorschlag" />
        <p>
          Darunter zeigt das Tool eine geschätzte Gesamtdauer des Turniers, basierend auf Rundenzahl, Spieldauer und
          Anzahl der Felder.
        </p>
        <p>
          Im Abschnitt <strong>Spieleinstellungen</strong> werden Anzahl und Dauer der Spielabschnitte, Pausen und
          Wechselzeiten festgelegt:
        </p>
        <Screenshot src="07-konfiguration-spieleinstellungen.png" alt="Konfiguration, Abschnitt Spieleinstellungen" />
        <p>
          Im Abschnitt <strong>Halle</strong>: Hallenname, Verfügbarkeitszeiten, Auf-/Abbauzeiten sowie optionale
          Sperrzeiten (z. B. Mittagspause):
        </p>
        <Screenshot src="08-konfiguration-halle.png" alt="Konfiguration, Abschnitt Halle" />
        <p>
          Zuletzt die <strong>Anzahl Felder</strong> festlegen (wie viele Spiele parallel laufen können) und auf
          <strong> „Zeitplan generieren"</strong> klicken. Bei Erfolg erscheint die Spielanzahl und das geschätzte
          Ende:
        </p>
        <Screenshot src="09-konfiguration-zeitplan-generiert.png" alt="Erfolgreich generierter Zeitplan" />
        <Callout title="Hinweis">
          Reicht die verfügbare Hallenzeit nicht aus, meldet das Tool „Kein Zeitplan möglich" — dann müssen
          Rundenzahl, Feldanzahl oder Hallenzeiten angepasst werden.
        </Callout>
        <p>
          Sobald ein Zeitplan existiert, werden die Navigationspunkte <strong>„Ergebnisse erfassen"</strong> und
          <strong> „Turnierübersicht"</strong> freigeschaltet (vorher grau/nicht klickbar).
        </p>
      </Section>

      <Section id="ergebnisse" title="4. Ergebnisse erfassen">
        <p>Auf der Seite <strong>Ergebnisse erfassen</strong> werden die Ergebnisse rundenweise eingetragen.</p>
        <Screenshot src="10-ergebnisse-runde1-leer.png" alt="Leere Ergebniserfassung für Runde 1" />
        <p>
          Jede Zeile zeigt Feldnummer, beide Teams und zwei schmale Eingabefelder für das Ergebnis. Nach Eingabe
          eines Ergebnisses erscheint ein grünes Häkchen — das bestätigt nur, dass der Wert lokal erfasst wurde,
          <strong> gespeichert wird erst beim Klick auf den Rundenbutton</strong> (siehe unten):
        </p>
        <Screenshot src="11-ergebnisse-teilweise-ausgefuellt.png" alt="Teilweise ausgefüllte Ergebnisse" />
        <p>
          Solange nicht alle Spiele der Runde ein Ergebnis haben, bleibt der Button unten deaktiviert. Sind alle
          Ergebnisse eingetragen, wird er aktiv:
        </p>
        <Screenshot src="12-ergebnisse-runde1-komplett.png" alt="Vollständig ausgefüllte Ergebnisse für Runde 1" />
        <Callout title="Wichtig">
          Der Button heißt bei einer nicht-letzten Runde <strong>„Nächste Runde auslosen"</strong> — ein Klick
          speichert alle eingetragenen Ergebnisse dieser Runde UND lost automatisch die nächste Runde nach dem
          Schweizer System aus (leistungsbasierte Paarung, keine Wiederholung bereits gespielter Paarungen). Bei der
          <strong> letzten</strong> Runde des Turniers heißt derselbe Button <strong>„Turnier abschließen"</strong> —
          auch hier muss geklickt werden, damit die letzten Ergebnisse tatsächlich gespeichert werden.
        </Callout>
        <p>Nach dem Auslosen zeigt die Seite automatisch die neue Runde:</p>
        <Screenshot src="13-ergebnisse-runde2.png" alt="Ansicht der zweiten Runde" />
        <p>
          Ein <strong>Freilos</strong> (bei ungerader Teamzahl) wird als eigene Zeile ohne Eingabefelder angezeigt
          und automatisch mit 2 Punkten gewertet.
        </p>

        <SubSection id="ergebnisse-zurueckziehen" title="4.1 Sonderfall: Ein Team zieht sich zurück">
          <p>
            Muss ein Team während des Turniers aussteigen (z. B. Verletzung, kein Erscheinen), lässt sich das direkt
            in der Ergebniszeile über den Button <strong>„… zurückziehen"</strong> neben dem Teamnamen erledigen —
            nach einer Sicherheitsabfrage wird das laufende Spiel automatisch mit 0:0 annulliert und der Gegner
            erhält die Punkte für das Freilos:
          </p>
          <Screenshot src="14-zurueckziehen-badge.png" alt="Zurückgezogenes Team in der Ergebniszeile" />
          <p>
            Das betroffene Team ist danach deutlich als <strong>rotes „… zurückgezogen"-Feld</strong> erkennbar; der
            Gegner behält seinen normalen, weiterhin klickbaren Button. Das zurückgezogene Team wird ab der
            nächsten Runde automatisch aus der Auslosung entfernt — der Turnierverlauf wird dabei nicht
            unterbrochen. Bereits gespielte Ergebnisse dieses Teams aus früheren Runden bleiben unverändert
            erhalten.
          </p>
        </SubSection>

        <SubSection id="ergebnisse-korrigieren" title="4.2 Vergangene Runden ansehen und Ergebnisse korrigieren">
          <p>
            Über die Rundenbuttons oben auf der Seite lässt sich jederzeit zu einer bereits abgeschlossenen Runde
            zurückspringen:
          </p>
          <Screenshot src="15-runde-auswaehler-vergangene-runde.png" alt="Rundenauswahl mit vergangener Runde" />
          <p>
            Ein deutlicher Hinweisbalken macht klar, dass man sich nicht in der aktuell aktiven Runde befindet, mit
            einem Ein-Klick-Button <strong>„Zur aktuellen Runde"</strong>. In dieser Ansicht steht bei jedem Spiel
            ein <strong>„Korrigieren"</strong>-Button, statt eines neuen Ergebnisses einzugeben:
          </p>
          <Screenshot src="16-ergebnis-korrigieren.png" alt="Ergebnis korrigieren" />
          <p>Nach Eingabe des korrigierten Ergebnisses auf <strong>„Speichern"</strong> klicken:</p>
          <Screenshot src="17-ergebnis-korrigiert.png" alt="Korrigiertes Ergebnis" />
          <Callout title="Einschränkung">
            Ein Ergebnis lässt sich nur korrigieren, solange die <strong>darauffolgende</strong> Runde noch kein
            einziges Ergebnis hat. Sobald die nächste Runde begonnen hat, ist eine Korrektur der vorherigen Runde
            nicht mehr möglich — das verhindert Inkonsistenzen zwischen bereits ausgeloster Paarung und
            nachträglich verändertem Tabellenstand.
          </Callout>
        </SubSection>

        <SubSection id="ergebnisse-manuelle-paarung" title="4.3 Automatische Paarung nicht möglich">
          <p>
            In seltenen Fällen (meist bei kleinen Teamzahlen und vielen Runden) findet der Algorithmus keine
            gültige Paarung mehr, die alle bisherigen Begegnungen vermeidet. In diesem Fall erscheint ein Hinweis
            mit der Möglichkeit, die Paarungen für die nächste Runde manuell per Dropdown zuzuweisen — der
            Turnierablauf wird dadurch nie blockiert.
          </p>
        </SubSection>
      </Section>

      <Section id="turnieruebersicht" title="5. Turnierübersicht">
        <p>
          Auf der Seite <strong>Turnierübersicht</strong> erscheinen die laufende Tabelle und der komplette
          Zeitplan mit Ergebnissen.
        </p>
        <Screenshot src="18-turnieruebersicht-tabelle.png" alt="Tabelle der Turnierübersicht" />
        <p>Die Tabelle ist sortiert nach:</p>
        <ol className="list-decimal pl-6 space-y-1">
          <li><strong>Punkte</strong> (Sieg = 2, Unentschieden = 1, Niederlage = 0)</li>
          <li>
            <strong>Buchholz-Zahl</strong> — die Summe der Punkte aller bisherigen Gegner (zeigt, wie stark die
            bisherigen Gegner insgesamt abgeschnitten haben). Bei einem Freilos zählen die eigenen Punkte, bei
            einem Gegner, der zurückgezogen wurde, zählt diese Partie nicht mit.
          </li>
          <li><strong>Korbdifferenz</strong></li>
        </ol>
        <p>
          Diese Reihenfolge entspricht der Standard-Konvention des Schweizer Systems — sie wird direkt über der
          Tabelle erklärt, da die Buchholz-Priorität vor der eigenen Korbdifferenz auf den ersten Blick nicht immer
          intuitiv ist.
        </p>
        <p>
          Zurückgezogene Teams sind in der Tabelle mit dem Zusatz <strong>„(zurückgezogen)"</strong> markiert.
        </p>
        <p>
          Darunter folgt der komplette Zeitplan, gruppiert nach Runde. Bereits gespielte Partien zeigen das
          Endergebnis, noch ausstehende Partien die geplante Uhrzeit:
        </p>
        <Screenshot src="19-turnieruebersicht-zeitplan.png" alt="Zeitplan der Turnierübersicht" />
        <p>
          Über den Button <strong>„Drucken"</strong> oben rechts lässt sich die komplette Übersicht (Tabelle +
          Zeitplan) als druckfertige Seite öffnen — praktisch für einen Aushang vor Ort.
        </p>
      </Section>

      <Section id="aenderungsschutz" title="6. Turnier läuft bereits: Änderungsschutz">
        <p>
          Sobald das erste Ergebnis eines Turniers erfasst wurde, gilt das Turnier als „laufend". Ab diesem
          Zeitpunkt sind kritische Konfigurationsänderungen nur noch nach einer bewussten Bestätigung möglich — das
          schützt davor, versehentlich mitten im Turnier Einstellungen zu verändern, die den bisherigen Verlauf
          durcheinanderbringen würden.
        </p>
        <Screenshot src="20-konfiguration-gesperrt.png" alt="Gesperrte Konfiguration bei laufendem Turnier" />
        <p>
          Betroffen sind: Turnier-/Spieleinstellungen, Hallenkonfiguration, Teams hinzufügen/löschen sowie ein
          erneutes Generieren des Zeitplans. Ein Klick auf <strong>„Bearbeitung freischalten"</strong> öffnet einen
          Bestätigungsdialog, der das Eintippen eines Bestätigungswortes verlangt, bevor die Änderung möglich wird:
        </p>
        <Screenshot src="21-bestaetigungsdialog.png" alt="Bestätigungsdialog für gesperrte Änderungen" />
        <p>
          <strong>Nicht betroffen</strong> (jederzeit frei änderbar, kein Turnierbezug): Name, Logo, Kürzel und
          Farbe eines bestehenden Teams bearbeiten, sowie der komplette reguläre Turnierablauf (Ergebnisse
          erfassen, Runde auslosen, Ergebnis korrigieren, Team zurückziehen).
        </p>
      </Section>

      <Section id="export" title="7. Export">
        <p>
          Auf der Seite <strong>Export</strong> lässt sich der aktuelle Turnierstand in drei Formaten herunterladen:
        </p>
        <Screenshot src="22-export-seite.png" alt="Export-Seite" />
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>PDF</strong> — druckfertiger Zeitplan</li>
          <li><strong>Web-Seite (ZIP)</strong> — eigenständige HTML-Seite zum lokalen Öffnen oder Weitergeben</li>
          <li>
            <strong>JSON</strong> — maschinenlesbares Format, das den kompletten Turnierstand (Teams, Konfiguration,
            Zeitplan, alle Ergebnisse) enthält — Grundlage für den Import (nächster Abschnitt)
          </li>
        </ul>
      </Section>

      <Section id="import" title="8. Turnier importieren (JSON)">
        <p>
          Auf der Konfigurationsseite, im Abschnitt <strong>„Turnier importieren"</strong>, lässt sich eine zuvor
          exportierte JSON-Datei wieder einlesen:
        </p>
        <Screenshot src="23-json-import-bereich.png" alt="Bereich zum JSON-Import" />
        <p>Das ist nützlich, um:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>ein Turnier auf einem anderen Gerät oder in einem anderen Browser fortzusetzen,</li>
          <li>ein Backup wiederherzustellen,</li>
          <li>oder einen Turnierstand zur Fehleranalyse weiterzugeben.</li>
        </ul>
        <p><strong>Ablauf:</strong> Über den Button „JSON importieren" die zuvor exportierte Datei auswählen.</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Ist das aktuelle Turnier noch <strong>nicht</strong> gestartet (keine Ergebnisse vorhanden), wird sofort ohne Rückfrage ersetzt.</li>
          <li>
            Ist das aktuelle Turnier bereits <strong>gestartet</strong>, erscheint derselbe Bestätigungsdialog wie
            in Abschnitt 6 — der Import ersetzt das komplette aktuelle Turnier, das muss bewusst bestätigt werden.
          </li>
          <li>Ist die ausgewählte Datei beschädigt oder kein gültiges Turnier-JSON, erscheint eine klare Fehlermeldung, und am aktuellen Turnier ändert sich nichts.</li>
        </ul>
        <Callout title="Hinweis">
          Aktuell verwaltet das Tool immer genau ein Turnier. Ein Import ersetzt dieses vollständig — es gibt (noch)
          keine Möglichkeit, mehrere Turniere parallel zu speichern und zwischen ihnen zu wechseln.
        </Callout>
      </Section>

      <Section id="kurzreferenz" title="9. Kurzreferenz: Typischer Ablauf">
        <ol className="list-decimal pl-6 space-y-1">
          <li><strong>Teams</strong> → alle teilnehmenden Teams anlegen</li>
          <li><strong>Konfiguration</strong> → Modus „Einstufungsturnier" wählen, Rundenzahl/Felder/Halle festlegen, Zeitplan generieren</li>
          <li><strong>Ergebnisse erfassen</strong> → Runde für Runde Ergebnisse eintragen, auf „Nächste Runde auslosen" bzw. „Turnier abschließen" klicken</li>
          <li>Bei Bedarf: Team zurückziehen, vergangene Ergebnisse korrigieren</li>
          <li><strong>Turnierübersicht</strong> → laufende Tabelle verfolgen, am Ende ausdrucken</li>
          <li><strong>Export</strong> → Turnier als PDF/ZIP/JSON sichern</li>
        </ol>
      </Section>
      </div>
    </div>
  )
}
