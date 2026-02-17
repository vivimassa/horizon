'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select'
import {
  Download,
  FileText,
  Loader2,
  Plane,
  MapPin,
  Route,
  ChevronRight,
  RotateCcw,
  CheckCircle,
  Copy,
  Check,
} from 'lucide-react'
import { SERVICE_TYPE_LABELS, getServiceTypeColor } from '@/lib/utils/ssim-parser'
import {
  getExportPreview,
  generateExportFile,
  type ExportFilters,
  type ExportPreview,
} from '@/app/actions/ssim-export'

// ─── Types ─────────────────────────────────────────────────────────

type Step = 'options' | 'preview' | 'download'

interface Season {
  id: string
  code: string
  name: string
  start_date: string
  end_date: string
}

interface Props {
  seasons: Season[]
  airports: MultiSelectOption[]
  serviceTypes: MultiSelectOption[]
}

// ─── Season code parser ─────────────────────────────────────────────

function getLastSundayOfOctober(year: number): Date {
  const d = new Date(year, 9, 31)
  d.setDate(d.getDate() - d.getDay())
  return d
}
function getLastSaturdayOfMarch(year: number): Date {
  const d = new Date(year, 2, 31)
  d.setDate(d.getDate() - ((d.getDay() + 1) % 7))
  return d
}
function getLastSundayOfMarch(year: number): Date {
  const d = new Date(year, 2, 31)
  d.setDate(d.getDate() - d.getDay())
  return d
}
function getLastSaturdayOfOctober(year: number): Date {
  const d = new Date(year, 9, 31)
  d.setDate(d.getDate() - ((d.getDay() + 1) % 7))
  return d
}

function fmtDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDateDisplay(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function parseSeasonCode(code: string): { start: string; end: string; seasonId?: string } | null {
  const match = code.toUpperCase().match(/^([WS])(\d{2})$/)
  if (!match) return null
  const type = match[1]
  const year = 2000 + parseInt(match[2])
  if (type === 'W') {
    return { start: fmtDateISO(getLastSundayOfOctober(year)), end: fmtDateISO(getLastSaturdayOfMarch(year + 1)) }
  }
  if (type === 'S') {
    return { start: fmtDateISO(getLastSundayOfMarch(year)), end: fmtDateISO(getLastSaturdayOfOctober(year)) }
  }
  return null
}

/** Auto-format date input: typing "26102025" → "26/10/2025" */
function handleDateInput(value: string, setter: (v: string) => void, isoSetter: (v: string) => void) {
  // Strip non-digits
  const digits = value.replace(/\D/g, '')
  let display = digits
  if (digits.length >= 2) display = digits.slice(0, 2) + '/' + digits.slice(2)
  if (digits.length >= 4) display = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8)
  setter(display)

  // Convert to ISO if complete
  if (digits.length === 8) {
    const dd = digits.slice(0, 2)
    const mm = digits.slice(2, 4)
    const yyyy = digits.slice(4, 8)
    isoSetter(`${yyyy}-${mm}-${dd}`)
  } else {
    isoSetter('')
  }
}

// ─── Step Indicator (matches Import style) ──────────────────────────

const STEPS: { key: Step; label: string }[] = [
  { key: 'options', label: 'Export Options' },
  { key: 'preview', label: 'Preview' },
  { key: 'download', label: 'Download' },
]

