'use client'

import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react'
import { ScheduleSeason, AircraftType, Airport, CityPair, FlightServiceType, AirportTatRule } from '@/types/database'
import { getFlightNumbers } from '@/app/actions/flight-numbers'
import { saveFlightNumber, deleteFlightNumbers, bulkUpdateFlightNumbers } from '@/app/actions/flight-numbers'
import { type ScheduleBlockLookup, type CityPairWithAirports, createCityPairFromIata } from '@/app/actions/city-pairs'
import { Button } from '@/components/ui/button'
import { cn, minutesToHHMM } from '@/lib/utils'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Download, Upload, RotateCcw, Trash2, AlertTriangle, Copy, Clock, Loader2 } from 'lucide-react'
import { toast } from '@/components/ui/visionos-toast'
import { friendlyError } from '@/lib/utils/error-handler'
import { AIRPORT_COUNTRY } from '@/lib/data/airport-countries'

// ─── Types ────────────────────────────────────────────────────
interface FlightRow {
  id: string
  flight_number: string
  departure_iata: string
  arrival_iata: string
  std: string            // local time HHMM
  sta: string            // local time HHMM
  std_utc: string        // UTC time HHMM
  sta_utc: string        // UTC time HHMM
  block_minutes: number
  days_of_week: string
  aircraft_type_id: string
  aircraft_type_icao: string
  service_type: string
  effective_from: string
  effective_until: string
  arrival_day_offset: number
  connecting_flight: string
  _isNew: boolean
  _isDirty: boolean
  _isSaving: boolean
  _savedFlash: boolean
  _errors: Record<string, string>
  _selected: boolean
  _autoFilled: Record<string, boolean>
}

interface FlightPairGroup {
  outbound: FlightRow[]
  inbound: FlightRow[]
}

interface ScheduleBuilderProps {
  seasons: ScheduleSeason[]
  aircraftTypes: AircraftType[]
  airports: Airport[]
  flightServiceTypes: FlightServiceType[]
  cityPairs: CityPairWithAirports[]
  blockLookup?: ScheduleBlockLookup[]
  tatRules: AirportTatRule[]
  operatorIataCode: string
  operatorTimezone?: string
  readOnly?: boolean
}

type TimeMode = 'utc' | 'local_station' | 'local_base'

// ─── Constants ────────────────────────────────────────────────
const EDITABLE_COLS = [
  'flight_number', 'departure_iata', 'arrival_iata', 'std', 'sta',
  'block_minutes', 'aircraft_type_id', 'service_type', 'effective_from', 'effective_until',
] as const

function emptyRow(): FlightRow {
  return {
    id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    flight_number: '', departure_iata: '', arrival_iata: '',
    std: '', sta: '', std_utc: '', sta_utc: '', block_minutes: 0, days_of_week: '1234567',
    aircraft_type_id: '', aircraft_type_icao: '', service_type: 'J',
    effective_from: '', effective_until: '', arrival_day_offset: 0, connecting_flight: '',
    _isNew: true, _isDirty: false, _isSaving: false, _savedFlash: false,
    _errors: {}, _selected: false, _autoFilled: {},
  }
}

// ─── Helpers ──────────────────────────────────────────────────
function normalizeTime(input: string): string {
  const d = input.replace(/[^0-9]/g, '')
  if (d.length === 3) return '0' + d
  if (d.length === 4) return d
  if (d.length === 1 || d.length === 2) return d.padStart(2, '0') + '00'
  return d.slice(0, 4)
}

function isValidTime(t: string): boolean {
  if (!/^\d{4}$/.test(t)) return false
  const h = parseInt(t.slice(0, 2)), m = parseInt(t.slice(2))
  return h >= 0 && h <= 23 && m >= 0 && m <= 59
}

function timeToMinutes(t: string): number {
  return parseInt(t.slice(0, 2)) * 60 + parseInt(t.slice(2))
}

function minutesToTime(m: number): string {
  const wrapped = ((m % 1440) + 1440) % 1440
  return String(Math.floor(wrapped / 60)).padStart(2, '0') + String(wrapped % 60).padStart(2, '0')
}

function calcBlockMinutes(std: string, sta: string, dayOff: number): number {
  if (!isValidTime(std) || !isValidTime(sta)) return 0
  return timeToMinutes(sta) - timeToMinutes(std) + dayOff * 1440
}

function calcArrivalDayOffset(std: string, sta: string): number {
  if (!isValidTime(std) || !isValidTime(sta)) return 0
  return timeToMinutes(sta) < timeToMinutes(std) ? 1 : 0
}

function normalizeFltNum(input: string, prefix: string): string {
  const t = input.trim().toUpperCase()
  if (/^\d{1,4}$/.test(t)) return prefix + t
  return t
}

function isValidFltNum(fn: string, prefix: string): boolean {
  return new RegExp(`^${prefix}\\d{1,4}$`).test(fn)
}

function getReturnFltNum(fn: string, prefix: string): string {
  const numStr = fn.replace(prefix, '')
  return prefix + String(parseInt(numStr) + 1)
}

// ─── Display Helpers ─────────────────────────────────────────
function formatTimeDisplay(hhmm: string): string {
  if (!hhmm || hhmm.length !== 4) return hhmm
  return hhmm.slice(0, 2) + ':' + hhmm.slice(2)
}

function formatBlockTime(minutes: number): string {
  if (!minutes) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0')
}

function parseBlockInput(input: string): number {
  const trimmed = input.trim()
  if (!trimmed) return 0
  if (/^\d+m$/i.test(trimmed)) return parseInt(trimmed) || 0
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [h, m] = trimmed.split(':').map(Number)
    return h * 60 + m
  }
  if (/^\d{3,4}$/.test(trimmed)) {
    const h = parseInt(trimmed.slice(0, -2))
    const m = parseInt(trimmed.slice(-2))
    if (m < 60) return h * 60 + m
  }
  return parseInt(trimmed) || 0
}

function formatDateDisplay(iso: string): string {
  if (!iso) return ''
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return `${match[3]}/${match[2]}/${match[1]}`
  return iso
}

function convertUtcToTimezone(hhmm: string, timezone: string): string {
  if (!hhmm || hhmm.length !== 4 || !timezone) return hhmm
  try {
    const h = parseInt(hhmm.slice(0, 2)), m = parseInt(hhmm.slice(2))
    const utcDate = new Date(Date.UTC(2026, 0, 1, h, m))
    const parts = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone,
    }).formatToParts(utcDate)
    const hour = parts.find(p => p.type === 'hour')?.value || '00'
    const minute = parts.find(p => p.type === 'minute')?.value || '00'
    return hour + minute
  } catch {
    return hhmm
  }
}

// ─── DOW Helpers ─────────────────────────────────────────────
function isDayActive(value: string, pos: number): boolean {
  return value.charAt(pos) === String(pos + 1)
}

function toggleDow(value: string, pos: number): string {
  const chars = value.padEnd(7, ' ').split('')
  const d = String(pos + 1)
  chars[pos] = isDayActive(value, pos) ? ' ' : d
  return chars.join('')
}

function validateRow(row: FlightRow, allRows: FlightRow[], prefix: string): Record<string, string> {
  const e: Record<string, string> = {}
  if (row.flight_number && !isValidFltNum(row.flight_number, prefix)) e.flight_number = 'Invalid format'
  if (row.departure_iata && row.arrival_iata && row.departure_iata === row.arrival_iata) e.arrival_iata = 'Same as DEP'
  if (row.std && !isValidTime(row.std)) e.std = 'Invalid time'
  if (row.sta && !isValidTime(row.sta)) e.sta = 'Invalid time'
  if (row.block_minutes && (row.block_minutes < 30 || row.block_minutes > 1200)) e.block_minutes = '30-1200 min'
  return e
}

