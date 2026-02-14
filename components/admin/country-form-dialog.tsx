'use client'

import { useState } from 'react'
import { Country } from '@/types/database'
import { createCountry, updateCountry } from '@/app/actions/countries'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'

interface CountryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  country?: Country | null
}

export function CountryFormDialog({ open, onOpenChange, country }: CountryFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const isEdit = !!country

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    const result = isEdit ? await updateCountry(country.id, formData) : await createCountry(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      onOpenChange(false)
      router.refresh()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Country' : 'Add Country'}</DialogTitle>
          <DialogDescription>{isEdit ? 'Update country information.' : 'Add a new country to the database.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="iso_code">ISO Code <span className="text-destructive">*</span></Label>
              <Input id="iso_code" name="iso_code" defaultValue={country?.iso_code || ''} placeholder="US" required maxLength={2} pattern="[A-Z]{2}" className="font-mono uppercase" disabled={loading} onChange={(e) => { e.target.value = e.target.value.toUpperCase() }} />
              <p className="text-xs text-muted-foreground">2 uppercase letters</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Country Name <span className="text-destructive">*</span></Label>
              <Input id="name" name="name" defaultValue={country?.name || ''} placeholder="United States" required disabled={loading} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="region">Region <span className="text-destructive">*</span></Label>
              <Input id="region" name="region" defaultValue={country?.region || ''} placeholder="North America" required disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency <span className="text-destructive">*</span></Label>
              <Input id="currency" name="currency" defaultValue={country?.currency || ''} placeholder="USD" required className="font-mono uppercase" disabled={loading} onChange={(e) => { e.target.value = e.target.value.toUpperCase() }} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="icao_prefix">ICAO Prefix <span className="text-destructive">*</span></Label>
            <Input id="icao_prefix" name="icao_prefix" defaultValue={country?.icao_prefix || ''} placeholder="K" required className="font-mono uppercase" disabled={loading} onChange={(e) => { e.target.value = e.target.value.toUpperCase() }} />
            <p className="text-xs text-muted-foreground">ICAO location indicator prefix</p>
          </div>
          {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">{error}</div>}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Saving...' : isEdit ? 'Update Country' : 'Add Country'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
