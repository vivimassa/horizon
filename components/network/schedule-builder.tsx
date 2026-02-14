'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ScheduleSeason, AircraftType, Airport, CityPair, FlightServiceType, AirportTatRule } from '@/types/database'
import { getFlightNumbers } from '@/app/actions/flight-numbers'
import { saveFlightNumber, deleteFlightNumbers, bulkUpdateFlightNumbers } from '@/app/actions/flight-numbers'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Download, Upload, RotateCcw, Trash2, AlertTriangle, Copy, Clock } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────
interface FlightRow {
  id: string
  flight_number: string
  departure_iata: string
  arrival_iata: string
  std: string
  sta: string
  block_minutes: number
  days_of_week: string
  aircraft_type_id: string
  service_type: string
  effective_from: string
  effective_until: string
  arrival_day_offset: number
  _isNew: boolean
  _isDirty: boolean
  _isSaving: boolean
  _savedFlash: boolean
  _errors: Record<string, string>
  _selected: boolean
}

interface ScheduleBuilderProps {
  seasons: ScheduleSeason[]
  aircraftTypes: AircraftType[]
  airports: Airport[]
  flightServiceTypes: FlightServiceType[]
  cityPairs: CityPair[]
  tatRules: AirportTatRule[]
  operatorIataCode: string
  operatorTimezone?: string
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
    std: '', sta: '', block_minutes: 0, days_of_week: '1234567',
    aircraft_type_id: '', service_type: 'J',
    effective_from: '', effective_until: '', arrival_day_offset: 0,
    _isNew: true, _isDirty: false, _isSaving: false, _savedFlash: false,
    _errors: {}, _selected: false,
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
  // Explicit minutes: "210m"
  if (/^\d+m$/i.test(trimmed)) return parseInt(trimmed) || 0
  // HH:MM format: "3:30"
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [h, m] = trimmed.split(':').map(Number)
    return h * 60 + m
  }
  // 3+ digit number without colon: treat as HMM or HHMM (e.g. "330" → 3h30m)
  if (/^\d{3,4}$/.test(trimmed)) {
    const h = parseInt(trimmed.slice(0, -2))
    const m = parseInt(trimmed.slice(-2))
    if (m < 60) return h * 60 + m
  }
  // Fallback: raw number as minutes
  return parseInt(trimmed) || 0
}

