'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { RotateCcw, Check, Loader2, Settings2, Eye, Palette, Timer, BarChart3, MessageSquare, ChevronDown, GripVertical } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { AircraftType, Airport, FlightServiceType } from '@/types/database'
import { getBarTextColor, getContrastTextColor, desaturate, darkModeVariant } from '@/lib/utils/color-helpers'
import { type MovementSettingsData, AC_TYPE_COLOR_PALETTE } from '@/lib/constants/movement-settings'
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

// ─── Tab Definitions ─────────────────────────────────────────────────────

type SettingsTab = 'general' | 'display' | 'colors' | 'tooltip' | 'turnaround' | 'utilization'

const TABS: { id: SettingsTab; label: string; icon: typeof Settings2 }[] = [
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'display', label: 'Display', icon: Eye },
  { id: 'colors', label: 'Colors', icon: Palette },
  { id: 'tooltip', label: 'Tooltip', icon: MessageSquare },
  { id: 'turnaround', label: 'Turnaround', icon: Timer },
  { id: 'utilization', label: 'Utilization', icon: BarChart3 },
]

// ─── Props ────────────────────────────────────────────────────────────────

export interface FleetPreviewItem {
  icaoType: string
  registration: string
  cabin: string
}

interface MovementSettingsPanelProps {
  open: boolean
  onClose: () => void
  settings: MovementSettingsData
  aircraftTypes: AircraftType[]
  airports: Airport[]
  serviceTypes: FlightServiceType[]
  fleetPreview?: FleetPreviewItem[]
  saveStatus: 'idle' | 'saving' | 'saved'
  onUpdateDisplay: (key: keyof MovementSettingsData['display'], value: boolean) => void
  onUpdateColorAssignment: (colors: Partial<MovementSettingsData['colorAssignment']>) => void
  onUpdateColorAcType: (typeColors: Record<string, string>) => void
  onUpdateColorServiceType: (serviceColors: Record<string, string>) => void
  onUpdateTooltip: (key: keyof MovementSettingsData['tooltip'], value: boolean) => void
  onUpdateSettings: (partial: Partial<MovementSettingsData>) => void
  onUpdateUtilTarget: (icaoType: string, hours: number) => void
  onResetUtilTarget: (icaoType: string) => void
  onUpdateTatOverride: (icaoType: string, overrides: { dd?: number; di?: number; id?: number; ii?: number }) => void
  onResetTatOverride: (icaoType: string) => void
  onResetAll: () => void
  container?: HTMLElement | null
}

// ─── Component ────────────────────────────────────────────────────────────

