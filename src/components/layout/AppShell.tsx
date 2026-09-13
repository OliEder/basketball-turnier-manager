import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useTournamentStore } from '@/store/tournament-store'

export default function AppShell() {
  const { tournament, schedule } = useTournamentStore()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const isSwiss = tournament.mode === 'swiss'
  const hasSchedule = !!schedule && schedule.games.length > 0
  const hasMultipleGroups = new Set(tournament.teams.map((t) => t.groupId ?? 'A')).size > 1
  const isRoundRobinFinals = tournament.mode === 'round-robin+finals'

  const navItems = [
    { to: '/teams', label: 'Teams', gated: false },
    { to: '/config', label: 'Konfiguration', gated: false },
    ...(isSwiss
      ? [
          { to: '/swiss-results', label: 'Ergebnisse erfassen', gated: true },
          { to: '/swiss-overview', label: 'Turnierübersicht', gated: true },
        ]
      : [
          { to: '/schedule', label: 'Zeitplan', gated: true },
          { to: '/group-results', label: 'Ergebnisse erfassen', gated: true },
          ...(hasMultipleGroups
            ? [{ to: '/group-overview', label: 'Gruppentabellen', gated: true }]
            : []),
          ...(isRoundRobinFinals && tournament.finalsVariant === 'endrunde-4'
            ? [
                { to: '/finals-results', label: 'Endrunde: Ergebnisse', gated: true },
                { to: '/final-standings', label: 'Endstand', gated: true },
              ]
            : []),
          ...(isRoundRobinFinals && tournament.finalsVariant === 'endrunde-3'
            ? [{ to: '/playoff-results', label: 'Endrunde: KO-Ergebnisse', gated: true }]
            : []),
          ...(isRoundRobinFinals && tournament.finalsVariant === 'endrunde-1'
            ? [
                { to: '/bracket-results', label: 'Endrunde: K.-o.-Ergebnisse', gated: true },
                { to: '/final-standings', label: 'Endstand', gated: true },
              ]
            : []),
        ]),
    { to: '/export', label: 'Export', gated: false },
    { to: '/anleitung', label: 'Anleitung', gated: false },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-brand-primary-dark text-white">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <span className="font-display text-lg uppercase tracking-tight">
              Basketball Turnier-Manager
            </span>
            <button
              type="button"
              className="md:hidden rounded-sm p-2 text-white/80 hover:text-white hover:bg-white/10"
              aria-label={isMenuOpen ? 'Menü schließen' : 'Menü öffnen'}
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen(open => !open)}
            >
              <span className="sr-only">{isMenuOpen ? 'Menü schließen' : 'Menü öffnen'}</span>
              <svg
                width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"
              >
                {isMenuOpen ? (
                  <path d="M6 6l12 12M18 6L6 18" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" />
                )}
              </svg>
            </button>
          </div>
          <nav
            aria-label="Hauptnavigation"
            className={cn(
              'flex flex-col gap-1 pt-3 md:flex-row md:pt-0 md:mt-3',
              isMenuOpen ? 'flex' : 'hidden md:flex',
            )}
          >
            {navItems.map(({ to, label, gated }) =>
              gated && !hasSchedule ? (
                <span
                  key={to}
                  aria-disabled="true"
                  title="Bitte zuerst einen Zeitplan generieren"
                  className="px-3 py-1.5 rounded-sm text-sm font-medium text-white/40 cursor-not-allowed"
                >
                  {label}
                </span>
              ) : (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setIsMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'px-3 py-1.5 rounded-sm text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-brand-accent text-brand-primary-dark'
                        : 'text-white/80 hover:text-white hover:bg-white/10',
                    )
                  }
                >
                  {label}
                </NavLink>
              )
            )}
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
