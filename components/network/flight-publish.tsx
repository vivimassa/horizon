'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ScheduleSeason, AircraftType, FlightServiceType, FlightNumber } from '@/types/database'
import { getFlightNumbers } from '@/app/actions/flight-numbers'
import { publishFlights, countConflicts } from '@/app/actions/flights'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Check, AlertTriangle, ArrowRight, ArrowLeft, Loader2, Plane } from 'lucide-react'

// ─── Helpers ─────────────────────────────────────────────────

function dateToDow(dateStr: string): string {
  const jsDay = new Date(dateStr + 'T12:00:00Z').getUTCDay()
  return String(jsDay === 0 ? 7 : jsDay)
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split('T')[0]
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

const DOW_SHORT = ['', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

// ─── Props ───────────────────────────────────────────────────

interface FlightPublishProps {
  seasons: ScheduleSeason[]
  aircraftTypes: AircraftType[]
  flightServiceTypes: FlightServiceType[]
}

// ─── Component ───────────────────────────────────────────────

export function FlightPublish({ seasons, aircraftTypes, flightServiceTypes }: FlightPublishProps) {
  const router = useRouter()
  const [step, setStep] = useState(1)

  // Step 1
  const [selectedSeason, setSelectedSeason] = useState(seasons[0]?.id || '')
  const [useCustomRange, setUseCustomRange] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [flightNumbers, setFlightNumbers] = useState<FlightNumber[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loadingFn, setLoadingFn] = useState(false)
  const [filterAcType, setFilterAcType] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [filterSvcType, setFilterSvcType] = useState('')

  // Step 2
  const [conflicts, setConflicts] = useState(0)
  const [skipExisting, setSkipExisting] = useState(true)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Step 3
  const [publishing, setPublishing] = useState(false)
  const [result, setResult] = useState<{ created: number; skipped: number; errors: number } | null>(null)

  // Derived
  const activeSeason = seasons.find(s => s.id === selectedSeason)
  const startDate = useCustomRange ? customFrom : (activeSeason?.start_date || '')
  const endDate = useCustomRange ? customTo : (activeSeason?.end_date || '')

  const acTypeMap = useMemo(() => {
    const m = new Map<string, AircraftType>()
    aircraftTypes.forEach(t => m.set(t.id, t))
    return m
  }, [aircraftTypes])

  // Load flight numbers when season changes
  useEffect(() => {
    if (!selectedSeason) return
    setLoadingFn(true)
    getFlightNumbers(selectedSeason).then(data => {
      setFlightNumbers(data)
      setSelectedIds(new Set(data.map(f => f.id)))
      setLoadingFn(false)
    })
  }, [selectedSeason])

  // Filtered list for display
  const filteredFn = useMemo(() => {
    return flightNumbers.filter(f => {
      if (filterSearch && !f.flight_number.toLowerCase().includes(filterSearch.toLowerCase()) &&
          !`${f.departure_iata}-${f.arrival_iata}`.toLowerCase().includes(filterSearch.toLowerCase())) return false
      if (filterAcType && f.aircraft_type_id !== filterAcType) return false
      if (filterSvcType && f.service_type !== filterSvcType) return false
      return true
    })
  }, [flightNumbers, filterSearch, filterAcType, filterSvcType])

  // Preview: compute total flights to create
  const preview = useMemo(() => {
    if (!startDate || !endDate || selectedIds.size === 0) {
      return { total: 0, days: 0, flightCount: selectedIds.size, byDate: new Map<string, number>() }
    }

    const selected = flightNumbers.filter(f => selectedIds.has(f.id))
    let total = 0
    const byDate = new Map<string, number>()
    let cur = startDate

    while (cur <= endDate) {
      let dayCount = 0
      for (const fn of selected) {
        const dow = dateToDow(cur)
        if (fn.days_of_week.includes(dow)) {
          const inRange =
            (!fn.effective_from || cur >= fn.effective_from) &&
            (!fn.effective_until || cur <= fn.effective_until)
          if (inRange) { dayCount++; total++ }
        }
      }
      if (dayCount > 0) byDate.set(cur, dayCount)
      cur = addDays(cur, 1)
    }

    return { total, days: byDate.size, flightCount: selectedIds.size, byDate }
  }, [startDate, endDate, selectedIds, flightNumbers])

  // ── Handlers ──

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === flightNumbers.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(flightNumbers.map(f => f.id)))
    }
  }

  function selectFiltered() {
    setSelectedIds(new Set(filteredFn.map(f => f.id)))
  }

  async function goToStep2() {
    setPreviewLoading(true)
    const selected = flightNumbers.filter(f => selectedIds.has(f.id))
    const cnt = await countConflicts({
      flight_numbers: selected.map(f => f.flight_number),
      start_date: startDate,
      end_date: endDate,
    })
    setConflicts(cnt)
    setPreviewLoading(false)
    setStep(2)
  }

  async function handlePublish() {
    setPublishing(true)
    setResult(null)
    const res = await publishFlights({
      flight_number_ids: Array.from(selectedIds),
      start_date: startDate,
      end_date: endDate,
      skip_existing: skipExisting,
    })
    setResult(res)
    setPublishing(false)
    setStep(3)
  }

  // ── Mini calendar for preview ──
  function renderCalendarPreview() {
    if (!startDate || !endDate) return null

    // Generate weeks
    const weeks: { date: string; count: number; inRange: boolean }[][] = []
    let cur = startDate
    // Go back to Monday
    while (dateToDow(cur) !== '1') cur = addDays(cur, -1)

    const calEnd = endDate
    const weekEnd = addDays(calEnd, 7)

    let currentWeek: { date: string; count: number; inRange: boolean }[] = []
    while (cur <= weekEnd) {
      const inRange = cur >= startDate && cur <= endDate
      currentWeek.push({
        date: cur,
        count: preview.byDate.get(cur) || 0,
        inRange,
      })
      if (currentWeek.length === 7) {
        if (currentWeek.some(d => d.inRange)) weeks.push(currentWeek)
        currentWeek = []
      }
      cur = addDays(cur, 1)
    }

    return (
      <div className="border rounded-lg p-4 bg-muted/20">
        <div className="text-xs font-medium text-muted-foreground mb-2">Calendar Preview</div>
        <div className="grid grid-cols-7 gap-px text-xs">
          {DOW_SHORT.slice(1).map(d => (
            <div key={d} className="text-center font-medium text-muted-foreground py-1">{d}</div>
          ))}
          {weeks.map((week, wi) =>
            week.map((day, di) => (
              <div
                key={`${wi}-${di}`}
                className={cn(
                  'text-center py-1 rounded-sm',
                  !day.inRange && 'opacity-20',
                  day.inRange && day.count > 0 && 'bg-primary/15 font-medium',
                  day.inRange && day.count === 0 && 'text-muted-foreground',
                )}
                title={day.inRange ? `${day.date}: ${day.count} flights` : undefined}
              >
                <div className="text-[10px] text-muted-foreground">{day.date.split('-')[2]}</div>
                {day.inRange && day.count > 0 && (
                  <div className="text-xs font-mono text-primary">{day.count}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // ── No seasons ──
  if (!seasons.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No schedule seasons found</p>
        <p className="text-sm mt-1">Create a schedule season in Admin &rarr; Network Config first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {[
          { n: 1, label: 'Select Scope' },
          { n: 2, label: 'Preview' },
          { n: 3, label: 'Publish' },
        ].map(({ n, label }) => (
          <div key={n} className="flex items-center gap-2">
            {n > 1 && <div className={cn('w-8 h-px', step >= n ? 'bg-primary' : 'bg-border')} />}
            <div className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors',
              step === n && 'bg-primary text-primary-foreground',
              step > n && 'bg-primary/10 text-primary',
              step < n && 'bg-muted text-muted-foreground',
            )}>
              {step > n ? <Check className="w-3 h-3" /> : <span>{n}</span>}
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* ═══════ Step 1: Select Scope ═══════ */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Date range source */}
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Source</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setUseCustomRange(false)}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-md border transition-colors',
                    !useCustomRange ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input hover:bg-muted',
                  )}
                >Season</button>
                <button
                  onClick={() => setUseCustomRange(true)}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-md border transition-colors',
                    useCustomRange ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input hover:bg-muted',
                  )}
                >Custom Range</button>
              </div>
            </div>

            {!useCustomRange ? (
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Season</label>
                <select
                  value={selectedSeason}
                  onChange={e => setSelectedSeason(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {seasons.map(s => <option key={s.id} value={s.id}>{s.code} &mdash; {s.name}</option>)}
                </select>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">From</label>
                  <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">To</label>
                  <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
                </div>
              </>
            )}

            {startDate && endDate && (
              <div className="text-xs text-muted-foreground pb-1">
                {formatDate(startDate)} &rarr; {formatDate(endDate)}
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <input
              placeholder="Search flight or route..."
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm w-48"
            />
            <select value={filterAcType} onChange={e => setFilterAcType(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">All A/C Types</option>
              {aircraftTypes.map(t => <option key={t.id} value={t.id}>{t.icao_type}</option>)}
            </select>
            <select value={filterSvcType} onChange={e => setFilterSvcType(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">All Services</option>
              {flightServiceTypes.map(s => <option key={s.code} value={s.code}>{s.code} &mdash; {s.name}</option>)}
            </select>
            <Button variant="outline" size="sm" onClick={selectFiltered} className="h-8 text-xs">
              Select Filtered
            </Button>
          </div>

          {/* Flight number list */}
          {loadingFn ? (
            <div className="text-center py-8 text-muted-foreground">Loading flight numbers...</div>
          ) : (
            <div className="border rounded-lg overflow-auto max-h-[400px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background z-10">
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left w-10">
                      <input type="checkbox"
                        checked={selectedIds.size === flightNumbers.length && flightNumbers.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-input" />
                    </th>
                    <th className="px-3 py-2 text-left font-medium">Flight</th>
                    <th className="px-3 py-2 text-left font-medium">Route</th>
                    <th className="px-3 py-2 text-left font-medium">DOW</th>
                    <th className="px-3 py-2 text-left font-medium">STD</th>
                    <th className="px-3 py-2 text-left font-medium">A/C Type</th>
                    <th className="px-3 py-2 text-left font-medium">Svc</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFn.map(f => {
                    const acType = f.aircraft_type_id ? acTypeMap.get(f.aircraft_type_id) : null
                    return (
                      <tr key={f.id} className={cn(
                        'border-b hover:bg-muted/30 cursor-pointer transition-colors',
                        selectedIds.has(f.id) && 'bg-primary/5',
                      )} onClick={() => toggleSelect(f.id)}>
                        <td className="px-3 py-1.5">
                          <input type="checkbox" checked={selectedIds.has(f.id)} readOnly className="rounded border-input" />
                        </td>
                        <td className="px-3 py-1.5 font-mono font-medium">{f.flight_number}</td>
                        <td className="px-3 py-1.5 font-mono text-muted-foreground">{f.departure_iata}&rarr;{f.arrival_iata}</td>
                        <td className="px-3 py-1.5 font-mono text-xs">
                          {DOW_SHORT.slice(1).map((d, i) => (
                            <span key={i} className={cn(
                              'inline-block w-4 text-center',
                              f.days_of_week.includes(String(i + 1)) ? 'text-foreground font-medium' : 'text-muted-foreground/30',
                            )}>{d[0]}</span>
                          ))}
                        </td>
                        <td className="px-3 py-1.5 font-mono">{f.std}</td>
                        <td className="px-3 py-1.5 font-mono text-xs">{acType?.icao_type || '\u2014'}</td>
                        <td className="px-3 py-1.5 text-xs">{f.service_type}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Selection summary + Next */}
          <div className="flex items-center justify-between border-t pt-4">
            <div className="text-sm text-muted-foreground">
              {selectedIds.size} of {flightNumbers.length} flight numbers selected
            </div>
            <Button
              onClick={goToStep2}
              disabled={selectedIds.size === 0 || !startDate || !endDate || previewLoading}
            >
              {previewLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Checking...</>
              ) : (
                <>Next: Preview <ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ═══════ Step 2: Preview ═══════ */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Flights to Create</div>
              <div className="text-2xl font-bold font-mono">{preview.total.toLocaleString()}</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Operating Days</div>
              <div className="text-2xl font-bold font-mono">{preview.days}</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Flight Numbers</div>
              <div className="text-2xl font-bold font-mono">{preview.flightCount}</div>
            </div>
            <div className={cn('border rounded-lg p-3', conflicts > 0 && 'border-amber-500/50 bg-amber-500/5')}>
              <div className="text-xs text-muted-foreground">Existing Conflicts</div>
              <div className={cn('text-2xl font-bold font-mono', conflicts > 0 && 'text-amber-600')}>
                {conflicts}
              </div>
            </div>
          </div>

          {/* Summary text */}
          <p className="text-sm">
            This will create <strong>{preview.total.toLocaleString()} flights</strong> across{' '}
            <strong>{preview.days} days</strong> for{' '}
            <strong>{preview.flightCount} flight numbers</strong>
            {startDate && endDate && <> from <strong>{formatDate(startDate)}</strong> to <strong>{formatDate(endDate)}</strong></>}.
          </p>

          {/* Conflict warning */}
          {conflicts > 0 && (
            <div className="flex items-start gap-3 border border-amber-500/50 bg-amber-500/5 rounded-lg p-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-700">
                  {conflicts} flight{conflicts !== 1 ? 's' : ''} conflict with existing published flights
                </p>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="conflict" checked={skipExisting}
                      onChange={() => setSkipExisting(true)} className="text-primary" />
                    <span>Skip existing (recommended)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="conflict" checked={!skipExisting}
                      onChange={() => setSkipExisting(false)} className="text-primary" />
                    <span>Overwrite existing</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Calendar preview */}
          {renderCalendarPreview()}

          {/* Navigation */}
          <div className="flex items-center justify-between border-t pt-4">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            <Button onClick={handlePublish} disabled={publishing}>
              {publishing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Publishing...</>
              ) : (
                <><Plane className="w-4 h-4 mr-2" /> Publish {preview.total.toLocaleString()} Flights</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ═══════ Step 3: Results ═══════ */}
      {step === 3 && (
        <div className="space-y-6">
          {publishing ? (
            <div className="text-center py-12 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Publishing flights...</p>
              <div className="w-64 mx-auto h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          ) : result ? (
            <div className="text-center py-8 space-y-4">
              {result.errors === 0 ? (
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-8 h-8 text-amber-600" />
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold">
                  {result.created.toLocaleString()} flights published
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {result.skipped > 0 && <>{result.skipped} skipped (already exist). </>}
                  {result.errors > 0 && <span className="text-red-500">{result.errors} errors.</span>}
                  {result.errors === 0 && result.skipped === 0 && 'No errors.'}
                </p>
              </div>

              {/* Result stats */}
              <div className="flex justify-center gap-6 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold font-mono text-green-600">{result.created}</div>
                  <div className="text-muted-foreground text-xs">Created</div>
                </div>
                {result.skipped > 0 && (
                  <div className="text-center">
                    <div className="text-2xl font-bold font-mono text-amber-600">{result.skipped}</div>
                    <div className="text-muted-foreground text-xs">Skipped</div>
                  </div>
                )}
                {result.errors > 0 && (
                  <div className="text-center">
                    <div className="text-2xl font-bold font-mono text-red-600">{result.errors}</div>
                    <div className="text-muted-foreground text-xs">Errors</div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex justify-center gap-3 pt-4">
                <Button variant="outline" onClick={() => { setStep(1); setResult(null) }}>
                  Publish More
                </Button>
                <Button onClick={() => router.push('/operations/control')}>
                  View in Operations <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
