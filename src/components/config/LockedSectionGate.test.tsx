import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LockedSectionGate } from './LockedSectionGate'

describe('LockedSectionGate', () => {
  it('renders children enabled and no banner when not locked', () => {
    render(
      <LockedSectionGate locked={false} unlocked={false} onUnlock={() => {}}>
        {(disabled) => <input aria-label="Feld" disabled={disabled} />}
      </LockedSectionGate>
    )
    expect(screen.getByLabelText('Feld')).toBeEnabled()
    expect(screen.queryByText(/Turnier läuft bereits/)).not.toBeInTheDocument()
  })

  it('renders children disabled and shows an unlock button when locked and not yet unlocked', () => {
    render(
      <LockedSectionGate locked onUnlock={() => {}} unlocked={false}>
        {(disabled) => <input aria-label="Feld" disabled={disabled} />}
      </LockedSectionGate>
    )
    expect(screen.getByLabelText('Feld')).toBeDisabled()
    expect(screen.getByText(/Turnier läuft bereits/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bearbeitung freischalten' })).toBeInTheDocument()
  })

  it('calls onUnlock when the unlock button is clicked, opening the confirm dialog', () => {
    const onUnlock = vi.fn()
    render(
      <LockedSectionGate locked onUnlock={onUnlock} unlocked={false}>
        {(disabled) => <input aria-label="Feld" disabled={disabled} />}
      </LockedSectionGate>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeitung freischalten' }))
    expect(onUnlock).toHaveBeenCalled()
  })

  it('renders children enabled without the banner once unlocked, even if locked', () => {
    render(
      <LockedSectionGate locked unlocked onUnlock={() => {}}>
        {(disabled) => <input aria-label="Feld" disabled={disabled} />}
      </LockedSectionGate>
    )
    expect(screen.getByLabelText('Feld')).toBeEnabled()
    expect(screen.queryByText(/Turnier läuft bereits/)).not.toBeInTheDocument()
  })
})
