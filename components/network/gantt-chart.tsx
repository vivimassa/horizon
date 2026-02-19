'use client'

import { useState, useRef, useMemo, useEffect, useLayoutEffect, useCallback, Fragment } from 'react'
import {
  ChevronDown,
  Check,
  Plane,
  PlaneTakeoff,
  Clock,
  CalendarRange,
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
  Maximize2,
  Minimize2,
  Pin,
  Info,
  ArrowLeftRight,
} from 'lucide-react'
import { AircraftWithRelations } from '@/app/actions/aircraft-registrations'
import { AircraftType, AircraftSeatingConfig, CabinEntry, Airport, FlightServiceType } from '@/types/database'
import { getGanttFlights, GanttFlight, getRouteWithLegs, excludeFlightDates, assignFlightsToAircraft, unassignFlightsTail, getFlightTailAssignments, swapFlightAssignments, type GanttRouteData, type FlightDateItem, type TailAssignmentRow } from '@/app/actions/gantt'
import { toast } from '@/components/ui/visionos-toast'
import { friendlyError } from '@/lib/utils/error-handler'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { MiniBuilderModal } from './gantt-mini-builder'
import { autoAssignFlights, type AssignableAircraft, type TailAssignmentResult } from '@/lib/utils/tail-assignment'
import { useGanttSettings } from '@/lib/hooks/use-gantt-settings'
import { type GanttSettingsData, AC_TYPE_COLOR_PALETTE } from '@/lib/constants/gantt-settings'
import { getBarTextColor, getContrastTextColor, desaturate, darkModeVariant } from '@/lib/utils/color-helpers'
import { GanttSettingsPanel, type FleetPreviewItem } from './gantt-settings-panel'
import { GanttOptimizerDialog, type OptimizerMethod } from './gantt-optimizer-dialog'
import { useGanttClipboard } from '@/lib/hooks/use-gantt-clipboard'
import { useGanttDrag, type RowLayoutItem, type PendingDrop } from '@/lib/hooks/use-gantt-drag'
import { GanttClipboardPill } from './gantt-clipboard-pill'
import { GanttWorkspaceIndicator } from './gantt-workspace-indicator'
import { SwapFlightsDialog, type SwapExpandedFlight } from '@/components/shared/swap-flights-dialog'

// ─── Types & Constants ───────────────────────────────────────────────────

type ZoomLevel = '1D' | '2D' | '3D' | '4D' | '5D' | '6D' | '7D' | '14D' | '28D' | 'M' | '3M' | '6M'

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
}

const ZOOM_GROUP_DAYS: ZoomLevel[] = ['1D', '2D', '3D', '4D', '5D', '6D', '7D']
const ZOOM_GROUP_WIDE: ZoomLevel[] = ['14D', '28D', 'M', '3M', '6M']

// ─── Row height levels (vertical zoom) ────────────────────────────────
const ROW_HEIGHT_LEVELS = [
  { label: 'compact', rowH: 28, barH: 18, fontSize: 8,   regFont: 10, regSubFont: 7,  groupFont: 10, groupSubFont: 0 },
  { label: 'default', rowH: 38, barH: 26, fontSize: 9.5, regFont: 12, regSubFont: 9,  groupFont: 12, groupSubFont: 0 },
  { label: 'large',   rowH: 52, barH: 36, fontSize: 11,  regFont: 13, regSubFont: 10, groupFont: 13, groupSubFont: 0 },
  { label: 'xlarge',  rowH: 68, barH: 48, fontSize: 12,  regFont: 14, regSubFont: 11, groupFont: 14, groupSubFont: 0 },
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
  source: string
  finalized: boolean
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
  const dow = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  const day = d.getDate().toString().padStart(2, '0')
  const mon = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  return `${dow}, ${day} ${mon}`
}

function parseDate(s: string): Date { return new Date(s + 'T00:00:00') }
function diffDays(a: Date, b: Date): number { return Math.round((b.getTime() - a.getTime()) / 86400000) }

const ZOOM_DAYS: Record<ZoomLevel, number> = {
  '1D': 1, '2D': 2, '3D': 3, '4D': 4, '5D': 5, '6D': 6, '7D': 7,
  '14D': 14, '28D': 28, 'M': 31, '3M': 91, '6M': 182,
}

/** Find the largest zoom level that fits within totalDays */
function findBestZoom(totalDays: number): ZoomLevel {
  const all: ZoomLevel[] = ['1D', '2D', '3D', '4D', '5D', '6D', '7D', '14D', '28D', 'M', '3M', '6M']
  let best: ZoomLevel = '1D'
  for (const z of all) {
    if (ZOOM_DAYS[z] <= totalDays) best = z
  }
  return best
}

function formatISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** YYYY-MM-DD → DD/MM/YYYY for display */
function isoToDisplay(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** Parse user input (ddmmyyyy, dd/mm/yyyy, d/m/yyyy) → YYYY-MM-DD or null */
function parseUserDate(text: string): string | null {
  const stripped = text.replace(/[/\-\.]/g, '')
  if (/^\d{8}$/.test(stripped)) {
    const d = stripped.slice(0, 2), m = stripped.slice(2, 4), y = stripped.slice(4, 8)
    if (+d >= 1 && +d <= 31 && +m >= 1 && +m <= 12 && +y >= 1900 && +y <= 2100) {
      const date = new Date(`${y}-${m}-${d}T00:00:00`)
      if (!isNaN(date.getTime())) return `${y}-${m}-${d}`
    }
  }
  const parts = text.split(/[/\-\.]/)
  if (parts.length === 3) {
    const [dp, mp, yp] = parts
    const d = dp.padStart(2, '0'), m = mp.padStart(2, '0'), y = yp
    if (y.length === 4 && +d >= 1 && +d <= 31 && +m >= 1 && +m <= 12 && +y >= 1900 && +y <= 2100) {
      const date = new Date(`${y}-${m}-${d}T00:00:00`)
      if (!isNaN(date.getTime())) return `${y}-${m}-${d}`
    }
  }
  return null
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

/** Histogram heat scale: bar color varies by intensity (count/max) */
function getHistogramBarColor(count: number, maxCount: number, dark: boolean): string {
  if (count === 0) return 'transparent'
  const intensity = count / maxCount
  const minI = 0.15
  const adj = minI + intensity * (1 - minI)
  return dark
    ? `rgba(239, 68, 68, ${Math.round(adj * 70) / 100})`
    : `rgba(153, 27, 27, ${Math.round(adj * 60) / 100})`
}

/** Histogram label color: adapts for contrast on heat-scaled bars */
function getHistogramLabelColor(count: number, maxCount: number, dark: boolean): string {
  const intensity = count / maxCount
  if (dark) return intensity > 0.6 ? '#FFFFFF' : '#9CA3AF'
  return intensity > 0.5 ? '#FFFFFF' : '#374151'
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

function fmtTat(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
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
  const isPub = ef.status === 'published'
  const isFin = !isPub && ef.finalized
  const isWip = !isPub && !ef.finalized

  if (colorMode === 'assignment') {
    if (isDbAssigned) {
      return { bg: 'var(--gantt-bar-bg-assigned)', text: 'var(--gantt-bar-text-assigned)', useVars: true }
    }
    if (isWip) {
      return { bg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)', text: '', useVars: false }
    }
    if (isFin) {
      return { bg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', text: '', useVars: false }
    }
    return { bg: 'var(--gantt-bar-bg-unassigned)', text: '', useVars: true }
  }

  let bg = '#3B82F6'
  if (colorMode === 'ac_type') {
    bg = settings.colorAcType[ef.aircraftTypeIcao || ''] || '#3B82F6'
  } else if (colorMode === 'service_type') {
    bg = settings.colorServiceType[ef.serviceType] || '#3B82F6'
  } else if (colorMode === 'destination_type') {
    bg = isRouteDomestic(ef.routeType) ? settings.colorDestType.domestic : settings.colorDestType.international
  }

  // Apply opacity based on state: WIP 30%, Finalized 60%, Published 100%
  if (isWip) {
    bg = desaturate(bg, 0.3)
  } else if (isFin) {
    bg = desaturate(bg, 0.6)
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
  // ─── Period state (FROM/TO boundary) ────────────────────────────────
  const [periodFrom, setPeriodFrom] = useState<string | null>(null)
  const [periodTo, setPeriodTo] = useState<string | null>(null)
  const [periodCommitted, setPeriodCommitted] = useState(false)
  const [committedFrom, setCommittedFrom] = useState<string | null>(null)
  const [committedTo, setCommittedTo] = useState<string | null>(null)
  // Display text for FROM/TO text inputs
  const [fromText, setFromText] = useState('')
  const [toText, setToText] = useState('')
  // Calendar picker: alternates between FROM and TO
  const calendarRef = useRef<HTMLInputElement>(null)
  const pickTargetRef = useRef<'from' | 'to'>('from')

  // Sync display text when periodFrom/periodTo change externally (Today, Go, etc.)
  useEffect(() => { setFromText(periodFrom ? isoToDisplay(periodFrom) : '') }, [periodFrom])
  useEffect(() => { setToText(periodTo ? isoToDisplay(periodTo) : '') }, [periodTo])

  // ─── Optimizer state ───────────────────────────────────────────────
  const [optimizerOpen, setOptimizerOpen] = useState(false)
  const [assignmentMethod, setAssignmentMethod] = useState<OptimizerMethod>('greedy')
  const [optimizerRunning, setOptimizerRunning] = useState(false)
  const [lastOptRun, setLastOptRun] = useState<{ method: string; time: Date } | null>(null)

  // ─── State ──────────────────────────────────────────────────────────
  const [startDate, setStartDate] = useState(() => startOfDay(new Date()))
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('4D')
  const [acTypeFilter, setAcTypeFilter] = useState<string | null>(null)
  const [scheduleFilters, setScheduleFilters] = useState<ScheduleFilters>({ published: true, finalized: true, wip: true })
  const [selectedFlights, setSelectedFlights] = useState<Set<string>>(new Set())
  const [hoveredFlightId, setHoveredFlightId] = useState<string | null>(null)
  const tooltipPosRef = useRef({ x: 0, y: 0 })
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(new Set<string>())
  const [flights, setFlights] = useState<GanttFlight[]>([])
  const [loading, setLoading] = useState(false)

  // Dark mode tracking
  const [isDark, setIsDark] = useState(false)

  // Aircraft row reorder state
  const [selectedAircraftRow, setSelectedAircraftRow] = useState<string | null>(null)
  const [customAircraftOrder, setCustomAircraftOrder] = useState<Record<string, string[]>>({})
  const [flashReg, setFlashReg] = useState<string | null>(null)

  // Hydrate client-only state after mount
  const didHydrateRef = useRef(false)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('horizon_gantt_collapsed')
      if (stored) setCollapsedTypes(new Set(JSON.parse(stored)))
    } catch { /* ignore */ }
    try {
      const orderStr = localStorage.getItem('horizon_gantt_custom_reg_order')
      if (orderStr) setCustomAircraftOrder(JSON.parse(orderStr))
    } catch { /* ignore */ }
    setIsDark(document.documentElement.classList.contains('dark'))
    // Mark hydrated after a tick so the persist effect skips the initial empty write
    requestAnimationFrame(() => { didHydrateRef.current = true })
  }, [])

  // Persist collapsed state to localStorage (skip until hydrated)
  useEffect(() => {
    if (!didHydrateRef.current) return
    try { localStorage.setItem('horizon_gantt_collapsed', JSON.stringify(Array.from(collapsedTypes))) } catch { /* ignore */ }
  }, [collapsedTypes])

  // Persist custom aircraft order to localStorage
  useEffect(() => {
    if (!didHydrateRef.current) return
    const val = JSON.stringify(customAircraftOrder)
    try {
      if (val === '{}') localStorage.removeItem('horizon_gantt_custom_reg_order')
      else localStorage.setItem('horizon_gantt_custom_reg_order', val)
    } catch { /* ignore */ }
  }, [customAircraftOrder])

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
  const prevSortOrderRef = useRef(ganttSettings.fleetSortOrder)

  // Clear custom order when fleet sort order changes
  useEffect(() => {
    const current = ganttSettings.fleetSortOrder ?? 'type_reg'
    if (prevSortOrderRef.current !== current) {
      setCustomAircraftOrder({})
      setSelectedAircraftRow(null)
      prevSortOrderRef.current = current
    }
  }, [ganttSettings.fleetSortOrder])

  // Mini builder state
  const [miniBuilderOpen, setMiniBuilderOpen] = useState(false)
  const [miniBuilderFlight, setMiniBuilderFlight] = useState<ExpandedFlight | null>(null)
  const [miniBuilderRoute, setMiniBuilderRoute] = useState<GanttRouteData | null>(null)
  const [miniBuilderLoading, setMiniBuilderLoading] = useState(false)

  // Rubber band selection state
  const [rubberBand, setRubberBand] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rowReg?: string } | null>(null)

  // Assign modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false)

  // Unassign confirmation modal state
  const [unassignModalOpen, setUnassignModalOpen] = useState(false)

  // Swap mode state
  const [swapMode, setSwapMode] = useState(false)
  const [swapSource, setSwapSource] = useState<ExpandedFlight[]>([])
  const [swapDialogOpen, setSwapDialogOpen] = useState(false)
  const [swapSideA, setSwapSideA] = useState<ExpandedFlight[]>([])
  const [swapSideB, setSwapSideB] = useState<ExpandedFlight[]>([])
  const [swapRegA, setSwapRegA] = useState('')
  const [swapRegB, setSwapRegB] = useState('')

  // Row height zoom
  const [rowHeightLevel, setRowHeightLevel] = useState(2) // large (fits ~10 tails)
  const rowConfig = ROW_HEIGHT_LEVELS[rowHeightLevel]
  const ROW_HEIGHT = rowConfig.rowH
  const BAR_HEIGHT = rowConfig.barH
  const BAR_TOP = (ROW_HEIGHT - BAR_HEIGHT) / 2
  const BAR_FONT = rowConfig.fontSize
  const REG_FONT = rowConfig.regFont
  const REG_SUB_FONT = rowConfig.regSubFont
  const GROUP_FONT = rowConfig.groupFont
  const GROUP_HEADER_HEIGHT = Math.max(24, Math.round(ROW_HEIGHT * 0.68))
  const zoomRowIn = useCallback(() => setRowHeightLevel(prev => Math.min(prev + 1, ROW_HEIGHT_LEVELS.length - 1)), [])
  const zoomRowOut = useCallback(() => setRowHeightLevel(prev => Math.max(prev - 1, 0)), [])

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Collapsible right panel + pin state (hydrated from localStorage after mount)
  const [panelPinned, setPanelPinned] = useState(false)
  const [panelVisible, setPanelVisible] = useState(false)
  const [panelMounted, setPanelMounted] = useState(false)
  useEffect(() => {
    if (panelVisible) {
      setPanelMounted(true)
    } else {
      const t = setTimeout(() => setPanelMounted(false), 450)
      return () => clearTimeout(t)
    }
  }, [panelVisible])
  useEffect(() => {
    try {
      const pinned = localStorage.getItem('horizon_gantt_panel_pinned') === 'true'
      if (pinned) { setPanelPinned(true); setPanelVisible(true) }
    } catch { /* ignore */ }
  }, [])

  // Panel mode: flight (click bar), aircraft (click reg), rotation (click row bg), day-stats (click day header)
  const [panelMode, setPanelMode] = useState<'flight' | 'aircraft' | 'rotation' | 'day-stats'>('flight')
  const [panelAircraftReg, setPanelAircraftReg] = useState<string | null>(null)
  const [rotationTarget, setRotationTarget] = useState<{ reg: string; date: string } | null>(null)
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set())

  // Flight search state
  const [flightSearchOpen, setFlightSearchOpen] = useState(false)
  const [flightSearchQuery, setFlightSearchQuery] = useState('')
  const [flightSearchDate, setFlightSearchDate] = useState('')
  const [flightSearchIndex, setFlightSearchIndex] = useState(-1)
  const [searchHighlightId, setSearchHighlightId] = useState<string | null>(null)
  const flightSearchInputRef = useRef<HTMLInputElement>(null)
  const searchResultsRef = useRef<HTMLDivElement>(null)

  // Aircraft search state
  const [aircraftSearchOpen, setAircraftSearchOpen] = useState(false)
  const [aircraftSearchQuery, setAircraftSearchQuery] = useState('')
  const [aircraftSearchIndex, setAircraftSearchIndex] = useState(-1)
  const [aircraftHighlightReg, setAircraftHighlightReg] = useState<string | null>(null)
  const aircraftSearchInputRef = useRef<HTMLInputElement>(null)
  const aircraftResultsRef = useRef<HTMLDivElement>(null)

  // Day drag selection state
  const [dayDragStart, setDayDragStart] = useState<string | null>(null)
  const [dayDragEnd, setDayDragEnd] = useState<string | null>(null)
  const dayDragActiveRef = useRef(false)

  // ─── Refs ───────────────────────────────────────────────────────────
  const moveAircraftRowRef = useRef<(reg: string, direction: 'up' | 'down' | 'top' | 'bottom') => void>(() => {})
  const ganttContainerRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const histogramRef = useRef<HTMLDivElement>(null)
  const leftPanelRef = useRef<HTMLDivElement>(null)
  const lastTapRef = useRef<{ id: string; time: number } | null>(null)
  const longTapRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const centerPanelRef = useRef<HTMLDivElement>(null)

  // ─── Viewport virtualization ────────────────────────────────────────
  const [visibleBounds, setVisibleBounds] = useState({ left: 0, right: 4000, top: 0, bottom: 2000 })
  const vbRafRef = useRef<number>(0)
  const lastVBRef = useRef({ left: 0, right: 4000, top: 0, bottom: 2000 })

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
  }, [periodCommitted])

  // ─── Fullscreen API + CSS fallback ────────────────────────────────
  const toggleFullscreen = useCallback(async () => {
    if (!isFullscreen) {
      try {
        await ganttContainerRef.current?.requestFullscreen()
      } catch {
        setIsFullscreen(true) // CSS fallback
      }
    } else {
      try {
        if (document.fullscreenElement) await document.exitFullscreen()
        else setIsFullscreen(false)
      } catch {
        setIsFullscreen(false)
      }
    }
  }, [isFullscreen])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // Portal container for dialogs — must render inside fullscreen element
  const dialogContainer = isFullscreen ? ganttContainerRef.current : null

  // ─── Optimizer handler ─────────────────────────────────────────────
  const handleRunAssignment = useCallback(async (method: OptimizerMethod) => {
    setOptimizerRunning(true)
    setAssignmentMethod(method)
    await new Promise(r => setTimeout(r, 300))
    setOptimizerRunning(false)
    setLastOptRun({ method: method === 'greedy' ? 'Greedy Solution' : 'Good Solution', time: new Date() })
  }, [])

  // CSS fallback Escape handler
  useEffect(() => {
    if (!isFullscreen || document.fullscreenElement) return // only for CSS fallback
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleteModalOpen && !miniBuilderOpen && !assignModalOpen && !unassignModalOpen && !swapDialogOpen && !contextMenu && selectedFlights.size === 0) {
        setIsFullscreen(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isFullscreen, deleteModalOpen, miniBuilderOpen, assignModalOpen, unassignModalOpen, swapDialogOpen, contextMenu, selectedFlights.size])

  // ─── Panel visibility logic ───────────────────────────────────────
  useEffect(() => {
    if (panelPinned || flightSearchOpen || aircraftSearchOpen) {
      setPanelVisible(true)
    } else if (panelMode === 'flight') {
      setPanelVisible(selectedFlights.size > 0)
    } else if (panelMode === 'aircraft') {
      setPanelVisible(!!panelAircraftReg)
    } else if (panelMode === 'rotation') {
      setPanelVisible(!!rotationTarget)
    } else if (panelMode === 'day-stats') {
      setPanelVisible(selectedDays.size > 0)
    }
  }, [panelPinned, selectedFlights.size, panelMode, panelAircraftReg, rotationTarget, selectedDays.size, flightSearchOpen, aircraftSearchOpen])

  // Persist pin state (skip until hydrated)
  useEffect(() => {
    if (!didHydrateRef.current) return
    try { localStorage.setItem('horizon_gantt_panel_pinned', String(panelPinned)) } catch { /* ignore */ }
  }, [panelPinned])

  // ─── Period helpers ─────────────────────────────────────────────────
  const periodDays = useMemo(() => {
    if (!committedFrom || !committedTo) return 0
    return diffDays(parseDate(committedFrom), parseDate(committedTo)) + 1
  }, [committedFrom, committedTo])

  const isZoomDisabled = useCallback((z: ZoomLevel) => {
    if (!periodCommitted || periodDays === 0) return false
    return ZOOM_DAYS[z] > periodDays
  }, [periodCommitted, periodDays])

  const periodDirty = periodCommitted && (periodFrom !== committedFrom || periodTo !== committedTo)

  // Clamp zoom if period shrinks below current zoom
  useEffect(() => {
    if (periodCommitted && periodDays > 0) {
      if (ZOOM_DAYS[zoomLevel] > periodDays) {
        setZoomLevel(findBestZoom(periodDays))
      }
    }
  }, [periodDays, periodCommitted, zoomLevel])

  // ─── Derived ────────────────────────────────────────────────────────
  const zoomConfig = ZOOM_CONFIG[zoomLevel]
  // zoomDays = how many days fit in the viewport (determines scale)
  const zoomDays = Math.min(ZOOM_DAYS[zoomLevel], periodDays || ZOOM_DAYS[zoomLevel])
  // totalDaysToRender = how many days of content to render (full committed period)
  const totalDaysToRender = periodDays || zoomDays
  const rawPPH = containerWidth > 0 && zoomDays > 0 ? containerWidth / (zoomDays * 24) : 10
  const pixelsPerHour = Math.max(rawPPH, MIN_PPH)
  const totalWidth = totalDaysToRender * 24 * pixelsPerHour

  // Auto-adjust tick spacing based on effective pixels-per-hour
  const autoTickHours = pixelsPerHour > 40 ? 1
    : pixelsPerHour > 15 ? 2
    : pixelsPerHour > 8 ? 6
    : pixelsPerHour > 3 ? 12
    : pixelsPerHour > 1 ? 24
    : 168
  const hoursPerTick = Math.min(zoomConfig.hoursPerTick, autoTickHours)

  // ─── Close flight search helper ────────────────────────────────────
  const closeFlightSearch = useCallback(() => {
    setFlightSearchOpen(false)
    setFlightSearchQuery('')
    setFlightSearchDate('')
    setFlightSearchIndex(-1)
    setSearchHighlightId(null)
  }, [])

  // ─── Close aircraft search helper ─────────────────────────────────
  const closeAircraftSearch = useCallback(() => {
    setAircraftSearchOpen(false)
    setAircraftSearchQuery('')
    setAircraftSearchIndex(-1)
    setAircraftHighlightReg(null)
  }, [])

  // ─── Swap mode helpers (defined early for keyboard handler) ──────
  const exitSwapMode = useCallback(() => {
    setSwapMode(false)
    setSwapSource([])
  }, [])

  const enterSwapModeRef = useRef(() => {})

  // ─── Keyboard handlers (Escape + Delete + Ctrl+F + Ctrl+G) ───────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F / Cmd+F — open flight search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        const active = document.activeElement
        const isInput = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
        if (!isInput || flightSearchOpen) {
          e.preventDefault()
          closeAircraftSearch()
          setFlightSearchOpen(true)
          setPanelVisible(true)
          setTimeout(() => flightSearchInputRef.current?.focus(), 50)
          return
        }
      }

      // Ctrl+G / Cmd+G — open aircraft search
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault()
        closeFlightSearch()
        setAircraftSearchOpen(true)
        setPanelVisible(true)
        setTimeout(() => aircraftSearchInputRef.current?.focus(), 50)
        return
      }

      // Ctrl+Arrow / Ctrl+Home/End — reorder selected aircraft row
      if ((e.ctrlKey || e.metaKey) && selectedAircraftRow) {
        if (e.key === 'ArrowUp') { e.preventDefault(); moveAircraftRowRef.current(selectedAircraftRow, 'up'); return }
        if (e.key === 'ArrowDown') { e.preventDefault(); moveAircraftRowRef.current(selectedAircraftRow, 'down'); return }
        if (e.key === 'Home') { e.preventDefault(); moveAircraftRowRef.current(selectedAircraftRow, 'top'); return }
        if (e.key === 'End') { e.preventDefault(); moveAircraftRowRef.current(selectedAircraftRow, 'bottom'); return }
      }

      if (e.key === 'Escape') {
        // Priority: aircraft search > flight search > modal > context menu > panel modes > ac row select > selection
        if (aircraftSearchOpen) { closeAircraftSearch(); return }
        if (flightSearchOpen) { closeFlightSearch(); return }
        if (contextMenu) { setContextMenu(null); return }
        if (swapMode) { exitSwapMode(); return }
        if (panelMode === 'day-stats') { setSelectedDays(new Set()); setPanelMode('flight'); return }
        if (panelMode === 'aircraft') { setPanelAircraftReg(null); setPanelMode('flight'); setSelectedAircraftRow(null); return }
        if (panelMode === 'rotation') { setRotationTarget(null); setPanelMode('flight'); setSelectedAircraftRow(null); return }
        if (selectedAircraftRow) { setSelectedAircraftRow(null); return }
        if (selectedFlights.size > 0) { setSelectedFlights(new Set()); return }
        // Fullscreen CSS fallback exit handled by its own effect
      }
      // S key — enter swap mode when flights are selected
      if (e.key === 's' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const active = document.activeElement
        const isInput = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
        if (!isInput && selectedFlights.size > 0 && !deleteModalOpen && !miniBuilderOpen && !assignModalOpen && !swapDialogOpen && !swapMode) {
          e.preventDefault()
          enterSwapModeRef.current()
          return
        }
      }
      if (e.key === 'Delete' && selectedFlights.size > 0 && !deleteModalOpen && !miniBuilderOpen && !assignModalOpen) {
        setDeleteModalOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedFlights.size, deleteModalOpen, miniBuilderOpen, assignModalOpen, contextMenu, panelMode, flightSearchOpen, closeFlightSearch, aircraftSearchOpen, closeAircraftSearch, selectedAircraftRow, swapMode, swapDialogOpen, exitSwapMode])

  // ─── Scroll Sync ───────────────────────────────────────────────────
  // Use transform on inner content for header/histogram sync (more reliable than scrollLeft)
  const headerInnerRef = useRef<HTMLDivElement>(null)
  const histogramInnerRef = useRef<HTMLDivElement>(null)
  const summaryInnerRef = useRef<HTMLDivElement>(null)

  const handleBodyScroll = useCallback(() => {
    const s = bodyRef.current
    if (!s) return
    const sl = s.scrollLeft
    if (headerInnerRef.current) headerInnerRef.current.style.transform = `translateX(-${sl}px)`
    if (histogramInnerRef.current) histogramInnerRef.current.style.transform = `translateX(-${sl}px)`
    if (summaryInnerRef.current) summaryInnerRef.current.style.transform = `translateX(-${sl}px)`
    if (leftPanelRef.current) leftPanelRef.current.scrollTop = s.scrollTop

    // Viewport virtualization: RAF-throttled bounds update
    if (vbRafRef.current) cancelAnimationFrame(vbRafRef.current)
    vbRafRef.current = requestAnimationFrame(() => {
      const VB_BUFFER = 500
      const VB_THRESHOLD = 200
      const nb = {
        left: sl - VB_BUFFER,
        right: sl + s.clientWidth + VB_BUFFER,
        top: s.scrollTop - VB_BUFFER,
        bottom: s.scrollTop + s.clientHeight + VB_BUFFER,
      }
      const lb = lastVBRef.current
      if (
        Math.abs(nb.left - lb.left) > VB_THRESHOLD ||
        Math.abs(nb.right - lb.right) > VB_THRESHOLD ||
        Math.abs(nb.top - lb.top) > VB_THRESHOLD ||
        Math.abs(nb.bottom - lb.bottom) > VB_THRESHOLD
      ) {
        lastVBRef.current = nb
        setVisibleBounds(nb)
      }
    })
  }, [])

  // Initial viewport measurement + re-measure on zoom/resize changes
  useLayoutEffect(() => {
    const s = bodyRef.current
    if (!s) return
    const VB_BUFFER = 500
    const b = {
      left: s.scrollLeft - VB_BUFFER,
      right: s.scrollLeft + s.clientWidth + VB_BUFFER,
      top: s.scrollTop - VB_BUFFER,
      bottom: s.scrollTop + s.clientHeight + VB_BUFFER,
    }
    lastVBRef.current = b
    setVisibleBounds(b)
  }, [zoomLevel, containerWidth])

  // Preserve scroll center when zoom level changes
  const prevPphRef = useRef(pixelsPerHour)
  useLayoutEffect(() => {
    const body = bodyRef.current
    if (!body || prevPphRef.current === 0) { prevPphRef.current = pixelsPerHour; return }
    if (prevPphRef.current === pixelsPerHour) return
    const ratio = pixelsPerHour / prevPphRef.current
    const centerX = body.scrollLeft + body.clientWidth / 2
    body.scrollLeft = Math.max(0, centerX * ratio - body.clientWidth / 2)
    prevPphRef.current = pixelsPerHour
    handleBodyScroll()
  }, [pixelsPerHour, handleBodyScroll])

  // ─── Per-date tail assignments ─────────────────────────────────────
  // Map key = "flightId__YYYY-MM-DD", value = aircraft_reg
  const [tailAssignments, setTailAssignments] = useState<Map<string, string>>(new Map())

  // ─── Data Fetch (with stale-fetch guard + optimistic merge) ──────
  const fetchVersionRef = useRef(0)
  /** Tracks pending optimistic ops so refreshFlights won't overwrite them */
  const pendingOpsRef = useRef<{ adds: Map<string, string>; deletes: Set<string> }>({ adds: new Map(), deletes: new Set() })

  const refreshFlights = useCallback(async () => {
    if (!committedFrom || !committedTo) return
    const version = ++fetchVersionRef.current
    setLoading(true)
    const rangeEnd = formatISO(addDays(parseDate(committedTo), 1))
    const [f, ta] = await Promise.all([
      getGanttFlights(committedFrom, rangeEnd),
      getFlightTailAssignments(committedFrom, rangeEnd),
    ])
    // Ignore results if a newer fetch was initiated while this one was in-flight
    if (fetchVersionRef.current !== version) return
    setFlights(f)
    // Build lookup map for per-date assignments
    const taMap = new Map<string, string>()
    for (const row of ta) {
      taMap.set(`${row.scheduledFlightId}__${row.flightDate}`, row.aircraftReg)
    }
    // MERGE: apply pending optimistic operations on top of DB data
    setTailAssignments(() => {
      const merged = new Map(taMap)
      const ops = pendingOpsRef.current
      ops.adds.forEach((reg, key) => {
        if (!merged.has(key)) merged.set(key, reg)
      })
      ops.deletes.forEach(key => {
        merged.delete(key)
      })
      const survivingAdds = new Map<string, string>()
      ops.adds.forEach((reg, key) => {
        if (!taMap.has(key) || taMap.get(key) !== reg) {
          survivingAdds.set(key, reg)
        }
      })
      const survivingDeletes = new Set<string>()
      ops.deletes.forEach(key => {
        if (taMap.has(key)) survivingDeletes.add(key)
      })
      pendingOpsRef.current = { adds: survivingAdds, deletes: survivingDeletes }
      return merged
    })
    setLoading(false)
  }, [committedFrom, committedTo])

  useEffect(() => {
    if (periodCommitted && committedFrom && committedTo) {
      refreshFlights()
    }
  }, [periodCommitted, committedFrom, committedTo, refreshFlights])

  /** Optimistic assign: update per-date tail assignment map + track pending */
  const applyOptimisticAssign = useCallback((items: FlightDateItem[], reg: string) => {
    for (const item of items) {
      const key = `${item.flightId}__${item.flightDate}`
      pendingOpsRef.current.adds.set(key, reg)
      pendingOpsRef.current.deletes.delete(key)
    }
    setTailAssignments(prev => {
      const next = new Map(prev)
      for (const item of items) {
        next.set(`${item.flightId}__${item.flightDate}`, reg)
      }
      return next
    })
  }, [])

  /** Optimistic unassign: remove per-date tail assignments + track pending */
  const applyOptimisticUnassign = useCallback((items: FlightDateItem[]) => {
    for (const item of items) {
      const key = `${item.flightId}__${item.flightDate}`
      pendingOpsRef.current.deletes.add(key)
      pendingOpsRef.current.adds.delete(key)
    }
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
    const customOrder = ganttSettings.acTypeOrder
    if (customOrder.length > 0) {
      const orderMap = new Map(customOrder.map((icao, i) => [icao, i]))
      result.sort((a, b) => {
        const ai = orderMap.get(a.icaoType) ?? 9999
        const bi = orderMap.get(b.icaoType) ?? 9999
        return ai - bi || a.icaoType.localeCompare(b.icaoType)
      })
    } else {
      result.sort((a, b) => a.icaoType.localeCompare(b.icaoType))
    }
    return result
  }, [registrations, acTypeFilter, ganttSettings.acTypeOrder])

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
      const isPub = f.status === 'published'
      const isFin = !isPub && f.finalized
      const isWip = !isPub && !f.finalized
      if (isPub && !scheduleFilters.published) continue
      if (isFin && !scheduleFilters.finalized) continue
      if (isWip && !scheduleFilters.wip) continue

      const pStart = new Date(f.periodStart + 'T00:00:00')
      const pEnd = new Date(f.periodEnd + 'T00:00:00')
      const stdMin = timeToMinutes(f.stdLocal)
      const staMin = timeToMinutes(f.staLocal)

      for (let d = 0; d < totalDaysToRender; d++) {
        const date = addDays(startDate, d)
        if (date < pStart || date > pEnd) continue
        const dow = getDayOfWeek(date)
        if (!f.daysOfOperation.includes(String(dow))) continue

        // Per-date tail assignment takes priority, then fall back to scheduled_flights.aircraft_reg
        const dateStr = formatISO(date)

        // Skip dates that have been soft-deleted
        if (f.excludedDates && f.excludedDates.includes(dateStr)) continue
        const perDateReg = tailAssignments.get(`${f.id}__${dateStr}`) || null
        // Use per-date assignment first, then flight-level aircraft_reg from DB
        const effectiveReg = perDateReg || f.aircraftReg || null

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
          aircraftReg: effectiveReg,
          dayOffset: f.dayOffset ?? 0,
          assignedReg: null, // set by tail assignment engine
          serviceType: f.serviceType || 'J',
          source: f.source || 'manual',
          finalized: f.finalized ?? false,
        })
      }
    }
    return result
  }, [flights, startDate, totalDaysToRender, scheduleFilters.published, scheduleFilters.finalized, scheduleFilters.wip, tailAssignments])

  // ─── Flight search results (live-filtered) ─────────────────────────
  const flightSearchResults = useMemo<ExpandedFlight[]>(() => {
    const q = flightSearchQuery.trim()
    if (!q) return []
    const normalizedQuery = q.replace(/^VJ/i, '').toLowerCase()

    let results = expandedFlights.filter(f => {
      const num = f.flightNumber.replace(/^VJ/i, '').toLowerCase()
      return num.includes(normalizedQuery)
    })

    if (flightSearchDate.trim()) {
      const parts = flightSearchDate.trim().split('/')
      if (parts.length === 2) {
        const day = parseInt(parts[0], 10)
        const month = parseInt(parts[1], 10)
        if (!isNaN(day) && !isNaN(month)) {
          results = results.filter(f => f.date.getDate() === day && (f.date.getMonth() + 1) === month)
        }
      }
    }

    results.sort((a, b) => {
      const da = a.date.getTime()
      const db = b.date.getTime()
      if (da !== db) return da - db
      return a.stdMinutes - b.stdMinutes
    })

    return results
  }, [expandedFlights, flightSearchQuery, flightSearchDate])

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

    return autoAssignFlights(expandedFlights, assignableAircraft, defaultTat, assignmentMethod === 'good' ? 'balance' : 'minimize')
  }, [expandedFlights, registrations, aircraftTypes, assignmentMethod])

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
  const histogramMode: 'hourly' | 'weekly' = useMemo(() => {
    return zoomDays <= 7 ? 'hourly' : 'weekly'
  }, [zoomDays])

  const histogramLabel = histogramMode === 'hourly' ? 'Flights/hr' : 'Flights/wk'

  // ─── Histogram data (variable buckets) ────────────────────────────
  const histogram = useMemo(() => {
    const buckets: { count: number; xPx: number; widthPx: number }[] = []
    const pph = pixelsPerHour

    if (histogramMode === 'hourly') {
      const totalSlots = totalDaysToRender * 24
      const counts = new Array(totalSlots).fill(0) as number[]
      for (const ef of assignedFlights) {
        const dayOff = Math.floor((ef.date.getTime() - startDate.getTime()) / 86400000)
        const slot = dayOff * 24 + Math.floor(ef.stdMinutes / 60)
        if (slot >= 0 && slot < totalSlots) counts[slot]++
      }
      for (let i = 0; i < totalSlots; i++) {
        buckets.push({ count: counts[i], xPx: i * pph, widthPx: Math.max(1, pph - 2) })
      }
    } else {
      // weekly (Mon-Sun aligned)
      // Find the Monday at or before startDate
      const startMs = startDate.getTime()
      const endMs = startMs + totalDaysToRender * 86400000
      const startDay = startDate.getDay() // 0=Sun
      const diffToMon = startDay === 0 ? -6 : 1 - startDay
      const firstMon = new Date(startMs + diffToMon * 86400000)
      firstMon.setHours(0, 0, 0, 0)

      let weekStart = firstMon.getTime()
      while (weekStart < endMs) {
        const weekEnd = weekStart + 7 * 86400000
        const count = assignedFlights.filter((ef) => {
          const fMs = ef.date.getTime() + ef.stdMinutes * 60000
          return fMs >= weekStart && fMs < weekEnd
        }).length

        const clampedStart = Math.max(weekStart, startMs)
        const clampedEnd = Math.min(weekEnd, endMs)
        const xHours = (clampedStart - startMs) / 3600000
        const wHours = (clampedEnd - clampedStart) / 3600000

        buckets.push({
          count,
          xPx: xHours * pph,
          widthPx: Math.max(1, wHours * pph - 2),
        })
        weekStart = weekEnd
      }
    }

    const max = Math.max(1, ...buckets.map((b) => b.count))
    return { buckets, max }
  }, [assignedFlights, totalDaysToRender, pixelsPerHour, startDate, histogramMode, totalWidth])

  // ─── Summary data (daily or weekly aggregation) ────────────────────
  interface SummaryBucket {
    dateStr: string
    label: string
    flights: number
    blockHours: number
    xPx: number
    widthPx: number
    isWeekend: boolean
  }

  const summaryData = useMemo((): SummaryBucket[] => {
    const pph = pixelsPerHour
    const startMs = startDate.getTime()

    if (histogramMode === 'hourly') {
      // ≤7D: one bucket per day
      return Array.from({ length: totalDaysToRender }, (_, d) => {
        const date = addDays(startDate, d)
        const dateStr = formatISO(date)
        const dayStart = date.getTime()
        const dayEnd = dayStart + 86400000
        const dayFlights = assignedFlights.filter(f => {
          const fMs = f.date.getTime() + f.stdMinutes * 60000
          return fMs >= dayStart && fMs < dayEnd
        })
        const blockMin = dayFlights.reduce((s, f) => s + f.blockMinutes, 0)
        return {
          dateStr,
          label: '',
          flights: dayFlights.length,
          blockHours: Math.round(blockMin / 6) / 10,
          xPx: d * 24 * pph,
          widthPx: 24 * pph,
          isWeekend: isWeekend(date),
        }
      })
    } else {
      // >7D: one bucket per ISO week
      const endMs = startMs + totalDaysToRender * 86400000
      const startDay = startDate.getDay()
      const diffToMon = startDay === 0 ? -6 : 1 - startDay
      const firstMon = new Date(startMs + diffToMon * 86400000)
      firstMon.setHours(0, 0, 0, 0)

      const buckets: SummaryBucket[] = []
      let weekStart = firstMon.getTime()
      while (weekStart < endMs) {
        const weekEnd = weekStart + 7 * 86400000
        const dayFlights = assignedFlights.filter(f => {
          const fMs = f.date.getTime() + f.stdMinutes * 60000
          return fMs >= weekStart && fMs < weekEnd
        })
        const blockMin = dayFlights.reduce((s, f) => s + f.blockMinutes, 0)
        const clampedStart = Math.max(weekStart, startMs)
        const clampedEnd = Math.min(weekEnd, endMs)
        const xHours = (clampedStart - startMs) / 3600000
        const wHours = (clampedEnd - clampedStart) / 3600000
        // ISO week number
        const wDate = new Date(weekStart)
        const jan4 = new Date(wDate.getFullYear(), 0, 4)
        const weekNum = Math.ceil(((wDate.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1) / 7)

        buckets.push({
          dateStr: formatISO(new Date(weekStart)),
          label: `W${weekNum}`,
          flights: dayFlights.length,
          blockHours: Math.round(blockMin / 6) / 10,
          xPx: xHours * pph,
          widthPx: wHours * pph,
          isWeekend: false,
        })
        weekStart = weekEnd
      }
      return buckets
    }
  }, [assignedFlights, totalDaysToRender, pixelsPerHour, startDate, histogramMode])

  // ─── EOD location per registration per day ─────────────────────────
  const showEodBadges = ganttSettings.display?.eodBadges ?? true
  const eodEveryDay = zoomDays <= 7 // ≤7D: badge every day; >7D: one badge at right edge

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
    onBarMouseDown, onBodyMouseMove, onBodyMouseUp, cancelDrag,
    resetWorkspace, addWorkspaceOverrides, removeWorkspaceOverrides,
    isDragged, isGhostPlaceholder,
    getDragDeltaY, getWorkspaceReg, confirmDrop, cancelDrop,
  } = useGanttDrag({
    selectedFlights,
    icaoToFamily,
    icaoToCategory,
    getFlightIcao,
    getRouteCycleMates,
    anyModalOpen: deleteModalOpen || miniBuilderOpen || assignModalOpen || unassignModalOpen || swapDialogOpen,
    clipboardActive: false, // clipboard hook runs after drag — anyModalOpen covers paste dialogs
  })

  // ─── Clipboard (Cut/Paste via workspace overrides) ──────────────
  const {
    clipboard, justPastedIds,
    isFlightGhosted, clearClipboard, setTargetReg: setClipboardTargetReg,
    pasteToTarget,
  } = useGanttClipboard({
    selectedFlights,
    clearSelection: () => setSelectedFlights(new Set()),
    anyModalOpen: deleteModalOpen || miniBuilderOpen || assignModalOpen || unassignModalOpen || swapDialogOpen || !!pendingDrop,
    onAssign: () => setAssignModalOpen(true),
    onPaste: (expandedIds, targetReg) => addWorkspaceOverrides(expandedIds.map(id => [id, targetReg])),
  })

  // ─── Workspace-aware flight placement ──────────────────────────
  // Override flightsByReg to account for workspace overrides
  const wsFlightsByReg = useMemo(() => {
    if (workspaceOverrides.size === 0) return flightsByReg

    const map = new Map<string, ExpandedFlight[]>()
    for (const ef of assignedFlights) {
      const wsReg = workspaceOverrides.get(ef.id)
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
      const wsReg = workspaceOverrides.get(ef.id)
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

  // ─── Flight panel data ─────────────────────────────────────────────
  const flightPanelData = useMemo(() => {
    if (panelMode !== 'flight' || selectedFlights.size === 0) return null
    const flights = assignedFlights.filter(f => selectedFlights.has(f.id))
    if (flights.length === 0) return null

    if (flights.length === 1) {
      const ef = flights[0]
      const assignedReg = ef.aircraftReg
      const hasDbAssignment = !!assignedReg
      const dateStr = formatISO(ef.date)
      const icao = ef.aircraftTypeIcao || 'UNKN'
      const reg = hasDbAssignment ? registrations.find(r => r.registration === assignedReg) : null
      const cabin = reg ? getCabinString(reg) : ''

      let utilFlights: typeof assignedFlights = []
      if (hasDbAssignment) {
        utilFlights = assignedFlights.filter(f => {
          const fReg = f.aircraftReg || f.assignedReg
          return fReg === assignedReg && formatISO(f.date) === dateStr
        })
      }
      const totalBlock = utilFlights.reduce((s, f) => s + f.blockMinutes, 0)
      const acTypeInfo = icao !== 'UNKN' ? acTypeByIcao.get(icao) : undefined
      const categoryDefault = acTypeInfo?.category === 'widebody' ? 14 : acTypeInfo?.category === 'regional' ? 10 : 12
      const targetHours = (ganttSettings.utilizationTargets ?? {})[icao] ?? categoryDefault
      const utilPct = totalBlock > 0 ? Math.round((totalBlock / 60 / targetHours) * 100) : 0

      return {
        mode: 'single' as const,
        flight: ef,
        assignedReg,
        hasDbAssignment,
        icao,
        cabin,
        totalBlock,
        flightCount: utilFlights.length,
        targetHours,
        utilPct,
      }
    }

    const totalBlock = flights.reduce((s, f) => s + f.blockMinutes, 0)
    const uniqueDates = new Set(flights.map(f => formatISO(f.date)))
    const uniqueRegs = new Set(flights.map(f => f.aircraftReg || f.assignedReg).filter(Boolean))
    return {
      mode: 'multi' as const,
      flights,
      count: flights.length,
      totalBlock,
      dateCount: uniqueDates.size,
      regCount: uniqueRegs.size,
    }
  }, [panelMode, selectedFlights, assignedFlights, registrations, acTypeByIcao, ganttSettings.utilizationTargets])

  // ─── Flight Links panel data (multi-select same row) ────────────
  const flightLinksPanelData = useMemo(() => {
    if (panelMode !== 'flight' || selectedFlights.size < 2) return null

    const flights = assignedFlights
      .filter(f => selectedFlights.has(f.id))
      .sort((a, b) => {
        const dateDiff = a.date.getTime() - b.date.getTime()
        if (dateDiff !== 0) return dateDiff
        return a.stdMinutes - b.stdMinutes
      })

    if (flights.length < 2) return null

    // Check if all on same row
    const rowRegs = flights.map(f => f.aircraftReg || f.assignedReg)
    const uniqueRegs = new Set(rowRegs.filter(Boolean))
    if (uniqueRegs.size > 1) return null

    const reg = Array.from(uniqueRegs)[0] || null
    const regInfo = reg ? registrations.find(r => r.registration === reg) : null
    const icao = flights[0].aircraftTypeIcao || 'UNKN'

    // Build links between consecutive flights
    type LinkStatus = 'ok' | 'tight' | 'violated' | 'mismatch'
    const links: {
      from: ExpandedFlight
      to: ExpandedFlight
      gapMinutes: number
      minTat: number
      status: LinkStatus
      stationMismatch: boolean
    }[] = []

    for (let i = 0; i < flights.length - 1; i++) {
      const curr = flights[i]
      const next = flights[i + 1]
      const sameDate = formatISO(curr.date) === formatISO(next.date)
      const stationMismatch = curr.arrStation !== next.depStation

      let gapMinutes = 0
      if (sameDate) {
        gapMinutes = next.stdMinutes - curr.staMinutes
      } else {
        const currStaAbs = curr.date.getTime() + curr.staMinutes * 60000
        const nextStdAbs = next.date.getTime() + next.stdMinutes * 60000
        gapMinutes = Math.round((nextStdAbs - currStaAbs) / 60000)
      }

      // Calculate min TAT using getTatMinutes
      const currIcao = curr.aircraftTypeIcao
      const acType = currIcao ? acTypeByIcao.get(currIcao) : undefined
      const arrivingDom = isRouteDomestic(curr.routeType)
      const departingDom = isRouteDomestic(next.routeType)
      const tatOverride = currIcao ? (ganttSettings.tatOverrides ?? {})[currIcao] : undefined
      const minTat = getTatMinutes(acType, arrivingDom, departingDom, tatOverride)

      let status: LinkStatus
      if (stationMismatch) {
        status = 'mismatch'
      } else if (minTat > 0 && gapMinutes < minTat) {
        status = 'violated'
      } else if (minTat > 0 && gapMinutes < minTat + 5) {
        status = 'tight'
      } else {
        status = 'ok'
      }

      links.push({ from: curr, to: next, gapMinutes, minTat, status, stationMismatch })
    }

    // Station sequence
    const stations = [flights[0].depStation]
    for (const f of flights) stations.push(f.arrStation)

    // Breaks
    const stationBreaks = new Set<number>()
    for (let i = 0; i < links.length; i++) {
      if (links[i].stationMismatch) stationBreaks.add(i)
    }

    const isCircular = flights[0].depStation === flights[flights.length - 1].arrStation

    // Summary
    const totalBlockMinutes = flights.reduce((s, f) => s + f.blockMinutes, 0)
    const totalGroundMinutes = links
      .filter(l => !l.stationMismatch)
      .reduce((s, l) => s + Math.max(0, l.gapMinutes), 0)
    const mismatchCount = links.filter(l => l.stationMismatch).length

    const firstDate = flights[0].date
    const lastDate = flights[flights.length - 1].date
    const singleDate = formatISO(firstDate) === formatISO(lastDate)

    let elapsedMinutes: number
    if (singleDate) {
      elapsedMinutes = flights[flights.length - 1].staMinutes - flights[0].stdMinutes
    } else {
      const startAbs = firstDate.getTime() + flights[0].stdMinutes * 60000
      const endAbs = lastDate.getTime() + flights[flights.length - 1].staMinutes * 60000
      elapsedMinutes = Math.round((endAbs - startAbs) / 60000)
    }

    const domesticCount = flights.filter(f => isRouteDomestic(f.routeType)).length
    const internationalCount = flights.length - domesticCount

    // Date groups
    const dateGroups: string[] = []
    for (const f of flights) {
      const ds = formatISO(f.date)
      if (dateGroups.length === 0 || dateGroups[dateGroups.length - 1] !== ds) dateGroups.push(ds)
    }

    return {
      reg,
      icao,
      cabin: regInfo ? getCabinString(regInfo) : '',
      flights,
      links,
      stations,
      stationBreaks,
      isCircular,
      singleDate,
      totalBlockMinutes,
      totalGroundMinutes,
      mismatchCount,
      elapsedMinutes,
      firstStdLocal: flights[0].stdLocal,
      lastStaLocal: flights[flights.length - 1].staLocal,
      firstDate: formatISO(firstDate),
      lastDate: formatISO(lastDate),
      legs: flights.length,
      domesticCount,
      internationalCount,
    }
  }, [panelMode, selectedFlights, assignedFlights, registrations, acTypeByIcao, ganttSettings.tatOverrides])

  // ─── Aircraft panel data ──────────────────────────────────────────
  const aircraftPanelData = useMemo(() => {
    if (panelMode !== 'aircraft' || !panelAircraftReg) return null
    const reg = registrations.find(r => r.registration === panelAircraftReg)
    if (!reg) return null

    const icao = reg.aircraft_types?.icao_type || 'UNKN'
    const cabin = getCabinString(reg)
    const homeBase = reg.home_base?.iata_code || null

    const allFlights = assignedFlights.filter(f => {
      const fReg = f.aircraftReg || f.assignedReg
      return fReg === panelAircraftReg
    })
    const totalBlock = allFlights.reduce((s, f) => s + f.blockMinutes, 0)
    const activeDates = new Set(allFlights.map(f => formatISO(f.date)))

    // Overnight stations
    const stationCounts = new Map<string, number>()
    for (const dateStr of Array.from(activeDates)) {
      const dayFlights = allFlights.filter(f => formatISO(f.date) === dateStr).sort((a, b) => b.staMinutes - a.staMinutes)
      if (dayFlights.length > 0) {
        const s = dayFlights[0].arrStation
        stationCounts.set(s, (stationCounts.get(s) || 0) + 1)
      }
    }
    const overnightStations = Array.from(stationCounts.entries())
      .map(([station, count]) => ({ station, count }))
      .sort((a, b) => b.count - a.count)

    return {
      registration: panelAircraftReg,
      icao,
      cabin,
      homeBase,
      totalBlock,
      flightCount: allFlights.length,
      activeDays: activeDates.size,
      periodDays: periodDays || 1,
      overnightStations,
    }
  }, [panelMode, panelAircraftReg, assignedFlights, registrations, periodDays])

  // ─── Rotation panel data ──────────────────────────────────────────
  const rotationPanelData = useMemo(() => {
    if (panelMode !== 'rotation' || !rotationTarget) return null
    const { reg, date } = rotationTarget
    const regInfo = registrations.find(r => r.registration === reg)
    const icao = regInfo?.aircraft_types?.icao_type || 'UNKN'
    const cabin = regInfo ? getCabinString(regInfo) : ''

    const dayFlights = assignedFlights
      .filter(f => {
        const fReg = f.aircraftReg || f.assignedReg
        return fReg === reg && formatISO(f.date) === date
      })
      .sort((a, b) => a.stdMinutes - b.stdMinutes)

    const hasDbAssigned = dayFlights.some(f => !!f.aircraftReg)
    const hasAutoAssigned = dayFlights.some(f => !f.aircraftReg)

    const rotation: RotationFlight[] = dayFlights.map((f, i) => {
      let tatToNext: TatInfo | null = null
      if (i < dayFlights.length - 1) {
        tatToNext = calcTat(f, dayFlights[i + 1])
      }
      const routeBlockStart = i === 0 || !f.routeId || f.routeId !== dayFlights[i - 1].routeId
      return { ...f, tatToNext, routeBlockStart }
    })

    const conflicts: ConflictInfo[] = []
    for (let i = 0; i < rotation.length - 1; i++) {
      const curr = rotation[i]
      const next = rotation[i + 1]
      const sameRoute = curr.routeId && next.routeId && curr.routeId === next.routeId
      const bothDbAssigned = !!curr.aircraftReg && !!next.aircraftReg
      if (!bothDbAssigned) continue
      if (next.stdMinutes < curr.staMinutes) {
        conflicts.push({ type: 'overlap', flightA: curr, flightB: next, detail: `${stripFlightPrefix(curr.flightNumber)} (STA ${curr.staLocal}) overlaps with ${stripFlightPrefix(next.flightNumber)} (STD ${next.stdLocal})` })
      } else if (!sameRoute) {
        if (curr.arrStation !== next.depStation) {
          conflicts.push({ type: 'station_mismatch', flightA: curr, flightB: next, detail: `${curr.arrStation} ≠ ${next.depStation}: ${stripFlightPrefix(curr.flightNumber)} arrives ${curr.arrStation} but ${stripFlightPrefix(next.flightNumber)} departs ${next.depStation}` })
        }
        if (curr.tatToNext && !curr.tatToNext.ok) {
          conflicts.push({ type: 'insufficient_tat', flightA: curr, flightB: next, detail: `${fmtTat(curr.tatToNext.gapMinutes)} gap < ${fmtTat(curr.tatToNext.minTat)} minimum between ${stripFlightPrefix(curr.flightNumber)} and ${stripFlightPrefix(next.flightNumber)}` })
        }
      }
    }

    const totalBlock = dayFlights.reduce((s, f) => s + f.blockMinutes, 0)
    const acTypeInfo = icao !== 'UNKN' ? acTypeByIcao.get(icao) : undefined
    const categoryDefault = acTypeInfo?.category === 'widebody' ? 14 : acTypeInfo?.category === 'regional' ? 10 : 12
    const targetHours = (ganttSettings.utilizationTargets ?? {})[icao] ?? categoryDefault
    const utilPct = totalBlock > 0 ? Math.round((totalBlock / 60 / targetHours) * 100) : 0

    const displayDate = new Date(date + 'T00:00:00')
    return {
      reg,
      date,
      icao,
      cabin,
      rotation,
      conflicts,
      hasDbAssigned,
      hasAutoAssigned,
      totalBlock,
      flightCount: dayFlights.length,
      targetHours,
      utilPct,
      dateStr: displayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelMode, rotationTarget, assignedFlights, registrations, acTypeByIcao, ganttSettings.utilizationTargets, ganttSettings.tatOverrides])

  // ─── Day panel data (day-stats mode) ─────────────────────────────
  const dayPanelData = useMemo(() => {
    if (selectedDays.size === 0) return null
    const days = Array.from(selectedDays).sort()
    const dayFlights = assignedFlights.filter(f => days.includes(formatISO(f.date)))
    const numDays = days.length

    const totalFlights = dayFlights.length
    const totalBlock = dayFlights.reduce((s, f) => s + f.blockMinutes, 0)
    const uniqueRegs = new Set(dayFlights.map(f => f.assignedReg || f.aircraftReg).filter(Boolean))

    // Total AC in fleet (from registrations, active/operational only)
    const totalAcInFleet = registrations.filter(r => r.status === 'active' || r.status === 'operational').length

    // Activity by AC type
    const byType = new Map<string, { flights: number; blockMin: number; activeRegs: Set<string> }>()
    for (const f of dayFlights) {
      const icao = f.aircraftTypeIcao || 'UNKN'
      const entry = byType.get(icao) || { flights: 0, blockMin: 0, activeRegs: new Set<string>() }
      entry.flights++
      entry.blockMin += f.blockMinutes
      const reg = f.assignedReg || f.aircraftReg
      if (reg) entry.activeRegs.add(reg)
      byType.set(icao, entry)
    }

    // Total AC per type (from fleet registrations)
    const totalRegsByType = new Map<string, number>()
    for (const reg of registrations) {
      if (reg.status !== 'active' && reg.status !== 'operational') continue
      const icao = reg.aircraft_types?.icao_type || 'UNKN'
      totalRegsByType.set(icao, (totalRegsByType.get(icao) || 0) + 1)
    }

    // Utilization data per type
    const utilData = Array.from(byType.entries()).map(([icao, d]) => {
      const totalRegsForType = totalRegsByType.get(icao) || d.activeRegs.size
      const activeCount = d.activeRegs.size
      const avgActive = activeCount > 0 ? (d.blockMin / 60) / (activeCount * numDays) : 0
      const avgFleet = totalRegsForType > 0 ? (d.blockMin / 60) / (totalRegsForType * numDays) : 0
      const target = ganttSettings.utilizationTargets[icao] || (acTypeByIcao.get(icao)?.category === 'widebody' ? 14 : 12)
      return {
        icao,
        avgActive: Math.round(avgActive * 10) / 10,
        avgFleet: Math.round(avgFleet * 10) / 10,
        target,
        activeCount,
        totalRegs: totalRegsForType,
      }
    }).sort((a, b) => b.avgActive - a.avgActive)

    // Overnight stations
    const overnightStations = new Map<string, number>()
    for (const day of days) {
      Array.from(eodLocations.entries()).forEach(([key, val]) => {
        if (key.endsWith(`|${day}`)) {
          overnightStations.set(val.station, (overnightStations.get(val.station) || 0) + 1)
        }
      })
    }
    const overnightTotal = Array.from(overnightStations.values()).reduce((s, c) => s + c, 0)

    // Build a smart label for the panel header
    const fmtDayLabel = (ds: string[]) => {
      if (ds.length === 1) {
        return new Date(ds[0] + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
      }
      const isContiguous = ds.every((d, i) => {
        if (i === 0) return true
        const prev = new Date(ds[i - 1] + 'T00:00:00')
        const curr = new Date(d + 'T00:00:00')
        return curr.getTime() - prev.getTime() === 86400000
      })
      if (isContiguous) {
        const first = new Date(ds[0] + 'T00:00:00')
        const last = new Date(ds[ds.length - 1] + 'T00:00:00')
        const f = first.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        const l = last.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        return `${f} – ${l} (${ds.length} days)`
      }
      const parts = ds.map(d => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }))
      if (parts.length <= 3) return parts.join(', ')
      return `${parts.slice(0, 2).join(', ')} +${parts.length - 2} more`
    }

    return {
      days,
      numDays,
      label: fmtDayLabel(days),
      totalFlights,
      totalBlockHours: Math.round(totalBlock / 6) / 10,
      avgDailyFlights: numDays > 1 ? Math.round(totalFlights / numDays * 10) / 10 : null,
      avgDailyBlockHours: numDays > 1 ? Math.round(totalBlock / numDays / 6) / 10 : null,
      aircraftInService: uniqueRegs.size,
      totalAcInFleet,
      byType: Array.from(byType.entries()).map(([icao, d]) => ({
        icao,
        flights: d.flights,
        blockHours: Math.round(d.blockMin / 6) / 10,
        activeRegs: d.activeRegs.size,
        totalRegs: totalRegsByType.get(icao) || d.activeRegs.size,
      })).sort((a, b) => b.flights - a.flights),
      utilData,
      overnightStations: Array.from(overnightStations.entries())
        .map(([station, count]) => ({ station, count, pct: overnightTotal > 0 ? Math.round(count / overnightTotal * 100) : 0 }))
        .sort((a, b) => b.count - a.count),
      overnightTotal,
    }
  }, [selectedDays, assignedFlights, eodLocations, registrations, ganttSettings.utilizationTargets, acTypeByIcao])

  const toggleCollapse = (icao: string) => {
    setCollapsedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(icao)) next.delete(icao)
      else next.add(icao)
      return next
    })
  }

  const handleBarClick = (id: string, e: React.MouseEvent) => {
    setSelectedAircraftRow(null)
    setContextMenu(null)
    setPanelMode('flight')
    setSelectedDays(new Set())
    setPanelAircraftReg(null)
    setRotationTarget(null)
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

  // ─── Day selection helpers ──────────────────────────────────────────
  const allDateStrs = useMemo(() => {
    const arr: string[] = []
    for (let d = 0; d < totalDaysToRender; d++) arr.push(formatISO(addDays(startDate, d)))
    return arr
  }, [totalDaysToRender, startDate])

  const getDayRangeBetween = useCallback((a: string, b: string): string[] => {
    const idxA = allDateStrs.indexOf(a)
    const idxB = allDateStrs.indexOf(b)
    if (idxA < 0 || idxB < 0) return [a]
    const lo = Math.min(idxA, idxB)
    const hi = Math.max(idxA, idxB)
    return allDateStrs.slice(lo, hi + 1)
  }, [allDateStrs])

  // Pending drag range (visual preview before mouseup)
  const dayDragPending = useMemo((): Set<string> => {
    if (!dayDragStart || !dayDragEnd) return new Set()
    return new Set(getDayRangeBetween(dayDragStart, dayDragEnd))
  }, [dayDragStart, dayDragEnd, getDayRangeBetween])

  const handleDayMouseDown = useCallback((dateStr: string, e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+click: toggle individual day
      setSelectedDays(prev => {
        const next = new Set(prev)
        if (next.has(dateStr)) next.delete(dateStr)
        else next.add(dateStr)
        return next
      })
      setSelectedFlights(new Set())
      setPanelMode('day-stats')
      setPanelVisible(true)
      return
    }
    // Start drag selection
    setDayDragStart(dateStr)
    setDayDragEnd(dateStr)
    dayDragActiveRef.current = true
  }, [])

  const handleDayMouseEnter = useCallback((dateStr: string) => {
    if (dayDragActiveRef.current) {
      setDayDragEnd(dateStr)
    }
  }, [])

  // Global mouseup to finalize drag selection
  useEffect(() => {
    const handleMouseUp = () => {
      if (!dayDragActiveRef.current) return
      dayDragActiveRef.current = false
      if (dayDragStart && dayDragEnd) {
        const range = getDayRangeBetween(dayDragStart, dayDragEnd)
        setSelectedDays(new Set(range))
        setSelectedFlights(new Set())
        setPanelMode('day-stats')
        setPanelVisible(true)
      }
      setDayDragStart(null)
      setDayDragEnd(null)
    }
    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [dayDragStart, dayDragEnd, getDayRangeBetween])

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
    if (selectedFlightObjects.length === 0 || deleting) return
    setDeleting(true)
    try {
      const items: FlightDateItem[] = selectedFlightObjects.map(ef => ({
        flightId: ef.flightId,
        flightDate: formatISO(ef.date),
      }))
      const result = await excludeFlightDates(items)
      if (result.error) {
        toast.error(friendlyError(result.error))
        return
      }
      const n = items.length
      toast.success(`${n} flight${n > 1 ? 's' : ''} removed`)
      setDeleteModalOpen(false)
      setSelectedFlights(new Set())
      refreshFlights()
    } finally {
      setDeleting(false)
    }
  }, [selectedFlightObjects, deleting, refreshFlights])

  // ─── Right-click handler ───────────────────────────────────────
  const handleBarContextMenu = useCallback((e: React.MouseEvent, flightId: string, rowReg?: string) => {
    e.preventDefault()
    e.stopPropagation()
    // If the right-clicked flight isn't already selected, select it alone
    if (!selectedFlights.has(flightId)) {
      setSelectedFlights(new Set([flightId]))
    }
    setContextMenu({ x: e.clientX, y: e.clientY, rowReg })
  }, [selectedFlights])

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return
    const handleClick = () => setContextMenu(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [contextMenu])

  // ─── Swap confirm handler ─────────────────────────────────────
  const handleSwapConfirm = useCallback(async (sideAItems: FlightDateItem[], sideBItems: FlightDateItem[], rA: string, rB: string) => {
    const res = await swapFlightAssignments(sideAItems, rA, sideBItems, rB)
    if (res.error) { toast.error(friendlyError(res.error)); return }
    const total = sideAItems.length + sideBItems.length
    toast.success(`Swapped ${total} flight${total > 1 ? 's' : ''} between ${rA} and ${rB}`)
    applyOptimisticAssign(sideAItems, rB)
    applyOptimisticAssign(sideBItems, rA)
    removeWorkspaceOverrides([...sideAItems, ...sideBItems].map(i => `${i.flightId}_${i.flightDate}`))
    setSwapDialogOpen(false)
    setSwapMode(false)
    setSwapSource([])
    setSelectedFlights(new Set())
    setTimeout(() => refreshFlights(), 500)
  }, [applyOptimisticAssign, removeWorkspaceOverrides, refreshFlights])

  // ─── Enter swap mode from context menu ──────────────────────
  const enterSwapMode = useCallback(() => {
    if (selectedFlightObjects.length === 0) return
    setSwapSource([...selectedFlightObjects])
    setSwapMode(true)
    setSelectedFlights(new Set())
    setContextMenu(null)
  }, [selectedFlightObjects])

  // Keep ref in sync for keyboard handler
  enterSwapModeRef.current = enterSwapMode

  // Swap mode: when selection changes, check if selected flights are on a different reg
  useEffect(() => {
    if (!swapMode || selectedFlights.size === 0 || swapSource.length === 0) return
    const selectedObjs = assignedFlights.filter(f => selectedFlights.has(f.id))
    if (selectedObjs.length === 0) return

    const sourceRegs = new Set(swapSource.map(f => f.aircraftReg || f.assignedReg).filter(Boolean))
    const targetRegs = new Set(selectedObjs.map(f => f.aircraftReg || f.assignedReg).filter(Boolean))

    // Check if any target flight is on the same reg as source
    const sameReg = Array.from(targetRegs).some(r => sourceRegs.has(r))
    if (sameReg && targetRegs.size === 1 && sourceRegs.size === 1 && Array.from(targetRegs)[0] === Array.from(sourceRegs)[0]) {
      toast.info('Select flights on a different aircraft row', { duration: 2000 })
      return
    }

    // Different reg — open swap dialog
    const sourceReg = Array.from(sourceRegs)[0] || ''
    const targetReg = Array.from(targetRegs).find(r => !sourceRegs.has(r)) || ''
    if (sourceReg && targetReg) {
      setSwapSideA(swapSource)
      setSwapSideB(selectedObjs)
      setSwapRegA(sourceReg)
      setSwapRegB(targetReg)
      setSwapDialogOpen(true)
      setSwapMode(false)
      setSwapSource([])
      setSelectedFlights(new Set())
    }
  }, [swapMode, selectedFlights, swapSource, assignedFlights])

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

  // Resolved AC type colors (with palette fallback)
  // Use ALL active aircraft types sorted alphabetically — same ordering as
  // GanttSettingsPanel so palette auto-assignment produces identical colors.
  const acTypeColors = useMemo(() => {
    const result: Record<string, string> = { ...ganttSettings.colorAcType }
    const allActive = aircraftTypes
      .filter(t => t.is_active)
      .sort((a, b) => a.icao_type.localeCompare(b.icao_type))
    allActive.forEach((t, i) => {
      if (!result[t.icao_type]) {
        result[t.icao_type] = AC_TYPE_COLOR_PALETTE[i % AC_TYPE_COLOR_PALETTE.length]
      }
    })
    return result
  }, [ganttSettings.colorAcType, aircraftTypes])

  // Registration → ICAO type lookup (for left panel coloring)
  const regToIcao = useMemo(() => {
    const map = new Map<string, string>()
    for (const reg of registrations) {
      map.set(reg.registration, reg.aircraft_types?.icao_type || 'UNKN')
    }
    return map
  }, [registrations])

  // Fleet preview data for settings panel AC type color preview
  const fleetPreview = useMemo<FleetPreviewItem[]>(() => {
    return groups.flatMap(g =>
      g.registrations.map(reg => ({
        icaoType: g.icaoType,
        registration: reg.registration,
        cabin: getCabinString(reg),
      }))
    )
  }, [groups])

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
        let sortedRegs = [...g.registrations]
        if (sortOrder === 'type_util') {
          sortedRegs.sort((a, b) => (utilByReg.get(b.registration) ?? 0) - (utilByReg.get(a.registration) ?? 0))
        }
        const customRegs = customAircraftOrder[g.icaoType]
        if (customRegs && customRegs.length > 0) {
          const orderMap = new Map(customRegs.map((reg, i) => [reg, i]))
          sortedRegs.sort((a, b) => (orderMap.get(a.registration) ?? 9999) - (orderMap.get(b.registration) ?? 9999))
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
  }, [groups, collapsedTypes, seatingByAircraft, acTypeMap, overflowByType, ganttSettings.fleetSortOrder, utilByReg, customAircraftOrder])

  // ─── Move aircraft row within group ──────────────────────────────
  const moveAircraftRow = useCallback((reg: string, direction: 'up' | 'down' | 'top' | 'bottom') => {
    const sortOrder = ganttSettings.fleetSortOrder ?? 'type_reg'
    if (sortOrder === 'reg_only') return

    const icao = regToIcao.get(reg)
    if (!icao) return

    // Derive current order from rows
    const currentOrder = customAircraftOrder[icao]
      ?? rows.filter((r): r is { type: 'aircraft'; reg: AircraftWithRelations; cabin: string } => r.type === 'aircraft' && regToIcao.get(r.reg.registration) === icao).map(r => r.reg.registration)
    const idx = currentOrder.indexOf(reg)
    if (idx === -1) return

    const newOrder = [...currentOrder]
    if (direction === 'up' && idx > 0) {
      ;[newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]]
    } else if (direction === 'down' && idx < newOrder.length - 1) {
      ;[newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]]
    } else if (direction === 'top' && idx > 0) {
      newOrder.splice(idx, 1)
      newOrder.unshift(reg)
    } else if (direction === 'bottom' && idx < newOrder.length - 1) {
      newOrder.splice(idx, 1)
      newOrder.push(reg)
    } else {
      return // already at boundary
    }

    setCustomAircraftOrder(prev => ({ ...prev, [icao]: newOrder }))
    setFlashReg(reg)
    setTimeout(() => setFlashReg(null), 200)
  }, [ganttSettings.fleetSortOrder, regToIcao, customAircraftOrder, rows])
  moveAircraftRowRef.current = moveAircraftRow

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

  // ─── Scroll to highlighted search result ──────────────────────────
  const doScrollToFlight = useCallback((ef: ExpandedFlight) => {
    const body = bodyRef.current
    if (!body) return

    // Horizontal: center the bar in the viewport
    const barX = getFlightX(ef)
    const barW = getFlightWidth(ef)
    const barCenterX = barX + barW / 2
    const viewW = body.clientWidth
    const targetLeft = Math.max(0, barCenterX - viewW / 2)

    // Vertical: find which row this flight is in
    const effectiveReg = ef.aircraftReg || ef.assignedReg
    let targetY = 0
    let found = false

    // First: try to match by exact registration in rowLayout
    if (effectiveReg) {
      for (const rl of rowLayout) {
        if (rl.type === 'aircraft' && rl.registration === effectiveReg) {
          targetY = rl.yTop + rl.height / 2
          found = true
          break
        }
      }
    }

    // Second: try overflow row for matching AC type
    if (!found) {
      const targetIcao = ef.aircraftTypeIcao || ''
      for (const rl of rowLayout) {
        if (rl.type === 'overflow' && rl.icaoType === targetIcao) {
          targetY = rl.yTop + rl.height / 2
          found = true
          break
        }
      }
    }

    // Third: fallback to any overflow row
    if (!found) {
      for (const rl of rowLayout) {
        if (rl.type === 'overflow') {
          targetY = rl.yTop + rl.height / 2
          found = true
          break
        }
      }
    }

    // Fourth: fallback to group header for the AC type
    if (!found) {
      const targetIcao = ef.aircraftTypeIcao || ''
      for (const rl of rowLayout) {
        if (rl.type === 'group' && rl.icaoType === targetIcao) {
          targetY = rl.yTop + rl.height / 2
          found = true
          break
        }
      }
    }

    // Scroll both axes
    body.scrollLeft = targetLeft
    if (found) {
      const viewH = body.clientHeight
      body.scrollTop = Math.max(0, targetY - viewH / 2)
    }
    handleBodyScroll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowLayout, pixelsPerHour, startDate])

  const scrollToFlight = useCallback((ef: ExpandedFlight) => {
    const effectiveReg = ef.aircraftReg || ef.assignedReg
    const icao = ef.aircraftTypeIcao || ''

    // Check if AC type is filtered out
    const isFilteredOut = acTypeFilter !== null && icao !== '' && icao !== acTypeFilter
    // Check if the group is collapsed (registration would be hidden)
    const isCollapsed = collapsedTypes.has(icao)

    let needsRerender = false

    if (isFilteredOut) {
      setAcTypeFilter(null)
      needsRerender = true
    }

    if (isCollapsed && effectiveReg) {
      setCollapsedTypes(prev => {
        if (prev.has(icao)) {
          const next = new Set(prev)
          next.delete(icao)
          return next
        }
        return prev
      })
      needsRerender = true
    }

    if (needsRerender) {
      // Wait for DOM update after state changes, then scroll
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          doScrollToFlight(ef)
        })
      })
    } else {
      doScrollToFlight(ef)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doScrollToFlight, acTypeFilter, collapsedTypes])

  // ─── Aircraft search results ───────────────────────────────────────
  interface AircraftSearchResult {
    registration: string
    icaoType: string
    cabin: string
    reg: AircraftWithRelations
    /** true if the aircraft exists but is filtered out by acTypeFilter */
    filteredOut: boolean
    filteredType?: string
  }

  const aircraftSearchResults = useMemo<AircraftSearchResult[]>(() => {
    const q = aircraftSearchQuery.trim().toUpperCase()
    if (!q) return []
    // Strip common prefix
    const cleaned = q.replace(/^VN-?/i, '')
    if (!cleaned) return []

    const results: AircraftSearchResult[] = []

    // Search within current groups (visible registrations)
    for (const g of groups) {
      for (const reg of g.registrations) {
        const regStr = reg.registration.toUpperCase()
        const stripped = regStr.replace(/^VN-?/, '')
        if (regStr.includes(cleaned) || stripped.includes(cleaned)) {
          results.push({
            registration: reg.registration,
            icaoType: g.icaoType,
            cabin: getCabinString(reg),
            reg,
            filteredOut: false,
          })
        }
      }
    }

    // Check if there are matches in registrations filtered out by acTypeFilter
    if (acTypeFilter) {
      for (const reg of registrations) {
        const icao = reg.aircraft_types?.icao_type || 'UNKN'
        if (icao === acTypeFilter) continue // already in groups
        const regStr = reg.registration.toUpperCase()
        const stripped = regStr.replace(/^VN-?/, '')
        if (regStr.includes(cleaned) || stripped.includes(cleaned)) {
          results.push({
            registration: reg.registration,
            icaoType: icao,
            cabin: getCabinString(reg),
            reg,
            filteredOut: true,
            filteredType: icao,
          })
        }
      }
    }

    return results
  }, [aircraftSearchQuery, groups, registrations, acTypeFilter])

  // ─── Scroll to aircraft row ────────────────────────────────────────
  const scrollToAircraft = useCallback((result: AircraftSearchResult) => {
    const body = bodyRef.current
    if (!body) return

    // If the group is collapsed, expand it
    const icao = result.icaoType
    setCollapsedTypes(prev => {
      if (prev.has(icao)) {
        const next = new Set(prev)
        next.delete(icao)
        return next
      }
      return prev
    })

    // If filtered out, clear the acTypeFilter to show the aircraft
    if (result.filteredOut) {
      setAcTypeFilter(null)
    }

    // Set highlight (will fade after 2s)
    setAircraftHighlightReg(result.registration)

    // Use requestAnimationFrame to wait for DOM update after state changes
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Re-read body ref in case of DOM changes
        const b = bodyRef.current
        if (!b) return

        // Find row in current layout — need to search fresh since rows may have changed
        // Since rowLayout is a useMemo, it won't have updated yet, so we calculate manually
        let targetY = 0
        let found = false

        // Walk rows to find the target registration
        // We use the leftPanelRef children as a proxy for row positions
        const lp = leftPanelRef.current
        if (lp) {
          const children = lp.children
          for (let i = 0; i < children.length; i++) {
            const child = children[i] as HTMLElement
            // Aircraft rows have key starting with 'a-'
            if (child.dataset?.reg === result.registration) {
              targetY = child.offsetTop + child.offsetHeight / 2
              found = true
              break
            }
          }
        }

        // Fallback: search rowLayout
        if (!found) {
          for (const rl of rowLayout) {
            if (rl.type === 'aircraft' && rl.registration === result.registration) {
              targetY = rl.yTop + rl.height / 2
              found = true
              break
            }
          }
        }

        if (found) {
          const viewH = b.clientHeight
          b.scrollTop = targetY - viewH / 2
          handleBodyScroll()
        }
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowLayout])

  // ─── Fade aircraft highlight after 2s ──────────────────────────────
  useEffect(() => {
    if (!aircraftHighlightReg) return
    const timer = setTimeout(() => setAircraftHighlightReg(null), 2000)
    return () => clearTimeout(timer)
  }, [aircraftHighlightReg])

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
  const headerH = timeMode === 'dual' ? 56 : 40

  // ─── Fullscreen control scale ────────────────────────────────────────
  const ctrlScale = isFullscreen ? 1.3 : 1
  const s = (px: number) => isFullscreen ? Math.round(px * 1.3) : px

  // ─── Period Selector (shared between blank + active states) ────────
  const handleFromBlur = () => {
    if (fromText === '') { setPeriodFrom(null); return }
    const parsed = parseUserDate(fromText)
    if (parsed) { setPeriodFrom(parsed); if (periodCommitted) setPeriodCommitted(false) }
    else setFromText(periodFrom ? isoToDisplay(periodFrom) : '')
  }
  const handleToBlur = () => {
    if (toText === '') { setPeriodTo(null); return }
    const parsed = parseUserDate(toText)
    if (parsed) { setPeriodTo(parsed); if (periodCommitted) setPeriodCommitted(false) }
    else setToText(periodTo ? isoToDisplay(periodTo) : '')
  }
  const handleCalendarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const iso = e.target.value
    if (!iso) return
    if (pickTargetRef.current === 'from') {
      setPeriodFrom(iso)
      if (periodCommitted) setPeriodCommitted(false)
      pickTargetRef.current = 'to'
      // Re-open for TO pick after short delay
      setTimeout(() => calendarRef.current?.showPicker?.(), 100)
    } else {
      setPeriodTo(iso)
      if (periodCommitted) setPeriodCommitted(false)
      pickTargetRef.current = 'from'
    }
  }

  const periodSelector = (
    <div className="flex items-center gap-1.5">
      {/* Hidden native date input for calendar picker */}
      <input
        ref={calendarRef}
        type="date"
        className="sr-only"
        tabIndex={-1}
        onChange={handleCalendarPick}
      />
      <div className="flex items-center gap-1">
        <span style={{ fontSize: s(10), fontWeight: 600, color: 'var(--muted-foreground)' }}>From</span>
        <input
          type="text"
          placeholder="DD/MM/YYYY"
          value={fromText}
          onChange={(e) => setFromText(e.target.value)}
          onBlur={handleFromBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') { handleFromBlur(); (e.target as HTMLInputElement).blur() } }}
          className="bg-background border border-border rounded-md text-foreground tabular-nums outline-none focus:ring-1 focus:ring-primary/40 transition-all duration-200 placeholder:text-muted-foreground/40 placeholder:font-normal"
          style={{ width: s(110), height: s(26), fontSize: s(11), fontWeight: 500, textAlign: 'center', padding: `0 ${s(6)}px`, borderRadius: s(6) }}
        />
      </div>
      <div className="flex items-center gap-1">
        <span style={{ fontSize: s(10), fontWeight: 600, color: 'var(--muted-foreground)' }}>To</span>
        <input
          type="text"
          placeholder="DD/MM/YYYY"
          value={toText}
          onChange={(e) => setToText(e.target.value)}
          onBlur={handleToBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') { handleToBlur(); (e.target as HTMLInputElement).blur() } }}
          className="bg-background border border-border rounded-md text-foreground tabular-nums outline-none focus:ring-1 focus:ring-primary/40 transition-all duration-200 placeholder:text-muted-foreground/40 placeholder:font-normal"
          style={{ width: s(110), height: s(26), fontSize: s(11), fontWeight: 500, textAlign: 'center', padding: `0 ${s(6)}px`, borderRadius: s(6) }}
        />
      </div>
      <button
        onClick={() => { pickTargetRef.current = 'from'; calendarRef.current?.showPicker?.() }}
        className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        style={{ width: s(26), height: s(26), borderRadius: s(6) }}
        title="Pick dates from calendar"
      >
        <Calendar style={{ width: s(14), height: s(14) }} />
      </button>
      <button
        onClick={() => {
          if (!periodFrom && !periodTo) { toast.warning('Please select a date range first'); return }
          if (!periodFrom) { toast.warning('Please select a From date'); return }
          if (!periodTo) { toast.warning('Please select a To date'); return }
          let from = periodFrom, to = periodTo
          if (to < from) { from = periodTo; to = periodFrom; setPeriodFrom(from); setPeriodTo(to) }
          const totalDays = diffDays(parseDate(from), parseDate(to)) + 1
          setStartDate(parseDate(from))
          setZoomLevel(totalDays > 7 ? '7D' : findBestZoom(totalDays))
          setCommittedFrom(from)
          setCommittedTo(to)
          setPeriodCommitted(true)
        }}
        className="font-semibold text-white transition-all duration-200"
        style={{
          height: s(26), padding: `0 ${s(14)}px`, fontSize: s(10), borderRadius: s(6),
          background: '#991B1B',
          cursor: 'pointer',
          animation: periodDirty ? 'pulse 2s infinite' : 'none',
        }}
      >
        {periodDirty ? 'Go ↻' : 'Go'}
      </button>
      <button
        onClick={() => setSettingsPanelOpen(v => !v)}
        className={`rounded-md transition-all duration-200 ${settingsPanelOpen ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
        style={{ padding: s(6), width: s(26), height: s(26) }}
        title="Gantt Settings"
      >
        <Settings2 style={{ width: s(14), height: s(14) }} />
      </button>
      <button
        onClick={toggleFullscreen}
        className="flex items-center justify-center border border-border/60 text-muted-foreground hover:bg-muted transition-all duration-200"
        style={{ width: s(26), height: s(26), borderRadius: s(7) }}
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      >
        {isFullscreen
          ? <Minimize2 style={{ width: s(14), height: s(14) }} />
          : <Maximize2 style={{ width: s(14), height: s(14) }} />
        }
      </button>
    </div>
  )

  // ─── Blank state (no period selected) ─────────────────────────────
  if (!periodCommitted) {
    return (
      <div
        ref={ganttContainerRef}
        className={`gantt-fullscreen-target h-full flex flex-col overflow-hidden relative bg-background ${isFullscreen && typeof document !== 'undefined' && !document.fullscreenElement ? 'fixed inset-0 z-[9999]' : ''}`}
        style={{ '--ctrl-scale': ctrlScale } as React.CSSProperties}
      >
        <div className="shrink-0 glass border-b z-20" style={{ padding: `${s(8)}px ${s(16)}px` }}>
          <div className="flex items-center gap-3">
            {periodSelector}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 rounded-full bg-muted/30 flex items-center justify-center" style={{ width: 64, height: 64 }}>
              <CalendarRange className="text-muted-foreground" style={{ width: 28, height: 28 }} />
            </div>
            <p className="font-medium" style={{ fontSize: 13 }}>Select a period to view</p>
            <p className="text-muted-foreground mt-1" style={{ fontSize: 11 }}>Choose a date range above and click Go to load the Gantt chart</p>
          </div>
        </div>
        <GanttSettingsPanel
          open={settingsPanelOpen}
          onClose={() => setSettingsPanelOpen(false)}
          settings={ganttSettings}
          aircraftTypes={aircraftTypes}
          airports={airports}
          serviceTypes={serviceTypes}
          saveStatus={saveStatus}
          fleetPreview={fleetPreview}
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
          container={dialogContainer}
        />
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div
      ref={ganttContainerRef}
      className={`gantt-fullscreen-target h-full flex flex-col overflow-hidden relative bg-background ${isFullscreen && typeof document !== 'undefined' && !document.fullscreenElement ? 'fixed inset-0 z-[9999]' : ''}`}
      style={{ '--ctrl-scale': ctrlScale } as React.CSSProperties}
    >
      {/* ── HEADER BAR ─────────────────────────────────────────────── */}
      <div
        className="shrink-0 glass border-b z-20 space-y-2 transition-all duration-200 ease-out"
        style={{ padding: `${s(8)}px ${s(16)}px` }}
      >
        {/* Row 1: Period selector + Optimizer | Zoom pills (far right) */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {periodSelector}
            <button
              onClick={() => setOptimizerOpen(true)}
              className="transition-all duration-200 hover:bg-[rgba(153,27,27,0.06)]"
              style={{
                height: s(26), padding: `0 ${s(12)}px`, fontSize: s(10), fontWeight: 600, borderRadius: s(8),
                border: '1.5px solid #991B1B', background: 'transparent', color: '#991B1B',
              }}
            >
              ✈ Optimizer
            </button>
          </div>

          {/* Zoom pills + Row height zoom (far right) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-muted/50 rounded-lg transition-all duration-200" style={{ gap: s(2), padding: s(2) }}>
              {ZOOM_GROUP_DAYS.map((z) => {
                const disabled = isZoomDisabled(z)
                return (
                  <button
                    key={z}
                    onClick={() => !disabled && setZoomLevel(z)}
                    disabled={disabled}
                    className={`font-medium rounded-md transition-all duration-200 ${
                      disabled
                        ? 'text-muted-foreground/30 cursor-not-allowed'
                        : zoomLevel === z
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                    }`}
                    style={{ padding: `${s(2)}px ${s(6)}px`, fontSize: s(10), opacity: disabled ? 0.3 : 1 }}
                  >
                    {z}
                  </button>
                )
              })}
              <div className="bg-border/60 transition-all duration-200" style={{ width: 1, height: s(16), margin: `0 ${s(2)}px` }} />
              {ZOOM_GROUP_WIDE.map((z) => {
                const disabled = isZoomDisabled(z)
                return (
                  <button
                    key={z}
                    onClick={() => !disabled && setZoomLevel(z)}
                    disabled={disabled}
                    className={`font-medium rounded-md transition-all duration-200 ${
                      disabled
                        ? 'text-muted-foreground/30 cursor-not-allowed'
                        : zoomLevel === z
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                    }`}
                    style={{ padding: `${s(2)}px ${s(6)}px`, fontSize: s(10), opacity: disabled ? 0.3 : 1 }}
                  >
                    {z}
                  </button>
                )
              })}
              {/* Vertical divider + Row height zoom */}
              <div className="bg-border/60 transition-all duration-200" style={{ width: 1, height: s(16), margin: `0 ${s(2)}px` }} />
              <button
                onClick={zoomRowOut}
                disabled={rowHeightLevel === 0}
                className="flex items-center justify-center border border-border/60 text-muted-foreground hover:bg-muted transition-all duration-200 disabled:opacity-30 disabled:cursor-default"
                style={{ width: s(26), height: s(26), borderRadius: s(7) }}
                title="Decrease row height"
              >
                <span className="font-bold leading-none" style={{ fontSize: s(12) }}>−</span>
              </button>
              <button
                onClick={zoomRowIn}
                disabled={rowHeightLevel === ROW_HEIGHT_LEVELS.length - 1}
                className="flex items-center justify-center border border-border/60 text-muted-foreground hover:bg-muted transition-all duration-200 disabled:opacity-30 disabled:cursor-default"
                style={{ width: s(26), height: s(26), borderRadius: s(7) }}
                title="Increase row height"
              >
                <span className="font-bold leading-none" style={{ fontSize: s(12) }}>+</span>
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: AC type pills + toggles + stats */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center flex-wrap transition-all duration-200" style={{ gap: s(4) }}>
            <button
              onClick={() => setAcTypeFilter(null)}
              className={`font-medium rounded-md transition-all duration-200 ${
                acTypeFilter === null
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground'
              }`}
              style={{ padding: `${s(2)}px ${s(8)}px`, fontSize: s(10), height: s(24) }}
            >
              All
            </button>
            {uniqueTypes.map((t) => (
              <button
                key={t}
                onClick={() => setAcTypeFilter(acTypeFilter === t ? null : t)}
                className={`font-medium rounded-md transition-all duration-200 ${
                  acTypeFilter === t
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                }`}
                style={{ padding: `${s(2)}px ${s(8)}px`, fontSize: s(10), height: s(24) }}
              >
                {t}
              </button>
            ))}

            <div className="bg-border transition-all duration-200" style={{ width: 1, height: s(16), margin: `0 ${s(4)}px` }} />

            <ScheduleFilterDropdown filters={scheduleFilters} onChange={setScheduleFilters} scale={s} />
          </div>

          {/* Workspace indicator + Stats + Selection pill */}
          <div className="flex items-center gap-3">
            <GanttWorkspaceIndicator
              overrideCount={workspaceOverrides.size}
              onReset={resetWorkspace}
            />
            {selectedFlights.size > 0 && (
              <div
                className="flex items-center gap-1.5 rounded-full font-medium transition-all duration-200"
                style={{ background: 'rgba(59,130,246,0.1)', color: '#2563eb', padding: `${s(2)}px ${s(10)}px`, fontSize: s(11) }}
              >
                {selectedFlights.size} flight{selectedFlights.size > 1 ? 's' : ''} selected
                <button
                  onClick={() => setSelectedFlights(new Set())}
                  className="ml-0.5 p-0.5 rounded-full hover:bg-blue-500/15 transition-colors"
                >
                  <X style={{ width: s(12), height: s(12) }} />
                </button>
              </div>
            )}
            <div className="text-muted-foreground whitespace-nowrap transition-all duration-200" style={{ fontSize: s(10) }}>
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
      <div className="flex-1 flex min-h-0 relative">
        {/* ── LEFT PANEL (Aircraft Registry) ─────────────────────── */}
        <div className="w-[140px] shrink-0 glass border-r flex flex-col overflow-hidden">
          {/* Aligned with timeline header */}
          <div className="shrink-0 border-b" style={{ height: headerH }} />
          {/* Summary + Histogram labels */}
          {(ganttSettings.display?.histogram ?? true) ? (
            <>
              <div className="h-[40px] shrink-0 border-b flex items-center px-3">
                <span className="text-[11px] font-semibold text-muted-foreground/80 select-none">
                  {histogramMode === 'hourly' ? 'Daily' : 'Weekly'}
                </span>
              </div>
              <div className="h-[48px] shrink-0 border-b flex items-center px-3">
                <span className="text-[10px] font-medium text-muted-foreground/70 select-none">
                  {histogramLabel}
                </span>
              </div>
            </>
          ) : (
            <div className="h-[6px] shrink-0 border-b" />
          )}
          {/* Scrollable rows */}
          <div
            ref={leftPanelRef}
            className="flex-1 overflow-hidden select-none"
          >
            <div style={{ height: bodyHeight }}>
              {rows.map((row, rowIdx) => {
                const rl = rowLayout[rowIdx]
                const lpRowH = rl?.height ?? (row.type === 'group' ? GROUP_HEADER_HEIGHT : ROW_HEIGHT)
                const lpRowTop = rl?.yTop ?? 0

                // Vertical virtualization: placeholder for off-screen rows
                if (lpRowTop + lpRowH < visibleBounds.top || lpRowTop > visibleBounds.bottom) {
                  const key = row.type === 'group' ? `g-${row.icaoType}` : row.type === 'overflow' ? `overflow-lp-${row.icaoType}` : `a-${row.reg.id}`
                  return <div key={key} style={{ height: lpRowH }} />
                }

                if (row.type === 'group') {
                  const isCollapsed = collapsedTypes.has(row.icaoType)
                  const typeColor = acTypeColors[row.icaoType] || '#6B7280'
                  const headerBg = isDark ? darkModeVariant(typeColor) : typeColor
                  const headerText = getContrastTextColor(headerBg, isDark)
                  return (
                    <div
                      key={`g-${row.icaoType}`}
                      className="flex items-center gap-1 px-2 cursor-pointer transition-colors select-none"
                      style={{ height: GROUP_HEADER_HEIGHT, background: headerBg, color: headerText }}
                      onClick={() => toggleCollapse(row.icaoType)}
                    >
                      <ChevronDown
                        className={`shrink-0 transition-transform ${
                          isCollapsed ? '-rotate-90' : ''
                        }`}
                        style={{ color: headerText, width: GROUP_FONT, height: GROUP_FONT }}
                      />
                      <span className="font-bold truncate" style={{ fontSize: GROUP_FONT }}>
                        {row.icaoType}
                      </span>
                      <span style={{ fontSize: Math.max(GROUP_FONT - 2, 8), opacity: 0.8 }}>
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
                      <span className="font-medium text-amber-600 dark:text-amber-400 truncate leading-tight" style={{ fontSize: REG_FONT }}>
                        {row.icaoType} Unassigned
                      </span>
                      {REG_SUB_FONT > 7 && (
                        <span className="text-muted-foreground leading-tight" style={{ fontSize: REG_SUB_FONT }}>
                          ({row.overflowCount})
                        </span>
                      )}
                    </div>
                  )
                }

                const isPasteTarget = clipboard?.targetReg === row.reg.registration
                const isLpDragTarget = dragState && targetRow?.registration === row.reg.registration
                const lpDragValidity = isLpDragTarget ? targetRow!.validity : null
                const isLpSwapDrag = dragState?.dragMode === 'swap'
                const lpDragStyle: React.CSSProperties = isLpDragTarget ? {
                  borderLeft: isLpSwapDrag ? '3px solid #f59e0b'
                    : lpDragValidity === 'valid' ? '3px solid #3b82f6'
                    : lpDragValidity === 'same-family' ? '3px solid #f59e0b'
                    : lpDragValidity === 'invalid' ? '3px solid #ef4444'
                    : undefined,
                  background: isLpSwapDrag ? (isDark ? 'rgba(245, 158, 11, 0.06)' : 'rgba(245, 158, 11, 0.08)')
                    : lpDragValidity === 'valid' ? 'rgba(59, 130, 246, 0.03)'
                    : lpDragValidity === 'same-family' ? 'rgba(245, 158, 11, 0.03)'
                    : lpDragValidity === 'invalid' ? 'rgba(239, 68, 68, 0.03)'
                    : undefined,
                } : {}

                // AC type color for registration row
                const regIcao = regToIcao.get(row.reg.registration) || 'UNKN'
                const regTypeColor = acTypeColors[regIcao] || '#6B7280'
                const regDesat = desaturate(regTypeColor, 20)
                const regBg = isDark ? darkModeVariant(regDesat) : regDesat
                const regText = getContrastTextColor(regBg, isDark)
                // Drag/paste overrides the color background
                const hasOverride = isLpDragTarget || isPasteTarget
                const regStyle: React.CSSProperties = hasOverride
                  ? { height: ROW_HEIGHT, ...lpDragStyle }
                  : { height: ROW_HEIGHT, background: regBg, color: regText }

                const isAcHighlight = aircraftHighlightReg === row.reg.registration
                const acHighlightStyle: React.CSSProperties = isAcHighlight
                  ? {
                      background: isDark ? 'rgba(59, 130, 246, 0.18)' : 'rgba(59, 130, 246, 0.12)',
                      borderLeft: '2px solid #3b82f6',
                      transition: 'background 0.3s ease, border-left 0.3s ease',
                    }
                  : {}

                const isSelectedAcRow = selectedAircraftRow === row.reg.registration
                const isFlashRow = flashReg === row.reg.registration
                const isLightText = regText === '#E5E7EB' || regText === '#FFFFFF'
                const acRowSelectStyle: React.CSSProperties = isSelectedAcRow
                  ? { borderLeft: '3px solid #991B1B', background: isLightText ? '#2a1215' : '#fef2f2', color: isLightText ? '#fca5a5' : '#991B1B' }
                  : isFlashRow
                  ? { background: isDark ? 'rgba(153, 27, 27, 0.12)' : 'rgba(153, 27, 27, 0.10)', transition: 'background 0.1s ease' }
                  : {}

                return (
                  <div
                    key={`a-${row.reg.id}`}
                    data-reg={row.reg.registration}
                    className="flex flex-col justify-center px-3 border-b transition-colors cursor-pointer"
                    style={{ ...regStyle, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', ...acHighlightStyle, ...acRowSelectStyle }}
                    onClick={() => {
                      if (clipboard) { setClipboardTargetReg(row.reg.registration); return }
                      if (panelMode === 'aircraft' && panelAircraftReg === row.reg.registration) {
                        setPanelAircraftReg(null)
                        setPanelMode('flight')
                        setSelectedAircraftRow(null)
                      } else {
                        setPanelAircraftReg(row.reg.registration)
                        setPanelMode('aircraft')
                        setPanelVisible(true)
                        setSelectedAircraftRow(row.reg.registration)
                        setSelectedFlights(new Set())
                        setRotationTarget(null)
                        setSelectedDays(new Set())
                      }
                    }}
                  >
                    <span className="font-medium truncate leading-tight" style={{ fontSize: REG_FONT }}>
                      {row.reg.registration}
                    </span>
                    {row.cabin && REG_SUB_FONT > 7 && (
                      <span className="leading-tight truncate" style={{ fontSize: REG_SUB_FONT, opacity: 0.7 }}>
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
                  {Array.from({ length: totalDaysToRender }, (_, d) => {
                    const date = addDays(startDate, d)
                    const x = d * 24 * pixelsPerHour
                    const dayWidth = 24 * pixelsPerHour
                    const localDate = timeMode !== 'utc' ? getLocalDate(date, tzOffset) : date
                    const displayDate = timeMode === 'utc' ? date : localDate
                    const wkend = timeMode === 'utc' ? isWeekend(date) : isLocalWeekend(date, tzOffset)
                    const weekendHighlights = ganttSettings.display?.weekendHighlights ?? true
                    const isWkActive = wkend && weekendHighlights
                    const dayDateStr = formatISO(date)
                    const isDaySelected = selectedDays.has(dayDateStr)
                    const isDayPending = dayDragPending.has(dayDateStr) && !selectedDays.has(dayDateStr)

                    return (
                      <div key={d}>
                        {/* Weekend or selected column background (header only) */}
                        {(isWkActive || isDaySelected || isDayPending) && (
                          <div
                            className="absolute top-0"
                            style={{
                              left: x, width: dayWidth, height: headerH,
                              background: isDaySelected
                                ? (isDark ? '#1E3A5F' : '#1E40AF')
                                : isDayPending
                                  ? (isDark ? 'rgba(30, 64, 175, 0.4)' : 'rgba(30, 64, 175, 0.3)')
                                  : isWkActive
                                    ? (isDark ? '#7F1D1D' : '#991B1B')
                                    : undefined,
                            }}
                          />
                        )}
                        {/* Day label (centered in column — clickable) */}
                        <div
                          className="absolute top-0 text-[11px] font-semibold select-none text-center cursor-pointer"
                          style={{
                            left: x,
                            width: dayWidth,
                            height: headerH,
                            color: (isWkActive || isDaySelected || isDayPending) ? '#ffffff' : undefined,
                            fontWeight: (isWkActive || isDaySelected) ? 700 : 600,
                            padding: '2px 4px 1px 4px',
                            zIndex: 2,
                          }}
                          onMouseDown={(e) => handleDayMouseDown(dayDateStr, e)}
                          onMouseEnter={() => handleDayMouseEnter(dayDateStr)}
                        >
                          {formatDateShort(displayDate)}
                        </div>
                        {/* Day separator line — UTC midnight solid */}
                        <div
                          className="absolute top-0 bottom-0 bg-black/80 dark:bg-white/30"
                          style={{ left: x, width: 2 }}
                        />
                        {/* Local midnight — dotted */}
                        {tzOffset !== 0 && (() => {
                          const localMidnightUtcHour = ((24 - tzOffset) % 24 + 24) % 24
                          const localX = x + localMidnightUtcHour * pixelsPerHour
                          return (
                            <div
                              className="absolute top-0 bottom-0 pointer-events-none"
                              style={{
                                left: localX,
                                width: 0,
                                borderLeft: isDark ? '2px dotted rgba(255,255,255,0.25)' : '2px dotted rgba(0,0,0,0.6)',
                              }}
                            />
                          )
                        })()}
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
                                      left: hx, height: timeMode === 'dual' ? 16 : 10,
                                      borderLeft: (isWkActive || isDaySelected)
                                        ? '1px solid rgba(255,255,255,0.2)'
                                        : '1px solid var(--border-subtle, rgba(0,0,0,0.03))',
                                    }}
                                  />
                                  {pixelsPerHour >= 8 && (
                                    timeMode === 'dual' ? (
                                      <div className="absolute select-none" style={{ left: hx }}>
                                        {/* Local row (top — subdued) */}
                                        <div
                                          className="absolute pl-0.5"
                                          style={{
                                            top: 18,
                                            fontSize: '8px',
                                            color: (isWkActive || isDaySelected)
                                              ? 'rgba(255,255,255,0.6)'
                                              : isDark ? 'rgba(161,161,170,0.6)' : 'rgba(113,113,122,0.55)',
                                            fontWeight: (isWkActive || isDaySelected) ? 600 : 500,
                                          }}
                                        >
                                          {String(localHour).padStart(2, '0')}L
                                        </div>
                                        {/* UTC row (bottom — prominent) */}
                                        <div
                                          className="absolute pl-0.5"
                                          style={{
                                            top: 32,
                                            fontSize: '9px',
                                            fontWeight: (isWkActive || isDaySelected) ? 700 : 600,
                                            color: (isWkActive || isDaySelected)
                                              ? '#ffffff'
                                              : isDark ? '#e4e4e7' : '#18181b',
                                          }}
                                        >
                                          {String(hour).padStart(2, '0')}Z
                                        </div>
                                      </div>
                                    ) : (
                                      <div
                                        className="absolute bottom-1 text-[8px] pl-0.5 select-none"
                                        style={{
                                          left: hx,
                                          color: (isWkActive || isDaySelected) ? '#ffffff' : undefined,
                                          fontWeight: (isWkActive || isDaySelected) ? 700 : undefined,
                                          opacity: (isWkActive || isDaySelected) ? 0.9 : 0.5,
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
                  {/* Month labels overlay for 3M/6M */}
                  {totalDaysToRender > 31 && (() => {
                    const months: { label: string; xPx: number; widthPx: number }[] = []
                    let d = 0
                    while (d < totalDaysToRender) {
                      const date = addDays(startDate, d)
                      const displayDate = timeMode === 'utc' ? date : getLocalDate(date, tzOffset)
                      const monthStart = d
                      const currentMonth = displayDate.getMonth()
                      const currentYear = displayDate.getFullYear()
                      // Find end of this month
                      let end = d + 1
                      while (end < totalDaysToRender) {
                        const nd = addDays(startDate, end)
                        const ndDisplay = timeMode === 'utc' ? nd : getLocalDate(nd, tzOffset)
                        if (ndDisplay.getMonth() !== currentMonth || ndDisplay.getFullYear() !== currentYear) break
                        end++
                      }
                      const xPx = monthStart * 24 * pixelsPerHour
                      const widthPx = (end - monthStart) * 24 * pixelsPerHour
                      const monthName = displayDate.toLocaleDateString('en-US', { month: 'long' }).toUpperCase()
                      months.push({ label: monthName, xPx, widthPx })
                      d = end
                    }
                    return months.map((m, i) => (
                      <div
                        key={i}
                        className="absolute top-0 flex items-center justify-center select-none"
                        style={{
                          left: m.xPx,
                          width: m.widthPx,
                          height: headerH,
                          zIndex: 3,
                          borderRight: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                        }}
                      >
                        <span
                          className="text-[12px] font-bold tracking-wide"
                          style={{ color: isDark ? '#e4e4e7' : '#18181b' }}
                        >
                          {m.label}
                        </span>
                      </div>
                    ))
                  })()}
                </div>
          </div>

          {/* Summary row (28px) + Histogram (20px) or collapsed spacer */}
          {(ganttSettings.display?.histogram ?? true) ? (
            <>
              {/* Summary row */}
              <div className="h-[40px] shrink-0 border-b overflow-hidden">
                <div ref={summaryInnerRef} className="relative" style={{ width: totalWidth, height: 40 }}>
                  {summaryData.map((bucket, i) => {
                    const isSelected = selectedDays.has(bucket.dateStr)
                    const isPending = dayDragPending.has(bucket.dateStr) && !isSelected
                    return (
                      <div
                        key={i}
                        className="absolute top-0 flex items-center justify-center cursor-pointer select-none"
                        style={{
                          left: bucket.xPx,
                          width: bucket.widthPx,
                          height: 40,
                          borderRight: '1px solid var(--border-subtle, rgba(0,0,0,0.04))',
                          borderBottom: isSelected ? '2px solid #1E40AF' : undefined,
                          background: isSelected
                            ? (isDark ? 'rgba(30, 64, 175, 0.15)' : 'rgba(30, 64, 175, 0.1)')
                            : isPending
                              ? (isDark ? 'rgba(30, 64, 175, 0.08)' : 'rgba(30, 64, 175, 0.06)')
                              : bucket.isWeekend
                                ? 'rgba(127, 29, 29, 0.06)'
                                : undefined,
                        }}
                        onMouseDown={(e) => handleDayMouseDown(bucket.dateStr, e)}
                        onMouseEnter={() => handleDayMouseEnter(bucket.dateStr)}
                      >
                        <div className="text-center px-1 overflow-hidden">
                          {bucket.widthPx > 140 ? (
                            <span
                              className="text-[9px] font-medium whitespace-nowrap"
                              style={{
                                color: isSelected ? '#ffffff' : (bucket.isWeekend ? 'var(--gantt-histogram-label)' : undefined),
                                opacity: bucket.isWeekend && !isSelected ? 0.8 : 1,
                              }}
                            >
                              Flights: {bucket.flights}, BH: {bucket.blockHours}
                            </span>
                          ) : bucket.widthPx > 90 ? (
                            <span
                              className="text-[9px] font-medium whitespace-nowrap"
                              style={{
                                color: isSelected ? '#ffffff' : (bucket.isWeekend ? 'var(--gantt-histogram-label)' : undefined),
                                opacity: bucket.isWeekend && !isSelected ? 0.8 : 1,
                              }}
                            >
                              F: {bucket.flights}, BH: {bucket.blockHours}
                            </span>
                          ) : bucket.widthPx > 50 ? (
                            <span
                              className="text-[9px] whitespace-nowrap"
                              style={{
                                color: isSelected ? '#ffffff' : undefined,
                                opacity: bucket.isWeekend && !isSelected ? 0.8 : 0.7,
                              }}
                            >
                              {bucket.flights}F · {bucket.blockHours}h
                            </span>
                          ) : bucket.widthPx > 24 ? (
                            <span
                              className="text-[9px] font-semibold whitespace-nowrap"
                              style={{ color: isSelected ? '#ffffff' : 'var(--muted-foreground)', opacity: 0.7 }}
                            >
                              {bucket.flights}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Histogram (48px) */}
              <div
                ref={histogramRef}
                className="h-[48px] shrink-0 border-b overflow-hidden"
              >
                <div ref={histogramInnerRef} className="relative" style={{ width: totalWidth, height: 48 }}>
                  {histogram.buckets.map((bucket, i) => {
                    const isWeeklyMode = histogramMode === 'weekly'
                    // Weekly: skip zero-count entirely
                    if (bucket.count === 0 && isWeeklyMode) return null
                    const barHeight = bucket.count > 0 ? Math.max(2, Math.round((bucket.count / histogram.max) * 28)) : 0
                    const heatColor = getHistogramBarColor(bucket.count, histogram.max, isDark)
                    const heatLabelColor = getHistogramLabelColor(bucket.count, histogram.max, isDark)

                    // ≤7D hourly: ALWAYS show count label (including 0)
                    const showLabel = isWeeklyMode ? (bucket.count > 0 && bucket.widthPx > 20) : true
                    const labelFontSize = isWeeklyMode ? 10 : zoomDays >= 5 ? 7 : zoomDays >= 4 ? 8 : 9
                    const labelFontWeight = zoomDays >= 4 ? 600 : 700
                    const zeroColor = isDark ? 'rgba(156,163,175,0.25)' : 'rgba(107,114,128,0.3)'

                    return (
                      <div key={i}>
                        {/* Bar (heat-scaled) */}
                        {bucket.count > 0 && (
                          <div
                            className="absolute bottom-0"
                            style={{
                              left: bucket.xPx,
                              width: bucket.widthPx,
                              height: barHeight,
                              borderRadius: '2px 2px 0 0',
                              background: heatColor,
                            }}
                          />
                        )}
                        {/* Count label — always visible in hourly mode */}
                        {showLabel && (
                          <div
                            className="absolute pointer-events-none select-none"
                            style={{
                              left: bucket.xPx + bucket.widthPx / 2,
                              transform: 'translateX(-50%)',
                              bottom: bucket.count > 0 ? barHeight + 1 : 2,
                              fontSize: labelFontSize,
                              fontWeight: bucket.count > 0 ? labelFontWeight : 400,
                              color: bucket.count > 0 ? heatLabelColor : zeroColor,
                              whiteSpace: 'nowrap',
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
            </>
          ) : (
            <div className="h-[6px] shrink-0 border-b" />
          )}

          {/* Swap mode banners */}
          {dragState?.dragMode === 'swap' && (
            <div className="flex items-center gap-1.5 px-3 shrink-0 border-b border-amber-500/20" style={{ height: 24, background: 'rgba(245,158,11,0.08)', fontSize: 10 }}>
              <ArrowLeftRight className="h-3 w-3 text-amber-600" />
              <span className="text-amber-700 dark:text-amber-400 font-medium">Swap mode — drop on target row</span>
            </div>
          )}
          {swapMode && !dragState && (
            <div className="flex items-center gap-1.5 px-3 shrink-0 border-b border-amber-500/20" style={{ height: 24, background: 'rgba(245,158,11,0.08)', fontSize: 10 }}>
              <ArrowLeftRight className="h-3 w-3 text-amber-600" />
              <span className="text-amber-700 dark:text-amber-400 font-medium">
                Select flights to swap with &middot; {swapSource.length} flight{swapSource.length !== 1 ? 's' : ''} on {swapSource[0]?.aircraftReg || swapSource[0]?.assignedReg || '?'} &middot; Press Escape to cancel
              </span>
            </div>
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

              // Detect which row and date for potential rotation panel
              if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
                const clickedRow = rowLayout.find(rl => rl.type === 'aircraft' && rl.registration && y >= rl.yTop && y < rl.yTop + rl.height)
                if (clickedRow && clickedRow.registration) {
                  const hoursFromStart = x / pixelsPerHour
                  const daysFromStart = Math.floor(hoursFromStart / 24)
                  const clickedDate = formatISO(addDays(startDate, daysFromStart))
                  // Store for potential rotation open (confirmed in onMouseUp if no drag)
                  ;(bodyRef.current as any).__pendingRotation = { reg: clickedRow.registration, date: clickedDate }
                } else {
                  ;(bodyRef.current as any).__pendingRotation = null
                }
              }

              setRubberBand({ startX: x, startY: y, currentX: x, currentY: y })
              if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
                setSelectedFlights(new Set())
                if (selectedDays.size > 0) {
                  setSelectedDays(new Set())
                  setPanelMode('flight')
                }
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
              if (dragState) {
                // Swap mode: intercept before normal drop
                if (dragState.dragMode === 'swap' && targetRow?.registration && targetRow.registration !== dragState.sourceReg && targetRow.validity !== 'group') {
                  document.body.style.cursor = ''
                  const sourceReg = dragState.sourceReg
                  const tgtReg = targetRow.registration
                  const sourceFOs = assignedFlights.filter(f => dragState.draggedIds.has(f.id))
                  // Find overlapping flights on target row
                  const tgtRowFlights = wsFlightsByReg.get(tgtReg) || []
                  const overlaps = tgtRowFlights.filter(tf =>
                    sourceFOs.some(sf =>
                      sf.date.getTime() === tf.date.getTime() &&
                      sf.stdMinutes < tf.staMinutes &&
                      tf.stdMinutes < sf.staMinutes
                    )
                  )
                  if (overlaps.length > 0) {
                    setSwapSideA(sourceFOs)
                    setSwapSideB(overlaps)
                    setSwapRegA(sourceReg)
                    setSwapRegB(tgtReg)
                    setSwapDialogOpen(true)
                    cancelDrag()
                    return
                  } else {
                    toast.info('No overlapping flights on target row — use normal drag to move', { duration: 3000 })
                    cancelDrag()
                    return
                  }
                }
                onBodyMouseUp()
                return
              }
              if (!rubberBand) return
              // Check if the user actually dragged (not just a click)
              const dx = Math.abs(rubberBand.currentX - rubberBand.startX)
              const dy = Math.abs(rubberBand.currentY - rubberBand.startY)
              if (dx > 5 || dy > 5) {
                // Rubber band drag — select intersecting flights
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
                if (newSelection.size > 0) {
                  setPanelMode('flight')
                  setPanelAircraftReg(null)
                  setRotationTarget(null)
                }
                setSelectedFlights(newSelection)
                ;(bodyRef.current as any).__pendingRotation = null
              } else {
                // Single click on empty row area → rotation panel
                const pending = (bodyRef.current as any)?.__pendingRotation
                if (pending) {
                  setRotationTarget({ reg: pending.reg, date: pending.date })
                  setPanelMode('rotation')
                  setPanelVisible(true)
                  setSelectedFlights(new Set())
                  setPanelAircraftReg(null)
                  setSelectedAircraftRow(pending.reg)
                  setSelectedDays(new Set())
                }
                ;(bodyRef.current as any).__pendingRotation = null
              }
              setRubberBand(null)
            }}
          >
            <div className="relative" style={{ width: totalWidth, height: bodyHeight }}>
              {/* Background: midnight lines, hour grid, selected-day highlights */}
              {(() => {
                return Array.from({ length: totalDaysToRender }, (_, d) => {
                  const date = addDays(startDate, d)
                  const x = d * 24 * pixelsPerHour
                  const dateStr = formatISO(date)
                  const isDaySelected = selectedDays.has(dateStr)
                  const isDayPending = dayDragPending.has(dateStr) && !isDaySelected
                  return (
                    <div key={`bg-${d}`}>
                      {/* Selected / pending day column highlight */}
                      {(isDaySelected || isDayPending) && (
                        <div
                          className="absolute top-0 pointer-events-none"
                          style={{
                            left: x,
                            width: 24 * pixelsPerHour,
                            height: bodyHeight,
                            background: isDaySelected
                              ? (isDark ? 'rgba(30, 64, 175, 0.08)' : 'rgba(30, 64, 175, 0.05)')
                              : (isDark ? 'rgba(30, 64, 175, 0.04)' : 'rgba(30, 64, 175, 0.025)'),
                            zIndex: 0,
                          }}
                        />
                      )}
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

              {/* Day separator lines — solid for UTC midnight, dotted for local midnight */}
              {Array.from({ length: totalDaysToRender }, (_, d) => {
                const x = d * 24 * pixelsPerHour
                // Local midnight offset: local 00:00 = UTC (24 - tzOffset) % 24
                const localMidnightUtcHour = ((24 - tzOffset) % 24 + 24) % 24
                const localX = x + localMidnightUtcHour * pixelsPerHour
                return (
                  <Fragment key={`day-sep-${d}`}>
                    {/* UTC midnight — solid */}
                    <div
                      className="absolute top-0 pointer-events-none bg-black/80 dark:bg-white/30"
                      style={{ left: x, width: 2, height: bodyHeight, zIndex: 1 }}
                    />
                    {/* Local midnight — dotted (only if offset ≠ 0 so it doesn't overlap UTC line) */}
                    {tzOffset !== 0 && (
                      <div
                        className="absolute top-0 pointer-events-none"
                        style={{
                          left: localX,
                          width: 0,
                          height: bodyHeight,
                          zIndex: 1,
                          borderLeft: isDark ? '2px dotted rgba(255,255,255,0.25)' : '2px dotted rgba(0,0,0,0.6)',
                        }}
                      />
                    )}
                  </Fragment>
                )
              })}

              {/* Flight bars + TAT labels */}
              {(() => {
                let yOffset = 0

                // Helper: render flight bars for a list of flights
                const renderFlightBars = (rowFlights: ExpandedFlight[], isOverflow: boolean, regCode: string) => {
                  const showTatLabels = (ganttSettings.display?.tatLabels ?? true) && zoomDays <= 3
                  return rowFlights.map((ef, fi) => {
                    const x = getFlightX(ef)
                    const w = getFlightWidth(ef)

                    // Horizontal virtualization: skip bars outside visible range
                    if (x + w < visibleBounds.left || x > visibleBounds.right) return null

                    const isSelected = selectedFlights.has(ef.id)
                    const isHovered = hoveredFlightId === ef.id
                    const num = stripFlightPrefix(ef.flightNumber)
                    const isPublished = ef.status === 'published'
                    const isFin = !isPublished && ef.finalized
                    const isWip = !isPublished && !ef.finalized
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
                      const label = buildParts().join(' \u00B7 ')
                      content = <span style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>{label}</span>
                    } else if (w >= 50) {
                      const parts = buildParts()
                      const label = parts.length > 1 ? `${parts[0]} \u00B7 ${parts[1]}` : parts[0]
                      // Only show if it likely fits (rough: ~6px per char at bar font)
                      if (label.length * (BAR_FONT * 0.6) <= w - 8) {
                        content = <span style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>{label}</span>
                      } else {
                        content = <span style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>{num}</span>
                      }
                    } else if (w >= 22) {
                      if (num.length * (BAR_FONT * 0.6) <= w - 4) {
                        content = <span style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>{num}</span>
                      }
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
                                style={{ left: gapX, width: gapW, top: BAR_TOP, height: BAR_HEIGHT }}
                              >
                                <span className="font-semibold" style={{ fontSize: BAR_FONT * 0.8, color: showWarning ? '#ef4444' : undefined }}>
                                  <span className={showWarning ? '' : 'text-muted-foreground'}>{fmtTat(tat.gapMinutes)}</span>
                                </span>
                              </div>
                            )
                          }
                        }
                      }
                    }

                    // Flanking STD/STA text (≤3D zoom only)
                    let flankSTD: React.ReactNode = null
                    let flankSTA: React.ReactNode = null
                    if (zoomDays <= 3) {
                      const FLANK_TEXT_W = 28
                      const FLANK_GAP = 4
                      const MIN_SPACE = FLANK_TEXT_W + FLANK_GAP + 4
                      const flankStyle: React.CSSProperties = {
                        fontSize: BAR_FONT * 0.75,
                        fontWeight: 400,
                        color: isDark ? 'rgba(156,163,175,0.5)' : 'rgba(107,114,128,0.5)',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                        userSelect: 'none',
                        lineHeight: 1,
                      }
                      // Left: STD
                      const prevBar = fi > 0 ? rowFlights[fi - 1] : null
                      const prevRight = prevBar ? getFlightX(prevBar) + getFlightWidth(prevBar) : 0
                      if (x - prevRight >= MIN_SPACE) {
                        flankSTD = (
                          <div
                            key={`std-${ef.id}`}
                            className="absolute flex items-start justify-end"
                            style={{ right: totalWidth - x + FLANK_GAP, top: BAR_TOP, ...flankStyle }}
                          >
                            {ef.stdLocal}
                          </div>
                        )
                      }
                      // Right: STA
                      const nextBar = fi < rowFlights.length - 1 ? rowFlights[fi + 1] : null
                      const nextLeft = nextBar ? getFlightX(nextBar) : totalWidth
                      if (nextLeft - (x + w) >= MIN_SPACE) {
                        flankSTA = (
                          <div
                            key={`sta-${ef.id}`}
                            className="absolute flex items-end"
                            style={{ left: x + w + FLANK_GAP, top: BAR_TOP, height: BAR_HEIGHT, ...flankStyle }}
                          >
                            {ef.staLocal}
                          </div>
                        )
                      }
                    }

                    const isSearchHighlight = searchHighlightId === ef.id
                    const barIsDragged = isDragged(ef.id)
                    const barIsGhost = isGhostPlaceholder(ef.id)
                    const wsReg = getWorkspaceReg(ef.id)
                    const hasDbReg = !!ef.aircraftReg
                    const hasWsOverride = wsReg !== undefined

                    // Bar status icon (top-right corner)
                    let barStatusIcon: React.ReactNode = null
                    if (w >= 28) {
                      if (isFin) {
                        // Finalized: green checkmark badge top-right
                        barStatusIcon = (
                          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center"
                            style={{ width: 11, height: 11, borderRadius: 3, fontSize: 7, fontWeight: 700,
                              fontStyle: 'normal', lineHeight: 1,
                              background: '#10B981', color: '#fff' }}>✓</span>
                        )
                      } else if (isPublished && (ganttSettings.display?.workspaceIcons ?? true)) {
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
                    }

                    // Origin badge for WIP flights (bottom-left corner)
                    let originBadge: React.ReactNode = null
                    if (isWip && w >= 30) {
                      const src = ef.source
                      if (src === 'ssim') {
                        originBadge = (
                          <span className="absolute -bottom-0.5 -left-0.5 flex items-center justify-center"
                            style={{ width: 11, height: 11, borderRadius: 3, fontSize: 7, fontWeight: 700,
                              fontStyle: 'normal', lineHeight: 1,
                              background: '#f59e0b', color: '#fff' }}>S</span>
                        )
                      } else {
                        originBadge = (
                          <span className="absolute -bottom-0.5 -left-0.5 flex items-center justify-center"
                            style={{ width: 11, height: 11, borderRadius: 3, fontSize: 7, fontWeight: 700,
                              fontStyle: 'normal', lineHeight: 1,
                              background: '#8b5cf6', color: '#fff' }}>M</span>
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
                            zIndex: isSearchHighlight ? 50 : barIsDragged ? 100 : isSelected ? 10 : isHovered ? 5 : 2,
                            transform: barIsDragged
                              ? `translateY(${getDragDeltaY(0)}px) scale(1.03)`
                              : undefined,
                            opacity: barIsDragged ? 0.65 : 1,
                            pointerEvents: barIsDragged ? 'none' : undefined,
                            transition: barIsDragged ? undefined : 'transform 150ms ease-out',
                          }}
                          onClick={(e) => {
                            if (!dragState) {
                              if (isSearchHighlight) {
                                closeFlightSearch()
                                handleBarClick(ef.id, e)
                              } else {
                                handleBarClick(ef.id, e)
                              }
                            }
                          }}
                          onMouseDown={(e) => onBarMouseDown(ef.id, regCode, e)}
                          onContextMenu={(e) => handleBarContextMenu(e, ef.id, regCode)}
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
                            className={`w-full h-full flex items-center px-1 overflow-hidden relative${justPastedIds.has(ef.id) ? ' animate-pulse' : ''}`}
                            style={{
                              borderRadius: 5,
                              background: barBg,
                              border: isSearchHighlight
                                ? '2px solid #EF4444'
                                : isWip
                                  ? `${isDbAssigned ? '2px' : '1.5px'} dashed #F59E0B`
                                  : isFin
                                    ? `${isDbAssigned ? '2px' : '1.5px'} dashed #10B981`
                                    : isDbAssigned
                                      ? '2px solid var(--gantt-bar-border-pub-assigned)'
                                      : '1.5px solid var(--gantt-bar-border-pub)',
                              fontStyle: isWip ? 'italic' : 'normal',
                              color: barText,
                              fontSize: BAR_FONT + 'px',
                              boxShadow: isSearchHighlight
                                ? '0 0 0 3px rgba(239, 68, 68, 0.3)'
                                : barIsDragged
                                  ? '0 8px 24px rgba(0,0,0,0.15)'
                                  : isSelected
                                    ? '0 0 0 3px rgba(59, 130, 246, 0.35), 0 0 14px rgba(59, 130, 246, 0.15)'
                                    : justPastedIds.has(ef.id)
                                      ? '0 0 0 2px rgba(34, 197, 94, 0.4), 0 0 12px rgba(34, 197, 94, 0.15)'
                                      : 'none',
                              opacity: isFlightGhosted(ef.id) ? 0.25 : 1,
                              backgroundImage: isFlightGhosted(ef.id)
                                ? 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.03) 3px, rgba(0,0,0,0.03) 6px)'
                                : undefined,
                            }}
                          >
                            {content}
                            {barStatusIcon}
                            {originBadge}
                          </div>

                        </div>
                        {tatLabel}
                        {flankSTD}
                        {flankSTA}
                      </div>
                    )
                  })
                }

                return rows.map((row) => {
                  const currentY = yOffset
                  const rowH = row.type === 'group' ? GROUP_HEADER_HEIGHT : ROW_HEIGHT
                  yOffset += rowH

                  // Vertical virtualization: render lightweight placeholder for off-screen rows
                  if (currentY + rowH < visibleBounds.top || currentY > visibleBounds.bottom) {
                    const key = row.type === 'group' ? `gr-${row.icaoType}` : row.type === 'overflow' ? `overflow-${row.icaoType}` : `row-${row.reg.id}`
                    return <div key={key} className="absolute left-0" style={{ top: currentY, height: rowH }} />
                  }

                  if (row.type === 'group') {
                    return (
                      <div
                        key={`gr-${row.icaoType}`}
                        className="absolute left-0 right-0 border-b border-border/10"
                        style={{ top: currentY, height: GROUP_HEADER_HEIGHT }}
                      />
                    )
                  }

                  if (row.type === 'overflow') {
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
                  const reg = row.reg
                  const rowFlights = getRegFlightsSorted(reg.registration)
                  const isRowPasteTarget = clipboard?.targetReg === reg.registration

                  // Drag target highlight
                  const isRowDragTarget = dragState && targetRow?.registration === reg.registration
                  const dragValidity = isRowDragTarget ? targetRow!.validity : null
                  const isSwapDrag = dragState?.dragMode === 'swap'
                  const dragRowStyle: React.CSSProperties = isRowDragTarget ? {
                    borderLeft: isSwapDrag ? '3px solid #f59e0b'
                      : dragValidity === 'valid' ? '3px solid #3b82f6'
                      : dragValidity === 'same-family' ? '3px solid #f59e0b'
                      : dragValidity === 'invalid' ? '3px solid #ef4444'
                      : undefined,
                    background: isSwapDrag ? (isDark ? 'rgba(245, 158, 11, 0.06)' : 'rgba(245, 158, 11, 0.08)')
                      : dragValidity === 'valid' ? 'rgba(59, 130, 246, 0.03)'
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
                          return Array.from({ length: totalDaysToRender }, (_, d) => {
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
                          for (let d = totalDaysToRender - 1; d >= 0; d--) {
                            const dateKey = formatISO(addDays(startDate, d))
                            const eod = eodLocations.get(`${regKey}|${dateKey}`)
                            if (eod) { lastStation = eod.station; break }
                          }
                          const station = lastStation ?? base
                          if (!station) return null
                          const rightEdgeX = totalDaysToRender * 24 * pixelsPerHour
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

        {/* ── RIGHT PANEL (Rotation Panel — overlay, collapsible) ── */}
        <div
          className="absolute top-0 right-0 bottom-0 bg-background border-l shadow-lg flex flex-col overflow-hidden z-30"
          style={{
            width: 280,
            transform: panelVisible ? 'translateX(0)' : 'translateX(100%)',
            opacity: panelVisible ? 1 : 0,
            transition: 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease',
            willChange: 'transform, opacity',
            pointerEvents: panelVisible ? 'auto' as const : 'none' as const,
          }}
        >
          {panelMounted && (<>
          {/* Flight Search Overlay */}
          {flightSearchOpen && (
            <div className="absolute inset-0 z-10 flex flex-col" style={{ background: 'hsl(var(--background))' }}>
              {/* Search Header */}
              <div className="shrink-0 px-4 pt-4 pb-3 border-b flex items-center justify-between gap-2">
                <div className="text-[13px] font-semibold tracking-tight">Flight Search</div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => setPanelPinned(p => !p)}
                    className="p-1 rounded-md hover:bg-muted transition-colors"
                    title={panelPinned ? 'Unpin panel' : 'Pin panel'}
                  >
                    <Pin className={`h-3.5 w-3.5 transition-all duration-150 ${panelPinned ? 'text-primary fill-primary -rotate-45' : 'text-muted-foreground'}`} />
                  </button>
                  <button
                    onClick={closeFlightSearch}
                    className="p-1 rounded-md hover:bg-muted transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Search Inputs */}
              <div className="px-4 pt-3 pb-2 space-y-2.5">
                <div>
                  <div className="text-[11px] font-medium text-muted-foreground mb-1">Flight Number</div>
                  <div className="relative">
                    <input
                      ref={flightSearchInputRef}
                      type="text"
                      value={flightSearchQuery}
                      onChange={(e) => { setFlightSearchQuery(e.target.value); setFlightSearchIndex(-1); setSearchHighlightId(null) }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (flightSearchResults.length === 0) return
                          const nextIdx = e.shiftKey
                            ? (flightSearchIndex - 1 + flightSearchResults.length) % flightSearchResults.length
                            : flightSearchIndex < 0 ? 0 : (flightSearchIndex + 1) % flightSearchResults.length
                          setFlightSearchIndex(nextIdx)
                          const ef = flightSearchResults[nextIdx]
                          setSearchHighlightId(ef.id)
                          scrollToFlight(ef)
                          // Scroll results list to keep current visible
                          const listEl = searchResultsRef.current
                          if (listEl) {
                            const rowEl = listEl.children[nextIdx] as HTMLElement
                            if (rowEl) rowEl.scrollIntoView({ block: 'nearest' })
                          }
                        }
                        if (e.key === 'Escape') { closeFlightSearch() }
                      }}
                      placeholder="e.g. 862 or VJ862"
                      className="w-full pl-3 pr-8 py-1.5 rounded-lg text-[13px] font-medium glass outline-none focus:ring-2 focus:ring-primary/30 border border-border placeholder:text-muted-foreground/50"
                    />
                    <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-muted-foreground mb-1">Date (optional)</div>
                  <input
                    type="text"
                    value={flightSearchDate}
                    onChange={(e) => { setFlightSearchDate(e.target.value); setFlightSearchIndex(-1); setSearchHighlightId(null) }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        flightSearchInputRef.current?.focus()
                        if (flightSearchResults.length === 0) return
                        setFlightSearchIndex(0)
                        const ef = flightSearchResults[0]
                        setSearchHighlightId(ef.id)
                        scrollToFlight(ef)
                      }
                      if (e.key === 'Escape') { closeFlightSearch() }
                    }}
                    placeholder="DD/MM"
                    className="w-full px-3 py-1.5 rounded-lg text-[12px] glass outline-none focus:ring-2 focus:ring-primary/30 border border-border placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>

              <div className="mx-4 border-t" />

              {/* Results */}
              <div className="flex-1 min-h-0 flex flex-col px-4 pt-2 pb-3">
                {flightSearchQuery.trim() === '' ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-6">
                    <Search className="h-8 w-8 text-muted-foreground/30" />
                    <div className="text-[11px] text-muted-foreground">Type a flight number to search</div>
                  </div>
                ) : flightSearchResults.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-6">
                    <Plane className="h-8 w-8 text-muted-foreground/30" />
                    <div className="text-[12px] font-medium">No flights found</div>
                    <div className="text-[10px] text-muted-foreground leading-relaxed">
                      No matches for &ldquo;{flightSearchQuery}&rdquo; in the<br />
                      current view ({startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}–{addDays(startDate, totalDaysToRender - 1).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">Try a different flight number<br />or adjust the date range</div>
                  </div>
                ) : (
                  <>
                    <div className="mb-1.5">
                      <div className="text-[11px] font-semibold">Found {flightSearchResults.length} result{flightSearchResults.length !== 1 ? 's' : ''}</div>
                      {flightSearchIndex >= 0 && (
                        <div className="text-[10px] text-muted-foreground">Showing {flightSearchIndex + 1} of {flightSearchResults.length}</div>
                      )}
                    </div>
                    <div className="text-[9px] text-muted-foreground mb-2">
                      Press Enter to cycle through results<br />Press Escape to close search
                    </div>
                    <div ref={searchResultsRef} className="flex-1 min-h-0 overflow-y-auto space-y-0.5" style={{ maxHeight: 8 * 32 }}>
                      {flightSearchResults.map((ef, i) => {
                        const isCurrent = i === flightSearchIndex
                        return (
                          <button
                            key={ef.id}
                            onClick={() => {
                              setFlightSearchIndex(i)
                              setSearchHighlightId(ef.id)
                              scrollToFlight(ef)
                            }}
                            className="w-full flex items-center gap-1.5 text-left rounded-md transition-colors hover:bg-muted/40"
                            style={{
                              padding: '6px 8px',
                              borderRadius: 6,
                              background: isCurrent ? 'rgba(153, 27, 27, 0.08)' : undefined,
                              borderLeft: isCurrent ? '2px solid #991B1B' : '2px solid transparent',
                            }}
                          >
                            <span className="text-[10px] w-3 shrink-0" style={{ color: isCurrent ? '#991B1B' : 'transparent' }}>▸</span>
                            <span className="text-[11px] font-semibold">{ef.flightNumber}</span>
                            <span className="text-[10px] text-muted-foreground">{ef.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                            <span className="text-[10px] text-muted-foreground ml-auto">{ef.depStation}→{ef.arrStation}</span>
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Aircraft Search Overlay */}
          {aircraftSearchOpen && (
            <div className="absolute inset-0 z-10 flex flex-col" style={{ background: 'hsl(var(--background))' }}>
              {/* Search Header */}
              <div className="shrink-0 px-4 pt-4 pb-3 border-b flex items-center justify-between gap-2">
                <div className="text-[13px] font-semibold tracking-tight">Aircraft Search</div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => setPanelPinned(p => !p)}
                    className="p-1 rounded-md hover:bg-muted transition-colors"
                    title={panelPinned ? 'Unpin panel' : 'Pin panel'}
                  >
                    <Pin className={`h-3.5 w-3.5 transition-all duration-150 ${panelPinned ? 'text-primary fill-primary -rotate-45' : 'text-muted-foreground'}`} />
                  </button>
                  <button
                    onClick={closeAircraftSearch}
                    className="p-1 rounded-md hover:bg-muted transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Search Input */}
              <div className="px-4 pt-3 pb-2">
                <div className="text-[11px] font-medium text-muted-foreground mb-1">Registration</div>
                <div className="relative">
                  <input
                    ref={aircraftSearchInputRef}
                    type="text"
                    value={aircraftSearchQuery}
                    onChange={(e) => { setAircraftSearchQuery(e.target.value); setAircraftSearchIndex(-1); setAircraftHighlightReg(null) }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (aircraftSearchResults.length === 0) return
                        const nextIdx = e.shiftKey
                          ? (aircraftSearchIndex - 1 + aircraftSearchResults.length) % aircraftSearchResults.length
                          : aircraftSearchIndex < 0 ? 0 : (aircraftSearchIndex + 1) % aircraftSearchResults.length
                        setAircraftSearchIndex(nextIdx)
                        const result = aircraftSearchResults[nextIdx]
                        scrollToAircraft(result)
                        // Scroll results list to keep current visible
                        const listEl = aircraftResultsRef.current
                        if (listEl) {
                          const rowEl = listEl.children[nextIdx] as HTMLElement
                          if (rowEl) rowEl.scrollIntoView({ block: 'nearest' })
                        }
                      }
                      if (e.key === 'Escape') { closeAircraftSearch() }
                    }}
                    placeholder="e.g. A-615 or VN-A615"
                    className="w-full pl-3 pr-8 py-1.5 rounded-lg text-[13px] font-medium glass outline-none focus:ring-2 focus:ring-primary/30 border border-border placeholder:text-muted-foreground/50"
                  />
                  <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                </div>
              </div>

              <div className="mx-4 border-t" />

              {/* Results */}
              <div className="flex-1 min-h-0 flex flex-col px-4 pt-2 pb-3">
                {aircraftSearchQuery.trim() === '' ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-6">
                    <Search className="h-8 w-8 text-muted-foreground/30" />
                    <div className="text-[11px] text-muted-foreground">Type a registration to search</div>
                  </div>
                ) : aircraftSearchResults.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-6">
                    <Plane className="h-8 w-8 text-muted-foreground/30" />
                    <div className="text-[12px] font-medium">No aircraft found</div>
                    <div className="text-[10px] text-muted-foreground leading-relaxed">
                      No matches for &ldquo;{aircraftSearchQuery}&rdquo;
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-1.5">
                      <div className="text-[11px] font-semibold">Found {aircraftSearchResults.length} result{aircraftSearchResults.length !== 1 ? 's' : ''}</div>
                      {aircraftSearchIndex >= 0 && (
                        <div className="text-[10px] text-muted-foreground">Showing {aircraftSearchIndex + 1} of {aircraftSearchResults.length}</div>
                      )}
                    </div>
                    <div className="text-[9px] text-muted-foreground mb-2">
                      Press Enter to cycle through results<br />Press Escape to close search
                    </div>
                    <div ref={aircraftResultsRef} className="flex-1 min-h-0 overflow-y-auto space-y-0.5" style={{ maxHeight: 8 * 32 }}>
                      {aircraftSearchResults.map((result, i) => {
                        const isCurrent = i === aircraftSearchIndex
                        return (
                          <button
                            key={result.registration}
                            onClick={() => {
                              setAircraftSearchIndex(i)
                              scrollToAircraft(result)
                            }}
                            className="w-full flex items-center gap-1.5 text-left rounded-md transition-colors hover:bg-muted/40"
                            style={{
                              padding: '6px 8px',
                              borderRadius: 6,
                              background: isCurrent ? 'rgba(59, 130, 246, 0.08)' : undefined,
                              borderLeft: isCurrent ? '2px solid #3b82f6' : '2px solid transparent',
                            }}
                          >
                            <span className="text-[10px] w-3 shrink-0" style={{ color: isCurrent ? '#3b82f6' : 'transparent' }}>▸</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-semibold">{result.registration}</span>
                                <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-medium">{result.icaoType}</span>
                              </div>
                              {result.cabin && (
                                <div className="text-[10px] text-muted-foreground">{result.cabin}</div>
                              )}
                            </div>
                            {result.filteredOut && (
                              <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium shrink-0">filtered</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {panelMode === 'day-stats' && dayPanelData ? (
            <>
              {/* ── Schedule Statistics Header ── */}
              <div className="shrink-0 px-4 pt-4 pb-3 border-b border-[#F3F4F6] dark:border-[#1F2937] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[15px] font-bold truncate">Schedule Statistics</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{dayPanelData.label}</div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => setPanelPinned(p => !p)}
                    className="p-1 rounded-md hover:bg-muted transition-colors"
                    title={panelPinned ? 'Unpin panel' : 'Pin panel'}
                  >
                    <Pin className={`h-3.5 w-3.5 transition-all duration-150 ${panelPinned ? 'text-primary fill-primary -rotate-45' : 'text-muted-foreground'}`} />
                  </button>
                  <button
                    onClick={() => { setSelectedDays(new Set()); setPanelMode('flight') }}
                    className="p-1 rounded-md hover:bg-muted transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* ── Schedule Statistics Body ── */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">

                {/* ── Section 1: Summary ── */}
                <div className="px-4 pt-3.5 pb-2.5">
                  <div className="text-[12px] font-bold mb-2">Summary</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <div className="text-[22px] font-medium text-primary leading-tight">{dayPanelData.totalFlights}</div>
                      <div className="text-[9px] font-medium uppercase tracking-[0.5px] text-[#9CA3AF] mt-0.5">Flights</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[22px] font-medium text-primary leading-tight">{dayPanelData.totalBlockHours}</div>
                      <div className="text-[9px] font-medium uppercase tracking-[0.5px] text-[#9CA3AF] mt-0.5">Block hrs</div>
                    </div>
                    <div className="text-center">
                      <div className="leading-tight">
                        <span className="text-[22px] font-medium text-primary">{dayPanelData.aircraftInService}</span>
                        <span className="text-[13px] font-medium text-muted-foreground">/{dayPanelData.totalAcInFleet}</span>
                      </div>
                      <div className="text-[9px] font-medium uppercase tracking-[0.5px] text-[#9CA3AF] mt-0.5">AC used</div>
                    </div>
                  </div>
                  {dayPanelData.avgDailyFlights !== null && (
                    <div className="mt-2.5 pt-2 border-t border-[#F3F4F6] dark:border-[#1F2937] text-center text-[10px] text-muted-foreground">
                      Avg/day: {dayPanelData.avgDailyFlights} flights · {dayPanelData.avgDailyBlockHours} block hours
                    </div>
                  )}
                </div>

                {/* ── Section 2: Activity by Type ── */}
                {dayPanelData.byType.length > 0 && (
                  <div className="px-4 pt-3.5 pb-2.5 border-t border-[#F3F4F6] dark:border-[#1F2937]">
                    <div className="text-[12px] font-bold mb-2">Activity by Type</div>
                    <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-x-2 px-0.5 pb-1 text-[10px] font-semibold text-muted-foreground">
                      <span>Type</span>
                      <span className="text-right">Flt</span>
                      <span className="text-right">Block</span>
                      <span className="text-right">AC</span>
                    </div>
                    {dayPanelData.byType.map(row => {
                      const typeColor = acTypeColors[row.icao] || '#6B7280'
                      return (
                        <div key={row.icao} className="grid grid-cols-[auto_1fr_1fr_1fr] gap-x-2 px-0.5 py-1 text-[10px]">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: typeColor }} />
                            <span className="font-semibold">{row.icao}</span>
                          </span>
                          <span className="text-right font-semibold">{row.flights}</span>
                          <span className="text-right font-medium">{row.blockHours}h</span>
                          <span className="text-right">
                            <span className="font-semibold">{row.activeRegs}</span>
                            <span className="text-muted-foreground">/{row.totalRegs}</span>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* ── Section 3: Utilization ── */}
                {dayPanelData.utilData.length > 0 && (
                  <div className="px-4 pt-3.5 pb-2.5 border-t border-[#F3F4F6] dark:border-[#1F2937]">
                    <div className="text-[12px] font-bold mb-0.5">Utilization</div>
                    <div className="text-[9px] text-muted-foreground mb-2.5">Average block hours per aircraft per day</div>
                    {dayPanelData.utilData.map(row => {
                      const typeColor = acTypeColors[row.icao] || '#6B7280'
                      const maxBar = row.target * 1.2
                      const fillPct = Math.min(row.avgActive / maxBar * 100, 100)
                      const targetPct = Math.min(row.target / maxBar * 100, 100)
                      return (
                        <div key={row.icao} className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="flex items-center gap-1.5 text-[10px] font-semibold">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: typeColor }} />
                              {row.icao}
                            </span>
                            <div className="flex items-center gap-3 text-[10px]">
                              <span>
                                <span className="font-bold text-primary">{row.avgActive}h</span>
                                <span className="text-[8px] text-muted-foreground ml-0.5">active</span>
                              </span>
                              <span>
                                <span className="font-medium text-muted-foreground">{row.avgFleet}h</span>
                                <span className="text-[8px] text-muted-foreground/60 ml-0.5">fleet</span>
                              </span>
                            </div>
                          </div>
                          <div className="relative h-1 rounded-full bg-[#F3F4F6] dark:bg-[#1F2937]">
                            <div
                              className="absolute top-0 left-0 h-full rounded-full"
                              style={{ width: `${fillPct}%`, background: typeColor }}
                            />
                            <div
                              className="absolute"
                              style={{ left: `${targetPct}%`, top: -2, width: 1.5, height: 8, background: '#374151', borderRadius: 1 }}
                            />
                          </div>
                          <div className="relative mt-0.5" style={{ height: 10 }}>
                            <span
                              className="absolute text-[7px] text-muted-foreground"
                              style={{ left: `${targetPct}%`, transform: 'translateX(-50%)' }}
                            >
                              {row.target}h target
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* ── Section 4: Overnight Stations ── */}
                {dayPanelData.overnightStations.length > 0 && (() => {
                  const DONUT_COLORS = ['#991B1B', '#DC2626', '#F87171', '#FCA5A5', '#FECACA']
                  const sorted = dayPanelData.overnightStations
                  const showTop = sorted.length > 5 ? 4 : sorted.length
                  const topStations = sorted.slice(0, showTop)
                  const othersCount = sorted.slice(showTop).reduce((s, st) => s + st.count, 0)
                  const othersPct = dayPanelData.overnightTotal > 0 ? Math.round(othersCount / dayPanelData.overnightTotal * 100) : 0
                  const displayStations = othersCount > 0
                    ? [...topStations, { station: 'Others', count: othersCount, pct: othersPct }]
                    : topStations

                  // SVG donut
                  const size = 110
                  const cx = size / 2, cy = size / 2
                  const outerR = 53, innerR = 33
                  const total = dayPanelData.overnightTotal
                  const gap = 0.01 // radians gap between segments

                  const donutPaths: { d: string; fill: string }[] = []
                  let angle = -Math.PI / 2
                  displayStations.forEach((st, i) => {
                    const frac = st.count / total
                    const sweep = frac * Math.PI * 2 - (displayStations.length > 1 ? gap : 0)
                    if (sweep <= 0) return
                    const a1 = angle
                    const a2 = angle + sweep
                    const largeArc = sweep > Math.PI ? 1 : 0
                    const ox1 = cx + outerR * Math.cos(a1), oy1 = cy + outerR * Math.sin(a1)
                    const ox2 = cx + outerR * Math.cos(a2), oy2 = cy + outerR * Math.sin(a2)
                    const ix2 = cx + innerR * Math.cos(a2), iy2 = cy + innerR * Math.sin(a2)
                    const ix1 = cx + innerR * Math.cos(a1), iy1 = cy + innerR * Math.sin(a1)
                    donutPaths.push({
                      d: `M ${ox1} ${oy1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${ox2} ${oy2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1} Z`,
                      fill: DONUT_COLORS[i % DONUT_COLORS.length],
                    })
                    angle = a2 + gap
                  })

                  // Total unique aircraft for donut center
                  const donutCenter = dayPanelData.aircraftInService

                  return (
                    <div className="px-4 pt-3.5 pb-4 border-t border-[#F3F4F6] dark:border-[#1F2937]">
                      <div className="text-[12px] font-bold mb-2.5">Overnight Stations</div>
                      <div className="flex items-center gap-4">
                        {/* Donut chart */}
                        <div className="shrink-0">
                          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                            {donutPaths.map((p, i) => (
                              <path key={i} d={p.d} fill={p.fill} stroke={isDark ? 'var(--background)' : '#fff'} strokeWidth={1.5} />
                            ))}
                            <text x={cx} y={cy - 4} textAnchor="middle" className="fill-foreground" style={{ fontSize: 18, fontWeight: 800 }}>{donutCenter}</text>
                            <text x={cx} y={cy + 10} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 9, fontWeight: 500 }}>aircraft</text>
                          </svg>
                        </div>
                        {/* Station list */}
                        <div className="flex-1 min-w-0">
                          {displayStations.map((st, i) => (
                            <div
                              key={st.station}
                              className="flex items-center justify-between px-1.5 py-1 rounded-md hover:bg-[rgba(153,27,27,0.04)] dark:hover:bg-[rgba(153,27,27,0.08)] transition-colors"
                            >
                              <span className="flex items-center gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-sm shrink-0"
                                  style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                                />
                                <span className="text-[11px] font-semibold">{st.station}</span>
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="text-[12px] font-bold">{st.count}</span>
                                <span className="text-[9px] text-muted-foreground">({st.pct}%)</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </>
          ) : panelMode === 'flight' && flightLinksPanelData ? (
            <>
              {/* ── FLIGHT LINKS PANEL (multi-select same row) ──────── */}
              <div className="shrink-0 px-3 py-2.5 border-b flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold truncate">Flight Links</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {flightLinksPanelData.legs} flights · {flightLinksPanelData.reg || flightLinksPanelData.icao} · {
                      flightLinksPanelData.singleDate
                        ? new Date(flightLinksPanelData.firstDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                        : `${new Date(flightLinksPanelData.firstDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(flightLinksPanelData.lastDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                    }
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => setPanelPinned(p => !p)}
                    className="p-1 rounded-md hover:bg-muted transition-colors"
                    title={panelPinned ? 'Unpin panel' : 'Pin panel'}
                  >
                    <Pin className={`h-3.5 w-3.5 transition-all duration-150 ${panelPinned ? 'text-primary fill-primary -rotate-45' : 'text-muted-foreground'}`} />
                  </button>
                  <button
                    onClick={() => { setSelectedFlights(new Set()); setPanelPinned(false) }}
                    className="p-1 rounded-md hover:bg-muted transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-3 space-y-4">

                  {/* ── LINKS section ── */}
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }} className="text-muted-foreground mb-2">
                      Links
                    </div>

                    {flightLinksPanelData.flights.map((f, i) => {
                      const isPrimary = f.id === selectedFlightId
                      return (
                        <Fragment key={f.id}>
                          {/* Date divider for multi-date */}
                          {!flightLinksPanelData.singleDate && (i === 0 || formatISO(f.date) !== formatISO(flightLinksPanelData.flights[i - 1].date)) && (
                            <div className="flex items-center gap-2 my-2">
                              <div className="h-px flex-1 bg-border" />
                              <span style={{ fontSize: 9, fontWeight: 700 }} className="text-muted-foreground uppercase">
                                {f.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                              </span>
                              <div className="h-px flex-1 bg-border" />
                            </div>
                          )}

                          {/* Flight card */}
                          <div
                            className="rounded-lg border p-2 cursor-pointer hover:bg-muted/30 transition-colors"
                            style={{
                              borderLeftWidth: isPrimary ? 2 : 1,
                              borderLeftColor: isPrimary ? '#991B1B' : undefined,
                            }}
                            onClick={() => setSelectedFlights(new Set([f.id]))}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span style={{ fontSize: 11, fontWeight: 700 }}>{stripFlightPrefix(f.flightNumber)}</span>
                                <span style={{ fontSize: 11 }} className="text-foreground">{f.depStation} → {f.arrStation}</span>
                              </div>
                              <span style={{ fontSize: 10 }} className="text-muted-foreground shrink-0">{f.stdLocal} – {f.staLocal}</span>
                            </div>
                            <div className="text-right" style={{ fontSize: 10 }}>
                              <span className="text-muted-foreground">{formatBlockTime(f.blockMinutes)}</span>
                            </div>
                          </div>

                          {/* TAT connector */}
                          {i < flightLinksPanelData.links.length && (() => {
                            const link = flightLinksPanelData.links[i]
                            const statusColor =
                              link.status === 'ok' ? '#22C55E' :
                              link.status === 'tight' ? '#F59E0B' :
                              '#EF4444'
                            const statusIcon =
                              link.status === 'ok' ? '✓' :
                              link.status === 'tight' ? '⚠' : '✗'

                            return (
                              <div className="flex items-center gap-2 py-1" style={{ paddingLeft: 14 }}>
                                <div style={{
                                  width: 0,
                                  height: 16,
                                  borderLeft: `1px dashed ${link.stationMismatch ? '#EF4444' : 'hsl(var(--border))'}`,
                                }} />
                                <span style={{ fontSize: 10, color: statusColor }}>
                                  {link.stationMismatch
                                    ? `⚠ ${link.from.arrStation} ≠ ${link.to.depStation}  Station mismatch`
                                    : `${fmtTat(link.gapMinutes)} ground · min ${fmtTat(link.minTat)}  ${statusIcon}`
                                  }
                                </span>
                              </div>
                            )
                          })()}
                        </Fragment>
                      )
                    })}
                  </div>

                  {/* ── STATION SEQUENCE section ── */}
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }} className="text-muted-foreground mb-2">
                      Station Sequence
                    </div>
                    <div className="flex items-center flex-wrap gap-1" style={{ fontSize: 11 }}>
                      {flightLinksPanelData.stations.map((station, i) => {
                        const isBreakBefore = i > 0 && flightLinksPanelData.stationBreaks.has(i - 1)
                        return (
                          <Fragment key={i}>
                            {i > 0 && (
                              <span style={{ fontSize: 10, color: isBreakBefore ? '#EF4444' : undefined }} className={isBreakBefore ? '' : 'text-muted-foreground'}>
                                {isBreakBefore ? '✗' : '→'}
                              </span>
                            )}
                            <span style={{ fontWeight: 700, color: isBreakBefore ? '#EF4444' : undefined }}>
                              {station}
                            </span>
                          </Fragment>
                        )
                      })}
                      {flightLinksPanelData.isCircular && (
                        <span style={{ fontSize: 10, color: '#22C55E', marginLeft: 2 }}>↻</span>
                      )}
                    </div>
                  </div>

                  {/* ── SUMMARY section ── */}
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }} className="text-muted-foreground mb-2">
                      Summary
                    </div>
                    <div className="rounded-lg border border-border/50 p-2.5 space-y-1.5">
                      {([
                        ['Block time', formatBlockTime(flightLinksPanelData.totalBlockMinutes)],
                        ['Ground time', `${formatBlockTime(flightLinksPanelData.totalGroundMinutes)}${flightLinksPanelData.mismatchCount > 0 ? ` (excl. ${flightLinksPanelData.mismatchCount} mismatch)` : ''}`],
                        ['Elapsed', `${formatBlockTime(flightLinksPanelData.elapsedMinutes)} (${flightLinksPanelData.firstStdLocal} – ${flightLinksPanelData.lastStaLocal})`],
                        ['Legs', String(flightLinksPanelData.legs)],
                        ['Domestic', String(flightLinksPanelData.domesticCount)],
                        ['International', String(flightLinksPanelData.internationalCount)],
                      ] as const).map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between">
                          <span style={{ fontSize: 10 }} className="text-muted-foreground">{label}</span>
                          <span style={{ fontSize: 11, fontWeight: 600 }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            </>

          ) : panelMode === 'flight' && flightPanelData ? (
            <>
              {/* ── FLIGHT PANEL ─────────────────────────────────────── */}
              <div className="shrink-0 px-3 py-2.5 border-b flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold truncate">
                    {flightPanelData.mode === 'single'
                      ? stripFlightPrefix(flightPanelData.flight.flightNumber)
                      : `${flightPanelData.count} Flights Selected`
                    }
                  </div>
                  {flightPanelData.mode === 'single' && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="inline-flex px-1.5 py-0.5 text-[9px] font-medium rounded bg-muted text-muted-foreground">
                        {flightPanelData.icao}
                      </span>
                      {flightPanelData.hasDbAssignment && (
                        <span className="text-[9px] text-muted-foreground">{flightPanelData.assignedReg}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => setPanelPinned(p => !p)}
                    className="p-1 rounded-md hover:bg-muted transition-colors"
                    title={panelPinned ? 'Unpin panel' : 'Pin panel'}
                  >
                    <Pin className={`h-3.5 w-3.5 transition-all duration-150 ${panelPinned ? 'text-primary fill-primary -rotate-45' : 'text-muted-foreground'}`} />
                  </button>
                  <button
                    onClick={() => { setSelectedFlights(new Set()); setPanelPinned(false) }}
                    className="p-1 rounded-md hover:bg-muted transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-3 space-y-3">
                  {flightPanelData.mode === 'single' ? (
                    <>
                      {/* Flight Card */}
                      <div className="rounded-lg border border-border/50 p-2.5">
                        <div className="flex items-center justify-between">
                          <div className="text-center">
                            <div className="text-sm font-bold">{flightPanelData.flight.depStation}</div>
                            <div className="text-[9px] text-muted-foreground">{flightPanelData.flight.stdLocal}</div>
                          </div>
                          <div className="flex-1 flex items-center justify-center px-2">
                            <div className="flex-1 h-px bg-border" />
                            <span className="px-1.5 text-[9px] text-muted-foreground">→</span>
                            <div className="flex-1 h-px bg-border" />
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-bold">{flightPanelData.flight.arrStation}</div>
                            <div className="text-[9px] text-muted-foreground">{flightPanelData.flight.staLocal}</div>
                          </div>
                        </div>
                        <div className="text-center text-[9px] text-muted-foreground mt-1">
                          {formatBlockTime(flightPanelData.flight.blockMinutes)}
                        </div>
                        <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border/30 text-[9px] text-muted-foreground">
                          <span>{flightPanelData.icao}{flightPanelData.hasDbAssignment ? ` · ${flightPanelData.assignedReg}` : ''}</span>
                          <span>{flightPanelData.cabin || ''}</span>
                        </div>
                      </div>

                      {/* Daily Utilization (only if tail assigned) */}
                      {flightPanelData.hasDbAssignment && (
                        <div>
                          <div className="text-[10px] font-medium text-muted-foreground mb-1.5">
                            Daily Utilization · {flightPanelData.assignedReg}
                          </div>
                          <div className="rounded-lg border border-border/50 p-2.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span>{flightPanelData.flightCount} flights</span>
                              <span className="font-semibold">{formatBlockTime(flightPanelData.totalBlock)} block</span>
                            </div>
                            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(100, flightPanelData.utilPct)}%`,
                                  background:
                                    flightPanelData.utilPct >= 85
                                      ? '#22c55e'
                                      : flightPanelData.utilPct >= 60
                                        ? '#f59e0b'
                                        : '#ef4444',
                                }}
                              />
                            </div>
                            <div className="text-[9px] text-muted-foreground mt-1">
                              {flightPanelData.utilPct}% of {flightPanelData.targetHours}h target
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Crew Placeholder */}
                      <div className="rounded-lg border border-dashed border-border/50 p-3 text-center">
                        <div className="text-[10px] font-medium text-muted-foreground mb-0.5">Crew</div>
                        <div className="text-[9px] text-muted-foreground/60 italic">Coming soon</div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Multi-flight summary */}
                      <div className="rounded-lg border border-border/50 p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold">{flightPanelData.count} flights</span>
                          <span className="font-semibold">{formatBlockTime(flightPanelData.totalBlock)} block</span>
                        </div>
                        <div className="text-[9px] text-muted-foreground">
                          {flightPanelData.dateCount} date{flightPanelData.dateCount !== 1 ? 's' : ''} · {flightPanelData.regCount} aircraft
                        </div>
                      </div>
                    </>
                  )}
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

          ) : panelMode === 'aircraft' && aircraftPanelData ? (
            <>
              {/* ── AIRCRAFT PANEL ───────────────────────────────────── */}
              <div className="shrink-0 px-3 py-2.5 border-b flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold truncate">{aircraftPanelData.registration}</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="inline-flex px-1.5 py-0.5 text-[9px] font-medium rounded bg-muted text-muted-foreground">
                      {aircraftPanelData.icao}
                    </span>
                    {aircraftPanelData.cabin && (
                      <span className="text-[9px] text-muted-foreground">{aircraftPanelData.cabin}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => setPanelPinned(p => !p)}
                    className="p-1 rounded-md hover:bg-muted transition-colors"
                    title={panelPinned ? 'Unpin panel' : 'Pin panel'}
                  >
                    <Pin className={`h-3.5 w-3.5 transition-all duration-150 ${panelPinned ? 'text-primary fill-primary -rotate-45' : 'text-muted-foreground'}`} />
                  </button>
                  <button
                    onClick={() => { setPanelAircraftReg(null); setPanelMode('flight'); setSelectedAircraftRow(null) }}
                    className="p-1 rounded-md hover:bg-muted transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-3 space-y-3">
                  {/* Aircraft Info Card */}
                  <div className="rounded-lg border border-border/50 p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Type</span>
                      <span className="font-semibold">{aircraftPanelData.icao}</span>
                    </div>
                    {aircraftPanelData.cabin && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Config</span>
                        <span className="font-semibold">{aircraftPanelData.cabin}</span>
                      </div>
                    )}
                    {aircraftPanelData.homeBase && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Home Base</span>
                        <span className="font-semibold">{aircraftPanelData.homeBase}</span>
                      </div>
                    )}
                  </div>

                  {/* Period Summary */}
                  <div>
                    <div className="text-[10px] font-medium text-muted-foreground mb-1.5">Period Summary</div>
                    <div className="rounded-lg border border-border/50 p-2.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span>{aircraftPanelData.flightCount} flights</span>
                        <span className="font-semibold">{formatBlockTime(aircraftPanelData.totalBlock)} block</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(100, Math.round(aircraftPanelData.activeDays / aircraftPanelData.periodDays * 100))}%` }}
                        />
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-1">
                        {aircraftPanelData.activeDays}/{aircraftPanelData.periodDays} days active
                      </div>
                    </div>
                  </div>

                  {/* Overnight Stations */}
                  {aircraftPanelData.overnightStations.length > 0 && (
                    <div>
                      <div className="text-[10px] font-medium text-muted-foreground mb-1.5">Overnight Stations</div>
                      <div className="space-y-1">
                        {aircraftPanelData.overnightStations.slice(0, 8).map(st => {
                          const maxCount = aircraftPanelData.overnightStations[0].count
                          const pct = Math.round(st.count / maxCount * 100)
                          return (
                            <div key={st.station} className="flex items-center gap-2">
                              <span className="text-[10px] font-semibold w-8">{st.station}</span>
                              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[9px] text-muted-foreground w-4 text-right">{st.count}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Maintenance Placeholder */}
                  <div className="rounded-lg border border-dashed border-border/50 p-3 text-center">
                    <div className="text-[10px] font-medium text-muted-foreground mb-0.5">Maintenance</div>
                    <div className="text-[9px] text-muted-foreground/60 italic">Coming soon</div>
                  </div>
                </div>
              </div>
            </>

          ) : panelMode === 'rotation' && rotationPanelData ? (
            <>
              {/* ── ROTATION PANEL ───────────────────────────────────── */}
              <div className="shrink-0 px-3 py-2.5 border-b flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold truncate">{rotationPanelData.reg}</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="inline-flex px-1.5 py-0.5 text-[9px] font-medium rounded bg-muted text-muted-foreground">
                      {rotationPanelData.icao}
                    </span>
                    <span className="text-[9px] text-muted-foreground">{rotationPanelData.dateStr}</span>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => setPanelPinned(p => !p)}
                    className="p-1 rounded-md hover:bg-muted transition-colors"
                    title={panelPinned ? 'Unpin panel' : 'Pin panel'}
                  >
                    <Pin className={`h-3.5 w-3.5 transition-all duration-150 ${panelPinned ? 'text-primary fill-primary -rotate-45' : 'text-muted-foreground'}`} />
                  </button>
                  <button
                    onClick={() => { setRotationTarget(null); setPanelMode('flight'); setSelectedAircraftRow(null) }}
                    className="p-1 rounded-md hover:bg-muted transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-3 space-y-3">
                  {/* Daily Utilization */}
                  <div>
                    <div className="text-[10px] font-medium text-muted-foreground mb-1.5">
                      Daily Utilization · {rotationPanelData.reg}
                    </div>
                    <div className="rounded-lg border border-border/50 p-2.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span>{rotationPanelData.flightCount} flights</span>
                        <span className="font-semibold">{formatBlockTime(rotationPanelData.totalBlock)} block</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, rotationPanelData.utilPct)}%`,
                            background:
                              rotationPanelData.utilPct >= 85
                                ? '#22c55e'
                                : rotationPanelData.utilPct >= 60
                                  ? '#f59e0b'
                                  : '#ef4444',
                          }}
                        />
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-1">
                        {rotationPanelData.utilPct}% of {rotationPanelData.targetHours}h target
                      </div>
                    </div>
                  </div>

                  {/* Rotation List */}
                  {rotationPanelData.rotation.length > 0 ? (
                    <div>
                      <div className="text-[10px] font-medium text-muted-foreground mb-1.5">
                        Daily Rotation · {rotationPanelData.dateStr}
                      </div>
                      {rotationPanelData.hasAutoAssigned && (
                        <div className="text-[10px] italic text-muted-foreground/60 mb-1.5">
                          Auto-assigned rotation preview
                        </div>
                      )}
                      <div className="space-y-0">
                        {rotationPanelData.rotation.map((rf, i) => {
                          const isSel = selectedFlights.has(rf.id)
                          const num = stripFlightPrefix(rf.flightNumber)
                          const isPub = rf.status === 'published'
                          const rfFin = !isPub && rf.finalized
                          const nextFlight = i < rotationPanelData.rotation.length - 1 ? rotationPanelData.rotation[i + 1] : null
                          const sameRouteAsNext = nextFlight && rf.routeId && nextFlight.routeId && rf.routeId === nextFlight.routeId
                          return (
                            <div key={rf.id}>
                              {rf.routeBlockStart && i > 0 && (
                                <div className="mx-2 my-1.5 border-t border-border/40" />
                              )}
                              <div
                                className={`flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer transition-colors ${
                                  isSel
                                    ? 'bg-[#fef2f2] dark:bg-[#1e1015]'
                                    : 'hover:bg-muted/30'
                                }`}
                                style={isSel ? { borderLeft: '3px solid #991b1b' } : { borderLeft: '3px solid transparent' }}
                                onClick={() => { setSelectedFlights(new Set([rf.id])); setPanelMode('flight') }}
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
                                    className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold"
                                    style={{
                                      background: isPub ? 'rgba(59,130,246,0.15)' : rfFin ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                                      color: isPub ? '#3b82f6' : rfFin ? '#10B981' : '#F59E0B',
                                    }}
                                  >
                                    {isPub ? 'P' : rfFin ? 'F' : 'W'}
                                  </span>
                                </div>
                              </div>

                              {/* TAT indicator */}
                              {rf.tatToNext && nextFlight && (() => {
                                const bothDbAssigned = !!rf.aircraftReg && !!nextFlight.aircraftReg
                                if (bothDbAssigned && !sameRouteAsNext && rf.arrStation !== nextFlight.depStation) {
                                  return (
                                    <div className="mx-2 my-0.5 px-2 py-1 rounded text-[9px] bg-amber-500/10 text-amber-700 dark:text-amber-400">
                                      <AlertTriangle className="h-2.5 w-2.5 inline mr-1" />
                                      Station mismatch: {rf.arrStation} ≠ {nextFlight.depStation}
                                    </div>
                                  )
                                }
                                if (bothDbAssigned && !sameRouteAsNext && !rf.tatToNext!.ok) {
                                  return (
                                    <div className="mx-2 my-0.5 px-2 py-1 rounded text-[9px] bg-red-500/10 text-red-700 dark:text-red-400">
                                      <AlertTriangle className="h-2.5 w-2.5 inline mr-1" />
                                      TAT {fmtTat(rf.tatToNext!.gapMinutes)} &lt; min {fmtTat(rf.tatToNext!.minTat)}
                                    </div>
                                  )
                                }
                                return (
                                  <div className="mx-2 my-0.5 text-[8px] text-muted-foreground/60 text-center">
                                    TAT: {fmtTat(rf.tatToNext!.gapMinutes)}
                                  </div>
                                )
                              })()}

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
                  ) : (
                    <div className="rounded-lg border border-dashed border-border/50 p-3 text-center">
                      <Info className="h-4 w-4 text-muted-foreground mx-auto mb-1.5" />
                      <div className="text-[10px] text-muted-foreground">No flights on this day</div>
                    </div>
                  )}

                  {/* Conflict Cards */}
                  {(ganttSettings.display?.conflictIndicators ?? true) && rotationPanelData.conflicts.length > 0 && (
                    <div>
                      <div className="text-[10px] font-medium text-red-600 dark:text-red-400 mb-1.5 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {rotationPanelData.conflicts.length} Issue{rotationPanelData.conflicts.length > 1 ? 's' : ''} Detected
                      </div>
                      <div className="space-y-2">
                        {rotationPanelData.conflicts.map((c, i) => (
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
                            <div className="text-[9px] text-muted-foreground leading-relaxed">{c.detail}</div>
                            <div className="flex flex-wrap gap-1">
                              {c.type === 'station_mismatch' ? (
                                <>
                                  <button className="px-2 py-0.5 text-[8px] font-medium rounded border border-border hover:bg-muted transition-colors">Insert Ferry</button>
                                  <button className="px-2 py-0.5 text-[8px] font-medium rounded border border-border hover:bg-muted transition-colors">Move to Other AC</button>
                                </>
                              ) : (
                                <>
                                  <button className="px-2 py-0.5 text-[8px] font-medium rounded border border-border hover:bg-muted transition-colors">Adjust STD (min TAT)</button>
                                  <button className="px-2 py-0.5 text-[8px] font-medium rounded border border-border hover:bg-muted transition-colors">Move to Other AC</button>
                                </>
                              )}
                              <button className="px-2 py-0.5 text-[8px] font-medium rounded border border-border hover:bg-muted transition-colors text-muted-foreground">Ignore</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Assist */}
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
            </>
          ) : (
            /* Empty state */
            <>
              <div className="shrink-0 px-3 py-2.5 border-b flex items-center justify-between gap-2">
                <div className="text-[13px] font-semibold text-muted-foreground">Flight Info</div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => setPanelPinned(p => !p)}
                    className="p-1 rounded-md hover:bg-muted transition-colors"
                    title={panelPinned ? 'Unpin panel' : 'Pin panel'}
                  >
                    <Pin className={`h-3.5 w-3.5 transition-all duration-150 ${panelPinned ? 'text-primary fill-primary -rotate-45' : 'text-muted-foreground'}`} />
                  </button>
                  <button
                    onClick={() => { setPanelPinned(false); setPanelVisible(false) }}
                    className="p-1 rounded-md hover:bg-muted transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4">
                <PlaneTakeoff className="h-8 w-8 text-muted-foreground/30" />
                <div className="text-[13px] font-semibold text-muted-foreground">
                  No flight selected
                </div>
                <div className="text-[11px] text-muted-foreground/60 text-center">
                  Click a flight bar to view details
                </div>
              </div>
            </>
          )}
          </>)}
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
              style={{ background: 'var(--gantt-bar-bg-unassigned)', border: '1.5px dashed #10B981' }}
            />
            <span>Finalized</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-5 h-3 rounded-[3px]"
              style={{ background: 'var(--gantt-bar-bg-unassigned)', border: '1.5px dashed #F59E0B' }}
            />
            <span>WIP</span>
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
        <DialogContent
          className="sm:max-w-[380px]"
          container={dialogContainer}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !deleting) {
              e.preventDefault()
              handleDelete()
            }
          }}
        >
          {(() => {
            const uniqueDates = Array.from(new Set(selectedFlightObjects.map(ef => formatISO(ef.date)))).sort()
            const isMultiDate = uniqueDates.length > 1
            const fmtShort = (iso: string) => {
              const d = new Date(iso + 'T00:00:00')
              return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
            }
            const fmtFull = (iso: string) => {
              const [y, m, d] = iso.split('-')
              return `${d}/${m}/${y}`
            }
            const flightCount = selectedFlightObjects.length
            const displayFlights = selectedFlightObjects.slice(0, 5)
            const overflow = flightCount - displayFlights.length

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-[15px] font-bold leading-snug">
                    {isMultiDate ? (
                      <>Remove the following flights for {fmtFull(uniqueDates[0])} to {fmtFull(uniqueDates[uniqueDates.length - 1])}?</>
                    ) : (
                      <>Remove {flightCount} flight{flightCount > 1 ? 's' : ''} from {fmtShort(uniqueDates[0])}?</>
                    )}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-1 -mt-1">
                  {displayFlights.map(ef => (
                    <div key={ef.id} className="text-[12px] text-foreground">
                      {ef.flightNumber} {ef.depStation} → {ef.arrStation} · {ef.stdLocal} - {ef.staLocal}
                    </div>
                  ))}
                  {overflow > 0 && (
                    <div className="text-[11px] text-muted-foreground">and {overflow} more flight{overflow > 1 ? 's' : ''}</div>
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
                    className="px-3 py-1.5 text-[11px] font-medium rounded-md text-white transition-colors disabled:opacity-50"
                    style={{ backgroundColor: '#DC2626' }}
                  >
                    {deleting ? 'Removing...' : 'Remove'}
                  </button>
                </DialogFooter>
              </>
            )
          })()}
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
          container={dialogContainer}
        />
      )}

      {/* ── CONTEXT MENU ────────────────────────────────────────── */}
      {contextMenu && selectedFlights.size > 0 && (
        <GanttContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          selectionCount={selectedFlights.size}
          hasDbAssigned={selectedFlightObjects.some(f => !!f.aircraftReg)}
          clipboardCount={clipboard?.expandedIds.size ?? 0}
          onPaste={clipboard && contextMenu.rowReg ? () => {
            setContextMenu(null)
            pasteToTarget(contextMenu.rowReg!)
          } : undefined}
          onCut={() => {
            setContextMenu(null)
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', ctrlKey: true }))
          }}
          onAssign={() => { setContextMenu(null); setAssignModalOpen(true) }}
          onUnassign={() => {
            setContextMenu(null)
            setUnassignModalOpen(true)
          }}
          hasRegistration={!!contextMenu.rowReg}
          onSwap={() => { enterSwapMode() }}
          onEdit={() => {
            setContextMenu(null)
            const ef = selectedFlightObjects[0]
            if (ef) handleBarDoubleClick(ef)
          }}
          onDelete={() => {
            setContextMenu(null)
            setDeleteModalOpen(true)
          }}
        />
      )}

      {/* ── SWAP FLIGHTS DIALOG ─────────────────────────────────── */}
      {swapDialogOpen && swapSideA.length > 0 && swapSideB.length > 0 && (
        <SwapFlightsDialog
          open={swapDialogOpen}
          onClose={() => { setSwapDialogOpen(false); setSwapMode(false); setSwapSource([]) }}
          sideA={swapSideA as SwapExpandedFlight[]}
          regA={swapRegA}
          acTypeA={swapSideA[0]?.aircraftTypeIcao || 'UNKN'}
          sideB={swapSideB as SwapExpandedFlight[]}
          regB={swapRegB}
          acTypeB={swapSideB[0]?.aircraftTypeIcao || 'UNKN'}
          rowAFlights={(wsFlightsByReg.get(swapRegA) || []) as SwapExpandedFlight[]}
          rowBFlights={(wsFlightsByReg.get(swapRegB) || []) as SwapExpandedFlight[]}
          tatMinutes={new Map()}
          onConfirm={handleSwapConfirm}
          container={dialogContainer}
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
          container={dialogContainer}
          preselectedReg={(() => {
            const regs = Array.from(new Set(selectedFlightObjects.map(f => f.aircraftReg || f.assignedReg).filter(Boolean)))
            return regs.length === 1 ? regs[0]! : null
          })()}
          onAssigned={(items, registration) => {
            setAssignModalOpen(false)
            setSelectedFlights(new Set())
            // Clear any workspace overrides for these flights so DB assignment takes effect
            const expandedIds = items.map(it => `${it.flightId}_${it.flightDate}`)
            removeWorkspaceOverrides(expandedIds)
            applyOptimisticAssign(items, registration)
            // Delay refresh to let DB write fully commit; merge logic protects optimistic state
            setTimeout(() => refreshFlights(), 500)
          }}
        />
      )}

      {/* ── UNASSIGN CONFIRMATION MODAL ─────────────────────────── */}
      <UnassignModal
        open={unassignModalOpen}
        onClose={() => setUnassignModalOpen(false)}
        selectedFlightObjects={selectedFlightObjects}
        container={dialogContainer}
        onConfirm={async (finalItems) => {
          const res = await unassignFlightsTail(finalItems)
          if (res.error) { toast.error(friendlyError(res.error)); return }
          toast.success(`${finalItems.length} flight${finalItems.length > 1 ? 's' : ''} unassigned`)
          // Clear any workspace overrides for these flights so unassignment takes effect
          const expandedIds = finalItems.map(it => `${it.flightId}_${it.flightDate}`)
          removeWorkspaceOverrides(expandedIds)
          applyOptimisticUnassign(finalItems)
          setUnassignModalOpen(false)
          setSelectedFlights(new Set())
          // Delay refresh to let DB delete fully commit; merge logic protects optimistic state
          setTimeout(() => refreshFlights(), 500)
        }}
      />

      {/* ── DROP CONFIRMATION DIALOG ────────────────────────────── */}
      {pendingDrop && (
        <DropConfirmDialog
          open={!!pendingDrop}
          onClose={cancelDrop}
          onConfirm={confirmDrop}
          pendingDrop={pendingDrop}
          container={dialogContainer}
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
        onClear={clearClipboard}
      />

      {/* ── SETTINGS MODAL ──────────────────────────────────── */}
      <GanttSettingsPanel
        open={settingsPanelOpen}
        onClose={() => setSettingsPanelOpen(false)}
        settings={ganttSettings}
        aircraftTypes={aircraftTypes}
        airports={airports}
        serviceTypes={serviceTypes}
        saveStatus={saveStatus}
        fleetPreview={fleetPreview}
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
        container={dialogContainer}
      />

      {/* ── OPTIMIZER DIALOG ─────────────────────────────────── */}
      <GanttOptimizerDialog
        open={optimizerOpen}
        onClose={() => setOptimizerOpen(false)}
        onRunComplete={handleRunAssignment}
        currentMethod={assignmentMethod}
        lastRun={lastOptRun}
        running={optimizerRunning}
        container={dialogContainer}
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

// ─── Schedule Filter Dropdown ────────────────────────────────────────────

const SCHEDULE_FILTER_OPTIONS = [
  { key: 'published' as const,  label: 'Published',        description: 'Live operating schedule',        color: '#3b82f6', dashed: false },
  { key: 'finalized' as const,  label: 'Finalized Drafts', description: 'Ready for publish review',       color: '#10B981', dashed: true },
  { key: 'wip' as const,        label: 'Work in Progress', description: 'Drafts still being edited',      color: '#F59E0B', dashed: true },
]

type ScheduleFilters = { published: boolean; finalized: boolean; wip: boolean }

function ScheduleFilterDropdown({
  filters,
  onChange,
  scale,
}: {
  filters: ScheduleFilters
  onChange: (v: ScheduleFilters) => void
  scale?: (px: number) => number
}) {
  const s = scale || ((px: number) => px)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  const activeCount = [filters.published, filters.finalized, filters.wip].filter(Boolean).length
  const pillLabel = activeCount === 3 ? `All (3)` : activeCount === 0 ? 'None' : `${activeCount} of 3`
  const pillColor = activeCount === 3 ? '#16a34a' : activeCount > 0 ? '#3b82f6' : '#ef4444'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center border border-border rounded-full transition-all duration-200 hover:bg-muted/40"
        style={{
          height: s(28),
          padding: `0 ${s(12)}px`,
          gap: s(6),
          fontSize: s(11),
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        <span style={{ width: s(7), height: s(7), borderRadius: '50%', background: pillColor, flexShrink: 0 }} />
        <span>{pillLabel}</span>
        <ChevronDown
          className="text-muted-foreground transition-transform duration-200"
          style={{ width: s(10), height: s(10), transform: open ? 'rotate(180deg)' : undefined }}
        />
      </button>

      {open && (
        <div
          className="absolute top-full mt-1 border border-border rounded-xl overflow-hidden"
          style={{
            width: 260,
            zIndex: 50,
            background: 'hsl(var(--background))',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          }}
        >
          {SCHEDULE_FILTER_OPTIONS.map((opt, i) => {
            const checked = filters[opt.key]
            return (
              <button
                key={opt.key}
                onClick={() => onChange({ ...filters, [opt.key]: !checked })}
                className="w-full flex items-center gap-2.5 text-left transition-colors hover:bg-muted/40"
                style={{
                  padding: '8px 12px',
                  borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                }}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: opt.dashed ? 'transparent' : opt.color,
                  border: `1.5px ${opt.dashed ? 'dashed' : 'solid'} ${opt.color}`,
                }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium">{opt.label}</div>
                  <div className="text-[10px] text-muted-foreground">{opt.description}</div>
                </div>
                <div style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                  border: checked ? 'none' : '1.5px solid var(--border)',
                  background: checked ? 'var(--primary)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {checked && <Check className="text-primary-foreground" style={{ width: 11, height: 11 }} />}
                </div>
              </button>
            )
          })}
        </div>
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
  const isFin = !isPublished && flight.finalized
  const isWip = !isPublished && !flight.finalized
  const statusColor = isPublished ? '#3b82f6' : isFin ? '#10B981' : '#F59E0B'
  const statusText = isPublished ? 'Published' : isFin ? 'Draft \u2014 Finalized \u2713' : 'Draft \u2014 Work in Progress'
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
              className="text-[9px] font-medium tracking-wider"
              style={{ color: statusColor }}
            >
              {statusText}
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
              TAT to next: {fmtTat(tat.gapMinutes)} (min:{fmtTat(tat.minTat)})
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Context Menu ──────────────────────────────────────────────────────

function GanttContextMenu({
  x, y, selectionCount, hasDbAssigned, clipboardCount,
  onPaste, onCut,
  onAssign, onUnassign, hasRegistration, onSwap, onEdit, onDelete,
}: {
  x: number; y: number; selectionCount: number; hasDbAssigned: boolean; clipboardCount: number
  onPaste?: () => void; onCut: () => void
  onAssign: () => void; onUnassign: () => void; hasRegistration: boolean; onSwap: () => void; onEdit: () => void; onDelete: () => void
}) {
  const isSingle = selectionCount === 1

  const menuItems: { label: string; shortcut?: string; onClick: () => void; show: boolean; separator?: boolean; destructive?: boolean; disabled?: boolean }[] = [
    { label: `Paste ${clipboardCount} Flight${clipboardCount > 1 ? 's' : ''} here`, shortcut: 'Ctrl+V', onClick: onPaste || (() => {}), show: !!onPaste },
    { label: '', onClick: () => {}, show: !!onPaste, separator: true },
    { label: 'Cut', shortcut: 'Ctrl+X', onClick: onCut, show: true },
    { label: '', onClick: () => {}, show: true, separator: true },
    { label: 'Assign Aircraft Registration', shortcut: 'Ctrl+A', onClick: onAssign, show: true },
    { label: 'Unassign Tail', onClick: onUnassign, show: hasDbAssigned },
    { label: '\u21C4 Swap with\u2026', shortcut: 'S', onClick: onSwap, show: hasRegistration },
    { label: '', onClick: () => {}, show: true, separator: true },
    { label: 'Edit Flight', onClick: onEdit, show: isSingle },
    { label: '', onClick: () => {}, show: true, separator: true },
    { label: 'Remove from Date', shortcut: 'Del', onClick: onDelete, show: true, destructive: true },
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
  open, onClose, selectedFlightObjects, container, onConfirm,
}: {
  open: boolean
  onClose: () => void
  selectedFlightObjects: ExpandedFlight[]
  container?: HTMLElement | null
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
      <DialogContent className="sm:max-w-[420px]" container={container}>
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
  container?: HTMLElement | null
  preselectedReg?: string | null
}

function AssignToAircraftModal({
  open, onClose, selectedFlights, registrations,
  aircraftTypes, seatingConfigs, flightsByReg, acTypeByIcao, onAssigned, container,
  preselectedReg,
}: AssignModalProps) {
  const [selectedReg, setSelectedReg] = useState<string | null>(preselectedReg ?? null)
  const [assigning, setAssigning] = useState(false)
  const [warningState, setWarningState] = useState<'none' | 'category' | 'family'>('none')

  // Reset state when opened — use preselection if available
  useEffect(() => {
    if (open) {
      setSelectedReg(preselectedReg ?? null)
      setAssigning(false)
      setWarningState('none')
    }
  }, [open, preselectedReg])

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

  // Enter key shortcut — quick-assign when preselected
  useEffect(() => {
    if (!open || !selectedReg) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !assigning) {
        e.preventDefault()
        handleAssign()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, selectedReg, assigning, handleAssign])

  // Determine which group contains the preselected reg (for auto-expand)
  const preselectedGroup = useMemo(() => {
    if (!preselectedReg) return null
    if (grouped.sameType.some((r: AircraftWithRelations) => r.registration === preselectedReg)) return 'same-type'
    if (grouped.sameFamily.some((r: AircraftWithRelations) => r.registration === preselectedReg)) return 'same-family'
    const otherEntries = Array.from(grouped.other.entries())
    for (let i = 0; i < otherEntries.length; i++) {
      if (otherEntries[i][1].some((r: AircraftWithRelations) => r.registration === preselectedReg)) return otherEntries[i][0]
    }
    return null
  }, [preselectedReg, grouped])

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
      <DialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden" container={container} style={{
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
          {/* Same type group — expanded by default, or when preselection is here */}
          {grouped.sameType.length > 0 && (
            <details open={!preselectedGroup || preselectedGroup === 'same-type'}>
              <summary className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 cursor-pointer select-none list-none flex items-center gap-1.5">
                <ChevronDown className="h-3 w-3 transition-transform [details:not([open])>&]:-rotate-90" />
                {primaryIcao} — Same type ({grouped.sameType.length})
              </summary>
              {renderGroupDropdown(grouped.sameType, 'same-type')}
            </details>
          )}

          {/* Same family group — auto-expand if preselection is here */}
          {grouped.sameFamily.length > 0 && (
            <details open={preselectedGroup === 'same-family' || undefined}>
              <summary className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 cursor-pointer select-none list-none flex items-center gap-1.5">
                <ChevronDown className="h-3 w-3 transition-transform [details:not([open])>&]:-rotate-90" />
                {primaryAcType?.family || 'Family'} — Same family ({grouped.sameFamily.length})
              </summary>
              {renderGroupDropdown(grouped.sameFamily, 'same-family')}
            </details>
          )}

          {/* Other families — auto-expand if preselection is here */}
          {Array.from(grouped.other.entries()).map(([family, regs]) => (
            <details key={family} open={preselectedGroup === family || undefined}>
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
        <div className="px-4 py-3 border-t space-y-1.5">
          <div className="flex items-center justify-end gap-2">
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
          {selectedReg && !assigning && warningState === 'none' && (
            <div className="text-[9px] text-muted-foreground/60 text-right">
              Press Enter to assign to {selectedReg}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Drop Confirm Dialog ────────────────────────────────────────────────

function DropConfirmDialog({
  open, onClose, onConfirm, pendingDrop, getFlightDetails, getTypeName, container,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  pendingDrop: PendingDrop
  getFlightDetails: (expandedId: string) => { flightNumber: string; depStation: string; arrStation: string; date: Date; stdLocal: string } | null
  getTypeName: (icao: string) => string
  container?: HTMLElement | null
}) {
  const formatDate = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })

  const sourceType = getTypeName(pendingDrop.targetIcao) // source type comes from the flight, but we show target info
  const isSameFamily = pendingDrop.validity === 'same-family'

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-[420px]" container={container}>
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
