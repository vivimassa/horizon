'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Ruler, Info, RotateCcw, Save, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { updateUomSettings, resetUomSettings, type UomSettings } from '@/app/actions/uom-settings'

// ─── Option Definitions ────────────────────────────────────────────
const DISTANCE_OPTIONS = [
  { value: 'nm', label: 'NM', description: 'Nautical Miles' },
  { value: 'km', label: 'KM', description: 'Kilometers' },
  { value: 'mi', label: 'MI', description: 'Statute Miles' },
]

const WEIGHT_OPTIONS = [
  { value: 'kg', label: 'KG', description: 'Kilograms' },
  { value: 'lbs', label: 'LBS', description: 'Pounds' },
]

const SPEED_OPTIONS = [
  { value: 'kts', label: 'KTS', description: 'Knots' },
  { value: 'km/h', label: 'KM/H', description: 'Kilometers/Hour' },
  { value: 'mph', label: 'MPH', description: 'Miles/Hour' },
]

const RUNWAY_OPTIONS = [
  { value: 'm', label: 'M', description: 'Meters' },
  { value: 'ft', label: 'FT', description: 'Feet' },
]

const ELEVATION_OPTIONS = [
  { value: 'ft', label: 'FT', description: 'Feet' },
  { value: 'm', label: 'M', description: 'Meters' },
]

const TEMPERATURE_OPTIONS = [
  { value: 'c', label: '\u00B0C', description: 'Celsius' },
  { value: 'f', label: '\u00B0F', description: 'Fahrenheit' },
]

const FUEL_WEIGHT_OPTIONS = [
  { value: 'kg', label: 'KG', description: 'Kilograms' },
  { value: 'lbs', label: 'LBS', description: 'Pounds' },
]

const FUEL_VOLUME_OPTIONS = [
  { value: 'usg', label: 'USG', description: 'US Gallons' },
  { value: 'l', label: 'L', description: 'Liters' },
  { value: 'ig', label: 'IG', description: 'Imperial Gallons' },
]

const CARGO_VOLUME_OPTIONS = [
  { value: 'm3', label: 'M\u00B3', description: 'Cubic Meters' },
  { value: 'ft3', label: 'FT\u00B3', description: 'Cubic Feet' },
]

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD', description: 'US Dollar' },
  { value: 'EUR', label: 'EUR', description: 'Euro' },
  { value: 'GBP', label: 'GBP', description: 'British Pound' },
  { value: 'VND', label: 'VND', description: 'Vietnamese Dong' },
  { value: 'THB', label: 'THB', description: 'Thai Baht' },
  { value: 'SGD', label: 'SGD', description: 'Singapore Dollar' },
  { value: 'JPY', label: 'JPY', description: 'Japanese Yen' },
  { value: 'KRW', label: 'KRW', description: 'Korean Won' },
  { value: 'CNY', label: 'CNY', description: 'Chinese Yuan' },
  { value: 'AUD', label: 'AUD', description: 'Australian Dollar' },
]

// ─── Types ─────────────────────────────────────────────────────────
interface UomOption {
  value: string
  label: string
  description: string
}

type SettingsKey = keyof Omit<UomSettings, 'id' | 'operator_id' | 'created_at' | 'updated_at'>

interface Props {
  initialSettings: UomSettings | null
}

