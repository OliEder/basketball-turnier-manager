import { Link, Outlet, useLocation } from 'react-router-dom'
import { AppNav, TopBar } from '@bbv/dss-design-system/react'
import { useTournamentStore } from '@/store/tournament-store'
import { buildNavigation } from '@/lib/navigation'

export default function AppShell() {
  const { tournament, schedule } = useTournamentStore()
  const { pathname } = useLocation()
  const items = buildNavigation({ tournament, schedule })

  return (
    <div className="min-h-screen bg-page text-fg">
      <TopBar as="header" brand="Basketball Turnier-Manager" mark="T" />
      <AppNav
        items={items}
        currentHref={pathname}
        ariaLabel="Hauptnavigation"
        renderLink={({ item, className, ariaCurrent, onNavigate, children }) => (
          <Link to={item.href} className={className} aria-current={ariaCurrent} onClick={onNavigate}>
            {children}
          </Link>
        )}
      />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
