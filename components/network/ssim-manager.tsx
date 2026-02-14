'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import { ScheduleSeason, AircraftType } from '@/types/database'
import { parseSsim, type SsimRecord } from '@/lib/ssim'
import { importSsimRecords } from '@/app/actions/ssim'
import { generateSsimExport } from '@/app/actions/ssim'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Upload, Download, FileText, AlertTriangle, Check, Loader2, ChevronDown, ChevronRight, Copy } from 'lucide-react'

interface SsimManagerProps {
  seasons: ScheduleSeason[]
  aircraftTypes: AircraftType[]
  operatorIataCode: string
}

type ImportStatus = 'New' | 'Updated' | 'Unchanged' | 'Error'

interface PreviewRow extends SsimRecord {
  status: ImportStatus
}

export function SsimManager({ seasons, aircraftTypes, operatorIataCode }: SsimManagerProps) {
  const [mode, setMode] = useState<'upload' | 'download'>('upload')

  // Upload state
  const [selectedSeason, setSelectedSeason] = useState(seasons[0]?.id || '')
  const [rawContent, setRawContent] = useState('')
  const [filename, setFilename] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [parseErrors, setParseErrors] = useState<{ line: number; message: string; raw: string }[]>([])
  const [showErrors, setShowErrors] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    newCount: number; updatedCount: number; unchangedCount: number; errorCount: number
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Download state
  const [dlSeason, setDlSeason] = useState(seasons[0]?.id || '')
  const [dlAcType, setDlAcType] = useState('')
  const [generating, setGenerating] = useState(false)
  const [ssimOutput, setSsimOutput] = useState('')
  const [ssimCount, setDlCount] = useState(0)

  const dlActiveSeason = seasons.find(s => s.id === dlSeason)

  // ── File handling ──
  const handleFile = useCallback((file: File) => {
    setFilename(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setRawContent(text)
      doParse(text)
    }
    reader.readAsText(file)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handlePaste = (text: string) => {
    setRawContent(text)
    setFilename(null)
    if (text.trim().length > 10) doParse(text)
  }

  // ── Parse ──
  function doParse(content: string) {
    const result = parseSsim(content)
    setParseErrors(result.errors)

    const rows: PreviewRow[] = result.records.map(rec => ({
      ...rec,
      status: rec.errors.length > 0 ? 'Error' as const : 'New' as const,
    }))
    setPreview(rows)
    setImportResult(null)
  }

  // ── Import ──
  async function handleImport() {
    if (!preview || !selectedSeason) return
    setImporting(true)

    const validRecords = preview.filter(r => r.status !== 'Error')
    const res = await importSsimRecords({
      season_id: selectedSeason,
      filename,
      records: validRecords.map(r => ({
        flightNumber: r.flightNumber,
        departureIata: r.departureIata,
        arrivalIata: r.arrivalIata,
        std: r.std,
        sta: r.sta,
        daysOfWeek: r.daysOfWeek,
        aircraftType: r.aircraftType,
        serviceType: r.serviceType,
        effectiveFrom: r.effectiveFrom,
        effectiveTo: r.effectiveTo,
      })),
    })

    setImportResult(res)
    setImporting(false)
  }

  // ── Download ──
  async function handleGenerate() {
    if (!dlSeason || !dlActiveSeason) return
    setGenerating(true)
    const res = await generateSsimExport({
      season_id: dlSeason,
      carrier_code: operatorIataCode || 'XX',
      season_code: dlActiveSeason.code,
      filter_aircraft_type: dlAcType || undefined,
    })
    if (res.error) {
      setSsimOutput(`Error: ${res.error}`)
    } else {
      setSsimOutput(res.content)
    }
    setDlCount(res.count)
    setGenerating(false)
  }

  function downloadFile() {
    if (!ssimOutput) return
    const blob = new Blob([ssimOutput], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${operatorIataCode || 'HZ'}_${dlActiveSeason?.code || 'S25'}.ssim`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Summary counts ──
  const summary = useMemo(() => {
    if (!preview) return null
    const counts = { total: preview.length, new: 0, updated: 0, unchanged: 0, error: 0 }
    preview.forEach(r => {
      if (r.status === 'New') counts.new++
      else if (r.status === 'Updated') counts.updated++
      else if (r.status === 'Unchanged') counts.unchanged++
      else if (r.status === 'Error') counts.error++
    })
    return counts
  }, [preview])

  const STATUS_COLORS: Record<ImportStatus, string> = {
    New: 'bg-green-500/10 text-green-600',
    Updated: 'bg-blue-500/10 text-blue-600',
    Unchanged: 'bg-muted text-muted-foreground',
    Error: 'bg-red-500/10 text-red-600',
  }

  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('upload')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm rounded-md border transition-colors',
            mode === 'upload' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input hover:bg-muted',
          )}
        ><Upload className="w-4 h-4" /> Upload (Import)</button>
        <button
          onClick={() => setMode('download')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm rounded-md border transition-colors',
            mode === 'download' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input hover:bg-muted',
          )}
        ><Download className="w-4 h-4" /> Download (Export)</button>
      </div>

      {/* ═══════ UPLOAD ═══════ */}
      {mode === 'upload' && (
        <div className="space-y-4">
          {/* Season selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Import into Season</label>
            <select value={selectedSeason} onChange={e => setSelectedSeason(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              {seasons.map(s => <option key={s.id} value={s.id}>{s.code} &mdash; {s.name}</option>)}
            </select>
          </div>

          {/* Input methods */}
          {!preview ? (
            <div className="grid md:grid-cols-2 gap-4">
              {/* File drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
              >
                <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Drop .ssim or .txt file here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                <input ref={fileInputRef} type="file" accept=".ssim,.txt,.csv" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
              </div>

              {/* Paste area */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Or paste raw SSIM content</label>
                <textarea
                  value={rawContent}
                  onChange={e => handlePaste(e.target.value)}
                  placeholder="Paste SSIM Chapter 7 records here..."
                  className="w-full h-[180px] rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          ) : (
            <>
              {/* Summary bar */}
              <div className="flex flex-wrap gap-3 text-sm border rounded-lg p-3 bg-muted/20">
                <span>Parsed <strong>{summary?.total}</strong> records:</span>
                <span className="text-green-600"><strong>{summary?.new}</strong> new</span>
                <span className="text-blue-600"><strong>{summary?.updated}</strong> updated</span>
                <span className="text-muted-foreground"><strong>{summary?.unchanged}</strong> unchanged</span>
                {(summary?.error || 0) > 0 && (
                  <span className="text-red-600"><strong>{summary?.error}</strong> errors</span>
                )}
                {filename && <span className="text-muted-foreground ml-auto">{filename}</span>}
              </div>

              {/* Error section */}
              {parseErrors.length > 0 && (
                <div className="border border-red-500/30 rounded-lg bg-red-500/5">
                  <button
                    onClick={() => setShowErrors(!showErrors)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-500/5"
                  >
                    {showErrors ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <AlertTriangle className="w-4 h-4" />
                    {parseErrors.length} parse error{parseErrors.length !== 1 ? 's' : ''}
                  </button>
                  {showErrors && (
                    <div className="px-3 pb-3 space-y-1 max-h-[200px] overflow-auto">
                      {parseErrors.map((e, i) => (
                        <div key={i} className="text-xs">
                          <span className="font-mono text-red-500">Line {e.line}:</span>{' '}
                          <span className="text-red-600">{e.message}</span>
                          <div className="font-mono text-[10px] text-muted-foreground truncate mt-0.5">{e.raw}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Preview table */}
              <div className="border rounded-lg overflow-auto max-h-[400px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10">
                    <tr className="border-b">
                      <th className="px-2 py-1.5 text-left font-medium">Flight</th>
                      <th className="px-2 py-1.5 text-left font-medium">DEP</th>
                      <th className="px-2 py-1.5 text-left font-medium">ARR</th>
                      <th className="px-2 py-1.5 text-left font-medium">STD</th>
                      <th className="px-2 py-1.5 text-left font-medium">STA</th>
                      <th className="px-2 py-1.5 text-left font-medium">DOW</th>
                      <th className="px-2 py-1.5 text-left font-medium">A/C</th>
                      <th className="px-2 py-1.5 text-left font-medium">Effective</th>
                      <th className="px-2 py-1.5 text-left font-medium">Svc</th>
                      <th className="px-2 py-1.5 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className={cn('border-b', row.status === 'Error' && 'bg-red-500/5')}>
                        <td className="px-2 py-1 font-mono font-medium">{row.flightNumber}</td>
                        <td className="px-2 py-1 font-mono">{row.departureIata}</td>
                        <td className="px-2 py-1 font-mono">{row.arrivalIata}</td>
                        <td className="px-2 py-1 font-mono">{row.std}</td>
                        <td className="px-2 py-1 font-mono">{row.sta}</td>
                        <td className="px-2 py-1 font-mono">{row.daysOfWeek}</td>
                        <td className="px-2 py-1 font-mono">{row.aircraftType}</td>
                        <td className="px-2 py-1 font-mono text-muted-foreground">
                          {row.effectiveFrom && row.effectiveTo
                            ? `${row.effectiveFrom} — ${row.effectiveTo}`
                            : row.effectiveFrom || '—'}
                        </td>
                        <td className="px-2 py-1">{row.serviceType}</td>
                        <td className="px-2 py-1">
                          <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', STATUS_COLORS[row.status])}
                            title={row.errors.length > 0 ? row.errors.join('; ') : undefined}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Import result */}
              {importResult && (
                <div className="border rounded-lg p-4 bg-green-500/5 border-green-500/30">
                  <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                    <Check className="w-4 h-4" /> Import complete
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {importResult.newCount} created, {importResult.updatedCount} updated,{' '}
                    {importResult.unchangedCount} unchanged, {importResult.errorCount} errors
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={() => { setPreview(null); setRawContent(''); setFilename(null); setImportResult(null) }}>
                  Clear
                </Button>
                <Button onClick={handleImport} disabled={importing || !preview.some(r => r.status !== 'Error')}>
                  {importing
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</>
                    : <><Upload className="w-4 h-4 mr-2" />Import {(summary?.new || 0) + (summary?.updated || 0)} Records</>}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════ DOWNLOAD ═══════ */}
      {mode === 'download' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Season</label>
              <select value={dlSeason} onChange={e => setDlSeason(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                {seasons.map(s => <option key={s.id} value={s.id}>{s.code} &mdash; {s.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Aircraft Type (optional)</label>
              <select value={dlAcType} onChange={e => setDlAcType(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">All Types</option>
                {aircraftTypes.map(t => <option key={t.id} value={t.id}>{t.icao_type} &mdash; {t.name}</option>)}
              </select>
            </div>

            <Button onClick={handleGenerate} disabled={generating}>
              {generating
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                : <><FileText className="w-4 h-4 mr-2" />Generate SSIM</>}
            </Button>
          </div>

          {ssimOutput && (
            <>
              <div className="text-xs text-muted-foreground">
                Generated {ssimCount} flight records for {dlActiveSeason?.code}
              </div>

              <div className="relative">
                <textarea
                  readOnly
                  value={ssimOutput}
                  className="w-full h-[300px] rounded-md border border-input bg-muted/30 px-3 py-2 text-[11px] font-mono resize-none focus:outline-none"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(ssimOutput)}
                  className="absolute top-2 right-2 p-1.5 rounded bg-background/80 border hover:bg-muted transition-colors"
                  title="Copy to clipboard"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>

              <Button onClick={downloadFile}>
                <Download className="w-4 h-4 mr-2" /> Download .ssim
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
