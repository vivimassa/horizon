'use client'

import { useState } from 'react'
import { AircraftType } from '@/types/database'
import { createAircraftType, updateAircraftType } from '@/app/actions/aircraft-types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'

interface AircraftTypeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  aircraftType?: AircraftType | null
}

const CATEGORIES = [
  'narrow-body', 'wide-body', 'regional', 'turboprop', 'freighter', 'business',
] as const

export function AircraftTypeFormDialog({ open, onOpenChange, aircraftType }: AircraftTypeFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cabinConfig, setCabinConfig] = useState<{ class: string; seats: string }[]>(
    aircraftType?.default_cabin_config
      ? Object.entries(aircraftType.default_cabin_config).map(([cls, seats]) => ({ class: cls, seats: String(seats) }))
      : [{ class: '', seats: '' }]
  )
  const router = useRouter()

  const isEdit = !!aircraftType

  function addCabinRow() {
    setCabinConfig([...cabinConfig, { class: '', seats: '' }])
  }

  function removeCabinRow(index: number) {
    setCabinConfig(cabinConfig.filter((_, i) => i !== index))
  }

  function updateCabinRow(index: number, field: 'class' | 'seats', value: string) {
    const updated = [...cabinConfig]
    updated[index] = { ...updated[index], [field]: field === 'class' ? value.toUpperCase() : value }
    setCabinConfig(updated)
  }

  function buildCabinConfigJson(): string {
    const obj: Record<string, number> = {}
    for (const row of cabinConfig) {
      if (row.class && row.seats) {
        obj[row.class] = parseInt(row.seats) || 0
      }
    }
    return Object.keys(obj).length > 0 ? JSON.stringify(obj) : ''
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.set('default_cabin_config', buildCabinConfigJson())

    try {
      const result = isEdit
        ? await updateAircraftType(aircraftType.id, formData)
        : await createAircraftType(formData)

      if (result?.error) {
        setError(result.error)
        setLoading(false)
      } else {
        onOpenChange(false)
        router.refresh()
      }
    } catch {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Aircraft Type' : 'Add Aircraft Type'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the aircraft type information below.' : 'Add a new aircraft type to the catalogue.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="icao_type">ICAO Type <span className="text-destructive">*</span></Label>
              <Input
                id="icao_type" name="icao_type"
                defaultValue={aircraftType?.icao_type || ''}
                placeholder="A320" required maxLength={4}
                className="font-mono uppercase" disabled={loading}
                onChange={(e) => { e.target.value = e.target.value.toUpperCase() }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="iata_type">IATA Type</Label>
              <Input
                id="iata_type" name="iata_type"
                defaultValue={aircraftType?.iata_type || ''}
                placeholder="320" maxLength={3}
                className="font-mono uppercase" disabled={loading}
                onChange={(e) => { e.target.value = e.target.value.toUpperCase() }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
            <Input id="name" name="name" defaultValue={aircraftType?.name || ''} placeholder="Airbus A320" required disabled={loading} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="family">Family <span className="text-destructive">*</span></Label>
              <Input id="family" name="family" defaultValue={aircraftType?.family || ''} placeholder="A320" required disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category <span className="text-destructive">*</span></Label>
              <select id="category" name="category" defaultValue={aircraftType?.category || 'narrow-body'} disabled={loading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pax_capacity">Pax Capacity <span className="text-destructive">*</span></Label>
              <Input id="pax_capacity" name="pax_capacity" type="number" defaultValue={aircraftType?.pax_capacity || ''} required disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cockpit_crew">Cockpit Crew <span className="text-destructive">*</span></Label>
              <Input id="cockpit_crew" name="cockpit_crew" type="number" defaultValue={aircraftType?.cockpit_crew_required || ''} required disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cabin_crew">Cabin Crew <span className="text-destructive">*</span></Label>
              <Input id="cabin_crew" name="cabin_crew" type="number" defaultValue={aircraftType?.cabin_crew_required || ''} disabled={loading} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="default_tat_minutes">Default Turn Around Time (minutes)</Label>
            <Input id="default_tat_minutes" name="default_tat_minutes" type="number" defaultValue={aircraftType?.default_tat_minutes ?? ''} placeholder="45" disabled={loading} />
            <p className="text-xs text-muted-foreground">Default Turn Around Time in minutes</p>
          </div>

          <div className="space-y-3">
            <Label>Default Cabin Config</Label>
            <p className="text-xs text-muted-foreground">Define cabin classes and seat counts</p>
            {cabinConfig.map((row, i) => (
              <div key={i} className="flex items-center gap-3">
                <Input value={row.class} onChange={(e) => updateCabinRow(i, 'class', e.target.value)}
                  placeholder="Y" maxLength={1} className="font-mono uppercase w-20" disabled={loading} />
                <Input value={row.seats} onChange={(e) => updateCabinRow(i, 'seats', e.target.value)}
                  placeholder="180" type="number" className="w-28" disabled={loading} />
                <Button type="button" variant="ghost" size="sm" onClick={() => removeCabinRow(i)} disabled={loading || cabinConfig.length <= 1}>
                  <span className="text-destructive">Remove</span>
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addCabinRow} disabled={loading}>
              Add Cabin Class
            </Button>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : isEdit ? 'Update Aircraft Type' : 'Add Aircraft Type'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
