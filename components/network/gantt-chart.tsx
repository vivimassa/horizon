'use client'

import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Plane,
  PlaneTakeoff,
  Clock,
  Calendar,
  MapPin,
  X,
  AlertTriangle,
  Sparkles,
  Timer,
  Link2,
  ExternalLink,
  PenLine,
  Trash2,
  Settings2,
  Search,
  Unlink,
  ArrowRight,
} from 'lucide-react'
import { AircraftWithRelations } from '@/app/actions/aircraft-registrations'
import { AircraftType, AircraftSeatingConfig, CabinEntry, Airport, FlightServiceType } from '@/types/database'
import { getGanttFlights, GanttFlight, getRouteWithLegs, deleteSingleFlight, assignFlightsToAircraft, unassignFlightsTail, getFlightTailAssignments, type GanttRouteData, type FlightDateItem, type TailAssignmentRow } from '@/app/actions/gantt'
import { deleteRoute } from '@/app/actions/aircraft-routes'
import { toast } from '@/components/ui/visionos-toast'
import { friendlyError } from '@/lib/utils/error-handler'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { MiniBuilderModal } from './gantt-mini-builder'
import { autoAssignFlights, type AssignableAircraft, type TailAssignmentResult } from '@/lib/utils/tail-assignment'
import { useGanttSettings } from '@/lib/hooks/use-gantt-settings'
import { type GanttSettingsData } from '@/lib/constants/gantt-settings'
import { getBarTextColor } from '@/lib/utils/color-helpers'
import { GanttSettingsPanel } from './gantt-settings-panel'
import { useGanttClipboard } from '@/lib/hooks/use-gantt-clipboard'
import { useGanttDrag, type RowLayoutItem, type PendingDrop } from '@/lib/hooks/use-gantt-drag'
import { GanttClipboardPill } from './gantt-clipboard-pill'
import { GanttPasteTargetDialog } from './gantt-paste-target-dialog'
import { GanttPasteModal } from './gantt-paste-modal'
import { GanttWorkspaceIndicator } from './gantt-workspace-indicator'

// ─── Types & Constants ───────────────────────────────────────────────────

type ZoomLevel = '1D' | '2D' | '3D' | '4D' | '5D' | '6D' | '7D' | '14D' | '28D' | 'M' | '3M' | '6M' | '1Y'

const ZOOM_CONFIG: Record<ZoomLevel, { hoursPerTick: number; days: number }> = {
  '1D':  { hoursPerTick: 1,  days: 1 },
  '2D':  { hoursPerTick: 2,  days: 2 },
  '3D':  { hoursPerTick: 2,  days: 3 },
  '4D':  { hoursPerTick: 3,  days: 4 },
  '5D':  { hoursPerTick: 4,  days: 5 },
  '6D':  { hoursPerTick: 6,  days: 6 },
  '7D':  { hoursPerTick: 6,  days: 7 },
  '14D': { hoursPerTick: 12, days: 14 },
  '28D': { hoursPerTick: 24, days: 28 },
  'M':   { hoursPerTick: 24, days: 31 },
  '3M':  { hoursPerTick: 168, days: 91 },
  '6M':  { hoursPerTick: 336, days: 182 },
  '1Y':  { hoursPerTick: 720, days: 365 },
}

const ZOOM_GROUP_DAYS: ZoomLevel[] = ['1D', '2D', '3D', '4D', '5D', '6D', '7D']
const ZOOM_GROUP_WIDE: ZoomLevel[] = ['14D', '28D', 'M', '3M', '6M', '1Y']

// ─── Row height levels (vertical zoom) ────────────────────────────────
const ROW_HEIGHT_LEVELS = [
  { label: 'compact', rowH: 28, barH: 18, fontSize: 8 },
  { label: 'default', rowH: 38, barH: 26, fontSize: 9.5 },
  { label: 'large',   rowH: 52, barH: 36, fontSize: 11 },
  { label: 'xlarge',  rowH: 68, barH: 48, fontSize: 12 },
] as const

const MIN_PPH = 0.3 // minimum pixels-per-hour to keep bars visible

interface ExpandedFlight {
  id: string
  flightId: string
  flightNumber: string
  depStation: string
  arrStation: string
  stdLocal: string
  staLocal: string
  blockMinutes: number
  status: string
  aircraftTypeIcao: string | null
  date: Date
  stdMinutes: number
  staMinutes: number
  daysOfOperation: string
  periodStart: string
  periodEnd: string
  routeType: string | null
  routeId: string | null
  seasonId: string | null
  /** DB-persisted aircraft registration (manual assignment) */
  aircraftReg: string | null
  /** Departure day offset within route (0 = first day, 1 = next day, etc.) */
  dayOffset: number
  /** Virtual tail assignment — null if overflow */
  assignedReg: string | null
  serviceType: string
}

const OVERFLOW_ROW_ID_PREFIX = '__overflow__'

interface AircraftGroup {
  icaoType: string
  typeName: string
  registrations: AircraftWithRelations[]
}

