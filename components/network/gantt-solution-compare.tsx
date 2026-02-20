'use client'

import { X, Trash2 } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────

export interface SolutionMetrics {
  totalFlights: number
  assigned: number
  overflow: number
  chainBreaks: number
  rulesBent: number
  fleetByType: {
    icaoType: string
    used: number
    total: number
    blockHours: number
    avgUtil: number
  }[]
  totalUsed: number
  totalAC: number
  spareAC: number
  bufferPct: number
  downgrades: number
  upgrades: number
  seatsLost: number
  seatsGained: number
  revenueAtRisk: number
  extraOpsCost: number
  fuelTons: number
  fuelCost: number
  opsCost: number
  totalCost: number
}

export interface SolutionSlot {
  id: number
  result: { assignments: Map<string, string>; overflow: any[]; chainBreaks: any[]; ruleViolations: Map<string, any[]>; rejections: Map<string, any[]>; summary: any }
  method: string
  settings: {
    tatMode: 'scheduled' | 'minimum'
    familySub: boolean
    saPreset?: string
    mipPreset?: string
  }
  timestamp: Date
  label: string
  metrics: SolutionMetrics
}

interface Props {
  slots: SolutionSlot[]
  activeSlotId: number | null
  onSelectSlot: (id: number) => void
  onDeleteSlot: (id: number) => void
  onClose: () => void
  s: (n: number) => number
  fuelPrice: number
}

// ─── Helpers ──────────────────────────────────────────────────────────

function fmt$(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
  return `$${n}`
}

function fmtNum(n: number): string {
  return n.toLocaleString()
}

// ─── Component ────────────────────────────────────────────────────────

