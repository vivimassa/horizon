'use client'

import { useState, useCallback } from 'react'
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
  Download,
  FileText,
  Loader2,
  Plane,
  MapPin,
  Route,
  Filter,
  Eye,
  ChevronRight,
  RotateCcw,
  CheckCircle,
  Copy,
  Check,
} from 'lucide-react'
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_GROUPS, getServiceTypeColor } from '@/lib/utils/ssim-parser'
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
}

// ─── Component ─────────────────────────────────────────────────────

export function SsimExportWorkflow({ seasons }: Props) {
  const [step, setStep] = useState<Step>('options')

  // Filter state
  const [seasonId, setSeasonId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<string[]>([])
  const [flightNumberFrom, setFlightNumberFrom] = useState('')
  const [flightNumberTo, setFlightNumberTo] = useState('')
  const [depStations, setDepStations] = useState('')
  const [arrStations, setArrStations] = useState('')
  const [actionCode, setActionCode] = useState('H')

  // Preview state
  const [preview, setPreview] = useState<ExportPreview | null>(null)
  const [loading, setLoading] = useState(false)

  // Download state
  const [ssimContent, setSsimContent] = useState('')
  const [copied, setCopied] = useState(false)

  const buildFilters = useCallback((): ExportFilters => {
    return {
      seasonId,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      serviceTypes: selectedServiceTypes.length > 0 ? selectedServiceTypes : undefined,
      flightNumberFrom: flightNumberFrom ? parseInt(flightNumberFrom, 10) : undefined,
      flightNumberTo: flightNumberTo ? parseInt(flightNumberTo, 10) : undefined,
      depStations: depStations
        ? depStations.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
        : undefined,
      arrStations: arrStations
        ? arrStations.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
        : undefined,
      actionCode,
    }
  }, [seasonId, dateFrom, dateTo, selectedServiceTypes, flightNumberFrom, flightNumberTo, depStations, arrStations, actionCode])

  const handlePreview = async () => {
    if (!seasonId) return
    setLoading(true)
    try {
      const filters = buildFilters()
      const result = await getExportPreview(filters)
      setPreview(result)
      setStep('preview')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const filters = buildFilters()
      const content = await generateExportFile(filters)
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
    const season = seasons.find(s => s.id === seasonId)
    const filename = `SSIM_${season?.code || 'export'}_${new Date().toISOString().split('T')[0]}.ssim`
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

  const toggleServiceType = (type: string) => {
    setSelectedServiceTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  // ─── Step Indicator ───────────────────────────────────────────────

  const steps = [
    { id: 'options', label: 'Export Options', icon: Filter },
    { id: 'preview', label: 'Preview', icon: Eye },
    { id: 'download', label: 'Download', icon: Download },
  ]

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => {
          const Icon = s.icon
          const isActive = s.id === step
          const isPast =
            (s.id === 'options' && (step === 'preview' || step === 'download')) ||
            (s.id === 'preview' && step === 'download')

          return (
            <div key={s.id} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <div
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : isPast
                      ? 'text-primary/60'
                      : 'text-muted-foreground'
                )}
              >
                {isPast ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                {s.label}
              </div>
            </div>
          )
        })}
      </div>

      {/* Step: Options */}
      {step === 'options' && (
        <div className="glass rounded-2xl p-6 space-y-6">
          <h2 className="text-lg font-semibold">Export Options</h2>

          {/* Season selector */}
          <div className="space-y-2">
            <Label>Schedule Season *</Label>
            <Select value={seasonId} onValueChange={setSeasonId}>
              <SelectTrigger className="glass-float">
                <SelectValue placeholder="Select a season" />
              </SelectTrigger>
              <SelectContent>
                {seasons.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.code} — {s.name} ({s.start_date} to {s.end_date})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filters grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Date range */}
            <div className="space-y-2">
              <Label>Date Range (optional)</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="glass-float"
                  placeholder="From"
                />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="glass-float"
                  placeholder="To"
                />
              </div>
            </div>

            {/* Flight number range */}
            <div className="space-y-2">
              <Label>Flight Number Range (optional)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={flightNumberFrom}
                  onChange={e => setFlightNumberFrom(e.target.value)}
                  className="glass-float"
                  placeholder="From"
                />
                <Input
                  type="number"
                  value={flightNumberTo}
                  onChange={e => setFlightNumberTo(e.target.value)}
                  className="glass-float"
                  placeholder="To"
                />
              </div>
            </div>

            {/* Departure stations */}
            <div className="space-y-2">
              <Label>Departure Stations (optional)</Label>
              <Input
                value={depStations}
                onChange={e => setDepStations(e.target.value)}
                className="glass-float"
                placeholder="SGN, HAN, DAD"
              />
              <p className="text-xs text-muted-foreground">Comma-separated IATA codes</p>
            </div>

            {/* Arrival stations */}
            <div className="space-y-2">
              <Label>Arrival Stations (optional)</Label>
              <Input
                value={arrStations}
                onChange={e => setArrStations(e.target.value)}
                className="glass-float"
                placeholder="SGN, HAN, DAD"
              />
              <p className="text-xs text-muted-foreground">Comma-separated IATA codes</p>
            </div>
          </div>

          {/* Service types — grouped by application */}
          <div className="space-y-2">
            <Label>Service Types (optional — all if none selected)</Label>
            <div className="space-y-3">
              {SERVICE_TYPE_GROUPS.map(group => (
                <div key={group.label}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 ml-4">
                    {group.codes.map(code => (
                      <button
                        key={code}
                        onClick={() => toggleServiceType(code)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-xs font-medium transition-all border',
                          selectedServiceTypes.includes(code)
                            ? 'border-primary/30 text-primary'
                            : 'glass-float text-muted-foreground border-transparent hover:text-foreground'
                        )}
                        style={selectedServiceTypes.includes(code) ? { backgroundColor: group.color + '20' } : undefined}
                      >
                        <span className="font-mono">{code}</span> {SERVICE_TYPE_LABELS[code]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action code */}
          <div className="space-y-2">
            <Label>Action Code</Label>
            <Select value={actionCode} onValueChange={setActionCode}>
              <SelectTrigger className="glass-float w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="H">H — New</SelectItem>
                <SelectItem value="R">R — Replace</SelectItem>
                <SelectItem value="C">C — Cancel</SelectItem>
                <SelectItem value="U">U — Update</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handlePreview}
              disabled={!seasonId || loading}
              className="gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              Preview Export
            </Button>
          </div>
        </div>
      )}

      {/* Step: Preview */}
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

          {/* Info */}
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

      {/* Step: Download */}
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
