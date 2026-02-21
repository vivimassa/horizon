'use client'

import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import {
  Search, Calendar, ChevronDown, Check, Loader2, X, Download,
  Columns3, CalendarDays,
} from 'lucide-react'
import { AircraftWithRelations } from '@/app/actions/aircraft-registrations'
import { AircraftType } from '@/types/database'
import { getDailyFlightSchedule, type DailyFlightRow, type DailyFlightFilters } from '@/app/actions/report-flights'
import { getFlightTailAssignments, type TailAssignmentRow } from '@/app/actions/gantt'
import { AC_TYPE_COLOR_PALETTE } from '@/lib/constants/gantt-settings'
import { toast } from '@/components/ui/visionos-toast'

// ─── Types ─────────────────────────────────────────────────────

interface Props {
  registrations: AircraftWithRelations[]
  aircraftTypes: AircraftType[]
}

interface ExpandedRow {
  key: string
  flightId: string
  date: string          // YYYY-MM-DD
  dow: string           // Mon, Tue, ...
  airlineCode: string
  flightNumber: number
  depStation: string
  arrStation: string
  stdUtc: string
  staUtc: string
  blockMinutes: number
  aircraftTypeIcao: string | null
  aircraftReg: string | null
  serviceType: string
  status: string
  routeType: string | null
  daysOfOperation: string
  depUtcOffset: string | null
  arrUtcOffset: string | null
  seatConfig: string | null
}

type TimeDisplayMode = 'utc' | 'local_base' | 'local_station'
type SortSequence = 'date_std' | 'date_reg_std' | 'reg_date_std' | 'flt'

interface ColumnDef {
  id: string
  label: string
  width: number
  visible: boolean
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: 'date', label: 'Date', width: 80, visible: true },
  { id: 'dow', label: 'DOW', width: 40, visible: true },
  { id: 'flt', label: 'Flt#', width: 72, visible: true },
  { id: 'dep', label: 'DEP', width: 48, visible: true },
  { id: 'arr', label: 'ARR', width: 48, visible: true },
  { id: 'std', label: 'STD', width: 58, visible: true },
  { id: 'sta', label: 'STA', width: 58, visible: true },
  { id: 'block', label: 'Block', width: 52, visible: true },
  { id: 'acType', label: 'AC Type', width: 70, visible: true },
  { id: 'acReg', label: 'AC Reg', width: 76, visible: true },
  { id: 'svcType', label: 'Svc', width: 40, visible: true },
  { id: 'status', label: 'Status', width: 68, visible: true },
  { id: 'route', label: 'Route', width: 52, visible: true },
]

// ─── Helpers ─────────────────────────────────────────────────────

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

