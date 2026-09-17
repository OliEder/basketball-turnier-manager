import { Button } from '@/components/ui/button'
import { openManualPrintWindow } from '@/lib/export/manual-print-export'
import manualMarkdown from '@/content/manual.md?raw'
import { tokenizeManualMarkdown } from '@/lib/markdown-tokens'
import { renderManualMarkdownToJsx } from '@/lib/manual-markdown-jsx'

const TOC_ITEMS = [
  { id: 'kurzreferenz', title: '1. Kurzreferenz: Typischer Ablauf' },
  { id: 'ueberblick', title: '2. Überblick' },
  { id: 'teams', title: '3. Teams anlegen' },
  {
    id: 'konfiguration',
    title: '4. Turnier konfigurieren',
    children: [
      { id: 'konfiguration-gruppen', title: '4.1 Jeder gegen Jeden und Gruppenphase: Gruppen & Rückrunde' },
      { id: 'konfiguration-gruppenergebnisse', title: '4.2 Jeder gegen Jeden und Gruppenphase: Ergebnisse erfassen' },
    ],
  },
  {
    id: 'ergebnisse',
    title: '5. Ergebnisse erfassen',
    children: [
      { id: 'ergebnisse-zurueckziehen', title: '5.1 Sonderfall: Ein Team zieht sich zurück' },
      { id: 'ergebnisse-korrigieren', title: '5.2 Vergangene Runden ansehen und Ergebnisse korrigieren' },
      { id: 'ergebnisse-manuelle-paarung', title: '5.3 Automatische Paarung nicht möglich' },
    ],
  },
  {
    id: 'turnieruebersicht',
    title: '6. Turnierübersicht',
    children: [
      { id: 'turnieruebersicht-gruppentabellen', title: '6.1 Gruppentabellen (bei mehreren Gruppen)' },
    ],
  },
  { id: 'aenderungsschutz', title: '7. Turnier läuft bereits: Änderungsschutz' },
  { id: 'export', title: '8. Export' },
  { id: 'import', title: '9. Turnier importieren (JSON)' },
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
    <div id="top" className="space-y-10 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-display text-2xl uppercase text-brand-primary">
          Nutzeranleitung: Basketball Turnier-Manager
        </h1>
        <Button onClick={() => void openManualPrintWindow()} className="shrink-0">
          Als PDF herunterladen
        </Button>
      </div>

      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-6 right-6 z-40 rounded-full bg-brand-primary text-white shadow-lg px-4 py-3 text-sm font-semibold uppercase tracking-wide hover:bg-brand-primary-light transition-colors"
        aria-label="Nach oben"
      >
        ↑ Nach oben
      </button>

      <TableOfContents />

      <div id="manual-content" className="space-y-10">
        {renderManualMarkdownToJsx(tokenizeManualMarkdown(manualMarkdown))}
      </div>
    </div>
  )
}
