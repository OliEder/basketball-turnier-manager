import type { AppNavItem, AppNavLink } from '@bbv/dss-design-system/react'
import type { Schedule, TournamentConfig } from '@/types'

export const SCHEDULE_REQUIRED_HINT = 'Bitte zuerst einen Zeitplan generieren'

interface NavigationInput {
  tournament: TournamentConfig
  schedule: Schedule | null
  /** Präfix für alle Pfade; später `/turniere/:id` für die Mehrturnier-Version (ADR-13). */
  basePath?: string
}

/** Baut die gruppierte Hauptnavigation für `AppNav` aus Turniermodus, Endrunden-Variante und Zeitplan-Zustand. */
export function buildNavigation({ tournament, schedule, basePath = '' }: NavigationInput): AppNavItem[] {
  const hasSchedule = !!schedule && schedule.games.length > 0
  const isSwiss = tournament.mode === 'swiss'
  const variant = tournament.mode === 'round-robin+finals' ? tournament.finalsVariant : undefined
  const hasMultipleGroups = new Set(tournament.teams.map((t) => t.groupId ?? 'A')).size > 1

  const link = (id: string, label: string, path: string, needsSchedule = false): AppNavLink => ({
    id,
    label,
    href: `${basePath}${path}`,
    ...(needsSchedule && !hasSchedule ? { disabled: true, hint: SCHEDULE_REQUIRED_HINT } : {}),
  })

  const play: AppNavLink[] = isSwiss
    ? [link('results', 'Ergebnisse erfassen', '/swiss-results', true)]
    : [
        link('results', 'Ergebnisse erfassen', '/group-results', true),
        ...(variant === 'endrunde-4' ? [link('finals-results', 'Endrunde: Ergebnisse', '/finals-results', true)] : []),
        ...(variant === 'endrunde-3' ? [link('playoff-results', 'Endrunde: KO-Ergebnisse', '/playoff-results', true)] : []),
        ...(variant === 'endrunde-1' ? [link('bracket-results', 'Endrunde: K.-o.-Ergebnisse', '/bracket-results', true)] : []),
      ]

  const view: AppNavLink[] = isSwiss
    ? [link('overview', 'Turnierübersicht', '/swiss-overview', true)]
    : [
        link('schedule', 'Zeitplan', '/schedule', true),
        ...(hasMultipleGroups ? [link('group-overview', 'Gruppentabellen', '/group-overview', true)] : []),
        ...(variant === 'endrunde-4' || variant === 'endrunde-1'
          ? [link('final-standings', 'Endstand', '/final-standings', true)]
          : []),
      ]

  return [
    { id: 'prepare', label: 'Vorbereiten', items: [link('teams', 'Teams', '/teams'), link('config', 'Konfiguration', '/config')] },
    { id: 'play', label: 'Spielen', items: play },
    { id: 'view', label: 'Ansehen', items: view },
    link('export', 'Export', '/export'),
    {
      id: 'help',
      label: 'Hilfe',
      items: [link('manual', 'Anleitung', '/anleitung'), link('demos', 'Demo-Turniere', '/demos')],
    },
  ]
}
