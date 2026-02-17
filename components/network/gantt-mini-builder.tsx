'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, ExternalLink, Plus } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { toast } from '@/components/ui/visionos-toast'
import { friendlyError } from '@/lib/utils/error-handler'
import { saveRoute, type SaveRouteInput } from '@/app/actions/aircraft-routes'
import type { GanttRouteData, GanttRouteLeg } from '@/app/actions/gantt'

// ─── Types ────────────────────────────────────────────────────

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
  aircraftReg: string | null
  assignedReg: string | null
}

interface MiniLeg {
  id: string
  flightId: string | null
  dayOffset: number
  airlineCode: string | null
  flightNumber: number | null
  depStation: string
  arrStation: string
  stdLocal: string
  staLocal: string
  blockMinutes: number | null
  arrivesNextDay: boolean
  serviceType: string
}

export interface MiniBuilderProps {
  open: boolean
  onClose: () => void
  flight: ExpandedFlight
  route: GanttRouteData | null
  loading: boolean
  onSaved: () => void
}

// ─── Helpers ──────────────────────────────────────────────────

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

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function computeBlockMinutes(std: string, sta: string): number {
  if (!std || !sta) return 0
  const stdMin = timeToMinutes(std)
  const staMin = timeToMinutes(sta)
  if (staMin >= stdMin) return staMin - stdMin
  return (1440 - stdMin) + staMin
}