function formatDateDisplay(iso: string): string {
  if (!iso) return ''
  const parts = iso.split('-')
  if (parts.length !== 3) return iso
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function convertUtcToTimezone(hhmm: string, timezone: string): string {
  if (!hhmm || hhmm.length !== 4 || !timezone) return hhmm
  try {
    // Use a fixed date to convert — only care about time portion
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

function toggleDow(value: string, pos: number): string {
  const chars = (value || '.......').padEnd(7, '.').split('')
  const d = String(pos + 1)
  chars[pos] = chars[pos] === d ? '.' : d
  return chars.join('')
}

function validateRow(row: FlightRow, allRows: FlightRow[], prefix: string): Record<string, string> {
  const e: Record<string, string> = {}
  if (row.flight_number && !isValidFltNum(row.flight_number, prefix)) e.flight_number = 'Invalid format'
  if (row.flight_number && allRows.some(r => r.id !== row.id && r.flight_number === row.flight_number)) e.flight_number = 'Duplicate'
  if (row.departure_iata && row.arrival_iata && row.departure_iata === row.arrival_iata) e.arrival_iata = 'Same as DEP'
  if (row.std && !isValidTime(row.std)) e.std = 'Invalid time'
  if (row.sta && !isValidTime(row.sta)) e.sta = 'Invalid time'
  if (row.block_minutes && (row.block_minutes < 30 || row.block_minutes > 1200)) e.block_minutes = '30-1200 min'
  return e
}

// ─── DOW Selector ─────────────────────────────────────────────
function DowSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const padded = (value || '.......').padEnd(7, '.')
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex gap-0.5">
        {labels.map((label, i) => {
          const active = padded[i] !== '.'
          return (
            <button key={i} type="button" onClick={() => onChange(toggleDow(padded, i))}
              className={cn('w-4 h-4 rounded-full text-[9px] font-bold leading-none flex items-center justify-center transition-colors',
                active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground/50'
              )}>
              {label}
            </button>
          )
        })}
      </div>
      <span className="font-mono text-[9px] text-muted-foreground leading-none">{padded}</span>
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
        aircraft_type_id: '', // resolved later
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
            Paste tab-separated data. Columns: Flt# DEP ARR STD STA DOW AcType Svc
          </DialogDescription>
        </DialogHeader>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={8} placeholder="Paste flight data here..."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" />
        {preview.length > 0 && (
          <div className="rounded border overflow-auto max-h-48">
            <table className="w-full text-xs font-mono">
              <thead><tr className="bg-muted"><th className="p-1">Flt#</th><th className="p-1">DEP</th><th className="p-1">ARR</th><th className="p-1">STD</th><th className="p-1">STA</th><th className="p-1">DOW</th><th className="p-1">Svc</th></tr></thead>
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
  seasons, aircraftTypes, airports, flightServiceTypes, cityPairs, tatRules,
  operatorIataCode, operatorTimezone,
}: ScheduleBuilderProps) {
  const prefix = operatorIataCode || 'HZ'

  // ── State ──
  const [timeMode, setTimeMode] = useState<TimeMode>('utc')
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; rowIndex: number | null }>({ open: false, rowIndex: null })
  const [seasonId, setSeasonId] = useState(() => {
    const active = seasons.find(s => s.status === 'active') || seasons.find(s => s.status === 'draft') || seasons[0]
    return active?.id || ''
  })
  const [flights, setFlights] = useState<FlightRow[]>([emptyRow()])
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

  const blockTimeMap = useMemo(() => {
    const m = new Map<string, { block_time: number; distance: number }>()
    cityPairs.forEach(cp => {
      m.set(`${cp.departure_airport}-${cp.arrival_airport}`, { block_time: cp.block_time || 0, distance: cp.distance || 0 })
    })
    return m
  }, [cityPairs])

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

  const airportTzMap = useMemo(() => {
    const m = new Map<string, string>()
    airports.forEach(a => { if (a.iata_code && a.timezone) m.set(a.iata_code, a.timezone) })
    return m
  }, [airports])

  // ── Time display ──
  function formatTimeForDisplay(hhmm: string, depIata: string, arrIata: string, field: 'std' | 'sta'): string {
    if (!hhmm || hhmm.length !== 4) return hhmm
    let converted = hhmm
    if (timeMode === 'local_station') {
      const tz = field === 'std' ? airportTzMap.get(depIata) : airportTzMap.get(arrIata)
      if (tz) converted = convertUtcToTimezone(hhmm, tz)
    } else if (timeMode === 'local_base' && operatorTimezone) {
      converted = convertUtcToTimezone(hhmm, operatorTimezone)
    }
    return formatTimeDisplay(converted)
  }

  function getTimeHeader(base: string): string {
    if (timeMode === 'utc') return `${base} (UTC)`
    if (timeMode === 'local_station') return `${base} (LCL)`
    return `${base} (BASE)`
  }

  // ── Lookup functions ──
  function lookupBlock(dep: string, arr: string) {
    const dIcao = iataToIcao.get(dep), aIcao = iataToIcao.get(arr)
    if (!dIcao || !aIcao) return null
    return blockTimeMap.get(`${dIcao}-${aIcao}`) || blockTimeMap.get(`${aIcao}-${dIcao}`) || null
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

  function suggestAcType(dep: string, arr: string): string {
    const pair = lookupBlock(dep, arr)
    if (!pair) return ''
    if (pair.distance < 1500) return 'A320 / A321'
    if (pair.distance <= 4000) return 'A321 / A330'
    return 'A330'
  }

  // ── Load flights ──
  useEffect(() => {
    if (!seasonId) { setFlights([emptyRow()]); return }
    setLoading(true)
    getFlightNumbers(seasonId).then(data => {
      const rows: FlightRow[] = data.map(f => ({
        id: f.id,
        flight_number: f.flight_number,
        departure_iata: f.departure_iata || '',
        arrival_iata: f.arrival_iata || '',
        std: f.std,
        sta: f.sta,
        block_minutes: f.block_minutes,
        days_of_week: f.days_of_week,
        aircraft_type_id: f.aircraft_type_id || '',
        service_type: f.service_type,
        effective_from: f.effective_from || '',
        effective_until: f.effective_until || '',
        arrival_day_offset: f.arrival_day_offset,
        _isNew: false, _isDirty: false, _isSaving: false, _savedFlash: false, _errors: {}, _selected: false,
      }))
      rows.push(emptyRow())
      setFlights(rows)
      setLoading(false)
    })
  }, [seasonId])

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
    // Need at least flight number to save
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
          ...f, id: newId, _isNew: false, _isDirty: false, _isSaving: false, _savedFlash: true, _errors: {},
        } : f)
        // Ensure new empty row at end
        if (!updated[updated.length - 1]?._isNew) updated.push(emptyRow())
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

      // Auto-calculations
      if (field === 'departure_iata' || field === 'arrival_iata') {
        const dep = field === 'departure_iata' ? value as string : row.departure_iata
        const arr = field === 'arrival_iata' ? value as string : row.arrival_iata
        if (dep && arr && dep !== arr) {
          const pair = lookupBlock(dep, arr)
          if (pair && !row.block_minutes) {
            row.block_minutes = pair.block_time
            // If we have STD, calculate STA
            if (row.std && isValidTime(row.std)) {
              const sta = minutesToTime(timeToMinutes(row.std) + pair.block_time)
              row.sta = sta
              row.arrival_day_offset = calcArrivalDayOffset(row.std, sta)
            }
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

      // If editing the last row (new row), add another — auto-chain DEP from previous ARR
      if (row._isNew && updated.indexOf(row) === updated.length - 1 && (row.flight_number || row.departure_iata)) {
        const newRow = emptyRow()
        if (row.arrival_iata) newRow.departure_iata = row.arrival_iata
        updated.push(newRow)
      }

      return updated
    })
    // Schedule save
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
    setActiveCell(null)
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
      if (rowIndex < flights.length - 1) setActiveCell({ row: rowIndex + 1, col })
    } else if (e.key === 'Escape') {
      setActiveCell(null)
    }
  }

  // ── Return flight ──
  function handleReturn(rowIndex: number) {
    const row = flights[rowIndex]
    if (!row.flight_number || !row.departure_iata || !row.arrival_iata) return

    const tat = lookupTat(row.arrival_iata, row.aircraft_type_id)
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
      if (!updated.length || !updated[updated.length - 1]._isNew) updated.push(emptyRow())
      return updated
    })
  }

  function handleDeleteRow(rowIndex: number) {
    const row = flights[rowIndex]
    if (row._isNew) {
      setFlights(prev => prev.filter((_, i) => i !== rowIndex))
      return
    }
    // Show confirmation for saved rows
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
        if (!updated.length || !updated[updated.length - 1]._isNew) updated.push(emptyRow())
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
    setFlights(prev => [...prev.filter(f => !f._isNew), ...dupes, emptyRow()])
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
    setFlights(prev => [...prev.filter(f => !f._isNew), ...newRows, emptyRow()])
    newRows.forEach(r => scheduleSave(r.id))
  }

  // ── Export CSV ──
  function exportCsv() {
    const dataRows = flights.filter(f => !f._isNew && f.flight_number)
    const headers = ['Flt#', 'DEP', 'ARR', 'STD', 'STA', 'Blk', 'DOW', 'A/C Type', 'Svc', 'Eff From', 'Eff Until']
    const csv = [headers.join(','), ...dataRows.map(f => [
      f.flight_number, f.departure_iata, f.arrival_iata, f.std, f.sta,
      f.block_minutes, f.days_of_week,
      acTypeMap.get(f.aircraft_type_id)?.icao_type || '',
      f.service_type, f.effective_from, f.effective_until,
    ].join(','))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `schedule-${seasonId}.csv`
    a.click()
  }

  // ── Filter ──
  const filteredFlights = useMemo(() => {
    return flights.filter(f => {
      if (f._isNew && !f.flight_number) return true // Always show empty new row
      if (filters.aircraftType && f.aircraft_type_id !== filters.aircraftType) return false
      if (filters.departure && f.departure_iata !== filters.departure) return false
      if (filters.serviceType && f.service_type !== filters.serviceType) return false
      return true
    })
  }, [flights, filters])

  // ── Render cell ──
  function renderCell(rowIndex: number, col: string, row: FlightRow) {
    const globalIndex = flights.indexOf(row)
    const isActive = activeCell?.row === globalIndex && activeCell?.col === col
    const error = row._errors[col]
    const val = (row as unknown as Record<string, string | number | boolean | null>)[col]

    // Special: DOW column
    if (col === 'days_of_week') {
      return (
        <td key={col} className="px-1 py-0.5">
          <DowSelector value={row.days_of_week} onChange={v => updateField(globalIndex, 'days_of_week', v)} />
        </td>
      )
    }

    // Special: select columns
    if (col === 'aircraft_type_id') {
      const hint = suggestAcType(row.departure_iata, row.arrival_iata)
      if (isActive) {
        return (
          <td key={col} className="p-0">
            <select ref={inputRef as unknown as React.RefObject<HTMLSelectElement>} value={editValue}
              onChange={e => { setEditValue(e.target.value); updateField(globalIndex, col, e.target.value); setActiveCell(null) }}
              onBlur={() => setActiveCell(null)}
              onKeyDown={e => handleKeyDown(e, globalIndex, col)}
              className="w-full h-full px-1 py-0.5 bg-background text-sm font-mono border-2 border-primary focus:outline-none" autoFocus>
              <option value="">—</option>
              {aircraftTypes.map(t => <option key={t.id} value={t.id}>{t.icao_type}</option>)}
            </select>
          </td>
        )
      }
      return (
        <td key={col} className={cn('px-2 py-0.5 cursor-pointer hover:bg-muted/50 font-mono text-sm', error && 'bg-red-500/10')}
          onClick={() => setActiveCell({ row: globalIndex, col })} title={hint ? `Suggestion: ${hint}` : undefined}>
          {acTypeMap.get(val as string)?.icao_type || <span className="text-muted-foreground">—</span>}
          {hint && !val && <span className="text-[9px] text-muted-foreground/60 ml-1">{hint}</span>}
        </td>
      )
    }

    if (col === 'service_type') {
      if (isActive) {
        return (
          <td key={col} className="p-0">
            <select ref={inputRef as unknown as React.RefObject<HTMLSelectElement>} value={editValue}
              onChange={e => { setEditValue(e.target.value); updateField(globalIndex, col, e.target.value); setActiveCell(null) }}
              onBlur={() => setActiveCell(null)}
              onKeyDown={e => handleKeyDown(e, globalIndex, col)}
              className="w-full h-full px-1 py-0.5 bg-background text-sm font-mono border-2 border-primary focus:outline-none" autoFocus>
              <option value="">—</option>
              {flightServiceTypes.map(s => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
              {flightServiceTypes.length === 0 && ['J','C','F','G','P'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </td>
        )
      }
      const fst = flightServiceTypes.find(s => s.code === val)
      return (
        <td key={col} className={cn('px-2 py-0.5 cursor-pointer hover:bg-muted/50 font-mono text-sm', error && 'bg-red-500/10')}
          onClick={() => setActiveCell({ row: globalIndex, col })} title={fst ? `${fst.code} — ${fst.name}` : undefined}>
          {fst ? (
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: fst.color || '#6B9DAD' }} />
              {fst.code}
            </span>
          ) : (String(val || '') || <span className="text-muted-foreground">—</span>)}
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
              className="w-full h-full px-1 py-0.5 bg-background text-sm font-mono border-2 border-primary focus:outline-none" autoFocus />
          </td>
        )
      }
      return (
        <td key={col} className="px-2 py-0.5 cursor-pointer hover:bg-muted/50 text-sm font-mono"
          onClick={() => setActiveCell({ row: globalIndex, col })}>
          {val ? formatDateDisplay(String(val)) : <span className="text-muted-foreground">—</span>}
        </td>
      )
    }

    // Text/number cells
    if (isActive) {
      return (
        <td key={col} className={cn('p-0', error && 'ring-2 ring-red-500 ring-inset')}>
          <input ref={inputRef} value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={() => commitCell(globalIndex, col)}
            onKeyDown={e => handleKeyDown(e, globalIndex, col)}
            className="w-full h-full px-2 py-0.5 bg-background text-sm font-mono border-2 border-primary focus:outline-none"
            type="text"
            autoFocus />
        </td>
      )
    }

    let displayVal: React.ReactNode = val != null && val !== '' && val !== 0 ? String(val) : <span className="text-muted-foreground">—</span>

    // Time display with colon and timezone conversion
    if ((col === 'std' || col === 'sta') && val) {
      const timeStr = formatTimeForDisplay(String(val), row.departure_iata, row.arrival_iata, col)
      displayVal = timeStr
    }

    // STA with day offset badge
    if (col === 'sta' && row.arrival_day_offset > 0 && val) {
      const timeStr = formatTimeForDisplay(String(val), row.departure_iata, row.arrival_iata, 'sta')
      displayVal = <span>{timeStr} <span className="text-[9px] bg-amber-500/20 text-amber-600 px-0.5 rounded">+1</span></span>
    }

    // Block time display in HH:MM format
    if (col === 'block_minutes' && val) {
      displayVal = formatBlockTime(Number(val))
    }

    return (
      <td key={col} className={cn(
        'px-2 py-0.5 cursor-pointer hover:bg-muted/50 font-mono text-sm whitespace-nowrap',
        error && 'bg-red-500/10',
        col === 'block_minutes' && val && (Number(val) < 30 || Number(val) > 1200) && 'text-red-500',
      )} onClick={() => setActiveCell({ row: globalIndex, col })} title={error || undefined}>
        {displayVal}
      </td>
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
          {timeMode === 'utc' ? 'UTC' : timeMode === 'local_station' ? 'Local' : 'Base'}
        </Button>

        <div className="h-6 w-px bg-border" />

        <select value={filters.aircraftType} onChange={e => setFilters(p => ({ ...p, aircraftType: e.target.value }))}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">All A/C Types</option>
          {aircraftTypes.map(t => <option key={t.id} value={t.id}>{t.icao_type}</option>)}
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
          {flights.filter(f => !f._isNew).length} flights
        </span>

        <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
          <Upload className="h-4 w-4 mr-1" />Import
        </Button>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="h-4 w-4 mr-1" />Export
        </Button>
        <Button size="sm" onClick={() => {
          // Auto-chain: set DEP from last data row's ARR
          const dataRows = flights.filter(f => !f._isNew && f.arrival_iata)
          const lastDataRow = dataRows[dataRows.length - 1]
          if (lastDataRow) {
            const lastNew = flights.findIndex(f => f._isNew)
            if (lastNew >= 0 && !flights[lastNew].departure_iata) {
              setFlights(prev => prev.map((f, i) => i === lastNew ? { ...f, departure_iata: lastDataRow.arrival_iata } : f))
            }
          }
          const lastNew = flights.findIndex(f => f._isNew)
          if (lastNew >= 0) setActiveCell({ row: lastNew, col: 'flight_number' })
        }}>
          <Plus className="h-4 w-4 mr-1" />New Flight
        </Button>
      </div>

      {/* Bulk toolbar */}
      {selectedCount > 0 && (
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

      {/* Grid */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading flights...</div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 border-b">
                <th className="w-8 px-2 py-1.5">
                  <input type="checkbox" checked={flights.filter(f => !f._isNew).length > 0 && flights.filter(f => !f._isNew).every(f => f._selected)}
                    onChange={toggleSelectAll} className="rounded" />
                </th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground">Flt#</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground">DEP</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground">ARR</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground">{getTimeHeader('STD')}</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground">{getTimeHeader('STA')}</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground">Block Hr</th>
                <th className="px-2 py-1.5 text-center text-xs font-semibold text-muted-foreground">Day of Week</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground">A/C Type</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground">Service Type</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground">From</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground">To</th>
                <th className="px-2 py-1.5 text-right text-xs font-semibold text-muted-foreground w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFlights.map((row, fIdx) => {
                const gIdx = flights.indexOf(row)
                const saveErr = row._errors._save
                return (
                  <tr key={row.id}
                    className={cn(
                      'border-b transition-colors duration-300',
                      row._savedFlash && 'bg-green-500/10',
                      row._isSaving && 'opacity-70',
                      row._isNew && !row.flight_number && 'bg-muted/20',
                      saveErr && 'bg-red-500/5',
                    )}>
                    <td className="px-2 py-0.5 w-8">
                      {!row._isNew && (
                        <input type="checkbox" checked={row._selected}
                          onChange={() => setFlights(prev => prev.map((f, i) => i === gIdx ? { ...f, _selected: !f._selected } : f))}
                          className="rounded" />
                      )}
                    </td>
                    {renderCell(fIdx, 'flight_number', row)}
                    {renderCell(fIdx, 'departure_iata', row)}
                    {renderCell(fIdx, 'arrival_iata', row)}
                    {renderCell(fIdx, 'std', row)}
                    {renderCell(fIdx, 'sta', row)}
                    {renderCell(fIdx, 'block_minutes', row)}
                    {renderCell(fIdx, 'days_of_week', row)}
                    {renderCell(fIdx, 'aircraft_type_id', row)}
                    {renderCell(fIdx, 'service_type', row)}
                    {renderCell(fIdx, 'effective_from', row)}
                    {renderCell(fIdx, 'effective_until', row)}
                    <td className="px-1 py-0.5 text-right whitespace-nowrap">
                      {!row._isNew && (
                        <div className="flex justify-end gap-0.5">
                          <button onClick={() => handleReturn(gIdx)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            title={row.aircraft_type_id ? `Return flight (TAT: ${lookupTat(row.arrival_iata, row.aircraft_type_id).minutes}m — ${lookupTat(row.arrival_iata, row.aircraft_type_id).source})` : 'Create return flight'}>
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
                      )}
                      {saveErr && (
                        <span className="text-[9px] text-destructive" title={saveErr}>
                          <AlertTriangle className="h-3 w-3 inline" />
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
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
            {aircraftTypes.map(t => <option key={t.id} value={t.id}>{t.icao_type} — {t.name}</option>)}
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