// ─── Flight Pairing / Grouping ──────────────────────────────
function groupAndPairFlights(flights: FlightRow[]): FlightPairGroup[] {
  const dataFlights = flights.filter(f => !f._isNew && f.flight_number)

  // Group by flight number
  const byNumber = new Map<string, FlightRow[]>()
  for (const f of dataFlights) {
    const key = f.flight_number
    if (!byNumber.has(key)) byNumber.set(key, [])
    byNumber.get(key)!.push(f)
  }

  // Sort group keys by numeric portion
  const sortedKeys = Array.from(byNumber.keys()).sort((a, b) => {
    const aNum = parseInt(a.replace(/\D/g, '')) || 0
    const bNum = parseInt(b.replace(/\D/g, '')) || 0
    return aNum - bNum
  })

  const used = new Set<string>()
  const groups: FlightPairGroup[] = []

  for (const key of sortedKeys) {
    if (used.has(key)) continue
    used.add(key)

    const outFlights = byNumber.get(key)!
    const sample = outFlights[0]
    const match = sample.flight_number.match(/^([A-Z]{2})(\d+)$/)

    if (!match) {
      groups.push({ outbound: outFlights, inbound: [] })
      continue
    }

    const prefix = match[1]
    const num = parseInt(match[2])
    let inFlights: FlightRow[] = []

    // Strategy 1: sequential flight number (n+1), reverse route
    const returnKey = prefix + (num + 1)
    if (byNumber.has(returnKey) && !used.has(returnKey)) {
      const candidates = byNumber.get(returnKey)!
      const isReturn = candidates.some(c =>
        c.departure_iata === sample.arrival_iata && c.arrival_iata === sample.departure_iata
      )
      if (isReturn) {
        inFlights = candidates
        used.add(returnKey)
      }
    }

    // Strategy 2: if current is odd, check n-1 as outbound
    if (inFlights.length === 0 && num % 2 === 1) {
      const prevKey = prefix + (num - 1)
      if (byNumber.has(prevKey) && !used.has(prevKey)) {
        const candidates = byNumber.get(prevKey)!
        const isMatch = candidates.some(c =>
          c.departure_iata === sample.arrival_iata && c.arrival_iata === sample.departure_iata
        )
        if (isMatch) {
          // The lower number is outbound
          groups.push({ outbound: candidates, inbound: outFlights })
          used.add(prevKey)
          continue
        }
      }
    }

    // Strategy 3: any flight with reverse route, same AC type, same period
    if (inFlights.length === 0) {
      for (const otherKey of sortedKeys) {
        if (used.has(otherKey) || otherKey === key) continue
        const others = byNumber.get(otherKey)!
        const isReturn = others.some(c =>
          c.departure_iata === sample.arrival_iata &&
          c.arrival_iata === sample.departure_iata &&
          c.aircraft_type_id === sample.aircraft_type_id
        )
        if (isReturn) {
          inFlights = others
          used.add(otherKey)
          break
        }
      }
    }

    groups.push({ outbound: outFlights, inbound: inFlights })
  }

  return groups
}

