'use client'

import { useState, useRef } from 'react'
import { OperatorProfile, updateOperatorProfile, uploadOperatorLogo, removeOperatorLogo } from '@/app/actions/operator-profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'
import { Building2, Upload, X } from 'lucide-react'

interface OperatorProfileFormProps {
  profile: OperatorProfile
}

export function OperatorProfileForm({ profile }: OperatorProfileFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(profile.logo_url)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    const formData = new FormData(e.currentTarget)
    const result = await updateOperatorProfile(profile.id, formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
      router.refresh()
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setLogoUploading(true)
    setError(null)

    const formData = new FormData()
    formData.set('logo', file)

    const result = await uploadOperatorLogo(profile.id, formData)

    if (result?.error) {
      setError(result.error)
    } else if (result?.logoUrl) {
      setCurrentLogoUrl(result.logoUrl)
    }

    setLogoUploading(false)
    router.refresh()

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleLogoRemove() {
    setLogoUploading(true)
    setError(null)

    const result = await removeOperatorLogo(profile.id)

    if (result?.error) {
      setError(result.error)
    } else {
      setCurrentLogoUrl(null)
    }

    setLogoUploading(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Logo Upload Section */}
      <div className="space-y-2">
        <Label>Airline Logo</Label>
        <div className="flex items-center gap-4">
          <div className="w-48 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30">
            {currentLogoUrl ? (
              <img
                src={currentLogoUrl}
                alt="Operator logo"
                className="max-w-full max-h-full object-contain p-1.5"
              />
            ) : (
              <Building2 className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={logoUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-1.5" />
                {logoUploading ? 'Uploading...' : 'Upload Logo'}
              </Button>
              {currentLogoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={logoUploading}
                  onClick={handleLogoRemove}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4 mr-1" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              JPG, PNG, or SVG. Max 2MB.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.svg"
            className="hidden"
            onChange={handleLogoUpload}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="company_name">
            Company Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="company_name"
            name="company_name"
            defaultValue={profile.name}
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
            defaultValue={profile.country}
            required
            disabled={loading}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="icao_code">ICAO Code</Label>
          <Input
            id="icao_code"
            name="icao_code"
            defaultValue={profile.code || ''}
            placeholder="ABC"
            maxLength={3}
            pattern="[A-Z]{3}"
            className="font-mono uppercase"
            disabled={loading}
            onChange={(e) => {
              e.target.value = e.target.value.toUpperCase()
            }}
          />
          <p className="text-xs text-muted-foreground">3 uppercase letters</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="iata_code">IATA Code</Label>
          <Input
            id="iata_code"
            name="iata_code"
            defaultValue={profile.iata_code || ''}
            placeholder="AB"
            maxLength={2}
            pattern="[A-Z0-9]{2}"
            className="font-mono uppercase"
            disabled={loading}
            onChange={(e) => {
              e.target.value = e.target.value.toUpperCase()
            }}
          />
          <p className="text-xs text-muted-foreground">2 uppercase alphanumeric</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="regulatory_authority">
            Regulatory Authority <span className="text-destructive">*</span>
          </Label>
          <Input
            id="regulatory_authority"
            name="regulatory_authority"
            defaultValue={profile.regulatory_authority}
            placeholder="FAA, EASA, CAA, etc."
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="timezone">
            Timezone (IANA) <span className="text-destructive">*</span>
          </Label>
          <Input
            id="timezone"
            name="timezone"
            defaultValue={profile.timezone}
            placeholder="America/New_York"
            required
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">
            IANA timezone format
          </p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="text-sm text-green-600 bg-green-50 dark:bg-green-950/20 p-3 rounded">
          Operator profile updated successfully!
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}
