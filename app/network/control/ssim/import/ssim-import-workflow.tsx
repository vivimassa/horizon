'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Plane,
  MapPin,
  Gauge,
  Route,
  Info,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  CalendarDays,
  Trash2,
} from 'lucide-react'
import {
  SERVICE_TYPE_LABELS,
  SERVICE_TYPE_GROUPS,
} from '@/lib/utils/ssim-parser'
import {
  parseSSIMFile,
  createMissingAirports,
  createMissingCityPairs,
  importFlightBatch,
  clearSeasonFlights,
  finalizeImport,
  purgeAllFlights,
  seedCityPairBlockTimes,
  type ValidationResult,
  type ParsedFlightData,
  type ParseSSIMResult,
} from '@/app/actions/ssim-import'

// ─── Types ─────────────────────────────────────────────────────────

type Step = 'upload' | 'preview' | 'options' | 'importing' | 'results'

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

interface ImportProgress {
  phase: string
  percent: number
  detail?: string
  completedSteps: {
    label: string
    detail?: string
  }[]
  currentStep?: string
}

interface ImportResults {
  created: number
  errors: number
  airportsCreated: number
  cityPairsCreated: number
  cityPairBlockTimesUpdated: number
  errorDetails: { line: number; message: string }[]
}

// ─── Component ─────────────────────────────────────────────────────