// ─── Component ─────────────────────────────────────────────────────
export function UomSettingsForm({ initialSettings }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const [form, setForm] = useState<Record<SettingsKey, string | number>>({
    distance: initialSettings?.distance ?? 'nm',
    distance_commercial: initialSettings?.distance_commercial ?? 'km',
    weight: initialSettings?.weight ?? 'kg',
    speed: initialSettings?.speed ?? 'kts',
    runway_length: initialSettings?.runway_length ?? 'm',
    elevation: initialSettings?.elevation ?? 'ft',
    temperature: initialSettings?.temperature ?? 'c',
    fuel_weight: initialSettings?.fuel_weight ?? 'kg',
    fuel_volume: initialSettings?.fuel_volume ?? 'usg',
    cargo_volume: initialSettings?.cargo_volume ?? 'm3',
    currency: initialSettings?.currency ?? 'USD',
    specific_gravity: initialSettings?.specific_gravity ?? 0.80,
  })

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const updateField = (key: SettingsKey, value: string | number) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    const result = await updateUomSettings(form as Record<string, string | number>)
    setSaving(false)
    if (result.success) {
      showToast('success', 'Settings saved successfully')
      router.refresh()
    } else {
      showToast('error', result.error ?? 'Failed to save settings')
    }
  }

  const handleReset = async () => {
    setResetting(true)
    const result = await resetUomSettings()
    setResetting(false)
    if (result.success) {
      setForm({
        distance: 'nm',
        distance_commercial: 'km',
        weight: 'kg',
        speed: 'kts',
        runway_length: 'm',
        elevation: 'ft',
        temperature: 'c',
        fuel_weight: 'kg',
        fuel_volume: 'usg',
        cargo_volume: 'm3',
        currency: 'USD',
        specific_gravity: 0.80,
      })
      showToast('success', 'Settings reset to defaults')
      router.refresh()
    } else {
      showToast('error', result.error ?? 'Failed to reset settings')
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Ruler className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Units of Measure</h2>
            <p className="text-sm text-muted-foreground">System-wide display preferences</p>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pb-4">
        {/* Info Banner */}
        <div className="flex gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <p>
              These settings control how values are displayed throughout the system.
              All data is stored in standard aviation units (NM, kg, meters, knots)
              and converted for display based on these preferences.
            </p>
            <p className="text-blue-600/70 dark:text-blue-400/70">
              Changes will take effect on new pages. Existing pages will be updated gradually.
            </p>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Column - Operational Units */}
          <div className="rounded-2xl glass p-6 space-y-5">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                Operational Units
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Used in Operations, Planning &amp; Dispatch
              </p>
            </div>

            <div className="space-y-4">
              <UomSelect
                label="Distance"
                value={form.distance as string}
                options={DISTANCE_OPTIONS}
                onChange={(v) => updateField('distance', v)}
              />
              <UomSelect
                label="Weight"
                value={form.weight as string}
                options={WEIGHT_OPTIONS}
                onChange={(v) => updateField('weight', v)}
              />
              <UomSelect
                label="Speed"
                value={form.speed as string}
                options={SPEED_OPTIONS}
                onChange={(v) => updateField('speed', v)}
              />
              <UomSelect
                label="Runway Length"
                value={form.runway_length as string}
                options={RUNWAY_OPTIONS}
                onChange={(v) => updateField('runway_length', v)}
              />
              <UomSelect
                label="Elevation"
                value={form.elevation as string}
                options={ELEVATION_OPTIONS}
                onChange={(v) => updateField('elevation', v)}
              />
              <UomSelect
                label="Fuel (Weight)"
                value={form.fuel_weight as string}
                options={FUEL_WEIGHT_OPTIONS}
                onChange={(v) => updateField('fuel_weight', v)}
              />
              <UomSelect
                label="Fuel (Volume)"
                value={form.fuel_volume as string}
                options={FUEL_VOLUME_OPTIONS}
                onChange={(v) => updateField('fuel_volume', v)}
              />

              {/* Specific Gravity */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Specific Gravity (Jet A1)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    step="0.01"
                    min="0.50"
                    max="1.00"
                    value={form.specific_gravity}
                    onChange={(e) => updateField('specific_gravity', parseFloat(e.target.value) || 0.80)}
                    className="w-28 font-mono"
                  />
                  <span className="text-xs text-muted-foreground">kg/L (typical 0.775 – 0.840)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Commercial / Reporting Units */}
          <div className="rounded-2xl glass p-6 space-y-5">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                Commercial / Reporting Units
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Used in Reports, Commercial &amp; Revenue
              </p>
            </div>

            <div className="space-y-4">
              <UomSelect
                label="Distance (Commercial)"
                value={form.distance_commercial as string}
                options={DISTANCE_OPTIONS}
                onChange={(v) => updateField('distance_commercial', v)}
              />
              <UomSelect
                label="Temperature"
                value={form.temperature as string}
                options={TEMPERATURE_OPTIONS}
                onChange={(v) => updateField('temperature', v)}
              />
              <UomSelect
                label="Cargo Volume"
                value={form.cargo_volume as string}
                options={CARGO_VOLUME_OPTIONS}
                onChange={(v) => updateField('cargo_volume', v)}
              />
              <UomSelect
                label="Currency"
                value={form.currency as string}
                options={CURRENCY_OPTIONS}
                onChange={(v) => updateField('currency', v)}
              />
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={resetting}>
                {resetting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-2" />
                )}
                Reset to Defaults
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset to Default Units?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reset all units to standard aviation defaults (NM, kg, meters, knots, feet, Celsius, USD).
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>Reset</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg',
            'animate-in slide-in-from-bottom-4 fade-in duration-300',
            toast.type === 'success'
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
              : 'bg-destructive/15 text-destructive border border-destructive/20'
          )}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}

// ─── Reusable UOM Select Row ───────────────────────────────────────
function UomSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: UomOption[]
  onChange: (value: string) => void
}) {
  const selected = options.find(o => o.value === value)

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-3">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{selected?.description}</span>
      </div>
    </div>
  )
}
