'use client'

import { useState } from 'react'
import { AircraftType, Airport } from '@/types/database'
import { AircraftWithType, createAircraftRegistration, updateAircraftRegistration } from '@/app/actions/aircraft-registrations'
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

interface AircraftRegistrationFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  aircraft?: AircraftWithType | null
  aircraftTypes: AircraftType[]
  airports: Airport[]
}

const STATUSES = ['active', 'maintenance', 'stored', 'retired'] as const

export function AircraftRegistrationFormDialog({
  open, onOpenChange, aircraft, aircraftTypes, airports
}: AircraftRegistrationFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [seatingConfig, setSeatingConfig] = useState(
    aircraft?.seating_config ? JSON.stringify(aircraft.seating_config, null, 2) : ''
  )
  const router = useRouter()

  const isEdit = !!aircraft

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.set('seating_config', seatingConfig)

    try {
      const result = isEdit
        ? await updateAircraftRegistration(aircraft.id, formData)
        : await createAircraftRegistration(formData)

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
          <DialogTitle>{isEdit ? 'Edit Aircraft' : 'Add Aircraft'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the aircraft registration details.' : 'Register a new aircraft in the fleet.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="registration">Registration <span className="text-destructive">*</span></Label>
              <Input
                id="registration" name="registration"
                defaultValue={aircraft?.registration || ''}
                placeholder="VN-A123" required
                className="font-mono uppercase" disabled={loading}
                onChange={(e) => { e.target.value = e.target.value.toUpperCase() }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select id="status" name="status" defaultValue={aircraft?.status || 'active'} disabled={loading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="aircraft_type_id">Aircraft Type <span className="text-destructive">*</span></Label>
              <select id="aircraft_type_id" name="aircraft_type_id" defaultValue={aircraft?.aircraft_type_id || ''} required disabled={loading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <option value="">Select type...</option>
                {aircraftTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.icao_type} — {t.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="home_base_id">Home Base</Label>
              <select id="home_base_id" name="home_base_id" defaultValue={aircraft?.home_base_id || ''} disabled={loading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <option value="">None</option>
                {airports.map(a => (
                  <option key={a.id} value={a.id}>{a.icao_code} — {a.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="seating_config_input">Cabin Config Override</Label>
            <textarea
              id="seating_config_input"
              value={seatingConfig}
              onChange={(e) => setSeatingConfig(e.target.value)}
              placeholder='{"Y": 180}'
              rows={3}
              disabled={loading}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use aircraft type default. JSON format: {`{"Y": 180, "J": 12}`}
            </p>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : isEdit ? 'Update Aircraft' : 'Add Aircraft'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
