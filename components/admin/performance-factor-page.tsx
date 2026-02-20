'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Check, ChevronDown, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AircraftType } from '@/types/database'
import { AircraftWithRelations } from '@/app/actions/aircraft-registrations'
import {
  PFRecord,
  PFPeriod,
  createPerformanceFactorPeriod,
  updatePerformanceFactor,
  deletePerformanceFactorPeriod,
} from '@/app/actions/performance-factor'

// ─── Variant color map ──────────────────────────────────────────────────

const VARIANT_COLORS: Record<string, string> = {
  '321-271NX': 'hsl(var(--primary))',
  '321-271N': '#8b5cf6',
  '321-211': '#f59e0b',
  '320-214': '#6b7280',
  '330-941': '#22c55e',
}

function getVariantColor(variant: string | null): string {
  if (!variant) return '#6b7280'
  return VARIANT_COLORS[variant] ?? '#6b7280'
}

function pfColor(pf: number): string {
  if (pf > 5) return '#ef4444'
  if (pf >= 2) return '#f59e0b'
  if (pf < 0) return '#22c55e'
  return 'inherit'
}

function fmtPF(pf: number): string {
  return (pf > 0 ? '+' : '') + pf.toFixed(1)
}

// ─── Props ──────────────────────────────────────────────────────────────

interface Props {
  pfRecords: PFRecord[]
  periods: PFPeriod[]
  registrations: AircraftWithRelations[]
  aircraftTypes: AircraftType[]
}

// ─── Component ──────────────────────────────────────────────────────────