function StepIndicator({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex(s => s.key === current)
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
            i === currentIdx
              ? 'bg-primary/15 text-primary'
              : i < currentIdx
                ? 'text-muted-foreground'
                : 'text-muted-foreground/50'
          )}>
            {i < currentIdx ? (
              <CheckCircle className="h-3.5 w-3.5" />
            ) : (
              <span className={cn(
                'w-4 h-4 rounded-full border flex items-center justify-center text-[10px]',
                i === currentIdx && 'border-primary bg-primary text-primary-foreground'
              )}>
                {i + 1}
              </span>
            )}
            {s.label}
          </div>
          {i < STEPS.length - 1 && (
            <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Component ─────────────────────────────────────────────────────

export function SsimExportWorkflow({ seasons, airports, serviceTypes }: Props) {
  const [step, setStep] = useState<Step>('options')

  // Period state
  const [dateFromDisplay, setDateFromDisplay] = useState('')
  const [dateToDisplay, setDateToDisplay] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [seasonInput, setSeasonInput] = useState('')
  const [matchedSeasonId, setMatchedSeasonId] = useState('')

  // Filter state
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<string[]>([])
  const [flightNumberFrom, setFlightNumberFrom] = useState('')
  const [flightNumberTo, setFlightNumberTo] = useState('')
  const [depStations, setDepStations] = useState<string[]>([])
  const [arrStations, setArrStations] = useState<string[]>([])

  // Preview state
  const [preview, setPreview] = useState<ExportPreview | null>(null)
  const [loading, setLoading] = useState(false)

  // Download state
  const [ssimContent, setSsimContent] = useState('')
  const [copied, setCopied] = useState(false)

  // ─── Season shortcut ──────────────────────────────────────────────

  const handleSeasonInput = (val: string) => {
    setSeasonInput(val.toUpperCase())
    const parsed = parseSeasonCode(val)
    if (parsed) {
      setDateFrom(parsed.start)
      setDateTo(parsed.end)
      setDateFromDisplay(fmtDateDisplay(parsed.start))
      setDateToDisplay(fmtDateDisplay(parsed.end))
      // Try to match a season from the DB
      const match = seasons.find(s =>
        s.start_date === parsed.start && s.end_date === parsed.end
      )
      setMatchedSeasonId(match?.id || '')
    }
  }

  // ─── Find the best matching season for the date range ─────────────

  const resolveSeasonId = useCallback((): string => {
    if (matchedSeasonId) return matchedSeasonId
    // Find the season whose range overlaps the selected dates
    if (!dateFrom || !dateTo) return ''
    const match = seasons.find(s =>
      s.start_date <= dateTo && s.end_date >= dateFrom
    )
    return match?.id || ''
  }, [matchedSeasonId, dateFrom, dateTo, seasons])

  // ─── Filters ──────────────────────────────────────────────────────

  const buildFilters = useCallback((): ExportFilters => {
    const sid = resolveSeasonId()
    return {
      seasonId: sid,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      serviceTypes: selectedServiceTypes.length > 0 ? selectedServiceTypes : undefined,
      flightNumberFrom: flightNumberFrom ? parseInt(flightNumberFrom, 10) : undefined,
      flightNumberTo: flightNumberTo ? parseInt(flightNumberTo, 10) : undefined,
      depStations: depStations.length > 0 ? depStations : undefined,
      arrStations: arrStations.length > 0 ? arrStations : undefined,
      actionCode: 'H',
    }
  }, [resolveSeasonId, dateFrom, dateTo, selectedServiceTypes, flightNumberFrom, flightNumberTo, depStations, arrStations])

  const canPreview = !!resolveSeasonId() && !!dateFrom && !!dateTo

  const handlePreview = async () => {
    if (!canPreview) return
    setLoading(true)
    try {
      const result = await getExportPreview(buildFilters())
      setPreview(result)
      setStep('preview')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const content = await generateExportFile(buildFilters())
      setSsimContent(content)
      setStep('download')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([ssimContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const filename = `SSIM_${seasonInput || 'export'}_${new Date().toISOString().split('T')[0]}.ssim`
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(ssimContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReset = () => {
    setStep('options')
    setPreview(null)
    setSsimContent('')
  }

  // ─── Validation ───────────────────────────────────────────────────

  const flightRangeError =
    flightNumberFrom && flightNumberTo &&
    parseInt(flightNumberFrom, 10) > parseInt(flightNumberTo, 10)
      ? 'From must be less than or equal to To'
      : ''

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* ─── Step 1: Export Options ─────────────────────────────────── */}
      {step === 'options' && (
        <div className="glass rounded-2xl p-6 space-y-6">
          <h2 className="text-lg font-semibold">Export Options</h2>

          {/* Period */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Period *</Label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Input
                  value={dateFromDisplay}
                  onChange={e => handleDateInput(e.target.value, setDateFromDisplay, setDateFrom)}
                  className="glass-float font-mono"
                  placeholder="DD/MM/YYYY"
                  maxLength={10}
                />
                <span className="text-[10px] text-muted-foreground mt-0.5 block">From</span>
              </div>
              <span className="text-muted-foreground mt-[-16px]">—</span>
              <div className="flex-1">
                <Input
                  value={dateToDisplay}
                  onChange={e => handleDateInput(e.target.value, setDateToDisplay, setDateTo)}
                  className="glass-float font-mono"
                  placeholder="DD/MM/YYYY"
                  maxLength={10}
                />
                <span className="text-[10px] text-muted-foreground mt-0.5 block">To</span>
              </div>
              <div className="w-[72px]">
                <Input
                  value={seasonInput}
                  onChange={e => handleSeasonInput(e.target.value)}
                  className="glass-float font-mono text-center uppercase"
                  placeholder="W25"
                  maxLength={3}
                />
                <span className="text-[10px] text-muted-foreground mt-0.5 block">Season</span>
              </div>
            </div>
            {!canPreview && dateFrom && dateTo && (
              <p className="text-[11px] text-destructive">
                No matching season found for this date range. Use a season shortcut like W25 or S26.
              </p>
            )}
          </div>

          {/* Flight Number Range */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Flight Number Range
            </Label>
            <div className="flex items-center gap-3 max-w-sm">
              <div className="flex-1">
                <Input
                  type="number"
                  value={flightNumberFrom}
                  onChange={e => setFlightNumberFrom(e.target.value)}
                  className="glass-float"
                  placeholder="From"
                  min={1}
                />
              </div>
              <span className="text-muted-foreground">—</span>
              <div className="flex-1">
                <Input
                  type="number"
                  value={flightNumberTo}
                  onChange={e => setFlightNumberTo(e.target.value)}
                  className="glass-float"
                  placeholder="To"
                  min={1}
                />
              </div>
            </div>
            {flightRangeError && (
              <p className="text-[11px] text-destructive">{flightRangeError}</p>
            )}
            <p className="text-[10px] text-muted-foreground">Optional — leave empty for all flights</p>
          </div>

          {/* Stations — side by side */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stations</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <MultiSelect
                  options={airports}
                  selected={depStations}
                  onChange={setDepStations}
                  placeholder="All departures"
                  searchable
                />
                <span className="text-[10px] text-muted-foreground mt-0.5 block">Departure</span>
              </div>
              <div>
                <MultiSelect
                  options={airports}
                  selected={arrStations}
                  onChange={setArrStations}
                  placeholder="All arrivals"
                  searchable
                />
                <span className="text-[10px] text-muted-foreground mt-0.5 block">Arrival</span>
              </div>
            </div>
          </div>

          {/* Service Types */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Service Types</Label>
            <MultiSelect
              options={serviceTypes}
              selected={selectedServiceTypes}
              onChange={setSelectedServiceTypes}
              placeholder="All service types"
              searchable={false}
            />
            <p className="text-[10px] text-muted-foreground">Optional — leave empty for all types</p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={handleReset}>Cancel</Button>
            <Button
              onClick={handlePreview}
              disabled={!canPreview || loading || !!flightRangeError}
              className="gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Next: Preview
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── Step 2: Preview ───────────────────────────────────────── */}
      {step === 'preview' && preview && (
        <div className="space-y-6">
          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass rounded-xl p-4 text-center">
              <Plane className="h-5 w-5 text-primary mx-auto mb-1" />
              <div className="text-2xl font-bold">{preview.totalFlights}</div>
              <div className="text-xs text-muted-foreground">Flight Records</div>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <FileText className="h-5 w-5 text-primary mx-auto mb-1" />
              <div className="text-2xl font-bold">{preview.uniqueFlightNumbers}</div>
              <div className="text-xs text-muted-foreground">Unique Flights</div>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <Route className="h-5 w-5 text-primary mx-auto mb-1" />
              <div className="text-2xl font-bold">{preview.uniqueRoutes}</div>
              <div className="text-xs text-muted-foreground">Unique Routes</div>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <MapPin className="h-5 w-5 text-primary mx-auto mb-1" />
              <div className="text-2xl font-bold">{preview.aircraftTypes.length}</div>
              <div className="text-xs text-muted-foreground">Aircraft Types</div>
            </div>
          </div>

          {/* Export Summary */}
          <div className="glass rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">Export Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Date Range:</span>{' '}
                <span className="font-medium">{preview.dateRange.start} to {preview.dateRange.end}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Aircraft Types:</span>{' '}
                <span className="font-medium">{preview.aircraftTypes.join(', ') || 'None'}</span>
              </div>
              <div className="md:col-span-2">
                <span className="text-muted-foreground">Service Types:</span>{' '}
                {Object.entries(preview.serviceTypes).map(([code, count]) => (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium mr-1.5 mb-1"
                    style={{ backgroundColor: getServiceTypeColor(code) + '20', color: getServiceTypeColor(code) }}
                  >
                    <span className="font-mono">{code}</span> {SERVICE_TYPE_LABELS[code] || 'Unknown'}: {count}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Sample SSIM output */}
          {preview.sampleLines.length > 0 && (
            <div className="glass rounded-2xl p-6 space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">Sample Output</h3>
              <pre className="bg-black/20 dark:bg-black/40 rounded-xl p-4 overflow-x-auto text-xs font-mono leading-relaxed">
                {preview.sampleLines.join('\n')}
              </pre>
            </div>
          )}

          {preview.totalFlights === 0 && (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-muted-foreground">No flight records match the selected filters.</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep('options')} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Back to Options
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={preview.totalFlights === 0 || loading}
              className="gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Generate SSIM File
            </Button>
          </div>
        </div>
      )}

      {/* ─── Step 3: Download ──────────────────────────────────────── */}
      {step === 'download' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-green-500/15 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">SSIM File Generated</h3>
                <p className="text-sm text-muted-foreground">
                  {ssimContent.split('\n').length} lines, {(ssimContent.length / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>

            {/* Preview */}
            <div className="relative">
              <pre className="bg-black/20 dark:bg-black/40 rounded-xl p-4 overflow-x-auto text-xs font-mono leading-relaxed max-h-[400px] overflow-y-auto scrollbar-thin">
                {ssimContent}
              </pre>
              <button
                onClick={handleCopy}
                className="absolute top-3 right-3 p-2 rounded-lg glass-float hover:bg-white/20 transition-colors"
                title="Copy to clipboard"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              New Export
            </Button>
            <Button onClick={handleDownload} className="gap-2">
              <Download className="h-4 w-4" />
              Download .ssim File
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
