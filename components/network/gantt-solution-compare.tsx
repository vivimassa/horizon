'use client'

import { X, Trash2, Plane } from 'lucide-react'

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
    avgDailyUsed: number
  }[]
  totalUsed: number
  totalAC: number
  spareAC: number
  bufferPct: number
  peakDailyAC: number
  avgDailyAC: number
  avgDailySpare: number
  avgUtilPerAC: number
  numDays: number
  downgrades: number
  upgrades: number
  seatsLost: number
  seatsGained: number
  revenueAtRisk: number
  extraOpsCost: number
  fuelTons: number
  fuelCost: number
  opsCost: number
  overflowRevenueLoss: number
  chainBreakCosts: number
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
  onClearAll: () => void
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
  onClearAll,
  onClose,
  s,
  fuelPrice,
}: Props) {
  // Find best values across all slots for highlighting
  const best = {
    overflow: Math.min(...slots.map(s => s.metrics.overflow)),
    chainBreaks: Math.min(...slots.map(s => s.metrics.chainBreaks)),
    peakDailyAC: Math.min(...slots.map(s => s.metrics.peakDailyAC)),
    avgDailyAC: Math.min(...slots.map(s => s.metrics.avgDailyAC)),
    avgUtilPerAC: Math.max(...slots.map(s => s.metrics.avgUtilPerAC)),
    totalCost: Math.min(...slots.map(s => s.metrics.totalCost)),
    seatsLost: Math.min(...slots.map(s => s.metrics.seatsLost)),
    revenueAtRisk: Math.min(...slots.map(s => s.metrics.revenueAtRisk)),
  }

  const cheapest = best.totalCost

  return (
    <div
      className="bg-background/95 backdrop-blur-xl border border-border/60 shadow-2xl flex flex-col overflow-hidden"
      style={{ borderRadius: s(14), maxHeight: '100%' }}
    >
      {/* ── Header ── */}
      <div
        className="shrink-0 flex items-center justify-between border-b"
        style={{ padding: `${s(14)}px ${s(20)}px` }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: s(16), fontWeight: 600 }}>Solution Comparison</span>
          <span
            className="text-muted-foreground font-mono"
            style={{ fontSize: s(11) }}
          >
            {slots.length}/3 slots
          </span>
        </div>
        <div className="flex items-center" style={{ gap: s(8) }}>
          <button
            onClick={onClearAll}
            className="flex items-center text-muted-foreground hover:text-red-500 transition-colors rounded-md"
            style={{ padding: `${s(4)}px ${s(10)}px`, gap: s(5), fontSize: s(12) }}
          >
            <Trash2 style={{ width: s(14), height: s(14) }} />
            <span>Clear All</span>
          </button>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors rounded-md"
            style={{ padding: s(5) }}
          >
            <X style={{ width: s(16), height: s(16) }} />
          </button>
        </div>
      </div>

      {/* ── Scrollable Body ── */}
      <div className="flex-1 overflow-y-auto" style={{ padding: s(20) }}>
      {/* Always 3-column grid; cards are centered when fewer than 3 */}
      <div
        className="grid justify-center"
        style={{
          gridTemplateColumns: `repeat(3, ${s(370)}px)`,
          gap: s(10),
        }}
      >
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
                border: isActive ? '2px solid hsl(var(--primary))' : '1.5px solid hsl(var(--foreground) / 0.15)',
                borderRadius: s(12),
                padding: s(16),
                background: isActive ? 'hsl(var(--primary) / 0.03)' : 'transparent',
              }}
            >
              {/* Delete button */}
              <div
                className="absolute opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ top: s(8), right: s(8) }}
              >
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); onDeleteSlot(slot.id) }}
                  className="text-muted-foreground/50 hover:text-red-500 transition-colors cursor-pointer"
                >
                  <Trash2 style={{ width: s(13), height: s(13) }} />
                </span>
              </div>

              {/* Card header */}
              <div className="flex items-center gap-2" style={{ marginBottom: s(6) }}>
                <span
                  style={{
                    fontSize: s(15),
                    fontWeight: 600,
                    color: isActive ? 'hsl(var(--primary))' : 'inherit',
                  }}
                >
                  {slot.label}
                </span>
                {isActive && (
                  <span
                    style={{
                      fontSize: s(9),
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'hsl(var(--primary))',
                      background: 'hsl(var(--primary) / 0.1)',
                      padding: `${s(2)}px ${s(7)}px`,
                      borderRadius: s(4),
                    }}
                  >
                    Viewing
                  </span>
                )}
                {slot.settings.familySub && (
                  <span
                    className="inline-flex items-center"
                    style={{
                      fontSize: s(9),
                      fontWeight: 600,
                      color: '#3B82F6',
                      background: 'rgba(59,130,246,0.1)',
                      padding: `${s(2)}px ${s(7)}px`,
                      borderRadius: s(4),
                      gap: s(3),
                    }}
                  >
                    <Plane style={{ width: s(10), height: s(10) }} />
                    A/C Type Flexible
                  </span>
                )}
              </div>
              <div
                className="font-mono text-muted-foreground/50"
                style={{ fontSize: s(10), marginBottom: s(10) }}
              >
                {slot.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>

              {/* ── ASSIGNMENT ── */}
              <SectionLabel s={s}>Optimization Results</SectionLabel>
              <div className="grid grid-cols-2" style={{ gap: s(6), marginBottom: s(12) }}>
                <Kpi s={s} label="Assigned" value={`${m.assigned.toLocaleString()}/${m.totalFlights.toLocaleString()}`} big />
                <Kpi
                  s={s}
                  label="Uncovered Flights"
                  value={String(m.overflow)}
                  bad={m.overflow > 0}
                  good={m.overflow === best.overflow && m.overflow === 0}
                  big
                />
                <Kpi
                  s={s}
                  label="DEP/ARR Incompatibility"
                  value={String(m.chainBreaks)}
                  bad={m.chainBreaks > 0}
                  good={m.chainBreaks === best.chainBreaks && m.chainBreaks === 0}
                />
                <Kpi s={s} label="Rule Violations" value={String(m.rulesBent)} />
              </div>

              {/* ── FLEET (daily averages) ── */}
              <SectionLabel s={s}>Fleet (avg/day over {m.numDays}d)</SectionLabel>
              <div style={{ marginBottom: s(12) }}>
                {m.fleetByType.map(ft => (
                  <div key={ft.icaoType} className="flex items-center" style={{ gap: s(6), marginBottom: s(5) }}>
                    <span
                      className="font-mono font-semibold"
                      style={{ fontSize: s(11), width: s(36) }}
                    >
                      {ft.icaoType}
                    </span>
                    <span
                      className="text-muted-foreground"
                      style={{ fontSize: s(11), width: s(50) }}
                    >
                      {Math.round(ft.avgDailyUsed)}/{ft.total}
                    </span>
                    {/* Utilization bar */}
                    <div
                      style={{
                        flex: 1,
                        height: s(6),
                        borderRadius: s(3),
                        background: 'hsl(var(--border) / 0.5)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${ft.total > 0 ? Math.min((ft.avgDailyUsed / ft.total) * 100, 100) : 0}%`,
                          height: '100%',
                          borderRadius: s(3),
                          background: 'hsl(var(--primary) / 0.6)',
                          transition: 'width 0.3s',
                        }}
                      />
                    </div>
                    <span
                      className="text-muted-foreground font-mono"
                      style={{ fontSize: s(10), width: s(40), textAlign: 'right' }}
                    >
                      {ft.avgUtil}h
                    </span>
                  </div>
                ))}
                <div className="grid grid-cols-2" style={{ gap: s(6), marginTop: s(8) }}>
                  <Kpi
                    s={s}
                    label="Max Aircraft Required"
                    value={String(m.peakDailyAC)}
                    good={m.peakDailyAC === best.peakDailyAC && slots.length > 1}
                  />
                  <Kpi
                    s={s}
                    label="AVG Aircraft used/day"
                    value={String(m.avgDailyAC)}
                    good={m.avgDailyAC === best.avgDailyAC && slots.length > 1}
                  />
                  <Kpi
                    s={s}
                    label="AVG Standby Aircraft/day"
                    value={`${m.avgDailySpare} (${m.bufferPct}%)`}
                    bad={m.bufferPct < 10}
                  />
                  <Kpi
                    s={s}
                    label="AVG Utilization/day"
                    value={`${m.avgUtilPerAC}h`}
                    good={m.avgUtilPerAC === best.avgUtilPerAC && slots.length > 1}
                  />
                </div>
              </div>

              {/* ── SUBSTITUTION ── */}
              <SectionLabel s={s}>Substitution Impact</SectionLabel>
              <div style={{ marginBottom: s(12) }}>
                {m.downgrades === 0 && m.upgrades === 0 ? (
                  <div
                    className="text-muted-foreground/60 italic"
                    style={{ fontSize: s(11), marginBottom: s(4) }}
                  >
                    No substitutions
                  </div>
                ) : (
                  <div className="grid grid-cols-2" style={{ gap: s(6) }}>
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
              <div className="grid grid-cols-2" style={{ gap: s(6) }}>
                <Kpi s={s} label={`Fuel (${m.fuelTons.toLocaleString()}t)`} value={fmt$(m.fuelCost)} />
                <Kpi s={s} label="Operating Costs" value={fmt$(m.opsCost)} />
                {m.overflowRevenueLoss > 0 && (
                  <Kpi s={s} label="Revenue at Risk" value={fmt$(m.overflowRevenueLoss)} bad />
                )}
                {m.chainBreakCosts > 0 && (
                  <Kpi s={s} label="Ferry Costs" value={fmt$(m.chainBreakCosts)} bad />
                )}
              </div>
              <div
                className="flex items-center justify-between"
                style={{ marginTop: s(8), paddingTop: s(8), borderTop: '1px dashed var(--border)' }}
              >
                <span className="font-mono font-bold" style={{ fontSize: s(18) }}>
                  {fmt$(m.totalCost)}
                </span>
                {slots.length > 1 && (
                  <span
                    className="font-mono font-semibold"
                    style={{
                      fontSize: s(11),
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
      </div>

      {/* ── Footer ── */}
      <div
        className="shrink-0 flex items-center justify-between text-muted-foreground border-t"
        style={{ padding: `${s(10)}px ${s(20)}px`, fontSize: s(11) }}
      >
        <span className="italic">
          Select a solution then click Assign All to commit
        </span>
        <span className="font-mono" style={{ fontSize: s(10) }}>
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
        fontSize: s(9),
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: s(5),
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
        <span className="text-muted-foreground" style={{ fontSize: s(11) }}>{label}:</span>
        <span className="font-mono font-semibold" style={{ fontSize: s(12), color }}>{value}</span>
      </span>
    )
  }

  return (
    <div>
      <div className="text-muted-foreground" style={{ fontSize: s(11) }}>{label}</div>
      <div
        className="font-mono font-semibold"
        style={{ fontSize: big ? s(16) : s(13), fontWeight: big ? 700 : 600, color }}
      >
        {value}
      </div>
    </div>
  )
}
