'use client'

import { useState } from 'react'
import { CabinConfiguration, CabinEntry } from '@/types/database'
import { createCabinConfiguration, updateCabinConfiguration } from '@/app/actions/cabin-configurations'
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
import { Plus, Trash2 } from 'lucide-react'

interface CabinConfigurationFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config?: CabinConfiguration | null
}

export function CabinConfigurationFormDialog({ open, onOpenChange, config }: CabinConfigurationFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cabins, setCabins] = useState<CabinEntry[]>(
    config?.cabins?.length ? config.cabins : [{ class: '', seats: 0 }]
  )
  const router = useRouter()

  const isEdit = !!config

  const totalSeats = cabins.reduce((sum, c) => sum + (c.seats || 0), 0)

  function addCabin() {
    setCabins([...cabins, { class: '', seats: 0 }])
  }

  function removeCabin(index: number) {
    setCabins(cabins.filter((_, i) => i !== index))
  }

  function updateCabin(index: number, field: keyof CabinEntry, value: string | number) {
    const updated = [...cabins]
    if (field === 'class') {
      updated[index] = { ...updated[index], class: (value as string).toUpperCase() }
    } else {
      updated[index] = { ...updated[index], seats: Number(value) || 0 }
    }
    setCabins(updated)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.set('cabins', JSON.stringify(cabins))

    try {
      const result = isEdit
        ? await updateCabinConfiguration(config.id, formData)
        : await createCabinConfiguration(formData)

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
          <DialogTitle>{isEdit ? 'Edit Cabin Configuration' : 'Add Cabin Configuration'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the cabin configuration below.'
              : 'Define a new seat configuration for an aircraft type.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="aircraft_type">
                Aircraft Type <span className="text-destructive">*</span>
              </Label>
              <Input
                id="aircraft_type"
                name="aircraft_type"
                defaultValue={config?.aircraft_type || ''}
                placeholder="A320"
                required
                className="font-mono uppercase"
                disabled={loading}
                onChange={(e) => {
                  e.target.value = e.target.value.toUpperCase()
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">
                Config Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                defaultValue={config?.name || ''}
                placeholder="Standard"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Cabins</Label>
              <span className="text-sm text-muted-foreground">
                Total: <span className="font-semibold">{totalSeats}</span> seats
              </span>
            </div>

            {cabins.map((cabin, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="space-y-1 flex-1">
                  {index === 0 && <span className="text-xs text-muted-foreground">Class</span>}
                  <Input
                    value={cabin.class}
                    onChange={(e) => updateCabin(index, 'class', e.target.value)}
                    placeholder="J"
                    maxLength={1}
                    className="font-mono uppercase"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-1 flex-1">
                  {index === 0 && <span className="text-xs text-muted-foreground">Seats</span>}
                  <Input
                    type="number"
                    value={cabin.seats || ''}
                    onChange={(e) => updateCabin(index, 'seats', e.target.value)}
                    placeholder="0"
                    min={0}
                    disabled={loading}
                  />
                </div>
                <div className={index === 0 ? 'mt-5' : ''}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCabin(index)}
                    disabled={loading || cabins.length <= 1}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCabin}
              disabled={loading}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Cabin
            </Button>
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
              {loading ? 'Saving...' : isEdit ? 'Update Configuration' : 'Add Configuration'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
