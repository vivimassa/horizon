'use client'

import { useState } from 'react'
import { Country } from '@/types/database'
import { createCountry, updateCountry } from '@/app/actions/countries'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useRouter } from 'next/navigation'

const REGIONS = ['Asia', 'Europe', 'Americas', 'Africa', 'Oceania', 'Middle East'] as const

interface CountryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  country?: Country | null
}

export function CountryFormDialog({ open, onOpenChange, country }: CountryFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [region, setRegion] = useState(country?.region || '')
  const router = useRouter()
  const isEdit = !!country

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('region', region)
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Country' : 'Add Country'}</DialogTitle>
          <DialogDescription>{isEdit ? 'Update country information.' : 'Add a new country to the database.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: ISO Code + Name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="iso_code">ISO Code (Alpha-2) <span className="text-destructive">*</span></Label>
              <Input id="iso_code" name="iso_code" defaultValue={country?.iso_code_2 || ''} placeholder="US" required maxLength={2} pattern="[A-Z]{2}" className="font-mono uppercase" disabled={loading} onChange={(e) => { e.target.value = e.target.value.toUpperCase() }} />
              <p className="text-xs text-muted-foreground">2 uppercase letters</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Country Name <span className="text-destructive">*</span></Label>
              <Input id="name" name="name" defaultValue={country?.name || ''} placeholder="United States" required disabled={loading} />
            </div>
          </div>

          {/* Row 1.5: Official Name */}
          <div className="space-y-2">
            <Label htmlFor="official_name">Official Name</Label>
            <Input id="official_name" name="official_name" defaultValue={country?.official_name || ''} placeholder="e.g. Socialist Republic of Vietnam" disabled={loading} />
            <p className="text-xs text-muted-foreground">Full formal name (optional, falls back to country name)</p>
          </div>

          {/* Row 2: Region + ICAO Prefix */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Region <span className="text-destructive">*</span></Label>
              <Select value={region} onValueChange={setRegion} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="icao_prefix">ICAO Prefix <span className="text-destructive">*</span></Label>
              <Input id="icao_prefix" name="icao_prefix" defaultValue={country?.icao_prefix || ''} placeholder="K" required className="font-mono uppercase" disabled={loading} onChange={(e) => { e.target.value = e.target.value.toUpperCase() }} />
            </div>
          </div>

          {/* Row 3: Currency Code + Currency Name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency Code <span className="text-destructive">*</span></Label>
              <Input id="currency" name="currency" defaultValue={country?.currency_code || ''} placeholder="USD" required className="font-mono uppercase" disabled={loading} onChange={(e) => { e.target.value = e.target.value.toUpperCase() }} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency_name">Currency Name</Label>
              <Input id="currency_name" name="currency_name" defaultValue={country?.currency_name || ''} placeholder="US Dollar" disabled={loading} />
            </div>
          </div>

          {/* Row 4: Currency Symbol + Phone Code */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency_symbol">Currency Symbol</Label>
              <Input id="currency_symbol" name="currency_symbol" defaultValue={country?.currency_symbol || ''} placeholder="$" disabled={loading} className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone_code">Phone Code</Label>
              <Input id="phone_code" name="phone_code" defaultValue={country?.phone_code || ''} placeholder="+1" disabled={loading} className="font-mono" />
            </div>
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
