'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  BarChart3, Download, Calendar, Loader2, X, Check,
  ChevronDown, ChevronUp, Filter, Printer,
} from 'lucide-react'
import { AircraftWithRelations } from '@/app/actions/aircraft-registrations'
import { AircraftType } from '@/types/database'
import { getFleetUtilization, type FleetUtilizationRow } from '@/app/actions/report-fleet-utilization'
import { AC_TYPE_COLOR_PALETTE } from '@/lib/constants/gantt-settings'
import { toast } from '@/components/ui/visionos-toast'

// ─── Types ──────────────────────────────────────────────────────

interface Props {
  registrations: AircraftWithRelations[]
  aircraftTypes: AircraftType[]
}

interface AircraftSummary {
  registration: string
  icaoType: string
  totalBlockMinutes: number
  totalSectors: number
  dailyBlocks: Map<string, number>
  dailySectors: Map<string, number>
  avgBlockPerDay: number
  utilPct: number
  avgSectorsPerDay: number
}

type SortBy = 'reg' | 'util' | 'sectors'
type GroupBy = 'type' | 'none'

// ─── Helpers ────────────────────────────────────────────────────

function parseDate(s: string): Date { return new Date(s + 'T00:00:00') }

function formatISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isoToDisplay(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function parseUserDate(text: string): string | null {
  const stripped = text.replace(/[/\-\.]/g, '')
  if (/^\d{8}$/.test(stripped)) {
    const d = stripped.slice(0, 2), m = stripped.slice(2, 4), y = stripped.slice(4, 8)
    const num = new Date(`${y}-${m}-${d}T00:00:00`)
    if (!isNaN(num.getTime())) return `${y}-${m}-${d}`
  }
  return null
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

/** Format minutes as HH:MM. Works for totals >24h (e.g., 520:48). */
function formatBlockTime(minutes: number): string {
  if (!minutes || minutes <= 0) return '0:00'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

function buildAcTypeColorMap(types: string[]): Map<string, string> {
  const map = new Map<string, string>()
  const sorted = [...types].sort()
  sorted.forEach((t, i) => map.set(t, AC_TYPE_COLOR_PALETTE[i % AC_TYPE_COLOR_PALETTE.length]))
  return map
}

function diffDays(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000) + 1
}

function getAllDates(start: string, end: string): string[] {
  const dates: string[] = []
  let current = parseDate(start)
  const endDate = parseDate(end)
  while (current <= endDate) {
    dates.push(formatISO(current))
    current = addDays(current, 1)
  }
  return dates
}

function heatColor(blockMinutes: number): string {
  const hours = blockMinutes / 60
  if (hours <= 0) return 'rgba(255,255,255,0.03)'
  if (hours < 6) return 'rgba(59,130,246,0.12)'
  if (hours < 10) return 'rgba(59,130,246,0.25)'
  if (hours < 13) return 'rgba(59,130,246,0.45)'
  if (hours < 16) return 'rgba(245,158,11,0.4)'
  return 'rgba(239,68,68,0.4)'
}

function utilBarColor(pct: number): string {
  if (pct < 50) return '#22c55e'
  if (pct < 75) return '#3b82f6'
  if (pct < 85) return '#f59e0b'
  return '#ef4444'
}

// ─── Component ──────────────────────────────────────────────────

export function FleetUtilizationReport({ registrations, aircraftTypes }: Props) {
  // ─── Period state ──────────────────────────────────────────────
  const [periodFrom, setPeriodFrom] = useState<string | null>(null)
  const [periodTo, setPeriodTo] = useState<string | null>(null)
  const [fromText, setFromText] = useState('')
  const [toText, setToText] = useState('')
  const calendarRef = useRef<HTMLInputElement>(null)
  const pickTargetRef = useRef<'from' | 'to'>('from')
  const reportContentRef = useRef<HTMLDivElement>(null)

  // ─── Data state ────────────────────────────────────────────────
  const [rawData, setRawData] = useState<FleetUtilizationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loadingPhase, setLoadingPhase] = useState<'idle' | 'fetching' | 'building' | 'done'>('idle')

  // ─── Filter state ──────────────────────────────────────────────
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set())
  const [selectedReg, setSelectedReg] = useState<string>('')
  const [sortBy, setSortBy] = useState<SortBy>('util')
  const [groupBy, setGroupBy] = useState<GroupBy>('type')
  const [detailOpen, setDetailOpen] = useState(true)
  const [filterPanelOpen, setFilterPanelOpen] = useState(true)

  // ─── Dark mode ─────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  // Sync display text
  useEffect(() => { setFromText(periodFrom ? isoToDisplay(periodFrom) : '') }, [periodFrom])
  useEffect(() => { setToText(periodTo ? isoToDisplay(periodTo) : '') }, [periodTo])

  // ─── AC type color map ─────────────────────────────────────────
  const acTypeColorMap = useMemo(
    () => buildAcTypeColorMap(aircraftTypes.map(t => t.icao_type)),
    [aircraftTypes]
  )

  // ─── Fleet counts by type ──────────────────────────────────────
  const fleetCountByType = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of registrations) {
      if (r.status !== 'active' && r.status !== 'operational') continue
      const t = r.aircraft_types?.icao_type
      if (t) m.set(t, (m.get(t) || 0) + 1)
    }
    return m
  }, [registrations])

  // ─── Reg → type lookup ─────────────────────────────────────────
  const regToType = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of registrations) {
      if (r.aircraft_types) m.set(r.registration, r.aircraft_types.icao_type)
    }
    return m
  }, [registrations])

  // ─── Period input handlers ─────────────────────────────────────
  const handleFromBlur = () => {
    if (fromText === '') { setPeriodFrom(null); return }
    const parsed = parseUserDate(fromText)
    if (parsed) setPeriodFrom(parsed)
    else setFromText(periodFrom ? isoToDisplay(periodFrom) : '')
  }
  const handleToBlur = () => {
    if (toText === '') { setPeriodTo(null); return }
    const parsed = parseUserDate(toText)
    if (parsed) setPeriodTo(parsed)
    else setToText(periodTo ? isoToDisplay(periodTo) : '')
  }
  const handleCalendarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const iso = e.target.value
    if (!iso) return
    if (pickTargetRef.current === 'from') {
      setPeriodFrom(iso)
      pickTargetRef.current = 'to'
      setTimeout(() => calendarRef.current?.showPicker?.(), 100)
    } else {
      setPeriodTo(iso)
      pickTargetRef.current = 'from'
    }
  }

  // ─── Go handler ────────────────────────────────────────────────
  const handleGo = useCallback(async () => {
    if (!periodFrom && !periodTo) { toast.warning('Please select a date range first'); return }
    if (!periodFrom) { toast.warning('Please select a From date'); return }
    if (!periodTo) { toast.warning('Please select a To date'); return }
    if (periodFrom > periodTo) { toast.warning('From date must be before To date'); return }

    setLoading(true)
    setLoadingPhase('fetching')

    try {
      const result = await getFleetUtilization(periodFrom, periodTo)
      setLoadingPhase('building')
      setRawData(result)
      setLoaded(true)
      setFilterPanelOpen(false)
      setLoadingPhase('done')
      setTimeout(() => setLoadingPhase('idle'), 1500)
    } catch (err) {
      toast.error('Failed to load utilization data', { description: err instanceof Error ? err.message : String(err) })
      setLoadingPhase('idle')
    } finally {
      setLoading(false)
    }
  }, [periodFrom, periodTo])

  // ─── Computed data ─────────────────────────────────────────────
  const periodDays = useMemo(() => {
    if (!periodFrom || !periodTo) return 0
    return diffDays(periodFrom, periodTo)
  }, [periodFrom, periodTo])

  const allDates = useMemo(() => {
    if (!periodFrom || !periodTo) return []
    return getAllDates(periodFrom, periodTo)
  }, [periodFrom, periodTo])

  // ─── Aggregate per-aircraft summaries ──────────────────────────
  const summaries = useMemo<AircraftSummary[]>(() => {
    if (rawData.length === 0 || periodDays === 0) return []

    const byReg = new Map<string, {
      icaoType: string
      totalBlock: number
      totalSectors: number
      daily: Map<string, number>
      dailySec: Map<string, number>
    }>()

    for (const row of rawData) {
      let entry = byReg.get(row.registration)
      if (!entry) {
        entry = {
          icaoType: row.icaoType || 'UNKN',
          totalBlock: 0,
          totalSectors: 0,
          daily: new Map(),
          dailySec: new Map(),
        }
        byReg.set(row.registration, entry)
      }
      entry.totalBlock += row.blockMinutes
      entry.totalSectors += row.sectorCount
      entry.daily.set(row.date, (entry.daily.get(row.date) || 0) + row.blockMinutes)
      entry.dailySec.set(row.date, (entry.dailySec.get(row.date) || 0) + row.sectorCount)
    }

    const results: AircraftSummary[] = []
    for (const [reg, data] of Array.from(byReg.entries())) {
      const avgBlock = data.totalBlock / periodDays
      results.push({
        registration: reg,
        icaoType: data.icaoType,
        totalBlockMinutes: data.totalBlock,
        totalSectors: data.totalSectors,
        dailyBlocks: data.daily,
        dailySectors: data.dailySec,
        avgBlockPerDay: avgBlock,
        utilPct: (avgBlock / (18 * 60)) * 100,
        avgSectorsPerDay: data.totalSectors / periodDays,
      })
    }

    return results
  }, [rawData, periodDays])

  // ─── Apply filters ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    let items = summaries
    if (selectedTypes.size > 0) {
      items = items.filter(s => selectedTypes.has(s.icaoType))
    }
    if (selectedReg) {
      items = items.filter(s => s.registration === selectedReg)
    }
    return items
  }, [summaries, selectedTypes, selectedReg])

  // ─── Sort ──────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    const items = [...filtered]
    switch (sortBy) {
      case 'reg':
        items.sort((a, b) => a.registration.localeCompare(b.registration))
        break
      case 'util':
        items.sort((a, b) => b.avgBlockPerDay - a.avgBlockPerDay)
        break
      case 'sectors':
        items.sort((a, b) => b.totalSectors - a.totalSectors)
        break
    }
    return items
  }, [filtered, sortBy])

  // ─── Group by type ─────────────────────────────────────────────
  const grouped = useMemo(() => {
    if (groupBy === 'none') return [{ type: 'ALL', items: sorted }]
    const map = new Map<string, AircraftSummary[]>()
    for (const item of sorted) {
      const list = map.get(item.icaoType) || []
      list.push(item)
      map.set(item.icaoType, list)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([type, items]) => ({ type, items }))
  }, [sorted, groupBy])

  // ─── Fleet KPIs ────────────────────────────────────────────────
  const kpis = useMemo(() => {
    if (filtered.length === 0) return null
    const totalMinutes = filtered.reduce((s, a) => s + a.totalBlockMinutes, 0)
    const totalSectors = filtered.reduce((s, a) => s + a.totalSectors, 0)
    const avgBlock = filtered.reduce((s, a) => s + a.avgBlockPerDay, 0) / filtered.length
    const byUtil = [...filtered].sort((a, b) => b.avgBlockPerDay - a.avgBlockPerDay)
    const highest = byUtil[0]
    const lowest = byUtil[byUtil.length - 1]
    const mean = avgBlock
    const variance = filtered.reduce((s, a) => s + Math.pow(a.avgBlockPerDay - mean, 2), 0) / filtered.length
    const stdDev = Math.sqrt(variance)

    return {
      fleetAvg: avgBlock,
      totalMinutes,
      totalSectors,
      highest,
      lowest,
      stdDev,
      aircraftCount: filtered.length,
    }
  }, [filtered])

  // ─── Active filter badges ──────────────────────────────────────
  const activeFilters = useMemo(() => {
    const badges: { label: string; onClear: () => void }[] = []
    if (selectedTypes.size > 0) {
      const label = selectedTypes.size === 1 ? `AC: ${Array.from(selectedTypes)[0]}` : `AC: ${selectedTypes.size} types`
      badges.push({ label, onClear: () => setSelectedTypes(new Set()) })
    }
    if (selectedReg) badges.push({ label: `Reg: ${selectedReg}`, onClear: () => setSelectedReg('') })
    return badges
  }, [selectedTypes, selectedReg])

  // ─── CSV Export ────────────────────────────────────────────────
  const handleExportCSV = useCallback(() => {
    if (sorted.length === 0) return
    const headers = ['Registration', 'Type', 'Avg Block/Day', 'Utilization %', 'Total Hours', 'Sectors', 'Sectors/Day', ...allDates]
    const csvRows = [headers.join(',')]
    for (const s of sorted) {
      const vals = [
        s.registration,
        s.icaoType,
        formatBlockTime(Math.round(s.avgBlockPerDay)),
        s.utilPct.toFixed(1) + '%',
        formatBlockTime(s.totalBlockMinutes),
        s.totalSectors,
        s.avgSectorsPerDay.toFixed(1),
        ...allDates.map(d => formatBlockTime(s.dailyBlocks.get(d) || 0)),
      ]
      csvRows.push(vals.map(v => `"${v}"`).join(','))
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fleet-utilization-${periodFrom}-${periodTo}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${sorted.length} aircraft`)
  }, [sorted, allDates, periodFrom, periodTo])

  // ─── XLSX Export ──────────────────────────────────────────────
  const handleExportXLSX = useCallback(async () => {
    if (sorted.length === 0 || !kpis) return
    toast.info('Generating XLSX...')

    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Horizon Fleet Utilization'
    wb.created = new Date()

    // ── Sheet 1: Summary ──────────────────────────────────────
    const ws1 = wb.addWorksheet('Summary')
    ws1.columns = [
      { header: 'Metric', key: 'metric', width: 28 },
      { header: 'Value', key: 'value', width: 20 },
    ]
    ws1.getRow(1).font = { bold: true, size: 11 }
    ws1.addRow({ metric: 'Report Period', value: `${periodFrom} to ${periodTo}` })
    ws1.addRow({ metric: 'Period Days', value: periodDays })
    ws1.addRow({ metric: 'Aircraft Count', value: kpis.aircraftCount })
    ws1.addRow({ metric: 'Total Sectors', value: kpis.totalSectors })
    ws1.addRow({ metric: '' })
    // Store block time values as fractional days for [h]:mm formatting
    const fleetAvgFrac = kpis.fleetAvg / 1440
    ws1.addRow({ metric: 'Fleet Average Block/Day', value: fleetAvgFrac })
    ws1.getCell(`B${ws1.rowCount}`).numFmt = '[h]:mm'
    ws1.addRow({ metric: 'Total Block Time', value: kpis.totalMinutes / 1440 })
    ws1.getCell(`B${ws1.rowCount}`).numFmt = '[h]:mm'
    ws1.addRow({ metric: 'Highest Utilization', value: `${kpis.highest.registration} (${kpis.highest.icaoType})` })
    ws1.addRow({ metric: 'Highest Avg Block/Day', value: kpis.highest.avgBlockPerDay / 1440 })
    ws1.getCell(`B${ws1.rowCount}`).numFmt = '[h]:mm'
    ws1.addRow({ metric: 'Lowest Utilization', value: `${kpis.lowest.registration} (${kpis.lowest.icaoType})` })
    ws1.addRow({ metric: 'Lowest Avg Block/Day', value: kpis.lowest.avgBlockPerDay / 1440 })
    ws1.getCell(`B${ws1.rowCount}`).numFmt = '[h]:mm'
    ws1.addRow({ metric: 'Spread (σ)', value: kpis.stdDev / 1440 })
    ws1.getCell(`B${ws1.rowCount}`).numFmt = '[h]:mm'

    // ── Sheet 2: Daily Breakdown ──────────────────────────────
    const ws2 = wb.addWorksheet('Daily Breakdown')
    const dateHeaders = allDates.map(d => {
      const dt = parseDate(d)
      return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`
    })
    ws2.columns = [
      { header: 'Registration', key: 'reg', width: 14 },
      { header: 'Type', key: 'type', width: 10 },
      { header: 'Avg Block/Day', key: 'avg', width: 14 },
      { header: 'Util %', key: 'util', width: 10 },
      { header: 'Total Hours', key: 'total', width: 14 },
      { header: 'Sectors', key: 'sectors', width: 10 },
      { header: 'Sectors/Day', key: 'spd', width: 12 },
      ...dateHeaders.map((h, i) => ({ header: h, key: `d${i}`, width: 8 })),
    ]
    ws2.getRow(1).font = { bold: true, size: 10 }
    ws2.getRow(1).alignment = { horizontal: 'center' as const }

    for (const ac of sorted) {
      const rowData: Record<string, unknown> = {
        reg: ac.registration,
        type: ac.icaoType,
        avg: ac.avgBlockPerDay / 1440,
        util: ac.utilPct / 100,
        total: ac.totalBlockMinutes / 1440,
        sectors: ac.totalSectors,
        spd: Math.round(ac.avgSectorsPerDay * 10) / 10,
      }
      allDates.forEach((d, i) => {
        rowData[`d${i}`] = (ac.dailyBlocks.get(d) || 0) / 1440
      })
      const row = ws2.addRow(rowData)
      // Format time columns
      row.getCell('avg').numFmt = '[h]:mm'
      row.getCell('util').numFmt = '0%'
      row.getCell('total').numFmt = '[h]:mm'
      allDates.forEach((_, i) => {
        row.getCell(`d${i}`).numFmt = '[h]:mm'
      })
    }

    // ── Sheet 3: Spread Chart data ────────────────────────────
    const ws3 = wb.addWorksheet('Spread Chart')
    ws3.columns = [
      { header: 'Registration', key: 'reg', width: 14 },
      { header: 'Type', key: 'type', width: 10 },
      { header: 'Avg Block/Day (hrs)', key: 'avg', width: 18 },
      { header: 'Utilization %', key: 'util', width: 14 },
    ]
    ws3.getRow(1).font = { bold: true, size: 11 }
    for (const ac of sorted) {
      ws3.addRow({
        reg: ac.registration,
        type: ac.icaoType,
        avg: ac.avgBlockPerDay / 60,
        util: ac.utilPct / 100,
      })
    }
    // Format util column
    ws3.getColumn('util').numFmt = '0%'
    ws3.getColumn('avg').numFmt = '0.0'

    // ── Write file ────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fleet-utilization-${periodFrom}-${periodTo}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${sorted.length} aircraft to XLSX`)
  }, [sorted, allDates, periodFrom, periodTo, kpis, periodDays])

  // ─── PNG Export ──────────────────────────────────────────────
  const handleExportPNG = useCallback(async () => {
    if (!reportContentRef.current) return
    toast.info('Capturing screenshot...')

    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(reportContentRef.current, {
      backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
    })
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `fleet-utilization-${periodFrom}-${periodTo}.png`
    a.click()
    toast.success('PNG exported')
  }, [isDark, periodFrom, periodTo])

  // ─── PDF / Print Export ──────────────────────────────────────
  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  // ─── Reset filters ─────────────────────────────────────────────
  const handleResetFilters = () => {
    setSelectedTypes(new Set())
    setSelectedReg('')
    setSortBy('util')
    setGroupBy('type')
  }

  // ─── Unique types in data ──────────────────────────────────────
  const uniqueTypes = useMemo(() => {
    return Array.from(new Set(aircraftTypes.map(t => t.icao_type))).sort()
  }, [aircraftTypes])

  // ─── Period selector (shared) ──────────────────────────────────
  const periodSelector = (
    <div className="flex items-center gap-1.5">
      <input ref={calendarRef} type="date" className="sr-only" tabIndex={-1} onChange={handleCalendarPick} />
      <span style={{ fontSize: 10, fontWeight: 600 }} className="text-muted-foreground">Period</span>
      <input
        type="text" placeholder="DD/MM/YYYY" value={fromText}
        onChange={e => setFromText(e.target.value)} onBlur={handleFromBlur}
        onKeyDown={e => { if (e.key === 'Enter') { handleFromBlur(); (e.target as HTMLInputElement).blur() } }}
        className="bg-background border border-border rounded-md text-foreground tabular-nums outline-none focus:ring-1 focus:ring-foreground/20 transition-all duration-200 placeholder:text-muted-foreground/40 placeholder:font-normal"
        style={{ width: 86, height: 26, fontSize: 11, fontWeight: 500, textAlign: 'center', padding: '0 4px', borderRadius: 6 }}
      />
      <button
        onClick={() => { pickTargetRef.current = 'from'; calendarRef.current?.showPicker?.() }}
        className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        style={{ width: 26, height: 26, borderRadius: 6 }} title="Pick dates from calendar"
      >
        <Calendar style={{ width: 14, height: 14 }} />
      </button>
      <input
        type="text" placeholder="DD/MM/YYYY" value={toText}
        onChange={e => setToText(e.target.value)} onBlur={handleToBlur}
        onKeyDown={e => { if (e.key === 'Enter') { handleToBlur(); (e.target as HTMLInputElement).blur() } }}
        className="bg-background border border-border rounded-md text-foreground tabular-nums outline-none focus:ring-1 focus:ring-foreground/20 transition-all duration-200 placeholder:text-muted-foreground/40 placeholder:font-normal"
        style={{ width: 86, height: 26, fontSize: 11, fontWeight: 500, textAlign: 'center', padding: '0 4px', borderRadius: 6 }}
      />
      <button
        onClick={() => {
          const now = new Date()
          const y = now.getFullYear(), m = now.getMonth()
          setPeriodFrom(`${y}-${String(m + 1).padStart(2, '0')}-01`)
          const last = new Date(y, m + 1, 0).getDate()
          setPeriodTo(`${y}-${String(m + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`)
        }}
        className="bg-background border border-border text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
        style={{ height: 26, padding: '0 8px', fontSize: 11, fontWeight: 500, borderRadius: 6 }}
      >This Month</button>
      <button
        onClick={() => {
          const now = new Date()
          const y = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()
          const m = (now.getMonth() + 1) % 12
          setPeriodFrom(`${y}-${String(m + 1).padStart(2, '0')}-01`)
          const last = new Date(y, m + 1, 0).getDate()
          setPeriodTo(`${y}-${String(m + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`)
        }}
        className="bg-background border border-border text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
        style={{ height: 26, padding: '0 8px', fontSize: 11, fontWeight: 500, borderRadius: 6 }}
      >Next Month</button>
      <button
        onClick={handleGo}
        disabled={loading}
        className="font-semibold text-white transition-all duration-200"
        style={{
          height: 26, padding: '0 14px', fontSize: 10, borderRadius: 6,
          background: 'hsl(var(--primary))', cursor: 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading
          ? <Loader2 className="animate-spin" style={{ width: 12, height: 12 }} />
          : 'Go'}
      </button>
    </div>
  )

  // ─── Loading toast ─────────────────────────────────────────────
  const loadingToast = loadingPhase !== 'idle' && (
    <div style={{ position: 'fixed', top: 56, right: 20, zIndex: 99998, animation: 'gantt-toast-enter 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
      <div className="rounded-xl px-4 py-3 flex items-center gap-3 min-w-[260px]" style={{
        backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
        background: isDark ? 'rgba(30,30,30,0.85)' : 'rgba(255,255,255,0.85)',
        border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.5)',
        boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 8px 32px rgba(0,0,0,0.08)',
      }}>
        <div className="shrink-0">
          {loadingPhase === 'done' ? (
            <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.15)' }}>
              <Check className="w-3 h-3 text-green-500" />
            </div>
          ) : (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          )}
        </div>
        <div>
          <p className="text-[12px] font-medium text-foreground">
            {loadingPhase === 'fetching' && 'Fetching utilization data...'}
            {loadingPhase === 'building' && 'Building report...'}
            {loadingPhase === 'done' && 'Report ready'}
          </p>
        </div>
      </div>
    </div>
  )

  // ─── Filter panel ──────────────────────────────────────────────
  const filterPanel = (
    <div className="shrink-0 glass border-r overflow-y-auto fleet-util-filters" style={{ width: 220, padding: '12px 14px' }}>
      <p className="text-[13px] font-bold tracking-tight mb-3">Selection Criteria</p>

      {/* Aircraft Type */}
      <label className="text-[11px] font-bold uppercase text-muted-foreground mb-1.5 block" style={{ letterSpacing: '0.5px' }}>
        Aircraft Type
      </label>
      <div className="flex flex-col gap-1 mb-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={selectedTypes.size === 0}
            onChange={() => setSelectedTypes(new Set())}
            className="rounded border-border"
          />
          <span style={{ fontSize: 11 }}>All Types</span>
        </label>
        {uniqueTypes.map(t => (
          <label key={t} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedTypes.size === 0 || selectedTypes.has(t)}
              onChange={() => {
                const next = new Set(selectedTypes)
                if (next.has(t)) next.delete(t)
                else next.add(t)
                setSelectedTypes(next)
              }}
              className="rounded border-border"
            />
            <span className="flex items-center gap-1.5" style={{ fontSize: 11 }}>
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: acTypeColorMap.get(t) || '#888' }} />
              {t}
              <span className="text-muted-foreground">({fleetCountByType.get(t) || 0} A/C)</span>
            </span>
          </label>
        ))}
      </div>

      {/* Registration */}
      <label className="text-[11px] font-bold uppercase text-muted-foreground mb-1.5 block" style={{ letterSpacing: '0.5px' }}>
        Registration
      </label>
      <select
        value={selectedReg}
        onChange={e => setSelectedReg(e.target.value)}
        className="w-full bg-background border border-border rounded-md text-[11px] px-2 py-1.5 outline-none focus:ring-1 focus:ring-foreground/20 mb-3"
      >
        <option value="">All Registrations</option>
        {registrations
          .filter(r => r.status === 'active' || r.status === 'operational')
          .sort((a, b) => a.registration.localeCompare(b.registration))
          .map(r => (
            <option key={r.registration} value={r.registration}>{r.registration}</option>
          ))}
      </select>

      <div className="border-t border-dashed border-border my-3" />

      {/* Sort By */}
      <label className="text-[11px] font-bold uppercase text-muted-foreground mb-1.5 block" style={{ letterSpacing: '0.5px' }}>
        Sort By
      </label>
      <div className="flex gap-1 mb-3">
        {([
          { key: 'reg' as const, label: 'Reg' },
          { key: 'util' as const, label: 'Util \u2193' },
          { key: 'sectors' as const, label: 'Sectors' },
        ]).map(opt => (
          <button
            key={opt.key}
            onClick={() => setSortBy(opt.key)}
            className="flex-1 py-1 rounded-md border text-center transition-colors"
            style={{
              fontSize: 10,
              fontWeight: 500,
              borderColor: sortBy === opt.key ? 'hsl(var(--primary))' : 'var(--border)',
              background: sortBy === opt.key ? 'hsl(var(--primary) / 0.08)' : 'transparent',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Group By */}
      <label className="text-[11px] font-bold uppercase text-muted-foreground mb-1.5 block" style={{ letterSpacing: '0.5px' }}>
        Group By
      </label>
      <div className="flex gap-1 mb-3">
        {([
          { key: 'type' as const, label: 'Type' },
          { key: 'none' as const, label: 'None' },
        ]).map(opt => (
          <button
            key={opt.key}
            onClick={() => setGroupBy(opt.key)}
            className="flex-1 py-1 rounded-md border text-center transition-colors"
            style={{
              fontSize: 10,
              fontWeight: 500,
              borderColor: groupBy === opt.key ? 'hsl(var(--primary))' : 'var(--border)',
              background: groupBy === opt.key ? 'hsl(var(--primary) / 0.08)' : 'transparent',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <button
        onClick={handleResetFilters}
        className="w-full text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1.5 rounded-md border border-dashed border-border mt-1"
      >
        Reset Filters
      </button>
    </div>
  )

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full fleet-util-report" style={{ minHeight: 'calc(100vh - 56px)' }}>
      {loadingToast}

      {/* Print stylesheet */}
      <style>{`
        @media print {
          body, html { background: white !important; color: black !important; }
          .fleet-util-report { min-height: auto !important; }
          .fleet-util-report * { color-adjust: exact !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .fleet-util-topbar, .fleet-util-filters, .print\\:hidden, nav, header, aside { display: none !important; }
          .fleet-util-body { overflow: visible !important; }
          .fleet-util-content { padding: 8px !important; overflow: visible !important; }
          .fleet-util-content .rounded-xl, .fleet-util-content .rounded-lg { border-color: #ddd !important; }
          .fleet-util-heatmap { display: none !important; }
          @page { size: landscape; margin: 10mm; }
        }
      `}</style>

      {/* ── Top bar ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 border-b shrink-0 fleet-util-topbar" style={{ height: 44 }}>
        <div className="flex items-center gap-2 shrink-0">
          <BarChart3 style={{ width: 14, height: 14 }} className="text-muted-foreground" />
          <span style={{ fontSize: 13, fontWeight: 600 }}>1.3.2. Scheduled Fleet Utilization</span>
        </div>

        <div className="mx-2 h-4 border-r border-border" />

        {periodSelector}

        {/* Filter badges (after Go) */}
        {loaded && (
          <>
            {activeFilters.map((f, i) => (
              <span
                key={i}
                className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-muted-foreground"
                style={{ fontSize: 10 }}
              >
                {f.label}
                <button onClick={f.onClear} className="hover:text-foreground transition-colors"><X style={{ width: 10, height: 10 }} /></button>
              </span>
            ))}
            {!filterPanelOpen && (
              <button
                onClick={() => setFilterPanelOpen(true)}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                style={{ fontSize: 11, fontWeight: 500 }}
              >
                <Filter style={{ width: 12, height: 12 }} /> Filters
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden fleet-util-body">
        {/* Filter panel (shown before Go, or when toggled after Go) */}
        {(filterPanelOpen) && filterPanel}

        {/* Main content area */}
        <div className="flex-1 overflow-y-auto fleet-util-content" style={{ padding: loaded ? '20px 24px' : 0 }}>
          {!loaded ? (
            /* ── Blank state ─────────────────────────────── */
            <div className="flex flex-col items-center justify-center h-full">
              <img
                src="/horizon-watermark.png"
                alt=""
                style={{
                  width: 280,
                  height: 'auto',
                  opacity: isDark ? 0.06 : 0.08,
                  WebkitMaskImage: 'url(/horizon-watermark.png)',
                  WebkitMaskSize: 'contain',
                  WebkitMaskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskImage: 'url(/horizon-watermark.png)',
                  maskSize: 'contain',
                  maskRepeat: 'no-repeat',
                  maskPosition: 'center',
                }}
              />
              <p className="text-muted-foreground mt-4" style={{ fontSize: 13 }}>
                Select a period and click Go to generate report
              </p>
              <div className="flex gap-2 mt-4">
                {['PDF', 'XLSX', 'PNG'].map(fmt => (
                  <span key={fmt} className="rounded-md px-2.5 py-1 border border-dashed border-border text-muted-foreground" style={{ fontSize: 10, fontWeight: 500 }}>
                    {fmt}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            /* ── Report content ──────────────────────────── */
            <div ref={reportContentRef}>
              {/* ── Summary Cards ────────────────────────── */}
              {kpis && (
                <div className="flex gap-3 mb-6">
                  {/* Fleet Average */}
                  <div className="flex-1 rounded-xl border border-border p-3" style={{ background: 'hsl(var(--card))' }}>
                    <div className="text-[11px] text-muted-foreground mb-1">Fleet Average</div>
                    <div className="flex items-baseline gap-1">
                      <span className="font-mono font-bold" style={{ fontSize: 22 }}>{formatBlockTime(Math.round(kpis.fleetAvg))}</span>
                      <span className="text-muted-foreground" style={{ fontSize: 11 }}>/day</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {kpis.aircraftCount} aircraft &middot; {periodDays} days
                    </div>
                  </div>

                  {/* Total Block Hours */}
                  <div className="flex-1 rounded-xl border border-border p-3" style={{ background: 'hsl(var(--card))' }}>
                    <div className="text-[11px] text-muted-foreground mb-1">Total Block Hours</div>
                    <div className="font-mono font-bold" style={{ fontSize: 22 }}>{formatBlockTime(kpis.totalMinutes)}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {kpis.totalSectors.toLocaleString()} sectors
                    </div>
                  </div>

                  {/* Highest */}
                  <div className="flex-1 rounded-xl border border-border p-3" style={{ background: 'hsl(var(--card))' }}>
                    <div className="text-[11px] text-muted-foreground mb-1">Highest</div>
                    <div className="font-mono font-bold" style={{ fontSize: 22, color: '#f59e0b' }}>
                      {formatBlockTime(Math.round(kpis.highest.avgBlockPerDay))}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {kpis.highest.registration} ({kpis.highest.icaoType})
                    </div>
                  </div>

                  {/* Lowest */}
                  <div className="flex-1 rounded-xl border p-3" style={{ background: 'hsl(var(--card))', borderColor: '#991b1b40' }}>
                    <div className="text-[11px] text-muted-foreground mb-1">Lowest</div>
                    <div className="font-mono font-bold" style={{ fontSize: 22, color: '#991b1b' }}>
                      {formatBlockTime(Math.round(kpis.lowest.avgBlockPerDay))}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {kpis.lowest.registration} ({kpis.lowest.icaoType})
                    </div>
                  </div>

                  {/* Spread */}
                  <div className="flex-1 rounded-xl border border-border p-3" style={{ background: 'hsl(var(--card))' }}>
                    <div className="text-[11px] text-muted-foreground mb-1">Spread (&sigma;)</div>
                    <div className="font-mono font-bold" style={{ fontSize: 22 }}>
                      {formatBlockTime(Math.round(kpis.stdDev))}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">Fleet balance</div>
                  </div>
                </div>
              )}

              {/* ── Fleet Utilization Spread Chart ────────── */}
              <div className="mb-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 style={{ fontSize: 15, fontWeight: 700 }}>Fleet Utilization Spread</h2>
                    <p style={{ fontSize: 12 }} className="text-muted-foreground">
                      Average daily block hours per aircraft registration
                    </p>
                  </div>
                  <div className="flex gap-1.5 print:hidden">
                    <button
                      onClick={handleExportPNG}
                      className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-muted-foreground hover:text-foreground transition-colors"
                      style={{ fontSize: 10, fontWeight: 500 }}
                    >
                      <Download style={{ width: 10, height: 10 }} /> PNG
                    </button>
                    <button
                      onClick={handleExportCSV}
                      className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-muted-foreground hover:text-foreground transition-colors"
                      style={{ fontSize: 10, fontWeight: 500 }}
                    >
                      <Download style={{ width: 10, height: 10 }} /> CSV
                    </button>
                    <button
                      onClick={handleExportXLSX}
                      className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-muted-foreground hover:text-foreground transition-colors"
                      style={{ fontSize: 10, fontWeight: 500 }}
                    >
                      <Download style={{ width: 10, height: 10 }} /> XLSX
                    </button>
                    <button
                      onClick={handlePrint}
                      className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-muted-foreground hover:text-foreground transition-colors"
                      style={{ fontSize: 10, fontWeight: 500 }}
                    >
                      <Printer style={{ width: 10, height: 10 }} /> PDF
                    </button>
                  </div>
                </div>

                {/* Bar chart */}
                <div className="rounded-xl border border-border p-4" style={{ background: 'hsl(var(--card))' }}>
                  {/* Y-axis labels + bars */}
                  <div className="flex" style={{ height: 200 }}>
                    {/* Y-axis */}
                    <div className="flex flex-col justify-between shrink-0 pr-2" style={{ width: 32, height: '100%' }}>
                      {[18, 12, 6, 0].map(h => (
                        <span key={h} className="text-muted-foreground tabular-nums text-right" style={{ fontSize: 9 }}>{h}h</span>
                      ))}
                    </div>
                    {/* Bars container */}
                    <div className="flex-1 relative">
                      {/* Fleet avg dashed line */}
                      {kpis && (
                        <div
                          className="absolute w-full border-t border-dashed"
                          style={{
                            bottom: `${(kpis.fleetAvg / (18 * 60)) * 100}%`,
                            borderColor: 'hsl(var(--foreground) / 0.3)',
                          }}
                        />
                      )}
                      {/* Bars */}
                      <div className="flex items-end h-full gap-px">
                        {sorted.map((s) => (
                          <div
                            key={s.registration}
                            className="flex-1 min-w-[2px] max-w-[12px] rounded-t-sm transition-all duration-200"
                            title={`${s.registration} (${s.icaoType}): ${formatBlockTime(Math.round(s.avgBlockPerDay))}/day`}
                            style={{
                              height: `${Math.min(100, (s.avgBlockPerDay / (18 * 60)) * 100)}%`,
                              background: acTypeColorMap.get(s.icaoType) || '#888',
                              opacity: 0.85,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
                    {grouped.map(g => g.type !== 'ALL' && (
                      <div key={g.type} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: acTypeColorMap.get(g.type) || '#888' }} />
                        <span style={{ fontSize: 10, fontWeight: 500 }}>{g.type}</span>
                        <span className="text-muted-foreground" style={{ fontSize: 10 }}>({g.items.length})</span>
                      </div>
                    ))}
                    {kpis && (
                      <div className="flex items-center gap-1.5 ml-auto">
                        <span className="w-4 border-t border-dashed" style={{ borderColor: 'hsl(var(--foreground) / 0.3)' }} />
                        <span className="text-muted-foreground" style={{ fontSize: 10 }}>
                          Fleet avg {formatBlockTime(Math.round(kpis.fleetAvg))}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Fleet Detail Section ──────────────────── */}
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 style={{ fontSize: 15, fontWeight: 700 }}>Fleet Detail</h2>
                    <p style={{ fontSize: 12 }} className="text-muted-foreground">
                      {filtered.length} aircraft &middot; Sorted by {sortBy === 'util' ? 'utilization \u2193' : sortBy === 'sectors' ? 'sectors \u2193' : 'registration'}
                    </p>
                  </div>
                  <button
                    onClick={() => setDetailOpen(v => !v)}
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                    style={{ fontSize: 11, fontWeight: 500 }}
                  >
                    {detailOpen ? <><ChevronUp style={{ width: 12, height: 12 }} /> Collapse</> : <><ChevronDown style={{ width: 12, height: 12 }} /> Expand</>}
                  </button>
                </div>

                {detailOpen && grouped.map(group => (
                  <div key={group.type} className="mb-5">
                    {/* Type group header */}
                    {groupBy === 'type' && group.type !== 'ALL' && (
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-bold"
                          style={{
                            fontSize: 12,
                            color: acTypeColorMap.get(group.type) || '#888',
                            background: `${acTypeColorMap.get(group.type) || '#888'}15`,
                          }}
                        >
                          <span className="w-2 h-2 rounded-full" style={{ background: acTypeColorMap.get(group.type) || '#888' }} />
                          {group.type}
                        </span>
                        <span className="text-muted-foreground" style={{ fontSize: 11 }}>
                          {group.items.length} aircraft
                          &middot; Avg {formatBlockTime(Math.round(group.items.reduce((s, a) => s + a.avgBlockPerDay, 0) / group.items.length))}/day
                          &middot; {group.items.reduce((s, a) => s + a.totalSectors, 0).toLocaleString()} sectors
                        </span>
                      </div>
                    )}

                    {/* Table */}
                    <div className="rounded-lg border border-border overflow-hidden" style={{ background: 'hsl(var(--card))' }}>
                      {/* Header */}
                      <div className="flex items-center border-b border-border" style={{ height: 32, padding: '0 12px' }}>
                        <span className="text-[10px] font-bold uppercase text-muted-foreground" style={{ width: 110 }}>Registration</span>
                        <span className="text-[10px] font-bold uppercase text-muted-foreground text-right" style={{ width: 100 }}>Avg Block/Day</span>
                        <span className="text-[10px] font-bold uppercase text-muted-foreground" style={{ width: 170, paddingLeft: 12 }}>Utilization</span>
                        <span className="text-[10px] font-bold uppercase text-muted-foreground text-right" style={{ width: 100 }}>Total Hours</span>
                        <span className="text-[10px] font-bold uppercase text-muted-foreground text-right" style={{ width: 80 }}>Sectors</span>
                        <span className="text-[10px] font-bold uppercase text-muted-foreground text-right" style={{ width: 90 }}>Sectors/Day</span>
                        <span className="text-[10px] font-bold uppercase text-muted-foreground flex-1" style={{ paddingLeft: 12 }}>Daily Heatmap</span>
                      </div>

                      {/* Rows */}
                      {group.items.map((ac, idx) => (
                        <div
                          key={ac.registration}
                          className="flex items-center border-b border-border last:border-b-0"
                          style={{
                            height: 28,
                            padding: '0 12px',
                            background: idx % 2 === 0 ? 'transparent' : 'hsl(var(--muted) / 0.3)',
                          }}
                        >
                          <span className="font-mono font-bold text-foreground" style={{ width: 110, fontSize: 12 }}>
                            {ac.registration}
                          </span>
                          <span className="font-mono text-right tabular-nums" style={{ width: 100, fontSize: 12 }}>
                            {formatBlockTime(Math.round(ac.avgBlockPerDay))}
                          </span>
                          <div style={{ width: 170, paddingLeft: 12 }} className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(var(--muted))' }}>
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(100, ac.utilPct)}%`,
                                  background: utilBarColor(ac.utilPct),
                                }}
                              />
                            </div>
                            <span className="font-mono tabular-nums text-muted-foreground" style={{ fontSize: 10, minWidth: 32 }}>
                              {ac.utilPct.toFixed(0)}%
                            </span>
                          </div>
                          <span className="font-mono text-right tabular-nums" style={{ width: 100, fontSize: 12 }}>
                            {formatBlockTime(ac.totalBlockMinutes)}
                          </span>
                          <span className="font-mono text-right tabular-nums" style={{ width: 80, fontSize: 12 }}>
                            {ac.totalSectors}
                          </span>
                          <span className="font-mono text-right tabular-nums" style={{ width: 90, fontSize: 12 }}>
                            {ac.avgSectorsPerDay.toFixed(1)}
                          </span>
                          <div className="flex-1 flex gap-px overflow-hidden fleet-util-heatmap" style={{ paddingLeft: 12 }}>
                            {allDates.map(date => (
                              <div
                                key={date}
                                title={`${date}: ${formatBlockTime(ac.dailyBlocks.get(date) || 0)}`}
                                style={{
                                  width: 10,
                                  height: 16,
                                  borderRadius: 1.5,
                                  background: heatColor(ac.dailyBlocks.get(date) || 0),
                                  flexShrink: 0,
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      ))}

                      {/* Footer row */}
                      {group.items.length > 1 && (
                        <div
                          className="flex items-center border-t border-border"
                          style={{ height: 28, padding: '0 12px', background: 'hsl(var(--muted) / 0.5)' }}
                        >
                          <span className="font-bold text-muted-foreground" style={{ width: 110, fontSize: 11 }}>
                            {group.items.length} aircraft
                          </span>
                          <span className="font-mono text-right tabular-nums font-bold text-muted-foreground" style={{ width: 100, fontSize: 11 }}>
                            {formatBlockTime(Math.round(group.items.reduce((s, a) => s + a.avgBlockPerDay, 0) / group.items.length))}
                          </span>
                          <span style={{ width: 170, paddingLeft: 12, fontSize: 11 }} className="text-muted-foreground font-bold tabular-nums">
                            {(group.items.reduce((s, a) => s + a.utilPct, 0) / group.items.length).toFixed(0)}% avg
                          </span>
                          <span className="font-mono text-right tabular-nums font-bold text-muted-foreground" style={{ width: 100, fontSize: 11 }}>
                            {formatBlockTime(group.items.reduce((s, a) => s + a.totalBlockMinutes, 0))}
                          </span>
                          <span className="font-mono text-right tabular-nums font-bold text-muted-foreground" style={{ width: 80, fontSize: 11 }}>
                            {group.items.reduce((s, a) => s + a.totalSectors, 0).toLocaleString()}
                          </span>
                          <span className="font-mono text-right tabular-nums font-bold text-muted-foreground" style={{ width: 90, fontSize: 11 }}>
                            {(group.items.reduce((s, a) => s + a.avgSectorsPerDay, 0) / group.items.length).toFixed(1)}
                          </span>
                          <span className="flex-1" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