export function GanttSolutionCompare({
  slots,
  activeSlotId,
  onSelectSlot,
  onDeleteSlot,
  onClose,
  s,
  fuelPrice,
}: Props) {
  // Find best values across all slots for highlighting
  const best = {
    overflow: Math.min(...slots.map(s => s.metrics.overflow)),
    chainBreaks: Math.min(...slots.map(s => s.metrics.chainBreaks)),
    totalUsed: Math.min(...slots.map(s => s.metrics.totalUsed)),
    bufferPct: Math.max(...slots.map(s => s.metrics.bufferPct)),
    totalCost: Math.min(...slots.map(s => s.metrics.totalCost)),
    seatsLost: Math.min(...slots.map(s => s.metrics.seatsLost)),
    revenueAtRisk: Math.min(...slots.map(s => s.metrics.revenueAtRisk)),
  }

  const cheapest = best.totalCost

  return (
    <div
      className="bg-background/95 backdrop-blur-xl border border-border/80 shadow-xl"
      style={{ borderRadius: s(12), padding: s(12), overflow: 'hidden' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: s(10) }}>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: s(13), fontWeight: 600 }}>Solution Comparison</span>
          <span
            className="text-muted-foreground font-mono"
            style={{ fontSize: s(9) }}
          >
            {slots.length}/3 slots
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors rounded-md"
          style={{ padding: s(4) }}
        >
          <X style={{ width: s(14), height: s(14) }} />
        </button>
      </div>

      {/* Cards grid */}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(slots.length, 3)}, 1fr)` }}>
        {slots.map(slot => {
          const m = slot.metrics
          const isActive = slot.id === activeSlotId
          const isCheapest = m.totalCost === cheapest && slots.length > 1
          const costDelta = m.totalCost - cheapest

          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => onSelectSlot(slot.id)}
              className={`text-left transition-all duration-200 relative group ${
                isActive ? 'ring-2 ring-primary/50' : 'hover:bg-muted/30'
              }`}
              style={{
                border: isActive ? '1.5px solid hsl(var(--primary))' : '1.5px solid var(--border)',
                borderRadius: s(10),
                padding: s(10),
                background: isActive ? 'hsl(var(--primary) / 0.03)' : 'transparent',
              }}
            >
              {/* Delete button */}
              <div
                className="absolute opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ top: s(6), right: s(6) }}
              >
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); onDeleteSlot(slot.id) }}
                  className="text-muted-foreground/50 hover:text-red-500 transition-colors cursor-pointer"
                >
                  <Trash2 style={{ width: s(11), height: s(11) }} />
                </span>
              </div>

              {/* Card header */}
              <div className="flex items-center gap-1.5" style={{ marginBottom: s(8) }}>
                <span
                  style={{
                    fontSize: s(12),
                    fontWeight: 600,
                    color: isActive ? 'hsl(var(--primary))' : 'inherit',
                  }}
                >
                  {slot.label}
                </span>
                {isActive && (
                  <span
                    style={{
                      fontSize: s(7),
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'hsl(var(--primary))',
                      background: 'hsl(var(--primary) / 0.1)',
                      padding: `${s(1)}px ${s(5)}px`,
                      borderRadius: s(3),
                    }}
                  >
                    Viewing
                  </span>
                )}
              </div>
              <div
                className="font-mono text-muted-foreground/50"
                style={{ fontSize: s(8), marginBottom: s(8) }}
              >
                {slot.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>

              {/* ── ASSIGNMENT ── */}
              <SectionLabel s={s}>Assignment</SectionLabel>
              <div className="grid grid-cols-2" style={{ gap: s(4), marginBottom: s(8) }}>
                <Kpi s={s} label="Assigned" value={`${m.assigned}/${m.totalFlights}`} big />
                <Kpi
                  s={s}
                  label="Overflow"
                  value={String(m.overflow)}
                  bad={m.overflow > 0}
                  good={m.overflow === best.overflow && m.overflow === 0}
                  big
                />
                <Kpi
                  s={s}
                  label="Chain Breaks"
                  value={String(m.chainBreaks)}
                  bad={m.chainBreaks > 0}
                  good={m.chainBreaks === best.chainBreaks && m.chainBreaks === 0}
                />
                <Kpi s={s} label="Rules Bent" value={String(m.rulesBent)} />
              </div>

              {/* ── FLEET ── */}
              <SectionLabel s={s}>Fleet</SectionLabel>
              <div style={{ marginBottom: s(8) }}>
                {m.fleetByType.map(ft => (
                  <div key={ft.icaoType} className="flex items-center" style={{ gap: s(4), marginBottom: s(3) }}>
                    <span
                      className="font-mono font-semibold"
                      style={{ fontSize: s(9), width: s(28) }}
                    >
                      {ft.icaoType}
                    </span>
                    <span
                      className="text-muted-foreground"
                      style={{ fontSize: s(9), width: s(36) }}
                    >
                      {ft.used}/{ft.total}
                    </span>
                    {/* Utilization bar */}
                    <div
                      style={{
                        flex: 1,
                        height: s(4),
                        borderRadius: s(2),
                        background: 'hsl(var(--border) / 0.5)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${ft.total > 0 ? Math.min((ft.used / ft.total) * 100, 100) : 0}%`,
                          height: '100%',
                          borderRadius: s(2),
                          background: 'hsl(var(--primary) / 0.6)',
                          transition: 'width 0.3s',
                        }}
                      />
                    </div>
                    <span
                      className="text-muted-foreground font-mono"
                      style={{ fontSize: s(8), width: s(32), textAlign: 'right' }}
                    >
                      {ft.avgUtil}h
                    </span>
                  </div>
                ))}
                <div
                  className="flex items-center justify-between"
                  style={{ marginTop: s(4) }}
                >
                  <Kpi
                    s={s}
                    label="AC Used"
                    value={String(m.totalUsed)}
                    good={m.totalUsed === best.totalUsed && slots.length > 1}
                    inline
                  />
                  <Kpi
                    s={s}
                    label="Spare"
                    value={`${m.spareAC} (${m.bufferPct}%)`}
                    bad={m.bufferPct < 10}
                    inline
                  />
                </div>
              </div>

              {/* ── SUBSTITUTION ── */}
              <SectionLabel s={s}>Substitution Impact</SectionLabel>
              <div style={{ marginBottom: s(8) }}>
                {m.downgrades === 0 && m.upgrades === 0 ? (
                  <div
                    className="text-muted-foreground/60 italic"
                    style={{ fontSize: s(9), marginBottom: s(4) }}
                  >
                    No substitutions
                  </div>
                ) : (
                  <div className="grid grid-cols-2" style={{ gap: s(4) }}>
                    <Kpi
                      s={s}
                      label="Downgrades"
                      value={`${m.downgrades} (−${fmtNum(m.seatsLost)} seats)`}
                      bad={m.downgrades > 0}
                    />
                    <Kpi
                      s={s}
                      label="Upgrades"
                      value={`${m.upgrades} (+${fmtNum(m.seatsGained)} seats)`}
                    />
                    <Kpi
                      s={s}
                      label="Rev. at Risk"
                      value={fmt$(m.revenueAtRisk)}
                      bad={m.revenueAtRisk > 0}
                      good={m.revenueAtRisk === best.revenueAtRisk && m.revenueAtRisk === 0}
                    />
                    <Kpi s={s} label="Extra Ops Cost" value={fmt$(m.extraOpsCost)} />
                  </div>
                )}
              </div>

              {/* ── EST. DAILY COST ── */}
              <SectionLabel s={s}>Est. Daily Cost</SectionLabel>
              <div className="grid grid-cols-2" style={{ gap: s(4) }}>
                <Kpi s={s} label={`Fuel (${m.fuelTons}t)`} value={fmt$(m.fuelCost)} />
                <Kpi s={s} label="Operations" value={fmt$(m.opsCost)} />
              </div>
              <div
                className="flex items-center justify-between"
                style={{ marginTop: s(6), paddingTop: s(6), borderTop: '1px dashed var(--border)' }}
              >
                <span className="font-mono font-bold" style={{ fontSize: s(14) }}>
                  {fmt$(m.totalCost)}
                </span>
                {slots.length > 1 && (
                  <span
                    className="font-mono font-semibold"
                    style={{
                      fontSize: s(9),
                      color: isCheapest ? '#22C55E' : '#EF4444',
                    }}
                  >
                    {isCheapest ? '★ cheapest' : `+${fmt$(costDelta)}`}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between text-muted-foreground"
        style={{ marginTop: s(8), fontSize: s(9) }}
      >
        <span className="italic">
          Select a solution then click Assign All to commit
        </span>
        <span className="font-mono" style={{ fontSize: s(8) }}>
          Cost estimates based on operator rates &middot; Fuel at ${fuelPrice.toFixed(2)}/kg
        </span>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────

function SectionLabel({ s, children }: { s: (n: number) => number; children: React.ReactNode }) {
  return (
    <div
      className="text-muted-foreground"
      style={{
        fontSize: s(7),
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: s(4),
      }}
    >
      {children}
    </div>
  )
}

function Kpi({
  s,
  label,
  value,
  big,
  bad,
  good,
  inline,
}: {
  s: (n: number) => number
  label: string
  value: string
  big?: boolean
  bad?: boolean
  good?: boolean
  inline?: boolean
}) {
  const color = bad ? '#EF4444' : good ? '#22C55E' : undefined

  if (inline) {
    return (
      <span className="flex items-center gap-1">
        <span className="text-muted-foreground" style={{ fontSize: s(9) }}>{label}:</span>
        <span className="font-mono font-semibold" style={{ fontSize: s(10), color }}>{value}</span>
      </span>
    )
  }

  return (
    <div>
      <div className="text-muted-foreground" style={{ fontSize: s(9) }}>{label}</div>
      <div
        className="font-mono font-semibold"
        style={{ fontSize: big ? s(13) : s(10), fontWeight: big ? 700 : 600, color }}
      >
        {value}
      </div>
    </div>
  )
}
