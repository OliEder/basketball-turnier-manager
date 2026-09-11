import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog'
import { Button } from './button'
import { Input } from './input'
import { Label } from './label'

interface DestructiveConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmWord: string
  onConfirm: () => void
}

export function DestructiveConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmWord,
  onConfirm,
}: DestructiveConfirmDialogProps) {
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (open) setTyped('')
  }, [open])

  const canConfirm = typed === confirmWord

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm">{description}</p>
          <div className="space-y-1">
            <Label htmlFor="destructive-confirm-input">
              Bestätigungswort „{confirmWord}“ eintippen
            </Label>
            <Input
              id="destructive-confirm-input"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button variant="destructive" disabled={!canConfirm} onClick={onConfirm}>
              Bestätigen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
