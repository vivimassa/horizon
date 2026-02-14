'use client'

import { useState } from 'react'
import { ServiceType } from '@/types/database'
import { createServiceType, updateServiceType } from '@/app/actions/service-types'
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

interface ServiceTypeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  serviceType?: ServiceType | null
}

export function ServiceTypeFormDialog({ open, onOpenChange, serviceType }: ServiceTypeFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [color, setColor] = useState(serviceType?.color || '#6B9DAD')
  const router = useRouter()

  const isEdit = !!serviceType

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)

    try {
      const result = isEdit
        ? await updateServiceType(serviceType.id, formData)
        : await createServiceType(formData)

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
          <DialogTitle>{isEdit ? 'Edit Service Type' : 'Add Service Type'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the service type information below.'
              : 'Add a new IATA service type code.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">
                Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="code"
                name="code"
                defaultValue={serviceType?.code || ''}
                placeholder="J"
                required
                maxLength={1}
                className="font-mono uppercase"
                disabled={loading}
                onChange={(e) => {
                  e.target.value = e.target.value.toUpperCase()
                }}
              />
              <p className="text-xs text-muted-foreground">Single character</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                defaultValue={serviceType?.name || ''}
                placeholder="Scheduled Passenger"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              name="description"
              defaultValue={serviceType?.description || ''}
              placeholder="Normal scheduled passenger service"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Color</Label>
            <div className="flex items-center gap-3">
              <Input
                id="color"
                name="color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={loading}
                className="w-16 h-10 p-1 cursor-pointer"
              />
              <span className="text-sm font-mono text-muted-foreground">{color}</span>
            </div>
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
              {loading ? 'Saving...' : isEdit ? 'Update Service Type' : 'Add Service Type'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