export function PerformanceFactorPage({ pfRecords, periods, registrations, aircraftTypes }: Props) {
  const router = useRouter()
  const [selectedPeriod, setSelectedPeriod] = useState<string>(periods[0]?.period_name ?? '')
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [variantFilter, setVariantFilter] = useState<string>('all')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [newPeriodOpen, setNewPeriodOpen] = useState(false)

  // Burn rate lookup
  const burnRateByType = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of aircraftTypes) m.set(t.icao_type, t.fuel_burn_rate_kg_per_hour ?? 0)
    return m
  }, [aircraftTypes])

  // Filter records for selected period
  const periodRecords = useMemo(() => {
    if (!selectedPeriod) return []
    return pfRecords.filter(r => r.period_name === selectedPeriod)
  }, [pfRecords, selectedPeriod])

  // Unique types + variants in current period
  const types = useMemo(() => Array.from(new Set(periodRecords.map(r => r.icao_type))).sort(), [periodRecords])
  const variants = useMemo(() => Array.from(new Set(periodRecords.map(r => r.variant).filter(Boolean) as string[])).sort(), [periodRecords])

  // Filtered + sorted records
  const filteredRecords = useMemo(() => {
    let items = periodRecords
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      items = items.filter(r =>
        r.registration.toLowerCase().includes(q) ||
        r.icao_type.toLowerCase().includes(q) ||
        (r.variant || '').toLowerCase().includes(q)
      )
    }
    if (typeFilter !== 'all') items = items.filter(r => r.icao_type === typeFilter)
    if (variantFilter !== 'all') items = items.filter(r => r.variant === variantFilter)
    items = [...items].sort((a, b) =>
      sortDir === 'desc' ? b.performance_factor - a.performance_factor : a.performance_factor - b.performance_factor
    )
    return items
  }, [periodRecords, searchQuery, typeFilter, variantFilter, sortDir])

  // Stats
  const stats = useMemo(() => {
    if (periodRecords.length === 0) return null
    const pfs = periodRecords.map(r => r.performance_factor)
    const avg = pfs.reduce((a, b) => a + b, 0) / pfs.length
    const sorted = [...periodRecords].sort((a, b) => a.performance_factor - b.performance_factor)
    const best = sorted[0]
    const worst = sorted[sorted.length - 1]
    return {
      count: periodRecords.length,
      totalAC: registrations.length,
      avg: Math.round(avg * 10) / 10,
      best,
      worst,
    }
  }, [periodRecords, registrations])

  const currentPeriodInfo = periods.find(p => p.period_name === selectedPeriod)

  return (
    <div className="space-y-5 p-6 overflow-y-auto h-full custom-scrollbar">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Aircraft Performance Factor</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Fuel burn adjustment per aircraft from FOE. Affects optimizer cost estimates and OCC planning.
          </p>
        </div>
        <Button onClick={() => setNewPeriodOpen(true)} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New Period
        </Button>
      </div>

      {/* ── Fleet Overview ── */}
      {stats && (
        <div className="grid grid-cols-4 gap-2">
          <StatCard title="Fleet Coverage" value={`${stats.count} / ${stats.totalAC}`} subtitle="aircraft with PF data" />
          <StatCard
            title="Avg Performance Factor"
            value={`${fmtPF(stats.avg)}%`}
            subtitle="fleet-wide average"
            valueColor={pfColor(stats.avg)}
          />
          <StatCard
            title="Most Efficient"
            value={stats.best.registration}
            subtitle={`${fmtPF(stats.best.performance_factor)}% | ${stats.best.variant || stats.best.icao_type}`}
            subtitleColor="#22c55e"
          />
          <StatCard
            title="Least Efficient"
            value={stats.worst.registration}
            subtitle={`${fmtPF(stats.worst.performance_factor)}% | ${stats.worst.variant || stats.worst.icao_type}`}
            subtitleColor="#ef4444"
          />
        </div>
      )}

      {/* ── Period Selector ── */}
      {periods.length > 0 && (
        <div className="glass rounded-xl p-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <select
              value={selectedPeriod}
              onChange={e => setSelectedPeriod(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-3 text-sm font-medium"
            >
              {periods.map((p, i) => (
                <option key={p.period_name} value={p.period_name}>
                  {p.period_name}{i === 0 ? ' (Current)' : ''}
                </option>
              ))}
            </select>
          </div>
          {currentPeriodInfo && (
            <span className="text-[11px] text-muted-foreground">
              Effective: {currentPeriodInfo.effective_from} — {currentPeriodInfo.effective_to || 'ongoing'} | {currentPeriodInfo.count} aircraft
            </span>
          )}
          {periods.length > 0 && selectedPeriod && (
            <button
              onClick={async () => {
                if (!confirm(`Delete period "${selectedPeriod}" and all its entries?`)) return
                await deletePerformanceFactorPeriod(selectedPeriod)
                router.refresh()
              }}
              className="ml-auto text-[11px] text-muted-foreground hover:text-red-500 transition-colors flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" /> Delete period
            </button>
          )}
        </div>
      )}

      {/* ── Distribution Chart ── */}
      {periodRecords.length > 0 && (
        <DistributionChart records={periodRecords} />
      )}

      {/* ── Filter Bar ── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search registration..."
            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm glass outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-3 text-xs"
        >
          <option value="all">All Types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={variantFilter}
          onChange={e => setVariantFilter(e.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-3 text-xs"
        >
          <option value="all">All Variants</option>
          {variants.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select
          value={sortDir}
          onChange={e => setSortDir(e.target.value as 'desc' | 'asc')}
          className="h-9 rounded-lg border border-input bg-background px-3 text-xs"
        >
          <option value="desc">PF High → Low</option>
          <option value="asc">PF Low → High</option>
        </select>
      </div>

      {/* ── Table ── */}
      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="text-left px-3 py-2.5 font-medium w-[30px]">#</th>
              <th className="text-left px-3 py-2.5 font-medium w-[100px]">Registration</th>
              <th className="text-left px-3 py-2.5 font-medium w-[50px]">Type</th>
              <th className="text-left px-3 py-2.5 font-medium w-[100px]">Variant</th>
              <th className="text-right px-3 py-2.5 font-medium w-[80px]">PF (%)</th>
              <th className="text-right px-3 py-2.5 font-medium w-[90px]">Eff. Burn</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-muted-foreground py-8">
                {periods.length === 0 ? 'No performance factor periods. Click "+ New Period" to start.' : 'No matching records.'}
              </td></tr>
            ) : filteredRecords.map((r, i) => (
              <PFRow
                key={r.id}
                record={r}
                index={i + 1}
                baseBurn={burnRateByType.get(r.icao_type) ?? 0}
                onRefresh={() => router.refresh()}
              />
            ))}
          </tbody>
        </table>
        {/* Footer */}
        {stats && (
          <div className="border-t px-3 py-2 text-[10px] text-muted-foreground flex items-center gap-4">
            <span>{stats.count} aircraft</span>
            <span>Avg PF: {fmtPF(stats.avg)}%</span>
            <span className="ml-auto">
              Base rates — {Array.from(burnRateByType.entries()).filter(([, v]) => v > 0).map(([k, v]) => `${k}: ${v.toLocaleString()} kg/h`).join(', ')}
            </span>
          </div>
        )}
      </div>

      {/* ── New Period Dialog ── */}
      <NewPeriodDialog
        open={newPeriodOpen}
        onOpenChange={setNewPeriodOpen}
        registrations={registrations}
        aircraftTypes={aircraftTypes}
        previousRecords={periodRecords}
        previousPeriodName={selectedPeriod}
        onCreated={() => { setNewPeriodOpen(false); router.refresh() }}
      />
    </div>
  )
}