export function MovementSettingsPanel({
  open, onClose, settings, aircraftTypes, airports, serviceTypes, fleetPreview, saveStatus,
  onUpdateDisplay, onUpdateColorAssignment, onUpdateColorAcType, onUpdateColorServiceType,
  onUpdateTooltip, onUpdateSettings,
  onUpdateUtilTarget, onResetUtilTarget,
  onUpdateTatOverride, onResetTatOverride, onResetAll, container,
}: MovementSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [previewType, setPreviewType] = useState<string | null>(null)

  // Safe accessors
  const display = settings.display
  const colorAssignment = settings.colorAssignment
  const barLabels = settings.barLabels
  const utilizationTargets = settings.utilizationTargets ?? {}
  const tatOverrides = settings.tatOverrides ?? {}

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

  // Active airports with IATA codes for base station dropdown
  const baseStationOptions = useMemo(() =>
    airports
      .filter(a => a.is_active && a.iata_code)
      .sort((a, b) => (a.iata_code ?? '').localeCompare(b.iata_code ?? ''))
  , [airports])

  // Active service types for color tab
  const activeServiceTypes = useMemo(() =>
    serviceTypes.filter(st => st.is_active).sort((a, b) => a.code.localeCompare(b.code))
  , [serviceTypes])

  // Auto-init AC type colors from palette
  const acTypeColors = useMemo(() => {
    const result: Record<string, string> = { ...settings.colorAcType }
    activeTypes.forEach((t, i) => {
      if (!result[t.icao_type]) {
        result[t.icao_type] = AC_TYPE_COLOR_PALETTE[i % AC_TYPE_COLOR_PALETTE.length]
      }
    })
    return result
  }, [settings.colorAcType, activeTypes])

  // Auto-init service type colors from their DB color field
  const serviceTypeColors = useMemo(() => {
    const result: Record<string, string> = { ...settings.colorServiceType }
    activeServiceTypes.forEach((st, i) => {
      if (!result[st.code]) {
        result[st.code] = st.color || AC_TYPE_COLOR_PALETTE[i % AC_TYPE_COLOR_PALETTE.length]
      }
    })
    return result
  }, [settings.colorServiceType, activeServiceTypes])

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
        <DialogContent
          container={container}
          className="max-w-[640px] max-h-[80vh] p-0 gap-0 overflow-hidden"
          style={{
            background: 'var(--glass-bg-heavy)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid var(--glass-border-heavy)',
          }}
        >
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b">
            <div className="flex items-center gap-2.5">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-[14px] font-semibold">Settings</span>
            </div>
            <div className="flex items-center gap-2">
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
          </div>

          {/* Body: Tabs + Content */}
          <div className="flex min-h-0 flex-1" style={{ height: 'calc(80vh - 120px)', maxHeight: 520 }}>
            {/* Left: Vertical tabs */}
            <div className="w-[140px] shrink-0 border-r py-2 flex flex-col">
              {TABS.map(tab => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 text-[11px] font-medium transition-colors text-left ${
                      isActive
                        ? 'text-primary bg-primary/8 border-l-2 border-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/30 border-l-2 border-transparent'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {tab.label}
                  </button>
                )
              })}

              {/* Reset button at bottom of tabs */}
              <div className="mt-auto px-3 pb-2">
                <button
                  onClick={() => setResetConfirmOpen(true)}
                  className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[9px] font-medium rounded-md border border-border hover:bg-muted transition-colors text-muted-foreground"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  Reset All
                </button>
              </div>
            </div>

            {/* Right: Tab content (scrollable) */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {/* ─── General Tab ─────────────────────────────────── */}
              {activeTab === 'general' && (
                <div className="space-y-6">
                  {/* Assignment Method */}
                  <section>
                    <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Assignment Method
                    </h3>
                    <div className="space-y-1.5">
                      <FormatRadio
                        name="assignMethod"
                        value="minimize"
                        label="Minimize aircraft used"
                        current={settings.assignmentMethod ?? 'minimize'}
                        onChange={(v) => onUpdateSettings({ assignmentMethod: v as 'minimize' | 'balance' })}
                      />
                      <FormatRadio
                        name="assignMethod"
                        value="balance"
                        label="Balance hours across fleet"
                        current={settings.assignmentMethod ?? 'minimize'}
                        onChange={(v) => onUpdateSettings({ assignmentMethod: v as 'minimize' | 'balance' })}
                      />
                    </div>
                  </section>

                  {/* Time Display */}
                  <section>
                    <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Time Display
                    </h3>
                    <div className="space-y-1.5">
                      <FormatRadio
                        name="timeDisplay"
                        value="dual"
                        label="Dual (UTC + Local)"
                        current={settings.timeDisplay}
                        onChange={(v) => onUpdateSettings({ timeDisplay: v as MovementSettingsData['timeDisplay'] })}
                      />
                      <FormatRadio
                        name="timeDisplay"
                        value="utc"
                        label="UTC only"
                        current={settings.timeDisplay}
                        onChange={(v) => onUpdateSettings({ timeDisplay: v as MovementSettingsData['timeDisplay'] })}
                      />
                      <FormatRadio
                        name="timeDisplay"
                        value="local"
                        label="Local only"
                        current={settings.timeDisplay}
                        onChange={(v) => onUpdateSettings({ timeDisplay: v as MovementSettingsData['timeDisplay'] })}
                      />
                    </div>
                    {(settings.timeDisplay === 'dual' || settings.timeDisplay === 'local') && (
                      <div className="mt-3 flex items-center gap-2">
                        <label className="text-[10px] text-muted-foreground shrink-0">Base Station:</label>
                        <select
                          value={settings.baseStation}
                          onChange={(e) => {
                            const apt = baseStationOptions.find(a => a.iata_code === e.target.value)
                            onUpdateSettings({
                              baseStation: e.target.value,
                              baseTimezoneOffset: apt?.utc_offset_hours ?? settings.baseTimezoneOffset,
                            })
                          }}
                          className="text-[10px] px-2 py-1 rounded border border-border bg-transparent"
                        >
                          {baseStationOptions.map(a => (
                            <option key={a.id} value={a.iata_code!}>
                              {a.iata_code} — {a.name} (UTC{a.utc_offset_hours != null && a.utc_offset_hours >= 0 ? '+' : ''}{a.utc_offset_hours ?? '?'})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </section>

                  {/* Bar Labels */}
                  <section>
                    <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Bar Labels
                    </h3>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={barLabels.sector}
                          onChange={(e) => onUpdateSettings({ barLabels: { ...barLabels, sector: e.target.checked } })}
                          className="accent-primary"
                        />
                        <span className="text-[11px]">Show sector (SGN-HAN)</span>
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={barLabels.times}
                          onChange={(e) => onUpdateSettings({ barLabels: { ...barLabels, times: e.target.checked } })}
                          className="accent-primary"
                        />
                        <span className="text-[11px]">Show times (01:00-02:55)</span>
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={barLabels.blockTime}
                          onChange={(e) => onUpdateSettings({ barLabels: { ...barLabels, blockTime: e.target.checked } })}
                          className="accent-primary"
                        />
                        <span className="text-[11px]">Show block time (BH: 01:55)</span>
                      </label>
                    </div>
                    {/* Live preview */}
                    <div className="mt-3">
                      <BarLabelPreview barLabels={barLabels} />
                    </div>
                  </section>

                  {/* Fleet Sort Order */}
                  <section>
                    <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Fleet Sort Order
                    </h3>
                    <div className="space-y-1.5">
                      <FormatRadio
                        name="fleetSort"
                        value="type_reg"
                        label="By type, then registration"
                        current={settings.fleetSortOrder}
                        onChange={(v) => onUpdateSettings({ fleetSortOrder: v as MovementSettingsData['fleetSortOrder'] })}
                      />
                      <FormatRadio
                        name="fleetSort"
                        value="reg_only"
                        label="Flat list by registration"
                        current={settings.fleetSortOrder}
                        onChange={(v) => onUpdateSettings({ fleetSortOrder: v as MovementSettingsData['fleetSortOrder'] })}
                      />
                      <FormatRadio
                        name="fleetSort"
                        value="type_util"
                        label="By type, then utilization"
                        current={settings.fleetSortOrder}
                        onChange={(v) => onUpdateSettings({ fleetSortOrder: v as MovementSettingsData['fleetSortOrder'] })}
                      />
                    </div>
                  </section>
                </div>
              )}

              {/* ─── Display Tab ─────────────────────────────────── */}
              {activeTab === 'display' && (
                <div className="space-y-6">
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
                      <DisplayToggle
                        label="Show weekend highlights"
                        checked={display.weekendHighlights}
                        onChange={(v) => onUpdateDisplay('weekendHighlights', v)}
                      />
                      <DisplayToggle
                        label="Show AC type group separators"
                        checked={display.groupSeparators}
                        onChange={(v) => onUpdateDisplay('groupSeparators', v)}
                      />
                    </div>
                  </section>

                  <AcTypeSortSection
                    activeTypes={activeTypes}
                    acTypeOrder={settings.acTypeOrder}
                    onUpdateSettings={onUpdateSettings}
                  />
                </div>
              )}

              {/* ─── Colors Tab ──────────────────────────────────── */}
              {activeTab === 'colors' && (
                <div className="space-y-6">
                  {/* Color Mode Selector */}
                  <section>
                    <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Color Mode
                    </h3>
                    <select
                      value={settings.colorMode}
                      onChange={(e) => onUpdateSettings({ colorMode: e.target.value as MovementSettingsData['colorMode'] })}
                      className="w-full text-[11px] px-2.5 py-1.5 rounded-md border border-border bg-transparent"
                    >
                      <option value="assignment">By Assignment Status</option>
                      <option value="service_type">By Service Type</option>
                      <option value="destination_type">By Destination Type</option>
                    </select>
                  </section>

                  {/* Assignment mode */}
                  {settings.colorMode === 'assignment' && (
                    <section>
                      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Assignment Colors
                      </h3>
                      <div className="space-y-4">
                        <ColorPicker
                          label="Unassigned Flights"
                          color={colorAssignment.unassigned}
                          presets={UNASSIGNED_PRESETS}
                          onChange={(c) => onUpdateColorAssignment({ unassigned: c })}
                        />
                        <ColorPicker
                          label="Tail-Assigned Flights"
                          color={colorAssignment.assigned}
                          presets={ASSIGNED_PRESETS}
                          onChange={(c) => onUpdateColorAssignment({ assigned: c })}
                        />
                      </div>
                      <div className="mt-4">
                        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                          Preview
                        </h3>
                        <div className="grid grid-cols-2 gap-1.5">
                          <PreviewBar label="Pub + Assigned" bg={colorAssignment.assigned} solid isAssigned />
                          <PreviewBar label="Pub + Unasgn" bg={colorAssignment.unassigned} solid />
                          <PreviewBar label="Draft + Assigned" bg={colorAssignment.assigned} solid={false} isAssigned />
                          <PreviewBar label="Draft + Unasgn" bg={colorAssignment.unassigned} solid={false} />
                        </div>
                      </div>
                    </section>
                  )}

                  {/* Service Type mode */}
                  {settings.colorMode === 'service_type' && (
                    <section>
                      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Service Type Colors
                      </h3>
                      {activeServiceTypes.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground">No service types configured.</p>
                      ) : (
                        <div className="space-y-2">
                          {activeServiceTypes.map(st => (
                            <div key={st.id} className="flex items-center gap-2">
                              <span className="text-[10px] font-medium w-[30px]">{st.code}</span>
                              <span className="text-[9px] text-muted-foreground flex-1 truncate">{st.name}</span>
                              <InlineColorPicker
                                color={serviceTypeColors[st.code] || '#3B82F6'}
                                onChange={(c) => onUpdateColorServiceType({ [st.code]: c })}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  )}

                  {/* Destination Type mode */}
                  {settings.colorMode === 'destination_type' && (
                    <section>
                      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Destination Type Colors
                      </h3>
                      <div className="space-y-4">
                        <ColorPicker
                          label="Domestic"
                          color={settings.colorDestType.domestic}
                          presets={ASSIGNED_PRESETS}
                          onChange={(c) => onUpdateSettings({ colorDestType: { ...settings.colorDestType, domestic: c } })}
                        />
                        <ColorPicker
                          label="International"
                          color={settings.colorDestType.international}
                          presets={['#8B5CF6', '#7C3AED', '#6D28D9', '#A855F7', '#EC4899', '#D946EF', '#F43F5E', '#F97316']}
                          onChange={(c) => onUpdateSettings({ colorDestType: { ...settings.colorDestType, international: c } })}
                        />
                      </div>
                    </section>
                  )}

                  {/* ── Aircraft Type Colors (always visible) ────── */}
                  <div className="border-t border-border/40 pt-5">
                    <section>
                      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        Aircraft Type Colors
                      </h3>
                      <p className="text-[9px] text-muted-foreground/60 mb-3">
                        Applied to the fleet panel on the left, independent of bar color mode.
                      </p>
                      <div className="space-y-1.5">
                        {activeTypes.map(t => {
                          const isActive = (previewType || activeTypes[0]?.icao_type) === t.icao_type
                          return (
                            <div
                              key={t.id}
                              className="flex items-center gap-2 px-1.5 py-0.5 rounded-md transition-colors duration-150"
                              style={isActive ? {
                                background: 'var(--muted)',
                                borderLeft: '2px solid var(--primary)',
                              } : { borderLeft: '2px solid transparent' }}
                            >
                              <span className="text-[10px] font-medium w-[50px]">{t.icao_type}</span>
                              <span className="text-[9px] text-muted-foreground flex-1 truncate">{t.name}</span>
                              <InlineColorPicker
                                color={acTypeColors[t.icao_type] || '#3B82F6'}
                                onChange={(c) => { onUpdateColorAcType({ [t.icao_type]: c }); setPreviewType(t.icao_type) }}
                              />
                            </div>
                          )
                        })}
                      </div>

                      {/* Dynamic live preview */}
                      {(() => {
                        const pvType = previewType || activeTypes[0]?.icao_type
                        if (!pvType) return null
                        const typeColor = acTypeColors[pvType] || '#3B82F6'
                        const isDarkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
                        const headerBg = isDarkMode ? darkModeVariant(typeColor) : typeColor
                        const headerText = getContrastTextColor(headerBg, isDarkMode)
                        const regColor = desaturate(typeColor, 20)
                        const regBg = isDarkMode ? darkModeVariant(regColor) : regColor
                        const regText = getContrastTextColor(regBg, isDarkMode)

                        // Get real registrations for this type
                        const sampleRegs = (fleetPreview || [])
                          .filter(fp => fp.icaoType === pvType)
                          .slice(0, 2)
                        const regCount = (fleetPreview || []).filter(fp => fp.icaoType === pvType).length

                        return (
                          <div className="mt-4">
                            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                              Preview
                            </h3>
                            <div className="rounded-lg border border-border/50 overflow-hidden">
                              <div
                                className="flex items-center gap-1.5 px-2.5 py-1.5"
                                style={{ background: headerBg, color: headerText }}
                              >
                                <ChevronDown className="h-3 w-3 shrink-0" style={{ color: headerText }} />
                                <span className="text-[11px] font-bold">{pvType}</span>
                                <span className="text-[9px]" style={{ opacity: 0.8 }}>({regCount || '—'})</span>
                              </div>
                              {sampleRegs.length > 0 ? sampleRegs.map(fp => (
                                <div
                                  key={fp.registration}
                                  className="flex flex-col justify-center px-3 py-1.5 border-b"
                                  style={{ background: regBg, color: regText, borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
                                >
                                  <span className="text-[11px] font-semibold leading-tight">{fp.registration}</span>
                                  {fp.cabin && <span className="text-[8.5px] leading-tight" style={{ opacity: 0.7 }}>{fp.cabin}</span>}
                                </div>
                              )) : (
                                <div
                                  className="flex flex-col justify-center px-3 py-1.5"
                                  style={{ background: regBg, color: regText }}
                                >
                                  <span className="text-[10px] italic" style={{ opacity: 0.6 }}>No registrations</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })()}
                    </section>
                  </div>
                </div>
              )}

              {/* ─── Tooltip Tab ──────────────────────────────────── */}
              {activeTab === 'tooltip' && (
                <div className="space-y-6">
                  <section>
                    <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Tooltip Content
                    </h3>
                    <div className="space-y-2.5">
                      <DisplayToggle
                        label="Flight number & status"
                        checked={settings.tooltip.flightNumber}
                        onChange={(v) => onUpdateTooltip('flightNumber', v)}
                      />
                      <DisplayToggle
                        label="Stations (DEP / ARR)"
                        checked={settings.tooltip.stations}
                        onChange={(v) => onUpdateTooltip('stations', v)}
                      />
                      <DisplayToggle
                        label="Departure & arrival times"
                        checked={settings.tooltip.times}
                        onChange={(v) => onUpdateTooltip('times', v)}
                      />
                      <DisplayToggle
                        label="Block time"
                        checked={settings.tooltip.blockTime}
                        onChange={(v) => onUpdateTooltip('blockTime', v)}
                      />
                      <DisplayToggle
                        label="Aircraft type & registration"
                        checked={settings.tooltip.aircraft}
                        onChange={(v) => onUpdateTooltip('aircraft', v)}
                      />
                      <DisplayToggle
                        label="Cabin configuration"
                        checked={settings.tooltip.cabin}
                        onChange={(v) => onUpdateTooltip('cabin', v)}
                      />
                      <DisplayToggle
                        label="TAT info"
                        checked={settings.tooltip.tat}
                        onChange={(v) => onUpdateTooltip('tat', v)}
                      />
                    </div>
                  </section>

                  <section>
                    <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Coming Soon
                    </h3>
                    <div className="space-y-2.5 opacity-40 pointer-events-none">
                      <DisplayToggle
                        label="Show route info"
                        checked={false}
                        onChange={() => {}}
                      />
                      <DisplayToggle
                        label="Show crew assignments"
                        checked={false}
                        onChange={() => {}}
                      />
                    </div>
                  </section>
                </div>
              )}

              {/* ─── Turnaround Tab ──────────────────────────────── */}
              {activeTab === 'turnaround' && (
                <div className="space-y-6">
                  <section>
                    <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Turnaround Time Overrides
                    </h3>
                    <div className="space-y-3">
                      {/* Table header */}
                      <div className="grid grid-cols-[1fr_52px_52px_52px_52px_24px] gap-1.5 text-[8px] font-medium text-muted-foreground/60 uppercase tracking-wider">
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
                          <div key={t.id} className="grid grid-cols-[1fr_52px_52px_52px_52px_24px] gap-1.5 items-center">
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
                    <p className="text-[9px] text-muted-foreground/60 mt-3">
                      Overrides apply to Movement conflict detection only.
                    </p>
                  </section>
                </div>
              )}

              {/* ─── Utilization Tab ─────────────────────────────── */}
              {activeTab === 'utilization' && (
                <div className="space-y-6">
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
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent container={container} className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <RotateCcw className="h-4 w-4" />
              Reset All Settings
            </DialogTitle>
          </DialogHeader>
          <p className="text-[11px] text-muted-foreground">
            This will reset all Movement settings to their default values including display preferences, colors, utilization targets, and TAT overrides.
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
    </>
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

function FormatRadio({ name, value, label, current, onChange }: { name: string; value: string; label: string; current: string; onChange: (v: string) => void }) {
  return (
    <label
      className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
        current === value ? 'bg-primary/8 border border-primary/30' : 'hover:bg-muted/30 border border-transparent'
      }`}
      onClick={() => onChange(value)}
    >
      <input
        type="radio"
        name={name}
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

function InlineColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  return (
    <label className="relative cursor-pointer shrink-0">
      <div
        className="w-6 h-6 rounded-md border border-border"
        style={{ background: color }}
      />
      <input
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />
    </label>
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

function BarLabelPreview({ barLabels }: { barLabels: MovementSettingsData['barLabels'] }) {
  const parts: string[] = ['VJ327']
  if (barLabels.sector) parts.push('SGN-HAN')
  if (barLabels.times) parts.push('01:00-02:55')
  if (barLabels.blockTime) parts.push('BH: 01:55')
  const text = parts.join(' \u00B7 ')

  return (
    <div
      className="h-7 px-2 rounded-[5px] flex items-center text-[9px] font-medium"
      style={{
        background: 'var(--gantt-bar-bg-assigned)',
        color: 'var(--gantt-bar-text-assigned)',
        border: '1.5px solid var(--gantt-bar-border-pub)',
      }}
    >
      <span className="truncate">{text}</span>
    </div>
  )
}

function AcTypeSortSection({ activeTypes, acTypeOrder, onUpdateSettings }: {
  activeTypes: AircraftType[]
  acTypeOrder: string[]
  onUpdateSettings: (partial: Partial<MovementSettingsData>) => void
}) {
  const sortedTypes = useMemo(() => {
    if (acTypeOrder.length > 0) {
      const orderMap = new Map(acTypeOrder.map((icao, i) => [icao, i]))
      const ordered = [...activeTypes].sort((a, b) => {
        const ai = orderMap.get(a.icao_type) ?? 9999
        const bi = orderMap.get(b.icao_type) ?? 9999
        return ai - bi || a.icao_type.localeCompare(b.icao_type)
      })
      return ordered
    }
    return [...activeTypes].sort((a, b) => a.icao_type.localeCompare(b.icao_type))
  }, [activeTypes, acTypeOrder])

  const dragItem = useRef<number | null>(null)
  const dragOverItem = useRef<number | null>(null)

  const handleDragStart = useCallback((idx: number) => {
    dragItem.current = idx
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault()
    dragOverItem.current = idx
  }, [])

  const handleDrop = useCallback(() => {
    if (dragItem.current === null || dragOverItem.current === null) return
    if (dragItem.current === dragOverItem.current) return
    const items = sortedTypes.map(t => t.icao_type)
    const [removed] = items.splice(dragItem.current, 1)
    items.splice(dragOverItem.current, 0, removed)
    dragItem.current = null
    dragOverItem.current = null
    onUpdateSettings({ acTypeOrder: items })
  }, [sortedTypes, onUpdateSettings])

  if (activeTypes.length === 0) return null

  return (
    <section>
      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
        Aircraft Type Sorting
      </h3>
      <p className="text-[9px] text-muted-foreground/60 mb-2">
        Drag to reorder AC type groups in the fleet panel.
      </p>
      <div className="space-y-0.5">
        {sortedTypes.map((t, idx) => (
          <div
            key={t.icao_type}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={handleDrop}
            className="flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-muted/30 cursor-grab active:cursor-grabbing transition-colors"
          >
            <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            <span className="text-[10px] font-semibold w-[50px]">{t.icao_type}</span>
            <span className="text-[9px] text-muted-foreground truncate">{t.name}</span>
          </div>
        ))}
      </div>
      {acTypeOrder.length > 0 && (
        <button
          onClick={() => onUpdateSettings({ acTypeOrder: [] })}
          className="mt-2 flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="h-2.5 w-2.5" />
          Reset to alphabetical
        </button>
      )}
    </section>
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
