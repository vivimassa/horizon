'use client'

import { useState, useMemo } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { validateSwap, type SwapFlight, type SwapWarning } from '@/lib/utils/swap-validation'

// ─── Types ─────────────────────────────────────────────────────

export interface SwapExpandedFlight {
  id: string
  flightId: string
  flightNumber: string
  depStation: string
  arrStation: string
  stdLocal: string
  staLocal: string
  blockMinutes: number
  stdMinutes: number
  staMinutes: number
  date: Date
  aircraftTypeIcao: string | null
  routeType: string | null
}

export interface FlightDateItem {
  flightId: string
  flightDate: string
}

export interface SwapFlightsDialogProps {
  open: boolean
  onClose: () => void
  sideA: SwapExpandedFlight[]
  regA: string
  acTypeA: string
  acConfigA?: string
  sideB: SwapExpandedFlight[]
  regB: string
  acTypeB: string
  acConfigB?: string
  rowAFlights: SwapExpandedFlight[]
  rowBFlights: SwapExpandedFlight[]
  tatMinutes: Map<string, number>
  onConfirm: (sideAItems: FlightDateItem[], sideBItems: FlightDateItem[], regA: string, regB: string) => Promise<void>
  container?: HTMLElement | null
}

// ─── Helpers ───────────────────────────────────────────────────

function formatISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatBlockTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h${String(m).padStart(2, '0')}m`
}

function toSwapFlight(ef: SwapExpandedFlight): SwapFlight {
  return {
    id: ef.id,
    flightId: ef.flightId,
    depStation: ef.depStation,
    arrStation: ef.arrStation,
    stdMinutes: ef.stdMinutes,
    staMinutes: ef.staMinutes,
    blockMinutes: ef.blockMinutes,
    date: ef.date,
    aircraftTypeIcao: ef.aircraftTypeIcao,
    routeType: ef.routeType,
  }
}

function severityIcon(s: SwapWarning['severity']): string {
  if (s === 'ok') return '\u2713'
  if (s === 'warning') return '\u26A0'
  return '\u2717'
}

function severityColor(s: SwapWarning['severity']): string {
  if (s === 'ok') return 'text-emerald-500'
  if (s === 'warning') return 'text-amber-500'
  return 'text-red-500'
}

// ─── Component ─────────────────────────────────────────────────

export function SwapFlightsDialog({
  open, onClose,
  sideA, regA, acTypeA, acConfigA,
  sideB, regB, acTypeB, acConfigB,
  rowAFlights, rowBFlights, tatMinutes,
  onConfirm, container,
}: SwapFlightsDialogProps) {
  const [swapping, setSwapping] = useState(false)

  const warnings = useMemo(() => {
    if (!open || sideA.length === 0 || sideB.length === 0) return []
    return validateSwap(
      sideA.map(toSwapFlight), regA, acTypeA,
      sideB.map(toSwapFlight), regB, acTypeB,
      rowAFlights.map(toSwapFlight),
      rowBFlights.map(toSwapFlight),
      tatMinutes,
    )
  }, [open, sideA, sideB, regA, regB, acTypeA, acTypeB, rowAFlights, rowBFlights, tatMinutes])

  const hasError = warnings.some(w => w.severity === 'error')

  const totalBlockA = sideA.reduce((s, f) => s + f.blockMinutes, 0)
  const totalBlockB = sideB.reduce((s, f) => s + f.blockMinutes, 0)

  const handleConfirm = async () => {
    if (swapping) return
    setSwapping(true)
    try {
      const itemsA: FlightDateItem[] = sideA.map(f => ({ flightId: f.flightId, flightDate: formatISO(f.date) }))
      const itemsB: FlightDateItem[] = sideB.map(f => ({ flightId: f.flightId, flightDate: formatISO(f.date) }))
      await onConfirm(itemsA, itemsB, regA, regB)
    } finally {
      setSwapping(false)
    }
  }

  // Build result summary lines
  const resultA = sideA.length > 0
    ? `${sideA.map(f => f.flightNumber).join(', ')} \u2192 ${regB}`
    : null
  const resultB = sideB.length > 0
    ? `${sideB.map(f => f.flightNumber).join(', ')} \u2192 ${regA}`
    : null

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-[520px]" container={container}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
            <ArrowLeftRight className="h-4 w-4" />
            Swap Flights
          </DialogTitle>
          <p className="text-[12px] text-muted-foreground">
            Exchange flight assignments between two aircraft
          </p>
        </DialogHeader>

        {/* ── Two-card layout ─────────────────────────────── */}
        <div className="flex items-stretch gap-3 mt-1">
          {/* Side A card */}
          <div className="flex-1 rounded-lg border border-border/60 bg-muted/20 overflow-hidden" style={{ borderLeft: '3px solid hsl(var(--primary))' }}>
            <div className="px-3 py-2">
              <div className="text-[13px] font-semibold">{regA}</div>
              <div className="text-[10px] text-muted-foreground">{acTypeA}{acConfigA ? ` \u00B7 ${acConfigA}` : ''}</div>
            </div>
            <div className="px-3 pb-2 space-y-0.5">
              {sideA.map(f => (
                <div key={f.id} className="flex items-center justify-between text-[11px]">
                  <span className="font-medium">{f.flightNumber}</span>
                  <span className="text-muted-foreground">{f.depStation}-{f.arrStation} {f.stdLocal}</span>
                </div>
              ))}
            </div>
            <div className="px-3 py-1.5 border-t border-border/40 text-[10px] text-muted-foreground flex justify-between">
              <span>{sideA.length} flight{sideA.length !== 1 ? 's' : ''}</span>
              <span>{formatBlockTime(totalBlockA)}</span>
            </div>
          </div>

          {/* Swap icon */}
          <div className="flex items-center">
            <ArrowLeftRight className="h-5 w-5 text-muted-foreground/50" />
          </div>

          {/* Side B card */}
          <div className="flex-1 rounded-lg border border-border/60 bg-muted/20 overflow-hidden" style={{ borderLeft: '3px solid #F59E0B' }}>
            <div className="px-3 py-2">
              <div className="text-[13px] font-semibold">{regB}</div>
              <div className="text-[10px] text-muted-foreground">{acTypeB}{acConfigB ? ` \u00B7 ${acConfigB}` : ''}</div>
            </div>
            <div className="px-3 pb-2 space-y-0.5">
              {sideB.map(f => (
                <div key={f.id} className="flex items-center justify-between text-[11px]">
                  <span className="font-medium">{f.flightNumber}</span>
                  <span className="text-muted-foreground">{f.depStation}-{f.arrStation} {f.stdLocal}</span>
                </div>
              ))}
            </div>
            <div className="px-3 py-1.5 border-t border-border/40 text-[10px] text-muted-foreground flex justify-between">
              <span>{sideB.length} flight{sideB.length !== 1 ? 's' : ''}</span>
              <span>{formatBlockTime(totalBlockB)}</span>
            </div>
          </div>
        </div>

        {/* ── Result summary ──────────────────────────────── */}
        <div className="mt-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-medium mb-1">Result</div>
          <div className="space-y-0.5">
            {resultA && <div className="text-[11px] text-muted-foreground">{resultA}</div>}
            {resultB && <div className="text-[11px] text-muted-foreground">{resultB}</div>}
          </div>
        </div>

        {/* ── Warnings ────────────────────────────────────── */}
        {warnings.length > 0 && (
          <div className="mt-2">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-medium mb-1">Validation</div>
            <div className="space-y-1 max-h-[120px] overflow-y-auto">
              {warnings.map((w, i) => (
                <div key={i} className={`flex items-start gap-1.5 text-[11px] ${severityColor(w.severity)}`}>
                  <span className="mt-px font-medium shrink-0">{severityIcon(w.severity)}</span>
                  <span>{w.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────── */}
        <DialogFooter className="mt-3">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[11px] font-medium rounded-md border border-border hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={swapping || (hasError)}
            className="px-3 py-1.5 text-[11px] font-medium rounded-md text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
            style={{ backgroundColor: hasError ? undefined : 'hsl(var(--primary))' }}
          >
            <ArrowLeftRight className="h-3 w-3" />
            {swapping ? 'Swapping...' : 'Swap'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
