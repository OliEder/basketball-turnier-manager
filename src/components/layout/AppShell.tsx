import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useTournamentStore } from '@/store/tournament-store'

export default function AppShell() {
  const { tournament } = useTournamentStore()
  const isSwiss = tournament.mode === 'swiss'

  const navItems = [
    { to: '/teams', label: 'Teams' },
    { to: '/config', label: 'Konfiguration' },
    ...(isSwiss
      ? [
          { to: '/swiss-results', label: 'Ergebnisse erfassen' },
          { to: '/swiss-overview', label: 'Turnierübersicht' },
        ]
      : [{ to: '/schedule', label: 'Zeitplan' }]),
    { to: '/export', label: 'Export' },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-brand-primary-dark text-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-6">
          <span className="font-display text-lg uppercase tracking-tight">
            FBNM Turniermanager
          </span>
          <nav className="flex gap-1">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'px-3 py-1.5 rounded-sm text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-white text-brand-primary'
                      : 'text-white/80 hover:text-white hover:bg-white/10',
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
