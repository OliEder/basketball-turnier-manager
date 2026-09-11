import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DestructiveConfirmDialog } from './destructive-confirm-dialog'

describe('DestructiveConfirmDialog', () => {
  it('keeps the confirm button disabled until the exact confirmation word is typed', () => {
    const onConfirm = vi.fn()
    render(
      <DestructiveConfirmDialog
        open
        onOpenChange={() => {}}
        title="Änderung bestätigen"
        description="Das Turnier läuft bereits. Diese Änderung kann den Verlauf beeinträchtigen."
        confirmWord="ÄNDERN"
        onConfirm={onConfirm}
      />
    )

    const confirmButton = screen.getByRole('button', { name: /bestätigen/i })
    expect(confirmButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/bestätigungswort/i), { target: { value: 'falsch' } })
    expect(confirmButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/bestätigungswort/i), { target: { value: 'ÄNDERN' } })
    expect(confirmButton).toBeEnabled()

    fireEvent.click(confirmButton)
    expect(onConfirm).toHaveBeenCalled()
  })

  it('calls onOpenChange(false) and does not call onConfirm when cancelled', () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <DestructiveConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Änderung bestätigen"
        description="Text"
        confirmWord="ÄNDERN"
        onConfirm={onConfirm}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('resets the typed word when reopened', () => {
    const onConfirm = vi.fn()
    const { rerender } = render(
      <DestructiveConfirmDialog
        open
        onOpenChange={() => {}}
        title="t" description="d" confirmWord="ÄNDERN"
        onConfirm={onConfirm}
      />
    )
    fireEvent.change(screen.getByLabelText(/bestätigungswort/i), { target: { value: 'ÄNDERN' } })
    expect(screen.getByRole('button', { name: /bestätigen/i })).toBeEnabled()

    rerender(
      <DestructiveConfirmDialog
        open={false}
        onOpenChange={() => {}}
        title="t" description="d" confirmWord="ÄNDERN"
        onConfirm={onConfirm}
      />
    )
    rerender(
      <DestructiveConfirmDialog
        open
        onOpenChange={() => {}}
        title="t" description="d" confirmWord="ÄNDERN"
        onConfirm={onConfirm}
      />
    )
    expect(screen.getByRole('button', { name: /bestätigen/i })).toBeDisabled()
  })
})
