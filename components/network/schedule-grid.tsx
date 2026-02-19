'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ScheduleSeason, AircraftType, FlightServiceType, FlightNumber, ScheduleScenario } from '@/types/database'
import { getFlightsByDateRange, cancelFlight, restoreFlight, updateFlightInline, deleteFlightNumbers } from '@/app/actions/flight-numbers'
import { cn } from '@/lib/utils'
import { AlertTriangle, X, RotateCcw, ArrowDown } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

interface ScheduleGridProps {
  seasons: ScheduleSeason[]
  aircraftTypes: AircraftType[]
  flightServiceTypes: FlightServiceType[]
  scenarios?: (ScheduleScenario & { route_count: number })[]
}

// ─── Types ────────────────────────────────────────────────────

type EditableField = 'std' | 'sta' | 'days_of_week' | 'service_type' | 'aircraft_type_id'

interface PendingChange {
  flightId: string
  field: EditableField
  oldValue: string | null
  newValue: string | null
  flightNumber: string
  fieldLabel: string
}

interface ContextMenuState {
  x: number
  y: number
  flight: FlightNumber
}

interface EditingCell {
  flightId: string
  field: EditableField
}

type SortMode = 'rotation' | 'std' | 'flight_number' | 'dep' | 'arr' | 'ac' | 'svc'

interface AnnotatedFlight {
  flight: FlightNumber
  chainIndex: number
  isFirstInChain: boolean
}

// ─── Season/Date Helpers ──────────────────────────────────────

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

function isoToDisplay(iso: string): string {
  if (!iso || iso.length !== 10) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function displayToISO(display: string): string {
  const parts = display.split('/')
  if (parts.length !== 3 || parts[2].length !== 4) return ''
  return `${parts[2]}-${parts[1]}-${parts[0]}`
}

function parseSeasonCode(code: string): { start: string; end: string } | null {
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
function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '')
  let display = digits
  if (digits.length >= 2) display = digits.slice(0, 2) + '/' + digits.slice(2)
  if (digits.length >= 4) display = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8)
  return display
}

function getCurrentSeasonDates(): { from: string; to: string } {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-indexed

  // Winter: late Oct → late Mar, Summer: late Mar → late Oct
  if (month >= 9) {
    // Oct-Dec: Winter season of this year
    const y2 = year % 100
    const parsed = parseSeasonCode(`W${y2}`)
    if (parsed) return { from: parsed.start, to: parsed.end }
  } else if (month <= 2) {
    // Jan-Mar: Still winter season from previous year
    const y2 = (year - 1) % 100
    const parsed = parseSeasonCode(`W${y2}`)
    if (parsed) return { from: parsed.start, to: parsed.end }
  } else {
    // Apr-Sep: Summer season
    const y2 = year % 100
    const parsed = parseSeasonCode(`S${y2}`)
    if (parsed) return { from: parsed.start, to: parsed.end }
  }

  // Fallback
  return { from: fmtDateISO(new Date(year, 0, 1)), to: fmtDateISO(new Date(year, 11, 31)) }
}

const LS_KEY = 'schedule-grid-dates'

// ─── DOW Helpers ──────────────────────────────────────────────

const DOW_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function isDayActive(value: string, pos: number): boolean {
  return value.charAt(pos) === String(pos + 1)
}

// ─── Rotation Chain Builder ───────────────────────────────────

function buildRotationChains(flights: FlightNumber[]): AnnotatedFlight[] {
  if (flights.length === 0) return []

  function toMinutes(hhmm: string | null): number {
    if (!hhmm || hhmm.length !== 4) return -1
    return parseInt(hhmm.slice(0, 2)) * 60 + parseInt(hhmm.slice(2))
  }

  function dowOverlap(a: string, b: string): boolean {
    for (let i = 0; i < 7; i++) {
      if (a.charAt(i) === String(i + 1) && b.charAt(i) === String(i + 1)) return true
    }
    return false
  }

  // Sort by STD ascending
  const sorted = [...flights].sort((a, b) => {
    const sa = a.std || '9999'
    const sb = b.std || '9999'
    if (sa !== sb) return sa.localeCompare(sb)
    return a.flight_number.localeCompare(b.flight_number)
  })

  const assigned = new Set<string>()
  const chains: FlightNumber[][] = []

  for (const flight of sorted) {
    if (assigned.has(flight.id)) continue

    // Cancelled flights → standalone chains
    if (flight.status === 'cancelled') {
      chains.push([flight])
      assigned.add(flight.id)
      continue
    }

    const chain: FlightNumber[] = [flight]
    assigned.add(flight.id)

    let current = flight
    // Greedily extend chain forward
    while (true) {
      const currentSta = toMinutes(current.sta)
      if (currentSta < 0) break

      let bestCandidate: FlightNumber | null = null
      let bestTurnaround = Infinity

      for (const candidate of sorted) {
        if (assigned.has(candidate.id)) continue
        if (candidate.status === 'cancelled') continue
        // Must depart from where current arrives
        if (candidate.departure_iata !== current.arrival_iata) continue
        // Same aircraft type (skip check if either is null)
        if (current.aircraft_type_id && candidate.aircraft_type_id && current.aircraft_type_id !== candidate.aircraft_type_id) continue
        // Must share at least one operating day
        const currentDow = current.days_of_operation || ''
        const candidateDow = candidate.days_of_operation || ''
        if (currentDow && candidateDow && !dowOverlap(currentDow, candidateDow)) continue

        const candidateStd = toMinutes(candidate.std)
        if (candidateStd < 0) continue

        let turnaround = candidateStd - currentSta
        if (turnaround < 0) turnaround += 1440 // wrap overnight

        // Turnaround must be 30–360 minutes
        if (turnaround < 30 || turnaround > 360) continue

        if (turnaround < bestTurnaround) {
          bestTurnaround = turnaround
          bestCandidate = candidate
        }
      }

      if (!bestCandidate) break
      chain.push(bestCandidate)
      assigned.add(bestCandidate.id)
      current = bestCandidate
    }

    chains.push(chain)
  }

  // Sort chains by first flight's STD
  chains.sort((a, b) => {
    const sa = a[0].std || '9999'
    const sb = b[0].std || '9999'
    if (sa !== sb) return sa.localeCompare(sb)
    return a[0].flight_number.localeCompare(b[0].flight_number)
  })

  // Flatten to AnnotatedFlight[]
  const result: AnnotatedFlight[] = []
  for (let ci = 0; ci < chains.length; ci++) {
    for (let fi = 0; fi < chains[ci].length; fi++) {
      result.push({
        flight: chains[ci][fi],
        chainIndex: ci,
        isFirstInChain: fi === 0,
      })
    }
  }
  return result
}

// ─── DOW Circles (read-only, matching Schedule Builder) ───────

