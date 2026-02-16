'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { ScheduleSeason, AircraftType, Airport } from '@/types/database'
import {
  AircraftRoute, AircraftRouteLeg,
  getAircraftRoutes, getUnassignedFlightCount, createAircraftRoute,
  checkDuplicateFlight, saveRoute, deleteRoute as deleteRouteAction,
  publishRoute as publishRouteAction, getRecentRoutes,
  type RecentRoute, type SaveRouteInput,
} from '@/app/actions/aircraft-routes'
import { cn, minutesToHHMM } from '@/lib/utils'
import {
  Plus, Search, RefreshCw, Plane, ChevronDown, ChevronRight,
  GripVertical, Trash2, Save, RotateCcw, AlertTriangle,
} from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { StatusGreen, StatusYellow, StatusRed, StatusGray } from '@/components/ui/validation-icons'
import { toast } from 'sonner'

// ─── Props ────────────────────────────────────────────────────

interface Props {
  seasons: ScheduleSeason[]
  aircraftTypes: AircraftType[]
  airports: Airport[]
  initialRoutes: AircraftRoute[]
  initialUnassignedCount: number
  operatorIataCode: string
  initialRecentRoutes: RecentRoute[]
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

function DowCirclesSmall({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-[2px]">
      {DOW_LABELS.map((label, i) => (
        <div
          key={i}
          className={cn(
            'w-[16px] h-[16px] rounded-full text-[8px] font-semibold leading-none flex items-center justify-center',
            isDayActive(value, i)
              ? 'bg-[#991b1b] text-white'
              : 'bg-transparent text-[#d1d5db] dark:text-[#4b5563] border border-[#e5e7eb] dark:border-[#374151]'
          )}
        >{label}</div>
      ))}
    </div>
  )
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

function DowDotsTiny({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-[2px]">
      {DOW_LABELS.map((_, i) => (
        <div
          key={i}
          className={cn(
            'w-[4px] h-[4px] rounded-full',
            isDayActive(value, i) ? 'bg-[#991b1b]' : 'bg-gray-300 dark:bg-gray-600'
          )}
        />
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
}

function calculateDayOffsets(legs: LegWithOffsets[]): void {
  if (legs.length === 0) return
  legs[0]._dayOffset = 0
  legs[0]._arrivesNextDay = timeToMinutes(legs[0].sta_local) < timeToMinutes(legs[0].std_local)

  for (let i = 1; i < legs.length; i++) {
    const prev = legs[i - 1]
    const curr = legs[i]
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
  _autoFilledDep: boolean
  _autoFilledStd: boolean
  _errors: Record<string, boolean>
  _duplicateError: string | null
  _checking: boolean
}

function emptyDraft(): NewLegDraft {
  return { flightNumber: '', depStation: '', arrStation: '', stdLocal: '', staLocal: '', _autoFilledDep: false, _autoFilledStd: false, _errors: {}, _duplicateError: null, _checking: false }
}

function makeLegId(): string {
  return `leg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export function AircraftRoutesBuilder({
  seasons, aircraftTypes, airports, initialRoutes, initialUnassignedCount, operatorIataCode, initialRecentRoutes,
}: Props) {
  const [selectedSeason, setSelectedSeason] = useState(seasons[0]?.id || '')
  const [routes, setRoutes] = useState<AircraftRoute[]>(initialRoutes)
  const [unassignedCount, setUnassignedCount] = useState(initialUnassignedCount)
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // ── Route detail state ──
  const [form, setForm] = useState<RouteFormState | null>(null)
  const [legs, setLegs] = useState<LegWithOffsets[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [draft, setDraft] = useState<NewLegDraft>(emptyDraft())
  const [editingCell, setEditingCell] = useState<{ legId: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dropIdx, setDropIdx] = useState<number | null>(null)

  // ── Dialogs ──
  const [pendingRouteId, setPendingRouteId] = useState<string | null>(null)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [showWarningDialog, setShowWarningDialog] = useState(false)
  const [saveWarnings, setSaveWarnings] = useState<string[]>([])
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [showPublishDialog, setShowPublishDialog] = useState(false)

  // ── Save / action state ──
  const [saving, setSaving] = useState(false)
  const [recentRoutes, setRecentRoutes] = useState<RecentRoute[]>(initialRecentRoutes)

  const snapshotRef = useRef<{ form: RouteFormState; legs: LegWithOffsets[] } | null>(null)

  // ── Browser navigation guard ──
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

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
    airports.forEach(a => { if (a.iata_code && a.country) m.set(a.iata_code, a.country) })
    return m
  }, [airports])

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
    return best || 'Vietnam'
  }, [routes, airportCountryMap])

  // ── Recalc helper ──
  const recalcLegs = useCallback((newLegs: LegWithOffsets[]): LegWithOffsets[] => {
    const copy = newLegs.map((l, i) => ({ ...l, leg_sequence: i + 1 }))
    calculateDayOffsets(copy)
    return copy
  }, [])

  // ── Load route ──
  const loadRoute = useCallback((routeId: string | null) => {
    const route = routes.find(r => r.id === routeId)
    if (!route) {
      setForm(null); setLegs([]); setIsDirty(false); setIsAdding(false); setEditingCell(null)
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
      ...l, _dayOffset: l.day_offset || 0, _arrivesNextDay: l.arrives_next_day || false,
    }))
    calculateDayOffsets(legsWithOffsets)
    setForm(f); setLegs(legsWithOffsets); setIsDirty(false); setIsAdding(false); setEditingCell(null)
    snapshotRef.current = { form: { ...f }, legs: legsWithOffsets.map(l => ({ ...l })) }
  }, [routes, selectedSeason])

  useEffect(() => { loadRoute(selectedRouteId) }, [selectedRouteId, routes, loadRoute])

  // ── Computed values ──
  const chain = useMemo(() => {
    if (legs.length === 0) return ''
    return legs.map(l => l.dep_station).concat(legs[legs.length - 1].arr_station).join(' \u2192 ')
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
    const stdNorm = normalizeTime(draft.stdLocal)
    const staNorm = normalizeTime(draft.staLocal)
    const hasDep = dep.length === 3
    const hasStd = stdNorm !== '' && isValidTime(stdNorm)
    const hasSta = staNorm !== '' && isValidTime(staNorm)

    if (!hasDep && !hasStd && !hasSta && !draft._duplicateError) return null

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
          service_type: 'J', _dayOffset: 0, _arrivesNextDay: false,
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
    if (!selectedSeason) return; setLoading(true)
    try {
      const [r, c] = await Promise.all([getAircraftRoutes(selectedSeason), getUnassignedFlightCount(selectedSeason)])
      setRoutes(r); setUnassignedCount(c)
    } catch { toast.error('Failed to refresh') }
    finally { setLoading(false) }
  }, [selectedSeason])

  const refreshRecent = useCallback(async () => {
    try { setRecentRoutes(await getRecentRoutes()) } catch { /* silent */ }
  }, [])

  // ── Season / new route ──
  const handleSeasonChange = useCallback(async (seasonId: string) => {
    setSelectedSeason(seasonId); setSelectedRouteId(null); setLoading(true)
    try {
      const [r, c] = await Promise.all([getAircraftRoutes(seasonId), getUnassignedFlightCount(seasonId)])
      setRoutes(r); setUnassignedCount(c)
    } catch { toast.error('Failed to load routes') }
    finally { setLoading(false) }
  }, [])

  const handleNewRoute = useCallback(async () => {
    if (!selectedSeason) { toast.error('Select a season first'); return }
    setLoading(true)
    try {
      const res = await createAircraftRoute({ season_id: selectedSeason })
      if (res.error) { toast.error(res.error); return }
      toast.success('Route created')
      await refresh()
      if (res.id) setSelectedRouteId(res.id)
    } catch { toast.error('Failed to create route') }
    finally { setLoading(false) }
  }, [selectedSeason, refresh])

  // ── Route selection (with dirty guard) ──
  const handleSelectRoute = useCallback((routeId: string) => {
    if (routeId === selectedRouteId) return
    if (isDirty) {
      setPendingRouteId(routeId)
      setShowUnsavedDialog(true)
    } else {
      setSelectedRouteId(routeId)
    }
  }, [selectedRouteId, isDirty])

  const handleDiscardAndSwitch = useCallback(() => {
    setShowUnsavedDialog(false)
    if (pendingRouteId) setSelectedRouteId(pendingRouteId)
    setPendingRouteId(null)
  }, [pendingRouteId])

  // ── Group & filter ──
  const filteredRoutes = useMemo(() => {
    if (!search.trim()) return routes
    const q = search.toLowerCase()
    return routes.filter(r =>
      (r.route_name || '').toLowerCase().includes(q) ||
      r.chain.toLowerCase().includes(q) ||
      (r.aircraft_type_icao || '').toLowerCase().includes(q)
    )
  }, [routes, search])

  const groups = useMemo(() => groupRoutesByAircraftType(filteredRoutes, aircraftTypes), [filteredRoutes, aircraftTypes])

  const toggleGroup = useCallback((icao: string) => {
    setCollapsedGroups(prev => { const n = new Set(prev); n.has(icao) ? n.delete(icao) : n.add(icao); return n })
  }, [])

  const selectedRoute = routes.find(r => r.id === selectedRouteId)

  // ── Form update ──
  const updateForm = useCallback((patch: Partial<RouteFormState>) => {
    setForm(prev => prev ? { ...prev, ...patch } : null)
    setIsDirty(true)
  }, [])

  // ── Delete leg ──
  const deleteLeg = useCallback((legId: string) => {
    setLegs(prev => recalcLegs(prev.filter(l => l.id !== legId)))
    setIsDirty(true)
  }, [recalcLegs])

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
      service_type: 'J',
      _dayOffset: 0,
      _arrivesNextDay: false,
    }

    setLegs(prev => recalcLegs([...prev, newLeg]))
    setDraft(emptyDraft())
    setIsAdding(false)
    setIsDirty(true)
  }, [draft, draftValidation, legs, operatorIataCode, selectedRouteId, recalcLegs, form?.periodStart, form?.periodEnd])

  // ── Start adding with auto-populate ──
  const startAddLeg = useCallback(() => {
    const d = emptyDraft()
    if (legs.length > 0) {
      const lastLeg = legs[legs.length - 1]
      d.depStation = lastLeg.arr_station
      d._autoFilledDep = true

      if (lastLeg.sta_local && form?.aircraftTypeId) {
        const acType = acTypeMap.get(form.aircraftTypeId)
        const rType = getRouteType(lastLeg.arr_station, lastLeg.arr_station, airportCountryMap, operatorCountry)
        const minTat = getMinTat(acType, rType)
        const prevStaMin = timeToMinutes(lastLeg.sta_local)
        const absStaMin = (lastLeg._dayOffset + (lastLeg._arrivesNextDay ? 1 : 0)) * 1440 + prevStaMin
        const stdAbsMin = absStaMin + minTat
        d.stdLocal = minutesToTimeStr(stdAbsMin % 1440)
        d._autoFilledStd = true
      }
    }
    setDraft(d)
    setIsAdding(true)
  }, [legs, form?.aircraftTypeId, acTypeMap, airportCountryMap, operatorCountry])

  // ── Inline cell editing ──
  const startEdit = useCallback((legId: string, field: string, currentValue: string) => {
    setEditingCell({ legId, field })
    setEditValue(currentValue)
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
      }

      updated[idx] = leg
      return recalcLegs(updated)
    })
    setEditingCell(null)
    setIsDirty(true)
  }, [editingCell, editValue, operatorIataCode, recalcLegs])

  const cancelEdit = useCallback(() => { setEditingCell(null) }, [])

  // ── Drag & Drop ──
  const handleDragStart = useCallback((idx: number) => { setDragIdx(idx) }, [])
  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => { e.preventDefault(); setDropIdx(idx) }, [])
  const handleDrop = useCallback((targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) { setDragIdx(null); setDropIdx(null); return }
    setLegs(prev => {
      const items = [...prev]
      const [moved] = items.splice(dragIdx, 1)
      items.splice(targetIdx, 0, moved)
      return recalcLegs(items)
    })
    setDragIdx(null); setDropIdx(null); setIsDirty(true)
  }, [dragIdx, recalcLegs])

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
        id: selectedRouteId,
        season_id: form.seasonId,
        route_name: form.routeName || null,
        aircraft_type_id: form.aircraftTypeId || null,
        aircraft_type_icao: form.aircraftTypeIcao || null,
        days_of_operation: form.daysOfOperation,
        period_start: form.periodStart || null,
        period_end: form.periodEnd || null,
        duration_days: routeDuration,
        status: form.status,
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
      if (res.error) { toast.error(res.error); return }

      toast.success(`Route ${form.routeName || 'Untitled'} saved (${legs.length} leg${legs.length !== 1 ? 's' : ''})`)
      setIsDirty(false)
      const newRouteId = res.id!
      await Promise.all([refresh(), refreshRecent()])
      setSelectedRouteId(newRouteId)
    } catch { toast.error('Failed to save route') }
    finally { setSaving(false) }
  }, [form, selectedRouteId, legs, routeDuration, refresh, refreshRecent])

  const handleSaveRoute = useCallback(() => {
    if (!form) return
    if (hasRedErrors) { toast.error('Cannot save \u2014 resolve errors first'); return }
    if (isAdding && draft._duplicateError) { toast.error('Cannot save \u2014 resolve duplicate flight error first'); return }

    const warnings = computeWarnings()
    if (warnings.length > 0) { setSaveWarnings(warnings); setShowWarningDialog(true); return }
    executeSave()
  }, [form, hasRedErrors, isAdding, draft._duplicateError, computeWarnings, executeSave])

  const discardChanges = useCallback(() => {
    if (snapshotRef.current) {
      setForm({ ...snapshotRef.current.form })
      setLegs(snapshotRef.current.legs.map(l => ({ ...l })))
    }
    setIsDirty(false); setIsAdding(false); setEditingCell(null); setDraft(emptyDraft())
    setShowDiscardDialog(false)
  }, [])

  const handleDeleteRoute = useCallback(async () => {
    if (!selectedRouteId) return
    setSaving(true); setShowDeleteDialog(false)
    try {
      const res = await deleteRouteAction(selectedRouteId)
      if (res.error) { toast.error(res.error); return }
      toast.success(`Route ${form?.routeName || 'Untitled'} deleted`)
      setSelectedRouteId(null); setIsDirty(false)
      await Promise.all([refresh(), refreshRecent()])
    } catch { toast.error('Failed to delete route') }
    finally { setSaving(false) }
  }, [selectedRouteId, form?.routeName, refresh, refreshRecent])

  const handlePublishRoute = useCallback(async () => {
    if (!selectedRouteId) return
    const isPublished = form?.status === 'published'
    setSaving(true); setShowPublishDialog(false)
    try {
      const res = await publishRouteAction(selectedRouteId, !isPublished)
      if (res.error) { toast.error(res.error); return }
      toast.success(`Route ${isPublished ? 'unpublished' : 'published'}`)
      setForm(prev => prev ? { ...prev, status: isPublished ? 'draft' : 'published' } : null)
      await Promise.all([refresh(), refreshRecent()])
    } catch { toast.error('Failed to update route status') }
    finally { setSaving(false) }
  }, [selectedRouteId, form?.status, refresh, refreshRecent])

  // ── Styles ──
  const inputClass = 'h-8 rounded-lg bg-white/50 dark:bg-white/5 border border-black/[0.06] dark:border-white/[0.06] px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30'
  const cellInputClass = 'bg-transparent border-b border-primary/40 focus:border-primary outline-none font-mono tabular-nums'

  return (
    <div className="h-full flex gap-4 overflow-hidden">
      {/* ═══ LEFT PANEL ═══ */}
      <div className="w-[280px] shrink-0 glass rounded-2xl flex flex-col overflow-hidden">
        <div className="shrink-0 p-4 pb-3 space-y-3">
          <select value={selectedSeason} onChange={e => handleSeasonChange(e.target.value)}
            className={cn(inputClass, 'w-full font-medium')}>
            {seasons.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
          </select>

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Aircraft Routes</h2>
            <div className="flex items-center gap-1">
              <button onClick={refresh} disabled={loading} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors" title="Refresh">
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              </button>
              <button onClick={handleNewRoute} disabled={loading} className="h-7 px-2.5 flex items-center gap-1 rounded-lg bg-[#991b1b] text-white text-xs font-medium hover:bg-[#7f1d1d] transition-colors">
                <Plus className="h-3 w-3" /> New
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input type="text" placeholder="Search routes..." value={search} onChange={e => setSearch(e.target.value)}
              className={cn(inputClass, 'w-full pl-8')} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2 custom-scrollbar">
          {loading && !routes.length ? (
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

        <div className="shrink-0 border-t border-black/[0.06] dark:border-white/[0.06] px-4 py-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Unassigned Flights</span>
            <span className={cn('font-mono font-semibold tabular-nums', unassignedCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground/50')}>
              {unassignedCount}
            </span>
          </div>
        </div>
      </div>

      {/* ═══ RIGHT PANEL ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 gap-4">
        {selectedRoute && form ? (
          <>
            {/* ── ROUTE HEADER ── */}
            <div className="shrink-0 glass rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Route</label>
                  <input type="text" value={form.routeName} onChange={e => updateForm({ routeName: e.target.value })}
                    placeholder="RT-SGN-HAN-01" className={cn(inputClass, 'w-full max-w-[260px] font-mono font-semibold')} />
                </div>
                <div className="shrink-0 flex items-center gap-3">
                  <div className="text-right">
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Status</label>
                    <div className="flex items-center gap-1.5 h-8 px-2">
                      <div className={cn('w-2 h-2 rounded-full', form.status === 'published' ? 'bg-emerald-500' : 'bg-gray-400')} />
                      <span className="text-sm font-medium capitalize">{form.status}</span>
                      {!isDirty && selectedRouteId && (
                        <button onClick={() => setShowPublishDialog(true)} disabled={saving}
                          className="ml-1 text-[11px] text-primary/70 hover:text-primary underline underline-offset-2 transition-colors disabled:opacity-50">
                          {form.status === 'published' ? 'Unpublish' : 'Publish'}
                        </button>
                      )}
                    </div>
                  </div>
                  {selectedRouteId && (
                    <button onClick={() => setShowDeleteDialog(true)} disabled={saving}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground/30 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                      title="Delete route">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Aircraft Type</label>
                  <select value={form.aircraftTypeId} onChange={e => {
                    const at = aircraftTypes.find(t => t.id === e.target.value)
                    updateForm({ aircraftTypeId: e.target.value, aircraftTypeIcao: at?.icao_type || '' })
                  }} className={cn(inputClass, 'w-full max-w-[260px]')}>
                    <option value="">&mdash; Select &mdash;</option>
                    {aircraftTypes.filter(t => t.is_active).map(t => <option key={t.id} value={t.id}>{t.icao_type} — {t.name}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Season</label>
                  <select value={form.seasonId} onChange={e => updateForm({ seasonId: e.target.value })} className={cn(inputClass, 'w-full max-w-[260px]')}>
                    {seasons.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Period</label>
                  <div className="flex items-center gap-2">
                    <input type="date" value={form.periodStart} onChange={e => updateForm({ periodStart: e.target.value })} className={cn(inputClass, 'w-[145px]')} />
                    <span className="text-xs text-muted-foreground">&mdash;</span>
                    <input type="date" value={form.periodEnd} onChange={e => updateForm({ periodEnd: e.target.value })} className={cn(inputClass, 'w-[145px]')} />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Days</label>
                  <DowCirclesInteractive value={form.daysOfOperation} onChange={v => updateForm({ daysOfOperation: v })} />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-1 border-t border-black/[0.04] dark:border-white/[0.04]">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">Chain:</span>
                  <span className="text-[13px] font-mono font-medium">{chain || 'No legs'}{isRoundTrip && ' \ud83d\udd04'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">Duration:</span>
                  <span className="text-[13px] font-medium">{durationLabel(routeDuration)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">Total Block:</span>
                  <span className="text-[13px] font-mono font-medium">{minutesToHHMM(totalBlock) || '\u2014'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">Legs:</span>
                  <span className="text-[13px] font-mono font-medium">{legs.length}</span>
                </div>
              </div>
            </div>

            {/* ── LEGS TABLE ── */}
            <div className="flex-1 glass rounded-2xl flex flex-col overflow-hidden min-h-0">
              <div className="shrink-0 px-5 pt-4 pb-2">
                <h3 className="text-sm font-semibold">Route Legs</h3>
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-4 custom-scrollbar">
                <table className="w-full">
                  <thead>
                    <tr className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider border-b border-black/[0.06] dark:border-white/[0.06]">
                      <th className="w-[20px] py-2"></th>
                      <th className="w-[30px] py-2 text-center">#</th>
                      <th className="w-[40px] py-2 text-center">Day</th>
                      <th className="w-[80px] py-2 text-left pl-2">Flt No</th>
                      <th className="w-[50px] py-2 text-center">DEP</th>
                      <th className="w-[50px] py-2 text-center">ARR</th>
                      <th className="w-[55px] py-2 text-center">STD</th>
                      <th className="w-[65px] py-2 text-center">STA</th>
                      <th className="w-[55px] py-2 text-center">Block</th>
                      <th className="w-[50px] py-2 text-center">Status</th>
                      <th className="w-[20px] py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {legs.length === 0 && !isAdding && (
                      <tr><td colSpan={11} className="text-center py-8 text-sm text-muted-foreground">No legs in this route</td></tr>
                    )}
                    {legs.map((leg, idx) => {
                      const fltLabel = leg.airline_code && leg.flight_number != null
                        ? `${leg.airline_code}${leg.flight_number}` : '\u2014'
                      const isDropTarget = dropIdx === idx && dragIdx !== null && dragIdx !== idx

                      return (
                        <LegRow
                          key={leg.id}
                          leg={leg}
                          index={idx}
                          flightLabel={fltLabel}
                          validation={legValidations[idx]}
                          onDelete={() => deleteLeg(leg.id)}
                          editingCell={editingCell}
                          editValue={editValue}
                          onStartEdit={startEdit}
                          onEditChange={setEditValue}
                          onCommitEdit={commitEdit}
                          onCancelEdit={cancelEdit}
                          operatorIataCode={operatorIataCode}
                          airportIataSet={airportIataSet}
                          cellInputClass={cellInputClass}
                          onDragStart={() => handleDragStart(idx)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDrop={() => handleDrop(idx)}
                          isDropTarget={isDropTarget}
                        />
                      )
                    })}

                    {isAdding && (
                      <AddLegRow
                        draft={draft}
                        setDraft={setDraft}
                        index={legs.length}
                        operatorIataCode={operatorIataCode}
                        airportIataSet={airportIataSet}
                        onConfirm={confirmAddLeg}
                        onCancel={() => { setIsAdding(false); setDraft(emptyDraft()) }}
                        cellInputClass={cellInputClass}
                        validation={draftValidation}
                      />
                    )}
                  </tbody>
                </table>

                {!isAdding && (
                  <div className="mt-3">
                    <button onClick={startAddLeg} disabled={hasRedErrors}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-dashed transition-colors',
                        hasRedErrors
                          ? 'text-muted-foreground/30 border-black/[0.04] dark:border-white/[0.04] cursor-not-allowed'
                          : 'text-muted-foreground hover:text-foreground border-black/[0.08] dark:border-white/[0.08] hover:border-black/[0.15] dark:hover:border-white/[0.15]'
                      )}>
                      <Plus className="h-3.5 w-3.5" /> Add Leg
                    </button>
                  </div>
                )}

                {hasRedErrors && (
                  <p className="mt-2 text-xs text-red-500">Resolve errors before adding more legs or saving</p>
                )}
              </div>

              {/* Action buttons */}
              <div className="shrink-0 px-5 py-3 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center gap-2">
                <button
                  onClick={handleSaveRoute}
                  disabled={!isDirty || saving || hasRedErrors}
                  className={cn(
                    'h-8 px-4 flex items-center gap-1.5 rounded-lg text-sm font-medium transition-colors',
                    isDirty && !saving && !hasRedErrors
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

            {/* ── RECENT ROUTES ── */}
            <RecentRoutesSection recentRoutes={recentRoutes} selectedRouteId={selectedRouteId} onSelectRoute={handleSelectRoute} />
          </>
        ) : (
          <>
            <div className="flex-1 glass rounded-2xl flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] flex items-center justify-center mb-4">
                <Plane className="h-7 w-7 text-muted-foreground/30" />
              </div>
              <p className="text-sm text-muted-foreground mb-1">Select a route from the left panel</p>
              <p className="text-xs text-muted-foreground/60 mb-4">or create a new one to get started</p>
              <button onClick={handleNewRoute} disabled={loading}
                className="h-8 px-4 flex items-center gap-1.5 rounded-lg bg-[#991b1b] text-white text-sm font-medium hover:bg-[#7f1d1d] transition-colors">
                <Plus className="h-3.5 w-3.5" /> Create New Route
              </button>
            </div>
            <RecentRoutesSection recentRoutes={recentRoutes} selectedRouteId={selectedRouteId} onSelectRoute={handleSelectRoute} />
          </>
        )}
      </div>

      {/* ═══ DIALOGS ═══ */}

      <Dialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <DialogContent className="glass-heavy max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" />Unsaved Changes</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">You have unsaved changes to <span className="font-mono font-semibold">{form?.routeName || 'this route'}</span>.</p>
          <DialogFooter className="gap-2 sm:gap-2">
            <button onClick={() => setShowUnsavedDialog(false)} className="h-8 px-4 rounded-lg border border-black/[0.1] dark:border-white/[0.1] text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 transition-colors">Cancel</button>
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
  leg, index, flightLabel, validation, onDelete,
  editingCell, editValue, onStartEdit, onEditChange, onCommitEdit, onCancelEdit,
  operatorIataCode, airportIataSet, cellInputClass,
  onDragStart, onDragOver, onDrop, isDropTarget,
}: {
  leg: LegWithOffsets
  index: number
  flightLabel: string
  validation: LegValidation
  onDelete: () => void
  editingCell: { legId: string; field: string } | null
  editValue: string
  onStartEdit: (legId: string, field: string, value: string) => void
  onEditChange: (v: string) => void
  onCommitEdit: () => void
  onCancelEdit: () => void
  operatorIataCode: string
  airportIataSet: Set<string>
  cellInputClass: string
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  isDropTarget: boolean
}) {
  const isEditing = (field: string) => editingCell?.legId === leg.id && editingCell?.field === field
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onCommitEdit()
    if (e.key === 'Escape') onCancelEdit()
  }

  function renderEditableCell(field: string, displayValue: string, rawValue: string, width: string, extraClass?: string) {
    if (isEditing(field)) {
      return (
        <input autoFocus value={editValue}
          onChange={e => onEditChange(field === 'dep_station' || field === 'arr_station' ? e.target.value.toUpperCase() : e.target.value)}
          onBlur={onCommitEdit} onKeyDown={handleKeyDown}
          className={cn(cellInputClass, 'text-[13px] text-center', width, extraClass)} style={{ width }} />
      )
    }
    const invalid = (field === 'dep_station' || field === 'arr_station') && displayValue.length === 3 && !airportIataSet.has(displayValue)
    return (
      <span onClick={() => onStartEdit(leg.id, field, rawValue)}
        className={cn('cursor-text hover:bg-black/[0.04] dark:hover:bg-white/[0.06] rounded px-0.5 -mx-0.5 transition-colors',
          invalid && 'text-red-500 underline decoration-red-300 decoration-wavy underline-offset-2')}>
        {displayValue || '\u2014'}
      </span>
    )
  }

  return (
    <tr
      className={cn('group hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors', isDropTarget && 'border-t-2 border-t-primary')}
      draggable onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}
    >
      <td className="py-2 text-center">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-colors cursor-grab mx-auto" />
      </td>
      <td className="py-2 text-center text-[12px] font-mono text-muted-foreground tabular-nums">{index + 1}</td>
      <td className="py-2 text-center text-[12px] font-mono text-muted-foreground/60 tabular-nums">D+{leg._dayOffset}</td>
      <td className="py-2 pl-2 text-[13px] font-mono font-bold tabular-nums">
        {renderEditableCell('flight_number', flightLabel, leg.flight_number != null ? String(leg.flight_number) : '', '70px', 'font-bold text-left')}
      </td>
      <td className="py-2 text-center text-[13px] font-mono tabular-nums">
        {renderEditableCell('dep_station', leg.dep_station, leg.dep_station, '45px')}
      </td>
      <td className="py-2 text-center text-[13px] font-mono tabular-nums">
        {renderEditableCell('arr_station', leg.arr_station, leg.arr_station, '45px')}
      </td>
      <td className="py-2 text-center text-[13px] font-mono tabular-nums">
        {renderEditableCell('std_local', leg.std_local, leg.std_local, '50px')}
      </td>
      <td className="py-2 text-center text-[13px] font-mono tabular-nums">
        {renderEditableCell('sta_local', leg.sta_local, leg.sta_local, '50px')}
        {!isEditing('sta_local') && leg._arrivesNextDay && (
          <sup className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 ml-0.5">+1</sup>
        )}
      </td>
      <td className="py-2 text-center text-[13px] font-mono tabular-nums text-muted-foreground">
        {minutesToHHMM(leg.block_minutes || 0)}
      </td>
      <td className="py-2 text-center">
        {validation && (
          <ValidationTooltip legIndex={index} flightLabel={flightLabel} validation={validation}>
            <StatusIconForOverall overall={validation.overall} />
          </ValidationTooltip>
        )}
      </td>
      <td className="py-2 text-center">
        <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 transition-opacity" title="Delete leg">
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground/40 hover:text-red-500 transition-colors mx-auto" />
        </button>
      </td>
    </tr>
  )
}

// ─── Add Leg Entry Row ────────────────────────────────────────

function AddLegRow({
  draft, setDraft, index, operatorIataCode, airportIataSet, onConfirm, onCancel, cellInputClass, validation,
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
}) {
  const fltRef = useRef<HTMLInputElement>(null!)
  useEffect(() => { fltRef.current?.focus() }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
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

  return (
    <>
      <tr className="bg-primary/[0.03]">
        <td className="py-2 text-center"><Plus className="h-3 w-3 text-primary/40 mx-auto" /></td>
        <td className="py-2 text-center text-[12px] font-mono text-muted-foreground/50 tabular-nums">{index + 1}</td>
        <td className="py-2 text-center text-[12px] font-mono text-muted-foreground/40 tabular-nums">D+?</td>

        <td className="py-2 pl-2">
          <div className="flex items-center gap-0.5">
            <span className="text-[11px] text-muted-foreground/50 font-mono">{operatorIataCode}</span>
            <input ref={fltRef} type="text" value={draft.flightNumber}
              onChange={e => update({ flightNumber: e.target.value.replace(/\D/g, '') })}
              onKeyDown={handleKeyDown} placeholder="121"
              className={cn(cellInputClass, 'text-[13px] w-[50px] font-bold', errBorder('flightNumber'))} />
          </div>
        </td>

        <td className="py-2 text-center">
          <input type="text" value={draft.depStation}
            onChange={e => update({ depStation: e.target.value.toUpperCase().slice(0, 3), _autoFilledDep: false })}
            onKeyDown={handleKeyDown} placeholder="DEP" maxLength={3}
            className={cn(cellInputClass, 'text-[13px] w-[45px] text-center', errBorder('depStation'),
              draft._autoFilledDep && 'italic text-[#9ca3af]', depInvalid && 'text-red-500')} />
        </td>

        <td className="py-2 text-center">
          <input type="text" value={draft.arrStation}
            onChange={e => update({ arrStation: e.target.value.toUpperCase().slice(0, 3) })}
            onKeyDown={handleKeyDown} placeholder="ARR" maxLength={3}
            className={cn(cellInputClass, 'text-[13px] w-[45px] text-center', errBorder('arrStation'), arrInvalid && 'text-red-500')} />
        </td>

        <td className="py-2 text-center">
          <input type="text" value={draft.stdLocal}
            onChange={e => update({ stdLocal: e.target.value, _autoFilledStd: false })}
            onBlur={() => { if (draft.stdLocal) update({ stdLocal: normalizeTime(draft.stdLocal) }) }}
            onKeyDown={handleKeyDown} placeholder="HH:MM"
            className={cn(cellInputClass, 'text-[13px] w-[50px] text-center', errBorder('stdLocal'),
              draft._autoFilledStd && 'italic text-[#9ca3af]')} />
        </td>

        <td className="py-2 text-center">
          <input type="text" value={draft.staLocal}
            onChange={e => update({ staLocal: e.target.value })}
            onBlur={() => { if (draft.staLocal) update({ staLocal: normalizeTime(draft.staLocal) }) }}
            onKeyDown={handleKeyDown} placeholder="HH:MM"
            className={cn(cellInputClass, 'text-[13px] w-[50px] text-center', errBorder('staLocal'))} />
        </td>

        <td className="py-2 text-center text-[13px] font-mono tabular-nums text-muted-foreground/50">
          {blockMin > 0 ? minutesToHHMM(blockMin) : '--:--'}
        </td>

        <td className="py-2 text-center">
          {validation ? (
            <ValidationTooltip legIndex={index} flightLabel={fltLabel} validation={validation} duplicateLine={dupLine}>
              <StatusIconForOverall overall={validation.overall} />
            </ValidationTooltip>
          ) : (
            <StatusGray />
          )}
        </td>

        <td className="py-2 text-center">
          <button onClick={onCancel} disabled={draft._checking} className="text-muted-foreground/40 hover:text-red-500 transition-colors disabled:opacity-30" title="Cancel">
            <Trash2 className="h-3.5 w-3.5 mx-auto" />
          </button>
        </td>
      </tr>

      {(draft._duplicateError || draft._checking) && (
        <tr className="bg-primary/[0.03]">
          <td colSpan={11} className="py-0 pb-2">
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

// ─── Recent Routes Section ───────────────────────────────────

function RecentRoutesSection({
  recentRoutes, selectedRouteId, onSelectRoute,
}: {
  recentRoutes: RecentRoute[]
  selectedRouteId: string | null
  onSelectRoute: (id: string) => void
}) {
  return (
    <div className="shrink-0 glass rounded-2xl px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-medium text-muted-foreground">Recent Routes</h3>
      </div>
      {recentRoutes.length === 0 ? (
        <p className="text-xs text-muted-foreground/50 py-2">Routes you create will appear here for quick access</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1 custom-scrollbar">
          {recentRoutes.map(route => (
            <RecentRouteCard key={route.id} route={route} isActive={route.id === selectedRouteId} onClick={() => onSelectRoute(route.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function RecentRouteCard({ route, isActive, onClick }: { route: RecentRoute; isActive: boolean; onClick: () => void }) {
  const chainCompact = route.chain
    ? (route.is_round_trip
        ? route.chain.split(' \u2192 ')[0] + ' \u2194 ' + (route.chain.split(' \u2192 ')[1] || '')
        : route.chain.replace(/ \u2192 /g, '\u2192'))
    : 'No legs'

  return (
    <button onClick={onClick}
      className={cn(
        'shrink-0 min-w-[150px] rounded-xl p-3 text-left transition-all duration-150 hover:shadow-md',
        'bg-white/40 dark:bg-white/[0.04] border',
        isActive ? 'border-[#991b1b]/40 shadow-sm' : 'border-black/[0.06] dark:border-white/[0.06] hover:border-black/[0.12] dark:hover:border-white/[0.12]'
      )}>
      <div className="text-[12px] font-semibold font-mono truncate mb-1">{route.route_name || 'Untitled'}</div>
      <div className="text-[11px] text-muted-foreground font-mono truncate mb-1.5">{chainCompact} {route.is_round_trip ? '\ud83d\udd04' : ''}</div>
      <div className="text-[10px] text-muted-foreground/70 tabular-nums mb-1.5">{route.leg_count} leg{route.leg_count !== 1 ? 's' : ''} {minutesToHHMM(route.total_block_minutes)}</div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {route.aircraft_type_icao && <span className="text-[10px] font-mono text-muted-foreground/60">{route.aircraft_type_icao}</span>}
          <DowDotsTiny value={route.days_of_operation} />
        </div>
        <div className="flex items-center gap-1">
          <div className={cn('w-[5px] h-[5px] rounded-full', route.status === 'published' ? 'bg-emerald-500' : 'bg-gray-400')} />
          <span className="text-[9px] text-muted-foreground/60 capitalize">{route.status}</span>
        </div>
      </div>
    </button>
  )
}

// ─── Route Item (left panel) ──────────────────────────────────

function RouteItem({ route, isSelected, onClick }: { route: AircraftRoute; isSelected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={cn('w-full text-left rounded-xl px-3 py-2 transition-all duration-150 group',
        isSelected ? 'bg-[#991b1b]/10 dark:bg-[#991b1b]/20 border-l-[3px] border-l-[#991b1b]'
          : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.05] border-l-[3px] border-l-transparent')}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className={cn('text-[13px] font-semibold font-mono', isSelected ? 'text-[#991b1b]' : 'text-foreground')}>
          {route.route_name || `Route ${route.route_number}`}
        </span>
        {route.is_round_trip && <span className="text-[10px] text-muted-foreground" title="Round trip">{'\ud83d\udd04'}</span>}
        {route.status === 'published' && <div className="w-[5px] h-[5px] rounded-full bg-emerald-500 shrink-0" title="Published" />}
      </div>
      <div className="text-[11px] text-muted-foreground mb-1.5 truncate font-mono">{route.chain || 'No legs'}</div>
      <div className="flex items-center justify-between gap-2">
        <DowCirclesSmall value={route.days_of_operation} />
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70 tabular-nums">
          <span>{route.legs.length} leg{route.legs.length !== 1 ? 's' : ''}</span>
          <span>{minutesToHHMM(route.total_block_minutes)}</span>
        </div>
      </div>
    </button>
  )
}
