import { useState } from 'react'
import { Button, TextInput } from '@bbv/dss-design-system/react'

interface TeamFormData {
  name: string
  abbreviation: string
  logoUrl: string
  color: string
  contact: string
}

interface Props {
  initial?: Omit<TeamFormData, 'abbreviation'> & { abbreviation?: string }
  onSubmit: (data: TeamFormData) => void
  onCancel?: () => void
}

export default function TeamForm({ initial, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<TeamFormData>({
    name: initial?.name ?? '',
    abbreviation: initial?.abbreviation ?? '',
    logoUrl: initial?.logoUrl ?? '',
    color: initial?.color ?? '#00569d',
    contact: initial?.contact ?? '',
  })

  const set = (field: keyof TeamFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <form aria-label="Team-Formular" onSubmit={handleSubmit} className="space-y-4">
      <TextInput id="team-name" label="Name" value={form.name} onChange={set('name')} required />
      <TextInput
        id="team-abbreviation"
        label="Kürzel (optional)"
        value={form.abbreviation}
        onChange={set('abbreviation')}
        maxLength={4}
        placeholder="z.B. TSM"
      />
      <TextInput id="team-logo" label="Logo-URL" value={form.logoUrl} onChange={set('logoUrl')} placeholder="https://..." />
      <div className="space-y-1">
        <label htmlFor="team-color" className="dss-field-label">Farbe</label>
        <div className="flex gap-2 items-center">
          <input
            id="team-color"
            type="color"
            value={form.color}
            onChange={set('color')}
            className="h-9 w-12 rounded border border-mute cursor-pointer"
          />
          <TextInput value={form.color} onChange={set('color')} fieldClassName="w-32" className="!font-mono" />
        </div>
      </div>
      <TextInput id="team-contact" label="Kontakt" value={form.contact} onChange={set('contact')} />
      <div className="flex gap-2">
        <Button type="submit">Speichern</Button>
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Abbrechen</Button>}
      </div>
    </form>
  )
}
