import type { ReactNode } from 'react'
import { Banner, Button } from '@bbv/dss-design-system/react'

interface LockedSectionGateProps {
  locked: boolean
  unlocked: boolean
  onUnlock: () => void
  children: (disabled: boolean) => ReactNode
}

export function LockedSectionGate({ locked, unlocked, onUnlock, children }: LockedSectionGateProps) {
  const showBanner = locked && !unlocked
  const disabled = showBanner

  return (
    <div className="space-y-3">
      {showBanner && (
        <Banner severity="warn" role="status">
          <div className="flex items-center justify-between gap-3">
            <span>Turnier läuft bereits — Änderungen können den bisherigen Verlauf beeinträchtigen.</span>
            <Button size="sm" variant="ghost" onClick={onUnlock}>
              Bearbeitung freischalten
            </Button>
          </div>
        </Banner>
      )}
      {children(disabled)}
    </div>
  )
}