export function SsimImportWorkflow({ seasons }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // State
  const [step, setStep] = useState<Step>('upload')
  const [filename, setFilename] = useState<string>('')
  const [fileSize, setFileSize] = useState<number>(0)
  const [parsing, setParsing] = useState(false)
  const [rawFileContent, setRawFileContent] = useState<string>('')
  const [parseResult, setParseResult] = useState<ParseSSIMResult | null>(null)

  // Import options
  const [selectedSeason, setSelectedSeason] = useState(seasons[0]?.id || '')
  const [importMode, setImportMode] = useState<'replace' | 'merge' | 'preview'>('replace')
  const [autoCreateAirports, setAutoCreateAirports] = useState(true)
  const [autoCreateCityPairs, setAutoCreateCityPairs] = useState(true)
  const [autoMapAircraft, setAutoMapAircraft] = useState(true)

  // Date range
  const [rangeMode, setRangeMode] = useState<'full' | 'custom'>('full')
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')

  // Import progress
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    phase: '',
    percent: 0,
    completedSteps: [],
  })
  const [importResults, setImportResults] = useState<ImportResults | null>(null)

  // Purge state
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false)
  const [purging, setPurging] = useState(false)
  const [purgeConfirmText, setPurgeConfirmText] = useState('')

  // Abort controller for cancellation
  const abortRef = useRef(false)

  // ─── File Handling ─────────────────────────────────────────────

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const processFile = async (file: File) => {
    setFilename(file.name)
    setFileSize(file.size)
    setParsing(true)

    const text = await file.text()
    setRawFileContent(text)

    // Parse on server (also runs validation)
    try {
      const result = await parseSSIMFile(text)
      setParseResult(result)

      // Initialize date range from SSIM file
      setRangeFrom(result.carrier?.seasonStart || '')
      setRangeTo(result.carrier?.seasonEnd || '')
      setRangeMode('full')

      // Auto-select season
      if (result.validation.seasonMatch) {
        setSelectedSeason(result.validation.seasonMatch.id)
      }

      setStep('preview')
    } catch (err) {
      console.error('Parse failed:', err)
      // Show error in preview
      setParseResult(null)
    }
    setParsing(false)
  }

  // ─── Chunked Import ─────────────────────────────────────────────

  const handleImport = async () => {
    if (!parseResult) return
    abortRef.current = false
    setStep('importing')
    setImporting(true)
    setImportResults(null)

    const completedSteps: { label: string; detail?: string }[] = []
    let totalCreated = 0
    let totalErrors = 0
    const allErrorDetails: { line: number; message: string }[] = []
    let airportsCreated = 0
    let cityPairsCreated = 0
    let cityPairBlockTimesUpdated = 0

    try {
      // Filter flights by date range (always apply when dates are set)
      let flights = parseResult.flights
      if (rangeFrom && rangeTo) {
        // Keep only flights whose period overlaps with the selected date range
        flights = flights.filter(f => f.periodStart <= rangeTo && f.periodEnd >= rangeFrom)

        // In custom mode, clip each flight's period to the selected range
        if (rangeMode === 'custom') {
          flights = flights.map(f => ({
            ...f,
            periodStart: f.periodStart < rangeFrom ? rangeFrom : f.periodStart,
            periodEnd: f.periodEnd > rangeTo ? rangeTo : f.periodEnd,
          }))
        }
      }

      setImportProgress({
        phase: `${flights.length} flights to import`,
        percent: 5,
        completedSteps: [...completedSteps],
        currentStep: 'Preparing import...',
      })

      // STEP 1: Create missing airports
      if (autoCreateAirports && parseResult.validation.missingAirports.length > 0) {
        setImportProgress({
          phase: `Creating ${parseResult.validation.missingAirports.length} airports...`,
          percent: 10,
          completedSteps: [...completedSteps],
          currentStep: `Creating ${parseResult.validation.missingAirports.length} missing airports...`,
        })

        const result = await createMissingAirports(parseResult.validation.missingAirports)
        airportsCreated = result.created
        completedSteps.push({
          label: 'Airports created',
          detail: `${result.created} new airport(s)`,
        })
      } else {
        completedSteps.push({ label: 'Airports', detail: 'All airports found' })
      }

      if (abortRef.current) return

      // STEP 2: Create missing city pairs
      if (autoCreateCityPairs && parseResult.validation.missingCityPairs.length > 0) {
        const pairs = parseResult.validation.missingCityPairs.map(r => {
          const [dep, arr] = r.split('-')
          return { dep, arr }
        })

        setImportProgress({
          phase: `Creating ${pairs.length} city pairs...`,
          percent: 18,
          completedSteps: [...completedSteps],
          currentStep: `Creating ${pairs.length} missing city pairs...`,
        })

        const result = await createMissingCityPairs(pairs)
        cityPairsCreated = result.created + result.updated
        const updatedDetail = result.updated > 0 ? `, ${result.updated} updated` : ''
        const fixedDetail = result.domesticFixed > 0 ? `, ${result.domesticFixed} reclassified` : ''
        completedSteps.push({
          label: 'City pairs synced',
          detail: `${result.created} new, ${result.updated} updated${fixedDetail}`,
        })
      } else {
        completedSteps.push({ label: 'City pairs', detail: 'All city pairs found' })
      }

      if (abortRef.current) return

      // STEP 3: Clear existing flights (Replace mode)
      if (importMode === 'replace') {
        setImportProgress({
          phase: 'Clearing existing flights...',
          percent: 22,
          completedSteps: [...completedSteps],
          currentStep: 'Deleting existing flights for this season...',
        })

        const dateRange = rangeMode === 'custom' && rangeFrom && rangeTo
          ? { from: rangeFrom, to: rangeTo }
          : undefined

        const result = await clearSeasonFlights(selectedSeason, dateRange)
        completedSteps.push({
          label: 'Existing flights cleared',
          detail: `${result.deleted} flight(s) removed`,
        })
      }

      if (abortRef.current) return

      // STEP 4: Import flights in chunks of 50
      if (importMode !== 'preview') {
        const CHUNK_SIZE = 50
        const totalChunks = Math.ceil(flights.length / CHUNK_SIZE)

        for (let i = 0; i < flights.length; i += CHUNK_SIZE) {
          if (abortRef.current) break

          const chunk = flights.slice(i, i + CHUNK_SIZE)
          const chunkNum = Math.floor(i / CHUNK_SIZE) + 1
          const percent = 25 + Math.round(65 * ((i + chunk.length) / flights.length))

          setImportProgress({
            phase: `Importing flights... batch ${chunkNum}/${totalChunks}`,
            percent,
            detail: `${Math.min(i + CHUNK_SIZE, flights.length)} / ${flights.length} flights`,
            completedSteps: [...completedSteps],
            currentStep: `Inserting batch ${chunkNum} of ${totalChunks}...`,
          })

          const result = await importFlightBatch(chunk, selectedSeason, chunkNum)
          totalCreated += result.created
          totalErrors += result.errors.length
          allErrorDetails.push(...result.errors)
        }

        completedSteps.push({
          label: 'Flights imported',
          detail: `${totalCreated} created, ${totalErrors} error(s)`,
        })
      } else {
        completedSteps.push({
          label: 'Preview complete',
          detail: `${flights.length} flights would be imported`,
        })
        totalCreated = flights.length
      }

      if (abortRef.current) return

      // STEP 5: Finalize (update references)
      if (importMode !== 'preview') {
        setImportProgress({
          phase: 'Finalizing import...',
          percent: 92,
          completedSteps: [...completedSteps],
          currentStep: 'Updating airport and city pair references...',
        })

        const finalResult = await finalizeImport(selectedSeason)
        completedSteps.push({ label: 'References updated', detail: `${finalResult.synced} flight numbers synced` })

        // STEP 6: Seed city pair block times from imported flights
        setImportProgress({
          phase: 'Seeding block times...',
          percent: 96,
          completedSteps: [...completedSteps],
          currentStep: 'Computing median block times per city pair...',
        })

        const blockTimeResult = await seedCityPairBlockTimes(selectedSeason)
        cityPairBlockTimesUpdated = blockTimeResult.updated
        completedSteps.push({ label: 'Block hours seeded', detail: `${blockTimeResult.updated} city pair block hour rows inserted` })
      }

      // Done
      setImportProgress({
        phase: 'Complete!',
        percent: 100,
        completedSteps: [...completedSteps],
      })

      setImportResults({
        created: totalCreated,
        errors: totalErrors,
        airportsCreated,
        cityPairsCreated,
        cityPairBlockTimesUpdated,
        errorDetails: allErrorDetails,
      })
      setStep('results')

    } catch (err) {
      console.error('SSIM Import error:', err)
      setImportResults({
        created: totalCreated,
        errors: totalErrors + 1,
        airportsCreated,
        cityPairsCreated,
        cityPairBlockTimesUpdated,
        errorDetails: [
          ...allErrorDetails,
          { line: 0, message: err instanceof Error ? err.message : 'Import failed unexpectedly' },
        ],
      })
      setStep('results')
    } finally {
      setImporting(false)
    }
  }

  const handleReset = () => {
    abortRef.current = true
    setStep('upload')
    setParseResult(null)
    setImportResults(null)
    setRawFileContent('')
    setFilename('')
    setFileSize(0)
    setImportProgress({ phase: '', percent: 0, completedSteps: [] })
    setRangeFrom('')
    setRangeTo('')
    setRangeMode('full')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handlePurge = async () => {
    if (purgeConfirmText !== 'PURGE') return
    setPurging(true)
    try {
      const result = await purgeAllFlights()
      setShowPurgeConfirm(false)
      setPurgeConfirmText('')
      alert(`Purged ${result.deleted} flights and all related records.`)
      router.refresh()
    } catch (err) {
      console.error('Purge failed:', err)
      alert('Purge failed: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setPurging(false)
    }
  }

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">1.1.10.1. SSIM Import</h2>
              <p className="text-sm text-muted-foreground">Import schedules from SSIM Chapter 7 files</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
            onClick={() => setShowPurgeConfirm(true)}
            disabled={importing || purging}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Purge All Flights
          </Button>
        </div>
      </div>

      {/* Purge confirmation dialog */}
      {showPurgeConfirm && (
        <div className="rounded-2xl glass p-4 border-l-4 border-l-red-500">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <h4 className="font-medium text-red-600 dark:text-red-400">Purge All Flights?</h4>
              <p className="text-sm text-muted-foreground mt-1">
                This will permanently delete <strong>ALL</strong> scheduled flights across <strong>all seasons</strong>,
                including tail assignments, aircraft route legs, and reset all city pair block times to null.
                This action cannot be undone.
              </p>
              <div className="mt-3">
                <Label className="text-xs text-muted-foreground">Type <strong>PURGE</strong> to confirm</Label>
                <Input
                  className="mt-1 max-w-[200px] text-sm"
                  placeholder="PURGE"
                  value={purgeConfirmText}
                  onChange={(e) => setPurgeConfirmText(e.target.value)}
                  disabled={purging}
                />
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handlePurge}
                  disabled={purging || purgeConfirmText !== 'PURGE'}
                >
                  {purging ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Purging...
                    </>
                  ) : (
                    'Yes, Purge Everything'
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setShowPurgeConfirm(false); setPurgeConfirmText('') }}
                  disabled={purging}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step indicator */}
      <div>
        <StepIndicator current={step} />
      </div>

      {/* Content */}
      <div className="space-y-4">
        {/* STEP 1: Upload */}
        {step === 'upload' && (
          <UploadStep
            fileInputRef={fileInputRef}
            parsing={parsing}
            filename={filename}
            fileSize={fileSize}
            onDrop={handleFileDrop}
            onFileSelect={handleFileSelect}
          />
        )}

        {/* STEP 2: Preview & Validation */}
        {step === 'preview' && parseResult && (
          <PreviewStep
            parseResult={parseResult}
            filename={filename}
            onContinue={() => setStep('options')}
            onReset={handleReset}
          />
        )}

        {/* STEP 3: Import Options */}
        {step === 'options' && parseResult && (
          <OptionsStep
            seasons={seasons}
            selectedSeason={selectedSeason}
            importMode={importMode}
            autoCreateAirports={autoCreateAirports}
            autoCreateCityPairs={autoCreateCityPairs}
            autoMapAircraft={autoMapAircraft}
            onSeasonChange={setSelectedSeason}
            onModeChange={setImportMode}
            onAutoAirportsChange={setAutoCreateAirports}
            onAutoCityPairsChange={setAutoCreateCityPairs}
            onAutoAircraftChange={setAutoMapAircraft}
            onImport={handleImport}
            onBack={() => setStep('preview')}
            parseResult={parseResult}
            rangeFrom={rangeFrom}
            rangeTo={rangeTo}
            rangeMode={rangeMode}
            onRangeFromChange={setRangeFrom}
            onRangeToChange={setRangeTo}
            onRangeModeChange={setRangeMode}
          />
        )}

        {/* STEP 4: Importing */}
        {step === 'importing' && (
          <ImportingStep progress={importProgress} />
        )}

        {/* STEP 5: Results */}
        {step === 'results' && importResults && (
          <ResultsStep
            result={importResults}
            isPreview={importMode === 'preview'}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  )
}

// ─── Step Indicator ────────────────────────────────────────────────

const STEPS: { key: Step; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'preview', label: 'Preview' },
  { key: 'options', label: 'Options' },
  { key: 'importing', label: 'Import' },
  { key: 'results', label: 'Results' },
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
              <span className="w-4 h-4 rounded-full border flex items-center justify-center text-[10px]">
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

// ─── STEP 1: Upload ────────────────────────────────────────────────

function UploadStep({
  fileInputRef,
  parsing,
  filename,
  fileSize,
  onDrop,
  onFileSelect,
}: {
  fileInputRef: React.RefObject<HTMLInputElement>
  parsing: boolean
  filename: string
  fileSize: number
  onDrop: (e: React.DragEvent) => void
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  const [dragOver, setDragOver] = useState(false)

  return (
    <div
      className={cn(
        'rounded-2xl glass p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 min-h-[300px]',
        'border-2 border-dashed',
        dragOver
          ? 'border-primary/50 bg-primary/5'
          : 'border-transparent hover:border-muted-foreground/20'
      )}
      onDrop={(e) => { setDragOver(false); onDrop(e) }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.ssim,.dat"
        onChange={onFileSelect}
        className="hidden"
      />

      {parsing ? (
        <>
          <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
          <p className="text-lg font-medium">Parsing {filename}...</p>
          <p className="text-sm text-muted-foreground mt-1">
            {(fileSize / 1024).toFixed(1)} KB
          </p>
        </>
      ) : (
        <>
          <Upload className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-lg font-medium">Drop SSIM file here or click to browse</p>
          <p className="text-sm text-muted-foreground mt-1">
            Supports .txt, .ssim, .dat files (SSIM Chapter 7 format)
          </p>
        </>
      )}
    </div>
  )
}

// ─── STEP 2: Preview & Validation ──────────────────────────────────

function PreviewStep({
  parseResult,
  filename,
  onContinue,
  onReset,
}: {
  parseResult: ParseSSIMResult
  filename: string
  onContinue: () => void
  onReset: () => void
}) {
  const { carrier, stats, errors, validation } = parseResult
  const hasErrors = errors.length > 0
  const [showErrors, setShowErrors] = useState(false)

  return (
    <div className="space-y-4">
      {/* Parse result banner */}
      <div className={cn(
        'rounded-xl px-4 py-2.5 flex items-center gap-3 text-sm',
        hasErrors
          ? 'bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300'
          : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
      )}>
        {hasErrors ? (
          <AlertTriangle className="h-4 w-4 shrink-0" />
        ) : (
          <CheckCircle className="h-4 w-4 shrink-0" />
        )}
        <span className="font-medium">
          {hasErrors ? `Parsed with ${errors.length} warning(s)` : 'Parsed Successfully'}
        </span>
        <span className="text-muted-foreground">|</span>
        <span className="font-mono text-xs">{filename}</span>
        <span className="text-muted-foreground">|</span>
        <span>
          {carrier?.seasonStart && carrier?.seasonEnd
            ? `${formatDate(carrier.seasonStart)} — ${formatDate(carrier.seasonEnd)}`
            : '—'
          }
        </span>
        <span className="text-muted-foreground">|</span>
        <span><span className="font-semibold">{stats.totalRecords.toLocaleString()}</span> legs</span>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          value={stats.uniqueFlightNumbers}
          label="Unique Flights"
          icon={<Plane className="h-4 w-4" />}
        />
        <StatCard
          value={stats.aircraftTypes.length}
          label="Aircraft Types"
          icon={<Gauge className="h-4 w-4" />}
        />
        <StatCard
          value={stats.stations.length}
          label="Airports"
          icon={<MapPin className="h-4 w-4" />}
        />
        <StatCard
          value={stats.uniqueRoutes}
          label="Routes"
          icon={<Route className="h-4 w-4" />}
          sub={`${stats.domesticRoutes} dom / ${stats.internationalRoutes} intl`}
        />
      </div>

      {/* Breakdown + Validation — two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,1fr] gap-3">
        {/* Left column: Service Types + Aircraft Types stacked */}
        <div className="space-y-3">
          {/* Service types — grouped by application */}
          <div className="rounded-2xl glass p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Service Types
            </h4>
            <div className="space-y-3">
              {SERVICE_TYPE_GROUPS
                .filter(g => g.codes.some(c => stats.serviceTypes[c]))
                .map(group => (
                  <div key={group.label}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {group.label}
                      </span>
                    </div>
                    <div className="space-y-0.5 ml-4">
                      {group.codes
                        .filter(c => stats.serviceTypes[c])
                        .map(code => (
                          <div key={code} className="flex items-center justify-between text-sm">
                            <span>
                              <span className="font-mono font-medium" style={{ color: group.color }}>{code}</span>{' '}
                              <span className="text-muted-foreground">{SERVICE_TYPE_LABELS[code] || code}</span>
                            </span>
                            <span className="font-medium">{stats.serviceTypes[code].toLocaleString()}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Aircraft types */}
          <div className="rounded-2xl glass p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Aircraft Types
            </h4>
            <div className="space-y-1.5">
              {Object.entries(stats.aircraftTypeCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between text-sm">
                    <span className="font-mono font-medium">{type}</span>
                    <span className="text-muted-foreground">{count.toLocaleString()} legs</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Right column: Validation checks */}
        <div className="rounded-2xl glass p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Validation Checks
          </h4>
          <div className="space-y-2">
            <ValidationCheck
              pass={true}
              label="File format valid (SSIM Chapter 7)"
            />
            <ValidationCheck
              pass={validation.recordCountMatch}
              label="Record count matches trailer"
            />
            <ValidationCheck
              pass={validation.airlineMatch}
              warn={!validation.airlineMatch}
              label={validation.airlineMatch
                ? 'Airline matches current operator'
                : 'Airline does not match current operator'
              }
            />
            <ValidationCheck
              pass={validation.missingAirports.length === 0}
              warn={validation.missingAirports.length > 0}
              label={validation.missingAirports.length === 0
                ? 'All airports found in database'
                : `${validation.missingAirports.length} airport(s) not in database: ${validation.missingAirports.slice(0, 10).join(', ')}${validation.missingAirports.length > 10 ? '...' : ''}`
              }
            />
            <ValidationCheck
              pass={validation.missingCityPairs.length === 0}
              warn={validation.missingCityPairs.length > 0}
              label={validation.missingCityPairs.length === 0
                ? 'All city pairs found'
                : `${validation.missingCityPairs.length} city pair(s) not in database`
              }
            />
            <ValidationCheck
              pass={validation.allAircraftFound}
              warn={!validation.allAircraftFound}
              label={validation.allAircraftFound
                ? 'All aircraft types found'
                : `${validation.missingAircraftTypes.length} aircraft type(s) not mapped: ${validation.missingAircraftTypes.join(', ')}`
              }
            />
            <ValidationCheck
              pass={!!validation.seasonMatch}
              warn={!validation.seasonMatch}
              label={validation.seasonMatch
                ? `Season matched: ${validation.seasonMatch.code} — ${validation.seasonMatch.name}`
                : 'No matching season found — select one in import options'
              }
            />
          </div>
        </div>
      </div>

      {/* Parse errors */}
      {hasErrors && (
        <div className="rounded-2xl glass p-4">
          <button
            onClick={() => setShowErrors(!showErrors)}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {errors.length} Parse Warning(s)
            <ChevronRight className={cn('h-3 w-3 transition-transform', showErrors && 'rotate-90')} />
          </button>
          {showErrors && (
            <div className="mt-3 space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
              {errors.map((e, i) => (
                <div key={i} className="text-xs font-mono text-muted-foreground">
                  Line {e.line}: {e.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Upload Different File
        </Button>
        <Button size="sm" onClick={onContinue}>
          Continue to Import Options
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}

// ─── STEP 3: Import Options ────────────────────────────────────────

function OptionsStep({
  seasons,
  selectedSeason,
  importMode,
  autoCreateAirports,
  autoCreateCityPairs,
  autoMapAircraft,
  onSeasonChange,
  onModeChange,
  onAutoAirportsChange,
  onAutoCityPairsChange,
  onAutoAircraftChange,
  onImport,
  onBack,
  parseResult,
  rangeFrom,
  rangeTo,
  rangeMode,
  onRangeFromChange,
  onRangeToChange,
  onRangeModeChange,
}: {
  seasons: Season[]
  selectedSeason: string
  importMode: 'replace' | 'merge' | 'preview'
  autoCreateAirports: boolean
  autoCreateCityPairs: boolean
  autoMapAircraft: boolean
  onSeasonChange: (v: string) => void
  onModeChange: (v: 'replace' | 'merge' | 'preview') => void
  onAutoAirportsChange: (v: boolean) => void
  onAutoCityPairsChange: (v: boolean) => void
  onAutoAircraftChange: (v: boolean) => void
  onImport: () => void
  onBack: () => void
  parseResult: ParseSSIMResult
  rangeFrom: string
  rangeTo: string
  rangeMode: 'full' | 'custom'
  onRangeFromChange: (v: string) => void
  onRangeToChange: (v: string) => void
  onRangeModeChange: (v: 'full' | 'custom') => void
}) {
  // Calendar view state
  const [viewYear, setViewYear] = useState(() => {
    const d = rangeFrom ? new Date(rangeFrom + 'T00:00:00') : new Date()
    return d.getFullYear()
  })
  const [viewMonth, setViewMonth] = useState(() => {
    const d = rangeFrom ? new Date(rangeFrom + 'T00:00:00') : new Date()
    return d.getMonth()
  })
  const [selectingEnd, setSelectingEnd] = useState(false)

  const ssimStart = parseResult.carrier?.seasonStart || ''
  const ssimEnd = parseResult.carrier?.seasonEnd || ''

  // Compute filtered flight count
  const filteredFlightCount = useMemo(() => {
    if (!rangeFrom || !rangeTo) return parseResult.flights.length
    return parseResult.flights.filter(f =>
      f.periodStart <= rangeTo && f.periodEnd >= rangeFrom
    ).length
  }, [parseResult.flights, rangeFrom, rangeTo])

  // Compute matched seasons
  const matchedSeasons = useMemo(() => {
    if (!rangeFrom || !rangeTo) return []
    return seasons.filter(s =>
      s.start_date <= rangeTo && s.end_date >= rangeFrom
    )
  }, [seasons, rangeFrom, rangeTo])

  // Auto-select season when exactly one matches
  useEffect(() => {
    if (matchedSeasons.length === 1) {
      onSeasonChange(matchedSeasons[0].id)
    }
  }, [matchedSeasons]) // eslint-disable-line react-hooks/exhaustive-deps

  // Compute flight operation days for current calendar month
  const flightDaysInMonth = useMemo(() => {
    const days = new Set<number>()
    const daysCount = new Date(viewYear, viewMonth + 1, 0).getDate()

    for (let day = 1; day <= daysCount; day++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const d = new Date(viewYear, viewMonth, day)
      const dow = d.getDay()
      const ssimIdx = dow === 0 ? 6 : dow - 1

      for (const f of parseResult.flights) {
        if (f.periodStart <= dateStr && f.periodEnd >= dateStr && f.daysOfOperation[ssimIdx] !== ' ') {
          days.add(day)
          break
        }
      }
    }

    return days
  }, [parseResult.flights, viewYear, viewMonth])

  // Calendar navigation
  const goBack = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const goForward = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  // Date selection from calendar
  const handleDateClick = (dateStr: string) => {
    onRangeModeChange('custom')

    if (!selectingEnd || !rangeFrom) {
      onRangeFromChange(dateStr)
      onRangeToChange('')
      setSelectingEnd(true)
    } else {
      if (dateStr < rangeFrom) {
        onRangeFromChange(dateStr)
        onRangeToChange('')
      } else {
        onRangeToChange(dateStr)
        setSelectingEnd(false)
      }
    }
  }

  // Quick select handlers
  const setFullPeriod = () => {
    onRangeModeChange('full')
    onRangeFromChange(ssimStart)
    onRangeToChange(ssimEnd)
    setSelectingEnd(false)
  }

  const clamp = (date: string) => {
    if (date < ssimStart) return ssimStart
    if (date > ssimEnd) return ssimEnd
    return date
  }

  const setThisMonth = () => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const start = `${y}-${String(m + 1).padStart(2, '0')}-01`
    const end = `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m + 1, 0).getDate()}`
    onRangeModeChange('custom')
    onRangeFromChange(clamp(start))
    onRangeToChange(clamp(end))
    setSelectingEnd(false)
    setViewYear(y)
    setViewMonth(m)
  }

  const setNextMonth = () => {
    const now = new Date()
    const nm = now.getMonth() + 1
    const y = nm > 11 ? now.getFullYear() + 1 : now.getFullYear()
    const m = nm > 11 ? 0 : nm
    const start = `${y}-${String(m + 1).padStart(2, '0')}-01`
    const end = `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m + 1, 0).getDate()}`
    onRangeModeChange('custom')
    onRangeFromChange(clamp(start))
    onRangeToChange(clamp(end))
    setSelectingEnd(false)
    setViewYear(y)
    setViewMonth(m)
  }

  const setNext7Days = () => {
    const now = new Date()
    const start = now.toISOString().split('T')[0]
    const endDate = new Date(now)
    endDate.setDate(endDate.getDate() + 6)
    const end = endDate.toISOString().split('T')[0]
    onRangeModeChange('custom')
    onRangeFromChange(clamp(start))
    onRangeToChange(clamp(end))
    setSelectingEnd(false)
    setViewYear(now.getFullYear())
    setViewMonth(now.getMonth())
  }

  // Calendar grid
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDow = new Date(viewYear, viewMonth, 1).getDay()
  const startOffset = firstDow === 0 ? 6 : firstDow - 1
  const today = new Date().toISOString().split('T')[0]

  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  // Replace mode description based on range
  const replaceDesc = rangeMode === 'custom' && rangeFrom && rangeTo
    ? `Delete flights overlapping ${formatDate(rangeFrom)} — ${formatDate(rangeTo)}, then import`
    : 'Delete all existing flights for this season, then import fresh'

  return (
    <div className="space-y-4">
      {/* ── Target Period ─────────────────────────────────────── */}
      <div className="rounded-2xl glass p-5 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider">Target Period</h3>

        {/* SSIM file info bar */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4 shrink-0" />
          <span>SSIM File:</span>
          <span className="font-medium text-foreground">
            {formatDate(ssimStart)} — {formatDate(ssimEnd)}
          </span>
          <span>({parseResult.flights.length.toLocaleString()} legs)</span>
        </div>

        {/* Inputs + Calendar side-by-side */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,1fr] gap-4">
          {/* Left: Quick-select pills + date inputs + info */}
          <div className="space-y-3">
            {/* Quick-select pills */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Full Period', action: setFullPeriod },
                { label: 'This Month', action: setThisMonth },
                { label: 'Next Month', action: setNextMonth },
                { label: 'Next 7 Days', action: setNext7Days },
              ].map(qs => (
                <button
                  key={qs.label}
                  onClick={qs.action}
                  className="px-3 py-1 rounded-lg text-xs font-medium glass-float hover:bg-white/20 dark:hover:bg-white/10 transition-colors"
                >
                  {qs.label}
                </button>
              ))}
            </div>

            {/* From / To inputs — same row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input
                  type="date"
                  value={rangeFrom}
                  min={ssimStart}
                  max={ssimEnd}
                  onChange={e => {
                    onRangeFromChange(e.target.value)
                    if (rangeMode === 'full') onRangeModeChange('custom')
                    if (e.target.value) {
                      const d = new Date(e.target.value + 'T00:00:00')
                      setViewYear(d.getFullYear())
                      setViewMonth(d.getMonth())
                    }
                  }}
                  className="glass-float"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input
                  type="date"
                  value={rangeTo}
                  min={rangeFrom || ssimStart}
                  max={ssimEnd}
                  onChange={e => {
                    onRangeToChange(e.target.value)
                    if (rangeMode === 'full') onRangeModeChange('custom')
                  }}
                  className="glass-float"
                />
              </div>
            </div>

            {/* Live flight count */}
            <div className="glass-float rounded-xl p-3">
              <div className="flex items-center gap-2">
                <Plane className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm">
                  <span className="font-semibold text-primary">{filteredFlightCount.toLocaleString()}</span>
                  {' '}flights in selected period
                </span>
              </div>
              {rangeMode === 'custom' && filteredFlightCount !== parseResult.flights.length && (
                <p className="text-xs text-muted-foreground mt-1 ml-6">
                  {(parseResult.flights.length - filteredFlightCount).toLocaleString()} flights excluded by date filter
                </p>
              )}
            </div>

            {/* Season auto-match */}
            <div className="glass-float rounded-xl p-3">
              <div className="flex items-center gap-2 text-sm">
                <CalendarDays className="h-4 w-4 text-primary shrink-0" />
                {matchedSeasons.length === 0 ? (
                  <span className="text-amber-600 dark:text-amber-400">No matching season found</span>
                ) : matchedSeasons.length === 1 ? (
                  <span>
                    Season: <span className="font-semibold">{matchedSeasons[0].code}</span> — {matchedSeasons[0].name}
                  </span>
                ) : (
                  <span>Matches {matchedSeasons.length} seasons</span>
                )}
              </div>
              {matchedSeasons.length > 1 && (
                <div className="mt-2 ml-6">
                  <Select value={selectedSeason} onValueChange={onSeasonChange}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select season" />
                    </SelectTrigger>
                    <SelectContent>
                      {matchedSeasons.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {matchedSeasons.length === 0 && (
                <div className="mt-2 ml-6">
                  <Select value={selectedSeason} onValueChange={onSeasonChange}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select season manually" />
                    </SelectTrigger>
                    <SelectContent>
                      {seasons.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Right: Inline calendar */}
          <div className="glass-float rounded-xl p-4">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-3">
              <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-white/20 dark:hover:bg-white/10 transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold">{MONTH_NAMES[viewMonth]} {viewYear}</span>
              <button onClick={goForward} className="p-1.5 rounded-lg hover:bg-white/20 dark:hover:bg-white/10 transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
                <div key={d} className="text-center text-[10px] font-medium text-muted-foreground uppercase">{d}</div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (day === null) return <div key={`e-${i}`} />

                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const isDisabled = dateStr < ssimStart || dateStr > ssimEnd
                const isToday = dateStr === today
                const isInRange = rangeFrom && rangeTo && dateStr >= rangeFrom && dateStr <= rangeTo
                const isStart = dateStr === rangeFrom
                const isEnd = dateStr === rangeTo
                const isOnlyStart = isStart && !rangeTo
                const hasFlights = flightDaysInMonth.has(day)

                return (
                  <button
                    key={day}
                    disabled={isDisabled}
                    onClick={() => handleDateClick(dateStr)}
                    className={cn(
                      'relative h-8 w-full rounded-md text-xs font-medium transition-all',
                      isDisabled && 'text-muted-foreground/25 cursor-not-allowed',
                      !isDisabled && !isInRange && !isOnlyStart && 'hover:bg-white/20 dark:hover:bg-white/10',
                      isInRange && !isStart && !isEnd && 'bg-primary/10 text-primary',
                      (isStart || isEnd || isOnlyStart) && 'bg-primary text-primary-foreground',
                      isToday && !isInRange && !isStart && !isEnd && !isDisabled && 'ring-1 ring-primary/50',
                    )}
                  >
                    {day}
                    {hasFlights && !isDisabled && (
                      <span className={cn(
                        'absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full',
                        (isStart || isEnd || isOnlyStart) ? 'bg-primary-foreground' : 'bg-primary/60'
                      )} />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-primary" />
                Selected range
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="w-1 h-1 rounded-full bg-primary/60" />
                Flight operations
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="w-3 h-3 rounded-md ring-1 ring-primary/50" />
                Today
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Import Mode + Auto-Create Options — side by side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,1fr] gap-3">
        {/* Import Mode */}
        <div className="rounded-2xl glass p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider">Import Mode</h3>
          <div className="space-y-2">
            {([
              { value: 'replace' as const, label: 'Replace', desc: replaceDesc },
              { value: 'merge' as const, label: 'Merge', desc: 'Add new flights, update existing (match by flight number + variation)' },
              { value: 'preview' as const, label: 'Preview Only', desc: 'Dry run — validate and report without writing any data' },
            ]).map(opt => (
              <label
                key={opt.value}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors',
                  importMode === opt.value
                    ? 'bg-primary/10 ring-1 ring-primary/20'
                    : 'hover:bg-white/30 dark:hover:bg-white/5'
                )}
              >
                <input
                  type="radio"
                  name="importMode"
                  value={opt.value}
                  checked={importMode === opt.value}
                  onChange={() => onModeChange(opt.value)}
                  className="mt-1 accent-primary"
                />
                <div>
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-xs text-muted-foreground">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Auto-Create Options */}
        <div className="rounded-2xl glass p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider">Auto-Create Options</h3>
          <div className="space-y-3">
            <ToggleOption
              checked={autoCreateAirports}
              onChange={onAutoAirportsChange}
              label="Create missing airports"
              desc="Auto-create airport records for IATA codes not in the database"
            />
            <ToggleOption
              checked={autoCreateCityPairs}
              onChange={onAutoCityPairsChange}
              label="Create missing city pairs"
              desc="Auto-create city pair records for new routes"
            />
            <ToggleOption
              checked={autoMapAircraft}
              onChange={onAutoAircraftChange}
              label="Map aircraft types automatically"
              desc="Map IATA 3-letter codes to ICAO types (320 → A320)"
            />
          </div>
        </div>
      </div>

      {/* ── Actions ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          Back to Preview
        </Button>
        <Button size="sm" onClick={onImport} disabled={!selectedSeason || filteredFlightCount === 0}>
          {importMode === 'preview' ? (
            <>
              <Info className="h-4 w-4 mr-2" />
              Preview {filteredFlightCount.toLocaleString()} Flights
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Import {filteredFlightCount.toLocaleString()} Flights
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// ─── STEP 4: Importing (Chunked Progress) ──────────────────────────

function ImportingStep({ progress }: { progress: ImportProgress }) {
  return (
    <div className="rounded-2xl glass p-8 space-y-6 min-h-[300px]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 text-primary animate-spin" />
        <h3 className="text-lg font-medium">Importing Flight Schedule</h3>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{progress.phase}</span>
          <span className="font-medium text-primary">{progress.percent}%</span>
        </div>
        {progress.detail && (
          <p className="text-xs text-muted-foreground">{progress.detail}</p>
        )}
      </div>

      {/* Completed steps */}
      <div className="space-y-2">
        {progress.completedSteps.map((step, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>{step.label}</span>
            {step.detail && (
              <span className="text-muted-foreground">— {step.detail}</span>
            )}
          </div>
        ))}
        {progress.currentStep && (
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
            <span className="text-primary">{progress.currentStep}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── STEP 5: Results ───────────────────────────────────────────────

function ResultsStep({
  result,
  isPreview,
  onReset,
}: {
  result: ImportResults
  isPreview: boolean
  onReset: () => void
}) {
  const hasErrors = result.errors > 0
  const [showErrors, setShowErrors] = useState(false)

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className={cn(
        'rounded-2xl glass p-6',
        hasErrors ? 'border-l-4 border-l-amber-500' : 'border-l-4 border-l-emerald-500'
      )}>
        <div className="flex items-center gap-3 mb-4">
          {hasErrors ? (
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          ) : (
            <CheckCircle className="h-5 w-5 text-emerald-500" />
          )}
          <h3 className="font-medium text-lg">
            {isPreview
              ? 'Preview Complete'
              : hasErrors
                ? 'Import Completed with Errors'
                : 'Import Completed Successfully'
            }
          </h3>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <ResultStat label={isPreview ? 'Would Create' : 'Created'} value={result.created} color="text-emerald-600 dark:text-emerald-400" />
          <ResultStat label="Errors" value={result.errors} color={result.errors > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'} />
          <ResultStat label="Airports Created" value={result.airportsCreated} color="text-blue-600 dark:text-blue-400" />
          <ResultStat label="City Pairs Created" value={result.cityPairsCreated} color="text-blue-600 dark:text-blue-400" />
          <ResultStat label="Block Hours Seeded" value={result.cityPairBlockTimesUpdated} color="text-violet-600 dark:text-violet-400" />
        </div>
      </div>

      {/* Error details */}
      {hasErrors && result.errorDetails.length > 0 && (
        <div className="rounded-2xl glass p-4">
          <button
            onClick={() => setShowErrors(!showErrors)}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400"
          >
            <XCircle className="h-3.5 w-3.5" />
            {result.errorDetails.length} Error(s)
            <ChevronRight className={cn('h-3 w-3 transition-transform', showErrors && 'rotate-90')} />
          </button>
          {showErrors && (
            <div className="mt-3 space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
              {result.errorDetails.map((e, i) => (
                <div key={i} className="text-xs font-mono text-muted-foreground">
                  {e.line > 0 && `Line ${e.line}: `}{e.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Import Another File
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a href="/network/control/schedule-builder">
            View in Schedule Builder
            <ChevronRight className="h-4 w-4 ml-2" />
          </a>
        </Button>
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────

function StatCard({
  value,
  label,
  icon,
  sub,
}: {
  value: number
  label: string
  icon: React.ReactNode
  sub?: string
}) {
  return (
    <div className="rounded-2xl glass p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-semibold">{value.toLocaleString()}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  )
}

function ValidationCheck({
  pass,
  warn,
  label,
}: {
  pass: boolean
  warn?: boolean
  label: string
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {pass && !warn ? (
        <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
      ) : warn ? (
        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
      )}
      <span className={cn(
        warn ? 'text-amber-700 dark:text-amber-300' : pass ? '' : 'text-red-700 dark:text-red-300'
      )}>
        {label}
      </span>
    </div>
  )
}

function ToggleOption({
  checked,
  onChange,
  label,
  desc,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  desc: string
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 rounded accent-primary"
      />
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </label>
  )
}

function ResultStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className={cn('text-2xl font-semibold', color)}>{value.toLocaleString()}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
  } catch {
    return iso
  }
}