function formatBlock(minutes: number | null): string {
  if (!minutes) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

// ─── Column definitions ────────────────────────────────────────

const COLS = ['dayOffset', 'flightNumber', 'depStation', 'arrStation', 'stdLocal', 'staLocal', 'blockMinutes', 'serviceType', 'acReg'] as const
type ColKey = typeof COLS[number]

const COL_LABELS: Record<ColKey, string> = {
  dayOffset: 'DAY',
  flightNumber: 'FLT NO',
  depStation: 'DEP',
  arrStation: 'ARR',
  stdLocal: 'STD',
  staLocal: 'STA',
  blockMinutes: 'BLOCK',
  serviceType: 'SVC',
  acReg: 'AC REG',
}

const COL_WIDTHS: Record<ColKey, string> = {
  dayOffset: 'w-[40px]',
  flightNumber: 'w-[70px]',
  depStation: 'w-[55px]',
  arrStation: 'w-[55px]',
  stdLocal: 'w-[60px]',
  staLocal: 'w-[60px]',
  blockMinutes: 'w-[60px]',
  serviceType: 'w-[42px]',
  acReg: 'w-[80px]',
}

const EDITABLE_COLS: ColKey[] = ['dayOffset', 'flightNumber', 'depStation', 'arrStation', 'stdLocal', 'staLocal', 'serviceType']

// ─── DOW helper ───────────────────────────────────────────────

const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

// ─── Component ────────────────────────────────────────────────

export function MiniBuilderModal({ open, onClose, flight, route, loading, onSaved }: MiniBuilderProps) {
  const [legs, setLegs] = useState<MiniLeg[]>([])
  const [dow, setDow] = useState('1234567')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isPublished = route?.status === 'published'

  // Build chain string
  const chain = legs.length > 0
    ? legs.map(l => l.depStation).concat(legs[legs.length - 1]?.arrStation || '').filter(Boolean).join(' \u2192 ')
    : ''

  // ─── Initialize from route / flight ──────────────────────────

  useEffect(() => {
    if (!open) return

    if (route) {
      setLegs(route.legs.map(l => ({
        id: l.id,
        flightId: l.flightId,
        dayOffset: l.dayOffset,
        airlineCode: l.airlineCode,
        flightNumber: l.flightNumber,
        depStation: l.depStation,
        arrStation: l.arrStation,
        stdLocal: l.stdLocal,
        staLocal: l.staLocal,
        blockMinutes: l.blockMinutes,
        arrivesNextDay: l.arrivesNextDay,
        serviceType: l.serviceType,
      })))
      setDow(route.daysOfOperation)
      setPeriodStart(route.periodStart || '')
      setPeriodEnd(route.periodEnd || '')
    } else {
      // Single unlinked flight
      const parts = flight.flightNumber.match(/^([A-Z]{2})(\d+)$/)
      setLegs([{
        id: generateId(),
        flightId: flight.flightId,
        dayOffset: 0,
        airlineCode: parts ? parts[1] : null,
        flightNumber: parts ? parseInt(parts[2], 10) : null,
        depStation: flight.depStation,
        arrStation: flight.arrStation,
        stdLocal: flight.stdLocal,
        staLocal: flight.staLocal,
        blockMinutes: flight.blockMinutes,
        arrivesNextDay: false,
        serviceType: 'J',
      }])
      setDow(flight.daysOfOperation)
      setPeriodStart(flight.periodStart)
      setPeriodEnd(flight.periodEnd)
    }
    setEditingCell(null)
  }, [open, route, flight])

  // ─── Focus input when editing ────────────────────────────────

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingCell])

  // ─── Cell value getter ───────────────────────────────────────

  const getCellValue = (leg: MiniLeg, col: ColKey): string => {
    switch (col) {
      case 'dayOffset': return String(leg.dayOffset)
      case 'flightNumber': return leg.flightNumber != null ? String(leg.flightNumber) : ''
      case 'depStation': return leg.depStation
      case 'arrStation': return leg.arrStation
      case 'stdLocal': return leg.stdLocal
      case 'staLocal': return leg.staLocal
      case 'blockMinutes': return formatBlock(leg.blockMinutes)
      case 'serviceType': return leg.serviceType
      case 'acReg': return flight.aircraftReg || flight.assignedReg || flight.aircraftTypeIcao || ''
    }
  }

  // ─── Commit edit ─────────────────────────────────────────────

  const commitEdit = useCallback(() => {
    if (!editingCell) return
    const { row, col } = editingCell
    const colKey = COLS[col]

    setLegs(prev => {
      const next = [...prev]
      const leg = { ...next[row] }

      switch (colKey) {
        case 'dayOffset':
          leg.dayOffset = parseInt(editValue, 10) || 0
          break
        case 'flightNumber':
          leg.flightNumber = editValue ? parseInt(editValue, 10) || null : null
          break
        case 'depStation':
          leg.depStation = editValue.toUpperCase().slice(0, 3)
          break
        case 'arrStation':
          leg.arrStation = editValue.toUpperCase().slice(0, 3)
          break
        case 'stdLocal': {
          const t = normalizeTime(editValue)
          if (t && isValidTime(t)) {
            leg.stdLocal = t
            if (leg.staLocal) leg.blockMinutes = computeBlockMinutes(t, leg.staLocal)
          }
          break
        }
        case 'staLocal': {
          const t = normalizeTime(editValue)
          if (t && isValidTime(t)) {
            leg.staLocal = t
            if (leg.stdLocal) leg.blockMinutes = computeBlockMinutes(leg.stdLocal, t)
            leg.arrivesNextDay = leg.stdLocal ? timeToMinutes(t) < timeToMinutes(leg.stdLocal) : false
          }
          break
        }
        case 'serviceType':
          leg.serviceType = editValue.toUpperCase().slice(0, 1) || 'J'
          break
      }

      // Auto-populate: if this is DEP and prev leg exists, set from prev ARR
      if (colKey === 'depStation' && row > 0 && !leg.depStation) {
        leg.depStation = next[row - 1].arrStation
      }

      next[row] = leg
      return next
    })

    setEditingCell(null)
  }, [editingCell, editValue])

  // ─── Cancel edit ─────────────────────────────────────────────

  const cancelEdit = useCallback(() => {
    setEditingCell(null)
  }, [])

  // ─── Start editing ──────────────────────────────────────────

  const startEdit = useCallback((row: number, col: number) => {
    if (isPublished) return
    const colKey = COLS[col]
    if (colKey === 'blockMinutes') return // computed, not editable
    if (!EDITABLE_COLS.includes(colKey)) return
    const leg = legs[row]
    if (!leg) return
    setEditingCell({ row, col })
    setEditValue(getCellValue(leg, colKey))
  }, [legs, isPublished])

  // ─── Keyboard navigation ────────────────────────────────────

  const handleCellKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!editingCell) return

    if (e.key === 'Escape') {
      e.preventDefault()
      cancelEdit()
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit()
      // Move to next row, same column
      const nextRow = editingCell.row + 1
      if (nextRow < legs.length) {
        setTimeout(() => startEdit(nextRow, editingCell.col), 0)
      }
      return
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      commitEdit()
      // Move to next/prev editable column
      const dir = e.shiftKey ? -1 : 1
      let nextCol = editingCell.col + dir
      while (nextCol >= 0 && nextCol < COLS.length) {
        if (EDITABLE_COLS.includes(COLS[nextCol])) {
          const row = nextCol >= COLS.length ? editingCell.row + 1 : editingCell.row
          setTimeout(() => startEdit(row < legs.length ? row : editingCell.row, nextCol), 0)
          return
        }
        nextCol += dir
      }
      // Wrap to next/prev row
      if (dir === 1 && editingCell.row + 1 < legs.length) {
        setTimeout(() => startEdit(editingCell.row + 1, 0), 0)
      }
      return
    }

    // Arrow keys not intercepted during cell edit — let the input handle them
  }, [editingCell, legs.length, commitEdit, cancelEdit, startEdit])

  // ─── Add new leg ────────────────────────────────────────────

  const addLeg = useCallback(() => {
    if (isPublished) return
    const lastLeg = legs[legs.length - 1]
    setLegs(prev => [...prev, {
      id: generateId(),
      flightId: null,
      dayOffset: lastLeg?.dayOffset || 0,
      airlineCode: lastLeg?.airlineCode || null,
      flightNumber: null,
      depStation: lastLeg?.arrStation || '',
      arrStation: '',
      stdLocal: '',
      staLocal: '',
      blockMinutes: null,
      arrivesNextDay: false,
      serviceType: lastLeg?.serviceType || 'J',
    }])
    // Start editing the flight number of the new row
    setTimeout(() => startEdit(legs.length, 1), 50)
  }, [legs, isPublished, startEdit])

  // ─── Remove leg ─────────────────────────────────────────────

  const removeLeg = useCallback((idx: number) => {
    if (isPublished || legs.length <= 1) return
    setLegs(prev => prev.filter((_, i) => i !== idx))
    if (editingCell && editingCell.row === idx) setEditingCell(null)
  }, [legs.length, isPublished, editingCell])

  // ─── DOW toggle ─────────────────────────────────────────────

  const toggleDow = (dayNum: number) => {
    if (isPublished) return
    const s = String(dayNum)
    setDow(prev => prev.includes(s) ? prev.replace(s, '') : (prev + s).split('').sort().join(''))
  }

  // ─── Save handler ───────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (isPublished || saving) return
    if (legs.length === 0) { toast.error('Add at least one leg'); return }
    if (!periodStart || !periodEnd) { toast.error('Set period dates'); return }

    // Validate all legs
    for (let i = 0; i < legs.length; i++) {
      const l = legs[i]
      if (!l.depStation || !l.arrStation) { toast.error(`Leg ${i + 1}: DEP and ARR are required`); return }
      if (!l.stdLocal || !l.staLocal) { toast.error(`Leg ${i + 1}: STD and STA are required`); return }
    }

    setSaving(true)
    try {
      const input: SaveRouteInput = {
        id: route?.id || null,
        season_id: route?.seasonId || flight.seasonId || '',
        scenario_id: route?.scenarioId || '',
        route_name: route?.routeName || null,
        aircraft_type_id: route?.aircraftTypeId || null,
        aircraft_type_icao: route?.aircraftTypeIcao || flight.aircraftTypeIcao || null,
        days_of_operation: dow,
        period_start: periodStart,
        period_end: periodEnd,
        duration_days: route?.durationDays || 1,
        status: route?.status || 'draft',
        notes: route?.notes || null,
        legs: legs.map(l => ({
          flight_id: l.flightId,
          airline_code: l.airlineCode,
          flight_number: l.flightNumber,
          dep_station: l.depStation,
          arr_station: l.arrStation,
          std_local: l.stdLocal,
          sta_local: l.staLocal,
          block_minutes: l.blockMinutes,
          day_offset: l.dayOffset,
          arrives_next_day: l.arrivesNextDay,
          service_type: l.serviceType,
        })),
      }

      const result = await saveRoute(input)
      if (result.error) {
        toast.error(friendlyError(result.error))
      } else {
        toast.success('Route saved')
        onSaved()
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }, [isPublished, saving, legs, periodStart, periodEnd, dow, route, flight, onSaved, onClose])

  // ─── Find which leg row corresponds to the clicked flight ───

  const highlightLegIdx = route
    ? legs.findIndex(l => l.flightId === flight.flightId)
    : 0

  // ─── Render ─────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent
        className="sm:max-w-[680px] p-0 gap-0 overflow-hidden"
        hideClose
        style={{
          background: 'var(--gantt-tooltip-bg, hsl(var(--card)))',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid var(--gantt-tooltip-border, hsl(var(--border)))',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-sm font-semibold truncate">
              Route {chain || '...'}
            </h2>
            {flight.aircraftTypeIcao && (
              <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-muted text-muted-foreground shrink-0">
                {flight.aircraftTypeIcao}
              </span>
            )}
            {route && (
              <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded shrink-0 ${
                route.status === 'published'
                  ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                  : route.status === 'ready'
                    ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              }`}>
                {route.status}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition-colors shrink-0">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            Loading route...
          </div>
        ) : (
          <>
            {/* Period + DOW */}
            <div className="px-4 py-2.5 border-b space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] font-medium text-muted-foreground">From</label>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={e => setPeriodStart(e.target.value)}
                    disabled={isPublished}
                    className="text-[11px] px-2 py-1 rounded-md border border-border bg-transparent focus:ring-1 focus:ring-primary/30 outline-none disabled:opacity-50"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] font-medium text-muted-foreground">To</label>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={e => setPeriodEnd(e.target.value)}
                    disabled={isPublished}
                    className="text-[11px] px-2 py-1 rounded-md border border-border bg-transparent focus:ring-1 focus:ring-primary/30 outline-none disabled:opacity-50"
                  />
                </div>
              </div>
              <div className="flex items-center gap-1">
                {DOW_LABELS.map((label, i) => {
                  const dayNum = i + 1
                  const active = dow.includes(String(dayNum))
                  return (
                    <button
                      key={dayNum}
                      onClick={() => toggleDow(dayNum)}
                      disabled={isPublished}
                      className={`w-6 h-6 rounded-full text-[10px] font-semibold transition-colors ${
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      } disabled:opacity-50`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Legs Grid */}
            <div className="px-4 py-2 max-h-[340px] overflow-y-auto">
              {/* Header row */}
              <div className="flex items-center gap-0.5 mb-1">
                <div className="w-[20px] shrink-0" /> {/* row # */}
                {COLS.map(col => (
                  <div key={col} className={`${COL_WIDTHS[col]} shrink-0 text-[8px] font-semibold text-muted-foreground/70 uppercase tracking-wider text-center`}>
                    {COL_LABELS[col]}
                  </div>
                ))}
                <div className="w-[24px] shrink-0" /> {/* delete */}
              </div>

              {/* Leg rows */}
              {legs.map((leg, rowIdx) => {
                const isHighlighted = rowIdx === highlightLegIdx
                return (
                  <div
                    key={leg.id}
                    className={`flex items-center gap-0.5 py-0.5 rounded transition-colors ${
                      isHighlighted ? 'bg-primary/5' : ''
                    }`}
                  >
                    {/* Row number */}
                    <div className="w-[20px] shrink-0 text-center text-[9px] text-muted-foreground font-medium">
                      {rowIdx + 1}
                    </div>

                    {/* Cells */}
                    {COLS.map((col, colIdx) => {
                      const isEditing = editingCell?.row === rowIdx && editingCell?.col === colIdx
                      const value = getCellValue(leg, col)
                      const isComputed = col === 'blockMinutes'
                      const isReadOnly = col === 'acReg' || isComputed

                      // AC REG column: special coloring
                      let acRegStyle: React.CSSProperties | undefined
                      if (col === 'acReg') {
                        if (flight.aircraftReg) {
                          // DB-assigned: green
                          acRegStyle = { color: '#16a34a', fontSize: '10px', fontWeight: 600 }
                        } else if (flight.assignedReg) {
                          // Session/auto-assigned: blue italic
                          acRegStyle = { color: '#2563eb', fontSize: '10px', fontStyle: 'italic' }
                        } else {
                          // Fallback: muted
                          acRegStyle = { color: '#9ca3af', fontSize: '10px' }
                        }
                      }

                      return (
                        <div
                          key={col}
                          className={`${COL_WIDTHS[col]} shrink-0 h-[28px] flex items-center justify-center rounded-md text-[11px] transition-all cursor-default ${
                            isEditing
                              ? 'ring-2 ring-primary/40 bg-background'
                              : isReadOnly
                                ? 'bg-muted/30 text-muted-foreground'
                                : 'hover:bg-muted/30'
                          } ${isHighlighted && !isEditing ? 'border border-primary/20' : ''}`}
                          onClick={() => {
                            if (!isEditing && !isReadOnly) startEdit(rowIdx, colIdx)
                          }}
                        >
                          {isEditing ? (
                            <input
                              ref={inputRef}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={handleCellKeyDown}
                              onBlur={commitEdit}
                              className="w-full h-full bg-transparent text-center text-[11px] outline-none"
                              spellCheck={false}
                            />
                          ) : (
                            <span
                              className={`truncate px-1 ${!value ? 'text-muted-foreground/30' : ''}`}
                              style={acRegStyle}
                            >
                              {col === 'acReg' && flight.aircraftReg && (
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-0.5 align-middle" />
                              )}
                              {value || '\u2014'}
                            </span>
                          )}
                        </div>
                      )
                    })}

                    {/* Delete button */}
                    <div className="w-[24px] shrink-0 flex items-center justify-center">
                      {!isPublished && legs.length > 1 && (
                        <button
                          onClick={() => removeLeg(rowIdx)}
                          className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Add row */}
              {!isPublished && (
                <button
                  onClick={addLeg}
                  className="flex items-center gap-1 mt-1 px-2 py-1.5 w-full rounded-md border border-dashed border-border/50 text-[10px] text-muted-foreground hover:bg-muted/30 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Add leg
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t">
              {route?.id ? (
                <a
                  href={`/network/control/schedule-builder?route=${route.id}`}
                  className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open Full Builder
                </a>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                {isPublished && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 mr-2">
                    Unpublish to edit
                  </span>
                )}
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 text-[11px] font-medium rounded-md border border-border hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isPublished || saving}
                  className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Route'}
                </button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
