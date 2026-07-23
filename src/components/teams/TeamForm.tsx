import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface TeamFormData {
  name: string
  logoUrl: string
  color: string
  contact: string
}

interface Props {
  initial?: TeamFormData
  onSubmit: (data: TeamFormData) => void
  onCancel?: () => void
}

export default function TeamForm({ initial, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<TeamFormData>({
    name: initial?.name ?? '',
    logoUrl: initial?.logoUrl ?? '',
    color: initial?.color ?? '#004174',
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
      <div className="space-y-1">
        <Label htmlFor="team-name">Name</Label>
        <Input id="team-name" value={form.name} onChange={set('name')} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="team-logo">Logo-URL</Label>
        <Input id="team-logo" value={form.logoUrl} onChange={set('logoUrl')} placeholder="https://..." />
      </div>
      <div className="space-y-1">
        <Label htmlFor="team-color">Farbe</Label>
        <div className="flex gap-2 items-center">
          <input
            id="team-color"
            type="color"
            value={form.color}
            onChange={set('color')}
            className="h-9 w-12 rounded border border-border-ui cursor-pointer"
          />
          <Input value={form.color} onChange={set('color')} className="w-32 font-mono" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="team-contact">Kontakt</Label>
        <Input id="team-contact" value={form.contact} onChange={set('contact')} />
      </div>
      <div className="flex gap-2">
        <Button type="submit">Speichern</Button>
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>}
      </div>
    </form>
  )
}
