'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { ScheduleSeason, AircraftType, Airport, ScheduleScenario } from '@/types/database'
import {
  AircraftRoute, AircraftRouteLeg,
  getAircraftRoutes, getUnassignedFlightCount,
  checkDuplicateFlight, saveRoute, deleteRoute as deleteRouteAction,
  publishRoute as publishRouteAction, getRouteTemplates,
  type RouteTemplate, type SaveRouteInput,
} from '@/app/actions/aircraft-routes'
import { type ScheduleBlockLookup } from '@/app/actions/city-pairs'
import { getScenarios, createScenario, deleteScenario, getNextScenarioNumber } from '@/app/actions/scenarios'
import { cn, minutesToHHMM } from '@/lib/utils'
import {
  Plus, Search, RefreshCw, Plane, ChevronDown, ChevronRight,
  Trash2, Save, RotateCcw, AlertTriangle,
} from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { StatusGreen, StatusYellow, StatusRed, StatusGray } from '@/components/ui/validation-icons'
import { toast } from '@/components/ui/visionos-toast'
import { friendlyError } from '@/lib/utils/error-handler'
import { AIRPORT_COUNTRY } from '@/lib/data/airport-countries'

// ─── Props ────────────────────────────────────────────────────

interface Props {
  seasons: ScheduleSeason[]
  aircraftTypes: AircraftType[]
  airports: Airport[]
  initialRoutes: AircraftRoute[]
  initialUnassignedCount: number
  operatorIataCode: string
  initialTemplates: RouteTemplate[]
  blockLookup?: ScheduleBlockLookup[]
  scenarios?: (ScheduleScenario & { route_count: number })[]
}

// ─── Season code parser ──────────────────────────────────────

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

function parseSeasonCode(code: string): { start: string; end: string } | null {
  const match = code.toUpperCase().match(/^([WS])(\d{2})$/)
  if (!match) return null
  const type = match[1]
  const year = 2000 + parseInt(match[2])
  if (type === 'W') {
    const start = getLastSundayOfOctober(year)
    const end = getLastSaturdayOfMarch(year + 1)
    return { start: fmtDate(start), end: fmtDate(end) }
  }
  if (type === 'S') {
    const start = getLastSundayOfMarch(year)
    const end = getLastSaturdayOfOctober(year)
    return { start: fmtDate(start), end: fmtDate(end) }
  }
  return null
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDateDisplay(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function parseDateDisplay(display: string): string {
  const match = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return ''
  return `${match[3]}-${match[2]}-${match[1]}`
}

// ─── DOW Helpers ──────────────────────────────────────────────

const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function isDayActive(value: string, pos: number): boolean {
  return value.charAt(pos) === String(pos + 1)
}

function toggleDow(value: string, pos: number): string {
  const chars = value.padEnd(7, ' ').split('')
  const d = String(pos + 1)
  chars[pos] = isDayActive(value, pos) ? ' ' : d
  return chars.join('')
}


function DowCirclesInteractive({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-[3px]">
      {DOW_LABELS.map((label, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(toggleDow(value, i))}
          className={cn(
            'w-[22px] h-[22px] rounded-full text-[10px] font-semibold leading-none flex items-center justify-center transition-colors select-none',
            isDayActive(value, i)
              ? 'bg-[#991b1b] text-white hover:bg-[#7f1d1d]'
              : 'bg-transparent text-[#d1d5db] dark:text-[#4b5563] border-[1.5px] border-[#e5e7eb] dark:border-[#374151] hover:border-[#d1d5db] hover:text-[#9ca3af]'
          )}
        >{label}</button>
      ))}
    </div>
  )
}


// ─── Time / Input Helpers ─────────────────────────────────────

function timeToMinutes(time: string): number {
  if (!time) return 0
  if (time.includes(':')) {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
  }
  const d = time.replace(/\D/g, '')
  if (d.length >= 4) return parseInt(d.slice(0, 2)) * 60 + parseInt(d.slice(2, 4))
  return 0
}

function minutesToTimeStr(m: number): string {
  if (m < 0) m += 1440
  m = m % 1440
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function normalizeTime(input: string): string {
  const d = input.replace(/[^0-9]/g, '')
  if (d.length === 0) return ''
  if (d.length <= 2) return d.padStart(2, '0') + ':00'
  if (d.length === 3) return '0' + d.charAt(0) + ':' + d.slice(1, 3)
  return d.slice(0, 2) + ':' + d.slice(2, 4)
}

function isValidTime(t: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(t)) return false
  const [h, m] = t.split(':').map(Number)
  return h >= 0 && h <= 23 && m >= 0 && m <= 59
}

function computeBlockMinutes(std: string, sta: string): number {
  if (!std || !sta) return 0
  const stdMin = timeToMinutes(std)
  const staMin = timeToMinutes(sta)
  if (staMin >= stdMin) return staMin - stdMin
  return (1440 - stdMin) + staMin
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(a).getTime()
  const d2 = new Date(b).getTime()
  return Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24))
}

// ─── Day Offset ───────────────────────────────────────────────

interface LegWithOffsets extends AircraftRouteLeg {
  _dayOffset: number
  _arrivesNextDay: boolean
  _dayOffsetManual: boolean
}

function calculateDayOffsets(legs: LegWithOffsets[]): void {
  if (legs.length === 0) return
  if (!legs[0]._dayOffsetManual) {
    legs[0]._dayOffset = 0
  }
  legs[0]._arrivesNextDay = timeToMinutes(legs[0].sta_local) < timeToMinutes(legs[0].std_local)

  for (let i = 1; i < legs.length; i++) {
    const prev = legs[i - 1]
    const curr = legs[i]

    if (!curr._dayOffsetManual) {
      const prevStaMin = timeToMinutes(prev.sta_local)
      const currStdMin = timeToMinutes(curr.std_local)
      const arrivalDay = prev._dayOffset + (prev._arrivesNextDay ? 1 : 0)

      if (currStdMin <= prevStaMin && prev._arrivesNextDay) {
        curr._dayOffset = arrivalDay
      } else if (currStdMin < prevStaMin) {
        curr._dayOffset = arrivalDay + 1
      } else {
        curr._dayOffset = arrivalDay
      }
    }
    curr._arrivesNextDay = timeToMinutes(curr.sta_local) < timeToMinutes(curr.std_local)
  }
}

function computeRouteDuration(legs: LegWithOffsets[]): number {
  if (legs.length === 0) return 1
  const last = legs[legs.length - 1]
  return last._dayOffset + (last._arrivesNextDay ? 1 : 0) + 1
}

function durationLabel(days: number): string {
  return days <= 1 ? 'same day' : `${days} days`
}

// ─── TAT Helpers ──────────────────────────────────────────────

function computeTat(prevLeg: LegWithOffsets, nextLeg: LegWithOffsets): number {
  const prevStaAbs = (prevLeg._dayOffset + (prevLeg._arrivesNextDay ? 1 : 0)) * 1440 + timeToMinutes(prevLeg.sta_local)
  const nextStdAbs = nextLeg._dayOffset * 1440 + timeToMinutes(nextLeg.std_local)
  return nextStdAbs - prevStaAbs
}

type RouteType = 'dom_dom' | 'dom_int' | 'int_dom' | 'int_int'

function routeTypeLabel(rt: RouteType): string {
  return rt.replace('_', '\u2192').toUpperCase()
}

function getRouteType(depStation: string, arrStation: string, airportCountryMap: Map<string, string>, operatorCountry: string): RouteType {
  const depDom = (airportCountryMap.get(depStation) || '') === operatorCountry
  const arrDom = (airportCountryMap.get(arrStation) || '') === operatorCountry
  if (depDom && arrDom) return 'dom_dom'
  if (depDom) return 'dom_int'
  if (arrDom) return 'int_dom'
  return 'int_int'
}

function getMinTat(acType: AircraftType | undefined, routeType: RouteType): number {
  if (!acType) return 45
  switch (routeType) {
    case 'dom_dom': return acType.tat_dom_dom_minutes ?? acType.default_tat_minutes ?? 45
    case 'dom_int': return acType.tat_dom_int_minutes ?? acType.default_tat_minutes ?? 45
    case 'int_dom': return acType.tat_int_dom_minutes ?? acType.default_tat_minutes ?? 45
    case 'int_int': return acType.tat_int_int_minutes ?? acType.default_tat_minutes ?? 45
  }
}

// ─── Validation Types ─────────────────────────────────────────

interface LegCheckResult {
  status: 'pass' | 'warn' | 'error'
  message: string
}

interface LegValidation {
  sequence: LegCheckResult
  tat: LegCheckResult
  block: LegCheckResult
  overall: 'green' | 'yellow' | 'red'
}

const statusIcon = (s: 'pass' | 'warn' | 'error') =>
  s === 'pass' ? '\u2705' : s === 'warn' ? '\u26a0\ufe0f' : '\u274c'

// ─── Route grouping ───────────────────────────────────────────

interface AircraftGroup { icao: string; name: string; typeId: string | null; routes: AircraftRoute[] }

function groupRoutesByAircraftType(routes: AircraftRoute[], aircraftTypes: AircraftType[]): AircraftGroup[] {
  const groups = new Map<string, AircraftGroup>()
  for (const route of routes) {
    const key = route.aircraft_type_icao || 'UNASSIGNED'
    if (!groups.has(key)) {
      const acType = aircraftTypes.find(t => t.icao_type === key)
      groups.set(key, { icao: key, name: acType?.name || 'Unassigned', typeId: route.aircraft_type_id, routes: [] })
    }
    groups.get(key)!.routes.push(route)
  }
  return Array.from(groups.values()).sort((a, b) => {
    if (a.icao === 'UNASSIGNED') return 1
    if (b.icao === 'UNASSIGNED') return -1
    return a.icao.localeCompare(b.icao)
  })
}

// ─── Date formatting (DD/MM/YYYY text input) ─────────────────

function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  let out = ''
  if (digits.length > 0) out += digits.slice(0, 2)
  if (digits.length > 2) out += '/' + digits.slice(2, 4)
  if (digits.length > 4) out += '/' + digits.slice(4, 8)
  return out
}

/** Convert DD/MM/YYYY display → YYYY-MM-DD storage */
function displayToIso(display: string): string {
  const m = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return ''
  return `${m[3]}-${m[2]}-${m[1]}`
}

/** Convert YYYY-MM-DD storage → DD/MM/YYYY display */
function isoToDisplay(iso: string): string {
  if (!iso) return ''
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso
  return `${m[3]}/${m[2]}/${m[1]}`
}

// ─── Tab index calculator ─────────────────────────────────────

const TAB_ROUTE_NO = 1
const TAB_AC_TYPE = 2
const TAB_FROM = 3
const TAB_TO = 4
const TAB_LEG_BASE = 5
const FIELDS_PER_ROW = 8

function legTabIndex(rowIdx: number, fieldIdx: number): number {
  return TAB_LEG_BASE + (rowIdx * FIELDS_PER_ROW) + fieldIdx
}

/** Focus a grid cell by row/col. Works across LegRow, GridEntryRow, and FocusableEmptyRow. */
function focusGridCell(row: number, col: number) {
  if (row < 0 || col < 0 || col > 7) return
  const el = document.querySelector<HTMLElement>(`[data-grid-row="${row}"][data-grid-col="${col}"]`)
  if (!el) return
  if (el.tagName === 'INPUT') {
    ;(el as HTMLInputElement).focus()
    ;(el as HTMLInputElement).select()
  } else {
    el.click()
  }
}

// ─── AC Type matching (ranked) ─────────────────────────────────

function rankAcTypeMatch(icao: string, name: string, query: string): number {
  const q = query.toUpperCase()
  const ic = icao.toUpperCase()
  const nm = name.toUpperCase()
  if (ic === q) return 0                  // exact ICAO
  if (ic.startsWith(q)) return 1          // ICAO starts with
  if (ic.endsWith(q)) return 2            // ICAO ends with (e.g. "321" → "A321")
  if (ic.includes(q)) return 3            // ICAO contains
  if (nm.includes(q)) return 4            // name contains
  return -1                               // no match
}

function findBestAcType(types: AircraftType[], query: string): AircraftType | undefined {
  if (!query) return undefined
  let best: AircraftType | undefined
  let bestRank = 99
  for (const t of types) {
    if (!t.is_active) continue
    const r = rankAcTypeMatch(t.icao_type, t.name, query)
    if (r >= 0 && r < bestRank) { best = t; bestRank = r }
    if (bestRank === 0) break // exact match, stop early
  }
  return best
}

function filterAndSortAcTypes(types: AircraftType[], query: string): AircraftType[] {
  const q = query.toUpperCase()
  return types
    .filter(t => t.is_active)
    .map(t => ({ type: t, rank: rankAcTypeMatch(t.icao_type, t.name, q) }))
    .filter(x => x.rank >= 0)
    .sort((a, b) => a.rank - b.rank)
    .map(x => x.type)
}

// ─── Form types ───────────────────────────────────────────────

interface RouteFormState {
  routeName: string
  aircraftTypeId: string
  aircraftTypeIcao: string
  seasonId: string
  periodStart: string
  periodEnd: string
  daysOfOperation: string
  status: string
  notes: string
}

interface NewLegDraft {
  flightNumber: string
  depStation: string
  arrStation: string
  stdLocal: string
  staLocal: string
  serviceType: string
  _autoFilledDep: boolean
  _autoFilledStd: boolean
  _autoFilledSta: boolean
  _errors: Record<string, boolean>
  _duplicateError: string | null
  _checking: boolean
}

function emptyDraft(): NewLegDraft {
  return { flightNumber: '', depStation: '', arrStation: '', stdLocal: '', staLocal: '', serviceType: 'J', _autoFilledDep: false, _autoFilledStd: false, _autoFilledSta: false, _errors: {}, _duplicateError: null, _checking: false }
}

