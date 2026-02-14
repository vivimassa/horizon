'use client'

import { useState, useEffect } from 'react'
import { ScheduleSeason } from '@/types/database'
import { createScheduleSeason, updateScheduleSeason } from '@/app/actions/schedule-seasons'
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

interface ScheduleSeasonFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  season?: ScheduleSeason | null
}

// ─── IATA Season Date Calculation ────────────────────────────

/** Get the last Sunday of a given month (0-based: 0=Jan, 2=March, 9=October) */
function getLastSundayOfMonth(year: number, month: number): Date {
  const lastDay = new Date(year, month + 1, 0) // last day of the month
  const dow = lastDay.getDay() // 0=Sunday
  return new Date(year, month, lastDay.getDate() - dow)
}

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Calculate IATA standard season dates.
 * Summer: last Sunday of March → Saturday before last Sunday of October (same year)
 * Winter: last Sunday of October → Saturday before last Sunday of March (next year)
 */
function getIataSeasonDates(type: 'S' | 'W', year: number) {
  if (type === 'S') {
    const startDate = getLastSundayOfMonth(year, 2) // March
    const endSunday = getLastSundayOfMonth(year, 9) // October
    const endDate = new Date(endSunday)
    endDate.setDate(endDate.getDate() - 1) // Saturday before
    return {
      code: `S${String(year).slice(2)}`,
      name: `Summer ${year}`,
      startDate: formatDateStr(startDate),
      endDate: formatDateStr(endDate),
    }
  } else {
    const startDate = getLastSundayOfMonth(year, 9) // October
    const endSunday = getLastSundayOfMonth(year + 1, 2) // March next year
    const endDate = new Date(endSunday)
    endDate.setDate(endDate.getDate() - 1) // Saturday before
    return {
      code: `W${String(year).slice(2)}`,
      name: `Winter ${year}/${String(year + 1).slice(2)}`,
      startDate: formatDateStr(startDate),
      endDate: formatDateStr(endDate),
    }
  }
}

// ─── Component ───────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 1 + i) // e.g. 2025-2030

export function ScheduleSeasonFormDialog({ open, onOpenChange, season }: ScheduleSeasonFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const isEdit = !!season

  // Auto-populate state (only for create mode)
  const [seasonType, setSeasonType] = useState<'S' | 'W'>('S')
  const [seasonYear, setSeasonYear] = useState(CURRENT_YEAR)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Auto-calculate when type/year change (create mode only)
  useEffect(() => {
    if (isEdit) return
    const dates = getIataSeasonDates(seasonType, seasonYear)
    setCode(dates.code)
    setName(dates.name)
    setStartDate(dates.startDate)
    setEndDate(dates.endDate)
  }, [seasonType, seasonYear, isEdit])

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setError(null)
      if (isEdit && season) {
        setCode(season.code)
        setName(season.name)
        setStartDate(season.start_date)
        setEndDate(season.end_date)
      } else {
        setSeasonType('S')
        setSeasonYear(CURRENT_YEAR)
        const dates = getIataSeasonDates('S', CURRENT_YEAR)
        setCode(dates.code)
        setName(dates.name)
        setStartDate(dates.startDate)
        setEndDate(dates.endDate)
      }
    }
  }, [open, isEdit, season])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)

    try {
      const result = isEdit
        ? await updateScheduleSeason(season.id, formData)
        : await createScheduleSeason(formData)

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
          <DialogTitle>{isEdit ? 'Edit Schedule Season' : 'Add Schedule Season'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the schedule season information below.'
              : 'Select season type and year to auto-populate IATA standard dates.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Season type + year selectors (create mode only) */}
          {!isEdit && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="season_type">Season Type</Label>
                <select
                  id="season_type"
                  value={seasonType}
                  onChange={(e) => setSeasonType(e.target.value as 'S' | 'W')}
                  disabled={loading}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="S">Summer</option>
                  <option value="W">Winter</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="season_year">Year</Label>
                <select
                  id="season_year"
                  value={seasonYear}
                  onChange={(e) => setSeasonYear(parseInt(e.target.value))}
                  disabled={loading}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {YEARS.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Auto-populated fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">
                Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="code"
                name="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="S26"
                required
                className="font-mono uppercase"
                disabled={loading}
                readOnly={!isEdit}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Summer 2026"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">
                Start Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="start_date"
                name="start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                disabled={loading}
              />
              {!isEdit && (
                <p className="text-xs text-muted-foreground">
                  Last Sunday of {seasonType === 'S' ? 'March' : 'October'}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">
                End Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="end_date"
                name="end_date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                disabled={loading}
              />
              {!isEdit && (
                <p className="text-xs text-muted-foreground">
                  Saturday before last Sunday of {seasonType === 'S' ? 'October' : 'March'}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              defaultValue={season?.status || 'draft'}
              disabled={loading}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
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
              {loading ? 'Saving...' : isEdit ? 'Update Season' : 'Add Season'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
