import type { ReactNode } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@bbv/dss-design-system/react'

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
        <Alert>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>Turnier läuft bereits — Änderungen können den bisherigen Verlauf beeinträchtigen.</span>
            <Button size="sm" variant="ghost" onClick={onUnlock}>
              Bearbeitung freischalten
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {children(disabled)}
    </div>
  )
}
