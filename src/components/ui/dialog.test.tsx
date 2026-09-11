import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog'

describe('DialogContent', () => {
  it('does not close when clicking outside the content', async () => {
    const onOpenChange = vi.fn()
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader><DialogTitle>Test</DialogTitle></DialogHeader>
          <p>Inhalt</p>
        </DialogContent>
      </Dialog>
    )
    expect(screen.getByText('Inhalt')).toBeInTheDocument()

    // Radix registriert seinen pointerdown-Listener erst nach einem Tick (setTimeout 0)
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Klick auf das Overlay (Radix rendert es als eigenes Element außerhalb von DialogContent)
    const overlay = document.querySelector('[data-radix-dialog-overlay], .fixed.inset-0')
    expect(overlay).toBeTruthy()
    fireEvent.pointerDown(overlay!)
    fireEvent.pointerUp(overlay!)
    fireEvent.click(overlay!)

    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(screen.getByText('Inhalt')).toBeInTheDocument()
  })

  it('still closes via the explicit close button', () => {
    const onOpenChange = vi.fn()
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader><DialogTitle>Test</DialogTitle></DialogHeader>
          <p>Inhalt</p>
        </DialogContent>
      </Dialog>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
