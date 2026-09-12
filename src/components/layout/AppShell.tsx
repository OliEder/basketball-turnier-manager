import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useTournamentStore } from '@/store/tournament-store'

export default function AppShell() {
  const { tournament, schedule } = useTournamentStore()
  const isSwiss = tournament.mode === 'swiss'
  const hasSchedule = !!schedule && schedule.games.length > 0
  const hasMultipleGroups = new Set(tournament.teams.map((t) => t.groupId ?? 'A')).size > 1

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
        ]),
    { to: '/export', label: 'Export', gated: false },
    { to: '/anleitung', label: 'Anleitung', gated: false },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-brand-primary-dark text-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-6">
          <span className="font-display text-lg uppercase tracking-tight">
            Basketball Turnier-Manager
          </span>
          <nav className="flex gap-1">
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