function DowCirclesDisplay({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-[2px]">
      {DOW_LETTERS.map((label, i) => (
        <div
          key={i}
          className={cn(
            'w-[22px] h-[22px] rounded-full text-[10px] font-semibold leading-none flex items-center justify-center select-none',
            isDayActive(value, i)
              ? 'bg-primary text-primary-foreground'
              : 'bg-transparent text-[#d1d5db] dark:text-[#4b5563] border-[1.5px] border-[#e5e7eb] dark:border-[#374151]',
          )}
        >{label}</div>
      ))}
    </div>
  )
}

// ─── Time Display (muted colon) ───────────────────────────────

function TimeDisplay({ value }: { value: string | null }) {
  if (!value || value.length !== 4) return <span className="text-muted-foreground/30">&mdash;</span>
  return (
    <span className="font-mono text-[12px]">
      {value.slice(0, 2)}<span className="opacity-40">:</span>{value.slice(2)}
    </span>
  )
}

function BlockDisplay({ std, sta, blockMinutes }: { std: string | null; sta: string | null; blockMinutes?: number }) {
  let h = 0, m = 0
  if (blockMinutes && blockMinutes > 0) {
    h = Math.floor(blockMinutes / 60)
    m = blockMinutes % 60
  } else if (std && sta && std.length === 4 && sta.length === 4) {
    const stdMins = parseInt(std.slice(0, 2)) * 60 + parseInt(std.slice(2))
    const staMins = parseInt(sta.slice(0, 2)) * 60 + parseInt(sta.slice(2))
    let block = staMins - stdMins
    if (block < 0) block += 1440
    h = Math.floor(block / 60)
    m = block % 60
  } else {
    return <span className="text-muted-foreground/30">&mdash;</span>
  }
  return (
    <span className="font-mono text-[11px] text-muted-foreground">
      {h}<span className="opacity-40">:</span>{m.toString().padStart(2, '0')}
    </span>
  )
}

// ─── Status Filter Toggle ─────────────────────────────────────

function StatusToggle({ label, checked, onChange, dotColor }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; dotColor: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'h-7 px-3 rounded-full text-xs font-medium transition-all duration-150 flex items-center gap-1.5 select-none',
        checked
          ? 'glass shadow-sm text-foreground'
          : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-black/[0.03]'
      )}
    >
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor, opacity: checked ? 1 : 0.3 }} />
      {label}
    </button>
  )
}

// ─── Conflict Tooltip ─────────────────────────────────────────

