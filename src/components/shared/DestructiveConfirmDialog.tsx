import { useEffect, useState } from 'react'
import { Modal, Button, TextInput } from '@bbv/dss-design-system/react'

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
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      severity="danger"
      dismissOnBackdrop={false}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button variant="danger" disabled={!canConfirm} onClick={onConfirm}>
            Bestätigen
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p>{description}</p>
        <TextInput
          id="destructive-confirm-input"
          label={`Bestätigungswort „${confirmWord}“ eintippen`}
          value={typed}
          onChange={e => setTyped(e.target.value)}
          autoComplete="off"
        />
      </div>
    </Modal>
  )
}
