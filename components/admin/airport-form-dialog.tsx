'use client'

import { useState } from 'react'
import { Airport } from '@/types/database'
import { createAirport, updateAirportFields } from '@/app/actions/airports'
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

interface AirportFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  airport?: Airport | null
}

export function AirportFormDialog({ open, onOpenChange, airport }: AirportFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const isEdit = !!airport

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)

    try {
      const result = isEdit
        ? await updateAirportFields(airport.id, {
            icao_code: formData.get('icao_code') as string,
            iata_code: formData.get('iata_code') as string || null,
            name: formData.get('airport_name') as string,
            city: formData.get('city') as string,
            country: formData.get('country') as string,
            timezone: formData.get('timezone') as string,
          })
        : await createAirport(formData)

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
          <DialogTitle>{isEdit ? 'Edit Airport' : 'Add Airport'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the airport information below.'
              : 'Add a new airport to the reference database.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="icao_code">
                ICAO Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="icao_code"
                name="icao_code"
                defaultValue={airport?.icao_code || ''}
                placeholder="KJFK"
                required
                maxLength={4}
                pattern="[A-Z]{4}"
                className="font-mono uppercase"
                disabled={loading}
                onChange={(e) => {
                  e.target.value = e.target.value.toUpperCase()
                }}
              />
              <p className="text-xs text-muted-foreground">4 uppercase letters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="iata_code">IATA Code</Label>
              <Input
                id="iata_code"
                name="iata_code"
                defaultValue={airport?.iata_code || ''}
                placeholder="JFK"
                maxLength={3}
                pattern="[A-Z]{3}"
                className="font-mono uppercase"
                disabled={loading}
                onChange={(e) => {
                  e.target.value = e.target.value.toUpperCase()
                }}
              />
              <p className="text-xs text-muted-foreground">3 uppercase letters (optional)</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="airport_name">
              Airport Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="airport_name"
              name="airport_name"
              defaultValue={airport?.name || ''}
              placeholder="John F. Kennedy International Airport"
              required
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">
                City <span className="text-destructive">*</span>
              </Label>
              <Input
                id="city"
                name="city"
                defaultValue={airport?.city || ''}
                placeholder="New York"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">
                Country <span className="text-destructive">*</span>
              </Label>
              <Input
                id="country"
                name="country"
                defaultValue={airport?.country || ''}
                placeholder="United States"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">
              Timezone (IANA) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="timezone"
              name="timezone"
              defaultValue={airport?.timezone || ''}
              placeholder="America/New_York"
              required
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              IANA timezone (e.g., America/New_York, Europe/London, Asia/Tokyo)
            </p>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : isEdit ? 'Update Airport' : 'Add Airport'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
