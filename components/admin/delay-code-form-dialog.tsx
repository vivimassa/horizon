'use client'

import { useState } from 'react'
import { DelayCode } from '@/types/database'
import { createDelayCode, updateDelayCode } from '@/app/actions/delay-codes'
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

interface DelayCodeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  delayCode?: DelayCode | null
}

const CATEGORIES = [
  'airline_internal', 'passenger', 'cargo', 'mail', 'aircraft_ramp',
  'technical', 'operations', 'weather', 'atc', 'airport',
  'government', 'reactionary', 'miscellaneous',
] as const

const CATEGORY_LABELS: Record<string, string> = {
  airline_internal: 'Airline Internal',
  passenger: 'Passenger & Baggage',
  cargo: 'Cargo',
  mail: 'Mail',
  aircraft_ramp: 'Aircraft & Ramp',
  technical: 'Technical',
  operations: 'Operations & Crewing',
  weather: 'Weather',
  atc: 'ATC / ATFM',
  airport: 'Airport',
  government: 'Government',
  reactionary: 'Reactionary',
  miscellaneous: 'Miscellaneous',
}

export function DelayCodeFormDialog({ open, onOpenChange, delayCode }: DelayCodeFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const isEdit = !!delayCode

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)

    try {
      const result = isEdit
        ? await updateDelayCode(delayCode.id, formData)
        : await createDelayCode(formData)

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
          <DialogTitle>{isEdit ? 'Edit Delay Code' : 'Add Delay Code'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the delay code information.' : 'Add a new IATA delay code.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Code <span className="text-destructive">*</span></Label>
              <Input
                id="code" name="code"
                defaultValue={delayCode?.code || ''}
                placeholder="01" required maxLength={10}
                className="font-mono" disabled={loading}
              />
              <p className="text-xs text-muted-foreground">IATA delay code (01-99)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category <span className="text-destructive">*</span></Label>
              <select id="category" name="category" defaultValue={delayCode?.category || 'passenger'} required disabled={loading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
            <Input id="name" name="name" defaultValue={delayCode?.name || ''} placeholder="Late Passenger Check-in" required disabled={loading} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" defaultValue={delayCode?.description || ''} placeholder="Passengers arriving late at check-in counter" disabled={loading} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="is_active">Active</Label>
            <select id="is_active" name="is_active" defaultValue={delayCode?.is_active === false ? 'false' : 'true'} disabled={loading}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : isEdit ? 'Update Delay Code' : 'Add Delay Code'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