interface TatInfo {
  gapMinutes: number
  minTat: number
  ok: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function startOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatDateRange(start: Date, days: number): string {
  const end = addDays(start, days - 1)
  const s = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const e = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${s} – ${e}`
}

function formatISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function getDayOfWeek(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay()
}

function isWeekend(d: Date): boolean {
  const dow = d.getDay()
  return dow === 0 || dow === 6
}

/** Convert a UTC hour to a local hour using the given offset. */
function utcToLocal(utcHour: number, offset: number): number {
  return ((utcHour + offset) % 24 + 24) % 24
}

/** Check if a UTC date at a given offset would be a weekend in local time. */
function isLocalWeekend(date: Date, offset: number): boolean {
  // If offset shifts past midnight, the local date may be different
  const localDate = getLocalDate(date, offset)
  const dow = localDate.getDay()
  return dow === 0 || dow === 6
}

/** Get the local date for a UTC date with a timezone offset. */
function getLocalDate(date: Date, offset: number): Date {
  const d = new Date(date)
  d.setHours(d.getHours() + offset)
  return d
}

/** Format block time as BH: HH:MM */
function formatBlockTimeBH(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `BH: ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function parseCabinConfig(config: unknown): CabinEntry[] {
  if (Array.isArray(config)) {
    return config.filter(
      (c): c is CabinEntry =>
        typeof c === 'object' && c !== null && 'class' in c && 'seats' in c
    )
  }
  return []
}

function formatCabinConfig(entries: CabinEntry[]): string {
  if (entries.length === 0) return ''
  return entries.map((e) => `${e.class}${e.seats}`).join(' ')
}

function formatBlockTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h${String(m).padStart(2, '0')}m`
}

/** Strip operator prefix from flight number: "VJ327" → "327" */
function stripFlightPrefix(fn: string): string {
  const match = fn.match(/\d+\w*$/)
  return match ? match[0] : fn
}

function isRouteDomestic(routeType: string | null): boolean {
  if (!routeType) return true
  return routeType.toLowerCase() === 'domestic'
}

/** Get bar color based on color mode setting. */
function getBarColor(
  ef: ExpandedFlight,
  colorMode: GanttSettingsData['colorMode'],
  settings: GanttSettingsData,
  isDbAssigned: boolean,
  isDark: boolean,
): { bg: string; text: string; useVars: boolean } {
  if (colorMode === 'assignment') {
    return {
      bg: isDbAssigned ? 'var(--gantt-bar-bg-assigned)' : 'var(--gantt-bar-bg-unassigned)',
      text: isDbAssigned ? 'var(--gantt-bar-text-assigned)' : '',
      useVars: true,
    }
  }

  let bg = '#3B82F6'
  if (colorMode === 'ac_type') {
    bg = settings.colorAcType[ef.aircraftTypeIcao || ''] || '#3B82F6'
  } else if (colorMode === 'service_type') {
    bg = settings.colorServiceType[ef.serviceType] || '#3B82F6'
  } else if (colorMode === 'destination_type') {
    bg = isRouteDomestic(ef.routeType) ? settings.colorDestType.domestic : settings.colorDestType.international
  }

  return {
    bg,
    text: getBarTextColor(bg, isDark),
    useVars: false,
  }
}

function getTatMinutes(
  acType: AircraftType | undefined,
  arrivingDomestic: boolean,
  departingDomestic: boolean,
  overrides?: { dd?: number; di?: number; id?: number; ii?: number }
): number {
  if (!acType) return 0
  if (arrivingDomestic && departingDomestic) return overrides?.dd ?? acType.tat_dom_dom_minutes ?? acType.default_tat_minutes ?? 0
  if (arrivingDomestic && !departingDomestic) return overrides?.di ?? acType.tat_dom_int_minutes ?? acType.default_tat_minutes ?? 0
  if (!arrivingDomestic && departingDomestic) return overrides?.id ?? acType.tat_int_dom_minutes ?? acType.default_tat_minutes ?? 0
  return overrides?.ii ?? acType.tat_int_int_minutes ?? acType.default_tat_minutes ?? 0
}

// ─── Component ───────────────────────────────────────────────────────────

interface GanttChartProps {
  registrations: AircraftWithRelations[]
  aircraftTypes: AircraftType[]
  seatingConfigs: AircraftSeatingConfig[]
  airports: Airport[]
  serviceTypes: FlightServiceType[]
}

export function GanttChart({ registrations, aircraftTypes, seatingConfigs, airports, serviceTypes }: GanttChartProps) {
  // ─── State ──────────────────────────────────────────────────────────
  const [startDate, setStartDate] = useState(() => startOfDay(new Date()))
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('7D')
  const [acTypeFilter, setAcTypeFilter] = useState<string | null>(null)
  const [showPublished, setShowPublished] = useState(true)
  const [showDrafts, setShowDrafts] = useState(true)
  const [selectedFlights, setSelectedFlights] = useState<Set<string>>(new Set())
  const [hoveredFlightId, setHoveredFlightId] = useState<string | null>(null)
  const tooltipPosRef = useRef({ x: 0, y: 0 })
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set<string>()
    try {
      const stored = localStorage.getItem('horizon_gantt_collapsed')
      if (stored) return new Set(JSON.parse(stored))
    } catch { /* ignore */ }
    return new Set<string>()
  })
  const [flights, setFlights] = useState<GanttFlight[]>([])
  const [loading, setLoading] = useState(false)

  // Dark mode tracking
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  )

  // Persist collapsed state to localStorage
  useEffect(() => {
    try { localStorage.setItem('horizon_gantt_collapsed', JSON.stringify(Array.from(collapsedTypes))) } catch { /* ignore */ }
  }, [collapsedTypes])

  // Track dark mode changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteChoice, setDeleteChoice] = useState<'single' | 'route'>('single')
  const [deleting, setDeleting] = useState(false)

  // Settings panel
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false)
  const {
    settings: ganttSettings,
    updateDisplay, updateColorAssignment, updateColorAcType, updateColorServiceType,
    updateTooltip, updateSettings: updateGanttSettings,
    updateUtilTarget, resetUtilTarget,
    updateTatOverride, resetTatOverride,
    resetAll: resetAllSettings, saveStatus,
  } = useGanttSettings()

  // Mini builder state
  const [miniBuilderOpen, setMiniBuilderOpen] = useState(false)
  const [miniBuilderFlight, setMiniBuilderFlight] = useState<ExpandedFlight | null>(null)
  const [miniBuilderRoute, setMiniBuilderRoute] = useState<GanttRouteData | null>(null)
  const [miniBuilderLoading, setMiniBuilderLoading] = useState(false)

  // Rubber band selection state
  const [rubberBand, setRubberBand] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  // Assign modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false)

  // Unassign confirmation modal state
  const [unassignModalOpen, setUnassignModalOpen] = useState(false)

  // Row height zoom
  const [rowHeightLevel, setRowHeightLevel] = useState(1) // default
  const rowConfig = ROW_HEIGHT_LEVELS[rowHeightLevel]
  const ROW_HEIGHT = rowConfig.rowH
  const BAR_HEIGHT = rowConfig.barH
  const BAR_TOP = (ROW_HEIGHT - BAR_HEIGHT) / 2
  const BAR_FONT = rowConfig.fontSize
  const GROUP_HEADER_HEIGHT = Math.max(24, Math.round(ROW_HEIGHT * 0.68))
  const zoomRowIn = useCallback(() => setRowHeightLevel(prev => Math.min(prev + 1, ROW_HEIGHT_LEVELS.length - 1)), [])
  const zoomRowOut = useCallback(() => setRowHeightLevel(prev => Math.max(prev - 1, 0)), [])

  // ─── Refs ───────────────────────────────────────────────────────────
  const bodyRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const histogramRef = useRef<HTMLDivElement>(null)
  const leftPanelRef = useRef<HTMLDivElement>(null)
  const lastTapRef = useRef<{ id: string; time: number } | null>(null)
  const longTapRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const centerPanelRef = useRef<HTMLDivElement>(null)

  // ─── Responsive container width ─────────────────────────────────────
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const el = centerPanelRef.current
    if (!el) return
    const update = () => setContainerWidth(el.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // ─── Derived ────────────────────────────────────────────────────────
  const zoomConfig = ZOOM_CONFIG[zoomLevel]
  const totalHours = zoomConfig.days * 24
  const rawPPH = containerWidth > 0 ? containerWidth / totalHours : 12
  const pixelsPerHour = Math.max(rawPPH, MIN_PPH)
  const totalWidth = totalHours * pixelsPerHour

  // Auto-adjust tick spacing based on effective pixels-per-hour
  const autoTickHours = pixelsPerHour > 40 ? 1
    : pixelsPerHour > 15 ? 2
    : pixelsPerHour > 8 ? 6
    : pixelsPerHour > 3 ? 12
    : pixelsPerHour > 1 ? 24
    : 168
  const hoursPerTick = Math.min(zoomConfig.hoursPerTick, autoTickHours)

  // ─── Keyboard handlers (Escape + Delete) ───────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (contextMenu) { setContextMenu(null); return }
        setSelectedFlights(new Set())
      }
      if (e.key === 'Delete' && selectedFlights.size > 0 && !deleteModalOpen && !miniBuilderOpen && !assignModalOpen) {
        setDeleteChoice('single')
        setDeleteModalOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedFlights.size, deleteModalOpen, miniBuilderOpen, assignModalOpen, contextMenu])

  // ─── Scroll Sync ───────────────────────────────────────────────────
  // Use transform on inner content for header/histogram sync (more reliable than scrollLeft)
  const headerInnerRef = useRef<HTMLDivElement>(null)
  const histogramInnerRef = useRef<HTMLDivElement>(null)

  const handleBodyScroll = useCallback(() => {
    const s = bodyRef.current
    if (!s) return
    const sl = s.scrollLeft
    if (headerInnerRef.current) headerInnerRef.current.style.transform = `translateX(-${sl}px)`
    if (histogramInnerRef.current) histogramInnerRef.current.style.transform = `translateX(-${sl}px)`
    if (leftPanelRef.current) leftPanelRef.current.scrollTop = s.scrollTop
  }, [])

  // ─── Per-date tail assignments ─────────────────────────────────────
  // Map key = "flightId__YYYY-MM-DD", value = aircraft_reg
  const [tailAssignments, setTailAssignments] = useState<Map<string, string>>(new Map())

  // ─── Data Fetch ────────────────────────────────────────────────────
  const refreshFlights = useCallback(async () => {
    const rangeStart = formatISO(startDate)
    const rangeEnd = formatISO(addDays(startDate, zoomConfig.days))
    setLoading(true)
    const [f, ta] = await Promise.all([
      getGanttFlights(rangeStart, rangeEnd),
      getFlightTailAssignments(rangeStart, rangeEnd),
    ])
    setFlights(f)
    // Build lookup map for per-date assignments
    const taMap = new Map<string, string>()
    for (const row of ta) {
      taMap.set(`${row.scheduledFlightId}__${row.flightDate}`, row.aircraftReg)
    }
    setTailAssignments(taMap)
    setLoading(false)
  }, [startDate, zoomConfig.days])

  useEffect(() => { refreshFlights() }, [refreshFlights])

  /** Optimistic assign: update per-date tail assignment map */
  const applyOptimisticAssign = useCallback((items: FlightDateItem[], reg: string) => {
    setTailAssignments(prev => {
      const next = new Map(prev)
      for (const item of items) {
        next.set(`${item.flightId}__${item.flightDate}`, reg)
      }
      return next
    })
  }, [])

  /** Optimistic unassign: remove per-date tail assignments */
  const applyOptimisticUnassign = useCallback((items: FlightDateItem[]) => {
    setTailAssignments(prev => {
      const next = new Map(prev)
      for (const item of items) {
        next.delete(`${item.flightId}__${item.flightDate}`)
      }
      return next
    })
  }, [])

  // ─── Seating config lookup ────────────────────────────────────────
  const seatingByAircraft = useMemo(() => {
    const map = new Map<string, AircraftSeatingConfig[]>()
    for (const sc of seatingConfigs) {
      const list = map.get(sc.aircraft_id) || []
      list.push(sc)
      map.set(sc.aircraft_id, list)
    }
    return map
  }, [seatingConfigs])

  // ─── Aircraft type maps ───────────────────────────────────────────
  const acTypeMap = useMemo(() => {
    const m = new Map<string, AircraftType>()
    for (const t of aircraftTypes) m.set(t.id, t)
    return m
  }, [aircraftTypes])

  const acTypeByIcao = useMemo(() => {
    const m = new Map<string, AircraftType>()
    for (const t of aircraftTypes) m.set(t.icao_type, t)
    return m
  }, [aircraftTypes])

  const groups = useMemo<AircraftGroup[]>(() => {
    const grouped = new Map<string, AircraftWithRelations[]>()
    for (const reg of registrations) {
      const icao = reg.aircraft_types?.icao_type || 'UNKN'
      const list = grouped.get(icao) || []
      list.push(reg)
      grouped.set(icao, list)
    }
    const result: AircraftGroup[] = []
    Array.from(grouped.entries()).forEach(([icao, regs]) => {
      if (acTypeFilter && icao !== acTypeFilter) return
      const typeName = regs[0]?.aircraft_types?.name || icao
      result.push({ icaoType: icao, typeName, registrations: regs })
    })
    result.sort((a, b) => a.icaoType.localeCompare(b.icaoType))
    return result
  }, [registrations, acTypeFilter])

  // ─── Unique AC types for filter pills ─────────────────────────────
  const uniqueTypes = useMemo(() => {
    const set = new Set<string>()
    for (const reg of registrations) {
      if (reg.aircraft_types?.icao_type) set.add(reg.aircraft_types.icao_type)
    }
    return Array.from(set).sort()
  }, [registrations])

  // ─── Expand flights into individual date instances ────────────────
  const expandedFlights = useMemo<ExpandedFlight[]>(() => {
    const result: ExpandedFlight[] = []
    for (const f of flights) {
      if (f.status === 'published' && !showPublished) continue
      if (f.status === 'draft' && !showDrafts) continue

      const pStart = new Date(f.periodStart + 'T00:00:00')
      const pEnd = new Date(f.periodEnd + 'T00:00:00')
      const stdMin = timeToMinutes(f.stdLocal)
      const staMin = timeToMinutes(f.staLocal)

      for (let d = 0; d < zoomConfig.days; d++) {
        const date = addDays(startDate, d)
        if (date < pStart || date > pEnd) continue
        const dow = getDayOfWeek(date)
        if (!f.daysOfOperation.includes(String(dow))) continue

        // Per-date tail assignment takes priority over scheduled_flights.aircraft_reg
        const dateStr = formatISO(date)
        const perDateReg = tailAssignments.get(`${f.id}__${dateStr}`) || null

        result.push({
          id: `${f.id}_${dateStr}`,
          flightId: f.id,
          flightNumber: f.flightNumber,
          depStation: f.depStation,
          arrStation: f.arrStation,
          stdLocal: f.stdLocal,
          staLocal: f.staLocal,
          blockMinutes: f.blockMinutes,
          status: f.status,
          aircraftTypeIcao: f.aircraftTypeIcao,
          date,
          stdMinutes: stdMin,
          staMinutes: staMin + (staMin < stdMin ? 1440 : 0), // handle next-day arrival
          daysOfOperation: f.daysOfOperation,
          periodStart: f.periodStart,
          periodEnd: f.periodEnd,
          routeType: f.routeType,
          routeId: f.routeId,
          seasonId: f.seasonId,
          aircraftReg: perDateReg,
          dayOffset: f.dayOffset ?? 0,
          assignedReg: null, // set by tail assignment engine
          serviceType: f.serviceType || 'J',
        })
      }
    }
    return result
  }, [flights, startDate, zoomConfig.days, showPublished, showDrafts, tailAssignments])

  // ─── Route cycle mate lookup ──────────────────────────────────────
  const routeCycleMap = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const ef of expandedFlights) {
      if (!ef.routeId) continue
      const baseDateMs = ef.date.getTime() - ef.dayOffset * 86400000
      const baseDate = new Date(baseDateMs).toISOString().slice(0, 10)
      const key = `route_${ef.routeId}_${baseDate}`
      const list = map.get(key) || []
      list.push(ef.id)
      map.set(key, list)
    }
    return map
  }, [expandedFlights])

  const getRouteCycleMates = useCallback((expandedId: string): string[] => {
    const ef = expandedFlights.find(f => f.id === expandedId)
    if (!ef || !ef.routeId) return [expandedId]
    const baseDateMs = ef.date.getTime() - ef.dayOffset * 86400000
    const baseDate = new Date(baseDateMs).toISOString().slice(0, 10)
    return routeCycleMap.get(`route_${ef.routeId}_${baseDate}`) || [expandedId]
  }, [expandedFlights, routeCycleMap])

  // ─── Virtual tail assignment engine ──────────────────────────────
  const assignmentResult = useMemo<TailAssignmentResult>(() => {
    // Build assignable aircraft list
    const assignableAircraft: AssignableAircraft[] = registrations
      .filter(r => r.status === 'active' || r.status === 'operational')
      .map(r => ({
        registration: r.registration,
        icaoType: r.aircraft_types?.icao_type || 'UNKN',
        homeBase: r.home_base?.iata_code || null,
      }))

    // Build default TAT per AC type
    const defaultTat = new Map<string, number>()
    for (const t of aircraftTypes) {
      defaultTat.set(t.icao_type, t.default_tat_minutes ?? 30)
    }

    return autoAssignFlights(expandedFlights, assignableAircraft, defaultTat)
  }, [expandedFlights, registrations, aircraftTypes])

  // Annotate expanded flights with their assigned registration
  const assignedFlights = useMemo(() => {
    return expandedFlights.map(ef => ({
      ...ef,
      assignedReg: assignmentResult.assignments.get(ef.id) || null,
    }))
  }, [expandedFlights, assignmentResult])

  // ─── Flights indexed by registration for row rendering ──────────
  const flightsByReg = useMemo(() => {
    const map = new Map<string, ExpandedFlight[]>()
    for (const ef of assignedFlights) {
      // DB assignment (aircraftReg) takes absolute priority over auto-assignment
      const reg = ef.aircraftReg || ef.assignedReg
      if (!reg) continue
      const list = map.get(reg) || []
      list.push(ef)
      map.set(reg, list)
    }
    return map
  }, [assignedFlights])

  // ─── Overflow flights indexed by AC type ────────────────────────
  const overflowByType = useMemo(() => {
    const map = new Map<string, ExpandedFlight[]>()
    for (const of_ of assignmentResult.overflow) {
      const ef = assignedFlights.find(f => f.id === of_.id)
      // DB-assigned flights are pinned to their row — never overflow
      if (!ef || ef.aircraftReg) continue
      const key = of_.aircraftTypeIcao || 'UNKN'
      const list = map.get(key) || []
      list.push(ef)
      map.set(key, list)
    }
    return map
  }, [assignmentResult.overflow, assignedFlights])

  // Keep flightsByType for stats / other lookups
  const flightsByType = useMemo(() => {
    const map = new Map<string, ExpandedFlight[]>()
    for (const ef of assignedFlights) {
      const key = ef.aircraftTypeIcao || 'UNKN'
      const list = map.get(key) || []
      list.push(ef)
      map.set(key, list)
    }
    return map
  }, [assignedFlights])

  // ─── Stats ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const pub = assignedFlights.filter((f) => f.status === 'published').length
    const draft = assignedFlights.filter((f) => f.status === 'draft').length
    const types = new Set(assignedFlights.map((f) => f.aircraftTypeIcao).filter(Boolean)).size
    const sectors = new Set(assignedFlights.map((f) => `${f.depStation}-${f.arrStation}`)).size
    return { total: assignedFlights.length, pub, draft, types, sectors }
  }, [assignedFlights])

  // ─── Histogram bucket mode ──────────────────────────────────────
  const histogramMode: 'hourly' | 'daily' | 'weekly' = useMemo(() => {
    if (zoomConfig.days <= 3) return 'hourly'
    if (zoomConfig.days <= 14) return 'daily'
    return 'weekly'
  }, [zoomConfig.days])

  const histogramLabel = histogramMode === 'hourly' ? 'Flights/hr' : histogramMode === 'daily' ? 'Flights/day' : 'Flights/wk'

  // ─── Histogram data (variable buckets) ────────────────────────────
  const histogram = useMemo(() => {
    const buckets: { count: number; xPx: number; widthPx: number }[] = []
    const pph = pixelsPerHour

    if (histogramMode === 'hourly') {
      const totalSlots = zoomConfig.days * 24
      const counts = new Array(totalSlots).fill(0) as number[]
      for (const ef of assignedFlights) {
        const dayOff = Math.floor((ef.date.getTime() - startDate.getTime()) / 86400000)
        const slot = dayOff * 24 + Math.floor(ef.stdMinutes / 60)
        if (slot >= 0 && slot < totalSlots) counts[slot]++
      }
      for (let i = 0; i < totalSlots; i++) {
        buckets.push({ count: counts[i], xPx: i * pph, widthPx: Math.max(1, pph - 2) })
      }
    } else if (histogramMode === 'daily') {
      const counts = new Array(zoomConfig.days).fill(0) as number[]
      for (const ef of assignedFlights) {
        const dayOff = Math.floor((ef.date.getTime() - startDate.getTime()) / 86400000)
        if (dayOff >= 0 && dayOff < zoomConfig.days) counts[dayOff]++
      }
      const dayW = 24 * pph
      for (let d = 0; d < zoomConfig.days; d++) {
        buckets.push({ count: counts[d], xPx: d * dayW, widthPx: Math.max(1, dayW - 2) })
      }
    } else {
      // weekly
      const numWeeks = Math.ceil(zoomConfig.days / 7)
      const counts = new Array(numWeeks).fill(0) as number[]
      for (const ef of assignedFlights) {
        const dayOff = Math.floor((ef.date.getTime() - startDate.getTime()) / 86400000)
        const week = Math.floor(dayOff / 7)
        if (week >= 0 && week < numWeeks) counts[week]++
      }
      const weekW = 7 * 24 * pph
      for (let w = 0; w < numWeeks; w++) {
        const daysInWeek = Math.min(7, zoomConfig.days - w * 7)
        const actualW = daysInWeek * 24 * pph
        buckets.push({ count: counts[w], xPx: w * weekW, widthPx: Math.max(1, actualW - 2) })
      }
    }

    const max = Math.max(1, ...buckets.map((b) => b.count))
    return { buckets, max }
  }, [assignedFlights, zoomConfig.days, pixelsPerHour, startDate, histogramMode, totalWidth])

  // ─── EOD location per registration per day ─────────────────────────
  const showEodBadges = ganttSettings.display?.eodBadges ?? true
  const eodEveryDay = zoomConfig.days <= 7 // ≤7D: badge every day; >7D: one badge at right edge

  // Map: "REG|YYYY-MM-DD" → { station, mismatch }
  const eodLocations = useMemo(() => {
    if (!showEodBadges) return new Map<string, { station: string; mismatch: boolean }>()

    // Collect last-arrival and first-departure per registration per day
    // Track whether the flight is DB-assigned
    const lastArr = new Map<string, { station: string; staMin: number; isDbAssigned: boolean }>()
    const firstDep = new Map<string, { station: string; stdMin: number; isDbAssigned: boolean }>()

    for (const ef of assignedFlights) {
      const reg = ef.aircraftReg || ef.assignedReg
      if (!reg) continue
      const dateKey = formatISO(ef.date)
      const key = `${reg}|${dateKey}`

      const prev = lastArr.get(key)
      if (!prev || ef.staMinutes > prev.staMin) {
        lastArr.set(key, { station: ef.arrStation, staMin: ef.staMinutes, isDbAssigned: !!ef.aircraftReg })
      }

      const prevDep = firstDep.get(key)
      if (!prevDep || ef.stdMinutes < prevDep.stdMin) {
        firstDep.set(key, { station: ef.depStation, stdMin: ef.stdMinutes, isDbAssigned: !!ef.aircraftReg })
      }
    }

    const result = new Map<string, { station: string; mismatch: boolean }>()
    Array.from(lastArr.entries()).forEach(([key, val]) => {
      const [reg, dateStr] = key.split('|')
      const nextDate = addDays(new Date(dateStr + 'T00:00:00'), 1)
      const nextKey = `${reg}|${formatISO(nextDate)}`
      const nextDep = firstDep.get(nextKey)
      // Only flag mismatch if both the arriving and departing flights are DB-assigned
      const mismatch = nextDep && val.isDbAssigned && nextDep.isDbAssigned
        ? nextDep.station !== val.station
        : false
      result.set(key, { station: val.station, mismatch })
    })

    return result
  }, [assignedFlights, showEodBadges])

  // ─── Selected flight details ──────────────────────────────────────
  // Primary selected flight = first in the set (for panel display)
  const selectedFlightId = useMemo(() => {
    if (selectedFlights.size === 0) return null
    return selectedFlights.values().next().value as string
  }, [selectedFlights])

  const selectedFlight = useMemo(() => {
    if (!selectedFlightId) return null
    return assignedFlights.find((f) => f.id === selectedFlightId) || null
  }, [selectedFlightId, assignedFlights])

  // All selected ExpandedFlight objects (for modals)
  const selectedFlightObjects = useMemo(() => {
    if (selectedFlights.size === 0) return []
    return assignedFlights.filter(f => selectedFlights.has(f.id))
  }, [selectedFlights, assignedFlights])

  // ─── Drag & Drop (Workspace) ────────────────────────────────────
  const icaoToFamily = useMemo(() => {
    const m = new Map<string, string | null>()
    for (const t of aircraftTypes) m.set(t.icao_type, t.family)
    return m
  }, [aircraftTypes])

  const icaoToCategory = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of aircraftTypes) m.set(t.icao_type, t.category)
    return m
  }, [aircraftTypes])

  const getFlightIcao = useCallback((expandedId: string) => {
    const ef = assignedFlights.find(f => f.id === expandedId)
    return ef?.aircraftTypeIcao || null
  }, [assignedFlights])

  const {
    workspaceOverrides, dragState, targetRow, pendingDrop,
    onBarMouseDown, onBodyMouseMove, onBodyMouseUp,
    resetWorkspace, isDragged, isGhostPlaceholder,
    getDragDeltaY, getWorkspaceReg, confirmDrop, cancelDrop,
  } = useGanttDrag({
    selectedFlights,
    icaoToFamily,
    icaoToCategory,
    getFlightIcao,
    getRouteCycleMates,
    anyModalOpen: deleteModalOpen || miniBuilderOpen || assignModalOpen || unassignModalOpen,
    clipboardActive: false, // clipboard hook runs after drag — anyModalOpen covers paste dialogs
  })

  // ─── Clipboard (Cut/Copy/Paste) ──────────────────────────────────
  const {
    clipboard, undo: clipboardUndo, pasteModalOpen, setPasteModalOpen,
    pasteTargetOpen, setPasteTargetOpen, justPastedIds,
    isFlightGhosted, clearClipboard, setTargetReg: setClipboardTargetReg,
    executePaste, executeUndo: executeClipboardUndo, pasting,
  } = useGanttClipboard({
    selectedFlights,
    selectedFlightObjects,
    refreshFlights,
    clearSelection: () => setSelectedFlights(new Set()),
    anyModalOpen: deleteModalOpen || miniBuilderOpen || assignModalOpen || unassignModalOpen || !!pendingDrop,
  })

  // ─── Workspace-aware flight placement ──────────────────────────
  // Override flightsByReg to account for workspace overrides
  const wsFlightsByReg = useMemo(() => {
    if (workspaceOverrides.size === 0) return flightsByReg

    const map = new Map<string, ExpandedFlight[]>()
    for (const ef of assignedFlights) {
      const wsReg = workspaceOverrides.get(ef.flightId)
      const effectiveReg = wsReg || ef.aircraftReg || ef.assignedReg
      if (!effectiveReg) continue
      const list = map.get(effectiveReg) || []
      list.push(ef)
      map.set(effectiveReg, list)
    }
    return map
  }, [assignedFlights, flightsByReg, workspaceOverrides])

  // Workspace-aware overflow: flights with no effective reg
  const wsOverflowByType = useMemo(() => {
    if (workspaceOverrides.size === 0) return overflowByType

    const map = new Map<string, ExpandedFlight[]>()
    for (const ef of assignedFlights) {
      const wsReg = workspaceOverrides.get(ef.flightId)
      const effectiveReg = wsReg || ef.aircraftReg || ef.assignedReg
      if (effectiveReg) continue
      const key = ef.aircraftTypeIcao || 'UNKN'
      const list = map.get(key) || []
      list.push(ef)
      map.set(key, list)
    }
    return map
  }, [assignedFlights, overflowByType, workspaceOverrides])

  // ─── Right panel rotation data ────────────────────────────────────
  interface RotationFlight extends ExpandedFlight {
    tatToNext: TatInfo | null
    /** True if this flight starts a new route block in the rotation */
    routeBlockStart: boolean
  }

  interface ConflictInfo {
    type: 'overlap' | 'insufficient_tat' | 'station_mismatch'
    flightA: ExpandedFlight
    flightB: ExpandedFlight
    detail: string
  }

  const panelData = useMemo(() => {
    if (!selectedFlight) return null

    const icao = selectedFlight.aircraftTypeIcao || 'UNKN'
    const dateStr = formatISO(selectedFlight.date)

    // Find first matching registration
    const reg = registrations.find(
      (r) => r.aircraft_types?.icao_type === icao
    )
    const regCode = reg?.registration || icao
    const cabin = reg ? getCabinString(reg) : ''
    const homeBase = reg?.home_base?.iata_code || null

    // Get all flights for this AC type on the same day, sorted by STD
    const dayFlights = assignedFlights
      .filter((f) => f.aircraftTypeIcao === icao && formatISO(f.date) === dateStr)
      .sort((a, b) => a.stdMinutes - b.stdMinutes)

    // Build rotation with TAT info and route block boundaries
    const rotation: RotationFlight[] = dayFlights.map((f, i) => {
      let tatToNext: TatInfo | null = null
      if (i < dayFlights.length - 1) {
        tatToNext = calcTat(f, dayFlights[i + 1])
      }
      // Mark route block boundaries: first flight, or routeId differs from previous
      const routeBlockStart = i === 0 || !f.routeId || f.routeId !== dayFlights[i - 1].routeId
      return { ...f, tatToNext, routeBlockStart }
    })

    // Check if any flight in the rotation is auto-assigned (not DB-assigned)
    const hasAutoAssigned = rotation.some(f => !f.aircraftReg)

    // Detect conflicts — only between route blocks, not within
    // Only flag conflicts between DB-assigned flight pairs
    const conflicts: ConflictInfo[] = []
    for (let i = 0; i < rotation.length - 1; i++) {
      const curr = rotation[i]
      const next = rotation[i + 1]
      const sameRoute = curr.routeId && next.routeId && curr.routeId === next.routeId
      const bothDbAssigned = !!curr.aircraftReg && !!next.aircraftReg

      // Only report conflicts between DB-assigned pairs
      if (!bothDbAssigned) continue

      // Time overlap: next STD < current STA (always flag, even within route)
      if (next.stdMinutes < curr.staMinutes) {
        conflicts.push({
          type: 'overlap',
          flightA: curr,
          flightB: next,
          detail: `${stripFlightPrefix(curr.flightNumber)} (STA ${curr.staLocal}) overlaps with ${stripFlightPrefix(next.flightNumber)} (STD ${next.stdLocal})`,
        })
      } else if (!sameRoute) {
        // Station mismatch — only between different routes/standalone flights
        if (curr.arrStation !== next.depStation) {
          conflicts.push({
            type: 'station_mismatch',
            flightA: curr,
            flightB: next,
            detail: `${curr.arrStation} ≠ ${next.depStation}: ${stripFlightPrefix(curr.flightNumber)} arrives ${curr.arrStation} but ${stripFlightPrefix(next.flightNumber)} departs ${next.depStation}`,
          })
        }

        // Insufficient TAT — only between different routes/standalone flights
        if (curr.tatToNext && !curr.tatToNext.ok) {
          conflicts.push({
            type: 'insufficient_tat',
            flightA: curr,
            flightB: next,
            detail: `${curr.tatToNext.gapMinutes}min gap < ${curr.tatToNext.minTat}min minimum between ${stripFlightPrefix(curr.flightNumber)} and ${stripFlightPrefix(next.flightNumber)}`,
          })
        }
      }
    }

    // Daily utilization
    const totalBlock = dayFlights.reduce((s, f) => s + f.blockMinutes, 0)
    const acTypeInfo = icao !== 'UNKN' ? acTypeByIcao.get(icao) : undefined
    const categoryDefault = acTypeInfo?.category === 'widebody' ? 14 : acTypeInfo?.category === 'regional' ? 10 : 12
    const targetHours = (ganttSettings.utilizationTargets ?? {})[icao] ?? categoryDefault
    const utilPct = Math.round((totalBlock / 60 / targetHours) * 100)

    return {
      regCode,
      icao,
      cabin,
      homeBase,
      rotation,
      conflicts,
      hasAutoAssigned,
      totalBlock,
      flightCount: dayFlights.length,
      targetHours,
      utilPct,
      dateStr: selectedFlight.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFlight, assignedFlights, registrations, acTypeByIcao, ganttSettings.utilizationTargets, ganttSettings.tatOverrides, ganttSettings.display])

  // ─── Navigation ───────────────────────────────────────────────────
  const goBack = () => setStartDate((d) => addDays(d, -zoomConfig.days))
  const goForward = () => setStartDate((d) => addDays(d, zoomConfig.days))
  const goToday = () => setStartDate(startOfDay(new Date()))

  const toggleCollapse = (icao: string) => {
    setCollapsedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(icao)) next.delete(icao)
      else next.add(icao)
      return next
    })
  }

  const handleBarClick = (id: string, e: React.MouseEvent) => {
    setContextMenu(null)
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      // Toggle: add or remove from selection
      setSelectedFlights(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    } else {
      // Single select: clear previous and select this one (or deselect if same)
      setSelectedFlights(prev => {
        if (prev.size === 1 && prev.has(id)) return new Set()
        return new Set([id])
      })
    }
  }

  // ─── Double-click handler → open Mini Builder ─────────────────
  const handleBarDoubleClick = useCallback(async (ef: ExpandedFlight) => {
    setMiniBuilderFlight(ef)
    setMiniBuilderOpen(true)
    if (ef.routeId) {
      setMiniBuilderLoading(true)
      const route = await getRouteWithLegs(ef.routeId)
      setMiniBuilderRoute(route)
      setMiniBuilderLoading(false)
    } else {
      setMiniBuilderRoute(null)
    }
  }, [])

  // ─── Delete handler ───────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!selectedFlight || deleting) return
    setDeleting(true)
    try {
      if (deleteChoice === 'route' && selectedFlight.routeId) {
        const result = await deleteRoute(selectedFlight.routeId)
        if (result.error) {
          toast.error(friendlyError(result.error))
          return
        }
        toast.success('Route deleted')
      } else {
        const result = await deleteSingleFlight(selectedFlight.flightId)
        if (result.error) {
          toast.error(friendlyError(result.error))
          return
        }
        toast.success(result.routeDeleted ? 'Flight and empty route deleted' : 'Flight deleted')
      }
      setDeleteModalOpen(false)
      setSelectedFlights(new Set())
      refreshFlights()
    } finally {
      setDeleting(false)
    }
  }, [selectedFlight, deleteChoice, deleting, refreshFlights])

  // ─── Right-click handler ───────────────────────────────────────
  const handleBarContextMenu = useCallback((e: React.MouseEvent, flightId: string) => {
    e.preventDefault()
    e.stopPropagation()
    // If the right-clicked flight isn't already selected, select it alone
    if (!selectedFlights.has(flightId)) {
      setSelectedFlights(new Set([flightId]))
    }
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [selectedFlights])

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return
    const handleClick = () => setContextMenu(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [contextMenu])

  // ─── Get cabin config string for a registration ───────────────────
  function getCabinString(reg: AircraftWithRelations): string {
    const configs = seatingByAircraft.get(reg.id)
    if (configs && configs.length > 0) {
      const latest = configs[configs.length - 1]
      const entries = parseCabinConfig(latest.cabin_config)
      if (entries.length > 0) return formatCabinConfig(entries)
      if (latest.total_capacity > 0) return `Y${latest.total_capacity}`
    }
    const typeInfo = reg.aircraft_type_id ? acTypeMap.get(reg.aircraft_type_id) : null
    if (typeInfo?.pax_capacity) return `Y${typeInfo.pax_capacity}`
    return ''
  }

  // ─── Build row list (for left panel + body alignment) ─────────────
  type RowItem =
    | { type: 'group'; icaoType: string; typeName: string; count: number }
    | { type: 'aircraft'; reg: AircraftWithRelations; cabin: string }
    | { type: 'overflow'; icaoType: string; overflowCount: number }

  // Utilization per registration (for type_util sort)
  const utilByReg = useMemo(() => {
    const map = new Map<string, number>()
    flightsByReg.forEach((flights, reg) => {
      let totalMin = 0
      for (const f of flights) totalMin += f.blockMinutes
      map.set(reg, totalMin)
    })
    return map
  }, [flightsByReg])

  const rows = useMemo<RowItem[]>(() => {
    const sortOrder = ganttSettings.fleetSortOrder ?? 'type_reg'
    const result: RowItem[] = []

    if (sortOrder === 'reg_only') {
      // Flat list: all registrations sorted alphabetically, no groups
      const allRegs = groups.flatMap(g => g.registrations)
      allRegs.sort((a, b) => a.registration.localeCompare(b.registration))
      for (const reg of allRegs) {
        result.push({ type: 'aircraft', reg, cabin: getCabinString(reg) })
      }
      return result
    }

    for (const g of groups) {
      const overflowFlights = overflowByType.get(g.icaoType)
      const overflowCount = overflowFlights?.length || 0
      result.push({
        type: 'group',
        icaoType: g.icaoType,
        typeName: g.typeName,
        count: g.registrations.length + (overflowCount > 0 ? 1 : 0),
      })
      if (!collapsedTypes.has(g.icaoType)) {
        // Sort registrations within group
        const sortedRegs = [...g.registrations]
        if (sortOrder === 'type_util') {
          sortedRegs.sort((a, b) => (utilByReg.get(b.registration) ?? 0) - (utilByReg.get(a.registration) ?? 0))
        }
        for (const reg of sortedRegs) {
          result.push({
            type: 'aircraft',
            reg,
            cabin: getCabinString(reg),
          })
        }
        // Overflow row (if any flights couldn't be assigned)
        if (overflowCount > 0) {
          result.push({
            type: 'overflow',
            icaoType: g.icaoType,
            overflowCount,
          })
        }
      }
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, collapsedTypes, seatingByAircraft, acTypeMap, overflowByType, ganttSettings.fleetSortOrder, utilByReg])

  const bodyHeight = rows.reduce(
    (h, r) => h + (r.type === 'group' ? GROUP_HEADER_HEIGHT : ROW_HEIGHT), 0
  )

  // ─── Row layout for drag hit-testing ──────────────────────────────
  const rowLayout = useMemo<RowLayoutItem[]>(() => {
    const result: RowLayoutItem[] = []
    let y = 0
    for (const row of rows) {
      const h = row.type === 'group' ? GROUP_HEADER_HEIGHT : ROW_HEIGHT
      result.push({
        type: row.type,
        icaoType: row.type === 'group' ? row.icaoType : row.type === 'overflow' ? row.icaoType : (row.reg.aircraft_types?.icao_type || 'UNKN'),
        registration: row.type === 'aircraft' ? row.reg.registration : null,
        yTop: y,
        height: h,
      })
      y += h
    }
    return result
  }, [rows])

  // ─── Pixel position for a flight ──────────────────────────────────
  const getFlightX = (ef: ExpandedFlight): number => {
    const dayOffset = Math.floor(
      (ef.date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    )
    return (dayOffset * 1440 + ef.stdMinutes) * pixelsPerHour / 60
  }

  const getFlightWidth = (ef: ExpandedFlight): number => {
    // Use staMinutes - stdMinutes (already overnight-adjusted) for accurate width
    const durationMinutes = ef.staMinutes - ef.stdMinutes
    return Math.max(2, durationMinutes * pixelsPerHour / 60)
  }

  // ─── TAT calculation between two consecutive flights ──────────────
  function calcTat(current: ExpandedFlight, next: ExpandedFlight): TatInfo | null {
    // Both must be on the same date and the next departs from where current arrives
    if (current.arrStation !== next.depStation) return null
    const gapMinutes = next.stdMinutes - current.staMinutes
    if (gapMinutes < 0) return null // next day overlap — skip

    const icao = current.aircraftTypeIcao
    const acType = icao ? acTypeByIcao.get(icao) : undefined
    const arrivingDom = isRouteDomestic(current.routeType)
    const departingDom = isRouteDomestic(next.routeType)
    const tatOverride = icao ? (ganttSettings.tatOverrides ?? {})[icao] : undefined
    const minTat = getTatMinutes(acType, arrivingDom, departingDom, tatOverride)

    return { gapMinutes, minTat, ok: minTat === 0 || gapMinutes >= minTat }
  }

  // ─── Get sorted flights for a registration row ──────────────────
  const getRegFlightsSorted = (registration: string): ExpandedFlight[] => {
    const all = wsFlightsByReg.get(registration) || []
    return [...all].sort((a, b) => {
      const da = a.date.getTime()
      const db = b.date.getTime()
      if (da !== db) return da - db
      return a.stdMinutes - b.stdMinutes
    })
  }

  // ─── Get sorted overflow flights for an AC type ────────────────
  const getOverflowFlightsSorted = (icao: string): ExpandedFlight[] => {
    const all = wsOverflowByType.get(icao) || []
    return [...all].sort((a, b) => {
      const da = a.date.getTime()
      const db = b.date.getTime()
      if (da !== db) return da - db
      return a.stdMinutes - b.stdMinutes
    })
  }

  // ─── Legacy: get all flights for an AC type (for panel rotation) ──
  const getRowFlightsSorted = (icao: string): ExpandedFlight[] => {
    const all = flightsByType.get(icao) || []
    return [...all].sort((a, b) => {
      const da = a.date.getTime()
      const db = b.date.getTime()
      if (da !== db) return da - db
      return a.stdMinutes - b.stdMinutes
    })
  }

  // ─── Hovered flight for tooltip ───────────────────────────────────
  const hoveredFlight = useMemo(() => {
    if (!hoveredFlightId) return null
    return assignedFlights.find((f) => f.id === hoveredFlightId) || null
  }, [hoveredFlightId, assignedFlights])

  // ─── Tooltip TAT info ─────────────────────────────────────────────
  const hoveredTat = useMemo<TatInfo | null>(() => {
    if (!hoveredFlight) return null
    const icao = hoveredFlight.aircraftTypeIcao || 'UNKN'
    const sorted = getRowFlightsSorted(icao)
    const idx = sorted.findIndex((f) => f.id === hoveredFlight.id)
    if (idx < 0 || idx >= sorted.length - 1) return null
    const next = sorted[idx + 1]
    // Same date only
    if (formatISO(hoveredFlight.date) !== formatISO(next.date)) return null
    return calcTat(hoveredFlight, next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredFlight, flightsByType])

  // ─── Hovered flight tooltip context ──────────────────────────────
  const hoveredTooltipInfo = useMemo(() => {
    if (!hoveredFlight) return null
    if (hoveredFlight.aircraftReg) {
      const reg = registrations.find(r => r.registration === hoveredFlight.aircraftReg)
      return {
        regCode: hoveredFlight.aircraftReg,
        cabin: reg ? getCabinString(reg) : '',
      }
    }
    return { regCode: null, cabin: '' }
  }, [hoveredFlight, registrations])

  // ─── DOW circles helper ───────────────────────────────────────────
  const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  // ─── Derived header settings ────────────────────────────────────────
  const timeMode = ganttSettings.timeDisplay ?? 'dual'
  const tzOffset = ganttSettings.baseTimezoneOffset ?? 7
  const headerH = timeMode === 'dual' ? 48 : 36

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* ── HEADER BAR ─────────────────────────────────────────────── */}
      <div className="shrink-0 glass border-b z-20 px-4 py-2 space-y-2">
        {/* Row 1: Title + Navigation + Zoom */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold whitespace-nowrap">Gantt Chart</h1>
            <div className="flex items-center gap-1">
              <button
                onClick={goBack}
                className="p-1 rounded-md hover:bg-muted transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-muted-foreground min-w-[160px] text-center">
                {formatDateRange(startDate, zoomConfig.days)}
                <span className="ml-1 opacity-50">(Local)</span>
              </span>
              <button
                onClick={goForward}
                className="p-1 rounded-md hover:bg-muted transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={goToday}
                className="ml-1 px-2 py-0.5 text-[10px] font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                Today
              </button>
            </div>
          </div>

          {/* Zoom pills + Row height zoom + Settings gear */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5">
              {ZOOM_GROUP_DAYS.map((z) => (
                <button
                  key={z}
                  onClick={() => setZoomLevel(z)}
                  className={`px-1.5 py-0.5 text-[10px] font-medium rounded-md transition-colors ${
                    zoomLevel === z
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {z}
                </button>
              ))}
              <div className="w-px h-4 bg-border/60 mx-0.5" />
              {ZOOM_GROUP_WIDE.map((z) => (
                <button
                  key={z}
                  onClick={() => setZoomLevel(z)}
                  className={`px-1.5 py-0.5 text-[10px] font-medium rounded-md transition-colors ${
                    zoomLevel === z
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {z}
                </button>
              ))}
              {/* Vertical divider + Row height zoom */}
              <div className="w-px h-4 bg-border/60 mx-0.5" />
              <button
                onClick={zoomRowOut}
                disabled={rowHeightLevel === 0}
                className="w-[26px] h-[26px] flex items-center justify-center rounded-[7px] border border-border/60 text-muted-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-default"
                title="Decrease row height"
              >
                <span className="text-xs font-bold leading-none">−</span>
              </button>
              <button
                onClick={zoomRowIn}
                disabled={rowHeightLevel === ROW_HEIGHT_LEVELS.length - 1}
                className="w-[26px] h-[26px] flex items-center justify-center rounded-[7px] border border-border/60 text-muted-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-default"
                title="Increase row height"
              >
                <span className="text-xs font-bold leading-none">+</span>
              </button>
            </div>
            <button
              onClick={() => setSettingsPanelOpen(v => !v)}
              className={`p-1.5 rounded-md transition-colors ${settingsPanelOpen ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
              title="Gantt Settings"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Row 2: AC type pills + toggles + stats */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => setAcTypeFilter(null)}
              className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors ${
                acTypeFilter === null
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              All
            </button>
            {uniqueTypes.map((t) => (
              <button
                key={t}
                onClick={() => setAcTypeFilter(acTypeFilter === t ? null : t)}
                className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors ${
                  acTypeFilter === t
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                {t}
              </button>
            ))}

            <div className="w-px h-4 bg-border mx-1" />

            {/* Published toggle */}
            <button
              onClick={() => setShowPublished((v) => !v)}
              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors ${
                showPublished ? 'bg-primary/15 text-primary' : 'bg-muted/50 text-muted-foreground'
              }`}
            >
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full ${
                  showPublished ? 'bg-primary' : 'bg-muted-foreground/40'
                }`}
              />
              Pub
            </button>

            {/* Draft toggle */}
            <button
              onClick={() => setShowDrafts((v) => !v)}
              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors ${
                showDrafts ? 'bg-primary/15 text-primary' : 'bg-muted/50 text-muted-foreground'
              }`}
            >
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full border ${
                  showDrafts
                    ? 'border-primary bg-primary/40'
                    : 'border-muted-foreground/40 bg-transparent'
                }`}
              />
              Draft
            </button>
          </div>

          {/* Workspace indicator + Stats + Selection pill */}
          <div className="flex items-center gap-3">
            <GanttWorkspaceIndicator
              overrideCount={workspaceOverrides.size}
              onReset={resetWorkspace}
            />
            {selectedFlights.size > 0 && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium"
                style={{ background: 'rgba(59,130,246,0.1)', color: '#2563eb' }}
              >
                {selectedFlights.size} flight{selectedFlights.size > 1 ? 's' : ''} selected
                <button
                  onClick={() => setSelectedFlights(new Set())}
                  className="ml-0.5 p-0.5 rounded-full hover:bg-blue-500/15 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className="text-[10px] text-muted-foreground whitespace-nowrap">
              {loading ? (
                'Loading...'
              ) : (
                `${stats.total} flights (${stats.pub} pub · ${stats.draft} draft) | ${stats.types} types | ${stats.sectors} sectors`
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── BODY ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0">
        {/* ── LEFT PANEL (Aircraft Registry) ─────────────────────── */}
        <div className="w-[140px] shrink-0 glass border-r flex flex-col overflow-hidden">
          {/* Aligned with timeline header */}
          <div className="h-9 shrink-0 border-b" />
          {/* Histogram label */}
          {(ganttSettings.display?.histogram ?? true) ? (
            <div className="h-[34px] shrink-0 border-b flex items-end px-3 pb-1">
              <span className="text-[8px] font-medium text-muted-foreground/70 select-none">
                {histogramLabel}
              </span>
            </div>
          ) : (
            <div className="h-[6px] shrink-0 border-b" />
          )}
          {/* Scrollable rows */}
          <div
            ref={leftPanelRef}
            className="flex-1 overflow-hidden select-none"
          >
            <div style={{ height: bodyHeight }}>
              {rows.map((row) => {
                if (row.type === 'group') {
                  const isCollapsed = collapsedTypes.has(row.icaoType)
                  return (
                    <div
                      key={`g-${row.icaoType}`}
                      className="flex items-center gap-1 px-2 cursor-pointer hover:bg-muted/50 transition-colors select-none"
                      style={{ height: GROUP_HEADER_HEIGHT }}
                      onClick={() => toggleCollapse(row.icaoType)}
                    >
                      <ChevronDown
                        className={`h-3 w-3 text-muted-foreground shrink-0 transition-transform ${
                          isCollapsed ? '-rotate-90' : ''
                        }`}
                      />
                      <span className="text-[11px] font-bold truncate">
                        {row.icaoType}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        ({row.count})
                      </span>
                    </div>
                  )
                }

                if (row.type === 'overflow') {
                  return (
                    <div
                      key={`overflow-lp-${row.icaoType}`}
                      className="flex flex-col justify-center px-3 border-b border-border/10"
                      style={{ height: ROW_HEIGHT, background: 'rgba(239, 68, 68, 0.03)' }}
                    >
                      <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 truncate leading-tight">
                        {row.icaoType} Unassigned
                      </span>
                      <span className="text-[8.5px] text-muted-foreground leading-tight">
                        ({row.overflowCount})
                      </span>
                    </div>
                  )
                }

                const isPasteTarget = clipboard?.targetReg === row.reg.registration
                const isLpDragTarget = dragState && targetRow?.registration === row.reg.registration
                const lpDragValidity = isLpDragTarget ? targetRow!.validity : null
                const lpDragStyle: React.CSSProperties = isLpDragTarget ? {
                  borderLeft: lpDragValidity === 'valid' ? '3px solid #3b82f6'
                    : lpDragValidity === 'same-family' ? '3px solid #f59e0b'
                    : lpDragValidity === 'invalid' ? '3px solid #ef4444'
                    : undefined,
                  background: lpDragValidity === 'valid' ? 'rgba(59, 130, 246, 0.03)'
                    : lpDragValidity === 'same-family' ? 'rgba(245, 158, 11, 0.03)'
                    : lpDragValidity === 'invalid' ? 'rgba(239, 68, 68, 0.03)'
                    : undefined,
                } : {}
                return (
                  <div
                    key={`a-${row.reg.id}`}
                    className={`flex flex-col justify-center px-3 border-b border-border/10 transition-colors${clipboard ? ' cursor-pointer hover:bg-primary/5' : ''}${isPasteTarget ? ' bg-primary/8' : ''}`}
                    style={{ height: ROW_HEIGHT, ...lpDragStyle }}
                    onClick={() => {
                      if (clipboard) setClipboardTargetReg(row.reg.registration)
                    }}
                  >
                    <span className="text-[11px] font-semibold truncate leading-tight">
                      {row.reg.registration}
                    </span>
                    {row.cabin && (
                      <span className="text-[8.5px] text-muted-foreground leading-tight truncate">
                        {row.cabin}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── CENTER PANEL ───────────────────────────────────────── */}
        <div ref={centerPanelRef} className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Timeline header */}
          <div
            ref={headerRef}
            className="shrink-0 border-b overflow-hidden"
            style={{ height: headerH }}
          >
                <div ref={headerInnerRef} className="relative" style={{ width: totalWidth, height: headerH }}>
                  {Array.from({ length: zoomConfig.days }, (_, d) => {
                    const date = addDays(startDate, d)
                    const x = d * 24 * pixelsPerHour
                    const dayWidth = 24 * pixelsPerHour
                    const localDate = timeMode !== 'utc' ? getLocalDate(date, tzOffset) : date
                    const displayDate = timeMode === 'utc' ? date : localDate
                    const wkend = timeMode === 'utc' ? isWeekend(date) : isLocalWeekend(date, tzOffset)
                    const weekendHighlights = ganttSettings.display?.weekendHighlights ?? true
                    const isWkActive = wkend && weekendHighlights

                    return (
                      <div key={d}>
                        {/* Weekend column background (header only) */}
                        {isWkActive && (
                          <div
                            className="absolute top-0"
                            style={{
                              left: x, width: dayWidth, height: headerH,
                              background: isDark ? '#7F1D1D' : '#991B1B',
                            }}
                          />
                        )}
                        {/* Day label (centered in column) */}
                        <div
                          className="absolute top-0 text-[9px] font-medium select-none text-center"
                          style={{
                            left: x,
                            width: dayWidth,
                            color: isWkActive ? '#ffffff' : undefined,
                            fontWeight: isWkActive ? 700 : 500,
                            padding: '0 4px 1px 4px',
                            zIndex: 2,
                          }}
                        >
                          {formatDateShort(displayDate)}
                        </div>
                        {/* Day separator line */}
                        <div
                          className="absolute top-0 bottom-0 border-l border-black/[0.06] dark:border-white/[0.06]"
                          style={{ left: x }}
                        />
                        {/* Hour ticks */}
                        {hoursPerTick <= 12 &&
                          Array.from(
                            { length: Math.floor(24 / hoursPerTick) },
                            (_, h) => {
                              const hour = h * hoursPerTick
                              if (hour === 0) return null
                              const hx = x + hour * pixelsPerHour
                              const localHour = utcToLocal(hour, tzOffset)

                              return (
                                <div key={`${d}-${h}`}>
                                  <div
                                    className="absolute bottom-0"
                                    style={{
                                      left: hx, height: timeMode === 'dual' ? 12 : 8,
                                      borderLeft: isWkActive
                                        ? '1px solid rgba(255,255,255,0.2)'
                                        : '1px solid var(--border-subtle, rgba(0,0,0,0.03))',
                                    }}
                                  />
                                  {pixelsPerHour >= 8 && (
                                    timeMode === 'dual' ? (
                                      <div className="absolute select-none" style={{ left: hx }}>
                                        {/* UTC row (top) */}
                                        <div
                                          className="absolute pl-0.5"
                                          style={{
                                            top: 14,
                                            fontSize: '7px',
                                            color: isWkActive ? 'rgba(255,255,255,0.6)' : 'var(--muted-foreground-raw, rgba(113,113,122,0.5))',
                                            opacity: isWkActive ? 1 : 0.6,
                                            fontWeight: isWkActive ? 700 : undefined,
                                          }}
                                        >
                                          {String(hour).padStart(2, '0')}Z
                                        </div>
                                        {/* Local row (bottom) */}
                                        <div
                                          className="absolute pl-0.5"
                                          style={{
                                            top: 26,
                                            fontSize: '8px',
                                            fontWeight: isWkActive ? 700 : 600,
                                            color: isWkActive ? '#ffffff' : undefined,
                                          }}
                                        >
                                          {String(localHour).padStart(2, '0')}
                                        </div>
                                      </div>
                                    ) : (
                                      <div
                                        className="absolute bottom-1 text-[7px] pl-0.5 select-none"
                                        style={{
                                          left: hx,
                                          color: isWkActive ? '#ffffff' : undefined,
                                          fontWeight: isWkActive ? 700 : undefined,
                                          opacity: isWkActive ? 0.9 : 0.5,
                                        }}
                                      >
                                        {timeMode === 'utc'
                                          ? `${String(hour).padStart(2, '0')}Z`
                                          : String(localHour).padStart(2, '0')
                                        }
                                      </div>
                                    )
                                  )}
                                </div>
                              )
                            }
                          )}
                      </div>
                    )
                  })}
                </div>
          </div>

          {/* Histogram (34px) or collapsed spacer */}
          {(ganttSettings.display?.histogram ?? true) ? (
            <div
              ref={histogramRef}
              className="h-[34px] shrink-0 border-b overflow-hidden"
            >
              <div ref={histogramInnerRef} className="relative" style={{ width: totalWidth, height: 34 }}>
                {histogram.buckets.map((bucket, i) => {
                  if (bucket.count === 0) return null
                  const barHeight = Math.round((bucket.count / histogram.max) * 22)
                  const showLabel = bucket.widthPx > 18
                  return (
                    <div key={i}>
                      {/* Bar */}
                      <div
                        className="absolute bottom-0"
                        style={{
                          left: bucket.xPx,
                          width: bucket.widthPx,
                          height: barHeight,
                          borderRadius: '2px 2px 0 0',
                          background: 'var(--gantt-histogram-bar)',
                        }}
                      />
                      {/* Count label */}
                      {showLabel && (
                        <div
                          className="absolute text-center pointer-events-none select-none"
                          style={{
                            left: bucket.xPx,
                            width: bucket.widthPx,
                            bottom: barHeight + 1,
                            fontSize: '7px',
                            fontWeight: 600,
                            color: 'var(--gantt-histogram-label)',
                          }}
                        >
                          {bucket.count}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="h-[6px] shrink-0 border-b" />
          )}

          {/* Gantt Body */}
          <div
            ref={bodyRef}
            className="flex-1 overflow-auto select-none"
            onScroll={handleBodyScroll}
            onMouseDown={(e) => {
              // Only start rubber band on direct clicks on the gantt canvas (not on flight bars)
              if (e.button !== 0) return
              if (dragState) return // Don't start rubber band during drag
              if ((e.target as HTMLElement).closest('.group\\/bar')) return
              const rect = bodyRef.current!.getBoundingClientRect()
              const x = e.clientX - rect.left + bodyRef.current!.scrollLeft
              const y = e.clientY - rect.top + bodyRef.current!.scrollTop
              setRubberBand({ startX: x, startY: y, currentX: x, currentY: y })
              if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
                setSelectedFlights(new Set())
              }
              setContextMenu(null)
            }}
            onMouseMove={(e) => {
              const rect = bodyRef.current!.getBoundingClientRect()
              const x = e.clientX - rect.left + bodyRef.current!.scrollLeft
              const y = e.clientY - rect.top + bodyRef.current!.scrollTop
              // Drag takes priority
              if (dragState) {
                onBodyMouseMove(y, rowLayout)
                return
              }
              if (!rubberBand) return
              setRubberBand(prev => prev ? { ...prev, currentX: x, currentY: y } : null)
            }}
            onMouseUp={() => {
              if (dragState) { onBodyMouseUp(); return }
              if (!rubberBand) return
              // Check if the user actually dragged (not just a click)
              const dx = Math.abs(rubberBand.currentX - rubberBand.startX)
              const dy = Math.abs(rubberBand.currentY - rubberBand.startY)
              if (dx > 5 || dy > 5) {
                // Find intersecting flights
                const rx1 = Math.min(rubberBand.startX, rubberBand.currentX)
                const rx2 = Math.max(rubberBand.startX, rubberBand.currentX)
                const ry1 = Math.min(rubberBand.startY, rubberBand.currentY)
                const ry2 = Math.max(rubberBand.startY, rubberBand.currentY)

                const newSelection = new Set(selectedFlights)
                let yOff = 0
                for (const row of rows) {
                  const rh = row.type === 'group' ? GROUP_HEADER_HEIGHT : ROW_HEIGHT
                  if (row.type === 'aircraft' || row.type === 'overflow') {
                    const rowTop = yOff
                    const rowBottom = yOff + rh
                    if (rowBottom > ry1 && rowTop < ry2) {
                      const rowFlights = row.type === 'aircraft'
                        ? getRegFlightsSorted(row.reg.registration)
                        : getOverflowFlightsSorted(row.icaoType)
                      for (const ef of rowFlights) {
                        const fx = getFlightX(ef)
                        const fw = getFlightWidth(ef)
                        if (fx + fw > rx1 && fx < rx2) {
                          newSelection.add(ef.id)
                        }
                      }
                    }
                  }
                  yOff += rh
                }
                setSelectedFlights(newSelection)
              }
              setRubberBand(null)
            }}
          >
            <div className="relative" style={{ width: totalWidth, height: bodyHeight }}>
              {/* Background: midnight lines, hour grid (no weekend tint — header only) */}
              {(() => {
                return Array.from({ length: zoomConfig.days }, (_, d) => {
                  const date = addDays(startDate, d)
                  const x = d * 24 * pixelsPerHour
                  return (
                    <div key={`bg-${d}`}>
                      <div
                        className="absolute top-0 border-l border-black/[0.06] dark:border-white/[0.06]"
                        style={{ left: x, height: bodyHeight }}
                      />
                      {hoursPerTick <= 6 &&
                        Array.from(
                          { length: Math.floor(24 / hoursPerTick) },
                          (_, h) => {
                            const hour = h * hoursPerTick
                            if (hour === 0) return null
                            return (
                              <div
                                key={`grid-${d}-${h}`}
                                className="absolute top-0 border-l border-black/[0.02] dark:border-white/[0.02]"
                                style={{
                                  left: x + hour * pixelsPerHour,
                                  height: bodyHeight,
                                }}
                              />
                            )
                          }
                        )}
                    </div>
                  )
                })
              })()}

              {/* Flight bars + TAT labels */}
              {(() => {
                let yOffset = 0

                // Helper: render flight bars for a list of flights
                const renderFlightBars = (rowFlights: ExpandedFlight[], isOverflow: boolean, regCode: string) => {
                  const showTatLabels = (ganttSettings.display?.tatLabels ?? true) && zoomConfig.days <= 3
                  return rowFlights.map((ef, fi) => {
                    const x = getFlightX(ef)
                    const w = getFlightWidth(ef)
                    const isSelected = selectedFlights.has(ef.id)
                    const isHovered = hoveredFlightId === ef.id
                    const num = stripFlightPrefix(ef.flightNumber)
                    const isPublished = ef.status === 'published'
                    const isDbAssigned = !!ef.aircraftReg

                    // Color mode
                    const barColor = getBarColor(ef, ganttSettings.colorMode, ganttSettings, isDbAssigned, isDark)
                    const barBg = barColor.bg
                    const barText = barColor.useVars
                      ? (isDbAssigned
                          ? 'var(--gantt-bar-text-assigned)'
                          : isPublished
                            ? 'var(--gantt-bar-text-pub)'
                            : 'var(--gantt-bar-text-draft)')
                      : barColor.text

                    // Adaptive content based on bar label checkboxes
                    const bl = ganttSettings.barLabels
                    let content: React.ReactNode = null
                    const buildParts = (): string[] => {
                      const parts = [num]
                      if (bl.sector) parts.push(`${ef.depStation}-${ef.arrStation}`)
                      if (bl.times) parts.push(`${ef.stdLocal}-${ef.staLocal}`)
                      if (bl.blockTime) parts.push(formatBlockTimeBH(ef.blockMinutes))
                      return parts
                    }
                    if (w >= 105) {
                      content = <span className="truncate">{buildParts().join(' \u00B7 ')}</span>
                    } else if (w >= 50) {
                      const parts = buildParts()
                      content = <span className="truncate">{parts.length > 1 ? `${parts[0]} \u00B7 ${parts[1]}` : parts[0]}</span>
                    } else if (w >= 22) {
                      content = <span className="truncate">{num}</span>
                    }

                    // TAT gap label
                    let tatLabel: React.ReactNode = null
                    if (showTatLabels && fi < rowFlights.length - 1) {
                      const next = rowFlights[fi + 1]
                      if (formatISO(ef.date) === formatISO(next.date)) {
                        const tat = calcTat(ef, next)
                        if (tat && tat.gapMinutes > 0) {
                          const gapX = x + w
                          const gapW = getFlightX(next) - gapX
                          if (gapW >= 18) {
                            // Only show red warning color if both flights are DB-assigned
                            const bothDbAssigned = !!ef.aircraftReg && !!next.aircraftReg
                            const showWarning = bothDbAssigned && !tat.ok
                            tatLabel = (
                              <div
                                key={`tat-${ef.id}`}
                                className="absolute flex items-center justify-center pointer-events-none select-none"
                                style={{ left: gapX, width: gapW, top: 0, height: ROW_HEIGHT }}
                              >
                                <span className="font-semibold" style={{ fontSize: '7.5px', color: showWarning ? '#ef4444' : undefined }}>
                                  <span className={showWarning ? '' : 'text-muted-foreground'}>{tat.gapMinutes}m</span>
                                </span>
                              </div>
                            )
                          }
                        }
                      }
                    }

                    const barIsDragged = isDragged(ef.id)
                    const barIsGhost = isGhostPlaceholder(ef.id)
                    const wsReg = getWorkspaceReg(ef.flightId)
                    const hasDbReg = !!ef.aircraftReg
                    const hasWsOverride = wsReg !== undefined

                    // Bar status icon (top-right corner)
                    let barStatusIcon: React.ReactNode = null
                    if ((ganttSettings.display?.workspaceIcons ?? true) && w >= 28) {
                      if (hasDbReg && !isOverflow) {
                        barStatusIcon = (
                          <span className="absolute -top-0.5 -right-0.5 text-[7px] leading-none" style={{ color: '#16a34a', opacity: 0.7 }}>✓</span>
                        )
                      } else if (hasWsOverride) {
                        barStatusIcon = (
                          <span className="absolute -top-0.5 -right-0.5 text-[7px] leading-none" style={{ color: '#2563eb', opacity: 0.7 }}>⟳</span>
                        )
                      }
                    }

                    return (
                      <div key={ef.id}>
                        {/* Ghost placeholder (dotted outline at original position) */}
                        {barIsGhost && (
                          <div
                            className="absolute pointer-events-none"
                            style={{
                              left: x, width: w, height: BAR_HEIGHT, top: BAR_TOP,
                              border: '1.5px dashed rgba(100,100,100,0.3)',
                              borderRadius: 5,
                              background: 'transparent',
                              zIndex: 0,
                            }}
                          />
                        )}

                        {/* Actual flight bar */}
                        <div
                          className="absolute cursor-grab group/bar select-none"
                          style={{
                            left: x, width: w, height: BAR_HEIGHT, top: BAR_TOP,
                            zIndex: barIsDragged ? 100 : isSelected ? 10 : isHovered ? 5 : 1,
                            transform: barIsDragged
                              ? `translateY(${getDragDeltaY(0)}px) scale(1.03)`
                              : undefined,
                            opacity: barIsDragged ? 0.65 : 1,
                            pointerEvents: barIsDragged ? 'none' : undefined,
                            transition: barIsDragged ? undefined : 'transform 150ms ease-out',
                          }}
                          onClick={(e) => { if (!dragState) handleBarClick(ef.id, e) }}
                          onMouseDown={(e) => onBarMouseDown(ef.id, regCode, e)}
                          onContextMenu={(e) => handleBarContextMenu(e, ef.id)}
                          onDoubleClick={(e) => { e.stopPropagation(); handleBarDoubleClick(ef) }}
                          onTouchEnd={() => {
                            const now = Date.now()
                            if (lastTapRef.current && lastTapRef.current.id === ef.id && now - lastTapRef.current.time < 400) {
                              handleBarDoubleClick(ef)
                              lastTapRef.current = null
                            } else {
                              lastTapRef.current = { id: ef.id, time: now }
                            }
                          }}
                          onMouseEnter={(e) => { if (!dragState) { tooltipPosRef.current = { x: e.clientX, y: e.clientY }; setHoveredFlightId(ef.id) } }}
                          onMouseMove={(e) => { tooltipPosRef.current = { x: e.clientX, y: e.clientY } }}
                          onMouseLeave={() => setHoveredFlightId(null)}
                        >
                          <div
                            className={`w-full h-full flex items-center px-1 overflow-hidden relative${justPastedIds.has(ef.flightId) ? ' animate-pulse' : ''}`}
                            style={{
                              borderRadius: 5,
                              background: barBg,
                              border: !isPublished
                                ? isDbAssigned
                                  ? '2px dashed var(--gantt-bar-border-draft)'
                                  : '1.5px dashed var(--gantt-bar-border-draft)'
                                : isDbAssigned
                                  ? '2px solid var(--gantt-bar-border-pub-assigned)'
                                  : '1.5px solid var(--gantt-bar-border-pub)',
                              fontStyle: isPublished ? 'normal' : 'italic',
                              color: barText,
                              fontSize: BAR_FONT + 'px',
                              boxShadow: barIsDragged
                                ? '0 8px 24px rgba(0,0,0,0.15)'
                                : isSelected
                                  ? '0 0 0 3px rgba(59, 130, 246, 0.35), 0 0 14px rgba(59, 130, 246, 0.15)'
                                  : justPastedIds.has(ef.flightId)
                                    ? '0 0 0 2px rgba(34, 197, 94, 0.4), 0 0 12px rgba(34, 197, 94, 0.15)'
                                    : 'none',
                              opacity: isFlightGhosted(ef.id, ef.flightId) ? 0.25 : 1,
                              backgroundImage: isFlightGhosted(ef.id, ef.flightId)
                                ? 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.03) 3px, rgba(0,0,0,0.03) 6px)'
                                : undefined,
                            }}
                          >
                            {content}
                            {barStatusIcon}
                          </div>

                        </div>
                        {tatLabel}
                      </div>
                    )
                  })
                }

                return rows.map((row) => {
                  const currentY = yOffset
                  if (row.type === 'group') {
                    yOffset += GROUP_HEADER_HEIGHT
                    return (
                      <div
                        key={`gr-${row.icaoType}`}
                        className="absolute left-0 right-0 border-b border-border/10"
                        style={{ top: currentY, height: GROUP_HEADER_HEIGHT }}
                      />
                    )
                  }

                  if (row.type === 'overflow') {
                    yOffset += ROW_HEIGHT
                    const rowFlights = getOverflowFlightsSorted(row.icaoType)
                    return (
                      <div
                        key={`overflow-${row.icaoType}`}
                        className="absolute left-0 border-b border-border/10"
                        style={{
                          top: currentY, height: ROW_HEIGHT, width: totalWidth,
                          background: 'rgba(239, 68, 68, 0.03)',
                        }}
                      >
                        {renderFlightBars(rowFlights, true, 'Unassigned')}
                      </div>
                    )
                  }

                  // type === 'aircraft'
                  yOffset += ROW_HEIGHT
                  const reg = row.reg
                  const rowFlights = getRegFlightsSorted(reg.registration)
                  const isRowPasteTarget = clipboard?.targetReg === reg.registration

                  // Drag target highlight
                  const isRowDragTarget = dragState && targetRow?.registration === reg.registration
                  const dragValidity = isRowDragTarget ? targetRow!.validity : null
                  const dragRowStyle: React.CSSProperties = isRowDragTarget ? {
                    borderLeft: dragValidity === 'valid' ? '3px solid #3b82f6'
                      : dragValidity === 'same-family' ? '3px solid #f59e0b'
                      : dragValidity === 'invalid' ? '3px solid #ef4444'
                      : undefined,
                    background: dragValidity === 'valid' ? 'rgba(59, 130, 246, 0.03)'
                      : dragValidity === 'same-family' ? 'rgba(245, 158, 11, 0.03)'
                      : dragValidity === 'invalid' ? 'rgba(239, 68, 68, 0.03)'
                      : undefined,
                    cursor: dragValidity === 'invalid' ? 'not-allowed' : undefined,
                  } : {}

                  return (
                    <div
                      key={`row-${reg.id}`}
                      className={`absolute left-0 border-b border-border/10${clipboard ? ' cursor-pointer' : ''}`}
                      style={{
                        top: currentY, height: ROW_HEIGHT, width: totalWidth,
                        background: isRowPasteTarget ? 'rgba(59, 130, 246, 0.04)' : undefined,
                        ...dragRowStyle,
                      }}
                      onClick={() => {
                        if (clipboard) setClipboardTargetReg(reg.registration)
                      }}
                    >
                      {renderFlightBars(rowFlights, false, reg.registration)}

                      {/* EOD location badges */}
                      {showEodBadges && (() => {
                        const regKey = reg.registration
                        const base = reg.home_base?.iata_code

                        if (eodEveryDay) {
                          // ≤7D: badge at every day boundary
                          return Array.from({ length: zoomConfig.days }, (_, d) => {
                            const dateKey = formatISO(addDays(startDate, d))
                            const eod = eodLocations.get(`${regKey}|${dateKey}`)
                            const station = eod?.station ?? base
                            if (!station) return null
                            const dayEndX = (d + 1) * 24 * pixelsPerHour
                            const mismatch = eod?.mismatch ?? false
                            return (
                              <div
                                key={`eod-${d}`}
                                className="absolute pointer-events-none select-none"
                                style={{ left: dayEndX, top: ROW_HEIGHT / 2 - 7, transform: 'translateX(-100%)', zIndex: 1 }}
                              >
                                <span style={{
                                  fontSize: '7px', fontWeight: 700, letterSpacing: '0.03em',
                                  color: mismatch ? '#d97706' : 'var(--gantt-eod-text)',
                                  background: mismatch ? 'rgba(217,119,6,0.1)' : 'var(--gantt-eod-bg)',
                                  border: mismatch ? '1px solid rgba(217,119,6,0.3)' : '1px solid var(--gantt-eod-border)',
                                  borderRadius: 3, padding: '1px 4px',
                                }}>
                                  {station}
                                </span>
                              </div>
                            )
                          })
                        } else {
                          // >7D: one badge at the right edge — last flight's arrival or base
                          let lastStation: string | null = null
                          for (let d = zoomConfig.days - 1; d >= 0; d--) {
                            const dateKey = formatISO(addDays(startDate, d))
                            const eod = eodLocations.get(`${regKey}|${dateKey}`)
                            if (eod) { lastStation = eod.station; break }
                          }
                          const station = lastStation ?? base
                          if (!station) return null
                          const rightEdgeX = zoomConfig.days * 24 * pixelsPerHour
                          return (
                            <div
                              key="eod-end"
                              className="absolute pointer-events-none select-none"
                              style={{ left: rightEdgeX, top: ROW_HEIGHT / 2 - 7, transform: 'translateX(-100%)', zIndex: 1 }}
                            >
                              <span style={{
                                fontSize: '7px', fontWeight: 700, letterSpacing: '0.03em',
                                color: 'var(--gantt-eod-text)', background: 'var(--gantt-eod-bg)',
                                border: '1px solid var(--gantt-eod-border)', borderRadius: 3, padding: '1px 4px',
                              }}>
                                {station}
                              </span>
                            </div>
                          )
                        }
                      })()}
                    </div>
                  )
                })
              })()}

              {/* Rubber band selection rectangle */}
              {rubberBand && (() => {
                const dx = Math.abs(rubberBand.currentX - rubberBand.startX)
                const dy = Math.abs(rubberBand.currentY - rubberBand.startY)
                if (dx < 5 && dy < 5) return null
                return (
                  <div
                    className="absolute pointer-events-none z-30"
                    style={{
                      left: Math.min(rubberBand.startX, rubberBand.currentX),
                      top: Math.min(rubberBand.startY, rubberBand.currentY),
                      width: dx,
                      height: dy,
                      background: 'rgba(59, 130, 246, 0.08)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: 2,
                    }}
                  />
                )
              })()}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL (Rotation Panel) ─────────────────────── */}
        <div className="w-[280px] shrink-0 glass border-l flex flex-col overflow-hidden">
          {selectedFlight && panelData ? (
            <>
              {/* Panel Header */}
              <div className="shrink-0 px-3 py-2.5 border-b flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold truncate">
                    {panelData.regCode} Rotation
                  </div>
                  <span className="inline-flex px-1.5 py-0.5 text-[9px] font-medium rounded bg-muted text-muted-foreground mt-0.5">
                    {panelData.icao}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedFlights(new Set())}
                  className="p-1 rounded-md hover:bg-muted transition-colors shrink-0"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>

              {/* Panel Body (scrollable) */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-3 space-y-3">

                  {/* ── Section 1: Selected Flight Card ── */}
                  <div className="rounded-lg border border-border/50 p-2.5">
                    <div className="flex items-center justify-between">
                      <div className="text-center">
                        <div className="text-sm font-bold">{selectedFlight.depStation}</div>
                        <div className="text-[9px] text-muted-foreground">{selectedFlight.stdLocal}</div>
                      </div>
                      <div className="flex-1 flex items-center justify-center px-2">
                        <div className="flex-1 h-px bg-border" />
                        <span className="px-1.5 text-[9px] text-muted-foreground">→</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold">{selectedFlight.arrStation}</div>
                        <div className="text-[9px] text-muted-foreground">{selectedFlight.staLocal}</div>
                      </div>
                    </div>
                    <div className="text-center text-[9px] text-muted-foreground mt-1">
                      {formatBlockTime(selectedFlight.blockMinutes)}
                    </div>
                    <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border/30 text-[9px] text-muted-foreground">
                      <span>{panelData.icao} · {panelData.regCode}</span>
                      <span>{panelData.cabin || ''}</span>
                    </div>
                  </div>

                  {/* ── Section 2: Daily Rotation ── */}
                  <div>
                    <div className="text-[10px] font-medium text-muted-foreground mb-1.5">
                      Daily Rotation · {panelData.dateStr}
                    </div>
                    {panelData.hasAutoAssigned && (
                      <div className="text-[10px] italic text-muted-foreground/60 mb-1.5">
                        Auto-assigned rotation preview
                      </div>
                    )}
                    <div className="space-y-0">
                      {panelData.rotation.map((rf, i) => {
                        const isSel = rf.id === selectedFlight.id
                        const num = stripFlightPrefix(rf.flightNumber)
                        const isPub = rf.status === 'published'
                        const nextFlight = i < panelData.rotation.length - 1 ? panelData.rotation[i + 1] : null
                        const sameRouteAsNext = nextFlight && rf.routeId && nextFlight.routeId && rf.routeId === nextFlight.routeId
                        return (
                          <div key={rf.id}>
                            {/* Route block separator */}
                            {rf.routeBlockStart && i > 0 && (
                              <div className="mx-2 my-1.5 border-t border-border/40" />
                            )}
                            {/* Flight row */}
                            <div
                              className={`flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer transition-colors ${
                                isSel
                                  ? 'bg-[#fef2f2] dark:bg-[#1e1015]'
                                  : 'hover:bg-muted/30'
                              }`}
                              style={isSel ? { borderLeft: '3px solid #991b1b' } : { borderLeft: '3px solid transparent' }}
                              onClick={() => setSelectedFlights(new Set([rf.id]))}
                            >
                              <div className="min-w-0">
                                <span className="text-[11px] font-semibold">{num}</span>
                                <span className="text-[10px] text-muted-foreground ml-1">
                                  {rf.depStation}→{rf.arrStation}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[9px] text-muted-foreground">
                                  {rf.stdLocal}-{rf.staLocal}
                                </span>
                                <span
                                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold ${
                                    isPub
                                      ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                  }`}
                                >
                                  {isPub ? 'P' : 'D'}
                                </span>
                              </div>
                            </div>

                            {/* TAT indicator between flights */}
                            {rf.tatToNext && nextFlight && (() => {
                              const bothDbAssigned = !!rf.aircraftReg && !!nextFlight.aircraftReg
                              // Station mismatch — only warn between DB-assigned different routes
                              if (bothDbAssigned && !sameRouteAsNext && rf.arrStation !== nextFlight.depStation) {
                                return (
                                  <div className="mx-2 my-0.5 px-2 py-1 rounded text-[9px] bg-amber-500/10 text-amber-700 dark:text-amber-400">
                                    <AlertTriangle className="h-2.5 w-2.5 inline mr-1" />
                                    Station mismatch: {rf.arrStation} ≠ {nextFlight.depStation}
                                  </div>
                                )
                              }
                              // Insufficient TAT — only warn between DB-assigned different routes
                              if (bothDbAssigned && !sameRouteAsNext && !rf.tatToNext!.ok) {
                                return (
                                  <div className="mx-2 my-0.5 px-2 py-1 rounded text-[9px] bg-red-500/10 text-red-700 dark:text-red-400">
                                    <AlertTriangle className="h-2.5 w-2.5 inline mr-1" />
                                    TAT {rf.tatToNext!.gapMinutes}min &lt; min {rf.tatToNext!.minTat}min
                                  </div>
                                )
                              }
                              // Informational TAT duration (always shown, no warning styling)
                              return (
                                <div className="mx-2 my-0.5 text-[8px] text-muted-foreground/60 text-center">
                                  TAT: {rf.tatToNext!.gapMinutes}min
                                </div>
                              )
                            })()}

                            {/* Station mismatch without TAT (when calcTat returns null but stations differ) */}
                            {!rf.tatToNext && nextFlight && !sameRouteAsNext && (() => {
                              const bothDbAssigned = !!rf.aircraftReg && !!nextFlight.aircraftReg
                              if (bothDbAssigned && rf.arrStation !== nextFlight.depStation) {
                                return (
                                  <div className="mx-2 my-0.5 px-2 py-1 rounded text-[9px] bg-amber-500/10 text-amber-700 dark:text-amber-400">
                                    <AlertTriangle className="h-2.5 w-2.5 inline mr-1" />
                                    Station mismatch: {rf.arrStation} ≠ {nextFlight.depStation}
                                  </div>
                                )
                              }
                              // Gap info (informational)
                              const gap = nextFlight.stdMinutes - rf.staMinutes
                              if (gap > 0) {
                                return (
                                  <div className="mx-2 my-0.5 text-[8px] text-muted-foreground/60 text-center">
                                    TAT: {gap}min
                                  </div>
                                )
                              }
                              return null
                            })()}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* ── Section 3: Daily Utilization ── */}
                  <div>
                    <div className="text-[10px] font-medium text-muted-foreground mb-1.5">
                      Daily Utilization
                    </div>
                    <div className="rounded-lg border border-border/50 p-2.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span>{panelData.flightCount} flights</span>
                        <span className="font-semibold">{formatBlockTime(panelData.totalBlock)} block</span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, panelData.utilPct)}%`,
                            background:
                              panelData.utilPct >= 85
                                ? '#22c55e'
                                : panelData.utilPct >= 60
                                  ? '#f59e0b'
                                  : '#ef4444',
                          }}
                        />
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-1">
                        {panelData.utilPct}% of {panelData.targetHours}h target
                      </div>
                    </div>
                  </div>

                  {/* ── Section 4: Conflict Cards ── */}
                  {(ganttSettings.display?.conflictIndicators ?? true) && panelData.conflicts.length > 0 && (
                    <div>
                      <div className="text-[10px] font-medium text-red-600 dark:text-red-400 mb-1.5 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {panelData.conflicts.length} Issue{panelData.conflicts.length > 1 ? 's' : ''} Detected
                      </div>
                      <div className="space-y-2">
                        {panelData.conflicts.map((c, i) => (
                          <div key={i} className="rounded-lg border border-red-200 dark:border-red-900/50 p-2.5 space-y-2">
                            <div className="flex items-center gap-1.5">
                              {c.type === 'overlap' && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[8px] font-medium rounded bg-red-500/10 text-red-700 dark:text-red-400">
                                  <Timer className="h-2.5 w-2.5" /> Time Overlap
                                </span>
                              )}
                              {c.type === 'insufficient_tat' && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[8px] font-medium rounded bg-red-500/10 text-red-700 dark:text-red-400">
                                  <Timer className="h-2.5 w-2.5" /> Insufficient TAT
                                </span>
                              )}
                              {c.type === 'station_mismatch' && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[8px] font-medium rounded bg-amber-500/10 text-amber-700 dark:text-amber-400">
                                  <Link2 className="h-2.5 w-2.5" /> Station Mismatch
                                </span>
                              )}
                            </div>
                            <div className="text-[9px] text-muted-foreground leading-relaxed">
                              {c.detail}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {c.type === 'station_mismatch' ? (
                                <>
                                  <button className="px-2 py-0.5 text-[8px] font-medium rounded border border-border hover:bg-muted transition-colors">
                                    Insert Ferry
                                  </button>
                                  <button className="px-2 py-0.5 text-[8px] font-medium rounded border border-border hover:bg-muted transition-colors">
                                    Move to Other AC
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button className="px-2 py-0.5 text-[8px] font-medium rounded border border-border hover:bg-muted transition-colors">
                                    Adjust STD (min TAT)
                                  </button>
                                  <button className="px-2 py-0.5 text-[8px] font-medium rounded border border-border hover:bg-muted transition-colors">
                                    Move to Other AC
                                  </button>
                                </>
                              )}
                              <button className="px-2 py-0.5 text-[8px] font-medium rounded border border-border hover:bg-muted transition-colors text-muted-foreground">
                                Ignore
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Section 5: AI Assist ── */}
                  <div
                    className="rounded-lg p-2.5 space-y-1"
                    style={{
                      background: 'var(--gantt-ai-bg)',
                      border: '1px solid var(--gantt-ai-border)',
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3" style={{ color: 'var(--gantt-ai-accent)' }} />
                      <span className="text-[10px] font-semibold" style={{ color: 'var(--gantt-ai-accent)' }}>
                        AI ASSIST
                      </span>
                      <span className="px-1 py-0.5 text-[7px] font-medium rounded bg-muted text-muted-foreground">
                        COMING SOON
                      </span>
                    </div>
                    <p className="text-[9px] text-muted-foreground leading-relaxed">
                      Optimise aircraft rotation, suggest swaps to minimise ground time, and auto-resolve conflicts.
                    </p>
                  </div>

                </div>
              </div>

              {/* Panel Footer */}
              <div className="shrink-0 p-2.5 border-t space-y-1.5">
                <button className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-medium rounded-md border border-border hover:bg-muted transition-colors">
                  <ExternalLink className="h-3 w-3" />
                  Open in Builder
                </button>
                <button className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                  <PenLine className="h-3 w-3" />
                  Edit Flight
                </button>
              </div>
            </>
          ) : (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4">
              <PlaneTakeoff className="h-8 w-8 text-muted-foreground/30" />
              <div className="text-[13px] font-semibold text-muted-foreground">
                No flight selected
              </div>
              <div className="text-[11px] text-muted-foreground/60 text-center">
                Click a flight bar to view details
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── LEGEND BAR ─────────────────────────────────────────────── */}
      <div className="shrink-0 glass border-t px-4 py-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div
              className="w-5 h-3 rounded-[3px]"
              style={{ background: 'var(--gantt-bar-bg-assigned)', border: '1.5px solid var(--gantt-bar-border-pub-assigned)' }}
            />
            <span>Assigned</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-5 h-3 rounded-[3px]"
              style={{ background: 'var(--gantt-bar-bg-unassigned)', border: '1.5px solid var(--gantt-bar-border-pub)' }}
            />
            <span>Unassigned</span>
          </div>
          <div className="w-px h-3 bg-border" />
          <div className="flex items-center gap-1.5">
            <div
              className="w-5 h-3 rounded-[3px]"
              style={{ background: 'var(--gantt-bar-bg-unassigned)', border: '1.5px solid var(--gantt-bar-border-pub)' }}
            />
            <span>Published</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-5 h-3 rounded-[3px]"
              style={{ background: 'var(--gantt-bar-bg-unassigned)', border: '1.5px dashed var(--gantt-bar-border-draft)' }}
            />
            <span>Draft</span>
          </div>
          <div className="w-px h-3 bg-border" />
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-3 rounded-[3px] bg-black/[0.012] dark:bg-white/[0.012] border border-border/20" />
            <span>Weekend</span>
          </div>
        </div>
      </div>

      {/* ── DELETE MODAL ──────────────────────────────────────────── */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Trash2 className="h-4 w-4 text-destructive" />
              Delete from Schedule
            </DialogTitle>
          </DialogHeader>

          <p className="text-[11px] text-muted-foreground -mt-1">What would you like to remove?</p>

          <div className="space-y-2 mt-1">
            {/* Option: single flight */}
            <label
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                deleteChoice === 'single'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/30'
              }`}
              onClick={() => setDeleteChoice('single')}
            >
              <input type="radio" name="deleteChoice" checked={deleteChoice === 'single'} onChange={() => setDeleteChoice('single')} className="mt-0.5 accent-primary" />
              <div className="min-w-0">
                <div className="text-[12px] font-medium">This flight only</div>
                {selectedFlight && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {selectedFlight.flightNumber} · {selectedFlight.depStation} → {selectedFlight.arrStation} · {selectedFlight.stdLocal}–{selectedFlight.staLocal}
                    <br />
                    {selectedFlight.periodStart} to {selectedFlight.periodEnd}
                  </div>
                )}
              </div>
            </label>

            {/* Option: entire route (only when linked) */}
            {selectedFlight?.routeId && (
              <label
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  deleteChoice === 'route'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/30'
                }`}
                onClick={() => setDeleteChoice('route')}
              >
                <input type="radio" name="deleteChoice" checked={deleteChoice === 'route'} onChange={() => setDeleteChoice('route')} className="mt-0.5 accent-primary" />
                <div className="min-w-0">
                  <div className="text-[12px] font-medium">Entire route</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Delete the route and all its legs + builder flights
                  </div>
                </div>
              </label>
            )}
          </div>

          <DialogFooter className="mt-2">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="px-3 py-1.5 text-[11px] font-medium rounded-md border border-border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MINI BUILDER MODAL ────────────────────────────────────── */}
      {miniBuilderFlight && (
        <MiniBuilderModal
          open={miniBuilderOpen}
          onClose={() => { setMiniBuilderOpen(false); setMiniBuilderFlight(null) }}
          flight={miniBuilderFlight}
          route={miniBuilderRoute}
          loading={miniBuilderLoading}
          onSaved={refreshFlights}
        />
      )}

      {/* ── CONTEXT MENU ────────────────────────────────────────── */}
      {contextMenu && selectedFlights.size > 0 && (
        <GanttContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          selectionCount={selectedFlights.size}
          hasDbAssigned={selectedFlightObjects.some(f => !!f.aircraftReg)}
          hasClipboard={!!clipboard}
          onCut={() => {
            setContextMenu(null)
            // Trigger cut via same logic as Ctrl+X
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', ctrlKey: true }))
          }}
          onCopy={() => {
            setContextMenu(null)
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }))
          }}
          onPaste={() => {
            setContextMenu(null)
            if (clipboard) {
              if (!clipboard.targetReg) setPasteTargetOpen(true)
              else setPasteModalOpen(true)
            }
          }}
          onAssign={() => { setContextMenu(null); setAssignModalOpen(true) }}
          onUnassign={() => {
            setContextMenu(null)
            setUnassignModalOpen(true)
          }}
          onEdit={() => {
            setContextMenu(null)
            const ef = selectedFlightObjects[0]
            if (ef) handleBarDoubleClick(ef)
          }}
          onDelete={() => {
            setContextMenu(null)
            setDeleteChoice('single')
            setDeleteModalOpen(true)
          }}
        />
      )}

      {/* ── ASSIGN TO AIRCRAFT MODAL ────────────────────────────── */}
      {assignModalOpen && (
        <AssignToAircraftModal
          open={assignModalOpen}
          onClose={() => setAssignModalOpen(false)}
          selectedFlights={selectedFlightObjects}
          registrations={registrations}
          aircraftTypes={aircraftTypes}
          seatingConfigs={seatingConfigs}
          flightsByReg={flightsByReg}
          acTypeByIcao={acTypeByIcao}
          onAssigned={(items, registration) => {
            setAssignModalOpen(false)
            setSelectedFlights(new Set())
            applyOptimisticAssign(items, registration)
            refreshFlights()
          }}
        />
      )}

      {/* ── UNASSIGN CONFIRMATION MODAL ─────────────────────────── */}
      <UnassignModal
        open={unassignModalOpen}
        onClose={() => setUnassignModalOpen(false)}
        selectedFlightObjects={selectedFlightObjects}
        onConfirm={async (finalItems) => {
          const res = await unassignFlightsTail(finalItems)
          if (res.error) { toast.error(friendlyError(res.error)); return }
          toast.success(`${finalItems.length} flight${finalItems.length > 1 ? 's' : ''} unassigned`)
          applyOptimisticUnassign(finalItems)
          setUnassignModalOpen(false)
          setSelectedFlights(new Set())
          refreshFlights()
        }}
      />

      {/* ── DROP CONFIRMATION DIALOG ────────────────────────────── */}
      {pendingDrop && (
        <DropConfirmDialog
          open={!!pendingDrop}
          onClose={cancelDrop}
          onConfirm={confirmDrop}
          pendingDrop={pendingDrop}
          getFlightDetails={(eid) => {
            const ef = assignedFlights.find(f => f.id === eid)
            if (!ef) return null
            return { flightNumber: ef.flightNumber, depStation: ef.depStation, arrStation: ef.arrStation, date: ef.date, stdLocal: ef.stdLocal }
          }}
          getTypeName={(icao) => acTypeByIcao.get(icao)?.name || icao}
        />
      )}

      {/* ── CLIPBOARD PILL ─────────────────────────────────────── */}
      <GanttClipboardPill
        clipboard={clipboard}
        undo={clipboardUndo}
        onClear={clearClipboard}
        onUndo={executeClipboardUndo}
      />

      {/* ── PASTE TARGET DIALOG ────────────────────────────────── */}
      <GanttPasteTargetDialog
        open={pasteTargetOpen}
        onClose={() => setPasteTargetOpen(false)}
        registrations={registrations}
        onSelect={(reg) => {
          setClipboardTargetReg(reg)
          setPasteTargetOpen(false)
          setPasteModalOpen(true)
        }}
      />

      {/* ── PASTE MODAL ────────────────────────────────────────── */}
      {clipboard && clipboard.targetReg && (
        <GanttPasteModal
          open={pasteModalOpen}
          onClose={() => setPasteModalOpen(false)}
          clipboard={clipboard}
          onPaste={executePaste}
          pasting={pasting}
        />
      )}

      {/* ── SETTINGS MODAL ──────────────────────────────────── */}
      <GanttSettingsPanel
        open={settingsPanelOpen}
        onClose={() => setSettingsPanelOpen(false)}
        settings={ganttSettings}
        aircraftTypes={aircraftTypes}
        airports={airports}
        serviceTypes={serviceTypes}
        saveStatus={saveStatus}
        onUpdateDisplay={updateDisplay}
        onUpdateColorAssignment={updateColorAssignment}
        onUpdateColorAcType={updateColorAcType}
        onUpdateColorServiceType={updateColorServiceType}
        onUpdateTooltip={updateTooltip}
        onUpdateSettings={updateGanttSettings}
        onUpdateUtilTarget={updateUtilTarget}
        onResetUtilTarget={resetUtilTarget}
        onUpdateTatOverride={updateTatOverride}
        onResetTatOverride={resetTatOverride}
        onResetAll={resetAllSettings}
      />

      {/* ── Fixed-position tooltip (rendered outside scroll containers) ── */}
      {hoveredFlight && !dragState && hoveredTooltipInfo && (
        <FlightTooltip
          flight={hoveredFlight}
          tat={hoveredTat}
          cabinConfig={hoveredTooltipInfo.cabin}
          regCode={hoveredTooltipInfo.regCode}
          cursorRef={tooltipPosRef}
          tooltipSettings={ganttSettings.tooltip}
        />
      )}

    </div>
  )
}

// ─── Flight Tooltip ──────────────────────────────────────────────────────

function FlightTooltip({
  flight,
  tat,
  cabinConfig,
  regCode,
  cursorRef,
  tooltipSettings,
}: {
  flight: ExpandedFlight
  tat: TatInfo | null
  cabinConfig: string
  regCode: string | null
  cursorRef: React.MutableRefObject<{ x: number; y: number }>
  tooltipSettings: GanttSettingsData['tooltip']
}) {
  const isPublished = flight.status === 'published'
  const dateStr = flight.date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })

  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = tooltipRef.current
    if (!el) return

    function reposition(x: number, y: number) {
      const tooltipW = el!.offsetWidth
      const tooltipH = el!.offsetHeight
      const MARGIN = 14
      const EDGE_PAD = 8
      const vpW = window.innerWidth
      const vpH = window.innerHeight

      // Default: to the right and above cursor
      let left = x + MARGIN
      let top = y - MARGIN - tooltipH

      // If above viewport → flip below cursor
      if (top < EDGE_PAD) {
        top = y + MARGIN
      }
      // If below viewport → clamp to bottom
      if (top + tooltipH > vpH - EDGE_PAD) {
        top = vpH - tooltipH - EDGE_PAD
      }
      // If still above viewport (very tall tooltip) → clamp to top
      if (top < EDGE_PAD) {
        top = EDGE_PAD
      }
      // If right of viewport → flip to left of cursor
      if (left + tooltipW > vpW - EDGE_PAD) {
        left = x - tooltipW - MARGIN
      }
      // If left of viewport → clamp to left
      if (left < EDGE_PAD) {
        left = EDGE_PAD
      }

      el!.style.left = left + 'px'
      el!.style.top = top + 'px'
      el!.style.visibility = 'visible'
    }

    // Position immediately with current cursor position
    reposition(cursorRef.current.x, cursorRef.current.y)

    // Follow cursor via document listener (no re-renders)
    const onMove = (e: MouseEvent) => reposition(e.clientX, e.clientY)
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [cursorRef])

  return (
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        left: -9999,
        top: -9999,
        visibility: 'hidden',
        zIndex: 1000,
        pointerEvents: 'none',
        minWidth: 220,
      }}
    >
      <div
        className="rounded-xl p-3 space-y-2 text-[11px]"
        style={{
          background: 'var(--gantt-tooltip-bg)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid var(--gantt-tooltip-border)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        {/* Header: badge + status */}
        {tooltipSettings.flightNumber && (
          <div className="flex items-center justify-between">
            <span
              className="font-bold text-xs px-1.5 py-0.5 rounded"
              style={{
                background: isPublished
                  ? 'color-mix(in srgb, var(--gantt-bar-border-pub) 12%, transparent)'
                  : 'color-mix(in srgb, var(--gantt-bar-border-draft) 12%, transparent)',
                color: isPublished ? 'var(--gantt-bar-border-pub)' : 'var(--gantt-bar-text-draft)',
              }}
            >
              {flight.flightNumber}
            </span>
            <span
              className="text-[9px] font-medium uppercase tracking-wider"
              style={{ color: isPublished ? '#16a34a' : '#d97706' }}
            >
              {flight.status}
            </span>
          </div>
        )}

        {/* Route */}
        {tooltipSettings.stations && (
          <div className="flex items-center justify-between">
            <div className="text-center">
              <div className="text-sm font-bold" style={{ color: 'var(--gantt-tooltip-heading)' }}>
                {flight.depStation}
              </div>
              {tooltipSettings.times && (
                <div className="text-[9px]" style={{ color: 'var(--gantt-tooltip-body)' }}>
                  {flight.stdLocal}
                </div>
              )}
            </div>
            <div className="flex-1 flex items-center justify-center px-2">
              <div className="flex-1 h-px bg-border" />
              <span className="px-1.5 text-[9px]" style={{ color: 'var(--gantt-tooltip-muted)' }}>→</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="text-center">
              <div className="text-sm font-bold" style={{ color: 'var(--gantt-tooltip-heading)' }}>
                {flight.arrStation}
              </div>
              {tooltipSettings.times && (
                <div className="text-[9px]" style={{ color: 'var(--gantt-tooltip-body)' }}>
                  {flight.staLocal}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Block time */}
        {tooltipSettings.blockTime && (
          <div className="text-center text-[10px]" style={{ color: 'var(--gantt-tooltip-body)' }}>
            {formatBlockTime(flight.blockMinutes)}
          </div>
        )}

        {/* AC info + date */}
        {(tooltipSettings.aircraft || tooltipSettings.cabin) && (
          <div className="flex items-center justify-between pt-1 border-t border-border/30">
            {tooltipSettings.aircraft && (
              <div className="text-[10px]" style={{ color: 'var(--gantt-tooltip-body)' }}>
                {flight.aircraftTypeIcao || '—'} · {regCode || <span style={{ color: 'var(--gantt-tooltip-muted)', fontStyle: 'italic' }}>Tail not assigned</span>}
              </div>
            )}
            <div className="text-right">
              <div className="text-[10px]" style={{ color: 'var(--gantt-tooltip-body)' }}>
                {dateStr}
              </div>
              {tooltipSettings.cabin && cabinConfig && (
                <div className="text-[9px]" style={{ color: 'var(--gantt-tooltip-muted)' }}>
                  {cabinConfig}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAT info */}
        {tooltipSettings.tat && tat && (
          <div className="flex items-center gap-1.5 pt-1 border-t border-border/30">
            <Check
              className="h-3 w-3 shrink-0"
              style={{ color: tat.ok ? '#16a34a' : '#ef4444' }}
            />
            <span style={{ color: tat.ok ? '#16a34a' : '#ef4444', fontSize: '10px' }}>
              TAT to next: {tat.gapMinutes}min (min:{tat.minTat})
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Context Menu ──────────────────────────────────────────────────────

function GanttContextMenu({
  x, y, selectionCount, hasDbAssigned, hasClipboard,
  onCut, onCopy, onPaste,
  onAssign, onUnassign, onEdit, onDelete,
}: {
  x: number; y: number; selectionCount: number; hasDbAssigned: boolean; hasClipboard: boolean
  onCut: () => void; onCopy: () => void; onPaste: () => void
  onAssign: () => void; onUnassign: () => void; onEdit: () => void; onDelete: () => void
}) {
  const isSingle = selectionCount === 1

  const menuItems: { label: string; shortcut?: string; onClick: () => void; show: boolean; separator?: boolean; destructive?: boolean; disabled?: boolean }[] = [
    { label: isSingle ? 'Cut Flight' : `Cut ${selectionCount} Flights`, shortcut: 'Ctrl+X', onClick: onCut, show: true },
    { label: isSingle ? 'Copy Flight' : `Copy ${selectionCount} Flights`, shortcut: 'Ctrl+C', onClick: onCopy, show: true },
    { label: 'Paste', shortcut: 'Ctrl+V', onClick: onPaste, show: true, disabled: !hasClipboard },
    { label: '', onClick: () => {}, show: true, separator: true },
    { label: isSingle ? 'Assign to Aircraft...' : `Assign ${selectionCount} flights to Aircraft...`, onClick: onAssign, show: true },
    { label: 'Unassign Tail', onClick: onUnassign, show: hasDbAssigned },
    { label: '', onClick: () => {}, show: true, separator: true },
    { label: 'Edit Flight', onClick: onEdit, show: isSingle },
    { label: '', onClick: () => {}, show: true, separator: true },
    { label: isSingle ? 'Delete Flight' : `Delete ${selectionCount} Flights`, onClick: onDelete, show: true, destructive: true },
  ]

  return (
    <div
      className="fixed z-[100]"
      style={{ left: x, top: y }}
      onClick={e => e.stopPropagation()}
    >
      <div
        className="py-1 min-w-[200px]"
        style={{
          background: 'var(--glass-bg-heavy)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
          border: '1px solid var(--glass-border-heavy)',
          padding: 4,
        }}
      >
        {menuItems.filter(i => i.show).map((item, idx) => {
          if (item.separator) {
            return <div key={`sep-${idx}`} className="my-1.5 mx-2 border-t border-border/40" />
          }
          return (
            <button
              key={item.label}
              onClick={item.onClick}
              disabled={item.disabled}
              className={`w-full text-left px-3 py-[7px] rounded-lg text-[12px] transition-colors flex items-center justify-between ${
                item.disabled
                  ? 'text-muted-foreground/40 cursor-default'
                  : item.destructive
                    ? 'text-destructive hover:bg-destructive/8'
                    : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
              }`}
            >
              <span>{item.label}</span>
              {item.shortcut && (
                <span className="text-[10px] text-muted-foreground/50 ml-4">{item.shortcut}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Unassign Modal ─────────────────────────────────────────────────────

function UnassignModal({
  open, onClose, selectedFlightObjects, onConfirm,
}: {
  open: boolean
  onClose: () => void
  selectedFlightObjects: ExpandedFlight[]
  onConfirm: (items: FlightDateItem[]) => Promise<void>
}) {
  const [unassigning, setUnassigning] = useState(false)

  useEffect(() => {
    if (open) setUnassigning(false)
  }, [open])

  const assignedSelected = useMemo(() => selectedFlightObjects.filter(f => !!f.aircraftReg), [selectedFlightObjects])

  const handleConfirm = async () => {
    if (unassigning) return
    setUnassigning(true)
    try {
      await onConfirm(assignedSelected.map(f => ({
        flightId: f.flightId,
        flightDate: formatISO(f.date),
      })))
    } finally {
      setUnassigning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Unlink className="h-4 w-4" />
            Unassign Aircraft Tails
          </DialogTitle>
        </DialogHeader>
        <p className="text-[11px] text-muted-foreground -mt-1">
          Remove tail assignment from {assignedSelected.length} flight{assignedSelected.length !== 1 ? 's' : ''}?
        </p>
        <div className="max-h-[200px] overflow-y-auto space-y-1 mt-1">
          {assignedSelected.map(f => (
            <div key={f.id} className="flex items-center justify-between text-[11px] px-2 py-1 rounded bg-muted/30">
              <span className="font-medium">{f.flightNumber}</span>
              <span className="text-muted-foreground">{f.aircraftReg} → unassigned</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Flights will return to auto-assigned positions.
        </p>
        <DialogFooter className="mt-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[11px] font-medium rounded-md border border-border hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={unassigning || assignedSelected.length === 0}
            className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {unassigning ? 'Unassigning...' : `Unassign ${assignedSelected.length} Flight${assignedSelected.length > 1 ? 's' : ''}`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Assign to Aircraft Modal ──────────────────────────────────────────

interface AssignModalProps {
  open: boolean
  onClose: () => void
  selectedFlights: ExpandedFlight[]
  registrations: AircraftWithRelations[]
  aircraftTypes: AircraftType[]
  seatingConfigs: AircraftSeatingConfig[]
  flightsByReg: Map<string, ExpandedFlight[]>
  acTypeByIcao: Map<string, AircraftType>
  onAssigned: (items: FlightDateItem[], registration: string) => void
}

function AssignToAircraftModal({
  open, onClose, selectedFlights, registrations,
  aircraftTypes, seatingConfigs, flightsByReg, acTypeByIcao, onAssigned,
}: AssignModalProps) {
  const [selectedReg, setSelectedReg] = useState<string | null>(null)
  const [assigning, setAssigning] = useState(false)
  const [warningState, setWarningState] = useState<'none' | 'category' | 'family'>('none')

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setSelectedReg(null)
      setAssigning(false)
      setWarningState('none')
    }
  }, [open])

  // Flight AC type info
  const flightIcaoTypes = Array.from(new Set(selectedFlights.map(f => f.aircraftTypeIcao).filter(Boolean))) as string[]
  const primaryIcao = flightIcaoTypes[0] || null
  const primaryAcType = primaryIcao ? acTypeByIcao.get(primaryIcao) : undefined

  // Group registrations: same type, same family, other (keyed by family/type)
  const grouped = useMemo(() => {
    const sameType: AircraftWithRelations[] = []
    const sameFamily: AircraftWithRelations[] = []
    const other = new Map<string, AircraftWithRelations[]>()

    const primaryFamily = primaryAcType?.family || null

    for (const reg of registrations) {
      if (reg.status !== 'active' && reg.status !== 'operational') continue
      const regIcao = reg.aircraft_types?.icao_type || ''

      if (primaryIcao && regIcao === primaryIcao) {
        sameType.push(reg)
      } else {
        const regFullType = regIcao ? acTypeByIcao.get(regIcao) : undefined
        const regFamily = regFullType?.family || null
        if (primaryFamily && regFamily === primaryFamily) {
          sameFamily.push(reg)
        } else {
          const key = regFamily || regIcao || 'Other'
          const list = other.get(key) || []
          list.push(reg)
          other.set(key, list)
        }
      }
    }

    return { sameType, sameFamily, other }
  }, [registrations, primaryIcao, primaryAcType, acTypeByIcao])

  // Get cabin config for a reg
  const getCabin = (reg: AircraftWithRelations) => {
    const configs = seatingConfigs.filter(c => c.aircraft_id === reg.id)
    if (configs.length > 0) {
      const latest = configs[configs.length - 1]
      if (latest.total_capacity > 0) return `Y${latest.total_capacity}`
    }
    return ''
  }

  // Get flight count for this registration
  const getRegFlightCount = (registration: string) => {
    return (flightsByReg.get(registration) || []).length
  }

  // Compute utilization for a registration
  const getRegUtil = (registration: string) => {
    const flights = flightsByReg.get(registration) || []
    const totalBlock = flights.reduce((s, f) => s + f.blockMinutes, 0)
    const regObj = registrations.find(r => r.registration === registration)
    const icao = regObj?.aircraft_types?.icao_type
    const acType = icao ? acTypeByIcao.get(icao) : undefined
    const isWide = acType?.category === 'widebody'
    const target = isWide ? 14 : 12
    return Math.round((totalBlock / 60 / target) * 100)
  }

  // Build dropdown option label for a registration
  const buildRegLabel = (reg: AircraftWithRelations) => {
    const cabin = getCabin(reg)
    const flts = getRegFlightCount(reg.registration)
    const util = getRegUtil(reg.registration)
    return `${reg.registration}${cabin ? ` ${cabin}` : ''}  —  ${flts} flt${flts !== 1 ? 's' : ''}  ${util}%`
  }

  // Render a dropdown for a group of registrations
  const renderGroupDropdown = (regs: AircraftWithRelations[], groupKey: string) => {
    // Check if selectedReg is within this group
    const currentInGroup = regs.find(r => r.registration === selectedReg)
    return (
      <select
        value={currentInGroup ? selectedReg! : ''}
        onChange={e => { setSelectedReg(e.target.value || null); setWarningState('none') }}
        className="w-full px-3 py-2 rounded-lg text-[11px] glass outline-none focus:ring-2 focus:ring-primary/30 bg-background border border-border"
      >
        <option value="">Select registration...</option>
        {regs.map(reg => (
          <option key={reg.id} value={reg.registration}>
            {buildRegLabel(reg)}
          </option>
        ))}
      </select>
    )
  }

  // On assign click
  const handleAssign = useCallback(async () => {
    if (!selectedReg || assigning) return

    // Check for type change warnings
    const targetReg = registrations.find(r => r.registration === selectedReg)
    const targetIcao = targetReg?.aircraft_types?.icao_type
    const targetAcType = targetIcao ? acTypeByIcao.get(targetIcao) : undefined

    if (warningState === 'none' && primaryAcType && targetAcType) {
      if (primaryAcType.family !== targetAcType.family) {
        if (primaryAcType.category !== targetAcType.category) {
          setWarningState('category')
          return
        }
        setWarningState('family')
        return
      }
    }

    setAssigning(true)
    const items: FlightDateItem[] = selectedFlights.map(f => ({
      flightId: f.flightId,
      flightDate: formatISO(f.date),
    }))
    const res = await assignFlightsToAircraft(items, selectedReg)
    if (res.error) {
      toast.error(friendlyError(res.error))
      setAssigning(false)
      return
    }
    toast.success(`${items.length} flight${items.length > 1 ? 's' : ''} assigned to ${selectedReg}`)
    setAssigning(false)
    onAssigned(items, selectedReg)
  }, [selectedReg, assigning, selectedFlights, registrations, acTypeByIcao, primaryAcType, warningState, onAssigned])

  // ── Build flight summary line ──
  const flightNumbers = Array.from(new Set(selectedFlights.map(f => f.flightNumber)))
  const flightSummary = selectedFlights.length === 1
    ? `1 flight: ${flightNumbers[0]}`
    : `${selectedFlights.length} flights: ${flightNumbers.slice(0, 6).join(', ')}${flightNumbers.length > 6 ? '...' : ''}`

  // ── Build date display (DD/MM/YYYY) ──
  const uniqueDates = Array.from(new Set(selectedFlights.map(f => formatISO(f.date)))).sort()
  const formatDMY = (iso: string) => {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }
  let dateDisplay: string
  if (uniqueDates.length === 1) {
    dateDisplay = formatDMY(uniqueDates[0])
  } else if (uniqueDates.length <= 3) {
    dateDisplay = uniqueDates.map(formatDMY).join(', ')
  } else {
    dateDisplay = `From ${formatDMY(uniqueDates[0])} To ${formatDMY(uniqueDates[uniqueDates.length - 1])}`
  }

  const typeLabel = flightIcaoTypes.length === 1
    ? flightIcaoTypes[0]
    : flightIcaoTypes.length > 1
      ? `Mixed: ${flightIcaoTypes.join(', ')}`
      : 'Unknown'

  // Warning content
  const targetReg = registrations.find(r => r.registration === selectedReg)
  const targetIcao = targetReg?.aircraft_types?.icao_type
  const targetAcType = targetIcao ? acTypeByIcao.get(targetIcao) : undefined

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden" style={{
        background: 'var(--glass-bg-heavy)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid var(--glass-border-heavy)',
      }}>
        {/* Header */}
        <div className="px-4 py-3 border-b">
          <DialogTitle className="text-sm font-semibold">Assign to Aircraft Registration</DialogTitle>
        </div>

        {/* Flight summary */}
        <div className="px-4 py-2.5 border-b bg-muted/20 space-y-0.5">
          <div className="text-[11px] font-medium">{flightSummary}</div>
          <div className="text-[10px] text-muted-foreground">Date: {dateDisplay}</div>
          <div className="text-[10px] text-muted-foreground">Aircraft Type: {typeLabel}</div>
        </div>

        {/* Aircraft groups with dropdowns */}
        <div className="px-4 py-3 max-h-[300px] overflow-y-auto custom-scrollbar space-y-3">
          {/* Same type group — expanded by default */}
          {grouped.sameType.length > 0 && (
            <details open>
              <summary className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 cursor-pointer select-none list-none flex items-center gap-1.5">
                <ChevronDown className="h-3 w-3 transition-transform [details:not([open])>&]:-rotate-90" />
                {primaryIcao} — Same type ({grouped.sameType.length})
              </summary>
              {renderGroupDropdown(grouped.sameType, 'same-type')}
            </details>
          )}

          {/* Same family group — collapsed by default */}
          {grouped.sameFamily.length > 0 && (
            <details>
              <summary className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 cursor-pointer select-none list-none flex items-center gap-1.5">
                <ChevronDown className="h-3 w-3 transition-transform [details:not([open])>&]:-rotate-90" />
                {primaryAcType?.family || 'Family'} — Same family ({grouped.sameFamily.length})
              </summary>
              {renderGroupDropdown(grouped.sameFamily, 'same-family')}
            </details>
          )}

          {/* Other families — collapsed by default */}
          {Array.from(grouped.other.entries()).map(([family, regs]) => (
            <details key={family}>
              <summary className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 cursor-pointer select-none list-none flex items-center gap-1.5">
                <ChevronDown className="h-3 w-3 transition-transform [details:not([open])>&]:-rotate-90" />
                {family} ({regs.length})
              </summary>
              {renderGroupDropdown(regs, family)}
            </details>
          ))}

          {grouped.sameType.length === 0 && grouped.sameFamily.length === 0 && grouped.other.size === 0 && (
            <div className="py-4 text-center text-[11px] text-muted-foreground">
              No registrations found
            </div>
          )}
        </div>

        {/* Warning banner */}
        {warningState === 'family' && primaryAcType && targetAcType && (
          <div className="mx-4 mb-2 p-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30">
            <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Aircraft type change
            </div>
            <p className="text-[10px] text-amber-600 dark:text-amber-400/80 mt-1">
              Flight planned for {primaryIcao}, assigning to {targetIcao} aircraft {selectedReg}.
              Block times and TAT may differ.
            </p>
          </div>
        )}
        {warningState === 'category' && primaryAcType && targetAcType && (
          <div className="mx-4 mb-2 p-3 rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30">
            <div className="text-[11px] font-semibold text-red-700 dark:text-red-400 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Aircraft category change
            </div>
            <p className="text-[10px] text-red-600 dark:text-red-400/80 mt-1">
              Assigning {primaryAcType.category} flight ({primaryIcao}) to {targetAcType.category} aircraft {selectedReg} ({targetIcao}).
              This may affect block times, TAT, gate compatibility, and cabin configuration.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[11px] font-medium rounded-md border border-border hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedReg || assigning}
            className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {assigning ? 'Assigning...' : warningState !== 'none' ? 'Proceed with Assign' : selectedReg ? `Assign to ${selectedReg}` : 'Select a registration'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Drop Confirm Dialog ────────────────────────────────────────────────

function DropConfirmDialog({
  open, onClose, onConfirm, pendingDrop, getFlightDetails, getTypeName,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  pendingDrop: PendingDrop
  getFlightDetails: (expandedId: string) => { flightNumber: string; depStation: string; arrStation: string; date: Date; stdLocal: string } | null
  getTypeName: (icao: string) => string
}) {
  const formatDate = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })

  const sourceType = getTypeName(pendingDrop.targetIcao) // source type comes from the flight, but we show target info
  const isSameFamily = pendingDrop.validity === 'same-family'

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Plane className="h-4 w-4" />
            Confirm Aircraft Reassignment
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 text-xs font-medium mt-1">
          <span>{pendingDrop.sourceReg}</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span>{pendingDrop.targetReg} ({pendingDrop.targetIcao})</span>
        </div>

        {isSameFamily && (
          <div className="flex items-start gap-2 mt-1 p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Same family but different type. Verify compatibility before confirming.
            </p>
          </div>
        )}

        <div className="max-h-[200px] overflow-y-auto space-y-1 mt-2">
          {pendingDrop.draggedIds.map(eid => {
            const details = getFlightDetails(eid)
            if (!details) return null
            return (
              <div key={eid} className="flex items-center justify-between text-[11px] px-2 py-1 rounded bg-muted/30">
                <span className="font-medium">{details.flightNumber}</span>
                <span className="text-muted-foreground">
                  {details.depStation}→{details.arrStation}
                </span>
                <span className="text-muted-foreground">
                  {formatDate(details.date)} {details.stdLocal}
                </span>
              </div>
            )
          })}
        </div>

        <DialogFooter className="mt-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[11px] font-medium rounded-md border border-border hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Confirm Move
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