const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DOW_CHARS = '1234567' // 1=Mon ... 7=Sun
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDateDDMon(iso: string): string {
  const d = parseDate(iso)
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}`
}

function getDowChar(d: Date): number {
  // JS: 0=Sun → IATA: 7=Sun, 1=Mon, etc.
  const js = d.getDay()
  return js === 0 ? 7 : js
}

function blockToHMM(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

/** Convert HH:MM time with UTC offset (hours) to local time string. Returns { time, dayShift } */
function convertTime(hhmmUtc: string, offsetHours: number | null): { time: string; dayShift: number } {
  if (offsetHours == null) return { time: hhmmUtc, dayShift: 0 }
  const [h, m] = hhmmUtc.split(':').map(Number)
  const totalMinutes = h * 60 + m + offsetHours * 60
  let dayShift = 0
  let adjusted = totalMinutes
  if (adjusted < 0) { adjusted += 1440; dayShift = -1 }
  if (adjusted >= 1440) { adjusted -= 1440; dayShift = 1 }
  const hh = String(Math.floor(adjusted / 60)).padStart(2, '0')
  const mm = String(adjusted % 60).padStart(2, '0')
  return { time: `${hh}:${mm}`, dayShift }
}

// AC type → color mapping
function buildAcTypeColorMap(types: string[]): Map<string, string> {
  const map = new Map<string, string>()
  const sorted = [...types].sort()
  sorted.forEach((t, i) => map.set(t, AC_TYPE_COLOR_PALETTE[i % AC_TYPE_COLOR_PALETTE.length]))
  return map
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-muted', text: 'text-muted-foreground' },
  ready: { bg: 'bg-blue-500/15', text: 'text-blue-600 dark:text-blue-400' },
  published: { bg: 'bg-green-500/15', text: 'text-green-600 dark:text-green-400' },
}

// ─── Component ───────────────────────────────────────────────────

export function DailyScheduleReport({ registrations, aircraftTypes }: Props) {
  // ─── Period state ─────────────────────────────────────────────
  const [periodFrom, setPeriodFrom] = useState<string | null>(null)
  const [periodTo, setPeriodTo] = useState<string | null>(null)
  const [fromText, setFromText] = useState('')
  const [toText, setToText] = useState('')
  const [periodCommitted, setPeriodCommitted] = useState(false)
  const calendarRef = useRef<HTMLInputElement>(null)
  const pickTargetRef = useRef<'from' | 'to'>('from')

  // ─── Data state ───────────────────────────────────────────────
  const [rawFlights, setRawFlights] = useState<DailyFlightRow[]>([])
  const [tailAssignments, setTailAssignments] = useState<Map<string, string>>(new Map())
  const [loadingPhase, setLoadingPhase] = useState<'idle' | 'fetching' | 'building' | 'done'>('idle')

  // ─── Filter state ─────────────────────────────────────────────
  const [filterAcType, setFilterAcType] = useState('')
  const [filterAcReg, setFilterAcReg] = useState('')
  const [filterRouteType, setFilterRouteType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterTimeFrom, setFilterTimeFrom] = useState('')
  const [filterTimeTo, setFilterTimeTo] = useState('')
  const [timeDisplay, setTimeDisplay] = useState<TimeDisplayMode>('utc')
  const [sortSequence, setSortSequence] = useState<SortSequence>('date_std')
  const [quickFilter, setQuickFilter] = useState('')

  // ─── Column state ─────────────────────────────────────────────
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS)
  const [colPopoverOpen, setColPopoverOpen] = useState(false)
  const dragColRef = useRef<string | null>(null)

  // ─── Dark mode ────────────────────────────────────────────────
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

  // ─── Unique AC types for color map ────────────────────────────
  const acTypeColorMap = useMemo(
    () => buildAcTypeColorMap(aircraftTypes.map(t => t.icao_type)),
    [aircraftTypes]
  )

  // ─── Registration lookup map ──────────────────────────────────
  const regToTypeMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of registrations) {
      if (r.aircraft_types) m.set(r.registration, r.aircraft_types.icao_type)
    }
    return m
  }, [registrations])

  // ─── Period input handlers ────────────────────────────────────
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

  // ─── Go handler ───────────────────────────────────────────────
  const handleGo = useCallback(async () => {
    if (!periodFrom && !periodTo) { toast.warning('Please select a date range first'); return }
    if (!periodFrom) { toast.warning('Please select a From date'); return }
    if (!periodTo) { toast.warning('Please select a To date'); return }
    if (periodFrom > periodTo) { toast.warning('From date must be before To date'); return }

    setLoadingPhase('fetching')

    try {
      const rangeEnd = formatISO(addDays(parseDate(periodTo), 1))
      const filters: DailyFlightFilters = {}
      if (filterAcType) filters.aircraftType = filterAcType
      if (filterStatus) filters.status = filterStatus
      if (filterRouteType) filters.routeType = filterRouteType

      const [flights, ta] = await Promise.all([
        getDailyFlightSchedule(periodFrom, rangeEnd, filters),
        getFlightTailAssignments(periodFrom, rangeEnd),
      ])

      setLoadingPhase('building')
      setRawFlights(flights)

      const taMap = new Map<string, string>()
      for (const row of ta) taMap.set(`${row.scheduledFlightId}__${row.flightDate}`, row.aircraftReg)
      setTailAssignments(taMap)

      setPeriodCommitted(true)
      setLoadingPhase('done')
      setTimeout(() => setLoadingPhase('idle'), 1500)
    } catch (err) {
      toast.error('Failed to load flights', { description: err instanceof Error ? err.message : String(err) })
      setLoadingPhase('idle')
    }
  }, [periodFrom, periodTo, filterAcType, filterStatus, filterRouteType])

  // ─── Expand schedule rows to per-date rows ────────────────────
  const expandedRows = useMemo(() => {
    if (!periodFrom || !periodTo || rawFlights.length === 0) return []

    const rangeStart = parseDate(periodFrom)
    const rangeEnd = parseDate(periodTo)
    const rows: ExpandedRow[] = []
    const excludedSets = new Map<string, Set<string>>()

    for (const f of rawFlights) {
      if (!excludedSets.has(f.id)) {
        excludedSets.set(f.id, new Set(f.excludedDates))
      }
      const excluded = excludedSets.get(f.id)!
      const pStart = parseDate(f.periodStart)
      const pEnd = parseDate(f.periodEnd)

      // Walk each date in range
      const start = pStart > rangeStart ? pStart : rangeStart
      const end = pEnd < rangeEnd ? pEnd : rangeEnd

      let current = new Date(start)
      while (current <= end) {
        const iso = formatISO(current)
        const dowNum = getDowChar(current) // 1=Mon...7=Sun

        // Check days of operation
        if (f.daysOfOperation && f.daysOfOperation.length > 0) {
          if (!f.daysOfOperation.includes(String(dowNum))) {
            current = addDays(current, 1)
            continue
          }
        }

        // Check excluded dates
        if (excluded.has(iso)) {
          current = addDays(current, 1)
          continue
        }

        // Look up tail assignment
        const taKey = `${f.id}__${iso}`
        const acReg = tailAssignments.get(taKey) || null

        rows.push({
          key: `${f.id}__${iso}`,
          flightId: f.id,
          date: iso,
          dow: DOW_NAMES[current.getDay()],
          airlineCode: f.airlineCode,
          flightNumber: f.flightNumber,
          depStation: f.depStation,
          arrStation: f.arrStation,
          stdUtc: f.stdUtc,
          staUtc: f.staUtc,
          blockMinutes: f.blockMinutes,
          aircraftTypeIcao: f.aircraftTypeIcao,
          aircraftReg: acReg,
          serviceType: f.serviceType,
          status: f.status,
          routeType: f.routeType,
          daysOfOperation: f.daysOfOperation,
          depUtcOffset: f.depUtcOffset,
          arrUtcOffset: f.arrUtcOffset,
          seatConfig: f.seatConfig,
        })

        current = addDays(current, 1)
      }
    }

    return rows
  }, [rawFlights, periodFrom, periodTo, tailAssignments])

  // ─── Apply client-side filters ────────────────────────────────
  const filteredRows = useMemo(() => {
    let rows = expandedRows

    // AC Reg filter
    if (filterAcReg) {
      rows = rows.filter(r => r.aircraftReg === filterAcReg)
    }

    // Time range filter
    if (filterTimeFrom) {
      rows = rows.filter(r => r.stdUtc >= filterTimeFrom)
    }
    if (filterTimeTo) {
      rows = rows.filter(r => r.stdUtc <= filterTimeTo)
    }

    // Quick filter (text search across key fields)
    if (quickFilter) {
      const q = quickFilter.toLowerCase()
      rows = rows.filter(r =>
        `${r.airlineCode}${r.flightNumber}`.toLowerCase().includes(q) ||
        r.depStation.toLowerCase().includes(q) ||
        r.arrStation.toLowerCase().includes(q) ||
        (r.aircraftReg || '').toLowerCase().includes(q) ||
        (r.aircraftTypeIcao || '').toLowerCase().includes(q)
      )
    }

    return rows
  }, [expandedRows, filterAcReg, filterTimeFrom, filterTimeTo, quickFilter])

  // ─── Sort ─────────────────────────────────────────────────────
  const sortedRows = useMemo(() => {
    const rows = [...filteredRows]
    switch (sortSequence) {
      case 'date_std':
        rows.sort((a, b) => a.date.localeCompare(b.date) || a.stdUtc.localeCompare(b.stdUtc))
        break
      case 'date_reg_std':
        rows.sort((a, b) => a.date.localeCompare(b.date) || (a.aircraftReg || 'zzz').localeCompare(b.aircraftReg || 'zzz') || a.stdUtc.localeCompare(b.stdUtc))
        break
      case 'reg_date_std':
        rows.sort((a, b) => (a.aircraftReg || 'zzz').localeCompare(b.aircraftReg || 'zzz') || a.date.localeCompare(b.date) || a.stdUtc.localeCompare(b.stdUtc))
        break
      case 'flt':
        rows.sort((a, b) => a.flightNumber - b.flightNumber || a.date.localeCompare(b.date))
        break
    }
    return rows
  }, [filteredRows, sortSequence])

  // ─── Slice to max 500 display rows ────────────────────────────
  const displayRows = useMemo(() => sortedRows.slice(0, 500), [sortedRows])

  // ─── Summary stats ────────────────────────────────────────────
  const summary = useMemo(() => {
    const total = sortedRows.length
    const assigned = sortedRows.filter(r => r.aircraftReg).length
    const unassigned = total - assigned
    const blockMinutes = sortedRows.reduce((sum, r) => sum + r.blockMinutes, 0)
    const uniqueAc = new Set(sortedRows.filter(r => r.aircraftReg).map(r => r.aircraftReg)).size
    return { total, assigned, unassigned, blockMinutes, uniqueAc }
  }, [sortedRows])

  // ─── Group separator detection ────────────────────────────────
  const groupKey = useCallback((row: ExpandedRow): string => {
    switch (sortSequence) {
      case 'date_std': return row.date
      case 'date_reg_std': return `${row.date}__${row.aircraftReg || ''}`
      case 'reg_date_std': return row.aircraftReg || '__unassigned__'
      case 'flt': return String(row.flightNumber)
      default: return row.date
    }
  }, [sortSequence])

  // ─── Time formatting based on display mode ────────────────────
  const formatStd = useCallback((row: ExpandedRow): { text: string; suffix: string } => {
    if (timeDisplay === 'utc') return { text: row.stdUtc, suffix: 'Z' }
    if (timeDisplay === 'local_base') {
      const { time, dayShift } = convertTime(row.stdUtc, 7) // Base +7 (SGN)
      return { text: time, suffix: dayShift ? `⁺${dayShift}` : '' }
    }
    // local_station
    const offset = row.depUtcOffset ? parseFloat(row.depUtcOffset) : null
    const { time, dayShift } = convertTime(row.stdUtc, offset)
    return { text: time, suffix: dayShift > 0 ? `⁺${dayShift}` : dayShift < 0 ? `⁻${Math.abs(dayShift)}` : '' }
  }, [timeDisplay])

  const formatSta = useCallback((row: ExpandedRow): { text: string; suffix: string } => {
    if (timeDisplay === 'utc') return { text: row.staUtc, suffix: 'Z' }
    if (timeDisplay === 'local_base') {
      const { time, dayShift } = convertTime(row.staUtc, 7)
      return { text: time, suffix: dayShift ? `⁺${dayShift}` : '' }
    }
    const offset = row.arrUtcOffset ? parseFloat(row.arrUtcOffset) : null
    const { time, dayShift } = convertTime(row.staUtc, offset)
    return { text: time, suffix: dayShift > 0 ? `⁺${dayShift}` : dayShift < 0 ? `⁻${Math.abs(dayShift)}` : '' }
  }, [timeDisplay])

  // ─── CSV Export ───────────────────────────────────────────────
  const handleExportCSV = useCallback(() => {
    const visibleCols = columns.filter(c => c.visible)
    const headers = visibleCols.map(c => c.label)
    const csvRows = [headers.join(',')]

    for (const row of sortedRows) {
      const vals = visibleCols.map(col => {
        switch (col.id) {
          case 'date': return row.date
          case 'dow': return row.dow
          case 'flt': return `${row.airlineCode}${row.flightNumber}`
          case 'dep': return row.depStation
          case 'arr': return row.arrStation
          case 'std': return row.stdUtc
          case 'sta': return row.staUtc
          case 'block': return blockToHMM(row.blockMinutes)
          case 'acType': return row.aircraftTypeIcao || ''
          case 'acReg': return row.aircraftReg || ''
          case 'svcType': return row.serviceType
          case 'status': return row.status
          case 'route': return row.routeType || ''
          default: return ''
        }
      })
      csvRows.push(vals.map(v => `"${v}"`).join(','))
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `flight-schedule-${periodFrom}-${periodTo}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${sortedRows.length} rows`)
  }, [sortedRows, columns, periodFrom, periodTo])

  // ─── Reset filters ────────────────────────────────────────────
  const handleResetFilters = () => {
    setFilterAcType('')
    setFilterAcReg('')
    setFilterRouteType('')
    setFilterStatus('')
    setFilterTimeFrom('')
    setFilterTimeTo('')
    setQuickFilter('')
    setTimeDisplay('utc')
    setSortSequence('date_std')
  }

  // ─── Column drag-and-drop ─────────────────────────────────────
  const handleColDragStart = (colId: string) => { dragColRef.current = colId }
  const handleColDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!dragColRef.current || dragColRef.current === targetId) return
  }
  const handleColDrop = (targetId: string) => {
    if (!dragColRef.current || dragColRef.current === targetId) return
    const newCols = [...columns]
    const fromIdx = newCols.findIndex(c => c.id === dragColRef.current)
    const toIdx = newCols.findIndex(c => c.id === targetId)
    if (fromIdx === -1 || toIdx === -1) return
    const [moved] = newCols.splice(fromIdx, 1)
    newCols.splice(toIdx, 0, moved)
    setColumns(newCols)
    dragColRef.current = null
  }

  // ─── Toggle column visibility ─────────────────────────────────
  const toggleCol = (colId: string) => {
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, visible: !c.visible } : c))
  }

  // Active filter badges
  const activeFilters = useMemo(() => {
    const badges: { label: string; onClear: () => void }[] = []
    if (filterAcType) badges.push({ label: `AC: ${filterAcType}`, onClear: () => setFilterAcType('') })
    if (filterAcReg) badges.push({ label: `Reg: ${filterAcReg}`, onClear: () => setFilterAcReg('') })
    if (filterRouteType) badges.push({ label: `Route: ${filterRouteType}`, onClear: () => setFilterRouteType('') })
    if (filterStatus) badges.push({ label: `Status: ${filterStatus}`, onClear: () => setFilterStatus('') })
    if (filterTimeFrom || filterTimeTo) badges.push({ label: `Time: ${filterTimeFrom || '...'}-${filterTimeTo || '...'}`, onClear: () => { setFilterTimeFrom(''); setFilterTimeTo('') } })
    return badges
  }, [filterAcType, filterAcReg, filterRouteType, filterStatus, filterTimeFrom, filterTimeTo])

  // ─── Visible columns ─────────────────────────────────────────
  const visibleCols = useMemo(() => columns.filter(c => c.visible), [columns])

  // ─── Period Selector ──────────────────────────────────────────
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
        disabled={loadingPhase === 'fetching' || loadingPhase === 'building'}
        className="font-semibold text-white transition-all duration-200"
        style={{
          height: 26, padding: '0 14px', fontSize: 10, borderRadius: 6,
          background: 'hsl(var(--primary))', cursor: 'pointer',
          opacity: (loadingPhase === 'fetching' || loadingPhase === 'building') ? 0.7 : 1,
        }}
      >
        {(loadingPhase === 'fetching' || loadingPhase === 'building')
          ? <Loader2 className="animate-spin" style={{ width: 12, height: 12 }} />
          : 'Go'}
      </button>
    </div>
  )

  // ─── Loading toast ────────────────────────────────────────────
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
            {loadingPhase === 'fetching' && 'Fetching schedule data...'}
            {loadingPhase === 'building' && 'Building report...'}
            {loadingPhase === 'done' && 'Report ready'}
          </p>
        </div>
      </div>
    </div>
  )

  // ─── Filter panel (shared between blank + active states) ─────
  const filterPanel = (
    <div className="shrink-0 glass border-r overflow-y-auto" style={{ width: 220, padding: '12px 14px' }}>
      {/* Selection Criteria */}
      <p className="text-[13px] font-bold tracking-tight mb-3">Selection Criteria</p>

      {/* Time Range */}
      <label className="text-[11px] text-muted-foreground mb-1 block">Time Range</label>
      <div className="flex gap-1.5 mb-3">
        <input
          type="time" value={filterTimeFrom} onChange={e => setFilterTimeFrom(e.target.value)}
          className="flex-1 bg-background border border-border rounded-md text-[11px] tabular-nums px-1.5 py-1 outline-none focus:ring-1 focus:ring-foreground/20"
        />
        <input
          type="time" value={filterTimeTo} onChange={e => setFilterTimeTo(e.target.value)}
          className="flex-1 bg-background border border-border rounded-md text-[11px] tabular-nums px-1.5 py-1 outline-none focus:ring-1 focus:ring-foreground/20"
        />
      </div>

      {/* AC Type */}
      <label className="text-[11px] text-muted-foreground mb-1 block">AC Type</label>
      <select
        value={filterAcType} onChange={e => setFilterAcType(e.target.value)}
        className="w-full bg-background border border-border rounded-md text-[11px] px-2 py-1.5 mb-3 outline-none focus:ring-1 focus:ring-foreground/20"
      >
        <option value="">All</option>
        {aircraftTypes.map(t => <option key={t.id} value={t.icao_type}>{t.icao_type} — {t.name}</option>)}
      </select>

      {/* AC Registration */}
      <label className="text-[11px] text-muted-foreground mb-1 block">AC Registration</label>
      <select
        value={filterAcReg} onChange={e => setFilterAcReg(e.target.value)}
        className="w-full bg-background border border-border rounded-md text-[11px] px-2 py-1.5 mb-3 outline-none focus:ring-1 focus:ring-foreground/20"
      >
        <option value="">All</option>
        {registrations.filter(r => r.status === 'active').map(r => (
          <option key={r.id} value={r.registration}>{r.registration}</option>
        ))}
      </select>

      {/* DOM/INT */}
      <label className="text-[11px] text-muted-foreground mb-1 block">DOM / INT</label>
      <select
        value={filterRouteType} onChange={e => setFilterRouteType(e.target.value)}
        className="w-full bg-background border border-border rounded-md text-[11px] px-2 py-1.5 mb-3 outline-none focus:ring-1 focus:ring-foreground/20"
      >
        <option value="">All</option>
        <option value="domestic">Domestic</option>
        <option value="international">International</option>
      </select>

      {/* Status */}
      <label className="text-[11px] text-muted-foreground mb-1 block">Status</label>
      <select
        value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
        className="w-full bg-background border border-border rounded-md text-[11px] px-2 py-1.5 mb-3 outline-none focus:ring-1 focus:ring-foreground/20"
      >
        <option value="">All</option>
        <option value="draft">Draft</option>
        <option value="ready">Ready</option>
        <option value="published">Published</option>
      </select>

      <div className="border-t border-border my-3" />

      {/* Display Settings */}
      <p className="text-[13px] font-bold tracking-tight mb-3">Display Settings</p>

      <label className="text-[11px] text-muted-foreground mb-1 block">Display Times In</label>
      <select
        value={timeDisplay} onChange={e => setTimeDisplay(e.target.value as TimeDisplayMode)}
        className="w-full bg-background border border-border rounded-md text-[11px] px-2 py-1.5 mb-3 outline-none focus:ring-1 focus:ring-foreground/20"
      >
        <option value="utc">UTC</option>
        <option value="local_base">Local Base (SGN +7)</option>
        <option value="local_station">Local Station</option>
      </select>

      <label className="text-[11px] text-muted-foreground mb-1 block">Report Sequence</label>
      <select
        value={sortSequence} onChange={e => setSortSequence(e.target.value as SortSequence)}
        className="w-full bg-background border border-border rounded-md text-[11px] px-2 py-1.5 mb-3 outline-none focus:ring-1 focus:ring-foreground/20"
      >
        <option value="date_std">Date → STD</option>
        <option value="date_reg_std">Date → Reg → STD</option>
        <option value="reg_date_std">Reg → Date → STD</option>
        <option value="flt">Flight Number</option>
      </select>

      <button
        onClick={handleResetFilters}
        className="w-full mt-2 bg-muted/50 hover:bg-muted text-[11px] text-muted-foreground rounded-md py-1.5 transition-colors"
      >Reset Filters</button>
    </div>
  )

  // ─── BLANK STATE ──────────────────────────────────────────────
  if (!periodCommitted) {
    return (
      <div className="h-full flex flex-col overflow-hidden relative bg-background">
        <div className="shrink-0 glass border-b z-20" style={{ padding: '8px 16px' }}>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 mr-2">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              <span className="text-[15px] font-bold tracking-tight">1.3.1 Daily Flight Schedule</span>
            </div>
            {periodSelector}
          </div>
        </div>
        <div className="flex-1 flex overflow-hidden">
          {filterPanel}
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-6 w-[clamp(300px,35vw,550px)]" style={
                (loadingPhase !== 'idle' && loadingPhase !== 'done') ? { animation: 'watermark-breathe 4s ease-in-out infinite' } : undefined
              }>
                <img
                  src="/horizon-watermark.png" alt="" aria-hidden="true"
                  className="dark:hidden w-full h-auto select-none"
                  style={{ filter: 'grayscale(1) brightness(0) drop-shadow(0 1px 0 rgba(255,255,255,0.8))', opacity: 0.045, mixBlendMode: 'multiply' }}
                  draggable={false}
                />
                <div
                  className="hidden dark:block w-full opacity-[0.08]"
                  style={{
                    aspectRatio: '3 / 1.2', background: 'hsl(var(--primary))',
                    maskImage: "url('/horizon-watermark.png')", maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center',
                    WebkitMaskImage: "url('/horizon-watermark.png')", WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center',
                  }}
                />
              </div>
              <p className="font-medium text-muted-foreground/60" style={{ fontSize: 13 }}>Select a period to begin</p>
            </div>
          </div>
        </div>
        {loadingToast}
      </div>
    )
  }

  // ─── ACTIVE STATE ─────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden relative bg-background">
      {/* Header */}
      <div className="shrink-0 glass border-b z-20" style={{ padding: '8px 16px' }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 mr-2">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <span className="text-[15px] font-bold tracking-tight">1.3.1 Daily Flight Schedule</span>
          </div>
          {periodSelector}
        </div>
      </div>

      {/* Body: filter panel + content */}
      <div className="flex-1 flex overflow-hidden">
        {filterPanel}

        {/* Right content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border">
            {/* Quick filter */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
              <input
                type="text" placeholder="Quick filter..." value={quickFilter}
                onChange={e => setQuickFilter(e.target.value)}
                className="w-48 pl-8 pr-3 py-1.5 rounded-lg text-[11px] glass outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Active filter badges */}
            {activeFilters.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-[10px] text-primary font-medium">
                {f.label}
                <button onClick={f.onClear} className="hover:text-primary/70"><X className="w-3 h-3" /></button>
              </span>
            ))}

            <div className="flex-1" />

            {/* Column toggle */}
            <div className="relative">
              <button
                onClick={() => setColPopoverOpen(!colPopoverOpen)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Columns3 className="w-3.5 h-3.5" /> Columns
              </button>
              {colPopoverOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setColPopoverOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl glass border border-border shadow-lg p-2">
                    {columns.map(col => (
                      <button
                        key={col.id}
                        onClick={() => toggleCol(col.id)}
                        className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-[11px] hover:bg-muted/50 transition-colors"
                      >
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${col.visible ? 'bg-primary border-primary' : 'border-border'}`}>
                          {col.visible && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        {col.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Export */}
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>

          {/* Data table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse text-[11px]" style={{ minWidth: visibleCols.reduce((s, c) => s + c.width, 0) }}>
              <thead className="sticky top-0 z-10">
                <tr className="glass border-b border-border">
                  {visibleCols.map(col => (
                    <th
                      key={col.id}
                      draggable
                      onDragStart={() => handleColDragStart(col.id)}
                      onDragOver={e => handleColDragOver(e, col.id)}
                      onDrop={() => handleColDrop(col.id)}
                      className="text-left font-semibold text-muted-foreground px-2 py-1.5 cursor-grab select-none whitespace-nowrap"
                      style={{ width: col.width, minWidth: col.width }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayRows.length === 0 && (
                  <tr><td colSpan={visibleCols.length} className="text-center py-12 text-muted-foreground">No flights found</td></tr>
                )}
                {displayRows.map((row, idx) => {
                  const showSep = idx > 0 && groupKey(displayRows[idx]) !== groupKey(displayRows[idx - 1])
                  const isUnassigned = !row.aircraftReg
                  const std = formatStd(row)
                  const sta = formatSta(row)
                  const acColor = row.aircraftTypeIcao ? acTypeColorMap.get(row.aircraftTypeIcao) : undefined
                  const statusStyle = STATUS_COLORS[row.status] || STATUS_COLORS.draft

                  return (
                    <tr
                      key={row.key}
                      className={`
                        ${showSep ? 'border-t-2 border-border' : ''}
                        ${idx % 2 === 1 ? 'bg-muted/30' : ''}
                        ${isUnassigned ? 'bg-amber-500/[0.04]' : ''}
                        hover:bg-muted/50 transition-colors
                      `}
                    >
                      {visibleCols.map(col => {
                        switch (col.id) {
                          case 'date': return (
                            <td key={col.id} className="px-2 py-1 whitespace-nowrap tabular-nums">{formatDateDDMon(row.date)}</td>
                          )
                          case 'dow': return (
                            <td key={col.id} className="px-2 py-1 text-muted-foreground whitespace-nowrap">{row.dow}</td>
                          )
                          case 'flt': return (
                            <td key={col.id} className="px-2 py-1 font-semibold whitespace-nowrap">{row.airlineCode}{row.flightNumber}</td>
                          )
                          case 'dep': return (
                            <td key={col.id} className="px-2 py-1 font-bold whitespace-nowrap">{row.depStation}</td>
                          )
                          case 'arr': return (
                            <td key={col.id} className="px-2 py-1 font-bold whitespace-nowrap">{row.arrStation}</td>
                          )
                          case 'std': return (
                            <td key={col.id} className="px-2 py-1 whitespace-nowrap tabular-nums font-mono text-[10px]">
                              {std.text}<span className="text-muted-foreground/60 text-[9px]">{std.suffix}</span>
                            </td>
                          )
                          case 'sta': return (
                            <td key={col.id} className="px-2 py-1 whitespace-nowrap tabular-nums font-mono text-[10px]">
                              {sta.text}<span className="text-muted-foreground/60 text-[9px]">{sta.suffix}</span>
                            </td>
                          )
                          case 'block': return (
                            <td key={col.id} className="px-2 py-1 whitespace-nowrap tabular-nums text-muted-foreground">{blockToHMM(row.blockMinutes)}</td>
                          )
                          case 'acType': return (
                            <td key={col.id} className="px-2 py-1 whitespace-nowrap">
                              {row.aircraftTypeIcao ? (
                                <span
                                  className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium"
                                  style={{
                                    backgroundColor: acColor ? `${acColor}20` : undefined,
                                    color: acColor || undefined,
                                  }}
                                >{row.aircraftTypeIcao}</span>
                              ) : null}
                            </td>
                          )
                          case 'acReg': return (
                            <td key={col.id} className="px-2 py-1 whitespace-nowrap tabular-nums">
                              {row.aircraftReg || ''}
                            </td>
                          )
                          case 'svcType': return (
                            <td key={col.id} className="px-2 py-1 whitespace-nowrap text-muted-foreground">{row.serviceType}</td>
                          )
                          case 'status': return (
                            <td key={col.id} className="px-2 py-1 whitespace-nowrap">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${statusStyle.bg} ${statusStyle.text}`}>
                                {row.status}
                              </span>
                            </td>
                          )
                          case 'route': return (
                            <td key={col.id} className="px-2 py-1 whitespace-nowrap">
                              {row.routeType ? (
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  row.routeType === 'domestic'
                                    ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                                    : 'bg-violet-500/15 text-violet-600 dark:text-violet-400'
                                }`}>
                                  {row.routeType === 'domestic' ? 'DOM' : 'INT'}
                                </span>
                              ) : null}
                            </td>
                          )
                          default: return <td key={col.id} className="px-2 py-1" />
                        }
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="shrink-0 glass border-t border-border px-4 py-2 flex items-center gap-4 text-[11px]">
            <span className="text-muted-foreground">
              Total: <span className="text-foreground font-semibold">{summary.total.toLocaleString()}</span> flights
            </span>
            <span className="text-green-600 dark:text-green-400">
              Assigned: <span className="font-semibold">{summary.assigned.toLocaleString()}</span>
            </span>
            {summary.unassigned > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                Unassigned: <span className="font-semibold">{summary.unassigned.toLocaleString()}</span>
              </span>
            )}
            <span className="text-muted-foreground">
              Block: <span className="text-foreground font-semibold">{blockToHMM(summary.blockMinutes)}</span>
            </span>
            <span className="text-muted-foreground">
              Aircraft: <span className="text-foreground font-semibold">{summary.uniqueAc}</span>
            </span>
            <div className="flex-1" />
            {sortedRows.length > 500 && (
              <span className="text-muted-foreground">
                Showing <span className="text-foreground font-medium">500</span> of <span className="text-foreground font-medium">{sortedRows.length.toLocaleString()}</span>
              </span>
            )}
          </div>
        </div>
      </div>
      {loadingToast}
    </div>
  )
}
