'use client'

import { useState, useEffect, useRef } from 'react'
import { X, RotateCcw, Check, Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { AircraftType } from '@/types/database'
import { getBarTextColor } from '@/lib/utils/color-helpers'
import { type GanttSettingsData } from '@/lib/constants/gantt-settings'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

// ─── Color Presets ────────────────────────────────────────────────────────

const UNASSIGNED_PRESETS = [
  '#DBEAFE', '#E0E7FF', '#E0F2FE', '#F0F9FF',
  '#F1F5F9', '#ECFEFF', '#EDE9FE', '#F0FDFA',
]

const ASSIGNED_PRESETS = [
  '#3B82F6', '#2563EB', '#1D4ED8', '#6366F1',
  '#0EA5E9', '#8B5CF6', '#0891B2', '#059669',
]

// ─── Props ────────────────────────────────────────────────────────────────

interface GanttSettingsPanelProps {
  open: boolean
  onClose: () => void
  settings: GanttSettingsData
  aircraftTypes: AircraftType[]
  saveStatus: 'idle' | 'saving' | 'saved'
  onUpdateDisplay: (key: keyof GanttSettingsData['display'], value: boolean) => void
  onUpdateBarColors: (colors: Partial<GanttSettingsData['barColors']>) => void
  onUpdateSettings: (partial: Partial<GanttSettingsData>) => void
  onUpdateUtilTarget: (icaoType: string, hours: number) => void
  onResetUtilTarget: (icaoType: string) => void
  onUpdateTatOverride: (icaoType: string, overrides: { dd?: number; di?: number; id?: number; ii?: number }) => void
  onResetTatOverride: (icaoType: string) => void
  onResetAll: () => void
}

// ─── Component ────────────────────────────────────────────────────────────

export function GanttSettingsPanel({
  open, onClose, settings, aircraftTypes, saveStatus,
  onUpdateDisplay, onUpdateBarColors, onUpdateSettings,
  onUpdateUtilTarget, onResetUtilTarget,
  onUpdateTatOverride, onResetTatOverride, onResetAll,
}: GanttSettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)

  // Safe accessors — guard against partial/undefined settings from storage
  const display = settings.display ?? { histogram: true, eodBadges: true, tatLabels: true, conflictIndicators: true, workspaceIcons: true, cancelledFlights: false }
  const barColors = settings.barColors ?? { unassigned: '#DBEAFE', assigned: '#3B82F6' }
  const barLabelFormat = settings.barLabelFormat ?? 'full'
  const utilizationTargets = settings.utilizationTargets ?? {}
  const tatOverrides = settings.tatOverrides ?? {}

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
    }
    window.addEventListener('keydown', handleKey, true)
    return () => window.removeEventListener('keydown', handleKey, true)
  }, [open, onClose])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Delay to avoid closing on the same click that opens
    const t = setTimeout(() => document.addEventListener('mousedown', handleClick), 100)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handleClick) }
  }, [open, onClose])

  // Group AC types by family
  const activeTypes = aircraftTypes.filter(t => t.is_active).sort((a, b) => a.icao_type.localeCompare(b.icao_type))
  const familyGroups = new Map<string, AircraftType[]>()
  for (const t of activeTypes) {
    const key = t.family || t.icao_type
    const list = familyGroups.get(key) || []
    list.push(t)
    familyGroups.set(key, list)
  }

  const getCategoryDefault = (category: string): number => {
    if (category === 'widebody') return 14
    if (category === 'regional') return 10
    return 12
  }

  return (
    <div
      ref={panelRef}
      className="absolute top-0 right-0 bottom-0 w-[320px] z-25 flex flex-col overflow-hidden transition-transform duration-200"
      style={{
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        background: 'var(--glass-bg-heavy)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderLeft: '1px solid var(--glass-border-heavy)',
        boxShadow: open ? '-8px 0 32px rgba(0,0,0,0.08)' : 'none',
      }}
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold">Gantt Settings</span>
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
              <Loader2 className="h-2.5 w-2.5 animate-spin" /> Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-[9px] text-green-600 dark:text-green-400">
              <Check className="h-2.5 w-2.5" /> Saved
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">

        {/* ─── Section 1: Display Preferences ─────────────────────── */}
        <section>
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Display Preferences
          </h3>
          <div className="space-y-2.5">
            <DisplayToggle
              label="Show flight count histogram"
              checked={display.histogram}
              onChange={(v) => onUpdateDisplay('histogram', v)}
            />
            <DisplayToggle
              label="Show end-of-day location badges"
              checked={display.eodBadges}
              onChange={(v) => onUpdateDisplay('eodBadges', v)}
            />
            <DisplayToggle
              label="Show TAT labels between flights"
              checked={display.tatLabels}
              onChange={(v) => onUpdateDisplay('tatLabels', v)}
            />
            <DisplayToggle
              label="Show conflict indicators"
              checked={display.conflictIndicators}
              onChange={(v) => onUpdateDisplay('conflictIndicators', v)}
            />
            <DisplayToggle
              label="Show workspace placement icons"
              checked={display.workspaceIcons}
              onChange={(v) => onUpdateDisplay('workspaceIcons', v)}
            />
            <DisplayToggle
              label="Show cancelled flights"
              checked={display.cancelledFlights}
              onChange={(v) => onUpdateDisplay('cancelledFlights', v)}
            />
          </div>
        </section>

        {/* ─── Section 2: Bar Label Format ────────────────────────── */}
        <section>
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Bar Label Format
          </h3>
          <div className="space-y-1.5">
            <FormatRadio
              value="full"
              label="Flight number + Sector + Times"
              current={barLabelFormat}
              onChange={(v) => onUpdateSettings({ barLabelFormat: v as GanttSettingsData['barLabelFormat'] })}
            />
            <FormatRadio
              value="number_sector"
              label="Flight number + Sector"
              current={barLabelFormat}
              onChange={(v) => onUpdateSettings({ barLabelFormat: v as GanttSettingsData['barLabelFormat'] })}
            />
            <FormatRadio
              value="number"
              label="Flight number only"
              current={barLabelFormat}
              onChange={(v) => onUpdateSettings({ barLabelFormat: v as GanttSettingsData['barLabelFormat'] })}
            />
            <FormatRadio
              value="sector"
              label="Sector only"
              current={barLabelFormat}
              onChange={(v) => onUpdateSettings({ barLabelFormat: v as GanttSettingsData['barLabelFormat'] })}
            />
          </div>
          <p className="text-[9px] text-muted-foreground/60 mt-2">
            Compact and mini bar formats adapt automatically.
          </p>
        </section>

        {/* ─── Section 3: Bar Colors ──────────────────────────────── */}
        <section>
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Bar Colors
          </h3>
          <div className="space-y-4">
            {/* Unassigned */}
            <ColorPicker
              label="Unassigned Flights"
              color={barColors.unassigned}
              presets={UNASSIGNED_PRESETS}
              onChange={(c) => onUpdateBarColors({ unassigned: c })}
            />
            {/* Assigned */}
            <ColorPicker
              label="Tail-Assigned Flights"
              color={barColors.assigned}
              presets={ASSIGNED_PRESETS}
              onChange={(c) => onUpdateBarColors({ assigned: c })}
            />
            {/* Preview */}
            <div>
              <div className="text-[10px] text-muted-foreground mb-1.5">Preview</div>
              <div className="grid grid-cols-2 gap-1.5">
                <PreviewBar label="Pub + Assigned" bg={barColors.assigned} solid isAssigned />
                <PreviewBar label="Pub + Unasgn" bg={barColors.unassigned} solid />
                <PreviewBar label="Draft + Assigned" bg={barColors.assigned} solid={false} isAssigned />
                <PreviewBar label="Draft + Unasgn" bg={barColors.unassigned} solid={false} />
              </div>
            </div>
          </div>
        </section>

        {/* ─── Section 4: Utilization Targets ─────────────────────── */}
        <section>
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Utilization Targets
          </h3>
          <div className="space-y-3">
            {Array.from(familyGroups.entries()).map(([family, types]) => (
              <div key={family}>
                {familyGroups.size > 1 && types[0].family && (
                  <div className="text-[9px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1">
                    {family}
                  </div>
                )}
                {types.map(t => {
                  const catDefault = getCategoryDefault(t.category)
                  const current = utilizationTargets[t.icao_type]
                  const displayVal = current ?? catDefault
                  const pct = Math.round((displayVal / 18) * 100)
                  return (
                    <div key={t.id} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium w-[50px]">{t.icao_type}</span>
                        <span className="text-[9px] text-muted-foreground">{t.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={4}
                          max={20}
                          step={0.5}
                          value={displayVal}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value)
                            if (!isNaN(v) && v >= 4 && v <= 20) onUpdateUtilTarget(t.icao_type, v)
                          }}
                          className="w-[60px] text-[11px] text-center px-1.5 py-0.5 rounded border border-border bg-transparent"
                        />
                        <span className="text-[9px] text-muted-foreground w-[32px] text-right">{pct}%</span>
                        {current !== undefined && (
                          <button
                            onClick={() => onResetUtilTarget(t.icao_type)}
                            className="p-0.5 rounded hover:bg-muted transition-colors"
                            title="Reset to default"
                          >
                            <RotateCcw className="h-2.5 w-2.5 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </section>

        {/* ─── Section 5: TAT Overrides ───────────────────────────── */}
        <section>
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Turnaround Time Overrides
          </h3>
          <div className="space-y-3">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_44px_44px_44px_44px_20px] gap-1 text-[8px] font-medium text-muted-foreground/60 uppercase tracking-wider">
              <span>Type</span>
              <span className="text-center">DD</span>
              <span className="text-center">DI</span>
              <span className="text-center">ID</span>
              <span className="text-center">II</span>
              <span />
            </div>
            {activeTypes.map(t => {
              const overrides = tatOverrides[t.icao_type] || {}
              return (
                <div key={t.id} className="grid grid-cols-[1fr_44px_44px_44px_44px_20px] gap-1 items-center">
                  <span className="text-[10px] font-medium truncate">{t.icao_type}</span>
                  <TatInput
                    value={overrides.dd}
                    placeholder={t.tat_dom_dom_minutes ?? t.default_tat_minutes ?? undefined}
                    onChange={(v) => onUpdateTatOverride(t.icao_type, { dd: v })}
                  />
                  <TatInput
                    value={overrides.di}
                    placeholder={t.tat_dom_int_minutes ?? t.default_tat_minutes ?? undefined}
                    onChange={(v) => onUpdateTatOverride(t.icao_type, { di: v })}
                  />
                  <TatInput
                    value={overrides.id}
                    placeholder={t.tat_int_dom_minutes ?? t.default_tat_minutes ?? undefined}
                    onChange={(v) => onUpdateTatOverride(t.icao_type, { id: v })}
                  />
                  <TatInput
                    value={overrides.ii}
                    placeholder={t.tat_int_int_minutes ?? t.default_tat_minutes ?? undefined}
                    onChange={(v) => onUpdateTatOverride(t.icao_type, { ii: v })}
                  />
                  {Object.keys(overrides).length > 0 && (
                    <button
                      onClick={() => onResetTatOverride(t.icao_type)}
                      className="p-0.5 rounded hover:bg-muted transition-colors"
                      title="Reset to defaults"
                    >
                      <RotateCcw className="h-2.5 w-2.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-[9px] text-muted-foreground/60 mt-2">
            Overrides apply to Gantt conflict detection only.
          </p>
        </section>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-3 border-t">
        <button
          onClick={() => setResetConfirmOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-medium rounded-md border border-border hover:bg-muted transition-colors text-muted-foreground"
        >
          <RotateCcw className="h-3 w-3" />
          Reset All to Defaults
        </button>
      </div>

      {/* Reset Confirmation Dialog */}
      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <RotateCcw className="h-4 w-4" />
              Reset All Settings
            </DialogTitle>
          </DialogHeader>
          <p className="text-[11px] text-muted-foreground">
            This will reset all Gantt settings to their default values including display preferences, bar colors, utilization targets, and TAT overrides.
          </p>
          <DialogFooter className="mt-2">
            <button
              onClick={() => setResetConfirmOpen(false)}
              className="px-3 py-1.5 text-[11px] font-medium rounded-md border border-border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onResetAll()
                setResetConfirmOpen(false)
              }}
              className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
            >
              Reset All
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────

function DisplayToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-[11px] group-hover:text-foreground transition-colors">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  )
}

function FormatRadio({ value, label, current, onChange }: { value: string; label: string; current: string; onChange: (v: string) => void }) {
  return (
    <label
      className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
        current === value ? 'bg-primary/8 border border-primary/30' : 'hover:bg-muted/30 border border-transparent'
      }`}
      onClick={() => onChange(value)}
    >
      <input
        type="radio"
        name="barLabelFormat"
        checked={current === value}
        onChange={() => onChange(value)}
        className="accent-primary"
      />
      <span className="text-[11px]">{label}</span>
    </label>
  )
}

function ColorPicker({ label, color, presets, onChange }: { label: string; color: string; presets: string[]; onChange: (c: string) => void }) {
  const [hexInput, setHexInput] = useState(color)

  useEffect(() => { setHexInput(color) }, [color])

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <label className="relative cursor-pointer shrink-0">
          <div
            className="w-7 h-7 rounded-lg border border-border"
            style={{ background: color }}
          />
          <input
            type="color"
            value={color}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
        <input
          type="text"
          value={hexInput}
          onChange={(e) => {
            setHexInput(e.target.value)
            if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value)
          }}
          className="w-[72px] text-[10px] px-1.5 py-1 rounded border border-border bg-transparent font-mono"
        />
      </div>
      {/* Presets */}
      <div className="flex items-center gap-1">
        {presets.map(p => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`w-5 h-5 rounded-md border transition-all ${color === p ? 'border-primary ring-1 ring-primary/30 scale-110' : 'border-border/50 hover:scale-105'}`}
            style={{ background: p }}
            title={p}
          />
        ))}
      </div>
    </div>
  )
}

function PreviewBar({ label, bg, solid, isAssigned }: { label: string; bg: string; solid: boolean; isAssigned?: boolean }) {
  return (
    <div
      className="h-6 px-2 rounded-[4px] flex items-center text-[8px]"
      style={{
        background: bg,
        border: solid
          ? isAssigned
            ? '1.5px solid var(--gantt-bar-border-pub-assigned)'
            : '1.5px solid var(--gantt-bar-border-pub)'
          : '1.5px dashed var(--gantt-bar-border-draft)',
        fontStyle: solid ? 'normal' : 'italic',
        color: getBarTextColor(bg, false),
      }}
    >
      {label}
    </div>
  )
}

function TatInput({ value, placeholder, onChange }: { value: number | undefined; placeholder: number | undefined; onChange: (v: number | undefined) => void }) {
  return (
    <input
      type="number"
      min={15}
      max={180}
      step={5}
      value={value ?? ''}
      placeholder={placeholder !== undefined ? String(placeholder) : '—'}
      onChange={(e) => {
        const raw = e.target.value
        if (raw === '') { onChange(undefined); return }
        const v = parseInt(raw, 10)
        if (!isNaN(v) && v >= 15 && v <= 180) onChange(v)
      }}
      className="w-full text-[10px] text-center px-0.5 py-0.5 rounded border border-border bg-transparent placeholder:text-muted-foreground/30"
    />
  )
}