// ─── DOW Display (circles with active/inactive) ─────────────
function DowDisplay({ value, onChange }: { value: string; onChange?: (v: string) => void }) {
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  return (
    <div className="flex items-center gap-0.5">
      {labels.map((label, i) => {
        const active = isDayActive(value, i)
        return (
          <button
            key={i}
            type="button"
            onClick={onChange ? () => onChange(toggleDow(value, i)) : undefined}
            className={cn(
              'w-[22px] h-[22px] rounded-full text-[10px] font-semibold leading-none flex items-center justify-center transition-colors select-none',
              active
                ? 'bg-primary text-primary-foreground'
                : 'bg-transparent text-[#d1d5db] border-[1.5px] border-[#e5e7eb]',
              onChange && active && 'hover:bg-primary/80',
              onChange && !active && 'hover:border-[#d1d5db] hover:text-[#9ca3af]',
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ─── DOW Selector (for bulk edit dialogs) ────────────────────
function DowSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex gap-0.5">
        {labels.map((label, i) => {
          const active = isDayActive(value, i)
          return (
            <button key={i} type="button" onClick={() => onChange(toggleDow(value, i))}
              className={cn('w-5 h-5 rounded-full text-[10px] font-bold leading-none flex items-center justify-center transition-colors',
                active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground/50'
              )}>
              {label}
            </button>
          )
        })}
      </div>
      <span className="font-mono text-[9px] text-muted-foreground leading-none">
        {value.split('').map((ch, i) => isDayActive(value, i) ? String(i + 1) : '·').join('')}
      </span>
    </div>
  )
}

// ─── Import Dialog ────────────────────────────────────────────
function ImportDialog({ open, onClose, onImport, prefix }: {
  open: boolean; onClose: () => void
  onImport: (rows: Partial<FlightRow>[]) => void; prefix: string
}) {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<Partial<FlightRow>[]>([])

  useEffect(() => {
    if (!text.trim()) { setPreview([]); return }
    const lines = text.trim().split('\n').filter(l => l.trim())
    const rows: Partial<FlightRow>[] = lines.map(line => {
      const cols = line.split('\t')
      const fn = cols[0]?.trim() || ''
      return {
        flight_number: normalizeFltNum(fn, prefix),
        departure_iata: cols[1]?.trim().toUpperCase() || '',
        arrival_iata: cols[2]?.trim().toUpperCase() || '',
        std: normalizeTime(cols[3]?.trim() || ''),
        sta: normalizeTime(cols[4]?.trim() || ''),
        days_of_week: cols[5]?.trim() || '1234567',
        aircraft_type_id: '',
        service_type: cols[7]?.trim().toUpperCase() || 'J',
      }
    })
    setPreview(rows)
  }, [text, prefix])

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import from Excel</DialogTitle>
          <DialogDescription>
            Paste tab-separated data. Columns: Flt. No, DEP, ARR, STD, STA, Day of Week, AC Type/Reg, Service Type
          </DialogDescription>
        </DialogHeader>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={8} placeholder="Paste flight data here..."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" />
        {preview.length > 0 && (
          <div className="rounded border overflow-auto max-h-48">
            <table className="w-full text-xs font-mono">
              <thead><tr className="bg-muted"><th className="p-1">Flt. No</th><th className="p-1">DEP</th><th className="p-1">ARR</th><th className="p-1">STD</th><th className="p-1">STA</th><th className="p-1">Day of Week</th><th className="p-1">Service Type</th></tr></thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className="border-t"><td className="p-1">{r.flight_number}</td><td className="p-1">{r.departure_iata}</td><td className="p-1">{r.arrival_iata}</td><td className="p-1">{r.std}</td><td className="p-1">{r.sta}</td><td className="p-1">{r.days_of_week}</td><td className="p-1">{r.service_type}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={preview.length === 0} onClick={() => { onImport(preview); onClose(); setText('') }}>
            Import {preview.length} flight{preview.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Component ───────────────────────────────────────────
export function ScheduleBuilder({
  seasons, aircraftTypes, airports, flightServiceTypes, cityPairs, blockLookup,
  tatRules, operatorIataCode, operatorTimezone, readOnly = false,
}: ScheduleBuilderProps) {
  const prefix = operatorIataCode || 'HZ'

  // ── State ──
  const [timeMode, setTimeMode] = useState<TimeMode>('utc')
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; rowIndex: number | null }>({ open: false, rowIndex: null })
  const [seasonId, setSeasonId] = useState(() => {
    const active = seasons.find(s => s.status === 'active') || seasons.find(s => s.status === 'draft') || seasons[0]
    return active?.id || ''
  })
  const [flights, setFlights] = useState<FlightRow[]>(readOnly ? [] : [emptyRow()])
  const [loading, setLoading] = useState(false)
  const [activeCell, setActiveCell] = useState<{ row: number; col: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [filters, setFilters] = useState({ aircraftType: '', departure: '', serviceType: '' })
  const [showBulkAcType, setShowBulkAcType] = useState(false)
  const [showBulkSvc, setShowBulkSvc] = useState(false)
  const [showBulkDow, setShowBulkDow] = useState(false)
  const [bulkValue, setBulkValue] = useState('')

  const flightsRef = useRef(flights)
  useEffect(() => { flightsRef.current = flights }, [flights])
  const saveTimeouts = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Lookups ──
  const iataToIcao = useMemo(() => {
    const m = new Map<string, string>()
    airports.forEach(a => { if (a.iata_code) m.set(a.iata_code, a.icao_code) })
    return m
  }, [airports])

  const iataToAirportId = useMemo(() => {
    const m = new Map<string, string>()
    airports.forEach(a => { if (a.iata_code) m.set(a.iata_code, a.id) })
    return m
  }, [airports])

  const iataToCountry = useMemo(() => {
    const m = new Map<string, string>()
    // Primary: hardcoded IATA → ISO country lookup (reliable)
    for (const [iata, cc] of Object.entries(AIRPORT_COUNTRY)) m.set(iata, cc)
    // Fallback: DB country field for airports not in the hardcoded map
    airports.forEach(a => { if (a.iata_code && a.country && !m.has(a.iata_code)) m.set(a.iata_code, a.country) })
    return m
  }, [airports])

  const blockTimeMap = useMemo(() => {
    const m = new Map<string, { block_time: number; flight_minutes: number | null; distance: number }>()
    if (blockLookup) {
      for (const bl of blockLookup) {
        const key = `${bl.dep_iata}-${bl.arr_iata}`
        if (!m.has(key) || m.get(key)!.block_time < bl.block_minutes) {
          m.set(key, { block_time: bl.block_minutes, flight_minutes: bl.flight_minutes ?? null, distance: bl.distance_nm })
        }
      }
    }
    if (m.size === 0) {
      for (const cp of cityPairs) {
        const dep = cp.airport1?.iata_code
        const arr = cp.airport2?.iata_code
        if (dep && arr && cp.great_circle_distance_nm) {
          m.set(`${dep}-${arr}`, { block_time: cp.standard_block_minutes || 0, flight_minutes: null, distance: cp.great_circle_distance_nm || 0 })
          m.set(`${arr}-${dep}`, { block_time: cp.standard_block_minutes || 0, flight_minutes: null, distance: cp.great_circle_distance_nm || 0 })
        }
      }
    }
    return m
  }, [cityPairs, blockLookup])

  const existingPairSet = useMemo(() => {
    const s = new Set<string>()
    for (const cp of cityPairs) {
      const a1 = cp.airport1?.iata_code
      const a2 = cp.airport2?.iata_code
      if (a1 && a2) { s.add(`${a1}-${a2}`); s.add(`${a2}-${a1}`) }
    }
    return s
  }, [cityPairs])

  const [missingPairBanners, setMissingPairBanners] = useState<Map<string, { dep: string; arr: string; creating: boolean }>>(new Map())

  const tatMap = useMemo(() => {
    const m = new Map<string, number>()
    tatRules.forEach(r => m.set(`${r.airport_id}-${r.aircraft_type_id}`, r.tat_minutes))
    return m
  }, [tatRules])

  const acTypeMap = useMemo(() => {
    const m = new Map<string, AircraftType>()
    aircraftTypes.forEach(t => m.set(t.id, t))
    return m
  }, [aircraftTypes])

  // Deduplicated aircraft types for dropdowns (unique by icao_type)
  const uniqueAcTypes = useMemo(() => {
    const seen = new Set<string>()
    return aircraftTypes.filter(t => {
      if (seen.has(t.icao_type)) return false
      seen.add(t.icao_type)
      return true
    })
  }, [aircraftTypes])

  const airportTzMap = useMemo(() => {
    const m = new Map<string, string>()
    airports.forEach(a => { if (a.iata_code && a.timezone) m.set(a.iata_code, a.timezone) })
    return m
  }, [airports])

  const currentSeason = useMemo(() => seasons.find(s => s.id === seasonId) || null, [seasons, seasonId])

  // ── Time display ──
  function formatTimeForDisplay(row: FlightRow, field: 'std' | 'sta'): string {
    if (timeMode === 'utc') {
      const utcVal = field === 'std' ? row.std_utc : row.sta_utc
      if (utcVal && utcVal.length === 4) return formatTimeDisplay(utcVal)
      return formatTimeDisplay(row[field])
    }
    if (timeMode === 'local_station') {
      return formatTimeDisplay(row[field])
    }
    if (timeMode === 'local_base' && operatorTimezone) {
      const utcVal = field === 'std' ? row.std_utc : row.sta_utc
      if (utcVal && utcVal.length === 4) {
        return formatTimeDisplay(convertUtcToTimezone(utcVal, operatorTimezone))
      }
      return formatTimeDisplay(row[field])
    }
    return formatTimeDisplay(row[field])
  }

  function getTimeHeader(base: string): string {
    if (timeMode === 'utc') return base
    if (timeMode === 'local_station') return `${base} (LCL)`
    return `${base} (BASE)`
  }

  function getFlightTimeMinutes(row: FlightRow): number {
    const key = `${row.departure_iata}-${row.arrival_iata}`
    const lookup = blockTimeMap.get(key)
    if (lookup?.flight_minutes != null && lookup.flight_minutes > 0) return lookup.flight_minutes
    return Math.max(0, row.block_minutes - 15)
  }

  function formatMinutesHHMM(m: number): string {
    if (!m || m <= 0) return ''
    const h = Math.floor(m / 60)
    const min = m % 60
    return `${h}:${String(min).padStart(2, '0')}`
  }

  function getFlightTimeDisplay(row: FlightRow): string {
    if (!row.block_minutes) return ''
    return formatMinutesHHMM(getFlightTimeMinutes(row))
  }

  // ── Lookup functions ──
  function lookupBlock(dep: string, arr: string) {
    const direct = blockTimeMap.get(`${dep}-${arr}`)
    if (direct) return direct
    const reverse = blockTimeMap.get(`${arr}-${dep}`)
    if (reverse) return reverse
    const dIcao = iataToIcao.get(dep), aIcao = iataToIcao.get(arr)
    if (!dIcao || !aIcao) return null
    return blockTimeMap.get(`${dIcao}-${aIcao}`) || blockTimeMap.get(`${aIcao}-${dIcao}`) || null
  }

  function checkCityPairExists(dep: string, arr: string): boolean {
    return existingPairSet.has(`${dep}-${arr}`)
  }

  function fuzzyMatchIata(input: string): string | null {
    if (!input || input.length < 2) return null
    const u = input.toUpperCase()
    if (iataToIcao.has(u)) return u
    const entries = Array.from(iataToIcao.keys())
    for (const iata of entries) {
      if (iata.startsWith(u)) return iata
    }
    return null
  }

  function lookupTat(arrIata: string, acTypeId: string): { minutes: number; source: string } {
    const apId = iataToAirportId.get(arrIata)
    if (apId) {
      const tat = tatMap.get(`${apId}-${acTypeId}`)
      if (tat) return { minutes: tat, source: `${arrIata} airport rule` }
    }
    const acType = acTypeMap.get(acTypeId)
    if (acType?.default_tat_minutes) return { minutes: acType.default_tat_minutes, source: `${acType.icao_type} default` }
    return { minutes: 45, source: 'System default' }
  }

  /** Route-type aware TAT lookup using directional fields */
  function lookupDirectionalTat(
    prevDep: string, prevArr: string, nextDep: string, nextArr: string, acTypeId: string
  ): { minutes: number; source: string } {
    // First try airport-specific rule
    const apId = iataToAirportId.get(nextDep)
    if (apId) {
      const tat = tatMap.get(`${apId}-${acTypeId}`)
      if (tat) return { minutes: tat, source: `${nextDep} airport rule` }
    }

    // Determine route types for directional TAT
    const acType = acTypeMap.get(acTypeId)
    if (acType) {
      const prevDepCountry = iataToCountry.get(prevDep)
      const prevArrCountry = iataToCountry.get(prevArr)
      const nextDepCountry = iataToCountry.get(nextDep)
      const nextArrCountry = nextArr ? iataToCountry.get(nextArr) : nextDepCountry // assume domestic if unknown

      if (prevDepCountry && prevArrCountry && nextDepCountry) {
        const inbound = prevDepCountry === prevArrCountry ? 'dom' : 'int'
        const outbound = nextDepCountry === (nextArrCountry || nextDepCountry) ? 'dom' : 'int'
        const tatField = `tat_${inbound}_${outbound}_minutes` as keyof AircraftType
        const directionalTat = acType[tatField] as number | null
        if (directionalTat && directionalTat > 0) {
          return { minutes: directionalTat, source: `${acType.icao_type} ${inbound.toUpperCase()}→${outbound.toUpperCase()}` }
        }
      }

      if (acType.default_tat_minutes) return { minutes: acType.default_tat_minutes, source: `${acType.icao_type} default` }
    }

    return { minutes: 45, source: 'System default' }
  }

  function suggestAcType(dep: string, arr: string): string {
    const pair = lookupBlock(dep, arr)
    if (!pair) return ''
    if (pair.distance < 1500) return 'A320 / A321'
    if (pair.distance <= 4000) return 'A321 / A330'
    return 'A330'
  }

  // ── Smart row creation (auto-populate from previous row) ──
  function createSmartRow(prevRow: FlightRow | null): FlightRow {
    const row = emptyRow()
    const auto: Record<string, boolean> = {}

    if (prevRow && prevRow.flight_number) {
      // RULE 1: DEP from prev ARR
      if (prevRow.arrival_iata) {
        row.departure_iata = prevRow.arrival_iata
        auto.departure_iata = true
      }

      // RULE 4: DOW from prev
      if (prevRow.days_of_week && prevRow.days_of_week.trim()) {
        row.days_of_week = prevRow.days_of_week
        auto.days_of_week = true
      }

      // RULE 5: AC type from prev
      if (prevRow.aircraft_type_id) {
        row.aircraft_type_id = prevRow.aircraft_type_id
        row.aircraft_type_icao = prevRow.aircraft_type_icao
        auto.aircraft_type_id = true
      }

      // RULE 6: Service type from prev
      if (prevRow.service_type) {
        row.service_type = prevRow.service_type
        auto.service_type = true
      }

      // RULE 3: From/To dates from prev
      if (prevRow.effective_from) {
        row.effective_from = prevRow.effective_from
        auto.effective_from = true
      }
      if (prevRow.effective_until) {
        row.effective_until = prevRow.effective_until
        auto.effective_until = true
      }

      // RULE 2: STD from prev STA + TAT
      if (prevRow.sta && isValidTime(prevRow.sta) && prevRow.aircraft_type_id && prevRow.arrival_iata && prevRow.departure_iata) {
        const tat = lookupDirectionalTat(
          prevRow.departure_iata, prevRow.arrival_iata,
          prevRow.arrival_iata, prevRow.departure_iata, // assume return to same origin
          prevRow.aircraft_type_id
        )
        row.std = minutesToTime(timeToMinutes(prevRow.sta) + tat.minutes)
        auto.std = true

        // Also calculate STA if block time is known for reverse route
        const pair = lookupBlock(prevRow.arrival_iata, prevRow.departure_iata)
        if (pair && pair.block_time > 0) {
          row.sta = minutesToTime(timeToMinutes(row.std) + pair.block_time)
          row.block_minutes = pair.block_time
          row.arrival_day_offset = calcArrivalDayOffset(row.std, row.sta)
          auto.sta = true
          auto.block_minutes = true
        }
      }
    } else if (currentSeason) {
      // RULE 3: First flight - default From/To to season dates
      if (currentSeason.start_date) {
        row.effective_from = typeof currentSeason.start_date === 'string'
          ? currentSeason.start_date
          : String(currentSeason.start_date)
        auto.effective_from = true
      }
      if (currentSeason.end_date) {
        row.effective_until = typeof currentSeason.end_date === 'string'
          ? currentSeason.end_date
          : String(currentSeason.end_date)
        auto.effective_until = true
      }
    }

    row._autoFilled = auto
    return row
  }

  /** Get the last data row (non-new, with flight number) */
  function getLastDataRow(): FlightRow | null {
    const dataRows = flightsRef.current.filter(f => !f._isNew && f.flight_number)
    return dataRows.length > 0 ? dataRows[dataRows.length - 1] : null
  }

  /** Get the row immediately before the given index */
  function getPrevRow(rowIndex: number): FlightRow | null {
    for (let i = rowIndex - 1; i >= 0; i--) {
      if (flightsRef.current[i] && flightsRef.current[i].flight_number) return flightsRef.current[i]
    }
    return null
  }

  // ── Load flights ──
  useEffect(() => {
    if (!seasonId) { setFlights(readOnly ? [] : [emptyRow()]); return }
    setLoading(true)
    getFlightNumbers(seasonId).then(data => {
      const rows: FlightRow[] = data.map(f => ({
        id: f.id,
        flight_number: f.flight_number,
        departure_iata: f.departure_iata || '',
        arrival_iata: f.arrival_iata || '',
        std: f.std,
        sta: f.sta,
        std_utc: f.std_utc || '',
        sta_utc: f.sta_utc || '',
        block_minutes: f.block_minutes,
        days_of_week: f.days_of_week,
        aircraft_type_id: f.aircraft_type_id || '',
        aircraft_type_icao: f.aircraft_type_icao || '',
        service_type: f.service_type,
        effective_from: f.effective_from || '',
        effective_until: f.effective_until || '',
        arrival_day_offset: f.arrival_day_offset,
        connecting_flight: f.connecting_flight || '',
        _isNew: false, _isDirty: false, _isSaving: false, _savedFlash: false, _errors: {}, _selected: false, _autoFilled: {},
      }))
      if (!readOnly) {
        const last = rows.length > 0 ? rows[rows.length - 1] : null
        rows.push(createSmartRow(last))
      }
      setFlights(rows)
      setLoading(false)
    })
  }, [seasonId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Focus input when active cell changes ──
  useEffect(() => {
    if (activeCell) {
      const row = flights[activeCell.row]
      if (row) {
        const val = (row as unknown as Record<string, unknown>)[activeCell.col]
        if (activeCell.col === 'block_minutes' && val) {
          setEditValue(formatBlockTime(Number(val)))
        } else if ((activeCell.col === 'std' || activeCell.col === 'sta') && val) {
          setEditValue(formatTimeDisplay(String(val)))
        } else {
          setEditValue(val != null ? String(val) : '')
        }
      }
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [activeCell]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save logic ──
  const scheduleSave = useCallback((rowId: string) => {
    const existing = saveTimeouts.current.get(rowId)
    if (existing) clearTimeout(existing)
    const t = setTimeout(() => { saveRow(rowId); saveTimeouts.current.delete(rowId) }, 500)
    saveTimeouts.current.set(rowId, t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const saveRow = useCallback(async (rowId: string) => {
    const row = flightsRef.current.find(f => f.id === rowId)
    if (!row || !row._isDirty) return
    if (!row.flight_number || !row.departure_iata || !row.arrival_iata) return

    const errors = validateRow(row, flightsRef.current, prefix)
    if (Object.keys(errors).length > 0) {
      setFlights(prev => prev.map(f => f.id === rowId ? { ...f, _errors: errors } : f))
      return
    }

    setFlights(prev => prev.map(f => f.id === rowId ? { ...f, _isSaving: true } : f))

    const result = await saveFlightNumber({
      id: row._isNew ? undefined : row.id,
      season_id: seasonId,
      flight_number: row.flight_number,
      departure_iata: row.departure_iata,
      arrival_iata: row.arrival_iata,
      std: row.std,
      sta: row.sta,
      block_minutes: row.block_minutes,
      days_of_week: row.days_of_week,
      aircraft_type_id: row.aircraft_type_id || null,
      service_type: row.service_type,
      effective_from: row.effective_from || null,
      effective_until: row.effective_until || null,
      arrival_day_offset: row.arrival_day_offset,
    })

    if (result.error) {
      setFlights(prev => prev.map(f => f.id === rowId ? { ...f, _isSaving: false, _errors: { _save: result.error! } } : f))
    } else {
      const newId = result.id || rowId
      setFlights(prev => {
        const updated = prev.map(f => f.id === rowId ? {
          ...f, id: newId, _isNew: false, _isDirty: false, _isSaving: false, _savedFlash: true, _errors: {}, _autoFilled: {},
        } : f)
        // Ensure there's always an empty row at the end
        if (!updated[updated.length - 1]?._isNew) {
          const savedRow = updated.find(f => f.id === newId)
          updated.push(createSmartRow(savedRow || null))
        }
        return updated
      })
      setTimeout(() => {
        setFlights(prev => prev.map(f => f.id === newId ? { ...f, _savedFlash: false } : f))
      }, 1000)
    }
  }, [seasonId, prefix]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update field ──
  function updateField(rowIndex: number, field: string, value: unknown) {
    setFlights(prev => {
      const updated = [...prev]
      const row = { ...updated[rowIndex], [field]: value, _isDirty: true, _errors: {} }

      // Clear auto-filled flag when user explicitly sets a value
      if (row._autoFilled[field]) {
        row._autoFilled = { ...row._autoFilled }
        delete row._autoFilled[field]
      }

      if (field === 'departure_iata' || field === 'arrival_iata') {
        const dep = field === 'departure_iata' ? value as string : row.departure_iata
        const arr = field === 'arrival_iata' ? value as string : row.arrival_iata

        if (field === 'departure_iata' && dep && dep.length >= 2 && !iataToIcao.has(dep)) {
          const match = fuzzyMatchIata(dep)
          if (match && match !== dep) {
            row._errors = { ...row._errors, departure_iata: `Did you mean ${match}?` }
          } else if (!match) {
            row._errors = { ...row._errors, departure_iata: `Airport '${dep}' not found` }
          }
        }
        if (field === 'arrival_iata' && arr && arr.length >= 2 && !iataToIcao.has(arr)) {
          const match = fuzzyMatchIata(arr)
          if (match && match !== arr) {
            row._errors = { ...row._errors, arrival_iata: `Did you mean ${match}?` }
          } else if (!match) {
            row._errors = { ...row._errors, arrival_iata: `Airport '${arr}' not found` }
          }
        }

        if (dep && arr && dep !== arr && dep.length === 3 && arr.length === 3) {
          const pair = lookupBlock(dep, arr)
          if (pair && !row.block_minutes) {
            row.block_minutes = pair.block_time
            if (row.std && isValidTime(row.std)) {
              const sta = minutesToTime(timeToMinutes(row.std) + pair.block_time)
              row.sta = sta
              row.arrival_day_offset = calcArrivalDayOffset(row.std, sta)
            }
          }
          if (iataToIcao.has(dep) && iataToIcao.has(arr) && !checkCityPairExists(dep, arr)) {
            setMissingPairBanners(prev => {
              const next = new Map(prev)
              next.set(`${dep}-${arr}`, { dep, arr, creating: false })
              return next
            })
          }
        }
      }

      if (field === 'std') {
        // Auto-populate STA if block time is known from city pair and STD is valid
        if (isValidTime(row.std) && row.departure_iata && row.arrival_iata) {
          const pair = lookupBlock(row.departure_iata, row.arrival_iata)
          if (pair && pair.block_time > 0) {
            const sta = minutesToTime(timeToMinutes(row.std) + pair.block_time)
            row.sta = sta
            row.block_minutes = pair.block_time
            row.arrival_day_offset = calcArrivalDayOffset(row.std, sta)
          }
        }
      }

      if (field === 'std' || field === 'sta') {
        if (isValidTime(row.std) && isValidTime(row.sta)) {
          row.arrival_day_offset = calcArrivalDayOffset(row.std, row.sta)
          row.block_minutes = calcBlockMinutes(row.std, row.sta, row.arrival_day_offset)
        }
      }

      if (field === 'flight_number') {
        row.flight_number = normalizeFltNum(value as string, prefix)
      }

      updated[rowIndex] = row

      // Auto-append a new smart row if this is the last row and user started editing
      if (row._isNew && updated.indexOf(row) === updated.length - 1 && (row.flight_number || row.departure_iata)) {
        updated.push(createSmartRow(row))
      }

      return updated
    })
    const row = flights[rowIndex]
    if (row) scheduleSave(row.id)
  }

  // ── Commit cell ──
  function commitCell(rowIndex: number, col: string) {
    let val: unknown = editValue
    if (col === 'std' || col === 'sta') val = normalizeTime(editValue)
    else if (col === 'block_minutes') val = parseBlockInput(editValue)
    else if (col === 'departure_iata' || col === 'arrival_iata') val = editValue.toUpperCase().trim()
    else if (col === 'flight_number') val = normalizeFltNum(editValue, prefix)
    updateField(rowIndex, col, val)

    // Clear auto-filled flag on commit (user confirmed or changed the value)
    setFlights(prev => prev.map((f, i) => {
      if (i !== rowIndex || !f._autoFilled[col]) return f
      const auto = { ...f._autoFilled }
      delete auto[col]
      return { ...f, _autoFilled: auto }
    }))

    setActiveCell(null)
  }

  // ── Add new flight (smart) ──
  function addNewFlight() {
    const lastData = getLastDataRow()
    setFlights(prev => {
      // If the last row is already an empty new row, focus it
      const lastRow = prev[prev.length - 1]
      if (lastRow && lastRow._isNew && !lastRow.flight_number) {
        // Re-populate it with smart data from the last data row
        const smart = createSmartRow(lastData)
        return prev.map((f, i) => i === prev.length - 1 ? { ...smart, id: f.id } : f)
      }
      return [...prev, createSmartRow(lastData)]
    })
    // Focus the new row's flight number
    setTimeout(() => {
      const lastIdx = flightsRef.current.length - 1
      const lastNew = flightsRef.current.findIndex((f, i) => f._isNew && !f.flight_number)
      setActiveCell({ row: lastNew >= 0 ? lastNew : lastIdx, col: 'flight_number' })
    }, 50)
  }

  // ── Key handling ──
  function handleKeyDown(e: React.KeyboardEvent, rowIndex: number, col: string) {
    if (e.key === 'Tab') {
      e.preventDefault()
      commitCell(rowIndex, col)
      const ci = EDITABLE_COLS.indexOf(col as typeof EDITABLE_COLS[number])
      if (e.shiftKey) {
        if (ci > 0) setActiveCell({ row: rowIndex, col: EDITABLE_COLS[ci - 1] })
        else if (rowIndex > 0) setActiveCell({ row: rowIndex - 1, col: EDITABLE_COLS[EDITABLE_COLS.length - 1] })
      } else {
        if (ci < EDITABLE_COLS.length - 1) setActiveCell({ row: rowIndex, col: EDITABLE_COLS[ci + 1] })
        else if (rowIndex < flights.length - 1) setActiveCell({ row: rowIndex + 1, col: EDITABLE_COLS[0] })
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      commitCell(rowIndex, col)
      // Save current row immediately then move to next row
      const row = flights[rowIndex]
      if (row) {
        const existing = saveTimeouts.current.get(row.id)
        if (existing) clearTimeout(existing)
        saveRow(row.id)
      }
      // If this is the last editable row or a new row, create a new one
      if (rowIndex >= flights.length - 1 || flights[rowIndex]?._isNew) {
        addNewFlight()
      } else {
        setActiveCell({ row: rowIndex + 1, col })
      }
    } else if (e.key === 'Escape') {
      setActiveCell(null)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      commitCell(rowIndex, col)
      if (rowIndex < flights.length - 1) setActiveCell({ row: rowIndex + 1, col })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      commitCell(rowIndex, col)
      if (rowIndex > 0) setActiveCell({ row: rowIndex - 1, col })
    }
  }

  // ── Global keyboard shortcuts ──
  useEffect(() => {
    if (readOnly) return
    function onKeyDown(e: KeyboardEvent) {
      // Ctrl+N: Add new flight
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        addNewFlight()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [readOnly]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Return flight ──
  function handleReturn(rowIndex: number) {
    const row = flights[rowIndex]
    if (!row.flight_number || !row.departure_iata || !row.arrival_iata) return

    const tat = lookupDirectionalTat(row.departure_iata, row.arrival_iata, row.arrival_iata, row.departure_iata, row.aircraft_type_id)
    const retStd = row.sta && isValidTime(row.sta) ? minutesToTime(timeToMinutes(row.sta) + tat.minutes) : ''
    const pair = lookupBlock(row.arrival_iata, row.departure_iata)
    const retBlock = pair?.block_time || row.block_minutes
    const retSta = retStd && isValidTime(retStd) ? minutesToTime(timeToMinutes(retStd) + retBlock) : ''
    const retDayOff = retStd && retSta ? calcArrivalDayOffset(retStd, retSta) : 0

    const retRow: FlightRow = {
      ...emptyRow(),
      flight_number: getReturnFltNum(row.flight_number, prefix),
      departure_iata: row.arrival_iata,
      arrival_iata: row.departure_iata,
      std: retStd,
      sta: retSta,
      block_minutes: retBlock,
      days_of_week: row.days_of_week,
      aircraft_type_id: row.aircraft_type_id,
      aircraft_type_icao: row.aircraft_type_icao,
      service_type: row.service_type,
      effective_from: row.effective_from,
      effective_until: row.effective_until,
      arrival_day_offset: retDayOff,
      _isDirty: true,
    }

    setFlights(prev => {
      const updated = [...prev]
      updated.splice(rowIndex + 1, 0, retRow)
      return updated
    })
    scheduleSave(retRow.id)
  }

  // ── Delete rows ──
  async function handleDeleteSelected() {
    const sel = flights.filter(f => f._selected && !f._isNew)
    if (!sel.length) return
    const ids = sel.map(f => f.id)
    await deleteFlightNumbers(ids)
    setFlights(prev => {
      const updated = prev.filter(f => !f._selected || f._isNew)
      if (!updated.length || !updated[updated.length - 1]._isNew) updated.push(createSmartRow(getLastDataRow()))
      return updated
    })
  }

  function handleDeleteRow(rowIndex: number) {
    const row = flights[rowIndex]
    if (row._isNew) {
      setFlights(prev => prev.filter((_, i) => i !== rowIndex))
      return
    }
    setDeleteConfirm({ open: true, rowIndex })
  }

  function confirmDeleteRow() {
    const rowIndex = deleteConfirm.rowIndex
    if (rowIndex === null) return
    const row = flights[rowIndex]
    if (!row || row._isNew) { setDeleteConfirm({ open: false, rowIndex: null }); return }
    deleteFlightNumbers([row.id]).then(() => {
      setFlights(prev => {
        const updated = prev.filter((_, i) => i !== rowIndex)
        if (!updated.length || !updated[updated.length - 1]._isNew) updated.push(createSmartRow(getLastDataRow()))
        return updated
      })
    })
    setDeleteConfirm({ open: false, rowIndex: null })
  }

  function handleDuplicateRow(rowIndex: number) {
    const row = flights[rowIndex]
    if (!row || row._isNew) return
    const dupeRow: FlightRow = {
      ...emptyRow(),
      departure_iata: row.departure_iata,
      arrival_iata: row.arrival_iata,
      std: row.std,
      sta: row.sta,
      block_minutes: row.block_minutes,
      days_of_week: row.days_of_week,
      aircraft_type_id: row.aircraft_type_id,
      aircraft_type_icao: row.aircraft_type_icao,
      service_type: row.service_type,
      effective_from: row.effective_from,
      effective_until: row.effective_until,
      arrival_day_offset: row.arrival_day_offset,
      _isDirty: true,
    }
    setFlights(prev => {
      const updated = [...prev]
      updated.splice(rowIndex + 1, 0, dupeRow)
      return updated
    })
  }

  // ── Bulk ops ──
  const selectedCount = flights.filter(f => f._selected).length
  const selectedIds = flights.filter(f => f._selected && !f._isNew).map(f => f.id)

  function toggleSelectAll() {
    const allSelected = flights.every(f => f._isNew || f._selected)
    setFlights(prev => prev.map(f => f._isNew ? f : { ...f, _selected: !allSelected }))
  }

  async function doBulkUpdate(field: string, value: string) {
    if (!selectedIds.length) return
    await bulkUpdateFlightNumbers(selectedIds, { [field]: value || null })
    setFlights(prev => prev.map(f => f._selected ? { ...f, [field]: value, _selected: false } : f))
    setShowBulkAcType(false); setShowBulkSvc(false); setShowBulkDow(false); setBulkValue('')
  }

  function handleDuplicate() {
    const sel = flights.filter(f => f._selected && !f._isNew)
    const dupes = sel.map(f => ({ ...emptyRow(), ...f, id: emptyRow().id, _isNew: true, _isDirty: true, _selected: false, flight_number: '' }))
    setFlights(prev => [...prev.filter(f => !f._isNew), ...dupes, createSmartRow(getLastDataRow())])
  }

  // ── Import ──
  function handleImport(rows: Partial<FlightRow>[]) {
    const newRows: FlightRow[] = rows.map(r => ({
      ...emptyRow(),
      ...r,
      block_minutes: r.std && r.sta && isValidTime(r.std || '') && isValidTime(r.sta || '')
        ? calcBlockMinutes(r.std!, r.sta!, calcArrivalDayOffset(r.std!, r.sta!))
        : 0,
      arrival_day_offset: r.std && r.sta ? calcArrivalDayOffset(r.std || '', r.sta || '') : 0,
      _isDirty: true,
    } as FlightRow))
    setFlights(prev => [...prev.filter(f => !f._isNew), ...newRows, createSmartRow(newRows[newRows.length - 1] || getLastDataRow())])
    newRows.forEach(r => scheduleSave(r.id))
  }

  // ── Export CSV ──
  function exportCsv() {
    const dataRows = flights.filter(f => !f._isNew && f.flight_number)
    const headers = ['Flt. No', 'DEP', 'ARR', 'STD', 'STA', 'Block Time', 'Flight Time', 'Day of Week', 'AC Type/Reg', 'Service Type', 'From', 'To']
    const csv = [headers.join(','), ...dataRows.map(f => [
      f.flight_number, f.departure_iata, f.arrival_iata, f.std, f.sta,
      f.block_minutes, getFlightTimeDisplay(f), f.days_of_week,
      acTypeMap.get(f.aircraft_type_id)?.icao_type || '',
      f.service_type, f.effective_from, f.effective_until,
    ].join(','))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `schedule-${seasonId}.csv`
    a.click()
  }

  // ── Flight grouping (cached) ──
  const flightGroups = useMemo(() => groupAndPairFlights(flights), [flights])

  // ── Filter — show group if any flight matches ──
  const filteredGroups = useMemo(() => {
    if (!filters.aircraftType && !filters.departure && !filters.serviceType) return flightGroups
    return flightGroups.filter(group => {
      const all = [...group.outbound, ...group.inbound]
      return all.some(f => {
        if (filters.aircraftType && f.aircraft_type_id !== filters.aircraftType) return false
        if (filters.departure && f.departure_iata !== filters.departure) return false
        if (filters.serviceType && f.service_type !== filters.serviceType) return false
        return true
      })
    })
  }, [flightGroups, filters])

  // New empty rows (always shown at bottom)
  const newRows = useMemo(() => flights.filter(f => f._isNew), [flights])

  // ── Inline edit style (seamless) ──
  const editCls = 'w-full bg-transparent border-b border-primary/40 outline-none font-mono text-sm px-2 py-0.5'
  const editSelectCls = 'w-full bg-transparent border-b border-primary/40 outline-none font-mono text-sm px-1 py-0.5 appearance-none'

  // ── Render cell ──
  function renderCell(row: FlightRow, col: string) {
    const globalIndex = flights.indexOf(row)
    const canEdit = !readOnly
    const isActive = canEdit && activeCell?.row === globalIndex && activeCell?.col === col
    const error = row._errors[col]
    const val = (row as unknown as Record<string, string | number | boolean | null>)[col]
    const isAutoFilled = row._autoFilled[col] === true

    // Special: DOW column
    if (col === 'days_of_week') {
      return (
        <td key={col} className="px-1 py-0.5">
          <div className={cn('flex justify-center', isAutoFilled && 'opacity-50')}>
            <DowDisplay value={row.days_of_week} onChange={canEdit ? v => updateField(globalIndex, 'days_of_week', v) : undefined} />
          </div>
        </td>
      )
    }

    // Special: AC type select
    if (col === 'aircraft_type_id') {
      const hint = canEdit ? suggestAcType(row.departure_iata, row.arrival_iata) : undefined
      if (isActive) {
        return (
          <td key={col} className="p-0">
            <select ref={inputRef as unknown as React.RefObject<HTMLSelectElement>} value={editValue}
              onChange={e => { setEditValue(e.target.value); updateField(globalIndex, col, e.target.value); setActiveCell(null) }}
              onBlur={() => setActiveCell(null)}
              onKeyDown={e => handleKeyDown(e, globalIndex, col)}
              className={editSelectCls} autoFocus>
              <option value="">—</option>
              {uniqueAcTypes.map(t => <option key={t.id} value={t.id}>{t.icao_type}</option>)}
            </select>
          </td>
        )
      }
      return (
        <td key={col} className={cn('px-2 py-0.5 font-mono text-sm whitespace-nowrap', canEdit && 'cursor-pointer hover:bg-muted/30', error && 'bg-red-500/10')}
          onClick={canEdit ? () => setActiveCell({ row: globalIndex, col }) : undefined} title={hint ? `Suggestion: ${hint}` : undefined}>
          <span className={cn(isAutoFilled && 'text-muted-foreground/60 italic')}>
            {acTypeMap.get(val as string)?.icao_type || <span className="text-muted-foreground">—</span>}
          </span>
          {hint && !val && <span className="text-[9px] text-muted-foreground/60 ml-1">{hint}</span>}
        </td>
      )
    }

    // Special: service type select
    if (col === 'service_type') {
      if (isActive) {
        return (
          <td key={col} className="p-0">
            <select ref={inputRef as unknown as React.RefObject<HTMLSelectElement>} value={editValue}
              onChange={e => { setEditValue(e.target.value); updateField(globalIndex, col, e.target.value); setActiveCell(null) }}
              onBlur={() => setActiveCell(null)}
              onKeyDown={e => handleKeyDown(e, globalIndex, col)}
              className={editSelectCls} autoFocus>
              <option value="">—</option>
              {flightServiceTypes.map(s => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
              {flightServiceTypes.length === 0 && ['J','C','F','G','P'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </td>
        )
      }
      const fst = flightServiceTypes.find(s => s.code === val)
      return (
        <td key={col} className={cn('px-2 py-0.5 font-mono text-sm whitespace-nowrap', canEdit && 'cursor-pointer hover:bg-muted/30', error && 'bg-red-500/10')}
          onClick={canEdit ? () => setActiveCell({ row: globalIndex, col }) : undefined} title={fst ? `${fst.code} — ${fst.name}` : undefined}>
          <span className={cn(isAutoFilled && 'text-muted-foreground/60 italic')}>
            {fst ? (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: fst.color || '#6B9DAD' }} />
                {fst.code}
              </span>
            ) : (String(val || '') || <span className="text-muted-foreground">—</span>)}
          </span>
        </td>
      )
    }

    // Date columns
    if (col === 'effective_from' || col === 'effective_until') {
      if (isActive) {
        return (
          <td key={col} className="p-0">
            <input ref={inputRef} type="date" value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={() => commitCell(globalIndex, col)}
              onKeyDown={e => handleKeyDown(e, globalIndex, col)}
              className={editCls} autoFocus />
          </td>
        )
      }
      return (
        <td key={col} className={cn('px-2 py-0.5 text-sm font-mono whitespace-nowrap', canEdit && 'cursor-pointer hover:bg-muted/30')}
          onClick={canEdit ? () => setActiveCell({ row: globalIndex, col }) : undefined}>
          <span className={cn(isAutoFilled && 'text-muted-foreground/60 italic')}>
            {val ? formatDateDisplay(String(val)) : <span className="text-muted-foreground">—</span>}
          </span>
        </td>
      )
    }

    // Text/number cells — edit mode
    if (isActive) {
      return (
        <td key={col} className={cn('p-0', error && 'ring-1 ring-red-500 ring-inset')}>
          <input ref={inputRef} value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={() => commitCell(globalIndex, col)}
            onKeyDown={e => handleKeyDown(e, globalIndex, col)}
            className={editCls}
            type="text"
            autoFocus />
        </td>
      )
    }

    // Display value
    let displayVal: React.ReactNode = val != null && val !== '' && val !== 0 ? String(val) : <span className="text-muted-foreground">—</span>

    if ((col === 'std' || col === 'sta') && val) {
      displayVal = formatTimeForDisplay(row, col)
    }
    if (col === 'sta' && row.arrival_day_offset > 0 && val) {
      displayVal = <span>{formatTimeForDisplay(row, 'sta')} <span className="text-[9px] bg-amber-500/20 text-amber-600 px-0.5 rounded">+1</span></span>
    }
    if (col === 'block_minutes' && val) {
      displayVal = formatBlockTime(Number(val))
    }

    const isFltNum = col === 'flight_number'

    return (
      <td key={col} className={cn(
        'px-2 py-0.5 font-mono text-sm whitespace-nowrap',
        canEdit && 'cursor-pointer hover:bg-muted/30',
        error && 'bg-red-500/10',
        col === 'block_minutes' && val && (Number(val) < 30 || Number(val) > 1200) && 'text-red-500',
        isFltNum && 'font-semibold',
      )} onClick={canEdit ? () => setActiveCell({ row: globalIndex, col }) : undefined} title={error || undefined}>
        <span className={cn(isAutoFilled && !isFltNum && 'text-muted-foreground/60 italic')}>
          {displayVal}
        </span>
      </td>
    )
  }

  // ── Render a flight row (within a group) ──
  function renderFlightRow(row: FlightRow, groupIdx: number) {
    const gIdx = flights.indexOf(row)
    const saveErr = row._errors._save
    return (
      <tr
        key={row.id}
        className={cn(
          'transition-colors duration-300 group/row',
          row._savedFlash && 'bg-green-500/10',
          row._isSaving && 'opacity-70',
          saveErr && 'bg-red-500/5',
          !row._savedFlash && !saveErr && (groupIdx % 2 === 1 ? 'bg-muted/10 hover:bg-muted/20' : 'hover:bg-muted/10'),
        )}
      >
        {!readOnly && (
          <td className="px-2 py-0.5" style={{ width: 36 }}>
            <input type="checkbox" checked={row._selected}
              onChange={() => setFlights(prev => prev.map((f, i) => i === gIdx ? { ...f, _selected: !f._selected } : f))}
              className="rounded" />
          </td>
        )}
        {renderCell(row, 'flight_number')}
        {renderCell(row, 'departure_iata')}
        {renderCell(row, 'arrival_iata')}
        {renderCell(row, 'std')}
        {renderCell(row, 'sta')}
        {renderCell(row, 'block_minutes')}
        <td className="px-2 py-0.5 font-mono text-sm text-muted-foreground whitespace-nowrap">{getFlightTimeDisplay(row)}</td>
        {renderCell(row, 'days_of_week')}
        {renderCell(row, 'aircraft_type_id')}
        {renderCell(row, 'service_type')}
        {renderCell(row, 'effective_from')}
        {renderCell(row, 'effective_until')}
        {!readOnly && (
          <td className="px-1 py-0.5 text-right whitespace-nowrap">
            <div className="flex justify-end gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
              <button onClick={() => handleReturn(gIdx)}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                title={row.aircraft_type_id ? `Return flight (TAT: ${minutesToHHMM(lookupTat(row.arrival_iata, row.aircraft_type_id).minutes)} — ${lookupTat(row.arrival_iata, row.aircraft_type_id).source})` : 'Create return flight'}>
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => handleDuplicateRow(gIdx)}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                title="Duplicate flight">
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => handleDeleteRow(gIdx)}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                title="Delete flight">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {saveErr && (
              <span className="text-[9px] text-destructive" title={saveErr}>
                <AlertTriangle className="h-3 w-3 inline" />
              </span>
            )}
          </td>
        )}
      </tr>
    )
  }

  // ── No seasons ──
  if (!seasons.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No schedule seasons found</p>
        <p className="text-sm mt-1">Create a schedule season in Admin → Network Config first.</p>
      </div>
    )
  }

  const totalDataFlights = flights.filter(f => !f._isNew).length
  const pairedGroupCount = flightGroups.filter(g => g.inbound.length > 0).length
  const unpairedGroupCount = flightGroups.filter(g => g.inbound.length === 0).length

  // ── Render ──
  return (
    <div className="space-y-3">
      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={seasonId} onChange={e => setSeasonId(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring">
          {seasons.map(s => (
            <option key={s.id} value={s.id}>{s.code} — {s.name} ({s.status})</option>
          ))}
        </select>

        <Button variant="outline" size="sm" onClick={() => {
          const modes: TimeMode[] = ['utc', 'local_station', 'local_base']
          const next = modes[(modes.indexOf(timeMode) + 1) % modes.length]
          setTimeMode(next)
        }} title="Cycle time display mode: UTC → Local Station → Local Base">
          <Clock className="h-4 w-4 mr-1" />
          {timeMode === 'utc' ? 'UTC' : timeMode === 'local_station' ? 'Local Station' : 'Local Base'}
        </Button>

        <div className="h-6 w-px bg-border" />

        <select value={filters.aircraftType} onChange={e => setFilters(p => ({ ...p, aircraftType: e.target.value }))}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">All A/C Types</option>
          {uniqueAcTypes.map(t => <option key={t.id} value={t.id}>{t.icao_type}</option>)}
        </select>
        <select value={filters.departure} onChange={e => setFilters(p => ({ ...p, departure: e.target.value }))}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">All Departures</option>
          {Array.from(new Set(flights.map(f => f.departure_iata).filter(Boolean))).sort().map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select value={filters.serviceType} onChange={e => setFilters(p => ({ ...p, serviceType: e.target.value }))}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">All Svc Types</option>
          {flightServiceTypes.map(s => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
        </select>

        <div className="flex-1" />

        <span className="text-sm text-muted-foreground">
          {totalDataFlights} flights · {pairedGroupCount} pairs · {unpairedGroupCount} unpaired
        </span>

        {!readOnly && (
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4 mr-1" />Import
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="h-4 w-4 mr-1" />Export
        </Button>
        {!readOnly && (
          <Button size="sm" onClick={addNewFlight}>
            <Plus className="h-4 w-4 mr-1" />Add Flight
          </Button>
        )}
      </div>

      {/* Bulk toolbar (Builder only) */}
      {!readOnly && selectedCount > 0 && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
          <span className="text-sm font-medium">{selectedCount} selected</span>
          <div className="h-4 w-px bg-border" />
          <Button variant="outline" size="sm" onClick={() => { setShowBulkAcType(true); setBulkValue('') }}>Change A/C Type</Button>
          <Button variant="outline" size="sm" onClick={() => { setShowBulkDow(true); setBulkValue('1234567') }}>Change DOW</Button>
          <Button variant="outline" size="sm" onClick={() => { setShowBulkSvc(true); setBulkValue('') }}>Change Svc</Button>
          <Button variant="outline" size="sm" onClick={handleDuplicate}>Duplicate</Button>
          <Button variant="outline" size="sm" className="text-destructive" onClick={handleDeleteSelected}>
            <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
          </Button>
        </div>
      )}

      {/* Missing City Pair Banners (Builder only) */}
      {!readOnly && missingPairBanners.size > 0 && (
        <div className="space-y-1.5">
          {Array.from(missingPairBanners.entries()).map(([key, { dep, arr, creating }]) => (
            <div key={key} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
              <span className="text-amber-200">
                City pair <span className="font-mono font-bold">{dep} ↔ {arr}</span> does not exist.
              </span>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="sm" variant="outline"
                  className="h-7 text-xs border-amber-500/30 hover:bg-amber-500/20"
                  disabled={creating}
                  onClick={async () => {
                    setMissingPairBanners(prev => {
                      const next = new Map(prev)
                      next.set(key, { dep, arr, creating: true })
                      return next
                    })
                    const result = await createCityPairFromIata(dep, arr)
                    if (result.error) {
                      toast.error(friendlyError(result.error))
                      setMissingPairBanners(prev => {
                        const next = new Map(prev)
                        next.set(key, { dep, arr, creating: false })
                        return next
                      })
                    } else {
                      const rt = result.route_type ? result.route_type.charAt(0).toUpperCase() + result.route_type.slice(1) : ''
                      toast.success(`Created city pair ${dep} ↔ ${arr} (${Math.round(result.distance_nm || 0)} NM, ${rt})`)
                      setMissingPairBanners(prev => {
                        const next = new Map(prev)
                        next.delete(key)
                        return next
                      })
                    }
                  }}
                >
                  {creating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Create & Continue
                </Button>
                <Button
                  size="sm" variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => {
                    setMissingPairBanners(prev => {
                      const next = new Map(prev)
                      next.delete(key)
                      return next
                    })
                  }}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grid with frozen header and scrollable body */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading flights...</div>
      ) : (
        <div
          className="rounded-lg border overflow-auto schedule-scroll"
          style={{ maxHeight: 'calc(100vh - 240px)' }}
        >
          <table className="w-full text-sm border-collapse" style={{ minWidth: 1200 }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-background border-b shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                {!readOnly && (
                  <th className="bg-background whitespace-nowrap" style={{ width: 36, minWidth: 36 }}>
                    <input type="checkbox" checked={flights.filter(f => !f._isNew).length > 0 && flights.filter(f => !f._isNew).every(f => f._selected)}
                      onChange={toggleSelectAll} className="rounded" />
                  </th>
                )}
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground bg-background whitespace-nowrap" style={{ minWidth: 75 }}>Flt. No</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground bg-background whitespace-nowrap" style={{ minWidth: 50 }}>DEP</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground bg-background whitespace-nowrap" style={{ minWidth: 50 }}>ARR</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground bg-background whitespace-nowrap" style={{ minWidth: 60 }}>{getTimeHeader('STD')}</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground bg-background whitespace-nowrap" style={{ minWidth: 60 }}>{getTimeHeader('STA')}</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground bg-background whitespace-nowrap" style={{ minWidth: 60 }}>Block Time</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground bg-background whitespace-nowrap" style={{ minWidth: 60 }}>Flight Time</th>
                <th className="px-2 py-1.5 text-center text-xs font-semibold text-muted-foreground bg-background whitespace-nowrap" style={{ minWidth: 170 }}>Day of Week</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground bg-background whitespace-nowrap" style={{ minWidth: 85 }}>AC Type/Reg</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground bg-background whitespace-nowrap" style={{ minWidth: 55 }}>Service Type</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground bg-background whitespace-nowrap" style={{ minWidth: 90 }}>From</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground bg-background whitespace-nowrap" style={{ minWidth: 90 }}>To</th>
                {!readOnly && (
                  <th className="px-2 py-1.5 text-right text-xs font-semibold text-muted-foreground bg-background whitespace-nowrap" style={{ minWidth: 50 }}>Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {/* Empty state */}
              {filteredGroups.length === 0 && (readOnly || newRows.length === 0) && (
                <tr>
                  <td colSpan={readOnly ? 13 : 15} className="py-16 text-center">
                    <div className="text-muted-foreground text-sm">
                      No flights found for the selected filters.
                    </div>
                  </td>
                </tr>
              )}

              {/* Grouped paired flights */}
              {filteredGroups.map((group, groupIdx) => (
                <Fragment key={group.outbound[0]?.id || `group-${groupIdx}`}>
                  {group.outbound.map(row => renderFlightRow(row, groupIdx))}
                  {group.inbound.map(row => renderFlightRow(row, groupIdx))}
                </Fragment>
              ))}

              {/* New empty rows at the end (Builder only) */}
              {!readOnly && newRows.map(row => (
                <tr key={row.id} className="border-b bg-muted/20 group/row">
                  <td className="px-2 py-0.5" style={{ width: 36 }} />
                  {renderCell(row, 'flight_number')}
                  {renderCell(row, 'departure_iata')}
                  {renderCell(row, 'arrival_iata')}
                  {renderCell(row, 'std')}
                  {renderCell(row, 'sta')}
                  {renderCell(row, 'block_minutes')}
                  <td className="px-2 py-0.5 font-mono text-sm text-muted-foreground whitespace-nowrap">{row.block_minutes ? getFlightTimeDisplay(row) : ''}</td>
                  {renderCell(row, 'days_of_week')}
                  {renderCell(row, 'aircraft_type_id')}
                  {renderCell(row, 'service_type')}
                  {renderCell(row, 'effective_from')}
                  {renderCell(row, 'effective_until')}
                  <td className="px-1 py-0.5 text-right whitespace-nowrap" />
                </tr>
              ))}

              {/* Add Flight row at bottom */}
              {!readOnly && (
                <tr>
                  <td colSpan={15} className="py-2 border-none">
                    <button
                      onClick={addNewFlight}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-md transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Flight
                    </button>
                  </td>
                </tr>
              )}

              {/* Bottom padding so last row isn't hidden behind dock */}
              <tr><td colSpan={readOnly ? 13 : 15} className="h-16 border-none" /></tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Import Dialog */}
      <ImportDialog open={showImport} onClose={() => setShowImport(false)} onImport={handleImport} prefix={prefix} />

      {/* Bulk A/C Type Dialog */}
      <Dialog open={showBulkAcType} onOpenChange={setShowBulkAcType}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Change Aircraft Type</DialogTitle></DialogHeader>
          <select value={bulkValue} onChange={e => setBulkValue(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-mono">
            <option value="">Select type...</option>
            {uniqueAcTypes.map(t => <option key={t.id} value={t.id}>{t.icao_type} — {t.name}</option>)}
          </select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkAcType(false)}>Cancel</Button>
            <Button disabled={!bulkValue} onClick={() => doBulkUpdate('aircraft_type_id', bulkValue)}>Apply to {selectedCount} rows</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Service Type Dialog */}
      <Dialog open={showBulkSvc} onOpenChange={setShowBulkSvc}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Change Service Type</DialogTitle></DialogHeader>
          <select value={bulkValue} onChange={e => setBulkValue(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-mono">
            <option value="">Select type...</option>
            {flightServiceTypes.map(s => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
          </select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkSvc(false)}>Cancel</Button>
            <Button disabled={!bulkValue} onClick={() => doBulkUpdate('service_type', bulkValue)}>Apply to {selectedCount} rows</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk DOW Dialog */}
      <Dialog open={showBulkDow} onOpenChange={setShowBulkDow}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Change Days of Operation</DialogTitle></DialogHeader>
          <div className="flex justify-center py-4">
            <DowSelector value={bulkValue || '1234567'} onChange={setBulkValue} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDow(false)}>Cancel</Button>
            <Button onClick={() => doBulkUpdate('days_of_week', bulkValue || '1234567')}>Apply to {selectedCount} rows</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm.open} onOpenChange={open => { if (!open) setDeleteConfirm({ open: false, rowIndex: null }) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Flight</DialogTitle>
            <DialogDescription>
              {deleteConfirm.rowIndex !== null && flights[deleteConfirm.rowIndex] ? (
                <>Are you sure you want to delete flight <span className="font-mono font-semibold">{flights[deleteConfirm.rowIndex].flight_number}</span>? This action cannot be undone.</>
              ) : 'Are you sure you want to delete this flight?'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm({ open: false, rowIndex: null })}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteRow}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