function makeLegId(): string {
  return `leg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export function AircraftRoutesBuilder({
  seasons, aircraftTypes, airports, initialRoutes, initialUnassignedCount, operatorIataCode, initialTemplates, blockLookup, scenarios: initialScenarios,
}: Props) {
  const [selectedSeason, setSelectedSeason] = useState(seasons[0]?.id || '')
  const [routes, setRoutes] = useState<AircraftRoute[]>(initialRoutes)

  // ── Scenario state ──
  const [scenarios, setScenarios] = useState(initialScenarios || [])
  const [selectedScenario, setSelectedScenario] = useState<(ScheduleScenario & { route_count: number }) | null>(null)
  const [showCreateScenario, setShowCreateScenario] = useState(false)
  const [showScenarioList, setShowScenarioList] = useState(false)
  const [scenarioLoading, setScenariosLoading] = useState(false)
  const [nextScenarioNum, setNextScenarioNum] = useState('')
  const [newScenario, setNewScenario] = useState({ name: '', from: '', to: '', season: '', description: '', isPrivate: false })
  const [unassignedCount, setUnassignedCount] = useState(initialUnassignedCount)
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [acTypeFilter, setAcTypeFilter] = useState<Set<string>>(new Set())
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null!)

  // ── Route detail state ──
  const [form, setForm] = useState<RouteFormState | null>(null)
  const [legs, setLegs] = useState<LegWithOffsets[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const [isNewRoute, setIsNewRoute] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [draft, setDraft] = useState<NewLegDraft>(emptyDraft())
  const [editingCell, setEditingCell] = useState<{ legId: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [selectedCell, setSelectedCell] = useState<{row: number, col: number} | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dropIndicator, setDropIndicator] = useState<{ index: number; position: 'above' | 'below' } | null>(null)
  const [activeEmptyRow, setActiveEmptyRow] = useState<number | null>(null)
  const [focusField, setFocusField] = useState<string | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [highlightedCol, setHighlightedCol] = useState<number | null>(null)

  // ── Undo/Redo history ──
  const [legsHistory, setLegsHistory] = useState<LegWithOffsets[][]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  // ── AC Type combo state ──
  const [acTypeSearch, setAcTypeSearch] = useState('')
  const [acTypeOpen, setAcTypeOpen] = useState(false)
  const acTypeInputRef = useRef<HTMLInputElement>(null!)
  const acTypeDropRef = useRef<HTMLDivElement>(null!)

  // ── Date display state (DD/MM/YYYY text) ──
  const [fromDisplay, setFromDisplay] = useState('')
  const [toDisplay, setToDisplay] = useState('')

  // ── Dialogs ──
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [showWarningDialog, setShowWarningDialog] = useState(false)
  const [saveWarnings, setSaveWarnings] = useState<string[]>([])
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [showPublishDialog, setShowPublishDialog] = useState(false)

  // ── Save / action state ──
  const [saving, setSaving] = useState(false)
  const [templates, setTemplates] = useState<RouteTemplate[]>(initialTemplates)

  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({})

  const snapshotRef = useRef<{ form: RouteFormState; legs: LegWithOffsets[] } | null>(null)
  const isNewRouteRef = useRef(false)
  isNewRouteRef.current = isNewRoute
  const pendingActionRef = useRef<(() => void) | null>(null)
  const hasManualRouteNameRef = useRef(false)

  // ── Browser navigation guard ──
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  // ── Keyboard shortcuts ref (to avoid stale closures) ──
  const shortcutRefs = useRef<{
    save: () => void; undo: () => void; redo: () => void
    newRoute: () => void; duplicate: () => void; cancel: () => void
    deleteSelectedLeg: () => void; addRow: () => void
    expandRowSelection: (direction: 'up' | 'down') => void; selectAll: () => void
    selectRow: () => void; selectCol: () => void
  }>({ save: () => {}, undo: () => {}, redo: () => {}, newRoute: () => {}, duplicate: () => {}, cancel: () => {}, deleteSelectedLeg: () => {}, addRow: () => {}, expandRowSelection: () => {}, selectAll: () => {}, selectRow: () => {}, selectCol: () => {} })

  // ── Lookup maps ──
  const acTypeMap = useMemo(() => {
    const m = new Map<string, AircraftType>()
    aircraftTypes.forEach(t => m.set(t.id, t))
    return m
  }, [aircraftTypes])

  const airportIataSet = useMemo(() => {
    const s = new Set<string>()
    airports.forEach(a => { if (a.iata_code) s.add(a.iata_code) })
    return s
  }, [airports])

  const airportCountryMap = useMemo(() => {
    const m = new Map<string, string>()
    // Primary: hardcoded IATA → ISO country lookup (reliable)
    for (const [iata, cc] of Object.entries(AIRPORT_COUNTRY)) m.set(iata, cc)
    // Fallback: DB country field for airports not in the hardcoded map
    airports.forEach(a => { if (a.iata_code && a.country && !m.has(a.iata_code)) m.set(a.iata_code, a.country) })
    return m
  }, [airports])

  const blockTimeMap = useMemo(() => {
    const m = new Map<string, number>()
    if (blockLookup) {
      for (const bl of blockLookup) {
        const key = `${bl.dep_iata}-${bl.arr_iata}`
        if (!m.has(key)) m.set(key, bl.block_minutes)
      }
    }
    return m
  }, [blockLookup])

  const operatorCountry = useMemo(() => {
    const countryCount = new Map<string, number>()
    for (const r of routes) {
      for (const leg of r.legs) {
        const c = airportCountryMap.get(leg.dep_station)
        if (c) countryCount.set(c, (countryCount.get(c) || 0) + 1)
      }
    }
    let best = ''; let bestCount = 0
    countryCount.forEach((count, country) => { if (count > bestCount) { best = country; bestCount = count } })
    return best || 'VN'
  }, [routes, airportCountryMap])

  // ── Recalc helper ──
  const recalcLegs = useCallback((newLegs: LegWithOffsets[]): LegWithOffsets[] => {
    const copy = newLegs.map((l, i) => ({ ...l, leg_sequence: i + 1 }))
    calculateDayOffsets(copy)
    return copy
  }, [])

  // ── Undo/Redo helpers (use refs to avoid stale closures) ──
  const historyRef = useRef({ history: legsHistory, index: historyIndex })
  historyRef.current = { history: legsHistory, index: historyIndex }

  const pushHistory = useCallback((newLegs: LegWithOffsets[]) => {
    const { history, index } = historyRef.current
    const trimmed = history.slice(0, index + 1)
    const next = [...trimmed, newLegs.map(l => ({ ...l }))]
    setLegsHistory(next)
    setHistoryIndex(next.length - 1)
  }, [])

  const handleUndo = useCallback(() => {
    const { history, index } = historyRef.current
    if (index <= 0) return
    const prevIdx = index - 1
    setHistoryIndex(prevIdx)
    setLegs(history[prevIdx].map(l => ({ ...l })))
    setIsDirty(true)
  }, [])

  const handleRedo = useCallback(() => {
    const { history, index } = historyRef.current
    if (index >= history.length - 1) return
    const nextIdx = index + 1
    setHistoryIndex(nextIdx)
    setLegs(history[nextIdx].map(l => ({ ...l })))
    setIsDirty(true)
  }, [])

  // ── Load route ──
  const loadRoute = useCallback((routeId: string | null) => {
    // Don't clear form when we're on a new (unsaved) route
    if (!routeId && isNewRouteRef.current) return

    const route = routes.find(r => r.id === routeId)
    if (!route) {
      setForm(null); setLegs([]); setIsDirty(false); setIsAdding(false); setEditingCell(null); setSelectedCell(null); setSelectedRows(new Set()); setFormErrors({})
      snapshotRef.current = null
      return
    }
    const f: RouteFormState = {
      routeName: route.route_name || '',
      aircraftTypeId: route.aircraft_type_id || '',
      aircraftTypeIcao: route.aircraft_type_icao || '',
      seasonId: route.season_id || selectedSeason,
      periodStart: route.period_start || '',
      periodEnd: route.period_end || '',
      daysOfOperation: route.days_of_operation || '1234567',
      status: route.status || 'draft',
      notes: route.notes || '',
    }
    const legsWithOffsets: LegWithOffsets[] = route.legs.map(l => ({
      ...l, _dayOffset: l.day_offset || 0, _arrivesNextDay: l.arrives_next_day || false, _dayOffsetManual: false,
    }))
    calculateDayOffsets(legsWithOffsets)
    setForm(f); setLegs(legsWithOffsets); setIsDirty(false); setIsAdding(false); setEditingCell(null); setSelectedCell(null); setSelectedRows(new Set()); setFormErrors({})
    hasManualRouteNameRef.current = true
    snapshotRef.current = { form: { ...f }, legs: legsWithOffsets.map(l => ({ ...l })) }
    // Sync AC type search display
    const at = aircraftTypes.find(t => t.id === f.aircraftTypeId)
    setAcTypeSearch(at ? at.icao_type : '')
    // Sync date display
    setFromDisplay(isoToDisplay(f.periodStart))
    setToDisplay(isoToDisplay(f.periodEnd))
    // Initialize undo history
    setLegsHistory([legsWithOffsets.map(l => ({ ...l }))])
    setHistoryIndex(0)
  }, [routes, selectedSeason, aircraftTypes])

  useEffect(() => { loadRoute(selectedRouteId) }, [selectedRouteId, routes, loadRoute])

  // ── Auto-fill route name from first flight number ──
  useEffect(() => {
    if (hasManualRouteNameRef.current) return
    if (!form || !isAdding || legs.length > 0) return
    const newName = draft.flightNumber || ''
    if (form.routeName !== newName) {
      setForm(prev => prev ? { ...prev, routeName: newName } : null)
    }
  }, [draft.flightNumber, isAdding, legs.length, form])

  // ── Computed values ──
  const chain = useMemo(() => {
    if (legs.length === 0) return ''
    return legs.map(l => l.dep_station).concat(legs[legs.length - 1].arr_station).join('-')
  }, [legs])

  const isRoundTrip = useMemo(() => legs.length >= 2 && legs[0].dep_station === legs[legs.length - 1].arr_station, [legs])
  const totalBlock = useMemo(() => legs.reduce((sum, l) => sum + (l.block_minutes || 0), 0), [legs])
  const routeDuration = useMemo(() => computeRouteDuration(legs), [legs])

  // ═══════════════════════════════════════════════════════════════
  // PER-LEG VALIDATION
  // ═══════════════════════════════════════════════════════════════

  const legValidations = useMemo((): LegValidation[] => {
    const acType = form?.aircraftTypeId ? acTypeMap.get(form.aircraftTypeId) : undefined

    return legs.map((leg, idx) => {
      const v: LegValidation = {
        sequence: { status: 'pass', message: 'First leg' },
        tat: { status: 'pass', message: 'First leg' },
        block: { status: 'pass', message: `Block: ${minutesToHHMM(leg.block_minutes || 0)}` },
        overall: 'green',
      }

      if (idx > 0) {
        const prev = legs[idx - 1]

        // Sequence
        if (leg.dep_station === prev.arr_station) {
          v.sequence = { status: 'pass', message: `OK (${prev.arr_station} \u2192 ${leg.dep_station})` }
        } else {
          v.sequence = { status: 'warn', message: `Gap: arrives ${prev.arr_station}, departs ${leg.dep_station}` }
        }

        // TAT
        const tatMin = computeTat(prev, leg)
        if (tatMin < 0) {
          v.tat = { status: 'error', message: 'Departs before previous arrival' }
        } else {
          const rType = getRouteType(prev.arr_station, leg.dep_station, airportCountryMap, operatorCountry)
          const minTat = getMinTat(acType, rType)
          if (tatMin < minTat) {
            v.tat = { status: 'warn', message: `TAT: ${minutesToHHMM(tatMin)} (min ${minutesToHHMM(minTat)} ${routeTypeLabel(rType)})` }
          } else {
            v.tat = { status: 'pass', message: `TAT: ${minutesToHHMM(tatMin)} (min ${minutesToHHMM(minTat)})` }
          }
        }
      }

      // Block time
      if ((leg.block_minutes || 0) <= 0) {
        v.block = { status: 'error', message: 'Invalid block time' }
      }

      // Overall
      const statuses = [v.sequence.status, v.tat.status, v.block.status]
      if (statuses.includes('error')) v.overall = 'red'
      else if (statuses.includes('warn')) v.overall = 'yellow'

      return v
    })
  }, [legs, form?.aircraftTypeId, acTypeMap, airportCountryMap, operatorCountry])

  // ── Draft (entry row) validation ──
  const draftValidation = useMemo((): LegValidation | null => {
    if (!isAdding) return null

    const dep = draft.depStation.toUpperCase()
    const arr = draft.arrStation.toUpperCase()
    const stdNorm = normalizeTime(draft.stdLocal)
    const staNorm = normalizeTime(draft.staLocal)
    const hasFlt = draft.flightNumber.length > 0
    const hasDep = dep.length === 3
    const hasArr = arr.length === 3
    const hasStd = stdNorm !== '' && isValidTime(stdNorm)
    const hasSta = staNorm !== '' && isValidTime(staNorm)

    // Show duplicate error even if incomplete
    if (draft._duplicateError) {
      return {
        sequence: { status: 'pass', message: 'Pending' },
        tat: { status: 'pass', message: 'Pending' },
        block: { status: 'pass', message: 'Pending' },
        overall: 'red',
      }
    }

    // Only validate when ALL required fields are filled
    if (!hasFlt || !hasDep || !hasArr || !hasStd || !hasSta) return null

    const v: LegValidation = {
      sequence: { status: 'pass', message: legs.length === 0 ? 'First leg' : 'Pending' },
      tat: { status: 'pass', message: legs.length === 0 ? 'First leg' : 'Pending' },
      block: { status: 'pass', message: 'Pending' },
      overall: 'green',
    }

    if (legs.length > 0) {
      const prev = legs[legs.length - 1]

      // Sequence
      if (hasDep) {
        if (dep === prev.arr_station) {
          v.sequence = { status: 'pass', message: `OK (${prev.arr_station} \u2192 ${dep})` }
        } else {
          v.sequence = { status: 'warn', message: `Gap: arrives ${prev.arr_station}, departs ${dep}` }
        }
      }

      // TAT
      if (hasStd) {
        const tempLeg: LegWithOffsets = {
          id: 'draft', route_id: '', leg_sequence: legs.length + 1,
          flight_id: null, airline_code: null, flight_number: null,
          dep_station: dep || prev.arr_station, arr_station: 'XXX',
          std_local: stdNorm, sta_local: hasSta ? staNorm : stdNorm,
          dep_utc_offset: null, arr_utc_offset: null,
          block_minutes: 0, day_offset: 0, arrives_next_day: false,
          service_type: 'J', _dayOffset: 0, _arrivesNextDay: false, _dayOffsetManual: false,
        }
        const tempLegs = [...legs.map(l => ({ ...l })), tempLeg]
        calculateDayOffsets(tempLegs)

        const tatMin = computeTat(prev, tempLegs[tempLegs.length - 1])
        if (tatMin < 0) {
          v.tat = { status: 'error', message: 'Departs before previous arrival' }
        } else {
          const acType = form?.aircraftTypeId ? acTypeMap.get(form.aircraftTypeId) : undefined
          const rType = getRouteType(prev.arr_station, dep || prev.arr_station, airportCountryMap, operatorCountry)
          const minTat = getMinTat(acType, rType)
          if (tatMin < minTat) {
            v.tat = { status: 'warn', message: `TAT: ${minutesToHHMM(tatMin)} (min ${minutesToHHMM(minTat)} ${routeTypeLabel(rType)})` }
          } else {
            v.tat = { status: 'pass', message: `TAT: ${minutesToHHMM(tatMin)} (min ${minutesToHHMM(minTat)})` }
          }
        }
      }
    }

    // Block time
    if (hasStd && hasSta) {
      const block = computeBlockMinutes(stdNorm, staNorm)
      if (block <= 0) {
        v.block = { status: 'error', message: 'Invalid block time' }
      } else {
        v.block = { status: 'pass', message: `Block: ${minutesToHHMM(block)}` }
      }
    }

    // Duplicate error from draft
    if (draft._duplicateError) {
      v.overall = 'red'
      return v
    }

    // Overall
    const statuses = [v.sequence.status, v.tat.status, v.block.status]
    if (statuses.includes('error')) v.overall = 'red'
    else if (statuses.includes('warn')) v.overall = 'yellow'

    return v
  }, [isAdding, draft, legs, form?.aircraftTypeId, acTypeMap, airportCountryMap, operatorCountry])

  const hasRedErrors = useMemo(() => legValidations.some(v => v.overall === 'red'), [legValidations])

  // ── Refresh helpers ──
  const refresh = useCallback(async () => {
    if (!selectedScenario) return; setLoading(true)
    try {
      const [r, c] = await Promise.all([getAircraftRoutes(selectedScenario.id), getUnassignedFlightCount(selectedSeason)])
      setRoutes(r); setUnassignedCount(c)
    } catch { toast.error('Failed to refresh') }
    finally { setLoading(false) }
  }, [selectedScenario, selectedSeason])

  const refreshTemplates = useCallback(async () => {
    try { setTemplates(await getRouteTemplates()) } catch { /* silent */ }
  }, [])

  const refreshScenarios = useCallback(async () => {
    try { setScenarios(await getScenarios()) } catch { /* silent */ }
  }, [])

  // ── Scenario selection ──
  const selectScenario = useCallback(async (scenario: (ScheduleScenario & { route_count: number }) | null) => {
    setSelectedScenario(scenario)
    setSelectedRouteId(null)
    setForm(null)
    setLegs([])
    setIsDirty(false)
    if (scenario) {
      localStorage.setItem('horizon_scenario', scenario.id)
      setLoading(true)
      try {
        const r = await getAircraftRoutes(scenario.id)
        setRoutes(r)
      } catch { toast.error('Failed to load routes') }
      finally { setLoading(false) }
    } else {
      setRoutes([])
    }
  }, [])

  // ── Auto-restore last scenario from localStorage ──
  useEffect(() => {
    const lastId = localStorage.getItem('horizon_scenario')
    if (lastId && scenarios.length > 0) {
      const found = scenarios.find(s => s.id === lastId)
      if (found) selectScenario(found)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Create scenario handler ──
  const handleCreateScenario = useCallback(async () => {
    if (!newScenario.name.trim()) { toast.error('Scenario name is required'); return }
    const periodStart = parseDateDisplay(newScenario.from)
    const periodEnd = parseDateDisplay(newScenario.to)
    if (!periodStart || !periodEnd) { toast.error('Valid period dates required (DD/MM/YYYY)'); return }

    setScenariosLoading(true)
    const result = await createScenario({
      scenario_name: newScenario.name.trim(),
      period_start: periodStart,
      period_end: periodEnd,
      season_code: newScenario.season || undefined,
      description: newScenario.description || undefined,
      is_private: newScenario.isPrivate,
    })

    if (result.error) {
      toast.error(friendlyError(result.error))
      setScenariosLoading(false)
      return
    }

    toast.success(`Scenario ${result.scenario!.scenario_number} created`)
    const refreshed = await getScenarios()
    setScenarios(refreshed)
    const created = refreshed.find(s => s.id === result.scenario!.id) || { ...result.scenario!, route_count: 0 }
    selectScenario(created)
    setShowCreateScenario(false)
    setNewScenario({ name: '', from: '', to: '', season: '', description: '', isPrivate: false })
    setScenariosLoading(false)
  }, [newScenario, selectScenario])

  const handleDeleteScenario = useCallback(async (id: string) => {
    const res = await deleteScenario(id)
    if (res.error) { toast.error(res.error); return }
    toast.success('Scenario deleted')
    const refreshed = await getScenarios()
    setScenarios(refreshed)
    if (selectedScenario?.id === id) selectScenario(null)
  }, [selectedScenario, selectScenario])

  const openCreateScenarioDialog = useCallback(async () => {
    try { setNextScenarioNum(await getNextScenarioNumber()) } catch { setNextScenarioNum('XX-0001') }
    setNewScenario({ name: '', from: '', to: '', season: '', description: '', isPrivate: false })
    setShowCreateScenario(true)
  }, [])

  // ── Season / new route ──
  const handleSeasonChange = useCallback(async (seasonId: string) => {
    setSelectedSeason(seasonId); setSelectedRouteId(null)
  }, [])

  // ── Init new route (purely local, no DB) ──
  const initNewRoute = useCallback((template?: RouteTemplate) => {
    const defaultAcType = template?.aircraft_type_id
      ? aircraftTypes.find(t => t.id === template.aircraft_type_id)
      : aircraftTypes.find(t => t.is_active)

    setSelectedRouteId(null)
    setIsNewRoute(true)
    isNewRouteRef.current = true
    setForm({
      routeName: template?.legs[0]?.flight_number ? String(template.legs[0].flight_number) : '',
      aircraftTypeId: defaultAcType?.id || '',
      aircraftTypeIcao: defaultAcType?.icao_type || '',
      seasonId: selectedSeason,
      periodStart: '',
      periodEnd: '',
      daysOfOperation: template?.days_of_operation || '1234567',
      status: 'new',
      notes: '',
    })
    setAcTypeSearch(defaultAcType?.icao_type || '')
    setFromDisplay('')
    setToDisplay('')

    let initialLegs: LegWithOffsets[] = []
    if (template) {
      initialLegs = template.legs.map((tl, i) => ({
        id: crypto.randomUUID(),
        route_id: '',
        leg_sequence: i + 1,
        flight_id: null,
        airline_code: tl.airline_code,
        flight_number: tl.flight_number,
        dep_station: tl.dep_station,
        arr_station: tl.arr_station,
        std_local: tl.std_local,
        sta_local: tl.sta_local,
        dep_utc_offset: null,
        arr_utc_offset: null,
        block_minutes: tl.block_minutes,
        day_offset: 0,
        arrives_next_day: false,
        service_type: tl.service_type,
        _dayOffset: 0,
        _arrivesNextDay: false,
        _dayOffsetManual: false,
      }))
      calculateDayOffsets(initialLegs)
    }

    setLegs(initialLegs)
    setIsDirty(!!template)
    setEditingCell(null)
    setSelectedCell(null)
    setSelectedRows(new Set())
    setDraft(emptyDraft())
    hasManualRouteNameRef.current = false
    setLegsHistory([initialLegs.map(l => ({ ...l }))])
    setHistoryIndex(0)
    snapshotRef.current = null

    if (template) {
      // Template: legs pre-filled, focus first leg's flight number
      setIsAdding(false)
      setActiveEmptyRow(null)
      setFocusField(null)
      setTimeout(() => {
        const el = document.querySelector<HTMLElement>('[data-grid-row="0"][data-grid-col="1"]')
        if (el) el.click()
      }, 100)
    } else {
      // New route: activate first empty row with flight number focus
      setIsAdding(true)
      setActiveEmptyRow(0)
      setFocusField('flightNumber')
    }
  }, [aircraftTypes, selectedSeason])

  const handleNewRoute = useCallback(() => {
    if (!selectedScenario) { toast.error('Select a scenario first'); return }
    if (isDirty) {
      pendingActionRef.current = () => initNewRoute()
      setShowUnsavedDialog(true)
      return
    }
    initNewRoute()
  }, [selectedScenario, isDirty, initNewRoute])

  const handleUseTemplate = useCallback((template: RouteTemplate) => {
    if (!selectedScenario) { toast.error('Select a scenario first'); return }
    if (isDirty) {
      pendingActionRef.current = () => initNewRoute(template)
      setShowUnsavedDialog(true)
      return
    }
    initNewRoute(template)
  }, [selectedScenario, isDirty, initNewRoute])

  // ── Auto-init empty route when scenario is selected ──
  useEffect(() => {
    if (!form && !selectedRouteId && selectedScenario) {
      initNewRoute()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, selectedRouteId, selectedSeason])

  // ── Route selection (with dirty guard) ──
  const handleSelectRoute = useCallback((routeId: string) => {
    if (routeId === selectedRouteId && !isNewRoute) return
    if (isDirty) {
      pendingActionRef.current = () => { setIsNewRoute(false); isNewRouteRef.current = false; setSelectedRouteId(routeId) }
      setShowUnsavedDialog(true)
    } else {
      setIsNewRoute(false)
      isNewRouteRef.current = false
      setSelectedRouteId(routeId)
    }
  }, [selectedRouteId, isDirty, isNewRoute])

  const handleDiscardAndSwitch = useCallback(() => {
    setShowUnsavedDialog(false)
    setIsDirty(false)
    setIsNewRoute(false)
    isNewRouteRef.current = false
    if (pendingActionRef.current) {
      pendingActionRef.current()
      pendingActionRef.current = null
    }
  }, [])

  // ── Group & filter ──
  const usedAcTypes = useMemo(() => {
    const types = new Map<string, string>()
    for (const r of routes) {
      if (r.aircraft_type_icao) {
        const at = aircraftTypes.find(t => t.icao_type === r.aircraft_type_icao)
        types.set(r.aircraft_type_icao, at?.name || r.aircraft_type_icao)
      }
    }
    return Array.from(types.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [routes, aircraftTypes])

  const toggleAcTypeFilter = useCallback((icao: string) => {
    setAcTypeFilter(prev => {
      const allIcaos = usedAcTypes.map(([ic]) => ic)
      if (prev.size === 0) {
        // All shown → uncheck this one = select all others
        const next = new Set(allIcaos.filter(ic => ic !== icao))
        return next.size === 0 || next.size === allIcaos.length ? new Set() : next
      }
      const next = new Set(prev)
      if (next.has(icao)) next.delete(icao); else next.add(icao)
      if (next.size === 0 || next.size === allIcaos.length) return new Set()
      return next
    })
  }, [usedAcTypes])

  const acFilterLabel = useMemo(() => {
    if (acTypeFilter.size === 0) return 'All'
    return Array.from(acTypeFilter).sort().join(', ')
  }, [acTypeFilter])

  // Close filter dropdown on outside click
  useEffect(() => {
    if (!filterOpen) return
    const handleClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [filterOpen])

  const filteredRoutes = useMemo(() => {
    let result = routes
    if (acTypeFilter.size > 0) {
      result = result.filter(r => r.aircraft_type_icao && acTypeFilter.has(r.aircraft_type_icao))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(r =>
        (r.route_name || '').toLowerCase().includes(q) ||
        r.chain.toLowerCase().includes(q) ||
        (r.aircraft_type_icao || '').toLowerCase().includes(q)
      )
    }
    return result
  }, [routes, search, acTypeFilter])

  const groups = useMemo(() => groupRoutesByAircraftType(filteredRoutes, aircraftTypes), [filteredRoutes, aircraftTypes])

  const toggleGroup = useCallback((icao: string) => {
    setCollapsedGroups(prev => { const n = new Set(prev); n.has(icao) ? n.delete(icao) : n.add(icao); return n })
  }, [])

  const selectedRoute = routes.find(r => r.id === selectedRouteId)

  // ── Form update ──
  const updateForm = useCallback((patch: Partial<RouteFormState>) => {
    setForm(prev => prev ? { ...prev, ...patch } : null)
    setIsDirty(true)
    // Clear formErrors for filled-in fields
    setFormErrors(prev => {
      const next = { ...prev }
      if (patch.aircraftTypeId) delete next.aircraftType
      if (patch.periodStart) delete next.periodStart
      if (patch.periodEnd) delete next.periodEnd
      if (patch.daysOfOperation) delete next.daysOfOperation
      return Object.keys(next).length === Object.keys(prev).length ? prev : next
    })
  }, [])

  // ── Duplicate leg ──
  const duplicateLeg = useCallback(() => {
    if (legs.length === 0) return
    // Duplicate the last leg
    const last = legs[legs.length - 1]
    const dup: LegWithOffsets = { ...last, id: makeLegId(), flight_id: null }
    setLegs(prev => {
      const newLegs = recalcLegs([...prev, dup])
      pushHistory(newLegs)
      return newLegs
    })
    setIsDirty(true)
  }, [legs, recalcLegs, pushHistory])

  // ── Delete leg ──
  const deleteLeg = useCallback((legId: string) => {
    setLegs(prev => {
      const newLegs = recalcLegs(prev.filter(l => l.id !== legId))
      pushHistory(newLegs)
      return newLegs
    })
    setIsDirty(true)
  }, [recalcLegs, pushHistory])

  // ── Confirm add leg ──
  const confirmAddLeg = useCallback(async () => {
    const errs: Record<string, boolean> = {}
    if (!draft.flightNumber) errs.flightNumber = true
    if (!draft.depStation || draft.depStation.length < 3) errs.depStation = true
    if (!draft.arrStation || draft.arrStation.length < 3) errs.arrStation = true
    if (!draft.stdLocal) errs.stdLocal = true
    if (!draft.staLocal) errs.staLocal = true

    if (Object.keys(errs).length) {
      setDraft(d => ({ ...d, _errors: errs, _duplicateError: null }))
      return
    }

    // Block on red validation errors (block time, negative TAT)
    if (draftValidation && draftValidation.overall === 'red' && !draft._duplicateError) {
      const errorMsgs = [
        draftValidation.tat.status === 'error' ? draftValidation.tat.message : null,
        draftValidation.block.status === 'error' ? draftValidation.block.message : null,
      ].filter(Boolean)
      toast.error(errorMsgs[0] || 'Resolve validation errors first')
      return
    }

    const flightNum = parseInt(draft.flightNumber)
    const dep = draft.depStation.toUpperCase()
    const arr = draft.arrStation.toUpperCase()
    const fltLabel = `${operatorIataCode}${flightNum}`

    // Local duplicate check
    const localDup = legs.find(l =>
      l.flight_number === flightNum && l.dep_station === dep && l.arr_station === arr
    )
    if (localDup) {
      setDraft(d => ({
        ...d,
        _errors: { flightNumber: true },
        _duplicateError: `\u274c ${fltLabel} ${dep}\u2192${arr} is already a leg in this route`,
      }))
      return
    }

    // DB duplicate check
    if (form?.periodStart && form?.periodEnd) {
      setDraft(d => ({ ...d, _checking: true, _duplicateError: null }))
      try {
        const existingFlightIds = legs
          .map(l => l.flight_id)
          .filter((id): id is string => id !== null)

        const dup = await checkDuplicateFlight({
          flight_number: flightNum,
          dep_station: dep,
          arr_station: arr,
          period_start: form.periodStart,
          period_end: form.periodEnd,
          exclude_flight_ids: existingFlightIds,
        })

        if (dup) {
          const routeInfo = dup.route_name ? ` in route ${dup.route_name}` : ''
          setDraft(d => ({
            ...d,
            _checking: false,
            _errors: { flightNumber: true },
            _duplicateError: `\u274c ${fltLabel} ${dep}\u2192${arr} already exists for period ${dup.period_start} \u2014 ${dup.period_end}${routeInfo}. Duplicate flight numbers with same DEP/ARR on overlapping periods are not permitted.`,
          }))
          return
        }
      } catch { /* fail open */ }
      setDraft(d => ({ ...d, _checking: false }))
    }

    // Add the leg
    const std = normalizeTime(draft.stdLocal)
    const sta = normalizeTime(draft.staLocal)
    const block = computeBlockMinutes(std, sta)

    const newLeg: LegWithOffsets = {
      id: makeLegId(),
      route_id: selectedRouteId || '',
      leg_sequence: legs.length + 1,
      flight_id: null,
      airline_code: operatorIataCode,
      flight_number: flightNum || null,
      dep_station: dep,
      arr_station: arr,
      std_local: std,
      sta_local: sta,
      dep_utc_offset: null,
      arr_utc_offset: null,
      block_minutes: block,
      day_offset: 0,
      arrives_next_day: false,
      service_type: draft.serviceType || 'J',
      _dayOffset: 0,
      _arrivesNextDay: false,
      _dayOffsetManual: false,
    }

    console.log('Leg confirmed, adding to array. Legs count:', legs.length + 1)
    const nextRowIdx = legs.length + 1 // index of next empty row after this leg is added
    setLegs(prev => {
      const newLegs = recalcLegs([...prev, newLeg])
      pushHistory(newLegs)
      return newLegs
    })

    // Auto-populate next empty row draft
    const nextDraft = emptyDraft()
    nextDraft.depStation = arr
    nextDraft._autoFilledDep = true
    if (normalizeTime(draft.staLocal)) {
      const acType = form?.aircraftTypeId ? acTypeMap.get(form.aircraftTypeId) : undefined
      const rType = getRouteType(dep, arr, airportCountryMap, operatorCountry)
      const minTat = getMinTat(acType, rType)
      const staMin = timeToMinutes(normalizeTime(draft.staLocal))
      nextDraft.stdLocal = minutesToTimeStr((staMin + minTat) % 1440)
      nextDraft._autoFilledStd = true
    }
    setDraft(nextDraft)
    setActiveEmptyRow(nextRowIdx)
    setFocusField('flightNumber')
    setIsAdding(true)
    console.log('Clearing entry row, activating next empty row:', nextRowIdx)
    setIsDirty(true)
  }, [draft, draftValidation, legs, operatorIataCode, selectedRouteId, recalcLegs, pushHistory, form?.periodStart, form?.periodEnd, form?.aircraftTypeId, acTypeMap, airportCountryMap, operatorCountry])

  // ── Activate an empty grid row ──
  const activateEmptyRow = useCallback((rowIdx: number, clickedField?: string) => {
    console.log('Activating empty row:', rowIdx, 'clicked field:', clickedField)
    const d = emptyDraft()
    if (legs.length > 0) {
      const lastLeg = legs[legs.length - 1]
      d.depStation = lastLeg.arr_station
      d._autoFilledDep = true

      if (lastLeg.sta_local) {
        const acType = form?.aircraftTypeId ? acTypeMap.get(form.aircraftTypeId) : undefined
        const rType = getRouteType(lastLeg.dep_station, lastLeg.arr_station, airportCountryMap, operatorCountry)
        const minTat = getMinTat(acType, rType)
        const prevStaMin = timeToMinutes(lastLeg.sta_local)
        const absStaMin = (lastLeg._dayOffset + (lastLeg._arrivesNextDay ? 1 : 0)) * 1440 + prevStaMin
        const stdAbsMin = absStaMin + minTat
        d.stdLocal = minutesToTimeStr(stdAbsMin % 1440)
        d._autoFilledStd = true
      }
    }
    setDraft(d)
    setActiveEmptyRow(rowIdx)
    setFocusField(clickedField && clickedField !== 'row' ? clickedField : 'flightNumber')
    setIsAdding(true)
  }, [legs, form?.aircraftTypeId, acTypeMap, airportCountryMap, operatorCountry])

  const deactivateEmptyRow = useCallback(() => {
    setActiveEmptyRow(null)
    setFocusField(null)
    setIsAdding(false)
    setDraft(emptyDraft())
  }, [])

  // ── Inline cell editing ──
  const startEdit = useCallback((legId: string, field: string, currentValue: string) => {
    setEditingCell({ legId, field })
    setEditValue(currentValue)
    setSelectedRows(new Set())
  }, [])

  const commitEdit = useCallback(() => {
    if (!editingCell) return
    const { legId, field } = editingCell
    setLegs(prev => {
      const idx = prev.findIndex(l => l.id === legId)
      if (idx < 0) return prev
      const updated = [...prev]
      const leg = { ...updated[idx] }

      switch (field) {
        case 'flight_number': {
          const num = parseInt(editValue.replace(/\D/g, ''))
          if (!isNaN(num)) { leg.flight_number = num; leg.airline_code = operatorIataCode }
          break
        }
        case 'dep_station': leg.dep_station = editValue.toUpperCase().slice(0, 3); break
        case 'arr_station': leg.arr_station = editValue.toUpperCase().slice(0, 3); break
        case 'std_local': {
          const t = normalizeTime(editValue)
          if (isValidTime(t)) { leg.std_local = t; leg.block_minutes = computeBlockMinutes(t, leg.sta_local) }
          break
        }
        case 'sta_local': {
          const t = normalizeTime(editValue)
          if (isValidTime(t)) { leg.sta_local = t; leg.block_minutes = computeBlockMinutes(leg.std_local, t) }
          break
        }
        case 'service_type': leg.service_type = editValue.toUpperCase().slice(0, 1) || 'J'; break
        case 'day_offset': {
          if (editValue === '') {
            leg._dayOffsetManual = false
          } else {
            const num = parseInt(editValue)
            if (!isNaN(num) && num >= 0) {
              leg._dayOffset = num
              leg._dayOffsetManual = true
            }
          }
          break
        }
      }

      updated[idx] = leg
      const result = recalcLegs(updated)
      pushHistory(result)
      return result
    })
    setEditingCell(null)
    setIsDirty(true)
  }, [editingCell, editValue, operatorIataCode, recalcLegs, pushHistory])

  const cancelEdit = useCallback(() => { setEditingCell(null) }, [])

  // ── Cell selection (Excel-style) ──
  const colToField = (col: number): string | null => {
    switch (col) {
      case 0: return 'day_offset'
      case 1: return 'flight_number'
      case 2: return 'dep_station'
      case 3: return 'arr_station'
      case 4: return 'std_local'
      case 5: return 'sta_local'
      case 7: return 'service_type'
      default: return null
    }
  }

  const selectCell = useCallback((row: number, col: number) => {
    if (row < 0 || col < 0 || col > 7) return
    if (row >= legs.length) {
      setSelectedCell(null)
      focusGridCell(row, col)
      return
    }
    setSelectedCell({ row, col })
    setEditingCell(null)
    setSelectedRows(new Set())
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-grid-row="${row}"][data-grid-col="${col}"]`)
      if (el) el.focus()
    }, 0)
  }, [legs.length])

  const deselectCell = useCallback(() => { setSelectedCell(null) }, [])

  const clearCellValue = useCallback((row: number, col: number) => {
    const field = colToField(col)
    if (!field || row >= legs.length) return
    setLegs(prev => {
      const updated = [...prev]
      const leg = { ...updated[row] }
      switch (field) {
        case 'day_offset': leg._dayOffsetManual = false; break
        case 'flight_number': leg.flight_number = null; leg.airline_code = null; break
        case 'dep_station': leg.dep_station = ''; break
        case 'arr_station': leg.arr_station = ''; break
        case 'std_local': leg.std_local = ''; leg.block_minutes = computeBlockMinutes('', leg.sta_local); break
        case 'sta_local': leg.sta_local = ''; leg.block_minutes = computeBlockMinutes(leg.std_local, ''); break
        case 'service_type': leg.service_type = ''; break
      }
      updated[row] = leg
      const result = recalcLegs(updated)
      pushHistory(result)
      return result
    })
    setIsDirty(true)
  }, [legs.length, recalcLegs, pushHistory])

  // ── Drag & Drop ──
  const dragCloneRef = useRef<HTMLElement | null>(null)

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragIdx(idx)
    const row = e.currentTarget as HTMLElement
    // Create a clone of just this row for the drag ghost
    const clone = row.cloneNode(true) as HTMLElement
    clone.style.position = 'fixed'
    clone.style.top = '-1000px'
    clone.style.left = '0'
    clone.style.width = row.offsetWidth + 'px'
    clone.style.height = row.offsetHeight + 'px'
    clone.style.backgroundColor = 'rgba(255, 255, 255, 0.95)'
    clone.style.backdropFilter = 'blur(20px)'
    clone.style.borderRadius = '8px'
    clone.style.boxShadow = '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)'
    clone.style.border = '1px solid rgba(153, 27, 27, 0.3)'
    clone.style.zIndex = '9999'
    clone.style.display = 'table-row'
    clone.style.opacity = '0.95'
    document.body.appendChild(clone)
    dragCloneRef.current = clone
    const rect = row.getBoundingClientRect()
    e.dataTransfer.setDragImage(clone, e.clientX - rect.left, e.clientY - rect.top)
    e.dataTransfer.effectAllowed = 'move'
    // Dim the original row
    row.style.opacity = '0.3'
  }, [])

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = '1'
    if (dragCloneRef.current) {
      dragCloneRef.current.remove()
      dragCloneRef.current = null
    }
    setDragIdx(null)
    setDropIndicator(null)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragIdx === idx) { setDropIndicator(null); return }
    const row = e.currentTarget as HTMLElement
    const rect = row.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    setDropIndicator({ index: idx, position: e.clientY < midY ? 'above' : 'below' })
  }, [dragIdx])

  const handleDrop = useCallback((targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) { setDragIdx(null); setDropIndicator(null); return }
    const insertIdx = dropIndicator?.position === 'below' ? targetIdx + 1 : targetIdx
    setLegs(prev => {
      const items = [...prev]
      const [moved] = items.splice(dragIdx, 1)
      // Adjust target if source was before target
      const adjIdx = dragIdx < insertIdx ? insertIdx - 1 : insertIdx
      items.splice(adjIdx, 0, moved)
      const result = recalcLegs(items)
      pushHistory(result)
      return result
    })
    setDragIdx(null); setDropIndicator(null); setIsDirty(true)
  }, [dragIdx, dropIndicator, recalcLegs, pushHistory])

  // ═══════════════════════════════════════════════════════════════
  // SAVE / DISCARD / DELETE / PUBLISH
  // ═══════════════════════════════════════════════════════════════

  const computeWarnings = useCallback((): string[] => {
    const warnings: string[] = []

    for (const v of legValidations) {
      if (v.tat.status === 'warn') warnings.push(v.tat.message)
      if (v.sequence.status === 'warn') warnings.push(v.sequence.message)
    }

    const season = seasons.find(s => s.id === form?.seasonId)
    if (season && form?.periodStart && form?.periodEnd) {
      const seasonStart = season.start_date.slice(0, 10)
      const seasonEnd = season.end_date.slice(0, 10)
      if (form.periodStart < seasonStart) {
        warnings.push(`Period starts ${daysBetween(form.periodStart, seasonStart)} days before season start`)
      }
      if (form.periodEnd > seasonEnd) {
        warnings.push(`Period extends ${daysBetween(seasonEnd, form.periodEnd)} days beyond season end`)
      }
    }
    return warnings
  }, [legValidations, form, seasons])

  const executeSave = useCallback(async () => {
    if (!form) return
    setSaving(true); setShowWarningDialog(false)

    try {
      const input: SaveRouteInput = {
        id: isNewRoute ? null : selectedRouteId,
        season_id: form.seasonId,
        scenario_id: selectedScenario?.id || '',
        route_name: form.routeName || null,
        aircraft_type_id: form.aircraftTypeId || null,
        aircraft_type_icao: form.aircraftTypeIcao || null,
        days_of_operation: form.daysOfOperation,
        period_start: form.periodStart || null,
        period_end: form.periodEnd || null,
        duration_days: routeDuration,
        status: form.status === 'new' ? 'draft' : form.status,
        notes: form.notes || null,
        legs: legs.map(l => ({
          flight_id: l.flight_id,
          airline_code: l.airline_code,
          flight_number: l.flight_number,
          dep_station: l.dep_station,
          arr_station: l.arr_station,
          std_local: l.std_local,
          sta_local: l.sta_local,
          block_minutes: l.block_minutes,
          day_offset: l._dayOffset,
          arrives_next_day: l._arrivesNextDay,
          service_type: l.service_type,
        })),
      }

      const res = await saveRoute(input)
      if (res.error) { toast.error(friendlyError(res.error)); return }

      toast.success(`Route ${form.routeName || 'Untitled'} saved (${legs.length} leg${legs.length !== 1 ? 's' : ''})`)
      await Promise.all([refresh(), refreshTemplates(), refreshScenarios()])
      // Wipe form and start fresh for next route
      setIsDirty(false)
      setSelectedRouteId(null)
      setIsNewRoute(false)
      isNewRouteRef.current = false
      initNewRoute()
    } catch { toast.error('Failed to save route') }
    finally { setSaving(false) }
  }, [form, selectedRouteId, isNewRoute, legs, routeDuration, refresh, refreshTemplates, initNewRoute])

  const handleSaveRoute = useCallback(() => {
    if (!form) return
    if (hasRedErrors) { toast.error('Cannot save \u2014 resolve errors first'); return }
    if (isAdding && draft._duplicateError) { toast.error('Cannot save \u2014 resolve duplicate flight error first'); return }

    // Validate required form fields
    const errs: Record<string, boolean> = {}
    const missing: string[] = []
    if (!form.aircraftTypeId) { errs.aircraftType = true; missing.push('AC Type') }
    if (!form.periodStart) { errs.periodStart = true; missing.push('From date') }
    if (!form.periodEnd) { errs.periodEnd = true; missing.push('To date') }
    if (!form.daysOfOperation) { errs.daysOfOperation = true; missing.push('Day of Week') }
    if (legs.length === 0) { missing.push('At least one flight leg') }

    if (missing.length > 0) {
      setFormErrors(errs)
      toast.error('Required fields missing', { items: missing })
      return
    }
    setFormErrors({})

    const warnings = computeWarnings()
    if (warnings.length > 0) { setSaveWarnings(warnings); setShowWarningDialog(true); return }
    executeSave()
  }, [form, hasRedErrors, isAdding, draft._duplicateError, legs.length, computeWarnings, executeSave])

  const discardChanges = useCallback(() => {
    if (isNewRoute) {
      // Discard new route → re-init empty form
      initNewRoute()
    } else if (snapshotRef.current) {
      setForm({ ...snapshotRef.current.form })
      setLegs(snapshotRef.current.legs.map(l => ({ ...l })))
    }
    setIsDirty(false); setIsAdding(false); setActiveEmptyRow(null); setFocusField(null); setEditingCell(null); setSelectedCell(null); setSelectedRows(new Set()); setFormErrors({}); setDraft(emptyDraft())
    setShowDiscardDialog(false)
  }, [isNewRoute, initNewRoute])

  const handleDeleteRoute = useCallback(async () => {
    if (!selectedRouteId) return
    setSaving(true); setShowDeleteDialog(false)
    try {
      const res = await deleteRouteAction(selectedRouteId)
      if (res.error) { toast.error(friendlyError(res.error)); return }
      toast.success(`Route ${form?.routeName || 'Untitled'} deleted`)
      setSelectedRouteId(null); setIsDirty(false)
      await Promise.all([refresh(), refreshTemplates()])
    } catch { toast.error('Failed to delete route') }
    finally { setSaving(false) }
  }, [selectedRouteId, form?.routeName, refresh, refreshTemplates])

  const handlePublishRoute = useCallback(async () => {
    if (!selectedRouteId) return
    const isPublished = form?.status === 'published'
    setSaving(true); setShowPublishDialog(false)
    try {
      const res = await publishRouteAction(selectedRouteId, !isPublished)
      if (res.error) { toast.error(friendlyError(res.error)); return }
      toast.success(`Route ${isPublished ? 'unpublished' : 'published'}`)
      setForm(prev => prev ? { ...prev, status: isPublished ? 'draft' : 'published' } : null)
      await Promise.all([refresh(), refreshTemplates()])
    } catch { toast.error('Failed to update route status') }
    finally { setSaving(false) }
  }, [selectedRouteId, form?.status, refresh, refreshTemplates])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    shortcutRefs.current = {
      save: handleSaveRoute,
      undo: handleUndo,
      redo: handleRedo,
      newRoute: handleNewRoute,
      duplicate: duplicateLeg,
      cancel: () => {
        if (isAdding) { deactivateEmptyRow() }
        else if (editingCell) { cancelEdit() }
        else if (selectedCell) { setSelectedCell(null) }
        else if (highlightedCol !== null) { setHighlightedCol(null) }
        else if (selectedRows.size > 0) { setSelectedRows(new Set()) }
      },
      deleteSelectedLeg: () => {
        if (selectedRows.size > 0) {
          // Delete all selected rows (in reverse order to preserve indices)
          const indices = Array.from(selectedRows).sort((a, b) => b - a)
          setLegs(prev => {
            const items = prev.filter((_, i) => !selectedRows.has(i))
            const result = recalcLegs(items)
            pushHistory(result)
            return result
          })
          setSelectedRows(new Set())
          setIsDirty(true)
        } else if (selectedCell && selectedCell.row < legs.length) {
          deleteLeg(legs[selectedCell.row].id)
          setSelectedCell(null)
        }
      },
      expandRowSelection: (direction: 'up' | 'down') => {
        if (selectedRows.size === 0) return
        const sorted = Array.from(selectedRows).sort((a, b) => a - b)
        const next = new Set(selectedRows)
        if (direction === 'down') {
          const max = sorted[sorted.length - 1]
          if (max + 1 < legs.length) next.add(max + 1)
        } else {
          const min = sorted[0]
          if (min - 1 >= 0) next.add(min - 1)
        }
        setSelectedRows(next)
      },
      selectAll: () => {
        if (legs.length === 0) return
        const all = new Set<number>()
        for (let i = 0; i < legs.length; i++) all.add(i)
        setSelectedRows(all)
        setSelectedCell(null)
        setHighlightedCol(null)
      },
      addRow: () => {
        // Insert a blank leg below the selected row
        const firstSelected = selectedRows.size > 0 ? Math.max(...Array.from(selectedRows)) : null
        const selIdx = firstSelected ?? (selectedCell && selectedCell.row < legs.length ? selectedCell.row : null)
        if (selIdx === null || selIdx >= legs.length) return
        const blankLeg: LegWithOffsets = {
          id: makeLegId(),
          route_id: selectedRouteId || '',
          leg_sequence: 0,
          flight_id: null,
          airline_code: operatorIataCode,
          flight_number: null,
          dep_station: '',
          arr_station: '',
          std_local: '',
          sta_local: '',
          dep_utc_offset: null,
          arr_utc_offset: null,
          block_minutes: null,
          day_offset: 0,
          arrives_next_day: false,
          service_type: 'J',
          _dayOffset: 0,
          _arrivesNextDay: false,
          _dayOffsetManual: false,
        }
        setLegs(prev => {
          const items = [...prev]
          items.splice(selIdx + 1, 0, blankLeg)
          const result = recalcLegs(items)
          pushHistory(result)
          return result
        })
        setIsDirty(true)
        // Select the newly inserted row
        const newIdx = selIdx + 1
        setSelectedRows(new Set())
        setSelectedCell({ row: newIdx, col: 1 })
        setTimeout(() => {
          const el = document.querySelector<HTMLElement>(`[data-grid-row="${newIdx}"][data-grid-col="1"]`)
          if (el) el.focus()
        }, 0)
      },
      selectRow: () => {
        const row = selectedCell?.row ?? (selectedRows.size > 0 ? Math.min(...Array.from(selectedRows)) : null)
        if (row !== null && row !== undefined && row < legs.length) {
          setSelectedRows(new Set([row]))
          setSelectedCell(null)
          setHighlightedCol(null)
        }
      },
      selectCol: () => {
        const col = selectedCell?.col
        if (col !== null && col !== undefined) {
          setHighlightedCol(prev => prev === col ? null : col)
          setSelectedRows(new Set())
        }
      },
    }
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      // Ctrl+S: Save
      if (mod && e.key === 's') { e.preventDefault(); e.stopPropagation(); shortcutRefs.current.save(); return }
      // Ctrl+Z: Undo
      if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); shortcutRefs.current.undo(); return }
      // Ctrl+Shift+Z / Ctrl+Y: Redo
      if (mod && e.key === 'z' && e.shiftKey) { e.preventDefault(); e.stopPropagation(); shortcutRefs.current.redo(); return }
      if (mod && e.key === 'y') { e.preventDefault(); e.stopPropagation(); shortcutRefs.current.redo(); return }
      // Ctrl+N: New Route
      if (mod && e.key === 'n') { e.preventDefault(); e.stopPropagation(); shortcutRefs.current.newRoute(); return }
      // Ctrl+D: Duplicate Leg
      if (mod && e.key === 'd') { e.preventDefault(); e.stopPropagation(); shortcutRefs.current.duplicate(); return }
      // Ctrl+F: Focus search
      if (mod && e.key === 'f') { e.preventDefault(); e.stopPropagation(); document.getElementById('route-search')?.focus(); return }
      // Ctrl+-: Delete selected row  |  Ctrl+=: Insert row below
      if (mod && (e.key === '-' || e.key === '=' || e.key === '+')) {
        e.preventDefault(); e.stopPropagation()
        if (e.key === '-') { shortcutRefs.current.deleteSelectedLeg() }
        else { shortcutRefs.current.addRow() }
        return
      }
      // Delete: Remove selected leg (only when not typing in an input)
      if (e.key === 'Delete') {
        const el = document.activeElement
        const isTyping = el?.tagName === 'INPUT' || el?.tagName === 'SELECT' || el?.tagName === 'TEXTAREA'
        if (!isTyping) { e.preventDefault(); shortcutRefs.current.deleteSelectedLeg(); return }
      }
      // Shift+Space: Select entire row  |  Ctrl+Space: Select entire column
      if (e.key === ' ') {
        const el = document.activeElement
        const isTyping = el?.tagName === 'INPUT' || el?.tagName === 'SELECT' || el?.tagName === 'TEXTAREA'
        if (!isTyping) {
          if (e.shiftKey && !mod) {
            e.preventDefault(); e.stopPropagation()
            shortcutRefs.current.selectRow()
            return
          }
          if (mod && !e.shiftKey) {
            e.preventDefault(); e.stopPropagation()
            shortcutRefs.current.selectCol()
            return
          }
        }
      }
      // Ctrl+A: Select all rows
      if (mod && e.key === 'a') {
        const el = document.activeElement
        const isTyping = el?.tagName === 'INPUT' || el?.tagName === 'SELECT' || el?.tagName === 'TEXTAREA'
        if (!isTyping) { e.preventDefault(); e.stopPropagation(); shortcutRefs.current.selectAll(); return }
      }
      // Arrow Up/Down when rows are selected: expand selection
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !mod && !e.shiftKey) {
        // Only intercept when rows are selected (not cell selection)
        const el = document.activeElement
        const isTyping = el?.tagName === 'INPUT' || el?.tagName === 'SELECT' || el?.tagName === 'TEXTAREA'
        const hasFocusedCell = el?.hasAttribute('data-grid-col')
        if (!isTyping && !hasFocusedCell) {
          e.preventDefault(); e.stopPropagation()
          shortcutRefs.current.expandRowSelection(e.key === 'ArrowDown' ? 'down' : 'up')
          return
        }
      }
      // Escape: Cancel edit / deselect row
      if (e.key === 'Escape') { shortcutRefs.current.cancel(); return }
    }
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [])

  // ── Styles ──
  const inputClass = 'h-8 rounded-lg bg-white/50 dark:bg-white/5 border border-black/[0.06] dark:border-white/[0.06] px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30'
  const cellInputClass = 'bg-transparent border-b border-primary/40 focus:border-primary outline-none font-mono tabular-nums'

  return (
    <div className="h-full flex gap-4 overflow-hidden">
      {/* ═══ LEFT PANEL ═══ */}
      <div className="w-[280px] shrink-0 glass rounded-2xl flex flex-col overflow-hidden">
        <div className="shrink-0 p-4 pb-3 space-y-3">
          {/* ── Scenario header ── */}
          {selectedScenario ? (
            <>
              <div className="space-y-0.5">
                <p className="text-[13px] text-[#6b7280] italic leading-tight">Currently editing {selectedScenario.scenario_name}</p>
                <div className="flex items-center justify-between">
                  <button onClick={() => setShowScenarioList(true)} className="text-sm font-bold hover:text-[#991b1b] transition-colors">{selectedScenario.scenario_number}</button>
                  <div className="flex items-center gap-1">
                    <button onClick={openCreateScenarioDialog} className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors" title="Create scenario">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setShowScenarioList(true)} className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors" title="Scenario list">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4h12M2 8h12M2 12h12" /></svg>
                    </button>
                  </div>
                </div>
              </div>
              <div className="h-px bg-black/[0.06] dark:bg-white/[0.06]" />
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Aircraft Routes</h2>
                <div className="flex items-center gap-1">
                  <button onClick={refresh} disabled={loading} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors" title="Refresh">
                    <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                  </button>
                  <div className="relative" ref={filterRef}>
                    <button onClick={() => setFilterOpen(p => !p)}
                      className="h-7 px-2.5 flex items-center gap-1 rounded-lg border border-black/[0.06] dark:border-white/[0.06] hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-xs">
                      <span className="max-w-[80px] truncate">{acFilterLabel}</span>
                      <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                    </button>
                    {filterOpen && usedAcTypes.length > 0 && (
                      <div className="absolute right-0 top-full mt-1 z-50 glass-heavy rounded-lg shadow-lg py-1 min-w-[200px] max-h-[200px] overflow-y-auto">
                        {usedAcTypes.map(([icao, name]) => {
                          const checked = acTypeFilter.size === 0 || acTypeFilter.has(icao)
                          return (
                            <button key={icao} type="button"
                              onClick={() => toggleAcTypeFilter(icao)}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-left">
                              <div className={cn(
                                'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0',
                                checked ? 'bg-[#991b1b] border-[#991b1b]' : 'border-black/20 dark:border-white/20'
                              )}>
                                {checked && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              </div>
                              <span className="font-mono font-semibold">{icao}</span>
                              <span className="text-muted-foreground truncate">{name}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input id="route-search" type="text" placeholder="Search routes..." value={search} onChange={e => setSearch(e.target.value)}
                  className={cn(inputClass, 'w-full pl-8')} />
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={openCreateScenarioDialog}
                className="flex-1 h-8 flex items-center justify-center gap-1.5 rounded-lg bg-[#991b1b] text-white text-xs font-medium hover:bg-[#7f1d1d] transition-colors">
                <Plus className="h-3.5 w-3.5" /> Create Scenario
              </button>
              <button onClick={() => setShowScenarioList(true)}
                className="h-8 px-3 flex items-center justify-center gap-1.5 rounded-lg border border-black/[0.06] dark:border-white/[0.06] hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-xs">
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4h12M2 8h12M2 12h12" /></svg>
                List
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2 custom-scrollbar">
          {!selectedScenario ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Plane className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm font-medium text-muted-foreground">No scenario selected</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Create a new scenario or select from existing ones</p>
            </div>
          ) : loading && !routes.length ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">Loading...</div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
              <Plane className="h-8 w-8 mb-2 opacity-30" /><p>No routes found</p>
            </div>
          ) : groups.map(group => (
            <div key={group.icao} className="mb-1">
              <button onClick={() => toggleGroup(group.icao)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.03]">
                {collapsedGroups.has(group.icao) ? <ChevronRight className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
                <span className="font-mono">{group.icao}</span>
                <span className="text-muted-foreground/70">&mdash;</span>
                <span className="truncate">{group.name}</span>
                <span className="ml-auto text-muted-foreground/50 tabular-nums">({group.routes.length})</span>
              </button>
              {!collapsedGroups.has(group.icao) && (
                <div className="space-y-0.5 mt-0.5">
                  {group.routes.map(route => (
                    <RouteItem key={route.id} route={route} isSelected={selectedRouteId === route.id}
                      onClick={() => handleSelectRoute(route.id)} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {selectedScenario && (
          <div className="shrink-0 border-t border-black/[0.06] dark:border-white/[0.06] px-4 py-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Unassigned Flights</span>
              <span className={cn('font-mono font-semibold tabular-nums', unassignedCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground/50')}>
                {unassignedCount}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ═══ RIGHT PANEL ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 gap-4">
        {form ? (
          <>
            {/* ── ROUTE HEADER ── */}
            <div className="shrink-0 glass rounded-2xl px-4 py-2 group/header">
              <div className="flex items-end gap-3">
                <div>
                  <span className="block text-[10px] uppercase text-[#9ca3af] tracking-[0.5px] leading-[14px] mb-0.5">Route No.</span>
                  <input type="text" value={form.routeName} tabIndex={TAB_ROUTE_NO}
                    onChange={e => { hasManualRouteNameRef.current = true; updateForm({ routeName: e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase() }) }}
                    onFocus={e => e.target.select()}
                    placeholder="SGNHAN01" maxLength={8}
                    className={cn(inputClass, 'w-[90px] font-mono text-xs font-semibold h-[30px]')} />
                </div>

                <div className="relative">
                  <span className="block text-[10px] uppercase text-[#9ca3af] tracking-[0.5px] leading-[14px] mb-0.5">AC Type</span>
                  <input ref={acTypeInputRef} type="text" value={acTypeSearch} tabIndex={TAB_AC_TYPE}
                    onChange={e => {
                      const v = e.target.value.toUpperCase()
                      setAcTypeSearch(v)
                      setAcTypeOpen(true)
                      // Only auto-select on exact ICAO match while typing
                      const exact = aircraftTypes.find(t => t.is_active && t.icao_type === v)
                      if (exact) {
                        updateForm({ aircraftTypeId: exact.id, aircraftTypeIcao: exact.icao_type })
                      } else if (!v) {
                        updateForm({ aircraftTypeId: '', aircraftTypeIcao: '' })
                      }
                    }}
                    onFocus={e => { e.target.select(); setAcTypeOpen(true) }}
                    onBlur={() => {
                      // Delay to allow click on dropdown
                      setTimeout(() => {
                        setAcTypeOpen(false)
                        // Ensure display matches selected
                        if (form.aircraftTypeId) {
                          const at = aircraftTypes.find(t => t.id === form.aircraftTypeId)
                          if (at) setAcTypeSearch(at.icao_type)
                        } else {
                          setAcTypeSearch('')
                        }
                      }, 150)
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === 'Tab') {
                        // Accept best ranked match
                        const match = findBestAcType(aircraftTypes, acTypeSearch)
                        if (match) {
                          updateForm({ aircraftTypeId: match.id, aircraftTypeIcao: match.icao_type })
                          setAcTypeSearch(match.icao_type)
                        }
                        setAcTypeOpen(false)
                      }
                    }}
                    placeholder="A321" maxLength={8}
                    className={cn(inputClass, 'w-[80px] text-xs font-mono h-[30px]', formErrors.aircraftType && 'border-red-500 ring-1 ring-red-500/30')} autoComplete="off" />
                  {acTypeOpen && acTypeSearch && (() => {
                    const filtered = filterAndSortAcTypes(aircraftTypes, acTypeSearch)
                    return (
                      <div ref={acTypeDropRef} className="absolute top-full left-0 mt-1 z-50 glass-heavy rounded-lg shadow-lg py-1 min-w-[180px] max-h-[160px] overflow-y-auto">
                        {filtered.length > 0 ? filtered.map(t => (
                          <button key={t.id} type="button"
                            onMouseDown={e => {
                              e.preventDefault()
                              updateForm({ aircraftTypeId: t.id, aircraftTypeIcao: t.icao_type })
                              setAcTypeSearch(t.icao_type)
                              setAcTypeOpen(false)
                              acTypeInputRef.current?.blur()
                            }}
                            className={cn('w-full text-left px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/10 transition-colors',
                              form.aircraftTypeId === t.id && 'bg-[#991b1b]/10 font-semibold')}>
                            <span className="font-mono font-semibold">{t.icao_type}</span>
                            <span className="text-muted-foreground ml-1.5">{t.name}</span>
                          </button>
                        )) : (
                          <div className="px-3 py-1.5 text-xs text-muted-foreground">No match</div>
                        )}
                      </div>
                    )
                  })()}
                </div>

                <div>
                  <span className="block text-[10px] uppercase text-[#9ca3af] tracking-[0.5px] leading-[14px] mb-0.5">From</span>
                  <input type="text" value={fromDisplay} tabIndex={TAB_FROM}
                    onChange={e => {
                      const formatted = formatDateInput(e.target.value)
                      setFromDisplay(formatted)
                      const iso = displayToIso(formatted)
                      if (iso) updateForm({ periodStart: iso })
                    }}
                    onBlur={() => {
                      const iso = displayToIso(fromDisplay)
                      if (iso) { updateForm({ periodStart: iso }); setFromDisplay(isoToDisplay(iso)) }
                      else if (!fromDisplay) updateForm({ periodStart: '' })
                    }}
                    onFocus={e => e.target.select()}
                    placeholder="DD/MM/YYYY" maxLength={10}
                    className={cn(inputClass, 'w-[95px] text-xs font-mono h-[30px]', formErrors.periodStart && 'border-red-500 ring-1 ring-red-500/30')} />
                </div>

                <span className="text-xs text-muted-foreground pb-[7px]">&mdash;</span>

                <div>
                  <span className="block text-[10px] uppercase text-[#9ca3af] tracking-[0.5px] leading-[14px] mb-0.5">To</span>
                  <input type="text" value={toDisplay} tabIndex={TAB_TO}
                    onChange={e => {
                      const formatted = formatDateInput(e.target.value)
                      setToDisplay(formatted)
                      const iso = displayToIso(formatted)
                      if (iso) updateForm({ periodEnd: iso })
                    }}
                    onBlur={() => {
                      const iso = displayToIso(toDisplay)
                      if (iso) { updateForm({ periodEnd: iso }); setToDisplay(isoToDisplay(iso)) }
                      else if (!toDisplay) updateForm({ periodEnd: '' })
                    }}
                    onFocus={e => e.target.select()}
                    placeholder="DD/MM/YYYY" maxLength={10}
                    className={cn(inputClass, 'w-[95px] text-xs font-mono h-[30px]', formErrors.periodEnd && 'border-red-500 ring-1 ring-red-500/30')} />
                </div>

                <div>
                  <span className="block text-[10px] uppercase text-[#9ca3af] tracking-[0.5px] leading-[14px] mb-0.5">Day of Week</span>
                  <div className={cn('h-[30px] flex items-center rounded-lg px-1', formErrors.daysOfOperation && 'ring-1 ring-red-500/30')}>
                    <DowCirclesInteractive value={form.daysOfOperation} onChange={v => updateForm({ daysOfOperation: v })} />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 ml-auto pb-[5px]">
                  <div className={cn('w-2 h-2 rounded-full',
                    form.status === 'published' ? 'bg-emerald-500'
                    : isNewRoute ? 'bg-blue-500'
                    : 'bg-gray-400'
                  )} />
                  <span className="text-xs font-medium capitalize">{isNewRoute ? 'New' : form.status}</span>
                  {!isDirty && selectedRouteId && !isNewRoute && (
                    <button onClick={() => setShowPublishDialog(true)} disabled={saving} tabIndex={-1}
                      className="ml-1 text-[11px] text-primary/70 hover:text-primary underline underline-offset-2 transition-colors disabled:opacity-50">
                      {form.status === 'published' ? 'Unpublish' : 'Publish'}
                    </button>
                  )}
                </div>

                {selectedRouteId && !isNewRoute && (
                  <button onClick={() => setShowDeleteDialog(true)} disabled={saving} tabIndex={-1}
                    className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground/30 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 opacity-0 group-hover/header:opacity-100 mb-[3px]"
                    title="Delete route">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* ── LEGS GRID ── */}
            <div className="flex-1 glass rounded-2xl flex flex-col overflow-hidden min-h-0">
              <div className="shrink-0 px-4 pt-3 pb-1.5">
                <h3 className="text-sm font-semibold">Flight Legs Information</h3>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-3 custom-scrollbar">
                <table className="w-full border-collapse border border-black/[0.08] dark:border-white/[0.08] text-[13px]"
                  style={{ userSelect: dragIdx !== null ? 'none' : undefined }}
                  onDragStart={e => { if (!(e.target as HTMLElement).closest('[data-draggable-row]')) e.preventDefault() }}>
                  <thead>
                    {(() => {
                      const thBase = 'py-1.5 text-center border border-black/[0.08] dark:border-white/[0.08]'
                      const hlStyle = (col: number): React.CSSProperties | undefined => highlightedCol === col ? { outline: '2px solid #991b1b', outlineOffset: '-2px', background: '#fef2f2' } : undefined
                      return (
                        <tr className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-[#f8f9fa] dark:bg-white/[0.03] sticky top-0 z-10">
                          <th className={cn('w-[30px]', thBase)}>#</th>
                          <th className={cn('w-[35px]', thBase)} style={hlStyle(0)}>Day</th>
                          <th className={cn('w-[70px]', thBase)} style={hlStyle(1)}>Flt No</th>
                          <th className={cn('w-[50px]', thBase)} style={hlStyle(2)}>DEP</th>
                          <th className={cn('w-[50px]', thBase)} style={hlStyle(3)}>ARR</th>
                          <th className={cn('w-[60px]', thBase)} style={hlStyle(4)}>STD</th>
                          <th className={cn('w-[60px]', thBase)} style={hlStyle(5)}>STA</th>
                          <th className={cn('w-[55px]', thBase)} style={hlStyle(6)}>Block</th>
                          <th className={cn('w-[35px]', thBase)} style={hlStyle(7)}>Svc</th>
                          <th className={cn('w-[40px]', thBase)}></th>
                        </tr>
                      )
                    })()}
                  </thead>
                  <tbody>
                    {/* Filled leg rows */}
                    {legs.map((leg, idx) => {
                      const fltLabel = leg.airline_code && leg.flight_number != null
                        ? `${leg.airline_code}${leg.flight_number}` : '\u2014'
                      const di = dropIndicator
                      const showDropAbove = di !== null && dragIdx !== null && dragIdx !== idx && di.index === idx && di.position === 'above'
                      const showDropBelow = di !== null && dragIdx !== null && dragIdx !== idx && di.index === idx && di.position === 'below'

                      return (
                        <LegRow
                          key={leg.id}
                          leg={leg}
                          index={idx}
                          flightLabel={fltLabel}
                          validation={legValidations[idx]}
                          editingCell={editingCell}
                          editValue={editValue}
                          onStartEdit={startEdit}
                          onEditChange={setEditValue}
                          onCommitEdit={commitEdit}
                          onCancelEdit={cancelEdit}
                          operatorIataCode={operatorIataCode}
                          airportIataSet={airportIataSet}
                          cellInputClass={cellInputClass}
                          onDragStart={(e) => handleDragStart(e, idx)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDrop={() => handleDrop(idx)}
                          dropAbove={showDropAbove}
                          dropBelow={showDropBelow}
                          isRowSelected={selectedRows.has(idx)}
                          onRowSelect={() => { setSelectedRows(new Set([idx])); setSelectedCell(null); setHighlightedCol(null) }}
                          selectedCol={selectedCell?.row === idx ? selectedCell.col : null}
                          highlightedCol={highlightedCol}
                          onSelectCell={(r, c) => { selectCell(r, c); setHighlightedCol(null) }}
                          onDeselectCell={deselectCell}
                          onClearCell={clearCellValue}
                        />
                      )
                    })}

                    {/* Empty grid rows (8 always visible below last filled) */}
                    {Array.from({ length: 8 }, (_, i) => {
                      const rowIdx = legs.length + i
                      const isActive = isAdding && activeEmptyRow === rowIdx
                      const isDisabled = hasRedErrors || (isAdding && activeEmptyRow !== rowIdx)

                      if (isActive) {
                        return (
                          <GridEntryRow
                            key={`empty-${rowIdx}`}
                            draft={draft}
                            setDraft={setDraft}
                            index={rowIdx}
                            operatorIataCode={operatorIataCode}
                            airportIataSet={airportIataSet}
                            onConfirm={confirmAddLeg}
                            onCancel={deactivateEmptyRow}
                            cellInputClass={cellInputClass}
                            validation={draftValidation}
                            focusField={focusField}
                            blockTimeMap={blockTimeMap}
                          />
                        )
                      }

                      return (
                        <FocusableEmptyRow
                          key={`empty-${rowIdx}`}
                          index={rowIdx}
                          onActivate={(field) => activateEmptyRow(rowIdx, field)}
                          disabled={isDisabled}
                        />
                      )
                    })}
                  </tbody>
                </table>

                {hasRedErrors && (
                  <p className="mt-2 text-xs text-red-500">Resolve errors before adding more legs or saving</p>
                )}

                {legs.length > 0 && (
                  <div className="mt-3 text-xs text-muted-foreground font-mono">
                    {chain}  |  {legs.length} leg{legs.length !== 1 ? 's' : ''}  |  {minutesToHHMM(totalBlock)} total  |  {durationLabel(routeDuration)}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="shrink-0 px-5 py-3 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center gap-2">
                <button
                  onClick={handleSaveRoute}
                  disabled={!isDirty || saving || hasRedErrors || legs.length === 0}
                  title={legs.length === 0 ? 'Add at least one leg before saving' : undefined}
                  className={cn(
                    'h-8 px-4 flex items-center gap-1.5 rounded-lg text-sm font-medium transition-colors',
                    isDirty && !saving && !hasRedErrors && legs.length > 0
                      ? 'bg-[#991b1b] text-white hover:bg-[#7f1d1d] cursor-pointer'
                      : 'bg-[#991b1b]/50 text-white/70 cursor-not-allowed'
                  )}>
                  {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {saving ? 'Saving...' : 'Save Route'}
                </button>
                {isDirty && (
                  <button onClick={() => setShowDiscardDialog(true)} disabled={saving}
                    className="h-8 px-4 flex items-center gap-1.5 rounded-lg border border-black/[0.1] dark:border-white/[0.1] text-sm font-medium text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-50">
                    <RotateCcw className="h-3.5 w-3.5" /> Discard
                  </button>
                )}
                {isDirty && (
                  <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 ml-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Unsaved changes
                  </span>
                )}
              </div>
            </div>

            {/* ── ROUTE TEMPLATES ── */}
            <RouteTemplatesSection templates={templates} onUseTemplate={handleUseTemplate} />
          </>
        ) : (
          <div className="flex-1 glass rounded-2xl flex items-center justify-center">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground/40" />
          </div>
        )}
      </div>

      {/* ═══ CREATE SCENARIO DIALOG ═══ */}
      <Dialog open={showCreateScenario} onOpenChange={setShowCreateScenario}>
        <DialogContent className="sm:max-w-[480px] p-0 border-0 bg-transparent shadow-none">
          <div style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(40px) saturate(180%)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', padding: 32 }}>
            <DialogHeader className="mb-6"><DialogTitle className="text-lg font-semibold">Create New Scenario</DialogTitle></DialogHeader>
            <div className="space-y-5">
              {/* Scenario No */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6b7280] mb-1.5">Scenario No.</label>
                <input type="text" readOnly value={nextScenarioNum}
                  className="w-full h-9 px-3 rounded-lg bg-[#f3f4f6] text-sm font-mono font-semibold text-[#374151] border border-black/[0.06] cursor-default" />
              </div>
              {/* Scenario Name */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6b7280] mb-1.5">Scenario Name</label>
                <div className="relative">
                  <input type="text" maxLength={20} placeholder="e.g. W25 Draft"
                    value={newScenario.name} onChange={e => setNewScenario(p => ({ ...p, name: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg border border-black/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-[#991b1b]/30 focus:border-[#991b1b]" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#9ca3af] tabular-nums">{newScenario.name.length}/20</span>
                </div>
              </div>
              {/* Period */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6b7280] mb-1.5">Period</label>
                <div className="flex items-center gap-2">
                  <input type="text" placeholder="DD/MM/YYYY" value={newScenario.from}
                    onChange={e => setNewScenario(p => ({ ...p, from: e.target.value, season: '' }))}
                    className="flex-1 h-9 px-3 rounded-lg border border-black/[0.08] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#991b1b]/30 focus:border-[#991b1b]" />
                  <span className="text-[#9ca3af] text-sm">—</span>
                  <input type="text" placeholder="DD/MM/YYYY" value={newScenario.to}
                    onChange={e => setNewScenario(p => ({ ...p, to: e.target.value, season: '' }))}
                    className="flex-1 h-9 px-3 rounded-lg border border-black/[0.08] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#991b1b]/30 focus:border-[#991b1b]" />
                  <input type="text" placeholder="W25" maxLength={3} value={newScenario.season}
                    onChange={e => {
                      const val = e.target.value.toUpperCase()
                      setNewScenario(p => ({ ...p, season: val }))
                      const parsed = parseSeasonCode(val)
                      if (parsed) {
                        setNewScenario(p => ({ ...p, season: val, from: fmtDateDisplay(parsed.start), to: fmtDateDisplay(parsed.end) }))
                      }
                    }}
                    className="w-[60px] h-9 px-2 rounded-lg border border-black/[0.08] text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-[#991b1b]/30 focus:border-[#991b1b]" />
                </div>
              </div>
              {/* Description */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6b7280] mb-1.5">Description</label>
                <div className="relative">
                  <input type="text" maxLength={100} placeholder="Brief description..."
                    value={newScenario.description} onChange={e => setNewScenario(p => ({ ...p, description: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg border border-black/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-[#991b1b]/30 focus:border-[#991b1b]" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#9ca3af] tabular-nums">{newScenario.description.length}/100</span>
                </div>
              </div>
              {/* Private toggle */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#374151]">Private</span>
                <button type="button" onClick={() => setNewScenario(p => ({ ...p, isPrivate: !p.isPrivate }))}
                  className={cn('relative w-10 h-[22px] rounded-full transition-colors duration-200', newScenario.isPrivate ? 'bg-[#34d399]' : 'bg-black/[0.08]')}>
                  <span className={cn('absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200', newScenario.isPrivate ? 'translate-x-[20px]' : 'translate-x-[2px]')} />
                </button>
                <span className="text-[12px] text-[#9ca3af]">Only you can see this scenario</span>
              </div>
            </div>
            {/* Buttons */}
            <div className="flex items-center justify-end gap-2 mt-8">
              <button onClick={() => setShowCreateScenario(false)}
                className="h-9 px-5 rounded-lg text-sm font-medium text-[#6b7280] hover:text-[#374151] transition-colors">
                Cancel
              </button>
              <button onClick={handleCreateScenario} disabled={scenarioLoading}
                className="h-9 px-5 rounded-lg bg-[#991b1b] text-white text-sm font-medium hover:bg-[#7f1d1d] transition-colors disabled:opacity-50">
                {scenarioLoading ? 'Creating...' : 'Create Scenario'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ SCENARIO LIST DIALOG ═══ */}
      <Dialog open={showScenarioList} onOpenChange={setShowScenarioList}>
        <DialogContent className="sm:max-w-[600px] p-0 border-0 bg-transparent shadow-none">
          <div style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(40px) saturate(180%)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', padding: 24 }}>
            <div className="flex items-center justify-between mb-4">
              <DialogTitle className="text-lg font-semibold">Scenarios</DialogTitle>
              <button onClick={() => { setShowScenarioList(false); openCreateScenarioDialog() }}
                className="h-7 px-3 flex items-center gap-1.5 rounded-lg bg-[#991b1b] text-white text-xs font-medium hover:bg-[#7f1d1d] transition-colors">
                <Plus className="h-3 w-3" /> Create New
              </button>
            </div>
            <div className="border border-black/[0.08] rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-[#f8f9fa]">
                    <th className="text-left px-3 py-2">No.</th>
                    <th className="text-left px-3 py-2">Name</th>
                    <th className="text-left px-3 py-2">Period</th>
                    <th className="text-center px-3 py-2">Routes</th>
                    <th className="w-[60px] px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground text-xs">No scenarios yet</td></tr>
                  ) : scenarios.map(s => (
                    <tr key={s.id}
                      onClick={() => { selectScenario(s); setShowScenarioList(false) }}
                      className={cn(
                        'cursor-pointer border-t border-black/[0.04] hover:bg-[#f3f4f6] transition-colors group',
                        selectedScenario?.id === s.id && 'bg-[#fef2f2]'
                      )}>
                      <td className="px-3 py-2 font-mono font-semibold text-xs">{s.scenario_number}</td>
                      <td className="px-3 py-2 text-xs">{s.scenario_name}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground font-mono">
                        {fmtDateDisplay(s.period_start).slice(0, 5)} — {fmtDateDisplay(s.period_end).slice(0, 5)}
                      </td>
                      <td className="px-3 py-2 text-center text-xs font-mono">{s.route_count}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {s.is_private && <span title="Private" className="text-[10px]">🔒</span>}
                          <span className={cn('w-2 h-2 rounded-full', s.status === 'published' ? 'bg-emerald-400' : 'bg-gray-300')} />
                          {s.route_count === 0 && (
                            <button onClick={e => { e.stopPropagation(); handleDeleteScenario(s.id) }}
                              className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-red-50 transition-all" title="Delete">
                              <Trash2 className="h-3 w-3 text-red-400 hover:text-red-600" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-muted-foreground">{scenarios.length} scenario{scenarios.length !== 1 ? 's' : ''}</span>
              <button onClick={() => setShowScenarioList(false)}
                className="h-8 px-4 rounded-lg border border-black/[0.08] text-xs font-medium hover:bg-black/5 transition-colors">
                Close
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ DIALOGS ═══ */}

      <Dialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <DialogContent className="glass-heavy max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" />{isNewRoute ? 'Discard New Route?' : 'Unsaved Changes'}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {isNewRoute
              ? 'You have an unsaved new route. Discard it?'
              : <>You have unsaved changes to <span className="font-mono font-semibold">{form?.routeName || 'this route'}</span>.</>}
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <button onClick={() => { setShowUnsavedDialog(false); pendingActionRef.current = null }} className="h-8 px-4 rounded-lg border border-black/[0.1] dark:border-white/[0.1] text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 transition-colors">Cancel</button>
            <button onClick={handleDiscardAndSwitch} className="h-8 px-4 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors">Discard</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <DialogContent className="glass-heavy max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" />Route has warnings</DialogTitle></DialogHeader>
          <div className="space-y-1.5 py-1">
            {saveWarnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-amber-500 shrink-0">{'\u26a0\ufe0f'}</span><span>{w}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Save anyway?</p>
          <DialogFooter className="gap-2 sm:gap-2">
            <button onClick={() => setShowWarningDialog(false)} className="h-8 px-4 rounded-lg border border-black/[0.1] dark:border-white/[0.1] text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 transition-colors">Cancel</button>
            <button onClick={executeSave} disabled={saving} className="h-8 px-4 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50">{saving ? 'Saving...' : 'Save with Warnings'}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <DialogContent className="glass-heavy max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><RotateCcw className="h-5 w-5 text-muted-foreground" />Discard Changes</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Discard all unsaved changes to <span className="font-mono font-semibold">{form?.routeName || 'this route'}</span>?</p>
          <DialogFooter className="gap-2 sm:gap-2">
            <button onClick={() => setShowDiscardDialog(false)} className="h-8 px-4 rounded-lg border border-black/[0.1] dark:border-white/[0.1] text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 transition-colors">Keep Editing</button>
            <button onClick={discardChanges} className="h-8 px-4 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors">Discard</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="glass-heavy max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Trash2 className="h-5 w-5 text-red-500" />Delete Route</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Delete route <span className="font-mono font-semibold">{form?.routeName || 'Untitled'}</span> and all its legs?</p>
            <p className="text-xs text-muted-foreground/70">Builder-created flights will be removed. SSIM-imported flights will be unlinked. This action cannot be undone.</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <button onClick={() => setShowDeleteDialog(false)} className="h-8 px-4 rounded-lg border border-black/[0.1] dark:border-white/[0.1] text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 transition-colors">Cancel</button>
            <button onClick={handleDeleteRoute} disabled={saving} className="h-8 px-4 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50">{saving ? 'Deleting...' : 'Delete'}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <DialogContent className="glass-heavy max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2">
            {form?.status === 'published' ? <RotateCcw className="h-5 w-5 text-muted-foreground" /> : <Plane className="h-5 w-5 text-emerald-500" />}
            {form?.status === 'published' ? 'Unpublish Route' : 'Publish Route'}
          </DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {form?.status === 'published' ? 'Revert this route and its flights to draft status?' : 'Publish this route? Published routes are active in the schedule.'}
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <button onClick={() => setShowPublishDialog(false)} className="h-8 px-4 rounded-lg border border-black/[0.1] dark:border-white/[0.1] text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 transition-colors">Cancel</button>
            <button onClick={handlePublishRoute} disabled={saving}
              className={cn('h-8 px-4 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50',
                form?.status === 'published' ? 'bg-gray-600 hover:bg-gray-700' : 'bg-emerald-600 hover:bg-emerald-700')}>
              {saving ? 'Updating...' : form?.status === 'published' ? 'Unpublish' : 'Publish'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

// ─── Validation Tooltip ──────────────────────────────────────

function ValidationTooltip({
  children, legIndex, flightLabel, validation, duplicateLine,
}: {
  children: React.ReactNode
  legIndex: number
  flightLabel: string
  validation: LegValidation
  duplicateLine?: string
}) {
  return (
    <div className="relative group/tip inline-flex items-center justify-center">
      {children}
      <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover/tip:opacity-100 group-hover/tip:pointer-events-auto transition-opacity duration-150 z-50">
        <div className="glass-heavy rounded-xl p-3 shadow-lg min-w-[240px] max-w-[300px]">
          <div className="text-[12px] font-medium text-foreground mb-2">
            Leg {legIndex + 1} — {flightLabel}
          </div>
          <div className="space-y-1 text-[12px] text-muted-foreground">
            <div>{statusIcon(validation.sequence.status)} Sequence: {validation.sequence.message}</div>
            <div>{statusIcon(validation.tat.status)} {validation.tat.message}</div>
            <div>{statusIcon(validation.block.status)} {validation.block.message}</div>
            {duplicateLine ? (
              <div>{duplicateLine}</div>
            ) : (
              <div>{'\u2705'} No duplicates</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusIconForOverall({ overall }: { overall: 'green' | 'yellow' | 'red' }) {
  if (overall === 'red') return (
    <div style={{ animation: 'pulse 2s ease-in-out infinite' }}><StatusRed /></div>
  )
  if (overall === 'yellow') return <StatusYellow />
  return <StatusGreen />
}

// ─── Editable Leg Row ─────────────────────────────────────────

function LegRow({
  leg, index, flightLabel, validation,
  editingCell, editValue, onStartEdit, onEditChange, onCommitEdit, onCancelEdit,
  operatorIataCode, airportIataSet, cellInputClass,
  onDragStart, onDragEnd, onDragOver, onDrop, dropAbove, dropBelow,
  isRowSelected, onRowSelect,
  selectedCol, highlightedCol, onSelectCell, onDeselectCell, onClearCell,
}: {
  leg: LegWithOffsets
  index: number
  flightLabel: string
  validation: LegValidation
  editingCell: { legId: string; field: string } | null
  editValue: string
  onStartEdit: (legId: string, field: string, value: string) => void
  onEditChange: (v: string) => void
  onCommitEdit: () => void
  onCancelEdit: () => void
  operatorIataCode: string
  airportIataSet: Set<string>
  cellInputClass: string
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  dropAbove: boolean
  dropBelow: boolean
  isRowSelected: boolean
  onRowSelect: () => void
  selectedCol: number | null
  highlightedCol: number | null
  onSelectCell: (row: number, col: number) => void
  onDeselectCell: () => void
  onClearCell: (row: number, col: number) => void
}) {
  const isEditing = (field: string) => editingCell?.legId === leg.id && editingCell?.field === field
  const isCellSelected = (col: number) => selectedCol === col && !editingCell

  // Shared keyboard handler for SELECTED mode (non-editable cells like Block use this too)
  const handleSelectedKeyDown = (e: React.KeyboardEvent, col: number) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault()
      const dr = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
      const dc = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
      onSelectCell(index + dr, col + dc)
      return
    }
    if (e.key === 'Tab') { e.preventDefault(); onSelectCell(index, e.shiftKey ? col - 1 : col + 1); return }
    if (e.key === 'Escape') { e.preventDefault(); onDeselectCell(); return }
  }

  // Returns outline style for a <td> based on selection/editing/highlight state
  function cellOutlineStyle(colIdx: number, field?: string): React.CSSProperties | undefined {
    if (field && isEditing(field)) {
      return { outline: '2px solid #991b1b', outlineOffset: '-2px', background: '#fff' }
    }
    if (isCellSelected(colIdx)) {
      return { outline: '2px solid #991b1b', outlineOffset: '-2px', background: '#fef2f2' }
    }
    if (highlightedCol === colIdx) {
      return { outline: '2px solid #991b1b', outlineOffset: '-2px', background: '#fef2f2' }
    }
    return undefined
  }

  function renderEditableCell(field: string, displayValue: string, rawValue: string, colIdx: number, extraClass?: string) {
    // ── EDITING MODE: actual input with cursor ──
    if (isEditing(field)) {
      return (
        <input autoFocus value={editValue}
          data-grid-row={index} data-grid-col={colIdx}
          onChange={e => onEditChange(field === 'dep_station' || field === 'arr_station' ? e.target.value.toUpperCase() : e.target.value)}
          onFocus={e => { const el = e.target; setTimeout(() => el.setSelectionRange(el.value.length, el.value.length), 0) }}
          onBlur={onCommitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Tab') { e.preventDefault(); onCommitEdit(); onSelectCell(index, e.shiftKey ? colIdx - 1 : colIdx + 1); return }
            if (e.key === 'Enter') { e.preventDefault(); onCommitEdit(); onSelectCell(index + 1, colIdx); return }
            if (e.key === 'Escape') {
              e.preventDefault(); onCancelEdit()
              setTimeout(() => { const el = document.querySelector<HTMLElement>(`[data-grid-row="${index}"][data-grid-col="${colIdx}"]`); if (el) el.focus() }, 0)
              return
            }
          }}
          className={cn('w-full h-full bg-transparent border-none outline-none text-[13px] font-mono tabular-nums', extraClass)}
          style={{ textAlign: 'center' }} />
      )
    }

    // ── SELECTED MODE: highlighted cell, keyboard navigation ──
    if (isCellSelected(colIdx)) {
      return (
        <div
          tabIndex={0}
          data-grid-row={index} data-grid-col={colIdx}
          onKeyDown={(e) => {
            if (e.key === 'F2' || e.key === 'Enter') { e.preventDefault(); onStartEdit(leg.id, field, rawValue); return }
            if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onClearCell(index, colIdx); return }
            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
              e.preventDefault()
              const initial = field === 'dep_station' || field === 'arr_station' ? e.key.toUpperCase() : e.key
              onStartEdit(leg.id, field, initial)
              return
            }
            handleSelectedKeyDown(e, colIdx)
          }}
          onDoubleClick={() => onStartEdit(leg.id, field, rawValue)}
          className={cn('w-full h-full flex items-center justify-center outline-none select-none cursor-default', extraClass)}
        >
          {displayValue || '\u2014'}
        </div>
      )
    }

    // ── NORMAL MODE ──
    const invalid = (field === 'dep_station' || field === 'arr_station') && displayValue.length === 3 && !airportIataSet.has(displayValue)
    return (
      <span className={cn(
          invalid && 'text-red-500 underline decoration-red-300 decoration-wavy underline-offset-2',
          extraClass)}>
        {displayValue || '\u2014'}
      </span>
    )
  }

  // Render a selectable (but not editable) cell — used for Block column
  function renderSelectableCell(displayValue: string, colIdx: number) {
    if (isCellSelected(colIdx)) {
      return (
        <div
          tabIndex={0}
          data-grid-row={index} data-grid-col={colIdx}
          onKeyDown={(e) => handleSelectedKeyDown(e, colIdx)}
          className="w-full h-full flex items-center justify-center outline-none select-none cursor-default"
        >
          {displayValue}
        </div>
      )
    }
    return displayValue
  }

  // Click handler for <td> — selects the cell (works on any click target within the td)
  function cellClick(colIdx: number, e: React.MouseEvent) {
    // Don't re-select if already editing this cell (let the input handle clicks)
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT') return
    e.stopPropagation()
    onSelectCell(index, colIdx)
  }

  const bdr = 'border border-black/[0.08] dark:border-white/[0.08]'
  return (
    <tr
      data-draggable-row
      className={cn('group hover:bg-blue-50/50 dark:hover:bg-white/[0.02] transition-colors h-[36px] relative')}
      style={{
        ...(isRowSelected ? { outline: '2px solid #991b1b', outlineOffset: '-2px', background: '#fef2f2' } : {}),
        ...(dropAbove ? { boxShadow: 'inset 0 2px 0 0 #991b1b' } : dropBelow ? { boxShadow: 'inset 0 -2px 0 0 #991b1b' } : {}),
      }}
      draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onDragOver={onDragOver} onDrop={onDrop}
    >
      <td className={cn(bdr, 'py-1 text-center text-[12px] font-mono text-muted-foreground tabular-nums cursor-pointer')}
        onClick={onRowSelect}>{index + 1}</td>
      <td className={cn(bdr, 'text-center text-[12px] font-mono tabular-nums p-0 cursor-cell')} style={cellOutlineStyle(0, 'day_offset')} onClick={e => cellClick(0, e)}>
        {renderEditableCell('day_offset', `D+${leg._dayOffset}`, String(leg._dayOffset), 0,
          cn('text-center', leg._dayOffsetManual ? 'font-bold text-foreground' : 'text-muted-foreground/60'))}
      </td>
      <td className={cn(bdr, 'text-center font-mono font-bold tabular-nums p-0 cursor-cell')} style={cellOutlineStyle(1, 'flight_number')} onClick={e => cellClick(1, e)}>
        {renderEditableCell('flight_number', flightLabel, leg.flight_number != null ? String(leg.flight_number) : '', 1, 'font-bold')}
      </td>
      <td className={cn(bdr, 'text-center font-mono tabular-nums p-0 cursor-cell')} style={cellOutlineStyle(2, 'dep_station')} onClick={e => cellClick(2, e)}>
        {renderEditableCell('dep_station', leg.dep_station, leg.dep_station, 2)}
      </td>
      <td className={cn(bdr, 'text-center font-mono tabular-nums p-0 cursor-cell')} style={cellOutlineStyle(3, 'arr_station')} onClick={e => cellClick(3, e)}>
        {renderEditableCell('arr_station', leg.arr_station, leg.arr_station, 3)}
      </td>
      <td className={cn(bdr, 'text-center font-mono tabular-nums p-0 cursor-cell')} style={cellOutlineStyle(4, 'std_local')} onClick={e => cellClick(4, e)}>
        {renderEditableCell('std_local', leg.std_local, leg.std_local, 4)}
      </td>
      <td className={cn(bdr, 'text-center font-mono tabular-nums p-0 cursor-cell')} style={cellOutlineStyle(5, 'sta_local')} onClick={e => cellClick(5, e)}>
        {renderEditableCell('sta_local', leg.sta_local, leg.sta_local, 5)}
        {!isEditing('sta_local') && !isCellSelected(5) && leg._arrivesNextDay && (
          <sup className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 ml-0.5">+1</sup>
        )}
      </td>
      <td className={cn(bdr, 'text-center font-mono tabular-nums text-muted-foreground p-0 cursor-cell')} style={cellOutlineStyle(6)} onClick={e => cellClick(6, e)}>
        {renderSelectableCell(minutesToHHMM(leg.block_minutes || 0), 6)}
      </td>
      <td className={cn(bdr, 'text-center font-mono tabular-nums text-muted-foreground/70 text-[12px] p-0 cursor-cell')} style={cellOutlineStyle(7, 'service_type')} onClick={e => cellClick(7, e)}>
        {renderEditableCell('service_type', leg.service_type || 'J', leg.service_type || 'J', 7)}
      </td>
      <td className={cn(bdr, 'py-1')}>
        <div className="flex items-center justify-center">
          {validation && (
            <ValidationTooltip legIndex={index} flightLabel={flightLabel} validation={validation}>
              <StatusIconForOverall overall={validation.overall} />
            </ValidationTooltip>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Focusable Empty Grid Row ─────────────────────────────────

function FocusableEmptyRow({ index, onActivate, disabled }: {
  index: number
  onActivate: (field?: string) => void
  disabled: boolean
}) {
  const bdr = 'border border-black/[0.08] dark:border-white/[0.08]'
  const ghostInput = 'bg-transparent outline-none font-mono tabular-nums text-transparent placeholder:text-[#d1d5db] dark:placeholder:text-[#4b5563] cursor-text w-full text-center'

  const handleFocus = (field: string) => {
    if (!disabled) onActivate(field)
  }

  return (
    <tr
      className={cn('h-[36px]', disabled ? 'opacity-30' : 'cursor-text hover:bg-blue-50/30 dark:hover:bg-white/[0.01]')}
    >
      <td className={cn(bdr, 'py-1 text-center text-[12px] font-mono text-[#d1d5db] dark:text-[#4b5563] tabular-nums')}>{index + 1}</td>
      <td className={cn(bdr, 'py-1 text-center font-mono text-[#d1d5db] dark:text-[#4b5563] select-none')}>&middot;&middot;&middot;</td>
      <td className={cn(bdr, 'py-1 pl-2')}>
        <input type="text" readOnly tabIndex={disabled ? -1 : legTabIndex(index, 1)}
          data-grid-row={index} data-grid-col={1}
          onFocus={() => handleFocus('flightNumber')}
          placeholder="&middot;&middot;&middot;&middot;&middot;&middot;&middot;"
          className={cn(ghostInput, 'text-left w-[60px]')} />
      </td>
      <td className={cn(bdr, 'py-1 text-center')}>
        <input type="text" readOnly tabIndex={-1}
          data-grid-row={index} data-grid-col={2}
          onFocus={() => handleFocus('depStation')}
          placeholder="&middot;&middot;&middot;"
          className={cn(ghostInput, 'w-[40px]')} />
      </td>
      <td className={cn(bdr, 'py-1 text-center')}>
        <input type="text" readOnly tabIndex={-1}
          data-grid-row={index} data-grid-col={3}
          onFocus={() => handleFocus('arrStation')}
          placeholder="&middot;&middot;&middot;"
          className={cn(ghostInput, 'w-[40px]')} />
      </td>
      <td className={cn(bdr, 'py-1 text-center')}>
        <input type="text" readOnly tabIndex={-1}
          data-grid-row={index} data-grid-col={4}
          onFocus={() => handleFocus('stdLocal')}
          placeholder="&middot;&middot;:&middot;&middot;"
          className={cn(ghostInput, 'w-[45px]')} />
      </td>
      <td className={cn(bdr, 'py-1 text-center')}>
        <input type="text" readOnly tabIndex={-1}
          data-grid-row={index} data-grid-col={5}
          onFocus={() => handleFocus('staLocal')}
          placeholder="&middot;&middot;:&middot;&middot;"
          className={cn(ghostInput, 'w-[45px]')} />
      </td>
      <td className={cn(bdr, 'py-1 text-center font-mono text-[#d1d5db] dark:text-[#4b5563] select-none')}>&middot;&middot;:&middot;&middot;</td>
      <td className={cn(bdr, 'py-1 text-center font-mono text-[#d1d5db] dark:text-[#4b5563] select-none')}>&middot;</td>
      <td className={cn(bdr, 'py-1')}><div className="flex items-center justify-center"><StatusGray /></div></td>
      <td className={cn(bdr, 'py-1')}></td>
    </tr>
  )
}

// ─── Grid Entry Row (active editing) ──────────────────────────

function GridEntryRow({
  draft, setDraft, index, operatorIataCode, airportIataSet, onConfirm, onCancel, cellInputClass, validation, focusField, blockTimeMap,
}: {
  draft: NewLegDraft
  setDraft: React.Dispatch<React.SetStateAction<NewLegDraft>>
  index: number
  operatorIataCode: string
  airportIataSet: Set<string>
  onConfirm: () => void
  onCancel: () => void
  cellInputClass: string
  validation: LegValidation | null
  focusField: string | null
  blockTimeMap: Map<string, number>
}) {
  const fltRef = useRef<HTMLInputElement>(null!)
  const depRef = useRef<HTMLInputElement>(null!)
  const arrRef = useRef<HTMLInputElement>(null!)
  const stdRef = useRef<HTMLInputElement>(null!)
  const staRef = useRef<HTMLInputElement>(null!)
  const blockRef = useRef<HTMLInputElement>(null!)
  const svcRef = useRef<HTMLInputElement>(null!)

  useEffect(() => {
    const timer = setTimeout(() => {
      switch (focusField) {
        case 'depStation': depRef.current?.focus(); break
        case 'arrStation': arrRef.current?.focus(); break
        case 'stdLocal': stdRef.current?.focus(); break
        case 'staLocal': staRef.current?.focus(); break
        default: fltRef.current?.focus(); break
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [focusField])

  // Auto-suggest STA from block time lookup when DEP+ARR+STD are filled
  useEffect(() => {
    const dep = draft.depStation.toUpperCase()
    const arr = draft.arrStation.toUpperCase()
    const stdNorm = normalizeTime(draft.stdLocal)
    if (dep.length === 3 && arr.length === 3 && isValidTime(stdNorm) && (!draft.staLocal || draft._autoFilledSta)) {
      const blockMin = blockTimeMap.get(`${dep}-${arr}`)
      if (blockMin && blockMin > 0) {
        const stdMin = timeToMinutes(stdNorm)
        const staMin = (stdMin + blockMin) % 1440
        setDraft(d => ({ ...d, staLocal: minutesToTimeStr(staMin), _autoFilledSta: true }))
      }
    }
  }, [draft.depStation, draft.arrStation, draft.stdLocal, draft._autoFilledSta, blockTimeMap, setDraft])

  const arrowNav = (e: React.KeyboardEvent, col: number): boolean => {
    if (e.key === 'ArrowDown') { e.preventDefault(); focusGridCell(index + 1, col); return true }
    if (e.key === 'ArrowUp' && index > 0) { e.preventDefault(); focusGridCell(index - 1, col); return true }
    if (e.key === 'ArrowLeft') { e.preventDefault(); focusGridCell(index, col - 1); return true }
    if (e.key === 'ArrowRight') { e.preventDefault(); focusGridCell(index, col + 1); return true }
    return false
  }

  const handleKeyDown = (e: React.KeyboardEvent, col: number) => {
    if (arrowNav(e, col)) return
    if (e.key === 'Enter') { e.preventDefault(); onConfirm() }
    if (e.key === 'Escape') { e.preventDefault(); onCancel() }
  }

  // Tab from STA → move to Block field (which then confirms on Tab)
  const handleStaKeyDown = (e: React.KeyboardEvent) => {
    if (arrowNav(e, 5)) return
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      if (draft.staLocal) {
        setDraft(d => ({ ...d, staLocal: normalizeTime(d.staLocal) }))
      }
      blockRef.current?.focus()
    }
    if (e.key === 'Enter') { e.preventDefault(); onConfirm() }
    if (e.key === 'Escape') { e.preventDefault(); onCancel() }
  }

  // Tab from Block → move to Svc
  const handleBlockKeyDown = (e: React.KeyboardEvent) => {
    if (arrowNav(e, 6)) return
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      svcRef.current?.focus()
    }
    if (e.key === 'Enter') { e.preventDefault(); onConfirm() }
    if (e.key === 'Escape') { e.preventDefault(); onCancel() }
  }

  // Tab from Svc → confirm leg and activate next row
  const handleSvcKeyDown = (e: React.KeyboardEvent) => {
    if (arrowNav(e, 7)) return
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      if (draft.flightNumber || draft.arrStation) {
        onConfirm()
      }
    }
    if (e.key === 'Enter') { e.preventDefault(); onConfirm() }
    if (e.key === 'Escape') { e.preventDefault(); onCancel() }
  }

  const update = (patch: Partial<NewLegDraft>) => {
    setDraft(d => ({ ...d, ...patch, _errors: {}, _duplicateError: null }))
  }

  const blockMin = computeBlockMinutes(normalizeTime(draft.stdLocal), normalizeTime(draft.staLocal))
  const depInvalid = draft.depStation.length === 3 && !airportIataSet.has(draft.depStation.toUpperCase())
  const arrInvalid = draft.arrStation.length === 3 && !airportIataSet.has(draft.arrStation.toUpperCase())
  const errBorder = (field: string) => draft._errors[field] ? 'border-red-400 dark:border-red-500' : ''

  const fltLabel = draft.flightNumber ? `${operatorIataCode}${draft.flightNumber}` : '...'
  const dupLine = draft._duplicateError
    ? `\u274c ${draft._duplicateError.replace(/^\u274c\s*/, '')}`
    : undefined

  const bdr = 'border border-black/[0.08] dark:border-white/[0.08]'
  return (
    <>
      <tr className="h-[36px] bg-blue-50 dark:bg-blue-950/20 border-l-[3px] border-l-[#991b1b]">
        <td className={cn(bdr, 'py-1 text-center text-[12px] font-mono text-muted-foreground/50 tabular-nums')}>{index + 1}</td>
        <td className={cn(bdr, 'py-1 text-center text-[12px] font-mono text-muted-foreground/40 tabular-nums')}>D+?</td>

        <td className={cn(bdr, 'py-1 pl-2')}>
          <div className="flex items-center gap-0.5">
            <span className="text-[11px] text-muted-foreground/50 font-mono">{operatorIataCode}</span>
            <input ref={fltRef} type="text" value={draft.flightNumber} tabIndex={legTabIndex(index, 1)}
              data-grid-row={index} data-grid-col={1}
              onChange={e => update({ flightNumber: e.target.value.replace(/\D/g, '') })}
              onFocus={e => e.target.select()}
              onKeyDown={e => handleKeyDown(e, 1)} placeholder="121"
              className={cn(cellInputClass, 'w-[50px] font-bold', errBorder('flightNumber'))} />
          </div>
        </td>

        <td className={cn(bdr, 'py-1 text-center')}>
          <input ref={depRef} type="text" value={draft.depStation} tabIndex={legTabIndex(index, 2)}
            data-grid-row={index} data-grid-col={2}
            onChange={e => update({ depStation: e.target.value.toUpperCase().slice(0, 3), _autoFilledDep: false })}
            onFocus={e => { if (draft._autoFilledDep) e.target.select() }}
            onKeyDown={e => handleKeyDown(e, 2)} placeholder="DEP" maxLength={3}
            className={cn(cellInputClass, 'w-[45px] text-center', errBorder('depStation'),
              draft._autoFilledDep && 'italic text-[#9ca3af]', depInvalid && 'text-red-500')} />
        </td>

        <td className={cn(bdr, 'py-1 text-center')}>
          <input ref={arrRef} type="text" value={draft.arrStation} tabIndex={legTabIndex(index, 3)}
            data-grid-row={index} data-grid-col={3}
            onChange={e => update({ arrStation: e.target.value.toUpperCase().slice(0, 3) })}
            onFocus={e => e.target.select()}
            onKeyDown={e => handleKeyDown(e, 3)} placeholder="ARR" maxLength={3}
            className={cn(cellInputClass, 'w-[45px] text-center', errBorder('arrStation'), arrInvalid && 'text-red-500')} />
        </td>

        <td className={cn(bdr, 'py-1 text-center')}>
          <input ref={stdRef} type="text" value={draft.stdLocal} tabIndex={legTabIndex(index, 4)}
            data-grid-row={index} data-grid-col={4}
            onChange={e => update({ stdLocal: e.target.value, _autoFilledStd: false })}
            onFocus={e => { if (draft._autoFilledStd) e.target.select() }}
            onBlur={() => { if (draft.stdLocal) update({ stdLocal: normalizeTime(draft.stdLocal) }) }}
            onKeyDown={e => handleKeyDown(e, 4)} placeholder="HH:MM"
            className={cn(cellInputClass, 'w-[50px] text-center', errBorder('stdLocal'),
              draft._autoFilledStd && 'italic text-[#9ca3af]')} />
        </td>

        <td className={cn(bdr, 'py-1 text-center')}>
          <input ref={staRef} type="text" value={draft.staLocal} tabIndex={legTabIndex(index, 5)}
            data-grid-row={index} data-grid-col={5}
            onChange={e => update({ staLocal: e.target.value, _autoFilledSta: false })}
            onFocus={e => { if (draft._autoFilledSta) e.target.select() }}
            onBlur={() => { if (draft.staLocal) update({ staLocal: normalizeTime(draft.staLocal) }) }}
            onKeyDown={handleStaKeyDown} placeholder="HH:MM"
            className={cn(cellInputClass, 'w-[50px] text-center', errBorder('staLocal'),
              draft._autoFilledSta && 'italic text-[#9ca3af]')} />
        </td>

        <td className={cn(bdr, 'py-1 text-center')}>
          <input ref={blockRef} type="text" readOnly tabIndex={legTabIndex(index, 6)}
            data-grid-row={index} data-grid-col={6}
            value={blockMin > 0 ? minutesToHHMM(blockMin) : '--:--'}
            onKeyDown={handleBlockKeyDown}
            className="bg-transparent outline-none font-mono tabular-nums text-muted-foreground/50 w-[45px] text-center cursor-default focus:ring-1 focus:ring-primary/30 rounded" />
        </td>

        <td className={cn(bdr, 'py-1 text-center')}>
          <input ref={svcRef} type="text" value={draft.serviceType} tabIndex={legTabIndex(index, 7)}
            data-grid-row={index} data-grid-col={7}
            onChange={e => update({ serviceType: e.target.value.toUpperCase().slice(0, 1) })}
            onFocus={e => e.target.select()}
            onKeyDown={handleSvcKeyDown} placeholder="J" maxLength={1}
            className={cn(cellInputClass, 'w-[25px] text-center text-[12px]')} />
        </td>

        <td className={cn(bdr, 'py-1')}>
          <div className="flex items-center justify-center">
            {validation ? (
              <ValidationTooltip legIndex={index} flightLabel={fltLabel} validation={validation} duplicateLine={dupLine}>
                <StatusIconForOverall overall={validation.overall} />
              </ValidationTooltip>
            ) : (
              <StatusGray />
            )}
          </div>
        </td>

        <td className={cn(bdr, 'py-1')}>
          <div className="flex items-center justify-center">
            <button onClick={onCancel} disabled={draft._checking} tabIndex={-1} className="text-muted-foreground/40 hover:text-red-500 transition-colors disabled:opacity-30" title="Cancel">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>

      {(draft._duplicateError || draft._checking) && (
        <tr className="bg-blue-50 dark:bg-blue-950/20">
          <td colSpan={11} className={cn(bdr, 'py-0 pb-1.5')}>
            <div className="pl-[60px] pr-4">
              {draft._checking ? (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <RefreshCw className="h-3 w-3 animate-spin" /> Checking for duplicates…
                </span>
              ) : draft._duplicateError ? (
                <p className="text-[11px] text-red-600 dark:text-red-400 leading-snug">{draft._duplicateError}</p>
              ) : null}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Route Templates Section ─────────────────────────────────

function RouteTemplatesSection({
  templates, onUseTemplate,
}: {
  templates: RouteTemplate[]
  onUseTemplate: (tmpl: RouteTemplate) => void
}) {
  return (
    <div className="shrink-0 glass rounded-2xl px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-medium text-muted-foreground">Route Templates</h3>
      </div>
      {templates.length === 0 ? (
        <p className="text-xs text-muted-foreground/50 py-2">Saved routes will appear here as templates</p>
      ) : (
        <div className="grid gap-2 overflow-hidden" style={{ gridTemplateColumns: 'repeat(4, 220px)', maxHeight: '124px' }}>
          {templates.slice(0, 8).map(tmpl => (
            <button
              key={`${tmpl.chain}-${tmpl.aircraft_type_icao || ''}`}
              onClick={() => onUseTemplate(tmpl)}
              className="w-[220px] rounded-xl px-3 py-2.5 text-left transition-all duration-150 bg-white/40 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.06] hover:border-black/[0.12] dark:hover:border-white/[0.12] hover:shadow-sm"
            >
              <div className="text-[12px] font-mono font-medium truncate mb-0.5">{tmpl.chain}</div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 tabular-nums">
                <span>{tmpl.leg_count} leg{tmpl.leg_count !== 1 ? 's' : ''}</span>
                {tmpl.aircraft_type_icao && <span className="font-mono">{tmpl.aircraft_type_icao}</span>}
                <span>{minutesToHHMM(tmpl.total_block_minutes)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Route Item (left panel) ──────────────────────────────────

function RouteItem({ route, isSelected, onClick }: { route: AircraftRoute; isSelected: boolean; onClick: () => void }) {
  const chainDash = route.chain ? route.chain.replace(/ \u2192 /g, '-') : 'No legs'
  return (
    <button onClick={onClick}
      className={cn('w-full text-left rounded-xl px-2 py-2 transition-all duration-150',
        isSelected ? 'bg-[#991b1b]/10 dark:bg-[#991b1b]/20 border-l-[3px] border-l-[#991b1b]'
          : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.05] border-l-[3px] border-l-transparent')}>
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={cn('text-[13px] font-semibold font-mono truncate', isSelected ? 'text-[#991b1b]' : 'text-[#111827] dark:text-foreground')}>
            {route.route_name || `Route ${route.route_number}`}
          </span>
          {route.status === 'published' && <div className="w-[5px] h-[5px] rounded-full bg-emerald-500 shrink-0" title="Published" />}
        </div>
        <div className="flex items-center gap-[2px] shrink-0 ml-2">
          {DOW_LABELS.map((label, i) => (
            <div key={i} className={cn(
              'w-[16px] h-[16px] rounded-full text-[8px] font-semibold leading-none flex items-center justify-center',
              isDayActive(route.days_of_operation, i)
                ? 'bg-[#991b1b] text-white'
                : 'text-[#d1d5db] dark:text-[#4b5563]'
            )}>{label}</div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-[#6b7280] font-mono truncate">{chainDash}</span>
        <span className="text-[12px] text-[#6b7280] tabular-nums whitespace-nowrap ml-2 shrink-0">
          {route.legs.length} leg{route.legs.length !== 1 ? 's' : ''} {minutesToHHMM(route.total_block_minutes)}
        </span>
      </div>
    </button>
  )
}