// ─── Stat Card ──────────────────────────────────────────────────────────

function StatCard({ title, value, subtitle, valueColor, subtitleColor }: {
  title: string; value: string; subtitle: string; valueColor?: string; subtitleColor?: string
}) {
  return (
    <div className="glass rounded-xl p-3">
      <div className="text-[11px] text-muted-foreground mb-1">{title}</div>
      <div className="text-[15px] font-bold font-mono tracking-tight" style={{ color: valueColor }}>{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5" style={{ color: subtitleColor }}>{subtitle}</div>
    </div>
  )
}

// ─── Distribution Chart ──────────────────────────────────────────────────

function DistributionChart({ records }: { records: PFRecord[] }) {
  const [hovered, setHovered] = useState<PFRecord | null>(null)

  // Compute bins
  const minPF = Math.min(-2, ...records.map(r => r.performance_factor))
  const maxPF = Math.max(10, ...records.map(r => r.performance_factor))
  const range = maxPF - minPF

  // Bin records by 0.5% increments for stacking
  const binSize = 0.5
  const bins = new Map<number, PFRecord[]>()
  for (const r of records) {
    const bin = Math.round(r.performance_factor / binSize) * binSize
    if (!bins.has(bin)) bins.set(bin, [])
    bins.get(bin)!.push(r)
  }

  // Zero line position
  const zeroPos = ((0 - minPF) / range) * 100

  // Unique variants for legend
  const variantSet = new Set(records.map(r => r.variant).filter(Boolean) as string[])
  const variantList = Array.from(variantSet).sort()

  return (
    <div className="glass rounded-xl p-3">
      <div className="text-[11px] text-muted-foreground mb-2 font-medium">Distribution</div>
      <div className="relative" style={{ height: 100 }}>
        {/* Zero line */}
        <div
          className="absolute top-0 bottom-0 border-l border-dashed border-muted-foreground/30"
          style={{ left: `${zeroPos}%` }}
        />
        <div
          className="absolute text-[9px] text-muted-foreground"
          style={{ left: `${zeroPos}%`, bottom: -14, transform: 'translateX(-50%)' }}
        >
          0%
        </div>

        {/* Dots */}
        {Array.from(bins.entries()).map(([bin, recs]) =>
          recs.map((r, stackIdx) => {
            const x = ((bin - minPF) / range) * 100
            const y = 90 - stackIdx * 10
            return (
              <div
                key={r.id}
                className="absolute rounded-full transition-transform hover:scale-150 cursor-default"
                style={{
                  width: 8,
                  height: 8,
                  backgroundColor: getVariantColor(r.variant),
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: 'translate(-50%, -50%)',
                  opacity: hovered && hovered.id !== r.id ? 0.3 : 1,
                }}
                onMouseEnter={() => setHovered(r)}
                onMouseLeave={() => setHovered(null)}
              />
            )
          })
        )}

        {/* Tooltip */}
        {hovered && (
          <div
            className="absolute z-10 glass rounded-lg px-2 py-1 text-[10px] font-mono pointer-events-none shadow-lg border"
            style={{
              left: `${((hovered.performance_factor - minPF) / range) * 100}%`,
              top: -8,
              transform: 'translateX(-50%)',
              whiteSpace: 'nowrap',
            }}
          >
            {hovered.registration} | {hovered.variant || hovered.icao_type} | {fmtPF(hovered.performance_factor)}%
          </div>
        )}

        {/* X-axis labels */}
        <div className="absolute text-[9px] text-muted-foreground" style={{ left: 0, bottom: -14 }}>
          {minPF}%
        </div>
        <div className="absolute text-[9px] text-muted-foreground" style={{ right: 0, bottom: -14 }}>
          {maxPF}%
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-5">
        {variantList.map(v => (
          <div key={v} className="flex items-center gap-1">
            <div className="rounded-full" style={{ width: 6, height: 6, backgroundColor: getVariantColor(v) }} />
            <span className="text-[10px] text-muted-foreground font-mono">{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Inline-editable PF Row ─────────────────────────────────────────────

function PFRow({ record, index, baseBurn, onRefresh }: {
  record: PFRecord; index: number; baseBurn: number; onRefresh: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(record.performance_factor))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const effectiveBurn = baseBurn > 0 ? Math.round(baseBurn * (1 + record.performance_factor / 100)) : 0

  const handleSave = useCallback(async () => {
    const num = parseFloat(value)
    if (isNaN(num) || num === record.performance_factor) {
      setEditing(false)
      return
    }
    setSaving(true)
    await updatePerformanceFactor(record.id, num)
    setSaving(false)
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
    onRefresh()
  }, [value, record.id, record.performance_factor, onRefresh])

  const pf = record.performance_factor

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors" style={{ height: 36 }}>
      <td className="px-3 font-mono text-muted-foreground">{index}</td>
      <td className="px-3 font-mono font-medium">{record.registration}</td>
      <td className="px-3 font-mono">{record.icao_type}</td>
      <td className="px-3 font-mono">{record.variant || '—'}</td>
      <td className="px-3 text-right font-mono">
        {editing ? (
          <input
            ref={inputRef}
            type="number"
            step="0.1"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
            onBlur={handleSave}
            disabled={saving}
            className="w-16 h-6 text-right text-xs font-mono rounded border border-primary/30 bg-background px-1 outline-none focus:ring-1 focus:ring-primary/40"
            autoFocus
          />
        ) : (
          <button
            onClick={() => { setEditing(true); setValue(String(record.performance_factor)) }}
            className="inline-flex items-center gap-1 hover:bg-muted/50 rounded px-1 py-0.5 transition-colors"
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: pfColor(pf) }}
            />
            <span style={{ color: pfColor(pf) }}>{fmtPF(pf)}</span>
            {saved && <Check className="h-3 w-3 text-green-500" />}
          </button>
        )}
      </td>
      <td className="px-3 text-right font-mono text-muted-foreground">
        {effectiveBurn > 0 ? `${effectiveBurn.toLocaleString()} kg/h` : '—'}
      </td>
    </tr>
  )
}

// ─── New Period Dialog ──────────────────────────────────────────────────

function NewPeriodDialog({ open, onOpenChange, registrations, aircraftTypes, previousRecords, previousPeriodName, onCreated }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  registrations: AircraftWithRelations[]
  aircraftTypes: AircraftType[]
  previousRecords: PFRecord[]
  previousPeriodName: string
  onCreated: () => void
}) {
  const [periodName, setPeriodName] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [effectiveTo, setEffectiveTo] = useState('')
  const [copyPrevious, setCopyPrevious] = useState(true)
  const [saving, setSaving] = useState(false)

  // Build entries from registrations, optionally pre-filled from previous
  const prevByAircraftId = useMemo(() => {
    const m = new Map<string, PFRecord>()
    for (const r of previousRecords) m.set(r.aircraft_id, r)
    return m
  }, [previousRecords])

  const activeAircraft = useMemo(
    () => registrations.filter(r => r.status === 'active' || r.status === 'operational'),
    [registrations]
  )

  const [entries, setEntries] = useState<{ aircraftId: string; reg: string; icaoType: string; variant: string; prevPF: number; newPF: number }[]>([])

  // Initialize entries when dialog opens
  const initEntries = useCallback(() => {
    const list = activeAircraft.map(ac => {
      const prev = prevByAircraftId.get(ac.id)
      return {
        aircraftId: ac.id,
        reg: ac.registration,
        icaoType: ac.aircraft_types?.icao_type || '',
        variant: prev?.variant || ac.variant || '',
        prevPF: prev?.performance_factor ?? ac.performance_factor ?? 0,
        newPF: copyPrevious ? (prev?.performance_factor ?? ac.performance_factor ?? 0) : 0,
      }
    })
    list.sort((a, b) => b.prevPF - a.prevPF)
    setEntries(list)
  }, [activeAircraft, prevByAircraftId, copyPrevious])

  // Re-init when copy toggle changes or dialog opens
  useMemo(() => { if (open) initEntries() }, [open, initEntries])

  function updateEntry(idx: number, field: 'newPF' | 'variant', value: string) {
    setEntries(prev => {
      const next = [...prev]
      if (field === 'newPF') next[idx] = { ...next[idx], newPF: parseFloat(value) || 0 }
      else next[idx] = { ...next[idx], variant: value }
      return next
    })
  }

  async function handleSave() {
    if (!periodName.trim() || !effectiveFrom) return
    setSaving(true)
    const result = await createPerformanceFactorPeriod({
      periodName: periodName.trim(),
      effectiveFrom,
      effectiveTo: effectiveTo || null,
      entries: entries.map(e => ({
        aircraftId: e.aircraftId,
        performanceFactor: e.newPF,
        variant: e.variant || null,
      })),
    })
    setSaving(false)
    if (result.error) {
      alert(`Error: ${result.error}`)
    } else {
      onCreated()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[700px] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>New Performance Factor Period</DialogTitle>
          <DialogDescription>
            Create a new PF period for the fleet. Values will update the aircraft master data.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Period Name</Label>
            <Input value={periodName} onChange={e => setPeriodName(e.target.value)} placeholder="Q1 2026" className="h-8 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Effective From</Label>
            <Input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Effective To</Label>
            <Input type="date" value={effectiveTo} onChange={e => setEffectiveTo(e.target.value)} placeholder="Leave blank for ongoing" className="h-8 text-sm" />
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs mt-1">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="init" checked={copyPrevious} onChange={() => setCopyPrevious(true)} className="accent-primary" />
            Copy from {previousPeriodName || 'previous'}
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="init" checked={!copyPrevious} onChange={() => setCopyPrevious(false)} className="accent-primary" />
            Start from scratch (all 0)
          </label>
        </div>

        {/* Scrollable table */}
        <div className="flex-1 overflow-y-auto border rounded-lg mt-2" style={{ maxHeight: 400 }}>
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background border-b">
              <tr className="text-muted-foreground">
                <th className="text-left px-2 py-2 font-medium">Registration</th>
                <th className="text-left px-2 py-2 font-medium">Type</th>
                <th className="text-left px-2 py-2 font-medium">Variant</th>
                <th className="text-right px-2 py-2 font-medium">Prev PF</th>
                <th className="text-right px-2 py-2 font-medium">New PF</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e.aircraftId} className="border-b last:border-0 hover:bg-muted/20" style={{ height: 32 }}>
                  <td className="px-2 font-mono font-medium">{e.reg}</td>
                  <td className="px-2 font-mono">{e.icaoType}</td>
                  <td className="px-2">
                    <input
                      value={e.variant}
                      onChange={ev => updateEntry(i, 'variant', ev.target.value)}
                      className="w-24 h-6 text-xs font-mono rounded border border-input bg-background px-1"
                    />
                  </td>
                  <td className="px-2 text-right font-mono text-muted-foreground" style={{ color: pfColor(e.prevPF) }}>
                    {fmtPF(e.prevPF)}
                  </td>
                  <td className="px-2 text-right">
                    <input
                      type="number"
                      step="0.1"
                      value={e.newPF}
                      onChange={ev => updateEntry(i, 'newPF', ev.target.value)}
                      className="w-16 h-6 text-right text-xs font-mono rounded border border-input bg-background px-1 focus:ring-1 focus:ring-primary/40 outline-none"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !periodName.trim() || !effectiveFrom}>
            {saving ? 'Saving...' : `Save Period (${entries.length} aircraft)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