function ConflictTooltip({ scenarios }: { scenarios: string[] }) {
  return (
    <div className="relative group/conflict inline-flex items-center">
      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover/conflict:opacity-100 transition-opacity z-50">
        <div className="glass-heavy rounded-lg px-3 py-2 shadow-lg min-w-[200px] whitespace-nowrap">
          <p className="text-[11px] font-medium text-foreground mb-1">Conflict</p>
          <p className="text-[11px] text-muted-foreground">
            Exists in: {scenarios.join(', ')}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Draft Tooltip ────────────────────────────────────────────

function DraftTooltip({ scenarioNumber, scenarioName, children }: {
  scenarioNumber: string | null; scenarioName: string | null; children: React.ReactNode
}) {
  if (!scenarioNumber && !scenarioName) return <>{children}</>
  return (
    <div className="relative group/draft inline">
      {children}
      <div className="absolute left-0 bottom-full mb-1 pointer-events-none opacity-0 group-hover/draft:opacity-100 transition-opacity z-50">
        <div className="glass-heavy rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap">
          <p className="text-[11px] text-muted-foreground">
            Draft from <span className="font-mono font-medium text-foreground">{scenarioNumber}</span>
            {scenarioName && <span> ({scenarioName})</span>}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Context Menu ─────────────────────────────────────────────

function FlightContextMenu({ state, onClose, onAction }: {
  state: ContextMenuState
  onClose: () => void
  onAction: (action: string, flight: FlightNumber) => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const { x, y, flight } = state
  const isDraft = flight.status === 'draft'
  const isCancelled = flight.status === 'cancelled'
  const isPublished = flight.status === 'published'

  useEffect(() => {
    const handleClick = () => onClose()
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  const style: React.CSSProperties = { position: 'fixed', left: x, top: y, zIndex: 100 }

  const MenuItem = ({ label, onClick, destructive }: { label: string; onClick: () => void; destructive?: boolean }) => (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); onClose() }}
      className={cn(
        'w-full text-left px-3 py-1.5 text-[12px] rounded-md transition-colors',
        destructive
          ? 'text-red-500 hover:bg-red-500/10'
          : 'text-foreground hover:bg-white/10 dark:hover:bg-white/5'
      )}
    >
      {label}
    </button>
  )

  return (
    <div ref={menuRef} style={style} className="glass-heavy rounded-lg shadow-xl p-1 min-w-[160px] border border-white/10">
      <div className="px-3 py-1.5 text-[11px] font-mono font-medium text-muted-foreground border-b border-white/5 mb-1">
        {flight.flight_number}
      </div>

      {isPublished && (
        <>
          <MenuItem label="Edit in Builder" onClick={() => onAction('openBuilder', flight)} />
          <MenuItem label="Duplicate" onClick={() => onAction('duplicate', flight)} />
          <MenuItem label="Cancel Flight" onClick={() => onAction('cancel', flight)} destructive />
        </>
      )}

      {isDraft && (
        <>
          <MenuItem label="Edit in Builder" onClick={() => onAction('openBuilder', flight)} />
          <MenuItem label="Duplicate" onClick={() => onAction('duplicate', flight)} />
          <MenuItem label="Cancel Flight" onClick={() => onAction('cancel', flight)} destructive />
          <MenuItem label="Delete" onClick={() => onAction('delete', flight)} destructive />
        </>
      )}

      {isCancelled && (
        <>
          <MenuItem label="Restore Flight" onClick={() => onAction('restore', flight)} />
          <MenuItem label="Delete Permanently" onClick={() => onAction('delete', flight)} destructive />
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export function ScheduleGrid({ seasons, aircraftTypes, flightServiceTypes }: ScheduleGridProps) {
  const router = useRouter()

  // ── Date range state ──
  const [dateFromISO, setDateFromISO] = useState('')
  const [dateToISO, setDateToISO] = useState('')
  const [dateFromDisplay, setDateFromDisplay] = useState('')
  const [dateToDisplay, setDateToDisplay] = useState('')
  const [seasonInput, setSeasonInput] = useState('')

  const [flights, setFlights] = useState<FlightNumber[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterAcType, setFilterAcType] = useState('')
  const [filterDep, setFilterDep] = useState('')
  const [filterSvcType, setFilterSvcType] = useState('')

  // ── Status filters ──
  const [showPublished, setShowPublished] = useState(true)
  const [showDrafts, setShowDrafts] = useState(true)
  const [showCancelled, setShowCancelled] = useState(false)

  // ── Scenario filter ──
  const [filterScenario, setFilterScenario] = useState('')

  // ── Sort mode ──
  const [sortMode, setSortMode] = useState<SortMode>('rotation')

  // ── Inline editing ──
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([])
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showReviewDialog, setShowReviewDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const editInputRef = useRef<HTMLInputElement>(null)

  // ── Row selection ──
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())

  // ── Context menu ──
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  // ── Debounce timer ──
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Keyboard shortcut refs (avoids stale closures) ──
  const shortcutRefs = useRef<{
    cancel: () => void
    selectAll: () => void
    moveSelection: (dir: 'up' | 'down') => void
    expandSelection: (dir: 'up' | 'down') => void
    deleteSelected: () => void
    duplicateSelected: () => void
  }>({
    cancel: () => {},
    selectAll: () => {},
    moveSelection: () => {},
    expandSelection: () => {},
    deleteSelected: () => {},
    duplicateSelected: () => {},
  })

  // ── Initialize dates from localStorage or current season ──
  useEffect(() => {
    let from = ''
    let to = ''
    let season = ''

    try {
      const stored = localStorage.getItem(LS_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.from && parsed.to) {
          from = parsed.from
          to = parsed.to
          season = parsed.season || ''
        }
      }
    } catch { /* ignore */ }

    if (!from || !to) {
      const defaults = getCurrentSeasonDates()
      from = defaults.from
      to = defaults.to
      // Try to detect season code
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth()
      if (month >= 9 || month <= 2) {
        season = `W${(month >= 9 ? year : year - 1) % 100}`
      } else {
        season = `S${year % 100}`
      }
    }

    setDateFromISO(from)
    setDateToISO(to)
    setDateFromDisplay(isoToDisplay(from))
    setDateToDisplay(isoToDisplay(to))
    setSeasonInput(season)
  }, [])

  // ── Persist dates to localStorage ──
  useEffect(() => {
    if (dateFromISO && dateToISO) {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ from: dateFromISO, to: dateToISO, season: seasonInput }))
      } catch { /* ignore */ }
    }
  }, [dateFromISO, dateToISO, seasonInput])

  // ── Fetch flights (debounced) ──
  const fetchFlights = useCallback(async (from: string, to: string) => {
    if (!from || !to || from.length !== 10 || to.length !== 10) return
    setLoading(true)
    const data = await getFlightsByDateRange(from, to)
    setFlights(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!dateFromISO || !dateToISO) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchFlights(dateFromISO, dateToISO)
    }, 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [dateFromISO, dateToISO, fetchFlights])

  // ── Date input handlers ──
  function handleFromInput(value: string) {
    const display = formatDateInput(value)
    setDateFromDisplay(display)
    const iso = displayToISO(display)
    if (iso) setDateFromISO(iso)
  }

  function handleToInput(value: string) {
    const display = formatDateInput(value)
    setDateToDisplay(display)
    const iso = displayToISO(display)
    if (iso) setDateToISO(iso)
  }

  function handleSeasonInput(value: string) {
    const upper = value.toUpperCase()
    setSeasonInput(upper)
    const parsed = parseSeasonCode(upper)
    if (parsed) {
      setDateFromISO(parsed.start)
      setDateToISO(parsed.end)
      setDateFromDisplay(isoToDisplay(parsed.start))
      setDateToDisplay(isoToDisplay(parsed.end))
    }
  }

  // ── Re-fetch helper (for after mutations) ──
  const refetch = useCallback(async () => {
    if (dateFromISO && dateToISO) {
      const data = await getFlightsByDateRange(dateFromISO, dateToISO)
      setFlights(data)
    }
  }, [dateFromISO, dateToISO])

  // ── Lookup maps ──
  const acTypeMap = useMemo(() => {
    const m = new Map<string, AircraftType>()
    aircraftTypes.forEach(t => m.set(t.id, t))
    return m
  }, [aircraftTypes])

  const svcTypeMap = useMemo(() => {
    const m = new Map<string, FlightServiceType>()
    flightServiceTypes.forEach(s => m.set(s.code, s))
    return m
  }, [flightServiceTypes])

  // ── Conflict detection ──
  const conflictMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    const draftsByNumber = new Map<string, FlightNumber[]>()
    for (const f of flights) {
      if (f.status !== 'draft' || !f.scenario_id) continue
      const arr = draftsByNumber.get(f.flight_number) || []
      arr.push(f)
      draftsByNumber.set(f.flight_number, arr)
    }
    for (const [, group] of Array.from(draftsByNumber)) {
      if (group.length < 2) continue
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i], b = group[j]
          if (a.scenario_id === b.scenario_id) continue
          const aStart = a.effective_from || '', aEnd = a.effective_until || ''
          const bStart = b.effective_from || '', bEnd = b.effective_until || ''
          if (aStart <= bEnd && bStart <= aEnd) {
            const aScen = a.scenario_number || a.scenario_id || 'Unknown'
            const bScen = b.scenario_number || b.scenario_id || 'Unknown'
            const setA = map.get(a.id) || new Set()
            setA.add(aScen); setA.add(bScen)
            map.set(a.id, setA)
            const setB = map.get(b.id) || new Set()
            setB.add(aScen); setB.add(bScen)
            map.set(b.id, setB)
          }
        }
      }
    }
    return map
  }, [flights])

  // ── Unique scenarios in flights ──
  const flightScenarios = useMemo(() => {
    const m = new Map<string, { id: string; name: string; number: string }>()
    for (const f of flights) {
      if (f.scenario_id && !m.has(f.scenario_id)) {
        m.set(f.scenario_id, { id: f.scenario_id, name: f.scenario_name || '', number: f.scenario_number || '' })
      }
    }
    return Array.from(m.values()).sort((a, b) => a.number.localeCompare(b.number))
  }, [flights])

  // ── Pending changes overlay ──
  const getDisplayValue = useCallback((flight: FlightNumber, field: EditableField): string | null => {
    const pending = pendingChanges.find(c => c.flightId === flight.id && c.field === field)
    if (pending) return pending.newValue
    switch (field) {
      case 'std': return flight.std
      case 'sta': return flight.sta
      case 'days_of_week': return flight.days_of_week
      case 'service_type': return flight.service_type
      case 'aircraft_type_id': return flight.aircraft_type_id
      default: return null
    }
  }, [pendingChanges])

  const hasChange = useCallback((flightId: string, field: EditableField): boolean => {
    return pendingChanges.some(c => c.flightId === flightId && c.field === field)
  }, [pendingChanges])

  const flightHasChanges = useCallback((flightId: string): boolean => {
    return pendingChanges.some(c => c.flightId === flightId)
  }, [pendingChanges])

  // ── Filtered list (no sort) ──
  const filteredFlights = useMemo(() => {
    return flights.filter(f => {
      if (f.status === 'published' && !showPublished) return false
      if (f.status === 'draft' && !showDrafts) return false
      if (f.status === 'cancelled' && !showCancelled) return false
      if (search && !f.flight_number.toLowerCase().includes(search.toLowerCase())) return false
      if (filterAcType && f.aircraft_type_id !== filterAcType) return false
      if (filterDep && f.departure_iata !== filterDep) return false
      if (filterSvcType && f.service_type !== filterSvcType) return false
      if (filterScenario && f.status === 'draft' && f.scenario_id !== filterScenario) return false
      return true
    })
  }, [flights, search, filterAcType, filterDep, filterSvcType, showPublished, showDrafts, showCancelled, filterScenario])

  // ── Display list (sorted/chained) ──
  const displayList = useMemo((): AnnotatedFlight[] => {
    if (sortMode === 'rotation') {
      return buildRotationChains(filteredFlights)
    }
    const sorted = [...filteredFlights].sort((a, b) => {
      switch (sortMode) {
        case 'std': {
          const sa = a.std || '9999', sb = b.std || '9999'
          if (sa !== sb) return sa.localeCompare(sb)
          return a.flight_number.localeCompare(b.flight_number)
        }
        case 'flight_number':
          return a.flight_number.localeCompare(b.flight_number)
        case 'dep':
          return (a.departure_iata || '').localeCompare(b.departure_iata || '')
        case 'arr':
          return (a.arrival_iata || '').localeCompare(b.arrival_iata || '')
        case 'ac':
          return (a.aircraft_type_icao || '').localeCompare(b.aircraft_type_icao || '')
        case 'svc':
          return (a.service_type || '').localeCompare(b.service_type || '')
        default:
          return 0
      }
    })
    return sorted.map((f, i) => ({ flight: f, chainIndex: i, isFirstInChain: true }))
  }, [filteredFlights, sortMode])

  // ── Stats (Fix 2) ──
  const stats = useMemo(() => {
    const published = flights.filter(f => f.status === 'published').length
    const drafts = flights.filter(f => f.status === 'draft').length
    const cancelled = flights.filter(f => f.status === 'cancelled').length

    // Daily movements per DOW
    const dayMovements = [0, 0, 0, 0, 0, 0, 0]
    for (const f of flights) {
      if (f.status === 'cancelled') continue
      const dow = f.days_of_operation || ''
      for (let i = 0; i < 7; i++) {
        if (dow[i] && dow[i] !== '.' && dow[i] !== ' ') {
          dayMovements[i]++
        }
      }
    }
    const avgDaily = Math.round(dayMovements.reduce((a, b) => a + b, 0) / 7)
    const peakDay = Math.max(...dayMovements)
    const peakDayIdx = dayMovements.indexOf(peakDay)
    const peakDayName = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][peakDayIdx]

    const acTypes = new Set(flights.filter(f => f.aircraft_type_icao).map(f => f.aircraft_type_icao)).size
    const sectors = new Set(flights.filter(f => f.status !== 'cancelled').map(f => `${f.departure_iata}-${f.arrival_iata}`)).size

    return { total: flights.length, published, drafts, cancelled, avgDaily, peakDay, peakDayName, acTypes, sectors }
  }, [flights])

  // ── Unique departures ──
  const departures = useMemo(
    () => Array.from(new Set(flights.map(f => f.departure_iata).filter((d): d is string => !!d))).sort(),
    [flights],
  )

  // ─── Keyboard Shortcuts (mirroring Schedule Builder) ──────

  useEffect(() => {
    shortcutRefs.current = {
      cancel: () => {
        if (editingCell) { setEditingCell(null) }
        else if (selectedRows.size > 0) { setSelectedRows(new Set()) }
      },
      selectAll: () => {
        if (displayList.length === 0) return
        setSelectedRows(new Set(displayList.map(a => a.flight.id)))
        setEditingCell(null)
      },
      moveSelection: (direction) => {
        const ids = displayList.map(a => a.flight.id)
        if (ids.length === 0) return
        if (selectedRows.size === 0) {
          setSelectedRows(new Set([direction === 'down' ? ids[0] : ids[ids.length - 1]]))
          return
        }
        const selectedIndices = ids.map((id, i) => selectedRows.has(id) ? i : -1).filter(i => i >= 0).sort((a, b) => a - b)
        if (direction === 'down') {
          const max = selectedIndices[selectedIndices.length - 1]
          if (max + 1 < ids.length) setSelectedRows(new Set([ids[max + 1]]))
        } else {
          const min = selectedIndices[0]
          if (min - 1 >= 0) setSelectedRows(new Set([ids[min - 1]]))
        }
      },
      expandSelection: (direction) => {
        if (selectedRows.size === 0) return
        const ids = displayList.map(a => a.flight.id)
        const selectedIndices = ids.map((id, i) => selectedRows.has(id) ? i : -1).filter(i => i >= 0).sort((a, b) => a - b)
        const next = new Set(selectedRows)
        if (direction === 'down') {
          const max = selectedIndices[selectedIndices.length - 1]
          if (max + 1 < ids.length) next.add(ids[max + 1])
        } else {
          const min = selectedIndices[0]
          if (min - 1 >= 0) next.add(ids[min - 1])
        }
        setSelectedRows(next)
      },
      deleteSelected: async () => {
        if (selectedRows.size === 0) return
        const ids = Array.from(selectedRows)
        const result = await deleteFlightNumbers(ids)
        if (!result.error) {
          setSelectedRows(new Set())
          await refetch()
        }
      },
      duplicateSelected: () => {
        if (selectedRows.size !== 1) return
        const id = Array.from(selectedRows)[0]
        router.push(`/network/control/schedule-builder?duplicate=${id}`)
      },
    }
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      const el = document.activeElement
      const isTyping = el?.tagName === 'INPUT' || el?.tagName === 'SELECT' || el?.tagName === 'TEXTAREA'

      // Ctrl+F: Focus search
      if (mod && e.key === 'f') { e.preventDefault(); e.stopPropagation(); document.getElementById('grid-search')?.focus(); return }

      // Ctrl+A: Select all
      if (mod && e.key === 'a' && !isTyping) { e.preventDefault(); e.stopPropagation(); shortcutRefs.current.selectAll(); return }

      // Ctrl+D: Duplicate selected flight
      if (mod && e.key === 'd' && !isTyping) { e.preventDefault(); e.stopPropagation(); shortcutRefs.current.duplicateSelected(); return }

      // Delete: Delete selected flights
      if (e.key === 'Delete' && !isTyping) { e.preventDefault(); shortcutRefs.current.deleteSelected(); return }

      // Arrow Up/Down: Move or expand selection
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !isTyping && !mod) {
        e.preventDefault(); e.stopPropagation()
        const dir = e.key === 'ArrowDown' ? 'down' : 'up'
        if (e.shiftKey) {
          shortcutRefs.current.expandSelection(dir)
        } else {
          shortcutRefs.current.moveSelection(dir)
        }
        return
      }

      // Escape: Hierarchical cancel (edit → selection)
      if (e.key === 'Escape') { shortcutRefs.current.cancel(); return }
    }
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [])

  // ─── Inline Editing ────────────────────────────────────────

  function startEditing(flight: FlightNumber, field: EditableField) {
    if (flight.status === 'cancelled') return
    const currentVal = getDisplayValue(flight, field) || ''
    setEditingCell({ flightId: flight.id, field })
    setEditValue(currentVal)
    setTimeout(() => editInputRef.current?.focus(), 0)
  }

  function commitEdit() {
    if (!editingCell) return
    const flight = flights.find(f => f.id === editingCell.flightId)
    if (!flight) { setEditingCell(null); return }

    const field = editingCell.field
    let oldValue: string | null = null
    let fieldLabel: string = field

    switch (field) {
      case 'std': oldValue = flight.std; fieldLabel = 'STD'; break
      case 'sta': oldValue = flight.sta; fieldLabel = 'STA'; break
      case 'days_of_week': oldValue = flight.days_of_week; fieldLabel = 'DOW'; break
      case 'service_type': oldValue = flight.service_type; fieldLabel = 'SVC'; break
      case 'aircraft_type_id': oldValue = flight.aircraft_type_id; fieldLabel = 'AC Type'; break
    }

    const newValue = editValue.trim() || null
    if (newValue === oldValue) {
      setEditingCell(null)
      return
    }

    setPendingChanges(prev => {
      const without = prev.filter(c => !(c.flightId === flight.id && c.field === field))
      if (newValue === oldValue) return without
      return [...without, {
        flightId: flight.id,
        field,
        oldValue,
        newValue,
        flightNumber: flight.flight_number,
        fieldLabel,
      }]
    })
    setEditingCell(null)
  }

  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit()
    } else if (e.key === 'Escape') {
      setEditingCell(null)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      commitEdit()
      if (editingCell) {
        const fields: EditableField[] = ['std', 'sta', 'days_of_week', 'aircraft_type_id', 'service_type']
        const idx = fields.indexOf(editingCell.field)
        const nextField = fields[(idx + 1) % fields.length]
        const flight = flights.find(f => f.id === editingCell.flightId)
        if (flight) startEditing(flight, nextField)
      }
    }
  }

  async function saveAllChanges() {
    if (pendingChanges.length === 0) return
    setSaving(true)

    const byFlight = new Map<string, Record<string, unknown>>()
    for (const c of pendingChanges) {
      const existing = byFlight.get(c.flightId) || {}
      existing[c.field] = c.newValue
      byFlight.set(c.flightId, existing)
    }

    for (const [flightId, changes] of Array.from(byFlight)) {
      const flight = flights.find(f => f.id === flightId)
      if (!flight) continue
      const newStd = (changes.std as string) || flight.std
      const newSta = (changes.sta as string) || flight.sta
      if (changes.std || changes.sta) {
        if (newStd && newSta && newStd.length === 4 && newSta.length === 4) {
          const stdMins = parseInt(newStd.slice(0, 2)) * 60 + parseInt(newStd.slice(2))
          const staMins = parseInt(newSta.slice(0, 2)) * 60 + parseInt(newSta.slice(2))
          let block = staMins - stdMins
          if (block < 0) block += 1440
          changes.block_minutes = block
        }
      }
    }

    let hasError = false
    for (const [flightId, changes] of Array.from(byFlight)) {
      const result = await updateFlightInline(flightId, changes)
      if (result.error) { hasError = true; break }
    }

    if (!hasError) {
      setPendingChanges([])
      setShowReviewDialog(false)
      await refetch()
    }
    setSaving(false)
  }

  function discardAllChanges() {
    setPendingChanges([])
    setShowReviewDialog(false)
  }

  // ─── Context Menu Actions ──────────────────────────────────

  async function handleContextAction(action: string, flight: FlightNumber) {
    switch (action) {
      case 'openBuilder':
        router.push(`/network/control/schedule-builder?highlight=${flight.id}`)
        break
      case 'cancel': {
        const result = await cancelFlight(flight.id)
        if (!result.error) await refetch()
        break
      }
      case 'restore': {
        const result = await restoreFlight(flight.id)
        if (!result.error) await refetch()
        break
      }
      case 'delete': {
        const result = await deleteFlightNumbers([flight.id])
        if (!result.error) await refetch()
        break
      }
      case 'duplicate':
        router.push(`/network/control/schedule-builder?duplicate=${flight.id}`)
        break
    }
  }

  function handleRowClick(e: React.MouseEvent, flight: FlightNumber) {
    // Don't select when clicking on inputs/selects (inline editing)
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'BUTTON') return
    setSelectedRows(new Set([flight.id]))
  }

  function handleContextMenu(e: React.MouseEvent, flight: FlightNumber) {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, flight })
  }

  // ─── Helpers ───────────────────────────────────────────────

  function getLeftBorderColor(flight: FlightNumber): string {
    if (flight.status === 'draft') return '#f59e0b'
    if (flight.status === 'cancelled') return '#9ca3af'
    return 'transparent'
  }

  function formatTime(t: string | null): string {
    if (!t || t.length !== 4) return '\u2014'
    return t.slice(0, 2) + ':' + t.slice(2)
  }

  // ── No seasons guard ──
  if (!seasons.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No schedule seasons found</p>
        <p className="text-sm mt-1">Create a schedule season in Admin &rarr; Network Config first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {/* Row 1: Date range + season shortcut (left) | Filter toggles (right) */}
      <div className="flex items-end justify-between gap-4 pb-3">
        {/* Left: Date range + season */}
        <div className="flex items-end gap-3">
          {/* From */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">From</label>
            <input
              type="text"
              value={dateFromDisplay}
              onChange={e => handleFromInput(e.target.value)}
              placeholder="DD/MM/YYYY"
              maxLength={10}
              className="w-[110px] h-9 px-3 rounded-lg border border-input bg-background text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <span className="text-muted-foreground/50 pb-2">&mdash;</span>
          {/* To */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">To</label>
            <input
              type="text"
              value={dateToDisplay}
              onChange={e => handleToInput(e.target.value)}
              placeholder="DD/MM/YYYY"
              maxLength={10}
              className="w-[110px] h-9 px-3 rounded-lg border border-input bg-background text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {/* Season shortcut */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Season</label>
            <input
              type="text"
              value={seasonInput}
              onChange={e => handleSeasonInput(e.target.value)}
              placeholder="W25"
              maxLength={3}
              className="w-[60px] h-9 px-2 rounded-lg border border-input bg-background text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Search */}
          <input
            id="grid-search"
            placeholder="Search flight..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-[150px] h-9 rounded-lg border border-input bg-background px-3 text-sm ml-2"
          />

          {/* Stats pill */}
          <div className="h-9 flex items-center gap-3 px-4 rounded-full border border-border/60 text-[11px] text-[#6b7280] ml-2 whitespace-nowrap">
            <span>
              <strong className="font-medium text-foreground">{stats.total}</strong> flights
              {' '}({stats.published} published
              {stats.drafts > 0 && <> &middot; <span className="text-[#f59e0b]">{stats.drafts} draft</span></>}
              {stats.cancelled > 0 && <> &middot; {stats.cancelled} cancelled</>})
            </span>
            {stats.total > 0 && (
              <>
                <span className="text-border">|</span>
                <span>~<strong className="font-medium text-foreground">{stats.avgDaily}</strong>/day (peak: {stats.peakDayName} {stats.peakDay})</span>
                <span className="text-border">|</span>
                <span><strong className="font-medium text-foreground">{stats.acTypes}</strong> AC types</span>
                <span className="text-border">|</span>
                <span><strong className="font-medium text-foreground">{stats.sectors}</strong> sectors</span>
                {sortMode === 'rotation' && displayList.length > 0 && (
                  <>
                    <span className="text-border">|</span>
                    <span><strong className="font-medium text-foreground">{new Set(displayList.map(a => a.chainIndex)).size}</strong> rotations</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right: Status toggles + scenario filter */}
        <div className="flex items-center gap-2 flex-wrap pb-1">
          <StatusToggle label="Published" checked={showPublished} onChange={setShowPublished} dotColor="#111827" />
          <StatusToggle label="Drafts" checked={showDrafts} onChange={setShowDrafts} dotColor="#f59e0b" />
          <StatusToggle label="Cancelled" checked={showCancelled} onChange={setShowCancelled} dotColor="#9ca3af" />

          {sortMode !== 'rotation' && (
            <button
              type="button"
              onClick={() => setSortMode('rotation')}
              className="h-7 px-3 rounded-full glass text-xs font-medium flex items-center gap-1.5 select-none text-foreground shadow-sm ml-1"
            >
              <RotateCcw className="h-3 w-3" />
              Rotation View
            </button>
          )}

          {showDrafts && flightScenarios.length > 0 && (
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[11px] text-muted-foreground">Drafts from:</span>
              <select
                value={filterScenario}
                onChange={e => setFilterScenario(e.target.value)}
                className="h-7 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">All scenarios</option>
                {flightScenarios.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.number}{s.name ? ` — ${s.name}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Additional filters row (only if non-trivial filtering needed) */}
      {(filterAcType || filterDep || filterSvcType || aircraftTypes.length > 1) && (
        <div className="flex flex-wrap gap-3 py-2">
          <select value={filterAcType} onChange={e => setFilterAcType(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs">
            <option value="">All AC Types</option>
            {aircraftTypes.map(t => <option key={t.id} value={t.id}>{t.icao_type}</option>)}
          </select>

          <select value={filterDep} onChange={e => setFilterDep(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs">
            <option value="">All Departures</option>
            {departures.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          <select value={filterSvcType} onChange={e => setFilterSvcType(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs">
            <option value="">All Svc Types</option>
            {flightServiceTypes.map(s => <option key={s.code} value={s.code}>{s.code}</option>)}
          </select>
        </div>
      )}

      {/* Grid — vertical scroll with sticky headers */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading schedule...</div>
      ) : displayList.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {flights.length === 0
            ? 'No flights in this period. Build flights in the Schedule Builder.'
            : 'No flights match your filters.'}
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden mt-2">
          <div className="overflow-auto rounded-2xl" style={{ maxHeight: 'calc(100vh - 320px)' }}>
            <table className="w-full text-sm border-collapse border border-black/[0.08] dark:border-white/[0.08]" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '12%', minWidth: 70 }} />
                <col style={{ width: '7%', minWidth: 44 }} />
                <col style={{ width: '7%', minWidth: 44 }} />
                <col style={{ width: '25%', minWidth: 170 }} />
                <col style={{ width: '10%', minWidth: 54 }} />
                <col style={{ width: '10%', minWidth: 54 }} />
                <col style={{ width: '9%', minWidth: 48 }} />
                <col style={{ width: '10%', minWidth: 48 }} />
                <col style={{ width: '10%', minWidth: 40 }} />
              </colgroup>
              <thead className="sticky top-0 z-20">
                <tr className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-[#f8f9fa] dark:bg-white/[0.03]">
                  <th
                    className="py-1.5 text-left px-3 border border-black/[0.08] dark:border-white/[0.08] sticky left-0 bg-[#f8f9fa] dark:bg-white/[0.03] z-30 cursor-pointer select-none"
                    style={{ borderLeft: '3px solid transparent' }}
                    onClick={() => setSortMode(sortMode === 'flight_number' ? 'rotation' : 'flight_number')}
                  >
                    <span className="inline-flex items-center gap-1">Flt No {sortMode === 'flight_number' && <ArrowDown className="h-3 w-3" />}</span>
                  </th>
                  <th
                    className="py-1.5 text-center border border-black/[0.08] dark:border-white/[0.08] cursor-pointer select-none"
                    onClick={() => setSortMode(sortMode === 'dep' ? 'rotation' : 'dep')}
                  >
                    <span className="inline-flex items-center justify-center gap-1">Dep {sortMode === 'dep' && <ArrowDown className="h-3 w-3" />}</span>
                  </th>
                  <th
                    className="py-1.5 text-center border border-black/[0.08] dark:border-white/[0.08] cursor-pointer select-none"
                    onClick={() => setSortMode(sortMode === 'arr' ? 'rotation' : 'arr')}
                  >
                    <span className="inline-flex items-center justify-center gap-1">Arr {sortMode === 'arr' && <ArrowDown className="h-3 w-3" />}</span>
                  </th>
                  <th className="py-1.5 text-center border border-black/[0.08] dark:border-white/[0.08]">DOW</th>
                  <th
                    className="py-1.5 text-center border border-black/[0.08] dark:border-white/[0.08] cursor-pointer select-none"
                    onClick={() => setSortMode(sortMode === 'std' ? 'rotation' : 'std')}
                  >
                    <span className="inline-flex items-center justify-center gap-1">STD {sortMode === 'std' && <ArrowDown className="h-3 w-3" />}</span>
                  </th>
                  <th className="py-1.5 text-center border border-black/[0.08] dark:border-white/[0.08]">STA</th>
                  <th className="py-1.5 text-center border border-black/[0.08] dark:border-white/[0.08]">Blk</th>
                  <th
                    className="py-1.5 text-center border border-black/[0.08] dark:border-white/[0.08] cursor-pointer select-none"
                    onClick={() => setSortMode(sortMode === 'ac' ? 'rotation' : 'ac')}
                  >
                    <span className="inline-flex items-center justify-center gap-1">AC {sortMode === 'ac' && <ArrowDown className="h-3 w-3" />}</span>
                  </th>
                  <th
                    className="py-1.5 text-center border border-black/[0.08] dark:border-white/[0.08] cursor-pointer select-none"
                    onClick={() => setSortMode(sortMode === 'svc' ? 'rotation' : 'svc')}
                  >
                    <span className="inline-flex items-center justify-center gap-1">Svc {sortMode === 'svc' && <ArrowDown className="h-3 w-3" />}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-background">
                {displayList.map(({ flight: f, chainIndex, isFirstInChain }) => {
                  const svc = svcTypeMap.get(getDisplayValue(f, 'service_type') || f.service_type)
                  const acTypeId = getDisplayValue(f, 'aircraft_type_id') || f.aircraft_type_id
                  const acType = acTypeId ? acTypeMap.get(acTypeId) : null
                  const isDraft = f.status === 'draft'
                  const isCancelled = f.status === 'cancelled'
                  const hasConflict = conflictMap.has(f.id)
                  const conflictScenarios = hasConflict ? Array.from(conflictMap.get(f.id)!) : []
                  const rowHasChanges = flightHasChanges(f.id)
                  const isOddChain = chainIndex % 2 === 1
                  const isRotationMode = sortMode === 'rotation'

                  const displayStd = getDisplayValue(f, 'std') || f.std
                  const displaySta = getDisplayValue(f, 'sta') || f.sta
                  const displayDow = getDisplayValue(f, 'days_of_week') || f.days_of_week

                  return (
                    <tr
                      key={f.id}
                      onClick={e => handleRowClick(e, f)}
                      onContextMenu={e => handleContextMenu(e, f)}
                      className={cn(
                        'transition-colors cursor-pointer',
                        isDraft && 'italic text-muted-foreground',
                        isCancelled && 'text-muted-foreground/40 line-through',
                        !isDraft && !isCancelled && !selectedRows.has(f.id) && 'hover:bg-muted/30',
                        isDraft && !selectedRows.has(f.id) && 'hover:bg-[#f59e0b]/[0.04]',
                        rowHasChanges && !selectedRows.has(f.id) && 'bg-amber-50/50 dark:bg-amber-500/[0.04]',
                        isRotationMode && isOddChain && !selectedRows.has(f.id) && !rowHasChanges && 'bg-black/[0.015] dark:bg-white/[0.015]',
                        isRotationMode && isFirstInChain && chainIndex > 0 && 'border-t-2 border-t-black/[0.06] dark:border-t-white/[0.06]',
                      )}
                      style={{
                        borderLeftWidth: '3px',
                        borderLeftColor: hasConflict ? '#ef4444' : getLeftBorderColor(f),
                        borderLeftStyle: 'solid',
                        height: '36px',
                        ...(selectedRows.has(f.id) ? { outline: '2px solid hsl(var(--primary))', outlineOffset: '-2px', background: 'hsl(var(--primary) / 0.05)' } : {}),
                      }}
                    >
                      {/* FLT NO */}
                      <td className={cn(
                        'px-3 py-1 font-mono font-medium text-[13px] whitespace-nowrap sticky left-0 z-10 border border-black/[0.08] dark:border-white/[0.08]',
                        selectedRows.has(f.id) ? '' : isDraft ? 'bg-[#f59e0b]/[0.02]' : rowHasChanges ? 'bg-amber-50/50 dark:bg-amber-500/[0.04]' : isRotationMode && isOddChain ? 'bg-black/[0.015] dark:bg-white/[0.015]' : 'bg-background',
                      )} style={{ borderLeft: '3px solid ' + (hasConflict ? '#ef4444' : getLeftBorderColor(f)), ...(selectedRows.has(f.id) ? { background: '#fef2f2' } : {}) }}>
                        <div className="flex items-center gap-1.5">
                          {isRotationMode && (
                            isFirstInChain
                              ? <span className="text-[9px] font-mono font-medium text-muted-foreground/40 w-[22px] flex-shrink-0">R{chainIndex + 1}</span>
                              : <span className="w-[22px] flex-shrink-0" />
                          )}
                          {hasConflict && <ConflictTooltip scenarios={conflictScenarios} />}
                          {isDraft ? (
                            <DraftTooltip scenarioNumber={f.scenario_number} scenarioName={f.scenario_name}>
                              <span className="text-[#92700a]">{f.flight_number}</span>
                            </DraftTooltip>
                          ) : isCancelled ? (
                            <span className="text-muted-foreground/40">{f.flight_number}</span>
                          ) : (
                            <span>{f.flight_number}</span>
                          )}
                          {rowHasChanges && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" title="Unsaved changes" />
                          )}
                        </div>
                      </td>

                      {/* DEP */}
                      <td className="px-2 py-1 font-mono text-[12px] text-muted-foreground whitespace-nowrap text-center border border-black/[0.08] dark:border-white/[0.08]">
                        {f.departure_iata}
                      </td>

                      {/* ARR */}
                      <td className="px-2 py-1 font-mono text-[12px] text-muted-foreground whitespace-nowrap text-center border border-black/[0.08] dark:border-white/[0.08]">
                        {f.arrival_iata}
                      </td>

                      {/* DOW */}
                      <td
                        className="px-2 py-1 text-center whitespace-nowrap not-italic border border-black/[0.08] dark:border-white/[0.08]"
                        onDoubleClick={() => startEditing(f, 'days_of_week')}
                      >
                        {editingCell?.flightId === f.id && editingCell.field === 'days_of_week' ? (
                          <input
                            ref={editInputRef}
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={handleEditKeyDown}
                            className="w-[160px] h-6 px-1 text-center font-mono text-[12px] rounded border border-amber-400 bg-amber-50/50 dark:bg-amber-500/10 outline-none focus:ring-1 focus:ring-amber-400"
                            maxLength={7}
                          />
                        ) : (
                          <div className={cn('cursor-default inline-flex', hasChange(f.id, 'days_of_week') && 'ring-1 ring-amber-400 rounded-full')} title="Double-click to edit">
                            <DowCirclesDisplay value={displayDow} />
                          </div>
                        )}
                      </td>

                      {/* STD */}
                      <td
                        className={cn(
                          'px-2 py-1 text-center whitespace-nowrap border border-black/[0.08] dark:border-white/[0.08]',
                          hasChange(f.id, 'std') && 'text-amber-600 font-semibold',
                        )}
                        onDoubleClick={() => startEditing(f, 'std')}
                      >
                        {editingCell?.flightId === f.id && editingCell.field === 'std' ? (
                          <input
                            ref={editInputRef}
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={handleEditKeyDown}
                            className="w-[52px] h-6 px-1 text-center font-mono text-[12px] rounded border border-amber-400 bg-amber-50/50 dark:bg-amber-500/10 outline-none focus:ring-1 focus:ring-amber-400"
                            maxLength={4}
                            placeholder="HHMM"
                          />
                        ) : (
                          <span className="cursor-default" title="Double-click to edit">
                            <TimeDisplay value={displayStd} />
                          </span>
                        )}
                      </td>

                      {/* STA */}
                      <td
                        className={cn(
                          'px-2 py-1 text-center whitespace-nowrap border border-black/[0.08] dark:border-white/[0.08]',
                          hasChange(f.id, 'sta') && 'text-amber-600 font-semibold',
                        )}
                        onDoubleClick={() => startEditing(f, 'sta')}
                      >
                        {editingCell?.flightId === f.id && editingCell.field === 'sta' ? (
                          <input
                            ref={editInputRef}
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={handleEditKeyDown}
                            className="w-[52px] h-6 px-1 text-center font-mono text-[12px] rounded border border-amber-400 bg-amber-50/50 dark:bg-amber-500/10 outline-none focus:ring-1 focus:ring-amber-400"
                            maxLength={4}
                            placeholder="HHMM"
                          />
                        ) : (
                          <span className="cursor-default" title="Double-click to edit">
                            <TimeDisplay value={displaySta} />
                          </span>
                        )}
                      </td>

                      {/* BLK */}
                      <td className="px-2 py-1 text-center whitespace-nowrap border border-black/[0.08] dark:border-white/[0.08]">
                        <BlockDisplay std={displayStd} sta={displaySta} blockMinutes={f.block_minutes} />
                      </td>

                      {/* AC Type — editable */}
                      <td
                        className={cn(
                          'px-2 py-1 text-center font-mono text-[12px] whitespace-nowrap border border-black/[0.08] dark:border-white/[0.08]',
                          hasChange(f.id, 'aircraft_type_id') && 'text-amber-600 font-semibold',
                        )}
                        onDoubleClick={() => startEditing(f, 'aircraft_type_id')}
                      >
                        {editingCell?.flightId === f.id && editingCell.field === 'aircraft_type_id' ? (
                          <select
                            value={editValue}
                            onChange={e => { setEditValue(e.target.value); }}
                            onBlur={commitEdit}
                            className="h-6 px-1 text-[12px] rounded border border-amber-400 bg-amber-50/50 dark:bg-amber-500/10 outline-none"
                            autoFocus
                          >
                            <option value="">&mdash;</option>
                            {aircraftTypes.map(t => (
                              <option key={t.id} value={t.id}>{t.icao_type}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="cursor-default" title="Double-click to edit">
                            {acType?.icao_type || <span className="text-muted-foreground/30">&mdash;</span>}
                          </span>
                        )}
                      </td>

                      {/* SVC — editable */}
                      <td
                        className={cn(
                          'px-2 py-1 text-center whitespace-nowrap border border-black/[0.08] dark:border-white/[0.08]',
                          hasChange(f.id, 'service_type') && 'text-amber-600 font-semibold',
                        )}
                        onDoubleClick={() => startEditing(f, 'service_type')}
                      >
                        {editingCell?.flightId === f.id && editingCell.field === 'service_type' ? (
                          <select
                            value={editValue}
                            onChange={e => { setEditValue(e.target.value); }}
                            onBlur={commitEdit}
                            className="h-6 px-1 text-[12px] rounded border border-amber-400 bg-amber-50/50 dark:bg-amber-500/10 outline-none"
                            autoFocus
                          >
                            {flightServiceTypes.map(s => (
                              <option key={s.code} value={s.code}>{s.code}</option>
                            ))}
                          </select>
                        ) : svc ? (
                          <span className="flex items-center justify-center gap-1 text-[11px] cursor-default" title="Double-click to edit">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: svc.color || '#6B9DAD' }} />
                            {svc.code}
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground cursor-default">{f.service_type}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Floating save bar */}
      {pendingChanges.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="glass-heavy rounded-xl shadow-2xl px-5 py-3 flex items-center gap-4 border border-white/10">
            <span className="text-sm font-medium">
              <span className="text-amber-500">{pendingChanges.length}</span> unsaved change{pendingChanges.length !== 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={() => setShowReviewDialog(true)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
            >
              Review Changes
            </button>
            <button
              type="button"
              onClick={discardAllChanges}
              className="px-3 py-1.5 text-xs font-medium rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={saveAllChanges}
              disabled={saving}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-primary hover:bg-primary/80 text-primary-foreground transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <FlightContextMenu
          state={contextMenu}
          onClose={() => setContextMenu(null)}
          onAction={handleContextAction}
        />
      )}

      {/* Review Changes Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="glass-heavy sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Review Changes</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto py-2">
            {pendingChanges.map((c, i) => {
              const acOld = c.field === 'aircraft_type_id' && c.oldValue ? acTypeMap.get(c.oldValue)?.icao_type || c.oldValue : null
              const acNew = c.field === 'aircraft_type_id' && c.newValue ? acTypeMap.get(c.newValue)?.icao_type || c.newValue : null

              return (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5">
                  <span className="font-mono text-xs font-medium w-[70px] text-foreground">{c.flightNumber}</span>
                  <span className="text-[11px] text-muted-foreground w-[55px]">{c.fieldLabel}</span>
                  <span className="font-mono text-[11px] text-muted-foreground line-through">
                    {c.field === 'aircraft_type_id' ? acOld || '\u2014' :
                     (c.field === 'std' || c.field === 'sta') ? formatTime(c.oldValue) : c.oldValue || '\u2014'}
                  </span>
                  <span className="text-muted-foreground/50">&rarr;</span>
                  <span className="font-mono text-[11px] text-amber-600 font-medium">
                    {c.field === 'aircraft_type_id' ? acNew || '\u2014' :
                     (c.field === 'std' || c.field === 'sta') ? formatTime(c.newValue) : c.newValue || '\u2014'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingChanges(prev => prev.filter((_, idx) => idx !== i))}
                    className="ml-auto text-muted-foreground/50 hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setShowReviewDialog(false)}
              className="px-4 py-2 text-sm rounded-lg hover:bg-white/5 transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={saveAllChanges}
              disabled={saving || pendingChanges.length === 0}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary hover:bg-primary/80 text-primary-foreground transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : `Save ${pendingChanges.length} Change${pendingChanges.length !== 1 ? 's' : ''}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
